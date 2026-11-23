-- RA Connect — banco de dados (Supabase / PostgreSQL)
-- Como usar: Supabase → SQL Editor → New query → cole TODO este arquivo → Run.
-- Pode rodar de novo sem problema (não apaga dados).
--
-- Modelo: cada coleção do app é uma tabela com "id" e "dados" (JSON). Assim o app evolui sem
-- precisar de migração a cada campo novo, e os dados continuam consultáveis em SQL
-- (ex.: select dados->>'nome' from clientes).
--
-- Acesso:
--   * O primeiro login criado vira "advogado" (administrador).
--   * Os demais entram como "pendente" e o advogado libera em Configurações → Equipe.
--   * Só "advogado" e "equipe" leem e gravam os dados do escritório.

-- 1. Perfis (um por login) -------------------------------------------------------------
create table if not exists public.perfis (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text not null default '',
  papel text not null default 'pendente'
    check (papel in ('pendente', 'advogado', 'equipe', 'cliente', 'bloqueado')),
  cpf text,
  criado_em timestamptz not null default now()
);

create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where auth_id = auth.uid() and papel in ('advogado', 'equipe'));
$$;

create or replace function public.eh_advogado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where auth_id = auth.uid() and papel = 'advogado');
$$;

-- E-mails já liberados: ao criar o login, a pessoa entra direto com este nome e papel.
create table if not exists public.acessos_autorizados (
  email text primary key,
  nome text not null,
  papel text not null default 'equipe' check (papel in ('advogado', 'equipe', 'cliente'))
);
alter table acessos_autorizados enable row level security;
drop policy if exists acessos_advogado on acessos_autorizados;
create policy acessos_advogado on acessos_autorizados for all to authenticated
  using (eh_advogado()) with check (eh_advogado());

-- Cria o perfil automaticamente quando um login é criado no Supabase Auth.
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare a acessos_autorizados;
begin
  select * into a from acessos_autorizados where email = lower(new.email);
  insert into perfis (auth_id, email, nome, papel)
  values (
    new.id,
    new.email,
    coalesce(a.nome, new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    case
      when a.papel is not null then a.papel
      when exists (select 1 from perfis where papel = 'advogado') then 'pendente'
      else 'advogado'
    end
  )
  on conflict (auth_id) do nothing;
  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();

-- Logins criados antes deste script também ganham perfil.
insert into perfis (auth_id, email, nome, papel)
select id, email, split_part(email, '@', 1), 'pendente' from auth.users
on conflict (auth_id) do nothing;

update perfis set papel = 'advogado'
where auth_id = (select auth_id from perfis order by criado_em limit 1)
  and not exists (select 1 from perfis where papel = 'advogado');

alter table perfis enable row level security;
drop policy if exists perfis_ler on perfis;
create policy perfis_ler on perfis for select to authenticated
  using (auth_id = auth.uid() or eh_equipe());
drop policy if exists perfis_advogado_altera on perfis;
create policy perfis_advogado_altera on perfis for update to authenticated
  using (eh_advogado()) with check (eh_advogado());

-- 2. Coleções do escritório ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'config', 'corretores', 'clientes', 'processos', 'registros', 'audiencias', 'intimacoes',
    'compromissos', 'tarefas', 'mensagens', 'pedidos_protocolo', 'lancamentos',
    'atividades', 'relatorios_diarios'
  ]
  loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        dados jsonb not null,
        atualizado_em timestamptz not null default now(),
        atualizado_por uuid default auth.uid()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists equipe_acessa on public.%I', t);
    execute format('create policy equipe_acessa on public.%I for all to authenticated using (eh_equipe()) with check (eh_equipe())', t);
    -- Tempo real: a equipe vê na hora o que o colega alterou
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Relatórios diários: cada pessoa vê e grava só o próprio; o advogado (administrador) vê os de toda a equipe.
drop policy if exists equipe_acessa on relatorios_diarios;
drop policy if exists relatorio_ler on relatorios_diarios;
create policy relatorio_ler on relatorios_diarios for select to authenticated
  using (eh_advogado() or (eh_equipe() and dados->>'usuarioId' = auth.uid()::text));
drop policy if exists relatorio_gravar on relatorios_diarios;
create policy relatorio_gravar on relatorios_diarios for insert to authenticated
  with check (eh_equipe() and dados->>'usuarioId' = auth.uid()::text);
drop policy if exists relatorio_alterar on relatorios_diarios;
create policy relatorio_alterar on relatorios_diarios for update to authenticated
  using (eh_equipe() and dados->>'usuarioId' = auth.uid()::text)
  with check (eh_equipe() and dados->>'usuarioId' = auth.uid()::text);
drop policy if exists relatorio_apagar on relatorios_diarios;
create policy relatorio_apagar on relatorios_diarios for delete to authenticated
  using (eh_advogado() or (eh_equipe() and dados->>'usuarioId' = auth.uid()::text));

-- Índices úteis
create index if not exists clientes_cpf on clientes ((dados->>'cpf'));
create index if not exists registros_data on registros ((dados->>'data'));
create index if not exists atividades_data on atividades ((dados->>'data'));
create index if not exists relatorios_diarios_data on relatorios_diarios ((dados->>'data'));

