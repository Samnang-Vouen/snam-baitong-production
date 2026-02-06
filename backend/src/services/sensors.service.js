const mysql = require('./mysql');

/**
 * Get all sensors with optional filters
 */
async function getAllSensors(filters = {}) {
  let sql = 'SELECT * FROM sensors';
  const conditions = [];
  const params = [];
  let useAlias = false;

  if (filters.status) {
    conditions.push((useAlias ? 's.' : '') + 'status = ?');
    params.push(filters.status);
  }

  if (filters.sensor_type) {
    conditions.push((useAlias ? 's.' : '') + 'sensor_type = ?');
    params.push(filters.sensor_type);
  }

  if (filters.assigned !== undefined) {
    useAlias = true;
    if (filters.assigned) {
      // Show only assigned sensors
      sql = `
        SELECT s.*, COUNT(fs.id) as assignment_count
        FROM sensors s
        INNER JOIN farmer_sensors fs ON s.id = fs.sensor_id AND fs.is_active = 1
      `;
    } else {
      // Show only unassigned sensors
      sql = `
        SELECT s.*, 0 as assignment_count
        FROM sensors s
        LEFT JOIN farmer_sensors fs ON s.id = fs.sensor_id AND fs.is_active = 1
        WHERE fs.id IS NULL
      `;
    }
  }

  if (conditions.length > 0) {
    // Update conditions to use alias if needed
    if (useAlias && !conditions[0].includes('s.')) {
      conditions[0] = 's.' + conditions[0];
    }
    sql += (sql.includes('WHERE') ? ' AND ' : ' WHERE ') + conditions.join(' AND ');
  }

  if (filters.assigned) {
    sql += ' GROUP BY s.id';
  }

  sql += ' ORDER BY ' + (useAlias ? 's.' : '') + 'created_at DESC';

  return await mysql.query(sql, params);
}

/**
 * Get sensor by ID
 */
async function getSensorById(sensorId) {
  const sensors = await mysql.query(
    'SELECT * FROM sensors WHERE id = ?',
    [sensorId]
  );
  return sensors.length > 0 ? sensors[0] : null;
}

/**
 * Get sensor by device ID
 */
async function getSensorByDeviceId(deviceId) {
  const sensors = await mysql.query(
    'SELECT * FROM sensors WHERE device_id = ?',
    [deviceId]
  );
  return sensors.length > 0 ? sensors[0] : null;
}

/**
 * Create a new sensor
 */
