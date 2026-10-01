// Traduit les "causes" envoyees par le serveur en phrases pour la fenetre de
// discussion (comme les messages systeme de WoW).
import { RARETES } from "@partage/raretes.js";
import type { Personnage } from "./types";

const signe = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const nomRarete = (cle: string) => (RARETES as Record<string, { nom: string }>)[cle]?.nom ?? cle;

export function decrireCause(p: Personnage, cause: any): string {
  const pv = p.pointsDeVie;
  switch (cause.action) {
    case "creation":
      return `${p.nom} rejoint l'aventure.`;
    case "invocation":
      return `${p.nom} (${p.pointsDeVie.max} PV) est pose sur la carte${cause.cache === false ? "" : ", cache aux joueurs"}.`;
    case "points-de-vie":
      if (cause.type === "degats") {
        const critique = cause.critique ? " (coup critique !)" : "";
        return `${p.nom} subit ${cause.montant} degats${critique} (${pv.actuels}/${pv.max} PV)${cause.aTerre ? " et s'effondre !" : "."}`;
      }
      if (cause.type === "soins") return `${p.nom} recupere ${cause.variation} PV (${pv.actuels}/${pv.max}).`;
      return `${p.nom} gagne ${cause.montant} PV temporaires.`;
    case "repos":
      return cause.repos === "court"
        ? `${p.nom} prend un repos court : +${cause.pvRecuperes} PV.`
        : `${p.nom} se reveille repose apres un repos long.`;
    case "ressource":
      return "";
    case "etat-pose":
      return `${p.nom} ${cause.etat.nature === "buff" ? "beneficie de" : "est affecte par"} : ${cause.etat.nom}.`;
    case "etat-retire":
      return `${cause.etat.nom} se dissipe sur ${p.nom}.`;
    case "etats-ecoules":
      return cause.expires.length ? `${cause.expires.map((e: any) => e.nom).join(", ")} se dissipe sur ${p.nom}.` : "";
    case "objet-recu":
      return `${p.nom} recoit le butin : [${cause.nom}]${cause.quantite > 1 ? ` x${cause.quantite}` : ""} (${nomRarete(cause.rarete)})${cause.origine ? ` - ${cause.origine}` : ""}.`;
    case "equipe":
      return `${p.nom} s'equipe de [${cause.nom}]${p.classeArmure !== cause.classeArmure ? ` (CA ${cause.classeArmure} -> ${p.classeArmure})` : ""}.`;
    case "desequipe":
      return `${p.nom} range [${cause.nom}] dans son sac${p.classeArmure !== cause.classeArmure ? ` (CA ${cause.classeArmure} -> ${p.classeArmure})` : ""}.`;
    case "objet-utilise":
      return `${p.nom} utilise [${cause.nom}] : +${cause.soins} PV.`;
    case "objet-retire":
      return `${p.nom} se debarrasse de [${cause.nom}].`;
    case "sort-appris":
      return `${p.nom} a appris un nouveau sort : ${cause.nom}.`;
    default:
      return "";
  }
}

export function decrireCombat(cause: any): string {
  switch (cause.action) {
    case "debut":
      return `Combat ! Ordre d'initiative : ${cause.jets.map((j: any) => `${j.nom} (${j.initiative})`).join(", ")}.`;
    case "tour":
      return `${cause.nouveauRound ? `Round ${cause.round}. ` : ""}Au tour de ${cause.actif}.`;
    case "fin":
      return "Fin du combat.";
    case "ordre":
      return `Le MJ change l'ordre du combat (${cause.nom}).`;
    default:
      return "L'ordre du combat change.";
  }
}

/** Une ligne de chat pour un jet valide : "Garrosh - Epee longue : Jet d'attaque 19 (14 +2 +2), Degats 6." */
export function decrireJet(jet: { personnage: string; action: { nom: string }; lignes: any[]; note: string | null; secret?: boolean }) {
  const lignes = jet.lignes.map((l) => {
    const de = l.d20 !== null ? `${l.d20}${l.d20Ecarte != null ? ` (ecarte : ${l.d20Ecarte})` : ""}` : l.des ? l.des.jets.join("+") : null;
    const detail = [de, ...l.modificateurs.map((m: any) => signe(m.valeur))].filter((x) => x !== null).join(" ");
    return `${l.libelle} ${l.total}${l.critique ? " (CRITIQUE !)" : ""} [${detail}]`;
  });
  return `${jet.secret ? "(Secret) " : ""}${jet.personnage} - ${jet.action.nom} : ${lignes.join(", ") || "lance"}.${jet.note ? ` ${jet.note}` : ""}`;
}

export function decrireDes(r: any): string {
  const detail = r.termes
    .map((t: any) => {
      if (t.type !== "des") return t.expression;
      const gardes = t.gardes.map((i: number) => t.jets[i]).join("+");
      // Avantage (2d20kh1) : on montre aussi le de ecarte.
      const ecartes = t.jets.filter((_: number, i: number) => !t.gardes.includes(i));
      return `${t.expression}(${gardes}${ecartes.length ? `, ecarte : ${ecartes.join(", ")}` : ""})`;
    })
    .join(" ");
  return `${r.secret ? "(Secret) " : ""}${r.par} obtient ${r.total}${r.raison ? ` - ${r.raison}` : ""} [${r.formule} : ${detail}]`;
}

export { signe };
