import { clubById } from "./clubs";
import {
  describeChoices,
  hasSelectableOption,
  optionBlockedReason,
  pickBranch,
  runDecisionOption,
  scaledMoney,
  type DecisionOption,
  type DecisionResult,
} from "./event-decisions";
import { EFFECT_LIMITS, applyEventEffects, tickEventEffects, type EventEffect } from "./event-effects";
import { news, pickFit, popup, userSquad } from "./event-kit";
import { LIBRARY_EVENTS } from "./event-library";
import { SQUAD_MIN, clamp, formatMoney, uid } from "./format";
import { growPlayer } from "./potential";
import { Rng } from "./rng";
import { isUnavailable } from "./tactics";
import type {
  EventCategory,
  EventChoice,
  EventHistoryEntry,
  EventState,
  EventTiming,
  EventTopic,
  GamePopup,
  GameSave,
  Player,
  SquadDeparture,
  TeamModifier,
  YouthPlayer,
} from "./types";

/* ──────────────────────────────────────────────────────────────────────────
 * SUCESOS INESPERADOS
 *
 * Estructura:
 *   · Categorías: positive · negative · neutral · decision · player (específicos de jugador).
 *   · Cada suceso declara tema (jugador / club / partido / economía / temporada),
 *     momento (pre = antes del partido, between = entre partidos, any = ambos),
 *     peso base, enfriamiento propio y, si hace falta, quién puede ser el protagonista.
 *   · La frecuencia la gobierna EVENT_RULES (ver más abajo): máximo 1 por partido,
 *     separación mínima entre sucesos, tope por temporada y memoria de lo que salió hace poco.
 *
 * Para agregar situaciones nuevas, sumalas en `event-library.ts` (instantáneas) o
 * `event-library-decisions.ts` (con decisión). El motor de frecuencia y consecuencias no se toca.
 * ────────────────────────────────────────────────────────────────────────── */

export type EventOutcome = {
  news?: NewsItem;
  popup: GamePopup;
  /**
   * Consecuencias del suceso (ver event-effects.ts). El motor las aplica una vez que el suceso sale y agrega
   * al aviso las líneas ya redactadas. Un suceso solo narrativo no declara ninguna.
   */
  effects?: EventEffect[];
};

type EventBase = {
  id: string;
  topic: EventTopic;
  timing: EventTiming;
  /** Peso base dentro del sorteo (más alto = más probable). */
  weight: number;
  /** Partidos del usuario que deben pasar antes de que pueda repetirse. Por defecto EVENT_RULES.defaultCooldown. */
  cooldown?: number;
  /** Condición extra para que el suceso pueda salir (por ejemplo, estar en cierta etapa de la temporada). */
  eligible?: (save: GameSave) => boolean;
  /** Multiplicador dinámico del peso según el contexto del club (1 = sin cambio). */
  weightMod?: (save: GameSave) => number;
  /**
   * Filtro de protagonistas: si existe, el suceso solo puede ocurrirle a jugadores del plantel que lo cumplan
   * (y si no hay ninguno, el suceso no sale). El elegido llega como tercer parámetro de run/prompt/apply.
   */
  players?: (p: Player, save: GameSave) => boolean;
  /**
   * Filtro de juveniles de cantera. Si existe, el suceso solo sale cuando hay alguno que lo cumple.
   * El elegido llega como cuarto parámetro de run/prompt/apply y se guarda en el aviso.
   */
  youths?: (y: YouthPlayer, save: GameSave) => boolean;
  /**
   * Para sucesos extremadamente raros: fracción (0-1) que debe representar este suceso dentro de su categoría
   * cuando hay que elegir uno. Con 0.01 sale en ~1 de cada 100 sorteos de su categoría, sin importar cuántos
   * sucesos se sumen después (su peso se recalcula a partir de los demás de la categoría que estén elegibles).
   * Si la categoría no tiene otros sucesos elegibles, usa como referencia a todos los demás.
   * Respeta su enfriamiento: con un enfriamiento enorme sale una sola vez por carrera.
   */
  categoryShare?: number;
};

/** Sucesos de efecto inmediato: positivos, negativos, neutrales y específicos de jugador. */
export type InstantEventDef = EventBase & {
  category: "positive" | "negative" | "neutral" | "player";
  run: (save: GameSave, rng: Rng, player?: Player, youth?: YouthPlayer) => EventOutcome | null;
};

export type { DecisionOption, DecisionResult } from "./event-decisions";

/**
 * Sucesos con decisión: el usuario elige entre 2 a 4 opciones antes de seguir.
 * Las opciones (postura, costo, requisitos, desenlaces con azar) se describen en event-decisions.ts.
 */
export type DecisionEventDef = EventBase & {
  category: "decision";
  prompt: (save: GameSave, rng: Rng, player?: Player, youth?: YouthPlayer) => { title: string; body: string };
  options: DecisionOption[];
};

export type EventDef = InstantEventDef | DecisionEventDef;

/** Atajo para sucesos específicos de jugador: el filtro `players` es obligatorio y `run` siempre recibe al jugador. */
export function playerEvent(
  def: Omit<EventBase, "players"> & {
    players: (p: Player, save: GameSave) => boolean;
    run: (save: GameSave, rng: Rng, player: Player, youth?: YouthPlayer) => EventOutcome | null;
  },
): InstantEventDef {
  const { run, ...rest } = def;
  return { ...rest, category: "player", run: (save, rng, player, youth) => (player ? run(save, rng, player, youth) : null) };
}

/* ── Reglas de frecuencia ─────────────────────────────────────────────── */

