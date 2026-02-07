const telegram = require('../services/telegram.service');
const mqttService = require('../services/mqtt.service');
const sqlService = require('../services/sql');
const db = require('../services/mysql');
const { formatTimestampLocal } = require('../utils/format');
const crypto = require('crypto');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';
const ALLOWED_FIELDS = (process.env.INFLUXDB_ALLOWED_FIELDS
  ? process.env.INFLUXDB_ALLOWED_FIELDS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['ph', 'moisture', 'soil_temp', 'air_humidity', 'air_temp', 'nitrogen', 'phosphorus', 'potassium', 'salinity', 'ec']);


function buildWhere() {
  const filters = [];
  if (process.env.INFLUXDB_DEVICE) {
    filters.push(`device = '${process.env.INFLUXDB_DEVICE.replace(/'/g, "''")}'`);
  }
  if (process.env.INFLUXDB_LOCATION) {
    filters.push(`location = '${process.env.INFLUXDB_LOCATION.replace(/'/g, "''")}'`);
  }
  return filters.length ? `WHERE ${filters.join(' AND ')}` : '';
}

function safeVal(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

async function fetchLatestRow() {
  const where = buildWhere();
  const sql = `SELECT * FROM "${MEASUREMENT}" ${where} ORDER BY time DESC LIMIT 1`;
  const rows = await sqlService.query(sql);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function formatLatestMessage(row) {
  if (!row) return 'No data available.';
  const parts = [];
  const location = safeVal(row?.location ?? null);
  const time = formatTimestampLocal(row?.time ?? null, { includeTZName: true });
  if (location) parts.push(`Location: ${location}`);
  if (time) parts.push(`Time: ${time}`);
  const mapUnits = {
    air_temp: '°C',
    soil_temp: '°C',
    air_humidity: '%',
    moisture: '%',
    ec: 'dS/m',
    pH: '',
    nitrogen: 'mg/kg',
    phosphorus: 'mg/kg',
    potassium: 'mg/kg',
    salinity: 'ppt'
  };
  for (const f of ALLOWED_FIELDS) {
    if (f in row) {
      const val = safeVal(row[f]);
      const label = f === 'pH' || f === 'ph' ? 'pH' : f;
      const unit = mapUnits[label] ?? '';
      parts.push(`${label}: ${val}${unit ? ' ' + unit : ''}`);
    }
  }
  return parts.join('\n');
}

async function send(req, res) {
  try {
    const { chatId, text, parseMode, disableNotification } = req.body || {};
    const result = await telegram.sendMessage({ chatId, text, parseMode, disableNotification });
    res.json({ success: true, messageId: result.message_id, chat: result.chat, date: result.date });
  } catch (error) {
    const status = /chatId|TOKEN|text/.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

async function updates(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) || 5 : 5;
    const data = await telegram.getUpdates(limit);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function sendLatest(req, res) {
  try {
    const { chatId, parseMode, disableNotification } = req.body || {};
    const latest = await fetchLatestRow();
    const text = formatLatestMessage(latest);
    const result = await telegram.sendMessage({ chatId, text, parseMode, disableNotification });
    res.json({ success: true, messageId: result.message_id, chat: result.chat, date: result.date });
  } catch (error) {
    const status = /chatId|TOKEN/.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
}

async function webhook(req, res) {
  try {
    const update = req.body || {};
    const message = update.message || update.edited_message || null;

    if (!message || typeof message.text !== 'string') {
      return res.json({ ok: true });
    }

    const text = message.text.trim();
    const chatId = message.chat && message.chat.id;

    if (!chatId) {
      return res.json({ ok: true });
    }

    const cmdToken = text.split(/\s+/)[0];
    const baseCmd = (cmdToken || '').toLowerCase().split('@')[0];

    // --- 📊 1. STATUS UPDATE COMMAND ---
    if (baseCmd === '/update') {
      const latest = await fetchLatestRow();
      const msg = formatLatestMessage(latest);
      
      // Still send message to Telegram for the old bot
      if (chatId !== 0) {
        await telegram.sendMessage({ chatId, text: msg });
      }

      // WIRE CONNECT: Return raw JSON data so Python bot can perform validation
      return res.json({ ok: true, data: latest }); 

    // --- 💧 2. WATER PUMP COMMAND ---
    } else if (baseCmd === '/irrigate') {
      try {
        // Wired to Water Pump Topic
        await mqttService.publishPump('water', true); 
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: '✅ Pump turned ON' });
        return res.json({ ok: true, status: 'water_on' });
      } catch (e) {
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: `❌ Failed: ${e.message}` });
        return res.status(500).json({ ok: false, error: e.message });
      }

    // --- 🌿 3. FERTILIZER PUMP COMMAND (NEW) ---
    } else if (baseCmd === '/fertilizer' || baseCmd === '/fertilize') {
      try {
        // Wired to Fertilizer Pump Topic
        await mqttService.publishPump('fert', true); 
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: '🌿 Fertilizer pump turned ON' });
        return res.json({ ok: true, status: 'fert_on' });
      } catch (e) {
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: `❌ Failed: ${e.message}` });
        return res.status(500).json({ ok: false, error: e.message });
      }

    // --- 🛑 4. GLOBAL STOP COMMAND ---
    } else if (baseCmd === '/stop') {
      try {
        // Sends OFF signal to both topics for safety
        await mqttService.publishPump('water', false);
        await mqttService.publishPump('fert', false);
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: '🛑 All pumps turned OFF' });
        return res.json({ ok: true, status: 'all_off' });
      } catch (e) {
        if (chatId !== 0) await telegram.sendMessage({ chatId, text: `❌ Stop Failed: ${e.message}` });
        return res.status(500).json({ ok: false, error: e.message });
      }
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(200).json({ ok: true });
  }
}

