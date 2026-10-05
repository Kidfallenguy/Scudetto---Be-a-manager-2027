import type { SeasonAward } from "./awards";
import type { CareerSeasonRecord } from "./career";

export type Pos =
  | "GK"
  | "RB"
  | "CB"
  | "LB"
  | "CDM"
  | "CM"
  | "CAM"
  | "RW"
  | "LW"
  | "ST";

export type PosGroup = "GK" | "DEF" | "MID" | "FWD";

export type Competition =
  | "serieA"
  | "premier"
  | "laliga"
  | "bundesliga"
  | "ligue1"
  | "argentina"
  | "coppa"
  | "ucl"
  | "uel"
  | "uecl"
  | "libertadores"
  | "sudamericana"
  | "supercoppa"
  | "trofeo"
  | "mundial";

export type ClubId = string;

export type LeagueKind =
  | "serieA"
  | "premier"
  | "laliga"
  | "bundesliga"
  | "ligue1"
  | "argentina"
  | "europe"
  | "conmebol";

export type NumberColor = "auto" | "white" | "black" | "gold";

export interface Club {
  id: ClubId;
  name: string;
  short: string;
  city: string;
  stadium: string;
  capacity: number;
  color: string;
  color2: string;
  league: LeagueKind;
  prestige: number;
  featured?: boolean;
  crest: string;
  /** Not selectable; players cannot be bought. Used to fill continental cups. */
  ghost?: boolean;
  country?: string;
}

export interface Attrs {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

/** Estadísticas propias de los porteros (estilo FC): estirada, manejo, saque, reflejos, velocidad, colocación. */
export interface GkAttrs {
  div: number;
  han: number;
  kic: number;
  ref: number;
  spe: number;
  pos: number;
}

export type ContractRole = "starter" | "rotation" | "backup" | "prospect";

/** Condiciones pactadas en un contrato. Los extras en 0 / null no forman parte del acuerdo. */
export interface ContractTerms {
  /** Salario semanal. */
  wage: number;
  /** Años de contrato (1-5). */
  years: number;
  /** Prima de firma, se paga una sola vez. */
  signingBonus: number;
  /** Cláusula de rescisión; null = sin cláusula. */
  releaseClause: number | null;
  /** Rol prometido; null = sin promesa. */
  role: ContractRole | null;
  goalBonus: number;
  assistBonus: number;
  appBonus: number;
  titleBonus: number;
  /** % de una futura reventa que se queda el club vendedor (0-30). */
  sellOnPct: number;
}

export interface Player {
  id: string;
  name: string;
  nat: string;
  age: number;
  pos: Pos;
  ovr: number;
  pot: number;
  clubId: ClubId;
  value: number;
  wage: number;
  contract: number;
  form: number;
  fitness: number;
  morale: number;
  goals: number;
  assists: number;
  apps: number;
  careerGoals: number;
  careerAssists: number;
  careerApps: number;
  seasonStartOvr: number;
  injured: number;
  suspended: number;
  number: number;
  yellows: number;
  listed: boolean;
  listedForLoan: boolean;
  loanFrom: ClubId | null;
  loanSeasons: number;
  hiddenGem: boolean;
  attrs: Attrs;
  /** Solo porteros: sus estadísticas específicas. Su GRL sale de ellas. */
  gk?: GkAttrs;
  locked?: boolean;
  /** El usuario bloqueó las ofertas por este jugador. */
  noOffers?: boolean;
  /** Condiciones del contrato vigente, si se negoció (cláusula, rol, bonus). */
  terms?: ContractTerms;
  /** Cláusula de rescisión inicial (0 = sin cláusula). Con `terms` manda `terms.releaseClause`. */
  clause?: number;
  /** Club que cobra un % si este jugador se vuelve a vender. */
  sellOn?: { clubId: ClubId; pct: number } | null;
  /** Ausencia por un suceso (enfermedad, motivos personales, disciplina...). Mientras dure, el jugador no está disponible. */
  absence?: PlayerAbsence;
  /** Relación del jugador con el club y con el resto del plantel (0-100; sin dato = normal). */
  bond?: PlayerBond;
  /** Cambio temporal del valor de mercado (un escándalo, un buen momento...). */
  valueMod?: { pct: number; games: number };
}

/** Por qué un jugador falta sin estar lesionado ni sancionado. */
export type AbsenceKind = "illness" | "personal" | "discipline" | "other";

export interface PlayerAbsence {
  /** Partidos del club que todavía se pierde (al llegar a 0 vuelve solo). */
  games: number;
  kind: AbsenceKind;
  /** Motivo que se muestra al usuario. */
  reason: string;
}

export interface PlayerBond {
  /** Relación con el club y la dirigencia. */
  club: number;
  /** Relación con sus compañeros. */
  squad: number;
}

export interface Standing {
  clubId: ClubId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
  form: Array<"W" | "D" | "L">;
}

export type MatchEventType =
  | "goal"
  | "shot"
  | "save"
  | "yellow"
  | "red"
  | "injury"
  | "sub"
  | "kickoff"
  | "ht"
  | "ft"
  | "chance";

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  clubId?: ClubId;
  playerId?: string;
  /** Solo en cambios: el jugador que sale (`playerId` es el que entra). */
  outPlayerId?: string;
  text: string;
}

