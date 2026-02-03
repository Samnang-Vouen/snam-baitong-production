const db = require('../services/mysql');

async function ensureSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS plants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    farmer_image_url TEXT NULL,
    farm_location VARCHAR(255) NOT NULL,
    plant_name VARCHAR(255) NOT NULL,
    planted_date DATE NULL,
    harvest_date DATE NULL,
    status VARCHAR(50) DEFAULT 'well_planted',
    ministry_feedback TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS qr_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    plant_id BIGINT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    INDEX idx_qr_token (token),
    INDEX idx_qr_plant (plant_id),
    CONSTRAINT fk_qr_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
  )`);
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
    res.json({ success: true, data: rows });
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
    res.json({ success: true, data: rows[0] });
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
    
    // Delete the plant (CASCADE will handle qr_tokens)
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
