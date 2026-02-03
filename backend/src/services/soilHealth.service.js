const sqlService = require('./sql');
const { formatTimestampLocal } = require('../utils/format');

const MEASUREMENT = process.env.INFLUXDB_MEASUREMENT || 'sensor_data';

// In-memory cache for crop safety scores
const cropSafetyCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Soil health reference ranges for general crops
const HEALTHY_RANGES = {
  nitrogen: { min: 20, max: 50, unit: 'mg/kg' },
  phosphorus: { min: 10, max: 30, unit: 'mg/kg' },
  potassium: { min: 80, max: 200, unit: 'mg/kg' },
  ph: { min: 6.0, max: 7.0, unit: '' },
  ec: { min: 0.2, max: 2.0, unit: 'dS/m' },
  moisture: { min: 15, max: 35, unit: '% VWC' },
  temperature: { min: 18, max: 30, unit: '°C' },
  salinity: { min: 0.2, max: 2.0, unit: 'dS/m' }
};

// Crop-specific optimal ranges (based on FAO guidelines and agronomic research)
const CROP_RANGES = {
  rice: {
    nitrogen: { optimal: { min: 30, max: 50 }, unit: 'mg/kg', weight: 1.2 },
    phosphorus: { optimal: { min: 15, max: 30 }, unit: 'mg/kg', weight: 1.0 },
    potassium: { optimal: { min: 100, max: 180 }, unit: 'mg/kg', weight: 1.1 },
    ph: { optimal: { min: 5.5, max: 6.5 }, unit: '', weight: 1.3 },
    ec: { optimal: { min: 0.5, max: 2.0 }, unit: 'dS/m', weight: 1.0 },
    moisture: { optimal: { min: 25, max: 40 }, unit: '% VWC', weight: 1.5 },
    temperature: { optimal: { min: 22, max: 32 }, unit: '°C', weight: 1.2 },
    salinity: { optimal: { min: 0.5, max: 2.0 }, unit: 'dS/m', weight: 0.9 }
  },
  vegetables: {
    nitrogen: { optimal: { min: 25, max: 45 }, unit: 'mg/kg', weight: 1.3 },
    phosphorus: { optimal: { min: 12, max: 28 }, unit: 'mg/kg', weight: 1.2 },
    potassium: { optimal: { min: 90, max: 200 }, unit: 'mg/kg', weight: 1.2 },
    ph: { optimal: { min: 6.0, max: 7.0 }, unit: '', weight: 1.3 },
    ec: { optimal: { min: 0.3, max: 2.0 }, unit: 'dS/m', weight: 1.1 },
    moisture: { optimal: { min: 18, max: 35 }, unit: '% VWC', weight: 1.4 },
    temperature: { optimal: { min: 18, max: 28 }, unit: '°C', weight: 1.1 },
    salinity: { optimal: { min: 0.3, max: 1.8 }, unit: 'dS/m', weight: 1.0 }
  },
  corn: {
    nitrogen: { optimal: { min: 35, max: 60 }, unit: 'mg/kg', weight: 1.4 },
    phosphorus: { optimal: { min: 15, max: 35 }, unit: 'mg/kg', weight: 1.2 },
    potassium: { optimal: { min: 120, max: 220 }, unit: 'mg/kg', weight: 1.3 },
    ph: { optimal: { min: 6.0, max: 7.0 }, unit: '', weight: 1.2 },
    ec: { optimal: { min: 0.4, max: 1.8 }, unit: 'dS/m', weight: 1.0 },
    moisture: { optimal: { min: 20, max: 35 }, unit: '% VWC', weight: 1.5 },
    temperature: { optimal: { min: 20, max: 30 }, unit: '°C', weight: 1.2 },
    salinity: { optimal: { min: 0.4, max: 1.7 }, unit: 'dS/m', weight: 0.9 }
  },
  wheat: {
    nitrogen: { optimal: { min: 30, max: 55 }, unit: 'mg/kg', weight: 1.3 },
    phosphorus: { optimal: { min: 12, max: 30 }, unit: 'mg/kg', weight: 1.1 },
    potassium: { optimal: { min: 90, max: 190 }, unit: 'mg/kg', weight: 1.1 },
    ph: { optimal: { min: 6.0, max: 7.5 }, unit: '', weight: 1.2 },
    ec: { optimal: { min: 0.3, max: 2.2 }, unit: 'dS/m', weight: 1.0 },
    moisture: { optimal: { min: 18, max: 32 }, unit: '% VWC', weight: 1.3 },
    temperature: { optimal: { min: 15, max: 25 }, unit: '°C', weight: 1.1 },
    salinity: { optimal: { min: 0.3, max: 2.0 }, unit: 'dS/m', weight: 0.9 }
  },
  general: {
    nitrogen: { optimal: { min: 20, max: 50 }, unit: 'mg/kg', weight: 1.0 },
    phosphorus: { optimal: { min: 10, max: 30 }, unit: 'mg/kg', weight: 1.0 },
    potassium: { optimal: { min: 80, max: 200 }, unit: 'mg/kg', weight: 1.0 },
    ph: { optimal: { min: 6.0, max: 7.0 }, unit: '', weight: 1.0 },
    ec: { optimal: { min: 0.2, max: 2.0 }, unit: 'dS/m', weight: 1.0 },
    moisture: { optimal: { min: 15, max: 35 }, unit: '% VWC', weight: 1.0 },
    temperature: { optimal: { min: 18, max: 30 }, unit: '°C', weight: 1.0 },
    salinity: { optimal: { min: 0.2, max: 2.0 }, unit: 'dS/m', weight: 1.0 }
  }
};

