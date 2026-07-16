# An integrated model for simulation of neonatal physiology — THE cardiovascular system

Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP

*Paper P1 of the EXPLAIN series (companions: respiratory and metabolism [P2]; cerebral
autoregulation [P3a]; homeostatic-regulation subsystems [P3b]; devices [P4]; integrated
flagship [P5]; AI-parameterization [P6]; congenital heart disease [P7]). Target journal:
Pediatric Research (Basic Science Article). Markdown working draft converted from the master
Word manuscript `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx`, with the AI-parameterization
compact-highlight (Box 1, Fig. 6, refs [24]–[26]) folded in. Equations are transcribed to the
series' Unicode-blockquote convention and are to be re-keyed as native Word (OMML) objects at
assembly; each equation block names the engine source file it is checked against. The verified
reference list (PubMed, 2026-07-16) is carried in `thesis/P1_references_verified.md`.*

---

## Abstract

*(Structured abstract — Pediatric Research Basic Science format.)*

**Background:** The physiology of critically ill neonates is complex and frequently only
partially understood, yet diagnostic reasoning, clinical decision-making and communication among members of the healthcare team often take place under time pressure. Explanatory models — interactive, animated visualizations of human physiology — hold promise to assist clinicians in these challenging cognitive tasks.

**Methods:** We describe the conceptual and mathematical underpinnings of an integrated model of neonatal physiology, focusing on the cardiovascular system. The core of the model, called
"EXPLAIN", is a pulsatile, lumped-parameter representation of the neonatal heart and vascular
system that accommodates multiple neonatal-specific features (e.g. foramen ovale and ductus
arteriosus). The model is instantiated for individual patients not by hand but by an AI-assisted,
closed-loop calibration pipeline in which a large language model interprets the available clinical
targets and a deterministic calibrator fits the model to within clinician-meaningful tolerances;
this pipeline generated the patient-specific configurations validated here.

**Results:** The model replicates both normal neonatal hemodynamics and pathological conditions
such as a patent ductus arteriosus and acute pulmonary hypertension, using published literature as target data. Simulation results show close agreement with measured values for hemodynamic quantities including cardiac output, blood pressures and ductal Doppler flow patterns across a range of shunt magnitudes.

