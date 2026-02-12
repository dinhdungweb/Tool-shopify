import { prisma } from './prisma';
import { shopifyAPI } from './shopify-api';
import { getTierLabel } from './tier-constants';

export class RewardService {
    /**
     * Check and execute scheduled expirations
     */
    async checkExpirations() {
        try {
            const now = new Date();

            // Find due schedules
            const dueSchedules = await prisma.pointExpirationSchedule.findMany({
                where: {
                    status: 'PENDING',
                    expiresAt: { lte: now },
                },
            });

            if (dueSchedules.length === 0) {
                return { success: true, message: 'No due schedules found.', processed: 0, results: [] };
            }

            console.log(`⏰ Found ${dueSchedules.length} expiration schedules to execute...`);

            const results: any[] = [];

            for (const schedule of dueSchedules) {
                console.log(`🔄 Processing expiration schedule: ${schedule.description || schedule.id}...`);

                // Find customers in this tier
                const mappings = await prisma.customerMapping.findMany({
                    where: {
                        tier: schedule.tier,
                        shopifyCustomerId: { not: null },
                        syncStatus: 'SYNCED',
                    },
                    select: {
                        id: true,
                        shopifyCustomerId: true,
                        nhanhCustomerName: true,
                    },
                });

                let successful = 0;
                let failed = 0;

                for (const mapping of mappings) {
                    try {
                        if (!mapping.shopifyCustomerId) continue;

                        // Reset points to 0
                        await shopifyAPI.updateCustomerMetafield(mapping.shopifyCustomerId, {
                            namespace: 'rewards',
                            key: 'points',
                            value: '0',
                            type: 'number_integer',
                        });

                        successful++;
                    } catch (error: any) {
                        failed++;
                        console.error(
                            `  ❌ Failed to reset points for ${mapping.nhanhCustomerName}: ${error.message}`
                        );
                    }

                    // Rate limiting
                    await new Promise((r) => setTimeout(r, 200));
                }

                // Update schedule status
                await prisma.pointExpirationSchedule.update({
                    where: { id: schedule.id },
                    data: {
                        status: 'EXECUTED',
                        executedAt: now,
                        affectedCount: successful,
                    },
                });

                console.log(
                    `✅ Reset points for ${successful} customers in tier ${getTierLabel(schedule.tier)}`
                );

                results.push({
                    scheduleId: schedule.id,
                    tier: schedule.tier,
                    tierLabel: getTierLabel(schedule.tier),
                    successful,
                    failed,
                });
            }

            return {
                success: true,
                message: `Executed ${dueSchedules.length} expiration schedules.`,
                processed: dueSchedules.length,
                results,
            };
        } catch (error: any) {
            console.error('Error processing expirations:', error);
            return { success: false, error: error.message || 'Error executing expirations' };
        }
    }
}

export const rewardService = new RewardService();