export const EVENT_RULES = {
  /** Probabilidad base de que haya un suceso en la previa de un partido. */
  preMatchChance: 0.12,
  /** Probabilidad base, por jornada sin partido del usuario, de un suceso "entre partidos". */
  betweenChance: 0.03,
  /** Cuánto sube la probabilidad por cada partido tranquilo (sin sucesos) después del descanso mínimo. */
  quietBonus: 0.02,
  /** Techo de la probabilidad de la previa. */
  maxChance: 0.3,
  /** Partidos seguidos sin ningún suceso después de uno que sí salió. */
  minGap: 3,
  /** Máximo de sucesos por temporada. */
  seasonCap: 7,
  /** Partidos antes de que un mismo suceso pueda repetirse (si no define el suyo). */
  defaultCooldown: 12,
  /** Partidos antes de que un mismo jugador vuelva a ser protagonista. */
  playerCooldown: 10,
  /** Cuántos sucesos recientes se recuerdan. */
  recentSize: 6,
  /** Multiplicador si la categoría es la misma que la del último suceso. */
  categoryRepeatFactor: 0.45,
  /** Multiplicador si los dos últimos sucesos tuvieron el mismo tono y este también lo tendría. */
  toneStreakFactor: 0.6,
} as const;

/** Peso relativo de cada categoría en el sorteo (se multiplica por el peso del suceso). */
const CATEGORY_WEIGHT: Record<EventCategory, number> = {
  positive: 1,
  negative: 1,
  neutral: 0.9,
  decision: 1,
  player: 1,
};

const CATEGORY_TONE: Partial<Record<EventCategory, EventHistoryEntry["tone"]>> = {
  positive: "good",
  negative: "bad",
  neutral: "neutral",
};

/* ── Estado de frecuencia ─────────────────────────────────────────────── */

const NEVER = -99;

export function createEventState(): EventState {
  return {
    matchIndex: 0,
    lastEventWindow: NEVER,
    lastRolledWindow: NEVER,
    history: {},
    playerHistory: {},
    recent: [],
    seasonKey: 0,
    seasonCount: 0,
    modifiers: [],
    prestige: 0,
  };
}

function num(v: unknown, fallback: number) {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function numRecord(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== "object") return out;
  for (const [k, n] of Object.entries(v as Record<string, unknown>)) {
    if (typeof n === "number" && Number.isFinite(n)) out[k] = n;
  }
  return out;
}

/** Acepta partidas viejas (sin estado) y datos incompletos. */
export function normalizeEventState(raw: Partial<EventState> | null | undefined): EventState {
  const base = createEventState();
  if (!raw || typeof raw !== "object") return base;
  const categories: EventCategory[] = ["positive", "negative", "neutral", "decision", "player"];
  const recent = Array.isArray(raw.recent)
    ? raw.recent
        .filter((r): r is EventHistoryEntry => !!r && typeof r.id === "string" && categories.includes(r.category))
        .slice(0, EVENT_RULES.recentSize)
    : [];
  return {
    matchIndex: Math.max(0, num(raw.matchIndex, 0)),
    lastEventWindow: num(raw.lastEventWindow, NEVER),
    lastRolledWindow: num(raw.lastRolledWindow, NEVER),
    history: numRecord(raw.history),
    playerHistory: numRecord(raw.playerHistory),
    recent,
    seasonKey: num(raw.seasonKey, 0),
    seasonCount: Math.max(0, num(raw.seasonCount, 0)),
    modifiers: normalizeModifiers(raw.modifiers),
    prestige: Math.max(-EFFECT_LIMITS.prestige, Math.min(EFFECT_LIMITS.prestige, num(raw.prestige, 0))),
    departures: normalizeDepartures(raw.departures),
  };
}

function normalizeDepartures(v: unknown): SquadDeparture[] {
  if (!Array.isArray(v)) return [];
  const out: SquadDeparture[] = [];
  for (const d of v as Array<Partial<SquadDeparture> | null>) {
    if (!d || typeof d.playerId !== "string" || typeof d.name !== "string" || typeof d.eventId !== "string") continue;
    out.push({
      playerId: d.playerId,
      name: d.name,
      pos: d.pos ?? "CM",
      ovr: num(d.ovr, 0),
      age: num(d.age, 0),
      eventId: d.eventId,
      season: num(d.season, 0),
      week: num(d.week, 0),
      compensation: Math.max(0, num(d.compensation, 0)),
    });
  }
  return out.slice(0, 50);
}

function normalizeModifiers(v: unknown): TeamModifier[] {
  if (!Array.isArray(v)) return [];
  const out: TeamModifier[] = [];
  for (const m of v as Array<Partial<TeamModifier> | null>) {
    if (!m || typeof m.label !== "string" || typeof m.rating !== "number" || typeof m.games !== "number") continue;
    if (!Number.isFinite(m.rating) || !Number.isFinite(m.games) || m.games <= 0) continue;
    out.push({
      id: typeof m.id === "string" ? m.id : uid("mod"),
      label: m.label,
      rating: Math.max(-EFFECT_LIMITS.teamBoost, Math.min(EFFECT_LIMITS.teamBoost, m.rating)),
      games: Math.min(10, Math.round(m.games)),
    });
  }
  return out.slice(0, 6);
}

function state(save: GameSave): EventState {
  // Las partidas guardadas antes de este sistema no traen el campo.
  if (!save.events) save.events = createEventState();
  const st = save.events;
  if (st.seasonKey !== save.season) {
    st.seasonKey = save.season;
    st.seasonCount = 0;
  }
  return st;
}

/** Cierra la ventana del partido que se acaba de jugar: lo que siga pertenece al próximo partido. */
export function closeEventWindow(save: GameSave) {
  state(save).matchIndex += 1;
  // Cada partido del usuario descuenta las ausencias, el valor temporal y la preparación de los sucesos.
  tickEventEffects(save);
}

/* ── Probabilidades ───────────────────────────────────────────────────── */

function hasPendingDecision(save: GameSave) {
  return save.popups.some((p) => Array.isArray(p.choices) && p.choices.length > 0);
}

