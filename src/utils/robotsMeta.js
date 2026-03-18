export const PREVIEW_ROBOTS_DIRECTIVES =
  'max-image-preview:large, max-snippet:-1, max-video-preview:-1';

export function buildRobotsMetaContent({
  index = true,
  follow = true,
  allowRichPreview = true,
} = {}) {
  const directives = [index ? 'index' : 'noindex', follow ? 'follow' : 'nofollow'];
  if (allowRichPreview) {
    directives.push(PREVIEW_ROBOTS_DIRECTIVES);
  } else {
    directives.push('max-image-preview:none');
  }
  return directives.join(', ');
}

export const INDEX_FOLLOW_ROBOTS = buildRobotsMetaContent();
export const NOINDEX_FOLLOW_ROBOTS = buildRobotsMetaContent({ index: false });
export const NOINDEX_NOFOLLOW_ROBOTS = buildRobotsMetaContent({
  index: false,
  follow: false,
  allowRichPreview: false,
});

export function setRobotsMetaContent(content) {
  if (typeof document === 'undefined') return null;
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.appendChild(robots);
  }
  robots.setAttribute('content', content);
  return robots;
}
