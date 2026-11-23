# Jarvis

Organização pessoal e das empresas: tarefas, kanban, agenda, financeiro, clientes (MRR/TCV), hábitos, metas e um chat que executa comandos.

Site estático (HTML + JS, sem build na Vercel). Dados e login no Supabase.

## Estrutura

- `index.html` — o app (gerado; não edite à mão)
- `vendor/supabase.js` — biblioteca oficial do Supabase (v2.119.2), servida pelo próprio site
- `src/app.html` — versão-fonte do app (a mesma que roda no Claude)
- `src/web.js` — adaptador web: login (Supabase Auth), acesso aos dados por funções seguras, chat via Groq, ditado do navegador
- `build.py` — gera `index.html` a partir de `src/`: `python3 build.py`
- `supabase/` — SQL das funções do banco

## Deploy na Vercel

1. Vercel → **Add New → Project** → importe este repositório.
2. Framework Preset: **Other**. Build Command: vazio. Output Directory: vazio (raiz).
3. **Deploy**.

## Depois do primeiro deploy (Supabase)

Em **Authentication → URL Configuration** do projeto, coloque a URL da Vercel (ex.: `https://jarvis-xxxx.vercel.app`) em **Site URL** e em **Redirect URLs**. Assim os e-mails de confirmação e de "esqueci a senha" voltam para o app.

## Segurança

- A chave publicável do Supabase no código é pública por natureza; os dados só saem pelas funções que exigem login da conta dona.
- A chave do Groq fica no Supabase Vault e nunca vai para o site.
- A primeira conta criada vira a dona do Jarvis; outras contas são recusadas.
