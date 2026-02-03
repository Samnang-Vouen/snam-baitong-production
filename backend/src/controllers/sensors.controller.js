const sensorsService = require('../services/sensors.service');

/**
 * GET /api/sensors
 * Get all sensors with optional filters
 */
async function getAllSensors(req, res) {
  try {
    const filters = {
      status: req.query.status,
      sensor_type: req.query.sensor_type,
      assigned: req.query.assigned === 'true' ? true : req.query.assigned === 'false' ? false : undefined
    };

    const sensors = await sensorsService.getAllSensors(filters);

    res.json({
      success: true,
      count: sensors.length,
      data: sensors
    });
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sensors',
      message: error.message
    });
  }
}

/**
 * GET /api/sensors/:id
 * Get sensor by ID
 */
async function getSensor(req, res) {
  try {
    const { id } = req.params;
    const sensor = await sensorsService.getSensorById(id);

    if (!sensor) {
      return res.status(404).json({
        success: false,
        error: 'Sensor not found'
      });
    }

    res.json({
      success: true,
      data: sensor
    });
  } catch (error) {
    console.error('Error fetching sensor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sensor',
      message: error.message
    });
  }
}

/**
 * POST /api/sensors
 * Create a new sensor
 */
async function createSensor(req, res) {
  try {
    const sensorData = {
      device_id: req.body.device_id,
      sensor_type: req.body.sensor_type || 'soil',
      model: req.body.model || null,
      status: req.body.status || 'active',
      installation_date: req.body.installation_date || null,
      location_tag: req.body.location_tag || null,
      physical_location: req.body.physical_location || null,
      notes: req.body.notes || null
    };

    // Validate required fields
    if (!sensorData.device_id) {
      return res.status(400).json({
        success: false,
        error: 'device_id is required'
      });
    }

    const sensor = await sensorsService.createSensor(sensorData);

    res.status(201).json({
      success: true,
      message: 'Sensor created successfully',
      data: sensor
    });
  } catch (error) {
    console.error('Error creating sensor:', error);
    const status = error.message.includes('already exists') ? 409 : 500;
    res.status(status).json({
      success: false,
      error: 'Failed to create sensor',
      message: error.message
    });
  }
}

/**
 * PUT /api/sensors/:id
 * Update sensor
 */
async function updateSensor(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    const sensor = await sensorsService.updateSensor(id, updates);

    res.json({
      success: true,
      message: 'Sensor updated successfully',
      data: sensor
    });
  } catch (error) {
    console.error('Error updating sensor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sensor',
      message: error.message
    });
  }
}

/**
 * DELETE /api/sensors/:id
 * Delete sensor
 */
async function deleteSensor(req, res) {
  try {
    const { id } = req.params;

    await sensorsService.deleteSensor(id);

    res.json({
      success: true,
      message: 'Sensor deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting sensor:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete sensor',
      message: error.message
    });
  }
}

/**
 * GET /api/sensors/:id/farmers
 * Get farmers assigned to a sensor
 */
async function getSensorFarmers(req, res) {
  try {
    const { id } = req.params;
    const farmers = await sensorsService.getSensorFarmers(id);

    res.json({
      success: true,
      count: farmers.length,
      data: farmers
    });
  } catch (error) {
    console.error('Error fetching sensor farmers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sensor farmers',
      message: error.message
    });
  }
}

/**
 * GET /api/sensors/:id/history
 * Get sensor assignment history
 */
async function getSensorHistory(req, res) {
  try {
    const { id } = req.params;
    const history = await sensorsService.getSensorHistory(id);

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sensor history',
      message: error.message
    });
  }
}

/**
 * GET /api/sensors/offline
 * Get offline sensors
 */
async function getOfflineSensors(req, res) {
  try {
    const hoursThreshold = parseInt(req.query.hours) || 1;
    const sensors = await sensorsService.getOfflineSensors(hoursThreshold);

    res.json({
      success: true,
      count: sensors.length,
      threshold_hours: hoursThreshold,
      data: sensors
    });
  } catch (error) {
    console.error('Error fetching offline sensors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch offline sensors',
      message: error.message
    });
  }
}

/**
 * GET /api/farmers/:farmerId/sensors
 * Get sensors assigned to a farmer
 */
async function getFarmerSensors(req, res) {
  try {
    const { farmerId } = req.params;
    const sensors = await sensorsService.getFarmerSensors(farmerId);

    res.json({
      success: true,
      count: sensors.length,
      data: sensors
    });
  } catch (error) {
    console.error('Error fetching farmer sensors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch farmer sensors',
      message: error.message
    });
  }
}

/**
 * POST /api/farmers/:farmerId/sensors
 * Assign sensor(s) to farmer
 */
async function assignSensors(req, res) {
  try {
    const { farmerId } = req.params;
    const { device_id, device_ids, notes } = req.body;

    // Support both single and multiple assignment
    if (device_ids && Array.isArray(device_ids)) {
      // Multiple sensors
      const results = await sensorsService.assignMultipleSensors(farmerId, device_ids, notes);
      
      res.json({
        success: true,
        message: `Assigned ${results.success.length} sensor(s), ${results.failed.length} failed`,
        data: results
      });
    } else if (device_id) {
      // Single sensor
      const sensor = await sensorsService.assignSensorToFarmer(farmerId, device_id, notes);
      
      res.json({
        success: true,
        message: 'Sensor assigned successfully',
        data: sensor
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'device_id or device_ids is required'
      });
    }
  } catch (error) {
    console.error('Error assigning sensor:', error);
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('already assigned') ? 409 : 500;
    res.status(status).json({
      success: false,
      error: 'Failed to assign sensor',
      message: error.message
    });
  }
}

/**
 * DELETE /api/farmers/:farmerId/sensors/:sensorId
 * Unassign sensor from farmer
 */
async function unassignSensor(req, res) {
  try {
    const { farmerId, sensorId } = req.params;

    await sensorsService.unassignSensorFromFarmer(farmerId, sensorId);

    res.json({
      success: true,
      message: 'Sensor unassigned successfully'
    });
  } catch (error) {
    console.error('Error unassigning sensor:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      success: false,
      error: 'Failed to unassign sensor',
      message: error.message
    });
  }
}

/**
 * GET /api/farmers/:farmerId/sensors/history
 * Get farmer's sensor assignment history
 */
async function getFarmerSensorHistory(req, res) {
  try {
    const { farmerId } = req.params;
    const history = await sensorsService.getFarmerSensorHistory(farmerId);

    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching farmer sensor history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch farmer sensor history',
      message: error.message
    });
  }
}

module.exports = {
  getAllSensors,
  getSensor,
  createSensor,
  updateSensor,
  deleteSensor,
  getSensorFarmers,
  getSensorHistory,
  getOfflineSensors,
  getFarmerSensors,
  assignSensors,
  unassignSensor,
  getFarmerSensorHistory
};
