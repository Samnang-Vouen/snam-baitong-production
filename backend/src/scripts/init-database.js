require('dotenv').config();
const mysql = require('mysql2/promise');

async function initDatabase() {
  const dbName = process.env.MYSQL_DATABASE || 'snam_baitong';
  const config = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  };

  console.log('\n========================================');
  console.log('🗄️  Initializing MySQL Database');
  console.log('========================================\n');

  let connection;
  try {
    // Connect without specifying database
    console.log(`Connecting to MySQL at ${config.host}:${config.port}...`);
    connection = await mysql.createConnection(config);
    
    // Create database if it doesn't exist
    console.log(`Creating database '${dbName}' if it doesn't exist...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✓ Database '${dbName}' is ready\n`);
    
    // Switch to the database
    await connection.query(`USE \`${dbName}\``);
    
    // Create users table
    console.log('Creating users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','ministry') NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        must_change_password TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Users table created');
    
    // Create jwt_blacklist table
    console.log('Creating jwt_blacklist table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS jwt_blacklist (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        jti VARCHAR(64) NOT NULL UNIQUE,
        user_id INT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_expires_at (expires_at),
        CONSTRAINT fk_jwt_blacklist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ JWT blacklist table created');
    
    // Create plants table
    console.log('Creating plants table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS plants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plant_name VARCHAR(255) NOT NULL,
        farmer_name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        device_id VARCHAR(100),
        qr_token VARCHAR(64) UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Plants table created');
    
    // Create comments table
    console.log('Creating comments table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        plant_id INT NOT NULL,
        user_id INT NOT NULL,
        comment TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_comments_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
        CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Comments table created');
    
    // Create farmers table
    console.log('Creating farmers table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS farmers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        farmer_name VARCHAR(255) NOT NULL,
        location VARCHAR(255),
        latitude DECIMAL(10, 8) NULL,
        longitude DECIMAL(11, 8) NULL,
        contact VARCHAR(100),
        device_id VARCHAR(100),
        qr_token VARCHAR(64) UNIQUE,
        profile_image VARCHAR(500),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Farmers table created');
    
    console.log('\n========================================');
    console.log('✅ Database initialization complete!');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:');
    console.error(error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase().then(() => process.exit(0));
}

module.exports = { initDatabase };
