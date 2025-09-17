import { NextRequest, NextResponse } from 'next/server';
import { parseChangelog } from '@/lib/changelogParser';

interface NpmPackageInfo {
  name: string;
  repository?: {
    type: string;
    url: string;
  };
  homepage?: string;
  bugs?: {
    url: string;
  };
}

interface GitHubRepo {
  owner: string;
  repo: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const packageName = searchParams.get('package');
  const startVersion = searchParams.get('start');
  const endVersion = searchParams.get('end');

  if (!packageName || !startVersion || !endVersion) {
    return NextResponse.json(
      { error: 'Package name, start version, and end version are required' },
      { status: 400 }
    );
  }

  try {
    const changelogText = await fetchChangelog(packageName);
    const parsedChangelog = parseChangelog(changelogText, startVersion, endVersion);

    return NextResponse.json(parsedChangelog);
  } catch (error) {
    console.error('Error fetching changelog:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch changelog',
        message: error instanceof Error ? error.message : 'Unknown error',
        breakingChanges: [],
        newFeatures: [],
        raw: '',
      },
      { status: 500 }
    );
  }
}

async function fetchChangelog(packageName: string): Promise<string> {
  const gitHubRepo = await getGitHubRepo(packageName);
  
  if (gitHubRepo) {
    const changelogFromGitHub = await fetchChangelogFromGitHub(gitHubRepo);
    if (changelogFromGitHub) {
      return changelogFromGitHub;
    }
  }

  const changelogFromNpm = await fetchChangelogFromNpm(packageName);
  if (changelogFromNpm) {
    return changelogFromNpm;
  }

  throw new Error('Could not find changelog for this package');
}

async function getGitHubRepo(packageName: string): Promise<GitHubRepo | null> {
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

    if (!response.ok) {
      return null;
    }

    const packageInfo: NpmPackageInfo = await response.json();
    
    const repoUrl = packageInfo.repository?.url || packageInfo.homepage || packageInfo.bugs?.url;
    
    if (!repoUrl) {
      return null;
    }

    const githubMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\s.]+)/i);
    
    if (githubMatch) {
      return {
        owner: githubMatch[1],
        repo: githubMatch[2].replace(/\.git$/, ''),
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching package info:', error);
    return null;
  }
}

async function fetchChangelogFromGitHub(repo: GitHubRepo): Promise<string | null> {
  const possibleFilenames = [
    'CHANGELOG.md',
    'CHANGELOG.rst',
    'CHANGELOG.txt',
    'CHANGELOG',
    'HISTORY.md',
    'HISTORY.rst',
    'HISTORY.txt',
    'HISTORY',
    'RELEASES.md',
    'RELEASES.rst',
    'NEWS.md',
    'NEWS.rst',
    'CHANGES.md',
    'CHANGES.rst',
  ];

  for (const filename of possibleFilenames) {
    try {
      const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/main/${filename}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'npm-changelog-analyzer/1.0.0',
        },
      });

      if (response.ok) {
        const content = await response.text();
        if (content.trim().length > 100) {
          return content;
        }
      }
    } catch {
      continue;
    }

    try {
      const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/master/${filename}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'npm-changelog-analyzer/1.0.0',
        },
      });

      if (response.ok) {
        const content = await response.text();
        if (content.trim().length > 100) {
          return content;
        }
      }
    } catch {
      continue;
    }
  }

  try {
    const releasesUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases`;
    const response = await fetch(releasesUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
    });

    if (response.ok) {
      const releases = await response.json();
      if (Array.isArray(releases) && releases.length > 0) {
        const changelogEntries = releases
          .filter(release => release.body && release.body.trim().length > 20)
          .map(release => {
            const version = release.tag_name.replace(/^v/, '');
            return `## ${version}\n\n${release.body}\n`;
          });

        if (changelogEntries.length > 0) {
          return changelogEntries.join('\n');
        }
      }
    }
  } catch {
    // Error fetching GitHub releases
  }

  return null;
}

async function fetchChangelogFromNpm(packageName: string): Promise<string | null> {
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

    if (!response.ok) {
      return null;
    }

    const packageInfo = await response.json();
    
    if (packageInfo.readme && packageInfo.readme.toLowerCase().includes('changelog')) {
      const changelogSection = extractChangelogFromReadme(packageInfo.readme);
      if (changelogSection) {
        return changelogSection;
      }
    }

    return null;
  } catch {
    // Error fetching npm package info
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
      
      if (headerText.includes('changelog') || 
          headerText.includes('changes') || 
          headerText.includes('history') || 
          headerText.includes('releases')) {
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