module.exports = { send, updates, sendLatest, webhook };

// --- Verification: bind Telegram user to farmer by phone ---
function maskPhoneForLog(pn) {
  const s = String(pn || '');
  if (!s) return '';
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 3))}${s.slice(-3)}`;
}

function toEnglishDigits(s) {
  const str = String(s || '');
  let out = '';
  for (const ch of str) {
    const code = ch.codePointAt(0);
    let digit = null;
    // Khmer 0x17E0..0x17E9
    if (code >= 0x17E0 && code <= 0x17E9) digit = code - 0x17E0;
    // Arabic-Indic 0x0660..0x0669
    else if (code >= 0x0660 && code <= 0x0669) digit = code - 0x0660;
    // Extended Arabic-Indic 0x06F0..0x06F9
    else if (code >= 0x06F0 && code <= 0x06F9) digit = code - 0x06F0;
    // Thai 0x0E50..0x0E59
    else if (code >= 0x0E50 && code <= 0x0E59) digit = code - 0x0E50;
    // Lao 0x0ED0..0x0ED9
    else if (code >= 0x0ED0 && code <= 0x0ED9) digit = code - 0x0ED0;
    // Myanmar 0x1040..0x1049
    else if (code >= 0x1040 && code <= 0x1049) digit = code - 0x1040;
    // Fullwidth 0xFF10..0xFF19
    else if (code >= 0xFF10 && code <= 0xFF19) digit = code - 0xFF10;
    out += digit != null ? String(digit) : ch;
  }
  return out;
}

function normalizePhoneDigits(raw) {
  const onlyAsciiDigits = (s) => String(s || '').replace(/[^0-9]/g, '');
  const stripPunct = (s) => String(s || '').replace(/[^+\d]/g, '');
  const s = stripPunct(toEnglishDigits(String(raw || '').trim()));
  return onlyAsciiDigits(s);
}

function buildCambodiaPhoneVariants(pnDigits) {
  let vLocal = pnDigits;
  let vIntl = pnDigits;
  if (pnDigits.startsWith('855')) {
    vLocal = '0' + pnDigits.slice(3);
    vIntl = pnDigits;
  } else if (pnDigits.startsWith('0')) {
    vLocal = pnDigits;
    vIntl = '855' + pnDigits.slice(1);
  }
  return { vLocal, vIntl };
}

async function ensureTelegramUsersTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS telegram_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    chat_id BIGINT NULL,
    farmer_id INT NOT NULL,
    phone_number VARCHAR(50) NULL,
    is_verified TINYINT(1) NOT NULL DEFAULT 0,
    verified_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_telegram_user (telegram_user_id),
    KEY idx_chat_id (chat_id),
    KEY idx_farmer_id (farmer_id),
    KEY idx_phone (phone_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

async function ensureTelegramUsersSchema() {
  await ensureTelegramUsersTable();
  try { await db.query('ALTER TABLE telegram_users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0'); } catch (_) {}
  try { await db.query('ALTER TABLE telegram_users ADD COLUMN created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP'); } catch (_) {}
  try { await db.query('ALTER TABLE telegram_users ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'); } catch (_) {}
  try { await db.query('ALTER TABLE telegram_users ADD KEY idx_phone (phone_number)'); } catch (_) {}
  // Migrate existing rows: old flow treated any binding as verified.
  try { await db.query('UPDATE telegram_users SET is_verified = 1 WHERE is_verified = 0 AND verified_at IS NOT NULL'); } catch (_) {}
}

async function ensureTelegramOtpTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS telegram_otp_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    phone_number VARCHAR(50) NOT NULL,
    chat_id BIGINT NULL,
    otp_hash VARCHAR(128) NOT NULL,
    otp_salt VARCHAR(64) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    revoked_at DATETIME NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_tg_user (telegram_user_id),
    KEY idx_phone (phone_number),
    KEY idx_expires_at (expires_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

function getOtpConfig() {
  const ttlSeconds = Math.max(60, Math.min(15 * 60, parseInt(process.env.TELEGRAM_OTP_TTL_SECONDS || '300', 10) || 300));
  const maxAttempts = Math.max(1, Math.min(10, parseInt(process.env.TELEGRAM_OTP_MAX_ATTEMPTS || '3', 10) || 3));
  const secret = String(process.env.TELEGRAM_OTP_SECRET || process.env.JWT_SECRET || process.env.TELEGRAM_BOT_TOKEN || '');
  if (!secret) {
    throw new Error('TELEGRAM_OTP_SECRET (or JWT_SECRET) is not set');
  }
  return { ttlSeconds, maxAttempts, secret };
}

function hashOtp({ otp, salt, secret }) {
  return crypto.createHash('sha256').update(`${secret}:${salt}:${otp}`).digest('hex');
}

function timingSafeEqualHex(a, b) {
  try {
    const ba = Buffer.from(String(a || ''), 'hex');
    const bb = Buffer.from(String(b || ''), 'hex');
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch (_) {
    return false;
  }
}

async function ensureTelegramVerifyLogsTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS telegram_verify_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone_number VARCHAR(50) NOT NULL,
    telegram_user_id BIGINT NULL,
    chat_id BIGINT NULL,
    status VARCHAR(20) NOT NULL,
    error TEXT NULL,
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

// POST /api/telegram/verify/request-otp
async function requestOtp(req, res) {
  try {
    // Normalize payload: support stringified body and different casings / query params
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    payload = payload || {};
    const phoneNumber = (payload.phoneNumber ?? payload.phone_number)
      ?? (req.query && (req.query.phoneNumber ?? req.query.phone_number))
      ?? '';
    const telegramUserId = (payload.telegramUserId ?? payload.telegram_user_id)
      ?? (req.query && (req.query.telegramUserId ?? req.query.telegram_user_id))
      ?? 0;
    const chatId = (payload.chatId ?? payload.chat_id)
      ?? (req.query && (req.query.chatId ?? req.query.chat_id))
      ?? 0;
    const raw = String(phoneNumber || '').trim();
    const pnDigits = normalizePhoneDigits(raw);
    const pn = pnDigits; // canonical digits-only phone for binding
    const tgUserId = Number(telegramUserId || 0) || 0;
    const cid = Number(chatId || 0) || 0;

    if (!pnDigits || pnDigits.length < 6) {
      console.warn('[Telegram Verify] Invalid phone input', { raw, pnAscii, pnNoPunct, pnDigits });
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    await ensureTelegramUsersSchema();
    await ensureTelegramOtpTable();

    // If Telegram user is already verified, short-circuit.
    if (tgUserId) {
      const existingBind = await db.query('SELECT * FROM telegram_users WHERE telegram_user_id = ? LIMIT 1', [tgUserId]);
      if (existingBind && existingBind.length && Number(existingBind[0].is_verified) === 1) {
        const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [existingBind[0].farmer_id]);
        const farmer = farmerRows && farmerRows.length ? farmerRows[0] : null;
        if (farmer) {
          return res.json({ success: true, verified: true, farmer: {
            id: farmer.id,
            firstName: farmer.first_name,
            lastName: farmer.last_name,
            phoneNumber: farmer.phone_number,
            provinceCity: farmer.province_city,
            districtName: farmer.district_name,
            villageName: farmer.village_name
          } });
        }
      }
    }

    const { vLocal, vIntl } = buildCambodiaPhoneVariants(pnDigits);

    const rows = await db.query(
      `SELECT * FROM farmers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone_number,' ',''),'-',''),'+',''),'.','') IN (?, ?) LIMIT 1`,
      [vLocal, vIntl]
    );
    if (!rows || rows.length === 0) {
      await ensureTelegramVerifyLogsTable();
      await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status, error) VALUES (?, ?, ?, ?, ?)', [pn, tgUserId || null, cid || null, 'failed', 'not_found']);
      return res.status(404).json({ success: false, error: 'Invalid phone number' });
    }

    const farmer = rows[0];
    // Edge case: phone already linked to another verified Telegram user
    const other = await db.query(
      'SELECT telegram_user_id, is_verified FROM telegram_users WHERE phone_number = ? AND telegram_user_id <> ? LIMIT 1',
      [pn, tgUserId || 0]
    );
    if (other && other.length && Number(other[0].is_verified) === 1) {
      await ensureTelegramVerifyLogsTable();
      await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status, error) VALUES (?, ?, ?, ?, ?)', [pn, tgUserId || null, cid || null, 'failed', 'phone_linked']);
      return res.status(409).json({ success: false, error: 'Phone number already linked to another Telegram user' });
    }

    // Upsert telegram user binding (NOT verified yet)
    const existing = await db.query('SELECT * FROM telegram_users WHERE telegram_user_id = ? LIMIT 1', [tgUserId]);
    if (existing && existing.length) {
      await db.query(
        'UPDATE telegram_users SET farmer_id = ?, phone_number = ?, chat_id = ?, is_verified = 0, verified_at = NULL WHERE telegram_user_id = ?',
        [farmer.id, pn, cid || existing[0].chat_id, tgUserId]
      );
    } else {
      await db.query(
        'INSERT INTO telegram_users (telegram_user_id, chat_id, farmer_id, phone_number, is_verified, verified_at) VALUES (?, ?, ?, ?, 0, NULL)',
        [tgUserId, cid || null, farmer.id, pn]
      );
    }

    const { ttlSeconds, maxAttempts, secret } = getOtpConfig();
    await db.query(
      'UPDATE telegram_otp_codes SET revoked_at = NOW() WHERE telegram_user_id = ? AND phone_number = ? AND used_at IS NULL AND revoked_at IS NULL',
      [tgUserId, pn]
    );
    const otp = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const salt = crypto.randomBytes(16).toString('hex');
    const otpHash = hashOtp({ otp, salt, secret });
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await db.query(
      'INSERT INTO telegram_otp_codes (telegram_user_id, phone_number, chat_id, otp_hash, otp_salt, attempts, max_attempts, expires_at) VALUES (?,?,?,?,?,0,?,?)',
      [tgUserId, pn, cid || null, otpHash, salt, maxAttempts, expiresAt]
    );

    if (cid) {
      const mins = Math.max(1, Math.round(ttlSeconds / 60));
      const en = [
        '🔐 Your verification code (OTP) is:',
        `**${otp}**`,
        `This code expires in ${mins} minute(s).`,
        'Do not share this code with anyone.'
      ].join('\n');
      const kh = [
        '🔐 លេខកូដផ្ទៀងផ្ទាត់ (OTP) របស់អ្នក៖',
        `**${otp}**`,
        `លេខកូដនេះផុតកំណត់ក្នុងរយៈពេល ${mins} នាទី។`,
        'សូមកុំចែករំលែកលេខកូដនេះជាមួយអ្នកដទៃ។'
      ].join('\n');
      const msg = `${en}\n\n${kh}`;
      try { await telegram.sendMessage({ chatId: cid, text: msg, parseMode: 'Markdown' }); } catch (_) {}
    }

    try {
      await ensureTelegramVerifyLogsTable();
      await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status) VALUES (?, ?, ?, ?)', [pn, tgUserId || null, cid || null, 'otp_sent']);
    } catch (_) {}

    return res.json({ success: true, otpSent: true, expiresAt: expiresAt.toISOString(), phoneMasked: maskPhoneForLog(pn) });
  } catch (error) {
    console.error('[Telegram OTP] Error:', error);
    return res.status(500).json({ success: false, error: 'OTP request failed', message: error.message });
  }
}

// --- Status for Telegram: latest reading for farmer’s device ---
async function statusForTelegram(req, res) {
  try {
    const telegramUserId = Number(req.query.telegramUserId || req.query.telegram_id || 0) || 0;
    const chatId = Number(req.query.chatId || req.query.chat_id || 0) || 0;

    if (!telegramUserId && !chatId) {
      return res.status(400).json({ success: false, error: 'telegramUserId or chatId is required' });
    }

    await ensureTelegramUsersSchema();
    const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
    const idVal = telegramUserId ? telegramUserId : chatId;
    const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
    if (!binds || binds.length === 0 || Number(binds[0].is_verified) !== 1) {
      return res.status(403).json({ success: false, error: 'Not verified' });
    }

    const farmerId = binds[0].farmer_id;
    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
    if (!farmerRows || farmerRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }

    // Resolve device list from sensors service or legacy sensor_devices field
    const sensorsService = require('../services/sensors.service');
    const sensors = await sensorsService.getFarmerSensors(farmerId);
    const devicesFromJunction = sensors.map((s) => s.device_id).filter(Boolean);
    const legacyStr = farmerRows[0].sensor_devices || '';
    const legacyDevices = legacyStr ? legacyStr.split(',').map((d) => d.trim()).filter(Boolean) : [];
    const devices = devicesFromJunction.length ? devicesFromJunction : legacyDevices;
    if (!devices.length) {
      return res.status(400).json({ success: false, error: 'No sensor devices configured for this farmer' });
    }

    // For simplicity, use the first device for current status
    const deviceEsc = devices[0].replace(/'/g, "''");
    const latestSql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${deviceEsc}' ORDER BY time DESC LIMIT 1`;
    const latestRows = await sqlService.query(latestSql);
    const latest = Array.isArray(latestRows) && latestRows.length ? latestRows[0] : null;

    // Sanitize BigInt/Date before JSON serialization
    const sanitizeRow = (row) => {
      if (!row || typeof row !== 'object') return row;
      const out = {};
      for (const [k, v] of Object.entries(row)) out[k] = safeVal(v);
      return out;
    };

    return res.json({ success: true, device: devices[0], data: sanitizeRow(latest) });
  } catch (error) {
    console.error('[Telegram Status] Error:', error);
    const status = /Not verified|required|No sensor devices/.test(error.message || '') ? 400 : 500;
    return res.status(status).json({ success: false, error: 'Failed to fetch status', message: error.message });
  }
}

