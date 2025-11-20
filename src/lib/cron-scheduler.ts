// Cron Scheduler for Auto Sync
import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

class CronScheduler {
  private task: cron.ScheduledTask | null = null;
  private isInitialized = false;

  // Initialize scheduler with global config
  async initialize() {
    console.log('Initializing global cron scheduler...');

    try {
      // Stop existing task if any
      this.stopAll();

      // Get global config
      let config = await prisma.autoSyncConfig.findUnique({
        where: { id: 'global' },
      });

      // Create default config if not exists
      if (!config) {
        config = await prisma.autoSyncConfig.create({
          data: {
            id: 'global',
            enabled: false,
            schedule: '0 */6 * * *',
          },
        });
      }

      console.log('Global config:', config);

      // Schedule if enabled
      if (config.enabled) {
        this.scheduleGlobalSync(config.schedule);
      } else {
        console.log('Global auto sync is disabled');
      }

      this.isInitialized = true;
      console.log('Cron scheduler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cron scheduler:', error);
      throw error;
    }
  }

  // Schedule global sync task
  scheduleGlobalSync(cronExpression: string) {
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
          console.log('Running scheduled global sync...');
          await this.executeGlobalSync();
        },
        {
          scheduled: true,
          timezone: 'Asia/Ho_Chi_Minh', // Vietnam timezone
        }
      );

      console.log(`Global sync scheduled with cron: ${cronExpression}`);
    } catch (error) {
      console.error('Failed to schedule global sync:', error);
      throw error;
    }
  }

  // Execute global sync (sync all SYNCED mappings)
  private async executeGlobalSync() {
    try {
      console.log('Executing global auto sync...');

      // Call the auto-sync API
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/sync/auto-sync`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (result.success) {
        console.log('Global auto sync completed:', result.results);
      } else {
        console.error('Global auto sync failed:', result.error);
      }
    } catch (error) {
      console.error('Error executing global sync:', error);
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
      console.log('Stopping global scheduled task...');
      this.task.stop();
      this.task = null;
    }
    this.isInitialized = false;
  }
}

// Singleton instance
export const cronScheduler = new CronScheduler();

// Helper function to validate cron expression
export function validateCronExpression(expression: string): boolean {
  return cron.validate(expression);
}

// Common cron expressions
export const CRON_PRESETS = {
  EVERY_HOUR: '0 * * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_2AM: '0 2 * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  WEEKLY_SUNDAY: '0 0 * * 0',
  MONTHLY: '0 0 1 * *',
};

export const CRON_PRESET_LABELS = {
  [CRON_PRESETS.EVERY_HOUR]: 'Mỗi giờ',
  [CRON_PRESETS.EVERY_2_HOURS]: 'Mỗi 2 giờ',
  [CRON_PRESETS.EVERY_6_HOURS]: 'Mỗi 6 giờ',
  [CRON_PRESETS.EVERY_12_HOURS]: 'Mỗi 12 giờ',
  [CRON_PRESETS.DAILY_2AM]: 'Hàng ngày lúc 2h sáng',
  [CRON_PRESETS.DAILY_MIDNIGHT]: 'Hàng ngày lúc 0h',
  [CRON_PRESETS.WEEKLY_SUNDAY]: 'Hàng tuần (Chủ nhật)',
  [CRON_PRESETS.MONTHLY]: 'Hàng tháng (ngày 1)',
};
