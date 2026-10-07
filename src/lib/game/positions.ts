import { ovrFromOutfield } from "./stats";
import type { Player, Pos } from "./types";

/** Las únicas posiciones válidas del juego. */
export const VALID_POSITIONS: readonly Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];

const VALID = new Set<string>(VALID_POSITIONS);

/** Etiquetas viejas o de otros juegos que se traducen a una posición válida. */
const ALIASES: Record<string, Pos> = {
  LM: "LW",
  RM: "RW",
  LWB: "LB",
  RWB: "RB",
  DM: "CDM",
  CDM: "CDM",
  AM: "CAM",
  SS: "CAM",
  CF: "ST",
  FW: "ST",
  LF: "LW",
  RF: "RW",
  SW: "CB",
  GOALKEEPER: "GK",
  GKP: "GK",
};

export function isValidPos(value: unknown): value is Pos {
  return typeof value === "string" && VALID.has(value);
}

/**
 * Devuelve una posición válida a partir de un valor cualquiera (incluye alias como LM/RM y
 * minúsculas), o `null` si no se puede reconocer. Nunca devuelve vacío/undefined.
 */
export function coercePos(value: unknown): Pos | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toUpperCase();
  if (VALID.has(key)) return key as Pos;
  return ALIASES[key] ?? null;
}

/** Deduce la posición más natural de un jugador al que le falta (usa sus atributos). */
export function inferPos(p: Partial<Pick<Player, "attrs" | "gk">>): Pos {
  if (p.gk) return "GK";
  const attrs = p.attrs;
  if (!attrs) return "CM";
  let best: Pos = "CM";
  let bestOvr = -1;
  for (const pos of VALID_POSITIONS) {
    if (pos === "GK") continue;
    const ovr = ovrFromOutfield(pos, attrs);
    if (Number.isFinite(ovr) && ovr > bestOvr) {
      bestOvr = ovr;
      best = pos;
    }
  }
  return best;
}

/** Posición válida garantizada: reconoce el valor, si no usa `fallback` y, como último recurso, la deduce. */
export function normalizePos(value: unknown, fallback?: unknown, source?: Partial<Pick<Player, "attrs" | "gk">>): Pos {
  return coercePos(value) ?? coercePos(fallback) ?? inferPos(source ?? {});
}

/** Repara en el sitio la posición de un jugador (o juvenil). Devuelve el mismo objeto. */
export function ensurePos<T extends { pos?: unknown; attrs?: Player["attrs"]; gk?: Player["gk"] }>(p: T): T {
  if (!isValidPos(p.pos)) (p as { pos: Pos }).pos = normalizePos(p.pos, undefined, p);
  return p;
}

/** Repara una lista entera; devuelve cuántos jugadores tenían posición inválida. */
export function repairPositions(players: Array<{ pos?: unknown }>): number {
  let fixed = 0;
  for (const p of players) {
    if (isValidPos(p.pos)) continue;
    ensurePos(p as Parameters<typeof ensurePos>[0]);
    fixed += 1;
  }
  return fixed;
}
