import type { FormationId, FormationSlot, Mentality, Player, Pos } from "./types";

export const FORMATIONS: Record<
  FormationId,
  { name: string; slots: FormationSlot[] }
> = {
  "433": {
    name: "4-3-3",
    slots: [
      { x: 50, y: 90, pos: ["GK"], label: "PO" },
      { x: 16, y: 70, pos: ["LB"], label: "LI" },
      { x: 37, y: 73, pos: ["CB"], label: "DFC" },
      { x: 63, y: 73, pos: ["CB"], label: "DFC" },
      { x: 84, y: 70, pos: ["RB"], label: "LD" },
      { x: 28, y: 48, pos: ["CM", "CDM", "CAM"], label: "MC" },
      { x: 50, y: 52, pos: ["CM", "CDM", "CAM"], label: "MC" },
      { x: 72, y: 48, pos: ["CM", "CDM", "CAM"], label: "MC" },
      { x: 16, y: 22, pos: ["LW", "RW", "ST", "CAM"], label: "EI" },
      { x: 50, y: 18, pos: ["ST", "CAM"], label: "DC" },
      { x: 84, y: 22, pos: ["RW", "LW", "ST", "CAM"], label: "ED" },
    ],
  },
  "4231": {
    name: "4-2-3-1",
    slots: [
      { x: 50, y: 90, pos: ["GK"], label: "PO" },
      { x: 16, y: 70, pos: ["LB"], label: "LI" },
      { x: 37, y: 73, pos: ["CB"], label: "DFC" },
      { x: 63, y: 73, pos: ["CB"], label: "DFC" },
      { x: 84, y: 70, pos: ["RB"], label: "LD" },
      { x: 34, y: 56, pos: ["CDM", "CM"], label: "MCD" },
      { x: 66, y: 56, pos: ["CDM", "CM"], label: "MCD" },
      { x: 16, y: 32, pos: ["LW", "CAM"], label: "EI" },
      { x: 50, y: 34, pos: ["CAM", "CM"], label: "MCO" },
      { x: 84, y: 32, pos: ["RW", "CAM"], label: "ED" },
      { x: 50, y: 18, pos: ["ST"], label: "DC" },
    ],
  },
  "442": {
    name: "4-4-2",
    slots: [
      { x: 50, y: 90, pos: ["GK"], label: "PO" },
      { x: 16, y: 70, pos: ["LB"], label: "LI" },
      { x: 37, y: 73, pos: ["CB"], label: "DFC" },
      { x: 63, y: 73, pos: ["CB"], label: "DFC" },
      { x: 84, y: 70, pos: ["RB"], label: "LD" },
      { x: 16, y: 42, pos: ["LW", "CM"], label: "EI" },
      { x: 37, y: 48, pos: ["CM", "CDM"], label: "MC" },
      { x: 63, y: 48, pos: ["CM", "CDM"], label: "MC" },
      { x: 84, y: 42, pos: ["RW", "CM"], label: "ED" },
      { x: 38, y: 18, pos: ["ST", "CAM"], label: "DC" },
      { x: 62, y: 18, pos: ["ST", "CAM"], label: "DC" },
    ],
  },
  "352": {
    name: "3-5-2",
    slots: [
      { x: 50, y: 90, pos: ["GK"], label: "PO" },
      { x: 24, y: 72, pos: ["CB"], label: "DFC" },
      { x: 50, y: 74, pos: ["CB"], label: "DFC" },
      { x: 76, y: 72, pos: ["CB"], label: "DFC" },
      { x: 12, y: 46, pos: ["LB", "LW", "CM"], label: "CAI" },
      { x: 34, y: 50, pos: ["CM", "CDM"], label: "MC" },
      { x: 50, y: 54, pos: ["CDM", "CM"], label: "MCD" },
      { x: 66, y: 50, pos: ["CM", "CAM"], label: "MC" },
      { x: 88, y: 46, pos: ["RB", "RW", "CM"], label: "CAD" },
      { x: 38, y: 18, pos: ["ST", "CAM"], label: "DC" },
      { x: 62, y: 18, pos: ["ST", "LW", "RW"], label: "DC" },
    ],
  },
  "343": {
    name: "3-4-3",
    slots: [
      { x: 50, y: 90, pos: ["GK"], label: "PO" },
      { x: 24, y: 72, pos: ["CB"], label: "DFC" },
      { x: 50, y: 74, pos: ["CB"], label: "DFC" },
      { x: 76, y: 72, pos: ["CB"], label: "DFC" },
      { x: 14, y: 46, pos: ["LB", "LW"], label: "CAI" },
      { x: 38, y: 50, pos: ["CM", "CDM"], label: "MC" },
      { x: 62, y: 50, pos: ["CM", "CAM"], label: "MC" },
      { x: 86, y: 46, pos: ["RB", "RW"], label: "CAD" },
      { x: 18, y: 22, pos: ["LW", "ST"], label: "EI" },
      { x: 50, y: 18, pos: ["ST"], label: "DC" },
      { x: 82, y: 22, pos: ["RW", "ST"], label: "ED" },
    ],
  },
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

export const MENTALITY_LABEL: Record<Mentality, string> = {
  defensive: "Defensivo",
  balanced: "Equilibrado",
  attacking: "Ofensivo",
};

const GROUP: Record<Pos, "GK" | "DEF" | "MID" | "FWD"> = {
  GK: "GK",
  CB: "DEF",
  LB: "DEF",
  RB: "DEF",
  CDM: "MID",
  CM: "MID",
  CAM: "MID",
  LW: "FWD",
  RW: "FWD",
  ST: "FWD",
};

/** How well a player fits a slot. Exact native position wins by a mile. */
export function slotFit(playerPos: Pos, allowed: Pos[]): number {
  if (allowed.includes(playerPos)) return 100;
  if (playerPos === "GK" || allowed.includes("GK")) return -1000;

  const pG = GROUP[playerPos];
  const slotGroups = new Set(allowed.map((p) => GROUP[p]));

  const near =
    (playerPos === "LB" && allowed.includes("RB")) ||
    (playerPos === "RB" && allowed.includes("LB")) ||
    (playerPos === "CB" && (allowed.includes("LB") || allowed.includes("RB"))) ||
    (playerPos === "LB" && allowed.includes("CB")) ||
    (playerPos === "RB" && allowed.includes("CB")) ||
    (playerPos === "CM" && (allowed.includes("CDM") || allowed.includes("CAM"))) ||
    (playerPos === "CDM" && allowed.includes("CM")) ||
    (playerPos === "CAM" && allowed.includes("CM")) ||
    (playerPos === "LW" && (allowed.includes("RW") || allowed.includes("CAM"))) ||
    (playerPos === "RW" && (allowed.includes("LW") || allowed.includes("CAM"))) ||
    (playerPos === "ST" && (allowed.includes("CAM") || allowed.includes("LW") || allowed.includes("RW"))) ||
    (playerPos === "CAM" && (allowed.includes("LW") || allowed.includes("RW") || allowed.includes("ST"))) ||
    (playerPos === "LW" && allowed.includes("ST")) ||
    (playerPos === "RW" && allowed.includes("ST"));

  if (near) return 28;

  if (pG === "FWD" && slotGroups.has("DEF")) return -90;
  if (pG === "DEF" && slotGroups.has("FWD")) return -90;
  if (pG === "MID" && slotGroups.has("DEF")) return -18;
  if (pG === "MID" && slotGroups.has("FWD")) return -12;
  if (pG === "FWD" && slotGroups.has("MID")) return -22;
  if (pG === "DEF" && slotGroups.has("MID")) return -25;
  return -55;
}

/** Regla dura del once: solo se puede poner a un jugador en una posición que juega. */
export function canPlaySlot(playerPos: Pos, allowed: Pos[]): boolean {
  return allowed.includes(playerPos);
}

export function isNaturalSlot(playerPos: Pos, allowed: Pos[]): boolean {
  return slotFit(playerPos, allowed) >= 100;
}

function slotScore(player: Player, allowed: Pos[]) {
  const fit = slotFit(player.pos, allowed);
  const gkPenalty = player.pos === "GK" && !allowed.includes("GK") ? -200 : 0;
  const fieldPenalty = allowed.includes("GK") && player.pos !== "GK" ? -200 : 0;
  return (
    player.ovr +
    player.form * 0.5 +
    player.fitness / 25 +
    fit +
    gkPenalty +
    fieldPenalty -
    (player.injured > 0 ? 40 : 0) -
    (player.suspended > 0 ? 50 : 0) -
    ((player.absence?.games ?? 0) > 0 ? 50 : 0)
  );
}

function fillPass(
  slots: FormationSlot[],
  available: Player[],
  used: Set<string>,
  ids: Array<string | null>,
  minFit: number,
) {
  for (let i = 0; i < slots.length; i++) {
    if (ids[i]) continue;
    const slot = slots[i]!;
    let best: Player | null = null;
    let bestScore = -Infinity;
    for (const p of available) {
      if (used.has(p.id)) continue;
      const fit = slotFit(p.pos, slot.pos);
      if (fit < minFit) continue;
      const s = slotScore(p, slot.pos);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (best) {
      used.add(best.id);
      ids[i] = best.id;
    }
  }
}

/** Por qué un jugador no puede jugar. "illness" y "absence" vienen de sucesos inesperados. */
export type UnavailableReason = "injury" | "suspension" | "illness" | "absence";

/**
 * Única fuente de verdad de la disponibilidad: lesión, sanción o ausencia por un suceso.
 * Todo lo que arma un once, un banquillo o simula un partido pasa por acá.
 */
export function isUnavailable(p: Player): boolean {
  return p.injured > 0 || p.suspended > 0 || (p.absence?.games ?? 0) > 0;
}

export function unavailableReason(p: Player): UnavailableReason | null {
  if (p.injured > 0) return "injury";
  if (p.suspended > 0) return "suspension";
  if ((p.absence?.games ?? 0) > 0) return p.absence!.kind === "illness" ? "illness" : "absence";
  return null;
}

/** Partidos que le quedan de baja (0 si está disponible). Si hay varios motivos, cuenta el más largo. */
export function unavailableGames(p: Player): number {
  return Math.max(p.injured > 0 ? p.injured : 0, p.suspended > 0 ? p.suspended : 0, p.absence?.games ?? 0);
}

/** Texto para mostrar el motivo de la baja. */
export function unavailableDetail(p: Player): string {
  const reason = unavailableReason(p);
  if (reason === "injury") return "Lesión";
  if (reason === "suspension") return "Sancionado";
  if (reason === "illness" || reason === "absence") return p.absence?.reason || (reason === "illness" ? "Enfermedad" : "Ausencia");
  return "";
}

export function pickXi(squad: Player[], formation: FormationId): string[] {
  const slots = FORMATIONS[formation].slots;
  const available = squad.filter((p) => !isUnavailable(p) && p.fitness >= 45);
  const used = new Set<string>();
  const ids: Array<string | null> = slots.map(() => null);

  fillPass(slots, available, used, ids, 100);
  fillPass(slots, available, used, ids, 20);
  fillPass(slots, available, used, ids, -30);
  fillPass(slots, available, used, ids, -200);

  return ids.filter((id): id is string => Boolean(id));
}

/** Keep the rest of the XI; fill the sold starter's slot with the best player from the bench. */
export function dropFromLineup(
  lineup: string[],
  formation: FormationId,
  droppedId: string,
  squad: Player[],
): string[] {
  const remaining = squad.filter((p) => p.id !== droppedId);
  const idx = lineup.indexOf(droppedId);
  if (idx < 0) {
    const keep = lineup.filter((id) => remaining.some((p) => p.id === id));
    return keep.length === FORMATIONS[formation].slots.length ? keep : pickXi(remaining, formation);
  }
  const slot = FORMATIONS[formation].slots[idx];
  const used = new Set(lineup.filter((id) => id !== droppedId));
  let best: Player | null = null;
  let bestScore = -Infinity;
  for (const p of remaining) {
    if (used.has(p.id) || isUnavailable(p) || p.fitness < 45) continue;
    const s = slotScore(p, slot?.pos ?? ["CM"]);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  if (!best) return pickXi(remaining, formation);
  const next = [...lineup];
  next[idx] = best.id;
  return next;
}

export function xiRating(players: Player[], lineup: string[]) {
  const xi = lineup
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
  if (xi.length === 0) return 60;
  return xi.reduce((s, p) => s + p.ovr + p.form * 0.6 + (p.fitness - 80) * 0.08, 0) / xi.length;
}

export function axisRatings(players: Player[], lineup: string[]) {
  const xi = lineup
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
  const gk = xi.filter((p) => p.pos === "GK");
  const def = xi.filter((p) => p.pos === "CB" || p.pos === "LB" || p.pos === "RB" || p.pos === "CDM");
  const mid = xi.filter((p) => p.pos === "CM" || p.pos === "CAM" || p.pos === "CDM");
  const att = xi.filter((p) => p.pos === "ST" || p.pos === "LW" || p.pos === "RW" || p.pos === "CAM");
  const avg = (list: Player[], key: keyof Player["attrs"] | "ovr") => {
    if (!list.length) return 68;
    return list.reduce((s, p) => s + (key === "ovr" ? p.ovr : p.attrs[key]), 0) / list.length;
  };
  return {
    attack: avg(att, "sho") * 0.55 + avg(att, "pac") * 0.25 + avg(att, "dri") * 0.2,
    midfield: avg(mid, "pas") * 0.6 + avg(mid, "dri") * 0.2 + avg(mid, "ovr") * 0.2,
    defense: avg(def, "def") * 0.6 + avg(def, "phy") * 0.25 + avg(gk, "ovr") * 0.15,
    gk: avg(gk, "ovr"),
  };
}


/** Suplentes que se convocan para un partido (como en el fútbol real: un arquero y seis de campo). */
export const BENCH_SIZE = 7;

function groupOf(pos: Pos) {
  return GROUP[pos];
}

/**
 * Elige un banquillo equilibrado: un arquero y el resto repartido entre defensa, medio y ataque,
 * siempre con los mejores disponibles. No incluye lesionados, sancionados ni a los del once.
 */
export function pickBench(squad: Player[], lineup: string[], size = BENCH_SIZE): string[] {
  const taken = new Set(lineup);
  const pool = squad
    .filter((p) => !taken.has(p.id) && !isUnavailable(p) && p.fitness >= 40)
    .sort((a, b) => benchScore(b) - benchScore(a));
  const out: Player[] = [];
  const add = (p: Player | undefined) => {
    if (p && !out.includes(p) && out.length < size) out.push(p);
  };
  add(pool.find((p) => p.pos === "GK"));
  // Cupo mínimo por línea, para no llenar el banco de un solo puesto.
  for (const [g, n] of [["DEF", 2], ["MID", 2], ["FWD", 1]] as const) {
    pool.filter((p) => groupOf(p.pos) === g).slice(0, n).forEach(add);
  }
  for (const p of pool) {
    if (p.pos === "GK" && out.some((x) => x.pos === "GK")) continue; // un solo suplente arquero
    add(p);
  }
  return out.map((p) => p.id);
}

function benchScore(p: Player) {
  return p.ovr + p.form * 0.5 + p.fitness / 25;
}

/**
 * Deja el banquillo coherente: saca a los que ya no están en el club, a los que no pueden jugar
 * (lesión, sanción o ausencia), a los repetidos y a los que pasaron al once. Si todavía no había banquillo (partidas viejas), lo arma solo.
 */
export function sanitizeBench(
  bench: string[] | undefined,
  lineup: string[],
  squad: Player[],
): string[] {
  if (!Array.isArray(bench)) return pickBench(squad, lineup);
  const inXi = new Set(lineup);
  const byId = new Map(squad.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of bench) {
    const member = byId.get(id);
    // Un suplente que pasó a estar lesionado, sancionado o ausente sale del banquillo.
    if (!member || isUnavailable(member) || inXi.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= BENCH_SIZE) break;
  }
  // Si alguien se fue o pasó al once, su lugar lo ocupa el mejor disponible (el banco no se achica solo).
  const want = Math.min(bench.length, BENCH_SIZE);
  if (out.length < want) {
    for (const id of pickBench(squad, lineup)) {
      if (out.length >= want) break;
      if (!out.includes(id)) out.push(id);
    }
  }
  return out;
}

/** Media de los suplentes que pueden jugar. Los puestos vacíos pesan como un suplente flojo. */
export function benchRating(players: Player[], bench: string[]): number {
  const list = bench
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p) && !isUnavailable(p as Player));
  const EMPTY = 50;
  let sum = 0;
  for (let i = 0; i < BENCH_SIZE; i++) {
    const p = list[i];
    sum += p ? p.ovr + p.form * 0.4 + (p.fitness - 85) * 0.04 : EMPTY;
  }
  return sum / BENCH_SIZE;
}

/**
 * Mete a un recién llegado (cantera, fichaje) en la alineación en el momento, sin esperar al cierre
 * de temporada: si juega mejor que el titular de un puesto que sabe jugar, lo reemplaza (el desplazado
 * pasa al banco); si no, entra al banquillo (con sitio libre o desplazando al suplente más flojo).
 */
export function placeNewcomer(
  tactics: { formation: FormationId; lineup: string[]; bench: string[] },
  squad: Player[],
  newcomer: Player,
): { lineup: string[]; bench: string[] } {
  const lineup = [...tactics.lineup];
  let bench = tactics.bench.filter((id) => id !== newcomer.id);
  if (isUnavailable(newcomer)) return { lineup, bench };
  const byId = new Map(squad.map((p) => [p.id, p]));
  const slots = FORMATIONS[tactics.formation].slots;

  // Puesto donde más mejora al once (solo posiciones que juega de verdad).
  let bestIdx = -1;
  let bestGain = 0;
  slots.forEach((slot, i) => {
    if (!canPlaySlot(newcomer.pos, slot.pos)) return;
    const current = byId.get(lineup[i] ?? "");
    const gain = current ? slotScore(newcomer, slot.pos) - slotScore(current, slot.pos) : 100;
    if (gain > bestGain) {
      bestGain = gain;
      bestIdx = i;
    }
  });

  if (bestIdx >= 0 && bestGain > 0) {
    const displaced = lineup[bestIdx];
    lineup[bestIdx] = newcomer.id;
    if (displaced && !bench.includes(displaced) && bench.length < BENCH_SIZE) bench.push(displaced);
    return { lineup, bench: sanitizeBench(bench, lineup, squad) };
  }

  if (bench.length < BENCH_SIZE) {
    bench.push(newcomer.id);
  } else {
    const weakest = bench
      .map((id) => byId.get(id))
      .filter((p): p is Player => Boolean(p))
      .sort((a, b) => benchScore(a) - benchScore(b))[0];
    if (weakest && benchScore(newcomer) > benchScore(weakest)) {
      bench = bench.map((id) => (id === weakest.id ? newcomer.id : id));
    }
  }
  return { lineup, bench: sanitizeBench(bench, lineup, squad) };
}
