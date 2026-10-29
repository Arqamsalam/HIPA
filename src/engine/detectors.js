/*
 * Detectors: each one looks for one kind of identifier and reports "spans"
 * ({start, end, type, confidence, meta}). Nothing is replaced here.
 *
 * Confidence levels:
 *   high   - format or context makes it near-certain (SSN, "Patient: John Smith")
 *   medium - probably an identifier; replaced, but shown in yellow for review
 *   hint   - possibly identifying in context; NOT replaced, shown for review
 */
(function (root) {
  'use strict';

  const D = root.DeidData || require('./data.js');
  const Dates = root.DeidDates || require('./dates.js');

  // A name word: John, McDonald, O'Brien, Garcia-Lopez, SMITH
  const TOK = "(?:(?:O['’]|D['’])?[A-Z][a-z]+(?:[-'’][A-Z][a-z]+)*|(?:O['’])?[A-Z]{2,}(?:[-'’][A-Z]{2,})*)";
  const STATE_ABBR = Object.keys(D.STATES).join('|');
  const STATE_FULL = Object.values(D.STATES).join('|');

  const PRIORITY = {
    CUSTOM: 100, EMAIL: 90, URL: 88, IP: 86, SSN: 85, PHONE: 80, ID: 75, DATE: 70, ADDRESS: 65,
    FACILITY: 60, SCHOOL: 58, EMPLOYER: 57, COUNTY: 56, CITY: 55, ZIP: 54, NAME: 50, AGE: 45, HINT: 10
  };

  const lower = (s) => s.toLowerCase();
  const stripPossessive = (t) => t.replace(/['’]s$/, '');

  function isNameWord(tok, opts) {
    opts = opts || {};
    const base = lower(stripPossessive(tok));
    if (base.length < 2) return false;
    if (D.STOPWORDS.has(base)) return false;
    if (/^[A-Z]{2}$/.test(tok) && D.STATES[tok]) return false;
    if (!opts.strong && D.EPONYMS.has(base)) return false;
    return true;
  }

  // Text right after a word that says "this is a medical eponym" (Bell's palsy, Wilson disease)
  const FOLLOW_RE = new RegExp(`^(?:['’]s|s['’])?(?:[ \\t]*-[ \\t]*[A-Z][A-Za-z]+)*[ \\t-]+(?:[A-Za-z-]+[ \\t]+)?(?:${D.EPONYM_FOLLOWERS})\\b`, 'i');
  function looksLikeEponym(text, end) {
    return FOLLOW_RE.test(text.slice(end, end + 60));
  }

  /*
   * Read a person's name starting at `pos`. Handles "John Smith", "John A. Smith",
   * "Smith, John", "SMITH, JOHN A". Stops at the first word that isn't a plausible name.
   */
  const tokRe = new RegExp(`${TOK}|[A-Z]\\.(?=[ \\t]*[A-Z])|[A-Z](?=[ \\t]+[A-Z][a-z])`, 'y');
  function readNameAt(text, pos, opts) {
    opts = opts || {};
    let i = pos;
    while (text[i] === ' ' || text[i] === '\t') i++;
    const toks = [];
    let comma = false;
    while (toks.length < 4) {
      tokRe.lastIndex = i;
      const m = tokRe.exec(text);
      if (!m) break;
      const t = m[0];
      const isInit = /^[A-Z]\.?$/.test(t);
      if (isInit && toks.length === 0 && !opts.allowLeadingInitial) break;
      if (!isInit && !isNameWord(t, opts)) break;
      if (text.charAt(i + t.length).match(/[a-z0-9]/)) break;
      toks.push({ t, start: i, end: i + t.length, isInit });
      i += t.length;
      const sep = /^[ \t]*,[ \t]*|^[ \t]+/.exec(text.slice(i, i + 12));
      if (!sep) break;
      if (sep[0].includes(',')) {
        if (comma || toks.length !== 1 || opts.noComma) break;
        comma = true;
      }
      i += sep[0].length;
    }
    while (toks.length && toks[toks.length - 1].isInit) toks.pop();
    if (!toks.length) return null;
    if (toks.length === 1 && !opts.allowSingle) return null;
    if (comma && toks.length < 2) comma = false;
    return { start: toks[0].start, end: toks[toks.length - 1].end, toks, comma };
  }

  function span(start, end, type, confidence, meta) {
    return { start, end, type, confidence, meta: meta || {} };
  }

  // ---------------- Structured identifiers ----------------

  function detectEmails(text, out) {
    const re = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let m;
    while ((m = re.exec(text))) out.push(span(m.index, m.index + m[0].length, 'EMAIL', 'high'));
  }

  function detectUrls(text, out) {
    const re = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
    let m;
    while ((m = re.exec(text))) {
      const t = m[0].replace(/[.,;:!?]+$/, '');
      out.push(span(m.index, m.index + t.length, 'URL', 'high'));
    }
    const ip = /(?<![\d.])(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)(?![\d.]|\.\d)/g;
    while ((m = ip.exec(text))) out.push(span(m.index, m.index + m[0].length, 'IP', 'high'));
    const mac = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;
    while ((m = mac.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ID', 'high', { kind: 'mac' }));
    const handle = /(?<![\w.@])@[A-Za-z0-9_]{3,30}\b/g;
    while ((m = handle.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ID', 'high', { kind: 'handle' }));
  }

  function detectSSN(text, out) {
    let m;
    const re = /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g;
    while ((m = re.exec(text))) out.push(span(m.index, m.index + m[0].length, 'SSN', 'high'));
    const labeled = /\b(?:SSN|SS#|SS No\.?|Social Security(?: No\.?| Number| #)?)[ \t]*[:#]?[ \t]*((?:\d{3}[ -]?\d{2}[ -]?\d{4})|(?:[xX*]{3}[- ]?[xX*]{2}[- ]?\d{4}))\b/gi;
    while ((m = labeled.exec(text))) {
      const s = m.index + m[0].length - m[1].length;
      out.push(span(s, s + m[1].length, 'SSN', 'high'));
    }
  }

  function detectPhones(text, out) {
    let m;
    const re = /(?<![\w+])(?:\+?1[ .-]?)?(?:\(\d{3}\)[ .-]?|\d{3}[ .-])\d{3}[ .-]\d{4}(?:[ \t]*(?:x|ext\.?|extension)[ \t]*\d{1,6})?(?!\d)/gi;
    while ((m = re.exec(text))) out.push(span(m.index, m.index + m[0].length, 'PHONE', 'high'));
    const labeled = /\b(?:phone|tel|telephone|cell|mobile|fax|pager|ph|home|work)\b\.?(?:[ \t]*(?:no\.?|number|#))?[ \t]*[:#]?[ \t]*(\d{10})(?!\d)/gi;
    while ((m = labeled.exec(text))) {
      const s = m.index + m[0].length - m[1].length;
      out.push(span(s, s + m[1].length, 'PHONE', 'high'));
    }
  }

  const ID_LABELS = [
    'MRN', 'MR#', 'MR No\\.?', 'Medical Record(?: Number| No\\.?| #)?', 'Med Rec(?: No\\.?| #)?',
    'Chart(?: No\\.?| Number| #)', 'Patient ID', 'Pt ID', 'PID', 'Acct(?: No\\.?| #| Number)?',
    'Account(?: No\\.?| Number| #)?', 'FIN', 'CSN', 'HAR', 'Encounter(?: No\\.?| Number| ID| #)?',
    'Enc(?: #| No\\.?)', 'Visit(?: No\\.?| Number| ID| #)', 'Admission(?: No\\.?| Number| ID| #)',
    'Case(?: No\\.?| Number| ID| #)', 'Claim(?: No\\.?| Number| ID| #)?', 'Policy(?: No\\.?| Number| ID| #)?',
    'Member(?: No\\.?| Number| ID| #)', 'Subscriber(?: No\\.?| Number| ID| #)', 'Group(?: No\\.?| Number| ID| #)',
    'Insurance(?: No\\.?| Number| ID| #)', 'Health Plan(?: No\\.?| Number| ID| #)?',
    'Beneficiary(?: No\\.?| Number| ID| #)?', 'Medicare(?: No\\.?| Number| ID| #)', 'Medicaid(?: No\\.?| Number| ID| #)',
    'MBI', 'HICN', 'License(?: No\\.?| Number| #| Plate)?', 'Lic\\.?(?: No\\.?| #)', "Driver'?s License(?: No\\.?| #)?",
    'DL(?: No\\.?| #)', 'DEA(?: No\\.?| #)?', 'NPI(?: No\\.?| #)?', 'Passport(?: No\\.?| Number| #)?',
    'Serial(?: No\\.?| Number| #)?', 'S\\/N', 'SN', 'Device(?: ID| Serial| No\\.?| #)', 'Lot(?: No\\.?| #)',
    'Plate(?: No\\.?| #)?', 'VIN', 'Specimen(?: ID| No\\.?| #)', 'Accession(?: No\\.?| Number| #)?',
    'Order(?: No\\.?| Number| ID| #)', 'Requisition(?: No\\.?| #)?', 'Badge(?: No\\.?| #)', 'Employee(?: ID| No\\.?| #)',
    'Student(?: ID| No\\.?| #)', 'Certificate(?: No\\.?| Number| #)', 'Record(?: No\\.?| #)', 'ID(?: No\\.?| Number| #)?',
    'Unique Device Identifier', 'UDI', 'Biometric(?: ID)?', 'Fingerprint(?: ID)?', 'Voiceprint(?: ID)?', 'Retinal Scan(?: ID)?'
  ];
  const ID_LABEL_RE = new RegExp(`(?<![A-Za-z])(?:${ID_LABELS.join('|')})(?![A-Za-z])\\.?[ \\t]*[:#=]?[ \\t]*(?:(?:No\\.?|Number|#)[ \\t]*[:#]?[ \\t]*)?([A-Za-z0-9](?:[A-Za-z0-9\\-\\/.]*[A-Za-z0-9])?)`, 'gi');

  function detectIds(text, out) {
    let m;
    ID_LABEL_RE.lastIndex = 0;
    while ((m = ID_LABEL_RE.exec(text))) {
      const v = m[1];
      if (v.length < 3 || !/\d/.test(v)) continue;
      const s = m.index + m[0].length - v.length;
      out.push(span(s, s + v.length, 'ID', 'high', { labeled: true }));
    }
    // Unlabeled long numbers / letter+number codes
    const longNum = /(?<![\d.,\/:-])\d{7,}(?![\d.,]\d|\d)/g;
    while ((m = longNum.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ID', 'medium'));
    const code = /\b[A-Z]{1,4}-?\d{6,}\b/g;
    while ((m = code.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ID', 'medium'));
    const vin = /\b[A-HJ-NPR-Z0-9]{17}\b/g;
    while ((m = vin.exec(text))) {
      if (/\d/.test(m[0]) && /[A-Z]/.test(m[0])) out.push(span(m.index, m.index + m[0].length, 'ID', 'medium', { kind: 'vin' }));
    }
  }

  // ---------------- Dates and ages ----------------

  function detectDates(text, out) {
    for (const d of Dates.findDates(text)) {
      const before = text.slice(Math.max(0, d.start - 25), d.start);
      const dob = /(?:DOB|D\.O\.B\.?|date of birth|birth\s?date|birthday|born(?: on)?)[ \t]*[:\-]?[ \t]*$/i.test(before);
      out.push(span(d.start, d.end, 'DATE', 'high', Object.assign({ dob }, d.meta)));
    }
  }

  function ageSpan(text, numStart, numStr, out) {
    const n = +numStr;
    if (n < 90 || n > 125) return;
    let end = numStart + numStr.length;
    let replacement = '90+';
    const next = text.charAt(end);
    if (next === '-') { end += 1; replacement = '90+ '; }
    else if (/[A-Za-z]/.test(next)) replacement = '90+ ';
    out.push(span(numStart, end, 'AGE', 'high', { replacement, age: n }));
  }

  function detectAges(text, out) {
    let m;
    const a1 = /\b(\d{2,3})[ \t-]*(?:years?[ \t-]*old|yrs?[ \t-]*old|y\.?[ \t]?o\.?(?![a-z])|y\/o|yo(?![a-z]))/gi;
    while ((m = a1.exec(text))) ageSpan(text, m.index, m[1], out);
    const a2 = /\b(?:age|aged)[ \t]*[:=]?[ \t]*(\d{2,3})\b/gi;
    while ((m = a2.exec(text))) ageSpan(text, m.index + m[0].length - m[1].length, m[1], out);
    const a3 = /\b(\d{2,3})[ \t]?(?:M|F|yo[MF]|y\/o[MF])\b/g;
    while ((m = a3.exec(text))) ageSpan(text, m.index, m[1], out);
    const a4 = /\b(\d{2,3})[ \t-]?(?:years?|yrs?)\b/gi;
    while ((m = a4.exec(text))) {
      // only "turned 92 years", "is 94 years" — not "for 90 years"? still an age-like fact; keep conservative
      const before = text.slice(Math.max(0, m.index - 12), m.index);
      if (/\b(?:is|was|turned|turns|aged|age|now)[ \t]*$/i.test(before)) ageSpan(text, m.index, m[1], out);
    }
    // Year of birth reveals an age over 89 → withhold that year too
    const born = /\b(?:born(?:[ \t]+in)?|year of birth|YOB)[ \t:]*((?:18|19|20)\d{2})\b/gi;
    while ((m = born.exec(text))) {
      const s = m.index + m[0].length - 4;
      out.push(span(s, s + 4, 'DATE', 'high', { fmt: 'year', y: +m[1], dob: true, yearOnly: true }));
    }
  }

  // ---------------- Locations ----------------

  const STREET_SUFFIX = 'Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Parkway|Pkwy|Highway|Hwy|Circle|Cir|Terrace|Ter|Trail|Trl|Square|Sq|Loop|Alley|Plaza|Row|Crescent|Close|Path|Pike|Run|Point|Ridge|Heights|Hts';
  const STREET_RE = new RegExp(`\\b\\d{1,6}[A-Za-z]?[ \\t]+(?:(?:[NSEW]\\.?|North|South|East|West|NE|NW|SE|SW)[ \\t]+)?(?:(?:[A-Z][A-Za-z'’.-]*|\\d+(?:st|nd|rd|th))[ \\t]+){1,4}(?:${STREET_SUFFIX})\\b\\.?(?:[ \\t]+(?:[NSEW]|NE|NW|SE|SW)\\b)?(?:,?[ \\t]*(?:Apt|Apartment|Suite|Ste|Unit|#|Bldg|Building|Fl|Floor|Rm|Room|Lot)\\.?[ \\t]*#?[A-Za-z0-9-]+)?`, 'g');

  function detectAddresses(text, out) {
    let m;
    STREET_RE.lastIndex = 0;
    while ((m = STREET_RE.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ADDRESS', 'high'));
    const pobox = /\bP\.?[ \t]?O\.?[ \t]*Box[ \t]+\d+\b/gi;
    while ((m = pobox.exec(text))) out.push(span(m.index, m.index + m[0].length, 'ADDRESS', 'high'));

    // "Address: ...rest of line" → treat the whole value as one address
    const labeled = /\b(?:Home Address|Mailing Address|Street Address|Address|Addr|Residence|Lives at)\b[ \t]*:[ \t]*([^\n]{4,140})/gi;
    while ((m = labeled.exec(text))) {
      let v = m[1].replace(/[ \t]+(?:Phone|Tel|Cell|Email|DOB|MRN|Sex|Age)\b.*$/i, '').replace(/[\s,;.]+$/, '');
      if (!/[A-Za-z]/.test(v) || v.length < 4) continue;
      const s = m.index + m[0].length - m[1].length;
      out.push(span(s, s + v.length, 'ADDRESS', 'high', { line: true }));
    }

    // City, ST 12345 / City, State
    const cityState = new RegExp(`((?:[A-Z][a-z]+(?:[ \\t]+|-)){0,2}[A-Z][a-z]+),[ \\t]*(${STATE_ABBR}|${STATE_FULL})\\b(?:[ \\t]+(\\d{5}(?:-\\d{4})?))?`, 'g');
    while ((m = cityState.exec(text))) {
      const city = m[1], st = m[2], zip = m[3];
      const cityWords = city.split(/[ \t-]+/);
      // "Jane Doe, MD" / "Smith, PA" are credentials, not states — unless a ZIP follows
      if ((st === 'MD' || st === 'PA' || st === 'DO' || st === 'OR' || st === 'IN' || st === 'ME') && !zip) continue;
      if (cityWords.some((w) => D.STOPWORDS.has(lower(w)))) {
        // drop leading stopwords like "Lives in Dallas, TX"
        while (cityWords.length && D.STOPWORDS.has(lower(cityWords[0]))) cityWords.shift();
        if (!cityWords.length) continue;
      }
      const cityText = cityWords.join(' ');
      const cityStart = m.index + m[1].lastIndexOf(cityWords[0]);
      const cityEnd = m.index + m[1].length;
      if (cityText.length >= 3) out.push(span(cityStart, cityEnd, 'CITY', 'high', { state: st }));
      if (zip) {
        const zs = m.index + m[0].length - zip.length;
        out.push(span(zs, zs + zip.length, 'ZIP', 'high'));
      }
    }
    const stateZip = new RegExp(`\\b(?:${STATE_ABBR})[ \\t]+(\\d{5}(?:-\\d{4})?)\\b`, 'g');
    while ((m = stateZip.exec(text))) {
      const zs = m.index + m[0].length - m[1].length;
      out.push(span(zs, zs + m[1].length, 'ZIP', 'high'));
    }
    const zipLabel = /\b(?:ZIP|Zip Code|Zipcode|Postal Code)[ \t]*[:#]?[ \t]*(\d{5}(?:-\d{4})?)\b/gi;
    while ((m = zipLabel.exec(text))) {
      const zs = m.index + m[0].length - m[1].length;
      out.push(span(zs, zs + m[1].length, 'ZIP', 'high'));
    }
    const cityLabel = /\b(?:City|Town|Hometown)[ \t]*:[ \t]*((?:[A-Z][a-z]+[ \t]?){1,3})/g;
    while ((m = cityLabel.exec(text))) {
      const v = m[1].trim();
      const s = m.index + m[0].length - m[1].length;
      out.push(span(s, s + v.length, 'CITY', 'high'));
    }

    // County / Parish / Borough
    const county = /\b((?:[A-Z][a-z]+[ \t]+){1,2})(County|Parish|Borough|Township)\b/g;
    while ((m = county.exec(text))) {
      const first = m[1].trim().split(/[ \t]+/);
      while (first.length && D.STOPWORDS.has(lower(first[0]))) first.shift();
      if (!first.length) continue;
      const s = m.index + m[0].indexOf(first[0]);
      out.push(span(s, m.index + m[0].length, 'COUNTY', 'high', { suffix: m[2] }));
    }

    // "from Boise" — only trusted when the word is a known city
    const fromCity = /\b(?:from|in|near|to)[ \t]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)?)/g;
    while ((m = fromCity.exec(text))) {
      const words = m[1].split(/[ \t]+/);
      const two = lower(words.join('')), one = lower(words[0]);
      const s = m.index + m[0].length - m[1].length;
      const ambiguous = D.isFirstName(one) || D.SURNAMES.has(one) || D.STOPWORDS.has(one);
      if (words.length === 2 && D.CITY_KEYS.has(two)) out.push(span(s, s + m[1].length, 'CITY', 'high'));
      else if (D.CITY_KEYS.has(one) && !ambiguous) out.push(span(s, s + words[0].length, 'CITY', 'high'));
    }

    // Context: "lives in Houston", "moved from Fresno"
    const ctx = /\b(?:lives in|living in|resides in|residing in|resident of|lives near|moved (?:here )?(?:from|to)|born in|grew up in|native of|visiting from|relocated (?:from|to)|hometown(?: is| of)?|from the town of|town of|city of|village of|travel(?:l?ed)? to|trip to|returned from|commutes? (?:from|to))[ \t]+((?:[A-Za-z][a-z]+)(?:[ \t]+[A-Z][a-z]+){0,2})/gi;
    while ((m = ctx.exec(text))) {
      if (!/^[A-Z]/.test(m[1])) continue;
      const v = m[1].split(/[ \t]+/).filter((w, i) => i === 0 || /^[A-Z]/.test(w)).join(' ').replace(/[ \t]+(?:With|And|For|Since|In|On|At)\b.*$/, '');
      const s = m.index + m[0].length - m[1].length;
      const key = lower(v).replace(/[^a-z]/g, '');
      const firstWordKey = lower(v.split(/[ \t]+/)[0]);
      if (Object.values(D.STATES).some((st) => lower(st) === lower(v)) || D.COUNTRIES.has(firstWordKey)) continue;
      if (D.STOPWORDS.has(firstWordKey)) continue;
      if (D.CITY_KEYS.has(key)) out.push(span(s, s + v.length, 'CITY', 'high'));
      else if (D.CITY_KEYS.has(firstWordKey)) out.push(span(s, s + v.split(/[ \t]+/)[0].length, 'CITY', 'high'));
      else out.push(span(s, s + v.length, 'CITY', 'medium'));
    }
  }

  // ---------------- Organisations ----------------

  const FACILITY_SUFFIX = "Children's Hospital|Hospital|Medical Center|Medical Centre|Health Center|Health Centre|Health System|Healthcare|Health Care|Clinic|Infirmary|Nursing Home|Nursing Center|Nursing Facility|Rehabilitation Center|Rehab Center|Care Center|Urgent Care|Surgery Center|Surgical Center|Cancer Center|Cancer Institute|Heart Institute|Hospice|Pharmacy|Laboratories|Laboratory|Labs|Imaging Center|Dialysis Center|Medical Group|Senior Living|Assisted Living|Retirement Home|Retirement Community";
  const FACILITY_RE = new RegExp(`\\b((?:(?:St\\.?|Saint|Mount|Mt\\.?)[ \\t]+)?(?:[A-Z][A-Za-z'’&.-]*[ \\t]+){1,4})(${FACILITY_SUFFIX})\\b`, 'g');
  const SCHOOL_RE = /\b((?:[A-Z][A-Za-z'’.-]*[ \t]+){1,4})((?:Elementary|Middle|High|Junior High|Senior High|Primary|Secondary|Charter|Prep|Preparatory)?[ \t]?School|Academy|University|College|Daycare|Day Care|Preschool)\b/g;

  function detectOrgs(text, out) {
    let m;
    FACILITY_RE.lastIndex = 0;
    while ((m = FACILITY_RE.exec(text))) {
      const words = m[1].trim().split(/[ \t]+/);
      while (words.length && D.STOPWORDS.has(lower(words[0].replace(/[.'’]/g, ''))) && !/^(St\.?|Saint|Mount|Mt\.?)$/.test(words[0])) words.shift();
      const proper = words.filter((w) => !D.STOPWORDS.has(lower(w.replace(/[.'’]/g, ''))));
      if (!proper.length) continue;
      const s = m.index + m[0].indexOf(words[0]);
      out.push(span(s, m.index + m[0].length, 'FACILITY', 'high', { suffix: m[2] }));
    }
    SCHOOL_RE.lastIndex = 0;
    while ((m = SCHOOL_RE.exec(text))) {
      const words = m[1].trim().split(/[ \t]+/);
      while (words.length && D.STOPWORDS.has(lower(words[0]))) words.shift();
      if (!words.filter((w) => !D.STOPWORDS.has(lower(w))).length) continue;
      const s = m.index + m[0].indexOf(words[0]);
      out.push(span(s, m.index + m[0].length, 'SCHOOL', 'high', { suffix: m[2].trim() }));
    }
    const employer = /\b(?:Employer|[Ee]mployed (?:by|at)|[Ww]orks (?:at|for)|[Ww]orking (?:at|for)|[Ee]mployee of|[Rr]etired from)[ \t]*:?[ \t]+((?:[A-Z][A-Za-z0-9&'’.-]*)(?:(?:[ \t]+|[ \t]*\n[ \t]*)(?:[A-Z][A-Za-z0-9&'’.-]*|&|of|and))*(?:,?[ \t]+(?:Inc|LLC|Co|Corp|Ltd)\.?)?)/g;
    while ((m = employer.exec(text))) {
      // stop at the first ordinary word (e.g. a section heading on the next line)
      const parts = m[1].split(/(\s+)/);
      let v = '';
      for (let i = 0; i < parts.length; i += 2) {
        const w = parts[i].replace(/[.,]$/, '');
        if (i > 0 && D.STOPWORDS.has(lower(w)) && !/^(?:of|and|&)$/i.test(w)) break;
        v += (i > 0 ? parts[i - 1] : '') + parts[i];
      }
      v = v.replace(/\s+(?:of|and|&)$/, '').replace(/[.,]$/, '');
      if (D.STOPWORDS.has(lower(v.split(/[ \t]+/)[0]))) continue;
      const s = m.index + m[0].length - m[1].length;
      out.push(span(s, s + v.length, 'EMPLOYER', /Employer/i.test(m[0]) ? 'high' : 'medium'));
    }
  }

  // ---------------- People ----------------

  const COLON_LABELS = [
    'Patient Name', 'Patient', 'Pt Name', 'Pt', 'Name', 'Full Name', 'Legal Name', 'Preferred Name', 'Alias',
    'AKA', 'a\\.k\\.a\\.', 'Guarantor', 'Subscriber', 'Insured', 'Policy ?holder', 'Emergency Contact',
    'Contact Person', 'Contact', 'Next of Kin', 'NOK', 'Responsible Party', 'Health Care Proxy',
    'Healthcare Proxy', 'HCP', 'POA', 'Power of Attorney', 'Informant', 'Source', 'Witness', 'Interpreter',
    'Mother', 'Father', 'Wife', 'Husband', 'Spouse', 'Son', 'Daughter', 'Sister', 'Brother', 'Partner',
    'Caregiver', 'Guardian', 'Parent', 'Relative', 'Sponsor', 'Employer Contact'
  ];
  const CLINICIAN_LABELS = [
    'Attending(?: Physician| Provider)?', 'Resident', 'Fellow', 'Intern', 'PCP', 'Primary Care(?: Physician| Provider)?',
    'Primary Physician', 'Referring(?: Physician| Provider| MD)?', 'Provider', 'Physician', 'Surgeon',
    'Assistant Surgeon', 'Anesthesiologist', 'Anesthesia', 'Nurse', 'RN', 'Case Manager', 'Social Worker',
    'Therapist', 'Consultant', 'Consulting Physician', 'Pharmacist', 'Midwife', 'Dentist', 'Psychologist',
    'Counselor', 'Chaplain', 'Ordering(?: Physician| Provider)?', 'Cc', 'CC to', 'Copy to'
  ];
  const BY_LABELS = [
    'Signed by', 'Electronically signed by', 'E-signed by', 'Dictated by', 'Transcribed by', 'Authenticated by',
    'Reviewed by', 'Ordered by', 'Seen by', 'Performed by', 'Interpreted by', 'Verified by', 'Referred by',
    'Read by', 'Approved by', 'Accompanied by', 'Prepared by', 'Written by', 'Attested by', 'Co-signed by', 'Cosigned by'
  ];
  const LABEL_RE = new RegExp(`(?<![A-Za-z])(?:(${COLON_LABELS.join('|')})[ \\t]*(?:[:]|-(?=[ \\t]))|(${CLINICIAN_LABELS.join('|')})[ \\t]*(?:[:]|-(?=[ \\t]))|(${BY_LABELS.join('|')})(?![A-Za-z])[ \\t]*:?)[ \\t]*`, 'gi');

  const REL_WORDS = 'wife|husband|spouse|son|daughter|mother|father|mom|dad|sister|brother|partner|fianc[ée]e?|boyfriend|girlfriend|grandson|granddaughter|grandmother|grandfather|grandma|grandpa|niece|nephew|aunt|uncle|cousin|friend|neighbor|neighbour|roommate|caregiver|guardian|stepson|stepdaughter|stepmother|stepfather|sibling|child|baby';
  const REL_RE = new RegExp(`\\b(?:${REL_WORDS})(?:,|[ \\t]+(?:is|was|named|called))?[ \\t]+(?=[A-Z])`, 'gi');
  const NAMED_RE = /\b(?:named|called|goes by|name is|known as|nicknamed)[ \t]+(?=[A-Z])/gi;
  const TITLE_RE = /\b(Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Doctor|Rev|MR|MRS|MS|DR|Nurse|Officer|Pastor|Father|Sister|Coach|Judge|Captain)\b\.?[ \t]+(?=[A-Z])/g;
  const CRED_RE = new RegExp(`(${TOK}(?:[ \\t]+(?:[A-Z]\\.?|${TOK})){1,3})[ \\t]*,?[ \\t]*(?:${D.CREDENTIALS})(?![A-Za-z])`, 'g');

  function pushName(out, nm, confidence, meta) {
    out.push(span(nm.start, nm.end, 'NAME', confidence, Object.assign({ comma: nm.comma }, meta)));
  }

  function detectNames(text, out) {
    let m;
    LABEL_RE.lastIndex = 0;
    while ((m = LABEL_RE.exec(text))) {
      const clinician = !!(m[2] || (m[3] && !/accompanied/i.test(m[3])));
      const nm = readNameAt(text, m.index + m[0].length, { allowSingle: true, strong: true, allowLeadingInitial: true });
      if (nm) pushName(out, nm, 'high', { clinician, source: 'label' });
    }
    TITLE_RE.lastIndex = 0;
    while ((m = TITLE_RE.exec(text))) {
      const nm = readNameAt(text, m.index + m[0].length, { allowSingle: true, strong: true, noComma: true, allowLeadingInitial: true });
      if (!nm) continue;
      const clinician = /^(?:Dr|DR|Doctor|Prof|Nurse)/.test(m[1]);
      pushName(out, nm, 'high', { clinician, source: 'title', single: nm.toks.length === 1 ? 'last' : undefined });
    }
    CRED_RE.lastIndex = 0;
    while ((m = CRED_RE.exec(text))) {
      // Drop leading non-name words ("Signed John Smith, MD" → "John Smith")
      const nm = (() => {
        let pos = m.index;
        const words = m[1].split(/([ \t]+)/);
        for (let i = 0; i < words.length; i += 2) {
          const w = words[i];
          if (isNameWord(w, { strong: true }) || /^[A-Z]\.?$/.test(w)) {
            const r = readNameAt(text, pos, { allowSingle: false, strong: true, noComma: true });
            if (r && r.end <= m.index + m[1].length) return r;
          }
          pos += w.length + (words[i + 1] || '').length;
        }
        return null;
      })();
      if (nm) pushName(out, nm, 'high', { clinician: true, source: 'credential' });
    }
    for (const re of [REL_RE, NAMED_RE]) {
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        const nm = readNameAt(text, m.index + m[0].length, { allowSingle: true, strong: true, noComma: true });
        if (nm) pushName(out, nm, 'high', { source: 'relation' });
      }
    }
    detectDictionaryNames(text, out);
  }

  // Names found without context, using first-name and surname dictionaries.
  function detectDictionaryNames(text, out) {
    const wordRe = /(?:O['’]|D['’])?[A-Z][A-Za-z]*(?:[-'’][A-Z][A-Za-z]*)*/g;
    let m;
    let skipUntil = 0;
    while ((m = wordRe.exec(text))) {
      if (m.index < skipUntil) continue;
      if (m.index > 0 && /[A-Za-z0-9@._-]/.test(text[m.index - 1])) continue;
      const w = stripPossessive(m[0]);
      const key = lower(w);
      if (D.isFirstName(key) && isNameWord(w)) {
        const nm = readNameAt(text, m.index, { allowSingle: true, noComma: true });
        if (!nm) continue;
        const ambiguous = D.AMBIGUOUS_FIRST.has(key);
        const lastTok = nm.toks[nm.toks.length - 1].t;
        if (nm.toks.length >= 2) {
          const lastKey = lower(stripPossessive(lastTok));
          const knownLast = D.SURNAMES.has(lastKey);
          if (ambiguous && !knownLast) continue;
          if (looksLikeEponym(text, nm.end)) continue;
          pushName(out, nm, knownLast || nm.toks.length >= 3 ? 'high' : 'medium', { source: 'dictionary' });
          skipUntil = nm.end;
        } else {
          if (ambiguous) continue;
          if (w.length > 2 && w === w.toUpperCase() && !/[a-z]/.test(text.slice(Math.max(0, m.index - 30), m.index + 30))) {
            // ALL-CAPS documents: single upper-case first names are too risky to trust alone
            continue;
          }
          if (looksLikeEponym(text, nm.end)) continue;
          pushName(out, nm, 'medium', { source: 'dictionary', single: 'first' });
        }
      } else if (D.SURNAMES.has(key)) {
        // "Smith, John"
        const nm = readNameAt(text, m.index, { allowSingle: false });
        if (nm && nm.comma) {
          const second = lower(stripPossessive(nm.toks[1].t));
          const isPlace = D.CITY_KEYS.has(second) || D.COUNTRIES.has(second) ||
            Object.values(D.STATES).some((st) => lower(st) === second);
          if (isPlace) continue;
          pushName(out, nm, D.isFirstName(second) ? 'high' : 'medium', { source: 'dictionary' });
          skipUntil = nm.end;
        }
      }
    }
  }

  // ---------------- Hints (not replaced, flagged for review) ----------------

  const HINTS = [
    [/\b(?:mayor|senator|governor|congress(?:man|woman)|celebrity|famous|well[- ]known|public figure|professional (?:athlete|football|baseball|basketball|hockey|soccer) player|NFL|NBA|MLB|NHL|Olympi(?:c|an)|CEO of|news(?:paper)? (?:report|coverage|story)|in the news|on (?:TV|television)|social media)\b/gi, 'Notable occupation or public profile can identify a person'],
    [/\b(?:only (?:patient|person|case|known case)|first (?:reported )?case|one of (?:the )?(?:only|few)|extremely rare|unique case)\b/gi, 'Uniqueness statements can identify a person'],
    [/\b(?:Christmas|Thanksgiving|Easter|Hanukkah|Halloween|New Year'?s(?: Eve| Day)?|Independence Day|Fourth of July|July 4th|Memorial Day|Labor Day|Ramadan|Eid|Diwali|Valentine'?s Day|Super Bowl)\b/g, 'Holidays/events are date elements — consider generalising'],
    [/\b(?:car accident|crash|shooting|explosion|house fire|building collapse|bridge collapse|mass casualty|plane crash|train derailment|tornado|hurricane|earthquake|flood)\b/gi, 'Specific newsworthy events can identify a person'],
    [/\b(?:tattoo|birthmark|scar)[^.\n]{0,40}\b(?:of|reading|that says|with the name|shaped like)\b[^.\n]{0,40}/gi, 'Distinguishing marks can identify a person'],
    [/\b(?:twins?|triplets?|quadruplets?|quintuplets?)\b/gi, 'Multiple births are rare and may identify a family'],
    [/\b(?:inmate|prisoner|incarcerated at|detained at)\b/gi, 'Custody details may identify a person']
  ];

  function detectHints(text, out) {
    for (const [re, note] of HINTS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) out.push(span(m.index, m.index + m[0].length, 'HINT', 'hint', { note }));
    }
  }

  // ---------------- User terms ----------------

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function detectCustom(text, out, customTerms) {
    for (const entry of customTerms || []) {
      const term = entry.term.trim();
      if (term.length < 2) continue;
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, 'gi');
      let m;
      while ((m = re.exec(text))) out.push(span(m.index, m.index + m[0].length, 'CUSTOM', 'high', { replacement: entry.replacement }));
    }
  }

  function detectAll(text, opts) {
    opts = opts || {};
    const out = [];
    detectCustom(text, out, opts.customTerms);
    detectEmails(text, out);
    detectUrls(text, out);
    detectSSN(text, out);
    detectPhones(text, out);
    detectIds(text, out);
    detectDates(text, out);
    detectAges(text, out);
    detectAddresses(text, out);
    detectOrgs(text, out);
    detectNames(text, out);
    detectHints(text, out);
    for (const s of out) {
      s.text = text.slice(s.start, s.end);
      s.priority = PRIORITY[s.type] || 0;
    }
    return out.filter((s) => s.end > s.start);
  }

  // Keep the most important span when spans overlap (priority, then length).
  function resolveOverlaps(spans) {
    const sorted = spans.slice().sort((a, b) =>
      b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
    const kept = [];
    for (const s of sorted) {
      if (kept.some((k) => s.start < k.end && k.start < s.end)) continue;
      kept.push(s);
    }
    return kept.sort((a, b) => a.start - b.start);
  }

  /*
   * Once "John Smith" is known to be a name, every other "Smith" / "John" / "SMITH"
   * in the same document is the same person and must be replaced too.
   */
  function propagateNames(text, spans, blocked) {
    const tokens = new Set();
    for (const s of spans) {
      if (s.type !== 'NAME' || s.meta.clinicianKept) continue;
      for (const t of s.text.split(/[ \t,]+/)) {
        const base = stripPossessive(t.replace(/\.$/, ''));
        if (base.length < 3 || D.STOPWORDS.has(lower(base)) || D.EPONYMS.has(lower(base))) continue;
        if (blocked && blocked.has(lower(base))) continue;
        tokens.add(base);
      }
    }
    const extra = [];
    for (const tok of tokens) {
      const forms = new Set([tok, tok.toUpperCase(), tok.charAt(0).toUpperCase() + tok.slice(1).toLowerCase()]);
      const re = new RegExp(`(?<![A-Za-z0-9'’-])(?:${[...forms].map(escapeRe).join('|')})(?![a-z0-9])`, 'g');
      let m;
      while ((m = re.exec(text))) {
        const end = m.index + m[0].length;
        if (looksLikeEponym(text, end)) continue;
        if (text[m.index - 1] === '-' || (text[end] === '-' && /[A-Z]/.test(text[end + 1] || ''))) {
          // part of a hyphenated eponym like "Stevens-Johnson syndrome"
          let e = end;
          while (/[-A-Za-z]/.test(text[e] || '')) e++;
          if (looksLikeEponym(text, e)) continue;
        }
        extra.push({ start: m.index, end, type: 'NAME', confidence: 'high', meta: { source: 'propagated' }, text: m[0], priority: PRIORITY.NAME });
      }
    }
    return extra;
  }

  // A city found once ("Dallas, TX" in the address) is replaced everywhere it appears.
  function propagateCities(text, spans, blocked) {
    const names = new Set();
    const stateRe = new RegExp(`,[ \\t]*(?:${STATE_ABBR}|${STATE_FULL})\\b`);
    for (const s of spans) {
      if (s.type === 'CITY' && s.confidence === 'high') names.add(s.text.trim());
      if (s.type === 'ADDRESS' && s.meta.line) {
        const st = s.text.match(stateRe);
        if (!st) continue;
        const segs = s.text.slice(0, st.index).split(',').map((x) => x.trim());
        const c = segs[segs.length - 1];
        if (/^[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){0,2}$/.test(c) && segs.length >= 2) names.add(c);
      }
    }
    const extra = [];
    for (const n of names) {
      if (n.length < 3 || (blocked && blocked.has(lower(n))) || D.STOPWORDS.has(lower(n))) continue;
      const re = new RegExp(`(?<![A-Za-z0-9'’-])(?:${escapeRe(n)}|${escapeRe(n.toUpperCase())})(?![a-z0-9])`, 'g');
      let m;
      while ((m = re.exec(text))) {
        extra.push({ start: m.index, end: m.index + m[0].length, type: 'CITY', confidence: 'high', meta: { source: 'propagated' }, text: m[0], priority: PRIORITY.CITY });
      }
    }
    return extra;
  }

  const api = { detectAll, propagateCities, resolveOverlaps, propagateNames, readNameAt, isNameWord, PRIORITY };
  root.DeidDetectors = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
