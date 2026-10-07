import { rollPotential } from "./potential";
import { clubById } from "./clubs";
import { normalizePos } from "./positions";
import { clamp, playerValue, playerWage } from "./format";
import { STARS, makeName, pickNat, type StarSeed } from "./names";
import type { Rng } from "./rng";
import { alignOutfield, gkFor, syncStats } from "./stats";
import type { Attrs, GkAttrs, Player, Pos } from "./types";

const SQUAD_SHAPE: Array<{ pos: Pos; n: number }> = [
  { pos: "GK", n: 3 },
  { pos: "RB", n: 2 },
  { pos: "CB", n: 4 },
  { pos: "LB", n: 2 },
  { pos: "CDM", n: 2 },
  { pos: "CM", n: 3 },
  { pos: "CAM", n: 2 },
  { pos: "RW", n: 2 },
  { pos: "LW", n: 2 },
  { pos: "ST", n: 3 },
];

function extras(ovr: number): Pick<
  Player,
  | "careerGoals"
  | "careerAssists"
  | "careerApps"
  | "seasonStartOvr"
  | "listedForLoan"
  | "loanFrom"
  | "loanSeasons"
  | "hiddenGem"
  | "suspended"
  | "number"
> {
  return {
    careerGoals: 0,
    careerAssists: 0,
    careerApps: 0,
    seasonStartOvr: ovr,
    listedForLoan: false,
    loanFrom: null,
    loanSeasons: 0,
    hiddenGem: false,
    suspended: 0,
    number: 0,
  };
}

function rawAttrsFor(pos: Pos, ovr: number, rng: Rng): Attrs {
  const j = () => rng.int(-3, 3);
  const cap = (n: number) => clamp(Math.round(n), 42, 100);
  const base = ovr - 2;
  if (pos === "GK") {
    return {
      pac: cap(base - 28 + j()),
      sho: cap(base - 30 + j()),
      pas: cap(base - 12 + j()),
      dri: cap(base - 18 + j()),
      def: cap(base - 8 + j()),
      phy: cap(base - 4 + j()),
    };
  }
  if (pos === "CB") {
    return {
      pac: cap(base - 14 + j()),
      sho: cap(base - 22 + j()),
      pas: cap(base - 8 + j()),
      dri: cap(base - 12 + j()),
      def: cap(base + 4 + j()),
      phy: cap(base + 3 + j()),
    };
  }
  if (pos === "LB" || pos === "RB") {
    return {
      pac: cap(base + 2 + j()),
      sho: cap(base - 14 + j()),
      pas: cap(base - 4 + j()),
      dri: cap(base - 2 + j()),
      def: cap(base + 1 + j()),
      phy: cap(base - 2 + j()),
    };
  }
  if (pos === "CDM") {
    return {
      pac: cap(base - 6 + j()),
      sho: cap(base - 10 + j()),
      pas: cap(base + 2 + j()),
      dri: cap(base - 2 + j()),
      def: cap(base + 3 + j()),
      phy: cap(base + 2 + j()),
    };
  }
  if (pos === "CM") {
    return {
      pac: cap(base - 2 + j()),
      sho: cap(base - 4 + j()),
      pas: cap(base + 3 + j()),
      dri: cap(base + 1 + j()),
      def: cap(base - 4 + j()),
      phy: cap(base - 2 + j()),
    };
  }
  if (pos === "CAM") {
    return {
      pac: cap(base + 1 + j()),
      sho: cap(base + 1 + j()),
      pas: cap(base + 4 + j()),
      dri: cap(base + 3 + j()),
      def: cap(base - 16 + j()),
      phy: cap(base - 8 + j()),
    };
  }
  if (pos === "LW" || pos === "RW") {
    return {
      pac: cap(base + 5 + j()),
      sho: cap(base + 1 + j()),
      pas: cap(base - 2 + j()),
      dri: cap(base + 4 + j()),
      def: cap(base - 20 + j()),
      phy: cap(base - 8 + j()),
    };
  }
  return {
    pac: cap(base + 2 + j()),
    sho: cap(base + 5 + j()),
    pas: cap(base - 8 + j()),
    dri: cap(base + 1 + j()),
    def: cap(base - 22 + j()),
    phy: cap(base + 2 + j()),
  };
}

/**
 * Estadísticas coherentes con el GRL: el perfil típico de la posición, ajustado para que las
 * estadísticas den exactamente esa media (un 86 nunca aparece con stats de 45).
 */
export function attrsFor(pos: Pos, ovr: number, rng: Rng): Attrs {
  const raw = rawAttrsFor(pos, ovr, rng);
  return pos === "GK" ? raw : alignOutfield(pos, raw, ovr);
}

/** Atributos de campo + estadísticas de portero (solo si juega de PO). */
export function statsFor(pos: Pos, ovr: number, rng: Rng): { attrs: Attrs; gk?: GkAttrs } {
  const attrs = attrsFor(pos, ovr, rng);
  return pos === "GK" ? { attrs, gk: gkFor(ovr, rng) } : { attrs };
}

/** Reajusta las estadísticas de un jugador a su GRL actual (si hay mucha diferencia, las rehace). */
export function resyncStats(p: Player, rng: Rng) {
  syncStats(p, (pos, ovr) => attrsFor(pos, ovr, rng));
}

