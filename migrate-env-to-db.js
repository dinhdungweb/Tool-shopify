/**
 * Migration Script: Move API credentials from .env to encrypted database storage
 * 
 * This script reads Shopify and Nhanh credentials from environment variables
 * and stores them encrypted in the database via the Settings API.
 * 
 * Run once after deploying the new Settings feature.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateEnvToDb() {
  console.log('🔄 Migrating API credentials from .env to database...\n');

  try {
    // Check if credentials already exist in database
    const existingSettings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'shopify_store_url',
            'shopify_access_token',
            'nhanh_api_url',
            'nhanh_app_id',
            'nhanh_business_id',
            'nhanh_access_token',
          ],
        },
      },
    });

    if (existingSettings.length > 0) {
      console.log('⚠️  Settings already exist in database:');
      existingSettings.forEach(s => console.log(`   - ${s.key}`));
      console.log('\n❓ Do you want to overwrite? (This script will skip migration)');
      console.log('   To overwrite, delete settings via Settings page first.\n');
      return;
    }

    // Read from environment variables
    const envCredentials = {
      shopify_store_url: process.env.SHOPIFY_STORE_URL,
      shopify_access_token: process.env.SHOPIFY_ACCESS_TOKEN,
      nhanh_api_url: process.env.NHANH_API_URL,
      nhanh_app_id: process.env.NHANH_APP_ID,
      nhanh_business_id: process.env.NHANH_BUSINESS_ID,
      nhanh_access_token: process.env.NHANH_ACCESS_TOKEN,
    };

    // Check if any credentials exist in env
    const hasEnvCredentials = Object.values(envCredentials).some(v => v && v.trim());

    if (!hasEnvCredentials) {
      console.log('ℹ️  No API credentials found in environment variables.');
      console.log('   Configure them via Settings page at /settings\n');
      return;
    }

    console.log('📋 Found credentials in environment variables:');
    Object.entries(envCredentials).forEach(([key, value]) => {
      if (value) {
        console.log(`   ✓ ${key}`);
      }
    });
    console.log();

    // Call the Settings API to save encrypted credentials
    console.log('💾 Saving to database with encryption...');
    
    const response = await fetch('http://localhost:3000/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopify: {
          storeUrl: envCredentials.shopify_store_url || '',
          accessToken: envCredentials.shopify_access_token || '',
        },
        nhanh: {
          apiUrl: envCredentials.nhanh_api_url || '',
          appId: envCredentials.nhanh_app_id || '',
          businessId: envCredentials.nhanh_business_id || '',
          accessToken: envCredentials.nhanh_access_token || '',
        },
      }),
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Migration completed successfully!\n');
      console.log('📝 Next steps:');
      console.log('   1. Verify settings at http://localhost:3000/settings');
      console.log('   2. Test API connections using the Test buttons');
      console.log('   3. Remove API credentials from your .env file');
      console.log('   4. Keep only DATABASE_URL and ENCRYPTION_KEY in .env\n');
    } else {
      console.error('❌ Migration failed:', result.error);
    }

  } catch (error) {
    console.error('❌ Error during migration:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if server is running
fetch('http://localhost:3000/api/settings')
  .then(() => migrateEnvToDb())
  .catch(() => {
    console.error('❌ Error: Development server is not running!');
    console.log('   Please start the server first: npm run dev\n');
    process.exit(1);
  });
