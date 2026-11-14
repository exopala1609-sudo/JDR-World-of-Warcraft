// Televersement d'une image de carte par le MJ, depuis l'interface de jeu.
//
//   POST /api/cartes?nom=foret-elwynn.jpg     (en-tete Authorization : Bearer <jeton du MJ>)
//   corps : l'image elle-meme (png, jpg, webp ou gif)
//
// L'image est ecrite dans le dossier cartes/ de TON cloud (VTT_ASSETS) : elle
// est donc aussi disponible depuis ton autre PC, comme celles que tu y deposes
// a la main. Protections :
//   - reserve au MJ (jeton verifie par le serveur, pas par le navigateur) ;
//   - taille limitee ; type verifie sur les PREMIERS OCTETS du fichier (une
//     page web deguisee en .png est refusee) ; pas de SVG (il peut contenir
//     du code) ;
//   - nom de fichier nettoye (ni dossier, ni "..") ; jamais d'ecrasement :
//     "foret.jpg" existe deja -> "foret-2.jpg".
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import express from "express";
import { exigerMJ } from "./auth/routes.js";

export const TAILLE_MAX_CARTE = 40 * 1024 * 1024; // 40 Mo : une grande carte de combat en jpg

// Signature (premiers octets) de chaque format accepte.
const FORMATS = [
  { extension: "png", signature: [0x89, 0x50, 0x4e, 0x47] },
  { extension: "jpg", signature: [0xff, 0xd8, 0xff] },
  { extension: "gif", signature: [0x47, 0x49, 0x46, 0x38] },
  { extension: "webp", signature: [0x52, 0x49, 0x46, 0x46], suite: { position: 8, octets: [0x57, 0x45, 0x42, 0x50] } },
];

/** Le format reel de l'image, d'apres son contenu (pas d'apres son nom). */
export function formatImage(octets) {
  const commencePar = (sig, position = 0) => sig.every((o, i) => octets[position + i] === o);
  return FORMATS.find((f) => commencePar(f.signature) && (!f.suite || commencePar(f.suite.octets, f.suite.position)))?.extension ?? null;
}

/** "Foret d'Elwynn (nuit).JPG" -> "foret-d-elwynn-nuit" */
export function nomPropre(nom) {
  const base = String(nom ?? "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return base || "carte";
}

export function routesTeleversement(config, sessions) {
  const routeur = express.Router();
  routeur.post(
    "/api/cartes",
    exigerMJ(sessions),
    express.raw({ type: () => true, limit: TAILLE_MAX_CARTE }),
    (requete, reponse) => {
      const octets = requete.body;
      if (!Buffer.isBuffer(octets) || octets.length === 0) return reponse.status(400).json({ erreur: "Aucune image recue." });
      const extension = formatImage(octets);
      if (!extension) return reponse.status(415).json({ erreur: "Format refuse : png, jpg, webp ou gif uniquement." });

      const dossier = config.dossiers.cartes;
      if (!existsSync(dossier)) return reponse.status(500).json({ erreur: "Dossier cartes/ introuvable (verifie VTT_ASSETS)." });
      const base = nomPropre(requete.query.nom);
      let fichier = `${base}.${extension}`;
      for (let n = 2; existsSync(join(dossier, fichier)); n++) fichier = `${base}-${n}.${extension}`;

      // Ecriture "atomique" : un fichier temporaire, puis renommage (jamais d'image a moitie ecrite).
      const temporaire = join(dossier, `.${fichier}.televersement`);
      writeFileSync(temporaire, octets);
      renameSync(temporaire, join(dossier, fichier));
      console.log(`[cartes] Image televersee par le MJ : ${fichier} (${Math.round(octets.length / 1024)} Ko).`);
      reponse.json({ fichier });
    },
  );
  // Image trop lourde : message clair plutot qu'une erreur brute.
  routeur.use("/api/cartes", (erreur, _requete, reponse, suite) => {
    if (erreur?.type === "entity.too.large") return reponse.status(413).json({ erreur: "Image trop lourde (40 Mo maximum)." });
    suite(erreur);
  });
  return routeur;
}
