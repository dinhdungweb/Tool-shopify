import { prisma } from './prisma';
import { shopifyAPI } from './shopify-api';
import { getTierLabel } from './tier-constants';

const CONCURRENCY = 3;

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
                            description: schedule.description || `Reset điểm hạng ${getTierLabel(schedule.tier)}`,
                        },
                    },
                });

                let successful = 0;
                let failed = 0;
                let processed = 0;
                const startTime = Date.now();

                // Process in batches of CONCURRENCY (5 parallel)
                for (let i = 0; i < mappings.length; i += CONCURRENCY) {
                    const batch = mappings.slice(i, i + CONCURRENCY);

                    const results = await Promise.allSettled(
                        batch.map(async (mapping) => {
                            if (!mapping.shopifyCustomerId) return { skipped: true };

                            await shopifyAPI.updateCustomerMetafield(mapping.shopifyCustomerId, {
                                namespace: 'rewards',
                                key: 'points',
                                value: '0',
                                type: 'number_integer',
                            });

                            return { name: mapping.nhanhCustomerName };
                        })
                    );

                    for (const result of results) {
                        processed++;
                        if (result.status === 'fulfilled' && !(result.value as any)?.skipped) {
                            successful++;
                        } else if (result.status === 'rejected') {
                            failed++;
                            console.error(`  ❌ ${result.reason?.message || 'Unknown error'}`);
                        }
                    }

                    console.log(`  ✅ [${processed}/${mappings.length}] Batch done - Success: ${successful}, Failed: ${failed}`);

                    // Update job progress
                    await prisma.backgroundJob.update({
                        where: { id: job.id },
                        data: {
                            processed,
                            successful,
                            failed,
                            metadata: {
                                tier: schedule.tier,
                                tierLabel: getTierLabel(schedule.tier),
                                successful,
                                failed,
                                progress: `${processed}/${mappings.length}`,
                            },
                        },
                    }).catch(() => { });

                    // Rate limiting between batches
                    if (i + CONCURRENCY < mappings.length) {
                        await new Promise((r) => setTimeout(r, 100));
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
                        status: failed === mappings.length ? 'FAILED' : 'COMPLETED',
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
