import { ACADEMY_MAX } from "./academy";
import { adjustBoardConfidence } from "./board";
import { clubById } from "./clubs";
import { clamp, formatMoney, uid } from "./format";
import { normalizePos } from "./positions";
import { isOwnedAtClub } from "./squad-rules";
import { setOvrAndSync } from "./stats";
import { dropFromLineup, isUnavailable, sanitizeBench } from "./tactics";
import type { AbsenceKind, GameSave, Player, SquadDeparture, TeamModifier, TransferOffer, YouthPlayer } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
 * CONSECUENCIAS DE LOS SUCESOS
 *
 * Un suceso describe sus consecuencias como una lista de `EventEffect` y las aplica con
 * `applyEventEffects`. Así cada situación nueva solo declara QUÉ pasa; el motor se ocupa de
 * CÓMO (topes, indisponibilidad real, banquillo, historial de la dirigencia) y devuelve las
 * líneas ya redactadas para mostrar en el aviso.
 *
 * Consecuencias disponibles (todas opcionales y combinables):
 *   morale · fitness · form · ovr · injury · illness · absence · money · value ·
 *   clubBond · squadBond · board · prestige · teamBoost · leaveSquad ·
 *   addYouth · removeYouth · youthDev · listed · wage · incomingOffer
 *
 * No todo suceso necesita consecuencias grandes: un suceso solo narrativo no declara ninguna.
 * ────────────────────────────────────────────────────────────────────────── */

/** A quién afecta un efecto: un jugador concreto o todo el plantel del usuario. */
export type EffectTarget = Player | "squad";

export type EventEffect =
  /** Ánimo / moral (0-100). */
  | { kind: "morale"; target: EffectTarget; delta: number }
  /** Estado físico (0-100). */
  | { kind: "fitness"; target: EffectTarget; delta: number }
  /** Forma (-5 a 5). */
  | { kind: "form"; target: EffectTarget; delta: number }
  /** GRL del jugador (las estadísticas lo acompañan). */
  | { kind: "ovr"; target: Player; delta: number }
  /** Lesión: el jugador queda fuera esa cantidad de partidos. */
  | { kind: "injury"; target: Player; games: number }
  /** Enfermedad: el jugador queda fuera esa cantidad de partidos. */
  | { kind: "illness"; target: Player; games: number; reason?: string }
  /** Ausencia por otro motivo (personal, disciplina...). */
  | { kind: "absence"; target: Player; games: number; reason: string; absenceKind?: Exclude<AbsenceKind, "illness"> }
  /** Dinero del club (positivo entra, negativo sale). */
  | { kind: "money"; amount: number }
  /** Valor de mercado del jugador, en %, por una cantidad de partidos. */
  | { kind: "value"; target: Player; pct: number; games: number }
  /** Relación del jugador con el club. */
  | { kind: "clubBond"; target: Player; delta: number }
  /** Relación del jugador con sus compañeros. */
  | { kind: "squadBond"; target: Player; delta: number }
  /** Confianza de la dirigencia (0-100). */
  | { kind: "board"; delta: number; reason?: string }
  /** Prestigio del club (puntos, con tope). */
  | { kind: "prestige"; delta: number }
  /** Preparación / ambiente: suma o resta puntos de GRL de equipo durante unos partidos. */
  | { kind: "teamBoost"; rating: number; games: number; label: string }
  /**
   * El jugador deja la plantilla masculina para siempre (no es venta, cesión ni retiro). Sale de la partida,
   * se limpian alineación, ofertas y entrenamiento, y queda anotado en `events.departures`.
   * El dinero que reciba el club se declara aparte con un efecto `money`.
   */
  | { kind: "leaveSquad"; target: Player; eventId: string; compensation?: number }
  /** Suma un juvenil a la cantera (si hay lugar). */
  | { kind: "addYouth"; youth: YouthPlayer }
  /** Saca un juvenil de la cantera (venta de derechos, marcha...). */
  | { kind: "removeYouth"; youthId: string }
  /** Cambia GRL / potencial / ficha de un juvenil de cantera. */
  | { kind: "youthDev"; youthId: string; ovrDelta?: number; potDelta?: number; fee?: number }
  /** Pone o saca al jugador de la lista de transferibles. */
  | { kind: "listed"; target: Player; listed: boolean }
  /** Cambia el salario semanal del jugador (puede ser negativo). */
  | { kind: "wage"; target: Player; delta: number }
  /** Crea una oferta de compra no solicitada por el jugador. */
  | { kind: "incomingOffer"; target: Player; fromClubId: string; fee: number };

