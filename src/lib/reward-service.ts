import { prisma } from './prisma';
import { shopifyAPI } from './shopify-api';
import { getTierLabel } from './tier-constants';

export class RewardService {
    /**
     * Check and execute scheduled expirations
     * Chế độ an toàn nhất (Sequential)
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

            const allResults: any[] = [];

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

                // Create background job for tracking
                const job = await prisma.backgroundJob.create({
                    data: {
                        type: 'RESET_REWARD_POINTS',
                        total: mappings.length,
                        status: 'RUNNING',
                        metadata: {
                            tier: schedule.tier,
                            tierLabel: getTierLabel(schedule.tier),
                            scheduleId: schedule.id,
                            description: schedule.description || `Reset điểm hạng ${getTierLabel(schedule.tier)} (Safe Session)`,
                        },
                    },
                });

                let successful = 0;
                let failed = 0;
                const startTime = Date.now();

                // Process sequentially with 500ms delay for maximum safety
                for (let i = 0; i < mappings.length; i++) {
                    const mapping = mappings[i];
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
                        console.log(`  ✅ [${i + 1}/${mappings.length}] Reset điểm ${mapping.nhanhCustomerName}`);
                    } catch (error: any) {
                        failed++;
                        console.error(
                            `  ❌ [${i + 1}/${mappings.length}] ${mapping.nhanhCustomerName}: ${error.message}`
                        );
                    }

                    // Update job progress every 10 customers
                    if ((i + 1) % 10 === 0 || i === mappings.length - 1) {
                        await prisma.backgroundJob.update({
                            where: { id: job.id },
                            data: {
                                processed: i + 1,
                                successful,
                                failed,
                                metadata: {
                                    tier: schedule.tier,
                                    tierLabel: getTierLabel(schedule.tier),
                                    successful,
                                    failed,
                                    progress: `${i + 1}/${mappings.length}`,
                                },
                            },
                        }).catch(() => { });
                    }

                    // Delay 500ms
                    if (i < mappings.length - 1) {
                        await new Promise((r) => setTimeout(r, 500));
                    }
                }

                const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                const duration = durationSeconds < 60
                    ? `${durationSeconds}s`
                    : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

                // Update job as completed
                await prisma.backgroundJob.update({
                    where: { id: job.id },
                    data: {
                        status: failed >= mappings.length && mappings.length > 0 ? 'FAILED' : 'COMPLETED',
                        processed: mappings.length,
                        successful,
                        failed,
                        completedAt: new Date(),
                        metadata: {
                            tier: schedule.tier,
                            tierLabel: getTierLabel(schedule.tier),
                            successful,
                            failed,
                            duration,
                        },
                    },
                }).catch(() => { });

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
                    `✅ Reset points for ${successful} customers in tier ${getTierLabel(schedule.tier)} (${duration})`
                );

                allResults.push({
                    scheduleId: schedule.id,
                    tier: schedule.tier,
                    tierLabel: getTierLabel(schedule.tier),
                    successful,
                    failed,
                    duration,
                    jobId: job.id,
                });
            }

            return {
                success: true,
                message: `Executed ${dueSchedules.length} expiration schedules.`,
                processed: dueSchedules.length,
                results: allResults,
            };
        } catch (error: any) {
            console.error('Error processing expirations:', error);
            return { success: false, error: error.message || 'Error executing expirations' };
        }
    }
}

export const rewardService = new RewardService();
