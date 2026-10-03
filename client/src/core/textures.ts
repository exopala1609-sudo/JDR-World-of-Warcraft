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
  "micro-personnage": ["UI-MicroButton-Character-Up", "UI-MicroButton-Raid-Up"],
  "micro-personnage-appui": ["UI-MicroButton-Character-Down", "UI-MicroButton-Raid-Down"],
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
  // Boutons a icone (pas au format micro-bouton) : ils passent devant le micro-bouton.
  "icone-initiative": ["UI-Battlefield-Icon"],
  "icone-son": ["VOICECHAT-SPEAKER"],
  des: ["UI-GroupLoot-Dice-Up"], // le bouton du lanceur de des, pres de la discussion
  "des-appui": ["UI-GroupLoot-Dice-Down"],
  // --- Outils du MJ (page 1 de sa barre d'actions) -------------------------------
  "outil-bestiaire": ["LootPanel-Icon"],
  "outil-compendium": ["INV_Misc_Book_07"],
  "outil-initiative": ["Spell-Reset"],
  "outil-carte": ["INV_Misc_Map_01"],
  "outil-reveler": ["Ability_Paladin_LightoftheProtector"],
  "outil-quetes": ["Achievement_Quests_Completed_07"],
  "outil-repos": ["Spell_Nature_Sleep"],
  "outil-carnet": ["INV_Scroll_11"],
  "outil-recharger": ["misc_arrowleft"],
  // --- Discussion -------------------------------------------------------------------
  "chat-joueur": ["UI-ChatIcon-Battlenet"],
  "chat-mj": ["UI-ChatIcon-Blizz"],
  "chat-saisie": ["UI-ChatInputBorder-Left2"], // + Mid2 et Right2 (voir AUTRES)
  // --- Argent (sac) -------------------------------------------------------------------
  "piece-or": ["UI-GoldIcon"],
  "piece-argent": ["UI-SilverIcon"],
  "piece-cuivre": ["UI-CopperIcon"],
  // --- Curseur de la souris (le gantelet de WoW) ------------------------------------
  curseur: ["Point"],
  // --- Barre d'actions : la barre de WoW, et ses griffons (Dwarf) ou lions (Human)
  griffon: ["UI-MainMenuBar-EndCap-Dwarf", "UI-MainMenuBar-EndCap-Human"],
  "barre-actions": ["UI-MainMenuBar-Dwarf", "UI-MainMenuBar-Human"],
  "barre-page": ["UI-MainMenuBar-Dwarf", "UI-MainMenuBar-Human"], // la colonne "page 1 / 2", dans la meme planche
  // --- Cadres des joueurs (en haut a gauche) ----------------------------------------
  "cadre-unite": ["UI-Player-Portrait"],
  // --- Cadre de cible, selon le rang du monstre --------------------------------------
  "cible-normal": ["TargetFrame", "UI-TargetingFrame"],
  "cible-elite": ["TargetFrameElite", "UI-TargetingFrame-Elite"],
  "cible-rare": ["TargetFrameRare", "UI-TargetingFrame-Rare"],
  "cible-boss": ["UnitFrameBoss"],
  // --- Fenetre de butin ------------------------------------------------------------------
  "butin-cadre": ["UI-LootPanel"],
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
  "quete-parchemin": ["QuestBackgroundClassic2", "QuestBackgroundClassic"],
  "quete-cadre": ["UI-QuestGreeting-TopRight"], // + UI-QuestGreeting-BotRight-blank (voir AUTRES)
  "quete-cadre-fond": ["UI-QuestGreeting-TopRight"],
  livre: ["Spellbook-Page-1"], // + Spellbook-Page-2, le bord droit du livre (voir AUTRES)
  // --- Ecran d'accueil -----------------------------------------------------------
  "accueil-fond": ["UI_MainMenu_BattleForAzeroth_LowBandwidth", "UI_MainMenu_BattleForAzeroth"],
  "accueil-logo": ["Glues-WoW-ClassicLogo", "Glues-WoW-WotLKLogo", "Glues-WoW-Logo"],
  roche: ["UI-Background-Rock"],
} satisfies Record<string, string[]>;

