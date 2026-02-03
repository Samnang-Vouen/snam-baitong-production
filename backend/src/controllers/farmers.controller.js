const db = require('../services/mysql');
const sqlService = require('../services/sql');
const sensorsService = require('../services/sensors.service');
const { formatTimestampLocal } = require('../utils/format');
const { v4: uuidv4 } = require('uuid');
const soilHealthService = require('../services/soilHealth.service');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';

// Helper function to safely convert values (including BigInt)
function safeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value;
  return String(value);
}

function normalizeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function ensureSchema() {
  await db.query(`CREATE TABLE IF NOT EXISTS farmers (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) NULL,
    phone_number VARCHAR(50) NOT NULL,
    profile_image_url TEXT NULL,
    crop_type VARCHAR(255) NOT NULL,
    village_name VARCHAR(255) NOT NULL,
    district_name VARCHAR(255) NOT NULL,
    province_city VARCHAR(255) NOT NULL,
    planting_date DATE NOT NULL,
    harvest_date DATE NOT NULL,
    sensor_devices TEXT NULL COMMENT 'Comma-separated list of sensor device IDs',
    ministry_feedback TEXT NULL,
    ministry_feedback_updated_at TIMESTAMP NULL,
    ministry_feedback_viewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  const addColumnIfMissing = async (sql) => {
    try {
      await db.query(sql);
    } catch (err) {
      const msg = String(err && err.message ? err.message : '');
      if (!msg.includes('Duplicate column name')) throw err;
    }
  };

  const modifyColumnIfPossible = async (sql) => {
    try {
      await db.query(sql);
    } catch (err) {
      const msg = String(err && err.message ? err.message : '');
      if (msg.includes('Unknown column') || msg.includes('Check that column/key exists')) return;
      throw err;
    }
  };
  
  // Add gender column if it doesn't exist (for existing tables)
  try {
    await db.query(`ALTER TABLE farmers ADD COLUMN gender VARCHAR(20) NULL`);
    console.log('Added gender column to farmers table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.error('Error adding gender column:', err);
    }
  }
  
  // Add qr_expiration_days column if it doesn't exist
  try {
    await db.query(`ALTER TABLE farmers ADD COLUMN qr_expiration_days INT DEFAULT 365`);
    console.log('Added qr_expiration_days column to farmers table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.error('Error adding qr_expiration_days column:', err);
    }
  }
  
  // Add ministry_feedback column if it doesn't exist (for existing tables)
  try {
    await db.query(`ALTER TABLE farmers ADD COLUMN ministry_feedback TEXT NULL`);
    console.log('Added ministry_feedback column to farmers table');
  } catch (err) {
    // Column already exists, ignore error
    if (!err.message.includes('Duplicate column name')) {
      console.error('Error adding ministry_feedback column:', err);
    }
  }

  // Add tracking columns for feedback viewing
  try {
    await db.query(`ALTER TABLE farmers ADD COLUMN ministry_feedback_updated_at TIMESTAMP NULL`);
    console.log('Added ministry_feedback_updated_at column to farmers table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.error('Error adding ministry_feedback_updated_at column:', err);
    }
  }

  try {
    await db.query(`ALTER TABLE farmers ADD COLUMN ministry_feedback_viewed_at TIMESTAMP NULL`);
    console.log('Added ministry_feedback_viewed_at column to farmers table');
  } catch (err) {
    if (!err.message.includes('Duplicate column name')) {
      console.error('Error adding ministry_feedback_viewed_at column:', err);
    }
  }

  // Legacy compatibility: older init scripts created a different farmers schema.
  // Add old columns if missing so inserts won't fail on strict NOT NULL legacy columns.
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN farmer_name VARCHAR(255) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN location VARCHAR(255) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN latitude DECIMAL(10, 8) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN longitude DECIMAL(11, 8) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN contact VARCHAR(100) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN device_id VARCHAR(100) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN qr_token VARCHAR(64) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN profile_image VARCHAR(500) NULL');
  await addColumnIfMissing('ALTER TABLE farmers ADD COLUMN sensor_devices TEXT NULL');

  // Relax legacy NOT NULL farmer_name/location if they exist and were created strict.
  await modifyColumnIfPossible('ALTER TABLE farmers MODIFY COLUMN farmer_name VARCHAR(255) NULL');
  await modifyColumnIfPossible('ALTER TABLE farmers MODIFY COLUMN location VARCHAR(255) NULL');
  
  // Create QR tokens table for farmers
  // No FK here: legacy databases may have farmers.id as INT, which breaks FK creation (errno 150).
  await db.query(`CREATE TABLE IF NOT EXISTS farmer_qr_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    farmer_id BIGINT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    INDEX idx_farmer_qr_token (token),
    INDEX idx_farmer_qr_farmer (farmer_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

async function createFarmer(req, res) {
  try {
    await ensureSchema();
    const { firstName, lastName, gender, phoneNumber, profileImageUrl, cropType, villageName, districtName, provinceCity, plantingDate, harvestDate, qrExpirationDays, sensorDevices } = req.body || {};
    
    if (!firstName || !lastName || !phoneNumber || !cropType || !villageName || !districtName || !provinceCity || !plantingDate || !harvestDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required: firstName, lastName, phoneNumber, cropType, villageName, districtName, provinceCity, plantingDate, harvestDate' 
      });
    }

    const plantingDateStr = normalizeDate(plantingDate);
    const harvestDateStr = normalizeDate(harvestDate);
    if (!plantingDateStr || !harvestDateStr) {
      return res.status(400).json({ success: false, error: 'Invalid date format for plantingDate or harvestDate. Expected YYYY-MM-DD.' });
    }
    const qrDays = Math.max(1, Math.min(365, parseInt(qrExpirationDays, 10) || 365));

    // Parse sensor devices - support both array and comma-separated string
    let deviceIds = [];
    if (sensorDevices) {
      if (Array.isArray(sensorDevices)) {
        deviceIds = sensorDevices;
      } else if (typeof sensorDevices === 'string') {
        deviceIds = sensorDevices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }

    // Create the farmer (store both new + legacy columns so strict older schemas won't fail)
    const sensorDevicesStr = deviceIds.length > 0 ? deviceIds.join(',') : null;
    const legacyFarmerName = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();
    const legacyLocation = `${String(villageName).trim()}, ${String(districtName).trim()}, ${String(provinceCity).trim()}`.trim();
    const legacyDeviceId = deviceIds.length > 0 ? deviceIds[0] : null;

    const sql = `INSERT INTO farmers (
      first_name, last_name, gender, phone_number, profile_image_url,
      crop_type, village_name, district_name, province_city, planting_date, harvest_date,
      qr_expiration_days, sensor_devices,
      farmer_name, location, contact, device_id, profile_image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      firstName,
      lastName,
      gender || null,
      String(phoneNumber).trim(),
      profileImageUrl || null,
      cropType,
      villageName,
      districtName,
      provinceCity,
      plantingDateStr,
      harvestDateStr,
      qrDays,
      sensorDevicesStr,
      legacyFarmerName || null,
      legacyLocation || null,
      String(phoneNumber).trim() || null,
      legacyDeviceId,
      profileImageUrl || null,
    ];
    const result = await db.query(sql, params);
    const farmerId = result.insertId;

    // Assign sensors using the new sensor system
    const assignmentResults = { success: [], failed: [] };
    if (deviceIds.length > 0) {
      try {
        const results = await sensorsService.assignMultipleSensors(farmerId, deviceIds, 'Initial assignment during farmer creation');
        assignmentResults.success = results.success;
        assignmentResults.failed = results.failed;
      } catch (assignErr) {
        assignmentResults.failed = deviceIds.map(deviceId => ({ 
          deviceId, 
          error: assignErr.message 
        }));
      }
    }

    // Fetch the created farmer with assigned sensors
    const [farmer] = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    
    // Get assigned sensors from new table
    let assignedSensors = [];
    try {
      assignedSensors = await sensorsService.getFarmerSensors(farmerId);
    } catch (err) {
      // Error fetching assigned sensors
    }
    
    res.json({ 
      success: true, 
      farmer: {
        id: farmer.id,
        firstName: farmer.first_name,
        lastName: farmer.last_name,
        gender: farmer.gender,
        phoneNumber: farmer.phone_number,
        profileImageUrl: farmer.profile_image_url,
        cropType: farmer.crop_type,
        villageName: farmer.village_name,
        districtName: farmer.district_name,
        provinceCity: farmer.province_city,
        plantingDate: farmer.planting_date,
        harvestDate: farmer.harvest_date,
        qrExpirationDays: farmer.qr_expiration_days,
        sensors: assignedSensors,
        createdAt: farmer.created_at,
        type: 'farmer'
      },
      sensorAssignment: assignmentResults
    });
  } catch (err) {
    console.error('[createFarmer] Error:', {
      message: err && err.message,
      code: err && err.code,
      sqlState: err && err.sqlState,
      sqlMessage: err && err.sqlMessage,
    });
    res.status(500).json({ success: false, error: 'Failed to create farmer', message: err && err.message ? err.message : 'Unknown error' });
  }
}

async function getFarmers(req, res) {
  try {
    await ensureSchema();
    const rows = await db.query('SELECT * FROM farmers ORDER BY created_at DESC');
    
    const farmers = rows.map(farmer => ({
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      gender: farmer.gender,
      phoneNumber: farmer.phone_number,
      profileImageUrl: farmer.profile_image_url,
      cropType: farmer.crop_type,
      villageName: farmer.village_name,
      districtName: farmer.district_name,
      provinceCity: farmer.province_city,
      plantingDate: farmer.planting_date,
      harvestDate: farmer.harvest_date,
      qrExpirationDays: farmer.qr_expiration_days,
      ministryFeedback: farmer.ministry_feedback,
      ministryFeedbackUpdatedAt: farmer.ministry_feedback_updated_at,
      ministryFeedbackViewedAt: farmer.ministry_feedback_viewed_at,
      hasUnviewedFeedback: farmer.ministry_feedback && (!farmer.ministry_feedback_viewed_at || new Date(farmer.ministry_feedback_updated_at) > new Date(farmer.ministry_feedback_viewed_at)),
      createdAt: farmer.created_at,
      type: 'farmer'
    }));

    res.json({ success: true, data: farmers });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch farmers', message: err.message });
  }
}

async function getFarmer(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    const rows = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
    
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }

    const farmer = rows[0];
    
    // Get assigned sensors from new sensors table
    let sensors = [];
    let deviceIds = [];
    try {
      sensors = await sensorsService.getFarmerSensors(id);
      deviceIds = sensors.map(s => s.device_id);
    } catch (sensorErr) {
      console.error('[getFarmer] Error fetching sensors:', sensorErr.message);
      // Fallback to old sensor_devices field if new system fails
      if (farmer.sensor_devices) {
        deviceIds = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    // Calculate OVERALL crop safety score from planting date to now (or harvest date)
    let cropSafetyScore = null;
    
    if (deviceIds.length > 0 && farmer.planting_date) {
      try {
        const devices = deviceIds;
        // Don't use location filter - sensor devices are unique identifiers per farmer
        const location = null;
        const cropType = farmer.crop_type || 'general';
        
        // Use today or harvest date, whichever is earlier
        const today = new Date();
        const harvestDate = new Date(farmer.harvest_date);
        const endDate = today < harvestDate ? today : harvestDate;
        
        const safetyResult = await soilHealthService.calculateWeeklyCropSafety(
          id,
          devices,
          location,
          farmer.planting_date,
          endDate,
          cropType
        );
        
        if (safetyResult.success && safetyResult.averageSafetyScore !== null) {
          // Determine soil status based on average score
          let soilStatus = 'Healthy';
          if (safetyResult.averageSafetyScore >= 8) {
            soilStatus = 'Healthy';
          } else if (safetyResult.averageSafetyScore >= 6) {
            soilStatus = 'Fair';
          } else if (safetyResult.averageSafetyScore >= 4) {
            soilStatus = 'Not Healthy';
          } else {
            soilStatus = 'Critical';
          }
          
          cropSafetyScore = {
            score: safetyResult.averageSafetyScore,
            maxScore: 10,
            soilStatus: soilStatus,
            totalWeeks: safetyResult.totalWeeks,
            startDate: farmer.planting_date,
            endDate: endDate,
            timestamp: new Date().toISOString()
          };
        }
      } catch (safetyErr) {
        // Error calculating crop safety score
      }
    }
    
    // Calculate cultivation history
    let cultivationHistory = [];
    if (deviceIds.length > 0 && farmer.planting_date) {
      try {
        const devices = deviceIds;
        const cropType = farmer.crop_type || 'general';
        
        const historyResult = await soilHealthService.calculateCultivationHistory(devices, farmer.planting_date, cropType);
        
        if (historyResult.success) {
          cultivationHistory = historyResult.cultivationHistory;
        }
      } catch (historyErr) {
        // Error calculating cultivation history
      }
    }
    
    res.json({ 
      success: true, 
      data: {
        id: farmer.id,
        firstName: farmer.first_name,
        lastName: farmer.last_name,
        gender: farmer.gender,
        phoneNumber: farmer.phone_number,
        profileImageUrl: farmer.profile_image_url,
        cropType: farmer.crop_type,
        villageName: farmer.village_name,
        districtName: farmer.district_name,
        provinceCity: farmer.province_city,
        plantingDate: farmer.planting_date,
        harvestDate: farmer.harvest_date,
        qrExpirationDays: farmer.qr_expiration_days,
        sensorDevices: farmer.sensor_devices, // Kept for backward compatibility
        sensors: sensors, // New: Full sensor objects with details
        ministryFeedback: farmer.ministry_feedback,
        createdAt: farmer.created_at,
        cropSafetyScore: cropSafetyScore,
        cultivationHistory: cultivationHistory,
        type: 'farmer'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch farmer', message: err.message });
  }
}

async function updateFarmer(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    const { firstName, lastName, gender, phoneNumber, profileImageUrl, cropType, villageName, districtName, provinceCity, plantingDate, harvestDate, ministryFeedback } = req.body || {};

    // Build dynamic update query based on provided fields
    const updates = [];
    const params = [];
    
    if (firstName !== undefined) {
      updates.push('first_name = ?');
      params.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      params.push(lastName);
    }
    if (gender !== undefined) {
      updates.push('gender = ?');
      params.push(gender || null);
    }
    if (phoneNumber !== undefined) {
      updates.push('phone_number = ?');
      params.push(phoneNumber);
    }
    if (profileImageUrl !== undefined) {
      updates.push('profile_image_url = ?');
      params.push(profileImageUrl || null);
    }
    if (cropType !== undefined) {
      updates.push('crop_type = ?');
      params.push(cropType);
    }
    if (villageName !== undefined) {
      updates.push('village_name = ?');
      params.push(villageName);
    }
    if (districtName !== undefined) {
      updates.push('district_name = ?');
      params.push(districtName);
    }
    if (provinceCity !== undefined) {
      updates.push('province_city = ?');
      params.push(provinceCity);
    }
    if (plantingDate !== undefined) {
      updates.push('planting_date = ?');
      params.push(plantingDate);
    }
    if (harvestDate !== undefined) {
      updates.push('harvest_date = ?');
      params.push(harvestDate);
    }
    if (req.body.qrExpirationDays !== undefined) {
      updates.push('qr_expiration_days = ?');
      params.push(req.body.qrExpirationDays);
    }
    if (req.body.sensorDevices !== undefined) {
      updates.push('sensor_devices = ?');
      params.push(req.body.sensorDevices || null);
    }
    if (ministryFeedback !== undefined) {
      // Limit to 600 characters
      const feedback = ministryFeedback ? ministryFeedback.slice(0, 600) : null;
      updates.push('ministry_feedback = ?');
      params.push(feedback);
      // Set updated timestamp when feedback changes
      updates.push('ministry_feedback_updated_at = NOW()');
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }
    
    params.push(id);
    const sql = `UPDATE farmers SET ${updates.join(', ')} WHERE id = ?`;
    await db.query(sql, params);

    const [farmer] = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
    
    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }

    res.json({ 
      success: true, 
      farmer: {
        id: farmer.id,
        firstName: farmer.first_name,
        lastName: farmer.last_name,
        gender: farmer.gender,
        phoneNumber: farmer.phone_number,
        profileImageUrl: farmer.profile_image_url,
        cropType: farmer.crop_type,
        villageName: farmer.village_name,
        districtName: farmer.district_name,
        provinceCity: farmer.province_city,
        plantingDate: farmer.planting_date,
        harvestDate: farmer.harvest_date,
        qrExpirationDays: farmer.qr_expiration_days,
        sensorDevices: farmer.sensor_devices,
        ministryFeedback: farmer.ministry_feedback,
        createdAt: farmer.created_at,
        type: 'farmer'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update farmer', message: err.message });
  }
}

async function deleteFarmer(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    await db.query('DELETE FROM farmers WHERE id = ?', [id]);
    res.json({ success: true, message: 'Farmer deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete farmer', message: err.message });
  }
}

async function getFarmerWithSensors(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    const { timeFilter, device: requestedDevice, includeScore, includeHistory } = req.query;
    
    // Parse boolean flags (default to false for performance)
    const shouldIncludeScore = includeScore === 'true';
    const shouldIncludeHistory = includeHistory === 'true';
    
    // Get farmer data
    const rows = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }
    
    const farmer = rows[0];
    
    // Get assigned sensors from new sensors table
    let allDevices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(id);
      allDevices = sensors.map(s => s.device_id);
    } catch (sensorErr) {
      // Fallback to old sensor_devices field
      if (farmer.sensor_devices) {
        allDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    const farmerData = {
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      gender: farmer.gender,
      phoneNumber: farmer.phone_number,
      profileImageUrl: farmer.profile_image_url,
      cropType: farmer.crop_type,
      villageName: farmer.village_name,
      districtName: farmer.district_name,
      provinceCity: farmer.province_city,
      plantingDate: farmer.planting_date,
      harvestDate: farmer.harvest_date,
      qrExpirationDays: farmer.qr_expiration_days,
      sensorDevices: farmer.sensor_devices,
      ministryFeedback: farmer.ministry_feedback,
      createdAt: farmer.created_at,
      type: 'farmer'
    };
    
    // Fetch sensor data if devices are specified
    let sensorsData = [];
    if (allDevices.length > 0) {
      
      // Filter to specific device if requested, otherwise fetch all
      const devices = requestedDevice 
        ? allDevices.filter(d => d === requestedDevice)
        : allDevices;
      
      // Calculate time filter condition for SQL query
      let timeCondition = '';
      if (timeFilter && timeFilter !== 'all') {
        const hours = {
          '24h': 24,
          '2d': 48,
          '7d': 168
        }[timeFilter];
        
        if (hours) {
          timeCondition = ` AND time >= now() - INTERVAL '${hours} hours'`;
        }
      }
      
      // Use Promise.all to fetch all devices in parallel for faster loading
      const devicePromises = devices.map(async (device) => {
        try {
          // Query InfluxDB for sensor data - always use LIMIT to prevent slow queries
          let sql;
          if (timeFilter && timeFilter !== 'all') {
            // Time-filtered queries: limit to 100 records max
            sql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${device.replace(/'/g, "''")}'${timeCondition} ORDER BY time DESC LIMIT 100`;
          } else {
            // Default: fetch only the latest record for fast loading
            sql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${device.replace(/'/g, "''")}' ORDER BY time DESC LIMIT 1`;
          }
          const sensorRows = await sqlService.query(sql);
          
          const deviceData = [];
          if (sensorRows && sensorRows.length > 0) {
            // Process all rows (for time-filtered queries, there may be multiple)
            for (const row of sensorRows) {
              deviceData.push({
                device: device,
                farm: safeValue(row.farm),
                location: safeValue(row.location) || `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
                temperature: safeValue(row.temperature),
                moisture: safeValue(row.moisture),
                ec: safeValue(row.ec),
                pH: safeValue(row.pH ?? row.ph),
                nitrogen: safeValue(row.nitrogen),
                phosphorus: safeValue(row.phosphorus),
                potassium: safeValue(row.potassium),
                salinity: safeValue(row.salinity),
                timestamp: formatTimestampLocal(row.time ?? null, { includeTZName: true })
              });
            }
          }
          return deviceData;
        } catch (sensorErr) {
          console.error(`Error fetching sensor data for device ${device}:`, sensorErr);
          return [];
        }
      });
      
      // Wait for all device queries to complete in parallel
      const results = await Promise.all(devicePromises);
      sensorsData = results.flat();
    }
    
    // Calculate crop safety score if sensor devices exist and explicitly requested
    let cropSafetyScore = null;
    if (shouldIncludeScore && farmer.sensor_devices) {
      try {
        const devices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
        // Don't use location filter - sensor devices are unique identifiers per farmer
        const location = null;
        const cropType = farmer.crop_type || 'general';
        
        const safetyResult = await soilHealthService.calculateCurrentCropSafety(devices, location, cropType);
        
        if (safetyResult.success) {
          cropSafetyScore = {
            score: safetyResult.cropSafetyScore,
            maxScore: 10,
            soilStatus: safetyResult.soilStatus,
            timestamp: safetyResult.timestamp
          };
        }
      } catch (safetyErr) {
        console.error('Error calculating crop safety score:', safetyErr);
        // Continue without crop safety score
      }
    }
    
    // Calculate cultivation history only if explicitly requested
    let cultivationHistory = [];
    if (shouldIncludeHistory && farmer.sensor_devices && farmer.planting_date) {
      try {
        const devices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
        const cropType = farmer.crop_type || 'general';
        
        const historyResult = await soilHealthService.calculateCultivationHistory(devices, farmer.planting_date, cropType);
        
        if (historyResult.success) {
          cultivationHistory = historyResult.cultivationHistory;
        }
      } catch (historyErr) {
        console.error('Error calculating cultivation history:', historyErr);
        // Continue without cultivation history
      }
    }
    
    res.json({
      success: true,
      data: {
        ...farmerData,
        sensors: sensorsData,
        cropSafetyScore,
        cultivationHistory
      }
    });
  } catch (err) {

    res.status(500).json({ success: false, error: 'Failed to fetch farmer details', message: err.message });
  }
}

