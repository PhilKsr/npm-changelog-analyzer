export interface ChangelogItem {
  version: string;
  content: string;
  type: 'breaking' | 'feature' | 'fix' | 'other';
}

export interface ParsedChangelog {
  breakingChanges: ChangelogItem[];
  newFeatures: ChangelogItem[];
  raw: string;
}

const BREAKING_CHANGE_KEYWORDS = [
  'breaking',
  'breaking change',
  'breaking changes',
  'backwards incompatible',
  'incompatible',
  'deprecated',
  'removed',
  'no longer',
  'breaking:',
  'BREAKING CHANGE',
  'BREAKING:',
];

const FEATURE_KEYWORDS = [
  'feat',
  'feature',
  'features',
  'new',
  'add',
  'added',
  'adds',
  'introduce',
  'introduced',
  'feat:',
  'feature:',
  'new:',
];

export function parseChangelog(
  changelogText: string,
  startVersion: string,
  endVersion: string
): ParsedChangelog {
  const breakingChanges: ChangelogItem[] = [];
  const newFeatures: ChangelogItem[] = [];

  if (!changelogText) {
    return {
      breakingChanges,
      newFeatures,
      raw: '',
    };
  }

  const versionBlocks = extractVersionBlocks(changelogText, startVersion, endVersion);
  
  for (const block of versionBlocks) {
    const items = parseVersionBlock(block);
    
    for (const item of items) {
      if (item.type === 'breaking') {
        breakingChanges.push(item);
      } else if (item.type === 'feature') {
        newFeatures.push(item);
      }
    }
  }

  return {
    breakingChanges,
    newFeatures,
    raw: changelogText,
  };
}

function extractVersionBlocks(
  changelogText: string,
  startVersion: string,
  endVersion: string
): Array<{ version: string; content: string }> {
  const lines = changelogText.split('\n');
  const blocks: Array<{ version: string; content: string }> = [];
  
  let currentVersion = '';
  let currentContent: string[] = [];
  let isInRelevantRange = false;

  const normalizeVersion = (version: string) => {
    return version.replace(/^v?/, '').replace(/[^\d.]/g, '');
  };

  const normalizedStart = normalizeVersion(startVersion);
  const normalizedEnd = normalizeVersion(endVersion);

  for (const line of lines) {
    const versionMatch = line.match(/^#+\s*(?:\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?|\[(\d+\.\d+\.\d+[^\]]*)\])/i);
    
    if (versionMatch) {
      if (currentVersion && isInRelevantRange && currentContent.length > 0) {
        blocks.push({
          version: currentVersion,
          content: currentContent.join('\n').trim(),
        });
      }

      const foundVersion = normalizeVersion(versionMatch[1] || versionMatch[2] || '');
      currentVersion = foundVersion;
      currentContent = [];

      isInRelevantRange = isVersionInRange(foundVersion, normalizedStart, normalizedEnd);
    } else if (isInRelevantRange && line.trim()) {
      currentContent.push(line);
    }
  }

  if (currentVersion && isInRelevantRange && currentContent.length > 0) {
    blocks.push({
      version: currentVersion,
      content: currentContent.join('\n').trim(),
    });
  }

  return blocks;
}

function isVersionInRange(version: string, startVersion: string, endVersion: string): boolean {
  const parseVersion = (v: string) => v.split('.').map(n => parseInt(n) || 0);
  
  const versionParts = parseVersion(version);
  const startParts = parseVersion(startVersion);
  const endParts = parseVersion(endVersion);

  const compareVersions = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const aPart = a[i] || 0;
      const bPart = b[i] || 0;
      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }
    return 0;
  };

  return compareVersions(versionParts, startParts) > 0 && 
         compareVersions(versionParts, endParts) <= 0;
}

function parseVersionBlock(block: { version: string; content: string }): ChangelogItem[] {
  const items: ChangelogItem[] = [];
  const lines = block.content.split('\n');

  let currentItem = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    if (trimmedLine.match(/^[-*+]\s/)) {
      if (currentItem) {
        const item = createChangelogItem(currentItem, block.version);
        if (item) items.push(item);
      }
      currentItem = trimmedLine.replace(/^[-*+]\s/, '').trim();
    } else {
      currentItem += ' ' + trimmedLine;
    }
  }

  if (currentItem) {
    const item = createChangelogItem(currentItem, block.version);
    if (item) items.push(item);
  }

  if (items.length === 0 && block.content.trim()) {
    const paragraphs = block.content.split('\n\n').filter(p => p.trim());
    for (const paragraph of paragraphs) {
      const item = createChangelogItem(paragraph.trim(), block.version);
      if (item) items.push(item);
    }
  }

  return items;
}

function createChangelogItem(content: string, version: string): ChangelogItem | null {
  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length < 10) {
    return null;
  }

  const lowerContent = cleanContent.toLowerCase();
  let type: 'breaking' | 'feature' | 'fix' | 'other' = 'other';

  for (const keyword of BREAKING_CHANGE_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      type = 'breaking';
      break;
    }
  }

  if (type === 'other') {
    for (const keyword of FEATURE_KEYWORDS) {
      if (lowerContent.includes(keyword.toLowerCase())) {
        type = 'feature';
        break;
      }
    }
  }

  if (type === 'other' && lowerContent.includes('fix')) {
    type = 'fix';
  }

  if (type === 'breaking' || type === 'feature') {
    return {
      version,
      content: cleanContent,
      type,
    };
  }

  return null;
}