export interface Fixture {
  id: string;
  competition: Competition;
  round: number;
  homeId: ClubId;
  awayId: ClubId;
  played: boolean;
  homeGoals?: number;
  awayGoals?: number;
  leg?: 1 | 2;
  tieId?: string;
}

export interface CalendarSlot {
  id: string;
  competition: Competition;
  round: number;
  title: string;
  fixtures: string[];
  date?: string;
  leg?: 1 | 2;
  /** Equipos con bye que entran en esta ronda (Copa Argentina, 24 equipos). */
  byes?: ClubId[];
}

export type FormationId = "433" | "4231" | "352" | "442" | "343";

export type Mentality = "defensive" | "balanced" | "attacking";

export interface FormationSlot {
  x: number;
  y: number;
  pos: Pos[];
  label: string;
}

export interface Tactics {
  formation: FormationId;
  mentality: Mentality;
  lineup: string[];
  /** Suplentes convocados para el partido (hasta BENCH_SIZE). Pueden entrar a lo largo del encuentro. */
  bench: string[];
  numberColor: NumberColor;
}

export interface NewsItem {
  id: string;
  week: number;
  title: string;
  body: string;
  tone: "neutral" | "good" | "bad";
}

export interface MatchStats {
  shots: number;
  onTarget: number;
  possession: number;
  corners: number;
  fouls: number;
  yellows: number;
  reds: number;
}

export interface MatchResult {
  fixtureId: string;
  homeId: ClubId;
  awayId: ClubId;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  homeStats: MatchStats;
  awayStats: MatchStats;
  homeLineup: string[];
  awayLineup: string[];
  /** Suplentes convocados de cada lado (partidas viejas no lo traen). */
  homeBench?: string[];
  awayBench?: string[];
  /** Suplentes que llegaron a entrar. */
  homeSubsIn?: string[];
  awaySubsIn?: string[];
  homeGrl: number;
  awayGrl: number;
}

export type Screen =
  | "boot"
  | "slots"
  | "select"
  | "office"
  | "squad"
  | "tactics"
  | "table"
  | "market"
  | "train"
  | "academy"
  | "cabinet"
  | "career"
  | "board"
  | "sponsors"
  | "calendar"
  | "match"
  | "result"
  | "preview"
  | "awards"
  | "season-end";

/** Cualquier estadística entrenable: de campo (pac...phy) o de portero (div...pos). */
export type TrainStat = keyof Attrs | keyof GkAttrs;

/** Nivel de entrenamiento: define precio, cupos y qué tanto puede mejorar el jugador. */
export type TrainingTier = "progressive" | "intensive" | "elite";

/** Un jugador dentro de un plan de entrenamiento. */
export interface TrainingAssignment {
  playerId: string;
}

