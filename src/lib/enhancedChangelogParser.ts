export interface ChangelogEntry {
  version: string;
  content: string;
  type: 'breaking' | 'feature' | 'fix' | 'security' | 'performance' | 'documentation' | 'other';
  category: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  raw: string;
  publishedAt?: string;
}

export interface AnalyzedChangelog {
  breakingChanges: ChangelogEntry[];
  newFeatures: ChangelogEntry[];
  bugFixes: ChangelogEntry[];
  securityFixes: ChangelogEntry[];
  performanceImprovements: ChangelogEntry[];
  documentation: ChangelogEntry[];
  other: ChangelogEntry[];
  summary: {
    totalChanges: number;
    breakingChangesCount: number;
    newFeaturesCount: number;
    riskScore: number;
    upgradeComplexity: 'low' | 'medium' | 'high';
  };
  raw: string;
  source: 'github-changelog' | 'github-releases' | 'npm-readme' | 'commit-messages';
}

const BREAKING_PATTERNS = [
  /\b(?:breaking|incompatible|removed?|deprecated?|no\s+longer|breaking[:;])/i,
  /\b(?:major\s+change|backwards?\s+incompatible|api\s+change)/i,
  /\b(?:migration\s+(?:required|needed|guide)|upgrade\s+(?:required|needed))/i,
  /\b(?:BREAKING\s*(?:CHANGE|:)|breaking[:;])/,
  /^[-*+]\s*\*\*breaking\*\*/i,
  /\[breaking\]/i,
];

const FEATURE_PATTERNS = [
  /\b(?:add(?:ed|s)?|new|introduce[ds]?|implement(?:ed|s)?|feature)/i,
  /\b(?:support\s+for|enable[ds]?|allow[eds]?)/i,
  /\b(?:feat(?:ure)?[:;]|new[:;])/i,
  /^[-*+]\s*\*\*(?:new|feature|added?)\*\*/i,
  /\[(?:feat|feature|new)\]/i,
];

const FIX_PATTERNS = [
  /\b(?:fix(?:ed|es)?|resolve[ds]?|correct(?:ed|s)?|repair(?:ed|s)?)/i,
  /\b(?:bug\s*fix|issue\s*fix|patch(?:ed)?)/i,
  /\b(?:fix[:;]|fixes[:;]|bugfix[:;])/i,
  /^[-*+]\s*\*\*(?:fix|fixed|bugfix)\*\*/i,
  /\[(?:fix|bugfix|patch)\]/i,
];

const SECURITY_PATTERNS = [
  /\b(?:security|vulnerability|exploit|CVE[-\s]?\d+)/i,
  /\b(?:sanitiz(?:e|ed|ing)|escape[ds]?|xss|csrf|injection)/i,
  /\b(?:auth(?:entication|orization)|permission[s]?|access\s+control)/i,
  /\[security\]/i,
];

const PERFORMANCE_PATTERNS = [
  /\b(?:performance|optimi[sz](?:e|ed|ation)|faster|speed|efficiency)/i,
  /\b(?:cache|caching|memory|cpu|benchmark)/i,
  /\b(?:reduce[ds]?\s+(?:size|time|memory)|improve[ds]?\s+(?:speed|performance))/i,
  /\[(?:perf|performance)\]/i,
];

const DOCUMENTATION_PATTERNS = [
  /\b(?:doc(?:umentation|s)?|readme|guide|tutorial|example[s]?)/i,
  /\b(?:comment[s]?|jsdoc|api\s+doc|changelog)/i,
  /\[(?:docs?|documentation)\]/i,
];

