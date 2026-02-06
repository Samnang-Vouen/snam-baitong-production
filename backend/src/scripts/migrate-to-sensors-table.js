const dotenv = require('dotenv');
// Load .env.local first if present, then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();
const mysql = require('../services/mysql');

async function migrateSensorsData() {
  console.log('\n========================================');
  console.log('🔄 Sensor Architecture Migration');
  console.log('========================================\n');

  try {
    // Step 1: Create sensors table
    console.log('Step 1: Creating sensors table...');
    await mysql.query(`
      CREATE TABLE IF NOT EXISTS sensors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL UNIQUE,
        sensor_type VARCHAR(50) NOT NULL DEFAULT 'soil',
        model VARCHAR(100) NULL,
        status ENUM('active', 'inactive', 'maintenance', 'broken') NOT NULL DEFAULT 'active',
        installation_date DATE NULL,
        last_seen DATETIME NULL,
        location_tag VARCHAR(100) NULL COMMENT 'Location tag used in InfluxDB',
        physical_location TEXT NULL COMMENT 'Human-readable physical location description',
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_device_id (device_id),
        INDEX idx_status (status),
        INDEX idx_last_seen (last_seen)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Sensors table created\n');

    // Step 2: Create farmer_sensors junction table
    console.log('Step 2: Creating farmer_sensors junction table...');
    await mysql.query(`
      CREATE TABLE IF NOT EXISTS farmer_sensors (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        farmer_id BIGINT NOT NULL,
        sensor_id INT NOT NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        unassigned_at DATETIME NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        notes TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
        FOREIGN KEY (sensor_id) REFERENCES sensors(id) ON DELETE CASCADE,
        INDEX idx_farmer_active (farmer_id, is_active),
        INDEX idx_sensor_active (sensor_id, is_active),
        INDEX idx_assigned_at (assigned_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✓ Farmer-sensors junction table created\n');

    // Step 3: Migrate existing data
    console.log('Step 3: Migrating existing sensor data from farmers table...');
    
    // Get all farmers with sensor devices
    const farmers = await mysql.query(
      'SELECT id, sensor_devices FROM farmers WHERE sensor_devices IS NOT NULL AND sensor_devices != ""'
    );
    
    console.log(`  Found ${farmers.length} farmers with sensor devices`);
    
    if (farmers.length === 0) {
      console.log('  No data to migrate\n');
      console.log('✅ Migration completed successfully!');
      return;
    }

    // Collect all unique sensor device IDs
    const allDevices = new Set();
    const farmerDeviceMap = new Map();
    
    farmers.forEach(farmer => {
      const devices = farmer.sensor_devices
        .split(',')
        .map(d => d.trim())
        .filter(Boolean);
      
      farmerDeviceMap.set(farmer.id, devices);
      devices.forEach(device => allDevices.add(device));
    });
    
    console.log(`  Found ${allDevices.size} unique sensor devices\n`);

    // Step 4: Insert sensors into sensors table
    console.log('Step 4: Inserting sensors into sensors table...');
    let insertedSensors = 0;
    let skippedSensors = 0;
    
    for (const deviceId of allDevices) {
      try {
        // Check if sensor already exists
        const existing = await mysql.query(
          'SELECT id FROM sensors WHERE device_id = ?',
          [deviceId]
        );
        
        if (existing.length > 0) {
          console.log(`  ⊙ Sensor ${deviceId} already exists, skipping...`);
          skippedSensors++;
          continue;
        }
        
        // Insert new sensor
        await mysql.query(`
          INSERT INTO sensors (device_id, sensor_type, status, created_at)
          VALUES (?, 'soil', 'active', NOW())
        `, [deviceId]);
        
        console.log(`  ✓ Inserted sensor: ${deviceId}`);
        insertedSensors++;
      } catch (err) {
        console.error(`  ✗ Failed to insert sensor ${deviceId}:`, err.message);
      }
    }
    
    console.log(`  Summary: ${insertedSensors} inserted, ${skippedSensors} skipped\n`);

    // Step 5: Create farmer-sensor relationships
    console.log('Step 5: Creating farmer-sensor relationships...');
    let insertedRelations = 0;
    let skippedRelations = 0;
    
    for (const [farmerId, devices] of farmerDeviceMap.entries()) {
      for (const deviceId of devices) {
        try {
          // Get sensor ID
          const sensor = await mysql.query(
            'SELECT id FROM sensors WHERE device_id = ?',
            [deviceId]
          );
          
          if (sensor.length === 0) {
            console.log(`  ✗ Sensor ${deviceId} not found for farmer ${farmerId}`);
            continue;
          }
          
          const sensorId = sensor[0].id;
          
          // Check if relationship already exists
          const existing = await mysql.query(
            'SELECT id FROM farmer_sensors WHERE farmer_id = ? AND sensor_id = ? AND is_active = 1',
            [farmerId, sensorId]
          );
          
          if (existing.length > 0) {
            skippedRelations++;
            continue;
          }
          
          // Insert relationship
          await mysql.query(`
            INSERT INTO farmer_sensors (farmer_id, sensor_id, is_active, assigned_at)
            VALUES (?, ?, 1, NOW())
          `, [farmerId, sensorId]);
          
          insertedRelations++;
        } catch (err) {
          console.error(`  ✗ Failed to create relationship for farmer ${farmerId}, sensor ${deviceId}:`, err.message);
        }
      }
    }
    
    console.log(`  Summary: ${insertedRelations} relationships created, ${skippedRelations} skipped\n`);

    // Step 6: Verification
    console.log('Step 6: Verifying migration...');
    const sensorCount = await mysql.query('SELECT COUNT(*) as count FROM sensors');
    const relationCount = await mysql.query('SELECT COUNT(*) as count FROM farmer_sensors WHERE is_active = 1');
    
    console.log(`  ✓ Total sensors: ${sensorCount[0].count}`);
    console.log(`  ✓ Active farmer-sensor relationships: ${relationCount[0].count}\n`);

    console.log('========================================');
    console.log('✅ Migration completed successfully!');
    console.log('========================================\n');
    console.log('Note: The old sensor_devices field has been kept for backward compatibility.');
    console.log('You can safely remove it after verifying the new system works correctly.\n');

  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrateSensorsData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { migrateSensorsData };
