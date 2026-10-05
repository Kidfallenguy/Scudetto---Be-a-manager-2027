import { ensureSeasonAwards } from "./awards";
import { nextBoard } from "./board";
import { ensureTerms } from "./contracts";
import { enforceSquadCaps, makeExpirySeller } from "./ai-market";
import { rolloverFinance } from "./finance";
import { processExpiries, trimFreeAgents } from "./free-agents";
import { clubById, emptyLeagueTables, emptyStanding, playableLeague } from "./clubs";
import { makeName } from "./names";
import { normalizePos, repairPositions } from "./positions";
import { seasonGrowth } from "./potential";
import { Rng } from "./rng";
import { statsFor } from "./squads";
import { rolloverSponsors, type QualificationComp } from "./sponsors";
import { pickBench, pickXi } from "./tactics";
import { OFFSEASON_DAYS, advanceTraining, trainingPopup } from "./training";
import { resolveLoans, spawnWonderkids } from "./transfers";
import { clamp, playerValue, playerWage, uid } from "./format";
import {
  assembleContinentals,
  buildSeasonSchedule,
  prizeForPlace,
  sortTable,
} from "./world";
import type { GameSave, Player } from "./types";

function usedNames(players: Player[]) {
  return new Set(players.map((p) => p.name));
}

function retireChance(p: Player, rng: Rng) {
  if (p.age >= 38) return true;
  if (p.age >= 37) return rng.chance(0.72);
  if (p.age >= 36) return rng.chance(0.4);
  if (p.age >= 35) return rng.chance(0.18);
  return false;
}

function makeRegen(retired: Player, rng: Rng, used: Set<string>): Player {
  const age = rng.int(16, 18);
  const ovr = rng.int(58, 68);
  const pot = clamp(Math.max(retired.pot - rng.int(0, 8), ovr + 8) + rng.int(-2, 6), ovr, 98);
  const club = clubById(retired.clubId);
  const name = makeName(rng, retired.nat, used);
  // Misma posición que el retirado; si la suya era inválida se deduce de sus atributos.
  const pos = normalizePos(retired.pos, undefined, retired);
  return {
    id: uid("rg"),
    name,
    nat: retired.nat,
    age,
    pos,
    ovr,
    pot,
    clubId: retired.clubId,
    value: playerValue(ovr, age, pot),
    wage: Math.round(playerWage(ovr, club.prestige) * 0.5),
    contract: 4,
    form: 0,
    fitness: 96,
    morale: 80,
    goals: 0,
    assists: 0,
    apps: 0,
    careerGoals: 0,
    careerAssists: 0,
    careerApps: 0,
    seasonStartOvr: ovr,
    injured: 0,
    yellows: 0,
    listed: false,
    listedForLoan: false,
    loanFrom: null,
    loanSeasons: 0,
    hiddenGem: false,
    ...statsFor(pos, ovr, rng),
    suspended: 0,
    number: rng.int(20, 39),
    locked: Boolean(club.ghost),
  };
}

