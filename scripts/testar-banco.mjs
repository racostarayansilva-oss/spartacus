// Teste do banco: roda supabase/schema.sql num Postgres em memória (PGlite) com um auth do Supabase simulado
// e confere o isolamento entre escritórios. Uso: npm run test:banco
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const schema = readFileSync(process.argv[2] || new URL('../supabase/schema.sql', import.meta.url), 'utf8');
const db = new PGlite();
const ok = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exitCode = 1; } else console.log('ok -', m); };

await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;
`);
await db.exec(schema);
await db.exec(schema); // repetível
console.log('ok - schema roda duas vezes');
await db.exec(`grant usage on schema public to anon, authenticated;
  grant all on all tables in schema public to authenticated; grant select on all tables in schema public to anon;
  grant usage, select on all sequences in schema public to authenticated;`);

const PLAT = '00000000-0000-0000-0000-0000000000aa';
const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const X = '00000000-0000-0000-0000-00000000000c'; // sem autorização
await db.exec(`insert into auth.users (id, email) values ('${PLAT}', 'plat@spartacus'), ('${X}', 'x@x.com');
  insert into plataforma_admins (auth_id, email) values ('${PLAT}', 'plat@spartacus');`);

const como = async (uid, sql, params) => {
  await db.exec(`reset role; select set_config('app.uid', '${uid}', false); set role authenticated;`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
};

// Plataforma cria dois escritórios
const e1 = (await como(PLAT, `select plataforma_criar_escritorio('silva', 'Silva Adv', '{}', 'essencial', 'Ana@Silva.com', 'Ana', '[{"numero":"1","uf":"SP"}]') id`)).rows[0].id;
const e2 = (await como(PLAT, `select plataforma_criar_escritorio('souza', 'Souza Adv', '{}', 'essencial', 'beto@souza.com', 'Beto', '[]') id`)).rows[0].id;
ok(e1 && e2, 'plataforma cria escritórios');
let erro = null;
try { await como(A, `select plataforma_criar_escritorio('zzz', 'Z', '{}', 'essencial', '', '', '[]')`); } catch (e) { erro = e.message; }
ok(/plataforma/.test(erro || ''), 'quem não é da plataforma não cria escritório');

// Logins criados depois da autorização entram direto no escritório certo
await db.exec(`insert into auth.users (id, email) values ('${A}', 'ana@silva.com'), ('${B}', 'beto@souza.com')`);
const pa = (await db.query(`select escritorio_id, papel from perfis where auth_id = $1`, [A])).rows[0];
ok(pa.escritorio_id === e1 && pa.papel === 'advogado', 'administrador ligado ao escritório pelo e-mail (sem diferenciar maiúsculas)');
const px = (await db.query(`select escritorio_id, papel from perfis where auth_id = $1`, [X])).rows[0];
ok(px.escritorio_id === null && px.papel === 'pendente', 'login sem autorização fica pendente e sem escritório');

// Dados isolados
await como(A, `insert into processos (escritorio_id, id, dados) values ($1, 'p1', '{"id":"p1"}')`, [e1]);
await como(A, `insert into processos (id, dados) values ('p2', '{"id":"p2"}')`); // padrão = meu escritório
await como(B, `insert into processos (escritorio_id, id, dados) values ($1, 'p1', '{"id":"p1","de":"souza"}')`, [e2]); // mesmo id, outro escritório
const va = (await como(A, `select id, dados->>'de' de from processos order by id`)).rows;
const vb = (await como(B, `select id, dados->>'de' de from processos order by id`)).rows;
ok(va.length === 2 && va.every((r) => r.de === null), 'A vê só os 2 processos dele');
ok(vb.length === 1 && vb[0].de === 'souza', 'B vê só o dele (mesmo id não colide)');
erro = null;
try { await como(B, `insert into processos (escritorio_id, id, dados) values ($1, 'invasao', '{}')`, [e1]); } catch (e) { erro = e.message; }
ok(/row-level security/.test(erro || ''), 'B não grava no escritório de A');
const apagou = await como(B, `delete from processos where escritorio_id = $1 returning id`, [e1]);
ok(apagou.rows.length === 0, 'B não apaga dados de A');
ok((await como(X, `select * from processos`)).rows.length === 0, 'pendente não vê nada');
ok((await como(B, `select auth_id from perfis`)).rows.length === 1, 'B não vê a equipe de A');

// Upsert como o app faz
await como(A, `insert into processos (escritorio_id, id, dados) values ($1, 'p1', '{"id":"p1","v":2}') on conflict (escritorio_id, id) do update set dados = excluded.dados`, [e1]);
ok((await como(A, `select dados->>'v' v from processos where id='p1'`)).rows[0].v === '2', 'upsert por (escritorio_id, id)');

// Marca: pública pelo subdomínio, alterada só pelo administrador
await db.exec('reset role');
const marca = (await db.query(`select marca_publica('silva.spartacus.adv.br') m`)).rows[0].m;
ok(marca && marca.slug === 'silva', 'marca pública pelo subdomínio');
await como(A, `select alterar_marca('{"nome":"Silva & Cia","corPrimaria":"#112233"}')`);
ok((await db.query(`select nome from escritorios where id = $1`, [e1])).rows[0].nome === 'Silva & Cia', 'administrador troca a marca');
erro = null;
try { await como(X, `select alterar_marca('{"nome":"hack"}')`); } catch (e) { erro = e.message; }
ok(/administrador/.test(erro || ''), 'pendente não troca marca');
ok((await como(B, `select id from escritorios`)).rows.length === 1, 'B só lê o próprio escritório');

// Domínio próprio único
await como(PLAT, `update escritorios set dominios = '{Sistema.Silva.com.br}' where id = $1`, [e1]);
erro = null;
try { await como(PLAT, `update escritorios set dominios = '{sistema.silva.com.br}' where id = $1`, [e2]); } catch (e) { erro = e.message; }
ok(/Domínio já usado/.test(erro || ''), 'domínio não pode ir para dois escritórios');
ok((await db.query(`select dominio_permitido('sistema.silva.com.br') d`)).rows[0].d === true, 'domínio próprio liberado para HTTPS');
ok((await db.query(`select marca_publica('sistema.silva.com.br') m`)).rows[0].m.slug === 'silva', 'marca pelo domínio próprio');

// Suspensão corta o acesso
await como(PLAT, `update escritorios set situacao = 'suspenso' where id = $1`, [e1]);
ok((await como(A, `select * from processos`)).rows.length === 0, 'escritório suspenso não acessa os dados');

// E-mails: chave por escritório
await como(PLAT, `update escritorios set situacao = 'ativo' where id = $1`, [e1]);
const chave = (await como(A, `select gerar_chave_email() k`)).rows[0].k;
await db.exec(`set role anon`);
await db.query(`select receber_email($1, 'x@y', 'de', 'assunto', 'texto', '', '[]', now())`, [chave]);
await db.exec('reset role');
ok((await como(A, `select * from emails_recebidos`)).rows.length === 1 && (await como(B, `select * from emails_recebidos`)).rows.length === 0, 'e-mail cai só no escritório da chave');

// Resumo da plataforma
ok((await como(PLAT, `select * from plataforma_resumo()`)).rows.length === 2, 'resumo da plataforma');
console.log(process.exitCode ? 'HÁ FALHAS' : 'TUDO OK');
