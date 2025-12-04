import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/format-duration";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/nhanh/pull-customers-all
 * Start a background job to pull all customers with optional filters
 * Returns immediately and continues processing in background
 * 
 * Smart Incremental Logic:
 * - Same filters as last pull → Incremental update (skip fresh customers)
 * - Different filters → Pull from beginning
 * 
 * Body params:
 * - type: Customer type (1=Retail, 2=Wholesale, 3=Agent)
 * - lastBoughtDateFrom: From date (yyyy-mm-dd)
 * - lastBoughtDateTo: To date (yyyy-mm-dd)
 */
export async function POST(request: NextRequest) {
  try {
    // Get filters from request body
    const body = await request.json().catch(() => ({}));
    const { type, lastBoughtDateFrom, lastBoughtDateTo, forceRestart } = body;
    
    // Generate progressId based on filters
    const filterSignature = (type || lastBoughtDateFrom || lastBoughtDateTo)
      ? JSON.stringify({ type, lastBoughtDateFrom, lastBoughtDateTo })
      : "";
    const progressId = filterSignature
      ? `nhanh_customers_${Buffer.from(filterSignature).toString('base64').substring(0, 20)}`
      : "nhanh_customers";
    
    const progress = await prisma.pullProgress.findUnique({
      where: { id: progressId },
    });
    
    // If forceRestart, delete progress and allow restart
    if (forceRestart) {
      if (progress) {
        await prisma.pullProgress.delete({
          where: { id: progressId },
        });
        console.log(`🔄 Force restart: Deleted progress for ${progressId}`);
      }
    } else {
      // Check if pull is currently running (updated within last 2 minutes)
      if (progress && !progress.isCompleted && progress.lastPulledAt) {
        const minutesSinceLastUpdate = (Date.now() - progress.lastPulledAt.getTime()) / (1000 * 60);
        if (minutesSinceLastUpdate < 2) {
          return NextResponse.json({
            success: false,
            error: "Pull is already running! Please wait for it to complete or reset progress first.",
            isRunning: true,
          }, { status: 409 }); // 409 Conflict
        }
      }
    }
    
    // Create background job for tracking
    const job = await prisma.backgroundJob.create({
      data: {
        type: "PULL_NHANH_CUSTOMERS",
        total: 0,
        status: "RUNNING",
        metadata: {
          filters: { type, lastBoughtDateFrom, lastBoughtDateTo },
        },
      },
    });

    // Start background processing with filters (don't await)
    pullAllCustomersInBackground({ type, lastBoughtDateFrom, lastBoughtDateTo }, job.id);

    let message = `Background pull started! Check Job Tracking for progress. (Job ID: ${job.id})`;
    if (forceRestart) {
      message += " (restarting from beginning)";
    }
    if (type || lastBoughtDateFrom || lastBoughtDateTo) {
      message += "\n\nFilters applied:";
      if (type) message += `\n- Type: ${type}`;
      if (lastBoughtDateFrom) message += `\n- From: ${lastBoughtDateFrom}`;
      if (lastBoughtDateTo) message += `\n- To: ${lastBoughtDateTo}`;
    }

    return NextResponse.json({
      success: true,
      message,
    });
  } catch (error: any) {
    console.error("Error starting background pull:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to start background pull",
      },
      { status: 500 }
    );
  }
}

/**
 * Background function to pull all customers with optional filters
 * Smart Incremental Logic:
 * - Checks if filters match previous pull
 * - If same: Skip fresh customers (< 24h), update stale ones
 * - If different: Pull from beginning
 */
