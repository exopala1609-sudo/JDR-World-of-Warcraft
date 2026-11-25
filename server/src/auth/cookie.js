// Le "badge" d'acces aux images, sons et cartes.
//
// Le jeton (voir sessions.js) voyage avec chaque message temps reel. Mais une
// image affichee dans la page (<img>, fond d'ecran, carte dessinee) est
// demandee directement par le navigateur, qui ne sait pas y joindre le jeton.
// On lui confie donc une copie du jeton dans un COOKIE : le navigateur le
// presente tout seul a chaque image demandee a CE serveur.
//
//   httpOnly        : aucun script de la page ne peut le lire ;
//   sameSite strict : un autre site ne peut pas s'en servir ;
//   secure          : en https (tunnel), il ne circule jamais en clair.
export const NOM_COOKIE = "vtt_jeton";

/** Pose le cookie (meme duree de vie que le jeton). */
export function poserCookieJeton(requete, reponse, jeton, dureeMs) {
  reponse.cookie(NOM_COOKIE, jeton, {
    httpOnly: true,
    sameSite: "strict",
    secure: requete.secure,
    maxAge: dureeMs,
    path: "/",
  });
}

/** Lit le jeton dans l'en-tete Cookie de la requete (sans dependance supplementaire). */
export function lireCookieJeton(requete) {
  const entete = requete.get("cookie");
  if (!entete) return null;
  for (const morceau of entete.split(";")) {
    const egal = morceau.indexOf("=");
    if (egal > 0 && morceau.slice(0, egal).trim() === NOM_COOKIE) {
      try {
        return decodeURIComponent(morceau.slice(egal + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}
