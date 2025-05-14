import dotenv from 'dotenv';
import scheduler from './scheduler';

// Load environment variables
dotenv.config();

console.log('Starting Trump Tracker Bot...');

// Start the scheduler
scheduler.start();

// Handle process termination
process.on('SIGINT', () => {
  console.log('Trump Tracker Bot is shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Trump Tracker Bot is shutting down...');
  process.exit(0);
});

console.log('Trump Tracker Bot is running. Press CTRL+C to stop.'); 