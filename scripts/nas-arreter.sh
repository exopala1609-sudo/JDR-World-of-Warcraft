#!/bin/sh
# Arrete la table sur le NAS (les donnees en attente sont d'abord sauvees).
. "$(dirname "$0")/nas-commun.sh"
# D'abord la boucle (sinon elle relancerait le serveur), puis le serveur.
boucle_active && kill "$(cat "$FICHIER_PID")" 2>/dev/null
rm -f "$FICHIER_PID"
arreter_serveur
journal "Table arretee."
