const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error('Missing TELEGRAM_BOT_TOKEN in environment.');
    process.exit(1);
  }
  const tg = `https://api.telegram.org/bot${token}`;
  try {
    const res = await axios.get(`${tg}/getWebhookInfo`, { timeout: 10000 });
    console.log('getWebhookInfo:', res.data);
  } catch (e) {
    console.error('Failed to get webhook info:', e.response?.data || e.message);
    process.exit(1);
  }
}

main();
