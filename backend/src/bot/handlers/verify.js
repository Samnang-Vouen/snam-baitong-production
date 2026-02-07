const { Markup } = require('telegraf');
const api = require('../../services/api.service');
const sensorsService = require('../../services/sensors.service');
const db = require('../../services/mysql');

function toEnglishDigits(s) {
  if (!s) return '';
  const khDigits = '០១២៣៤៥៦៧៨៩'; // U+17E0..U+17E9
  const enDigits = '0123456789';
  let out = '';
  for (const ch of String(s)) {
    const idx = khDigits.indexOf(ch);
    out += idx >= 0 ? enDigits[idx] : ch;
  }
  return out;
}

function normalizePhone(p) {
  const s = toEnglishDigits(String(p || '').trim());
  // Keep digits and leading +, strip spaces/hyphens and Khmer punctuation
  const cleaned = s.replace(/[^+\d]/g, '');
  return cleaned;
}

async function promptForPhone(ctx) {
  if (!ctx.session) ctx.session = {};
  ctx.session.awaitingPhone = true;
  ctx.session.awaitingOtp = false;
  ctx.session.pendingPhone = undefined;
  const isKhmer = ctx.session.is_khmer !== false;
  const text = isKhmer
    ? '👋 សូមវាយបញ្ចូលលេខទូរស័ព្ទ(ឧ. 0123456789)'
    : '👋 Please type your phone number as digits (e.g., 0123456789)';
  // Remove any previous custom keyboards and just prompt for text input
  await ctx.reply(text, Markup.removeKeyboard()).catch(() => {});
}

async function promptForOtp(ctx) {
  if (!ctx.session) ctx.session = {};
  ctx.session.awaitingPhone = false;
  ctx.session.awaitingOtp = true;
  const isKhmer = ctx.session.is_khmer !== false;
  const text = isKhmer
    ? '🔐 សូមវាយបញ្ចូលលេខកូដ OTP 4 ខ្ទង់ ដែលបានផ្ញើមកក្នុង chat នេះ។\n\nបើ OTP ផុតកំណត់ សូមវាយ "resend" ដើម្បីផ្ញើ OTP ថ្មី។'
    : '🔐 Please enter the 4-digit OTP sent to this chat.\n\nIf it expired, type "resend" to get a new OTP.';
  await ctx.reply(text, Markup.removeKeyboard()).catch(() => {});
}

async function completeVerification(ctx, farmer) {
  ctx.session.verified = true;
  ctx.session.awaitingPhone = false;
  ctx.session.awaitingOtp = false;
  ctx.session.pendingPhone = undefined;
  ctx.session.farmer = farmer;
  // Auto-assign province/coords from farmer record
  try {
    const MenuService = require('../menus');
    const provinces = MenuService.ALL_PROVINCES || [];
    const pvRaw = String(farmer?.provinceCity || '').trim();
    // Try match by Khmer or English names (case-insensitive)
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
    } else {
      // Fallback to using raw province string for display
      ctx.session.provinceEn = farmer?.provinceCity || 'Phnom Penh';
      ctx.session.provinceKh = farmer?.provinceCity || 'ភ្នំពេញ';
      ctx.session.lat = undefined;
      ctx.session.lon = undefined;
    }
  } catch (_) {}

  // Best-effort: auto-select first sensor device for this farmer.
  // This prevents pump/fertilizer/logbook buttons from silently doing nothing.
  try {
    const farmerId = farmer?.id;
    if (farmerId && !ctx.session.deviceId) {
      let devices = [];
      try {
        const sensors = await sensorsService.getFarmerSensors(farmerId);
        devices = sensors.map(s => s.device_id).filter(Boolean);
      } catch (_) {}

      if (!devices.length) {
        const rows = await db.query('SELECT sensor_devices FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
        const legacyStr = rows && rows[0] ? (rows[0].sensor_devices || '') : '';
        devices = legacyStr ? String(legacyStr).split(',').map(d => d.trim()).filter(Boolean) : [];
      }

      if (devices.length) {
        ctx.session.deviceId = devices[0];
        ctx.session.deviceIds = devices;
      }
    }
  } catch (_) {}

  // Remove the custom reply keyboard (backend will send success message)
  await ctx.reply(' ', Markup.removeKeyboard()).catch(() => {});
  // Continue onboarding with language selection
  const MenuService = require('../menus');
  const { text, keyboard } = MenuService.getLanguageMenu();
  await ctx.reply(text, keyboard).catch(() => {});
}

async function handleContactVerify(ctx) {
  if (!ctx.message || !ctx.message.contact) return;
  const phone = normalizePhone(ctx.message.contact.phone_number);
  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  try {
    const res = await api.requestOtp({ telegramUserId, chatId, phoneNumber: phone });
    if (res && res.success && res.verified && res.farmer) {
      await completeVerification(ctx, res.farmer);
      return;
    }
    if (res && res.success && res.otpSent) {
      ctx.session.pendingPhone = phone;
      await ctx.reply(ctx.session.is_khmer !== false ? '✅ បានផ្ញើ OTP ទៅក្នុង chat នេះ។' : '✅ OTP sent to this chat.').catch(() => {});
      await promptForOtp(ctx);
      return;
    }

    // Known errors
    const err = String(res?.error || '').toLowerCase();
    if (/already linked/.test(err)) {
      const msg = ctx.session.is_khmer !== false
        ? '❌ លេខទូរស័ព្ទនេះបានភ្ជាប់ជាមួយ Telegram ផ្សេងរួចហើយ។'
        : '❌ This phone number is already linked to another Telegram user.';
      await ctx.reply(msg).catch(() => {});
      return;
    }

    const msg = ctx.session.is_khmer !== false
      ? '❌ លេខទូរស័ព្ទមិនត្រឹមត្រូវ ឬមិនមានក្នុងប្រព័ន្ធ។'
      : '❌ Phone number not found or invalid.';
    await ctx.reply(msg).catch(() => {});
    await promptForPhone(ctx);
  } catch (e) {
    const msg = ctx.session.is_khmer !== false ? '❌ កំហុសក្នុងការផ្ញើ OTP។ សូមព្យាយាមម្តងទៀត។' : '❌ OTP error. Please try again.';
    await ctx.reply(msg).catch(() => {});
    await promptForPhone(ctx);
  }
}

