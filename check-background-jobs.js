const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkJobs() {
  try {
    console.log('🔍 Checking background jobs...\n');
    
    const jobs = await prisma.backgroundJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    
    console.log(`📊 Total jobs found: ${jobs.length}\n`);
    
    if (jobs.length === 0) {
      console.log('❌ No jobs found in database!');
      return;
    }
    
    jobs.forEach((job, index) => {
      console.log(`Job ${index + 1}:`);
      console.log(`  ID: ${job.id}`);
      console.log(`  Type: ${job.type}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Total: ${job.total}`);
      console.log(`  Processed: ${job.processed}`);
      console.log(`  Successful: ${job.successful}`);
      console.log(`  Failed: ${job.failed}`);
      console.log(`  Created: ${job.createdAt}`);
      console.log(`  Started: ${job.startedAt}`);
      console.log(`  Completed: ${job.completedAt || 'N/A'}`);
      console.log(`  Error: ${job.error || 'None'}`);
      console.log('');
    });
    
    // Check running jobs
    const runningJobs = await prisma.backgroundJob.count({
      where: { status: 'RUNNING' }
    });
    console.log(`🏃 Running jobs: ${runningJobs}`);
    
    // Check by status
    const statuses = await prisma.backgroundJob.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    
    console.log('\n📈 Jobs by status:');
    statuses.forEach(s => {
      console.log(`  ${s.status}: ${s._count.id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkJobs();
