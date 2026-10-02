// Les textures de World of Warcraft deposees dans le dossier interface/.
//
// Le principe : chaque ELEMENT de l'interface (le bouton de fermeture, le
// cadre des fenetres, l'anneau de la minicarte...) a un "role", et pour chaque
// role une liste de noms de fichiers possibles, ceux du depot
// github.com/Gethe/wow-ui-textures. Au demarrage, le navigateur demande au
// serveur la liste du dossier interface/ (a plat ou en sous-dossiers, les
// majuscules ne comptent pas) et branche les roles dont il trouve le fichier.
//
// Pour un role trouve, la page recoit :
//   - une variable CSS  --tex-<role> : url("/medias/interface/...")
//   - une classe sur <html> : tex-<role>
// Les feuilles de style n'utilisent la texture que sous cette classe : sans le
// fichier, l'element garde son dessin actuel (rien ne casse).
//
// Certaines textures de WoW ne s'utilisent pas telles quelles : les bordures
// (8 morceaux cote a cote, dont 2 couches sur le cote) et l'anneau de la
// minicarte (au milieu d'une planche). Le navigateur les recompose une fois
// pour toutes dans un <canvas>, puis les sert comme les autres.
import { useSyncExternalStore } from "react";

const ROLES = {
  // --- Boutons ----------------------------------------------------------------
  fermer: ["UI-Panel-MinimizeButton-Up"],
  "fermer-appui": ["UI-Panel-MinimizeButton-Down"],
  "fermer-survol": ["UI-Panel-MinimizeButton-Highlight"],
  // --- Cadres (fenetres, menus, cadres d'unite) -------------------------------
  "fond-dialogue": ["UI-DialogBox-Background"],
  "bordure-dialogue": ["UI-DialogBox-Border"],
  "bordure-or": ["UI-DialogBox-Gold-Border"],
  dragon: ["UI-DialogBox-Gold-Dragon"],
  // --- Micro-menu (bas droite) ------------------------------------------------
  "micro-personnage": ["UI-MicroButton-Character-Up"],
  "micro-personnage-appui": ["UI-MicroButton-Character-Down"],
  "micro-grimoire": ["UI-MicroButton-Spellbook-Up"],
  "micro-grimoire-appui": ["UI-MicroButton-Spellbook-Down"],
  "micro-quetes": ["UI-MicroButton-Quest-Up"],
  "micro-quetes-appui": ["UI-MicroButton-Quest-Down"],
  "micro-initiative": ["UI-MicroButton-LFG-Up"],
  "micro-initiative-appui": ["UI-MicroButton-LFG-Down"],
  "micro-carnet": ["UI-MicroButton-EJ-Up"],
  "micro-carnet-appui": ["UI-MicroButton-EJ-Down"],
  "micro-quitter": ["UI-MicroButton-MainMenu-Up"],
  "micro-quitter-appui": ["UI-MicroButton-MainMenu-Down"],
  sac: ["Button-Backpack-Up"],
  "sac-appui": ["Button-Backpack-Down"],
  // --- Barre d'actions : les griffons (Dwarf) ou les lions (Human) ------------
  griffon: ["UI-MainMenuBar-EndCap-Dwarf", "UI-MainMenuBar-EndCap-Human"],
  // --- Minicarte ----------------------------------------------------------------
  "minicarte-bordure": ["UI-Minimap-Border"],
  "minicarte-bandeau": ["UI-Minimap-Border"], // le cartouche du nom de la zone, dans la meme planche
  // --- Cases vides : sac et mannequin de la fiche -----------------------------
  "case-sac": ["UI-Backpack-EmptySlot"],
  "emplacement-tete": ["UI-PaperDoll-Slot-Head"],
  "emplacement-cou": ["UI-PaperDoll-Slot-Neck"],
  "emplacement-epaules": ["UI-PaperDoll-Slot-Shoulder"],
  "emplacement-dos": ["UI-PaperDoll-Slot-Back", "UI-PaperDoll-Slot-Chest"],
  "emplacement-torse": ["UI-PaperDoll-Slot-Chest"],
  "emplacement-chemise": ["UI-PaperDoll-Slot-Shirt", "UI-PaperDoll-Slot-Chest"],
  "emplacement-tabard": ["UI-PaperDoll-Slot-Tabard", "UI-PaperDoll-Slot-Chest"],
  "emplacement-poignets": ["UI-PaperDoll-Slot-Wrists"],
  "emplacement-mains": ["UI-PaperDoll-Slot-Hands"],
  "emplacement-taille": ["UI-PaperDoll-Slot-Waist"],
  "emplacement-jambes": ["UI-PaperDoll-Slot-Legs"],
  "emplacement-pieds": ["UI-PaperDoll-Slot-Feet"],
  "emplacement-doigt-1": ["UI-PaperDoll-Slot-Finger"],
  "emplacement-doigt-2": ["UI-PaperDoll-Slot-Finger"],
  "emplacement-bijou-1": ["UI-PaperDoll-Slot-Trinket"],
  "emplacement-bijou-2": ["UI-PaperDoll-Slot-Trinket", "UI-PaperDoll-Slot-REar"],
  "emplacement-main-droite": ["UI-PaperDoll-Slot-MainHand"],
  "emplacement-main-gauche": ["UI-PaperDoll-Slot-SecondaryHand"],
  "emplacement-distance": ["UI-PaperDoll-Slot-Ranged", "UI-PaperDoll-Slot-MainHand"],
  // --- Icones de classe (identifiants du referentiel) -------------------------
  "classe-guerrier": ["ClassIcon_Warrior"],
  "classe-paladin": ["ClassIcon_Paladin"],
  "classe-rodeur": ["ClassIcon_Hunter"],
  "classe-roublard": ["ClassIcon_Rogue"],
  "classe-clerc": ["ClassIcon_Priest"],
  "classe-chevalier-de-la-mort": ["ClassIcon_DeathKnight", "Button_ClassIcon_DeathKnight"],
  "classe-chaman": ["ClassIcon_Shaman"],
  "classe-magicien": ["ClassIcon_Mage"],
  "classe-occultiste": ["ClassIcon_Warlock"],
  "classe-moine": ["ClassIcon_Monk"],
  "classe-druide": ["ClassIcon_Druid"],
  "classe-chasseur-de-demons": ["ClassIcon_DemonHunter"],
  "classe-evocateur": ["ClassIcon_Evoker"],
  // --- Fenetres : portraits ronds, pages, surbrillance --------------------------
  "portrait-quetes": ["UI-QuestLog-BookIcon"],
  "portrait-grimoire": ["Spellbook-Icon"],
  "portrait-butin": ["LootPanel-Icon"],
  "quete-surbrillance": ["UI-QuestTitleHighlight"],
  "quete-parchemin": ["QuestBackgroundClassic"],
  "page-gauche": ["Spellbook-Page-1"],
  "page-droite": ["Spellbook-Page-2"],
  // --- Ecran d'accueil -----------------------------------------------------------
  "accueil-fond": ["UI_MainMenu_BattleForAzeroth_LowBandwidth", "UI_MainMenu_BattleForAzeroth"],
  "accueil-logo": ["Glues-WoW-ClassicLogo", "Glues-WoW-WotLKLogo", "Glues-WoW-Logo"],
  roche: ["UI-Background-Rock"],
} satisfies Record<string, string[]>;

