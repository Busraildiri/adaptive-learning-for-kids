const APP_ASSETS_PREFIX = "app-assets:";

export function resolveAssetUri(uri: string): string {
  if (uri.startsWith(APP_ASSETS_PREFIX)) {
    return `/assets/${uri.slice(APP_ASSETS_PREFIX.length)}`;
  }
  return uri;
}
