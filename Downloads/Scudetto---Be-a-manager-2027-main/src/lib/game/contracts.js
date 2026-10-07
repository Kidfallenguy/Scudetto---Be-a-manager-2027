import { clubById } from "./clubs";
import { clamp, playerWage, posGroup } from "./format";
/** Escala para comparar dinero semanal con primas puntuales (semanas "útiles" por temporada). */
const WEEKS = 40;
export const MAX_YEARS = 5;
export const ROLE_LABEL = {
    starter: "Titular",
    rotation: "Rotación",
    backup: "Suplente",
    prospect: "Prospecto",
};
export const ROLES = ["starter", "rotation", "backup", "prospect"];
const ROLE_RANK = { starter: 3, rotation: 2, prospect: 1.5, backup: 1 };
// ---------------------------------------------------------------------------
// Fechas de contrato
// ---------------------------------------------------------------------------
/** Año calendario en que vence el contrato (30 de junio). */
export function contractEndYear(season, p) {
    return season + Math.max(0, p.contract);
}
export function contractEndLabel(season, p) {
    return `30 jun ${contractEndYear(season, p)}`;
}
/** Último año de contrato: el club tiene que renovar o lo pierde a fin de temporada. */
export function isExpiring(p) {
    return p.contract <= 1;
}
// ---------------------------------------------------------------------------
// Utilidades deterministas (sin Math.random: recargar la partida no cambia nada)
// ---------------------------------------------------------------------------
export function hash01(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return ((h >>> 0) % 100000) / 100000;
}
export function ambitionOf(p) {
    return hash01(`${p.id}:amb`);
}
export function roundMoney(n) {
    if (n >= 10_000_000)
        return Math.round(n / 100_000) * 100_000;
    if (n >= 1_000_000)
        return Math.round(n / 10_000) * 10_000;
    if (n >= 100_000)
        return Math.round(n / 1000) * 1000;
    return Math.round(n / 250) * 250;
}
export function wageStep(ref) {
    return Math.max(250, roundMoney(ref * 0.02));
}
// ---------------------------------------------------------------------------
// Términos por defecto (cláusula de rescisión inicial de todos los jugadores)
// ---------------------------------------------------------------------------
export function blankTerms(p) {
    return {
        wage: p.wage,
        years: Math.max(1, p.contract),
        signingBonus: 0,
        releaseClause: null,
        role: null,
        goalBonus: 0,
        assistBonus: 0,
        appBonus: 0,
        titleBonus: 0,
        sellOnPct: 0,
    };
}
/** Cláusula inicial: en España es obligatoria y alta; en el resto solo algunos jugadores la tienen. */
export function defaultClause(p) {
    const league = clubById(p.clubId).league;
    const has = league === "laliga" || hash01(`${p.id}:cl`) < 0.5;
    if (!has)
        return null;
    const mult = (league === "laliga" ? 1.8 : 1.4) + hash01(`${p.id}:clm`) * 1.6;
    return roundMoney(p.value * mult);
}
/** Le pone cláusula inicial a quien no la tiene definida (partidas viejas, regenerados, juveniles). */
export function ensureTerms(p) {
    if (p.terms || p.clause !== undefined)
        return p;
    return { ...p, clause: defaultClause(p) ?? 0 };
}
export function clauseOf(p) {
    if (p.terms)
        return p.terms.releaseClause;
    return p.clause ? p.clause : null;
}
// ---------------------------------------------------------------------------
// Qué espera el jugador
// ---------------------------------------------------------------------------
const STARTER_SLOTS = { GK: 1, DEF: 4, MID: 4, FWD: 3 };
/** Rol que el jugador espera tener en el club (según cuántos mejores hay en su puesto). */
export function expectedRole(save, p, clubId) {
    const group = posGroup(p.pos);
    const better = save.players.filter((x) => x.clubId === clubId && x.id !== p.id && posGroup(x.pos) === group && x.ovr > p.ovr + 1).length;
    const slots = STARTER_SLOTS[group];
    if (better < slots)
        return "starter";
    if (better < slots + 2)
        return "rotation";
    if (p.age <= 21 && p.pot - p.ovr >= 8)
        return "prospect";
    return "backup";
}
function preferredYears(age) {
    if (age <= 22)
        return 5;
    if (age <= 27)
        return 4;
    if (age <= 30)
        return 3;
    if (age <= 33)
        return 2;
    return 1;
}
/** Cuántos clubes rivales andan detrás del jugador (sube su exigencia). */
export function rivalInterest(p) {
    const quality = (p.ovr - 68) / 4 + (p.pot - p.ovr) / 7 - Math.max(0, p.age - 30) * 0.6;
    return clamp(Math.round(quality), 0, 6);
}
/** Salario "de mercado" para el jugador, sin tener en cuenta el club que ofrece. */
export function marketWage(p) {
    const young = p.age < 26 ? 1 + Math.max(0, p.pot - p.ovr) * 0.007 : 1;
    const old = p.age > 31 ? Math.max(0.7, 1 - (p.age - 31) * 0.05) : 1;
    return roundMoney(playerWage(p.ovr, 82) * young * old);
}
export function marketClause(p) {
    return roundMoney(p.value * (1.7 + ambitionOf(p) * 0.8));
}
/** Producción esperada por temporada según puesto y nivel (para valorar bonus). */
function expectedProduction(p, role) {
    const f = clamp(0.4 + (p.ovr - 60) * 0.025, 0.4, 1.4);
    const base = {
        GK: { g: 0, a: 0.2 },
        RB: { g: 1, a: 4 },
        LB: { g: 1, a: 4 },
        CB: { g: 2, a: 0.8 },
        CDM: { g: 1.5, a: 3 },
        CM: { g: 3.5, a: 5 },
        CAM: { g: 6, a: 8 },
        RW: { g: 8, a: 8 },
        LW: { g: 8, a: 8 },
        ST: { g: 15, a: 4 },
    };
    const mins = role === "starter" ? 1 : role === "rotation" ? 0.62 : role === "prospect" ? 0.3 : 0.28;
    const apps = role === "starter" ? 42 : role === "rotation" ? 26 : role === "prospect" ? 10 : 12;
    return { goals: base[p.pos].g * f * mins, assists: base[p.pos].a * f * mins, apps };
}
function titleChance(clubId) {
    return clamp((clubById(clubId).prestige - 72) / 60, 0.02, 0.45);
}
function bonusSeason(t, p, clubId, role) {
    const e = expectedProduction(p, t.role ?? role);
    return (t.goalBonus * e.goals + t.assistBonus * e.assists + t.appBonus * e.apps + t.titleBonus * titleChance(clubId));
}
export function buildReference(p) {
    const w = marketWage(p);
    return {
        wage: w,
        signingBonus: roundMoney(w * 8),
        releaseClause: marketClause(p),
        goalBonus: roundMoney(w * 0.4),
        assistBonus: roundMoney(w * 0.25),
        appBonus: roundMoney(w * 0.08),
        titleBonus: roundMoney(w * 8),
    };
}
export function refusalReason(save, p, ctx) {
    const club = clubById(ctx.clubId);
    const amb = ambitionOf(p);
    if (ctx.kind === "renew") {
        if (p.morale < 38)
            return `${p.name} está muy disconforme y no quiere hablar de renovar.`;
        if (amb > 0.8 && club.prestige < p.ovr - 8)
            return `${p.name} quiere un proyecto más grande y no piensa renovar.`;
    }
    else if (p.ovr - club.prestige > 9 && amb > 0.45) {
        return `${p.name} no se ve en un club de este nivel y rechaza hablar con vos.`;
    }
    void save;
    return null;
}
export function buildDemand(save, p, ctx) {
    const club = clubById(ctx.clubId);
    const amb = ambitionOf(p);
    const interest = rivalInterest(p);
    const reference = buildReference(p);
    const role = expectedRole(save, p, ctx.clubId);
    // Piso: en renovaciones nadie acepta cobrar menos de lo que ya cobra (salvo veteranos).
    let wage = reference.wage;
    if (ctx.kind === "renew")
        wage = Math.max(wage, p.wage * (p.age >= 33 ? 0.85 : 1));
    let mult = 0.93 + amb * 0.18;
    mult += interest * 0.022;
    const appeal = club.prestige - (p.ovr + 2);
    mult += appeal < 0 ? Math.min(0.16, -appeal * 0.012) : -Math.min(0.08, appeal * 0.006);
    if (p.morale < 55)
        mult += (55 - p.morale) * 0.002;
    if (role === "starter")
        mult += 0.02;
    wage = roundMoney(wage * mult);
    const years = preferredYears(p.age);
    const bonusMult = ctx.freeAgent ? 20 : ctx.kind === "renew" ? 6 : 9;
    const ideal = {
        wage,
        years,
        signingBonus: roundMoney(wage * bonusMult),
        releaseClause: Math.max(reference.releaseClause, roundMoney(p.value * 1.2)),
        role,
        goalBonus: 0,
        assistBonus: 0,
        appBonus: 0,
        titleBonus: 0,
        sellOnPct: 0,
    };
    return {
        ideal,
        reference,
        expectedRole: role,
        preferredYears: years,
        interest,
        maxRounds: 4 + Math.floor(hash01(`${p.id}:rounds`) * 3),
        refuses: refusalReason(save, p, ctx),
        ambition: amb,
    };
}
/** Oferta inicial sugerida (alrededor del valor base de mercado). */
export function suggestedOffer(demand) {
    return {
        wage: demand.reference.wage,
        years: demand.preferredYears,
        signingBonus: 0,
        releaseClause: demand.reference.releaseClause,
        role: demand.expectedRole,
        goalBonus: 0,
        assistBonus: 0,
        appBonus: 0,
        titleBonus: 0,
        sellOnPct: 0,
    };
}
// ---------------------------------------------------------------------------
// Valoración de una oferta
// ---------------------------------------------------------------------------
/** Valor percibido por el jugador (dinero por temporada equivalente). */
export function offerUtility(t, p, demand, ctx) {
    const amb = demand.ambition;
    const expRole = demand.expectedRole;
    const base = t.wage * WEEKS +
        t.signingBonus / Math.max(1, t.years) +
        bonusSeason(t, p, ctx.clubId, expRole) * (amb > 0.5 ? 1.05 : 0.9);
    let factor = 1;
    // Años: los jóvenes quieren seguridad; los veteranos no se quejan por contratos cortos.
    if (t.years < demand.preferredYears && p.age < 31)
        factor -= (demand.preferredYears - t.years) * 0.045;
    if (t.years > demand.preferredYears && p.age >= 31)
        factor += Math.min(0.05, (t.years - demand.preferredYears) * 0.02);
    // Rol: ser relegado enoja, que te prometan más gusta.
    if (t.role) {
        const diff = ROLE_RANK[t.role] - ROLE_RANK[expRole];
        factor += diff >= 0 ? Math.min(0.06, diff * 0.03) : diff * (0.09 + amb * 0.08);
    }
    else if (expRole === "starter") {
        factor -= 0.03;
    }
    // Cláusula: barata les da libertad, inexistente no gusta a los ambiciosos.
    if (t.releaseClause == null) {
        factor -= amb > 0.55 ? 0.03 : 0;
    }
    else {
        const ratio = t.releaseClause / demand.reference.releaseClause;
        factor += ratio < 1 ? Math.min(0.04, (1 - ratio) * 0.06) : -Math.min(0.08, (ratio - 1) * 0.05) * amb;
    }
    return base * Math.max(0.5, factor);
}
export function idealUtility(p, demand, ctx) {
    return offerUtility(demand.ideal, p, demand, ctx);
}
export function openNegotiation(demand, p, kind) {
    return {
        playerId: p.id,
        kind,
        round: 0,
        maxRounds: demand.maxRounds,
        status: demand.refuses ? "broken" : "open",
        lastOffer: null,
        counter: null,
        mood: 50,
        ratios: [],
        message: demand.refuses ?? openingLine(p, kind),
    };
}
function openingLine(p, kind) {
    return kind === "renew"
        ? `El agente de ${p.name} escucha tu propuesta de renovación.`
        : `El agente de ${p.name} quiere ver tu oferta.`;
}
export function moodFromRatio(r) {
    return clamp(Math.round(((r - 0.55) / 0.45) * 100), 0, 100);
}
export function moodLabel(mood) {
    if (mood >= 95)
        return "Encantado";
    if (mood >= 75)
        return "Muy cerca";
    if (mood >= 50)
        return "Interesado";
    if (mood >= 25)
        return "Dudoso";
    return "Molesto";
}
/** Redondea y acota los términos para que sean válidos. */
export function clampTerms(t) {
    return {
        ...t,
        wage: Math.max(0, roundMoney(t.wage)),
        years: clamp(Math.round(t.years), 1, MAX_YEARS),
        signingBonus: Math.max(0, roundMoney(t.signingBonus)),
        releaseClause: t.releaseClause == null ? null : Math.max(0, roundMoney(t.releaseClause)),
        goalBonus: Math.max(0, roundMoney(t.goalBonus)),
        assistBonus: Math.max(0, roundMoney(t.assistBonus)),
        appBonus: Math.max(0, roundMoney(t.appBonus)),
        titleBonus: Math.max(0, roundMoney(t.titleBonus)),
        sellOnPct: clamp(Math.round(t.sellOnPct), 0, 30),
    };
}
/**
 * El usuario envía una oferta. El jugador acepta, contraoferta o corta.
 * Es determinista: misma oferta en la misma ronda = misma respuesta.
 */
