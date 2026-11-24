-- Spartacus — banco de dados multi-escritório (Supabase / PostgreSQL)
-- Como usar: Supabase → SQL Editor → New query → cole TODO este arquivo → Run.
-- Pode rodar de novo sem problema (não apaga dados).
--
-- Modelo
--   * escritorios: cada escritório contratante (marca, domínios, plano, situação, implantação).
--   * perfis: um por login, ligado a UM escritório. Papéis: advogado (administrador do escritório),
--     equipe, cliente, pendente, bloqueado.
--   * plataforma_admins: equipe Spartacus (cria escritórios e acompanha a implantação).
--   * Cada coleção do app é uma tabela (escritorio_id, id, dados jsonb). As regras de acesso (RLS)
--     garantem que ninguém lê nem grava dados de outro escritório.
--
-- Primeiro acesso da plataforma: depois de rodar este arquivo, crie o seu login no Supabase Auth e rode
--   insert into plataforma_admins (auth_id, email, nome) select id, email, 'Equipe Spartacus' from auth.users where email = 'SEU@EMAIL';


-- 1. Plataforma e escritórios -------------------------------------------------------------
create table if not exists public.plataforma_admins (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  nome text not null default '',
  criado_em timestamptz not null default now()
);
alter table plataforma_admins enable row level security;

create table if not exists public.escritorios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$'
    and slug not in ('www', 'app', 'api', 'admin', 'painel', 'plataforma', 'suporte', 'mail', 'status')),
  nome text not null,
  -- nomeCurto, subtitulo, logo (data:image/… até ~250 KB), corPrimaria, corDestaque, rodape
  marca jsonb not null default '{}'::jsonb,
  -- domínios próprios do escritório (ex.: sistema.silvaadvocacia.com.br)
  dominios text[] not null default '{}',
  plano text not null default 'essencial' check (plano in ('essencial', 'profissional', 'diamante')),
  situacao text not null default 'implantacao' check (situacao in ('implantacao', 'ativo', 'suspenso', 'cancelado')),
  -- módulos desligados para este escritório (rotas do menu); vazio = tudo ligado
  modulos_desligados text[] not null default '{}',
  -- checklist da implantação: { "inicio": "...", "<passo>": { "feitoEm": "...", "por": "..." } }
  implantacao jsonb not null default '{}'::jsonb,
  -- WhatsApp do escritório na Evolution API: { "instancia": "...", "destino": "55..." }
  whatsapp jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index if not exists escritorios_dominios on escritorios using gin (dominios);
alter table escritorios enable row level security;

-- Um domínio próprio pertence a um escritório só (e é guardado em minúsculas).
create or replace function public.conferir_dominios() returns trigger
language plpgsql as $$
begin
  new.dominios := array(select distinct lower(trim(d)) from unnest(new.dominios) d where trim(d) <> '');
  if exists (select 1 from escritorios e where e.id <> new.id and e.dominios && new.dominios) then
    raise exception 'Domínio já usado por outro escritório.' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists dominios_unicos on escritorios;
create trigger dominios_unicos before insert or update of dominios on escritorios
  for each row execute function public.conferir_dominios();

-- 2. Perfis --------------------------------------------------------------------------------
create table if not exists public.perfis (
  auth_id uuid primary key references auth.users(id) on delete cascade,
  escritorio_id uuid references escritorios(id) on delete cascade,
  email text,
  nome text not null default '',
  papel text not null default 'pendente'
    check (papel in ('pendente', 'advogado', 'equipe', 'cliente', 'bloqueado')),
  cpf text,
  criado_em timestamptz not null default now()
);
create index if not exists perfis_escritorio on perfis (escritorio_id);

create or replace function public.eh_plataforma() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where auth_id = auth.uid());
$$;

-- Escritório de quem está logado (só se o escritório não estiver suspenso/cancelado).
create or replace function public.meu_escritorio() returns uuid
language sql stable security definer set search_path = public as $$
  select p.escritorio_id from perfis p join escritorios e on e.id = p.escritorio_id
  where p.auth_id = auth.uid() and e.situacao in ('implantacao', 'ativo');
$$;