async function createSensor(sensorData) {
  const {
    device_id,
    sensor_type = 'soil',
    model = null,
    status = 'active',
    installation_date = null,
    location_tag = null,
    physical_location = null,
    notes = null
  } = sensorData;

  // Check if sensor already exists
  const existing = await getSensorByDeviceId(device_id);
  if (existing) {
    throw new Error(`Sensor with device_id ${device_id} already exists`);
  }

  const result = await mysql.query(
    `INSERT INTO sensors 
    (device_id, sensor_type, model, status, installation_date, location_tag, physical_location, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [device_id, sensor_type, model, status, installation_date, location_tag, physical_location, notes]
  );

  return await getSensorById(result.insertId);
}

/**
 * Update sensor
 */
async function updateSensor(sensorId, updates) {
  const allowedFields = [
    'device_id', 'sensor_type', 'model', 'status', 
    'installation_date', 'location_tag', 'physical_location', 
    'notes', 'last_seen'
  ];

  const fields = [];
  const values = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  });

  if (fields.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(sensorId);

  await mysql.query(
    `UPDATE sensors SET ${fields.join(', ')} WHERE id = ?`,
    values
  );

  return await getSensorById(sensorId);
}

/**
 * Delete sensor
 */
async function deleteSensor(sensorId) {
  // This will cascade delete farmer_sensors relationships
  await mysql.query('DELETE FROM sensors WHERE id = ?', [sensorId]);
  return true;
}

/**
 * Update sensor last_seen timestamp
 */
async function updateLastSeen(deviceId, timestamp = null) {
  const time = timestamp || new Date();
  await mysql.query(
    'UPDATE sensors SET last_seen = ? WHERE device_id = ?',
    [time, deviceId]
  );
}

/**
 * Get all sensors assigned to a farmer
 */
async function getFarmerSensors(farmerId) {
  try {
    const rows = await mysql.query(
      `SELECT 
        s.id,
        s.device_id,
        s.sensor_type,
        s.model,
        s.status,
        s.installation_date,
        s.last_seen,
        s.location_tag,
        s.physical_location,
        fs.assigned_at,
        fs.notes as assignment_notes
      FROM sensors s
      JOIN farmer_sensors fs ON s.id = fs.sensor_id
      WHERE fs.farmer_id = ? AND fs.is_active = 1
      ORDER BY fs.assigned_at DESC`,
      [farmerId]
    );
    return rows || [];
  } catch (err) {
    // If the new tables do not exist yet, return empty list to allow legacy fallback
    const msg = String(err && (err.sqlMessage || err.message) || '').toLowerCase();
    if (err && err.code === 'ER_NO_SUCH_TABLE' || msg.includes('farmer_sensors') || msg.includes("table '") && msg.includes('sensors')) {
      return [];
    }
    throw err;
  }
}

/**
 * Get farmer IDs for a sensor
 */
async function getSensorFarmers(sensorId) {
  const rows = await mysql.query(
    `SELECT 
      f.id,
      f.first_name,
      f.last_name,
      f.phone_number,
      f.district_name,
      f.province_city,
      fs.assigned_at
    FROM farmers f
    JOIN farmer_sensors fs ON f.id = fs.farmer_id
    WHERE fs.sensor_id = ? AND fs.is_active = 1
    ORDER BY fs.assigned_at DESC`,
    [sensorId]
  );

  return rows || [];
}

/**
 * Assign sensor to farmer
 */
async function assignSensorToFarmer(farmerId, deviceId, notes = null) {
  // Get sensor by device_id
  const sensor = await getSensorByDeviceId(deviceId);
  
  if (!sensor) {
    throw new Error(`Sensor with device_id ${deviceId} not found`);
  }

  // Check if already assigned
  const existing = await mysql.query(
    'SELECT id FROM farmer_sensors WHERE farmer_id = ? AND sensor_id = ? AND is_active = 1',
    [farmerId, sensor.id]
  );

  if (existing.length > 0) {
    throw new Error(`Sensor ${deviceId} is already assigned to this farmer`);
  }

  // Insert assignment
  await mysql.query(
    `INSERT INTO farmer_sensors (farmer_id, sensor_id, is_active, notes)
    VALUES (?, ?, 1, ?)`,
    [farmerId, sensor.id, notes]
  );

  return sensor;
}

/**
 * Assign multiple sensors to farmer
 */
async function assignMultipleSensors(farmerId, deviceIds, notes = null) {
  const results = {
    success: [],
    failed: []
  };

  for (const deviceId of deviceIds) {
    try {
      const sensor = await assignSensorToFarmer(farmerId, deviceId, notes);
      results.success.push({ deviceId, sensor });
    } catch (error) {
      results.failed.push({ deviceId, error: error.message });
    }
  }

  return results;
}

/**
 * Unassign sensor from farmer
 */
async function unassignSensorFromFarmer(farmerId, sensorId) {
  const result = await mysql.query(
    `UPDATE farmer_sensors 
    SET is_active = 0, unassigned_at = NOW()
    WHERE farmer_id = ? AND sensor_id = ? AND is_active = 1`,
    [farmerId, sensorId]
  );

  if (result.affectedRows === 0) {
    throw new Error('Sensor assignment not found or already inactive');
  }

  return true;
}

/**
 * Get sensor assignment history
 */
async function getSensorHistory(sensorId) {
  const rows = await mysql.query(
    `SELECT 
      fs.*,
      f.first_name,
      f.last_name,
      f.phone_number
    FROM farmer_sensors fs
    JOIN farmers f ON fs.farmer_id = f.id
    WHERE fs.sensor_id = ?
    ORDER BY fs.assigned_at DESC`,
    [sensorId]
  );

  return rows || [];
}

/**
 * Get farmer's sensor assignment history
 */
async function getFarmerSensorHistory(farmerId) {
  const rows = await mysql.query(
    `SELECT 
      fs.*,
      s.device_id,
      s.sensor_type,
      s.model
    FROM farmer_sensors fs
    JOIN sensors s ON fs.sensor_id = s.id
    WHERE fs.farmer_id = ?
    ORDER BY fs.assigned_at DESC`,
    [farmerId]
  );

  return rows || [];
}

/**
 * Get offline sensors (no data in specified hours)
 */
async function getOfflineSensors(hoursThreshold = 1) {
  const rows = await mysql.query(
    `SELECT * FROM sensors 
    WHERE status = 'active' 
    AND (last_seen IS NULL OR last_seen < DATE_SUB(NOW(), INTERVAL ? HOUR))
    ORDER BY last_seen ASC`,
    [hoursThreshold]
  );

  return rows || [];
}

module.exports = {
  getAllSensors,
  getSensorById,
  getSensorByDeviceId,
  createSensor,
  updateSensor,
  deleteSensor,
  updateLastSeen,
  getFarmerSensors,
  getSensorFarmers,
  assignSensorToFarmer,
  assignMultipleSensors,
  unassignSensorFromFarmer,
  getSensorHistory,
  getFarmerSensorHistory,
  getOfflineSensors
};
