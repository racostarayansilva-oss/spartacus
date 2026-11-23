// Dados iniciais de todo escritório novo (etiquetas e cores).

import type { Etiqueta } from '../store.js';

/** Etiquetas iniciais dos processos (cada escritório pode mudar). */
export const ETIQUETAS_LEGIS: Etiqueta[] = [
  { id: 'et-acordo-homologado', nome: 'ACORDO HOMOLOGADO', cor: '#d9f99d' },
  { id: 'et-beneficio-implantado', nome: 'BENEFÍCIO IMPLANTADO', cor: '#5b9cff' },
  { id: 'et-certidao-objeto-pe', nome: 'CERTIDÃO DE OBJETO E PÉ', cor: '#ec4899' },
  { id: 'et-aguardando-pericia', nome: 'AGUARDANDO PERÍCIA', cor: '#84cc16' },
  { id: 'et-recurso-improvido', nome: 'RECURSO IMPROVIDO', cor: '#475569' },
  { id: 'et-recurso-nao-conhecido', nome: 'RECURSO NÃO CONHECIDO', cor: '#8b5cf6' },
  { id: 'et-rpv', nome: 'RPV', cor: '#a7f3d0' },
  { id: 'et-sentenca-tipo-c', nome: 'SENTENÇA TIPO C', cor: '#ef4444' },
];

/** Etiquetas iniciais das tarefas (barrinhas coloridas no cartão do quadro). */
export const ETIQUETAS_TAREFA: Etiqueta[] = [
  { id: 'ett-urgente', nome: 'URGENTE', cor: '#ef4444' },
  { id: 'ett-prazo', nome: 'PRAZO JUDICIAL', cor: '#f97316' },
  { id: 'ett-inss', nome: 'INSS', cor: '#5b9cff' },
  { id: 'ett-audiencia', nome: 'AUDIÊNCIA', cor: '#8b5cf6' },
  { id: 'ett-cliente', nome: 'AGUARDANDO CLIENTE', cor: '#fcd535' },
  { id: 'ett-protocolo', nome: 'PROTOCOLO', cor: '#22c55e' },
];

/** Cores para novas etiquetas. */
export const CORES_ETIQUETA = ['#fcd535', '#ef4444', '#f97316', '#84cc16', '#22c55e', '#a7f3d0', '#06b6d4', '#5b9cff', '#8b5cf6', '#ec4899', '#d9f99d', '#475569'];

