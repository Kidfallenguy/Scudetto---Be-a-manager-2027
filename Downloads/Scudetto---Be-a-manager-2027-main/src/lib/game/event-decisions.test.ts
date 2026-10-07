// Pruebas de la estructura de decisiones. Se corren con:  npx tsx --test src/lib/game/event-decisions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DECISION_STANCES, auditDecisionEvent, dominates, impactOf, pickBranch, scaledMoney } from "./event-decisions";
import { EVENTS, resolveEventDecision, type DecisionEventDef } from "./events";
import { Rng } from "./rng";
import { isUnavailable } from "./tactics";
import type { GameSave, Player } from "./types";
import { createCareer } from "./world";

const decisions = EVENTS.filter((e): e is DecisionEventDef => e.category === "decision");
const CLUBS = ["int", "cag", "rma"] as const;

function setup(clubId: string, seed = 1) {
  const save = createCareer(clubId, seed);
  save.board = save.board ?? undefined;
  return save;
}

function protagonist(def: DecisionEventDef, save: GameSave): Player | undefined {
  if (!def.players) return undefined;
  const squad = save.players.filter((p) => p.clubId === save.clubId && !p.loanFrom);
  return squad.find((p) => def.players!(p, save));
}

/** Arma el aviso de la decisión como lo hace el sorteo y lo deja en la cola de avisos. */
function openDecision(def: DecisionEventDef, save: GameSave, player?: Player) {
  const text = def.prompt(save, new Rng(1), player);
  const popup = {
    id: `pop-${def.id}`,
    kind: "event" as const,
    tone: "neutral" as const,
    title: text.title,
    body: text.body,
    choices: def.options.map((o) => ({ id: o.id, label: o.label })),
    eventId: def.id,
    eventPlayerId: player?.id,
  };
  save.popups.push(popup);
  return popup;
}

test("hay decisiones y entre todas usan las diez posturas pedidas", () => {
  assert.ok(decisions.length >= 3);
  const used = new Set(decisions.flatMap((d) => d.options.map((o) => o.stance)));
  for (const s of DECISION_STANCES) assert.ok(used.has(s), `falta la postura ${s}`);
});

for (const clubId of CLUBS) {
  for (const def of decisions) {
    test(`auditoría: ${def.id} en ${clubId} no tiene opción perfecta ni problemas de estructura`, () => {
      const save = setup(clubId);
      const player = protagonist(def, save);
      if (def.players) assert.ok(player, "el filtro de protagonista no encontró a nadie en el plantel");
      const audit = auditDecisionEvent(def, save, player, (seed) => new Rng(seed));
      assert.deepEqual(audit.problems, []);
    });
  }
}

test("cada opción puede producir consecuencias distintas (las arriesgadas tienen más de un desenlace)", () => {
  const save = setup("int");
  let risky = 0;
  for (const def of decisions) {
    const player = protagonist(def, save);
    for (const o of def.options) {
      const outcomes = new Set<string>();
      for (let i = 1; i <= 200; i++) outcomes.add(o.apply(save, new Rng(i * 31), player).title);
      if (outcomes.size > 1) risky += 1;
    }
  }
  assert.ok(risky >= 3, `solo ${risky} opciones tienen desenlaces distintos`);
});

test("pickBranch respeta los pesos", () => {
  const rng = new Rng(5);
  const hits = { a: 0, b: 0 };
  const r = (t: string) => ({ tone: "neutral" as const, title: t, body: t });
  for (let i = 0; i < 4000; i++) {
    const out = pickBranch(rng, [
      { chance: 75, result: r("a") },
      { chance: 25, result: r("b") },
    ]);
    hits[out.title as "a" | "b"] += 1;
  }
  assert.ok(hits.a > 2800 && hits.a < 3200, `a=${hits.a}`);
});

test("elegir una opción con costo lo descuenta, aplica consecuencias y deja el resultado en el aviso", () => {
  const def = decisions.find((d) => d.id === "decision-family-leave")!;
  const save = setup("int");
  const player = protagonist(def, save)!;
  const popup = openDecision(def, save, player);
  const budget = save.budget;
  const cost = scaledMoney(save, 0.1, 80_000);
  assert.equal(resolveEventDecision(save, popup.id, "care"), null);
  assert.equal(save.budget, budget - cost);
  assert.ok(isUnavailable(save.players.find((p) => p.id === player.id)!), "debe quedar no disponible");
  assert.equal(save.players.find((p) => p.id === player.id)!.absence?.kind, "personal");
  const shown = save.popups[0]!;
  assert.equal(shown.choices, undefined);
  assert.ok(shown.decision?.includes("Darle tiempo"));
  assert.ok(shown.effects?.some((l) => l.includes("Caja del club")));
  assert.ok(shown.effects?.some((l) => l.includes("Ánimo de")));
  assert.ok(shown.effects?.some((l) => l.includes("Relación de")));
  assert.equal(save.popups.length, 1);
});

