import type { EventEffect } from "./event-effects";
import type { Rng } from "./rng";
import type { EventChoice, GameSave, Player, YouthPlayer } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
 * ESTRUCTURA DE DECISIONES
 *
 * Un suceso con decisión presenta 2 a 4 opciones. Cada opción declara:
 *   · stance   → qué tipo de postura es (pagar, castigar, apoyar...). Sirve para la interfaz y para auditar.
 *   · cost     → dinero que cuesta elegirla por adelantado. El motor exige tener esa caja y la descuenta solo.
 *   · requires → otro requisito; si no se cumple la opción aparece deshabilitada con el motivo.
 *   · apply    → qué pasa. Devuelve el resultado con sus consecuencias (EventEffect). Si la opción es
 *                arriesgada, usa `pickBranch` para que el mismo botón pueda terminar bien o mal.
 *
 * Convención: `apply` NO toca la partida directamente. Solo devuelve consecuencias; el motor las aplica
 * (así se respetan los topes y se puede auditar el balance sin efectos secundarios).
 *
 * Regla de diseño: no debe haber una opción claramente perfecta. `auditDecisionEvent` lo comprueba
 * midiendo el impacto esperado de cada opción en seis ejes y avisando si una domina a otra en todos.
 * ────────────────────────────────────────────────────────────────────────── */

export type DecisionStance =
  | "pay" // pagar dinero para solucionar el problema
  | "accept-sanction" // aceptar una sanción
  | "support" // apoyar al jugador
  | "punish" // castigar al jugador
  | "internal" // resolver el problema puertas adentro
  | "allow-absence" // dejar que el jugador se ausente
  | "reject-offer" // rechazar una oferta
  | "accept-offer" // aceptar una oferta
  | "performance" // priorizar el rendimiento deportivo
  | "wellbeing"; // priorizar el bienestar del jugador

export const STANCE_LABEL: Record<DecisionStance, string> = {
  pay: "Pagar",
  "accept-sanction": "Aceptar sanción",
  support: "Apoyar",
  punish: "Castigar",
  internal: "Puertas adentro",
  "allow-absence": "Permitir ausencia",
  "reject-offer": "Rechazar oferta",
  "accept-offer": "Aceptar oferta",
  performance: "Rendimiento",
  wellbeing: "Bienestar",
};

export const DECISION_STANCES = Object.keys(STANCE_LABEL) as DecisionStance[];

export type DecisionResult = {
  tone: "good" | "bad" | "neutral";
  title: string;
  body: string;
  prize?: number;
  /** Consecuencias de la opción elegida (se aplican al resolverla). */
  effects?: EventEffect[];
};

export type DecisionOption = {
  id: string;
  label: string;
  /** Pista que ve el usuario antes de elegir: orienta sin revelar el resultado. */
  hint?: string;
  stance: DecisionStance;
  /** Dinero que cuesta elegir esta opción (se exige tener la caja y se descuenta sola). */
  cost?: (save: GameSave, player?: Player) => number;
  /** Requisito extra. Devuelve el motivo por el que no se puede elegir, o null si se puede. */
  requires?: (save: GameSave, player?: Player) => string | null;
  /** Qué pasa al elegirla. `player` / `youth` pueden faltar si ya no están en el club. */
  apply: (save: GameSave, rng: Rng, player?: Player, youth?: YouthPlayer) => DecisionResult;
};

/** Un desenlace posible de una opción arriesgada. `chance` es un peso relativo. */
export type DecisionBranch = { chance: number; result: DecisionResult };

/** Elige un desenlace según su peso. Con una sola rama devuelve esa. */
export function pickBranch(rng: Rng, branches: DecisionBranch[]): DecisionResult {
  const live = branches.filter((b) => b.chance > 0);
  const total = live.reduce((s, b) => s + b.chance, 0);
  if (!live.length || total <= 0) return branches[0]!.result;
  let roll = rng.float() * total;
  for (const b of live) {
    roll -= b.chance;
    if (roll <= 0) return b.result;
  }
  return live[live.length - 1]!.result;
}

/* ── Escala económica ─────────────────────────────────────────────────── */

/** Masa salarial semanal del club del usuario (referencia para dimensionar montos). */
export function weeklyWageBill(save: GameSave): number {
  return save.players.filter((p) => p.clubId === save.clubId).reduce((s, p) => s + p.wage, 0);
}

/**
 * Monto proporcional al tamaño del club: `weeks` semanas de masa salarial, redondeado a 10 mil y con piso.
 * Así una multa pesa parecido en un club chico que en uno grande.
 */
export function scaledMoney(save: GameSave, weeks: number, floor = 100_000): number {
  const raw = weeklyWageBill(save) * weeks;
  return Math.max(floor, Math.round(raw / 10_000) * 10_000);
}

/* ── Disponibilidad de las opciones ───────────────────────────────────── */

export function optionCost(option: DecisionOption, save: GameSave, player?: Player): number {
  return Math.max(0, Math.round(option.cost?.(save, player) ?? 0));
}

