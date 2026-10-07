import { clubById } from "./clubs";
import { pickBranch, scaledMoney } from "./event-decisions";
import type { EventEffect } from "./event-effects";
import {
  academyHasRoom,
  captainOf,
  clubNat,
  isBigMatch,
  isCaptain,
  isFit,
  isImportant,
  isLegend,
  isStarter,
  isYouth,
  lastNameOf,
  opponentName,
  otherFit,
  pickOtherClub,
  squadHasRoom,
  usedNames,
  userSquad,
} from "./event-kit";
import type { DecisionEventDef } from "./events";
import { formatMoney } from "./format";
import { FIRST, makeName } from "./names";
import { makeYouth } from "./academy";
import type { Rng } from "./rng";
import type { GameSave, Player, Pos, YouthPlayer } from "./types";

const POS_POOL: Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];

function firstName(rng: Rng, nat: string) {
  return rng.pick(FIRST[nat] ?? FIRST.ITA!);
}

function legendSon(save: GameSave, rng: Rng, legend?: Player): YouthPlayer {
  const nat = legend?.nat ?? clubNat(save);
  const used = usedNames(save);
  const last = legend ? lastNameOf(legend.name) : lastNameOf(makeName(rng, nat, used));
  const name = `${firstName(rng, nat)} ${last}`;
  used.add(name);
  return makeYouth(rng, nat, used, save.clubId, save.academyLevel, {
    name,
    fee: 0,
    age: rng.int(16, 18),
    ovr: rng.int(56, 68),
    pot: rng.int(78, 91),
    pos: rng.pick(POS_POOL),
    nat,
  });
}

function gone(p?: Player, y?: YouthPlayer) {
  return { tone: "neutral" as const, title: "Sin novedades", body: `${p?.name ?? y?.name ?? "La situación"} ya no aplica.` };
}

/**
 * Decisiones de la biblioteca. Cada una tiene 2-4 posturas distintas, pistas visibles
 * y consecuencias reales (ninguna opción es claramente la correcta).
 */
