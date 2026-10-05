import { clubById, domesticIds, isDomesticCompetition, leagueInfo, playableLeague } from "./clubs";
import { QUAL_SPOTS, coppaFinalRound, coppaStageLabel, finalRoundOf } from "./competitions";
import { hash01 } from "./contracts";
import { COMP_LABEL, clamp, uid } from "./format";
import { honourLabel } from "./honours";
import { managerOffers } from "./manager";
import { groupStageFinished, userCompStatus } from "./participation";
import type { BoardGoal, BoardLogEntry, BoardState, Competition, Fixture, GameSave, LeagueKind } from "./types";
import { rankedByPrestige, resolveDrawWinner, sortTable, tieWinner } from "./world";

const LOG_LIMIT = 14;
/** Confianza por debajo de la cual la dirigencia avisa (nivel 1, 2 y 3). El nivel 3 es la reunión de emergencia. */
const WARN_AT = [55, 35, 25] as const;
/** Con esta confianza (o menos) el despido empieza a ser posible, según cómo esté el club. */
const SACK_AT = 25;
/** Partidos de plazo que da la dirigencia después de la reunión de emergencia. */
const ULTIMATUM_GAMES = 3;

/** Tope de confianza que se puede sumar por clásicos en una temporada (menos que cumplir un objetivo, que da 5 o más). */
const CLASSIC_SEASON_CAP = 3.5;

type Part = { delta: number; text: string };

/** Clásicos y derbis. Nivel 2: los grandes de cada país; nivel 1: derbis locales con rivalidad histórica. */
const CLASSICS: { a: string; b: string; name: string; tier: 1 | 2 }[] = [
  { a: "rma", b: "bar", name: "Clásico", tier: 2 },
  { a: "boc", b: "riv", name: "Superclásico", tier: 2 },
  { a: "mil", b: "int", name: "Derby della Madonnina", tier: 2 },
  { a: "juv", b: "int", name: "Derby d'Italia", tier: 2 },
  { a: "rom", b: "laz", name: "Derby della Capitale", tier: 2 },
  { a: "bay", b: "dor", name: "Der Klassiker", tier: 2 },
  { a: "mci", b: "mun", name: "Derbi de Mánchester", tier: 2 },
  { a: "psg", b: "om", name: "Le Classique", tier: 2 },
  { a: "rma", b: "atl", name: "Derbi madrileño", tier: 1 },
  { a: "bar", b: "esp", name: "Derbi catalán", tier: 1 },
  { a: "sev", b: "bet", name: "Derbi sevillano", tier: 1 },
  { a: "ars", b: "tot", name: "Derbi del norte de Londres", tier: 1 },
  { a: "ars", b: "che", name: "Derbi de Londres", tier: 1 },
  { a: "che", b: "tot", name: "Derbi de Londres", tier: 1 },
  { a: "liv", b: "eve", name: "Derbi del Mersey", tier: 1 },
  { a: "mun", b: "liv", name: "Clásico inglés", tier: 1 },
  { a: "juv", b: "tor", name: "Derby della Mole", tier: 1 },
  { a: "nap", b: "rom", name: "Derbi del Sol", tier: 1 },
  { a: "hsv", b: "svw", name: "Nordderby", tier: 1 },
  { a: "koe", b: "bmg", name: "Derbi renano", tier: 1 },
  { a: "cai", b: "rca", name: "Clásico de Avellaneda", tier: 1 },
  { a: "riv", b: "rca", name: "Clásico", tier: 1 },
  { a: "cai", b: "riv", name: "Clásico", tier: 1 },
  { a: "boc", b: "slo", name: "Clásico", tier: 1 },
  { a: "slo", b: "hur", name: "Clásico del Barrio", tier: 1 },
  { a: "est", b: "gim", name: "Clásico platense", tier: 1 },
  { a: "rcen", b: "nob", name: "Clásico rosarino", tier: 1 },
  { a: "tal", b: "bel", name: "Clásico cordobés", tier: 1 },
  { a: "ban", b: "lan", name: "Clásico del Sur", tier: 1 },
];

function classicBetween(a: string, b: string) {
  return CLASSICS.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a)) ?? null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function fmtDelta(d: number): string {
  const v = Math.abs(round1(d)).toFixed(1).replace(".", ",");
  return d >= 0 ? `+${v}` : `−${v}`;
}

