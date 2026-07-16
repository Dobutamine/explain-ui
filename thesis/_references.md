# EXPLAIN paper series — running bibliography

**Purpose.** A single working reference pool for the series. Each paper renumbers its own
subset in citation order (Vancouver, matching the cardiovascular paper).

**Verification status (2026-07-12).** The Paper 2, 3 and 4 candidate sources were run through
a PubMed verification pass. Entries now carry a confirmed **PMID** and **DOI**; every PMID/DOI
below was retrieved and confirmed against PubMed (none fabricated). A small number of sources
are genuinely **pre-MEDLINE / textbook** (historical physics or a coefficient that has no single
canonical paper) — these are marked **[not in PubMed — historical/textbook]** with a citable
substitute, and should be cited as books or historical primary sources, not chased in PubMed.
Entries still marked **[VERIFY]** were not part of the checked set (Paper 1 anchors already
formatted in the cardiovascular manuscript, and a few textbook anchors) — confirm before first use.

Anchors already used and formatted in the cardiovascular paper (reuse verbatim there):
Beneken & DeWit (circuit elements), Suga (time-varying elastance), Burkhoff & Tyberg,
van Meurs (integrated model / numerical methods), Bischoff et al. (preterm PDA cohort),
Jones (pulmonary hypertension), van Laere (PDA Doppler); Anthropic Claude / Claude Agent SDK;
Burden & Faires (secant method). See `thesis/circ-paper-additions.md` Block G for the
already-drafted software/AI citations.

---

## Software / model archive (all papers — data/code-availability citation)

The engine is the citable research artifact behind every paper; cite the **concept
(all-versions) DOI** so it always resolves to the latest release. *(Zenodo record verified 2026-07-16.)*

- Antonius T. *Explain: a whole-body physiological simulation engine* (Version v0.1.0) [Software].
  Zenodo; 2026. **doi:10.5281/zenodo.21389097** (concept/all-versions DOI).
  Source: https://github.com/Dobutamine/explain-engine (MIT). Interactive model:
  https://explain-modeling.com.

---

## Acid–base and blood-gas transport (Paper 2 keystone — `BloodComposition.js`)

The solver is a Stewart physicochemical (strong-ion) model closed by electroneutrality,
with CO₂ speciation, non-bicarbonate buffering by albumin/phosphate, a Van Slyke base-excess
expression, and a Hill O₂–haemoglobin dissociation curve whose P50 shifts with pH, PCO₂,
temperature and 2,3-DPG. Verified provenance:

- Stewart PA. Modern quantitative acid–base chemistry. *Can J Physiol Pharmacol.*
  1983;61(12):1444–61. **PMID 6423247. doi:10.1139/y83-207.** — the strong-ion difference
  (SID) framework; net plasma charge / electroneutrality.
- Stewart PA. Independent and dependent variables of acid–base control. *Respir Physiol.*
  1978;33(1):9–26. **PMID 27857. doi:10.1016/0034-5687(78)90079-8.**
- Figge J, Rossing TH, Fencl V. The role of serum proteins in acid–base equilibria.
  *J Lab Clin Med.* 1991;117(6):453–67. **PMID 2045713.** (no DOI) — albumin/phosphate charge
  terms (the `0.123·pH − 0.631` / `0.309·pH − 0.469` buffer expressions).
- Siggaard-Andersen O. The van Slyke equation. *Scand J Clin Lab Invest Suppl.*
  1977;146:15–20. **PMID 13478. doi:10.3109/00365517709098927.** — base excess expression;
  match constants (engine uses 25.1 vs textbook 24.4 — state engine value, cite this source).
- Kelman GR. Digital computer subroutine for the conversion of oxygen tension into saturation.
  *J Appl Physiol.* 1966;21(4):1375–6. **PMID 5916678. doi:10.1152/jappl.1966.21.4.1375.** —
  O₂–Hb dissociation subroutine.
- Severinghaus JW. Simple, accurate equations for human blood O₂ dissociation computations.
  *J Appl Physiol Respir Environ Exerc Physiol.* 1979;46(3):599–602. **PMID 35496.
  doi:10.1152/jappl.1979.46.3.599.**
- Dash RK, Bassingthwaighte JB. Blood HbO₂ and HbCO₂ dissociation curves at varied O₂, CO₂, pH,
  2,3-DPG and temperature levels. *Ann Biomed Eng.* 2004;32(12):1676–93. **PMID 15682524.
  doi:10.1007/s10439-004-7821-6.** — P50 shift coefficients (Bohr, PCO₂, temperature, DPG),
  Haldane coupling. **Cite the 2010 erratum for the corrected equations:** Dash RK,
  Bassingthwaighte JB. *Ann Biomed Eng.* 2010;38(4):1683–701. **PMID 20162361; PMCID PMC2862600.
  doi:10.1007/s10439-010-9948-y.**
