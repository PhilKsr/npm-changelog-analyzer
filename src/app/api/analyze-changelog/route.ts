import { NextRequest, NextResponse } from 'next/server'
import { apiRateLimiter, getRateLimitHeaders, getClientIP } from '@/lib/rateLimiter'
import { MasterChangelogParser, IntelligentChangelogAnalysis } from '@/lib/masterChangelogParser'
import {
  PackageNotFoundError,
  VersionNotFoundError,
  InvalidVersionRangeError,
  NoChangelogFoundError,
  NetworkTimeoutError,
  NPMRegistryError,
  ValidationError,
  createErrorResponse,
  getErrorSuggestions,
  AppError,
} from '@/lib/errors'
import { validatePackageName, validateSemverVersion } from '@/lib/validation'
import { changelogCache, packageCache, generateChangelogKey, getCachedData, setCachedData } from '@/lib/cache'

interface NpmPackageInfo {
  name: string
  repository?: {
    type: string
    url: string
  }
  homepage?: string
  bugs?: {
    url: string
  }
  readme?: string
}

interface GitHubRepo {
  owner: string
  repo: string
}

interface GitHubRelease {
  tag_name: string
  name: string
  body: string
  published_at: string
  draft: boolean
  prerelease: boolean
}

export async function GET(request: NextRequest) {
  const clientIP = getClientIP(request)
  const rateLimit = apiRateLimiter.check(clientIP)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
      }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const packageName = searchParams.get('package')?.trim()
  const startVersion = searchParams.get('start')?.trim()
  const endVersion = searchParams.get('end')?.trim()
  // const includeCommits = searchParams.get('include_commits') === 'true';

  // Validate required parameters
  if (!packageName || !startVersion || !endVersion) {
    const error = new ValidationError(
      'parameters',
      `package=${packageName}, start=${startVersion}, end=${endVersion}`,
      'Package name, start version, and end version are required'
    )
    const suggestions = getErrorSuggestions(error)
    const errorResponse = createErrorResponse(error, undefined, suggestions)

    return NextResponse.json(
      {
        ...errorResponse,
        breakingChanges: [],
        newFeatures: [],
        bugFixes: [],
        securityFixes: [],
        performanceImprovements: [],
        documentation: [],
        other: [],
        summary: {
          totalChanges: 0,
          breakingChangesCount: 0,
          newFeaturesCount: 0,
          riskScore: 0,
          upgradeComplexity: 'low' as const,
        },
        raw: '',
        source: 'github-changelog' as const,
      },
      {
        status: error.statusCode,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
      }
    )
  }

  try {
    // Validate input parameters
    const packageValidation = validatePackageName(packageName)
    if (!packageValidation.isValid) {
      throw new ValidationError('package name', packageName, packageValidation.error!)
    }

    const startVersionValidation = validateSemverVersion(startVersion)
    if (!startVersionValidation.isValid) {
      throw new ValidationError('start version', startVersion, startVersionValidation.error!)
    }

    const endVersionValidation = validateSemverVersion(endVersion)
    if (!endVersionValidation.isValid) {
      throw new ValidationError('end version', endVersion, endVersionValidation.error!)
    }

    // Check cache first
    const cacheKey = generateChangelogKey(packageName, startVersion, endVersion)
    let analysisResult = getCachedData<Record<string, unknown>>(changelogCache, cacheKey)

    if (!analysisResult) {
      // Cache miss - perform analysis
      analysisResult = await intelligentAnalyzeChangelog(packageName, startVersion, endVersion)

      // Cache the result for 30 minutes (changelog data doesn't change frequently)
      setCachedData(changelogCache, cacheKey, analysisResult, 30 * 60 * 1000)
    }

    return NextResponse.json(analysisResult, {
      headers: {
        ...getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    })
  } catch (error) {
    console.error('Error analyzing changelog:', error)

    let appError: AppError

    if (error instanceof AppError) {
      appError = error
    } else if (error instanceof Error) {
      if (error.name === 'AbortError') {
        appError = new NetworkTimeoutError('API request', 30000)
      } else if (error.message.includes('not found')) {
        appError = new NoChangelogFoundError(packageName)
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('fetch failed')) {
        appError = new NetworkTimeoutError('External service', 10000)
      } else {
        appError = new AppError(error.message || 'An unexpected error occurred', 500, 'UNKNOWN_ERROR')
      }
    } else {
      appError = new AppError('An unexpected error occurred', 500, 'UNKNOWN_ERROR')
    }

    const suggestions = getErrorSuggestions(appError)
    const errorResponse = createErrorResponse(appError, undefined, suggestions)

    return NextResponse.json(
      {
        ...errorResponse,
        breakingChanges: [],
        newFeatures: [],
        bugFixes: [],
        securityFixes: [],
        performanceImprovements: [],
        documentation: [],
        other: [],
        summary: {
          totalChanges: 0,
          breakingChangesCount: 0,
          newFeaturesCount: 0,
          riskScore: 0,
          upgradeComplexity: 'low' as const,
        },
        raw: '',
        source: 'github-changelog' as const,
      },
      {
        status: appError.statusCode,
        headers: getRateLimitHeaders(rateLimit.remainingRequests, rateLimit.resetTime),
      }
    )
  }
}

