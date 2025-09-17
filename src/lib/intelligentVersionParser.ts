// import { marked } from 'marked';

export interface VersionBlock {
  version: string;
  rawVersion: string;
  date?: Date;
  rawDate?: string;
  content: string;
  format: ChangelogFormat;
  headerLevel: number;
  isPrerelease: boolean;
  isUnreleased: boolean;
  semanticVersion: SemanticVersion;
}

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
}

export enum ChangelogFormat {
  KEEP_A_CHANGELOG = 'keep-a-changelog',
  CONVENTIONAL_COMMITS = 'conventional-commits',
  GITHUB_RELEASES = 'github-releases',
  CUSTOM_MARKDOWN = 'custom-markdown',
  PLAIN_TEXT = 'plain-text',
  ANGULAR = 'angular',
  SEMANTIC_RELEASE = 'semantic-release',
}

export class IntelligentVersionParser {
  private static VERSION_PATTERNS = [
    // Keep a Changelog format: ## [1.0.0] - 2023-05-15
    /^(#+)\s*\[([^\]]+)\]\s*-\s*(.+)$/,
    // Monorepo/prefixed format: ## [package-name-v1.0.0] - 2023-05-15
    /^(#+)\s*\[[^\]]*?-?v?(\d+\.\d+\.\d+[^\]]*?)\]\s*-\s*(.+)$/,
    // Standard markdown: ## v1.0.0 (2023-05-15)
    /^(#+)\s*v?(\d+\.\d+\.\d+[^\s]*)\s*(?:\(([^)]+)\)|(.*))?$/,
    // Release format: # Release 1.0.0 - May 15, 2023
    /^(#+)\s*(?:Release|Version)\s+v?(\d+\.\d+\.\d+[^\s]*)\s*(?:-\s*(.+))?$/i,
    // Simple format: ## 1.0.0
    /^(#+)\s*(\d+\.\d+\.\d+[^\s]*)(?:\s+(.+))?$/,
    // GitHub releases: ## 1.0.0 (Latest)
    /^(#+)\s*(\d+\.\d+\.\d+[^\s]*)\s*(?:\(([^)]+)\))?$/,
    // Date first: ## 2023-05-15: Version 1.0.0
    /^(#+)\s*(\d{4}-\d{2}-\d{2}):\s*(?:Version\s+)?v?(\d+\.\d+\.\d+[^\s]*)$/i,
  ];

  private static DATE_PATTERNS = [
    // ISO format: 2023-05-15
    /(\d{4}-\d{2}-\d{2})/,
    // US format: 05/15/2023 or 5/15/2023
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    // European format: 15/05/2023 or 15.05.2023
    /(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{4})/,
    // Long format: May 15, 2023
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4})/i,
    // Medium format: 15 May 2023
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i,
    // Relative: "2 days ago", "1 week ago"
    /((?:\d+\s+(?:days?|weeks?|months?|years?)\s+ago))/i,
  ];

  static parseVersionBlocks(
    changelogContent: string,
    startVersion: string,
    endVersion: string
  ): VersionBlock[] {
    const format = this.detectChangelogFormat(changelogContent);
    const allBlocks = this.extractAllVersionBlocks(changelogContent, format);
    
    return this.filterVersionRange(allBlocks, startVersion, endVersion);
  }

  private static detectChangelogFormat(content: string): ChangelogFormat {
    const lines = content.split('\n').slice(0, 50);
    const joinedContent = lines.join('\n').toLowerCase();

    if (joinedContent.includes('keepachangelog.com') || 
        joinedContent.includes('## [unreleased]') ||
        /## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}/.test(content)) {
      return ChangelogFormat.KEEP_A_CHANGELOG;
    }

    if (joinedContent.includes('conventional commits') ||
        /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(content)) {
      return ChangelogFormat.CONVENTIONAL_COMMITS;
    }

    if (joinedContent.includes('semantic-release') ||
        /## \[\d+\.\d+\.\d+\]\([^)]+\) \(\d{4}-\d{2}-\d{2}\)/.test(content)) {
      return ChangelogFormat.SEMANTIC_RELEASE;
    }

    if (/^## Release \d+\.\d+\.\d+/m.test(content)) {
      return ChangelogFormat.GITHUB_RELEASES;
    }

    if (/^#+\s*\d+\.\d+\.\d+/m.test(content)) {
      return ChangelogFormat.CUSTOM_MARKDOWN;
    }

    if (content.includes('<a name=') || content.includes('### ')) {
      return ChangelogFormat.ANGULAR;
    }

    return content.includes('#') ? ChangelogFormat.CUSTOM_MARKDOWN : ChangelogFormat.PLAIN_TEXT;
  }

  private static extractAllVersionBlocks(content: string, format: ChangelogFormat): VersionBlock[] {
    const lines = content.split('\n');
    const blocks: VersionBlock[] = [];
    
    let currentBlock: Partial<VersionBlock> | null = null;
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const versionMatch = this.matchVersionHeader(line);

      if (versionMatch) {
        const { version, date, headerLevel } = versionMatch;
        const semanticVersion = this.parseSemanticVersion(version);
        
        // If we already have a current block with the same version, skip this duplicate header
        if (currentBlock && currentBlock.semanticVersion?.raw === semanticVersion.raw) {
          currentContent.push(line);
          continue;
        }
        
        // Save the previous block if it exists
        if (currentBlock && currentContent.length > 0) {
          blocks.push({
            ...currentBlock,
            content: currentContent.join('\n').trim(),
          } as VersionBlock);
        }
        
        currentBlock = {
          version: semanticVersion.raw,
          rawVersion: version,
          date,
          headerLevel,
          format,
          isPrerelease: !!semanticVersion.prerelease,
          isUnreleased: version.toLowerCase().includes('unreleased'),
          semanticVersion,
        };
        currentContent = [];
      } else if (currentBlock) {
        const isNextHeader = this.isHeaderOfSameOrHigherLevel(line, currentBlock.headerLevel || 2);
        if (isNextHeader) {
          if (currentContent.length > 0) {
            blocks.push({
              ...currentBlock,
              content: currentContent.join('\n').trim(),
            } as VersionBlock);
          }
          currentBlock = null;
          currentContent = [];
          i--; // Reprocess this line as it might be a version header
        } else {
          currentContent.push(line);
        }
      }
    }

    if (currentBlock && currentContent.length > 0) {
      blocks.push({
        ...currentBlock,
        content: currentContent.join('\n').trim(),
      } as VersionBlock);
    }

    return blocks;
  }

  private static matchVersionHeader(line: string): { 
    version: string; 
    date?: Date; 
    headerLevel: number 
  } | null {
    for (const pattern of this.VERSION_PATTERNS) {
      const match = line.match(pattern);
      if (match) {
        const headerLevel = match[1]?.length || 2;
        let version = '';
        let dateStr = '';

        if (pattern === this.VERSION_PATTERNS[0]) {
          // Keep a Changelog format
          version = match[2];
          dateStr = match[3];
        } else if (pattern === this.VERSION_PATTERNS[5]) {
          // Date first format
          dateStr = match[2];
          version = match[3];
        } else {
          // Other formats
          version = match[2];
          dateStr = match[3] || match[4] || '';
        }

        const date = this.parseDate(dateStr);
        
        if (this.isValidVersion(version)) {
          return { version, date, headerLevel };
        }
      }
    }

    return null;
  }

  private static parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;

    for (const pattern of this.DATE_PATTERNS) {
      const match = dateStr.match(pattern);
      if (match) {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
        }
      }
    }

    const fallbackDate = new Date(dateStr);
    return !isNaN(fallbackDate.getTime()) ? fallbackDate : undefined;
  }

  static parseSemanticVersion(version: string): SemanticVersion {
    const cleanVersion = version.replace(/^v/, '').replace(/[^\d.a-zA-Z-+]/g, '');
    
    const parts = cleanVersion.split('.');
    const major = parseInt(parts[0]) || 0;
    const minor = parseInt(parts[1]) || 0;
    
    let patch = 0;
    let prerelease: string | undefined;
    let build: string | undefined;

    if (parts[2]) {
      const patchParts = parts[2].split(/[-+]/);
      patch = parseInt(patchParts[0]) || 0;
      
      if (patchParts.length > 1) {
        const remaining = patchParts.slice(1).join('-');
        if (remaining.includes('+')) {
          const [pre, bld] = remaining.split('+');
          prerelease = pre;
          build = bld;
        } else {
          prerelease = remaining;
        }
      }
    }

    return {
      major,
      minor,
      patch,
      prerelease,
      build,
      raw: `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}${build ? `+${build}` : ''}`,
    };
  }

  private static isValidVersion(version: string): boolean {
    const cleanVersion = version.replace(/^v/, '');
    return /^\d+\.\d+/.test(cleanVersion);
  }

  private static isHeaderOfSameOrHigherLevel(line: string, currentLevel: number): boolean {
    const headerMatch = line.match(/^(#+)/);
    if (!headerMatch) return false;
    
    const headerLevel = headerMatch[1].length;
    
    // Only consider it a section break if it's at a higher level (lower number) than current level
    // OR if it's the same level AND it matches a version pattern (indicating a new version section)
    if (headerLevel < currentLevel) {
      return true;
    }
    
    if (headerLevel === currentLevel) {
      // Check if this line is a version header
      return this.matchVersionHeader(line) !== null;
    }
    
    return false;
  }

  private static filterVersionRange(
    blocks: VersionBlock[],
    startVersion: string,
    endVersion: string
  ): VersionBlock[] {
    const start = this.parseSemanticVersion(startVersion);
    const end = this.parseSemanticVersion(endVersion);

    return blocks.filter(block => {
      if (block.isUnreleased) return false;
      
      const blockVersion = block.semanticVersion;
      
      const isAfterOrEqualStart = this.compareVersions(blockVersion, start) >= 0;
      const isBeforeOrEqualEnd = this.compareVersions(blockVersion, end) <= 0;
      
      return isAfterOrEqualStart && isBeforeOrEqualEnd;
    }).sort((a, b) => this.compareVersions(b.semanticVersion, a.semanticVersion));
  }

  private static compareVersions(a: SemanticVersion, b: SemanticVersion): number {
    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    if (a.patch !== b.patch) return a.patch - b.patch;
    
    if (a.prerelease && !b.prerelease) return -1;
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease && b.prerelease) {
      return a.prerelease.localeCompare(b.prerelease);
    }
    
    return 0;
  }

  static analyzeVersionChanges(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion
  ): {
    type: 'major' | 'minor' | 'patch' | 'prerelease';
    isMajorBreaking: boolean;
    isMinorBreaking: boolean;
    complexity: 'low' | 'medium' | 'high';
  } {
    let type: 'major' | 'minor' | 'patch' | 'prerelease' = 'patch';
    
    if (toVersion.major > fromVersion.major) {
      type = 'major';
    } else if (toVersion.minor > fromVersion.minor) {
      type = 'minor';
    } else if (toVersion.prerelease || fromVersion.prerelease) {
      type = 'prerelease';
    }

    const majorDiff = toVersion.major - fromVersion.major;
    const minorDiff = toVersion.minor - fromVersion.minor;
    
    const isMajorBreaking = majorDiff > 0;
    const isMinorBreaking = majorDiff === 0 && minorDiff > 3;
    
    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (isMajorBreaking && majorDiff > 1) {
      complexity = 'high';
    } else if (isMajorBreaking || isMinorBreaking) {
      complexity = 'medium';
    }

    return {
      type,
      isMajorBreaking,
      isMinorBreaking,
      complexity,
    };
  }
}