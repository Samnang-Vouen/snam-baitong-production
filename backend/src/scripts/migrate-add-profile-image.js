const db = require('../services/mysql');

async function migrate() {
  try {
    console.log('Starting migration: Adding profile_image_url and updating location fields...');
    
    // Check if profile_image_url column exists
    const columns = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'farmers'
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    
    // Add profile_image_url if it doesn't exist
    if (!columnNames.includes('profile_image_url')) {
      console.log('Adding profile_image_url column...');
      await db.query(`
        ALTER TABLE farmers 
        ADD COLUMN profile_image_url TEXT NULL 
        AFTER phone_number
      `);
      console.log('✓ profile_image_url column added');
    } else {
      console.log('✓ profile_image_url column already exists');
    }
    
    // Add village_name if it doesn't exist
    if (!columnNames.includes('village_name')) {
      console.log('Adding village_name column...');
      await db.query(`
        ALTER TABLE farmers 
        ADD COLUMN village_name VARCHAR(255) NULL 
        AFTER crop_type
      `);
      console.log('✓ village_name column added');
    } else {
      console.log('✓ village_name column already exists');
    }
    
    // Add district_name if it doesn't exist
    if (!columnNames.includes('district_name')) {
      console.log('Adding district_name column...');
      await db.query(`
        ALTER TABLE farmers 
        ADD COLUMN district_name VARCHAR(255) NULL 
        AFTER village_name
      `);
      console.log('✓ district_name column added');
    } else {
      console.log('✓ district_name column already exists');
    }
    
    // Add province_city if it doesn't exist
    if (!columnNames.includes('province_city')) {
      console.log('Adding province_city column...');
      await db.query(`
        ALTER TABLE farmers 
        ADD COLUMN province_city VARCHAR(255) NULL 
        AFTER district_name
      `);
      console.log('✓ province_city column added');
    } else {
      console.log('✓ province_city column already exists');
    }
    
    // If old location column exists and new columns were just added, migrate data
    if (columnNames.includes('location') && !columnNames.includes('village_name')) {
      console.log('Migrating location data to new fields...');
      const farmers = await db.query('SELECT id, location FROM farmers WHERE location IS NOT NULL');
      
      for (const farmer of farmers) {
        // Split location by comma if it exists, otherwise use the whole value
        const parts = farmer.location.split(',').map(p => p.trim());
        const villageName = parts[0] || farmer.location;
        const districtName = parts[1] || '';
        const provinceCity = parts[2] || '';
        
        await db.query(
          'UPDATE farmers SET village_name = ?, district_name = ?, province_city = ? WHERE id = ?',
          [villageName, districtName, provinceCity, farmer.id]
        );
      }
      console.log(`✓ Migrated ${farmers.length} farmer location records`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
