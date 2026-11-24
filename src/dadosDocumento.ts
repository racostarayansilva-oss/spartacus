// Dados do escritório que entram nos documentos: nome e logo (marca) + contato, qualificação do
// advogado e foro (Configurações → Dados nos documentos).
import { useMemo } from 'react';
import type { DadosEscritorioDoc } from './lib/modelos';
import { useMarca } from './marca';
import { useBanco } from './store';

export function useDadosDocumento(): DadosEscritorioDoc {
  const b = useBanco();
  const { marca } = useMarca();
  const d = b.config.documentos;
  return useMemo(() => ({
    nome: marca.nome || b.config.nomeEscritorio,
    logo: marca.logo,
    contato: d?.contato,
    qualificacao: d?.qualificacao,
    foro: d?.foro,
  }), [marca.nome, marca.logo, b.config.nomeEscritorio, d?.contato, d?.qualificacao, d?.foro]);
}
