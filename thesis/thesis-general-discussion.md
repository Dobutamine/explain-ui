# General Discussion

*Closing connective chapter of the compilation thesis. It synthesizes the contribution across the
chapters, reflects on the model's originality, validity, and reproducibility, sets out its limitations
and future perspectives, and closes with the clinical and educational implications. It extends, to the
level of the whole thesis, the discussion of the cardiovascular paper (Chapter 2, §4.1–4.5). Citation
numbering is local to this chapter; entries confirmed against the cardiovascular paper's bibliography
are given in full, and those still to be confirmed are marked **[VERIFY]**.*

---

## Synthesis

This thesis set out to present EXPLAIN — an integrated, mechanistic, real-time model of neonatal and
perinatal physiology — completely enough to be understood, reproduced, and trusted, and to do so in a
deliberate order: purpose and building blocks, the way those blocks integrate, the method by which the
model is parameterized for an individual patient, and validation across a range of patients.

The chapters deliver that arc. Chapter 2 develops the cardiovascular core — a pulsatile,
lumped-parameter heart and vascular model with neonatal shunts and an autonomic controller built on an
explicit sympatho-vagal balance. Chapters 3 and 4 extend the model to the respiratory system, gas
exchange and acid–base chemistry, metabolism, and the slower cerebral, renal, endocrine, thermal,
glucose, and pharmacological controllers. Chapter 5 adds the mechanical support and measurement layer:
ventilator, extracorporeal life support, resuscitation, and the bedside monitor. These subsystems do
not merely coexist; they compose into a single virtual patient through the four integration mechanisms
introduced in Chapter 1 — a factor/effective-value substrate that lets scenario, intervention,
allometric scaling, and calibration act on the same parameter without overwriting one another;
advective composition transport that carries gases, solutes, drugs, and heat with the flow; a shared
clock; and a deterministic step loop.

The methodological heart of the thesis is Chapter 6. A whole-body neonatal model of this kind exposes
several hundred interpretable parameters but is constrained by only a handful of measured clinical
quantities, so fitting it to a patient is a severely underdetermined inverse problem that has
traditionally required slow, irreproducible expert hand-tuning. EXPLAIN resolves this with a two-layer
pipeline: a language-model interpretation layer that reads the clinical description and emits a
validated, bounded specification, and a deterministic calibration layer that assigns one
physiologically interpretable lever to each measured target and drives it home with a per-target
secant root-finder, run in a relaxation loop that respects the model's own active control loops. The
breadth of the validated library in Chapter 7 — 34 virtual patients spanning the normal fetus and
neonate, the preterm continuum, congenital diaphragmatic hernia, persistent pulmonary hypertension, and
the family of duct- and foramen-ovale-dependent congenital heart disease — is itself the strongest
evidence for the generality of that method: every one of those patients is instantiated by the same
interpretation-plus-calibration pipeline, differing only in structural specification and target values.

## Model originality

EXPLAIN's originality is best seen as a stack of contributions, each building on the last. The
well-validated Beneken lumped-parameter cardiovascular model [12] was expanded with the specific tissue
groups and neonatal shunts (ductus arteriosus, foramen ovale, ventricular septal defect,
intrapulmonary shunt, split left/right lungs, separated intra- and extra-thoracic venous compartments)
needed to represent the neonatal conditions of interest, with non-linear resistance and capacitance
characteristics. The autonomic controller expands the van Meurs baroreflex model [10] by introducing an
explicit variable for the sympatho-vagal balance, yielding a compact controller with high explanatory
value, and a simple mechanistic model of the ductal Doppler flow pattern was added. To these — developed
in the companion chapters — the thesis adds the acid–base and blood-gas solver [11], the respiratory and
metabolic subsystems, the slower regulatory controllers, and the device layer.

Two contributions are, to our knowledge, genuinely novel at the level of the field. The first is the
**AI-assisted parameterization method** (Chapter 6): the separation of interpretation from numerical
fitting, the one-lever-per-target reduction of an ill-posed inverse problem to a set of well-posed
one-dimensional root-finds chosen to act *with* the model's regulation, and the use of a large language
model strictly as a bounded interpretation layer that never touches the model's equations or state.
The second is the **breadth and reproducibility of the validated virtual-patient library** itself
(Chapter 7), including a structurally clean, dedicated persistent-pulmonary-hypertension patient and a
systematically built family of duct- and foramen-ovale-dependent congenital heart lesions mapped
lesion-by-lesion to engine levers.

## Model validity

