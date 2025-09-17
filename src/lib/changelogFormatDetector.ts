export interface ChangelogFormat {
  type: ChangelogFormatType;
  confidence: number;
  characteristics: FormatCharacteristics;
  parsingRules: ParsingRules;
}

export enum ChangelogFormatType {
  KEEP_A_CHANGELOG = 'keep-a-changelog',
  CONVENTIONAL_COMMITS = 'conventional-commits',
  ANGULAR = 'angular',
  SEMANTIC_RELEASE = 'semantic-release',
  GITHUB_RELEASES = 'github-releases',
  GITLAB_RELEASES = 'gitlab-releases',
  CUSTOM_SECTIONS = 'custom-sections',
  CHRONOLOGICAL = 'chronological',
  GROUPED_CHANGES = 'grouped-changes',
  PLAIN_TEXT = 'plain-text',
  UNKNOWN = 'unknown',
}

export interface FormatCharacteristics {
  hasVersionHeaders: boolean;
  hasDateFormat: boolean;
  hasChangeCategories: boolean;
  hasLinks: boolean;
  headerPattern?: string;
  datePattern?: string;
  categoryPattern?: string;
  versionLinkPattern?: string;
}

export interface ParsingRules {
  versionHeaderRegex: RegExp;
  dateExtractionRegex?: RegExp;
  changeItemRegex: RegExp;
  categoryDetectionRegex?: RegExp;
  sectionDelimiterRegex?: RegExp;
  excludePatterns: RegExp[];
}

