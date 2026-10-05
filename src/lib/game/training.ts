import { clamp, playerValue, uid } from "./format";
import { Rng } from "./rng";
import { ovrOf, statKeysFor, statSnapshot, getStat, syncStats } from "./stats";
import type {
  GameSave,
  GamePopup,
  Player,
  TrainingPlan,
  TrainingPlayerResult,
  TrainingReport,
  TrainingStatChange,
  TrainingTier,
} from "./types";

/** Todos los niveles duran exactamente 6 meses de tiempo de juego. */
export const TRAINING_MONTHS = 6;
/** Días de respaldo si la fecha de inicio no se puede leer (6 meses ≈ 182 días). */
export const TRAINING_DAYS = 182;
/** Días entre el último partido de una temporada y el primero de la siguiente. */
export const OFFSEASON_DAYS = 75;
/** Informes guardados (los más nuevos primero). */
const MAX_REPORTS = 6;

export interface TrainingTierInfo {
  id: TrainingTier;
  name: string;
  short: string;
  /** Precio fijo del programa (no por jugador). */
  cost: number;
  /** Jugadores que entrenan a la vez en este programa. */
  maxPlayers: number;
  description: string;
  /** Texto corto para la ficha de la pantalla. */
  reward: string;
}

export const TRAINING_TIERS: Record<TrainingTier, TrainingTierInfo> = {
  progressive: {
    id: "progressive",
    name: "Entrenamiento Progresivo",
    short: "Progresivo",
    cost: 5_000_000,
    maxPlayers: 3,
    description: "El más barato y seguro. Mejora real pero chica, ideal para sumar de a poco en varios jugadores.",
    reward: "Hasta +3 GRL · potencial casi nunca sube",
  },
  intensive: {
    id: "intensive",
    name: "Entrenamiento Intensivo",
    short: "Intensivo",
    cost: 70_000_000,
    maxPlayers: 2,
    description:
      "Trabajo fuerte y equilibrado. Los jóvenes con GRL menor a 79 pueden ganar hasta +7; de 80 para arriba el tope es +3.",
    reward: "Jóvenes <79: hasta +7 GRL · 80+: hasta +3 GRL",
  },
  elite: {
    id: "elite",
    name: "Programa de Élite",
    short: "Élite",
    cost: 150_000_000,
    maxPlayers: 2,
    description:
      "El más potente y caro. Pensado para jóvenes con GRL bajo y potencial alto: en casos favorables hasta +15 GRL y, con suerte, supera parte de su potencial.",
    reward: "Jóvenes <70: hasta +15 GRL · puede subir el potencial",
  },
};

export const TRAINING_TIER_ORDER: TrainingTier[] = ["progressive", "intensive", "elite"];

export function tierInfo(t: TrainingTier): TrainingTierInfo {
  return TRAINING_TIERS[t] ?? TRAINING_TIERS.intensive;
}

// ───────────────────────── Tiempo ─────────────────────────

function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Días de juego entre dos fechas ISO. Si algo no cuadra (cambio de temporada) devuelve 7. */
export function daysBetween(from: string | undefined, to: string | undefined): number {
  if (!from || !to) return 7;
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a === null || b === null) return 7;
  const d = b - a;
  return d >= 0 && d <= 45 ? d : 7;
}

/** Días reales que hay entre la fecha de inicio y la misma fecha 6 meses después. */
export function sixMonthDays(startIso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startIso);
  if (!m) return TRAINING_DAYS;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const start = Date.UTC(y, mo, d);
  // Mismo día seis meses después; si el mes no tiene ese día (31 → 30/28) se usa el último.
  const target = new Date(Date.UTC(y, mo + TRAINING_MONTHS, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  const end = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay));
  return Math.round((end - start) / 86_400_000);
}

export function trainingDaysLeft(plan: TrainingPlan): number {
  return Math.max(0, Math.ceil(plan.totalDays - plan.elapsedDays));
}

export function trainingMonthsLeft(plan: TrainingPlan): number {
  return Math.max(1, Math.ceil(trainingDaysLeft(plan) / 30.4));
}

