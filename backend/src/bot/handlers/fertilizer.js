/**
 * HANDLER: Fertilizer Control & Advice
 * Location: src/bot/handlers/fertilizer.js
 */
const MenuService = require('../menus');
const { logEvent, CAT } = require('./logbook');
// Wire to the same device service used by the pump
const deviceService = require('../../services/device.service'); 
const mqttService = require('../../services/mqtt.service');
const sensorsService = require('../../services/sensors.service');
const api = require('../../services/api.service');
const db = require('../../services/mysql');

const CONTROL_MODE = String(process.env.BOT_PUMP_CONTROL_MODE || 'MQTT').toUpperCase();

async function handleFertilizer(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery(isKhmer ? "⌛️កំពុងដំណើរការ..." : "⏳ In progress...").catch(() => {});
    }

    const currentStatus = ctx.session.fert_is_on || false;
    const stopAt = ctx.session.fert_stop_time || null;
    
    // UI logic from menus.js
    const { text, keyboard } = MenuService.getFertilizerMenu(
        isKhmer, 
        currentStatus, 
        stopAt
    );

    try {
        if (ctx.callbackQuery) {
            await ctx.editMessageText(text, { 
                reply_markup: keyboard.reply_markup, 
                parse_mode: 'Markdown' 
            });
        } else {
            await ctx.replyWithMarkdown(text, keyboard);
        }
    } catch (error) {
        if (!error.description?.includes("message is not modified")) {
            console.error("❌ Fertilizer UI Error:", error);
        }
    }
}

async function handleFertToggle(ctx) {
    const data = ctx.callbackQuery.data; // "fert_on" or "fert_stop"
    const isKhmer = ctx.session?.is_khmer !== false;
    let deviceId = ctx.session?.deviceId || null;
    if (!deviceId) {
        try {
            const telegramUserId = ctx.from?.id;
            const chatId = ctx.chat?.id;
            const verified = await api.checkVerified({ telegramUserId, chatId });
            if (verified?.success && verified?.verified && verified?.farmer?.id) {
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
                deviceId = devices[0] || null;
                if (deviceId) ctx.session.deviceId = deviceId;
            }
        } catch (_) {}
    }
    if (!deviceId) {
        const msg = isKhmer ? '🔒 សូមផ្ទៀងផ្ទាត់ និងកំណត់ឧបករណ៍' : '🔒 Please verify and assign a device';
        await ctx.answerCbQuery(msg).catch(() => {});
        return handleFertilizer(ctx);
    }
    
    await ctx.answerCbQuery(isKhmer ? "⏳ កំពុងបញ្ជាម៉ូទ័រជី..." : "⏳ Controlling fertilizer pump...");

    let targetOn, logKh, logEn, stopTimeString = null;

    if (data === "fert_on") {
        targetOn = true;
        
        // Calculate stop time using Scalable Constant from MenuService
        const now = new Date();
        const durationMs = (MenuService.MAX_FERT_TIME_MINS || 15) * 60 * 1000;
        const stopTime = new Date(now.getTime() + durationMs);
        
        stopTimeString = stopTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' 
        });
        
        logKh = `បានបើកការដាក់ជី (រយៈពេល ${MenuService.MAX_FERT_TIME_MINS} នាទី)`;
        logEn = `Fertilizer Started (${MenuService.MAX_FERT_TIME_MINS} mins limit)`;
    } else {
        targetOn = false;
        stopTimeString = null; // Reset timer on manual stop
        logKh = "បានបិទការដាក់ជី";
        logEn = "Fertilizer Stopped";
    }

    try {
        if (CONTROL_MODE === 'MQTT') {
            try { mqttService.init(); } catch (_) {}
            await mqttService.publishPump('fert', targetOn);
            ctx.session.fert_is_on = targetOn;
            ctx.session.fert_stop_time = stopTimeString;
            await ctx.answerCbQuery(isKhmer ? "✅ រួចរាល់!" : "✅ Command Sent!");
            await logEvent(deviceId, CAT.FERT, logKh, logEn);
            return handleFertilizer(ctx);
        } else {
            // HTTP gateway path
            const result = await deviceService.sendCommand(deviceId, 'fertilizer', targetOn ? 'ON' : 'OFF');
            if (result && result.success) {
                ctx.session.fert_is_on = targetOn;
                ctx.session.fert_stop_time = stopTimeString;
                await ctx.answerCbQuery(isKhmer ? "✅ រួចរាល់!" : "✅ Command Sent!");
                await logEvent(deviceId, CAT.FERT, logKh, logEn);
                return handleFertilizer(ctx);
            }
            throw new Error("Hardware Timeout");
        }
    } catch (error) {
        console.error("🔥 Fertilizer Control Failed:", error);
        const failMsg = isKhmer ? "⚠️ ឧបករណ៍មិនឆ្លើយតប" : "⚠️ Device not responding";
        return ctx.reply(failMsg);
    }
}

module.exports = { handleFertilizer, handleFertToggle };