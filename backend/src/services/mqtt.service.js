const mqtt = require('mqtt');
const {
  buildBrokerUrl,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TLS,
  PUMP_TOPIC,
  PUMP_ON_PAYLOAD,
  PUMP_OFF_PAYLOAD,
} = require('../config/mqtt');

let client = null;
let isConnected = false;
let isInitialized = false;

function init() {
  if (client) return client;
  isInitialized = true;
  const brokerUrl = buildBrokerUrl();
  const options = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    // Queue QoS 0 messages while offline so we don't lose commands when reconnecting
    queueQoSZero: true,
    reconnectPeriod: 2000,
    // TLS is implied by mqtts:// scheme. Custom certs could be added here if needed.
    // rejectUnauthorized: false,
  };

  client = mqtt.connect(brokerUrl, options);

  client.on('connect', () => {
    isConnected = true;
    console.log(`[MQTT] Connected to ${brokerUrl}${MQTT_USERNAME ? ' as ' + MQTT_USERNAME : ''}`);
  });
  client.on('reconnect', () => console.log('[MQTT] Reconnecting...'));
  client.on('close', () => {
    if (isConnected) console.log('[MQTT] Connection closed');
    isConnected = false;
  });
  client.on('error', (err) => console.error('[MQTT] Error:', err.message));

  return client;
}

function publish(topic, message, options = { qos: 0, retain: false }) {
  if (!client) {
    if (!isInitialized) {
      throw new Error('[MQTT] Service not initialized. Call mqttService.init() once at startup.');
    }
    init();
  }
  const payload = typeof message === 'string' ? message : JSON.stringify(message);
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, options, (err) => {
      if (err) return reject(err);
      resolve(true);
    });
  });
}

async function publishPump(on) {
  const payload = on ? PUMP_ON_PAYLOAD : PUMP_OFF_PAYLOAD;
  await publish(PUMP_TOPIC, payload, { qos: 0, retain: false });
  return { topic: PUMP_TOPIC, payload };
}

function status() {
  return {
    connected: isConnected,
    pumpTopic: PUMP_TOPIC,
    tls: MQTT_TLS,
  };
}

function close() {
  if (client) {
    try { client.end(true); } catch (_) {}
  }
  client = null;
  isConnected = false;
}

module.exports = { init, publish, publishPump, status, close };
