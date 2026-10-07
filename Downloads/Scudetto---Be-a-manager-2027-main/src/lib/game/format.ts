import type { Competition, Player, Pos, PosGroup } from "./types";

export function formatMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}€${m.toLocaleString("es-ES", { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 1000) {
    return `${sign}€${Math.round(abs / 1000).toLocaleString("es-ES")} mil`;
  }
  return `${sign}€${Math.round(abs).toLocaleString("es-ES")}`;
}

export function formatWage(n: number): string {
  return `${formatMoney(n)}/sem`;
}

export function posGroup(pos: Pos): PosGroup {
  if (pos === "GK") return "GK";
  if (pos === "RB" || pos === "CB" || pos === "LB") return "DEF";
  if (pos === "ST" || pos === "LW" || pos === "RW") return "FWD";
  return "MID";
}

export const POS_LABEL: Record<Pos, string> = {
  GK: "PO",
  RB: "LD",
  CB: "DFC",
  LB: "LI",
  CDM: "MCD",
  CM: "MC",
  CAM: "MCO",
  RW: "ED",
  LW: "EI",
  ST: "DC",
};

export const GROUP_LABEL: Record<PosGroup, string> = {
  GK: "Porteros",
  DEF: "Defensas",
  MID: "Mediocampistas",
  FWD: "Delanteros",
};

export const COMP_LABEL: Record<Competition, string> = {
  serieA: "Serie A",
  premier: "Premier League",
  laliga: "La Liga",
  bundesliga: "Bundesliga",
  ligue1: "Ligue 1",
  argentina: "Liga Profesional",
  coppa: "Copa nacional",
  ucl: "Champions",
  uel: "Europa League",
  uecl: "Conference",
  libertadores: "Libertadores",
  sudamericana: "Sudamericana",
  supercoppa: "Supercopa",
  trofeo: "Trofeo de Campeones",
  mundial: "Mundial de Clubes",
};

export const NAT_LABEL: Record<string, string> = {
  ITA: "Italia",
  FRA: "Francia",
  ESP: "España",
  GER: "Alemania",
  ENG: "Inglaterra",
  POR: "Portugal",
  BRA: "Brasil",
  ARG: "Argentina",
  NED: "Países Bajos",
  BEL: "Bélgica",
  CRO: "Croacia",
  SRB: "Serbia",
  USA: "Estados Unidos",
  NGA: "Nigeria",
  CIV: "Costa de Marfil",
  SEN: "Senegal",
  MAR: "Marruecos",
  COL: "Colombia",
  URU: "Uruguay",
  CHI: "Chile",
  BOL: "Bolivia",
  PER: "Perú",
  VEN: "Venezuela",
  PAR: "Paraguay",
  ECU: "Ecuador",
  MEX: "México",
  SUI: "Suiza",
  AUT: "Austria",
  POL: "Polonia",
  DEN: "Dinamarca",
  SWE: "Suecia",
  TUR: "Turquía",
  GRE: "Grecia",
  CZE: "Chequia",
  GHA: "Ghana",
  CMR: "Camerún",
  ALG: "Argelia",
  JPN: "Japón",
  KOR: "Corea",
  SCO: "Escocia",
  WAL: "Gales",
  IRL: "Irlanda",
  NOR: "Noruega",
  UKR: "Ucrania",
  GEO: "Georgia",
  ALB: "Albania",
  SVN: "Eslovenia",
  SVK: "Eslovaquia",
  MLI: "Malí",
  GUI: "Guinea",
  ARM: "Armenia",
  ISL: "Islandia",
  CAN: "Canadá",
  EGY: "Egipto",
  HUN: "Hungría",
  BIH: "Bosnia",
  MNE: "Montenegro",
  ANG: "Angola",
  ROU: "Rumanía",
  FIN: "Finlandia",
  RSA: "Sudáfrica",
  TOG: "Togo",
  KOS: "Kosovo",
  AUS: "Australia",
  AND: "Andorra",
  AZE: "Azerbaiyán",
  BLR: "Bielorrusia",
  BUL: "Bulgaria",
  CYP: "Chipre",
  EST: "Estonia",
  FRO: "Islas Feroe",
  ISR: "Israel",
  KAZ: "Kazajistán",
  LVA: "Letonia",
  LIE: "Liechtenstein",
  LTU: "Lituania",
  LUX: "Luxemburgo",
  MKD: "Macedonia del Norte",
  MLT: "Malta",
  MDA: "Moldavia",
  MON: "Mónaco",
  NIR: "Irlanda del Norte",
  RUS: "Rusia",
  SMR: "San Marino",
  VAT: "Ciudad del Vaticano",
  BEN: "Benín",
  BOT: "Botsuana",
  BFA: "Burkina Faso",
  BDI: "Burundi",
  CPV: "Cabo Verde",
  COM: "Comoras",
  CGO: "Congo",
  COD: "RD del Congo",
  CHA: "Chad",
  ERI: "Eritrea",
  SWZ: "Esuatini",
  ETH: "Etiopía",
  GAB: "Gabón",
  GAM: "Gambia",
  GNB: "Guinea-Bisáu",
  EQG: "Guinea Ecuatorial",
  KEN: "Kenia",
  LES: "Lesoto",
  LBR: "Liberia",
  LBY: "Libia",
  MAD: "Madagascar",
  MWI: "Malaui",
  MTN: "Mauritania",
  MRI: "Mauricio",
  MOZ: "Mozambique",
  NAM: "Namibia",
  NIG: "Níger",
  CTA: "Rep. Centroafricana",
  RWA: "Ruanda",
  STP: "Santo Tomé y Príncipe",
  SEY: "Seychelles",
  SLE: "Sierra Leona",
  SOM: "Somalia",
  SSD: "Sudán del Sur",
  SDN: "Sudán",
  TAN: "Tanzania",
  TUN: "Túnez",
  UGA: "Uganda",
  DJI: "Yibuti",
  ZAM: "Zambia",
  ZIM: "Zimbabue",
  ATG: "Antigua y Barbuda",
  BAH: "Bahamas",
  BRB: "Barbados",
  BLZ: "Belice",
  CRC: "Costa Rica",
  CUB: "Cuba",
  DMA: "Dominica",
  SLV: "El Salvador",
  GRN: "Granada",
  GUA: "Guatemala",
  GUY: "Guyana",
  HAI: "Haití",
  HON: "Honduras",
  JAM: "Jamaica",
  NCA: "Nicaragua",
  PAN: "Panamá",
  PUR: "Puerto Rico",
  DOM: "República Dominicana",
  SKN: "San Cristóbal y Nieves",
  VIN: "San Vicente y las Granadinas",
  LCA: "Santa Lucía",
  SUR: "Surinam",
  TRI: "Trinidad y Tobago",
  CUW: "Curazao",
  AFG: "Afganistán",
  KSA: "Arabia Saudita",
  BHR: "Baréin",
  BAN: "Bangladés",
  BHU: "Bután",
  BRU: "Brunéi",
  CAM: "Camboya",
  QAT: "Catar",
  CHN: "China",
  PRK: "Corea del Norte",
  UAE: "Emiratos Árabes Unidos",
  PHI: "Filipinas",
  IND: "India",
  IDN: "Indonesia",
  IRQ: "Irak",
  IRN: "Irán",
  JOR: "Jordania",
  KGZ: "Kirguistán",
  KUW: "Kuwait",
  LAO: "Laos",
  LBN: "Líbano",
  MAS: "Malasia",
  MDV: "Maldivas",
  MGL: "Mongolia",
  MYA: "Birmania (Myanmar)",
  NEP: "Nepal",
  OMA: "Omán",
  PAK: "Pakistán",
  PLE: "Palestina",
  SGP: "Singapur",
  SYR: "Siria",
  SRI: "Sri Lanka",
  THA: "Tailandia",
  TPE: "Taiwán",
  TJK: "Tayikistán",
  TLS: "Timor Oriental",
  TKM: "Turkmenistán",
  UZB: "Uzbekistán",
  VIE: "Vietnam",
  YEM: "Yemen",
  FIJ: "Fiyi",
  SOL: "Islas Salomón",
  KIR: "Kiribati",
  MHL: "Islas Marshall",
  FSM: "Micronesia",
  NRU: "Nauru",
  NZL: "Nueva Zelanda",
  PLW: "Palaos",
  PNG: "Papúa Nueva Guinea",
  SAM: "Samoa",
  TGA: "Tonga",
  TUV: "Tuvalu",
  VAN: "Vanuatu",
};

export function seasonLabel(season: number, league?: import("./types").LeagueKind) {
  if (league === "argentina") return String(season);
  return `${season}/${String(season + 1).slice(2)}`;
}

export const VALUE_CAP = 550_000_000;

function ovrBaseValue(ovr: number): number {
  const n = clamp(ovr, 40, 99);
  if (n < 60) return 80_000 * Math.pow(1.18, n - 40);
  if (n < 70) return 3_200_000 * Math.pow(1.195, n - 60);
  if (n < 80) return 18_000_000 * Math.pow(1.132, n - 70);
  if (n < 88) return 62_000_000 * Math.pow(1.129, n - 80);
  if (n < 93) return 160_000_000 * Math.pow(1.123, n - 88);
  if (n < 96) return 280_000_000 * Math.pow(1.134, n - 93);
  const t = (n - 96) / 3;
  return 400_000_000 + t * 130_000_000;
}

export function capMarketValue(n: number) {
  return Math.min(VALUE_CAP, Math.max(80_000, Math.round(n)));
}

export function playerValue(
  ovr: number,
  age: number,
  pot: number,
  extra?: { goals?: number; assists?: number; form?: number; apps?: number },
): number {
  const peak = 27;
  const ageMod = age < peak ? 1 + (peak - age) * 0.038 : Math.max(0.28, 1 - (age - peak) * 0.058);
  const room = Math.max(0, pot - ovr);
  const potMod = 1 + (ovr < 75 ? room * 0.038 : ovr < 88 ? room * 0.024 : room * 0.012);
  const base = ovrBaseValue(ovr);
  const g = extra?.goals ?? 0;
  const a = extra?.assists ?? 0;
  const f = extra?.form ?? 0;
  const apps = extra?.apps ?? 0;
  const perf =
    1 +
    Math.min(0.42, g * 0.028 + a * 0.016 + Math.max(-0.08, f) * 0.024 + Math.min(apps, 25) * 0.003);
  return capMarketValue(base * ageMod * potMod * perf);
}

export function refreshValues(players: Player[]) {
  for (const p of players) {
    const base = playerValue(p.ovr, p.age, p.pot, p);
    // Un suceso puede inflar o hundir el valor por unos partidos (escándalo, buen momento...).
    const mod = p.valueMod && p.valueMod.games > 0 ? p.valueMod.pct : 0;
    p.value = mod ? capMarketValue(base * (1 + mod / 100)) : base;
  }
}

export function playerWage(ovr: number, prestige: number): number {
  const raw = Math.pow(Math.max(ovr - 48, 8), 3) * 2.05 + 7000;
  return Math.round(raw * (0.7 + prestige / 250));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function ovrClass(n: number) {
  if (n >= 90) return "text-primary";
  if (n >= 85) return "text-fg";
  if (n >= 78) return "text-primary";
  if (n >= 70) return "text-fg-muted";
  return "text-fg-subtle";
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export const SQUAD_LIMIT = 40;
export const SQUAD_MIN = 18;
