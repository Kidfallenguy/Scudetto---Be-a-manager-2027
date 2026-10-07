import { crestUrl } from "./crests";
import type { Club, LeagueKind } from "./types";

type Seed = [
  id: string,
  name: string,
  short: string,
  city: string,
  stadium: string,
  capacity: number,
  color: string,
  color2: string,
  prestige: number,
  country: string,
  league: LeagueKind,
];

function ghost(row: Seed): Club {
  const [id, name, short, city, stadium, capacity, color, color2, prestige, country, league] = row;
  return {
    id,
    name,
    short,
    city,
    stadium,
    capacity,
    color,
    color2,
    league,
    prestige,
    country,
    ghost: true,
    crest: crestUrl(id),
  };
}

/** Fictional European sides that fill UCL / UEL / UECL slots. Not selectable, not tradable. */
const EUROPE_SEEDS: Seed[] = [
  ["douro", "Sport União do Douro", "DOU", "Oporto", "Estádio do Rio", 50300, "#1a3a8a", "#ffffff", 83, "POR", "europe"],
  ["atlix", "CF Atlântico", "ATL", "Lisboa", "Estádio da Maré", 48200, "#006633", "#ffffff", 82, "POR", "europe"],
  ["verde", "Verde e Branco FC", "VEB", "Lisboa", "Campo das Acácias", 36500, "#1d7a3a", "#ffffff", 80, "POR", "europe"],
  ["ornh", "Oranjehaven FC", "ORH", "Ámsterdam", "Havenpark", 54000, "#e87722", "#111111", 82, "NED", "europe"],
  ["diks", "Dijkstad VV", "DIK", "Róterdam", "Maasstadion", 47500, "#c8102e", "#ffffff", 78, "NED", "europe"],
  ["lamp", "Lampistas FC", "LMP", "Eindhoven", "Lichtstad Arena", 35200, "#c8102e", "#111111", 79, "NED", "europe"],
  ["schel", "Royal Schelde", "SCH", "Amberes", "Scheldepark", 28000, "#6b1d45", "#ffffff", 75, "BEL", "europe"],
  ["ardn", "FC Ardennes", "ARD", "Lieja", "Stade des Bois", 24000, "#1e3a8a", "#c9a227", 73, "BEL", "europe"],
  ["nbnk", "Northbank Athletic", "NBA", "Glasgow", "Clydebank Park", 42000, "#1a3a8a", "#c8102e", 77, "SCO", "europe"],
  ["frth", "Forthside FC", "FTH", "Edimburgo", "Forth Stadium", 28000, "#5b1d8a", "#ffffff", 74, "SCO", "europe"],
  ["alps", "Alpenstadt SK", "ALP", "Salzburgo", "Alpenarena", 31000, "#c8102e", "#ffffff", 80, "AUT", "europe"],
  ["donau", "Donau Wien", "DON", "Viena", "Donauinsel", 26500, "#6b1d45", "#ffffff", 74, "AUT", "europe"],
  ["yild", "Yıldızspor", "YIL", "Estambul", "Yıldız Parkı", 52000, "#c9a227", "#c8102e", 79, "TUR", "europe"],
  ["bogz", "Boğaz FK", "BGZ", "Estambul", "Boğaz Stadyumu", 41000, "#1a3a8a", "#c9a227", 77, "TUR", "europe"],
  ["pira", "Pireo Azul", "PIR", "El Pireo", "Puerto Olímpico", 33500, "#1a3a8a", "#ffffff", 76, "GRE", "europe"],
  ["olya", "Olympia Atenas", "OLA", "Atenas", "Estadio de la Acrópolis", 28000, "#c8102e", "#ffffff", 74, "GRE", "europe"],
  ["meta", "Metalúrgico del Este", "MTE", "Donetsk", "Forja Arena", 38000, "#e87722", "#111111", 78, "UKR", "europe"],
  ["dnrv", "Dinamo del Río", "DNR", "Kiev", "Estadio del Dniéper", 45000, "#1a3a8a", "#ffffff", 76, "UKR", "europe"],
  ["hrad", "Hradčany FK", "HRD", "Praga", "Hrad Stadion", 22000, "#8b1a1a", "#ffffff", 75, "CZE", "europe"],
  ["morv", "Morava Brno", "MRV", "Brno", "Morava Park", 18000, "#1d7a3a", "#ffffff", 71, "CZE", "europe"],
  ["lemn", "Léman FC", "LEM", "Ginebra", "Stade du Lac", 25000, "#c8102e", "#ffffff", 74, "SUI", "europe"],
  ["yngb", "Alpes United", "ALU", "Berna", "Wankdorf Ghost", 31000, "#c9a227", "#111111", 76, "SUI", "europe"],
  ["sava", "Sava Zagreb", "SAV", "Zagreb", "Sava Park", 28000, "#1a3a8a", "#ffffff", 75, "CRO", "europe"],
  ["adri", "Adriático Split", "ADR", "Split", "Poljud Nuevo", 33000, "#ffffff", "#1a3a8a", 72, "CRO", "europe"],
  ["dnst", "Estrella del Danubio", "EDD", "Belgrado", "Marakana Norte", 49000, "#c8102e", "#ffffff", 76, "SRB", "europe"],
  ["ores", "Øresund BK", "ORE", "Copenhague", "Øresund Park", 36000, "#ffffff", "#1a3a8a", 75, "DEN", "europe"],
  ["fjrd", "Fjord FK", "FJD", "Bodø", "Fjord Arena", 12000, "#c9a227", "#111111", 73, "NOR", "europe"],
  ["mlms", "Malmstrand IF", "MLS", "Malmö", "Öresundsvallen", 24000, "#1a3a8a", "#ffffff", 72, "SWE", "europe"],
  ["stea", "Steaua del Sur", "STE", "Bucarest", "Ghencea Nuevo", 31000, "#c8102e", "#1a3a8a", 74, "ROU", "europe"],
  ["wisl", "Wisła Capital", "WIS", "Varsovia", "Vístula Stadion", 27000, "#c8102e", "#ffffff", 73, "POL", "europe"],
  ["pest", "Pest Ferenc", "PES", "Budapest", "Danubio Park", 22000, "#1d7a3a", "#ffffff", 72, "HUN", "europe"],
  ["qara", "Qara FK", "QAR", "Bakú", "Caspio Arena", 30000, "#111111", "#c9a227", 71, "AZE", "europe"],
  ["amat", "Amathus FC", "AMA", "Limassol", "Amathus Ground", 13000, "#1a3a8a", "#ffffff", 70, "CYP", "europe"],
  ["mcco", "Costa Maccabi", "MCC", "Tel Aviv", "Costa Stadium", 24000, "#c9a227", "#1a3a8a", 71, "ISR", "europe"],
];

