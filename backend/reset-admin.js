const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('Admin@1234', 10);

  await prisma.user.update({
    where: { email: 'admin@mashhealth.in' },
    data: {
      password: hashed
    }
  });

  console.log('Admin password reset');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