/** Ciclo de entrenamiento en curso (uno por nivel como máximo): dura exactamente 6 meses de tiempo de juego. */
export interface TrainingPlan {
  id: string;
  tier: TrainingTier;
  /** Plata pagada al arrancar (0 en partidas viejas migradas). */
  cost: number;
  assignments: TrainingAssignment[];
  /** Fecha (ISO) en la que arrancó. */
  startDate: string;
  /** Días de juego transcurridos. */
  elapsedDays: number;
  /** Días totales del ciclo (6 meses de calendario desde la fecha de inicio). */
  totalDays: number;
}

export interface TrainingStatChange {
  stat: TrainStat;
  before: number;
  after: number;
  /** Estadística que el usuario eligió entrenar (el resto son efectos secundarios, p. ej. por edad). */
  trained: boolean;
}

export interface TrainingPlayerResult {
  playerId: string;
  name: string;
  pos: Pos;
  age: number;
  ovrBefore: number;
  ovrAfter: number;
  potBefore: number;
  potAfter: number;
  brokePotential: boolean;
  changes: TrainingStatChange[];
  /** Ya no estaba en el club al terminar el ciclo (vendido, retirado...). */
  left?: boolean;
}

export interface TrainingReport {
  id: string;
  tier: TrainingTier;
  cost: number;
  season: number;
  endedWeek: number;
  results: TrainingPlayerResult[];
  /** El usuario ya vio el cartel. */
  seen: boolean;
}

export interface YouthPlayer {
  id: string;
  name: string;
  nat: string;
  age: number;
  pos: Pos;
  ovr: number;
  pot: number;
  weeksIn: number;
  fee: number;
}

export interface ScoutMission {
  id: string;
  countryId: string;
  countryName: string;
  nat: string;
  weeksLeft: number;
  cost: number;
  preferredPos: Pos | "ANY";
  tier: 1 | 2 | 3;
}

export interface HonourCounts {
  scudetto: number;
  coppa: number;
  supercoppa: number;
  ucl: number;
  uel: number;
  uecl: number;
  libertadores: number;
  sudamericana: number;
  recopa: number;
  trofeo: number;
  mundial: number;
}

export interface CareerTrophy {
  id: string;
  kind: keyof HonourCounts;
  season: number;
  label: string;
  prize: number;
}

export interface KnockoutTie {
  id: string;
  round: number;
  homeId: ClubId;
  awayId: ClubId;
  winnerId?: ClubId;
}

export type OfferKind = "buy" | "loan";

export interface TransferOffer {
  id: string;
  kind: OfferKind;
  playerId: string;
  fromClubId: ClubId;
  toClubId: ClubId;
  fee: number;
  loanSeasons: number;
  week: number;
  unsolicited: boolean;
}

export interface LoanRecord {
  playerId: string;
  fromClubId: ClubId;
  toClubId: ClubId;
  seasonsLeft: number;
  fee: number;
}

/** Finanzas de un club controlado por la IA. */
export interface ClubFinance {
  /** Caja disponible para traspasos. */
  budget: number;
  /** Tope de masa salarial semanal. */
  wageCap: number;
}

/**
 * Tipos de beneficio que puede traer un patrocinador:
 * - fixed: dinero fijo extra por temporada.
 * - objectives: dinero por cada objetivo de la dirigencia cumplido.
 * - matchday: % extra sobre los ingresos por partido.
 * - fans: seguidores extra para el club.
 * - prestige: puntos extra de prestigio del club.
 * - titles: dinero por cada título ganado.
 * - qualification: dinero por clasificar a una competición continental.
 */
export type SponsorBenefitKind =
  | "fixed"
  | "objectives"
  | "matchday"
  | "fans"
  | "prestige"
  | "titles"
  | "qualification";

export interface SponsorBenefit {
  kind: SponsorBenefitKind;
  /** Unidad según el tipo: € (fixed, objectives, titles, qualification), % (matchday), seguidores (fans), puntos (prestige). */
  value: number;
}

