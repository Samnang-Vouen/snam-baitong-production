/**
 * HANDLER: Weather & Agricultural Advice
 * Location: src/bot/handlers/weather.js
 * Scalable & Direct Service Wiring
 */
const MenuService = require('../menus');
const api = require('../../services/api.service');

async function handleWeather(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    const query = ctx.callbackQuery;

    // 1. UX Feedback: Immediate Toast
    if (query) {
        await ctx.answerCbQuery(
            isKhmer ? "☁️ កំពុងពិនិត្យអាកាសធាតុ..." : "☁️ Checking weather..."
        ).catch(() => {});
    }

    // 2. Retrieve saved coordinates from session
    let lat = ctx.session?.lat;
    let lon = ctx.session?.lon;

    // Attempt to derive coordinates from farmer province if missing
    if (!lat || !lon) {
        try {
            const pv = String(ctx.session?.farmer?.provinceCity || '').trim();
            if (pv) {
                const MenuService = require('../menus');
                const match = (MenuService.ALL_PROVINCES || []).find(p => {
                    const en = String(p.en || '').trim().toLowerCase();
                    const kh = String(p.kh || '').trim();
                    return en === pv.toLowerCase() || kh === pv;
                });
                if (match) {
                    lat = match.lat; lon = match.lon;
                    ctx.session.lat = lat; ctx.session.lon = lon;
                    ctx.session.provinceEn = match.en; ctx.session.provinceKh = match.kh;
                }
            }
        } catch (_) {}
    }

    // Skeptic Check: Redirect if no location is selected
    if (!lat || !lon) {
        const prompt = isKhmer 
            ? "📍 មិនមានទីតាំងអ្នកនៅក្នុងប្រព័ន្ធ។ សូមទាក់ទងអ្នកប់គ្រង។" 
            : "📍 Your location is not set. Please contact support.";
        if (query) {
            return ctx.editMessageText(prompt).catch(() => {});
        } else {
            return ctx.reply(prompt);
        }
    }

    // 3. Get localized city name for the header
    const city = isKhmer ? (ctx.session.provinceKh || ctx.session?.farmer?.provinceCity || "មិនស្គាល់") : (ctx.session.provinceEn || ctx.session?.farmer?.provinceCity || "Unknown");

    // 4. Fetch data from the Direct Service Wire
    let weatherData = null;
    try {
        // Always fetch via backend API (no direct external calls)
        const res = await api.getWeather({ lat, lon, telegramUserId: ctx.from?.id, chatId: ctx.chat?.id });
        if (res && res.success) weatherData = res.data || null;
    } catch (error) {
        console.error("🔥 Weather Service Bridge Failed:", error);
    }

    // If API fails or returns null
    if (!weatherData) {
        const errMsg = isKhmer ? "❌ មិនអាចទាញយកទិន្នន័យបានទេ" : "❌ Could not fetch weather data.";
        if (query) {
            return ctx.answerCbQuery(errMsg, { show_alert: true });
        } else {
            return ctx.reply(errMsg);
        }
    }

    // 5. Message Formatting & UI Delivery
    // formatWeatherMessage handles the wind/rain warnings for farmers
    const message = MenuService.formatWeatherMessage(weatherData, city, isKhmer);
    const { keyboard } = MenuService.getMainMenu(isKhmer);

    try {
        if (query) {
            // FIXED: Target 'keyboard.reply_markup' for Telegraf edit compatibility
            await ctx.editMessageText(message, {
                reply_markup: keyboard.reply_markup,
                parse_mode: 'Markdown'
            });
        } else {
            // For text commands (/weather)
            await ctx.replyWithMarkdown(message, keyboard);
        }
    } catch (error) {
        // Ignore "message is not modified" to prevent logs filling up during rapid clicks
        if (error.description && error.description.includes("message is not modified")) {
            return;
        }
        console.error("⚠️ Weather UI Error:", error);
    }
}

module.exports = { handleWeather };