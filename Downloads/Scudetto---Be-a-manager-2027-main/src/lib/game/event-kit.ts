import { ACADEMY_MAX } from "./academy";
import { CLUBS, clubById } from "./clubs";
import { COMP_LABEL, SQUAD_LIMIT, uid } from "./format";
import { squadTotal } from "./squad-rules";
import type { Rng } from "./rng";
import { isUnavailable } from "./tactics";
import type {
  Competition,
  Fixture,
  GamePopup,
  GameSave,
  NewsItem,
  Player,
  YouthPlayer,
} from "./types";

/** Plantel del usuario (sin cedidos que llegaron de otro club). */
export function userSquad(save: GameSave): Player[] {
  return save.players.filter((p) => p.clubId === save.clubId && !p.loanFrom);
}

export function pickFit(squad: Player[], rng: Rng): Player | null {
  const pool = squad.filter((p) => !isUnavailable(p));
  return pool.length ? rng.pick(pool) : null;
}

export function news(save: GameSave, tone: NewsItem["tone"], title: string, body: string): NewsItem {
  return { id: uid("n"), week: save.week, tone, title, body };
}

export function popup(
  kind: GamePopup["kind"],
  tone: GamePopup["tone"],
  title: string,
  body: string,
  prize?: number,
): GamePopup {
  return { id: uid("pop"), kind, tone, title, body, prize };
}

export function isYouth(p: Player) {
  return p.age <= 21;
}

export function isKid(p: Player) {
  return p.age <= 19;
}

export function isStar(p: Player) {
  return p.ovr >= 80;
}

export function isImportant(p: Player, save: GameSave) {
  return p.ovr >= 78 || save.tactics.lineup.includes(p.id);
}

export function isVeteran(p: Player) {
  return p.age >= 32;
}

/** Leyenda en actividad: veterano del plantel. */
export function isLegend(p: Player) {
  return p.age >= 32;
}

export function isStarter(p: Player, save: GameSave) {
  return save.tactics.lineup.includes(p.id) && !isUnavailable(p);
}

export function isFit(p: Player) {
  return !isUnavailable(p);
}

/** Capitán de hecho: el más respetado del plantel (partidos de carrera, GRL, titularidad). */
export function captainOf(save: GameSave): Player | null {
  const squad = userSquad(save);
  if (!squad.length) return null;
  const ranked = [...squad].sort((a, b) => scoreCaptain(b, save) - scoreCaptain(a, save));
  return ranked[0] ?? null;
}

function scoreCaptain(p: Player, save: GameSave) {
  return p.careerApps * 4 + p.ovr * 2 + p.age + (save.tactics.lineup.includes(p.id) ? 10 : 0);
}

export function isCaptain(p: Player, save: GameSave) {
  return captainOf(save)?.id === p.id;
}

export function academyHasRoom(save: GameSave) {
  return save.academy.length < ACADEMY_MAX;
}

export function squadHasRoom(save: GameSave) {
  // El tope cuenta propios + cedidos que llegaron (los cedidos ocupan lugar).
  return squadTotal(save.players, save.clubId) < SQUAD_LIMIT;
}

export function usedNames(save: GameSave): Set<string> {
  const used = new Set<string>();
  for (const p of save.players) used.add(p.name);
  for (const p of save.freeAgents) used.add(p.name);
  for (const y of save.academy) used.add(y.name);
  return used;
}

export function clubNat(save: GameSave): string {
  const league = clubById(save.clubId).league;
  if (league === "bundesliga") return "GER";
  if (league === "premier") return "ENG";
  if (league === "laliga") return "ESP";
  if (league === "ligue1") return "FRA";
  if (league === "argentina") return "ARG";
  return "ITA";
}

export function lastNameOf(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || name;
}

export function pickOtherClub(save: GameSave, rng: Rng, minPrestige = 0) {
  const pool = CLUBS.filter((c) => !c.ghost && c.id !== save.clubId && c.prestige >= minPrestige);
  const fallback = CLUBS.filter((c) => !c.ghost && c.id !== save.clubId);
  return rng.pick(pool.length ? pool : fallback);
}

export function pendingFixture(save: GameSave): Fixture | null {
  const id = save.pendingFixtureId;
  if (!id) return null;
  return save.fixtures.find((f) => f.id === id) ?? null;
}

export function opponentClub(save: GameSave) {
  const f = pendingFixture(save);
  if (!f) return null;
  const oppId = f.homeId === save.clubId ? f.awayId : f.homeId;
  return clubById(oppId);
}

export function opponentName(save: GameSave) {
  return opponentClub(save)?.name ?? "el rival";
}

export function competitionLabel(save: GameSave) {
  const f = pendingFixture(save);
  return f ? COMP_LABEL[f.competition as Competition] : "el partido";
}

const BIG_CUPS: Competition[] = ["ucl", "uel", "uecl", "libertadores", "sudamericana", "mundial", "supercoppa", "coppa"];

export function isBigMatch(save: GameSave) {
  const f = pendingFixture(save);
  if (!f) return false;
  if (BIG_CUPS.includes(f.competition)) return true;
  const opp = opponentClub(save);
  return Boolean(opp && opp.prestige >= 84);
}

export function seasonProgress(save: GameSave) {
  const total = save.calendar.length;
  if (!total) return 0;
  return save.cursor / total;
}

export function lateSeason(save: GameSave) {
  return seasonProgress(save) >= 0.55;
}

export function otherFit(save: GameSave, rng: Rng, exceptId: string) {
  const pool = userSquad(save).filter((p) => p.id !== exceptId && !isUnavailable(p));
  return pool.length ? rng.pick(pool) : null;
}

export function pickYouth(save: GameSave, rng: Rng, pred?: (y: YouthPlayer) => boolean): YouthPlayer | null {
  const pool = pred ? save.academy.filter(pred) : save.academy;
  return pool.length ? rng.pick(pool) : null;
}
