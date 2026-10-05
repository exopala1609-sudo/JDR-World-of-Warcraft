// La bibliotheque d'icones : la liste des NOMS des images du dossier icones/
// (qui peut en contenir des dizaines de milliers : toutes celles de WoW).
//
// Le dossier n'est lu qu'UNE fois (au premier besoin), puis la liste reste en
// memoire : une recherche parmi 40 000 noms prend quelques millisecondes.
// Bouton "Actualiser" du selecteur : on relit le dossier (icones ajoutees).
// Le serveur ne renvoie jamais la liste entiere : seulement les resultats
// d'une recherche, limites (le navigateur n'affiche que ce qu'on cherche).
//
// Les sous-dossiers sont fouilles (jusqu'a 4 niveaux) : un dossier copie tel
// quel ("WoW-Icones\ICONS\inv_sword_04.png") marche aussi. Les majuscules ne
// comptent pas (inv_sword_04 = INV_Sword_04). Le serveur s'en sert aussi pour
// trouver le fichier d'une icone a afficher (voir medias.js).
import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif"]);
const PROFONDEUR_MAX = 4;
export const RESULTATS_MAX = 240;

const VIDE = { noms: [], minuscules: [], chemins: new Map(), blp: 0, autres: 0, sousDossiers: 0 };
const partagees = new Map(); // un seul catalogue par dossier : affichage, selecteur, diagnostic

/** Le catalogue partage d'un dossier (le serveur ne le lit qu'une fois pour tous). */
export function bibliothequeIcones(dossier) {
  const cle = dossier ?? "";
  if (!partagees.has(cle)) partagees.set(cle, creerBibliothequeIcones(dossier));
  return partagees.get(cle);
}

/** Un catalogue neuf (les tests en creent un par dossier temporaire). */
export function creerBibliothequeIcones(dossier) {
  let liste = null; // Promise<{ noms, minuscules, chemins, blp, autres, sousDossiers }>
  let luLe = 0;

  function lire() {
    if (!liste) luLe = Date.now();
    liste ??= (async () => {
      if (!dossier) return VIDE;
      const resultat = { noms: [], minuscules: [], chemins: new Map(), blp: 0, autres: 0, sousDossiers: 0 };
      const parcourir = async (chemin, profondeur) => {
        let entrees = [];
        try {
          entrees = await readdir(chemin, { withFileTypes: true });
        } catch {
          return;
        }
        for (const e of entrees) {
          if (e.name.startsWith(".")) continue;
          const complet = join(chemin, e.name);
          if (e.isDirectory()) {
            if (profondeur < PROFONDEUR_MAX) {
              resultat.sousDossiers++;
              await parcourir(complet, profondeur + 1);
            }
            continue;
          }
          if (!e.isFile()) continue;
          const extension = extname(e.name).toLowerCase();
          if (extension === ".blp") resultat.blp++; // format interne du jeu : illisible par un navigateur
          if (!EXTENSIONS.has(extension)) {
            if (extension !== ".blp" && e.name !== "LISEZ-MOI.txt") resultat.autres++;
            continue;
          }
          const nom = e.name.slice(0, -extension.length);
          const minuscule = nom.toLowerCase();
          // Le nom doit etre utilisable comme "icone" (meme regle que le compendium).
          if (!/^[A-Za-z0-9_-]{1,80}$/.test(nom) || resultat.chemins.has(minuscule)) continue;
          resultat.chemins.set(minuscule, complet);
          resultat.noms.push(nom);
        }
      };
      await parcourir(dossier, 0);
      resultat.noms.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      resultat.minuscules = resultat.noms.map((n) => n.toLowerCase());
      return resultat;
    })();
    return liste;
  }

  return {
    /** Relit le dossier (apres un ajout d'icones). */
    actualiser() {
      liste = null;
      return lire();
    },

    /** Le fichier d'une icone d'apres son nom sans extension (majuscules indifferentes), ou null. */
    async chemin(nom) {
      const cle = String(nom).toLowerCase();
      const trouve = (await lire()).chemins.get(cle);
      if (trouve) return trouve;
      // Absente : le dossier a peut-etre change depuis (icones ajoutees). On le
      // relit, au plus une fois par minute (une page peut demander 50 icones absentes).
      if (Date.now() - luLe < 60_000) return null;
      liste = null;
      return (await lire()).chemins.get(cle) ?? null;
    },

    /** Pour le diagnostic du demarrage : ce que contient le dossier. */
    async etat() {
      const { noms, blp, autres, sousDossiers } = await lire();
      return { images: noms.length, blp, autres, sousDossiers };
    },

    /**
     * Les icones dont le nom contient TOUS les mots cherches ("fire ball" ->
     * spell_fire_fireball02). Celles qui COMMENCENT par la recherche d'abord.
     */
    async chercher(recherche, limite = RESULTATS_MAX, depuis = 0) {
      const { noms, minuscules } = await lire();
      const mots = String(recherche ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);
      const debut = mots.join("_");
      const trouves = [];
      for (let i = 0; i < noms.length; i++) {
        if (mots.every((m) => minuscules[i].includes(m))) trouves.push(i);
      }
      if (debut) trouves.sort((a, b) => Number(!minuscules[a].startsWith(debut)) - Number(!minuscules[b].startsWith(debut)) || a - b);
      // "debut" : la galerie parcourt les resultats page par page.
      const depart = Math.max(0, Math.min(depuis, Math.max(0, trouves.length - 1)));
      return { total: noms.length, trouves: trouves.length, debut: depart, icones: trouves.slice(depart, depart + limite).map((i) => noms[i]) };
    },
  };
}
