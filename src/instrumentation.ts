// This file is automatically called by Next.js when the server starts
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server starting - initializing cron scheduler...');
    
    try {
      // Dynamic import to avoid issues
      const { cronScheduler } = await import('./lib/cron-scheduler');
      await cronScheduler.initialize();
      console.log('✅ Cron scheduler initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize cron scheduler:', error);
      // Don't throw - let the app continue even if cron fails
    }
  }
}
