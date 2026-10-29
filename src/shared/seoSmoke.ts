import {
  canonicalPublicUrl,
  getLocalizedSeo,
  localizedPath,
  SEO_LANGUAGES,
  type SeoLanguage,
  type SeoPage
} from './seo';

function readAttribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2] ?? null;
}

export function validateLocalizedSeoHtml(input: {
  html: string;
  language: SeoLanguage;
  pathname: string;
  origin: string;
  page?: SeoPage;
}): string[] {
  const errors: string[] = [];
  const htmlTag = /<html\b[^>]*>/i.exec(input.html)?.[0] || '';
  if (readAttribute(htmlTag, 'lang') !== input.language) errors.push('language');
  const expectedMetadata = getLocalizedSeo(input.page || 'home', input.language);
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(input.html)?.[1]?.trim();
  if (title !== expectedMetadata.title) errors.push('title');
  const localeMeta = (input.html.match(/<meta\b[^>]*>/gi) || []).find(tag =>
    readAttribute(tag, 'property')?.toLowerCase() === 'og:locale'
  );
  if (!localeMeta || readAttribute(localeMeta, 'content') !== expectedMetadata.ogLocale) errors.push('og:locale');

  const expectedCanonical = canonicalPublicUrl(input.pathname, input.language, input.origin);
  const linkTags = input.html.match(/<link\b[^>]*>/gi) || [];
  const canonical = linkTags.find(tag => readAttribute(tag, 'rel')?.toLowerCase() === 'canonical');
  if (!canonical || readAttribute(canonical, 'href') !== expectedCanonical) errors.push('canonical');

  for (const language of SEO_LANGUAGES) {
    const alternate = linkTags.find(tag =>
      readAttribute(tag, 'rel')?.toLowerCase() === 'alternate'
      && readAttribute(tag, 'hreflang')?.toLowerCase() === language
    );
    if (!alternate
      || readAttribute(alternate, 'href') !== `${input.origin}${localizedPath(input.pathname, language)}`) {
      errors.push(`hreflang:${language}`);
    }
  }

  return errors;
}

export function isExpectedPrimaryRootRedirect(status: number, location: string | null): boolean {
  return status === 302 && location === '/it/';
}
