// Pruebas de cedidos, límite de plantilla, ventas y posiciones válidas. Se corren con:
//   npx tsx --test src/lib/game/squad-rules.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { makeYouth, resolveScouts, youthToPlayer } from "./academy";
import { blankTerms } from "./contracts";
import { signFreeAgent } from "./free-agents";
import { SQUAD_LIMIT, SQUAD_MIN } from "./format";
import { VALID_POSITIONS, coercePos, isValidPos, normalizePos, repairPositions } from "./positions";
import { Rng } from "./rng";
import { evolveSeason } from "./season";
import { ownershipBlockReason, sellablePlayers, saleBlockReason, squadCount } from "./squad-rules";
import { generated } from "./squads";
import { useGame } from "./store";
import { acceptOffer, completeSigning, processMarketWeek } from "./transfers";
import type { GameSave, Player, ScoutMission, YouthPlayer } from "./types";
import { createCareer } from "./world";

const USER = "int";
const LENDER = "mil";

const ownOf = (s: GameSave) => s.players.filter((p) => p.clubId === s.clubId && !p.loanFrom);
const loanedInOf = (s: GameSave) => s.players.filter((p) => p.clubId === s.clubId && p.loanFrom);

/** Carrera con exactamente `own` propios y `loaned` cedidos de otro club jugando en el usuario. */
function setup(own: number, loaned: number, seed = 3): GameSave {
  const s = createCareer(USER, seed);
  s.budget = 5_000_000_000;
  const mine = s.players.filter((p) => p.clubId === s.clubId);
  // Si hacen falta más propios de los que trae el club, se agregan clonando jugadores generados.
  const rng = new Rng(seed + 1);
  const used = new Set(s.players.map((p) => p.name));
  while (mine.length < own) {
    const extra = generated(USER, VALID_POSITIONS[mine.length % VALID_POSITIONS.length]!, 9000 + mine.length, 80, rng, used);
    s.players.push(extra);
    mine.push(extra);
  }
  const keep = new Set(mine.slice(0, own).map((p) => p.id));
  s.players = s.players.filter((p) => p.clubId !== s.clubId || keep.has(p.id));
  const donors = s.players.filter((p) => p.clubId === LENDER).slice(0, loaned);
  for (const d of donors) {
    d.clubId = s.clubId;
    d.loanFrom = LENDER;
    d.loanSeasons = 1;
    s.loans.push({ playerId: d.id, fromClubId: LENDER, toClubId: s.clubId, seasonsLeft: 1, fee: 0 });
  }
  return s;
}

const load = (s: GameSave) => useGame.setState(s as never);
const state = () => useGame.getState() as unknown as GameSave & ReturnType<typeof useGame.getState>;
const find = (id: string) => state().players.find((p) => p.id === id)!;

/* ── 1. Club con 16 propios + 2 cedidos ─────────────────────────────── */

test("16 propios + 2 cedidos: la plantilla cuenta 18/18 pero solo hay 16 propios", () => {
  const s = setup(16, 2);
  const c = squadCount(s.players, s.clubId);
  assert.equal(c.own, 16);
  assert.equal(c.loanedIn, 2);
  assert.equal(c.total, 18, "los cedidos cuentan para el total de plantilla");
  assert.equal(sellablePlayers(s).length, 16, "los cedidos no son vendibles");
});

test("16 propios + 2 cedidos: no se puede vender ningún propio (mínimo 18 propios)", () => {
  load(setup(16, 2));
  const own = ownOf(state());
  const err = state().sellPlayer(own[0]!.id);
  assert.match(err ?? "", /18/);
  assert.equal(ownOf(state()).length, 16, "nadie salió");
});

/* ── 2 y 3. Vender / venta rápida de un cedido ─────────────────────── */

test("venta rápida de un cedido que llegó a mi club: rechazada y sin cambios (aun con plantilla grande)", () => {
  load(setup(24, 2));
  const guest = loanedInOf(state())[0]!;
  const budget = state().budget;
  const err = state().sellPlayer(guest.id);
  assert.ok(err, "debe devolver error");
  assert.match(err!, /cedido|propietario/i);
  const after = find(guest.id);
  assert.equal(after.clubId, USER);
  assert.equal(after.loanFrom, LENDER);
  assert.equal(state().budget, budget, "no entra dinero");
});

