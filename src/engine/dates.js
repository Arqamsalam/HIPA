/*
 * Date detection and shifting.
 * Every date in a document moves by the same number of days, so the time between
 * events (length of stay, days since surgery...) stays correct. The shift is a
 * multiple of 7 so weekdays ("Monday") stay correct too.
 */
(function (root) {
  'use strict';

  const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'];
  const MON = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
  const DAY_MS = 86400000;

  function monthIndex(name) {
    const k = name.slice(0, 3).toLowerCase();
    return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(k) + 1;
  }

  function monthStyle(text) {
    const bare = text.replace(/\.$/, '');
    const full = MONTHS_FULL.some((m) => m.toLowerCase() === bare.toLowerCase());
    let kase = 'title';
    if (bare === bare.toUpperCase()) kase = 'upper';
    else if (bare === bare.toLowerCase()) kase = 'lower';
    return { full, kase, dot: /\.$/.test(text) };
  }

  function renderMonth(m, style) {
    let s = MONTHS_FULL[m - 1];
    if (!style.full) s = s.slice(0, 3);
    if (style.kase === 'upper') s = s.toUpperCase();
    else if (style.kase === 'lower') s = s.toLowerCase();
    if (!style.full && style.dot && m !== 5) s += '.';
    return s;
  }

  function daysInMonth(y, m) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  function fullYear(y, len) {
    if (len === 4) return y;
    return y + (y <= 30 ? 2000 : 1900);
  }

  function valid(y, m, d) {
    if (!(m >= 1 && m <= 12)) return false;
    if (d == null) return true;
    return d >= 1 && d <= daysInMonth(y == null ? 2000 : y, m);
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // Each detector returns {start, end, meta}. meta describes how to re-print the date.
  function findDates(text) {
    const out = [];
    const push = (start, end, meta) => out.push({ start, end, meta });
    let m;

    // 2024-03-14, 2024/03/14
    const iso = /(?<![\d/.-])((?:19|20)\d{2})([-/.])(0?[1-9]|1[0-2])\2(0?[1-9]|[12]\d|3[01])(?!\d|[/.-]\d)/g;
    while ((m = iso.exec(text))) {
      const y = +m[1], mo = +m[3], d = +m[4];
      if (!valid(y, mo, d)) continue;
      push(m.index, m.index + m[0].length, { fmt: 'num', order: 'ymd', sep: m[2], y, yLen: 4, m: mo, d, mPad: m[3].length === 2, dPad: m[4].length === 2 });
    }

    // 03/14/2024, 3-14-24, 14/03/2024 (day-first if the first number can't be a month)
    const num = /(?<![\d/.:-])(\d{1,2})([/-])(\d{1,2})\2(\d{4}|\d{2})(?!\d|[/.-]\d|:\d)/g;
    while ((m = num.exec(text))) {
      const a = +m[1], b = +m[3], yLen = m[4].length;
      const y = fullYear(+m[4], yLen);
      let order = 'mdy', mo = a, d = b;
      if (a > 12 && b <= 12) { order = 'dmy'; mo = b; d = a; }
      if (!valid(y, mo, d)) continue;
      push(m.index, m.index + m[0].length, {
        fmt: 'num', order, sep: m[2], y, yLen, m: mo, d,
        mPad: (order === 'mdy' ? m[1] : m[3]).length === 2,
        dPad: (order === 'mdy' ? m[3] : m[1]).length === 2
      });
    }
    // 03.14.2024
    const dotted = /(?<![\d.])(0?[1-9]|1[0-2])\.(0?[1-9]|[12]\d|3[01])\.((?:19|20)\d{2})(?!\d|\.\d)/g;
    while ((m = dotted.exec(text))) {
      const y = +m[3], mo = +m[1], d = +m[2];
      if (!valid(y, mo, d)) continue;
      push(m.index, m.index + m[0].length, { fmt: 'num', order: 'mdy', sep: '.', y, yLen: 4, m: mo, d, mPad: m[1].length === 2, dPad: m[2].length === 2 });
    }

    // March 14, 2024 / Mar. 14th / MAR 14 2024
    const named = new RegExp(`\\b${MON}(\\.?)[ \\t]+(\\d{1,2})(st|nd|rd|th)?(?:(,?)[ \\t]+((?:19|20)\\d{2}))?(?![\\d:])\\b`, 'gi');
    while ((m = named.exec(text))) {
      if (!/^[A-Z]/.test(m[1])) continue; // "may 5" in lower case is usually not a date
      const mo = monthIndex(m[1]), d = +m[3], y = m[6] ? +m[6] : null;
      if (!valid(y, mo, d)) continue;
      push(m.index, m.index + m[0].length, { fmt: 'name_md', style: monthStyle(m[1] + m[2]), y, m: mo, d, ord: !!m[4], comma: m[5] === ',' });
    }

    // 14 March 2024 / 14-MAR-2024 / 14th of March 2024
    const dayFirst = new RegExp(`\\b(\\d{1,2})(st|nd|rd|th)?([ \\t]+(?:of[ \\t]+)?|-)${MON}(\\.?)(?:(,?[ \\t]+|-)((?:19|20)\\d{2}|\\d{2}))?\\b`, 'gi');
    while ((m = dayFirst.exec(text))) {
      if (!/^[A-Z]/.test(m[4])) continue;
      const hasYear = !!m[7];
      if (!hasYear && !m[2]) continue; // "2 May" alone is too ambiguous ("take 2 May...")
      const yLen = hasYear ? m[7].length : 0;
      const y = hasYear ? fullYear(+m[7], yLen) : null;
      const mo = monthIndex(m[4]), d = +m[1];
      if (!valid(y, mo, d)) continue;
      if (hasYear && yLen === 2 && m[3] !== '-') continue; // "14 Mar 24" w/o dashes is risky
      push(m.index, m.index + m[0].length, { fmt: 'name_dm', style: monthStyle(m[4] + m[5]), y, yLen, m: mo, d, ord: !!m[2], sep1: m[3], sep2: m[6] || ' ' });
    }

    // March 2024
    const monthYear = new RegExp(`\\b${MON}(\\.?)(,?[ \\t]+)((?:19|20)\\d{2})\\b`, 'gi');
    while ((m = monthYear.exec(text))) {
      if (!/^[A-Z]/.test(m[1])) continue;
      push(m.index, m.index + m[0].length, { fmt: 'name_my', style: monthStyle(m[1] + m[2]), y: +m[4], m: monthIndex(m[1]), sep: m[3] });
    }

    // 03/2024
    const numMY = /(?<![\d/.-])(0?[1-9]|1[0-2])\/((?:19|20)\d{2})(?![\d/])/g;
    while ((m = numMY.exec(text))) {
      push(m.index, m.index + m[0].length, { fmt: 'num_my', y: +m[2], m: +m[1], mPad: m[1].length === 2 });
    }

    // Year-less 3/14, only after a word that signals a date ("on 3/14", "since 3/14", "DOS: 3/14")
    const ctx = /\b(?:on|since|from|until|till|thru|through|to|dated|DOS|admitted|discharged|seen|last|by|starting|started|beginning|before|after|date|d\/c|d\/c'd|dc|visit|f\/u|followup|follow-up)\b[ \t:]*((0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01]))(?![\d/]|\.\d)/gi;
    while ((m = ctx.exec(text))) {
      const mo = +m[2], d = +m[3];
      if (!valid(null, mo, d)) continue;
      const start = m.index + m[0].length - m[1].length;
      push(start, start + m[1].length, { fmt: 'num', order: 'mdy', sep: '/', y: null, yLen: 0, m: mo, d, mPad: m[2].length === 2, dPad: m[3].length === 2 });
    }

    // Keep the longest match when two patterns overlap.
    out.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    for (const s of out) {
      const last = kept[kept.length - 1];
      if (last && s.start < last.end) continue;
      kept.push(s);
    }
    return kept;
  }

  function pad(n, yes) {
    return yes && n < 10 ? '0' + n : String(n);
  }

  function shiftParts(meta, offsetDays) {
    const baseY = meta.y == null ? 2000 : meta.y;
    const day = meta.d == null ? 15 : meta.d;
    const t = Date.UTC(baseY, meta.m - 1, day) + offsetDays * DAY_MS;
    const dt = new Date(t);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }

  function formatDate(meta, parts) {
    const { y, m, d } = parts;
    const yy = (len) => (len === 2 ? String(y % 100).padStart(2, '0') : String(y));
    switch (meta.fmt) {
      case 'num': {
        const M = pad(m, meta.mPad), D = pad(d, meta.dPad);
        if (meta.order === 'ymd') return [y, M, D].join(meta.sep);
        const md = meta.order === 'dmy' ? [D, M] : [M, D];
        if (meta.yLen) md.push(yy(meta.yLen));
        return md.join(meta.sep);
      }
      case 'name_md': {
        let s = renderMonth(m, meta.style) + ' ' + (meta.ord ? ordinal(d) : d);
        if (meta.y != null) s += (meta.comma ? ', ' : ' ') + y;
        return s;
      }
      case 'name_dm': {
        let s = (meta.ord ? ordinal(d) : d) + meta.sep1 + renderMonth(m, meta.style);
        if (meta.y != null) s += meta.sep2 + yy(meta.yLen);
        return s;
      }
      case 'name_my':
        return renderMonth(m, meta.style) + meta.sep + y;
      case 'num_my':
        return pad(m, meta.mPad) + '/' + y;
      default:
        return '[DATE]';
    }
  }

  function shiftDate(meta, offsetDays) {
    return formatDate(meta, shiftParts(meta, offsetDays));
  }

  // Random offset of 4–52 weeks, forward or backward, chosen once per document.
  function offsetFromRng(rng) {
    const weeks = 4 + Math.floor(rng() * 49);
    return (rng() < 0.5 ? -1 : 1) * weeks * 7;
  }

  const api = { findDates, shiftDate, offsetFromRng, monthIndex };
  root.DeidDates = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