- Thomas LJ Jr. Algorithms for selected blood acid–base and blood gas calculations.
  *J Appl Physiol.* 1972;33(1):154–8. **PMID 5037404. doi:10.1152/jappl.1972.33.1.154.**
- **[not in PubMed — historical]** Hill AV. The possible effects of the aggregation of the
  molecules of haemoglobin on its dissociation curves. *J Physiol.* 1910;40(Suppl):iv–vii. —
  Hill equation (engine coefficient n = 2.7). Pre-MEDLINE; cite as the historical primary source.

## Gas exchange and diffusion (Paper 2 — `GasExchanger.js`, `GasDiffusor.js`)

- **[not in PubMed — historical/physics]** Fick A. Ueber Diffusion. *Ann Phys.*
  1855;170(1):59–86. doi:10.1002/andp.18551700105 (English: *Philos Mag.* 1855;10:30–39). —
  partial-pressure-driven flux law underpinning `flux = (P_blood − P_gas)·D·Δt`. Cite as
  historical primary source (not in PubMed).
- Wagner PD, Saltzman HA, West JB. Measurement of continuous distributions of ventilation–
  perfusion ratios: theory. *J Appl Physiol.* 1974;36(5):588–99. **PMID 4826323.
  doi:10.1152/jappl.1974.36.5.588.** — MIGET / V̇/Q̇ distribution and diffusion limitation.
- **[VERIFY — textbook]** West JB. *Respiratory Physiology: The Essentials.* — textbook anchor
  for alveolar gas equation, dead space, V̇/Q̇ (cite a specific edition/page if used).

## Respiratory mechanics, control and surfactant (Paper 2 — `Breathing.js`, `Surfactant.js`)

- Bachofen H, Schürch S, Urbinelli M, Weibel ER. Relations among alveolar surface tension,
  surface area, volume, and recoil pressure. *J Appl Physiol (1985).* 1987;62(5):1878–87.
  **PMID 3597262. doi:10.1152/jappl.1987.62.5.1878.** — surface-tension/area hysteresis
  underpinning the `open_fraction` recruitment–derecruitment dynamics.
- **[VERIFY — textbook]** A standard neonatal respiratory-mechanics reference for the
  spontaneous-drive → muscle-pressure model (confirm what `Breathing.js` header comments cite;
  Rahn/Otis or a neonatal text).

## Metabolism and lactate (Paper 2 — `Metabolism.js`, `Lactate.js`)

- Wahlig TM, Gatto CW, Boros SJ, Mammel MC, Mills MM, Georgieff MK. Metabolic response of
  preterm infants to variable degrees of respiratory illness. *J Pediatr.* 1994;124(2):283–8.
  **PMID 8301440. doi:10.1016/s0022-3476(94)70321-3.** — neonatal VO₂/RQ. (Alt: Dechert RE et al.
  *JPEN* 1988;12(3):256–9. **PMID 3134559.**)
- **[not in PubMed — textbook]** Q10 temperature-coefficient for metabolic-rate scaling. This is
  the van 't Hoff/Arrhenius principle — no single canonical PubMed paper; cite a standard
  physiology text (e.g. Schmidt-Nielsen K. *Animal Physiology*, 5th ed. 1997) or historical
  van 't Hoff (1884).
- **[textbook]** Hall JE, Hall ME. *Guyton and Hall Textbook of Medical Physiology.* 14th ed.
  Philadelphia: Elsevier; 2021. — anaerobic lactate production under oxygen debt and its
  Cori-cycle/hepatic–renal clearance (the hypoxia-driven lactate term); standard physiology-text
  anchor, no single canonical primary paper.

---

## Regulatory organ systems (Paper 3 — `Brain.js`, `Kidneys.js`, `Hormones.js`, `Thermoregulation.js`, `Glucose.js`, drug models)

**Cerebral pressure–flow autoregulation & pressure-passivity (prematurity + HIE)**
- Alderliesten T, Lemmers PMA, Smarius JJM, van de Vosse RE, Baerts W, van Bel F. Cerebral
  oxygenation, extraction, and autoregulation in very preterm infants who develop
  peri-intraventricular hemorrhage. *J Pediatr.* 2012;162(4):698–704.e2. **PMID 23140883.
  doi:10.1016/j.jpeds.2012.09.038.** — blood-pressure-passive cerebral perfusion preceding PIVH.
