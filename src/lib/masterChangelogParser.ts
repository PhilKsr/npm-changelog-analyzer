import { ChangelogDetector } from './intelligentChangelogDetector';
import { IntelligentVersionParser, VersionBlock } from './intelligentVersionParser';
import { IntelligentChangeCategorizer, CategorizedChange } from './intelligentChangeCategorizer';
import { IntelligentMarkdownParser, ParsedMarkdown } from './intelligentMarkdownParser';
import { ChangelogFormatDetector, ChangelogFormat } from './changelogFormatDetector';
import { SemanticVersionAnalyzer, VersionChangeAnalysis } from './semanticVersionAnalyzer';

export interface IntelligentChangelogAnalysis {
  // Source information
  sources: ChangelogSource[];
  selectedSource: ChangelogSource;
  format: ChangelogFormat;
  
  // Version analysis
  versionBlocks: VersionBlock[];
  versionAnalysis: VersionChangeAnalysis;
  
  // Content analysis
  categorizedChanges: CategorizedChange[];
  markdownAnalysis: ParsedMarkdown;
  
  // Summary
  summary: ChangelogSummary;
  
  // Metadata
  metadata: AnalysisMetadata;
}

export interface ChangelogSource {
  content: string;
  source: 'file' | 'releases' | 'commits' | 'readme';
  url?: string;
  confidence: number;
  lastModified?: string;
}

export interface ChangelogSummary {
  totalChanges: number;
  breakingChangesCount: number;
  newFeaturesCount: number;
  bugFixesCount: number;
  securityFixesCount: number;
  riskScore: number;
  upgradeComplexity: 'low' | 'medium' | 'high';
  semverCompliance: boolean;
  recommendedActions: string[];
}

export interface AnalysisMetadata {
  analysisDate: Date;
  processingTimeMs: number;
  packageName: string;
  versionRange: {
    from: string;
    to: string;
  };
  parsingStrategy: string;
  confidence: number;
  warnings: string[];
  repositoryInfo?: {
    owner: string;
    repo: string;
    platform: string;
  };
}

export class MasterChangelogParser {
  private detector: ChangelogDetector;
  private repositoryInfo?: { owner: string; repo: string; platform: string };

  constructor(repositoryInfo?: { owner: string; repo: string; platform: string }) {
    this.detector = new ChangelogDetector();
    this.repositoryInfo = repositoryInfo;
  }

