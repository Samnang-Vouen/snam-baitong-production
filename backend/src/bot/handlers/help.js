/**
 * HANDLER: Help & Information
 * Location: src/bot/handlers/help.js
 * Scalable: Syncs text with system constants
 */
const MenuService = require('../menus');

async function handleHelp(ctx) {
    const isKhmer = ctx.session?.is_khmer !== false;
    const query = ctx.callbackQuery;

    // 1. IMMEDIATE UX FEEDBACK
    if (query) {
        await ctx.answerCbQuery(
            isKhmer ? "⌛️ កំពុងបើកជំនួយ..." : "⌛️ Opening help..."
        ).catch(() => {});
    }

    // 2. Pull Scalable Constants (No Magic Numbers)
    const fertTime = MenuService.MAX_FERT_TIME_MINS || 15;
    const pumpTime = MenuService.MAX_PUMP_TIME_MINS || 30;
    const supportNum = process.env.SUPPORT_PHONE || "012345678";

    // 3. Modern UI Text (Straightforward for farmers)
    const text = isKhmer 
        ? `❓ **ជំនួយ និងការប្រើប្រាស់**\n` +
          `-----------------------------------\n` +
          `📊 **១. ស្ថានភាពដី**\n` +
          `មើលកម្រិត pH សំណើម និងជាតិជី (NPK)។\n\n` +
          `🌿 **២. ការដាក់ជី**\n` +
          `បញ្ចេញជីតាមបំពង់ទឹក (បិទអូតូក្នុង ${fertTime}នាទី)។\n\n` +
          `💧 **៣. បញ្ជាម៉ូទ័រទឹក**\n` +
          `បើក ឬ បិទ ម៉ូទ័រពីចម្ងាយ (បិទអូតូក្នុង ${pumpTime}នាទី)។\n\n` +
          `☁️ **៤. អាកាសធាតុ**\n` +
          `ពិនិត្យកម្តៅ និងសំណើម មុនពេលស្រោចស្រព។\n\n` +
          `📖 **៥. កំណត់ហេតុ**\n` +
          `មើលរបាយការណ៍សកម្មភាពប្រចាំខែរបស់អ្នក។\n\n` +
          `☎️ **ជំនួយបច្ចេកទេស:** ${supportNum}`
        : `❓ **Help & Information**\n` +
          `-----------------------------------\n` +
          `📊 **1. Soil Status**\n` +
          `Check pH, Moisture, and NPK levels.\n\n` +
          `🌿 **2. Fertilizer Control**\n` +
          `Feed crops remotely (Auto-off in ${fertTime} mins).\n\n` +
          `💧 **3. Remote Control**\n` +
          `Turn water pump ON/OFF (Auto-off in ${pumpTime} mins).\n\n` +
          `☁️ **4. Weather Forecast**\n` +
          `Check temp and humidity before irrigation.\n\n` +
          `📖 **5. Logbook**\n` +
          `View your monthly activity and history.\n\n` +
          `☎️ **Technical Support:** ${supportNum}`;

    // 4. Get navigation markup from MenuService
    const { keyboard } = MenuService.getHelpMenu(isKhmer);

    // 5. RELIABLE UI DELIVERY
    try {
        if (query) {
            await ctx.editMessageText(text, {
                reply_markup: keyboard.reply_markup,
                parse_mode: 'Markdown'
            });
        } else {
            await ctx.replyWithMarkdown(text, keyboard);
        }
    } catch (error) {
        // Double-click protection
        if (!error.description?.includes("message is not modified")) {
            console.error("🔥 Help Menu UI Error:", error);
        }
    }
}

module.exports = { handleHelp };