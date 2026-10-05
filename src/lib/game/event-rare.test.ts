// Pruebas del evento especial "player-gender-transition".  Se corren con:
//   npx tsx --test src/lib/game/event-rare.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { SQUAD_MIN } from "./format";
import {
  EVENTS,
  listEventCandidates,
  normalizeEventState,
  rollPreMatchEvent,
  type EventDef,
  type InstantEventDef,
} from "./events";
import { FORMATIONS } from "./tactics";
import type { GameSave } from "./types";
import { createCareer } from "./world";

const ID = "player-gender-transition";
const def = EVENTS.find((e) => e.id === ID) as InstantEventDef;

function setup(clubId = "int", seed = 3) {
  return createCareer(clubId, seed);
}
const squadOf = (s: GameSave) => s.players.filter((p) => p.clubId === s.clubId && !p.loanFrom);

/** Reemplaza el sorteo por el evento raro + un relleno, y lo fuerza (share alto) para probar todo el recorrido real. */
function forceFire(save: GameSave) {
  const original = [...EVENTS];
  const share = def.categoryShare;
  const filler: EventDef = {
    id: "test-filler",
    category: "player",
    topic: "club",
    timing: "any",
    weight: 0.001,
    run: () => null,
  } as InstantEventDef;
  EVENTS.length = 0;
  EVENTS.push(filler, def);
  def.categoryShare = 0.5;
  try {
    // La tirada de la previa tiene un azar propio: se prueba hasta que salga.
    const st = (save.events ??= normalizeEventState(null));
    for (let i = 0; i < 400 && !st.history[ID]; i++) {
      st.matchIndex = 10 + i * 5;
      st.lastRolledWindow = -99;
      rollPreMatchEvent(save);
    }
    assert.ok(st.history[ID] !== undefined, "el evento no llegó a salir");
  } finally {
    EVENTS.length = 0;
    EVENTS.push(...original);
    def.categoryShare = share;
  }
}

test("está declarado como raro: ~1% de su categoría, una sola vez por carrera, jugador adulto", () => {
  assert.equal(def.category, "player");
  assert.equal(def.categoryShare, 0.01);
  assert.ok((def.cooldown ?? 0) >= 10_000);
  const save = setup();
  const kid = squadOf(save)[0]!;
  kid.age = 17;
  assert.equal(def.players!(kid, save), false);
  kid.age = 24;
  assert.equal(def.players!(kid, save), true);
});

test("pesa 1% dentro de la categoría 'player', sin importar cuántos sucesos haya", () => {
  const save = setup();
  const original = [...EVENTS];
  try {
    for (const total of [20, 100, 400]) {
      EVENTS.length = 0;
      EVENTS.push(def);
      for (let i = 0; i < 10; i++) {
        EVENTS.push({ id: `f${i}`, category: "player", topic: "club", timing: "any", weight: total / 10, run: () => null } as InstantEventDef);
      }
      const list = listEventCandidates(save, "pre");
      const rare = list.find((c) => c.id === ID)!;
      const others = list.filter((c) => c.category === "player" && c.id !== ID).reduce((s, c) => s + c.weight, 0);
      assert.ok(rare, "debe ser candidato");
      const share = rare.weight / (rare.weight + others);
      assert.ok(Math.abs(share - 0.01) < 1e-9, `total ${total}: ${share}`);
    }
  } finally {
    EVENTS.length = 0;
    EVENTS.push(...original);
  }
});

test("con los sucesos actuales (sin otros de jugador) pesa ~1% del total en vez de quedar en cero", () => {
  const list = listEventCandidates(setup(), "pre");
  const rare = list.find((c) => c.id === ID)!;
  const total = list.reduce((s, c) => s + c.weight, 0);
  assert.ok(rare);
  assert.ok(rare.weight / total > 0.007 && rare.weight / total < 0.013, `${rare.weight / total}`);
});

test("no sale si la plantilla está en el mínimo", () => {
  const save = setup();
  const extra = squadOf(save).slice(SQUAD_MIN);
  for (const p of extra) p.clubId = "cag";
  assert.equal(squadOf(save).length, SQUAD_MIN);
  assert.ok(!listEventCandidates(save, "pre").some((c) => c.id === ID));
});

