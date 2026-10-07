import { rankingOf } from "./award-ceremony";
import { AWARD_DEFS, AWARD_KINDS, type AwardKind, type AwardNominee, type SeasonAward } from "./awards";
import { clubById } from "./clubs";
import { seasonLabel } from "./format";
import type { ClubId } from "./types";

// ---------------------------------------------------------------------------
// Historial de premios.
//
// La fuente de verdad es `save.awards`: una entrada por premio y temporada, con ganador y nominados
// (ordenados por puntaje). Se guarda en la partida, se conserva al cambiar de temporada y de club, y
// no se borra cuando un jugador se retira o se va (el premio guarda id, nombre y club de ese año).
// Este módulo solo LEE esos datos y los ordena para consultarlos:
//   · por jugador  → qué premios ganó, en qué temporadas, cuántas veces y qué nominaciones importantes tuvo;
//   · por premio   → quién lo ganó cada temporada (historial general de ganadores).
// Solo cuentan los premios ya entregados (con ganador): los de la temporada en curso no aparecen.
// ---------------------------------------------------------------------------

/** Etiqueta de temporada según la liga del club con el que se ganó ("2030/31" o "2030"). */
export function awardSeasonLabel(season: number, clubId: ClubId): string {
  return seasonLabel(season, clubById(clubId).league);
}

/** Nombre a mostrar de un ganador/nominado (los DT se muestran siempre por club). */
export function nomineeLabel(kind: AwardKind, n: AwardNominee): string {
  if (AWARD_DEFS[kind].target === "manager") return `DT de ${clubById(n.clubId).name}`;
  return n.name;
}

/** Premios ya entregados, de más reciente a más antiguo. */
function delivered(awards: SeasonAward[]): SeasonAward[] {
  return awards.filter((a) => a.winner).sort((a, b) => b.season - a.season);
}

// ── Por jugador ─────────────────────────────────────────────────────────────

export interface AwardWin {
  season: number;
  /** Temporada ya redactada ("2030/31"). */
  label: string;
  clubId: ClubId;
}

export interface PlayerAwardLine {
  kind: AwardKind;
  name: string;
  /** Temporadas en que lo ganó, de la más antigua a la más reciente. */
  wins: AwardWin[];
  count: number;
}

export interface AwardNomination {
  kind: AwardKind;
  name: string;
  season: number;
  label: string;
  clubId: ClubId;
  /** Puesto que ocupó entre los nominados (2 = segundo...). */
  rank: number;
  total: number;
  /** Podio (2.º o 3.º) en cualquier premio, o cualquier nominación al Balón de Oro. */
  important: boolean;
}

export interface PlayerAwardHistory {
  /** Premios ganados, uno por tipo de premio (en el orden habitual de los premios). */
  lines: PlayerAwardLine[];
  totalWins: number;
  /** Nominaciones en las que NO ganó, de más reciente a más antigua. */
  nominations: AwardNomination[];
  /** Subconjunto importante de `nominations`. */
  important: AwardNomination[];
  /** Todas las veces que fue nominado (ganó o no). */
  totalNominations: number;
}

function isImportantNomination(kind: AwardKind, rank: number): boolean {
  return kind === "balon_oro" || rank <= 3;
}

