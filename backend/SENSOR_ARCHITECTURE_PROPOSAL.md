# Sensor Architecture Improvement Proposal

## Current Issues

### 1. Database Design Problems
- **Comma-separated string**: `sensor_devices` field stores "esp32_01,esp32_02,esp32_03"
- **No referential integrity**: Can't validate if sensor IDs exist
- **Manual parsing**: Every query requires `split(',').map(d => d.trim())`
- **No metadata**: Can't store sensor type, status, installation date, etc.

### 2. Query Inefficiency
```javascript
// Current: 3 steps
1. SELECT * FROM farmers WHERE id = ?
2. Parse: const devices = farmer.sensor_devices.split(',')
3. Query InfluxDB with device list
```

### 3. Management Problems
- ❌ Can't list all sensors in system
- ❌ Can't see which sensors are unassigned
- ❌ Can't track sensor status (active/broken/maintenance)
- ❌ Can't do reverse lookup (sensor → farmer)
- ❌ Can't track sensor assignment history
- ❌ No validation between MySQL and InfluxDB

### 4. Location Mismatch
- Farmer location: "ដង្កោ" (Khmer district name)
- Sensor location in InfluxDB: "greenhouse_1", "field_a"
- These never match, causing query failures

## Recommended Solution

### New Database Schema

```sql
-- Sensors table: Master registry of all sensors
CREATE TABLE sensors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(100) NOT NULL UNIQUE,
  sensor_type VARCHAR(50) NOT NULL DEFAULT 'soil',
  model VARCHAR(100),
  status ENUM('active', 'inactive', 'maintenance', 'broken') DEFAULT 'active',
  installation_date DATE,
  last_seen DATETIME,
  location_tag VARCHAR(100),  -- InfluxDB location tag
  physical_location TEXT,     -- Human readable location
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Farmer-Sensor assignment (many-to-many)
CREATE TABLE farmer_sensors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farmer_id INT NOT NULL,
  sensor_id INT NOT NULL,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unassigned_at DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
  FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE,
  UNIQUE KEY unique_active_assignment (farmer_id, sensor_id, is_active),
  INDEX idx_farmer_active (farmer_id, is_active),
  INDEX idx_sensor_active (sensor_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Benefits

#### 1. Better Data Integrity
```javascript
// Validate sensor exists before assignment
const sensor = await db.query('SELECT id FROM sensors WHERE device_id = ?', ['esp32_01']);
if (!sensor.length) {
  throw new Error('Sensor not found');
}
```

#### 2. Efficient Queries
```javascript
// Get farmer's sensors - ONE query
const sensors = await db.query(`
  SELECT s.device_id, s.status, s.location_tag
  FROM sensors s
  JOIN farmer_sensors fs ON s.id = fs.sensor_id
  WHERE fs.farmer_id = ? AND fs.is_active = 1
`, [farmerId]);

// Reverse lookup - which farmer owns this sensor?
const farmer = await db.query(`
  SELECT f.*
  FROM farmers f
  JOIN farmer_sensors fs ON f.id = fs.farmer_id
  JOIN sensors s ON fs.sensor_id = s.id
  WHERE s.device_id = ? AND fs.is_active = 1
`, ['esp32_01']);
```

#### 3. Better Management
```javascript
// List all sensors
GET /api/sensors
// List unassigned sensors
GET /api/sensors?status=active&assigned=false
// Sensor assignment history
GET /api/sensors/esp32_01/history
// Bulk assign sensors
POST /api/farmers/:id/sensors { sensor_ids: [1,2,3] }
```

#### 4. Sensor Health Monitoring
```javascript
// Update last_seen when data arrives
await db.query('UPDATE sensors SET last_seen = NOW() WHERE device_id = ?', [device]);

