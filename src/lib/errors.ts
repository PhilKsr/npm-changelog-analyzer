export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'UNKNOWN_ERROR',
    isOperational: boolean = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.context = context;

    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class PackageNotFoundError extends AppError {
  constructor(packageName: string) {
    super(
      `Package "${packageName}" not found on npm registry`,
      404,
      'PACKAGE_NOT_FOUND',
      true,
      { packageName }
    );
  }
}

export class VersionNotFoundError extends AppError {
  constructor(packageName: string, version: string) {
    super(
      `Version "${version}" not found for package "${packageName}"`,
      404,
      'VERSION_NOT_FOUND',
      true,
      { packageName, version }
    );
  }
}

export class InvalidVersionRangeError extends AppError {
  constructor(startVersion: string, endVersion: string) {
    super(
      `Invalid version range: "${startVersion}" to "${endVersion}". End version must be newer than start version.`,
      400,
      'INVALID_VERSION_RANGE',
      true,
      { startVersion, endVersion }
    );
  }
}

export class NoChangelogFoundError extends AppError {
  constructor(packageName: string) {
    super(
      `No changelog found for package "${packageName}". The package may not maintain a changelog or the repository is inaccessible.`,
      404,
      'NO_CHANGELOG_FOUND',
      true,
      { packageName }
    );
  }
}

export class RateLimitExceededError extends AppError {
  constructor(service: string, resetTime?: number) {
    super(
      `Rate limit exceeded for ${service}${resetTime ? `. Try again in ${Math.ceil((resetTime - Date.now()) / 1000)} seconds.` : '.'}`,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { service, resetTime }
    );
  }
}

export class NetworkTimeoutError extends AppError {
  constructor(url: string, timeout: number) {
    super(
      `Network request timed out after ${timeout}ms: ${url}`,
      408,
      'NETWORK_TIMEOUT',
      true,
      { url, timeout }
    );
  }
}

export class GitHubAPIError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(
      `GitHub API error: ${message}`,
      statusCode,
      'GITHUB_API_ERROR',
      true
    );
  }
}

export class NPMRegistryError extends AppError {
  constructor(message: string, statusCode: number = 500) {
    super(
      `NPM Registry error: ${message}`,
      statusCode,
      'NPM_REGISTRY_ERROR',
      true
    );
  }
}

export class ValidationError extends AppError {
  constructor(field: string, value: string, reason: string) {
    super(
      `Invalid ${field}: "${value}". ${reason}`,
      400,
      'VALIDATION_ERROR',
      true,
      { field, value, reason }
    );
  }
}

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    statusCode: number;
    context?: Record<string, unknown>;
    suggestions?: string[];
    timestamp: string;
    requestId?: string;
  };
}

export function createErrorResponse(
  error: AppError | Error, 
  requestId?: string,
  suggestions: string[] = []
): ErrorResponse {
  if (error instanceof AppError) {
    return {
      error: {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        context: error.context,
        suggestions,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  }

  return {
    error: {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      suggestions,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };
}

export function getErrorSuggestions(error: AppError): string[] {
  switch (error.code) {
    case 'PACKAGE_NOT_FOUND':
      return [
        'Check the package name spelling',
        'Verify the package exists on npmjs.com',
        'Try searching for similar package names',
      ];
    
    case 'VERSION_NOT_FOUND':
      return [
        'Check if the version number is correct',
        'Verify the version exists on npmjs.com',
        'Try using a different version number',
      ];
    
    case 'INVALID_VERSION_RANGE':
      return [
        'Ensure the end version is newer than the start version',
        'Use proper semantic versioning (e.g., 1.0.0)',
        'Check the version order in the dropdown',
      ];
    
    case 'NO_CHANGELOG_FOUND':
      return [
        'The package may not maintain a changelog',
        'Check the package repository manually',
        'Try a different package or version range',
        'Look for release notes on GitHub',
      ];
    
    case 'RATE_LIMIT_EXCEEDED':
      return [
        'Wait a few minutes before trying again',
        'Try analyzing fewer packages at once',
        'Use the tool during off-peak hours',
      ];
    
    case 'NETWORK_TIMEOUT':
      return [
        'Check your internet connection',
        'Try refreshing the page',
        'The service may be temporarily unavailable',
      ];
    
    case 'VALIDATION_ERROR':
      return [
        'Check the input format',
        'Use only valid characters',
        'Follow the expected input pattern',
      ];
    
    default:
      return [
        'Try refreshing the page',
        'Check your internet connection',
        'Report this issue if it persists',
      ];
  }
}

export function isRetryableError(error: AppError): boolean {
  const retryableCodes = [
    'NETWORK_TIMEOUT',
    'RATE_LIMIT_EXCEEDED',
    'GITHUB_API_ERROR',
    'NPM_REGISTRY_ERROR',
  ];
  
  return retryableCodes.includes(error.code) || 
    (error.statusCode >= 500 && error.statusCode < 600);
}

export function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 10000);
}