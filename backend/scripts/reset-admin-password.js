require('dotenv').config();
const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@svecw.edu.in';
  const newPassword = process.argv[2] || 'Admin@NewPassword123';

  const hash = await argon2.hash(newPassword);
  await prisma.user.update({
    where: { email: adminEmail },
    data: { passwordHash: hash },
  });

  console.log(`✅ Admin password reset to: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
