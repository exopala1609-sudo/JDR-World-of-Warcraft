// Domaine "scene" : la carte, la grille, les pions et le brouillard.
//
// LE MOUVEMENT SYNCHRONISE, en trois temps :
//
//  1. SAISIR   - au clic sur un pion, le navigateur demande "je le prends".
//                Le serveur verifie le droit (le MJ, ou le proprietaire) et
//                pose un VERROU : pendant le glisser, personne d'autre ne
//                peut le saisir. Deux personnes ne tirent jamais le meme pion.
//
//  2. GLISSER  - pendant le mouvement, le navigateur envoie sa position ~20 fois
//                par seconde (final: false). Le serveur verifie le verrou et
//                RELAIE aussitot aux autres, en "volatile" : si le reseau est
//                engorge, un message intermediaire peut sauter sans dommage
//                (le suivant arrive 50 ms plus tard). Rien n'est enregistre.
//
//  3. LACHER   - au relachement (final: true), le serveur calcule la position
//                OFFICIELLE (dans la carte, aimantee a la grille), l'enregistre,
//                la diffuse a tous (y compris a celui qui a lache : son pion se
//                cale sur la decision du serveur), puis libere le verrou.
//
// Les monstres (PNJ) qui entrent ou sortent du brouillard apparaissent ou
// disparaissent chez les joueurs : le serveur ne leur envoie jamais un pion
// qu'ils ne doivent pas voir.
import { existsSync } from "node:fs";
import { traitCouvre } from "../../../shared/geometrie.js";
import { basename, join } from "node:path";
import { imageSizeFromFile } from "image-size/fromFile";
import { EVENEMENTS } from "../../../shared/protocole.js";
import { schemaId } from "../modeles/identifiants.js";
import { CARTE_PAR_DEFAUT, SchemaGrille, SchemaTrait } from "../modeles/scene.js";
import { z } from "../modeles/zod.js";
import { ErreurRegle } from "../regles/erreurs.js";
import {
  ajouterTrait,
  changerCarte,
  changerTaillePion,
  deplacerPion,
  pionVisibleParLesJoueurs,
  placerPion,
  positionValide,
  retirerPion,
  toutCacher,
  toutReveler,
  traitTouchePnj,
} from "../regles/scene.js";
import { salleJoueurs, salleMJ, salleTable } from "./index.js";

const DUREE_VERROU_MS = 5000; // un verrou abandonne (navigateur ferme) expire seul
const RELAIS_PAR_SECONDE = 40; // le navigateur en envoie 20 : au-dela, c'est de l'inondation
const coordonnee = z.number().min(-100_000).max(100_000);

const Demandes = {
  carte: z.strictObject({ fichier: z.string().min(1).max(255).nullable() }),
  grille: SchemaGrille,
  placer: z.strictObject({
    idPersonnage: schemaId("p"),
    x: coordonnee.optional(),
    y: coordonnee.optional(),
    cache: z.boolean().optional(), // par defaut : un monstre arrive cache, un heros visible
  }),
  pion: z.strictObject({ idPion: schemaId("j") }),
  cacher: z.strictObject({ idPion: schemaId("j"), cache: z.boolean() }),
  taille: z.strictObject({ idPion: schemaId("j"), taille: z.int().min(1).max(4) }),
  deplacer: z.strictObject({
    idPion: schemaId("j"),
    x: coordonnee,
    y: coordonnee,
    final: z.boolean(),
    aimanter: z.boolean().default(true),
  }),
  tout: z.strictObject({ mode: z.enum(["reveler", "cacher"]) }),
  actif: z.strictObject({ actif: z.boolean() }),
};

// Verrous des pions en cours de deplacement : idPion -> { idSocket, pseudo, expire }.
// Partage par toutes les connexions (c'est tout l'interet).
const verrous = new Map();

