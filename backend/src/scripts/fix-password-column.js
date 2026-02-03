require('dotenv').config();
const { sequelize } = require('../config/database');

async function fixPasswordColumn() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connected');
    
    // Check if password_hash column exists
    const [results] = await sequelize.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'password_hash'
    `, { replacements: [process.env.MYSQL_DATABASE] });
    
    if (results.length === 0) {
      console.log('Renaming password column to password_hash...');
      await sequelize.query(`ALTER TABLE users CHANGE COLUMN password password_hash VARCHAR(255) NOT NULL`);
      console.log('✓ Column renamed successfully');
    } else {
      console.log('✓ password_hash column already exists');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

fixPasswordColumn();
