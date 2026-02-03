# Multi-Sensor Device Implementation

## Overview

Enhanced the soil health service to properly handle multiple sensor devices per farmer by calculating weekly averages for each device separately and then combining them into overall weekly averages.

## Implementation Details

### Key Changes

#### 1. New Function: `groupByDayAndDevice(rawData)`
- Groups sensor data by both date AND device
- Calculates daily averages for each sensor device separately
- Returns: `{ deviceId: [dailyAverages...], ... }`

#### 2. New Function: `groupByWeekForDevice(dailyAverages, plantingDate)`
- Groups daily averages into weekly periods for a single device
- Uses 7-day periods starting from planting date
- Returns: Array of weekly averages for one device

#### 3. New Function: `combineDeviceWeeklyAverages(deviceWeeklyData)`
- Combines weekly averages from multiple devices
- For each week:
  1. Collects data from all devices for that week
  2. Averages the values across all devices
  3. Includes device count in the result
- Returns: Combined weekly averages across all devices

#### 4. Updated Function: `generateWeeklySummary()`
**Logic Flow:**
```
IF multiple sensor devices (length > 1):
  1. Group raw data by day AND device → deviceDailyAverages
  2. For each device:
     - Calculate weekly averages → deviceWeeklyData
  3. Combine weekly averages from all devices → weeklyData
ELSE (single device):
  1. Group by day (all data together) → dailyAverages
  2. Calculate weekly averages → weeklyData
```

**Added Fields:**
- `deviceCount`: Number of devices contributing to each week's data
- `sensorDeviceCount`: Total number of sensor devices for the farmer

#### 5. Updated Function: `getCurrentSoilHealth()`
**Logic Flow:**
```
IF multiple sensor devices:
  1. Query latest reading from EACH device (parallel)
  2. Filter out null readings
  3. Average readings across all devices
  4. Use most recent timestamp
ELSE (single device):
  1. Query latest reading
  2. Return as-is
```

**Added Fields:**
- `deviceCount`: Number of devices providing current data

## Example Scenarios

### Scenario 1: Farmer with 3 Sensor Devices

**Input:**
- farmerId: 1
- sensorDevices: ["DEVICE001", "DEVICE002", "DEVICE003"]
- plantingDate: "2026-01-01"

**Processing:**
1. Fetch all data from InfluxDB for all 3 devices
2. Group by day for each device:
   - DEVICE001: 30 days of daily averages
   - DEVICE002: 28 days of daily averages (some missing days)
   - DEVICE003: 30 days of daily averages
3. Calculate weekly averages for each device:
   - DEVICE001: 5 weeks
   - DEVICE002: 4 weeks (missing week 2)
   - DEVICE003: 5 weeks
4. Combine weekly averages:
   - Week 1: Average of 3 devices
   - Week 2: Average of 2 devices (DEVICE002 has no data)
   - Week 3: Average of 3 devices
   - Week 4: Average of 3 devices
   - Week 5: Average of 3 devices

**Result:**
```json
{
  "success": true,
  "farmerId": 1,
  "sensorDeviceCount": 3,
  "totalWeeks": 5,
  "weeks": [
    {
      "week": 1,
      "deviceCount": 3,
      "averages": {
        "temperature": "25.30",
        "moisture": "28.50",
        ...
      }
    },
    {
      "week": 2,
      "deviceCount": 2,
      "averages": { ... }
    }
    ...
  ]
}
```

### Scenario 2: Single Sensor Device

**Input:**
- sensorDevices: ["DEVICE001"]

**Processing:**
- Uses original optimized logic
- No extra device grouping overhead

## Benefits

1. **Accurate Representation**: Multiple sensors provide more reliable data by averaging across farm locations
2. **Handles Missing Data**: If one sensor fails, others continue providing data
3. **Transparency**: `deviceCount` shows how many devices contributed to each week
4. **Backward Compatible**: Single device farmers use the original, efficient logic
5. **Scalable**: Can handle any number of sensor devices

## Crop Safety Score Integration

The crop safety score calculation automatically benefits from this implementation:
- Uses `getCurrentSoilHealth()` which now properly averages multiple devices
- More accurate safety scores when multiple sensors are deployed
- Reduces impact of individual sensor anomalies

## API Endpoints Affected

All endpoints using these services now support multiple devices:

- `GET /api/soil-health/farmer/:farmerId/weekly`
- `GET /api/soil-health/farmer/:farmerId/current`
- `GET /api/soil-health/farmer/:farmerId/current-safety`
- `GET /api/farmers/scan/:token` (via cropSafetyScore)
- `GET /api/farmers/public/:id` (via cropSafetyScore)

## Testing Recommendations

1. **Single Device Test**: Verify backward compatibility
2. **Multiple Devices Test**: Create farmer with 2-3 devices
3. **Missing Data Test**: Simulate device failure for one sensor
4. **Performance Test**: Test with 5+ devices to ensure efficiency

## Performance Considerations

- Parallel queries for current health (Promise.all)
- Console logging added for debugging (can be removed in production)
- Efficient grouping algorithms with single pass through data