export function brancher(socket, ctx) {
  const { depot, io } = ctx;
  const pseudo = socket.data.profil.pseudo;

  // --- Outils ----------------------------------------------------------------

  function sceneCourante() {
    return depot.obtenirScene(ctx.exigerTable(socket));
  }

  function exigerPion(scene, idPion) {
    const pion = scene.pions.find((p) => p.id === idPion);
    if (!pion) throw new ErreurRegle("Ce pion n'est plus sur la carte.");
    return pion;
  }

  /** Le MJ deplace tout ; un joueur, uniquement le pion de SON personnage. */
  function exigerDroitDeDeplacer(pion) {
    if (ctx.estMJ(socket)) return;
    const personnage = depot.obtenirPersonnage(pion.idPersonnage);
    if (!personnage || !ctx.estProprietaire(socket, personnage)) {
      throw new ErreurRegle("Tu ne peux deplacer que le pion de ton personnage.");
    }
  }

  function verrouDe(idPion) {
    const verrou = verrous.get(idPion);
    if (verrou && verrou.expire < Date.now()) {
      verrous.delete(idPion);
      return null;
    }
    return verrou ?? null;
  }

  function exigerVerrouLibreOuAMoi(idPion) {
    const verrou = verrouDe(idPion);
    if (verrou && verrou.idSocket !== socket.id) throw new ErreurRegle(`${verrou.pseudo} deplace deja ce pion.`);
  }

  function enregistrer(scene) {
    return depot.enregistrerScene(scene);
  }

  // --- Carte et grille (MJ) -------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.SCENE_CARTE, Demandes.carte, async ({ fichier }) => {
    ctx.exigerMJ(socket, "changer de carte");
    const scene = sceneCourante();
    let carte = { ...CARTE_PAR_DEFAUT };

    if (fichier !== null) {
      // Un simple nom de fichier du dossier cartes/ : ni sous-dossier, ni "..".
      if (basename(fichier) !== fichier || fichier.startsWith(".")) throw new ErreurRegle("Nom de fichier invalide.");
      const chemin = join(ctx.config.dossiers.cartes, fichier);
      if (!existsSync(chemin)) throw new ErreurRegle(`Carte introuvable dans ton dossier : ${fichier}`);
      // Le SERVEUR lit les dimensions dans l'en-tete de l'image : c'est lui
      // qui sait jusqu'ou un pion peut aller.
      let dimensions;
      try {
        dimensions = await imageSizeFromFile(chemin);
      } catch {
        throw new ErreurRegle("Image illisible (formats acceptes : png, jpg, webp, gif, svg).");
      }
      if (!dimensions.width || !dimensions.height || dimensions.width > 20_000 || dimensions.height > 20_000) {
        throw new ErreurRegle("Dimensions de l'image invalides (20 000 px maximum).");
      }
      carte = { fichier, largeur: dimensions.width, hauteur: dimensions.height };
    }

    enregistrer(changerCarte(scene, carte));
    ctx.publierScene(scene.idTable, { action: "carte", par: pseudo, fichier });
    // Nouvelle carte : les traces tactiques de l'ancienne n'ont plus de sens.
    ctx.traces.delete(scene.idTable);
    io.to(salleTable(scene.idTable)).emit(EVENEMENTS.DESSINS_ETAT, { traces: [] });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.SCENE_GRILLE, Demandes.grille, (grille) => {
    ctx.exigerMJ(socket, "regler la grille");
    const scene = enregistrer({ ...sceneCourante(), grille });
    // La grille ne cache rien : tout le monde recoit le reglage, en direct.
    // Sauf l'ecran qui regle (il l'affiche deja) : un ancien reglage qui
    // reviendrait en retard ferait "sauter" la grille sous son curseur.
    socket.to(salleMJ(scene.idTable)).to(salleJoueurs(scene.idTable)).emit(EVENEMENTS.SCENE_GRILLE_MAJ, { grille });
    return {};
  });

  // --- Pions : placer, retirer, cacher (MJ) ------------------------------------------

  ctx.guichet(socket, EVENEMENTS.PION_PLACER, Demandes.placer, ({ idPersonnage, x, y, cache }) => {
    ctx.exigerMJ(socket, "placer des pions");
    const personnage = ctx.exigerPersonnageVisible(socket, idPersonnage);
    const { scene } = placerPion(sceneCourante(), personnage, x !== undefined && y !== undefined ? { x, y } : null, cache === undefined ? {} : { cache });
    enregistrer(scene);
    ctx.publierScene(scene.idTable, { action: "pion-place", par: pseudo, nom: personnage.nom });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.PIONS_PLACER_TOUS, null, () => {
    ctx.exigerMJ(socket, "placer des pions");
    let scene = sceneCourante();
    const absents = depot.personnagesDeLaTable(scene.idTable).filter((p) => !scene.pions.some((j) => j.idPersonnage === p.id));
    // En ligne, une case d'ecart, a partir du centre de la carte.
    absents.forEach((personnage, index) => {
      const x = scene.carte.largeur / 2 + (index - (absents.length - 1) / 2) * scene.grille.taille;
      scene = placerPion(scene, personnage, { x, y: scene.carte.hauteur / 2 }).scene;
    });
    enregistrer(scene);
    ctx.publierScene(scene.idTable, { action: "pions-places", par: pseudo, nombre: absents.length });
    return { nombre: absents.length };
  });

  ctx.guichet(socket, EVENEMENTS.PION_RETIRER, Demandes.pion, ({ idPion }) => {
    ctx.exigerMJ(socket, "retirer des pions");
    const scene = enregistrer(retirerPion(sceneCourante(), idPion));
    verrous.delete(idPion);
    ctx.publierScene(scene.idTable, { action: "pion-retire", par: pseudo });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.PION_TAILLE, Demandes.taille, ({ idPion, taille }) => {
    ctx.exigerMJ(socket, "changer la taille d'un pion");
    const scene = sceneCourante();
    enregistrer(changerTaillePion(scene, idPion, taille));
    ctx.publierScene(scene.idTable, { action: "pion-taille", par: pseudo });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.PION_CACHER, Demandes.cacher, ({ idPion, cache }) => {
    ctx.exigerMJ(socket, "cacher des pions");
    const scene = sceneCourante();
    exigerPion(scene, idPion);
    enregistrer({ ...scene, pions: scene.pions.map((p) => (p.id === idPion ? { ...p, cache } : p)) });
    ctx.publierScene(scene.idTable, { action: cache ? "pion-cache" : "pion-montre", par: pseudo });
    return {};
  });

  // --- Pions : le mouvement synchronise ------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.PION_SAISIR, Demandes.pion, ({ idPion }) => {
    const pion = exigerPion(sceneCourante(), idPion);
    exigerDroitDeDeplacer(pion);
    exigerVerrouLibreOuAMoi(idPion);
    verrous.set(idPion, { idSocket: socket.id, pseudo, expire: Date.now() + DUREE_VERROU_MS });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.PION_DEPLACER, Demandes.deplacer, ({ idPion, x, y, final, aimanter }) => {
    const scene = sceneCourante();
    const pion = exigerPion(scene, idPion);
    exigerDroitDeDeplacer(pion);
    exigerVerrouLibreOuAMoi(idPion);
    const personnage = depot.obtenirPersonnage(pion.idPersonnage);

    if (!final) {
      // 2. GLISSER : on relaie sans rien enregistrer.
      verrous.set(idPion, { idSocket: socket.id, pseudo, expire: Date.now() + DUREE_VERROU_MS });
      const position = positionValide(scene, x, y, { aimanter: false });
      // Trop rapproche du precedent : ignore (sans erreur, le suivant arrivera).
      if (!ctx.quota(socket, "glisser", RELAIS_PAR_SECONDE)) return { position };
      const message = { idPion, ...position, final: false, par: pseudo };
      socket.volatile.to(salleMJ(scene.idTable)).emit(EVENEMENTS.PION_POSITION, message);
      // Les joueurs ne voient passer un monstre que s'il est dans une zone revelee.
      if (pionVisibleParLesJoueurs(scene, { ...pion, ...position }, personnage)) {
        socket.volatile.to(salleJoueurs(scene.idTable)).emit(EVENEMENTS.PION_POSITION, message);
      }
      return { position };
    }

    // 3. LACHER : position officielle, enregistrement, diffusion, fin du verrou.
    const visibleAvant = pionVisibleParLesJoueurs(scene, pion, personnage);
    const resultat = deplacerPion(scene, idPion, x, y, { aimanter });
    enregistrer(resultat.scene);
    verrous.delete(idPion);

    const message = { idPion, x: resultat.pion.x, y: resultat.pion.y, final: true, par: pseudo };
    io.to(salleMJ(scene.idTable)).emit(EVENEMENTS.PION_POSITION, message);
    const visibleApres = pionVisibleParLesJoueurs(resultat.scene, resultat.pion, personnage);
    if (visibleAvant !== visibleApres) {
      // Le pion entre ou sort du brouillard : les joueurs recoivent la nouvelle
      // liste de ce qu'ils voient (il apparait ou disparait).
      ctx.envoyerSceneAuxJoueurs(scene.idTable, resultat.scene, { action: "visibilite" });
    } else if (visibleApres) {
      io.to(salleJoueurs(scene.idTable)).emit(EVENEMENTS.PION_POSITION, message);
    }
    return { position: { x: resultat.pion.x, y: resultat.pion.y } };
  });

  // --- Brouillard (MJ) ----------------------------------------------------------------

  ctx.guichet(socket, EVENEMENTS.BROUILLARD_TRAIT, SchemaTrait, (trait) => {
    ctx.exigerMJ(socket, "peindre le brouillard");
    if (trait.mode === "tout-reveler") throw new ErreurRegle("Utilise le bouton 'Tout reveler'.");
    const scene = sceneCourante();
    // Coordonnees arrondies au dixieme : le fichier de sauvegarde reste leger.
    const propre = { ...trait, points: trait.points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]) };
    const suite = depot.enregistrerScene(ajouterTrait(scene, propre), { valider: false });

    // Le MJ a deja dessine ce trait chez lui : on l'envoie a tous les AUTRES.
    socket.to(salleMJ(scene.idTable)).to(salleJoueurs(scene.idTable)).emit(EVENEMENTS.BROUILLARD_TRAIT_AJOUTE, { trait: propre });

    // Si le trait passe sur un monstre, celui-ci apparait / disparait chez les joueurs.
    // (ou sur un coffre : il apparait / disparait lui aussi)
    const surUnButin = suite.butins.some((b) => propre.mode === "tout-reveler" || traitCouvre(propre, b.x, b.y));
    if (surUnButin || traitTouchePnj(suite, propre, (id) => depot.obtenirPersonnage(id))) {
      ctx.envoyerSceneAuxJoueurs(scene.idTable, suite, { action: "visibilite" });
    }
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.BROUILLARD_TOUT, Demandes.tout, ({ mode }) => {
    ctx.exigerMJ(socket, "modifier le brouillard");
    const scene = sceneCourante();
    enregistrer(mode === "reveler" ? toutReveler(scene) : toutCacher(scene));
    ctx.publierScene(scene.idTable, { action: mode === "reveler" ? "tout-revele" : "tout-cache", par: pseudo });
    return {};
  });

  ctx.guichet(socket, EVENEMENTS.BROUILLARD_ACTIF, Demandes.actif, ({ actif }) => {
    ctx.exigerMJ(socket, "activer le brouillard");
    const scene = sceneCourante();
    enregistrer({ ...scene, brouillard: { ...scene.brouillard, actif } });
    ctx.publierScene(scene.idTable, { action: actif ? "brouillard-active" : "brouillard-desactive", par: pseudo });
    return {};
  });

  // Un navigateur qui se ferme en plein glisser libere ses pions.
  socket.on("disconnect", () => {
    for (const [idPion, verrou] of verrous) if (verrou.idSocket === socket.id) verrous.delete(idPion);
  });
}
