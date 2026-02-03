# Farmer Creation & Sensor Management Workflow

## When Admin Creates a New Farmer

### Updated Flow (with new sensor architecture)

#### 1. **Create Farmer API Call**
```javascript
POST /api/farmers
Body: {
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "0123456789",
  "cropType": "Rice",
  "villageName": "Village A",
  "districtName": "District B",
  "provinceCity": "Province C",
  "plantingDate": "2026-01-15",
  "harvestDate": "2026-06-15",
  "gender": "male",
  "sensorDevices": ["esp32_01", "esp32_02"]  // Can be array or comma-separated string
}
```

#### 2. **Backend Processing**
The `createFarmer` function now:

1. **Validates** required fields
2. **Parses sensors** - Accepts both:
   - Array: `["esp32_01", "esp32_02"]`
   - String: `"esp32_01,esp32_02"`
3. **Creates farmer** in database
4. **Assigns sensors** using new sensor system:
   - Validates each sensor exists in `sensors` table
   - Creates entries in `farmer_sensors` junction table
   - Records assignment timestamp
   - Tracks which sensors succeeded/failed
5. **Returns farmer data** with:
   - Full farmer details
   - Assigned sensors list (with metadata)
   - Assignment results

#### 3. **Response**
```json
{
  "success": true,
  "farmer": {
    "id": 5,
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "0123456789",
    "cropType": "Rice",
    "villageName": "Village A",
    "districtName": "District B",
    "provinceCity": "Province C",
    "plantingDate": "2026-01-15",
    "harvestDate": "2026-06-15",
    "qrExpirationDays": 365,
    "sensors": [
      {
        "id": 1,
        "device_id": "esp32_01",
        "sensor_type": "soil",
        "status": "active",
        "assigned_at": "2026-02-02T12:00:00Z"
      },
      {
        "id": 2,
        "device_id": "esp32_02",
        "sensor_type": "soil",
        "status": "active",
        "assigned_at": "2026-02-02T12:00:00Z"
      }
    ],
    "createdAt": "2026-02-02T12:00:00Z",
    "type": "farmer"
  },
  "sensorAssignment": {
    "success": [
      { "deviceId": "esp32_01", "sensor": {...} },
      { "deviceId": "esp32_02", "sensor": {...} }
    ],
    "failed": []
  }
}
```

## Sensor Assignment Options

### Option 1: During Farmer Creation (Recommended)
Include sensors when creating the farmer:
```javascript
POST /api/farmers
Body: {
  ...farmerData,
  "sensorDevices": ["esp32_01", "esp32_02"]
}
```

### Option 2: After Farmer Creation
Create farmer first, then assign sensors separately:

```javascript
// Step 1: Create farmer
POST /api/farmers
Body: { ...farmerData }

// Step 2: Assign sensors
POST /api/farmers/5/sensors/assign
Body: {
  "device_ids": ["esp32_01", "esp32_02"],
  "notes": "Initial sensor setup"
}
```

### Option 3: Assign One Sensor at a Time
```javascript
POST /api/farmers/5/sensors/assign
Body: {
  "device_id": "esp32_01",
  "notes": "Primary sensor"
}
```

## Sensor Management After Creation

### View Assigned Sensors
```javascript
// Get sensor metadata (device list, status, assignment dates)
GET /api/farmers/5/sensors/list

// Get sensor readings (actual data from InfluxDB)
GET /api/farmers/5/sensors
```

### Unassign a Sensor
```javascript
DELETE /api/farmers/5/sensors/1/unassign
```

### Reassign to Different Farmer
```javascript
// 1. Unassign from current farmer
DELETE /api/farmers/5/sensors/1/unassign

// 2. Assign to new farmer
POST /api/farmers/6/sensors/assign
Body: { "device_id": "esp32_01" }
```

### View Assignment History
```javascript
// See all past and current assignments for this farmer
GET /api/farmers/5/sensors/history
```

## What if Sensor Doesn't Exist?

### Scenario: Admin tries to assign non-existent sensor

```javascript
POST /api/farmers
Body: {
  ...farmerData,
  "sensorDevices": ["esp32_99"]  // Doesn't exist
}
```

