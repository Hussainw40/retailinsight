export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  db: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    user: process.env.POSTGRES_USER || 'retail',
    password: process.env.POSTGRES_PASSWORD || 'retail_pw',
    database: process.env.POSTGRES_DB || 'retail',
  },
};