/** "4 meses y 12 días", "9 días"… para mostrar cuánto falta. */
export function trainingTimeLeftLabel(plan: TrainingPlan): string {
  const days = trainingDaysLeft(plan);
  if (days <= 0) return "termina en la próxima fecha";
  const months = Math.floor(days / 30.4);
  const rest = Math.max(0, Math.round(days - months * 30.4));
  const mTxt = months > 0 ? `${months} mes${months === 1 ? "" : "es"}` : "";
  const dTxt = rest > 0 ? `${rest} día${rest === 1 ? "" : "s"}` : "";
  return [mTxt, dTxt].filter(Boolean).join(" y ") || "1 día";
}

export function trainingProgress(plan: TrainingPlan): number {
  return clamp(plan.elapsedDays / Math.max(1, plan.totalDays), 0, 1);
}

// ───────────────────────── Inscripción ─────────────────────────

/** ¿Este jugador se puede inscribir en un ciclo? */
export function canTrain(p: Player, save: GameSave): boolean {
  return p.clubId === save.clubId && !p.loanFrom;
}

/** Id del plan en el que ya está inscripto un jugador (o null). */
export function planOfPlayer(save: GameSave, playerId: string): TrainingPlan | null {
  return (save.trainingPlans ?? []).find((pl) => pl.assignments.some((a) => a.playerId === playerId)) ?? null;
}

export function planOfTier(save: GameSave, tier: TrainingTier): TrainingPlan | null {
  return (save.trainingPlans ?? []).find((pl) => pl.tier === tier) ?? null;
}

export function validateTrainingStart(save: GameSave, tier: TrainingTier, playerIds: string[]): string | null {
  const info = TRAINING_TIERS[tier];
  if (!info) return "Nivel de entrenamiento inválido.";
  if (planOfTier(save, tier)) return `Ya hay un ${info.name} en marcha. Esperá a que termine.`;
  if (playerIds.length === 0) return "Elegí al menos un jugador.";
  if (playerIds.length > info.maxPlayers) {
    return `${info.name}: máximo ${info.maxPlayers} jugador${info.maxPlayers === 1 ? "" : "es"} a la vez.`;
  }
  if (new Set(playerIds).size !== playerIds.length) return "Un mismo jugador no puede estar dos veces.";
  for (const id of playerIds) {
    const p = save.players.find((x) => x.id === id);
    if (!p || !canTrain(p, save)) return "Elegí jugadores de tu plantilla.";
    if (planOfPlayer(save, id)) return `${p.name} ya está en otro entrenamiento.`;
  }
  if (save.budget < info.cost) return `No alcanza el presupuesto para el ${info.name}.`;
  return null;
}

/** Crea el plan y cobra el programa. Hay que validar antes con validateTrainingStart. */
export function startTrainingPlan(save: GameSave, tier: TrainingTier, playerIds: string[]): TrainingPlan {
  const info = TRAINING_TIERS[tier];
  const startDate = save.calendar[save.cursor]?.date ?? "";
  const plan: TrainingPlan = {
    id: uid("trp"),
    tier,
    cost: info.cost,
    assignments: playerIds.map((playerId) => ({ playerId })),
    startDate,
    elapsedDays: 0,
    totalDays: sixMonthDays(startDate),
  };
  save.budget -= info.cost;
  save.trainingPlans = [...(save.trainingPlans ?? []), plan];
  return plan;
}

// ───────────────────────── Resultado ─────────────────────────

/** Tope de GRL que se puede ganar en un ciclo según el nivel, la edad y el GRL actual. */
export function maxGainFor(tier: TrainingTier, age: number, ovr: number): number {
  if (tier === "progressive") {
    let cap = age <= 24 ? 3 : age <= 27 ? 2 : 1;
    if (ovr >= 85) cap = 1;
    else if (ovr >= 80) cap = Math.min(cap, 2);
    return cap;
  }
  if (tier === "intensive") {
    if (ovr >= 80) {
      let cap = age <= 27 ? 3 : age <= 31 ? 2 : 1;
      if (ovr >= 92) cap = 1;
      else if (ovr >= 88) cap = Math.min(cap, 2);
      return cap;
    }
    let cap = age <= 19 ? 7 : age <= 21 ? 6 : age <= 23 ? 5 : age <= 26 ? 4 : age <= 29 ? 3 : age <= 32 ? 2 : 1;
    if (ovr >= 79) cap = Math.min(cap, 4);
    else if (ovr >= 75) cap = Math.min(cap, 5);
    return cap;
  }
  // Élite: el tope baja de a poco con el GRL y también con la edad.
  const byOvr = ovr < 70 ? 15 : ovr < 75 ? 10 : ovr < 80 ? 7 : ovr < 85 ? 6 : ovr < 90 ? 4 : ovr < 95 ? 2 : 1;
  const ageFactor = age <= 19 ? 1 : age <= 21 ? 0.9 : age <= 23 ? 0.75 : age <= 26 ? 0.6 : age <= 29 ? 0.35 : 0.2;
  const eliteCap = Math.max(1, Math.round(byOvr * ageFactor));
  // El programa de élite nunca rinde menos que el intensivo para el mismo jugador.
  return Math.max(eliteCap, maxGainFor("intensive", age, ovr));
}

