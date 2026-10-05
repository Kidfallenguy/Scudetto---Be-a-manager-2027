import type { SponsorTier } from "./types";

/* ------------------------------------------------------------------ */
/* Niveles                                                             */
/* ------------------------------------------------------------------ */

export const SPONSOR_TIERS: SponsorTier[] = ["local", "regional", "nacional", "internacional", "elite"];

export interface TierInfo {
  label: string;
  /** Descripción corta para mostrar en pantalla. */
  blurb: string;
  /** Multiplicador del pago base respecto de la escala del club. */
  payMult: number;
  /** Atractivo comercial mínimo del club para que una marca de este nivel le ofrezca contrato. */
  minAppeal: number;
  /** Atractivo máximo: los clubes muy grandes ya no reciben marcas de barrio. */
  maxAppeal: number;
  /** Atractivo del club al que más le interesa este nivel (centro del peso de selección). */
  idealAppeal: number;
  /** Puntos de prestigio que puede sumar el beneficio "prestige" en este nivel. */
  prestigeBenefit: [min: number, max: number];
  /** Duración posible del contrato, en temporadas. */
  duration: [min: number, max: number];
}

export const TIER_INFO: Record<SponsorTier, TierInfo> = {
  local: {
    label: "Local",
    blurb: "Comercios y empresas del barrio",
    payMult: 0.12,
    minAppeal: 0,
    maxAppeal: 80,
    idealAppeal: 62,
    prestigeBenefit: [1, 1],
    duration: [1, 3],
  },
  regional: {
    label: "Regional",
    blurb: "Empresas fuertes de la región",
    payMult: 0.3,
    minAppeal: 64,
    maxAppeal: 88,
    idealAppeal: 72,
    prestigeBenefit: [1, 2],
    duration: [1, 3],
  },
  nacional: {
    label: "Nacional",
    blurb: "Marcas conocidas en todo el país",
    payMult: 0.55,
    minAppeal: 70,
    maxAppeal: 100,
    idealAppeal: 78,
    prestigeBenefit: [1, 3],
    duration: [1, 4],
  },
  internacional: {
    label: "Internacional",
    blurb: "Multinacionales de alcance global",
    payMult: 0.85,
    minAppeal: 79,
    maxAppeal: 100,
    idealAppeal: 86,
    prestigeBenefit: [2, 4],
    duration: [2, 4],
  },
  elite: {
    label: "Élite",
    blurb: "Las marcas más poderosas del planeta",
    payMult: 1.3,
    minAppeal: 88,
    maxAppeal: 100,
    idealAppeal: 94,
    prestigeBenefit: [3, 5],
    duration: [2, 5],
  },
};

export function tierLabel(tier: SponsorTier): string {
  return TIER_INFO[tier].label;
}

/**
 * El "atractivo comercial" del club (0-100, ver sponsors.ts) parte de su prestigio y sube o baja
 * con fans, división, tabla, títulos, copas, rendimiento y crecimiento.
 * ¿Alcanza para que una marca de este nivel le ofrezca contrato?
 */
export function tierOpenTo(tier: SponsorTier, appeal: number): boolean {
  const t = TIER_INFO[tier];
  return appeal >= t.minAppeal && appeal <= t.maxAppeal;
}

/** Niveles que pueden golpear la puerta de un club con ese atractivo. */
export function openTiers(appeal: number): SponsorTier[] {
  return SPONSOR_TIERS.filter((t) => tierOpenTo(t, appeal));
}

/** El próximo nivel que el club todavía no desbloquea, y cuántos puntos de atractivo le faltan. */
export function nextTierToUnlock(appeal: number): { tier: SponsorTier; missing: number } | null {
  for (const tier of SPONSOR_TIERS) {
    const min = TIER_INFO[tier].minAppeal;
    if (appeal < min) return { tier, missing: Math.ceil(min - appeal) };
  }
  return null;
}

/**
 * Probabilidad de que una búsqueda incluya una marca Élite. Casi nula apenas se desbloquea
 * el nivel y alta solo para los gigantes.
 */
export function eliteChance(appeal: number): number {
  if (!tierOpenTo("elite", appeal)) return 0;
  return Math.min(0.9, Math.max(0.1, (appeal - 87) * 0.07));
}

