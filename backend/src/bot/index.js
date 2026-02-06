/**
 * BOT MAIN ENTRY
 * Location: src/bot/index.js
 */
require('dotenv').config();
const { Telegraf, session } = require('telegraf');

// --- 1. IMPORT MODULAR HANDLERS ---
const { handleStart } = require('./handlers/start');
const { promptForPhone, handleContactVerify, handleTextVerify } = require('./handlers/verify');
const { handleButtons } = require('./handlers/buttons');
const { handleStatus } = require('./handlers/status');
const { handleWeather } = require('./handlers/weather');
const { handleControl } = require('./handlers/water_control'); 
const { handleFertilizer } = require('./handlers/fertilizer');
const { handleLogbook } = require('./handlers/logbook');
const { handleHelp } = require('./handlers/help');
const { handleProfile } = require('./handlers/profile');
// Backend API service (used to re-check verification status)
const api = require('../services/api.service');

// Accept both TELEGRAM_TOKEN and TELEGRAM_BOT_TOKEN for flexibility
const token = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const bot = token ? new Telegraf(token) : null;
if (!token) {
    console.warn("⚠️ TELEGRAM_TOKEN/TELEGRAM_BOT_TOKEN missing; skipping bot initialization.");
    module.exports = null;
}

// --- 2. MIDDLEWARE SETUP ---
if (bot) bot.use(session());

/**
 * Skeptic Check: Middleware to ensure session defaults.
 * Prevents "Cannot read property of undefined" when session is empty.
 */
if (bot) bot.use((ctx, next) => {
    if (!ctx.session) ctx.session = {};
    // Default to Khmer if not set (straightforward for local farmers)
    if (ctx.session.is_khmer === undefined) ctx.session.is_khmer = true;
    // Gatekeeper: until verified, only allow start and phone inputs
    const isVerified = !!ctx.session.verified;
    const isStartCmd = !!ctx.message && typeof ctx.message.text === 'string' && ctx.message.text.trim().toLowerCase().startsWith('/start');
    const isContact = !!ctx.message && !!ctx.message.contact;
    const isAwaitingPhone = !!ctx.session.awaitingPhone;
    const isCallback = !!ctx.callbackQuery;
    const callbackData = ctx.callbackQuery?.data || '';

    if (!isVerified) {
        // Allow /start always
        if (isStartCmd) return next();
        // Allow contact or text when we are awaiting phone
        if (isAwaitingPhone && (isContact || (!!ctx.message && typeof ctx.message.text === 'string'))) return next();
        // Block callbacks and other commands
                if (isCallback) {
                        // Allow basic navigation callbacks without verification
                        const allowedNav = ['back_to_main', 'back_to_lang', 'lang_kh', 'lang_en'];
                        if (allowedNav.includes(callbackData)) {
                                return next();
                        }
                        const msg = ctx.session.is_khmer !== false
                            ? '🔒 សូមបញ្ចូលលេខទូរស័ព្ទដើម្បីបន្ត'
                            : '🔒 Please verify your phone number to continue';
                        return ctx.answerCbQuery(msg).catch(() => {});
                }
        // For any other message, prompt phone again
        return promptForPhone(ctx);
    }
    return next();
});

/**
 * Dynamic Verification Check: If the farmer record is removed from backend,
 * force re-verification by prompting for phone again.
 * Runs after session defaults but before command handlers.
 */
if (bot) bot.use(async (ctx, next) => {
    if (!ctx.session) ctx.session = {};
    // Only check when we think the user is verified
    if (!ctx.session.verified) return next();

    const telegramUserId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    try {
        const res = await api.checkVerified({ telegramUserId, chatId });
        const stillVerified = !!(res && res.success && res.verified && res.farmer);
        if (!stillVerified) {
            // Reset session and prompt for phone
            ctx.session.verified = false;
            ctx.session.awaitingPhone = true;
            ctx.session.farmer = undefined;
            const msg = ctx.session.is_khmer !== false
              ? '🔒 គណនីកសិកររបស់អ្នកមិនមានទៀតទេ។ សូមផ្ទៀងផ្ទាត់លេខទូរស័ព្ទម្តងទៀត។'
              : '🔒 Your farmer account is no longer found. Please verify your phone again.';
            if (ctx.callbackQuery) {
                await ctx.answerCbQuery(msg).catch(() => {});
            }
            else {
                await ctx.reply(msg).catch(() => {});
            }
            await promptForPhone(ctx);
            return; // Stop further handlers until re-verified
        } else {
            // Keep farmer profile fresh in session
            ctx.session.farmer = res.farmer;
        }
    } catch (_) {
        // On network/Backend errors, do not block usage; continue.
    }
    return next();
});

// --- 3. REGISTER COMMANDS ---
if (bot) {
    bot.command('start', handleStart);
    // Verification handlers
    bot.on('contact', handleContactVerify);
    bot.on('text', handleTextVerify);
    bot.command('soil_status', handleStatus);
    bot.command('weather', handleWeather);
    bot.command('water_pump', handleControl);
    bot.command('fertilizer_pump', handleFertilizer);
    bot.command('logbook', handleLogbook);
    bot.command('profile', handleProfile);
    bot.command('help', handleHelp);
}

// --- 4. REGISTER CALLBACK ROUTER ---
if (bot) bot.on('callback_query', handleButtons);

// --- 5. GLOBAL ERROR HANDLER ---
if (bot) bot.catch((err, ctx) => {
    console.error(`🔥 SnamBaitong Bot Error for ${ctx.updateType}:`, err);
    
    const isKhmer = ctx.session?.is_khmer !== false;
    const msg = isKhmer 
        ? "❌ មានបញ្ហាបច្ចេកទេស។ សូមព្យាយាមម្តងទៀត!" 
        : "❌ A technical error occurred. Please try again.";

    ctx.reply(msg).catch(() => {});
});

// --- 6. BOOT UP ---
if (bot) {
    const envMode = (process.env.ENV_MODE || 'DEV').toUpperCase();
    const usePolling = String(process.env.TELEGRAM_USE_POLLING || 'true').toLowerCase() === 'true';

    if (usePolling) {
        (async () => {
            try {
                // Ensure webhook is disabled before using getUpdates polling
                await bot.telegram.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
                await bot.launch({
                    allowedUpdates: ['message', 'callback_query'],
                    dropPendingUpdates: true 
                });
                console.log("--------------------------------------------------");
                console.log(`🚀 SnamBaitong Bot (Node.js): ONLINE (polling)`);
                console.log(`🛠  Environment   : ${envMode}`);
                console.log(`🔗 Commands Wired Successfully`);
                console.log("--------------------------------------------------");
            } catch (err) {
                const code = err?.response?.error_code || err?.code;
                const desc = err?.response?.description || err?.message || '';
                if (code === 409 || /terminated by other getUpdates request/.test(String(desc))) {
                    console.warn('⚠️ Telegram polling conflict detected: another instance is running.');
                    console.warn('   Tip: stop other bot processes or set TELEGRAM_USE_POLLING=false to avoid polling.');
                    // Do not crash the app; keep backend running.
                } else {
                    console.error('Failed to launch Telegram bot:', err);
                }
            }
        })();
    } else {
        console.log('Telegram bot not launched (polling disabled).');
    }

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = bot;