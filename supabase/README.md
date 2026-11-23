# Supabase do Jarvis

Projeto: `oohiwxfqrddeozdkjrwv` (DASHBOARD). Os dados ficam no schema `jarvis`, que **não** é exposto pela API.
O site acessa os dados só por estas funções, que exigem login e conferem se a conta é a dona:

| Função | O que faz |
|---|---|
| `jarvis_has_owner()` | diz se o Jarvis já tem dono (usada na tela inicial) |
| `jarvis_claim()` | a primeira conta que entra vira dona; as outras são recusadas |
| `jarvis_load()` | carrega tudo (áreas, tarefas, agenda, financeiro, hábitos, metas, clientes) |
| `jarvis_exec(ops)` | grava/apaga em lote (apenas nas tabelas do Jarvis) |
| `jarvis_groq(payload)` | chat do Jarvis via Groq; a chave fica no Vault, nunca no site |

O SQL dessas funções está em `jarvis_web_api.sql`.
