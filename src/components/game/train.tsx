import { Check, Dumbbell, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { POS_LABEL, formatMoney, ovrClass } from "@/lib/game/format";
import { STAT_LABEL, STAT_SHORT } from "@/lib/game/stats";
import { useGame } from "@/lib/game/store";
import {
  TRAINING_MONTHS,
  TRAINING_TIER_ORDER,
  TRAINING_TIERS,
  maxGainFor,
  planOfPlayer,
  tierInfo,
  trainingProgress,
  trainingTimeLeftLabel,
} from "@/lib/game/training";
import type {
  Player,
  TrainingPlan,
  TrainingPlayerResult,
  TrainingReport,
  TrainingTier,
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
  const plans = useGame((s) => s.trainingPlans);
  const reports = useGame((s) => s.trainingReports);
  const budget = useGame((s) => s.budget);
  const dismissReport = useGame((s) => s.dismissTrainingReport);

  const [pickerTier, setPickerTier] = useState<TrainingTier | null>(null);
  const [showReport, setShowReport] = useState(false);

  const unseen = reports.filter((r) => !r.seen);
  const reportOpen = reports.length > 0 && (unseen.length > 0 || showReport);
  const shownReports = unseen.length > 0 ? unseen : reports.slice(0, 1);
  const closeReport = () => {
    dismissReport();
    setShowReport(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-3xl font-semibold">Entrenamiento</h2>
        <p className="text-sm text-fg-muted">
          Tres niveles, todos de {TRAINING_MONTHS} meses · Caja disponible {formatMoney(budget)}
        </p>
      </header>

      {reports.length > 0 ? (
        <article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
                Último ciclo terminado · {tierInfo(reports[0]!.tier).short}
              </p>
              <p className="mt-1 truncate text-sm">{reports[0]!.results.map((r) => r.name).join(" y ")}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setShowReport(true)}>
              Ver informe
            </Button>
          </div>
        </article>
      ) : null}

      {TRAINING_TIER_ORDER.map((tier) => (
        <TierCard
          key={tier}
          tier={tier}
          plan={plans.find((p) => p.tier === tier) ?? null}
          budget={budget}
          onPick={() => setPickerTier(tier)}
        />
      ))}

      <p className="text-center text-[11px] text-fg-muted">
        El precio es por programa, no por jugador. Un jugador no puede estar en dos entrenamientos a la vez y una vez
        pagado no se puede cancelar.
      </p>

      {pickerTier ? <PlayerPicker tier={pickerTier} onClose={() => setPickerTier(null)} /> : null}
      {reportOpen ? <ReportModal reports={shownReports} onClose={closeReport} /> : null}
    </div>
  );
}

function TierCard({
  tier,
  plan,
  budget,
  onPick,
}: {
  tier: TrainingTier;
  plan: TrainingPlan | null;
  budget: number;
  onPick: () => void;
}) {
  const info = TRAINING_TIERS[tier];
  const players = useGame((s) => s.players);
  const afford = budget >= info.cost;
  const pct = plan ? Math.round(trainingProgress(plan) * 100) : 0;
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Dumbbell className="size-4 text-primary" />
            {info.name}
          </h3>
          <p className="mt-1 text-xs text-fg-muted">{info.reward}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl tabular-nums leading-none">{formatMoney(info.cost)}</p>
          <p className="mt-1 text-[11px] text-fg-muted">
            hasta {info.maxPlayers} jugadores · {TRAINING_MONTHS} meses
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-fg-muted">{info.description}</p>

      {plan ? (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">En marcha</span>
            <span className="tabular-nums text-fg-muted">faltan {trainingTimeLeftLabel(plan)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-club" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-right text-[11px] tabular-nums text-fg-muted">{pct}%</p>
          <ul className="mt-2 flex flex-col gap-2">
            {plan.assignments.map((a) => {
              const p = players.find((x) => x.id === a.playerId);
              if (!p) return null;
              return (
                <li key={a.playerId} className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2.5">
                  <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="block truncate text-[11px] text-fg-muted">
                      {POS_LABEL[p.pos]} · {p.age} años · POT {p.pot}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-fg-muted">
            {plan.cost > 0 ? `Costo pagado: ${formatMoney(plan.cost)}. ` : ""}
            El tiempo corre con cada fecha que se juega. Al terminar se aplican las mejoras.
          </p>
        </div>
      ) : (
        <>
          <Button variant="club" className="mt-4 w-full" onClick={onPick}>
            Elegir jugadores
          </Button>
          {!afford ? (
            <p className="mt-2 text-center text-[11px] text-bad">
              Te faltan {formatMoney(info.cost - budget)} para pagar este programa.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

function PlayerPicker({ tier, onClose }: { tier: TrainingTier; onClose: () => void }) {
  const info = TRAINING_TIERS[tier];
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const budget = useGame((s) => s.budget);
  const startTraining = useGame((s) => s.startTraining);
  const [chosen, setChosen] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  useModal(true, onClose);

  const save = useGame.getState();
  const squad = players
    .filter((p) => p.clubId === clubId && !p.loanFrom)
    .sort((a, b) => a.age - b.age || b.pot - a.pot);

  const toggle = (p: Player) => {
    setMsg(null);
    setChosen((cur) => {
      if (cur.includes(p.id)) return cur.filter((x) => x !== p.id);
      if (cur.length >= info.maxPlayers) {
        setMsg(`Máximo ${info.maxPlayers} jugador${info.maxPlayers === 1 ? "" : "es"} en este programa.`);
        return cur;
      }
      return [...cur, p.id];
    });
  };

  const accept = () => {
    const err = startTraining(tier, chosen);
    if (err) {
      setMsg(err);
      return;
    }
    onClose();
  };

  return (
    <div className={overlayCls} onClick={onClose} role="dialog" aria-modal="true" aria-label={info.name}>
      <div
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="min-w-0">
            <p className="font-display text-2xl font-semibold leading-none">{info.name}</p>
            <p className="mt-2 text-sm text-fg-muted">
              {formatMoney(info.cost)} · {TRAINING_MONTHS} meses · elegí hasta {info.maxPlayers}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto border-y border-border/60">
          {squad.map((p) => {
            const busy = planOfPlayer(save, p.id);
            const on = chosen.includes(p.id);
            const cap = maxGainFor(tier, p.age, p.ovr);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => toggle(p)}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-border/60 px-4 py-2.5 text-left last:border-0 disabled:opacity-40",
                    on && "bg-fg/6",
                  )}
                >
                  <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="text-[11px] text-fg-muted">
                      {POS_LABEL[p.pos]} · {p.age} años · POT {p.pot}
                      {busy ? ` · ya entrena (${tierInfo(busy.tier).short})` : ""}
                    </span>
                  </span>
                  {on ? (
                    <Check className="size-4 text-good" />
                  ) : (
                    <span className="text-[11px] tabular-nums text-fg-muted">hasta +{cap}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-col gap-2 bg-elevated p-4">
          {msg ? <p className="text-sm text-bad">{msg}</p> : null}
          <p className="text-[11px] text-fg-muted">
            El "hasta +N" es el techo para ese jugador; lo que sube de verdad depende de su edad, GRL y potencial.
          </p>
          <Button variant="club" disabled={chosen.length === 0 || budget < info.cost} onClick={accept}>
            Pagar {formatMoney(info.cost)} y entrenar {TRAINING_MONTHS} meses ({chosen.length}/{info.maxPlayers})
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ reports, onClose }: { reports: TrainingReport[]; onClose: () => void }) {
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
          <div className="mt-4 flex flex-col gap-5">
            {reports.map((report) => (
              <section key={report.id}>
                <p className="mb-2 text-sm font-medium">
                  {tierInfo(report.tier).name}
                  <span className="ml-2 text-xs font-normal text-fg-muted">
                    {report.cost > 0 ? `Pagaste ${formatMoney(report.cost)}` : "Ciclo anterior a los niveles"}
                  </span>
                </p>
                <div className="flex flex-col gap-3">
                  {report.results.map((r) => (
                    <ResultCard key={r.playerId} r={r} />
                  ))}
                </div>
              </section>
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
          ? `¡Subió su potencial! POT ${r.potBefore} → ${r.potAfter} (${signed(dPot)})`
          : `Potencial sin cambios · POT ${r.potAfter}`}
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
    </article>
  );
}
