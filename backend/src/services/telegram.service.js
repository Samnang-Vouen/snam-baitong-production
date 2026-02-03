const axios = require('axios');
const { token, defaultChatId } = require('../config/telegram');

function getBaseUrl() {
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set. Add it to environment or .env');
  }
  return `https://api.telegram.org/bot${token}`;
}

async function sendMessage({ chatId, text, parseMode, disableNotification = false }) {
  if (!text || typeof text !== 'string') {
    throw new Error('text is required and must be a string');
  }
  const cid = chatId || defaultChatId;
  if (!cid) {
    throw new Error('chatId is required (set TELEGRAM_CHAT_ID env or pass in request)');
  }
  const url = `${getBaseUrl()}/sendMessage`;
  const payload = {
    chat_id: cid,
    text,
    disable_notification: !!disableNotification,
  };
  if (parseMode) {
    payload.parse_mode = parseMode;
  }
  const res = await axios.post(url, payload, { timeout: 10000 });
  if (!res.data || res.data.ok !== true) {
    const msg = (res.data && res.data.description) ? res.data.description : 'Telegram API error';
    const err = new Error(msg);
    err.response = res.data;
    throw err;
  }
  return res.data.result;
}

async function getUpdates(limit = 5) {
  const url = `${getBaseUrl()}/getUpdates`;
  const res = await axios.get(url, { params: { limit }, timeout: 10000 });
  return res.data;
}

module.exports = {
  sendMessage,
  getUpdates,
};
