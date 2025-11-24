import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/sync/auto-match
 * Automatically match Nhanh customers with Shopify customers by phone number
 */
export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json();

    // Get all unmapped Nhanh customers with phone numbers
    const unmappedCustomers = await prisma.nhanhCustomer.findMany({
      where: {
        mapping: null,
        phone: { not: null },
      },
      // No limit - process all unmapped customers
    });

    const results = {
      total: unmappedCustomers.length,
      matched: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    console.log(`🚀 Starting auto-match for ${unmappedCustomers.length} unmapped customers...`);

    // Process in batches for better performance
    const batchSize = 50;
    const totalBatches = Math.ceil(unmappedCustomers.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, unmappedCustomers.length);
      const batch = unmappedCustomers.slice(start, end);

      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} customers)...`);

      // Process batch in parallel
      const batchPromises = batch.map(async (customer) => {
        if (!customer.phone) {
          return { type: "skipped" };
        }

        try {
          // Normalize phone number (remove spaces, dashes, parentheses, +, etc.)
          const normalizedPhone = customer.phone.replace(/[\s\-\(\)\+]/g, "");
          
          // Try multiple search strategies
          let shopifyCustomers = await prisma.shopifyCustomer.findMany({
            where: {
              phone: normalizedPhone,
            },
          });

          // If no exact match, try contains search
          if (shopifyCustomers.length === 0) {
            shopifyCustomers = await prisma.shopifyCustomer.findMany({
              where: {
                phone: {
                  contains: normalizedPhone,
                  mode: "insensitive",
                },
              },
            });
          }

          // If still no match and phone starts with 0, try with +84
          if (shopifyCustomers.length === 0 && normalizedPhone.startsWith("0")) {
            const phoneWith84 = "+84" + normalizedPhone.substring(1);
            shopifyCustomers = await prisma.shopifyCustomer.findMany({
              where: {
                phone: {
                  contains: phoneWith84,
                  mode: "insensitive",
                },
              },
            });
          }

          // If still no match and phone starts with +84, try with 0
          if (shopifyCustomers.length === 0 && normalizedPhone.startsWith("+84")) {
            const phoneWith0 = "0" + normalizedPhone.substring(3);
            shopifyCustomers = await prisma.shopifyCustomer.findMany({
              where: {
                phone: {
                  contains: phoneWith0,
                  mode: "insensitive",
                },
              },
            });
          }

          // Only auto-match if exactly one customer found
          if (shopifyCustomers.length === 1) {
            const shopifyCustomer = shopifyCustomers[0];

            if (!dryRun) {
              // Create mapping
              await prisma.customerMapping.create({
                data: {
                  nhanhCustomerId: customer.id,
                  nhanhCustomerName: customer.name,
                  nhanhCustomerPhone: customer.phone,
                  nhanhCustomerEmail: customer.email,
                  nhanhTotalSpent: customer.totalSpent,
                  shopifyCustomerId: shopifyCustomer.id,
                  shopifyCustomerEmail: shopifyCustomer.email || undefined,
                  shopifyCustomerName: `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim(),
                  syncStatus: SyncStatus.PENDING,
                },
              });
            }

            return {
              type: "matched",
              detail: {
                nhanhCustomer: {
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                },
                shopifyCustomer: {
                  id: shopifyCustomer.id,
                  name: `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim(),
                  email: shopifyCustomer.email,
                },
                status: "matched",
              },
            };
          } else if (shopifyCustomers.length === 0) {
            return {
              type: "skipped",
              detail: {
                nhanhCustomer: {
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                },
                status: "no_match",
                reason: "No Shopify customer found with this phone",
              },
            };
          } else {
            return {
              type: "skipped",
              detail: {
                nhanhCustomer: {
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                },
                status: "multiple_matches",
                reason: `Found ${shopifyCustomers.length} Shopify customers with this phone`,
              },
            };
          }
        } catch (error: any) {
          console.error(`Error matching customer ${customer.id}:`, error);
          return {
            type: "failed",
            detail: {
              nhanhCustomer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
              },
              status: "error",
              error: error.message,
            },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Aggregate results
      batchResults.forEach((result) => {
        if (result.type === "matched") {
          results.matched++;
          results.details.push(result.detail);
        } else if (result.type === "skipped") {
          results.skipped++;
          if (result.detail) results.details.push(result.detail);
        } else if (result.type === "failed") {
          results.failed++;
          if (result.detail) results.details.push(result.detail);
        }
      });

      console.log(
        `✅ Batch ${batchIndex + 1} completed: ${results.matched} matched, ${results.skipped} skipped, ${results.failed} failed`
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...results,
        dryRun,
        message: dryRun
          ? `Dry run completed: ${results.matched} potential matches found`
          : `Auto-match completed: ${results.matched} customers matched`,
      },
    });
  } catch (error: any) {
    console.error("Error in auto-match:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to auto-match customers",
      },
      { status: 500 }
    );
  }
}
