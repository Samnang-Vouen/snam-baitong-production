const express = require('express');
const router = express.Router();
const mqttService = require('../services/mqtt.service');

router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Sensor Data Backend'
  });
});

// MQTT health/status (read-only)
router.get('/mqtt', (req, res) => {
  try {
    const st = mqttService.status();
    res.json({
      status: 'OK',
      mqtt: {
        connected: !!st.connected,
        mocked: !!st.mocked,
        pumpTopic: st.pumpTopic,
        tls: st.tls,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({
      status: 'ERROR',
      error: 'Failed to read MQTT status',
      message: e && e.message ? e.message : String(e),
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
