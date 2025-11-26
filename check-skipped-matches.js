// Check what are the skipped matches (multiple matches per customer)
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSkippedMatches() {
  console.log('🔍 Checking skipped matches (multiple matches)...\n');
  
  try {
    // Find customers with multiple Shopify matches
    const multiMatchQuery = `
      SELECT 
        nc.id as nhanh_id,
        nc.name as nhanh_name,
        nc.phone as nhanh_phone,
        COUNT(sc.id) as match_count,
        STRING_AGG(sc."firstName" || ' ' || sc."lastName", ', ') as shopify_names
      FROM nhanh_customers nc
      LEFT JOIN customer_mappings cm ON cm."nhanhCustomerId" = nc.id
      INNER JOIN shopify_customers sc ON (
        nc.phone = sc.phone
        OR
        (nc.phone LIKE '0%' AND sc.phone = '+84' || SUBSTRING(nc.phone, 2))
        OR
        (nc.phone LIKE '+84%' AND sc.phone = '0' || SUBSTRING(nc.phone, 4))
        OR
        (sc.phone LIKE '0%' AND nc.phone = '+84' || SUBSTRING(sc.phone, 2))
        OR
        (sc.phone LIKE '+84%' AND nc.phone = '0' || SUBSTRING(sc.phone, 4))
      )
      WHERE 
        cm.id IS NULL
        AND nc.phone IS NOT NULL
        AND sc.phone IS NOT NULL
      GROUP BY nc.id, nc.name, nc.phone
      HAVING COUNT(sc.id) > 1
      ORDER BY match_count DESC
      LIMIT 20
    `;
    
    const multiMatches = await prisma.$queryRawUnsafe(multiMatchQuery);
    
    console.log(`Found ${multiMatches.length} customers with multiple matches:\n`);
    
    multiMatches.forEach((m, i) => {
      console.log(`${i + 1}. ${m.nhanh_name} (${m.nhanh_phone})`);
      console.log(`   → ${m.match_count} Shopify matches: ${m.shopify_names}`);
      console.log('');
    });
    
    // Count total skipped
    const totalSkippedQuery = `
      SELECT COUNT(DISTINCT nc.id) as total_skipped
      FROM nhanh_customers nc
      LEFT JOIN customer_mappings cm ON cm."nhanhCustomerId" = nc.id
      INNER JOIN shopify_customers sc ON (
        nc.phone = sc.phone
        OR
        (nc.phone LIKE '0%' AND sc.phone = '+84' || SUBSTRING(nc.phone, 2))
        OR
        (nc.phone LIKE '+84%' AND sc.phone = '0' || SUBSTRING(nc.phone, 4))
        OR
        (sc.phone LIKE '0%' AND nc.phone = '+84' || SUBSTRING(sc.phone, 2))
        OR
        (sc.phone LIKE '+84%' AND nc.phone = '0' || SUBSTRING(sc.phone, 4))
      )
      WHERE 
        cm.id IS NULL
        AND nc.phone IS NOT NULL
        AND sc.phone IS NOT NULL
      GROUP BY nc.id
      HAVING COUNT(sc.id) > 1
    `;
    
    const totalSkipped = await prisma.$queryRawUnsafe(totalSkippedQuery);
    console.log(`\nTotal customers with multiple matches: ${totalSkipped.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSkippedMatches()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
