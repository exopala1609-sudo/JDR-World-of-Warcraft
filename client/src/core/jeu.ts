// Le "magasin d'etat" de l'interface : UN objet qui detient la verite du moment
// (profil, table, personnages, scene, combat...), recue du serveur.
//
// Fonctionnement :
//   serveur --(Socket.IO)--> jeu.modifier(...) --> les composants abonnes se
//   redessinent. Les composants ne parlent JAMAIS directement au serveur pour
//   changer une donnee : ils appellent jeu.demander(...), et attendent que le
//   serveur diffuse le resultat (autorite du serveur, comme depuis le sprint 1).
//
// Les messages tres frequents (un pion qui glisse, 20 fois par seconde) ne
// passent pas par ce magasin : ils vont directement au moteur de carte, pour ne
// pas redessiner toute l'interface a chaque petit mouvement.
import { io, type Socket } from "socket.io-client";
import { useSyncExternalStore } from "react";
import { couleurDe } from "@partage/couleurs.js";
import { EVENEMENTS, ROLES } from "@partage/protocole.js";
import type { ButinOuvert, Combat, Compendium, Jet, LigneJournal, MessageChat, Objet, OutilCarte, Personnage, Profil, Quete, Raccourci, Referentiel, Scene, Table, Trace } from "./types";
import { audio } from "./audio";
import { decrireCause, decrireCombat, decrireDes, decrireJet } from "./journal";

export type Avantage = "normal" | "avantage" | "desavantage";

export type EtatJeu = {
  liaison: "deconnecte" | "connecte" | "reconnexion";
  profil: Profil | null;
  tables: Table[];
  table: Table | null;
  // true : le joueur n'a pas encore de personnage a cette table. Le serveur
  // l'a laisse "a la porte" : l'ecran de creation s'affiche au lieu du jeu.
  creationRequise: boolean;
  referentiel: Referentiel | null; // races, classes... (fichiers JSON du MJ)
  personnages: Record<string, Personnage>;
  scene: Scene | null;
  combat: Combat;
  presence: { pseudo: string; role: string }[];
  journal: LigneJournal[];
  selection: string | null; // personnage cible (clic sur un cadre de groupe)
  // Fenetres ouvertes. Les quatre dernieres sont des outils du MJ (jamais affichees a un joueur).
  fenetres: {
    sacs: boolean;
    personnage: boolean;
    grimoire: boolean;
    quetes: boolean;
    initiative: boolean;
    bestiaire: boolean;
    compendium: boolean;
    carteMJ: boolean;
  };
  quetes: Quete[]; // le journal de quetes du groupe
  jet: Jet | null; // la fenetre de resolution ouverte
  annonce: { id: number; titre: string; texte: string } | null; // "Nouvelle quete !" au centre de l'ecran
  butin: ButinOuvert | null; // la fenetre de butin ouverte (coffre, cadavre)
  menu: { idPersonnage: string; x: number; y: number } | null; // menu contextuel du MJ (clic droit)
  avis: string | null; // message affiche sur l'ecran de connexion (ex. expulsion)
  compendium: Compendium | null; // MJ : objets, sorts, auras, monstres (charge a la demande)
  invocationCachee: boolean; // MJ : un monstre pose depuis le Bestiaire arrive cache aux joueurs
  rayonPinceau: number; // MJ : taille de la gomme / du pinceau de brouillard
  outil: OutilCarte; // ce que fait un clic gauche sur la carte
  couleurTrace: string | null; // null = sa propre couleur
};

export const FENETRES_FERMEES: EtatJeu["fenetres"] = {
  sacs: false,
  personnage: false,
  grimoire: false,
  quetes: false,
  initiative: false,
  bestiaire: false,
  compendium: false,
  carteMJ: false,
};

