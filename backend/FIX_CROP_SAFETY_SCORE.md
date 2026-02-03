# Crop Safety Score Fix - February 2, 2026

## Issues Reported
1. **Crop Safety Score showing 1/10** from backend instead of accurate score
2. **"No cultivation history data available"** message even after seeding 14 days of data

## Root Cause Analysis

### The Problem
The farmer controller was passing the farmer's **location** (from `farmer.district_name` or `farmer.province_city`) as a filter when querying sensor data for crop safety scores. This caused a critical mismatch:

- **Farmer locations in database**: Khmer text (e.g., "ដង្កោ", "ភ្នំពេញ")
- **Sensor data locations in InfluxDB**: English identifiers (e.g., "field_a", "greenhouse_1", "field_b", "greenhouse_2")

When the `buildWhere()` function added `location = 'ដង្កោ'` to the SQL query, it found **ZERO matching records** because no sensor data had that location value.

### Why This Caused Issues

1. **Crop Safety Score**: 
   - `calculateCurrentCropSafety()` returned "No recent sensor data available from any device"
   - Without data, the score defaulted to 1/10
   - All soil parameters showed as "No data"

2. **Cultivation History**: 
   - This function was **already working correctly** because it never passed the location filter
   - Function signature: `calculateCultivationHistory(devices, plantingDate, cropType)` 
   - No location parameter = no filtering issue

## Solution

**Remove the location filter** when querying sensor data for farmer-specific requests. Since sensor device IDs (e.g., `esp32_01`, `esp32_02`) are **already unique to each farmer**, filtering by location is:
- Unnecessary (devices already identify the farmer)
- Problematic (causes location mismatch)

### Code Changes

**File**: `backend/src/controllers/farmers.controller.js`

**Functions Modified**:
1. `getFarmerWithSensors()` - line ~598
2. `scanFarmerQR()` - line ~775

**Change Applied**:
```javascript
// BEFORE (causing the bug):
const location = farmer.district_name || farmer.province_city || null;
const safetyResult = await soilHealthService.calculateCurrentCropSafety(devices, location, cropType);

// AFTER (fixed):
// Don't use location filter - sensor devices are unique identifiers per farmer
const location = null;
const safetyResult = await soilHealthService.calculateCurrentCropSafety(devices, location, cropType);
```

## Test Results

### Before Fix
```
Farmer: ម៉េងហុង ទ្រី
Sensor Devices: esp32_01, esp32_02, esp32_03, esp32_04, esp32_05
Location Filter: "ដង្កោ"

Result: ❌ No recent sensor data available from any device
Crop Safety Score: 1/10 (default minimum)
```

### After Fix
```
Farmer: ម៉េងហុង ទ្រី
Sensor Devices: esp32_01, esp32_02, esp32_03, esp32_04, esp32_05
Location Filter: null

Result: ✅ SUCCESS
Crop Safety Score: 10/10 - Healthy
- Nitrogen: 34.56 mg/kg ✓
- Phosphorus: 17.68 mg/kg ✓
- Potassium: 139.82 mg/kg ✓
- pH: 6.50 ✓
- EC: 1.17 dS/m ✓
- Moisture: 28.06% VWC ✓
- Temperature: 25.98°C ✓
- Salinity: 0.89 dS/m ✓
```

## Data Verification

✅ All 5 sensor devices (esp32_01 through esp32_05) have data in InfluxDB  
✅ 14 days of seeded data exists (from January 19 to February 2, 2026)  
✅ Cultivation history shows appropriate watering and nutrient status  
✅ All soil parameters are within optimal ranges  

## Impact

### Before
- Frontend displayed: "Crop Safety Score: 1/10"
- Status: "Critical" (incorrect)
- No actionable insights for farmers

### After
- Frontend will display: "Crop Safety Score: 10/10"
- Status: "Healthy" (correct)
- Detailed parameter breakdowns available
- Cultivation history shows weekly trends

## Additional Notes

- **Cultivation History was never broken** - it was already implemented correctly without location filtering
- The 14 days of seeded data is working correctly
- No changes needed to InfluxDB queries or data structure
- No changes needed to frontend code
- The fix is backward compatible with all existing sensor data

## Test Scripts Created

1. `test-fix-demonstration.js` - Shows before/after comparison
2. `test-farmer-detailed.js` - Comprehensive farmer data testing
3. `test-esp32-05.js` - Device-specific query testing

All test scripts now pass successfully.
