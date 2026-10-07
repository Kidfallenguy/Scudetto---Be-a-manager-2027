import type { HonourKind } from "./honours";
import type { LeagueKind } from "./types";

export const TROPHY_PRIZE: Record<HonourKind, number> = {
  ucl: 82_000_000,
  mundial: 40_000_000,
  libertadores: 28_000_000,
  scudetto: 36_000_000,
  uel: 22_000_000,
  uecl: 12_000_000,
  sudamericana: 10_000_000,
  coppa: 12_000_000,
  recopa: 10_000_000,
  supercoppa: 7_000_000,
  trofeo: 4_000_000,
};

export const TROPHY_NAME: Record<HonourKind, string> = {
  scudetto: "el Scudetto",
  coppa: "la Coppa Italia",
  supercoppa: "la Supercoppa Italiana",
  ucl: "la Champions League",
  uel: "la Europa League",
  uecl: "la Conference League",
  libertadores: "la Copa Libertadores",
  sudamericana: "la Copa Sudamericana",
  recopa: "la Recopa",
  trofeo: "el Trofeo de Campeones",
  mundial: "el Mundial de Clubes",
};

export function trophyPrize(kind: HonourKind, league: LeagueKind): number {
  if (kind === "scudetto") {
    if (league === "premier") return 52_000_000;
    if (league === "laliga") return 45_000_000;
    if (league === "bundesliga") return 40_000_000;
    if (league === "ligue1") return 42_000_000;
    if (league === "argentina") return 18_000_000;
    return TROPHY_PRIZE.scudetto;
  }
  if (kind === "coppa") {
    if (league === "premier") return 14_000_000;
    if (league === "laliga") return 13_000_000;
    if (league === "bundesliga") return 12_000_000;
    if (league === "ligue1") return 12_500_000;
    if (league === "argentina") return 6_000_000;
    return TROPHY_PRIZE.coppa;
  }
  if (kind === "supercoppa") {
    if (league === "laliga") return 8_000_000;
    if (league === "premier") return 7_500_000;
    if (league === "bundesliga") return 7_000_000;
    if (league === "ligue1") return 7_200_000;
    if (league === "argentina") return 3_000_000;
    return TROPHY_PRIZE.supercoppa;
  }
  if (kind === "trofeo" && league === "argentina") return 4_000_000;
  return TROPHY_PRIZE[kind];
}

export function trophyName(kind: HonourKind, league: LeagueKind): string {
  if (league === "premier") {
    if (kind === "scudetto") return "la Premier League";
    if (kind === "coppa") return "la FA Cup";
    if (kind === "supercoppa") return "el Community Shield";
  }
  if (league === "laliga") {
    if (kind === "scudetto") return "La Liga";
    if (kind === "coppa") return "la Copa del Rey";
    if (kind === "supercoppa") return "la Supercopa de España";
  }
  if (league === "bundesliga") {
    if (kind === "scudetto") return "la Bundesliga";
    if (kind === "coppa") return "la DFB-Pokal";
    if (kind === "supercoppa") return "la DFL-Supercup";
  }
  if (league === "ligue1") {
    if (kind === "scudetto") return "la Ligue 1";
    if (kind === "coppa") return "la Coupe de France";
    if (kind === "supercoppa") return "el Trophée des Champions";
  }
  if (league === "argentina") {
    if (kind === "scudetto") return "la Liga Profesional";
    if (kind === "coppa") return "la Copa Argentina";
    if (kind === "supercoppa") return "la SuperCopa Argentina";
    if (kind === "trofeo") return "el Trofeo de Campeones";
  }
  return TROPHY_NAME[kind];
}
