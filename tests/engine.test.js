// Run with:  npm test   (uses Node's built-in test runner, no dependencies)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

['data', 'rng', 'dates', 'detectors', 'surrogates', 'deidentify'].forEach((f) =>
  require(path.join(__dirname, '..', 'src', 'engine', f + '.js')));
const { deidentify } = globalThis.Deid;

const sample = (name) => fs.readFileSync(path.join(__dirname, '..', 'samples', name), 'utf8');
const run = (text, opts) => deidentify(text, Object.assign({ seed: 'unit-test' }, opts));

function assertGone(output, list) {
  for (const phi of list) assert.ok(!output.includes(phi), `PHI leaked: "${phi}"\n---\n${output}`);
}
function assertKept(output, list) {
  for (const s of list) assert.ok(output.includes(s), `Clinical content lost: "${s}"\n---\n${output}`);
}

test('ED note: every identifier removed', () => {
  const { output } = run(sample('ed-note.txt'));
  assertGone(output, ['John', 'Smith', 'SMITH', '00482913', '03/14/1970', '123 Oak', 'Dallas', '75201',
    '(214) 555-8812', 'jsmith70', '123-45-6789', 'AET99812345', '10/02/2024', 'Amanda', 'Lee,', 'Mary',
    '214-555-9034', 'Patel', 'Mercy General', '09/15/2024', '08/01/2024', 'Lone Star']);
});

test('ED note: clinical details unchanged', () => {
  const { output } = run(sample('ed-note.txt'));
  assertKept(output, ['54-year-old male', 'Sex: Male', 'Troponin I     0.48 ng/mL', 'BP 162/94', 'HR 102',
    'Metformin 1000 mg PO BID', 'Lisinopril 20 mg daily', 'Penicillin (rash)', 'quit 2015', 'Father had MI at age 58',
    '2 mm ST elevation in II, III, aVF', 'Na 138, K 4.1, Cl 101, CO2 23, BUN 18, Cr 1.1, Glucose 212', 'A1c 7.9%',
    '54M with inferior STEMI', 'Aetna PPO', 'TX', '12:15']);
});

test('Discharge summary: identifiers removed, eponyms kept', () => {
  const { output } = run(sample('discharge-summary.txt'));
  assertGone(output, ['Garcia', 'Maria', 'Sofia', 'MR-7731842', '559102384', 'Robert', 'Chen', '713-555-0198',
    '4410 Westheimer', 'Houston', '77027', '832.555.4471', 'Okafor', 'Vincent', "Texas Children's", 'Baylor',
    'mychart', 'NG1234567H', 'Johnson  01', 'January 3, 2024', '02/14/2024']);
  assertKept(output, ['Wilson disease', "Parkinson's disease", 'Babinski sign', 'Stevens-Johnson syndrome',
    'E. coli', '67 y/o female', 'CKD stage 3b', 'Hydroxychloroquine 200 mg BID', 'eGFR 32', 'Texas', 'in 2009']);
});

test('Ages over 89 become 90+, and the date of birth is withheld', () => {
  const { output } = run(sample('nursing-home.txt'));
  assertGone(output, ['94', '05/22/1930', '1930', 'Eleanor', 'Whitfield', 'Patricia', '503-555-0147', 'Portland',
    'Sunrise Gardens', '10.0.12.45', '1EG4-TE5-MK73', 'Hernandez']);
  assertKept(output, ['90+ year-old female', 'BP 128/76', 'Tylenol 650 mg PO q6h PRN', 'Room 212']);
});

test('Ages 89 and under are kept exactly', () => {
  const { output } = run('An 89-year-old man and a 45 yo woman. Age: 72. 3 month old infant.');
  assert.equal(output, 'An 89-year-old man and a 45 yo woman. Age: 72. 3 month old infant.');
});

test('Dates shift by the same amount (intervals preserved)', () => {
  const r = run('Admitted 03/01/2024, discharged 03/05/2024.');
  const [a, b] = r.output.match(/\d{2}\/\d{2}\/\d{4}/g).map((d) => new Date(d));
  assert.equal((b - a) / 86400000, 4);
  assert.notEqual(r.output, 'Admitted 03/01/2024, discharged 03/05/2024.');
});

test('Date shift keeps the weekday', () => {
  const r = run('Seen on 2024-03-04.'); // a Monday
  const d = new Date(r.output.match(/\d{4}-\d{2}-\d{2}/)[0] + 'T00:00:00Z');
  assert.equal(d.getUTCDay(), 1);
});

test('Lab values, vitals and ratios are not mistaken for dates or IDs', () => {
  const text = 'BP 120/80, HR 88, Plt 250000, Na 140, INR 1.2, 2/3 doses taken, ratio 1:4, Hgb 9.8 on 3 L NC.';
  assert.equal(run(text).output, text);
});

