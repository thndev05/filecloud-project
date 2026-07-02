import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const ACCESS_TOKEN_KEY = 'filecloud_access_token';

const getAccessToken = () =>
  localStorage.getItem(ACCESS_TOKEN_KEY) || Cookies.get('token');

const setAccessToken = (token: string) => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  Cookies.set('token', token, { path: '/', sameSite: 'lax' });
};

const clearAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  Cookies.remove('token', { path: '/' });
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to attach the token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !String(originalRequest.url || '').includes('/auth/login') &&
      !String(originalRequest.url || '').includes('/auth/refresh')
    ) {
      originalRequest._retry = true;

      try {
        const refreshResponse = await api.post('/auth/refresh');
        const newAccessToken = refreshResponse.data?.access_token;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        return api(originalRequest);
      } catch (refreshError) {
        clearAccessToken();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export { api }; // Export api instance

export const authService = {
  async login(credentials: Record<string, unknown>) {
    const response = await api.post('/auth/login', credentials);
    if (response.data.access_token) {
      setAccessToken(response.data.access_token);
    }
    return response.data;
  },

  async register(data: Record<string, unknown>) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    return response.data;
  },

  async verifyToken() {
    try {
      const token = getAccessToken();
      if (!token) return false;
      await api.get('/auth/me');
      return true;
    } catch (_error) {
      return false;
    }
  },

  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      clearAccessToken();
    }
  },
};

export default api;