// Health issue descriptions
const HEALTH_ISSUES = {
  nitrogen: {
    low: 'Nitrogen too low (< 20 mg/kg) → weak growth, yellowing leaves',
    high: 'Nitrogen too high (> 50 mg/kg) → soft plants, pollution risk'
  },
  phosphorus: {
    low: 'Phosphorus too low (< 10 mg/kg) → poor root growth, delayed flowering',
    high: 'Phosphorus too high (> 30 mg/kg) → nutrient lockout, reduced availability of other nutrients'
  },
  potassium: {
    low: 'Potassium too low (< 80 mg/kg) → weak stems, poor disease resistance',
    high: 'Potassium too high (> 200 mg/kg) → salt stress, reduced calcium uptake'
  },
  ph: {
    low: 'pH too low (< 5.5) → acidic soil, nutrients become unavailable',
    high: 'pH too high (> 7.5) → alkaline soil, nutrient deficiencies'
  },
  ec: {
    low: 'EC too low (< 0.2 dS/m) → very low nutrient content',
    high: 'EC too high (> 2.0 dS/m) → high salinity, roots cannot absorb water properly'
  },
  moisture: {
    low: 'Moisture too low (< 10 %) → drought stress, plant wilting',
    high: 'Moisture too high (> 40 %) → waterlogged soil, root rot risk'
  },
  temperature: {
    low: 'Temperature too low (< 10 °C) → root activity slows, stunted growth',
    high: 'Temperature too high (> 35 °C) → root damage, reduced nutrient uptake'
  },
  salinity: {
    low: 'Salinity too low (< 0.2 dS/m) → minimal concern',
    high: 'Salinity too high (> 2.0 dS/m) → salt stress, poor water absorption'
  }
};

/**
 * Helper function to safely convert values (including BigInt)
 */
function safeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Get 1AM snapshot time range for a given date
 * Returns time window from 1:00 AM to 1:59:59 AM
 */
function get1AMSnapshotTimeRange(date = new Date()) {
  const snapshot = new Date(date);
  snapshot.setHours(1, 0, 0, 0);
  
  const endSnapshot = new Date(snapshot);
  endSnapshot.setHours(1, 59, 59, 999);
  
  return {
    start: snapshot.toISOString(),
    end: endSnapshot.toISOString()
  };
}

/**
 * Build WHERE clause for filtering by device/location
 */
function buildWhere(sensorDevices = null, location = null, startDate = null, endDate = null) {
  const filters = [];
  
  if (sensorDevices && Array.isArray(sensorDevices) && sensorDevices.length > 0) {
    const deviceList = sensorDevices.map(d => `'${String(d).replace(/'/g, "''")}'`).join(',');
    filters.push(`device IN (${deviceList})`);
  }
  
  if (location) {
    filters.push(`location = '${String(location).replace(/'/g, "''")}'`);
  }
  
  if (startDate) {
    filters.push(`time >= '${startDate}'`);
  }
  
  if (endDate) {
    filters.push(`time <= '${endDate}'`);
  }
  
  return filters.length ? `WHERE ${filters.join(' AND ')}` : '';
}

/**
 * Query sensor data from InfluxDB for a given time range
 */
async function querySensorData(sensorDevices, location, startDate, endDate, limit = null) {
  const where = buildWhere(sensorDevices, location, startDate, endDate);
  const limitClause = limit ? `LIMIT ${parseInt(limit)}` : '';
  const sql = `
    SELECT 
      time,
      temperature,
      moisture,
      ec,
      "pH" as ph,
      nitrogen,
      phosphorus,
      potassium,
      salinity,
      device,
      location
    FROM "${MEASUREMENT}"
    ${where}
    ORDER BY time DESC
    ${limitClause}
  `;
  
  const rows = await sqlService.query(sql);
  // If we applied a limit and sorted DESC, reverse to get chronological order
  return limit && rows ? rows.reverse() : (rows || []);
}

/**
 * Group sensor data by day using 1AM snapshots with fallback
 * Prefers 1AM-2AM readings, falls back to daily average if no 1AM data
 */
function groupByDay(rawData) {
  const dailyData1AM = {};
  const dailyDataAll = {};
  
  rawData.forEach(row => {
    if (!row.time) return;
    
    const date = new Date(row.time);
    const hour = date.getHours();
    const dateKey = date.toISOString().split('T')[0];
    
    // Collect 1AM data separately
    if (hour === 1) {
      if (!dailyData1AM[dateKey]) {
        dailyData1AM[dateKey] = {
          date: dateKey,
          temperature: [],
          moisture: [],
          ec: [],
          ph: [],
          nitrogen: [],
          phosphorus: [],
          potassium: [],
          salinity: []
        };
      }
      
      const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      fields.forEach(field => {
        const value = safeValue(row[field]);
        if (value !== null && !isNaN(value)) {
          dailyData1AM[dateKey][field].push(value);
        }
      });
    }
    
    // Collect all data as fallback
    if (!dailyDataAll[dateKey]) {
      dailyDataAll[dateKey] = {
        date: dateKey,
        temperature: [],
        moisture: [],
        ec: [],
        ph: [],
        nitrogen: [],
        phosphorus: [],
        potassium: [],
        salinity: []
      };
    }
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      const value = safeValue(row[field]);
      if (value !== null && !isNaN(value)) {
        dailyDataAll[dateKey][field].push(value);
      }
    });
  });
  
  // Calculate averages: prefer 1AM data, fallback to all-day average
  const allDates = new Set([...Object.keys(dailyData1AM), ...Object.keys(dailyDataAll)]);
  const dailyAverages = Array.from(allDates).map(dateKey => {
    const averages = { date: dateKey };
    
    // Use 1AM data if available, otherwise use all-day data
    const sourceData = (dailyData1AM[dateKey] && Object.keys(dailyData1AM[dateKey]).length > 0) 
      ? dailyData1AM[dateKey] 
      : dailyDataAll[dateKey];
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      if (sourceData && sourceData[field] && sourceData[field].length > 0) {
        const sum = sourceData[field].reduce((acc, val) => acc + val, 0);
        averages[field] = sum / sourceData[field].length;
      } else {
        averages[field] = null;
      }
    });
    
    return averages;
  });
  
  return dailyAverages.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Group sensor data by day AND device using 1AM snapshots with fallback
 * Prefers 1AM readings, falls back to daily average if no 1AM data
 */
