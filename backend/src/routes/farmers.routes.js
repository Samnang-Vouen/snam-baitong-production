const express = require('express');
const router = express.Router();
const { createFarmer, getFarmers, getFarmer, updateFarmer, deleteFarmer, getFarmerWithSensors, generateFarmerQR, scanFarmerQR, markFeedbackViewed, downloadSensorDataCSV } = require('../controllers/farmers.controller');
const { getFarmerSensorDashboard } = require('../controllers/sensorDashboard.controller');
const sensorsController = require('../controllers/sensors.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize');
const { ROLES } = require('../services/user.service');

// Public QR scan endpoint (no auth required)
router.get('/scan/:token', scanFarmerQR);

// Public endpoint to get farmer profile by ID (for QR code scans)
router.get('/public/:id', getFarmer);

// All other farmer routes require authentication
router.use(authenticate);

// GET /api/farmers - Get all farmers
router.get('/', getFarmers);

// Sensor management routes for farmers (must come before /:id)
// GET /api/farmers/:farmerId/sensors/list - Get farmer's assigned sensors (metadata)
router.get('/:farmerId/sensors/list', sensorsController.getFarmerSensors);

// GET /api/farmers/:id/sensors/history - Get farmer's sensor assignment history
router.get('/:farmerId/sensors/history', sensorsController.getFarmerSensorHistory);

// GET /api/farmers/:id/sensors/download - Download sensor data as CSV
router.get('/:id/sensors/download', downloadSensorDataCSV);

// GET /api/farmers/:id/sensors - Get farmer with sensor readings from InfluxDB
router.get('/:id/sensors', getFarmerWithSensors);

// GET /api/farmers/:id/sensors/dashboard - Aggregated/sampled sensor data for charts (secure)
router.get('/:id/sensors/dashboard', getFarmerSensorDashboard);

// POST /api/farmers/:id/sensors/assign - Assign sensor(s) to farmer (admin only)
router.post('/:farmerId/sensors/assign', authorize([ROLES.ADMIN]), sensorsController.assignSensors);

// DELETE /api/farmers/:id/sensors/:sensorId/unassign - Unassign sensor from farmer (admin only)
router.delete('/:farmerId/sensors/:sensorId/unassign', authorize([ROLES.ADMIN]), sensorsController.unassignSensor);

// POST /api/farmers/:id/qr - Generate QR code for farmer
router.post('/:id/qr', generateFarmerQR);

// POST /api/farmers/:id/mark-viewed - Mark ministry feedback as viewed by admin
router.post('/:id/mark-viewed', authorize([ROLES.ADMIN]), markFeedbackViewed);

// GET /api/farmers/:id - Get specific farmer
router.get('/:id', getFarmer);

// POST /api/farmers - Create new farmer (admin only)
router.post('/', authorize('admin'), createFarmer);

// PUT /api/farmers/:id - Update farmer (admin and ministry)
router.put('/:id', authorize([ROLES.ADMIN, ROLES.MINISTRY]), updateFarmer);

// DELETE /api/farmers/:id - Delete farmer (admin only)
router.delete('/:id', authorize('admin'), deleteFarmer);

module.exports = router;
