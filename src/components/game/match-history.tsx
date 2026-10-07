import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { cn } from "@/lib/cn";
import { clubById } from "@/lib/game/clubs";
import { compLabel } from "@/lib/game/competitions";
import { seasonLabel } from "@/lib/game/format";
import { userMatchHistory, type MatchOutcome } from "@/lib/game/selectors";
import { useGame } from "@/lib/game/store";
import type { Competition } from "@/lib/game/types";

const OUTCOME_COLOR: Record<MatchOutcome, string> = {
  W: "var(--color-good)",
  D: "var(--color-warn)",
  L: "var(--color-bad)",
};
const OUTCOME_CHIP: Record<MatchOutcome, string> = { W: "G", D: "E", L: "P" };
const OUTCOME_WORD: Record<MatchOutcome, string> = { W: "Victoria", D: "Empate", L: "Derrota" };

/** Historial completo de la temporada: rival, marcador y resultado de cada partido (liga, copas y continentales). */
export function MatchHistoryModal({ onClose }: { onClose: () => void }) {
  const save = useGame((s) => s);
  const userLeague = clubById(save.clubId).league;
  const [filter, setFilter] = useState<Competition | "all">("all");
  const all = useMemo(() => userMatchHistory(save), [save]);
  const comps = useMemo(() => [...new Set(all.map((m) => m.competition))], [all]);
  const shown = filter === "all" ? all : all.filter((m) => m.competition === filter);
  // Lo más reciente arriba.
  const rows = [...shown].reverse();

  const won = shown.filter((m) => m.outcome === "W").length;
  const drawn = shown.filter((m) => m.outcome === "D").length;
  const lost = shown.filter((m) => m.outcome === "L").length;
  const gf = shown.reduce((n, m) => n + m.goalsFor, 0);
  const ga = shown.reduce((n, m) => n + m.goalsAgainst, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-bg/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Historial de partidos"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-elevated p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
              {seasonLabel(save.season)}
            </p>
            <h3 className="font-display text-2xl font-semibold leading-none">Historial de partidos</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-full bg-surface text-fg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {all.length === 0 ? (
          <p className="mt-6 pb-4 text-sm text-fg-muted">Todavía no jugaste ningún partido esta temporada.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-5 gap-2 text-center">
              {[
                ["PJ", shown.length],
                ["G", won],
                ["E", drawn],
                ["P", lost],
                ["GF-GC", `${gf}-${ga}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-surface px-1 py-2">
                  <p className="font-display text-xl tabular-nums leading-none">{value}</p>
                  <p className="mt-1 text-[10px] text-fg-muted">{label}</p>
                </div>
              ))}
            </div>

            {comps.length > 1 ? (
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                {(["all", ...comps] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilter(c)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs",
                      filter === c ? "bg-primary text-bg" : "bg-surface text-fg-muted",
                    )}
                  >
                    {c === "all" ? "Todas" : compLabel(c, userLeague)}
                  </button>
                ))}
              </div>
            ) : null}

            <ul className="mt-3 flex flex-col gap-2 overflow-y-auto">
              {rows.map((m) => {
                const opp = clubById(m.opponentId);
                return (
                  <li key={m.id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-bg"
                      style={{ background: OUTCOME_COLOR[m.outcome] }}
                      title={OUTCOME_WORD[m.outcome]}
                    >
                      {OUTCOME_CHIP[m.outcome]}
                    </span>
                    <ClubCrest club={opp} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {m.home ? "vs" : "@"} {opp.name}
                      </p>
                      <p className="truncate text-[11px] text-fg-muted">
                        {compLabel(m.competition, userLeague)} · {m.title}
                        {m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-xl tabular-nums leading-none">
                        {m.goalsFor}–{m.goalsAgainst}
                      </p>
                      <p className="mt-1 text-[10px]" style={{ color: OUTCOME_COLOR[m.outcome] }}>
                        {OUTCOME_WORD[m.outcome]}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
