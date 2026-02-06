const mysql = require('mysql2/promise');
const { mysqlConfig, validateMySQLConfig } = require('../config/mysql');

let pool;

async function ensureDatabaseExists() {
  // Connect without specifying a database, then create if needed
  const { host, port, user, password, database } = mysqlConfig;
  let adminConn;
  try {
    adminConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } catch (err) {
    const msg = String(err && err.message || '');
    if (msg.includes('ER_ACCESS_DENIED_ERROR')) {
      console.error('[MySQL] Access denied. Check MYSQL_USER/MYSQL_PASSWORD in .env.local');
      console.error('[MySQL] Consider creating a dev user and granting privileges:');
      console.error("  CREATE USER 'devuser'@'localhost' IDENTIFIED BY 'changeme';");
      console.error(`  GRANT ALL PRIVILEGES ON \`${database}\`.* TO 'devuser'@'localhost';`);
      console.error('  FLUSH PRIVILEGES;');
    }
    throw err;
  } finally {
    if (adminConn) {
      await adminConn.end();
    }
  }
}

let initPromise;
function initPoolOnce() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        validateMySQLConfig();
        await ensureDatabaseExists();
        pool = mysql.createPool(mysqlConfig);
      } catch (err) {
        const msg = String(err && err.message || '');
        if (msg.includes('ER_ACCESS_DENIED_ERROR')) {
          console.error('[MySQL] Connection failed due to invalid credentials.');
        }
        throw err;
      }
    })();
  }
  return initPromise;
}

async function query(sql, params) {
  await initPoolOnce();
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getConnection() {
  await initPoolOnce();
  return pool.getConnection();
}

module.exports = { pool: undefined, query, getConnection, ensureDatabaseExists };
 
// Gracefully close the pool (used on shutdown)
async function close() {
  if (pool) {
    try {
      await pool.end();
    } catch (_) {}
    pool = null;
  }
}

module.exports.close = close;

