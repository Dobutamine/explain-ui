// AUTO-RELOCATED from the engine model classes' former `static model_interface`
// arrays (verbatim, inheritance resolved). Keyed by model_type. UI presentation
// metadata lives here, not in the physics engine. To regenerate after a model
// gains/changes a tunable parameter, dump each class's effective interface from
// explain/ModelIndex.js and replace MODEL_INTERFACES below.

import type { InterfaceField } from "./types";

export const MODEL_INTERFACES: Record<string, InterfaceField[]> = {
  "Ans": [
    {
      "target": "description",
      "type": "string",
      "caption": "description",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "caption": "enabled",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false
    },
    {
      "target": "ans_active",
      "type": "boolean",
      "caption": "ANS active",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "target": "BR_MAP",
      "type": "reference",
      "caption": "Baroreceptor",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "target": "CR_PCO2",
      "type": "reference",
      "caption": "Chemoreceptor pCO2",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    }
  ],
  "AnsAfferent": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "input_prop",
      "target_prop": "input_prop",
      "target_model": "input_model",
      "type": "prop-list",
      "build_prop": true,
      "readonly": false,
      "edit_mode": "extra",
      "caption": "input model property",
      "caption_model": "input model",
      "caption_prop": "input property",
      "options": []
    },
    {
      "target": "min_value",
      "type": "number",
      "build_prop": true,
      "readonly": false,
      "edit_mode": "basic",
      "caption": "minimum of the input (firing rate is 0.0)",
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "maximum of the input (firing rate is 1.0)",
      "target": "max_value",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "setpoint of the input (firing rate is 0.5)",
      "target": "set_value",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "timeconstant (s)",
      "target": "tc",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "efferents",
      "target": "efferents",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "AnsEfferent"
      ]
    },
    {
      "caption": "effect weight",
      "target": "effect_weight",
      "type": "number",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 3
    }
  ],
  "AnsEfferent": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "target_prop",
      "target_model": "target_model",
      "target_prop": "target_prop",
      "type": "prop-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "caption": "target model property",
      "caption_model": "target model",
      "caption_prop": "target property",
      "options": []
    },
    {
      "caption": "effect size at max firing_rate of 1",
      "target": "effect_at_max_firing_rate",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "effect size at min firing_rate of 0",
      "target": "effect_at_min_firing_rate",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "timeconstant (s)",
      "target": "tc",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false,
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    }
  ],
  "Blood": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "set temperature (C)",
      "edit_mode": "basic",
      "target": "set_temperature",
      "type": "function",
      "args": [
        {
          "caption": "new temperature",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 45,
          "ll": 25
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set viscosity (cP)",
      "edit_mode": "basic",
      "target": "set_viscosity",
      "type": "function",
      "args": [
        {
          "caption": "new new viscosity",
          "target": "viscosity",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 12,
          "ll": 0.1
        }
      ]
    },
    {
      "caption": "set Haldane coefficient",
      "edit_mode": "advanced",
      "target": "set_haldane_coeff",
      "type": "function",
      "args": [
        {
          "caption": "Haldane coefficient (0 = off)",
          "target": "new_coeff",
          "type": "number",
          "factor": 1,
          "delta": 0.05,
          "rounding": 2,
          "ul": 5,
          "ll": 0
        }
      ]
    },
    {
      "caption": "set total oxygen concentration (mmol/l)",
      "target": "set_to2",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new total oxygen concentration",
          "target": "to2",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 20,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set total carbon dioxide concentration (mmol/l)",
      "target": "set_tco2",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new total carbon dioxide concentration",
          "target": "tco2",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 20,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    },
    {
      "caption": "set solute concentration",
      "target": "set_solute",
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "target": "solute_name",
          "caption": "solute name",
          "type": "list",
          "custom_options": true,
          "choices": [
            "na",
            "k",
            "ca",
            "cl",
            "lact",
            "mg",
            "albumin",
            "phosphates",
            "uma",
            "hemoglobin"
          ]
        },
        {
          "target": "solute_value",
          "caption": "solute value",
          "type": "number",
          "default": 0,
          "factor": 1,
          "delta": 1,
          "rounding": 0,
          "ul": 1000,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance",
            "BloodVessel",
            "HeartChamber",
            "MicroVascularUnit",
            "BloodPump"
          ]
        }
      ]
    }
  ],
  "BloodCapacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "edit_mode": "basic",
      "caption": "fixed composition",
      "target": "fixed_composition",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "extra",
      "caption": "blood temperature (°C)",
      "target": "temp",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 1,
      "build_prop": true
    },
    {
      "edit_mode": "extra",
      "caption": "blood viscosity (cP)",
      "target": "viscosity",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "factors",
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor",
      "build_prop": false
    }
  ],
  "BloodDiffusor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygen diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "carbon dioxide diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "dif_solutes",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "solute diffusion constant",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "target": "comp_blood1",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "blood component 1",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "target": "comp_blood2",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "blood component 2",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "target": "dif_o2_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygen diffusion factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "solute diffusion factor",
      "target": "dif_solutes_factor_ps",
      "type": "factor",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": false
    }
  ],
  "BloodPump": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance pump (mmHg/L)",
      "target": "el_base",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "type": "number"
    },
    {
      "caption": "pump rpm",
      "target": "pump_rpm",
      "delta": 10,
      "factor": 1,
      "rounding": 1,
      "type": "number"
    },
    {
      "caption": "non linear elastance factor",
      "target": "el_k",
      "delta": 0.1,
      "factor": 0.001,
      "rounding": 3,
      "type": "number"
    },
    {
      "caption": "inlet blood resistor",
      "target": "inlet",
      "type": "list",
      "options": [
        "BloodResistor",
        "BloodVesselResistor",
        "HeartValve"
      ]
    },
    {
      "caption": "outlet blood resistor",
      "target": "outlet",
      "type": "list",
      "options": [
        "BloodResistor",
        "BloodVesselResistor",
        "HeartValve"
      ]
    }
  ],
  "BloodTimeVaryingElastance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "BloodVessel": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "edit_mode": "basic",
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "build_prop": true,
      "caption": "inputs",
      "target": "inputs",
      "type": "multiple-list",
      "options": [
        "BloodVessel",
        "BloodTimeVaryingElastance",
        "BloodCapacitance",
        "BloodPump"
      ]
    },
    {
      "edit_mode": "basic",
      "caption": "r_for (mmHg/L/s)",
      "target": "r_for",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "basic",
      "caption": "r_back (mmHg/L/s)",
      "target": "r_back",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "caption": "resistance-elastance coupling (0-1)",
      "target": "alpha",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "advanced",
      "caption": "ans sensitivity (0-1)",
      "target": "ans_sens",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": true
    },
    {
      "edit_mode": "factors",
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor",
      "build_prop": false
    },
    {
      "edit_mode": "factors",
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor",
      "build_prop": false
    }
  ],
  "Breathing": [
    {
      "target": "description",
      "type": "string",
      "edit_mode": "caption",
      "build_prop": true,
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "edit_mode": "all",
      "build_prop": true,
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "spont breathing enabled",
      "target": "breathing_enabled",
      "type": "boolean",
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "reference minute volume (L/kg/min)",
      "target": "minute_volume_ref",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "tidal volume - resp rate ratio",
      "target": "vt_rr_ratio",
      "type": "number",
      "delta": 0.001,
      "factor": 1000,
      "rounding": 4,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "insp/exp ratio",
      "target": "ie_ratio",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2,
      "edit_mode": "basic",
      "build_prop": true,
      "readonly": false
    },
    {
      "caption": "rmp gain max",
      "target": "rmp_gain_max",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false
    }
  ],
  "Capacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "fixed_composition",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "fixed composition"
    },
    {
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "unstressed volume (L)",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "target": "el_base",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "elastance baseline (mmHg/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "elastance non linear k",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "target": "u_vol_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "unstressed volume factor"
    },
    {
      "target": "el_base_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "elastance baseline factor"
    },
    {
      "target": "el_k_factor_ps",
      "type": "factor",
      "edit_mode": "factors",
      "caption": "elastance non linear  factor"
    }
  ],
  "Circulation": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "heart chambers",
      "target": "heart_chambers",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "HeartChamber",
        "BloodTimeVaryingElastance"
      ]
    },
    {
      "caption": "systemic arteries",
      "target": "systemic_arteries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic arterioles",
      "target": "systemic_arterioles",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic capillaries",
      "target": "systemic_capillaries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic venules",
      "target": "systemic_venules",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "systemic veins",
      "target": "systemic_veins",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary arteries",
      "target": "pulmonary_arteries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary arterioles",
      "target": "pulmonary_arterioles",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary capillaries",
      "target": "pulmonary_capillaries",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary venules",
      "target": "pulmonary_venules",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "pulmonary veins",
      "target": "pulmonary_veins",
      "type": "multiple-list",
      "edit_mode": "extra",
      "build_prop": true,
      "readonly": false,
      "options": [
        "BloodVessel"
      ]
    },
    {
      "caption": "svr factor (arterioles)",
      "target": "svr_factor_art",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "svr factor (venules)",
      "target": "svr_factor_ven",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "pvr factor (arterioles)",
      "target": "pvr_factor_art",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "pvr factor (venules)",
      "target": "pvr_factor_ven",
      "type": "factor",
      "delta": 0.1,
      "rounding": 1,
      "ll": -10,
      "ul": 10
    }
  ],
  "Container": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear  factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    },
    {
      "caption": "contained compartments",
      "target": "contained_components",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "multiple-list",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "HeartChamber",
        "GasCapacitance"
      ]
    }
  ],
  "Ecls": [
    {
      "target": "ecls_clamped",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "ECLS clamped"
    },
    {
      "caption": "drainage cannula resistance factor",
      "target": "drainage_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "return cannula resistance factor",
      "target": "return_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "tubing resistance factor",
      "target": "tubing_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "pump resistance factor",
      "target": "pump_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "oxygenator resistance factor",
      "target": "oxy_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "target": "drainage_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "drainage cannula resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "return_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "return cannula res (mmHg/(L/s))",
      "slider": true,
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "tubing_in_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tubing in resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "tubing_out_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tubing out resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "pump_res_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "pump forward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "pump_res_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "pump backward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "oxy_res_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygenator forward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "oxy_res_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "oxygenator backward resistance (mmHg/(L/s))",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "caption": "o2 diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "caption": "co2 dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    }
  ],
  "Fluids": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "add_volume",
      "caption": "Adminster fluid",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "volume (ml)",
          "target": "",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        },
        {
          "caption": "in time (s)",
          "target": "_default_time",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        },
        {
          "caption": "fluid type",
          "target": "fluid type",
          "type": "list",
          "default": "normal_saline",
          "choices": [
            "normal_saline",
            "ringers_lactate",
            "packed_cells",
            "albumin_20%"
          ]
        }
      ]
    }
  ],
  "Gas": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "atmospheric pressure (mmHg)",
      "target": "set_atmospheric_pressure",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new atmospheric pressure",
          "target": "pres_atm",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 5000,
          "ll": 100
        }
      ]
    },
    {
      "caption": "temperature (C)",
      "target": "set_temperature",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new temperature",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 100,
          "ll": -100
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    },
    {
      "caption": "humidity factor",
      "target": "set_humidity",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new humidity",
          "target": "humidity",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ul": 1,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    },
    {
      "caption": "fio2",
      "target": "set_fio2",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "function",
      "args": [
        {
          "caption": "new fio2",
          "target": "fio2",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ul": 1,
          "ll": 0
        },
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "GasCapacitance"
          ]
        }
      ]
    }
  ],
  "GasCapacitance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "fixed gas composition",
      "target": "fixed_composition",
      "type": "boolean"
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance baseline (mmHg/L)",
      "target": "el_base",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "target temperature (dgs C)",
      "target": "target_temp",
      "type": "number",
      "factor": 1,
      "delta": 0.1,
      "rounding": 1
    },
    {
      "caption": "atmospheric pressure (mmHg)",
      "target": "pres_atm",
      "type": "number",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance baseline factor",
      "target": "el_base_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "GasDiffusor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "oxygen diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "carbon dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "nitric oxide diffusion constant",
      "target": "dif_n2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "other gasses diffusion constant",
      "target": "dif_other",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "gas component 1",
      "target": "comp_gas1",
      "build_prop": true,
      "edit_mode": "basic",
      "type": "list",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "gas component 2",
      "target": "comp_gas2",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "oxygen diffusion factor",
      "target": "dif_o2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "nitric oxide diffusion factor",
      "target": "dif_n2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "other gasses diffusion factor",
      "target": "dif_other_factor_ps",
      "type": "factor"
    }
  ],
  "GasExchanger": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "oxygen diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "caption": "carbon dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4
    },
    {
      "caption": "gas component",
      "target": "comp_gas",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "blood component",
      "target": "comp_blood",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber"
      ]
    },
    {
      "caption": "oxygen diffusion factor",
      "target": "dif_o2_factor_ps",
      "type": "factor"
    },
    {
      "caption": "carbon dioxide diffusion factor",
      "target": "dif_co2_factor_ps",
      "type": "factor"
    }
  ],
  "HeadUpTilt": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "is_active",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tilt active"
    },
    {
      "target": "tilt_angle",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "tilt angle (deg)",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 90
    },
    {
      "target": "upper_column_cm",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "upper-body column height (cm)",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "target": "lower_column_cm",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "lower-body column height (cm)",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "target": "set_tilt_angle",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "set tilt angle",
      "args": [
        {
          "target": "angle",
          "caption": "angle (deg)",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 1,
          "rounding": 0,
          "ll": 0,
          "ul": 90
        }
      ]
    }
  ],
  "Heart": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "reference heart rate (bpm)",
      "target": "heart_rate_ref",
      "type": "number",
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 10,
      "ul": 300,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "pq time (ms)",
      "target": "pq_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 1000,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "qrs time (ms)",
      "target": "qrs_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 500,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "qt time (ms)",
      "target": "qt_time",
      "type": "number",
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 50,
      "ul": 1000,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "av delay time (ms)",
      "target": "av_delay",
      "type": "number",
      "delta": 0.1,
      "factor": 1000,
      "rounding": 1,
      "ll": 0.5,
      "ul": 10,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG P amplitude (mV)",
      "target": "p_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG Q amplitude (mV)",
      "target": "q_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG R amplitude (mV)",
      "target": "r_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG S amplitude (mV)",
      "target": "s_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "ECG T amplitude (mV)",
      "target": "t_amp",
      "type": "number",
      "factor": 1,
      "delta": 0.05,
      "rounding": 2,
      "ll": -5,
      "ul": 5,
      "readonly": false,
      "build_prop": true,
      "edit_mode": "extra"
    },
    {
      "caption": "heartrate factor",
      "target": "hr_factor",
      "type": "number",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 1000000
    },
    {
      "caption": "ans sensitivity",
      "target": "ans_sens",
      "type": "number",
      "edit_mode": "basic",
      "build_prop": true,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 1
    },
    {
      "caption": "systolic function factor left",
      "target": "cont_factor_left",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "systolic function factor right",
      "target": "cont_factor_right",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "diastolic function factor left",
      "target": "relax_factor_left",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "diastolic function factor right",
      "target": "relax_factor_right",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -20,
      "ul": 20
    },
    {
      "caption": "pericardial stiffness factor",
      "target": "pc_el_factor",
      "type": "factor",
      "edit_mode": "factors",
      "factor": 1,
      "delta": 0.1,
      "rounding": 2,
      "ll": 0,
      "ul": 200
    },
    {
      "caption": "pericardial fluid volume (mL)",
      "target": "pc_extra_volume",
      "type": "number",
      "edit_mode": "basic",
      "factor": 1000,
      "delta": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 1000
    }
  ],
  "HeartChamber": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "HeartValve": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "forward resistance",
      "target": "r_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "backward resistance",
      "target": "r_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "non linear resistance coefficient",
      "target": "r_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "type": "list",
      "caption": "comp from",
      "target": "comp_from",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "type": "list",
      "caption": "comp to",
      "target": "comp_to",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "factor"
    },
    {
      "caption": "non linear resistance coefficient factor",
      "target": "r_k_factor_ps",
      "type": "factor"
    },
    {
      "target": "is_externally_managed",
      "type": "boolean",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "externally managed"
    }
  ],
  "Kidneys": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    }
  ],
  "Metabolism": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "metabolism enabled",
      "target": "met_active",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "vo2 (ml/kg/min)",
      "target": "vo2",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "respiratory quotient",
      "target": "resp_q",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "set local fractional vo2",
      "target": "set_metabolic_active_model",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "type": "function",
      "args": [
        {
          "target": "site",
          "caption": "change in site",
          "type": "list",
          "custom_options": false,
          "options": [
            "BloodCapacitance",
            "BloodTimeVaryingElastance"
          ]
        },
        {
          "caption": "new fvo2",
          "target": "fvo2",
          "type": "number",
          "factor": 1,
          "default": 0,
          "delta": 0.01,
          "rounding": 2,
          "ul": 1,
          "ll": 0
        }
      ]
    }
  ],
  "Mob": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "myocardial oxygen balance",
      "target": "mob_active",
      "type": "boolean"
    },
    {
      "caption": "minimal to2 (mmol/l)",
      "target": "to2_min",
      "type": "number",
      "delta": 0.0001,
      "factor": 1,
      "rounding": 4
    },
    {
      "caption": "reference to2 (mmol/l)",
      "target": "to2_ref",
      "type": "number",
      "delta": 0.0001,
      "factor": 1,
      "rounding": 4
    },
    {
      "caption": "respiratory quotient",
      "target": "resp_q",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "basal mvo2 (mmol O2/g/s)",
      "target": "bm_vo2_per_g",
      "type": "number",
      "delta": 0.000001,
      "factor": 1,
      "rounding": 8
    },
    {
      "caption": "stroke-work mvo2 (mmol O2/g/(mmHg·mL))",
      "target": "sw_vo2_per_g",
      "type": "number",
      "delta": 1e-8,
      "factor": 1,
      "rounding": 10
    },
    {
      "caption": "heart weight intercept (g)",
      "target": "hw_intercept",
      "type": "number",
      "delta": 0.001,
      "factor": 1,
      "rounding": 3
    },
    {
      "caption": "heart weight slope (g per g body weight)",
      "target": "hw_slope",
      "type": "number",
      "delta": 0.000001,
      "factor": 1,
      "rounding": 6
    },
    {
      "caption": "heartrate factor min",
      "target": "hr_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "heartrate factor max",
      "target": "hr_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "heartrate time constant",
      "target": "hr_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "contractility factor min",
      "target": "cont_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "contractility factor max",
      "target": "cont_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "contractility time constant",
      "target": "cont_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    },
    {
      "caption": "ans factor min",
      "target": "ans_factor_min",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "ans factor max",
      "target": "ans_factor_max",
      "type": "number",
      "delta": 0.01,
      "factor": 1,
      "rounding": 2
    },
    {
      "caption": "ans time constant",
      "target": "ans_tc",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1
    }
  ],
  "Monitor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    }
  ],
  "Pda": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "ductus diameter (%)",
      "target": "diameter_relative",
      "type": "number",
      "delta": 1,
      "factor": 100,
      "rounding": 0,
      "ul": 100,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "slider": true
    },
    {
      "caption": "max diameter aortic ampulla (mm)",
      "target": "diameter_ao_max",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "max diameter pulmonary end (mm)",
      "target": "diameter_pa_max",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "ductus arteriosus length (mm)",
      "target": "length",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "baseline elastance (open duct, mmHg/L)",
      "target": "el_base",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "elastance-resistance coupling alpha",
      "target": "alpha",
      "type": "number",
      "delta": 0.05,
      "factor": 1,
      "rounding": 2,
      "ul": 1.5,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    },
    {
      "caption": "jet velocity exponent",
      "target": "jet_exponent",
      "type": "number",
      "delta": 0.1,
      "factor": 1,
      "rounding": 2,
      "ul": 3,
      "ll": 0,
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    }
  ],
  "Placenta": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "target": "placenta_running",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": false,
      "caption": "placenta model running"
    },
    {
      "target": "umb_clamped",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": false,
      "caption": "umbilical vessels clamped"
    },
    {
      "caption": "umb artery resistance factor",
      "target": "umb_art_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "umb vein resistance factor",
      "target": "umb_ven_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "fetal placenta resistance factor",
      "target": "plf_res_factor",
      "type": "factor",
      "delta": 0.01,
      "rounding": 2,
      "ll": 0,
      "ul": 10
    },
    {
      "target": "umb_art_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "umb artery resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "umb_ven_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "umb vein resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "target": "plf_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "fetal plac resistance (mmHg*s/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 100,
      "ul": 100000
    },
    {
      "caption": "o2 diffusion constant",
      "target": "dif_o2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "caption": "co2 dioxide diffusion constant",
      "target": "dif_co2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.0001,
      "rounding": 4,
      "ll": 0,
      "ul": 0.1
    },
    {
      "target": "mat_to2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "mat plac o2 content (mmol/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "target": "mat_tco2",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "mat plac co2 content (mmol/L)",
      "factor": 1,
      "delta": 1,
      "rounding": 0,
      "ll": 20,
      "ul": 30
    }
  ],
  "Resistor": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "no flow allowed",
      "target": "no_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "no back flow allowed",
      "target": "no_back_flow",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic"
    },
    {
      "caption": "forward resistance",
      "target": "r_for",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "backward resistance",
      "target": "r_back",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "caption": "non linear resistance coefficient",
      "target": "r_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "delta": 1,
      "factor": 1,
      "rounding": 0
    },
    {
      "type": "list",
      "caption": "comp from",
      "target": "comp_from",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "type": "list",
      "caption": "comp to",
      "target": "comp_to",
      "build_prop": true,
      "edit_mode": "basic",
      "options": [
        "BloodCapacitance",
        "BloodTimeVaryingElastance",
        "BloodPump",
        "BloodVessel",
        "MicroVascularUnit",
        "HeartChamber",
        "GasCapacitance"
      ]
    },
    {
      "caption": "resistance factor",
      "target": "r_factor_ps",
      "type": "factor"
    },
    {
      "caption": "non linear resistance coefficient factor",
      "target": "r_k_factor_ps",
      "type": "factor"
    },
    {
      "target": "is_externally_managed",
      "type": "boolean",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "externally managed"
    }
  ],
  "Respiration": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "lungs",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "target": "lungs",
      "type": "multiple-list",
      "options": [
        "GasCapacitance"
      ]
    },
    {
      "caption": "thorax",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "target": "thorax",
      "type": "multiple-list",
      "options": [
        "Container"
      ]
    },
    {
      "caption": "lung elastance factor",
      "target": "el_lungs_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "thorax elastance factor",
      "target": "el_thorax_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -10,
      "ul": 10
    },
    {
      "caption": "upper airway resistance factor",
      "target": "res_upper_airways_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    },
    {
      "caption": "lower airway resistance factor",
      "target": "res_lower_airways_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    },
    {
      "caption": "gasexchange factor",
      "target": "gex_factor",
      "type": "factor",
      "build_prop": true,
      "edit_mode": "factors",
      "readonly": false,
      "factor": 1,
      "delta": 0.01,
      "rounding": 2,
      "ll": -100,
      "ul": 100
    }
  ],
  "Resuscitation": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "switch cpr on/off",
      "target": "switch_cpr",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "state",
          "target": "cpr_enabled",
          "type": "boolean"
        }
      ]
    },
    {
      "caption": "chest compressions frequency (/min)",
      "target": "chest_comp_freq",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 10,
      "ul": 150
    },
    {
      "caption": "chest compressions pressure (mmHg)",
      "target": "chest_comp_max_pres",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 500
    },
    {
      "caption": "no of chest compressions (/cycle)",
      "target": "chest_comp_no",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "continuous compressions",
      "target": "chest_comp_cont",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false
    },
    {
      "caption": "ventilation frequency (/min)",
      "target": "vent_freq",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "no of ventilation (/cycle)",
      "target": "vent_no",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "ventilation peak pressure (cmH2O)",
      "target": "vent_pres_pip",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 50
    },
    {
      "caption": "ventilation peep (cmH2O)",
      "target": "vent_pres_peep",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "ventilation inspiration time (s)",
      "target": "vent_insp_time",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0.1,
      "ul": 5
    },
    {
      "caption": "set cpr fio2",
      "target": "set_fio2",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new fio2",
          "target": "vent_fio2",
          "type": "number",
          "delta": 0.01,
          "factor": 1,
          "ul": 1,
          "ll": 0,
          "rounding": 2
        }
      ]
    }
  ],
  "Shunts": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "foramen ovale diameter (mm)",
      "target": "diameter_fo",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "slider": true,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "ventricular septal defect diameter (mm)",
      "target": "diameter_vsd",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "slider": true,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "intrapulmonary shunt resistance",
      "target": "ips_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "slider": true,
      "ll": 10,
      "ul": 50000
    },
    {
      "caption": "atrial septum width (mm)",
      "target": "atrial_septal_width",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "ventricular septum width (mm)",
      "target": "ventricular_septal_width",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 10
    },
    {
      "caption": "foramen ovale L-R resistance factor",
      "target": "fo_lr_factor",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "intrapulmonary shunt resistance (mmHg*s/L)",
      "target": "ips_res",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 100,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100000000
    }
  ],
  "TimeVaryingElastance": [
    {
      "target": "model_type",
      "type": "string",
      "build_prop": false,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "model type"
    },
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "volume (L)",
      "target": "vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "unstressed volume (L)",
      "target": "u_vol",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 0.001,
      "rounding": 3
    },
    {
      "caption": "elastance minimum (mmHg/L)",
      "target": "el_min",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance maximum (mmHg/L)",
      "target": "el_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "elastance non linear k",
      "target": "el_k",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "factor": 1,
      "delta": 1,
      "rounding": 0
    },
    {
      "caption": "unstressed volume factor",
      "target": "u_vol_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance minimum baseline factor",
      "target": "el_min_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance maximum baseline factor",
      "target": "el_max_factor_ps",
      "type": "factor"
    },
    {
      "caption": "elastance non linear factor",
      "target": "el_k_factor_ps",
      "type": "factor"
    }
  ],
  "Ventilator": [
    {
      "target": "description",
      "type": "string",
      "build_prop": true,
      "edit_mode": "caption",
      "readonly": true,
      "caption": "description"
    },
    {
      "target": "is_enabled",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "all",
      "readonly": false,
      "caption": "enabled"
    },
    {
      "caption": "switch ventilator on/off",
      "target": "switch_ventilator",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "state",
          "target": "is_enabled",
          "type": "boolean"
        }
      ]
    },
    {
      "caption": "endotracheal tube diameter (mm)",
      "target": "set_ettube_diameter",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new diameter (mm)",
          "target": "ettube_diameter",
          "type": "number",
          "factor": 1,
          "delta": 0.5,
          "rounding": 1
        }
      ]
    },
    {
      "caption": "endotracheal tube length (mm)",
      "target": "set_ettube_length",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new length (mm)",
          "target": "ettube_length",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1
        }
      ]
    },
    {
      "caption": "fio2",
      "target": "set_fio2",
      "type": "function",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "args": [
        {
          "caption": "new fio2",
          "target": "fio2",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ll": 0.21,
          "ul": 1
        }
      ]
    },
    {
      "caption": "humidity",
      "target": "set_humidity",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new humidity",
          "target": "humidity",
          "type": "number",
          "factor": 1,
          "delta": 0.01,
          "rounding": 2,
          "ll": 0,
          "ul": 1
        }
      ]
    },
    {
      "caption": "temperature (C)",
      "target": "set_temp",
      "type": "function",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "args": [
        {
          "caption": "new temp (C)",
          "target": "temp",
          "type": "number",
          "factor": 1,
          "delta": 0.1,
          "rounding": 1,
          "ll": 0,
          "ul": 1
        }
      ]
    },
    {
      "caption": "ventilator mode",
      "target": "vent_mode",
      "type": "list",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "options": [],
      "choices": [
        "PC",
        "PRVC",
        "PS"
      ]
    },
    {
      "caption": "ventilator rate (/min)",
      "target": "vent_rate",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 100
    },
    {
      "caption": "inspiration time (s)",
      "target": "insp_time",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0.1,
      "ul": 5
    },
    {
      "caption": "inspiratory flow (l/min)",
      "target": "insp_flow",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "expiratory flow (l/min)",
      "target": "exp_flow",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "tidal volume (mL)",
      "target": "tidal_volume",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1000,
      "rounding": 0,
      "ll": 1,
      "ul": 500
    },
    {
      "caption": "peak inspiratory pressure (cmH2O)",
      "target": "pip_cmh2o",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 5,
      "ul": 50
    },
    {
      "caption": "max peak inspiratory pressure (cmH2O)",
      "target": "pip_cmh2o_max",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 5,
      "ul": 50
    },
    {
      "caption": "positive end expiratory pressure (cmH2O)",
      "target": "peep_cmh2o",
      "type": "number",
      "build_prop": true,
      "edit_mode": "basic",
      "readonly": false,
      "delta": 1,
      "factor": 1,
      "rounding": 0,
      "ll": 0,
      "ul": 20
    },
    {
      "caption": "trigger volume percentage (%)",
      "target": "trigger_volume_perc",
      "type": "number",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false,
      "delta": 0.1,
      "factor": 1,
      "rounding": 1,
      "ll": 5,
      "ul": 20
    },
    {
      "caption": "synchronized ventilation",
      "target": "synchronized",
      "type": "boolean",
      "build_prop": true,
      "edit_mode": "extra",
      "readonly": false
    }
  ]
};

// Resolve the editable interface for a given model_type (empty if unknown).
export function getInterfaceForType(modelType: string): InterfaceField[] {
  return MODEL_INTERFACES[modelType] ?? [];
}
