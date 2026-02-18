'use client';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Content */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="p-1 bg-blue-600 rounded">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-medium text-gray-900 dark:text-white">
              NPM Changelog Analyzer
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Smart changelog analysis for informed package upgrade decisions
          </p>

          {/* External Links */}
          <div className="flex items-center justify-center space-x-6 text-sm">
            <a
              href="https://keepachangelog.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Keep a Changelog
            </a>
            <a
              href="https://semver.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Semantic Versioning
            </a>
          </div>

          {/* Copyright */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              &copy; {currentYear} NPM Changelog Analyzer • Built with Next.js
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}