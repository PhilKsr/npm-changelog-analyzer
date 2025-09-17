import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter, getRateLimitHeaders, getClientIP } from '@/lib/rateLimiter';

interface NpmSearchResult {
  package: {
    name: string;
    description?: string;
    version?: string;
    keywords?: string[];
    publisher?: {
      username: string;
    };
    maintainers?: Array<{
      username: string;
      email: string;
    }>;
    links?: {
      npm?: string;
      homepage?: string;
      repository?: string;
      bugs?: string;
    };
    date?: string;
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
  searchScore?: number;
}

interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
  time: string;
}

interface PackageResult {
  name: string;
  description: string;
  version: string;
  keywords: string[];
  maintainers: number;
  quality: number;
  popularity: number;
  maintenance: number;
  finalScore: number;
  publishedAt: string;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
  };
}

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request);
  const rateLimit = apiRateLimiter.check(clientIP);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded', 
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

  if (!query || query.length < 2) {
    return NextResponse.json(
      { 
        error: 'Invalid query', 
        message: 'Query parameter "q" is required and must be at least 2 characters',
        packages: [],
        total: 0
      },
      { 
        status: 400,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
      }
    );
  }

  try {
    const searchUrl = new URL('https://registry.npmjs.org/-/v1/search');
    searchUrl.searchParams.set('text', query);
    searchUrl.searchParams.set('size', limit.toString());
    searchUrl.searchParams.set('from', offset.toString());
    searchUrl.searchParams.set('quality', '0.65');
    searchUrl.searchParams.set('popularity', '0.98');
    searchUrl.searchParams.set('maintenance', '0.5');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NPM registry responded with status: ${response.status}`);
    }

    const data: NpmSearchResponse = await response.json();

    const packages: PackageResult[] = data.objects.map((result) => ({
      name: result.package.name,
      description: result.package.description || 'No description available',
      version: result.package.version || '0.0.0',
      keywords: (result.package.keywords || []).slice(0, 5),
      maintainers: result.package.maintainers?.length || 0,
      quality: Math.round(result.score.detail.quality * 100) / 100,
      popularity: Math.round(result.score.detail.popularity * 100) / 100,
      maintenance: Math.round(result.score.detail.maintenance * 100) / 100,
      finalScore: Math.round(result.score.final * 100) / 100,
      publishedAt: result.package.date || '',
      links: {
        npm: `https://www.npmjs.com/package/${result.package.name}`,
        homepage: result.package.links?.homepage,
        repository: result.package.links?.repository,
      },
    }));

    packages.sort((a, b) => b.finalScore - a.finalScore);

    const responseData = {
      packages,
      total: data.total,
      query,
      limit,
      offset,
      hasMore: data.total > offset + limit,
      searchTime: data.time,
    };

    return NextResponse.json(responseData, {
      headers: {
        ...getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });

  } catch (error) {
    console.error('Error searching npm packages:', error);
    
    let errorMessage = 'Failed to search packages';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Search request timed out';
        statusCode = 408;
      } else if (error.message.includes('status: 429')) {
        errorMessage = 'NPM registry rate limit exceeded';
        statusCode = 429;
      }
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        packages: [],
        total: 0
      },
      { 
        status: statusCode,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
      }
    );
  }
}