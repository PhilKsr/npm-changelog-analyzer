import { AppError, NetworkTimeoutError, RateLimitExceededError, isRetryableError, getRetryDelay } from './errors';

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: Error) => boolean;
}

export interface RequestMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  attempts: number;
  success: boolean;
  error?: string;
}

// Request deduplication
const pendingRequests = new Map<string, Promise<any>>();

export async function fetchWithTimeout(
  url: string, 
  options: RequestOptions = {}
): Promise<Response> {
  const {
    timeout = 30000,
    retries = 3,
    retryDelay = 1000,
    retryCondition = (error) => error instanceof AppError ? isRetryableError(error) : true,
    ...fetchOptions
  } = options;

  const metrics: RequestMetrics = {
    startTime: Date.now(),
    attempts: 0,
    success: false,
  };

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    metrics.attempts = attempt + 1;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      metrics.endTime = Date.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      metrics.success = true;

      // Handle rate limiting
      if (response.status === 429) {
        const resetHeader = response.headers.get('x-ratelimit-reset') || 
                           response.headers.get('retry-after');
        const resetTime = resetHeader ? parseInt(resetHeader) * 1000 : undefined;
        throw new RateLimitExceededError(getDomainFromUrl(url), resetTime);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new NetworkTimeoutError(url, timeout);
      }

      if (attempt === retries || !retryCondition(lastError)) {
        break;
      }

      // Wait before retry
      const delay = getRetryDelay(attempt, retryDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  metrics.endTime = Date.now();
  metrics.duration = metrics.endTime - metrics.startTime;
  metrics.error = lastError.message;

  throw lastError;
}

export async function fetchWithDeduplication<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check if request is already pending
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }

  // Create new request
  const promise = fetcher()
    .finally(() => {
      // Clean up after request completes
      pendingRequests.delete(key);
    });

  // Store pending request
  pendingRequests.set(key, promise);

  return promise;
}

export async function fetchJSON<T>(
  url: string, 
  options: RequestOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'npm-changelog-analyzer/1.0.0',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(text);
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Use default error message
    }

    throw new AppError(errorMessage, response.status, 'HTTP_ERROR');
  }

  const data = await response.json();
  return data;
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown';
  }
}

// Request batching utility
export class RequestBatcher<T, R> {
  private batch: T[] = [];
  private resolvers: Array<(result: R[]) => void> = [];
  private rejecters: Array<(error: Error) => void> = [];
  private timeoutId?: NodeJS.Timeout;
  private readonly batchSize: number;
  private readonly batchTimeout: number;
  private readonly processor: (items: T[]) => Promise<R[]>;

  constructor(
    processor: (items: T[]) => Promise<R[]>,
    batchSize: number = 10,
    batchTimeout: number = 100
  ) {
    this.processor = processor;
    this.batchSize = batchSize;
    this.batchTimeout = batchTimeout;
  }

  async add(item: T): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      this.batch.push(item);
      
      const itemIndex = this.batch.length - 1;
      
      this.resolvers.push((results: R[]) => {
        resolve(results[itemIndex]);
      });
      
      this.rejecters.push(reject);

      if (this.batch.length >= this.batchSize) {
        this.flush();
      } else if (!this.timeoutId) {
        this.timeoutId = setTimeout(() => this.flush(), this.batchTimeout);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const currentBatch = [...this.batch];
    const currentResolvers = [...this.resolvers];
    const currentRejecters = [...this.rejecters];

    // Clear current batch
    this.batch = [];
    this.resolvers = [];
    this.rejecters = [];

    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }

    try {
      const results = await this.processor(currentBatch);
      currentResolvers.forEach((resolve, index) => {
        resolve(results);
      });
    } catch (error) {
      currentRejecters.forEach(reject => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    }
  }
}

// Rate limiter per domain
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 60, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  canMakeRequest(domain: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(domain) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    // Update the requests array
    this.requests.set(domain, validRequests);
    
    return validRequests.length < this.maxRequests;
  }

  recordRequest(domain: string): void {
    const now = Date.now();
    const requests = this.requests.get(domain) || [];
    requests.push(now);
    this.requests.set(domain, requests);
  }

  getRemainingRequests(domain: string): number {
    const now = Date.now();
    const requests = this.requests.get(domain) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(domain: string): number {
    const requests = this.requests.get(domain) || [];
    if (requests.length === 0) return Date.now();
    
    const oldestRequest = Math.min(...requests);
    return oldestRequest + this.windowMs;
  }
}

export const globalRateLimiter = new RateLimiter(60, 60000); // 60 requests per minute

export async function fetchWithRateLimit<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const domain = getDomainFromUrl(url);
  
  if (!globalRateLimiter.canMakeRequest(domain)) {
    const resetTime = globalRateLimiter.getResetTime(domain);
    throw new RateLimitExceededError(domain, resetTime);
  }

  globalRateLimiter.recordRequest(domain);
  
  return fetchJSON<T>(url, options);
}