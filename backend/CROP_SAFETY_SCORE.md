# Crop Safety Score API Documentation

## Overview

The Crop Safety Score is a comprehensive 1-10 scoring system that evaluates soil conditions based on crop-specific optimal ranges. It provides actionable insights for farmers to maximize crop health and yield.

## What is Crop Safety Score?

The **Crop Safety Score** is a weighted calculation that:
- Compares 8 soil parameters against crop-specific optimal ranges
- Assigns importance weights to each parameter based on crop requirements
- Produces a unified score from 1 (critical/unsafe) to 10 (optimal)
- Identifies problematic variables with detailed explanations
- Provides practical suggestions for improvement

## Scoring System

### Score Ranges

| Score | Status | Meaning |
|-------|--------|---------|
| 8-10 | Healthy | Optimal conditions for crop growth |
| 6-7.9 | Fair | Acceptable but could be improved |
| 4-5.9 | Not Healthy | Multiple issues need attention |
| 1-3.9 | Critical | Severe conditions threatening crop |

### Calculation Method

1. **Individual Variable Scoring** (0-10 per parameter):
   - 10 points: Value within optimal range
   - 0-9 points: Score decreases based on distance from optimal range
   - Null: Parameter not scored (excluded from calculation)

2. **Weighted Scoring**:
   - Each parameter has a crop-specific importance weight (0.9-1.5)
   - Higher weights = more critical for that crop
   - Final score = Sum(Parameter Score × Weight) / Sum(Weights)

3. **Status Determination**:
   - Average score rounded to 1 decimal place
   - Minimum score: 1 (never 0)
   - Maximum score: 10

## Crop-Specific Optimal Ranges

### Rice

Based on FAO guidelines and rice cultivation research:

| Parameter | Optimal Min | Optimal Max | Unit | Weight |
|-----------|-------------|-------------|------|--------|
| Nitrogen | 30 | 50 | mg/kg | 1.2 |
| Phosphorus | 15 | 30 | mg/kg | 1.0 |
| Potassium | 100 | 180 | mg/kg | 1.1 |
| pH | 5.5 | 6.5 | - | 1.3 |
| EC | 0.5 | 2.0 | dS/m | 1.0 |
| Moisture | 25 | 40 | % VWC | 1.5 |
| Temperature | 22 | 32 | °C | 1.2 |
| Salinity | 0.5 | 2.0 | dS/m | 0.9 |

**Key characteristics**:
- High moisture requirement (flooded conditions)
- Tolerates slightly acidic soil (5.5-6.5 pH)
- Moderate nitrogen needs

### Vegetables

General vegetable crop requirements:

| Parameter | Optimal Min | Optimal Max | Unit | Weight |
|-----------|-------------|-------------|------|--------|
| Nitrogen | 25 | 45 | mg/kg | 1.3 |
| Phosphorus | 12 | 28 | mg/kg | 1.2 |
| Potassium | 90 | 200 | mg/kg | 1.2 |
| pH | 6.0 | 7.0 | - | 1.3 |
| EC | 0.3 | 2.0 | dS/m | 1.1 |
| Moisture | 18 | 35 | % VWC | 1.4 |
| Temperature | 18 | 28 | °C | 1.1 |
| Salinity | 0.3 | 1.8 | dS/m | 1.0 |

**Key characteristics**:
- Balanced NPK requirements
- Neutral soil pH preferred
- Good moisture but not waterlogged

### Corn (Maize)

Corn-specific requirements:

| Parameter | Optimal Min | Optimal Max | Unit | Weight |
|-----------|-------------|-------------|------|--------|
| Nitrogen | 35 | 60 | mg/kg | 1.4 |
| Phosphorus | 15 | 35 | mg/kg | 1.2 |
| Potassium | 120 | 220 | mg/kg | 1.3 |
| pH | 6.0 | 7.0 | - | 1.2 |
| EC | 0.4 | 1.8 | dS/m | 1.0 |
| Moisture | 20 | 35 | % VWC | 1.5 |
| Temperature | 20 | 30 | °C | 1.2 |
| Salinity | 0.4 | 1.7 | dS/m | 0.9 |

**Key characteristics**:
- High nitrogen demand
- High potassium requirement
- Sensitive to moisture stress

### Wheat

