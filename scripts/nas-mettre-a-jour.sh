#!/bin/sh
# Met la table a jour depuis GitHub (branche "deploiement", preparee par GitHub).
# Appele par le Planificateur de taches de DSM (tache "Mettre a jour la table").
#
# Deroule : telecharge -> pause de la table -> nouvelle version -> redemarrage
# -> verification. Si quoi que ce soit echoue, l'ancienne version est remise.
# Les parties ne sont jamais touchees (elles sont dans un autre dossier), et le
# serveur prend de toute facon une copie de secours a chaque demarrage.
. "$(dirname "$0")/nas-commun.sh"

if ! git fetch --quiet origin deploiement; then
  journal "Mise a jour impossible : GitHub injoignable. Rien n'a change."
  exit 1
fi
AVANT="$(git rev-parse HEAD)"
APRES="$(git rev-parse origin/deploiement)"
if [ "$AVANT" = "$APRES" ]; then
  journal "Deja a jour (version $(cat VERSION 2>/dev/null | cut -c1-7))."
  exit 0
fi

installer() {
  git reset --hard --quiet "$1" &&
    "$NPM" ci --omit=dev --ignore-scripts --no-audit --no-fund >> vtt-nas.log 2>&1
}

revenir() {
  journal "!! $1 : retour a la version precedente."
  touch .maintenance
  arreter_serveur
  installer "$AVANT"
  rm -f .maintenance
  if boucle_active && ! attendre_table; then journal "!! L'ancienne version ne repond pas non plus : regarde vtt.log."; fi
  exit 1
}

TOURNAIT=0
boucle_active && TOURNAIT=1

journal "Mise a jour : $(echo "$AVANT" | cut -c1-7) -> $(echo "$APRES" | cut -c1-7)..."
touch .maintenance
arreter_serveur
installer "$APRES" || revenir "Installation de la nouvelle version ratee"
rm -f .maintenance

if [ "$TOURNAIT" = 1 ]; then
  attendre_table || revenir "La nouvelle version ne repond pas"
  journal "Mise a jour terminee, la table tourne (version $(cut -c1-7 VERSION))."
else
  journal "Mise a jour terminee (version $(cut -c1-7 VERSION)). La table n'etait pas lancee : lance la tache \"Table JDR\"."
fi
