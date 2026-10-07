import { clubById } from "./clubs";
import { clamp, playerValue, playerWage } from "./format";
import { makeName } from "./names";
import { coercePos } from "./positions";
import { rollPotential } from "./potential";
import type { Rng } from "./rng";
import { statsFor } from "./squads";
import type { Player, Pos, ScoutMission, YouthPlayer } from "./types";

export interface ScoutCountry {
  id: string;
  nat: string;
  name: string;
  cost: number;
  weeks: number;
}

export const SCOUT_COUNTRIES: ScoutCountry[] = [
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
  { id: "afg", nat: "AFG", name: "Afganistán", cost: 250_000, weeks: 3 },
  { id: "alb", nat: "ALB", name: "Albania", cost: 330_000, weeks: 2 },
  { id: "and", nat: "AND", name: "Andorra", cost: 250_000, weeks: 2 },
  { id: "ang", nat: "ANG", name: "Angola", cost: 380_000, weeks: 3 },
  { id: "atg", nat: "ATG", name: "Antigua y Barbuda", cost: 250_000, weeks: 3 },
  { id: "ksa", nat: "KSA", name: "Arabia Saudita", cost: 440_000, weeks: 3 },
  { id: "alg", nat: "ALG", name: "Argelia", cost: 440_000, weeks: 2 },
  { id: "arm", nat: "ARM", name: "Armenia", cost: 300_000, weeks: 2 },
  { id: "aus", nat: "AUS", name: "Australia", cost: 470_000, weeks: 3 },
  { id: "aut", nat: "AUT", name: "Austria", cost: 520_000, weeks: 2 },
  { id: "aze", nat: "AZE", name: "Azerbaiyán", cost: 320_000, weeks: 2 },
  { id: "bah", nat: "BAH", name: "Bahamas", cost: 250_000, weeks: 3 },
  { id: "ban", nat: "BAN", name: "Bangladés", cost: 260_000, weeks: 3 },
  { id: "brb", nat: "BRB", name: "Barbados", cost: 250_000, weeks: 3 },
  { id: "bhr", nat: "BHR", name: "Baréin", cost: 260_000, weeks: 3 },
  { id: "blz", nat: "BLZ", name: "Belice", cost: 250_000, weeks: 3 },
  { id: "ben", nat: "BEN", name: "Benín", cost: 340_000, weeks: 3 },
  { id: "blr", nat: "BLR", name: "Bielorrusia", cost: 330_000, weeks: 2 },
  { id: "mya", nat: "MYA", name: "Birmania (Myanmar)", cost: 260_000, weeks: 3 },
  { id: "bol", nat: "BOL", name: "Bolivia", cost: 360_000, weeks: 3 },
  { id: "bih", nat: "BIH", name: "Bosnia y Herzegovina", cost: 380_000, weeks: 2 },
  { id: "bot", nat: "BOT", name: "Botsuana", cost: 280_000, weeks: 3 },
  { id: "bru", nat: "BRU", name: "Brunéi", cost: 250_000, weeks: 3 },
  { id: "bul", nat: "BUL", name: "Bulgaria", cost: 350_000, weeks: 2 },
  { id: "bfa", nat: "BFA", name: "Burkina Faso", cost: 350_000, weeks: 3 },
  { id: "bdi", nat: "BDI", name: "Burundi", cost: 270_000, weeks: 3 },
  { id: "bhu", nat: "BHU", name: "Bután", cost: 250_000, weeks: 3 },
  { id: "bel", nat: "BEL", name: "Bélgica", cost: 600_000, weeks: 2 },
  { id: "cpv", nat: "CPV", name: "Cabo Verde", cost: 340_000, weeks: 3 },
  { id: "cam", nat: "CAM", name: "Camboya", cost: 260_000, weeks: 3 },
  { id: "cmr", nat: "CMR", name: "Camerún", cost: 470_000, weeks: 3 },
  { id: "can", nat: "CAN", name: "Canadá", cost: 560_000, weeks: 3 },
  { id: "qat", nat: "QAT", name: "Catar", cost: 360_000, weeks: 3 },
  { id: "cha", nat: "CHA", name: "Chad", cost: 280_000, weeks: 3 },
  { id: "cze", nat: "CZE", name: "Chequia", cost: 430_000, weeks: 2 },
  { id: "chi", nat: "CHI", name: "Chile", cost: 560_000, weeks: 3 },
  { id: "chn", nat: "CHN", name: "China", cost: 450_000, weeks: 3 },
  { id: "cyp", nat: "CYP", name: "Chipre", cost: 300_000, weeks: 2 },
  { id: "vat", nat: "VAT", name: "Ciudad del Vaticano", cost: 250_000, weeks: 2 },
  { id: "col", nat: "COL", name: "Colombia", cost: 640_000, weeks: 3 },
  { id: "com", nat: "COM", name: "Comoras", cost: 270_000, weeks: 3 },
  { id: "cgo", nat: "CGO", name: "Congo", cost: 340_000, weeks: 3 },
  { id: "prk", nat: "PRK", name: "Corea del Norte", cost: 300_000, weeks: 3 },
  { id: "kor", nat: "KOR", name: "Corea del Sur", cost: 450_000, weeks: 3 },
  { id: "crc", nat: "CRC", name: "Costa Rica", cost: 340_000, weeks: 3 },
  { id: "cub", nat: "CUB", name: "Cuba", cost: 280_000, weeks: 3 },
  { id: "cuw", nat: "CUW", name: "Curazao", cost: 300_000, weeks: 3 },
  { id: "den", nat: "DEN", name: "Dinamarca", cost: 520_000, weeks: 2 },
  { id: "dma", nat: "DMA", name: "Dominica", cost: 250_000, weeks: 3 },
  { id: "ecu", nat: "ECU", name: "Ecuador", cost: 520_000, weeks: 3 },
  { id: "egy", nat: "EGY", name: "Egipto", cost: 440_000, weeks: 2 },
  { id: "slv", nat: "SLV", name: "El Salvador", cost: 290_000, weeks: 3 },
  { id: "uae", nat: "UAE", name: "Emiratos Árabes Unidos", cost: 380_000, weeks: 3 },
  { id: "eri", nat: "ERI", name: "Eritrea", cost: 260_000, weeks: 3 },
  { id: "sco", nat: "SCO", name: "Escocia", cost: 480_000, weeks: 2 },
  { id: "svk", nat: "SVK", name: "Eslovaquia", cost: 360_000, weeks: 2 },
  { id: "svn", nat: "SVN", name: "Eslovenia", cost: 350_000, weeks: 2 },
  { id: "usa", nat: "USA", name: "Estados Unidos", cost: 720_000, weeks: 3 },
  { id: "est", nat: "EST", name: "Estonia", cost: 270_000, weeks: 2 },
  { id: "swz", nat: "SWZ", name: "Esuatini", cost: 260_000, weeks: 3 },
  { id: "eth", nat: "ETH", name: "Etiopía", cost: 300_000, weeks: 3 },
  { id: "phi", nat: "PHI", name: "Filipinas", cost: 280_000, weeks: 3 },
  { id: "fin", nat: "FIN", name: "Finlandia", cost: 340_000, weeks: 2 },
  { id: "fij", nat: "FIJ", name: "Fiyi", cost: 250_000, weeks: 3 },
  { id: "gab", nat: "GAB", name: "Gabón", cost: 340_000, weeks: 3 },
  { id: "wal", nat: "WAL", name: "Gales", cost: 420_000, weeks: 2 },
  { id: "gam", nat: "GAM", name: "Gambia", cost: 300_000, weeks: 3 },
  { id: "geo", nat: "GEO", name: "Georgia", cost: 330_000, weeks: 2 },
  { id: "gha", nat: "GHA", name: "Ghana", cost: 500_000, weeks: 3 },
  { id: "grn", nat: "GRN", name: "Granada", cost: 250_000, weeks: 3 },
  { id: "gre", nat: "GRE", name: "Grecia", cost: 450_000, weeks: 2 },
  { id: "gua", nat: "GUA", name: "Guatemala", cost: 290_000, weeks: 3 },
  { id: "gui", nat: "GUI", name: "Guinea", cost: 380_000, weeks: 3 },
  { id: "eqg", nat: "EQG", name: "Guinea Ecuatorial", cost: 290_000, weeks: 3 },
  { id: "gnb", nat: "GNB", name: "Guinea-Bisáu", cost: 300_000, weeks: 3 },
  { id: "guy", nat: "GUY", name: "Guyana", cost: 260_000, weeks: 3 },
  { id: "hai", nat: "HAI", name: "Haití", cost: 320_000, weeks: 3 },
  { id: "hon", nat: "HON", name: "Honduras", cost: 300_000, weeks: 3 },
  { id: "hun", nat: "HUN", name: "Hungría", cost: 400_000, weeks: 2 },
  { id: "ind", nat: "IND", name: "India", cost: 330_000, weeks: 3 },
  { id: "idn", nat: "IDN", name: "Indonesia", cost: 320_000, weeks: 3 },
  { id: "irq", nat: "IRQ", name: "Irak", cost: 320_000, weeks: 3 },
  { id: "irl", nat: "IRL", name: "Irlanda", cost: 400_000, weeks: 2 },
  { id: "nir", nat: "NIR", name: "Irlanda del Norte", cost: 380_000, weeks: 2 },
  { id: "irn", nat: "IRN", name: "Irán", cost: 430_000, weeks: 3 },
  { id: "isl", nat: "ISL", name: "Islandia", cost: 290_000, weeks: 2 },
  { id: "fro", nat: "FRO", name: "Islas Feroe", cost: 250_000, weeks: 2 },
  { id: "mhl", nat: "MHL", name: "Islas Marshall", cost: 250_000, weeks: 3 },
  { id: "sol", nat: "SOL", name: "Islas Salomón", cost: 250_000, weeks: 3 },
  { id: "isr", nat: "ISR", name: "Israel", cost: 400_000, weeks: 2 },
  { id: "jam", nat: "JAM", name: "Jamaica", cost: 340_000, weeks: 3 },
  { id: "jor", nat: "JOR", name: "Jordania", cost: 300_000, weeks: 3 },
  { id: "kaz", nat: "KAZ", name: "Kazajistán", cost: 330_000, weeks: 3 },
  { id: "ken", nat: "KEN", name: "Kenia", cost: 320_000, weeks: 3 },
  { id: "kgz", nat: "KGZ", name: "Kirguistán", cost: 270_000, weeks: 3 },
  { id: "kir", nat: "KIR", name: "Kiribati", cost: 250_000, weeks: 3 },
  { id: "kos", nat: "KOS", name: "Kosovo", cost: 320_000, weeks: 2 },
  { id: "kuw", nat: "KUW", name: "Kuwait", cost: 280_000, weeks: 3 },
  { id: "lao", nat: "LAO", name: "Laos", cost: 250_000, weeks: 3 },
  { id: "les", nat: "LES", name: "Lesoto", cost: 250_000, weeks: 3 },
  { id: "lva", nat: "LVA", name: "Letonia", cost: 270_000, weeks: 2 },
  { id: "lbr", nat: "LBR", name: "Liberia", cost: 300_000, weeks: 3 },
  { id: "lby", nat: "LBY", name: "Libia", cost: 300_000, weeks: 2 },
  { id: "lie", nat: "LIE", name: "Liechtenstein", cost: 250_000, weeks: 2 },
  { id: "ltu", nat: "LTU", name: "Lituania", cost: 280_000, weeks: 2 },
  { id: "lux", nat: "LUX", name: "Luxemburgo", cost: 300_000, weeks: 2 },
  { id: "lbn", nat: "LBN", name: "Líbano", cost: 290_000, weeks: 2 },
  { id: "mkd", nat: "MKD", name: "Macedonia del Norte", cost: 310_000, weeks: 2 },
  { id: "mad", nat: "MAD", name: "Madagascar", cost: 290_000, weeks: 3 },
  { id: "mas", nat: "MAS", name: "Malasia", cost: 290_000, weeks: 3 },
  { id: "mwi", nat: "MWI", name: "Malaui", cost: 260_000, weeks: 3 },
  { id: "mdv", nat: "MDV", name: "Maldivas", cost: 250_000, weeks: 3 },
  { id: "mlt", nat: "MLT", name: "Malta", cost: 260_000, weeks: 2 },
  { id: "mli", nat: "MLI", name: "Malí", cost: 420_000, weeks: 3 },
  { id: "mri", nat: "MRI", name: "Mauricio", cost: 260_000, weeks: 3 },
  { id: "mtn", nat: "MTN", name: "Mauritania", cost: 290_000, weeks: 3 },
  { id: "fsm", nat: "FSM", name: "Micronesia", cost: 250_000, weeks: 3 },
  { id: "mda", nat: "MDA", name: "Moldavia", cost: 290_000, weeks: 2 },
  { id: "mgl", nat: "MGL", name: "Mongolia", cost: 250_000, weeks: 3 },
  { id: "mne", nat: "MNE", name: "Montenegro", cost: 330_000, weeks: 2 },
  { id: "moz", nat: "MOZ", name: "Mozambique", cost: 320_000, weeks: 3 },
  { id: "mex", nat: "MEX", name: "México", cost: 640_000, weeks: 3 },
  { id: "mon", nat: "MON", name: "Mónaco", cost: 300_000, weeks: 2 },
  { id: "nam", nat: "NAM", name: "Namibia", cost: 280_000, weeks: 3 },
  { id: "nru", nat: "NRU", name: "Nauru", cost: 250_000, weeks: 3 },
  { id: "nep", nat: "NEP", name: "Nepal", cost: 250_000, weeks: 3 },
  { id: "nca", nat: "NCA", name: "Nicaragua", cost: 260_000, weeks: 3 },
  { id: "nor", nat: "NOR", name: "Noruega", cost: 470_000, weeks: 2 },
  { id: "nzl", nat: "NZL", name: "Nueva Zelanda", cost: 400_000, weeks: 3 },
  { id: "nig", nat: "NIG", name: "Níger", cost: 280_000, weeks: 3 },
  { id: "oma", nat: "OMA", name: "Omán", cost: 270_000, weeks: 3 },
  { id: "pak", nat: "PAK", name: "Pakistán", cost: 270_000, weeks: 3 },
  { id: "plw", nat: "PLW", name: "Palaos", cost: 250_000, weeks: 3 },
  { id: "ple", nat: "PLE", name: "Palestina", cost: 270_000, weeks: 3 },
  { id: "pan", nat: "PAN", name: "Panamá", cost: 320_000, weeks: 3 },
  { id: "png", nat: "PNG", name: "Papúa Nueva Guinea", cost: 260_000, weeks: 3 },
  { id: "par", nat: "PAR", name: "Paraguay", cost: 520_000, weeks: 3 },
  { id: "per", nat: "PER", name: "Perú", cost: 500_000, weeks: 3 },
  { id: "pol", nat: "POL", name: "Polonia", cost: 500_000, weeks: 2 },
  { id: "pur", nat: "PUR", name: "Puerto Rico", cost: 270_000, weeks: 3 },
  { id: "cod", nat: "COD", name: "RD del Congo", cost: 450_000, weeks: 3 },
  { id: "cta", nat: "CTA", name: "Rep. Centroafricana", cost: 260_000, weeks: 3 },
  { id: "dom", nat: "DOM", name: "República Dominicana", cost: 290_000, weeks: 3 },
  { id: "rwa", nat: "RWA", name: "Ruanda", cost: 270_000, weeks: 3 },
  { id: "rou", nat: "ROU", name: "Rumanía", cost: 430_000, weeks: 2 },
  { id: "rus", nat: "RUS", name: "Rusia", cost: 560_000, weeks: 3 },
  { id: "sam", nat: "SAM", name: "Samoa", cost: 250_000, weeks: 3 },
  { id: "skn", nat: "SKN", name: "San Cristóbal y Nieves", cost: 250_000, weeks: 3 },
  { id: "smr", nat: "SMR", name: "San Marino", cost: 250_000, weeks: 2 },
  { id: "vin", nat: "VIN", name: "San Vicente y las Granadinas", cost: 250_000, weeks: 3 },
  { id: "lca", nat: "LCA", name: "Santa Lucía", cost: 250_000, weeks: 3 },
  { id: "stp", nat: "STP", name: "Santo Tomé y Príncipe", cost: 250_000, weeks: 3 },
  { id: "sey", nat: "SEY", name: "Seychelles", cost: 250_000, weeks: 3 },
  { id: "sle", nat: "SLE", name: "Sierra Leona", cost: 300_000, weeks: 3 },
  { id: "sgp", nat: "SGP", name: "Singapur", cost: 290_000, weeks: 3 },
  { id: "syr", nat: "SYR", name: "Siria", cost: 280_000, weeks: 3 },
  { id: "som", nat: "SOM", name: "Somalia", cost: 250_000, weeks: 3 },
  { id: "sri", nat: "SRI", name: "Sri Lanka", cost: 250_000, weeks: 3 },
  { id: "rsa", nat: "RSA", name: "Sudáfrica", cost: 420_000, weeks: 3 },
  { id: "sdn", nat: "SDN", name: "Sudán", cost: 290_000, weeks: 3 },
  { id: "ssd", nat: "SSD", name: "Sudán del Sur", cost: 250_000, weeks: 3 },
  { id: "swe", nat: "SWE", name: "Suecia", cost: 490_000, weeks: 2 },
  { id: "sui", nat: "SUI", name: "Suiza", cost: 540_000, weeks: 2 },
  { id: "sur", nat: "SUR", name: "Surinam", cost: 290_000, weeks: 3 },
  { id: "tha", nat: "THA", name: "Tailandia", cost: 330_000, weeks: 3 },
  { id: "tpe", nat: "TPE", name: "Taiwán", cost: 270_000, weeks: 3 },
  { id: "tan", nat: "TAN", name: "Tanzania", cost: 290_000, weeks: 3 },
  { id: "tjk", nat: "TJK", name: "Tayikistán", cost: 260_000, weeks: 3 },
  { id: "tls", nat: "TLS", name: "Timor Oriental", cost: 250_000, weeks: 3 },
  { id: "tog", nat: "TOG", name: "Togo", cost: 350_000, weeks: 3 },
  { id: "tga", nat: "TGA", name: "Tonga", cost: 250_000, weeks: 3 },
  { id: "tri", nat: "TRI", name: "Trinidad y Tobago", cost: 300_000, weeks: 3 },
  { id: "tkm", nat: "TKM", name: "Turkmenistán", cost: 260_000, weeks: 3 },
  { id: "tur", nat: "TUR", name: "Turquía", cost: 520_000, weeks: 2 },
  { id: "tuv", nat: "TUV", name: "Tuvalu", cost: 250_000, weeks: 3 },
  { id: "tun", nat: "TUN", name: "Túnez", cost: 450_000, weeks: 2 },
  { id: "ukr", nat: "UKR", name: "Ucrania", cost: 470_000, weeks: 2 },
  { id: "uga", nat: "UGA", name: "Uganda", cost: 300_000, weeks: 3 },
  { id: "uru", nat: "URU", name: "Uruguay", cost: 620_000, weeks: 3 },
  { id: "uzb", nat: "UZB", name: "Uzbekistán", cost: 340_000, weeks: 3 },
  { id: "van", nat: "VAN", name: "Vanuatu", cost: 250_000, weeks: 3 },
  { id: "ven", nat: "VEN", name: "Venezuela", cost: 470_000, weeks: 3 },
  { id: "vie", nat: "VIE", name: "Vietnam", cost: 320_000, weeks: 3 },
  { id: "yem", nat: "YEM", name: "Yemen", cost: 250_000, weeks: 3 },
  { id: "dji", nat: "DJI", name: "Yibuti", cost: 250_000, weeks: 3 },
  { id: "zam", nat: "ZAM", name: "Zambia", cost: 330_000, weeks: 3 },
  { id: "zim", nat: "ZIM", name: "Zimbabue", cost: 300_000, weeks: 3 },
];

