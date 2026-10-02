import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { chargerTextures } from "@/core/textures";
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
import "@/styles/textures.css"; // en dernier : les textures de WoW remplacent le dessin CSS

// Les textures de WoW du dossier interface/ (s'il y en a) : branchees des
// qu'elles sont lues, sans retarder l'affichage.
chargerTextures();

const racine = document.getElementById("racine");
if (!racine) throw new Error("Element #racine introuvable dans index.html");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