// Find offline sensors (no data in 1 hour)
const offline = await db.query(`
  SELECT device_id, last_seen 
  FROM sensors 
  WHERE last_seen < DATE_SUB(NOW(), INTERVAL 1 HOUR)
  AND status = 'active'
`);
```

#### 5. Assignment History
```javascript
// Track sensor movements
farmer_sensors:
| farmer_id | sensor_id | assigned_at | unassigned_at | is_active |
|-----------|-----------|-------------|---------------|-----------|
| 4         | 1         | 2026-01-15  | 2026-02-01    | 0         |
| 4         | 1         | 2026-02-01  | NULL          | 1         |
| 5         | 2         | 2026-01-20  | NULL          | 1         |
```

## Migration Strategy

### Phase 1: Add New Tables (No Breaking Changes)
1. Create `sensors` and `farmer_sensors` tables
2. Migrate existing data from `sensor_devices` string
3. Keep old `sensor_devices` field for backward compatibility

### Phase 2: Update API Layer
1. Create new endpoints:
   - `GET /api/sensors` - List all sensors
   - `POST /api/sensors` - Register new sensor
   - `GET /api/farmers/:id/sensors` - Get farmer's sensors
   - `POST /api/farmers/:id/sensors` - Assign sensors
   - `DELETE /api/farmers/:id/sensors/:sensorId` - Unassign sensor

2. Update existing endpoints to use new tables
3. Keep backward compatibility

### Phase 3: Deprecate Old Field
1. Mark `sensor_devices` as deprecated
2. Update all controllers to use new tables
3. Eventually drop column

## Implementation Code

### Migration Script
```javascript
// backend/src/scripts/migrate-to-sensors-table.js
async function migrateSensorsData() {
  // 1. Create tables
  await createSensorsTable();
  await createFarmerSensorsTable();
  
  // 2. Get all unique sensor devices from farmers
  const farmers = await db.query(
    'SELECT id, sensor_devices FROM farmers WHERE sensor_devices IS NOT NULL'
  );
  
  const allDevices = new Set();
  farmers.forEach(f => {
    const devices = f.sensor_devices.split(',').map(d => d.trim());
    devices.forEach(d => allDevices.add(d));
  });
  
  // 3. Insert sensors
  for (const device of allDevices) {
    await db.query(`
      INSERT INTO sensors (device_id, status, location_tag)
      VALUES (?, 'active', NULL)
      ON DUPLICATE KEY UPDATE device_id = device_id
    `, [device]);
  }
  
  // 4. Create farmer-sensor relationships
  for (const farmer of farmers) {
    const devices = farmer.sensor_devices.split(',').map(d => d.trim());
    for (const device of devices) {
      const sensor = await db.query(
        'SELECT id FROM sensors WHERE device_id = ?', [device]
      );
      if (sensor.length) {
        await db.query(`
          INSERT INTO farmer_sensors (farmer_id, sensor_id, is_active)
          VALUES (?, ?, 1)
          ON DUPLICATE KEY UPDATE is_active = 1
        `, [farmer.id, sensor[0].id]);
      }
    }
  }
}
```

### New Service Layer
```javascript
// backend/src/services/sensors.service.js
async function getFarmerSensors(farmerId) {
  const rows = await db.query(`
    SELECT 
      s.id,
      s.device_id,
      s.sensor_type,
      s.status,
      s.location_tag,
      s.last_seen,
      fs.assigned_at
    FROM sensors s
    JOIN farmer_sensors fs ON s.id = fs.sensor_id
    WHERE fs.farmer_id = ? AND fs.is_active = 1
    ORDER BY fs.assigned_at DESC
  `, [farmerId]);
  
  return rows;
}

async function assignSensor(farmerId, deviceId) {
  const sensor = await db.query(
    'SELECT id FROM sensors WHERE device_id = ?', [deviceId]
  );
  
  if (!sensor.length) {
    throw new Error(`Sensor ${deviceId} not found`);
  }
  
  await db.query(`
    INSERT INTO farmer_sensors (farmer_id, sensor_id, is_active)
    VALUES (?, ?, 1)
  `, [farmerId, sensor[0].id]);
}

async function unassignSensor(farmerId, sensorId) {
  await db.query(`
    UPDATE farmer_sensors 
    SET is_active = 0, unassigned_at = NOW()
    WHERE farmer_id = ? AND sensor_id = ? AND is_active = 1
  `, [farmerId, sensorId]);
}
```

### Updated Controller
```javascript
// backend/src/controllers/farmers.controller.js
async function getFarmer(req, res) {
  const { id } = req.params;
  const farmer = await db.query('SELECT * FROM farmers WHERE id = ?', [id]);
  
  // NEW: Get sensors from proper table
  const sensors = await sensorsService.getFarmerSensors(id);
  const devices = sensors.map(s => s.device_id);
  
  // Calculate crop safety
  if (devices.length > 0) {
    const safetyResult = await soilHealthService.calculateCurrentCropSafety(
      devices,
      null,  // No location filter needed
      farmer.crop_type || 'general'
    );
    
    cropSafetyScore = {
      score: safetyResult.cropSafetyScore,
      maxScore: 10,
      soilStatus: safetyResult.soilStatus,
      timestamp: safetyResult.timestamp
    };
  }
  
  res.json({
    success: true,
    data: {
      ...farmer,
      sensors: sensors,  // Full sensor details
      cropSafetyScore
    }
  });
}
```

## API Examples

### New Endpoints

```bash
# List all sensors
GET /api/sensors
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "esp32_01",
      "status": "active",
      "location_tag": "greenhouse_1",
      "last_seen": "2026-02-02T10:30:00Z",
      "assigned_to": "ម៉េងហុង ទ្រី"
    }
  ]
}

# Get farmer's sensors
GET /api/farmers/4/sensors
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "device_id": "esp32_01",
      "status": "active",
      "assigned_at": "2026-01-15T08:00:00Z"
    }
  ]
}

# Assign sensor to farmer
POST /api/farmers/4/sensors
Body: { "device_id": "esp32_05" }

# Unassign sensor
DELETE /api/farmers/4/sensors/1
```

## Summary

**Current Approach:**
- ❌ String parsing on every query
- ❌ No data integrity
- ❌ Hard to manage sensors
- ❌ Location mismatch issues

**Proposed Approach:**
- ✅ Proper relational design
- ✅ Data integrity with foreign keys
- ✅ Efficient queries with JOINs
- ✅ Full sensor lifecycle management
- ✅ Assignment history tracking
- ✅ Easy to add features (sensor groups, zones, etc.)

This is a foundational improvement that will make the system more scalable and maintainable.
