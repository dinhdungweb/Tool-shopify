// Initialize Cron Scheduler on App Start
import { cronScheduler } from './cron-scheduler';

let isInitialized = false;

export async function initializeScheduler() {
  if (isInitialized) {
    console.log('Scheduler already initialized');
    return;
  }

  try {
    console.log('Initializing auto sync scheduler...');
    await cronScheduler.initialize();
    isInitialized = true;
    console.log('Auto sync scheduler initialized successfully');
  } catch (error) {
    console.error('Failed to initialize scheduler:', error);
    // Don't throw - allow app to continue even if scheduler fails
  }
}

// Auto-initialize in production
if (process.env.NODE_ENV === 'production') {
  initializeScheduler();
}