- Massaro AN, Govindan RB, Vezina G, Chang T, Andescavage NN, Wang Y, et al. Impaired cerebral
  autoregulation and brain injury in newborns with hypoxic-ischemic encephalopathy treated with
  hypothermia. *J Neurophysiol.* 2015;114(2):818–24. **PMID 26063779. doi:10.1152/jn.00353.2015.**
  — pressure-passivity index in HIE.

**Monro–Kellie doctrine / intracranial pressure–volume relationship**
- Mokri B. The Monro-Kellie hypothesis: applications in CSF volume depletion. *Neurology.*
  2001;56(12):1746–8. **PMID 11425944. doi:10.1212/wnl.56.12.1746.** — canonical modern statement.

**Glomerular filtration by Starling forces (net filtration pressure, Kf)**
- Maddox DA, Bennett CM, Deen WM, Glassock RJ, Knutson D, Daugharty TM, Brenner BM. Determinants
  of glomerular filtration in experimental glomerulonephritis in the rat. *J Clin Invest.*
  1975;55(2):305–18. **PMID 1127101. doi:10.1172/JCI107934.** — micropuncture quantification of
  ΔP, transcapillary oncotic pressure and ultrafiltration coefficient (Starling determinants of SNGFR).
- **[not in PubMed — textbook]** The Starling principle itself (Starling EH, *J Physiol.* 1896;
  and standard renal-physiology texts, e.g. Boron & Boulpaep) is pre-MEDLINE/textbook.

**Neonatal GFR reference values (baseline validation, Table 6)** *(verified via PubMed 2026-07-16)*
- Allegaert K, Macente J, Mekahli D, van den Anker J, Annaert P, Smits A. Progression of the
  estimated glomerular filtration rate in asphyxiated neonates undergoing therapeutic hypothermia
  during the first 10 days of life. *Pediatr Nephrol.* 2025;41(1):233–8. **PMID 40968276.
  doi:10.1007/s00467-025-06957-1.** — pooled healthy-term eGFR: day 1 ≈ 20, day 2 ≈ 26, day 7 ≈ 42
  mL·min⁻¹·1.73 m⁻²; GFR matures 2–3× over the first week.
- Gordjani N, Burghard R, Leititis JU, Brandis M. Serum creatinine and creatinine clearance in
  healthy neonates and prematures during the first 10 days of life. *Eur J Pediatr.*
  1988;148(2):143–5. **PMID 3234436. doi:10.1007/BF00445923.** — classic term/preterm creatinine-
  clearance maturation curve.

**Renal autoregulation: myogenic response + tubuloglomerular feedback**
- Burke M, Pabbidi MR, Farley J, Roman RJ. Molecular mechanisms of renal blood flow
  autoregulation. *Curr Vasc Pharmacol.* 2014;12(6):845–58. **PMID 24066938.
  doi:10.2174/15701611113116660149.** — review of myogenic + TGF control of GFR.
- (Optional companion) Zehra T, Cupples WA, Braam B. Tubuloglomerular feedback synchronization
  in nephrovascular networks. *J Am Soc Nephrol.* 2021;32(6):1293–1304. **PMID 33833078.
  doi:10.1681/ASN.2020040423.**

**RAAS + ADH/vasopressin in body-fluid/volume regulation**
- Gilbert SJ. Sodium and water disorders. *Adv Kidney Dis Health.* 2025;32(1):41–49.
  **PMID 40175029. doi:10.1053/j.akdh.2024.09.002.** — baroreceptor→RAAS/sympathetic/vasopressin/
  ANP volume control and osmoreceptor→ADH water control.
- (Companion, mechanistic) Bie P, Wamberg S, Kjolby M. Volume natriuresis vs. pressure
  natriuresis. *Acta Physiol Scand.* 2004;181(4):495–503. **PMID 15283763.
  doi:10.1111/j.1365-201X.2004.01323.x.**

**Neonatal thermoregulation & non-shivering (brown-fat) thermogenesis**
- Lidell ME. Brown adipose tissue in human infants. *Handb Exp Pharmacol.* 2019;251:107–123.
  **PMID 29675580. doi:10.1007/164_2018_118.** — neonatal-specific BAT/NST and high surface-area
  heat loss.
- Tews D, Wabitsch M. Renaissance of brown adipose tissue. *Horm Res Paediatr.* 2011;75(4):231–9.
  **PMID 21372557. doi:10.1159/000324806.** — BAT as the key thermogenic tissue for NST.

**Body-surface-area allometry + Q10 metabolic coefficient**
- **[not in PubMed — historical]** Meeh K. Oberflächenmessungen des menschlichen Körpers.
  *Z Biol.* 1879;15:425–458. (Modern BSA law Du Bois D, Du Bois EF. *Arch Intern Med.*
  1916;17:863–871 is likewise pre-MEDLINE.) — cite as historical.
