/**
 * Reglas de plantilla en un solo lugar. Cuatro conceptos que NO se mezclan:
 *
 *  - Propio:      jugador del club que está en el club (no cedido).            → se puede vender.
 *  - Cedido IN:   jugador de otro club que juega acá a préstamo.               → cuenta para el tope, NO se vende.
 *  - Cedido OUT:  jugador propio que está prestado en otro club.               → NO se vende hasta que vuelva.
 *  - Plantilla:   propios + cedidos IN (todos los que ocupan lugar en el club) → se usa para el tope de 40.
 *
 * Modelo de datos: `clubId` es el club donde juega y `loanFrom` el club dueño (null si no está cedido).
 */
import { SQUAD_LIMIT, SQUAD_MIN } from "./format";
import type { ClubId, GameSave, Player } from "./types";

type Located = Pick<Player, "clubId" | "loanFrom">;

/** Propio del club y presente en el club (no cedido a nadie ni cedido de otro). */
export function isOwnedAtClub(p: Located, clubId: ClubId): boolean {
  return p.clubId === clubId && (!p.loanFrom || p.loanFrom === clubId);
}

/** Cedido que juega en `clubId` pero pertenece a otro club. */
export function isLoanedIn(p: Located, clubId: ClubId): boolean {
  return p.clubId === clubId && Boolean(p.loanFrom) && p.loanFrom !== clubId;
}

/** Jugador de `clubId` que está prestado en otro club. */
export function isLoanedOut(p: Located, clubId: ClubId): boolean {
  return p.loanFrom === clubId && p.clubId !== clubId;
}

export function ownPlayers<T extends Located>(players: readonly T[], clubId: ClubId): T[] {
  return players.filter((p) => isOwnedAtClub(p, clubId));
}

export function loanedInPlayers<T extends Located>(players: readonly T[], clubId: ClubId): T[] {
  return players.filter((p) => isLoanedIn(p, clubId));
}

export function loanedOutPlayers<T extends Located>(players: readonly T[], clubId: ClubId): T[] {
  return players.filter((p) => isLoanedOut(p, clubId));
}

export type SquadCount = {
  /** Propios en el club. */
  own: number;
  /** Cedidos de otros clubes que juegan acá. */
  loanedIn: number;
  /** Propios prestados en otro club. */
  loanedOut: number;
  /** Plantilla = propios + cedidos que llegaron. Es lo que cuenta contra el tope de 40. */
  total: number;
};

export function squadCount(players: readonly Located[], clubId: ClubId): SquadCount {
  let own = 0;
  let loanedIn = 0;
  let loanedOut = 0;
  for (const p of players) {
    if (isOwnedAtClub(p, clubId)) own += 1;
    else if (isLoanedIn(p, clubId)) loanedIn += 1;
    else if (isLoanedOut(p, clubId)) loanedOut += 1;
  }
  return { own, loanedIn, loanedOut, total: own + loanedIn };
}

/** Tamaño de plantilla para el tope (propios + cedidos que llegaron). */
export function squadTotal(players: readonly Located[], clubId: ClubId): number {
  return squadCount(players, clubId).total;
}

/** ¿Hay lugar para sumar a alguien (fichaje, cesión recibida, juvenil, rescate)? Los cedidos ocupan lugar. */
export function hasSquadRoom(players: readonly Located[], clubId: ClubId): boolean {
  return squadTotal(players, clubId) < SQUAD_LIMIT;
}

export const SQUAD_FULL_MSG = `Plantilla llena (máximo ${SQUAD_LIMIT}).`;

/**
 * ¿Este jugador es propiedad real del club y está en él? Es la condición mínima para venderlo,
 * cederlo a otro club, ponerlo en el escaparate o recibir ofertas por él.
 * Devuelve el motivo si NO se puede, o null si sí.
 */
export function ownershipBlockReason(p: Located | undefined | null, clubId: ClubId): string | null {
  if (!p) return "Jugador no encontrado.";
  if (isLoanedIn(p, clubId)) return "Es un cedido de otro club: solo su club propietario puede venderlo.";
  if (isLoanedOut(p, clubId)) return "Está cedido en otro club: no se puede vender hasta que vuelva o expire el préstamo.";
  if (p.clubId !== clubId) return "No pertenece a tu club.";
  return null;
}

/**
 * Venta definitiva (incluye la venta rápida y aceptar ofertas de compra).
 * 1) tiene que ser propio y estar en el club; 2) tras venderlo hay que seguir con SQUAD_MIN propios:
 * los cedidos NO reemplazan a los propios para llegar al mínimo.
 */
export function saleBlockReason(save: Pick<GameSave, "players" | "clubId">, p: Player | undefined | null): string | null {
  const owner = ownershipBlockReason(p, save.clubId);
  if (owner) return owner;
  if (ownPlayers(save.players, save.clubId).length <= SQUAD_MIN) {
    return `No puedes bajar de ${SQUAD_MIN} jugadores propios. Los cedidos cuentan para el tope de plantilla, pero no se pueden vender ni reemplazan a un propio.`;
  }
  return null;
}

export function canSellPlayer(save: Pick<GameSave, "players" | "clubId">, p: Player | undefined | null): boolean {
  return saleBlockReason(save, p) === null;
}

/** Jugadores que el club puede vender o poner en el escaparate: solo los propios presentes en el club. */
export function sellablePlayers(save: Pick<GameSave, "players" | "clubId">): Player[] {
  return ownPlayers(save.players, save.clubId);
}
