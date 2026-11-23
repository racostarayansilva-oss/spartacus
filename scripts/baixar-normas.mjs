// Baixa o catálogo de normas federais do Senado (Dados Abertos) e grava em server/dados/normas-federais.json.gz.
// Uso: node scripts/baixar-normas.mjs            (todos os anos)
//      node scripts/baixar-normas.mjs 2024 2026  (só esses anos; junta com o arquivo atual)
//
// A API do Senado não busca por palavra, mas lista as normas por tipo e ano com ementa e apelidos
// ("Lei de Benefícios da Previdência Social", "Código de Processo Civil"…). Com esse catálogo
// o RA Connect faz a busca por termo no próprio servidor.

import { gunzipSync, gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = join(RAIZ, 'server', 'dados', 'normas-federais.json.gz');

// Tipos do Senado (sigla da API). CON = Constituições.
const TIPOS = ['CON', 'EMC', 'LCP', 'LEI', 'DEL', 'MPV', 'DEC', 'DLG', 'DPL', 'RSF'];
const ANO_ATUAL = new Date().getFullYear();
const [anoIni, anoFim] = process.argv.slice(2).map(Number);
const DE = anoIni || 1808;
const ATE = anoFim || anoIni || ANO_ATUAL;
const SIMULTANEAS = 3;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function lista(tipo, ano) {
  const url = `https://legis.senado.leg.br/dadosabertos/legislacao/lista.json?tipo=${tipo}&ano=${ano}`;
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'RA-Connect/0.1 (catalogo de normas)' }, signal: AbortSignal.timeout(90_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const docs = d?.ListaDocumento?.documentos?.documento;
      return docs ? (Array.isArray(docs) ? docs : [docs]) : [];
    } catch (e) {
      if (t >= 4) throw new Error(`${tipo}/${ano}: ${e.message}`);
      await esperar(2000 * t);
    }
  }
}

const iso = (br) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

/** "LEI-8213-1991-07-24 , Lei de Cotas… (1991) , Lei de Benefícios… (1991)" → ["Lei de Cotas…", "Lei de Benefícios…"] */
function apelidos(s, codigo) {
  return [...new Set(String(s || '').split(/\s*,\s*/)
    .map((a) => a.replace(/\s*\(\d{4}\)\s*$/, '').trim())
    .filter((a) => a && a !== codigo && !/^[A-Z]{2,4}-/.test(a)))];
}

// Junta com o arquivo atual quando baixa só alguns anos
const porId = new Map();
if (existsSync(SAIDA) && anoIni) {
  for (const x of JSON.parse(gunzipSync(readFileSync(SAIDA)).toString('utf8')).itens) porId.set(x[0], x);
}

const tarefas = [];
for (const tipo of TIPOS) for (let ano = DE; ano <= ATE; ano++) tarefas.push([tipo, ano]);
const falhas = [];
let feitas = 0;
const inicio = Date.now();

async function trabalhador() {
  while (tarefas.length) {
    const [tipo, ano] = tarefas.shift();
    try {
      for (const d of await lista(tipo, ano)) {
        // [id, tipo, número, data ISO, nome, ementa, apelidos]
        porId.set(String(d.id), [String(d.id), tipo, String(d.numero || ''), iso(d.dataassinatura), String(d.normaNome || ''), String(d.ementa || '').replace(/\s+/g, ' ').trim(), apelidos(d.apelido, d.norma)]);
      }
    } catch (e) {
      falhas.push(e.message);
    }
    feitas++;
    if (feitas % 50 === 0) {
      const s = Math.round((Date.now() - inicio) / 1000);
      console.log(`${feitas} consultas · ${porId.size} normas · ${s}s`);
    }
  }
}

await Promise.all(Array.from({ length: SIMULTANEAS }, trabalhador));

const itens = [...porId.values()].sort((a, b) => b[3].localeCompare(a[3]));
mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, gzipSync(JSON.stringify({ gerado: new Date().toISOString(), fonte: 'Senado Federal — Dados Abertos Legislativos', itens }), { level: 9 }));

const porTipo = {};
for (const x of itens) porTipo[x[1]] = (porTipo[x[1]] || 0) + 1;
console.log(`\nPronto: ${itens.length} normas em ${SAIDA}`);
console.log(porTipo);
if (falhas.length) {
  console.log(`\n${falhas.length} consulta(s) falharam (rode de novo só esses anos):`);
  for (const f of falhas) console.log(' -', f);
  process.exitCode = 1;
}
