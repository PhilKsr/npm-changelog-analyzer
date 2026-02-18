import React from 'react';

interface SecurityFix {
  cve?: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  version: string;
}

interface Props {
  fixes: SecurityFix[];
}

export const SecurityFixesCard: React.FC<Props> = ({ fixes }) => {
  if (fixes.length === 0) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-300';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300';
      default:
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-300';
    }
  };

  return (
    <div className="bg-purple-50 dark:bg-purple-900/10 border-l-4 border-purple-500 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Security Fixes ({fixes.length})
      </h3>
      <div className="space-y-2">
        {fixes.map((fix, idx) => (
          <div key={idx} className={`p-3 rounded border ${getSeverityColor(fix.severity)}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {fix.cve && (
                  <span className="font-mono text-xs font-semibold">{fix.cve}: </span>
                )}
                <span className="text-sm">{fix.description}</span>
              </div>
              <div className="flex items-center gap-2 ml-3">
                <span className="text-xs font-medium uppercase">{fix.severity}</span>
                <span className="text-xs opacity-75">v{fix.version}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};