import React from 'react';

interface UpgradeSummary {
  risk: 'low' | 'medium' | 'high';
  effort: 'minimal' | 'moderate' | 'significant';
  recommendation: string;
  breakingChanges: number;
  newFeatures: number;
  bugFixes: number;
  securityFixes: number;
}

interface Props {
  summary: UpgradeSummary;
}

export const UpgradeSummaryCard: React.FC<Props> = ({ summary }) => {
  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20';
      default: return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'significant': return 'text-red-600 dark:text-red-400';
      case 'moderate': return 'text-yellow-600 dark:text-yellow-400';
      default: return 'text-green-600 dark:text-green-400';
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/10 dark:to-purple-900/10 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Upgrade Summary</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Risk Level</p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(summary.risk)}`}>
            {summary.risk.toUpperCase()}
          </span>
        </div>
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Effort Required</p>
          <span className={`text-sm font-medium ${getEffortColor(summary.effort)}`}>
            {summary.effort.charAt(0).toUpperCase() + summary.effort.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.breakingChanges}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Breaking</p>
        </div>
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.newFeatures}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Features</p>
        </div>
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.bugFixes}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Bug Fixes</p>
        </div>
        <div className="text-center p-2 bg-white/50 dark:bg-gray-800/50 rounded">
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{summary.securityFixes}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">Security</p>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <span className="font-semibold">Recommendation:</span> {summary.recommendation}
        </p>
      </div>
    </div>
  );
};