// Acces distant en un clic, via un "tunnel rapide" Cloudflare.
//
// Le probleme : ton PC est cache derriere ta box, invisible depuis Internet.
// La solution : le programme "cloudflared" ouvre, DEPUIS ton PC, une connexion
// sortante vers Cloudflare. Cloudflare te donne en echange une adresse publique
// en https (ex. https://mots-au-hasard.trycloudflare.com) et fait suivre vers
// ton PC tout ce qui arrive a cette adresse.
//
// - Aucun compte, aucune installation manuelle : le programme est telecharge
//   automatiquement au premier lancement.
// - Rien a ouvrir sur ta box, rien a autoriser dans le pare-feu (la connexion
//   part de ton PC).
// - Les joueurs cliquent sur le lien, point final (pas de page d'avertissement).
// - L'adresse change a chaque partie et meurt quand tu fermes le serveur.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { bin, install, Tunnel } from "cloudflared";

const DELAI_ADRESSE_MS = 45_000;
const DELAI_CONNEXION_MS = 20_000;

function attendre(emetteur, evenement, delaiMs, messageDelai) {
  return new Promise((resoudre, rejeter) => {
    const minuterie = setTimeout(() => rejeter(new Error(messageDelai)), delaiMs);
    const surSortie = (code) => {
      clearTimeout(minuterie);
      rejeter(new Error(`le programme cloudflared s'est arrete (code ${code})`));
    };
    emetteur.once("exit", surSortie);
    emetteur.once(evenement, (valeur) => {
      clearTimeout(minuterie);
      emetteur.off("exit", surSortie);
      resoudre(valeur);
    });
  });
}

/** Ouvre le tunnel et renvoie son adresse publique. */
export async function ouvrirTunnel(port) {
  if (!existsSync(bin)) {
    console.log("  [tunnel] Premier lancement : telechargement de l'outil Cloudflare (~40 Mo, une seule fois)...");
    await install(bin);
    console.log("  [tunnel] Outil installe.");
  }

  console.log("  [tunnel] Ouverture de l'acces distant...");
  const tunnel = Tunnel.quick(`http://localhost:${port}`);
  tunnel.on("error", (erreur) => console.warn(`  [tunnel] ${erreur.message}`));

  try {
    const adresse = await attendre(tunnel, "url", DELAI_ADRESSE_MS, "Cloudflare n'a pas repondu a temps");
    // L'adresse est annoncee un peu avant d'etre joignable : on attend que la
    // liaison soit reellement etablie avant de donner le lien aux joueurs.
    await attendre(tunnel, "connected", DELAI_CONNEXION_MS, "liaison avec Cloudflare trop lente").catch(() => {});

    tunnel.on("exit", () => {
      console.warn("\n  !! Le tunnel s'est ferme : les joueurs a distance sont deconnectes.");
      console.warn("     Arrete le serveur (Ctrl + C) et relance : npm run partie\n");
    });
    return { adresse, fermer: () => tunnel.stop() };
  } catch (erreur) {
    tunnel.stop();
    throw erreur;
  }
}

/** Copie un texte dans le presse-papiers (Windows et macOS). */
export function copierDansPressePapiers(texte) {
  const commande = { win32: "clip", darwin: "pbcopy" }[process.platform];
  if (!commande) return false;
  try {
    const processus = spawn(commande, [], { stdio: ["pipe", "ignore", "ignore"] });
    processus.on("error", () => {});
    processus.stdin.end(texte);
    return true;
  } catch {
    return false;
  }
}
