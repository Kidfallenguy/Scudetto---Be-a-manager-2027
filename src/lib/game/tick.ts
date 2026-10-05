import { hasCeremony } from "./award-ceremony";
import { selectSeasonAwards } from "./award-selection";
import { applyBoardMatch, closeBoardSeason } from "./board";
import { sponsorMatchBonus, sponsorObjectiveBonus } from "./sponsors";
import { clubById, isDomesticCompetition, playableLeague } from "./clubs";
import { resolveScouts } from "./academy";
import { coppaFinalRound, finalRoundOf, isContinental, supercoppaFinalRound } from "./competitions";
import { payMatchBonuses } from "./contracts";
import { userMatchBoost } from "./event-effects";
import { closeEventWindow, rollBetweenMatchEvent, rollPreMatchEvent } from "./events";
import { clamp, formatMoney, refreshValues, uid } from "./format";
import { applyLoanGrowth, applyMatchGrowth } from "./potential";
import { Rng } from "./rng";
import { autoLineup, clubQuality, simulateMatch } from "./sim";
import { syncStats } from "./stats";
import { advanceTraining, daysBetween } from "./training";
import { pickXi, dropFromLineup, isUnavailable, sanitizeBench, unavailableDetail, unavailableGames, unavailableReason } from "./tactics";
import { processMarketWeek } from "./transfers";
import {
  applyFixtureToWorld,
  awardTrophy,
  maybeAwardCup,
  populateKnockout,
  prizeForPlace,
  resolveDrawWinner,
  sortTable,
  tieWinner,
} from "./world";
import type { Fixture, GameSave, Player } from "./types";

function newsId() {
  return uid("n");
}

/** Motivo corto de una baja para los avisos ("lesionado", "expulsado", "Gripe"...). */
function outLabel(reason: string, detail: string): string {
  if (reason === "injury") return "lesionado";
  if (reason === "suspension") return "expulsado";
  return detail ? detail.toLowerCase() : "no disponible";
}

export function lineupProblems(save: GameSave): Player[] {
  return save.tactics.lineup
    .map((id) => save.players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p) && isUnavailable(p));
}

/** Jugadores del once que no pueden jugar, con el motivo (para el cartel y la alineación). */
export function lineupProblemsDetailed(save: GameSave) {
  return lineupProblems(save).map((p) => ({
    player: p,
    reason: unavailableReason(p) ?? "injury",
    games: unavailableGames(p),
    detail: unavailableDetail(p),
  }));
}

/** Deja el banquillo del usuario coherente con la plantilla y el once actuales. */
export function fixBench(save: GameSave) {
  const squad = save.players.filter((p) => p.clubId === save.clubId);
  save.tactics.bench = sanitizeBench(save.tactics.bench, save.tactics.lineup, squad);
}

/**
 * Solo reemplaza a quien ya no está en el club (vendido, retirado...).
 * Mantiene a los lesionados/expulsados en el once para que se vean en la alineación.
 */
export function sanitizeMissingLineup(save: GameSave) {
  const squad = save.players.filter((p) => p.clubId === save.clubId);
  let lineup = [...save.tactics.lineup];
  for (const id of [...lineup]) {
    const p = save.players.find((x) => x.id === id);
    if (!p || p.clubId !== save.clubId) {
      lineup = dropFromLineup(lineup, save.tactics.formation, id, squad);
    }
  }
  save.tactics.lineup =
    lineup.filter(Boolean).length === 11 ? lineup : pickXi(squad, save.tactics.formation);
  fixBench(save);
}

/** Devuelve el once guardado antes de un "cambio automático solo para este partido". */
export function restoreTempLineup(save: GameSave) {
  const backup = save.tempLineupBackup;
  if (!backup) return;
  save.tempLineupBackup = null;
  const inClub = new Set(save.players.filter((p) => p.clubId === save.clubId).map((p) => p.id));
  const current = save.tactics.lineup;
  const restored = backup.map((id, i) => (inClub.has(id) ? id : (current[i] ?? id)));
  if (restored.length === 11 && new Set(restored).size === 11 && restored.every((id) => inClub.has(id))) {
    save.tactics.lineup = restored;
  }
}