/**
 * Clubes REALES de Sudamérica (fuera de Argentina, cuyos 24 clubes viven en la Liga Profesional).
 * No son seleccionables ni comerciables (sus plantillas son de relleno), pero juegan Libertadores y Sudamericana
 * con su nombre, ciudad y estadio verdaderos. Los ids llevan prefijo de país para no chocar con otros clubes.
 */
const CONMEBOL_SEEDS: Seed[] = [
  // ── Brasil ──
  ["brfla", "Flamengo", "FLA", "Río de Janeiro", "Maracanã", 78838, "#c8102e", "#111111", 86, "BRA", "conmebol"],
  ["brpal", "Palmeiras", "PAL", "São Paulo", "Allianz Parque", 43713, "#006437", "#ffffff", 86, "BRA", "conmebol"],
  ["brbot", "Botafogo", "BOT", "Río de Janeiro", "Nilton Santos", 46931, "#111111", "#ffffff", 82, "BRA", "conmebol"],
  ["brflu", "Fluminense", "FLU", "Río de Janeiro", "Maracanã", 78838, "#8b1a3a", "#1d7a3a", 80, "BRA", "conmebol"],
  ["brcor", "Corinthians", "COR", "São Paulo", "Neo Química Arena", 49205, "#111111", "#ffffff", 80, "BRA", "conmebol"],
  ["brsao", "São Paulo", "SAO", "São Paulo", "Morumbi", 66795, "#c8102e", "#111111", 80, "BRA", "conmebol"],
  ["bratm", "Atlético Mineiro", "CAM", "Belo Horizonte", "Arena MRV", 46000, "#111111", "#ffffff", 80, "BRA", "conmebol"],
  ["brcru", "Cruzeiro", "CRU", "Belo Horizonte", "Mineirão", 61846, "#1a3a8a", "#ffffff", 78, "BRA", "conmebol"],
  ["brgre", "Grêmio", "GRE", "Porto Alegre", "Arena do Grêmio", 55662, "#2a7fc1", "#111111", 79, "BRA", "conmebol"],
  ["brint", "Internacional", "INT", "Porto Alegre", "Beira-Rio", 50128, "#c8102e", "#ffffff", 79, "BRA", "conmebol"],
  ["brbah", "Bahia", "BAH", "Salvador", "Arena Fonte Nova", 47907, "#1a3a8a", "#c8102e", 77, "BRA", "conmebol"],
  ["brsan", "Santos", "SAN", "Santos", "Vila Belmiro", 16068, "#ffffff", "#111111", 76, "BRA", "conmebol"],
  ["brvas", "Vasco da Gama", "VAS", "Río de Janeiro", "São Januário", 21880, "#111111", "#ffffff", 76, "BRA", "conmebol"],
  ["brath", "Athletico Paranaense", "CAP", "Curitiba", "Ligga Arena", 42372, "#c8102e", "#111111", 76, "BRA", "conmebol"],
  ["brfor", "Fortaleza", "FOR", "Fortaleza", "Arena Castelão", 63903, "#1a3a8a", "#c8102e", 75, "BRA", "conmebol"],
  ["brbra", "Red Bull Bragantino", "RBB", "Bragança Paulista", "Nabi Abi Chedid", 17128, "#ffffff", "#c8102e", 72, "BRA", "conmebol"],
  ["brvit", "Vitória", "VIT", "Salvador", "Barradão", 30618, "#c8102e", "#111111", 70, "BRA", "conmebol"],
  // ── Uruguay ──
  ["uypen", "Peñarol", "PEN", "Montevideo", "Campeón del Siglo", 40000, "#f5d000", "#111111", 78, "URU", "conmebol"],
  ["uynac", "Nacional", "NAC", "Montevideo", "Gran Parque Central", 34000, "#ffffff", "#1a3a8a", 78, "URU", "conmebol"],
  ["uydef", "Defensor Sporting", "DEF", "Montevideo", "Luis Franzini", 18000, "#6b1d8a", "#ffffff", 68, "URU", "conmebol"],
  ["uylpl", "Liverpool Montevideo", "LIV", "Montevideo", "Belvedere", 10000, "#1a3a8a", "#111111", 66, "URU", "conmebol"],
  // ── Colombia ──
  ["conal", "Atlético Nacional", "ANA", "Medellín", "Atanasio Girardot", 44000, "#1d7a3a", "#ffffff", 75, "COL", "conmebol"],
  ["comil", "Millonarios", "MIL", "Bogotá", "El Campín", 36343, "#1a3a8a", "#ffffff", 72, "COL", "conmebol"],
  ["cojun", "Junior de Barranquilla", "JUN", "Barranquilla", "Metropolitano Roberto Meléndez", 46692, "#c8102e", "#ffffff", 72, "COL", "conmebol"],
  ["coame", "América de Cali", "AME", "Cali", "Pascual Guerrero", 35405, "#c8102e", "#ffffff", 70, "COL", "conmebol"],
  ["codim", "Independiente Medellín", "DIM", "Medellín", "Atanasio Girardot", 44000, "#c8102e", "#1a3a8a", 70, "COL", "conmebol"],
  ["cotol", "Deportes Tolima", "TOL", "Ibagué", "Manuel Murillo Toro", 28100, "#8b1a3a", "#f5d000", 70, "COL", "conmebol"],
  ["cosfe", "Independiente Santa Fe", "ISF", "Bogotá", "El Campín", 36343, "#c8102e", "#ffffff", 68, "COL", "conmebol"],
  // ── Chile ──
  ["clcol", "Colo-Colo", "CCO", "Santiago", "Monumental David Arellano", 47347, "#ffffff", "#111111", 74, "CHI", "conmebol"],
  ["cluch", "Universidad de Chile", "UCH", "Santiago", "Estadio Nacional", 48665, "#1a3a8a", "#c8102e", 72, "CHI", "conmebol"],
  ["clcat", "Universidad Católica", "UCA", "Santiago", "San Carlos de Apoquindo", 14118, "#ffffff", "#1a3a8a", 70, "CHI", "conmebol"],
  ["clpal", "Palestino", "PLT", "Santiago", "Municipal de La Cisterna", 12000, "#1d7a3a", "#c8102e", 64, "CHI", "conmebol"],
  ["clcoq", "Coquimbo Unido", "CQU", "Coquimbo", "Francisco Sánchez Rumoroso", 18750, "#f5d000", "#111111", 64, "CHI", "conmebol"],
  ["clcob", "Cobresal", "CBR", "El Salvador", "El Cobre", 12000, "#e87722", "#ffffff", 62, "CHI", "conmebol"],
  // ── Paraguay ──
  ["pyolm", "Olimpia", "OLI", "Asunción", "Manuel Ferreira", 25000, "#ffffff", "#111111", 72, "PAR", "conmebol"],
  ["pycer", "Cerro Porteño", "CER", "Asunción", "La Nueva Olla", 45000, "#1a3a8a", "#c8102e", 72, "PAR", "conmebol"],
  ["pylib", "Libertad", "LIB", "Asunción", "Dr. Nicolás Leoz", 10500, "#111111", "#ffffff", 70, "PAR", "conmebol"],
  ["pynac", "Nacional de Asunción", "NAS", "Asunción", "Arsenio Erico", 4500, "#ffffff", "#c8102e", 64, "PAR", "conmebol"],
  ["pygua", "Guaraní", "GUA", "Asunción", "Rogelio Livieres", 8000, "#f5d000", "#111111", 64, "PAR", "conmebol"],
  // ── Ecuador ──
  ["eclde", "LDU Quito", "LDU", "Quito", "Rodrigo Paz Delgado", 41575, "#ffffff", "#1a3a8a", 74, "ECU", "conmebol"],
  ["ecidv", "Independiente del Valle", "IDV", "Sangolquí", "Banco Guayaquil", 12000, "#1a3a8a", "#111111", 74, "ECU", "conmebol"],
  ["ecbar", "Barcelona SC", "BSC", "Guayaquil", "Monumental Banco Pichincha", 57267, "#f5d000", "#111111", 72, "ECU", "conmebol"],
  ["ecemm", "Emelec", "EME", "Guayaquil", "George Capwell", 40000, "#1a3a8a", "#ffffff", 68, "ECU", "conmebol"],
  ["ecauc", "Aucas", "AUC", "Quito", "Gonzalo Pozo Ripalda", 18799, "#f5d000", "#c8102e", 62, "ECU", "conmebol"],
  // ── Perú ──
  ["peuni", "Universitario", "UNI", "Lima", "Monumental", 80093, "#f5e6b0", "#8b1a3a", 70, "PER", "conmebol"],
  ["peali", "Alianza Lima", "ALI", "Lima", "Alejandro Villanueva", 35938, "#1a3a8a", "#ffffff", 70, "PER", "conmebol"],
  ["pecri", "Sporting Cristal", "CRI", "Lima", "Alberto Gallardo", 11600, "#6ec4e8", "#ffffff", 68, "PER", "conmebol"],
  ["pemel", "FBC Melgar", "MEL", "Arequipa", "Monumental de la UNSA", 40370, "#c8102e", "#111111", 64, "PER", "conmebol"],
  ["pecie", "Cienciano", "CIE", "Cusco", "Garcilaso de la Vega", 42056, "#c8102e", "#ffffff", 62, "PER", "conmebol"],
  // ── Bolivia ──
  ["bobol", "Bolívar", "BLV", "La Paz", "Hernando Siles", 41143, "#6ec4e8", "#ffffff", 68, "BOL", "conmebol"],
  ["bostr", "The Strongest", "STR", "La Paz", "Rafael Mendoza", 25000, "#f5d000", "#111111", 68, "BOL", "conmebol"],
  ["boalw", "Always Ready", "ALR", "El Alto", "Municipal de El Alto", 25000, "#c8102e", "#ffffff", 62, "BOL", "conmebol"],
  ["bobla", "Blooming", "BLO", "Santa Cruz", "Ramón Tahuichi Aguilera", 38000, "#1a3a8a", "#ffffff", 60, "BOL", "conmebol"],
  ["bonac", "Nacional Potosí", "NPO", "Potosí", "Víctor Agustín Ugarte", 32105, "#c8102e", "#1a3a8a", 58, "BOL", "conmebol"],
  // ── Venezuela ──
  ["vecar", "Carabobo", "CRB", "Valencia", "Misael Delgado", 10000, "#c8102e", "#ffffff", 60, "VEN", "conmebol"],
  ["vetac", "Deportivo Táchira", "TAC", "San Cristóbal", "Pueblo Nuevo", 38755, "#f5d000", "#111111", 60, "VEN", "conmebol"],
  ["vecac", "Caracas FC", "CCS", "Caracas", "Olímpico de la UCV", 24000, "#c8102e", "#ffffff", 60, "VEN", "conmebol"],
  ["vemon", "Monagas", "MON", "Maturín", "Monumental de Maturín", 51796, "#f5d000", "#111111", 56, "VEN", "conmebol"],
];

export const GHOST_CLUBS: Club[] = [...EUROPE_SEEDS, ...CONMEBOL_SEEDS].map(ghost);

export const EUROPE_GHOST_IDS = EUROPE_SEEDS.map((s) => s[0]);
export const CONMEBOL_GHOST_IDS = CONMEBOL_SEEDS.map((s) => s[0]);
