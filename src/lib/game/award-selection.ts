import { ensureSeasonAwards, findAward, setAwardResult, type AwardKind, type AwardNominee } from "./awards";
import { CLUBS, clubById, playableLeague } from "./clubs";
import { Rng } from "./rng";
import type { ClubId, GameSave, Player, PlayableLeagueId, Pos, Standing } from "./types";
import { sortTable } from "./world";

// ---------------------------------------------------------------------------
// Nominados y ganadores de los premios individuales, al cierre de la temporada.
//
// Todo sale de lo que pasó en la temporada: goles, asistencias y partidos de cada jugador, la
// tabla final de su liga, los títulos de su club y (para el DT) los objetivos de la dirigencia.
// El GRL pesa muy poco: un jugador con menos media pero mejores números y mejor temporada
// de equipo puede ganar. El ganador no es siempre el primero de la lista: se sortea entre los
// nominados con más chances para el que tuvo la mejor temporada (salvo la Bota de Oro, que es
// puramente de goles). Todo es determinista: depende de la semilla de la partida y la temporada.
//
// Datos que el juego NO registra todavía (se estiman a partir de los reales, sin tocar el simulador):
//  - Porterías a cero de cada arquero → se estiman con los goles en contra de su equipo en la liga.
//  - Calidad de cada gol (Puskás) → se estima por la técnica del goleador y un sorteo por gol.
// ---------------------------------------------------------------------------

const NOMINEES: Record<AwardKind, number> = {
  balon_oro: 10,
  bota_oro: 5,
  puskas: 5,
  guante_oro: 5,
  dt_anio: 5,
  kopa: 5,
};

/** Edad máxima para el Trofeo Kopa. */
export const KOPA_MAX_AGE = 21;

/** Peso de cada liga (fuerza competitiva): sus goles y títulos valen más o menos. */
const LEAGUE_WEIGHT: Record<PlayableLeagueId, number> = {
  premier: 1,
  laliga: 1,
  serieA: 0.95,
  bundesliga: 0.9,
  ligue1: 0.8,
  argentina: 0.65,
};

/** Importancia de cada título de la temporada para el Balón de Oro. */
const TITLE_POINTS = { league: 3, coppa: 1, ucl: 6, libertadores: 4, uel: 2, uecl: 1.2, sudamericana: 1.5 } as const;
/** Importancia de cada título para el DT del Año (en puntos de su puntaje). */
const DT_TITLE_POINTS = { league: 12, coppa: 5, ucl: 18, libertadores: 15, uel: 8, uecl: 5, sudamericana: 6 } as const;

interface ClubContext {
  clubId: ClubId;
  league: PlayableLeagueId;
  /** Puesto final en la liga (1 = campeón). 0 si no hay tabla. */
  place: number;
  size: number;
  played: number;
  pts: number;
  won: number;
  gf: number;
  ga: number;
  /** Goles en contra por partido de la liga. */
  gaPerGame: number;
  /** Promedio de goles en contra por partido de toda su liga. */
  leagueGaPerGame: number;
  titles: Array<keyof typeof TITLE_POINTS>;
}

interface Scored<T> {
  item: T;
  score: number;
  detail: string;
}

// ── Contexto del mundo ──────────────────────────────────────────────────────

