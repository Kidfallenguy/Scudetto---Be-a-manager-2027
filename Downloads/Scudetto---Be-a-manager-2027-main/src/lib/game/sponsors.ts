import { BRANDS, TIER_INFO, brandById, eliteChance, tierOpenTo, type Brand } from "./brands";
import { clubById, playableLeague } from "./clubs";
import { formatMoney } from "./format";
import { Rng } from "./rng";
import type {
  ClubId,
  GameSave,
  HonourCounts,
  Sponsor,
  SponsorBenefit,
  SponsorBenefitKind,
  SponsorOffer,
  SponsorSeasonRecord,
  SponsorTier,
  Standing,
} from "./types";

/** Máximo de patrocinadores activos que puede tener un club a la vez. */
export const MAX_ACTIVE_SPONSORS = 3;
/** Cuántas ofertas trae cada búsqueda. */
export const OFFERS_PER_SEARCH = 4;
/** Días de espera (~4 meses) tras buscar o firmar, y antes de poder reemplazar un contrato firmado. */
export const SPONSOR_COOLDOWN_DAYS = 120;
/** Rescindir un contrato antes de tiempo cuesta esta fracción de un pago anual del patrocinador. */
export const BREAK_FEE_RATE = 0.5;

/* ------------------------------------------------------------------ */
/* Catálogo de beneficios                                              */
/* ------------------------------------------------------------------ */

export const BENEFIT_KINDS: SponsorBenefitKind[] = [
  "fixed",
  "objectives",
  "matchday",
  "fans",
  "prestige",
  "titles",
  "qualification",
];

export const BENEFIT_TITLE: Record<SponsorBenefitKind, string> = {
  fixed: "Más dinero fijo",
  objectives: "Bonus por objetivos",
  matchday: "Más ingresos por partidos",
  fans: "Más seguidores",
  prestige: "Mayor prestigio",
  titles: "Bonus por títulos",
  qualification: "Bonus por clasificar",
};

/** Texto corto con el valor concreto de un beneficio. */
export function benefitText(b: SponsorBenefit): string {
  switch (b.kind) {
    case "fixed":
      return `+${formatMoney(b.value)} fijos por temporada`;
    case "objectives":
      return `${formatMoney(b.value)} por cada objetivo de la dirigencia cumplido`;
    case "matchday":
      return `+${b.value}% en ingresos por partido`;
    case "fans":
      return `+${formatFans(b.value)} seguidores`;
    case "prestige":
      return `+${b.value} de prestigio para el club`;
    case "titles":
      return `${formatMoney(b.value)} por cada título ganado`;
    case "qualification":
      return `Hasta ${formatMoney(b.value)} por clasificar a Champions o Libertadores`;
  }
}

/** Cuánto paga cada competición respecto del valor completo del bonus de clasificación. */
export const QUALIFICATION_WEIGHT = {
  ucl: 1,
  libertadores: 1,
  uel: 0.6,
  sudamericana: 0.6,
  uecl: 0.4,
} as const;

export type QualificationComp = keyof typeof QUALIFICATION_WEIGHT;

export function formatFans(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;
  if (n >= 1000) return `${Math.round(n / 1000).toLocaleString("es-ES")} mil`;
  return String(Math.round(n));
}

/* ------------------------------------------------------------------ */
/* Estructura base: patrocinadores activos de un club                  */
/* ------------------------------------------------------------------ */

export type SponsorInput = {
  id?: string;
  brandId?: string;
  tier?: SponsorTier;
  name: string;
  payment: number;
  prestige: number;
  benefits?: SponsorBenefit[];
  duration: number;
  signedDay?: number;
};

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanBenefits(raw: unknown): SponsorBenefit[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<SponsorBenefitKind>();
  const out: SponsorBenefit[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const kind = (b as SponsorBenefit).kind;
    if (!BENEFIT_KINDS.includes(kind) || seen.has(kind)) continue;
    const value = (b as SponsorBenefit).value;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    seen.add(kind);
    out.push({ kind, value: Math.round(value) });
  }
  return out;
}

function isTier(v: unknown): v is SponsorTier {
  return typeof v === "string" && v in TIER_INFO;
}

/** Copia marca y nivel solo si son válidos (las partidas viejas no los tienen). */
function tierFields(raw: { brandId?: unknown; tier?: unknown }): { brandId?: string; tier?: SponsorTier } {
  const out: { brandId?: string; tier?: SponsorTier } = {};
  if (typeof raw.brandId === "string" && raw.brandId) out.brandId = raw.brandId;
  if (isTier(raw.tier)) out.tier = raw.tier;
  return out;
}

