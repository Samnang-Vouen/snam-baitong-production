const db = require('../services/mysql');

async function updateConstraints() {
  try {
    console.log('Updating location fields to NOT NULL...');
    
    // Update village_name to NOT NULL
    await db.query(`
      ALTER TABLE farmers 
      MODIFY COLUMN village_name VARCHAR(255) NOT NULL
    `);
    console.log('✓ village_name set to NOT NULL');
    
    // Update district_name to NOT NULL
    await db.query(`
      ALTER TABLE farmers 
      MODIFY COLUMN district_name VARCHAR(255) NOT NULL
    `);
    console.log('✓ district_name set to NOT NULL');
    
    // Update province_city to NOT NULL
    await db.query(`
      ALTER TABLE farmers 
      MODIFY COLUMN province_city VARCHAR(255) NOT NULL
    `);
    console.log('✓ province_city set to NOT NULL');
    
    console.log('\n✅ Constraints updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Update failed:', error);
    console.log('\nNote: Make sure all existing records have values in these fields before running this.');
    process.exit(1);
  }
}

updateConstraints();
