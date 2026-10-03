// Service des images (cartes, jetons, portraits, icones) depuis ton dossier.
//
// Si l'image demandee n'existe pas (encore), le serveur repond par une image
// de remplacement : un carre gris portant le nom attendu. L'interface ne
// "casse" donc jamais, et des que tu deposes le vrai fichier dans le dossier,
// il s'affiche a la place (sans redemarrer).
//
// Une image peut etre demandee SANS extension (ex. /medias/icones/epee-longue) :
// le serveur cherche alors epee-longue.png, .webp, .jpg... C'est ce qui permet
// au compendium de parler d'icones sans se soucier du format du fichier.
import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";
import express from "express";
import { CATEGORIES_PUBLIQUES } from "./config.js";
import { bibliothequeIcones } from "./donnees/bibliotheque-icones.js";

const EXTENSIONS_IMAGE = [".png", ".webp", ".jpg", ".jpeg", ".gif", ".svg"];
export const EXTENSIONS_SON = [".ogg", ".mp3", ".wav", ".m4a", ".webm"];
// Categories d'images : un fichier absent y est remplace par un carre gris.
// (Les polices, elles, repondent "introuvable" : le navigateur passe alors a
// la police de substitution.)
const CATEGORIES_IMAGES = ["cartes", "jetons", "portraits", "icones"];

const REMPLACEMENTS = {
  cartes: { largeur: 2000, hauteur: 2000, titre: "Carte introuvable" },
  jetons: { largeur: 256, hauteur: 256, titre: "Jeton" },
  portraits: { largeur: 256, hauteur: 256, titre: "Portrait" },
  icones: { largeur: 64, hauteur: 64, titre: "?" },
};

const echapperXml = (texte) =>
  String(texte).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

// Carte d'entrainement : on y dessine une "fausse" grille, volontairement
// decalee (cases de 90 px, depart en 30 / 55), comme sur une vraie carte
// achetee. Le MJ peut s'exercer a caler la grille virtuelle dessus.
const GRILLE_DESSINEE = { taille: 90, decalageX: 30, decalageY: 55 };

function grilleDessinee(largeur, hauteur) {
  const { taille, decalageX, decalageY } = GRILLE_DESSINEE;
  const lignes = [];
  for (let x = decalageX; x <= largeur; x += taille) lignes.push(`M${x} 0V${hauteur}`);
  for (let y = decalageY; y <= hauteur; y += taille) lignes.push(`M0 ${y}H${largeur}`);
  return `<path d="${lignes.join("")}" stroke="#666" stroke-width="3" fill="none"/>`;
}

export function imageDeRemplacement(categorie, nom) {
  const { largeur, hauteur } = REMPLACEMENTS[categorie];
  // "aucune-carte" : la carte de test, tant que le MJ n'a choisi aucune image.
  const carteDeTest = categorie === "cartes" && nom === "aucune-carte";
  const titre = carteDeTest ? "Carte de test" : REMPLACEMENTS[categorie].titre;
  if (carteDeTest) nom = "Depose tes images dans le dossier cartes/";
  const petite = largeur <= 64;
  const texte = petite
    ? `<text x="50%" y="58%" font-size="28" text-anchor="middle" fill="#bbb" font-family="sans-serif">?</text>`
    : `<text x="50%" y="46%" font-size="${largeur / 16}" text-anchor="middle" fill="#ddd" font-family="sans-serif">${echapperXml(titre)}</text>
       <text x="50%" y="58%" font-size="${largeur / 28}" text-anchor="middle" fill="#aaa" font-family="sans-serif">${echapperXml(nom).slice(0, 60)}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}">
  <rect width="100%" height="100%" fill="#777"/>
  ${categorie === "cartes" ? grilleDessinee(largeur, hauteur) : ""}
  <rect x="2" y="2" width="${largeur - 4}" height="${hauteur - 4}" fill="none" stroke="#555" stroke-width="4"/>
  ${texte}
</svg>`;
}

// Un nom de fichier simple : ni dossier, ni "..", ni caractere nul.
const nomSur = (nom) => nom && basename(nom) === nom && nom !== ".." && !nom.includes("\0");

