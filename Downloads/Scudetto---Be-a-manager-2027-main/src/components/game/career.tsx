import { Briefcase, Trophy } from "lucide-react";
import { useMemo } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { careerSeasons, careerTotals, untrackedTrophySeasons } from "@/lib/game/career";
import { clubById } from "@/lib/game/clubs";
import { seasonLabel } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold tabular-nums leading-none">{value}</p>
      {sub ? <p className="mt-2 text-xs text-fg-muted">{sub}</p> : null}
    </article>
  );
}

/** Historial de carrera: totales del manager y resumen de cada temporada dirigida. */
export function CareerView() {
  const save = useGame((s) => s);
  const setScreen = useGame((s) => s.setScreen);
  const seasons = useMemo(() => careerSeasons(save), [save]);
  const totals = useMemo(() => careerTotals(save, seasons), [save, seasons]);
  const untracked = useMemo(() => untrackedTrophySeasons(save, seasons), [save, seasons]);
  const rows = [...seasons].reverse();
  const pct = totals.winRate.toFixed(1).replace(".", ",");

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted">Manager</p>
          <h2 className="font-display text-3xl font-semibold">Historial de carrera</h2>
        </div>
        <Button variant="ghost" onClick={() => setScreen("office")}>
          Despacho
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Partidos" value={totals.played} sub={`${totals.gf} goles a favor · ${totals.ga} en contra`} />
        <Stat label="Ganados" value={totals.won} />
        <Stat label="Empatados" value={totals.drawn} />
        <Stat label="Perdidos" value={totals.lost} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Victorias" value={`${pct} %`} sub="del total de partidos" />
        <Stat label="Clubes dirigidos" value={totals.clubs.length} />
        <Stat label="Temporadas" value={totals.seasons} />
        <Stat label="Títulos" value={totals.titles} />
      </div>

      {totals.clubs.length > 0 ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Briefcase className="size-4 text-primary" />
            Clubes
          </h3>
          <ul className="flex flex-wrap gap-2">
            {totals.clubs.map((id) => {
              const c = clubById(id);
              return (
                <li key={id} className="flex items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-sm">
                  <ClubCrest club={c} size={20} />
                  {c.name}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Temporada por temporada</h3>
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-surface p-4 text-sm text-fg-muted shadow-[var(--shadow-border)]">
            Todavía no hay temporadas jugadas.
          </p>
        ) : (
          rows.map((r) => {
            const club = clubById(r.clubId);
            return (
              <article
                key={`${r.season}-${r.clubId}`}
                className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]"
              >
                <div className="flex items-start gap-3">
                  <ClubCrest club={club} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-xl font-semibold leading-tight">{seasonLabel(r.season)}</p>
                    <p className="truncate text-sm text-fg-muted">
                      {club.name}
                      {r.live ? (r.finished ? " · temporada terminada" : " · en curso") : ""}
                      {r.sacked ? " · despedido" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-2xl font-semibold tabular-nums leading-none">
                      {r.place ? `${r.place}º` : "—"}
                    </p>
                    <p className="text-[11px] text-fg-muted">{r.live && !r.finished ? "posición actual" : "posición final"}</p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["PJ", r.played, ""],
                    ["G", r.won, "var(--color-good)"],
                    ["E", r.drawn, "var(--color-warn)"],
                    ["P", r.lost, "var(--color-bad)"],
                  ].map(([k, v, color]) => (
                    <div key={String(k)} className="rounded-xl bg-elevated py-2">
                      <dt className="text-[11px] text-fg-muted">{k}</dt>
                      <dd className="font-display text-xl tabular-nums" style={color ? { color: String(color) } : undefined}>
                        {v}
                      </dd>
                    </div>
                  ))}
                </dl>

                {r.titles.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1">
                    {r.titles.map((t) => (
                      <li key={t} className="flex items-center gap-2 text-sm font-medium">
                        <Trophy className="size-4 text-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs text-fg-subtle">Sin títulos esta temporada.</p>
                )}

                {r.highlights.length > 0 ? (
                  <ul className={cn("mt-2 list-disc space-y-0.5 pl-5 text-xs text-fg-muted")}>
                    {r.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })
        )}
      </section>

      {untracked.length > 0 ? (
        <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h3 className="text-sm font-medium">Temporadas anteriores sin detalle</h3>
          <p className="mt-1 text-xs text-fg-muted">
            Se jugaron antes de que existiera este historial, así que solo se conservan los títulos.
          </p>
          <ul className="mt-3 divide-y divide-border">
            {untracked.map((u) => (
              <li key={u.season} className="flex items-start justify-between gap-3 py-2 text-sm">
                <span className="text-fg-muted">{seasonLabel(u.season)}</span>
                <span className="text-right">{u.titles.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Tarjeta resumen para el Despacho: lleva al historial completo. */
export function CareerCard() {
  const save = useGame((s) => s);
  const setScreen = useGame((s) => s.setScreen);
  const totals = useMemo(() => careerTotals(save), [save]);
  return (
    <button
      type="button"
      onClick={() => setScreen("career")}
      className="rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-border)]"
    >
      <p className="text-xs text-fg-muted">Historial de carrera</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums leading-none">
        {totals.won}G · {totals.drawn}E · {totals.lost}P
      </p>
      <p className="mt-2 text-xs text-fg-muted">
        {totals.seasons} {totals.seasons === 1 ? "temporada" : "temporadas"} · {totals.titles}{" "}
        {totals.titles === 1 ? "título" : "títulos"} · Ver historial →
      </p>
    </button>
  );
}
