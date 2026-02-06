/**
 * HANDLER: Farm Logbook (History)
 * Location: src/bot/handlers/logbook.js
 */
const MenuService = require('../menus');
const dbService = require('../../services/db.service');
const api = require('../../services/api.service');
const sensorsService = require('../../services/sensors.service');
const soilHealthService = require('../../services/soilHealth.service');
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
    const deviceId = ctx.session?.deviceId || null;
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
            // New rule: defer clamping to actual cultivationHistory length later
            currentP = isNaN(requestedP) ? 1 : requestedP;
        }
        await ctx.answerCbQuery().catch(() => {});
    }

    // Sync back to session
    ctx.session.logViewMonth = currentM;
    ctx.session.logViewYear = currentY;
    ctx.session.logPage = currentP;

    // 3. Data Retrieval: Use the same data as Cultivation History
    let cultivationHistory = [];
    let selectedWeek = null;
    let totalWeeks = 0;
    let headerMonth = null;
    let headerYear = null;
    try {
        const telegramUserId = ctx.from?.id;
        const chatId = ctx.chat?.id;
        const verified = await api.checkVerified({ telegramUserId, chatId });
        if (verified?.success && verified?.verified && verified?.farmer?.id) {
            const farmerId = verified.farmer.id;

            // Fetch farmer record for planting date and crop type
            const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
            const farmer = Array.isArray(farmerRows) && farmerRows.length ? farmerRows[0] : null;
            if (!farmer) throw new Error('Farmer not found');

            // Resolve sensor devices via sensors service, fallback to legacy field
            let sensorDevices = [];
            try {
                const sensors = await sensorsService.getFarmerSensors(farmerId);
                sensorDevices = sensors.map(s => s.device_id).filter(Boolean);
            } catch (_) {
                // Fallback to old sensor_devices field
                if (farmer.sensor_devices) {
                    sensorDevices = String(farmer.sensor_devices).split(',').map(d => d.trim()).filter(Boolean);
                }
            }

            if (sensorDevices.length > 0 && farmer.planting_date) {
                const cropType = farmer.crop_type || 'general';
                const historyResult = await soilHealthService.calculateCultivationHistory(sensorDevices, farmer.planting_date, cropType);
                if (historyResult?.success) {
                    cultivationHistory = Array.isArray(historyResult.cultivationHistory) ? historyResult.cultivationHistory : [];
                    totalWeeks = cultivationHistory.length;
                    // Clamp currentP based on available weeks
                    if (totalWeeks > 0) {
                        if (currentP < 1) currentP = 1;
                        if (currentP > totalWeeks) currentP = totalWeeks;
                        ctx.session.logPage = currentP;
                        selectedWeek = cultivationHistory[currentP - 1];
                        if (selectedWeek && selectedWeek.weekStart) {
                            const d = new Date(selectedWeek.weekStart);
                            headerMonth = isKhmer ? MenuService.KH_MONTHS[d.getMonth()] : d.toLocaleString('en-US', { month: 'long' });
                            headerYear = d.getFullYear();
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("🔥 Cultivation History Retrieval Failed:", error);
    }

    // 4. Format & Delivery using Soil Health weekly data
    const { text, keyboard } = MenuService.formatCultivationHistoryWeeklyMessage(
        selectedWeek, isKhmer, headerMonth || (isKhmer ? MenuService.KH_MONTHS[currentM - 1] : new Date(currentY, currentM - 1).toLocaleString('en-US', { month: 'long' })),
        headerYear || currentY, currentP, totalWeeks
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