// Backward compatible: POST /api/telegram/verify now requests OTP.
module.exports.verify = requestOtp;
module.exports.requestOtp = requestOtp;
module.exports.statusForTelegram = statusForTelegram;

// POST /api/telegram/verify/confirm-otp
async function confirmOtp(req, res) {
  try {
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    payload = payload || {};
    const phoneNumber = (payload.phoneNumber ?? payload.phone_number) ?? '';
    const otpRaw = (payload.otp ?? payload.code ?? payload.otp_code) ?? '';
    const telegramUserId = Number((payload.telegramUserId ?? payload.telegram_user_id) ?? 0) || 0;
    const chatId = Number((payload.chatId ?? payload.chat_id) ?? 0) || 0;

    if (!telegramUserId || !chatId) {
      return res.status(400).json({ success: false, error: 'telegramUserId and chatId are required' });
    }

    const pn = normalizePhoneDigits(phoneNumber);
    const otp = normalizePhoneDigits(otpRaw);
    if (!pn || pn.length < 6) {
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }
    if (!otp || otp.length !== 4) {
      return res.status(400).json({ success: false, error: 'OTP must be 4 digits' });
    }

    await ensureTelegramUsersSchema();
    await ensureTelegramOtpTable();
    const { secret } = getOtpConfig();

    const rows = await db.query(
      `SELECT * FROM telegram_otp_codes
       WHERE telegram_user_id = ? AND phone_number = ?
         AND used_at IS NULL AND revoked_at IS NULL
       ORDER BY id DESC LIMIT 1`,
      [telegramUserId, pn]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, error: 'No active OTP. Please request a new code.' });
    }
    const rec = rows[0];
    const exp = rec.expires_at ? new Date(rec.expires_at) : null;
    if (!exp || exp.getTime() < Date.now()) {
      try { await db.query('UPDATE telegram_otp_codes SET revoked_at = NOW() WHERE id = ?', [rec.id]); } catch (_) {}
      return res.status(410).json({ success: false, error: 'OTP expired', expired: true });
    }
    const attempts = Number(rec.attempts || 0);
    const maxAttempts = Number(rec.max_attempts || 3);
    if (attempts >= maxAttempts) {
      return res.status(429).json({ success: false, error: 'Too many attempts. Please request a new code.', locked: true, attemptsLeft: 0 });
    }

    const expected = String(rec.otp_hash || '');
    const salt = String(rec.otp_salt || '');
    const actual = hashOtp({ otp, salt, secret });
    const ok = timingSafeEqualHex(actual, expected);
    if (!ok) {
      const nextAttempts = attempts + 1;
      const attemptsLeft = Math.max(0, maxAttempts - nextAttempts);
      await db.query('UPDATE telegram_otp_codes SET attempts = ? WHERE id = ?', [nextAttempts, rec.id]);
      return res.status(401).json({ success: false, error: 'Invalid OTP', attemptsLeft });
    }

    await db.query('UPDATE telegram_otp_codes SET used_at = NOW() WHERE id = ?', [rec.id]);
    await db.query(
      'UPDATE telegram_users SET is_verified = 1, verified_at = CURRENT_TIMESTAMP, chat_id = ? WHERE telegram_user_id = ? AND phone_number = ?',
      [chatId, telegramUserId, pn]
    );

    const binds = await db.query('SELECT * FROM telegram_users WHERE telegram_user_id = ? LIMIT 1', [telegramUserId]);
    if (!binds || !binds.length || Number(binds[0].is_verified) !== 1) {
      return res.status(500).json({ success: false, error: 'Verification state update failed' });
    }
    const farmerId = binds[0].farmer_id;
    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
    const farmer = farmerRows && farmerRows.length ? farmerRows[0] : null;
    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }
    try {
      await ensureTelegramVerifyLogsTable();
      await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status) VALUES (?, ?, ?, ?)', [pn, telegramUserId, chatId, 'verified']);
    } catch (_) {}

    return res.json({ success: true, verified: true, farmer: {
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      phoneNumber: farmer.phone_number,
      provinceCity: farmer.province_city,
      districtName: farmer.district_name,
      villageName: farmer.village_name
    } });
  } catch (error) {
    console.error('[Telegram OTP Confirm] Error:', error);
    return res.status(500).json({ success: false, error: 'OTP confirmation failed', message: error.message });
  }
}

