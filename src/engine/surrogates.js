/*
 * Surrogates: turn each detected identifier into a realistic fake (or a tag),
 * consistently — the same original always gets the same replacement in a document.
 */
(function (root) {
  'use strict';

  const D = root.DeidData || require('./data.js');
  const R = root.DeidRng || require('./rng.js');
  const Dates = root.DeidDates || require('./dates.js');

  const lower = (s) => s.toLowerCase();

  function applyCase(original, fake) {
    if (original.length > 1 && original === original.toUpperCase() && /[A-Z]/.test(original)) return fake.toUpperCase();
    if (original === original.toLowerCase()) return fake.toLowerCase();
    return fake;
  }

  // Replace each digit/letter of `original` with a random one, keeping punctuation and layout.
  function formatPreserving(original, rng, opts) {
    opts = opts || {};
    let firstDigit = true;
    return original.replace(/[0-9A-Za-z]/g, (c) => {
      if (/\d/.test(c)) {
        let d = Math.floor(rng() * 10);
        if (firstDigit && c !== '0' && d === 0) d = 1 + Math.floor(rng() * 9);
        firstDigit = false;
        return String(d);
      }
      if (opts.hex && /[a-f]/i.test(c)) {
        const h = '0123456789abcdef'[Math.floor(rng() * 16)];
        return c === c.toUpperCase() ? h.toUpperCase() : h;
      }
      const l = String.fromCharCode(65 + Math.floor(rng() * 26));
      return c === c.toUpperCase() ? l : l.toLowerCase();
    });
  }

  class Surrogates {
    constructor(opts, text) {
      this.opts = opts;
      this.seed = opts.seed || 'default-seed';
      this.cache = new Map();          // type|original -> replacement
      this.nameMap = new Map();        // lower name word -> fake word
      this.initialMap = new Map();     // 'J' -> 'M'
      this.roleHint = new Map();       // lower name word -> 'first' | 'last'
      this.entityOf = new Map();       // lower name word -> entity number (for tags)
      this.sexHint = new Map();        // lower name word -> 'm' | 'f' (from "is a 72-year-old male")
      this.entityCount = 0;
      this.tagCounters = {};
      this.used = new Set();
      this.docWords = new Set((text.match(/[A-Za-z]+/g) || []).map(lower));
      this.offsetDays = opts.dateOffsetDays != null ? opts.dateOffsetDays : Dates.offsetFromRng(R.rngFor(this.seed, 'date-offset'));
      this.oldPatient = false;
      this.urlCount = 0;
    }

    rng(key) { return R.rngFor(this.seed, key); }

    pickUnique(list, key) {
      const rng = this.rng(key);
      const start = Math.floor(rng() * list.length);
      for (let i = 0; i < list.length; i++) {
        const c = list[(start + i) % list.length];
        if (!this.used.has(lower(c)) && !this.docWords.has(lower(c))) {
          this.used.add(lower(c));
          return c;
        }
      }
      return list[start] + String(Math.floor(rng() * 90) + 10);
    }

    tag(type, key) {
      const k = type + '|' + key;
      if (!this.cache.has(k)) {
        this.tagCounters[type] = (this.tagCounters[type] || 0) + 1;
        this.cache.set(k, `[${type}-${this.tagCounters[type]}]`);
      }
      return this.cache.get(k);
    }

    // Look at full names first, so lone words later know if they're a first or last name.
    prepare(spans) {
      for (const s of spans) {
        if (s.type === 'NAME' && s.meta.sex) {
          for (const w of this.nameWords(s.text)) if (!w.isInit) this.sexHint.set(lower(w.base), s.meta.sex);
        }
      }
      for (const s of spans) {
        if (s.type !== 'NAME') continue;
        const words = this.nameWords(s.text);
        if (words.length < 2) continue;
        const roles = this.rolesFor(words, s);
        let entity = null;
        words.forEach((w, i) => {
          if (w.isInit) return;
          const k = lower(w.base);
          if (!this.roleHint.has(k)) this.roleHint.set(k, roles[i] === 'last' ? 'last' : 'first');
          if (this.entityOf.has(k) && entity == null) entity = this.entityOf.get(k);
        });
        if (entity == null) entity = ++this.entityCount;
        words.forEach((w) => { if (!w.isInit && !this.entityOf.has(lower(w.base))) this.entityOf.set(lower(w.base), entity); });
      }
    }

    nameWords(text) {
      const out = [];
      const re = /[A-Za-z][A-Za-z'’-]*\.?/g;
      let m;
      while ((m = re.exec(text))) {
        let raw = m[0];
        let suffix = '';
        const poss = raw.match(/(['’]s|s['’])$/);
        if (poss && raw.length > 3) { suffix = poss[0]; raw = raw.slice(0, -suffix.length); }
        const isInit = /^[A-Za-z]\.?$/.test(raw);
        out.push({ start: m.index, end: m.index + m[0].length, raw, base: raw.replace(/\.$/, ''), suffix, isInit, dot: /\.$/.test(raw) });
      }
      return out;
    }

    rolesFor(words, s) {
      const real = words.filter((w) => !w.isInit);
      if (real.length === 1) {
        const k = lower(real[0].base);
        const role = s.meta.single || this.roleHint.get(k) || (D.isFirstName(k) ? 'first' : 'last');
        return words.map((w) => (w.isInit ? 'initial' : role));
      }
      if (s.meta.comma || /,/.test(s.text)) {
        let seenFirst = false;
        return words.map((w, i) => {
          if (w.isInit) return 'initial';
          if (i === 0) return 'last';
          if (!seenFirst) { seenFirst = true; return 'first'; }
          return 'middle';
        });
      }
      const lastIdx = words.map((w) => !w.isInit).lastIndexOf(true);
      let seenFirst = false;
      return words.map((w, i) => {
        if (w.isInit) return 'initial';
        if (i === lastIdx) return 'last';
        if (!seenFirst) { seenFirst = true; return 'first'; }
        return 'middle';
      });
    }

    fakeNameWord(base, role) {
      const k = lower(base);
      if (this.nameMap.has(k)) return this.nameMap.get(k);
      let fake;
      if (role === 'last') {
        fake = this.pickUnique(D.FAKE.last, 'last|' + k);
      } else {
        const hint = this.sexHint.get(k);
        const list = D.MALE_FIRST.has(k) && !D.FEMALE_FIRST.has(k) ? D.FAKE.male
          : D.FEMALE_FIRST.has(k) && !D.MALE_FIRST.has(k) ? D.FAKE.female
            : hint === 'm' ? D.FAKE.male : hint === 'f' ? D.FAKE.female : D.FAKE.neutral;
        fake = this.pickUnique(list, 'first|' + k);
        const init = base.charAt(0).toUpperCase();
        if (!this.initialMap.has(init)) this.initialMap.set(init, fake.charAt(0).toUpperCase());
      }
      this.nameMap.set(k, fake);
      return fake;
    }

    fakeInitial(letter) {
      const L = letter.toUpperCase();
      if (!this.initialMap.has(L)) {
        const rng = this.rng('init|' + L);
        this.initialMap.set(L, String.fromCharCode(65 + Math.floor(rng() * 26)));
      }
      return this.initialMap.get(L);
    }

    name(s) {
      const words = this.nameWords(s.text);
      const roles = this.rolesFor(words, s);
      if (this.opts.style === 'tags') {
        const firstReal = words.find((w) => !w.isInit);
        const k = firstReal ? lower(firstReal.base) : lower(s.text);
        let ent = this.entityOf.get(k);
        if (ent == null) { ent = ++this.entityCount; this.entityOf.set(k, ent); }
        const poss = words.length && words[words.length - 1].suffix ? words[words.length - 1].suffix : '';
        return `[NAME-${ent}]` + poss;
      }
      // Map real words first so initials can reuse the fake first name's initial.
      const fakes = words.map((w, i) => (w.isInit ? null : this.fakeNameWord(w.base, roles[i])));
      let out = '';
      let pos = 0;
      words.forEach((w, i) => {
        out += s.text.slice(pos, w.start);
        if (w.isInit) out += applyCase(w.base, this.fakeInitial(w.base)) + (w.dot ? '.' : '');
        else out += applyCase(w.base, fakes[i]) + (w.dot ? '.' : '') + w.suffix;
        pos = w.end;
      });
      return out + s.text.slice(pos);
    }

    cached(type, key, make) {
      const k = type + '|' + key;
      if (!this.cache.has(k)) this.cache.set(k, make());
      return this.cache.get(k);
    }

    replace(s) {
      const tags = this.opts.style === 'tags';
      const t = s.text;
      switch (s.type) {
        case 'NAME': return this.name(s);
        case 'CUSTOM': return s.meta.replacement != null && s.meta.replacement !== '' ? s.meta.replacement : '[REDACTED]';
        case 'AGE': return s.meta.replacement;
        case 'DATE': return this.date(s);
        case 'ZIP': {
          const z3 = t.slice(0, 3);
          return (D.RESTRICTED_ZIP3.has(z3) ? '000' : z3) + 'XX';
        }
      }
      if (tags) return this.tag(s.type === 'SSN' ? 'SSN' : s.type, lower(t));
      switch (s.type) {
        case 'PHONE': return this.cached('PHONE', t.replace(/\D/g, ''), () => this.phone(t));
        case 'SSN': return this.cached('SSN', t.replace(/\D/g, ''), () => {
          const rng = this.rng('ssn|' + t);
          const digits = '9' + Array.from({ length: 8 }, () => Math.floor(rng() * 10)).join('');
          let i = 0;
          return t.replace(/[0-9xX*]/g, () => digits[i++] || '0');
        });
        case 'ID': return this.cached('ID', t, () => {
          const rng = this.rng('id|' + t);
          if (s.meta.kind === 'handle') return '@user' + (1000 + Math.floor(rng() * 9000));
          return formatPreserving(t, rng, { hex: s.meta.kind === 'mac' });
        });
        case 'EMAIL': return this.cached('EMAIL', lower(t), () => {
          const rng = this.rng('email|' + lower(t));
          const f = D.FAKE.neutral[Math.floor(rng() * D.FAKE.neutral.length)];
          const l = D.FAKE.last[Math.floor(rng() * D.FAKE.last.length)];
          return `${lower(f)}.${lower(l)}${Math.floor(rng() * 90) + 10}@example.com`;
        });
        case 'URL': return this.cached('URL', t, () => `https://example.org/link-${++this.urlCount}`);
        case 'IP': return this.cached('IP', t, () => '192.0.2.' + (1 + Math.floor(this.rng('ip|' + t)() * 253)));
        case 'ADDRESS': return this.cached('ADDRESS', lower(t), () => (s.meta.line ? this.addressLine(t) : this.street(t)));
        case 'CITY': return applyCase(t, this.city(t));
        case 'COUNTY': return this.cached('COUNTY', lower(t), () => this.pickUnique(D.FAKE.cities, 'county|' + lower(t)) + ' ' + s.meta.suffix);
        case 'FACILITY': return this.cached('FACILITY', lower(t), () => this.pickUnique(D.FAKE.facilityPrefix, 'fac|' + lower(t)) + ' ' + s.meta.suffix);
        case 'SCHOOL': return this.cached('SCHOOL', lower(t), () => this.pickUnique(D.FAKE.facilityPrefix, 'school|' + lower(t)) + ' ' + s.meta.suffix);
        case 'EMPLOYER': return this.cached('EMPLOYER', lower(t), () => this.pickUnique(D.FAKE.companies, 'emp|' + lower(t)));
        default: return '[REDACTED]';
      }
    }

    city(name) {
      const key = lower(name.trim());
      return this.cached('CITY', key, () => this.pickUnique(D.FAKE.cities, 'city|' + key));
    }

    date(s) {
      const m = s.meta;
      if (m.dob && this.oldPatient) return m.yearOnly ? '[year withheld: age 90+]' : '[DOB withheld: age 90+]';
      if (m.yearOnly) return s.text; // a bare year is allowed under Safe Harbor
      if (this.opts.dates === 'tag') return '[DATE]';
      return Dates.shiftDate(m, this.offsetDays);
    }

    phone(t) {
      const rng = this.rng('phone|' + t.replace(/\D/g, ''));
      const allDigits = t.replace(/\D/g, '');
      const hasCountry = /^\+?1[ .-]?[(\d]/.test(t.trim()) && allDigits.length >= 11;
      const area = String(201 + Math.floor(rng() * 700));
      const line = '01' + String(Math.floor(rng() * 100)).padStart(2, '0');
      let digits = (hasCountry ? '1' : '') + area + '555' + line;
      while (digits.length < allDigits.length) digits += String(Math.floor(rng() * 10));
      let i = 0;
      return t.replace(/\d/g, () => digits[i++]);
    }

    street(t) {
      const rng = this.rng('street|' + lower(t));
      const m = t.match(/^(\d+)([A-Za-z]?)/);
      const num = m ? String(Math.floor(10 ** (m[1].length - 1) + rng() * 9 * 10 ** (m[1].length - 1))) : '';
      if (/^P\.?\s?O\.?/i.test(t)) return 'PO Box ' + (100 + Math.floor(rng() * 9000));
      const sfx = t.match(new RegExp(`\\b(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Terrace|Ter|Trail|Trl|Square|Sq|Loop|Alley|Plaza|Row|Crescent|Close|Path|Pike|Run|Point|Ridge|Heights|Hts)\\b\\.?`));
      const unit = t.match(/(,?[ \t]*(?:Apt|Apartment|Suite|Ste|Unit|#|Bldg|Building|Fl|Floor|Rm|Room|Lot)\.?[ \t]*#?)([A-Za-z0-9-]+)$/);
      const street = this.pickUnique(D.FAKE.streets, 'st|' + lower(t));
      let out = `${num} ${street} ${sfx ? sfx[0] : 'Street'}`.trim();
      if (unit) out += unit[1] + formatPreserving(unit[2], rng);
      return out;
    }

    addressLine(t) {
      const parts = [];
      const stateRe = new RegExp(`\\b(${Object.keys(D.STATES).join('|')}|${Object.values(D.STATES).join('|')})\\b`);
      const st = t.match(stateRe);
      const zip = t.match(/\b(\d{5})(?:-\d{4})?\b/);
      const beforeState = st ? t.slice(0, st.index) : t;
      const hasStreet = /\d/.test(beforeState.replace(zip ? zip[0] : '', '')) || /P\.?\s?O\.?\s*Box/i.test(t);
      if (hasStreet) {
        const streetPart = beforeState.split(',')[0];
        parts.push(this.street(streetPart.trim()));
      }
      const segs = beforeState.split(',').map((x) => x.trim()).filter(Boolean);
      const hasCity = segs.length >= (hasStreet ? 2 : 1);
      if (hasCity) parts.push(this.city(segs[segs.length - 1]));
      let tail = st ? st[0] : '';
      if (zip) tail += (tail ? ' ' : '') + (D.RESTRICTED_ZIP3.has(zip[1].slice(0, 3)) ? '000' : zip[1].slice(0, 3)) + 'XX';
      if (tail) parts.push(tail);
      return parts.length ? parts.join(', ') : this.street('100 Main Street');
    }
  }

  const api = { Surrogates, formatPreserving, applyCase };
  root.DeidSurrogates = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
