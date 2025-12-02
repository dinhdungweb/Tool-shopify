import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SyncStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/sync/auto-match-batch
 * Batch-based auto-match for very large datasets (200k+)
 * Processes in small chunks to avoid timeouts
 */

// Helper to normalize phone
function normalizePhone(phone: string): string[] {
  if (!phone) return [];
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, "");
  const variations = [cleaned];
  
  if (cleaned.startsWith("0")) {
    variations.push("84" + cleaned.substring(1));
  } else if (cleaned.startsWith("84")) {
    variations.push("0" + cleaned.substring(2));
  }
  
  return variations;
}

// Helper to extract phone numbers from note
function extractPhonesFromNote(note: string): string[] {
  if (!note) return [];
  
  // Regex to find Vietnamese phone numbers (10-11 digits)
  const phoneRegex = /(?:\+?84|0)(?:\d[\s\-\.]?){8,10}\d/g;
  const matches = note.match(phoneRegex);
  
  if (!matches) return [];
  
  const phones: string[] = [];
  matches.forEach(match => {
    const normalized = match.replace(/[\s\-\(\)\+\.]/g, "");
    phones.push(...normalizePhone(normalized));
  });
  
  return [...new Set(phones)]; // Remove duplicates
}

export async function POST(request: NextRequest) {
  let job: any = null;
  
  try {
    const { dryRun = false, batchSize = 1000 } = await request.json();

    // Create background job for tracking
    job = await prisma.backgroundJob.create({
      data: {
        type: "AUTO_MATCH_CUSTOMERS",
        total: 0,
        status: "RUNNING",
        metadata: {
          dryRun,
          batchSize,
        },
      },
    });

    console.log(`🚀 Starting batch-based auto-match (Job: ${job.id})...`);
    const startTime = Date.now();

    // Step 1: Get unmapped Nhanh customers with phone
    console.log("📥 Loading unmapped customers...");
    const unmappedCustomers = await prisma.nhanhCustomer.findMany({
      where: {
        mapping: null,
        phone: { 
          not: null,
          notIn: [""]
        },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        email: true,
        totalSpent: true,
      },
    });

    console.log(`✅ Found ${unmappedCustomers.length} unmapped customers`);

    // Update job with total
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        total: unmappedCustomers.length,
      },
    }).catch(() => {});

    if (unmappedCustomers.length === 0) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        data: {
          matched: 0,
          skipped: 0,
          jobId: job.id,
          message: "No unmapped customers found",
        },
      });
    }

    // Step 2: Build phone lookup from Shopify customers
    console.log("🗺️ Building Shopify phone index (including phone, defaultAddressPhone, and note)...");
    const shopifyCustomers = await prisma.shopifyCustomer.findMany({
      where: {
        OR: [
          { 
            AND: [
              { phone: { not: null } },
              { phone: { not: "" } }
            ]
          },
          { 
            AND: [
              { defaultAddressPhone: { not: null } },
              { defaultAddressPhone: { not: "" } }
            ]
          },
          { 
            AND: [
              { note: { not: null } },
              { note: { not: "" } }
            ]
          },
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

    // Build phone map
    const phoneMap = new Map<string, typeof shopifyCustomers>();
    let notesProcessed = 0;
    let phonesFromNotes = 0;
    
    for (const customer of shopifyCustomers) {
      const phonesSet = new Set<string>();
      
      // 1. Primary phone
      if (customer.phone) {
        normalizePhone(customer.phone).forEach(p => phonesSet.add(p));
      }
      
      // 2. Default address phone
      if (customer.defaultAddressPhone) {
        normalizePhone(customer.defaultAddressPhone).forEach(p => phonesSet.add(p));
      }
      
      // 3. Extract phones from note (limit to 2000 chars for performance)
      if (customer.note && customer.note.length < 2000) {
        const beforeCount = phonesSet.size;
        extractPhonesFromNote(customer.note).forEach(p => phonesSet.add(p));
        if (phonesSet.size > beforeCount) {
          notesProcessed++;
          phonesFromNotes += (phonesSet.size - beforeCount);
        }
      }
      
      // Index unique phones only
      for (const phone of phonesSet) {
        if (!phoneMap.has(phone)) {
          phoneMap.set(phone, []);
        }
        phoneMap.get(phone)!.push(customer);
      }
    }

    console.log(`✅ Indexed ${shopifyCustomers.length} Shopify customers with ${phoneMap.size} phone variations`);
    console.log(`   - Extracted ${phonesFromNotes} phones from ${notesProcessed} customer notes`);

    console.log(`✅ Indexed ${shopifyCustomers.length} Shopify customers with ${phoneMap.size} phone variations`);

    // Step 3: Match in batches
    let matched = 0;
    let skipped = 0;
    const totalBatches = Math.ceil(unmappedCustomers.length / batchSize);
    const matchesToCreate: any[] = [];

    console.log(`🔍 Processing ${totalBatches} batches...`);

    for (let i = 0; i < unmappedCustomers.length; i += batchSize) {
      const batch = unmappedCustomers.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`  📦 Batch ${batchNum}/${totalBatches} (${batch.length} customers)...`);

      for (const nhanhCustomer of batch) {
        const phoneVariations = normalizePhone(nhanhCustomer.phone!);
        let shopifyMatches: typeof shopifyCustomers = [];

        for (const phoneVar of phoneVariations) {
          const found = phoneMap.get(phoneVar);
          if (found) {
            shopifyMatches.push(...found);
          }
        }

        // Remove duplicates
        shopifyMatches = Array.from(
          new Map(shopifyMatches.map(c => [c.id, c])).values()
        );

        // Only match if exactly 1 customer found
        if (shopifyMatches.length === 1) {
          const shopifyCustomer = shopifyMatches[0];
          
          matchesToCreate.push({
            nhanhCustomerId: nhanhCustomer.id,
            nhanhCustomerName: nhanhCustomer.name,
            nhanhCustomerPhone: nhanhCustomer.phone,
            nhanhCustomerEmail: nhanhCustomer.email,
            nhanhTotalSpent: nhanhCustomer.totalSpent,
            shopifyCustomerId: shopifyCustomer.id,
            shopifyCustomerEmail: shopifyCustomer.email || null,
            shopifyCustomerName: `${shopifyCustomer.firstName || ""} ${shopifyCustomer.lastName || ""}`.trim(),
            syncStatus: SyncStatus.PENDING,
          });
          
          matched++;
        } else {
          skipped++;
        }
      }

      // Create mappings in sub-batches
      if (!dryRun && matchesToCreate.length >= 500) {
        await prisma.customerMapping.createMany({
          data: matchesToCreate,
          skipDuplicates: true,
        });
        console.log(`    💾 Created ${matchesToCreate.length} mappings`);
        matchesToCreate.length = 0; // Clear array
      }

      // Update job progress after each batch
      const processed = Math.min(i + batchSize, unmappedCustomers.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const speed = processed > 0 ? (processed / elapsed).toFixed(1) : "0";

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          processed,
          successful: matched,
          metadata: {
            dryRun,
            batchSize,
            shopifyCustomersIndexed: shopifyCustomers.length,
            phoneVariations: phoneMap.size,
            matched,
            skipped,
            batches: batchNum,
            totalBatches,
            speed: `${speed} customers/sec`,
          },
        },
      }).catch(() => {});
    }

    // Create remaining mappings
    if (!dryRun && matchesToCreate.length > 0) {
      await prisma.customerMapping.createMany({
        data: matchesToCreate,
        skipDuplicates: true,
      });
      console.log(`  💾 Created ${matchesToCreate.length} mappings`);
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
    const speed = unmappedCustomers.length > 0 ? (unmappedCustomers.length / durationSeconds).toFixed(1) : "0";
    const durationFormatted = durationSeconds < 60 ? `${durationSeconds}s` : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
    console.log(`🎉 Completed in ${durationFormatted}! Matched: ${matched}, Skipped: ${skipped}`);

    // Update job as completed
    await prisma.backgroundJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        total: unmappedCustomers.length,
        processed: unmappedCustomers.length,
        successful: dryRun ? 0 : matched,
        completedAt: new Date(),
        metadata: {
          dryRun,
          batchSize,
          shopifyCustomersIndexed: shopifyCustomers.length,
          phoneVariations: phoneMap.size,
          matched,
          skipped,
          created: dryRun ? 0 : matched,
          duration: durationFormatted,
          speed: `${speed} customers/sec`,
          batches: totalBatches,
        },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        total: unmappedCustomers.length,
        matched,
        skipped,
        jobId: job.id,
        duration: durationFormatted,
        dryRun,
        message: dryRun
          ? `Dry run: Found ${matched} potential matches in ${durationSeconds}s`
          : `Batch auto-match completed: ${matched} customers matched in ${durationSeconds}s`,
      },
    });
  } catch (error: any) {
    console.error("Error in batch auto-match:", error);

    // Update job as failed
    if (job?.id) {
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          error: error.message,
          completedAt: new Date(),
        },
      }).catch(() => {});
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to auto-match customers",
      },
      { status: 500 }
    );
  }
}
