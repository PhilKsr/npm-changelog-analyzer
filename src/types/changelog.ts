export interface BreakingChange {
  description: string;
  impact: 'low' | 'medium' | 'high';
  migration?: string;
  version?: string;
  category?: string;
}

export interface SecurityFix {
  cve?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  version: string;
  advisory?: string;
}

export interface Feature {
  description: string;
  category?: string;
  version?: string;
  experimental?: boolean;
}

export interface BugFix {
  description: string;
  issue?: string;
  version?: string;
  category?: string;
}

export interface ChangelogMetadata {
  packageName: string;
  startVersion: string;
  endVersion: string;
  totalChanges: number;
  versionsCovered: number;
  generatedAt: string;
  repository?: string;
  homepage?: string;
}

export interface UpgradeSummary {
  risk: 'low' | 'medium' | 'high';
  effort: 'minimal' | 'moderate' | 'significant';
  recommendation: string;
  breakingChanges: number;
  newFeatures: number;
  bugFixes: number;
  securityFixes: number;
  estimatedTime?: string;
  requiredActions?: string[];
}

export interface ChangelogAnalysis {
  breakingChanges: BreakingChange[];
  securityFixes: SecurityFix[];
  newFeatures: Feature[];
  bugFixes: BugFix[];
  summary: UpgradeSummary;
  metadata: ChangelogMetadata;
  raw: string;
  error?: string;
}

export interface VersionInfo {
  version: string;
  date?: string;
  deprecated?: boolean;
  lts?: boolean;
  latest?: boolean;
}