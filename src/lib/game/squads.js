import { rollPotential } from "./potential";
import { clubById } from "./clubs";
import { clamp, playerValue, playerWage } from "./format";
import { STARS, makeName, pickNat } from "./names";
import { alignOutfield, gkFor, syncStats } from "./stats";
const SQUAD_SHAPE = [
    { pos: "GK", n: 3 },
    { pos: "RB", n: 2 },
    { pos: "CB", n: 4 },
    { pos: "LB", n: 2 },
    { pos: "CDM", n: 2 },
    { pos: "CM", n: 3 },
    { pos: "CAM", n: 2 },
    { pos: "RW", n: 2 },
    { pos: "LW", n: 2 },
    { pos: "ST", n: 3 },
];
function extras(ovr) {
    return {
        careerGoals: 0,
        careerAssists: 0,
        careerApps: 0,
        seasonStartOvr: ovr,
        listedForLoan: false,
        loanFrom: null,
        loanSeasons: 0,
        hiddenGem: false,
        suspended: 0,
        number: 0,
    };
}
function rawAttrsFor(pos, ovr, rng) {
    const j = () => rng.int(-3, 3);
    const cap = (n) => clamp(Math.round(n), 42, 100);
    const base = ovr - 2;
    if (pos === "GK") {
        return {
            pac: cap(base - 28 + j()),
            sho: cap(base - 30 + j()),
            pas: cap(base - 12 + j()),
            dri: cap(base - 18 + j()),
            def: cap(base - 8 + j()),
            phy: cap(base - 4 + j()),
        };
    }
    if (pos === "CB") {
        return {
            pac: cap(base - 14 + j()),
            sho: cap(base - 22 + j()),
            pas: cap(base - 8 + j()),
            dri: cap(base - 12 + j()),
            def: cap(base + 4 + j()),
            phy: cap(base + 3 + j()),
        };
    }
    if (pos === "LB" || pos === "RB") {
        return {
            pac: cap(base + 2 + j()),
            sho: cap(base - 14 + j()),
            pas: cap(base - 4 + j()),
            dri: cap(base - 2 + j()),
            def: cap(base + 1 + j()),
            phy: cap(base - 2 + j()),
        };
    }
    if (pos === "CDM") {
        return {
            pac: cap(base - 6 + j()),
            sho: cap(base - 10 + j()),
            pas: cap(base + 2 + j()),
            dri: cap(base - 2 + j()),
            def: cap(base + 3 + j()),
            phy: cap(base + 2 + j()),
        };
    }
    if (pos === "CM") {
        return {
            pac: cap(base - 2 + j()),
            sho: cap(base - 4 + j()),
            pas: cap(base + 3 + j()),
            dri: cap(base + 1 + j()),
            def: cap(base - 4 + j()),
            phy: cap(base - 2 + j()),
        };
    }
    if (pos === "CAM") {
        return {
            pac: cap(base + 1 + j()),
            sho: cap(base + 1 + j()),
            pas: cap(base + 4 + j()),
            dri: cap(base + 3 + j()),
            def: cap(base - 16 + j()),
            phy: cap(base - 8 + j()),
        };
    }
    if (pos === "LW" || pos === "RW") {
        return {
            pac: cap(base + 5 + j()),
            sho: cap(base + 1 + j()),
            pas: cap(base - 2 + j()),
            dri: cap(base + 4 + j()),
            def: cap(base - 20 + j()),
            phy: cap(base - 8 + j()),
        };
    }
    return {
        pac: cap(base + 2 + j()),
        sho: cap(base + 5 + j()),
        pas: cap(base - 8 + j()),
        dri: cap(base + 1 + j()),
        def: cap(base - 22 + j()),
        phy: cap(base + 2 + j()),
    };
}
/**
 * Estadísticas coherentes con el GRL: el perfil típico de la posición, ajustado para que las
 * estadísticas den exactamente esa media (un 86 nunca aparece con stats de 45).
 */