export type RoleTexture = keyof typeof ROLES;

// Les roles qu'on recompose dans un canvas avant de s'en servir.
const RECOMPOSER: Partial<Record<RoleTexture, (image: HTMLImageElement) => HTMLCanvasElement>> = {
  "bordure-dialogue": bordureNeufParties,
  "bordure-or": bordureNeufParties,
  "minicarte-bordure": anneauMinicarte,
  "minicarte-bandeau": bandeauDeZone,
  "quete-surbrillance": additive,
};

// --- Le petit magasin des textures trouvees (pour les composants React) ----------
let trouvees: Partial<Record<RoleTexture, string>> = {};
const abonnes = new Set<() => void>();

function brancher(role: RoleTexture, url: string) {
  trouvees = { ...trouvees, [role]: url };
  const racine = document.documentElement;
  racine.style.setProperty(`--tex-${role}`, `url("${url}")`);
  racine.classList.add(`tex-${role}`);
  abonnes.forEach((f) => f());
}

/** Adresse de la texture d'un role, ou null si le fichier n'est pas dans interface/. */
export function urlTexture(role: RoleTexture): string | null {
  return trouvees[role] ?? null;
}

const abonner = (f: () => void) => {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
};

/** Meme chose dans un composant : il se redessine quand la texture arrive. */
export function useTexture(role: RoleTexture): string | null {
  return useSyncExternalStore(abonner, () => trouvees[role] ?? null);
}

/** Toutes les textures trouvees (pour une liste : les icones de toutes les classes...). */
export function useTextures(): Partial<Record<RoleTexture, string>> {
  return useSyncExternalStore(abonner, () => trouvees);
}

