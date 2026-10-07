import { AWARD_DEFS, awardsOfSeason, type AwardKind, type AwardNominee, type SeasonAward } from "./awards";
import { clubById, leagueInfo, playableLeague } from "./clubs";
import { NAT_LABEL, POS_LABEL, seasonLabel } from "./format";
import type { ClubId, GameSave, Player } from "./types";
import { sortTable } from "./world";

// ---------------------------------------------------------------------------
// Ceremonia de premios: arma, a partir de los premios ya sorteados al cierre de la temporada,
// todo lo que la pantalla necesita mostrar (nominados, ranking y textos de cada uno).
//
// IMPORTANTE: este módulo es SOLO LECTURA. No toca `save.awards` ni ningún historial de premios;
// únicamente lee los resultados que ya calculó `award-selection.ts`.
// Todos los textos salen de datos reales del save (goles, asistencias, edad, club, tabla, títulos).
// No se inventa ningún dato que el juego no registre (por ejemplo, el minuto o el rival de un gol).
// ---------------------------------------------------------------------------

export interface CeremonyFact {
  label: string;
  value: string;
}

export interface CeremonyProfile {
  kind: "player" | "manager";
  /** Nombre a mostrar. */
  name: string;
  clubId: ClubId;
  clubName: string;
  /** Datos sueltos para la ficha (temporada, club, edad, nacionalidad, goles...). */
  facts: CeremonyFact[];
  /** Texto breve de presentación. */
  text: string;
  /** Logros importantes de la temporada (máx. 3). */
  achievements: string[];
}

export interface CeremonyEntry {
  /** Puesto en el ranking del premio (1 = ganador). */
  rank: number;
  nominee: AwardNominee;
  profile: CeremonyProfile;
}

export interface CeremonyAward {
  kind: AwardKind;
  name: string;
  description: string;
  season: number;
  /** Nominados en un orden neutro (alfabético), para mostrarlos sin revelar el ranking. */
  nominees: CeremonyEntry[];
  /** Ranking completo: el índice 0 es el ganador (1.º), el último es el puesto más bajo. */
  ranking: CeremonyEntry[];
}

// ── Utilidades ──────────────────────────────────────────────────────────────

export function ordinal(n: number): string {
  return `${n}.º`;
}

const CUP_LABEL = {
  coppa: "la copa nacional",
  ucl: "la Champions League",
  uel: "la Europa League",
  uecl: "la Conference League",
  libertadores: "la Copa Libertadores",
  sudamericana: "la Copa Sudamericana",
} as const;

type CupKey = keyof typeof CUP_LABEL;
const CUP_KEYS: CupKey[] = ["ucl", "libertadores", "uel", "uecl", "sudamericana", "coppa"];