-- 3. Diretório de senhas: só o administrador (advogado) vê e altera -----------------------
-- E-mails recebidos nos endereços gerados para os clientes: a equipe lê, marca como lido e exclui.
do $$
declare t text;
begin
  foreach t in array array['senhas', 'emails_recebidos'] loop
    execute format($f$
      create table if not exists public.%1$I (
        id text primary key,
        dados jsonb not null,
        atualizado_em timestamptz not null default now(),
        atualizado_por uuid default auth.uid()
      )$f$, t);
    execute format('alter table public.%I enable row level security', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

drop policy if exists so_administrador on senhas;
create policy so_administrador on senhas for all to authenticated
  using (eh_advogado()) with check (eh_advogado());

drop policy if exists equipe_acessa on emails_recebidos;
create policy equipe_acessa on emails_recebidos for all to authenticated
  using (eh_equipe()) with check (eh_equipe());
create index if not exists emails_recebidos_cliente on emails_recebidos ((dados->>'clienteId'));
create index if not exists clientes_email_gerado on clientes ((lower(dados->>'emailGerado')));

-- Chave que o Cloudflare (Email Worker) usa para entregar os e-mails. Ninguém lê esta tabela pelo app.
create table if not exists public.email_entrada_chave (
  id int primary key default 1 check (id = 1),
  chave text not null,
  criada_em timestamptz not null default now()
);
alter table email_entrada_chave enable row level security;

create or replace function public.gerar_chave_email() returns text
language plpgsql security definer set search_path = public as $$
declare k text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not eh_advogado() then raise exception 'Só o administrador gera a chave dos e-mails.'; end if;
  insert into email_entrada_chave (id, chave, criada_em) values (1, k, now())
  on conflict (id) do update set chave = excluded.chave, criada_em = now();
  return k;
end $$;
revoke execute on function public.gerar_chave_email() from public, anon;
grant execute on function public.gerar_chave_email() to authenticated;

-- Chamada pelo servidor do app (/api/email/entrada) com a chave; liga o e-mail ao cliente dono do endereço.
create or replace function public.receber_email(
  p_chave text, p_para text, p_de text, p_assunto text, p_texto text, p_html text, p_anexos jsonb, p_recebido_em timestamptz
) returns text
language plpgsql security definer set search_path = public as $$
declare
  cid text;
  novo text := replace(gen_random_uuid()::text, '-', '');
begin
  if p_chave is null or not exists (select 1 from email_entrada_chave where chave = p_chave) then
    raise exception 'Chave inválida' using errcode = '28000';
  end if;
  select id into cid from clientes where lower(dados->>'emailGerado') = lower(trim(p_para)) limit 1;
  insert into emails_recebidos (id, dados, atualizado_por) values (novo, jsonb_build_object(
    'id', novo, 'clienteId', cid, 'para', lower(trim(p_para)), 'de', left(coalesce(p_de, ''), 300),
    'assunto', left(coalesce(p_assunto, ''), 500), 'texto', left(coalesce(p_texto, ''), 100000),
    'html', left(coalesce(p_html, ''), 300000), 'anexos', coalesce(p_anexos, '[]'::jsonb),
    'recebidoEm', coalesce(p_recebido_em, now()), 'lido', false
  ), null);
  return novo;
end $$;
revoke execute on function public.receber_email(text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.receber_email(text, text, text, text, text, text, jsonb, timestamptz) to anon, authenticated;

-- Central de notificações: cada pessoa lê, marca como lida e apaga só as suas;
-- qualquer pessoa da equipe pode criar um aviso para um colega (tarefa ou menção com @).
create table if not exists public.notificacoes (
  id text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid default auth.uid()
);
alter table notificacoes enable row level security;
do $$ begin
  alter publication supabase_realtime add table public.notificacoes;
exception when duplicate_object then null;
end $$;
drop policy if exists notif_ler on notificacoes;
create policy notif_ler on notificacoes for select to authenticated
  using (eh_equipe() and dados->>'paraId' = auth.uid()::text);
drop policy if exists notif_criar on notificacoes;
create policy notif_criar on notificacoes for insert to authenticated
  with check (eh_equipe() and dados->>'deId' = auth.uid()::text);
drop policy if exists notif_alterar on notificacoes;
create policy notif_alterar on notificacoes for update to authenticated
  using (eh_equipe() and dados->>'paraId' = auth.uid()::text)
  with check (eh_equipe() and dados->>'paraId' = auth.uid()::text);
drop policy if exists notif_apagar on notificacoes;
create policy notif_apagar on notificacoes for delete to authenticated
  using (eh_equipe() and dados->>'paraId' = auth.uid()::text);
create index if not exists notificacoes_para on notificacoes ((dados->>'paraId'));

-- 4. Auditoria das consultas por CPF (LGPD) --------------------------------------------
create table if not exists public.logs_cpf (
  id bigserial primary key,
  em timestamptz not null default now(),
  auth_id uuid default auth.uid(),
  usuario_nome text,
  cpf_mascarado text not null,
  resultado text
);
alter table logs_cpf enable row level security;
drop policy if exists logs_inserir on logs_cpf;
create policy logs_inserir on logs_cpf for insert to authenticated with check (auth_id = auth.uid());
drop policy if exists logs_ler on logs_cpf;
create policy logs_ler on logs_cpf for select to authenticated using (eh_advogado() or auth_id = auth.uid());

-- Monitor automático (servidor próprio): última execução de cada rotina (DJEN, DataJud).
-- Só o servidor grava, com a chave secreta; a equipe apenas lê.
create table if not exists public.monitor_estado (
  id text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table monitor_estado enable row level security;
drop policy if exists monitor_ler on monitor_estado;
create policy monitor_ler on monitor_estado for select to authenticated using (eh_equipe());
