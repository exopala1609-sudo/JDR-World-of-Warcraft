// Zod est la bibliotheque qui verifie la forme des donnees ("ce champ est-il
// bien un entier entre 1 et 30 ?"). On la regle ici une fois pour toutes en
// francais, et tous les modeles l'importent depuis ce fichier.
import { z } from "zod";

z.config(z.locales.fr());

export { z };
