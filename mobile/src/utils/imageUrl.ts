import { CONFIG } from '../config';

/**
 * Resolves a photo URL (relative e.g. /uploads/xxx.jpg or full http/https/file/data)
 * to an absolute URL that React Native Image components can render.
 */
export const resolvePhotoUrl = (url?: string | null): string | undefined => {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  const cleanBase = CONFIG.API_BASE_URL.replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${cleanBase}${cleanPath}`;
};