async function handleTextVerify(ctx) {
  const text = String(ctx.message?.text || '').trim();
  if (!text) return;

  const telegramUserId = ctx.from?.id;
  const chatId = ctx.chat?.id;

  // OTP step
  if (ctx.session?.awaitingOtp) {
    const lower = text.toLowerCase();
    const isResend = lower === 'resend' || lower === 'send again' || lower === 'otp' || lower === 'send otp';
    if (isResend) {
      const pn = ctx.session.pendingPhone;
      if (!pn) {
        await promptForPhone(ctx);
        return;
      }
      const r = await api.requestOtp({ telegramUserId, chatId, phoneNumber: pn });
      if (r && r.success && r.otpSent) {
        await ctx.reply(ctx.session.is_khmer !== false ? '✅ បានផ្ញើ OTP ថ្មី។' : '✅ New OTP sent.').catch(() => {});
        await promptForOtp(ctx);
        return;
      }
      await ctx.reply(ctx.session.is_khmer !== false ? '❌ មិនអាចផ្ញើ OTP ថ្មីបានទេ។' : '❌ Unable to resend OTP.').catch(() => {});
      return;
    }

    const otp = normalizePhone(text);
    const pn = ctx.session.pendingPhone;
    if (!pn) {
      await promptForPhone(ctx);
      return;
    }
    if (!/^\d{4}$/.test(otp.replace(/[^0-9]/g, ''))) {
      const msg = ctx.session.is_khmer !== false ? '❌ សូមវាយ OTP 4 ខ្ទង់។' : '❌ Please enter the 4-digit OTP.';
      await ctx.reply(msg).catch(() => {});
      return;
    }

    const res = await api.confirmOtp({ telegramUserId, chatId, phoneNumber: pn, otp });
    if (res && res.success && res.verified && res.farmer) {
      await completeVerification(ctx, res.farmer);
      return;
    }
    if (res && res.expired) {
      const msg = ctx.session.is_khmer !== false
        ? '⏰ OTP ផុតកំណត់។ សូមវាយ "resend" ដើម្បីផ្ញើ OTP ថ្មី។'
        : '⏰ OTP expired. Type "resend" to get a new OTP.';
      await ctx.reply(msg).catch(() => {});
      return;
    }
    if (typeof res?.attemptsLeft === 'number') {
      const msg = ctx.session.is_khmer !== false
        ? `❌ OTP មិនត្រឹមត្រូវ។ នៅសល់ ${res.attemptsLeft} ដង។`
        : `❌ Wrong OTP. ${res.attemptsLeft} attempt(s) left.`;
      await ctx.reply(msg).catch(() => {});
      if (res.attemptsLeft <= 0) {
        const rmsg = ctx.session.is_khmer !== false
          ? 'សូមវាយ "resend" ដើម្បីផ្ញើ OTP ថ្មី។'
          : 'Type "resend" to get a new OTP.';
        await ctx.reply(rmsg).catch(() => {});
      }
      return;
    }

    const msg = ctx.session.is_khmer !== false ? '❌ មិនអាចផ្ទៀងផ្ទាត់ OTP បានទេ។' : '❌ OTP verification failed.';
    await ctx.reply(msg).catch(() => {});
    return;
  }

  // Phone step
  if (!ctx.session?.awaitingPhone) return;
  const phone = normalizePhone(text);
  try {
    const res = await api.requestOtp({ telegramUserId, chatId, phoneNumber: phone });
    if (res && res.success && res.verified && res.farmer) {
      await completeVerification(ctx, res.farmer);
      return;
    }
    if (res && res.success && res.otpSent) {
      ctx.session.pendingPhone = phone;
      await ctx.reply(ctx.session.is_khmer !== false ? '✅ បានផ្ញើ OTP ទៅក្នុង chat នេះ។' : '✅ OTP sent to this chat.').catch(() => {});
      await promptForOtp(ctx);
      return;
    }
    const err = String(res?.error || '').toLowerCase();
    if (/already linked/.test(err)) {
      const msg = ctx.session.is_khmer !== false
        ? '❌ លេខទូរស័ព្ទនេះបានភ្ជាប់ជាមួយ Telegram ផ្សេងរួចហើយ។'
        : '❌ This phone number is already linked to another Telegram user.';
      await ctx.reply(msg).catch(() => {});
      return;
    }
    const msg = ctx.session.is_khmer !== false
      ? '❌ លេខទូរស័ព្ទមិនត្រឹមត្រូវ ឬមិនមានក្នុងប្រព័ន្ធ។'
      : '❌ Phone number not found or invalid.';
    await ctx.reply(msg).catch(() => {});
    await promptForPhone(ctx);
  } catch (e) {
    const msg = ctx.session.is_khmer !== false ? '❌ កំហុសក្នុងការផ្ញើ OTP។ សូមព្យាយាមម្តងទៀត។' : '❌ OTP error. Please try again.';
    await ctx.reply(msg).catch(() => {});
    await promptForPhone(ctx);
  }
}

module.exports = { promptForPhone, promptForOtp, handleContactVerify, handleTextVerify };