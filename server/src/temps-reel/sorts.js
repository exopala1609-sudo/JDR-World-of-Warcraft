// Domaine "sorts" : le MJ cree ou modifie ses sorts depuis le Compendium du jeu.
//
// Ils sont ecrits dans compendium/mes-sorts.json (meme format que les autres
// fichiers du compendium, voir docs/COMPENDIUM.md), que le MJ peut aussi ouvrir
// au Bloc-notes. Les sorts de SES fichiers a lui ne sont jamais reecrits : pour
// en changer un, le formulaire en fait une copie ("Dupliquer pour modifier").
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EVENEMENTS } from "../../../shared/protocole.js";
import { FICHIER_SORTS_MJ } from "../donnees/compendium.js";
import { lireJsonCommente } from "../fichiers.js";
import { SchemaEntreeSort, schemaIdCompendium } from "../modeles/compendium.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import { identifiantDepuisNom } from "./bestiaire.js";
import { SALLE_MJ } from "./index.js";

const Enregistrer = z.strictObject({
  sort: z.record(z.string(), z.unknown()), // verifie ensuite par le schema du compendium
  remplace: schemaIdCompendium.optional(), // modification : l'identifiant d'origine
});
const Supprimer = z.strictObject({ idSort: schemaIdCompendium });

const EnTete = `// =============================================================================
//  MES SORTS : crees ou modifies depuis le Compendium du jeu.
// =============================================================================
//  Ce fichier est ecrit par le jeu, mais tu peux aussi le modifier au
//  Bloc-notes (meme format que exemple-sorts.json, voir docs/COMPENDIUM.md).
//  Apres une modification a la main : bouton "Recharger" du MJ.
// =============================================================================
`;

export function brancher(socket, ctx) {
  const { compendium } = ctx;
  const chemin = () => join(compendium.dossier, FICHIER_SORTS_MJ);

  /** Les sorts deja ecrits dans mes-sorts.json (tels quels, meme mal ecrits). */
  function lireMesSorts() {
    if (!existsSync(chemin())) return [];
    const contenu = lireJsonCommente(chemin());
    return Array.isArray(contenu?.sorts) ? contenu.sorts : [];
  }
  /** Ecriture sure (fichier temporaire puis renommage), avec son mode d'emploi en tete. */
  function ecrireMesSorts(liste) {
    const provisoire = `${chemin()}.tmp-${process.pid}`;
    writeFileSync(provisoire, `${EnTete}${JSON.stringify({ sorts: liste }, null, 2)}\n`, "utf8");
    renameSync(provisoire, chemin());
  }
  function recharger() {
    const rapport = compendium.charger();
    ctx.io.to(SALLE_MJ).emit(EVENEMENTS.COMPENDIUM_MAJ, { rapport });
  }

  ctx.guichet(socket, EVENEMENTS.SORT_ENREGISTRER, Enregistrer, ({ sort, remplace }) => {
    ctx.exigerMJ(socket, "modifier les sorts du compendium");
    const brut = { ...sort, id: sort.id || identifiantDepuisNom(sort.nom ?? "") };
    const resultat = SchemaEntreeSort.safeParse(brut);
    if (!resultat.success) {
      throw new ErreurRegle(resultat.error.issues.map((i) => `${i.path.join(".") || "sort"} : ${i.message}`).join(" ; "));
    }
    const entree = resultat.data;
    const ailleurs = compendium.fichierDuSort(entree.id);
    if (ailleurs && ailleurs !== FICHIER_SORTS_MJ) {
      throw new ErreurRegle(`L'identifiant "${entree.id}" est deja pris par ${ailleurs} : choisis un autre nom.`);
    }
    const liste = lireMesSorts().filter((s) => s?.id !== entree.id && s?.id !== remplace);
    ecrireMesSorts([...liste, entree]);
    recharger();
    return { sort: entree };
  });

  ctx.guichet(socket, EVENEMENTS.SORT_SUPPRIMER, Supprimer, ({ idSort }) => {
    ctx.exigerMJ(socket, "modifier les sorts du compendium");
    if (compendium.fichierDuSort(idSort) !== FICHIER_SORTS_MJ) {
      throw new ErreurRegle("Seuls les sorts crees depuis le jeu se suppriment ici (les autres : dans leur fichier).");
    }
    ecrireMesSorts(lireMesSorts().filter((s) => s?.id !== idSort));
    recharger();
    return {};
  });
}