**Conclusion:** An EXPLAIN user environment, running the model in real time, is freely available
online (<https://explain-modeling.com/>), and annotated source code is provided for researchers,
ensuring transparency and extensibility.

---

## 1. Introduction

Critically ill neonates exhibit complex and dynamically shifting physiology. Diagnostic reasoning
and communication among healthcare professionals occur under time pressure, often with only partial
information about the cardiorespiratory status. Explanatory models — visual, animated, interactive
representations of underlying physiology, combined with interventions and clinical monitors — can
help bridge these gaps [1]. A new explanatory model for NICU clinicians and researchers (EXPLAIN)
should allow for the investigation of the following scenarios:

- Apnea of prematurity
- Cardiogenic shock
- Congenital diaphragmatic hernia
- Infant respiratory distress syndrome
- Meconium aspiration syndrome
- Patent ductus arteriosus (PDA)*
- Acute pulmonary hypertension (aPH)*
- Septic shock
- Severe bradycardia and cardiac arrest
- Tension pneumothorax
- Hypoplastic left heart syndrome, with and without closing or restricting shunts

"Investigation" includes exploring physiological mechanisms and pathologies, assessing the impact
of therapeutic interventions, and facilitating case discussion and hypothesis testing. EXPLAIN
requires an integrated mathematical model of neonatal cardiorespiratory physiology. Existing models
do not meet these ambitious objectives [2–9]. A new integrated cardiorespiratory model is based on
the principles outlined by van Meurs [10]. In this paper the controlled cardiovascular model for the
term neonate is introduced. It is validated at baseline, and for the PDA and aPH conditions. The
patient-specific configurations used in these validations were produced not by manual tuning but by
an AI-assisted, closed-loop calibration pipeline that maps a small set of measured clinical targets
onto the model's parameters; the pipeline is outlined in Box 1 and described in full in a companion
paper [24]. The neonatal respiratory model, encompassing breathing, ventilation, gas exchange, gas
transport, and metabolism, is described in a separate paper. The acid–base model was presented
separately [11]. The model is for a full-term neonate but can be scaled to reflect prematurely born
neonates. Degrees of prematurity do not require a change in model structure, but can be simulated by
modifying selected model parameters and state variables. Visual interactive EXPLAIN can be run in
real time from the web page <https://explain-modeling.com/>. The complete source code is available
upon request.

---

## 2. Methods

### 2.1 Conceptual model

Figure 1 shows the main models and causal relationships underlying EXPLAIN. Overall inputs and
outputs of the integrated model, such as the fraction of inspired oxygen and the ECG, are not
represented in this figure.

**Fig. 1** (`thesis/Fig1_cardiovascular_blockdiagram.svg`). Block diagram of the integrated
cardiorespiratory model, adapted from van Meurs [10].

The two bottom blocks of Figure 1 reflect blood flow and control of circulation, and the two top
blocks reflect gas flow and control of breathing. Oxygen delivery, cellular metabolism, and carbon
dioxide elimination, part of the central block, rely on both gas flow and blood flow. Control
effectors are described in detail below. This article describes the model of the neonatal
cardiovascular system: the two bottom blocks in Figure 1, a software implementation of this model,
and selected cardiovascular simulation results and model validation.

A cardiac-rhythm sub-model is part of the circulation model. It responds to the circulatory control
effector heart rate from the control-of-circulation model and generates heart-chamber activation
functions. These are sent to the hemodynamics model described below. The underlying time-varying
elastance model and the four heart-chamber activation functions are explained in the mathematical
model section. The function of the SA and AV nodes is implicit in the modeled time functions. The
variable heart rate determines the firing rate of the SA node. Dysrhythmias can be simulated by
ad-hoc changes to the parameters of the cardiac-rhythm model.

The other sub-model of the circulation model is the hemodynamics model, which reflects cardiac and
vascular blood volumes, pressures, and flow rates. It responds to activation functions from the
cardiac-rhythm model, intrathoracic pressure generated by the ventilation model, and circulatory
control effectors, including contractility, arteriolar resistance and elastance, and venous
unstressed volume. Arterial blood pressure is an output variable from the hemodynamics model to the
control-of-circulation model, and various circulatory volumes and flow rates are outputs to the
transport-and-metabolism model. Figure 2 gives a hydraulic-circuit representation of the neonatal
hemodynamics model. The basis for this model is the one given by Beneken [12] (see also Goodwin et
al. [13]), expanded by the specific tissue groups and neonatal shunts that are needed to simulate
the neonatal conditions mentioned in the introduction.

**Fig. 2** (`thesis/Fig2_cardiovascular_hydraulic_circuit.svg`). Hydraulic-circuit representation
of neonatal hemodynamics. See Table 1 for the symbols used and their mathematical description.
Intra-thoracic components are indicated in blue and extra-thoracic components in black. Components
located inside the pericardium have a light-grey background. Dashed lines represent shunts that are
exclusive to the neonate, or more significant than in a typical adult. **Time-varying elastances:**
LA left atrium, LV left ventricle, RA right atrium, RV right ventricle, COR coronaries.
**Capacitances:** AA ascending aorta, AAR aortic arch and intrathoracic descending aorta, AD
extrathoracic descending aorta, BR brain, RUB remainder of the upper body, VUB veins of the upper
body, SVC superior vena cava, LS liver and spleen, INT intestines, KID kidneys, RLB remainder of
the lower body, VLB veins of the lower body, IVCI intrathoracic inferior vena cava, PA pulmonary
artery, LL left lung, RL right lung, PV pulmonary veins. All organ capacitances have an associated
arteriole (A) and venule (V) connected to the capacitance by a resistor (not represented).
**Shunts:** DA ductus arteriosus, FO foramen ovale, IPS intrapulmonary shunt, VSD ventricular
septal defect.

The heart-chamber activation functions, normalized to an amplitude of 1 (dimensionless), are
multiplied by contractility from the control-of-circulation model and then drive the heart chambers.
In the hemodynamics model, capacitances, indicated by circles, contain time-varying blood volumes.
The transport-and-metabolism model described in a separate paper has compartments with time-varying
blood-gas contents. The cardiac chambers — left atrium (LA), left ventricle (LV), right atrium (RA)
and right ventricle (RV) — were already part of the Beneken model [12], as were the pulmonary artery
(PA) and pulmonary veins (PV). The intrathoracic systemic arterial compartment of the Beneken model
is divided into ascending aorta (AA) and aortic arch with intrathoracic descending aorta (AAR), so
that blood with shunt-dependent, different oxygen contents can flow to the coronaries, and to the
brain and lower body. This is required to enable the representation of the many neonatal conditions
in which the shunt across the ductus arteriosus is important. A separate coronary (COR) circulation
is included to realistically simulate oxygen delivery to the myocardium. The ventricular activation
function is also applied to the elastance of the coronary capacitance, which reproduces the
characteristic coronary flow pattern dominated by diastolic blood flow. The central chemoreceptors
require the simulation of a separate brain (BR) capacitance. Cerebral autoregulation is not included
in the cardiovascular model presented here (it is developed in a companion paper [P3a]); to enable
that, a separate remainder-of-the-upper-body (RUB) compartment, which is not subject to
autoregulation, is already included. The veins of the upper body (VUB) and superior vena cava (SVC)
act as the downstream compartment to the upper-body circulation, where the SVC is located inside the
thoracic compartment. The intestines (INT) play an important role in redistribution of blood flow.
Albeit not strictly required for the cardiorespiratory model, liver-and-spleen (LS) and kidneys
(KID) compartments are necessary for differential metabolism in pharmacokinetic models. Other organs
in the lower body are lumped together in the remainder-of-lower-body (RLB) compartment. Each organ
consists of three capacitances connected by resistors representing the arteriole (A), capillary bed
and venule (V) of that organ system. This configuration allows for an improved representation of the
hemodynamic response to autonomic control. Separate left and right lung circulations and
compartments are required for the simulation of unilateral phenomena in tension pneumothorax and
congenital diaphragmatic hernia (CDH). The intrapulmonary shunt (IPS) is included to allow for
simulation of heterogeneous pulmonary perfusion states and atelectasis. The foramen ovale (FO) and
ductus arteriosus (DA) are necessary for the representation of, for example, a persistent patent
ductus arteriosus, hypoplastic left heart syndrome, and congenital diaphragmatic hernia. The
distinction between intra- and extra-thoracic venous compartments (IVCI and VLB) allows for
simulation of the effects of intrathoracic pressure on the circulation. Intrathoracic pressure is
modulated by spontaneous breathing, mechanical ventilation, and chest compressions. The pericardium,
not shown in Figure 2, is modelled as an elastic structure with a low compliance above its
unstressed volume, limiting the sum of the heart-chamber volumes.

The control of circulation by the autonomic nervous system (ANS) is based on the model described by
van Meurs [10]. In this model, the main regulated cardiovascular variable, arterial pressure, is
represented by an afferent activation function (Fig. 4). This function has a defined setpoint around
which it operates and minimum and maximum activation levels. The model is expanded as follows: the
afferent signal is used to determine the sympatho-vagal balance (SVB). A mean arterial pressure
below the setpoint produces a positive SVB, corresponding to sympathetic dominance and
cardiovascular stimulation. Pressure above the setpoint results in a negative SVB, indicating
parasympathetic (vagal) dominance and cardiovascular depression. The magnitude of this response is
defined by a baroreflex gain that determines the sensitivity of SVB to changes in arterial pressure.
The resulting SVB controls the efferent cardiovascular effectors, including heart rate, myocardial
contractility, systemic vascular resistance, and venous tone. Each effector responds to SVB
according to its specific gain and is constrained to physiological limits. The model represents a
closed-loop baroreflex system in which arterial blood pressure is sensed, transformed into a unified
autonomic control signal (SVB), and used to adjust cardiovascular function to restore and maintain
pressure homeostasis. A further expansion of the van Meurs model is the inclusion of a time constant
that determines how quickly it responds to changes in the controlled variable. The SVB-based model
can easily be expanded to include additional cardiorespiratory receptors.

### 2.2 Mathematical model

Cardiac cycle time is denoted by *n* = 1, 2, 3, … (dimensionless). Continuous time is denoted by *t*
(s). The heart model is based on the time-varying elastance model first described by Beneken [12],
and validated in dogs by Suga et al. [14]. Figure 3 shows the elastances for the neonatal left
heart.

*Source: `explain/component_models/Heart.js`.*

Contractions are simulated via rising heart-chamber elastances, resulting in physiologic pressure
and flow patterns in the hemodynamics model. The atria are activated by a half-sinusoid over the
duration of atrial systole in seconds (*T*_as). This duration is defined by the PQ time in seconds:

> **Eq. 1** &nbsp; *a*_a(*t*) = sin[π·(*t* / *T*_as)]

The ventricles and coronary capacitances are activated by a delayed and slightly skewed
half-sinusoid over the duration of ventricular systole. The elastance waveforms displayed in Figure
3 have chamber-specific baselines and amplitudes:

> **Eq. 2** &nbsp; *a*_v(*t*) = [(*t* − (*T*_as + *T*_av)) / (*K*_n·*t*_vs(*n*))]·sin[π·((*t* − (*T*_as + *T*_av)) / *t*_vs(*n*))]

*K*_n is a normalization constant resulting in a maximum of 1 of the time function. The duration of
ventricular systole (*t*_vs(*n*)) is calculated by Bazett's formula using the QT interval [15]:

> **Eq. 3** &nbsp; *t*_vs(*n*) = QT·√(60 / hr(*n*))

**Fig. 3.** Time-varying elastances for the left heart. *(Native chart object in the source
manuscript `ExplainCircPaper(27012026)_WPdB_TA_WvM.docx`; no raster export is carried in this
working copy. The traces show the left-atrial and left-ventricular elastance waveforms over the
cardiac cycle — the atrial half-sinusoid of Eq. 1 and the delayed, skewed ventricular waveform of
Eq. 2 — each with its chamber-specific baseline elastance E_min and peak-systolic amplitude
e_max(n).)*

**Fluid-circuit elements.** The hydraulic circuit of Figure 2 is built from five element types —
resistor, valve, capacitance, container and time-varying elastance — each governed by a piece-wise
continuous constitutive law relating volume *v*(*t*), pressure *p*(*t*) and flow rate *f*(*t*)
(Table 1).

*Source: `explain/base_models/Resistor.js`, `explain/base_models/Capacitance.js`,
`explain/base_models/Container.js`, `explain/base_models/TimeVaryingElastance.js`.*

A **resistor** relates the flow rate to the pressure difference across it, with a linear term
(resistance *R*) and a non-linear term (*K*₁), and separate forward (*R*_f) and reverse (*R*_r)
resistances:

> **Eq. 4** &nbsp; *p*₁(*t*) − *p*₂(*t*) ≥ 0: &nbsp; *K*₁·*f*(*t*)² + *R*_f·*f*(*t*) = *p*₁(*t*) − *p*₂(*t*)
> **Eq. 4** &nbsp; *p*₁(*t*) − *p*₂(*t*) < 0: &nbsp; −*K*₁·*f*(*t*)² + *R*_r·*f*(*t*) = *p*₁(*t*) − *p*₂(*t*)

A **valve** is a resistor with infinite reverse-flow resistance (*R*_b = ∞), so it passes forward
flow only:

> **Eq. 5** &nbsp; *p*₁(*t*) − *p*₂(*t*) ≥ 0: &nbsp; *K*₁·*f*(*t*)² + *R*_f·*f*(*t*) = *p*₁(*t*) − *p*₂(*t*)
> **Eq. 5** &nbsp; *p*₁(*t*) − *p*₂(*t*) < 0: &nbsp; *f*(*t*) = 0 &nbsp; (*R*_b = ∞)

A **capacitance** relates volume to transmural pressure through a linear elastance *E*, unstressed
volume UV, and a non-linear coefficient *K*₂:

> **Eq. 6** &nbsp; *v*(*t*) ≥ UV: &nbsp; *p*₁(*t*) = *K*₂·[*v*(*t*) − UV]² + *E*·[*v*(*t*) − UV] + *p*₂(*t*)
> **Eq. 6** &nbsp; *v*(*t*) < UV: &nbsp; *p*₁(*t*) = −*K*₂·[*v*(*t*) − UV]² + *E*·[*v*(*t*) − UV] + *p*₂(*t*)

A **container** is a capacitance whose volume is the sum of the volumes of the enclosed compartments,
transmitting its recoil pressure back onto them:

> **Eq. 7** &nbsp; *v*(*t*) = Σ *v*_n(*t*)
> **Eq. 7** &nbsp; *v*(*t*) ≥ UV: &nbsp; *p*₁(*t*) = *K*₂·[*v*(*t*) − UV]² + *E*·[*v*(*t*) − UV] + *p*₂(*t*)
> **Eq. 7** &nbsp; *v*(*t*) < UV: &nbsp; *p*₁(*t*) = −*K*₂·[*v*(*t*) − UV]² + *E*·[*v*(*t*) − UV] + *p*₂(*t*)

A **time-varying elastance** interpolates, via the chamber activation function *a*(*t*), between an
end-diastolic pressure *p*_ed (a capacitance with minimum elastance E_min) and a maximum-systolic
pressure *p*_ms (a linear elastance e_max(*n*)):

> **Eq. 8** &nbsp; *v*(*t*) ≥ UV: &nbsp; *p*_ed(*t*) = *K*₂·[*v*(*t*) − UV]² + *E*_min·[*v*(*t*) − UV]
> **Eq. 8** &nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; *p*_ms(*t*) = *e*_max(*n*)·[*v*(*t*) − UV]
> **Eq. 8** &nbsp; &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; *p*₁(*t*) = [*p*_ms(*t*) − *p*_ed(*t*)]·*a*(*t*) + *p*_ed(*t*) + *p*₂(*t*)
> **Eq. 8** &nbsp; *v*(*t*) < UV: &nbsp; *p*₁(*t*) = *p*₂(*t*)

**Table 1. Fluid-circuit elements.** Each element's constitutive law is the equation cited. Volume
*v*(*t*), pressure *p*(*t*), and flow rate *f*(*t*). Units: volumes (*v*, UV) in L, elastances
(*e*, *E*) in mmHg·L⁻¹, pressures (*p*) in mmHg, flows (*f*) in L·s⁻¹, resistances (*R*) in
mmHg·s·L⁻¹, *K*₁ in mmHg·L²·s⁻², *K*₂ in mmHg·L⁻².

| Element | Governing law | Key parameters |
|---|---|---|
| Resistor | Eq. 4 | *R*_f, *R*_r (forward/reverse resistance), *K*₁ (non-linear) |
| Valve | Eq. 5 | *R*_f (forward resistance), *R*_b = ∞ (reverse), *K*₁ |
| Capacitance | Eq. 6 | *E* (elastance), UV (unstressed volume), *K*₂ (non-linear) |
| Container | Eq. 7 | *E*, UV, *K*₂; volume = Σ enclosed-compartment volumes |
| Time-varying elastance | Eq. 8 | E_min, e_max(*n*), UV, *K*₂; activation *a*(*t*) |

Resistance can be different for forward (*R*_f) and reverse (*R*_r) flow. The constant *K*₁ (Table 1)
governs non-linear behavior: for *K*₁ > 0 the flow rate for higher pressure differences is reduced
compared with the linear case. *K*₁ is assumed to be identical for forward and reverse flow rates.
Capacitance characteristics are represented by a piece-wise continuous relationship between volume
*v*(*t*) and transmural pressure *p*₁(*t*) − *p*₂(*t*), governed by the elastance *E* (inverse
compliance), the unstressed volume UV, and the non-linearity parameter *K*₂. A correctly functioning
valve is a resistor with infinite reverse-flow resistance. Strictly speaking, for mathematical
reasons this element could be replaced by a resistance, but it was chosen not to do so, to enable
future work on heart-valve pathologies. Time-varying elastances during diastole resemble a
capacitance with a minimum elastance *E* = E_min. For the atria and coronary circulation *K*₂ = 0,
assuming linear behavior over the range of volumes of interest. For the ventricles *K*₂ is non-zero,
so that the diastolic ventricular elastances saturate for higher volumes. For maximum contraction, a
linear characteristic is applied. The maximum elastance e_max(*n*) of the left ventricle is an input
variable to the hemodynamics model from the control-of-circulation model. It affects all four heart
chambers, as well as the coronary circulation, with a fixed proportionality factor per chamber. The
transition between end diastole (ed) and maximum systole (ms) of the ventricles is governed by
Equation 8, which takes the ventricular activation function *a*(*t*) as an input [16]. Using the
equations in Table 1, pressures in all capacitances of Figure 2 are computed from the volumes at
time *t* and the relevant parameters.

The control of circulation is expressed as a set of coupled mathematical functions describing the
afferent activation, the sympatho-vagal balance (SVB), and the efferent control effects.

*Source: `explain/component_models/Ans.js`.*

**Afferent receptor activation function.** Receptor activation is modeled as an activation function
centered around the setpoint of the controlled variable *cv*, where af_cv = 0 at *cv* = CV_sp:

> **Eq. 9** &nbsp; *cv* ≥ CV_max: &nbsp; af = CV_max − CV_sp
> **Eq. 9** &nbsp; CV_min < *cv* < CV_max: &nbsp; af = *cv* − CV_sp
> **Eq. 9** &nbsp; *cv* ≤ CV_min: &nbsp; af = CV_min − CV_sp

where af is the receptor activation, CV_sp the setpoint of the controlled variable, and CV_max /
CV_min its maximum and minimum values. To represent the finite adaptation time of the receptor, the
activation is low-pass-filtered using a discrete-time first-order filter with receptor time constant
τ_cv, resulting in a filtered activation *a*.

**Fig. 4** (`thesis/Fig4_cardiovascular_activation_function.svg`). Activation function, adapted from
van Meurs [10]. The receptor activation af is zero at the setpoint CV_sp and saturates at its
minimum and maximum activation levels for controlled-variable values below CV_min and above CV_max.

The sympatho-vagal balance is:

> **Eq. 10** &nbsp; svb(*t*) = *G*_(svb/map)·*a*

where *G*_(svb/map) defines the contribution of mean arterial pressure to the autonomic output.

**Efferent control of cardiovascular effectors.** Each effector is modulated as a relative change
from its baseline reference value, scaled by its sensitivity to SVB:

> **Eq. 11** &nbsp; ef(svb) = (1 + *G*_(ef/svb)·svb(*t*))·ef_ref

where *G*_(ef/svb) is the gain relating SVB to the specific effector, and ef_ref is its reference
value.

### 2.3 Software implementation and code verification

The main target audience of EXPLAIN consists of clinical researchers in neonatal intensive care. The
user can explore effects of therapeutic interventions and different clinical conditions, including
the validation experiments of this paper. The free software is accessible using standard browsers
via <https://explain-modeling.com/>. An important additional objective of the present work is to
enable model developers to understand, use, and modify the model and corresponding code. The source
code of EXPLAIN is available upon request and is extensively annotated. Developers with
undergraduate-level software-engineering experience, and basic knowledge of the JavaScript/
TypeScript programming language, should — after a few days of familiarization with the environment —
be able to:

- run the described integrated model, and plot graphs of variables of interest, for example right
  ventricular pressures and volumes;
- modify patient profiles via initial state variables and parameters, for example create a
  hypotensive patient;
- modify model structure, for example remove separate tissue capacitances and compartments to create
  a simpler model or an anatomical variant of the normal circulation.

With a little more time, developers should be able to:

- modify properties of model components, for example create a regurgitating cardiac valve;
- add models, for example liver metabolism;
- optimize numerical-integration methods and simulation run-time;
- use the models in other applications, for example in clinical decision support.

The model developer environment is implemented as a framework-agnostic simulation engine written in
JavaScript/TypeScript that runs inside a Web Worker — a background execution thread separate from the
user interface — communicating with the application through a simple message-passing protocol, so
that the physics loop advances independently of rendering and user interaction and the model runs in
real time in a standard web browser. Each physiological component is a small, self-contained module
that implements the equations of Section 2.2; complete scenarios (baseline anatomy, parameters and
initial state) are defined declaratively as JSON model definitions, which makes patient profiles and
structural variants straightforward to inspect, share and modify. The code that combines and
sequences the different model software components is visible and non-proprietary but will typically
not be modified by the developer. A tutorial for model development is included, and the code contains
explicit comments. The complete, annotated engine source code is publicly available at
<https://github.com/Dobutamine/explain-engine> and archived with a persistent identifier at
<https://doi.org/10.5281/zenodo.21389097>.

> **Box 1 · How the virtual patients in this paper were parameterized.**
> The patient profiles used here were not tuned by hand. EXPLAIN instantiates a patient with a
> two-layer, AI-assisted pipeline (illustrated in Fig. 6). An *interpretation layer* — a large
> language model — reads the available clinical description (free text, monitor values or a report)
> and emits a validated, bounded specification: a baseline, target values and named pathophysiology,
> expressed only through the same allowlisted, schema-checked commands as the interactive parameter
> editor. A *calibration layer* — a deterministic root-finder — then fits the model by assigning one
> physiologically interpretable lever to each target and driving that target to a clinician-
> meaningful tolerance, after allometric and gestational-age seeding and baroreflex set-point
> alignment so that the model's own control loops defend rather than oppose the fit. The language
> model performs no numerical fitting and never edits equations or state. For the cardiovascular
> targets of this paper the pairings are: mean arterial pressure ← systemic (arteriolar) resistance;
> cardiac output ← ventricular contractility (e_max); heart rate ← heart-rate reference; central
> venous pressure ← systemic venous unstressed volume; mean pulmonary artery pressure ← pulmonary
> vascular resistance. The full method — convergence behaviour, the sensitivity-analysis
> justification for the one-lever-per-target design, and the offline-construction and live-tuning
> entry points — is given in the companion paper [24]; the use of a language model as a *method
> component*, not an author, is disclosed below.

**AI-use disclosure.** A large language model (Claude, Anthropic [25]), orchestrated through the
Claude Agent SDK [26], is used as a component of the parameterization method: it interprets clinical
inputs and emits validated, allowlisted specifications. It performs no numerical fitting, does not
modify the model's equations or state, and is not used to generate the scientific content or text of
this study; no authorship is attributed to it.

---

## 3. Results

### 3.1 Simulation experiments and model validation

#### 3.1.1 Baseline hemodynamics

To validate the hemodynamic baseline state of the model we used published hemodynamic data of Jhaveri
et al. [17], Groves et al. [18], Kluckow and Evans [19], and van Zadelhoff et al. [20]. These papers
provide relevant hemodynamic data for normal full-term neonates and are in acceptable agreement with
each other. Table 2 lists the reported hemodynamic data and the simulated results. Reported
simulation results are end-expiratory, at an intrathoracic pressure of −3.5 mmHg.

**Table 2. Baseline hemodynamics — target data and simulation results** for a normal term-born
neonate of 3.3 kg at an age of 24 h. Columns Jhaveri–van Zadelhoff are target data from the
literature; EXPLAIN is the simulation result. HR heart rate, LVEDV/LVESV left-ventricular end-
diastolic/end-systolic volume, LVSV left-ventricular stroke volume, LVO left-ventricular output,
RVEDV/RVESV/RVSV/RVO the right-ventricular analogues, fSVC superior vena cava flow, ABPs/ABPd
systolic/diastolic arterial blood pressure. Volumes in mL, flow rates in mL·min⁻¹·kg⁻¹, pressures in
mmHg. "–" = not reported.

| Quantity | Jhaveri [17] | Groves [18] | Kluckow [19] | van Zadelhoff [20] | EXPLAIN |
|---|---|---|---|---|---|
| HR | 100.3 ± 9.8 | 142 ± 17.1 | – | – | 118 |
| LVEDV | 2.5 ± 0.3 | 2.51 ± 0.40 | – | – | 2.6 |
| LVESV | 0.9 ± 0.2 | 0.78 ± 0.21 | – | – | 1.0 |
| LVSV | 1.6 ± 0.1 | 1.73 ± 0.28 | – | – | 1.6 |
| LVO | 177 ± 25 | 245 ± 47.1 | – | – | 181 |
| RVEDV | 3.1 ± 0.3 | – | – | – | 3.2 |
| RVESV | 1.5 ± 0.2 | – | – | – | 1.6 |
| RVSV | 1.6 ± 0.2 | – | – | – | 1.6 |
| RVO | 181 ± 30 | – | – | – | 181 |
| fSVC | – | 95 ± 27.0 | 76 (34–143) | – | 76 |
| ABPs | – | – | – | 67 | 70 |
| ABPd | – | – | – | 42 | 45 |

There is a close match of the simulation results to target data coming from different sources, which
measured the parameters using different techniques (echocardiography and MRI). Normal values of the
resulting blood pressure are reported by many articles; we used a recent study [20] to validate our
data, as it reports blood pressure over a range of gestational and postnatal ages.

#### 3.1.2 Persistent ductus arteriosus (PDA)

One of the target clinical scenarios is a persistent patent ductus arteriosus (PDA). Bischoff et al.
[21] provide detailed neonatal hemodynamic data, making PDA a suitable validation case. Table 3
summarizes the effects of absent, bidirectional, and significant left-to-right shunting on left
ventricular output (LVO), right ventricular output (RVO), superior vena cava flow (SVCF), and the
LVO/RVO ratio. The baseline premature-infant configuration reported by Bischoff et al. was produced
with the AI-assisted calibration pipeline (Box 1): blood volumes, unstressed volumes, elastances and
resistances were first scaled allometrically to the reported weight, after which the calibrator
fitted the model to the reported baseline hemodynamic targets. A bidirectional shunt (≥10% right-to-
left time) was obtained by modifying pulmonary vascular resistance and elastance at a ductus diameter
of 2.2 mm. A hemodynamically significant left-to-right shunt (100% left-to-right) was created by
lowering pulmonary vascular resistance to achieve an LVO/RVO ratio of 1.55. Simulations used active
circulatory control, a small foramen ovale, and end-expiratory conditions at −3.5 mmHg intrathoracic
pressure. For a more qualitative validation of model waveform output, Doppler flow-velocity target
data for non-restrictive and restrictive left-to-right transductal blood flow, and for bidirectional
transductal blood flow, were obtained from van Laere et al. [22]. The simulated instantaneous PDA
flow rate *f*_DA(*t*) in L·s⁻¹ (Fig. 2) is transformed into a Doppler flow pattern with a velocity
*v*_DA(*t*) in m·s⁻¹, averaged over the ductus velocity profile:

> **Eq. 12** &nbsp; *v*_DA(*t*) = 1000·*f*_DA(*t*) / (π·(*D*_PDA / 2)²)

*Source: `explain/component_models/Pda.js`.*

**Table 3. PDA — target data from Bischoff et al. [21] and simulation results** for a patient with
three levels of PDA. Flow rates in mL·min⁻¹·kg⁻¹. The lower block reports each quantity as a fraction
(*f*) of the "no PDA" baseline value. Abbreviations as in Table 2.

| Quantity | Target: no PDA | Target: bidirectional | Target: PDA | Sim: no PDA | Sim: bidirectional | Sim: PDA |
|---|---|---|---|---|---|---|
| LVO | 169.7 ± 43.7 | 140.4 ± 30.3 | 250.1 ± 45.7 | 179 | 157 | 261 |
| RVO | 170.3 ± 39.1 | 120.5 ± 42.2 | 161.1 ± 37 | 179 | 138 | 154 |
| LVO/RVO | 0.996 | 1.165 | 1.552 | 1.0 | 1.14 | 1.57 |
| SVCF | 73.4 ± 29.4 | 69.7 ± 24.7 | 65 ± 35.1 | 74 | 69 | 64.5 |
| *f*_LVO | 1 | 0.83 | 1.47 | 1 | 0.88 | 1.39 |
| *f*_RVO | 1 | 0.71 | 0.95 | 1 | 0.77 | 0.88 |
| *f*_LVO/RVO | 1 | 1.17 | 1.56 | 1 | 1.14 | 1.57 |
| *f*_SVCF | 1 | 0.95 | 0.89 | 1 | 0.93 | 0.89 |

The simulation results confirm the main conclusions of Bischoff et al. [21], namely that:

- superior vena cava flow with and without a transductal left-to-right shunt are comparable;
- left ventricular output is higher with a transductal left-to-right shunt;
- the ratio of left-to-right ventricular output is higher with a transductal left-to-right shunt.

Simulated relative hemodynamic changes between the absence and presence of transductal left-to-right
shunt flow closely match the target data. Changes for the bidirectional-shunt condition reproduce the
correct direction and order of magnitude, though not the exact values. Notably, the model replicates
the paradoxical reduction in LVO seen with bidirectional shunting, allowing further exploration of
this finding. The model also generates Doppler and instantaneous flow patterns during ductal closure;
Figure 5 compares simulation outputs with published transductal Doppler data.

**Fig. 5** (`thesis/Fig5_cardiovascular_pda_doppler_bidirectional.png`,
`Fig5_cardiovascular_pda_doppler_nonrestrictive.png`, `Fig5_cardiovascular_pda_doppler_restrictive.png`).
Target PDA Doppler flow-rate data from van Laere et al. [22] (left) and EXPLAIN simulation results
(right), for bidirectional, non-restrictive left-to-right, and restrictive left-to-right transductal
flow.

There is again a very close match of simulation results to target data. A minor but noteworthy
observation in the target data — a very short early-systolic dip in the Doppler velocity for
restrictive left-to-right flow — is matched by the model output.

#### 3.1.3 Pulmonary hypertension (PH)

Pulmonary hypertension (PH) involves elevated pulmonary vascular resistance with right-to-left
shunting through the ductus arteriosus and/or foramen ovale. Invasive neonatal hemodynamic data are
scarce because cardiac catheterization is rarely performed; most clinical assessment relies on
echocardiography. Jones and Crossland [23] report representative pressures, flows, and oxygen
saturations across PH stages, reflecting current clinical understanding despite limited pooled data.
In the EXPLAIN model, pulmonary hypertension is simulated by increasing the resistance in the
pathways connecting the left and right pulmonary artery capacitances (PAAL, PAAR) to the left and
right lung capacitances (LL, RL) and by modifying the baseline elastance of the pulmonary-artery
capacitance to represent varying degrees of severity. As in the PDA case, the underlying patient
baseline was established with the calibration pipeline of Box 1; the pulmonary-resistance and
pulmonary-artery-elastance changes representing each stage were then applied on top of that
calibrated baseline.

**Table 4. Pulmonary hypertension — target data from Jones and Crossland [23] and simulation
results** for patients with three levels of persistent pulmonary hypertension (PPHN). Target data
were converted from L·min⁻¹·m⁻² to mL·kg⁻¹·min⁻¹ using a body surface area of 0.221 m² (length 50 cm,
weight 3.515 kg). Q_p pulmonary blood flow (mL·kg⁻¹·min⁻¹), Q_s systemic blood flow
(mL·kg⁻¹·min⁻¹), Q_p/Q_s their ratio, TPG transpulmonary gradient (PAP − left-atrial pressure, mmHg),
PVR pulmonary vascular resistance (mmHg·min·mL⁻¹), RVP right-ventricular pressure (mmHg), LVP left-
ventricular pressure (mmHg), PAP pulmonary-arterial pressure (mmHg), ABP aortic/arterial pressure
(mmHg).

| Quantity | Target: Early PH | Target: Severe PH (no PDA) | Target: Severe PPHN + PDA | Sim: Early PH | Sim: Severe PH (no PDA) | Sim: Severe PH + PDA |
|---|---|---|---|---|---|---|
| Q_p | 176 | 126 | 101 | 179 | 132 | 105 |
| Q_s | 176 | 132 | 176 | 179 | 143 | 178 |
| Q_p/Q_s | 1.0 | 0.95 | 0.57 | 1.0 | 0.92 | 0.59 |
| TPG | 34 | 48 | 36 | 35 | 47 | 37 |
| PVR | 0.19 | 0.38 | 0.36 | 0.19 | 0.36 | 0.37 |
| RVP | 58/7 | 70/8 | 60/7 | 55/7 | 68/7 | 63/8 |
| LVP | 64/6 | 50/6 | 60/6 | 63/6 | 51/6 | 63/6 |
| PAP | 58/28 | 70/38 | 60/30 | 60/30 | 72/39 | 63/32 |
| ABP | 64/32 | 50/24 | 60/30 | 63/31 | 52/26 | 61/31 |

The target data reflect current clinical understanding. The model closely matches the magnitude and
direction of the changes in Q_p, Q_s and the ventricular and arterial pressures across the different
states of PH.

---

## 4. Discussion

Explanatory models are real-time, interactive, animated visualizations of human physiology that help
acute-care physicians carry out the challenging cognitive tasks they face in clinical practice and
research. EXPLAIN is an explanatory model for neonatal intensive care. An integrated model of
cardiorespiratory physiology underlies this tool. In this paper the cardiovascular model is
presented. This model is validated — and its explanatory use illustrated — for the conditions
persistent ductus arteriosus (PDA) and acute pulmonary hypertension (aPH). The model reproduces key
baseline hemodynamic features for term neonates, as well as the characteristic changes observed in
PDA and PH. Reproducibility and use of simulation results, and expansions of the cardiovascular
model, are enabled by making the numerical values of model parameters, the model source code, and
the EXPLAIN user software available.

### 4.1 Model originality

The frequently used and well-validated Beneken model for the adult and infant uncontrolled
cardiovascular systems was expanded with specific tissue groups and shunts needed to simulate the
neonatal conditions mentioned in the introduction. Non-linear characteristics of resistances and
capacitances are given in the mathematical model section. The model of the baroreflex is an expansion
of the well-documented van Meurs model. The inclusion of an explicit variable for the sympatho-vagal
balance results in a compact model with high explanatory value. A simple model of the Doppler flow
pattern is presented. A further element of originality is that EXPLAIN is fitted to a patient not by
hand but by an AI-assisted, closed-loop pipeline (Box 1; Fig. 6; companion paper [24]), which makes
patient-specific instantiation reproducible and keeps every automated adjustment within the same
bounds as a manual edit.

**Fig. 6** (`thesis/Fig6_AI_parameterization.png`, `thesis/Fig6_AI_parameterization.svg`).
AI-assisted patient-specific parameterization (Box 1). An LLM agent interprets the available clinical
targets (*x\**) and emits a validated specification and allowlisted commands; it does not modify
equations or state directly. A deterministic calibrator then fits the mechanistic model: a single
structural pass scales the model to body size and aligns the baroreflex set-point to the target mean
arterial pressure, after which one physiologically interpretable lever per target (Box 1) is nudged —
a proportional seed followed by the secant method — as the model is advanced and each quantity is
re-measured as a beat-averaged mean, until every residual falls within its clinician-meaningful
tolerance. The same loop supports offline construction of a new calibrated patient and live retuning
of a running simulation. The full method is given in the companion paper [24].

### 4.2 Model validity

Validation consists of comparing model simulation results to target data from the literature. A close
quantitative agreement for baseline term hemodynamics is observed. PDA states result in the expected
relative changes in major flow ratios and in Doppler wave morphology. The paradoxical reduction in
LVO in bidirectional PDA, and the occurrence of the early-systolic flow reduction in restrictive PDA
— both reported clinically but often under-represented in simplified cardiovascular models — emerged
naturally from the interaction of shunt dynamics, pulmonary vascular tone and control responses.
EXPLAIN allows for the visualization and manipulation of the underlying variables and thereby
contributes to the explanation and understanding of these phenomena. In PH, the model captures the
direction and magnitude of the major hemodynamic shifts and produces ductal Doppler patterns
consistent with published waveforms.

### 4.3 Reproducibility of results and model expansion

A core aim was to create a tool that the authors and other investigators can use to reproduce the
conditions used in validation, and that allows for the simulation of other conditions of educational
and research value. EXPLAIN achieves this. The EXPLAIN aim favors an underlying cardiovascular model
with a structure that has clear anatomical and physiological interpretations. This aspect also
facilitates modification and expansion by qualified researchers and developers, a goal further
reinforced by making the model source code available.

### 4.4 Limitations

Quantitative neonatal hemodynamic data — particularly invasive measurements in PH patients — remain
sparse and heterogeneous; some validation therefore relies on representative clinical ranges, Doppler
morphology, and expert consensus. Shunt diameter–resistance relationships assume idealized
laminar/turbulent transitions, and geometric variability (ductal length, septal shape) is simplified.
Despite these constraints, the model simulation results match published data. The model also provides
a basis for further systematic refinement.

### 4.5 Future work

Building on the AI-assisted parameterization pipeline used here (Box 1; companion paper [24]), future
work will pursue a systematic sensitivity analysis to identify the most informative parameters,
extend calibration from the present one-lever-per-target scheme to joint multi-target optimization
for strongly coupled configurations, and undertake prospective validation of patient-specific fits
against clinical data. In addition, the coupled cardiorespiratory framework will be applied to study
the physiological effects of ventilation strategies, pulmonary vasodilators, and the mechanisms
underlying transitional failure.

---

## Conclusion

This paper presents original conceptual and mathematical models of the neonatal cardiovascular system
for inclusion in an explanatory model for clinical researchers and educators. Simulation results
match published target data in good approximation. The EXPLAIN educational software and model code
are made available.

**Acknowledgements and potential conflicts of interest.** Supported in part by a grant from the
Stichting Radboud universitair medisch centrum. Willem van Meurs is a paid consultant for Elevate
Healthcare. None of the other authors have a potential conflict of interest to report.

---

## References

*In order of appearance (Vancouver, matching the series). Verified against PubMed on 2026-07-16 (full
provenance and actionable findings in `thesis/P1_references_verified.md`). Refs 10, 12 and 15 are a
textbook, a 1965 dissertation and a 1920 pre-MEDLINE paper respectively and are correctly not in
PubMed. The AI-parameterization references [24]–[26] enter as a coupled insertion with Box 1 and the
inline [24] anchors; [24] is blocked on the P6 preprint DOI (placeholder retained).*

1. van Meurs WWL, Antonius TAJ. Explanatory models in neonatal intensive care: a tutorial. *Adv Simul (Lond).* 2018;3:27. PMID 30598843. doi:10.1186/s41077-018-0085-2.
2. Allen WW, Power GG, Longo LD. Fetal O₂ changes in response to hypoxic stress: a mathematical model. *J Appl Physiol Respir Environ Exerc Physiol.* 1977;42(2):179–90. PMID 838643. doi:10.1152/jappl.1977.42.2.179.
3. Huikeshoven FJ, et al. Mathematical model of fetal circulation and oxygen delivery. *Am J Physiol.* 1985;249(2 Pt 2):R192–202. PMID 4025577. doi:10.1152/ajpregu.1985.249.2.R192.
4. van Willigen BG, et al. A review study of fetal circulatory models to develop a digital twin of a fetus in a perinatal life support system. *Front Pediatr.* 2022;10:915846. PMID 36210952. doi:10.3389/fped.2022.915846.
5. Pennati G, Bellotti M, Fumero R. Mathematical modelling of the human foetal cardiovascular system based on Doppler ultrasound data. *Med Eng Phys.* 1997;19(4):327–35. PMID 9302672. doi:10.1016/s1350-4533(97)84634-6.
6. Sá-Couto CD, et al. A model for educational simulation of neonatal cardiovascular pathophysiology. *Simul Healthc.* 2006;1(Spec no.):4–9. PMID 19088566. doi:10.1097/01266021-200600010-00003.
7. Yigit MB, et al. Transition from fetal to neonatal circulation: modeling the effect of umbilical cord clamping. *J Biomech.* 2015;48(9):1662–70. PMID 25773588. doi:10.1016/j.jbiomech.2015.02.040.
8. Munneke AG, Lumens J, Delhaas T. Cardiovascular fetal-to-neonatal transition: an in silico model. *Pediatr Res.* 2021;91(1):116–128. PMID 33731808. doi:10.1038/s41390-021-01401-0.
9. May RW, et al. From fetus to neonate: a review of cardiovascular modeling in early life. *WIREs Mech Dis.* 2023;15(4):e1608. PMID 37002617. doi:10.1002/wsbm.1608.
10. van Meurs WL. *Modeling and Simulation in Biomedical Engineering: Applications in Cardiorespiratory Physiology.* New York: McGraw Hill; 2011. *(Book — not in PubMed.)*
11. Antonius TAJ, et al. A white-box model for real-time simulation of acid–base balance in blood plasma. *Adv Simul (Lond).* 2023;8(1):16. PMID 37322544. doi:10.1186/s41077-023-00255-2.
12. Beneken JEW. *A mathematical approach to cardiovascular function: the uncontrolled human system* [dissertation]. Utrecht: Institute of Medical Physics TNO; 1965. *(Monograph — not in PubMed.)*
13. Goodwin JA, et al. A model for educational simulation of infant cardiovascular physiology. *Anesth Analg.* 2004;99(6):1655–1664. PMID 15562049. doi:10.1213/01.ANE.0000134797.52793.AF.
14. Suga H, Sagawa K, Shoukas AA. Load independence of the instantaneous pressure–volume ratio of the canine left ventricle and effects of epinephrine and heart rate on the ratio. *Circ Res.* 1973;32(3):314–22. PMID 4691336. doi:10.1161/01.res.32.3.314.
15. Bazett HC. An analysis of the time-relations of electrocardiograms. *Heart.* 1920;7:353–70. *(Pre-MEDLINE — not in PubMed.)*
16. Burkhoff D, Tyberg JV. Why does pulmonary venous pressure rise after onset of LV dysfunction: a theoretical analysis. *Am J Physiol.* 1993;265(5 Pt 2):H1819–28. PMID 8238596. doi:10.1152/ajpheart.1993.265.5.H1819.
17. Jhaveri S, et al. Normative ranges of biventricular volumes and function in healthy term newborns. *J Cardiovasc Magn Reson.* 2023;25(1):26. PMID 37095534. doi:10.1186/s12968-023-00932-1.
18. Groves AM, et al. Functional cardiac MRI in preterm and term newborns. *Arch Dis Child Fetal Neonatal Ed.* 2011;96(2):F86–91. PMID 20971721. doi:10.1136/adc.2010.189142.
19. Kluckow M, Evans N. Superior vena cava flow is a clinically valid measurement in the preterm newborn. *J Am Soc Echocardiogr.* 2014;27(7):794. PMID 24798866. doi:10.1016/j.echo.2014.04.002. *(NB: 1-page letter/reply; the canonical primary source is Kluckow M, Evans N. Superior vena cava flow in newborn infants: a novel marker of systemic blood flow. Arch Dis Child Fetal Neonatal Ed. 2000;82(3):F182–7. PMID 10794790 — consider swapping at the Word pass.)*
20. van Zadelhoff AC, et al. Age-dependent changes in arterial blood pressure in neonates during the first week of life: reference values and development of a model. *Br J Anaesth.* 2023;130(5):585–594. PMID 36858885. doi:10.1016/j.bja.2023.01.024.
21. Bischoff AR, et al. Assessment of superior vena cava flow and cardiac output in different patterns of patent ductus arteriosus shunt. *Echocardiography.* 2021;38(9):1524–1533. PMID 34309068. doi:10.1111/echo.15163.
22. van Laere D, et al. Application of NPE in the assessment of a patent ductus arteriosus. *Pediatr Res.* 2018;84(Suppl 1):46–56. PMID 30072803. doi:10.1038/s41390-018-0077-x.
23. Jones CB, Crossland DS. The interplay between pressure, flow, and resistance in neonatal pulmonary hypertension. *Semin Fetal Neonatal Med.* 2022;27(4):101371. PMID 35787350. doi:10.1016/j.siny.2022.101371.
24. Antonius TAJ, van Meurs WL, Westerhof BE, de Boode WP. An AI-assisted closed-loop method for patient-specific parameterization of a whole-body neonatal physiology model. *Pediatr Res.* ‹year; in press›. Preprint: bioRxiv ‹preprint DOI pending — fill once P6 [P6] is posted›. *(Companion paper; cited inline as [24] in the Abstract, Introduction, Box 1 and Discussion.)*
25. Anthropic. Claude [large language model]. Anthropic PBC; 2025. Available from: <https://claude.com>. *(Confirm exact model/version and access date at submission.)*
26. Anthropic. Claude Agent SDK [software]; 2025. Available from: <https://platform.claude.com/docs/en/api/agent-sdk>.

*The software archive (GitHub repository + Zenodo concept DOI 10.5281/zenodo.21389097) is stated
directly in the availability text of §2.3, matching the master manuscript; it carries no separate
citation number. Companion series papers are cited as unnumbered tokens [P3a]/[P6]; they resolve to
their final numbers at series assembly.*
