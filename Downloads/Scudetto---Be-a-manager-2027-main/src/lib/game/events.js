import { clubById } from "./clubs";
import { clamp, formatMoney, uid } from "./format";
import { growPlayer } from "./potential";
function news(save, tone, title, body) {
    return { id: uid("n"), week: save.week, tone, title, body };
}
function popup(kind, tone, title, body, prize) {
    return { id: uid("pop"), kind, tone, title, body, prize };
}
function userSquad(save) {
    return save.players.filter((p) => p.clubId === save.clubId && !p.loanFrom);
}
function pickFit(squad, rng) {
    const pool = squad.filter((p) => p.injured === 0);
    return pool.length ? rng.pick(pool) : null;
}
const EVENTS = [
    {
        id: "sponsor",
        weight: 6,
        run: (save, rng) => {
            const amount = rng.int(800_000, 4_200_000);
            save.budget += amount;
            const title = "Patrocinador extra";
            const body = `Un acuerdo relámpago con un sponsor local deja ${formatMoney(amount)} en caja.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
        },
    },
    {
        id: "benefactor",
        weight: 3,
        run: (save, rng) => {
            const amount = rng.int(3_000_000, 9_000_000);
            save.budget += amount;
            const title = "Mecenas inesperado";
            const body = `Un ex socio reaparece y dona ${formatMoney(amount)} al club.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
        },
    },
    {
        id: "tv",
        weight: 5,
        run: (save, rng) => {
            const amount = rng.int(1_200_000, 3_500_000);
            save.budget += amount;
            const title = "Derechos de TV";
            const body = `Un recálculo de los derechos deja ${formatMoney(amount)} extra.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
        },
    },
    {
        id: "gate",
        weight: 5,
        run: (save, rng) => {
            const amount = rng.int(400_000, 1_800_000);
            save.budget += amount;
            const title = "Taquilla récord";
            const body = `${clubById(save.clubId).stadium} se llenó. Ingreso extra ${formatMoney(amount)}.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
        },
    },
    {
        id: "youth-burst",
        weight: 4,
        run: (save, rng) => {
            const kids = userSquad(save).filter((p) => p.age <= 21);
            const p = kids.length ? rng.pick(kids) : null;
            if (!p)
                return null;
            p.pot = clamp(p.pot + rng.int(2, 5), p.ovr, 100);
            growPlayer(p, rng.int(1, 2), rng, { ignoreCap: true });
            const title = `${p.name} da un salto`;
            const body = `En los entrenamientos se ve otro jugador. Potencial ${p.pot}.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
        },
    },
    {
        id: "camp",
        weight: 5,
        run: (save, rng) => {
            for (const p of userSquad(save)) {
                p.fitness = clamp(p.fitness + rng.int(4, 10), 40, 100);
                p.form = clamp(p.form + 1, -5, 5);
            }
            const title = "Concentración redonda";
            const body = "La plantilla vuelve más fresca y conectada.";
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
        },
    },
    {
        id: "heal",
        weight: 4,
        run: (save, rng) => {
            const hurt = userSquad(save).filter((p) => p.injured > 0);
            const p = hurt.length ? rng.pick(hurt) : null;
            if (!p)
                return null;
            p.injured = 0;
            p.fitness = clamp(p.fitness + 20, 50, 100);
            const title = `${p.name} vuelve antes`;
            const body = "Los médicos aceleran la recuperación. Disponible para el próximo partido.";
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
        },
    },
    {
        id: "fairplay",
        weight: 3,
        run: (save, rng) => {
            const amount = rng.int(250_000, 900_000);
            save.budget += amount;
            const title = "Premio fair play";
            const body = `La liga premia la conducta del vestuario con ${formatMoney(amount)}.`;
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body, amount) };
        },
    },
    {
        id: "injury-star",
        weight: 2,
        run: (save, rng) => {
            const xi = save.tactics.lineup
                .map((id) => save.players.find((pl) => pl.id === id))
                .filter((pl) => pl !== undefined && pl.injured === 0);
            const p = xi.length ? rng.pick(xi) : pickFit(userSquad(save), rng);
            if (!p)
                return null;
            p.injured = rng.int(2, 5);
            p.fitness = Math.min(p.fitness, 46);
            const title = `${p.name} se lesiona`;
            const body = `Molestia muscular. Fuera ${p.injured} jornadas.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body) };
        },
    },
    {
        id: "flu",
        weight: 4,
        run: (save, rng) => {
            const squad = userSquad(save);
            const n = Math.min(squad.length, rng.int(3, 6));
            const picks = rng.shuffle(squad).slice(0, n);
            for (const p of picks)
                p.fitness = clamp(p.fitness - rng.int(12, 22), 38, 100);
            const title = "Gripe en el vestuario";
            const body = `${picks.length} jugadores bajan de tono esta semana.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body) };
        },
    },
    {
        id: "row",
        weight: 4,
        run: (save, rng) => {
            const squad = userSquad(save);
            const a = pickFit(squad, rng);
            if (!a)
                return null;
            a.morale = clamp(a.morale - rng.int(10, 22), 30, 100);
            a.form = clamp(a.form - 2, -5, 5);
            const title = "Bronca en el vestuario";
            const body = `${a.name} discute con el cuerpo técnico. El ambiente se enfría.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body) };
        },
    },
    {
        id: "fine",
        weight: 5,
        run: (save, rng) => {
            const amount = rng.int(400_000, 2_200_000);
            save.budget -= amount;
            const title = "Multa de la federación";
            const body = `Sanción disciplinaria: ${formatMoney(amount)}.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
        },
    },
    {
        id: "leak",
        weight: 3,
        run: (save, rng) => {
            for (const p of userSquad(save))
                p.morale = clamp(p.morale - rng.int(2, 6), 35, 100);
            const title = "Filtración a la prensa";
            const body = "Un audio interno sale a la luz. El grupo se cierra.";
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body) };
        },
    },
    {
        id: "ultras",
        weight: 3,
        run: (save, rng) => {
            const amount = rng.int(200_000, 1_100_000);
            save.budget -= amount;
            const title = "Protesta en la curva";
            const body = `Incidentes menores y daños. Coste ${formatMoney(amount)}.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
        },
    },
    {
        id: "stadium",
        weight: 3,
        run: (save, rng) => {
            const amount = rng.int(600_000, 3_000_000);
            save.budget -= amount;
            const title = "Gotera en el estadio";
            const body = `Obras urgentes en ${clubById(save.clubId).stadium}: ${formatMoney(amount)}.`;
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body, -amount) };
        },
    },
    {
        id: "exit",
        weight: 4,
        run: (save, rng) => {
            const stars = userSquad(save).filter((p) => p.ovr >= 78 && !p.listed);
            const p = stars.length ? rng.pick(stars) : null;
            if (!p)
                return null;
            p.morale = clamp(p.morale - 12, 30, 100);
            p.listed = true;
            const title = `${p.name} pide irse`;
            const body = "Su agente filtra que quiere un cambio de aires. Quedó en venta.";
            return { news: news(save, "bad", title, body), popup: popup("event", "bad", title, body) };
        },
    },
    {
        id: "wage",
        weight: 3,
        run: (save, rng) => {
            const p = pickFit(userSquad(save).filter((x) => x.ovr >= 76), rng);
            if (!p)
                return null;
            const bump = Math.round(p.wage * 0.18);
            p.wage += bump;
            p.morale = clamp(p.morale + 6, 40, 100);
            const title = `${p.name} renegocia`;
            const body = `El agente aprieta. Salario semanal ahora ${formatMoney(p.wage)}.`;
            return { news: news(save, "neutral", title, body), popup: popup("event", "neutral", title, body) };
        },
    },
    {
        id: "boost-form",
        weight: 4,
        run: (save, rng) => {
            const p = pickFit(userSquad(save), rng);
            if (!p)
                return null;
            p.form = clamp(p.form + rng.int(2, 4), -5, 5);
            p.morale = clamp(p.morale + 8, 40, 100);
            const title = `${p.name}, en racha`;
            const body = "Encuentra el punto. La afición lo nota.";
            return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
        },
    },
    {
        id: "scout-tip",
        weight: 3,
        run: (save, rng) => {
            const amount = rng.int(0, 0);
            save.budget += amount;
            const title = "Soplo de un ojeador";
            const body = "Un contacto en Sudamérica recomienda mirar la pestaña de cantera esta semana.";
            return { news: news(save, "neutral", title, body), popup: popup("event", "neutral", title, body) };
        },
    },
    {
        id: "derbi",
        weight: 2,
        run: (save) => {
            const title = "Semana de derbi";
            const body = "La ciudad no habla de otra cosa. El vestuario está encendido.";
            for (const p of userSquad(save))
                p.morale = clamp(p.morale + 3, 40, 100);
            return { news: news(save, "neutral", title, body), popup: popup("event", "neutral", title, body) };
        },
    },
];
/** ~1 in 6 weeks. If it hits, pick a weighted random event. */
export function rollWeeklyEvent(save, rng) {
    if (!rng.chance(0.17))
        return;
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let roll = rng.float() * total;
    let picked = EVENTS[0];
    for (const e of EVENTS) {
        roll -= e.weight;
        if (roll <= 0) {
            picked = e;
            break;
        }
    }
    const result = picked.run(save, rng);
    if (!result)
        return;
    save.news.unshift(result.news);
    save.popups.push(result.popup);
}
