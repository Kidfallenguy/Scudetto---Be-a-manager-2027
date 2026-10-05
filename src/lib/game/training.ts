import { clamp, playerValue, uid } from "./format";
import { Rng } from "./rng";
import { getStat, ovrOf, setStat, statKeysFor, statSnapshot, syncStats } from "./stats";
import type {
  GameSave,
  GamePopup,
  Player,
  TrainStat,
  TrainingAssignment,
  TrainingPlan,
  TrainingPlayerResult,
  TrainingReport,
  TrainingStatChange,
} from "./types";

/** Un ciclo de entrenamiento dura 6 meses de tiempo de juego. */
export const TRAINING_MONTHS = 6;
export const TRAINING_DAYS = 182;
/** Jugadores que se pueden entrenar a la vez. */
export const MAX_TRAINED_PLAYERS = 2;
/** Estadísticas que se pueden elegir por jugador. */
export const MAX_STATS_PER_PLAYER = 3;
/** Días entre el último partido de una temporada y el primero de la siguiente. */
export const OFFSEASON_DAYS = 75;

/** Estadísticas físicas: son las primeras que se pierden con los años. */
const PHYSICAL: TrainStat[] = ["pac", "phy", "spe", "ref", "div"];

function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Días de juego entre dos fechas ISO. Si algo no cuadra (cambio de temporada) devuelve 7. */
export function daysBetween(from?: string, to?: string): number {
  if (!from || !to) return 7;
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a === null || b === null) return 7;
  const d = b - a;
  return d >= 0 && d <= 45 ? d : 7;
}

export function trainingMonthsLeft(plan: TrainingPlan): number {
  return Math.max(1, Math.ceil((plan.totalDays - plan.elapsedDays) / 30.4));
}

export function trainingProgress(plan: TrainingPlan): number {
  return clamp(plan.elapsedDays / plan.totalDays, 0, 1);
}

/** ¿Este jugador se puede inscribir en un ciclo? */
export function canTrain(p: Player, save: Pick<GameSave, "clubId">): boolean {
  return p.clubId === save.clubId && !p.loanFrom;
}

export function validateAssignments(
  save: GameSave,
  assignments: TrainingAssignment[],
): string | null {
  if (save.trainingPlan) return "Ya hay un entrenamiento en marcha. Esperá a que termine.";
  if (assignments.length === 0) return "Elegí al menos un jugador.";
  if (assignments.length > MAX_TRAINED_PLAYERS) {
    return `Solo se pueden entrenar ${MAX_TRAINED_PLAYERS} jugadores a la vez.`;
  }
  const seen = new Set<string>();
  for (const a of assignments) {
    if (seen.has(a.playerId)) return "Un mismo jugador no puede estar dos veces.";
    seen.add(a.playerId);
    const p = save.players.find((x) => x.id === a.playerId);
    if (!p || !canTrain(p, save)) return "Elegí jugadores de tu plantilla.";
    if (a.stats.length === 0) return `Elegí al menos una estadística para ${p.name}.`;
    if (a.stats.length > MAX_STATS_PER_PLAYER) {
      return `${p.name}: máximo ${MAX_STATS_PER_PLAYER} estadísticas.`;
    }
    const valid = new Set(statKeysFor(p.pos));
    if (new Set(a.stats).size !== a.stats.length || a.stats.some((s) => !valid.has(s))) {
      return `Estadísticas inválidas para ${p.name}.`;
    }
  }
  return null;
}

export function makePlan(save: GameSave, assignments: TrainingAssignment[]): TrainingPlan {
  return {
    assignments: assignments.map((a) => ({ playerId: a.playerId, stats: [...a.stats] })),
    startDate: save.calendar[save.cursor]?.date ?? "",
    elapsedDays: 0,
    totalDays: TRAINING_DAYS,
  };
}

/** Cuántos puntos sube una estadística entrenada durante el ciclo. */
function rollGain(p: Player, current: number, focusCount: number, rng: Rng): number {
  let lo: number;
  let hi: number;
  if (p.age <= 19) [lo, hi] = [2, 4];
  else if (p.age <= 21) [lo, hi] = [1, 4];
  else if (p.age <= 24) [lo, hi] = [1, 3];
  else if (p.age <= 27) [lo, hi] = [0, 2];
  else [lo, hi] = [0, 1];
  let gain = rng.int(lo, hi);
  // Concentrarse en pocas estadísticas rinde más.
  if (focusCount === 1 && p.age <= 29) gain += 1;
  else if (focusCount === 2 && p.age <= 29 && rng.chance(0.5)) gain += 1;
  // Si queda poco margen hasta el potencial, cuesta más.
  const room = p.pot - p.ovr;
  if (room <= 1) gain = Math.floor(gain / 2);
  else if (room >= 10 && rng.chance(0.3)) gain += 1;
  // Cuanto más alta la estadística, más cuesta subirla.
  if (current >= 92) gain -= 2;
  else if (current >= 86) gain -= 1;
  // Ciclos flojos: a veces no pasa nada.
  if (rng.chance(0.1)) gain = Math.min(gain, 1);
  return clamp(gain, 0, 6);
}

