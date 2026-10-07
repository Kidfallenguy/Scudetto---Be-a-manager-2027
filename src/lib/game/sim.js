import { clubById } from "./clubs";
import { Rng } from "./rng";
import { axisRatings, pickXi } from "./tactics";
const MENTALITY_MOD = {
    defensive: { atk: 0.88, def: 1.12 },
    balanced: { atk: 1, def: 1 },
    attacking: { atk: 1.14, def: 0.9 },
};
function lastName(name) {
    const parts = name.trim().split(/\s+/);
    return parts[parts.length - 1] ?? name;
}
export function autoLineup(players, clubId) {
    const squad = players.filter((p) => p.clubId === clubId);
    return pickXi(squad, "433");
}
export function effectiveOvr(p) {
    return p.ovr + p.form * 0.5 + (p.fitness - 85) * 0.05 - (p.injured > 0 ? 8 : 0);
}
/** Squad GRL: every player counts, starters and stars weigh more. */
export function clubQuality(players, clubId, lineup = []) {
    const squad = players.filter((p) => p.clubId === clubId);
    if (!squad.length)
        return 60;
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
        .filter((p) => Boolean(p));
    const xiScore = xi.length
        ? xi.reduce((n, p) => n + effectiveOvr(p), 0) / xi.length
        : squadScore;
    return xiScore * 0.58 + squadScore * 0.42;
}
function sampleGoals(lambda, rng) {
    const lam = Math.max(0.12, lambda);
    const base = Math.floor(lam);
    const frac = lam - base;
    let g = base + (rng.chance(frac) ? 1 : 0);
    if (rng.chance(0.16))
        g += 1;
    if (rng.chance(0.1) && g > 0)
        g -= 1;
    if (rng.chance(0.04))
        g += rng.int(0, 1);
    return Math.min(6, Math.max(0, g));
}
function attackName(players, ids, rng) {
    const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p) => Boolean(p));
    const atk = xi.filter((p) => p.pos === "ST" || p.pos === "LW" || p.pos === "RW" || p.pos === "CAM");
    const pool = atk.length ? atk : xi.filter((p) => p.pos !== "GK");
    if (!pool.length)
        return undefined;
    const weights = pool.map((p) => Math.max(8, p.attrs.sho + p.form * 2));
    const total = weights.reduce((s, w) => s + w, 0);
    let roll = rng.float() * total;
    for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0)
            return pool[i];
    }
    return pool[0];
}
function midName(players, ids, rng) {
    const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p) => Boolean(p));
    const mid = xi.filter((p) => p.pos === "CM" || p.pos === "CAM" || p.pos === "CDM" || p.pos === "LW" || p.pos === "RW");
    const pool = mid.length ? mid : xi;
    return pool.length ? rng.pick(pool) : undefined;
}
function defName(players, ids, rng) {
    const xi = ids.map((id) => players.find((p) => p.id === id)).filter((p) => Boolean(p));
    const def = xi.filter((p) => p.pos === "CB" || p.pos === "LB" || p.pos === "RB" || p.pos === "GK");
    return (def.length ? rng.pick(def) : xi[0]) ?? undefined;
}
export function simulateMatch(fixture, players, opts) {
    const rng = new Rng(opts.seed);
    const homeLineup = opts.homeLineup?.length === 11 ? opts.homeLineup : autoLineup(players, fixture.homeId);
    const awayLineup = opts.awayLineup?.length === 11 ? opts.awayLineup : autoLineup(players, fixture.awayId);
    const hm = MENTALITY_MOD[opts.homeMentality ?? "balanced"];
    const am = MENTALITY_MOD[opts.awayMentality ?? "balanced"];
    const home = axisRatings(players, homeLineup);
    const away = axisRatings(players, awayLineup);
    const homeClub = clubById(fixture.homeId);
    const awayClub = clubById(fixture.awayId);
    const homeGrl = clubQuality(players, fixture.homeId, homeLineup);
    const awayGrl = clubQuality(players, fixture.awayId, awayLineup);
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
    const possHome = clampPoss(50 + (homeGrl - awayGrl) * 1.15 + (home.midfield - away.midfield) * 0.35 + rng.int(-3, 3));
    const homeStats = {
        shots: Math.max(homeGoals, homeShots),
        onTarget: Math.max(homeGoals, homeOn),
        possession: possHome,
        corners: rng.int(2, 9),
        fouls: rng.int(8, 16),
        yellows: 0,
        reds: 0,
    };
    const awayStats = {
        shots: Math.max(awayGoals, awayShots),
        onTarget: Math.max(awayGoals, awayOn),
        possession: 100 - possHome,
        corners: rng.int(1, 7),
        fouls: rng.int(8, 16),
        yellows: 0,
        reds: 0,
    };
    const events = [
        {
            minute: 0,
            type: "kickoff",
            text: `Arranca el partido en ${homeClub.stadium}.`,
        },
    ];
    const minutesFor = (n) => {
        const set = new Set();
        const count = Math.max(0, n);
        while (set.size < count)
            set.add(rng.int(4, 90));
        return [...set].sort((a, b) => a - b);
    };
    const goalMinutesHome = minutesFor(homeGoals);
    const goalMinutesAway = minutesFor(awayGoals);
    const extraShotsHome = minutesFor(Math.max(0, homeStats.shots - homeGoals));
    const extraShotsAway = minutesFor(Math.max(0, awayStats.shots - awayGoals));
    const timed = [];
    const pushGoal = (minute, clubId, lineup) => {
        timed.push({
            minute,
            run: () => {
                const scorer = attackName(players, lineup, rng);
                const assist = rng.chance(0.62) ? midName(players, lineup, rng) : undefined;
                const club = clubById(clubId);
                let text = scorer
                    ? `Gol de ${scorer.name} (${club.short})`
                    : `Gol de ${club.short}`;
                if (assist && assist.id !== scorer?.id) {
                    text += `, asistencia de ${lastName(assist.name)}`;
                }
                if (rng.chance(0.22))
                    text += ". Qué definición.";
                events.push({
                    minute,
                    type: "goal",
                    clubId,
                    playerId: scorer?.id,
                    text: `${minute}' · ${text}`,
                });
                if (scorer)
                    scorer.goals += 1;
                if (assist && assist.id !== scorer?.id)
                    assist.assists += 1;
            },
        });
    };
    for (const m of goalMinutesHome)
        pushGoal(m, fixture.homeId, homeLineup);
    for (const m of goalMinutesAway)
        pushGoal(m, fixture.awayId, awayLineup);
    const shotLines = [
        (p, c) => `${p} prueba desde fuera del área. ${c} se defiende.`,
        (p) => `Centro peligroso y ${p} cabecea desviado.`,
        (p) => `${p} se interna y dispara. Atrapa el portero.`,
        (p) => `Regate de ${p} y el disparo se va cerca del palo.`,
    ];
    for (const m of extraShotsHome) {
        timed.push({
            minute: m,
            run: () => {
                const p = attackName(players, homeLineup, rng);
                const on = rng.chance(0.38);
                if (on) {
                    const gk = defName(players, awayLineup, rng);
                    events.push({
                        minute: m,
                        type: "save",
                        clubId: fixture.homeId,
                        playerId: p?.id,
                        text: `${m}' · ${p ? p.name : homeClub.short} dispara y ${gk ? lastName(gk.name) : "el portero"} responde.`,
                    });
                }
                else {
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
                const p = attackName(players, awayLineup, rng);
                const on = rng.chance(0.38);
                if (on) {
                    const gk = defName(players, homeLineup, rng);
                    events.push({
                        minute: m,
                        type: "save",
                        clubId: fixture.awayId,
                        playerId: p?.id,
                        text: `${m}' · ${p ? p.name : awayClub.short} dispara y ${gk ? lastName(gk.name) : "el portero"} responde.`,
                    });
                }
                else {
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
                const lineup = homeSide ? homeLineup : awayLineup;
                const clubId = homeSide ? fixture.homeId : fixture.awayId;
                // Las amarillas se reparten entre todos los de campo (antes caían casi todas en la defensa).
                const outfield = lineup
                    .map((id) => players.find((x) => x.id === id))
                    .filter((x) => x !== undefined && x.pos !== "GK");
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
                const lineup = homeSide ? homeLineup : awayLineup;
                const clubId = homeSide ? fixture.homeId : fixture.awayId;
                const p = defName(players, lineup, rng) ?? midName(players, lineup, rng);
                (homeSide ? homeStats : awayStats).reds += 1;
                const ban = rng.chance(0.35) ? 3 : 1;
                if (p)
                    p.suspended = Math.max(p.suspended, ban);
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
                const lineup = homeSide ? homeLineup : awayLineup;
                const field = lineup
                    .map((id) => players.find((x) => x.id === id))
                    .filter((x) => x !== undefined && x.pos !== "GK");
                if (!field.length)
                    return;
                const p = rng.pick(field);
                p.injured = serious ? rng.int(4, 8) : medium ? rng.int(2, 3) : 1;
                p.fitness = Math.min(p.fitness, serious ? 35 : medium ? 48 : 58);
                const weeks = p.injured;
                events.push({
                    minute: m,
                    type: "injury",
                    clubId: p.clubId,
                    playerId: p.id,
                    text: `${m}' · ${p.name} se duele. ${serious ? "Rotura: hay que sustituirlo." : medium ? "Esguince: hay que sustituirlo." : "Golpe: pide el cambio."} Baja ${weeks} jornada${weeks > 1 ? "s" : ""}.`,
                });
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
        homeGrl: Math.round(homeGrl * 10) / 10,
        awayGrl: Math.round(awayGrl * 10) / 10,
    };
}
function clampPoss(n) {
    return Math.round(Math.max(28, Math.min(72, n)));
}
function clampNum(n, a, b) {
    return Math.max(a, Math.min(b, n));
}
