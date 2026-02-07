/**
 * HANDLER: Soil Status Dashboard
 * Location: src/bot/handlers/status.js
 * Scalable & Direct Service Wiring
 */
const MenuService = require('../menus');
const api = require('../../services/api.service'); 
const sensorsService = require('../../services/sensors.service');
const db = require('../../services/mysql');

// Scalable constant for default device
const DEFAULT_DEVICE_ID = process.env.BOT_DEFAULT_DEVICE_ID || "DEMO001";

async function handleStatus(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    const deviceId = ctx.session?.deviceId || DEFAULT_DEVICE_ID;

    // 1. UX Feedback: Immediate Toast (Prevents farmer from double-tapping)
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery(
            isKhmer ? "⌛️ កំពុងទាញយកទិន្នន័យ..." : "⌛️ Fetching data..."
        ).catch(() => {});
    }

    // 2. Backend Bridge: Query via backend API (no direct Influx)
    let sensorData = null;
    try {
        const res = await api.getStatusForTelegram({ telegramUserId: ctx.from?.id, chatId: ctx.chat?.id });
        if (res && res.success) {
            sensorData = res.data || null;
        }
    } catch (error) {
        console.error("🔥 Backend Status Fetch Failed:", error);
    }

    // 3. Format & Deliver using MenuService
    // formatStatusMessage now includes the UXUI sections (1. General, 2. Nutrients, 3. Quality, 4. Crop Management)
    const dashboardText = MenuService.formatStatusMessage(sensorData, isKhmer, ctx);
    const keyboard = MenuService.getStatusKeyboard(isKhmer);

    // 4. Reliable UI Delivery
    try {
        if (ctx.callbackQuery) {
            // SKEPTICAL FIX: In Node.js Telegraf, we must pass the inner reply_markup 
            // when using editMessageText to ensure buttons render correctly.
            await ctx.editMessageText(dashboardText, {
                reply_markup: keyboard.reply_markup,
                parse_mode: 'Markdown'
            });
        } else {
            // Standard reply for text commands like /status
            await ctx.replyWithMarkdown(dashboardText, { reply_markup: keyboard.reply_markup });
        }
    } catch (error) {
        // Ignore "Message is not modified" errors if data hasn't changed since last click
        if (error.description && error.description.includes("message is not modified")) {
            return;
        }
        console.error("❌ UI Update Error in handleStatus:", error);
    }
}

async function openDevicePicker(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    try {
        const telegramUserId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const verified = await api.checkVerified({ telegramUserId, chatId });
        if (!(verified?.success && verified?.verified && verified?.farmer?.id)) {
            return ctx.answerCbQuery(isKhmer ? '❌ មិនអាចទាញយកឧបករណ៍' : '❌ Unable to load devices').catch(() => {});
        }
        const farmerId = verified.farmer.id;
        const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
        const farmer = Array.isArray(farmerRows) && farmerRows.length ? farmerRows[0] : null;
        let devices = [];
        try {
            const sensors = await sensorsService.getFarmerSensors(farmerId);
            devices = sensors.map(s => s.device_id).filter(Boolean);
        } catch (_) {
            if (farmer?.sensor_devices) {
                devices = String(farmer.sensor_devices).split(',').map(d => d.trim()).filter(Boolean);
            }
        }
        const selected = ctx.session?.deviceId || null;
        const { text, keyboard } = MenuService.getDevicePickerMenu(isKhmer, devices, selected);
        await ctx.answerCbQuery().catch(() => {});
        return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' }).catch(() => {});
    } catch (error) {
        console.error('🔥 Device Picker Error:', error);
        return ctx.answerCbQuery(isKhmer ? '❌ កំហុសបង្ហាញឧបករណ៍' : '❌ Failed to show devices').catch(() => {});
    }
}

async function setDevice(ctx) {
    const data = ctx.callbackQuery?.data || '';
    const isKhmer = ctx.session?.is_khmer !== false;
    if (!data.startsWith('dev_')) return;
    const deviceId = data.slice(4);
    ctx.session.deviceId = deviceId;
    await ctx.answerCbQuery(isKhmer ? '✅ បានជ្រើសរើសឧបករណ៍' : '✅ Device selected').catch(() => {});
    // Refresh status view with selected device context
    return handleStatus(ctx);
}

module.exports = { handleStatus, openDevicePicker, setDevice };