import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/nhanh/pull-customers-all
 * Start a background job to pull all customers
 * Returns immediately and continues processing in background
 */
export async function POST(request: NextRequest) {
  try {
    // Start background processing (don't await)
    pullAllCustomersInBackground();

    return NextResponse.json({
      success: true,
      message:
        "Background pull started. Check logs or database for progress. This will continue even after this request completes.",
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
 * Background function to pull all customers
 * This continues running even after the HTTP response is sent
 */
async function pullAllCustomersInBackground() {
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;
  let hasMore = true;
  let batchCount = 0;
  const batchSize = 100;

  // Check existing customers count and get saved progress
  const existingCount = await prisma.nhanhCustomer.count();
  const progress = await prisma.pullProgress.findUnique({
    where: { id: "nhanh_customers" },
  });

  let nextCursor: any = progress?.nextCursor || undefined;
  const resuming = !!progress?.nextCursor;

  console.log(
    `🚀 Background pull ${resuming ? "RESUMING" : "started"}... (${existingCount} customers already in database)`
  );
  if (resuming) {
    console.log(`📍 Resuming from cursor:`, nextCursor);
  }

  try {
    while (hasMore) {
      batchCount++;
      console.log(`📦 Processing batch ${batchCount}...`);

      // Fetch one batch
      const response = await nhanhAPI.getCustomers({
        limit: batchSize,
        next: nextCursor,
      });

      console.log(
        `✅ Batch ${batchCount}: Fetched ${response.customers.length} customers`
      );

      // Bulk upsert customers (optimized)
      let batchCreated = 0;
      let batchUpdated = 0;
      
      // Get existing customer IDs in this batch
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
            lastPulledAt: new Date(),
          })),
          skipDuplicates: true,
        });
        batchCreated = toCreate.length;
      }
      
      // Bulk update existing customers (in batches)
      if (toUpdate.length > 0) {
        const updateBatchSize = 50;
        for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
          const batch = toUpdate.slice(i, i + updateBatchSize);
          await prisma.$transaction(
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
                  lastPulledAt: new Date(),
                },
              })
            )
          );
        }
        batchUpdated = toUpdate.length;
      }

      totalCreated += batchCreated;
      totalUpdated += batchUpdated;
      totalProcessed += response.customers.length;

      console.log(
        `💾 Batch ${batchCount} saved: ${batchCreated} created, ${batchUpdated} updated. Total: ${totalProcessed}`
      );

      nextCursor = response.next;
      hasMore = response.hasMore;

      // Save progress to database
      await prisma.pullProgress.upsert({
        where: { id: "nhanh_customers" },
        create: {
          id: "nhanh_customers",
          nextCursor: nextCursor ? nextCursor : undefined,
          totalPulled: totalProcessed,
          lastPulledAt: new Date(),
          isCompleted: !hasMore,
        },
        update: {
          nextCursor: nextCursor ? nextCursor : undefined,
          totalPulled: totalProcessed,
          lastPulledAt: new Date(),
          isCompleted: !hasMore,
        },
      });

      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    console.log(
      `🎉 Background pull completed! Total: ${totalProcessed} customers (${totalCreated} created, ${totalUpdated} updated)`
    );

    // Mark as completed
    await prisma.pullProgress.update({
      where: { id: "nhanh_customers" },
      data: {
        isCompleted: true,
        nextCursor: undefined,
      },
    });
  } catch (error) {
    console.error("❌ Error in background pull:", error);
    // Save error state
    await prisma.pullProgress.upsert({
      where: { id: "nhanh_customers" },
      create: {
        id: "nhanh_customers",
        nextCursor: nextCursor ? nextCursor : undefined,
        totalPulled: totalProcessed,
        lastPulledAt: new Date(),
        isCompleted: false,
      },
      update: {
        nextCursor: nextCursor ? nextCursor : undefined,
        totalPulled: totalProcessed,
        lastPulledAt: new Date(),
      },
    });
  }
}
