/**
 * DEVICE SERVICE: IoT Hardware Communication
 * Location: src/services/device.service.js
 */
const axios = require('axios');

// --- CONSTANTS ---
// Ensure the URL is clean without a trailing slash for reliable path joining
const IOT_BASE_URL = (process.env.IOT_GATEWAY_URL || '').replace(/\/$/, '');
const REQ_TIMEOUT_MS = 5000; 
const DEFAULT_DEVICE = process.env.BOT_DEFAULT_DEVICE_ID || "DEMO001";

const deviceService = {
    /**
     * Sends a command to the physical pump/fertilizer relay.
     * @param {string} deviceId - Target hardware ID
     * @param {string} component - 'pump' or 'fertilizer'
     * @param {string} action - 'ON' or 'OFF'
     */
    async sendCommand(deviceId = DEFAULT_DEVICE, component, action) {
        // Mode Check: Don't attempt real network calls in DEV mode
        if (process.env.ENV_MODE === 'DEV') {
            console.log(`📡 [IOT MOCK] Device: ${deviceId} | Component: ${component} | Action: ${action}`);
            return { success: true, status: "MOCK_OK" };
        }

        // Skeptic Check: Ensure Gateway is configured
        if (!IOT_BASE_URL) {
            console.error("❌ CRITICAL: IOT_GATEWAY_URL missing in .env");
            return { success: false, error: "Configuration Error" };
        }

        try {
            // Straightforward payload structure for ESP32/Arduino JSON parsing
            const payload = {
                device: deviceId,
                cmd: component, // 'pump' or 'fertilizer'
                val: action     // 'ON' or 'OFF'
            };

            const response = await axios.post(`${IOT_BASE_URL}/control`, payload, { 
                timeout: REQ_TIMEOUT_MS,
                headers: { 'Content-Type': 'application/json' }
            });

            return { 
                success: response.status === 200, 
                data: response.data 
            };
        } catch (error) {
            // Detailed error logging for provincial network debugging
            console.error(`🔥 Hardware Comm Error (${component}):`, error.message);
            
            let errorMessage = "Network Error";
            if (error.code === 'ECONNABORTED') errorMessage = "Device Offline (Timeout)";
            if (error.response) errorMessage = `Hardware Rejected (${error.response.status})`;

            return { 
                success: false, 
                error: errorMessage
            };
        }
    }
};

module.exports = deviceService;