import { CLUBS, clubById } from "./clubs";
import { aiTerms, applyTerms, contractEndLabel, renewedContract } from "./contracts";
import { ensureFinance, financeOf, logTransfer, wageRoom } from "./finance";
import { clamp, uid } from "./format";
import { ensurePos } from "./positions";
import type { Rng } from "./rng";
import { generated, resyncStats } from "./squads";
import type { ClubId, ContractTerms, GameSave, Player, Pos } from "./types";

/** Id reservado para jugadores sin club. */
export const FREE_AGENT = "FA";

const POSITIONS: Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];

function news(save: GameSave, tone: "good" | "bad" | "neutral", title: string, body: string) {
  save.news.unshift({ id: uid("n"), week: save.week, tone, title, body });
}

/** Agentes libres iniciales para que el mercado arranque con algo para fichar. */
export function seedFreeAgents(rng: Rng, used: Set<string>, count = 70): Player[] {
  const real = CLUBS.filter((c) => !c.ghost);
  const out: Player[] = [];
  for (let i = 0; i < count; i++) {
    const club = rng.pick(real);
    const pos = rng.pick(POSITIONS);
    const p = generated(club.id, pos, 50_000 + i, rng.int(68, 90), rng, used);
    p.clubId = FREE_AGENT;
    p.age = rng.int(24, 35);
    p.ovr = clamp(p.ovr + rng.int(0, 4), 58, 82);
    p.pot = Math.max(p.ovr, Math.min(p.pot, p.ovr + 4));
    p.contract = 0;
    p.locked = false;
    p.value = Math.round(p.value * 0.9);
    resyncStats(p, rng);
    used.add(p.name);
    out.push(p);
  }
  return out;
}

/** Los libres que nadie ficha se quedan sin salida: solo sobreviven los mejores. */
export function trimFreeAgents(save: GameSave) {
  save.freeAgents = [...save.freeAgents]
    .filter((p) => p.age < 37)
    .sort((a, b) => b.ovr + b.pot * 0.2 - (a.ovr + a.pot * 0.2))
    .slice(0, 300);
}

function squadOf(save: GameSave, clubId: ClubId) {
  return save.players.filter((p) => p.clubId === clubId && !p.loanFrom);
}

export function freeNumber(p: Player, squad: Player[]) {
  const used = new Set(squad.filter((x) => x.id !== p.id).map((x) => x.number));
  if (!used.has(p.number)) return;
  for (let n = 2; n <= 99; n++) {
    if (!used.has(n)) {
      p.number = n;
      return;
    }
  }
}

/** Ficha a un agente libre (humano o IA). Con `terms` aplica lo negociado; sin él, lo que pediría el jugador. */
export function signFreeAgent(save: GameSave, p: Player, clubId: ClubId, terms?: ContractTerms) {
  save.freeAgents = save.freeAgents.filter((x) => x.id !== p.id);
  ensurePos(p); // todo fichaje entra con posición válida
  p.clubId = clubId;
  p.loanFrom = null;
  p.loanSeasons = 0;
  p.listed = false;
  p.listedForLoan = false;
  p.sellOn = null;
  p.morale = clamp(p.morale + 8, 40, 100);
  applyTerms(p, terms ?? aiTerms(save, p, clubId, true, false));
  freeNumber(p, squadOf(save, clubId));
  save.players.push(p);
}

export function releaseToFree(save: GameSave, p: Player) {
  ensurePos(p);
  // Un libre no puede seguir figurando como cedido de nadie.
  if (p.loanFrom || p.loanSeasons) save.loans = save.loans.filter((l) => l.playerId !== p.id);
  p.loanFrom = null;
  p.loanSeasons = 0;
  p.clubId = FREE_AGENT;
  p.listed = false;
  p.listedForLoan = false;
  p.sellOn = null;
  p.contract = 0;
  p.terms = undefined;
  save.freeAgents.push(p);
}

/** Cuántos jugadores de cada puesto necesita una plantilla equilibrada, y cuántos son titulares. */
export const POS_TARGET: Record<Pos, number> = {
  GK: 3,
  RB: 2,
  CB: 4,
  LB: 2,
  CDM: 2,
  CM: 3,
  CAM: 2,
  RW: 2,
  LW: 2,
  ST: 3,
};
export const POS_STARTERS: Record<Pos, number> = {
  GK: 1,
  RB: 1,
  CB: 2,
  LB: 1,
  CDM: 1,
  CM: 2,
  CAM: 1,
  RW: 1,
  LW: 1,
  ST: 1,
};

/** Jugador de élite: ningún club lo deja marchar libre sin pelear por él. */
function isElite(p: Player): boolean {
  return p.ovr >= 84 || (p.age <= 23 && p.pot >= 90 && p.ovr >= 78);
}

