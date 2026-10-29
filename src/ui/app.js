/* HIPA user interface. Runs entirely in the browser; the text never leaves this page. */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const els = {
    input: $('input'), output: $('output'), sample: $('sample'), file: $('file'), clear: $('clear'),
    clinicians: $('clinicians'), reseed: $('reseed'), custom: $('custom'), ignore: $('ignore'),
    highlights: $('highlights'), copy: $('copy'), download: $('download'), stats: $('stats'),
    reviewList: $('review-list'), reviewCount: $('review-count'), reviewBox: $('review-box'),
    banner: $('review-banner'), mapping: document.querySelector('#mapping tbody'), popover: $('popover'),
    redactSel: $('redact-sel'), toast: $('toast'), offsetNote: $('offset-note')
  };

  // Only harmless preferences are remembered. Patient text and term lists are never stored.
  const PREF_KEY = 'hipa-prefs-v1';
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        style: radio('style'), dates: radio('dates'), clinicians: els.clinicians.checked, highlights: els.highlights.checked
      }));
    } catch (e) { /* storage unavailable: fine */ }
  }
  function radio(name) {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : null;
  }
  function setRadio(name, value) {
    const r = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (r) r.checked = true;
  }

  let seed = DeidRng.newSeed();
  let result = null;
  const reviewed = new Set();

  function options() {
    return {
      seed,
      style: radio('style'),
      dates: radio('dates'),
      replaceClinicians: els.clinicians.checked,
      customTerms: Deid.parseTermList(els.custom.value),
      ignoreTerms: Deid.parseTermList(els.ignore.value).map((t) => t.term)
    };
  }

  // ---------- Processing ----------
  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(process, 180);
  }

  function process() {
    hidePopover();
    const text = els.input.value;
    if (!text.trim()) {
      result = null;
      els.output.innerHTML = '<p class="empty">Your de-identified text will appear here.</p>';
      els.stats.innerHTML = '';
      els.reviewList.innerHTML = '';
      els.reviewCount.textContent = '0';
      els.mapping.innerHTML = '';
      els.banner.hidden = true;
      els.offsetNote.textContent = '';
      return;
    }
    const t0 = performance.now();
    result = Deid.deidentify(text, options());
    render(performance.now() - t0);
  }

  function render(ms) {
    const frag = document.createDocumentFragment();
    for (const seg of result.segments) {
      if (seg.kind === 'text') { frag.appendChild(document.createTextNode(seg.text)); continue; }
      const m = document.createElement('mark');
      m.textContent = seg.text;
      m.dataset.id = seg.id;
      if (seg.kind === 'hint') m.className = 'hint';
      else m.className = 'r ' + (seg.confidence === 'medium' && !reviewed.has(key(seg)) ? 'medium' : 'high');
      m.title = seg.kind === 'hint' ? seg.note : `${Deid.TYPE_LABELS[seg.type]} · original hidden — click for details`;
      frag.appendChild(m);
    }
    els.output.innerHTML = '';
    els.output.appendChild(frag);
    els.output.classList.toggle('plain', !els.highlights.checked);

    // stats
    const total = Object.values(result.stats).reduce((a, b) => a + b, 0);
    els.stats.innerHTML = '';
    const head = document.createElement('span');
    head.className = 'stat total';
    head.textContent = `${total} replaced`;
    els.stats.appendChild(head);
    Object.entries(result.stats).sort((a, b) => b[1] - a[1]).forEach(([type, n]) => {
      const s = document.createElement('span');
      s.className = 'stat';
      s.textContent = `${Deid.TYPE_LABELS[type] || type} ${n}`;
      els.stats.appendChild(s);
    });
    const t = document.createElement('span');
    t.className = 'stat muted';
    t.textContent = `${Math.max(1, Math.round(ms))} ms · on this device`;
    els.stats.appendChild(t);

    if (result.dateOffsetDays && radio('dates') === 'shift') {
      const w = Math.abs(result.dateOffsetDays) / 7;
      els.offsetNote.textContent = `Dates moved ${w} weeks ${result.dateOffsetDays > 0 ? 'later' : 'earlier'}.`;
    } else els.offsetNote.textContent = '';

    renderReview();
    renderMapping();
  }

  const key = (seg) => seg.type + '|' + seg.original;

  function pending() {
    return result ? result.review.filter((r) => !reviewed.has(key(r))) : [];
  }

  function renderReview() {
    const items = pending();
    els.reviewCount.textContent = String(items.length);
    els.reviewList.innerHTML = '';
    const seen = new Set();
    for (const r of items) {
      if (seen.has(key(r))) continue;
      seen.add(key(r));
      const li = document.createElement('li');
      const what = document.createElement('div');
      const b = document.createElement('b');
      b.textContent = r.kind === 'hint' ? `“${r.original}”` : `“${r.original}” → “${r.text}”`;
      what.appendChild(b);
      const note = document.createElement('small');
      note.textContent = r.kind === 'hint' ? ' ' + r.note : ` ${Deid.TYPE_LABELS[r.type]} found without strong context`;
      what.appendChild(note);
      li.appendChild(what);
      li.appendChild(actionButtons(r));
      els.reviewList.appendChild(li);
    }
    if (items.length) {
      els.banner.hidden = false;
      els.banner.textContent = `${seen.size} item${seen.size === 1 ? ' needs' : 's need'} a quick look before sharing — see “Items to review” below or click the yellow/orange highlights.`;
    } else {
      els.banner.hidden = true;
    }
  }

  function actionButtons(seg) {
    const box = document.createElement('div');
    box.className = 'btn-row';
    const add = (label, cls, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn small ' + cls;
      b.textContent = label;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
      box.appendChild(b);
    };
    if (seg.kind === 'hint') {
      add('Redact it', 'primary', () => addLine(els.custom, seg.original));
      add('Fine as is', 'ghost', () => { reviewed.add(key(seg)); hidePopover(); render(0); });
    } else {
      if (seg.confidence === 'medium' && !reviewed.has(key(seg))) {
        add('Correct ✓', 'primary', () => { reviewed.add(key(seg)); hidePopover(); render(0); });
      }
      add('Not an identifier — restore', 'ghost', () => addLine(els.ignore, seg.original));
    }
    return box;
  }

  function addLine(textarea, line) {
    const lines = textarea.value.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.some((l) => l.toLowerCase() === line.toLowerCase())) lines.push(line.replace(/\s+/g, ' ').trim());
    textarea.value = lines.join('\n');
    document.querySelector('.settings').open = true;
    hidePopover();
    process();
    toast(textarea === els.custom ? `Will always replace “${line}”` : `Restored “${line}”`);
  }

  function renderMapping() {
    els.mapping.innerHTML = '';
    for (const m of result.mapping) {
      const tr = document.createElement('tr');
      [Deid.TYPE_LABELS[m.type] || m.type, m.original, m.replacement, m.count].forEach((v) => {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      });
      els.mapping.appendChild(tr);
    }
  }

  // ---------- Popover ----------
  function showPopover(markEl) {
    const seg = result.segments.find((s) => String(s.id) === markEl.dataset.id);
    if (!seg) return;
    const p = els.popover;
    p.innerHTML = '';
    const h = document.createElement('div');
    h.className = 'pop-type';
    h.textContent = seg.kind === 'hint' ? 'Review hint' : `${Deid.TYPE_LABELS[seg.type]}${seg.confidence === 'medium' ? ' · please check' : ''}`;
    p.appendChild(h);
    const body = document.createElement('div');
    body.className = 'pop-body';
    if (seg.kind === 'hint') {
      body.textContent = seg.note;
    } else {
      const o = document.createElement('div');
      o.innerHTML = '<span class="muted">Original:</span> ';
      const ob = document.createElement('b');
      ob.textContent = seg.original;
      o.appendChild(ob);
      const r = document.createElement('div');
      r.innerHTML = '<span class="muted">Now:</span> ';
      const rb = document.createElement('b');
      rb.textContent = seg.text;
      r.appendChild(rb);
      body.append(o, r);
    }
    p.appendChild(body);
    p.appendChild(actionButtons(seg));
    p.hidden = false;
    const rect = markEl.getBoundingClientRect();
    const pw = Math.min(320, window.innerWidth - 24);
    p.style.width = pw + 'px';
    p.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, rect.left + window.scrollX)) + 'px';
    p.style.top = rect.bottom + window.scrollY + 6 + 'px';
  }
  function hidePopover() { els.popover.hidden = true; }

  els.output.addEventListener('click', (e) => {
    const m = e.target.closest('mark');
    if (m && els.output.contains(m)) { e.stopPropagation(); showPopover(m); }
  });
  document.addEventListener('click', (e) => {
    if (!els.popover.contains(e.target)) hidePopover();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hidePopover(); els.redactSel.hidden = true; } });

  // ---------- Select text in output → redact ----------
  let selected = '';
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !els.output.contains(sel.anchorNode)) { els.redactSel.hidden = true; return; }
    const t = sel.toString().trim();
    if (t.length < 2 || t.length > 80 || /\n/.test(t)) { els.redactSel.hidden = true; return; }
    selected = t;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    els.redactSel.style.left = Math.max(8, rect.left + window.scrollX) + 'px';
    els.redactSel.style.top = rect.top + window.scrollY - 40 + 'px';
    els.redactSel.hidden = false;
  });
  els.redactSel.addEventListener('mousedown', (e) => e.preventDefault());
  els.redactSel.addEventListener('click', () => {
    els.redactSel.hidden = true;
    if (selected) addLine(els.custom, selected);
    window.getSelection().removeAllRanges();
  });

  // ---------- Copy / download ----------
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  els.copy.addEventListener('click', async () => {
    if (!result) return toast('Nothing to copy yet.');
    const left = pending().length;
    const ok = await copyText(result.output);
    toast(ok ? (left ? `Copied — ${left} item(s) still unreviewed. Please read before sharing.` : 'Copied cleaned text.') : 'Copy failed — select the text and copy manually.');
  });

  els.download.addEventListener('click', () => {
    if (!result) return toast('Nothing to download yet.');
    const blob = new Blob([result.output], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'deidentified.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  // ---------- Input sources ----------
  function loadText(text) {
    els.input.value = text;
    reviewed.clear();
    process();
  }
  els.sample.addEventListener('change', () => {
    const v = els.sample.value;
    if (v && window.HIPA_SAMPLES && window.HIPA_SAMPLES[v]) loadText(window.HIPA_SAMPLES[v]);
    els.sample.value = '';
  });
  function readFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('File is larger than 5 MB.');
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result));
    reader.onerror = () => toast('Could not read that file.');
    reader.readAsText(file);
  }
  els.file.addEventListener('change', () => { readFile(els.file.files[0]); els.file.value = ''; });
  els.input.addEventListener('dragover', (e) => { e.preventDefault(); els.input.classList.add('drop'); });
  els.input.addEventListener('dragleave', () => els.input.classList.remove('drop'));
  els.input.addEventListener('drop', (e) => {
    e.preventDefault();
    els.input.classList.remove('drop');
    readFile(e.dataTransfer.files[0]);
  });
  els.clear.addEventListener('click', () => { loadText(''); els.input.focus(); });

  els.input.addEventListener('input', schedule);
  els.custom.addEventListener('input', schedule);
  els.ignore.addEventListener('input', schedule);
  document.querySelectorAll('input[name="style"], input[name="dates"]').forEach((r) =>
    r.addEventListener('change', () => { savePrefs(); process(); }));
  els.clinicians.addEventListener('change', () => { savePrefs(); process(); });
  els.highlights.addEventListener('change', () => { savePrefs(); els.output.classList.toggle('plain', !els.highlights.checked); });
  els.reseed.addEventListener('click', () => { seed = DeidRng.newSeed(); process(); toast('New fake identities and date shift generated.'); });

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
  }

  // ---------- Init ----------
  const prefs = loadPrefs();
  if (prefs.style) setRadio('style', prefs.style);
  if (prefs.dates) setRadio('dates', prefs.dates);
  if (typeof prefs.clinicians === 'boolean') els.clinicians.checked = prefs.clinicians;
  if (typeof prefs.highlights === 'boolean') els.highlights.checked = prefs.highlights;
  if (window.innerWidth < 720) document.querySelector('.settings').open = false;
  process();
})();
