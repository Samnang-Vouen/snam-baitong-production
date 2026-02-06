/**
 * HANDLER: Farmer Profile View
 * Location: src/bot/handlers/profile.js
 */
const MenuService = require('../menus');
const api = require('../../services/api.service');
const sensorsService = require('../../services/sensors.service');
const db = require('../../services/mysql');

async function handleProfile(ctx) {
  const isKhmer = ctx.session?.is_khmer !== false;
  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(isKhmer ? '⌛️ កំពុងទាញយកប្រវត្តិ...' : '⌛️ Loading profile...').catch(() => {});
    }

    const telegramUserId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    const verified = await api.checkVerified({ telegramUserId, chatId });
    if (!(verified?.success && verified?.verified && verified?.farmer?.id)) {
      const msg = isKhmer ? '🔒 សូមផ្ទៀងផ្ទាត់លេខទូរស័ព្ទរបស់អ្នក' : '🔒 Please verify your phone number first';
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery(msg).catch(() => {});
      } else {
        await ctx.reply(msg).catch(() => {});
      }
      return;
    }

    const farmerId = verified.farmer.id;
    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
    const farmer = Array.isArray(farmerRows) && farmerRows.length ? farmerRows[0] : null;

    // Resolve sensor devices via sensors service; fallback to legacy fields
    let devices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(farmerId);
      devices = Array.isArray(sensors) ? sensors.map(s => s.device_id).filter(Boolean) : [];
    } catch (_) {}

    // If new schema exists but has no relationships yet, still fall back.
    if (!devices.length) {
      const legacy = farmer?.sensor_devices || '';
      devices = legacy ? String(legacy).split(',').map(d => d.trim()).filter(Boolean) : [];
    }

    // Last-resort legacy: some deployments still use farmers.device_id
    if (!devices.length && farmer?.device_id) {
      devices = [String(farmer.device_id).trim()].filter(Boolean);
    }

    // Persist a default device to session for other bot features
    if (devices.length) {
      ctx.session.deviceId = ctx.session.deviceId || devices[0];
      ctx.session.deviceIds = devices;
    }
    const devicesText = devices.length ? devices.join(', ') : (isKhmer ? 'មិនមាន' : 'None');

    const nameEn = `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim();
    const nameKh = nameEn; // assuming names are entered in Khmer already; keep same
    const locationEn = `${farmer.village_name || ''}, ${farmer.district_name || ''}, ${farmer.province_city || ''}`.replace(/(^[\s,]+|[\s,]+$)/g, '').trim();
    const locationKh = locationEn;
    const crop = String(farmer.crop_type || '').trim();

    const en = [
      '✅ Login successful',
      '👤 Farmer Information',
      nameEn ? `- Name: ${nameEn}` : null,
      farmer.phone_number ? `- Phone: ${farmer.phone_number}` : null,
      locationEn ? `- Location: ${locationEn}` : null,
      crop ? `- Crop: ${crop}` : null,
      `- Sensor Devices: ${devicesText}`
    ].filter(Boolean).join('\n');

    const kh = [
      '🇰🇭 បានផ្ទៀងផ្ទាត់ជោគជ័យ',
      '👤 ព័ត៌មានកសិករ',
      nameKh ? `- ឈ្មោះ: ${nameKh}` : null,
      farmer.phone_number ? `- ទូរស័ព្ទ: ${farmer.phone_number}` : null,
      locationKh ? `- ទីតាំង: ${locationKh}` : null,
      crop ? `- ប្រភេទដំណាំ: ${crop}` : null,
      `- ឧបករណ៍សិនស័រ: ${devicesText}`
    ].filter(Boolean).join('\n');

    const text = `${en}\n\n${kh}`;
    const keyboard = MenuService.getProfileKeyboard(isKhmer); // profile-only back button

    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: keyboard.reply_markup, parse_mode: 'Markdown' });
    } else {
      await ctx.replyWithMarkdown(text, { reply_markup: keyboard.reply_markup });
    }
  } catch (error) {
    console.error('🔥 Profile Handler Error:', error);
    const msg = isKhmer ? '❌ មិនអាចបង្ហាញប្រវត្តិបាន' : '❌ Failed to show profile';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(msg).catch(() => {});
    } else {
      await ctx.reply(msg).catch(() => {});
    }
  }
}

module.exports = { handleProfile };
