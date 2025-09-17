// import { marked } from 'marked';

export interface CategorizedChange {
  text: string;
  category: ChangeCategory;
  subcategory?: string;
  severity: ChangeSeverity;
  confidence: number;
  keywords: string[];
  metadata: ChangeMetadata;
}

export interface ChangeMetadata {
  issueReferences: string[];
  prReferences: string[];
  authorMentions: string[];
  breakingChangeIndicators: string[];
  affectedComponents: string[];
  migrationRequired: boolean;
  deprecationWarning: boolean;
}

export enum ChangeCategory {
  BREAKING = 'breaking',
  FEATURE = 'feature', 
  FIX = 'fix',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  DOCUMENTATION = 'documentation',
  DEPENDENCY = 'dependency',
  REFACTOR = 'refactor',
  TEST = 'test',
  BUILD = 'build',
  CHORE = 'chore',
  DEPRECATION = 'deprecation',
  REMOVAL = 'removal',
  OTHER = 'other',
}

export enum ChangeSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  INFO = 'info',
}

export class IntelligentChangeCategorizer {
  private static BREAKING_PATTERNS = [
    // Explicit breaking change indicators
    { regex: /\bBREAKING\s+CHANGE\b/gi, weight: 1.0, keywords: ['breaking change'] },
    { regex: /\bbreaking\s*[:;]\s*/gi, weight: 0.95, keywords: ['breaking'] },
    { regex: /\b(?:backwards?\s+)?incompatible\b/gi, weight: 0.9, keywords: ['incompatible'] },
    
    // API changes
    { regex: /\bremoved?\s+(?:api|method|function|property|parameter|argument)\b/gi, weight: 0.85, keywords: ['removed', 'api'] },
    { regex: /\b(?:api|method|function)\s+(?:signature\s+)?changed?\b/gi, weight: 0.8, keywords: ['api changed'] },
    { regex: /\b(?:renamed|moved)\s+(?:api|method|function|class|module)\b/gi, weight: 0.75, keywords: ['renamed', 'api'] },
    
    // Deprecation and removal
    { regex: /\b(?:deprecated|deprecation)\b/gi, weight: 0.7, keywords: ['deprecated'] },
    { regex: /\bno\s+longer\s+(?:supports?|works?|available)\b/gi, weight: 0.8, keywords: ['no longer'] },
    { regex: /\bdropped?\s+support\s+for\b/gi, weight: 0.8, keywords: ['dropped support'] },
    
    // Migration requirements
    { regex: /\bmigration\s+(?:required|needed|guide|path)\b/gi, weight: 0.85, keywords: ['migration'] },
    { regex: /\bupgrade\s+(?:required|needed|guide)\b/gi, weight: 0.8, keywords: ['upgrade required'] },
    { regex: /\bmust\s+(?:update|change|modify)\b/gi, weight: 0.75, keywords: ['must update'] },
    
    // Version changes
    { regex: /\bmajor\s+version\s+(?:bump|increase|change)\b/gi, weight: 0.9, keywords: ['major version'] },
    { regex: /\bminimum\s+(?:version|requirement)\s+(?:increased?|changed?|bumped?)\b/gi, weight: 0.8, keywords: ['minimum version'] },
  ];

