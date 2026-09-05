/** Public URL base for harvested figure assets (Supabase Storage). */
const ASSET_HOST =
  'https://asnrquijopjjqfjvwalc.supabase.co/storage/v1/object/public/question-assets/'

/**
 * Resolve an asset path from question data to a URL.
 *
 * Harvested ssqb figures are internal-use College Board content and stay
 * gitignored, so they can never reach the git-driven Vercel build — they are
 * uploaded to the public `question-assets` Supabase Storage bucket instead
 * (scripts/upload-assets.py) and load from there at runtime. Anything else
 * (bundled app assets) stays same-origin.
 */
export function assetUrl(path: string): string {
  return /^assets\/(ssqb-|figures\/ssqb-|choiceimg\/ssqb-)/.test(path)
    ? `${ASSET_HOST}${path}`
    : `/${path}`
}
