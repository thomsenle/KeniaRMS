import { io, Socket } from 'socket.io-client';

const API_BASE = '/api';

export const socket: Socket = io({
  autoConnect: true,
  transports: ['websocket', 'polling']
});

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? undefined : headers
  });

  const data = await response.json();
  if (!response.ok || data.success === false) {
    throw new Error(data.message || `API request failed with status ${response.status}`);
  }

  return data;
}

// Helpers
export const formatKES = (amount: number = 0): string => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount).replace('KES', 'KSh');
};
