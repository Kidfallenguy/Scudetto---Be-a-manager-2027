import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { ClubCrest } from "@/components/game/crest";
import { StatusGlyph, outGames, outReason, outText, statusTag, statusWord } from "@/components/game/status-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { clubById } from "@/lib/game/clubs";
import { POS_LABEL, lastName, ovrClass } from "@/lib/game/format";
import { NUMBER_COLOR_OPTIONS, resolveNumberColor } from "@/lib/game/kit";
import { BENCH_SIZE, FORMATION_IDS, FORMATIONS, MENTALITY_LABEL, benchRating, canPlaySlot, isUnavailable, slotFit, unavailableReason, xiRating } from "@/lib/game/tactics";
import { useGame } from "@/lib/game/store";
import type { Mentality, NumberColor, Player } from "@/lib/game/types";

export function TacticsView() {
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const tactics = useGame((s) => s.tactics);
  const pending = useGame((s) => s.pendingFixtureId);
  const setFormation = useGame((s) => s.setFormation);
  const setMentality = useGame((s) => s.setMentality);
  const setNumberColor = useGame((s) => s.setNumberColor);
  const setLineupSlot = useGame((s) => s.setLineupSlot);
  const autoFill = useGame((s) => s.autoFill);
  const toggleBench = useGame((s) => s.toggleBench);
  const autoBench = useGame((s) => s.autoBench);
  const setScreen = useGame((s) => s.setScreen);
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [benchOpen, setBenchOpen] = useState(false);
  const [benchNotice, setBenchNotice] = useState<string | null>(null);
  const club = clubById(clubId);
  const squad = players.filter((p) => p.clubId === clubId);
  const slots = FORMATIONS[tactics.formation].slots;
  const rating = Math.round(xiRating(players, tactics.lineup));
  const ink = resolveNumberColor(club.color, tactics.numberColor);
  const benchPlayers = tactics.bench
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));
  const benchAvg = Math.round(benchRating(players, tactics.bench));
  const outPlayers = tactics.lineup
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p) && isUnavailable(p as Player));
  const benchCandidates = squad
    .filter((p) => !tactics.lineup.includes(p.id))
    .sort((a, b) => {
      const ua = isUnavailable(a) ? 0 : 1;
      const ub = isUnavailable(b) ? 0 : 1;
      return ub - ua || b.ovr - a.ovr;
    });
  const pickerPlayers = squad.slice().sort((a, b) => {
    if (slotIndex === null) return b.ovr - a.ovr;
    const allowed = slots[slotIndex]?.pos ?? [];
    const ua = isUnavailable(a) ? 0 : 1;
    const ub = isUnavailable(b) ? 0 : 1;
    if (ub !== ua) return ub - ua;
    const fa = slotFit(a.pos, allowed);
    const fb = slotFit(b.pos, allowed);
    if (fb !== fa) return fb - fa;
    return b.ovr - a.ovr;
  });

  return (
    <div className="flex flex-col gap-4">
      {pending ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-elevated px-3 py-2 shadow-[var(--shadow-border)]">
          <p className="text-sm text-fg-muted">El partido espera tu once.</p>
          <Button size="sm" variant="club" onClick={() => setScreen("preview")}>
            Ir al partido
          </Button>
        </div>
      ) : null}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold">Táctica</h2>
          <p className="text-sm text-fg-muted">
            Once titular {rating} MED · Banquillo {benchAvg} · {FORMATIONS[tactics.formation].name}
          </p>
        </div>
        <Button variant="outline" onClick={() => autoFill()}>
          Mejor once y banquillo
        </Button>
      </header>

      <div className="flex flex-wrap gap-1">
        {FORMATION_IDS.map((id) => (
          <Button
            key={id}
            size="sm"
            variant={tactics.formation === id ? "club" : "ghost"}
            onClick={() => setFormation(id)}
          >
            {FORMATIONS[id].name}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
          <Button
            key={m}
            size="sm"
            variant={tactics.mentality === m ? "club" : "outline"}
            onClick={() => setMentality(m)}
          >
            {MENTALITY_LABEL[m]}
          </Button>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] uppercase tracking-wide text-fg-muted">Color del número</p>
        <div className="flex flex-wrap gap-1">
          {NUMBER_COLOR_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              size="sm"
              variant={tactics.numberColor === opt.id ? "club" : "ghost"}
              onClick={() => setNumberColor(opt.id as NumberColor)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      {outPlayers.length ? (
        <div role="alert" className="flex flex-col gap-1.5 rounded-xl bg-elevated px-3 py-2.5 shadow-[var(--shadow-border)]">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-bad">
            Bajas en el once
          </p>
          <ul className="flex flex-col gap-1">
            {outPlayers.map((p) => {
              const st = unavailableReason(p)!;
              return (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <StatusGlyph status={st} />
                  <span className="font-medium">{p.name}</span>
                  <span className="text-fg-muted">
                    {statusWord(st)}
                    {outReason(p, st) ? `: ${outReason(p, st)}` : ""} · {outGames(p, st)} j
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-fg-muted">
            Toca su puesto para reemplazarlo, o usa “Mejor once”.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
        <span>El número en cada jugador es su GRL actual.</span>
        <span className="inline-flex items-center gap-1">
          <HeartPulse className="size-3.5 text-bad" /> Lesión
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusGlyph status="suspension" /> Expulsado
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusGlyph status="illness" /> Enfermo
        </span>
        <span className="inline-flex items-center gap-1">
          <StatusGlyph status="absence" /> Ausente
        </span>
      </div>

      <div className="pitch-grid relative aspect-[3/4] max-h-[72dvh] w-full overflow-hidden rounded-2xl shadow-[var(--shadow-border)] sm:aspect-[3/3.4]">
        <div className="pointer-events-none absolute inset-3 rounded-[20px] border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-0 h-1/2 w-px -translate-x-px bg-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        {slots.map((slot, i) => {
          const p = players.find((x) => x.id === tactics.lineup[i]);
          const reason = p ? unavailableReason(p) : null;
          return (
            <button
              key={`${slot.label}-${i}`}
              type="button"
              onClick={() => {
                setNotice(null);
                setSlotIndex(i);
              }}
              className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              {p ? (
                <PlayerChip
                  player={p}
                  accent={club.color}
                  ink={ink}
                  active={slotIndex === i}
                  offPos={!canPlaySlot(p.pos, slot.pos)}
                  status={reason}
                />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-bg/70 text-xs text-fg-muted">
                  {slot.label}
                </span>
              )}
            </button>
          );
        })}
      </div>


      <section className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">
              Suplentes · {benchPlayers.length}/{BENCH_SIZE}
            </p>
            <p className="text-[11px] text-fg-muted">
              Entran en la segunda parte o si alguien se lesiona. Afectan un poco a la media del equipo.
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button size="sm" variant="ghost" onClick={() => autoBench()}>
              Automático
            </Button>
            <Button size="sm" variant={benchOpen ? "club" : "outline"} onClick={() => setBenchOpen((v) => !v)}>
              {benchOpen ? "Listo" : "Elegir"}
            </Button>
          </div>
        </div>
        {benchPlayers.length ? (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {benchPlayers.map((p) => {
              const reason = unavailableReason(p);
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg bg-elevated px-2 py-1.5",
                    reason && "opacity-60",
                  )}
                >
                  <span className={cn("w-7 font-display text-base tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{lastName(p.name)}</span>
                    <span className="text-[10px] text-fg-muted">{POS_LABEL[p.pos]}</span>
                  </span>
                  {reason ? <StatusGlyph status={reason} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg bg-elevated px-3 py-2 text-xs text-fg-muted">
            Sin suplentes: un banquillo vacío resta algo de media y no habrá cambios.
          </p>
        )}
        {benchOpen ? (
          <div className="mt-3">
            {benchNotice ? (
              <p role="alert" className="mb-2 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
                {benchNotice}
              </p>
            ) : null}
            <ul className="max-h-64 overflow-y-auto">
              {benchCandidates.map((p) => {
                const onBench = tactics.bench.includes(p.id);
                const blocked = isUnavailable(p);
                const reason = unavailableReason(p);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={blocked && !onBench}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => setBenchNotice(toggleBench(p.id))}
                    >
                      <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{p.name}</span>
                        <span className="text-[11px] text-fg-muted">
                          {POS_LABEL[p.pos]}
                          {outText(p, reason)}
                        </span>
                      </span>
                      {reason ? <StatusGlyph status={reason} /> : null}
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-medium",
                          onBench ? "bg-fg text-bg" : "bg-elevated text-fg-muted",
                        )}
                      >
                        {onBench ? "Convocado" : "Convocar"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </section>

      {slotIndex !== null ? (
        <SlotPicker
          slotLabel={slots[slotIndex]?.label ?? ""}
          allowed={slots[slotIndex]?.pos ?? []}
          players={pickerPlayers}
          lineup={tactics.lineup}
          bench={tactics.bench}
          club={club}
          notice={notice}
          onPick={(id) => {
            const err = setLineupSlot(slotIndex, id);
            if (err) {
              setNotice(err);
              return;
            }
            setNotice(null);
            setSlotIndex(null);
          }}
          onClose={() => {
            setNotice(null);
            setSlotIndex(null);
          }}
        />
      ) : null}
    </div>
  );
}

function SlotPicker({
  slotLabel,
  allowed,
  players,
  lineup,
  bench,
  club,
  notice,
  onPick,
  onClose,
}: {
  slotLabel: string;
  allowed: Player["pos"][];
  players: Player[];
  lineup: string[];
  bench: string[];
  club: ReturnType<typeof clubById>;
  notice: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium">
          Puesto {slotLabel} · {allowed.map((p) => POS_LABEL[p]).join(" / ")}
        </p>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Listo
        </Button>
      </div>
      {notice ? (
        <p role="alert" className="mb-2 rounded-lg bg-bad/15 px-3 py-2 text-sm text-bad">
          {notice}
        </p>
      ) : null}
      <ul className="max-h-56 overflow-y-auto">
        {players.map((p) => {
          const inXi = lineup.includes(p.id);
          const offPos = !canPlaySlot(p.pos, allowed);
          const blocked = isUnavailable(p);
          const reason = unavailableReason(p);
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={blocked}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-fg/5 disabled:cursor-not-allowed disabled:opacity-45",
                  offPos && !blocked && "opacity-50",
                )}
                onClick={() => {
                  if (blocked) return;
                  onPick(p.id);
                }}
              >
                <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>
                  {p.ovr}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="text-[11px] text-fg-muted">
                    {POS_LABEL[p.pos]}
                    {offPos ? " · no juega aquí" : ""}
                    {outText(p, reason)}
                    {inXi ? " · titular" : bench.includes(p.id) ? " · suplente" : ""}
                  </span>
                </span>
                {reason ? <StatusGlyph status={reason} /> : null}
                <ClubCrest club={club} size={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlayerChip({
  player,
  accent,
  ink,
  active,
  offPos,
  status,
}: {
  player: Player;
  accent: string;
  ink: string;
  active: boolean;
  offPos?: boolean;
  status: "injury" | "suspension" | null;
}) {
  return (
    <>
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-full font-display text-base tabular-nums shadow-[var(--shadow-border)]",
          active && "ring-2 ring-fg",
          offPos && !status && "opacity-55",
          status === "injury" && "ring-2 ring-bad",
          status === "suspension" && "ring-2 ring-red-600",
          (status === "illness" || status === "absence") && "ring-2 ring-fg-muted",
        )}
        style={{ background: status ? "var(--color-elevated)" : accent, color: ink }}
      >
        {status ? <StatusGlyph status={status} /> : player.ovr}
      </span>
      <span className="max-w-16 truncate rounded-sm bg-bg/75 px-1 text-center text-[10px] leading-4">
        {lastName(player.name)}
        {offPos && !status ? " !" : ""}
      </span>
      {status ? (
        <span
          className={cn(
            "rounded-sm px-1 text-center text-[9px] font-medium leading-4",
            status === "suspension" ? "bg-red-600 text-white" : "bg-bad/25 text-bad",
          )}
        >
          {statusTag(status, outGames(player, status))}
        </span>
      ) : null}
    </>
  );
}
