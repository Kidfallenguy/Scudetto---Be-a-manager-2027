import { ALL_PLAYABLE_LEAGUES, CLUBS, clubById, competitionToLeague, domesticCompetition, domesticIds, emptyLeagueTables, emptyStanding, isDomesticCompetition, leagueInfo, playableLeague, } from "./clubs";
import { COMP_THEME, QUAL_SPOTS, finalRoundOf, knockoutRoundLabel, } from "./competitions";
import { CONMEBOL_GHOST_IDS, EUROPE_GHOST_IDS } from "./fictional";
import { seedAcademy } from "./academy";
import { ensureTerms, titleBonusTotal } from "./contracts";
import { seedFreeAgents } from "./free-agents";
import { historicalFor, trophyLabel } from "./honours";
import { trophyName, trophyPrize } from "./prizes";
import { Rng } from "./rng";
import { buildSquad, plantHiddenGems } from "./squads";
import { pickXi } from "./tactics";
import { formatMoney, uid } from "./format";
function roundRobin(ids) {
    const teams = [...ids];
    if (teams.length % 2 === 1)
        teams.push("bye");
    const n = teams.length;
    const half = n / 2;
    const rounds = [];
    const arr = [...teams];
    for (let r = 0; r < n - 1; r++) {
        const matches = [];
        for (let i = 0; i < half; i++) {
            const a = arr[i];
            const b = arr[n - 1 - i];
            if (a === "bye" || b === "bye")
                continue;
            if (r % 2 === 0)
                matches.push([a, b]);
            else
                matches.push([b, a]);
        }
        rounds.push(matches);
        const last = arr.pop();
        arr.splice(1, 0, last);
    }
    return rounds;
}
function addFixture(fixtures, competition, round, homeId, awayId, extra) {
    const id = `${competition}-${round}-${homeId}-${awayId}-${fixtures.length}`;
    fixtures.push({
        id,
        competition,
        round,
        homeId,
        awayId,
        played: false,
        leg: extra?.leg,
        tieId: extra?.tieId,
    });
    return id;
}
function isoDate(year, month, day) {
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.toISOString().slice(0, 10);
}
function addDays(iso, days) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
export function rankedByPrestige(ids) {
    return [...ids].sort((a, b) => clubById(b).prestige - clubById(a).prestige);
}
export function qualifyContinentals(tables) {
    const ucl = [];
    const uel = [];
    const uecl = [];
    for (const league of ALL_PLAYABLE_LEAGUES) {
        const ranked = sortTable(tables[league]).map((r) => r.clubId);
        if (!ranked.length) {
            ranked.push(...rankedByPrestige(domesticIds(league)));
        }
        const spots = QUAL_SPOTS[league];
        ucl.push(...ranked.slice(0, spots.ucl));
        uel.push(...ranked.slice(spots.ucl, spots.ucl + spots.uel));
        uecl.push(...ranked.slice(spots.ucl + spots.uel, spots.ucl + spots.uel + spots.uecl));
    }
    return { ucl, uel, uecl };
}
export function seedQualifiersFromPrestige() {
    const tables = emptyLeagueTables();
    for (const league of ALL_PLAYABLE_LEAGUES) {
        const ranked = rankedByPrestige(domesticIds(league));
        tables[league] = ranked.map((id, i) => ({
            ...emptyStanding(id),
            pts: Math.max(0, 90 - i * 3),
        }));
    }
    return qualifyContinentals(tables);
}
function fillExclusive(base, pool, need, used) {
    const out = [...base];
    for (const id of pool) {
        if (out.length >= need)
            break;
        if (used.has(id) || out.includes(id))
            continue;
        out.push(id);
        used.add(id);
    }
    return out.slice(0, need);
}
export function makeUclGroups(teams, rng) {
    const list = rng.shuffle(teams).slice(0, 32);
    while (list.length < 32) {
        const extra = EUROPE_GHOST_IDS.find((id) => !list.includes(id));
        if (!extra)
            break;
        list.push(extra);
    }
    const groups = [];
    for (let i = 0; i < 8; i++) {
        groups.push(list.slice(i * 4, i * 4 + 4));
    }
    return groups.filter((g) => g.length === 4);
}
export function makeLibGroups(rng) {
    const ranked = rankedByPrestige(CONMEBOL_GHOST_IDS);
    const teams = ranked.slice(0, 32);
    const shuffled = rng.shuffle(teams);
    const groups = [];
    for (let i = 0; i < 8; i++)
        groups.push(shuffled.slice(i * 4, i * 4 + 4));
    return groups.filter((g) => g.length === 4);
}
export function assembleContinentals(fromTables, rng) {
    const q = qualifyContinentals(fromTables);
    const used = new Set([...q.ucl, ...q.uel, ...q.uecl]);
    const europePool = rankedByPrestige([
        ...EUROPE_GHOST_IDS,
        ...CLUBS.filter((c) => c.league === "europe").map((c) => c.id),
    ]);
    const ucl = fillExclusive(q.ucl, europePool, 32, used);
    const uclGroups = makeUclGroups(ucl, rng);
    // Un club solo puede estar en UNA copa continental a la vez: lo que ya juega Champions
    // (incluidos los equipos de relleno) no puede aparecer en Europa League ni Conference.
    const taken = new Set(uclGroups.flat());
    const onlyFree = (ids) => ids.filter((id) => !taken.has(id));
    const uelBase = onlyFree(q.uel);
    uelBase.forEach((id) => taken.add(id));
    const reservedForConference = new Set(q.uecl);
    const uel = fillExclusive(uelBase, europePool.filter((id) => !taken.has(id) && !reservedForConference.has(id)), 16, new Set(taken));
    uel.forEach((id) => taken.add(id));
    const ueclBase = onlyFree(q.uecl);
    ueclBase.forEach((id) => taken.add(id));
    const uecl = fillExclusive(ueclBase, europePool.filter((id) => !taken.has(id)), 16, new Set(taken));
    uecl.forEach((id) => taken.add(id));
    // Copas sudamericanas: solo equipos de CONMEBOL, nunca uno que ya juegue en Europa,
    // y Libertadores y Sudamericana tampoco se pisan entre sí.
    const conmebol = new Set(CONMEBOL_GHOST_IDS);
    const libGroups = makeLibGroups(rng)
        .map((g) => g.filter((id) => conmebol.has(id) && !taken.has(id)))
        .filter((g) => g.length === 4);
    const libFlat = new Set(libGroups.flat());
    const sudTeams = rankedByPrestige(CONMEBOL_GHOST_IDS)
        .filter((id) => !libFlat.has(id) && !taken.has(id))
        .slice(0, 16);
    return {
        uclGroups,
        uelTeams: rng.shuffle(uel).slice(0, 16),
        ueclTeams: rng.shuffle(uecl).slice(0, 16),
        libGroups,
        sudTeams,
    };
}
function pair(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 2) {
        const a = ids[i];
        const b = ids[i + 1];
        if (a && b)
            out.push([a, b]);
    }
    return out;
}
function addTwoLegged(fixtures, competition, round, pairs) {
    const ida = [];
    const vuelta = [];
    for (const [h, a] of pairs) {
        const tieId = uid("tie");
        ida.push(addFixture(fixtures, competition, round, h, a, { leg: 1, tieId }));
        vuelta.push(addFixture(fixtures, competition, round, a, h, { leg: 2, tieId }));
    }
    return { ida, vuelta };
}
export function buildSeasonSchedule(opts) {
    const rng = new Rng(opts.seed);
    const fixtures = [];
    const calendar = [];
    const league = clubById(opts.clubId).league;
    const leagueComp = domesticCompetition(league);
    const info = leagueInfo(league);
    const year = opts.season;
    const leagueRounds = {
        serieA: [],
        premier: [],
        laliga: [],
        bundesliga: [],
        ligue1: [],
    };
    let maxMd = 0;
    for (const lg of ALL_PLAYABLE_LEAGUES) {
        const ids = domesticIds(lg);
        const first = roundRobin(ids);
        const second = first.map((round) => round.map(([a, b]) => [b, a]));
        leagueRounds[lg] = [...first, ...second];
        maxMd = Math.max(maxMd, leagueRounds[lg].length);
    }
    const pushSlot = (competition, round, title, ids, date, leg) => {
        calendar.push({
            id: `${competition}-${round}-${leg ?? 0}-${calendar.length}`,
            competition,
            round,
            title,
            fixtures: ids,
            date,
            leg,
        });
    };
    let cursorDate = isoDate(year, 8, 9);
    if (opts.supercoppa) {
        const [h, a] = opts.supercoppa;
        pushSlot("supercoppa", 1, info.superCup, [addFixture(fixtures, "supercoppa", 1, h, a)], cursorDate);
        cursorDate = addDays(cursorDate, 7);
    }
    if (opts.mundial) {
        const [h, a] = opts.mundial;
        pushSlot("mundial", 1, "Mundial de Clubes", [addFixture(fixtures, "mundial", 1, h, a)], cursorDate);
        cursorDate = addDays(cursorDate, 7);
    }
    const uclGroupSlots = Array.from({ length: 6 }, () => []);
    for (const group of opts.uclGroups) {
        const rr = roundRobin(group);
        rr.forEach((matches, i) => {
            for (const [h, a] of matches) {
                uclGroupSlots[i].push(addFixture(fixtures, "ucl", i + 1, h, a));
            }
        });
    }
    const libGroupSlots = Array.from({ length: 6 }, () => []);
    for (const group of opts.libGroups) {
        const rr = roundRobin(group);
        rr.forEach((matches, i) => {
            for (const [h, a] of matches) {
                libGroupSlots[i].push(addFixture(fixtures, "libertadores", i + 1, h, a));
            }
        });
    }
    const coppaTeams = coppaField(opts.clubId, domesticIds(league), rng);
    const coppaR16 = pair(coppaTeams).map(([h, a]) => addFixture(fixtures, "coppa", 1, h, a));
    const uelR16 = opts.uelTeams.length >= 16 ? addTwoLegged(fixtures, "uel", 1, pair(opts.uelTeams)) : { ida: [], vuelta: [] };
    const ueclR16 = opts.ueclTeams.length >= 16 ? addTwoLegged(fixtures, "uecl", 1, pair(opts.ueclTeams)) : { ida: [], vuelta: [] };
    const sudR16 = opts.sudTeams.length >= 16 ? addTwoLegged(fixtures, "sudamericana", 1, pair(opts.sudTeams)) : { ida: [], vuelta: [] };
    const uclWeeks = new Set([3, 5, 7, 9, 11, 13]);
    const coppaWeeks = [6, 14, 24, 32];
    const uclKoIda = [22, 26, 30];
    const uclKoVuelta = [23, 27, 31];
    const uclFinal = 36;
    const uelIda = [10, 20, 28];
    const uelVuelta = [12, 21, 29];
    const uelFinal = 34;
    const libKoIda = [18, 25, 33];
    const libKoVuelta = [19, 26, 34];
    const libFinal = 37;
    let uclIdx = 0;
    let saturday = isoDate(year, 8, 16);
    for (let md = 1; md <= maxMd; md++) {
        const date = saturday;
        const ids = [];
        for (const lg of ALL_PLAYABLE_LEAGUES) {
            const matches = leagueRounds[lg][md - 1];
            if (!matches)
                continue;
            const comp = domesticCompetition(lg);
            for (const [h, a] of matches)
                ids.push(addFixture(fixtures, comp, md, h, a));
        }
        pushSlot(leagueComp, md, `${info.title} · Jornada ${md}`, ids, date);
        const midweek = addDays(date, 3);
        if (uclWeeks.has(md) && uclIdx < 6) {
            const gIds = [...(uclGroupSlots[uclIdx] ?? []), ...(libGroupSlots[uclIdx] ?? [])];
            pushSlot("ucl", uclIdx + 1, knockoutRoundLabel("ucl", uclIdx + 1), uclGroupSlots[uclIdx] ?? [], midweek);
            if (libGroupSlots[uclIdx]?.length) {
                pushSlot("libertadores", uclIdx + 1, knockoutRoundLabel("libertadores", uclIdx + 1), libGroupSlots[uclIdx] ?? [], addDays(midweek, 1));
            }
            void gIds;
            uclIdx += 1;
        }
        if (md === coppaWeeks[0])
            pushSlot("coppa", 1, `${info.cup} · Octavos`, coppaR16, midweek);
        if (md === coppaWeeks[1])
            pushSlot("coppa", 2, `${info.cup} · Cuartos`, [], midweek);
        if (md === coppaWeeks[2])
            pushSlot("coppa", 3, `${info.cup} · Semifinales`, [], midweek);
        if (md === coppaWeeks[3])
            pushSlot("coppa", 4, `${info.cup} · Final`, [], midweek);
        if (md === uelIda[0] && uelR16.ida.length) {
            pushSlot("uel", 1, knockoutRoundLabel("uel", 1, 1), uelR16.ida, midweek, 1);
            if (ueclR16.ida.length)
                pushSlot("uecl", 1, knockoutRoundLabel("uecl", 1, 1), ueclR16.ida, addDays(midweek, 1), 1);
            if (sudR16.ida.length)
                pushSlot("sudamericana", 1, knockoutRoundLabel("sudamericana", 1, 1), sudR16.ida, addDays(midweek, 1), 1);
        }
        if (md === uelVuelta[0] && uelR16.vuelta.length) {
            pushSlot("uel", 1, knockoutRoundLabel("uel", 1, 2), uelR16.vuelta, midweek, 2);
            if (ueclR16.vuelta.length)
                pushSlot("uecl", 1, knockoutRoundLabel("uecl", 1, 2), ueclR16.vuelta, addDays(midweek, 1), 2);
            if (sudR16.vuelta.length)
                pushSlot("sudamericana", 1, knockoutRoundLabel("sudamericana", 1, 2), sudR16.vuelta, addDays(midweek, 1), 2);
        }
        if (md === uelIda[1]) {
            pushSlot("uel", 2, knockoutRoundLabel("uel", 2, 1), [], midweek, 1);
            pushSlot("uecl", 2, knockoutRoundLabel("uecl", 2, 1), [], addDays(midweek, 1), 1);
            pushSlot("sudamericana", 2, knockoutRoundLabel("sudamericana", 2, 1), [], addDays(midweek, 1), 1);
        }
        if (md === uelVuelta[1]) {
            pushSlot("uel", 2, knockoutRoundLabel("uel", 2, 2), [], midweek, 2);
            pushSlot("uecl", 2, knockoutRoundLabel("uecl", 2, 2), [], addDays(midweek, 1), 2);
            pushSlot("sudamericana", 2, knockoutRoundLabel("sudamericana", 2, 2), [], addDays(midweek, 1), 2);
        }
        if (md === uelIda[2]) {
            pushSlot("uel", 3, knockoutRoundLabel("uel", 3, 1), [], midweek, 1);
            pushSlot("uecl", 3, knockoutRoundLabel("uecl", 3, 1), [], addDays(midweek, 1), 1);
            pushSlot("sudamericana", 3, knockoutRoundLabel("sudamericana", 3, 1), [], addDays(midweek, 1), 1);
        }
        if (md === uelVuelta[2]) {
            pushSlot("uel", 3, knockoutRoundLabel("uel", 3, 2), [], midweek, 2);
            pushSlot("uecl", 3, knockoutRoundLabel("uecl", 3, 2), [], addDays(midweek, 1), 2);
            pushSlot("sudamericana", 3, knockoutRoundLabel("sudamericana", 3, 2), [], addDays(midweek, 1), 2);
        }
        if (md === uelFinal) {
            pushSlot("uel", 4, knockoutRoundLabel("uel", 4), [], midweek);
            pushSlot("uecl", 4, knockoutRoundLabel("uecl", 4), [], addDays(midweek, 1));
            pushSlot("sudamericana", 4, knockoutRoundLabel("sudamericana", 4), [], addDays(midweek, 1));
        }
        if (md === uclKoIda[0]) {
            pushSlot("ucl", 7, knockoutRoundLabel("ucl", 7, 1), [], midweek, 1);
        }
        if (md === uclKoVuelta[0]) {
            pushSlot("ucl", 7, knockoutRoundLabel("ucl", 7, 2), [], midweek, 2);
        }
        if (md === uclKoIda[1])
            pushSlot("ucl", 8, knockoutRoundLabel("ucl", 8, 1), [], midweek, 1);
        if (md === uclKoVuelta[1])
            pushSlot("ucl", 8, knockoutRoundLabel("ucl", 8, 2), [], midweek, 2);
        if (md === uclKoIda[2])
            pushSlot("ucl", 9, knockoutRoundLabel("ucl", 9, 1), [], midweek, 1);
        if (md === uclKoVuelta[2])
            pushSlot("ucl", 9, knockoutRoundLabel("ucl", 9, 2), [], midweek, 2);
        if (md === uclFinal)
            pushSlot("ucl", 10, knockoutRoundLabel("ucl", 10), [], midweek);
        if (md === libKoIda[0])
            pushSlot("libertadores", 7, knockoutRoundLabel("libertadores", 7, 1), [], midweek, 1);
        if (md === libKoVuelta[0])
            pushSlot("libertadores", 7, knockoutRoundLabel("libertadores", 7, 2), [], midweek, 2);
        if (md === libKoIda[1])
            pushSlot("libertadores", 8, knockoutRoundLabel("libertadores", 8, 1), [], midweek, 1);
        if (md === libKoVuelta[1])
            pushSlot("libertadores", 8, knockoutRoundLabel("libertadores", 8, 2), [], midweek, 2);
        if (md === libKoIda[2])
            pushSlot("libertadores", 9, knockoutRoundLabel("libertadores", 9, 1), [], midweek, 1);
        if (md === libKoVuelta[2])
            pushSlot("libertadores", 9, knockoutRoundLabel("libertadores", 9, 2), [], midweek, 2);
        if (md === libFinal)
            pushSlot("libertadores", 10, knockoutRoundLabel("libertadores", 10), [], midweek);
        saturday = addDays(saturday, 7);
    }
    calendar.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
    return { fixtures, calendar };
}
export function createCareer(clubId, seed = Date.now() % 1_000_000_000, slot = 0) {
    const rng = new Rng(seed);
    const used = new Set();
    const seenClub = new Set();
    const players = CLUBS.filter((c) => {
        if (seenClub.has(c.id))
            return false;
        seenClub.add(c.id);
        return true;
    }).flatMap((c) => {
        const squad = buildSquad(c.id, rng, used);
        if (c.ghost)
            for (const p of squad)
                p.locked = true;
        return squad;
    });
    plantHiddenGems(players, rng);
    for (let i = 0; i < players.length; i++)
        players[i] = ensureTerms(players[i]);
    const freeAgents = seedFreeAgents(rng, used).map(ensureTerms);
    const club = clubById(clubId);
    const squad = players.filter((p) => p.clubId === clubId);
    const leagueTables = emptyLeagueTables();
    const prestigeTables = emptyLeagueTables();
    for (const lg of ALL_PLAYABLE_LEAGUES) {
        const ranked = rankedByPrestige(domesticIds(lg));
        prestigeTables[lg] = ranked.map((id, i) => ({
            ...emptyStanding(id),
            pts: Math.max(0, 90 - i * 3),
        }));
    }
    const assembled = assembleContinentals(prestigeTables, rng);
    const { fixtures, calendar } = buildSeasonSchedule({
        clubId,
        seed,
        season: 2026,
        uclGroups: assembled.uclGroups,
        uelTeams: assembled.uelTeams,
        ueclTeams: assembled.ueclTeams,
        libGroups: assembled.libGroups,
        sudTeams: assembled.sudTeams,
    });
    const info = leagueInfo(club.league);
    const news = [
        {
            id: "n0",
            week: 0,
            tone: "good",
            title: `Bienvenido a ${club.name}`,
            body: `El consejo te entrega las llaves de ${club.stadium}. ${info.goal} Una sola copa europea: se entra por la tabla.`,
        },
    ];
    const userLeague = playableLeague(club.league);
    return {
        version: 6,
        slot,
        seed,
        season: 2026,
        week: 1,
        cursor: 0,
        clubId,
        screen: "office",
        players,
        standings: leagueTables[userLeague],
        leagueTables,
        uclStandings: assembled.uclGroups.flat().map(emptyStanding),
        uelStandings: assembled.uelTeams.map(emptyStanding),
        ueclStandings: assembled.ueclTeams.map(emptyStanding),
        libStandings: assembled.libGroups.flat().map(emptyStanding),
        fixtures,
        calendar,
        tactics: {
            formation: "433",
            mentality: "balanced",
            lineup: pickXi(squad, "433"),
            numberColor: "auto",
        },
        budget: Math.round(Math.pow(club.prestige / 10, 3.15) * 90_000),
        news,
        lastMatch: null,
        trophies: [],
        honours: historicalFor(clubId),
        careerTrophies: [],
        seasonOver: false,
        pendingFixtureId: null,
        trainingPlan: null,
        trainingReport: null,
        academy: seedAcademy(clubId, rng, used),
        scouts: [],
        academyLevel: 1,
        offers: [],
        loans: [],
        popups: [],
        tempLineupBackup: null,
        uclGroups: assembled.uclGroups,
        uelTeams: assembled.uelTeams,
        ueclTeams: assembled.ueclTeams,
        libGroups: assembled.libGroups,
        sudTeams: assembled.sudTeams,
        lastChampions: {
            scudetto: null,
            coppa: null,
            ucl: null,
            uel: null,
            uecl: null,
            libertadores: null,
            sudamericana: null,
        },
        freeAgents,
        clubFinance: {},
        transferLog: [],
    };
}
function coppaField(userId, ids, rng) {
    const ranked = [...ids].sort((a, b) => clubById(b).prestige - clubById(a).prestige);
    const top = ranked.slice(0, 16);
    if (!top.includes(userId))
        top[15] = userId;
    return rng.shuffle(top);
}
export function sortTable(rows) {
    return [...rows].sort((a, b) => {
        if (b.pts !== a.pts)
            return b.pts - a.pts;
        const gdA = a.gf - a.ga;
        const gdB = b.gf - b.ga;
        if (gdB !== gdA)
            return gdB - gdA;
        if (b.gf !== a.gf)
            return b.gf - a.gf;
        return a.clubId.localeCompare(b.clubId);
    });
}
export function applyResultToTable(rows, homeId, awayId, hg, ag) {
    const home = rows.find((r) => r.clubId === homeId);
    const away = rows.find((r) => r.clubId === awayId);
    if (!home || !away)
        return;
    home.played += 1;
    away.played += 1;
    home.gf += hg;
    home.ga += ag;
    away.gf += ag;
    away.ga += hg;
    const hForm = hg > ag ? "W" : hg === ag ? "D" : "L";
    const aForm = ag > hg ? "W" : ag === hg ? "D" : "L";
    home.form = [...home.form, hForm].slice(-5);
    away.form = [...away.form, aForm].slice(-5);
    if (hg > ag) {
        home.won += 1;
        home.pts += 3;
        away.lost += 1;
    }
    else if (ag > hg) {
        away.won += 1;
        away.pts += 3;
        home.lost += 1;
    }
    else {
        home.drawn += 1;
        away.drawn += 1;
        home.pts += 1;
        away.pts += 1;
    }
}
export function wageBill(players, clubId) {
    return players.filter((p) => p.clubId === clubId).reduce((s, p) => s + p.wage, 0);
}
export function fixtureWinner(f) {
    if (!f.played || f.homeGoals === undefined || f.awayGoals === undefined)
        return null;
    if (f.homeGoals > f.awayGoals)
        return f.homeId;
    if (f.awayGoals > f.homeGoals)
        return f.awayId;
    return null;
}
export function tieWinner(save, tieId) {
    const legs = save.fixtures.filter((f) => f.tieId === tieId && f.played);
    const first = legs.find((l) => l.leg === 1);
    const second = legs.find((l) => l.leg === 2);
    if (!first || first.homeGoals === undefined || first.awayGoals === undefined)
        return null;
    if (!second)
        return null;
    if (second.homeGoals === undefined || second.awayGoals === undefined)
        return null;
    const a = first.homeGoals + second.awayGoals;
    const b = first.awayGoals + second.homeGoals;
    if (a !== b)
        return a > b ? first.homeId : first.awayId;
    return resolveDrawWinner(second, save.seed);
}
export function populateKnockout(save, slot) {
    if (slot.fixtures.length > 0)
        return;
    const groups = save.uclGroups?.length ? save.uclGroups : [];
    const libGroups = save.libGroups?.length ? save.libGroups : [];
    if (slot.competition === "coppa" && slot.round >= 2) {
        const prev = save.fixtures.filter((f) => f.competition === "coppa" && f.round === slot.round - 1 && f.played);
        const winners = prev.map((f) => resolveDrawWinner(f, save.seed)).filter(Boolean);
        if (winners.length < 2)
            return;
        slot.fixtures = pair(winners).map(([h, a]) => addFixture(save.fixtures, "coppa", slot.round, h, a));
        return;
    }
    const twoLegComps = ["uel", "uecl", "sudamericana"];
    if (twoLegComps.includes(slot.competition) && slot.round >= 2) {
        fillTwoLegRound(save, slot, slot.competition, slot.round);
        return;
    }
    if (twoLegComps.includes(slot.competition) && slot.round === 1 && slot.leg === 2) {
        return;
    }
    if ((slot.competition === "ucl" || slot.competition === "libertadores") && slot.round === 7) {
        const srcGroups = slot.competition === "ucl" ? groups : libGroups;
        const standings = slot.competition === "ucl" ? save.uclStandings : save.libStandings;
        const qualified = [];
        for (const group of srcGroups) {
            const rows = sortTable(standings.filter((s) => group.includes(s.clubId)));
            if (rows[0])
                qualified.push(rows[0].clubId);
            if (rows[1])
                qualified.push(rows[1].clubId);
        }
        const pairs = [];
        for (let i = 0; i < qualified.length; i += 4) {
            const a1 = qualified[i];
            const a2 = qualified[i + 1];
            const b1 = qualified[i + 2];
            const b2 = qualified[i + 3];
            if (a1 && b2)
                pairs.push([a1, b2]);
            if (b1 && a2)
                pairs.push([b1, a2]);
        }
        fillPairSlot(save, slot, slot.competition, 7, pairs);
        return;
    }
    if ((slot.competition === "ucl" || slot.competition === "libertadores") && slot.round >= 8) {
        fillTwoLegRound(save, slot, slot.competition, slot.round);
    }
}
function fillPairSlot(save, slot, competition, round, pairs) {
    if (slot.leg === 2) {
        const ida = save.calendar.find((s) => s.competition === competition && s.round === round && s.leg === 1 && s.fixtures.length);
        if (!ida)
            return;
        const ids = [];
        for (const fid of ida.fixtures) {
            const f = save.fixtures.find((x) => x.id === fid);
            if (!f?.tieId)
                continue;
            const vuelta = save.fixtures.find((x) => x.tieId === f.tieId && x.leg === 2);
            if (vuelta)
                ids.push(vuelta.id);
        }
        slot.fixtures = ids;
        return;
    }
    const { ida, vuelta } = addTwoLegged(save.fixtures, competition, round, pairs);
    slot.fixtures = ida;
    const vueltaSlot = save.calendar.find((s) => s.competition === competition && s.round === round && s.leg === 2);
    if (vueltaSlot && vueltaSlot.fixtures.length === 0)
        vueltaSlot.fixtures = vuelta;
    if (slot.round === 10 || (finalRoundOf(competition) === round && !slot.leg)) {
        slot.fixtures = pairs.map(([h, a]) => addFixture(save.fixtures, competition, round, h, a));
    }
}
function fillTwoLegRound(save, slot, competition, round) {
    if (finalRoundOf(competition) === round && !slot.leg) {
        const prevRound = round - 1;
        const winners = winnersOfRound(save, competition, prevRound);
        if (winners.length < 2)
            return;
        slot.fixtures = pair(winners).map(([h, a]) => addFixture(save.fixtures, competition, round, h, a));
        return;
    }
    const prevRound = slot.round === 8 || slot.round === 9 || slot.round === 2 || slot.round === 3 ? slot.round - 1 : slot.round;
    const winners = winnersOfRound(save, competition, prevRound);
    if (winners.length < 2)
        return;
    fillPairSlot(save, slot, competition, round, pair(winners));
}
function winnersOfRound(save, competition, round) {
    const legs = save.fixtures.filter((f) => f.competition === competition && f.round === round && f.played);
    const twoLeg = legs.some((f) => f.tieId);
    if (!twoLeg)
        return legs.map((f) => resolveDrawWinner(f, save.seed));
    const ties = new Set(legs.map((f) => f.tieId).filter(Boolean));
    const winners = [];
    for (const tieId of ties) {
        const w = tieWinner(save, tieId);
        if (w)
            winners.push(w);
    }
    return winners;
}
export function resolveDrawWinner(f, seed) {
    if (f.homeGoals === undefined || f.awayGoals === undefined)
        return f.homeId;
    if (f.homeGoals !== f.awayGoals)
        return fixtureWinner(f) ?? f.homeId;
    const rng = new Rng(seed + f.id.length);
    return rng.chance(0.5) ? f.homeId : f.awayId;
}
export function prizeForPlace(place, league = "serieA") {
    const tables = {
        serieA: [42, 36, 30, 26, 22, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3],
        premier: [55, 48, 42, 36, 32, 28, 24, 21, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 5],
        laliga: [48, 42, 36, 32, 28, 24, 20, 18, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 4, 4],
        bundesliga: [44, 38, 32, 28, 24, 20, 17, 15, 13, 11, 10, 9, 8, 7, 6, 5, 4, 4],
        ligue1: [46, 40, 34, 30, 26, 22, 19, 16, 14, 12, 11, 10, 9, 8, 7, 6, 5, 5, 4, 4],
        europe: [42, 36, 30, 26, 22, 18, 16, 14, 12, 10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3],
    };
    const table = tables[league] ?? tables.serieA;
    return (table[place] ?? 3) * 1_000_000;
}
export function awardTrophy(save, kind, winnerId) {
    if (kind === "scudetto")
        save.lastChampions.scudetto = winnerId;
    if (kind === "coppa")
        save.lastChampions.coppa = winnerId;
    if (kind === "ucl")
        save.lastChampions.ucl = winnerId;
    if (kind === "uel")
        save.lastChampions.uel = winnerId;
    if (kind === "uecl")
        save.lastChampions.uecl = winnerId;
    if (kind === "libertadores")
        save.lastChampions.libertadores = winnerId;
    if (kind === "sudamericana")
        save.lastChampions.sudamericana = winnerId;
    if (winnerId !== save.clubId)
        return;
    const already = save.careerTrophies.some((t) => t.kind === kind && t.season === save.season);
    if (already)
        return;
    const club = clubById(save.clubId);
    const prize = trophyPrize(kind, club.league);
    const title = `Felicidades por ganar ${trophyName(kind, club.league)}`;
    const label = trophyLabel(kind, save.season, club.league);
    save.honours[kind] += 1;
    save.budget += prize;
    const titleBonus = titleBonusTotal(save);
    if (titleBonus > 0)
        save.budget -= titleBonus;
    save.trophies.push(label);
    save.careerTrophies.push({
        id: uid("tr"),
        kind,
        season: save.season,
        label,
        prize,
    });
    const body = `${club.name} levanta ${label}. Premio: ${formatMoney(prize)}.${titleBonus > 0 ? ` Bonus por título a la plantilla: ${formatMoney(titleBonus)}.` : ""}`;
    save.news.unshift({ id: uid("n"), week: save.week, tone: "good", title, body });
    save.popups.push({
        id: uid("pop"),
        kind: "trophy",
        tone: "good",
        title,
        body,
        prize,
    });
}
export function maybeAwardCup(save, competition, finalRound, kind) {
    const final = save.fixtures.find((f) => f.competition === competition && f.round === finalRound && f.played);
    if (!final)
        return;
    const w = resolveDrawWinner(final, save.seed);
    awardTrophy(save, kind, w);
}
export function applyFixtureToWorld(save, fixture, hg, ag) {
    const league = competitionToLeague(fixture.competition);
    if (league) {
        applyResultToTable(save.leagueTables[league], fixture.homeId, fixture.awayId, hg, ag);
        const userLeague = playableLeague(clubById(save.clubId).league);
        save.standings = save.leagueTables[userLeague];
    }
    if (fixture.competition === "ucl" && fixture.round <= 6) {
        applyResultToTable(save.uclStandings, fixture.homeId, fixture.awayId, hg, ag);
    }
    if (fixture.competition === "libertadores" && fixture.round <= 6) {
        applyResultToTable(save.libStandings, fixture.homeId, fixture.awayId, hg, ag);
    }
}
export { COMP_THEME, isDomesticCompetition };