const ETAT_INITIAL: EtatJeu = {
  liaison: "deconnecte",
  profil: null,
  tables: [],
  table: null,
  creationRequise: false,
  referentiel: null,
  personnages: {},
  scene: null,
  combat: null,
  presence: [],
  journal: [],
  selection: null,
  fenetres: FENETRES_FERMEES,
  quetes: [],
  jet: null,
  annonce: null,
  butin: null,
  menu: null,
  avis: null,
  compendium: null,
  invocationCachee: true,
  rayonPinceau: 60,
  outil: "deplacer",
  couleurTrace: null,
};

const CLE_SESSION = "vtt-session";
type Reponse = { ok: boolean; erreur?: string; [cle: string]: unknown };
type EcouteurCarte = (evenement: string, donnees: any) => void;

class Jeu {
  private etat: EtatJeu = ETAT_INITIAL;
  private abonnes = new Set<() => void>();
  private ecouteursCarte = new Set<EcouteurCarte>();
  private compteurJournal = 0;
  private jeton: string | null = null; // le "badge" de cette session (envoye au serveur, verifie par lui)
  socket: Socket | null = null;
  // Traces tactiques de la table : gardees hors du magasin (pas besoin de
  // redessiner l'interface), mais memorisees pour la carte qui s'ouvre.
  traces = new Map<string, Trace>();

  // --- Magasin ------------------------------------------------------------
  lire = () => this.etat;

  abonner = (rappel: () => void) => {
    this.abonnes.add(rappel);
    return () => {
      this.abonnes.delete(rappel);
    };
  };

  modifier(changement: Partial<EtatJeu> | ((e: EtatJeu) => Partial<EtatJeu>)) {
    const partiel = typeof changement === "function" ? changement(this.etat) : changement;
    this.etat = { ...this.etat, ...partiel }; // nouvel objet : React voit le changement
    for (const rappel of this.abonnes) rappel();
  }

  journaliser(texte: string, type: LigneJournal["type"] = "systeme", message?: LigneJournal["message"]) {
    const ligne = { id: ++this.compteurJournal, texte, type, ...(message && { message }) };
    this.modifier((e) => ({ journal: [...e.journal.slice(-199), ligne] }));
  }

  private versLaCarte(evenement: string, donnees: unknown) {
    for (const rappel of this.ecouteursCarte) rappel(evenement, donnees);
  }

  // --- Equipement, barre d'actions, butin --------------------------------------------
  // Chaque action n'est qu'une DEMANDE : la fiche a jour revient du serveur
  // (evenement personnage:maj) et l'interface se redessine d'elle-meme.

  equiper(idPersonnage: string, idObjet: string, emplacement?: string) {
    return this.demander(EVENEMENTS.EQUIPER, { idPersonnage, idObjet, ...(emplacement ? { emplacement } : {}) });
  }
  desequiper(idPersonnage: string, emplacement: string) {
    return this.demander(EVENEMENTS.DESEQUIPER, { idPersonnage, emplacement });
  }
  definirRaccourci(idPersonnage: string, index: number, raccourci: Raccourci | null) {
    return this.demander(EVENEMENTS.BARRE_DEFINIR, { idPersonnage, index, raccourci });
  }
  /** Utiliser un objet : une potion agit tout de suite ; une arme ouvre la fenetre de resolution. */
  async utiliser(idPersonnage: string, reference: string) {
    const r = await this.demander(EVENEMENTS.OBJET_UTILISER, { idPersonnage, reference });
    if (r.ok && r.jet) this.modifier({ jet: r.jet as Jet });
    return r;
  }

  /** Lancer un sort : le serveur lance les des, la fenetre de resolution s'ouvre. */
  async lancerSort(idPersonnage: string, reference: string) {
    const r = await this.demander(EVENEMENTS.SORT_LANCER, { idPersonnage, reference });
    if (r.ok) this.modifier({ jet: r.jet as Jet });
    return r;
  }

  /** Test de caracteristique ou sauvegarde : le serveur lit le bonus dans la fiche. */
  async lancerTest(idPersonnage: string, genre: "caracteristique" | "sauvegarde", caracteristique: string, avantage: Avantage) {
    if (this.etat.jet) return; // un jet attend deja "Valider"
    const r = await this.demander(EVENEMENTS.TEST_LANCER, { idPersonnage, genre, caracteristique, avantage });
    if (r.ok) this.modifier({ jet: r.jet as Jet });
    return r;
  }

