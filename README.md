# NexShop — Documentação do Projeto

> Monorepo com **front-end** (React + Vite), **back-end** (Express) e **SDK** do navegador para verificação de risco (login/checkout).

## Visão Geral
O NexShop demonstra um fluxo de **verificação de risco** para autenticação e pagamento. O **web** coleta dados do navegador e envia ao **backend**, que aplica regras configuráveis e retorna uma recomendação: `allow`, `review` ou `deny`. Há suporte a **processamento assíncrono** (com polling) e **callback** opcional.

## Estrutura do Monorepo
```
nexshop/
├─ apps/
│  ├─ nexshop-api/                # API Express
│  │  ├─ src/
│  │  │  ├─ server.ts             # App Express + segurança + rotas
│  │  │  └─ nexid.ts              # Middleware e rotas (createNexID)
│  │  └─ .env                     # Variáveis da API (local)
│  └─ nexshop-web/                # Front React + Vite
│     ├─ src/
│     │  ├─ pages/
│     │  │  ├─ auth/Login.tsx
│     │  │  └─ checkout/Checkout.tsx
│     │  ├─ services/identity/
│     │  │  ├─ client.ts          # wrapper do SDK
│     │  │  └─ config.ts          # endpoints (API key opcional)
│     │  ├─ lib/hash.ts           # util de SHA-256
│     │  ├─ App.tsx               # rotas
│     │  ├─ main.tsx              # bootstrap React
│     │  └─ index.css             # tema (variáveis CSS)
│     ├─ index.html               # HTML inicial (sem "fallback")
│     └─ .env                     # Variáveis do front (local)
└─ packages/
   └─ nexid-sdk/                  # SDK do navegador
      ├─ src/index.ts             # initSDK(), verify(), poll()
      └─ dist/                    # build gerado por tsup
```

## Requisitos
- Node.js 20+
- pnpm 9+
- Navegador moderno (Chromium/Firefox/Safari)

## Como Rodar (desenvolvimento)
```bash
# 1) Instalar dependências
pnpm install

# 2) Build do SDK (workspace)
pnpm --filter @nexshop/nexid-sdk build

# 3) Subir a API (terminal A)
pnpm --filter nexshop-api dev

# 4) Subir o web (terminal B)
pnpm --filter nexshop-web dev

# API: http://localhost:3000
# Web: http://localhost:5173
```
> Dica: se mudar o SDK, rode o build de novo antes do `web dev`.

## Variáveis de Ambiente
Crie estes arquivos **locais** 

**apps/nexshop-api/.env**
```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
API_KEY=dev-123
HTTPS_ONLY=false
RATE_WINDOW_MS=60000
RATE_MAX=120

SENSITIVITY=0.5
REVIEW_MIN_SCORE=50

TRUSTED_IPS=
BLOCKED_IPS=
TRUSTED_EMAIL_HASHES=
BLOCKED_EMAIL_HASHES=
TRUSTED_USER_IDS=
BLOCKED_USER_IDS=

CALLBACK_URL=
CALLBACK_SECRET=
```

**apps/nexshop-web/.env**
```env
VITE_IDENTITY_ENDPOINT=http://localhost:3000/identity/verify
# NÃO definir VITE_IDENTITY_API_KEY no front em produção
```

> Observação: o `IDENTITY_API_KEY` no **front** é **opcional** e não deve ser definido no `.env` do web em produção. O backend aceita chamadas **da mesma origem** sem a chave (ver seção de segurança).

## Endpoints da API
### POST `/identity/verify`
Verifica o risco de uma ação do usuário.

**Headers**
- `content-type: application/json`
- `x-api-key: <opcional>` — **não usar** no front em produção
- `x-async: 1` — alternativo ao `?async=1`

**Query**
- `?async=1` — processamento assíncrono (retorna 202 + `requestId`)

**Body (exemplo)**
```json
{
  "context": "login",
  "userId": "u_123",
  "emailHash": "sha256-hex",
  "snapshot": {
    "userAgent": "...",
    "languages": ["pt-BR","en-US"],
    "timezone": "America/Sao_Paulo",
    "screen": {"w":1920,"h":1080,"dpr":1},
    "platform": "Win32",
    "sessionId": "uuid-...",
    "pageTimeMs": 2500,
    "mouseMoves": 5,
    "tabInactiveMs": 0,
    "lastActivityTs": 1710000000000,
    "sdkVersion": "1.0.0"
  }
}
```

**Resposta (síncrono)**
```json
{ "status":"allow", "score":77, "reasons":["ok"], "requestId":"..." }
```

**Resposta (assíncrono)**
```json
{ "status":"review", "score":0, "reasons":["processing"], "requestId":"..." }
```

### GET `/identity/result/:id`
Retorna o resultado final quando a verificação foi iniciada de forma assíncrona.

**Resposta**
```json
{ "status":"allow", "score":77, "reasons":["ok"], "requestId":"..." }
```

## Comunicação Segura
- **CORS restrito** ao `CORS_ORIGIN` do `.env`.
- **Verificação de origem** (`Origin/Referer`) além do CORS; se a requisição vier do seu site, não precisa `x-api-key`.
- **HTTPS obrigatório** em produção (`HTTPS_ONLY=true` ou `NODE_ENV=production`).
- **Headers de segurança**: HSTS (prod), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- **Rate limit** simples por IP (`RATE_WINDOW_MS`, `RATE_MAX`).
- **Payload limitado** (`express.json({ limit: "25kb" })`).

## Middleware Simples
O backend expõe um módulo plugável que adiciona contexto e rotas.

Uso (já aplicado no `server.ts`):
```ts
import { createNexID } from "./nexid.js";

const nexid = createNexID({
  apiKey: process.env.API_KEY || undefined,
  allowOrigin: process.env.CORS_ORIGIN!,
  sensitivity: 0.5,
  reviewMinScore: 50,
  trustedIps: [], blockedIps: [],
  trustedEmailHashes: [], blockedEmailHashes: [],
  trustedUserIds: [], blockedUserIds: [],
  callbackUrl: undefined, callbackSecret: undefined
});

app.use(nexid.middleware());
app.post("/identity/verify", nexid.verifyRoute());
app.get("/identity/result/:id", nexid.resultRoute());
```

## SDK do Navegador (Front-end)
Uso básico no cliente:
```ts
import { initSDK } from "@nexshop/nexid-sdk";
import { IDENTITY_ENDPOINT } from "../services/identity/config";

const nexid = initSDK({ endpoint: IDENTITY_ENDPOINT });

// Síncrono
const r1 = await nexid.verify({ context: "login", emailHash });
// Assíncrono
const r2 = await nexid.verify({ context: "checkout" }, { async: true });
const final = r2.status === "processing" ? await nexid.poll(r2.requestId) : r2;
```

## Páginas de Exemplo
- **Login**: coleta e valida e-mail, envia `context: "login"` e mostra resultado.
- **Checkout**: envia `context: "checkout"` e mostra resultado.
- Ambas usam o mesmo cliente SDK e mantêm o **tema** via variáveis CSS em `index.css`.

## Scripts Úteis
```bash
# Lint (se configurado)
pnpm --filter nexshop-web lint

# Typecheck
pnpm --filter nexshop-web exec tsc --noEmit
pnpm --filter nexshop-api  exec tsc --noEmit

# Build web
pnpm --filter nexshop-web build

# Build SDK
pnpm --filter @nexshop/nexid-sdk build
```

### Nome: Guilherme heinrih Keiller RM:551298
### Link do video: https://youtu.be/AH-J3qABlyI
