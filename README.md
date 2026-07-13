# RetailInsight — ETL · Microservices · RAG · AI

A portfolio-grade platform that ingests massive daily JSON feeds (restaurants,
groceries, products, prices, promotions), stores them in Postgres, serves them
to a dashboard, and lets you ask questions in natural language via an AI search
bar powered by **Retrieval-Augmented Generation (RAG)** with **Claude**.

Everything runs as independent microservices, wired together with Docker Compose.

---

## Architecture

```
                          ┌───────────────────────────────┐
      daily JSON feeds ──▶ │  etl-service (NestJS)         │
   (restaurants, groceries,│  • cron ingest                │
    products, prices,      │  • transform + load           │
    promotions)            │  • generate embeddings ──────┐│
                          └───────────────────────────────┘│
                                        │                   │
                                        ▼                   ▼
                          ┌───────────────────────────────────────┐
                          │  Postgres 16 + pgvector                │
                          │  structured tables + `documents`(vec)  │
                          └───────────────────────────────────────┘
                            ▲                         ▲
                            │                         │
              ┌─────────────┘                         └──────────────┐
   ┌────────────────────────┐                   ┌────────────────────────────┐
   │ api-service (NestJS)    │                   │ ai-search-service (NestJS)  │
   │ • REST reads for the UI │                   │ • embed query (Voyage)      │
   └────────────────────────┘                   │ • vector search (pgvector)  │
                    ▲                            │ • answer with Claude (RAG)  │
                    │                            └────────────────────────────┘
                    │                                        ▲
                    └──────────────┬─────────────────────────┘
                                   │
                        ┌────────────────────────┐
                        │ dashboard (React/Vite)  │
                        │ • data explorer page    │
                        │ • AI search page        │
                        └────────────────────────┘
```

### Services

| Service             | Stack            | Port  | Responsibility                                    |
| ------------------- | ---------------- | ----- | ------------------------------------------------- |
| `postgres`          | Postgres 16 + pgvector | 5432 | Structured data + vector embeddings          |
| `etl-service`       | NestJS / Node    | 3001  | Daily ingest, transform, load, embed              |
| `api-service`       | NestJS / Node    | 3002  | Read APIs consumed by the dashboard               |
| `ai-search-service` | NestJS / Node    | 3003  | RAG: embed → retrieve → answer with Claude         |
| `dashboard`         | React + Vite     | 8080  | Data explorer + AI search UI                      |

### Why Voyage AI for embeddings?

Anthropic does not ship a first-party embeddings API. Its recommended
embeddings partner is **Voyage AI**. So the flow is:

- **Voyage** turns text into vectors (both at ingest time and at query time).
- **pgvector** stores and searches those vectors.
- **Claude** reads the top matches and writes the final answer.

---

## Quick start

1. Copy the env file and add your keys:

   ```bash
   cp .env.example .env
   # edit .env → set ANTHROPIC_API_KEY and VOYAGE_API_KEY
   ```

2. Bring the stack up:

   ```bash
   docker compose up --build
   ```

3. Open the dashboard at **http://localhost:8080**.

4. Trigger an ingest run manually (the ETL also runs on a daily cron):

   ```bash
   curl -X POST http://localhost:3001/etl/run
   ```

   This loads the sample feed in `services/etl-service/data/` and generates
   embeddings. Then browse the **Data** page and try the **AI Search** page.

### Handy endpoints

```bash
# ETL
curl -X POST http://localhost:3001/etl/run          # run ingest now
curl http://localhost:3001/etl/status               # last run summary

# API (dashboard data)
curl http://localhost:3002/products?category=grocery
curl http://localhost:3002/promotions
curl http://localhost:3002/stats

# AI search (RAG)
curl -X POST http://localhost:3003/search \
  -H 'content-type: application/json' \
  -d '{"query":"cheapest dairy products on promotion this week"}'
```

---

## Repository layout

```
.
├── docker-compose.yml
├── .env.example
├── db/
│   └── init/01_schema.sql          # tables + pgvector, run on first boot
├── services/
│   ├── etl-service/                # ingest + transform + load + embed
│   ├── api-service/                # read APIs for the dashboard
│   └── ai-search-service/          # RAG endpoint
└── dashboard/                      # React + Vite UI
```

Each service has its own `package.json`, `Dockerfile`, and README-worthy
structure so it can be developed and deployed independently — the microservices
point of the project.

---

## Local development (without Docker)

Each service is a normal Node app:

```bash
cd services/etl-service && npm install && npm run start:dev
```

Set the same env vars from `.env` in your shell. You'll need a Postgres with
the `vector` extension available (or just run the `postgres` container alone:
`docker compose up postgres`).

---

## Tech highlights (for the résumé)

- **ETL**: scheduled ingestion of large JSON, idempotent upserts, batching.
- **Microservices**: 4 independently deployable services + DB, one compose file.
- **RAG**: Voyage embeddings + pgvector similarity search + Claude generation.
- **AI**: `claude-opus-4-8` with grounded, citation-style answers.
- **Infra**: containerized, health-checked, env-driven configuration.
