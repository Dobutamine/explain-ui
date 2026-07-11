# Sensitivity analysis and the justification of one-lever-per-target calibration

*(New methods + results section for Chapter 6 — AI parameterization. Fulfils the cardiovascular paper's §4.5 promise of "a systematic sensitivity analysis" and supplies the formal evidence base for the one-lever-per-target calibration scheme on which the AI parameterization pipeline rests.)*

## 6.X.1 Rationale

The AI parameterization pipeline (§6.2–6.4) rests on a strong, and until now *assumed*, structural hypothesis: that for each measured clinical target — mean arterial pressure, cardiac output, arterial oxygen saturation, and so on — there exists **one dominant, monotone, near-orthogonal model parameter** ("lever") that can be adjusted to move that target to its measured value with minimal disturbance of the others. This hypothesis is what makes closed-loop calibration tractable: each controller in `Calibrator.js` owns one lever and one target, and the controllers are run essentially independently. If the hypothesis is false — if targets are governed by strongly interacting parameter *combinations* rather than by individual parameters — then per-target calibration would be ill-posed, and the fitted parameters would be, in the language of systems biology, "sloppy": individually unconstrained by the data even when the model output is well constrained [Gutenkunst 2007; Transtrum 2015].

A sensitivity analysis (SA) is the instrument that either **justifies or falsifies** this scheme. It is also, independently, a standard expectation for any published multiparameter physiological model [Eck 2016; Marino 2008], and a directly comparable neonatal precedent exists: a lumped-parameter model of transposition of the great arteries whose finite-difference SA found systemic oxygen saturation to be governed chiefly by systemic and pulmonary vascular resistance and ductal diameter [Messmore 2026] — a result the present analysis independently reproduces (§6.X.4). Explain is a lumped-parameter (0D), nonlinear, closed-loop cardiorespiratory model of order ~68 top-level submodels and several hundred numeric parameters, evaluated by an expensive steady-state simulation. This makes a naive full-factorial SA infeasible and forces a **tiered, screen-then-quantify** strategy with parallel evaluation.

## 6.X.2 Methods

### The evaluation map

The SA treats one steady-state simulation as a deterministic map **y = g(θ)** from a parameter vector θ to a vector of clinical outputs y. Each evaluation builds a fresh model instance from the scenario definition, applies the parameter perturbation, integrates to steady state (60 s of simulated time), and averages the resulting waveforms over a 12 s window. The output vector comprises 17 routinely-measured quantities: heart rate, systolic/diastolic/mean arterial pressure, central venous pressure, mean pulmonary artery pressure, cardiac output, pre- and post-ductal SpO₂, mixed-venous saturation, PaO₂, PaCO₂, pH, base excess, end-tidal CO₂, and ductal and atrial (foramen ovale) shunt flow. Evaluations that fail to converge to a finite steady state are dropped. The map is deterministic: repeated evaluation of the same θ reproduces y to machine precision (verified; maximum inter-run difference 0), which is a precondition for finite-difference and variance-based estimators.

### Parameter space = calibration-lever space

The SA input space deliberately **mirrors the calibration-lever space**. Each SA parameter is one physiologically-interpretable knob perturbed through the exact non-destructive mechanisms the calibrator uses — engine scale-groups for systemic and pulmonary vascular resistance and body size, the persistent factor layer (`*_factor_ps`) for contractility, diastolic stiffness and gas-diffusing capacity, and direct setpoints for heart-rate reference, ventilatory drive, unmeasured-anion load, ductal/foramen geometry and venous unstressed volume. Sampling bounds reuse the validated `[lo, hi]` clamps from the calibrator. Two nested sets are used: a **reduced set** of 11 levers (one designated controller per clinical target) for quantitative work, and an **expanded set** (≈25 levers) adding per-compartment resistances and elastances, autonomic reflex gains, metabolic parameters, haemoglobin and additional shunt geometry, for screening and interaction analysis. Scale-type parameters (resistances, elastances, diffusing capacities) are sampled log-uniformly; bounded-geometry and setpoint parameters uniformly. This mirroring is what makes the SA a direct test of the calibration scheme: the designated controller for each target is the specific parameter the SA is asked to confirm or refute as that target's dominant, orthogonal lever.

### The staged campaign

The analysis proceeds in four tiers, each written as a pure-JavaScript, in-repo tool driving the existing headless engine harness; no external SA library or Python dependency is used, and the entire campaign is reproducible from a fixed random seed. Evaluations are sharded across forked worker processes (the engine is a per-process singleton, so parallelism is achieved by running separate Node processes), giving ≈2 s of wall-clock per evaluation on a workstation.

1. **Tier 0 — local one-at-a-time (OAT) elasticities.** A signed, dimensionless local sensitivity of every output to every lever, by central difference at the operating point. Cheap (2k+1 evaluations); gives the local dominance pattern and, assembled into a normalized sensitivity matrix S, the local Fisher information matrix (FIM = SᵀS) whose eigenvalue spectrum and condition number characterize identifiability.

2. **Tier 1 — Morris elementary-effects screening.** A global screening design over the expanded set (Morris trajectories, 8 levels, r ≈ 20 trajectories) yielding, per output, each parameter's mean absolute elementary effect μ\* (overall influence) and standard deviation σ (a flag for nonlinearity and interaction). Used to confirm that low-influence parameters can be fixed and to identify which levers carry interaction.

3. **Tier 2 — variance-based Sobol′ indices.** On the reduced set, a Saltelli cross-sample (N = 256–512 base rows) with the Jansen estimators gives, per output, each lever's first-order index Sᵢ (the fraction of output variance explained by that lever alone) and total index S_Tᵢ (including all its interactions), with bootstrap 95 % confidence intervals. This is the quantitative core of the one-lever test.

4. **Tier 3 — PRCC and identifiability.** Partial rank correlation coefficients (Latin-hypercube sample, N ≈ 768) provide a monotonicity-aware, signed cross-check of the Sobol ranking. The FIM analysis is extended with a column-pivoted-QR ordering of the levers (most- to least-identifiable given orthogonality to those already selected), the eigenvalue spectrum ("stiff" vs "sloppy" directions), and the pairwise lever correlations from the global sample.

### The three-part one-lever test

For each target, the designated lever is subjected to three tests:

- **Dominance** — is the designated lever's first-order Sobol index Sᵢ the largest among all levers for that target?
- **Interaction-freeness** — is Sᵢ ≈ S_Tᵢ (small interaction budget S_Tᵢ − Sᵢ), and is the elasticity sign consistent with the calibrator's assumed direction?
- **Orthogonality / identifiability** — does the designated lever appear as an early, well-conditioned pick in the column-pivoted-QR selection, i.e. is it identifiable and decoupled from the other levers?

A target passes the one-lever hypothesis only if its designated lever satisfies all three. Targets that fail are reported honestly, together with the parameter or combination that actually governs them at that operating point.

### Operating points

Because the sensitivity structure of a nonlinear closed-loop model is *itself* a function of the operating point — a fact of physiological, not merely numerical, interest — the campaign is run at the calibrated **term-neonate baseline** and at two representative disease states with contrasting pathophysiology: **persistent pulmonary hypertension of the newborn (PPHN)**, a pure shunt/high-resistance lesion with structurally normal heart and lungs, and **severe congenital diaphragmatic hernia (CDH)**, a parenchymal/pulmonary-hypoplasia lesion. A duct- and foramen-dependent mixing lesion (d-transposition of the great arteries) is examined at Tier 0 as an illustrative case, with the caveat that under transposed great arteries the systemic cardiac-output output is not well-defined by the standard measurement and is excluded there. Two preterm respiratory-distress operating points (`preterm_28wk`, `bischoff_cohort`) are additionally screened at Tier 0 specifically to test whether alveolar diffusing capacity ever becomes the dominant SpO₂ lever in a parenchymal-lung context.

## 6.X.3 Results

### Determinism and sign validation

The evaluation map is exactly deterministic, and every reduced-set lever moves its designated output in the direction the calibrator assumes (9/9 signs at the term baseline: MAP rises with systemic resistance, PaCO₂ falls with ventilatory drive, base excess falls with unmeasured-anion load, and so on). The pure-JavaScript Morris, Sobol′ and PRCC estimators were validated against the Ishigami function, whose Sobol indices are known in closed form: the first- and total-order estimates agreed with the analytic values to within 0.011, and Morris and PRCC recovered the correct influence structure and signs. The estimators are therefore trustworthy on the engine.

### Local sensitivity and operating-point dependence *(OAT, Tier 0)*

The central finding of the local analysis is that **the one-lever pattern holds well at the healthy baseline but is strongly operating-point-dependent**, and that the departures are physiologically meaningful rather than numerical artefacts.

At the **term-neonate baseline**, the designated lever is the top local influence for the majority of hemodynamic and acid–base targets — mean and systolic/diastolic pressure (systemic resistance), mean pulmonary pressure (pulmonary resistance), central venous pressure (venous unstressed volume), PaCO₂ and end-tidal CO₂ (ventilatory drive), base excess and pH (unmeasured anions), and both shunt flows (their respective diameters). Three informative exceptions appear even here:

- **Cardiac output** is most strongly moved, over the plausible range, by **body size (weight)** rather than by contractility; contractility's effect is genuine but damped, because the baroreflex defends arterial pressure and thereby buffers the cardiac-output response to a contractility change. This is a real closed-loop coupling, not a failure of the model.
- **Heart rate** is strongly influenced by systemic resistance (through the baroreflex) as well as by its own reference lever — again a signature of the intact reflex loop.
- **Oxygenation (SpO₂, PaO₂)** is *insensitive* to gas-diffusing capacity at the healthy baseline, because a term neonate breathing adequately sits on the flat upper part of the oxyhaemoglobin dissociation curve: with SpO₂ already ≈97 %, increasing diffusing capacity cannot raise it. The designated oxygenation lever is therefore latent — it has little to act on — until oxygenation is impaired.

This last point is confirmed and sharpened at the disease operating points. In **PPHN**, where hypoxaemia is driven by right-to-left shunting through a high-resistance pulmonary bed, SpO₂ becomes dominated by **pulmonary vascular resistance**, not by diffusing capacity — because the lesion is a shunt, not a diffusion barrier. The implication for calibration is important: *the correct oxygenation lever depends on the mechanism of hypoxaemia*, and a single fixed lever-to-target map is inadequate across phenotypes. The one-lever dominance count falls from the baseline majority to roughly half of targets in PPHN, with the "lost" targets taken over by mechanistically appropriate parameters. The local FIM condition number is finite and modest once the boundary-inactive shunt levers (the ductus and foramen, which are closed at the healthy term baseline and therefore locally unidentifiable there) are excluded — these are correctly assessed only at the operating points where the shunts are open.

### The one-lever validation matrix *(Sobol′ + PRCC, Tiers 2–3, term-neonate baseline)*

The variance-based analysis (Saltelli sample, N = 512 base rows, 6 656 evaluations; Jansen estimators; all rows converged) quantifies the one-lever hypothesis at the baseline. Table 6.X reports, for each target, the designated lever's first-order Sobol index Sᵢ (variance it explains alone), its total index S_Tᵢ (including interactions), the parameter that in fact carries the largest Sᵢ, and the designated lever's partial rank correlation (PRCC).

| Target | Designated lever | Sᵢ | S_Tᵢ | Largest Sᵢ (parameter) | PRCC | Reading |
|---|---|---|---|---|---|---|
| Mean arterial pressure | systemic resistance | 0.31 | 0.40 | 0.41 (weight) | **0.89** | pass (calibration metric) |
| Mean pulmonary pressure | pulmonary resistance | **0.51** | 0.59 | 0.51 (pulmonary resistance) | **0.91** | **clean one-lever** |
| Heart rate | HR reference | **0.97** | 1.00 | 0.97 (HR reference) | **0.84** | **clean one-lever** |
| Central venous pressure | venous unstressed vol. | 0.31 | 0.53 | 0.31 (venous unstressed vol.) | **−0.80** | dominant, interacting |
| Base excess | unmeasured anions | **0.79** | 0.88 | 0.79 (unmeasured anions) | 0.11 | dominant, interacting |
| pH | unmeasured anions | **0.67** | 0.83 | 0.67 (unmeasured anions) | 0.17 | dominant, interacting |
| Cardiac output | contractility | 0.07 | 0.07 | 0.55 (weight) | 0.48 | size-dominated |
| PaCO₂ | ventilatory drive | 0.03 | 0.07 | 0.32 (unmeasured anions) | −0.12 | coupled to acid–base |
| SpO₂ | O₂ diffusing capacity | 0.00 | 0.01 | 0.56 (unmeasured anions) | 0.17 | **diffusion inert** |
| PaO₂ | O₂ diffusing capacity | 0.02 | 0.04 | 0.65 (unmeasured anions) | 0.20 | **diffusion inert** |

*(Ductal and foramen flows are boundary-degenerate at the term baseline — both shunts are near-closed, so their flow variance is dominated by the resistances that set the tiny residual flow; they are quantified at the shunt-open operating points, deferred.)*

Three readings follow, and they matter for how the calibration scheme should be used.

**A measured input is not a calibration lever.** Body size (weight) carries the largest first-order index for mean arterial pressure (0.41), cardiac output (0.55) and, jointly, central venous pressure (0.29) — simply because it was sampled across the whole 0.6–4 kg preterm-to-term range, and allometric scaling makes absolute pressures and flows track size. That size dominates absolute-magnitude variance is expected, and is itself a validity check that the allometric scaling behaves. But in calibration weight is *set from the patient's known birth weight*, not tuned to hit a pressure; the calibration-relevant question is conditional on size. The **PRCC**, which partials out every other lever including weight, answers exactly that question — and there the designated pressure levers are strongly and correctly-signed: mean arterial pressure ← systemic resistance (0.89), mean pulmonary pressure ← pulmonary resistance (0.91), heart rate ← HR reference (0.84), central venous pressure ← venous unstressed volume (−0.80). For the four pressure/rate targets the one-lever scheme is well-posed once size is fixed.

**Two targets are dominant-but-coupled.** Base excess and pH are governed by the unmeasured-anion lever in the variance sense (Sᵢ 0.79 and 0.67, both the largest), so the calibrator points at the right knob; but their large interaction budgets (S_Tᵢ − Sᵢ ≈ 0.09 and 0.16) and low PRCC show the acid–base outputs are *coupled*, not orthogonally controlled — a direct and expected consequence of the Stewart formulation, in which strong-ion difference, CO₂ and lactate jointly set pH. PaCO₂ is the sharpest case of this coupling: its designated ventilatory-drive lever explains almost no variance (Sᵢ 0.03), while the unmeasured-anion lever explains the most (0.32, with a large total 0.75), because a metabolic acid load recruits the chemoreflex and moves PaCO₂ more than an imposed drive change does once that same reflex loop is buffering the drive. The acid–base and ventilation targets are therefore identifiable only as a coupled block, not as independent one-lever controllers.

**Two failures are unambiguous and physiological.** Cardiac output is not a one-lever target: with size free it is size-dominated, and even conditionally (PRCC 0.48) contractility is only a moderate lever because the baroreflex defends arterial pressure and buffers the flow response. And oxygenation is the starkest result of the whole analysis: at the saturated term baseline the O₂-diffusing-capacity lever explains **essentially zero** SpO₂ and PaO₂ variance (Sᵢ 0.00 and 0.02; PRCC 0.17 and 0.20) — it is inert because the patient sits on the flat top of the dissociation curve — while the largest oxygenation variance is carried, indirectly, by the unmeasured-anion lever through the acid–base→dissociation-curve coupling. Combined with the disease-state result that oxygenation is shunt- and resistance-governed wherever the patient *is* hypoxaemic, this confirms that the designated diffusing-capacity lever for SpO₂ has traction at essentially no operating point tested.

**Identifiability.** The local Fisher-information matrix (from the OAT sensitivity matrix, boundary-inactive shunt levers excluded) is modestly conditioned (condition number ≈ 3.6 × 10³), and the column-pivoted-QR ordering ranks the levers unmeasured anions > systemic resistance > weight > pulmonary resistance > HR reference > venous unstressed volume > ventilatory drive > contractility > O₂ diffusing capacity. The diffusing-capacity lever is selected **last** — the least-identifiable direction — in exact agreement with its near-zero oxygenation influence. The Morris screening over the expanded (≈25-lever) set is consistent with this ranking and flags the reflex-gain and shunt levers as the high-interaction (high-σ) parameters.

*(These are the completed term-neonate results. The identical Sobol′/PRCC/Morris tiers at the PPHN and severe-CDH operating points are deferred; their Tier-0 OAT screens, already in `scripts/sa/results/`, indicate the shifts summarized above and in §6.X.4.)*

## 6.X.4 Interpretation and consequences for calibration

The SA supports a **nuanced, and more honest, version of the one-lever claim** than a blanket assertion would allow. At a well-oxygenated, hemodynamically normal operating point most clinical targets do have a dominant, correctly-signed designated lever, and the calibration scheme is well-posed there. But two structural facts qualify this and should shape how the AI parameterization pipeline is used:

1. **Closed-loop coupling** (chiefly the baroreflex) means that pressure, heart-rate and cardiac-output sensitivities are not cleanly separable; calibrating them in the right order, or jointly, matters, and the "orthogonality" of these levers is approximate.
2. **Operating-point dependence** means the lever that dominates a target can change with the disease phenotype — most sharply for oxygenation, and here the SA delivers a pointed, actionable critique of one specific calibrator choice. At the healthy term baseline SpO₂ is saturated (≈97 %, on the flat upper oxyhaemoglobin plateau) and has no effective lever. Across every hypoxaemic operating point examined — PPHN, severe CDH, d-TGA, and preterm RDS — oxygenation is governed by **pulmonary vascular resistance and shunt geometry, not by alveolar diffusing capacity**, because the modelled desaturation is predominantly shunt- and V̇/Q̇-mediated rather than diffusion-limited. Gas-diffusing capacity is the calibrator's *designated* SpO₂ lever, yet its local influence on SpO₂ is negligible at all of these operating points. The practical recommendation that follows is concrete: the SpO₂ controller should be re-based on the resistance/shunt levers that actually set oxygenation in shunt-dominated phenotypes, or made phenotype-aware, rather than relying on a diffusing-capacity lever that has little traction wherever the patient is either well saturated or shunt-limited. A phenotype-aware lever map, not a single global one, is the correct design.

This oxygenation finding is independently corroborated by the neonatal literature: a lumped-parameter model of transposition of the great arteries found systemic arterial oxygen saturation to be most sensitive to systemic vascular resistance and patent-ductus diameter (each the single most sensitive parameter in roughly a third of cases), with lower pulmonary vascular resistance raising saturation in nearly all cases, and — as in our results — atrial-septal (foramen) enlargement *not* always the most sensitive lever [Messmore 2026]. That an independent group, a different model and a different numerical method reach the same structural conclusion strengthens confidence that this is a property of the physiology, not of Explain's particular implementation.

These are exactly the caveats the "sloppiness" literature would predict for a stiff, nonlinear, closed-loop physiological model, and reporting them — rather than asserting a clean one-parameter-per-measurement identifiability — is what makes the calibration methodology defensible. A short version of this identifiability characterization is carried into the General Discussion.

## References (to consolidate into thesis bibliography)

- Morris MD. Factorial sampling plans for preliminary computational experiments. *Technometrics* 1991;33:161–174.
- Campolongo F, Cariboni J, Saltelli A. An effective screening design for sensitivity analysis of large models. *Environ Model Softw* 2007;22:1509–1518.
- Sobol′ IM. Global sensitivity indices for nonlinear mathematical models and their Monte Carlo estimates. *Math Comput Simul* 2001;55:271–280.
- Saltelli A, et al. *Global Sensitivity Analysis: The Primer.* Wiley, 2008; and Saltelli A, et al. Variance based sensitivity analysis of model output. *Comput Phys Commun* 2010;181:259–270.
- Jansen MJW. Analysis of variance designs for model output. *Comput Phys Commun* 1999;117:35–43.
- Marino S, Hogue IB, Ray CJ, Kirschner DE. A methodology for performing global uncertainty and sensitivity analysis in systems biology. *J Theor Biol* 2008;254:178–196.
- Raue A, et al. Structural and practical identifiability analysis of partially observed dynamical models by exploiting the profile likelihood. *Bioinformatics* 2009;25:1923–1929.
- Gutenkunst RN, et al. Universally sloppy parameter sensitivities in systems biology models. *PLoS Comput Biol* 2007;3:e189.
- Transtrum MK, et al. Perspective: Sloppiness and emergent theories in physics, biology, and beyond. *J Chem Phys* 2015;143:010901.
- Eck VG, et al. A guide to uncertainty quantification and sensitivity analysis for cardiovascular applications. *Int J Numer Method Biomed Eng* 2016;32:e02755.
- Messmore M, DeCampli W, Kassab A. Computational model for predicting optimal clinical intervention in pre-operative neonates with transposition of the great arteries. *Cardiovasc Eng Technol* 2026. doi:10.1007/s13239-026-00839-9. *(Neonatal LPM sensitivity-analysis precedent; SpO₂ most sensitive to SVR and PDA diameter.)*