Wheat cultivation requirements:

| Parameter | Optimal Min | Optimal Max | Unit | Weight |
|-----------|-------------|-------------|------|--------|
| Nitrogen | 30 | 55 | mg/kg | 1.3 |
| Phosphorus | 12 | 30 | mg/kg | 1.1 |
| Potassium | 90 | 190 | mg/kg | 1.1 |
| pH | 6.0 | 7.5 | - | 1.2 |
| EC | 0.3 | 2.2 | dS/m | 1.0 |
| Moisture | 18 | 32 | % VWC | 1.3 |
| Temperature | 15 | 25 | °C | 1.1 |
| Salinity | 0.3 | 2.0 | dS/m | 0.9 |

**Key characteristics**:
- Moderate nitrogen needs
- Tolerates slightly alkaline soil (up to 7.5 pH)
- Lower temperature preference

### General (Default)

Fallback ranges for unspecified crops:

| Parameter | Optimal Min | Optimal Max | Unit | Weight |
|-----------|-------------|-------------|------|--------|
| Nitrogen | 20 | 50 | mg/kg | 1.0 |
| Phosphorus | 10 | 30 | mg/kg | 1.0 |
| Potassium | 80 | 200 | mg/kg | 1.0 |
| pH | 6.0 | 7.0 | - | 1.0 |
| EC | 0.2 | 2.0 | dS/m | 1.0 |
| Moisture | 15 | 35 | % VWC | 1.0 |
| Temperature | 18 | 30 | °C | 1.0 |
| Salinity | 0.2 | 2.0 | dS/m | 1.0 |

## API Endpoints

### 1. Get Available Crop Types

Get list of supported crop types.

**Endpoint**: `GET /api/soil-health/crop-types`

**Access**: Public

**Response**:
```json
{
  "success": true,
  "cropTypes": ["rice", "vegetables", "corn", "wheat", "general"],
  "count": 5
}
```

---

### 2. Get Farmer Crop Safety (Weekly)

Calculate crop safety score for each week of the growing season.

**Endpoint**: `GET /api/soil-health/farmer/:farmerId/crop-safety`

**Access**: Protected (requires authentication)

**Query Parameters**:
- `cropType` (optional): Override farmer's crop type (e.g., `rice`, `vegetables`)

**Example Request**:
```
GET /api/soil-health/farmer/123/crop-safety?cropType=rice
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "success": true,
  "farmerId": "123",
  "cropType": "rice",
  "plantingDate": "2026-01-28",
  "harvestDate": "2026-04-28",
  "averageSafetyScore": 7.8,
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
      "cropSafetyScore": 8.5,
      "soilStatus": "Healthy",
      "parameterScores": {
        "nitrogen": {
          "value": "38.50",
          "score": 10,
          "optimal": "30 - 50 mg/kg",
          "weight": 1.2,
          "status": "Good"
        },
        "phosphorus": {
          "value": "22.00",
          "score": 10,
          "optimal": "15 - 30 mg/kg",
          "weight": 1.0,
          "status": "Good"
        },
        "moisture": {
          "value": "32.00",
          "score": 10,
          "optimal": "25 - 40 % VWC",
          "weight": 1.5,
          "status": "Good"
        }
      },
      "problematicVariables": [],
      "suggestions": [],
      "summary": "All soil parameters are within optimal range for this crop"
    },
    {
      "week": 2,
      "period": "2026-02-04 to 2026-02-10",
      "startDate": "2026-02-04",
      "endDate": "2026-02-10",
      "dataPoints": 38,
      "cropSafetyScore": 5.2,
      "soilStatus": "Not Healthy",
      "parameterScores": {
        "nitrogen": {
          "value": "18.50",
          "score": 4.2,
          "optimal": "30 - 50 mg/kg",
          "weight": 1.2,
          "status": "Fair"
        },
        "moisture": {
          "value": "12.00",
          "score": 3.5,
          "optimal": "25 - 40 % VWC",
          "weight": 1.5,
          "status": "Poor"
        }
      },
      "problematicVariables": [
        {
          "parameter": "nitrogen",
          "value": "18.50",
          "score": 4.2,
          "optimal": "30 - 50 mg/kg",
          "impact": "Moderate",
          "note": "Nitrogen is below optimal range - may cause weak growth and yellowing leaves"
        },
        {
          "parameter": "moisture",
          "value": "12.00",
          "score": 3.5,
          "optimal": "25 - 40 % VWC",
          "impact": "Critical",
          "note": "Moisture is below optimal range - insufficient water may stress the crop"
        }
      ],
      "suggestions": [
        "Apply nitrogen-rich fertilizer (urea or ammonium sulfate)",
        "Increase irrigation frequency"
      ],
      "summary": "2 parameter(s) need attention"
    }
  ]
}
```

