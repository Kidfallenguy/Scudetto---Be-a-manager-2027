import { clamp } from "./format";
import type { Attrs, GkAttrs, Player, Pos, TrainStat } from "./types";

/** Estadísticas de jugador de campo. */
export const OUTFIELD_STATS: Array<keyof Attrs> = ["pac", "sho", "pas", "dri", "def", "phy"];
/** Estadísticas de portero (como en el FC): estirada, manejo, saque, reflejos, velocidad, colocación. */
export const GK_STATS: Array<keyof GkAttrs> = ["div", "han", "kic", "ref", "spe", "pos"];

export const STAT_LABEL: Record<TrainStat, string> = {
  pac: "Velocidad",
  sho: "Tiro",
  pas: "Pase",
  dri: "Regate",
  def: "Defensa",
  phy: "Físico",
  div: "Estirada",
  han: "Manejo",
  kic: "Saque",
  ref: "Reflejos",
  spe: "Velocidad",
  pos: "Colocación",
};

export const STAT_SHORT: Record<TrainStat, string> = {
  pac: "VEL",
  sho: "TIR",
  pas: "PAS",
  dri: "REG",
  def: "DEF",
  phy: "FIS",
  div: "EST",
  han: "MAN",
  kic: "SAQ",
  ref: "REF",
  spe: "VEL",
  pos: "COL",
};

export function isGK(p: { pos: Pos }): boolean {
  return p.pos === "GK";
}

export function statKeysFor(pos: Pos): TrainStat[] {
  return pos === "GK" ? [...GK_STATS] : [...OUTFIELD_STATS];
}

const OUT_WEIGHTS: Record<Exclude<Pos, "GK">, Attrs> = {
  CB: { pac: 0.1, sho: 0.05, pas: 0.14, dri: 0.1, def: 0.34, phy: 0.27 },
  LB: { pac: 0.22, sho: 0.08, pas: 0.18, dri: 0.16, def: 0.2, phy: 0.16 },
  RB: { pac: 0.22, sho: 0.08, pas: 0.18, dri: 0.16, def: 0.2, phy: 0.16 },
  CDM: { pac: 0.12, sho: 0.08, pas: 0.22, dri: 0.14, def: 0.26, phy: 0.18 },
  CM: { pac: 0.14, sho: 0.14, pas: 0.26, dri: 0.2, def: 0.14, phy: 0.12 },
  CAM: { pac: 0.16, sho: 0.2, pas: 0.24, dri: 0.28, def: 0.04, phy: 0.08 },
  LW: { pac: 0.24, sho: 0.2, pas: 0.14, dri: 0.28, def: 0.04, phy: 0.1 },
  RW: { pac: 0.24, sho: 0.2, pas: 0.14, dri: 0.28, def: 0.04, phy: 0.1 },
  ST: { pac: 0.18, sho: 0.32, pas: 0.1, dri: 0.18, def: 0.04, phy: 0.18 },
};

/** Peso de cada estadística de portero en su GRL (suman 1). */
export const GK_WEIGHTS: GkAttrs = { div: 0.22, han: 0.2, kic: 0.08, ref: 0.24, spe: 0.04, pos: 0.22 };

/** Pesos de la posición; si llega una posición desconocida (datos viejos) se trata como mediocampista. */
function outWeights(pos: Exclude<Pos, "GK">): Attrs {
  return OUT_WEIGHTS[pos] ?? OUT_WEIGHTS.CM;
}

export function weightsFor(pos: Pos): Record<string, number> {
  return pos === "GK" ? { ...GK_WEIGHTS } : { ...outWeights(pos) };
}

export function ovrFromOutfield(pos: Exclude<Pos, "GK">, a: Attrs): number {
  const w = outWeights(pos);
  const raw =
    a.pac * w.pac + a.sho * w.sho + a.pas * w.pas + a.dri * w.dri + a.def * w.def + a.phy * w.phy;
  return clamp(Math.round(raw), 40, 100);
}