  /**
   * Des libres. fenetre = true (lanceur de des) : fenetre de resolution animee,
   * resultat annonce a "Valider" ; sinon (/jet) : resultat direct dans la discussion.
   */
  async lancerDes(formule: string, raison?: string, secret?: boolean, fenetre = false) {
    if (fenetre && this.etat.jet?.statut === "en-attente") return { ok: false, erreur: "Valide d'abord le jet en cours." };
    const r = await this.demander(EVENEMENTS.DES_LANCER, { formule, ...(raison ? { raison } : {}), ...(secret ? { secret } : {}), ...(fenetre ? { fenetre } : {}) });
    if (r.ok && r.jet) this.modifier({ jet: r.jet as Jet });
    return r;
  }

  /** "Valider" : le resultat part a toute la table. */
  async validerJet() {
    const jet = this.etat.jet;
    if (!jet || jet.statut === "valide") return this.modifier({ jet: null });
    const r = await this.demander(EVENEMENTS.JET_VALIDER, { idJet: jet.id });
    if (r.ok || r.erreur === "Ce jet a deja ete valide.") this.modifier({ jet: null });
  }

  // --- Outils du MJ ------------------------------------------------------------
  /** Le compendium du MJ (refuse par le serveur a un joueur). Garde en memoire. */
  async chargerCompendium(forcer = false) {
    if (this.etat.compendium && !forcer) return;
    const r = await this.demander(EVENEMENTS.COMPENDIUM_LISTER);
    if (r.ok) {
      const { ok: _ok, ...compendium } = r;
      this.modifier({ compendium: compendium as unknown as Compendium });
    }
  }

  // --- Discussion -------------------------------------------------------------
  /** Dire / groupe : a toute la table. Murmure : au seul destinataire (le serveur trie). */
  envoyerMessage(canal: MessageChat["canal"], texte: string, destinataire?: string) {
    return this.demander(EVENEMENTS.CHAT_ENVOYER, { canal, texte, ...(destinataire ? { destinataire } : {}) });
  }

  private recevoirMessage(m: MessageChat) {
    const moi = this.etat.profil?.pseudo.toLocaleLowerCase("fr");
    const envoye = m.canal === "murmure" && m.de.toLocaleLowerCase("fr") === moi;
    const heure = new Date(m.horodatage).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" });
    this.journaliser(m.texte, m.canal, { pseudo: envoye ? m.vers! : m.de, nom: envoye ? m.vers! : m.nom, vers: m.vers, envoye, heure });
  }

  // --- Journal de quetes (MJ seulement : le serveur refuse les joueurs) ---------
  donnerQuete(titre: string, objectif: string, description?: string) {
    return this.demander(EVENEMENTS.QUETE_AJOUTER, { titre, objectif, ...(description ? { description } : {}) });
  }
  changerQuete(idQuete: string, statut: Quete["statut"]) {
    return this.demander(EVENEMENTS.QUETE_MODIFIER, { idQuete, statut });
  }
  retirerQuete(idQuete: string) {
    return this.demander(EVENEMENTS.QUETE_SUPPRIMER, { idQuete });
  }

  private compteurAnnonces = 0;
  private annoncer(titre: string, texte: string) {
    const id = ++this.compteurAnnonces;
    this.modifier({ annonce: { id, titre, texte } });
    setTimeout(() => this.etat.annonce?.id === id && this.modifier({ annonce: null }), 4500);
  }

