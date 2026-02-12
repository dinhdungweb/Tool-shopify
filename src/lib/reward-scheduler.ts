import cron from "node-cron";
import { rewardService } from "./reward-service";

class RewardScheduler {
    private task: cron.ScheduledTask | null = null;
    private isInitialized = false;

    async initialize() {
        console.log("Initializing reward expiration scheduler...");
        try {
            this.stop();
            // Check every minute (like sale campaign scheduler)
            this.task = cron.schedule(
                "* * * * *",
                async () => {
                    await rewardService.checkExpirations();
                },
                {
                    scheduled: true,
                    timezone: "Asia/Ho_Chi_Minh",
                }
            );
            this.isInitialized = true;
            console.log("✅ Reward expiration scheduler initialized (Every minute)");

            // Run check immediately on startup
            await rewardService.checkExpirations();
        } catch (error) {
            console.error("❌ Failed to initialize reward scheduler:", error);
        }
    }

    stop() {
        if (this.task) {
            this.task.stop();
            this.task = null;
        }
        this.isInitialized = false;
    }
}

export const rewardScheduler = new RewardScheduler();
