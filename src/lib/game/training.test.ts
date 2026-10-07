import assert from "node:assert/strict";
import test from "node:test";
import { Rng } from "./rng";
import {
  TRAINING_TIERS,
  maxGainFor,
  rollTrainingOutcome,
  sixMonthDays,
  trainingTimeLeftLabel,
} from "./training";
import type { TrainingPlan, TrainingTier } from "./types";

const TIERS: TrainingTier[] = ["progressive", "intensive", "elite"];

function stats(tier: TrainingTier, p: { age: number; ovr: number; pot: number }, n = 4000) {
  const rng = new Rng(99);
  let sum = 0;
  let max = 0;
  let potUps = 0;
  for (let i = 0; i < n; i++) {
    const r = rollTrainingOutcome(p, tier, rng);
    sum += r.gain;
    max = Math.max(max, r.gain);
    if (r.potGain > 0) potUps++;
  }
  return { avg: sum / n, max, potRate: potUps / n };
}

test("precios y cupos de los tres niveles", () => {
  assert.equal(TRAINING_TIERS.progressive.cost, 5_000_000);
  assert.equal(TRAINING_TIERS.intensive.cost, 70_000_000);
  assert.equal(TRAINING_TIERS.elite.cost, 150_000_000);
  assert.equal(TRAINING_TIERS.progressive.maxPlayers, 3);
  assert.equal(TRAINING_TIERS.intensive.maxPlayers, 2);
});

test("intensivo: jóvenes <79 hasta +7, GRL 80+ hasta +3", () => {
  assert.equal(stats("intensive", { age: 18, ovr: 60, pot: 85 }).max <= 7, true);
  assert.equal(stats("intensive", { age: 18, ovr: 60, pot: 85 }).max >= 6, true);
  for (const ovr of [80, 84, 88, 93]) {
    assert.equal(stats("intensive", { age: 22, ovr, pot: 95 }).max <= 3, true);
  }
});

test("élite: jóvenes <70 llegan a +15 como techo y GRL alto sube muy poco", () => {
  const young = stats("elite", { age: 17, ovr: 58, pot: 90 });
  assert.equal(young.max <= 15, true);
  assert.equal(young.max >= 13, true);
  assert.equal(stats("elite", { age: 27, ovr: 90, pot: 95 }).max <= 2, true);
  assert.equal(stats("elite", { age: 29, ovr: 94, pot: 96 }).max <= 1, true);
});

test("cada nivel rinde más que el anterior para un joven con potencial", () => {
  const p = { age: 18, ovr: 62, pot: 86 };
  const [a, b, c] = TIERS.map((t) => stats(t, p).avg) as [number, number, number];
  assert.equal(a < b && b < c, true);
  // el progresivo no es inútil
  assert.equal(a >= 1.5, true);
});

test("el élite nunca rinde menos que el intensivo", () => {
  for (const age of [17, 20, 23, 26, 29, 33]) {
    for (const ovr of [55, 68, 76, 82, 88, 93]) {
      assert.equal(maxGainFor("elite", age, ovr) >= maxGainFor("intensive", age, ovr), true, `${age}/${ovr}`);
    }
  }
});

test("sin margen de potencial no hay mejora (salvo que el potencial suba)", () => {
  const rng = new Rng(5);
  for (let i = 0; i < 500; i++) {
    const r = rollTrainingOutcome({ age: 30, ovr: 80, pot: 80 }, "intensive", rng);
    assert.equal(r.gain, 0);
  }
});

test("el potencial sube poco en progresivo/intensivo y es raro en élite", () => {
  const p = { age: 19, ovr: 65, pot: 80 };
  assert.equal(stats("progressive", p).potRate < 0.05, true);
  assert.equal(stats("intensive", p).potRate < 0.12, true);
  const e = stats("elite", p).potRate;
  assert.equal(e > 0.08 && e < 0.35, true);
});

test("el ciclo dura 6 meses de calendario", () => {
  assert.equal(sixMonthDays("2026-07-01"), 184);
  assert.equal(sixMonthDays("2026-08-31"), 181);
  assert.equal(sixMonthDays("basura"), 182);
});

test("tiempo restante legible", () => {
  const plan: TrainingPlan = { id: "t", tier: "elite", cost: 1, assignments: [], startDate: "", elapsedDays: 60, totalDays: 182 };
  assert.match(trainingTimeLeftLabel(plan), /4 meses/);
  assert.equal(trainingTimeLeftLabel({ ...plan, elapsedDays: 182 }), "termina en la próxima fecha");
});
