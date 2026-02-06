const sqlService = require('../services/sql');
const { formatTimestampLocal } = require('../utils/format');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT;
const ALLOWED_FIELDS = (process.env.INFLUXDB_ALLOWED_FIELDS
  ? process.env.INFLUXDB_ALLOWED_FIELDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [
    'air_humidity','air_temp','device','ec','farm_name','location','moisture','nitrogen','ph','phosphorus','potassium','salinity','soil_temp','time'
  ]);

let measurementValidated = false;
async function ensureMeasurement() {
  if (measurementValidated) return;
  const checkSql = `SELECT table_name FROM information_schema.tables WHERE table_name='${MEASUREMENT.replace(/'/g, "''")}' LIMIT 1`;
  const rows = await sqlService.query(checkSql);
  if (!Array.isArray(rows) || rows.length === 0) {
    const listSql = `SELECT table_schema, table_name FROM information_schema.tables LIMIT 200`;
    const tables = await sqlService.query(listSql);
    const names = Array.isArray(tables)
      ? tables
          .map(r => (r && r.table_name ? (r.table_schema ? `${r.table_schema}.${r.table_name}` : r.table_name) : null))
          .filter(Boolean)
      : [];
    const err = new Error(`Measurement/table not found: ${MEASUREMENT}. Set INFLUXDB_MEASUREMENT to a valid table. Available tables: ${names.join(', ')}`);
    err.code = 'MEASUREMENT_NOT_FOUND';
    throw err;
  }
  measurementValidated = true;
}

function safeVal(v) {
  if (typeof v === 'bigint') return v.toString();
  if (v instanceof Date) return v.toISOString();
  return v;
}

function buildWhere() {
  const filters = [];
  if (process.env.INFLUXDB_DEVICE) {
    filters.push(`device = '${process.env.INFLUXDB_DEVICE.replace(/'/g, "''")}'`);
  }
  if (process.env.INFLUXDB_LOCATION) {
    filters.push(`location = '${process.env.INFLUXDB_LOCATION.replace(/'/g, "''")}'`);
  }
  return filters.length ? `WHERE ${filters.join(' AND ')}` : '';
}

async function getLatest(req, res) {
  try {
    await ensureMeasurement();
    const where = buildWhere();
    const sql = `SELECT * FROM "${MEASUREMENT}" ${where} ORDER BY time DESC LIMIT 1`;
    const rows = await sqlService.query(sql);
    const latest = Array.isArray(rows) && rows.length ? rows[0] : null;
    const data = {};
    if (latest) {
      for (const f of ALLOWED_FIELDS) {
        let val;
        if (f === 'ph') {
          val = latest.pH ?? latest.ph;
        } else {
          val = latest[f];
        }
        if (val !== undefined) {
          const unitMap = {
            air_temp: '°C',
            soil_temp: '°C',
            air_humidity: '%',
            moisture: '%',
            ec: 'µS/cm',
            ph: '',
            nitrogen: 'mg/kg',
            phosphorus: 'mg/kg',
            potassium: 'mg/kg',
            salinity: '',
          };
          data[f] = { value: safeVal(val), time: formatTimestampLocal(latest.time ?? null, { includeTZName: true }), unit: unitMap[f] || '' };
        }
      }
    }
    const location = latest ? safeVal(latest.location ?? null) : null;
    const device = latest ? safeVal(latest.device ?? null) : null;
    const farm_name = latest ? safeVal(latest.farm_name ?? null) : null;
    res.json({ success: true, data, location, device, farm_name, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching latest data (SQL):', error);
    const status = error.code === 'MEASUREMENT_NOT_FOUND' ? 400 : 500;
    res.status(status).json({ success: false, error: 'Failed to fetch latest sensor data', message: error.message });
  }
}

async function getDashboard(req, res) {
  try {
    await ensureMeasurement();
    const where = buildWhere();

    // Fetch last 10 rows
    const sql = `SELECT * FROM "${MEASUREMENT}" ${where} ORDER BY time DESC LIMIT 10`;
    const rows = await sqlService.query(sql);

    if (!Array.isArray(rows) || !rows.length) {
      return res.json({ success: true, data: [] }); // No data
    }

    // Map each row to sensors + units + lastUpdate
    const data = rows.map((row) => {
      const sensors = {
        air_temp: safeVal(row?.air_temp ?? null),
        soil_temp: safeVal(row?.soil_temp ?? null),
        air_humidity: safeVal(row?.air_humidity ?? null),
        moisture: safeVal(row?.moisture ?? null),
        ec: safeVal(row?.ec ?? null),
        ph: safeVal(row?.pH ?? row?.ph ?? null),
        nitrogen: safeVal(row?.nitrogen ?? null),
        phosphorus: safeVal(row?.phosphorus ?? null),
        potassium: safeVal(row?.potassium ?? null),
        salinity: safeVal(row?.salinity ?? null)
      };
      const units = {
        air_temp: '°C',
        soil_temp: '°C',
        air_humidity: '%',
        moisture: '%',
        ec: 'µS/cm',
        ph: '',
        nitrogen: 'mg/kg',
        phosphorus: 'mg/kg',
        potassium: 'mg/kg',
        salinity: ''
      };
      const lastUpdate = formatTimestampLocal(row?.time ?? null, { includeTZName: true });

      const location = safeVal(row?.location ?? null);
      const device = safeVal(row?.device ?? null);
      const farm_name = safeVal(row?.farm_name ?? null);
      return { sensors, units, lastUpdate, location, device, farm_name };
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching dashboard data (SQL):', error);
    const status = error.code === 'MEASUREMENT_NOT_FOUND' ? 400 : 500;
    res.status(status).json({ success: false, error: 'Failed to fetch dashboard data', message: error.message });
  }
}

async function getDevices(req, res) {
  try {
    await ensureMeasurement();
    
    // Query to get distinct devices
    const sql = `SELECT DISTINCT device FROM "${MEASUREMENT}" ORDER BY device`;
    const rows = await sqlService.query(sql);
    
    const devices = rows.map(row => row.device).filter(Boolean);
    
    res.json({ 
      success: true, 
      devices,
      count: devices.length 
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    const status = error.code === 'MEASUREMENT_NOT_FOUND' ? 400 : 500;
    res.status(status).json({ success: false, error: 'Failed to fetch devices', message: error.message });
  }
}

module.exports = { getLatest, getDashboard, getDevices };
