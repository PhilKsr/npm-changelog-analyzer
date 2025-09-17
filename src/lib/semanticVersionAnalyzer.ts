import { SemanticVersion } from './intelligentVersionParser';

export interface VersionAnalysis {
  changeType: VersionChangeType;
  breakingChangeLikelihood: BreakingChangeLikelihood;
  riskLevel: RiskLevel;
  upgradeComplexity: UpgradeComplexity;
  semverCompliance: SemverCompliance;
  recommendations: VersionRecommendation[];
}

export interface VersionChangeAnalysis {
  fromVersion: SemanticVersion;
  toVersion: SemanticVersion;
  versionJumps: VersionJump[];
  aggregateAnalysis: VersionAnalysis;
  individualAnalyses: Map<string, VersionAnalysis>;
  migrationPath: MigrationStep[];
}

export enum VersionChangeType {
  PATCH = 'patch',
  MINOR = 'minor', 
  MAJOR = 'major',
  PRERELEASE = 'prerelease',
  MULTI_MAJOR = 'multi-major',
  DOWNGRADE = 'downgrade',
}

export enum BreakingChangeLikelihood {
  NONE = 'none',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CERTAIN = 'certain',
}

export enum RiskLevel {
  MINIMAL = 'minimal',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum UpgradeComplexity {
  TRIVIAL = 'trivial',
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  MAJOR_EFFORT = 'major-effort',
}

export interface SemverCompliance {
  isCompliant: boolean;
  violations: SemverViolation[];
  confidence: number;
}

export interface SemverViolation {
  type: 'breaking-in-patch' | 'breaking-in-minor' | 'feature-in-patch' | 'missing-major-bump';
  description: string;
  severity: 'warning' | 'error';
  evidence: string[];
}

export interface VersionRecommendation {
  type: 'testing' | 'migration' | 'documentation' | 'rollback-plan' | 'gradual-upgrade';
  priority: 'high' | 'medium' | 'low';
  description: string;
  actionItems: string[];
}

export interface VersionJump {
  from: SemanticVersion;
  to: SemanticVersion;
  changeType: VersionChangeType;
  analysis: VersionAnalysis;
}

export interface MigrationStep {
  order: number;
  version: string;
  description: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  prerequisites: string[];
  risks: string[];
}

export class SemanticVersionAnalyzer {
  static analyzeVersionChange(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    changelogContent?: string
  ): VersionChangeAnalysis {
    const versionJumps = this.calculateVersionJumps(fromVersion, toVersion);
    const aggregateAnalysis = this.analyzeAggregate(fromVersion, toVersion, changelogContent);
    const individualAnalyses = this.analyzeIndividualJumps(versionJumps, changelogContent);
    const migrationPath = this.generateMigrationPath(versionJumps);

    return {
      fromVersion,
      toVersion,
      versionJumps,
      aggregateAnalysis,
      individualAnalyses,
      migrationPath,
    };
  }

  private static calculateVersionJumps(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion
  ): VersionJump[] {
    const jumps: VersionJump[] = [];
    
    if (this.compareVersions(fromVersion, toVersion) === 0) {
      return jumps;
    }

    if (this.compareVersions(fromVersion, toVersion) > 0) {
      jumps.push({
        from: fromVersion,
        to: toVersion,
        changeType: VersionChangeType.DOWNGRADE,
        analysis: this.analyzeDowngrade(fromVersion, toVersion),
      });
      return jumps;
    }

    if (toVersion.major > fromVersion.major) {
      if (toVersion.major - fromVersion.major > 1) {
        for (let major = fromVersion.major + 1; major <= toVersion.major; major++) {
          const jumpFrom = major === fromVersion.major + 1 ? fromVersion : { 
            ...fromVersion, 
            major: major - 1, 
            minor: 0, 
            patch: 0,
            raw: `${major - 1}.0.0`
          };
          const jumpTo = major === toVersion.major ? toVersion : {
            ...fromVersion,
            major,
            minor: 0,
            patch: 0,
            raw: `${major}.0.0`
          };

          jumps.push({
            from: jumpFrom,
            to: jumpTo,
            changeType: VersionChangeType.MAJOR,
            analysis: this.analyzeMajorChange(jumpFrom, jumpTo),
          });
        }
      } else {
        jumps.push({
          from: fromVersion,
          to: toVersion,
          changeType: VersionChangeType.MAJOR,
          analysis: this.analyzeMajorChange(fromVersion, toVersion),
        });
      }
    } else if (toVersion.minor > fromVersion.minor) {
      jumps.push({
        from: fromVersion,
        to: toVersion,
        changeType: VersionChangeType.MINOR,
        analysis: this.analyzeMinorChange(fromVersion, toVersion),
      });
    } else if (toVersion.patch > fromVersion.patch) {
      jumps.push({
        from: fromVersion,
        to: toVersion,
        changeType: VersionChangeType.PATCH,
        analysis: this.analyzePatchChange(fromVersion, toVersion),
      });
    } else if (fromVersion.prerelease || toVersion.prerelease) {
      jumps.push({
        from: fromVersion,
        to: toVersion,
        changeType: VersionChangeType.PRERELEASE,
        analysis: this.analyzePrereleaseChange(fromVersion, toVersion),
      });
    }

    return jumps;
  }