/** Historial de premios de un jugador (por id). Los premios de DT no cuentan: su id es el del club. */
export function playerAwardHistory(awards: SeasonAward[] | undefined, playerId: string): PlayerAwardHistory {
  const list = delivered(awards ?? []).filter((a) => AWARD_DEFS[a.kind].target === "player");
  const wins = new Map<AwardKind, AwardWin[]>();
  const nominations: AwardNomination[] = [];
  let totalNominations = 0;

  for (const award of list) {
    const ranking = rankingOf(award);
    const idx = ranking.findIndex((n) => n.id === playerId);
    if (idx < 0) continue;
    totalNominations++;
    const nominee = ranking[idx]!;
    if (idx === 0) {
      const arr = wins.get(award.kind) ?? [];
      arr.push({ season: award.season, label: awardSeasonLabel(award.season, nominee.clubId), clubId: nominee.clubId });
      wins.set(award.kind, arr);
    } else {
      const rank = idx + 1;
      nominations.push({
        kind: award.kind,
        name: award.name,
        season: award.season,
        label: awardSeasonLabel(award.season, nominee.clubId),
        clubId: nominee.clubId,
        rank,
        total: ranking.length,
        important: isImportantNomination(award.kind, rank),
      });
    }
  }

  const lines: PlayerAwardLine[] = [];
  for (const kind of AWARD_KINDS) {
    const w = wins.get(kind);
    if (!w?.length) continue;
    const sorted = [...w].sort((a, b) => a.season - b.season);
    lines.push({ kind, name: AWARD_DEFS[kind].name, wins: sorted, count: sorted.length });
  }

  return {
    lines,
    totalWins: lines.reduce((s, l) => s + l.count, 0),
    nominations,
    important: nominations.filter((n) => n.important),
    totalNominations,
  };
}

// ── General, por premio ─────────────────────────────────────────────────────

export interface WinnerRow {
  season: number;
  label: string;
  winner: AwardNominee;
  /** Nombre listo para mostrar. */
  winnerName: string;
  /** Cuántas veces había ganado este premio hasta esa temporada, contando esa (1 = primera vez). */
  timesWon: number;
  /** El resto de los nominados, ya en orden (2.º, 3.º...). */
  others: AwardNominee[];
}

export interface AwardLeader {
  id: string;
  name: string;
  clubId: ClubId;
  count: number;
  seasons: number[];
}

export interface AwardWinnersHistory {
  kind: AwardKind;
  name: string;
  description: string;
  /** Ganadores por temporada, de la más reciente a la más antigua. */
  rows: WinnerRow[];
  /** Quién lo ganó más veces (con 2 o más victorias primero). */
  leaders: AwardLeader[];
}

/** Historial general de ganadores de un premio. */
export function winnersHistory(awards: SeasonAward[] | undefined, kind: AwardKind): AwardWinnersHistory {
  const def = AWARD_DEFS[kind];
  const list = delivered(awards ?? []).filter((a) => a.kind === kind);

  // Veces ganado acumuladas: se cuentan de la temporada más vieja a la más nueva.
  const running = new Map<string, number>();
  const counted = new Map<number, number>();
  for (const a of [...list].reverse()) {
    const id = a.winner!.id;
    const n = (running.get(id) ?? 0) + 1;
    running.set(id, n);
    counted.set(a.season, n);
  }

  const rows: WinnerRow[] = list.map((a) => {
    const ranking = rankingOf(a);
    const winner = a.winner!;
    return {
      season: a.season,
      label: awardSeasonLabel(a.season, winner.clubId),
      winner,
      winnerName: nomineeLabel(kind, winner),
      timesWon: counted.get(a.season) ?? 1,
      others: ranking.slice(1),
    };
  });

  const byId = new Map<string, AwardLeader>();
  for (const a of [...list].reverse()) {
    const w = a.winner!;
    const cur = byId.get(w.id);
    if (cur) {
      cur.count++;
      cur.seasons.push(a.season);
      cur.clubId = w.clubId; // el club más reciente con el que lo ganó
    } else {
      byId.set(w.id, { id: w.id, name: nomineeLabel(kind, w), clubId: w.clubId, count: 1, seasons: [a.season] });
    }
  }
  const leaders = [...byId.values()].sort(
    (a, b) => b.count - a.count || (b.seasons[b.seasons.length - 1] ?? 0) - (a.seasons[a.seasons.length - 1] ?? 0),
  );

  return { kind, name: def.name, description: def.description, rows, leaders };
}

/** Historial general de todos los premios, en el orden habitual. */
export function allWinnersHistory(awards: SeasonAward[] | undefined): AwardWinnersHistory[] {
  return AWARD_KINDS.map((kind) => winnersHistory(awards, kind));
}

/** ¿Hay algún premio entregado en el historial? */
export function hasAwardHistory(awards: SeasonAward[] | undefined): boolean {
  return (awards ?? []).some((a) => a.winner);
}