function groupByDayAndDevice(rawData) {
  const deviceData1AM = {};
  const deviceDataAll = {};
  
  rawData.forEach(row => {
    if (!row.time) return;
    
    const date = new Date(row.time);
    const hour = date.getHours();
    const device = row.device || 'unknown';
    const dateKey = date.toISOString().split('T')[0];
    
    // Collect 1AM data
    if (hour === 1) {
      if (!deviceData1AM[device]) {
        deviceData1AM[device] = {};
      }
      
      if (!deviceData1AM[device][dateKey]) {
        deviceData1AM[device][dateKey] = {
          date: dateKey,
          device: device,
          temperature: [],
          moisture: [],
          ec: [],
          ph: [],
          nitrogen: [],
          phosphorus: [],
          potassium: [],
          salinity: []
        };
      }
      
      const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      fields.forEach(field => {
        const value = safeValue(row[field]);
        if (value !== null && !isNaN(value)) {
          deviceData1AM[device][dateKey][field].push(value);
        }
      });
    }
    
    // Collect all data as fallback
    
    if (!deviceDataAll[device]) {
      deviceDataAll[device] = {};
    }
    
    if (!deviceDataAll[device][dateKey]) {
      deviceDataAll[device][dateKey] = {
        date: dateKey,
        device: device,
        temperature: [],
        moisture: [],
        ec: [],
        ph: [],
        nitrogen: [],
        phosphorus: [],
        potassium: [],
        salinity: []
      };
    }
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      const value = safeValue(row[field]);
      if (value !== null && !isNaN(value)) {
        deviceDataAll[device][dateKey][field].push(value);
      }
    });
  });
  
  // Calculate daily averages per device: prefer 1AM, fallback to all-day
  const deviceDailyAverages = {};
  const allDevices = new Set([...Object.keys(deviceData1AM), ...Object.keys(deviceDataAll)]);
  
  allDevices.forEach(device => {
    const dates1AM = deviceData1AM[device] || {};
    const datesAll = deviceDataAll[device] || {};
    const allDates = new Set([...Object.keys(dates1AM), ...Object.keys(datesAll)]);
    
    deviceDailyAverages[device] = Array.from(allDates).map(dateKey => {
      // Use 1AM data if available with sufficient readings, otherwise use all-day
      const has1AMData = dates1AM[dateKey] && dates1AM[dateKey].temperature && dates1AM[dateKey].temperature.length > 0;
      const sourceData = has1AMData ? dates1AM[dateKey] : datesAll[dateKey];
      
      if (!sourceData) return null;
      
      const averages = { 
        date: sourceData.date,
        device: sourceData.device
      };
      
      const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      fields.forEach(field => {
        if (sourceData[field] && sourceData[field].length > 0) {
          const sum = sourceData[field].reduce((acc, val) => acc + val, 0);
          averages[field] = sum / sourceData[field].length;
        } else {
          averages[field] = null;
        }
      });
      
      return averages;
    }).filter(a => a !== null).sort((a, b) => a.date.localeCompare(b.date));
  });
  
  return deviceDailyAverages;
}

/**
 * Group daily averages into weekly periods for a single device
 */
function groupByWeekForDevice(dailyAverages, plantingDate) {
  if (dailyAverages.length === 0) return [];
  
  const weeklyData = [];
  const startDate = new Date(plantingDate);
  
  // Group by 7-day periods starting from planting date
  let weekNumber = 1;
  let currentWeekStart = new Date(startDate);
  
  while (true) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // 7 days total (inclusive)
    
    // Filter daily data for this week
    const weekData = dailyAverages.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate >= currentWeekStart && dayDate <= weekEnd;
    });
    
    // If no data exists for this week and we're past available data, stop
    if (weekData.length === 0 && currentWeekStart > new Date(dailyAverages[dailyAverages.length - 1].date)) {
      break;
    }
    
    // Calculate weekly averages
    const weeklyAverages = {
      weekNumber,
      startDate: currentWeekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      dataPoints: weekData.length
    };
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      const values = weekData.map(d => d[field]).filter(v => v !== null);
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        weeklyAverages[field] = sum / values.length;
      } else {
        weeklyAverages[field] = null;
      }
    });
    
    weeklyData.push(weeklyAverages);
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    weekNumber++;
    
    // Stop if we've gone beyond today
    if (currentWeekStart > new Date()) {
      break;
    }
  }
  
  return weeklyData;
}

/**
 * Combine weekly averages from multiple devices into overall weekly averages
 */
function combineDeviceWeeklyAverages(deviceWeeklyData) {
  if (Object.keys(deviceWeeklyData).length === 0) return [];
  
  // Get all unique weeks across all devices using week number and start date
  const allWeeksMap = new Map();
  Object.values(deviceWeeklyData).forEach(weeklyData => {
    weeklyData.forEach(week => {
      const key = `week_${week.weekNumber}_${week.startDate}`;
      if (!allWeeksMap.has(key)) {
        allWeeksMap.set(key, { weekNumber: week.weekNumber, startDate: week.startDate });
      }
    });
  });
  
  const combinedWeekly = [];
  
  // For each unique week, combine data from all devices
  allWeeksMap.forEach(({ weekNumber, startDate }) => {
    // Collect all device data for this week
    const weekDataFromAllDevices = [];
    Object.keys(deviceWeeklyData).forEach(device => {
      const deviceWeek = deviceWeeklyData[device].find(w => 
        w.weekNumber === weekNumber && w.startDate === startDate
      );
      if (deviceWeek) {
        weekDataFromAllDevices.push(deviceWeek);
      }
    });
    
    if (weekDataFromAllDevices.length === 0) return;
    
    // Calculate combined averages across all devices
    const combined = {
      weekNumber: weekNumber,
      startDate: weekDataFromAllDevices[0].startDate,
      endDate: weekDataFromAllDevices[0].endDate,
      dataPoints: weekDataFromAllDevices.reduce((sum, d) => sum + d.dataPoints, 0),
      deviceCount: weekDataFromAllDevices.length
    };
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      const values = weekDataFromAllDevices
        .map(d => d[field])
        .filter(v => v !== null && v !== undefined);
      
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        combined[field] = sum / values.length;
      } else {
        combined[field] = null;
      }
    });
    
    combinedWeekly.push(combined);
  });
  
  return combinedWeekly.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Group daily averages into weekly periods
 */
