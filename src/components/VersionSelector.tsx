'use client';

import { useMemo } from 'react';

interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
  raw: string;
  original: string;
}

interface VersionSelectorProps {
  versions: string[];
  selectedVersions: {
    startVersion: string;
    endVersion: string;
  };
  onVersionChange: (versions: { startVersion: string; endVersion: string }) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function VersionSelector({
  versions,
  selectedVersions,
  onVersionChange,
  disabled = false,
  loading = false,
}: VersionSelectorProps) {
  const parseSemanticVersion = (version: string): SemanticVersion => {
    const cleanVersion = version.replace(/^v/, '').replace(/[^\d.a-zA-Z-+]/g, '');
    
    const parts = cleanVersion.split('.');
    const major = parseInt(parts[0]) || 0;
    const minor = parseInt(parts[1]) || 0;
    
    let patch = 0;
    let prerelease: string | undefined;
    let build: string | undefined;

    if (parts[2]) {
      const patchParts = parts[2].split(/[-+]/);
      patch = parseInt(patchParts[0]) || 0;
      
      if (patchParts.length > 1) {
        const remaining = patchParts.slice(1).join('-');
        if (remaining.includes('+')) {
          const [pre, bld] = remaining.split('+');
          prerelease = pre;
          build = bld;
        } else {
          prerelease = remaining;
        }
      }
    }

    return {
      major,
      minor,
      patch,
      prerelease,
      build,
      raw: `${major}.${minor}.${patch}${prerelease ? `-${prerelease}` : ''}${build ? `+${build}` : ''}`,
      original: version,
    };
  };

  const compareVersions = (a: SemanticVersion, b: SemanticVersion): number => {
    if (a.major !== b.major) return b.major - a.major;
    if (a.minor !== b.minor) return b.minor - a.minor;
    if (a.patch !== b.patch) return b.patch - a.patch;
    
    if (a.prerelease && !b.prerelease) return 1;
    if (!a.prerelease && b.prerelease) return -1;
    if (a.prerelease && b.prerelease) {
      return b.prerelease.localeCompare(a.prerelease);
    }
    
    return 0;
  };

  const sortedVersions = useMemo(() => {
    return [...versions]
      .map(parseSemanticVersion)
      .sort(compareVersions)
      .map(v => v.original);
  }, [versions]);

  const isValidVersionRange = useMemo(() => {
    if (!selectedVersions.startVersion || !selectedVersions.endVersion) return true;
    
    const startSemver = parseSemanticVersion(selectedVersions.startVersion);
    const endSemver = parseSemanticVersion(selectedVersions.endVersion);
    
    return compareVersions(endSemver, startSemver) < 0;
  }, [selectedVersions.startVersion, selectedVersions.endVersion]);

  const handleStartVersionChange = (version: string) => {
    onVersionChange({
      ...selectedVersions,
      startVersion: version,
    });
  };

  const handleEndVersionChange = (version: string) => {
    onVersionChange({
      ...selectedVersions,
      endVersion: version,
    });
  };

  const getFilteredEndVersions = () => {
    if (!selectedVersions.startVersion) return sortedVersions;
    
    const startSemver = parseSemanticVersion(selectedVersions.startVersion);
    return sortedVersions.filter(version => {
      const versionSemver = parseSemanticVersion(version);
      return compareVersions(versionSemver, startSemver) < 0;
    });
  };

  const getFilteredStartVersions = () => {
    if (!selectedVersions.endVersion) return sortedVersions;
    
    const endSemver = parseSemanticVersion(selectedVersions.endVersion);
    return sortedVersions.filter(version => {
      const versionSemver = parseSemanticVersion(version);
      return compareVersions(versionSemver, endSemver) > 0;
    });
  };

  const getVersionType = (version: string): string => {
    const semver = parseSemanticVersion(version);
    if (semver.prerelease) {
      return `prerelease (${semver.prerelease})`;
    }
    if (semver.major === 0) {
      return 'development';
    }
    return 'stable';
  };

  const getVersionInfo = (version: string) => {
    const semver = parseSemanticVersion(version);
    const type = getVersionType(version);
    const isLatest = sortedVersions[0] === version;
    
    return { semver, type, isLatest };
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            From Version (Older)
          </label>
          <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse">
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            To Version (Newer)
          </label>
          <div className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 animate-pulse">
            <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="mx-auto w-16 h-16 mb-4 text-gray-400">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No versions available
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Please select a package first to see its available versions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label htmlFor="start-version" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            From Version (Older)
            {getFilteredStartVersions().length === 0 && selectedVersions.endVersion && (
              <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                No older versions available
              </span>
            )}
          </label>
          <div className="relative">
            <select
              id="start-version"
              value={selectedVersions.startVersion}
              onChange={(e) => handleStartVersionChange(e.target.value)}
              disabled={disabled || getFilteredStartVersions().length === 0}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select starting version</option>
              {getFilteredStartVersions().map((version) => {
                const info = getVersionInfo(version);
                return (
                  <option key={version} value={version}>
                    v{version} {info.isLatest ? '(latest)' : ''} {info.semver.prerelease ? '(prerelease)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedVersions.startVersion && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {(() => {
                const info = getVersionInfo(selectedVersions.startVersion);
                return (
                  <span>
                    Type: <span className="font-medium">{info.type}</span>
                    {info.isLatest && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs">Latest</span>
                    )}
                  </span>
                );
              })()} 
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="end-version" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            To Version (Newer)
            {getFilteredEndVersions().length === 0 && selectedVersions.startVersion && (
              <span className="ml-2 text-xs text-orange-600 dark:text-orange-400">
                No newer versions available
              </span>
            )}
          </label>
          <div className="relative">
            <select
              id="end-version"
              value={selectedVersions.endVersion}
              onChange={(e) => handleEndVersionChange(e.target.value)}
              disabled={disabled || getFilteredEndVersions().length === 0}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select ending version</option>
              {getFilteredEndVersions().map((version) => {
                const info = getVersionInfo(version);
                return (
                  <option key={version} value={version}>
                    v{version} {info.isLatest ? '(latest)' : ''} {info.semver.prerelease ? '(prerelease)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
          {selectedVersions.endVersion && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {(() => {
                const info = getVersionInfo(selectedVersions.endVersion);
                return (
                  <span>
                    Type: <span className="font-medium">{info.type}</span>
                    {info.isLatest && (
                      <span className="ml-2 px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs">Latest</span>
                    )}
                  </span>
                );
              })()} 
            </div>
          )}
        </div>
      </div>

      {/* Validation Error */}
      {!isValidVersionRange && selectedVersions.startVersion && selectedVersions.endVersion && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700 dark:text-red-400">
              Invalid version range: The "To" version must be newer than the "From" version.
            </p>
          </div>
        </div>
      )}

      {/* Version Range Summary */}
      {selectedVersions.startVersion && selectedVersions.endVersion && isValidVersionRange && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200">
              Version Range Analysis
            </h3>
            <div className="flex items-center space-x-2 text-sm">
              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded text-xs font-medium">
                v{selectedVersions.startVersion}
              </span>
              <span className="text-gray-500 dark:text-gray-400">→</span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded text-xs font-medium">
                v{selectedVersions.endVersion}
              </span>
            </div>
          </div>
          
          {(() => {
            const startSemver = parseSemanticVersion(selectedVersions.startVersion);
            const endSemver = parseSemanticVersion(selectedVersions.endVersion);
            const majorDiff = endSemver.major - startSemver.major;
            const minorDiff = endSemver.minor - startSemver.minor;
            const patchDiff = endSemver.patch - startSemver.patch;
            
            let changeType = 'patch';
            let riskLevel = 'Low';
            let riskColor = 'text-green-600 dark:text-green-400';
            
            if (majorDiff > 0) {
              changeType = 'major';
              riskLevel = 'High';
              riskColor = 'text-red-600 dark:text-red-400';
            } else if (minorDiff > 0) {
              changeType = 'minor';
              riskLevel = majorDiff === 0 && minorDiff > 2 ? 'Medium' : 'Low';
              riskColor = riskLevel === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400';
            }
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Change Type:</span>
                  <span className={`font-medium capitalize ${
                    changeType === 'major' ? 'text-red-600 dark:text-red-400' :
                    changeType === 'minor' ? 'text-blue-600 dark:text-blue-400' :
                    'text-green-600 dark:text-green-400'
                  }`}>
                    {changeType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Risk Level:</span>
                  <span className={`font-medium ${riskColor}`}>
                    {riskLevel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Version Jumps:</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {majorDiff > 0 && `${majorDiff} major${majorDiff > 1 ? 's' : ''}`}
                    {majorDiff > 0 && (minorDiff > 0 || patchDiff > 0) && ', '}
                    {minorDiff > 0 && `${minorDiff} minor${minorDiff > 1 ? 's' : ''}`}
                    {minorDiff > 0 && patchDiff > 0 && ', '}
                    {patchDiff > 0 && `${patchDiff} patch${patchDiff > 1 ? 'es' : ''}`}
                    {majorDiff === 0 && minorDiff === 0 && patchDiff === 0 && 'Same version'}
                  </span>
                </div>
              </div>
            );
          })()} 
          
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 text-center">
            Ready to analyze changelog between these versions
          </p>
        </div>
      )}
    </div>
  );
}