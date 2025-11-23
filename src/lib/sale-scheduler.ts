// Sale Campaign Scheduler
import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { saleService } from "./sale-service";

const prisma = new PrismaClient();

class SaleScheduler {
  private task: cron.ScheduledTask | null = null;
  private isInitialized = false;

  /**
   * Initialize scheduler - runs every minute to check for campaigns
   */
  async initialize() {
    console.log("Initializing sale campaign scheduler...");

    try {
      // Stop existing task if any
      this.stop();

      // Schedule task to run every minute
      this.task = cron.schedule(
        "* * * * *", // Every minute
        async () => {
          await this.checkAndExecuteCampaigns();
        },
        {
          scheduled: true,
          timezone: "Asia/Ho_Chi_Minh",
        }
      );

      this.isInitialized = true;
      console.log("Sale campaign scheduler initialized successfully");
      console.log("Scheduler will check for campaigns every minute");

      // Run immediately on startup
      await this.checkAndExecuteCampaigns();
    } catch (error) {
      console.error("Failed to initialize sale scheduler:", error);
      throw error;
    }
  }

  /**
   * Check and execute scheduled campaigns
   */
  private async checkAndExecuteCampaigns() {
    try {
      const now = new Date();
      console.log(`[${now.toISOString()}] Checking for scheduled campaigns...`);

      // Check for campaigns to apply
      await this.checkScheduledCampaigns(now);

      // Check for campaigns to revert
      await this.checkExpiredCampaigns(now);
    } catch (error) {
      console.error("Error checking campaigns:", error);
    }
  }

  /**
   * Check and apply scheduled campaigns
   */
  private async checkScheduledCampaigns(now: Date) {
    try {
      const campaignsToApply = await prisma.saleCampaign.findMany({
        where: {
          status: "SCHEDULED",
          scheduleType: "SCHEDULED",
          startDate: {
            lte: now,
          },
        },
      });

      if (campaignsToApply.length === 0) {
        return;
      }

      console.log(
        `Found ${campaignsToApply.length} campaigns ready to apply:`,
        campaignsToApply.map((c) => c.name)
      );

      for (const campaign of campaignsToApply) {
        try {
          console.log(`Applying scheduled campaign: ${campaign.name}`);

          const result = await saleService.applyCampaign(campaign.id);

          if (result.success) {
            console.log(
              `✓ Campaign "${campaign.name}" applied successfully. ${result.affectedCount} variants updated.`
            );
          } else {
            console.error(
              `✗ Campaign "${campaign.name}" failed to apply:`,
              result.errors
            );
          }
        } catch (error: any) {
          console.error(
            `Error applying campaign "${campaign.name}":`,
            error.message
          );

          // Update campaign status to FAILED
          await prisma.saleCampaign.update({
            where: { id: campaign.id },
            data: {
              status: "FAILED",
              errorMessage: error.message,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error checking scheduled campaigns:", error);
    }
  }

  /**
   * Check and revert expired campaigns
   */
  private async checkExpiredCampaigns(now: Date) {
    try {
      const campaignsToRevert = await prisma.saleCampaign.findMany({
        where: {
          status: "ACTIVE",
          endDate: {
            lte: now,
          },
        },
      });

      if (campaignsToRevert.length === 0) {
        return;
      }

      console.log(
        `Found ${campaignsToRevert.length} campaigns ready to revert:`,
        campaignsToRevert.map((c) => c.name)
      );

      for (const campaign of campaignsToRevert) {
        try {
          console.log(`Reverting expired campaign: ${campaign.name}`);

          const result = await saleService.revertCampaign(campaign.id);

          if (result.success) {
            console.log(
              `✓ Campaign "${campaign.name}" reverted successfully. ${result.revertedCount} variants restored.`
            );
          } else {
            console.error(
              `✗ Campaign "${campaign.name}" failed to revert:`,
              result.errors
            );
          }
        } catch (error: any) {
          console.error(
            `Error reverting campaign "${campaign.name}":`,
            error.message
          );

          // Update campaign with error but keep status ACTIVE
          await prisma.saleCampaign.update({
            where: { id: campaign.id },
            data: {
              errorMessage: `Revert failed: ${error.message}`,
            },
          });
        }
      }
    } catch (error) {
      console.error("Error checking expired campaigns:", error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isRunning: this.task !== null,
    };
  }

  /**
   * Stop scheduler
   */
  stop() {
    if (this.task) {
      console.log("Stopping sale campaign scheduler...");
      this.task.stop();
      this.task = null;
    }
    this.isInitialized = false;
  }

  /**
   * Manually trigger check (for testing)
   */
  async triggerCheck() {
    console.log("Manually triggering campaign check...");
    await this.checkAndExecuteCampaigns();
  }

  /**
   * Get upcoming scheduled campaigns
   */
  async getUpcomingCampaigns(limit: number = 10) {
    const now = new Date();

    const upcoming = await prisma.saleCampaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduleType: "SCHEDULED",
        startDate: {
          gt: now,
        },
      },
      orderBy: {
        startDate: "asc",
      },
      take: limit,
    });

    return upcoming;
  }

  /**
   * Get active campaigns with end dates
   */
  async getActiveCampaignsWithEndDate(limit: number = 10) {
    const now = new Date();

    const active = await prisma.saleCampaign.findMany({
      where: {
        status: "ACTIVE",
        endDate: {
          not: null,
          gt: now,
        },
      },
      orderBy: {
        endDate: "asc",
      },
      take: limit,
    });

    return active;
  }
}

// Singleton instance
export const saleScheduler = new SaleScheduler();