function groupByWeek(dailyAverages, plantingDate) {
  if (dailyAverages.length === 0) return [];
  
  const weeklyData = [];
  const startDate = new Date(plantingDate);
  
  // Group by 7-day periods starting from planting date
  let weekNumber = 1;
  let currentWeekStart = new Date(startDate);
  
  while (true) {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6); // 7 days total (inclusive)
    
    // Filter daily data for this week
    const weekData = dailyAverages.filter(day => {
      const dayDate = new Date(day.date);
      return dayDate >= currentWeekStart && dayDate <= weekEnd;
    });
    
    // If no data exists for this week and we're past available data, stop
    if (weekData.length === 0 && currentWeekStart > new Date(dailyAverages[dailyAverages.length - 1].date)) {
      break;
    }
    
    // Calculate weekly averages
    const weeklyAverages = {
      weekNumber,
      startDate: currentWeekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      dataPoints: weekData.length
    };
    
    const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
    fields.forEach(field => {
      const values = weekData.map(d => d[field]).filter(v => v !== null);
      if (values.length > 0) {
        const sum = values.reduce((acc, val) => acc + val, 0);
        weeklyAverages[field] = sum / values.length;
      } else {
        weeklyAverages[field] = null;
      }
    });
    
    weeklyData.push(weeklyAverages);
    
    // Move to next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    weekNumber++;
    
    // Stop if we've gone beyond today
    if (currentWeekStart > new Date()) {
      break;
    }
  }
  
  return weeklyData;
}

/**
 * Analyze soil health for a single week
 */
function analyzeWeeklyHealth(weekData) {
  const issues = [];
  let healthyCount = 0;
  let totalChecks = 0;
  
  // Check if week has no data
  if (weekData.dataPoints === 0) {
    return {
      wateringStatus: 'Pending',
      nutrientLevel: 'Pending',
      soilStatus: 'Pending',
      issues: ['No sensor data available for this week'],
      summary: 'Insufficient data to analyze soil health'
    };
  }
  
  // Analyze each parameter
  const params = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
  
  params.forEach(param => {
    const value = weekData[param];
    if (value === null) return; // Skip if no data
    
    totalChecks++;
    const range = HEALTHY_RANGES[param];
    
    if (value < range.min) {
      issues.push({
        parameter: param,
        value: value.toFixed(2),
        expected: `${range.min} - ${range.max} ${range.unit}`,
        issue: HEALTH_ISSUES[param].low
      });
    } else if (value > range.max) {
      issues.push({
        parameter: param,
        value: value.toFixed(2),
        expected: `${range.min} - ${range.max} ${range.unit}`,
        issue: HEALTH_ISSUES[param].high
      });
    } else {
      healthyCount++;
    }
  });
  
  // Determine watering status (based on moisture, temperature, ec)
  let wateringStatus = 'Appropriate';
  const moisture = weekData.moisture;
  const temperature = weekData.temperature;
  
  if (moisture === null || temperature === null) {
    wateringStatus = 'Pending';
  } else if (moisture < 10 || temperature > 35) {
    wateringStatus = 'Needs More Water';
  } else if (moisture > 40) {
    wateringStatus = 'Reduce Watering';
  }
  
  // Determine nutrient level (based on NPK)
  let nutrientLevel = 'Appropriate';
  const n = weekData.nitrogen;
  const p = weekData.phosphorus;
  const k = weekData.potassium;
  
  if (n === null || p === null || k === null) {
    nutrientLevel = 'Pending';
  } else {
    const nLow = n < HEALTHY_RANGES.nitrogen.min;
    const pLow = p < HEALTHY_RANGES.phosphorus.min;
    const kLow = k < HEALTHY_RANGES.potassium.min;
    
    if (nLow || pLow || kLow) {
      nutrientLevel = 'Low - Needs Fertilizer';
    } else if (n > HEALTHY_RANGES.nitrogen.max || p > HEALTHY_RANGES.phosphorus.max || k > HEALTHY_RANGES.potassium.max) {
      nutrientLevel = 'High - Reduce Fertilizer';
    }
  }
  
  // Determine overall soil status
  let soilStatus = 'Healthy';
  if (totalChecks === 0) {
    soilStatus = 'Pending';
  } else if (issues.length > 0) {
    soilStatus = 'Not Healthy';
  }
  
  return {
    wateringStatus,
    nutrientLevel,
    soilStatus,
    issues: issues.map(i => i.issue),
    detailedIssues: issues,
    summary: issues.length === 0 
      ? 'All soil parameters are within healthy ranges' 
      : `${issues.length} parameter(s) need attention`
  };
}

/**
 * Generate weekly soil health summary for a farmer
 * Handles multiple sensor devices by calculating weekly averages per device
 * then combining them into overall weekly averages
 * Optimized: Limits to last 4 weeks for performance
 */