// --- Roles fabriques d'apres le referentiel ----------------------------------------
// Les portraits provisoires de WoW (TemporaryPortrait-Female-NightElf...) par race
// et par sexe, les fonds de l'ecran de creation et les logos par faction.
const RACES_WOW: Record<string, string[]> = {
  humain: ["Human"],
  nain: ["Dwarf"],
  "elfe-de-la-nuit": ["NightElf"],
  gnome: ["Gnome"],
  draenei: ["Draenei"],
  worgen: ["Worgen"],
  orc: ["Orc"],
  "mort-vivant": ["Scourge"],
  tauren: ["Tauren", "HighmountainTauren"],
  troll: ["Troll"],
  "elfe-de-sang": ["BloodElf"],
  gobelin: ["Goblin"],
  pandaren: ["Pandaren"],
  dracthyr: ["Dracthyr"],
};
const ROLES_DU_REFERENTIEL: Record<string, string[]> = {
  "fond-alliance": ["Hurlevents", "Stormwind"],
  "fond-horde": ["Orgrimmar"],
  "logo-alliance": ["Alliance-Logo"],
  "logo-horde": ["Horde-Logo"],
};
for (const [race, noms] of Object.entries(RACES_WOW)) {
  ROLES_DU_REFERENTIEL[`portrait-${race}-masculin`] = noms.map((n) => `TemporaryPortrait-Male-${n}`);
  ROLES_DU_REFERENTIEL[`portrait-${race}-feminin`] = noms.map((n) => `TemporaryPortrait-Female-${n}`);
}

export type RoleTexture = keyof typeof ROLES | `portrait-${string}` | `fond-${string}` | `logo-${string}`;

