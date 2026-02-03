const db = require('../services/mysql');
const sqlService = require('../services/sql');
const { formatTimestampLocal } = require('../utils/format');
const { generateToken, generateQrDataUrl } = require('../utils/qr');
const { computePlantStatus } = require('../utils/status');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';
const ALLOWED_FIELDS = (process.env.INFLUXDB_ALLOWED_FIELDS
  ? process.env.INFLUXDB_ALLOWED_FIELDS.split(',').map((s) => s.trim()).filter(Boolean)
  : ['temperature','moisture','ec','ph','pH','nitrogen','phosphorus','potassium','salinity']);

function buildPublicQrUrl(req, token) {
  const configuredBase = (process.env.CROP_QR_BASE_URL || process.env.QR_BASE_URL || '').trim();
  if (configuredBase) {
    if (configuredBase.includes('{token}')) {
      return configuredBase.replace('{token}', encodeURIComponent(token));
    }
    if (configuredBase.includes(':token')) {
      return configuredBase.replace(':token', encodeURIComponent(token));
    }
    const base = configuredBase.replace(/\/$/, '');
    if (base.includes('?')) {
      return `${base}${base.endsWith('?') || base.endsWith('&') ? '' : '&'}token=${encodeURIComponent(token)}`;
    }
    return `${base}/${encodeURIComponent(token)}`;
  }

  const origin = `${req.protocol}://${req.get('host')}`;
  return `${origin}/public/crop/${encodeURIComponent(token)}`;
}

