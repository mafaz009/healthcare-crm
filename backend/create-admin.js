const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@123', 10);

  const user = await prisma.user.create({
    data: {
      name: 'MashHealth Admin',
      email: 'admin@mashhealth.in',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });

  console.log('Admin created:', user.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
