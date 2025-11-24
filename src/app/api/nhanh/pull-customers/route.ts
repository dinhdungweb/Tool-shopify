import { NextRequest, NextResponse } from "next/server";
import { nhanhAPI } from "@/lib/nhanh-api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for long-running operation

/**
 * POST /api/nhanh/pull-customers
 * Pull customers from Nhanh.vn in batches and save to database
 * For large datasets (>100k), this will process in chunks to avoid timeout
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Starting to pull customers from Nhanh.vn...");
    
    let created = 0;
    let updated = 0;
    let totalProcessed = 0;
    let nextCursor: any = undefined;
    let hasMore = true;
    const batchSize = 100;
    const maxBatches = 50; // Process max 5000 customers per request to avoid timeout
    let batchCount = 0;

    // Process in batches to avoid memory issues and timeout
    while (hasMore && batchCount < maxBatches) {
      batchCount++;
      console.log(`Processing batch ${batchCount}...`);
      
      // Fetch one batch
      const response = await nhanhAPI.getCustomers({
        limit: batchSize,
        next: nextCursor,
      });

      console.log(`Batch ${batchCount}: Fetched ${response.customers.length} customers`);

      // Save batch to database using bulk operations
      const upsertPromises = response.customers.map(async (customer) => {
        const result = await prisma.nhanhCustomer.upsert({
          where: { id: customer.id },
          create: {
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
          },
          update: {
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
        });
        
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          return { created: true };
        } else {
          return { created: false };
        }
      });

      const results = await Promise.all(upsertPromises);
      created += results.filter(r => r.created).length;
      updated += results.filter(r => !r.created).length;
      totalProcessed += response.customers.length;

      nextCursor = response.next;
      hasMore = response.hasMore;

      console.log(`Batch ${batchCount} completed. Total processed: ${totalProcessed}`);
    }

    const message = hasMore 
      ? `Processed ${totalProcessed} customers (more available, run again to continue)`
      : `Pull completed! All ${totalProcessed} customers processed`;

    console.log(message);

    return NextResponse.json({
      success: true,
      data: {
        total: totalProcessed,
        created,
        updated,
        hasMore,
        nextCursor: hasMore ? nextCursor : null,
      },
      message,
    });
  } catch (error: any) {
    console.error("Error pulling customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull customers from Nhanh.vn",
      },
      { status: 500 }
    );
  }
}
