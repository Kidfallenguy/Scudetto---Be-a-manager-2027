export const PLAYABLE_LEAGUES = [
    "serieA",
    "premier",
    "laliga",
    "bundesliga",
    "ligue1",
];
export const CONTINENTAL = [
    "ucl",
    "uel",
    "uecl",
    "libertadores",
    "sudamericana",
];
export const COMP_THEME = {
    serieA: { bg: "#12141a", accent: "#c81c2e", fg: "#efe8dc", label: "Serie A", short: "Serie A" },
    premier: { bg: "#12141a", accent: "#3d0a4a", fg: "#efe8dc", label: "Premier League", short: "Premier" },
    laliga: { bg: "#12141a", accent: "#c81c2e", fg: "#efe8dc", label: "La Liga", short: "La Liga" },
    bundesliga: { bg: "#12141a", accent: "#d0021b", fg: "#efe8dc", label: "Bundesliga", short: "Bundesliga" },
    ligue1: { bg: "#12141a", accent: "#091c3e", fg: "#efe8dc", label: "Ligue 1", short: "Ligue 1" },
    coppa: { bg: "#16120e", accent: "#c9a227", fg: "#efe8dc", label: "Copa nacional", short: "Copa" },
    ucl: { bg: "#071028", accent: "#2f6bff", fg: "#e8eefc", label: "UEFA Champions League", short: "Champions" },
    uel: { bg: "#241208", accent: "#e07020", fg: "#fbeee0", label: "UEFA Europa League", short: "Europa" },
    uecl: { bg: "#0a2418", accent: "#2d9a55", fg: "#e4f5ea", label: "UEFA Conference League", short: "Conference" },
    libertadores: { bg: "#2a0a12", accent: "#b71c34", fg: "#f8e8ea", label: "Copa Libertadores", short: "Libertadores" },
    sudamericana: { bg: "#0a2833", accent: "#4eb8d9", fg: "#e6f6fb", label: "Copa Sudamericana", short: "Sudamericana" },
    supercoppa: { bg: "#16120e", accent: "#c9a227", fg: "#efe8dc", label: "Supercopa", short: "Supercopa" },
    mundial: { bg: "#140e08", accent: "#d4a017", fg: "#f7efd8", label: "Mundial de Clubes", short: "Mundial" },
};
export const QUAL_SPOTS = {
    serieA: { ucl: 4, uel: 2, uecl: 1, releg: 3 },
    premier: { ucl: 4, uel: 2, uecl: 1, releg: 3 },
    laliga: { ucl: 4, uel: 2, uecl: 1, releg: 3 },
    bundesliga: { ucl: 4, uel: 2, uecl: 1, releg: 3 },
    ligue1: { ucl: 3, uel: 2, uecl: 1, releg: 3 },
};
export function qualBandForPlace(league, place, nTeams) {
    const spots = QUAL_SPOTS[league];
    if (place <= spots.ucl)
        return "ucl";
    if (place <= spots.ucl + spots.uel)
        return "uel";
    if (place <= spots.ucl + spots.uel + spots.uecl)
        return "uecl";
    if (place > nTeams - spots.releg)
        return "releg";
    return "mid";
}
export const QUAL_COLOR = {
    ucl: "var(--color-comp-ucl)",
    uel: "var(--color-comp-uel)",
    uecl: "var(--color-comp-uecl)",
    releg: "var(--color-bad)",
    mid: "transparent",
};
export const QUAL_LABEL = {
    ucl: "Champions",
    uel: "Europa League",
    uecl: "Conference",
    releg: "Descenso",
    mid: "",
};
export function isContinental(comp) {
    return CONTINENTAL.includes(comp);
}
export function isTwoLeggedStage(comp, round) {
    if (!isContinental(comp))
        return false;
    if (comp === "ucl" || comp === "libertadores")
        return round >= 7 && round <= 9;
    if (comp === "uel" || comp === "uecl" || comp === "sudamericana")
        return round >= 1 && round <= 3;
    return false;
}
export function knockoutRoundLabel(comp, round, leg) {
    const stage = (() => {
        if (comp === "ucl" || comp === "libertadores") {
            if (round <= 6)
                return `Fase de grupos · J${round}`;
            if (round === 7)
                return "Octavos";
            if (round === 8)
                return "Cuartos";
            if (round === 9)
                return "Semifinales";
            if (round === 10)
                return "Final";
        }
        if (comp === "uel" || comp === "uecl" || comp === "sudamericana") {
            if (round === 1)
                return "Octavos";
            if (round === 2)
                return "Cuartos";
            if (round === 3)
                return "Semifinales";
            if (round === 4)
                return "Final";
        }
        return `Ronda ${round}`;
    })();
    const legTxt = leg === 1 ? " · Ida" : leg === 2 ? " · Vuelta" : "";
    return `${COMP_THEME[comp].short} · ${stage}${legTxt}`;
}
export function continentalHome(comp) {
    return comp === "libertadores" || comp === "sudamericana" ? "conmebol" : "europe";
}
export function finalRoundOf(comp) {
    if (comp === "ucl" || comp === "libertadores")
        return 10;
    if (comp === "uel" || comp === "uecl" || comp === "sudamericana")
        return 4;
    if (comp === "coppa")
        return 4;
    if (comp === "supercoppa" || comp === "mundial")
        return 1;
    return null;
}
/** Fondo de pantalla completa teñido con el color de la competición (azul Champions, naranja Europa, verde Conference…). */
export function compBackdropStyle(comp) {
    if (!comp)
        return {};
    const t = COMP_THEME[comp];
    return {
        background: `radial-gradient(ellipse 90% 45% at 50% 0%, color-mix(in oklab, ${t.accent} 38%, transparent), transparent 70%), linear-gradient(180deg, color-mix(in oklab, ${t.accent} 14%, ${t.bg}) 0%, ${t.bg} 60%)`,
        "--club": t.accent,
    };
}
/** Panel más pequeño (por ejemplo la pestaña de una copa dentro de Tablas). */
export function compPanelStyle(comp) {
    if (!comp)
        return {};
    const t = COMP_THEME[comp];
    return {
        background: `linear-gradient(180deg, color-mix(in oklab, ${t.accent} 22%, ${t.bg}) 0%, ${t.bg} 100%)`,
        boxShadow: `0 0 0 1px color-mix(in oklab, ${t.accent} 45%, transparent)`,
    };
}