export function boardLabel(confidence: number): string {
  if (confidence >= 85) return "Respaldo total";
  if (confidence >= 70) return "Conformes";
  if (confidence >= 55) return "Con dudas";
  if (confidence >= 40) return "Impacientes";
  if (confidence >= 25) return "En crisis";
  return "Cuerda floja";
}

export function boardTone(confidence: number): "good" | "warn" | "bad" {
  if (confidence >= 70) return "good";
  if (confidence >= 45) return "warn";
  return "bad";
}

/* ------------------------------------------------------------------ */
/* Objetivos                                                           */
/* ------------------------------------------------------------------ */

function userFixtures(save: GameSave, comp: Competition): Fixture[] {
  return save.fixtures.filter(
    (f) => f.competition === comp && (f.homeId === save.clubId || f.awayId === save.clubId),
  );
}

/** Primera ronda que juega el usuario en una copa (los equipos con bye entran más tarde). */
function entryRound(save: GameSave, comp: Competition): number {
  let bye = Infinity;
  for (const s of save.calendar) {
    if (s.competition === comp && s.byes?.includes(save.clubId)) bye = Math.min(bye, s.round);
  }
  if (bye !== Infinity) return bye;
  const rounds = userFixtures(save, comp).map((f) => f.round);
  return rounds.length ? Math.min(...rounds) : 1;
}

/** ¿Ganó el usuario su cruce de esa ronda? */
function wonRound(save: GameSave, comp: Competition, round: number): boolean {
  if (round < entryRound(save, comp)) return true;
  const mine = userFixtures(save, comp).filter((f) => f.round === round);
  if (!mine.length) return false;
  const tie = mine.find((f) => f.tieId);
  if (tie?.tieId) return tieWinner(save, tie.tieId) === save.clubId;
  const f = mine[0]!;
  return f.played && resolveDrawWinner(f, save.seed) === save.clubId;
}

const hasGroups = (comp: Competition) => comp === "ucl" || comp === "libertadores";

/** ¿Alcanzó el usuario esa ronda de la competición? (ya pasó la anterior, o ya tiene el cruce) */
function reached(save: GameSave, comp: Competition, target: number): boolean {
  if (hasGroups(comp) && target <= 7) {
    if (userFixtures(save, comp).some((f) => f.round >= 7)) return true;
    return groupStageFinished(save, comp) && userCompStatus(save, comp) === "in";
  }
  if (userFixtures(save, comp).some((f) => f.round >= target)) return true;
  return wonRound(save, comp, target - 1);
}

function leaguePlaceNow(save: GameSave): number {
  const pl = playableLeague(clubById(save.clubId).league);
  const ranked = sortTable(save.leagueTables?.[pl] ?? save.standings);
  const i = ranked.findIndex((r) => r.clubId === save.clubId);
  return i >= 0 ? i + 1 : ranked.length;
}

function cupPhrase(league: LeagueKind, round: number): string {
  const s = coppaStageLabel(league, round);
  if (s === "Final") return "la final";
  if (s === "Semifinales") return "las semifinales";
  if (s === "Cuartos") return "los cuartos de final";
  if (s === "Octavos") return "los octavos de final";
  return s.toLowerCase();
}

function contPhrase(comp: Competition, round: number): string {
  const r = round - (hasGroups(comp) ? 6 : 0);
  if (r >= 4) return "la final";
  if (r === 3) return "las semifinales";
  return "los cuartos de final";
}

