const soilHealthService = require('../services/soilHealth.service');
const sensorsService = require('../services/sensors.service');
const db = require('../services/mysql');

/**
 * Get weekly soil health summary for a specific farmer
 * GET /api/soil-health/farmer/:farmerId/weekly
 */
async function getFarmerWeeklySummary(req, res) {
  try {
    const { farmerId } = req.params;
    
    // Fetch farmer details from database
    const farmers = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    
    if (!farmers || farmers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    const farmer = farmers[0];
    
    // Get sensor devices from sensors table
    let sensorDevices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(farmerId);
      sensorDevices = sensors.map(s => s.device_id);
    } catch (err) {
      console.error('[getFarmerWeeklySummary] Error fetching sensors:', err.message);
      // Fallback to old sensor_devices field
      if (farmer.sensor_devices) {
        sensorDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    if (sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No sensor devices configured for this farmer'
      });
    }
    
    // Don't use location filter - sensor devices are unique identifiers
    const location = null;
    
    // Generate weekly summary
    const summary = await soilHealthService.generateWeeklySummary(
      farmerId,
      sensorDevices,
      location,
      farmer.planting_date,
      farmer.harvest_date
    );
    
    res.json({
      ...summary,
      farmer: {
        id: farmer.id,
        name: `${farmer.first_name} ${farmer.last_name}`,
        cropType: farmer.crop_type,
        location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
        plantingDate: farmer.planting_date,
        harvestDate: farmer.harvest_date
      }
    });
  } catch (error) {
    console.error('Error getting farmer weekly summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly soil health summary',
      message: error.message
    });
  }
}

/**
 * Get current soil health status for a specific farmer
 * GET /api/soil-health/farmer/:farmerId/current
 */