/**
 * ¿Es una pieza que el club quiere conservar sí o sí? Élite, jugadores de 80+, titulares al nivel del club
 * y promesas de mucho techo. A estos se les renueva antes de que venza el contrato y, si no se puede,
 * se intenta venderlos antes de que se vayan gratis.
 */
function isImportant(p: Player, squad: Player[]): boolean {
  const club = clubById(p.clubId);
  const mates = squad.filter((x) => x.id !== p.id && x.pos === p.pos && x.contract > 0);
  const rankAtPos = mates.filter((x) => x.ovr > p.ovr).length;
  const isStarter = rankAtPos < POS_STARTERS[p.pos];
  const prospect = p.age <= 22 && p.pot - p.ovr >= 7;
  if (isElite(p) || p.ovr >= 80) return true;
  if (isStarter && p.ovr >= club.prestige - 3) return true;
  return prospect && p.pot >= 85;
}

/**
 * Cupo de libres de alto nivel por verano (clubes de la IA). Los de 88+ nunca quedan libres;
 * de 84+ como mucho uno; de 80+ como mucho cuatro. El resto del mercado queda para jugadores corrientes.
 */
const FREE_CAPS: { min: number; max: number }[] = [
  { min: 88, max: 0 },
  { min: 84, max: 1 },
  { min: 80, max: 4 },
];

function freeSlotAvailable(ovr: number, released: number[]): boolean {
  for (const tier of FREE_CAPS) {
    if (ovr < tier.min) continue;
    if (released.filter((o) => o >= tier.min).length >= tier.max) return false;
  }
  return true;
}

/**
 * La IA decide si renueva a alguien cuyo contrato vence. Las piezas importantes se renuevan casi siempre
 * (el club estira la masa salarial si hace falta). Al resto lo suelta libre si:
 *  - no tiene dinero (masa salarial) para pagarle lo que pide,
 *  - no lo necesita (suplente y ya hay de sobra en su puesto, o es mayor y sin peso).
 */
function aiRenews(save: GameSave, p: Player, squad: Player[], rng: Rng): boolean {
  const club = clubById(p.clubId);
  const mates = squad.filter((x) => x.id !== p.id && x.pos === p.pos && x.contract > 0);
  const rankAtPos = mates.filter((x) => x.ovr > p.ovr).length;
  const isStarter = rankAtPos < POS_STARTERS[p.pos];
  const overall = squad.filter((x) => x.ovr > p.ovr).length;
  const prospect = p.age <= 22 && p.pot - p.ovr >= 7;

  const t = aiTerms(save, p, p.clubId, false, true);
  const newWage = Math.max(t.wage, p.wage);
  const room = wageRoom(save, p.clubId);
  const extra = newWage - p.wage;

  if (isImportant(p, squad)) {
    // Un veterano sin peso real puede irse; el resto, el club lo retiene.
    if (p.age >= 35 && p.ovr < 80) return false;
    // Los de élite se renuevan siempre; los demás, mientras el aumento no desborde del todo la masa salarial.
    if (isElite(p)) return rng.chance(p.ovr >= 88 ? 1 : 0.9);
    const stretch = financeOf(save, p.clubId).wageCap * 0.06;
    if (extra > room + stretch) return false;
    return rng.chance(p.age >= 33 ? 0.7 : p.ovr >= 80 ? 0.84 : 0.93);
  }

  // ¿Se puede pagar? Cuenta solo el aumento sobre lo que ya cobra.
  const canPay = extra <= room;
  if (!canPay && !(isStarter && p.ovr >= club.prestige + 3 && room > 0)) return false;

  // ¿Lo necesitan? Con puesto cubierto y plantilla larga no hace falta.
  const depth = mates.length;
  const surplusAtPos = depth >= POS_TARGET[p.pos] && !isStarter && !prospect;
  if (surplusAtPos && rankAtPos >= POS_TARGET[p.pos] - 1) return false;
  if (squad.length > 34 && !isStarter && !prospect && overall > 14) return false;
  if (p.age >= 35 && !isStarter) return false;
  if (p.age >= 33 && overall > 8) return false;

  let chance = isStarter ? 0.94 : overall < 14 ? 0.8 : 0.55;
  if (prospect) chance += 0.08;
  if (p.age >= 32) chance -= 0.2;
  chance += clamp((p.ovr - club.prestige) * 0.01, -0.15, 0.1);
  // Si el puesto queda corto, hay que renovarlo sí o sí.
  if (depth < 2) chance = 0.97;
  return rng.chance(clamp(chance, 0.1, 0.98));
}

/** Aplica la renovación de la IA a un jugador cuyo contrato venció (contrato en 0). */
function renewAtExpiry(save: GameSave, p: Player, rng: Rng) {
  const t = aiTerms(save, p, p.clubId, false, true);
  applyTerms(p, { ...t, wage: Math.max(t.wage, p.wage), years: clamp(t.years + rng.int(-1, 0), 1, 5) });
}

