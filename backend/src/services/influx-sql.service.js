const { InfluxDBClient } = require('@influxdata/influxdb3-client');

class InfluxDBSQLService {
  constructor(host, token, database) {
    this.client = new InfluxDBClient({ host, token, database });
    this.database = database;
  }

  async query(sql) {
    try {
      const result = await this.client.query(sql);
      if (Array.isArray(result)) {
        return result;
      }
      const rows = [];
      if (result && typeof result[Symbol.asyncIterator] === 'function') {
        for await (const row of result) {
          rows.push(row);
        }
        return rows;
      }
      // Fallback: if result is an object, try common shapes
      if (result && typeof result === 'object') {
        if (Array.isArray(result.rows)) return result.rows;
        if (Array.isArray(result.data)) return result.data;
      }
      return [];
    } catch (err) {
      console.error('SQL query error:', err);
      throw err;
    }
  }

  close() {
    try {
      if (this.client && typeof this.client.close === 'function') {
        this.client.close();
      }
    } catch (_) {}
  }
}

module.exports = InfluxDBSQLService;
