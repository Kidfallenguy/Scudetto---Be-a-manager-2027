import { CLUBS, clubById } from "./clubs";
import { hash01 } from "./contracts";
import { clamp } from "./format";
import type { ClubFinance, ClubId, GameSave, Player, TransferRecord } from "./types";

/** Id reservado para jugadores sin club (se repite aquí para no depender de free-agents). */
export const NO_CLUB = "FA";

const LOG_CAP = 600;

/** Presupuesto base de fichajes: los grandes manejan mucho más que los modestos. */
export function baseTransferBudget(clubId: ClubId): number {
  const c = clubById(clubId);
  const jitter = 0.85 + hash01(`${clubId}:fin`) * 0.3;
  return Math.round(4_000_000 * Math.pow(1.125, c.prestige - 60) * jitter);
}

export function payroll(save: GameSave, clubId: ClubId): number {
  let total = 0;
  for (const p of save.players) if (p.clubId === clubId) total += p.wage;
  return total;
}

function wageCapFor(save: GameSave, clubId: ClubId): number {
  const c = clubById(clubId);
  const slack = 1.03 + clamp((c.prestige - 64) / 23, 0, 1) * 0.08;
  return Math.round(payroll(save, clubId) * slack);
}

/** Crea (si falta) la ficha financiera de cada club de la IA. */
export function ensureFinance(save: GameSave) {
  if (!save.clubFinance) save.clubFinance = {};
  for (const c of CLUBS) {
    if (c.ghost || c.id === save.clubId) continue;
    if (!save.clubFinance[c.id]) {
      save.clubFinance[c.id] = {
        budget: baseTransferBudget(c.id),
        wageCap: wageCapFor(save, c.id),
      };
    }
  }
}

export function financeOf(save: GameSave, clubId: ClubId): ClubFinance {
  if (!save.clubFinance) save.clubFinance = {};
  let f = save.clubFinance[clubId];
  if (!f) {
    f = { budget: baseTransferBudget(clubId), wageCap: wageCapFor(save, clubId) };
    save.clubFinance[clubId] = f;
  }
  return f;
}

/** Cuánto salario semanal extra puede asumir el club. */
export function wageRoom(save: GameSave, clubId: ClubId): number {
  return financeOf(save, clubId).wageCap - payroll(save, clubId);
}

/** Mueve dinero entre clubes. El usuario usa `save.budget`; la IA, su ficha financiera. */
export function creditClub(save: GameSave, clubId: ClubId, amount: number) {
  if (clubId === save.clubId) save.budget += amount;
  else if (clubId !== NO_CLUB && !clubById(clubId).ghost) financeOf(save, clubId).budget += amount;
}

export function canAfford(save: GameSave, clubId: ClubId, amount: number): boolean {
  if (clubId === save.clubId) return save.budget >= amount;
  if (clubById(clubId).ghost) return true;
  return financeOf(save, clubId).budget >= amount;
}

export function logTransfer(
  save: GameSave,
  p: Pick<Player, "id" | "name" | "pos" | "ovr">,
  fromId: ClubId,
  toId: ClubId,
  kind: TransferRecord["kind"],
  fee: number,
) {
  if (!save.transferLog) save.transferLog = [];
  save.transferLog.unshift({
    id: `t-${Math.random().toString(36).slice(2, 9)}`,
    season: save.season,
    week: save.week,
    playerId: p.id,
    name: p.name,
    pos: p.pos,
    ovr: p.ovr,
    fromId,
    toId,
    kind,
    fee,
    user: fromId === save.clubId || toId === save.clubId || undefined,
  });
  if (save.transferLog.length > LOG_CAP) save.transferLog.length = LOG_CAP;
}

/** Al empezar la temporada: ingresos nuevos y masa salarial recalculada. */
export function rolloverFinance(save: GameSave) {
  ensureFinance(save);
  for (const c of CLUBS) {
    if (c.ghost || c.id === save.clubId) continue;
    const base = baseTransferBudget(c.id);
    const f = financeOf(save, c.id);
    f.budget = Math.round(clamp(f.budget + base * 0.35, base * 0.3, base * 1.6));
    f.wageCap = Math.max(wageCapFor(save, c.id), Math.round(f.wageCap * 0.98));
  }
}
