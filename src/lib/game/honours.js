export const HONOUR_LABEL = {
    scudetto: "Scudetti",
    coppa: "Coppa Italia",
    supercoppa: "Supercoppa",
    ucl: "Champions",
    uel: "Europa League",
    uecl: "Conference",
    libertadores: "Libertadores",
    sudamericana: "Sudamericana",
    recopa: "Recopa",
    mundial: "Mundial de Clubes",
};
export function honourLabel(kind, league) {
    if (league === "premier") {
        if (kind === "scudetto")
            return "Premier League";
        if (kind === "coppa")
            return "FA Cup";
        if (kind === "supercoppa")
            return "Community Shield";
    }
    if (league === "laliga") {
        if (kind === "scudetto")
            return "La Liga";
        if (kind === "coppa")
            return "Copa del Rey";
        if (kind === "supercoppa")
            return "Supercopa";
    }
    if (league === "bundesliga") {
        if (kind === "scudetto")
            return "Bundesliga";
        if (kind === "coppa")
            return "DFB-Pokal";
        if (kind === "supercoppa")
            return "DFL-Supercup";
    }
    if (league === "ligue1") {
        if (kind === "scudetto")
            return "Ligue 1";
        if (kind === "coppa")
            return "Coupe de France";
        if (kind === "supercoppa")
            return "Trophée des Champions";
    }
    return HONOUR_LABEL[kind];
}
const EMPTY = {
    scudetto: 0,
    coppa: 0,
    supercoppa: 0,
    ucl: 0,
    uel: 0,
    uecl: 0,
    libertadores: 0,
    sudamericana: 0,
    recopa: 0,
    mundial: 0,
};
/** All-time major honours entering 2026/27 (updated Oct 2026). */
export const HISTORICAL = {
    // ── Serie A ──
    juv: { scudetto: 36, coppa: 15, supercoppa: 9, ucl: 2, uel: 3, recopa: 1, mundial: 0 },
    int: { scudetto: 21, coppa: 9, supercoppa: 8, ucl: 3, uel: 3, recopa: 0, mundial: 1 },
    mil: { scudetto: 19, coppa: 5, supercoppa: 8, ucl: 7, uel: 0, recopa: 2, mundial: 1 },
    nap: { scudetto: 4, coppa: 6, supercoppa: 4, ucl: 0, uel: 1, recopa: 0, mundial: 0 },
    rom: { scudetto: 3, coppa: 9, supercoppa: 2, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    laz: { scudetto: 2, coppa: 7, supercoppa: 5, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    fio: { scudetto: 2, coppa: 6, supercoppa: 1, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    gen: { scudetto: 9, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    tor: { scudetto: 7, coppa: 5, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    bol: { scudetto: 7, coppa: 3, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    par: { scudetto: 0, coppa: 3, supercoppa: 1, ucl: 0, uel: 2, recopa: 1, mundial: 0 },
    ata: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 1, recopa: 0, mundial: 0 },
    cag: { scudetto: 1, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ven: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    com: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    udi: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    lec: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    mon: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sas: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    fro: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    // ── Premier League ──
    mun: { scudetto: 20, coppa: 13, supercoppa: 21, ucl: 3, uel: 1, recopa: 1, mundial: 1 },
    liv: { scudetto: 20, coppa: 8, supercoppa: 16, ucl: 6, uel: 3, recopa: 0, mundial: 1 },
    ars: { scudetto: 14, coppa: 14, supercoppa: 17, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    mci: { scudetto: 10, coppa: 7, supercoppa: 7, ucl: 1, uel: 0, recopa: 0, mundial: 1 },
    che: { scudetto: 6, coppa: 8, supercoppa: 4, ucl: 2, uel: 2, recopa: 2, mundial: 1 },
    tot: { scudetto: 2, coppa: 8, supercoppa: 7, ucl: 0, uel: 3, recopa: 1, mundial: 0 },
    new: { scudetto: 4, coppa: 6, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    avl: { scudetto: 7, coppa: 7, supercoppa: 1, ucl: 1, uel: 0, recopa: 0, mundial: 0 },
    eve: { scudetto: 9, coppa: 5, supercoppa: 9, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    nfo: { scudetto: 1, coppa: 2, supercoppa: 1, ucl: 2, uel: 0, recopa: 0, mundial: 0 },
    lee: { scudetto: 3, coppa: 1, supercoppa: 2, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    wol: { scudetto: 3, coppa: 4, supercoppa: 4, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    whu: { scudetto: 0, coppa: 3, supercoppa: 1, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    bha: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    cry: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ful: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    bre: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    bou: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    bur: { scudetto: 2, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sun: { scudetto: 6, coppa: 2, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    cov: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    hul: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ips: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    // ── La Liga ──
    rma: { scudetto: 36, coppa: 20, supercoppa: 13, ucl: 15, uel: 2, recopa: 0, mundial: 5 },
    bar: { scudetto: 29, coppa: 31, supercoppa: 15, ucl: 5, uel: 0, recopa: 4, mundial: 3 },
    atl: { scudetto: 11, coppa: 10, supercoppa: 2, ucl: 0, uel: 3, recopa: 1, mundial: 0 },
    ath: { scudetto: 8, coppa: 24, supercoppa: 3, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    val: { scudetto: 6, coppa: 8, supercoppa: 1, ucl: 0, uel: 1, recopa: 1, mundial: 0 },
    rso: { scudetto: 2, coppa: 3, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sev: { scudetto: 1, coppa: 5, supercoppa: 1, ucl: 0, uel: 7, recopa: 1, mundial: 0 },
    bet: { scudetto: 1, coppa: 3, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    vil: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 1, recopa: 0, mundial: 0 },
    esp: { scudetto: 0, coppa: 4, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    dep: { scudetto: 1, coppa: 0, supercoppa: 3, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ala: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    get: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ray: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    osa: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    cel: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    rac: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    lev: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    elc: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    mlg: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    // ── Bundesliga ──
    bay: { scudetto: 34, coppa: 20, supercoppa: 11, ucl: 6, uel: 1, recopa: 1, mundial: 2 },
    dor: { scudetto: 8, coppa: 5, supercoppa: 6, ucl: 1, uel: 0, recopa: 1, mundial: 0 },
    b04: { scudetto: 1, coppa: 2, supercoppa: 1, ucl: 0, uel: 1, recopa: 0, mundial: 0 },
    rbl: { scudetto: 0, coppa: 2, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    vfb: { scudetto: 5, coppa: 3, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sge: { scudetto: 1, coppa: 5, supercoppa: 0, ucl: 0, uel: 2, recopa: 1, mundial: 0 },
    hsv: { scudetto: 6, coppa: 3, supercoppa: 0, ucl: 1, uel: 0, recopa: 1, mundial: 0 },
    bmg: { scudetto: 5, coppa: 3, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    svw: { scudetto: 4, coppa: 6, supercoppa: 0, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    koe: { scudetto: 3, coppa: 4, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    s04: { scudetto: 7, coppa: 5, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    fcu: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    scf: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    tsg: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    m05: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    fca: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    elv: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    scp: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    // ── Ligue 1 ──
    psg: { scudetto: 12, coppa: 16, supercoppa: 13, ucl: 2, uel: 0, recopa: 1, mundial: 0 },
    om: { scudetto: 9, coppa: 10, supercoppa: 3, ucl: 1, uel: 0, recopa: 0, mundial: 0 },
    asm: { scudetto: 8, coppa: 5, supercoppa: 4, ucl: 0, uel: 0, recopa: 1, mundial: 0 },
    ol: { scudetto: 7, coppa: 5, supercoppa: 8, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    lil: { scudetto: 4, coppa: 6, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    nic: { scudetto: 4, coppa: 3, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    fcn: { scudetto: 8, coppa: 4, supercoppa: 3, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sre: { scudetto: 0, coppa: 3, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    rcl: { scudetto: 1, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    rcs: { scudetto: 1, coppa: 3, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    aux: { scudetto: 1, coppa: 4, supercoppa: 2, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    met: { scudetto: 0, coppa: 2, supercoppa: 1, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    tfc: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    lor: { scudetto: 0, coppa: 1, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    sbr: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    pfc: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    hac: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    ang: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    tro: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    lmn: { scudetto: 0, coppa: 0, supercoppa: 0, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
    // ── Europe / otros ──
    bru: { scudetto: 19, coppa: 12, supercoppa: 17, ucl: 0, uel: 0, recopa: 0, mundial: 0 },
};
export function historicalFor(clubId) {
    return { ...EMPTY, ...(HISTORICAL[clubId] ?? {}) };
}
export function honourKinds() {
    return [
        "scudetto",
        "coppa",
        "supercoppa",
        "ucl",
        "uel",
        "uecl",
        "libertadores",
        "sudamericana",
        "recopa",
        "mundial",
    ];
}
function extraCups(year, season) {
    return {
        ucl: `Champions ${year}`,
        uel: `Europa League ${year}`,
        uecl: `Conference ${year}`,
        libertadores: `Libertadores ${year}`,
        sudamericana: `Sudamericana ${year}`,
        recopa: `Recopa ${season}`,
        mundial: `Mundial de Clubes ${season}`,
    };
}
export function trophyLabel(kind, season, league) {
    const year = `${season}/${String(season + 1).slice(2)}`;
    const extra = extraCups(year, season);
    if (league === "premier") {
        const map = {
            scudetto: `Premier League ${year}`,
            coppa: `FA Cup ${year}`,
            supercoppa: `Community Shield ${season}`,
            ...extra,
        };
        return map[kind];
    }
    if (league === "laliga") {
        const map = {
            scudetto: `La Liga ${year}`,
            coppa: `Copa del Rey ${year}`,
            supercoppa: `Supercopa ${season}`,
            ...extra,
        };
        return map[kind];
    }
    if (league === "bundesliga") {
        const map = {
            scudetto: `Bundesliga ${year}`,
            coppa: `DFB-Pokal ${year}`,
            supercoppa: `DFL-Supercup ${season}`,
            ...extra,
        };
        return map[kind];
    }
    if (league === "ligue1") {
        const map = {
            scudetto: `Ligue 1 ${year}`,
            coppa: `Coupe de France ${year}`,
            supercoppa: `Trophée des Champions ${season}`,
            ...extra,
        };
        return map[kind];
    }
    const map = {
        scudetto: `Scudetto ${year}`,
        coppa: `Coppa Italia ${year}`,
        supercoppa: `Supercoppa ${season}`,
        ...extra,
    };
    return map[kind];
}