export function analyzeChangelog(
  changelogText: string,
  startVersion: string,
  endVersion: string,
  source: AnalyzedChangelog['source'] = 'github-changelog'
): AnalyzedChangelog {
  const entries = extractAndAnalyzeEntries(changelogText, startVersion, endVersion);
  
  const breakingChanges = entries.filter(e => e.type === 'breaking');
  const newFeatures = entries.filter(e => e.type === 'feature');
  const bugFixes = entries.filter(e => e.type === 'fix');
  const securityFixes = entries.filter(e => e.type === 'security');
  const performanceImprovements = entries.filter(e => e.type === 'performance');
  const documentation = entries.filter(e => e.type === 'documentation');
  const other = entries.filter(e => e.type === 'other');

  const riskScore = calculateRiskScore(entries);
  const upgradeComplexity = determineUpgradeComplexity(entries, riskScore);

  return {
    breakingChanges,
    newFeatures,
    bugFixes,
    securityFixes,
    performanceImprovements,
    documentation,
    other,
    summary: {
      totalChanges: entries.length,
      breakingChangesCount: breakingChanges.length,
      newFeaturesCount: newFeatures.length,
      riskScore,
      upgradeComplexity,
    },
    raw: changelogText,
    source,
  };
}

function extractAndAnalyzeEntries(
  changelogText: string,
  startVersion: string,
  endVersion: string
): ChangelogEntry[] {
  const versionBlocks = extractVersionBlocks(changelogText, startVersion, endVersion);
  const entries: ChangelogEntry[] = [];

  for (const block of versionBlocks) {
    const blockEntries = parseVersionBlock(block);
    entries.push(...blockEntries);
  }

  return entries;
}

function extractVersionBlocks(
  changelogText: string,
  startVersion: string,
  endVersion: string
): Array<{ version: string; content: string; publishedAt?: string }> {
  const lines = changelogText.split('\n');
  const blocks: Array<{ version: string; content: string; publishedAt?: string }> = [];
  
  let currentVersion = '';
  let currentContent: string[] = [];
  let currentDate: string | undefined;
  let isInRelevantRange = false;

  const normalizeVersion = (version: string) => {
    return version.replace(/^v?/, '').replace(/[^\d.]/g, '');
  };

  const normalizedStart = normalizeVersion(startVersion);
  const normalizedEnd = normalizeVersion(endVersion);

  for (const line of lines) {
    const versionMatch = line.match(
      /^#+\s*(?:\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?|\[(\d+\.\d+\.\d+[^\]]*)\])|^##?\s*(\d+\.\d+\.\d+)/i
    );
    
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{1,2}\s+\w+\s+\d{4})/);
    
    if (versionMatch) {
      if (currentVersion && isInRelevantRange && currentContent.length > 0) {
        blocks.push({
          version: currentVersion,
          content: currentContent.join('\n').trim(),
          publishedAt: currentDate,
        });
      }

      const foundVersion = normalizeVersion(versionMatch[1] || versionMatch[2] || versionMatch[3] || '');
      currentVersion = foundVersion;
      currentContent = [];
      currentDate = dateMatch?.[1];

      isInRelevantRange = isVersionInRange(foundVersion, normalizedStart, normalizedEnd);
    } else if (isInRelevantRange) {
      if (dateMatch && !currentDate) {
        currentDate = dateMatch[1];
      }
      if (line.trim()) {
        currentContent.push(line);
      }
    }
  }

  if (currentVersion && isInRelevantRange && currentContent.length > 0) {
    blocks.push({
      version: currentVersion,
      content: currentContent.join('\n').trim(),
      publishedAt: currentDate,
    });
  }

  return blocks;
}