/** "Serie A" → "la Serie A"; "La Liga" ya trae el artículo. */
function theLeague(title: string): string {
  return /^la\s/i.test(title) ? title : `la ${title}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

interface ClubSeason {
  clubId: ClubId;
  clubName: string;
  leagueTitle: string;
  place: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  leagueChampion: boolean;
  /** Nombres de las copas que ganó (ej. "la Champions League"). */
  cups: string[];
}

/** Lo que hizo un club en la temporada: puesto en su liga y copas ganadas. null si no hay tabla. */
function clubSeason(save: GameSave, clubId: ClubId): ClubSeason | null {
  const club = clubById(clubId);
  const league = playableLeague(club.league);
  const rows = save.leagueTables?.[league] ?? [];
  const table = rows.some((r) => r.played > 0) ? sortTable(rows) : [];
  const idx = table.findIndex((r) => r.clubId === clubId);
  const row = idx >= 0 ? table[idx]! : null;
  const lc = save.lastChampions;
  const cups = CUP_KEYS.filter((k) => lc?.[k] === clubId).map((k) => CUP_LABEL[k]);
  if (!row && !cups.length) return null;
  return {
    clubId,
    clubName: club.name,
    leagueTitle: leagueInfo(club.league).title,
    place: idx >= 0 ? idx + 1 : 0,
    played: row?.played ?? 0,
    won: row?.won ?? 0,
    drawn: row?.drawn ?? 0,
    lost: row?.lost ?? 0,
    gf: row?.gf ?? 0,
    ga: row?.ga ?? 0,
    pts: row?.pts ?? 0,
    leagueChampion: idx === 0,
    cups,
  };
}

/** Títulos del club en la temporada, ya redactados ("Scudetto"/liga + copas). */
function titleNames(cs: ClubSeason | null): string[] {
  if (!cs) return [];
  const out: string[] = [];
  if (cs.leagueChampion) out.push(theLeague(cs.leagueTitle));
  out.push(...cs.cups);
  return out;
}

function placeLine(cs: ClubSeason | null): string {
  if (!cs || !cs.place) return "";
  return `${cs.clubName} terminó ${ordinal(cs.place)} en ${theLeague(cs.leagueTitle)}`;
}

// ── Perfil de jugador ───────────────────────────────────────────────────────

function previousWins(save: GameSave, playerId: string, season: number): Array<{ name: string; season: number }> {
  return (save.awards ?? [])
    .filter((a) => a.season < season && a.winner?.id === playerId)
    .map((a) => ({ name: a.name, season: a.season }))
    .sort((a, b) => b.season - a.season);
}

/** Máximo de goles / asistencias entre los jugadores de la misma liga (para saber si lideró). */
function leagueLeaders(save: GameSave, p: Player) {
  const league = playableLeague(clubById(p.clubId).league);
  let maxGoals = 0;
  let maxAssists = 0;
  for (const q of save.players) {
    if (q.pos === "GK" && q.goals === 0) continue;
    if (playableLeague(clubById(q.clubId).league) !== league) continue;
    if (clubById(q.clubId).ghost) continue;
    maxGoals = Math.max(maxGoals, q.goals);
    maxAssists = Math.max(maxAssists, q.assists);
  }
  return { maxGoals, maxAssists };
}

function playerProfile(save: GameSave, kind: AwardKind, nominee: AwardNominee): CeremonyProfile {
  const p = save.players.find((x) => x.id === nominee.id);
  const club = clubById(nominee.clubId);
  const cs = clubSeason(save, nominee.clubId);
  const season = seasonLabel(save.season, club.league);

  // Sin el jugador en el save (no debería pasar): se usa solo lo que guardó el premio.
  if (!p) {
    return {
      kind: "player",
      name: nominee.name,
      clubId: nominee.clubId,
      clubName: club.name,
      facts: [
        { label: "Temporada", value: season },
        { label: "Club", value: club.name },
      ],
      text: nominee.detail ? `${nominee.name} (${club.name}): ${nominee.detail}.` : `${nominee.name} defendió a ${club.name}.`,
      achievements: [],
    };
  }

  const titles = titleNames(cs);
  const nat = NAT_LABEL[p.nat] ?? p.nat;
  const isGk = p.pos === "GK";

  const facts: CeremonyFact[] = [
    { label: "Temporada", value: season },
    { label: "Club", value: club.name },
    { label: "Edad", value: `${p.age} años` },
    { label: "Nacionalidad", value: nat },
    { label: "Posición", value: POS_LABEL[p.pos] },
  ];
  if (isGk) {
    facts.push({ label: "Partidos", value: String(p.apps) });
    if (cs && cs.played > 0) facts.push({ label: "Goles recibidos (equipo)", value: String(cs.ga) });
  } else {
    facts.push({ label: "Goles", value: String(p.goals) });
    facts.push({ label: "Asistencias", value: String(p.assists) });
    facts.push({ label: "Partidos", value: String(p.apps) });
  }
  facts.push({ label: "Títulos", value: titles.length ? String(titles.length) : "Ninguno" });

  // Texto breve de la temporada.
  const parts: string[] = [];
  if (isGk) {
    parts.push(`${p.name} (${p.age} años, ${nat}) atajó ${plural(p.apps, "partido", "partidos")} en ${club.name}.`);
    if (cs && cs.played > 0) {
      parts.push(`Su equipo recibió ${plural(cs.ga, "gol", "goles")} en ${plural(cs.played, "partido", "partidos")} de liga.`);
    }
  } else {
    parts.push(
      `${p.name} (${p.age} años, ${nat}) hizo ${plural(p.goals, "gol", "goles")} y ${plural(p.assists, "asistencia", "asistencias")} en ${plural(p.apps, "partido", "partidos")} con ${club.name}.`,
    );
  }
  if (kind === "puskas" && !isGk && p.goals > 0) {
    parts.push("Sus goles lo pusieron entre los candidatos al mejor gol de la temporada.");
  }
  if (titles.length) parts.push(`Con su club levantó ${joinList(titles)}.`);
  else if (cs && cs.place) parts.push(`${placeLine(cs)}.`);

  // Logros importantes (los más relevantes primero, máximo 3).
  const ach: string[] = [];
  const wins = previousWins(save, p.id, save.season);
  if (wins.length) {
    const first = wins[0]!;
    ach.push(
      wins.length === 1
        ? `Ya ganó el ${first.name} en ${seasonLabel(first.season, club.league)}`
        : `${wins.length} premios individuales en temporadas anteriores`,
    );
  }
  if (!isGk) {
    const { maxGoals, maxAssists } = leagueLeaders(save, p);
    if (p.goals > 0 && p.goals === maxGoals) ach.push(`Máximo goleador de ${theLeague(leagueInfo(club.league).title)}`);
    else if (p.assists > 0 && p.assists === maxAssists && kind !== "bota_oro") {
      ach.push(`Máximo asistidor de ${theLeague(leagueInfo(club.league).title)}`);
    }
  }
  if (cs?.leagueChampion) ach.push(`Campeón de ${theLeague(cs.leagueTitle)}`);
  for (const cup of cs?.cups ?? []) ach.push(`Campeón de ${cup}`);
  const growth = p.ovr - (p.seasonStartOvr || p.ovr);
  if (growth >= 2) ach.push(`Subió ${growth} puntos de media en la temporada`);
  const careerGoals = (p.careerGoals ?? 0) + p.goals;
  if (!isGk && careerGoals >= 50) ach.push(`${careerGoals} goles en su carrera`);
  if (kind === "kopa" && p.age <= 21) ach.push(`Solo ${p.age} años`);

  return {
    kind: "player",
    name: p.name,
    clubId: nominee.clubId,
    clubName: club.name,
    facts,
    text: parts.join(" "),
    achievements: ach.slice(0, 3),
  };
}

// ── Perfil de DT ────────────────────────────────────────────────────────────

function managerProfile(save: GameSave, nominee: AwardNominee): CeremonyProfile {
  const club = clubById(nominee.clubId);
  const cs = clubSeason(save, nominee.clubId);
  const season = seasonLabel(save.season, club.league);
  const titles = titleNames(cs);
  const isUser = nominee.clubId === save.clubId;

  const facts: CeremonyFact[] = [
    { label: "Temporada", value: season },
    { label: "Club", value: club.name },
  ];
  if (cs && cs.place) {
    facts.push({ label: "Posición final", value: `${ordinal(cs.place)} en ${theLeague(cs.leagueTitle)}` });
    facts.push({ label: "Puntos", value: String(cs.pts) });
    facts.push({ label: "Balance", value: `${cs.won}G · ${cs.drawn}E · ${cs.lost}P` });
    facts.push({ label: "Goles", value: `${cs.gf} a favor · ${cs.ga} en contra` });
  }
  facts.push({ label: "Títulos", value: titles.length ? String(titles.length) : "Ninguno" });

  const parts: string[] = [];
  if (cs && cs.place) {
    parts.push(
      `${isUser ? "Tu equipo" : `El DT de ${club.name}`} cerró la temporada ${season} en el ${ordinal(cs.place)} puesto de ${theLeague(cs.leagueTitle)}, con ${plural(cs.pts, "punto", "puntos")} (${cs.won} victorias, ${cs.drawn} empates, ${cs.lost} derrotas).`,
    );
  } else {
    parts.push(`${isUser ? "Tu equipo" : `El DT de ${club.name}`} completó la temporada ${season}.`);
  }
  if (titles.length) parts.push(`Ganó ${joinList(titles)}.`);

  const ach: string[] = [];
  if (cs?.leagueChampion) ach.push(`Campeón de ${theLeague(cs.leagueTitle)}`);
  for (const cup of cs?.cups ?? []) ach.push(`Campeón de ${cup}`);
  if (isUser && save.board?.goals.length) {
    const met = save.board.goals.filter((g) => g.state === "met").length;
    ach.push(`Objetivos de la dirigencia cumplidos: ${met} de ${save.board.goals.length}`);
  }
  const prev = (save.awards ?? []).filter((a) => a.season < save.season && a.kind === "dt_anio" && a.winner?.id === nominee.id);
  if (prev.length) ach.push(`${plural(prev.length, "vez", "veces")} DT del Año con este club`);

  return {
    kind: "manager",
    name: nominee.name,
    clubId: nominee.clubId,
    clubName: club.name,
    facts,
    text: parts.join(" "),
    achievements: ach.slice(0, 3),
  };
}

// ── Armado de la ceremonia ──────────────────────────────────────────────────

function entryFor(save: GameSave, award: SeasonAward, nominee: AwardNominee, rank: number): CeremonyEntry {
  const target = AWARD_DEFS[award.kind].target;
  const profile = target === "manager" ? managerProfile(save, nominee) : playerProfile(save, award.kind, nominee);
  return { rank, nominee, profile };
}

/**
 * Ranking del premio: el ganador va primero y el resto de los nominados sigue en el orden de puntaje
 * con el que se eligieron (el ganador no siempre es el primero de esa lista, porque se sortea).
 */
export function rankingOf(award: SeasonAward): AwardNominee[] {
  const winner = award.winner;
  if (!winner) return [];
  const rest = award.nominees.filter((n) => n.id !== winner.id);
  return [winner, ...rest];
}

/** Orden de la gala: de menor a mayor, para cerrar con el Balón de Oro. */
const CEREMONY_ORDER: AwardKind[] = ["kopa", "guante_oro", "dt_anio", "puskas", "bota_oro", "balon_oro"];

/** Premios de la temporada del save, en el orden de la ceremonia. Solo los que ya tienen ganador. */
export function buildCeremony(save: GameSave): CeremonyAward[] {
  const ofSeason = awardsOfSeason(save.awards ?? [], save.season).sort(
    (a, b) => CEREMONY_ORDER.indexOf(a.kind) - CEREMONY_ORDER.indexOf(b.kind),
  );
  const out: CeremonyAward[] = [];
  for (const award of ofSeason) {
    if (!award.winner) continue;
    const ranking = rankingOf(award).map((n, i) => entryFor(save, award, n, i + 1));
    if (!ranking.length) continue;
    const nominees = [...ranking].sort((a, b) => a.nominee.name.localeCompare(b.nominee.name, "es"));
    out.push({
      kind: award.kind,
      name: award.name,
      description: AWARD_DEFS[award.kind].description,
      season: award.season,
      nominees,
      ranking,
    });
  }
  return out;
}

/** ¿La temporada tiene al menos un premio para entregar? */
export function hasCeremony(save: GameSave): boolean {
  return awardsOfSeason(save.awards ?? [], save.season).some((a) => a.winner);
}
