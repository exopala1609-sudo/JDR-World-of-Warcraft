// Le moteur audio "invisible" : joue les sons que le serveur demande
// (murmure recu, quete, debut de combat...).
//
// LA POLITIQUE D'AUTOPLAY DES NAVIGATEURS
//   Chrome, Edge, Firefox et Safari interdisent a une page de faire du bruit
//   tant que l'utilisateur n'a pas interagi avec elle (un clic, une touche).
//   Un son demande trop tot est refuse (erreur "NotAllowedError") ou, avec la
//   Web Audio API, le "contexte audio" reste suspendu : silence.
//
// NOTRE PARADE
//   1. On utilise UN seul AudioContext (Web Audio API) pour tous les sons.
//   2. On le "deverrouille" au premier geste de l'utilisateur : le premier
//      clic ou la premiere touche, n'importe ou dans la page, appelle
//      contexte.resume(). C'est autorise, puisque c'est un geste volontaire.
//      En pratique c'est deja fait avant d'arriver en jeu : on clique pour se
//      connecter et pour choisir sa table.
//   3. Apres un F5 (reprise automatique, sans clic), le son reste bloque
//      jusqu'au premier clic : le bouton haut-parleur clignote pour le dire.
//      Les sons demandes pendant ce temps sont ignores (pas rejoues en rafale
//      plus tard : un "ding" de murmure vieux de 2 minutes n'a plus de sens).
//   4. Chaque son est cherche dans le dossier sons/ du cloud. S'il manque,
//      on en FABRIQUE un (oscillateurs Web Audio) : il y a toujours un son.
import { useSyncExternalStore } from "react";

const CLE_REGLAGES = "vtt-audio";

type Reglages = { volume: number; muet: boolean };
type EtatAudio = Reglages & { pret: boolean };

function lireReglages(): Reglages {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? "{}");
    return { volume: typeof brut.volume === "number" ? brut.volume : 0.6, muet: Boolean(brut.muet) };
  } catch {
    return { volume: 0.6, muet: false };
  }
}

class MoteurAudio {
  private contexte: AudioContext | null = null;
  private sortie: GainNode | null = null; // le volume general
  private tampons = new Map<string, Promise<AudioBuffer | null>>();
  private abonnes = new Set<() => void>();
  private etat: EtatAudio = { ...lireReglages(), pret: false };

  constructor() {
    if (typeof window === "undefined") return;
    // Deverrouillage au premier geste (et a chaque geste tant que ce n'est pas fait).
    const geste = () => this.deverrouiller();
    window.addEventListener("pointerdown", geste, true);
    window.addEventListener("keydown", geste, true);
  }

  // --- Etat pour l'interface (bouton haut-parleur) ----------------------------
  lire = () => this.etat;
  abonner = (rappel: () => void) => {
    this.abonnes.add(rappel);
    return () => void this.abonnes.delete(rappel);
  };
  private publier(changement: Partial<EtatAudio>) {
    this.etat = { ...this.etat, ...changement };
    if (this.sortie) this.sortie.gain.value = this.etat.muet ? 0 : this.etat.volume;
    try {
      localStorage.setItem(CLE_REGLAGES, JSON.stringify({ volume: this.etat.volume, muet: this.etat.muet }));
    } catch {
      /* reglages non memorises : sans importance */
    }
    this.abonnes.forEach((rappel) => rappel());
  }
  regler(volume: number) {
    this.publier({ volume: Math.min(1, Math.max(0, volume)), muet: false });
  }
  basculerMuet() {
    this.publier({ muet: !this.etat.muet });
  }