create or replace function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis p join escritorios e on e.id = p.escritorio_id
    where p.auth_id = auth.uid() and p.papel in ('advogado', 'equipe') and e.situacao in ('implantacao', 'ativo')
  );
$$;

create or replace function public.eh_advogado() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from perfis p join escritorios e on e.id = p.escritorio_id
    where p.auth_id = auth.uid() and p.papel = 'advogado' and e.situacao in ('implantacao', 'ativo')
  );
$$;

drop policy if exists plat_ler on plataforma_admins;
create policy plat_ler on plataforma_admins for select to authenticated using (auth_id = auth.uid());

-- Escritórios: a plataforma vê e altera todos; cada pessoa lê o próprio; o administrador do
-- escritório altera a marca (white label) pelo app. Plano, situação e domínios só pela plataforma.
drop policy if exists esc_plataforma on escritorios;
create policy esc_plataforma on escritorios for all to authenticated using (eh_plataforma()) with check (eh_plataforma());
drop policy if exists esc_ler on escritorios;
create policy esc_ler on escritorios for select to authenticated using (id = meu_escritorio());

create or replace function public.alterar_marca(p_marca jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_advogado() then raise exception 'Só o administrador do escritório altera a marca.'; end if;
  if length(p_marca::text) > 400000 then raise exception 'Logo grande demais (use uma imagem de até 250 KB).'; end if;
  update escritorios set marca = p_marca, nome = coalesce(nullif(trim(p_marca->>'nome'), ''), nome) where id = meu_escritorio();
end $$;
revoke execute on function public.alterar_marca(jsonb) from public, anon;
grant execute on function public.alterar_marca(jsonb) to authenticated;

-- Marca pública (tela de login antes de entrar): pelo domínio próprio ou pelo subdomínio (slug.dominio-da-plataforma).
create or replace function public.marca_publica(p_host text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id, 'slug', e.slug, 'nome', e.nome, 'marca', e.marca, 'situacao', e.situacao)
  from escritorios e
  where e.situacao <> 'cancelado'
    and (lower(p_host) = any (e.dominios) or e.slug = split_part(lower(p_host), '.', 1))
  order by (lower(p_host) = any (e.dominios)) desc
  limit 1;
$$;
grant execute on function public.marca_publica(text) to anon, authenticated;

-- Domínio próprio liberado para certificado (o Caddy pergunta antes de emitir).
create or replace function public.dominio_permitido(p_host text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from escritorios where situacao <> 'cancelado' and lower(p_host) = any (dominios));
$$;
grant execute on function public.dominio_permitido(text) to anon, authenticated;

-- E-mails já liberados: ao criar o login, a pessoa entra direto no escritório, com este nome e papel.
create table if not exists public.acessos_autorizados (
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  email text not null,
  nome text not null,
  papel text not null default 'equipe' check (papel in ('advogado', 'equipe', 'cliente')),
  criado_em timestamptz not null default now(),
  primary key (escritorio_id, email)
);
alter table acessos_autorizados enable row level security;
drop policy if exists acessos_advogado on acessos_autorizados;
create policy acessos_advogado on acessos_autorizados for all to authenticated
  using (eh_plataforma() or (eh_advogado() and escritorio_id = meu_escritorio()))
  with check (eh_plataforma() or (eh_advogado() and escritorio_id = meu_escritorio()));

-- Cria o perfil quando um login é criado no Supabase Auth. Sem autorização prévia a pessoa fica
-- "pendente" e sem escritório (nunca vira administradora sozinha).
create or replace function public.novo_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare a acessos_autorizados;
begin
  select * into a from acessos_autorizados where email = lower(new.email) order by criado_em desc limit 1;
  insert into perfis (auth_id, escritorio_id, email, nome, papel)
  values (
    new.id, a.escritorio_id, new.email,
    coalesce(a.nome, new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(a.papel, 'pendente')
  )
  on conflict (auth_id) do nothing;
  return new;
end $$;
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.novo_perfil();

-- Autorização feita depois de o login já existir: liga o perfil na hora.
create or replace function public.aplicar_acesso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update perfis set escritorio_id = new.escritorio_id, nome = new.nome, papel = new.papel
  where lower(email) = new.email and (escritorio_id is null or escritorio_id = new.escritorio_id) and papel <> 'bloqueado';
  return new;
end $$;
drop trigger if exists ao_autorizar on acessos_autorizados;
create trigger ao_autorizar after insert or update on acessos_autorizados
  for each row execute function public.aplicar_acesso();

alter table perfis enable row level security;
drop policy if exists perfis_ler on perfis;
create policy perfis_ler on perfis for select to authenticated
  using (auth_id = auth.uid() or eh_plataforma() or (eh_equipe() and escritorio_id = meu_escritorio()));
drop policy if exists perfis_advogado_altera on perfis;
create policy perfis_advogado_altera on perfis for update to authenticated
  using (eh_plataforma() or (eh_advogado() and escritorio_id = meu_escritorio()))
  with check (eh_plataforma() or (eh_advogado() and escritorio_id = meu_escritorio()));

-- 3. Coleções do escritório ---------------------------------------------------------------
create or replace function public.criar_colecao(t text) returns void
language plpgsql as $$
begin
  execute format($f$
    create table if not exists public.%1$I (
      escritorio_id uuid not null default meu_escritorio() references escritorios(id) on delete cascade,
      id text not null,
      dados jsonb not null,
      atualizado_em timestamptz not null default now(),
      atualizado_por uuid default auth.uid(),
      primary key (escritorio_id, id)
    )$f$, t);
  execute format('alter table public.%I enable row level security', t);
  -- Tempo real: a equipe vê na hora o que o colega alterou (o Supabase aplica as mesmas regras de acesso)
  begin
    execute format('alter publication supabase_realtime add table public.%I', t);
  exception when duplicate_object then null;
  end;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'config', 'corretores', 'clientes', 'processos', 'registros', 'audiencias', 'intimacoes',
    'compromissos', 'tarefas', 'mensagens', 'pedidos_protocolo', 'lancamentos',
    'atividades', 'relatorios_diarios', 'senhas', 'emails_recebidos', 'notificacoes'
  ]
  loop
    perform criar_colecao(t);
  end loop;
  foreach t in array array[
    'config', 'corretores', 'clientes', 'processos', 'registros', 'audiencias', 'intimacoes',
    'compromissos', 'tarefas', 'mensagens', 'pedidos_protocolo', 'lancamentos', 'atividades', 'emails_recebidos'
  ]
  loop
    execute format('drop policy if exists equipe_acessa on public.%I', t);
    execute format('create policy equipe_acessa on public.%I for all to authenticated
      using (escritorio_id = meu_escritorio() and eh_equipe())
      with check (escritorio_id = meu_escritorio() and eh_equipe())', t);
  end loop;
end $$;

-- Relatórios diários: cada pessoa vê e grava só o próprio; o administrador vê os de toda a equipe.
drop policy if exists relatorio_ler on relatorios_diarios;
create policy relatorio_ler on relatorios_diarios for select to authenticated
  using (escritorio_id = meu_escritorio() and (eh_advogado() or (eh_equipe() and dados->>'usuarioId' = auth.uid()::text)));
drop policy if exists relatorio_gravar on relatorios_diarios;
create policy relatorio_gravar on relatorios_diarios for insert to authenticated
  with check (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'usuarioId' = auth.uid()::text);
drop policy if exists relatorio_alterar on relatorios_diarios;
create policy relatorio_alterar on relatorios_diarios for update to authenticated
  using (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'usuarioId' = auth.uid()::text)
  with check (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'usuarioId' = auth.uid()::text);
drop policy if exists relatorio_apagar on relatorios_diarios;
create policy relatorio_apagar on relatorios_diarios for delete to authenticated
  using (escritorio_id = meu_escritorio() and (eh_advogado() or (eh_equipe() and dados->>'usuarioId' = auth.uid()::text)));

-- Diretório de senhas: só o administrador do escritório.
drop policy if exists so_administrador on senhas;
create policy so_administrador on senhas for all to authenticated
  using (escritorio_id = meu_escritorio() and eh_advogado())
  with check (escritorio_id = meu_escritorio() and eh_advogado());

-- Notificações: cada pessoa lê, marca como lida e apaga só as suas; qualquer pessoa da equipe
-- pode criar um aviso para um colega do mesmo escritório.
drop policy if exists notif_ler on notificacoes;
create policy notif_ler on notificacoes for select to authenticated
  using (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'paraId' = auth.uid()::text);
drop policy if exists notif_criar on notificacoes;
create policy notif_criar on notificacoes for insert to authenticated
  with check (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'deId' = auth.uid()::text);
drop policy if exists notif_alterar on notificacoes;
create policy notif_alterar on notificacoes for update to authenticated
  using (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'paraId' = auth.uid()::text)
  with check (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'paraId' = auth.uid()::text);
drop policy if exists notif_apagar on notificacoes;
create policy notif_apagar on notificacoes for delete to authenticated
  using (escritorio_id = meu_escritorio() and eh_equipe() and dados->>'paraId' = auth.uid()::text);

-- Índices úteis
create index if not exists clientes_cpf on clientes (escritorio_id, (dados->>'cpf'));
create index if not exists registros_data on registros (escritorio_id, (dados->>'data'));
create index if not exists atividades_data on atividades (escritorio_id, (dados->>'data'));
create index if not exists relatorios_diarios_data on relatorios_diarios (escritorio_id, (dados->>'data'));
create index if not exists notificacoes_para on notificacoes (escritorio_id, (dados->>'paraId'));
create index if not exists emails_recebidos_cliente on emails_recebidos (escritorio_id, (dados->>'clienteId'));
create index if not exists clientes_email_gerado on clientes ((lower(dados->>'emailGerado')));

-- 4. Recepção de e-mails dos clientes (Cloudflare Email Worker) ---------------------------------
-- Uma chave por escritório. Ninguém lê esta tabela pelo app.
create table if not exists public.email_entrada_chave (
  escritorio_id uuid primary key references escritorios(id) on delete cascade,
  chave text not null unique,
  criada_em timestamptz not null default now()
);
alter table email_entrada_chave enable row level security;

create or replace function public.gerar_chave_email() returns text
language plpgsql security definer set search_path = public as $$
declare k text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
begin
  if not eh_advogado() then raise exception 'Só o administrador gera a chave dos e-mails.'; end if;
  insert into email_entrada_chave (escritorio_id, chave, criada_em) values (meu_escritorio(), k, now())
  on conflict (escritorio_id) do update set chave = excluded.chave, criada_em = now();
  return k;
end $$;
revoke execute on function public.gerar_chave_email() from public, anon;
grant execute on function public.gerar_chave_email() to authenticated;

create or replace function public.receber_email(
  p_chave text, p_para text, p_de text, p_assunto text, p_texto text, p_html text, p_anexos jsonb, p_recebido_em timestamptz
) returns text
language plpgsql security definer set search_path = public as $$
declare
  eid uuid;
  cid text;
  novo text := replace(gen_random_uuid()::text, '-', '');
begin
  select escritorio_id into eid from email_entrada_chave where chave = p_chave;
  if p_chave is null or eid is null then
    raise exception 'Chave inválida' using errcode = '28000';
  end if;
  select id into cid from clientes where escritorio_id = eid and lower(dados->>'emailGerado') = lower(trim(p_para)) limit 1;
  insert into emails_recebidos (escritorio_id, id, dados, atualizado_por) values (eid, novo, jsonb_build_object(
    'id', novo, 'clienteId', cid, 'para', lower(trim(p_para)), 'de', left(coalesce(p_de, ''), 300),
    'assunto', left(coalesce(p_assunto, ''), 500), 'texto', left(coalesce(p_texto, ''), 100000),
    'html', left(coalesce(p_html, ''), 300000), 'anexos', coalesce(p_anexos, '[]'::jsonb),
    'recebidoEm', coalesce(p_recebido_em, now()), 'lido', false
  ), null);
  return novo;
end $$;
revoke execute on function public.receber_email(text, text, text, text, text, text, jsonb, timestamptz) from public;
grant execute on function public.receber_email(text, text, text, text, text, text, jsonb, timestamptz) to anon, authenticated;

-- 5. Auditoria das consultas por CPF (LGPD) ---------------------------------------------
create table if not exists public.logs_cpf (
  id bigserial primary key,
  escritorio_id uuid not null default meu_escritorio() references escritorios(id) on delete cascade,
  em timestamptz not null default now(),
  auth_id uuid default auth.uid(),
  usuario_nome text,
  cpf_mascarado text not null,
  resultado text
);
alter table logs_cpf enable row level security;
drop policy if exists logs_inserir on logs_cpf;
create policy logs_inserir on logs_cpf for insert to authenticated
  with check (auth_id = auth.uid() and escritorio_id = meu_escritorio());
drop policy if exists logs_ler on logs_cpf;
create policy logs_ler on logs_cpf for select to authenticated
  using (escritorio_id = meu_escritorio() and (eh_advogado() or auth_id = auth.uid()));

-- 6. Monitor automático (servidor próprio): última execução de cada rotina por escritório.
create table if not exists public.monitor_estado (
  escritorio_id uuid not null references escritorios(id) on delete cascade,
  id text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (escritorio_id, id)
);
alter table monitor_estado enable row level security;
drop policy if exists monitor_ler on monitor_estado;
create policy monitor_ler on monitor_estado for select to authenticated
  using (escritorio_id = meu_escritorio() and eh_equipe());

-- 7. Console da plataforma ------------------------------------------------------------------
-- Cria o escritório, a configuração inicial e libera o e-mail do administrador (o convite por
-- e-mail é enviado pelo servidor, que tem a chave secreta).
create or replace function public.plataforma_criar_escritorio(
  p_slug text, p_nome text, p_marca jsonb, p_plano text, p_admin_email text, p_admin_nome text, p_oabs jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare eid uuid;
begin
  if not eh_plataforma() then raise exception 'Só a equipe da plataforma cria escritórios.'; end if;
  insert into escritorios (slug, nome, marca, plano, implantacao)
  values (lower(trim(p_slug)), trim(p_nome), coalesce(p_marca, '{}'::jsonb), coalesce(p_plano, 'essencial'),
          jsonb_build_object('inicio', now(), 'cadastro', jsonb_build_object('feitoEm', now(), 'por', auth.uid())))
  returning id into eid;
  insert into config (escritorio_id, id, dados) values (eid, 'escritorio', jsonb_build_object(
    'nomeEscritorio', trim(p_nome), 'plano', coalesce(p_plano, 'essencial'), 'oabs', coalesce(p_oabs, '[]'::jsonb),
    'feriadosExtras', '[]'::jsonb
  ));
  if coalesce(trim(p_admin_email), '') <> '' then
    insert into acessos_autorizados (escritorio_id, email, nome, papel)
    values (eid, lower(trim(p_admin_email)), coalesce(nullif(trim(p_admin_nome), ''), split_part(p_admin_email, '@', 1)), 'advogado');
  end if;
  return eid;
end $$;
revoke execute on function public.plataforma_criar_escritorio(text, text, jsonb, text, text, text, jsonb) from public, anon;
grant execute on function public.plataforma_criar_escritorio(text, text, jsonb, text, text, text, jsonb) to authenticated;

-- Números de cada escritório para a lista da plataforma.
create or replace function public.plataforma_resumo() returns table (
  id uuid, usuarios bigint, processos bigint, clientes bigint, tarefas bigint, ultimo_uso timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_plataforma() then raise exception 'Só a equipe da plataforma.'; end if;
  return query
  select e.id,
    (select count(*) from perfis p where p.escritorio_id = e.id and p.papel in ('advogado', 'equipe')),
    (select count(*) from processos x where x.escritorio_id = e.id),
    (select count(*) from clientes x where x.escritorio_id = e.id),
    (select count(*) from tarefas x where x.escritorio_id = e.id),
    (select max(x.atualizado_em) from processos x where x.escritorio_id = e.id)
  from escritorios e;
end $$;
revoke execute on function public.plataforma_resumo() from public, anon;
grant execute on function public.plataforma_resumo() to authenticated;
