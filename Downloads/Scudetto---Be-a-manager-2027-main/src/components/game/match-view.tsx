import { useEffect, useMemo, useRef, useState } from "react";
import { BoardMatchNote } from "@/components/game/board";
import { ClubCrest } from "@/components/game/crest";
import { RedCard, StatusGlyph, outGames, outReason, statusTag, statusWord } from "@/components/game/status-icons";
import { Button } from "@/components/ui/button";
import { clubById } from "@/lib/game/clubs";
import { COMP_THEME, compBackdropStyle, compLabel } from "@/lib/game/competitions";
import { userMatchBoost } from "@/lib/game/event-effects";
import { formatMoney, lastName } from "@/lib/game/format";
import { resolveNumberColor } from "@/lib/game/kit";
import { nextUserContext } from "@/lib/game/selectors";
import { clubQuality } from "@/lib/game/sim";
import { useGame } from "@/lib/game/store";
import { FORMATIONS, unavailableReason } from "@/lib/game/tactics";
import { lineupProblems } from "@/lib/game/tick";
import type { MatchEvent, MatchResult, Player } from "@/lib/game/types";

export function MatchPreview() {
  const save = useGame((s) => s);
  const playPending = useGame((s) => s.playPending);
  const setScreen = useGame((s) => s.setScreen);
  const autoFill = useGame((s) => s.autoFill);
  const substituteUnavailable = useGame((s) => s.substituteUnavailable);
  const [showAlert, setShowAlert] = useState(true);
  const [subNote, setSubNote] = useState<string | null>(null);
  const ctx = nextUserContext(save);
  const fixture = ctx?.fixture ?? save.fixtures.find((f) => f.id === save.pendingFixtureId);

  if (!fixture) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4">
        <p className="text-fg-muted">No hay partido pendiente.</p>
        <Button onClick={() => setScreen("office")}>Volver al despacho</Button>
      </div>
    );
  }

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  const userHome = fixture.homeId === save.clubId;
  const homeLineup = userHome ? save.tactics.lineup : [];
  const awayLineup = !userHome ? save.tactics.lineup : [];
  // Preparación y ambiente del plantel (sucesos recientes, relaciones): cuentan en el partido, así que se ven en el GRL.
  const boost = userMatchBoost(save);
  const homeGrl =
    Math.round(
      (clubQuality(save.players, fixture.homeId, homeLineup, userHome ? save.tactics.bench : undefined) +
        (userHome ? boost : 0)) *
        10,
    ) / 10;
  const awayGrl =
    Math.round(
      (clubQuality(save.players, fixture.awayId, awayLineup, !userHome ? save.tactics.bench : undefined) +
        (!userHome ? boost : 0)) *
        10,
    ) / 10;
  const problems = lineupProblems(save);

  // Con bajas en el once no se juega: se muestra el cartel con las opciones.
  const play = (watch: boolean) => {
    if (problems.length) {
      setShowAlert(true);
      return;
    }
    playPending(watch);
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-bg px-4 py-8"
      style={compBackdropStyle(fixture.competition)}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-8">
        <p
          className="text-center text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: COMP_THEME[fixture.competition].accent }}
        >
          {ctx?.slot ? ctx.slot.title : compLabel(fixture.competition, clubById(save.clubId).league)}
        </p>
        <div className="flex items-center justify-between gap-3">
          <ClubBlock club={home} grl={homeGrl} />
          <p className="font-display text-3xl text-fg-muted">vs</p>
          <ClubBlock club={away} grl={awayGrl} />
        </div>
        <p className="text-center text-sm text-fg-muted">
          {userHome ? `Local en ${home.stadium}` : `Visitante en ${home.stadium}`}
        </p>
        <p className="text-center text-sm text-fg-muted">
          Tu sistema: {FORMATIONS[save.tactics.formation].name}
        </p>
        {boost !== 0 ? (
          <p className="text-center text-xs text-fg-muted">
            {boost > 0 ? "Buen clima en el equipo" : "Clima complicado en el equipo"} ({boost > 0 ? "+" : "−"}
            {Math.abs(boost).toFixed(1)} GRL)
            {save.events.modifiers.length ? ` · ${save.events.modifiers.map((m) => m.label).join(", ")}` : ""}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {subNote ? <p className="text-center text-xs text-fg-muted">{subNote}</p> : null}
          <Button variant="club" size="lg" onClick={() => play(true)}>
            Ver el partido
          </Button>
          <Button variant="outline" size="lg" onClick={() => play(false)}>
            Simular resultado
          </Button>
          <Button variant="ghost" onClick={() => setScreen("tactics")}>
            Cambiar once
          </Button>
          <Button variant="ghost" onClick={() => autoFill()}>
            Mejor once
          </Button>
        </div>
      </div>
      {problems.length && showAlert ? (
        <LineupAlert
          problems={problems}
          onGoLineup={() => setScreen("tactics")}
          onAuto={(permanent) => {
            setSubNote(substituteUnavailable(permanent));
            setShowAlert(false);
          }}
        />
      ) : null}
    </div>
  );
}

function LineupAlert({
  problems,
  onGoLineup,
  onAuto,
}: {
  problems: Player[];
  onGoLineup: () => void;
  onAuto: (permanent: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/80 p-4 sm:items-center">
      <div
        role="alertdialog"
        aria-label="Jugadores no disponibles"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-elevated p-5 shadow-[var(--shadow-border)]"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-bad">Bajas en el once</p>
        <h3 className="mt-2 font-display text-3xl font-semibold leading-none">
          {problems.length === 1 ? "Un titular no puede jugar" : `${problems.length} titulares no pueden jugar`}
        </h3>
        <ul className="mt-4 flex flex-col gap-2">
          {problems.map((p) => {
            const st = unavailableReason(p) ?? "injury";
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-elevated shadow-[var(--shadow-border)]">
                  <StatusGlyph status={st} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-fg-muted">
                    {statusWord(st)}
                    {outReason(p, st) ? `: ${outReason(p, st)}` : ""} · fuera {outGames(p, st)} partido{outGames(p, st) > 1 ? "s" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="outline" onClick={onGoLineup}>
            Ir a alineación
          </Button>
          <Button variant="club" onClick={() => onAuto(false)}>
            Hacer cambio automático para este partido
          </Button>
          <Button variant="club" onClick={() => onAuto(true)}>
            Hacer cambio automático y guardarlo en la formación
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClubBlock({ club, grl }: { club: ReturnType<typeof clubById>; grl?: number }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <ClubCrest club={club} size={72} />
      <p className="text-center font-display text-2xl font-semibold leading-none">{club.short}</p>
      <p className="text-center text-xs text-fg-muted">{club.name}</p>
      {typeof grl === "number" && grl > 0 ? (
        <p className="font-display text-lg tabular-nums text-fg-muted">GRL {grl.toFixed(1)}</p>
      ) : null}
    </div>
  );
}

export function MatchLive() {
  const last = useGame((s) => s.lastMatch);
  const comp = useGame((s) => s.fixtures.find((f) => f.id === s.lastMatch?.fixtureId)?.competition);
  const finishWatch = useGame((s) => s.finishWatch);
  const [minute, setMinute] = useState(0);
  const [log, setLog] = useState<MatchEvent[]>([]);
  const [homeG, setHomeG] = useState(0);
  const [awayG, setAwayG] = useState(0);
  const [done, setDone] = useState(false);
  const [alert, setAlert] = useState<MatchEvent | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const scroller = useRef<HTMLUListElement>(null);
  const paused = useRef(false);

  useEffect(() => {
    if (!last) return;
    let raf = 0;
    let lastTs = performance.now();
    let acc = 0;
    let m = 0;
    const events = last.events;
    const minutesPerSec = 14;
    const tick = (now: number) => {
      if (paused.current) {
        lastTs = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min((now - lastTs) / 1000, 0.1);
      lastTs = now;
      acc += dt * minutesPerSec;
      while (acc >= 1 && m < 90) {
        acc -= 1;
        m += 1;
        const at = events.filter((e) => e.minute === m);
        if (at.length) {
          setLog((prev) => [...prev, ...at]);
          for (const g of at.filter((e) => e.type === "goal")) {
            if (g.clubId === last.homeId) setHomeG((n) => n + 1);
            if (g.clubId === last.awayId) setAwayG((n) => n + 1);
          }
          const hit = at.find((e) => e.type === "red" || e.type === "injury");
          if (hit) {
            paused.current = true;
            setAlert(hit);
          }
        }
        setMinute(m);
      }
      if (m >= 90) {
        setLog((prev) => {
          if (prev.some((e) => e.type === "ft")) return prev;
          const ft = events.filter((e) => e.type === "ft" || e.minute > 90);
          return [...prev, ...ft];
        });
        setHomeG(last.homeGoals);
        setAwayG(last.awayGoals);
        setDone(true);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [last]);

  useEffect(() => {
    scroller.current?.lastElementChild?.scrollIntoView({ block: "end" });
  }, [log.length]);

  if (!last) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <Button onClick={finishWatch}>Volver</Button>
      </div>
    );
  }

  const home = clubById(last.homeId);
  const away = clubById(last.awayId);

  return (
    <div className="flex min-h-dvh flex-col bg-bg" style={compBackdropStyle(comp)}>
      <header className="border-b border-border px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <ClubCrest club={home} size={36} />
          <div className="flex-1 text-center">
            <p className="font-display text-5xl font-semibold tabular-nums leading-none">
              {homeG}–{awayG}
            </p>
            <p className="mt-1 font-display text-lg tabular-nums text-fg-muted">{minute}'</p>
          </div>
          <ClubCrest club={away} size={36} />
        </div>
        <p className="mt-2 text-center text-xs text-fg-muted">
          {home.short} · {away.short}
        </p>
      </header>
      <LivePitch
        result={last}
        log={log}
        picked={picked}
        onPick={setPicked}
      />
      <ul
        ref={scroller}
        className="mx-auto max-h-[28dvh] w-full max-w-lg flex-1 overflow-y-auto px-4 py-3"
      >
        {log.map((e, i) => (
          <li
            key={`${e.minute}-${e.type}-${i}`}
            className={`py-1.5 text-sm ${e.type === "goal" ? "font-medium text-fg" : e.type === "red" || e.type === "injury" ? "font-medium text-bad" : "text-fg-muted"}`}
          >
            {e.text}
          </li>
        ))}
      </ul>
      <div className="mx-auto w-full max-w-lg px-4 pb-8">
        {done ? (
          <div className="flex flex-col gap-3">
            <Stats result={last} />
            <BoardMatchNote />
            <PostMatchOffers />
            <Button variant="club" size="lg" onClick={finishWatch}>
              Continuar
            </Button>
          </div>
        ) : (
          // Sin botón de saltar: si querías evitar el partido, tenías "Simular resultado".
          <p className="py-2 text-center text-xs text-fg-muted">Partido en juego…</p>
        )}
      </div>
      {alert ? (
        <MatchIncident
          event={alert}
          onDismiss={() => {
            setAlert(null);
            paused.current = false;
          }}
        />
      ) : null}
    </div>
  );
}

export function MatchResultView() {
  const userClubId = useGame((s) => s.clubId);
  const last = useGame((s) => s.lastMatch);
  const comp = useGame((s) => s.fixtures.find((f) => f.id === s.lastMatch?.fixtureId)?.competition);
  const finishWatch = useGame((s) => s.finishWatch);

  if (!last) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-4">
        <p className="text-fg-muted">No hay resultado para mostrar.</p>
        <Button onClick={finishWatch}>Volver</Button>
      </div>
    );
  }

  const home = clubById(last.homeId);
  const away = clubById(last.awayId);
  const headlines = last.events.filter(
    (e) => e.type === "goal" || e.type === "red" || e.type === "injury" || e.type === "ft",
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg px-4 py-8" style={compBackdropStyle(comp)}>
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-fg-muted">
          {comp ? `${compLabel(comp, clubById(userClubId).league)} · Resultado` : "Resultado"}
        </p>
        <div className="flex items-center justify-between gap-3">
          <ClubBlock club={home} grl={last.homeGrl} />
          <div className="text-center">
            <p className="font-display text-6xl font-semibold tabular-nums leading-none">
              {last.homeGoals}–{last.awayGoals}
            </p>
            <p className="mt-2 text-xs text-fg-muted">90'</p>
          </div>
          <ClubBlock club={away} grl={last.awayGrl} />
        </div>
        <ul className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
          {headlines.map((e, i) => (
            <li
              key={`${e.minute}-${e.type}-${i}`}
              className={`py-1.5 text-sm ${e.type === "goal" ? "font-medium text-fg" : e.type === "red" || e.type === "injury" ? "font-medium text-bad" : "text-fg-muted"}`}
            >
              {e.text}
            </li>
          ))}
        </ul>
        <Stats result={last} />
        <BoardMatchNote />
        <PostMatchOffers />
        <Button variant="club" size="lg" onClick={finishWatch}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function LivePitch({
  result,
  log,
  picked,
  onPick,
}: {
  result: MatchResult;
  log: MatchEvent[];
  picked: string | null;
  onPick: (id: string | null) => void;
}) {
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const tactics = useGame((s) => s.tactics);
  const userHome = result.homeId === clubId;
  const startingXi = userHome ? result.homeLineup : result.awayLineup;
  // El once que está en cancha ahora: los cambios ya vistos reemplazan a quien salió.
  const lineup = useMemo(() => {
    const xi = [...startingXi];
    for (const e of log) {
      if (e.type !== "sub" || e.clubId !== clubId || !e.playerId || !e.outPlayerId) continue;
      const i = xi.indexOf(e.outPlayerId);
      if (i >= 0) xi[i] = e.playerId;
    }
    return xi;
  }, [startingXi, log, clubId]);
  const club = clubById(clubId);
  const slots = FORMATIONS[tactics.formation].slots;
  const ink = resolveNumberColor(club.color, tactics.numberColor);
  const sentOff = useMemo(() => {
    const set = new Set<string>();
    for (const e of log) if (e.type === "red" && e.playerId) set.add(e.playerId);
    return set;
  }, [log]);
  const injured = useMemo(() => {
    const set = new Set<string>();
    for (const e of log) if (e.type === "injury" && e.playerId) set.add(e.playerId);
    return set;
  }, [log]);
  const pickedPlayer = picked ? players.find((p) => p.id === picked) : null;
  const pickedStatus = picked && sentOff.has(picked) ? "suspension" : picked && injured.has(picked) ? "injury" : null;

  return (
    <div className="px-4 pt-3">
      <div className="pitch-grid relative mx-auto aspect-[3/2.2] max-h-56 w-full max-w-lg overflow-hidden rounded-xl">
        <div className="pointer-events-none absolute inset-2 rounded-[16px] border border-white/15" />
        {slots.map((slot, i) => {
          const id = lineup[i];
          const p = id ? players.find((x) => x.id === id) : undefined;
          if (!p) return null;
          const status = sentOff.has(p.id) ? "suspension" : injured.has(p.id) ? "injury" : null;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(picked === p.id ? null : p.id)}
              className="absolute flex w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${slot.x}%`, top: `${slot.y * 0.92}%` }}
            >
              <span
                className="flex size-9 items-center justify-center rounded-full font-display text-xs tabular-nums shadow-[var(--shadow-border)]"
                style={{ background: status ? "var(--color-elevated)" : club.color, color: ink }}
              >
                {status ? <StatusGlyph status={status} /> : p.ovr}
              </span>
              {status ? (
                <span
                  className={`mt-0.5 rounded-sm px-1 text-[8px] font-medium leading-3 ${status === "suspension" ? "bg-red-600 text-white" : "bg-bad/25 text-bad"}`}
                >
                  {statusTag(status)}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {pickedPlayer ? (
        <PitchPeek player={pickedPlayer} status={pickedStatus} onClose={() => onPick(null)} />
      ) : null}
    </div>
  );
}

function PitchPeek({
  player,
  status,
  onClose,
}: {
  player: Player;
  status: "injury" | "suspension" | null;
  onClose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="mx-auto mt-2 flex w-full max-w-lg items-center justify-center gap-3 rounded-xl bg-elevated px-3 py-3 shadow-[var(--shadow-border)]"
    >
      {status ? (
        <StatusGlyph status={status} large />
      ) : (
        <span className="font-display text-2xl tabular-nums">{player.ovr}</span>
      )}
      {status ? (
        <p className="font-display text-xl">
          {status === "suspension" ? "Expulsado" : "Lesionado"}
        </p>
      ) : (
        <div className="text-left">
          <p className="text-sm font-medium">{player.name}</p>
          <p className="text-[11px] text-fg-muted">
            {lastName(player.name)} · GRL {player.ovr}
          </p>
        </div>
      )}
    </button>
  );
}

function MatchIncident({ event, onDismiss }: { event: MatchEvent; onDismiss: () => void }) {
  const red = event.type === "red";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/75 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-elevated p-5 text-center shadow-[var(--shadow-border)]">
        <div className="mb-3 flex justify-center">
          {red ? <RedCard className="h-12 w-9" /> : <StatusGlyph status="injury" large />}
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-bad">
          {red ? "Roja" : "Lesión"}
        </p>
        <h3 className="mt-2 font-display text-3xl font-semibold leading-none">
          {red ? "Expulsado" : "Se lesiona"}
        </h3>
        <p className="mt-3 text-sm text-fg-muted">{event.text}</p>
        <Button variant="club" className="mt-5 w-full" onClick={onDismiss}>
          Seguir
        </Button>
      </div>
    </div>
  );
}

function PostMatchOffers() {
  const offers = useGame((s) => s.offers);
  const week = useGame((s) => s.week);
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const incoming = offers.filter((o) => o.toClubId === clubId && o.kind === "buy" && o.week === week - 1);
  if (!incoming.length) return null;
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
        Ofertas al silbato
      </p>
      <ul className="flex flex-col gap-2">
        {incoming.map((o) => {
          const p = players.find((x) => x.id === o.playerId);
          const from = clubById(o.fromClubId);
          if (!p) return null;
          return (
            <li key={o.id} className="flex items-center gap-3 rounded-lg bg-elevated px-3 py-2">
              <ClubCrest club={from} size={28} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.name}</p>
                <p className="text-[11px] text-fg-muted">
                  {from.name} · GRL {p.ovr} · POT {p.pot}
                </p>
              </div>
              <p className="font-display text-lg tabular-nums">{formatMoney(o.fee)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stats({ result }: { result: MatchResult }) {
  const rows: Array<[string, number, number, boolean?]> = [
    ["Tiros", result.homeStats.shots, result.awayStats.shots],
    ["A puerta", result.homeStats.onTarget, result.awayStats.onTarget],
    ["Posesión %", result.homeStats.possession, result.awayStats.possession, true],
    ["Córners", result.homeStats.corners, result.awayStats.corners],
    ["Faltas", result.homeStats.fouls, result.awayStats.fouls],
    ["Amarillas", result.homeStats.yellows, result.awayStats.yellows],
    ["Rojas", result.homeStats.reds, result.awayStats.reds],
  ];
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      {rows.map(([label, a, b, bar]) => {
        const total = a + b || 1;
        return (
          <div key={label} className="py-1.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
              <span className="text-right font-display text-lg tabular-nums">{a}</span>
              <span className="text-center text-[11px] uppercase tracking-wide text-fg-muted">{label}</span>
              <span className="font-display text-lg tabular-nums">{b}</span>
            </div>
            {bar ? (
              <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-elevated">
                <span className="bg-fg" style={{ width: `${(a / total) * 100}%` }} />
                <span className="bg-primary" style={{ width: `${(b / total) * 100}%` }} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
