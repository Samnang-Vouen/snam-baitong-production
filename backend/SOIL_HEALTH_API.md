# Soil Health Analysis API Documentation

## Overview

The Soil Health Analysis Engine processes soil sensor data from InfluxDB, analyzes soil health over time, and generates weekly soil health summaries based on crop timelines.

## Features

- ✅ Daily averaging of 8 soil parameters (temperature, moisture, EC, pH, N, P, K, salinity)
- ✅ Weekly aggregation aligned with crop planting dates
- ✅ Automatic health classification (Healthy, Not Healthy, Pending)
- ✅ Watering status recommendations
- ✅ Soil nutrient level analysis
- ✅ Detailed issue identification with explanations
- ✅ Support for multiple sensor devices per farmer
- ✅ Crop timeline awareness (planting to harvest period)

---

## API Endpoints

### 1. Get Health Reference Ranges

Get the soil health reference ranges used for analysis.

**Endpoint:** `GET /api/soil-health/ranges`

**Access:** Public

**Response:**
```json
{
  "success": true,
  "ranges": {
    "nitrogen": { "min": 20, "max": 50, "unit": "mg/kg" },
    "phosphorus": { "min": 10, "max": 30, "unit": "mg/kg" },
    "potassium": { "min": 80, "max": 200, "unit": "mg/kg" },
    "ph": { "min": 6.0, "max": 7.0, "unit": "" },
    "ec": { "min": 0.2, "max": 2.0, "unit": "dS/m" },
    "moisture": { "min": 15, "max": 35, "unit": "% VWC" },
    "temperature": { "min": 18, "max": 30, "unit": "°C" },
    "salinity": { "min": 0.2, "max": 2.0, "unit": "dS/m" }
  },
  "issues": {
    "nitrogen": {
      "low": "Nitrogen too low (< 20 mg/kg) → weak growth, yellowing leaves",
      "high": "Nitrogen too high (> 50 mg/kg) → soft plants, pollution risk"
    }
    // ... other parameters
  }
}
```

---

### 2. Get Farmer Weekly Summary

Get weekly soil health summary for a specific farmer.

**Endpoint:** `GET /api/soil-health/farmer/:farmerId/weekly`

**Access:** Protected (requires authentication)

**Example Request:**
```
GET /api/soil-health/farmer/123/weekly
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "farmerId": "123",
  "plantingDate": "2026-01-28",
  "harvestDate": "2026-04-28",
  "totalWeeks": 5,
  "farmer": {
    "id": 123,
    "name": "John Doe",
    "cropType": "Rice",
    "location": "Village A, District B, Province C",
    "plantingDate": "2026-01-28",
    "harvestDate": "2026-04-28"
  },
  "weeks": [
    {
      "week": 1,
      "period": "2026-01-28 to 2026-02-03",
      "startDate": "2026-01-28",
      "endDate": "2026-02-03",
      "dataPoints": 42,
      "averages": {
        "temperature": "25.30",
        "moisture": "28.50",
        "ec": "1.20",
        "ph": "6.50",
        "nitrogen": "35.00",
        "phosphorus": "18.00",
        "potassium": "120.00",
        "salinity": "1.10"
      },
      "analysis": {
        "wateringStatus": "Appropriate",
        "nutrientLevel": "Appropriate",
        "soilStatus": "Healthy",
        "issues": [],
        "detailedIssues": [],
        "summary": "All soil parameters are within healthy ranges"
      }
    },
    {
      "week": 2,
      "period": "2026-02-04 to 2026-02-10",
      "startDate": "2026-02-04",
      "endDate": "2026-02-10",
      "dataPoints": 0,
      "averages": {
        "temperature": null,
        "moisture": null,
        "ec": null,
        "ph": null,
        "nitrogen": null,
        "phosphorus": null,
        "potassium": null,
        "salinity": null
      },
      "analysis": {
        "wateringStatus": "Pending",
        "nutrientLevel": "Pending",
        "soilStatus": "Pending",
        "issues": ["No sensor data available for this week"],
        "summary": "Insufficient data to analyze soil health"
      }
    },
    {
      "week": 3,
      "period": "2026-02-11 to 2026-02-17",
      "startDate": "2026-02-11",
      "endDate": "2026-02-17",
      "dataPoints": 38,
      "averages": {
        "temperature": "32.00",
        "moisture": "8.50",
        "ec": "2.50",
        "ph": "5.20",
        "nitrogen": "15.00",
        "phosphorus": "8.00",
        "potassium": "65.00",
        "salinity": "2.60"
      },
      "analysis": {
        "wateringStatus": "Needs More Water",
        "nutrientLevel": "Low - Needs Fertilizer",
        "soilStatus": "Not Healthy",
        "issues": [
          "Moisture too low (< 10 %) → drought stress, plant wilting",
          "Temperature too high (> 35 °C) → root damage, reduced nutrient uptake",
          "EC too high (> 2.0 dS/m) → high salinity, roots cannot absorb water properly",
          "pH too low (< 5.5) → acidic soil, nutrients become unavailable",
          "Nitrogen too low (< 20 mg/kg) → weak growth, yellowing leaves",
          "Phosphorus too low (< 10 mg/kg) → poor root growth, delayed flowering",
          "Potassium too low (< 80 mg/kg) → weak stems, poor disease resistance",
          "Salinity too high (> 2.0 dS/m) → salt stress, poor water absorption"
        ],
        "detailedIssues": [
          {
            "parameter": "moisture",
            "value": "8.50",
            "expected": "15 - 35 % VWC",
            "issue": "Moisture too low (< 10 %) → drought stress, plant wilting"
          }
          // ... other issues
        ],
        "summary": "8 parameter(s) need attention"
      }
    }
  ]
}
```

