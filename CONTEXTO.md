# Contexto do projeto

## O que e

Aplicacao de pedidos de pacotes para Instagram e Kwai. O frontend coleta o pedido e o backend cria a cobranca via SyncPay e registra o pedido no Supabase.

## Estrutura

- `frontend/`: React 19, TypeScript, Vite e Tailwind CSS.
- `backend/`: Express em Node.js, integracoes SyncPay e Supabase.
- `backend/routes/orders.js`: criacao e consulta de pedidos.
- `backend/routes/webhooks.js`: recebimento de notificacoes de pagamento.
- `backend/supabase_schema.sql`: tabelas `orders` e `webhook_logs`.

## Rodar localmente

Abra terminais separados e execute os comandos a partir de cada pasta:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

O backend usa a porta `3001`. O Vite usa `8443` por padrao. O endpoint de saude do backend e `/health`.

## Variaveis de ambiente

Backend: copie `backend/.env.example` para `backend/.env` e preencha os valores reais. O backend le:

- `SUPABASE_URL`: URL base do projeto, sem `/rest/v1/`.
- `SUPABASE_SERVICE_ROLE_KEY`: chave privada do servidor; nunca usar no frontend.
- `SYNCPAY_CLIENT_ID` e `SYNCPAY_CLIENT_SECRET`: credenciais privadas do SyncPay.
- `SYNCPAY_BASE_URL`: host da API, `https://api.syncpayments.com.br`.
- `SYNCPAY_WEBHOOK_SECRET`: segredo associado ao webhook.
- `FRONTEND_URL`: origem do frontend, usada pelo CORS.
- `PORT`: opcional; localmente o backend usa `3001` por padrao.

Frontend: configure `VITE_API_URL` para a URL do backend. Localmente: `http://localhost:3001`. Em producao, use a URL publica HTTPS do backend. Essa variavel e incorporada durante o build.

Em producao, configure as variaveis no painel da hospedagem. Nao envie `.env` ao Git.

## API principal

- `GET /health`: confirma que o backend esta respondendo.
- `POST /api/orders`: cria um pedido e solicita pagamento.
- `POST /api/webhooks/syncpay`: recebe notificacoes da SyncPay.
- `GET /api/orders/:id`: consulta um pedido por ID ou ID externo.

As categorias usadas no backend sao `followers_mundial`, `followers_br`, `likes_mundial` e `views_reels`; a restricao da coluna `orders.category` no Supabase deve aceitar esses valores.

## Deploy

A configuracao atual do Vercel no backend aponta as requisicoes para `backend/server.js`. Para um monorepo, configure os projetos com as pastas raiz corretas: `backend` para a API e `frontend` para o site. No backend, `FRONTEND_URL` deve apontar para o site. No frontend, `VITE_API_URL` deve apontar para a API.

## Pendencia importante: webhook

O painel SyncPay foi configurado para o evento de transacao criada/atualizada (PIX e cartao). O codigo atual do backend ainda mapeia eventos antigos (`pix.paid`, `pix.expired`, `credit_card.updated`, etc.) e valida o header como `Authorization: Bearer <segredo>`. Antes de depender das atualizacoes automaticas de pagamento, confirmar o formato de assinatura/eventos enviado pela SyncPay e adequar `backend/routes/webhooks.js`.

## Seguranca

Credenciais privadas foram expostas durante a configuracao. Rotacione as chaves do Supabase e SyncPay antes de producao e atualize-as na hospedagem. Nunca registre valores reais neste documento.