test("recorrido completo: se registra el evento, la salida, el dinero y el mensaje", () => {
  const save = setup();
  const before = squadOf(save).length;
  const budget = save.budget;
  const ids = new Set(squadOf(save).map((p) => p.id));
  forceFire(save);

  const st = save.events!;
  // 1) Queda registrado que ocurrió.
  assert.ok(st.history[ID] !== undefined);
  assert.equal(st.recent[0]!.id, ID);
  assert.equal(st.recent[0]!.tone, "good");
  assert.equal(st.seasonCount, 1);

  // 2) Salida de la plantilla masculina.
  const dep = st.departures!;
  assert.equal(dep.length, 1);
  const d = dep[0]!;
  assert.ok(ids.has(d.playerId));
  assert.equal(save.players.some((p) => p.id === d.playerId), false, "no debe quedar en ninguna lista de jugadores");
  assert.equal(squadOf(save).length, before - 1);
  assert.equal(d.eventId, ID);

  // 3) Dinero: ~50% del valor que tenía.
  assert.ok(d.compensation > 0);
  assert.equal(save.budget, budget + d.compensation);
  assert.equal(st.playerHistory[d.playerId] !== undefined, true);

  // 4) Alineación y banquillo limpios y completos.
  const slots = FORMATIONS[save.tactics.formation].slots.length;
  assert.equal(save.tactics.lineup.length, slots);
  assert.ok(!save.tactics.lineup.includes(d.playerId));
  assert.ok(!save.tactics.bench.includes(d.playerId));
  assert.equal(new Set(save.tactics.lineup).size, slots);

  // 5) Mensaje al usuario: noticia + aviso positivo con las consecuencias redactadas.
  const pop = save.popups.at(-1)!;
  assert.equal(pop.tone, "good");
  assert.equal(pop.choices, undefined);
  assert.ok(pop.title.includes(d.name));
  assert.ok(/transición de género/.test(pop.body) && /agradeci/i.test(pop.body) && /apoyo/.test(pop.body));
  assert.ok(pop.effects?.some((l) => l.includes("deja la plantilla masculina")));
  assert.ok(pop.effects?.some((l) => l.includes("Caja del club +")));
  const n = save.news[0]!;
  assert.equal(n.tone, "good");
  assert.ok(n.title.includes(d.name));
  // Ningún tono de castigo.
  assert.ok(!/castig|sanci|multa|expuls/i.test(pop.body));

  // 6) No vuelve a salir en toda la carrera.
  assert.ok(!listEventCandidates(save, "pre").some((c) => c.id === ID));
});

test("la compensación es el 50% del valor del jugador (redondeado al millar)", () => {
  const save = setup("cag");
  const p = squadOf(save).find((x) => x.age >= 18)!;
  p.value = 12_345_678;
  const out = def.run(save, { float: () => 0 } as never, p)!;
  const money = out.effects!.find((e) => e.kind === "money") as { amount: number };
  assert.equal(money.amount, 6_173_000);
  const leave = out.effects!.find((e) => e.kind === "leaveSquad");
  assert.ok(leave);
  // run no toca la partida: eso lo hace el motor.
  assert.ok(save.players.some((x) => x.id === p.id));
});

test("limpia ofertas, entrenamiento y cesiones que nombraban al jugador", async () => {
  const { applyEventEffects } = await import("./event-effects");
  const save = setup();
  save.events ??= normalizeEventState(null);
  const p = squadOf(save)[0]!;
  save.offers.push({ id: "o1", kind: "buy", playerId: p.id, fromClubId: "cag", toClubId: save.clubId, fee: 1, loanSeasons: 0, week: 1, unsolicited: true });
  save.trainingPlan = { assignments: [{ playerId: p.id, stats: [] }], startDate: "2026-07-01", elapsedDays: 0, totalDays: 182 };
  const r = applyEventEffects(save, [{ kind: "leaveSquad", target: p, eventId: ID, compensation: 5 }]);
  assert.equal(r.lines.length, 1);
  assert.equal(save.offers.some((o) => o.playerId === p.id), false);
  assert.equal(save.trainingPlan!.assignments.length, 0);
  // Aplicarlo dos veces no duplica el registro ni rompe nada.
  applyEventEffects(save, [{ kind: "leaveSquad", target: p, eventId: ID, compensation: 5 }]);
  assert.equal(save.events!.departures!.length, 1);
});

test("partidas viejas sin registro de salidas se normalizan y las salidas guardadas se conservan", () => {
  assert.deepEqual(normalizeEventState({ matchIndex: 3 }).departures, []);
  const dep = { playerId: "p1", name: "X", pos: "CM" as const, ovr: 70, age: 22, eventId: ID, season: 1, week: 4, compensation: 1000 };
  const kept = normalizeEventState({ departures: [dep, { bad: true } as never] }).departures!;
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.compensation, 1000);
  assert.deepEqual(JSON.parse(JSON.stringify(kept)), kept);
});