Validation throughout the thesis consists of comparing simulation results to target data from the
literature, and reporting what the engine produces rather than what was hoped for. Baseline term
hemodynamics show close quantitative agreement with published normative ranges [17–20], and the
preterm series reproduces the expected monotone gestational trends in blood pressure, oxygenation, and
acid–base state; the Bischoff cohort is matched to its published cardiac-output and blood-gas targets
[21]. The disease patients reproduce their defining literature signatures: the full ductal Doppler
spectrum from restrictive left-to-right to bidirectional to right-to-left across a single mechanistic
shunt element [21, 22], the direction and magnitude of the major hemodynamic shifts in pulmonary
hypertension [23], the pre- versus post-capillary split of congenital-diaphragmatic-hernia physiology,
the echocardiographic diagnostic criteria for persistent pulmonary hypertension, and the shunt
physiology and closure-driven decompensation of duct- and foramen-ovale-dependent congenital heart
disease.

The most telling evidence of validity is that clinically reported but often under-represented phenomena
emerge *naturally* from the model rather than being fitted into it: the paradoxical reduction in left
ventricular output in bidirectional patent ductus arteriosus, and the early-systolic flow reduction in
restrictive patent ductus arteriosus, both arise from the interaction of shunt dynamics, pulmonary
vascular tone, and autonomic control. This is the hallmark of a mechanistic model — one whose behaviour
is a consequence of its physics — as distinct from a statistical fit, and it is what gives EXPLAIN its
explanatory value: the underlying variables can be visualized and manipulated to explain *why* a
phenomenon occurs. The parameterization method reinforces validity by aligning the baroreflex set-point
to the target mean arterial pressure, so the model's control loops defend the calibrated operating point
rather than opposing it.

## Reproducibility

A core aim was a tool with which the authors and other investigators can reproduce the conditions used
in validation and simulate further conditions of educational and research value, and the thesis is built
so that this holds at every level. The underlying models have clear anatomical and physiological
interpretations, which both aids explanation and facilitates modification and expansion by other
researchers. Every quantitative claim in the validation chapter is regenerated by re-running a named
probe script against a scenario definition; the structural provenance and literature targets of each
virtual patient are recorded in its builder header and, for the congenital-heart-disease family, in the
accompanying clinical monograph; and the entire library is rebuildable through the documented
build → reseed → probe workflow. The engine source code, the scenario definitions, and the interactive
application are made available, and the framework-agnostic engine runs the model in real time in an
ordinary web browser.

## Limitations

Several limitations bound the work, and are reported here rather than in the individual chapters so that
they can be weighed together.

- **Lumped-parameter idealization.** The model represents the circulation and respiratory system as
  networks of discrete compartments. Shunt diameter–resistance relationships assume idealized
  laminar/turbulent transitions, and geometric variability (ductal length, septal shape, chamber
  geometry) is simplified.
- **Sparse validation data.** Quantitative neonatal hemodynamic data — particularly invasive
  measurements in pulmonary-hypertension and congenital-heart-disease patients — remain sparse and
  heterogeneous, so some validation necessarily relies on representative clinical ranges, Doppler
  morphology, and expert consensus rather than large individual-patient datasets.
- **Structural limits of the engine.** The chamber set is fixed at build time, so lesions requiring new
  structures cannot be represented exactly: there is no separately atrialized right ventricle (severe
  Ebstein anomaly), no major-aortopulmonary-collateral model, no aortic override, and alveolar oedema is
  not a separate compartment. These are documented, and the affected lesions are scoped accordingly.
- **Residual calibration gaps, reported honestly.** Some validated values sit at the edge of their
  literature targets — for example the fetal combined ventricular output is modestly below the classic
  reference and the fetal right-to-left ventricular output split is closer to unity than the reported
  fetal ratio. These are noted as targets for refinement rather than adjusted away.
- **Literature, not prospective, validation.** The model is validated against published data and
  physiological reasoning — establishing face and construct validity — but has not yet been validated
  prospectively against individual patients at the bedside.
- **The interpretation layer.** The language-model layer interprets rather than fits, and its output is
  constrained to an allowlist and checked against the same schema, unit conversions, and physiological
  bounds as the interactive editor; nonetheless, interpretation of messy or ambiguous clinical input has
  its own failure modes, and coupled or physiologically infeasible target sets are not guaranteed to
  converge (Chapter 6).

Despite these constraints, the model's simulation results match published data across a broad range of
conditions, and its interpretable structure provides a sound basis for systematic refinement.

## Future perspectives

The most important next step is **prospective clinical validation**: fitting the model to individual
patients from bedside data and comparing its predictions to their measured course, moving EXPLAIN from
literature-anchored validity toward a validated bedside tool. A robust parameter-estimation strategy —
the challenge that motivated Chapter 6 — will be strengthened by a systematic sensitivity analysis that
formalizes the observable-to-controllable pairings the calibrator relies on.

