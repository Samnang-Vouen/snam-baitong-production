require('dotenv').config();
const mysql = require('mysql2/promise');

async function addMustChangePasswordColumn() {
  const config = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'snam_baitong'
  };

  console.log('\n========================================');
  console.log('🔄 Adding must_change_password column');
  console.log('========================================\n');

  let connection;
  try {
    connection = await mysql.createConnection(config);
    
    // Check if column exists
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM users LIKE 'must_change_password'
    `);
    
    if (columns.length > 0) {
      console.log('✓ Column must_change_password already exists');
    } else {
      console.log('Adding must_change_password column...');
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 
        AFTER is_active
      `);
      console.log('✓ Column must_change_password added successfully');
    }
    
    console.log('\n✅ Migration completed successfully\n');
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  addMustChangePasswordColumn()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = addMustChangePasswordColumn;
