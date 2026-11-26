// Une "ErreurRegle" est un refus normal et attendu (formule de des invalide,
// action interdite...). Son message est ecrit pour etre montre au joueur.
// Toute AUTRE erreur est un bug : on la note dans la console du MJ et le
// joueur ne recoit qu'un message generique (on ne divulgue rien d'interne).
export class ErreurRegle extends Error {
  constructor(message) {
    super(message);
    this.name = "ErreurRegle";
  }
}
