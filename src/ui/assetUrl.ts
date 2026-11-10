/**
 * Absolute URLs for public assets, for CSS custom properties.
 *
 * A relative url() inside a custom property is resolved against the stylesheet that uses the var(), not against the
 * element that sets it. In development the CSS is injected into the page, so `url(./assets/...)` worked; in a
 * production build (the PC client, `app://nine-heavens/`) the stylesheet lives in /assets/index-*.css, so the same
 * url() pointed at /assets/assets/... and every mask-tinted icon and painted backplate came out blank. Resolving the
 * path against the page here makes the url() absolute, whatever stylesheet ends up using it.
 */
export function assetUrl(path: string): string {
  return new URL(path.replace(/^\.?\//, ''), document.baseURI).href;
}

/** `url("…")` for a public asset, ready to put in a CSS custom property. */
export function cssUrl(path: string): string {
  return `url("${assetUrl(path)}")`;
}
