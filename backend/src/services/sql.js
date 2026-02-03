const { config, validateRequired } = require('../config/influxdb');
const InfluxDBSQLService = require('./influx-sql.service');

// Validate SQL-relevant env
validateRequired(['INFLUXDB_URL', 'INFLUXDB_TOKEN']);
const database = process.env.INFLUXDB_DATABASE || config.INFLUXDB_BUCKET;
if (!database) {
  const err = new Error('Missing INFLUXDB_DATABASE or INFLUXDB_BUCKET');
  err.code = 'ENV_VALIDATION_ERROR';
  throw err;
}

const sqlService = new InfluxDBSQLService(config.INFLUXDB_URL, config.INFLUXDB_TOKEN, database);

module.exports = sqlService;