  /** Clic sur un coffre de la carte : le serveur verifie qu'on est a cote, puis envoie le contenu. */
  async ouvrirButin(idButin: string, position: { x: number; y: number }) {
    const r = await this.demander(EVENEMENTS.BUTIN_OUVRIR, { idButin });
    if (r.ok) this.modifier({ butin: { ...(r.butin as Omit<ButinOuvert, "x" | "y">), ...position } });
  }
  fermerButin() {
    if (!this.etat.butin) return;
    this.modifier({ butin: null });
    this.demander(EVENEMENTS.BUTIN_FERMER, {});
  }
  /** Prendre un objet du butin : dans SON sac (le MJ : dans celui du personnage cible). */
  prendreButin(objet: Objet, idButin = this.etat.butin?.id, idPersonnage = this.personnageDesSacs()?.id) {
    if (!idButin) return;
    return this.demander(EVENEMENTS.BUTIN_PRENDRE, { idButin, idObjet: objet.id, ...(this.estMJ() && idPersonnage ? { idPersonnage } : {}) });
  }

  /** La classe d'un personnage dans le referentiel (caracteristique d'incantation, progression des sorts). */
  classeDe(p: Personnage | null) {
    return (p && this.etat.referentiel?.classes.find((c) => c.id === p.classe)) || null;
  }

  /** Nom affiche d'une classe ou d'une race (celui du referentiel ; a defaut, l'identifiant). */
  nomClasse(id: string) {
    if (id === "monstre") return "Monstre"; // PNJ invoque depuis le bestiaire
    return this.etat.referentiel?.classes.find((c) => c.id === id)?.nom ?? id;
  }
  nomRace(id: string | null) {
    return id ? (this.etat.referentiel?.races.find((r) => r.id === id)?.nom ?? id) : "";
  }

  /** Couleur de mes pings et de mes traces (le MJ : or ; un joueur : la couleur de ses pions). */
  maCouleur() {
    return this.etat.profil ? couleurDe(this.etat.profil) : "#ffd100";
  }

  /** Debut des identifiants de mes traces, le meme que celui fabrique par le serveur. */
  prefixeTraces() {
    return `${this.etat.profil?.pseudo.trim().toLocaleLowerCase("fr") ?? "moi"}:`;
  }

  /** Canal direct vers le moteur de carte (messages frequents). */
  ecouterCarte(rappel: EcouteurCarte) {
    this.ecouteursCarte.add(rappel);
    return () => {
      this.ecouteursCarte.delete(rappel);
    };
  }

  // --- Personnages utiles a l'interface ------------------------------------------
  estMJ() {
    return this.etat.profil?.role === ROLES.MJ;
  }

  mesPersonnages(etat = this.etat) {
    const moi = etat.profil?.pseudo.toLocaleLowerCase("fr");
    return Object.values(etat.personnages).filter((p) => p.proprietaire?.toLocaleLowerCase("fr") === moi);
  }

  /** Personnage dont on ouvre la fiche (C) : la cible, sinon le sien. */
  personnageActif(etat = this.etat): Personnage | null {
    return (etat.selection && etat.personnages[etat.selection]) || this.mesPersonnages(etat)[0] || null;
  }

  /**
   * Personnage dont on ouvre les sacs (B). Comme dans WoW, un joueur n'ouvre
   * que SES sacs, meme s'il a cible un compagnon ; le MJ ouvre ceux de la cible.
   */
  personnageDesSacs(etat = this.etat): Personnage | null {
    if (etat.profil?.role === ROLES.MJ) return this.personnageActif(etat);
    return this.mesPersonnages(etat)[0] ?? null;
  }

  // --- Echanges avec le serveur ----------------------------------------------------
  demander(evenement: string, donnees: unknown = {}): Promise<Reponse> {
    return new Promise((resoudre) => {
      if (!this.socket?.connected) return resoudre({ ok: false, erreur: "Pas de liaison avec le serveur." });
      this.socket.timeout(5000).emit(evenement, donnees, (delaiDepasse: Error | null, reponse: Reponse) => {
        const resultat = delaiDepasse ? { ok: false, erreur: "Le serveur ne repond pas." } : reponse;
        if (!resultat.ok) this.journaliser(resultat.erreur ?? "Refus du serveur.", "erreur");
        resoudre(resultat);
      });
    });
  }