export const SCOUT_TIERS: Array<{
  tier: 1 | 2 | 3;
  label: string;
  mult: number;
  blurb: string;
}> = [
  // Precios por país (según SCOUT_COUNTRIES): básica ≈ €2,5–6 M, amplia ≈ €4,7–11 M, élite ≈ €10,5–25 M.
  // La básica sube para no regalar ojeos y quedar a un paso de la amplia (antes €1,7–4 M).
  { tier: 1, label: "Red básica", mult: 6.5, blurb: "La más barata. Perfiles modestos." },
  { tier: 2, label: "Red amplia", mult: 12, blurb: "Más ojos, mejores chances." },
  { tier: 3, label: "Red élite", mult: 27, blurb: "Carísima. Apunta a cracks." },
];

export const ACADEMY_UPGRADE = [0, 4_500_000, 11_000_000, 22_000_000];
export const MAX_SCOUTS = 3;
export const ACADEMY_MAX = 22;
const POS_POOL: Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];

export function academyCapacity(_level: number) {
  return ACADEMY_MAX;
}

export function youthFee(ovr: number, pot: number): number {
  const raw = 5_000_000 + Math.max(0, ovr - 55) * 480_000 + Math.max(0, pot - 72) * 720_000;
  return clamp(Math.round(raw / 100_000) * 100_000, 5_000_000, 40_000_000);
}

