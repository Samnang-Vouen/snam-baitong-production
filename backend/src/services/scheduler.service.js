const cron = require('node-cron');
const soilHealthService = require('./soilHealth.service');
const db = require('./mysql');
const mqttService = require('./mqtt.service');

// In-memory watering state to avoid duplicate triggers
let wateringActive = false;
let wateringTimer = null;
const WATERING_DURATION_MS = 100 * 1000; // 100 seconds

async function getFarmersWithSensors() {
  try {
    const rows = await db.query(
      `SELECT id, crop_type, sensor_devices, district_name, province_city
       FROM farmers
       WHERE sensor_devices IS NOT NULL AND TRIM(sensor_devices) <> ''`
    );
    return rows || [];
  } catch (err) {
    console.error('[Scheduler] Failed to fetch farmers with sensors:', err.message);
    return [];
  }
}

function parseDevices(sensorDevices) {
  if (!sensorDevices) return [];
  return String(sensorDevices)
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

async function checkAndIrrigate() {
  try {
    const farmers = await getFarmersWithSensors();
    if (!farmers.length) return;

    // Iterate through farmers; if any farmer’s moisture is below threshold, trigger watering
    for (const f of farmers) {
      const devices = parseDevices(f.sensor_devices);
      if (!devices.length) continue;

      // Query current soil health (latest values) for farmer’s devices
      const health = await soilHealthService.getCurrentSoilHealth(devices, null);
      if (!health || !health.success) continue;

      const moisture = health.values?.moisture;
      if (moisture == null) continue;

      // Crop-dependent threshold; default to 20% if crop not mapped
      const cropType = (f.crop_type || 'general').toLowerCase();
      const ranges = soilHealthService.CROP_RANGES[cropType] || soilHealthService.CROP_RANGES.general;
      const cropMin = ranges?.moisture?.optimal?.min;
      const threshold = Number.isFinite(cropMin) ? cropMin : 20;

      if (moisture < threshold) {
        // Trigger watering if not already active
        if (!wateringActive) {
          wateringActive = true;
          console.log(`[Scheduler] Moisture ${moisture.toFixed?.(2) ?? moisture}% < ${threshold}%. Triggering water pump ON for 100s.`);
          try {
            await mqttService.publishPump('water', true);
          } catch (err) {
            console.error('[Scheduler] Failed to publish water ON:', err.message);
            wateringActive = false;
            continue;
          }

          // Schedule auto OFF after duration
          if (wateringTimer) {
            try { clearTimeout(wateringTimer); } catch (_) {}
          }
          wateringTimer = setTimeout(async () => {
            try {
              await mqttService.publishPump('water', false);
              console.log('[Scheduler] Auto OFF: Water pump stopped after 100s.');
            } catch (err) {
              console.error('[Scheduler] Failed to publish water OFF:', err.message);
            } finally {
              wateringActive = false;
              wateringTimer = null;
            }
          }, WATERING_DURATION_MS);
        }
        // Once one farmer triggers watering, we can stop scanning further to avoid redundant triggers
        break;
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error in checkAndIrrigate:', error);
  }
}

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

  // Every 5 minutes: monitor moisture and trigger automatic watering
  cron.schedule('*/5 * * * *', () => {
    // Avoid overlapping runs; defer to next tick to keep cron callback light
    setImmediate(() => {
      checkAndIrrigate();
    });
  }, { timezone: "Asia/Bangkok" });

  console.log('[Scheduler] Initialized - Daily cache @1:30 AM; watering check every 5 minutes');
}

module.exports = {
  initScheduler
};
