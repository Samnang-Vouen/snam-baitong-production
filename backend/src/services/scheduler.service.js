const cron = require('node-cron');
const soilHealthService = require('./soilHealth.service');

let initialized = false;

/**
 * Schedule cache clearing at 1AM daily
 * This ensures fresh crop safety calculations after daily sensor snapshots
 */
function initScheduler() {
  if (initialized) return;
  initialized = true;
  // Run at 1:30 AM every day (after sensors send daily data at 1AM)
  cron.schedule('30 1 * * *', () => {
    console.log('[Scheduler] Running daily cache clear at 1:30 AM');
    try {
      const result = soilHealthService.clearCropSafetyCache();
      console.log(`[Scheduler] Cache cleared successfully: ${result.cleared} entries`);
    } catch (error) {
      console.error('[Scheduler] Error clearing cache:', error);
    }
  }, {
    timezone: "Asia/Bangkok" // Adjust to your timezone
  });

  console.log('[Scheduler] Initialized - Cache will clear daily at 1:30 AM');
}

module.exports = {
  initScheduler
};
