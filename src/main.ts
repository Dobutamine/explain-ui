import { createApp } from "vue";
import { createPinia } from "pinia";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import { definePreset } from "@primevue/themes";
import Tooltip from "primevue/tooltip";
import ConfirmationService from "primevue/confirmationservice";

import App from "./App.vue";
import router from "./router";

import "primeicons/primeicons.css";
import "./styles/theme.css";

// Aura ships with an emerald (green) primary. Remap the primary palette to blue
// and make the dark-mode accent a deep blue so buttons/selectors read dark blue.
const DarkBlue = definePreset(Aura, {
  semantic: {
    primary: {
      50: "{blue.50}",
      100: "{blue.100}",
      200: "{blue.200}",
      300: "{blue.300}",
      400: "{blue.400}",
      500: "{blue.500}",
      600: "{blue.600}",
      700: "{blue.700}",
      800: "{blue.800}",
      900: "{blue.900}",
      950: "{blue.950}",
    },
    colorScheme: {
      dark: {
        primary: {
          color: "{blue.600}",
          contrastColor: "#ffffff",
          hoverColor: "{blue.500}",
          activeColor: "{blue.400}",
        },
      },
    },
  },
});

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PrimeVue, {
    theme: { preset: DarkBlue, options: { darkModeSelector: ".dark" } },
  })
  .use(ConfirmationService)
  .directive("tooltip", Tooltip)
  .mount("#app");
