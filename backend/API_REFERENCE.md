# SNAM Baitong Backend API Reference

Updated: 2026-02-03

This document summarizes the REST APIs exposed by the backend service. It groups endpoints by resource, describes authentication and roles, and provides request/response shapes and status codes inferred from the source.

See route mounts in [backend/src/app.js](src/app.js#L27-L55) and individual route files under [backend/src/routes/](src/routes).

## Overview

- Base URL: All APIs are served under your server origin, with base paths like `/api/...` and `/health`.
- Content type: JSON for request/response unless stated; file uploads use `multipart/form-data`.
- Timestamps: ISO 8601 strings unless otherwise noted.
- Success envelope: `{ success: true, ... }`
- Error envelope: `{ success: false, error: string, message?: string, code?: string }`

## Authentication

- Scheme: JWT (HS256) with both of the following accepted on protected routes:
  - Cookie: HTTP-only cookie named `token` set by login
  - Header: `Authorization: Bearer <token>`
- Roles: `admin`, `ministry` (see [backend/src/services/user.service.js](src/services/user.service.js#L5-L11))
- Middleware:
  - Auth: [backend/src/middlewares/auth.middleware.js](src/middlewares/auth.middleware.js)
  - Role guard: [backend/src/middlewares/authorize.js](src/middlewares/authorize.js)
- Token blacklist: JWT `jti` is blacklisted on logout; blacklisted or expired tokens return 401.

Example login and authenticated request:

```bash
curl -i -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"secret"}'

# Either use the httpOnly cookie set by the response, or capture the token from body:
TOKEN="<copy token from login response>"
curl -s "$BASE/api/users" -H "Authorization: Bearer $TOKEN"
```

Common status codes:

- 200 OK, 201 Created
- 400 Bad Request (validation)
- 401 Unauthorized (missing/invalid token)
- 403 Forbidden (role not permitted)
- 404 Not Found
- 409 Conflict (duplicates)
- 410 Gone (expired QR)
- 500 Internal Server Error (see [backend/src/middlewares/errorHandler.js](src/middlewares/errorHandler.js))

## Auth

- POST `/api/auth/login`
  - Body: `{ email: string, password: string }`
  - Sets httpOnly cookie `token`. Response: `{ success, user: { id,email,role,mustChangePassword }, token }`
  - Errors: 400 (missing fields), 401 (invalid credentials)

- POST `/api/auth/logout`
  - No auth required; blacklists current cookie token if present and clears cookie.
  - Response: `{ success: true }`

- GET `/api/auth/me` (auth)
  - Response: `{ success, user: { id,email,role,mustChangePassword } }`
  - Errors: 404 (user not found)

- PUT `/api/auth/me/password` (auth)
  - Body: `{ currentPassword: string, newPassword: string(min 6) }`
  - Response: `{ success: true, message: 'Password updated successfully' }`
  - Errors: 400, 401 (current password incorrect), 404

## Users (admin only)

Mounted at `/api/users` via [backend/src/routes/users.routes.js](src/routes/users.routes.js)

- GET `/api/users` (admin)
  - Response: `{ success, users: Array<{ id,email,role,is_active,must_change_password,created_at,updated_at }> }`

- POST `/api/users` (admin)
  - Body: `{ email: string, role: 'admin'|'ministry', password?: string }`
  - Response: `{ success, user: { id,email,role,must_change_password }, temporaryPassword }`
  - Errors: 400 (validation), 409 (email exists)

- PUT `/api/users/:id` (admin)
  - Body: subset of `{ email, password, role, is_active, must_change_password }`
  - Response: `{ success, user }`
  - Errors: 400 (no valid fields)

- DELETE `/api/users/:id` (admin)
  - Response: `{ success: true }`

## Farmers

Mounted at `/api/farmers` via [backend/src/routes/farmers.routes.js](src/routes/farmers.routes.js)

Public endpoints:

- GET `/api/farmers/scan/:token`
  - Returns farmer profile + latest sensor snapshot and scores for valid, unexpired tokens.
  - Errors: 404 (invalid/revoked), 410 (expired)

- GET `/api/farmers/public/:id`
  - Returns a public farmer profile without auth.

Protected endpoints (auth required):

- GET `/api/farmers`
  - Response: `{ success, data: Farmer[] }`

- GET `/api/farmers/:id`
  - Response: `{ success, data: FarmerWithSensorsAndScores }`

- POST `/api/farmers` (admin)
  - Body: `{ firstName,lastName,gender?,phoneNumber,profileImageUrl?,cropType,villageName,districtName,provinceCity,plantingDate(YYYY-MM-DD),harvestDate(YYYY-MM-DD),qrExpirationDays?,sensorDevices?: string[]|comma-separated }`
  - Auto-assigns provided sensors; returns `{ success, farmer, sensorAssignment }`

- PUT `/api/farmers/:id` (admin or ministry)
  - Partial updates supported. Also supports `ministryFeedback` (<= 600 chars) and timestamps its updates.

- DELETE `/api/farmers/:id` (admin)

- POST `/api/farmers/:id/qr`
  - Returns a QR link for farmer profile or a time-limited token URL depending on config.

- POST `/api/farmers/:id/mark-viewed` (admin)
  - Marks ministry feedback as viewed.

- Sensor-related for a farmer:
  - GET `/api/farmers/:id/sensors` — Latest or time-filtered Influx rows with optional `timeFilter` (`24h|2d|7d`) and `device` query. Optional `includeScore=true` and `includeHistory=true` for computed fields.
  - GET `/api/farmers/:id/sensors/dashboard` — Aggregated/sampled data for charts.
  - GET `/api/farmers/:id/sensors/download?device=...` — CSV download of all historical rows for device.
  - GET `/api/farmers/:farmerId/sensors/list` — Assigned sensors (metadata from relational tables).
  - GET `/api/farmers/:farmerId/sensors/history` — Assignment history.
  - POST `/api/farmers/:farmerId/sensors/assign` (admin) — Body supports `{ device_id }` or `{ device_ids: string[], notes? }`.
  - DELETE `/api/farmers/:farmerId/sensors/:sensorId/unassign` (admin)

Farmer DTO (representative):

```json
{
  "id": 1,
  "firstName": "...",
  "lastName": "...",
  "gender": "male|female|null",
  "phoneNumber": "...",
  "profileImageUrl": "https://...",
  "cropType": "rice",
  "villageName": "...",
  "districtName": "...",
  "provinceCity": "...",
  "plantingDate": "2026-01-01",
  "harvestDate": "2026-04-01",
  "qrExpirationDays": 365,
  "ministryFeedback": "...",
  "createdAt": "2026-02-01T12:34:56.000Z",
  "type": "farmer"
}
```

## Sensors

Mounted at `/api/sensors` via [backend/src/routes/sensors.routes.js](src/routes/sensors.routes.js)

Legacy data endpoints (Influx SQL):

- GET `/api/sensors/latest` (admin|ministry)
- GET `/api/sensors/devices` (admin)

Sensor inventory and assignment:

- GET `/api/sensors` (admin|ministry)
  - Query: `status?`, `sensor_type?`, `assigned?=true|false`

- POST `/api/sensors` (admin)
  - Body: `{ device_id: string, sensor_type?: 'soil'|..., model?, status?, installation_date?, location_tag?, physical_location?, notes? }`

- GET `/api/sensors/:id` (admin|ministry)
- PUT `/api/sensors/:id` (admin)
- DELETE `/api/sensors/:id` (admin)
- GET `/api/sensors/:id/farmers` (admin|ministry)
- GET `/api/sensors/:id/history` (admin|ministry)
- GET `/api/sensors/offline?hours=1` (admin) — Sensors with last reading older than threshold hours.

## Plants

Mounted at `/api/plants` via [backend/src/routes/plants.routes.js](src/routes/plants.routes.js)

- POST `/api/plants` (admin)
  - Body: `{ farmerImage?, farmLocation, plantName, plantedDate?, harvestDate?, farmerName? }`
  - Response: `{ success, plantId }`

- GET `/api/plants` (admin|ministry)
- GET `/api/plants/:id` (admin|ministry)
- PUT `/api/plants/:id` (admin|ministry)
  - Body: `{ status?, ministryFeedback? (<= 600 chars) }`
- DELETE `/api/plants/:id` (admin)

## QR (Plants)

Mounted at `/api/qr` via [backend/src/routes/qr.routes.js](src/routes/qr.routes.js)

- POST `/api/qr/generate`
  - Body: `{ plantId: number, expiresAt: ISODateString }`
  - Response: `{ success, data: { token, expiresAt, url, qrDataUrl } }`

- GET `/api/qr/scan/:token`
  - Response: Latest sensor snapshot + plant meta; 410 if expired.

- GET `/api/qr/tokens` (non-production only)
- POST `/api/qr/dev-seed` (non-production only)

## Comments

Mounted at `/api/comments` via [backend/src/routes/comments.routes.js](src/routes/comments.routes.js)

- GET `/api/comments?entity_type=...&entity_id=...` (admin|ministry)
  - Response: `{ success, comments: Array<{ id,user_id,entity_type,entity_id,content,created_at }> }`

- POST `/api/comments` (admin|ministry)
  - Body: `{ entity_type: string, entity_id: string, content: string }`
  - Response: `{ success, id }`

## Dashboard

Mounted at `/api/dashboard` via [backend/src/routes/dashboard.routes.js](src/routes/dashboard.routes.js)

- GET `/api/dashboard` (admin|ministry)
  - Response: `{ success, data: Array<{ sensors, units, lastUpdate, location }> }`

## Soil Health

Mounted at `/api/soil-health` via [backend/src/routes/soilHealth.routes.js](src/routes/soilHealth.routes.js)

Public reference data:
- GET `/api/soil-health/ranges`
- GET `/api/soil-health/crop-types`

Farmer-scoped (auth):
- GET `/api/soil-health/farmer/:farmerId/weekly`
- GET `/api/soil-health/farmer/:farmerId/current`
- GET `/api/soil-health/farmer/:farmerId/crop-safety?cropType=...`
- GET `/api/soil-health/farmer/:farmerId/current-safety?cropType=...`

Device-scoped (auth):
- POST `/api/soil-health/weekly`
  - Body: `{ sensorDevices: string[], location?: string, plantingDate: ISODate|YYYY-MM-DD, harvestDate?: ISODate }`
- POST `/api/soil-health/current`
  - Body: `{ sensorDevices: string[], location?: string }`
- POST `/api/soil-health/crop-safety`
  - Body: `{ sensorDevices: string[], location?: string, plantingDate: ISODate, harvestDate?: ISODate, cropType?: string }`
- POST `/api/soil-health/current-safety`
  - Body: `{ sensorDevices: string[], location?: string, cropType?: string }`

Responses include computed statuses, scores, and summaries. For full details, see [backend/SOIL_HEALTH_API.md](../backend/SOIL_HEALTH_API.md) and service logic in [backend/src/services/soilHealth.service.js](src/services/soilHealth.service.js).

## Telegram

Mounted at `/api/telegram` via [backend/src/routes/telegram.routes.js](src/routes/telegram.routes.js)

- POST `/api/telegram/send`
  - Body: `{ text: string, chatId?: string, parseMode?: 'Markdown'|'HTML', disableNotification?: boolean }`

- GET `/api/telegram/updates?limit=5`
- POST `/api/telegram/send-latest` — Sends latest sensor snapshot to a chat.
- POST `/api/telegram/webhook` — Telegram bot webhook endpoint; handles `/update`, `/irrigate`, `/stop`.
- GET `/api/telegram/webhook` — Returns `{ ok: true }`.

## Uploads

Mounted at `/api/upload` via [backend/src/routes/upload.routes.js](src/routes/upload.routes.js)

- POST `/api/upload/image` (auth)
  - multipart/form-data with field `image`
  - Limits: 5MB; image-only; stored in Cloudinary `farmer-profiles/`
  - Response: `{ success, url, publicId }`

## Health

- GET `/health`
  - Response: `{ status: 'OK', timestamp, service }`

## Notes & Conventions

- CORS: Origin set is permissive by default; credentials enabled.
- Cookies: httpOnly `token` cookie is set by login; SameSite Lax; Secure in production.
- Pagination: Not universally implemented; list endpoints may return all items with a `count` field.
- InfluxDB: Measurement is configured by `INFLUXDB_MEASUREMENT`. Legacy endpoints and dashboards use SQL via [backend/src/services/sql.js](src/services/sql.js).
- CSV export: Use farmer download endpoint for device history CSV.

## Quick Test Flow

```bash
BASE=http://localhost:3000

# Login
LOGIN_JSON=$(curl -s -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"changeme"}')
TOKEN=$(echo "$LOGIN_JSON" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.token||'')})")

# List sensors
curl -s "$BASE/api/sensors" -H "Authorization: Bearer $TOKEN" | jq .

# Create a plant (admin)
curl -s -X POST "$BASE/api/plants" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"farmLocation":"Demo Farm","plantName":"Rice"}' | jq .
```
