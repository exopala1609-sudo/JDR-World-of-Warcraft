import { jeu, useJeu, type EtatJeu } from "@/core/jeu";
import { ReglageSon } from "@/jeu/ReglageSon";
import { avecInfobulle } from "@/ui/InfoBulle";

/** Bas droite : les petits boutons du micro-menu de WoW. */
export function MicroMenu() {
  const fenetres = useJeu((e) => e.fenetres);
  const estMJ = useJeu((e) => e.profil?.role === "mj");
  const basculer = (nom: keyof EtatJeu["fenetres"]) =>
    jeu.modifier((e) => ({ fenetres: { ...e.fenetres, [nom]: !e.fenetres[nom] } }));

  const bouton = (libelle: string, aide: string, action: () => void, actif = false) => (
    <button
      type="button"
      className={`menu__bouton${actif ? " menu__bouton--actif" : ""}`}
      onClick={action}
      {...avecInfobulle(() => <div>{aide}</div>)}
    >
      {libelle}
    </button>
  );

  return (
    <div className="menu cadre">
      {bouton("C", "Personnage (C)", () => basculer("personnage"), fenetres.personnage)}
      {bouton("P", "Grimoire (P)", () => basculer("grimoire"), fenetres.grimoire)}
      {bouton("L", "Journal de quetes (L)", () => basculer("quetes"), fenetres.quetes)}
      {bouton("B", "Sacs (B)", () => basculer("sacs"), fenetres.sacs)}
      {estMJ && bouton("MJ", "Outils du MJ : ouvre la page de test dans un nouvel onglet", () => window.open("/test/", "_blank"))}
      <ReglageSon />
      {bouton("X", "Quitter la partie", () => jeu.deconnecter())}
    </div>
  );
}
