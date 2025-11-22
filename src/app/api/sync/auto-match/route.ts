import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { shopifyAPI } from "@/lib/shopify-api";
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
      take: 100, // Limit to avoid timeout
    });

    const results = {
      total: unmappedCustomers.length,
      matched: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    for (const customer of unmappedCustomers) {
      if (!customer.phone) {
        results.skipped++;
        continue;
      }

      try {
        // Normalize phone number (remove spaces, dashes, etc.)
        const normalizedPhone = customer.phone.replace(/[\s\-\(\)]/g, "");

        // Search Shopify for customer with this phone
        const shopifyCustomers = await shopifyAPI.searchCustomers({
          phone: normalizedPhone,
        });

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
                shopifyCustomerEmail: shopifyCustomer.email,
                shopifyCustomerName: `${shopifyCustomer.firstName} ${shopifyCustomer.lastName}`.trim(),
                syncStatus: SyncStatus.PENDING,
              },
            });
          }

          results.matched++;
          results.details.push({
            nhanhCustomer: {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
            },
            shopifyCustomer: {
              id: shopifyCustomer.id,
              name: `${shopifyCustomer.firstName} ${shopifyCustomer.lastName}`,
              email: shopifyCustomer.email,
            },
            status: "matched",
          });
        } else if (shopifyCustomers.length === 0) {
          results.skipped++;
          results.details.push({
            nhanhCustomer: {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
            },
            status: "no_match",
            reason: "No Shopify customer found with this phone",
          });
        } else {
          results.skipped++;
          results.details.push({
            nhanhCustomer: {
              id: customer.id,
              name: customer.name,
              phone: customer.phone,
            },
            status: "multiple_matches",
            reason: `Found ${shopifyCustomers.length} Shopify customers with this phone`,
          });
        }
      } catch (error: any) {
        console.error(`Error matching customer ${customer.id}:`, error);
        results.failed++;
        results.details.push({
          nhanhCustomer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          },
          status: "error",
          error: error.message,
        });
      }
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
