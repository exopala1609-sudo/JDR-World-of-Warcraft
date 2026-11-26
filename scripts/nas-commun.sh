# Reglages communs aux scripts du NAS (inclus par les autres, ne pas lancer seul).

DOSSIER="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DOSSIER" || exit 1

# Node.js 22, installe depuis le Centre de paquets de DSM.
NODE=/var/packages/Node.js_v22/target/usr/local/bin/node
NPM=/var/packages/Node.js_v22/target/usr/local/bin/npm
[ -x "$NODE" ] || NODE="$(command -v node)"
[ -x "$NPM" ] || NPM="$(command -v npm)"
PATH="$(dirname "$NODE"):$PATH"

# git (paquet Git Server) : selon les versions de DSM, il n'est pas toujours
# dans le PATH, surtout sous sudo ou dans le Planificateur de taches. On le
# cherche aux endroits connus, puis dans les paquets installes.
if ! command -v git >/dev/null 2>&1; then
  for candidat in /usr/local/bin/git /var/packages/Git/target/bin/git /var/packages/Git/target/usr/bin/git \
    $(find /var/packages -maxdepth 5 -type f -name git 2>/dev/null); do
    if [ -x "$candidat" ]; then
      PATH="$(dirname "$candidat"):$PATH"
      break
    fi
  done
fi
export PATH

# Tout ce que npm et l'outil de tunnel telechargent reste dans le dossier de la
# table (l'utilisateur "vtt" n'a pas forcement de dossier personnel).
export npm_config_cache="$DOSSIER/.outils/npm-cache"
# L'outil de tunnel Cloudflare, hors de node_modules : une mise a jour ne
# l'efface pas (sinon, 40 Mo a retelecharger a chaque fois).
export CLOUDFLARED_BIN="$DOSSIER/.outils/cloudflared"
mkdir -p "$DOSSIER/.outils"
# Sans dossier personnel utilisable (utilisateur "vtt"), git et npm s'en servent d'un a nous.
if [ -z "${HOME:-}" ] || [ ! -w "${HOME:-/nonexistent}" ]; then
  HOME="$DOSSIER/.outils"
  export HOME
fi

# Le port de la table, lu dans .env (3000 par defaut).
PORT="$(sed -n 's/^VTT_PORT=//p' .env 2>/dev/null | tr -d '\r" ' | tail -n 1)"
[ -n "$PORT" ] || PORT=3000

journal() {
  echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" | tee -a "$DOSSIER/vtt-nas.log"
}

# La boucle de nas-demarrer.sh et le serveur notent ici leur numero de processus
# (pas besoin de pgrep / pkill, qui ne sont pas garantis sur DSM).
FICHIER_PID="$DOSSIER/.outils/table.pid"
FICHIER_PID_SERVEUR="$DOSSIER/.outils/serveur.pid"
boucle_active() { [ -f "$FICHIER_PID" ] && kill -0 "$(cat "$FICHIER_PID")" 2>/dev/null; }
serveur_actif() { [ -f "$FICHIER_PID_SERVEUR" ] && kill -0 "$(cat "$FICHIER_PID_SERVEUR")" 2>/dev/null; }

# Arret propre du serveur (comme Ctrl + C) : il ecrit ce qui attend, puis s'arrete.
arreter_serveur() {
  serveur_actif || return 0
  pid="$(cat "$FICHIER_PID_SERVEUR")"
  kill -TERM "$pid" 2>/dev/null
  n=0
  while kill -0 "$pid" 2>/dev/null && [ "$n" -lt 20 ]; do sleep 1; n=$((n + 1)); done
  kill -0 "$pid" 2>/dev/null && kill -KILL "$pid" 2>/dev/null
  rm -f "$FICHIER_PID_SERVEUR"
  return 0
}

# La table repond-elle ? (jusqu'a 90 secondes d'attente)
attendre_table() {
  n=0
  while [ "$n" -lt 90 ]; do
    curl -fsS "http://127.0.0.1:$PORT/api/session" >/dev/null 2>&1 && return 0
    sleep 1
    n=$((n + 1))
  done
  return 1
}
