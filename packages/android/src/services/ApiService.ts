import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { torService } from './TorService';
import { Server } from '../types/Server';

/**
 * API Response wrapper
 */
interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

/**
 * API Error response
 */
interface ApiErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
}

/**
 * Request retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

/**
 * ApiService
 *
 * Centralized HTTP client for making API requests to TOR hidden services.
 * Features:
 * - Dynamic baseURL based on active server
 * - Routes requests through TOR SOCKS5 proxy
 * - Automatic token injection
 * - Request/response interceptors
 * - Retry logic for failed requests
 * - Extended timeouts for TOR network
 * - Comprehensive error handling
 */
class ApiService {
  private axiosInstance: AxiosInstance;
  private currentServer: Server | null = null;
  private retryConfig: RetryConfig;

  constructor() {
    // Initialize with default localhost (fallback)
    this.axiosInstance = axios.create({
      baseURL: 'http://10.0.2.2:3000/api', // Android emulator localhost
      timeout: torService.getTimeout(),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 2000, // 2 seconds
      retryableStatuses: [408, 429, 500, 502, 503, 504], // Retryable HTTP status codes
    };

    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          // Get token from storage
          const token = await AsyncStorage.getItem('token');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Add TOR-specific headers
          if (this.currentServer && torService.isConnected()) {
            config.headers['X-Tor-Request'] = 'true';
          }

          return config;
        } catch (error) {
          console.error('Request interceptor error:', error);
          return config;
        }
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - handle errors and retries
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: number };

        // Handle timeout errors
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          return Promise.reject({
            error: 'Request timeout',
            message: 'The request took too long. TOR network might be slow or unavailable.',
            statusCode: 408,
          } as ApiErrorResponse);
        }

        // Handle network errors
        if (error.message === 'Network Error' || !error.response) {
          // Check if TOR is connected
          if (this.currentServer && !torService.isConnected()) {
            return Promise.reject({
              error: 'TOR not connected',
              message: 'Please ensure TOR (Orbot) is running and connected.',
              statusCode: 0,
            } as ApiErrorResponse);
          }

          return Promise.reject({
            error: 'Network error',
            message: 'Unable to connect to the server. Check your connection.',
            statusCode: 0,
          } as ApiErrorResponse);
        }

        // Retry logic
        const status = error.response?.status;
        if (
          status &&
          this.retryConfig.retryableStatuses.includes(status) &&
          (!originalRequest._retry || originalRequest._retry < this.retryConfig.maxRetries)
        ) {
          originalRequest._retry = (originalRequest._retry || 0) + 1;

          // Wait before retry
          await this.delay(this.retryConfig.retryDelay);

          return this.axiosInstance(originalRequest);
        }

        // Handle 401 Unauthorized - clear token
        if (status === 401) {
          await AsyncStorage.removeItem('token');
          return Promise.reject({
            error: 'Unauthorized',
            message: 'Your session has expired. Please login again.',
            statusCode: 401,
          } as ApiErrorResponse);
        }

        // Format error response
        const errorResponse: ApiErrorResponse = {
          error: error.response?.data?.error || 'Request failed',
          message: error.response?.data?.message || error.message,
          statusCode: status,
        };

        return Promise.reject(errorResponse);
      }
    );
  }

  /**
   * Set active server and update baseURL
   */
  setServer(server: Server | null): void {
    this.currentServer = server;

    if (server) {
      // Format onion URL
      const baseURL = torService.formatOnionUrl(server.onionAddress);
      this.axiosInstance.defaults.baseURL = `${baseURL}/api`;

      // Update timeout for TOR
      this.axiosInstance.defaults.timeout = torService.getTimeout();
    } else {
      // Fallback to localhost
      this.axiosInstance.defaults.baseURL = 'http://10.0.2.2:3000/api';
      this.axiosInstance.defaults.timeout = 10000; // 10 seconds for localhost
    }
  }

  /**
   * Get current server
   */
  getServer(): Server | null {
    return this.currentServer;
  }

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.get(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.post(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.put(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.patch(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axiosInstance.delete(url, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Set authentication token
   */
  async setToken(token: string | null): Promise<void> {
    if (token) {
      await AsyncStorage.setItem('token', token);
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      await AsyncStorage.removeItem('token');
      delete this.axiosInstance.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Get authentication token
   */
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('token');
  }

  /**
   * Update retry configuration
   */
  setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  /**
   * Update request timeout
   */
  setTimeout(timeout: number): void {
    this.axiosInstance.defaults.timeout = timeout;
  }

  /**
   * Handle and format errors
   */
  private handleError(error: any): ApiErrorResponse {
    // If it's already formatted, return as is
    if (error.error && error.statusCode !== undefined) {
      return error as ApiErrorResponse;
    }

    // Format axios error
    if (error.response) {
      return {
        error: error.response.data?.error || 'Request failed',
        message: error.response.data?.message || error.message,
        statusCode: error.response.status,
      };
    }

    // Network or other errors
    return {
      error: 'Unknown error',
      message: error.message || 'An unexpected error occurred',
      statusCode: 0,
    };
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if server is reachable
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.get('/health', { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get API base URL
   */
  getBaseURL(): string {
    return this.axiosInstance.defaults.baseURL || '';
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export class for testing
export { ApiService };