async function pullAllCustomersInBackground(filters?: {
  type?: number;
  lastBoughtDateFrom?: string;
  lastBoughtDateTo?: string;
}, jobId?: string) {
  const filterLog = filters && Object.keys(filters).length > 0 
    ? ` with filters: ${JSON.stringify(filters)}`
    : "";
  console.log(`🚀 Starting background pull${filterLog}...`);
  
  const startTime = Date.now();
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalProcessed = 0;
  let hasMore = true;
  let batchCount = 0;
  const batchSize = 1000; // EXTREME OPTIMIZED: Maximum batch size for fastest pulls
  const updateBatchSize = 300; // SAFE OPTIMIZED: Increased to 300 for better performance
  const now = new Date();

  // Generate progressId based on filters
  const filterSignature = filters && Object.keys(filters).length > 0
    ? JSON.stringify(filters)
    : "";
  const progressId = filterSignature
    ? `nhanh_customers_${Buffer.from(filterSignature).toString('base64').substring(0, 20)}`
    : "nhanh_customers";

  // Check existing progress
  const progress = await prisma.pullProgress.findUnique({
    where: { id: progressId },
  });

  // Check if filters match previous pull
  const previousFilters = progress?.metadata ? JSON.parse(progress.metadata as string) : null;
  const filtersMatch = previousFilters && JSON.stringify(previousFilters) === filterSignature;
  
  // Only use incremental mode if explicitly requested (not on regular pull)
  // For now, always start fresh when pull is completed
  const isIncremental = false; // Disabled for now - always start fresh
  
  let nextCursor: any = undefined;
  
  // Only resume if pull is incomplete
  if (progress && !progress.isCompleted && progress.nextCursor) {
    console.log(`📍 RESUMING: Continuing from last cursor (${progress.totalPulled} customers already pulled)`);
    nextCursor = progress.nextCursor;
  } else if (progress?.isCompleted) {
    console.log(`🔄 Previous pull was completed. Starting fresh pull.`);
  } else if (previousFilters && !filtersMatch) {
    console.log(`🔄 DIFFERENT FILTERS: Starting from beginning`);
    console.log(`   Previous: ${JSON.stringify(previousFilters)}`);
    console.log(`   Current: ${filterSignature || "none"}`);
  } else {
    console.log(`🆕 NEW PULL: Starting from beginning`);
  }

  const existingCount = await prisma.nhanhCustomer.count();
  console.log(`📊 Database has ${existingCount} customers`);

  try {
    while (hasMore) {
      batchCount++;
      console.log(`📦 Processing batch ${batchCount}...`);

      // Fetch one batch with filters
      const response = await nhanhAPI.getCustomers({
        limit: batchSize,
        next: nextCursor,
        ...filters,
      });

      console.log(`✅ Batch ${batchCount}: Fetched ${response.customers.length} customers`);

      if (response.customers.length === 0) {
        console.log(`⏹️ No more customers to process`);
        break;
      }

      // Smart incremental logic
      let batchCreated = 0;
      let batchUpdated = 0;
      let batchSkipped = 0;

      if (isIncremental) {
        // INCREMENTAL MODE: Check lastPulledAt and skip fresh customers
        const customerIds = response.customers.map(c => c.id);
        const existingCustomers = await prisma.nhanhCustomer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, lastPulledAt: true },
        });
        
        const existingMap = new Map(existingCustomers.map(c => [c.id, c.lastPulledAt]));
        
        const toCreate: typeof response.customers = [];
        const toUpdate: typeof response.customers = [];
        const toSkip: typeof response.customers = [];
        
        for (const customer of response.customers) {
          const lastPulled = existingMap.get(customer.id);
          
          if (!lastPulled) {
            // New customer
            toCreate.push(customer);
          } else {
            // Check if needs update
            const hoursSinceLastPull = (now.getTime() - lastPulled.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceLastPull < 20) {
              // Fresh customer, skip
              toSkip.push(customer);
            } else {
              // Stale customer, update
              toUpdate.push(customer);
            }
          }
        }
        
        // Bulk create new customers
        if (toCreate.length > 0) {
          await prisma.nhanhCustomer.createMany({
            data: toCreate.map(customer => ({
              id: customer.id,
              name: customer.name,
              phone: customer.phone || null,
              email: customer.email || null,
              totalSpent: customer.totalSpent,
              address: customer.address || null,
              city: customer.city || null,
              district: customer.district || null,
              ward: customer.ward || null,
              lastPulledAt: now,
            })),
            skipDuplicates: true,
          });
          batchCreated = toCreate.length;
        }
        
        // Bulk update stale customers (ULTRA OPTIMIZED: Max batches + parallel processing)
        if (toUpdate.length > 0) {
          const updatePromises = [];
          
          for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
            const batch = toUpdate.slice(i, i + updateBatchSize);
            updatePromises.push(
              prisma.$transaction(
                batch.map(customer =>
                  prisma.nhanhCustomer.update({
                    where: { id: customer.id },
                    data: {
                      name: customer.name,
                      phone: customer.phone || null,
                      email: customer.email || null,
                      totalSpent: customer.totalSpent,
                      address: customer.address || null,
                      city: customer.city || null,
                      district: customer.district || null,
                      ward: customer.ward || null,
                      lastPulledAt: now,
                    },
                  })
                )
              )
            );
          }
          
          // Execute all update batches in parallel
          await Promise.all(updatePromises);
          batchUpdated = toUpdate.length;
        }
        
        batchSkipped = toSkip.length;
        
        console.log(
          `💾 Batch ${batchCount}: ${batchCreated} new, ${batchUpdated} updated, ${batchSkipped} skipped (fresh)`
        );
      } else {
        // FULL MODE: Upsert all customers
        const existingIds = await prisma.nhanhCustomer.findMany({
          where: {
            id: { in: response.customers.map(c => c.id) }
          },
          select: { id: true }
        });
        
        const existingIdSet = new Set(existingIds.map(c => c.id));
        const toCreate = response.customers.filter(c => !existingIdSet.has(c.id));
        const toUpdate = response.customers.filter(c => existingIdSet.has(c.id));
        
        // Bulk create new customers
        if (toCreate.length > 0) {
          await prisma.nhanhCustomer.createMany({
            data: toCreate.map(customer => ({
              id: customer.id,
              name: customer.name,
              phone: customer.phone || null,
              email: customer.email || null,
              totalSpent: customer.totalSpent,
              address: customer.address || null,
              city: customer.city || null,
              district: customer.district || null,
              ward: customer.ward || null,
              lastPulledAt: now,
            })),
            skipDuplicates: true,
          });
          batchCreated = toCreate.length;
        }
        
        // Bulk update existing customers (ULTRA OPTIMIZED: Max batches + parallel processing)
        if (toUpdate.length > 0) {
          const updatePromises = [];
          
          for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
            const batch = toUpdate.slice(i, i + updateBatchSize);
            updatePromises.push(
              prisma.$transaction(
                batch.map(customer =>
                  prisma.nhanhCustomer.update({
                    where: { id: customer.id },
                    data: {
                      name: customer.name,
                      phone: customer.phone || null,
                      email: customer.email || null,
                      totalSpent: customer.totalSpent,
                      address: customer.address || null,
                      city: customer.city || null,
                      district: customer.district || null,
                      ward: customer.ward || null,
                      lastPulledAt: now,
                    },
                  })
                )
              )
            );
          }
          
          // Execute all update batches in parallel
          await Promise.all(updatePromises);
          batchUpdated = toUpdate.length;
        }
        
        console.log(
          `💾 Batch ${batchCount}: ${batchCreated} created, ${batchUpdated} updated`
        );
      }

      totalCreated += batchCreated;
      totalUpdated += batchUpdated;
      totalSkipped += batchSkipped;
      totalProcessed += response.customers.length;

      nextCursor = response.next;
      hasMore = response.hasMore;

      // Update job progress with estimated speed (OPTIMIZED: Every 10 batches)
      if (jobId && (batchCount % 10 === 0 || !hasMore)) {
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const estimatedSpeed = totalProcessed > 0 && elapsedSeconds > 0
          ? (totalProcessed / elapsedSeconds).toFixed(1)
          : "0";
        
        await prisma.backgroundJob.update({
          where: { id: jobId },
          data: {
            total: totalProcessed,
            processed: totalProcessed,
            successful: totalCreated + totalUpdated,
            failed: 0,
            metadata: {
              filters,
              created: totalCreated,
              updated: totalUpdated,
              skipped: totalSkipped,
              batches: batchCount,
              estimatedSpeed: `${estimatedSpeed} customers/sec`,
            },
          },
        }).catch(() => {});
      }

      // Save progress with filter metadata
      await prisma.pullProgress.upsert({
        where: { id: progressId },
        create: {
          id: progressId,
          nextCursor: nextCursor ? nextCursor : undefined,
          totalPulled: totalProcessed,
          lastPulledAt: now,
          isCompleted: !hasMore,
          metadata: filterSignature || undefined,
        },
        update: {
          nextCursor: nextCursor ? nextCursor : undefined,
          totalPulled: totalProcessed,
          lastPulledAt: now,
          isCompleted: !hasMore,
          metadata: filterSignature || undefined,
        },
      });

      // Small delay to avoid rate limiting (SAFE OPTIMIZED: Minimal safe delay)
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Reduced to 10ms for optimal speed
      }
    }

    const summary = isIncremental
      ? `${totalCreated} new, ${totalUpdated} updated, ${totalSkipped} skipped (fresh)`
      : `${totalCreated} created, ${totalUpdated} updated`;

    console.log(
      `🎉 Background pull completed! Total: ${totalProcessed} customers (${summary})`
    );

    // Mark as completed
    await prisma.pullProgress.update({
      where: { id: progressId },
      data: {
        isCompleted: true,
        nextCursor: undefined,
      },
    });

    // Calculate duration and speed
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const speed = totalProcessed > 0 ? (totalProcessed / durationSeconds).toFixed(1) : "0";
    
    // Format duration nicely
    const formatDuration = (seconds: number) => {
      if (seconds < 60) return `${seconds}s`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };
    const duration = formatDuration(durationSeconds);
    
    console.log(`⏱️  Duration: ${duration}, Speed: ${speed} customers/sec`);

    // Update job as completed
    if (jobId) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          total: totalProcessed,
          processed: totalProcessed,
          successful: totalCreated + totalUpdated,
          completedAt: new Date(),
          metadata: {
            filters,
            created: totalCreated,
            updated: totalUpdated,
            skipped: totalSkipped,
            batches: batchCount,
            duration: duration,
            speed: `${speed} customers/sec`,
          },
        },
      }).catch(() => {});
    }
  } catch (error) {
    console.error("❌ Error in background pull:", error);

    // Update job as failed
    if (jobId) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      }).catch(() => {});
    }
    // Save error state
    await prisma.pullProgress.upsert({
      where: { id: progressId },
      create: {
        id: progressId,
        nextCursor: nextCursor ? nextCursor : undefined,
        totalPulled: totalProcessed,
        lastPulledAt: now,
        isCompleted: false,
        metadata: filterSignature || undefined,
      },
      update: {
        nextCursor: nextCursor ? nextCursor : undefined,
        totalPulled: totalProcessed,
        lastPulledAt: now,
        metadata: filterSignature || undefined,
      },
    });
  }
}