---

### 3. Get Farmer Current Health

Get current (latest) soil health status for a specific farmer.

**Endpoint:** `GET /api/soil-health/farmer/:farmerId/current`

**Access:** Protected (requires authentication)

**Example Request:**
```
GET /api/soil-health/farmer/123/current
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2026-02-02T14:30:00.000Z",
  "farmer": {
    "id": 123,
    "name": "John Doe",
    "cropType": "Rice",
    "location": "Village A, District B, Province C"
  },
  "values": {
    "temperature": 26.5,
    "moisture": 30.2,
    "ec": 1.5,
    "ph": 6.8,
    "nitrogen": 42.0,
    "phosphorus": 22.0,
    "potassium": 150.0,
    "salinity": 1.4
  },
  "soilStatus": "Healthy",
  "issues": [],
  "detailedIssues": []
}
```

**Example Response (Not Healthy):**
```json
{
  "success": true,
  "timestamp": "2026-02-02T14:30:00.000Z",
  "farmer": {
    "id": 123,
    "name": "John Doe",
    "cropType": "Rice",
    "location": "Village A, District B, Province C"
  },
  "values": {
    "temperature": 36.0,
    "moisture": 8.0,
    "ec": 2.5,
    "ph": 5.0,
    "nitrogen": 18.0,
    "phosphorus": 8.0,
    "potassium": 70.0,
    "salinity": 2.8
  },
  "soilStatus": "Not Healthy",
  "issues": [
    "Temperature too high (> 35 °C) → root damage, reduced nutrient uptake",
    "Moisture too low (< 10 %) → drought stress, plant wilting",
    "EC too high (> 2.0 dS/m) → high salinity, roots cannot absorb water properly",
    "pH too low (< 5.5) → acidic soil, nutrients become unavailable",
    "Nitrogen too low (< 20 mg/kg) → weak growth, yellowing leaves",
    "Phosphorus too low (< 10 mg/kg) → poor root growth, delayed flowering",
    "Potassium too low (< 80 mg/kg) → weak stems, poor disease resistance",
    "Salinity too high (> 2.0 dS/m) → salt stress, poor water absorption"
  ],
  "detailedIssues": [
    {
      "parameter": "temperature",
      "value": "36.00",
      "expected": "18 - 30 °C",
      "issue": "Temperature too high (> 35 °C) → root damage, reduced nutrient uptake"
    }
    // ... other issues
  ]
}
```

---

### 4. Get Weekly Summary (by Sensor Devices)

Get weekly soil health summary without farmer context, using sensor devices directly.

**Endpoint:** `POST /api/soil-health/weekly`

**Access:** Protected (requires authentication)