/** Nivel de una marca: define cuánto paga, qué prestigio tiene y qué clubes puede conseguirla. */
export type SponsorTier = "local" | "regional" | "nacional" | "internacional" | "elite";

/** Contrato de patrocinio de un club. */
export interface Sponsor {
  id: string;
  /** Marca del catálogo (brands.ts). Ausente en contratos de partidas viejas. */
  brandId?: string;
  /** Nivel de la marca. Ausente en contratos de partidas viejas. */
  tier?: SponsorTier;
  name: string;
  /** Dinero base que paga por temporada. */
  payment: number;
  /** Prestigio del patrocinador (0-100). */
  prestige: number;
  benefits: SponsorBenefit[];
  /** Duración total del contrato, en temporadas. */
  duration: number;
  /** Temporadas que le quedan al contrato. Con 0 el patrocinador deja de estar activo. */
  seasonsLeft: number;
  /** Día de juego (número de día) en que se firmó. Ausente en contratos de partidas viejas. */
  signedDay?: number;
}

/** Propuesta de patrocinio todavía sin firmar. */
export type SponsorOffer = Omit<Sponsor, "seasonsLeft" | "signedDay"> & {
  /** La marca ya patrocinaba al club y su contrato terminó: propone seguir. */
  renewal?: boolean;
};

/** Cómo le fue al club en una temporada cerrada. Alimenta el crecimiento comercial. */
export interface SponsorSeasonRecord {
  season: number;
  /** Puesto final en la liga (1 = campeón). */
  place: number;
  teams: number;
  /** Puntos por partido. */
  ppg: number;
  /** Diferencia de gol por partido. */
  gdpg: number;
  /** Atractivo comercial de esa temporada sin el efecto de crecimiento. */
  base: number;
}

export type TransferKind = "sale" | "loan" | "free" | "clause" | "release";

/** Una operación del historial de mercado. "FA" = sin club. */
export interface TransferRecord {
  id: string;
  season: number;
  week: number;
  playerId: string;
  name: string;
  pos: Pos;
  ovr: number;
  fromId: ClubId;
  toId: ClubId;
  kind: TransferKind;
  fee: number;
  /** Implica al club del usuario. */
  user?: boolean;
}

export interface GamePopup {
  id: string;
  kind: "trophy" | "event" | "offer" | "info";
  title: string;
  body: string;
  tone: "good" | "bad" | "neutral";
  prize?: number;
  offerId?: string;
  /** Sucesos con decisión: opciones a elegir (el popup no se cierra hasta elegir una). */
  choices?: EventChoice[];
  /** Suceso que originó el popup (para resolver la decisión). */
  eventId?: string;
  /** Jugador afectado por el suceso, si es específico de un jugador. */
  eventPlayerId?: string;
  /** Juvenil de cantera afectado, si el suceso es de academia. */
  eventYouthId?: string;
  /** Consecuencias del suceso, ya redactadas ("Ánimo de Rossi −8", "Fuera 3 partidos"...). */
  effects?: string[];
  /** En el aviso con el resultado de una decisión: la opción que eligió el usuario. */
  decision?: string;
}

/** Categorías de sucesos inesperados. */
export type EventCategory = "positive" | "negative" | "neutral" | "decision" | "player";

/** Con qué parte del juego se relaciona el suceso. */
export type EventTopic = "player" | "club" | "match" | "economy" | "season";

/** Cuándo puede aparecer: antes del partido del usuario, entre partidos, o en ambos momentos. */
export type EventTiming = "pre" | "between" | "any";

export interface EventChoice {
  id: string;
  label: string;
  hint?: string;
  /** Tipo de postura (pagar, castigar, apoyar...). Ver DecisionStance en event-decisions.ts. */
  stance?: string;
  /** Dinero que cuesta elegirla (se descuenta al resolver). */
  cost?: number;
  /** Si no se puede elegir ahora (por ejemplo, falta caja). */
  disabled?: boolean;
  /** Motivo por el que está deshabilitada. */
  reason?: string;
}

