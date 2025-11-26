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

      // Bulk check existing customers (optimized)
      const customerIds = response.customers.map(c => c.id);
      const existingCustomers = await prisma.nhanhCustomer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, lastPulledAt: true },
      });
      
      const existingMap = new Map(existingCustomers.map(c => [c.id, c.lastPulledAt]));
      
      // Categorize customers
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
          
          if (hoursSinceLastPull < 24) {
            toSkip.push(customer);
          } else {
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
        created += toCreate.length;
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
                  lastPulledAt: now,
                },
              })
            )
          );
        }
        updated += toUpdate.length;
      }
      
      skipped += toSkip.length;
      
      // Track consecutive skipped customers
      if (toCreate.length > 0 || toUpdate.length > 0) {
        consecutiveSkipped = 0; // Reset if we found new/updated customers
      } else {
        consecutiveSkipped += toSkip.length;
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
