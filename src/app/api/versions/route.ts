import { NextRequest, NextResponse } from 'next/server';

interface NpmPackageVersion {
  [version: string]: {
    name: string;
    version: string;
    description?: string;
    dist: {
      tarball: string;
      shasum: string;
    };
  };
}

interface NpmPackageInfo {
  name: string;
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
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get('package');

  if (!packageName) {
    return NextResponse.json(
      { error: 'Package name is required' },
      { status: 400 }
    );
  }

  try {
    const npmRegistryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    
    const response = await fetch(npmRegistryUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Package not found' },
          { status: 404 }
        );
      }
      throw new Error(`NPM registry responded with status: ${response.status}`);
    }

    const packageInfo: NpmPackageInfo = await response.json();

    const versions = Object.keys(packageInfo.versions)
      .filter(version => {
        return /^\d+\.\d+\.\d+/.test(version);
      })
      .map(version => ({
        version,
        publishedAt: packageInfo.time[version],
      }))
      .sort((a, b) => {
        const parseVersion = (v: string) => v.split('.').map(n => parseInt(n) || 0);
        const aVer = parseVersion(a.version);
        const bVer = parseVersion(b.version);
        
        for (let i = 0; i < Math.max(aVer.length, bVer.length); i++) {
          const aPart = aVer[i] || 0;
          const bPart = bVer[i] || 0;
          if (aPart !== bPart) {
            return bPart - aPart;
          }
        }
        return 0;
      });

    return NextResponse.json({
      packageName,
      versions: versions.map(v => v.version),
      latest: packageInfo['dist-tags'].latest,
      totalVersions: versions.length,
    });
  } catch (error) {
    console.error('Error fetching package versions:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch package versions',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}