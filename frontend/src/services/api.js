import axios from "axios";

const configuredBase =
  typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL || "").trim()
    : "";

// In production behind Nginx, use a relative base so the browser calls the same origin.
// This avoids CORS + Private Network Access (PNA) errors from attempting to call localhost.
const API_BASE = configuredBase || (import.meta.env.PROD ? "/api" : "http://localhost:5000/api");

const client = axios.create({ 
  baseURL: API_BASE,
  withCredentials: true // Enable cookies
});

// Add request interceptor to include auth token from localStorage
client.interceptors.request.use(
  (config) => {
    // Get token from localStorage (backup for cookie-based auth)
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to suppress expected 401 errors from /auth/me
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress console error for 401 on /auth/me (expected when not logged in)
    if (error.response?.status === 401 && error.config?.url?.includes('/auth/me')) {
      // Silently reject without logging
      return Promise.reject(error);
    }
    // For other errors, let them through normally
    return Promise.reject(error);
  }
);

export const httpClient = client;

export const login = async (email, password) => {
  const res = await client.post("/auth/login", { email, password });
  return res.data;
};

// User profile
export const getUserProfile = async () => {
  const res = await client.get("/auth/me");
  return res.data;
};

export const updatePassword = async ({ currentPassword, newPassword }) => {
  const res = await client.put("/auth/me/password", { currentPassword, newPassword });
  return res.data;
};

// Plants / crops
export const getPlants = async ({ includeLatest = false } = {}) => {
  const res = await client.get("/plants", { params: { includeLatest } });
  return res.data;
};

export const getPlant = async (id, { includeSensors = true } = {}) => {
  const res = await client.get(`/plants/${id}`, { params: { includeSensors } });
  return res.data;
};

export const createPlant = async (data) => {
  const res = await client.post("/plants", data);
  return res.data;
};

export const updatePlant = async (id, data) => {
  const res = await client.put(`/plants/${id}`, data);
  return res.data;
};

export const deletePlant = async (id) => {
  const res = await client.delete(`/plants/${id}`);
  return res.data;
};

// Ministry user management
export const getMinistryUsers = async () => {
  const res = await client.get("/users");
  return res.data;
};

export const createMinistryUser = async ({
  email,
  password,
  role = "ministry",
}) => {
  const res = await client.post("/users", { email, password, role });
  return res.data;
};

export const updateMinistryUser = async (id, payload) => {
  const res = await client.put(`/users/${id}`, payload);
  return res.data;
};

export const deleteMinistryUser = async (id) => {
  const res = await client.delete(`/users/${id}`);
  return res.data;
};

// Sensors
export const getLatestSensors = async () => {
  const res = await client.get("/sensors/latest");
  return res.data;
};

export const getDashboardData = async () => {
  const res = await client.get("/dashboard");
  return res.data;
};

// Public QR scan endpoint (backend: GET /api/qr/scan/:token)
export const getPublicPlantByToken = async (token) => {
  const res = await client.get(`/qr/scan/${token}`);
  return res.data;
};

// Farmers
export const getFarmers = async () => {
  const res = await client.get("/farmers");
  return res.data;
};

export const getFarmer = async (id) => {
  const res = await client.get(`/farmers/${id}`);
  return res.data;
};

// Public endpoint for QR code scans (no auth required)
export const getPublicFarmer = async (id) => {
  const res = await client.get(`/farmers/public/${id}`);
  return res.data;
};

// Scan farmer QR code by token (no auth required)
export const scanFarmerQR = async (token) => {
  const res = await client.get(`/farmers/scan/${token}`);
  return res.data;
};

export const createFarmer = async (data) => {
  const res = await client.post("/farmers", data);
  return res.data;
};

export const updateFarmer = async (id, data) => {
  const res = await client.put(`/farmers/${id}`, data);
  return res.data;
};

export const deleteFarmer = async (id) => {
  const res = await client.delete(`/farmers/${id}`);
  return res.data;
};
