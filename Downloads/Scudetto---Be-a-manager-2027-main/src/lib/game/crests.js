const SVG_IDS = new Set([
    "juv",
    "bay",
    "dor",
    "ath",
    "vil",
    "rso",
    "bet",
    "val",
    "sev",
    "gir",
    "osa",
    "cel",
    "ray",
    "mll",
    "get",
    "esp",
    "ala",
    "elc",
    "lev",
    "ovi",
]);
export function crestUrl(clubId) {
    const ext = SVG_IDS.has(clubId) ? "svg" : "png";
    return `/crests/${clubId}.${ext}`;
}
