export type PageLink = number | '…';

/**
 * The 1-based pages to offer from `current`: the ends, the neighbours, and the pages halfway
 * to either end, so a user can bisect a long sorted list; '…' marks every gap.
 */
export function pageLinks(current: number, last: number): PageLink[] {
  const halfwayBack = Math.floor((1 + current) / 2);
  const halfwayOn = Math.ceil((current + 1 + last) / 2);
  const pages = [1, halfwayBack, current - 1, current, current + 1, halfwayOn, last]
    .filter((page, i, all) => page >= 1 && page <= last && all.indexOf(page) === i)
    .sort((a, b) => a - b);
  const links: PageLink[] = [];
  pages.forEach((page, i) => {
    if (i > 0 && page - pages[i - 1] > 1) {
      links.push('…');
    }
    links.push(page);
  });
  return links;
}