async function getFarmerCurrentHealth(req, res) {
  try {
    const { farmerId } = req.params;
    
    // Fetch farmer details from database
    const farmers = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    
    if (!farmers || farmers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    const farmer = farmers[0];
    
    // Get sensor devices from sensors table
    let sensorDevices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(farmerId);
      sensorDevices = sensors.map(s => s.device_id);
    } catch (err) {
      console.error('[getFarmerCurrentHealth] Error fetching sensors:', err.message);
      // Fallback to old sensor_devices field
      if (farmer.sensor_devices) {
        sensorDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    if (sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No sensor devices configured for this farmer'
      });
    }
    
    const location = null;
    
    // Get current soil health
    const health = await soilHealthService.getCurrentSoilHealth(sensorDevices, location);
    
    res.json({
      ...health,
      farmer: {
        id: farmer.id,
        name: `${farmer.first_name} ${farmer.last_name}`,
        cropType: farmer.crop_type,
        location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`
      }
    });
  } catch (error) {
    console.error('Error getting farmer current health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current soil health',
      message: error.message
    });
  }
}

/**
 * Get weekly soil health summary by sensor devices (without farmer context)
 * POST /api/soil-health/weekly
 * Body: { sensorDevices: [], location: "", plantingDate: "", harvestDate: "" }
 */
async function getWeeklySummary(req, res) {
  try {
    const { sensorDevices, location, plantingDate, harvestDate } = req.body;
    
    if (!sensorDevices || !Array.isArray(sensorDevices) || sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sensorDevices array is required'
      });
    }
    
    if (!plantingDate) {
      return res.status(400).json({
        success: false,
        error: 'plantingDate is required'
      });
    }
    
    const summary = await soilHealthService.generateWeeklySummary(
      null,
      sensorDevices,
      location || null,
      plantingDate,
      harvestDate || null
    );
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting weekly summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate weekly soil health summary',
      message: error.message
    });
  }
}

/**
 * Get current soil health by sensor devices (without farmer context)
 * POST /api/soil-health/current
 * Body: { sensorDevices: [], location: "" }
 */
async function getCurrentHealth(req, res) {
  try {
    const { sensorDevices, location } = req.body;
    
    if (!sensorDevices || !Array.isArray(sensorDevices) || sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sensorDevices array is required'
      });
    }
    
    const health = await soilHealthService.getCurrentSoilHealth(sensorDevices, location || null);
    
    res.json(health);
  } catch (error) {
    console.error('Error getting current health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get current soil health',
      message: error.message
    });
  }
}

/**
 * Get soil health reference ranges
 * GET /api/soil-health/ranges
 */
async function getHealthRanges(req, res) {
  try {
    res.json({
      success: true,
      ranges: soilHealthService.HEALTHY_RANGES,
      issues: soilHealthService.HEALTH_ISSUES
    });
  } catch (error) {
    console.error('Error getting health ranges:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get health ranges',
      message: error.message
    });
  }
}

/**
 * Get soil health summary for all farmers
 * GET /api/soil-health/farmers/summary
 */
async function getAllFarmersSummary(req, res) {
  try {
    // Get all farmers with sensor devices
    const farmers = await db.query(
      'SELECT * FROM farmers WHERE sensor_devices IS NOT NULL AND sensor_devices != "" ORDER BY created_at DESC'
    );
    
    if (!farmers || farmers.length === 0) {
      return res.json({
        success: true,
        farmers: [],
        message: 'No farmers with sensor devices found'
      });
    }
    
    // Get current health for each farmer
    const summaries = await Promise.all(
      farmers.map(async (farmer) => {
        try {
          const sensorDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
          const location = farmer.district_name || farmer.province_city || null;
          
          const health = await soilHealthService.getCurrentSoilHealth(sensorDevices, location);
          
          return {
            farmerId: farmer.id,
            farmerName: `${farmer.first_name} ${farmer.last_name}`,
            cropType: farmer.crop_type,
            location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
            plantingDate: farmer.planting_date,
            harvestDate: farmer.harvest_date,
            sensorDevices,
            ...health
          };
        } catch (error) {
          console.error(`Error getting health for farmer ${farmer.id}:`, error);
          return {
            farmerId: farmer.id,
            farmerName: `${farmer.first_name} ${farmer.last_name}`,
            cropType: farmer.crop_type,
            success: false,
            error: 'Failed to get soil health data'
          };
        }
      })
    );
    
    res.json({
      success: true,
      count: summaries.length,
      farmers: summaries
    });
  } catch (error) {
    console.error('Error getting all farmers summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get farmers summary',
      message: error.message
    });
  }
}

/**
 * Get crop safety score for a specific farmer
 * GET /api/soil-health/farmer/:farmerId/crop-safety
 */
async function getFarmerCropSafety(req, res) {
  try {
    const { farmerId } = req.params;
    const { cropType } = req.query;
    
    // Fetch farmer details from database
    const farmers = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    
    if (!farmers || farmers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    const farmer = farmers[0];
    
    // Get sensor devices from sensors table
    let sensorDevices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(farmerId);
      sensorDevices = sensors.map(s => s.device_id);
    } catch (err) {
      console.error('[getFarmerCropSafety] Error fetching sensors:', err.message);
      // Fallback to old sensor_devices field
      if (farmer.sensor_devices) {
        sensorDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    if (sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No sensor devices configured for this farmer'
      });
    }
    
    const location = null;
    const crop = cropType || farmer.crop_type || 'general';
    
    // Calculate weekly crop safety
    const safety = await soilHealthService.calculateWeeklyCropSafety(
      farmerId,
      sensorDevices,
      location,
      farmer.planting_date,
      farmer.harvest_date,
      crop
    );
    
    res.json({
      ...safety,
      farmer: {
        id: farmer.id,
        name: `${farmer.first_name} ${farmer.last_name}`,
        cropType: farmer.crop_type,
        location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`,
        plantingDate: farmer.planting_date,
        harvestDate: farmer.harvest_date
      }
    });
  } catch (error) {
    console.error('Error getting farmer crop safety:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate crop safety score',
      message: error.message
    });
  }
}

/**
 * Get current crop safety score for a specific farmer
 * GET /api/soil-health/farmer/:farmerId/current-safety
 */