export function sanitizeUserLineup(save: GameSave) {
  const squad = save.players.filter((p) => p.clubId === save.clubId);
  let lineup = [...save.tactics.lineup];
  for (const id of [...lineup]) {
    const p = save.players.find((x) => x.id === id);
    if (!p || isUnavailable(p)) {
      lineup = dropFromLineup(lineup, save.tactics.formation, id, squad);
    }
  }
  save.tactics.lineup =
    lineup.filter(Boolean).length === 11 ? lineup : pickXi(squad, save.tactics.formation);
  fixBench(save);
}

function isKnockoutSlot(slot: { competition: Fixture["competition"]; round: number; leg?: 1 | 2 }) {
  if (slot.competition === "coppa" || slot.competition === "supercoppa" || slot.competition === "mundial" || slot.competition === "trofeo") {
    return true;
  }
  if (slot.competition === "ucl" || slot.competition === "libertadores") {
    return slot.round >= 7;
  }
  if (slot.competition === "uel" || slot.competition === "uecl" || slot.competition === "sudamericana") {
    return true;
  }
  return false;
}

function maybeExtraTime(save: GameSave, fixture: Fixture, result: { homeGoals: number; awayGoals: number; events: { minute: number; type: "goal"; clubId?: string; text: string }[] }) {
  const knockout = isKnockoutSlot({
    competition: fixture.competition,
    round: fixture.round,
    leg: fixture.leg,
  });
  if (!knockout) return;
  if (fixture.leg === 1) return;
  if (fixture.leg === 2 && fixture.tieId) {
    const first = save.fixtures.find((f) => f.tieId === fixture.tieId && f.leg === 1);
    if (!first || first.homeGoals === undefined || first.awayGoals === undefined) return;
    const a = first.homeGoals + result.awayGoals;
    const b = first.awayGoals + result.homeGoals;
    if (a !== b) return;
  } else if (result.homeGoals !== result.awayGoals) {
    return;
  }
  const homeLineup = autoLineup(save.players, fixture.homeId);
  const awayLineup = autoLineup(save.players, fixture.awayId);
  const hq = clubQuality(save.players, fixture.homeId, homeLineup);
  const aq = clubQuality(save.players, fixture.awayId, awayLineup);
  const pHome = 1 / (1 + Math.pow(10, (aq - hq - 1.2) / 7));
  const extra = new Rng(save.seed + fixture.id.length + 17).chance(pHome) ? 1 : 0;
  if (extra) result.homeGoals += 1;
  else result.awayGoals += 1;
  result.events.push({
    minute: 118,
    type: "goal",
    clubId: extra ? result.homeId : result.awayId,
    text: "118' · Gol de oro en la prórroga.",
  });
}

