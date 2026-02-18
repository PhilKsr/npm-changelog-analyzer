import { NextRequest } from 'next/server';
import { parseChangelog } from '@/lib/changelogParser';
import { rateLimiter } from '@/lib/rateLimiter';
import { 
  fetchChangelogFromGitHub, 
  parseGitHubUrl,
  fetchReleases
} from '@/lib/utils/github';
import { globalCache } from '@/lib/utils/cache';
import {
  successResponse,
  errorResponse,
  validationError,
  rateLimitError
} from '@/lib/utils/api-response';
import { validatePackageName, validateVersion } from '@/lib/utils/validation';

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  if (!rateLimiter.checkLimit(ip)) {
    return rateLimitError();
  }

  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get('package');
  const startVersion = searchParams.get('start');
  const endVersion = searchParams.get('end');

  if (!packageName || !startVersion || !endVersion) {
    return validationError('parameters', 'Package name, start version, and end version are required');
  }

  if (!validatePackageName(packageName)) {
    return validationError('package', 'Invalid package name');
  }

  if (!validateVersion(startVersion) || !validateVersion(endVersion)) {
    return validationError('version', 'Invalid version format');
  }

  const cacheKey = `changelog:${packageName}:${startVersion}:${endVersion}`;
  const cached = globalCache.get(cacheKey);
  if (cached) {
    return successResponse(cached, true);
  }

  try {
    const changelogText = await fetchChangelog(packageName);
    const parsedChangelog = parseChangelog(changelogText, startVersion, endVersion);
    
    globalCache.set(cacheKey, parsedChangelog);
    return successResponse(parsedChangelog, true);
  } catch (error) {
    console.error('Error fetching changelog:', error);
    
    return errorResponse(
      'Failed to fetch changelog',
      500,
      { message: error instanceof Error ? error.message : 'Unknown error' }
    );
  }
}

async function fetchChangelog(packageName: string): Promise<string> {
  const npmInfo = await fetchNpmPackageInfo(packageName);
  
  if (npmInfo?.repository) {
    const repoUrl = npmInfo.repository.url || npmInfo.homepage;
    if (repoUrl) {
      const changelogFromGitHub = await fetchChangelogFromGitHub(repoUrl);
      if (changelogFromGitHub) {
        return changelogFromGitHub;
      }

      const repo = parseGitHubUrl(repoUrl);
      if (repo) {
        const releases = await fetchReleases(repo);
        if (releases.length > 0) {
          return releases
            .filter(r => r.body?.trim())
            .map(r => `## ${r.tag_name}\n\n${r.body}\n`)
            .join('\n');
        }
      }
    }
  }

  if (npmInfo?.readme) {
    const changelogSection = extractChangelogFromReadme(npmInfo.readme);
    if (changelogSection) {
      return changelogSection;
    }
  }

  throw new Error('Could not find changelog for this package');
}

async function fetchNpmPackageInfo(packageName: string): Promise<any> {
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

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function extractChangelogFromReadme(readme: string): string | null {
  const lines = readme.split('\n');
  let isInChangelogSection = false;
  let changelogLines: string[] = [];
  let depth = 0;

  for (const line of lines) {
    const headerMatch = line.match(/^(#+)\s*(.*)/);
    
    if (headerMatch) {
      const headerDepth = headerMatch[1].length;
      const headerText = headerMatch[2].toLowerCase();
      
      if (headerText.match(/changelog|changes|history|releases/)) {
        isInChangelogSection = true;
        depth = headerDepth;
        changelogLines = [line];
        continue;
      }
      
      if (isInChangelogSection && headerDepth <= depth) {
        break;
      }
    }
    
    if (isInChangelogSection) {
      changelogLines.push(line);
    }
  }

  const changelogText = changelogLines.join('\n').trim();
  return changelogText.length > 200 ? changelogText : null;
}