/**
 * Renovaciones de la IA durante la temporada: los clubes se adelantan y atan a sus piezas importantes
 * que están en su último año de contrato, repartidas a lo largo del año (no todas el mismo día).
 */
export function runAiRenewals(save: GameSave, rng: Rng) {
  ensureFinance(save);
  const bySquad = new Map<ClubId, Player[]>();
  for (const p of save.players) {
    if (p.loanFrom) continue;
    const list = bySquad.get(p.clubId);
    if (list) list.push(p);
    else bySquad.set(p.clubId, [p]);
  }
  let headlines = 0;
  for (const p of save.players) {
    if (p.contract !== 1 || p.locked || p.loanFrom || p.clubId === save.clubId) continue;
    const club = clubById(p.clubId);
    if (club.ghost) continue;
    if (!rng.chance(0.09)) continue;
    const squad = bySquad.get(p.clubId) ?? [];
    if (!isImportant(p, squad)) continue;
    if (p.age >= 35 && p.ovr < 80) continue;
    const t = aiTerms(save, p, p.clubId, false, true);
    const wage = Math.max(t.wage, p.wage);
    const stretch = financeOf(save, p.clubId).wageCap * 0.06;
    if (!isElite(p) && wage - p.wage > wageRoom(save, p.clubId) + stretch) continue;
    applyTerms(p, { ...t, wage, years: clamp(t.years, 1, 5) });
    p.contract = renewedContract({ contract: 1 }, t.years);
    if (p.ovr >= 84 && headlines < 2) {
      headlines++;
      news(save, "neutral", `${p.name} renueva con ${club.short}`, `Amplía su contrato hasta el ${contractEndLabel(save.season, p)}. GRL ${p.ovr}.`);
    }
  }
}

export interface ExpiryHooks {
  /** La IA intenta vender a un jugador que no va a renovar antes de que quede libre. Devuelve true si lo vendió. */
  sell?: (p: Player) => boolean;
}

/**
 * Procesa los contratos que vencen al cerrar la temporada (contrato en 0).
 * Usuario: si no renovó, el jugador se va libre. IA: renueva a sus piezas importantes; si no puede o no quiere,
 * intenta venderlo antes de que se vaya, y solo los que de verdad no se renuevan (con un cupo para los
 * de alto nivel) pasan a agentes libres.
 */
export function processExpiries(save: GameSave, rng: Rng, hooks: ExpiryHooks = {}) {
  ensureFinance(save);
  const lost: Player[] = [];
  const leavers: Player[] = [];
  const bySquad = new Map<ClubId, Player[]>();
  for (const p of save.players) {
    const list = bySquad.get(p.clubId);
    if (list) list.push(p);
    else bySquad.set(p.clubId, [p]);
  }

  for (const p of save.players) {
    if (p.contract > 0) continue;
    const club = clubById(p.clubId);
    if (club.ghost || p.locked) {
      p.contract = rng.int(1, 3);
      continue;
    }
    if (p.loanFrom) {
      // Venció el contrato con el club dueño: termina la cesión y queda libre.
      save.loans = save.loans.filter((l) => l.playerId !== p.id);
      p.loanFrom = null;
      p.loanSeasons = 0;
    }
    const origin = p.clubId;
    if (p.clubId === save.clubId) {
      lost.push(p);
      logTransfer(save, p, origin, FREE_AGENT, "free", 0);
      releaseToFree(save, p);
      continue;
    }
    if (aiRenews(save, p, bySquad.get(p.clubId) ?? [], rng)) renewAtExpiry(save, p, rng);
    else leavers.push(p);
  }

  // Los que la IA no renovó: primero se intenta venderlos; después manda el cupo de libres de alto nivel.
  const released: number[] = [];
  leavers.sort((a, b) => b.ovr - a.ovr);
  for (const p of leavers) {
    const origin = p.clubId;
    if (p.ovr >= 72 && hooks.sell?.(p)) continue;
    if (p.ovr >= 80 && !freeSlotAvailable(p.ovr, released)) {
      // Cupo agotado: el club retiene a la pieza (mejora de contrato incluida).
      renewAtExpiry(save, p, rng);
      continue;
    }
    if (p.ovr >= 80) released.push(p.ovr);
    if (p.ovr >= 70) logTransfer(save, p, origin, FREE_AGENT, "free", 0);
    releaseToFree(save, p);
  }
  save.players = save.players.filter((p) => p.clubId !== FREE_AGENT);

  if (lost.length) {
    const names = lost.map((p) => p.name);
    news(
      save,
      "bad",
      "Se van libres",
      `${names.slice(0, 6).join(", ")}${names.length > 6 ? ` y ${names.length - 6} más` : ""} terminaron contrato y dejan el club.`,
    );
  }
  return lost;
}