  /** Appele a chaque geste de l'utilisateur : cree / reveille le contexte audio. */
  deverrouiller() {
    if (this.etat.pret) return;
    const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexte) return;
    if (!this.contexte) {
      this.contexte = new Contexte();
      this.sortie = this.contexte.createGain();
      this.sortie.gain.value = this.etat.muet ? 0 : this.etat.volume;
      this.sortie.connect(this.contexte.destination);
    }
    this.contexte
      .resume()
      .then(() => this.publier({ pret: this.contexte?.state === "running" }))
      .catch(() => {});
  }

  /** Joue un son par son nom ("murmure", "combat"...). Silencieux si bloque ou muet. */
  async jouer(nom: string) {
    const contexte = this.contexte;
    if (!contexte || !this.sortie || contexte.state !== "running" || this.etat.muet || this.etat.volume === 0) return;
    const tampon = await this.charger(nom);
    if (tampon) {
      const source = contexte.createBufferSource();
      source.buffer = tampon;
      source.connect(this.sortie);
      source.start();
    } else {
      synthetiser(contexte, this.sortie, nom);
    }
  }

  /** Le fichier sons/<nom>.ogg (ou .mp3...), decode une fois puis garde en memoire. */
  private charger(nom: string) {
    if (!this.tampons.has(nom)) {
      const promesse = fetch(`/medias/sons/${encodeURIComponent(nom)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((octets) => (octets && this.contexte ? this.contexte.decodeAudioData(octets) : null))
        .catch(() => null);
      this.tampons.set(nom, promesse);
    }
    return this.tampons.get(nom)!;
  }
}

// --- Sons de remplacement, fabriques par le navigateur ----------------------------
// Une "note" : un oscillateur dont le volume monte vite puis s'eteint doucement.
function note(ctx: AudioContext, sortie: AudioNode, frequence: number, debut: number, duree: number, forme: OscillatorType = "sine", force = 0.3) {
  const osc = ctx.createOscillator();
  const enveloppe = ctx.createGain();
  osc.type = forme;
  osc.frequency.value = frequence;
  const t = ctx.currentTime + debut;
  enveloppe.gain.setValueAtTime(0, t);
  enveloppe.gain.linearRampToValueAtTime(force, t + 0.01);
  enveloppe.gain.exponentialRampToValueAtTime(0.001, t + duree);
  osc.connect(enveloppe).connect(sortie);
  osc.start(t);
  osc.stop(t + duree + 0.05);
}

/** Un coup de tambour : un bruit grave, filtre, tres court. */
function tambour(ctx: AudioContext, sortie: AudioNode, debut: number, force = 0.6) {
  const duree = 0.5;
  const bruit = ctx.createBuffer(1, ctx.sampleRate * duree, ctx.sampleRate);
  const donnees = bruit.getChannelData(0);
  for (let i = 0; i < donnees.length; i++) donnees[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
  const source = ctx.createBufferSource();
  source.buffer = bruit;
  const filtre = ctx.createBiquadFilter();
  filtre.type = "lowpass";
  filtre.frequency.value = 180;
  const gain = ctx.createGain();
  gain.gain.value = force;
  source.connect(filtre).connect(gain).connect(sortie);
  source.start(ctx.currentTime + debut);
  note(ctx, sortie, 55, debut, 0.6, "sine", force * 0.8);
}

function synthetiser(ctx: AudioContext, sortie: AudioNode, nom: string) {
  switch (nom) {
    case "murmure": // le "ding" cristallin du message prive
      note(ctx, sortie, 1318.5, 0, 0.45, "sine", 0.25);
      note(ctx, sortie, 1760, 0.09, 0.6, "sine", 0.2);
      return;
    case "quete-nouvelle": // trois notes qui montent
      [523.25, 659.25, 783.99].forEach((f, i) => note(ctx, sortie, f, i * 0.11, 0.5, "triangle", 0.22));
      return;
    case "quete-terminee": // petite fanfare : arpege puis accord
      [523.25, 659.25, 783.99].forEach((f, i) => note(ctx, sortie, f, i * 0.12, 0.35, "triangle", 0.22));
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => note(ctx, sortie, f, 0.4, 1.1, "triangle", 0.16));
      return;
    case "combat": // gong grave + tambours de guerre
      note(ctx, sortie, 98, 0, 2.2, "sine", 0.35);
      note(ctx, sortie, 147, 0, 1.6, "triangle", 0.12);
      [0, 0.32, 0.64, 0.8].forEach((t, i) => tambour(ctx, sortie, t, i === 3 ? 0.8 : 0.55));
      return;
    default: // un son du MJ introuvable : un simple "bip" discret
      note(ctx, sortie, 660, 0, 0.25, "sine", 0.15);
  }
}

export const audio = new MoteurAudio();

/** Etat du son pour l'interface (pret, volume, muet). */
export const useAudio = () => useSyncExternalStore(audio.abonner, audio.lire);