module.exports.confirmOtp = confirmOtp;

// --- Weather for Telegram: proxy to backend weather bridge ---
async function weatherForTelegram(req, res) {
  try {
    let lat = req.query && req.query.lat ? Number(req.query.lat) : NaN;
    let lon = req.query && req.query.lon ? Number(req.query.lon) : NaN;

    // If lat/lon not provided, try to resolve from Telegram binding -> farmer province
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      const telegramUserId = Number(req.query.telegramUserId || req.query.telegram_id || 0) || 0;
      const chatId = Number(req.query.chatId || req.query.chat_id || 0) || 0;
      if (!telegramUserId && !chatId) {
        return res.status(400).json({ success: false, error: 'lat/lon or telegramUserId/chatId is required' });
      }

      await ensureTelegramUsersSchema();
      const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
      const idVal = telegramUserId ? telegramUserId : chatId;
      const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
      if (!binds || binds.length === 0 || Number(binds[0].is_verified) !== 1) {
        return res.status(403).json({ success: false, error: 'Not verified' });
      }
      const farmerId = binds[0].farmer_id;
      const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
      if (!farmerRows || farmerRows.length === 0) {
        return res.status(404).json({ success: false, error: 'Farmer not found' });
      }

      const pvRaw = String(farmerRows[0].province_city || '').trim();
      if (!pvRaw) {
        return res.status(400).json({ success: false, error: 'Farmer location not set' });
      }
      try {
        const MenuService = require('../bot/menus');
        const provinces = MenuService.ALL_PROVINCES || [];
        const match = provinces.find(p => {
          const en = String(p.en || '').trim().toLowerCase();
          const kh = String(p.kh || '').trim();
          return en === pvRaw.toLowerCase() || kh === pvRaw;
        });
        if (match && Number.isFinite(match.lat) && Number.isFinite(match.lon)) {
          lat = Number(match.lat);
          lon = Number(match.lon);
        }
      } catch (_) {}

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return res.status(400).json({ success: false, error: 'Unable to resolve location' });
      }
    }

    const dbService = require('../services/db.service');
    const data = await dbService.getWeather(lat, lon);
    if (!data) {
      return res.status(502).json({ success: false, error: 'Weather fetch failed' });
    }
    return res.json({ success: true, data });
  } catch (error) {
    console.error('[Telegram Weather] Error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch weather', message: error.message });
  }
}

