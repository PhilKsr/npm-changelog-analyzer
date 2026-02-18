export interface ApiError {
  error: string;
  message?: string;
  details?: any;
  statusCode?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  meta?: {
    cached?: boolean;
    timestamp?: string;
    version?: string;
  };
}

export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
}

export interface CacheConfig {
  ttl: number;
  key: string;
  compress?: boolean;
}

export interface RequestConfig {
  cache?: boolean;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}