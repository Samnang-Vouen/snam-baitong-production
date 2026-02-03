const express = require('express');
const router = express.Router();
const sensorData = require('../controllers/sensorData.controller');
const sensorsController = require('../controllers/sensors.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { ROLES } = require('../services/user.service');

// Legacy routes for InfluxDB sensor data queries
router.get('/latest', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), sensorData.getLatest);
router.get('/devices', authenticate, authorize([ROLES.ADMIN]), sensorData.getDevices);

// New sensor management routes
router.get('/offline', authenticate, authorize([ROLES.ADMIN]), sensorsController.getOfflineSensors);
router.get('/', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), sensorsController.getAllSensors);
router.post('/', authenticate, authorize([ROLES.ADMIN]), sensorsController.createSensor);
router.get('/:id', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), sensorsController.getSensor);
router.put('/:id', authenticate, authorize([ROLES.ADMIN]), sensorsController.updateSensor);
router.delete('/:id', authenticate, authorize([ROLES.ADMIN]), sensorsController.deleteSensor);
router.get('/:id/farmers', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), sensorsController.getSensorFarmers);
router.get('/:id/history', authenticate, authorize([ROLES.ADMIN, ROLES.MINISTRY]), sensorsController.getSensorHistory);

module.exports = router;