async function intelligentAnalyzeChangelog(
  packageName: string,
  startVersion: string,
  endVersion: string
): Promise<Record<string, unknown>> {
  let gitHubRepo: GitHubRepo | null = null

  try {
    gitHubRepo = await getGitHubRepo(packageName)
  } catch (error) {
    console.warn(`Failed to get GitHub repo for ${packageName}:`, error)
    // Continue without repository info - we can still try npm registry
  }

  try {
    const analysis = await MasterChangelogParser.analyze(
      packageName,
      startVersion,
      endVersion,
      gitHubRepo
        ? {
            owner: gitHubRepo.owner,
            repo: gitHubRepo.repo,
            platform: 'github',
          }
        : undefined
    )

    return transformToLegacyFormat(analysis)
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('No changelog found')) {
        throw new NoChangelogFoundError(packageName)
      } else if (error.message.includes('fetch failed') || error.message.includes('ENOTFOUND')) {
        throw new NetworkTimeoutError('External API', 10000)
      }
    }
    throw new AppError(
      `Failed to analyze changelog: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500,
      'ANALYSIS_FAILED',
      true,
      { packageName, startVersion, endVersion }
    )
  }
}

function transformToLegacyFormat(analysis: IntelligentChangelogAnalysis): Record<string, unknown> {
  const breakingChanges = analysis.categorizedChanges
    .filter(change => change.category === 'breaking')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'breaking',
      category: change.subcategory || 'Breaking Changes',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const newFeatures = analysis.categorizedChanges
    .filter(change => change.category === 'feature')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'feature',
      category: change.subcategory || 'Features',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const bugFixes = analysis.categorizedChanges
    .filter(change => change.category === 'fix')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'fix',
      category: change.subcategory || 'Bug Fixes',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const securityFixes = analysis.categorizedChanges
    .filter(change => change.category === 'security')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'security',
      category: change.subcategory || 'Security',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const performanceImprovements = analysis.categorizedChanges
    .filter(change => change.category === 'performance')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'performance',
      category: change.subcategory || 'Performance',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const documentation = analysis.categorizedChanges
    .filter(change => change.category === 'documentation')
    .map(change => ({
      version: '',
      content: change.text,
      type: 'documentation',
      category: change.subcategory || 'Documentation',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  const other = analysis.categorizedChanges
    .filter(change => !['breaking', 'feature', 'fix', 'security', 'performance', 'documentation'].includes(change.category))
    .map(change => ({
      version: '',
      content: change.text,
      type: 'other',
      category: change.subcategory || 'Other',
      severity: change.severity,
      confidence: change.confidence,
      raw: change.text,
      metadata: change.metadata,
    }))

  return {
    breakingChanges,
    newFeatures,
    bugFixes,
    securityFixes,
    performanceImprovements,
    documentation,
    other,
    summary: {
      totalChanges: analysis.summary.totalChanges,
      breakingChangesCount: analysis.summary.breakingChangesCount,
      newFeaturesCount: analysis.summary.newFeaturesCount,
      riskScore: analysis.summary.riskScore,
      upgradeComplexity: analysis.summary.upgradeComplexity,
    },
    raw: analysis.selectedSource.content,
    source: analysis.selectedSource.source,
    metadata: {
      format: analysis.format.type,
      confidence: analysis.metadata.confidence,
      processingTime: analysis.metadata.processingTimeMs,
      warnings: analysis.metadata.warnings,
      versionAnalysis: analysis.versionAnalysis,
      repositoryInfo: analysis.metadata.repositoryInfo,
    },
  }
}

async function getGitHubRepo(packageName: string): Promise<GitHubRepo | null> {
  // Check cache first
  const cacheKey = `github_repo:${packageName.toLowerCase()}`
  const cached = getCachedData<GitHubRepo | null>(packageCache, cacheKey)

  if (cached !== null) {
    return cached
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        throw new PackageNotFoundError(packageName)
      } else if (response.status >= 500) {
        throw new NPMRegistryError(`Registry returned ${response.status}: ${response.statusText}`)
      }
      return null
    }

    const packageInfo: NpmPackageInfo = await response.json()

    const repoUrl = packageInfo.repository?.url || packageInfo.homepage || packageInfo.bugs?.url

    if (!repoUrl) {
      return null
    }

    const githubMatch = repoUrl.match(/github\.com[\/:]([^\/]+)\/([^\/\s.]+)/i)

    if (githubMatch) {
      return {
        owner: githubMatch[1],
        repo: githubMatch[2].replace(/\.git$/, ''),
      }
    }

    return null
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof AppError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new NetworkTimeoutError(`https://registry.npmjs.org/${packageName}`, 10000)
    }

    throw new NPMRegistryError(`Failed to fetch package info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function fetchChangelogFromGitHubFiles(repo: GitHubRepo): Promise<string | null> {
  const possibleFilenames = [
    'CHANGELOG.md',
    'CHANGELOG.rst',
    'CHANGELOG.txt',
    'CHANGELOG',
    'HISTORY.md',
    'HISTORY.rst',
    'HISTORY.txt',
    'HISTORY',
    'RELEASES.md',
    'RELEASES.rst',
    'NEWS.md',
    'NEWS.rst',
    'CHANGES.md',
    'CHANGES.rst',
    'docs/CHANGELOG.md',
    'docs/HISTORY.md',
    '.changeset/CHANGELOG.md',
  ]

  const branches = ['main', 'master', 'develop']

  for (const branch of branches) {
    for (const filename of possibleFilenames) {
      try {
        const url = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${branch}/${filename}`

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const response = await fetch(url, {
          headers: {
            'User-Agent': 'npm-changelog-analyzer/1.0.0',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.ok) {
          const content = await response.text()
          if (content.trim().length > 200) {
            return content
          }
        }
      } catch {
        continue
      }
    }
  }

  return null
}