export function ovrFromGk(g: GkAttrs): number {
  const w = GK_WEIGHTS;
  const raw = g.div * w.div + g.han * w.han + g.kic * w.kic + g.ref * w.ref + g.spe * w.spe + g.pos * w.pos;
  return clamp(Math.round(raw), 40, 100);
}

/** GRL que sale de las estadísticas actuales del jugador. */
export function ovrOf(p: Pick<Player, "pos" | "attrs" | "gk" | "ovr">): number {
  if (p.pos === "GK") return ovrFromGk(ensureGk(p));
  return ovrFromOutfield(p.pos, p.attrs);
}

export function getStat(p: Pick<Player, "pos" | "attrs" | "gk" | "ovr">, key: TrainStat): number {
  if (p.pos === "GK") return (ensureGk(p) as unknown as Record<string, number>)[key] ?? 40;
  return (p.attrs as unknown as Record<string, number>)[key] ?? 40;
}

export function setStat(p: Pick<Player, "pos" | "attrs" | "gk" | "ovr">, key: TrainStat, value: number) {
  const v = clamp(Math.round(value), 40, 100);
  if (p.pos === "GK") {
    (ensureGk(p) as unknown as Record<string, number>)[key] = v;
  } else {
    (p.attrs as unknown as Record<string, number>)[key] = v;
  }
}

/** Foto de todas las estadísticas del jugador (para los informes de entrenamiento). */
export function statSnapshot(p: Pick<Player, "pos" | "attrs" | "gk" | "ovr">): Partial<Record<TrainStat, number>> {
  const out: Partial<Record<TrainStat, number>> = {};
  for (const k of statKeysFor(p.pos)) out[k] = getStat(p, k);
  return out;
}

/** Genera estadísticas de portero coherentes con su GRL. */
export function gkFor(ovr: number, rng: { int: (a: number, b: number) => number }): GkAttrs {
  const j = () => rng.int(-3, 3);
  const cap = (n: number) => clamp(Math.round(n), 42, 100);
  const base = ovr;
  const g: GkAttrs = {
    div: cap(base + 1 + j()),
    han: cap(base + j()),
    kic: cap(base - 6 + j()),
    ref: cap(base + 2 + j()),
    spe: cap(base - 14 + j()),
    pos: cap(base + j()),
  };
  return alignGk(g, ovr);
}

/** Si a un portero le faltan estadísticas de portero (partidas viejas), se le generan a partir de su GRL. */
export function ensureGk(p: Pick<Player, "pos" | "gk" | "ovr">): GkAttrs {
  if (!p.gk) {
    p.gk = alignGk(
      {
        div: clamp(p.ovr + 1, 42, 100),
        han: clamp(p.ovr, 42, 100),
        kic: clamp(p.ovr - 6, 42, 100),
        ref: clamp(p.ovr + 2, 42, 100),
        spe: clamp(p.ovr - 14, 42, 100),
        pos: clamp(p.ovr, 42, 100),
      },
      p.ovr,
    );
  }
  return p.gk;
}

type AnyStats = Record<string, number>;

interface AlignOpts {
  /** Desplazar todas las estadísticas por igual antes de afinar (para diferencias grandes). */
  uniform?: boolean;
  /** Orden de preferencia de las estadísticas a tocar (la primera se toca más). Por defecto, por peso. */
  order?: string[];
}

/**
 * Mueve las estadísticas para que su GRL calculado sea exactamente `target`.
 * Con diferencias grandes primero desplaza todas por igual (así un 86 nunca queda con stats de 45)
 * y luego afina de a un punto. Con diferencias chicas solo afina, tocando las estadísticas que
 * más pesan en esa posición (o las físicas si es por edad), que es lo que pasa en la realidad.
 */