  private static FEATURE_PATTERNS = [
    // Conventional commits
    { regex: /^feat(?:\([^)]+\))?:\s*/gi, weight: 1.0, keywords: ['feat'] },
    { regex: /^feature(?:\([^)]+\))?:\s*/gi, weight: 0.95, keywords: ['feature'] },
    
    // Add/new patterns
    { regex: /\b(?:add|added|adds)\s+(?:new\s+)?(?:feature|functionality|capability|support\s+for)\b/gi, weight: 0.9, keywords: ['added', 'feature'] },
    { regex: /\bnew\s+(?:feature|functionality|capability|option|setting|parameter)\b/gi, weight: 0.85, keywords: ['new', 'feature'] },
    { regex: /\bintroduce[ds]?\s+(?:new\s+)?(?:feature|functionality|api|method)\b/gi, weight: 0.85, keywords: ['introduced', 'feature'] },
    
    // Implementation patterns
    { regex: /\bimplement(?:ed|s)?\s+(?:new\s+)?(?:feature|functionality|support)\b/gi, weight: 0.8, keywords: ['implemented', 'feature'] },
    { regex: /\benable[ds]?\s+(?:support\s+for|users?\s+to)\b/gi, weight: 0.75, keywords: ['enabled', 'support'] },
    { regex: /\ballow[s]?\s+(?:users?\s+to|for)\b/gi, weight: 0.7, keywords: ['allows', 'users'] },
    
    // Enhancement patterns
    { regex: /\benhance[ds]?\s+(?:with|to\s+support)\b/gi, weight: 0.7, keywords: ['enhanced'] },
    { regex: /\bextend[eds]?\s+(?:with|to\s+support)\b/gi, weight: 0.7, keywords: ['extended'] },
    { regex: /\bimprove[ds]?\s+(?:by\s+adding|with\s+new)\b/gi, weight: 0.7, keywords: ['improved', 'adding'] },
  ];

  private static FIX_PATTERNS = [
    // Conventional commits
    { regex: /^fix(?:\([^)]+\))?:\s*/gi, weight: 1.0, keywords: ['fix'] },
    { regex: /^bugfix(?:\([^)]+\))?:\s*/gi, weight: 0.95, keywords: ['bugfix'] },
    
    // Direct fix patterns
    { regex: /\bfix(?:ed|es)?\s+(?:bug|issue|problem|error)\b/gi, weight: 0.9, keywords: ['fixed', 'bug'] },
    { regex: /\bresolved?\s+(?:bug|issue|problem|error)\b/gi, weight: 0.85, keywords: ['resolved', 'issue'] },
    { regex: /\bcorrect(?:ed|s)?\s+(?:bug|issue|behavior|behaviour)\b/gi, weight: 0.8, keywords: ['corrected'] },
    
    // Bug-related patterns
    { regex: /\bbug\s+(?:fix|fixes|fixed|repair|repaired)\b/gi, weight: 0.9, keywords: ['bug', 'fix'] },
    { regex: /\bissue\s+(?:fix|fixes|fixed|resolved)\b/gi, weight: 0.85, keywords: ['issue', 'fix'] },
    { regex: /\bpatch(?:ed)?\s+(?:for|to\s+fix)\b/gi, weight: 0.8, keywords: ['patched'] },
    
    // Emoji-based patterns
    { regex: /:bug:\s*(?:fix|fixed|resolve|resolved)/gi, weight: 0.95, keywords: ['bug', 'emoji'] },
    { regex: /:wrench:\s*(?:fix|fixed)/gi, weight: 0.85, keywords: ['fix', 'emoji'] },
    { regex: /:hammer:\s*(?:fix|fixed)/gi, weight: 0.85, keywords: ['fix', 'emoji'] },
    
    // Error handling
    { regex: /\bhandle[ds]?\s+(?:error|exception|edge\s+case)\b/gi, weight: 0.75, keywords: ['handled', 'error'] },
    { regex: /\bprevent[s]?\s+(?:error|crash|failure)\b/gi, weight: 0.8, keywords: ['prevents', 'error'] },
  ];

  private static SECURITY_PATTERNS = [
    // Security-specific terms
    { regex: /\bsecurity\s+(?:fix|patch|update|vulnerability|issue)\b/gi, weight: 1.0, keywords: ['security'] },
    { regex: /\bvulnerability\s+(?:fix|patch|resolved)\b/gi, weight: 0.95, keywords: ['vulnerability'] },
    { regex: /\bCVE-\d{4}-\d+/gi, weight: 1.0, keywords: ['CVE'] },
    
    // Attack vectors
    { regex: /\b(?:XSS|cross[- ]site\s+scripting)\b/gi, weight: 0.9, keywords: ['XSS'] },
    { regex: /\b(?:CSRF|cross[- ]site\s+request\s+forgery)\b/gi, weight: 0.9, keywords: ['CSRF'] },
    { regex: /\b(?:SQL\s+injection|SQLi)\b/gi, weight: 0.9, keywords: ['SQL injection'] },
    { regex: /\b(?:code\s+injection|command\s+injection)\b/gi, weight: 0.9, keywords: ['injection'] },
    
    // Security measures
    { regex: /\b(?:sanitiz|escape)[eds]?\s+(?:input|output|user\s+data)\b/gi, weight: 0.85, keywords: ['sanitized'] },
    { regex: /\b(?:validat|authoriz|authenticat)[eds]?\s+(?:input|user|request)\b/gi, weight: 0.8, keywords: ['validated'] },
    { regex: /\b(?:encrypt|hash)[eds]?\s+(?:password|data|token)\b/gi, weight: 0.8, keywords: ['encrypted'] },
  ];

  private static PERFORMANCE_PATTERNS = [
    // Direct performance terms
    { regex: /\bperformance\s+(?:improvement|optimization|enhancement|boost)\b/gi, weight: 0.9, keywords: ['performance'] },
    { regex: /\boptimiz(?:ed|e[ds]?)\s+(?:for\s+)?(?:speed|performance|memory|cpu)\b/gi, weight: 0.85, keywords: ['optimized'] },
    { regex: /\b(?:faster|quicker|speedup|speed\s+up)\b/gi, weight: 0.8, keywords: ['faster'] },
    
    // Specific improvements
    { regex: /\breduce[ds]?\s+(?:memory\s+(?:usage|footprint)|cpu\s+usage|load\s+time)\b/gi, weight: 0.85, keywords: ['reduced', 'memory'] },
    { regex: /\bimprove[ds]?\s+(?:rendering|loading|startup|boot)\s+(?:time|speed|performance)\b/gi, weight: 0.8, keywords: ['improved', 'speed'] },
    { regex: /\b(?:cach|memoiz)[eds]?\s+(?:results?|responses?|data)\b/gi, weight: 0.8, keywords: ['cached'] },
    
    // Benchmarks
    { regex: /\b(?:\d+%|\d+x)\s+(?:faster|improvement|reduction)\b/gi, weight: 0.9, keywords: ['benchmark'] },
    { regex: /\bbenchmark\s+(?:improvement|results?)\b/gi, weight: 0.8, keywords: ['benchmark'] },
  ];

  private static DEPENDENCY_PATTERNS = [
    // Dependency updates
    { regex: /\b(?:update|upgrade)[ds]?\s+(?:dependency|dependencies|deps)\b/gi, weight: 0.8, keywords: ['updated', 'dependencies'] },
    { regex: /\bbump[eds]?\s+(?:dependency|version\s+of)\b/gi, weight: 0.75, keywords: ['bumped', 'dependency'] },
    { regex: /\b(?:add|remove)[ds]?\s+(?:dependency|package)\s+/gi, weight: 0.8, keywords: ['dependency'] },
    
    // Package management
    { regex: /\bnpm\s+(?:install|update|audit)/gi, weight: 0.7, keywords: ['npm'] },
    { regex: /\byarn\s+(?:add|upgrade|audit)/gi, weight: 0.7, keywords: ['yarn'] },
    { regex: /\bpip\s+(?:install|upgrade)/gi, weight: 0.7, keywords: ['pip'] },
  ];

  static categorizeChanges(content: string): CategorizedChange[] {
    const changes: CategorizedChange[] = [];
    const lines = content.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (this.isChangeItem(trimmedLine)) {
        const change = this.categorizeChange(trimmedLine);
        if (change) {
          changes.push(change);
        }
      }
    }

    return this.deduplicateAndSort(changes);
  }

  private static isChangeItem(line: string): boolean {
    if (line.length < 10) return false;
    
    const patterns = [
      /^\s*[-*+]\s+/,
      /^\s*\d+\.\s+/,
      /^(?:feat|fix|docs|style|refactor|test|chore|breaking)(?:\([^)]+\))?:\s*/i,
      /^[A-Z][^.!?]*[.!?]?\s*$/,
      // Emoji-prefixed items like \"* :bug: fixed a bug\"
      /^\s*[-*+]\s*:[a-z_]+:\s*/,
      // Section headers like \"### Bug Fixes\"
      /^#+\s*(?:bug\s*fix|fix|feature|enhancement|improvement|security|performance|documentation|deprecat|remov|break)/i,
    ];

    return patterns.some(pattern => pattern.test(line)) ||
           line.split(' ').length >= 3;
  }

  private static categorizeChange(text: string): CategorizedChange | null {
    const cleanText = this.cleanChangeText(text);
    
    const scores = new Map<ChangeCategory, { score: number; keywords: string[] }>();
    
    this.scoreAgainstPatterns(cleanText, this.BREAKING_PATTERNS, ChangeCategory.BREAKING, scores);
    this.scoreAgainstPatterns(cleanText, this.SECURITY_PATTERNS, ChangeCategory.SECURITY, scores);
    this.scoreAgainstPatterns(cleanText, this.FEATURE_PATTERNS, ChangeCategory.FEATURE, scores);
    this.scoreAgainstPatterns(cleanText, this.FIX_PATTERNS, ChangeCategory.FIX, scores);
    this.scoreAgainstPatterns(cleanText, this.PERFORMANCE_PATTERNS, ChangeCategory.PERFORMANCE, scores);
    this.scoreAgainstPatterns(cleanText, this.DEPENDENCY_PATTERNS, ChangeCategory.DEPENDENCY, scores);

    const bestMatch = this.findBestMatch(scores);
    
    if (!bestMatch || bestMatch.score < 0.3) {
      return this.categorizeByKeywords(cleanText);
    }

    const metadata = this.extractMetadata(cleanText, bestMatch.category);
    const severity = this.determineSeverity(bestMatch.category, bestMatch.score, metadata);

    return {
      text: cleanText,
      category: bestMatch.category,
      severity,
      confidence: bestMatch.score,
      keywords: bestMatch.keywords,
      metadata,
    };
  }

  private static scoreAgainstPatterns(
    text: string,
    patterns: Array<{ regex: RegExp; weight: number; keywords: string[] }>,
    category: ChangeCategory,
    scores: Map<ChangeCategory, { score: number; keywords: string[] }>
  ): void {
    let totalScore = 0;
    const allKeywords: string[] = [];

    for (const pattern of patterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        totalScore += pattern.weight * matches.length;
        allKeywords.push(...pattern.keywords);
      }
    }

    if (totalScore > 0) {
      const existing = scores.get(category);
      if (!existing || totalScore > existing.score) {
        scores.set(category, {
          score: Math.min(totalScore, 1.0),
          keywords: [...new Set(allKeywords)],
        });
      }
    }
  }

  private static findBestMatch(scores: Map<ChangeCategory, { score: number; keywords: string[] }>) {
    let bestCategory: ChangeCategory | null = null;
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [category, data] of scores.entries()) {
      if (data.score > bestScore) {
        bestScore = data.score;
        bestCategory = category;
        bestKeywords = data.keywords;
      }
    }

    return bestCategory ? { 
      category: bestCategory, 
      score: bestScore, 
      keywords: bestKeywords 
    } : null;
  }

  private static categorizeByKeywords(text: string): CategorizedChange | null {
    const lowerText = text.toLowerCase();
    
    const keywordMap = new Map([
      [ChangeCategory.DOCUMENTATION, ['docs', 'documentation', 'readme', 'comment', 'example']],
      [ChangeCategory.TEST, ['test', 'testing', 'spec', 'coverage', 'unit test', 'integration']],
      [ChangeCategory.BUILD, ['build', 'webpack', 'rollup', 'compile', 'bundle', 'ci', 'cd']],
      [ChangeCategory.REFACTOR, ['refactor', 'cleanup', 'restructure', 'reorganize', 'simplify']],
      [ChangeCategory.CHORE, ['chore', 'maintenance', 'update', 'upgrade', 'bump', 'housekeeping']],
      [ChangeCategory.DEPRECATION, ['deprecate', 'deprecation', 'legacy', 'obsolete']],
      [ChangeCategory.REMOVAL, ['remove', 'delete', 'drop', 'eliminate', 'purge']],
    ]);

    for (const [category, keywords] of keywordMap.entries()) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          const metadata = this.extractMetadata(text, category);
          return {
            text,
            category,
            severity: ChangeSeverity.LOW,
            confidence: 0.6,
            keywords: [keyword],
            metadata,
          };
        }
      }
    }

    return null;
  }

  private static extractMetadata(text: string, category: ChangeCategory): ChangeMetadata {
    const issueReferences = this.extractReferences(text, /#(\d+)/g);
    const prReferences = this.extractReferences(text, /(?:PR|pull request|merge request)\s*#?(\d+)/gi);
    const authorMentions = this.extractReferences(text, /@([a-zA-Z0-9_-]+)/g);
    
    const breakingChangeIndicators = this.extractBreakingIndicators(text);
    const affectedComponents = this.extractComponents(text);
    
    const migrationRequired = /(?:migration|upgrade)\s+(?:required|needed|guide)/i.test(text);
    const deprecationWarning = /deprecat/i.test(text);

    return {
      issueReferences,
      prReferences,
      authorMentions,
      breakingChangeIndicators,
      affectedComponents,
      migrationRequired,
      deprecationWarning,
    };
  }

  private static extractReferences(text: string, regex: RegExp): string[] {
    const matches = text.matchAll(regex);
    return Array.from(matches, match => match[1]).filter(Boolean);
  }

  private static extractBreakingIndicators(text: string): string[] {
    const indicators = [];
    
    if (/breaking/i.test(text)) indicators.push('breaking');
    if (/incompatible/i.test(text)) indicators.push('incompatible');
    if (/removed?/i.test(text)) indicators.push('removed');
    if (/deprecated?/i.test(text)) indicators.push('deprecated');
    if (/no longer/i.test(text)) indicators.push('no longer');
    
    return indicators;
  }

  private static extractComponents(text: string): string[] {
    const componentPatterns = [
      /(?:in|for|of)\s+([A-Z][a-zA-Z]+(?:Component|Service|Module|Class|Function))/g,
      /(?:in|for|of)\s+`([^`]+)`/g,
      /(?:in|for|of)\s+"([^"]+)"/g,
    ];

    const components: string[] = [];
    
    for (const pattern of componentPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) components.push(match[1]);
      }
    }

    return [...new Set(components)];
  }

  private static determineSeverity(
    category: ChangeCategory,
    confidence: number,
    metadata: ChangeMetadata
  ): ChangeSeverity {
    if (category === ChangeCategory.SECURITY) return ChangeSeverity.CRITICAL;
    if (category === ChangeCategory.BREAKING) return ChangeSeverity.HIGH;
    
    if (metadata.migrationRequired) return ChangeSeverity.HIGH;
    if (metadata.breakingChangeIndicators.length > 0) return ChangeSeverity.HIGH;
    
    if (category === ChangeCategory.FEATURE && confidence > 0.8) return ChangeSeverity.MEDIUM;
    if (category === ChangeCategory.FIX && confidence > 0.8) return ChangeSeverity.MEDIUM;
    if (category === ChangeCategory.PERFORMANCE) return ChangeSeverity.MEDIUM;
    
    if (category === ChangeCategory.DEPRECATION) return ChangeSeverity.MEDIUM;
    if (category === ChangeCategory.DEPENDENCY) return ChangeSeverity.LOW;
    if (category === ChangeCategory.DOCUMENTATION) return ChangeSeverity.INFO;
    if (category === ChangeCategory.TEST) return ChangeSeverity.INFO;
    
    return ChangeSeverity.LOW;
  }

  private static cleanChangeText(text: string): string {
    return text
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      .replace(/^(?:feat|fix|docs|style|refactor|test|chore|breaking)(?:\([^)]+\))?:\s*/i, '')
      .trim();
  }

  private static deduplicateAndSort(changes: CategorizedChange[]): CategorizedChange[] {
    const seen = new Set<string>();
    const unique = changes.filter(change => {
      const key = change.text.toLowerCase().replace(/\s+/g, ' ').trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return unique.sort((a, b) => {
      const severityOrder = {
        [ChangeSeverity.CRITICAL]: 5,
        [ChangeSeverity.HIGH]: 4,
        [ChangeSeverity.MEDIUM]: 3,
        [ChangeSeverity.LOW]: 2,
        [ChangeSeverity.INFO]: 1,
      };
      
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;
      
      return b.confidence - a.confidence;
    });
  }
}