async function generateWeeklySummary(farmerId, sensorDevices, location, plantingDate, harvestDate, limitWeeks = false) {
  try {
    // Calculate date range
    let startDate, endDate;
    
    if (limitWeeks) {
      // Limit to last 4 weeks for faster queries
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      startDate = new Date(Math.max(new Date(plantingDate), fourWeeksAgo)).toISOString();
      endDate = harvestDate 
        ? new Date(Math.min(new Date(harvestDate), new Date())).toISOString()
        : new Date().toISOString();
    } else {
      // Full range (from planting to harvest or today)
      startDate = new Date(plantingDate).toISOString();
      endDate = harvestDate 
        ? new Date(Math.min(new Date(harvestDate), new Date())).toISOString()
        : new Date().toISOString();
    }
    
    // Query sensor data
    const rawData = await querySensorData(sensorDevices, location, startDate, endDate);
    
    if (rawData.length === 0) {
      return {
        success: true,
        farmerId,
        plantingDate,
        harvestDate,
        weeks: [],
        message: 'No sensor data available for the specified period'
      };
    }
    
    let weeklyData;
    
    // Check if we have multiple sensor devices
    if (sensorDevices && Array.isArray(sensorDevices) && sensorDevices.length > 1) {
      // Group by day AND device
      const deviceDailyAverages = groupByDayAndDevice(rawData);
      
      // Calculate weekly averages for each device
      const deviceWeeklyData = {};
      Object.keys(deviceDailyAverages).forEach(device => {
        deviceWeeklyData[device] = groupByWeekForDevice(deviceDailyAverages[device], plantingDate);
      });
      
      // Combine weekly averages from all devices
      weeklyData = combineDeviceWeeklyAverages(deviceWeeklyData);
      console.log(`Combined weekly data: ${weeklyData.length} weeks`);
    } else {
      // Single device - use original logic
      console.log(`Processing single sensor device for farmer ${farmerId}`);
      const dailyAverages = groupByDay(rawData);
      weeklyData = groupByWeek(dailyAverages, plantingDate);
    }
    
    // Analyze each week
    const weeklySummaries = weeklyData.map(week => {
      const analysis = analyzeWeeklyHealth(week);
      
      return {
        week: week.weekNumber,
        period: `${week.startDate} to ${week.endDate}`,
        startDate: week.startDate,
        endDate: week.endDate,
        dataPoints: week.dataPoints,
        deviceCount: week.deviceCount || 1,
        averages: {
          temperature: week.temperature !== null ? week.temperature.toFixed(2) : null,
          moisture: week.moisture !== null ? week.moisture.toFixed(2) : null,
          ec: week.ec !== null ? week.ec.toFixed(2) : null,
          ph: week.ph !== null ? week.ph.toFixed(2) : null,
          nitrogen: week.nitrogen !== null ? week.nitrogen.toFixed(2) : null,
          phosphorus: week.phosphorus !== null ? week.phosphorus.toFixed(2) : null,
          potassium: week.potassium !== null ? week.potassium.toFixed(2) : null,
          salinity: week.salinity !== null ? week.salinity.toFixed(2) : null
        },
        analysis
      };
    });
    
    return {
      success: true,
      farmerId,
      plantingDate,
      harvestDate,
      totalWeeks: weeklySummaries.length,
      sensorDeviceCount: sensorDevices?.length || 0,
      weeks: weeklySummaries
    };
  } catch (error) {
    console.error('Error generating weekly summary:', error);
    throw error;
  }
}

/**
 * Get current soil health status (latest data)
 * If multiple sensors, gets latest from each and averages them
 */
async function getCurrentSoilHealth(sensorDevices, location) {
  try {
    // Check if we have multiple sensor devices
    if (sensorDevices && Array.isArray(sensorDevices) && sensorDevices.length > 1) {
      console.log(`Getting current soil health from ${sensorDevices.length} sensor devices`);
      
      // Get latest reading from each device
      const deviceReadings = await Promise.all(
        sensorDevices.map(async (device) => {
          const where = buildWhere([device], location);
          const sql = `
            SELECT 
              time,
              temperature,
              moisture,
              ec,
              "pH" as ph,
              nitrogen,
              phosphorus,
              potassium,
              salinity,
              device
            FROM "${MEASUREMENT}"
            ${where}
            ORDER BY time DESC
            LIMIT 1
          `;
          
          const rows = await sqlService.query(sql);
          return rows && rows.length > 0 ? rows[0] : null;
        })
      );
      
      // Filter out null readings
      const validReadings = deviceReadings.filter(r => r !== null);
      
      if (validReadings.length === 0) {
        return {
          success: false,
          message: 'No recent sensor data available from any device'
        };
      }
      
      console.log(`Got valid readings from ${validReadings.length} devices`);
      
      // Average the readings across all devices
      const values = {};
      const fields = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      
      fields.forEach(field => {
        const fieldValues = validReadings
          .map(r => safeValue(r[field]))
          .filter(v => v !== null);
        
        if (fieldValues.length > 0) {
          const sum = fieldValues.reduce((acc, val) => acc + val, 0);
          values[field] = sum / fieldValues.length;
        } else {
          values[field] = null;
        }
      });
      
      // Use the most recent timestamp
      const latestTimestamp = validReadings
        .map(r => new Date(r.time))
        .sort((a, b) => b - a)[0];
      
      // Check for issues
      const issues = [];
      const params = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      params.forEach(param => {
        const value = values[param];
        
        if (value !== null) {
          const range = HEALTHY_RANGES[param];
          
          if (value < range.min) {
            issues.push({
              parameter: param,
              value: value.toFixed(2),
              expected: `${range.min} - ${range.max} ${range.unit}`,
              issue: HEALTH_ISSUES[param].low
            });
          } else if (value > range.max) {
            issues.push({
              parameter: param,
              value: value.toFixed(2),
              expected: `${range.min} - ${range.max} ${range.unit}`,
              issue: HEALTH_ISSUES[param].high
            });
          }
        }
      });
      
      const soilStatus = issues.length === 0 ? 'Healthy' : 'Not Healthy';
      
      return {
        success: true,
        timestamp: latestTimestamp,
        values,
        soilStatus,
        deviceCount: validReadings.length,
        issues: issues.map(i => i.issue),
        detailedIssues: issues
      };
      
    } else {
      // Single device - use original logic
      const where = buildWhere(sensorDevices, location);
      const sql = `
        SELECT 
          time,
          temperature,
          moisture,
          ec,
          "pH" as ph,
          nitrogen,
          phosphorus,
          potassium,
          salinity
        FROM "${MEASUREMENT}"
        ${where}
        ORDER BY time DESC
        LIMIT 1
      `;
      
      const rows = await sqlService.query(sql);
      
      if (!rows || rows.length === 0) {
        return {
          success: false,
          message: 'No recent sensor data available'
        };
      }
      
      const latest = rows[0];
      const values = {};
      const issues = [];
      
      // Check each parameter
      const params = ['temperature', 'moisture', 'ec', 'ph', 'nitrogen', 'phosphorus', 'potassium', 'salinity'];
      params.forEach(param => {
        const value = safeValue(latest[param]);
        values[param] = value;
        
        if (value !== null) {
          const range = HEALTHY_RANGES[param];
          
          if (value < range.min) {
            issues.push({
              parameter: param,
              value: value.toFixed(2),
              expected: `${range.min} - ${range.max} ${range.unit}`,
              issue: HEALTH_ISSUES[param].low
            });
          } else if (value > range.max) {
            issues.push({
              parameter: param,
              value: value.toFixed(2),
              expected: `${range.min} - ${range.max} ${range.unit}`,
              issue: HEALTH_ISSUES[param].high
            });
          }
        }
      });
      
      const soilStatus = issues.length === 0 ? 'Healthy' : 'Not Healthy';
      
      return {
        success: true,
        timestamp: latest.time,
        values,
        soilStatus,
        issues: issues.map(i => i.issue),
        detailedIssues: issues
      };
    }
  } catch (error) {
    console.error('Error getting current soil health:', error);
    throw error;
  }
}