export class ChangelogFormatDetector {
  private static FORMAT_SIGNATURES = [
    {
      type: ChangelogFormatType.KEEP_A_CHANGELOG,
      weight: 1.0,
      indicators: [
        /keepachangelog\.com/i,
        /## \[Unreleased\]/,
        /## \[\d+\.\d+\.\d+\] - \d{4}-\d{2}-\d{2}/,
        /### (?:Added|Changed|Deprecated|Removed|Fixed|Security)/,
        /\[compare\]/i,
      ],
      rules: {
        versionHeaderRegex: /^## \[([^\]]+)\](?:\s*-\s*(.+))?$/gm,
        dateExtractionRegex: /(\d{4}-\d{2}-\d{2})/,
        changeItemRegex: /^[-*+]\s+(.+)$/gm,
        categoryDetectionRegex: /^### (Added|Changed|Deprecated|Removed|Fixed|Security)$/gm,
        excludePatterns: [/^#[^#]/, /^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.CONVENTIONAL_COMMITS,
      weight: 0.9,
      indicators: [
        /^(?:feat|fix|docs|style|refactor|test|chore|breaking)(?:\([^)]+\))?:/gm,
        /conventional commits/i,
        /conventionalcommits\.org/i,
        /^### Features$/gm,
        /^### Bug Fixes$/gm,
      ],
      rules: {
        versionHeaderRegex: /^#+\s*(?:\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?|\[(\d+\.\d+\.\d+[^\]]*)\])(?:\s*\(([^)]+)\))?/gm,
        changeItemRegex: /^[-*+]\s+(?:(feat|fix|docs|style|refactor|test|chore|breaking)(?:\([^)]+\))?:\s+)?(.+)$/gm,
        categoryDetectionRegex: /^### (Features|Bug Fixes|Performance Improvements|Reverts|Documentation|Styles|Code Refactoring|Tests|Chores|Breaking Changes)$/gm,
        excludePatterns: [/^#[^#]/, /^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.ANGULAR,
      weight: 0.85,
      indicators: [
        /<a name="?[^"]*"?><\/a>/,
        /# \[\d+\.\d+\.\d+\]/,
        /## Features/,
        /## Bug Fixes/,
        /## Performance Improvements/,
        /\(\[[a-f0-9]{8}\]\(.*\)\)/,
      ],
      rules: {
        versionHeaderRegex: /^# \[(\d+\.\d+\.\d+[^\]]*)\]/gm,
        changeItemRegex: /^\* (?:\*\*([^*]+)\*\*:\s*)?(.+)(?:\s+\(\[[a-f0-9]{8}\]\([^)]+\)\))?$/gm,
        categoryDetectionRegex: /^## (Features|Bug Fixes|Performance Improvements|Reverts|Breaking Changes)$/gm,
        excludePatterns: [/^<a name/, /^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.SEMANTIC_RELEASE,
      weight: 0.8,
      indicators: [
        /semantic-release/i,
        /## \[\d+\.\d+\.\d+\]\([^)]+\) \(\d{4}-\d{2}-\d{2}\)/,
        /### Bug Fixes/,
        /### Features/,
        /\* \*\*[^*]+\*\*:/,
      ],
      rules: {
        versionHeaderRegex: /^## \[(\d+\.\d+\.\d+[^\]]*)\]\([^)]+\) \((\d{4}-\d{2}-\d{2})\)$/gm,
        dateExtractionRegex: /\((\d{4}-\d{2}-\d{2})\)/,
        changeItemRegex: /^\* (?:\*\*([^*]+)\*\*:\s*)?(.+)$/gm,
        categoryDetectionRegex: /^### (Bug Fixes|Features|Performance Improvements|Reverts|Code Refactoring|Documentation|Styles|Tests|Chores|Breaking Changes)$/gm,
        excludePatterns: [/^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.GITHUB_RELEASES,
      weight: 0.75,
      indicators: [
        /^## \[?v?\d+\.\d+\.\d+\]?(?:\s*-\s*\d{4}-\d{2}-\d{2})?$/gm,
        /^## Release \d+\.\d+\.\d+/gm,
        /^### What's Changed$/gm,
        /Full Changelog:/i,
        /@[a-zA-Z0-9_-]+ made their first contribution/,
      ],
      rules: {
        versionHeaderRegex: /^## (?:Release\s+)?(?:\[?v?(\d+\.\d+\.\d+[^\]\s]*)\]?|\[(\d+\.\d+\.\d+[^\]]*)\])(?:\s*-\s*(.+))?$/gm,
        changeItemRegex: /^[-*+]\s+(.+)(?:\s+by\s+@[a-zA-Z0-9_-]+(?:\s+in\s+#\d+)?)?$/gm,
        excludePatterns: [/Full Changelog:/i, /New Contributors:/i, /^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.CUSTOM_SECTIONS,
      weight: 0.6,
      indicators: [
        /^#+\s*(New Features?|Improvements?|Bug Fixes?|Breaking Changes?|Deprecations?)/gmi,
        /^#+\s*(Added|Updated|Fixed|Removed|Changed)/gmi,
        /^#+\s*(Enhancements?|Changes?|Fixes?|Security)/gmi,
      ],
      rules: {
        versionHeaderRegex: /^#+\s*(?:v?(\d+\.\d+\.\d+[^\s]*)|(\d+\.\d+\.\d+[^\s]*))(?:\s*[\(\[]([^\)\]]+)[\)\]])?/gm,
        changeItemRegex: /^[-*+]\s+(.+)$/gm,
        categoryDetectionRegex: /^#+\s*(New Features?|Improvements?|Bug Fixes?|Breaking Changes?|Deprecations?|Added|Updated|Fixed|Removed|Changed|Enhancements?|Changes?|Fixes?|Security)$/gmi,
        excludePatterns: [/^\s*$/, /^<!--/],
      },
    },
    {
      type: ChangelogFormatType.CHRONOLOGICAL,
      weight: 0.5,
      indicators: [
        /^\d{4}-\d{2}-\d{2}(?:\s|:)/gm,
        /^#+\s*\d{4}-\d{2}-\d{2}/gm,
        /^#+\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)/gmi,
      ],
      rules: {
        versionHeaderRegex: /^#+\s*(?:(?:v?(\d+\.\d+\.\d+[^\s]*)[\s\-]*)?(\d{4}-\d{2}-\d{2}))/gm,
        dateExtractionRegex: /(\d{4}-\d{2}-\d{2})/,
        changeItemRegex: /^[-*+]\s+(.+)$/gm,
        excludePatterns: [/^\s*$/, /^<!--/],
      },
    },
  ];

  static detectFormat(changelogContent: string): ChangelogFormat {
    const formats = this.analyzeAllFormats(changelogContent);
    const bestMatch = formats.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    if (bestMatch.confidence < 0.3) {
      return this.createUnknownFormat(changelogContent);
    }

    return bestMatch;
  }

  private static analyzeAllFormats(content: string): ChangelogFormat[] {
    const results: ChangelogFormat[] = [];

    for (const signature of this.FORMAT_SIGNATURES) {
      const confidence = this.calculateConfidence(content, signature);
      
      if (confidence > 0) {
        const characteristics = this.extractCharacteristics(content, signature);
        
        results.push({
          type: signature.type,
          confidence,
          characteristics,
          parsingRules: signature.rules,
        });
      }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private static calculateConfidence(
    content: string, 
    signature: typeof this.FORMAT_SIGNATURES[0]
  ): number {
    let score = 0;
    let totalWeight = 0;

    for (const indicator of signature.indicators) {
      const matches = content.match(indicator);
      if (matches) {
        score += signature.weight * Math.min(matches.length / 5, 1.0);
      }
      totalWeight += signature.weight;
    }

    const baseConfidence = totalWeight > 0 ? score / totalWeight : 0;
    
    const structuralBonus = this.calculateStructuralBonus(content, signature);
    const consistencyBonus = this.calculateConsistencyBonus(content, signature);
    
    return Math.min(baseConfidence + structuralBonus + consistencyBonus, 1.0);
  }

  private static calculateStructuralBonus(
    content: string,
    signature: typeof this.FORMAT_SIGNATURES[0]
  ): number {
    let bonus = 0;

    const versionHeaders = content.match(signature.rules.versionHeaderRegex) || [];
    if (versionHeaders.length >= 2) bonus += 0.1;
    if (versionHeaders.length >= 5) bonus += 0.1;

    const changeItems = content.match(signature.rules.changeItemRegex) || [];
    if (changeItems.length >= 5) bonus += 0.1;
    if (changeItems.length >= 20) bonus += 0.1;

    if (signature.rules.categoryDetectionRegex) {
      const categories = content.match(signature.rules.categoryDetectionRegex) || [];
      if (categories.length >= 2) bonus += 0.15;
    }

    return bonus;
  }

  private static calculateConsistencyBonus(
    content: string,
    signature: typeof this.FORMAT_SIGNATURES[0]
  ): number {
    const versionHeaders = content.match(signature.rules.versionHeaderRegex) || [];
    
    if (versionHeaders.length < 2) return 0;

    const formatConsistency = this.checkFormatConsistency(versionHeaders);
    const dateConsistency = signature.rules.dateExtractionRegex ? 
      this.checkDateConsistency(versionHeaders, signature.rules.dateExtractionRegex) : 0.5;

    return (formatConsistency + dateConsistency) * 0.1;
  }

  private static checkFormatConsistency(headers: string[]): number {
    if (headers.length < 2) return 0;

    const patterns = headers.map(header => 
      header.replace(/\d+/g, 'X').replace(/\d{4}-\d{2}-\d{2}/, 'DATE')
    );

    const uniquePatterns = new Set(patterns);
    return 1 - (uniquePatterns.size - 1) / headers.length;
  }

  private static checkDateConsistency(headers: string[], dateRegex: RegExp): number {
    const datesFound = headers.filter(header => dateRegex.test(header));
    return datesFound.length / headers.length;
  }

  private static extractCharacteristics(
    content: string,
    signature: typeof this.FORMAT_SIGNATURES[0]
  ): FormatCharacteristics {
    const versionHeaders = content.match(signature.rules.versionHeaderRegex) || [];
    const hasVersionHeaders = versionHeaders.length > 0;

    const hasDateFormat = signature.rules.dateExtractionRegex ? 
      signature.rules.dateExtractionRegex.test(content) : false;

    const hasChangeCategories = signature.rules.categoryDetectionRegex ? 
      signature.rules.categoryDetectionRegex.test(content) : false;

    const hasLinks = /\[([^\]]+)\]\([^)]+\)/.test(content);

    return {
      hasVersionHeaders,
      hasDateFormat,
      hasChangeCategories,
      hasLinks,
      headerPattern: versionHeaders[0] || undefined,
      datePattern: hasDateFormat ? this.extractDatePattern(content) : undefined,
      categoryPattern: hasChangeCategories ? this.extractCategoryPattern(content, signature) : undefined,
      versionLinkPattern: this.extractVersionLinkPattern(content),
    };
  }

  private static extractDatePattern(content: string): string | undefined {
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/,
      /\d{1,2}\/\d{1,2}\/\d{4}/,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i,
    ];

    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) return match[0];
    }

    return undefined;
  }

  private static extractCategoryPattern(
    content: string,
    signature: typeof this.FORMAT_SIGNATURES[0]
  ): string | undefined {
    if (!signature.rules.categoryDetectionRegex) return undefined;

    const match = content.match(signature.rules.categoryDetectionRegex);
    return match ? match[0] : undefined;
  }

  private static extractVersionLinkPattern(content: string): string | undefined {
    const linkPatterns = [
      /\[\d+\.\d+\.\d+\]\([^)]+\)/,
      /\[v\d+\.\d+\.\d+\]\([^)]+\)/,
      /\[compare\]\([^)]+\)/i,
    ];

    for (const pattern of linkPatterns) {
      const match = content.match(pattern);
      if (match) return match[0];
    }

    return undefined;
  }

  private static createUnknownFormat(content: string): ChangelogFormat {
    const hasVersionNumbers = /\d+\.\d+\.\d+/.test(content);
    const hasListItems = /^[-*+]\s+/gm.test(content);
    const hasHeaders = /^#+\s+/gm.test(content);

    return {
      type: ChangelogFormatType.UNKNOWN,
      confidence: 0.2,
      characteristics: {
        hasVersionHeaders: hasVersionNumbers && hasHeaders,
        hasDateFormat: /\d{4}-\d{2}-\d{2}/.test(content),
        hasChangeCategories: false,
        hasLinks: /\[([^\]]+)\]\([^)]+\)/.test(content),
      },
      parsingRules: {
        versionHeaderRegex: /^#+\s*(?:v?(\d+\.\d+\.\d+[^\s]*))/gm,
        changeItemRegex: hasListItems ? /^[-*+]\s+(.+)$/gm : /^(.+)$/gm,
        excludePatterns: [/^\s*$/, /^<!--/, /^---/],
      },
    };
  }