test("una opción con costo sin caja se rechaza, no cambia nada y el aviso sigue abierto", () => {
  const def = decisions.find((d) => d.id === "decision-federation-sanction")!;
  const save = setup("cag");
  const popup = openDecision(def, save);
  save.budget = 10_000;
  const err = resolveEventDecision(save, popup.id, "appeal");
  assert.equal(err, "Caja insuficiente");
  assert.equal(save.budget, 10_000);
  assert.ok(save.popups[0]!.choices, "el aviso debe seguir abierto");
  // Con otra opción disponible se puede salir igual.
  assert.equal(resolveEventDecision(save, popup.id, "accept"), null);
  assert.equal(save.popups.length, 1);
  assert.equal(save.popups[0]!.choices, undefined);
});

test("la decisión no sale si ninguna opción es elegible, y las opciones con costo se muestran bloqueadas", async () => {
  const { describeChoices } = await import("./event-decisions");
  const def = decisions.find((d) => d.id === "decision-federation-sanction")!;
  const save = setup("cag");
  save.budget = 0;
  const choices = describeChoices(def.options, save);
  assert.equal(choices.find((c) => c.id === "appeal")!.disabled, true);
  assert.equal(choices.find((c) => c.id === "appeal")!.reason, "Caja insuficiente");
  assert.ok(!choices.find((c) => c.id === "accept")!.disabled);
});

test("si el protagonista ya no está en el club, la situación se cierra sin consecuencias", () => {
  const def = decisions.find((d) => d.id === "decision-discipline")!;
  const save = setup("int");
  const player = protagonist(def, save)!;
  const popup = openDecision(def, save, player);
  save.players.find((p) => p.id === player.id)!.clubId = "cag";
  const budget = save.budget;
  assert.equal(resolveEventDecision(save, popup.id, "punish"), null);
  assert.equal(save.budget, budget);
  assert.equal(save.popups.length, 1);
  assert.ok(save.popups[0]!.body.includes("ya no está en el club"));
});

test("un aviso huérfano se retira y nunca traba la cola", () => {
  const save = setup("int");
  save.popups.push({ id: "x1", kind: "event", tone: "neutral", title: "t", body: "b", eventId: "no-existe", choices: [{ id: "a", label: "A" }] });
  assert.ok(resolveEventDecision(save, "x1", "a"));
  assert.equal(save.popups.length, 0);
  assert.ok(resolveEventDecision(save, "x1", "a"));
});

test("resolver dos veces la misma decisión no aplica las consecuencias dos veces", () => {
  const def = decisions.find((d) => d.id === "decision-federation-sanction")!;
  const save = setup("int");
  const popup = openDecision(def, save);
  resolveEventDecision(save, popup.id, "accept");
  const budget = save.budget;
  assert.ok(resolveEventDecision(save, popup.id, "accept"));
  assert.equal(save.budget, budget);
});

test("castigar y respaldar mueven relaciones en sentidos opuestos (sin opción perfecta)", () => {
  const def = decisions.find((d) => d.id === "decision-discipline")!;
  const a = setup("int");
  const pa = protagonist(def, a)!;
  resolveEventDecision(a, openDecision(def, a, pa).id, "punish");
  const b = setup("int");
  const pb = protagonist(def, b)!;
  resolveEventDecision(b, openDecision(def, b, pb).id, "back");
  const A = a.players.find((p) => p.id === pa.id)!;
  const B = b.players.find((p) => p.id === pb.id)!;
  assert.ok((A.bond?.club ?? 70) < 70 && (A.bond?.squad ?? 70) > 70);
  assert.ok((B.bond?.club ?? 70) > 70 && (B.bond?.squad ?? 70) < 70);
  assert.ok(A.morale < B.morale);
});

test("el detector de dominancia funciona", () => {
  const worse = impactOf([{ kind: "money", amount: -1_000_000 }]);
  const better = impactOf([{ kind: "money", amount: -200_000 }]);
  assert.ok(dominates(better, worse));
  assert.ok(!dominates(worse, better));
  const mixed = impactOf([
    { kind: "money", amount: -1_000_000 },
    { kind: "board", delta: 2 },
  ]);
  // `mixed` gana en dirigencia pero pierde en dinero frente a `better`: ninguna domina a la otra.
  assert.ok(!dominates(mixed, better) && !dominates(better, mixed));
});
