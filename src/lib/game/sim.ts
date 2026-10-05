import { clubById } from "./clubs";
import { Rng } from "./rng";
import { posGroup } from "./format";
import { axisRatings, benchRating, isUnavailable, pickBench, pickXi } from "./tactics";
import type {
  Fixture,
  MatchEvent,
  MatchResult,
  MatchStats,
  Mentality,
  Player,
} from "./types";

const MENTALITY_MOD: Record<Mentality, { atk: number; def: number }> = {
  defensive: { atk: 0.88, def: 1.12 },
  balanced: { atk: 1, def: 1 },
  attacking: { atk: 1.14, def: 0.9 },
};

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

export function autoLineup(players: Player[], clubId: string): string[] {
  const squad = players.filter((p) => p.clubId === clubId);
  return pickXi(squad, "433");
}

/** Banquillo automático de un club (lo usa la IA y el usuario si no eligió suplentes). */
export function autoBench(players: Player[], clubId: string, lineup: string[]): string[] {
  const squad = players.filter((p) => p.clubId === clubId);
  return pickBench(squad, lineup);
}

export function effectiveOvr(p: Player): number {
  return p.ovr + p.form * 0.5 + (p.fitness - 85) * 0.05 - (isUnavailable(p) ? 8 : 0);
}

/** Squad GRL: every player counts, starters and stars weigh more. */
export function clubQuality(
  players: Player[],
  clubId: string,
  lineup: string[] = [],
  bench?: string[],
): number {
  const squad = players.filter((p) => p.clubId === clubId);
  if (!squad.length) return 60;
  const sorted = [...squad].sort((a, b) => b.ovr - a.ovr);
  let s = 0;
  let w = 0;
  sorted.forEach((p, i) => {
    const weight = i < 11 ? 1 : i < 16 ? 0.45 : 0.12;
    s += p.ovr * weight;
    w += weight;
  });
  const squadScore = s / Math.max(1, w);
  const xi = lineup
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
  const xiScore = xi.length
    ? xi.reduce((n, p) => n + effectiveOvr(p), 0) / xi.length
    : squadScore;
  const base = xiScore * 0.58 + squadScore * 0.42;
  // Los suplentes pesan poco: un banquillo mejor o peor que el que armaría el cuerpo técnico mueve
  // la media apenas (un banquillo vacío resta un par de puntos como mucho).
  if (!xi.length || !bench) return base;
  const reference = benchRating(players, pickBench(squad, lineup));
  const chosen = benchRating(players, bench);
  return base + clampNum((chosen - reference) * 0.12, -2, 0.8);
}

function sampleGoals(lambda: number, rng: Rng): number {
  const lam = Math.max(0.12, lambda);
  const base = Math.floor(lam);
  const frac = lam - base;
  let g = base + (rng.chance(frac) ? 1 : 0);
  if (rng.chance(0.16)) g += 1;
  if (rng.chance(0.1) && g > 0) g -= 1;
  if (rng.chance(0.04)) g += rng.int(0, 1);
  return Math.min(6, Math.max(0, g));
}

function attackName(players: Player[], ids: string[], rng: Rng): Player | undefined {
  const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p));
  const atk = xi.filter((p) => p.pos === "ST" || p.pos === "LW" || p.pos === "RW" || p.pos === "CAM");
  const pool = atk.length ? atk : xi.filter((p) => p.pos !== "GK");
  if (!pool.length) return undefined;
  const weights = pool.map((p) => Math.max(8, p.attrs.sho + p.form * 2));
  const total = weights.reduce((s, w) => s + w, 0);
  let roll = rng.float() * total;
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i];
  }
  return pool[0];
}

function midName(players: Player[], ids: string[], rng: Rng): Player | undefined {
  const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p));
  const mid = xi.filter((p) => p.pos === "CM" || p.pos === "CAM" || p.pos === "CDM" || p.pos === "LW" || p.pos === "RW");
  const pool = mid.length ? mid : xi;
  return pool.length ? rng.pick(pool) : undefined;
}

