const mysql = require('mysql2/promise');
const { mysqlConfig, validateMySQLConfig } = require('../config/mysql');

let pool;

async function ensureDatabaseExists() {
  // Connect without specifying a database, then create if needed
  const { host, port, user, password, database } = mysqlConfig;
  const adminConn = await mysql.createConnection({ host, port, user, password, multipleStatements: true });
  try {
    await adminConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
  } finally {
    await adminConn.end();
  }
}

let initPromise;
function initPoolOnce() {
  if (!initPromise) {
    initPromise = (async () => {
      validateMySQLConfig();
      await ensureDatabaseExists();
      pool = mysql.createPool(mysqlConfig);
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

