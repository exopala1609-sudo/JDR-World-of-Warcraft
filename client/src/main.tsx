import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
// Ordre des feuilles de style : le theme (variables) d'abord, puis ce qui l'utilise.
import "@/styles/theme.css";
import "@/styles/base.css";
import "@/styles/composants.css";
import "@/styles/hud.css";
import "@/styles/fenetres.css";
import "@/styles/ecrans.css";
import "@/styles/creation.css";
import "@/styles/livres.css";
import "@/styles/resolution.css";
import "@/styles/outils.css";

const racine = document.getElementById("racine");
if (!racine) throw new Error("Element #racine introuvable dans index.html");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