  private static analyzeAggregate(
    fromVersion: SemanticVersion,
    toVersion: SemanticVersion,
    changelogContent?: string
  ): VersionAnalysis {
    const majorDiff = toVersion.major - fromVersion.major;
    const minorDiff = toVersion.minor - fromVersion.minor;
    const patchDiff = toVersion.patch - fromVersion.patch;

    let changeType: VersionChangeType;
    let breakingChangeLikelihood: BreakingChangeLikelihood;
    let riskLevel: RiskLevel;
    let upgradeComplexity: UpgradeComplexity;

    if (majorDiff > 0) {
      changeType = majorDiff > 1 ? VersionChangeType.MULTI_MAJOR : VersionChangeType.MAJOR;
      breakingChangeLikelihood = BreakingChangeLikelihood.CERTAIN;
      riskLevel = majorDiff > 2 ? RiskLevel.CRITICAL : RiskLevel.HIGH;
      upgradeComplexity = majorDiff > 1 ? UpgradeComplexity.MAJOR_EFFORT : UpgradeComplexity.COMPLEX;
    } else if (minorDiff > 0) {
      changeType = VersionChangeType.MINOR;
      breakingChangeLikelihood = this.analyzeMinorBreakingLikelihood(minorDiff, changelogContent);
      riskLevel = minorDiff > 5 ? RiskLevel.MODERATE : RiskLevel.LOW;
      upgradeComplexity = minorDiff > 3 ? UpgradeComplexity.MODERATE : UpgradeComplexity.SIMPLE;
    } else if (patchDiff > 0) {
      changeType = VersionChangeType.PATCH;
      breakingChangeLikelihood = this.analyzePatchBreakingLikelihood(patchDiff, changelogContent);
      riskLevel = RiskLevel.MINIMAL;
      upgradeComplexity = UpgradeComplexity.TRIVIAL;
    } else {
      changeType = VersionChangeType.PRERELEASE;
      breakingChangeLikelihood = BreakingChangeLikelihood.MEDIUM;
      riskLevel = RiskLevel.MODERATE;
      upgradeComplexity = UpgradeComplexity.SIMPLE;
    }

    const semverCompliance = this.analyzeSemverCompliance(fromVersion, toVersion, changelogContent);
    const recommendations = this.generateRecommendations(changeType, breakingChangeLikelihood, riskLevel);

    return {
      changeType,
      breakingChangeLikelihood,
      riskLevel,
      upgradeComplexity,
      semverCompliance,
      recommendations,
    };
  }

  private static analyzeMinorBreakingLikelihood(
    minorDiff: number,
    changelogContent?: string
  ): BreakingChangeLikelihood {
    let likelihood = BreakingChangeLikelihood.LOW;

    if (minorDiff > 10) likelihood = BreakingChangeLikelihood.MEDIUM;
    if (minorDiff > 20) likelihood = BreakingChangeLikelihood.HIGH;

    if (changelogContent) {
      const breakingIndicators = [
        /breaking/i,
        /incompatible/i,
        /removed/i,
        /deprecated/i,
        /migration/i,
      ];

      const breakingMatches = breakingIndicators.reduce((count, pattern) => {
        return count + (changelogContent.match(pattern) || []).length;
      }, 0);

      if (breakingMatches > 5) likelihood = BreakingChangeLikelihood.HIGH;
      else if (breakingMatches > 2) likelihood = BreakingChangeLikelihood.MEDIUM;
      else if (breakingMatches > 0) likelihood = BreakingChangeLikelihood.LOW;
    }

    return likelihood;
  }

  private static analyzePatchBreakingLikelihood(
    patchDiff: number,
    changelogContent?: string
  ): BreakingChangeLikelihood {
    let likelihood = BreakingChangeLikelihood.NONE;

    if (patchDiff > 50) likelihood = BreakingChangeLikelihood.LOW;

    if (changelogContent) {
      const suspiciousPatterns = [
        /major.*fix/i,
        /significant.*change/i,
        /behavior.*change/i,
        /api.*change/i,
      ];

      const matches = suspiciousPatterns.reduce((count, pattern) => {
        return count + (changelogContent.match(pattern) || []).length;
      }, 0);

      if (matches > 0) likelihood = BreakingChangeLikelihood.LOW;
    }

    return likelihood;
  }

