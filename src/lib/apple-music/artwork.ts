export function normalizeAppleMusicArtworkUrl(
  url: string | null | undefined,
  size = 632,
  format: 'jpg' | 'png' | 'webp' = 'jpg',
) {
  const normalizedUrl = String(url ?? '').trim();
  if (!normalizedUrl) return null;

  const templatedUrl = normalizedUrl
    .replace('{w}', String(size))
    .replace('{h}', String(size))
    .replace('{f}', format);

  if (templatedUrl !== normalizedUrl) {
    return templatedUrl;
  }

  return normalizedUrl.replace(/\/\d+x\d+(bb(?:-\d+)?)\.(jpg|png|webp)$/i, `/${size}x${size}$1.${format}`);
}