/** Arma un patrocinador nuevo con el contrato completo por delante. */
export function createSponsor(input: SponsorInput): Sponsor {
  const duration = Math.max(1, Math.round(num(input.duration, 1, 10, 1)));
  return {
    id: input.id ?? `sp-${Math.random().toString(36).slice(2, 10)}`,
    ...tierFields(input),
    name: input.name.trim(),
    payment: Math.max(0, Math.round(num(input.payment, 0, Number.MAX_SAFE_INTEGER, 0))),
    prestige: Math.round(num(input.prestige, 0, 100, 0)),
    benefits: cleanBenefits(input.benefits),
    duration,
    seasonsLeft: duration,
    ...(typeof input.signedDay === "number" && Number.isFinite(input.signedDay)
      ? { signedDay: Math.round(input.signedDay) }
      : {}),
  };
}

export function isSponsorActive(sponsor: Sponsor): boolean {
  return sponsor.seasonsLeft > 0;
}

/** Patrocinadores con contrato vigente de un club. */
export function activeSponsors(save: GameSave, clubId: ClubId): Sponsor[] {
  return (save.clubSponsors?.[clubId] ?? []).filter(isSponsorActive);
}

export function canAddSponsor(save: GameSave, clubId: ClubId): boolean {
  return activeSponsors(save, clubId).length < MAX_ACTIVE_SPONSORS;
}

/** Suma un patrocinador al club. Devuelve un mensaje de error, o null si salió bien. */
export function addSponsor(save: GameSave, clubId: ClubId, sponsor: Sponsor): string | null {
  if (!isSponsorActive(sponsor)) return "El contrato del patrocinador ya no está vigente.";
  if (!canAddSponsor(save, clubId)) {
    return `El club ya tiene ${MAX_ACTIVE_SPONSORS} patrocinadores activos.`;
  }
  if (activeSponsors(save, clubId).some((s) => s.id === sponsor.id)) {
    return "Ese patrocinador ya está en el club.";
  }
  if (!save.clubSponsors) save.clubSponsors = {};
  // Los contratos vencidos se descartan al sumar uno nuevo.
  save.clubSponsors[clubId] = [...activeSponsors(save, clubId), sponsor];
  return null;
}

/** Da de baja un patrocinador del club. Devuelve true si existía. */
export function removeSponsor(save: GameSave, clubId: ClubId, sponsorId: string): boolean {
  const list = save.clubSponsors?.[clubId];
  if (!list || !list.some((s) => s.id === sponsorId)) return false;
  save.clubSponsors[clubId] = list.filter((s) => s.id !== sponsorId);
  return true;
}

/* ------------------------------------------------------------------ */
/* Beneficios: cuánto aportan los patrocinadores activos               */
/* ------------------------------------------------------------------ */

/** Suma el valor de un tipo de beneficio entre todos los patrocinadores activos. */
export function benefitTotal(save: GameSave, clubId: ClubId, kind: SponsorBenefitKind): number {
  let total = 0;
  for (const s of activeSponsors(save, clubId)) {
    for (const b of s.benefits) if (b.kind === kind) total += b.value;
  }
  return total;
}

/** Lo que un contrato paga en una temporada: dinero base más el fijo extra. */
export function sponsorSeasonPay(s: Pick<Sponsor, "payment" | "benefits">): number {
  return s.payment + s.benefits.filter((b) => b.kind === "fixed").reduce((n, b) => n + b.value, 0);
}

/** Dinero por temporada que suman los patrocinadores activos del club (base + fijos extra). */
export function sponsorIncome(save: GameSave, clubId: ClubId): number {
  return activeSponsors(save, clubId).reduce((sum, s) => sum + sponsorSeasonPay(s), 0);
}

/** Seguidores de base del club, según estadio y prestigio. */
export function baseFans(clubId: ClubId): number {
  const c = clubById(clubId);
  return Math.round((c.capacity * 8 * (0.55 + c.prestige / 100)) / 1000) * 1000;
}

export function fansOf(save: GameSave, clubId: ClubId): number {
  return baseFans(clubId) + benefitTotal(save, clubId, "fans");
}

/** Prestigio del club con el aporte de los patrocinadores (máx. 100). */
export function effectivePrestige(save: GameSave, clubId: ClubId): number {
  // Los sucesos inesperados pueden subir o bajar el prestigio del club del usuario (con tope).
  const events = clubId === save.clubId ? (save.events?.prestige ?? 0) : 0;
  return Math.max(0, Math.min(100, clubById(clubId).prestige + benefitTotal(save, clubId, "prestige") + events));
}

/** Extra por partido sobre el ingreso base: % de "partidos" más el empuje de los seguidores nuevos. */
export function sponsorMatchBonus(save: GameSave, base: number): number {
  const id = save.clubId;
  const pct = benefitTotal(save, id, "matchday") / 100;
  const fansPct = Math.min(0.5, (benefitTotal(save, id, "fans") / Math.max(1, baseFans(id))) * 0.5);
  return Math.round(base * (pct + fansPct));
}