/** Motivo por el que la opción no se puede elegir ahora, o null si se puede. */
export function optionBlockedReason(option: DecisionOption, save: GameSave, player?: Player): string | null {
  const cost = optionCost(option, save, player);
  if (cost > 0 && save.budget < cost) return "Caja insuficiente";
  return option.requires?.(save, player) ?? null;
}

/** Las opciones tal como se muestran en el aviso (con costo y, si corresponde, el motivo del bloqueo). */
export function describeChoices(options: DecisionOption[], save: GameSave, player?: Player): EventChoice[] {
  return options.map((o) => {
    const reason = optionBlockedReason(o, save, player);
    const cost = optionCost(o, save, player);
    return {
      id: o.id,
      label: o.label,
      hint: o.hint,
      stance: o.stance,
      cost: cost > 0 ? cost : undefined,
      disabled: reason ? true : undefined,
      reason: reason ?? undefined,
    };
  });
}

/** Una decisión sin ninguna opción elegible dejaría la partida trabada: no debe salir. */
export function hasSelectableOption(options: DecisionOption[], save: GameSave, player?: Player): boolean {
  return options.some((o) => !optionBlockedReason(o, save, player));
}

/** Ejecuta la opción y agrega, al frente, el descuento de su costo. */
export function runDecisionOption(
  option: DecisionOption,
  save: GameSave,
  rng: Rng,
  player?: Player,
  youth?: YouthPlayer,
): DecisionResult {
  const result = option.apply(save, rng, player, youth);
  const cost = optionCost(option, save, player);
  if (!cost) return result;
  return { ...result, effects: [{ kind: "money", amount: -cost }, ...(result.effects ?? [])] };
}

/* ── Auditoría de balance ─────────────────────────────────────────────── */

/** Impacto de una opción en seis ejes (más alto = mejor para ese eje). */
export type DecisionImpact = {
  /** Caja del club, en euros. */
  money: number;
  /** Ánimo y relación con el club del jugador protagonista. */
  player: number;
  /** Clima del vestuario: ánimo del plantel, relación con compañeros, preparación. */
  squad: number;
  /** Rendimiento deportivo: GRL, forma, estado físico, disponibilidad. */
  sport: number;
  /** Valor de mercado del jugador (variación porcentual). */
  assets: number;
  /** Confianza de la dirigencia y prestigio. */
  institution: number;
};

export const IMPACT_AXES: Array<keyof DecisionImpact> = ["money", "player", "squad", "sport", "assets", "institution"];

export const AXIS_LABEL: Record<keyof DecisionImpact, string> = {
  money: "Dinero",
  player: "Jugador",
  squad: "Vestuario",
  sport: "Deporte",
  assets: "Valor",
  institution: "Dirigencia",
};

export function emptyImpact(): DecisionImpact {
  return { money: 0, player: 0, squad: 0, sport: 0, assets: 0, institution: 0 };
}

/** Traduce una lista de consecuencias a impacto por eje (sin aplicarlas a ninguna partida). */
export function impactOf(effects: EventEffect[] | undefined, prize = 0): DecisionImpact {
  const out = emptyImpact();
  out.money += prize;
  for (const fx of effects ?? []) {
    switch (fx.kind) {
      case "money":
        out.money += fx.amount;
        break;
      case "morale":
        if (fx.target === "squad") out.squad += fx.delta;
        else out.player += fx.delta;
        break;
      case "fitness":
        out.sport += (fx.target === "squad" ? 3 : 1) * (fx.delta / 5);
        break;
      case "form":
        out.sport += (fx.target === "squad" ? 3 : 1) * fx.delta * 2;
        break;
      case "ovr":
        out.sport += fx.delta * 6;
        out.assets += fx.delta * 4;
        break;
      case "injury":
      case "illness":
      case "absence":
        out.sport -= fx.games * 3;
        break;
      case "value":
        out.assets += fx.pct * Math.min(1, fx.games / 5);
        break;
      case "clubBond":
        out.player += fx.delta;
        break;
      case "squadBond":
        out.squad += fx.delta;
        break;
      case "board":
        out.institution += fx.delta * 4;
        break;
      case "prestige":
        out.institution += fx.delta * 5;
        break;
      case "teamBoost":
        out.sport += fx.rating * Math.min(fx.games, 10) * 6;
        out.squad += fx.rating * 4;
        break;
      case "leaveSquad":
        out.sport -= 10;
        out.assets -= 6;
        out.squad -= 2;
        break;
      case "addYouth":
        out.sport += 2 + Math.max(0, fx.youth.pot - 80) * 0.15;
        out.institution += fx.youth.fee === 0 ? 1 : 0.4;
        break;
      case "removeYouth":
        out.sport -= 1.5;
        out.assets -= 1;
        break;
      case "youthDev":
        out.sport += (fx.potDelta ?? 0) * 1.2 + (fx.ovrDelta ?? 0);
        break;
      case "listed":
        out.assets += fx.listed ? -2 : 1;
        out.player += fx.listed ? -2 : 2;
        break;
      case "wage":
        out.money -= fx.delta * 20;
        out.player += fx.delta > 0 ? 3 : -3;
        break;
      case "incomingOffer":
        out.assets += 3;
        out.institution += 1;
        break;
    }
  }
  return out;
}

