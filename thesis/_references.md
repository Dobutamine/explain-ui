# EXPLAIN paper series — running bibliography

**Purpose.** A single working reference pool for the series. Each paper renumbers its own
subset in citation order (Vancouver, matching the cardiovascular paper). Entries marked
**[VERIFY]** are candidate sources identified from the model mathematics but **not yet
confirmed against PubMed** — confirm author/year/journal/DOI/PMID before they enter a
manuscript. Do not cite a [VERIFY] entry in submission text until checked.

Anchors already used and formatted in the cardiovascular paper (reuse verbatim there):
Beneken & DeWit (circuit elements), Suga (time-varying elastance), Burkhoff & Tyberg,
van Meurs (integrated model / numerical methods), Bischoff et al. (preterm PDA cohort),
Jones (pulmonary hypertension), van Laere (PDA Doppler); Anthropic Claude / Claude Agent SDK;
Burden & Faires (secant method). See `articles/circ-paper-additions.md` Block G for the
already-drafted software/AI citations.

---

## Acid–base and blood-gas transport (Paper 2 keystone — `BloodComposition.js`)

The solver is a Stewart physicochemical (strong-ion) model closed by electroneutrality,
with CO₂ speciation, non-bicarbonate buffering by albumin/phosphate, a Van Slyke base-excess
expression, and a Hill O₂–haemoglobin dissociation curve whose P50 shifts with pH, PCO₂,
temperature and 2,3-DPG. Candidate provenance:

- **[VERIFY]** Stewart PA. Modern quantitative acid–base chemistry. *Can J Physiol
  Pharmacol.* 1983;61(12):1444–61. — the strong-ion difference (SID) framework; Eq. for
  net plasma charge / electroneutrality.
- **[VERIFY]** Stewart PA. Independent and dependent variables of acid–base control.
  *Respir Physiol.* 1978;33(1):9–26.
- **[VERIFY]** Figge J, Rossing TH, Fencl V. The role of serum proteins in acid–base
  equilibria. *J Lab Clin Med.* 1991;117(6):453–67. — albumin/phosphate charge terms
  (the `0.123·pH − 0.631` / `0.309·pH − 0.469` buffer expressions).
- **[VERIFY]** Siggaard-Andersen O. The Van Slyke equation. *Scand J Clin Lab Invest
  Suppl.* 1977;146:15–20. — base excess = (HCO₃ − 24.4 + (2.3·Hb + 7.7)(pH − 7.4))·
  (1 − 0.023·Hb); match constants (engine uses 25.1).
- **[VERIFY]** Kelman GR. Digital computer subroutine for the conversion of oxygen tension
  into saturation. *J Appl Physiol.* 1966;21(4):1375–6. — O₂–Hb dissociation subroutine.
- **[VERIFY]** Severinghaus JW. Simple, accurate equations for human blood O₂ dissociation
  computations. *J Appl Physiol.* 1979;46(3):599–602.
- **[VERIFY]** Dash RK, Bassingthwaighte JB. Blood HbO₂ and HbCO₂ dissociation curves at
  varied O₂, CO₂, pH, 2,3-DPG and temperature levels. *Ann Biomed Eng.* 2004;32(12):1676–93.
  — P50 shift coefficients for pH (Bohr), PCO₂, temperature, DPG; Haldane coupling.
- **[VERIFY]** Thomas LJ Jr. Algorithms for selected blood acid–base and blood gas
  calculations. *J Appl Physiol.* 1972;33(1):154–8.
- **[VERIFY]** Hill AV. The possible effects of the aggregation of the molecules of
  haemoglobin on its dissociation curves. *J Physiol.* 1910;40:iv–vii. — Hill equation
  (engine coefficient n = 2.7).

## Gas exchange and diffusion (Paper 2 — `GasExchanger.js`, `GasDiffusor.js`)

- **[VERIFY]** Fick A. Ueber Diffusion. *Ann Phys.* 1855;170(1):59–86. — partial-pressure-
  driven flux law underpinning `flux = (P_blood − P_gas)·D·Δt`.
- **[VERIFY]** Wagner PD. The multiple inert gas elimination technique / diffusion
  limitation references (choose a standard alveolar–capillary diffusion review).
- **[VERIFY]** West JB. *Respiratory Physiology: The Essentials.* — textbook anchor for
  alveolar gas equation, dead space, V/Q.

## Respiratory mechanics, control and surfactant (Paper 2 — `Breathing.js`, `Surfactant.js`)

- **[VERIFY]** Rahn/Otis or a standard neonatal respiratory-mechanics reference for the
  spontaneous-drive → muscle-pressure model.
- **[VERIFY]** Surfactant recruitment/derecruitment hysteresis source (e.g. Bachofen &
  Schürch surface-tension hysteresis; a recruitment-model reference for the `open_fraction`
  threshold dynamics). Confirm what the source header comments cite.

## Metabolism and lactate (Paper 2 — `Metabolism.js`, `Lactate.js`)

- **[VERIFY]** Q10 temperature-coefficient reference for metabolic-rate scaling.
- **[VERIFY]** A neonatal VO₂/VCO₂ and respiratory-quotient reference.
- **[VERIFY]** Anaerobic lactate production / O₂-debt and Cori-cycle clearance references.

---

## Notes

- Prefer sources the engine source-file header comments already name; the header comments of
  `Brain.js`, `Mob.js`, `Thermoregulation.js`, `Surfactant.js`, `Pda.js`,
  `chd_duct_fo_dependent.md` are the closest thing to an existing bibliography (the last has
  ~48 references) — mine these first before external search.
- When a constant in the code differs from the textbook value (e.g. base-excess offset 25.1
  vs. 24.4; P50 baselines HbF 18.8 / neonatal 20.0 / adult 26.7), state the engine value and
  cite the source it was adapted from — do not silently "correct" it.