function defName(players: Player[], ids: string[], rng: Rng): Player | undefined {
  const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => Boolean(p));
  const def = xi.filter((p) => p.pos === "CB" || p.pos === "LB" || p.pos === "RB" || p.pos === "GK");
  return (def.length ? rng.pick(def) : xi[0]) ?? undefined;
}

export function simulateMatch(
  fixture: Fixture,
  players: Player[],
  opts: {
    seed: number;
    homeLineup?: string[];
    awayLineup?: string[];
    homeBench?: string[];
    awayBench?: string[];
    homeMentality?: Mentality;
    awayMentality?: Mentality;
    /** Puntos de GRL de equipo que suman o restan sucesos y relaciones (preparación, ambiente...). */
    homeBoost?: number;
    awayBoost?: number;
  },
): MatchResult {
  const rng = new Rng(opts.seed);
  const homeLineup = opts.homeLineup?.length === 11 ? opts.homeLineup : autoLineup(players, fixture.homeId);
  const awayLineup = opts.awayLineup?.length === 11 ? opts.awayLineup : autoLineup(players, fixture.awayId);
  const hm = MENTALITY_MOD[opts.homeMentality ?? "balanced"];
  const am = MENTALITY_MOD[opts.awayMentality ?? "balanced"];
  const home = axisRatings(players, homeLineup);
  const away = axisRatings(players, awayLineup);
  const homeClub = clubById(fixture.homeId);
  const awayClub = clubById(fixture.awayId);

  const homeBench = opts.homeBench ?? autoBench(players, fixture.homeId, homeLineup);
  const awayBench = opts.awayBench ?? autoBench(players, fixture.awayId, awayLineup);
  const homeGrl = clubQuality(players, fixture.homeId, homeLineup, opts.homeBench) + (opts.homeBoost ?? 0);
  const awayGrl = clubQuality(players, fixture.awayId, awayLineup, opts.awayBench) + (opts.awayBoost ?? 0);
  const homeQ = Math.max(52, homeGrl + 1.8);
  const awayQ = Math.max(52, awayGrl);
  const ratio = homeQ / awayQ;
  const axisHome = ((home.attack * hm.atk) / Math.max(52, away.defense * am.def));
  const axisAway = ((away.attack * am.atk) / Math.max(52, home.defense * hm.def));

  const homeLambda = clampNum(1.22 * Math.pow(ratio, 3.15) * Math.pow(axisHome, 0.28), 0.22, 4.6);
  const awayLambda = clampNum(1.02 * Math.pow(1 / ratio, 3.15) * Math.pow(axisAway, 0.28), 0.14, 3.8);

  let homeGoals = sampleGoals(homeLambda, rng);
  let awayGoals = sampleGoals(awayLambda, rng);

  if (homeGrl - awayGrl >= 8 && homeGoals < awayGoals && rng.chance(0.72)) {
    homeGoals = awayGoals + rng.int(1, 2);
  }
  if (awayGrl - homeGrl >= 8 && awayGoals < homeGoals && rng.chance(0.62)) {
    awayGoals = homeGoals + rng.int(1, 2);
  }

  const homeShots = homeGoals + rng.int(4, 11) + Math.round((homeGrl - 72) / 6);
  const awayShots = awayGoals + rng.int(3, 9) + Math.round((awayGrl - 72) / 6);
  const homeOn = Math.min(Math.max(homeGoals, homeShots), homeGoals + rng.int(2, 6));
  const awayOn = Math.min(Math.max(awayGoals, awayShots), awayGoals + rng.int(1, 5));
  const possHome = clampPoss(
    50 + (homeGrl - awayGrl) * 1.15 + (home.midfield - away.midfield) * 0.35 + rng.int(-3, 3),
  );

  const homeStats: MatchStats = {
    shots: Math.max(homeGoals, homeShots),
    onTarget: Math.max(homeGoals, homeOn),
    possession: possHome,
    corners: rng.int(2, 9),
    fouls: rng.int(8, 16),
    yellows: 0,
    reds: 0,
  };
  const awayStats: MatchStats = {
    shots: Math.max(awayGoals, awayShots),
    onTarget: Math.max(awayGoals, awayOn),
    possession: 100 - possHome,
    corners: rng.int(1, 7),
    fouls: rng.int(8, 16),
    yellows: 0,
    reds: 0,
  };

  const events: MatchEvent[] = [
    {
      minute: 0,
      type: "kickoff",
      text: `Arranca el partido en ${homeClub.stadium}.`,
    },
  ];

  const minutesFor = (n: number) => {
    const set = new Set<number>();
    const count = Math.max(0, n);
    while (set.size < count) set.add(rng.int(4, 90));
    return [...set].sort((a, b) => a - b);
  };

  const goalMinutesHome = minutesFor(homeGoals);
  const goalMinutesAway = minutesFor(awayGoals);
  const extraShotsHome = minutesFor(Math.max(0, homeStats.shots - homeGoals));
  const extraShotsAway = minutesFor(Math.max(0, awayStats.shots - awayGoals));

  type Timed = { minute: number; run: () => void };
  const timed: Timed[] = [];

  // Once en cancha en cada momento: arranca con los titulares y los cambios lo van modificando.
  const cur = { home: [...homeLineup], away: [...awayLineup] };
  const byId = (id: string) => players.find((x) => x.id === id);
  const benchPool = {
    home: homeBench.map(byId).filter((p): p is Player => Boolean(p) && !homeLineup.includes(p!.id) && !isUnavailable(p!)),
    away: awayBench.map(byId).filter((p): p is Player => Boolean(p) && !awayLineup.includes(p!.id) && !isUnavailable(p!)),
  };
  const subsIn = { home: [] as string[], away: [] as string[] };

  /** Hace un cambio. Sin `outId`, sale el más cansado de campo. Devuelve false si no se pudo. */
  const doSub = (side: "home" | "away", minute: number, outId?: string): boolean => {
    const pool = benchPool[side];
    if (!pool.length) return false;
    const onPitch = cur[side].map(byId).filter((p): p is Player => Boolean(p));
    let out = outId ? onPitch.find((p) => p.id === outId) : undefined;
    if (!out) {
      const tired = onPitch
        .filter((p) => p.pos !== "GK" && !subsIn[side].includes(p.id))
        .sort((a, b) => a.fitness - b.fitness);
      if (!tired.length) return false;
      out = rng.pick(tired.slice(0, 4));
    }
    const eligible = pool.filter((b) => (out!.pos === "GK" ? b.pos === "GK" : b.pos !== "GK"));
    const sameLine = eligible.filter((b) => posGroup(b.pos) === posGroup(out!.pos));
    const inn = [...(sameLine.length ? sameLine : eligible)].sort((a, b) => b.ovr - a.ovr)[0];
    if (!inn) return false;
    const idx = cur[side].indexOf(out.id);
    if (idx < 0) return false;
    cur[side] = cur[side].map((id, i) => (i === idx ? inn.id : id));
    benchPool[side] = pool.filter((b) => b.id !== inn.id);
    subsIn[side].push(inn.id);
    const club = clubById(side === "home" ? fixture.homeId : fixture.awayId);
    events.push({
      minute,
      type: "sub",
      clubId: club.id,
      playerId: inn.id,
      outPlayerId: out.id,
      text: `${minute}' · Cambio en ${club.short}: entra ${inn.name}, sale ${out.name}.`,
    });
    return true;
  };

  // Cambios programados: entre 3 y 5 por equipo, en la segunda parte.
  for (const side of ["home", "away"] as const) {
    const n = Math.min(rng.int(3, 5), benchPool[side].length);
    const mins = new Set<number>();
    while (mins.size < n) mins.add(rng.int(46, 86));
    for (const m of [...mins].sort((a, b) => a - b)) {
      timed.push({ minute: m, run: () => void doSub(side, m) });
    }
  }

  const pushGoal = (minute: number, clubId: string, side: "home" | "away") => {
    timed.push({
      minute,
      run: () => {
        const lineup = cur[side];
        const scorer = attackName(players, lineup, rng);
        const assist = rng.chance(0.62) ? midName(players, lineup, rng) : undefined;
        const club = clubById(clubId);
        let text = scorer
          ? `Gol de ${scorer.name} (${club.short})`
          : `Gol de ${club.short}`;
        if (assist && assist.id !== scorer?.id) {
          text += `, asistencia de ${lastName(assist.name)}`;
        }
        if (rng.chance(0.22)) text += ". Qué definición.";
        events.push({
          minute,
          type: "goal",
          clubId,
          playerId: scorer?.id,
          text: `${minute}' · ${text}`,
        });
        if (scorer) scorer.goals += 1;
        if (assist && assist.id !== scorer?.id) assist.assists += 1;
      },
    });
  };

  for (const m of goalMinutesHome) pushGoal(m, fixture.homeId, "home");
  for (const m of goalMinutesAway) pushGoal(m, fixture.awayId, "away");

  const shotLines = [
    (p: string, c: string) => `${p} prueba desde fuera del área. ${c} se defiende.`,
    (p: string) => `Centro peligroso y ${p} cabecea desviado.`,
    (p: string) => `${p} se interna y dispara. Atrapa el portero.`,
    (p: string) => `Regate de ${p} y el disparo se va cerca del palo.`,
  ];

  for (const m of extraShotsHome) {
    timed.push({
      minute: m,
      run: () => {
        const p = attackName(players, cur.home, rng);
        const on = rng.chance(0.38);
        if (on) {
          const gk = defName(players, cur.away, rng);
          events.push({
            minute: m,
            type: "save",
            clubId: fixture.homeId,
            playerId: p?.id,
            text: `${m}' · ${p ? p.name : homeClub.short} dispara y ${gk ? lastName(gk.name) : "el portero"} responde.`,
          });
        } else {
          events.push({
            minute: m,
            type: "shot",
            clubId: fixture.homeId,
            playerId: p?.id,
            text: `${m}' · ${rng.pick(shotLines)(p ? lastName(p.name) : homeClub.short, awayClub.short)}`,
          });
        }
      },
    });
  }
  for (const m of extraShotsAway) {
    timed.push({
      minute: m,
      run: () => {
        const p = attackName(players, cur.away, rng);
        const on = rng.chance(0.38);
        if (on) {
          const gk = defName(players, cur.home, rng);
          events.push({
            minute: m,
            type: "save",
            clubId: fixture.awayId,
            playerId: p?.id,
            text: `${m}' · ${p ? p.name : awayClub.short} dispara y ${gk ? lastName(gk.name) : "el portero"} responde.`,
          });
        } else {
          events.push({
            minute: m,
            type: "shot",
            clubId: fixture.awayId,
            playerId: p?.id,
            text: `${m}' · ${rng.pick(shotLines)(p ? lastName(p.name) : awayClub.short, homeClub.short)}`,
          });
        }
      },
    });
  }

  const yellowN = rng.int(1, 3);
  for (const m of minutesFor(yellowN)) {
    timed.push({
      minute: m,
      run: () => {
        const homeSide = rng.chance(0.5);
        const lineup = homeSide ? cur.home : cur.away;
        const clubId = homeSide ? fixture.homeId : fixture.awayId;
        // Las amarillas se reparten entre todos los de campo (antes caían casi todas en la defensa).
        const outfield = lineup
          .map((id) => players.find((x) => x.id === id))
          .filter((x): x is Player => x !== undefined && x.pos !== "GK");
        const p = outfield.length ? rng.pick(outfield) : midName(players, lineup, rng);
        (homeSide ? homeStats : awayStats).yellows += 1;
        if (p) {
          p.yellows += 1;
          if (p.yellows >= 5) {
            p.suspended = Math.max(p.suspended, 1);
            p.yellows = 0;
            events.push({
              minute: m,
              type: "yellow",
              clubId,
              playerId: p.id,
              text: `${m}' · Amarilla para ${p.name}. Acumula 5: un partido de sanción.`,
            });
            return;
          }
        }
        events.push({
          minute: m,
          type: "yellow",
          clubId,
          playerId: p?.id,
          text: `${m}' · Amarilla para ${p ? p.name : clubById(clubId).short}.`,
        });
      },
    });
  }

  if (rng.chance(0.014)) {
    const m = rng.int(8, 88);
    timed.push({
      minute: m,
      run: () => {
        const homeSide = rng.chance(0.5);
        const lineup = homeSide ? cur.home : cur.away;
        const clubId = homeSide ? fixture.homeId : fixture.awayId;
        const p = defName(players, lineup, rng) ?? midName(players, lineup, rng);
        (homeSide ? homeStats : awayStats).reds += 1;
        const ban = rng.chance(0.35) ? 3 : 1;
        if (p) p.suspended = Math.max(p.suspended, ban);
        events.push({
          minute: m,
          type: "red",
          clubId,
          playerId: p?.id,
          text: `${m}' · Roja directa para ${p ? p.name : clubById(clubId).short}. ${ban} partido${ban > 1 ? "s" : ""} de sanción. Hay que sacarlo.`,
        });
      },
    });
  }

  const injRoll = rng.float();
  if (injRoll < 0.03) {
    const m = rng.int(12, 84);
    const serious = injRoll < 0.0035;
    const medium = injRoll < 0.011;
    timed.push({
      minute: m,
      run: () => {
        const homeSide = rng.chance(0.5);
        const lineup = homeSide ? cur.home : cur.away;
        const field = lineup
          .map((id) => players.find((x) => x.id === id))
          .filter((x): x is Player => x !== undefined && x.pos !== "GK");
        if (!field.length) return;
        const p = rng.pick(field);
        p.injured = serious ? rng.int(4, 8) : medium ? rng.int(2, 3) : 1;
        p.fitness = Math.min(p.fitness, serious ? 35 : medium ? 48 : 58);
        const weeks = p.injured;
        events.push({
          minute: m,
          type: "injury",
          clubId: p.clubId,
          playerId: p.id,
          text: `${m}' · ${p.name} se duele. ${
            serious ? "Rotura: hay que sustituirlo." : medium ? "Esguince: hay que sustituirlo." : "Golpe: pide el cambio."
          } Baja ${weeks} jornada${weeks > 1 ? "s" : ""}.`,
        });
        // Si hay banco, el lesionado sale en el acto.
        doSub(homeSide ? "home" : "away", m, p.id);
      },
    });
  }

  timed.sort((a, b) => a.minute - b.minute);
  let ht = false;
  for (const t of timed) {
    if (!ht && t.minute >= 45) {
      events.push({
        minute: 45,
        type: "ht",
        text: "Descanso.",
      });
      ht = true;
    }
    t.run();
  }
  if (!ht) {
    events.push({ minute: 45, type: "ht", text: "Descanso." });
  }
  events.push({
    minute: 90,
    type: "ft",
    text: `Final: ${homeClub.short} ${homeGoals}–${awayGoals} ${awayClub.short}.`,
  });

  events.sort((a, b) => a.minute - b.minute || (a.type === "kickoff" ? -1 : 0));

  for (const id of [...homeLineup, ...awayLineup]) {
    const p = players.find((x) => x.id === id);
    if (p) {
      p.apps += 1;
      p.fitness = clampNum(p.fitness - rng.int(4, 9), 42, 100);
      p.form = clampNum(p.form + rng.int(-1, 1), -5, 5);
    }
  }
  // Los suplentes que entraron también suman partido y se cansan menos.
  for (const id of [...subsIn.home, ...subsIn.away]) {
    const p = players.find((x) => x.id === id);
    if (p) {
      p.apps += 1;
      p.fitness = clampNum(p.fitness - rng.int(2, 5), 42, 100);
    }
  }

  return {
    fixtureId: fixture.id,
    homeId: fixture.homeId,
    awayId: fixture.awayId,
    homeGoals,
    awayGoals,
    events,
    homeStats,
    awayStats,
    homeLineup,
    awayLineup,
    homeBench: homeBench.filter((id) => !homeLineup.includes(id)),
    awayBench: awayBench.filter((id) => !awayLineup.includes(id)),
    homeSubsIn: subsIn.home,
    awaySubsIn: subsIn.away,
    homeGrl: Math.round(homeGrl * 10) / 10,
    awayGrl: Math.round(awayGrl * 10) / 10,
  };
}

function clampPoss(n: number) {
  return Math.round(Math.max(28, Math.min(72, n)));
}

function clampNum(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