  static getRecommendedParsingStrategy(format: ChangelogFormat): {
    strategy: string;
    confidence: number;
    notes: string[];
  } {
    const strategies: Record<ChangelogFormatType, {
      strategy: string;
      confidence: number;
      notes: string[];
    }> = {
      [ChangelogFormatType.KEEP_A_CHANGELOG]: {
        strategy: 'structured-sections',
        confidence: 0.95,
        notes: [
          'Use category-based parsing (Added, Changed, Fixed, etc.)',
          'Extract version links and dates',
          'Follow semantic versioning principles',
        ],
      },
      [ChangelogFormatType.CONVENTIONAL_COMMITS]: {
        strategy: 'commit-type-based',
        confidence: 0.9,
        notes: [
          'Parse commit type prefixes (feat:, fix:, etc.)',
          'Group by semantic commit types',
          'Extract scope information when available',
        ],
      },
      [ChangelogFormatType.GITHUB_RELEASES]: {
        strategy: 'release-notes',
        confidence: 0.8,
        notes: [
          'Focus on release descriptions',
          'Extract contributor information',
          'Parse PR and issue references',
        ],
      },
      [ChangelogFormatType.GITLAB_RELEASES]: {
        strategy: 'gitlab-releases',
        confidence: 0.75,
        notes: [
          'Parse GitLab release descriptions',
          'Extract merge request references',
        ],
      },
      [ChangelogFormatType.ANGULAR]: {
        strategy: 'angular-style',
        confidence: 0.85,
        notes: [
          'Use Angular commit message conventions',
          'Parse component scopes',
          'Extract commit hash references',
        ],
      },
      [ChangelogFormatType.SEMANTIC_RELEASE]: {
        strategy: 'semantic-release',
        confidence: 0.9,
        notes: [
          'Use semantic-release conventions',
          'Parse commit types and scopes',
          'Extract automated release notes',
        ],
      },
      [ChangelogFormatType.CUSTOM_SECTIONS]: {
        strategy: 'custom-sections',
        confidence: 0.6,
        notes: [
          'Parse custom section headers',
          'Apply heuristic categorization',
        ],
      },
      [ChangelogFormatType.CHRONOLOGICAL]: {
        strategy: 'chronological',
        confidence: 0.5,
        notes: [
          'Parse by date order',
          'Extract version information from dates',
        ],
      },
      [ChangelogFormatType.GROUPED_CHANGES]: {
        strategy: 'grouped-changes',
        confidence: 0.6,
        notes: [
          'Parse grouped change categories',
          'Apply pattern matching',
        ],
      },
      [ChangelogFormatType.PLAIN_TEXT]: {
        strategy: 'plain-text',
        confidence: 0.3,
        notes: [
          'Use simple text parsing',
          'Apply basic pattern matching',
        ],
      },
      [ChangelogFormatType.UNKNOWN]: {
        strategy: 'best-effort',
        confidence: 0.3,
        notes: [
          'Use generic pattern matching',
          'Apply heuristic categorization',
          'Manual review recommended',
        ],
      },
    };

    return strategies[format.type] || strategies[ChangelogFormatType.UNKNOWN];
  }
}