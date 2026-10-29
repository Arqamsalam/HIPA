# HIPA: Clinical Text De-identifier

**Remove HIPAA identifiers from clinical notes, lab reports and records, entirely in your browser.**
Get de-identified text you can use for teaching, case discussions and AI tools.

🔗 **Use it:** https://arqamsalam.github.io/HIPA/
📖 **How it works (plain language):** https://arqamsalam.github.io/HIPA/guide.html
💾 **Offline version:** a single HTML file you can save and run with no internet ([download](https://arqamsalam.github.io/HIPA/hipa-offline.html))

> **The idea in one line:** a *witness protection program for medical records*. The patient gets a new name,
> address and ID numbers, but the medical story (diagnosis, labs, meds, timeline) stays exactly the same.

---

## What it does

| Before | After |
|---|---|
| `Patient Name: John A. Smith   MRN: 00482913` | `Patient Name: Theo H. Dalgleish   MRN: 51865336` |
| `DOB: 03/14/1970` | `DOB: 07/05/1969` *(every date shifted by the same amount)* |
| `123 Oak Street, Apt 4B, Dallas, TX 75201` | `334 Sunset Street, Mossgrove, TX 752XX` |
| `Mr. Smith is a 54-year-old male…` | `Mr. Dalgleish is a 54-year-old male…` *(age & sex kept)* |
| `Eleanor Whitfield, 94-year-old female` | `Fiona Kendrick, 90+ year-old female` *(HIPAA rule for ages ≥ 90)* |
| `Troponin I 0.48 ng/mL, BP 162/94` | `Troponin I 0.48 ng/mL, BP 162/94` *(clinical data untouched)* |
| `Hx of Wilson disease, Bell's palsy` | `Hx of Wilson disease, Bell's palsy` *(medical eponyms kept)* |

### Covers all 18 HIPAA Safe Harbor identifiers
Names · street/city/county/ZIP (state kept, ZIP → first 3 digits, `000` for low-population areas) · all date
elements except year · ages over 89 · phone · fax · email · SSN · medical record / health plan / account /
license / certificate numbers · vehicle & device identifiers · URLs · IP addresses · biometric IDs ·
other unique numbers. Facilities, schools and employers are replaced too.

### Features
- 🔒 **Private by design.** No server, no uploads, no analytics. A Content-Security-Policy (`connect-src 'none'`) technically blocks the page from sending data anywhere. Patient text is never stored.
- 🎭 **Realistic fakes or tags.** `John Smith → Theo Dalgleish`, or `John Smith → [NAME-1]`.
- 🔁 **Consistent.** `John Smith`, `Mr. Smith`, `J. Smith`, `SMITH, JOHN` all become the same fake person. Fake first names keep the original sex.
- 📅 **Smart date shifting.** One random shift per document, in whole weeks, so intervals *and* weekdays stay correct.
- 🩺 **Medical allow-list.** *Parkinson's disease*, *Foley catheter*, *Babinski sign*, *Stevens-Johnson syndrome*… are never mistaken for people.
- 🚦 **Human review screen.** Green = replaced, yellow = replaced but please check, orange = consider (e.g. "former mayor", "Christmas Eve"). Click to restore. Select text to redact.
- ✍️ **Custom lists.** "Always replace" (pet names, small businesses: `Biscuit = Max`) and "Never replace" (false alarms).
- 👩‍⚕️ **Option to keep clinician names**, for teaching scenarios where that's allowed.
- 📱 Works on phones, supports dark mode, and has a single-file offline edition.

---

## Run it locally

No install and no dependencies. Either:

- open `dist/hipa-offline.html` (after `npm run build`) by double-clicking it, or
- serve the folder: `python3 -m http.server` → open http://localhost:8000

```bash
npm test          # 19 tests: no-leak checks on synthetic notes + edge cases
npm run build     # regenerates src/ui/samples.js and dist/hipa-offline.html
```

## How it works

```
text ─► detectors ─► resolve overlaps ─► spread names/cities ─► fake-data generator ─► review screen
         (patterns,      (most specific      ("Smith" found once     (consistent, seeded,
         context,         wins)               → every "Smith")         format-preserving)
         dictionaries)
```

| File | Role |
|---|---|
| `src/engine/detectors.js` | Finds identifiers: patterns, context labels (`Patient:`, `Dr.`, `his wife`), name/city dictionaries, eponym guard |
| `src/engine/dates.js` | Parses 10+ date formats and shifts them, keeping the original format |
| `src/engine/surrogates.js` | Generates consistent fake names, numbers, addresses |
| `src/engine/deidentify.js` | The pipeline; also usable from Node: `require('./src/engine/deidentify.js')` after loading the other engine files |
| `src/engine/data.js` | Dictionaries: names, surnames, eponyms, states, cities, fake data |
| `src/ui/` | The web interface |
| `tests/` | Node test suite (`node --test`) |
| `samples/` | **Synthetic** clinical notes (no real patients) |

## ⚠️ Limitations

- **No automated tool can guarantee 100% de-identification.** HIPA is a strong first pass. A human must review the output.
- Tuned for **English, US-style** clinical text. All-lowercase names, very unusual names with no context, and non-US addresses are harder to catch.
- Implements **Safe Harbor**, not Expert Determination.
- Text only. It does not process images or scanned PDFs.
- Follow your institution's policies (privacy office / IRB) before using patient-derived text with external services, including AI tools.
- The **Replacement key** table maps fakes back to real people. It is PHI. Don't share it.

## Contributing

Found something that slipped through? Please open an issue with a **synthetic** example (never real patient data)
showing the input and what was missed. Adding a failing case to `tests/engine.test.js` is the best bug report.

## License

MIT. See [LICENSE](LICENSE). Provided as-is, without warranty. You are responsible for verifying output and complying with applicable law.
