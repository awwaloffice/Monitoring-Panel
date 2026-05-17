import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  login: (data) => api.post("/auth/login", data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get("/auth/me"),
  changePassword: (data) => api.put("/auth/change-password", data),
};

// Dashboard
export const dashboardApi = {
  summary: () => api.get("/dashboard/summary"),
  destinationGroups: () => api.get("/dashboard/destination-groups"),
  localDeviceSummary: () => api.get("/dashboard/local-device-summary"),
  recentAlerts: () => api.get("/dashboard/recent-alerts"),
  currentProblems: () => api.get("/alerts/current"),
};

// Routers
export const routersApi = {
  list: () => api.get("/routers"),
  get: (id) => api.get(`/routers/${id}`),
  create: (data) => api.post("/routers", data),
  update: (id, data) => api.put(`/routers/${id}`, data),
  delete: (id) => api.delete(`/routers/${id}`),
  test: (id) => api.post(`/routers/${id}/test`),
  report: (id, params) => api.get(`/routers/${id}/report`, { params }),
  services: (id) => api.get(`/routers/${id}/services`),
};

// Destinations
export const destinationsApi = {
  list: (params) => api.get("/destinations", { params }),
  get: (id) => api.get(`/destinations/${id}`),
  create: (data) => api.post("/destinations", data),
  update: (id, data) => api.put(`/destinations/${id}`, data),
  delete: (id) => api.delete(`/destinations/${id}`),
  test: (id, data) => api.post(`/destinations/${id}/test`, data),
  history: (id, params) => api.get(`/destinations/${id}/history`, { params }),
};

// Local Devices
export const devicesApi = {
  list: (params) => api.get("/local-devices", { params }),
  get: (id) => api.get(`/local-devices/${id}`),
  create: (data) => api.post("/local-devices", data),
  update: (id, data) => api.put(`/local-devices/${id}`, data),
  delete: (id) => api.delete(`/local-devices/${id}`),
  test: (id) => api.post(`/local-devices/${id}/test`),
  history: (id, params) => api.get(`/local-devices/${id}/history`, { params }),
};

// Users
export const usersApi = {
  list: () => api.get("/users"),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Alerts
export const alertsApi = {
  list: (params) => api.get("/alerts", { params }),
  acknowledge: (id) => api.put(`/alerts/${id}/acknowledge`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
};

// Audit Logs
// Audit Logs
// Audit Logs
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export const auditApi = {
  list: (params) => api.get("/audit-logs", { params }),
  export: () => window.open(`${API_BASE_URL}/audit-logs/export`, "_blank"),
  settings: () => api.get("/audit-logs/settings"),
  updateSettings: (data) => api.put("/audit-logs/settings", data),
  cleanup: (data) => api.post("/audit-logs/cleanup", data),
  clearAll: () => api.delete("/audit-logs/clear-all"),
};

// Settings
export const settingsApi = {
  get: () => api.get("/settings"),
  update: (data) => api.put("/settings", data),
};

// Reports
export const reportsApi = {
  destinations: (params) => api.get("/reports/destinations", { params }),
  localDevices: (params) => api.get("/reports/local-devices", { params }),
  uptime: () => api.get("/reports/uptime"),
  alerts: (params) => api.get("/reports/alerts", { params }),
};

// Bulk
export const bulkApi = {
  previewRouters: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/routers/preview", fd);
  },
  importRouters: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/routers/import", fd);
  },
  previewDestinations: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/destinations/preview", fd);
  },
  importDestinations: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/destinations/import", fd);
  },
  previewDevices: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/local-devices/preview", fd);
  },
  importDevices: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post("/bulk/local-devices/import", fd);
  },
};

export default api;