test("venta rápida de un propio que está prestado en otro club: rechazada", () => {
  const s = setup(24, 0);
  const lent = ownOf(s)[0]!;
  lent.clubId = LENDER;
  lent.loanFrom = USER;
  lent.loanSeasons = 1;
  s.loans.push({ playerId: lent.id, fromClubId: USER, toClubId: LENDER, seasonsLeft: 1, fee: 0 });
  load(s);
  const err = state().sellPlayer(lent.id);
  assert.match(err ?? "", /cedido/i);
  assert.equal(find(lent.id).clubId, LENDER);
  assert.ok(!sellablePlayers(s).some((p) => p.id === lent.id), "no figura como vendible");
});

test("aceptar una oferta de compra o de cesión por un cedido: rechazada y la oferta se retira", () => {
  const s = setup(24, 2);
  const guest = loanedInOf(s)[0]!;
  for (const kind of ["buy", "loan"] as const) {
    s.offers = [
      { id: `o-${kind}`, kind, playerId: guest.id, fromClubId: "juv", toClubId: USER, fee: 9_000_000, loanSeasons: kind === "loan" ? 1 : 0, week: s.week, unsolicited: true },
    ];
    const err = acceptOffer(s, `o-${kind}`);
    assert.ok(err, `${kind}: debe rechazarse`);
    assert.equal(s.offers.length, 0, `${kind}: la oferta inválida se retira`);
    assert.equal(guest.clubId, USER);
    assert.equal(guest.loanFrom, LENDER);
  }
});

test("el mercado semanal nunca genera ofertas por cedidos, aunque estén listados o sean cracks", () => {
  const s = setup(22, 3);
  const guests = loanedInOf(s);
  for (const g of guests) {
    g.listed = true; // marca vieja/corrupta
    g.ovr = 92;
    g.pot = 95;
    g.age = 24;
  }
  const ids = new Set(guests.map((g) => g.id));
  const rng = new Rng(11);
  for (let w = 1; w <= 120; w++) {
    s.week = w;
    processMarketWeek(s, rng);
    assert.ok(!s.offers.some((o) => ids.has(o.playerId)), `semana ${w}: hay una oferta por un cedido`);
  }
});

test("las ofertas viejas por cedidos se limpian solas", () => {
  const s = setup(22, 2);
  const guest = loanedInOf(s)[0]!;
  s.offers = [{ id: "stale", kind: "buy", playerId: guest.id, fromClubId: "juv", toClubId: USER, fee: 5_000_000, loanSeasons: 0, week: 1, unsolicited: true }];
  processMarketWeek(s, new Rng(5));
  assert.ok(!s.offers.some((o) => o.id === "stale"));
});

test("no se puede poner en venta ni a cesión a un cedido", () => {
  load(setup(22, 2));
  const guest = loanedInOf(state())[0]!;
  state().toggleListed(guest.id);
  state().toggleLoanListed(guest.id);
  assert.equal(find(guest.id).listed, false);
  assert.equal(find(guest.id).listedForLoan, false);
  const own = ownOf(state())[0]!;
  state().toggleListed(own.id);
  assert.equal(find(own.id).listed, true, "un propio sí se puede listar");
});

/* ── 4. Menos de 18 propios y varios cedidos ──────────────────────── */

test("menos de 18 propios + varios cedidos: no se vende aunque la plantilla total pase de 18", () => {
  const s = setup(14, 6);
  assert.equal(squadCount(s.players, s.clubId).total, 20);
  load(s);
  const err = state().sellPlayer(ownOf(state())[0]!.id);
  assert.match(err ?? "", /18/);
  assert.equal(ownOf(state()).length, 14);
});

test("el mínimo es sobre propios: con 19 propios + cedidos se vende uno; con 18 ya no", () => {
  load(setup(19, 4));
  assert.equal(state().sellPlayer(ownOf(state())[0]!.id), null, "con 19 propios se puede");
  assert.equal(ownOf(state()).length, 18);
  const err = state().sellPlayer(ownOf(state())[0]!.id);
  assert.match(err ?? "", /18/);
  assert.equal(ownOf(state()).length, 18);
  assert.equal(loanedInOf(state()).length, 4, "los cedidos siguen en el club");
});

