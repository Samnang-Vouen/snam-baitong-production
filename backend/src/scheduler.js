require('dotenv').config();
const { initScheduler } = require('./services/scheduler.service');

console.log('--------------------------------------------------');
console.log('🗓️  SnamBaitong Scheduler: starting...');
console.log(`🛠  Environment   : ${String(process.env.NODE_ENV || 'development')}`);
console.log('--------------------------------------------------');

// Initialize the scheduler jobs (cron tasks)
initScheduler();

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Scheduler stopping (SIGINT)');
  process.exit(0);
});
process.once('SIGTERM', () => {
  console.log('🛑 Scheduler stopping (SIGTERM)');
  process.exit(0);
});
