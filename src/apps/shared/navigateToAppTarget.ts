import type { RudaAppTarget } from '../appTarget';

export function navigateToAppTarget(target: RudaAppTarget, additionalParams: Record<string, string> = {}) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('ruda-app', target);
  for (const [key, value] of Object.entries(additionalParams)) {
    nextUrl.searchParams.set(key, value);
  }
  window.location.assign(nextUrl.toString());
}
