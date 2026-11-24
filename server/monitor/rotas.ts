// /api/monitor/* — só existe no servidor próprio (na Vercel não há agenda nem chave secreta).
import { autenticar, exigirAdministrador, exigirEquipe } from '../auth.js';
import { ErroApi, ok, Resposta } from '../http.js';
import { AGENDA_TEXTO, monitorLigado } from './agendador.js';
import { escritorio, lerEstado } from './banco.js';
import { estaRodando, executar, Rotina } from './rotinas.js';
import { whatsappConfigurado } from './whatsapp.js';

export async function atenderMonitor(metodo: string, caminho: string, autorizacao: string, corpo: any): Promise<Resposta | null> {
  if (!/^monitor(\/|$)/.test(caminho)) return null;
  try {
    const sessao = await autenticar(autorizacao);
    if (metodo === 'GET' && caminho === 'monitor/estado') {
      exigirEquipe(sessao);
      if (!monitorLigado() || !sessao?.escritorioId) return ok({ ligado: false, agenda: AGENDA_TEXTO, whatsapp: false, estado: {} });
      const esc = await escritorio(sessao.escritorioId);
      return ok({ ligado: true, agenda: AGENDA_TEXTO, whatsapp: whatsappConfigurado(esc?.whatsapp), estado: await lerEstado(sessao.escritorioId) });
    }
    if (metodo === 'POST' && caminho === 'monitor/executar') {
      exigirAdministrador(sessao);
      if (!monitorLigado()) throw new ErroApi(503, 'Monitor desligado: falta SUPABASE_SECRET_KEY no servidor.');
      const rotina = corpo?.rotina as Rotina;
      if (rotina !== 'djen' && rotina !== 'datajud') throw new ErroApi(400, 'Rotina inválida.');
      if (!sessao?.escritorioId) throw new ErroApi(400, 'Login sem escritório.');
      if (estaRodando(rotina, sessao.escritorioId)) return ok({ iniciado: false, mensagem: 'Já está rodando.' });
      void executar(rotina, 'manual', sessao.escritorioId);
      return ok({ iniciado: true });
    }
    return { status: 404, body: { erro: 'Rota do monitor não encontrada.' } };
  } catch (e: any) {
    if (e instanceof ErroApi) return { status: e.status, body: { erro: e.message } };
    console.error(e);
    return { status: 500, body: { erro: 'Erro interno' } };
  }
}
