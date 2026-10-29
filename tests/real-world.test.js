// Realistic layouts seen in real-world records (all names here are invented).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

['data', 'rng', 'dates', 'detectors', 'surrogates', 'deidentify'].forEach((f) =>
  require(path.join(__dirname, '..', 'src', 'engine', f + '.js')));
const { deidentify } = globalThis.Deid;
const DATA = globalThis.DeidData;
const run = (text) => deidentify(text, { seed: 'real-world' }).output;

test('Names in 30 real-world layouts are all removed', () => {
  for (const c of require('./fixtures/real-world-names.json')) {
    const out = run(c.text);
    for (const n of c.names) assert.ok(!out.includes(n), `"${n}" leaked from: ${c.text}\n→ ${out}`);
  }
});

// The classic opening line: "<Name> is a NN-year-old <sex> admitted <date> to <Hospital> <Unit> for <reason>."
const OPENINGS = [
  ['Ghulam Rasool is a 72-year-old male admitted on 10/12/2024 to Mayo Hospital Medical Unit II for altered mental status.',
    ['Ghulam', 'Rasool', '10/12/2024', 'Mayo'], ['is a 72-year-old male admitted on', 'Hospital Medical Unit II for altered mental status.']],
  ['Rasool is a 72 year old male admitted 12 Oct 2024 to PIMS Medical ICU for altered mental status.',
    ['Rasool', '12 Oct 2024', 'PIMS'], ['is a 72 year old male admitted', 'Medical ICU for altered mental status.']],
  ['Zarghuna Bibi Khattak is a 68-year-old female admitted on October 3, 2024 to Lady Reading Hospital, Medicine Unit B, for altered mental status.',
    ['Zarghuna', 'Bibi', 'Khattak', 'October 3', 'Lady Reading'], ['68-year-old female', 'Medicine Unit B, for altered mental status.']],
  ['kwame mensah is a 59 yo male admitted 03/02/2025 to Korle Bu Teaching Hospital ward 4 for altered mental status.',
    ['kwame', 'mensah', '03/02/2025', 'Korle'], ['59 yo male', 'ward 4 for altered mental status.']],
  ['Mr. Tahir Abbas is an 81-year-old man admitted on 2024-11-05 to Jinnah Hospital Neurology Unit for altered mental status.',
    ['Tahir', 'Abbas', '2024-11-05', 'Jinnah'], ['Mr. ', 'is an 81-year-old man', 'Neurology Unit for altered mental status.']],
  ['The patient is a 72-year-old male admitted on 10/12/2024 to Services Hospital Medical Unit III for altered mental status.',
    ['Services Hospital', '10/12/2024'], ['The patient is a 72-year-old male', 'Medical Unit III for altered mental status.']],
  ['Ahmed is a 45-year-old male admitted yesterday to CMH Rawalpindi CCU for altered mental status.',
    ['Ahmed', 'CMH', 'Rawalpindi'], ['is a 45-year-old male admitted yesterday to', 'CCU for altered mental status.']],
  ["Mary-Ellen O'Shea, 77-year-old female, admitted 1/4/2025 to St. Luke's Medical Center 5 West for AMS.",
    ['Mary-Ellen', "O'Shea", '1/4/2025', "Luke's"], ['77-year-old female', '5 West for AMS.']]
];

test('Opening line: name, date and hospital replaced; age, sex, unit and reason kept', () => {
  for (const [text, gone, kept] of OPENINGS) {
    const out = run(text);
    for (const g of gone) assert.ok(!out.includes(g), `"${g}" leaked\n${text}\n→ ${out}`);
    for (const k of kept) assert.ok(out.includes(k), `"${k}" lost\n${text}\n→ ${out}`);
  }
});

test('Opening line: fake first name matches the stated sex', () => {
  const m = run('Ghulam Rasool is a 72-year-old male admitted for AMS.').split(' ')[0];
  const f = run('Zarghuna Khattak is a 68-year-old female admitted for AMS.').split(' ')[0];
  assert.ok(DATA.FAKE.male.includes(m), m);
  assert.ok(DATA.FAKE.female.includes(f), f);
});

test('Opening-line rule does not touch medical sentences', () => {
  const t = 'Diabetes Mellitus is a chronic disease. He was admitted to the ICU for altered mental status. She was admitted to Medicine for sepsis.';
  assert.equal(run(t), t);
});

test('A name-free clinical plan stays exactly the same', () => {
  const t = `Altered mental status, likely multifactorial: hyponatremia (Na 121), UTI and possible Wernicke encephalopathy.
Started Thiamine 500 mg IV TID, Ceftriaxone 1 g daily. Long-term Metformin held. CT Head: no acute bleed.
Neuro: GCS 13 (E3V4M6). Babinski downgoing. Cardio: Sinus rhythm 88/min. Echo: EF 55%. On Aspirin, Atorvastatin.
Renal: AKI on CKD, Cr 2.1 (baseline 1.4). Foley removed. Endo: HbA1c 8.2%. Min glucose 64, Max 312.
ID: Urine Culture: E. coli > 100,000 CFU. Chest X-ray: Right lower lobe consolidation.
Dispo: Medical Unit, Ward 3, Bed 12. Plan discussed with Consultant on call. Code Status: Full Code.
Will repeat Sodium in 6 hours. Mark fluid balance. Hope to transfer to Step-down in 48 hours.`;
  assert.equal(run(t), t);
});
