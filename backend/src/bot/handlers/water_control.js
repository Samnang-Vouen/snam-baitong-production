/**
 * HANDLER: Irrigation Control
 * Location: src/bot/handlers/water_control.js
 */
const MenuService = require('../menus');
const dbService = require('../../services/db.service');
// In a real IoT project, this service handles MQTT or HTTP requests to the ESP32
const deviceService = require('../../services/device.service'); 
const mqttService = require('../../services/mqtt.service');
const sensorsService = require('../../services/sensors.service');
const api = require('../../services/api.service');
const db = require('../../services/mysql');

const CONTROL_MODE = String(process.env.BOT_PUMP_CONTROL_MODE || 'MQTT').toUpperCase();

async function handleControl(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    
    if (ctx.callbackQuery) {
        await ctx.answerCbQuery(isKhmer ? "⌛️ កំពុងដំណើរការ..." : "⏳ In progress...").catch(() => {});
    }

    const currentStatus = ctx.session.pump_is_on || false;
    const stopAt = ctx.session.pump_stop_time || null;
    
    // UI Logic from menus.js
    const { text, keyboard } = MenuService.getControlMenu(
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
            console.error("❌ Control UI Error:", error);
        }
    }
}

async function handlePumpToggle(ctx) {
    const data = ctx.callbackQuery.data; // "pump_on" or "pump_stop"
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
        return handleControl(ctx);
    }
    
    await ctx.answerCbQuery(isKhmer ? "⏳ កំពុងបញ្ជាម៉ូទ័រទឹក..." : "⏳ Controlling water pump...");

    let targetOn, logKh, logEn, stopTimeString = null;

    if (data === "pump_on") {
        targetOn = true;
        
        // Calculate stop time using the constant for scalability
        const now = new Date();
        const durationMs = MenuService.MAX_PUMP_TIME_MINS * 60 * 1000;
        const stopTime = new Date(now.getTime() + durationMs);
        
        stopTimeString = stopTime.toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Phnom_Penh' 
        });
        
        logKh = `បានបើកម៉ូទ័រទឹក (រយៈពេល ${MenuService.MAX_PUMP_TIME_MINS} នាទី)`;
        logEn = `Pump Turned ON (${MenuService.MAX_PUMP_TIME_MINS} mins limit)`;
    } else {
        targetOn = false;
        stopTimeString = null; // Clear the timer when stopped manually
        logKh = "បានបិទម៉ូទ័រទឹក";
        logEn = "Pump Turned OFF";
    }

    try {
        // Prefer MQTT for remote control; fallback to HTTP gateway when explicitly configured
        if (CONTROL_MODE === 'MQTT') {
            try { mqttService.init(); } catch (_) {}
            await mqttService.publishPump('water', targetOn);
            ctx.session.pump_is_on = targetOn;
            ctx.session.pump_stop_time = stopTimeString;
            await dbService.saveLog(deviceId, "PUMP", logKh, logEn);
            return handleControl(ctx);
        } else {
            // --- HTTP Gateway path (requires IOT_GATEWAY_URL reachable from backend) ---
            const result = await deviceService.sendCommand(deviceId, 'pump', targetOn ? 'ON' : 'OFF');
            if (result && result.success) {
                ctx.session.pump_is_on = targetOn;
                ctx.session.pump_stop_time = stopTimeString;
                await dbService.saveLog(deviceId, "PUMP", logKh, logEn);
                return handleControl(ctx);
            }
            throw new Error("Device offline or rejected command");
        }
    } catch (error) {
        console.error("🔥 Pump Control Failed:", error);
        const failMsg = isKhmer 
            ? "⚠️ ឧបករណ៍មិនឆ្លើយតប ឬបាត់ការតភ្ជាប់" 
            : "⚠️ Device not responding or disconnected";
        return ctx.reply(failMsg);
    }
}

module.exports = { handleControl, handlePumpToggle };