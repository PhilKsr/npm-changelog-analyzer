'use client';

import { useState, useEffect } from 'react';
import { marked } from 'marked';

interface ChangelogEntry {
  version: string;
  content: string;
  type: 'breaking' | 'feature' | 'fix' | 'security' | 'performance' | 'documentation' | 'other';
  category: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  raw: string;
  publishedAt?: string;
}

interface ChangelogData {
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
  error?: string;
}

interface ChangelogDisplayProps {
  packageName: string;
  startVersion: string;
  endVersion: string;
}

export default function ChangelogDisplay({
  packageName,
  startVersion,
  endVersion,
}: ChangelogDisplayProps) {
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChangelog = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/analyze-changelog?package=${encodeURIComponent(packageName)}&start=${encodeURIComponent(startVersion)}&end=${encodeURIComponent(endVersion)}`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        setChangelog(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch changelog');
        setChangelog(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (packageName && startVersion && endVersion) {
      fetchChangelog();
    }
  }, [packageName, startVersion, endVersion]);

  if (!packageName || !startVersion || !endVersion) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 mb-4 text-gray-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Ready to analyze changelog
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Select a package and choose version range to see detailed changelog analysis with breaking changes, new features, and upgrade recommendations.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Loading header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-64 mb-2"></div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-500 border-t-transparent"></div>
              <span className="text-sm text-gray-600 dark:text-gray-300">Analyzing...</span>
            </div>
          </div>
        </div>
        
        {/* Loading summary */}
        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-blue-200 dark:bg-blue-800 rounded w-48 mb-4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="text-center">
                  <div className="h-8 bg-blue-200 dark:bg-blue-800 rounded w-16 mx-auto mb-2"></div>
                  <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-20 mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Loading cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="animate-pulse">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 mb-4 text-red-500">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Failed to analyze changelog
          </h3>
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error}
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p className="mb-2">This could happen if:</p>
            <ul className="text-left inline-block space-y-1">
              <li>• The package doesn't have a changelog</li>
              <li>• The specified versions don't exist</li>
              <li>• The package repository is private or inaccessible</li>
              <li>• Network connectivity issues</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!changelog) {
    return null;
  }

  const parseMarkdownContent = async (content: string): Promise<string> => {
    try {
      const html = await marked(content);
      return html;
    } catch {
      return content;
    }
  };

  const formatContent = (content: string): string => {
    const cleanContent = content
      .replace(/^\s*[-*+]\s*/, '')
      .replace(/^\s*\d+\.\s*/, '')
      .replace(/^\s*[#]+\s*/, '')
      .trim();
    
    return cleanContent.charAt(0).toUpperCase() + cleanContent.slice(1);
  };

  const getImpactLevel = (item: ChangelogEntry): { level: string; color: string } => {
    const content = item.content.toLowerCase();
    
    if (content.includes('breaking') || content.includes('removed') || content.includes('deprecated')) {
      return { level: 'Breaking', color: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' };
    }
    if (item.severity === 'high' || content.includes('security') || content.includes('vulnerability')) {
      return { level: 'High', color: 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200' };
    }
    if (item.severity === 'medium' || content.includes('performance') || content.includes('major')) {
      return { level: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200' };
    }
    return { level: 'Low', color: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' };
  };

  const ChangelogSection = ({ 
    title, 
    items, 
    icon, 
    emptyMessage,
    bgColor,
    borderColor,
    priority = false
  }: {
    title: string;
    items: ChangelogEntry[];
    icon: React.ReactNode;
    emptyMessage: string;
    bgColor: string;
    borderColor: string;
    priority?: boolean;
  }) => (
    <div className={`${bgColor} border ${borderColor} rounded-xl shadow-sm overflow-hidden ${priority ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 ring-red-200 dark:ring-red-800' : ''}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              {icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {items.length} {items.length === 1 ? 'change' : 'changes'}
              </p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            items.length === 0 ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
            priority ? 'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200' :
            'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
          }`}>
            {items.length}
          </span>
        </div>
        
        {items.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 dark:text-gray-400 italic text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {items.map((item, index) => {
              const impact = getImpactLevel(item);
              const formattedContent = formatContent(item.content);
              
              return (
                <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors group">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-2 h-2 rounded-full ${
                        item.severity === 'high' ? 'bg-red-500' :
                        item.severity === 'medium' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-gray-900 dark:text-gray-100 text-sm leading-relaxed font-medium group-hover:text-gray-700 dark:group-hover:text-gray-200">
                          {formattedContent}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                        {item.version && (
                          <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded font-mono border border-blue-200 dark:border-blue-800">
                            v{item.version}
                          </span>
                        )}
                        <span className={`px-2 py-1 rounded font-medium border ${impact.color} ${impact.color.includes('red') ? 'border-red-200 dark:border-red-800' : impact.color.includes('yellow') ? 'border-yellow-200 dark:border-yellow-800' : 'border-green-200 dark:border-green-800'}`}>
                          {impact.level} Impact
                        </span>
                        {item.confidence && item.confidence > 0 && (
                          <span className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700">
                            {Math.round(item.confidence * 100)}% confidence
                          </span>
                        )}
                        {item.publishedAt && (
                          <span className="px-2 py-1 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded border border-gray-200 dark:border-gray-700">
                            {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg border border-blue-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Changelog Analysis
                </h1>
                <div className="flex items-center space-x-3 text-sm">
                  <span className="px-3 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full font-mono border border-gray-200 dark:border-gray-600">
                    {packageName}
                  </span>
                  <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                    <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded font-mono text-xs">
                      v{startVersion}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded font-mono text-xs">
                      v{endVersion}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {changelog?.source && (
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-gray-500 dark:text-gray-400">Source:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  changelog.source === 'github-changelog' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200' :
                  changelog.source === 'github-releases' ? 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200' :
                  changelog.source === 'npm-readme' ? 'bg-orange-100 text-orange-800 dark:bg-orange-800 dark:text-orange-200' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                }`}>
                  {changelog.source.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {changelog.summary && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Analysis Summary</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Upgrade impact assessment and recommendations</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                <div className={`px-4 py-2 rounded-lg text-sm font-medium border-2 ${
                  changelog.summary.riskScore > 70 ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                  changelog.summary.riskScore > 40 ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
                  'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                }`}>
                  <div className="text-xs opacity-75">Risk Score</div>
                  <div className="text-lg font-bold">{changelog.summary.riskScore}/100</div>
                </div>
                <div className={`px-4 py-2 rounded-lg text-sm font-medium border-2 ${
                  changelog.summary.upgradeComplexity === 'high' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' :
                  changelog.summary.upgradeComplexity === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800' :
                  'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                }`}>
                  <div className="text-xs opacity-75">Complexity</div>
                  <div className="font-bold capitalize">{changelog.summary.upgradeComplexity}</div>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 text-center border border-gray-200 dark:border-gray-700">
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{changelog.summary.totalChanges}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Changes</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center border border-red-200 dark:border-red-800">
                <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">{changelog.summary.breakingChangesCount}</div>
                <div className="text-sm text-red-700 dark:text-red-300">Breaking Changes</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center border border-green-200 dark:border-green-800">
                <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{changelog.summary.newFeaturesCount}</div>
                <div className="text-sm text-green-700 dark:text-green-300">New Features</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 text-center border border-purple-200 dark:border-purple-800">
                <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{changelog.securityFixes.length}</div>
                <div className="text-sm text-purple-700 dark:text-purple-300">Security Fixes</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Priority Section - Breaking Changes and Security Fixes */}
      {(changelog.breakingChanges.length > 0 || changelog.securityFixes.length > 0) && (
        <div className="space-y-6">
          <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>Critical Changes - Action Required</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChangelogSection
              title="Breaking Changes"
              items={changelog.breakingChanges}
              icon={
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              }
              emptyMessage="No breaking changes detected between these versions."
              bgColor="bg-red-50 dark:bg-red-900/10"
              borderColor="border-red-200 dark:border-red-800"
              priority={true}
            />

            <ChangelogSection
              title="Security Fixes"
              items={changelog.securityFixes}
              icon={
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              emptyMessage="No security fixes detected between these versions."
              bgColor="bg-purple-50 dark:bg-purple-900/10"
              borderColor="border-purple-200 dark:border-purple-800"
              priority={true}
            />
          </div>
        </div>
      )}

      {/* Regular Changes */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Features & Improvements</span>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChangelogSection
            title="New Features"
            items={changelog.newFeatures}
            icon={
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            }
            emptyMessage="No new features detected between these versions."
            bgColor="bg-green-50 dark:bg-green-900/10"
            borderColor="border-green-200 dark:border-green-800"
          />

          <ChangelogSection
            title="Bug Fixes"
            items={changelog.bugFixes}
            icon={
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            }
            emptyMessage="No bug fixes detected between these versions."
            bgColor="bg-blue-50 dark:bg-blue-900/10"
            borderColor="border-blue-200 dark:border-blue-800"
          />

          <ChangelogSection
            title="Performance Improvements"
            items={changelog.performanceImprovements}
            icon={
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            emptyMessage="No performance improvements detected between these versions."
            bgColor="bg-orange-50 dark:bg-orange-900/10"
            borderColor="border-orange-200 dark:border-orange-800"
          />

          <ChangelogSection
            title="Documentation & Other"
            items={[...changelog.documentation, ...changelog.other]}
            icon={
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            emptyMessage="No documentation or other changes detected between these versions."
            bgColor="bg-gray-50 dark:bg-gray-900/10"
            borderColor="border-gray-200 dark:border-gray-700"
          />
        </div>
      </div>

      {changelog.raw && (
        <details className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <summary className="p-6 cursor-pointer text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-between group">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <span className="font-medium text-lg">Raw Changelog</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">View the complete, unprocessed changelog content</p>
              </div>
            </div>
            <svg className="w-5 h-5 transform group-hover:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-6 pb-6 border-t border-gray-100 dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Raw Content</span>
                <button
                  onClick={() => navigator.clipboard.writeText(changelog.raw)}
                  className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors"
                >
                  Copy
                </button>
              </div>
              <pre className="overflow-x-auto text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
                {changelog.raw}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}