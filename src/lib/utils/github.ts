export interface GitHubRepo {
  owner: string;
  name: string;
}

export function parseGitHubUrl(url: string): GitHubRepo | null {
  const patterns = [
    /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/,
    /^([^/]+)\/([^/]+)$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { owner: match[1], name: match[2] };
    }
  }
  
  return null;
}

export async function fetchGitHubFileContent(
  repo: GitHubRepo, 
  filepath: string
): Promise<string | null> {
  try {
    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/contents/${filepath}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3.raw',
        'User-Agent': 'npm-changelog-analyzer'
      }
    });
    
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function fetchReleases(repo: GitHubRepo): Promise<any[]> {
  try {
    const apiUrl = `https://api.github.com/repos/${repo.owner}/${repo.name}/releases`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'npm-changelog-analyzer',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function fetchChangelogFromGitHub(repoUrl: string): Promise<string | null> {
  const repo = parseGitHubUrl(repoUrl);
  if (!repo) return null;
  
  const possibleFiles = [
    'CHANGELOG.md',
    'changelog.md',
    'HISTORY.md',
    'history.md',
    'CHANGES.md',
    'changes.md',
    'NEWS.md',
    'news.md',
    'RELEASES.md',
    'releases.md'
  ];
  
  for (const file of possibleFiles) {
    const content = await fetchGitHubFileContent(repo, file);
    if (content) return content;
  }
  
  return null;
}