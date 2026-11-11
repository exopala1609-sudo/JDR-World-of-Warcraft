#!/bin/sh
# Lance la table sur le NAS Synology et la relance toute seule si elle plante.
# Appele par le Planificateur de taches de DSM au demarrage du NAS.
# Pour l'arreter : scripts/nas-arreter.sh. Journal : vtt.log (racine du projet).

DOSSIER="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DOSSIER" || exit 1

# Node.js 22, installe depuis le Centre de paquets de DSM.
NODE=/var/packages/Node.js_v22/target/usr/local/bin/node
[ -x "$NODE" ] || NODE="$(command -v node)"

if pgrep -f "server/src/index.js" >/dev/null 2>&1; then
  echo "La table tourne deja."
  exit 0
fi

while true; do
  # Garde le journal precedent, pour ne pas remplir le disque.
  [ -f vtt.log ] && mv -f vtt.log vtt.ancien.log
  "$NODE" server/src/index.js >> vtt.log 2>&1
  echo "$(date) : serveur arrete, relance dans 30 s" >> vtt.ancien.log
  sleep 30
done
