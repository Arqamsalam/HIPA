/*
 * The pipeline:  detect  →  resolve overlaps  →  spread names  →  replace.
 *
 *   const result = Deid.deidentify(text, { seed: 'abc' });
 *   result.output    // the cleaned text
 *   result.segments  // pieces of output, for highlighting in the UI
 *   result.mapping   // original → replacement table (contains PHI! never share)
 */
(function (root) {
  'use strict';

  const Det = root.DeidDetectors || require('./detectors.js');
  const S = root.DeidSurrogates || require('./surrogates.js');

  const DEFAULTS = {
    seed: 'default-seed',
    style: 'realistic',        // 'realistic' | 'tags'
    dates: 'shift',            // 'shift' | 'tag'
    replaceClinicians: true,   // also replace doctor / nurse names
    customTerms: [],           // [{term, replacement}]
    ignoreTerms: []            // strings never to replace
  };

  const TYPE_LABELS = {
    NAME: 'Name', DATE: 'Date', AGE: 'Age 90+', PHONE: 'Phone/Fax', EMAIL: 'Email', SSN: 'SSN',
    ID: 'ID / record number', ADDRESS: 'Street address', CITY: 'City/town', COUNTY: 'County',
    ZIP: 'ZIP code', FACILITY: 'Facility', SCHOOL: 'School', EMPLOYER: 'Employer', URL: 'Web URL',
    IP: 'IP address', CUSTOM: 'Custom term', HINT: 'Review hint'
  };

  function parseTermList(text) {
    return String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
      const m = l.match(/^(.+?)\s*(?:=>|=|→)\s*(.*)$/);
      return m ? { term: m[1].trim(), replacement: m[2].trim() } : { term: l, replacement: '' };
    });
  }

  function deidentify(text, options) {
    const opts = Object.assign({}, DEFAULTS, options || {});
    text = String(text || '');
    const ignore = new Set((opts.ignoreTerms || []).map((t) => t.trim().toLowerCase()).filter(Boolean));
    const isIgnored = (s) => ignore.has(s.text.trim().toLowerCase());

    let spans = Det.detectAll(text, opts).filter((s) => !isIgnored(s) || s.type === 'CUSTOM');
    let accepted = Det.resolveOverlaps(spans);

    // Clinician names kept on request: remember them so they are not re-found later.
    const keptRanges = [];
    if (!opts.replaceClinicians) {
      accepted = accepted.filter((s) => {
        if (s.type === 'NAME' && s.meta.clinician) { keptRanges.push(s); return false; }
        return true;
      });
    }
    const clinicianWords = new Set();
    keptRanges.forEach((s) => s.text.split(/[ \t,]+/).forEach((w) => clinicianWords.add(w.replace(/['’]s$|\.$/g, '').toLowerCase())));
    const blocked = new Set([...ignore, ...clinicianWords]);

    const extra = Det.propagateNames(text, accepted, blocked)
      .filter((s) => !isIgnored(s))
      .filter((s) => !keptRanges.some((k) => s.start < k.end && k.start < s.end));
    accepted = Det.resolveOverlaps(accepted.concat(extra, Det.propagateCities(text, accepted, ignore)));
    // Spans that sit inside a clinician name that the user chose to keep are dropped.
    accepted = accepted.filter((s) => !(s.type === 'NAME' && keptRanges.some((k) => s.start < k.end && k.start < s.end)));

    const sur = new S.Surrogates(opts, text);
    sur.oldPatient = accepted.some((s) => s.type === 'AGE') || accepted.some((s) => {
      if (s.type !== 'DATE' || !s.meta.dob || s.meta.y == null) return false;
      const ref = Math.max(new Date().getUTCFullYear(), ...accepted.filter((d) => d.type === 'DATE' && !d.meta.dob && d.meta.y).map((d) => d.meta.y));
      return ref - s.meta.y >= 90;
    });
    sur.prepare(accepted);

    const segments = [];
    const mapping = new Map();
    const stats = {};
    let pos = 0;
    accepted.forEach((s, i) => {
      if (s.start > pos) segments.push({ kind: 'text', text: text.slice(pos, s.start) });
      if (s.type === 'HINT') {
        segments.push({ kind: 'hint', text: s.text, original: s.text, type: s.type, note: s.meta.note, id: i, start: s.start, end: s.end });
      } else {
        const rep = sur.replace(s);
        segments.push({ kind: 'span', text: rep, original: s.text, type: s.type, confidence: s.confidence, id: i, start: s.start, end: s.end, clinician: !!s.meta.clinician });
        const key = s.type + '|' + s.text;
        if (!mapping.has(key)) mapping.set(key, { type: s.type, original: s.text, replacement: rep, count: 0 });
        mapping.get(key).count++;
        stats[s.type] = (stats[s.type] || 0) + 1;
      }
      pos = s.end;
    });
    if (pos < text.length) segments.push({ kind: 'text', text: text.slice(pos) });
    const out = segments.map((g) => g.text).join('');

    const review = segments.filter((g) => g.kind === 'hint' || g.confidence === 'medium');
    return {
      output: out,
      segments,
      spans: accepted,
      mapping: [...mapping.values()],
      stats,
      review,
      dateOffsetDays: sur.offsetDays,
      oldPatient: sur.oldPatient
    };
  }

  const api = { deidentify, parseTermList, DEFAULTS, TYPE_LABELS };
  root.Deid = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
