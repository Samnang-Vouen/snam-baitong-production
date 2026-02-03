require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const defaultChatId = process.env.TELEGRAM_CHAT_ID || '';

if (!token) {
  console.warn('Warning: TELEGRAM_BOT_TOKEN not set');
}

module.exports = {
  token,
  defaultChatId
};
