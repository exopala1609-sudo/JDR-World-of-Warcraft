#!/bin/sh
# Active l'acces a distance par le tunnel Cloudflare (adresse fixe).
# A lancer une fois, en SSH :
#   sudo -u VTT sh /volume1/VTT/table/scripts/nas-acces-distant.sh
# Pour revenir au reseau local seul :
#   sudo -u VTT sh /volume1/VTT/table/scripts/nas-acces-distant.sh retirer
#
# Le jeton du tunnel est demande au clavier (il ne s'affiche pas) et range dans
# .env, lisible par l'utilisateur de la table seulement. Il ne passe jamais par
# GitHub.
. "$(dirname "$0")/nas-commun.sh"

[ -f .env ] || { echo "  !! Pas de fichier .env : lance d'abord scripts/nas-installer.sh."; exit 1; }

# Remplace (ou ajoute) des reglages dans .env sans toucher au reste.
# Usage : regler CLE=valeur [CLE=valeur...] ; une valeur vide retire la ligne.
regler() {
  "$NODE" -e '
    const fs = require("fs");
    const lignes = fs.readFileSync(".env", "utf8").split(/\r?\n/);
    for (const paire of process.argv.slice(1)) {
      const egal = paire.indexOf("=");
      const cle = paire.slice(0, egal), valeur = paire.slice(egal + 1);
      const motif = new RegExp("^\\s*#?\\s*" + cle + "=");
      const garde = lignes.filter((l) => !motif.test(l));
      lignes.length = 0;
      lignes.push(...garde);
      if (valeur) lignes.push(cle + "=" + valeur);
    }
    while (lignes.length && lignes[lignes.length - 1] === "") lignes.pop();
    fs.writeFileSync(".env", lignes.join("\n") + "\n", { mode: 0o600 });
  ' "$@"
  chmod 600 .env
}

relancer() {
  if boucle_active; then
    echo "  ...    Redemarrage de la table"
    arreter_serveur
    attendre_table || { echo "  !! La table ne redemarre pas : regarde vtt.log (File Station)."; exit 1; }
    echo "  [ OK ] Table redemarree"
    return 0
  fi
  echo "  !! La table n'est pas lancee : dans DSM, Planificateur de taches > \"Table JDR\" > Executer."
  return 1
}

if [ "${1:-}" = "retirer" ]; then
  regler VTT_TUNNEL_JETON= VTT_ADRESSE_PUBLIQUE= VTT_HOTE=0.0.0.0
  journal "Acces a distance retire : table joignable sur le reseau local seulement."
  relancer
  exit 0
fi

echo ""
echo "  Acces a distance par le tunnel Cloudflare"
echo ""
echo "  Colle le jeton du tunnel (clic droit), puis Entree. Il ne s'affiche pas."
printf "  Jeton : "
stty -echo 2>/dev/null; read -r JETON; stty echo 2>/dev/null; echo ""
JETON="$(printf "%s" "$JETON" | tr -d ' \r\n')"

# Un jeton Cloudflare est du "base64" contenant le compte, le tunnel et un secret.
# On le verifie ici : une faute de copier-coller se voit tout de suite.
if ! printf "%s" "$JETON" | "$NODE" -e '
  let texte = ""; process.stdin.on("data", (d) => (texte += d)).on("end", () => {
    try { const j = JSON.parse(Buffer.from(texte, "base64").toString("utf8")); process.exit(j.a && j.t && j.s ? 0 : 1); }
    catch { process.exit(1); }
  });'; then
  echo "  !! Ce n'est pas un jeton de tunnel valide. Recopie-le depuis Cloudflare"
  echo "     (la longue suite de caracteres apres --token, sans espace ni retour a la ligne)."
  exit 1
fi
echo "  [ OK ] Jeton reconnu"

printf "  Adresse de la table [https://table.exopala.com] : "
read -r ADRESSE
[ -n "$ADRESSE" ] || ADRESSE="https://table.exopala.com"
case "$ADRESSE" in
  https://*) ;;
  *) echo "  !! L'adresse doit commencer par https://"; exit 1 ;;
esac

# 127.0.0.1 : la table n'ecoute plus le reseau local, seul le tunnel (sur le
# NAS lui-meme) peut la joindre. Meme a la maison, on passe par l'adresse.
regler "VTT_TUNNEL_JETON=$JETON" "VTT_ADRESSE_PUBLIQUE=$ADRESSE" VTT_HOTE=127.0.0.1
echo "  [ OK ] Configuration enregistree (.env)"
journal "Acces a distance active : $ADRESSE"

relancer || exit 1

# Au premier lancement, l'outil Cloudflare (~40 Mo) est telecharge : jusqu'a 2 minutes.
echo "  ...    Ouverture du tunnel (jusqu'a 2 minutes la premiere fois)"
n=0
while [ "$n" -lt 120 ]; do
  if grep -q "Acces distant permanent actif" vtt.log 2>/dev/null; then
    echo "  [ OK ] Tunnel actif : ouvre $ADRESSE"
    echo ""
    exit 0
  fi
  sleep 1
  n=$((n + 1))
done
echo "  !! Le tunnel ne s'est pas ouvert. Dernieres lignes de vtt.log :"
grep "tunnel" vtt.log | tail -5
exit 1
