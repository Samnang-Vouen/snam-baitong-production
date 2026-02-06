// Prefer .env.local if present, otherwise fall back to .env
const path = require('path');
const fs = require('fs');
(() => {
  const localPath = path.resolve(__dirname, '../.env.local');
  const defaultPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(localPath)) {
    require('dotenv').config({ path: localPath });
  } else {
    require('dotenv').config({ path: defaultPath });
  }
})();
const createApp = require('./app');
const { seedPredefinedAdmins } = require('./scripts/seed-admins');
let sqlService;
try {
  sqlService = require('./services/mysql');
} catch (e) {
  console.error('\nFailed to initialize MySQL service.');
  console.error(e.message);
  process.exit(1);
}

// Initialize MQTT connection (uses mock client if DISABLE_MQTT=true)
const mqttService = require('./services/mqtt.service');
mqttService.init();

const app = createApp();
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 3000 : 5000);
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0');

// Initialize MySQL auth-related schema and (optionally) seed predefined admins
const { initSchema } = require('./services/user.service');
const { initCommentsSchema } = require('./controllers/comments.controller');
(async () => {
  try {
    await initSchema();
    await initCommentsSchema();

    // Optional: seed initial admin accounts (DO NOT enable in production unless you intend to)
    if (String(process.env.SEED_ADMINS_ON_STARTUP || '').toLowerCase() === 'true') {
      await seedPredefinedAdmins();
    }
  } catch (e) {
    console.error('Failed to initialize auth schema/seed:', e.message);
  }
})();

const server = app.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`InfluxDB URL: ${process.env.INFLUXDB_URL}`);
  console.log(`Database: ${process.env.INFLUXDB_DATABASE || process.env.INFLUXDB_BUCKET}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /api/sensors/latest - Latest readings`);
  console.log(`   GET  /api/dashboard - Dashboard data`);
  console.log(`   POST /api/plants - Create plant metadata (admin)`);
  console.log(`   POST /api/qr/generate - Generate QR for plant`);
  console.log(`   GET  /api/qr/scan/:token - Public aggregated view`);
  console.log(`   POST /api/auth/login - Login with email/password`);
  console.log(`   POST /api/auth/logout - Logout (revoke token)`);
  console.log(`   GET  /api/users - List users (admin)`);
  console.log(`   POST /api/users - Create user (admin)`);
  console.log(`   GET  /api/comments - List comments`);
  console.log(`   POST /api/comments - Add comment`);
  console.log(`\nMQTT: ${mqttService.status().mocked ? 'mocked (disabled)' : (mqttService.status().connected ? 'connected' : 'connecting...')} | Pump topic: ${mqttService.status().pumpTopic}`);

  // Optionally launch Telegram bot as part of backend
  const enableBot = String(process.env.ENABLE_TELEGRAM_BOT || 'true').toLowerCase() === 'true';
  if (enableBot) {
    try {
      const botInstance = require('./bot'); // Will launch if TELEGRAM_TOKEN is set
      if (botInstance) {
        console.log('Telegram bot initialized from backend.');
      } else {
        console.log('Telegram bot not started (missing TELEGRAM_TOKEN).');
      }
    } catch (e) {
      console.error('Failed to initialize Telegram bot:', e.message);
    }
  } else {
    console.log('Telegram bot launch disabled (ENABLE_TELEGRAM_BOT=false).');
  }
});

function shutdown(signal) {
  console.log(`${signal} signal received: closing HTTP server`);
  try {
    if (sqlService && typeof sqlService.close === 'function') {
      sqlService.close();
    }
    if (mqttService && typeof mqttService.close === 'function') {
      mqttService.close();
    }
  } catch (e) {
    console.error('Error during service shutdown:', e);
  }
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