async function getFarmerCurrentSafety(req, res) {
  try {
    const { farmerId } = req.params;
    const { cropType } = req.query;
    
    // Fetch farmer details from database
    const farmers = await db.query('SELECT * FROM farmers WHERE id = ?', [farmerId]);
    
    if (!farmers || farmers.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Farmer not found'
      });
    }
    
    const farmer = farmers[0];
    
    // Get sensor devices from sensors table
    let sensorDevices = [];
    try {
      const sensors = await sensorsService.getFarmerSensors(farmerId);
      sensorDevices = sensors.map(s => s.device_id);
    } catch (err) {
      console.error('[getFarmerCurrentSafety] Error fetching sensors:', err.message);
      // Fallback to old sensor_devices field
      if (farmer.sensor_devices) {
        sensorDevices = farmer.sensor_devices.split(',').map(d => d.trim()).filter(Boolean);
      }
    }
    
    if (sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No sensor devices configured for this farmer'
      });
    }
    
    const location = null;
    const crop = cropType || farmer.crop_type || 'general';
    
    // Calculate current crop safety
    const safety = await soilHealthService.calculateCurrentCropSafety(sensorDevices, location, crop);
    
    res.json({
      ...safety,
      farmer: {
        id: farmer.id,
        name: `${farmer.first_name} ${farmer.last_name}`,
        cropType: farmer.crop_type,
        location: `${farmer.village_name}, ${farmer.district_name}, ${farmer.province_city}`
      }
    });
  } catch (error) {
    console.error('Error getting farmer current safety:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate current crop safety',
      message: error.message
    });
  }
}

/**
 * Calculate crop safety score by sensor devices
 * POST /api/soil-health/crop-safety
 * Body: { sensorDevices: [], location: "", plantingDate: "", harvestDate: "", cropType: "" }
 */
async function getCropSafety(req, res) {
  try {
    const { sensorDevices, location, plantingDate, harvestDate, cropType } = req.body;
    
    if (!sensorDevices || !Array.isArray(sensorDevices) || sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sensorDevices array is required'
      });
    }
    
    if (!plantingDate) {
      return res.status(400).json({
        success: false,
        error: 'plantingDate is required'
      });
    }
    
    const crop = cropType || 'general';
    
    const safety = await soilHealthService.calculateWeeklyCropSafety(
      null,
      sensorDevices,
      location || null,
      plantingDate,
      harvestDate || null,
      crop
    );
    
    res.json(safety);
  } catch (error) {
    console.error('Error calculating crop safety:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate crop safety score',
      message: error.message
    });
  }
}

/**
 * Get current crop safety by sensor devices
 * POST /api/soil-health/current-safety
 * Body: { sensorDevices: [], location: "", cropType: "" }
 */
async function getCurrentSafety(req, res) {
  try {
    const { sensorDevices, location, cropType } = req.body;
    
    if (!sensorDevices || !Array.isArray(sensorDevices) || sensorDevices.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sensorDevices array is required'
      });
    }
    
    const crop = cropType || 'general';
    
    const safety = await soilHealthService.calculateCurrentCropSafety(sensorDevices, location || null, crop);
    
    res.json(safety);
  } catch (error) {
    console.error('Error calculating current safety:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate current crop safety',
      message: error.message
    });
  }
}

/**
 * Get available crop types
 * GET /api/soil-health/crop-types
 */
async function getCropTypes(req, res) {
  try {
    const cropTypes = Object.keys(soilHealthService.CROP_RANGES);
    
    res.json({
      success: true,
      cropTypes,
      count: cropTypes.length
    });
  } catch (error) {
    console.error('Error getting crop types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get crop types',
      message: error.message
    });
  }
}

module.exports = {
  getFarmerWeeklySummary,
  getFarmerCurrentHealth,
  getWeeklySummary,
  getCurrentHealth,
  getHealthRanges,
  getAllFarmersSummary,
  getFarmerCropSafety,
  getFarmerCurrentSafety,
  getCropSafety,
  getCurrentSafety,
  getCropTypes
};