/**
 * Calculate variable score (0-10) based on how close the value is to optimal range
 */
function calculateVariableScore(value, optimalRange) {
  if (value === null) return null;
  
  const { min, max } = optimalRange;
  const optimal = (min + max) / 2;
  const tolerance = (max - min) / 2;
  
  // If within optimal range, score 10
  if (value >= min && value <= max) {
    return 10;
  }
  
  // Calculate distance from optimal range
  let distance;
  if (value < min) {
    distance = min - value;
  } else {
    distance = value - max;
  }
  
  // Score decreases linearly based on distance
  // Allow 2x tolerance before score reaches 0
  const maxDistance = tolerance * 2;
  const score = Math.max(0, 10 - (distance / maxDistance) * 10);
  
  return Math.round(score * 10) / 10;
}

/**
 * Calculate Crop Safety Score (1-10) based on soil data and crop type
 */
function calculateCropSafetyScore(soilData, cropType = 'general') {
  // Get crop-specific ranges or fall back to general
  const cropRanges = CROP_RANGES[cropType.toLowerCase()] || CROP_RANGES.general;
  
  const parameters = ['nitrogen', 'phosphorus', 'potassium', 'ph', 'ec', 'moisture', 'temperature', 'salinity'];
  
  let totalWeightedScore = 0;
  let totalWeight = 0;
  let parameterScores = {};
  let problematicVariables = [];
  let suggestions = [];
  
  parameters.forEach(param => {
    const value = soilData[param];
    const config = cropRanges[param];
    
    if (value === null || value === undefined || !config) {
      parameterScores[param] = { score: null, status: 'No data' };
      return;
    }
    
    const score = calculateVariableScore(value, config.optimal);
    const weight = config.weight || 1.0;
    
    if (score !== null) {
      totalWeightedScore += score * weight;
      totalWeight += weight;
      
      parameterScores[param] = {
        value: value.toFixed(2),
        score: score,
        optimal: `${config.optimal.min} - ${config.optimal.max} ${config.unit}`,
        weight: weight,
        status: score >= 7 ? 'Good' : score >= 4 ? 'Fair' : 'Poor'
      };
      
      // Identify problematic variables (score < 7)
      if (score < 7) {
        const issue = {
          parameter: param,
          value: value.toFixed(2),
          score: score,
          optimal: `${config.optimal.min} - ${config.optimal.max} ${config.unit}`,
          impact: score < 4 ? 'Critical' : 'Moderate'
        };
        
        // Add explanatory notes
        if (value < config.optimal.min) {
          issue.note = `${param.charAt(0).toUpperCase() + param.slice(1)} is below optimal range`;
          
          if (param === 'nitrogen') {
            issue.note += ' - may cause weak growth and yellowing leaves';
            suggestions.push('Apply nitrogen-rich fertilizer (urea or ammonium sulfate)');
          } else if (param === 'phosphorus') {
            issue.note += ' - may cause poor root development and delayed flowering';
            suggestions.push('Apply phosphate fertilizer (superphosphate or DAP)');
          } else if (param === 'potassium') {
            issue.note += ' - may cause weak stems and poor disease resistance';
            suggestions.push('Apply potassium fertilizer (potash or KCl)');
          } else if (param === 'ph') {
            issue.note += ' - acidic soil may limit nutrient availability';
            suggestions.push('Apply lime to raise pH');
          } else if (param === 'moisture') {
            issue.note += ' - insufficient water may stress the crop';
            suggestions.push('Increase irrigation frequency');
          } else if (param === 'temperature') {
            issue.note += ' - low temperature may slow root activity';
            suggestions.push('Consider mulching to regulate soil temperature');
          }
        } else if (value > config.optimal.max) {
          issue.note = `${param.charAt(0).toUpperCase() + param.slice(1)} is above optimal range`;
          
          if (param === 'nitrogen') {
            issue.note += ' - may cause soft plants and lodging risk';
            suggestions.push('Reduce nitrogen fertilizer application');
          } else if (param === 'phosphorus') {
            issue.note += ' - may cause nutrient imbalances';
            suggestions.push('Reduce phosphate fertilizer and improve drainage');
          } else if (param === 'potassium') {
            issue.note += ' - may cause salt stress';
            suggestions.push('Reduce potassium application and increase irrigation to leach excess');
          } else if (param === 'ph') {
            issue.note += ' - alkaline soil may limit micronutrient availability';
            suggestions.push('Apply sulfur or organic matter to lower pH');
          } else if (param === 'ec' || param === 'salinity') {
            issue.note += ' - high salinity may prevent water uptake';
            suggestions.push('Improve drainage and leach salts with irrigation');
          } else if (param === 'moisture') {
            issue.note += ' - waterlogged soil may cause root rot';
            suggestions.push('Improve drainage and reduce irrigation');
          } else if (param === 'temperature') {
            issue.note += ' - high temperature may damage roots';
            suggestions.push('Apply mulch and ensure adequate irrigation');
          }
        }
        
        problematicVariables.push(issue);
      }
    }
  });
  
  // Calculate overall safety score (1-10)
  const rawScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  const safetyScore = Math.max(1, Math.min(10, Math.round(rawScore * 10) / 10));
  
  // Determine soil status
  let soilStatus;
  if (safetyScore >= 8) {
    soilStatus = 'Healthy';
  } else if (safetyScore >= 6) {
    soilStatus = 'Fair';
  } else if (safetyScore >= 4) {
    soilStatus = 'Not Healthy';
  } else {
    soilStatus = 'Critical';
  }
  
  // Remove duplicate suggestions
  suggestions = [...new Set(suggestions)];
  
  return {
    cropSafetyScore: safetyScore,
    soilStatus,
    parameterScores,
    problematicVariables,
    suggestions,
    summary: problematicVariables.length === 0 
      ? 'All soil parameters are within optimal range for this crop' 
      : `${problematicVariables.length} parameter(s) need attention`
  };
}

