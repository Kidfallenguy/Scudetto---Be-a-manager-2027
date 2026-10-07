import { makeYouth } from "./academy";
import { clubById } from "./clubs";
import { scaledMoney } from "./event-decisions";
import type { EventEffect } from "./event-effects";
import {
  academyHasRoom,
  clubNat,
  competitionLabel,
  isBigMatch,
  isCaptain,
  isFit,
  isImportant,
  isKid,
  isLegend,
  isStar,
  isStarter,
  isVeteran,
  isYouth,
  lastNameOf,
  lateSeason,
  news,
  opponentName,
  otherFit,
  pickFit,
  pickOtherClub,
  popup,
  squadHasRoom,
  usedNames,
  userSquad,
} from "./event-kit";
import { LIBRARY_DECISIONS } from "./event-library-decisions";
import type { DecisionEventDef, EventDef, InstantEventDef } from "./events";
import { POS_LABEL, clamp, formatMoney } from "./format";
import { FIRST, makeName } from "./names";
import { growPlayer } from "./potential";
import type { Rng } from "./rng";
import type { EventTiming, EventTopic, GamePopup, GameSave, Player, Pos, YouthPlayer } from "./types";

/* ──────────────────────────────────────────────────────────────────────────
 * BIBLIOTECA DE SUCESOS INESPERADOS
 *
 * Sumá situaciones nuevas en este archivo (instantáneas) o en
 * event-library-decisions.ts (con decisión del usuario).
 *
 * El motor (frecuencia, enfriamiento, sorteo, consecuencias) está en events.ts
 * y no hace falta tocarlo.
 * ────────────────────────────────────────────────────────────────────────── */

type Story = {
  id: string;
  category: InstantEventDef["category"];
  topic: EventTopic;
  timing: EventTiming;
  weight: number;
  cooldown?: number;
  eligible?: InstantEventDef["eligible"];
  weightMod?: InstantEventDef["weightMod"];
  players?: InstantEventDef["players"];
  youths?: InstantEventDef["youths"];
  tone?: GamePopup["tone"];
  title: string | ((save: GameSave, rng: Rng, p?: Player, y?: YouthPlayer) => string);
  body: string | ((save: GameSave, rng: Rng, p?: Player, y?: YouthPlayer) => string);
  effects?: (save: GameSave, rng: Rng, p?: Player, y?: YouthPlayer) => EventEffect[] | undefined;
  ok?: (save: GameSave, rng: Rng, p?: Player, y?: YouthPlayer) => boolean;
};

function story(opts: Story): InstantEventDef {
  const tone =
    opts.tone ?? (opts.category === "positive" ? "good" : opts.category === "negative" ? "bad" : "neutral");
  return {
    id: opts.id,
    category: opts.category,
    topic: opts.topic,
    timing: opts.timing,
    weight: opts.weight,
    cooldown: opts.cooldown,
    eligible: opts.eligible,
    weightMod: opts.weightMod,
    players: opts.players,
    youths: opts.youths,
    run: (save, rng, player, youth) => {
      if (opts.players && !player) return null;
      if (opts.youths && !youth) return null;
      if (opts.ok && !opts.ok(save, rng, player, youth)) return null;
      const title = typeof opts.title === "function" ? opts.title(save, rng, player, youth) : opts.title;
      const body = typeof opts.body === "function" ? opts.body(save, rng, player, youth) : opts.body;
      return {
        news: news(save, tone, title, body),
        popup: popup("event", tone, title, body),
        effects: opts.effects?.(save, rng, player, youth),
      };
    },
  };
}

const POS_POOL: Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];

function firstName(rng: Rng, nat: string) {
  const list = FIRST[nat] ?? FIRST.ITA!;
  return rng.pick(list);
}

function makeAcademyKid(
  save: GameSave,
  rng: Rng,
  forced: Partial<YouthPlayer> & { lastName?: string } = {},
): YouthPlayer {
  const nat = forced.nat ?? clubNat(save);
  const used = usedNames(save);
  const name =
    forced.name ??
    (forced.lastName ? `${firstName(rng, nat)} ${forced.lastName}` : makeName(rng, nat, used));
  used.add(name);
  const { lastName: _last, ...rest } = forced;
  return makeYouth(rng, nat, used, save.clubId, save.academyLevel, {
    ...rest,
    name,
    pos: forced.pos ?? rng.pick(POS_POOL),
  });
}

function who(p: Player | undefined, fallback = "Un jugador") {
  return p?.name ?? fallback;
}

