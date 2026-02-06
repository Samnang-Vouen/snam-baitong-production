/**
 * HANDLER: Central Button Router
 * Location: src/bot/handlers/buttons.js
 */
const MenuService = require('../menus');

// Import other handlers to route the traffic
const { handleStatus, openDevicePicker, setDevice } = require('./status');
const { handleProfile } = require('./profile');
const { handleWeather } = require('./weather');
const { handleControl, handlePumpToggle } = require('./water_control');
const { handleFertilizer, handleFertToggle } = require('./fertilizer');
const { handleLogbook } = require('./logbook');
const { handleHelp } = require('./help');

async function handleButtons(ctx) {
    const data = ctx.callbackQuery.data;
    
    // Initialize session if missing
    if (!ctx.session) ctx.session = {};
    
    let isKhmer = ctx.session.is_khmer !== false;
    const pEn = ctx.session.provinceEn || "Phnom Penh";
    const pKh = ctx.session.provinceKh || "ភ្នំពេញ";

    try {
        // --- 1. SETUP & LANGUAGE ---
        if (data.startsWith("lang_")) {
            ctx.session.is_khmer = (data === "lang_kh");
            isKhmer = ctx.session.is_khmer; 
            // Skip province selection; go directly to main menu using farmer's province
            const { text, keyboard } = MenuService.getMainMenu(isKhmer);
            const header = `📍 **${isKhmer ? pKh : pEn}**\n`;
            await ctx.answerCbQuery();
            return ctx.editMessageText(header + text, {
                reply_markup: keyboard.reply_markup,
                parse_mode: 'Markdown'
            }).catch(() => {});
        }

        // Province selection is deprecated; pages and pvidx are no-ops

        // --- 2. CORE FUNCTIONS ---
        if (data === "status") return handleStatus(ctx);
        if (data === "device_menu") return openDevicePicker(ctx);
        if (data.startsWith("dev_")) return setDevice(ctx);
        if (data === "weather") return handleWeather(ctx);
        if (data === "profile") return handleProfile(ctx);
        if (data === "control") return handleControl(ctx);
        if (data.startsWith("pump_")) return handlePumpToggle(ctx);
        if (data === "fertilizer") return handleFertilizer(ctx);
        if (data.startsWith("fert_")) return handleFertToggle(ctx);
        if (data === "logbook" || data.startsWith("log_") || data.startsWith("week_")) return handleLogbook(ctx);
        if (data === "help_info") return handleHelp(ctx);

        // --- 3. NAVIGATION ---
        if (data === "back_to_main") {
            const { text, keyboard } = MenuService.getMainMenu(isKhmer);
            const header = `📍 **${isKhmer ? pKh : pEn}**\n`;
            await ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(header + text, { 
                reply_markup: keyboard.reply_markup, 
                parse_mode: 'Markdown' 
            }).catch(() => {});
        }

        if (data === "back_to_lang") {
            const { text, keyboard } = MenuService.getLanguageMenu();
            await ctx.answerCbQuery().catch(() => {});
            return ctx.editMessageText(text, { reply_markup: keyboard.reply_markup }).catch(() => {});
        }

    } catch (error) {
        console.error("🔥 Routing Error:", error);
        return ctx.answerCbQuery("❌ Error").catch(() => {});
    }
}

module.exports = { handleButtons };