async function generateFarmerQR(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    
    // Verify farmer exists
    const rows = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }
    
    const farmer = rows[0];
    const baseUrl = (process.env.FARMER_QR_BASE_URL || process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const mode = String(process.env.FARMER_QR_MODE || '').toLowerCase().trim();

    function buildFarmerProfileUrl(farmerId) {
      const configured = String(process.env.FARMER_PROFILE_URL || '').trim();
      if (configured) {
        if (configured.includes('{id}')) {
          return configured.replace('{id}', encodeURIComponent(farmerId));
        }
        if (configured.includes(':id')) {
          return configured.replace(':id', encodeURIComponent(farmerId));
        }
        const trimmed = configured.replace(/\/$/, '');
        return `${trimmed}/${encodeURIComponent(farmerId)}`;
      }
      return `${baseUrl}/profile/${encodeURIComponent(farmerId)}`;
    }

    // Option 1 (recommended for your use-case): ID-based public page
    // This matches frontend route: /profile/:id
    if (mode === 'profile' || mode === 'id') {
      return res.json({
        success: true,
        farmerId: Number(id),
        qrUrl: buildFarmerProfileUrl(id)
      });
    }

    // Option 2: token-based public page (supports expiry/revocation)
    const expirationDays = farmer.qr_expiration_days || 365;
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    await db.query(
      'INSERT INTO farmer_qr_tokens (farmer_id, token, expires_at) VALUES (?, ?, ?)',
      [id, token, expiresAt]
    );

    res.json({
      success: true,
      token,
      expiresAt,
      qrUrl: `${baseUrl}/farmer-qr/${token}`
    });
  } catch (err) {

    res.status(500).json({ success: false, error: 'Failed to generate QR code', message: err.message });
  }
}

