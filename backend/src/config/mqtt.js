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
};

// Legacy exports for backward compatibility
const MQTT_USERNAME = process.env.MQTT_USERNAME || '';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';
const MQTT_TLS = process.env.MQTT_TLS === 'true';
const PUMP_TOPIC = process.env.PUMP_TOPIC || 'pump/control';
const PUMP_ON_PAYLOAD = process.env.PUMP_ON_PAYLOAD || 'ON';
const PUMP_OFF_PAYLOAD = process.env.PUMP_OFF_PAYLOAD || 'OFF';

function buildBrokerUrl() {
  return process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
}

module.exports = {
  MQTT_CONFIG,
  TOPICS,
  buildBrokerUrl,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TLS,
  PUMP_TOPIC,
  PUMP_ON_PAYLOAD,
  PUMP_OFF_PAYLOAD,
};
