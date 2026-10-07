import { useState } from "react";
import { Trophy } from "lucide-react";
import { AwardsHallOfFame } from "@/components/game/award-history-view";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { clubById } from "@/lib/game/clubs";
import { NAT_LABEL, POS_LABEL, formatMoney, ovrClass } from "@/lib/game/format";
import { honourKinds, honourLabel } from "@/lib/game/honours";
import { useGame } from "@/lib/game/store";

export function Cabinet() {
  const honours = useGame((s) => s.honours);
  const careerTrophies = useGame((s) => s.careerTrophies);
  const players = useGame((s) => s.players);
  const clubId = useGame((s) => s.clubId);
  const setScreen = useGame((s) => s.setScreen);
  const league = clubById(clubId).league;
  const [tab, setTab] = useState<"vitrina" | "premios" | "stats">("vitrina");
  const squad = players
    .filter((p) => p.clubId === clubId || p.loanFrom === clubId)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || b.ovr - a.ovr);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted">Club</p>
          <h2 className="font-display text-3xl font-semibold">Vitrina</h2>
        </div>
        <Button variant="ghost" onClick={() => setScreen("office")}>
          Despacho
        </Button>
      </header>

      <div className="flex gap-1">
        <Button size="sm" variant={tab === "vitrina" ? "club" : "ghost"} onClick={() => setTab("vitrina")}>
          Trofeos
        </Button>
        <Button size="sm" variant={tab === "premios" ? "club" : "ghost"} onClick={() => setTab("premios")}>
          Premios
        </Button>
        <Button size="sm" variant={tab === "stats" ? "club" : "ghost"} onClick={() => setTab("stats")}>
          Estadísticas
        </Button>
      </div>

      {tab === "vitrina" ? (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {honourKinds().map((kind) => (
              <li key={kind} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div className="flex items-center gap-2 text-fg-muted">
                  <Trophy className="size-4 text-primary" />
                  <p className="text-[11px] uppercase tracking-wide">{honourLabel(kind, league)}</p>
                </div>
                <p className="mt-2 font-display text-5xl font-semibold tabular-nums leading-none">
                  {honours[kind]}
                </p>
                <p className="mt-2 text-xs text-fg-muted">
                  {honourLabel(kind, league)} ×{honours[kind]}
                </p>
              </li>
            ))}
          </ul>
          <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <h3 className="text-sm font-medium">Historial contigo</h3>
            {careerTrophies.length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">Todavía no hay títulos en esta carrera.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {[...careerTrophies].reverse().map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{t.label}</span>
                    <span className="tabular-nums text-fg-muted">{formatMoney(t.prize)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : tab === "premios" ? (
        <AwardsHallOfFame />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-fg-muted">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Jugador</th>
                <th className="px-2 py-2 font-medium">GRL</th>
                <th className="px-2 py-2 font-medium">G</th>
                <th className="px-2 py-2 font-medium">A</th>
                <th className="hidden px-2 py-2 font-medium sm:table-cell">Carrera G/A</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="px-3 py-2.5">
                    <p className="font-medium leading-tight">{p.name}</p>
                    <p className="text-[11px] text-fg-muted">
                      {POS_LABEL[p.pos]} · {NAT_LABEL[p.nat] ?? p.nat}
                      {p.loanFrom === clubId ? " · cedido" : ""}
                    </p>
                  </td>
                  <td className={cn("px-2 font-display text-lg tabular-nums", ovrClass(p.ovr))}>
                    {p.ovr}
                  </td>
                  <td className="px-2 tabular-nums">{p.goals}</td>
                  <td className="px-2 tabular-nums">{p.assists}</td>
                  <td className="hidden px-2 tabular-nums text-fg-muted sm:table-cell">
                    {p.careerGoals + p.goals}/{p.careerAssists + p.assists}
                    <span className="ml-1 text-[11px]">· {p.careerApps + p.apps} pj</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
