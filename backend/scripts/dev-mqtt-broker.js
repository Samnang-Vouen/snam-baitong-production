// Simple MQTT broker using Aedes (for local dev/testing)
const net = require('net');
const http = require('http');
const aedes = require('aedes')();

// Optional username/password authentication via env
// Set MQTT_USERNAME and MQTT_PASSWORD in .env to require auth
try {
  aedes.authenticate = (client, username, password, done) => {
    const envUser = process.env.MQTT_USERNAME || '';
    const envPass = process.env.MQTT_PASSWORD || '';
    if (!envUser && !envPass) return done(null, true);
    const providedUser = (username || '').toString();
    const providedPass = (password ? password.toString() : '');
    if (providedUser === envUser && providedPass === envPass) return done(null, true);
    const err = new Error('Authentication failed');
    console.warn(`[DEV MQTT] Auth failed for client ${client && client.id}`);
    return done(err, false);
  };
} catch (e) {
  console.warn('[DEV MQTT] Could not set authenticate handler:', e.message);
}

// Optional WebSocket support
let wsServerInited = false;
try {
  // These are optional dependencies; only used if installed
  const ws = require('ws');
  const websocketStream = require('websocket-stream');

  const wsPort = parseInt(process.env.MQTT_WS_PORT || '8083', 10);
  const wsPath = process.env.MQTT_WS_PATH || '/mqtt';
  const httpServer = http.createServer();
  const wss = new ws.Server({ server: httpServer, path: wsPath });
  wss.on('connection', (socket) => {
    const stream = websocketStream(socket);
    aedes.handle(stream);
  });
  httpServer.listen(wsPort, () => {
    wsServerInited = true;
    console.log(`[DEV MQTT] WebSocket MQTT listening on ws://localhost:${wsPort}${wsPath}`);
  });
} catch (_) {
  console.log('[DEV MQTT] WebSocket support not enabled (install ws and websocket-stream to enable).');
}

const port = parseInt(process.env.MQTT_PORT || '1883', 10);

const server = net.createServer(aedes.handle);

server.listen(port, () => {
  console.log(`[DEV MQTT] TCP MQTT broker listening on port ${port}`);
});

// Log connections
aedes.on('client', (client) => {
  console.log(`[DEV MQTT] Client connected: ${client ? client.id : 'unknown'}`);
});
aedes.on('clientDisconnect', (client) => {
  console.log(`[DEV MQTT] Client disconnected: ${client ? client.id : 'unknown'}`);
});

// Log subscriptions
aedes.on('subscribe', (subscriptions, client) => {
  const topics = subscriptions.map((s) => s.topic).join(', ');
  console.log(`[DEV MQTT] Subscribe: ${topics} by ${client && client.id}`);
});

// Log publishes
aedes.on('publish', (packet, client) => {
  const by = client && client.id ? client.id : 'broker';
  try {
    const payload = packet.payload ? packet.payload.toString() : '';
    console.log(`[DEV MQTT] Publish: ${packet.topic} <= ${payload} by ${by}`);
  } catch (_) {
    console.log(`[DEV MQTT] Publish: ${packet.topic} by ${by}`);
  }
});
