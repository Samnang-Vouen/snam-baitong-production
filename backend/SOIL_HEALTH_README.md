# 🌱 Soil Health Analysis Engine

A comprehensive backend system for analyzing soil sensor data, generating weekly health summaries, and providing actionable insights for farmers.

## 📋 Overview

The Soil Health Analysis Engine processes soil sensor data from InfluxDB and provides:

- **Daily Aggregation**: Calculates daily averages for 8 soil parameters
- **Weekly Summaries**: Groups data into 7-day periods aligned with crop planting dates
- **Health Classification**: Determines if soil is Healthy, Not Healthy, or Pending
- **Smart Recommendations**: Provides watering and fertilizer recommendations
- **Issue Detection**: Identifies specific problems with detailed explanations

## 🎯 Key Features

### ✅ Multi-Parameter Analysis
Analyzes 8 critical soil parameters:
- Temperature (°C)
- Moisture (% VWC)
- Electrical Conductivity - EC (dS/m)
- pH Level
- Nitrogen - N (mg/kg)
- Phosphorus - P (mg/kg)
- Potassium - K (mg/kg)
- Salinity (dS/m)

### ✅ Intelligent Classification
- **Watering Status**: Appropriate, Needs More Water, Reduce Watering, Pending
- **Nutrient Level**: Appropriate, Low - Needs Fertilizer, High - Reduce Fertilizer, Pending
- **Overall Soil Status**: Healthy, Not Healthy, Pending

### ✅ Crop Timeline Awareness
- Week 1 starts from planting date
- Analysis only covers planting → harvest period
- Respects different crop growth durations

### ✅ Multi-Device Support
- Supports multiple sensor devices per farmer
- Aggregates data from all assigned devices
- Filters by location when needed

## 📁 Project Structure

```
backend/
├── src/
│   ├── services/
│   │   └── soilHealth.service.js      # Core analysis logic
│   ├── controllers/
│   │   └── soilHealth.controller.js   # API endpoints
│   └── routes/
│       └── soilHealth.routes.js       # Route definitions
├── example-soil-health.js             # Usage examples
└── SOIL_HEALTH_API.md                 # Complete API documentation
```

## 🚀 Quick Start

### 1. Installation

The soil health engine is already integrated into your backend. No additional installation needed.

### 2. Configuration

Ensure your `.env` file has the required InfluxDB configuration:

```env
INFLUXDB_URL=your_influxdb_url
INFLUXDB_TOKEN=your_token
INFLUXDB_BUCKET=your_bucket
INFLUXDB_MEASUREMENT=sensor_data
```

### 3. Run Examples

```bash
cd backend
node example-soil-health.js
```

This will show:
- Reference health ranges
- Sample healthy vs unhealthy soil analysis

### 4. Test API Endpoints

Start your backend server:
```bash
npm run dev
```

Test the endpoints:
```bash
# Get health ranges (public endpoint)
curl http://localhost:3000/api/soil-health/ranges

# Get farmer weekly summary (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmer/123/weekly

# Get current soil health for farmer
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmer/123/current

# Get all farmers summary
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/soil-health/farmers/summary
```

## 📊 Soil Health Reference Ranges

### Healthy Ranges (General Crops)

| Parameter | Minimum | Maximum | Unit | Purpose |
|-----------|---------|---------|------|---------|
| Nitrogen (N) | 20 | 50 | mg/kg | Leaf & stem growth |
| Phosphorus (P) | 10 | 30 | mg/kg | Root development, flowering |
| Potassium (K) | 80 | 200 | mg/kg | Disease resistance, quality |
| pH | 6.0 | 7.0 | - | Nutrient availability |
| EC | 0.2 | 2.0 | dS/m | Salinity level |
| Moisture | 15 | 35 | % VWC | Water content |
| Temperature | 18 | 30 | °C | Root activity |
| Salinity | 0.2 | 2.0 | dS/m | Salt content |

## 🔍 How It Works

### 1. Data Collection
```
InfluxDB → Query raw sensor data → Filter by device/location/date range
```

### 2. Daily Aggregation
```
Raw data → Group by day → Calculate daily averages → Store in memory
```

### 3. Weekly Grouping
```
Daily averages → Group into 7-day periods → Align with planting date
```

### 4. Health Analysis
```
Weekly averages → Compare with healthy ranges → Identify issues
```

### 5. Status Determination
```
Issues → Calculate watering status, nutrient level → Overall soil status
```

## 📖 API Documentation

Complete API documentation is available in [SOIL_HEALTH_API.md](./SOIL_HEALTH_API.md)

### Quick Reference

**Farmer-Based Endpoints:**
- `GET /api/soil-health/farmer/:farmerId/weekly` - Weekly summary
- `GET /api/soil-health/farmer/:farmerId/current` - Current status

**Device-Based Endpoints:**
- `POST /api/soil-health/weekly` - Weekly summary by devices
- `POST /api/soil-health/current` - Current status by devices

**Utility Endpoints:**
- `GET /api/soil-health/ranges` - Health reference ranges
- `GET /api/soil-health/farmers/summary` - All farmers summary

## 💡 Example Usage

### Frontend Integration

