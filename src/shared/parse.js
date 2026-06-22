const threadtimeRe =
  /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFA])\s+([^:]+):\s?(.*)$/;

const timeRe =
  /^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}\.\d{3})\s+([VDIWEFA])\/([^(\s]+)\(\s*(\d+)\):\s?(.*)$/;

function toEpoch(mmdd, hhmmss) {
  const year = new Date().getFullYear();
  const [mm, dd] = mmdd.split('-').map((v) => Number(v));
  const [hms, ms] = hhmmss.split('.');
  const [hh, mi, ss] = hms.split(':').map((v) => Number(v));
  const d = new Date(year, mm - 1, dd, hh, mi, ss, Number(ms));
  return d.getTime();
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function parseLogLine(source, line) {
  const trimmed = line.replace(/\r?\n$/, '');

  const m1 = trimmed.match(threadtimeRe);
  if (m1) {
    const [, mmdd, hhmmss, pid, tid, level, tag, msg] = m1;
    const pkgMatch = msg.match(/\[pkg:([^\]]+)\]\s*$/);
    const pkg = pkgMatch ? pkgMatch[1] : undefined;
    const cleanMsg = pkgMatch ? msg.slice(0, msg.length - pkgMatch[0].length) : msg;
    return {
      id: cryptoRandomId(),
      source,
      ts: toEpoch(mmdd, hhmmss),
      raw: trimmed,
      pid: Number(pid),
      tid: Number(tid),
      level: level,
      tag: tag.trim(),
      pkg,
      message: cleanMsg
    };
  }

  const m2 = trimmed.match(timeRe);
  if (m2) {
    const [, mmdd, hhmmss, level, tag, pid, msg] = m2;
    const pkgMatch = msg.match(/\[pkg:([^\]]+)\]\s*$/);
    const pkg = pkgMatch ? pkgMatch[1] : undefined;
    const cleanMsg = pkgMatch ? msg.slice(0, msg.length - pkgMatch[0].length) : msg;
    return {
      id: cryptoRandomId(),
      source,
      ts: toEpoch(mmdd, hhmmss),
      raw: trimmed,
      pid: Number(pid),
      level: level,
      tag: tag.trim(),
      pkg,
      message: cleanMsg
    };
  }

  return {
    id: cryptoRandomId(),
    source,
    ts: Date.now(),
    raw: trimmed,
    message: trimmed
  };
}
