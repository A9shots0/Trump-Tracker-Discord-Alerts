import cron from 'node-cron';
import dotenv from 'dotenv';
import truthSocialService from './truthSocialService';

dotenv.config();

class Scheduler {
  private interval: number;

  constructor() {
    this.interval = parseInt(process.env.POLL_INTERVAL_MINUTES || '5', 10);
    if (isNaN(this.interval) || this.interval < 1) {
      console.warn('Invalid POLL_INTERVAL_MINUTES, defaulting to 5 minutes');
      this.interval = 5;
    }
  }

  start(): void {
    console.log(`Starting scheduler with ${this.interval} minute interval`);
    
    // Schedule Truth Social polling
    const cronExpression = `*/${this.interval} * * * *`; // Run every X minutes
    cron.schedule(cronExpression, async () => {
      console.log('Polling Truth Social for new posts...');
      await truthSocialService.fetchLatestPosts();
    });

    // Run immediately on startup
    this.runInitialPolling();
  }

  private async runInitialPolling(): Promise<void> {
    try {
      console.log('Running initial polling...');
      
      // Add a small delay to make sure Discord client is ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Run initial checks with single post limit and force processing
      console.log('Fetching initial Truth Social post...');
      await truthSocialService.fetchLatestPosts(1, true);
      
      console.log('Initial polling complete');
    } catch (error) {
      console.error('Error during initial polling:', error);
    }
  }
}

export default new Scheduler(); 