require('dotenv').config();

const config = {
  INFLUXDB_URL: process.env.INFLUXDB_URL,
  INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN,
  INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET,
};

function validateRequired(keys) {
  const missing = keys.filter(key => !process.env[key]);
  if (missing.length > 0) {
    const err = new Error(`Missing required environment variables: ${missing.join(', ')}`);
    err.code = 'ENV_VALIDATION_ERROR';
    throw err;
  }
}

module.exports = { config, validateRequired };
