import { CLUBS, clubById } from "./clubs";
import { aiTerms, applyTerms, clauseOf, marketWage } from "./contracts";
import { NO_CLUB, canAfford, creditClub, ensureFinance, financeOf, logTransfer, baseTransferBudget, wageRoom, } from "./finance";
import { POS_STARTERS, POS_TARGET, freeNumber, releaseToFree, signFreeAgent } from "./free-agents";
import { SQUAD_LIMIT, SQUAD_MIN, capMarketValue, clamp, formatMoney, uid } from "./format";
import { settleSellOn } from "./transfers";
// ---------------------------------------------------------------------------
// Mercado de la IA: los clubes analizan su plantilla, miran su bolsillo y compran,
// venden, ceden o fichan libres. Todo respeta presupuesto, masa salarial y tope de 40.
// ---------------------------------------------------------------------------
const MIN_POS = {
    GK: 2,
    RB: 1,
    CB: 3,
    LB: 1,
    CDM: 1,
    CM: 2,
    CAM: 1,
    RW: 1,
    LW: 1,
    ST: 2,
};
const ALL_POS = Object.keys(POS_TARGET);
/** Salario que de verdad pasaría a cobrar tras el movimiento (los libres y los de contrato corto piden de mercado). */
function expectedWage(p, free) {
    if (free)
        return Math.max(p.wage, marketWage(p)) * 1.1;
    if (p.contract <= 1)
        return Math.max(p.wage, marketWage(p) * 0.95) * 1.1;
    return p.wage;
}
function buildCtx(save, rng) {
    const squads = new Map();
    const byPos = new Map();
    for (const p of save.players) {
        const list = squads.get(p.clubId);
        if (list)
            list.push(p);
        else
            squads.set(p.clubId, [p]);
        if (p.clubId === save.clubId || p.loanFrom || p.locked)
            continue;
        if (clubById(p.clubId).ghost)
            continue;
        const bp = byPos.get(p.pos);
        if (bp)
            bp.push(p);
        else
            byPos.set(p.pos, [p]);
    }
    return { save, rng, squads, byPos, newsLeft: 4 };
}
function squadOf(ctx, clubId) {
    return ctx.squads.get(clubId) ?? [];
}
function news(ctx, tone, title, body) {
    if (ctx.newsLeft <= 0)
        return;
    ctx.newsLeft--;
    ctx.save.news.unshift({ id: uid("n"), week: ctx.save.week, tone, title, body });
}
/** Ventana: verano (inicio de temporada) a tope, invierno a media actividad, el resto casi quieto. */
function windowIntensity(save) {
    const total = save.calendar.length || 94;
    const f = save.cursor / total;
    if (f < 0.18)
        return 1;
    if (f >= 0.46 && f < 0.56)
        return 0.6;
    return 0.16;
}
// ---------------------------------------------------------------------------
// Análisis de plantilla
// ---------------------------------------------------------------------------
function analyze(squad, club) {
    const needs = [];
    const surplus = [];
    const level = club.prestige - 3;
    for (const pos of ALL_POS) {
        const list = squad.filter((p) => p.pos === pos).sort((a, b) => b.ovr - a.ovr);
        const starters = POS_STARTERS[pos];
        const ref = list[starters - 1]?.ovr ?? 0;
        const count = list.length;
        let score = 0;
        if (count < MIN_POS[pos])
            score += 30 + (MIN_POS[pos] - count) * 10;
        else if (count < POS_TARGET[pos])
            score += 6;
        // Calidad: ¿el titular está por debajo del nivel del club?
        if (ref < level)
            score += (level - ref) * 1.4;
        // Titular veterano que se va apagando.
        const top = list[0];
        if (top && top.age >= 33)
            score += 4;
        if (score > 0)
            needs.push({ pos, score, ref });
        if (count > POS_TARGET[pos]) {
            for (const p of list.slice(POS_TARGET[pos])) {
                const prospect = p.age <= 21 && p.pot - p.ovr >= 8;
                if (!prospect && !p.loanFrom)
                    surplus.push(p);
            }
        }
    }
    needs.sort((a, b) => b.score - a.score);
    return { needs, surplus };
}
function isSurplusFor(squad, p) {
    const same = squad.filter((x) => x.pos === p.pos).sort((a, b) => b.ovr - a.ovr);
    const idx = same.findIndex((x) => x.id === p.id);
    return idx >= POS_TARGET[p.pos];
}
// ---------------------------------------------------------------------------
// Precios y disposición a vender
// ---------------------------------------------------------------------------
function priceOf(p, listedOrSurplus, rng) {
    const seller = clubById(p.clubId);
    const mod = listedOrSurplus ? 0.9 + rng.float() * 0.08 : 1.05 + rng.float() * 0.22;
    return capMarketValue(p.value * (seller.prestige > 84 ? 1.08 : 1) * mod);
}
function sellerWilling(ctx, p, price, buyer) {
    const seller = clubById(p.clubId);
    const squad = squadOf(ctx, p.clubId).filter((x) => !x.loanFrom);
    if (squad.length <= SQUAD_MIN + 2)
        return false;
    const left = squad.filter((x) => x.pos === p.pos && x.id !== p.id).length;
    if (left < MIN_POS[p.pos])
        return false;
    if (p.listed || isSurplusFor(squadOf(ctx, p.clubId), p))
        return true;
    const rank = squad.filter((x) => x.ovr > p.ovr).length;
    const fin = financeOf(ctx.save, seller.id);
    const needsCash = fin.budget < baseTransferBudget(seller.id) * 0.12;
    const star = rank < 4;
    // Los titulares importantes solo salen por mucho dinero (o si el vendedor está ahogado).
    if (star) {
        if (buyer.prestige < seller.prestige - 8 && !needsCash)
            return false;
        return price >= p.value * 1.3 && ctx.rng.chance(needsCash ? 0.5 : 0.18);
    }
    return price >= p.value * 1.05 && ctx.rng.chance(needsCash ? 0.6 : 0.3);
}
// ---------------------------------------------------------------------------
// Ejecución de operaciones
// ---------------------------------------------------------------------------
function settleContractAfterMove(ctx, p, buyerId) {
    if (p.contract <= 1) {
        const t = aiTerms(ctx.save, p, buyerId, false, false);
        applyTerms(p, { ...t, wage: Math.max(p.wage * 0.95, t.wage), years: ctx.rng.int(2, 4) });
    }
}
function moveToSquad(ctx, p, fromId, toId) {
    const from = squadOf(ctx, fromId);
    const idx = from.findIndex((x) => x.id === p.id);
    if (idx >= 0)
        from.splice(idx, 1);
    const to = ctx.squads.get(toId) ?? [];
    to.push(p);
    ctx.squads.set(toId, to);
}
function executeSale(ctx, p, buyer, fee, kind) {
    const save = ctx.save;
    const sellerId = p.clubId;
    const seller = clubById(sellerId);
    const net = settleSellOn(save, p, fee, false);
    creditClub(save, sellerId, net);
    creditClub(save, buyer.id, -fee);
    moveToSquad(ctx, p, sellerId, buyer.id);
    p.clubId = buyer.id;
    p.listed = false;
    p.listedForLoan = false;
    p.morale = clamp(p.morale + 4, 40, 100);
    settleContractAfterMove(ctx, p, buyer.id);
    freeNumber(p, squadOf(ctx, buyer.id));
    logTransfer(save, p, sellerId, buyer.id, kind, fee);
    if (p.ovr >= 80 || fee >= 30_000_000) {
        news(ctx, "neutral", `${buyer.short} ficha a ${p.name}`, kind === "clause"
            ? `Paga la cláusula (${formatMoney(fee)}) y se lo lleva de ${seller.name}.`
            : `Sale de ${seller.name} por ${formatMoney(fee)}.`);
    }
}
function executeLoan(ctx, p, borrower, seasons, fee) {
    const save = ctx.save;
    const lenderId = p.clubId;
    creditClub(save, lenderId, fee);
    creditClub(save, borrower.id, -fee);
    moveToSquad(ctx, p, lenderId, borrower.id);
    p.loanFrom = lenderId;
    p.clubId = borrower.id;
    p.loanSeasons = seasons;
    p.listed = false;
    p.listedForLoan = false;
    save.loans.push({ playerId: p.id, fromClubId: lenderId, toClubId: borrower.id, seasonsLeft: seasons, fee });
    freeNumber(p, squadOf(ctx, borrower.id));
    logTransfer(save, p, lenderId, borrower.id, "loan", fee);
}
function executeFree(ctx, p, club) {
    const save = ctx.save;
    signFreeAgent(save, p, club.id);
    const sq = ctx.squads.get(club.id) ?? [];
    sq.push(p);
    ctx.squads.set(club.id, sq);
    logTransfer(save, p, NO_CLUB, club.id, "free", 0);
    if (p.ovr >= 78) {
        news(ctx, "neutral", `${club.short} ficha libre a ${p.name}`, `Llega sin coste tras quedar libre. GRL ${p.ovr}.`);
    }
}
// ---------------------------------------------------------------------------
// Libera hueco (tope de 40) vendiendo o soltando al sobrante
// ---------------------------------------------------------------------------
function makeRoom(ctx, club) {
    const squad = squadOf(ctx, club.id);
    if (squad.length < SQUAD_LIMIT)
        return true;
    if (trySell(ctx, club, true))
        return squadOf(ctx, club.id).length < SQUAD_LIMIT;
    // Sin comprador: se rescinde al peor sobrante (queda libre).
    const { surplus } = analyze(squad, club);
    const cut = surplus
        .filter((p) => p.age >= 24 || p.ovr < club.prestige - 14)
        .sort((a, b) => a.ovr - b.ovr)[0];
    if (!cut)
        return false;
    moveToSquadLeave(ctx, cut);
    return true;
}
function moveToSquadLeave(ctx, p) {
    const sq = squadOf(ctx, p.clubId);
    const idx = sq.findIndex((x) => x.id === p.id);
    if (idx >= 0)
        sq.splice(idx, 1);
    if (p.ovr >= 70)
        logTransfer(ctx.save, p, p.clubId, NO_CLUB, "release", 0);
    ctx.save.players = ctx.save.players.filter((x) => x.id !== p.id);
    releaseToFree(ctx.save, p);
}
// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------
function tryBuy(ctx, club, freeOnly) {
    const { save, rng } = ctx;
    let squad = squadOf(ctx, club.id);
    const fin = financeOf(save, club.id);
    const { needs } = analyze(squad, club);
    if (!needs.length)
        return false;
    if (squad.length >= SQUAD_LIMIT && !makeRoom(ctx, club))
        return false;
    squad = squadOf(ctx, club.id);
    if (squad.length >= SQUAD_LIMIT)
        return false;
    // Elige el puesto: casi siempre el más urgente, a veces el segundo o tercero.
    const top = needs.slice(0, 3);
    const need = rng.chance(0.65) ? top[0] : rng.pick(top);
    const room = wageRoom(save, club.id);
    const level = club.prestige;
    const short = squad.length < SQUAD_MIN + 3;
    const cands = [];
    for (const fa of save.freeAgents) {
        if (fa.pos !== need.pos)
            continue;
        if (fa.ovr < level - 14 || fa.ovr > level + 4)
            continue;
        const gain = fa.ovr - need.ref;
        if (gain < (short || need.score >= 20 ? -4 : 1))
            continue;
        if (expectedWage(fa, true) > room)
            continue;
        cands.push({ p: fa, free: true, price: 0, score: gain * 2 + 6 + (fa.age <= 28 ? 2 : 0), clause: false });
    }
    if (!freeOnly) {
        const pool = ctx.byPos.get(need.pos) ?? [];
        for (const p of pool) {
            if (p.clubId === club.id || p.loanFrom)
                continue;
            if (p.ovr < level - 8 || p.ovr > level + 6)
                continue;
            const gain = p.ovr - need.ref;
            if (gain < (need.score >= 20 ? -2 : 2))
                continue;
            const sellerSquad = squadOf(ctx, p.clubId);
            const surplus = isSurplusFor(sellerSquad, p);
            const price = priceOf(p, p.listed || surplus, rng);
            if (price > fin.budget * 0.9)
                continue;
            if (expectedWage(p, false) > room)
                continue;
            if (!sellerWilling(ctx, p, price, club))
                continue;
            const bargain = (p.listed || surplus ? 4 : 0) + (p.age <= 24 ? (p.pot - p.ovr) * 0.4 : 0);
            const agePen = p.age >= 31 ? (p.age - 30) * 1.5 : 0;
            cands.push({
                p,
                free: false,
                price,
                score: gain * 2 + bargain - agePen - (price / Math.max(fin.budget, 1)) * 6,
                clause: false,
            });
        }
        // Cláusula de rescisión: un club con caja puede pagarla y el vendedor no puede negarse.
        for (const p of pool) {
            if (p.clubId === club.id || p.loanFrom)
                continue;
            const cl = clauseOf(p);
            if (!cl || cl > fin.budget * 0.7)
                continue;
            if (p.pos !== need.pos || p.ovr < level - 6 || p.ovr > level + 8)
                continue;
            const gain = p.ovr - need.ref;
            if (gain < 3 || expectedWage(p, false) > room)
                continue;
            const left = squadOf(ctx, p.clubId).filter((x) => x.pos === p.pos && x.id !== p.id).length;
            if (left < MIN_POS[p.pos])
                continue;
            if (rng.chance(0.12)) {
                cands.push({ p, free: false, price: cl, score: gain * 2 + 3 - (cl / Math.max(fin.budget, 1)) * 6, clause: true });
            }
        }
    }
    if (!cands.length)
        return false;
    cands.sort((a, b) => b.score - a.score);
    const pick = rng.chance(0.6) ? cands[0] : rng.pick(cands.slice(0, Math.min(3, cands.length)));
    if (pick.free) {
        executeFree(ctx, pick.p, club);
        return true;
    }
    if (!canAfford(save, club.id, pick.price))
        return false;
    executeSale(ctx, pick.p, club, pick.price, pick.clause ? "clause" : "sale");
    return true;
}
// ---------------------------------------------------------------------------
// Ventas: sobrantes, plantillas largas y clubes con la caja vacía
// ---------------------------------------------------------------------------
function eligibleBuyers(ctx, p, fee, excludeId) {
    const out = [];
    for (const c of CLUBS) {
        if (c.ghost || c.id === ctx.save.clubId || c.id === excludeId)
            continue;
        if (squadOf(ctx, c.id).length >= SQUAD_LIMIT)
            continue;
        if (!canAfford(ctx.save, c.id, fee))
            continue;
        if (expectedWage(p, false) > wageRoom(ctx.save, c.id))
            continue;
        if (p.ovr < c.prestige - 10 || p.ovr > c.prestige + 7)
            continue;
        out.push(c);
    }
    return out;
}
/** Un club con exceso o sin dinero pone a alguien en venta y, si aparece comprador, lo vende. */
function trySell(ctx, club, forced = false) {
    const { save, rng } = ctx;
    const squad = squadOf(ctx, club.id).filter((p) => !p.loanFrom);
    if (squad.length <= SQUAD_MIN + 2)
        return false;
    const fin = financeOf(save, club.id);
    const needsCash = fin.budget < baseTransferBudget(club.id) * 0.12;
    const tooMany = squad.length > 34;
    const { surplus } = analyze(squad, club);
    let pool = surplus;
    if (!pool.length && needsCash) {
        // Sin sobrantes, vende un no-titular con valor.
        pool = squad
            .filter((p) => squad.filter((x) => x.ovr > p.ovr).length >= 11 && p.value > 2_000_000)
            .sort((a, b) => b.value - a.value)
            .slice(0, 4);
    }
    if (!pool.length && tooMany)
        pool = [...squad].sort((a, b) => a.ovr - b.ovr).slice(0, 4);
    if (!pool.length)
        return false;
    if (!forced && !needsCash && !tooMany && !rng.chance(0.5))
        return false;
    const p = needsCash ? [...pool].sort((a, b) => b.value - a.value)[0] : rng.pick(pool);
    const price = priceOf(p, true, rng);
    const buyers = eligibleBuyers(ctx, p, price, club.id)
        .map((b) => {
        const { needs } = analyze(squadOf(ctx, b.id), b);
        const n = needs.find((x) => x.pos === p.pos);
        return { b, n };
    })
        .filter((x) => x.n && p.ovr - x.n.ref >= -2);
    if (!buyers.length) {
        p.listed = true; // al menos queda anunciado: el mercado lo verá en venta
        return false;
    }
    buyers.sort((a, b) => (b.n?.score ?? 0) + b.b.prestige * 0.1 - ((a.n?.score ?? 0) + a.b.prestige * 0.1));
    const buyer = rng.chance(0.6) ? buyers[0].b : rng.pick(buyers).b;
    executeSale(ctx, p, buyer, price, "sale");
    return true;
}
// ---------------------------------------------------------------------------
// Cesiones: promesas de clubes grandes que no juegan, o sobrantes que otro necesita
// ---------------------------------------------------------------------------
function loanFeeFor(p, seasons) {
    return Math.round(p.value * (0.035 + p.ovr / 2500) * seasons);
}
function tryLoan(ctx, lender) {
    const { save, rng } = ctx;
    const squad = squadOf(ctx, lender.id).filter((p) => !p.loanFrom);
    if (squad.length <= SQUAD_MIN + 4)
        return false;
    const cands = squad.filter((p) => {
        if (p.age > 24)
            return false;
        if (!p.listedForLoan && p.pot - p.ovr < 4)
            return false;
        const rank = squad.filter((x) => x.pos === p.pos && x.ovr > p.ovr).length;
        return rank >= POS_STARTERS[p.pos] + 1;
    });
    if (!cands.length)
        return false;
    const p = rng.pick(cands);
    const seasons = rng.chance(0.65) ? 1 : 2;
    const fee = loanFeeFor(p, seasons);
    const borrowers = CLUBS.filter((c) => {
        if (c.ghost || c.id === save.clubId || c.id === lender.id)
            return false;
        if (c.prestige > lender.prestige + 2)
            return false;
        if (squadOf(ctx, c.id).length >= SQUAD_LIMIT - 1)
            return false;
        if (!canAfford(save, c.id, fee) || expectedWage(p, false) > wageRoom(save, c.id))
            return false;
        const { needs } = analyze(squadOf(ctx, c.id), c);
        const n = needs.find((x) => x.pos === p.pos);
        return Boolean(n && p.ovr >= n.ref - 2);
    });
    if (!borrowers.length)
        return false;
    executeLoan(ctx, p, rng.pick(borrowers), seasons, fee);
    return true;
}
// ---------------------------------------------------------------------------
// Semana de mercado de la IA
// ---------------------------------------------------------------------------
export function runAiMarket(save, rng) {
    ensureFinance(save);
    const ctx = buildCtx(save, rng);
    const intensity = windowIntensity(save);
    const clubs = rng.shuffle(CLUBS.filter((c) => !c.ghost && c.id !== save.clubId));
    // Ingreso semanal pequeño (taquilla, TV...).
    for (const c of clubs) {
        const f = financeOf(save, c.id);
        const base = baseTransferBudget(c.id);
        // Los clubes ya llenos de dinero no acumulan sin fin: gastan o no ingresan más.
        if (f.budget < base * 1.5)
            f.budget += Math.round(base / 300);
    }
    // 1) Los que necesitan dinero o tienen de más venden.
    const sellers = Math.max(1, Math.round(clubs.length * 0.07 * intensity));
    for (const c of clubs.slice(0, sellers))
        trySell(ctx, c);
    // 2) Compras (el grueso en ventanas), siempre con presupuesto y tope de 40.
    const buyers = Math.max(2, Math.round(clubs.length * 0.12 * intensity));
    const order = rng.shuffle(clubs);
    for (const c of order.slice(0, buyers))
        tryBuy(ctx, c, false);
    // 3) Agentes libres: se ficha en cualquier semana.
    const freeTries = intensity >= 1 ? 14 : 4;
    for (const c of rng.shuffle(clubs).slice(0, freeTries)) {
        if (!save.freeAgents.length)
            break;
        tryBuy(ctx, c, true);
    }
    // 4) Cesiones.
    if (intensity >= 0.6) {
        const loans = intensity >= 1 ? 4 : 2;
        for (const c of rng.shuffle(clubs.filter((x) => x.prestige >= 76)).slice(0, loans)) {
            if (rng.chance(0.6))
                tryLoan(ctx, c);
        }
    }
}
/** Tope de 40: al empezar la temporada se sueltan los sobrantes de cualquier plantilla de la IA que se pase. */
export function enforceSquadCaps(save) {
    const byClub = new Map();
    for (const p of save.players) {
        if (p.clubId === save.clubId || clubById(p.clubId).ghost)
            continue;
        const l = byClub.get(p.clubId);
        if (l)
            l.push(p);
        else
            byClub.set(p.clubId, [p]);
    }
    const drop = new Set();
    for (const [clubId, list] of byClub) {
        if (list.length <= SQUAD_LIMIT)
            continue;
        const cut = [...list]
            .filter((p) => !p.locked)
            .sort((a, b) => a.ovr + a.pot * 0.3 - (b.ovr + b.pot * 0.3))
            .slice(0, list.length - SQUAD_LIMIT);
        for (const p of cut) {
            if (p.ovr >= 70)
                logTransfer(save, p, clubId, NO_CLUB, "release", 0);
            drop.add(p.id);
        }
    }
    if (!drop.size)
        return;
    const gone = save.players.filter((p) => drop.has(p.id));
    save.players = save.players.filter((p) => !drop.has(p.id));
    for (const p of gone)
        releaseToFree(save, p);
}
/** Compradores de la IA que pueden pagar y necesitan el puesto (para las ofertas por jugadores del usuario). */
export function interestedBuyers(save, p, fee, loan = false) {
    ensureFinance(save);
    const squads = new Map();
    for (const x of save.players) {
        const l = squads.get(x.clubId);
        if (l)
            l.push(x);
        else
            squads.set(x.clubId, [x]);
    }
    const out = [];
    for (const c of CLUBS) {
        if (c.ghost || c.id === save.clubId)
            continue;
        const squad = squads.get(c.id) ?? [];
        if (squad.length >= SQUAD_LIMIT)
            continue;
        if (!canAfford(save, c.id, fee))
            continue;
        if (wageRoom(save, c.id) < (loan ? p.wage * 0.5 : p.wage))
            continue;
        const { needs } = analyze(squad, c);
        const n = needs.find((x) => x.pos === p.pos);
        if (!n)
            continue;
        if (p.ovr - n.ref < (loan ? -4 : 0))
            continue;
        out.push(c);
    }
    return out;
}
