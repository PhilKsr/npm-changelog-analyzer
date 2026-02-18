'use client';

import { useState, useEffect } from 'react';
import PackageSearch from '@/components/PackageSearch';
import VersionSelector from '@/components/VersionSelector';
import ChangelogDisplay from '@/components/ChangelogDisplay';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Home() {
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [selectedVersions, setSelectedVersions] = useState<{
    startVersion: string;
    endVersion: string;
  }>({
    startVersion: '',
    endVersion: '',
  });
  const [packageVersions, setPackageVersions] = useState<string[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);


  const handlePackageSelect = (pkg: string) => {
    setSelectedPackage(pkg);
    setSelectedVersions({ startVersion: '', endVersion: '' });
    setIsLoadingVersions(true);
  };

  const handleVersionsLoad = (versions: string[]) => {
    setPackageVersions(versions);
    setIsLoadingVersions(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header />
      
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
              Smart Package Upgrade Analysis
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Make informed decisions about npm package upgrades with intelligent changelog analysis
            </p>
          </div>

          {/* Search and Version Selection */}
          <div className="mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="p-6 space-y-6">
                <PackageSearch
                  selectedPackage={selectedPackage}
                  onPackageSelect={handlePackageSelect}
                  onVersionsLoad={handleVersionsLoad}
                />
                
                {selectedPackage && (
                  <VersionSelector
                    versions={packageVersions}
                    selectedVersions={selectedVersions}
                    onVersionChange={setSelectedVersions}
                    loading={isLoadingVersions}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Results Section */}
          <div>
            <ChangelogDisplay
              packageName={selectedPackage}
              startVersion={selectedVersions.startVersion}
              endVersion={selectedVersions.endVersion}
            />
          </div>

          {/* Info Section */}
          {!selectedPackage && (
            <div className="mt-12 text-center">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                Why Use Changelog Analysis?
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg mb-3">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Breaking Changes
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Detect API changes that could break your app
                  </p>
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg mb-3">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Security Fixes
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Identify critical security updates
                  </p>
                </div>

                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg mb-3">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Risk Assessment
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Get upgrade complexity scores
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
