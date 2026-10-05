import { useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { cn } from "@/lib/cn";
import {
  allWinnersHistory,
  awardSeasonLabel,
  hasAwardHistory,
  nomineeLabel,
  playerAwardHistory,
} from "@/lib/game/award-history";
import type { AwardKind } from "@/lib/game/awards";
import { clubById } from "@/lib/game/clubs";
import { useGame } from "@/lib/game/store";

// ---------------------------------------------------------------------------
// Vistas del historial de premios (solo lectura, salen de `save.awards`):
//  · PlayerAwardsSection: dentro del perfil de un jugador.
//  · AwardsHallOfFame: historial general de ganadores de cada premio (pestaña "Premios" de la Vitrina).
// ---------------------------------------------------------------------------

const ord = (n: number) => `${n}.º`;

/** Cuántas nominaciones importantes se listan en el perfil (el resto se resume). */
const MAX_NOMINATIONS_SHOWN = 6;

// ── Perfil del jugador ──────────────────────────────────────────────────────

export function PlayerAwardsSection({ playerId }: { playerId: string }) {
  const awards = useGame((s) => s.awards);
  const history = useMemo(() => playerAwardHistory(awards, playerId), [awards, playerId]);
  const { lines, totalWins, important, totalNominations } = history;

  if (!lines.length && !important.length) {
    return (
      <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-fg-muted">
        Premios individuales: todavía no ganó ni fue nominado a ninguno de los principales.
      </p>
    );
  }

  return (
    <section className="mt-3 rounded-lg bg-surface px-3 py-3" aria-label="Historial de premios">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Premios individuales</h4>
        <p className="text-[11px] tabular-nums text-fg-muted">
          {totalWins} ganado{totalWins === 1 ? "" : "s"} · {totalNominations} nominacion{totalNominations === 1 ? "" : "es"}
        </p>
      </div>

      {lines.length ? (
        <ul className="mt-2 space-y-1.5">
          {lines.map((l) => (
            <li key={l.kind} className="flex items-start justify-between gap-3 text-sm">
              <span className="shrink-0 font-medium">
                {l.name}
                <span className="ml-1.5 font-display text-base tabular-nums text-warn">×{l.count}</span>
              </span>
              <span className="text-right text-[13px] tabular-nums text-fg-muted">
                {l.wins.map((w) => w.label).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-fg-muted">Todavía no ganó ningún premio.</p>
      )}

      {important.length ? (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Nominaciones importantes</p>
          <ul className="mt-1.5 space-y-1">
            {important.slice(0, MAX_NOMINATIONS_SHOWN).map((n) => (
              <li key={`${n.kind}:${n.season}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span>
                  {n.name} <span className="tabular-nums text-fg-muted">{n.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-fg-muted">
                  {ord(n.rank)} de {n.total}
                </span>
              </li>
            ))}
          </ul>
          {important.length > MAX_NOMINATIONS_SHOWN ? (
            <p className="mt-1 text-[11px] text-fg-subtle">
              y {important.length - MAX_NOMINATIONS_SHOWN} más
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── Historial general ───────────────────────────────────────────────────────

export function AwardsHallOfFame() {
  const awards = useGame((s) => s.awards);
  const all = useMemo(() => allWinnersHistory(awards), [awards]);
  const [kind, setKind] = useState<AwardKind>("balon_oro");
  const current = all.find((a) => a.kind === kind) ?? all[0]!;

  if (!hasAwardHistory(awards)) {
    return (
      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="text-sm font-medium">Premios individuales</h3>
        <p className="mt-2 text-sm text-fg-muted">
          Todavía no se entregó ningún premio. Los ganadores de cada temporada quedan registrados acá después de la gala de
          fin de año.
        </p>
      </section>
    );
  }

  const leaders = current.leaders.filter((l) => l.count >= 2).slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Premios">
        {all.map((a) => (
          <button
            key={a.kind}
            type="button"
            role="tab"
            aria-selected={a.kind === kind}
            onClick={() => setKind(a.kind)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs transition-colors",
              a.kind === kind ? "bg-club text-club-fg" : "bg-surface text-fg-muted shadow-[var(--shadow-border)] hover:text-fg",
            )}
          >
            {a.name}
            <span className="ml-1.5 tabular-nums opacity-70">{a.rows.length}</span>
          </button>
        ))}
      </div>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="font-display text-2xl font-semibold leading-none">{current.name}</h3>
        <p className="mt-1.5 text-xs text-fg-muted">{current.description}</p>

        {leaders.length ? (
          <div className="mt-3 rounded-lg bg-elevated px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-fg-subtle">Más veces ganado</p>
            <ul className="mt-1 space-y-0.5">
              {leaders.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{l.name}</span>
                  <span className="shrink-0 tabular-nums text-fg-muted">
                    <span className="font-display text-base text-warn">×{l.count}</span>{" "}
                    {l.seasons.map((s) => awardSeasonLabel(s, l.clubId)).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {current.rows.length ? (
          <ul className="mt-3 divide-y divide-border">
            {current.rows.map((r) => {
              const club = clubById(r.winner.clubId);
              return (
                <li key={r.season} className="py-1">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center gap-3 py-2 [&::-webkit-details-marker]:hidden">
                      <span className="w-14 shrink-0 text-sm tabular-nums text-fg-muted">{r.label}</span>
                      <ClubCrest club={club} size={28} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {r.winnerName}
                          {r.timesWon > 1 ? (
                            <span className="ml-1.5 text-[11px] font-normal text-warn">{ord(r.timesWon)} título</span>
                          ) : null}
                        </span>
                        <span className="block truncate text-[11px] text-fg-muted">
                          {club.name}
                          {r.winner.detail ? ` · ${r.winner.detail}` : ""}
                        </span>
                      </span>
                      <span className="text-fg-subtle transition-transform group-open:rotate-90" aria-hidden>
                        ›
                      </span>
                    </summary>
                    {r.others.length ? (
                      <ol className="mb-2 ml-[4.25rem] space-y-1 text-[13px]">
                        {r.others.map((n, i) => (
                          <li key={n.id} className="flex gap-2 text-fg-muted">
                            <span className="w-7 tabular-nums">{ord(i + 2)}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {nomineeLabel(current.kind, n)}
                              <span className="text-fg-subtle"> · {clubById(n.clubId).name}</span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">Este premio todavía no se entregó.</p>
        )}
        <p className="mt-2 text-[11px] text-fg-subtle">
          Tocá una temporada para ver los demás nominados. Solo se muestran las temporadas con gala de premios.
        </p>
      </section>
    </div>
  );
}