/** Bonus por título ganado. Lo cobra solo el club del usuario. */
export function sponsorTitleBonus(save: GameSave): number {
  return benefitTotal(save, save.clubId, "titles");
}

/** Bonus por cada objetivo de la dirigencia cumplido (se llama una sola vez al cerrar la temporada). */
export function sponsorObjectiveBonus(save: GameSave): number {
  const met = save.board?.goals.filter((g) => g.state === "met").length ?? 0;
  return met * benefitTotal(save, save.clubId, "objectives");
}

/** Bonus por clasificar: se paga la mejor competición a la que entró el club. */
export function sponsorQualificationBonus(save: GameSave, comps: QualificationComp[]): number {
  if (!comps.length) return 0;
  const weight = Math.max(...comps.map((c) => QUALIFICATION_WEIGHT[c]));
  return Math.round(benefitTotal(save, save.clubId, "qualification") * weight);
}

/* ------------------------------------------------------------------ */
/* Reloj de contratos                                                  */
/* ------------------------------------------------------------------ */

function isoDay(iso?: string): number | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/** Número de día del calendario de juego (sigue corriendo entre temporadas). */
export function sponsorToday(save: GameSave): number {
  const cal = save.calendar ?? [];
  const slot = cal.length ? cal[Math.min(Math.max(0, save.cursor ?? 0), cal.length - 1)] : undefined;
  return isoDay(slot?.date) ?? save.season * 365 + (save.week ?? 0) * 7;
}

/** "3 semanas", "2 meses"... para mostrar cuánto falta. */
export function waitText(days: number): string {
  if (days >= 45) {
    const m = Math.round(days / 30);
    return `${m} ${m === 1 ? "mes" : "meses"}`;
  }
  const w = Math.max(1, Math.ceil(days / 7));
  return `${w} ${w === 1 ? "semana" : "semanas"}`;
}

/** Días que faltan para poder reemplazar este contrato (0 = ya se puede). Los viejos sin fecha se pueden. */
export function replaceDaysLeft(save: GameSave, s: Sponsor): number {
  if (typeof s.signedDay !== "number") return 0;
  return Math.max(0, s.signedDay + SPONSOR_COOLDOWN_DAYS - sponsorToday(save));
}

/** Contratos del club que ya pasaron el período de espera y se pueden reemplazar. */
export function replaceableSponsors(save: GameSave, clubId: ClubId = save.clubId): Sponsor[] {
  return activeSponsors(save, clubId).filter((s) => replaceDaysLeft(save, s) === 0);
}

/** Lo que cuesta romper el contrato antes de tiempo. */
export function breakFee(s: Pick<Sponsor, "payment" | "benefits">): number {
  return Math.round((sponsorSeasonPay(s) * BREAK_FEE_RATE) / 10_000) * 10_000;
}

export interface SearchStatus {
  ok: boolean;
  reason: string | null;
  /** Días hasta que se pueda buscar (0 si se puede o si no hay nada que esperar). */
  daysLeft: number;
}

/** ¿Puede el club buscar ofertas ahora? Hay que esperar ~4 meses y tener algo que cubrir o reemplazar. */
export function sponsorSearchStatus(save: GameSave): SearchStatus {
  const today = sponsorToday(save);
  const lock = Math.max(0, (save.sponsorLockUntil ?? 0) - today);
  if (lock > 0) {
    return {
      ok: false,
      daysLeft: lock,
      reason: `Tenés que esperar unos ${waitText(lock)} para volver a buscar patrocinadores.`,
    };
  }
  const active = activeSponsors(save, save.clubId);
  if (active.length >= MAX_ACTIVE_SPONSORS && !active.some((s) => replaceDaysLeft(save, s) === 0)) {
    const soonest = Math.min(...active.map((s) => replaceDaysLeft(save, s)));
    return {
      ok: false,
      daysLeft: soonest,
      reason: `Tenés ${MAX_ACTIVE_SPONSORS} patrocinadores y ninguno lleva el tiempo suficiente: el primero se puede reemplazar en ${waitText(soonest)}.`,
    };
  }
  return { ok: true, daysLeft: 0, reason: null };
}

/* ------------------------------------------------------------------ */
/* Atractivo comercial: lo que define qué marcas se interesan          */
/* ------------------------------------------------------------------ */

export interface AppealFactor {
  key: string;
  label: string;
  /** Puntos que suma (o resta) al atractivo del club. */
  points: number;
  detail: string;
}

