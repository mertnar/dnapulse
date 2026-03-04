// API client utility for making requests to the backend

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const INGESTION_BASE_URL = import.meta.env.VITE_INGESTION_URL || 'http://localhost:19071';

export interface ApiError {
  error: string;
  message?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

function getAuthHeaders() {
  const token = localStorage.getItem('jwt_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<T>(response);
  },

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return handleResponse<T>(response);
  },

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (response.status === 204) {
      return undefined as T;
    }
    return handleResponse<T>(response);
  },
};

// Ingestion API client for agent endpoints
export const ingestionApi = {
  async register(data: any): Promise<any> {
    const response = await fetch(`${INGESTION_BASE_URL}/api/v1/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': data.api_key || '',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async health(token: string, data: any): Promise<any> {
    const response = await fetch(`${INGESTION_BASE_URL}/api/v1/agent/health`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return handleResponse<any>(response);
  },

  async pulse(token: string, events: any[]): Promise<any> {
    const response = await fetch(`${INGESTION_BASE_URL}/api/v1/pulse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ events }),
    });
    return handleResponse<any>(response);
  },
};