function leagueGoal(save: GameSave): BoardGoal {
  const club = clubById(save.clubId);
  const pl = playableLeague(club.league);
  const ids = domesticIds(pl);
  const n = ids.length;
  const idx = rankedByPrestige(ids).indexOf(save.clubId);
  const spot = idx >= 0 ? idx + 1 : Math.ceil(n / 2);
  const q = QUAL_SPOTS[pl];
  const bottom = q.releg || 3;
  const midCut = Math.ceil(n * 0.65);

  let target: number;
  let label: string;
  if (spot <= 1) {
    target = 1;
    label = "Ganar la liga";
  } else if (pl === "argentina") {
    if (spot <= 4) {
      target = 3;
      label = "Pelear el campeonato: terminar entre los 3 primeros";
    } else if (spot <= 8) {
      target = q.libertadores;
      label = `Clasificar a la Copa Libertadores (top ${target})`;
    } else if (spot <= 13) {
      target = q.libertadores + q.sudamericana;
      label = `Clasificar a una copa internacional (top ${target})`;
    } else if (spot <= midCut) {
      target = Math.ceil(n / 2);
      label = `Terminar en la mitad superior de la tabla (top ${target})`;
    } else {
      target = n - bottom;
      label = `Evitar los últimos ${bottom} puestos`;
    }
  } else if (spot <= 3) {
    target = 2;
    label = "Pelear el título: terminar entre los 2 primeros";
  } else if (spot <= 6) {
    target = q.ucl;
    label = `Clasificar a la Champions League (top ${target})`;
  } else if (spot <= 9) {
    target = q.ucl + q.uel + q.uecl;
    label = `Clasificar a una copa europea (top ${target})`;
  } else if (spot <= midCut) {
    target = Math.ceil(n / 2);
    label = `Terminar en la mitad superior de la tabla (top ${target})`;
  } else {
    target = n - bottom;
    label = `Evitar los últimos ${bottom} puestos`;
  }
  return {
    id: uid("bg"),
    kind: "league",
    comp: leagueInfo(club.league).competition,
    target,
    weight: 3,
    label,
    state: "open",
  };
}

function continentalGoals(save: GameSave): BoardGoal[] {
  const club = clubById(save.clubId);
  const out: BoardGoal[] = [];
  const comps: Competition[] = ["ucl", "libertadores", "uel", "uecl", "sudamericana"];
  for (const comp of comps) {
    if (userCompStatus(save, comp) === "none") continue;
    let target: number;
    let label: string;
    if (hasGroups(comp)) {
      target = club.prestige >= 90 ? 9 : club.prestige >= 82 ? 8 : 7;
      label =
        target === 7
          ? `Pasar la fase de grupos (${COMP_LABEL[comp]})`
          : `Llegar a ${contPhrase(comp, target)} (${COMP_LABEL[comp]})`;
    } else {
      const hi = comp === "uecl" ? 78 : 84;
      target = club.prestige >= hi ? 3 : 2;
      label = `Llegar a ${contPhrase(comp, target)} (${COMP_LABEL[comp]})`;
    }
    out.push({ id: uid("bg"), kind: "cup", comp, target, weight: 2, label, state: "open" });
  }
  return out;
}

function cupGoal(save: GameSave): BoardGoal {
  const club = clubById(save.clubId);
  const lg = club.league;
  const pl = playableLeague(lg);
  const ids = domesticIds(pl);
  const idx = rankedByPrestige(ids).indexOf(save.clubId);
  const spot = idx >= 0 ? idx + 1 : Math.ceil(ids.length / 2);
  const final = coppaFinalRound(lg);
  let target = spot <= 3 ? final - 1 : spot <= 8 ? final - 2 : final - 3;
  target = clamp(target, 2, final - 1);
  const entry = entryRound(save, "coppa");
  if (target <= entry) target = Math.min(final, entry + 1);
  return {
    id: uid("bg"),
    kind: "cup",
    comp: "coppa",
    target,
    weight: 1,
    label: `Llegar a ${cupPhrase(lg, target)} de la ${honourLabel("coppa", lg)}`,
    state: "open",
  };
}

export function generateGoals(save: GameSave): BoardGoal[] {
  return [leagueGoal(save), ...continentalGoals(save), cupGoal(save)];
}

type GoalResult = "open" | "met" | "failed";

function evalGoal(save: GameSave, g: BoardGoal, final: boolean): GoalResult {
  if (g.state !== "open") return g.state;
  if (g.kind === "league") {
    if (!final && !save.seasonOver) return "open";
    return leaguePlaceNow(save) <= g.target ? "met" : "failed";
  }
  if (reached(save, g.comp, g.target)) return "met";
  if (userCompStatus(save, g.comp) === "out") return "failed";
  return final ? "failed" : "open";
}

/** Texto corto del estado de un objetivo para la pantalla (en juego / cumplido / incumplido). */
export function goalHint(save: GameSave, g: BoardGoal): string {
  if (g.state === "met") return "Cumplido";
  if (g.state === "failed") return g.kind === "cup" ? "Eliminado antes de la meta" : "No se logró";
  if (g.kind === "league") {
    const place = leaguePlaceNow(save);
    const meta = g.target === 1 ? "1º" : `${g.target}º o mejor`;
    return `Vas ${place}º · meta ${meta}`;
  }
  const st = userCompStatus(save, g.comp);
  return st === "in" ? "En carrera" : "Pendiente";
}

