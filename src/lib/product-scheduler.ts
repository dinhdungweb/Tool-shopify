// Product Cron Scheduler for Auto Sync
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class ProductScheduler {
  private task: cron.ScheduledTask | null = null;
  private isInitialized = false;

  // Initialize scheduler with config from database
  async initialize() {
    console.log('Initializing product sync scheduler...');

    try {
      // Stop existing task if any
      this.stopAll();

      // Get config from database
      let config = await prisma.syncSchedule.findUnique({
        where: { id: 'product_auto_sync' },
      });

      // Create default config if not exists
      if (!config) {
        config = await prisma.syncSchedule.create({
          data: {
            id: 'product_auto_sync',
            enabled: false,
            schedule: '0 */6 * * *', // Every 6 hours by default
            type: 'PRODUCT',
          },
        });
      }

      console.log('Product sync config:', config);

      // Schedule if enabled
      if (config.enabled) {
        this.scheduleProductSync(config.schedule);
      } else {
        console.log('Product auto sync is disabled');
      }

      this.isInitialized = true;
      console.log('Product sync scheduler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize product sync scheduler:', error);
      throw error;
    }
  }

  // Schedule product sync task
  scheduleProductSync(cronExpression: string) {
    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Stop existing task if any
      this.stopAll();

      // Create new scheduled task
      this.task = cron.schedule(
        cronExpression,
        async () => {
          console.log('Running scheduled product sync...');
          await this.executeProductSync();
        },
        {
          scheduled: true,
          timezone: 'Asia/Ho_Chi_Minh', // Vietnam timezone
        }
      );

      console.log(`Product sync scheduled with cron: ${cronExpression}`);
    } catch (error) {
      console.error('Failed to schedule product sync:', error);
      throw error;
    }
  }

  // Execute product sync (sync all SYNCED product mappings)
  private async executeProductSync() {
    try {
      console.log('Executing product auto sync...');

      // Call the auto-sync API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/products/auto-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log('Product auto sync completed:', result.results);
      } else {
        console.error('Product auto sync failed:', result.error);
      }
    } catch (error) {
      console.error('Error executing product sync:', error);
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isScheduled: this.task !== null,
    };
  }

  // Stop all scheduled tasks
  stopAll() {
    if (this.task) {
      console.log('Stopping product scheduled task...');
      this.task.stop();
      this.task = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
export const productScheduler = new ProductScheduler();
