interface RepositoryInfo {
  owner: string;
  repo: string;
  url: string;
  type: 'github' | 'gitlab' | 'bitbucket';
}

interface ChangelogSource {
  content: string;
  source: 'file' | 'releases' | 'commits' | 'readme';
  url?: string;
  confidence: number;
  lastModified?: string;
}

export class ChangelogDetector {
  private static CHANGELOG_FILENAMES = [
    'CHANGELOG.md',
    'CHANGELOG.rst', 
    'CHANGELOG.txt',
    'CHANGELOG',
    'CHANGES.md',
    'CHANGES.rst',
    'CHANGES.txt', 
    'CHANGES',
    'HISTORY.md',
    'HISTORY.rst',
    'HISTORY.txt',
    'HISTORY',
    'RELEASES.md',
    'RELEASES.rst',
    'RELEASES.txt',
    'RELEASES',
    'NEWS.md',
    'NEWS.rst',
    'NEWS.txt',
    'NEWS',
    'WHATSNEW.md',
    'WHATSNEW.rst',
    'docs/CHANGELOG.md',
    'docs/CHANGES.md',
    'docs/HISTORY.md',
    'docs/RELEASES.md',
    '.changeset/CHANGELOG.md',
    'UPGRADE.md',
    'MIGRATION.md',
  ];

  private static BRANCHES_TO_CHECK = [
    'main',
    'master', 
    'develop',
    'dev',
    'trunk',
    'HEAD'
  ];

  async detectChangelog(packageName: string): Promise<ChangelogSource[]> {
    const sources: ChangelogSource[] = [];
    
    const repoInfo = await this.extractRepositoryInfo(packageName);
    
    if (repoInfo) {
      const fileSources = await this.detectChangelogFiles(repoInfo);
      sources.push(...fileSources);
      
      const releaseSources = await this.detectGitHubReleases(repoInfo);
      sources.push(...releaseSources);
    }
    
    const readmeSources = await this.detectReadmeChangelog(packageName);
    sources.push(...readmeSources);
    
    return sources.sort((a, b) => b.confidence - a.confidence);
  }