/** ¿Puede salir un suceso ahora? Aplica máximo 1 por partido, descanso mínimo y tope de temporada. */
function windowOpen(save: GameSave, st: EventState) {
  if (save.board?.sacked) return false;
  if (hasPendingDecision(save)) return false;
  if (st.lastEventWindow === st.matchIndex) return false;
  if (st.matchIndex - st.lastEventWindow <= EVENT_RULES.minGap) return false;
  if (st.seasonCount >= EVENT_RULES.seasonCap) return false;
  return true;
}

/** Partidos tranquilos acumulados desde que terminó el descanso mínimo. */
function quietMatches(st: EventState) {
  return Math.max(0, st.matchIndex - st.lastEventWindow - EVENT_RULES.minGap - 1);
}

/** Principio de temporada más calmo, recta final un poco más movida. */
function seasonPhase(save: GameSave) {
  const total = save.calendar.length;
  if (!total) return 1;
  const progress = save.cursor / total;
  if (progress < 0.05) return 0.5;
  if (progress > 0.85) return 1.1;
  return 1;
}

/** Probabilidad efectiva de que haya un suceso en esta tirada (0 a 1). Expuesta para poder ajustarla y testearla. */
export function eventChance(save: GameSave, timing: "pre" | "between", jitter = 1) {
  const st = state(save);
  if (!windowOpen(save, st)) return 0;
  const quiet = quietMatches(st);
  const base =
    timing === "pre"
      ? EVENT_RULES.preMatchChance + quiet * EVENT_RULES.quietBonus
      : EVENT_RULES.betweenChance + quiet * EVENT_RULES.quietBonus * 0.25;
  const cap = timing === "pre" ? EVENT_RULES.maxChance : EVENT_RULES.maxChance / 3;
  return clamp(Math.min(base, cap) * seasonPhase(save) * jitter, 0, 1);
}

type Candidate = { def: EventDef; weight: number; pool: Player[] | null; youths: YouthPlayer[] | null };

function dynamicWeight(def: EventDef, st: EventState, save: GameSave): number {
  let w = def.weight * CATEGORY_WEIGHT[def.category];
  const last = st.history[def.id];
  if (last !== undefined) {
    const cooldown = def.cooldown ?? EVENT_RULES.defaultCooldown;
    const since = st.matchIndex - last;
    if (since < cooldown) return 0;
    // Pasado el enfriamiento vuelve de a poco, no de golpe.
    w *= 0.5 + 0.5 * clamp((since - cooldown) / cooldown, 0, 1);
  }
  const prev = st.recent[0];
  if (prev && prev.category === def.category) w *= EVENT_RULES.categoryRepeatFactor;
  const tone = CATEGORY_TONE[def.category];
  const prev2 = st.recent[1];
  if (tone && prev && prev2 && prev.tone === tone && prev2.tone === tone) w *= EVENT_RULES.toneStreakFactor;
  if (def.weightMod) w *= Math.max(0, def.weightMod(save));
  return w;
}

function candidates(save: GameSave, st: EventState, timing: "pre" | "between"): Candidate[] {
  const squad = userSquad(save);
  const out: Candidate[] = [];
  const rare: Candidate[] = [];
  for (const def of EVENTS) {
    if (def.timing !== "any" && def.timing !== timing) continue;
    if (def.eligible && !def.eligible(save)) continue;
    let pool: Player[] | null = null;
    if (def.players) {
      pool = squad.filter((p) => {
        const seen = st.playerHistory[p.id];
        if (seen !== undefined && st.matchIndex - seen < EVENT_RULES.playerCooldown) return false;
        return def.players!(p, save);
      });
      if (!pool.length) continue;
    }
    let youthPool: YouthPlayer[] | null = null;
    if (def.youths) {
      youthPool = save.academy.filter((y) => def.youths!(y, save));
      if (!youthPool.length) continue;
    }
    const weight = dynamicWeight(def, st, save);
    if (weight <= 0) continue;
    if (def.categoryShare !== undefined) rare.push({ def, weight, pool, youths: youthPool });
    else out.push({ def, weight, pool, youths: youthPool });
  }
  // Los sucesos raros se pesan al final: su peso es la fracción pedida de su categoría (ver `categoryShare`).
  for (const r of rare) {
    const share = clamp(r.def.categoryShare ?? 0, 0, 0.5);
    const sameCategory = out.filter((c) => c.def.category === r.def.category);
    const reference = (sameCategory.length ? sameCategory : out).reduce((sum, c) => sum + c.weight, 0);
    const weight = (reference * share) / (1 - share);
    if (weight > 0) out.push({ ...r, weight });
  }
  return out;
}

/** Peso real de cada suceso que podría salir ahora (para pruebas y para ajustar el balance). */
export function listEventCandidates(save: GameSave, timing: "pre" | "between") {
  return candidates(save, state(save), timing).map((c) => ({ id: c.def.id, category: c.def.category, weight: c.weight }));
}

function pickWeighted(list: Candidate[], rng: Rng): Candidate | null {
  const total = list.reduce((s, c) => s + c.weight, 0);
  if (total <= 0) return null;
  let roll = rng.float() * total;
  for (const c of list) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return list[list.length - 1] ?? null;
}

/* ── Disparo ──────────────────────────────────────────────────────────── */

function buildOutcome(
  save: GameSave,
  cand: Candidate,
  rng: Rng,
  player: Player | undefined,
  youth: YouthPlayer | undefined,
): EventOutcome | null {
  const { def } = cand;
  if (def.category === "decision") {
    // Si ninguna opción se puede elegir (por ejemplo, sin caja) la decisión no sale: así nunca se traba la partida.
    if (!hasSelectableOption(def.options, save, player)) return null;
    const text = def.prompt(save, rng, player, youth);
    const choices: EventChoice[] = describeChoices(def.options, save, player);
    return {
      popup: {
        ...popup("event", "neutral", text.title, text.body),
        choices,
        eventId: def.id,
        eventPlayerId: player?.id,
        eventYouthId: youth?.id,
      },
    };
  }
  return def.run(save, rng, player, youth);
}

