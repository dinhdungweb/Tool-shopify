// This file is automatically called by Next.js when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server starting - initializing schedulers...');
    
    // Initialize customer sync scheduler
    try {
      const { cronScheduler } = await import('./lib/cron-scheduler');
      await cronScheduler.initialize();
      console.log('✅ Customer sync scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize customer sync scheduler:', error);
    }

    // Initialize sale campaign scheduler
    try {
      const { saleScheduler } = await import('./lib/sale-scheduler');
      await saleScheduler.initialize();
      console.log('✅ Sale campaign scheduler initialized');
    } catch (error) {
      console.error('❌ Failed to initialize sale campaign scheduler:', error);
    }

    // Recover stuck campaigns
    try {
      const { prisma } = await import('./lib/prisma');
      
      const stuckCampaigns = await prisma.saleCampaign.findMany({
        where: {
          OR: [
            { status: "APPLYING" },
            { status: "REVERTING" },
          ],
        },
      });

      if (stuckCampaigns.length > 0) {
        console.log(`⚠️  Found ${stuckCampaigns.length} stuck campaigns, recovering...`);
        
        for (const campaign of stuckCampaigns) {
          const appliedChanges = await prisma.priceChange.count({
            where: {
              campaignId: campaign.id,
              applied: true,
              reverted: false,
            },
          });

          let newStatus: string;
          
          if (campaign.status === "APPLYING") {
            newStatus = appliedChanges > 0 ? "ACTIVE" : "FAILED";
          } else {
            const totalChanges = await prisma.priceChange.count({
              where: {
                campaignId: campaign.id,
                applied: true,
              },
            });
            newStatus = appliedChanges === 0 ? "COMPLETED" : "ACTIVE";
          }

          await prisma.saleCampaign.update({
            where: { id: campaign.id },
            data: { 
              status: newStatus as any,
              errorMessage: `Recovered from ${campaign.status} state after server restart`,
            },
          });

          console.log(`✅ Recovered campaign "${campaign.name}" from ${campaign.status} to ${newStatus}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to recover stuck campaigns:', error);
    }

    console.log('✅ All schedulers initialized');
  }
}
