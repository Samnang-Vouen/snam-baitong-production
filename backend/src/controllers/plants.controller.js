const db = require('../services/mysql');

async function ensureSchema() {
  // Create base tables (compatible with older init scripts)
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

  // Add missing columns for installations that already have a different plants schema
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

  // Create QR tokens table WITHOUT a foreign key.
  // Older DBs may have plants.id as INT while newer code uses BIGINT; FK creation fails with errno 150.
  // We handle cleanup manually on delete.
  await db.query(`CREATE TABLE IF NOT EXISTS qr_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plant_id BIGINT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    INDEX idx_qr_token (token),
    INDEX idx_qr_plant (plant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);
}

function toPlantDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    plantName: row.plant_name,
    farmLocation: row.farm_location || row.location || null,
    farmerImage: row.farmer_image_url || null,
    plantedDate: row.planted_date ? new Date(row.planted_date).toISOString() : null,
    harvestDate: row.harvest_date ? new Date(row.harvest_date).toISOString() : null,
    status: row.status || 'well_planted',
    ministryFeedback: row.ministry_feedback || null,
    qrToken: row.qr_token || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    type: 'crop',
  };
}

async function createPlant(req, res) {
  try {
    await ensureSchema();
    const { farmerImage, farmLocation, plantName, plantedDate, harvestDate } = req.body || {};
    if (!farmLocation || !plantName) {
      return res.status(400).json({ success: false, error: 'farmLocation and plantName are required' });
    }
    const sql = `INSERT INTO plants (farmer_image_url, farm_location, plant_name, planted_date, harvest_date)
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [farmerImage || null, farmLocation, plantName, plantedDate || null, harvestDate || null];
    const result = await db.query(sql, params);
    const plantId = result.insertId;
    res.json({ success: true, plantId });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create plant', message: err.message });
  }
}

async function getPlants(req, res) {
  try {
    await ensureSchema();
    const { includeLatest } = req.query;
    const rows = await db.query('SELECT * FROM plants ORDER BY created_at DESC');
    res.json({ success: true, data: rows.map(toPlantDto) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get plants', message: err.message });
  }
}

async function getPlant(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM plants WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Plant not found' });
    res.json({ success: true, data: toPlantDto(rows[0]) });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get plant', message: err.message });
  }
}

async function deletePlant(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    
    // Check if plant exists
    const rows = await db.query('SELECT * FROM plants WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }

    // Best-effort cleanup of QR tokens (no FK constraint for cross-schema compatibility)
    await db.query('DELETE FROM qr_tokens WHERE plant_id = ?', [id]);

    // Delete the plant
    await db.query('DELETE FROM plants WHERE id = ?', [id]);
    
    res.json({ success: true, message: 'Plant deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete plant', message: err.message });
  }
}

async function updatePlant(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    const { status, ministryFeedback } = req.body || {};
    
    // Check if plant exists
    const rows = await db.query('SELECT * FROM plants WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Plant not found' });
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    
    if (ministryFeedback !== undefined) {
      // Limit to 600 characters
      const feedback = ministryFeedback ? ministryFeedback.slice(0, 600) : null;
      updates.push('ministry_feedback = ?');
      params.push(feedback);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    params.push(id);
    const sql = `UPDATE plants SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    
    // Fetch and return updated plant
    const updated = await db.query('SELECT * FROM plants WHERE id = ?', [id]);
    res.json({ success: true, data: updated[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update plant', message: err.message });
  }
}

module.exports = { createPlant, getPlants, getPlant, deletePlant, updatePlant };
