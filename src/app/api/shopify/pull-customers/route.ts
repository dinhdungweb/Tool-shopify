import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes - but will continue in background

/**
 * POST /api/shopify/pull-customers
 * Pull Shopify customers in background with optional filters
 * 
 * Body params:
 * - query: Shopify search query (e.g. "state:ENABLED" for customers with accounts)
 * 
 * Examples:
 * - All customers: {}
 * - Only customers with accounts: { query: "state:ENABLED" }
 * - Customers with email: { query: "email:*@gmail.com" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { query, forceRestart } = body;
    
    const progressId = query ? `shopify_customers_${Buffer.from(query).toString('base64').substring(0, 20)}` : "shopify_customers";
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
        type: "PULL_SHOPIFY_CUSTOMERS",
        total: 0,
        status: "RUNNING",
        metadata: {
          query: query || null,
        },
      },
    });

    // Start background process immediately and return
    pullAllCustomersBackground(query, job.id);
    
    const filterMessage = query ? ` with filter: "${query}"` : "";
    const restartMessage = forceRestart ? " (restarting from beginning)" : "";
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: `Background pull started${filterMessage}${restartMessage}! Check Job Tracking for progress.`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}

async function pullAllCustomersBackground(query?: string, jobId?: string) {
  const filterLog = query ? ` with filter: "${query}"` : "";
  console.log(`🚀 Starting background pull of Shopify customers${filterLog}...`);
  
  let created = 0;
  let updated = 0;
  let failed = 0;
  let totalFetched = 0;
  let pageCount = 0;
  let cursor: string | null = null;
  const startTime = Date.now();
  
  try {
    // Check for existing progress
    const progressId = query ? `shopify_customers_${Buffer.from(query).toString('base64').substring(0, 20)}` : "shopify_customers";
    const progress = await prisma.pullProgress.findUnique({
      where: { id: progressId },
    });

    let hasNextPage = true;
    
    // Only resume if pull is incomplete
    // If completed, start fresh
    const shouldResume = progress && !progress.isCompleted && progress.nextCursor;
    cursor = shouldResume ? (progress.nextCursor as string) : null;
    const resuming = !!cursor;

    if (resuming) {
      console.log(`🔄 Resuming from previous pull (${progress?.totalPulled || 0} customers already pulled)`);
      totalFetched = progress?.totalPulled || 0;
    } else if (progress?.isCompleted) {
      console.log(`🔄 Previous pull was completed. Starting fresh pull.`);
    }

    // Pull all customers using pagination
    while (hasNextPage) {
      pageCount++;
      const pageStartTime = Date.now();
      
      try {
        console.log(`📦 Fetching page ${pageCount}...`);
        
        const result = await shopifyAPI.getAllCustomers(250, cursor || undefined, query);
        const { customers: shopifyCustomers, pageInfo } = result;
        
        if (shopifyCustomers.length === 0) {
          break;
        }

        const fetchTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ✅ Fetched ${shopifyCustomers.length} customers in ${fetchTime}s`);

        // Bulk upsert customers
        const dbStartTime = Date.now();
        
        // Get existing customer IDs in this batch
        const existingIds = await prisma.shopifyCustomer.findMany({
          where: {
            id: { in: shopifyCustomers.map(c => c.id) }
          },
          select: { id: true }
        });
        
        const existingIdSet = new Set(existingIds.map(c => c.id));
        const toCreate = shopifyCustomers.filter(c => !existingIdSet.has(c.id));
        const toUpdate = shopifyCustomers.filter(c => existingIdSet.has(c.id));
        
        // Bulk create new customers
        if (toCreate.length > 0) {
          await prisma.shopifyCustomer.createMany({
            data: toCreate.map(customer => ({
              id: customer.id,
              email: customer.email || null,
              firstName: customer.firstName || null,
              lastName: customer.lastName || null,
              phone: customer.phone || null,
              defaultAddressPhone: customer.defaultAddressPhone || null,
              note: customer.note || null,
              totalSpent: parseFloat(customer.totalSpent) || 0,
              ordersCount: parseInt(String(customer.ordersCount)) || 0,
              lastPulledAt: new Date(),
            })),
            skipDuplicates: true,
          });
          created += toCreate.length;
        }
        
        // Bulk update existing customers
        if (toUpdate.length > 0) {
          const updateBatchSize = 100;
          for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
            const batch = toUpdate.slice(i, i + updateBatchSize);
            await prisma.$transaction(
              batch.map(customer =>
                prisma.shopifyCustomer.update({
                  where: { id: customer.id },
                  data: {
                    email: customer.email || null,
                    firstName: customer.firstName || null,
                    lastName: customer.lastName || null,
                    phone: customer.phone || null,
                    defaultAddressPhone: customer.defaultAddressPhone || null,
                    note: customer.note || null,
                    totalSpent: parseFloat(customer.totalSpent) || 0,
                    ordersCount: parseInt(String(customer.ordersCount)) || 0,
                    lastPulledAt: new Date(),
                  },
                })
              )
            );
          }
          updated += toUpdate.length;
        }

        const dbTime = ((Date.now() - dbStartTime) / 1000).toFixed(2);
        totalFetched += shopifyCustomers.length;
        
        console.log(`  💾 Saved to DB in ${dbTime}s (Created: ${toCreate.length}, Updated: ${toUpdate.length})`);
        console.log(`  📊 Progress: ${totalFetched} total, Page ${pageCount} completed`);

        // Update job progress
        if (jobId) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = totalFetched > 0 ? (totalFetched / elapsed).toFixed(1) : "0";
          await prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
              total: totalFetched,
              processed: totalFetched,
              successful: created + updated,
              failed,
              metadata: {
                query: query || null,
                speed: `${speed} customers/sec`,
                pages: pageCount,
              },
            },
          }).catch(() => {});
        }

        // Check if there are more pages
        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;

        // Save progress after each page
        await prisma.pullProgress.upsert({
          where: { id: progressId },
          create: {
            id: progressId,
            nextCursor: cursor ? cursor : undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: !hasNextPage,
          },
          update: {
            nextCursor: cursor ? cursor : undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: !hasNextPage,
          },
        });

        const pageTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ⏱️  Total page time: ${pageTime}s\n`);

        // Rate limiting: Add delay between pages to avoid hitting Shopify API limits
        // Shopify allows 2 requests/second for REST API, but we're using GraphQL which is more generous
        // Still, add small delay to be safe
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }

      } catch (pageError: any) {
        console.error(`❌ Error on page ${pageCount}:`, pageError.message);
        failed += 250; // Assume full page failed
        
        // Save progress even on error
        await prisma.pullProgress.upsert({
          where: { id: progressId },
          create: {
            id: progressId,
            nextCursor: cursor ? cursor : undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: false,
          },
          update: {
            nextCursor: cursor ? cursor : undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
          },
        });
        
        // Continue to next page
        continue;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const speed = totalFetched > 0 ? (totalFetched / parseFloat(duration)).toFixed(1) : "0";

    console.log(`\n✅ Pull completed successfully!`);
    console.log(`📊 Final stats:`);
    console.log(`   - Total fetched: ${totalFetched}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Pages processed: ${pageCount}`);
    console.log(`   - Duration: ${duration}s (${speed} customers/sec)`);

    // Mark as completed
    await prisma.pullProgress.update({
      where: { id: progressId },
      data: {
        isCompleted: true,
        nextCursor: undefined,
      },
    });

    // Update job as completed
    if (jobId) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          total: totalFetched,
          processed: totalFetched,
          successful: created + updated,
          failed,
          completedAt: new Date(),
          metadata: {
            query: query || null,
            duration: `${duration}s`,
            speed: `${speed} customers/sec`,
            pages: pageCount,
            created,
            updated,
          },
        },
      }).catch(() => {});
    }

  } catch (error: any) {
    console.error("❌ Fatal error in background pull:", error);

    // Update job as failed
    if (jobId) {
      await prisma.backgroundJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          error: error.message,
          completedAt: new Date(),
        },
      }).catch(() => {});
    }
    
    // Save error state
    try {
      const progressId = query ? `shopify_customers_${Buffer.from(query).toString('base64').substring(0, 20)}` : "shopify_customers";
      await prisma.pullProgress.upsert({
        where: { id: progressId },
        create: {
          id: progressId,
          nextCursor: cursor || undefined,
          totalPulled: totalFetched,
          lastPulledAt: new Date(),
          isCompleted: false,
        },
        update: {
          nextCursor: cursor || undefined,
          totalPulled: totalFetched,
          lastPulledAt: new Date(),
        },
      });
    } catch (saveError) {
      console.error("Failed to save error state:", saveError);
    }
  }
}
