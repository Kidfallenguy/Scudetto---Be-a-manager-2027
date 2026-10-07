import { clubById } from "./clubs";
import { COMP_LABEL } from "./format";
import { userStillIn } from "./participation";
import type { Fixture, GameSave } from "./types";
import { sortTable, tieWinner } from "./world";

export function nextSlot(s: GameSave) {
  return s.calendar[s.cursor] ?? null;
}

export function userFixtureIn(s: GameSave, fixtureIds: string[]): Fixture | undefined {
  return s.fixtures.find(
    (f) =>
      fixtureIds.includes(f.id) &&
      !f.played &&
      (f.homeId === s.clubId || f.awayId === s.clubId),
  );
}

export function nextUserContext(s: GameSave) {
  const slot = nextSlot(s);
  if (!slot) return null;
  const fixture =
    s.fixtures.find((f) => f.id === s.pendingFixtureId) ?? userFixtureIn(s, slot.fixtures);
  return { slot, fixture };
}

export function tablePlace(s: GameSave) {
  const ranked = sortTable(s.standings);
  return ranked.findIndex((r) => r.clubId === s.clubId) + 1;
}

export type MatchOutcome = "W" | "D" | "L";

export interface UserMatchRecord {
  id: string;
  competition: Fixture["competition"];
  /** Título del paso del calendario (ej. "Jornada 5", "Cuartos de final"). */
  title: string;
  opponentId: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  /** Resultado según el marcador de ESE partido. */
  outcome: MatchOutcome;
  /** En cruces a doble partido: si pasó de ronda o quedó eliminado. */
  note: string | null;
}

/**
 * Todos los partidos que jugó el usuario en la temporada (liga, copas y continentales), en orden cronológico.
 * Sale directo de los partidos jugados, así que coincide siempre con lo que se vio en la pantalla de resultado.
 */
export function userMatchHistory(s: GameSave): UserMatchRecord[] {
  const out: UserMatchRecord[] = [];
  const byId = new Map(s.fixtures.map((f) => [f.id, f]));
  for (const slot of s.calendar) {
    for (const fid of slot.fixtures) {
      const f = byId.get(fid);
      if (!f || !f.played || f.homeGoals === undefined || f.awayGoals === undefined) continue;
      if (f.homeId !== s.clubId && f.awayId !== s.clubId) continue;
      const home = f.homeId === s.clubId;
      const goalsFor = home ? f.homeGoals : f.awayGoals;
      const goalsAgainst = home ? f.awayGoals : f.homeGoals;
      let note: string | null = null;
      if (f.leg === 2 && f.tieId) {
        const w = tieWinner(s, f.tieId);
        if (w) note = w === s.clubId ? "Pasa de ronda" : "Eliminado";
      }
      out.push({
        id: f.id,
        competition: f.competition,
        title: slot.title,
        opponentId: home ? f.awayId : f.homeId,
        home,
        goalsFor,
        goalsAgainst,
        outcome: goalsFor > goalsAgainst ? "W" : goalsFor === goalsAgainst ? "D" : "L",
        note,
      });
    }
  }
  return out;
}

/** Últimos 5 resultados del usuario en cualquier competición. */
export function formString(s: GameSave): MatchOutcome[] {
  return userMatchHistory(s)
    .slice(-5)
    .map((m) => m.outcome);
}

/**
 * Próximo paso real del usuario: el primer slot donde juega, o un cruce todavía por definir
 * de una competición en la que sigue vivo. Los slots de copas en las que no está (o ya
 * fue eliminado) se saltan, así no aparece "Champions" cuando el partido es de liga.
 */
export function nextUserStep(s: GameSave) {
  for (let i = s.cursor; i < s.calendar.length; i++) {
    const slot = s.calendar[i]!;
    const fixture = userFixtureIn(s, slot.fixtures);
    if (fixture) return { slot, fixture };
    if (slot.fixtures.length === 0 && userStillIn(s, slot.competition)) return { slot, fixture: null };
  }
  return null;
}

export function pendingLabel(s: GameSave) {
  if (s.seasonOver) return "Fin de temporada";
  const step = nextUserStep(s);
  if (!step) return "Fin de temporada";
  const { slot, fixture } = step;
  if (!fixture) return slot.title;
  const oppId = fixture.homeId === s.clubId ? fixture.awayId : fixture.homeId;
  const opp = clubById(oppId);
  const venue = fixture.homeId === s.clubId ? "Local" : "Visitante";
  return `${slot.title} · ${venue} vs ${opp.name}`;
}

export { COMP_LABEL };
