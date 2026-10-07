import { clubById, domesticCompetition } from "./clubs";
import type { Competition, GameSave } from "./types";
import { resolveDrawWinner, sortTable, tieWinner, trofeoPair } from "./world";

/**
 * "in"   → el club del usuario participa y sigue con vida.
 * "out"  → participó pero ya fue eliminado.
 * "none" → nunca clasificó a esa competición.
 */
export type CompStatus = "in" | "out" | "none";

const GROUP_ROUNDS: Partial<Record<Competition, number>> = { ucl: 6, libertadores: 6 };

function involvesUser(save: GameSave, homeId: string, awayId: string) {
  return homeId === save.clubId || awayId === save.clubId;
}

function isParticipant(save: GameSave, comp: Competition): boolean {
  switch (comp) {
    case "ucl":
      return (save.uclGroups ?? []).some((g) => g.includes(save.clubId));
    case "libertadores":
      return (save.libGroups ?? []).some((g) => g.includes(save.clubId));
    case "uel":
      return (save.uelTeams ?? []).includes(save.clubId);
    case "uecl":
      return (save.ueclTeams ?? []).includes(save.clubId);
    case "sudamericana":
      return (save.sudTeams ?? []).includes(save.clubId);
    case "trofeo": {
      if (save.fixtures.some((f) => f.competition === "trofeo")) {
        return save.fixtures.some((f) => f.competition === "trofeo" && involvesUser(save, f.homeId, f.awayId));
      }
      // Todavía sin cruce: el usuario participa si es campeón de alguna rueda (solo se sabe al terminar la liga).
      return (trofeoPair(save) ?? ([] as string[])).includes(save.clubId);
    }
    default:
      return save.fixtures.some((f) => f.competition === comp && involvesUser(save, f.homeId, f.awayId));
  }
}

/** ¿Ya se jugaron todos los partidos del grupo del usuario? (solo Champions y Libertadores) */
export function groupStageFinished(save: GameSave, comp: Competition): boolean {
  const groupRounds = GROUP_ROUNDS[comp];
  if (!groupRounds) return false;
  const groups = comp === "ucl" ? save.uclGroups : save.libGroups;
  const standings = comp === "ucl" ? save.uclStandings : save.libStandings;
  const group = (groups ?? []).find((g) => g.includes(save.clubId));
  if (!group) return false;
  const rows = (standings ?? []).filter((r) => group.includes(r.clubId));
  return rows.length > 0 && rows.every((r) => r.played >= groupRounds);
}

/** ¿Quedó fuera en la fase de grupos? (solo Champions y Libertadores tienen grupos) */
function eliminatedInGroups(save: GameSave, comp: Competition): boolean {
  const groupRounds = GROUP_ROUNDS[comp];
  if (!groupRounds) return false;
  const groups = comp === "ucl" ? save.uclGroups : save.libGroups;
  const standings = comp === "ucl" ? save.uclStandings : save.libStandings;
  const group = (groups ?? []).find((g) => g.includes(save.clubId));
  if (!group) return false;
  const rows = (standings ?? []).filter((r) => group.includes(r.clubId));
  if (rows.length === 0 || rows.some((r) => r.played < groupRounds)) return false;
  const place = sortTable(rows).findIndex((r) => r.clubId === save.clubId);
  return place >= 2;
}

/** ¿Perdió algún cruce de eliminación directa ya definido? */
function eliminatedInKnockout(save: GameSave, comp: Competition): boolean {
  const groupRounds = GROUP_ROUNDS[comp] ?? 0;
  const mine = save.fixtures.filter(
    (f) => f.competition === comp && f.played && f.round > groupRounds && involvesUser(save, f.homeId, f.awayId),
  );
  for (const f of mine) {
    if (f.tieId) {
      const w = tieWinner(save, f.tieId);
      if (w && w !== save.clubId) return true;
    } else if (resolveDrawWinner(f, save.seed) !== save.clubId) {
      return true;
    }
  }
  return false;
}

export function userCompStatus(save: GameSave, comp: Competition): CompStatus {
  // La liga local siempre se juega; las ligas de otros países nunca.
  if (comp === domesticCompetition(clubById(save.clubId).league)) return "in";
  if (!isParticipant(save, comp)) return "none";
  if (eliminatedInGroups(save, comp) || eliminatedInKnockout(save, comp)) return "out";
  return "in";
}

/** Atajo: ¿puede el usuario todavía jugar partidos de esta competición? */
export function userStillIn(save: GameSave, comp: Competition): boolean {
  return userCompStatus(save, comp) === "in";
}
