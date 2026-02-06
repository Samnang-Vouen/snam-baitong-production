const mqtt = require('mqtt');
const {
  buildBrokerUrl,
  MQTT_USERNAME,
  MQTT_PASSWORD,
  MQTT_TLS,
  PUMP_TOPIC,
  FERT_PUMP_TOPIC,
  PUMP_ON_PAYLOAD,
  PUMP_OFF_PAYLOAD,
} = require('../config/mqtt');

const DISABLE_MQTT = String(process.env.DISABLE_MQTT || '').toLowerCase() === 'true';

let client = null;
let isConnected = false;
let isInitialized = false;

function init() {
  if (client) return client;
  isInitialized = true;

  if (DISABLE_MQTT) {
    console.log('[MQTT] Disabled (DISABLE_MQTT=true). Using mock client.');
    client = {
      publish: (topic, payload, _opts, cb) => {
        console.log(`[MQTT:mock] publish -> ${topic} ::`, payload);
        if (typeof cb === 'function') cb(null);
      },
      end: () => {
        console.log('[MQTT:mock] end');
      },
    };
    isConnected = false;
    return client;
  }

  const brokerUrl = buildBrokerUrl();
  const options = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clean: true,
    queueQoSZero: true,
    reconnectPeriod: 2000,
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

// Updated for Scalability: Handles both Water and Fertilizer pumps
async function publishPump(type, on) {
  // 1. Determine the Topic
  // If type is 'fert', use the fertilizer topic. Otherwise, use the standard PUMP_TOPIC.
  const topic = type === 'fert' ? FERT_PUMP_TOPIC : PUMP_TOPIC;
  
  // 2. Determine the Payload
  const payload = on ? PUMP_ON_PAYLOAD : PUMP_OFF_PAYLOAD;
  
  // 3. Publish with QoS 1
  // We use QoS 1 to ensure the 'Stop' or 'Start' command definitely reaches the province
  await publish(topic, payload, { qos: 1, retain: false }); 
  
  console.log(`[MQTT] Action: ${type.toUpperCase()} | Status: ${on ? 'ON' : 'OFF'} | Topic: ${topic}`);
  
  return { topic, payload };
}

function status() {
  return {
    connected: isConnected,
    pumpTopic: PUMP_TOPIC,
    tls: MQTT_TLS,
    mocked: DISABLE_MQTT,
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
