import { clubById } from "./clubs";
import { clamp, playerValue, playerWage } from "./format";
import { makeName } from "./names";
import { rollPotential } from "./potential";
import { statsFor } from "./squads";
export const SCOUT_COUNTRIES = [
    { id: "ita", nat: "ITA", name: "Italia", cost: 420_000, weeks: 2 },
    { id: "bra", nat: "BRA", name: "Brasil", cost: 920_000, weeks: 3 },
    { id: "arg", nat: "ARG", name: "Argentina", cost: 780_000, weeks: 3 },
    { id: "fra", nat: "FRA", name: "Francia", cost: 740_000, weeks: 3 },
    { id: "esp", nat: "ESP", name: "España", cost: 760_000, weeks: 3 },
    { id: "por", nat: "POR", name: "Portugal", cost: 640_000, weeks: 2 },
    { id: "ned", nat: "NED", name: "Países Bajos", cost: 580_000, weeks: 2 },
    { id: "nga", nat: "NGA", name: "Nigeria", cost: 520_000, weeks: 3 },
    { id: "sen", nat: "SEN", name: "Senegal", cost: 480_000, weeks: 3 },
    { id: "civ", nat: "CIV", name: "Costa de Marfil", cost: 460_000, weeks: 3 },
    { id: "cro", nat: "CRO", name: "Croacia", cost: 500_000, weeks: 2 },
    { id: "srb", nat: "SRB", name: "Serbia", cost: 440_000, weeks: 2 },
    { id: "mar", nat: "MAR", name: "Marruecos", cost: 430_000, weeks: 2 },
    { id: "jpn", nat: "JPN", name: "Japón", cost: 390_000, weeks: 3 },
    { id: "eng", nat: "ENG", name: "Inglaterra", cost: 880_000, weeks: 3 },
    { id: "ger", nat: "GER", name: "Alemania", cost: 820_000, weeks: 3 },
];
export const SCOUT_TIERS = [
    { tier: 1, label: "Red básica", mult: 1, blurb: "Barata. Perfiles modestos." },
    { tier: 2, label: "Red amplia", mult: 2.2, blurb: "Más ojos, mejores chances." },
    { tier: 3, label: "Red élite", mult: 3.6, blurb: "Caro. Apunta a cracks." },
];
export const ACADEMY_UPGRADE = [0, 4_500_000, 11_000_000, 22_000_000];
export const MAX_SCOUTS = 3;
export const ACADEMY_MAX = 22;
const POS_POOL = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
export function academyCapacity(_level) {
    return ACADEMY_MAX;
}
export function youthFee(ovr, pot) {
    const raw = 5_000_000 + Math.max(0, ovr - 55) * 480_000 + Math.max(0, pot - 72) * 720_000;
    return clamp(Math.round(raw / 100_000) * 100_000, 5_000_000, 40_000_000);
}
export function makeYouth(rng, nat, used, clubId, level, forced) {
    const pos = forced?.pos ?? rng.pick(POS_POOL);
    const age = forced?.age ?? rng.int(16, 19);
    const tier = forced?.tier ?? 1;
    const base = 52 +
        level * 2 +
        (tier === 3 ? rng.int(8, 16) : tier === 2 ? rng.int(4, 10) : rng.int(-2, 6));
    const ovr = forced?.ovr ?? clamp(base, 52, 76);
    let pot = forced?.pot ?? rollPotential(ovr, age, rng);
    if (tier === 3 && rng.chance(0.28))
        pot = clamp(Math.max(pot, rng.int(88, 95)), ovr, 99);
    if (tier === 2 && rng.chance(0.12))
        pot = clamp(Math.max(pot, rng.int(84, 92)), ovr, 96);
    if (rng.chance(0.012))
        pot = clamp(Math.max(pot, 96), ovr, 100);
    const name = forced?.name ?? makeName(rng, nat, used);
    const fee = forced?.fee ?? youthFee(ovr, pot);
    return {
        id: forced?.id ?? `y-${clubId}-${nat}-${rng.int(1000, 999999)}`,
        name,
        nat: forced?.nat ?? nat,
        age,
        pos,
        ovr,
        pot,
        weeksIn: forced?.weeksIn ?? 0,
        fee,
    };
}
export function seedAcademy(clubId, rng, used) {
    const club = clubById(clubId);
    const n = club.prestige >= 84 ? 5 : club.prestige >= 76 ? 4 : 3;
    const out = [];
    const homeNat = club.league === "bundesliga"
        ? "GER"
        : club.league === "premier"
            ? "ENG"
            : club.league === "laliga"
                ? "ESP"
                : club.league === "ligue1"
                    ? "FRA"
                    : "ITA";
    for (let i = 0; i < n; i++) {
        const nat = rng.chance(0.55) ? homeNat : rng.pick(["BRA", "FRA", "ARG", "ESP", "NGA", "SEN", "GER"]);
        out.push(makeYouth(rng, nat, used, clubId, 1));
    }
    return out;
}
export function emptyPlayerExtras() {
    return {
        careerGoals: 0,
        careerAssists: 0,
        careerApps: 0,
        seasonStartOvr: 0,
        listedForLoan: false,
        loanFrom: null,
        loanSeasons: 0,
        hiddenGem: false,
        suspended: 0,
        number: 0,
    };
}
export function youthToPlayer(y, clubId, rng) {
    const club = clubById(clubId);
    return {
        id: `p-${y.id}`,
        name: y.name,
        nat: y.nat,
        age: y.age,
        pos: y.pos,
        ovr: y.ovr,
        pot: y.pot,
        clubId,
        value: playerValue(y.ovr, y.age, y.pot),
        wage: Math.round(playerWage(y.ovr, club.prestige) * 0.45),
        contract: 3,
        form: 0,
        fitness: 94,
        morale: 78,
        goals: 0,
        assists: 0,
        apps: 0,
        injured: 0,
        yellows: 0,
        listed: false,
        ...statsFor(y.pos, y.ovr, rng),
        ...emptyPlayerExtras(),
        seasonStartOvr: y.ovr,
    };
}
export function resolveScouts(scouts, academy, level, clubId, rng, used) {
    const still = [];
    const found = [];
    const cap = academyCapacity(level);
    let nextAcademy = [...academy];
    for (const m of scouts) {
        const left = m.weeksLeft - 1;
        if (left > 0) {
            still.push({ ...m, weeksLeft: left });
            continue;
        }
        const n = m.tier === 3 ? rng.int(1, 3) : m.tier === 2 ? rng.int(1, 2) : rng.chance(0.7) ? 1 : 0;
        const count = Math.max(1, n);
        for (let i = 0; i < count; i++) {
            if (nextAcademy.length >= cap)
                break;
            const pos = m.preferredPos !== "ANY" && rng.chance(0.72) ? m.preferredPos : rng.pick(POS_POOL);
            const y = makeYouth(rng, m.nat, used, clubId, level, { pos, tier: m.tier });
            if (level >= 3 && rng.chance(0.18)) {
                y.pot = clamp(Math.max(y.pot, 90), y.ovr, 95);
                y.fee = youthFee(y.ovr, y.pot);
            }
            nextAcademy.push(y);
            found.push(y);
        }
    }
    return { scouts: still, academy: nextAcademy, found };
}
export function scoutCost(country, tier) {
    const row = SCOUT_TIERS.find((t) => t.tier === tier);
    return Math.round(country.cost * row.mult);
}