**Request Body:**
```json
{
  "sensorDevices": ["DEVICE_001", "DEVICE_002"],
  "location": "District B",
  "plantingDate": "2026-01-28",
  "harvestDate": "2026-04-28"
}
```

**Response:** Same structure as Farmer Weekly Summary (without farmer details)

---

### 5. Get Current Health (by Sensor Devices)

Get current soil health without farmer context, using sensor devices directly.

**Endpoint:** `POST /api/soil-health/current`

**Access:** Protected (requires authentication)

**Request Body:**
```json
{
  "sensorDevices": ["DEVICE_001", "DEVICE_002"],
  "location": "District B"
}
```

**Response:** Same structure as Farmer Current Health (without farmer details)

---

### 6. Get All Farmers Summary

Get current soil health status for all farmers with sensor devices.

**Endpoint:** `GET /api/soil-health/farmers/summary`

**Access:** Protected (requires authentication)

**Example Request:**
```
GET /api/soil-health/farmers/summary
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "farmers": [
    {
      "farmerId": 123,
      "farmerName": "John Doe",
      "cropType": "Rice",
      "location": "Village A, District B, Province C",
      "plantingDate": "2026-01-28",
      "harvestDate": "2026-04-28",
      "sensorDevices": ["DEVICE_001", "DEVICE_002"],
      "success": true,
      "timestamp": "2026-02-02T14:30:00.000Z",
      "values": {
        "temperature": 26.5,
        "moisture": 30.2,
        "ec": 1.5,
        "ph": 6.8,
        "nitrogen": 42.0,
        "phosphorus": 22.0,
        "potassium": 150.0,
        "salinity": 1.4
      },
      "soilStatus": "Healthy",
      "issues": [],
      "detailedIssues": []
    }
    // ... other farmers
  ]
}
```

---

## Soil Health Classification

### Healthy Ranges (General Crops)

| Parameter | Min | Max | Unit | Notes |
|-----------|-----|-----|------|-------|
| Nitrogen (N) | 20 | 50 | mg/kg | Supports leaf and stem growth |
| Phosphorus (P) | 10 | 30 | mg/kg | Important for root development, flowering, and fruiting |
| Potassium (K) | 80 | 200 | mg/kg | Improves disease resistance and crop quality |
| pH | 6.0 | 7.0 | - | Best range for nutrient availability |
| EC (Salinity) | 0.2 | 2.0 | dS/m | Values above 2.0 may cause salt stress |
| Moisture | 15 | 35 | % VWC | Optimal moisture depends on soil type |
| Temperature | 18 | 30 | °C | Ideal range for root activity |
| Salinity | 0.2 | 2.0 | dS/m | Separate measurement from EC |

### Status Determination

**Watering Status:**
- `Appropriate`: Moisture 15-35%, temperature 18-30°C
- `Needs More Water`: Moisture < 10% or temperature > 35°C
- `Reduce Watering`: Moisture > 40%
- `Pending`: Insufficient data

**Soil Nutrient Level:**
- `Appropriate`: N, P, K all within healthy ranges
- `Low - Needs Fertilizer`: Any of N, P, K below minimum
- `High - Reduce Fertilizer`: Any of N, P, K above maximum
- `Pending`: Insufficient data

**Overall Soil Status:**
- `Healthy`: All parameters within healthy ranges
- `Not Healthy`: One or more parameters outside healthy ranges
- `Pending`: No data available

---

## Data Processing Flow

1. **Query Raw Data**: Fetch sensor data from InfluxDB for the crop period
2. **Daily Aggregation**: Group data by day, calculate daily averages for 8 parameters
3. **Weekly Grouping**: Aggregate daily averages into 7-day periods starting from planting date
4. **Health Analysis**: Compare weekly averages against reference ranges
5. **Issue Identification**: Identify and document all parameters outside healthy ranges
6. **Status Generation**: Determine watering status, nutrient level, and overall soil status

---

## Crop Timeline Awareness

- Week 1 starts on the planting date
- Weekly analysis only covers the period between planting date and harvest date (or today, whichever is earlier)
- Different crops have different growth periods (e.g., rice: 3-4 months, vegetables: 2-3 months)
- Weeks beyond harvest date are not analyzed

---

