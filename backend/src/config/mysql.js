require('dotenv').config();

const mysqlConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'snam_baitong',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

function validateMySQLConfig() {
  const required = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.warn(`Warning: Missing MySQL env variables: ${missing.join(', ')}`);
  }
}

module.exports = { mysqlConfig, validateMySQLConfig };
