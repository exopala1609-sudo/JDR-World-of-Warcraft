#!/bin/sh
# Premiere installation de la table sur le NAS (une seule fois, en SSH).
# Voir docs/NAS-SYNOLOGY.md. Sans danger si on le relance.
. "$(dirname "$0")/nas-commun.sh"

echo ""
echo "  Installation de la table dans $DOSSIER"
echo ""

if [ ! -x "$NODE" ]; then
  echo "  !! Node.js introuvable : installe Node.js v22 depuis le Centre de paquets."
  exit 1
fi
VERSION_NODE="$("$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number);process.stdout.write(a>20||(a===20&&b>=12)?"ok":process.version)')"
if [ "$VERSION_NODE" != "ok" ]; then
  echo "  !! Node.js $VERSION_NODE est trop ancien (20.12 minimum, 22 conseille)."
  exit 1
fi
echo "  [ OK ] Node.js $("$NODE" --version)"

command -v git >/dev/null 2>&1 || { echo "  !! git introuvable : installe Git Server depuis le Centre de paquets."; exit 1; }
echo "  [ OK ] git"
command -v curl >/dev/null 2>&1 || { echo "  !! curl introuvable."; exit 1; }

if [ ! -f client/dist/index.html ]; then
  echo "  !! Interface non compilee : as-tu bien telecharge la branche \"deploiement\" ?"
  exit 1
fi
echo "  [ OK ] Interface deja compilee par GitHub (version $(cut -c1-7 VERSION 2>/dev/null))"

echo "  ...    Installation des bibliotheques (une a deux minutes)"
if ! "$NPM" ci --omit=dev --ignore-scripts --no-audit --no-fund >> vtt-nas.log 2>&1; then
  echo "  !! Echec : voir la fin du fichier vtt-nas.log"
  exit 1
fi
echo "  [ OK ] Bibliotheques installees"

# Demande un secret au clavier sans l'afficher, deux fois pour eviter une faute de frappe.
demander_secret() {
  while true; do
    printf "  %s : " "$1" >&2
    stty -echo 2>/dev/null; read -r un; stty echo 2>/dev/null; echo "" >&2
    printf "  Retape-le pour confirmer : " >&2
    stty -echo 2>/dev/null; read -r deux; stty echo 2>/dev/null; echo "" >&2
    if [ "$un" != "$deux" ]; then echo "  !! Les deux ne correspondent pas, recommence." >&2
    elif [ "${#un}" -lt 10 ]; then echo "  !! Trop court : 10 caracteres minimum (une petite phrase, c'est l'ideal)." >&2
    elif printf "%s" "$un" | grep -q '[" ]$\|^[" ]\|#'; then echo "  !! Evite les guillemets, le # et les espaces au debut ou a la fin." >&2
    else printf "%s" "$un"; return; fi
  done
}

if [ ! -f .env ]; then
  echo ""
  echo "  Choisis le mot de passe du Maitre du Jeu (il ne s'affiche pas quand tu tapes)."
  MDP_MJ="$(demander_secret "Mot de passe du MJ")"
  cat > .env <<FIN
# Configuration de la table sur le NAS. Voir docs/NAS-SYNOLOGY.md et .env.exemple.
VTT_ASSETS=/volume1/jdr
VTT_NOM_PARTIE=World of Warcraft
VTT_NOM_POSTE=NAS
VTT_PORT=3000
VTT_MOTDEPASSE_MJ=$MDP_MJ
# Etape "reseau local" : 0.0.0.0. Etape "acces a distance" : 127.0.0.1.
VTT_HOTE=0.0.0.0
# Etape "acces a distance" :
# VTT_TUNNEL_JETON=
# VTT_ADRESSE_PUBLIQUE=https://table.exopala.com
FIN
  echo "  [ OK ] Configuration enregistree (fichier .env)."
else
  echo "  [ OK ] Fichier .env deja present (non modifie)"
fi
# Le .env contient des secrets : lisible par son proprietaire seulement.
chmod 600 .env

echo ""
echo "  Installation terminee. Etape suivante : docs/NAS-SYNOLOGY.md"
echo ""