function fromStar(clubId: string, seed: StarSeed, i: number, rng: Rng): Player {
  const club = clubById(clubId);
  const pot = seed.pot ?? rollPotential(seed.ovr, seed.age, rng);
  const ovr = seed.ovr;
  // Posición siempre válida: alias viejos (LM/RM...) se traducen y si no se reconoce cae en CM.
  const pos = normalizePos(seed.pos, "CM");
  return {
    id: `${clubId}-${i}`,
    name: seed.name,
    nat: seed.nat,
    age: seed.age,
    pos,
    ovr,
    pot,
    clubId,
    value: playerValue(ovr, seed.age, pot),
    wage: playerWage(ovr, club.prestige),
    contract: rng.int(1, 4),
    form: rng.int(-1, 2),
    fitness: rng.int(88, 100),
    morale: rng.int(68, 92),
    goals: 0,
    assists: 0,
    apps: 0,
    injured: 0,
    yellows: 0,
    listed: false,
    ...statsFor(pos, ovr, rng),
    ...extras(ovr),
  };
}

export function generated(
  clubId: string,
  pos: Pos,
  i: number,
  prestige: number,
  rng: Rng,
  used: Set<string>,
): Player {
  const club = clubById(clubId);
  // Nunca se genera un jugador sin posición válida (si llega vacía/inválida cae en CM).
  const position = normalizePos(pos, "CM");
  const nat = pickNat(rng, clubId, club.league, club.country);
  const name = makeName(rng, nat, used);
  const age = rng.int(18, 34);
  const cap = Math.min(prestige - 6, club.league === "serieA" ? 82 : club.league === "argentina" ? 80 : 86);
  let ovr = clamp(prestige - 12 + rng.int(-5, 4), 58, cap);
  if (age >= 32) ovr = clamp(ovr - rng.int(1, 4), 58, 84);
  if (age <= 21) ovr = clamp(ovr - rng.int(2, 6), 58, 80);
  const pot = rollPotential(ovr, age, rng);
  return {
    id: `${clubId}-g-${i}-${rng.int(1000, 9999)}`,
    name,
    nat,
    age,
    pos: position,
    ovr,
    pot,
    clubId,
    value: playerValue(ovr, age, pot),
    wage: playerWage(ovr, club.prestige),
    contract: rng.int(1, 5),
    form: rng.int(-2, 2),
    fitness: rng.int(84, 100),
    morale: rng.int(62, 88),
    goals: 0,
    assists: 0,
    apps: 0,
    injured: 0,
    yellows: 0,
    listed: false,
    ...statsFor(position, ovr, rng),
    ...extras(ovr),
    locked: Boolean(club.ghost),
  };
}

export function assignShirtNumbers(players: Player[]) {
  const taken = new Set<number>();
  const prefer: Record<Pos, number[]> = {
    GK: [1, 16, 30, 40, 50],
    RB: [2, 22, 12, 24],
    CB: [4, 5, 3, 6, 15, 23],
    LB: [3, 12, 19, 21],
    CDM: [6, 8, 21, 18],
    CM: [8, 10, 14, 28],
    CAM: [10, 7, 20, 11],
    RW: [7, 11, 17, 27],
    LW: [11, 7, 19, 29],
    ST: [9, 11, 19, 18, 99],
  };
  for (const p of players) {
    if (p.number >= 1 && p.number <= 99 && !taken.has(p.number)) {
      taken.add(p.number);
      continue;
    }
    const prefs = prefer[p.pos] ?? [10];
    let n = prefs.find((x) => !taken.has(x));
    if (!n) {
      n = 1;
      while (taken.has(n) && n < 99) n += 1;
    }
    p.number = n;
    taken.add(n);
  }
}

export function buildSquad(clubId: string, rng: Rng, usedNames: Set<string>): Player[] {
  const club = clubById(clubId);
  const stars = STARS[clubId] ?? [];
  const players: Player[] = [];
  const counts: Partial<Record<Pos, number>> = {};
  let i = 0;

  for (const star of stars) {
    const p = fromStar(clubId, star, i++, rng);
    usedNames.add(p.name);
    players.push(p);
    counts[p.pos] = (counts[p.pos] ?? 0) + 1;
  }

  for (const slot of SQUAD_SHAPE) {
    const have = counts[slot.pos] ?? 0;
    for (let k = have; k < slot.n; k++) {
      const p = generated(clubId, slot.pos, i++, club.prestige, rng, usedNames);
      players.push(p);
      counts[slot.pos] = (counts[slot.pos] ?? 0) + 1;
    }
  }

  assignShirtNumbers(players);
  return players;
}

export function plantHiddenGems(players: Player[], rng: Rng) {
  const young = players.filter((p) => p.age <= 21 && p.pot <= 78 && p.ovr <= 74);
  const picks = rng.shuffle(young).slice(0, 7);
  for (const p of picks) {
    p.pot = rng.chance(0.18) ? rng.int(94, 99) : rng.int(88, 96);
    p.hiddenGem = true;
    p.value = playerValue(p.ovr, p.age, p.pot, p);
  }
  return picks;
}
