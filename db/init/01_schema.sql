-- Runs automatically the first time the postgres container initializes.
-- Enables pgvector and creates the structured + vector schema.

CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────────────────────────
-- Structured domain tables
-- ─────────────────────────────────────────────────────────────

-- A merchant is a restaurant or a grocery store.
CREATE TABLE IF NOT EXISTS merchants (
    id           TEXT PRIMARY KEY,           -- stable id from the source feed
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,              -- 'restaurant' | 'grocery'
    city         TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Products / menu items / grocery SKUs.
CREATE TABLE IF NOT EXISTS products (
    id           TEXT PRIMARY KEY,
    merchant_id  TEXT REFERENCES merchants(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,              -- 'restaurant' | 'grocery' | 'product'
    subcategory  TEXT,                       -- e.g. 'dairy', 'beverages', 'mains'
    brand        TEXT,
    description  TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);

-- Current price per product (latest wins; history could be added later).
CREATE TABLE IF NOT EXISTS prices (
    product_id   TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    amount       NUMERIC(10,2) NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'USD',
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Promotions attached to a product.
CREATE TABLE IF NOT EXISTS promotions (
    id           TEXT PRIMARY KEY,
    product_id   TEXT REFERENCES products(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    discount_pct NUMERIC(5,2),               -- e.g. 20.00 = 20% off
    starts_at    DATE,
    ends_at      DATE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_product ON promotions(product_id);

-- ─────────────────────────────────────────────────────────────
-- Vector store for RAG
-- One row per searchable "chunk". The ETL builds a natural-language
-- content string per product (name, brand, price, promo, merchant) and
-- stores its Voyage embedding here.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id           BIGSERIAL PRIMARY KEY,
    product_id   TEXT UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    content      TEXT NOT NULL,
    metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding    vector(1024),              -- keep in sync with EMBEDDING_DIM
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Approximate-nearest-neighbour index for cosine distance.
CREATE INDEX IF NOT EXISTS idx_documents_embedding
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────
-- ETL bookkeeping
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS etl_runs (
    id           BIGSERIAL PRIMARY KEY,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at  TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'running',  -- running | success | failed
    source_file  TEXT,
    records      INTEGER DEFAULT 0,
    embedded     INTEGER DEFAULT 0,
    error        TEXT
);
