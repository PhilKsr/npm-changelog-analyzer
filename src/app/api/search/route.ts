import { NextRequest } from 'next/server';
import { rateLimiter } from '@/lib/rateLimiter';
import { globalCache } from '@/lib/utils/cache';
import {
  successResponse,
  errorResponse,
  validationError,
  rateLimitError
} from '@/lib/utils/api-response';
import { sanitizeInput } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  if (!rateLimiter.checkLimit(ip)) {
    return rateLimitError();
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return validationError('query', 'Search query is required');
  }

  const sanitizedQuery = sanitizeInput(query);
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return validationError('query', 'Query must be at least 2 characters');
  }

  const cacheKey = `search:${sanitizedQuery}`;
  const cached = globalCache.get(cacheKey);
  if (cached) {
    return successResponse(cached, true);
  }

  try {
    const response = await fetch(
      `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(sanitizedQuery)}&size=10`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'npm-changelog-analyzer/1.0.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`NPM API error: ${response.statusText}`);
    }

    const data = await response.json();
    const packages = data.objects.map((obj: any) => ({
      name: obj.package.name,
      description: obj.package.description,
      version: obj.package.version,
      links: obj.package.links,
    }));

    globalCache.set(cacheKey, packages, 600000); // 10 minutes
    return successResponse(packages, true);
  } catch (error) {
    console.error('Search error:', error);
    return errorResponse(
      'Failed to search packages',
      500,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}