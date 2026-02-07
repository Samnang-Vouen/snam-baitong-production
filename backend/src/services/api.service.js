const axios = require('axios');

// Backend base URL for bot API calls
// Defaults based on environment: prod=3000, dev=5000
const DEFAULT_PORT = (process.env.NODE_ENV === 'production') ? 3000 : 5000;
const BASE_URL = process.env.BACKEND_BASE_URL || `http://127.0.0.1:${DEFAULT_PORT}`;

async function verifyPhone({ telegramUserId, chatId, phoneNumber }) {
  // Backward compatible alias for OTP request
  return requestOtp({ telegramUserId, chatId, phoneNumber });
}

async function requestOtp({ telegramUserId, chatId, phoneNumber }) {
  const url = `${BASE_URL}/api/telegram/verify/request-otp`;
  try {
    const { data } = await axios.post(url, { telegramUserId, chatId, phoneNumber });
    return data;
  } catch (e) {
    return (e && e.response && e.response.data) ? e.response.data : { success: false, error: 'OTP request failed' };
  }
}

async function confirmOtp({ telegramUserId, chatId, phoneNumber, otp }) {
  const url = `${BASE_URL}/api/telegram/verify/confirm-otp`;
  try {
    const { data } = await axios.post(url, { telegramUserId, chatId, phoneNumber, otp });
    return data;
  } catch (e) {
    return (e && e.response && e.response.data) ? e.response.data : { success: false, error: 'OTP confirmation failed' };
  }
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
  requestOtp,
  confirmOtp,
  getStatusForTelegram,
  checkVerified,
  getWeather,
  getFarmerWeeklySoilHealth
};