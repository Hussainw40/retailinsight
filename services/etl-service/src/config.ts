export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'retail',
    password: process.env.POSTGRES_PASSWORD || 'retail_pw',
    database: process.env.POSTGRES_DB || 'retail',
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: process.env.VOYAGE_MODEL || 'voyage-3',
  },
  embeddingDim: parseInt(process.env.EMBEDDING_DIM || '1024', 10),
  etlCron: process.env.ETL_CRON || '0 2 * * *',
  dataDir: process.env.DATA_DIR || './data',
};
