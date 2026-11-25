#!/bin/sh
# Lance la table sur le NAS et la relance toute seule si elle s'arrete.
# Appele par le Planificateur de taches de DSM, au demarrage du NAS.
# Journal : vtt.log (le precedent : vtt.ancien.log). Arret : nas-arreter.sh.
. "$(dirname "$0")/nas-commun.sh"

# Deja lancee ? (deux boucles feraient tourner deux serveurs)
if boucle_active; then
  echo "La table tourne deja."
  exit 0
fi
echo "$$" > "$FICHIER_PID"

journal "Demarrage de la table (Node.js $("$NODE" --version))."
while true; do
  # Pendant une mise a jour (fichier .maintenance), on attend sans relancer.
  if [ -f .maintenance ]; then
    sleep 3
    continue
  fi
  # On garde le journal precedent, pour ne pas remplir le disque.
  [ -f vtt.log ] && mv -f vtt.log vtt.ancien.log
  "$NODE" server/src/index.js >> vtt.log 2>&1 &
  echo "$!" > "$FICHIER_PID_SERVEUR"
  wait "$!"
  code=$?
  rm -f "$FICHIER_PID_SERVEUR"
  [ -f .maintenance ] || journal "Le serveur s'est arrete (code $code), relance dans 5 s."
  sleep 5
done