function buildContexts(save: GameSave): Map<ClubId, ClubContext> {
  const out = new Map<ClubId, ClubContext>();
  const leagues = Object.keys(LEAGUE_WEIGHT) as PlayableLeagueId[];
  const leagueChampion = new Map<PlayableLeagueId, ClubId>();

  for (const league of leagues) {
    const rows: Standing[] = save.leagueTables?.[league] ?? [];
    if (!rows.length || !rows.some((r) => r.played > 0)) continue;
    const table = sortTable(rows);
    const totalGa = table.reduce((s, r) => s + r.ga, 0);
    const totalPlayed = table.reduce((s, r) => s + r.played, 0);
    const leagueGaPerGame = totalPlayed > 0 ? totalGa / totalPlayed : 1.3;
    if (table[0]) leagueChampion.set(league, table[0].clubId);
    table.forEach((r, i) => {
      out.set(r.clubId, {
        clubId: r.clubId,
        league,
        place: i + 1,
        size: table.length,
        played: r.played,
        pts: r.pts,
        won: r.won,
        gf: r.gf,
        ga: r.ga,
        gaPerGame: r.played > 0 ? r.ga / r.played : leagueGaPerGame,
        leagueGaPerGame,
        titles: [],
      });
    });
  }

  const give = (clubId: ClubId | null | undefined, title: ClubContext["titles"][number]) => {
    if (!clubId) return;
    out.get(clubId)?.titles.push(title);
  };
  for (const champ of leagueChampion.values()) give(champ, "league");
  const lc = save.lastChampions;
  if (lc) {
    give(lc.ucl, "ucl");
    give(lc.uel, "uel");
    give(lc.uecl, "uecl");
    give(lc.libertadores, "libertadores");
    give(lc.sudamericana, "sudamericana");
    give(lc.coppa, "coppa");
  }
  return out;
}

function titlePoints(ctx: ClubContext | undefined): number {
  if (!ctx) return 0;
  return ctx.titles.reduce((s, t) => s + TITLE_POINTS[t] * (t === "league" ? LEAGUE_WEIGHT[ctx.league] : 1), 0);
}

/** 1 = campeón, 0 = último. */
function placeScore(ctx: ClubContext | undefined): number {
  if (!ctx || ctx.size < 2 || ctx.place < 1) return 0.5;
  return (ctx.size - ctx.place) / (ctx.size - 1);
}

// ── Jugadores ───────────────────────────────────────────────────────────────

function eligiblePlayers(save: GameSave): Player[] {
  return save.players.filter((p) => !clubById(p.clubId).ghost && p.apps > 0);
}

/** Cuánto vale un gol según la posición (a un defensor le cuesta más marcar). */
const GOAL_WEIGHT: Record<Pos, number> = {
  GK: 0,
  CB: 2.2,
  LB: 1.8,
  RB: 1.8,
  CDM: 1.8,
  CM: 1.5,
  CAM: 1.2,
  LW: 1.05,
  RW: 1.05,
  ST: 1,
};

function goalWeight(pos: Pos): number {
  return GOAL_WEIGHT[pos] ?? 1.5;
}


function leagueWeightOf(clubId: ClubId, ctxs: Map<ClubId, ClubContext>): number {
  const ctx = ctxs.get(clubId);
  return ctx ? LEAGUE_WEIGHT[ctx.league] : 0.7;
}

/** Cuánto aportó con goles, asistencias y (en defensa) la solidez del equipo. */
function production(p: Player, ctxs: Map<ClubId, ClubContext>): number {
  const ctx = ctxs.get(p.clubId);
  const lw = leagueWeightOf(p.clubId, ctxs);
  if (p.pos === "GK") return estimateCleanSheets(p, ctx, null) * 1.0 * (0.8 + 0.2 * lw);
  const assistW = p.pos === "CM" || p.pos === "CAM" || p.pos === "LW" || p.pos === "RW" ? 0.75 : 0.6;
  let out = p.goals * goalWeight(p.pos) + p.assists * assistW;
  if ((p.pos === "CB" || p.pos === "CDM" || p.pos === "LB" || p.pos === "RB") && ctx) {
    // Los defensas también suman por lo poco que recibió su equipo.
    const saved = Math.max(0, ctx.leagueGaPerGame - ctx.gaPerGame);
    out += saved * p.apps * 0.7;
  }
  return out * (0.8 + 0.2 * lw);
}

/** Forma y evolución durante la temporada; pesan poco a propósito. */
function minorBonus(p: Player): number {
  const growth = Math.max(-3, Math.min(6, p.ovr - (p.seasonStartOvr || p.ovr)));
  return (p.ovr - 70) * 0.1 + growth * 0.25 + Math.max(-5, Math.min(5, p.form)) * 0.3;
}