/* ------------------------------------------------------------------ */
/* Catálogo de marcas                                                  */
/* ------------------------------------------------------------------ */

export interface Brand {
  id: string;
  name: string;
  tier: SponsorTier;
  sector: string;
  /** Prestigio de la marca (0-100). Se muestra en la oferta. */
  prestige: number;
  /** Qué tan generosa es dentro de su nivel (1 = promedio). Mueve el dinero que paga. */
  wealth: number;
  /** Marca inventada (no existe en la vida real). */
  fictional: boolean;
}

type BrandRow = [name: string, sector: string, prestige: number, wealth: number];

function slug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function build(tier: SponsorTier, fictional: boolean, rows: BrandRow[]): Brand[] {
  return rows.map(([name, sector, prestige, wealth]) => ({
    id: slug(name),
    name,
    tier,
    sector,
    prestige,
    wealth,
    fictional,
  }));
}

/* ---- Élite: las más difíciles; solo para clubes grandes ---- */
const ELITE: BrandRow[] = [
  ["Emirates", "Aerolíneas", 98, 1.3],
  ["Nike", "Indumentaria", 98, 1.3],
  ["Adidas", "Indumentaria", 96, 1.2],
  ["Coca-Cola", "Bebidas", 96, 1.2],
  ["Mercedes-Benz", "Automotriz", 95, 1.15],
  ["Samsung", "Tecnología", 94, 1.1],
  ["Visa", "Finanzas", 94, 1.1],
  ["Amazon", "Tecnología", 93, 1.15],
  ["Mastercard", "Finanzas", 93, 1.05],
  ["Qatar Airways", "Aerolíneas", 92, 1.25],
  ["PlayStation", "Videojuegos", 92, 1.0],
  ["Red Bull", "Bebidas", 91, 0.95],
  ["EA Sports", "Videojuegos", 90, 0.95],
  ["Pepsi", "Bebidas", 90, 0.9],
  ["Heineken", "Bebidas", 88, 0.85],
];

/* ---- Internacional ---- */
const INTERNACIONAL: BrandRow[] = [
  ["Puma", "Indumentaria", 86, 1.15],
  ["Sony", "Tecnología", 85, 1.1],
  ["Santander", "Finanzas", 85, 1.1],
  ["Huawei", "Tecnología", 84, 1.1],
  ["Toyota", "Automotriz", 84, 1.05],
  ["Epic Games", "Videojuegos", 83, 0.95],
  ["Budweiser", "Bebidas", 82, 0.95],
  ["Etihad Airways", "Aerolíneas", 82, 1.2],
  ["Spotify", "Streaming", 82, 0.9],
  ["Hyundai", "Automotriz", 80, 0.95],
  ["Under Armour", "Indumentaria", 80, 0.9],
  ["Pirelli", "Neumáticos", 80, 0.95],
  ["New Balance", "Indumentaria", 79, 0.9],
  ["Gatorade", "Bebidas", 78, 0.85],
  ["Reebok", "Indumentaria", 78, 0.85],
  ["Ford", "Automotriz", 78, 0.9],
  ["Kia", "Automotriz", 77, 0.85],
  ["Lenovo", "Tecnología", 76, 0.85],
  ["Umbro", "Indumentaria", 74, 0.8],
  ["Kappa", "Indumentaria", 72, 0.8],
  ["Orbit Mobile", "Telecom", 76, 0.9],
  ["Global Bank Group", "Finanzas", 78, 1.0],
  ["Skyline Airways", "Aerolíneas", 75, 0.95],
  ["Titan Motors", "Automotriz", 74, 0.85],
];

