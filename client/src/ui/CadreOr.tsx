import type { CSSProperties, ReactNode } from "react";

/**
 * Brique de base des fenetres WoW : fond cuir/pierre + double liseret dore.
 * Les sacs, la fiche de personnage et les panneaux du MJ reposeront dessus.
 */
export function CadreOr({
  titre,
  children,
  style,
}: {
  titre?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      style={{
        position: "relative",
        padding: "28px 34px",
        background:
          "linear-gradient(180deg, rgba(40,31,21,0.96) 0%, rgba(18,14,10,0.98) 100%)",
        border: "2px solid var(--wow-or)",
        borderRadius: 6,
        boxShadow:
          "0 0 0 3px #120d08, 0 0 0 4px var(--wow-bronze), 0 18px 48px var(--wow-ombre)",
        ...style,
      }}
    >
      {titre && (
        <h1
          style={{
            margin: "0 0 18px",
            fontFamily: "var(--police-titre)",
            fontSize: 34,
            letterSpacing: 1,
            textAlign: "center",
            color: "var(--wow-or-clair)",
            textShadow: "0 2px 0 #000, 0 0 18px rgba(212,175,55,0.35)",
          }}
        >
          {titre}
        </h1>
      )}
      {children}
    </section>
  );
}