**Response:**
```json
{
  "success": true,
  "farmer": { ...farmerData },
  "sensorAssignment": {
    "success": [],
    "failed": [
      {
        "deviceId": "esp32_99",
        "error": "Sensor with device_id esp32_99 not found"
      }
    ]
  }
}
```

**Result:** 
- ✅ Farmer is created successfully
- ❌ Sensor assignment fails
- 📝 Admin sees which sensors failed to assign
- 🔧 Admin can fix by:
  1. Creating the sensor first: `POST /api/sensors { "device_id": "esp32_99" }`
  2. Then assigning it: `POST /api/farmers/5/sensors/assign { "device_id": "esp32_99" }`

## Admin Workflow Example

### Complete Workflow: Setting up a new farmer with sensors

```javascript
// 1. Check available sensors
GET /api/sensors?status=active&assigned=false
// Response: Shows esp32_05, esp32_06 are available

// 2. Create farmer with sensors
POST /api/farmers
Body: {
  "firstName": "Jane",
  "lastName": "Smith",
  "phoneNumber": "0987654321",
  "cropType": "Vegetables",
  "villageName": "Village X",
  "districtName": "District Y",
  "provinceCity": "Province Z",
  "plantingDate": "2026-02-01",
  "harvestDate": "2026-07-01",
  "sensorDevices": ["esp32_05", "esp32_06"]
}
// Farmer created with sensors automatically assigned

// 3. Verify sensor data is coming in
GET /api/farmers/6/sensors
// Shows real-time sensor readings from InfluxDB

// 4. View dashboard with new farmer's data
GET /api/soil-health/farmer/6/current
// Shows current soil health from assigned sensors
```

## Benefits of New System

### For Admins:
1. **See available sensors** before assigning
2. **Track sensor history** - know where each sensor has been
3. **Get clear error messages** when assignment fails
4. **Monitor sensor status** - see if sensors are online/offline
5. **Bulk operations** - assign multiple sensors at once

### For the System:
1. **Data integrity** - Can't assign sensors that don't exist
2. **Audit trail** - Know when sensors were assigned/unassigned
3. **Better queries** - No more string parsing
4. **Sensor reuse** - Easy to move sensors between farmers
5. **Status tracking** - Mark sensors as maintenance/broken

## Backward Compatibility

The `sensor_devices` field is still stored in the farmers table for backward compatibility:
- ✅ Old frontend code continues to work
- ✅ Gradual migration possible
- ✅ Both systems work in parallel
- 📝 Can be removed after full transition

## Migration Path for Existing Farmers

Existing farmers with sensors in the old `sensor_devices` field:
- ✅ Already migrated during initial migration
- ✅ Sensors automatically created in `sensors` table
- ✅ Relationships created in `farmer_sensors` table
- ✅ No manual work needed

## Frontend Integration

### Creating a Farmer (React Example)
```javascript
const createFarmer = async (farmerData) => {
  // Admin selects sensors from dropdown
  const selectedSensors = ["esp32_01", "esp32_02"];
  
  const response = await fetch('/api/farmers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...farmerData,
      sensorDevices: selectedSensors
    })
  });
  
  const result = await response.json();
  
  if (result.sensorAssignment.failed.length > 0) {
    alert(`Warning: ${result.sensorAssignment.failed.length} sensors failed to assign`);
  }
  
  return result.farmer;
};
```

### Sensor Selector Component
```javascript
// Get available sensors for dropdown
const AvailableSensors = () => {
  const [sensors, setSensors] = useState([]);
  
  useEffect(() => {
    fetch('/api/sensors?status=active&assigned=false')
      .then(res => res.json())
      .then(data => setSensors(data.data));
  }, []);
  
  return (
    <select multiple>
      {sensors.map(sensor => (
        <option key={sensor.id} value={sensor.device_id}>
          {sensor.device_id} - {sensor.location_tag || 'No location'}
        </option>
      ))}
    </select>
  );
};
```

---

**Summary**: When an admin creates a new farmer, they can assign sensors immediately during creation, or manage sensors separately afterward. The system validates sensor existence, tracks assignments, and provides clear feedback on success/failure.