const INSTANTS: InstantEventDef[] = [
  story({
    id: "pos-trophy-gift",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 22,
    players: (p) => isStar(p) || isLegend(p),
    title: (_s, _r, p) => `${who(p)} dona un trofeo al club`,
    body: (_s, _r, p) =>
      `${who(p)} deja en la vitrina un trofeo de su etapa anterior. El museo del club suma una pieza y el vestuario se emociona.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "prestige", delta: 1 },
            { kind: "clubBond", target: p, delta: 8 },
            { kind: "morale", target: "squad", delta: 3 },
          ]
        : undefined,
  }),
  story({
    id: "pos-local-award",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 4,
    players: (p) => p.ovr >= 70 && isFit(p),
    title: (_s, _r, p) => `Reconocimiento para ${who(p)}`,
    body: (_s, _r, p) =>
      `El municipio nombra a ${who(p)} deportista del mes. No es el Balón de Oro, pero en el barrio se celebra.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 6 }, { kind: "form", target: p, delta: 1 }] : undefined),
  }),
  story({
    id: "pos-apps-milestone",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => p.careerApps >= 40,
    title: (_s, _r, p) => `${who(p)} alcanza los ${p ? p.careerApps : 0} partidos de carrera`,
    body: (_s, _r, p) =>
      `${who(p)} entra en una cifra redonda. La afición prepara una bandera y el cuerpo técnico le dedica el círculo.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: 8 },
            { kind: "clubBond", target: p, delta: 6 },
            { kind: "prestige", delta: 1 },
          ]
        : undefined,
  }),
  story({
    id: "pos-fans-homage",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p, save) => isImportant(p, save),
    title: (_s, _r, p) => `La afición homenajea a ${who(p)}`,
    body: (_s, _r, p) =>
      `Antes del partido, la curva despliega un mosaico con el nombre de ${who(p)}. El estadio se pone de pie.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: 10 },
            { kind: "teamBoost", rating: 0.4, games: 1, label: "homenaje de la afición" },
          ]
        : undefined,
  }),
  story({
    id: "pos-legend-training",
    category: "positive",
    topic: "club",
    timing: "pre",
    weight: 3,
    cooldown: 18,
    title: "Una leyenda visita el entrenamiento",
    body: (save) =>
      `Una gloria de ${clubById(save.clubId).short} se acerca a ver el trabajo. Los más jóvenes se quedan callados; los veteranos lo abrazan.`,
    effects: () => [
      { kind: "morale", target: "squad", delta: 4 },
      { kind: "teamBoost", rating: 0.5, games: 1, label: "visita de una leyenda" },
      { kind: "prestige", delta: 1 },
    ],
  }),
  story({
    id: "pos-player-stays",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 3,
    cooldown: 18,
    players: (p) => isStar(p) && !p.listed,
    title: (_s, _r, p) => `${who(p)} corta rumores de salida`,
    body: (_s, _r, p) =>
      `Apareció una oferta seria, pero ${who(p)} dice en cámara que se queda. El vestuario lo aplaude.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "clubBond", target: p, delta: 12 },
            { kind: "morale", target: p, delta: 6 },
            { kind: "squadBond", target: p, delta: 4 },
            { kind: "board", delta: 1, reason: "Una estrella eligió quedarse" },
          ]
        : undefined,
  }),
  story({
    id: "pos-teammate-help",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 5,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} da una mano`,
    body: (save, rng, p) => {
      const other = p ? otherFit(save, rng, p.id) : null;
      return other
        ? `${who(p)} se queda extra a trabajar con ${other.name}. La relación entre ambos se nota en el campo.`
        : `${who(p)} se queda extra a trabajar con los más jóvenes.`;
    },
    effects: (save, rng, p) => {
      if (!p) return undefined;
      const other = otherFit(save, rng, p.id);
      const fx: EventEffect[] = [
        { kind: "squadBond", target: p, delta: 8 },
        { kind: "morale", target: p, delta: 3 },
      ];
      if (other) fx.push({ kind: "squadBond", target: other, delta: 8 }, { kind: "form", target: other, delta: 1 });
      return fx;
    },
  }),
  story({
    id: "pos-locker-leader",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 20,
    players: (p) => p.age >= 26 && p.ovr >= 74,
    title: (_s, _r, p) => `${who(p)} se convierte en referente`,
    body: (_s, _r, p) =>
      `Sin que nadie lo nombre, ${who(p)} empieza a hablar cuando hay que hablar. El vestuario lo escucha.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "squadBond", target: p, delta: 10 },
            { kind: "morale", target: "squad", delta: 3 },
            { kind: "clubBond", target: p, delta: 6 },
          ]
        : undefined,
  }),
  story({
    id: "pos-legend-donation",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 2,
    cooldown: 28,
    title: "Donación de una leyenda",
    body: (save) => {
      const amount = scaledMoney(save, 0.8, 400_000);
      return `Una gloria del club transfiere ${formatMoney(amount)} para el fútbol formativo. "Este club me lo dio todo", dice.`;
    },
    effects: (save) => [
      { kind: "money", amount: scaledMoney(save, 0.8, 400_000) },
      { kind: "prestige", delta: 1 },
    ],
  }),
  story({
    id: "pos-historic-recognition",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 2,
    cooldown: 30,
    title: "Reconocimiento histórico",
    body: (save) =>
      `Una federación internacional distingue a ${clubById(save.clubId).name} por su trayectoria. En el museo cuelgan una placa.`,
    effects: () => [
      { kind: "prestige", delta: 2 },
      { kind: "board", delta: 1.5, reason: "Reconocimiento institucional" },
    ],
  }),
  {
    id: "pos-youth-training-leap",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => isYouth(p) && isFit(p),
    run: (save, rng, p) => {
      if (!p) return null;
      p.pot = clamp(p.pot + rng.int(1, 3), p.ovr, 99);
      growPlayer(p, 1, rng, { ignoreCap: true });
      const title = `${p.name} sorprende en el entrenamiento`;
      const body = `El juvenil deja a todos callados. Se lo ve otro. Potencial ${p.pot}.`;
      return { news: news(save, "good", title, body), popup: popup("event", "good", title, body) };
    },
  },
  story({
    id: "pos-team-of-week",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 5,
    players: (p) => p.form >= 1 && p.apps >= 1,
    title: (_s, _r, p) => `${who(p)} entra en el equipo de la jornada`,
    body: (_s, _r, p) => `Los medios lo ponen en el once ideal. ${who(p)} sube un escalón de confianza.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: 7 }, { kind: "form", target: p, delta: 1 }, { kind: "value", target: p, pct: 4, games: 4 }] : undefined,
  }),
  story({
    id: "pos-award-nomination",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 24,
    eligible: lateSeason,
    players: (p) => isStar(p) && p.apps >= 8,
    title: (_s, _r, p) => `${who(p)} entra en una lista de premiados`,
    body: (_s, _r, p) =>
      `Una revista europea incluye a ${who(p)} entre los nominados de fin de temporada. Todavía no hay ganador, pero el nombre ya suena.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: 8 },
            { kind: "value", target: p, pct: 6, games: 6 },
            { kind: "prestige", delta: 1 },
          ]
        : undefined,
  }),
  story({
    id: "pos-sponsor-bonus",
    category: "positive",
    topic: "economy",
    timing: "any",
    weight: 5,
    title: "Bonificación de un patrocinador",
    body: (save) =>
      `Un sponsor suelta una cláusula extra por visibilidad: ${formatMoney(scaledMoney(save, 0.45, 200_000))} caen en caja.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.45, 200_000) }],
  }),
  story({
    id: "pos-confidence-back",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => isFit(p) && (p.form <= -1 || p.morale <= 55),
    title: (_s, _r, p) => `${who(p)} recupera confianza`,
    body: (_s, _r, p) =>
      `Después de una racha gris, ${who(p)} se ve otra vez. El cuerpo técnico lo notó en la charla previa.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "form", target: p, delta: 2 }, { kind: "morale", target: p, delta: 10 }] : undefined,
  }),
  story({
    id: "pos-ovr-spark",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 1,
    cooldown: 36,
    players: (p) => isFit(p) && p.ovr <= 88 && p.age <= 29,
    title: (_s, _r, p) => `${who(p)} da un salto inesperado`,
    body: (_s, _r, p) =>
      `Una racha de trabajo y un click táctico: ${who(p)} se ve medio punto más completo. No pasa todos los días.`,
    effects: (_s, _r, p) => (p ? [{ kind: "ovr", target: p, delta: 1 }, { kind: "morale", target: p, delta: 6 }] : undefined),
  }),
  story({
    id: "pos-kit-boom",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 4,
    title: "Se agota la camiseta",
    body: (save) =>
      `Una reedición de la camiseta histórica vuela de las tiendas. Ingreso extra ${formatMoney(scaledMoney(save, 0.35, 150_000))}.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.35, 150_000) }, { kind: "prestige", delta: 1 }],
  }),
  story({
    id: "pos-captain-speech",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: isCaptain,
    title: (_s, _r, p) => `${who(p)} prende al grupo`,
    body: (_s, _r, p) =>
      `El capitán ${who(p)} habla poco y justo. El vestuario sale a cancha un poco más entero.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: "squad", delta: 5 },
            { kind: "teamBoost", rating: 0.4, games: 1, label: "charla del capitán" },
          ]
        : undefined,
  }),
  story({
    id: "pos-veteran-masterclass",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p) => isVeteran(p) && isFit(p),
    title: (_s, _r, p) => `${who(p)} da una clase`,
    body: (_s, _r, p) =>
      `El veterano se queda con los juveniles a marcar espacios. En dos toques les muestra lo que el video no muestra.`,
    effects: (save, _rng, p) => {
      if (!p) return undefined;
      const kid = userSquad(save).find((x) => isYouth(x) && x.id !== p.id && isFit(x));
      const fx: EventEffect[] = [
        { kind: "squadBond", target: p, delta: 6 },
        { kind: "clubBond", target: p, delta: 4 },
      ];
      if (kid) fx.push({ kind: "form", target: kid, delta: 1 }, { kind: "squadBond", target: kid, delta: 8 });
      return fx;
    },
  }),
  story({
    id: "pos-charity-shirt",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 4,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} subasta su camiseta`,
    body: (_s, _r, p) =>
      `${who(p)} dona la camiseta del último partido a una causa local. La afición lo aplaude más que por un gol.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "clubBond", target: p, delta: 5 },
            { kind: "prestige", delta: 1 },
            { kind: "morale", target: p, delta: 4 },
          ]
        : undefined,
  }),
  story({
    id: "pos-board-praise",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 3,
    title: "La dirigencia sale a bancar",
    body: "Un comunicado interno felicita el trabajo del cuerpo técnico. No cambia el campeonato, pero baja un poco la presión.",
    effects: () => [{ kind: "board", delta: 2, reason: "Respaldo público de la dirigencia" }, { kind: "morale", target: "squad", delta: 2 }],
  }),
  story({
    id: "pos-viral-clip",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 4,
    players: (p) => p.pos !== "GK" && p.form >= 0,
    title: (_s, _r, p) => `El video de ${who(p)} da la vuelta al mundo`,
    body: (_s, _r, p) =>
      `Una jugada de ${who(p)} se vuelve viral. Marcas y ojeadores lo miran con otros ojos.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "value", target: p, pct: 8, games: 5 }, { kind: "morale", target: p, delta: 5 }] : undefined,
  }),
  story({
    id: "pos-academy-grant",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 3,
    title: "Subsidio para la cantera",
    body: (save) =>
      `Un programa nacional deposita ${formatMoney(scaledMoney(save, 0.25, 120_000))} para el fútbol formativo.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.25, 120_000) }],
  }),
  story({
    id: "pos-gk-hero",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 2,
    cooldown: 30,
    players: (p) => p.pos === "GK",
    title: (_s, _r, p) => `${who(p)} es noticia fuera de la cancha`,
    body: (_s, _r, p) =>
      `${who(p)} ayuda a un hincha que se descompensó en las inmediaciones del estadio. La ciudad se lo agradece.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "prestige", delta: 1 },
            { kind: "clubBond", target: p, delta: 8 },
            { kind: "morale", target: p, delta: 6 },
          ]
        : undefined,
  }),
  story({
    id: "neg-player-illness",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 5,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} se enferma`,
    body: (_s, _r, p) => `${who(p)} amanece con fiebre. Los médicos lo bajan para no contagiar al grupo.`,
    effects: (_s, rng, p) => (p ? [{ kind: "illness", target: p, games: rng.int(1, 2), reason: "Fiebre" }] : undefined),
  }),
  story({
    id: "neg-personal-mess",
    category: "negative",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} atraviesa un mal momento`,
    body: (_s, _r, p) =>
      `Problemas personales de ${who(p)} se filtran al vestuario. No es una lesión, pero la cabeza no está.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: -12 },
            { kind: "form", target: p, delta: -2 },
            { kind: "clubBond", target: p, delta: -3 },
          ]
        : undefined,
  }),
  story({
    id: "neg-family-loss",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 2,
    cooldown: 28,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} pierde a un familiar`,
    body: (_s, _r, p) =>
      `Fallece un familiar cercano de ${who(p)}. El club le da el espacio: se pierde los próximos partidos.`,
    effects: (_s, rng, p) =>
      p
        ? [
            { kind: "absence", target: p, games: rng.int(2, 3), reason: "Duelo familiar", absenceKind: "personal" },
            { kind: "morale", target: p, delta: -8 },
            { kind: "morale", target: "squad", delta: -2 },
          ]
        : undefined,
  }),
  story({
    id: "neg-money-trouble",
    category: "negative",
    topic: "player",
    timing: "between",
    weight: 3,
    players: (p) => p.age <= 24 && p.ovr < 82,
    title: (_s, _r, p) => `${who(p)} tiene problemas económicos`,
    body: (_s, _r, p) =>
      `El entorno de ${who(p)} se endeudó y el jugador llega distraído. No pide nada todavía, pero se nota.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: -8 }, { kind: "form", target: p, delta: -1 }] : undefined,
  }),
  story({
    id: "neg-press-storm",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p, save) => isImportant(p, save),
    title: (_s, _r, p) => `${who(p)} queda en el ojo de la prensa`,
    body: (_s, _r, p) =>
      `Una entrevista mal cortada deja a ${who(p)} como el villano de la semana. El ruido llega al vestuario.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: -7 },
            { kind: "clubBond", target: p, delta: -4 },
            { kind: "prestige", delta: -1 },
          ]
        : undefined,
  }),
  story({
    id: "neg-coach-row",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p, save) => isImportant(p, save) && isFit(p),
    title: (_s, _r, p) => `${who(p)} discute con el cuerpo técnico`,
    body: (_s, _r, p) =>
      `Una discusión en el entrenamiento termina en portazo. ${who(p)} y el banquillo quedan cortados.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "clubBond", target: p, delta: -10 },
            { kind: "morale", target: p, delta: -8 },
            { kind: "form", target: p, delta: -1 },
            { kind: "board", delta: -1, reason: "Choque público con un jugador" },
          ]
        : undefined,
  }),
  story({
    id: "neg-minutes-anger",
    category: "negative",
    topic: "player",
    timing: "between",
    weight: 5,
    players: (p, save) => p.ovr >= 68 && !save.tactics.lineup.includes(p.id) && isFit(p),
    title: (_s, _r, p) => `${who(p)} está molesto por los minutos`,
    body: (_s, _r, p) =>
      `${who(p)} no entiende por qué no es titular. Su agente ya habla con periodistas amigos.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: -10 },
            { kind: "clubBond", target: p, delta: -8 },
            { kind: "form", target: p, delta: -1 },
          ]
        : undefined,
  }),
  story({
    id: "neg-contract-grumble",
    category: "negative",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => p.ovr >= 76 && p.contract <= 2,
    title: (_s, _r, p) => `${who(p)} no está conforme con el contrato`,
    body: (_s, _r, p) =>
      `El representante de ${who(p)} compara salarios y sale picado. El jugador no pide la salida, todavía.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: -6 }, { kind: "clubBond", target: p, delta: -6 }] : undefined,
  }),
  story({
    id: "neg-ovr-dip",
    category: "negative",
    topic: "player",
    timing: "any",
    weight: 1,
    cooldown: 36,
    players: (p) => isFit(p) && p.ovr >= 70 && p.form <= -1,
    title: (_s, _r, p) => `${who(p)} baja un cambio`,
    body: (_s, _r, p) =>
      `El cuerpo técnico ve a ${who(p)} un punto por debajo. No es una lesión: es una racha que se come la media.`,
    effects: (_s, _r, p) => (p ? [{ kind: "ovr", target: p, delta: -1 }, { kind: "morale", target: p, delta: -6 }] : undefined),
  }),
  story({
    id: "neg-injury-relapse",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p) => p.injured > 0,
    title: (_s, _r, p) => `${who(p)} recae`,
    body: (_s, _r, p) =>
      `Justo cuando ${who(p)} empezaba a trabajar con el grupo, la molestia vuelve. Se alarga la baja.`,
    effects: (_s, rng, p) => (p ? [{ kind: "injury", target: p, games: rng.int(2, 4) }] : undefined),
  }),
  story({
    id: "neg-off-field-accident",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 2,
    cooldown: 24,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} tiene un accidente`,
    body: (_s, _r, p) =>
      `Un percance menor fuera del campo deja a ${who(p)} magullado. No es grave, pero no llega al partido.`,
    effects: (_s, rng, p) =>
      p
        ? [
            { kind: "absence", target: p, games: rng.int(1, 2), reason: "Accidente particular", absenceKind: "other" },
            { kind: "fitness", target: p, delta: -12 },
          ]
        : undefined,
  }),
  story({
    id: "neg-player-fine",
    category: "negative",
    topic: "player",
    timing: "any",
    weight: 3,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} comete una infracción`,
    body: (save, _r, p) =>
      `${who(p)} llega tarde a un control y el club debe pagar ${formatMoney(scaledMoney(save, 0.12, 80_000))} de multa.`,
    effects: (save, _r, p) =>
      p
        ? [
            { kind: "money", amount: -scaledMoney(save, 0.12, 80_000) },
            { kind: "clubBond", target: p, delta: -4 },
            { kind: "board", delta: -0.5, reason: "Infracción de un jugador" },
          ]
        : undefined,
  }),
  story({
    id: "neg-crowd-incident",
    category: "negative",
    topic: "club",
    timing: "between",
    weight: 3,
    cooldown: 20,
    title: "Incidente en el estadio",
    body: (save) =>
      `Un incidente menor en la tribuna termina en sanción. El club paga ${formatMoney(scaledMoney(save, 0.3, 180_000))}.`,
    effects: (save) => [
      { kind: "money", amount: -scaledMoney(save, 0.3, 180_000) },
      { kind: "prestige", delta: -1 },
    ],
  }),
  story({
    id: "neg-unexpected-sanction",
    category: "negative",
    topic: "economy",
    timing: "any",
    weight: 3,
    title: "Sanción económica inesperada",
    body: (save) =>
      `Un recálculo administrativo deja una deuda de ${formatMoney(scaledMoney(save, 0.4, 220_000))} con la liga.`,
    effects: (save) => [{ kind: "money", amount: -scaledMoney(save, 0.4, 220_000) }],
  }),
  story({
    id: "neg-confidence-crisis",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 3,
    eligible: isBigMatch,
    players: (p, save) => isStarter(p, save),
    title: (_s, _r, p) => `${who(p)} llega corto al partido grande`,
    body: (save, _r, p) =>
      `${who(p)} no duerme bien la noche previa a ${opponentName(save)}. El cuerpo técnico lo ve tenso.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "form", target: p, delta: -2 }, { kind: "morale", target: p, delta: -6 }] : undefined,
  }),
  story({
    id: "neg-nightlife",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p) => p.age <= 24 && isFit(p),
    title: (_s, _r, p) => `${who(p)} se fue de fiesta`,
    body: (_s, _r, p) =>
      `Un video de ${who(p)} a la madrugada recorre las redes. Llega al entrenamiento hecho polvo.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "fitness", target: p, delta: -14 },
            { kind: "morale", target: p, delta: -4 },
            { kind: "clubBond", target: p, delta: -5 },
            { kind: "board", delta: -0.8, reason: "Indisciplina nocturna" },
          ]
        : undefined,
  }),
  story({
    id: "neg-food-poison",
    category: "negative",
    topic: "club",
    timing: "pre",
    weight: 3,
    cooldown: 20,
    title: "Intoxicación en la concentración",
    body: "Algo no sentó bien en la cena. Varios bajan de tono y el más golpeado queda en cama.",
    effects: (save, rng) => {
      const squad = userSquad(save).filter(isFit);
      const sick = squad.length ? rng.pick(squad) : null;
      const fx: EventEffect[] = [{ kind: "fitness", target: "squad", delta: -8 }];
      if (sick) fx.push({ kind: "illness", target: sick, games: 1, reason: "Intoxicación" });
      return fx;
    },
  }),
  story({
    id: "neg-tactical-leak",
    category: "negative",
    topic: "club",
    timing: "pre",
    weight: 2,
    cooldown: 22,
    title: "Se filtra el plan de partido",
    body: (save) =>
      `Un video interno con la pizarra para ${opponentName(save)} aparece en redes. Hay que cambiar cosas sobre la marcha.`,
    effects: () => [{ kind: "teamBoost", rating: -0.6, games: 1, label: "plan filtrado" }, { kind: "board", delta: -1, reason: "Filtración táctica" }],
  }),
  story({
    id: "neg-passport",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 2,
    cooldown: 26,
    eligible: isBigMatch,
    players: (p, save) => isStarter(p, save) && p.nat !== clubNat(save),
    title: (_s, _r, p) => `${who(p)} se olvida el pasaporte`,
    body: (_s, _r, p) =>
      `${who(p)} no tiene el documento a mano y el viaje se complica. Para este partido no llega.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "absence", target: p, games: 1, reason: "Trámite de viaje", absenceKind: "other" }] : undefined,
  }),
  story({
    id: "neu-new-agent",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 5,
    players: (p) => p.ovr >= 68,
    title: (_s, _r, p) => `${who(p)} cambia de representante`,
    body: (_s, _r, p) =>
      `${who(p)} firma con otra agencia. Por ahora no pide nada: solo cambia de interlocutor.`,
  }),
  story({
    id: "neu-new-number",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 5,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} quiere otro número`,
    body: (_s, _r, p) =>
      `${who(p)} pide cambiar de dorsal "por una cuestión personal". El utillero ya tiene la camiseta lista.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 3 }] : undefined),
  }),
  story({
    id: "neu-interview",
    category: "neutral",
    topic: "player",
    timing: "between",
    weight: 5,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} da una entrevista`,
    body: (_s, _r, p) =>
      `${who(p)} habla de su infancia, del club y de lo que le falta. No hay polémica: solo contexto.`,
  }),
  story({
    id: "neu-club-event",
    category: "neutral",
    topic: "club",
    timing: "between",
    weight: 4,
    title: "Evento del club",
    body: "Cena benéfica, fotos, discursos cortos. El plantel aparece, sonríe y se va temprano.",
    effects: () => [{ kind: "morale", target: "squad", delta: 2 }],
  }),
  story({
    id: "neu-commercial",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => p.ovr >= 75,
    title: (_s, _r, p) => `Propuesta comercial para ${who(p)}`,
    body: (_s, _r, p) =>
      `Una marca de ropa le ofrece a ${who(p)} un contrato personal. El club no interviene: es cosa suya.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 2 }] : undefined),
  }),
  story({
    id: "neu-future-talk",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => p.contract <= 2 || p.age >= 31,
    title: (_s, _r, p) => `${who(p)} quiere hablar de su futuro`,
    body: (_s, _r, p) =>
      `${who(p)} pide una reunión. No hay ultimátum: quiere saber dónde está parado.`,
  }),
  story({
    id: "neu-old-boy",
    category: "neutral",
    topic: "club",
    timing: "any",
    weight: 4,
    title: "Un exjugador reaparece",
    body: (save) =>
      `Un antiguo futbolista de ${clubById(save.clubId).short} se acerca a saludar. Se saca fotos, firma camisetas y se va.`,
  }),
  story({
    id: "neu-documentary",
    category: "neutral",
    topic: "club",
    timing: "between",
    weight: 3,
    title: "Propuesta de documental",
    body: "Una productora quiere seguir una semana al equipo. Todavía no se filma nada: solo hay una carpeta.",
  }),
  story({
    id: "neu-language",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p, save) => p.nat !== clubNat(save),
    title: (_s, _r, p) => `${who(p)} se pone a estudiar el idioma`,
    body: (_s, _r, p) =>
      `${who(p)} arranca clases para entenderse mejor en el vestuario. Los compañeros se ríen... y después lo ayudan.`,
    effects: (_s, _r, p) => (p ? [{ kind: "squadBond", target: p, delta: 6 }] : undefined),
  }),
  story({
    id: "neu-superstition",
    category: "neutral",
    topic: "player",
    timing: "pre",
    weight: 5,
    players: (p, save) => isStarter(p, save),
    title: (_s, _r, p) => `${who(p)} no se saca las medias`,
    body: (_s, _r, p) =>
      `${who(p)} entra al vestuario con las mismas medias de hace tres partidos. Nadie se las discute.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 2 }] : undefined),
  }),
  story({
    id: "neu-newborn",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 24,
    players: (p) => p.age >= 23 && p.age <= 36,
    title: (_s, _r, p) => `${who(p)} es padre`,
    body: (_s, _r, p) =>
      `Nació el hijo de ${who(p)}. El vestuario manda un video; él no pega un ojo, pero está feliz.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 8 }, { kind: "fitness", target: p, delta: -6 }] : undefined),
  }),
  story({
    id: "neu-playlist-war",
    category: "neutral",
    topic: "club",
    timing: "pre",
    weight: 5,
    title: "Guerra de playlists",
    body: "El capitán pone cumbia, un extremo pone trap y el utilero corta la música. El ambiente, extrañamente, mejora.",
    effects: () => [{ kind: "morale", target: "squad", delta: 2 }],
  }),
  story({
    id: "neu-cat-stadium",
    category: "neutral",
    topic: "club",
    timing: "pre",
    weight: 3,
    title: "Un gato en el estadio",
    body: "Un gato cruza el césped en la previa y se vuelve protagonista de las redes. El partido, por ahora, espera.",
  }),
  story({
    id: "neu-hotel-room",
    category: "neutral",
    topic: "player",
    timing: "pre",
    weight: 4,
    eligible: isBigMatch,
    players: (p) => isFit(p),
    title: (_s, _r, p) => `${who(p)} pide cambiar de habitación`,
    body: (_s, _r, p) =>
      `${who(p)} no quiere el piso 13. El hotel lo cambia y el tema queda en una anécdota.`,
  }),
  {
    id: "lock-friends",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 5,
    run: (save, rng) => {
      const a = pickFit(userSquad(save), rng);
      if (!a) return null;
      const b = otherFit(save, rng, a.id);
      if (!b) return null;
      const title = `${a.name} y ${b.name} se hacen amigos`;
      const body = `Empiezan a almorzar juntos y se nota en los entrenamientos: se buscan más en la cancha.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [
          { kind: "squadBond", target: a, delta: 12 },
          { kind: "squadBond", target: b, delta: 12 },
          { kind: "morale", target: a, delta: 4 },
          { kind: "morale", target: b, delta: 4 },
        ],
      };
    },
  },
  {
    id: "lock-argument",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 4,
    run: (save, rng) => {
      const a = pickFit(userSquad(save), rng);
      if (!a) return null;
      const b = otherFit(save, rng, a.id);
      if (!b) return null;
      const title = `${a.name} y ${b.name} discuten`;
      const body = `Una falta en el entrenamiento termina en empujones. El grupo se corta en dos por un rato.`;
      return {
        news: news(save, "bad", title, body),
        popup: popup("event", "bad", title, body),
        effects: [
          { kind: "squadBond", target: a, delta: -10 },
          { kind: "squadBond", target: b, delta: -10 },
          { kind: "morale", target: a, delta: -4 },
          { kind: "morale", target: b, delta: -4 },
          { kind: "teamBoost", rating: -0.3, games: 1, label: "roce en el vestuario" },
        ],
      };
    },
  },
  story({
    id: "lock-mentor",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => isVeteran(p) && isFit(p),
    title: (_s, _r, p) => `${who(p)} toma de ahijado a un juvenil`,
    body: (save, _rng, p) => {
      const kid = userSquad(save).find((x) => isYouth(x) && x.id !== p?.id);
      return kid
        ? `${who(p)} se pone al lado de ${kid.name} en cada práctica. El pibe se hincha el pecho.`
        : `${who(p)} se ofrece como tutor de los más chicos.`;
    },
    effects: (save, _rng, p) => {
      if (!p) return undefined;
      const kid = userSquad(save).find((x) => isYouth(x) && x.id !== p.id && isFit(x));
      const fx: EventEffect[] = [{ kind: "squadBond", target: p, delta: 6 }, { kind: "clubBond", target: p, delta: 4 }];
      if (kid) fx.push({ kind: "squadBond", target: kid, delta: 10 }, { kind: "morale", target: kid, delta: 8 });
      return fx;
    },
  }),
  story({
    id: "lock-ignored",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p, save) => isFit(p) && !save.tactics.lineup.includes(p.id) && p.ovr >= 70,
    title: (_s, _r, p) => `${who(p)} se siente ignorado`,
    body: (_s, _r, p) =>
      `${who(p)} siente que el entrenador no lo mira. No hay pelea: hay silencio, que a veces es peor.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: -8 }, { kind: "clubBond", target: p, delta: -6 }] : undefined,
  }),
  story({
    id: "lock-healthy-rivalry",
    category: "neutral",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => isFit(p) && p.ovr >= 72,
    title: (_s, _r, p) => `${who(p)} se pica por un puesto`,
    body: (save, rng, p) => {
      const rival = p ? otherFit(save, rng, p.id) : null;
      return rival
        ? `${who(p)} y ${rival.name} se pican en cada pelota. Es competencia sana... por ahora.`
        : `${who(p)} se pica por un puesto y sube el ritmo.`;
    },
    effects: (save, rng, p) => {
      if (!p) return undefined;
      const rival = otherFit(save, rng, p.id);
      const fx: EventEffect[] = [{ kind: "form", target: p, delta: 1 }, { kind: "fitness", target: p, delta: -3 }];
      if (rival) fx.push({ kind: "form", target: rival, delta: 1 });
      return fx;
    },
  }),
  story({
    id: "lock-group-asado",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 4,
    title: "El plantel se junta a comer",
    body: "Alguien organiza un asado (o una paella, según el país). Al día siguiente el entrenamiento sale más suelto.",
    effects: () => [
      { kind: "morale", target: "squad", delta: 5 },
      { kind: "teamBoost", rating: 0.3, games: 1, label: "juntada del plantel" },
    ],
  }),
  story({
    id: "lock-unexpected-leader",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 2,
    cooldown: 24,
    players: (p, save) => isFit(p) && p.age <= 24 && p.ovr >= 70 && !isCaptain(p, save),
    title: (_s, _r, p) => `${who(p)} se gana al vestuario`,
    body: (_s, _r, p) =>
      `Nadie lo vio venir: ${who(p)} empieza a hablar y el grupo lo sigue. Un líder nuevo, sin brazalete.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "squadBond", target: p, delta: 12 },
            { kind: "morale", target: "squad", delta: 3 },
            { kind: "clubBond", target: p, delta: 6 },
          ]
        : undefined,
  }),
  story({
    id: "lock-dropped-confidence",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p, save) => isFit(p) && !save.tactics.lineup.includes(p.id) && p.apps >= 5,
    title: (_s, _r, p) => `${who(p)} se cae después de quedar afuera`,
    body: (_s, _r, p) =>
      `Quedar fuera de la convocatoria le pega a ${who(p)}. En el entrenamiento se lo ve apagado.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: -10 }, { kind: "form", target: p, delta: -2 }] : undefined,
  }),
  story({
    id: "lock-coach-support",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => isFit(p) && (p.form <= 0 || p.morale <= 60),
    title: (_s, _r, p) => `El entrenador banca a ${who(p)}`,
    body: (_s, _r, p) =>
      `Una charla de cinco minutos en el pasillo. ${who(p)} sale distinto.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: 10 },
            { kind: "clubBond", target: p, delta: 6 },
            { kind: "form", target: p, delta: 1 },
          ]
        : undefined,
  }),
  story({
    id: "mkt-enquiry",
    category: "neutral",
    topic: "player",
    timing: "between",
    weight: 5,
    players: (p) => p.ovr >= 72 && !p.listed,
    title: (_s, _r, p) => `Un club pregunta por ${who(p)}`,
    body: (save, rng, p) => {
      const c = pickOtherClub(save, rng, 70);
      return `${c.name} llama para sondear a ${who(p)}. Todavía no hay oferta formal: solo ruido.`;
    },
    effects: (_s, _r, p) => (p ? [{ kind: "value", target: p, pct: 3, games: 3 }] : undefined),
  }),
  story({
    id: "mkt-big-interest",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 18,
    players: (p) => isStar(p),
    title: (_s, _r, p) => `Un grande mira a ${who(p)}`,
    body: (save, rng, p) => {
      const c = pickOtherClub(save, rng, 86);
      return `${c.name} pone a ${who(p)} en su lista. El entorno ya se entera.`;
    },
    effects: (save, rng, p) => {
      if (!p) return undefined;
      const c = pickOtherClub(save, rng, 86);
      return [
        { kind: "value", target: p, pct: 8, games: 6 },
        { kind: "incomingOffer", target: p, fromClubId: c.id, fee: Math.round(p.value * 1.15) },
      ];
    },
  }),
  story({
    id: "mkt-peak-value",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 3,
    players: (p) => p.form >= 2 && p.ovr >= 74,
    title: (_s, _r, p) => `${who(p)} se pone caro`,
    body: (_s, _r, p) =>
      `Después de una racha notable, el mercado revalúa a ${who(p)}. Llegan consultas a otro precio.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "value", target: p, pct: 12, games: 6 }, { kind: "morale", target: p, delta: 5 }] : undefined,
  }),
  story({
    id: "mkt-value-drop",
    category: "negative",
    topic: "player",
    timing: "between",
    weight: 3,
    players: (p) => p.form <= -2 || p.injured > 0,
    title: (_s, _r, p) => `${who(p)} pierde valor`,
    body: (_s, _r, p) =>
      `La mala racha se nota en el precio. Los clubes que preguntaban por ${who(p)} ahora esperan.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "value", target: p, pct: -10, games: 6 }, { kind: "morale", target: p, delta: -4 }] : undefined,
  }),
  story({
    id: "mkt-youth-scouts",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    players: (p) => isKid(p) && p.apps <= 3,
    title: (_s, _r, p) => `Ojean a ${who(p)} antes de que explote`,
    body: (save, rng, p) => {
      const c = pickOtherClub(save, rng, 78);
      return `${c.short} manda ojeadores a ver a ${who(p)} aunque todavía casi no debutó.`;
    },
    effects: (_s, _r, p) => (p ? [{ kind: "value", target: p, pct: 6, games: 5 }] : undefined),
  }),
  story({
    id: "mkt-loan-interest",
    category: "neutral",
    topic: "player",
    timing: "between",
    weight: 3,
    players: (p) => Boolean(p.loanFrom) || p.listedForLoan,
    title: (_s, _r, p) => `Interés por ${who(p)} en la cesión`,
    body: (_s, _r, p) =>
      `El club donde está ${who(p)} (o donde podría ir) pregunta en serio. El mercado de préstamos se mueve.`,
    effects: (_s, _r, p) => (p ? [{ kind: "value", target: p, pct: 4, games: 4 }] : undefined),
  }),
  story({
    id: "mkt-rejects-lure",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 3,
    players: (p, save) => isImportant(p, save),
    title: (_s, _r, p) => `${who(p)} rechaza a otro club`,
    body: (save, rng, p) => {
      const c = pickOtherClub(save, rng, 80);
      return `${c.name} tienta a ${who(p)} y él corta la conversación. El entorno del club respira.`;
    },
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "clubBond", target: p, delta: 10 },
            { kind: "morale", target: p, delta: 4 },
            { kind: "board", delta: 0.8, reason: "Un jugador rechazó irse" },
          ]
        : undefined,
  }),
  story({
    id: "mkt-agent-push",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 4,
    players: (p) => p.ovr >= 74 && p.contract <= 2,
    title: (_s, _r, p) => `El agente de ${who(p)} pide sentarse`,
    body: (_s, _r, p) =>
      `El representante de ${who(p)} quiere adelantar la renovación. No hay amenaza: hay apuro.`,
  }),
  {
    id: "acd-unexpected-talent",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 3,
    cooldown: 20,
    eligible: (s) => academyHasRoom(s) && squadHasRoom(s),
    run: (save, rng) => {
      const y = makeAcademyKid(save, rng, { ovr: rng.int(58, 68), pot: rng.int(80, 90) });
      const title = `Aparece un talento inesperado`;
      const body = `${y.name} (${POS_LABEL[y.pos]}, ${y.nat}) entra a la cantera. GRL ${y.ovr} / POT ${y.pot}.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [{ kind: "addYouth", youth: y }],
      };
    },
  },
  story({
    id: "acd-youth-leap",
    category: "positive",
    topic: "club",
    timing: "any",
    weight: 4,
    youths: (y) => y.age <= 18,
    title: (_s, _r, _p, y) => `${y?.name ?? "Un juvenil"} da un salto`,
    body: (_s, _r, _p, y) =>
      `${y?.name ?? "Un juvenil"} se come los entrenamientos de la cantera. Los ojeadores internos se miran.`,
    effects: (_s, rng, _p, y) =>
      y ? [{ kind: "youthDev", youthId: y.id, ovrDelta: 1, potDelta: rng.int(1, 3) }] : undefined,
  }),
  story({
    id: "acd-youth-slump",
    category: "negative",
    topic: "club",
    timing: "any",
    weight: 4,
    youths: () => true,
    title: (_s, _r, _p, y) => `${y?.name ?? "Un juvenil"} pierde confianza`,
    body: (_s, _r, _p, y) =>
      `${y?.name ?? "Un juvenil"} viene opaco. En la reserva no aparece y el cuerpo técnico juvenil pide paciencia.`,
    effects: (_s, _r, _p, y) => (y ? [{ kind: "youthDev", youthId: y.id, potDelta: -1 }] : undefined),
  }),
  story({
    id: "acd-youth-game",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 4,
    youths: () => true,
    title: (_s, _r, _p, y) => `${y?.name ?? "Un juvenil"} se luce en la reserva`,
    body: (_s, _r, _p, y) =>
      `Hat-trick, asistencia o un partidazo: ${y?.name ?? "el pibe"} deja el nombre en el parte del domingo.`,
    effects: (_s, _r, _p, y) => (y ? [{ kind: "youthDev", youthId: y.id, ovrDelta: 1 }] : undefined),
  }),
  story({
    id: "acd-scout-tip",
    category: "neutral",
    topic: "club",
    timing: "any",
    weight: 3,
    youths: () => true,
    title: (_s, _r, _p, y) => `Un ojeador recomienda a ${y?.name ?? "un juvenil"}`,
    body: (_s, _r, _p, y) =>
      `Un contacto de confianza insiste: ${y?.name ?? "ese pibe"} tiene una característica rara. Vale la pena no perderlo de vista.`,
  }),
  {
    id: "acd-legend-son",
    category: "positive",
    topic: "club",
    timing: "any",
    weight: 1,
    cooldown: 40,
    eligible: (s) => academyHasRoom(s) && squadHasRoom(s),
    run: (save, rng) => {
      const living = userSquad(save).find(isLegend);
      const last = living ? lastNameOf(living.name) : lastNameOf(makeName(rng, clubNat(save), usedNames(save)));
      const y = makeAcademyKid(save, rng, {
        lastName: last,
        fee: 0,
        age: rng.int(16, 18),
        ovr: rng.int(56, 66),
        pot: rng.int(78, 90),
        nat: living?.nat ?? clubNat(save),
      });
      const whoLegend = living ? living.name : `una gloria de ${clubById(save.clubId).short}`;
      const title = `El hijo de ${whoLegend} llega a la cantera`;
      const body = `${y.name} entra con ficha de €0. El apellido pesa, el pibe todavía no.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [{ kind: "addYouth", youth: y }, { kind: "prestige", delta: 1 }],
      };
    },
  },
  {
    id: "acd-exceptional-kid",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 1,
    cooldown: 55,
    eligible: (s) => academyHasRoom(s) && squadHasRoom(s),
    run: (save, rng) => {
      const y = makeAcademyKid(save, rng, {
        ovr: rng.int(64, 72),
        pot: rng.int(92, 97),
        age: rng.int(16, 17),
        fee: 0,
      });
      const title = `Un juvenil excepcional aparece en la cantera`;
      const body = `${y.name} (${POS_LABEL[y.pos]}) tiene un techo raro: POT ${y.pot}. La ficha de incorporación es €0: el club no se lo puede dejar escapar.`;
      return {
        news: news(save, "good", title, body),
        popup: popup("event", "good", title, body),
        effects: [{ kind: "addYouth", youth: y }, { kind: "prestige", delta: 1 }],
      };
    },
  },
  story({
    id: "leg-visits-club",
    category: "neutral",
    topic: "club",
    timing: "any",
    weight: 4,
    title: "Una leyenda visita las instalaciones",
    body: (save) =>
      `Una gloria de ${clubById(save.clubId).short} recorre el predio, se saca fotos y se queda a merendar con los utileros.`,
  }),
  story({
    id: "leg-donates-object",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 3,
    cooldown: 22,
    title: "Donan un objeto histórico",
    body: "Una leyenda deja una camiseta, unas botines o una medalla en el museo. Los chicos de la cantera hacen fila para verlo.",
    effects: () => [{ kind: "prestige", delta: 1 }],
  }),
  story({
    id: "leg-talks-squad",
    category: "positive",
    topic: "club",
    timing: "pre",
    weight: 3,
    title: "Una leyenda habla con el plantel",
    body: "Diez minutos en el vestuario. Habla de presión, de derbis y de no esconderse. Nadie mira el celular.",
    effects: () => [
      { kind: "morale", target: "squad", delta: 4 },
      { kind: "teamBoost", rating: 0.4, games: 1, label: "charla de una leyenda" },
    ],
  }),
  story({
    id: "leg-praises-player",
    category: "positive",
    topic: "player",
    timing: "any",
    weight: 3,
    players: (p, save) => isImportant(p, save),
    title: (_s, _r, p) => `Una leyenda destaca a ${who(p)}`,
    body: (_s, _r, p) =>
      `En una entrevista, una gloria del club dice que ${who(p)} "entiende el escudo". El jugador lo lee diez veces.`,
    effects: (_s, _r, p) =>
      p ? [{ kind: "morale", target: p, delta: 8 }, { kind: "clubBond", target: p, delta: 6 }] : undefined,
  }),
  story({
    id: "leg-title-night",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 2,
    cooldown: 30,
    eligible: (s) => s.trophies.length + s.careerTrophies.length > 0,
    title: "Las leyendas vuelven por un título",
    body: (save) =>
      `Para celebrar un título histórico, vuelven caras conocidas a ${clubById(save.clubId).stadium}. La noche es larga.`,
    effects: () => [
      { kind: "prestige", delta: 1 },
      { kind: "morale", target: "squad", delta: 4 },
    ],
  }),
  story({
    id: "leg-statue-talk",
    category: "neutral",
    topic: "club",
    timing: "between",
    weight: 2,
    cooldown: 36,
    title: "Hablan de una estatua",
    body: "Un grupo de hinchas junta firmas para una estatua de una leyenda. Todavía no hay bronce: hay ilusión.",
    effects: () => [{ kind: "prestige", delta: 1 }],
  }),
  story({
    id: "awd-ballon-nom",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 1,
    cooldown: 40,
    eligible: lateSeason,
    players: (p) => p.ovr >= 86 && p.apps >= 12,
    title: (_s, _r, p) => `${who(p)} suena para el Balón de Oro`,
    body: (_s, _r, p) =>
      `Las casas de apuestas meten a ${who(p)} en las conversaciones del Balón de Oro. Todavía es una nominación oficiosa.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "morale", target: p, delta: 10 },
            { kind: "value", target: p, pct: 10, games: 8 },
            { kind: "prestige", delta: 1 },
          ]
        : undefined,
  }),
  story({
    id: "awd-golden-boot-nom",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 28,
    eligible: lateSeason,
    players: (p) => (p.pos === "ST" || p.pos === "LW" || p.pos === "RW") && p.goals >= 8,
    title: (_s, _r, p) => `${who(p)} pica en la Bota de Oro`,
    body: (_s, _r, p) => `${who(p)} aparece en la tabla europea de goleadores. Cada gol ahora pesa doble.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 7 }, { kind: "form", target: p, delta: 1 }] : undefined),
  }),
  story({
    id: "awd-puskas-nom",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 28,
    players: (p) => p.pos !== "GK" && p.goals >= 1,
    title: (_s, _r, p) => `${who(p)} suena para el Puskás`,
    body: (_s, _r, p) =>
      `Un gol de ${who(p)} entra en los debates del Puskás. Lo van a ver hasta los que no miran la liga.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 6 }, { kind: "value", target: p, pct: 5, games: 4 }] : undefined),
  }),
  story({
    id: "awd-glove-nom",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 28,
    eligible: lateSeason,
    players: (p) => p.pos === "GK" && p.apps >= 10,
    title: (_s, _r, p) => `${who(p)} suena para el Guante de Oro`,
    body: (_s, _r, p) => `Los números de ${who(p)} lo meten en la conversación del mejor arquero de la temporada.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 7 }, { kind: "form", target: p, delta: 1 }] : undefined),
  }),
  story({
    id: "awd-kopa-nom",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 28,
    eligible: lateSeason,
    players: (p) => isYouth(p) && p.ovr >= 72 && p.apps >= 6,
    title: (_s, _r, p) => `${who(p)} suena para el Kopa`,
    body: (_s, _r, p) => `${who(p)} entra en las quinielas del mejor juvenil de Europa.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 8 }, { kind: "value", target: p, pct: 8, games: 6 }] : undefined),
  }),
  story({
    id: "awd-team-of-season",
    category: "positive",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 30,
    eligible: lateSeason,
    players: (p) => p.apps >= 14 && p.form >= 1,
    title: (_s, _r, p) => `${who(p)} pica para el equipo de la temporada`,
    body: (_s, _r, p) => `Los once ideales de fin de año empiezan a incluir a ${who(p)}.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 6 }, { kind: "prestige", delta: 1 }] : undefined),
  }),
  story({
    id: "awd-club-prize",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 2,
    cooldown: 30,
    title: "Premio institucional",
    body: (save) =>
      `${clubById(save.clubId).name} recibe un premio de la liga por organización y afición. Hay placa y un cheque.`,
    effects: (save) => [
      { kind: "money", amount: scaledMoney(save, 0.2, 100_000) },
      { kind: "prestige", delta: 1 },
    ],
  }),
  story({
    id: "mt-pre-recognition",
    category: "positive",
    topic: "match",
    timing: "pre",
    weight: 4,
    players: (p, save) => isStarter(p, save) && p.careerApps >= 30,
    title: (_s, _r, p) => `Reconocimiento previo para ${who(p)}`,
    body: (save, _r, p) =>
      `Antes de ${competitionLabel(save)} ante ${opponentName(save)}, el estadio aplaude a ${who(p)}.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 6 }] : undefined),
  }),
  story({
    id: "mt-return",
    category: "positive",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p) => p.injured === 0 && p.fitness >= 70 && p.form <= 0,
    title: (_s, _r, p) => `${who(p)} se siente de nuevo`,
    body: (_s, _r, p) => `${who(p)} marca en el reconocimiento que el cuerpo está. Pide minutos.`,
    effects: (_s, _r, p) => (p ? [{ kind: "form", target: p, delta: 2 }, { kind: "morale", target: p, delta: 5 }] : undefined),
  }),
  story({
    id: "mt-last-minute-issue",
    category: "negative",
    topic: "match",
    timing: "pre",
    weight: 4,
    players: (p, save) => isStarter(p, save),
    title: (_s, _r, p) => `${who(p)} tiene un problema de último momento`,
    body: (_s, _r, p) =>
      `Un golpe en el calentamiento, un malestar, un imprevisto. ${who(p)} llega justo... o no tanto.`,
    effects: (_s, rng, p) =>
      p
        ? rng.chance(0.45)
          ? [{ kind: "fitness", target: p, delta: -10 }, { kind: "form", target: p, delta: -1 }]
          : [{ kind: "absence", target: p, games: 1, reason: "Molestia de último momento", absenceKind: "other" }]
        : undefined,
  }),
  story({
    id: "mt-morale-up",
    category: "positive",
    topic: "match",
    timing: "pre",
    weight: 5,
    title: (save) => `El grupo se prende para ${opponentName(save)}`,
    body: (save) => `La previa de ${competitionLabel(save)} encuentra al plantel suelto y con ganas.`,
    effects: () => [{ kind: "morale", target: "squad", delta: 4 }, { kind: "teamBoost", rating: 0.3, games: 1, label: "previa caliente" }],
  }),
  story({
    id: "mt-morale-down",
    category: "negative",
    topic: "match",
    timing: "pre",
    weight: 4,
    title: "La previa se pone densa",
    body: (save) =>
      `El partido ante ${opponentName(save)} llega con ruido, dudas y una conferencia de prensa larga.`,
    effects: () => [{ kind: "morale", target: "squad", delta: -3 }, { kind: "teamBoost", rating: -0.3, games: 1, label: "previa densa" }],
  }),
  story({
    id: "mt-record-if-plays",
    category: "neutral",
    topic: "match",
    timing: "pre",
    weight: 3,
    players: (p, save) => isStarter(p, save) && p.careerApps >= 80,
    title: (_s, _r, p) => `${who(p)} puede hacer historia hoy`,
    body: (save, _r, p) =>
      `Si ${who(p)} juega ante ${opponentName(save)}, entra en una cifra histórica del club. La afición ya lo sabe.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 5 }] : undefined),
  }),
  story({
    id: "mt-heatwave",
    category: "negative",
    topic: "match",
    timing: "pre",
    weight: 3,
    title: "Ola de calor",
    body: "El césped quema y el cuerpo técnico recorta la activación. El partido va a ser un desgaste.",
    effects: () => [{ kind: "fitness", target: "squad", delta: -6 }, { kind: "teamBoost", rating: -0.2, games: 1, label: "calor extremo" }],
  }),
  story({
    id: "mt-snow",
    category: "neutral",
    topic: "match",
    timing: "pre",
    weight: 2,
    title: "Cancha pesada",
    body: "Lluvia, barro o nieve. El partido se va a jugar a otra velocidad. Los técnicos ya cambiaron el plan.",
  }),
  story({
    id: "eco-tax-rebate",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 3,
    title: "Devolución impositiva",
    body: (save) =>
      `Un reclamo viejo llega a buen puerto: ${formatMoney(scaledMoney(save, 0.3, 140_000))} vuelven a caja.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.3, 140_000) }],
  }),
  story({
    id: "eco-insurance",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 2,
    cooldown: 24,
    title: "Cobra un seguro",
    body: (save) =>
      `El club cobra un seguro por una lesión vieja: ${formatMoney(scaledMoney(save, 0.5, 200_000))}.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.5, 200_000) }],
  }),
  story({
    id: "eco-unexpected-cost",
    category: "negative",
    topic: "economy",
    timing: "between",
    weight: 4,
    title: "Gasto imprevisto",
    body: (save) =>
      `Se rompe una caldera, un micro o un techo. La factura es de ${formatMoney(scaledMoney(save, 0.22, 120_000))}.`,
    effects: (save) => [{ kind: "money", amount: -scaledMoney(save, 0.22, 120_000) }],
  }),
  story({
    id: "eco-fan-merch",
    category: "positive",
    topic: "economy",
    timing: "between",
    weight: 4,
    title: "La afición mueve la tienda",
    body: (save) =>
      `Una semana de hinchas viajeros deja ${formatMoney(scaledMoney(save, 0.18, 90_000))} extra en merchandising.`,
    effects: (save) => [{ kind: "money", amount: scaledMoney(save, 0.18, 90_000) }],
  }),
  story({
    id: "eco-drone-fine",
    category: "negative",
    topic: "economy",
    timing: "pre",
    weight: 2,
    cooldown: 26,
    title: "Un dron sobre el estadio",
    body: (save) =>
      `Un dron no autorizado sobrevuela la previa. Hay multa de ${formatMoney(scaledMoney(save, 0.08, 60_000))} y un rato de demora.`,
    effects: (save) => [
      { kind: "money", amount: -scaledMoney(save, 0.08, 60_000) },
      { kind: "teamBoost", rating: -0.2, games: 1, label: "demora por dron" },
    ],
  }),
  story({
    id: "xtra-wedding",
    category: "neutral",
    topic: "player",
    timing: "between",
    weight: 2,
    cooldown: 30,
    players: (p) => p.age >= 24 && p.age <= 34 && isFit(p),
    title: (_s, _r, p) => `${who(p)} se casa`,
    body: (_s, _r, p) =>
      `Casamiento a mitad de temporada. ${who(p)} pide un par de días; el vestuario manda un regalo colectivo.`,
    effects: (_s, _r, p) =>
      p
        ? [
            { kind: "absence", target: p, games: 1, reason: "Casamiento", absenceKind: "personal" },
            { kind: "morale", target: p, delta: 10 },
          ]
        : undefined,
  }),
  story({
    id: "xtra-national-call",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    players: (p) => p.ovr >= 76 && isFit(p),
    title: (_s, _r, p) => `${who(p)} entra en una prelista nacional`,
    body: (_s, _r, p) =>
      `La selección de ${p?.nat ?? "su país"} incluye a ${who(p)} en una prelista. Todavía no hay fecha FIFA, pero el orgullo está.`,
    effects: (_s, _r, p) => (p ? [{ kind: "morale", target: p, delta: 7 }, { kind: "value", target: p, pct: 4, games: 4 }] : undefined),
  }),
  story({
    id: "xtra-boots-prank",
    category: "neutral",
    topic: "player",
    timing: "pre",
    weight: 4,
    players: (p) => isYouth(p) && isFit(p),
    title: (_s, _r, p) => `Le esconden las botines a ${who(p)}`,
    body: (_s, _r, p) =>
      `Bienvenida al primer equipo: las botines de ${who(p)} aparecen en el techo del vestuario. Se ríe. Al final.`,
    effects: (_s, _r, p) => (p ? [{ kind: "squadBond", target: p, delta: 5 }, { kind: "morale", target: p, delta: 3 }] : undefined),
  }),
  story({
    id: "xtra-setpiece-clinic",
    category: "positive",
    topic: "club",
    timing: "pre",
    weight: 3,
    title: "Taller de pelota parada",
    body: "Un especialista pasa dos días con los encargados de tiros libres y córners. Poco ruido, algo de nitidez extra.",
    effects: () => [{ kind: "teamBoost", rating: 0.35, games: 2, label: "pelota parada" }],
  }),
  story({
    id: "xtra-sleep-study",
    category: "neutral",
    topic: "player",
    timing: "any",
    weight: 3,
    players: (p) => isFit(p) && p.age >= 28,
    title: (_s, _r, p) => `${who(p)} se hace un estudio de sueño`,
    body: (_s, _r, p) =>
      `El cuerpo médico manda a ${who(p)} a un estudio de descanso. Sale con una rutina nueva y cara de siesta.`,
    effects: (_s, _r, p) => (p ? [{ kind: "fitness", target: p, delta: 5 }] : undefined),
  }),
  story({
    id: "xtra-penalty-dispute",
    category: "negative",
    topic: "player",
    timing: "pre",
    weight: 3,
    players: (p) => (p.pos === "ST" || p.pos === "CAM") && isFit(p),
    title: "Discusión por los penales",
    body: (save, rng, p) => {
      const other = p ? otherFit(save, rng, p.id) : null;
      return other
        ? `${who(p)} y ${other.name} no se ponen de acuerdo sobre quién patea. El tema queda para el banquillo.`
        : `${who(p)} reclama los penales. El tema queda para el banquillo.`;
    },
    effects: (save, rng, p) => {
      if (!p) return undefined;
      const other = otherFit(save, rng, p.id);
      const fx: EventEffect[] = [{ kind: "squadBond", target: p, delta: -5 }];
      if (other) fx.push({ kind: "squadBond", target: other, delta: -5 });
      return fx;
    },
  }),
  story({
    id: "xtra-anthem",
    category: "neutral",
    topic: "club",
    timing: "between",
    weight: 3,
    title: "Reescriben el himno",
    body: "Un músico hincha propone una estrofa nueva. En las redes se pelean; en el estadio, algún día, se cantará.",
  }),
  story({
    id: "xtra-museum",
    category: "positive",
    topic: "club",
    timing: "between",
    weight: 2,
    cooldown: 28,
    title: "El museo suma una sala",
    body: (save) =>
      `${clubById(save.clubId).name} abre una sala nueva con camisetas de distintas décadas. Hay cola el fin de semana.`,
    effects: (save) => [
      { kind: "prestige", delta: 1 },
      { kind: "money", amount: scaledMoney(save, 0.12, 70_000) },
    ],
  }),
  story({
    id: "xtra-flooded-pitch",
    category: "negative",
    topic: "club",
    timing: "pre",
    weight: 2,
    cooldown: 24,
    title: "El predio se inunda",
    body: "El campo auxiliar queda bajo agua. El primer equipo entrena en un espacio más chico y se nota el humor.",
    effects: () => [
      { kind: "teamBoost", rating: -0.3, games: 1, label: "predio inundado" },
      { kind: "fitness", target: "squad", delta: -3 },
    ],
  }),
  story({
    id: "xtra-captain-band",
    category: "neutral",
    topic: "player",
    timing: "pre",
    weight: 2,
    cooldown: 22,
    players: isCaptain,
    title: (_s, _r, p) => `${who(p)} habla del brazalete`,
    body: (_s, _r, p) =>
      `El capitán ${who(p)} dice que el brazalete "no es un privilegio, es un trabajo". El grupo lo escucha en silencio.`,
    effects: (_s, _r, p) => (p ? [{ kind: "squadBond", target: p, delta: 5 }] : undefined),
  }),
];

export const LIBRARY_EVENTS: EventDef[] = [...INSTANTS, ...(LIBRARY_DECISIONS as DecisionEventDef[])];