## Integration Examples

### Frontend Integration

```javascript
// Get farmer weekly summary
async function getFarmerWeeklySummary(farmerId) {
  const response = await fetch(
    `${API_BASE_URL}/api/soil-health/farmer/${farmerId}/weekly`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const data = await response.json();
  return data;
}

// Get current soil health
async function getCurrentSoilHealth(farmerId) {
  const response = await fetch(
    `${API_BASE_URL}/api/soil-health/farmer/${farmerId}/current`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const data = await response.json();
  return data;
}

// Get all farmers summary (for dashboard)
async function getAllFarmersSummary() {
  const response = await fetch(
    `${API_BASE_URL}/api/soil-health/farmers/summary`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );
  const data = await response.json();
  return data;
}
```

### Example Usage

```javascript
// Display weekly summary
const summary = await getFarmerWeeklySummary(123);

summary.weeks.forEach(week => {
  console.log(`Week ${week.week} (${week.period})`);
  console.log(`Watering Status: ${week.analysis.wateringStatus}`);
  console.log(`Nutrient Level: ${week.analysis.nutrientLevel}`);
  console.log(`Soil Status: ${week.analysis.soilStatus}`);
  
  if (week.analysis.issues.length > 0) {
    console.log('Issues:');
    week.analysis.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
  }
});
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error description",
  "message": "Detailed error message"
}
```

Common error codes:
- `400`: Bad request (missing parameters, invalid data)
- `404`: Farmer not found
- `500`: Internal server error

---

## Database Requirements

### Farmers Table

The system requires the following columns in the `farmers` table:

- `id`: Farmer ID (BIGINT)
- `first_name`: Farmer's first name (VARCHAR)
- `last_name`: Farmer's last name (VARCHAR)
- `crop_type`: Type of crop planted (VARCHAR)
- `village_name`: Village name (VARCHAR)
- `district_name`: District name (VARCHAR)
- `province_city`: Province/City name (VARCHAR)
- `planting_date`: Crop planting date (DATE)
- `harvest_date`: Expected harvest date (DATE)
- `sensor_devices`: Comma-separated list of sensor device IDs (TEXT)

### InfluxDB Measurement

The system queries the InfluxDB measurement specified in `INFLUXDB_MEASUREMENT` environment variable (default: `sensor_data`).

Required fields in the measurement:
- `time`: Timestamp
- `temperature`: Soil temperature (°C)
- `moisture`: Soil moisture (% VWC)
- `ec`: Electrical conductivity (dS/m)
- `ph`: Soil pH
- `nitrogen`: Nitrogen content (mg/kg)
- `phosphorus`: Phosphorus content (mg/kg)
- `potassium`: Potassium content (mg/kg)
- `salinity`: Soil salinity (dS/m)
- `device`: Sensor device ID
- `location`: Location identifier (optional)

---

## Testing

### Test Endpoints

```bash
# Get health ranges (public)
curl http://localhost:3000/api/soil-health/ranges

# Get farmer weekly summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmer/123/weekly

# Get farmer current health
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmer/123/current

# Get all farmers summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmers/summary

# Post weekly summary by devices
curl -X POST http://localhost:3000/api/soil-health/weekly \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorDevices": ["DEVICE_001"],
    "plantingDate": "2026-01-28",
    "harvestDate": "2026-04-28"
  }'
```

---

## Performance Considerations

- **Caching**: Consider caching weekly summaries (they don't change frequently)
- **Batch Processing**: For large numbers of farmers, implement pagination
- **Query Optimization**: Weekly summaries query large time ranges; ensure InfluxDB indexes are optimized
- **Background Jobs**: Consider generating summaries in background jobs for better performance

---

## Future Enhancements

1. **Crop-Specific Ranges**: Different healthy ranges for different crop types
2. **Seasonal Adjustments**: Adjust ranges based on seasons
3. **Trend Analysis**: Detect improving or declining trends
4. **Predictive Alerts**: Alert farmers before issues become critical
5. **Recommendations Engine**: Provide specific action recommendations
6. **Multi-Language Support**: Support for local languages
7. **Mobile Push Notifications**: Real-time alerts for critical issues
8. **Historical Comparison**: Compare current season with previous seasons
