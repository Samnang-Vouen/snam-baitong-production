const express = require('express');
const router = express.Router();
const soilHealthController = require('../controllers/soilHealth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

/**
 * @route   GET /api/soil-health/ranges
 * @desc    Get soil health reference ranges
 * @access  Public
 */
router.get('/ranges', soilHealthController.getHealthRanges);

/**
 * @route   GET /api/soil-health/farmer/:farmerId/weekly
 * @desc    Get weekly soil health summary for a specific farmer
 * @access  Protected
 */
router.get('/farmer/:farmerId/weekly', authenticate, soilHealthController.getFarmerWeeklySummary);

/**
 * @route   GET /api/soil-health/farmer/:farmerId/current
 * @desc    Get current soil health status for a specific farmer
 * @access  Protected
 */
router.get('/farmer/:farmerId/current', authenticate, soilHealthController.getFarmerCurrentHealth);

/**
 * @route   POST /api/soil-health/weekly
 * @desc    Get weekly soil health summary by sensor devices
 * @access  Protected
 * @body    { sensorDevices: [], location: "", plantingDate: "", harvestDate: "" }
 */
router.post('/weekly', authenticate, soilHealthController.getWeeklySummary);

/**
 * @route   POST /api/soil-health/current
 * @desc    Get current soil health by sensor devices
 * @access  Protected
 * @body    { sensorDevices: [], location: "" }
 */
router.post('/current', authenticate, soilHealthController.getCurrentHealth);

/**
 * @route   GET /api/soil-health/farmers/summary
 * @desc    Get soil health summary for all farmers
 * @access  Protected
 */
router.get('/farmers/summary', authenticate, soilHealthController.getAllFarmersSummary);

/**
 * @route   GET /api/soil-health/crop-types
 * @desc    Get available crop types
 * @access  Public
 */
router.get('/crop-types', soilHealthController.getCropTypes);

/**
 * @route   GET /api/soil-health/farmer/:farmerId/crop-safety
 * @desc    Get crop safety score (weekly) for a specific farmer
 * @access  Protected
 * @query   cropType (optional) - Overrides farmer's crop type
 */
router.get('/farmer/:farmerId/crop-safety', authenticate, soilHealthController.getFarmerCropSafety);

/**
 * @route   GET /api/soil-health/farmer/:farmerId/current-safety
 * @desc    Get current crop safety score for a specific farmer
 * @access  Protected
 * @query   cropType (optional) - Overrides farmer's crop type
 */
router.get('/farmer/:farmerId/current-safety', authenticate, soilHealthController.getFarmerCurrentSafety);

/**
 * @route   POST /api/soil-health/crop-safety
 * @desc    Calculate crop safety score by sensor devices
 * @access  Protected
 * @body    { sensorDevices: [], location: "", plantingDate: "", harvestDate: "", cropType: "" }
 */
router.post('/crop-safety', authenticate, soilHealthController.getCropSafety);

/**
 * @route   POST /api/soil-health/current-safety
 * @desc    Get current crop safety by sensor devices
 * @access  Protected
 * @body    { sensorDevices: [], location: "", cropType: "" }
 */
router.post('/current-safety', authenticate, soilHealthController.getCurrentSafety);

module.exports = router;