/* ---- Nacional ---- */
const NACIONAL: BrandRow[] = [
  ["Mercado Libre", "E-commerce", 74, 1.15],
  ["YPF", "Energía", 72, 1.1],
  ["Quilmes", "Bebidas", 70, 1.0],
  ["Aerolíneas Argentinas", "Aerolíneas", 70, 1.05],
  ["Fernet Branca", "Bebidas", 68, 0.95],
  ["Arcor", "Alimentos", 68, 1.0],
  ["Banco Nación", "Finanzas", 68, 1.05],
  ["Personal", "Telecom", 66, 1.0],
  ["Movistar", "Telecom", 66, 1.0],
  ["Claro", "Telecom", 66, 1.0],
  ["Banco Galicia", "Finanzas", 66, 1.0],
  ["Carrefour", "Supermercados", 66, 0.95],
  ["Havanna", "Alimentos", 64, 0.9],
  ["Swiss Medical", "Salud", 64, 0.95],
  ["OSDE", "Salud", 64, 0.95],
  ["La Serenísima", "Alimentos", 64, 0.9],
  ["Topper", "Indumentaria", 62, 0.85],
  ["Naranja X", "Finanzas", 62, 0.9],
  ["Frávega", "Electrodomésticos", 62, 0.85],
  ["Lotto", "Indumentaria", 62, 0.8],
  ["Levité", "Bebidas", 60, 0.8],
  ["Coto", "Supermercados", 60, 0.85],
  ["Bagley", "Alimentos", 60, 0.8],
  ["Joma", "Indumentaria", 60, 0.75],
  ["Macron", "Indumentaria", 60, 0.75],
  ["Galeno", "Salud", 58, 0.8],
  ["Penalty", "Indumentaria", 58, 0.75],
  ["Hummel", "Indumentaria", 58, 0.75],
  ["Flybondi", "Aerolíneas", 56, 0.8],
  ["Musimundo", "Electrodomésticos", 56, 0.75],
  ["Kelme", "Indumentaria", 56, 0.7],
  ["Banco Federal", "Finanzas", 64, 0.95],
  ["Telecom Nexo", "Telecom", 62, 0.9],
  ["Seguros Austral", "Seguros", 60, 0.85],
  ["Gaseosas Fresca", "Bebidas", 58, 0.8],
  ["Motors Atlántica", "Automotriz", 58, 0.8],
  ["Hiper Mayorista Uno", "Supermercados", 56, 0.75],
];

/* ---- Regional ---- */
const REGIONAL: BrandRow[] = [
  ["Cerveza Salta", "Bebidas", 58, 1.0],
  ["Cerveza Santa Fe", "Bebidas", 56, 0.95],
  ["Cerveza Patagonia", "Bebidas", 56, 1.0],
  ["Bodega Norton", "Vinos", 56, 1.05],
  ["Ledesma", "Alimentos", 55, 1.0],
  ["Sancor", "Lácteos", 55, 0.95],
  ["La Anónima", "Supermercados", 54, 0.95],
  ["Yerba Taragüí", "Alimentos", 52, 0.85],
  ["Cunnington", "Bebidas", 48, 0.8],
  ["Banco del Litoral", "Finanzas", 54, 1.0],
  ["Supermercados Del Valle", "Supermercados", 50, 0.9],
  ["Cooperativa Agraria Pampa", "Agro", 50, 0.95],
  ["Lácteos Sierra Azul", "Lácteos", 49, 0.85],
  ["Constructora Andina", "Construcciones", 52, 1.05],
  ["Seguros Rioplatense", "Seguros", 52, 0.95],
  ["Transportes Cuyo", "Logística", 48, 0.85],
  ["Aguas Patagonia Sur", "Bebidas", 48, 0.8],
  ["Vinos del Piedemonte", "Vinos", 50, 0.9],
  ["Textil Norte", "Indumentaria", 46, 0.8],
  ["Energía del Plata", "Energía", 54, 1.0],
  ["Autos Pampa Motors", "Automotriz", 52, 0.95],
  ["Inmobiliaria Horizonte", "Inmobiliaria", 48, 0.85],
  ["Clínica Santa Rita", "Salud", 46, 0.8],
  ["Frigorífico Los Andes", "Alimentos", 47, 0.85],
  ["Agroinsumos El Surco", "Agro", 45, 0.8],
  ["Telefonía Cooperativa Sur", "Telecom", 44, 0.75],
  ["Molinos Río Dulce", "Alimentos", 46, 0.8],
  ["Hotelera Costa Azul", "Turismo", 47, 0.85],
];