function addImpact(a: DecisionImpact, b: DecisionImpact, k = 1) {
  for (const axis of IMPACT_AXES) a[axis] += b[axis] * k;
}

/** Tolerancia por eje para considerar que dos impactos son "iguales". El dinero usa una tolerancia relativa. */
const AXIS_EPS: DecisionImpact = { money: 0, player: 1.5, squad: 1.5, sport: 1.5, assets: 1, institution: 1 };

function axisEps(axis: keyof DecisionImpact, a: number, b: number): number {
  if (axis !== "money") return AXIS_EPS[axis];
  return Math.max(20_000, 0.05 * Math.max(Math.abs(a), Math.abs(b)));
}

/** ¿`a` es mejor o igual que `b` en todos los ejes y claramente mejor en alguno? */
export function dominates(a: DecisionImpact, b: DecisionImpact): boolean {
  let better = false;
  for (const axis of IMPACT_AXES) {
    const eps = axisEps(axis, a[axis], b[axis]);
    if (a[axis] < b[axis] - eps) return false;
    if (a[axis] > b[axis] + eps) better = true;
  }
  return better;
}

export type OptionAudit = {
  id: string;
  stance: DecisionStance;
  /** Impacto esperado (promedio de muchas tiradas). */
  expected: DecisionImpact;
  /** Peor y mejor desenlace observados en el eje del jugador + dirigencia + dinero (para ver el riesgo). */
  spread: { worst: number; best: number };
};

export type DecisionAudit = {
  eventId: string;
  ok: boolean;
  problems: string[];
  options: OptionAudit[];
};

export type AuditableDecision = {
  id: string;
  options: DecisionOption[];
};

/**
 * Revisa una decisión: estructura mínima, opciones siempre disponibles, `apply` sin efectos secundarios y,
 * sobre todo, que ninguna opción domine a otra. Pensada para correr en pruebas con una partida de ejemplo.
 */
export function auditDecisionEvent(
  def: AuditableDecision,
  save: GameSave,
  player: Player | undefined,
  makeRng: (seed: number) => Rng,
  samples = 300,
): DecisionAudit {
  const problems: string[] = [];
  const options: OptionAudit[] = [];

  if (def.options.length < 2) problems.push("Tiene menos de 2 opciones.");
  if (def.options.length > 4) problems.push("Tiene más de 4 opciones (no entran bien en pantalla).");
  const ids = new Set(def.options.map((o) => o.id));
  if (ids.size !== def.options.length) problems.push("Hay ids de opción repetidos.");
  if (new Set(def.options.map((o) => o.stance)).size < 2) problems.push("Todas las opciones tienen la misma postura.");
  if (!def.options.some((o) => !o.cost && !o.requires)) {
    problems.push("Ninguna opción está siempre disponible: con la caja vacía la decisión quedaría trabada.");
  }

  const snapshot = () => JSON.stringify({ budget: save.budget, player: player ?? null, board: save.board?.confidence });

  for (const option of def.options) {
    if (!option.label.trim()) problems.push(`La opción ${option.id} no tiene texto.`);
    if (!option.hint?.trim()) problems.push(`La opción ${option.id} no tiene pista para el usuario.`);
    const before = snapshot();
    const sum = emptyImpact();
    let worst = Infinity;
    let best = -Infinity;
    for (let i = 0; i < samples; i++) {
      const result = option.apply(save, makeRng(7_919 * (i + 1)), player, save.academy[0]);
      if (!result.title.trim() || !result.body.trim()) problems.push(`La opción ${option.id} devuelve un resultado sin texto.`);
      for (const fx of result.effects ?? []) {
        for (const v of Object.values(fx)) {
          if (typeof v === "number" && !Number.isFinite(v)) problems.push(`La opción ${option.id} tiene un efecto con número inválido.`);
        }
      }
      const imp = impactOf(result.effects, result.prize);
      imp.money -= optionCost(option, save, player);
      addImpact(sum, imp, 1 / samples);
      const flat = imp.money / 200_000 + imp.player + imp.squad + imp.sport + imp.assets + imp.institution;
      worst = Math.min(worst, flat);
      best = Math.max(best, flat);
    }
    if (snapshot() !== before) problems.push(`La opción ${option.id} modifica la partida dentro de apply (debe devolver efectos).`);
    options.push({ id: option.id, stance: option.stance, expected: sum, spread: { worst, best } });
  }

  for (const a of options) {
    for (const b of options) {
      if (a !== b && dominates(a.expected, b.expected)) {
        problems.push(`La opción "${a.id}" es mejor que "${b.id}" en todos los ejes: no hay dilema real.`);
      }
    }
  }

  return { eventId: def.id, ok: problems.length === 0, problems, options };
}