export function submitOffer(state, offerRaw, p, demand, ctx) {
    if (state.status !== "open")
        return state;
    const offer = clampTerms(offerRaw);
    const round = state.round + 1;
    const ideal = idealUtility(p, demand, ctx);
    const r = offerUtility(offer, p, demand, ctx) / Math.max(1, ideal);
    const ratios = [...state.ratios, r];
    const mood = moodFromRatio(r);
    const prev = state.ratios[state.ratios.length - 1];
    // 1) Acepta: cuanto más avanzan las rondas, menos exigente.
    const acceptAt = 1 - 0.02 * (round - 1) - (demand.interest === 0 ? 0.03 : 0);
    if (r >= acceptAt) {
        return {
            ...state,
            round,
            status: "accepted",
            lastOffer: offer,
            counter: offer,
            mood: Math.max(mood, 96),
            ratios,
            message: `¡Trato hecho! ${p.name} acepta tus condiciones.`,
        };
    }
    // 2) Corta: la oferta está demasiado lejos o lo estás tratando de engañar.
    const floor = 0.58 + demand.ambition * 0.06;
    const stalled = prev !== undefined && r <= prev + 0.005 && r < 0.9;
    const rnd = hash01(`${p.id}:${round}:${Math.round(r * 100)}`);
    const breakChance = r < floor ? 1 : r < floor + 0.1 ? 0.45 : stalled ? 0.25 : 0;
    if (rnd < breakChance) {
        return {
            ...state,
            round,
            status: "broken",
            lastOffer: offer,
            counter: null,
            mood: Math.min(mood, 10),
            ratios,
            message: r < floor
                ? `${p.name} se ofende con la propuesta y se levanta de la mesa.`
                : `${p.name} se cansó de que no mejores la oferta y corta la negociación.`,
        };
    }
    // 3) Se acabaron las rondas.
    if (round >= state.maxRounds) {
        return {
            ...state,
            round,
            status: "expired",
            lastOffer: offer,
            counter: null,
            mood,
            ratios,
            message: `Se acabó el tiempo: ${p.name} no cierra y deja la mesa.`,
        };
    }
    // 4) Contraoferta: pide lo que le falta, cediendo un poco cada ronda.
    const counter = buildCounter(offer, p, demand, ctx, round, state.maxRounds);
    return {
        ...state,
        round,
        lastOffer: offer,
        counter,
        mood,
        ratios,
        message: counterLine(offer, counter, p),
    };
}
function buildCounter(offer, p, demand, ctx, round, maxRounds) {
    const c = { ...offer };
    const ideal = demand.ideal;
    // Rol: si lo relegás, pide el rol que espera.
    const offeredRank = offer.role ? ROLE_RANK[offer.role] : 0;
    if (offeredRank < ROLE_RANK[demand.expectedRole] - 0.5)
        c.role = demand.expectedRole;
    // Años: los jóvenes piden su plazo ideal.
    if (offer.years < demand.preferredYears && p.age < 31)
        c.years = Math.min(demand.preferredYears, offer.years + 1);
    // Cláusula: no se juega con una cláusula carísima.
    if (offer.releaseClause != null && offer.releaseClause > demand.reference.releaseClause * 1.5) {
        c.releaseClause = roundMoney(demand.reference.releaseClause * 1.25);
    }
    // Dinero: lo que falta se pide en sueldo y prima de firma, cediendo un poco por ronda.
    const target = idealUtility(p, demand, ctx) * (1 + 0.05 * Math.max(0, maxRounds - round) / maxRounds);
    const have = offerUtility(c, p, demand, ctx);
    const gap = Math.max(0, target - have);
    // Piso de lo que están dispuestos a bajar respecto de su ideal.
    const wageGap = gap * 0.72;
    const bonusGap = gap - wageGap;
    c.wage = Math.min(Math.round(ideal.wage * 1.3), c.wage + wageGap / WEEKS);
    c.signingBonus = c.signingBonus + bonusGap * Math.max(1, c.years);
    return clampTerms(c);
}
function counterLine(offer, counter, p) {
    const asks = [];
    if (counter.wage > offer.wage)
        asks.push("más sueldo");
    if (counter.years !== offer.years)
        asks.push("otro plazo");
    if (counter.signingBonus > offer.signingBonus)
        asks.push("más prima de firma");
    if (counter.role !== offer.role)
        asks.push("otro rol");
    if (counter.releaseClause !== offer.releaseClause)
        asks.push("otra cláusula");
    if (!asks.length)
        return `${p.name} duda y pide un esfuerzo más.`;
    return `${p.name} contraoferta: pide ${asks.join(", ")}.`;
}
/** Campos que el jugador cambió respecto de tu oferta (para marcarlos en amarillo). */
export function changedFields(offer, counter) {
    const out = new Set();
    if (!offer || !counter)
        return out;
    Object.keys(counter).forEach((k) => {
        if (counter[k] !== offer[k])
            out.add(k);
    });
    return out;
}
// ---------------------------------------------------------------------------
// Aplicar y costear contratos
// ---------------------------------------------------------------------------
/** Plata que el club desembolsa al cerrar el contrato (sin contar el traspaso). */
export function upfrontCost(t) {
    return t.signingBonus;
}
/** Aplica un contrato cerrado al jugador (no mueve dinero). */
export function applyTerms(p, t) {
    p.wage = t.wage;
    p.contract = t.years;
    p.terms = { ...t };
    p.clause = t.releaseClause ?? 0;
}
/** Condiciones para contratos de la IA: lo que el jugador pediría, con algo de ruido. */
export function aiTerms(save, p, clubId, freeAgent, renew) {
    const demand = buildDemand(save, p, { kind: renew ? "renew" : "sign", clubId, freeAgent });
    const noise = 0.97 + hash01(`${p.id}:${clubId}:${save.season}`) * 0.08;
    const ideal = demand.ideal;
    return clampTerms({
        ...ideal,
        wage: ideal.wage * noise,
        signingBonus: 0,
        role: null,
        releaseClause: defaultClauseFor(p, clubId),
    });
}
export function defaultClauseFor(p, clubId) {
    const league = clubById(clubId).league;
    const has = league === "laliga" || hash01(`${p.id}:${clubId}:cl`) < 0.5;
    if (!has)
        return null;
    const mult = (league === "laliga" ? 1.8 : 1.4) + hash01(`${p.id}:${clubId}:clm`) * 1.6;
    return roundMoney(p.value * mult);
}
// ---------------------------------------------------------------------------
// Pago de bonus (solo el club del usuario lleva la caja al detalle)
// ---------------------------------------------------------------------------
/** Paga goles, asistencias y partidos de la jornada. Devuelve el total pagado. */
export function payMatchBonuses(save, contrib, played) {
    let total = 0;
    for (const p of save.players) {
        if (p.clubId !== save.clubId || !p.terms)
            continue;
        const c = contrib.get(p.id);
        if (c)
            total += p.terms.goalBonus * c.goals + p.terms.assistBonus * c.assists;
        if (played.has(p.id))
            total += p.terms.appBonus;
    }
    total = Math.round(total);
    if (total > 0)
        save.budget -= total;
    return total;
}
/** Bonus por título para toda la plantilla con esa cláusula. */
export function titleBonusTotal(save) {
    let total = 0;
    for (const p of save.players) {
        if (p.clubId === save.clubId && p.terms)
            total += p.terms.titleBonus;
    }
    return Math.round(total);
}