export function simSlot(save: GameSave) {
  const slot = save.calendar[save.cursor];
  if (!slot) return;
  populateKnockout(save, slot);
  if (slot.fixtures.length === 0) {
    save.cursor += 1;
    return;
  }

  const snapshot = new Map(save.players.map((p) => [p.id, { g: p.goals, a: p.assists }]));
  // Quien se lesiona o ve la roja en ESTE partido no descuenta jornada hoy:
  // solo descuentan los que ya estaban fuera antes del partido.
  const hadStatus = new Set(
    save.players.filter((p) => p.injured > 0 || p.suspended > 0).map((p) => p.id),
  );

  // Red de seguridad: nadie lesionado, sancionado o ausente por un suceso puede jugar, llegue como llegue el once.
  // (Con la pantalla normal esto no se dispara: el partido no arranca con bajas en el once.)
  if (slot.fixtures.some((fid) => {
    const f = save.fixtures.find((x) => x.id === fid);
    return f && !f.played && (f.homeId === save.clubId || f.awayId === save.clubId);
  })) {
    if (lineupProblems(save).length) sanitizeUserLineup(save);
    else fixBench(save);
  }
  // Preparación del equipo (sucesos recientes) y ambiente del plantel: suman o restan puntos de GRL de equipo.
  const userBoost = userMatchBoost(save);

  let userPlayed = false;
  // Suplentes del usuario que entraron: cuentan como que jugaron (bonus, crecimiento).
  const userSubs = new Set<string>();
  for (const fid of slot.fixtures) {
    const fixture = save.fixtures.find((f) => f.id === fid);
    if (!fixture || fixture.played) continue;
    const isUser = fixture.homeId === save.clubId || fixture.awayId === save.clubId;
    const homeLineup =
      fixture.homeId === save.clubId ? save.tactics.lineup : autoLineup(save.players, fixture.homeId);
    const awayLineup =
      fixture.awayId === save.clubId ? save.tactics.lineup : autoLineup(save.players, fixture.awayId);
    const result = simulateMatch(fixture, save.players, {
      seed: save.seed + save.cursor * 997 + fid.length * 13 + fixture.round,
      homeLineup,
      awayLineup,
      homeBench: fixture.homeId === save.clubId ? save.tactics.bench : undefined,
      awayBench: fixture.awayId === save.clubId ? save.tactics.bench : undefined,
      homeMentality: fixture.homeId === save.clubId ? save.tactics.mentality : "balanced",
      awayMentality: fixture.awayId === save.clubId ? save.tactics.mentality : "balanced",
      homeBoost: fixture.homeId === save.clubId ? userBoost : 0,
      awayBoost: fixture.awayId === save.clubId ? userBoost : 0,
    });
    maybeExtraTime(save, fixture, result);
    fixture.played = true;
    fixture.homeGoals = result.homeGoals;
    fixture.awayGoals = result.awayGoals;
    applyFixtureToWorld(save, fixture, result.homeGoals, result.awayGoals);
    if (isUser) {
      userPlayed = true;
      save.lastMatch = result;
      const mySubs = fixture.homeId === save.clubId ? result.homeSubsIn : result.awaySubsIn;
      for (const id of mySubs ?? []) userSubs.add(id);
      const hg = result.homeGoals;
      const ag = result.awayGoals;
      const userHome = fixture.homeId === save.clubId;
      const userGoals = userHome ? hg : ag;
      const oppGoals = userHome ? ag : hg;
      const tone = userGoals > oppGoals ? "good" : userGoals === oppGoals ? "neutral" : "bad";
      const opp = clubById(userHome ? fixture.awayId : fixture.homeId);
      let extra = slot.title;
      if (fixture.leg === 2 && fixture.tieId) {
        const w = tieWinner(save, fixture.tieId);
        if (w) extra += w === save.clubId ? " · Pasa de ronda" : " · Eliminado";
      }
      save.news.unshift({
        id: newsId(),
        week: save.week,
        tone,
        title:
          userGoals > oppGoals
            ? `Victoria ${userGoals}–${oppGoals} ante ${opp.short}`
            : userGoals === oppGoals
              ? `Empate ${userGoals}–${oppGoals} con ${opp.short}`
              : `Derrota ${userGoals}–${oppGoals} vs ${opp.short}`,
        body: extra,
      });
      const gate = userGoals > oppGoals ? 450_000 : userGoals === oppGoals ? 180_000 : 70_000;
      save.budget += gate + sponsorMatchBonus(save, gate);
      applyBoardMatch(save, fixture, userGoals, oppGoals);
    }
  }

  const contrib = new Map<string, { goals: number; assists: number }>();
  for (const p of save.players) {
    const before = snapshot.get(p.id);
    if (!before) continue;
    const dg = p.goals - before.g;
    const da = p.assists - before.a;
    if (dg || da) contrib.set(p.id, { goals: dg, assists: da });
  }
  if (userPlayed) {
    const paid = payMatchBonuses(save, contrib, new Set([...save.tactics.lineup, ...userSubs]));
    if (paid > 0) {
      save.news.unshift({
        id: newsId(),
        week: save.week,
        tone: "neutral",
        title: "Bonus pagados",
        body: `Goles, asistencias y partidos de la plantilla: ${formatMoney(paid)}.`,
      });
    }
  }
  const rng = new Rng(save.seed + save.week * 31 + save.cursor);
  const playedNow = new Set<string>();
  for (const p of save.players) {
    const before = snapshot.get(p.id);
    if (before && (p.goals !== before.g || p.assists !== before.a)) playedNow.add(p.id);
  }
  for (const id of save.tactics.lineup) playedNow.add(id);
  for (const id of userSubs) playedNow.add(id);
  applyMatchGrowth(save.players, playedNow, contrib, rng);
  for (const p of applyLoanGrowth(save.players, save.clubId, rng)) {
    save.news.unshift({
      id: newsId(),
      week: save.week,
      tone: "good",
      title: `${p.name} progresa a préstamo`,
      body: `Cedido en ${clubById(p.clubId).name}: sube a GRL ${p.ovr}.`,
    });
  }

  const league = clubById(save.clubId).league;
  maybeAwardCup(save, "coppa", coppaFinalRound(league), "coppa");
  maybeAwardCup(save, "ucl", 10, "ucl");
  maybeAwardCup(save, "uel", 4, "uel");
  maybeAwardCup(save, "uecl", 4, "uecl");
  maybeAwardCup(save, "libertadores", 10, "libertadores");
  maybeAwardCup(save, "sudamericana", 4, "sudamericana");
  maybeAwardCup(save, "supercoppa", supercoppaFinalRound(league), "supercoppa");
  maybeAwardCup(save, "trofeo", 1, "trofeo");
  maybeAwardCup(save, "mundial", 1, "mundial");

  for (const p of save.players) {
    if (hadStatus.has(p.id)) {
      if (p.injured > 0) p.injured -= 1;
      if (p.suspended > 0) p.suspended -= 1;
    }
    if (p.fitness < 100) p.fitness = clamp(p.fitness + 6, 40, 100);
  }

  // Si hubo "cambio automático solo para este partido", volvemos al once original.
  restoreTempLineup(save);

  // Las bajas se quedan marcadas en la alineación (ya no se sustituyen solas).
  const stillOut = lineupProblemsDetailed(save);
  if (stillOut.length) {
    const names = stillOut
      .slice(0, 4)
      .map((x) => `${x.player.name} (${outLabel(x.reason, x.detail)}, ${x.games} j)`)
      .join(", ");
    save.popups.push({
      id: uid("pop"),
      kind: "info",
      tone: "bad",
      title: "Bajas en el once",
      body: `${names}. Seguirán marcados en tu alineación: cambialos o usá el cambio automático antes del próximo partido.`,
    });
  }

  const used = new Set(save.players.map((p) => p.name));
  const scouted = resolveScouts(save.scouts, save.academy, save.academyLevel, save.clubId, rng, used);
  save.scouts = scouted.scouts;
  save.academy = scouted.academy;
  for (const y of scouted.found) {
    save.news.unshift({
      id: newsId(),
      week: save.week,
      tone: "good",
      title: `Promesa: ${y.name}`,
      body: `${y.nat} · ${y.pos} · GRL ${y.ovr} / POT ${y.pot}. Ficha de ${formatMoney(y.fee)}.`,
    });
  }

  processMarketWeek(save, rng);
  // Sucesos inesperados: los de la previa salen en advanceToUserMatch (antes de jugar).
  // Acá solo: al jugar el usuario se cierra la ventana de ese partido; en jornadas ajenas puede haber uno "entre partidos".
  if (userPlayed) closeEventWindow(save);
  else rollBetweenMatchEvent(save);
  refreshValues(save.players);
  // Si la media cambió por partidos, edad o cesiones, las estadísticas la acompañan.
  for (const p of save.players) syncStats(p);

  const slotDate = slot.date;
  save.week += 1;
  save.cursor += 1;
  save.pendingFixtureId = null;
  // Corre el reloj del entrenamiento (6 meses de tiempo de juego).
  advanceTraining(
    save,
    daysBetween(slotDate, save.calendar[save.cursor]?.date),
    new Rng(save.seed + save.week * 53 + 7),
  );
  if (save.cursor >= save.calendar.length) {
    endSeason(save);
  }
}

