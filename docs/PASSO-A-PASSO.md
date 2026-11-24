# Colocar a plataforma Spartacus no ar (uma vez só)

Tudo roda no servidor próprio (VPS), com o banco no Supabase. Depois disso, cada escritório novo é criado pela tela da Plataforma (veja [IMPLANTACAO.md](IMPLANTACAO.md)).

## 1. Banco (Supabase)

1. Crie um projeto no Supabase (região São Paulo). Para ~100 escritórios, o plano Pro dá folga.
2. SQL Editor → cole todo o [supabase/schema.sql](../supabase/schema.sql) → Run. Pode rodar de novo a qualquer momento (não apaga dados).
3. Authentication → Sign In / Providers → Email: deixe o cadastro por e-mail ligado (o "Primeiro acesso" usa isso; só entra no escritório quem foi liberado antes). Em URL Configuration, cadastre `https://*.SEU_DOMINIO` nas Redirect URLs.
4. Crie o seu login (Authentication → Users → Add user) e torne-se administrador da plataforma:

   ```sql
   insert into plataforma_admins (auth_id, email, nome)
   select id, email, 'Equipe Spartacus' from auth.users where email = 'SEU@EMAIL';
   ```

5. Anote em Project Settings → API: a URL, a chave pública (anon/publishable) e a chave secreta (sb_secret_…).

## 2. DNS do domínio da plataforma

No domínio escolhido (ex.: `spartacus.adv.br`), aponte para o IP da VPS:

- `A  @  → IP`
- `A  *  → IP` (todos os subdomínios dos escritórios)

## 3. Servidor (VPS com Docker)

```bash
VPS=root@IP bash infra/spartacus/publicar.sh      # no computador: envia o código
ssh root@IP
cd /opt/spartacus/infra/spartacus
cp .env.example .env                    # DOMINIO_PLATAFORMA, EMAIL_SSL, EVOLUTION_API_KEY
cp spartacus.env.example spartacus.env  # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY…
docker compose up -d --build
```

O Caddy emite o HTTPS sozinho: o do domínio principal na hora, e o de cada subdomínio ou domínio próprio de escritório no primeiro acesso (só para endereços que existem no cadastro).

## 4. Conferir

- `https://SEU_DOMINIO` abre a página do Spartacus; entre com o seu login → aparece a **Plataforma**.
- Crie um escritório de teste e abra `https://teste.SEU_DOMINIO`: a tela de entrada já vem com a marca dele.
- No computador, `npm run test:banco` confere as regras de isolamento do banco a cada mudança no schema.

## Atualizar

Cada nova versão: commit e `VPS=root@IP bash infra/spartacus/publicar.sh`. Mudou o `schema.sql`? Rode de novo no SQL Editor.