export interface EventHistoryEntry {
  id: string;
  category: EventCategory;
  tone: "good" | "bad" | "neutral";
  /** Ventana (partido del usuario) en la que salió. */
  window: number;
}

/** Registro de un jugador que salió del plantel masculino por un suceso (no es venta, cesión ni retiro). */
export interface SquadDeparture {
  playerId: string;
  name: string;
  pos: Pos;
  ovr: number;
  age: number;
  /** Suceso que originó la salida. */
  eventId: string;
  season: number;
  week: number;
  /** Dinero que recibió el club por la salida. */
  compensation: number;
}

/** Control de frecuencia de los sucesos. Una "ventana" es el tramo previo a cada partido del usuario. */
export interface EventState {
  /** Partidos del usuario ya jugados (identifica la ventana actual). */
  matchIndex: number;
  /** Ventana en la que salió el último suceso (máximo 1 por ventana). */
  lastEventWindow: number;
  /** Ventana en la que ya se hizo la tirada previa al partido (no se repite al volver a la pantalla). */
  lastRolledWindow: number;
  /** Último partido (matchIndex) en que salió cada suceso. */
  history: Record<string, number>;
  /** Último partido (matchIndex) en que cada jugador fue protagonista de un suceso. */
  playerHistory: Record<string, number>;
  /** Últimos sucesos (el más reciente primero). */
  recent: EventHistoryEntry[];
  /** Temporada a la que corresponde seasonCount. */
  seasonKey: number;
  /** Sucesos que salieron en la temporada en curso. */
  seasonCount: number;
  /** Cambios temporales en el rendimiento del equipo (preparación, ambiente) para los próximos partidos. */
  modifiers: TeamModifier[];
  /** Puntos de prestigio que los sucesos sumaron o restaron al club (con tope). */
  prestige: number;
  /** Jugadores que salieron del plantel masculino por un suceso (registro permanente). */
  departures?: SquadDeparture[];
}

/** Efecto temporal sobre el equipo del usuario: suma o resta puntos de GRL de equipo durante unos partidos. */
export interface TeamModifier {
  id: string;
  label: string;
  /** Puntos de GRL de equipo (puede ser negativo). */
  rating: number;
  /** Partidos del usuario que le quedan. */
  games: number;
}

export interface SeasonChampions {
  scudetto: ClubId | null;
  coppa: ClubId | null;
  ucl: ClubId | null;
  uel: ClubId | null;
  uecl: ClubId | null;
  libertadores: ClubId | null;
  sudamericana: ClubId | null;
  coppaRunnerUp: ClubId | null;
}

export type PlayableLeagueId =
  | "serieA"
  | "premier"
  | "laliga"
  | "bundesliga"
  | "ligue1"
  | "argentina";

export type LeagueTables = Record<PlayableLeagueId, Standing[]>;

/** Un objetivo concreto que la dirigencia fija al inicio de la temporada. */
export interface BoardGoal {
  id: string;
  /** league = puesto final en la liga; cup = llegar a una ronda de una copa. */
  kind: "league" | "cup";
  /** Liga local (kind league) o copa (kind cup). */
  comp: Competition;
  /** league: puesto máximo aceptable. cup: ronda que hay que alcanzar. */
  target: number;
  /** Importancia: 1 menor, 3 principal. Mueve cuánto sube/baja la confianza al resolverse. */
  weight: 1 | 2 | 3;
  label: string;
  state: "open" | "met" | "failed";
}

export interface BoardLogEntry {
  id: string;
  season: number;
  week: number;
  /** Cambio en la confianza (puede ser decimal). */
  delta: number;
  text: string;
}

/** Despido del manager: cuándo pasó, por qué y qué clubes lo llaman después. */
export interface BoardSacked {
  season: number;
  week: number;
  reason: string;
  /** Clubes que se animan a contratar a un DT recién despedido (se fijan al momento del despido). */
  offers: Array<{ clubId: ClubId; budget: number; objective: string }>;
}

