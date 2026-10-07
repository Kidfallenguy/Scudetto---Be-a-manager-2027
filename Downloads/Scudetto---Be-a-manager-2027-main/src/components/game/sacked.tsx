import { useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { clubById, leagueInfo } from "@/lib/game/clubs";
import { formatMoney, seasonLabel } from "@/lib/game/format";
import { tablePlace, userMatchHistory } from "@/lib/game/selectors";
import { useGame } from "@/lib/game/store";

/** Pantalla de despido: el manager ya no sigue en el club y debe elegir adónde ir. */
export function SackedView() {
  const save = useGame((s) => s);
  const switchClub = useGame((s) => s.switchClub);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sacked = save.board?.sacked ?? null;
  const club = clubById(save.clubId);
  const record = useMemo(() => {
    const h = userMatchHistory(save);
    return {
      played: h.length,
      w: h.filter((m) => m.outcome === "W").length,
      d: h.filter((m) => m.outcome === "D").length,
      l: h.filter((m) => m.outcome === "L").length,
    };
  }, [save]);
  if (!sacked) return null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 shadow-[var(--shadow-border)]">
        <p
          className="text-xs font-medium uppercase tracking-[0.2em]"
          style={{ color: "var(--color-bad)" }}
        >
          Despedido · {seasonLabel(sacked.season)}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <ClubCrest club={club} size={56} />
          <div>
            <h1 className="font-display text-4xl font-semibold leading-none">Te echaron</h1>
            <p className="mt-2 text-fg-muted">
              {club.name} · {tablePlace(save)}º en {leagueInfo(club.league).title}
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm">{sacked.reason}</p>
        <p className="mt-3 text-sm text-fg-muted">
          Tu ciclo termina con {record.w} victorias, {record.d} empates y {record.l} derrotas en {record.played}{" "}
          partidos. La confianza de la dirigencia quedó en {Math.round(save.board?.confidence ?? 0)}/100.
        </p>

        <div className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-fg-muted">
            Clubes que te ofrecen una oportunidad
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            Con el despido a cuestas, los grandes no llaman. La partida sigue: si elegís uno, lo que quede de la
            temporada se juega solo y asumís en el club nuevo.
          </p>
          <ul className="mt-3 space-y-2">
            {sacked.offers.map((o) => {
              const c = clubById(o.clubId);
              return (
                <li key={o.clubId} className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2.5">
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
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      const err = switchClub(o.clubId);
                      if (err) {
                        setError(err);
                        setBusy(false);
                      }
                    }}
                  >
                    Aceptar
                  </Button>
                </li>
              );
            })}
          </ul>
          {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
