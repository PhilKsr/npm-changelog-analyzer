import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import { globalCache } from '@/lib/utils/cache';
import {
  successResponse,
  errorResponse,
  validationError,
  rateLimitError,
  notFoundError
} from '@/lib/utils/api-response';
import { validatePackageName } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  if (!rateLimiter.checkLimit(ip)) {
    return rateLimitError();
  }

  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get('package');

  if (!packageName) {
    return validationError('package', 'Package name is required');
  }

  if (!validatePackageName(packageName)) {
    return validationError('package', 'Invalid package name');
  }

  const cacheKey = `versions:${packageName}`;
  const cached = globalCache.get(cacheKey);
  if (cached) {
    return successResponse(cached, true);
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'npm-changelog-analyzer/1.0.0',
        },
      }
    );

    if (response.status === 404) {
      return notFoundError('Package');
    }

    if (!response.ok) {
      throw new Error(`NPM API error: ${response.statusText}`);
    }

    const data = await response.json();
    const versions = Object.keys(data.versions || {})
      .filter(v => !v.includes('alpha') && !v.includes('beta') && !v.includes('rc'))
      .sort((a, b) => {
        const aParts = a.split('.').map(Number);
        const bParts = b.split('.').map(Number);
        
        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
          const aPart = aParts[i] || 0;
          const bPart = bParts[i] || 0;
          
          if (aPart !== bPart) {
            return bPart - aPart;
          }
        }
        
        return 0;
      });

    const result = {
      name: packageName,
      versions,
      latest: data['dist-tags']?.latest,
      total: versions.length
    };

    globalCache.set(cacheKey, result, 300000); // 5 minutes
    return successResponse(result, true);
  } catch (error) {
    console.error('Error fetching versions:', error);
    return errorResponse(
      'Failed to fetch package versions',
      500,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}