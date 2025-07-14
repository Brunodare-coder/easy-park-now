const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const saltRounds = 12;

  // Sample users
  const users = [
    {
      email: 'driver1@example.com',
      password: await bcrypt.hash('DriverPass123!', saltRounds),
      firstName: 'John',
      lastName: 'Driver',
      role: 'DRIVER',
      isEmailVerified: true,
    },
    {
      email: 'host1@example.com',
      password: await bcrypt.hash('HostPass123!', saltRounds),
      firstName: 'Jane',
      lastName: 'Host',
      role: 'HOST',
      isEmailVerified: true,
    },
    {
      email: 'admin@example.com',
      password: await bcrypt.hash('AdminPass123!', saltRounds),
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN',
      isEmailVerified: true,
    }
  ];

  for (const userData of users) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (!existingUser) {
      await prisma.user.create({
        data: userData
      });
      console.log(`Created user: ${userData.email}`);
    } else {
      console.log(`User already exists: ${userData.email}`);
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
