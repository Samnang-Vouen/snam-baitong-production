const telegram = require('../services/telegram.service');
const mqttService = require('../services/mqtt.service');
const sqlService = require('../services/sql');
const db = require('../services/mysql');
const { formatTimestampLocal } = require('../utils/format');

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
async function ensureTelegramUsersTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS telegram_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL,
    chat_id BIGINT NULL,
    farmer_id INT NOT NULL,
    phone_number VARCHAR(50) NULL,
    verified_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_telegram_user (telegram_user_id),
    KEY idx_chat_id (chat_id),
    KEY idx_farmer_id (farmer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

async function verify(req, res) {
  try {
    // Normalize payload: support stringified body and different casings / query params
    let payload = req.body;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { payload = {}; }
    }
    payload = payload || {};
    const phoneNumberDigits = (payload.phoneNumberDigits ?? payload.phone_number_digits)
      ?? (req.query && (req.query.phoneNumberDigits ?? req.query.phone_number_digits))
      ?? '';
    const phoneNumber = (payload.phoneNumber ?? payload.phone_number)
      ?? (req.query && (req.query.phoneNumber ?? req.query.phone_number))
      ?? '';
    const telegramUserId = (payload.telegramUserId ?? payload.telegram_user_id)
      ?? (req.query && (req.query.telegramUserId ?? req.query.telegram_user_id))
      ?? 0;
    const chatId = (payload.chatId ?? payload.chat_id)
      ?? (req.query && (req.query.chatId ?? req.query.chat_id))
      ?? 0;
    // Debug minimal log (no PII beyond phone) for troubleshooting input capture
    if (!phoneNumber) {
      console.warn('[Telegram Verify] Missing phoneNumber in request', { bodyType: typeof req.body, bodyKeys: Object.keys(payload || {}), queryKeys: Object.keys(req.query || {}) });
    }
    // Convert numerals from various scripts to ASCII 0-9 (robust)
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
    const onlyAsciiDigits = (s) => String(s || '').replace(/[^0-9]/g, '');
    const stripPunct = (s) => String(s || '').replace(/[\s\-+\.]/g, '');

    const raw = String(phoneNumberDigits || phoneNumber || '').trim();
    const pnAscii = toEnglishDigits(raw);
    const pnNoPunct = stripPunct(pnAscii);
    const pnDigits = onlyAsciiDigits(pnAscii);
    const pn = pnDigits; // canonical digits-only phone for logging/binding
    const tgUserId = Number(telegramUserId || 0) || 0;
    const cid = Number(chatId || 0) || 0;

    if (!pnDigits || pnDigits.length < 6) {
      console.warn('[Telegram Verify] Invalid phone input', { raw, pnAscii, pnNoPunct, pnDigits });
      return res.status(400).json({ success: false, error: 'Invalid phone number format' });
    }

    await ensureTelegramUsersTable();
    // Build match variants (Cambodia: local 0xxx vs +855xxx)
    let vLocal = pnDigits;
    let vIntl = pnDigits;
    if (pnDigits.startsWith('855')) {
      vLocal = '0' + pnDigits.slice(3);
      vIntl = pnDigits; // already intl
    } else if (pnDigits.startsWith('0')) {
      vLocal = pnDigits; // local
      vIntl = '855' + pnDigits.slice(1);
    }

    const rows = await db.query(
      `SELECT * FROM farmers WHERE REPLACE(REPLACE(REPLACE(REPLACE(phone_number,' ',''),'-',''),'+',''),'.','') IN (?, ?) LIMIT 1`,
      [vLocal, vIntl]
    );
    if (!rows || rows.length === 0) {
      // Log failed attempt to audit table
      await db.query(`CREATE TABLE IF NOT EXISTS telegram_verify_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        phone_number VARCHAR(50) NOT NULL,
        telegram_user_id BIGINT NULL,
        chat_id BIGINT NULL,
        status VARCHAR(20) NOT NULL,
        error TEXT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
      await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status, error) VALUES (?, ?, ?, ?, ?)', [pn, tgUserId || null, cid || null, 'failed', 'not_found']);
      console.warn(`[Telegram Verify] Failed attempt: phone=${pn}, tgUserId=${tgUserId}, chatId=${cid}`);
      return res.status(404).json({ success: false, error: 'Invalid phone number' });
    }

    const farmer = rows[0];
    // Upsert telegram user binding
    // If record exists, update; else insert
    const existing = await db.query('SELECT * FROM telegram_users WHERE telegram_user_id = ? LIMIT 1', [tgUserId]);
    if (existing && existing.length) {
      await db.query('UPDATE telegram_users SET farmer_id = ?, phone_number = ?, chat_id = ?, verified_at = CURRENT_TIMESTAMP WHERE telegram_user_id = ?', [farmer.id, pn, cid || existing[0].chat_id, tgUserId]);
    } else {
      await db.query('INSERT INTO telegram_users (telegram_user_id, chat_id, farmer_id, phone_number, verified_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)', [tgUserId, cid || null, farmer.id, pn]);
    }

    // Ensure audit table exists and log success
    await db.query(`CREATE TABLE IF NOT EXISTS telegram_verify_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone_number VARCHAR(50) NOT NULL,
      telegram_user_id BIGINT NULL,
      chat_id BIGINT NULL,
      status VARCHAR(20) NOT NULL,
      error TEXT NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
    await db.query('INSERT INTO telegram_verify_logs (phone_number, telegram_user_id, chat_id, status) VALUES (?, ?, ?, ?)', [pn, tgUserId || null, cid || null, 'success']);

    // Notify user via Telegram from backend with farmer information
    if (cid) {
      const name = `${farmer.first_name || ''} ${farmer.last_name || ''}`.trim();
      const location = `${farmer.village_name || ''}, ${farmer.district_name || ''}, ${farmer.province_city || ''}`.replace(/(^[\s,]+|[\s,]+$)/g, '').trim();
      const crop = String(farmer.crop_type || '').trim();

      // Resolve sensor devices via junction table (new) or legacy string
      let devices = [];
      try {
        const sensorsService = require('../services/sensors.service');
        const sensors = await sensorsService.getFarmerSensors(farmer.id);
        const deviceIdsFromJunction = sensors.map(s => s.device_id).filter(Boolean);
        const legacyStr = farmer.sensor_devices || '';
        const legacyDevices = legacyStr ? legacyStr.split(',').map(d => d.trim()).filter(Boolean) : [];
        devices = deviceIdsFromJunction.length ? deviceIdsFromJunction : legacyDevices;
      } catch (_) {}
      const devicesText = devices.length ? devices.join(', ') : 'None';

      const en = [
        '✅ Login successful',
        '👤 Farmer Information',
        name ? `- Name: ${name}` : null,
        farmer.phone_number ? `- Phone: ${farmer.phone_number}` : null,
        location ? `- Location: ${location}` : null,
        crop ? `- Crop: ${crop}` : null,
        `- Sensor Devices: ${devicesText}`
      ].filter(Boolean).join('\n');

      const kh = [
        '🇰🇭 បានផ្ទៀងផ្ទាត់ជោគជ័យ',
        '👤 ព័ត៌មានកសិករ',
        name ? `- ឈ្មោះ: ${name}` : null,
        farmer.phone_number ? `- ទូរស័ព្ទ: ${farmer.phone_number}` : null,
        location ? `- ទីតាំង: ${location}` : null,
        crop ? `- ប្រភេទដំណាំ: ${crop}` : null,
        `- ឧបករណ៍សិនស័រ: ${devicesText}`
      ].filter(Boolean).join('\n');

      const msg = `${en}\n\n${kh}`;
      try { await telegram.sendMessage({ chatId: cid, text: msg, parseMode: 'Markdown' }); } catch (_) {}
    }

    return res.json({ success: true, verified: true, farmer: {
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      phoneNumber: farmer.phone_number,
      provinceCity: farmer.province_city,
      districtName: farmer.district_name,
      villageName: farmer.village_name
    }});
  } catch (error) {
    console.error('[Telegram Verify] Error:', error);
    return res.status(500).json({ success: false, error: 'Verification failed', message: error.message });
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

    await ensureTelegramUsersTable();
    const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
    const idVal = telegramUserId ? telegramUserId : chatId;
    const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
    if (!binds || binds.length === 0) {
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

module.exports.verify = verify;
module.exports.statusForTelegram = statusForTelegram;

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

      await ensureTelegramUsersTable();
      const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
      const idVal = telegramUserId ? telegramUserId : chatId;
      const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
      if (!binds || binds.length === 0) {
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

    await ensureTelegramUsersTable();
    const where = telegramUserId ? 'telegram_user_id = ?' : 'chat_id = ?';
    const idVal = telegramUserId ? telegramUserId : chatId;
    const binds = await db.query(`SELECT * FROM telegram_users WHERE ${where} LIMIT 1`, [idVal]);
    if (!binds || binds.length === 0) {
      return res.json({ success: true, verified: false });
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