export function attrsFor(pos, ovr, rng) {
    const raw = rawAttrsFor(pos, ovr, rng);
    return pos === "GK" ? raw : alignOutfield(pos, raw, ovr);
}
/** Atributos de campo + estadísticas de portero (solo si juega de PO). */
export function statsFor(pos, ovr, rng) {
    const attrs = attrsFor(pos, ovr, rng);
    return pos === "GK" ? { attrs, gk: gkFor(ovr, rng) } : { attrs };
}
/** Reajusta las estadísticas de un jugador a su GRL actual (si hay mucha diferencia, las rehace). */
export function resyncStats(p, rng) {
    syncStats(p, (pos, ovr) => attrsFor(pos, ovr, rng));
}
function fromStar(clubId, seed, i, rng) {
    const club = clubById(clubId);
    const pot = seed.pot ?? rollPotential(seed.ovr, seed.age, rng);
    const ovr = seed.ovr;
    return {
        id: `${clubId}-${i}`,
        name: seed.name,
        nat: seed.nat,
        age: seed.age,
        pos: seed.pos,
        ovr,
        pot,
        clubId,
        value: playerValue(ovr, seed.age, pot),
        wage: playerWage(ovr, club.prestige),
        contract: rng.int(1, 4),
        form: rng.int(-1, 2),
        fitness: rng.int(88, 100),
        morale: rng.int(68, 92),
        goals: 0,
        assists: 0,
        apps: 0,
        injured: 0,
        yellows: 0,
        listed: false,
        ...statsFor(seed.pos, ovr, rng),
        ...extras(ovr),
    };
}
export function generated(clubId, pos, i, prestige, rng, used) {
    const club = clubById(clubId);
    const nat = pickNat(rng, clubId, club.league, club.country);
    const name = makeName(rng, nat, used);
    const age = rng.int(18, 34);
    const cap = Math.min(prestige - 6, club.league === "serieA" ? 82 : 86);
    let ovr = clamp(prestige - 12 + rng.int(-5, 4), 58, cap);
    if (age >= 32)
        ovr = clamp(ovr - rng.int(1, 4), 58, 84);
    if (age <= 21)
        ovr = clamp(ovr - rng.int(2, 6), 58, 80);
    const pot = rollPotential(ovr, age, rng);
    return {
        id: `${clubId}-g-${i}-${rng.int(1000, 9999)}`,
        name,
        nat,
        age,
        pos,
        ovr,
        pot,
        clubId,
        value: playerValue(ovr, age, pot),
        wage: playerWage(ovr, club.prestige),
        contract: rng.int(1, 5),
        form: rng.int(-2, 2),
        fitness: rng.int(84, 100),
        morale: rng.int(62, 88),
        goals: 0,
        assists: 0,
        apps: 0,
        injured: 0,
        yellows: 0,
        listed: false,
        ...statsFor(pos, ovr, rng),
        ...extras(ovr),
        locked: Boolean(club.ghost),
    };
}
export function assignShirtNumbers(players) {
    const taken = new Set();
    const prefer = {
        GK: [1, 16, 30, 40, 50],
        RB: [2, 22, 12, 24],
        CB: [4, 5, 3, 6, 15, 23],
        LB: [3, 12, 19, 21],
        CDM: [6, 8, 21, 18],
        CM: [8, 10, 14, 28],
        CAM: [10, 7, 20, 11],
        RW: [7, 11, 17, 27],
        LW: [11, 7, 19, 29],
        ST: [9, 11, 19, 18, 99],
    };
    for (const p of players) {
        if (p.number >= 1 && p.number <= 99 && !taken.has(p.number)) {
            taken.add(p.number);
            continue;
        }
        const prefs = prefer[p.pos] ?? [10];
        let n = prefs.find((x) => !taken.has(x));
        if (!n) {
            n = 1;
            while (taken.has(n) && n < 99)
                n += 1;
        }
        p.number = n;
        taken.add(n);
    }
}
export function buildSquad(clubId, rng, usedNames) {
    const club = clubById(clubId);
    const stars = STARS[clubId] ?? [];
    const players = [];
    const counts = {};
    let i = 0;
    for (const star of stars) {
        const p = fromStar(clubId, star, i++, rng);
        usedNames.add(p.name);
        players.push(p);
        counts[p.pos] = (counts[p.pos] ?? 0) + 1;
    }
    for (const slot of SQUAD_SHAPE) {
        const have = counts[slot.pos] ?? 0;
        for (let k = have; k < slot.n; k++) {
            const p = generated(clubId, slot.pos, i++, club.prestige, rng, usedNames);
            players.push(p);
            counts[slot.pos] = (counts[slot.pos] ?? 0) + 1;
        }
    }
    assignShirtNumbers(players);
    return players;
}
export function plantHiddenGems(players, rng) {
    const young = players.filter((p) => p.age <= 21 && p.pot <= 78 && p.ovr <= 74);
    const picks = rng.shuffle(young).slice(0, 7);
    for (const p of picks) {
        p.pot = rng.chance(0.18) ? rng.int(94, 99) : rng.int(88, 96);
        p.hiddenGem = true;
        p.value = playerValue(p.ovr, p.age, p.pot, p);
    }
    return picks;
}
