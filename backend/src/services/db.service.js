/**
 * DATABASE & EXTERNAL API SERVICE
 * Location: src/services/db.service.js
 */
const { InfluxDB } = require('@influxdata/influxdb-client');
const axios = require('axios');

// --- CONSTANTS & SAFEGUARDS ---
const PHYSICAL_MIN_PH = 2.0;
const PHYSICAL_MAX_PH = 12.0;
const PHYSICAL_MAX_MOIST = 100.0;
const DEFAULT_ID = "DEMO001";

// Unified InfluxDB env mapping (supports INFLUX_* and INFLUXDB_* names)
const INFLUX_URL = process.env.INFLUX_URL || process.env.INFLUXDB_URL;
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || process.env.INFLUXDB_TOKEN;
const INFLUX_ORG = process.env.INFLUX_ORG || process.env.INFLUXDB_ORG;
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || process.env.INFLUXDB_BUCKET;
const INFLUX_MEASUREMENT = process.env.INFLUX_MEASUREMENT || process.env.INFLUXDB_MEASUREMENT || 'soil_sensor';

// Initialize InfluxDB Client only in PROD when credentials exist
const client = process.env.ENV_MODE === 'PROD' && INFLUX_URL && INFLUX_TOKEN
    ? new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN })
    : null;

const dbService = {
    /**
     * Skeptic Check: Validates raw sensor data for provincial reliability.
     */
    validateHardware(data) {
        if (!data) return null;
        const ph = parseFloat(data.ph || 7.0);
        const moisture = parseFloat(data.moisture || 0.0);

        if (ph < PHYSICAL_MIN_PH || ph > PHYSICAL_MAX_PH) {
            data.hardware_fault = "pH Sensor Calibration Error";
        } else if (moisture > PHYSICAL_MAX_MOIST) {
            data.hardware_fault = "Moisture Sensor Short Circuit";
        } else if (moisture <= 0) {
            data.hardware_fault = "Moisture Sensor Disconnected";
        }
        return data;
    },

    /**
     * Fetches latest data from InfluxDB or Mock if in DEV.
     */
    async getLatestSensorData(deviceId = DEFAULT_ID) {
        if (process.env.ENV_MODE === 'DEV') {
            return this.validateHardware({
                ph: 6.2, moisture: 42.1, soil_temp: 28.5,
                nitrogen: 14, phosphorus: 2, potassium: 18,
                device: deviceId
            });
        }

        try {
            if (!client) {
                console.error('❌ Influx client not initialized - check ENV_MODE and credentials');
                return null;
            }
            const queryApi = client.getQueryApi(INFLUX_ORG);
            const query = `from(bucket: "${INFLUX_BUCKET}")
                |> range(start: -1h)
                |> filter(fn: (r) => r["_measurement"] == "${INFLUX_MEASUREMENT}")
                |> filter(fn: (r) => r["device"] == "${deviceId}")
                |> last()`;
            
            const result = await queryApi.collectRows(query);
            return this.validateHardware(result && result[0] ? result[0] : null);
        } catch (error) {
            console.error("🔥 Influx Fetch Error:", error);
            return null;
        }
    },

    /**
     * Saves farmer activity logs (PUMP, FERT, etc.)
     */
    async saveLog(deviceId, category, kh, en) {
        if (process.env.ENV_MODE === 'DEV') {
            console.log(`📝 [LOG] ${category}: ${en}`);
            return true;
        }
        try {
            if (!client) {
                console.error('❌ Influx client not initialized - cannot save log');
                return false;
            }
            const writeApi = client.getWriteApi(INFLUX_ORG, INFLUX_BUCKET);
            // InfluxDB Line Protocol format
            const point = `activity_logs,device=${deviceId},category=${category} textKh="${kh}",textEn="${en}"`;
            writeApi.writeRecord(point);
            await writeApi.close();
            return true;
        } catch (error) {
            console.error("🔥 Log Save Error:", error);
            return false;
        }
    },

    /**
     * Retrieves logs for the Logbook with Monthly & Weekly filtering.
     * Surgically Wired to handle the navigation from logbook.js
     */
    async getMonthlyLog(deviceId, month, year, page) {
        if (process.env.ENV_MODE === 'DEV') {
            // Mock data for province testing
            return [
                { _time: new Date(), textKh: "បានបើកម៉ូទ័រទឹក", textEn: "Pump Started" },
                { _time: new Date(Date.now() - 3600000), textKh: "បានដាក់ជីរួចរាល់", textEn: "Fertilizing Done" }
            ];
        }

        try {
            if (!client) {
                console.error('❌ Influx client not initialized - cannot fetch logbook');
                return [];
            }
            const queryApi = client.getQueryApi(INFLUX_ORG);
            
            // Define month boundaries for the Flux query
            const startOfMonth = new Date(year, month - 1, 1).toISOString();
            const endOfMonth = new Date(year, month, 1).toISOString();

            const query = `from(bucket: "${INFLUX_BUCKET}")
                |> range(start: ${startOfMonth}, stop: ${endOfMonth})
                |> filter(fn: (r) => r["_measurement"] == "activity_logs")
                |> filter(fn: (r) => r["device"] == "${deviceId}")
                |> sort(columns: ["_time"], desc: true)`;

            const rows = await queryApi.collectRows(query);

            // Filter by "Week" (Page) logic: Page 1 = Days 1-7, Page 2 = 8-14, etc.
            const startDay = (page - 1) * 7 + 1;
            const endDay = page * 7;

            return rows.filter(row => {
                const day = new Date(row._time).getDate();
                return day >= startDay && day <= endDay;
            });
        } catch (error) {
            console.error("🔥 Influx Logbook Fetch Error:", error);
            return [];
        }
    },

    /**
     * Weather Bridge
     */
    async getWeather(lat, lon) {
        try {
            const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.WEATHER_API_KEY}&units=metric`;
            const { data } = await axios.get(url);
            return {
                temp: Math.round(data.main.temp),
                humidity: data.main.humidity,
                desc: data.weather[0].description,
                wind: data.wind ? data.wind.speed : 0
            };
        } catch (error) {
            console.error("🔥 Weather API Error:", error);
            return null;
        }
    }
};

module.exports = dbService;