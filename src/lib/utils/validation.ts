export function validatePackageName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  
  const dangerousPatterns = [
    /[<>:"|?*]/,
    /\.\./,
    /^[._]/,
    /\s/,
    /[^\x00-\x7F]/
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(name));
}

export function validateVersion(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  
  const semverPattern = /^v?\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/;
  return semverPattern.test(version);
}

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 500);
}