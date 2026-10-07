import { crestUrl } from "./crests";
import { GHOST_CLUBS } from "./fictional";
function premierClub(row) {
    const [id, name, short, city, stadium, capacity, color, color2, prestige] = row;
    return {
        id,
        name,
        short,
        city,
        stadium,
        capacity,
        color,
        color2,
        league: "premier",
        prestige,
        crest: crestUrl(id),
    };
}
/** 2026/27 Premier League Clubs (Big Four plus the rest of the teams). */
const PREMIER_EXTRA = [
    ["mun", "Manchester United", "MUN", "Mánchester", "Old Trafford", 74310, "#da291c", "#111111", 86],
    ["tot", "Tottenham", "TOT", "Londres", "Tottenham Hotspur Stadium", 62850, "#ffffff", "#132257", 85],
    ["new", "Newcastle", "NEW", "Newcastle", "St James' Park", 52258, "#241f20", "#ffffff", 84],
    ["avl", "Aston Villa", "AVL", "Birmingham", "Villa Park", 42640, "#670e36", "#95bfe5", 83],
    ["bha", "Brighton", "BHA", "Brighton", "American Express Stadium", 31876, "#0057b8", "#ffffff", 79],
    ["nfo", "Nottingham Forest", "NFO", "Nottingham", "City Ground", 30445, "#dd0000", "#ffffff", 78],
    ["cry", "Crystal Palace", "CRY", "Londres", "Selhurst Park", 25486, "#1b458f", "#c4122e", 77],
    ["ful", "Fulham", "FUL", "Londres", "Craven Cottage", 24500, "#ffffff", "#000000", 76],
    ["whu", "West Ham", "WHU", "Londres", "London Stadium", 62500, "#7a263a", "#1bb1e7", 76],
    ["bre", "Brentford", "BRE", "Londres", "Gtech Community Stadium", 17250, "#e30613", "#ffffff", 75],
    ["eve", "Everton", "EVE", "Liverpool", "Hill Dickinson Stadium", 52769, "#003399", "#ffffff", 74],
    ["wol", "Wolverhampton", "WOL", "Wolverhampton", "Molineux", 31750, "#fdb913", "#111111", 73],
    ["bou", "Bournemouth", "BOU", "Bournemouth", "Vitality Stadium", 11307, "#da291c", "#111111", 73],
    ["lee", "Leeds United", "LEE", "Leeds", "Elland Road", 37608, "#ffffff", "#ffcd00", 72],
    ["bur", "Burnley", "BUR", "Burnley", "Turf Moor", 21944, "#6c1d45", "#99d6ea", 70],
    ["sun", "Sunderland", "SUN", "Sunderland", "Stadium of Light", 49000, "#eb172b", "#ffffff", 69],
    ["cov", "Coventry City", "COV", "Coventry", "Coventry Building Society Arena", 32609, "#002b49", "#ffffff", 68],
    ["hul", "Hull City", "HUL", "Hull", "MKM Stadium", 25586, "#f5a11d", "#000000", 68],
    ["ips", "Ipswich Town", "IPS", "Ipswich", "Portman Road", 29673, "#0000ff", "#ff0000", 68],
].map(premierClub);
function ligaClub(row) {
    const [id, name, short, city, stadium, capacity, color, color2, prestige] = row;
    return {
        id,
        name,
        short,
        city,
        stadium,
        capacity,
        color,
        color2,
        league: "laliga",
        prestige,
        crest: crestUrl(id),
    };
}
/** 2025/26 La Liga — 17 clubs besides Real Madrid, Barcelona and Atlético. */
const LALIGA_EXTRA = [
    ["bet", "Real Betis", "BET", "Sevilla", "Benito Villamarín", 60721, "#00954c", "#ffffff", 80],
    ["sev", "Sevilla", "SEV", "Sevilla", "Ramón Sánchez-Pizjuán", 43883, "#d70f1f", "#ffffff", 79],
    ["ala", "Alavés", "ALA", "Vitoria", "Mendizorroza", 19840, "#004fa3", "#ffffff", 70],
    ["dep", "Deportivo", "DEP", "A Coruña", "Riazor", 32490, "#0055a4", "#ffffff", 71],
    ["rso", "Real Sociedad", "RSO", "San Sebastián", "Reale Arena", 39313, "#0067b1", "#ffffff", 81],
    ["vil", "Villarreal", "VIL", "Villarreal", "Estadio de la Cerámica", 23000, "#fbee00", "#00539b", 82],
    ["ath", "Athletic", "ATH", "Bilbao", "San Mamés", 53289, "#ee2523", "#ffffff", 84],
    ["get", "Getafe", "GET", "Getafe", "Coliseum", 17393, "#004fa3", "#ffffff", 72],
    ["ray", "Rayo Vallecano", "RAY", "Madrid", "Vallecas", 14708, "#e20613", "#ffffff", 74],
    ["osa", "Osasuna", "OSA", "Pamplona", "El Sadar", 23576, "#d91a2a", "#0a3161", 75],
    ["cel", "Celta de Vigo", "CEL", "Vigo", "Balaídos", 29000, "#8ccce8", "#ffffff", 76],
    ["esp", "RCD Espanyol", "ESP", "Barcelona", "Stage Front Stadium", 40000, "#0072ce", "#ffffff", 72],
    ["rac", "Racing de Santander", "RAC", "Santander", "El Sardinero", 22308, "#006633", "#ffffff", 67],
    ["lev", "Levante", "LEV", "Valencia", "Ciutat de València", 26354, "#b1050f", "#0055a4", 68],
    ["elc", "Elche C. F.", "ELC", "Elche", "Martínez Valero", 31388, "#006333", "#ffffff", 69],
    ["val", "Valencia C. F.", "VAL", "Valencia", "Mestalla", 49430, "#ee3524", "#000000", 78],
    ["mlg", "Málaga", "MLG", "Málaga", "La Rosaleda", 30044, "#00a0e3", "#ffffff", 66],
].map(ligaClub);
function bundesClub(row) {
    const [id, name, short, city, stadium, capacity, color, color2, prestige] = row;
    return {
        id,
        name,
        short,
        city,
        stadium,
        capacity,
        color,
        color2,
        league: "bundesliga",
        prestige,
        crest: crestUrl(id),
    };
}
/** 2026/27 Bundesliga — 15 clubs besides Bayern, Dortmund and Leipzig. */
const BUNDESLIGA_EXTRA = [
    ["b04", "Bayer Leverkusen", "B04", "Leverkusen", "BayArena", 30210, "#e32221", "#111111", 87],
    ["vfb", "VfB Stuttgart", "VFB", "Stuttgart", "MHPArena", 60449, "#ffffff", "#e32219", 82],
    ["sge", "Eintracht Frankfurt", "SGE", "Fráncfort", "Deutsche Bank Park", 58000, "#e1000f", "#111111", 81],
    ["bmg", "Borussia Mönchengladbach", "BMG", "Mönchengladbach", "Borussia-Park", 54057, "#111111", "#ffffff", 79],
    ["scf", "SC Freiburg", "SCF", "Friburgo", "Europa-Park Stadion", 34700, "#111111", "#e30613", 78],
    ["svw", "Werder Bremen", "SVW", "Bremen", "Weserstadion", 42100, "#1d9053", "#ffffff", 76],
    ["tsg", "TSG Hoffenheim", "TSG", "Sinsheim", "PreZero Arena", 30150, "#1c63b7", "#ffffff", 75],
    ["m05", "Mainz 05", "M05", "Maguncia", "Mewa Arena", 33305, "#c3141e", "#ffffff", 74],
    ["fcu", "Union Berlin", "FCU", "Berlín", "An der Alten Försterei", 22012, "#eb1923", "#ffd200", 74],
    ["koe", "1. FC Köln", "KOE", "Colonia", "RheinEnergieStadion", 50000, "#ed1c24", "#ffffff", 73],
    ["hsv", "Hamburger SV", "HSV", "Hamburgo", "Volksparkstadion", 57000, "#005ca9", "#020000", 73],
    ["fca", "FC Augsburg", "FCA", "Augsburgo", "WWK Arena", 30660, "#ba3733", "#1e5aa8", 71],
    ["s04", "Schalke 04", "S04", "Gelsenkirchen", "Veltins-Arena", 62271, "#004d9d", "#ffffff", 72],
    ["elv", "SV Elversberg", "ELV", "Elversberg", "Ursapharm-Arena", 10000, "#111111", "#ffffff", 68],
    ["scp", "SC Paderborn", "SCP", "Paderborn", "Home Deluxe Arena", 15000, "#4c8bff", "#ffffff", 67],
].map(bundesClub);
function ligueClub(row) {
    const [id, name, short, city, stadium, capacity, color, color2, prestige] = row;
    return {
        id,
        name,
        short,
        city,
        stadium,
        capacity,
        color,
        color2,
        league: "ligue1",
        prestige,
        crest: crestUrl(id),
    };
}
/** 2026/27 Ligue 1 — 19 clubs besides Paris Saint-Germain. */
const LIGUE1_EXTRA = [
    ["om", "Olympique de Marseille", "OM", "Marsella", "Orange Vélodrome", 67394, "#2fa8e0", "#ffffff", 84],
    ["asm", "AS Monaco", "ASM", "Mónaco", "Stade Louis-II", 18523, "#e30613", "#ffffff", 86],
    ["ol", "Olympique de Lyon", "OL", "Lyon", "Groupama Stadium", 59186, "#003da5", "#ffffff", 82],
    ["lil", "Lille OSC", "LIL", "Lille", "Pierre-Mauroy", 50186, "#e01a22", "#ffffff", 81],
    ["nic", "OGC Nice", "NIC", "Niza", "Allianz Riviera", 35624, "#d0001f", "#000000", 80],
    ["rcl", "Racing Club de Lens", "RCL", "Lens", "Bollaert-Delelis", 38223, "#d4a017", "#d41c1c", 79],
    ["rcs", "RC Strasbourg", "RCS", "Estrasburgo", "La Meinau", 26109, "#009fe3", "#ffffff", 77],
    ["sre", "Stade Rennais", "REN", "Rennes", "Roazhon Park", 29778, "#c8102e", "#000000", 76],
    ["sbr", "Stade Brestois 29", "SBR", "Brest", "Francis-Le Blé", 15931, "#e30613", "#ffffff", 74],
    ["tfc", "Toulouse FC", "TFC", "Toulouse", "Stadium de Toulouse", 33150, "#4a1c6b", "#ffffff", 73],
    ["fcn", "FC Nantes", "FCN", "Nantes", "La Beaujoire", 35322, "#ffed00", "#007a3d", 72],
    ["pfc", "Paris FC", "PFC", "París", "Stade Jean-Bouin", 20000, "#1a3a8c", "#ffffff", 70],
    ["aux", "AJ Auxerre", "AUX", "Auxerre", "Abbé-Deschamps", 18541, "#1a3a8a", "#ffffff", 69],
    ["hac", "Le Havre AC", "HAC", "Le Havre", "Stade Océane", 25178, "#1a4d8c", "#82c0e8", 68],
    ["ang", "Angers SCO", "ANG", "Angers", "Raymond-Kopa", 19351, "#ffffff", "#000000", 67],
    ["lor", "FC Lorient", "FCL", "Lorient", "Stade du Moustoir", 18890, "#f26522", "#000000", 67],
    ["met", "FC Metz", "FCM", "Metz", "Saint-Symphorien", 25636, "#6c1d45", "#ffffff", 66],
    ["tro", "ESTAC Troyes", "EST", "Troyes", "Stade de l'Aube", 20400, "#1e5aa8", "#ffffff", 65],
    ["lmn", "Le Mans FC", "LMN", "Le Mans", "MMArena", 25064, "#c8102e", "#ffd200", 64],
].map(ligueClub);
const REAL_CLUBS = [
    {
        id: "mil",
        name: "AC Milan",
        short: "MIL",
        city: "Milán",
        stadium: "San Siro",
        capacity: 75817,
        color: "#c8102e",
        color2: "#1a1a1a",
        league: "serieA",
        prestige: 86,
        featured: true,
        crest: crestUrl("mil"),
    },
    {
        id: "int",
        name: "Inter",
        short: "INT",
        city: "Milán",
        stadium: "San Siro",
        capacity: 75817,
        color: "#0033a0",
        color2: "#1a1a1a",
        league: "serieA",
        prestige: 91,
        crest: crestUrl("int"),
    },
    {
        id: "juv",
        name: "Juventus",
        short: "JUV",
        city: "Turín",
        stadium: "Allianz Stadium",
        capacity: 41507,
        color: "#ffffff",
        color2: "#111111",
        league: "serieA",
        prestige: 85,
        crest: crestUrl("juv"),
    },
    {
        id: "nap",
        name: "Napoli",
        short: "NAP",
        city: "Nápoles",
        stadium: "Diego Armando Maradona",
        capacity: 54726,
        color: "#0094de",
        color2: "#ffffff",
        league: "serieA",
        prestige: 87,
        crest: crestUrl("nap"),
    },
    {
        id: "rom",
        name: "Roma",
        short: "ROM",
        city: "Roma",
        stadium: "Olimpico",
        capacity: 70634,
        color: "#8b1e1e",
        color2: "#c9a227",
        league: "serieA",
        prestige: 85,
        crest: crestUrl("rom"),
    },
    {
        id: "com",
        name: "Como",
        short: "COM",
        city: "Como",
        stadium: "Giuseppe Sinigaglia",
        capacity: 13602,
        color: "#1d4e89",
        color2: "#ffffff",
        league: "serieA",
        prestige: 82,
        crest: crestUrl("com"),
    },
    {
        id: "ata",
        name: "Atalanta",
        short: "ATA",
        city: "Bérgamo",
        stadium: "Gewiss Stadium",
        capacity: 24950,
        color: "#1e3a8a",
        color2: "#000000",
        league: "serieA",
        prestige: 83,
        crest: crestUrl("ata"),
    },
    {
        id: "laz",
        name: "Lazio",
        short: "LAZ",
        city: "Roma",
        stadium: "Olimpico",
        capacity: 70634,
        color: "#87ceeb",
        color2: "#ffffff",
        league: "serieA",
        prestige: 80,
        crest: crestUrl("laz"),
    },
    {
        id: "fio",
        name: "Fiorentina",
        short: "FIO",
        city: "Florencia",
        stadium: "Artemio Franchi",
        capacity: 43147,
        color: "#4824a3",
        color2: "#ffffff",
        league: "serieA",
        prestige: 77,
        crest: crestUrl("fio"),
    },
    {
        id: "bol",
        name: "Bologna",
        short: "BOL",
        city: "Bolonia",
        stadium: "Renato Dall'Ara",
        capacity: 36462,
        color: "#8b1a1a",
        color2: "#1a1a1a",
        league: "serieA",
        prestige: 77,
        crest: crestUrl("bol"),
    },
    {
        id: "tor",
        name: "Torino",
        short: "TOR",
        city: "Turín",
        stadium: "Olimpico Grande Torino",
        capacity: 27958,
        color: "#8b1a1a",
        color2: "#ffffff",
        league: "serieA",
        prestige: 74,
        crest: crestUrl("tor"),
    },
    {
        id: "gen",
        name: "Genoa",
        short: "GEN",
        city: "Génova",
        stadium: "Luigi Ferraris",
        capacity: 36320,
        color: "#8b1a1a",
        color2: "#1e3a8a",
        league: "serieA",
        prestige: 72,
        crest: crestUrl("gen"),
    },
    {
        id: "udi",
        name: "Udinese",
        short: "UDI",
        city: "Udine",
        stadium: "Bluenergy Stadium",
        capacity: 25132,
        color: "#000000",
        color2: "#ffffff",
        league: "serieA",
        prestige: 71,
        crest: crestUrl("udi"),
    },
    {
        id: "cag",
        name: "Cagliari",
        short: "CAG",
        city: "Cagliari",
        stadium: "Unipol Domus",
        capacity: 16416,
        color: "#c8102e",
        color2: "#1e3a8a",
        league: "serieA",
        prestige: 70,
        crest: crestUrl("cag"),
    },
    {
        id: "par",
        name: "Parma",
        short: "PAR",
        city: "Parma",
        stadium: "Ennio Tardini",
        capacity: 22352,
        color: "#ffd200",
        color2: "#1a3a8a",
        league: "serieA",
        prestige: 70,
        crest: crestUrl("par"),
    },
    {
        id: "lec",
        name: "Lecce",
        short: "LEC",
        city: "Lecce",
        stadium: "Via del Mare",
        capacity: 31533,
        color: "#c8102e",
        color2: "#ffd200",
        league: "serieA",
        prestige: 67,
        crest: crestUrl("lec"),
    },
    {
        id: "sas",
        name: "Sassuolo",
        short: "SAS",
        city: "Sassuolo",
        stadium: "Mapei Stadium",
        capacity: 21584,
        color: "#006633",
        color2: "#000000",
        league: "serieA",
        prestige: 72,
        crest: crestUrl("sas"),
    },
    {
        id: "fro",
        name: "Frosinone",
        short: "FRO",
        city: "Frosinone",
        stadium: "Benito Stirpe",
        capacity: 16227,
        color: "#ffd200",
        color2: "#1e3a8a",
        league: "serieA",
        prestige: 68,
        crest: crestUrl("fro"),
    },
    {
        id: "ven",
        name: "Venezia",
        short: "VEN",
        city: "Venecia",
        stadium: "Pier Luigi Penzo",
        capacity: 11150,
        color: "#1a3a2a",
        color2: "#c9a227",
        league: "serieA",
        prestige: 68,
        crest: crestUrl("ven"),
    },
    {
        id: "mon",
        name: "Monza",
        short: "MON",
        city: "Monza",
        stadium: "U-Power Stadium",
        capacity: 15039,
        color: "#c8102e",
        color2: "#ffffff",
        league: "serieA",
        prestige: 66,
        crest: crestUrl("mon"),
    },
    {
        id: "rma",
        name: "Real Madrid",
        short: "RMA",
        city: "Madrid",
        stadium: "Santiago Bernabéu",
        capacity: 81044,
        color: "#ffffff",
        color2: "#1e3a8a",
        league: "laliga",
        prestige: 95,
        featured: true,
        crest: crestUrl("rma"),
    },
    {
        id: "bar",
        name: "Barcelona",
        short: "BAR",
        city: "Barcelona",
        stadium: "Spotify Camp Nou",
        capacity: 99354,
        color: "#a50044",
        color2: "#004d98",
        league: "laliga",
        prestige: 93,
        crest: crestUrl("bar"),
    },
    {
        id: "bay",
        name: "Bayern Munich",
        short: "BAY",
        city: "Múnich",
        stadium: "Allianz Arena",
        capacity: 75000,
        color: "#dc052d",
        color2: "#ffffff",
        league: "bundesliga",
        prestige: 94,
        featured: true,
        crest: crestUrl("bay"),
    },
    {
        id: "mci",
        name: "Manchester City",
        short: "MCI",
        city: "Mánchester",
        stadium: "Etihad Stadium",
        capacity: 53400,
        color: "#6cabdd",
        color2: "#1c2c5b",
        league: "premier",
        prestige: 94,
        crest: crestUrl("mci"),
    },
    {
        id: "psg",
        name: "Paris Saint-Germain",
        short: "PSG",
        city: "París",
        stadium: "Parc des Princes",
        capacity: 47929,
        color: "#004170",
        color2: "#da291c",
        league: "ligue1",
        prestige: 95,
        featured: true,
        crest: crestUrl("psg"),
    },
    {
        id: "liv",
        name: "Liverpool",
        short: "LIV",
        city: "Liverpool",
        stadium: "Anfield",
        capacity: 61276,
        color: "#c8102e",
        color2: "#00a398",
        league: "premier",
        prestige: 91,
        crest: crestUrl("liv"),
    },
    {
        id: "ars",
        name: "Arsenal",
        short: "ARS",
        city: "Londres",
        stadium: "Emirates Stadium",
        capacity: 60704,
        color: "#ef0107",
        color2: "#ffffff",
        league: "premier",
        prestige: 90,
        featured: true,
        crest: crestUrl("ars"),
    },
    {
        id: "dor",
        name: "Borussia Dortmund",
        short: "BVB",
        city: "Dortmund",
        stadium: "Signal Iduna Park",
        capacity: 81365,
        color: "#fde100",
        color2: "#000000",
        league: "bundesliga",
        prestige: 86,
        crest: crestUrl("dor"),
    },
    {
        id: "atl",
        name: "Atlético Madrid",
        short: "ATL",
        city: "Madrid",
        stadium: "Cívitas Metropolitano",
        capacity: 70460,
        color: "#c8102e",
        color2: "#ffffff",
        league: "laliga",
        prestige: 88,
        crest: crestUrl("atl"),
    },
    {
        id: "che",
        name: "Chelsea",
        short: "CHE",
        city: "Londres",
        stadium: "Stamford Bridge",
        capacity: 40341,
        color: "#034694",
        color2: "#ffffff",
        league: "premier",
        prestige: 87,
        crest: crestUrl("che"),
    },
    {
        id: "rbl",
        name: "RB Leipzig",
        short: "RBL",
        city: "Leipzig",
        stadium: "Red Bull Arena",
        capacity: 47069,
        color: "#dd0747",
        color2: "#ffffff",
        league: "bundesliga",
        prestige: 82,
        crest: crestUrl("rbl"),
    },
    {
        id: "bru",
        name: "Club Brugge",
        short: "BRU",
        city: "Brujas",
        stadium: "Jan Breydel",
        capacity: 29062,
        color: "#1e3a8a",
        color2: "#000000",
        league: "europe",
        prestige: 76,
        ghost: true,
        country: "BEL",
        crest: crestUrl("bru"),
    },
    ...PREMIER_EXTRA,
    ...LALIGA_EXTRA,
    ...BUNDESLIGA_EXTRA,
    ...LIGUE1_EXTRA,
];
export const CLUBS = [...REAL_CLUBS, ...GHOST_CLUBS];
export const SERIE_A_IDS = uniqueIds(CLUBS.filter((c) => c.league === "serieA").map((c) => c.id));
export const PREMIER_IDS = uniqueIds(CLUBS.filter((c) => c.league === "premier").map((c) => c.id));
export const LALIGA_IDS = uniqueIds(CLUBS.filter((c) => c.league === "laliga").map((c) => c.id));
export const BUNDESLIGA_IDS = uniqueIds(CLUBS.filter((c) => c.league === "bundesliga").map((c) => c.id));
export const LIGUE1_IDS = uniqueIds(CLUBS.filter((c) => c.league === "ligue1").map((c) => c.id));
function uniqueIds(ids) {
    return [...new Set(ids)];
}
export const LEAGUE_INFO = {
    serieA: {
        id: "serieA",
        competition: "serieA",
        title: "Serie A",
        cup: "Coppa Italia",
        superCup: "Supercoppa Italiana",
        goal: "Objetivo: pelear el scudetto y no malvender el futuro.",
        rest: "Resto de la Serie A",
        region: "Italia",
    },
    premier: {
        id: "premier",
        competition: "premier",
        title: "Premier League",
        cup: "FA Cup",
        superCup: "Community Shield",
        goal: "Objetivo: pelear la Premier League y no malvender el futuro.",
        rest: "Resto de la Premier League",
        region: "Inglaterra",
    },
    laliga: {
        id: "laliga",
        competition: "laliga",
        title: "La Liga",
        cup: "Copa del Rey",
        superCup: "Supercopa de España",
        goal: "Objetivo: pelear La Liga y no malvender el futuro.",
        rest: "Resto de La Liga",
        region: "España",
    },
    bundesliga: {
        id: "bundesliga",
        competition: "bundesliga",
        title: "Bundesliga",
        cup: "DFB-Pokal",
        superCup: "DFL-Supercup",
        goal: "Objetivo: pelear la Meisterschale y no malvender el futuro.",
        rest: "Resto de la Bundesliga",
        region: "Alemania",
    },
    ligue1: {
        id: "ligue1",
        competition: "ligue1",
        title: "Ligue 1",
        cup: "Coupe de France",
        superCup: "Trophée des Champions",
        goal: "Objetivo: pelear la Ligue 1 y no malvender el futuro.",
        rest: "Resto de la Ligue 1",
        region: "Francia",
    },
};
export function playableLeague(league) {
    if (league === "premier")
        return "premier";
    if (league === "laliga")
        return "laliga";
    if (league === "bundesliga")
        return "bundesliga";
    if (league === "ligue1")
        return "ligue1";
    return "serieA";
}
export function leagueInfo(league) {
    return LEAGUE_INFO[playableLeague(league)];
}
export function domesticIds(league) {
    if (league === "premier")
        return PREMIER_IDS;
    if (league === "laliga")
        return LALIGA_IDS;
    if (league === "bundesliga")
        return BUNDESLIGA_IDS;
    if (league === "ligue1")
        return LIGUE1_IDS;
    return SERIE_A_IDS;
}
export function domesticCompetition(league) {
    return leagueInfo(league).competition;
}
export function isDomesticCompetition(comp) {
    return (comp === "serieA" ||
        comp === "premier" ||
        comp === "laliga" ||
        comp === "bundesliga" ||
        comp === "ligue1");
}
export function competitionToLeague(comp) {
    if (comp === "serieA")
        return "serieA";
    if (comp === "premier")
        return "premier";
    if (comp === "laliga")
        return "laliga";
    if (comp === "bundesliga")
        return "bundesliga";
    if (comp === "ligue1")
        return "ligue1";
    return null;
}
export function foreignClubIds(userLeague) {
    return CLUBS.filter((c) => c.league !== userLeague && !c.ghost).map((c) => c.id);
}
export const UCL_GROUPS = [
    ["int", "rma", "che", "bru"],
    ["nap", "mci", "ars", "atl"],
    ["rom", "bay", "liv", "rbl"],
    ["com", "psg", "dor", "bar"],
];
export const UCL_CLUB_IDS = UCL_GROUPS.flat();
const FALLBACK_CLUB = {
    id: "unk",
    name: "Club",
    short: "?",
    city: "",
    stadium: "",
    capacity: 0,
    color: "#6a6660",
    color2: "#12141a",
    league: "serieA",
    prestige: 60,
    crest: crestUrl("mil"),
};
export function findClub(id) {
    if (!id)
        return undefined;
    return CLUBS.find((x) => x.id === id);
}
export function isGhostClub(id) {
    return Boolean(findClub(id)?.ghost);
}
export function isSelectableClub(id) {
    const c = findClub(id);
    if (!c || c.ghost)
        return false;
    return (c.league === "serieA" ||
        c.league === "premier" ||
        c.league === "laliga" ||
        c.league === "bundesliga" ||
        c.league === "ligue1");
}
export function isTradableClub(id) {
    const c = findClub(id);
    return Boolean(c && !c.ghost);
}
export function isKnownClub(id) {
    return Boolean(findClub(id));
}
/** Never throws — unknown ids get a placeholder so a stale save cannot blank the app. */
export function clubById(id) {
    const c = findClub(id);
    if (c)
        return c;
    const short = (id || "?").slice(0, 3).toUpperCase();
    return { ...FALLBACK_CLUB, id: id || "unk", name: short, short };
}
export function startingBudget(prestige) {
    return Math.round(Math.pow(prestige / 10, 3.15) * 90_000);
}
export function emptyStanding(clubId) {
    return {
        clubId,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
        pts: 0,
        form: [],
    };
}
export function emptyLeagueTables() {
    return {
        serieA: SERIE_A_IDS.map(emptyStanding),
        premier: PREMIER_IDS.map(emptyStanding),
        laliga: LALIGA_IDS.map(emptyStanding),
        bundesliga: BUNDESLIGA_IDS.map(emptyStanding),
        ligue1: LIGUE1_IDS.map(emptyStanding),
    };
}
export const ALL_PLAYABLE_LEAGUES = [
    "serieA",
    "premier",
    "laliga",
    "bundesliga",
    "ligue1",
];
