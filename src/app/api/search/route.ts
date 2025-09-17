import { NextRequest, NextResponse } from 'next/server';

interface NpmSearchResult {
  package: {
    name: string;
    description?: string;
    version?: string;
    keywords?: string[];
  };
  score: {
    final: number;
  };
}

interface NpmSearchResponse {
  objects: NpmSearchResult[];
  total: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: 'Query parameter "q" is required and must be at least 2 characters' },
      { status: 400 }
    );
  }

  try {
    const npmSearchUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=10`;
    
    const response = await fetch(npmSearchUrl, {
      headers: {
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
    });

    if (!response.ok) {
      throw new Error(`NPM registry responded with status: ${response.status}`);
    }

    const data: NpmSearchResponse = await response.json();

    const packages = data.objects.map((result) => ({
      name: result.package.name,
      description: result.package.description,
      version: result.package.version,
      keywords: result.package.keywords?.slice(0, 5),
      score: result.score.final,
    }));

    return NextResponse.json({
      packages,
      total: data.total,
    });
  } catch (error) {
    console.error('Error searching npm packages:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search packages',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}