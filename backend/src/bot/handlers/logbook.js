/**
 * HANDLER: Farm Logbook (History)
 * Location: src/bot/handlers/logbook.js
 */
const MenuService = require('../menus');
const dbService = require('../../services/db.service');
const api = require('../../services/api.service');
const sensorsService = require('../../services/sensors.service');
const db = require('../../services/mysql');

const CAT = {
    PUMP: "PUMP",
    FERT: "FERT",
    SOIL: "SOIL",
    ALERT: "ALERT",
    SYSTEM: "SYSTEM"
};
const DEFAULT_DEVICE_ID = null; // Do not use demo fallback for log events

// Reality Guard: Ensures we don't look for Week 5 in a month with only 4 weeks
function getMaxWeeks(month, year) {
    const lastDay = new Date(year, month, 0).getDate();
    return Math.ceil(lastDay / 7);
}

async function resolveDeviceId(ctx) {
    if (ctx.session?.deviceId) return ctx.session.deviceId;

    try {
        const telegramUserId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const verified = await api.checkVerified({ telegramUserId, chatId });
        if (!(verified?.success && verified?.verified && verified?.farmer?.id)) return null;

        const farmerId = verified.farmer.id;
        const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
        const farmer = Array.isArray(farmerRows) && farmerRows.length ? farmerRows[0] : null;

        let devices = [];
        try {
            const sensors = await sensorsService.getFarmerSensors(farmerId);
            devices = sensors.map(s => s.device_id).filter(Boolean);
        } catch (_) {}

        if (!devices.length && farmer?.sensor_devices) {
            devices = String(farmer.sensor_devices).split(',').map(d => d.trim()).filter(Boolean);
        }

        const deviceId = devices[0] || null;
        if (deviceId) {
            ctx.session.deviceId = deviceId;
            ctx.session.deviceIds = devices;
        }
        return deviceId;
    } catch (_) {
        return null;
    }
}

async function logEvent(deviceId, category, activityKh, activityEn) {
    const safeId = deviceId;
    try {
        if (!safeId) return; // Skip logging if no device context
        await dbService.saveLog(safeId, category, activityKh, activityEn);
    } catch (error) {
        console.error("❌ Log Recording Error:", error);
    }
}

async function handleLogbook(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    const query = ctx.callbackQuery;
    const data = query ? query.data : "";

    // 1. Navigation State Logic (The Python "Reset" Logic)
    const now = new Date();
    
    // If user clicks from main menu OR session is new, reset to current month
    if (data === "logbook" || !ctx.session.logViewMonth) {
        ctx.session.logViewMonth = now.getMonth() + 1;
        ctx.session.logViewYear = now.getFullYear();
        ctx.session.logPage = 1;
    }

    let currentM = ctx.session.logViewMonth;
    let currentY = ctx.session.logViewYear;
    let currentP = ctx.session.logPage;

    // 2. Handle Navigation (Reality Guard included)
    if (query) {
        if (data === "log_prev") {
            currentM--;
            if (currentM < 1) { currentM = 12; currentY--; }
            currentP = 1; 
        } else if (data === "log_next") {
            currentM++;
            if (currentM > 12) { currentM = 1; currentY++; }
            currentP = 1;
        } else if (data.startsWith("week_")) {
            const requestedP = parseInt(data.split("_")[1]);
            currentP = isNaN(requestedP) ? 1 : requestedP;
        }
        await ctx.answerCbQuery().catch(() => {});
    }

    // Clamp week within month reality
    const maxWeeks = getMaxWeeks(currentM, currentY);
    if (currentP < 1) currentP = 1;
    if (currentP > maxWeeks) currentP = maxWeeks;

    // Sync back to session
    ctx.session.logViewMonth = currentM;
    ctx.session.logViewYear = currentY;
    ctx.session.logPage = currentP;

    // 3. Data Retrieval: Activity logs (pump/fertilizer/etc.)
    const deviceId = await resolveDeviceId(ctx);
    if (!deviceId && DEFAULT_DEVICE_ID) ctx.session.deviceId = DEFAULT_DEVICE_ID;
    const effectiveDeviceId = deviceId || ctx.session?.deviceId || null;

    if (!effectiveDeviceId) {
        const msg = isKhmer
            ? '📭 មិនមានឧបករណ៍សិនស័រភ្ជាប់ទៅកសិករនេះទេ។ សូមអោយ Admin កំណត់ Sensor Device ជាមុន។'
            : '📭 No sensor device is assigned to this farmer. Please ask an admin to assign a Sensor Device first.';
        const { keyboard } = MenuService.getMainMenu(isKhmer);
        try {
            if (query) {
                await ctx.editMessageText(msg, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
            } else {
                await ctx.replyWithMarkdown(msg, { reply_markup: keyboard.reply_markup });
            }
        } catch (_) {}
        return;
    }

    let logs = [];
    try {
        logs = await dbService.getMonthlyLog(effectiveDeviceId, currentM, currentY, currentP);
    } catch (error) {
        console.error('🔥 Logbook Fetch Error:', error);
        logs = [];
    }

    const monthName = isKhmer
        ? MenuService.KH_MONTHS[currentM - 1]
        : new Date(currentY, currentM - 1).toLocaleString('en-US', { month: 'long' });

    const { text, keyboard } = MenuService.formatLogbookMonthlyMessage(
        logs,
        isKhmer,
        monthName,
        currentY,
        currentP,
        maxWeeks
    );

    try {
        if (query) {
            await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
        } else {
            await ctx.replyWithMarkdown(text, keyboard);
        }
    } catch (error) {
        if (!error.description?.includes("message is not modified")) {
            console.error("Logbook UI Error:", error);
        }
    }
}

module.exports = { handleLogbook, logEvent, CAT };