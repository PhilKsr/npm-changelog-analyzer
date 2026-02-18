export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  };
  license?: string;
  author?: string | { name: string; email?: string };
  maintainers?: Array<{ name: string; email?: string }>;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface PackageSearchResult {
  name: string;
  description?: string;
  version: string;
  links?: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  score?: number;
  searchScore?: number;
}

export interface PackageVersions {
  name: string;
  versions: string[];
  latest?: string;
  next?: string;
  beta?: string;
  alpha?: string;
  distTags?: Record<string, string>;
  time?: Record<string, string>;
}

export interface NpmRegistryResponse {
  _id: string;
  _rev: string;
  name: string;
  description?: string;
  'dist-tags': Record<string, string>;
  versions: Record<string, PackageInfo>;
  time: Record<string, string>;
  maintainers?: Array<{ name: string; email: string }>;
  repository?: {
    type: string;
    url: string;
  };
  readme?: string;
  readmeFilename?: string;
  homepage?: string;
  keywords?: string[];
  bugs?: {
    url?: string;
    email?: string;
  };
  license?: string;
}