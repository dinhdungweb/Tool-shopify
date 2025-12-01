const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateAPICall() {
  try {
    console.log('🧪 Simulating API call to create jobs...\n');
    
    // Create 2 jobs like the pull APIs do
    const job1 = await prisma.backgroundJob.create({
      data: {
        type: "PULL_NHANH_PRODUCTS",
        total: 0,
        status: "RUNNING",
      },
    });
    console.log('✅ Created job 1:', job1.id);
    
    const job2 = await prisma.backgroundJob.create({
      data: {
        type: "PULL_SHOPIFY_PRODUCTS",
        total: 0,
        status: "RUNNING",
        metadata: {
          statusFilter: "all",
        },
      },
    });
    console.log('✅ Created job 2:', job2.id);
    
    // Now query like the API does
    console.log('\n🔍 Querying jobs like the API...\n');
    
    const jobs = await prisma.backgroundJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    
    console.log(`📊 Found ${jobs.length} jobs`);
    
    const runningCount = await prisma.backgroundJob.count({
      where: { status: "RUNNING" },
    });
    
    console.log(`🏃 Running jobs: ${runningCount}`);
    
    if (jobs.length > 0) {
      console.log('\n📋 Jobs:');
      jobs.forEach((job, i) => {
        console.log(`  ${i + 1}. ${job.type} - ${job.status} (${job.processed}/${job.total})`);
      });
    }
    
    // Clean up
    await prisma.backgroundJob.deleteMany({
      where: {
        id: { in: [job1.id, job2.id] }
      }
    });
    console.log('\n🧹 Cleaned up test jobs');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simulateAPICall();