export interface CommercialReport {
  /** Atractivo final (0-100): define qué niveles de marca se interesan y cuánto pagan. */
  score: number;
  /** Prestigio del club (con el aporte de los patrocinadores). */
  prestige: number;
  /** Prestigio más factores de rendimiento, sin el crecimiento. */
  base: number;
  /** Puntos por crecimiento frente a las temporadas anteriores. */
  growth: number;
  factors: AppealFactor[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Cuánto vale cada título para la imagen del club. */
const TITLE_WEIGHT: Record<keyof HonourCounts, number> = {
  scudetto: 5,
  ucl: 6,
  libertadores: 5,
  mundial: 3,
  uel: 3,
  sudamericana: 2.5,
  uecl: 2,
  coppa: 2,
  recopa: 1,
  supercoppa: 0.8,
  trofeo: 0.8,
};

/** Cuánto pesa un título según cuántas temporadas pasaron. */
const TITLE_DECAY = [1, 1, 0.6, 0.3];

const DIVISION_POINTS: Record<string, number> = {
  premier: 3,
  laliga: 2,
  serieA: 2,
  bundesliga: 1.5,
  ligue1: 0.5,
  argentina: -1,
};

const DIVISION_NAME: Record<string, string> = {
  premier: "Premier League",
  laliga: "La Liga",
  serieA: "Serie A",
  bundesliga: "Bundesliga",
  ligue1: "Ligue 1",
  argentina: "Liga Argentina",
};

function sortRows(rows: Standing[]): Standing[] {
  return [...rows].sort(
    (a, b) =>
      b.pts - a.pts ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.clubId.localeCompare(b.clubId),
  );
}

function leagueRows(save: GameSave, clubId: ClubId): Standing[] {
  const league = playableLeague(clubById(clubId).league);
  const rows = save.leagueTables?.[league];
  if (rows?.length) return rows;
  return clubId === save.clubId ? (save.standings ?? []) : [];
}

interface LeagueForm {
  place: number;
  teams: number;
  played: number;
  ppg: number;
  gdpg: number;
}

/** Cómo va el club en la liga ahora mismo (null si todavía no jugó). */
function leagueForm(save: GameSave, clubId: ClubId): LeagueForm | null {
  const rows = sortRows(leagueRows(save, clubId));
  const idx = rows.findIndex((r) => r.clubId === clubId);
  const row = rows[idx];
  if (!row || row.played <= 0) return null;
  return {
    place: idx + 1,
    teams: rows.length,
    played: row.played,
    ppg: row.pts / row.played,
    gdpg: (row.gf - row.ga) / row.played,
  };
}

/** Qué tan avanzada está la temporada de liga del club (0 al arrancar, 1 al terminar). */
function seasonProgress(form: LeagueForm | null): number {
  if (!form) return 0;
  return clampN(form.played / Math.max(1, 2 * (form.teams - 1)), 0, 1);
}

/** Puesto como número entre -1 (último) y +1 (campeón). */
function placeScore(place: number, teams: number): number {
  const half = Math.max(0.5, (teams - 1) / 2);
  return clampN((half - (place - 1)) / half, -1, 1);
}

const CONTINENTAL: Array<{ label: string; points: number; test: (s: GameSave, id: ClubId) => boolean }> = [
  { label: "Champions League", points: 5, test: (s, id) => (s.uclGroups ?? []).some((g) => g.includes(id)) },
  { label: "Libertadores", points: 4.5, test: (s, id) => (s.libGroups ?? []).some((g) => g.includes(id)) },
  { label: "Europa League", points: 3, test: (s, id) => (s.uelTeams ?? []).includes(id) },
  { label: "Sudamericana", points: 2, test: (s, id) => (s.sudTeams ?? []).includes(id) },
  { label: "Conference League", points: 2, test: (s, id) => (s.ueclTeams ?? []).includes(id) },
];

/**
 * Atractivo comercial del club (0-100). Parte del prestigio y suma o resta por:
 * fans, división, posición en la liga, títulos, copas continentales y rendimiento de la
 * temporada, más el crecimiento frente a las últimas temporadas. Eso es lo que decide qué
 * niveles de marca se interesan por el club y cuánto pagan.
 *
 * Los datos de títulos y de historial solo existen para el club del usuario.
 */
export function commercialReport(save: GameSave, clubId: ClubId = save.clubId): CommercialReport {
  const club = clubById(clubId);
  const own = clubId === save.clubId;
  const prestige = effectivePrestige(save, clubId);
  const history = own ? (save.sponsorHistory ?? []) : [];
  const last = history[history.length - 1];
  const factors: AppealFactor[] = [];
  const add = (key: string, label: string, points: number, detail: string) =>
    factors.push({ key, label, points: round1(points), detail });

  // Fans
  const fans = fansOf(save, clubId);
  add(
    "fans",
    "Fans",
    clampN((Math.log10(Math.max(1000, fans)) - 5.5) * 10, -4, 5),
    `${formatFans(fans)} seguidores`,
  );

  // División
  const league = playableLeague(club.league);
  add("division", "División", DIVISION_POINTS[league] ?? 0, DIVISION_NAME[league] ?? "Liga");

  // Posición y rendimiento: lo que va de la temporada pesa más a medida que se juega; al
  // arrancar manda lo que pasó la temporada anterior.
  const form = leagueForm(save, clubId);
  const p = seasonProgress(form);
  const histPlace = last ? placeScore(last.place, last.teams) : 0;
  const curPlace = form ? placeScore(form.place, form.teams) : 0;
  const placeMix = histPlace * (1 - p) + curPlace * p;
  add(
    "position",
    "Posición en la liga",
    placeMix * 6,
    form
      ? `${form.place}º de ${form.teams} en la tabla`
      : last
        ? `Terminó ${last.place}º la temporada pasada`
        : "Todavía sin partidos",
  );

  const histPpg = last ? last.ppg : 1.4;
  const histGd = last ? last.gdpg : 0;
  const ppg = histPpg * (1 - p) + (form ? form.ppg : histPpg) * p;
  const gd = histGd * (1 - p) + (form ? form.gdpg : histGd) * p;
  add(
    "form",
    "Rendimiento de la temporada",
    clampN((ppg - 1.4) * 4, -4, 5) + clampN(gd * 1.5, -2, 2),
    form || last ? `${ppg.toFixed(2).replace(".", ",")} puntos por partido` : "Todavía sin partidos",
  );

  // Títulos
  if (own) {
    let recent = 0;
    let recentCount = 0;
    for (const t of save.careerTrophies ?? []) {
      const age = save.season - t.season;
      const decay = TITLE_DECAY[age];
      if (decay === undefined || age < 0) continue;
      recent += (TITLE_WEIGHT[t.kind] ?? 0) * decay;
      recentCount++;
    }
    let legacy = 0;
    for (const k of Object.keys(TITLE_WEIGHT) as Array<keyof HonourCounts>) {
      legacy += (save.honours?.[k] ?? 0) * TITLE_WEIGHT[k];
    }
    add(
      "titles",
      "Títulos",
      Math.min(10, recent) + Math.min(3, legacy / 25),
      recentCount
        ? `${recentCount} ${recentCount === 1 ? "título" : "títulos"} en las últimas 4 temporadas`
        : "Sin títulos recientes",
    );
  }

  // Copas continentales de esta temporada
  const cont = CONTINENTAL.find((c) => c.test(save, clubId));
  add("continental", "Copa continental", cont?.points ?? 0, cont ? `Juega la ${cont.label}` : "Sin copa continental");

  const adjust = clampN(
    factors.reduce((n, f) => n + f.points, 0),
    -12,
    16,
  );
  const base = prestige + adjust;

  // Crecimiento: cuánto subió (o bajó) el club frente a la temporada más vieja registrada.
  const oldest = history[0];
  const growth = oldest ? clampN((base - oldest.base) * 0.35, -3, 5) : 0;
  add(
    "growth",
    "Crecimiento del club",
    growth,
    !oldest ? "Todavía sin historial" : growth > 0.4 ? "Viene en alza" : growth < -0.4 ? "Viene en baja" : "Sin cambios grandes",
  );

  return {
    score: Math.round(clampN(base + growth, 0, 100)),
    prestige,
    base: round1(base),
    growth: round1(growth),
    factors,
  };
}

/** Resumen de la temporada que termina, tomado de la tabla final de la liga. */
function seasonRecord(prev: GameSave): SponsorSeasonRecord | null {
  const rows = sortRows(leagueRows(prev, prev.clubId));
  const idx = rows.findIndex((r) => r.clubId === prev.clubId);
  const row = rows[idx];
  if (!row || row.played <= 0) return null;
  return {
    season: prev.season,
    place: idx + 1,
    teams: rows.length,
    ppg: Math.round((row.pts / row.played) * 100) / 100,
    gdpg: Math.round(((row.gf - row.ga) / row.played) * 100) / 100,
    base: commercialReport(prev, prev.clubId).base,
  };
}

/* ------------------------------------------------------------------ */
/* Ofertas                                                             */
/* ------------------------------------------------------------------ */

/** Escala de pago del club: crece con su atractivo comercial. */
function clubScale(appeal: number): number {
  return 2_500_000 * Math.pow(1.06, appeal - 60);
}

function benefitValue(
  kind: SponsorBenefitKind,
  base: number,
  clubId: ClubId,
  tier: SponsorTier,
  rng: Rng,
): number {
  const j = 0.75 + rng.float() * 0.5;
  switch (kind) {
    case "fixed":
      return Math.round((base * 0.3 * j) / 10_000) * 10_000;
    case "objectives":
      return Math.round((base * 0.15 * j) / 10_000) * 10_000;
    case "matchday":
      return Math.round(8 + rng.float() * 17);
    case "fans":
      return Math.round((baseFans(clubId) * (0.03 + rng.float() * 0.07)) / 1000) * 1000;
    case "prestige": {
      const [lo, hi] = TIER_INFO[tier].prestigeBenefit;
      return rng.int(lo, hi);
    }
    case "titles":
      return Math.round((base * 0.8 * j) / 10_000) * 10_000;
    case "qualification":
      return Math.round((base * 0.4 * j) / 10_000) * 10_000;
  }
}

/** Qué tanto le interesa a una marca de este nivel un club con ese atractivo (0-1). */
function tierWeight(tier: SponsorTier, appeal: number): number {
  const d = (appeal - TIER_INFO[tier].idealAppeal) / 11;
  return Math.max(0.02, Math.exp(-d * d));
}

/** Saca una marca del pool al azar, con más chance para las que mejor encajan con el club. */
function pickBrand(pool: Brand[], appeal: number, rng: Rng): Brand {
  const weights = pool.map((b) => tierWeight(b.tier, appeal));
  let roll = rng.float() * weights.reduce((n, w) => n + w, 0);
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

function makeOffer(
  save: GameSave,
  brand: Brand,
  appeal: number,
  clubId: ClubId,
  index: number,
  rng: Rng,
  renewal: boolean,
): SponsorOffer {
  const info = TIER_INFO[brand.tier];
  const base = clubScale(appeal) * info.payMult;
  const count = rng.int(1, 3);
  const kinds = rng.shuffle([...BENEFIT_KINDS]).slice(0, count);
  const benefits: SponsorBenefit[] = kinds.map((kind) => ({
    kind,
    value: benefitValue(kind, base, clubId, brand.tier, rng),
  }));
  const trim = 1 - 0.1 * count;
  const payment = Math.round((base * brand.wealth * trim * (0.85 + rng.float() * 0.35)) / 10_000) * 10_000;
  return {
    id: `so-${save.season}-${index}-${rng.int(1000, 9999)}`,
    brandId: brand.id,
    tier: brand.tier,
    name: brand.name,
    payment: Math.max(100_000, payment),
    prestige: brand.prestige,
    benefits: cleanBenefits(benefits),
    duration: rng.int(info.duration[0], info.duration[1]),
    ...(renewal ? { renewal: true } : {}),
  };
}

/**
 * Genera las ofertas que recibe un club. Dependen de su atractivo comercial (commercialReport):
 * prestigio, fans, división, posición, títulos, copas, rendimiento y crecimiento. Un club
 * chico arranca con marcas Locales y Regionales y va desbloqueando Nacional, Internacional y
 * Élite a medida que crece. Es determinista según la semilla, la temporada y el mes de juego.
 *
 * - Las marcas Élite solo aparecen para clubes grandes, con poca chance, y nunca más de una.
 * - `renewBrandIds`: marcas cuyo contrato terminó. Si el club les sigue interesando, proponen renovar.
 * - Cada beneficio extra baja un poco el pago base: más beneficios no significa mejor oferta.
 */
export function generateSponsorOffers(
  save: GameSave,
  clubId: ClubId = save.clubId,
  renewBrandIds: string[] = [],
): SponsorOffer[] {
  const rng = new Rng(save.seed + save.season * 131 + 7919 + Math.floor(sponsorToday(save) / 30) * 17);
  const appeal = commercialReport(save, clubId).score;
  const taken = new Set(activeSponsors(save, clubId).map((s) => s.brandId ?? s.name));
  const offers: SponsorOffer[] = [];
  let elites = 0;

  // Renovaciones primero (siempre queda lugar para al menos una marca nueva).
  for (const id of renewBrandIds) {
    if (offers.length >= OFFERS_PER_SEARCH - 1) break;
    const brand = brandById(id);
    if (!brand || taken.has(brand.id)) continue;
    const info = TIER_INFO[brand.tier];
    if (appeal < info.minAppeal - 6 || appeal > info.maxAppeal) continue;
    if (brand.tier === "elite") elites++;
    taken.add(brand.id);
    offers.push(makeOffer(save, brand, appeal, clubId, offers.length, rng, true));
  }

  const eliteOpen = rng.chance(eliteChance(appeal));
  const pool = BRANDS.filter(
    (b) =>
      tierOpenTo(b.tier, appeal) &&
      (b.tier !== "elite" || (eliteOpen && elites === 0)) &&
      !taken.has(b.id) &&
      !taken.has(b.name),
  );

  while (offers.length < OFFERS_PER_SEARCH && pool.length) {
    const brand = pickBrand(pool, appeal, rng);
    pool.splice(pool.indexOf(brand), 1);
    if (brand.tier === "elite") {
      if (elites >= 1) continue;
      elites++;
    }
    offers.push(makeOffer(save, brand, appeal, clubId, offers.length, rng, false));
  }
  return offers;
}

/** Busca patrocinadores: deja cuatro ofertas para comparar. Después hay que esperar ~4 meses. */
export function searchSponsors(save: GameSave): string | null {
  const status = sponsorSearchStatus(save);
  if (!status.ok) return status.reason;
  const offers = generateSponsorOffers(save);
  if (!offers.length) return "Ninguna marca se interesó por el club en este momento.";
  save.sponsorOffers = offers;
  save.sponsorSearchSeason = save.season;
  save.sponsorLockUntil = sponsorToday(save) + SPONSOR_COOLDOWN_DAYS;
  return null;
}

/**
 * Firma una oferta: entra al club y cobra el primer pago de temporada. Si el club ya tiene
 * tres patrocinadores hay que elegir cuál reemplazar (`replaceId`): solo vale con contratos de
 * más de ~4 meses y rescindir cuesta una parte del pago anual. Firmar reinicia la espera.
 */
export function acceptSponsorOffer(save: GameSave, offerId: string, replaceId?: string): string | null {
  const offer = (save.sponsorOffers ?? []).find((o) => o.id === offerId);
  if (!offer) return "Esa oferta ya no está disponible.";
  const today = sponsorToday(save);
  const active = activeSponsors(save, save.clubId);

  let replaced: Sponsor | undefined;
  let fee = 0;
  if (active.length >= MAX_ACTIVE_SPONSORS) {
    if (!replaceId) return `Ya tenés ${MAX_ACTIVE_SPONSORS} patrocinadores: elegí cuál reemplazar.`;
    replaced = active.find((s) => s.id === replaceId);
    if (!replaced) return "Ese contrato ya no está vigente.";
    const wait = replaceDaysLeft(save, replaced);
    if (wait > 0) return `Ese contrato es muy reciente: se puede reemplazar en ${waitText(wait)}.`;
    fee = breakFee(replaced);
    if (save.budget < fee) return `Rescindir con ${replaced.name} cuesta ${formatMoney(fee)} y no alcanza la caja.`;
  }

  const others = active.filter((s) => s.id !== replaced?.id);
  if (offer.brandId && others.some((s) => s.brandId === offer.brandId)) {
    return "Ya tenés un contrato vigente con esa marca.";
  }

  const sponsor = createSponsor({ ...offer, signedDay: today });
  if (replaced) removeSponsor(save, save.clubId, replaced.id);
  const err = addSponsor(save, save.clubId, sponsor);
  if (err) {
    if (replaced) save.clubSponsors[save.clubId] = [...(save.clubSponsors[save.clubId] ?? []), replaced];
    return err;
  }

  const pay = sponsorSeasonPay(sponsor);
  save.budget += pay - fee;
  save.sponsorOffers = save.sponsorOffers.filter((o) => o.id !== offerId);
  save.sponsorLockUntil = Math.max(save.sponsorLockUntil ?? 0, today + SPONSOR_COOLDOWN_DAYS);

  const years = `${sponsor.duration} ${sponsor.duration === 1 ? "temporada" : "temporadas"}`;
  save.news.unshift({
    id: `n-sp-${offer.id}`,
    week: save.week,
    tone: "good",
    title: offer.renewal ? `Renovación: ${sponsor.name}` : `Nuevo patrocinador: ${sponsor.name}`,
    body: replaced
      ? `Reemplaza a ${replaced.name} (rescisión: ${formatMoney(fee)}). Contrato por ${years}. Primer pago: ${formatMoney(pay)}.`
      : `Contrato por ${years}. Primer pago: ${formatMoney(pay)}.`,
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Cambio de temporada                                                 */
/* ------------------------------------------------------------------ */

/**
 * Cierra el año de los contratos: guarda cómo le fue al club (`prev` es la temporada que
 * termina, con su tabla final), paga el bonus de clasificación, descuenta una temporada a
 * todos los patrocinadores, da de baja los vencidos y cobra el pago de los que siguen.
 * Si terminó algún contrato, genera ofertas nuevas (con renovaciones de las marcas que se van).
 */
export function rolloverSponsors(save: GameSave, qualified: QualificationComp[], prev?: GameSave) {
  const record = prev ? seasonRecord(prev) : null;
  if (record) save.sponsorHistory = [...(save.sponsorHistory ?? []), record].slice(-4);

  const qual = sponsorQualificationBonus(save, qualified);
  if (qual > 0) {
    save.budget += qual;
    save.news.unshift({
      id: `n-spq-${save.season}`,
      week: 0,
      tone: "good",
      title: "Bonus de patrocinadores por clasificar",
      body: `Tus patrocinadores pagan ${formatMoney(qual)} por la clasificación continental.`,
    });
  }

  const before = save.clubSponsors ?? {};
  const after: Record<ClubId, Sponsor[]> = {};
  const ended: string[] = [];
  const endedBrands: string[] = [];
  let renewedPay = 0;
  for (const [clubId, list] of Object.entries(before)) {
    const kept: Sponsor[] = [];
    for (const s of list) {
      if (!isSponsorActive(s)) continue;
      const left = s.seasonsLeft - 1;
      if (left <= 0) {
        if (clubId === save.clubId) {
          ended.push(s.name);
          if (s.brandId) endedBrands.push(s.brandId);
        }
        continue;
      }
      kept.push({ ...s, seasonsLeft: left });
      if (clubId === save.clubId) renewedPay += sponsorSeasonPay(s);
    }
    if (kept.length) after[clubId] = kept;
  }
  save.clubSponsors = after;
  save.sponsorOffers = ended.length ? generateSponsorOffers(save, save.clubId, endedBrands) : [];

  if (renewedPay > 0) {
    save.budget += renewedPay;
    save.news.unshift({
      id: `n-spp-${save.season}`,
      week: 0,
      tone: "good",
      title: "Pago de patrocinadores",
      body: `Entran ${formatMoney(renewedPay)} de tus patrocinadores para la nueva temporada.`,
    });
  }
  if (ended.length) {
    const n = save.sponsorOffers.length;
    save.news.unshift({
      id: `n-spe-${save.season}`,
      week: 0,
      tone: "neutral",
      title: ended.length === 1 ? "Termina un contrato de patrocinio" : "Terminan contratos de patrocinio",
      body: `${ended.join(", ")} ${ended.length === 1 ? "terminó su contrato" : "terminaron sus contratos"}. ${
        n ? `Hay ${n} ${n === 1 ? "oferta nueva" : "ofertas nuevas"} en Patrocinadores.` : "Ninguna marca hizo ofertas por ahora."
      }`,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Sanear partidas guardadas                                           */
/* ------------------------------------------------------------------ */

function normalizeSponsorBase(raw: unknown): Omit<Sponsor, "seasonsLeft" | "signedDay"> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<Sponsor>;
  if (typeof r.id !== "string" || typeof r.name !== "string" || !r.name.trim()) return null;
  const fields = tierFields(r);
  // Si la marca existe en el catálogo, el nivel sale de ahí (corrige guardados con datos raros).
  const brand = brandById(fields.brandId);
  if (brand) fields.tier = brand.tier;
  return {
    id: r.id,
    ...fields,
    name: r.name,
    payment: Math.max(0, num(r.payment, 0, Number.MAX_SAFE_INTEGER, 0)),
    prestige: num(r.prestige, 0, 100, 0),
    benefits: cleanBenefits(r.benefits),
    duration: Math.max(1, Math.round(num(r.duration, 1, 10, 1))),
  };
}

function normalizeSponsor(raw: unknown): Sponsor | null {
  const base = normalizeSponsorBase(raw);
  if (!base) return null;
  const r = raw as Partial<Sponsor>;
  const sponsor: Sponsor = {
    ...base,
    seasonsLeft: Math.round(num(r.seasonsLeft, 0, base.duration, base.duration)),
  };
  if (typeof r.signedDay === "number" && Number.isFinite(r.signedDay)) sponsor.signedDay = Math.round(r.signedDay);
  return sponsor;
}

/** Sanea los patrocinadores de una partida (también sirve para partidas viejas sin el campo). */
export function normalizeClubSponsors(raw: unknown): Record<ClubId, Sponsor[]> {
  const out: Record<ClubId, Sponsor[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [clubId, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const valid = list.map(normalizeSponsor).filter((s): s is Sponsor => s !== null);
    // Nunca más de 3 activos; los vencidos se descartan.
    const active = valid.filter(isSponsorActive).slice(0, MAX_ACTIVE_SPONSORS);
    if (active.length) out[clubId] = active;
  }
  return out;
}

export function normalizeSponsorOffers(raw: unknown): SponsorOffer[] {
  if (!Array.isArray(raw)) return [];
  const out: SponsorOffer[] = [];
  for (const item of raw) {
    const base = normalizeSponsorBase(item);
    if (!base) continue;
    out.push((item as SponsorOffer).renewal === true ? { ...base, renewal: true } : base);
  }
  return out;
}

export function normalizeSponsorLock(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : null;
}

export function normalizeSponsorHistory(raw: unknown): SponsorSeasonRecord[] {
  if (!Array.isArray(raw)) return [];
  const out: SponsorSeasonRecord[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const x = r as Partial<SponsorSeasonRecord>;
    if (typeof x.season !== "number" || typeof x.place !== "number" || typeof x.teams !== "number") continue;
    out.push({
      season: x.season,
      place: Math.max(1, Math.round(x.place)),
      teams: Math.max(2, Math.round(x.teams)),
      ppg: num(x.ppg, 0, 3, 1.4),
      gdpg: num(x.gdpg, -6, 6, 0),
      base: num(x.base, 0, 130, 60),
    });
  }
  return out.slice(-4);
}