  async connecter(role: string, pseudo: string, motDePasse: string): Promise<string | null> {
    try {
      const reponse = await fetch("/api/connexion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, pseudo, motDePasse }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok) return donnees.erreur ?? "Connexion refusee.";
      this.demarrer(donnees.jeton, donnees.profil);
      return null;
    } catch {
      return "Serveur injoignable.";
    }
  }

  /** Apres un F5 : on reprend la session de cet onglet. */
  reprendreSession() {
    try {
      const brut = sessionStorage.getItem(CLE_SESSION);
      if (brut) {
        const { jeton, profil, idTable } = JSON.parse(brut);
        this.demarrer(jeton, profil, idTable);
      }
    } catch {
      /* stockage indisponible : on repasse par l'ecran de connexion */
    }
  }

  private memoriser(donnees: object) {
    try {
      const actuel = JSON.parse(sessionStorage.getItem(CLE_SESSION) ?? "{}");
      sessionStorage.setItem(CLE_SESSION, JSON.stringify({ ...actuel, ...donnees }));
    } catch {
      /* sans memoire, un F5 ramene simplement a la connexion */
    }
  }

  deconnecter(avis: string | null = null) {
    this.socket?.disconnect();
    this.socket = null;
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      /* rien a effacer */
    }
    this.etat = { ...ETAT_INITIAL, avis };
    for (const rappel of this.abonnes) rappel();
  }

  /**
   * Rejoindre une table. Le SERVEUR decide de l'etape suivante :
   *  - creationRequise : pas encore de personnage ici -> ecran de creation ;
   *  - sinon : la photo complete de la table -> ecran de jeu.
   */
  async rejoindre(idTable: string) {
    const r = await this.demander(EVENEMENTS.TABLE_REJOINDRE, { idTable });
    if (!r.ok) {
      this.memoriser({ idTable: null });
      this.modifier({ avis: r.erreur ?? null }); // ex. "Le Maitre du Jeu t'a expulse de cette table."
      return;
    }
    this.modifier({ avis: null });
    this.memoriser({ idTable });
    if (r.creationRequise) {
      this.modifier({ table: r.table as Table, creationRequise: true, personnages: {}, scene: null, combat: null });
      return;
    }
    this.entrer(r);
  }

  /**
   * "Entrer dans le monde" : le serveur verifie les choix, cree la fiche, pose
   * le pion, fait entrer ce navigateur dans les salons de la table et renvoie
   * la meme photo complete qu'un "rejoindre". Pas de rechargement de page, pas
   * de nouveau jeton : la connexion deja ouverte passe simplement en jeu.
   */
  async creerPersonnage(choix: unknown) {
    const r = await this.demander(EVENEMENTS.CREATION_VALIDER, { donnees: choix });
    if (r.ok) this.entrer(r);
    return r;
  }

  /** Retour au choix de la table (depuis l'ecran de creation). */
  quitterTable() {
    this.memoriser({ idTable: null });
    this.modifier({ table: null, creationRequise: false, personnages: {}, scene: null, combat: null });
  }

  private entrer(r: Reponse) {
    const traces = (r.traces as Trace[] | undefined) ?? [];
    this.traces = new Map(traces.map((t) => [t.id, t]));
    this.versLaCarte(EVENEMENTS.DESSINS_ETAT, { traces }); // retour apres une coupure : la carte est deja ouverte
    const personnages = Object.fromEntries((r.personnages as Personnage[]).map((p) => [p.id, p]));
    this.modifier({
      quetes: (r.quetes as Quete[] | undefined) ?? [],
      table: r.table as Table,
      creationRequise: false,
      personnages,
      scene: r.scene as Scene,
      combat: r.combat as Combat,
    });
    this.journaliser(`Bienvenue a la table "${(r.table as Table).nom}".`);
  }