function fire(save: GameSave, st: EventState, list: Candidate[], rng: Rng): boolean {
  const remaining = [...list];
  // Si un suceso resulta no aplicable (run devuelve null) se prueba con otro; nunca salen dos.
  for (let attempt = 0; attempt < 4 && remaining.length; attempt++) {
    const cand = pickWeighted(remaining, rng);
    if (!cand) return false;
    const player = cand.pool ? rng.pick(cand.pool) : undefined;
    const youth = cand.youths ? rng.pick(cand.youths) : undefined;
    const outcome = buildOutcome(save, cand, rng, player, youth);
    if (!outcome) {
      remaining.splice(remaining.indexOf(cand), 1);
      continue;
    }
    const report = applyEventEffects(save, outcome.effects);
    if (report.lines.length) outcome.popup.effects = report.lines;
    if (outcome.news) save.news.unshift(outcome.news);
    save.popups.push(outcome.popup);
    st.lastEventWindow = st.matchIndex;
    st.history[cand.def.id] = st.matchIndex;
    if (player) st.playerHistory[player.id] = st.matchIndex;
    st.recent.unshift({
      id: cand.def.id,
      category: cand.def.category,
      tone: outcome.popup.tone,
      window: st.matchIndex,
    });
    st.recent.length = Math.min(st.recent.length, EVENT_RULES.recentSize);
    st.seasonCount += 1;
    return true;
  }
  return false;
}

function rollEvent(save: GameSave, timing: "pre" | "between") {
  const st = state(save);
  if (!windowOpen(save, st)) return;
  const seed = save.seed + save.season * 131 + save.cursor * 7919 + st.matchIndex * 104729 + (timing === "pre" ? 17 : 29);
  const rng = new Rng(seed);
  // La probabilidad misma varía de una tirada a otra, así no hay un ritmo fijo.
  const chance = eventChance(save, timing, 0.75 + rng.float() * 0.5);
  if (!rng.chance(chance)) return;
  const list = candidates(save, st, timing);
  if (!list.length) return;
  fire(save, st, list, rng);
}

/**
 * Tirada de la previa: se llama una sola vez por partido del usuario, justo antes de jugarlo.
 * Es el momento principal de los sucesos.
 */
export function rollPreMatchEvent(save: GameSave) {
  const st = state(save);
  if (st.lastRolledWindow === st.matchIndex) return;
  st.lastRolledWindow = st.matchIndex;
  rollEvent(save, "pre");
}

/** Tirada ocasional en jornadas donde el usuario no juega (el calendario avanza entre partidos). */
export function rollBetweenMatchEvent(save: GameSave) {
  rollEvent(save, "between");
}

/** Compatibilidad con código anterior que llamaba al sorteo semanal. */
export function rollWeeklyEvent(save: GameSave, _rng?: Rng) {
  rollBetweenMatchEvent(save);
}

/* ── Decisiones ───────────────────────────────────────────────────────── */

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Resuelve la opción elegida en un suceso con decisión. Devuelve un mensaje si no se pudo (y el aviso sigue
 * abierto para elegir otra) o null si salió bien. Un aviso huérfano (suceso o opción que ya no existe) se retira
 * para que la partida nunca quede trabada.
 */
export function resolveEventDecision(save: GameSave, popupId: string, choiceId: string): string | null {
  const idx = save.popups.findIndex((p) => p.id === popupId && Array.isArray(p.choices));
  if (idx < 0) return "Esa decisión ya no está disponible.";
  const pop = save.popups[idx]!;
  const def = EVENTS.find((e): e is DecisionEventDef => e.category === "decision" && e.id === pop.eventId);
  const option = def?.options.find((o) => o.id === choiceId);
  if (!def || !option) {
    save.popups.splice(idx, 1);
    return "Esa decisión ya no existe.";
  }
  const player = pop.eventPlayerId ? save.players.find((p) => p.id === pop.eventPlayerId) : undefined;
  const youth = pop.eventYouthId ? save.academy.find((y) => y.id === pop.eventYouthId) : undefined;

  // El protagonista pudo irse del club mientras el aviso esperaba: la situación se cierra sin consecuencias.
  const gonePlayer = Boolean(def.players) && (!player || player.clubId !== save.clubId || Boolean(player.loanFrom));
  const goneYouth = Boolean(def.youths) && !youth;
  const gone = gonePlayer || goneYouth;
  if (!gone) {
    // Se vuelve a validar: la caja pudo cambiar desde que apareció el aviso. El aviso sigue abierto.
    const blocked = optionBlockedReason(option, save, player);
    if (blocked) return blocked;
  }

  save.popups.splice(idx, 1);
  if (gone) {
    const who = player?.name ?? youth?.name ?? "El jugador";
    const shown = popup("event", "neutral", pop.title, `${who} ya no está en el club: la situación se resolvió sola.`);
    save.popups.splice(idx, 0, shown);
    return null;
  }

  const rng = new Rng(save.seed + hashString(`${popupId}:${choiceId}`));
  const result = runDecisionOption(option, save, rng, player, youth);
  const report = applyEventEffects(save, result.effects);
  save.news.unshift(news(save, result.tone, result.title, result.body));
  const shown = popup("event", result.tone, result.title, result.body, result.prize);
  shown.decision = option.label;
  if (report.lines.length) shown.effects = report.lines;
  save.popups.splice(idx, 0, shown);
  return null;
}

/* ── Situaciones ──────────────────────────────────────────────────────── */