/** Cuánto aprovecha el entrenamiento según el margen que le queda hasta su potencial. */
function potentialFactor(tier: TrainingTier, room: number): number {
  if (tier === "elite") {
    return room >= 10 ? 1 : room >= 6 ? 0.9 : room >= 3 ? 0.75 : room >= 1 ? 0.6 : 0.4;
  }
  return room >= 12 ? 1 : room >= 8 ? 0.9 : room >= 5 ? 0.8 : room >= 3 ? 0.6 : room >= 1 ? 0.4 : 0.25;
}

/** Probabilidad de que el ciclo suba el potencial, y cuánto puede subirlo. */
export function potentialBumpOdds(tier: TrainingTier, age: number, pot: number): { chance: number; max: number } {
  let chance: number;
  let max: number;
  if (tier === "progressive") {
    chance = age <= 21 ? 0.03 : age <= 24 ? 0.015 : 0;
    max = 1;
  } else if (tier === "intensive") {
    chance = age <= 21 ? 0.08 : age <= 24 ? 0.04 : age <= 27 ? 0.01 : 0;
    max = 1;
  } else {
    chance = age <= 21 ? 0.24 : age <= 24 ? 0.13 : age <= 27 ? 0.05 : age <= 30 ? 0.01 : 0;
    max = age <= 21 ? 4 : age <= 24 ? 3 : 2;
  }
  // Cuanto más alto el potencial, más difícil superarlo.
  const brake = pot >= 93 ? 0.2 : pot >= 90 ? 0.35 : pot >= 85 ? 0.6 : pot >= 80 ? 0.85 : 1;
  return { chance: chance * brake, max: pot >= 90 ? Math.min(max, 2) : max };
}

/** Calidad del ciclo (0..1): un rango por nivel, con algo de suerte. */
function rollQuality(tier: TrainingTier, rng: Rng): number {
  const u = rng.float();
  if (tier === "progressive") return 0.4 + 0.6 * u;
  if (tier === "intensive") return 0.45 + 0.55 * u;
  return 0.5 + 0.5 * Math.pow(u, 1.4);
}

/** Decide cuánto sube el GRL y cuánto el potencial en un ciclo. Pura: no toca al jugador. */
export function rollTrainingOutcome(
  p: Pick<Player, "age" | "ovr" | "pot">,
  tier: TrainingTier,
  rng: Rng,
): { gain: number; potGain: number } {
  let potGain = 0;
  const odds = potentialBumpOdds(tier, p.age, p.pot);
  if (p.pot < 99 && odds.chance > 0 && rng.chance(odds.chance)) {
    potGain = rng.int(1, odds.max);
  }
  const pot = Math.min(99, p.pot + potGain);
  const room = Math.max(0, pot - p.ovr);

  const cap = maxGainFor(tier, p.age, p.ovr);
  const raw = cap * rollQuality(tier, rng) * potentialFactor(tier, room);
  let gain = Math.round(raw);
  // Un ciclo flojo en un jugador joven con margen casi siempre da al menos 1 punto.
  if (gain === 0 && room >= 2 && p.age <= 27 && rng.chance(0.7)) gain = 1;
  gain = clamp(gain, 0, cap);
  // Nunca pasa del potencial (el original o el recién ampliado).
  gain = Math.min(gain, room, 100 - p.ovr);
  return { gain, potGain: Math.max(0, pot - p.pot) };
}

