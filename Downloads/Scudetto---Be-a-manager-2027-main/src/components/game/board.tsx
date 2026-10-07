import { Check, ChevronRight, Target, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { boardLabel, boardTone, fmtDelta, goalHint } from "@/lib/game/board";
import { clamp } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";
import type { BoardGoal } from "@/lib/game/types";

function toneColor(confidence: number) {
  const t = boardTone(confidence);
  return t === "good" ? "var(--color-good)" : t === "warn" ? "var(--color-warn)" : "var(--color-bad)";
}

const WEIGHT_LABEL: Record<BoardGoal["weight"], string> = {
  3: "Principal",
  2: "Importante",
  1: "Secundario",
};

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      className={cn("h-2 overflow-hidden rounded-full bg-elevated", className)}
      role="progressbar"
      aria-label="Confianza de la dirigencia"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${clamp(value, 0, 100)}%`, background: toneColor(value) }}
      />
    </div>
  );
}

function GoalIcon({ state }: { state: BoardGoal["state"] }) {
  if (state === "met") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--color-good) 22%, transparent)", color: "var(--color-good)" }}
      >
        <Check className="size-3.5" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: "color-mix(in oklab, var(--color-bad) 22%, transparent)", color: "var(--color-bad)" }}
      >
        <X className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevated text-fg-muted">
      <Target className="size-3.5" />
    </span>
  );
}

function GoalList({ showWeight = false }: { showWeight?: boolean }) {
  const save = useGame((s) => s);
  const goals = save.board?.goals ?? [];
  return (
    <ul className="flex flex-col gap-2">
      {goals.map((g) => (
        <li key={g.id} className="flex items-start gap-3 rounded-xl bg-elevated px-3 py-2.5">
          <GoalIcon state={g.state} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">{g.label}</p>
            <p
              className="mt-0.5 text-[11px]"
              style={{
                color:
                  g.state === "met"
                    ? "var(--color-good)"
                    : g.state === "failed"
                      ? "var(--color-bad)"
                      : "var(--color-fg-muted)",
              }}
            >
              {goalHint(save, g)}
              {showWeight ? ` · ${WEIGHT_LABEL[g.weight]}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pantalla completa del apartado: confianza, objetivos y últimos movimientos. */
export function BoardView() {
  const board = useGame((s) => s.board);
  if (!board) {
    return (
      <p className="rounded-2xl bg-surface p-5 text-sm text-fg-muted shadow-[var(--shadow-border)]">
        La dirigencia todavía no fijó objetivos.
      </p>
    );
  }
  const c = Math.round(board.confidence);
  const diffSinceStart = Math.round(board.confidence - board.start);
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted">Dirigencia</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-6xl font-semibold leading-none tabular-nums" style={{ color: toneColor(c) }}>
              {c}
              <span className="text-2xl text-fg-muted">/100</span>
            </p>
            <p className="mt-2 text-sm font-medium">{boardLabel(c)}</p>
          </div>
          <p className="pb-1 text-right text-xs text-fg-muted">
            Arrancó la temporada en {Math.round(board.start)}
            <br />
            {diffSinceStart === 0
              ? "Sin cambios"
              : `${diffSinceStart > 0 ? "+" : "−"}${Math.abs(diffSinceStart)} en lo que va`}
          </p>
        </div>
        <ConfidenceBar value={board.confidence} className="mt-4 h-3" />
        <div className="mt-1 flex justify-between text-[10px] text-fg-subtle">
          <span>0</span>
          <span>100</span>
        </div>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="mb-1 text-sm font-medium">Objetivos de la temporada</h3>
        <p className="mb-3 text-xs text-fg-muted">
          Los fijó la dirigencia al arrancar según lo que se espera del club. Cumplirlos sube la confianza; incumplirlos la
          hunde.
        </p>
        <GoalList showWeight />
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="mb-3 text-sm font-medium">Qué mueve la barra</h3>
        <div className="grid gap-3 text-xs text-fg-muted sm:grid-cols-2">
          <div>
            <p className="mb-1 font-medium" style={{ color: "var(--color-good)" }}>
              Suma
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Victorias, más aún ante rivales de mayor jerarquía</li>
              <li>Ganar finales, semifinales y cruces de eliminación</li>
              <li>Ganar un clásico o derbi (un extra moderado, con tope por temporada)</li>
              <li>Cortar una mala racha</li>
              <li>Cumplir cada objetivo</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium" style={{ color: "var(--color-bad)" }}>
              Resta
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Derrotas, más aún ante rivales inferiores</li>
              <li>Perder partidos importantes: finales, eliminatorias, rivales directos</li>
              <li>Rachas de derrotas o partidos sin ganar</li>
              <li>Ir lejos del objetivo de liga y no cumplir los demás</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-fg-subtle">
          Al cerrar la temporada la confianza se arrastra a medias a la siguiente, y la valoración del DT que mueve las
          ofertas de otros clubes también la tiene en cuenta.
        </p>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="mb-3 text-sm font-medium">Últimos movimientos</h3>
        {board.log.length === 0 ? (
          <p className="text-xs text-fg-muted">Todavía no hubo cambios esta temporada.</p>
        ) : (
          <ul className="divide-y divide-border">
            {board.log.slice(0, 10).map((e) => (
              <li key={e.id} className="flex items-start gap-3 py-2">
                <span
                  className="w-12 shrink-0 text-right font-display text-lg tabular-nums"
                  style={{ color: e.delta >= 0 ? "var(--color-good)" : "var(--color-bad)" }}
                >
                  {fmtDelta(e.delta)}
                </span>
                <p className="min-w-0 flex-1 text-xs text-fg-muted">{e.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Tarjeta resumida para el Despacho. */
export function BoardCard() {
  const board = useGame((s) => s.board);
  const setScreen = useGame((s) => s.setScreen);
  if (!board) return null;
  const c = Math.round(board.confidence);
  const met = board.goals.filter((g) => g.state === "met").length;
  const failed = board.goals.filter((g) => g.state === "failed").length;
  return (
    <button
      type="button"
      onClick={() => setScreen("board")}
      className="w-full rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-border)]"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-muted">Confianza de la dirigencia</p>
          <p className="font-display text-4xl font-semibold leading-none tabular-nums" style={{ color: toneColor(c) }}>
            {c}
            <span className="ml-1 text-base text-fg-muted">{boardLabel(c)}</span>
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-fg-muted" />
      </div>
      <ConfidenceBar value={board.confidence} className="mt-3" />
      <p className="mt-2 text-xs text-fg-muted">
        Objetivos: {met} cumplido{met === 1 ? "" : "s"}
        {failed ? ` · ${failed} incumplido${failed === 1 ? "" : "s"}` : ""} · {board.goals.length - met - failed} en juego
      </p>
    </button>
  );
}

/** Efecto del último partido sobre la dirigencia (pantalla de resultado). */
export function BoardMatchNote() {
  const last = useGame((s) => s.board?.last ?? null);
  if (!last || last.lines.length === 0) return null;
  const up = last.delta >= 0;
  return (
    <section className="rounded-2xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Dirigencia</p>
        <p className="font-display text-xl tabular-nums" style={{ color: up ? "var(--color-good)" : "var(--color-bad)" }}>
          {last.confidence}/100 <span className="text-sm">({fmtDelta(last.delta)})</span>
        </p>
      </div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-fg-muted">
        {last.lines.map((l, i) => (
          <li key={`${i}-${l}`}>{l}</li>
        ))}
      </ul>
    </section>
  );
}

/** Balance final de la temporada (pantalla de fin de temporada). */
export function BoardBalance() {
  const board = useGame((s) => s.board);
  if (!board) return null;
  const c = Math.round(board.confidence);
  const met = board.goals.filter((g) => g.state === "met").length;
  return (
    <div className="mt-6">
      <div className="mb-1 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-fg-muted">Dirigencia</p>
        <p className="text-xs tabular-nums text-fg-muted">
          {boardLabel(c)} · {c}/100
          {board.last && board.last.delta !== 0 ? ` (${fmtDelta(board.last.delta)} en el cierre)` : ""}
        </p>
      </div>
      <ConfidenceBar value={board.confidence} />
      <p className="mb-2 mt-1 text-[11px] text-fg-muted">
        {met} de {board.goals.length} objetivos cumplidos. Arrancaste la temporada en {Math.round(board.start)}.
      </p>
      <GoalList />
    </div>
  );
}