function alignGeneric(
  stats: AnyStats,
  weights: Record<string, number>,
  target: number,
  calc: (s: AnyStats) => number,
  opts: AlignOpts = { uniform: true },
): AnyStats {
  const s = { ...stats };
  const byWeight = Object.keys(weights).sort((a, b) => weights[b]! - weights[a]!);
  const keys = opts.order?.length
    ? [...opts.order.filter((k) => k in weights), ...byWeight.filter((k) => !opts.order!.includes(k))]
    : byWeight;
  const first = calc(s) - target;
  if (first !== 0 && opts.uniform) {
    for (const k of byWeight) s[k] = clamp(s[k]! - first, 40, 100);
  }
  for (let i = 0; i < 200; i++) {
    const diff = target - calc(s);
    if (diff === 0) break;
    const dir = diff > 0 ? 1 : -1;
    // Rota entre las estadísticas con margen, de la preferida a la menos preferida.
    const candidates = keys.filter((k) => (dir > 0 ? s[k]! < 100 : s[k]! > 40));
    if (!candidates.length) break;
    const k = candidates[i % Math.min(candidates.length, 3)]!;
    s[k] = clamp(s[k]! + dir, 40, 100);
  }
  return s;
}

export function alignOutfield(pos: Exclude<Pos, "GK">, attrs: Attrs, target: number, opts?: AlignOpts): Attrs {
  return alignGeneric(
    attrs as unknown as AnyStats,
    outWeights(pos) as unknown as Record<string, number>,
    target,
    (s) => ovrFromOutfield(pos, s as unknown as Attrs),
    opts,
  ) as unknown as Attrs;
}

export function alignGk(g: GkAttrs, target: number, opts?: AlignOpts): GkAttrs {
  return alignGeneric(
    g as unknown as AnyStats,
    GK_WEIGHTS as unknown as Record<string, number>,
    target,
    (s) => ovrFromGk(s as unknown as GkAttrs),
    opts,
  ) as unknown as GkAttrs;
}

/** Cambios de hasta este tamaño se reparten con criterio; más que eso se desplaza todo por igual. */
const SMALL_SHIFT = 5;
const OUT_PHYSICAL_ORDER = ["pac", "phy"];
const GK_PHYSICAL_ORDER = ["spe", "ref", "div"];

/** Cómo repartir un cambio de media: si baja por edad, se van primero las físicas. */
function shiftOpts(p: Pick<Player, "pos" | "age">, diff: number): AlignOpts {
  const small = Math.abs(diff) <= SMALL_SHIFT;
  if (!small) return { uniform: true };
  const ageing = diff < 0 && p.age >= 29;
  return {
    uniform: false,
    order: ageing ? (p.pos === "GK" ? GK_PHYSICAL_ORDER : OUT_PHYSICAL_ORDER) : undefined,
  };
}

/**
 * Deja las estadísticas del jugador acordes a su GRL. Se llama cada vez que la media cambia por
 * fuera del entrenamiento (partidos, edad, cesiones...). Un cambio chico sube/baja las
 * estadísticas que más pesan en su posición; si la diferencia es enorme (partidas viejas con un
 * 86 y stats de 45) se reparte de nuevo con el perfil típico de su posición.
 */
export function syncStats(p: Player, rebuild?: (pos: Pos, ovr: number) => Attrs) {
  if (p.pos === "GK") {
    const g = ensureGk(p);
    const calc = ovrFromGk(g);
    if (calc === p.ovr) return;
    p.gk = alignGk(g, p.ovr, shiftOpts(p, p.ovr - calc));
    return;
  }
  const calc = ovrFromOutfield(p.pos, p.attrs);
  if (calc === p.ovr) return;
  if (rebuild && Math.abs(calc - p.ovr) > 8) {
    p.attrs = alignOutfield(p.pos, rebuild(p.pos, p.ovr), p.ovr);
    return;
  }
  p.attrs = alignOutfield(p.pos, p.attrs, p.ovr, shiftOpts(p, p.ovr - calc));
}

/**
 * Cambia la media de un jugador y arrastra sus estadísticas en el mismo paso, para que nunca
 * queden desfasadas (un 86 con stats de 45).
 */
export function setOvrAndSync(p: Player, ovr: number) {
  p.ovr = clamp(Math.round(ovr), 40, 100);
  syncStats(p);
}
