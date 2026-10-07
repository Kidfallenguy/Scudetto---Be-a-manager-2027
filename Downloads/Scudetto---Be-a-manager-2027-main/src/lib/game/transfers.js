import { CLUBS, clubById, isTradableClub } from "./clubs";
import { applyTerms, clauseOf, ensureTerms } from "./contracts";
import { interestedBuyers, runAiMarket } from "./ai-market";
import { NO_CLUB, canAfford, creditClub, ensureFinance, logTransfer } from "./finance";
import { signFreeAgent } from "./free-agents";
import { SQUAD_LIMIT, SQUAD_MIN, capMarketValue, clamp, formatMoney, playerValue, uid } from "./format";
import { generated, resyncStats } from "./squads";
import { dropFromLineup } from "./tactics";
function squadOf(save, clubId) {
    return save.players.filter((p) => p.clubId === clubId);
}
function activeSquad(save, clubId) {
    return save.players.filter((p) => p.clubId === clubId && !p.loanFrom);
}
function news(save, tone, title, body) {
    save.news.unshift({ id: uid("n"), week: save.week, tone, title, body });
}
export function askPrice(p) {
    const from = clubById(p.clubId);
    const listedMod = p.listed ? 0.92 : 1.08;
    return capMarketValue(p.value * (from.prestige > 84 ? 1.1 : 1) * listedMod);
}
export function loanFee(p, seasons) {
    return Math.round(p.value * (0.035 + p.ovr / 2500) * seasons);
}
export function ownedByUser(p, clubId) {
    return p.clubId === clubId || p.loanFrom === clubId;
}
export function marketPool(save) {
    const mine = new Set(save.players.filter((p) => p.clubId === save.clubId).map((p) => p.name.toLowerCase()));
    return save.players.filter((p) => {
        if (p.clubId === save.clubId)
            return false;
        if (p.loanFrom)
            return false;
        if (p.listedForLoan)
            return false;
        if (p.locked)
            return false;
        if (!isTradableClub(p.clubId))
            return false;
        if (mine.has(p.name.toLowerCase()))
            return false;
        return true;
    });
}
/** Todo lo que se puede fichar: jugadores de otros clubes y agentes libres. */
export function fullMarket(save) {
    const mine = new Set(save.players.filter((p) => p.clubId === save.clubId).map((p) => p.name.toLowerCase()));
    const free = save.freeAgents.filter((p) => !mine.has(p.name.toLowerCase()));
    return [...marketPool(save), ...free];
}
export function findMarketPlayer(save, playerId) {
    const inClub = save.players.find((x) => x.id === playerId);
    if (inClub)
        return { player: inClub, free: false };
    const fa = save.freeAgents.find((x) => x.id === playerId);
    return fa ? { player: fa, free: true } : null;
}
/** Cuánto sale el traspaso: los agentes libres no cuestan nada; ceder reventa abarata el precio. */
export function transferFee(p, free, payClause, sellOnPct) {
    if (free)
        return 0;
    if (payClause)
        return clauseOf(p) ?? askPrice(p);
    return Math.round(askPrice(p) * (1 - clamp(sellOnPct, 0, 30) * 0.005));
}
/** Si el jugador tenía % de reventa pactado, el club que lo vendió cobra su parte. */
export function settleSellOn(save, p, fee, sellerIsUser) {
    const so = p.sellOn;
    p.sellOn = null;
    if (!so || so.pct <= 0)
        return fee;
    const cut = Math.round((fee * so.pct) / 100);
    if (so.clubId === save.clubId && !sellerIsUser) {
        save.budget += cut;
        news(save, "good", `Reventa de ${p.name}`, `Cobrás ${formatMoney(cut)} (${so.pct}%) por su venta a otro club.`);
        return fee;
    }
    if (sellerIsUser && so.clubId !== save.clubId) {
        news(save, "neutral", `Reventa de ${p.name}`, `${clubById(so.clubId).name} se queda ${formatMoney(cut)} (${so.pct}%) de la venta.`);
        return fee - cut;
    }
    return fee;
}
export function loanMarket(save) {
    const mine = new Set(save.players.filter((p) => p.clubId === save.clubId).map((p) => p.name.toLowerCase()));
    return save.players.filter((p) => {
        if (p.clubId === save.clubId)
            return false;
        if (p.loanFrom)
            return false;
        if (p.age > 24)
            return false;
        if (p.locked)
            return false;
        if (!isTradableClub(p.clubId))
            return false;
        if (mine.has(p.name.toLowerCase()))
            return false;
        return p.listedForLoan || p.ovr < 78;
    });
}
function pushOffer(save, offer) {
    const dup = save.offers.some((o) => o.playerId === offer.playerId && o.fromClubId === offer.fromClubId && o.kind === offer.kind);
    if (dup)
        return;
    save.offers.push(offer);
}
export function processMarketWeek(save, rng) {
    const user = save.clubId;
    const mine = squadOf(save, user);
    // Limpieza: partidas viejas pueden traer ofertas de clubes ficticios que no deben existir.
    save.offers = save.offers.filter((o) => o.fromClubId === user || !clubById(o.fromClubId).ghost);
    for (const p of mine) {
        // El usuario bloqueó las ofertas por este jugador.
        if (p.noOffers)
            continue;
        if (p.listedForLoan) {
            if (rng.chance(0.38)) {
                const seasons = rng.chance(0.55) ? 1 : 2;
                const lfee = loanFee(p, seasons);
                const buyers = interestedBuyers(save, p, lfee, true);
                if (!buyers.length)
                    continue;
                const club = rng.pick(buyers);
                pushOffer(save, {
                    id: uid("of"),
                    kind: "loan",
                    playerId: p.id,
                    fromClubId: club.id,
                    toClubId: user,
                    fee: lfee,
                    loanSeasons: seasons,
                    week: save.week,
                    unsolicited: false,
                });
            }
            continue;
        }
        if (p.listed && rng.chance(0.55)) {
            const fee = capMarketValue(askPrice(p) * rng.float() * 0.25 + askPrice(p) * 0.78);
            const buyers = interestedBuyers(save, p, fee);
            if (!buyers.length)
                continue;
            const club = rng.pick(buyers);
            pushOffer(save, {
                id: uid("of"),
                kind: "buy",
                playerId: p.id,
                fromClubId: club.id,
                toClubId: user,
                fee,
                loanSeasons: 0,
                week: save.week,
                unsolicited: false,
            });
        }
        else if (!p.listed && p.age <= 29 && (p.ovr >= 82 || p.pot >= 88) && rng.chance(0.08)) {
            const fee = capMarketValue(p.value * (1.05 + rng.float() * 0.25));
            const buyers = interestedBuyers(save, p, fee).filter((c) => c.prestige >= clubById(user).prestige - 6);
            if (!buyers.length)
                continue;
            const club = rng.pick(buyers);
            pushOffer(save, {
                id: uid("of"),
                kind: "buy",
                playerId: p.id,
                fromClubId: club.id,
                toClubId: user,
                fee,
                loanSeasons: 0,
                week: save.week,
                unsolicited: true,
            });
        }
    }
    const incoming = save.offers.filter((o) => o.toClubId === user && o.week === save.week);
    for (const o of incoming) {
        const p = save.players.find((x) => x.id === o.playerId);
        if (!p)
            continue;
        const from = clubById(o.fromClubId);
        if (o.kind === "loan") {
            news(save, "neutral", `Cesión: ${from.short} por ${p.name}`, `${from.name} ofrece ${formatMoney(o.fee)} por ${o.loanSeasons} temporada${o.loanSeasons > 1 ? "s" : ""}. GRL ${p.ovr} · POT ${p.pot}.`);
        }
        else {
            news(save, o.unsolicited ? "neutral" : "good", o.unsolicited ? `${from.short} tienta por ${p.name}` : `Oferta por ${p.name}`, `${from.name} pone ${formatMoney(o.fee)} por ${p.name}. GRL ${p.ovr} · POT ${p.pot}.`);
            // Sin popup: las ofertas llegan directo a Mercado → Ofertas (con señalador numérico).
        }
    }
    runAiMarket(save, rng);
}
export function acceptOffer(save, offerId, keepPct = 0) {
    const offer = save.offers.find((o) => o.id === offerId);
    if (!offer)
        return "La oferta ya no está.";
    const p = save.players.find((x) => x.id === offer.playerId);
    if (!p)
        return "Jugador no encontrado.";
    if (p.clubId !== save.clubId)
        return "Ya no está en tu club.";
    const size = activeSquad(save, save.clubId).length;
    if (offer.kind === "buy" && size <= SQUAD_MIN)
        return "No puedes bajar de 18 jugadores.";
    const pct = offer.kind === "buy" ? clamp(Math.round(keepPct), 0, 30) : 0;
    // Quedarte con un % de la próxima venta abarata lo que cobrás hoy (cada 10% = 5%).
    const fee = Math.round(offer.fee * (1 - pct * 0.005));
    // El comprador es un club con presupuesto real: si ya no le alcanza o tiene la plantilla llena, se cae.
    ensureFinance(save);
    const buyerSize = save.players.filter((x) => x.clubId === offer.fromClubId).length;
    if (!canAfford(save, offer.fromClubId, fee)) {
        save.offers = save.offers.filter((o) => o.id !== offerId);
        return `${clubById(offer.fromClubId).name} ya no tiene presupuesto para esta oferta.`;
    }
    if (buyerSize >= SQUAD_LIMIT) {
        save.offers = save.offers.filter((o) => o.id !== offerId);
        return `${clubById(offer.fromClubId).name} tiene la plantilla completa y retiró la oferta.`;
    }
    creditClub(save, offer.fromClubId, -fee);
    save.budget += offer.kind === "buy" ? settleSellOn(save, p, fee, true) : fee;
    logTransfer(save, p, save.clubId, offer.fromClubId, offer.kind === "loan" ? "loan" : "sale", fee);
    save.offers = save.offers.filter((o) => o.id !== offerId && o.playerId !== p.id);
    if (offer.kind === "loan") {
        p.clubId = offer.fromClubId;
        p.loanFrom = save.clubId;
        p.loanSeasons = offer.loanSeasons;
        p.listed = false;
        p.listedForLoan = false;
        save.loans.push({
            playerId: p.id,
            fromClubId: save.clubId,
            toClubId: offer.fromClubId,
            seasonsLeft: offer.loanSeasons,
            fee: offer.fee,
        });
        const squad = activeSquad(save, save.clubId);
        save.tactics.lineup = dropFromLineup(save.tactics.lineup, save.tactics.formation, p.id, squad);
        news(save, "neutral", `${p.name} se va a cesión`, `${clubById(offer.fromClubId).name} paga ${formatMoney(offer.fee)} por ${offer.loanSeasons} temporada${offer.loanSeasons > 1 ? "s" : ""}.`);
        return null;
    }
    p.clubId = offer.fromClubId;
    p.listed = false;
    p.listedForLoan = false;
    p.sellOn = pct > 0 ? { clubId: save.clubId, pct } : null;
    news(save, "neutral", `Venta: ${p.name}`, `${clubById(offer.fromClubId).name} paga ${formatMoney(fee)}${pct > 0 ? ` y te deja el ${pct}% de la próxima venta` : ""}.`);
    const squad = activeSquad(save, save.clubId);
    save.tactics.lineup = dropFromLineup(save.tactics.lineup, save.tactics.formation, p.id, squad);
    return null;
}
export function rejectOffer(save, offerId) {
    save.offers = save.offers.filter((o) => o.id !== offerId);
}
/** Cierra un fichaje ya negociado: paga traspaso + prima y aplica el contrato. */
export function completeSigning(save, playerId, terms, payClause) {
    const found = findMarketPlayer(save, playerId);
    if (!found)
        return "Jugador no encontrado.";
    const { player: p, free } = found;
    if (p.clubId === save.clubId)
        return "Ya está en tu plantilla.";
    if (p.loanFrom)
        return "Está a cesión; no se puede comprar así.";
    const names = new Set(save.players.filter((x) => x.clubId === save.clubId).map((x) => x.name.toLowerCase()));
    if (names.has(p.name.toLowerCase()))
        return "Ese jugador ya está en tu club.";
    if (!free && !marketPool(save).some((x) => x.id === p.id))
        return "No está disponible.";
    if (activeSquad(save, save.clubId).length >= SQUAD_LIMIT)
        return "Plantilla llena (máximo 40).";
    if (payClause && !clauseOf(p))
        return "Este jugador no tiene cláusula.";
    const fee = transferFee(p, free, payClause, terms.sellOnPct);
    if (save.budget < fee + terms.signingBonus)
        return "No hay presupuesto para este fichaje.";
    const from = free ? null : clubById(p.clubId);
    const fromId = p.clubId;
    save.budget -= fee + terms.signingBonus;
    if (!free)
        creditClub(save, fromId, fee);
    logTransfer(save, p, free ? NO_CLUB : fromId, save.clubId, free ? "free" : payClause ? "clause" : "sale", fee);
    if (free) {
        signFreeAgent(save, p, save.clubId, terms);
    }
    else {
        if (!payClause && terms.sellOnPct > 0)
            p.sellOn = { clubId: p.clubId, pct: terms.sellOnPct };
        else
            p.sellOn = null;
        p.clubId = save.clubId;
        p.listed = false;
        p.listedForLoan = false;
        p.morale = clamp(p.morale + 8, 40, 100);
        applyTerms(p, terms);
    }
    p.value = playerValue(p.ovr, p.age, p.pot, p);
    save.offers = save.offers.filter((o) => o.playerId !== p.id);
    const body = from
        ? `Llega desde ${from.name} por ${formatMoney(fee)}${payClause ? " (cláusula)" : ""}. GRL ${p.ovr} · POT ${p.pot}.`
        : `Firma como agente libre. GRL ${p.ovr} · POT ${p.pot}.`;
    news(save, "good", `Fichaje: ${p.name}`, body);
    save.popups.push({ id: uid("pop"), kind: "info", tone: "good", title: `${p.name} es tuyo`, body });
    return null;
}
/** Cierra una renovación ya negociada. */
export function completeRenewal(save, playerId, terms) {
    const p = save.players.find((x) => x.id === playerId);
    if (!p || p.clubId !== save.clubId)
        return "Ese jugador no está en tu club.";
    if (p.loanFrom)
        return "Es un cedido: su contrato es de otro club.";
    if (save.budget < terms.signingBonus)
        return "No alcanza para la prima de firma.";
    save.budget -= terms.signingBonus;
    applyTerms(p, terms);
    p.morale = clamp(p.morale + 8, 20, 100);
    news(save, "good", `Renovó ${p.name}`, `Firma por ${terms.years} año${terms.years > 1 ? "s" : ""} · ${formatMoney(terms.wage)}/sem.`);
    return null;
}
export function resolveLoans(save) {
    const kept = [];
    for (const loan of save.loans) {
        const left = loan.seasonsLeft - 1;
        const p = save.players.find((x) => x.id === loan.playerId);
        if (!p)
            continue;
        if (left <= 0) {
            p.clubId = loan.fromClubId;
            p.loanFrom = null;
            p.loanSeasons = 0;
            p.listedForLoan = false;
            if (loan.fromClubId === save.clubId) {
                news(save, "good", `${p.name} vuelve de cesión`, `Regresa desde ${clubById(loan.toClubId).name}. GRL ${p.ovr}.`);
            }
        }
        else {
            p.loanSeasons = left;
            kept.push({ ...loan, seasonsLeft: left });
        }
    }
    save.loans = kept;
}
export function spawnWonderkids(save, rng, used) {
    const n = rng.int(3, 6);
    const clubs = CLUBS.map((c) => c.id);
    for (let i = 0; i < n; i++) {
        const clubId = rng.pick(clubs);
        if (clubById(clubId).ghost)
            continue;
        if (activeSquad(save, clubId).length >= SQUAD_LIMIT)
            continue;
        const pos = rng.pick(["ST", "CAM", "CM", "LW", "RW", "CB", "LB", "RB"]);
        const p = generated(clubId, pos, rng.int(200, 9000), clubById(clubId).prestige, rng, used);
        p.age = rng.int(16, 19);
        p.ovr = rng.int(60, 72);
        p.pot = rng.chance(0.15) ? rng.int(92, 98) : rng.int(84, 93);
        p.seasonStartOvr = p.ovr;
        p.hiddenGem = true;
        p.value = playerValue(p.ovr, p.age, p.pot, p);
        resyncStats(p, rng);
        save.players.push(ensureTerms(p));
    }
}
