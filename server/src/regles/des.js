// Lancers de des. C'est le SERVEUR qui lance, jamais le navigateur :
// un joueur ne peut ni tricher ni voir un resultat different des autres.
import { randomInt } from "node:crypto";
import { ErreurRegle } from "./erreurs.js";

const LIMITES = {
  longueurFormule: 60,
  nombreDeTermes: 10,
  desParTerme: 100,
  desAuTotal: 200,
  facesMax: 1000,
  constanteMax: 10_000,
};

// "4d6kh3" = lancer 4d6 et garder (keep) les 3 plus hauts (kh = keep highest).
// "2d20kh1" = avantage, "2d20kl1" = desavantage (kl = keep lowest).
const MOTIF_DES = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/;
const MOTIF_CONSTANTE = /^\d+$/;

/**
 * Lance une formule du type "1d20+5", "2d6+1d4-1", "2d20kh1+3".
 * Utilise un generateur cryptographique : le hasard est reellement imprevisible.
 */
export function lancerDes(formuleBrute) {
  const formule = String(formuleBrute ?? "").toLowerCase().replace(/\s+/g, "");

  if (!formule) throw new ErreurRegle("Formule de des vide.");
  if (formule.length > LIMITES.longueurFormule) throw new ErreurRegle("Formule de des trop longue.");

  // On decoupe en termes signes : "2d6+1d4-1" -> ["2d6", "+1d4", "-1"].
  const morceaux = formule.match(/[+-]?[^+-]+/g) ?? [];
  if (morceaux.join("") !== formule || morceaux.length > LIMITES.nombreDeTermes) {
    throw new ErreurRegle(`Formule de des invalide : "${formuleBrute}".`);
  }

  let desLances = 0;
  const termes = morceaux.map((morceau) => {
    const signe = morceau.startsWith("-") ? -1 : 1;
    const corps = morceau.replace(/^[+-]/, "");

    if (MOTIF_CONSTANTE.test(corps)) {
      const valeur = Number(corps);
      if (valeur > LIMITES.constanteMax) throw new ErreurRegle("Bonus trop grand.");
      return { type: "bonus", expression: morceau, valeur: signe * valeur };
    }

    const correspondance = corps.match(MOTIF_DES);
    if (!correspondance) throw new ErreurRegle(`Terme de des invalide : "${morceau}".`);

    const [, nombreTexte, facesTexte, garde, nombreGardeTexte] = correspondance;
    const nombre = nombreTexte === "" ? 1 : Number(nombreTexte);
    const faces = Number(facesTexte);

    if (nombre < 1 || nombre > LIMITES.desParTerme) throw new ErreurRegle("Nombre de des invalide.");
    if (faces < 2 || faces > LIMITES.facesMax) throw new ErreurRegle("Nombre de faces invalide.");
    desLances += nombre;
    if (desLances > LIMITES.desAuTotal) throw new ErreurRegle("Trop de des dans un seul lancer.");

    const jets = Array.from({ length: nombre }, () => randomInt(1, faces + 1));

    // Par defaut on garde tous les des ; "kh"/"kl" n'en garde qu'une partie.
    let gardes = jets.map((_, i) => i);
    if (garde) {
      const aGarder = Number(nombreGardeTexte);
      if (aGarder < 1 || aGarder > nombre) throw new ErreurRegle("Nombre de des a garder invalide.");
      gardes = jets
        .map((valeur, index) => ({ valeur, index }))
        .sort((a, b) => (garde === "kh" ? b.valeur - a.valeur : a.valeur - b.valeur))
        .slice(0, aGarder)
        .map(({ index }) => index)
        .sort((a, b) => a - b);
    }

    const somme = gardes.reduce((total, index) => total + jets[index], 0);
    return { type: "des", expression: morceau, faces, jets, gardes, valeur: signe * somme };
  });

  return {
    formule,
    termes,
    total: termes.reduce((total, terme) => total + terme.valeur, 0),
  };
}
