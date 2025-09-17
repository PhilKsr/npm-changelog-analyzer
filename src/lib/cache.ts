interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
    
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  set<T>(key: string, data: T, ttl: number = 300000): void { // 5 minutes default
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private evictOldest(): void {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Cache instances for different data types
export const packageCache = new InMemoryCache(500);
export const versionCache = new InMemoryCache(200);
export const changelogCache = new InMemoryCache(100);

// Cache key generators
export function generatePackageSearchKey(query: string, limit: number = 8): string {
  return `package_search:${query.toLowerCase().trim()}:${limit}`;
}

export function generateVersionKey(packageName: string): string {
  return `package_versions:${packageName.toLowerCase().trim()}`;
}

export function generateChangelogKey(packageName: string, startVersion: string, endVersion: string): string {
  return `changelog:${packageName.toLowerCase().trim()}:${startVersion}:${endVersion}`;
}

// Cache utilities
export function getCachedData<T>(
  cache: InMemoryCache,
  key: string
): T | null {
  return cache.get<T>(key);
}

export function setCachedData<T>(
  cache: InMemoryCache,
  key: string,
  data: T,
  ttl?: number
): void {
  cache.set(key, data, ttl);
}

// Cache warming for popular packages
export const POPULAR_PACKAGES = [
  'react',
  'vue',
  'angular',
  'axios',
  'lodash',
  'express',
  'typescript',
  'webpack',
  'babel',
  'jest',
  '@types/node',
  '@types/react',
  'eslint',
  'prettier',
  'next',
  'nuxt',
  'vite',
  'rollup',
  'commander',
  'inquirer',
];

export async function warmCache(): Promise<void> {
  console.log('Warming cache with popular packages...');
  
  // This would typically be called during application startup
  // Implementation depends on having the API functions available
}

// Cache statistics
export interface CacheStats {
  packageCache: {
    size: number;
    maxSize: number;
    hitRate?: number;
  };
  versionCache: {
    size: number;
    maxSize: number;
    hitRate?: number;
  };
  changelogCache: {
    size: number;
    maxSize: number;
    hitRate?: number;
  };
}

export function getCacheStats(): CacheStats {
  return {
    packageCache: {
      size: packageCache.size(),
      maxSize: 500,
    },
    versionCache: {
      size: versionCache.size(),
      maxSize: 200,
    },
    changelogCache: {
      size: changelogCache.size(),
      maxSize: 100,
    },
  };
}