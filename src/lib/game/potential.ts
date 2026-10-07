import { clamp, playerValue } from "./format";
import type { Rng } from "./rng";
import { ovrFromOutfield, syncStats } from "./stats";
import type { Attrs, Player, Pos } from "./types";

/** GRL de un jugador de campo a partir de sus atributos. */
export function ovrFromAttrs(pos: Exclude<Pos, "GK">, attrs: Attrs): number {
  return ovrFromOutfield(pos, attrs);
}

/**
 * Potential: low/mid media explodes early; elite curve brakes hard.
 * Soft cap 95. A few break it (96–99). 100 is once-in-a-generation.
 */
export function rollPotential(ovr: number, age: number, rng: Rng, forced?: number): number {
  if (forced !== undefined) return clamp(forced, ovr, 100);
  if (age >= 30) return ovr;
  let room: number;
  if (age <= 18) {
    room = ovr < 60 ? rng.int(14, 24) : ovr < 70 ? rng.int(10, 18) : rng.int(8, 16);
  } else if (age <= 21) {
    room = ovr < 60 ? rng.int(10, 18) : ovr < 70 ? rng.int(6, 14) : rng.int(5, 13);
  } else if (age <= 24) {
    room = ovr < 70 ? rng.int(3, 10) : rng.int(2, 8);
  } else {
    room = rng.int(0, 4);
  }
  let pot = ovr + room;
  if (pot > 88) {
    const extra = pot - 88;
    pot = 88 + Math.round(extra * (pot > 93 ? 0.32 : 0.52));
  }
  const roll = rng.float();
  if (roll < 0.003) pot = 100;
  else if (roll < 0.014) pot = clamp(Math.max(pot, 96), ovr, 99);
  else pot = Math.min(95, pot);
  return clamp(pot, ovr, 100);
}

export function isWonderkid(p: { age: number; pot: number; ovr: number }): boolean {
  return p.age <= 21 && p.pot >= 84 && p.pot - p.ovr >= 6;
}

export function potClass(pot: number) {
  if (pot >= 96) return "text-primary";
  if (pot >= 90) return "text-fg";
  if (pot >= 82) return "text-fg-muted";
  return "text-fg-subtle";
}

/** Max GRL points a player can gain in one season, by current overall. */
export function seasonMaxGain(ovr: number): number {
  if (ovr < 40) return 15;
  if (ovr < 50) return 12;
  if (ovr < 60) return 10;
  if (ovr <= 70) return 9;
  if (ovr < 80) return 5;
  if (ovr < 88) return 4;
  if (ovr < 90) return 3;
  if (ovr < 95) return 3;
  if (ovr < 98) return 2;
  return 1;
}

function seasonCap(p: Player): number {
  const start = p.seasonStartOvr || p.ovr;
  return start + seasonMaxGain(start);
}

export function isSmashSeason(p: Player) {
  const ga = p.goals + p.assists;
  if (p.pos === "ST" || p.pos === "LW" || p.pos === "RW") return p.goals >= 12 || ga >= 16;
  if (p.pos === "CAM" || p.pos === "CM") return ga >= 12 && p.apps >= 18;
  return p.apps >= 28 && p.form >= 2 && ga >= 6;
}

export function isGoodSeason(p: Player) {
  if (p.apps < 12) return false;
  const ga = p.goals + p.assists;
  return p.apps >= 18 || ga >= 6 || p.form >= 2;
}

function maybeExceedPot(p: Player, rng: Rng) {
  if (p.age > 24) return;
  if (p.pot >= 100) return;
  const smash = isSmashSeason(p);
  let chance = 0.02;
  let bump = 1;
  if (p.pot < 70) {
    chance = smash ? 0.48 : 0.24;
    bump = smash ? rng.int(2, 4) : rng.int(1, 3);
  } else if (p.pot < 80) {
    chance = smash ? 0.28 : 0.12;
    bump = smash ? rng.int(1, 3) : rng.int(1, 2);
  } else if (p.pot < 88) {
    chance = smash ? 0.14 : 0.05;
    bump = smash ? 2 : 1;
  } else if (p.pot < 93) {
    chance = smash ? 0.07 : 0.025;
    bump = 1;
  } else {
    chance = smash ? 0.03 : 0.008;
    bump = 1;
  }
  if (p.age <= 21 && p.apps >= 10) chance += 0.03;
  if (rng.chance(chance)) {
    p.pot = clamp(p.pot + bump, p.ovr, 100);
  }
}

export function growPlayer(p: Player, amount: number, rng: Rng, opts?: { ignoreCap?: boolean }) {
  if (amount <= 0) return;
  maybeExceedPot(p, rng);
  const hard = 100;
  const potCeil = p.pot + (rng.chance(0.05) && p.ovr < 80 ? 1 : 0);
  const cap = opts?.ignoreCap ? Math.min(hard, potCeil) : Math.min(hard, potCeil, seasonCap(p));
  const next = clamp(p.ovr + amount, 40, cap);
  if (next > p.ovr) {
    p.ovr = next;
    if (p.ovr > p.pot) p.pot = p.ovr;
    // Las estadísticas suben con la media (sobre todo las que más pesan en su posición).
    syncStats(p);
    p.value = playerValue(p.ovr, p.age, p.pot, p);
  }
}