export const LIBRARY_DECISIONS: DecisionEventDef[] = [
  {
    id: "decision-skip-match",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    players: (p, save) => isStarter(p, save),
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un titular"} pide no jugar`,
      body: `${player?.name ?? "Un titular"} llega con la cabeza en otro lado y pide quedar afuera. El partido está encima.`,
    }),
    options: [
      {
        id: "allow",
        stance: "allow-absence",
        label: "Dejarlo en el vestuario",
        hint: "Se pierde este partido y vuelve más entero. El once se desarma.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "good",
            title: `${p.name} descansa`,
            body: "El club lo escucha. Juega el que está; él vuelve la semana que viene.",
            effects: [
              { kind: "absence", target: p, games: 1, reason: "Pidió no jugar", absenceKind: "personal" },
              { kind: "morale", target: p, delta: 8 },
              { kind: "clubBond", target: p, delta: 8 },
            ],
          };
        },
      },
      {
        id: "play",
        stance: "performance",
        label: "Pedile que juegue igual",
        hint: "Mantenés al titular. Puede responder... o puede esconderse.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: `${p.name} cumple`,
                body: "Juega a reglamento. No es su mejor versión, pero está.",
                effects: [
                  { kind: "morale", target: p, delta: -6 },
                  { kind: "clubBond", target: p, delta: -5 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} se esconde`,
                body: "Se lo ve lejos. El grupo lo nota y el partido se hace cuesta arriba.",
                effects: [
                  { kind: "morale", target: p, delta: -12 },
                  { kind: "form", target: p, delta: -2 },
                  { kind: "teamBoost", rating: -0.4, games: 1, label: "titular obligado" },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "rotate",
        stance: "wellbeing",
        label: "Rotar y cuidar al grupo",
        hint: "Sale él y entra otro. El mensaje es mixto: se cuida, pero se mueve el once.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Rotación por ${p.name}`,
            body: "El cuerpo técnico cambia el once. Nadie se enoja del todo, nadie se emociona del todo.",
            effects: [
              { kind: "morale", target: p, delta: 3 },
              { kind: "fitness", target: p, delta: 6 },
              { kind: "teamBoost", rating: -0.2, games: 1, label: "once retocado" },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-risk-injured",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    eligible: isBigMatch,
    players: (p, save) => isStarter(p, save),
    prompt: (save, _r, player) => ({
      title: `${player?.name ?? "Un titular"} está justo`,
      body: `${player?.name ?? "Un titular"} llega al partido ante ${opponentName(save)} con molestias. Quiere jugar. El cuerpo médico duda.`,
    }),
    options: [
      {
        id: "risk",
        stance: "performance",
        label: "Arriesgarlo",
        hint: "Juega. Puede ser héroe o recaer.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 58,
              result: {
                tone: "good",
                title: `${p.name} bancó el partido`,
                body: "Salió entero. El riesgo, esta vez, pagó.",
                effects: [
                  { kind: "morale", target: p, delta: 6 },
                  { kind: "form", target: p, delta: 1 },
                  { kind: "fitness", target: p, delta: -8 },
                ],
              },
            },
            {
              chance: 42,
              result: {
                tone: "bad",
                title: `${p.name} recae`,
                body: "A los veinte minutos pide el cambio. La molestia se convierte en baja.",
                effects: [
                  { kind: "injury", target: p, games: rng.int(2, 4) },
                  { kind: "clubBond", target: p, delta: -4 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "rest",
        stance: "wellbeing",
        label: "Dejarlo en el banco",
        hint: "Se cuida el físico. Él puede enojarse por perderse el partido grande.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 60,
              result: {
                tone: "neutral",
                title: `${p.name} entiende`,
                body: "No le gusta, pero entiende. La semana que viene está.",
                effects: [
                  { kind: "fitness", target: p, delta: 8 },
                  { kind: "morale", target: p, delta: -3 },
                ],
              },
            },
            {
              chance: 40,
              result: {
                tone: "bad",
                title: `${p.name} se enoja`,
                body: "Siente que le sacaron el partido de las manos. El malestar queda.",
                effects: [
                  { kind: "morale", target: p, delta: -10 },
                  { kind: "clubBond", target: p, delta: -7 },
                  { kind: "fitness", target: p, delta: 6 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "minutes",
        stance: "internal",
        label: "Unos minutos nada más",
        hint: "Entra un rato. Menos riesgo que los 90, menos descanso que el banco.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Minutos contados para ${p.name}`,
            body: "Entra un rato, no fuerza y se va. El partido no lo tiene entero; la lesión, tampoco.",
            effects: [
              { kind: "fitness", target: p, delta: -4 },
              { kind: "morale", target: p, delta: 2 },
              { kind: "form", target: p, delta: rng.chance(0.5) ? 0 : -1 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-player-debt",
    category: "decision",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 18,
    players: (p) => isFit(p) && p.age <= 26,
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un jugador"} tiene un problema económico`,
      body: `El entorno de ${player?.name ?? "un jugador"} se metió en un lío de deudas. Él pide una mano al club, en privado.`,
    }),
    options: [
      {
        id: "help",
        stance: "pay",
        label: "Adelantarle dinero",
        hint: "Sale de caja. Él agradece y se concentra.",
        cost: (save) => scaledMoney(save, 0.15, 90_000),
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "good",
            title: `El club ayuda a ${p.name}`,
            body: "Se adelanta una parte del contrato. El jugador vuelve a dormir.",
            effects: [
              { kind: "morale", target: p, delta: 12 },
              { kind: "clubBond", target: p, delta: 12 },
              { kind: "form", target: p, delta: 1 },
            ],
          };
        },
      },
      {
        id: "advice",
        stance: "internal",
        label: "Ponerle un asesor, no plata",
        hint: "No sale plata grande. Puede alcanzar o puede quedar corto.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: `${p.name} ordena las cuentas`,
                body: "Con un asesor del club desarma el lío. No es un abrazo, pero funciona.",
                effects: [
                  { kind: "morale", target: p, delta: 4 },
                  { kind: "clubBond", target: p, delta: 5 },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} esperaba más`,
                body: "Siente que el club lo dejó solo con un PowerPoint. El tema sigue.",
                effects: [
                  { kind: "morale", target: p, delta: -6 },
                  { kind: "clubBond", target: p, delta: -6 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "no",
        stance: "reject-offer",
        label: "No intervenir",
        hint: "El club no se mete en las finanzas personales. Él puede resentirse.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "bad",
            title: `Sin ayuda para ${p.name}`,
            body: "La dirigencia marca distancia. El jugador se cierra.",
            effects: [
              { kind: "morale", target: p, delta: -10 },
              { kind: "clubBond", target: p, delta: -10 },
              { kind: "form", target: p, delta: -1 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-dressing-row",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    players: (p) => isFit(p) && p.ovr >= 68,
    prompt: (save, rng, player) => {
      const other = player ? otherFit(save, rng, player.id) : null;
      return {
        title: "Choque en el vestuario",
        body: other
          ? `${player?.name ?? "Un jugador"} y ${other.name} se agarraron en un entrenamiento. Hay que decidir cómo se cierra.`
          : `${player?.name ?? "Un jugador"} se agarró con un compañero. Hay que decidir cómo se cierra.`,
      };
    },
    options: [
      {
        id: "mediate",
        stance: "internal",
        label: "Mediar en privado",
        hint: "Una mesa, tres sillas. Puede alcanzar o puede quedar en nada.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const other = otherFit(save, rng, p.id);
          return pickBranch(rng, [
            {
              chance: 62,
              result: {
                tone: "good",
                title: "Se dan la mano",
                body: "La charla funciona. El grupo ve que el club no deja que las cosas se pudran.",
                effects: [
                  { kind: "squadBond", target: p, delta: 8 },
                  ...(other ? [{ kind: "squadBond" as const, target: other, delta: 8 }] : []),
                  { kind: "morale", target: p, delta: 3 },
                ],
              },
            },
            {
              chance: 38,
              result: {
                tone: "neutral",
                title: "Queda tensa la cosa",
                body: "Se calman para la foto. En el entrenamiento se evitan.",
                effects: [
                  { kind: "squadBond", target: p, delta: -2 },
                  ...(other ? [{ kind: "squadBond" as const, target: other, delta: -2 }] : []),
                ],
              },
            },
          ]);
        },
      },
      {
        id: "punish",
        stance: "punish",
        label: "Sancionar a los dos",
        hint: "Multa interna y un partido de castigo al protagonista. El grupo ve mano firme.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const other = otherFit(save, rng, p.id);
          return {
            tone: "neutral",
            title: "Sanción interna",
            body: "El club corta por lo sano. Duele, pero el mensaje es claro.",
            effects: [
              { kind: "absence", target: p, games: 1, reason: "Sanción interna", absenceKind: "discipline" },
              { kind: "morale", target: p, delta: -8 },
              { kind: "clubBond", target: p, delta: -6 },
              { kind: "squadBond", target: p, delta: 4 },
              ...(other ? [{ kind: "morale" as const, target: other, delta: -4 }] : []),
              { kind: "board", delta: 1, reason: "Mano firme en el vestuario" },
            ],
          };
        },
      },
      {
        id: "ignore",
        stance: "reject-offer",
        label: "Dejar que se resuelva solo",
        hint: "A veces el vestuario se acomoda. A veces se pudre.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const other = otherFit(save, rng, p.id);
          return pickBranch(rng, [
            {
              chance: 50,
              result: {
                tone: "neutral",
                title: "Se enfría solo",
                body: "Al día siguiente nadie habla del tema. Quedó en un roce.",
                effects: [{ kind: "squadBond", target: p, delta: 2 }],
              },
            },
            {
              chance: 50,
              result: {
                tone: "bad",
                title: "El roce se agranda",
                body: "El grupo se parte. El próximo partido se juega con esa piedra en el zapato.",
                effects: [
                  { kind: "squadBond", target: p, delta: -10 },
                  ...(other ? [{ kind: "squadBond" as const, target: other, delta: -8 }] : []),
                  { kind: "teamBoost", rating: -0.5, games: 2, label: "vestuario partido" },
                  { kind: "board", delta: -1, reason: "Se dejó pudrir un conflicto" },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-wants-out",
    category: "decision",
    topic: "player",
    timing: "between",
    weight: 3,
    cooldown: 18,
    players: (p) => isFit(p) && p.ovr >= 70 && !p.listed,
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un jugador"} quiere irse`,
      body: `${player?.name ?? "Un jugador"} pide una salida. Dice que el proyecto no lo convence. Hay que responder.`,
    }),
    options: [
      {
        id: "convince",
        stance: "support",
        label: "Convencerlo de quedarse",
        hint: "Una charla de proyecto. Puede funcionar o puede quedar como un no disfrazado.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "good",
                title: `${p.name} se queda`,
                body: "La charla funciona. Pide tiempo y baja la lista de salida.",
                effects: [
                  { kind: "clubBond", target: p, delta: 10 },
                  { kind: "morale", target: p, delta: 6 },
                  { kind: "listed", target: p, listed: false },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} no se convence`,
                body: "Escucha, asiente y al día siguiente su agente filtra que se quiere ir igual.",
                effects: [
                  { kind: "listed", target: p, listed: true },
                  { kind: "morale", target: p, delta: -6 },
                  { kind: "clubBond", target: p, delta: -8 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "sell",
        stance: "accept-offer",
        label: "Aceptar la salida",
        hint: "Queda en venta. El mercado se mueve; el vestuario pierde a alguien que ya no está.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `${p.name} queda en venta`,
            body: "El club no lo retiene a la fuerza. La ficha se pone en el mercado.",
            effects: [
              { kind: "listed", target: p, listed: true },
              { kind: "morale", target: p, delta: 4 },
              { kind: "clubBond", target: p, delta: -4 },
              { kind: "value", target: p, pct: -4, games: 4 },
            ],
          };
        },
      },
      {
        id: "raise",
        stance: "pay",
        label: "Mejorarle el contrato",
        hint: "Sale plata del salario. Puede comprar lealtad... o solo tiempo.",
        cost: (save) => scaledMoney(save, 0.2, 120_000),
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 65,
              result: {
                tone: "good",
                title: `${p.name} renueva la cabeza`,
                body: "El extra lo acomoda. Por ahora, se queda.",
                effects: [
                  { kind: "wage", target: p, delta: Math.max(2_000, Math.round(p.wage * 0.12)) },
                  { kind: "clubBond", target: p, delta: 8 },
                  { kind: "morale", target: p, delta: 8 },
                  { kind: "listed", target: p, listed: false },
                ],
              },
            },
            {
              chance: 35,
              result: {
                tone: "neutral",
                title: `${p.name} cobra más y sigue dudando`,
                body: "Acepta el extra, pero no cierra la puerta. El tema queda vivo.",
                effects: [
                  { kind: "wage", target: p, delta: Math.max(2_000, Math.round(p.wage * 0.12)) },
                  { kind: "morale", target: p, delta: 3 },
                  { kind: "clubBond", target: p, delta: 2 },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-big-offer",
    category: "decision",
    topic: "player",
    timing: "any",
    weight: 3,
    cooldown: 18,
    players: (p) => isFit(p) && p.ovr >= 70,
    prompt: (save, rng, player) => {
      const c = pickOtherClub(save, rng, 84);
      return {
        title: `Oferta por ${player?.name ?? "un jugador"}`,
        body: `${c.name} pone ${formatMoney(Math.round((player?.value ?? 5_000_000) * 1.25))} sobre la mesa por ${player?.name ?? "un jugador"}. Hay que responder.`,
      };
    },
    options: [
      {
        id: "accept",
        stance: "accept-offer",
        label: "Aceptar y ponerlo en venta",
        hint: "Queda en venta con precio alto. El jugador puede alegrarse o sentir que lo empujaron.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const c = pickOtherClub(save, rng, 84);
          return {
            tone: "neutral",
            title: `El club abre la puerta a ${c.short}`,
            body: `La oferta queda viva. ${p.name} entra en la vidriera.`,
            effects: [
              { kind: "listed", target: p, listed: true },
              { kind: "incomingOffer", target: p, fromClubId: c.id, fee: Math.round(p.value * 1.25) },
              { kind: "morale", target: p, delta: 2 },
              { kind: "board", delta: 1, reason: "Se escuchó una oferta seria" },
            ],
          };
        },
      },
      {
        id: "reject",
        stance: "reject-offer",
        label: "Rechazar en seco",
        hint: "El club dice que no se vende. El jugador puede sentirse clave... o prisionero.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "good",
                title: `${p.name} se siente importante`,
                body: "Escucha que no se vende y se hincha el pecho. El club lo quiere.",
                effects: [
                  { kind: "clubBond", target: p, delta: 8 },
                  { kind: "morale", target: p, delta: 6 },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} se siente atado`,
                body: "Quería que lo escucharan. El no en seco lo enfría.",
                effects: [
                  { kind: "clubBond", target: p, delta: -8 },
                  { kind: "morale", target: p, delta: -8 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "negotiate",
        stance: "performance",
        label: "Pedir más dinero",
        hint: "Se cotiza hacia arriba. Puede volverse una locura... o asustar al comprador.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const c = pickOtherClub(save, rng, 84);
          return pickBranch(rng, [
            {
              chance: 50,
              result: {
                tone: "good",
                title: `${c.short} mejora la oferta`,
                body: "Tragan saliva y suben. El valor de mercado se dispara.",
                effects: [
                  { kind: "value", target: p, pct: 14, games: 8 },
                  { kind: "incomingOffer", target: p, fromClubId: c.id, fee: Math.round(p.value * 1.45) },
                  { kind: "board", delta: 1, reason: "Se cotizó una venta" },
                ],
              },
            },
            {
              chance: 50,
              result: {
                tone: "neutral",
                title: `${c.short} se baja`,
                body: "El precio los asusta. La oferta se enfría, pero el nombre quedó más caro.",
                effects: [
                  { kind: "value", target: p, pct: 6, games: 4 },
                  { kind: "morale", target: p, delta: -3 },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-unhappy-minutes",
    category: "decision",
    topic: "player",
    timing: "between",
    weight: 4,
    cooldown: 14,
    players: (p, save) => isFit(p) && p.ovr >= 68 && !save.tactics.lineup.includes(p.id),
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un jugador"} está descontento`,
      body: `${player?.name ?? "Un jugador"} quiere más minutos. Dice que no vino a mirar. Hay que contestarle algo.`,
    }),
    options: [
      {
        id: "promise",
        stance: "support",
        label: "Prometerle minutos",
        hint: "Se calma ahora. Si no jugás, más adelante se va a acordar.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Promesa a ${p.name}`,
            body: "El cuerpo técnico le asegura un rol más grande. Él espera hechos.",
            effects: [
              { kind: "morale", target: p, delta: 8 },
              { kind: "clubBond", target: p, delta: 4 },
            ],
          };
        },
      },
      {
        id: "raise",
        stance: "pay",
        label: "Mejorarle el contrato y listo",
        hint: "Plata por silencio. Puede sentarse... o sentirse comprado.",
        cost: (save) => scaledMoney(save, 0.12, 80_000),
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: `${p.name} cobra y espera`,
                body: "El extra lo acomoda un tiempo. El tema de los minutos sigue vivo, más bajo.",
                effects: [
                  { kind: "wage", target: p, delta: Math.max(1_500, Math.round(p.wage * 0.08)) },
                  { kind: "morale", target: p, delta: 5 },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} no quería solo plata`,
                body: "Lo toma como un insulto elegante. Quiere jugar, no un sobre.",
                effects: [
                  { kind: "wage", target: p, delta: Math.max(1_500, Math.round(p.wage * 0.08)) },
                  { kind: "morale", target: p, delta: -6 },
                  { kind: "clubBond", target: p, delta: -6 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "hold",
        stance: "performance",
        label: "Decirle que se gane el puesto",
        hint: "Mensaje duro. Puede prenderlo o apagarlo.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 50,
              result: {
                tone: "good",
                title: `${p.name} se pica`,
                body: "Sale a entrenar como si le fueran la vida. El puesto se calienta.",
                effects: [
                  { kind: "form", target: p, delta: 2 },
                  { kind: "morale", target: p, delta: 2 },
                  { kind: "fitness", target: p, delta: -4 },
                ],
              },
            },
            {
              chance: 50,
              result: {
                tone: "bad",
                title: `${p.name} se cierra`,
                body: "Escucha un no y se apaga. El vestuario lo ve lejos.",
                effects: [
                  { kind: "morale", target: p, delta: -10 },
                  { kind: "clubBond", target: p, delta: -8 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-legend-help",
    category: "decision",
    topic: "club",
    timing: "any",
    weight: 2,
    cooldown: 28,
    prompt: (save) => ({
      title: "Una leyenda ofrece ayuda",
      body: `Una gloria de ${clubById(save.clubId).short} se ofrece a colaborar unas semanas: charlas, cantera, imagen. No es gratis del todo.`,
    }),
    options: [
      {
        id: "accept",
        stance: "support",
        label: "Aceptar la colaboración",
        hint: "Suma prestigio y ambiente. La dirigencia mira el costo de imagen (y uno chico de caja).",
        cost: (save) => scaledMoney(save, 0.08, 50_000),
        apply: () => ({
          tone: "good",
          title: "La leyenda se suma",
          body: "Pasa por el predio, habla con los pibes y posa para las cámaras. El club se ve más grande.",
          effects: [
            { kind: "prestige", delta: 2 },
            { kind: "morale", target: "squad", delta: 4 },
            { kind: "teamBoost", rating: 0.4, games: 2, label: "leyenda en el predio" },
          ],
        }),
      },
      {
        id: "reject",
        stance: "reject-offer",
        label: "Agradecer y seguir igual",
        hint: "Sin costo. La leyenda puede entenderlo... o no volver a llamar.",
        apply: () => ({
          tone: "neutral",
          title: "Se agradece y se sigue",
          body: "El club marca que el proceso es del cuerpo técnico. La gloria sonríe para la foto y se va.",
          effects: [
            { kind: "board", delta: 0.5, reason: "Se cuidó el proceso del cuerpo técnico" },
            { kind: "prestige", delta: -1 },
          ],
        }),
      },
      {
        id: "academy",
        stance: "internal",
        label: "Que se quede solo con la cantera",
        hint: "Menos luces, más trabajo con juveniles. El primer equipo casi no se entera.",
        apply: () => ({
          tone: "neutral",
          title: "La leyenda se queda en inferiores",
          body: "Pasa más tiempo con la cantera que con las cámaras. El primer equipo sigue su ritmo.",
          effects: [
            { kind: "prestige", delta: 1 },
            { kind: "board", delta: 0.5, reason: "Una leyenda trabaja en formativas" },
          ],
        }),
      },
    ],
  },
  {
    id: "decision-legend-son",
    category: "decision",
    topic: "club",
    timing: "any",
    weight: 2,
    cooldown: 36,
    eligible: (s) => academyHasRoom(s) && squadHasRoom(s),
    players: (p) => isLegend(p),
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Una leyenda"} trae a su hijo`,
      body: `${player?.name ?? "Una leyenda"} quiere que su hijo entre a la cantera. La ficha de incorporación sería de €0. El pibe todavía no es él.`,
    }),
    options: [
      {
        id: "in",
        stance: "support",
        label: "Incorporarlo a la cantera",
        hint: "Entra con ficha de €0. La leyenda agradece; la dirigencia puede ver favoritismo.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const y = legendSon(save, rng, p);
          return {
            tone: "good",
            title: `${y.name} entra a la cantera`,
            body: `Hijo de ${p.name}. Ficha de €0. El apellido abre la puerta; el resto lo tiene que demostrar.`,
            effects: [
              { kind: "addYouth", youth: y },
              { kind: "clubBond", target: p, delta: 10 },
              { kind: "morale", target: p, delta: 6 },
              { kind: "board", delta: -0.8, reason: "Favoritismo en cantera" },
              { kind: "prestige", delta: 1 },
            ],
          };
        },
      },
      {
        id: "trial",
        stance: "performance",
        label: "Probarlo unas semanas",
        hint: "Entra igual, pero sin red carpet. Puede ser bueno... o un chico más.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const y = legendSon(save, rng, p);
          return pickBranch(rng, [
            {
              chance: 60,
              result: {
                tone: "good",
                title: `${y.name} responde`,
                body: "En las pruebas se lo ve. El apellido pesa menos que el pie.",
                effects: [
                  { kind: "addYouth", youth: y },
                  { kind: "youthDev", youthId: y.id, potDelta: 2 },
                  { kind: "clubBond", target: p, delta: 6 },
                ],
              },
            },
            {
              chance: 40,
              result: {
                tone: "neutral",
                title: `${y.name} entra sin brillo`,
                body: "Se queda en cantera, con ficha de €0, pero no deslumbra. El padre igual agradece la chance.",
                effects: [
                  { kind: "addYouth", youth: y },
                  { kind: "youthDev", youthId: y.id, potDelta: -1 },
                  { kind: "clubBond", target: p, delta: 3 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "no",
        stance: "reject-offer",
        label: "No abrirle la puerta",
        hint: "Se cuida el criterio de la cantera. La leyenda no lo va a celebrar.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Sin lugar para el hijo de ${p.name}`,
            body: "El club no mezcla apellidos con puestos. La leyenda se enfría un grado.",
            effects: [
              { kind: "clubBond", target: p, delta: -10 },
              { kind: "morale", target: p, delta: -6 },
              { kind: "board", delta: 1, reason: "No se cedió a un favoritismo" },
              { kind: "teamBoost", rating: 0.2, games: 1, label: "criterio de cantera" },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-youth-bid",
    category: "decision",
    topic: "club",
    timing: "between",
    weight: 3,
    cooldown: 18,
    youths: () => true,
    prompt: (save, rng, _p, youth) => {
      const c = pickOtherClub(save, rng, 78);
      const y = youth ?? save.academy[0];
      return {
        title: `Oferta por ${y?.name ?? "un juvenil"}`,
        body: `${c.name} pone ${formatMoney(y ? Math.max(800_000, Math.round(y.fee * 0.7)) : 800_000)} por ${y?.name ?? "un juvenil"} de la cantera.`,
      };
    },
    options: [
      {
        id: "sell",
        stance: "accept-offer",
        label: "Vender los derechos",
        hint: "Entra plata ya. Se pierde al pibe.",
        apply: (save, rng, _p, youth) => {
          const y = youth ?? save.academy[0];
          if (!y) return gone(undefined, youth);
          const fee = Math.max(800_000, Math.round(y.fee * 0.7) || scaledMoney(save, 0.4, 800_000));
          return {
            tone: "neutral",
            title: `${y.name} se va de la cantera`,
            body: `El club cobra ${formatMoney(fee)} y pierde un nombre de inferiores.`,
            effects: [
              { kind: "money", amount: fee },
              { kind: "removeYouth", youthId: y.id },
              { kind: "board", delta: 0.8, reason: "Venta de un juvenil" },
            ],
          };
        },
      },
      {
        id: "keep",
        stance: "reject-offer",
        label: "Rechazar y retenerlo",
        hint: "Sin ingreso. El pibe se siente querido; la dirigencia, menos.",
        apply: (save, _r, _p, youth) => {
          const y = youth ?? save.academy[0];
          if (!y) return gone(undefined, youth);
          return {
            tone: "good",
            title: `${y.name} se queda`,
            body: "El club dice que no se vende. El pibe se crece.",
            effects: [
              { kind: "youthDev", youthId: y.id, potDelta: 1 },
              { kind: "board", delta: -0.5, reason: "Se rechazó un ingreso por un juvenil" },
            ],
          };
        },
      },
      {
        id: "raise",
        stance: "pay",
        label: "Bajarle la ficha a €0 para atarlo",
        hint: "No cobrás ahora. Dejás la promoción futura sin costo, como un gesto.",
        apply: (save, _r, _p, youth) => {
          const y = youth ?? save.academy[0];
          if (!y) return gone(undefined, youth);
          return {
            tone: "good",
            title: `${y.name} queda a ficha €0`,
            body: "El club le dice que el camino al primer equipo no le va a costar un peso. El pibe se queda.",
            effects: [
              { kind: "youthDev", youthId: y.id, fee: 0, potDelta: 1 },
              { kind: "prestige", delta: 1 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-youth-promote",
    category: "decision",
    topic: "club",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    players: (p) => isYouth(p) && isFit(p) && p.ovr >= 64,
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un juvenil"} pide una chance`,
      body: `${player?.name ?? "Un juvenil"} pide minutos en el primer equipo. Dice que en la reserva ya no le alcanza.`,
    }),
    options: [
      {
        id: "chance",
        stance: "performance",
        label: "Darle una oportunidad",
        hint: "Le sube la moral. Si no rinde, el grupo lo mira de reojo.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 60,
              result: {
                tone: "good",
                title: `${p.name} se crece`,
                body: "La chance lo prende. Se entrena como titular aunque todavía no lo sea.",
                effects: [
                  { kind: "morale", target: p, delta: 10 },
                  { kind: "form", target: p, delta: 2 },
                  { kind: "clubBond", target: p, delta: 6 },
                ],
              },
            },
            {
              chance: 40,
              result: {
                tone: "neutral",
                title: `${p.name} se pone nervioso`,
                body: "La chance le pesa. Está, pero no suelto.",
                effects: [
                  { kind: "morale", target: p, delta: 3 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "wait",
        stance: "wellbeing",
        label: "Pedirle paciencia",
        hint: "Se cuida el proceso. Él puede entenderlo o sentirse trabado.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: `${p.name} espera`,
                body: "Escucha el no con cara de sí. Sigue trabajando.",
                effects: [
                  { kind: "clubBond", target: p, delta: 3 },
                  { kind: "morale", target: p, delta: -2 },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: `${p.name} se desmotiva`,
                body: "Siente que el techo está puesto. Baja un cambio.",
                effects: [
                  { kind: "morale", target: p, delta: -8 },
                  { kind: "clubBond", target: p, delta: -6 },
                  { kind: "form", target: p, delta: -1 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "loan",
        stance: "accept-offer",
        label: "Proponerle una cesión",
        hint: "Minutos en otro lado. El club lo pierde un tiempo; él puede crecer o resentirse.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Cesión sobre la mesa para ${p.name}`,
            body: "El club le ofrece irse a prestar para tener minutos. Queda en venta para préstamo.",
            effects: [
              { kind: "listed", target: p, listed: true },
              { kind: "morale", target: p, delta: 2 },
              { kind: "clubBond", target: p, delta: -3 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-captaincy",
    category: "decision",
    topic: "player",
    timing: "any",
    weight: 2,
    cooldown: 28,
    players: (p, save) => isFit(p) && p.age >= 25 && p.ovr >= 68 && !isCaptain(p, save),
    prompt: (save, _r, player) => {
      const cap = captainOf(save);
      return {
        title: `${player?.name ?? "Un jugador"} pide el brazalete`,
        body: cap
          ? `${player?.name ?? "Un jugador"} se postula como capitán. Hoy el grupo reconoce a ${cap.name}. Hay que manejarlo.`
          : `${player?.name ?? "Un jugador"} se postula como capitán. Hay que manejarlo.`,
      };
    },
    options: [
      {
        id: "give",
        stance: "support",
        label: "Darle más voz (sin sacarle el brazalete al otro)",
        hint: "Se suma un referente. El capitán actual puede no festejar.",
        apply: (save, _r, p) => {
          if (!p) return gone(p);
          const cap = userSquad(save).find((x) => isCaptain(x, save) && x.id !== p.id);
          return {
            tone: "neutral",
            title: `${p.name} gana peso`,
            body: "El cuerpo técnico le da más voz. El brazalete no se mueve, el vestuario sí.",
            effects: [
              { kind: "squadBond", target: p, delta: 8 },
              { kind: "clubBond", target: p, delta: 6 },
              { kind: "morale", target: p, delta: 6 },
              ...(cap
                ? [
                    { kind: "squadBond" as const, target: cap, delta: -6 },
                    { kind: "morale" as const, target: cap, delta: -4 },
                  ]
                : []),
            ],
          };
        },
      },
      {
        id: "no",
        stance: "internal",
        label: "Mantener al capitán actual",
        hint: "Se cuida la jerarquía. El que pidió puede resentirse.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: "El brazalete no se toca",
            body: "El cuerpo técnico cierra el tema. Un solo capitán.",
            effects: [
              { kind: "morale", target: p, delta: -6 },
              { kind: "clubBond", target: p, delta: -4 },
              { kind: "board", delta: 0.5, reason: "Se cuidó la jerarquía del vestuario" },
            ],
          };
        },
      },
      {
        id: "vote",
        stance: "performance",
        label: "Que vote el vestuario",
        hint: "Democrático. Puede unir o dejar heridos.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          const cap = userSquad(save).find((x) => isCaptain(x, save) && x.id !== p.id);
          return pickBranch(rng, [
            {
              chance: 50,
              result: {
                tone: "good",
                title: "El grupo se ordena",
                body: "La votación baja la espuma. Cada uno sabe dónde está.",
                effects: [
                  { kind: "morale", target: "squad", delta: 3 },
                  { kind: "squadBond", target: p, delta: 4 },
                ],
              },
            },
            {
              chance: 50,
              result: {
                tone: "bad",
                title: "La votación divide",
                body: "Hay bandos. El brazalete pesa más de lo que debería.",
                effects: [
                  { kind: "squadBond", target: p, delta: -6 },
                  ...(cap ? [{ kind: "squadBond" as const, target: cap, delta: -6 }] : []),
                  { kind: "teamBoost", rating: -0.3, games: 2, label: "vestuario dividido" },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-betting",
    category: "decision",
    topic: "player",
    timing: "any",
    weight: 1,
    cooldown: 48,
    players: (p) => isFit(p) && p.age >= 20,
    prompt: (_s, _r, player) => ({
      title: `Investigación por apuestas: ${player?.name ?? "un jugador"}`,
      body: `Aparece una denuncia: ${player?.name ?? "un jugador"} habría apostado en partidos de su propio club. Es grave y todavía no está cerrado.`,
    }),
    options: [
      {
        id: "report",
        stance: "punish",
        label: "Denunciar a la federación",
        hint: "El club se cubre. El jugador queda apartado y el prestigio, a salvo.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "bad",
            title: `${p.name} queda apartado`,
            body: "El club denuncia y aparta al jugador mientras dura el expediente.",
            effects: [
              { kind: "absence", target: p, games: 8, reason: "Expediente por apuestas", absenceKind: "discipline" },
              { kind: "value", target: p, pct: -18, games: 12 },
              { kind: "morale", target: p, delta: -16 },
              { kind: "clubBond", target: p, delta: -14 },
              { kind: "prestige", delta: 1 },
              { kind: "board", delta: 1.5, reason: "Se denunció un caso de apuestas" },
            ],
          };
        },
      },
      {
        id: "internal",
        stance: "internal",
        label: "Investigar puertas adentro",
        hint: "Menos ruido ahora. Si se filtra, explota.",
        apply: (save, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 55,
              result: {
                tone: "neutral",
                title: "El tema se enfría",
                body: "La investigación interna no encuentra para abrir un expediente. Queda una sombra.",
                effects: [
                  { kind: "prestige", delta: -1 },
                  { kind: "clubBond", target: p, delta: 4 },
                  { kind: "board", delta: -1, reason: "Se tapó un tema sensible" },
                ],
              },
            },
            {
              chance: 45,
              result: {
                tone: "bad",
                title: "El caso se filtra igual",
                body: "Lo publican. El club parece haber escondido algo y ahora paga multa y desgaste.",
                effects: [
                  { kind: "money", amount: -scaledMoney(save, 0.7, 400_000) },
                  { kind: "absence", target: p, games: 10, reason: "Expediente por apuestas", absenceKind: "discipline" },
                  { kind: "prestige", delta: -3 },
                  { kind: "board", delta: -3, reason: "Escándalo de apuestas filtrado" },
                  { kind: "value", target: p, pct: -22, games: 12 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "cut",
        stance: "accept-sanction",
        label: "Cortar relación ya",
        hint: "El jugador deja el plantel. El club se despega, el equipo pierde a alguien.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "bad",
            title: `${p.name} deja el club`,
            body: "El club corta por lo sano. No hay compensación: se protege la camiseta.",
            effects: [
              { kind: "leaveSquad", target: p, eventId: "decision-betting", compensation: 0 },
              { kind: "prestige", delta: 2 },
              { kind: "board", delta: 2, reason: "Se cortó un caso de apuestas" },
              { kind: "morale", target: "squad", delta: -4 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-grave-legal",
    category: "decision",
    topic: "player",
    timing: "any",
    weight: 1,
    cooldown: 55,
    players: (p) => p.age >= 21,
    prompt: (_s, _r, player) => ({
      title: `Causa grave fuera del fútbol: ${player?.name ?? "un jugador"}`,
      body: `${player?.name ?? "Un jugador"} queda imputado por un delito grave ajeno a la cancha. El club tiene que decidir cómo proceder mientras avanza la causa.`,
    }),
    options: [
      {
        id: "distance",
        stance: "accept-sanction",
        label: "Apartarlo de inmediato",
        hint: "Queda fuera varios partidos. El club se protege; él se siente solo.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return {
            tone: "bad",
            title: `${p.name} queda apartado`,
            body: "El club lo aparta mientras dura la causa. El plantel se entera por un comunicado.",
            effects: [
              { kind: "absence", target: p, games: rng.int(6, 10), reason: "Causa judicial", absenceKind: "discipline" },
              { kind: "value", target: p, pct: -16, games: 12 },
              { kind: "clubBond", target: p, delta: -10 },
              { kind: "prestige", delta: 1 },
              { kind: "board", delta: 1, reason: "Se apartó a un imputado" },
            ],
          };
        },
      },
      {
        id: "lawyers",
        stance: "pay",
        label: "Ponerle defensa y acompañarlo",
        hint: "Sale plata y hay desgaste de imagen. El jugador no queda solo.",
        cost: (save) => scaledMoney(save, 0.55, 280_000),
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `El club acompaña a ${p.name}`,
            body: "Hay abogados, un comunicado corto y una baja temporal. El club no lo tira.",
            effects: [
              { kind: "absence", target: p, games: rng.int(3, 5), reason: "Causa judicial", absenceKind: "personal" },
              { kind: "clubBond", target: p, delta: 10 },
              { kind: "morale", target: p, delta: 4 },
              { kind: "prestige", delta: -2 },
              { kind: "board", delta: -1.5, reason: "El club se expuso con una causa ajena" },
            ],
          };
        },
      },
      {
        id: "cut",
        stance: "punish",
        label: "Rescindir y desvincularlo",
        hint: "Deja el plantel. El club se despega del todo; el equipo pierde un futbolista.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "bad",
            title: `${p.name} deja el club`,
            body: "Se corta el vínculo. El comunicado es breve. El vestuario se queda en silencio.",
            effects: [
              { kind: "leaveSquad", target: p, eventId: "decision-grave-legal", compensation: 0 },
              { kind: "prestige", delta: 1 },
              { kind: "board", delta: 1.5, reason: "Se desvinculó a un imputado" },
              { kind: "morale", target: "squad", delta: -5 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-media-storm",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 3,
    cooldown: 16,
    players: (p, save) => isImportant(p, save),
    prompt: (_s, _r, player) => ({
      title: `${player?.name ?? "Un jugador"} incendia las redes`,
      body: `Un audio o un posteo de ${player?.name ?? "un jugador"} se sale de madre. La prensa pide una reacción del club.`,
    }),
    options: [
      {
        id: "defend",
        stance: "support",
        label: "Bancarlo en público",
        hint: "Gana lealtad. La prensa y la dirigencia pueden no coincidir.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `El club banca a ${p.name}`,
            body: "El comunicado lo cubre. Él agradece; afuera, no tanto.",
            effects: [
              { kind: "clubBond", target: p, delta: 10 },
              { kind: "morale", target: p, delta: 6 },
              { kind: "prestige", delta: -1 },
              { kind: "board", delta: -1, reason: "Se cubrió una polémica" },
            ],
          };
        },
      },
      {
        id: "fine",
        stance: "punish",
        label: "Multarlo y pedir disculpas",
        hint: "Se cierra el tema con un costo para él y una señal hacia afuera.",
        apply: (save, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "neutral",
            title: `Sanción a ${p.name}`,
            body: "Hay disculpas públicas y una multa interna. El ruido baja.",
            effects: [
              { kind: "money", amount: Math.round(p.wage * 2) },
              { kind: "morale", target: p, delta: -8 },
              { kind: "clubBond", target: p, delta: -6 },
              { kind: "prestige", delta: 1 },
              { kind: "board", delta: 1, reason: "Se sancionó una polémica" },
            ],
          };
        },
      },
      {
        id: "silence",
        stance: "internal",
        label: "No alimentar el tema",
        hint: "Silencio oficial. Puede morir... o crecer.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 58,
              result: {
                tone: "good",
                title: "La polémica se apaga",
                body: "A los dos días ya nadie habla. El silencio funcionó.",
                effects: [{ kind: "morale", target: p, delta: 2 }],
              },
            },
            {
              chance: 42,
              result: {
                tone: "bad",
                title: "El silencio se lee como culpabilidad",
                body: "La prensa empuja más. El tema llega a la dirigencia.",
                effects: [
                  { kind: "prestige", delta: -1 },
                  { kind: "board", delta: -1.5, reason: "Polémica mal cerrada" },
                  { kind: "morale", target: p, delta: -4 },
                ],
              },
            },
          ]);
        },
      },
    ],
  },
  {
    id: "decision-newborn",
    category: "decision",
    topic: "player",
    timing: "pre",
    weight: 2,
    cooldown: 22,
    eligible: isBigMatch,
    players: (p, save) => isStarter(p, save) && p.age >= 23,
    prompt: (save, _r, player) => ({
      title: `${player?.name ?? "Un titular"} es padre en la semana del partido`,
      body: `Nació el hijo de ${player?.name ?? "un titular"} a días de ${opponentName(save)}. Pide estar con su familia.`,
    }),
    options: [
      {
        id: "leave",
        stance: "allow-absence",
        label: "Dejarlo con su familia",
        hint: "Se pierde el partido grande. Vuelve agradecido.",
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "good",
            title: `${p.name} está con los suyos`,
            body: "El club no discute lo que no se discute. El partido se juega con otro.",
            effects: [
              { kind: "absence", target: p, games: 1, reason: "Nacimiento", absenceKind: "personal" },
              { kind: "morale", target: p, delta: 12 },
              { kind: "clubBond", target: p, delta: 12 },
              { kind: "squadBond", target: p, delta: 4 },
            ],
          };
        },
      },
      {
        id: "play",
        stance: "performance",
        label: "Pedile que esté en la convocatoria",
        hint: "El partido grande manda. Él puede responder o llegar destrozado.",
        apply: (_s, rng, p) => {
          if (!p) return gone(p);
          return pickBranch(rng, [
            {
              chance: 50,
              result: {
                tone: "neutral",
                title: `${p.name} está, pero no está`,
                body: "Cumple. Se nota que la cabeza quedó en la clínica.",
                effects: [
                  { kind: "morale", target: p, delta: -6 },
                  { kind: "form", target: p, delta: -1 },
                  { kind: "clubBond", target: p, delta: -4 },
                ],
              },
            },
            {
              chance: 50,
              result: {
                tone: "bad",
                title: `${p.name} no perdona el gesto`,
                body: "Juega mal y lo dice: el club eligió el partido. La relación queda marcada.",
                effects: [
                  { kind: "morale", target: p, delta: -14 },
                  { kind: "clubBond", target: p, delta: -12 },
                  { kind: "form", target: p, delta: -2 },
                ],
              },
            },
          ]);
        },
      },
      {
        id: "fly",
        stance: "wellbeing",
        label: "Pagarle el vuelo ida y vuelta",
        hint: "Costo chico. Está con su familia y vuelve para el partido, cansado.",
        cost: (save) => scaledMoney(save, 0.05, 40_000),
        apply: (_s, _r, p) => {
          if (!p) return gone(p);
          return {
            tone: "good",
            title: `${p.name} va y vuelve`,
            body: "Duerme poco, abraza a su hijo y llega a la convocatoria. El cuerpo no está de fiesta.",
            effects: [
              { kind: "fitness", target: p, delta: -8 },
              { kind: "morale", target: p, delta: 10 },
              { kind: "clubBond", target: p, delta: 10 },
            ],
          };
        },
      },
    ],
  },
  {
    id: "decision-sponsor-extra",
    category: "decision",
    topic: "economy",
    timing: "any",
    weight: 3,
    cooldown: 20,
    prompt: (save) => ({
      title: "Un sponsor pide más exposición",
      body: `A cambio de ${formatMoney(scaledMoney(save, 1.1, 350_000))}, un patrocinador quiere pegar su marca en la rueda de prensa y en la camiseta de entrenamiento. El vestuario no ama las cámaras extra.`,
    }),
    options: [
      {
        id: "yes",
        stance: "accept-offer",
        label: "Aceptar el extra",
        hint: "Entra plata. El plantel se queja un poco de las obligaciones.",
        apply: (save) => ({
          tone: "good",
          title: "Más plata, más logos",
          body: "El club cobra. El vestuario suma una obligación más.",
          effects: [
            { kind: "money", amount: scaledMoney(save, 1.1, 350_000) },
            { kind: "morale", target: "squad", delta: -3 },
            { kind: "board", delta: 1, reason: "Ingreso extra de un sponsor" },
          ],
        }),
      },
      {
        id: "no",
        stance: "reject-offer",
        label: "Cuidar al plantel",
        hint: "Sin ingreso extra. El grupo agradece el aire.",
        apply: () => ({
          tone: "neutral",
          title: "Se rechaza el extra",
          body: "El club no vende más pedazos de la semana. El plantel lo nota.",
          effects: [
            { kind: "morale", target: "squad", delta: 4 },
            { kind: "board", delta: -1, reason: "Se rechazó un ingreso extra" },
          ],
        }),
      },
      {
        id: "half",
        stance: "internal",
        label: "Aceptar a medias",
        hint: "Menos plata, menos cámaras. Un punto intermedio.",
        apply: (save) => ({
          tone: "neutral",
          title: "Acuerdo recortado",
          body: "Hay logo en el entrenamiento, no en cada conferencia. Entra menos, molesta menos.",
          effects: [
            { kind: "money", amount: scaledMoney(save, 0.5, 160_000) },
            { kind: "morale", target: "squad", delta: -1 },
          ],
        }),
      },
    ],
  },
];