function safeVal(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

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

async function ensureSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS qr_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plant_id BIGINT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    INDEX idx_qr_token (token),
    INDEX idx_qr_plant (plant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function ensurePlantsSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS plants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plant_name VARCHAR(255) NOT NULL,
    farmer_name VARCHAR(255) NULL,
    location VARCHAR(255) NULL,
    device_id VARCHAR(100) NULL,
    qr_token VARCHAR(64) NULL,
    farmer_image_url TEXT NULL,
    farm_location VARCHAR(255) NULL,
    planted_date DATE NULL,
    harvest_date DATE NULL,
    status VARCHAR(50) DEFAULT 'well_planted',
    ministry_feedback TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plants_qr_token (qr_token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

  const addColumnIfMissing = async (sql) => {
    try {
      await db.query(sql);
    } catch (err) {
      const msg = String(err && err.message ? err.message : '');
      if (!msg.includes('Duplicate column name')) throw err;
    }
  };

  await addColumnIfMissing('ALTER TABLE plants ADD COLUMN farmer_image_url TEXT NULL');
  await addColumnIfMissing('ALTER TABLE plants ADD COLUMN farm_location VARCHAR(255) NULL');
  await addColumnIfMissing('ALTER TABLE plants ADD COLUMN planted_date DATE NULL');
  await addColumnIfMissing('ALTER TABLE plants ADD COLUMN harvest_date DATE NULL');
  await addColumnIfMissing("ALTER TABLE plants ADD COLUMN status VARCHAR(50) DEFAULT 'well_planted'");
  await addColumnIfMissing('ALTER TABLE plants ADD COLUMN ministry_feedback TEXT NULL');
}

async function generateQr(req, res) {
  try {
    await ensureSchema();
    const { plantId, expiresAt } = req.body || {};
    if (!plantId || !expiresAt) {
      return res.status(400).json({ success: false, error: 'plantId and expiresAt are required' });
    }
    const plants = await db.query('SELECT * FROM plants WHERE id = ?', [plantId]);
    if (!plants.length) return res.status(404).json({ success: false, error: 'Plant not found' });

    const token = generateToken(32);
    const url = buildPublicQrUrl(req, token);

    await db.query('INSERT INTO qr_tokens (plant_id, token, expires_at) VALUES (?, ?, ?)', [plantId, token, new Date(expiresAt)]);
    const qrDataUrl = await generateQrDataUrl(url);

    res.json({ success: true, data: { token, expiresAt: new Date(expiresAt).toISOString(), url, qrDataUrl } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to generate QR', message: err.message });
  }
}

async function getAggregatedByToken(req, res) {
  try {
    const { token } = req.params;
    const rows = await db.query('SELECT * FROM qr_tokens WHERE token = ? AND (revoked_at IS NULL)', [token]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Invalid token' });
    const qr = rows[0];
    const now = new Date();
    const exp = new Date(qr.expires_at);
    const valid = now <= exp;
    if (!valid) return res.status(410).json({ success: false, error: 'QR token expired', expiresAt: exp.toISOString() });

    const plants = await db.query('SELECT * FROM plants WHERE id = ?', [qr.plant_id]);
    if (!plants.length) return res.status(404).json({ success: false, error: 'Plant not found for token' });
    const plant = plants[0];

    const where = buildWhere();
    const sql = `SELECT * FROM "${MEASUREMENT}" ${where} ORDER BY time DESC LIMIT 1`;
    const result = await sqlService.query(sql);
    const latest = Array.isArray(result) && result.length ? result[0] : null;

    const data = {};
    if (latest) {
      for (const f of ALLOWED_FIELDS) {
        if (f in latest) {
          data[f] = { value: safeVal(latest[f]), time: formatTimestampLocal(latest.time ?? null, { includeTZName: true }), unit: '' };
        }
      }
    }

    const snapshot = data;
    const status = computePlantStatus(snapshot);

    res.json({
      success: true,
      meta: {
        farmerImage: plant.farmer_image_url || null,
        farmLocation: plant.farm_location,
        plantName: plant.plant_name,
        plantedDate: plant.planted_date ? new Date(plant.planted_date).toISOString() : null,
        harvestDate: plant.harvest_date ? new Date(plant.harvest_date).toISOString() : null,
      },
      status,
      data: snapshot,
      location: latest ? safeVal(latest.location ?? null) : null,
      qr: { expiresAt: exp.toISOString(), valid: true },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch aggregated data', message: err.message });
  }
}

async function listTokens(req, res) {
  try {
    if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    await ensureSchema();
    const includeExpired = String(req.query?.includeExpired || '').toLowerCase() === 'true';
    const includeRevoked = String(req.query?.includeRevoked || '').toLowerCase() === 'true';
    const limit = Math.min(Math.max(parseInt(req.query?.limit || '50', 10) || 50, 1), 200);

    const where = [];
    if (!includeRevoked) where.push('(qt.revoked_at IS NULL)');
    if (!includeExpired) where.push('(qt.expires_at >= NOW())');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await db.query(
      `SELECT qt.id, qt.plant_id, qt.token, qt.expires_at, qt.created_at, qt.revoked_at,
              p.plant_name, p.farm_location
       FROM qr_tokens qt
       LEFT JOIN plants p ON p.id = qt.plant_id
       ${whereSql}
       ORDER BY qt.created_at DESC
       LIMIT ${limit}`
    );

    const now = new Date();
    const data = rows.map((r) => {
      const exp = r.expires_at ? new Date(r.expires_at) : null;
      return {
        id: safeVal(r.id),
        plantId: safeVal(r.plant_id),
        token: r.token,
        plantName: r.plant_name || null,
        farmLocation: r.farm_location || null,
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : null,
        revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
        expiresAt: exp ? exp.toISOString() : null,
        valid: exp ? now <= exp && !r.revoked_at : false,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list QR tokens', message: err.message });
  }
}

async function devSeed(req, res) {
  try {
    if (String(process.env.NODE_ENV).toLowerCase() === 'production') {
      return res.status(404).json({ success: false, error: 'Not found' });
    }

    await ensurePlantsSchema();
    await ensureSchema();

    const body = req.body || {};
    const plantName = body.plantName || 'Demo Crop';
    const farmLocation = body.farmLocation || 'Demo Farm';
    const expiresAt = body.expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const plantResult = await db.query(
      'INSERT INTO plants (farmer_image_url, farm_location, plant_name, planted_date, harvest_date) VALUES (?, ?, ?, ?, ?)',
      [body.farmerImage || null, farmLocation, plantName, body.plantedDate || null, body.harvestDate || null]
    );
    const plantId = plantResult.insertId;

    const token = generateToken(32);
    const url = buildPublicQrUrl(req, token);
    await db.query(
      'INSERT INTO qr_tokens (plant_id, token, expires_at) VALUES (?, ?, ?)',
      [plantId, token, new Date(expiresAt)]
    );
    const qrDataUrl = await generateQrDataUrl(url);

    res.json({
      success: true,
      data: {
        plantId,
        token,
        expiresAt: new Date(expiresAt).toISOString(),
        url,
        qrDataUrl,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to seed QR', message: err.message });
  }
}

module.exports = { generateQr, getAggregatedByToken, listTokens, devSeed };
