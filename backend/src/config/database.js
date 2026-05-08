const { PrismaClient } = require('@prisma/client');
const env = require('./env');

// Reuse a single PrismaClient instance across the app.
// On Hostinger (Node.js persistent process) this prevents connection pool exhaustion.
const prisma = new PrismaClient({
  log: env.isDev ? ['warn', 'error'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
