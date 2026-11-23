# Colocar o RA Connect no ar (Supabase + Vercel)

Leva uns 15 minutos. Siga na ordem.

## 1. Criar o banco (Supabase)

> Use um projeto **novo**, separado do gestao-escritorio. No projeto atual, qualquer pessoa logada consegue ler a folha de pagamento.

1. Entre em **supabase.com** → **New project**.
   - Nome: `ra-connect`
   - Região: **South America (São Paulo)**
   - Anote a senha do banco em local seguro.
2. Quando o projeto terminar de criar: **SQL Editor → New query**, cole **todo** o conteúdo de [supabase/schema.sql](../supabase/schema.sql) e clique **Run**. Deve aparecer "Success".
3. **Authentication → Sign In / Providers → Email**: desligue **Allow new users to sign up** (só entra quem vocês cadastrarem).
4. **Authentication → Users → Add user → Create new user**:
   - Crie **primeiro o login do Dr. Rômulo** (e-mail + senha) e marque **Auto Confirm User**.
   - O primeiro login criado vira **administrador** automaticamente.
5. **Project Settings → API**: copie a **Project URL** e a **anon public key**. Vai usar no passo 2.

## 2. Publicar o site (Vercel)

1. Entre em **vercel.com** → **Add New… → Project**.
2. Escolha o repositório **ra-connect** → **Import**. (Se ele não aparecer, clique em *Adjust GitHub App Permissions* e libere o repositório.)
3. Framework: **Vite** (detecta sozinho). Abra **Environment Variables** e cadastre:

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL do passo 1.5 |
   | `VITE_SUPABASE_ANON_KEY` | anon public key do passo 1.5 |

4. Clique **Deploy**. Ao terminar, a Vercel mostra o endereço (algo como `ra-connect.vercel.app`).
5. Volte ao Supabase → **Authentication → URL Configuration** e coloque esse endereço em **Site URL**. (É para onde o link de "Esqueci a senha" leva.)

> O plano gratuito da Vercel (Hobby) não permite uso comercial. Para uso definitivo no escritório, mude para o **Pro**.

## 3. Primeiro acesso

1. Abra o endereço da Vercel e entre com o login do Dr. Rômulo.
2. O sistema começa **vazio**. Se quiser aproveitar o que foi testado no modo local, use **Configurações → Dados → Importar backup**.
3. Cadastre os feriados municipais em **Configurações → Feriados locais** (São Luís, Tomé-Açu, Breves).

## 4. Dar acesso à equipe

1. No Supabase: **Authentication → Users → Add user** (e-mail + senha, marque **Auto Confirm User**).
2. No RA Connect: **Configurações → Equipe e acessos** → troque "Aguardando liberação" por **Equipe** (ou **Advogado**, para quem também administra).
3. A pessoa entra com o e-mail e a senha criados. Pode trocar a senha pelo "Esqueci a senha".

Papéis:
- **Advogado:** tudo, inclusive liberar acessos e consultar qualquer CPF de cliente.
- **Equipe:** tudo do dia a dia; consulta por CPF só dos clientes sob sua responsabilidade.
- **Cliente / Bloqueado / Aguardando:** não entram nos dados do escritório (o portal do cliente fica para uma próxima etapa).

## 5. Integrações pagas (quando contratar)

Em Vercel → **Settings → Environment Variables**, adicione as chaves do [.env.example](../.env.example) (ex.: `JUDIT_API_KEY` e `CPF_CONSULTA_HABILITADA=1`) e clique **Redeploy**.
