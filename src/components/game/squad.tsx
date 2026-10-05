import { STAT_SHORT, getStat, statKeysFor } from "@/lib/game/stats";
import { useMemo, useState } from "react";
import { PlayerAwardsSection } from "@/components/game/award-history-view";
import { Negotiation } from "@/components/game/negotiation";
import { StatusGlyph, absenceStatus, outReason, statusTag, statusWord } from "@/components/game/status-icons";
import { bondLabel, clubBondOf, squadBondOf } from "@/lib/game/event-effects";
import { unavailableGames, unavailableReason } from "@/lib/game/tactics";
import { ROLE_LABEL, clauseOf, contractEndLabel, isExpiring } from "@/lib/game/contracts";
import { clubById } from "@/lib/game/clubs";
import { GROUP_LABEL, NAT_LABEL, POS_LABEL, formatMoney, formatWage, ovrClass, posGroup } from "@/lib/game/format";
import type { Player, PosGroup } from "@/lib/game/types";
import { useGame } from "@/lib/game/store";
import { squadCount } from "@/lib/game/squad-rules";
import { loanRecallCost } from "@/lib/game/transfers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

const GROUPS: Array<PosGroup | "ALL"> = ["ALL", "GK", "DEF", "MID", "FWD"];

export function Squad() {
  const clubId = useGame((s) => s.clubId);
  const players = useGame((s) => s.players);
  const toggleListed = useGame((s) => s.toggleListed);
  const toggleLoanListed = useGame((s) => s.toggleLoanListed);
  const sellPlayer = useGame((s) => s.sellPlayer);
  const toggleNoOffers = useGame((s) => s.toggleNoOffers);
  const setScreen = useGame((s) => s.setScreen);
  const [group, setGroup] = useState<PosGroup | "ALL">("ALL");
  const [selected, setSelected] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<string | null>(null);
  const season = useGame((s) => s.season);
  const budget = useGame((s) => s.budget);
  const recallLoan = useGame((s) => s.recallLoan);

  const squad = useMemo(() => {
    const list = players.filter((p) => p.clubId === clubId || p.loanFrom === clubId);
    const filtered = group === "ALL" ? list : list.filter((p) => posGroup(p.pos) === group);
    return filtered.sort((a, b) => b.ovr - a.ovr);
  }, [players, clubId, group]);

  const current = squad.find((p) => p.id === selected) ?? null;
  // Plantilla = propios + cedidos que llegaron (el tope de 40 los cuenta); los cedidos no se pueden vender.
  const count = useMemo(() => squadCount(players, clubId), [players, clubId]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-display text-3xl font-semibold">Plantilla</h2>
          <p className="text-sm text-fg-muted">
            {count.total}/40 en el club ({count.own} propios{count.loanedIn ? ` + ${count.loanedIn} cedido${count.loanedIn > 1 ? "s" : ""}` : ""}) · {squad.length} en vista
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {GROUPS.map((g) => (
            <Button
              key={g}
              size="sm"
              variant={group === g ? "club" : "ghost"}
              onClick={() => setGroup(g)}
            >
              {g === "ALL" ? "Todos" : GROUP_LABEL[g]}
            </Button>
          ))}
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        <table className="w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-fg-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Jugador</th>
              <th className="px-2 py-2 font-medium">Nº</th>
              <th className="px-2 py-2 font-medium">Pos</th>
              <th className="px-2 py-2 font-medium">Edad</th>
              <th className="px-2 py-2 font-medium">MED</th>
              <th className="hidden px-2 py-2 font-medium sm:table-cell">POT</th>
              <th className="hidden px-2 py-2 font-medium md:table-cell">Valor</th>
              <th className="px-2 py-2 font-medium">Contrato</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p) => (
              <tr
                key={p.id}
                className={cn(
                  "cursor-pointer border-b border-border/60 hover:bg-fg/4",
                  selected === p.id && "bg-fg/6",
                )}
                onClick={() => setSelected(p.id)}
              >
                <td className="px-3 py-2.5">
                  <p className="flex items-center gap-1.5 font-medium leading-tight">
                    {p.name}
                    {p.injured > 0 ? <StatusGlyph status="injury" /> : null}
                    {p.suspended > 0 ? <StatusGlyph status="suspension" /> : null}
                    {absenceStatus(p) ? <StatusGlyph status={absenceStatus(p)!} /> : null}
                  </p>
                  <p className="text-[11px] text-fg-muted">
                    {NAT_LABEL[p.nat] ?? p.nat}
                    {p.injured > 0 ? ` · ${statusTag("injury", p.injured)}` : ""}
                    {p.suspended > 0 ? ` · ${statusTag("suspension", p.suspended)}` : ""}
                    {absenceStatus(p) ? ` · ${statusTag(absenceStatus(p)!, p.absence!.games)} (${p.absence!.reason})` : ""}
                    {p.listed ? " · en venta" : ""}
                    {p.listedForLoan ? " · a cesión" : ""}
                    {p.noOffers ? " · ofertas bloqueadas" : ""}
                    {p.loanFrom === clubId ? " · cedido" : ""}
                    {p.loanFrom && p.loanFrom !== clubId ? " · cedido in" : ""}
                  </p>
                </td>
                <td className="px-2 font-display text-base tabular-nums text-fg-muted">{p.number}</td>
                <td className="px-2 font-display text-base text-fg-muted">{POS_LABEL[p.pos]}</td>
                <td className="px-2 tabular-nums text-fg-muted">{p.age}</td>
                <td className={cn("px-2 font-display text-lg tabular-nums", ovrClass(p.ovr))}>
                  {p.ovr}
                  <GrlDelta player={p} />
                </td>
                <td className="hidden px-2 tabular-nums text-fg-muted sm:table-cell">{p.pot}</td>
                <td className="hidden px-2 tabular-nums text-fg-muted md:table-cell">
                  {formatMoney(p.value)}
                </td>
                <td
                  className={cn(
                    "px-2 text-xs tabular-nums",
                    isExpiring(p) && !p.loanFrom ? "font-medium text-comp-uel" : "text-fg-muted",
                  )}
                >
                  {p.loanFrom === clubId ? "Cedido" : `Jun ${season + p.contract}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {current ? (
        <PlayerSheet
          player={current}
          onClose={() => setSelected(null)}
          onList={() => toggleListed(current.id)}
          onLoan={() => toggleLoanListed(current.id)}
          onBlockOffers={() => toggleNoOffers(current.id)}
          onTrain={() => setScreen("train")}
          season={season}
          recallCost={
            current.loanFrom === clubId && current.clubId !== clubId
              ? loanRecallCost(useGame.getState(), current)
              : null
          }
          budget={budget}
          onRecall={() => {
            const err = recallLoan(current.id);
            setMsg(err ?? `${current.name} vuelve al club.`);
            if (!err) setSelected(null);
          }}
          onRenew={() => setRenewing(current.id)}
          onSell={() => {
            const err = sellPlayer(current.id);
            setMsg(err ?? `${current.name} transferido.`);
            if (!err) setSelected(null);
          }}
        />
      ) : null}
      {renewing ? (
        <Negotiation
          key={renewing}
          playerId={renewing}
          kind="renew"
          onClose={() => setRenewing(null)}
          onDone={(m) => setMsg(m)}
        />
      ) : null}
      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
    </div>
  );
}

/** Cambio de GRL en lo que va de temporada: +N verde, −N rojo, nada si no cambió. Se reinicia al cerrar la temporada. */
export function GrlDelta({ player, className }: { player: Player; className?: string }) {
  const diff = player.ovr - (player.seasonStartOvr || player.ovr);
  if (diff === 0) return null;
  const up = diff > 0;
  return (
    <span
      className={cn("ml-1 text-xs font-semibold tabular-nums", className)}
      style={{ color: up ? "var(--color-good)" : "var(--color-bad)" }}
      title={up ? `Subió ${diff} de GRL esta temporada` : `Bajó ${-diff} de GRL esta temporada`}
    >
      {up ? `+${diff}` : `−${-diff}`}
    </span>
  );
}

function PlayerSheet({
  player,
  onClose,
  onList,
  onLoan,
  onBlockOffers,
  onSell,
  onTrain,
  onRenew,
  onRecall,
  recallCost,
  budget,
  season,
}: {
  player: Player;
  onClose: () => void;
  onList: () => void;
  onLoan: () => void;
  onBlockOffers: () => void;
  onSell: () => void;
  onTrain: () => void;
  onRenew: () => void;
  onRecall: () => void;
  /** Lo que cuesta traerlo de vuelta; null si no es un cedido tuyo. */
  recallCost: number | null;
  budget: number;
  season: number;
}) {
  // Porteros: estadísticas propias (estirada, manejo, saque, reflejos, velocidad, colocación).
  const attrs: Array<[string, number]> = statKeysFor(player.pos).map((k) => [
    STAT_SHORT[k],
    getStat(player, k),
  ]);
  const guest = Boolean(player.loanFrom);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
    <aside
      className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-elevated p-4 shadow-[var(--shadow-border)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-semibold leading-none">{player.name}</p>
          <p className="mt-1 text-sm text-fg-muted">
            {POS_LABEL[player.pos]} · {player.age} años · {NAT_LABEL[player.nat] ?? player.nat}
          </p>
        </div>
        <p className={cn("font-display text-5xl tabular-nums", ovrClass(player.ovr))}>
          {player.ovr}
          <GrlDelta player={player} className="align-top text-lg" />
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {attrs.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface px-2 py-2 text-center">
            <p className="text-[10px] uppercase tracking-wide text-fg-muted">{k}</p>
            <p className="font-display text-xl tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-fg-muted">Valor</dt>
          <dd className="tabular-nums">{formatMoney(player.value)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Salario</dt>
          <dd className="tabular-nums">{formatWage(player.wage)}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Contrato</dt>
          <dd className={cn(isExpiring(player) && !guest && "text-comp-uel")}>
            hasta {contractEndLabel(season, player)}
            {isExpiring(player) && !guest ? " · último año" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">Potencial</dt>
          <dd className="tabular-nums">{player.pot}{player.pot >= 100 ? " · techo" : ""}</dd>
        </div>
        <div>
          <dt className="text-fg-muted">Temporada G/A</dt>
          <dd className="tabular-nums">
            {player.goals} / {player.assists}
          </dd>
        </div>
        <div>
          <dt className="text-fg-muted">Carrera G/A</dt>
          <dd className="tabular-nums">
            {player.careerGoals + player.goals} / {player.careerAssists + player.assists}
          </dd>
        </div>
      </dl>
      {unavailableReason(player) ? (
        <div role="status" className="mt-3 flex items-center gap-3 rounded-lg bg-bad/10 px-3 py-2.5 text-sm">
          <StatusGlyph status={unavailableReason(player)!} />
          <p className="min-w-0">
            <span className="font-medium">{statusWord(unavailableReason(player)!)}</span>
            {outReason(player, unavailableReason(player)!) ? ` · ${outReason(player, unavailableReason(player)!)}` : ""}
            <span className="block text-xs text-fg-muted">
              Le {unavailableGames(player) === 1 ? "queda 1 partido" : `quedan ${unavailableGames(player)} partidos`} de baja. No puede ser titular ni suplente.
            </span>
          </p>
        </div>
      ) : null}
      {!guest && (player.bond || player.valueMod) ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-surface px-3 py-2.5 text-sm">
          {player.bond ? (
            <>
              <div>
                <dt className="text-fg-muted">Relación con el club</dt>
                <dd>{bondLabel(clubBondOf(player))}</dd>
              </div>
              <div>
                <dt className="text-fg-muted">Relación con el plantel</dt>
                <dd>{bondLabel(squadBondOf(player))}</dd>
              </div>
            </>
          ) : null}
          {player.valueMod ? (
            <div className="col-span-2 text-xs text-fg-muted">
              Valor de mercado {player.valueMod.pct > 0 ? "+" : "−"}
              {Math.abs(player.valueMod.pct)}% por {player.valueMod.games} {player.valueMod.games === 1 ? "partido más" : "partidos más"}.
            </div>
          ) : null}
        </dl>
      ) : null}
      <PlayerAwardsSection playerId={player.id} />
      {!guest && player.terms ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-fg-muted">
          {player.terms.role ? `Rol pactado: ${ROLE_LABEL[player.terms.role]}. ` : ""}
          {clauseOf(player) ? `Cláusula ${formatMoney(clauseOf(player)!)}. ` : "Sin cláusula. "}
          {player.terms.goalBonus > 0 ? `Gol ${formatMoney(player.terms.goalBonus)}. ` : ""}
          {player.terms.assistBonus > 0 ? `Asistencia ${formatMoney(player.terms.assistBonus)}. ` : ""}
          {player.terms.appBonus > 0 ? `Partido ${formatMoney(player.terms.appBonus)}. ` : ""}
          {player.terms.titleBonus > 0 ? `Título ${formatMoney(player.terms.titleBonus)}. ` : ""}
          {player.sellOn ? `Reventa ${player.sellOn.pct}%.` : ""}
        </p>
      ) : !guest && clauseOf(player) ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-fg-muted">
          Cláusula de rescisión {formatMoney(clauseOf(player)!)}.
        </p>
      ) : null}
      {player.noOffers && !guest ? (
        <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs text-fg-muted">
          No te mandarán ofertas por este jugador hasta desactivarla.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {!guest ? (
          <>
            <Button variant={isExpiring(player) ? "club" : "outline"} onClick={onRenew}>
              Renovar contrato
            </Button>
            <Button variant="outline" onClick={onList}>
              {player.listed ? "Quitar del mercado" : "Poner en venta"}
            </Button>
            <Button variant="outline" onClick={onLoan}>
              {player.listedForLoan ? "Cancelar cesión" : "Ofrecer cesión"}
            </Button>
            <Button variant={player.noOffers ? "club" : "outline"} onClick={onBlockOffers}>
              {player.noOffers ? "Permitir ofertas" : "Bloquear ofertas"}
            </Button>
            <Button variant="outline" onClick={onSell}>
              Vender ahora
            </Button>
            <Button variant="outline" onClick={onTrain}>
              Entrenar
            </Button>
          </>
        ) : recallCost !== null ? (
          <div className="flex w-full flex-col gap-2 rounded-lg bg-surface px-3 py-2">
            <p className="text-xs text-fg-muted">
              Cedido en {clubById(player.clubId).name}
              {player.loanSeasons > 0
                ? ` · le quedan ${player.loanSeasons} temporada${player.loanSeasons > 1 ? "s" : ""}`
                : ""}
              . No se puede vender hasta que vuelva, o lo rescatás ahora pagando una compensación.
            </p>
            <Button variant="club" disabled={budget < recallCost} onClick={onRecall}>
              Rescatar de la cesión · {formatMoney(recallCost)}
            </Button>
            {budget < recallCost ? (
              <p className="text-[11px] text-bad">No alcanza el presupuesto.</p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-fg-muted">Cedido: no se vende hasta que vuelva o expire el préstamo.</p>
        )}
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </aside>
    </div>
  );
}