async function scanFarmerQR(req, res) {
  try {
    await ensureSchema();
    const { token } = req.params;
    
    // Find token
    const tokenRows = await db.query(
      'SELECT * FROM farmer_qr_tokens WHERE token = ? AND revoked_at IS NULL',
      [token]
    );
    
    if (!tokenRows.length) {
      return res.status(404).json({ success: false, error: 'Invalid or revoked QR code' });
    }
    
    const qrToken = tokenRows[0];
    
    // Check expiration
    if (new Date(qrToken.expires_at) < new Date()) {
      return res.status(410).json({ success: false, error: 'QR code has expired' });
    }
    
    // Get farmer with sensors
    const farmerRows = await db.query('SELECT * FROM farmers WHERE id = ?', [qrToken.farmer_id]);
    if (!farmerRows.length) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }
    
    const farmer = farmerRows[0];
    const farmerData = {
      id: farmer.id,
      firstName: farmer.first_name,
      lastName: farmer.last_name,
      gender: farmer.gender,
      phoneNumber: farmer.phone_number,
      profileImageUrl: farmer.profile_image_url,
      cropType: farmer.crop_type,
      villageName: farmer.village_name,
      districtName: farmer.district_name,
      provinceCity: farmer.province_city,
      plantingDate: farmer.planting_date,
      harvestDate: farmer.harvest_date,
      sensorDevices: farmer.sensor_devices,
      createdAt: farmer.created_at
    };
    
    // Fetch sensor data
    let sensorsData = [];
    if (farmer.sensor_devices) {
      const devices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      
      for (const device of devices) {
        try {
          const sql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${device.replace(/'/g, "''")}' ORDER BY time DESC LIMIT 1`;
          const sensorRows = await sqlService.query(sql);
          
          if (sensorRows && sensorRows.length > 0) {
            const row = sensorRows[0];
            sensorsData.push({
              device: device,
              location: safeValue(row.location) || farmer.location,
              temperature: safeValue(row.temperature),
              moisture: safeValue(row.moisture),
              ec: safeValue(row.ec),
              pH: safeValue(row.pH ?? row.ph),
              nitrogen: safeValue(row.nitrogen),
              phosphorus: safeValue(row.phosphorus),
              potassium: safeValue(row.potassium),
              salinity: safeValue(row.salinity),
              timestamp: formatTimestampLocal(row.time ?? null, { includeTZName: true })
            });
          }
        } catch (sensorErr) {
          console.error(`Error fetching sensor data for device ${device}:`, sensorErr);
        }
      }
    }
    
    // Calculate crop safety score if sensor devices exist
    let cropSafetyScore = null;
    if (farmer.sensor_devices) {
      try {
        const devices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
        // Don't use location filter - sensor devices are unique identifiers per farmer
        const location = null;
        const cropType = farmer.crop_type || 'general';
        
        const safetyResult = await soilHealthService.calculateCurrentCropSafety(devices, location, cropType);
        
        if (safetyResult.success) {
          cropSafetyScore = {
            score: safetyResult.cropSafetyScore,
            maxScore: 10,
            soilStatus: safetyResult.soilStatus,
            timestamp: safetyResult.timestamp
          };
        }
      } catch (safetyErr) {
        console.error('Error calculating crop safety score:', safetyErr);
        // Continue without crop safety score
      }
    }
    
    // Calculate cultivation history
    let cultivationHistory = [];
    if (farmer.sensor_devices && farmer.planting_date) {
      try {
        const devices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
        const cropType = farmer.crop_type || 'general';
        
        const historyResult = await soilHealthService.calculateCultivationHistory(devices, farmer.planting_date, cropType);
        
        if (historyResult.success) {
          cultivationHistory = historyResult.cultivationHistory;
        }
      } catch (historyErr) {
        console.error('Error calculating cultivation history:', historyErr);
        // Continue without cultivation history
      }
    }
    
    res.json({
      success: true,
      data: {
        ...farmerData,
        sensors: sensorsData,
        cropSafetyScore,
        cultivationHistory
      }
    });
  } catch (err) {

    res.status(500).json({ success: false, error: 'Failed to scan QR code', message: err.message });
  }
}

async function markFeedbackViewed(req, res) {
  try {
    await ensureSchema();
    const { id } = req.params;
    
    // Update viewed timestamp
    await db.query(
      'UPDATE farmers SET ministry_feedback_viewed_at = NOW() WHERE id = ?',
      [id]
    );
    
    res.json({ success: true, message: 'Feedback marked as viewed' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to mark feedback as viewed', message: err.message });
  }
}

async function downloadSensorDataCSV(req, res) {
  try {
    const { id } = req.params;
    const { device } = req.query;

    if (!device) {
      return res.status(400).json({ success: false, error: 'Device parameter is required' });
    }

    // Get farmer to verify it exists
    const [farmer] = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
    if (!farmer) {
      return res.status(404).json({ success: false, error: 'Farmer not found' });
    }

    // Query ALL historical data for the device using SQL syntax
    const sql = `SELECT * FROM "${MEASUREMENT}" WHERE device = '${device.replace(/'/g, "''")}' ORDER BY time DESC`;
    
    const data = await sqlService.query(sql);
    
    if (!data || data.length === 0) {
      return res.status(404).json({ success: false, error: 'No sensor data found for this device' });
    }

    // Format data for CSV
    const sensors = data.map(record => ({
      device: record.device || '',
      farm: record.farm || '',
      location: record.location || '',
      temperature: safeValue(record.temperature),
      moisture: safeValue(record.moisture),
      ec: safeValue(record.ec),
      pH: safeValue(record.pH ?? record.ph),
      nitrogen: safeValue(record.nitrogen),
      phosphorus: safeValue(record.phosphorus),
      potassium: safeValue(record.potassium),
      timestamp: formatTimestampLocal(record.time)
    }));

    // Generate CSV
    const headers = [
      'Device',
      'Farm Name',
      'Location',
      'Temperature (°C)',
      'Moisture (%)',
      'EC (µS/cm)',
      'pH',
      'Nitrogen',
      'Phosphorus',
      'Potassium',
      'Timestamp'
    ];

    const csvRows = sensors.map(sensor => [
      sensor.device,
      sensor.farm,
      sensor.location,
      sensor.temperature !== null ? sensor.temperature : '',
      sensor.moisture !== null ? sensor.moisture : '',
      sensor.ec !== null ? sensor.ec : '',
      sensor.pH !== null ? sensor.pH : '',
      sensor.nitrogen !== null ? sensor.nitrogen : '',
      sensor.phosphorus !== null ? sensor.phosphorus : '',
      sensor.potassium !== null ? sensor.potassium : '',
      sensor.timestamp
    ]);

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Set response headers for file download
    const filename = `sensor_data_${device}_all_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);

  } catch (err) {
    console.error('Error downloading sensor data CSV:', err);
    res.status(500).json({ success: false, error: 'Failed to download sensor data', message: err.message });
  }
}

module.exports = { createFarmer, getFarmers, getFarmer, updateFarmer, deleteFarmer, getFarmerWithSensors, generateFarmerQR, scanFarmerQR, markFeedbackViewed, downloadSensorDataCSV };