Several extensions follow naturally. The coupled cardiorespiratory framework can be applied to study the
physiological effects of ventilation strategies and pulmonary vasodilators and the mechanisms
underlying transitional failure. The disease library can be broadened where the engine allows, and, where
it does not, targeted engine extensions (an atrialized-right-ventricle chamber, a collateral-vessel
model, an aortic-override representation) would close the documented gaps. The model's fetal and
placental machinery positions it for extension to **maternal–fetal and obstetric physiology**, a
direction deferred from this thesis but supported by existing uterine and placental components. Finally,
the parameterization method is not specific to EXPLAIN: the interpretation-plus-calibration architecture
could parameterize other mechanistic physiological models, and points toward individualized,
continuously updated "digital-twin" simulations.

## Clinical and educational implications

EXPLAIN is, first and last, an explanatory model — a real-time, interactive, animated visualization of
physiology intended to help clinicians with the demanding cognitive tasks of neonatal intensive care
[1]. Its value is that it makes mechanism visible and manipulable: a trainee can see *why* a saturation
is low or *how* a shunt reverses; a clinical team can test a hypothesis or rehearse the response to a
closing duct; a researcher can explore a mechanism or the effect of an intervention reversibly and
without risk. Because the model runs in real time in an ordinary browser and is freely available, and
because any patient can now be instantiated rapidly and reproducibly by the parameterization pipeline
rather than by slow hand-tuning, the barrier that has historically kept mechanistic models out of
teaching and bedside use is substantially lowered.

## Conclusion

This thesis presents the conceptual and mathematical foundations of EXPLAIN, an integrated mechanistic
model of neonatal and perinatal physiology; the way its building blocks compose into a single real-time
virtual patient; a novel AI-assisted method that turns the ill-posed problem of patient-specific
parameterization into a rapid, reproducible procedure; and validation of the model against literature
across a broad library of virtual patients. Simulation results match published target data in good
approximation, the emergent reproduction of clinically observed phenomena demonstrates genuine
explanatory power, and the model, its scenarios, and the interactive software are made available. EXPLAIN
provides a validated, extensible, and openly reproducible platform for explanation, education, and
research in neonatal intensive care.

---

## References (General Discussion)

*Local numbering; to be merged into the consolidated Vancouver bibliography at assembly. References [1],
[10]–[23] are given in full as confirmed in the cardiovascular paper (Chapter 2) bibliography. Entries
marked **[VERIFY]** await confirmation.*

1. van Meurs WWL, Antonius TAJ. Explanatory models in neonatal intensive care: a tutorial. *Adv Simul (Lond).* 2018;3:27.
10. van Meurs WL. *Modeling and Simulation in Biomedical Engineering: Applications in Cardiorespiratory Physiology.* McGraw-Hill; 2011.
11. Antonius TAJ, et al. A white-box model for real-time simulation of acid–base balance in blood plasma. *Adv Simul (Lond).* 2023;8(1):16.
12. Beneken JEW. *A mathematical approach to cardiovascular function: the uncontrolled human system.* Medisch Fysisch Instituut TNO, Utrecht; 1965.
16. Burkhoff D, Tyberg JV. Why does pulmonary venous pressure rise after onset of LV dysfunction: a theoretical analysis. *Am J Physiol.* 1993;265(5 Pt 2):H1819–28.
17. Jhaveri S, et al. Normative ranges of biventricular volumes and function in healthy term newborns. *J Cardiovasc Magn Reson.* 2023;25(1):26.
18. Groves AM, et al. Functional cardiac MRI in preterm and term newborns. *Arch Dis Child Fetal Neonatal Ed.* 2011;96(2):F86–91.
19. Kluckow MR, Evans NJ. Superior vena cava flow is a clinically valid measurement in the preterm newborn. *J Am Soc Echocardiogr.* 2014;27(7):794.
20. van Zadelhoff AC, et al. Age-dependent changes in arterial blood pressure in neonates during the first week of life: reference values and development of a model. *Br J Anaesth.* 2023;130(5):585–94.
21. Bischoff AR, et al. Assessment of superior vena cava flow and cardiac output in different patterns of patent ductus arteriosus shunt. *Echocardiography.* 2021;38(9):1524–33.
22. van Laere D, et al. Application of neonatologist-performed echocardiography in the assessment of a patent ductus arteriosus. *Pediatr Res.* 2018;84(Suppl 1):46–56.
23. Jones CB, Crossland DS. The interplay between pressure, flow, and resistance in neonatal pulmonary hypertension. *Semin Fetal Neonatal Med.* 2022;27(4):101371.
24. Two-layer AI-assisted parameterization of EXPLAIN (this thesis, Chapter 6): deterministic secant calibration (Burden RL, Faires JD. *Numerical Analysis.*) with a large-language-model interpretation layer (Anthropic Claude / Claude Agent SDK). **[VERIFY external citations]**