function userFixtureInSlot(save: GameSave, slotIndex: number) {
  const slot = save.calendar[slotIndex];
  if (!slot) return null;
  populateKnockout(save, slot);
  for (const fid of slot.fixtures) {
    const f = save.fixtures.find((x) => x.id === fid);
    if (!f || f.played) continue;
    if (f.homeId === save.clubId || f.awayId === save.clubId) return f;
  }
  return null;
}

export function advanceToUserMatch(save: GameSave) {
  while (save.cursor < save.calendar.length && !save.seasonOver) {
    const userFix = userFixtureInSlot(save, save.cursor);
    if (userFix) {
      save.pendingFixtureId = userFix.id;
      save.screen = "preview";
      // Previa del partido: único momento principal para un suceso inesperado (máx. 1 por partido).
      rollPreMatchEvent(save);
      return;
    }
    simSlot(save);
  }
  if (!save.seasonOver && save.cursor >= save.calendar.length) endSeason(save);
}

export function endSeason(save: GameSave) {
  save.seasonOver = true;
  save.screen = "season-end";
  const userLeague = playableLeague(clubById(save.clubId).league);
  const table = sortTable(save.leagueTables[userLeague] ?? save.standings);
  const place = table.findIndex((r) => r.clubId === save.clubId);
  const prize = prizeForPlace(place, clubById(save.clubId).league);
  save.budget += prize;
  const champion = table[0]?.clubId;
  if (champion) awardTrophy(save, "scudetto", champion);
  const lg = clubById(save.clubId).league;
  maybeAwardCup(save, "coppa", coppaFinalRound(lg), "coppa");
  maybeAwardCup(save, "ucl", 10, "ucl");
  maybeAwardCup(save, "uel", 4, "uel");
  maybeAwardCup(save, "uecl", 4, "uecl");
  maybeAwardCup(save, "libertadores", 10, "libertadores");
  maybeAwardCup(save, "sudamericana", 4, "sudamericana");
  maybeAwardCup(save, "supercoppa", supercoppaFinalRound(lg), "supercoppa");
  maybeAwardCup(save, "trofeo", 1, "trofeo");
  // Con la tabla final y las copas definidas, la dirigencia hace su balance.
  const boardWasClosed = Boolean(save.board?.closed);
  closeBoardSeason(save);
  // Bonus de patrocinadores por objetivos cumplidos (una sola vez por temporada).
  if (!boardWasClosed && save.board && !save.board.sacked) {
    const objectives = sponsorObjectiveBonus(save);
    if (objectives > 0) {
      save.budget += objectives;
      save.news.unshift({
        id: newsId(),
        week: save.week,
        tone: "good",
        title: "Bonus de patrocinadores por objetivos",
        body: `Tus patrocinadores pagan ${formatMoney(objectives)} por los objetivos cumplidos.`,
      });
    }
  }
  // Con todo cerrado (tabla, copas y objetivos), se eligen nominados y ganadores de los premios individuales.
  selectSeasonAwards(save);
  // Con los premios ya sorteados, el cierre de temporada pasa primero por la ceremonia de premios.
  if (hasCeremony(save)) save.screen = "awards";
}

void isDomesticCompetition;
void isContinental;
void finalRoundOf;