/** Cierra los objetivos que ya se resolvieron. apply=false solo actualiza estados (partidas viejas). */
function settleGoals(save: GameSave, b: BoardState, final: boolean, apply: boolean): Part[] {
  const parts: Part[] = [];
  for (const g of b.goals) {
    if (g.state !== "open") continue;
    const r = evalGoal(save, g, final);
    if (r === "open") continue;
    g.state = r;
    if (!apply) continue;
    const delta = r === "met" ? 3 + 2 * g.weight : -(3 + 3 * g.weight);
    parts.push({
      delta,
      text: r === "met" ? `Objetivo cumplido: ${g.label}` : `Objetivo incumplido: ${g.label}`,
    });
    save.news.unshift({
      id: uid("n"),
      week: save.week,
      tone: r === "met" ? "good" : "bad",
      title: r === "met" ? "La dirigencia celebra un objetivo" : "Objetivo incumplido",
      body: g.label,
    });
  }
  return parts;
}

/* ------------------------------------------------------------------ */
/* Estado inicial                                                      */
/* ------------------------------------------------------------------ */

export function createBoard(save: GameSave): BoardState {
  const start = Math.round(70 + hash01(`${save.seed}:${save.clubId}:${save.season}:board`) * 10);
  const board: BoardState = {
    season: save.season,
    confidence: start,
    start,
    goals: generateGoals(save),
    lossStreak: 0,
    winlessStreak: 0,
    warned: 0,
    ultimatum: 0,
    sacked: null,
    closed: false,
    log: [],
    last: null,
    classicPts: 0,
  };
  // Si la partida ya venía avanzada, los objetivos ya resueltos quedan marcados sin tocar la confianza.
  settleGoals(save, board, false, false);
  return board;
}

/** Tablero de la nueva temporada: la confianza arrastra a medias y los objetivos se fijan de nuevo. */
export function nextBoard(next: GameSave, prev: BoardState | null): BoardState {
  const fresh = createBoard(next);
  if (prev) {
    const blended = Math.round(clamp(prev.confidence * 0.5 + fresh.start * 0.5, 0, 100));
    fresh.confidence = blended;
    fresh.start = blended;
  }
  return fresh;
}