function parseVersionBlock(block: {
  version: string;
  content: string;
  publishedAt?: string;
}): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  const lines = block.content.split('\n');

  let currentItem = '';
  let currentIndent = 0;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s(.+)$/);
    
    if (listMatch) {
      if (currentItem) {
        const entry = analyzeChangelogEntry(currentItem, block.version, block.publishedAt);
        if (entry) entries.push(entry);
      }
      
      currentIndent = listMatch[1].length;
      currentItem = listMatch[3].trim();
    } else if (line.startsWith(' '.repeat(currentIndent + 2))) {
      currentItem += ' ' + trimmedLine;
    } else if (trimmedLine && !currentItem) {
      currentItem = trimmedLine;
    }
  }

  if (currentItem) {
    const entry = analyzeChangelogEntry(currentItem, block.version, block.publishedAt);
    if (entry) entries.push(entry);
  }

  if (entries.length === 0 && block.content.trim()) {
    const paragraphs = block.content.split(/\n\s*\n/).filter(p => p.trim());
    for (const paragraph of paragraphs) {
      const entry = analyzeChangelogEntry(paragraph.trim(), block.version, block.publishedAt);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

function analyzeChangelogEntry(
  content: string,
  version: string,
  publishedAt?: string
): ChangelogEntry | null {
  const cleanContent = content.trim();
  if (!cleanContent || cleanContent.length < 5) {
    return null;
  }

  const analysis = classifyChange(cleanContent);
  
  return {
    version,
    content: cleanContent,
    type: analysis.type,
    category: analysis.category,
    severity: analysis.severity,
    confidence: analysis.confidence,
    raw: cleanContent,
    publishedAt,
  };
}

function classifyChange(content: string): {
  type: ChangelogEntry['type'];
  category: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
} {
  let maxConfidence = 0;
  let bestType: ChangelogEntry['type'] = 'other';
  let category = 'General';
  
  const checks = [
    { patterns: BREAKING_PATTERNS, type: 'breaking' as const, category: 'Breaking Changes', baseConfidence: 0.9 },
    { patterns: SECURITY_PATTERNS, type: 'security' as const, category: 'Security', baseConfidence: 0.95 },
    { patterns: FEATURE_PATTERNS, type: 'feature' as const, category: 'Features', baseConfidence: 0.8 },
    { patterns: FIX_PATTERNS, type: 'fix' as const, category: 'Bug Fixes', baseConfidence: 0.7 },
    { patterns: PERFORMANCE_PATTERNS, type: 'performance' as const, category: 'Performance', baseConfidence: 0.75 },
    { patterns: DOCUMENTATION_PATTERNS, type: 'documentation' as const, category: 'Documentation', baseConfidence: 0.6 },
  ];

  for (const check of checks) {
    for (const pattern of check.patterns) {
      const match = content.match(pattern);
      if (match) {
        let confidence = check.baseConfidence;
        
        if (match.index === 0 || content.startsWith('**')) {
          confidence += 0.1;
        }
        
        if (content.includes('!') || content.includes('BREAKING')) {
          confidence += 0.05;
        }
        
        if (confidence > maxConfidence) {
          maxConfidence = confidence;
          bestType = check.type;
          category = check.category;
        }
      }
    }
  }

  const severity = determineSeverity(bestType, content, maxConfidence);
  
  return {
    type: bestType,
    category,
    severity,
    confidence: Math.min(maxConfidence, 1),
  };
}

function determineSeverity(
  type: ChangelogEntry['type'],
  content: string,
  confidence: number
): 'high' | 'medium' | 'low' {
  if (type === 'breaking' || type === 'security') {
    return 'high';
  }
  
  if (type === 'feature' && confidence > 0.8) {
    return 'medium';
  }
  
  if (content.includes('major') || content.includes('significant') || content.includes('important')) {
    return 'medium';
  }
  
  return 'low';
}

function calculateRiskScore(entries: ChangelogEntry[]): number {
  let score = 0;
  
  for (const entry of entries) {
    switch (entry.type) {
      case 'breaking':
        score += 10 * entry.confidence;
        break;
      case 'security':
        score += 8 * entry.confidence;
        break;
      case 'feature':
        score += 3 * entry.confidence;
        break;
      case 'performance':
        score += 2 * entry.confidence;
        break;
      case 'fix':
        score += 1 * entry.confidence;
        break;
    }
  }
  
  return Math.min(Math.round(score), 100);
}

function determineUpgradeComplexity(
  entries: ChangelogEntry[],
  riskScore: number
): 'low' | 'medium' | 'high' {
  const breakingChanges = entries.filter(e => e.type === 'breaking').length;
  
  if (breakingChanges > 3 || riskScore > 50) {
    return 'high';
  }
  
  if (breakingChanges > 0 || riskScore > 20) {
    return 'medium';
  }
  
  return 'low';
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