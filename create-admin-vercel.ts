import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    // Check if user exists
    const existing = await prisma.user.findUnique({
      where: { email: 'admin@test.com' }
    });

    if (existing) {
      console.log('✅ Admin user already exists:', existing.email);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const user = await prisma.user.create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email:', user.email);
    console.log('   Password: admin123');
    console.log('   ID:', user.id);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
