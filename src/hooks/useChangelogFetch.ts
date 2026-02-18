import { useState, useEffect } from 'react';

interface ChangelogData {
  breakingChanges: any[];
  newFeatures: any[];
  bugFixes: any[];
  securityFixes: any[];
  raw: string;
  summary?: any;
  metadata?: any;
  error?: string;
}

export const useChangelogFetch = (
  packageName: string,
  startVersion: string,
  endVersion: string
) => {
  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!packageName || !startVersion || !endVersion) {
      setData(null);
      return;
    }

    const fetchChangelog = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/analyze-changelog?package=${encodeURIComponent(packageName)}&start=${encodeURIComponent(startVersion)}&end=${encodeURIComponent(endVersion)}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch changelog');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching changelog:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchChangelog();
  }, [packageName, startVersion, endVersion]);

  return { data, loading, error };
};