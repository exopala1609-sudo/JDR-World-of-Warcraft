// Identifiants courts, en minuscules et en hexadecimal.
// - minuscules : Windows ne distingue pas "A" et "a" dans les noms de fichiers ;
// - format strict : un identifiant sert de nom de fichier, on refuse donc tout
//   ce qui pourrait ressembler a un chemin ("../../", "C:\", etc.).
import { randomBytes } from "node:crypto";
import { z } from "./zod.js";

export const nouvelId = (prefixe) => `${prefixe}-${randomBytes(5).toString("hex")}`;

export const schemaId = (prefixe) =>
  z.string().regex(new RegExp(`^${prefixe}-[0-9a-f]{10}$`), "Identifiant invalide.");