function rngFor(save: GameSave, kind: AwardKind, salt = 0) {
  let h = 17;
  for (let i = 0; i < kind.length; i++) h = (h * 31 + kind.charCodeAt(i)) >>> 0;
  return new Rng((save.seed + save.season * 7919 + h + salt * 104729) >>> 0);
}

/** Estimación de porterías a cero: cada partido del arquero tiene la chance (Poisson) de no recibir gol según su equipo. */
function estimateCleanSheets(p: Player, ctx: ClubContext | undefined, rng: Rng | null): number {
  const rate = Math.exp(-(ctx?.gaPerGame ?? 1.3));
  if (!rng) return p.apps * rate;
  let n = 0;
  for (let i = 0; i < p.apps; i++) if (rng.chance(rate)) n++;
  return n;
}

function minApps(players: Player[], ratio: number, floor: number): number {
  const max = players.reduce((m, p) => Math.max(m, p.apps), 0);
  return Math.max(floor, Math.round(max * ratio));
}

function topN<T>(list: Array<Scored<T>>, n: number, tie: (t: T) => string): Array<Scored<T>> {
  return [...list].sort((a, b) => b.score - a.score || tie(a.item).localeCompare(tie(b.item))).slice(0, n);
}

/**
 * Elige al ganador entre los nominados (ya ordenados de mayor a menor puntaje).
 * Cada uno tiene chances según su distancia al primero: el favorito gana seguido, pero no siempre.
 */
function drawWinner<T>(nominees: Array<Scored<T>>, rng: Rng): Scored<T> | null {
  if (!nominees.length) return null;
  const top = nominees[0]!.score;
  const scale = Math.max(1, Math.abs(top) * 0.06);
  const weights = nominees.map((n) => Math.exp(-(top - n.score) / scale));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng.float() * total;
  for (let i = 0; i < nominees.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return nominees[i]!;
  }
  return nominees[nominees.length - 1]!;
}

function nomineeOf(p: Player, detail: string): AwardNominee {
  return { id: p.id, name: p.name, clubId: p.clubId, detail };
}

function statLine(p: Player): string {
  return `${p.goals} goles · ${p.assists} asist. · ${p.apps} partidos`;
}

// ── Cada premio ─────────────────────────────────────────────────────────────

interface Result {
  nominees: AwardNominee[];
  winner: AwardNominee | null;
}

function pickFrom<T>(scored: Array<Scored<T>>, n: number, tie: (t: T) => string, toNominee: (s: Scored<T>) => AwardNominee, rng: Rng, deterministic = false): Result {
  const nominees = topN(scored, n, tie);
  const w = deterministic ? (nominees[0] ?? null) : drawWinner(nominees, rng);
  return { nominees: nominees.map(toNominee), winner: w ? toNominee(w) : null };
}

function balonDeOro(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const all = eligiblePlayers(save);
  const need = minApps(all, 0.4, 8);
  const scored: Array<Scored<Player>> = all
    .filter((p) => p.apps >= need)
    .map((p) => {
      const ctx = ctxs.get(p.clubId);
      const availability = 0.75 + 0.25 * Math.min(1, p.apps / Math.max(1, need * 2));
      const score =
        production(p, ctxs) * availability +
        placeScore(ctx) * 3 +
        titlePoints(ctx) * 2.5 +
        minorBonus(p);
      return { item: p, score, detail: p.pos === "GK" ? `${p.apps} partidos` : statLine(p) };
    });
  const rng = rngFor(save, "balon_oro");
  // Un pequeño sorteo de "impacto en los grandes partidos" para que no sea una fórmula exacta.
  for (const s of scored) s.score += (rng.float() - 0.5) * 4;
  return pickFrom(scored, NOMINEES.balon_oro, (p) => p.id, (s) => nomineeOf(s.item, s.detail), rngFor(save, "balon_oro", 1));
}