module.exports.weatherForTelegram = weatherForTelegram;

// --- Check verification status: returns binding if exists ---
async function checkVerified(req, res) {
  try {
    // Normalize payload similar to verify()
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    payload = payload || {};
    const telegramUserId = Number((payload.telegramUserId ?? payload.telegram_user_id) ?? (req.query && (req.query.telegramUserId ?? req.query.telegram_user_id)) ?? 0) || 0;
    const chatId = Number((payload.chatId ?? payload.chat_id) ?? (req.query && (req.query.chatId ?? req.query.chat_id)) ?? 0) || 0;
    if (!telegramUserId && !chatId) {
      return res.status(400).json({ success: false, verified: false, error: 'telegramUserId or chatId is required' });
    }

    await ensureTelegramUsersSchema();
    const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
    const idVal = telegramUserId ? telegramUserId : chatId;
    const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
    if (!binds || binds.length === 0) {
      return res.json({ success: true, verified: false });
    }
    if (Number(binds[0].is_verified) !== 1) {
      return res.json({ success: true, verified: false, reason: 'otp_pending' });
    }
    const farmerId = binds[0].farmer_id;
    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ? LIMIT 1', [farmerId]);
    const farmer = farmerRows && farmerRows.length ? farmerRows[0] : null;
    if (!farmer) {
      // Cleanup stale binding to avoid confusion: farmer was deleted
      try {
        await db.query('DELETE FROM telegram_users WHERE id = ?', [binds[0].id]);
        console.warn('[Telegram Verify Check] Removed stale telegram_users binding', { telegram_user_id: binds[0].telegram_user_id, farmer_id: farmerId });
      } catch (_) {}
      return res.json({ success: true, verified: false, reason: 'farmer_deleted' });
    }
    return res.json({ success: true, verified: true, farmer: {
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      phoneNumber: farmer.phone_number,
      provinceCity: farmer.province_city,
      districtName: farmer.district_name,
      villageName: farmer.village_name
    } });
  } catch (error) {
    console.error('[Telegram Verify Check] Error:', error);
    return res.status(500).json({ success: false, verified: false, error: 'Failed to check verification', message: error.message });
  }
}

module.exports.checkVerified = checkVerified;