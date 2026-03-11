// API Route: Pull Products from Nhanh (OPTIMIZED with bulk operations)
import { NextRequest, NextResponse } from "next/server";
import { nhanhProductAPI } from "@/lib/nhanh-product-api";
import { prisma } from "@/lib/prisma";
import { formatDuration } from "@/lib/format-duration";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Will continue in background

export async function POST(request: NextRequest) {
  // Create background job for tracking
  const job = await prisma.backgroundJob.create({
    data: {
      type: "PULL_NHANH_PRODUCTS",
      storeId: "default_store",
      total: 0,
      status: "RUNNING",
    },
  });

  // Start background process immediately
  pullAllProductsBackground(job.id);

  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: "Background pull started! Check Job Tracking for progress.",
  });
}

async function pullAllProductsBackground(jobId: string) {
  console.log(`🚀 Starting background pull of ALL Nhanh products (Job: ${jobId})...`);
  const startTime = Date.now();

  let created = 0;
  let updated = 0;
  let failed = 0;
  let totalFetched = 0;
  let pageCount = 0;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;
  let nextCursor: any = undefined;

  try {
    // Check for existing progress
    const progress = await prisma.pullProgress.findFirst({
      where: { storeId: "default_store", type: "nhanh_products" },
    });

    nextCursor = progress?.nextCursor || undefined;
    const resuming = !!nextCursor;

    if (resuming) {
      console.log(`🔄 Resuming from previous pull (${progress?.totalPulled || 0} products already pulled)`);
      totalFetched = progress?.totalPulled || 0;
    }

    let hasMore = true;

    while (hasMore) {
      pageCount++;
      const pageStartTime = Date.now();

      try {
        console.log(`📦 Fetching page ${pageCount}...`);

        // Fetch products from Nhanh with cursor (EXTREME: Increased to 1000)
        const response = await nhanhProductAPI.getProducts({
          limit: 1000,
          next: nextCursor,
        });

        const products = response.products;

        if (products.length === 0) {
          break;
        }

        const fetchTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ✅ Fetched ${products.length} products in ${fetchTime}s`);

        // Bulk upsert products
        const dbStartTime = Date.now();

        // Get existing product IDs
        const existingIds = await prisma.nhanhProduct.findMany({
          where: { nhanhId: { in: products.map(p => p.id) }, storeId: "default_store" },
          select: { nhanhId: true }
        });

        const existingIdSet = new Set(existingIds.map(p => p.nhanhId));
        const toCreate = products.filter(p => !existingIdSet.has(p.id));
        const toUpdate = products.filter(p => existingIdSet.has(p.id));

        // Bulk create new products
        if (toCreate.length > 0) {
          await prisma.nhanhProduct.createMany({
            data: toCreate.map(p => ({
              nhanhId: p.id,
              storeId: "default_store",
              name: p.name,
              sku: p.sku,
              barcode: p.barcode,
              price: p.price,
              comparePrice: p.comparePrice,
              quantity: p.quantity,
              categoryId: p.categoryId,
              categoryName: p.categoryName,
              brandId: p.brandId,
              brandName: p.brandName,
              description: p.description,
              images: p.images || [],
              lastPulledAt: new Date(),
            })),
            skipDuplicates: true,
          });
          created += toCreate.length;
        }

        // Bulk update existing products (EXTREME: Parallel processing with batch 200)
        if (toUpdate.length > 0) {
          const updateBatchSize = 200; // Increased from 100 to 200
          const updatePromises = [];

          for (let i = 0; i < toUpdate.length; i += updateBatchSize) {
            const batch = toUpdate.slice(i, i + updateBatchSize);
            updatePromises.push(
              prisma.$transaction(
                batch.map(p =>
                  prisma.nhanhProduct.update({
                    where: { storeId_nhanhId: { storeId: "default_store", nhanhId: p.id } },
                    data: {
                      name: p.name,
                      sku: p.sku,
                      barcode: p.barcode,
                      price: p.price,
                      comparePrice: p.comparePrice,
                      quantity: p.quantity,
                      categoryId: p.categoryId,
                      categoryName: p.categoryName,
                      brandId: p.brandId,
                      brandName: p.brandName,
                      description: p.description,
                      images: p.images || [],
                      lastPulledAt: new Date(),
                    },
                  })
                )
              )
            );
          }

          // Execute all update batches in parallel
          await Promise.all(updatePromises);
          updated += toUpdate.length;
        }

        const dbTime = ((Date.now() - dbStartTime) / 1000).toFixed(2);
        totalFetched += products.length;

        console.log(`  💾 Saved to DB in ${dbTime}s (Created: ${toCreate.length}, Updated: ${toUpdate.length})`);
        console.log(`  📊 Progress: ${totalFetched} total products, Page ${pageCount} completed`);

        // Update job progress with estimated speed (OPTIMIZED: Every 10 pages)
        if (pageCount % 10 === 0 || !hasMore) {
          const elapsed = (Date.now() - startTime) / 1000;
          const estimatedSpeed = totalFetched > 0 ? (totalFetched / elapsed).toFixed(1) : "0";
          await prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
              total: totalFetched,
              processed: totalFetched,
              successful: created + updated,
              failed,
              metadata: {
                estimatedSpeed: `${estimatedSpeed} products/sec`,
                pages: pageCount,
              },
            },
          }).catch(() => { });
        }

        // Check for next page
        hasMore = response.hasMore;
        nextCursor = response.next;

        const pageTime = ((Date.now() - pageStartTime) / 1000).toFixed(2);
        console.log(`  ⏱️  Total page time: ${pageTime}s\n`);

        // Save progress after each page
        await prisma.pullProgress.upsert({
          where: { storeId_type: { storeId: "default_store", type: "nhanh_products" } },
          create: {
            storeId: "default_store",
            type: "nhanh_products",
            nextCursor: nextCursor || undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: !hasMore,
          },
          update: {
            nextCursor: nextCursor || undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: !hasMore,
          },
        });

        // Reset error counter on success
        consecutiveErrors = 0;

        // Rate limiting delay (SAFE OPTIMIZED: Reduced to 10ms)
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

      } catch (pageError: any) {
        console.error(`❌ Error on page ${pageCount}:`, pageError.message);
        consecutiveErrors++;
        failed += 100; // Assume page failed

        // Check for too many consecutive errors
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.error(`🚫 Too many consecutive errors (${consecutiveErrors}), stopping pull`);

          // Update job as FAILED
          await prisma.backgroundJob.update({
            where: { id: jobId },
            data: {
              status: "FAILED",
              error: `Too many consecutive errors (${consecutiveErrors}). Last error: ${pageError.message}`,
              completedAt: new Date(),
            },
          }).catch(() => { });
          break;
        }

        // Save progress even on error
        await prisma.pullProgress.upsert({
          where: { storeId_type: { storeId: "default_store", type: "nhanh_products" } },
          create: {
            storeId: "default_store",
            type: "nhanh_products",
            nextCursor: nextCursor || undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
            isCompleted: false,
          },
          update: {
            nextCursor: nextCursor || undefined,
            totalPulled: totalFetched,
            lastPulledAt: new Date(),
          },
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const speed = totalFetched > 0 ? (totalFetched / durationSeconds).toFixed(1) : "0";
    const duration = formatDuration(durationSeconds);

    console.log(`\n✅ Pull completed successfully!`);
    console.log(`📊 Final stats:`);
    console.log(`   - Total products: ${totalFetched}`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Updated: ${updated}`);
    console.log(`   - Failed: ${failed}`);
    console.log(`   - Pages processed: ${pageCount}`);
    console.log(`   - Duration: ${duration} (${speed} products/sec)`);

    // Mark as completed
    await prisma.pullProgress.update({
      where: { storeId_type: { storeId: "default_store", type: "nhanh_products" } },
      data: {
        isCompleted: true,
        nextCursor: undefined,
      },
    });

    // Update job as completed
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
          duration: duration, // Already formatted by formatDuration()
          speed: `${speed} products/sec`,
          pages: pageCount,
          created,
          updated,
        },
      },
    }).catch(() => { });

  } catch (error: any) {
    console.error("❌ Fatal error in background pull:", error);

    // Update job as failed
    await prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        error: error.message,
        completedAt: new Date(),
      },
    }).catch(() => { });

    // Save error state
    try {
      await prisma.pullProgress.upsert({
        where: { storeId_type: { storeId: "default_store", type: "nhanh_products" } },
        create: {
          storeId: "default_store",
          type: "nhanh_products",
          nextCursor: nextCursor || undefined,
          totalPulled: totalFetched,
          lastPulledAt: new Date(),
          isCompleted: false,
        },
        update: {
          nextCursor: nextCursor || undefined,
          totalPulled: totalFetched,
          lastPulledAt: new Date(),
        },
      });
    } catch (saveError) {
      console.error("Failed to save error state:", saveError);
    }
  }
}