function botaDeOro(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const all = eligiblePlayers(save).filter((p) => p.goals > 0 && p.pos !== "GK");
  // Como en la Bota real: los goles de las ligas más fuertes valen más.
  const scored: Array<Scored<Player>> = all.map((p) => {
    const coef = 0.75 + 0.25 * leagueWeightOf(p.clubId, ctxs);
    return { item: p, score: p.goals * coef - p.apps * 0.0001 + p.assists * 0.0002, detail: `${p.goals} goles · ${p.apps} partidos` };
  });
  return pickFrom(scored, NOMINEES.bota_oro, (p) => p.id, (s) => nomineeOf(s.item, s.detail), rngFor(save, "bota_oro"), true);
}

function puskas(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const rng = rngFor(save, "puskas");
  const scored: Array<Scored<Player>> = [];
  for (const p of eligiblePlayers(save)) {
    if (p.pos === "GK" || p.goals < 2) continue;
    // Técnica del goleador: tiro, regate y velocidad (los goles de lejos y en carrera salen de ahí).
    const tech = (p.attrs.sho * 0.4 + p.attrs.dri * 0.35 + p.attrs.pac * 0.25) / 100;
    const pSpectacular = Math.max(0.03, Math.min(0.22, 0.04 + (tech - 0.6) * 0.5));
    let best = 0;
    let spectacular = 0;
    for (let i = 0; i < Math.min(p.goals, 60); i++) {
      const q = 0.55 * rng.float() + 0.3 * tech + 0.15 * rng.float();
      if (q > best) best = q;
      if (rng.chance(pSpectacular)) spectacular++;
    }
    const lw = leagueWeightOf(p.clubId, ctxs);
    const score = (best * 70 + spectacular * 6 + Math.min(p.goals, 25) * 0.3) * (0.9 + 0.1 * lw);
    scored.push({ item: p, score, detail: `${spectacular} goles destacados · ${p.goals} goles` });
  }
  return pickFrom(scored, NOMINEES.puskas, (p) => p.id, (s) => nomineeOf(s.item, s.detail), rngFor(save, "puskas", 1));
}

function guanteDeOro(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const all = eligiblePlayers(save).filter((p) => p.pos === "GK");
  const need = minApps(all, 0.45, 8);
  const rng = rngFor(save, "guante_oro");
  const scored: Array<Scored<Player>> = all
    .filter((p) => p.apps >= need)
    .map((p) => {
      const ctx = ctxs.get(p.clubId);
      const cleanSheets = estimateCleanSheets(p, ctx, rng);
      const prevented = ctx ? Math.max(-0.6, ctx.leagueGaPerGame - ctx.gaPerGame) * p.apps * 0.5 : 0;
      const score =
        cleanSheets * 1.0 +
        prevented +
        p.apps * 0.1 +
        placeScore(ctx) * 2 +
        titlePoints(ctx) * 0.6 +
        minorBonus(p) * 0.6;
      return {
        item: p,
        score,
        detail: `${cleanSheets} porterías a cero (est.) · ${ctx ? `${ctx.ga} goles en contra en liga · ` : ""}${p.apps} partidos`,
      };
    });
  return pickFrom(scored, NOMINEES.guante_oro, (p) => p.id, (s) => nomineeOf(s.item, s.detail), rngFor(save, "guante_oro", 1));
}

function trofeoKopa(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const young = eligiblePlayers(save).filter((p) => p.age <= KOPA_MAX_AGE);
  const need = minApps(young, 0.5, 5);
  const rng = rngFor(save, "kopa");
  const scored: Array<Scored<Player>> = young
    .filter((p) => p.apps >= need)
    .map((p) => {
      const ctx = ctxs.get(p.clubId);
      const growth = Math.max(-2, Math.min(8, p.ovr - (p.seasonStartOvr || p.ovr)));
      const score =
        production(p, ctxs) +
        p.apps * 0.12 +
        growth * 0.8 +
        Math.max(0, p.pot - p.ovr) * 0.05 +
        placeScore(ctx) * 1.5 +
        titlePoints(ctx) * 0.8 +
        minorBonus(p) * 0.5 +
        (rng.float() - 0.5) * 2;
      return { item: p, score, detail: `${p.age} años · ${p.pos === "GK" ? `${p.apps} partidos` : statLine(p)}` };
    });
  return pickFrom(scored, NOMINEES.kopa, (p) => p.id, (s) => nomineeOf(s.item, s.detail), rngFor(save, "kopa", 1));
}

