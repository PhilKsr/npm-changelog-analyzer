import { ValidationError } from './errors';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

export function validatePackageName(packageName: string): ValidationResult {
  if (!packageName || typeof packageName !== 'string') {
    return {
      isValid: false,
      error: 'Package name is required',
    };
  }

  const trimmed = packageName.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Package name cannot be empty',
    };
  }

  if (trimmed.length > 214) {
    return {
      isValid: false,
      error: 'Package name is too long (max 214 characters)',
    };
  }

  // NPM package name rules
  const validNameRegex = /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
  
  if (!validNameRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Package name contains invalid characters. Use only lowercase letters, numbers, hyphens, dots, and underscores.',
    };
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /^\.+$/,           // Only dots
    /\.\./,            // Double dots
    /^_/,              // Starting with underscore
    /\s/,              // Any whitespace
    /%/,               // URL encoded characters
    /[\x00-\x1f\x7f-\x9f]/, // Control characters
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return {
        isValid: false,
        error: 'Package name contains invalid patterns',
      };
    }
  }

  return {
    isValid: true,
    sanitized: trimmed.toLowerCase(),
  };
}

export function validateSemverVersion(version: string): ValidationResult {
  if (!version || typeof version !== 'string') {
    return {
      isValid: false,
      error: 'Version is required',
    };
  }

  const trimmed = version.trim();
  
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Version cannot be empty',
    };
  }

  // Remove 'v' prefix if present
  const cleanVersion = trimmed.replace(/^v/, '');
  
  // Basic semver pattern (allows prerelease and build metadata)
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  
  if (!semverRegex.test(cleanVersion)) {
    return {
      isValid: false,
      error: 'Invalid semantic version format. Expected format: X.Y.Z or X.Y.Z-prerelease+build',
    };
  }

  return {
    isValid: true,
    sanitized: cleanVersion,
  };
}

export function validateVersionRange(startVersion: string, endVersion: string): ValidationResult {
  const startValidation = validateSemverVersion(startVersion);
  if (!startValidation.isValid) {
    return {
      isValid: false,
      error: `Invalid start version: ${startValidation.error}`,
    };
  }

  const endValidation = validateSemverVersion(endVersion);
  if (!endValidation.isValid) {
    return {
      isValid: false,
      error: `Invalid end version: ${endValidation.error}`,
    };
  }

  // Compare versions
  const startParts = startValidation.sanitized!.split('.').map(Number);
  const endParts = endValidation.sanitized!.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (endParts[i] > startParts[i]) {
      return { isValid: true };
    } else if (endParts[i] < startParts[i]) {
      return {
        isValid: false,
        error: 'End version must be newer than start version',
      };
    }
  }

  return {
    isValid: false,
    error: 'End version must be different from start version',
  };
}

export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
    .replace(/\s+/g, ' '); // Normalize whitespace
}

export function validateAndSanitizePackageName(packageName: string): string {
  const validation = validatePackageName(packageName);
  
  if (!validation.isValid) {
    throw new ValidationError('packageName', packageName, validation.error!);
  }

  return validation.sanitized!;
}

export function validateAndSanitizeVersion(version: string): string {
  const validation = validateSemverVersion(version);
  
  if (!validation.isValid) {
    throw new ValidationError('version', version, validation.error!);
  }

  return validation.sanitized!;
}

export function validateAndSanitizeVersionRange(startVersion: string, endVersion: string): {
  startVersion: string;
  endVersion: string;
} {
  const sanitizedStart = validateAndSanitizeVersion(startVersion);
  const sanitizedEnd = validateAndSanitizeVersion(endVersion);
  
  const rangeValidation = validateVersionRange(sanitizedStart, sanitizedEnd);
  
  if (!rangeValidation.isValid) {
    throw new ValidationError('versionRange', `${startVersion} to ${endVersion}`, rangeValidation.error!);
  }

  return {
    startVersion: sanitizedStart,
    endVersion: sanitizedEnd,
  };
}

export interface SearchParams {
  query: string;
  limit?: number;
  offset?: number;
}

export function validateSearchParams(params: SearchParams): SearchParams {
  const { query, limit = 8, offset = 0 } = params;

  if (!query || typeof query !== 'string') {
    throw new ValidationError('query', String(query), 'Search query is required');
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 2) {
    throw new ValidationError('query', query, 'Search query must be at least 2 characters long');
  }

  if (trimmedQuery.length > 100) {
    throw new ValidationError('query', query, 'Search query is too long (max 100 characters)');
  }

  const sanitizedQuery = sanitizeInput(trimmedQuery, 100);
  
  const numLimit = Number(limit);
  const numOffset = Number(offset);

  if (isNaN(numLimit) || numLimit < 1 || numLimit > 50) {
    throw new ValidationError('limit', String(limit), 'Limit must be between 1 and 50');
  }

  if (isNaN(numOffset) || numOffset < 0) {
    throw new ValidationError('offset', String(offset), 'Offset must be non-negative');
  }

  return {
    query: sanitizedQuery,
    limit: numLimit,
    offset: numOffset,
  };
}
// Alias for consistency with API usage
export const validateVersionString = validateSemverVersion;