---

### 3. Get Farmer Current Safety

Get current (latest) crop safety score.

**Endpoint**: `GET /api/soil-health/farmer/:farmerId/current-safety`

**Access**: Protected

**Query Parameters**:
- `cropType` (optional): Override farmer's crop type

**Example Request**:
```
GET /api/soil-health/farmer/123/current-safety?cropType=rice
Authorization: Bearer YOUR_TOKEN
```

**Response**:
```json
{
  "success": true,
  "timestamp": "2026-02-02T14:30:00.000Z",
  "cropType": "rice",
  "cropSafetyScore": 8.2,
  "soilStatus": "Healthy",
  "farmer": {
    "id": 123,
    "name": "John Doe",
    "cropType": "Rice",
    "location": "Village A, District B, Province C"
  },
  "parameterScores": {
    "nitrogen": {
      "value": "42.00",
      "score": 10,
      "optimal": "30 - 50 mg/kg",
      "weight": 1.2,
      "status": "Good"
    },
    "phosphorus": {
      "value": "20.00",
      "score": 10,
      "optimal": "15 - 30 mg/kg",
      "weight": 1.0,
      "status": "Good"
    }
  },
  "problematicVariables": [],
  "suggestions": [],
  "summary": "All soil parameters are within optimal range for this crop"
}
```

---

### 4. Calculate Crop Safety (by Devices)

Calculate crop safety score using sensor devices directly.

**Endpoint**: `POST /api/soil-health/crop-safety`

**Access**: Protected

**Request Body**:
```json
{
  "sensorDevices": ["DEVICE_001", "DEVICE_002"],
  "location": "District B",
  "plantingDate": "2026-01-28",
  "harvestDate": "2026-04-28",
  "cropType": "rice"
}
```

**Response**: Same structure as Farmer Crop Safety (without farmer details)

---

### 5. Calculate Current Safety (by Devices)

Get current crop safety using sensor devices directly.

**Endpoint**: `POST /api/soil-health/current-safety`

**Access**: Protected

**Request Body**:
```json
{
  "sensorDevices": ["DEVICE_001", "DEVICE_002"],
  "location": "District B",
  "cropType": "rice"
}
```

**Response**: Same structure as Farmer Current Safety (without farmer details)

---

## Parameter Status Levels

Each parameter receives a status based on its individual score:

| Score | Status | Color Code | Meaning |
|-------|--------|------------|---------|
| 7-10 | Good | Green | Within or close to optimal |
| 4-6.9 | Fair | Yellow | Acceptable but needs monitoring |
| 0-3.9 | Poor | Red | Critical issue requiring action |

## Impact Levels

Problematic variables are categorized by impact:

- **Critical** (Score < 4): Immediate action required, crop health at risk
- **Moderate** (Score 4-6.9): Attention needed, may affect yield

## Suggestions System

The system provides crop-specific suggestions based on detected issues:

### Nitrogen Issues
- **Low**: Apply nitrogen-rich fertilizer (urea or ammonium sulfate)
- **High**: Reduce nitrogen fertilizer application

### Phosphorus Issues
- **Low**: Apply phosphate fertilizer (superphosphate or DAP)
- **High**: Reduce phosphate fertilizer and improve drainage

### Potassium Issues
- **Low**: Apply potassium fertilizer (potash or KCl)
- **High**: Reduce potassium application and increase irrigation to leach excess

### pH Issues
- **Low (Acidic)**: Apply lime to raise pH
- **High (Alkaline)**: Apply sulfur or organic matter to lower pH

### Moisture Issues
- **Low**: Increase irrigation frequency
- **High**: Improve drainage and reduce irrigation

### Temperature Issues
- **Low**: Consider mulching to regulate soil temperature
- **High**: Apply mulch and ensure adequate irrigation

