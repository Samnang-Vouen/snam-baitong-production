const telegram = require('../services/telegram.service');
const mqttService = require('../services/mqtt.service');
const sqlService = require('../services/sql');
const { formatTimestampLocal } = require('../utils/format');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';
const ALLOWED_FIELDS = (process.env.INFLUXDB_ALLOWED_FIELDS
  ? process.env.INFLUXDB_ALLOWED_FIELDS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['temperature','moisture','ec','ph','pH','nitrogen','phosphorus','potassium','salinity']);

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
    temperature: '°C',
    moisture: '%',
    ec: 'uS/cm',
    pH: '',
    nitrogen: '',
    phosphorus: '',
    potassium: '',
    salinity: ''
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
    if (baseCmd === '/update') {
      const latest = await fetchLatestRow();
      const msg = formatLatestMessage(latest);
      // Plain text to avoid Markdown parse issues
      await telegram.sendMessage({ chatId, text: msg });
    } else if (baseCmd === '/irrigate') {
      // Turn pump ON via MQTT
      try {
        await mqttService.publishPump(true);
        await telegram.sendMessage({ chatId, text: '✅ Pump turned ON' });
      } catch (e) {
        await telegram.sendMessage({ chatId, text: `❌ Failed to turn ON pump: ${e.message}` });
      }
    } else if (baseCmd === '/stop') {
      // Turn pump OFF via MQTT
      try {
        await mqttService.publishPump(false);
        await telegram.sendMessage({ chatId, text: '🛑 Pump turned OFF' });
      } catch (e) {
        await telegram.sendMessage({ chatId, text: `❌ Failed to turn OFF pump: ${e.message}` });
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    res.status(200).json({ ok: true });
  }
}

module.exports = { send, updates, sendLatest, webhook };