export function evolveSeason(prev: GameSave): GameSave {
  const rng = new Rng(prev.seed + prev.season * 97 + 13);
  const league = clubById(prev.clubId).league;
  const userLeague = playableLeague(league);
  const table = sortTable(prev.leagueTables?.[userLeague] ?? prev.standings);
  const place = table.findIndex((r) => r.clubId === prev.clubId);
  const leaguePrize = prizeForPlace(place, league);

  // El verano también cuenta para un ciclo de entrenamiento en marcha: si termina, se aplica
  // antes de que los jugadores envejezcan.
  const trainingEndedInSummer = advanceTraining(
    prev,
    OFFSEASON_DAYS,
    new Rng(prev.seed + prev.season * 41 + 5),
    false,
  );

  const used = usedNames(prev.players);
  const nextPlayers: Player[] = [];
  const retired: Player[] = [];

  for (const p of prev.players) {
    const aged = seasonGrowth(p, rng);
    if (retireChance(aged, rng)) {
      retired.push(aged);
      continue;
    }
    nextPlayers.push(aged);
  }

  for (const r of retired) {
    const regen = makeRegen(r, rng, used);
    nextPlayers.push(regen);
  }

  const next: GameSave = {
    ...prev,
    players: nextPlayers,
    news: [],
  };

  if (retired.some((p) => p.clubId === prev.clubId || p.loanFrom === prev.clubId)) {
    const names = retired
      .filter((p) => p.clubId === prev.clubId || p.loanFrom === prev.clubId)
      .map((p) => p.name)
      .slice(0, 4);
    next.news.push({
      id: uid("n"),
      week: 0,
      tone: "neutral",
      title: "Retiros",
      body: `${names.join(", ")} cuelgan las botas. Nacen regenerados en la misma posición.`,
    });
  }

  resolveLoans(next);

  // Los agentes libres que nadie fichó envejecen; algunos se retiran.
  const agedFree: Player[] = [];
  for (const fa of prev.freeAgents ?? []) {
    const aged = seasonGrowth(fa, rng);
    aged.contract = 0;
    if (retireChance(aged, rng)) continue;
    agedFree.push(aged);
  }
  next.freeAgents = agedFree;

  // Contratos que vencen: el usuario los pierde si no renovó; la IA renueva o libera.
  processExpiries(next, rng, { sell: makeExpirySeller(next, rng) });
  // Las cesiones que vuelven pueden pasar el tope de 40: la IA suelta sobrantes.
  enforceSquadCaps(next);
  trimFreeAgents(next);
  // Nuevo año fiscal: ingresos frescos y masa salarial recalculada para cada club.
  rolloverFinance(next);
  next.players = next.players.map(ensureTerms);
  next.freeAgents = next.freeAgents.map(ensureTerms);
  // Red de seguridad: ningún jugador (ni libre) arranca la temporada sin posición válida.
  repairPositions(next.players);
  repairPositions(next.freeAgents);

  spawnWonderkids(next, rng, used);

  const assembled = assembleContinentals(prev.leagueTables, rng, prev.lastChampions.coppa);

  let supercoppa: [string, string] | null = null;
  let supercoppaFour: string[] | null = null;
  const scu = prev.lastChampions.scudetto ?? table[0]?.clubId ?? null;
  const cop = prev.lastChampions.coppa ?? table[1]?.clubId ?? null;
  const runner = prev.lastChampions.coppaRunnerUp ?? null;

  if (league === "argentina") {
    const ranked = table.map((r) => r.clubId);
    const used = new Set<string>();
    const four: string[] = [];
    for (const id of [cop, runner]) {
      if (id && !used.has(id)) {
        four.push(id);
        used.add(id);
      }
    }
    for (const id of ranked) {
      if (four.length >= 4) break;
      if (used.has(id)) continue;
      four.push(id);
      used.add(id);
    }
    if (four.length === 4) supercoppaFour = four;
  } else {
    if (scu && cop && scu !== cop) supercoppa = [scu, cop];
    else if (scu && table[1] && scu !== table[1].clubId) supercoppa = [scu, table[1].clubId];
  }

  let mundial: [string, string] | null = null;
  if (prev.lastChampions.ucl) {
    const opp =
      prev.lastChampions.libertadores && prev.lastChampions.libertadores !== prev.lastChampions.ucl
        ? prev.lastChampions.libertadores
        : prev.lastChampions.uel && prev.lastChampions.uel !== prev.lastChampions.ucl
          ? prev.lastChampions.uel
          : null;
    if (opp) mundial = [prev.lastChampions.ucl, opp];
  }

  const { fixtures, calendar } = buildSeasonSchedule({
    clubId: prev.clubId,
    seed: rng.int(1, 1_000_000_000),
    season: prev.season + 1,
    uclGroups: assembled.uclGroups,
    uelTeams: assembled.uelTeams,
    ueclTeams: assembled.ueclTeams,
    libGroups: assembled.libGroups,
    sudTeams: assembled.sudTeams,
    supercoppa,
    supercoppaFour,
    mundial,
  });

  const squad = next.players.filter((p) => p.clubId === prev.clubId);
  next.fixtures = fixtures;
  next.calendar = calendar;
  next.leagueTables = emptyLeagueTables();
  next.standings = next.leagueTables[userLeague];
  next.uclStandings = assembled.uclGroups.flat().map(emptyStanding);
  next.uelStandings = assembled.uelTeams.map(emptyStanding);
  next.ueclStandings = assembled.ueclTeams.map(emptyStanding);
  next.libStandings = assembled.libGroups.flat().map(emptyStanding);
  next.uclGroups = assembled.uclGroups;
  next.uelTeams = assembled.uelTeams;
  next.ueclTeams = assembled.ueclTeams;
  next.libGroups = assembled.libGroups;
  next.sudTeams = assembled.sudTeams;
  const nextLineup = pickXi(squad, prev.tactics.formation);
  next.tactics = {
    ...prev.tactics,
    numberColor: prev.tactics.numberColor ?? "auto",
    lineup: nextLineup,
    bench: pickBench(squad, nextLineup),
  };
  next.budget = prev.budget + leaguePrize + 6_000_000;
  next.season = prev.season + 1;
  // Premios de la nueva temporada (vacíos); los de temporadas anteriores se conservan.
  ensureSeasonAwards(next);
  next.week = 1;
  next.cursor = 0;
  next.seasonOver = false;
  next.pendingFixtureId = null;
  next.lastMatch = null;
  next.offers = [];
  next.popups = [];
  if (trainingEndedInSummer && next.trainingReport) next.popups.push(trainingPopup(next.trainingReport));
  next.tempLineupBackup = null;
  next.scouts = [];
  next.screen = "office";
  next.seed = rng.int(1, 1_000_000_000);
  next.lastChampions = {
    scudetto: null,
    coppa: null,
    ucl: null,
    uel: null,
    uecl: null,
    libertadores: null,
    sudamericana: null,
    coppaRunnerUp: null,
  };
  next.version = 6;
  // Objetivos nuevos para el calendario recién armado; la confianza arrastra a medias.
  next.board = nextBoard(next, prev.board ?? null);

  const uclPlace = assembled.uclGroups.flat().includes(prev.clubId);
  const uelPlace = assembled.uelTeams.includes(prev.clubId);
  const ueclPlace = assembled.ueclTeams.includes(prev.clubId);
  const libPlace = assembled.libGroups.flat().includes(prev.clubId);
  const sudPlace = assembled.sudTeams.includes(prev.clubId);
  const cupLine =
    league === "argentina"
      ? libPlace
        ? "Clasificado a Libertadores."
        : sudPlace
          ? "Clasificado a Sudamericana."
          : "Sin copa continental: hay que entrar por la tabla o la Copa Argentina."
      : uclPlace
        ? "Clasificado a Champions por la tabla."
        : uelPlace
          ? "Clasificado a Europa League por la tabla."
          : ueclPlace
            ? "Clasificado a Conference por la tabla."
            : "Sin copa europea: hay que entrar por la tabla.";

  // Patrocinadores: bonus por clasificar, una temporada menos de contrato y pago del año nuevo.
  const qualified: QualificationComp[] = [];
  if (uclPlace) qualified.push("ucl");
  if (uelPlace) qualified.push("uel");
  if (ueclPlace) qualified.push("uecl");
  if (libPlace) qualified.push("libertadores");
  if (sudPlace) qualified.push("sudamericana");
  rolloverSponsors(next, qualified, prev);

  next.news.unshift({
    id: uid("n"),
    week: 0,
    tone: "neutral",
    title: league === "argentina" ? `Temporada ${next.season}` : `Temporada ${next.season}/${String(next.season + 1).slice(2)}`,
    body: `${cupLine} El mundo sigue: las ligas y las copas continentales se simulan enteras.`,
  });

  return next;
}
