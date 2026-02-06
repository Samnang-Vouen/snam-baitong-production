require('dotenv').config();

const MQTT_CONFIG = {
  BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  CLIENT_ID: process.env.MQTT_CLIENT_ID || `mqtt_client_${Math.random().toString(16).slice(3)}`,
  USERNAME: process.env.MQTT_USERNAME || '',
  PASSWORD: process.env.MQTT_PASSWORD || '',
  RECONNECT_PERIOD: parseInt(process.env.MQTT_RECONNECT_PERIOD) || 1000,
  CONNECT_TIMEOUT: parseInt(process.env.MQTT_CONNECT_TIMEOUT) || 30000,
};

const TOPICS = {
  SENSOR_DATA: process.env.MQTT_TOPIC_SENSOR || 'sensor/data',
  CONTROL: process.env.MQTT_TOPIC_CONTROL || 'control/+',
  STATUS: process.env.MQTT_TOPIC_STATUS || 'device/status',
  // Scalability: Added Fertilizer to the main TOPICS object
  FERT_CONTROL: process.env.FERT_PUMP_TOPIC || 'farm/fert/control'
};

// Legacy exports and Bridge Mappings
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_TLS = process.env.MQTT_TLS === 'true';

// Fixed: Now correctly maps to MQTT_PUMP_TOPIC from the .env
const PUMP_TOPIC = process.env.MQTT_PUMP_TOPIC || 'farm/pump/control';

// New: Exported for clean use in mqtt.service.js
const FERT_PUMP_TOPIC = process.env.FERT_PUMP_TOPIC || 'farm/fert/control';

const PUMP_ON_PAYLOAD = process.env.PUMP_ON_PAYLOAD || 'ON';
const PUMP_OFF_PAYLOAD = process.env.PUMP_OFF_PAYLOAD || 'OFF';

function buildBrokerUrl() {
  // Priority: 1. BROKER_URL env, 2. HOST:PORT combo, 3. Localhost default
  if (process.env.MQTT_BROKER_URL) return process.env.MQTT_BROKER_URL;
  
  const host = process.env.MQTT_HOST || 'localhost';
  const port = process.env.MQTT_PORT || '1883';
  const protocol = MQTT_TLS ? 'mqtts' : 'mqtt';
  
  return `${protocol}://${host}:${port}`;
}

module.exports = {
  MQTT_CONFIG,
  TOPICS,
  buildBrokerUrl,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TLS,
  PUMP_TOPIC,
  FERT_PUMP_TOPIC, // Now exported!
  PUMP_ON_PAYLOAD,
  PUMP_OFF_PAYLOAD,
};