// Moteur de carte : HTML5 Canvas 2D natif, sans aucune dependance.
// Fichier PARTAGE entre la page de test et l'interface WoW (navigateur uniquement).
//
// Pourquoi un Canvas (et pas des elements HTML ou du SVG) ?
//  - Le brouillard est une affaire de PIXELS : la gomme "creuse" un calque noir
//    comme on gratte un ticket. Le Canvas sait le faire nativement (mode de
//    fusion "destination-out") ; en HTML/SVG, il faudrait empiler des milliers
//    de formes, et l'affichage ralentirait a chaque coup de pinceau.
//  - Une carte de 2000 x 2000 px (ou 8000 x 8000) avec zoom et deplacement de
//    la vue : le Canvas redessine tout en une passe, 60 fois par seconde.
//  - Ce fichier ne depend de rien (ni React, ni bibliotheque) : la future
//    interface WoW le reutilisera tel quel.
//
// Le dessin se fait en "calques", du fond vers le dessus :
//   1. l'image de la carte       2. la grille
//   3. butins (coffres, cadavres) et pions des monstres
//   4. le brouillard (il les recouvre)
//   5. les traces tactiques      6. les pions des joueurs (jamais sous le brouillard)
//   7. les effets animes : pings et textes de combat flottants
//
// Coordonnees : tout est exprime en pixels DE L'IMAGE de la carte. La "vue"
// (zoom, decalage) est propre a chaque ecran et n'est jamais partagee.
import { aimanter, borner, caseDe, distanceEnCases, METRES_PAR_CASE } from "./geometrie.js";

const TAILLE_MAX_BROUILLARD = 2048; // resolution max du calque de brouillard (memoire)
const INTERVALLE_ENVOI_MS = 50; // ~20 positions par seconde pendant un glisser
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;
const DELAI_ENTRE_PINGS_MS = 400;
const DUREE_PING_MS = 1600;

// Textes de combat flottants (facon WoW) : taille en pixels d'ECRAN, pour
// rester lisibles quel que soit le zoom de la carte.
const STYLES_TEXTE = {
  degats: { couleur: "#ffffff", taille: 30, duree: 1400 },
  critique: { couleur: "#ffd100", taille: 48, duree: 1800 },
  soins: { couleur: "#3cff3c", taille: 30, duree: 1400 },
};

