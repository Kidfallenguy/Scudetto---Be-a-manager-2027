import { Check, Dumbbell, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { POS_LABEL, ovrClass } from "@/lib/game/format";
import { STAT_LABEL, STAT_SHORT, getStat, statKeysFor } from "@/lib/game/stats";
import { useGame } from "@/lib/game/store";
import {
  MAX_STATS_PER_PLAYER,
  MAX_TRAINED_PLAYERS,
  TRAINING_MONTHS,
  trainingMonthsLeft,
  trainingProgress,
} from "@/lib/game/training";
import type {
  Player,
  TrainStat,
  TrainingAssignment,
  TrainingPlayerResult,
  TrainingReport,
} from "@/lib/game/types";

function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "=";
}

function deltaClass(n: number) {
  return n > 0 ? "text-good" : n < 0 ? "text-bad" : "text-fg-muted";
}

/** Bloquea el scroll del fondo y cierra con Escape mientras hay un cartel abierto. */
function useModal(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
}

const overlayCls =
  "fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:p-4";

export function TrainView() {
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const plan = useGame((s) => s.trainingPlan);
  const report = useGame((s) => s.trainingReport);
  const startTraining = useGame((s) => s.startTraining);
  const dismissReport = useGame((s) => s.dismissTrainingReport);

  const [draft, setDraft] = useState<TrainingAssignment[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const squad = players
    .filter((p) => p.clubId === clubId && !p.loanFrom)
    .sort((a, b) => a.age - b.age || b.pot - a.pot);
  const byId = (id: string) => players.find((p) => p.id === id);
  const editingPlayer = editing ? (byId(editing) ?? null) : null;

  const reportOpen = Boolean(report) && (!report!.seen || showReport);
  const closeReport = () => {
    dismissReport();
    setShowReport(false);
  };

  const open = (p: Player) => {
    const inDraft = draft.some((d) => d.playerId === p.id);
    if (!inDraft && draft.length >= MAX_TRAINED_PLAYERS) {
      setMsg(
        `Ya elegiste ${MAX_TRAINED_PLAYERS} jugadores. Tocá uno de los elegidos para cambiarlo o quitarlo.`,
      );
      return;
    }
    setMsg(null);
    setEditing(p.id);
  };

  const saveStats = (playerId: string, stats: TrainStat[]) => {
    setDraft((d) => {
      const idx = d.findIndex((x) => x.playerId === playerId);
      const next = { playerId, stats };
      if (idx >= 0) {
        const copy = [...d];
        copy[idx] = next;
        return copy;
      }
      return [...d, next];
    });
    setEditing(null);
  };

  const removeFromDraft = (playerId: string) => {
    setDraft((d) => d.filter((x) => x.playerId !== playerId));
    setEditing(null);
  };

  const accept = () => {
    const err = startTraining(draft);
    if (err) {
      setMsg(err);
      return;
    }
    setDraft([]);
    setMsg(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-3xl font-semibold">Entrenamiento</h2>
        <p className="text-sm text-fg-muted">
          {plan
            ? `Ciclo en marcha · dura ${TRAINING_MONTHS} meses de juego`
            : `Elegí hasta ${MAX_TRAINED_PLAYERS} jugadores y hasta ${MAX_STATS_PER_PLAYER} estadísticas de cada uno · el ciclo dura ${TRAINING_MONTHS} meses`}
        </p>
      </header>

      {plan ? <ActivePlan /> : null}

      {report && !plan ? (
        <article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
                Último ciclo terminado
              </p>
              <p className="mt-1 truncate text-sm">{report.results.map((r) => r.name).join(" y ")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowReport(true)}>
              Ver informe
            </Button>
          </div>
        </article>
      ) : null}

      {!plan ? (
        <>
          <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Dumbbell className="size-4 text-primary" />
                Tu plan
              </h3>
              <span className="text-xs tabular-nums text-fg-muted">
                {draft.length}/{MAX_TRAINED_PLAYERS} jugadores
              </span>
            </div>
            {draft.length === 0 ? (
              <p className="mt-3 text-sm text-fg-muted">
                Tocá un jugador de la lista para elegir qué estadísticas va a trabajar.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {draft.map((d) => {
                  const p = byId(d.playerId);
                  if (!p) return null;
                  return (
                    <li key={d.playerId}>
                      <button
                        type="button"
                        onClick={() => setEditing(d.playerId)}
                        className="flex w-full items-center gap-3 rounded-xl bg-elevated px-3 py-2.5 text-left"
                      >
                        <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>
                          {p.ovr}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{p.name}</span>
                          <span className="block truncate text-[11px] text-fg-muted">
                            {d.stats.map((s) => STAT_LABEL[s]).join(" · ")}
                          </span>
                        </span>
                        <span className="text-[11px] text-fg-muted">Editar</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {msg ? <p className="mt-3 text-sm text-bad">{msg}</p> : null}
            <Button
              variant="club"
              className="mt-4 w-full"
              disabled={draft.length === 0}
              onClick={accept}
            >
              Aceptar y entrenar {TRAINING_MONTHS} meses
            </Button>
            <p className="mt-2 text-center text-[11px] text-fg-muted">
              Una vez aceptado no se puede cambiar hasta que termine el ciclo.
            </p>
          </section>

          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            {squad.map((p) => {
              const chosen = draft.find((d) => d.playerId === p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => open(p)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0",
                      chosen && "bg-fg/6",
                    )}
                  >
                    <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>
                      {p.ovr}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      <span className="text-[11px] text-fg-muted">
                        {POS_LABEL[p.pos]} · {p.age} años · POT {p.pot}
                        {p.injured > 0 || p.suspended > 0 || (p.absence?.games ?? 0) > 0 ? " · baja" : ""}
                      </span>
                    </span>
                    {chosen ? (
                      <span className="flex items-center gap-1 text-xs text-good">
                        <Check className="size-3.5" />
                        {chosen.stats.length}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {editingPlayer ? (
        <StatPicker
          key={editingPlayer.id}
          player={editingPlayer}
          initial={draft.find((d) => d.playerId === editingPlayer.id)?.stats ?? []}
          inDraft={draft.some((d) => d.playerId === editingPlayer.id)}
          onSave={(stats) => saveStats(editingPlayer.id, stats)}
          onRemove={() => removeFromDraft(editingPlayer.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {reportOpen && report ? <ReportModal report={report} onClose={closeReport} /> : null}
    </div>
  );
}

function ActivePlan() {
  const plan = useGame((s) => s.trainingPlan);
  const players = useGame((s) => s.players);
  if (!plan) return null;
  const pct = Math.round(trainingProgress(plan) * 100);
  const left = trainingMonthsLeft(plan);
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Dumbbell className="size-4 text-primary" />
          Entrenando
        </h3>
        <span className="text-xs tabular-nums text-fg-muted">
          faltan ~{left} mes{left === 1 ? "" : "es"}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-fg/10">
        <div className="h-full rounded-full bg-club" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-right text-[11px] tabular-nums text-fg-muted">{pct}%</p>
      <ul className="mt-3 flex flex-col gap-2">
        {plan.assignments.map((a) => {
          const p = players.find((x) => x.id === a.playerId);
          if (!p) return null;
          return (
            <li key={a.playerId} className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2.5">
              <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-[11px] text-fg-muted">
                  {a.stats.map((s) => STAT_LABEL[s]).join(" · ")}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-fg-muted">
        El tiempo corre con cada fecha que se juega. Cuando termine te avisamos y vas a ver el informe acá.
      </p>
    </section>
  );
}

function StatPicker({
  player,
  initial,
  inDraft,
  onSave,
  onRemove,
  onClose,
}: {
  player: Player;
  initial: TrainStat[];
  inDraft: boolean;
  onSave: (stats: TrainStat[]) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<TrainStat[]>(initial);
  useModal(true, onClose);
  const keys = statKeysFor(player.pos);
  const toggle = (k: TrainStat) =>
    setStats((cur) =>
      cur.includes(k)
        ? cur.filter((x) => x !== k)
        : cur.length >= MAX_STATS_PER_PLAYER
          ? cur
          : [...cur, k],
    );
  return (
    <div
      className={overlayCls}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Entrenar a ${player.name}`}
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-3xl font-semibold leading-none">{player.name}</p>
              <p className="mt-2 text-sm text-fg-muted">
                {POS_LABEL[player.pos]} · {player.age} años · GRL {player.ovr} · POT {player.pot}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar">
              <X />
            </Button>
          </div>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
            Elegí hasta {MAX_STATS_PER_PLAYER} estadísticas ({stats.length}/{MAX_STATS_PER_PLAYER})
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {keys.map((k) => {
              const on = stats.includes(k);
              const full = !on && stats.length >= MAX_STATS_PER_PLAYER;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={full}
                  onClick={() => toggle(k)}
                  className={cn(
                    "flex h-14 items-center justify-between rounded-xl px-3 text-left shadow-[var(--shadow-border)] transition-opacity disabled:opacity-40",
                    on ? "bg-club text-club-fg" : "bg-surface hover:bg-fg/6",
                  )}
                >
                  <span className="text-sm font-medium">{STAT_LABEL[k]}</span>
                  <span className="font-display text-xl tabular-nums">{getStat(player, k)}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-fg-muted">
            Con menos estadísticas el trabajo rinde más. Los jóvenes mejoran más; pasados los 30 el cuerpo empieza a
            perder en lo que no se entrena.
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-elevated p-4">
          <Button variant="club" disabled={stats.length === 0} onClick={() => onSave(stats)}>
            {inDraft ? "Guardar cambios" : "Agregar al plan"}
          </Button>
          {inDraft ? (
            <Button variant="outline" onClick={onRemove}>
              Quitar del plan
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReportModal({ report, onClose }: { report: TrainingReport; onClose: () => void }) {
  useModal(true, onClose);
  return (
    <div
      className={overlayCls}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Informe de entrenamiento"
    >
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5 pb-3">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
            <Sparkles className="size-3.5" />
            Entrenamiento terminado
          </p>
          <h3 className="mt-1 font-display text-3xl font-semibold leading-none">Así quedaron</h3>
          <div className="mt-4 flex flex-col gap-3">
            {report.results.map((r) => (
              <ResultCard key={r.playerId} r={r} />
            ))}
          </div>
        </div>
        <div className="border-t border-border bg-elevated p-4">
          <Button variant="club" className="w-full" onClick={onClose}>
            Entendido
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ r }: { r: TrainingPlayerResult }) {
  if (r.left) {
    return (
      <article className="rounded-xl bg-surface p-3">
        <p className="font-medium">{r.name}</p>
        <p className="mt-1 text-sm text-fg-muted">Ya no estaba en el club al terminar el ciclo.</p>
      </article>
    );
  }
  const dOvr = r.ovrAfter - r.ovrBefore;
  const dPot = r.potAfter - r.potBefore;
  return (
    <article className="rounded-xl bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="text-[11px] text-fg-muted">
            {POS_LABEL[r.pos]} · {r.age} años
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl tabular-nums leading-none">
            <span className="text-fg-muted">{r.ovrBefore}</span>
            <span className="px-1 text-fg-muted">→</span>
            <span className={ovrClass(r.ovrAfter)}>{r.ovrAfter}</span>
          </p>
          <p className={cn("mt-1 text-xs font-medium tabular-nums", deltaClass(dOvr))}>
            {dOvr > 0
              ? `GRL subió ${dOvr}`
              : dOvr < 0
                ? `GRL bajó ${Math.abs(dOvr)}`
                : "GRL sin cambios"}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "mt-3 rounded-lg px-3 py-2 text-sm",
          r.brokePotential ? "bg-good/15 text-good" : "bg-fg/5 text-fg-muted",
        )}
      >
        {r.brokePotential
          ? `¡Rompió su potencial! POT ${r.potBefore} → ${r.potAfter} (${signed(dPot)})`
          : `No rompió su potencial · POT ${r.potAfter}`}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2">
        {r.changes.map((c) => {
          const d = c.after - c.before;
          return (
            <li key={c.stat} className="rounded-lg bg-elevated px-2.5 py-2">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-fg-muted">
                {c.trained ? <Dumbbell className="size-3 text-primary" /> : null}
                {STAT_SHORT[c.stat]} · {STAT_LABEL[c.stat]}
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-fg-muted">{c.before}</span>
                <span className="text-fg-muted">→</span>
                <span className="font-display text-lg">{c.after}</span>
                <span className={cn("text-xs font-medium", deltaClass(d))}>{signed(d)}</span>
              </p>
            </li>
          );
        })}
      </ul>
      {r.changes.some((c) => !c.trained) ? (
        <p className="mt-2 text-[11px] text-fg-muted">
          Las estadísticas sin el ícono de pesa bajaron por la edad, no por el entrenamiento.
        </p>
      ) : null}
    </article>
  );
}