  private async extractRepositoryInfo(packageName: string): Promise<RepositoryInfo | null> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'npm-changelog-analyzer/2.0.0',
          },
        }
      );

      if (!response.ok) return null;

      const packageInfo = await response.json();
      
      const urls = [
        packageInfo.repository?.url,
        packageInfo.homepage,
        packageInfo.bugs?.url,
      ].filter(Boolean);

      for (const url of urls) {
        const repoInfo = this.parseRepositoryUrl(url);
        if (repoInfo) return repoInfo;
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseRepositoryUrl(url: string): RepositoryInfo | null {
    const patterns = [
      {
        regex: /github\.com[\/:]([^\/]+)\/([^\/\s.]+)/i,
        type: 'github' as const,
      },
      {
        regex: /gitlab\.com[\/:]([^\/]+)\/([^\/\s.]+)/i,
        type: 'gitlab' as const,
      },
      {
        regex: /bitbucket\.org[\/:]([^\/]+)\/([^\/\s.]+)/i,
        type: 'bitbucket' as const,
      },
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern.regex);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
          url: url,
          type: pattern.type,
        };
      }
    }

    return null;
  }

  private async detectChangelogFiles(repoInfo: RepositoryInfo): Promise<ChangelogSource[]> {
    if (repoInfo.type !== 'github') return [];

    const sources: ChangelogSource[] = [];

    for (const branch of ChangelogDetector.BRANCHES_TO_CHECK) {
      for (const filename of ChangelogDetector.CHANGELOG_FILENAMES) {
        try {
          const url = `https://raw.githubusercontent.com/${repoInfo.owner}/${repoInfo.repo}/${branch}/${filename}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(url, {
            headers: {
              'User-Agent': 'npm-changelog-analyzer/2.0.0',
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const content = await response.text();
            const confidence = this.calculateFileConfidence(filename, content);
            
            if (confidence > 0.3) {
              sources.push({
                content,
                source: 'file',
                url,
                confidence,
                lastModified: response.headers.get('last-modified') || undefined,
              });
            }
          }
        } catch {
          continue;
        }
      }
      
      if (sources.length > 0) break;
    }

    return sources;
  }

  private async detectGitHubReleases(repoInfo: RepositoryInfo): Promise<ChangelogSource[]> {
    if (repoInfo.type !== 'github') return [];

    try {
      const url = `https://api.github.com/repos/${repoInfo.owner}/${repoInfo.repo}/releases`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'npm-changelog-analyzer/2.0.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) return [];

      const releases: Array<{ tag_name: string; published_at: string; name?: string; body: string; draft: boolean }> = await response.json();
      
      if (!Array.isArray(releases) || releases.length === 0) return [];

      const releaseContent = this.formatReleasesAsChangelog(releases);
      const confidence = this.calculateReleaseConfidence(releases);

      return [{
        content: releaseContent,
        source: 'releases',
        url,
        confidence,
      }];

    } catch {
      return [];
    }
  }

  private async detectReadmeChangelog(packageName: string): Promise<ChangelogSource[]> {
    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'npm-changelog-analyzer/2.0.0',
          },
        }
      );

      if (!response.ok) return [];

      const packageInfo = await response.json();
      
      if (!packageInfo.readme) return [];

      const changelogSection = this.extractChangelogFromReadme(packageInfo.readme);
      
      if (changelogSection) {
        const confidence = this.calculateReadmeConfidence(changelogSection);
        
        return [{
          content: changelogSection,
          source: 'readme',
          confidence,
        }];
      }

      return [];
    } catch {
      return [];
    }
  }

  private calculateFileConfidence(filename: string, content: string): number {
    let confidence = 0;

    const filenameScore = {
      'CHANGELOG.md': 1.0,
      'CHANGELOG.rst': 0.95,
      'CHANGELOG.txt': 0.9,
      'CHANGELOG': 0.85,
      'CHANGES.md': 0.8,
      'HISTORY.md': 0.75,
      'RELEASES.md': 0.7,
    };

    confidence = filenameScore[filename as keyof typeof filenameScore] || 0.5;

    if (content.length < 100) return 0;
    
    const hasVersionHeaders = /^#+\s*\[?v?\d+\.\d+/m.test(content);
    if (hasVersionHeaders) confidence += 0.2;

    const hasDateFormat = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/.test(content);
    if (hasDateFormat) confidence += 0.1;

    const hasChangeKeywords = /(?:add|fix|change|remove|deprecat|break)/i.test(content);
    if (hasChangeKeywords) confidence += 0.1;

    const hasKeepAChangelogFormat = /## \[Unreleased\]|keepachangelog\.com/.test(content);
    if (hasKeepAChangelogFormat) confidence += 0.15;

    return Math.min(confidence, 1.0);
  }

  private calculateReleaseConfidence(releases: Array<{ body: string }>): number {
    const releasesWithContent = releases.filter(r => r.body && r.body.trim().length > 20);
    const ratio = releasesWithContent.length / Math.min(releases.length, 20);
    
    const avgContentLength = releasesWithContent.reduce((sum, r) => sum + r.body.length, 0) / releasesWithContent.length;
    
    let confidence = ratio * 0.6;
    
    if (avgContentLength > 100) confidence += 0.2;
    if (avgContentLength > 500) confidence += 0.1;
    
    const hasStructuredContent = releasesWithContent.some(r => 
      /(?:breaking|feat|fix|add|remove)/i.test(r.body)
    );
    if (hasStructuredContent) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private calculateReadmeConfidence(content: string): number {
    let confidence = 0.3;

    if (content.length > 500) confidence += 0.1;
    if (content.length > 1000) confidence += 0.1;

    const hasVersionHeaders = /^#+.*\d+\.\d+/m.test(content);
    if (hasVersionHeaders) confidence += 0.2;

    const hasStructuredContent = /(?:breaking|feat|fix|add|remove)/i.test(content);
    if (hasStructuredContent) confidence += 0.1;

    return Math.min(confidence, 0.7);
  }

  private formatReleasesAsChangelog(releases: Array<{ tag_name: string; published_at: string; name?: string; body: string; draft: boolean }>): string {
    return releases
      .filter(release => !release.draft && release.body)
      .slice(0, 50)
      .map(release => {
        const version = release.tag_name.replace(/^v/, '');
        const date = new Date(release.published_at).toISOString().split('T')[0];
        const title = release.name || `Release ${version}`;
        
        return `## [${version}] - ${date}\n\n### ${title}\n\n${release.body}\n`;
      })
      .join('\n');
  }

  private extractChangelogFromReadme(readme: string): string | null {
    const lines = readme.split('\n');
    let isInChangelogSection = false;
    let changelogLines: string[] = [];
    let depth = 0;

    for (const line of lines) {
      const headerMatch = line.match(/^(#+)\s*(.*)/);
      
      if (headerMatch) {
        const headerDepth = headerMatch[1].length;
        const headerText = headerMatch[2].toLowerCase();
        
        if (this.isChangelogHeader(headerText)) {
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

  private isChangelogHeader(headerText: string): boolean {
    const changelogKeywords = [
      'changelog',
      'changes',
      'change log',
      'history',
      'releases',
      'release notes',
      'release history',
      'version history',
      'versions',
      'what\'s new',
      'whats new',
      'news',
      'updates',
    ];

    return changelogKeywords.some(keyword => 
      headerText.includes(keyword)
    );
  }
}