async function fetchChangelogFromGitHubReleases(
  repo: GitHubRepo,
  startVersion: string,
  endVersion: string
): Promise<string | null> {
  try {
    const releasesUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/releases?per_page=100`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(releasesUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const releases: GitHubRelease[] = await response.json()

    if (!Array.isArray(releases) || releases.length === 0) {
      return null
    }

    const relevantReleases = releases
      .filter(release => {
        if (release.draft) return false
        const version = release.tag_name.replace(/^v/, '')
        return isVersionInRange(version, startVersion, endVersion)
      })
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

    if (relevantReleases.length === 0) {
      return null
    }

    const changelogEntries = relevantReleases
      .filter(release => release.body && release.body.trim().length > 20)
      .map(release => {
        const version = release.tag_name.replace(/^v/, '')
        const date = new Date(release.published_at).toISOString().split('T')[0]
        return `## ${version} - ${date}

${release.body}
`
      })

    return changelogEntries.length > 0 ? changelogEntries.join('\n') : null
  } catch {
    return null
  }
}

async function fetchChangelogFromCommits(repo: GitHubRepo, startVersion: string, endVersion: string): Promise<string | null> {
  try {
    const commitsUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/compare/v${startVersion}...v${endVersion}`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(commitsUrl, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const data = await response.json()

    if (!data.commits || data.commits.length === 0) {
      return null
    }

    const commitMessages = data.commits
      .map((commit: { commit: { message: string } }) => commit.commit.message.split('\n')[0])
      .filter((message: string) => message && !message.toLowerCase().includes('merge'))
      .slice(0, 50)

    if (commitMessages.length === 0) {
      return null
    }

    return `## Changes from ${startVersion} to ${endVersion}

${commitMessages.map((msg: string) => `- ${msg}`).join('\n')}`
  } catch {
    return null
  }
}

async function fetchChangelogFromNpm(packageName: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(packageName)}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'npm-changelog-analyzer/1.0.0',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      return null
    }

    const packageInfo: NpmPackageInfo = await response.json()

    if (packageInfo.readme && packageInfo.readme.toLowerCase().includes('changelog')) {
      const changelogSection = extractChangelogFromReadme(packageInfo.readme)
      if (changelogSection) {
        return changelogSection
      }
    }

    return null
  } catch {
    return null
  }
}

function extractChangelogFromReadme(readme: string): string | null {
  const lines = readme.split('\n')
  let isInChangelogSection = false
  let changelogLines: string[] = []
  let depth = 0

  for (const line of lines) {
    const headerMatch = line.match(/^(#+)\s*(.*)/)

    if (headerMatch) {
      const headerDepth = headerMatch[1].length
      const headerText = headerMatch[2].toLowerCase()

      if (
        headerText.includes('changelog') ||
        headerText.includes('changes') ||
        headerText.includes('history') ||
        headerText.includes('releases')
      ) {
        isInChangelogSection = true
        depth = headerDepth
        changelogLines = [line]
        continue
      }

      if (isInChangelogSection && headerDepth <= depth) {
        break
      }
    }

    if (isInChangelogSection) {
      changelogLines.push(line)
    }
  }

  const changelogText = changelogLines.join('\n').trim()
  return changelogText.length > 200 ? changelogText : null
}

function isVersionInRange(version: string, startVersion: string, endVersion: string): boolean {
  const parseVersion = (v: string) => v.split('.').map(n => parseInt(n) || 0)

  const versionParts = parseVersion(version)
  const startParts = parseVersion(startVersion)
  const endParts = parseVersion(endVersion)

  const compareVersions = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const aPart = a[i] || 0
      const bPart = b[i] || 0
      if (aPart > bPart) return 1
      if (aPart < bPart) return -1
    }
    return 0
  }

  return compareVersions(versionParts, startParts) > 0 && compareVersions(versionParts, endParts) <= 0
}
