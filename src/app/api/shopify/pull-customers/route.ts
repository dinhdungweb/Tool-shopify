import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes - but will continue in background

/**
 * POST /api/shopify/pull-customers-all
 * Pull ALL Shopify customers in background with auto-resume
 * Perfect for large datasets (100k+ customers)
 */
export async function POST(request: NextRequest) {
  // Start background process immediately and return
  pullAllCustomersBackground();
  
  return NextResponse.json({
    success: true,
    message: "Background pull started! Check server logs for progress. The process will auto-resume if interrupted.",
  });
}

async function pullAllCustomersBackground() {
  console.log("🚀 Starting background pull of ALL Shopify customers...");
  
  let created = 0;
  let updated = 0;
  let failed = 0;
  let totalFetched = 0;
  let pageCount = 0;
  let cursor: string | null = null;
  
  try {
    // Check for existing progress
    const progress = await prisma.pullProgress.findUnique({
      where: { id: "shopify_customers" },
    });

    let hasNextPage = true;
    cursor = progress?.nextCursor as string | null || null;
    const resuming = !!cursor;

    if (resuming) {
      console.log(`🔄 Resuming from previous pull (${progress?.totalPulled || 0} customers already pulled)`);
      totalFetched = progress?.totalPulled || 0;
    }

    // Pull all customers using pagination
    while (hasNextPage) {
      pageCount++;
      const pageStartTime = Date.now();
      
      try {
        console.log(`📦 Fetching page ${pageCount}...`);
        
        const result = await shopifyAPI.getAllCustomers(250, cursor || undefined);
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

        // Check if there are more pages
        hasNextPage = pageInfo.hasNextPage;
        cursor = pageInfo.endCursor;

        // Save progress after each page
        await prisma.pullProgress.upsert({
          where: { id: "shopify_customers" },
          create: {
            id: "shopify_customers",
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
          where: { id: "shopify_customers" },
          create: {
            id: "shopify_customers",
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

    console.log(`\n✅ Pull completed successfully!`);
    console.log(`📊 Final stats:`);
    console.log(`   - Total fetched: ${totalFetched}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Pages processed: ${pageCount}`);

    // Mark as completed
    await prisma.pullProgress.update({
      where: { id: "shopify_customers" },
      data: {
        isCompleted: true,
        nextCursor: undefined,
      },
    });

  } catch (error: any) {
    console.error("❌ Fatal error in background pull:", error);
    
    // Save error state
    try {
      await prisma.pullProgress.upsert({
        where: { id: "shopify_customers" },
        create: {
          id: "shopify_customers",
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