  private static analyzeMajorChange(_from: SemanticVersion, _to: SemanticVersion): VersionAnalysis {
    return {
      changeType: VersionChangeType.MAJOR,
      breakingChangeLikelihood: BreakingChangeLikelihood.CERTAIN,
      riskLevel: RiskLevel.HIGH,
      upgradeComplexity: UpgradeComplexity.COMPLEX,
      semverCompliance: { isCompliant: true, violations: [], confidence: 1.0 },
      recommendations: this.generateRecommendations(
        VersionChangeType.MAJOR,
        BreakingChangeLikelihood.CERTAIN,
        RiskLevel.HIGH
      ),
    };
  }

  private static analyzeMinorChange(from: SemanticVersion, to: SemanticVersion): VersionAnalysis {
    const minorDiff = to.minor - from.minor;
    
    return {
      changeType: VersionChangeType.MINOR,
      breakingChangeLikelihood: minorDiff > 5 ? BreakingChangeLikelihood.MEDIUM : BreakingChangeLikelihood.LOW,
      riskLevel: minorDiff > 10 ? RiskLevel.MODERATE : RiskLevel.LOW,
      upgradeComplexity: minorDiff > 5 ? UpgradeComplexity.MODERATE : UpgradeComplexity.SIMPLE,
      semverCompliance: { isCompliant: true, violations: [], confidence: 0.9 },
      recommendations: this.generateRecommendations(
        VersionChangeType.MINOR,
        minorDiff > 5 ? BreakingChangeLikelihood.MEDIUM : BreakingChangeLikelihood.LOW,
        minorDiff > 10 ? RiskLevel.MODERATE : RiskLevel.LOW
      ),
    };
  }

  private static analyzePatchChange(_from: SemanticVersion, _to: SemanticVersion): VersionAnalysis {
    return {
      changeType: VersionChangeType.PATCH,
      breakingChangeLikelihood: BreakingChangeLikelihood.NONE,
      riskLevel: RiskLevel.MINIMAL,
      upgradeComplexity: UpgradeComplexity.TRIVIAL,
      semverCompliance: { isCompliant: true, violations: [], confidence: 0.95 },
      recommendations: this.generateRecommendations(
        VersionChangeType.PATCH,
        BreakingChangeLikelihood.NONE,
        RiskLevel.MINIMAL
      ),
    };
  }

  private static analyzePrereleaseChange(_from: SemanticVersion, _to: SemanticVersion): VersionAnalysis {
    return {
      changeType: VersionChangeType.PRERELEASE,
      breakingChangeLikelihood: BreakingChangeLikelihood.MEDIUM,
      riskLevel: RiskLevel.MODERATE,
      upgradeComplexity: UpgradeComplexity.SIMPLE,
      semverCompliance: { isCompliant: true, violations: [], confidence: 0.8 },
      recommendations: this.generateRecommendations(
        VersionChangeType.PRERELEASE,
        BreakingChangeLikelihood.MEDIUM,
        RiskLevel.MODERATE
      ),
    };
  }

  private static analyzeDowngrade(from: SemanticVersion, to: SemanticVersion): VersionAnalysis {
    return {
      changeType: VersionChangeType.DOWNGRADE,
      breakingChangeLikelihood: BreakingChangeLikelihood.HIGH,
      riskLevel: RiskLevel.HIGH,
      upgradeComplexity: UpgradeComplexity.COMPLEX,
      semverCompliance: { isCompliant: false, violations: [], confidence: 0.0 },
      recommendations: [
        {
          type: 'rollback-plan',
          priority: 'high',
          description: 'Downgrading versions can introduce compatibility issues',
          actionItems: [
            'Review compatibility matrix',
            'Test thoroughly in staging environment',
            'Prepare rollback plan',
            'Check for missing features in older version',
          ],
        },
      ],
    };
  }

