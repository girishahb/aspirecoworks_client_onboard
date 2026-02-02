import axios, { type AxiosInstance } from 'axios';

const baseURL =
  typeof import.meta.env?.VITE_API_BASE_URL === 'string' &&
  import.meta.env.VITE_API_BASE_URL.trim() !== ''
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : 'http://localhost:3000';

const client: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized:', error.config?.url ?? error.config?.baseURL);
    }
    return Promise.reject(error);
  },
);

export async function apiGet<T>(path: string): Promise<T> {
  const { data } = await client.get<T>(path);
  return data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { data } = await client.post<T>(path, body);
  return data;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const { data } = await client.patch<T>(path, body);
  return data;
}