```javascript
// Fetch weekly summary for a farmer
async function getWeeklySummary(farmerId) {
  const response = await fetch(
    `/api/soil-health/farmer/${farmerId}/weekly`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  
  // Display weekly summaries
  data.weeks.forEach(week => {
    console.log(`Week ${week.week}:`);
    console.log(`  Status: ${week.analysis.soilStatus}`);
    console.log(`  Watering: ${week.analysis.wateringStatus}`);
    console.log(`  Nutrients: ${week.analysis.nutrientLevel}`);
    
    if (week.analysis.issues.length > 0) {
      console.log('  Issues:');
      week.analysis.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }
  });
}

// Fetch current soil health
async function getCurrentHealth(farmerId) {
  const response = await fetch(
    `/api/soil-health/farmer/${farmerId}/current`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  const data = await response.json();
  
  console.log(`Soil Status: ${data.soilStatus}`);
  console.log('Current Values:', data.values);
  
  if (data.issues.length > 0) {
    console.log('Issues:', data.issues);
  }
}
```

## 🎯 Example Output

### Healthy Week
```
Week 1 (2026-01-28 to 2026-02-03)
  Watering Status: Appropriate
  Soil Nutrient Level: Appropriate
  Soil Status: Healthy
  Summary: All soil parameters are within healthy ranges
```

### Unhealthy Week
```
Week 3 (2026-02-11 to 2026-02-17)
  Watering Status: Needs More Water
  Soil Nutrient Level: Low - Needs Fertilizer
  Soil Status: Not Healthy
  Issues:
    - Moisture too low (< 10 %) → drought stress, plant wilting
    - Temperature too high (> 35 °C) → root damage
    - Nitrogen too low (< 20 mg/kg) → weak growth, yellowing leaves
    - Phosphorus too low (< 10 mg/kg) → poor root growth
    - Potassium too low (< 80 mg/kg) → weak stems
  Summary: 5 parameter(s) need attention
```

### No Data Week
```
Week 2 (2026-02-04 to 2026-02-10)
  Watering Status: Pending
  Soil Nutrient Level: Pending
  Soil Status: Pending
  Summary: Insufficient data to analyze soil health
```

## 🛠️ Technical Details

### Service Layer (`soilHealth.service.js`)
- `generateWeeklySummary()` - Main analysis function
- `getCurrentSoilHealth()` - Latest status check
- `querySensorData()` - InfluxDB data fetching
- `groupByDay()` - Daily aggregation logic
- `groupByWeek()` - Weekly grouping logic
- `analyzeWeeklyHealth()` - Health classification

### Controller Layer (`soilHealth.controller.js`)
- `getFarmerWeeklySummary()` - Farmer weekly endpoint
- `getFarmerCurrentHealth()` - Farmer current endpoint
- `getWeeklySummary()` - Device-based weekly
- `getCurrentHealth()` - Device-based current
- `getAllFarmersSummary()` - All farmers dashboard
- `getHealthRanges()` - Reference ranges

### Routes Layer (`soilHealth.routes.js`)
- Defines all API endpoints
- Applies authentication middleware
- Maps routes to controller functions

## 🔐 Security

All endpoints (except `/ranges`) require authentication:
```javascript
router.get('/farmer/:farmerId/weekly', 
  authenticateToken,  // ← Auth middleware
  soilHealthController.getFarmerWeeklySummary
);
```

## 🧪 Testing

### Unit Testing
```bash
# Run example script
node example-soil-health.js
```

### Integration Testing
```bash
# Test with real data (uncomment in example file)
# Requires InfluxDB connection
node example-soil-health.js
```

### API Testing
Use the provided curl commands in the Quick Start section, or use tools like:
- Postman
- Thunder Client (VS Code)
- REST Client (VS Code)

## 📈 Performance Considerations

### Optimization Tips
1. **Caching**: Cache weekly summaries (they change infrequently)
2. **Pagination**: For `/farmers/summary`, implement pagination for large datasets
3. **Background Jobs**: Generate summaries asynchronously
4. **Database Indexes**: Ensure InfluxDB has proper time-based indexes

### Query Performance
- Weekly summaries query data for entire crop period (2-4 months)
- Current health queries only latest row (very fast)
- Multiple device filtering uses `IN` clause for efficiency

## 🔮 Future Enhancements

### Planned Features
- [ ] Crop-specific health ranges (rice, vegetables, etc.)
- [ ] Seasonal adjustments for different climates
- [ ] Trend analysis (improving/declining over time)
- [ ] Predictive alerts (warn before critical issues)
- [ ] AI-powered recommendations
- [ ] Multi-language support
- [ ] Mobile push notifications
- [ ] Historical season comparison
- [ ] Weather integration
- [ ] Soil type classification

### Possible Extensions
- Export reports to PDF
- Email/SMS alerts for critical issues
- Integration with irrigation systems
- Machine learning for optimal ranges
- GraphQL API support

## 🤝 Contributing

To extend the soil health system:

1. **Add New Parameters**: Edit `HEALTHY_RANGES` in `soilHealth.service.js`
2. **Custom Ranges**: Create crop-specific range sets
3. **New Endpoints**: Add controllers in `soilHealth.controller.js`
4. **Custom Analysis**: Extend `analyzeWeeklyHealth()` function

## 📝 License

This soil health analysis engine is part of the SNAM Baitong project.

## 🙋 Support

For questions or issues:
1. Check [SOIL_HEALTH_API.md](./SOIL_HEALTH_API.md) for API details
2. Review `example-soil-health.js` for usage examples
3. Examine the service code for implementation details

## 🎉 Summary

The Soil Health Analysis Engine provides:
- ✅ Comprehensive soil analysis (8 parameters)
- ✅ Weekly summaries aligned with crop timeline
- ✅ Clear health classification (Healthy/Not Healthy/Pending)
- ✅ Actionable recommendations (watering, fertilizer)
- ✅ Detailed issue identification with explanations
- ✅ RESTful API with authentication
- ✅ Support for multiple sensors per farmer
- ✅ Real-time current status checks
- ✅ Batch analysis for all farmers

**Ready to use! Start the backend and test the endpoints.**