export const EFFECT_LIMITS = {
  /** Tope de prestigio que pueden sumar o restar los sucesos en total. */
  prestige: 10,
  /** Cambio máximo de GRL por un solo suceso. */
  maxOvrStep: 3,
  /** Partidos máximos de baja que puede imponer un suceso. */
  maxAbsence: 12,
  /** Tope del ajuste de GRL de equipo que se acumula (suma de todos los modificadores). */
  teamBoost: 3,
  /** Relación normal cuando no hay dato. */
  neutralBond: 70,
} as const;

const KIND_LABEL: Record<AbsenceKind, string> = {
  illness: "Enfermedad",
  personal: "Motivos personales",
  discipline: "Decisión disciplinaria",
  other: "Ausencia",
};

export type EffectReport = {
  /** Una línea por consecuencia real (las que no cambian nada no se muestran). */
  lines: string[];
  /** Dinero que entró (+) o salió (−). */
  money: number;
};

/* ── Utilidades ───────────────────────────────────────────────────────── */

function userSquad(save: GameSave): Player[] {
  return save.players.filter((p) => p.clubId === save.clubId && !p.loanFrom);
}

function targets(save: GameSave, target: EffectTarget): Player[] {
  return target === "squad" ? userSquad(save) : [target];
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0";
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Referencia al jugador "vivo" dentro de la partida (los sucesos pueden recibir una copia). */
function live(save: GameSave, p: Player): Player | undefined {
  return save.players.find((x) => x.id === p.id);
}

/**
 * Si el jugador quedó no disponible y estaba en el banquillo, sale y entra el mejor disponible (el banco no se achica).
 * Si es del once, se queda marcado como baja: la pantalla del partido obliga a reemplazarlo antes de jugar.
 */
function keepBenchClean(save: GameSave, p: Player) {
  if (!isUnavailable(p) || !save.tactics.bench.includes(p.id)) return;
  const squad = save.players.filter((x) => x.clubId === save.clubId);
  save.tactics.bench = sanitizeBench(save.tactics.bench, save.tactics.lineup, squad);
}

/* ── Relaciones ───────────────────────────────────────────────────────── */

export function clubBondOf(p: Player): number {
  return p.bond?.club ?? EFFECT_LIMITS.neutralBond;
}

export function squadBondOf(p: Player): number {
  return p.bond?.squad ?? EFFECT_LIMITS.neutralBond;
}

function setBond(p: Player, key: "club" | "squad", value: number) {
  const next = { club: clubBondOf(p), squad: squadBondOf(p) };
  next[key] = clamp(Math.round(value), 0, 100);
  // Si volvió a lo normal no hace falta guardar nada.
  p.bond = next.club === EFFECT_LIMITS.neutralBond && next.squad === EFFECT_LIMITS.neutralBond ? undefined : next;
}

export function bondLabel(value: number): string {
  if (value >= 85) return "Excelente";
  if (value >= 65) return "Buena";
  if (value >= 45) return "Regular";
  if (value >= 25) return "Mala";
  return "Rota";
}

/* ── Disponibilidad ───────────────────────────────────────────────────── */

/**
 * Deja al jugador fuera `games` partidos. Si ya estaba fuera por el mismo motivo se queda con el plazo más
 * largo (los plazos no se acumulan ni se acortan). Devuelve los partidos que quedaron.
 */
export function makeUnavailable(
  save: GameSave,
  player: Player,
  kind: "injury" | AbsenceKind,
  games: number,
  reason?: string,
): number {
  const p = live(save, player) ?? player;
  const n = clamp(Math.round(games), 1, EFFECT_LIMITS.maxAbsence);
  if (kind === "injury") {
    p.injured = Math.max(p.injured, n);
    p.fitness = Math.min(p.fitness, 55);
  } else {
    const current = p.absence;
    if (!current || current.games < n) {
      p.absence = { games: n, kind, reason: reason?.trim() || KIND_LABEL[kind] };
    }
  }
  keepBenchClean(save, p);
  return kind === "injury" ? p.injured : (p.absence?.games ?? n);
}

/* ── Salida del plantel ───────────────────────────────────────────────── */

/** Saca al jugador de la partida y limpia todo lo que lo nombraba. Devuelve false si ya no está en el club. */
function removeFromSquad(save: GameSave, p: Player, eventId: string, compensation: number): boolean {
  if (p.clubId !== save.clubId || p.loanFrom) return false;
  const st = save.events;
  const record: SquadDeparture = {
    playerId: p.id,
    name: p.name,
    pos: p.pos,
    ovr: p.ovr,
    age: p.age,
    eventId,
    season: save.season,
    week: save.week,
    compensation: Math.max(0, Math.round(compensation)),
  };
  if (st) st.departures = [record, ...(st.departures ?? [])];

  save.players = save.players.filter((x) => x.id !== p.id);
  save.offers = save.offers.filter((o) => o.playerId !== p.id);
  save.loans = save.loans.filter((l) => l.playerId !== p.id);
  for (const plan of save.trainingPlans ?? []) {
    plan.assignments = plan.assignments.filter((a) => a.playerId !== p.id);
  }
  const squad = save.players.filter((x) => x.clubId === save.clubId && !x.loanFrom);
  save.tactics.lineup = dropFromLineup(save.tactics.lineup, save.tactics.formation, p.id, squad);
  save.tactics.bench = sanitizeBench(save.tactics.bench, save.tactics.lineup, squad);
  return true;
}

/* ── Preparación del equipo ───────────────────────────────────────────── */

/** Puntos de GRL de equipo que suman los sucesos activos (con tope), para los próximos partidos. */
export function teamBoostOf(save: GameSave): number {
  const total = (save.events?.modifiers ?? []).reduce((s, m) => (m.games > 0 ? s + m.rating : s), 0);
  return clamp(total, -EFFECT_LIMITS.teamBoost, EFFECT_LIMITS.teamBoost);
}

/**
 * Ambiente del plantel: los titulares enemistados con el grupo restan, los muy integrados suman un poco.
 * Es el efecto real que tiene la relación entre jugadores sobre el partido.
 */
export function chemistryBoostOf(save: GameSave, lineup: string[] = save.tactics.lineup): number {
  let sum = 0;
  for (const id of lineup) {
    const p = save.players.find((x) => x.id === id);
    if (!p || p.clubId !== save.clubId) continue;
    const b = squadBondOf(p);
    if (b < 35) sum -= 0.25;
    else if (b >= 85) sum += 0.1;
  }
  return clamp(sum, -1.5, 0.5);
}

/** Todo lo que suma o resta al GRL de equipo del usuario en el próximo partido. */
export function userMatchBoost(save: GameSave): number {
  return Math.round((teamBoostOf(save) + chemistryBoostOf(save)) * 100) / 100;
}

/* ── Aplicación ───────────────────────────────────────────────────────── */

/**
 * Aplica las consecuencias y devuelve las líneas redactadas. Cada efecto respeta sus topes, así que
 * ninguna combinación puede dejar valores fuera de rango. Un efecto que no cambia nada no genera línea.
 */
export function applyEventEffects(save: GameSave, effects: EventEffect[] | undefined): EffectReport {
  const report: EffectReport = { lines: [], money: 0 };
  if (!effects?.length) return report;
  const st = save.events;

  for (const fx of effects) {
    switch (fx.kind) {
      case "morale":
      case "fitness":
      case "form": {
        const key = fx.kind;
        const list = targets(save, fx.target).map((p) => live(save, p) ?? p);
        const [lo, hi] = key === "form" ? [-5, 5] : key === "morale" ? [20, 100] : [30, 100];
        let changed = 0;
        let lastDelta = 0;
        for (const p of list) {
          const before = p[key];
          const after = clamp(Math.round(before + fx.delta), lo, hi);
          if (after === before) continue;
          p[key] = after;
          changed += 1;
          lastDelta = after - before;
        }
        if (!changed) break;
        const what = key === "morale" ? "Ánimo" : key === "fitness" ? "Estado físico" : "Forma";
        report.lines.push(
          fx.target === "squad"
            ? `${what} del plantel ${signed(Math.round(fx.delta))}`
            : `${what} de ${fx.target.name} ${signed(lastDelta)}`,
        );
        break;
      }
      case "ovr": {
        const p = live(save, fx.target) ?? fx.target;
        const step = clamp(Math.round(fx.delta), -EFFECT_LIMITS.maxOvrStep, EFFECT_LIMITS.maxOvrStep);
        if (!step) break;
        const before = p.ovr;
        setOvrAndSync(p, before + step);
        // Subir de GRL nunca deja el potencial por debajo de la media.
        if (p.ovr > p.pot) p.pot = p.ovr;
        const diff = p.ovr - before;
        if (diff) report.lines.push(`GRL de ${p.name} ${signed(diff)} (ahora ${p.ovr})`);
        break;
      }
      case "injury": {
        const p = live(save, fx.target) ?? fx.target;
        const left = makeUnavailable(save, p, "injury", fx.games);
        report.lines.push(`${p.name} lesionado: fuera ${left} ${plural(left, "partido", "partidos")}`);
        break;
      }
      case "illness": {
        const p = live(save, fx.target) ?? fx.target;
        const left = makeUnavailable(save, p, "illness", fx.games, fx.reason);
        report.lines.push(`${p.name} enfermo: fuera ${left} ${plural(left, "partido", "partidos")}`);
        break;
      }
      case "absence": {
        const p = live(save, fx.target) ?? fx.target;
        const left = makeUnavailable(save, p, fx.absenceKind ?? "other", fx.games, fx.reason);
        report.lines.push(`${p.name} no está disponible (${fx.reason}): fuera ${left} ${plural(left, "partido", "partidos")}`);
        break;
      }
      case "money": {
        const amount = Math.round(fx.amount);
        if (!amount) break;
        save.budget += amount;
        report.money += amount;
        report.lines.push(`Caja del club ${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount))}`);
        break;
      }
      case "value": {
        const p = live(save, fx.target) ?? fx.target;
        const pct = clamp(Math.round(fx.pct), -40, 40);
        if (!pct) break;
        const before = p.value;
        p.valueMod = { pct, games: clamp(Math.round(fx.games), 1, 20) };
        // Se refleja ya mismo; después lo mantiene refreshValues hasta que se cumplan los partidos.
        p.value = Math.max(80_000, Math.round(before * (1 + pct / 100)));
        report.lines.push(`Valor de ${p.name} ${pct > 0 ? "+" : "−"}${Math.abs(pct)}% por unos partidos`);
        break;
      }
      case "clubBond":
      case "squadBond": {
        const p = live(save, fx.target) ?? fx.target;
        const key = fx.kind === "clubBond" ? "club" : "squad";
        const before = key === "club" ? clubBondOf(p) : squadBondOf(p);
        setBond(p, key, before + fx.delta);
        const after = key === "club" ? clubBondOf(p) : squadBondOf(p);
        if (after === before) break;
        report.lines.push(
          key === "club"
            ? `Relación de ${p.name} con el club ${signed(after - before)} (${bondLabel(after)})`
            : `Relación de ${p.name} con sus compañeros ${signed(after - before)} (${bondLabel(after)})`,
        );
        break;
      }
      case "board": {
        const real = adjustBoardConfidence(save, fx.delta, fx.reason ?? "Suceso inesperado");
        if (real) report.lines.push(`Confianza de la dirigencia ${signed(Math.round(real * 10) / 10)}`);
        break;
      }
      case "prestige": {
        if (!st) break;
        const before = st.prestige;
        st.prestige = clamp(Math.round(before + fx.delta), -EFFECT_LIMITS.prestige, EFFECT_LIMITS.prestige);
        const diff = st.prestige - before;
        if (diff) report.lines.push(`Prestigio del club ${signed(diff)}`);
        break;
      }
      case "leaveSquad": {
        // Solo sale quien todavía está en la partida: una copia vieja del jugador no puede salir dos veces.
        const p = live(save, fx.target);
        if (p && removeFromSquad(save, p, fx.eventId, fx.compensation ?? 0)) {
          report.lines.push(`${p.name} deja la plantilla masculina`);
        }
        break;
      }
      case "addYouth": {
        if (save.academy.length >= ACADEMY_MAX) break;
        if (save.academy.some((y) => y.id === fx.youth.id || y.name === fx.youth.name)) break;
        // Todo juvenil que entra a la cantera lleva una posición válida.
        save.academy = [...save.academy, { ...fx.youth, pos: normalizePos(fx.youth.pos, "CM") }];
        const feeTxt = fx.youth.fee === 0 ? "ficha de €0" : `ficha ${formatMoney(fx.youth.fee)}`;
        report.lines.push(`${fx.youth.name} entra a la cantera (${feeTxt})`);
        break;
      }
      case "removeYouth": {
        const y = save.academy.find((x) => x.id === fx.youthId);
        if (!y) break;
        save.academy = save.academy.filter((x) => x.id !== fx.youthId);
        report.lines.push(`${y.name} deja la cantera`);
        break;
      }
      case "youthDev": {
        const y = save.academy.find((x) => x.id === fx.youthId);
        if (!y) break;
        const bits: string[] = [];
        if (fx.ovrDelta) {
          const next = clamp(y.ovr + Math.round(fx.ovrDelta), 45, 85);
          if (next !== y.ovr) {
            bits.push(`GRL ${next > y.ovr ? "+" : "−"}${Math.abs(next - y.ovr)}`);
            y.ovr = next;
            if (y.pot < y.ovr) y.pot = y.ovr;
          }
        }
        if (fx.potDelta) {
          const next = clamp(y.pot + Math.round(fx.potDelta), y.ovr, 100);
          if (next !== y.pot) {
            bits.push(`POT ${next > y.pot ? "+" : "−"}${Math.abs(next - y.pot)}`);
            y.pot = next;
          }
        }
        if (fx.fee !== undefined) {
          y.fee = Math.max(0, Math.round(fx.fee));
          bits.push(y.fee === 0 ? "ficha de €0" : `ficha ${formatMoney(y.fee)}`);
        }
        if (bits.length) report.lines.push(`${y.name} (cantera): ${bits.join(" · ")}`);
        break;
      }
      case "listed": {
        const p = live(save, fx.target) ?? fx.target;
        if (p.listed === fx.listed) break;
        p.listed = fx.listed;
        report.lines.push(fx.listed ? `${p.name} queda en venta` : `${p.name} deja de estar en venta`);
        break;
      }
      case "wage": {
        const p = live(save, fx.target) ?? fx.target;
        const delta = Math.round(fx.delta);
        if (!delta) break;
        const before = p.wage;
        p.wage = Math.max(1_000, before + delta);
        const real = p.wage - before;
        if (real) report.lines.push(`Salario de ${p.name} ${real > 0 ? "+" : "−"}${formatMoney(Math.abs(real))}/sem`);
        break;
      }
      case "incomingOffer": {
        const p = live(save, fx.target);
        // Solo se ofertan jugadores propios: un cedido (de otro club) no se puede vender.
        if (!p || !isOwnedAtClub(p, save.clubId)) break;
        const fee = Math.max(80_000, Math.round(fx.fee));
        const dup = save.offers.some(
          (o) => o.playerId === p.id && o.fromClubId === fx.fromClubId && o.kind === "buy",
        );
        if (dup) break;
        const offer: TransferOffer = {
          id: uid("off"),
          kind: "buy",
          playerId: p.id,
          fromClubId: fx.fromClubId,
          toClubId: save.clubId,
          fee,
          loanSeasons: 0,
          week: save.week,
          unsolicited: true,
        };
        save.offers = [offer, ...save.offers];
        report.lines.push(`${clubById(fx.fromClubId).short} ofrece ${formatMoney(fee)} por ${p.name}`);
        break;
      }
      case "teamBoost": {
        if (!st || !fx.rating) break;
        const mod: TeamModifier = {
          id: uid("mod"),
          label: fx.label,
          rating: clamp(fx.rating, -EFFECT_LIMITS.teamBoost, EFFECT_LIMITS.teamBoost),
          games: clamp(Math.round(fx.games), 1, 10),
        };
        st.modifiers = [mod, ...st.modifiers].slice(0, 6);
        report.lines.push(
          `${mod.rating > 0 ? "Mejor" : "Peor"} preparación para ${mod.games} ${plural(mod.games, "partido", "partidos")}: ${fx.label}`,
        );
        break;
      }
    }
  }
  return report;
}

/* ── Paso del tiempo ──────────────────────────────────────────────────── */

/**
 * Se llama una vez por cada partido jugado por el usuario. Descuenta lo temporal (ausencias, valor,
 * preparación) y deja que las relaciones vuelvan de a poco a la normalidad.
 */
export function tickEventEffects(save: GameSave) {
  for (const p of save.players) {
    if (p.absence) {
      p.absence.games -= 1;
      if (p.absence.games <= 0) p.absence = undefined;
    }
    if (p.valueMod) {
      p.valueMod.games -= 1;
      if (p.valueMod.games <= 0) p.valueMod = undefined;
    }
    if (p.bond) {
      const step = (v: number) => (v < EFFECT_LIMITS.neutralBond ? Math.min(EFFECT_LIMITS.neutralBond, v + 1) : Math.max(EFFECT_LIMITS.neutralBond, v - 1));
      setBond(p, "club", step(p.bond.club));
      // setBond puede haber limpiado `bond`: se vuelve a mirar antes de seguir.
      if (p.bond) setBond(p, "squad", step(p.bond.squad));
    }
  }
  const st = save.events;
  if (st) {
    st.modifiers = st.modifiers.map((m) => ({ ...m, games: m.games - 1 })).filter((m) => m.games > 0);
  }
}