/** Pérdida por edad de las estadísticas que NO se entrenaron en el ciclo. */
function rollDecay(p: Player, stat: TrainStat, rng: Rng): number {
  if (p.age < 30) return 0;
  const physical = PHYSICAL.includes(stat);
  let chance = p.age >= 34 ? 0.55 : p.age >= 32 ? 0.4 : p.age >= 30 ? 0.22 : 0;
  if (!physical) chance *= 0.5;
  if (!rng.chance(chance)) return 0;
  return p.age >= 35 && physical && rng.chance(0.4) ? 2 : 1;
}

/**
 * Corre un ciclo completo de 6 meses sobre un jugador. Cambia sus estadísticas, su GRL y,
 * si corresponde, rompe el potencial. Devuelve el resumen para el cartel.
 */
export function runTrainingCycle(p: Player, trained: TrainStat[], rng: Rng): TrainingPlayerResult {
  // Aseguramos que las estadísticas den exactamente su GRL antes de empezar.
  syncStats(p);
  const ovrBefore = p.ovr;
  const potBefore = p.pot;
  const before = statSnapshot(p);

  // 1) Mejoras en lo entrenado.
  for (const stat of trained) {
    const cur = getStat(p, stat);
    setStat(p, stat, cur + rollGain(p, cur, trained.length, rng));
  }
  // 2) Desgaste por edad en el resto.
  for (const stat of statKeysFor(p.pos)) {
    if (trained.includes(stat)) continue;
    const loss = rollDecay(p, stat, rng);
    if (loss) setStat(p, stat, getStat(p, stat) - loss);
  }

  // 3) ¿Rompe el potencial?
  let broke = false;
  if (ovrOf(p) > p.pot) {
    const base = p.age <= 21 ? 0.35 : p.age <= 24 ? 0.25 : p.age <= 28 ? 0.12 : 0.04;
    const brake = p.pot >= 90 ? 0.5 : p.pot >= 82 ? 0.8 : 1;
    if (rng.chance(base * brake)) {
      broke = true;
    } else {
      // No rompe: se recortan las mejoras hasta quedar en su potencial.
      for (let i = 0; i < 80 && ovrOf(p) > p.pot; i++) {
        const lifted = trained
          .map((s) => ({ s, d: getStat(p, s) - (before[s] ?? 0) }))
          .filter((x) => x.d > 0)
          .sort((a, b) => b.d - a.d)[0];
        if (!lifted) break;
        setStat(p, lifted.s, getStat(p, lifted.s) - 1);
      }
    }
  }

  p.ovr = ovrOf(p);
  if (p.ovr > p.pot) {
    broke = true;
    p.pot = Math.min(100, p.ovr);
  }
  p.value = playerValue(p.ovr, p.age, p.pot, p);

  const changes: TrainingStatChange[] = [];
  for (const stat of statKeysFor(p.pos)) {
    const b = before[stat] ?? 0;
    const a = getStat(p, stat);
    const isTrained = trained.includes(stat);
    if (isTrained || a !== b) changes.push({ stat, before: b, after: a, trained: isTrained });
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
    brokePotential: broke && p.pot > potBefore,
    changes,
  };
}

export function trainingPopup(report: TrainingReport): GamePopup {
  const names = report.results.map((r) => r.name).join(" y ");
  const net = report.results.reduce((s, r) => s + (r.ovrAfter - r.ovrBefore), 0);
  return {
    id: uid("pop"),
    kind: "info",
    tone: net > 0 ? "good" : net < 0 ? "bad" : "neutral",
    title: "Entrenamiento terminado",
    body: `Pasaron los ${TRAINING_MONTHS} meses de trabajo de ${names}. Entrá a Entrenamiento para ver cómo quedaron.`,
  };
}

/** Termina el ciclo: aplica los cambios, guarda el informe y avisa. */
export function finishTraining(save: GameSave, rng: Rng, withPopup = true) {
  const plan = save.trainingPlan;
  if (!plan) return;
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
    results.push(runTrainingCycle(p, a.stats, rng));
  }
  const report: TrainingReport = {
    id: uid("tr"),
    season: save.season,
    endedWeek: save.week,
    results,
    seen: false,
  };
  save.trainingReport = report;
  save.trainingPlan = null;
  if (withPopup) save.popups.push(trainingPopup(report));
  save.news.unshift({
    id: uid("n"),
    week: save.week,
    tone: "good",
    title: "Terminó el entrenamiento",
    body: `${results.map((r) => r.name).join(" y ")} completaron su ciclo de ${TRAINING_MONTHS} meses.`,
  });
}

/** Hace correr el reloj del ciclo. Devuelve true si el ciclo terminó. */
export function advanceTraining(save: GameSave, days: number, rng: Rng, withPopup = true): boolean {
  const plan = save.trainingPlan;
  if (!plan) return false;
  plan.elapsedDays += Math.max(0, days);
  if (plan.elapsedDays < plan.totalDays) return false;
  finishTraining(save, rng, withPopup);
  return true;
}