- **[not in PubMed — textbook]** Q10 coefficient — see Paper 2 metabolism note (van 't Hoff/
  Arrhenius; cite Schmidt-Nielsen).

**Neonatal glucose production rate + insulin/counter-regulation**
- Bier DM, Leake RD, Haymond MW, Arnold KJ, Gruenke LD, Sperling MA, Kipnis DM. Measurement of
  "true" glucose production rates in infancy and childhood with 6,6-dideuteroglucose. *Diabetes.*
  1977;26(11):1016–23. **PMID 913891. doi:10.2337/diab.26.11.1016.** — seminal source: term
  neonates 6.07 ± 0.27, preterm 5.46 ± 0.31 mg/kg/min.
- (Optional, insulin-suppressed production in IDMs) Sunehag A, Ewald U, Larsson A, Gustafsson J.
  Attenuated hepatic glucose production but unimpaired lipolysis in newborn infants of mothers
  with diabetes. *Pediatr Res.* 1997;42(4):492–7. **PMID 9380442.
  doi:10.1203/00006450-199710000-00012.**

**Sigmoid Emax model + effect-compartment (ke0)/biophase (pharmacology)**
- Sheiner LB, Stanski DR, Vozeh S, Miller RD, Ham J. Simultaneous modeling of pharmacokinetics
  and pharmacodynamics: application to d-tubocurarine. *Clin Pharmacol Ther.* 1979;25(3):358–71.
  **PMID 761446. doi:10.1002/cpt1979253358.** — canonical effect-compartment/ke0 + Hill equation.
- Holford NHG, Sheiner LB. Understanding the dose-effect relationship: clinical application of
  pharmacokinetic-pharmacodynamic models. *Clin Pharmacokinet.* 1981;6(6):429–53. **PMID 7032803.
  doi:10.2165/00003088-198106060-00002.** — canonical review of the sigmoid Emax model.

---

## Mechanical support devices (Paper 4 — `Ventilator.js`, `Ecls.js`)

**Endotracheal-tube resistance vs. diameter and flow (Rohrer-type)**
- Jarreau PH, Louis B, Dassieu G, Desfrere L, Blanchard PW, Moriette G, Isabey D, Harf A.
  Estimation of inspiratory pressure drop in neonatal and pediatric endotracheal tubes.
  *J Appl Physiol (1985).* 1999;87(1):36–46. **PMID 10409556. doi:10.1152/jappl.1999.87.1.36.**
  — measured pressure–flow (laminar Ito / turbulent Blasius) for 2.5–7.0 mm ETTs; neonatal-specific.
- Spaeth J, Steinmann D, Kaltofen H, Guttmann J, Schumann S. The pressure drop across the
  endotracheal tube in mechanically ventilated pediatric patients. *Paediatr Anaesth.*
  2015;25(4):413–20. **PMID 25491944. doi:10.1111/pan.12595.** — nonlinear flow-dependent ΔP
  fitted with the Rohrer approximation.

**Neonatal ventilator modes (PC/PRVC/PS/CPAP, flow-cycling, volume-targeted)**
- Keszler M. Volume-targeted ventilation. *J Perinatol.* 2005;25 Suppl 2:S19–22. **PMID 15861164.
  doi:10.1038/sj.jp.7211313.** — pressure-limited vs volume-targeted neonatal modes.
- Schulzke SM, Stoecklin B. Update on ventilatory management of extremely preterm infants—a
  Neonatal Intensive Care Unit perspective. *Paediatr Anaesth.* 2021;32(2):363–371.
  **PMID 34878697. doi:10.1111/pan.14369.** — broader neonatal ventilation-mode review.

**Neonatal/pediatric ECMO circuit & oxygenator**
- Butt W, Heard M, Peek GJ. Clinical management of the extracorporeal membrane oxygenation
  circuit. *Pediatr Crit Care Med.* 2013;14(5 Suppl 1):S13–9. **PMID 23735980.
  doi:10.1097/PCC.0b013e318292ddc8.** — canonical circuit/oxygenator management (PCICS/ELSO).
- (Neonatal-specific companion) Cortesi V, Raffaeli G, Amelio GS, et al. Hemostasis in neonatal
  ECMO. *Front Pediatr.* 2022;10:988681. **PMID 36090551. doi:10.3389/fped.2022.988681.** —
  blood–circuit interaction in neonatal ECMO.

