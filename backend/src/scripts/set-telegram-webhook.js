const path = require('path');
const fs = require('fs');
const axios = require('axios');
// Prefer .env.local if present, otherwise fall back to .env
(() => {
  const localPath = path.resolve(__dirname, '../../.env.local');
  const defaultPath = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(localPath)) {
    require('dotenv').config({ path: localPath });
  } else {
    require('dotenv').config({ path: defaultPath });
  }
})();

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('Missing TELEGRAM_BOT_TOKEN in environment.');
    process.exit(1);
  }
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error('Usage: node set-telegram-webhook.js <public_base_url>');
    console.error('Example: node set-telegram-webhook.js https://abcd.ngrok-free.app');
    process.exit(1);
  }
  const webhookUrl = `${baseUrl.replace(/\/$/, '')}/api/telegram/webhook`;
  const tg = `https://api.telegram.org/bot${token}`;
  try {
    const res = await axios.post(`${tg}/setWebhook`, { url: webhookUrl }, { timeout: 10000 });
    console.log('setWebhook response:', res.data);
  } catch (e) {
    console.error('Failed to set webhook:', e.response?.data || e.message);
    process.exit(1);
  }
}

main();
