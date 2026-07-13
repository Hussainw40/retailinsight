export const config = {
  port: parseInt(process.env.PORT || '3003', 10),
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'retail',
    password: process.env.POSTGRES_PASSWORD || 'retail_pw',
    database: process.env.POSTGRES_DB || 'retail',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.CLAUDE_MODEL || 'claude-opus-4-8',
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
    model: process.env.VOYAGE_MODEL || 'voyage-3',
  },
  topK: parseInt(process.env.TOP_K || '6', 10),
};
