import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes timeout

/**
 * POST /api/shopify/pull-customers
 * Pull all Shopify customers and store in local database
 */
export async function POST(request: NextRequest) {
  try {
    console.log("Starting to pull ALL Shopify customers with pagination...");

    let created = 0;
    let updated = 0;
    let failed = 0;
    let totalFetched = 0;
    let hasNextPage = true;
    let cursor: string | null = null;
    let pageCount = 0;

    // Pull all customers using pagination
    while (hasNextPage) {
      pageCount++;
      console.log(`Fetching page ${pageCount}...`);
      
      const result = await shopifyAPI.getAllCustomers(250, cursor || undefined);
      const { customers: shopifyCustomers, pageInfo } = result;
      
      if (shopifyCustomers.length === 0) {
        break;
      }

      totalFetched += shopifyCustomers.length;
      console.log(`Fetched ${shopifyCustomers.length} customers in page ${pageCount} (Total so far: ${totalFetched})`);

      // Process customers in this batch
      for (const customer of shopifyCustomers) {
        try {
          // Upsert customer (create or update)
          const result = await prisma.shopifyCustomer.upsert({
            where: { id: customer.id },
            create: {
              id: customer.id,
              email: customer.email || null,
              firstName: customer.firstName || null,
              lastName: customer.lastName || null,
              phone: customer.phone || null,
              totalSpent: parseFloat(customer.totalSpent) || 0,
              ordersCount: parseInt(String(customer.ordersCount)) || 0,
              lastPulledAt: new Date(),
            },
            update: {
              email: customer.email || null,
              firstName: customer.firstName || null,
              lastName: customer.lastName || null,
              phone: customer.phone || null,
              totalSpent: parseFloat(customer.totalSpent) || 0,
              ordersCount: parseInt(String(customer.ordersCount)) || 0,
              lastPulledAt: new Date(),
            },
            select: { createdAt: true, updatedAt: true },
          });

          // Check if it was created or updated
          if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created++;
          } else {
            updated++;
          }
        } catch (error: any) {
          console.error(`Error upserting customer ${customer.id}:`, error);
          failed++;
        }
      }

      // Check if there are more pages
      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;

      console.log(`Page ${pageCount} completed. Has more pages: ${hasNextPage}`);
    }

    console.log(`Pull completed! Total: ${totalFetched}, Created: ${created}, Updated: ${updated}, Failed: ${failed}`);

    return NextResponse.json({
      success: true,
      data: {
        total: totalFetched,
        created,
        updated,
        failed,
        message: `Pulled ${totalFetched} customers from Shopify across ${pageCount} pages`,
      },
    });
  } catch (error: any) {
    console.error("Error pulling Shopify customers:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to pull Shopify customers",
      },
      { status: 500 }
    );
  }
}
