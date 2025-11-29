import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for large datasets

/**
 * POST /api/sync/auto-match
 * Automatically match Nhanh customers with Shopify customers by phone number
 */
// Helper function to normalize phone
function normalizePhone(phone: string): string[] {
  const normalized = phone.replace(/[\s\-\(\)\+]/g, "");
  const variations = [normalized];
  
  if (normalized.startsWith("0")) {
    variations.push("84" + normalized.substring(1));
  } else if (normalized.startsWith("84")) {
    variations.push("0" + normalized.substring(2));
  }
  
  return variations;
}

// Helper function to extract phone numbers from note
function extractPhonesFromNote(note: string): string[] {
  if (!note) return [];
  
  // Regex to find Vietnamese phone numbers (10-11 digits)
  // Matches: 0123456789, +84123456789, 84123456789, etc.
  const phoneRegex = /(?:\+?84|0)(?:\d[\s\-\.]?){8,10}\d/g;
  const matches = note.match(phoneRegex);
  
  if (!matches) return [];
  
  // Normalize all found phone numbers
  const phones: string[] = [];
  matches.forEach(match => {
    const normalized = match.replace(/[\s\-\(\)\+\.]/g, "");
    phones.push(...normalizePhone(normalized));
  });
  
  return [...new Set(phones)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  try {
    const { dryRun = false } = await request.json();

    console.log("🚀 Starting super-fast auto-match...");

    // Step 1: Load ALL Shopify customers into memory (one-time query)
    // For large datasets (200k+), only load customers with phone numbers
    console.log("📥 Loading Shopify customers with phone numbers...");
    const startLoad = Date.now();
    const allShopifyCustomers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { phone: { not: null } },
          { defaultAddressPhone: { not: null } },
          { note: { not: null } }, // May contain phone in note
        ],
      },
      select: {
        id: true,
        phone: true,
        defaultAddressPhone: true,
        note: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    console.log(`✅ Loaded ${allShopifyCustomers.length} customers in ${((Date.now() - startLoad) / 1000).toFixed(2)}s`);

    // Step 2: Build phone lookup map (O(1) lookup)
    console.log("🗺️ Building phone lookup map (including defaultAddressPhone and phones from notes)...");
    const startMap = Date.now();
    const phoneMap = new Map<string, typeof allShopifyCustomers[0][]>();
    
    let processedCount = 0;
    let skippedLongNotes = 0;
    
    for (const customer of allShopifyCustomers) {
      const phonesToIndex: string[] = [];
      
      // Add primary phone
      if (customer.phone) {
        phonesToIndex.push(...normalizePhone(customer.phone));
      }
      
      // Add default address phone
      if (customer.defaultAddressPhone) {
        phonesToIndex.push(...normalizePhone(customer.defaultAddressPhone));
      }
      
      // Extract and add phones from note (skip if note is too long to avoid performance issues)
      if (customer.note) {
        if (customer.note.length < 2000) {
          phonesToIndex.push(...extractPhonesFromNote(customer.note));
        } else {
          skippedLongNotes++;
        }
      }
      
      // Index all phone variations
      for (const variant of phonesToIndex) {
        if (!phoneMap.has(variant)) {
          phoneMap.set(variant, []);
        }
        phoneMap.get(variant)!.push(customer);
      }
      
      processedCount++;
      if (processedCount % 20000 === 0) {
        console.log(`  📊 Processed ${processedCount}/${allShopifyCustomers.length} customers...`);
      }
    }

    console.log(`✅ Built phone map with ${phoneMap.size} phone variations in ${((Date.now() - startMap) / 1000).toFixed(2)}s`);
    if (skippedLongNotes > 0) {
      console.log(`  ⚠️  Skipped ${skippedLongNotes} customers with very long notes (>2000 chars)`);
    }

    // Step 3: Get all unmapped Nhanh customers
    console.log("📥 Loading unmapped Nhanh customers...");
    const startNhanh = Date.now();
    const unmappedCustomers = await prisma.nhanhCustomer.findMany({
      where: {
        mapping: null,
        phone: { not: null },
      },
    });
    console.log(`✅ Loaded ${unmappedCustomers.length} unmapped customers in ${((Date.now() - startNhanh) / 1000).toFixed(2)}s`);

    const results = {
      total: unmappedCustomers.length,
      matched: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    console.log(`🔍 Starting matching process...`);

    // Step 4: Process in batches for database writes only
    const batchSize = 200; // Larger batch for better performance with large datasets
    const totalBatches = Math.ceil(unmappedCustomers.length / batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, unmappedCustomers.length);
      const batch = unmappedCustomers.slice(start, end);

      console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} customers)...`);

      // Process batch - NO DATABASE QUERIES, just Map lookups!
      const batchPromises = batch.map(async (customer) => {
        if (!customer.phone) {
          return { type: "skipped" };
        }

        try {
          // Normalize and lookup in Map (O(1) - instant!)
          const phoneVariations = normalizePhone(customer.phone);
          let shopifyCustomers: typeof allShopifyCustomers = [];
          
          for (const variant of phoneVariations) {
            const found = phoneMap.get(variant);
            if (found) {
              shopifyCustomers.push(...found);
            }
          }
          
          // Remove duplicates
          shopifyCustomers = Array.from(
            new Map(shopifyCustomers.map(c => [c.id, c])).values()
          );

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

    console.log(
      `🎉 Auto-match completed! ${results.matched} matched, ${results.skipped} skipped, ${results.failed} failed`
    );

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
