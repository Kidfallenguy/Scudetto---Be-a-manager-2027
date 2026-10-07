import { clubById } from "./clubs";
import { userMatchHistory } from "./selectors";
import type { ClubId, GameSave } from "./types";
import { sortTable } from "./world";

// ---------------------------------------------------------------------------
// Historial de carrera del manager: un registro por temporada dirigida.
// Las temporadas cerradas quedan guardadas en `save.careerHistory`; la que está en curso
// se calcula al vuelo a partir de los partidos jugados, así nunca se desincroniza.
// ---------------------------------------------------------------------------

/** Primera temporada de toda carrera nueva (sirve para estimar temporadas de partidas viejas). */
export const FIRST_SEASON = 2026;

export interface CareerSeasonRecord {
  season: number;
  clubId: ClubId;
  /** Posición final en la liga (null si no se pudo determinar). */
  place: number | null;
  /** Equipos de esa liga. */
  teams: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  /** Títulos ganados esa temporada (etiqueta completa, ej. "Premier League 2026/27"). */
  titles: string[];
  /** Principales logros y datos destacados. */
  highlights: string[];
  /** El manager fue despedido esa temporada. */
  sacked?: boolean;
  /** Solo en el registro calculado al vuelo: la temporada aún no se archivó. */
  live?: boolean;
  /** Solo en el registro calculado al vuelo: la temporada ya terminó. */
  finished?: boolean;
}

export interface CareerTotals {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  /** 0-100. */
  winRate: number;
  clubs: ClubId[];
  seasons: number;
  titles: number;
}

/** Registro de la temporada del save tal como está ahora mismo. */
export function buildSeasonRecord(save: GameSave): CareerSeasonRecord {
  const matches = userMatchHistory(save);
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let gf = 0;
  let ga = 0;
  let bigWin: (typeof matches)[number] | null = null;
  for (const m of matches) {
    if (m.outcome === "W") won++;
    else if (m.outcome === "D") drawn++;
    else lost++;
    gf += m.goalsFor;
    ga += m.goalsAgainst;
    if (m.outcome === "W" && (!bigWin || m.goalsFor - m.goalsAgainst > bigWin.goalsFor - bigWin.goalsAgainst)) {
      bigWin = m;
    }
  }

  const table = sortTable(save.standings);
  const idx = table.findIndex((r) => r.clubId === save.clubId);
  const place = idx >= 0 ? idx + 1 : null;

  const titles = (save.careerTrophies ?? []).filter((t) => t.season === save.season).map((t) => t.label);

  const highlights: string[] = [];
  if (place === 1) highlights.push("Campeón de liga");
  else if (place !== null && place <= 4 && table.length >= 12) highlights.push(`Entre los 4 primeros (${place}º)`);
  const goals = save.board?.goals ?? [];
  const met = goals.filter((g) => g.state === "met");
  if (goals.length) highlights.push(`Objetivos de la dirigencia: ${met.length}/${goals.length} cumplidos`);
  for (const g of met) if (g.weight >= 2) highlights.push(`Cumplido: ${g.label}`);
  const scorer = save.players
    .filter((p) => p.clubId === save.clubId || p.loanFrom === save.clubId)
    .sort((a, b) => b.goals - a.goals)[0];
  if (scorer && scorer.goals > 0) highlights.push(`Goleador: ${scorer.name} (${scorer.goals})`);
  if (bigWin && bigWin.goalsFor - bigWin.goalsAgainst >= 3) {
    highlights.push(`Mayor goleada: ${bigWin.goalsFor}-${bigWin.goalsAgainst} a ${clubById(bigWin.opponentId).short}`);
  }

  return {
    season: save.season,
    clubId: save.clubId,
    place,
    teams: table.length,
    played: matches.length,
    won,
    drawn,
    lost,
    gf,
    ga,
    titles,
    highlights,
  };
}

/** ¿Ya hay un registro archivado de esta temporada con el club actual? */
export function hasSeasonRecord(save: GameSave): boolean {
  return (save.careerHistory ?? []).some((r) => r.season === save.season && r.clubId === save.clubId);
}

