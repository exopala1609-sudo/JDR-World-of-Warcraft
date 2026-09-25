// Domaine "referentiel" : factions, races, classes et regles de creation.
//
// Contrairement au compendium (reserve au MJ), le referentiel est lisible par
// TOUS : un joueur en a besoin pour creer son personnage, et il ne contient
// aucun secret. Seul le MJ peut le recharger apres avoir modifie les fichiers.
import { EVENEMENTS } from "../../../shared/protocole.js";
import { resumerReferentiel, situerErreur } from "../donnees/referentiel.js";
import { listerImages } from "../medias.js";

export function brancher(socket, ctx) {
  ctx.guichet(socket, EVENEMENTS.REFERENTIEL_LISTER, null, () => ctx.referentiel.lister());

  // Les portraits proposes a l'ecran de creation (le dossier est deja public).
  ctx.guichet(socket, EVENEMENTS.PORTRAITS_LISTER, null, () => ({ fichiers: listerImages(ctx.config, "portraits") }));

  ctx.guichet(socket, EVENEMENTS.REFERENTIEL_RECHARGER, null, () => {
    ctx.exigerMJ(socket, "recharger le referentiel");
    const rapport = ctx.referentiel.charger();
    console.log(`[referentiel] Recharge : ${resumerReferentiel(rapport)}.`);
    for (const erreur of rapport.erreurs) console.log(`  !! ${situerErreur(erreur)} : ${erreur.message}`);
    // Tout le monde recoit la nouvelle version (un joueur peut etre en train
    // de creer son personnage a ce moment-la).
    ctx.io.emit(EVENEMENTS.REFERENTIEL_MAJ, { referentiel: ctx.referentiel.lister() });
    return { rapport };
  });
}