export interface BoardState {
  season: number;
  /** 0-100. */
  confidence: number;
  /** Confianza con la que arrancó la temporada. */
  start: number;
  goals: BoardGoal[];
  lossStreak: number;
  winlessStreak: number;
  /** Nivel de aviso ya dado esta temporada (0 ninguno, 3 el último). */
  warned: 0 | 1 | 2 | 3;
  /** Partidos que le quedan de plazo tras la reunión de emergencia (0 = sin ultimátum activo). */
  ultimatum: number;
  /** Si no es null, la dirigencia despidió al manager. */
  sacked: BoardSacked | null;
  /** La temporada ya se cerró y se dio el balance. */
  closed: boolean;
  log: BoardLogEntry[];
  /** Efecto del último partido del usuario (para la pantalla de resultado). */
  last: { delta: number; lines: string[]; confidence: number } | null;
  /** Puntos de confianza ganados esta temporada por ganar clásicos (tienen tope). */
  classicPts?: number;
}

export interface GameSave {
  version: number;
  slot: number;
  seed: number;
  season: number;
  week: number;
  cursor: number;
  clubId: ClubId;
  screen: Screen;
  players: Player[];
  standings: Standing[];
  leagueTables: LeagueTables;
  uclStandings: Standing[];
  uelStandings: Standing[];
  ueclStandings: Standing[];
  libStandings: Standing[];
  fixtures: Fixture[];
  calendar: CalendarSlot[];
  tactics: Tactics;
  budget: number;
  news: NewsItem[];
  lastMatch: MatchResult | null;
  trophies: string[];
  honours: HonourCounts;
  careerTrophies: CareerTrophy[];
  seasonOver: boolean;
  pendingFixtureId: string | null;
  /** Ciclos de entrenamiento en curso (como máximo uno por nivel). */
  trainingPlans: TrainingPlan[];
  /** Informes de los últimos ciclos terminados (el más nuevo primero). */
  trainingReports: TrainingReport[];
  academy: YouthPlayer[];
  scouts: ScoutMission[];
  academyLevel: number;
  offers: TransferOffer[];
  loans: LoanRecord[];
  popups: GamePopup[];
  uclGroups: string[][];
  uelTeams: string[];
  ueclTeams: string[];
  libGroups: string[][];
  sudTeams: string[];
  lastChampions: SeasonChampions;
  /** Once guardado cuando se hace un cambio automático solo para un partido. */
  tempLineupBackup: string[] | null;
  /** Jugadores sin club: cualquiera puede ficharlos. */
  freeAgents: Player[];
  /** Presupuesto de fichajes y salarios de los clubes de la IA. */
  clubFinance: Record<ClubId, ClubFinance>;
  /** Historial de mercado (más reciente primero). */
  transferLog: TransferRecord[];
  /** Objetivos y confianza de la dirigencia (null hasta que hay club). */
  board: BoardState | null;
  /** Patrocinadores de cada club (máximo 3 activos por club). */
  clubSponsors: Record<ClubId, Sponsor[]>;
  /** Ofertas de patrocinio que el club recibió en su última búsqueda (se vacían al cambiar de temporada). */
  sponsorOffers: SponsorOffer[];
  /** Heredado de versiones anteriores (una búsqueda por temporada). Ya no se usa para las reglas. */
  sponsorSearchSeason: number | null;
  /** Día de juego hasta el que no se puede volver a buscar ni reemplazar patrocinadores (null = libre). */
  sponsorLockUntil: number | null;
  /** Resumen de las últimas temporadas cerradas (máx. 4, la más vieja primero). */
  sponsorHistory: SponsorSeasonRecord[];
  /** Historial de carrera del manager: una entrada por temporada dirigida ya archivada. */
  careerHistory: CareerSeasonRecord[];
  /** Premios individuales por temporada (Balón de Oro, Bota de Oro, etc.). Ver awards.ts. */
  awards: SeasonAward[];
  /** Frecuencia y memoria de los sucesos inesperados. Ver events.ts. */
  events: EventState;
}
