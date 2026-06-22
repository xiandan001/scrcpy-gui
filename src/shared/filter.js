import { levelOrder } from './logTypes';

export function matchFilter(entry, filter) {
  if (filter.minLevel && entry.level) {
    if (levelOrder[entry.level] < levelOrder[filter.minLevel]) return false;
  }

  if (typeof filter.pid === 'number') {
    if (entry.pid !== filter.pid) return false;
  }

  if (filter.pkg) {
    const p = (entry.pkg ?? '').toLowerCase();
    if (!p.includes(filter.pkg.toLowerCase())) return false;
  }

  if (filter.tag) {
    const t = (entry.tag ?? '').toLowerCase();
    if (!t.includes(filter.tag.toLowerCase())) return false;
  }

  const hay = (entry.raw ?? '').toLowerCase();

  if (filter.text) {
    if (!hay.includes(filter.text.toLowerCase())) return false;
  }

  if (filter.excludeText) {
    if (hay.includes(filter.excludeText.toLowerCase())) return false;
  }

  if (filter.regex) {
    try {
      const re = new RegExp(filter.regex, filter.regexFlags ?? 'i');
      if (!re.test(entry.raw)) return false;
    } catch {
      return false;
    }
  }

  return true;
}

export function filterEntries(entries, filter) {
  if (!filter || (!filter.minLevel && !filter.text && !filter.excludeText && !filter.tag && typeof filter.pid !== 'number' && !filter.pkg && !filter.regex)) {
    return entries;
  }
  return entries.filter((e) => matchFilter(e, filter));
}

export function countByLevel(entries) {
  return entries.reduce(
    (acc, e) => {
      if (e.level) acc[e.level] = (acc[e.level] ?? 0) + 1;
      return acc;
    },
    { V: 0, D: 0, I: 0, W: 0, E: 0, F: 0, A: 0 }
  );
}