/** Lit le dossier interface/ (une fois, au demarrage) et branche ce qui s'y trouve. */
export async function chargerTextures() {
  let fichiers: string[] = [];
  try {
    const reponse = await fetch("/api/interface");
    if (reponse.ok) fichiers = ((await reponse.json()) as { fichiers: string[] }).fichiers;
  } catch {
    return; // pas de serveur, pas de textures : l'interface garde son dessin
  }
  // "Buttons/UI-Panel-MinimizeButton-Up.PNG" -> "ui-panel-minimizebutton-up"
  const index = new Map<string, string>();
  for (const f of fichiers) {
    const nom = f.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
    if (!index.has(nom)) index.set(nom, f);
  }
  for (const [role, candidats] of Object.entries(ROLES) as [RoleTexture, string[]][]) {
    const fichier = candidats.map((c) => index.get(c.toLowerCase())).find(Boolean);
    if (!fichier) continue;
    const url = `/medias/interface/${fichier.split("/").map(encodeURIComponent).join("/")}`;
    const recomposer = RECOMPOSER[role];
    if (!recomposer) brancher(role, url);
    else
      chargerImage(url)
        .then((image) => brancher(role, recomposer(image).toDataURL()))
        .catch(() => {}); // image illisible : on garde le dessin actuel
  }
}

function chargerImage(url: string) {
  return new Promise<HTMLImageElement>((ok, echec) => {
    const image = new Image();
    image.onload = () => ok(image);
    image.onerror = echec;
    image.src = url;
  });
}

/**
 * Une bordure de WoW (UI-DialogBox-Border...) est une bande de 8 carres :
 *   gauche, droite, haut, bas, coin haut-gauche, haut-droite, bas-gauche, bas-droite
 * Les bords du haut et du bas y sont ranges DEBOUT (tournes d'un quart de
 * tour). On les remet a plat dans une image 3 x 3 carres, le centre vide :
 * c'est exactement ce qu'attend la propriete CSS border-image.
 */
function bordureNeufParties(image: HTMLImageElement) {
  const c = image.naturalHeight; // cote d'un carre (32 px en general)
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 3 * c;
  const g = canvas.getContext("2d")!;
  const carre = (n: number, x: number, y: number) => g.drawImage(image, n * c, 0, c, c, x, y, c, c);
  const couche = (n: number, x: number, y: number) => {
    g.save();
    g.translate(x + c, y);
    g.rotate(Math.PI / 2); // quart de tour dans le sens des aiguilles d'une montre
    g.drawImage(image, n * c, 0, c, c, 0, 0, c, c);
    g.restore();
  };
  carre(0, 0, c); // gauche
  carre(1, 2 * c, c); // droite
  couche(2, c, 0); // haut
  couche(3, c, 2 * c); // bas
  carre(4, 0, 0);
  carre(5, 2 * c, 0);
  carre(6, 0, 2 * c);
  carre(7, 2 * c, 2 * c);
  return canvas;
}

/**
 * UI-Minimap-Border (256 x 256) : l'anneau de la minicarte est centre en
 * (168.75 ; 108.3) de la planche, autour d'une carte de 140 px de diametre.
 * On n'en garde qu'un disque de 160 px (l'anneau seul, sans les boutons
 * dessines autour) : la feuille de style le pose 10/140e plus large que la
 * minicarte, de chaque cote.
 */
function anneauMinicarte(image: HTMLImageElement) {
  const echelle = image.naturalWidth / 256; // au cas ou la texture serait en 2x
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 160 * echelle;
  const g = canvas.getContext("2d")!;
  g.beginPath();
  g.arc(80 * echelle, 80 * echelle, 79.5 * echelle, 0, Math.PI * 2);
  g.clip();
  g.drawImage(image, (168.75 - 80) * echelle, (108.3 - 80) * echelle, 160 * echelle, 160 * echelle, 0, 0, 160 * echelle, 160 * echelle);
  return canvas;
}

/** Dans la meme planche, en haut a droite : le cartouche du nom de la zone (x 82 a 256, y 1 a 28). */
function bandeauDeZone(image: HTMLImageElement) {
  const echelle = image.naturalWidth / 256;
  const canvas = document.createElement("canvas");
  canvas.width = 174 * echelle;
  canvas.height = 27 * echelle;
  canvas.getContext("2d")!.drawImage(image, 82 * echelle, 1 * echelle, 174 * echelle, 27 * echelle, 0, 0, 174 * echelle, 27 * echelle);
  return canvas;
}

/**
 * Les surbrillances de WoW sont des textures "additives" : le noir n'y
 * ajoute rien, il est donc transparent a l'ecran. Un navigateur ne sait pas
 * l'afficher ainsi : on transforme le noir en transparence.
 */
function additive(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const g = canvas.getContext("2d")!;
  g.drawImage(image, 0, 0);
  const pixels = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const lumiere = Math.max(d[i], d[i + 1], d[i + 2]);
    if (lumiere === 0) {
      d[i + 3] = 0;
      continue;
    }
    // Meme couleur percue une fois posee sur du noir : couleur / lumiere, opacite = lumiere.
    d[i] = (d[i] * 255) / lumiere;
    d[i + 1] = (d[i + 1] * 255) / lumiere;
    d[i + 2] = (d[i + 2] * 255) / lumiere;
    d[i + 3] = (d[i + 3] * lumiere) / 255;
  }
  g.putImageData(pixels, 0, 0);
  return canvas;
}
