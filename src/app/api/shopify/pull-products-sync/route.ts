// API Route: Pull Products from Shopify (OPTIMIZED with bulk operations)
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Will continue in background

export async function POST(request: NextRequest) {
  // Get status filter from request body
  const body = await request.json().catch(() => ({}));
  const { status } = body; // "active", "draft", "archived", or undefined for all
  
  // Create background job for tracking
  const job = await prisma.backgroundJob.create({
    data: {
      type: "PULL_SHOPIFY_PRODUCTS",
      total: 0, // Will be updated as we fetch
      status: "RUNNING",
      metadata: {
        statusFilter: status || "all",
      },
    },
  });
  
  // Start background process immediately
  pullAllProductsBackground(status, job.id);
  
  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: "Background pull started! Check Job Tracking for progress.",
  });
}

async function pullAllProductsBackground(status?: string, jobId?: string) {
  const statusFilter = status ? ` (status: ${status})` : "";
  console.log(`🚀 Starting background pull of Shopify products${statusFilter}...`);
  
  const shopDomain = process.env.SHOPIFY_STORE_URL || "";
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
  const graphqlUrl = `https://${shopDomain}/admin/api/${apiVersion}/graphql.json`;

  let created = 0;
  let updated = 0;
  let failed = 0;
  let totalFetched = 0;
  let pageCount = 0;
  let cursor: string | null = null;
  const startTime = Date.now();

  try {
    // Check for existing progress
    const progress = await prisma.pullProgress.findUnique({
      where: { id: "shopify_products" },
    });

    let hasNextPage = true;
    cursor = progress?.nextCursor as string | null || null;
    const resuming = !!cursor && !progress?.isCompleted;

    if (progress) {
      console.log(`📊 Found existing progress:`, {
        cursor: cursor ? "exists" : "null",
        totalPulled: progress.totalPulled,
        isCompleted: progress.isCompleted,
        willResume: resuming,
      });
    } else {
      console.log(`🆕 No existing progress found, starting fresh`);
    }

    if (resuming) {
      console.log(`🔄 Resuming from previous pull (${progress?.totalPulled || 0} products already pulled)`);
      totalFetched = progress?.totalPulled || 0;
    } else if (progress?.isCompleted) {
      console.log(`✅ Previous pull was completed, starting fresh pull`);
    }
    
    while (hasNextPage) {
      pageCount++;
      const pageStartTime = Date.now();
      
      try {
        console.log(`📦 Fetching page ${pageCount}...`);

        // Build query filter based on status
        const queryFilter = status ? `status:${status}` : "";
        
        const query = `
          query getProducts($cursor: String) {
            products(first: 50, after: $cursor${queryFilter ? `, query: "${queryFilter}"` : ""}) {
              edges {
                node {
                  id
                  title
                  handle
                  productType
                  vendor
                  tags
                  variants(first: 100) {
                    edges {
                      node {
                        id
                        title
                        sku
                        barcode
                        price
                        compareAtPrice
                        inventoryQuantity
                        inventoryItem {
                          id
                        }
                      }
                    }
                  }
                  images(first: 10) {
                    edges {
                      node {
                        url
                      }
                    }
                  }
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `;

        const response: any = await axios.post(
          graphqlUrl,
          { query, variables: { cursor } },
          {
            headers: {
              "X-Shopify-Access-Token": accessToken,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.errors) {
          throw new Error(response.data.errors.map((e: any) => e.message).join(", "));
        }

        const data: any = response.data.data;
        const products: any[] = data?.products?.edges || [];
        const pageInfo: any = data?.products?.pageInfo;

        if (products.length === 0) {
          break;
        }

        const fetchTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ✅ Fetched ${products.length} products in ${fetchTime}s`);

        // Flatten all variants from all products
        const allVariants: any[] = [];
        for (const edge of products) {
          const product = edge.node;
          const variants = product.variants?.edges || [];
          const images = product.images?.edges?.map((img: any) => img.node.url) || [];

          for (const variantEdge of variants) {
            const variant = variantEdge.node;
            const variantId = variant.id.split("/").pop() || variant.id;
            const inventoryItemId = variant.inventoryItem?.id?.split("/").pop() || null;
            const fullTitle =
              variant.title && variant.title !== "Default Title"
                ? `${product.title} - ${variant.title}`
                : product.title;

            allVariants.push({
              id: variantId,
              title: fullTitle,
              handle: product.handle,
              productType: product.productType,
              vendor: product.vendor,
              tags: product.tags || [],
              variantId: variantId,
              inventoryItemId: inventoryItemId, // Save inventory_item_id
              sku: variant.sku || "",
              barcode: variant.barcode || "",
              price: parseFloat(variant.price || "0"),
              compareAtPrice: variant.compareAtPrice ? parseFloat(variant.compareAtPrice) : null,
              inventoryQuantity: variant.inventoryQuantity || 0,
              images,
            });
          }
        }

        console.log(`  📊 Processing ${allVariants.length} variants...`);

        // Bulk upsert variants
        const dbStartTime = Date.now();
        
        // Get existing variant IDs
        const existingIds = await prisma.shopifyProduct.findMany({
          where: { id: { in: allVariants.map(v => v.id) } },
          select: { id: true }
        });
        
        const existingIdSet = new Set(existingIds.map(v => v.id));
        const toCreate = allVariants.filter(v => !existingIdSet.has(v.id));
        const toUpdate = allVariants.filter(v => existingIdSet.has(v.id));
        
        // Bulk create new variants
        if (toCreate.length > 0) {
          await prisma.shopifyProduct.createMany({
            data: toCreate.map(v => ({
              ...v,
              lastPulledAt: new Date(),
            })),
            skipDuplicates: true,
          });
          created += toCreate.length;
        }
        
        // Bulk update existing variants (in batches)
        if (toUpdate.length > 0) {
          const updateBatchSize = 100;
          for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
            const batch = toUpdate.slice(i, i + updateBatchSize);
            await prisma.$transaction(
              batch.map(v =>
                prisma.shopifyProduct.update({
                  where: { id: v.id },
                  data: {
                    ...v,
                    lastPulledAt: new Date(),
                  },
                })
              )
            );
          }
          updated += toUpdate.length;
        }

        const dbTime = ((Date.now() - dbStartTime) / 1000).toFixed(2);
        totalFetched += allVariants.length;
        
        console.log(`  💾 Saved to DB in ${dbTime}s (Created: ${toCreate.length}, Updated: ${toUpdate.length})`);
        console.log(`  📊 Progress: ${totalFetched} total variants, Page ${pageCount} completed`);

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
                statusFilter: status || "all",
                speed: `${speed} variants/sec`,
                pages: pageCount,
              },
            },
          }).catch(() => {});
        }

        // Check for next page
        hasNextPage = pageInfo?.hasNextPage || false;
        cursor = pageInfo?.endCursor || null;

        const pageTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ⏱️  Total page time: ${pageTime}s\n`);

        // Save progress after each page
        await prisma.pullProgress.upsert({
          where: { id: "shopify_products" },
          create: {
            id: "shopify_products",
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

        // Rate limiting delay
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

      } catch (pageError: any) {
        console.error(`❌ Error on page ${pageCount}:`, pageError.message);
        failed += 50; // Assume page failed
        
        // Save progress even on error
        await prisma.pullProgress.upsert({
          where: { id: "shopify_products" },
          create: {
            id: "shopify_products",
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
        
        continue;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const speed = totalFetched > 0 ? (totalFetched / parseFloat(duration)).toFixed(1) : "0";
    
    console.log(`\n✅ Pull completed successfully!`);
    console.log(`📊 Final stats:`);
    console.log(`   - Total variants: ${totalFetched}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Pages processed: ${pageCount}`);
    console.log(`   - Duration: ${duration}s (${speed} variants/sec)`);

    // Mark as completed
    await prisma.pullProgress.update({
      where: { id: "shopify_products" },
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
            statusFilter: status || "all",
            duration: `${duration}s`,
            speed: `${speed} variants/sec`,
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
      await prisma.pullProgress.upsert({
        where: { id: "shopify_products" },
        create: {
          id: "shopify_products",
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
