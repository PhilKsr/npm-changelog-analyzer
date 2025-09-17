import { NextRequest, NextResponse } from 'next/server';
import { apiRateLimiter, getRateLimitHeaders, getClientIP } from '@/lib/rateLimiter';

interface NpmPackageVersion {
  [version: string]: {
    name: string;
    version: string;
    description?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    engines?: Record<string, string>;
    dist: {
      tarball: string;
      shasum: string;
      integrity?: string;
      fileCount?: number;
      unpackedSize?: number;
    };
    deprecated?: string;
  };
}

interface NpmPackageInfo {
  name: string;
  description?: string;
  versions: NpmPackageVersion;
  'dist-tags': {
    latest: string;
    [tag: string]: string;
  };
  time: {
    [version: string]: string;
    created: string;
    modified: string;
  };
  maintainers?: Array<{
    name: string;
    email: string;
  }>;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  bugs?: {
    url: string;
  };
  license?: string;
  keywords?: string[];
}

interface VersionInfo {
  version: string;
  publishedAt: string;
  isLatest: boolean;
  isPrerelease: boolean;
  isDeprecated: boolean;
  deprecationMessage?: string;
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  size?: {
    fileCount?: number;
    unpackedSize?: number;
  };
}

function parseVersion(version: string): { major: number; minor: number; patch: number; prerelease?: string } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);
  
  if (versionA.major !== versionB.major) {
    return versionB.major - versionA.major;
  }
  
  if (versionA.minor !== versionB.minor) {
    return versionB.minor - versionA.minor;
  }
  
  if (versionA.patch !== versionB.patch) {
    return versionB.patch - versionA.patch;
  }
  
  if (versionA.prerelease && !versionB.prerelease) {
    return 1;
  }
  
  if (!versionA.prerelease && versionB.prerelease) {
    return -1;
  }
  
  if (versionA.prerelease && versionB.prerelease) {
    return versionB.prerelease.localeCompare(versionA.prerelease);
  }
  
  return 0;
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
  const packageName = searchParams.get('package')?.trim();
  const includePrerelease = searchParams.get('prerelease') === 'true';
  const includeDeprecated = searchParams.get('deprecated') === 'true';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

  if (!packageName) {
    return NextResponse.json(
      { 
        error: 'Missing package name', 
        message: 'Package name is required',
        versions: []
      },
      { 
        status: 400,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
      }
    );
  }

  try {
    const npmRegistryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(npmRegistryUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { 
            error: 'Package not found', 
            message: `Package "${packageName}" does not exist`,
            versions: []
          },
          { 
            status: 404,
            headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
          }
        );
      }
      throw new Error(`NPM registry responded with status: ${response.status}`);
    }

    const packageInfo: NpmPackageInfo = await response.json();
    const latestVersion = packageInfo['dist-tags'].latest;

    const versionEntries = Object.entries(packageInfo.versions)
      .filter(([version]) => {
        const semverMatch = /^\d+\.\d+\.\d+/.test(version);
        if (!semverMatch) return false;
        
        const parsed = parseVersion(version);
        const isPrerelease = !!parsed.prerelease;
        const versionData = packageInfo.versions[version];
        const isDeprecated = !!versionData.deprecated;
        
        if (isPrerelease && !includePrerelease) return false;
        if (isDeprecated && !includeDeprecated) return false;
        
        return true;
      })
      .map(([version, versionData]): VersionInfo => {
        const parsed = parseVersion(version);
        return {
          version,
          publishedAt: packageInfo.time[version] || '',
          isLatest: version === latestVersion,
          isPrerelease: !!parsed.prerelease,
          isDeprecated: !!versionData.deprecated,
          deprecationMessage: versionData.deprecated,
          major: parsed.major,
          minor: parsed.minor,
          patch: parsed.patch,
          prerelease: parsed.prerelease,
          size: {
            fileCount: versionData.dist.fileCount,
            unpackedSize: versionData.dist.unpackedSize,
          },
        };
      })
      .sort((a, b) => compareVersions(a.version, b.version))
      .slice(0, limit);

    const majorVersions = [...new Set(versionEntries.map(v => v.major))].sort((a, b) => b - a);
    const latestMajorVersions = majorVersions.slice(0, 5).map(major => {
      const latestInMajor = versionEntries.find(v => v.major === major && !v.isPrerelease);
      return latestInMajor?.version;
    }).filter(Boolean);

    const responseData = {
      packageName,
      description: packageInfo.description,
      versions: versionEntries.map(v => v.version),
      versionsDetailed: versionEntries,
      latest: latestVersion,
      totalVersions: Object.keys(packageInfo.versions).length,
      majorVersions,
      latestMajorVersions,
      distTags: packageInfo['dist-tags'],
      repository: packageInfo.repository?.url,
      homepage: packageInfo.homepage,
      license: packageInfo.license,
      keywords: packageInfo.keywords || [],
      maintainers: packageInfo.maintainers?.length || 0,
      created: packageInfo.time.created,
      modified: packageInfo.time.modified,
    };

    return NextResponse.json(responseData, {
      headers: {
        ...getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });

  } catch (error) {
    console.error('Error fetching package versions:', error);
    
    let errorMessage = 'Failed to fetch package versions';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out';
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
        versions: []
      },
      { 
        status: statusCode,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime)
      }
    );
  }
}