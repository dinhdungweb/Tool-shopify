const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCampaigns() {
  try {
    console.log('🔍 Checking sale campaigns in database...\n');

    // Get all campaigns
    const allCampaigns = await prisma.saleCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log(`📊 Total campaigns: ${allCampaigns.length}\n`);

    if (allCampaigns.length === 0) {
      console.log('❌ No campaigns found in database!');
      console.log('   This means campaigns are not being saved.\n');
      return;
    }

    console.log('Recent campaigns:');
    allCampaigns.forEach((c, i) => {
      console.log(`\n${i + 1}. ${c.name}`);
      console.log(`   ID: ${c.id}`);
      console.log(`   Status: ${c.status}`);
      console.log(`   Schedule Type: ${c.scheduleType}`);
      console.log(`   Target Type: ${c.targetType}`);
      console.log(`   Created: ${c.createdAt.toLocaleString()}`);
      if (c.startDate) {
        console.log(`   Start Date: ${c.startDate.toLocaleString()}`);
      }
      if (c.endDate) {
        console.log(`   End Date: ${c.endDate.toLocaleString()}`);
      }
    });

    // Check by status
    console.log('\n📊 Campaigns by status:');
    const statuses = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'FAILED'];
    
    for (const status of statuses) {
      const count = await prisma.saleCampaign.count({
        where: { status }
      });
      if (count > 0) {
        console.log(`   ${status}: ${count}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCampaigns();
