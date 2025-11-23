// Test file to verify API connections
// Run with: npx tsx src/lib/test-api.ts

// Load environment variables
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

import { nhanhAPI } from "./nhanh-api";
import { shopifyAPI } from "./shopify-api";

async function checkEnvVars() {
  console.log("🔍 Checking environment variables...\n");
  
  const nhanhVars = {
    NHANH_APP_ID: process.env.NHANH_APP_ID,
    NHANH_BUSINESS_ID: process.env.NHANH_BUSINESS_ID,
    NHANH_ACCESS_TOKEN: process.env.NHANH_ACCESS_TOKEN ? "✓ Set" : "✗ Missing",
  };
  
  const shopifyVars = {
    SHOPIFY_STORE_URL: process.env.SHOPIFY_STORE_URL,
    SHOPIFY_ACCESS_TOKEN: process.env.SHOPIFY_ACCESS_TOKEN ? "✓ Set" : "✗ Missing",
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION,
  };
  
  console.log("Nhanh.vn Config:", nhanhVars);
  console.log("Shopify Config:", shopifyVars);
  console.log("");
}

async function testNhanhAPI() {
  console.log("🧪 Testing Nhanh.vn API...");
  try {
    const customers = await nhanhAPI.getCustomers({ limit: 5 });
    console.log("✅ Nhanh API works!");
    console.log(`Found ${customers.total} customers`);
    if (customers.customers.length > 0) {
      console.log("First customer:", {
        id: customers.customers[0].id,
        name: customers.customers[0].name,
        phone: customers.customers[0].phone,
        totalSpent: customers.customers[0].totalSpent,
      });
    }
  } catch (error: any) {
    console.error("❌ Nhanh API failed:", error.message);
    console.error("Full error:", error);
  }
}

async function testShopifyAPI() {
  console.log("\n🧪 Testing Shopify API...");
  try {
    const result = await shopifyAPI.getAllCustomers(5);
    console.log("✅ Shopify API works!");
    console.log(`Found ${result.customers.length} customers`);
    if (result.customers.length > 0) {
      console.log("First customer:", {
        id: result.customers[0].id,
        email: result.customers[0].email,
        name: `${result.customers[0].firstName} ${result.customers[0].lastName}`,
        totalSpent: result.customers[0].totalSpent,
      });
    }
  } catch (error: any) {
    console.error("❌ Shopify API failed:", error.message);
    console.error("Full error:", error);
  }
}

async function main() {
  console.log("🚀 Starting API tests...\n");
  await checkEnvVars();
  await testNhanhAPI();
  await testShopifyAPI();
  console.log("\n✨ Tests completed!");
}

main();