/** Corre un ciclo completo sobre un jugador. Sube sus estadísticas, su GRL y, a veces, su potencial. */
export function runTrainingCycle(p: Player, tier: TrainingTier, rng: Rng): TrainingPlayerResult {
  // Aseguramos que las estadísticas den exactamente su GRL antes de empezar.
  syncStats(p);
  const ovrBefore = p.ovr;
  const potBefore = p.pot;
  const before = statSnapshot(p);

  const { gain, potGain } = rollTrainingOutcome(p, tier, rng);
  if (potGain > 0) p.pot = Math.min(100, p.pot + potGain);
  if (gain > 0) {
    p.ovr = clamp(p.ovr + gain, 40, 100);
    // Las estadísticas acompañan la nueva media (suben sobre todo las que más pesan en su posición).
    syncStats(p);
    p.ovr = ovrOf(p);
    // Lo ganado entrenando no cuenta contra el tope de crecimiento de la temporada.
    if (p.seasonStartOvr) p.seasonStartOvr += p.ovr - ovrBefore;
  }
  if (p.ovr > p.pot) p.pot = Math.min(100, p.ovr);
  p.value = playerValue(p.ovr, p.age, p.pot, p);

  const changes: TrainingStatChange[] = [];
  for (const stat of statKeysFor(p.pos)) {
    const b = before[stat] ?? 0;
    const a = getStat(p, stat);
    if (a !== b) changes.push({ stat, before: b, after: a, trained: a > b });
  }
  return {
    playerId: p.id,
    name: p.name,
    pos: p.pos,
    age: p.age,
    ovrBefore,
    ovrAfter: p.ovr,
    potBefore,
    potAfter: p.pot,
    brokePotential: p.pot > potBefore,
    changes,
  };
}

export function trainingPopup(report: TrainingReport): GamePopup {
  const names = report.results.map((r) => r.name).join(" y ");
  const net = report.results.reduce((s, r) => s + (r.ovrAfter - r.ovrBefore), 0);
  const info = tierInfo(report.tier);
  return {
    id: uid("pop"),
    kind: "info",
    tone: net > 0 ? "good" : "neutral",
    title: `${info.name} terminado`,
    body: `Pasaron los ${TRAINING_MONTHS} meses de trabajo de ${names}. Entrá a Entrenamiento para ver cómo quedaron.`,
  };
}

/** Termina un ciclo: aplica las mejoras, guarda el informe y avisa. */
export function finishTraining(save: GameSave, plan: TrainingPlan, rng: Rng, withPopup = true): TrainingReport {
  const results: TrainingPlayerResult[] = [];
  for (const a of plan.assignments) {
    const p = save.players.find((x) => x.id === a.playerId);
    const stillMine = p && (p.clubId === save.clubId || p.loanFrom === save.clubId);
    if (!p || !stillMine) {
      results.push({
        playerId: a.playerId,
        name: p?.name ?? "Jugador",
        pos: p?.pos ?? "CM",
        age: p?.age ?? 0,
        ovrBefore: p?.ovr ?? 0,
        ovrAfter: p?.ovr ?? 0,
        potBefore: p?.pot ?? 0,
        potAfter: p?.pot ?? 0,
        brokePotential: false,
        changes: [],
        left: true,
      });
      continue;
    }
    results.push(runTrainingCycle(p, plan.tier, rng));
  }
  const report: TrainingReport = {
    id: uid("tr"),
    tier: plan.tier,
    cost: plan.cost,
    season: save.season,
    endedWeek: save.week,
    results,
    seen: false,
  };
  save.trainingReports = [report, ...(save.trainingReports ?? [])].slice(0, MAX_REPORTS);
  save.trainingPlans = (save.trainingPlans ?? []).filter((x) => x.id !== plan.id);
  const info = tierInfo(plan.tier);
  if (withPopup) save.popups.push(trainingPopup(report));
  save.news.unshift({
    id: uid("n"),
    week: save.week,
    tone: "good",
    title: `Terminó el ${info.name}`,
    body: `${results.map((r) => r.name).join(" y ")} completaron su ciclo de ${TRAINING_MONTHS} meses.`,
  });
  return report;
}

/**
 * Hace correr el reloj de todos los ciclos en marcha. Devuelve los informes de los que terminaron
 * (vacío si no terminó ninguno).
 */
export function advanceTraining(save: GameSave, days: number, rng: Rng, withPopup = true): TrainingReport[] {
  const done: TrainingReport[] = [];
  const plans = [...(save.trainingPlans ?? [])];
  for (const plan of plans) {
    plan.elapsedDays += Math.max(0, days);
    if (plan.elapsedDays < plan.totalDays) continue;
    done.push(finishTraining(save, plan, rng, withPopup));
  }
  return done;
}