// Les roles qu'on recompose dans un canvas avant de s'en servir. La fonction
// recoit l'image du role et, dans l'ordre, celles des fichiers AUTRES (null
// si absent).
type Recomposition = (image: HTMLImageElement, autres: (HTMLImageElement | null)[]) => HTMLCanvasElement;
const RECOMPOSER: Partial<Record<string, Recomposition>> = {
  "bordure-dialogue": bordureNeufParties,
  "bordure-or": bordureNeufParties,
  "minicarte-bordure": anneauMinicarte,
  "minicarte-bandeau": bandeauDeZone,
  "quete-surbrillance": additive,
  "quete-parchemin": (image) => rogner(image),
  "quete-cadre": cadreDeQuete,
  "quete-cadre-fond": (image) => decouper(image, 0, 92, 60, 164, 128),
  livre: livreOuvert,
  "chat-saisie": barreDeSaisie,
  "barre-actions": barreDActions,
  "barre-page": (image) => decouper(image, 0, 74, 40, 54, 256),
  "cadre-unite": (image) => decouper(image, 0, 0, 193, 76, 256),
  "butin-cadre": (image) => decouper(image, 0, 0, 188, 252, 256), // le cadre seul, sans la marge vide
};
// Fichiers supplementaires d'un role recompose (une liste de candidats par fichier).
const AUTRES: Partial<Record<string, string[][]>> = {
  "quete-cadre": [["UI-QuestGreeting-BotRight-blank", "UI-QuestGreeting-BotRight"]],
  livre: [["Spellbook-Page-2"]],
  "chat-saisie": [["UI-ChatInputBorder-Mid2"], ["UI-ChatInputBorder-Right2"]],
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
  const adresse = (candidats: string[]) => {
    const fichier = candidats.map((c) => index.get(c.toLowerCase())).find(Boolean);
    return fichier ? `/medias/interface/${fichier.split("/").map(encodeURIComponent).join("/")}` : null;
  };
  for (const [role, candidats] of Object.entries({ ...ROLES, ...ROLES_DU_REFERENTIEL }) as [RoleTexture, string[]][]) {
    const url = adresse(candidats);
    if (!url) continue;
    const recomposer = RECOMPOSER[role];
    if (!recomposer) {
      brancher(role, url);
      continue;
    }
    const autres = (AUTRES[role] ?? []).map((c) => {
      const u = adresse(c);
      return u ? chargerImage(u).catch(() => null) : Promise.resolve(null);
    });
    Promise.all([chargerImage(url), ...autres])
      .then(([image, ...suite]) => brancher(role, recomposer(image!, suite).toDataURL()))
      .catch(() => {}); // image illisible ou incomplete : on garde le dessin actuel
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

/** Un morceau d'une planche (coordonnees donnees pour une planche de `largeur` px, mise a l'echelle si besoin). */
function decouper(image: HTMLImageElement, x: number, y: number, l: number, h: number, largeur: number) {
  const e = image.naturalWidth / largeur;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(l * e);
  canvas.height = Math.round(h * e);
  canvas.getContext("2d")!.drawImage(image, x * e, y * e, l * e, h * e, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Retire les marges transparentes autour du dessin (ex. le parchemin de QuestBackgroundClassic). */
function rogner(image: HTMLImageElement) {
  const { naturalWidth: l, naturalHeight: h } = image;
  const source = document.createElement("canvas");
  source.width = l;
  source.height = h;
  const g = source.getContext("2d")!;
  g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, l, h).data;
  let x0 = l,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < l; x++)
      if (d[(y * l + x) * 4 + 3] > 40) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  if (x1 < 0) return source;
  const canvas = document.createElement("canvas");
  canvas.width = x1 - x0 + 1;
  canvas.height = y1 - y0 + 1;
  canvas.getContext("2d")!.drawImage(source, x0, y0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Dessine un morceau, eventuellement retourne comme dans un miroir (pour fabriquer le cote gauche). */
function poser(g: CanvasRenderingContext2D, image: HTMLImageElement, e: number, s: number[], x: number, y: number, miroir = false) {
  const [sx, sy, l, h] = s;
  g.save();
  g.translate(miroir ? x + l : x, y);
  if (miroir) g.scale(-1, 1);
  g.drawImage(image, sx * e, sy * e, l * e, h * e, 0, 0, l, h);
  g.restore();
}

/**
 * Le cadre du dialogue de quete de WoW, a partir de ses deux morceaux de droite
 * (UI-QuestGreeting-TopRight et -BotRight-blank, 128 x 256 chacun). Le cote
 * gauche est le cote droit vu dans un miroir. Resultat : une image 3 x 3
 * (bords de 37 px a gauche et a droite, 72 px en haut, 41 px en bas) pour
 * border-image, le centre vide (le parchemin est pose a part, etire).
 */
function cadreDeQuete(haut: HTMLImageElement, [bas]: (HTMLImageElement | null)[]) {
  if (!bas) throw new Error("UI-QuestGreeting-BotRight-blank manquant");
  const e = haut.naturalWidth / 128;
  const canvas = document.createElement("canvas");
  canvas.width = 134;
  canvas.height = 277;
  const g = canvas.getContext("2d")!;
  // Haut : barre de titre ; a droite, le coin (et la place du bouton de fermeture).
  poser(g, haut, e, [0, 20, 60, 72], 37, 0);
  poser(g, haut, e, [60, 20, 37, 72], 97, 0);
  poser(g, haut, e, [60, 20, 37, 72], 0, 0, true);
  // Cotes : la gouttiere noire et le liseré de metal.
  poser(g, haut, e, [60, 92, 37, 164], 97, 72);
  poser(g, haut, e, [60, 92, 37, 164], 0, 72, true);
  // Bas.
  const eb = bas.naturalWidth / 128;
  poser(g, bas, eb, [0, 148, 60, 41], 37, 236);
  poser(g, bas, eb, [60, 148, 37, 41], 97, 236);
  poser(g, bas, eb, [60, 148, 37, 41], 0, 236, true);
  return canvas;
}

/**
 * Le livre des sorts de WoW : Spellbook-Page-1 (512 x 512, la page avec son
 * signet) et Spellbook-Page-2 (32 x 512, le bord droit du livre), cote a cote.
 */
function livreOuvert(page: HTMLImageElement, [bord]: (HTMLImageElement | null)[]) {
  const canvas = document.createElement("canvas");
  canvas.width = page.naturalWidth + (bord?.naturalWidth ?? 0);
  canvas.height = page.naturalHeight;
  const g = canvas.getContext("2d")!;
  g.drawImage(page, 0, 0);
  if (bord) g.drawImage(bord, page.naturalWidth, 0, bord.naturalWidth, page.naturalHeight);
  return canvas;
}

/**
 * UI-MainMenuBar-Dwarf (256 x 256) : 4 bandes de 64 px de haut. Les deux du
 * bas portent les 12 emplacements (bande 3 : 1 a 6, bande 2 : 7 a 12). On
 * garde de chacune les lignes 10 a 64 (le rail de l'experience + la barre)
 * et on les met bout a bout : 512 x 54 px. Le premier emplacement commence a
 * 8 px du bord, puis un tous les 42 px (36 px de case + 6 px d'ecart).
 */
function barreDActions(image: HTMLImageElement) {
  const e = image.naturalWidth / 256;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 54;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgba(0, 0, 0, 0.6)"; // l'interieur (vide) du rail d'experience
  g.fillRect(0, 4, 512, 6);
  g.drawImage(image, 0, 202 * e, 256 * e, 54 * e, 0, 0, 256, 54);
  g.drawImage(image, 0, 138 * e, 256 * e, 54 * e, 256, 0, 256, 54);
  return canvas;
}

/** La barre de saisie de la discussion : gauche | milieu | droite (32 x 32 chacun), cote a cote. */
function barreDeSaisie(gauche: HTMLImageElement, [milieu, droite]: (HTMLImageElement | null)[]) {
  if (!milieu || !droite) throw new Error("UI-ChatInputBorder-Mid2 / -Right2 manquant");
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 32;
  const g = canvas.getContext("2d")!;
  g.drawImage(gauche, 0, 0, 32, 32);
  g.drawImage(milieu, 32, 0, 32, 32);
  g.drawImage(droite, 64, 0, 32, 32);
  return canvas;
}

/** Le portrait provisoire de WoW d'un personnage (race + sexe), ou null. */
export function rolePortrait(race: string | null, sexe: string | null): RoleTexture | null {
  return race ? `portrait-${race}-${sexe ?? "masculin"}` : null;
}
