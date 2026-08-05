// This file is automatically called by Next.js when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  console.log("Server starting - initializing schedulers...");

  try {
    const { cronScheduler } = await import("./lib/cron-scheduler");
    await cronScheduler.initialize();
    console.log("Customer sync scheduler initialized");
  } catch (error) {
    console.error("Failed to initialize customer sync scheduler:", error);
  }

  try {
    const { productScheduler } = await import("./lib/product-scheduler");
    await productScheduler.initialize();
    console.log("Product sync scheduler initialized");
  } catch (error) {
    console.error("Failed to initialize product sync scheduler:", error);
  }

  try {
    const { saleScheduler } = await import("./lib/sale-scheduler");
    await saleScheduler.initialize();
    console.log("Sale campaign scheduler initialized");
  } catch (error) {
    console.error("Failed to initialize sale campaign scheduler:", error);
  }

  try {
    const { rewardScheduler } = await import("./lib/reward-scheduler");
    await rewardScheduler.initialize();
    console.log("Reward expiration scheduler initialized");
  } catch (error) {
    console.error("Failed to initialize reward expiration scheduler:", error);
  }

  try {
    const { saleService } = await import("./lib/sale-service");
    const recovered = await saleService.recoverStuckCampaigns();
    if (recovered.length > 0) {
      console.log(`Recovered ${recovered.length} stuck sale campaigns after verifying Shopify prices`);
    }
  } catch (error) {
    console.error("Failed to recover stuck campaigns:", error);
  }

  console.log("All schedulers initialized");
}