test('Same person gets the same fake name everywhere', () => {
  const { output } = run('Patient: Jennifer Walsh. Ms. Walsh was seen. Jennifer reports pain. WALSH, JENNIFER');
  const fakeLast = output.match(/Ms\. (\w+)/)[1];
  const fakeFirst = output.match(/Patient: (\w+)/)[1];
  assert.ok(output.includes(`${fakeFirst} ${fakeLast}`));
  assert.ok(output.includes(`${fakeFirst} reports`));
  assert.ok(output.includes(`${fakeLast.toUpperCase()}, ${fakeFirst.toUpperCase()}`));
});

test('Fake first names keep the original sex', () => {
  const D = globalThis.DeidData;
  const { output } = run('Patient: Margaret Hill. Son: Thomas Hill.');
  const [f, m] = [output.match(/Patient: (\w+)/)[1], output.match(/Son: (\w+)/)[1]];
  assert.ok(D.FAKE.female.includes(f), f);
  assert.ok(D.FAKE.male.includes(m), m);
});

test('Tag style output', () => {
  const { output } = run('Patient: John Smith, phone 555-123-4567. Mr. Smith is stable.', { style: 'tags' });
  assert.match(output, /Patient: \[NAME-1\], phone \[PHONE-1\]\. Mr\. \[NAME-1\] is stable\./);
});

test('Option: keep clinician names', () => {
  const { output } = run('Patient: John Smith. Attending: Dr. Amanda Lee. Signed by: Amanda Lee, MD', { replaceClinicians: false });
  assertGone(output, ['John', 'Smith']);
  assertKept(output, ['Dr. Amanda Lee', 'Amanda Lee, MD']);
});

test('Custom terms and ignore list', () => {
  const r = run('Pet dog Biscuit. Patient: Grace Kim.', {
    customTerms: [{ term: 'Biscuit', replacement: 'Max' }], ignoreTerms: ['Grace Kim']
  });
  assert.equal(r.output, 'Pet dog Max. Patient: Grace Kim.');
});

test('Structured identifiers', () => {
  const text = 'SSN 987-65-4321, email a.b@x.org, http://site.com/x, IP 172.16.5.4, VIN 1HGCM82633A004352, ZIP 03601.';
  const { output } = run(text);
  assertGone(output, ['987-65-4321', 'a.b@x.org', 'site.com', '172.16.5.4', '1HGCM82633A004352', '03601']);
  assert.ok(output.includes('000XX'), 'restricted ZIP3 should become 000');
});

test('Medical eponyms are never treated as names', () => {
  const text = "Hx of Crohn's disease, Graves disease, Bell's palsy, Cushing syndrome, Foley catheter placed, Down syndrome, Apgar 8.";
  assert.equal(run(text).output, text);
});

test('Common words that are also names are not replaced without context', () => {
  const text = 'Will follow up in May. Grace period noted. Mark the site. Hope to discharge tomorrow.';
  assert.equal(run(text).output, text);
});

test('Same seed gives same output; different seed changes fakes', () => {
  const t = 'Patient: John Smith';
  assert.equal(run(t).output, run(t).output);
  assert.notEqual(run(t, { seed: 'a' }).output, run(t, { seed: 'b' }).output);
});

test('Harder cases: unlabeled names, formats, ALL CAPS, places', () => {
  const text = [
    'Seen with Jose Martinez and his brother Luis yesterday.',
    'Labs drawn 14-MAR-2024 and again March 14th, 2024; next visit 3/28.',
    'Call +1 (212) 555 0100 or 212.555.0199 ext 12.',
    'Pt is a 92 y/o F from Boise. 96F with dementia.',
    'PATIENT: JOHNSON, ROBERT  DOB: 1/2/1948',
    'JOHNSON IS A 76 YO MALE WITH COPD.',
    'Nguyen, Linh was the roommate. Nurse Kelly helped.',
    "Patient's son, Ahmed Khan, lives in Fresno and works for Amazon.",
    "Referred by Dr. O'Brien-Walsh to Johns Hopkins Hospital.",
    'Lives at 77 W. 5th Ave Apt 3, Boston, MA 02116. Previously from Jefferson County.',
    'Started insulin in June 2019. Diagnosed 2/2015.'
  ].join('\n');
  const { output } = run(text);
  assertGone(output, ['Jose', 'Martinez', 'Luis', '14-MAR-2024', 'March 14th', '3/28', '(212) 555 0100', '212.555.0199',
    '92', '96F', 'Boise', 'JOHNSON', 'ROBERT', '1/2/1948', 'Nguyen', 'Linh', 'Kelly', 'Ahmed', 'Khan', 'Fresno',
    'Amazon', "O'Brien", 'Hopkins', '77 W', 'Boston', '02116', 'Jefferson', 'June 2019', '2/2015']);
  assertKept(output, ['76 YO MALE WITH COPD', 'MA 021XX', 'dementia']);
});

test('Drug and section names are left alone', () => {
  const text = 'Allergies: Bactrim. PMH: HTN. Plan: start Keppra. Continue Eliquis. Family: Mother alive.';
  assert.equal(run(text).output, text);
});