  private static analyzeSemverCompliance(
    from: SemanticVersion,
    to: SemanticVersion,
    changelogContent?: string
  ): SemverCompliance {
    const violations: SemverViolation[] = [];
    let isCompliant = true;

    if (changelogContent) {
      const majorDiff = to.major - from.major;
      const minorDiff = to.minor - from.minor;
      const patchDiff = to.patch - from.patch;

      if (majorDiff === 0 && minorDiff === 0 && patchDiff > 0) {
        const hasFeatures = /(?:feat|feature|add|new)/i.test(changelogContent);
        if (hasFeatures) {
          violations.push({
            type: 'feature-in-patch',
            description: 'New features detected in patch version',
            severity: 'warning',
            evidence: ['Changelog contains feature additions'],
          });
          isCompliant = false;
        }

        const hasBreaking = /breaking/i.test(changelogContent);
        if (hasBreaking) {
          violations.push({
            type: 'breaking-in-patch',
            description: 'Breaking changes detected in patch version',
            severity: 'error',
            evidence: ['Changelog contains breaking changes'],
          });
          isCompliant = false;
        }
      }

      if (majorDiff === 0 && minorDiff > 0) {
        const hasBreaking = /breaking/i.test(changelogContent);
        if (hasBreaking) {
          violations.push({
            type: 'breaking-in-minor',
            description: 'Breaking changes detected in minor version',
            severity: 'error',
            evidence: ['Changelog contains breaking changes'],
          });
          isCompliant = false;
        }
      }
    }

    const confidence = violations.length === 0 ? 0.95 : Math.max(0.3, 0.95 - violations.length * 0.2);

    return {
      isCompliant,
      violations,
      confidence,
    };
  }

  private static generateRecommendations(
    changeType: VersionChangeType,
    breakingLikelihood: BreakingChangeLikelihood,
    riskLevel: RiskLevel
  ): VersionRecommendation[] {
    const recommendations: VersionRecommendation[] = [];

    if (changeType === VersionChangeType.MAJOR || breakingLikelihood === BreakingChangeLikelihood.CERTAIN) {
      recommendations.push({
        type: 'migration',
        priority: 'high',
        description: 'Major version changes require careful migration planning',
        actionItems: [
          'Review migration guide and breaking changes',
          'Update code to handle API changes',
          'Test all affected functionality',
          'Plan staged rollout',
        ],
      });
    }

    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      recommendations.push({
        type: 'testing',
        priority: 'high',
        description: 'Comprehensive testing required for high-risk upgrades',
        actionItems: [
          'Run full test suite',
          'Perform integration testing',
          'Test in staging environment',
          'Monitor error rates after deployment',
        ],
      });
    }

    if (changeType === VersionChangeType.MULTI_MAJOR) {
      recommendations.push({
        type: 'gradual-upgrade',
        priority: 'high',
        description: 'Consider upgrading through intermediate major versions',
        actionItems: [
          'Upgrade one major version at a time',
          'Test each intermediate version',
          'Address deprecation warnings incrementally',
        ],
      });
    }

    recommendations.push({
      type: 'documentation',
      priority: riskLevel === RiskLevel.HIGH ? 'high' : 'medium',
      description: 'Document the upgrade process and changes',
      actionItems: [
        'Document breaking changes and their impacts',
        'Update internal documentation',
        'Inform team members of changes',
      ],
    });

    recommendations.push({
      type: 'rollback-plan',
      priority: riskLevel === RiskLevel.HIGH ? 'high' : 'low',
      description: 'Prepare rollback strategy in case of issues',
      actionItems: [
        'Backup current working version',
        'Prepare quick rollback procedure',
        'Monitor key metrics after upgrade',
      ],
    });

    return recommendations;
  }

  private static analyzeIndividualJumps(
    jumps: VersionJump[],
    _changelogContent?: string
  ): Map<string, VersionAnalysis> {
    const analyses = new Map<string, VersionAnalysis>();

    for (const jump of jumps) {
      const key = `${jump.from.raw} -> ${jump.to.raw}`;
      analyses.set(key, jump.analysis);
    }

    return analyses;
  }

  private static generateMigrationPath(jumps: VersionJump[]): MigrationStep[] {
    const steps: MigrationStep[] = [];

    jumps.forEach((jump, index) => {
      const isMajor = jump.changeType === VersionChangeType.MAJOR;
      const isMultiMajor = jump.changeType === VersionChangeType.MULTI_MAJOR;

      steps.push({
        order: index + 1,
        version: jump.to.raw,
        description: `Upgrade to version ${jump.to.raw}`,
        estimatedEffort: isMajor || isMultiMajor ? 'high' : 
                        jump.changeType === VersionChangeType.MINOR ? 'medium' : 'low',
        prerequisites: isMajor ? [
          'Review breaking changes',
          'Update dependencies',
          'Test in development environment',
        ] : ['Run tests', 'Check compatibility'],
        risks: isMajor ? [
          'Breaking API changes',
          'Deprecated feature removal',
          'Performance impacts',
        ] : ['Minor compatibility issues'],
      });
    });

    return steps;
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
}