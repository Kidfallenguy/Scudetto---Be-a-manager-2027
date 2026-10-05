import { CLUBS, clubById } from "./clubs";
import { aiTerms, applyTerms } from "./contracts";
import { ensureFinance, logTransfer, wageRoom } from "./finance";
import { clamp, uid } from "./format";
import { generated, resyncStats } from "./squads";
/** Id reservado para jugadores sin club. */
export const FREE_AGENT = "FA";
const POSITIONS = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
function news(save, tone, title, body) {
    save.news.unshift({ id: uid("n"), week: save.week, tone, title, body });
}
/** Agentes libres iniciales para que el mercado arranque con algo para fichar. */
export function seedFreeAgents(rng, used, count = 70) {
    const real = CLUBS.filter((c) => !c.ghost);
    const out = [];
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
export function trimFreeAgents(save) {
    save.freeAgents = [...save.freeAgents]
        .filter((p) => p.age < 37)
        .sort((a, b) => b.ovr + b.pot * 0.2 - (a.ovr + a.pot * 0.2))
        .slice(0, 300);
}
function squadOf(save, clubId) {
    return save.players.filter((p) => p.clubId === clubId && !p.loanFrom);
}
export function freeNumber(p, squad) {
    const used = new Set(squad.filter((x) => x.id !== p.id).map((x) => x.number));
    if (!used.has(p.number))
        return;
    for (let n = 2; n <= 99; n++) {
        if (!used.has(n)) {
            p.number = n;
            return;
        }
    }
}
/** Ficha a un agente libre (humano o IA). Con `terms` aplica lo negociado; sin él, lo que pediría el jugador. */
export function signFreeAgent(save, p, clubId, terms) {
    save.freeAgents = save.freeAgents.filter((x) => x.id !== p.id);
    p.clubId = clubId;
    p.listed = false;
    p.listedForLoan = false;
    p.sellOn = null;
    p.morale = clamp(p.morale + 8, 40, 100);
    applyTerms(p, terms ?? aiTerms(save, p, clubId, true, false));
    freeNumber(p, squadOf(save, clubId));
    save.players.push(p);
}
export function releaseToFree(save, p) {
    p.clubId = FREE_AGENT;
    p.listed = false;
    p.listedForLoan = false;
    p.sellOn = null;
    p.contract = 0;
    p.terms = undefined;
    save.freeAgents.push(p);
}
/** Cuántos jugadores de cada puesto necesita una plantilla equilibrada, y cuántos son titulares. */
export const POS_TARGET = {
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
export const POS_STARTERS = {
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
/**
 * La IA decide si renueva a alguien cuyo contrato vence. Lo suelta libre si:
 *  - no tiene dinero (masa salarial) para pagarle lo que pide,
 *  - no lo necesita (suplente y ya hay de sobra en su puesto, o es mayor y sin peso),
 *  y renueva a los que importan y entran en el presupuesto.
 */
function aiRenews(save, p, squad, rng) {
    const mates = squad.filter((x) => x.id !== p.id && x.pos === p.pos && x.contract > 0);
    const rankAtPos = mates.filter((x) => x.ovr > p.ovr).length;
    const isStarter = rankAtPos < POS_STARTERS[p.pos];
    const overall = squad.filter((x) => x.ovr > p.ovr).length;
    const prospect = p.age <= 22 && p.pot - p.ovr >= 7;
    // ¿Se puede pagar? Cuenta solo el aumento sobre lo que ya cobra.
    const t = aiTerms(save, p, p.clubId, false, true);
    const newWage = Math.max(t.wage, p.wage);
    const room = wageRoom(save, p.clubId);
    const canPay = newWage - p.wage <= room;
    if (!canPay && !(isStarter && p.ovr >= clubById(p.clubId).prestige + 3 && room > 0))
        return false;
    // ¿Lo necesitan? Con puesto cubierto y plantilla larga no hace falta.
    const depth = mates.length;
    const surplusAtPos = depth >= POS_TARGET[p.pos] && !isStarter && !prospect;
    if (surplusAtPos && rankAtPos >= POS_TARGET[p.pos] - 1)
        return false;
    if (squad.length > 34 && !isStarter && !prospect && overall > 14)
        return false;
    if (p.age >= 35 && !isStarter)
        return false;
    if (p.age >= 33 && overall > 8)
        return false;
    let chance = isStarter ? 0.94 : overall < 14 ? 0.8 : 0.55;
    if (prospect)
        chance += 0.08;
    if (p.age >= 32)
        chance -= 0.2;
    chance += clamp((p.ovr - clubById(p.clubId).prestige) * 0.01, -0.15, 0.1);
    // Si el puesto queda corto, hay que renovarlo sí o sí.
    if (depth < 2)
        chance = 0.97;
    return rng.chance(clamp(chance, 0.1, 0.98));
}
/**
 * Procesa los contratos que vencen al cerrar la temporada (contrato en 0).
 * Usuario: si no renovó, el jugador se va libre. IA: renueva o lo deja libre según dinero y necesidad.
 */
export function processExpiries(save, rng) {
    ensureFinance(save);
    const lost = [];
    const bySquad = new Map();
    for (const p of save.players) {
        const list = bySquad.get(p.clubId);
        if (list)
            list.push(p);
        else
            bySquad.set(p.clubId, [p]);
    }
    for (const p of save.players) {
        if (p.contract > 0)
            continue;
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
        if (aiRenews(save, p, bySquad.get(p.clubId) ?? [], rng)) {
            const t = aiTerms(save, p, p.clubId, false, true);
            applyTerms(p, { ...t, wage: Math.max(t.wage, p.wage), years: clamp(t.years + rng.int(-1, 0), 1, 5) });
        }
        else {
            if (p.ovr >= 70)
                logTransfer(save, p, origin, FREE_AGENT, "free", 0);
            releaseToFree(save, p);
        }
    }
    save.players = save.players.filter((p) => p.clubId !== FREE_AGENT);
    if (lost.length) {
        const names = lost.map((p) => p.name);
        news(save, "bad", "Se van libres", `${names.slice(0, 6).join(", ")}${names.length > 6 ? ` y ${names.length - 6} más` : ""} terminaron contrato y dejan el club.`);
    }
    return lost;
}