/**
 * Calculate crop safety score for weekly data
 * Uses cache and limits queries for performance
 */
async function calculateWeeklyCropSafety(farmerId, sensorDevices, location, plantingDate, harvestDate, cropType = 'general') {
  try {
    // Generate cache key
    const cacheKey = `${farmerId}_${cropType}_${sensorDevices.join(',')}`;
    
    // Check cache first
    const cached = cropSafetyCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`[Cache HIT] Farmer ${farmerId} crop safety score`);
      return cached.data;
    }
    
    console.log(`[Cache MISS] Calculating crop safety for farmer ${farmerId}`);
    
    // Generate weekly summary with limited date range (last 4 weeks)
    const summary = await generateWeeklySummary(
      farmerId, 
      sensorDevices, 
      location, 
      plantingDate, 
      harvestDate, 
      true // limitWeeks = true for faster queries
    );
    
    if (!summary.success || !summary.weeks || summary.weeks.length === 0) {
      return {
        success: false,
        message: 'No data available for crop safety calculation'
      };
    }
    
    // Calculate safety score for each week
    const weeklySafety = summary.weeks.map(week => {
      // Extract values from averages object (they're strings, need to parse to numbers)
      const soilData = {
        temperature: week.averages?.temperature ? parseFloat(week.averages.temperature) : null,
        moisture: week.averages?.moisture ? parseFloat(week.averages.moisture) : null,
        ec: week.averages?.ec ? parseFloat(week.averages.ec) : null,
        ph: week.averages?.ph ? parseFloat(week.averages.ph) : null,
        nitrogen: week.averages?.nitrogen ? parseFloat(week.averages.nitrogen) : null,
        phosphorus: week.averages?.phosphorus ? parseFloat(week.averages.phosphorus) : null,
        potassium: week.averages?.potassium ? parseFloat(week.averages.potassium) : null,
        salinity: week.averages?.salinity ? parseFloat(week.averages.salinity) : null
      };
      
      const safetyAnalysis = calculateCropSafetyScore(soilData, cropType);
      
      return {
        week: week.weekNumber,
        period: `${week.startDate} to ${week.endDate}`,
        startDate: week.startDate,
        endDate: week.endDate,
        dataPoints: week.dataPoints,
        ...safetyAnalysis
      };
    });
    
    // Calculate average safety score across all weeks
    const validScores = weeklySafety.filter(w => w.cropSafetyScore).map(w => w.cropSafetyScore);
    const averageSafetyScore = validScores.length > 0 
      ? Math.round((validScores.reduce((sum, s) => sum + s, 0) / validScores.length) * 10) / 10
      : null;
    
    const result = {
      success: true,
      farmerId,
      cropType,
      plantingDate,
      harvestDate,
      averageSafetyScore,
      totalWeeks: weeklySafety.length,
      weeks: weeklySafety
    };
    
    // Cache the result
    cropSafetyCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  } catch (error) {
    console.error('Error calculating weekly crop safety:', error);
    throw error;
  }
}

/**
 * Calculate current crop safety score
 */
async function calculateCurrentCropSafety(sensorDevices, location, cropType = 'general') {
  try {
    const health = await getCurrentSoilHealth(sensorDevices, location);
    
    if (!health.success) {
      return {
        success: false,
        message: health.message || 'No data available'
      };
    }
    
    const safetyAnalysis = calculateCropSafetyScore(health.values, cropType);
    
    return {
      success: true,
      timestamp: health.timestamp,
      cropType,
      ...safetyAnalysis
    };
  } catch (error) {
    console.error('Error calculating current crop safety:', error);
    throw error;
  }
}

/**
 * Clear crop safety cache (call this from a scheduled job at 1AM)
 */