// Están las situaciones que ya existían y, al final, cuatro decisiones de REFERENCIA que ejercitan toda la
// estructura (posturas, costo, riesgo, requisitos). La biblioteca grande vive en event-library.ts.
const CORE_EVENTS: EventDef[] = [
  {
    id: "sponsor",
    category: "positive",
    topic: "economy",
    timing: "any",
    weight: 6,
    run: (save, rng) => {
      const amount = rng.int(800_000, 4_200_000);
      save.budget += amount;
      const title = "Patrocinador extra";
      const body = `Un acuerdo relámpago con un sponsor local deja ${formatMoney(amount)} en caja.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
    },
  },
  {
    id: "benefactor",
    category: "positive",
    topic: "economy",
    timing: "any",
    weight: 3,
    run: (save, rng) => {
      const amount = rng.int(3_000_000, 9_000_000);
      save.budget += amount;
      const title = "Mecenas inesperado";
      const body = `Un ex socio reaparece y dona ${formatMoney(amount)} al club.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
    },
  },
  {
    id: "tv",
    category: "positive",
    topic: "economy",
    timing: "any",
    weight: 5,
    run: (save, rng) => {
      const amount = rng.int(1_200_000, 3_500_000);
      save.budget += amount;
      const title = "Derechos de TV";
      const body = `Un recálculo de los derechos deja ${formatMoney(amount)} extra.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
    },
  },
  {
    id: "gate",
    category: "positive",
    topic: "match",
    timing: "between",
    weight: 5,
    run: (save, rng) => {
      const amount = rng.int(400_000, 1_800_000);
      save.budget += amount;
      const title = "Taquilla récord";
      const body = `${clubById(save.clubId).stadium} se llenó. Ingreso extra ${formatMoney(amount)}.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
    },
  },
  {
    id: "youth-burst",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const kids = userSquad(save).filter((p) => p.age <= 21);
      const p = kids.length ? rng.pick(kids) : null;
      if (!p) return null;
      p.pot = clamp(p.pot + rng.int(2, 5), p.ovr, 100);
      growPlayer(p, rng.int(1, 2), rng, { ignoreCap: true });
      const title = `${p.name} da un salto`;
      const body = `En los entrenamientos se ve otro jugador. Potencial ${p.pot}.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
    },
  },
  {
    id: "camp",
    category: "positive",
    topic: "club",
    timing: "pre",
    weight: 5,
    run: (save, rng) => {
      for (const p of userSquad(save)) {
        p.fitness = clamp(p.fitness + rng.int(4, 10), 40, 100);
        p.form = clamp(p.form + 1, -5, 5);
      }
      const title = "Concentración redonda";
      const body = "La plantilla vuelve más fresca y conectada.";
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [{ kind: "teamBoost", rating: 0.6, games: 2, label: "concentración redonda" }],
      };
    },
  },
  {
    id: "heal",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const hurt = userSquad(save).filter((p) => p.injured > 0);
      const p = hurt.length ? rng.pick(hurt) : null;
      if (!p) return null;
      p.injured = 0;
      p.fitness = clamp(p.fitness + 20, 50, 100);
      const title = `${p.name} vuelve antes`;
      const body = "Los médicos aceleran la recuperación. Disponible para el próximo partido.";
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
    },
  },
  {
    id: "fairplay",
    category: "positive",
    topic: "season",
    timing: "between",
    weight: 3,
    run: (save, rng) => {
      const amount = rng.int(250_000, 900_000);
      save.budget += amount;
      const title = "Premio fair play";
      const body = `La liga premia la conducta del vestuario con ${formatMoney(amount)}.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body, amount),
        effects: [{ kind: "prestige", delta: 1 }],
      };
    },
  },
  {
    id: "injury-star",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 2,
    run: (save, rng) => {
      const xi = save.tactics.lineup
        .map((id) => save.players.find((pl) => pl.id === id))
        .filter((pl): pl is Player => pl !== undefined && !isUnavailable(pl));
      const p = xi.length ? rng.pick(xi) : pickFit(userSquad(save), rng);
      if (!p) return null;
      const games = rng.int(2, 5);
      const title = `${p.name} se lesiona`;
      const body = `Molestia muscular. Fuera ${games} partidos.`;
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: [{ kind: "injury", target: p, games }],
      };
    },
  },
  {
    id: "flu",
    category: "negative",
    topic: "club",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const squad = userSquad(save);
      const n = Math.min(squad.length, rng.int(3, 6));
      const picks = rng.shuffle(squad).slice(0, n);
      for (const p of picks) p.fitness = clamp(p.fitness - rng.int(12, 22), 38, 100);
      // El más golpeado cae de verdad con gripe y se pierde algún partido; el resto solo baja de tono.
      const sick = picks.find((p) => !isUnavailable(p));
      const games = rng.int(1, 2);
      const title = "Gripe en el vestuario";
      const body = sick
        ? `${picks.length} jugadores bajan de tono esta semana y ${sick.name} queda en cama.`
        : `${picks.length} jugadores bajan de tono esta semana.`;
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: sick ? [{ kind: "illness", target: sick, games, reason: "Gripe" }] : undefined,
      };
    },
  },
  {
    id: "row",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const squad = userSquad(save);
      const a = pickFit(squad, rng);
      if (!a) return null;
      const title = "Bronca en el vestuario";
      const body = `${a.name} discute con el cuerpo técnico. El ambiente se enfría.`;
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: [
          { kind: "morale", target: a, delta: -rng.int(10, 22) },
          { kind: "form", target: a, delta: -2 },
          { kind: "clubBond", target: a, delta: -8 },
        ],
      };
    },
  },
  {
    id: "fine",
    category: "negative",
    topic: "club",
    timing: "any",
    weight: 5,
    run: (save, rng) => {
      const amount = rng.int(400_000, 2_200_000);
      save.budget -= amount;
      const title = "Multa de la federación";
      const body = `Sanción disciplinaria: ${formatMoney(amount)}.`;
      return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
    },
  },
  {
    id: "leak",
    category: "negative",
    topic: "club",
    timing: "pre",
    weight: 3,
    run: (save, rng) => {
      const title = "Filtración a la prensa";
      const body = "Un audio interno sale a la luz. El grupo se cierra.";
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: [
          { kind: "morale", target: "squad", delta: -rng.int(2, 6) },
          { kind: "board", delta: -1.5, reason: "Filtración a la prensa" },
          { kind: "prestige", delta: -1 },
        ],
      };
    },
  },
  {
    id: "ultras",
    category: "negative",
    topic: "club",
    timing: "between",
    weight: 3,
    run: (save, rng) => {
      const amount = rng.int(200_000, 1_100_000);
      save.budget -= amount;
      const title = "Protesta en la curva";
      const body = `Incidentes menores y daños. Coste ${formatMoney(amount)}.`;
      return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
    },
  },
  {
    id: "stadium",
    category: "negative",
    topic: "economy",
    timing: "between",
    weight: 3,
    run: (save, rng) => {
      const amount = rng.int(600_000, 3_000_000);
      save.budget -= amount;
      const title = "Gotera en el estadio";
      const body = `Obras urgentes en ${clubById(save.clubId).stadium}: ${formatMoney(amount)}.`;
      return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
    },
  },
  {
    id: "exit",
    category: "negative",
    topic: "player",
    timing: "between",
    weight: 4,
    run: (save, rng) => {
      const stars = userSquad(save).filter((p) => p.ovr >= 78 && !p.listed);
      const p = stars.length ? rng.pick(stars) : null;
      if (!p) return null;
      p.listed = true;
      const title = `${p.name} pide irse`;
      const body = "Su agente filtra que quiere un cambio de aires. Quedó en venta.";
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: [
          { kind: "morale", target: p, delta: -12 },
          { kind: "clubBond", target: p, delta: -15 },
        ],
      };
    },
  },
  {
    id: "wage",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    run: (save, rng) => {
      const p = pickFit(userSquad(save).filter((x) => x.ovr >= 76), rng);
      if (!p) return null;
      const bump = Math.round(p.wage * 0.18);
      p.wage += bump;
      p.morale = clamp(p.morale + 6, 40, 100);
      const title = `${p.name} renegocia`;
      const body = `El agente aprieta. Salario semanal ahora ${formatMoney(p.wage)}.`;
      return { news: news(save, "neutral", title, body), popup: popup("event", "neutral", title, body) };
    },
  },
  {
    id: "boost-form",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const p = pickFit(userSquad(save), rng);
      if (!p) return null;
      p.form = clamp(p.form + rng.int(2, 4), -5, 5);
      p.morale = clamp(p.morale + 8, 40, 100);
      const title = `${p.name}, en racha`;
      const body = "Encuentra el punto. La afición lo nota.";
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
    },
  },
  {
    id: "scout-tip",
    category: "neutral",
    topic: "club",
    timing: "any",
    weight: 3,
    run: (save, rng) => {
      const amount = rng.int(0, 0);
      save.budget += amount;
      const title = "Soplo de un ojeador";
      const body = "Un contacto en Sudamérica recomienda mirar la pestaña de cantera esta semana.";
      return { news: news(save, "neutral", title, body), popup: popup("event", "neutral", title, body) };
    },
  },
  {
    id: "derbi",
    category: "neutral",
    topic: "match",
    timing: "pre",
    weight: 2,
    run: (save) => {
      const title = "Semana de derbi";
      const body = "La ciudad no habla de otra cosa. El vestuario está encendido.";
      return {
        news: news(save, "neutral", title, body),
        popup: popup("event", "neutral", title, body),
        effects: [
          { kind: "morale", target: "squad", delta: 3 },
          { kind: "teamBoost", rating: 0.4, games: 1, label: "semana de derbi" },
        ],
      };
    },
  },
  /* ── Decisiones de referencia ───────────────────────────────────────── */
  {
    // Oferta comercial: dinero a cambio de desgaste. Aceptar, rechazar o una versión intermedia.
    id: "decision-tour-offer",
    category: "decision",
    topic: "economy",
    timing: "any",
    weight: 3,
    cooldown: 20,
    prompt: (save) => ({
      title: "Oferta por una gira de exhibición",
      body: `Un promotor ofrece ${formatMoney(scaledMoney(save, 1.6, 400_000))} por jugar dos amistosos en el exterior en plena temporada. El cuerpo técnico advierte que el viaje cansa.`,
    }),
    options: [
      {
        id: "accept",
        stance: "accept-offer",
        label: "Aceptar la gira",
        hint: "Entra mucha plata y exposición, pero cansa al plantel y hay riesgo de lesión.",
        apply: (save, rng) => {
          const money = scaledMoney(save, 1.6, 400_000);
          const fit = userSquad(save).filter((p) => !isUnavailable(p));
          const unlucky = fit.length ? rng.pick(fit) : null;
          const games = rng.int(2, 3);
          const base: EventEffect[] = [
            { kind: "money", amount: money },
            { kind: "fitness", target: "squad", delta: -8 },
            { kind: "teamBoost", rating: -0.5, games: 2, label: "desgaste por la gira" },
            { kind: "prestige", delta: 1 },
          ];
          return pickBranch(rng, [
            {
              chance: 75,
              result: {
                tone: "good",
                title: "Gira completada",
                body: "El club cobra, la marca se ve en el exterior y el plantel vuelve cansado.",
                effects: base,
              },
            },
            {
              chance: 25,
              result: {
                tone: "bad",
                title: "La gira sale cara",
                body: unlucky
                  ? `Se cobra el viaje, pero ${unlucky.name} se lastima en un amistoso.`
                  : "Se cobra el viaje, pero el desgaste se nota más de lo previsto.",
                effects: unlucky ? [...base, { kind: "injury", target: unlucky, games }] : base,
              },
            },
          ]);
        },
      },
      {
        id: "reject",
        stance: "reject-offer",
        label: "Rechazar y descansar",
        hint: "Sin ingreso extra, pero el plantel llega entero al próximo partido.",
        apply: () => ({
          tone: "neutral",
          title: "Se rechaza la gira",
          body: "El club renuncia al dinero y aprovecha la semana para descansar.",
          effects: [
            { kind: "fitness", target: "squad", delta: 4 },
            { kind: "teamBoost", rating: 0.3, games: 1, label: "semana de descanso" },
            { kind: "board", delta: -0.5, reason: "Se rechazó un ingreso extra" },
          ],
        }),
      },
      {
        id: "youth",
        stance: "performance",
        label: "Aceptar solo con juveniles",
        hint: "Cobra menos y la marca luce menos, pero el once titular no se resiente.",
        apply: (save) => ({
          tone: "neutral",
          title: "Gira con equipo alterno",
          body: "Viaja un plantel de segunda línea. Menos plata, menos brillo y los titulares descansan.",
          effects: [
            { kind: "money", amount: scaledMoney(save, 0.8, 200_000) },
            { kind: "prestige", delta: -1 },
          ],
        }),
      },
    ],
  },
  {
    // Indisciplina de un jugador: castigar, hablar en privado o respaldarlo.
    id: "decision-discipline",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    players: (p) => !isUnavailable(p) && p.ovr >= 60,
    prompt: (_save, _rng, player) => ({
      title: `${player?.name ?? "Un jugador"} rompe una regla del grupo`,
      body: `${player?.name ?? "Un jugador"} llegó tarde a la concentración y el resto del plantel lo notó. Tenés que decidir cómo responder antes del partido.`,
    }),
    options: [
      {
        id: "punish",
        stance: "punish",
        label: "Sancionarlo: afuera un partido",
        hint: "Marca autoridad ante el grupo, pero enfría la relación con él.",
        apply: (_save, _rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return {
            tone: "neutral",
            title: `${p.name} queda afuera`,
            body: "El grupo recibe el mensaje: las reglas valen para todos.",
            effects: [
              { kind: "absence", target: p, games: 1, reason: "Sanción del cuerpo técnico", absenceKind: "discipline" },
              { kind: "morale", target: p, delta: -8 },
              { kind: "clubBond", target: p, delta: -8 },
              { kind: "squadBond", target: p, delta: 6 },
              { kind: "board", delta: 1, reason: "Mano firme con la disciplina" },
            ],
          };
        },
      },
      {
        id: "talk",
        stance: "internal",
        label: "Hablar a solas con él",
        hint: "Un diálogo privado: puede funcionar o puede interpretarse como debilidad.",
        apply: (_save, rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return pickBranch(rng, [
            {
              chance: 60,
              result: {
                tone: "good",
                title: `${p.name} entiende el mensaje`,
                body: "La charla a solas funciona: se disculpa con el grupo y se ofrece a compensarlo.",
                effects: [
                  { kind: "morale", target: p, delta: 3 },
                  { kind: "clubBond", target: p, delta: 5 },
                  { kind: "form", target: p, delta: 1 },
                ],
              },
            },
            {
              chance: 40,
              result: {
                tone: "bad",
                title: `${p.name} lo toma a la ligera`,
                body: "El tema se filtra en el vestuario y algunos ven falta de autoridad.",
                effects: [
                  { kind: "morale", target: p, delta: -2 },
                  { kind: "squadBond", target: p, delta: -5 },
                  { kind: "board", delta: -1, reason: "Falta de autoridad en el vestuario" },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "back",
        stance: "support",
        label: "Respaldarlo en público",
        hint: "Gana su lealtad, pero el vestuario y la dirigencia lo van a notar.",
        apply: (_save, _rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return {
            tone: "neutral",
            title: `Respaldo a ${p.name}`,
            body: "El cuerpo técnico lo defiende. Él lo agradece; algunos compañeros no tanto.",
            effects: [
              { kind: "morale", target: p, delta: 8 },
              { kind: "clubBond", target: p, delta: 10 },
              { kind: "squadBond", target: p, delta: -7 },
              { kind: "board", delta: -1, reason: "Se toleró una falta de disciplina" },
            ],
          };
        },
      },
    ],
  },
  {
    // Problema personal de un titular: ausencia, bienestar (con costo) o rendimiento (con riesgo).
    id: "decision-family-leave",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 18,
    players: (p, save) => p.ovr >= 70 && !isUnavailable(p) && save.tactics.lineup.includes(p.id),
    prompt: (_save, _rng, player) => ({
      title: `${player?.name ?? "Un titular"} pasa por un momento difícil`,
      body: `${player?.name ?? "Un titular"} tiene un problema familiar y pide ausentarse. Es uno de tus titulares y el partido está encima.`,
    }),
    options: [
      {
        id: "leave",
        stance: "allow-absence",
        label: "Dejarlo viajar (2 partidos)",
        hint: "Se pierde dos partidos, pero vuelve agradecido.",
        apply: (_save, _rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return {
            tone: "good",
            title: `${p.name} viaja con permiso`,
            body: "El club le da su lugar. Vuelve en dos partidos.",
            effects: [
              { kind: "absence", target: p, games: 2, reason: "Asuntos familiares", absenceKind: "personal" },
              { kind: "morale", target: p, delta: 10 },
              { kind: "clubBond", target: p, delta: 10 },
              { kind: "squadBond", target: p, delta: 2 },
            ],
          };
        },
      },
      {
        id: "care",
        stance: "wellbeing",
        label: "Darle tiempo y acompañarlo",
        hint: "El club se hace cargo de todo (cuesta dinero). Tres partidos afuera, pero la imagen del club mejora.",
        cost: (save) => scaledMoney(save, 0.1, 80_000),
        apply: (_save, _rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return {
            tone: "good",
            title: `El club acompaña a ${p.name}`,
            body: "Apoyo psicológico y logístico: el club cuida a su gente y eso se comenta.",
            effects: [
              { kind: "absence", target: p, games: 3, reason: "Asuntos familiares", absenceKind: "personal" },
              { kind: "morale", target: p, delta: 16 },
              { kind: "clubBond", target: p, delta: 14 },
              { kind: "board", delta: 1, reason: "El club cuida a su gente" },
              { kind: "prestige", delta: 1 },
            ],
          };
        },
      },
      {
        id: "play",
        stance: "performance",
        label: "Pedirle que juegue",
        hint: "Mantenés al titular, pero con la cabeza en otro lado: puede salir bien o mal.",
        apply: (_save, rng, p) => {
          if (!p) return { tone: "neutral", title: "Sin novedades", body: "La situación ya no aplica." };
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: `${p.name} juega, pero no es él`,
                body: "Cumple con lo justo y no oculta que se sintió presionado.",
                effects: [
                  { kind: "morale", target: p, delta: -10 },
                  { kind: "clubBond", target: p, delta: -8 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
            {
              chance: 30,
              result: {
                tone: "bad",
                title: `${p.name} se quiebra`,
                body: "Se siente abandonado. Rinde mal y el malestar llega al grupo.",
                effects: [
                  { kind: "morale", target: p, delta: -16 },
                  { kind: "clubBond", target: p, delta: -14 },
                  { kind: "squadBond", target: p, delta: -3 },
                  { kind: "form", target: p, delta: -3 },
                  { kind: "teamBoost", rating: -0.4, games: 1, label: "titular quebrado" },
                ],
              },
            },
            {
              chance: 15,
              result: {
                tone: "good",
                title: `${p.name} se refugia en el fútbol`,
                body: "Canaliza todo en la cancha y hace un gran partido, aunque la relación queda tocada.",
                effects: [
                  { kind: "morale", target: p, delta: 4 },
                  { kind: "clubBond", target: p, delta: -2 },
                  { kind: "form", target: p, delta: 2 },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    // Sanción de la federación: aceptar, apelar (cuesta y es incierto) o autoimponerse una medida.
    id: "decision-federation-sanction",
    category: "decision",
    topic: "club",
    timing: "any",
    weight: 3,
    cooldown: 20,
    prompt: (save) => ({
      title: "Sanción de la federación",
      body: `Tras incidentes en la tribuna, la federación propone una sanción de ${formatMoney(scaledMoney(save, 0.35, 250_000))}. Podés aceptarla, apelar con abogados o tomar una medida propia.`,
    }),
    options: [
      {
        id: "accept",
        stance: "accept-sanction",
        label: "Aceptar la sanción",
        hint: "Cierra el tema ya. Pagás la multa y el club carga con el costo de imagen.",
        apply: (save) => ({
          tone: "bad",
          title: "Sanción aceptada",
          body: "El club paga la multa y da vuelta la página.",
          effects: [
            { kind: "money", amount: -scaledMoney(save, 0.35, 250_000) },
            { kind: "prestige", delta: -1 },
          ],
        }),
      },
      {
        id: "appeal",
        stance: "pay",
        label: "Apelar con abogados",
        hint: "Pagás los abogados por adelantado. Si ganás, se anula; si perdés, la multa sale más cara.",
        // Los abogados cuestan el 60% de la multa; si se pierde se paga la multa con recargo (150%).
        cost: (save) => Math.round(scaledMoney(save, 0.35, 250_000) * 0.6),
        apply: (save, rng) =>
          pickBranch(rng, [
            {
              chance: 60,
              result: {
                tone: "good",
                title: "Sanción anulada",
                body: "El comité acepta los argumentos del club y archiva la multa.",
                effects: [{ kind: "board", delta: 1, reason: "Se anuló una sanción" }],
              },
            },
            {
              chance: 40,
              result: {
                tone: "bad",
                title: "Apelación rechazada",
                body: "El comité mantiene la sanción y suma costas. La dirigencia no está contenta.",
                effects: [
                  { kind: "money", amount: -Math.round(scaledMoney(save, 0.35, 250_000) * 1.5) },
                  { kind: "prestige", delta: -1 },
                  { kind: "board", delta: -2, reason: "Apelación perdida" },
                ],
              },
            },
          ]),
      },
      {
        id: "closed-stand",
        stance: "internal",
        label: "Cerrar la curva un partido",
        hint: "Una medida propia, más barata y sin mancha de imagen, pero el próximo partido se juega sin aliento.",
        apply: (save) => ({
          tone: "neutral",
          title: "Medida propia del club",
          body: "El club cierra la curva por un partido y acuerda con la federación una multa menor.",
          effects: [
            { kind: "money", amount: -Math.round(scaledMoney(save, 0.35, 250_000) * 0.4) },
            { kind: "teamBoost", rating: -0.5, games: 1, label: "cancha sin hinchada" },
          ],
        }),
      },
    ],
  },
  /* ── Evento especial extremadamente raro ────────────────────────────── */
  playerEvent({
    // ~1% de los sorteos de la categoría "player" y una sola vez por carrera. Se trata como una noticia respetuosa y
    // positiva: el jugador agradece el apoyo y el club recibe la mitad de su valor como compensación.
    id: "player-gender-transition",
    topic: "player",
    timing: "any",
    weight: 1,
    categoryShare: 0.01,
    cooldown: 100_000,
    eligible: (save) => userSquad(save).length > SQUAD_MIN,
    players: (p) => p.age >= 18,
    run: (save, _rng, p) => {
      const compensation = Math.round((p.value * 0.5) / 1000) * 1000;
      const title = `${p.name} abre una nueva etapa`;
      const body =
        `${p.name} le comunicó al club que está realizando una transición de género. ` +
        `Como la competición masculina del juego no le permite seguir disputando esos partidos, deja la plantilla masculina. ` +
        `Agradeció el apoyo que recibió del club, y el club le desea lo mejor en esta nueva etapa. ` +
        `Como compensación, el club recibe ${formatMoney(compensation)}, la mitad de su valor actual.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [
          { kind: "leaveSquad", target: p, eventId: "player-gender-transition", compensation },
          { kind: "money", amount: compensation },
        ],
      };
    },
  }),
];

/** Todas las situaciones: las de referencia más la biblioteca grande. */
export const EVENTS: EventDef[] = [...CORE_EVENTS, ...LIBRARY_EVENTS];