test("la venta de un propio válido funciona y registra todo bien", () => {
  load(setup(24, 2));
  const target = ownOf(state())[0]!;
  const budget = state().budget;
  assert.equal(state().sellPlayer(target.id), null);
  const sold = find(target.id);
  assert.notEqual(sold.clubId, USER);
  assert.equal(sold.loanFrom, null);
  assert.ok(isValidPos(sold.pos));
  assert.ok(state().budget > budget);
});

/* ── Límite máximo: los cedidos ocupan lugar ──────────────────────── */

test("38 propios + 2 cedidos = 40: no se puede fichar ni subir un juvenil (los cedidos cuentan)", () => {
  const s = setup(SQUAD_LIMIT - 2, 2);
  assert.equal(squadCount(s.players, s.clubId).total, SQUAD_LIMIT);
  const fa = s.freeAgents[0]!;
  const err = completeSigning(s, fa.id, blankTerms(fa), false);
  assert.match(err ?? "", /llena/i);
  assert.ok(s.freeAgents.some((x) => x.id === fa.id), "el libre no fue fichado");

  load(s);
  const y = makeYouth(new Rng(1), "ITA", new Set(), USER, 1);
  useGame.setState({ academy: [y] } as never);
  assert.match(state().signYouth(y.id) ?? "", /llena/i);
});

test("38 propios + 1 cedido = 39: todavía hay lugar para uno", () => {
  const s = setup(SQUAD_LIMIT - 2, 1);
  const fa = s.freeAgents[0]!;
  assert.equal(completeSigning(s, fa.id, blankTerms(fa), false), null);
  assert.equal(squadCount(s.players, s.clubId).total, SQUAD_LIMIT);
});

/* ── 5, 6 y 7. Posiciones: jugador nuevo, juvenil y fichaje ───────── */

const BAD = [undefined, null, "", "  ", "XX", "LM", "RM", 7, {}] as unknown[];

test("normalizePos / coercePos: nunca devuelven vacío ni inválido", () => {
  for (const bad of BAD) {
    const pos = normalizePos(bad);
    assert.ok(isValidPos(pos), `normalizePos(${String(bad)}) → ${pos}`);
  }
  assert.equal(coercePos("LM"), "LW");
  assert.equal(coercePos("rm"), "RW");
  assert.equal(coercePos("st"), "ST");
  assert.equal(coercePos(""), null);
});

test("5. jugador nuevo: generated() siempre queda con posición válida", () => {
  const rng = new Rng(9);
  const used = new Set<string>();
  for (const bad of BAD) {
    const p = generated(USER, bad as never, 1, 80, rng, used);
    assert.ok(isValidPos(p.pos), `generated(${String(bad)}) → ${p.pos}`);
    assert.ok(p.attrs && Object.values(p.attrs).every(Number.isFinite), "con atributos coherentes");
  }
});

test("6. juvenil: makeYouth / resolveScouts / youthToPlayer siempre con posición válida", () => {
  const rng = new Rng(4);
  for (const bad of BAD) {
    const y = makeYouth(rng, "ARG", new Set(), USER, 1, { pos: bad as never });
    assert.ok(isValidPos(y.pos), `makeYouth(${String(bad)}) → ${y.pos}`);
  }
  for (const bad of [...BAD, "ANY"]) {
    const mission: ScoutMission = { id: "sc", countryId: "arg", countryName: "Argentina", nat: "ARG", weeksLeft: 1, cost: 1, preferredPos: bad as never, tier: 2 };
    const { found } = resolveScouts([mission], [], 1, USER, rng, new Set());
    assert.ok(found.length > 0);
    for (const y of found) assert.ok(isValidPos(y.pos), `scout(${String(bad)}) → ${y.pos}`);
  }
  for (const bad of BAD) {
    const y = { ...makeYouth(rng, "ITA", new Set(), USER, 1), pos: bad } as unknown as YouthPlayer;
    const p = youthToPlayer(y, USER, rng);
    assert.ok(isValidPos(p.pos), `youthToPlayer(${String(bad)}) → ${p.pos}`);
  }
});

