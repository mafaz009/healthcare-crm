require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET', 'WEBHOOK_SECRET'];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required env variable: ${key}`);
    process.exit(1);
  }
});

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5001',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
  isDev: process.env.NODE_ENV !== 'production',
};
