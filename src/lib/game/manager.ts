import { CLUBS, clubById, isSelectableClub, playableLeague } from "./clubs";
import { hash01 } from "./contracts";
import { baseTransferBudget } from "./finance";
import { clamp } from "./format";
import type { Club, GameSave, HonourCounts } from "./types";
import { sortTable } from "./world";

/** Cuánto suma cada título a la valoración del DT. */
const TROPHY_WEIGHT: Record<keyof HonourCounts, number> = {
  scudetto: 18,
  ucl: 22,
  libertadores: 20,
  uel: 10,
  coppa: 8,
  mundial: 8,
  sudamericana: 8,
  uecl: 6,
  supercoppa: 3,
  recopa: 3,
  trofeo: 4,
};

export interface ManagerReport {
  /** 0-100. Sale de la tabla frente a lo esperado del club, los títulos de la temporada y los de las dos anteriores. */
  rating: number;
  label: string;
  /** Puesto esperado según el peso del club en su liga. */
  expectedPlace: number;
  place: number;
  trophiesNow: number;
  /** Prestigio máximo de los clubes que se animan a contratarte. */
  maxPrestige: number;
}

export function managerLabel(rating: number): string {
  if (rating >= 88) return "Entrenador de élite";
  if (rating >= 72) return "Muy cotizado";
  if (rating >= 55) return "Respetado";
  if (rating >= 38) return "Discreto";
  return "En duda";
}

/** Valoración del DT al cerrar la temporada. */
export function managerReport(save: GameSave): ManagerReport {
  const club = clubById(save.clubId);
  const rivals = CLUBS.filter((c) => !c.ghost && playableLeague(c.league) === playableLeague(club.league)).sort(
    (a, b) => b.prestige - a.prestige,
  );
  const expectedPlace = Math.max(1, rivals.findIndex((c) => c.id === save.clubId) + 1);
  const ranked = sortTable(save.standings);
  const found = ranked.findIndex((r) => r.clubId === save.clubId);
  const place = found >= 0 ? found + 1 : Math.ceil(ranked.length / 2);

  const base = 50 + clamp((expectedPlace - place) * 3.2, -32, 32);

  let now = 0;
  let before = 0;
  for (const t of save.careerTrophies ?? []) {
    const w = TROPHY_WEIGHT[t.kind] ?? 0;
    if (t.season === save.season) now += w;
    else if (t.season >= save.season - 2 && t.season < save.season) before += w * 0.5;
  }
  const trophiesNow = (save.careerTrophies ?? []).filter((t) => t.season === save.season).length;

  // Una dirigencia que te respalda (o te tiene en la cuerda floja) también se nota en el mercado de DTs.
  const boardAdj = save.board ? clamp((save.board.confidence - 60) * 0.1, -4, 4) : 0;

  const rating = Math.round(clamp(base + Math.min(now, 36) + Math.min(before, 14) + boardAdj, 5, 99));
  return {
    rating,
    label: managerLabel(rating),
    expectedPlace,
    place,
    trophiesNow,
    maxPrestige: Math.round(62 + rating * 0.34),
  };
}

export interface ClubOffer {
  clubId: string;
  /** Presupuesto de fichajes con el que te recibe. */
  budget: number;
  objective: string;
}

function objectiveFor(club: Club): string {
  const rivals = CLUBS.filter((c) => !c.ghost && playableLeague(c.league) === playableLeague(club.league)).sort(
    (a, b) => b.prestige - a.prestige,
  );
  const spot = rivals.findIndex((c) => c.id === club.id) + 1;
  if (spot <= 2) return "Pelear el título";
  if (spot <= 6) return "Clasificar a Europa";
  if (spot <= 12) return "Mitad de tabla o mejor";
  return "Sumar puntos y construir";
}

/**
 * Clubes que quieren contratarte. Cuanto mejor la temporada, más arriba llegan las ofertas (Bayern,
 * Real Madrid...); con una mala campaña solo llaman equipos modestos. Es determinista por partida y
 * temporada: abrir el cartel dos veces muestra las mismas ofertas.
 */
export function managerOffers(save: GameSave, count = 4, prestigeDelta = 0): ClubOffer[] {
  const maxPrestige = managerReport(save).maxPrestige + prestigeDelta;
  const pool = CLUBS.filter((c) => c.id !== save.clubId && isSelectableClub(c.id));
  const score = (c: Club) => c.prestige + (hash01(`${save.seed}:${save.season}:${c.id}:mgr`) - 0.5) * 5;

  let minP = maxPrestige - 16;
  let window = pool.filter((c) => score(c) <= maxPrestige && score(c) >= minP);
  while (window.length < count && minP > 40) {
    minP -= 4;
    window = pool.filter((c) => score(c) <= maxPrestige && score(c) >= minP);
  }
  if (window.length === 0) {
    // Ni los clubes modestos llaman: igual aparecen un par de equipos de abajo dispuestos a arriesgar.
    window = [...pool].sort((a, b) => a.prestige - b.prestige).slice(0, Math.max(2, count));
  }
  const picked = window
    .sort((a, b) => hash01(`${save.seed}:${save.season}:${a.id}:pick`) - hash01(`${save.seed}:${save.season}:${b.id}:pick`))
    .slice(0, count)
    .sort((a, b) => b.prestige - a.prestige);

  return picked.map((c) => ({
    clubId: c.id,
    budget: save.clubFinance?.[c.id]?.budget ?? baseTransferBudget(c.id),
    objective: objectiveFor(c),
  }));
}
