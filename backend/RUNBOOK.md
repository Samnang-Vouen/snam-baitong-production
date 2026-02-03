# Backend Runbook

This runbook provides step-by-step instructions for setting up and running the SNAM Baitong backend server, MQTT broker, and ngrok for local development.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Running the Services](#running-the-services)
- [Service Details](#service-details)
- [Troubleshooting](#troubleshooting)
- [Common Operations](#common-operations)

---

## Prerequisites

### Required Software
- **Node.js** (v16+ recommended)
- **MySQL** (v8.0+)
- **ngrok** (for webhook tunneling) - [Download](https://ngrok.com/download)
- **Git** (for version control)

### Optional but Recommended
- **Postman** or **Insomnia** (for API testing)
- **MySQL Workbench** or **DBeaver** (for database management)
- **MQTT Explorer** (for monitoring MQTT messages)

---

## Initial Setup

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:

**Critical Settings:**
```env
# Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DATABASE=snam_baitong

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=admin
MQTT_PASSWORD=admin123
MQTT_TLS=false

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# InfluxDB
INFLUXDB_URL=https://eu-central-1-1.aws.cloud2.influxdata.com/
INFLUXDB_TOKEN=your_token
INFLUXDB_ORG=E-GEN
INFLUXDB_BUCKET=data
```

### 3. Initialize Database

Ensure MySQL is running, then initialize the database:

```bash
npm run seed:admins
```

This will:
- Create necessary database tables
- Seed initial admin user (credentials from `.env`)

---

## Running the Services

### Quick Start (All Services)

You'll need **THREE terminal windows/tabs** to run all services simultaneously:

#### Terminal 1: MQTT Broker
```bash
cd backend
npm run mqtt:broker
```

Expected output:
```
[DEV MQTT] WebSocket MQTT listening on ws://localhost:8083/mqtt
[DEV MQTT] TCP MQTT broker listening on port 1883
```

#### Terminal 2: Backend API Server
```bash
cd backend
npm run dev
```

Expected output:
```
Server running on port 3000
MySQL Connected
MQTT Connected to mqtt://localhost:1883
```

#### Terminal 3: ngrok (for Telegram webhooks)
```bash
ngrok http 3000
```

Expected output:
```
Forwarding   https://xxxx-xx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3000
```

**Important:** After starting ngrok, copy the HTTPS forwarding URL and update your Telegram webhook:

```bash
# In a new terminal or use existing Terminal 2 after server starts
node src/scripts/set-telegram-webhook.js
# When prompted, enter your ngrok URL (e.g., https://xxxx.ngrok-free.app)
```

---

## Service Details

### 1. MQTT Broker (Development)

**Script:** `scripts/dev-mqtt-broker.js`  
**Command:** `npm run mqtt:broker`

**Features:**
- TCP MQTT on port `1883` (default)
- WebSocket MQTT on port `8083` at path `/mqtt`
- Optional authentication (set in `.env`)

**Configuration:**
```env
MQTT_PORT=1883                # TCP port
MQTT_WS_PORT=8083            # WebSocket port
MQTT_WS_PATH=/mqtt           # WebSocket path
MQTT_USERNAME=admin          # Optional auth
MQTT_PASSWORD=admin123       # Optional auth
```

**Testing Connection:**
```bash
# Using mosquitto_pub (if installed)
mosquitto_pub -h localhost -p 1883 -t "sensor/data" -m '{"temp":25}'

# Using MQTT Explorer
# Connect to: mqtt://localhost:1883
```

**Topics:**
- `sensor/data` - Sensor data ingestion
- `control/+` - Device control commands
- `device/status` - Device status updates
- `farm/pump/control` - Pump control (ON/OFF)

### 2. Backend API Server

**Entry Point:** `src/index.js`  
**Command:** `npm run dev` (development with nodemon) or `npm start` (production)

**Services Started:**
- Express.js HTTP server on port `3000`
- MySQL connection pool
- MQTT client connection
- InfluxDB client
- Scheduled jobs (cron)
- Telegram bot webhook

**Key Endpoints:**
- `GET /api/health` - Health check
- `POST /api/auth/login` - User authentication
- `GET /api/sensors/data` - Retrieve sensor data
- `POST /api/sensors/register` - Register new sensor
- `GET /api/dashboard/*` - Dashboard data

**Default Admin Credentials:**
```
Email: admin@example.com (from .env: ADMIN_EMAIL)
Password: admin123 (from .env: ADMIN_PASSWORD)
```

### 3. ngrok Tunnel

**Purpose:** Expose local backend to the internet for Telegram webhooks

**Command:** `ngrok http 3000`

**After Starting:**
1. Copy the HTTPS forwarding URL (e.g., `https://xxxx.ngrok-free.app`)
2. Update Telegram webhook:
   ```bash
   node src/scripts/set-telegram-webhook.js
   ```
   Or manually:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://xxxx.ngrok-free.app/api/telegram/webhook"}'
   ```

**Verify Webhook:**
```bash
node src/scripts/get-telegram-webhook-info.js
```

---

## Troubleshooting

### MQTT Connection Issues

**Problem:** Backend can't connect to MQTT broker
```
Error: connect ECONNREFUSED 127.0.0.1:1883
```

**Solutions:**
1. Ensure MQTT broker is running: `npm run mqtt:broker`
2. Check `MQTT_PORT` in `.env` matches broker port
3. Verify `MQTT_HOST=localhost` in `.env`
4. Check firewall settings

### Database Connection Errors

**Problem:** MySQL connection failed
```
Error: ER_ACCESS_DENIED_ERROR
```

**Solutions:**
1. Verify MySQL is running:
   ```bash
   # Windows
   net start MySQL80
   
   # Check status
   mysql -u root -p
   ```
2. Check credentials in `.env`
3. Create database if missing:
   ```sql
   CREATE DATABASE snam_baitong;
   ```
4. Grant permissions:
   ```sql
   GRANT ALL PRIVILEGES ON snam_baitong.* TO 'root'@'localhost';
   FLUSH PRIVILEGES;
   ```

### Port Already in Use

**Problem:** 
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**
1. Find and kill the process:
   ```bash
   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   
   # Alternative: Change port in .env
   PORT=3001
   ```

### Telegram Webhook Issues

**Problem:** Telegram not receiving updates

**Solutions:**
1. Check ngrok is running and URL is correct
2. Verify webhook is set:
   ```bash
   node src/scripts/get-telegram-webhook-info.js
   ```
3. Check Telegram bot token in `.env`
4. Ensure webhook URL uses HTTPS
5. Test webhook endpoint:
   ```bash
   curl https://your-ngrok-url.ngrok-free.app/api/telegram/webhook
   ```

### InfluxDB Connection Issues

**Problem:** Can't write sensor data to InfluxDB

**Solutions:**
1. Verify `INFLUXDB_TOKEN` is valid
2. Check bucket name: `INFLUXDB_BUCKET`
3. Test connection with curl:
   ```bash
   curl -X GET "https://eu-central-1-1.aws.cloud2.influxdata.com/api/v2/buckets" \
     -H "Authorization: Token YOUR_TOKEN"
   ```

---

## Common Operations

### Reset Database

```bash
# Drop and recreate database
mysql -u root -p -e "DROP DATABASE IF EXISTS snam_baitong; CREATE DATABASE snam_baitong;"

# Re-seed admin accounts
npm run seed:admins
```

### View MQTT Messages

Using MQTT Explorer:
1. Open MQTT Explorer
2. Connect to `mqtt://localhost:1883`
3. Add credentials if auth is enabled
4. Subscribe to topics: `sensor/#`, `control/#`, `device/#`

### Test Sensor Data Ingestion

```bash
# Send test MQTT message
mosquitto_pub -h localhost -p 1883 -u admin -P admin123 \
  -t "sensor/data" \
  -m '{"sensorId":"TEST001","temperature":25.5,"humidity":60,"soilMoisture":45,"timestamp":"2026-02-02T10:00:00Z"}'
```

### Check Application Logs

Backend logs are output to console. For production, consider using a log management tool.

**View recent logs:**
```bash
# If using PM2 (production)
pm2 logs backend

# Development
# Just check the terminal where npm run dev is running
```

### Update Admin Password

```bash
# Edit and run
node src/scripts/seed-admins.js
# This will update existing admin or create new one
```

### Backup Database

```bash
# Export database
mysqldump -u root -p snam_baitong > backup_$(date +%Y%m%d_%H%M%S).sql

# Import database
mysql -u root -p snam_baitong < backup_20260202_120000.sql
```

---

## Startup Checklist

- [ ] MySQL server is running
- [ ] `.env` file is configured correctly
- [ ] Database is initialized (`npm run seed:admins`)
- [ ] Terminal 1: MQTT broker running (`npm run mqtt:broker`)
- [ ] Terminal 2: Backend server running (`npm run dev`)
- [ ] Terminal 3: ngrok tunnel active (`ngrok http 3000`)
- [ ] Telegram webhook is configured with ngrok URL
- [ ] Test login with admin credentials
- [ ] Verify MQTT connection in backend logs
- [ ] Test sensor data ingestion

---

## Production Deployment

For production deployment:

1. **Use PM2 for process management:**
   ```bash
   npm install -g pm2
   pm2 start src/index.js --name backend
   pm2 start scripts/dev-mqtt-broker.js --name mqtt-broker
   pm2 save
   pm2 startup
   ```

2. **Use production MQTT broker:**
   - Install Mosquitto or use cloud MQTT service (AWS IoT Core, HiveMQ Cloud)
   - Update `MQTT_BROKER_URL` in `.env`

3. **Use production ngrok or reverse proxy:**
   - Set up nginx reverse proxy with SSL
   - Or use ngrok paid plan for static domain

4. **Environment variables:**
   - Set `NODE_ENV=production`
   - Use strong `JWT_SECRET`
   - Enable HTTPS only

5. **Database:**
   - Regular backups
   - Enable MySQL binary logging
   - Configure connection pooling

---

## Useful Commands Reference

```bash
# Development
npm run dev                    # Start backend with auto-reload
npm run mqtt:broker           # Start local MQTT broker
npm start                     # Start backend (no auto-reload)

# Database
npm run seed:admins           # Initialize/update admin accounts

# Testing
npm test                      # Run tests

# Utilities
node src/scripts/set-telegram-webhook.js        # Set Telegram webhook
node src/scripts/get-telegram-webhook-info.js   # Check webhook status
node src/scripts/init-database.js               # Initialize database schema

# Production
pm2 start src/index.js --name backend
pm2 logs backend
pm2 restart backend
pm2 stop backend
```

---

## Support and Documentation

- **Backend API Documentation:** Check `src/routes/` for available endpoints
- **Sensor Architecture:** See `SENSOR_ARCHITECTURE_PROPOSAL.md`
- **Soil Health API:** See `SOIL_HEALTH_API.md`
- **Farmer Workflow:** See `FARMER_SENSOR_WORKFLOW.md`

---

**Last Updated:** February 2, 2026  
**Maintained By:** Development Team
