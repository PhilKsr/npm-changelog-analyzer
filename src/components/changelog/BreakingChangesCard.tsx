import React from 'react';

interface BreakingChange {
  description: string;
  impact: 'low' | 'medium' | 'high';
  migration?: string;
}

interface Props {
  changes: BreakingChange[];
}

export const BreakingChangesCard: React.FC<Props> = ({ changes }) => {
  if (changes.length === 0) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-3">
        Breaking Changes ({changes.length})
      </h3>
      <ul className="space-y-2">
        {changes.map((change, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">{change.description}</p>
              {change.migration && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Migration: {change.migration}
                </p>
              )}
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded ${
                change.impact === 'high' 
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                  : change.impact === 'medium'
                  ? 'bg-orange-200 dark:bg-orange-800 text-orange-800 dark:text-orange-200'
                  : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
              }`}>
                {change.impact} impact
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};