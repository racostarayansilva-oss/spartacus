import { describe, expect, it } from 'vitest';
import { lerEmail } from './integracoes/email';
import { codigoWorker, gerarEmailCliente, limparDominio, parteLocal } from '../src/lib/emailCliente';

const BRUTO = [
  'From: =?UTF-8?Q?gov=2Ebr?= <naoresponda@acesso.gov.br>',
  'To: maria.souza.k3f9@clientes.exemplo.adv.br',
  'Subject: =?UTF-8?Q?C=C3=B3digo_de_verifica=C3=A7=C3=A3o?=',
  'Date: Thu, 12 Nov 2026 09:12:00 -0300',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="xx"',
  '',
  '--xx',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Seu c=C3=B3digo =C3=A9: 482913',
  '--xx',
  'Content-Type: application/pdf; name="aviso.pdf"',
  'Content-Disposition: attachment; filename="aviso.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  'JVBERi0xLjQK',
  '--xx--',
  '',
].join('\r\n');

describe('e-mails dos clientes', () => {
  it('lê remetente, assunto, texto, data e anexos do e-mail bruto', async () => {
    const e = await lerEmail(new TextEncoder().encode(BRUTO));
    expect(e.de).toBe('gov.br <naoresponda@acesso.gov.br>');
    expect(e.assunto).toBe('Código de verificação');
    expect(e.texto).toContain('Seu código é: 482913');
    expect(e.recebidoEm).toBe('2026-11-12T12:12:00.000Z');
    expect(e.anexos).toEqual([{ nome: 'aviso.pdf', tipo: 'application/pdf', tamanho: 9 }]);
  });

  it('gera endereço com primeiro e último nome, sem acento, e evita os já usados', () => {
    expect(parteLocal('Maria das Graças Souza', 'k3f9')).toBe('maria.souza.k3f9');
    expect(parteLocal('João', 'ab12')).toBe('joao.ab12');
    expect(parteLocal('123', 'ab12')).toBe('cliente.ab12');
    const sorteios = ['aaaa', 'bbbb'];
    const e = gerarEmailCliente('Ana Lima', 'x.adv.br', new Set(['ana.lima.aaaa@x.adv.br']), () => sorteios.shift()!);
    expect(e).toBe('ana.lima.bbbb@x.adv.br');
  });

  it('limpa o domínio digitado', () => {
    expect(limparDominio(' https://Clientes.Escritorio.adv.br/ ')).toBe('clientes.escritorio.adv.br');
    expect(limparDominio('@x.com.br')).toBe('x.com.br');
    expect(limparDominio('sem ponto')).toBe('');
  });

  it('o código do Worker é JavaScript válido e leva a URL e a chave', () => {
    const c = codigoWorker('https://app.exemplo.com/api/email/entrada', 'abc"123');
    expect(c).toContain('"https://app.exemplo.com/api/email/entrada"');
    expect(c).toContain('"abc\\"123"');
    expect(() => new Function(c.replace('export default', 'return'))).not.toThrow();
  });
});
