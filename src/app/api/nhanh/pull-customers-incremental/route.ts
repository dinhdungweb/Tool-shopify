import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/nhanh/pull-customers-incremental
 * Pull customers and stop early when finding many recently-pulled customers
 * This is faster than full pull for daily updates
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Starting incremental pull...");

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let totalProcessed = 0;
    let consecutiveSkipped = 0;
    let nextCursor: any = undefined;
    let hasMore = true;
    const batchSize = 100;
    const now = new Date();
    const maxConsecutiveSkipped = 5000;

    while (hasMore && consecutiveSkipped < maxConsecutiveSkipped) {
      const response = await nhanhAPI.getCustomers({
        limit: batchSize,
        next: nextCursor,
      });

      console.log(`📦 Fetched ${response.customers.length} customers`);

      // Process batch in chunks to avoid connection pool issues
      const chunkSize = 10;
      for (let i = 0; i < response.customers.length; i += chunkSize) {
        const chunk = response.customers.slice(i, i + chunkSize);

        const chunkPromises = chunk.map(async (customer) => {
          // Check if customer exists and when it was last pulled
          const existing = await prisma.nhanhCustomer.findUnique({
            where: { id: customer.id },
            select: { lastPulledAt: true },
          });

          if (existing) {
            // Customer exists - check if it needs update
            const hoursSinceLastPull =
              (now.getTime() - existing.lastPulledAt.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastPull < 24) {
              // Customer was pulled recently, skip
              return { action: "skipped" };
            }

            // Update existing customer (not pulled in 24h)
            await prisma.nhanhCustomer.update({
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
            });
            return { action: "updated" };
          } else {
            // New customer
            await prisma.nhanhCustomer.create({
              data: {
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
              },
            });
            return { action: "created" };
          }
        });

        const chunkResults = await Promise.all(chunkPromises);
        const chunkCreated = chunkResults.filter((r) => r.action === "created").length;
        const chunkUpdated = chunkResults.filter((r) => r.action === "updated").length;
        const chunkSkipped = chunkResults.filter((r) => r.action === "skipped").length;

        created += chunkCreated;
        updated += chunkUpdated;
        skipped += chunkSkipped;

        // Track consecutive skipped customers
        if (chunkCreated > 0 || chunkUpdated > 0) {
          consecutiveSkipped = 0; // Reset if we found new/updated customers
        } else {
          consecutiveSkipped += chunkSkipped;
        }
      }

      totalProcessed += response.customers.length;
      nextCursor = response.next;
      hasMore = response.hasMore;

      console.log(
        `✅ Processed ${totalProcessed} customers (${created} new, ${updated} updated, ${skipped} skipped, ${consecutiveSkipped} consecutive skipped)`
      );

      // Stop early if we've seen too many consecutive fresh customers
      if (consecutiveSkipped >= maxConsecutiveSkipped) {
        console.log(
          `⏹️ Stopping early: Found ${consecutiveSkipped} consecutive fresh customers (likely no more new/updated customers)`
        );
        break;
      }

      // Small delay to avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const stoppedEarly = consecutiveSkipped >= maxConsecutiveSkipped;
    const message = stoppedEarly
      ? `Incremental pull completed (stopped early after ${consecutiveSkipped} fresh customers)`
      : `Incremental pull completed (checked all customers)`;

    console.log(
      `🎉 ${message}: ${totalProcessed} processed (${created} new, ${updated} updated, ${skipped} skipped)`
    );

    return NextResponse.json({
      success: true,
      data: {
        total: totalProcessed,
        created,
        updated,
        skipped,
        stoppedEarly,
      },
      message: `${created} new, ${updated} updated, ${skipped} skipped${stoppedEarly ? " (stopped early)" : ""}`,
    });
  } catch (error: any) {
    console.error("Error in incremental pull:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull customers incrementally",
      },
      { status: 500 }
    );
  }
}