test("6b. subir un juvenil guardado sin posición (partida vieja) deja un jugador con posición", () => {
  load(setup(20, 0));
  const y = { ...makeYouth(new Rng(2), "ITA", new Set(), USER, 1), pos: undefined } as unknown as YouthPlayer;
  useGame.setState({ academy: [y] } as never);
  assert.equal(state().signYouth(y.id), null);
  const signed = state().players.find((p) => p.id === `p-${y.id}`)!;
  assert.ok(isValidPos(signed.pos));
});

test("7. fichaje: libres y jugadores de otros clubes entran con posición válida", () => {
  const s = setup(20, 0);
  // agente libre con posición corrupta
  const fa = s.freeAgents[0]!;
  (fa as { pos: unknown }).pos = undefined;
  assert.equal(completeSigning(s, fa.id, blankTerms(fa), false), null);
  assert.ok(isValidPos(fa.pos));
  assert.equal(fa.clubId, USER);

  // jugador de otro club con posición corrupta
  const other = s.players.find((p) => p.clubId === "juv" && !p.loanFrom)!;
  (other as { pos: unknown }).pos = "";
  assert.equal(completeSigning(s, other.id, blankTerms(other), false), null);
  assert.ok(isValidPos(other.pos));
  assert.equal(other.loanFrom, null);

  // fichaje de la IA
  const ai = s.freeAgents[1]!;
  (ai as { pos: unknown }).pos = null;
  signFreeAgent(s, ai, "bar");
  assert.ok(isValidPos(ai.pos));
});

test("la carrera nueva y una temporada completa no dejan a nadie sin posición", () => {
  const s = createCareer(USER, 7);
  const check = (label: string, list: Array<{ name: string; pos: unknown }>) => {
    const bad = list.filter((p) => !isValidPos(p.pos));
    assert.equal(bad.length, 0, `${label}: ${bad.map((p) => `${p.name}=${String(p.pos)}`).join(", ")}`);
  };
  check("jugadores", s.players);
  check("libres", s.freeAgents);
  check("cantera", s.academy);
  // los antiguos LM/RM de names.ts ahora son extremos
  for (const nm of ["Joaquín Gho", "Juan Velázquez", "Facundo Waller"]) {
    const p = s.players.find((x) => x.name === nm);
    if (p) assert.ok(p.pos === "LW" || p.pos === "RW", `${nm} → ${p.pos}`);
  }
  const rng = new Rng(21);
  for (let w = 1; w <= 40; w++) {
    s.week = w;
    processMarketWeek(s, rng);
  }
  check("jugadores tras 40 semanas de mercado", s.players);
  check("libres tras 40 semanas de mercado", s.freeAgents);
  const next = evolveSeason(s);
  check("jugadores tras el cierre de temporada", next.players);
  check("libres tras el cierre de temporada", next.freeAgents);
});

test("el cierre de temporada repara posiciones dañadas y regenera retirados con posición", () => {
  const s = createCareer(USER, 8);
  const old = s.players.filter((p) => p.clubId !== USER).slice(0, 5);
  for (const p of old) {
    (p as { pos: unknown }).pos = undefined;
    p.age = 40; // se retira → regen
  }
  const broken = s.players.filter((p) => p.clubId !== USER).slice(10, 14);
  for (const p of broken) (p as { pos: unknown }).pos = "";
  const next = evolveSeason(s);
  assert.equal(next.players.filter((p) => !isValidPos(p.pos)).length, 0);
  assert.equal(repairPositions([{ pos: "" }, { pos: "CB" }, {}]), 2);
});

/* ── Ownership helper ─────────────────────────────────────────────── */

test("ownershipBlockReason distingue propio, cedido que llegó y cedido prestado fuera", () => {
  const s = setup(20, 1);
  const own = ownOf(s)[0]!;
  const guest = loanedInOf(s)[0]!;
  const lent = ownOf(s)[1]!;
  lent.clubId = LENDER;
  lent.loanFrom = USER;
  assert.equal(ownershipBlockReason(own, USER), null);
  assert.match(ownershipBlockReason(guest, USER)!, /propietario/);
  assert.match(ownershipBlockReason(lent, USER)!, /cedido/);
  assert.equal(saleBlockReason(s, own as Player), null);
});
