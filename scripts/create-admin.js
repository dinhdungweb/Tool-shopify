const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
    const hash = await bcrypt.hash('admin123', 10);

    const user = await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: { password: hash },
        create: {
            email: 'admin@example.com',
            password: hash,
            firstName: 'Admin',
            lastName: 'User'
        }
    });

    console.log('✅ User created successfully!');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
}

createAdmin()
    .then(() => prisma.$disconnect())
    .catch((e) => {
        console.error(e);
        prisma.$disconnect();
    });
