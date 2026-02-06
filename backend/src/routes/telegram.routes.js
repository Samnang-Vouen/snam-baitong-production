const express = require('express');
const router = express.Router();
const telegram = require('../controllers/telegram.controller');

// Send a message: POST /api/telegram/send
// Body: { text: string, chatId?: string, parseMode?: 'Markdown'|'HTML', disableNotification?: boolean }
router.post('/send', telegram.send);

// Inspect recent updates: GET /api/telegram/updates?limit=5
router.get('/updates', telegram.updates);

// Send latest sensor data to a chat
router.post('/send-latest', telegram.sendLatest);

// Telegram webhook endpoint to handle /update command
router.post('/webhook', telegram.webhook);
// Optional GET handler to avoid 404s from health checks or misrouted requests
router.get('/webhook', (req, res) => res.json({ ok: true }));

// Verification and bot data endpoints
// POST /api/telegram/verify - Verify phone against farmers and bind Telegram user
router.post('/verify', telegram.verify);
// GET /api/telegram/verify/check - Check verification status for a Telegram user
router.get('/verify/check', telegram.checkVerified);
// GET /api/telegram/status - Latest sensor status for verified Telegram user
router.get('/status', telegram.statusForTelegram);
// Weather proxy for Telegram bot
router.get('/weather', telegram.weatherForTelegram);

module.exports = router;
