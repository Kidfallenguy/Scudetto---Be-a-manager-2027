import type { ClubId, GameSave } from "./types";

// ---------------------------------------------------------------------------
// Premios individuales por temporada (Balón de Oro, Bota de Oro, etc.).
// Esto es solo la ESTRUCTURA: cada premio guarda nombre, ganador, temporada y nominados.
// Todavía no hay ceremonia, ni cálculo de rendimiento, ni historial: quien los
// implemente después solo tiene que llenar `winner` y `nominees` (ver `setAwardResult`).
// (No confundir con `prizes.ts`, que son los premios en dinero por títulos.)
// ---------------------------------------------------------------------------

export type AwardKind = "balon_oro" | "bota_oro" | "puskas" | "guante_oro" | "dt_anio" | "kopa";

/** A quién se le entrega el premio. */
export type AwardTarget = "player" | "manager";

export interface AwardDef {
  name: string;
  target: AwardTarget;
  description: string;
}

/** Orden en el que se muestran/crean los premios. */
export const AWARD_KINDS: AwardKind[] = ["balon_oro", "bota_oro", "puskas", "guante_oro", "dt_anio", "kopa"];

export const AWARD_DEFS: Record<AwardKind, AwardDef> = {
  balon_oro: { name: "Balón de Oro", target: "player", description: "Mejor jugador de la temporada." },
  bota_oro: { name: "Bota de Oro", target: "player", description: "Máximo goleador de la temporada." },
  puskas: { name: "Puskás", target: "player", description: "Mejor gol de la temporada." },
  guante_oro: { name: "Guante de Oro", target: "player", description: "Mejor arquero de la temporada." },
  dt_anio: { name: "DT del Año", target: "manager", description: "Mejor director técnico de la temporada." },
  kopa: { name: "Trofeo Kopa", target: "player", description: "Mejor jugador joven de la temporada." },
};

/** Ganador o nominado. `id` es el id del jugador (o del club para un DT); `clubId` su club en esa temporada. */
export interface AwardNominee {
  id: string;
  name: string;
  clubId: ClubId;
  /** Resumen corto de por qué está nominado (ej. "24 goles · 9 asist. · 33 partidos"). Opcional. */
  detail?: string;
}

export interface SeasonAward {
  /** `${season}:${kind}` — único por premio y temporada. */
  id: string;
  kind: AwardKind;
  /** Nombre del premio (ej. "Balón de Oro"). */
  name: string;
  season: number;
  /** null hasta que se entrega el premio. */
  winner: AwardNominee | null;
  nominees: AwardNominee[];
}

export function awardId(season: number, kind: AwardKind): string {
  return `${season}:${kind}`;
}

export function isAwardKind(v: unknown): v is AwardKind {
  return typeof v === "string" && (AWARD_KINDS as string[]).includes(v);
}

/** Un premio vacío (sin ganador ni nominados). */
export function createAward(season: number, kind: AwardKind): SeasonAward {
  return { id: awardId(season, kind), kind, name: AWARD_DEFS[kind].name, season, winner: null, nominees: [] };
}

/** Los 6 premios de una temporada, todos vacíos. */
export function createSeasonAwards(season: number): SeasonAward[] {
  return AWARD_KINDS.map((kind) => createAward(season, kind));
}

/**
 * Se asegura de que la temporada actual tenga sus 6 premios (agrega solo los que faltan).
 * No pisa premios ya existentes y no muta el array anterior (el save de la temporada vieja queda intacto).
 */
export function ensureSeasonAwards(save: GameSave): void {
  const current = Array.isArray(save.awards) ? save.awards : [];
  const have = new Set(current.map((a) => a.id));
  const missing = createSeasonAwards(save.season).filter((a) => !have.has(a.id));
  if (missing.length || !Array.isArray(save.awards)) save.awards = [...current, ...missing];
}

export function awardsOfSeason(awards: SeasonAward[], season: number): SeasonAward[] {
  return awards.filter((a) => a.season === season);
}

export function findAward(awards: SeasonAward[], season: number, kind: AwardKind): SeasonAward | undefined {
  return awards.find((a) => a.season === season && a.kind === kind);
}

/**
 * Carga ganador y nominados de un premio (sin mutar). Si el premio no existe todavía, lo crea.
 * Es el punto de entrada para cuando se agregue la ceremonia / el cálculo de ganadores.
 */
export function setAwardResult(
  awards: SeasonAward[],
  season: number,
  kind: AwardKind,
  result: { winner: AwardNominee | null; nominees: AwardNominee[] },
): SeasonAward[] {
  const updated: SeasonAward = { ...createAward(season, kind), winner: result.winner, nominees: result.nominees };
  const exists = awards.some((a) => a.id === updated.id);
  return exists ? awards.map((a) => (a.id === updated.id ? updated : a)) : [...awards, updated];
}

function normalizeNominee(raw: unknown): AwardNominee | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Partial<AwardNominee>;
  if (typeof n.id !== "string" || typeof n.name !== "string") return null;
  return {
    id: n.id,
    name: n.name,
    clubId: typeof n.clubId === "string" ? n.clubId : "",
    ...(typeof n.detail === "string" && n.detail ? { detail: n.detail } : {}),
  };
}

/** Limpia lo que viene de una partida guardada (las viejas no tienen premios → lista vacía). */
export function normalizeAwards(raw: unknown): SeasonAward[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SeasonAward[] = [];
  for (const r of raw as Array<Partial<SeasonAward>>) {
    if (!r || typeof r.season !== "number" || !Number.isFinite(r.season) || !isAwardKind(r.kind)) continue;
    const id = awardId(r.season, r.kind);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      kind: r.kind,
      name: AWARD_DEFS[r.kind].name,
      season: r.season,
      winner: normalizeNominee(r.winner),
      nominees: Array.isArray(r.nominees)
        ? r.nominees.map(normalizeNominee).filter((n): n is AwardNominee => n !== null)
        : [],
    });
  }
  return out;
}