export function routesMedias(config) {
  const routeur = express.Router();
  const interfaceWow = creerIndexInterface(config.dossiers.interface);

  // La liste des textures du dossier interface/ : le navigateur y cherche
  // celles qu'il sait utiliser (bouton de fermeture, bordures...).
  routeur.get("/api/interface", (_requete, reponse) => {
    reponse.set("Cache-Control", "no-store").json({ fichiers: interfaceWow.lister() });
  });

  for (const categorie of CATEGORIES_PUBLIQUES) {
    const dossier = config.dossiers[categorie];

    // 1. Le fichier existe tel quel : on l'envoie. (Sous-dossiers permis, ex.
    //    /medias/interface/Buttons/UI-Quickslot2.png ; express.static refuse
    //    tout chemin qui tenterait de sortir du dossier avec "..".)
    routeur.use(`/medias/${categorie}`, express.static(dossier, { maxAge: "1h", dotfiles: "ignore" }));

    // Sons : demandes sans extension (/medias/sons/murmure -> murmure.ogg, .mp3...).
    // Absent : "introuvable" ; le navigateur joue alors son son de remplacement.
    if (categorie === "sons") {
      routeur.get("/medias/sons/:nom", (requete, reponse) => {
        const { nom } = requete.params;
        if (nomSur(nom) && !extname(nom)) {
          for (const extension of EXTENSIONS_SON) {
            const chemin = join(dossier, nom + extension);
            if (existsSync(chemin)) return reponse.sendFile(chemin, { maxAge: 0 });
          }
        }
        reponse.set("Cache-Control", "no-store").status(404).end();
      });
      continue;
    }

    if (!CATEGORIES_IMAGES.includes(categorie)) continue;

    // 2. Sinon : recherche sans extension, puis image de remplacement.
    routeur.get(`/medias/${categorie}/:nom`, async (requete, reponse) => {
      const { nom } = requete.params;
      if (nomSur(nom) && !extname(nom)) {
        for (const extension of EXTENSIONS_IMAGE) {
          const chemin = join(dossier, nom + extension);
          if (existsSync(chemin)) return reponse.sendFile(chemin, { maxAge: "1h" });
        }
      }
      // Icones : elles peuvent etre rangees dans des sous-dossiers, avec d'autres
      // majuscules (WoW-Icones\ICONS\inv_sword_04.png pour "INV_Sword_04").
      if (categorie === "icones" && nomSur(nom)) {
        const trouve = await bibliothequeIcones(dossier).chemin(extname(nom) ? nom.slice(0, -extname(nom).length) : nom);
        if (trouve) return reponse.sendFile(trouve, { maxAge: "1h" });
      }
      // "?remplacement=non" : pour un decor facultatif (ex. griffons de la
      // barre d'actions), on prefere "introuvable" : l'interface garde alors
      // son dessin par defaut.
      if (requete.query.remplacement === "non") return reponse.status(404).end();
      // Icone absente : le point d'interrogation de WoW, s'il est dans interface/.
      const inconnue = categorie === "icones" && interfaceWow.trouver("WoWUnknownItem01");
      if (inconnue) return reponse.set("Cache-Control", "no-store").sendFile(inconnue);
      // "no-store" : le navigateur ne garde pas le carre gris en memoire,
      // pour afficher le vrai fichier des qu'il sera depose.
      reponse.set("Cache-Control", "no-store").type("image/svg+xml").send(imageDeRemplacement(categorie, nom));
    });
  }

  // Tout autre fichier absent (une police, par ex.) : "introuvable", et surtout
  // pas la page du jeu (le navigateur passe alors a la police de substitution).
  routeur.use("/medias", (_requete, reponse) => reponse.status(404).end());
  return routeur;
}

/**
 * Le dossier interface/ : les textures de WoW, rangees comme on veut (a plat
 * ou dans leurs sous-dossiers d'origine, "Buttons/UI-Quickslot2.png"). La
 * liste est relue au plus toutes les 10 secondes : un fichier depose pendant
 * la partie est vu sans redemarrer.
 */
export function creerIndexInterface(dossier) {
  let fichiers = [];
  let lu = 0;
  const lire = () => {
    if (Date.now() - lu < 10_000) return fichiers;
    lu = Date.now();
    fichiers = [];
    const parcourir = (chemin, profondeur) => {
      let entrees = [];
      try {
        entrees = readdirSync(chemin, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entrees) {
        if (e.name.startsWith(".") || fichiers.length >= 5000) continue;
        const complet = join(chemin, e.name);
        if (e.isDirectory() && profondeur < 4) parcourir(complet, profondeur + 1);
        else if (e.isFile() && EXTENSIONS_IMAGE.includes(extname(e.name).toLowerCase())) fichiers.push(relative(dossier, complet).split(sep).join("/"));
      }
    };
    parcourir(dossier, 0);
    fichiers.sort((a, b) => a.localeCompare(b, "fr"));
    return fichiers;
  };
  return {
    lister: lire,
    /** Chemin complet d'une texture d'apres son nom SANS extension, majuscules indifferentes. */
    trouver(nom) {
      const cherche = nom.toLowerCase();
      const trouve = lire().find((f) => basename(f, extname(f)).toLowerCase() === cherche);
      return trouve ? join(dossier, trouve) : null;
    },
  };
}

/** Liste les images (ou les sons) d'une categorie (pour que le MJ choisisse une carte, un son...). */
export function listerImages(config, categorie) {
  const extensions = categorie === "sons" ? EXTENSIONS_SON : EXTENSIONS_IMAGE;
  if (!CATEGORIES_IMAGES.includes(categorie) && categorie !== "sons") return [];
  try {
    return readdirSync(config.dossiers[categorie], { withFileTypes: true })
      .filter((e) => e.isFile() && extensions.includes(extname(e.name).toLowerCase()))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, "fr"));
  } catch {
    return [];
  }
}
