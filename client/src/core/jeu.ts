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
import { EVENEMENTS, ROLES } from "@partage/protocole.js";
import type { Combat, LigneJournal, Personnage, Profil, Scene, Table } from "./types";
import { decrireCause, decrireCombat, decrireDes } from "./journal";

export type EtatJeu = {
  liaison: "deconnecte" | "connecte" | "reconnexion";
  profil: Profil | null;
  tables: Table[];
  table: Table | null;
  personnages: Record<string, Personnage>;
  scene: Scene | null;
  combat: Combat;
  presence: { pseudo: string; role: string }[];
  journal: LigneJournal[];
  selection: string | null; // personnage cible (clic sur un cadre de groupe)
  fenetres: { sacs: boolean; personnage: boolean };
};

const ETAT_INITIAL: EtatJeu = {
  liaison: "deconnecte",
  profil: null,
  tables: [],
  table: null,
  personnages: {},
  scene: null,
  combat: null,
  presence: [],
  journal: [],
  selection: null,
  fenetres: { sacs: false, personnage: false },
};

const CLE_SESSION = "vtt-session";
type Reponse = { ok: boolean; erreur?: string; [cle: string]: unknown };
type EcouteurCarte = (evenement: string, donnees: any) => void;

class Jeu {
  private etat: EtatJeu = ETAT_INITIAL;
  private abonnes = new Set<() => void>();
  private ecouteursCarte = new Set<EcouteurCarte>();
  private compteurJournal = 0;
  socket: Socket | null = null;

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

  journaliser(texte: string, type: LigneJournal["type"] = "systeme") {
    const ligne = { id: ++this.compteurJournal, texte, type };
    this.modifier((e) => ({ journal: [...e.journal.slice(-199), ligne] }));
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

  /** Personnage dont on ouvre les sacs / la fiche : la cible, sinon le sien. */
  personnageActif(etat = this.etat): Personnage | null {
    return (etat.selection && etat.personnages[etat.selection]) || this.mesPersonnages(etat)[0] || null;
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

  deconnecter() {
    this.socket?.disconnect();
    this.socket = null;
    try {
      sessionStorage.removeItem(CLE_SESSION);
    } catch {
      /* rien a effacer */
    }
    this.etat = ETAT_INITIAL;
    for (const rappel of this.abonnes) rappel();
  }

  async rejoindre(idTable: string) {
    const r = await this.demander(EVENEMENTS.TABLE_REJOINDRE, { idTable });
    if (!r.ok) {
      this.memoriser({ idTable: null });
      return;
    }
    this.memoriser({ idTable });
    const personnages = Object.fromEntries((r.personnages as Personnage[]).map((p) => [p.id, p]));
    this.modifier({
      table: r.table as Table,
      personnages,
      scene: r.scene as Scene,
      combat: r.combat as Combat,
    });
    this.journaliser(`Bienvenue a la table "${(r.table as Table).nom}".`);
  }

  private demarrer(jeton: string, profil: Profil, idTable?: string) {
    this.memoriser({ jeton, profil });
    this.modifier({ profil });
    const socket = io({ auth: { jeton } });
    this.socket = socket;

    socket.on("connect", async () => {
      this.modifier({ liaison: "connecte" });
      const r = await this.demander(EVENEMENTS.TABLES_LISTER);
      if (r.ok) this.modifier({ tables: r.tables as Table[] });
      const table = idTable ?? this.etat.table?.id;
      if (table) await this.rejoindre(table); // retour automatique apres une coupure
    });
    socket.on("disconnect", () => this.modifier({ liaison: "reconnexion" }));
    socket.on("connect_error", (erreur) => {
      if (erreur.message === "non-authentifie") this.deconnecter(); // jeton perime
    });

    socket.on(EVENEMENTS.TABLES_LISTE, ({ tables }) => this.modifier({ tables }));
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

    socket.on(EVENEMENTS.COMBAT_ETAT, ({ combat, cause }) => {
      this.modifier({ combat });
      this.journaliser(decrireCombat(cause), "combat");
    });
    socket.on(EVENEMENTS.DES_RESULTAT, (resultat) => this.journaliser(decrireDes(resultat), "des"));

    // La carte : l'etat complet passe par le magasin, le reste va direct au moteur.
    socket.on(EVENEMENTS.SCENE_ETAT, ({ scene }) => this.modifier({ scene }));
    for (const evenement of [EVENEMENTS.PION_POSITION, EVENEMENTS.BROUILLARD_TRAIT_AJOUTE, EVENEMENTS.SCENE_GRILLE_MAJ]) {
      socket.on(evenement, (donnees) => {
        for (const rappel of this.ecouteursCarte) rappel(evenement, donnees);
      });
    }
  }
}

export const jeu = new Jeu();

/** Lit une partie de l'etat ; le composant se redessine quand elle change. */
export function useJeu<T>(selecteur: (etat: EtatJeu) => T): T {
  return useSyncExternalStore(jeu.abonner, () => selecteur(jeu.lire()));
}