  async analyzeChangelog(
    packageName: string,
    startVersion: string,
    endVersion: string
  ): Promise<IntelligentChangelogAnalysis> {
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Step 1: Detect and retrieve changelog sources
      const sources = await this.detector.detectChangelog(packageName);
      
      if (sources.length === 0) {
        throw new Error(`No changelog found for package: ${packageName}`);
      }

      const selectedSource = this.selectBestSourceForVersionRange(sources, startVersion, endVersion);
      
      // Step 2: Detect changelog format
      const format = ChangelogFormatDetector.detectFormat(selectedSource.content);
      
      if (format.confidence < 0.3) {
        warnings.push('Changelog format detection confidence is low, results may be less accurate');
      }

      // Step 3: Parse version blocks in the relevant range
      const versionBlocks = IntelligentVersionParser.parseVersionBlocks(
        selectedSource.content,
        startVersion,
        endVersion
      );

      if (versionBlocks.length === 0) {
        warnings.push(`No versions found between ${startVersion} and ${endVersion}`);
      }

      // Step 4: Analyze semantic versioning
      const fromSemanticVersion = IntelligentVersionParser.parseSemanticVersion(startVersion);
      const toSemanticVersion = IntelligentVersionParser.parseSemanticVersion(endVersion);
      
      const versionAnalysis = SemanticVersionAnalyzer.analyzeVersionChange(
        fromSemanticVersion,
        toSemanticVersion,
        selectedSource.content
      );

      // Step 5: Categorize changes
      const allContent = versionBlocks.map(block => block.content).join('\n');
      const categorizedChanges = IntelligentChangeCategorizer.categorizeChanges(allContent);

      // Step 6: Parse markdown for additional insights
      const markdownParser = new IntelligentMarkdownParser(this.repositoryInfo);
      const markdownAnalysis = await markdownParser.parse(selectedSource.content);

      // Step 7: Generate summary
      const summary = this.generateSummary(categorizedChanges, versionAnalysis, versionBlocks);

      // Step 8: Create metadata
      const processingTimeMs = Date.now() - startTime;
      const metadata: AnalysisMetadata = {
        analysisDate: new Date(),
        processingTimeMs,
        packageName,
        versionRange: { from: startVersion, to: endVersion },
        parsingStrategy: format.type,
        confidence: this.calculateOverallConfidence(format, sources, versionBlocks),
        warnings,
        repositoryInfo: this.repositoryInfo,
      };

      return {
        sources,
        selectedSource,
        format,
        versionBlocks,
        versionAnalysis,
        categorizedChanges,
        markdownAnalysis,
        summary,
        metadata,
      };

    } catch (error) {
      throw new Error(`Failed to analyze changelog: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private selectBestSource(sources: ChangelogSource[]): ChangelogSource {
    // Sort by confidence and prefer certain source types
    const sortedSources = sources.sort((a, b) => {
      const typePreference = this.getSourceTypePreference(a.source) - this.getSourceTypePreference(b.source);
      if (typePreference !== 0) return typePreference;
      
      return b.confidence - a.confidence;
    });

    return sortedSources[0];
  }

  private selectBestSourceForVersionRange(
    sources: ChangelogSource[],
    startVersion: string,
    endVersion: string
  ): ChangelogSource {
    // Check which sources actually contain versions in our target range
    const sourcesWithVersionCoverage = sources.map(source => {
      const versionBlocks = IntelligentVersionParser.parseVersionBlocks(
        source.content,
        startVersion,
        endVersion
      );
      
      return {
        ...source,
        versionCoverage: versionBlocks.length,
        hasRelevantContent: versionBlocks.length > 0
      };
    });

    // First, try to find sources that actually have content for our version range
    const relevantSources = sourcesWithVersionCoverage.filter(s => s.hasRelevantContent);
    
    if (relevantSources.length > 0) {
      // Sort by version coverage first, then by confidence and type preference
      const sortedRelevant = relevantSources.sort((a, b) => {
        // Prefer sources with more version coverage
        if (a.versionCoverage !== b.versionCoverage) {
          return b.versionCoverage - a.versionCoverage;
        }
        
        // Then by type preference
        const typePreference = this.getSourceTypePreference(a.source) - this.getSourceTypePreference(b.source);
        if (typePreference !== 0) return typePreference;
        
        // Finally by confidence
        return b.confidence - a.confidence;
      });
      
      return sortedRelevant[0];
    }

    // Fallback to original logic if no sources have relevant content
    return this.selectBestSource(sources);
  }

  private getSourceTypePreference(sourceType: string): number {
    const preferences = {
      'file': 1,      // CHANGELOG.md files are preferred
      'releases': 2,  // GitHub releases are second choice
      'readme': 3,    // README changelogs are third
      'commits': 4,   // Commit messages are last resort
    };
    
    return preferences[sourceType as keyof typeof preferences] || 5;
  }

  private generateSummary(
    categorizedChanges: CategorizedChange[],
    versionAnalysis: VersionChangeAnalysis,
    _versionBlocks: VersionBlock[]
  ): ChangelogSummary {
    const breakingChanges = categorizedChanges.filter(c => c.category === 'breaking');
    const newFeatures = categorizedChanges.filter(c => c.category === 'feature');
    const bugFixes = categorizedChanges.filter(c => c.category === 'fix');
    const securityFixes = categorizedChanges.filter(c => c.category === 'security');

    // Calculate risk score (0-100)
    let riskScore = 0;
    riskScore += breakingChanges.length * 15;
    riskScore += securityFixes.length * 10;
    riskScore += newFeatures.length * 3;
    riskScore += bugFixes.length * 1;
    
    // Factor in version analysis
    const versionRisk = this.getVersionRiskScore(versionAnalysis);
    riskScore = Math.min(100, riskScore + versionRisk);

    // Determine upgrade complexity
    let upgradeComplexity: 'low' | 'medium' | 'high' = 'low';
    if (versionAnalysis.aggregateAnalysis.upgradeComplexity === 'complex' || 
        versionAnalysis.aggregateAnalysis.upgradeComplexity === 'major-effort') {
      upgradeComplexity = 'high';
    } else if (versionAnalysis.aggregateAnalysis.upgradeComplexity === 'moderate' ||
               breakingChanges.length > 0) {
      upgradeComplexity = 'medium';
    }

    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(
      categorizedChanges,
      versionAnalysis,
      riskScore
    );

    return {
      totalChanges: categorizedChanges.length,
      breakingChangesCount: breakingChanges.length,
      newFeaturesCount: newFeatures.length,
      bugFixesCount: bugFixes.length,
      securityFixesCount: securityFixes.length,
      riskScore,
      upgradeComplexity,
      semverCompliance: versionAnalysis.aggregateAnalysis.semverCompliance.isCompliant,
      recommendedActions,
    };
  }

  private getVersionRiskScore(versionAnalysis: VersionChangeAnalysis): number {
    const riskMapping = {
      'minimal': 0,
      'low': 5,
      'moderate': 15,
      'high': 25,
      'critical': 35,
    };

    return riskMapping[versionAnalysis.aggregateAnalysis.riskLevel] || 0;
  }

  private generateRecommendedActions(
    categorizedChanges: CategorizedChange[],
    versionAnalysis: VersionChangeAnalysis,
    riskScore: number
  ): string[] {
    const actions: string[] = [];

    // Security-related actions
    const securityFixes = categorizedChanges.filter(c => c.category === 'security');
    if (securityFixes.length > 0) {
      actions.push(`Address ${securityFixes.length} security fix${securityFixes.length > 1 ? 'es' : ''} immediately`);
    }

    // Breaking changes actions
    const breakingChanges = categorizedChanges.filter(c => c.category === 'breaking');
    if (breakingChanges.length > 0) {
      actions.push(`Review ${breakingChanges.length} breaking change${breakingChanges.length > 1 ? 's' : ''} and update code accordingly`);
    }

    // Version-specific actions
    if (versionAnalysis.aggregateAnalysis.changeType === 'major') {
      actions.push('Plan migration strategy for major version upgrade');
    }

    // Risk-based actions
    if (riskScore > 50) {
      actions.push('Perform comprehensive testing before deployment');
      actions.push('Consider staged rollout to minimize risk');
    } else if (riskScore > 20) {
      actions.push('Run integration tests to verify compatibility');
    }

    // Deprecation warnings
    const deprecationChanges = categorizedChanges.filter(c => 
      c.metadata.deprecationWarning || c.category === 'deprecation'
    );
    if (deprecationChanges.length > 0) {
      actions.push('Address deprecation warnings to prepare for future versions');
    }

    // Migration requirements
    const migrationRequired = categorizedChanges.some(c => c.metadata.migrationRequired);
    if (migrationRequired) {
      actions.push('Follow migration guide for breaking changes');
    }

    // Default actions
    if (actions.length === 0) {
      actions.push('Review changelog for any relevant changes');
      actions.push('Test application functionality after upgrade');
    }

    return actions;
  }

  private calculateOverallConfidence(
    format: ChangelogFormat,
    sources: ChangelogSource[],
    versionBlocks: VersionBlock[]
  ): number {
    const formatConfidence = format.confidence;
    const sourceConfidence = sources.length > 0 ? sources[0].confidence : 0;
    const versionConfidence = versionBlocks.length > 0 ? 1.0 : 0.5;

    // Weighted average
    return (formatConfidence * 0.4 + sourceConfidence * 0.4 + versionConfidence * 0.2);
  }

  // Static convenience method for one-off analysis
  static async analyze(
    packageName: string,
    startVersion: string,
    endVersion: string,
    repositoryInfo?: { owner: string; repo: string; platform: string }
  ): Promise<IntelligentChangelogAnalysis> {
    const parser = new MasterChangelogParser(repositoryInfo);
    return parser.analyzeChangelog(packageName, startVersion, endVersion);
  }
}