export function makeYouth(
  rng: Rng,
  nat: string,
  used: Set<string>,
  clubId: string,
  level: number,
  forced?: Partial<YouthPlayer> & { tier?: 1 | 2 | 3 },
): YouthPlayer {
  // Posición siempre válida: si `forced.pos` viene vacío o inválido se sortea una real.
  const pos = coercePos(forced?.pos) ?? rng.pick(POS_POOL);
  const age = forced?.age ?? rng.int(16, 19);
  const tier = forced?.tier ?? 1;
  const base =
    52 +
    level * 2 +
    (tier === 3 ? rng.int(8, 16) : tier === 2 ? rng.int(4, 10) : rng.int(-2, 6));
  const ovr = forced?.ovr ?? clamp(base, 52, 76);
  let pot = forced?.pot ?? rollPotential(ovr, age, rng);
  if (tier === 3 && rng.chance(0.28)) pot = clamp(Math.max(pot, rng.int(88, 95)), ovr, 99);
  if (tier === 2 && rng.chance(0.12)) pot = clamp(Math.max(pot, rng.int(84, 92)), ovr, 96);
  if (rng.chance(0.012)) pot = clamp(Math.max(pot, 96), ovr, 100);
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

export function seedAcademy(clubId: string, rng: Rng, used: Set<string>): YouthPlayer[] {
  const club = clubById(clubId);
  const n = club.prestige >= 84 ? 5 : club.prestige >= 76 ? 4 : 3;
  const out: YouthPlayer[] = [];
  const homeNat =
    club.league === "bundesliga"
      ? "GER"
      : club.league === "premier"
        ? "ENG"
        : club.league === "laliga"
          ? "ESP"
          : club.league === "ligue1"
            ? "FRA"
            : club.league === "argentina"
              ? "ARG"
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
    loanFrom: null as string | null,
    loanSeasons: 0,
    hiddenGem: false,
    suspended: 0,
    number: 0,
  };
}