  /** MJ : televerse une image de carte (ecrite par le serveur dans cartes/ du cloud). */
  async televerserCarte(fichier: File): Promise<{ fichier?: string; erreur?: string }> {
    try {
      const reponse = await fetch(`/api/cartes?nom=${encodeURIComponent(fichier.name)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.jeton}`, "Content-Type": "application/octet-stream" },
        body: fichier,
      });
      const donnees = await reponse.json().catch(() => ({ erreur: "Reponse illisible du serveur." }));
      if (!reponse.ok) this.journaliser(donnees.erreur ?? "Televersement refuse.", "erreur");
      return reponse.ok ? donnees : { erreur: donnees.erreur ?? "Televersement refuse." };
    } catch {
      return { erreur: "Serveur injoignable." };
    }
  }

  private demarrer(jeton: string, profil: Profil, idTable?: string) {
    this.jeton = jeton;
    this.memoriser({ jeton, profil });
    this.modifier({ profil });
    const socket = io({ auth: { jeton } });
    this.socket = socket;

    socket.on("connect", async () => {
      this.modifier({ liaison: "connecte" });
      const r = await this.demander(EVENEMENTS.TABLES_LISTER);
      if (r.ok) this.modifier({ tables: r.tables as Table[] });
      const ref = await this.demander(EVENEMENTS.REFERENTIEL_LISTER);
      if (ref.ok) {
        const { ok: _ok, ...referentiel } = ref;
        this.modifier({ referentiel: referentiel as unknown as Referentiel });
      }
      const table = idTable ?? this.etat.table?.id;
      if (table) await this.rejoindre(table); // retour automatique apres une coupure
    });
    socket.on("disconnect", () => this.modifier({ liaison: "reconnexion" }));
    socket.on("connect_error", (erreur) => {
      if (erreur.message === "non-authentifie") this.deconnecter(); // jeton perime
    });

    socket.on(EVENEMENTS.TABLES_LISTE, ({ tables }) => this.modifier({ tables }));
    // MJ : le compendium a ete recharge (fichiers modifies) -> on relit.
    socket.on(EVENEMENTS.COMPENDIUM_MAJ, ({ rapport }) => {
      if (this.etat.compendium) this.chargerCompendium(true);
      this.journaliser(`Compendium recharge : ${rapport.objets} objets, ${rapport.sorts} sorts, ${rapport.monstres ?? 0} monstres.`);
      for (const e of rapport.erreurs ?? []) this.journaliser(`compendium/${e.fichier} > ${e.emplacement} : ${e.message}`, "erreur");
    });
    // Le MJ a recharge les fichiers du referentiel : l'ecran de creation se met a jour.
    socket.on(EVENEMENTS.REFERENTIEL_MAJ, ({ referentiel }) => this.modifier({ referentiel }));
    socket.on(EVENEMENTS.TABLE_PRESENCE, ({ connectes }) => this.modifier({ presence: connectes }));

    socket.on(EVENEMENTS.PERSONNAGE_MAJ, ({ personnage, cause }) => {
      this.modifier((e) => ({ personnages: { ...e.personnages, [personnage.id]: personnage } }));
      const texte = decrireCause(personnage, cause);
      if (texte) this.journaliser(texte, cause.action === "objet-recu" ? "butin" : "systeme");
    });
    socket.on(EVENEMENTS.PERSONNAGE_SUPPRIME, ({ idPersonnage }) => {
      this.modifier((e) => {
        const { [idPersonnage]: _supprime, ...reste } = e.personnages;
        return { personnages: reste, selection: e.selection === idPersonnage ? null : e.selection };
      });
    });

    // Quelqu'un s'est servi dans le butin que j'ai ouvert : ma fenetre se met a jour.
    socket.on(EVENEMENTS.BUTIN_MAJ, ({ idButin, butin, supprime }) => {
      if (this.etat.butin?.id !== idButin) return;
      this.modifier((e) => ({ butin: supprime ? null : { ...e.butin!, objets: butin.objets } }));
    });

    // Journal de quetes : le MJ en pousse une -> elle s'ajoute chez tout le monde.
    socket.on(EVENEMENTS.QUETES_ETAT, ({ quetes, cause }) => {
      this.modifier({ quetes });
      if (cause?.action === "nouvelle") {
        this.annoncer("Nouvelle quete", cause.titre);
        this.journaliser(`Nouvelle quete : ${cause.titre}. (Journal de quetes : touche L)`, "butin");
      } else if (cause?.action === "terminee") {
        this.annoncer("Quete terminee", cause.titre);
        this.journaliser(`Quete terminee : ${cause.titre}.`, "butin");
      } else if (cause?.action === "echouee") this.journaliser(`Quete echouee : ${cause.titre}.`, "erreur");
    });

    // Fenetre de resolution : le MJ voit s'ouvrir le jet d'un joueur, puis tout le monde recoit le resultat.
    socket.on(EVENEMENTS.JET_EN_COURS, ({ jet }: { jet: Jet }) => {
      // Le MJ a lui-meme un jet a valider : on ne le lui cache pas sous celui d'un joueur.
      const actuel = this.etat.jet;
      const moi = this.etat.profil?.pseudo.toLocaleLowerCase("fr");
      if (actuel && actuel.id !== jet.id && actuel.statut === "en-attente" && actuel.par.toLocaleLowerCase("fr") === moi) return;
      this.modifier({ jet });
    });
    socket.on(EVENEMENTS.JET_RESULTAT, ({ jet }: { jet: Jet }) => {
      this.journaliser(decrireJet(jet), "des");
      if (this.etat.jet?.id !== jet.id) return;
      this.modifier({ jet }); // le MJ voit "Valide" quelques instants
      setTimeout(() => this.etat.jet?.id === jet.id && this.modifier({ jet: null }), 2500);
    });

    socket.on(EVENEMENTS.COMBAT_ETAT, ({ combat, cause }) => {
      this.modifier({ combat });
      if (cause) this.journaliser(decrireCombat(cause), "combat"); // sans cause : simple mise a jour (un monstre apparait)
    });

    // Discussion, sons, expulsion.
    socket.on(EVENEMENTS.CHAT_MESSAGE, (m: MessageChat) => this.recevoirMessage(m));
    socket.on(EVENEMENTS.SON_JOUER, ({ son }: { son: string }) => audio.jouer(son));
    socket.on(EVENEMENTS.JOUEUR_EXPULSE, ({ message }: { message: string }) => this.deconnecter(message));
    socket.on(EVENEMENTS.DES_RESULTAT, (resultat) => this.journaliser(decrireDes(resultat), "des"));

    // La carte : l'etat complet passe par le magasin, le reste va direct au moteur.
    socket.on(EVENEMENTS.SCENE_ETAT, ({ scene }) => this.modifier({ scene }));
    for (const evenement of [
      EVENEMENTS.PION_POSITION,
      EVENEMENTS.BROUILLARD_TRAIT_AJOUTE,
      EVENEMENTS.SCENE_GRILLE_MAJ,
      EVENEMENTS.CARTE_PING_RECU,
      EVENEMENTS.COMBAT_TEXTE,
    ]) {
      socket.on(evenement, (donnees) => this.versLaCarte(evenement, donnees));
    }

    // Traces tactiques : memorisees ici, et transmises a la carte.
    socket.on(EVENEMENTS.DESSIN_AJOUTE, (morceau: Trace) => {
      const trace = this.traces.get(morceau.id);
      if (trace) trace.points.push(...morceau.points);
      else this.traces.set(morceau.id, { ...morceau, points: [...morceau.points] });
      this.versLaCarte(EVENEMENTS.DESSIN_AJOUTE, morceau);
    });
    socket.on(EVENEMENTS.DESSINS_ETAT, ({ traces }: { traces: Trace[] }) => {
      this.traces = new Map(traces.map((t) => [t.id, t]));
      this.versLaCarte(EVENEMENTS.DESSINS_ETAT, { traces });
    });
  }
}

export const jeu = new Jeu();

/** Lit une partie de l'etat ; le composant se redessine quand elle change. */
export function useJeu<T>(selecteur: (etat: EtatJeu) => T): T {
  return useSyncExternalStore(jeu.abonner, () => selecteur(jeu.lire()));
}
