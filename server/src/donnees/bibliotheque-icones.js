// La bibliotheque d'icones : la liste des NOMS des images du dossier icones/
// (qui peut en contenir des dizaines de milliers : toutes celles de WoW).
//
// Le dossier n'est lu qu'UNE fois (au premier besoin), puis la liste reste en
// memoire : une recherche parmi 40 000 noms prend quelques millisecondes.
// Bouton "Actualiser" du selecteur : on relit le dossier (icones ajoutees).
// Le serveur ne renvoie jamais la liste entiere : seulement les resultats
// d'une recherche, limites (le navigateur n'affiche que ce qu'on cherche).
import { readdir } from "node:fs/promises";
import { extname } from "node:path";

const EXTENSIONS = new Set([".png", ".webp", ".jpg", ".jpeg", ".gif"]);
export const RESULTATS_MAX = 240;

export function creerBibliothequeIcones(dossier) {
  let liste = null; // Promise<{ noms: string[], minuscules: string[] }>

  function lire() {
    liste ??= (async () => {
      if (!dossier) return { noms: [], minuscules: [] };
      let entrees = [];
      try {
        entrees = await readdir(dossier, { withFileTypes: true });
      } catch {
        return { noms: [], minuscules: [] };
      }
      const vus = new Set();
      const noms = [];
      for (const e of entrees) {
        if (!e.isFile() || !EXTENSIONS.has(extname(e.name).toLowerCase())) continue;
        const nom = e.name.slice(0, -extname(e.name).length);
        // Le nom doit etre utilisable comme "icone" (meme regle que le compendium).
        if (!/^[A-Za-z0-9_-]{1,80}$/.test(nom) || vus.has(nom.toLowerCase())) continue;
        vus.add(nom.toLowerCase());
        noms.push(nom);
      }
      noms.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
      return { noms, minuscules: noms.map((n) => n.toLowerCase()) };
    })();
    return liste;
  }

  return {
    /** Relit le dossier (apres un ajout d'icones). */
    actualiser() {
      liste = null;
      return lire();
    },

    /**
     * Les icones dont le nom contient TOUS les mots cherches ("fire ball" ->
     * spell_fire_fireball02). Celles qui COMMENCENT par la recherche d'abord.
     */
    async chercher(recherche, limite = RESULTATS_MAX) {
      const { noms, minuscules } = await lire();
      const mots = String(recherche ?? "").toLowerCase().split(/[\s,]+/).filter(Boolean);
      const debut = mots.join("_");
      const trouves = [];
      for (let i = 0; i < noms.length; i++) {
        if (mots.every((m) => minuscules[i].includes(m))) trouves.push(i);
      }
      if (debut) trouves.sort((a, b) => Number(!minuscules[a].startsWith(debut)) - Number(!minuscules[b].startsWith(debut)) || a - b);
      return { total: noms.length, trouves: trouves.length, icones: trouves.slice(0, limite).map((i) => noms[i]) };
    },
  };
}
