const axios = require('axios');

// Backend base URL for bot API calls
// Defaults to local dev server on port 5000
const BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:5000';

async function verifyPhone({ telegramUserId, chatId, phoneNumber }) {
  const url = `${BASE_URL}/api/telegram/verify`;
  const { data } = await axios.post(url, { telegramUserId, chatId, phoneNumber });
  return data;
}

async function getStatusForTelegram({ telegramUserId, chatId }) {
  const url = `${BASE_URL}/api/telegram/status`;
  const params = {};
  if (telegramUserId) params.telegramUserId = telegramUserId;
  if (chatId) params.chatId = chatId;
  const { data } = await axios.get(url, { params });
  return data;
}

async function checkVerified({ telegramUserId, chatId }) {
  const url = `${BASE_URL}/api/telegram/verify/check`;
  const params = {};
  if (telegramUserId) params.telegramUserId = telegramUserId;
  if (chatId) params.chatId = chatId;
  const { data } = await axios.get(url, { params });
  return data;
}

async function getWeather({ lat, lon, telegramUserId, chatId }) {
  const url = `${BASE_URL}/api/telegram/weather`;
  const params = {};
  if (lat !== undefined) params.lat = lat;
  if (lon !== undefined) params.lon = lon;
  if (telegramUserId) params.telegramUserId = telegramUserId;
  if (chatId) params.chatId = chatId;
  const { data } = await axios.get(url, { params });
  return data;
}

async function getFarmerWeeklySoilHealth({ farmerId }) {
  const url = `${BASE_URL}/api/soil-health/farmer/${farmerId}/weekly`;
  const { data } = await axios.get(url);
  return data;
}

module.exports = {
  verifyPhone,
  getStatusForTelegram,
  checkVerified,
  getWeather,
  getFarmerWeeklySoilHealth
};