import { BoardBalance } from "@/components/game/board";
import { ClubCrest } from "@/components/game/crest";
import { useMemo, useState } from "react";
import { Negotiation } from "@/components/game/negotiation";
import { Button } from "@/components/ui/button";
import { contractEndLabel, isExpiring } from "@/lib/game/contracts";
import { clubById, leagueInfo } from "@/lib/game/clubs";
import { managerOffers, managerReport } from "@/lib/game/manager";
import { POS_LABEL, formatMoney, formatWage, seasonLabel } from "@/lib/game/format";
import { cn } from "@/lib/cn";
import { tablePlace } from "@/lib/game/selectors";
import { useGame } from "@/lib/game/store";
import { sortTable } from "@/lib/game/world";

export function SeasonEnd() {
  const save = useGame((s) => s);
  const startNextSeason = useGame((s) => s.startNextSeason);
  const switchClub = useGame((s) => s.switchClub);
  const club = clubById(save.clubId);
  const place = tablePlace(save);
  const top = sortTable(save.standings).slice(0, 4);
  const won = save.careerTrophies.filter((t) => t.season === save.season);
  const [renewing, setRenewing] = useState<string | null>(null);
  const [offersOpen, setOffersOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const report = useMemo(() => managerReport(save), [save]);
  const offers = useMemo(() => managerOffers(save), [save]);
  const expiring = save.players
    .filter((p) => p.clubId === save.clubId && !p.loanFrom && isExpiring(p))
    .sort((a, b) => b.ovr - a.ovr);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-fg-muted">
          Fin de {seasonLabel(save.season)}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <ClubCrest club={club} size={56} />
          <div>
            <h1 className="font-display text-4xl font-semibold leading-none">{club.name}</h1>
            <p className="mt-2 text-fg-muted">
              {place}º en {leagueInfo(club.league).title}
            </p>
          </div>
        </div>
        {won.length ? (
          <ul className="mt-5 space-y-1 text-sm">
            {won.map((t) => (
              <li key={t.id} className="flex justify-between gap-3">
                <span>{t.label}</span>
                <span className="tabular-nums text-fg-muted">{formatMoney(t.prize)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-fg-muted">Sin títulos esta campaña. Hay otra por delante.</p>
        )}
        <div className="mt-6">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-xs uppercase tracking-wide text-fg-muted">Valoración del DT</p>
            <p className="text-xs tabular-nums text-fg-muted">
              {report.label} · {report.rating}/100
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-elevated">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${report.rating}%`, background: club.color }}
            />
          </div>
          <p className="mt-1 text-[11px] text-fg-muted">
            Esperado: {report.expectedPlace}º · terminaste {report.place}º
            {report.trophiesNow ? ` · ${report.trophiesNow} título${report.trophiesNow > 1 ? "s" : ""}` : ""}.
            De esto depende quién te llama si quieres cambiar de club.
          </p>
        </div>
        <BoardBalance />
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-wide text-fg-muted">Top 4</p>
          <ul className="space-y-2">
            {top.map((row, i) => {
              const c = clubById(row.clubId);
              return (
                <li key={row.clubId} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-fg-muted">{i + 1}</span>
                  <ClubCrest club={c} size={22} />
                  <span className="flex-1">{c.name}</span>
                  <span className="font-display tabular-nums">{row.pts}</span>
                </li>
              );
            })}
          </ul>
        </div>
        {expiring.length ? (
          <div className="mt-6">
            <p className="mb-1 text-xs uppercase tracking-wide text-comp-uel">Contratos que vencen</p>
            <p className="mb-2 text-[11px] text-fg-muted">
              Quien no renueves se va libre al empezar la nueva temporada y cualquier club puede ficharlo.
            </p>
            <ul className="space-y-1.5">
              {expiring.map((p) => (
                <li key={p.id} className="flex items-center gap-2 rounded-lg bg-elevated px-3 py-2 text-sm">
                  <span className="w-7 font-display text-lg tabular-nums">{p.ovr}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="text-[11px] text-fg-muted">
                      {POS_LABEL[p.pos]} · {p.age} años · {formatWage(p.wage)} · vence {contractEndLabel(save.season, p)}
                    </span>
                  </span>
                  <Button size="sm" variant="club" onClick={() => setRenewing(p.id)}>
                    Renovar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-6 flex flex-col gap-2">
          <Button variant="club" size="lg" onClick={() => startNextSeason()}>
            Siguiente temporada
          </Button>
          <Button variant="ghost" onClick={() => setOffersOpen(true)}>
            Nuevo club
          </Button>
        </div>
      </div>
      {offersOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOffersOpen(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-elevated p-4 shadow-[var(--shadow-border)] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">Ofertas para dirigir</p>
            <p className="mt-1 text-sm text-fg-muted">
              Tu valoración es {report.rating}/100 ({report.label.toLowerCase()}). Estos clubes quieren tenerte. La partida sigue:
              pasas directo a la nueva temporada con el club que elijas.
            </p>
            <ul className="mt-3 space-y-2 overflow-y-auto">
              {offers.map((o) => {
                const c = clubById(o.clubId);
                return (
                  <li key={o.clubId} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                    <ClubCrest club={c} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-[11px] text-fg-muted">
                        {leagueInfo(c.league).title} · {o.objective} · fichajes {formatMoney(o.budget)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="club"
                      onClick={() => {
                        const err = switchClub(o.clubId);
                        if (err) setSwitchError(err);
                      }}
                    >
                      Aceptar
                    </Button>
                  </li>
                );
              })}
            </ul>
            {switchError ? <p className={cn("mt-2 text-xs text-red-400")}>{switchError}</p> : null}
            <Button className="mt-3" variant="ghost" onClick={() => setOffersOpen(false)}>
              Seguir en {club.name}
            </Button>
          </div>
        </div>
      ) : null}
      {renewing ? (
        <Negotiation
          key={renewing}
          playerId={renewing}
          kind="renew"
          onClose={() => setRenewing(null)}
          onDone={() => setRenewing(null)}
        />
      ) : null}
    </div>
  );
}
