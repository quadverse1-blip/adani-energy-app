import { CONFIG } from '../config';

/**
 * Resolves a photo URL (Base64 data URI, relative /uploads/xxx.jpg, or full URL)
 * to an accessible URI that React Native Image components can render reliably.
 */
export const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // 1. Embedded Base64 Data URI or Blob: directly displayable without network latency
  if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const cleanBase = CONFIG.API_BASE_URL.replace(/\/+$/, '');

  // 2. Dead Firebase Storage link without download token (403): Fallback to backend /uploads/
  if (trimmed.includes('firebasestorage.googleapis.com') && !trimmed.includes('token=')) {
    const match = trimmed.match(/\/o\/([^?]+)/);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]);
      const filename = decoded.split('/').pop();
      if (filename) {
        return `${cleanBase}/uploads/${filename}`;
      }
    }
  }

  // 3. Absolute http / https / file URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file:')
  ) {
    return trimmed;
  }

  // 4. Relative paths like /uploads/xyz.jpg or uploads/xyz.jpg
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${cleanBase}${cleanPath}`;
};