export function youthToPlayer(y: YouthPlayer, clubId: string, rng: Rng): Player {
  const club = clubById(clubId);
  // Un juvenil guardado sin posición válida (partidas viejas) no puede subir sin ella.
  const pos = coercePos(y.pos) ?? rng.pick(POS_POOL);
  return {
    id: `p-${y.id}`,
    name: y.name,
    nat: y.nat,
    age: y.age,
    pos,
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
    ...statsFor(pos, y.ovr, rng),
    ...emptyPlayerExtras(),
    seasonStartOvr: y.ovr,
  };
}

export function resolveScouts(
  scouts: ScoutMission[],
  academy: YouthPlayer[],
  level: number,
  clubId: string,
  rng: Rng,
  used: Set<string>,
): { scouts: ScoutMission[]; academy: YouthPlayer[]; found: YouthPlayer[] } {
  const still: ScoutMission[] = [];
  const found: YouthPlayer[] = [];
  const cap = academyCapacity(level);
  let nextAcademy = [...academy];
  for (const m of scouts) {
    const left = m.weeksLeft - 1;
    if (left > 0) {
      still.push({ ...m, weeksLeft: left });
      continue;
    }
    const n =
      m.tier === 3 ? rng.int(1, 3) : m.tier === 2 ? rng.int(1, 2) : rng.chance(0.7) ? 1 : 0;
    const count = Math.max(1, n);
    for (let i = 0; i < count; i++) {
      if (nextAcademy.length >= cap) break;
      const preferred = coercePos(m.preferredPos); // "ANY" o inválido → sin preferencia
      const pos = preferred && rng.chance(0.72) ? preferred : rng.pick(POS_POOL);
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

export function scoutCost(country: ScoutCountry, tier: 1 | 2 | 3) {
  const row = SCOUT_TIERS.find((t) => t.tier === tier)!;
  return Math.round((country.cost * row.mult) / 100_000) * 100_000;
}