function dtDelAnio(save: GameSave, ctxs: Map<ClubId, ClubContext>): Result {
  const sacked = Boolean(save.board?.sacked);
  const byLeague = new Map<PlayableLeagueId, ClubId[]>();
  for (const c of CLUBS) {
    if (c.ghost) continue;
    const l = playableLeague(c.league);
    byLeague.set(l, [...(byLeague.get(l) ?? []), c.id]);
  }
  const scored: Array<Scored<ClubContext>> = [];
  for (const ctx of ctxs.values()) {
    if (ctx.played < 1 || clubById(ctx.clubId).ghost) continue;
    const isUser = ctx.clubId === save.clubId;
    if (isUser && sacked) continue; // el DT despedido no entra
    // Puesto esperado por el peso del club dentro de su liga.
    const rivals = (byLeague.get(ctx.league) ?? []).map(clubById).sort((a, b) => b.prestige - a.prestige);
    const expected = Math.max(1, rivals.findIndex((c) => c.id === ctx.clubId) + 1);
    const over = Math.max(-25, Math.min(25, (expected - ctx.place) * 2.2));
    const lw = LEAGUE_WEIGHT[ctx.league];
    const titles = ctx.titles.reduce((s, t) => s + DT_TITLE_POINTS[t] * (t === "league" ? lw : 1), 0);
    let objectives = 0;
    let objText = "";
    if (isUser && save.board?.goals.length) {
      const goals = save.board.goals;
      const total = goals.reduce((s, g) => s + g.weight, 0);
      const met = goals.filter((g) => g.state === "met").reduce((s, g) => s + g.weight, 0);
      objectives = total > 0 ? (met / total) * 10 - 3 : 0;
      objText = ` · objetivos ${goals.filter((g) => g.state === "met").length}/${goals.length}`;
    }
    const score =
      placeScore(ctx) * 20 * (0.85 + 0.15 * lw) +
      over +
      titles +
      (ctx.played > 0 ? (ctx.won / ctx.played) * 8 : 0) +
      objectives;
    scored.push({
      item: ctx,
      score,
      detail: `${ctx.place}.º en liga · ${ctx.pts} pts${ctx.titles.length ? ` · ${ctx.titles.length} título${ctx.titles.length > 1 ? "s" : ""}` : ""}${objText}`,
    });
  }
  const toNominee = (s: Scored<ClubContext>): AwardNominee => {
    const club = clubById(s.item.clubId);
    return {
      id: club.id,
      name: club.id === save.clubId ? `Tu DT (${club.name})` : `DT de ${club.name}`,
      clubId: club.id,
      detail: s.detail,
    };
  };
  return pickFrom(scored, NOMINEES.dt_anio, (c) => c.clubId, toNominee, rngFor(save, "dt_anio"));
}

// ── Punto de entrada ────────────────────────────────────────────────────────

/** Cómo se elige cada premio. */
const SELECTORS: Record<AwardKind, (save: GameSave, ctxs: Map<ClubId, ClubContext>) => Result> = {
  balon_oro: balonDeOro,
  bota_oro: botaDeOro,
  puskas: puskas,
  guante_oro: guanteDeOro,
  dt_anio: dtDelAnio,
  kopa: trofeoKopa,
};

/**
 * Selecciona nominados y ganador de los 6 premios de la temporada del save.
 * Se llama al cerrar la temporada. Es idempotente: un premio que ya tiene ganador no se vuelve a sortear.
 */
export function selectSeasonAwards(save: GameSave): void {
  ensureSeasonAwards(save);
  if (!save.players?.length) return;
  const ctxs = buildContexts(save);
  for (const kind of Object.keys(SELECTORS) as AwardKind[]) {
    const current = findAward(save.awards, save.season, kind);
    if (current?.winner) continue;
    const result = SELECTORS[kind](save, ctxs);
    save.awards = setAwardResult(save.awards, save.season, kind, result);
  }
}