export function applyMatchGrowth(
  players: Player[],
  playedIds: Set<string>,
  contrib: Map<string, { goals: number; assists: number }>,
  rng: Rng,
) {
  for (const p of players) {
    if (!playedIds.has(p.id)) continue;
    if (p.age >= 33) {
      if (rng.float() < 0.1) {
        p.ovr = clamp(p.ovr - 1, 48, 100);
        syncStats(p);
        p.value = playerValue(p.ovr, p.age, p.pot, p);
      }
      continue;
    }
    const c = contrib.get(p.id) ?? { goals: 0, assists: 0 };
    const smash = c.goals >= 2 || c.goals + c.assists >= 2;
    const well = c.goals >= 1 || c.assists >= 1;
    if (p.age <= 23) {
      let bump = 0;
      const low = p.ovr < 70;
      if (smash && p.age <= 21 && rng.chance(low ? 0.55 : 0.42)) bump = rng.int(1, low ? 2 : 2);
      else if (smash && rng.chance(low ? 0.4 : 0.28)) bump = 1;
      else if (well && rng.chance(p.age <= 21 ? (low ? 0.48 : 0.36) : 0.2)) bump = 1;
      else if (rng.chance(p.age <= 21 ? (low ? 0.24 : 0.16) : 0.07)) bump = 1;
      if (bump) growPlayer(p, bump, rng);
    } else if (p.age <= 28 && p.ovr < p.pot && rng.chance(p.ovr < 80 ? 0.1 : 0.06)) {
      growPlayer(p, 1, rng);
    }
  }
}

/**
 * Los jugadores del usuario que están cedidos en otro club siguen creciendo
 * mientras dura el préstamo (juegan minutos y se foguean).
 */
export function applyLoanGrowth(players: Player[], userClubId: string, rng: Rng): Player[] {
  const grown: Player[] = [];
  for (const p of players) {
    if (p.loanFrom !== userClubId || p.clubId === userClubId) continue;
    if (p.age >= 29 || p.ovr >= p.pot) continue;
    const chance = p.age <= 21 ? 0.42 : p.age <= 24 ? 0.3 : 0.14;
    if (!rng.chance(chance)) continue;
    const before = p.ovr;
    growPlayer(p, 1, rng);
    if (p.ovr > before) grown.push(p);
  }
  return grown;
}

export function seasonGrowth(p: Player, rng: Rng): Player {
  const aged: Player = {
    ...p,
    age: p.age + 1,
    careerGoals: p.careerGoals + p.goals,
    careerAssists: p.careerAssists + p.assists,
    careerApps: p.careerApps + p.apps,
    goals: 0,
    assists: 0,
    apps: 0,
    yellows: 0,
    injured: 0,
    suspended: 0,
    fitness: 96,
    form: 0,
    listed: false,
    listedForLoan: false,
    attrs: { ...p.attrs },
    gk: p.gk ? { ...p.gk } : undefined,
  };
  if (aged.age <= 23) {
    const well = isGoodSeason(p);
    const smash = isSmashSeason(p);
    const onLoan = Boolean(p.loanFrom);
    const extra = smash ? rng.int(1, 3) : well ? rng.int(onLoan ? 1 : 0, 2) : rng.int(onLoan ? 1 : 0, 1);
    growPlayer(aged, extra, rng, { ignoreCap: true });
    const gained = aged.ovr - (p.seasonStartOvr || p.ovr);
    const max = seasonMaxGain(p.seasonStartOvr || p.ovr);
    if (gained > max) {
      aged.ovr = (p.seasonStartOvr || p.ovr) + max;
      aged.value = playerValue(aged.ovr, aged.age, aged.pot, aged);
    }
  } else if (aged.age <= 28 && aged.ovr < aged.pot) {
    const bump = Math.min(rng.int(p.loanFrom ? 1 : 0, 2), seasonMaxGain(aged.ovr));
    aged.ovr = clamp(aged.ovr + bump, 50, Math.min(100, aged.pot + 1));
    if (aged.ovr > aged.pot && rng.chance(0.12)) aged.pot = aged.ovr;
  } else if (aged.age >= 32) {
    aged.ovr = clamp(aged.ovr - rng.int(1, 3), 48, 94);
    aged.pot = Math.min(aged.pot, aged.ovr + 1);
  }
  // Si la media cambió (crecimiento o edad), las estadísticas la acompañan.
  syncStats(aged);
  aged.seasonStartOvr = aged.ovr;
  // Si llega a 0 el contrato venció: lo resuelve processExpiries (renueva o queda libre).
  aged.contract = Math.max(0, aged.contract - 1);
  aged.value = playerValue(aged.ovr, aged.age, aged.pot, aged);
  return aged;
}