function clearCropSafetyCache() {
  const size = cropSafetyCache.size;
  cropSafetyCache.clear();
  console.log(`[Cache] Cleared ${size} cached crop safety scores`);
  return { cleared: size };
}

/**
 * Calculate cultivation history week by week from planting date
 * Returns weekly status for watering (moisture) and soil nutrients (NPK)
 */
async function calculateCultivationHistory(sensorDevices, plantingDate, cropType = 'general', maxWeeks = 8) {
  try {
    if (!sensorDevices || sensorDevices.length === 0) {
      return {
        success: false,
        message: 'No sensor devices assigned'
      };
    }

    const planting = new Date(plantingDate);
    const today = new Date();
    
    // Calculate number of weeks since planting
    const weeksSincePlanting = Math.floor((today - planting) / (7 * 24 * 60 * 60 * 1000)) + 1;
    
    // Limit to maxWeeks most recent weeks to improve performance
    const weeksToCalculate = Math.min(weeksSincePlanting, maxWeeks);
    const startWeek = Math.max(1, weeksSincePlanting - weeksToCalculate + 1);
    
    // Get crop-specific ranges
    const cropRanges = CROP_RANGES[cropType.toLowerCase()] || CROP_RANGES.general;
    
    const cultivationHistory = [];
    
    // For each week since planting (limited to recent weeks for performance)
    for (let week = startWeek; week <= weeksSincePlanting; week++) {
      const weekStart = new Date(planting);
      weekStart.setDate(planting.getDate() + (week - 1) * 7);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      // Don't query future weeks
      if (weekStart > today) {
        break;
      }
      
      // Limit end date to today
      const queryEndDate = weekEnd > today ? today : weekEnd;
      
      // Query sensor data for this week with sampling (limit to 50 readings per week for performance)
      // This provides enough data points for statistical accuracy while keeping queries fast
      const sensorData = await querySensorData(
        sensorDevices,
        null, // location
        weekStart.toISOString(),
        queryEndDate.toISOString(),
        50 // Limit to 50 representative samples per week
      );
      
      let wateringStatus = 'pending';
      let soilNutrientStatus = 'pending';
      
      if (sensorData.length > 0) {
        // Calculate average moisture for the week
        const moistureValues = sensorData
          .map(d => safeValue(d.moisture))
          .filter(v => v !== null);
        
        if (moistureValues.length > 0) {
          const avgMoisture = moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length;
          const moistureRange = cropRanges.moisture.optimal;
          
          // Determine watering status
          if (avgMoisture >= moistureRange.min && avgMoisture <= moistureRange.max) {
            wateringStatus = 'appropriate';
          } else if (avgMoisture < moistureRange.min * 0.7 || avgMoisture > moistureRange.max * 1.3) {
            wateringStatus = 'critical';
          } else {
            wateringStatus = 'warning';
          }
        }
        
        // Calculate average NPK for the week
        const nitrogenValues = sensorData.map(d => safeValue(d.nitrogen)).filter(v => v !== null);
        const phosphorusValues = sensorData.map(d => safeValue(d.phosphorus)).filter(v => v !== null);
        const potassiumValues = sensorData.map(d => safeValue(d.potassium)).filter(v => v !== null);
        
        if (nitrogenValues.length > 0 && phosphorusValues.length > 0 && potassiumValues.length > 0) {
          const avgN = nitrogenValues.reduce((a, b) => a + b, 0) / nitrogenValues.length;
          const avgP = phosphorusValues.reduce((a, b) => a + b, 0) / phosphorusValues.length;
          const avgK = potassiumValues.reduce((a, b) => a + b, 0) / potassiumValues.length;
          
          const nRange = cropRanges.nitrogen.optimal;
          const pRange = cropRanges.phosphorus.optimal;
          const kRange = cropRanges.potassium.optimal;
          
          // Check if all nutrients are in appropriate range
          const nOk = avgN >= nRange.min && avgN <= nRange.max;
          const pOk = avgP >= pRange.min && avgP <= pRange.max;
          const kOk = avgK >= kRange.min && avgK <= kRange.max;
          
          if (nOk && pOk && kOk) {
            soilNutrientStatus = 'appropriate';
          } else {
            // Check if any is critical (very far from range)
            const nCritical = avgN < nRange.min * 0.5 || avgN > nRange.max * 1.5;
            const pCritical = avgP < pRange.min * 0.5 || avgP > pRange.max * 1.5;
            const kCritical = avgK < kRange.min * 0.5 || avgK > kRange.max * 1.5;
            
            if (nCritical || pCritical || kCritical) {
              soilNutrientStatus = 'critical';
            } else {
              soilNutrientStatus = 'warning';
            }
          }
        }
      }
      
      cultivationHistory.push({
        week: week,
        weekStart: weekStart.toISOString().split('T')[0],
        weekEnd: queryEndDate.toISOString().split('T')[0],
        wateringStatus: wateringStatus,
        soilNutrientStatus: soilNutrientStatus,
        hasData: sensorData.length > 0
      });
    }
    
    return {
      success: true,
      cultivationHistory: cultivationHistory,
      totalWeeks: weeksSincePlanting,
      displayedWeeks: cultivationHistory.length,
      hasMore: weeksSincePlanting > maxWeeks
    };
  } catch (error) {
    console.error('Error calculating cultivation history:', error);
    return {
      success: false,
      message: error.message || 'Failed to calculate cultivation history'
    };
  }
}

module.exports = {
  generateWeeklySummary,
  getCurrentSoilHealth,
  calculateCropSafetyScore,
  calculateWeeklyCropSafety,
  calculateCurrentCropSafety,
  calculateCultivationHistory,
  clearCropSafetyCache,
  get1AMSnapshotTimeRange,
  HEALTHY_RANGES,
  HEALTH_ISSUES,
  CROP_RANGES
};
