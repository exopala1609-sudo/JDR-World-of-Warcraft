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
    case "points-de-vie":
      if (cause.type === "degats") {
        return `${p.nom} subit ${cause.montant} degats (${pv.actuels}/${pv.max} PV)${cause.aTerre ? " et s'effondre !" : "."}`;
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
      return `${p.nom} recoit le butin : [${cause.nom}]${cause.quantite > 1 ? ` x${cause.quantite}` : ""} (${nomRarete(cause.rarete)}).`;
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
    default:
      return "L'ordre du combat change.";
  }
}

export function decrireDes(r: any): string {
  const detail = r.termes
    .map((t: any) => (t.type === "des" ? `${t.expression}(${t.gardes.map((i: number) => t.jets[i]).join("+")})` : t.expression))
    .join(" ");
  return `${r.secret ? "(Secret) " : ""}${r.par} obtient ${r.total}${r.raison ? ` - ${r.raison}` : ""} [${r.formule} : ${detail}]`;
}

export { signe };
