import assert from "node:assert/strict";
import { test } from "node:test";
import { ACADEMY_MAX } from "./academy";
import { EVENTS, listEventCandidates, type DecisionEventDef } from "./events";
import { academyHasRoom, isCaptain, isLegend, isYouth, squadHasRoom, userSquad } from "./event-kit";
import { SQUAD_LIMIT } from "./format";
import { createCareer } from "./world";

test("la biblioteca es grande y no repite ids", () => {
  const ids = EVENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length, "hay ids repetidos");
  assert.ok(EVENTS.length >= 90, `solo ${EVENTS.length} sucesos`);
});

test("hay de todos los tipos pedidos: tono, decisión, juvenil, capitán, leyenda, raro", () => {
  const cats = new Set(EVENTS.map((e) => e.category));
  for (const c of ["positive", "negative", "neutral", "decision", "player"] as const) {
    assert.ok(cats.has(c), `falta categoría ${c}`);
  }
  assert.ok(EVENTS.some((e) => e.players && /captain|brazalete|capitán/i.test(e.id + (e.category === "decision" ? e.id : ""))));
  assert.ok(EVENTS.some((e) => e.id.includes("legend") || e.id.includes("leg-") || e.id.includes("leyend") || e.id.includes("legend-son") || e.id.includes("acd-legend")));
  assert.ok(EVENTS.some((e) => e.youths || e.id.startsWith("acd-")));
  assert.ok(EVENTS.filter((e) => e.category === "decision").length >= 15);
  assert.ok(EVENTS.some((e) => (e.cooldown ?? 0) >= 40));
});

test("el hijo de una leyenda no sale si la cantera o la plantilla están llenas", () => {
  const save = createCareer("int", 3);
  const son = EVENTS.filter((e) => e.id === "acd-legend-son" || e.id === "decision-legend-son");
  assert.equal(son.length, 2);
  for (const def of son) {
    assert.ok(def.eligible);
    assert.equal(def.eligible!(save), true);
    save.academy = Array.from({ length: ACADEMY_MAX }, (_, i) => ({
      id: `y-full-${i}`,
      name: `Pibe ${i}`,
      nat: "ITA",
      age: 17,
      pos: "CM",
      ovr: 60,
      pot: 75,
      weeksIn: 0,
      fee: 1_000_000,
    }));
    assert.equal(academyHasRoom(save), false);
    assert.equal(def.eligible!(save), false);
    save.academy = [];
    const squad = userSquad(save);
    const extra = SQUAD_LIMIT - squad.length;
    for (let i = 0; i < extra; i++) {
      save.players.push({ ...squad[0]!, id: `pad-${i}`, name: `Pad ${i}` });
    }
    assert.equal(squadHasRoom(save), false);
    assert.equal(def.eligible!(save), false);
  }
});

test("un suceso de capitán solo elige al capitán, uno de juvenil solo a juveniles", () => {
  const save = createCareer("int", 4);
  const capDef = EVENTS.find((e) => e.id === "pos-captain-speech")!;
  const youthDef = EVENTS.find((e) => e.id === "pos-youth-training-leap")!;
  const squad = userSquad(save);
  const caps = squad.filter((p) => capDef.players!(p, save));
  assert.equal(caps.length, 1);
  assert.equal(isCaptain(caps[0]!, save), true);
  const kids = squad.filter((p) => youthDef.players!(p, save));
  assert.ok(kids.length >= 1);
  assert.ok(kids.every(isYouth));
});

test("los sucesos graves son raros (poco peso, mucho enfriamiento)", () => {
  for (const id of ["decision-betting", "decision-grave-legal", "player-gender-transition"]) {
    const def = EVENTS.find((e) => e.id === id)!;
    assert.ok(def.weight <= 1, id);
    assert.ok((def.cooldown ?? 0) >= 40, id);
  }
});

test("no hay sucesos que describan abuso de menores", () => {
  const blob = JSON.stringify(EVENTS.map((e) => e.id));
  assert.equal(/porn|csam|infantil|pedofil/i.test(blob), false);
});

test("el suceso especial de transición sigue en ~1% de su categoría", () => {
  const save = createCareer("int", 2);
  const list = listEventCandidates(save, "pre");
  const rare = list.find((c) => c.id === "player-gender-transition")!;
  const playerCat = list.filter((c) => c.category === "player");
  const others = playerCat.filter((c) => c.id !== "player-gender-transition").reduce((s, c) => s + c.weight, 0);
  const ref = others > 0 ? others : list.filter((c) => c.id !== "player-gender-transition").reduce((s, c) => s + c.weight, 0);
  const share = rare.weight / (rare.weight + ref);
  assert.ok(Math.abs(share - 0.01) < 1e-6, `${share}`);
});

test("una leyenda viva existe en planteles típicos (para el hijo y las visitas)", () => {
  for (const club of ["int", "cag", "rma"] as const) {
    const save = createCareer(club, 5);
    assert.ok(userSquad(save).some(isLegend), club);
  }
});

test("las decisiones nuevas tienen 2-4 opciones con pista", () => {
  const decisions = EVENTS.filter((e): e is DecisionEventDef => e.category === "decision");
  assert.ok(decisions.length >= 15);
  for (const d of decisions) {
    assert.ok(d.options.length >= 2 && d.options.length <= 4, d.id);
    for (const o of d.options) assert.ok(o.hint?.trim(), `${d.id}:${o.id}`);
  }
});