/**
 * Archiva la temporada actual en el historial (una sola vez por temporada y club).
 * Se llama antes de pasar de año o de cambiar de club, y cuando despiden al manager
 * (así los partidos que el club juega después, sin él, no cuentan para su carrera).
 */
export function archiveSeason(save: GameSave) {
  if (!save.clubId || !save.players.length) return;
  if (!save.careerHistory) save.careerHistory = [];
  if (hasSeasonRecord(save)) return;
  const rec = buildSeasonRecord(save);
  if (save.board?.sacked) rec.sacked = true;
  // Una temporada sin un solo partido dirigido (p. ej. cambio de club inmediato) no suma nada.
  if (rec.played === 0 && !rec.sacked) return;
  save.careerHistory.push(rec);
}

/** Historial completo: temporadas archivadas + la temporada en curso (si todavía no se archivó). */
export function careerSeasons(save: GameSave): CareerSeasonRecord[] {
  const out = [...(save.careerHistory ?? [])];
  if (save.clubId && save.players.length && !hasSeasonRecord(save)) {
    const live = buildSeasonRecord(save);
    if (live.played > 0 || !save.seasonOver) {
      live.live = true;
      live.finished = save.seasonOver;
      out.push(live);
    }
  }
  return out;
}

export function careerTotals(save: GameSave, seasons: CareerSeasonRecord[] = careerSeasons(save)): CareerTotals {
  const sum = (f: (r: CareerSeasonRecord) => number) => seasons.reduce((n, r) => n + f(r), 0);
  const played = sum((r) => r.played);
  const won = sum((r) => r.won);
  const clubs = [...new Set([...seasons.map((r) => r.clubId), ...(save.clubId ? [save.clubId] : [])])];
  // Partidas anteriores a esta función no tienen temporadas archivadas: se estiman desde el año inicial.
  const estimated = Math.max(0, save.season - FIRST_SEASON + 1);
  return {
    played,
    won,
    drawn: sum((r) => r.drawn),
    lost: sum((r) => r.lost),
    gf: sum((r) => r.gf),
    ga: sum((r) => r.ga),
    winRate: played > 0 ? (won / played) * 100 : 0,
    clubs,
    seasons: Math.max(seasons.length, estimated),
    // Los títulos salen de la vitrina de la carrera, que también tiene los de temporadas sin archivar.
    titles: (save.careerTrophies ?? []).length,
  };
}

/** Temporadas ganadas del trofeo que no tienen registro (partidas viejas), para mostrarlas igual. */
export function untrackedTrophySeasons(save: GameSave, seasons: CareerSeasonRecord[]): Array<{ season: number; titles: string[] }> {
  const known = new Set(seasons.map((r) => r.season));
  const bySeason = new Map<number, string[]>();
  for (const t of save.careerTrophies ?? []) {
    if (known.has(t.season)) continue;
    const list = bySeason.get(t.season);
    if (list) list.push(t.label);
    else bySeason.set(t.season, [t.label]);
  }
  return [...bySeason.entries()].sort((a, b) => a[0] - b[0]).map(([season, titles]) => ({ season, titles }));
}

/** Limpia lo que venga de un guardado (partidas viejas o dañadas). */
export function normalizeCareerHistory(raw: unknown): CareerSeasonRecord[] {
  if (!Array.isArray(raw)) return [];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const out: CareerSeasonRecord[] = [];
  for (const r of raw as Array<Partial<CareerSeasonRecord>>) {
    if (!r || typeof r.season !== "number" || typeof r.clubId !== "string") continue;
    out.push({
      season: r.season,
      clubId: r.clubId,
      place: typeof r.place === "number" ? r.place : null,
      teams: num(r.teams),
      played: num(r.played),
      won: num(r.won),
      drawn: num(r.drawn),
      lost: num(r.lost),
      gf: num(r.gf),
      ga: num(r.ga),
      titles: Array.isArray(r.titles) ? r.titles.filter((t) => typeof t === "string") : [],
      highlights: Array.isArray(r.highlights) ? r.highlights.filter((t) => typeof t === "string") : [],
      ...(r.sacked ? { sacked: true } : {}),
    });
  }
  return out;
}
