'use client';

import { useState, useEffect } from 'react';
import { useDebounce, useApi, useClickOutside } from '@/lib/hooks';

interface Package {
  name: string;
  description: string;
  version: string;
  keywords: string[];
  maintainers: number;
  quality: number;
  popularity: number;
  finalScore: number;
  links: {
    npm: string;
    homepage?: string;
    repository?: string;
  };
}

interface PackageSearchResponse {
  packages: Package[];
  total: number;
}

interface PackageSearchProps {
  selectedPackage: string;
  onPackageSelect: (packageName: string) => void;
  onVersionsLoad: (versions: string[]) => void;
  disabled?: boolean;
}

export default function PackageSearch({
  selectedPackage,
  onPackageSelect,
  onVersionsLoad,
  disabled = false,
}: PackageSearchProps) {
  const [query, setQuery] = useState(selectedPackage);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const debouncedQuery = useDebounce(query, 300);
  const searchApi = useApi<PackageSearchResponse>();
  const versionsApi = useApi<{ versions: string[] }>();

  const searchRef = useClickOutside<HTMLDivElement>(() => {
    setShowSuggestions(false);
    setSelectedIndex(-1);
  });

  useEffect(() => {
    setQuery(selectedPackage);
  }, [selectedPackage]);

  useEffect(() => {
    if (debouncedQuery.length >= 2 && debouncedQuery !== selectedPackage) {
      searchApi.execute(`/api/search-packages?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
    } else {
      searchApi.reset();
    }
  }, [debouncedQuery, selectedPackage]);

  useEffect(() => {
    if (searchApi.data && searchApi.data.packages.length > 0) {
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  }, [searchApi.data]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length < 2) {
      setShowSuggestions(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || !searchApi.data?.packages.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchApi.data!.packages.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handlePackageSelect(searchApi.data.packages[selectedIndex].name);
        } else if (searchApi.data.packages.length === 1) {
          handlePackageSelect(searchApi.data.packages[0].name);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handlePackageSelect = async (packageName: string) => {
    setQuery(packageName);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onPackageSelect(packageName);

    // Fetch versions for selected package
    await versionsApi.execute(`/api/package-versions?package=${encodeURIComponent(packageName)}`);
  };

  useEffect(() => {
    if (versionsApi.data?.versions) {
      onVersionsLoad(versionsApi.data.versions);
    }
  }, [versionsApi.data, onVersionsLoad]);

  const handleFocus = () => {
    if (query.length >= 2 && searchApi.data?.packages.length) {
      setShowSuggestions(true);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-200';
  };

  return (
    <div className="space-y-2" ref={searchRef}>
      <label htmlFor="package-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Search NPM Package
        {searchApi.error && versionsApi.error && (
          <span className="ml-2 text-xs text-red-500">Error occurred</span>
        )}
      </label>
      <div className="relative">
        <div className="relative">
          <input
            id="package-search"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            disabled={disabled}
            placeholder="e.g., react, lodash, express, @types/node..."
            className="w-full pl-4 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            autoComplete="off"
          />
          
          <div className="absolute right-3 top-3">
            {searchApi.loading && (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
            )}
            
            {versionsApi.loading && (
              <div className="animate-pulse">
                <div className="w-5 h-5 bg-blue-500 rounded"></div>
              </div>
            )}

            {query && !searchApi.loading && !versionsApi.loading && (
              <button
                onClick={() => {
                  setQuery('');
                  setShowSuggestions(false);
                  searchApi.reset();
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                type="button"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {showSuggestions && searchApi.data?.packages && searchApi.data.packages.length > 0 && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-80 overflow-y-auto">
            {searchApi.data.packages.map((pkg, index) => (
              <button
                key={pkg.name}
                onClick={() => handlePackageSelect(pkg.name)}
                className={`w-full px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {pkg.name}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getScoreColor(pkg.finalScore)}`}>
                        {Math.round(pkg.finalScore * 100)}%
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">
                      {pkg.description}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>v{pkg.version}</span>
                      {pkg.maintainers > 0 && (
                        <span>{pkg.maintainers} maintainer{pkg.maintainers > 1 ? 's' : ''}</span>
                      )}
                      {pkg.keywords.length > 0 && (
                        <div className="flex gap-1">
                          {pkg.keywords.slice(0, 2).map(keyword => (
                            <span key={keyword} className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {keyword}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    {pkg.links.repository && (
                      <a
                        href={pkg.links.repository}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </button>
            ))}
            
            {searchApi.data.total > searchApi.data.packages.length && (
              <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-100 dark:border-gray-700">
                Showing {searchApi.data.packages.length} of {searchApi.data.total} packages
              </div>
            )}
          </div>
        )}

        {showSuggestions && searchApi.data?.packages && searchApi.data.packages.length === 0 && !searchApi.loading && query.length >= 2 && (
          <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg p-6">
            <div className="text-center">
              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                No packages found matching <strong>&quot;{query}&quot;</strong>
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                Try adjusting your search terms
              </p>
            </div>
          </div>
        )}

        {searchApi.error && (
          <div className="absolute z-20 w-full mt-1 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4">
            <div className="flex items-center text-red-700 dark:text-red-400">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm">{searchApi.error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}