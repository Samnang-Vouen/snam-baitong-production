/**
 * HANDLER: Start / Welcome
 * Location: src/bot/handlers/start.js
 */
const MenuService = require('../menus');
// FIXED: Path and name match our directory structure
const api = require('../../services/api.service'); 

// Scalable Constants
const MONITOR_INTERVAL_MS = 10 * 60 * 1000; // 10 Minutes
const DEFAULT_DEVICE_ID = process.env.BOT_DEFAULT_DEVICE_ID || "DEMO001";

/**
 * Background Heartbeat: Checks if hardware is offline.
 * Replaces Python's monitor_field
 */
async function monitorField(ctx, deviceId) {
    const isKhmer = ctx.session?.is_khmer !== false;
    
    try {
        // Fetch via backend API using Telegram session ID binding
        const res = await api.getStatusForTelegram({ telegramUserId: ctx.from?.id, chatId: ctx.chat?.id });
        const latestData = res && res.success ? res.data : null;
        
        if (!latestData) {
            const alert = isKhmer 
                ? "⚠️ ឧបករណ៍របស់អ្នកហាក់ដូចជាបាត់ការតភ្ជាប់។" 
                : "⚠️ Your device seems to be offline.";
            
            if (!ctx.session.offlineAlertSent) {
                // Use ctx.telegram for background tasks where 'ctx.reply' might fail
                await ctx.telegram.sendMessage(ctx.chat.id, alert).catch(() => {});
                ctx.session.offlineAlertSent = true;
            }
        } else {
            ctx.session.offlineAlertSent = false;
        }
    } catch (error) {
        console.error(`📡 Heartbeat Error for ${deviceId}:`, error);
    }
}

async function handleStart(ctx) {
    // Telegraf session handles what context.user_data did in Python
    if (!ctx.session) ctx.session = {}; 
    
    const isKhmer = ctx.session.is_khmer !== false;
    const deviceId = ctx.session.deviceId || DEFAULT_DEVICE_ID;

    // --- 1. HEARTBEAT MANAGEMENT ---
    if (ctx.session.monitorInterval) {
        clearInterval(ctx.session.monitorInterval);
    }
    
    // Start fresh monitor to ensure provincial farmers get offline alerts
    ctx.session.monitorInterval = setInterval(() => {
        monitorField(ctx, deviceId);
    }, MONITOR_INTERVAL_MS);

    // --- 2. WELCOME BACK LOGIC (If already registered & verified) ---
    if (ctx.session.verified && ctx.session.provinceEn) {
        const pEn = ctx.session.provinceEn || "Phnom Penh";
        const pKh = ctx.session.provinceKh || "ភ្នំពេញ";
        
        const { text, keyboard } = MenuService.getMainMenu(isKhmer);
        const locationHeader = `📍 **${isKhmer ? pKh : pEn}**\n`;
        
        const welcomeBack = isKhmer
            ? `🔄 **សូមស្វាគមន៍មកវិញ!**\n${locationHeader}\n${text}`
            : `🔄 **Welcome back!**\n${locationHeader}\n${text}`;

        return ctx.replyWithMarkdown(welcomeBack, keyboard);
    }

    // --- 3. FIRST-TIME ONBOARDING ---
    // If not verified in session, check backend binding to avoid re-prompting on restart
    if (!ctx.session.verified) {
        try {
            const res = await api.checkVerified({ telegramUserId: ctx.from?.id, chatId: ctx.chat?.id });
            if (res && res.success && res.verified) {
                ctx.session.verified = true;
                ctx.session.farmer = res.farmer || null;
                // Initialize province/coords from farmer record if available
                try {
                    const MenuService = require('../menus');
                    const provinces = MenuService.ALL_PROVINCES || [];
                    const pvRaw = String(res?.farmer?.provinceCity || '').trim();
                    const match = provinces.find(p => {
                        const en = String(p.en || '').trim().toLowerCase();
                        const kh = String(p.kh || '').trim();
                        return en === pvRaw.toLowerCase() || kh === pvRaw;
                    });
                    if (match) {
                        ctx.session.provinceEn = match.en;
                        ctx.session.provinceKh = match.kh;
                        ctx.session.lat = match.lat;
                        ctx.session.lon = match.lon;
                    } else if (pvRaw) {
                        ctx.session.provinceEn = pvRaw;
                        ctx.session.provinceKh = pvRaw;
                    }
                } catch (_) {}
            }
        } catch (e) {
            // Non-fatal; will prompt below
        }
    }

    if (ctx.session.verified) {
        const { text, keyboard } = MenuService.getMainMenu(isKhmer);
        return ctx.replyWithMarkdown(text, keyboard);
    }

    // Step 1: Phone verification gate
    const welcomeMsg = 
        "🇰🇭 **សូមស្វាគមន៍មកកាន់ SnamBaitong!**\n" +
        "សូមផ្ទៀងផ្ទាត់លេខទូរស័ព្ទរបស់អ្នកដើម្បីចូលប្រើមុខងារ។\n\n" +
        "🇺🇸 **Welcome to SnamBaitong!**\n" +
        "Please verify your phone number to unlock all features.";

    await ctx.replyWithMarkdown(welcomeMsg);
    const { promptForPhone } = require('./verify');
    return promptForPhone(ctx);
}

module.exports = { handleStart };