export function normalizeBoard(raw: unknown): BoardState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<BoardState>;
  if (!Array.isArray(r.goals) || typeof r.confidence !== "number") return null;
  const warned = (r.warned === 1 || r.warned === 2 || r.warned === 3 ? r.warned : 0) as 0 | 1 | 2 | 3;
  const sacked =
    r.sacked && typeof r.sacked === "object" && Array.isArray(r.sacked.offers)
      ? {
          season: r.sacked.season ?? 0,
          week: r.sacked.week ?? 0,
          reason: String(r.sacked.reason ?? ""),
          offers: r.sacked.offers,
        }
      : null;
  return {
    season: typeof r.season === "number" ? r.season : 0,
    confidence: clamp(r.confidence, 0, 100),
    start: typeof r.start === "number" ? r.start : r.confidence,
    goals: r.goals.filter((g) => g && typeof g.label === "string"),
    lossStreak: r.lossStreak ?? 0,
    winlessStreak: r.winlessStreak ?? 0,
    warned,
    // Partidas viejas que ya estaban en la zona de peligro reciben un plazo corto, no un despido inmediato.
    ultimatum: typeof r.ultimatum === "number" ? Math.max(0, r.ultimatum) : warned === 3 ? 2 : 0,
    sacked,
    closed: Boolean(r.closed),
    log: Array.isArray(r.log) ? r.log.slice(0, LOG_LIMIT) : [],
    last: r.last ?? null,
    classicPts: typeof r.classicPts === "number" ? Math.max(0, r.classicPts) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Partidos                                                            */
/* ------------------------------------------------------------------ */

function isKnockout(f: Fixture): boolean {
  if (isDomesticCompetition(f.competition)) return false;
  if (hasGroups(f.competition)) return f.round > 6;
  return true;
}

function importance(save: GameSave, f: Fixture, oppId: string): { mult: number; tag: string | null } {
  const lg = clubById(save.clubId).league;
  if (isDomesticCompetition(f.competition)) {
    const table = sortTable(save.standings);
    const mine = table.findIndex((r) => r.clubId === save.clubId);
    const theirs = table.findIndex((r) => r.clubId === oppId);
    const played = table[mine]?.played ?? 0;
    if (mine >= 0 && theirs >= 0 && played >= 6 && Math.abs(mine - theirs) <= 3) {
      return { mult: 1.25, tag: "un partido clave" };
    }
    return { mult: 1, tag: null };
  }
  const minor = f.competition === "supercoppa" || f.competition === "trofeo" || f.competition === "mundial";
  const final = finalRoundOf(f.competition, lg);
  if (final !== null && f.round === final) return { mult: minor ? 1.5 : 2, tag: "una final" };
  if (!minor && final !== null && f.round === final - 1 && isKnockout(f)) {
    return { mult: 1.6, tag: "una semifinal" };
  }
  if (isKnockout(f)) return { mult: minor ? 1.2 : 1.3, tag: "un cruce de eliminación" };
  return { mult: 1, tag: null };
}

function pushLog(b: BoardState, save: GameSave, delta: number, text: string) {
  const entry: BoardLogEntry = { id: uid("bl"), season: save.season, week: save.week, delta: round1(delta), text };
  b.log = [entry, ...b.log].slice(0, LOG_LIMIT);
}

function level(conf: number): 0 | 1 | 2 | 3 {
  if (conf <= WARN_AT[2]) return 3;
  if (conf <= WARN_AT[1]) return 2;
  if (conf <= WARN_AT[0]) return 1;
  return 0;
}

function warnIfNeeded(save: GameSave, b: BoardState) {
  const cur = level(b.confidence);
  if (cur > b.warned) {
    b.warned = cur;
    const shown = Math.round(b.confidence);
    const copies: Record<1 | 2 | 3, { title: string; body: string }> = {
      1: {
        title: "La dirigencia se impacienta",
        body: `La confianza bajó a ${shown}/100. En los pasillos del club ya se habla del rendimiento del equipo. Hace falta una reacción.`,
      },
      2: {
        title: "Dirigencia en crisis",
        body: `Con ${shown}/100 de confianza, la comisión directiva pidió una reunión de urgencia para pedirte explicaciones por los resultados.`,
      },
      3: {
        title: "Reunión de emergencia",
        body: `La confianza cayó a ${shown}/100. La comisión directiva se reunió de urgencia y te dio un ultimátum: tenés los próximos ${ULTIMATUM_GAMES} partidos para reaccionar. Si el rendimiento no mejora, tu continuidad en el club corre riesgo.`,
      },
    };
    if (cur === 3) b.ultimatum = ULTIMATUM_GAMES;
    const copy = copies[cur as 1 | 2 | 3];
    save.popups.push({ id: uid("pop"), kind: "info", tone: "bad", title: copy.title, body: copy.body });
    save.news.unshift({ id: uid("n"), week: save.week, tone: "bad", title: copy.title, body: copy.body });
  } else if (cur < b.warned && b.confidence >= WARN_AT[b.warned - 1]! + 8) {
    // Recuperó terreno: el aviso se relaja y podría volver a saltar si cae de nuevo.
    b.warned = cur;
    if (cur < 3) b.ultimatum = 0;
  }
}

/**
 * Cambia la confianza de la dirigencia por algo ajeno a un partido (un suceso inesperado).
 * Queda en el historial y puede disparar los avisos normales, pero nunca despide por sí solo:
 * el despido se evalúa únicamente después de los partidos. Devuelve el cambio real (con tope 0-100).
 */
export function adjustBoardConfidence(save: GameSave, delta: number, text: string): number {
  const b = save.board;
  if (!b || b.closed || b.sacked || !Number.isFinite(delta) || delta === 0) return 0;
  const before = b.confidence;
  b.confidence = round1(clamp(before + delta, 0, 100));
  const actual = round1(b.confidence - before);
  if (actual !== 0) {
    pushLog(b, save, actual, text);
    warnIfNeeded(save, b);
  }
  return actual;
}

/* ------------------------------------------------------------------ */
/* Despido                                                             */
/* ------------------------------------------------------------------ */

function leagueProgress(save: GameSave): number {
  const row = save.standings.find((r) => r.clubId === save.clubId);
  const total = Math.max(1, (save.standings.length - 1) * 2);
  return row ? row.played / total : 0;
}

function inRelegationZone(save: GameSave): boolean {
  const pl = playableLeague(clubById(save.clubId).league);
  const bottom = QUAL_SPOTS[pl].releg || 0;
  return bottom > 0 && leaguePlaceNow(save) > save.standings.length - bottom;
}

/** ¿Tiene el equipo un cruce decisivo por delante (semifinal / final)? Eso frena a la dirigencia. */
function deepCupRun(save: GameSave): boolean {
  return save.fixtures.some((f) => {
    if (f.played || (f.homeId !== save.clubId && f.awayId !== save.clubId)) return false;
    if (isDomesticCompetition(f.competition) || !isKnockout(f)) return false;
    const oppId = f.homeId === save.clubId ? f.awayId : f.homeId;
    return importance(save, f, oppId).mult >= 1.6;
  });
}

/**
 * Qué tan insostenible es la situación del manager (0-100). No es solo la confianza: cuenta la tabla frente
 * al objetivo, el descenso, las rachas, los objetivos fallados, el peso del club y qué tan reciente es su llegada.
 * Con lo que protege (títulos, un cruce decisivo, un cargo recién empezado) puede quedar en 0 aun con confianza baja.
 */
export function sackRisk(save: GameSave, b: BoardState, lastWon = false): number {
  const club = clubById(save.clubId);
  const progress = leagueProgress(save);
  let risk = 15 + Math.max(0, SACK_AT - b.confidence) * 1.8;

  if (b.lossStreak >= 3) risk += 10;
  if (b.winlessStreak >= 5) risk += 6;

  if (progress >= 0.3) {
    const goal = b.goals.find((g) => g.kind === "league");
    if (goal && goal.state !== "met") {
      const gap = leaguePlaceNow(save) - goal.target;
      if (gap > 0) risk += Math.min(18, gap * 3);
    }
    if (inRelegationZone(save)) risk += 15;
  }

  risk += b.goals.filter((g) => g.state === "failed").length * 4;
  risk += club.prestige >= 85 ? 4 : club.prestige <= 60 ? -6 : 0;

  // Lo que protege al manager.
  if (progress < 0.25) risk -= 15;
  if (save.careerTrophies.some((t) => t.season === save.season)) risk -= 15;
  if (deepCupRun(save)) risk -= 10;
  if (lastWon) risk -= 6;

  return Math.round(clamp(risk, 0, 100));
}

function sackReason(save: GameSave, b: BoardState): string {
  const place = leaguePlaceNow(save);
  const total = save.standings.length;
  const bits: string[] = [];
  if (inRelegationZone(save)) bits.push(`el equipo está ${place}º, en zona de descenso`);
  else {
    const goal = b.goals.find((g) => g.kind === "league");
    if (goal && place > goal.target) bits.push(`el equipo está ${place}º de ${total} y el objetivo era ${goal.target === 1 ? "salir campeón" : `terminar ${goal.target}º o mejor`}`);
  }
  if (b.lossStreak >= 3) bits.push(`${b.lossStreak} derrotas seguidas`);
  else if (b.winlessStreak >= 5) bits.push(`${b.winlessStreak} partidos sin ganar`);
  const failed = b.goals.filter((g) => g.state === "failed").length;
  if (failed) bits.push(`${failed} ${failed === 1 ? "objetivo incumplido" : "objetivos incumplidos"}`);
  const why = bits.length ? bits.join(", ") : "los resultados no acompañaron";
  return `La dirigencia perdió la confianza en tu trabajo: ${why}.`;
}

function sackManager(save: GameSave, b: BoardState) {
  const club = clubById(save.clubId);
  const reason = sackReason(save, b);
  // Un DT recién echado llama menos la atención de los grandes: las ofertas bajan de nivel.
  const offers = managerOffers(save, 3, -10).map((o) => ({ clubId: o.clubId, budget: o.budget, objective: o.objective }));
  b.sacked = { season: save.season, week: save.week, reason, offers };
  save.news.unshift({
    id: uid("n"),
    week: save.week,
    tone: "bad",
    title: `${club.name} despide al manager`,
    body: reason,
  });
  pushLog(b, save, 0, "La dirigencia decidió despedirte");
}

/**
 * Evalúa si la dirigencia echa al manager. Solo se plantea con la confianza en zona crítica y una vez que
 * pasó el plazo de la reunión de emergencia; incluso así depende de la situación del club (sackRisk) y de
 * una tirada determinista, por lo que llegar a ese número no garantiza el despido.
 */
function maybeSack(save: GameSave, b: BoardState, fixtureId: string, lastWon: boolean) {
  if (b.sacked || b.confidence > SACK_AT) return;
  // Durante el plazo del ultimátum no hay despido, salvo un derrumbe total.
  if (b.ultimatum > 0 && b.confidence > 8) return;
  const risk = sackRisk(save, b, lastWon);
  const p = clamp((risk - 22) / 110, 0, 0.45);
  if (p <= 0) return;
  if (hash01(`${save.seed}:${save.season}:${save.week}:${fixtureId}:sack`) < p) sackManager(save, b);
}

/**
 * Efecto de un partido del usuario sobre la confianza: resultado según la categoría del rival,
 * peso del partido (finales, eliminatorias, rivales directos), rachas y objetivos que se resuelven.
 * Se llama justo después de cargar el resultado en el mundo (fixture.played ya es true).
 */
export function applyBoardMatch(save: GameSave, fixture: Fixture, userGoals: number, oppGoals: number) {
  const b = save.board;
  if (!b || b.closed || b.sacked) return;
  const me = clubById(save.clubId);
  const oppId = fixture.homeId === save.clubId ? fixture.awayId : fixture.homeId;
  const opp = clubById(oppId);
  const diff = opp.prestige - me.prestige;
  const imp = importance(save, fixture, oppId);

  let res: "W" | "D" | "L" = userGoals > oppGoals ? "W" : userGoals === oppGoals ? "D" : "L";
  // En las eliminatorias manda quién pasa, no el marcador del partido.
  if (isKnockout(fixture) && (!fixture.tieId || fixture.leg === 2)) {
    const w = fixture.tieId ? tieWinner(save, fixture.tieId) : resolveDrawWinner(fixture, save.seed);
    if (w) res = w === save.clubId ? "W" : "L";
  }

  const parts: Part[] = [];
  const tag = imp.tag ? ` (${imp.tag})` : "";
  if (res === "W") {
    const d = (0.9 + clamp(diff * 0.06, -0.4, 1)) * (1 + (imp.mult - 1) * 0.7);
    parts.push({ delta: d, text: (diff >= 8 ? "Victoria ante un rival de mayor jerarquía" : "Victoria") + tag });
  } else if (res === "D") {
    const d = clamp(-0.2 + diff * 0.05, -0.8, 0.4);
    parts.push({ delta: d, text: (diff <= -8 ? "Empate ante un rival inferior" : "Empate") + tag });
  } else {
    const d = -(1.4 + clamp(-diff * 0.07, -0.8, 2)) * imp.mult;
    parts.push({ delta: d, text: (diff <= -8 ? "Derrota ante un rival inferior" : "Derrota") + tag });
  }

  // Clásicos y derbis: ganarlos da un extra según su categoría y la importancia del partido, con tope por temporada.
  if (res === "W" && (!isKnockout(fixture) || !fixture.tieId || fixture.leg === 2)) {
    const classic = classicBetween(save.clubId, oppId);
    const left = CLASSIC_SEASON_CAP - (b.classicPts ?? 0);
    if (classic && left > 0.05) {
      const base = classic.tier === 2 ? 1.4 : 0.8;
      const bonus = round1(Math.min(left, base * Math.min(imp.mult, 1.5)));
      if (bonus > 0) {
        b.classicPts = round1((b.classicPts ?? 0) + bonus);
        parts.push({ delta: bonus, text: `Ganaste el ${classic.name}` });
      }
    }
  }

  // Rachas.
  if (res === "W") {
    if (b.winlessStreak >= 4) parts.push({ delta: 1.5, text: "Cortaste la mala racha" });
    b.lossStreak = 0;
    b.winlessStreak = 0;
  } else {
    b.winlessStreak += 1;
    b.lossStreak = res === "L" ? b.lossStreak + 1 : 0;
    // Castigo acotado por partido: una racha larga duele, pero no hunde la barra de un golpe.
    const lossPen = b.lossStreak >= 3 ? -1.2 : b.lossStreak === 2 ? -0.6 : 0;
    const winlessPen = b.winlessStreak >= 6 ? -0.5 : 0;
    if (lossPen < 0 && lossPen <= winlessPen) {
      parts.push({ delta: lossPen, text: `Mala racha: ${b.lossStreak} derrotas seguidas` });
    } else if (winlessPen < 0) {
      parts.push({ delta: winlessPen, text: `Mala racha: ${b.winlessStreak} partidos sin ganar` });
    }
  }

  // Objetivo de liga que se va escapando (recién a partir del 30 % del campeonato).
  if (isDomesticCompetition(fixture.competition)) {
    const goal = b.goals.find((g) => g.kind === "league" && g.state === "open");
    const row = save.standings.find((r) => r.clubId === save.clubId);
    const total = Math.max(1, (save.standings.length - 1) * 2);
    if (goal && row && row.played / total >= 0.3) {
      const place = leaguePlaceNow(save);
      const gap = place - goal.target;
      if (gap > 0) {
        parts.push({
          delta: -Math.min(0.9, 0.09 * gap),
          text: `Vas ${place}º y el objetivo es ${goal.target === 1 ? "ser campeón" : `terminar ${goal.target}º o mejor`}`,
        });
      }
    }
  }

  // Objetivos de copa que ya se definieron con este partido.
  parts.push(...settleGoals(save, b, false, true));

  const before = b.confidence;
  b.confidence = round1(clamp(before + parts.reduce((s, p) => s + p.delta, 0), 0, 100));
  const actual = round1(b.confidence - before);
  b.last = {
    delta: actual,
    lines: parts.map((p) => `${p.text} (${fmtDelta(p.delta)})`),
    confidence: Math.round(b.confidence),
  };
  pushLog(b, save, actual, `vs ${opp.short}: ${parts.map((p) => p.text).join(" · ")}`);
  // El plazo del ultimátum corre con cada partido jugado.
  if (b.ultimatum > 0) b.ultimatum -= 1;
  warnIfNeeded(save, b);
  maybeSack(save, b, fixture.id, res === "W");
}

/** Balance de fin de temporada: se resuelven los objetivos que faltaban y la dirigencia da su veredicto. */
export function closeBoardSeason(save: GameSave) {
  const b = save.board;
  if (!b || b.closed) return;
  if (b.sacked) {
    // Ya lo echaron en plena temporada: no hay balance, solo se cierra el libro.
    b.closed = true;
    return;
  }
  const parts = settleGoals(save, b, true, true);
  const before = b.confidence;
  b.confidence = round1(clamp(before + parts.reduce((s, p) => s + p.delta, 0), 0, 100));
  b.closed = true;
  const met = b.goals.filter((g) => g.state === "met").length;
  const total = b.goals.length;
  const delta = round1(b.confidence - before);
  b.last = {
    delta,
    lines: parts.map((p) => `${p.text} (${fmtDelta(p.delta)})`),
    confidence: Math.round(b.confidence),
  };
  if (parts.length) pushLog(b, save, delta, `Cierre de temporada: ${met}/${total} objetivos cumplidos`);
  warnIfNeeded(save, b);

  // Balance final: con la confianza por el piso y una temporada mala, la dirigencia puede no renovarte.
  if (b.confidence <= SACK_AT) {
    const risk = sackRisk(save, b);
    const p = clamp((risk - 10) / 80, 0, 0.75);
    if (p > 0 && hash01(`${save.seed}:${save.season}:end:sack`) < p) sackManager(save, b);
  }

  const c = Math.round(b.confidence);
  const verdict =
    c >= 85
      ? "La dirigencia está encantada con tu trabajo y te renueva todo su respaldo."
      : c >= 70
        ? "La dirigencia está conforme con la temporada."
        : c >= 55
          ? "La dirigencia tiene dudas: esperaba más de este equipo."
          : c >= 40
            ? "La dirigencia está impaciente y pide un cambio de rumbo."
            : "La dirigencia está muy disconforme con lo hecho esta temporada.";
  save.news.unshift({
    id: uid("n"),
    week: save.week,
    tone: c >= 70 ? "good" : c >= 55 ? "neutral" : "bad",
    title: `Balance de la dirigencia: ${met}/${total} objetivos`,
    body: `${verdict} Confianza: ${c}/100.`,
  });
}
