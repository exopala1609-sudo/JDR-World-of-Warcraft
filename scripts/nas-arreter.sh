#!/bin/sh
# Arrete proprement la table sur le NAS (les donnees en attente sont sauvees).
pkill -f "scripts/nas-demarrer.sh"
pkill -TERM -f "server/src/index.js"
echo "Table arretee."