/* ---- Local: marcas ficticias pequeñas ---- */
const LOCAL: BrandRow[] = [
  ["Heladería Tizi", "Gastronomía", 32, 1.0],
  ["Kiosco Don Pepe", "Comercio", 26, 0.8],
  ["Panadería La Espiga", "Gastronomía", 30, 0.95],
  ["Ferretería El Tornillo", "Comercio", 30, 0.95],
  ["Carnicería Los Hermanos", "Gastronomía", 29, 0.9],
  ["Verdulería Fresquita", "Comercio", 25, 0.75],
  ["Pizzería Napoli Sur", "Gastronomía", 33, 1.05],
  ["Gomería Rueda Libre", "Servicios", 27, 0.85],
  ["Farmacia San Jorge", "Salud", 36, 1.15],
  ["Taller Mecánico Rodríguez", "Servicios", 28, 0.9],
  ["Lavadero Burbujas", "Servicios", 24, 0.75],
  ["Óptica Mirada", "Salud", 34, 1.05],
  ["Pinturería Arco Iris", "Comercio", 27, 0.85],
  ["Librería El Cuaderno", "Comercio", 26, 0.8],
  ["Estudio Contable Ferrari", "Servicios", 35, 1.1],
  ["Peluquería Estilo 10", "Servicios", 28, 0.85],
  ["Distribuidora La Esquina", "Comercio", 31, 0.95],
  ["Cervecería Tres Cruces", "Gastronomía", 37, 1.1],
  ["Bar El Gol de Oro", "Gastronomía", 31, 0.95],
  ["Almacén Doña Rosa", "Comercio", 24, 0.75],
  ["Casa de Deportes El Pase", "Deportes", 38, 1.15],
  ["Electricidad Faro", "Servicios", 29, 0.9],
  ["Mueblería Pino Verde", "Comercio", 32, 1.0],
  ["Vivero El Jacarandá", "Comercio", 25, 0.75],
  ["Café Bonaparte", "Gastronomía", 33, 1.0],
  ["Rotisería El Fogón", "Gastronomía", 28, 0.85],
  ["Granja Santa Elena", "Alimentos", 30, 0.9],
  ["Lácteos Don Ramiro", "Alimentos", 31, 0.95],
  ["Transportes Rápido Sur", "Logística", 34, 1.05],
  ["Cooperativa Eléctrica Local", "Energía", 36, 1.1],
  ["Inmobiliaria Torres", "Inmobiliaria", 35, 1.1],
  ["Gimnasio Olimpo", "Deportes", 30, 0.9],
  ["Pastas Nonna Lucía", "Gastronomía", 29, 0.9],
  ["Escuela de Manejo Ruta 5", "Servicios", 25, 0.75],
  ["Remises La Estrella", "Servicios", 26, 0.8],
  ["Joyería El Brillante", "Comercio", 36, 1.15],
  ["Veterinaria Patitas", "Servicios", 27, 0.85],
  ["Barraca Santa Fe", "Construcciones", 33, 1.0],
  ["Sodería La Burbuja", "Bebidas", 28, 0.85],
  ["Heladería Frío Polar", "Gastronomía", 31, 0.95],
];

export const BRANDS: Brand[] = [
  ...build("elite", false, ELITE),
  ...build("internacional", false, INTERNACIONAL.slice(0, 20)),
  ...build("internacional", true, INTERNACIONAL.slice(20)),
  ...build("nacional", false, NACIONAL.slice(0, 31)),
  ...build("nacional", true, NACIONAL.slice(31)),
  ...build("regional", false, REGIONAL.slice(0, 9)),
  ...build("regional", true, REGIONAL.slice(9)),
  ...build("local", true, LOCAL),
];

const BRAND_BY_ID = new Map(BRANDS.map((b) => [b.id, b]));

export function brandById(id: string | undefined): Brand | undefined {
  return id ? BRAND_BY_ID.get(id) : undefined;
}

export function brandsOfTier(tier: SponsorTier): Brand[] {
  return BRANDS.filter((b) => b.tier === tier);
}

/** Marcas que podrían ofrecerle contrato a un club con ese atractivo (sin contar la chance de Élite). */
export function brandsOpenTo(appeal: number): Brand[] {
  return BRANDS.filter((b) => tierOpenTo(b.tier, appeal));
}