### Salinity/EC Issues
- **High**: Improve drainage and leach salts with irrigation

## Scientific Basis

The crop safety scoring system is based on:

1. **FAO Land Evaluation Framework**: International standards for soil suitability
2. **Peer-reviewed Research**: Published studies on crop-specific nutrient requirements
3. **Agronomic Best Practices**: Field-tested recommendations from agricultural extensions
4. **Regional Adaptations**: Tropical and subtropical crop cultivation guidelines

### Key References
- FAO (2007). Land Evaluation: Towards a Revised Framework
- IRRI (2021). Rice Knowledge Bank - Nutrient Management
- USDA-NRCS Soil Quality Indicators
- Various crop-specific cultivation manuals and research papers

## Usage Examples

### Frontend Integration

```javascript
// Get farmer's crop safety score
async function getFarmerCropSafety(farmerId, cropType = null) {
  const url = cropType 
    ? `/api/soil-health/farmer/${farmerId}/crop-safety?cropType=${cropType}`
    : `/api/soil-health/farmer/${farmerId}/crop-safety`;
    
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  return response.json();
}

// Display safety score with color coding
function displaySafetyScore(score) {
  let color, status;
  
  if (score >= 8) {
    color = 'green';
    status = 'Healthy';
  } else if (score >= 6) {
    color = 'yellow';
    status = 'Fair';
  } else if (score >= 4) {
    color = 'orange';
    status = 'Not Healthy';
  } else {
    color = 'red';
    status = 'Critical';
  }
  
  return `<span style="color: ${color}; font-size: 2em;">${score}/10</span>
          <p>${status}</p>`;
}
```

### Dashboard Widget

```jsx
function CropSafetyWidget({ farmerId }) {
  const [safety, setSafety] = useState(null);
  
  useEffect(() => {
    async function load() {
      const data = await getFarmerCropSafety(farmerId);
      setSafety(data);
    }
    load();
  }, [farmerId]);
  
  if (!safety) return <LoadingSpinner />;
  
  return (
    <div className="safety-widget">
      <h3>Crop Safety Score</h3>
      <div className="score-display">
        <span className={`score score-${safety.soilStatus.toLowerCase()}`}>
          {safety.averageSafetyScore}/10
        </span>
        <p>{safety.soilStatus}</p>
      </div>
      
      {safety.problematicVariables?.length > 0 && (
        <div className="issues">
          <h4>Issues Detected:</h4>
          <ul>
            {safety.problematicVariables.map((issue, idx) => (
              <li key={idx} className={`impact-${issue.impact.toLowerCase()}`}>
                <strong>{issue.parameter}</strong>: {issue.note}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {safety.suggestions?.length > 0 && (
        <div className="suggestions">
          <h4>Recommendations:</h4>
          <ul>
            {safety.suggestions.map((suggestion, idx) => (
              <li key={idx}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Testing

```bash
# Get available crop types
curl http://localhost:3000/api/soil-health/crop-types

# Get farmer crop safety score
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/soil-health/farmer/123/crop-safety?cropType=rice"

# Get current safety score
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/soil-health/farmer/123/current-safety

# Calculate by devices
curl -X POST http://localhost:3000/api/soil-health/crop-safety \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sensorDevices": ["DEVICE_001"],
    "plantingDate": "2026-01-28",
    "harvestDate": "2026-04-28",
    "cropType": "rice"
  }'
```

## Performance Considerations

- **Caching**: Crop safety scores can be cached for 1-5 minutes
- **Batch Processing**: Weekly calculations process entire growing season
- **Real-time**: Current safety uses only latest sensor reading (fast)
- **Computation**: Scoring algorithm is O(n) where n = number of parameters (constant, n=8)

## Future Enhancements

- [ ] Machine learning to refine crop-specific ranges based on local conditions
- [ ] Seasonal adjustments for crop ranges
- [ ] Pest and disease risk integration
- [ ] Weather forecast integration
- [ ] Growth stage-specific scoring (germination, vegetative, flowering, etc.)
- [ ] Multi-language support for suggestions
- [ ] Historical comparison and trend analysis
- [ ] Yield prediction based on safety scores

---

**Crop Safety Score System v1.0** - Production Ready 🚀
