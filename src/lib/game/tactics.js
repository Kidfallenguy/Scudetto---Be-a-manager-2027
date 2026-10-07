export const FORMATIONS = {
    "433": {
        name: "4-3-3",
        slots: [
            { x: 50, y: 90, pos: ["GK"], label: "PO" },
            { x: 16, y: 70, pos: ["LB"], label: "LI" },
            { x: 37, y: 73, pos: ["CB"], label: "DFC" },
            { x: 63, y: 73, pos: ["CB"], label: "DFC" },
            { x: 84, y: 70, pos: ["RB"], label: "LD" },
            { x: 28, y: 48, pos: ["CM", "CDM", "CAM"], label: "MC" },
            { x: 50, y: 52, pos: ["CM", "CDM", "CAM"], label: "MC" },
            { x: 72, y: 48, pos: ["CM", "CDM", "CAM"], label: "MC" },
            { x: 16, y: 22, pos: ["LW", "RW", "ST", "CAM"], label: "EI" },
            { x: 50, y: 18, pos: ["ST", "CAM"], label: "DC" },
            { x: 84, y: 22, pos: ["RW", "LW", "ST", "CAM"], label: "ED" },
        ],
    },
    "4231": {
        name: "4-2-3-1",
        slots: [
            { x: 50, y: 90, pos: ["GK"], label: "PO" },
            { x: 16, y: 70, pos: ["LB"], label: "LI" },
            { x: 37, y: 73, pos: ["CB"], label: "DFC" },
            { x: 63, y: 73, pos: ["CB"], label: "DFC" },
            { x: 84, y: 70, pos: ["RB"], label: "LD" },
            { x: 34, y: 56, pos: ["CDM", "CM"], label: "MCD" },
            { x: 66, y: 56, pos: ["CDM", "CM"], label: "MCD" },
            { x: 16, y: 32, pos: ["LW", "CAM"], label: "EI" },
            { x: 50, y: 34, pos: ["CAM", "CM"], label: "MCO" },
            { x: 84, y: 32, pos: ["RW", "CAM"], label: "ED" },
            { x: 50, y: 18, pos: ["ST"], label: "DC" },
        ],
    },
    "442": {
        name: "4-4-2",
        slots: [
            { x: 50, y: 90, pos: ["GK"], label: "PO" },
            { x: 16, y: 70, pos: ["LB"], label: "LI" },
            { x: 37, y: 73, pos: ["CB"], label: "DFC" },
            { x: 63, y: 73, pos: ["CB"], label: "DFC" },
            { x: 84, y: 70, pos: ["RB"], label: "LD" },
            { x: 16, y: 42, pos: ["LW", "CM"], label: "EI" },
            { x: 37, y: 48, pos: ["CM", "CDM"], label: "MC" },
            { x: 63, y: 48, pos: ["CM", "CDM"], label: "MC" },
            { x: 84, y: 42, pos: ["RW", "CM"], label: "ED" },
            { x: 38, y: 18, pos: ["ST", "CAM"], label: "DC" },
            { x: 62, y: 18, pos: ["ST", "CAM"], label: "DC" },
        ],
    },
    "352": {
        name: "3-5-2",
        slots: [
            { x: 50, y: 90, pos: ["GK"], label: "PO" },
            { x: 24, y: 72, pos: ["CB"], label: "DFC" },
            { x: 50, y: 74, pos: ["CB"], label: "DFC" },
            { x: 76, y: 72, pos: ["CB"], label: "DFC" },
            { x: 12, y: 46, pos: ["LB", "LW", "CM"], label: "CAI" },
            { x: 34, y: 50, pos: ["CM", "CDM"], label: "MC" },
            { x: 50, y: 54, pos: ["CDM", "CM"], label: "MCD" },
            { x: 66, y: 50, pos: ["CM", "CAM"], label: "MC" },
            { x: 88, y: 46, pos: ["RB", "RW", "CM"], label: "CAD" },
            { x: 38, y: 18, pos: ["ST", "CAM"], label: "DC" },
            { x: 62, y: 18, pos: ["ST", "LW", "RW"], label: "DC" },
        ],
    },
    "343": {
        name: "3-4-3",
        slots: [
            { x: 50, y: 90, pos: ["GK"], label: "PO" },
            { x: 24, y: 72, pos: ["CB"], label: "DFC" },
            { x: 50, y: 74, pos: ["CB"], label: "DFC" },
            { x: 76, y: 72, pos: ["CB"], label: "DFC" },
            { x: 14, y: 46, pos: ["LB", "LW"], label: "CAI" },
            { x: 38, y: 50, pos: ["CM", "CDM"], label: "MC" },
            { x: 62, y: 50, pos: ["CM", "CAM"], label: "MC" },
            { x: 86, y: 46, pos: ["RB", "RW"], label: "CAD" },
            { x: 18, y: 22, pos: ["LW", "ST"], label: "EI" },
            { x: 50, y: 18, pos: ["ST"], label: "DC" },
            { x: 82, y: 22, pos: ["RW", "ST"], label: "ED" },
        ],
    },
};
export const FORMATION_IDS = Object.keys(FORMATIONS);
export const MENTALITY_LABEL = {
    defensive: "Defensivo",
    balanced: "Equilibrado",
    attacking: "Ofensivo",
};
const GROUP = {
    GK: "GK",
    CB: "DEF",
    LB: "DEF",
    RB: "DEF",
    CDM: "MID",
    CM: "MID",
    CAM: "MID",
    LW: "FWD",
    RW: "FWD",
    ST: "FWD",
};
/** How well a player fits a slot. Exact native position wins by a mile. */
export function slotFit(playerPos, allowed) {
    if (allowed.includes(playerPos))
        return 100;
    if (playerPos === "GK" || allowed.includes("GK"))
        return -1000;
    const pG = GROUP[playerPos];
    const slotGroups = new Set(allowed.map((p) => GROUP[p]));
    const near = (playerPos === "LB" && allowed.includes("RB")) ||
        (playerPos === "RB" && allowed.includes("LB")) ||
        (playerPos === "CB" && (allowed.includes("LB") || allowed.includes("RB"))) ||
        (playerPos === "LB" && allowed.includes("CB")) ||
        (playerPos === "RB" && allowed.includes("CB")) ||
        (playerPos === "CM" && (allowed.includes("CDM") || allowed.includes("CAM"))) ||
        (playerPos === "CDM" && allowed.includes("CM")) ||
        (playerPos === "CAM" && allowed.includes("CM")) ||
        (playerPos === "LW" && (allowed.includes("RW") || allowed.includes("CAM"))) ||
        (playerPos === "RW" && (allowed.includes("LW") || allowed.includes("CAM"))) ||
        (playerPos === "ST" && (allowed.includes("CAM") || allowed.includes("LW") || allowed.includes("RW"))) ||
        (playerPos === "CAM" && (allowed.includes("LW") || allowed.includes("RW") || allowed.includes("ST"))) ||
        (playerPos === "LW" && allowed.includes("ST")) ||
        (playerPos === "RW" && allowed.includes("ST"));
    if (near)
        return 28;
    if (pG === "FWD" && slotGroups.has("DEF"))
        return -90;
    if (pG === "DEF" && slotGroups.has("FWD"))
        return -90;
    if (pG === "MID" && slotGroups.has("DEF"))
        return -18;
    if (pG === "MID" && slotGroups.has("FWD"))
        return -12;
    if (pG === "FWD" && slotGroups.has("MID"))
        return -22;
    if (pG === "DEF" && slotGroups.has("MID"))
        return -25;
    return -55;
}
/** Regla dura del once: solo se puede poner a un jugador en una posición que juega. */
export function canPlaySlot(playerPos, allowed) {
    return allowed.includes(playerPos);
}
export function isNaturalSlot(playerPos, allowed) {
    return slotFit(playerPos, allowed) >= 100;
}
function slotScore(player, allowed) {
    const fit = slotFit(player.pos, allowed);
    const gkPenalty = player.pos === "GK" && !allowed.includes("GK") ? -200 : 0;
    const fieldPenalty = allowed.includes("GK") && player.pos !== "GK" ? -200 : 0;
    return (player.ovr +
        player.form * 0.5 +
        player.fitness / 25 +
        fit +
        gkPenalty +
        fieldPenalty -
        (player.injured > 0 ? 40 : 0) -
        (player.suspended > 0 ? 50 : 0));
}
function fillPass(slots, available, used, ids, minFit) {
    for (let i = 0; i < slots.length; i++) {
        if (ids[i])
            continue;
        const slot = slots[i];
        let best = null;
        let bestScore = -Infinity;
        for (const p of available) {
            if (used.has(p.id))
                continue;
            const fit = slotFit(p.pos, slot.pos);
            if (fit < minFit)
                continue;
            const s = slotScore(p, slot.pos);
            if (s > bestScore) {
                bestScore = s;
                best = p;
            }
        }
        if (best) {
            used.add(best.id);
            ids[i] = best.id;
        }
    }
}
export function isUnavailable(p) {
    return p.injured > 0 || p.suspended > 0;
}
export function unavailableReason(p) {
    if (p.injured > 0)
        return "injury";
    if (p.suspended > 0)
        return "suspension";
    return null;
}
export function pickXi(squad, formation) {
    const slots = FORMATIONS[formation].slots;
    const available = squad.filter((p) => p.injured <= 0 && p.suspended <= 0 && p.fitness >= 45);
    const used = new Set();
    const ids = slots.map(() => null);
    fillPass(slots, available, used, ids, 100);
    fillPass(slots, available, used, ids, 20);
    fillPass(slots, available, used, ids, -30);
    fillPass(slots, available, used, ids, -200);
    return ids.filter((id) => Boolean(id));
}
/** Keep the rest of the XI; fill the sold starter's slot with the best player from the bench. */
export function dropFromLineup(lineup, formation, droppedId, squad) {
    const remaining = squad.filter((p) => p.id !== droppedId);
    const idx = lineup.indexOf(droppedId);
    if (idx < 0) {
        const keep = lineup.filter((id) => remaining.some((p) => p.id === id));
        return keep.length === FORMATIONS[formation].slots.length ? keep : pickXi(remaining, formation);
    }
    const slot = FORMATIONS[formation].slots[idx];
    const used = new Set(lineup.filter((id) => id !== droppedId));
    let best = null;
    let bestScore = -Infinity;
    for (const p of remaining) {
        if (used.has(p.id) || p.injured > 0 || p.suspended > 0 || p.fitness < 45)
            continue;
        const s = slotScore(p, slot?.pos ?? ["CM"]);
        if (s > bestScore) {
            bestScore = s;
            best = p;
        }
    }
    if (!best)
        return pickXi(remaining, formation);
    const next = [...lineup];
    next[idx] = best.id;
    return next;
}
export function xiRating(players, lineup) {
    const xi = lineup
        .map((id) => players.find((p) => p.id === id))
        .filter((p) => Boolean(p));
    if (xi.length === 0)
        return 60;
    return xi.reduce((s, p) => s + p.ovr + p.form * 0.6 + (p.fitness - 80) * 0.08, 0) / xi.length;
}
export function axisRatings(players, lineup) {
    const xi = lineup
        .map((id) => players.find((p) => p.id === id))
        .filter((p) => Boolean(p));
    const gk = xi.filter((p) => p.pos === "GK");
    const def = xi.filter((p) => p.pos === "CB" || p.pos === "LB" || p.pos === "RB" || p.pos === "CDM");
    const mid = xi.filter((p) => p.pos === "CM" || p.pos === "CAM" || p.pos === "CDM");
    const att = xi.filter((p) => p.pos === "ST" || p.pos === "LW" || p.pos === "RW" || p.pos === "CAM");
    const avg = (list, key) => {
        if (!list.length)
            return 68;
        return list.reduce((s, p) => s + (key === "ovr" ? p.ovr : p.attrs[key]), 0) / list.length;
    };
    return {
        attack: avg(att, "sho") * 0.55 + avg(att, "pac") * 0.25 + avg(att, "dri") * 0.2,
        midfield: avg(mid, "pas") * 0.6 + avg(mid, "dri") * 0.2 + avg(mid, "ovr") * 0.2,
        defense: avg(def, "def") * 0.6 + avg(def, "phy") * 0.25 + avg(gk, "ovr") * 0.15,
        gk: avg(gk, "ovr"),
    };
}