export class MoteurCarte {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} options
   *   estMJ                      : boolean
   *   peutDeplacer(pion)         : ce navigateur a-t-il le droit de bouger ce pion ?
   *   surSaisie(pion)            : Promise<boolean> (le serveur accorde-t-il le pion ?)
   *   surDeplacement(pion, x, y, final, aimanter) : Promise<{x, y} | null>
   *   surTrait(trait)            : un morceau de trait de gomme / pinceau a envoyer
   *   surInfo(texte)             : ligne d'information (case, distance...)
   *   surChangement()            : (facultatif) la carte a change (pour la minicarte)
   *   surPing(x, y)              : (facultatif) un ping a envoyer aux autres
   *   surTrace(morceau)          : (facultatif) un morceau de trace tactique a envoyer
   *   couleur                    : (facultatif) couleur de ce participant (pings, traces)
   *   prefixeTraces              : (facultatif) debut des identifiants de SES traces ("thrall:")
   *   police                     : (facultatif) police des textes de combat
   *   surButin(butin, clientX, clientY) : (facultatif) clic sur un coffre / cadavre
   *   surMenuPion(pion, clientX, clientY) : (facultatif) clic droit sur un pion (menu du MJ)
   */
  constructor(canvas, options) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = options;

    this.scene = null;
    this.image = null;
    this.fichierCharge = undefined;
    this.affichage = new Map(); // idPion -> position affichee (animee)
    this.vue = { x: 0, y: 0, zoom: 0.35 }; // x, y = point de la carte en haut a gauche
    this.outil = "deplacer"; // "deplacer" | "tracer" | "ping" | "gomme" | "pinceau" (les 2 derniers : MJ)
    this.couleurTrace = null; // null = sa propre couleur
    this.traces = new Map(); // traces tactiques : id -> { id, couleur, points }
    this.effets = []; // animations en cours : pings, textes de combat
    this.dernierPing = 0;
    this.rayonPinceau = 60;
    this.voirAtravers = true; // le MJ voit la carte sous le brouillard (en grise)
    this.aimanter = true;
    this.selection = null; // pion "cible" (cercle au sol)
    this.geste = null; // geste en cours : glisser un pion, deplacer la vue, peindre
    this.souris = null;

    this.brouillard = document.createElement("canvas"); // calque hors ecran
    this.brouillardCtx = this.brouillard.getContext("2d");
    this.echelleBrouillard = 1;

    this.sale = true;
    this.brancherEvenements();
    const boucle = () => {
      this.animer();
      if (this.effets.length) this.sale = true; // une animation est en cours
      if (this.sale) {
        this.dessiner();
        this.options.surChangement?.();
      }
      requestAnimationFrame(boucle);
    };
    requestAnimationFrame(boucle);
  }

  // ===== Donnees recues du serveur ==========================================

  /** Photo complete de la scene (a l'arrivee, ou apres un gros changement). */
  chargerScene(scene) {
    const ancienne = this.scene;
    this.scene = scene;

    if (scene.carte.fichier !== this.fichierCharge) {
      this.fichierCharge = scene.carte.fichier;
      this.image = new Image();
      this.image.onload = () => (this.sale = true);
      this.image.src = scene.carte.fichier
        ? `/medias/cartes/${encodeURIComponent(scene.carte.fichier)}`
        : "/medias/cartes/aucune-carte"; // carre gris de 2000 px
      if (!ancienne || ancienne.carte.largeur !== scene.carte.largeur || ancienne.carte.hauteur !== scene.carte.hauteur) {
        this.recentrer();
      }
    }

    // Les pions connus gardent leur position affichee (pas de saut) ; celui
    // qu'on est en train de glisser n'est pas repris en main par le serveur.
    const affichage = new Map();
    for (const pion of scene.pions) {
      if (this.geste?.type === "pion" && this.geste.idPion === pion.id) {
        affichage.set(pion.id, this.affichage.get(pion.id));
      } else {
        affichage.set(pion.id, this.affichage.get(pion.id) ?? { x: pion.x, y: pion.y });
      }
    }
    this.affichage = affichage;
    if (this.selection && !scene.pions.some((p) => p.id === this.selection)) this.selection = null;
    this.reconstruireBrouillard();
    this.sale = true;
  }

  majGrille(grille) {
    if (!this.scene) return;
    this.scene = { ...this.scene, grille };
    this.sale = true;
  }

  /** Un pion a bouge chez quelqu'un d'autre (ou la position officielle revient). */
  positionPion(idPion, x, y) {
    const pion = this.scene?.pions.find((p) => p.id === idPion);
    if (!pion) return; // pion inconnu ici (ex. monstre cache) : on ignore
    if (this.geste?.type === "pion" && this.geste.idPion === idPion) return; // c'est nous qui le tenons
    pion.x = x;
    pion.y = y; // l'affichage glisse vers cette cible (voir animer)
    this.sale = true;
  }

  /** Un morceau de trait de brouillard peint par le MJ. */
  ajouterTrait(trait) {
    if (!this.scene) return;
    this.scene.brouillard.traits.push(trait);
    this.appliquerTrait(trait);
    this.sale = true;
  }

  // --- Traces tactiques, pings, textes de combat -------------------------------

  /** Liste complete des traces (a l'arrivee, ou apres un effacement). */
  chargerTraces(traces) {
    this.traces = new Map(traces.map((t) => [t.id, { ...t, points: [...t.points] }]));
    // Une trace en cours chez nous survit (le serveur l'a peut-etre deja effacee : tant pis, on la garde a l'ecran).
    if (this.geste?.type === "trace") this.traces.set(this.geste.id, this.geste.trace);
    this.sale = true;
  }

  /** Un morceau de trace d'un autre participant : il se dessine sous nos yeux. */
  ajouterMorceauTrace({ id, couleur, points }) {
    const trace = this.traces.get(id);
    if (trace) trace.points.push(...points);
    else this.traces.set(id, { id, couleur, points: [...points] });
    this.sale = true;
  }

  /** Un cercle qui s'agrandit puis s'efface, pour attirer l'attention. */
  afficherPing(x, y, couleur, nom = "") {
    this.effets.push({ type: "ping", x, y, couleur, nom, debut: performance.now(), duree: DUREE_PING_MS });
    this.sale = true;
  }

  /**
   * Texte de combat flottant au-dessus du pion d'un personnage.
   * texte = { genre: "degats" | "soins", montant, critique, absorbe }
   * Renvoie false si le personnage n'a pas de pion sur la carte.
   */
  afficherTexteCombat(idPersonnage, texte) {
    const pion = this.scene?.pions.find((p) => p.idPersonnage === idPersonnage);
    if (!pion) return false;
    const maintenant = performance.now();
    // Plusieurs coups rapproches : on les decale a gauche / a droite pour qu'ils restent lisibles.
    const voisins = this.effets.filter((e) => e.type === "texte" && e.idPion === pion.id && maintenant - e.debut < 500).length;
    const style = STYLES_TEXTE[texte.genre === "soins" ? "soins" : texte.critique ? "critique" : "degats"];
    this.effets.push({ type: "texte", idPion: pion.id, ...texte, style, colonne: [0, -1, 1][voisins % 3], debut: maintenant, duree: style.duree });
    this.sale = true;
    return true;
  }

  // ===== Reglages locaux (non partages) =======================================

  choisirOutil(outil) {
    this.outil = outil;
    this.sale = true;
  }

  /** La surface d'affichage a change de taille (fenetre redimensionnee). */
  redimensionner(largeur, hauteur) {
    if (this.canvas.width === largeur && this.canvas.height === hauteur) return;
    // On garde le meme point de la carte au centre de l'ecran.
    const centre = {
      x: this.vue.x + this.canvas.width / 2 / this.vue.zoom,
      y: this.vue.y + this.canvas.height / 2 / this.vue.zoom,
    };
    this.canvas.width = largeur;
    this.canvas.height = hauteur;
    this.vue.x = centre.x - largeur / 2 / this.vue.zoom;
    this.vue.y = centre.y - hauteur / 2 / this.vue.zoom;
    this.sale = true;
  }

  /**
   * Vue d'ensemble de toute la carte dans un autre canvas (la minicarte) :
   * image, pions (des points) et brouillard, comme sur l'ecran principal.
   */
  dessinerApercu(cible) {
    const c = cible.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#000";
    c.fillRect(0, 0, cible.width, cible.height);
    if (!this.scene) return;
    const { largeur, hauteur } = this.scene.carte;
    const echelle = Math.max(cible.width / largeur, cible.height / hauteur); // remplit le cercle
    c.setTransform(echelle, 0, 0, echelle, (cible.width - largeur * echelle) / 2, (cible.height - hauteur * echelle) / 2);
    if (this.image?.complete && this.image.naturalWidth) c.drawImage(this.image, 0, 0, largeur, hauteur);
    const point = (pion) => {
      const { x, y } = this.affichage.get(pion.id) ?? pion;
      c.fillStyle = pion.couleur;
      c.beginPath();
      c.arc(x, y, Math.max(this.rayonPion(pion), 3 / echelle), 0, Math.PI * 2);
      c.fill();
    };
    // Meme ordre que la grande carte : monstres sous le brouillard, groupe par-dessus.
    for (const pion of this.scene.pions) if (pion.proprietaire == null) point(pion);
    if (this.scene.brouillard.actif) {
      c.globalAlpha = this.options.estMJ && this.voirAtravers ? 0.5 : 1;
      c.drawImage(this.brouillard, 0, 0, largeur, hauteur);
      c.globalAlpha = 1;
    }
    for (const pion of this.scene.pions) if (pion.proprietaire != null) point(pion);
  }

  recentrer() {
    if (!this.scene) return;
    const { largeur, hauteur } = this.scene.carte;
    const zoom = Math.min(this.canvas.width / largeur, this.canvas.height / hauteur) * 0.95;
    this.vue = {
      zoom,
      x: largeur / 2 - this.canvas.width / 2 / zoom,
      y: hauteur / 2 - this.canvas.height / 2 / zoom,
    };
    this.sale = true;
  }

  // ===== Brouillard ==============================================================
  // Un calque hors ecran, a la taille de la carte (reduit au besoin pour la
  // memoire), rempli de noir. La gomme y "creuse" des trous transparents.

  reconstruireBrouillard() {
    const { largeur, hauteur } = this.scene.carte;
    this.echelleBrouillard = Math.min(1, TAILLE_MAX_BROUILLARD / Math.max(largeur, hauteur));
    this.brouillard.width = Math.ceil(largeur * this.echelleBrouillard);
    this.brouillard.height = Math.ceil(hauteur * this.echelleBrouillard);
    const c = this.brouillardCtx;
    c.globalCompositeOperation = "source-over";
    c.fillStyle = "#000";
    c.fillRect(0, 0, this.brouillard.width, this.brouillard.height);
    for (const trait of this.scene.brouillard.traits) this.appliquerTrait(trait);
  }

  appliquerTrait(trait) {
    const c = this.brouillardCtx;
    const e = this.echelleBrouillard;
    if (trait.mode === "tout-reveler") {
      c.clearRect(0, 0, this.brouillard.width, this.brouillard.height);
      return;
    }
    // "destination-out" = ce qu'on dessine EFFACE le calque (gomme).
    c.globalCompositeOperation = trait.mode === "reveler" ? "destination-out" : "source-over";
    c.fillStyle = c.strokeStyle = "#000";
    c.lineCap = c.lineJoin = "round";
    c.lineWidth = trait.rayon * 2 * e;
    c.beginPath();
    if (trait.points.length === 1) {
      const [x, y] = trait.points[0];
      c.arc(x * e, y * e, trait.rayon * e, 0, Math.PI * 2);
      c.fill();
    } else {
      trait.points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x * e, y * e) : c.lineTo(x * e, y * e)));
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  }

  // ===== Dessin ===================================================================

  versEcran(x, y) {
    return { x: (x - this.vue.x) * this.vue.zoom, y: (y - this.vue.y) * this.vue.zoom };
  }

  versCarte(evenement) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = ((evenement.clientX - rect.left) * this.canvas.width) / rect.width;
    const sy = ((evenement.clientY - rect.top) * this.canvas.height) / rect.height;
    return { x: sx / this.vue.zoom + this.vue.x, y: sy / this.vue.zoom + this.vue.y, sx, sy };
  }

  rayonPion(pion) {
    return this.scene.grille.taille * pion.taille * 0.42;
  }

  /** Les pions glissent en douceur vers leur position (mouvements des autres). */
  animer() {
    if (!this.scene) return;
    for (const pion of this.scene.pions) {
      const affiche = this.affichage.get(pion.id);
      if (!affiche || (this.geste?.type === "pion" && this.geste.idPion === pion.id)) continue;
      const dx = pion.x - affiche.x;
      const dy = pion.y - affiche.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.5) {
        if (dx || dy) (affiche.x = pion.x), (affiche.y = pion.y), (this.sale = true);
        continue;
      }
      affiche.x += dx * 0.35;
      affiche.y += dy * 0.35;
      this.sale = true;
    }
  }

  dessiner() {
    this.sale = false;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#222";
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.scene) return;

    const { zoom } = this.vue;
    const { largeur, hauteur } = this.scene.carte;
    // A partir d'ici, on dessine en coordonnees de la carte.
    c.setTransform(zoom, 0, 0, zoom, -this.vue.x * zoom, -this.vue.y * zoom);

    // 1. L'image de la carte
    if (this.image?.complete && this.image.naturalWidth) c.drawImage(this.image, 0, 0, largeur, hauteur);
    else (c.fillStyle = "#777"), c.fillRect(0, 0, largeur, hauteur);

    // 2. La grille
    this.dessinerGrille();

    // 3. Les butins (coffres, cadavres) et les pions des monstres : SOUS le brouillard.
    for (const butin of this.scene.butins ?? []) this.dessinerButin(butin);
    const estPJ = (pion) => pion.proprietaire != null;
    for (const pion of this.scene.pions) if (!estPJ(pion)) this.dessinerPion(pion);

    // 4. Le brouillard : opaque pour les joueurs, grise pour le MJ qui "voit a travers".
    if (this.scene.brouillard.actif) {
      c.globalAlpha = this.options.estMJ && this.voirAtravers ? 0.5 : 1;
      c.imageSmoothingEnabled = true; // bords adoucis
      c.drawImage(this.brouillard, 0, 0, largeur, hauteur);
      c.globalAlpha = 1;
    }

    // 5. Les traces tactiques, par-dessus le brouillard (on peut montrer un chemin dans le noir).
    for (const trace of this.traces.values()) this.dessinerTrace(trace);

    // 6. Les pions des joueurs : le groupe se voit toujours, meme dans le noir
    //    (le serveur l'a toujours voulu ainsi : voir pionVisibleParLesJoueurs).
    for (const pion of this.scene.pions) if (estPJ(pion)) this.dessinerPion(pion);
    if (this.geste?.type === "pion") this.dessinerFantome();

    // Curseur du pinceau (MJ)
    if (this.options.estMJ && (this.outil === "gomme" || this.outil === "pinceau") && this.souris) {
      c.strokeStyle = this.outil === "gomme" ? "#ff0" : "#f0f";
      c.lineWidth = 2 / zoom;
      c.beginPath();
      c.arc(this.souris.x, this.souris.y, this.rayonPinceau, 0, Math.PI * 2);
      c.stroke();
    }

    // 7. Effets animes (pings, textes de combat), en pixels d'ECRAN.
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.dessinerEffets();
  }

  /** Un coffre (carre dore) ou un cadavre (disque gris et crane). Vide : estompe. */
  dessinerButin(butin) {
    const c = this.ctx;
    const z = this.vue.zoom;
    const t = this.scene.grille.taille * 0.36;
    const vide = butin.vide ?? butin.objets?.length === 0;
    c.globalAlpha = butin.cache ? 0.4 : vide ? 0.55 : 1;
    if (butin.genre === "coffre") {
      c.fillStyle = "#6b4220";
      c.strokeStyle = "#e0b040";
      c.lineWidth = 3 / z;
      c.beginPath();
      c.roundRect(butin.x - t, butin.y - t * 0.75, t * 2, t * 1.5, t * 0.2);
      c.fill();
      c.stroke();
      c.beginPath(); // le couvercle et la serrure
      c.moveTo(butin.x - t, butin.y - t * 0.15);
      c.lineTo(butin.x + t, butin.y - t * 0.15);
      c.stroke();
      c.fillStyle = "#e0b040";
      c.fillRect(butin.x - t * 0.15, butin.y - t * 0.3, t * 0.3, t * 0.35);
    } else {
      c.fillStyle = "#3a3a3a";
      c.strokeStyle = "#9a9a9a";
      c.lineWidth = 3 / z;
      c.beginPath();
      c.arc(butin.x, butin.y, t, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = "#e8e8e8";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.font = `${t * 1.2}px sans-serif`;
      c.fillText("\u2620", butin.x, butin.y + t * 0.05);
    }
    if (!vide) {
      // Une etincelle doree : "il y a quelque chose a prendre".
      c.fillStyle = "#fff6b0";
      c.beginPath();
      c.arc(butin.x + t * 0.95, butin.y - t * 0.85, Math.max(t * 0.16, 3 / z), 0, Math.PI * 2);
      c.fill();
    }
    const yNom = butin.y + t + Math.max(t * 0.35, 10 / z);
    c.font = `bold ${Math.max(t * 0.45, 12 / z)}px sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.lineWidth = 3 / z;
    c.strokeStyle = "#000";
    c.strokeText(butin.nom, butin.x, yNom);
    c.fillStyle = "#ffd100";
    c.fillText(butin.nom, butin.x, yNom);
    c.globalAlpha = 1;
  }

  butinSous(point) {
    const t = (this.scene.grille.taille ?? 100) * 0.45;
    return (this.scene.butins ?? []).find((b) => Math.abs(point.x - b.x) <= t && Math.abs(point.y - b.y) <= t) ?? null;
  }

  dessinerTrace(trace) {
    if (!trace.points.length) return;
    const c = this.ctx;
    const z = this.vue.zoom;
    c.lineCap = c.lineJoin = "round";
    c.beginPath();
    trace.points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    if (trace.points.length === 1) c.lineTo(trace.points[0][0] + 0.1, trace.points[0][1]); // un simple point
    // Epaisseur constante a l'ecran, avec un liseré noir pour ressortir sur toutes les cartes.
    c.strokeStyle = "rgba(0, 0, 0, 0.75)";
    c.lineWidth = 8 / z;
    c.stroke();
    c.strokeStyle = trace.couleur;
    c.lineWidth = 4.5 / z;
    c.stroke();
  }

  dessinerEffets() {
    const maintenant = performance.now();
    this.effets = this.effets.filter((e) => maintenant - e.debut < e.duree);
    for (const effet of this.effets) {
      const progression = (maintenant - effet.debut) / effet.duree; // de 0 a 1
      if (effet.type === "ping") this.dessinerPing(effet, progression);
      else this.dessinerTexte(effet, progression);
    }
  }

  dessinerPing(ping, t) {
    const c = this.ctx;
    const centre = this.versEcran(ping.x, ping.y);
    const caseEcran = this.scene.grille.taille * this.vue.zoom;
    const portee = Math.max(70, caseEcran * 1.6);
    c.strokeStyle = ping.couleur;
    c.fillStyle = ping.couleur;
    // Deux ondes decalees, qui grandissent en s'effacant.
    for (const retard of [0, 0.3]) {
      const onde = (t - retard) / (1 - retard);
      if (onde <= 0) continue;
      c.globalAlpha = 1 - onde;
      c.lineWidth = 5 * (1 - onde) + 1.5;
      c.beginPath();
      c.arc(centre.x, centre.y, 8 + onde * portee, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = Math.max(0, 1 - t * 1.4);
    c.beginPath();
    c.arc(centre.x, centre.y, 7, 0, Math.PI * 2);
    c.fill();
    if (ping.nom) {
      c.font = `bold 16px ${this.options.police ?? "sans-serif"}`;
      c.textAlign = "center";
      c.textBaseline = "bottom";
      c.lineWidth = 4;
      c.strokeStyle = "#000";
      c.strokeText(ping.nom, centre.x, centre.y - 16);
      c.fillText(ping.nom, centre.x, centre.y - 16);
    }
    c.globalAlpha = 1;
  }

  dessinerTexte(texte, t) {
    const pion = this.scene.pions.find((p) => p.id === texte.idPion);
    if (!pion) return;
    const c = this.ctx;
    const { x, y } = this.affichage.get(pion.id) ?? pion;
    const r = this.rayonPion(pion) * this.vue.zoom;
    const base = this.versEcran(x, y);
    // Le texte monte vite puis ralentit (courbe "ease-out"), et s'efface sur la fin.
    const montee = 1 - (1 - t) ** 2;
    const opacite = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    // Un coup critique "claque" : il apparait en grand puis revient a sa taille.
    const zoomCritique = texte.critique && t < 0.12 ? 1.6 - (t / 0.12) * 0.6 : 1;
    const taille = texte.style.taille * zoomCritique;
    const px = base.x + texte.colonne * Math.max(r, 20) * 0.9;
    const py = base.y - r - 12 - montee * 70;
    const valeur = texte.genre === "soins" ? `+${texte.montant}` : `${texte.montant}`;

    c.globalAlpha = opacite;
    c.textAlign = "center";
    c.textBaseline = "bottom";
    c.lineJoin = "round";
    c.font = `bold ${taille}px ${this.options.police ?? "sans-serif"}`;
    c.lineWidth = Math.max(4, taille / 7);
    c.strokeStyle = "#000";
    c.strokeText(valeur, px, py);
    c.fillStyle = texte.style.couleur;
    c.fillText(valeur, px, py);
    if (texte.absorbe > 0) {
      c.font = `bold 15px ${this.options.police ?? "sans-serif"}`;
      c.lineWidth = 3;
      c.textBaseline = "top";
      c.strokeText(`(${texte.absorbe} absorbes)`, px, py + 2);
      c.fillStyle = "#c8c8c8";
      c.fillText(`(${texte.absorbe} absorbes)`, px, py + 2);
    }
    c.globalAlpha = 1;
  }

  dessinerGrille() {
    const { grille, carte } = this.scene;
    if (!grille.visible) return;
    const c = this.ctx;
    const pas = grille.taille;
    if (pas * this.vue.zoom < 4) return; // trop dezoome : grille illisible
    // On ne trace que les lignes visibles a l'ecran.
    const x0 = Math.max(0, this.vue.x);
    const y0 = Math.max(0, this.vue.y);
    const x1 = Math.min(carte.largeur, this.vue.x + this.canvas.width / this.vue.zoom);
    const y1 = Math.min(carte.hauteur, this.vue.y + this.canvas.height / this.vue.zoom);
    c.strokeStyle = "rgba(0, 200, 255, 0.8)";
    c.lineWidth = 1.5 / this.vue.zoom;
    c.beginPath();
    for (let x = grille.decalageX + Math.ceil((x0 - grille.decalageX) / pas) * pas; x <= x1; x += pas) {
      c.moveTo(x, y0);
      c.lineTo(x, y1);
    }
    for (let y = grille.decalageY + Math.ceil((y0 - grille.decalageY) / pas) * pas; y <= y1; y += pas) {
      c.moveTo(x0, y);
      c.lineTo(x1, y);
    }
    c.stroke();
  }

  dessinerPion(pion) {
    const c = this.ctx;
    const { x, y } = this.affichage.get(pion.id) ?? pion;
    const r = this.rayonPion(pion);
    const z = this.vue.zoom;

    // Cercle de ciblage au sol (pion selectionne)
    if (this.selection === pion.id) {
      c.strokeStyle = "#ffd700";
      c.lineWidth = 4 / z;
      c.setLineDash([10 / z, 6 / z]);
      c.beginPath();
      c.arc(x, y, r * 1.3, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }

    c.globalAlpha = pion.cache ? 0.4 : 1; // pion cache : le MJ le voit en transparence
    c.fillStyle = pion.couleur;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#fff";
    c.lineWidth = 3 / z;
    c.stroke();

    const initiales = pion.nom.split(/\s+/).map((mot) => mot[0]).join("").slice(0, 2).toUpperCase();
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.font = `bold ${r * 0.8}px sans-serif`;
    c.fillText(initiales, x, y);
    // Nom sous le pion : blanc cerne de noir, lisible sur une carte claire comme dans le brouillard.
    const nom = pion.nom + (pion.cache ? " (cache)" : "");
    const yNom = y + r + Math.max(r * 0.3, 10 / z);
    c.font = `bold ${Math.max(r * 0.38, 12 / z)}px sans-serif`;
    c.lineJoin = "round";
    c.lineWidth = 3 / z;
    c.strokeStyle = "#000";
    c.strokeText(nom, x, yNom);
    c.fillStyle = "#fff";
    c.fillText(nom, x, yNom);
    c.globalAlpha = 1;
  }

  /** Pendant un glisser : ou le pion va tomber (aimante) + distance parcourue. */
  dessinerFantome() {
    const pion = this.scene.pions.find((p) => p.id === this.geste.idPion);
    if (!pion) return;
    const arrivee = this.positionDeLacher(pion);
    const c = this.ctx;
    c.strokeStyle = "#ffd700";
    c.lineWidth = 3 / this.vue.zoom;
    c.setLineDash([8 / this.vue.zoom, 8 / this.vue.zoom]);
    c.beginPath();
    c.moveTo(this.geste.depart.x, this.geste.depart.y);
    c.lineTo(arrivee.x, arrivee.y);
    c.stroke();
    c.beginPath();
    c.arc(arrivee.x, arrivee.y, this.rayonPion(pion), 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }

  positionDeLacher(pion) {
    const { x, y } = this.affichage.get(pion.id);
    const dansLaCarte = borner(x, y, this.scene.carte);
    if (!this.aimanter) return dansLaCarte;
    const aimante = aimanter(dansLaCarte.x, dansLaCarte.y, this.scene.grille, pion.taille);
    return borner(aimante.x, aimante.y, this.scene.carte);
  }

  // ===== Souris ======================================================================

  pionSous(point) {
    for (let i = this.scene.pions.length - 1; i >= 0; i--) {
      const pion = this.scene.pions[i];
      const { x, y } = this.affichage.get(pion.id) ?? pion;
      if (Math.hypot(point.x - x, point.y - y) <= this.rayonPion(pion)) return pion;
    }
    return null;
  }

  brancherEvenements() {
    const canvas = this.canvas;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("pointerdown", (e) => this.appui(e));
    canvas.addEventListener("pointermove", (e) => this.mouvement(e));
    canvas.addEventListener("pointerup", (e) => this.relachement(e));
    canvas.addEventListener("pointercancel", (e) => this.relachement(e));
    canvas.addEventListener("pointerleave", () => ((this.souris = null), (this.sale = true)));
    canvas.addEventListener("wheel", (e) => this.molette(e), { passive: false });
  }

  appui(e) {
    if (!this.scene) return;
    const point = this.versCarte(e);
    this.canvas.setPointerCapture(e.pointerId);

    // Clic droit / molette : toujours deplacer la vue. Un clic droit SANS
    // bouger sur un pion ouvre le menu du MJ (voir relachement).
    if (e.button !== 0) {
      const menu = e.button === 2 ? this.pionSous(point) : null;
      this.geste = { type: "vue", ecran: { x: point.sx, y: point.sy }, vue: { ...this.vue }, menu, client: { x: e.clientX, y: e.clientY } };
      return;
    }

    // Ping : outil "ping", ou Alt + clic avec n'importe quel outil.
    if (this.outil === "ping" || e.altKey) {
      this.pinguer(point);
      return;
    }

    // Trace tactique (joueurs et MJ).
    if (this.outil === "tracer") {
      this.commencerTrace(point);
      return;
    }

    // Pinceau / gomme du MJ.
    if (this.options.estMJ && (this.outil === "gomme" || this.outil === "pinceau")) {
      const mode = this.outil === "gomme" ? "reveler" : "cacher";
      // aEnvoyer : points pas encore transmis (precedes du point de raccord) ;
      // nouveaux : combien de ces points sont reellement nouveaux.
      this.geste = { type: "trait", mode, aEnvoyer: [[point.x, point.y]], nouveaux: 1, dernier: [point.x, point.y], minuterie: null };
      this.peindreLocalement(mode, [[point.x, point.y]]);
      this.planifierEnvoiTrait();
      return;
    }

    const pion = this.pionSous(point);
    if (pion) this.selection = pion.id; // cercle de ciblage
    if (pion && this.options.peutDeplacer(pion)) {
      this.commencerGlisser(pion, point);
    } else {
      if (pion) this.options.surInfo(`${pion.nom} : ce pion ne t'appartient pas (selectionne seulement).`);
      // Sur un coffre : on retient le clic. S'il n'y a pas de glisser, il ouvrira le butin
      // au relachement ; si la souris bouge, c'etait un deplacement de la vue.
      const butin = pion ? null : this.butinSous(point);
      this.geste = { type: "vue", ecran: { x: point.sx, y: point.sy }, vue: { ...this.vue }, butin, client: { x: e.clientX, y: e.clientY } };
    }
    this.sale = true;
  }

  // --- Glisser un pion ------------------------------------------------------------
  // On bouge le pion TOUT DE SUITE a l'ecran (sans attendre le serveur : c'est
  // l'"affichage optimiste"), et on demande le verrou en parallele. Si le
  // serveur refuse, le pion revient a sa place.

  commencerGlisser(pion, point) {
    const affiche = this.affichage.get(pion.id);
    const geste = {
      type: "pion",
      idPion: pion.id,
      depart: { x: pion.x, y: pion.y },
      ecart: { x: affiche.x - point.x, y: affiche.y - point.y }, // on tient le pion la ou on l'a attrape
      accorde: null, // reponse du serveur au verrou
      dernierEnvoi: 0,
      minuterie: null,
      relache: false,
    };
    this.geste = geste;
    this.options.surSaisie(pion).then((accorde) => {
      geste.accorde = accorde;
      if (!accorde) this.annulerGlisser(geste);
      else if (geste.relache) this.terminerGlisser(geste);
    });
  }

  annulerGlisser(geste) {
    const affiche = this.affichage.get(geste.idPion);
    if (affiche) Object.assign(affiche, geste.depart);
    if (this.geste === geste) this.geste = null;
    this.sale = true;
  }

  envoyerPosition(geste) {
    if (geste.accorde !== true || geste.relache) return;
    const pion = this.scene.pions.find((p) => p.id === geste.idPion);
    const { x, y } = this.affichage.get(geste.idPion);
    geste.dernierEnvoi = performance.now();
    this.options.surDeplacement(pion, x, y, false, this.aimanter);
  }

  async terminerGlisser(geste) {
    const pion = this.scene.pions.find((p) => p.id === geste.idPion);
    if (this.geste === geste) this.geste = null; // la souris ne tient plus le pion
    if (!pion) return;
    clearTimeout(geste.minuterie);
    const { x, y } = this.affichage.get(geste.idPion);
    // Le serveur renvoie la position OFFICIELLE (bornee, aimantee) : le pion
    // glisse doucement jusqu'a elle. En cas de refus, il revient au depart.
    const officielle = await this.options.surDeplacement(pion, x, y, true, this.aimanter);
    Object.assign(pion, officielle ?? geste.depart);
    this.sale = true;
  }

  // --- Ping et trace tactique -------------------------------------------------------------

  pinguer(point) {
    const maintenant = performance.now();
    if (maintenant - this.dernierPing < DELAI_ENTRE_PINGS_MS) return; // pas de rafale
    this.dernierPing = maintenant;
    const { x, y } = borner(point.x, point.y, this.scene.carte);
    this.afficherPing(x, y, this.options.couleur ?? "#ffd100");
    this.options.surPing?.(x, y);
  }

  // Meme principe que le pinceau du brouillard : la trace s'affiche tout de
  // suite chez nous et part au serveur par morceaux, toutes les 50 ms.
  commencerTrace(point) {
    const cle = Math.random().toString(36).slice(2, 12).padEnd(6, "0");
    const debut = [point.x, point.y];
    const trace = { id: `${this.options.prefixeTraces ?? "moi:"}${cle}`, couleur: this.couleurTrace ?? this.options.couleur ?? "#ffd100", points: [debut] };
    this.traces.set(trace.id, trace);
    this.geste = { type: "trace", id: trace.id, cle, trace, aEnvoyer: [debut], nouveaux: 1, dernier: debut, minuterie: null };
    this.planifierEnvoiMorceau();
    this.sale = true;
  }

  planifierEnvoiMorceau() {
    const geste = this.geste;
    if (geste.minuterie) return;
    geste.minuterie = setTimeout(() => {
      geste.minuterie = null;
      this.envoyerMorceau(geste);
    }, INTERVALLE_ENVOI_MS);
  }

  envoyerMorceau(geste) {
    if (geste.nouveaux === 0) return;
    while (geste.aEnvoyer.length > 0) {
      const lot = geste.aEnvoyer.splice(0, 63);
      this.options.surTrace?.({ cle: geste.cle, couleur: geste.trace.couleur, points: lot });
      if (geste.aEnvoyer.length > 0) geste.aEnvoyer.unshift(lot.at(-1)); // raccord
    }
    geste.aEnvoyer = [];
    geste.nouveaux = 0;
  }

  // --- Peindre le brouillard ---------------------------------------------------------
  // Le trait est dessine immediatement chez le MJ, et envoye au serveur par
  // petits morceaux (toutes les 50 ms). Chaque morceau recommence au dernier
  // point du precedent : chez les autres, les morceaux se raccordent sans trou.

  peindreLocalement(mode, points) {
    const trait = { mode, rayon: this.rayonPinceau, points };
    this.scene.brouillard.traits.push(trait);
    this.appliquerTrait(trait);
    this.sale = true;
  }

  planifierEnvoiTrait() {
    const geste = this.geste;
    if (geste.minuterie) return;
    geste.minuterie = setTimeout(() => {
      geste.minuterie = null;
      this.envoyerTrait(geste);
    }, INTERVALLE_ENVOI_MS);
  }

  envoyerTrait(geste) {
    if (geste.nouveaux === 0) return;
    // Le serveur accepte au plus 64 points par morceau.
    while (geste.aEnvoyer.length > 0) {
      const lot = geste.aEnvoyer.splice(0, 63);
      this.options.surTrait({ mode: geste.mode, rayon: this.rayonPinceau, points: lot });
      if (geste.aEnvoyer.length > 0) geste.aEnvoyer.unshift(lot.at(-1)); // raccord
    }
    geste.aEnvoyer = [geste.dernier]; // le prochain morceau repart d'ici
    geste.nouveaux = 0;
  }

  mouvement(e) {
    if (!this.scene) return;
    const point = this.versCarte(e);
    this.souris = point;
    const geste = this.geste;

    if (geste?.type === "vue") {
      this.vue.x = geste.vue.x - (point.sx - geste.ecran.x) / this.vue.zoom;
      this.vue.y = geste.vue.y - (point.sy - geste.ecran.y) / this.vue.zoom;
    } else if (geste?.type === "pion") {
      const affiche = this.affichage.get(geste.idPion);
      affiche.x = point.x + geste.ecart.x;
      affiche.y = point.y + geste.ecart.y;
      // Envoi limite a ~20 par seconde : assez fluide, sans saturer le reseau.
      const attente = INTERVALLE_ENVOI_MS - (performance.now() - geste.dernierEnvoi);
      if (attente <= 0) this.envoyerPosition(geste);
      else if (!geste.minuterie) {
        geste.minuterie = setTimeout(() => ((geste.minuterie = null), this.envoyerPosition(geste)), attente);
      }
      const pion = this.scene.pions.find((p) => p.id === geste.idPion);
      const cases = distanceEnCases(geste.depart, this.positionDeLacher(pion), this.scene.grille);
      this.options.surInfo(`Deplacement de ${pion.nom} : ${cases} case(s), soit ${(cases * METRES_PAR_CASE).toLocaleString("fr-FR")} m`);
    } else if (geste?.type === "trace") {
      const [dx, dy] = [point.x - geste.dernier[0], point.y - geste.dernier[1]];
      if (Math.hypot(dx, dy) * this.vue.zoom >= 5) {
        // 5 pixels d'ecran entre deux points : une ligne souple, sans points inutiles.
        geste.dernier = [point.x, point.y];
        geste.trace.points.push(geste.dernier);
        geste.aEnvoyer.push(geste.dernier);
        geste.nouveaux += 1;
        this.planifierEnvoiMorceau();
      }
    } else if (geste?.type === "trait") {
      // On ignore les micro-mouvements (inutile d'envoyer 3 points au meme endroit).
      const [dx, dy] = [point.x - geste.dernier[0], point.y - geste.dernier[1]];
      if (Math.hypot(dx, dy) >= this.rayonPinceau / 4) {
        this.peindreLocalement(geste.mode, [geste.dernier, [point.x, point.y]]);
        geste.dernier = [point.x, point.y];
        geste.aEnvoyer.push(geste.dernier);
        geste.nouveaux += 1;
        this.planifierEnvoiTrait();
      }
    } else {
      const { colonne, ligne } = caseDe(point.x, point.y, this.scene.grille);
      this.options.surInfo(`Case (${colonne}, ${ligne}) - zoom ${Math.round(this.vue.zoom * 100)} %`);
    }
    this.canvas.style.cursor = this.curseur(point);
    this.sale = true;
  }

  /** Le curseur annonce ce qu'un clic va faire (une main sur SON pion...). */
  curseur(point) {
    if (this.geste?.type === "pion") return "grabbing";
    if (this.geste?.type === "vue") return "move";
    if (this.outil === "tracer" || this.outil === "gomme" || this.outil === "pinceau") return "crosshair";
    if (this.outil === "ping") return "pointer";
    const pion = this.pionSous(point);
    if (pion && this.options.peutDeplacer(pion)) return "grab";
    return !pion && this.butinSous(point) ? "pointer" : "default";
  }

  relachement(e) {
    const geste = this.geste;
    if (this.canvas.hasPointerCapture?.(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    if (!geste) return;
    if (geste.type === "pion") {
      geste.relache = true;
      // Verrou pas encore accorde : on terminera des la reponse du serveur.
      if (geste.accorde === true) this.terminerGlisser(geste);
      return;
    }
    if (geste.type === "trait") {
      clearTimeout(geste.minuterie);
      this.envoyerTrait(geste); // le reste du trait, s'il y en a
    }
    if (geste.type === "trace") {
      clearTimeout(geste.minuterie);
      this.envoyerMorceau(geste);
    }
    const immobile = geste.client && Math.hypot(e.clientX - geste.client.x, e.clientY - geste.client.y) < 5;
    if (geste.type === "vue" && geste.butin && immobile) {
      this.options.surButin?.(geste.butin, e.clientX, e.clientY);
    }
    if (geste.type === "vue" && geste.menu && immobile) {
      this.options.surMenuPion?.(geste.menu, e.clientX, e.clientY);
    }
    this.geste = null;
    this.sale = true;
  }

  molette(e) {
    if (!this.scene) return;
    e.preventDefault();
    const point = this.versCarte(e);
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.vue.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    // On zoome autour du curseur : le point sous la souris ne bouge pas.
    this.vue = { zoom, x: point.x - point.sx / zoom, y: point.y - point.sy / zoom };
    this.options.surInfo(`Zoom ${Math.round(zoom * 100)} %`);
    this.sale = true;
  }
}
