const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProgress() {
  try {
    const progress = await prisma.pullProgress.findMany({
      orderBy: { lastPulledAt: 'desc' }
    });
    
    console.log('\n📊 Pull Progress Status:\n');
    
    if (progress.length === 0) {
      console.log('No pull progress found.');
    } else {
      progress.forEach(p => {
        console.log(`ID: ${p.id}`);
        console.log(`  Status: ${p.isCompleted ? '✅ Completed' : '⏳ In Progress'}`);
        console.log(`  Total Pulled: ${p.totalPulled}`);
        console.log(`  Last Pulled: ${p.lastPulledAt}`);
        console.log(`  Has Cursor: ${p.nextCursor ? 'Yes' : 'No'}`);
        if (p.metadata) {
          console.log(`  Metadata: ${p.metadata}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProgress();
