import { clamp } from "./format";
/** Estadísticas de jugador de campo. */
export const OUTFIELD_STATS = ["pac", "sho", "pas", "dri", "def", "phy"];
/** Estadísticas de portero (como en el FC): estirada, manejo, saque, reflejos, velocidad, colocación. */
export const GK_STATS = ["div", "han", "kic", "ref", "spe", "pos"];
export const STAT_LABEL = {
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
export const STAT_SHORT = {
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
export function isGK(p) {
    return p.pos === "GK";
}
export function statKeysFor(pos) {
    return pos === "GK" ? [...GK_STATS] : [...OUTFIELD_STATS];
}
const OUT_WEIGHTS = {
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
export const GK_WEIGHTS = { div: 0.22, han: 0.2, kic: 0.08, ref: 0.24, spe: 0.04, pos: 0.22 };
export function weightsFor(pos) {
    return pos === "GK" ? { ...GK_WEIGHTS } : { ...OUT_WEIGHTS[pos] };
}
export function ovrFromOutfield(pos, a) {
    const w = OUT_WEIGHTS[pos];
    const raw = a.pac * w.pac + a.sho * w.sho + a.pas * w.pas + a.dri * w.dri + a.def * w.def + a.phy * w.phy;
    return clamp(Math.round(raw), 40, 100);
}
export function ovrFromGk(g) {
    const w = GK_WEIGHTS;
    const raw = g.div * w.div + g.han * w.han + g.kic * w.kic + g.ref * w.ref + g.spe * w.spe + g.pos * w.pos;
    return clamp(Math.round(raw), 40, 100);
}
/** GRL que sale de las estadísticas actuales del jugador. */
export function ovrOf(p) {
    if (p.pos === "GK")
        return ovrFromGk(ensureGk(p));
    return ovrFromOutfield(p.pos, p.attrs);
}
export function getStat(p, key) {
    if (p.pos === "GK")
        return ensureGk(p)[key] ?? 40;
    return p.attrs[key] ?? 40;
}
export function setStat(p, key, value) {
    const v = clamp(Math.round(value), 40, 100);
    if (p.pos === "GK") {
        ensureGk(p)[key] = v;
    }
    else {
        p.attrs[key] = v;
    }
}
/** Foto de todas las estadísticas del jugador (para los informes de entrenamiento). */
export function statSnapshot(p) {
    const out = {};
    for (const k of statKeysFor(p.pos))
        out[k] = getStat(p, k);
    return out;
}
/** Genera estadísticas de portero coherentes con su GRL. */
export function gkFor(ovr, rng) {
    const j = () => rng.int(-3, 3);
    const cap = (n) => clamp(Math.round(n), 42, 100);
    const base = ovr;
    const g = {
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
export function ensureGk(p) {
    if (!p.gk) {
        p.gk = alignGk({
            div: clamp(p.ovr + 1, 42, 100),
            han: clamp(p.ovr, 42, 100),
            kic: clamp(p.ovr - 6, 42, 100),
            ref: clamp(p.ovr + 2, 42, 100),
            spe: clamp(p.ovr - 14, 42, 100),
            pos: clamp(p.ovr, 42, 100),
        }, p.ovr);
    }
    return p.gk;
}
/**
 * Mueve las estadísticas para que su GRL calculado sea exactamente `target`.
 * Primero desplaza todas por igual (así un 86 nunca queda con stats de 45) y luego afina de a
 * un punto empezando por las estadísticas que más pesan en esa posición.
 */
function alignGeneric(stats, weights, target, calc) {
    const s = { ...stats };
    const keys = Object.keys(weights).sort((a, b) => weights[b] - weights[a]);
    const first = calc(s) - target;
    if (first !== 0) {
        for (const k of keys)
            s[k] = clamp(s[k] - first, 40, 100);
    }
    for (let i = 0; i < 60; i++) {
        const diff = target - calc(s);
        if (diff === 0)
            break;
        const dir = diff > 0 ? 1 : -1;
        // Rota entre las estadísticas con margen, de mayor a menor peso.
        const candidates = keys.filter((k) => (dir > 0 ? s[k] < 100 : s[k] > 40));
        if (!candidates.length)
            break;
        const k = candidates[i % Math.min(candidates.length, 3)];
        s[k] = clamp(s[k] + dir, 40, 100);
    }
    return s;
}
export function alignOutfield(pos, attrs, target) {
    return alignGeneric(attrs, OUT_WEIGHTS[pos], target, (s) => ovrFromOutfield(pos, s));
}
export function alignGk(g, target) {
    return alignGeneric(g, GK_WEIGHTS, target, (s) => ovrFromGk(s));
}
/**
 * Deja las estadísticas del jugador acordes a su GRL. Se llama cada vez que la media cambia por
 * fuera del entrenamiento (partidos, edad, cesiones...). Si la diferencia es enorme (partidas
 * viejas con un 86 y stats de 45) se reparte de nuevo con el perfil típico de su posición.
 */
export function syncStats(p, rebuild) {
    if (p.pos === "GK") {
        const g = ensureGk(p);
        if (ovrFromGk(g) !== p.ovr)
            p.gk = alignGk(g, p.ovr);
        return;
    }
    const calc = ovrFromOutfield(p.pos, p.attrs);
    if (calc === p.ovr)
        return;
    if (rebuild && Math.abs(calc - p.ovr) > 8) {
        p.attrs = alignOutfield(p.pos, rebuild(p.pos, p.ovr), p.ovr);
        return;
    }
    p.attrs = alignOutfield(p.pos, p.attrs, p.ovr);
}
