const { config } = require('../config/influxdb');
const InfluxDBSQLService = require('./influx-sql.service');

const DISABLE_INFLUX = String(process.env.DISABLE_INFLUX || '').toLowerCase() === 'true';
const hasUrl = !!process.env.INFLUXDB_URL;
const hasToken = !!process.env.INFLUXDB_TOKEN;
const database = process.env.INFLUXDB_DATABASE || config.INFLUXDB_BUCKET;
const hasDatabase = !!database;

if (DISABLE_INFLUX || !hasUrl || !hasToken || !hasDatabase) {
  if (!DISABLE_INFLUX && process.env.NODE_ENV === 'production') {
    const missing = [
      !hasUrl ? 'INFLUXDB_URL' : null,
      !hasToken ? 'INFLUXDB_TOKEN' : null,
      !hasDatabase ? 'INFLUXDB_DATABASE/INFLUXDB_BUCKET' : null,
    ].filter(Boolean).join(', ');
    const err = new Error(`Missing required InfluxDB env in production: ${missing}`);
    err.code = 'ENV_VALIDATION_ERROR';
    throw err;
  }

  console.warn('[SQL] InfluxDB SQL disabled (mock). Set DISABLE_INFLUX=false and provide INFLUXDB_* to enable.');
  module.exports = {
    async query(_sql) { return []; },
    close() {}
  };
} else {
  const sqlService = new InfluxDBSQLService(config.INFLUXDB_URL, config.INFLUXDB_TOKEN, database);
  module.exports = sqlService;
}