**Neonatal ECMO target flow (baseline validation, devices Table 2a)** *(verified via PubMed 2026-07-16)*
- Wild KT, Rintoul N, Kattan J, Gray B. Extracorporeal Life Support Organization (ELSO):
  Guidelines for Neonatal Respiratory Failure. *ASAIO J.* 2020;66(5):463–70. **PMID 32282347.
  doi:10.1097/MAT.0000000000001153.** — the ELSO neonatal respiratory guideline (target circuit
  flow ~100–150 mL·kg⁻¹·min⁻¹).
- Fletcher K, Chapman R, Keene S. An overview of medical ECMO for neonates. *Semin Perinatol.*
  2018;42(2):68–79. **PMID 29336834. doi:10.1053/j.semperi.2017.12.002.** — neonatal ECMO
  patient-management overview.

---

## Sensitivity analysis & identifiability (Paper 6 — `scripts/sa/`, §2.6/§3.3 + Supplement)

*Methods refs for the sensitivity-analysis validation of the one-lever calibration design. All are canonical methods sources except Messmore 2026 (the neonatal precedent — verify DOI/PMID at assembly).*

- **Morris MD.** Factorial sampling plans for preliminary computational experiments. *Technometrics* 1991;33:161–174. — elementary-effects screening (Tier 1).
- **Campolongo F, Cariboni J, Saltelli A.** An effective screening design for sensitivity analysis of large models. *Environ Model Softw* 2007;22:1509–1518. — Morris design refinement.
- **Sobol′ IM.** Global sensitivity indices for nonlinear mathematical models and their Monte Carlo estimates. *Math Comput Simul* 2001;55:271–280. — variance-based indices (Tier 2).
- **Saltelli A, et al.** *Global Sensitivity Analysis: The Primer.* Wiley, 2008; and Variance based sensitivity analysis of model output. *Comput Phys Commun* 2010;181:259–270. — Saltelli sampling.
- **Jansen MJW.** Analysis of variance designs for model output. *Comput Phys Commun* 1999;117:35–43. — the first/total-order estimators used.
- **Marino S, Hogue IB, Ray CJ, Kirschner DE.** A methodology for performing global uncertainty and sensitivity analysis in systems biology. *J Theor Biol* 2008;254:178–196. — SA-for-biological-models expectation; PRCC.
- **Raue A, et al.** Structural and practical identifiability analysis of partially observed dynamical models by exploiting the profile likelihood. *Bioinformatics* 2009;25:1923–1929. — identifiability.
- **Gutenkunst RN, et al.** Universally sloppy parameter sensitivities in systems biology models. *PLoS Comput Biol* 2007;3:e189. — "sloppiness."
- **Transtrum MK, et al.** Perspective: Sloppiness and emergent theories in physics, biology, and beyond. *J Chem Phys* 2015;143:010901. — "sloppiness" perspective.
- **Eck VG, et al.** A guide to uncertainty quantification and sensitivity analysis for cardiovascular applications. *Int J Numer Method Biomed Eng* 2016;32:e02755. — SA guide for cardiovascular models.
- **Messmore M, DeCampli W, Kassab A.** Computational model for predicting optimal clinical intervention in pre-operative neonates with transposition of the great arteries. *Cardiovasc Eng Technol* 2026. doi:10.1007/s13239-026-00839-9. — **neonatal LPM SA precedent**; independently finds SpO₂ most sensitive to SVR and PDA diameter (corroborates the operating-point oxygenation finding). *(Verify final citation/PMID at assembly.)*

---

## Notes

- **Single-source vs pick-one topics.** For most Paper 3/4 topics two sources are listed
  (a seminal primary + a neonatal/review companion) so each paper can pick per journal style;
  genuinely single-source topics are Monro–Kellie (Mokri) and the Starling micropuncture
  (Maddox/Brenner). Trim to one per topic at manuscript assembly to respect PR's reference economy.
- **Pre-MEDLINE / textbook items** (Hill 1910, Fick 1855, Meeh 1879 / Du Bois 1916, Q10/van 't Hoff,
  the Starling principle) will not resolve in PubMed — cite them as historical primary sources or
  named textbooks, not as [VERIFY] failures.
- Prefer sources the engine source-file header comments already name; the header comments of
  `Brain.js`, `Mob.js`, `Thermoregulation.js`, `Surfactant.js`, `Pda.js`,
  `chd_duct_fo_dependent.md` are the closest thing to an existing bibliography (the last has
  ~48 references) — mine these first before external search.
- When a constant in the code differs from the textbook value (e.g. base-excess offset 25.1
  vs. 24.4; P50 baselines HbF 18.8 / neonatal 20.0 / adult 26.7), state the engine value and
  cite the source it was adapted from — do not silently "correct" it.
