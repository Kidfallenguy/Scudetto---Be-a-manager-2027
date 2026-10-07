import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Negotiation } from "@/components/game/negotiation";
import { CLUBS, clubById } from "@/lib/game/clubs";
import { clauseOf, contractEndLabel, isExpiring } from "@/lib/game/contracts";
import { FREE_AGENT } from "@/lib/game/free-agents";
import {
  COMP_LABEL,
  GROUP_LABEL,
  NAT_LABEL,
  POS_LABEL,
  formatMoney,
  formatWage,
  ovrClass,
  posGroup,
  seasonLabel,
} from "@/lib/game/format";
import { useGame } from "@/lib/game/store";
import { isOwnedAtClub } from "@/lib/game/squad-rules";
import { askPrice, findMarketPlayer, fullMarket, loanFee, loanMarket } from "@/lib/game/transfers";
import type { Player, Pos, PosGroup, TransferRecord } from "@/lib/game/types";

const GROUPS: Array<PosGroup | "ALL"> = ["ALL", "GK", "DEF", "MID", "FWD"];
const POSITIONS: Pos[] = ["GK", "RB", "CB", "LB", "CDM", "CM", "CAM", "RW", "LW", "ST"];
type Tab = "buy" | "offers" | "loans" | "listed" | "contracts" | "history";
type Scope = "all" | "free" | "listed";
type ClauseFilter = "all" | "with" | "none" | "payable";
type SortKey = "ovr" | "age" | "value" | "wage";

const PAGE_SIZE = 25;
const HISTORY_PAGE = 20;

const LEAGUE_LABEL: Record<string, string> = {
  serieA: COMP_LABEL.serieA,
  premier: COMP_LABEL.premier,
  laliga: COMP_LABEL.laliga,
  bundesliga: COMP_LABEL.bundesliga,
  ligue1: COMP_LABEL.ligue1,
  argentina: "LPF",
  europe: "Resto de Europa",
  conmebol: "Sudamérica",
};

interface Filters {
  ovrMin: string;
  ovrMax: string;
  ageMin: string;
  ageMax: string;
  nat: string;
  pos: Pos | "ALL";
  clubId: string;
  league: string;
  clause: ClauseFilter;
  sort: SortKey;
  dir: "desc" | "asc";
}

const NO_FILTERS: Filters = {
  ovrMin: "",
  ovrMax: "",
  ageMin: "",
  ageMax: "",
  nat: "ALL",
  pos: "ALL",
  clubId: "ALL",
  league: "ALL",
  clause: "all",
  sort: "ovr",
  dir: "desc",
};

const selectCls =
  "h-10 min-w-0 rounded-xl bg-surface px-2 text-sm shadow-[var(--shadow-border)] outline-none focus:shadow-[var(--shadow-border-hover)]";
const numCls =
  "h-10 w-full min-w-0 rounded-xl bg-surface px-2 text-sm tabular-nums shadow-[var(--shadow-border)] outline-none placeholder:text-fg-subtle focus:shadow-[var(--shadow-border-hover)]";

function pageList(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | "…"> = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push("…");
  for (let i = from; i <= to; i++) out.push(i);
  if (to < pages - 1) out.push("…");
  out.push(pages);
  return out;
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (n: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginación">
      <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹
      </Button>
      {pageList(page, pages).map((n, i) =>
        n === "…" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-fg-muted">
            …
          </span>
        ) : (
          <Button key={n} size="sm" variant={n === page ? "club" : "ghost"} onClick={() => onPage(n)}>
            {n}
          </Button>
        ),
      )}
      <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        ›
      </Button>
    </nav>
  );
}

export function Market() {
  const clubId = useGame((s) => s.clubId);
  const save = useGame((s) => s);
  const budget = useGame((s) => s.budget);
  const takeOnLoan = useGame((s) => s.takeOnLoan);
  const acceptIncoming = useGame((s) => s.acceptIncoming);
  const rejectIncoming = useGame((s) => s.rejectIncoming);
  const toggleListed = useGame((s) => s.toggleListed);
  const toggleLoanListed = useGame((s) => s.toggleLoanListed);
  const [tab, setTab] = useState<Tab>("buy");
  const [group, setGroup] = useState<PosGroup | "ALL">("ALL");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [loanYears, setLoanYears] = useState<1 | 2>(1);
  const [scope, setScope] = useState<Scope>("all");
  const [deal, setDeal] = useState<{ playerId: string; kind: "sign" | "renew" } | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [histPage, setHistPage] = useState(1);
  const [histScope, setHistScope] = useState<"all" | "mine" | "loan" | "sale" | "free">("all");
  const setF = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));

  const source = useMemo(
    () => (tab === "loans" ? loanMarket(save) : fullMarket(save)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [save.players, save.freeAgents, save.clubId, tab],
  );

  const natOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of source) if (p.nat) set.add(p.nat);
    return [...set].sort((a, b) => (NAT_LABEL[a] ?? a).localeCompare(NAT_LABEL[b] ?? b, "es"));
  }, [source]);

  const leagueOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of source) if (p.clubId !== FREE_AGENT) set.add(clubById(p.clubId).league);
    return [...set];
  }, [source]);

  const clubOptions = useMemo(
    () =>
      CLUBS.filter((c) => !c.ghost && c.id !== clubId && (filters.league === "ALL" || c.league === filters.league)).sort(
        (a, b) => a.name.localeCompare(b.name, "es"),
      ),
    [clubId, filters.league],
  );

  const rows = useMemo(() => {
    let r = source;
    if (tab === "buy" && scope === "free") r = r.filter((p) => p.clubId === FREE_AGENT);
    if (tab === "buy" && scope === "listed") r = r.filter((p) => p.listed);
    if (group !== "ALL") r = r.filter((p) => posGroup(p.pos) === group);
    if (filters.pos !== "ALL") r = r.filter((p) => p.pos === filters.pos);
    if (filters.nat !== "ALL") r = r.filter((p) => p.nat === filters.nat);
    if (filters.league !== "ALL") r = r.filter((p) => p.clubId !== FREE_AGENT && clubById(p.clubId).league === filters.league);
    if (filters.clubId !== "ALL") r = r.filter((p) => p.clubId === filters.clubId);
    const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
    const oMin = num(filters.ovrMin);
    const oMax = num(filters.ovrMax);
    const aMin = num(filters.ageMin);
    const aMax = num(filters.ageMax);
    if (oMin !== null) r = r.filter((p) => p.ovr >= oMin);
    if (oMax !== null) r = r.filter((p) => p.ovr <= oMax);
    if (aMin !== null) r = r.filter((p) => p.age >= aMin);
    if (aMax !== null) r = r.filter((p) => p.age <= aMax);
    if (filters.clause !== "all") {
      r = r.filter((p) => {
        const c = p.clubId === FREE_AGENT ? null : clauseOf(p);
        if (filters.clause === "with") return c !== null;
        if (filters.clause === "none") return c === null;
        return c !== null && c <= budget;
      });
    }
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      r = r.filter(
        (p) =>
          p.name.toLowerCase().includes(t) ||
          (p.clubId !== FREE_AGENT && clubById(p.clubId).name.toLowerCase().includes(t)),
      );
    }
    const key = filters.sort;
    const val = (p: Player) => (key === "value" ? p.value : key === "wage" ? p.wage : p[key]);
    const sign = filters.dir === "desc" ? -1 : 1;
    return [...r].sort((a, b) => (val(a) - val(b)) * sign || b.ovr - a.ovr);
  }, [source, tab, scope, group, filters, q, budget]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const pool = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Cualquier cambio de filtro o pestaña vuelve a la página 1.
  useEffect(() => {
    setPage(1);
  }, [tab, group, q, scope, filters]);
  useEffect(() => {
    setHistPage(1);
  }, [histScope]);

  const activeFilters =
    (filters.ovrMin ? 1 : 0) +
    (filters.ovrMax ? 1 : 0) +
    (filters.ageMin ? 1 : 0) +
    (filters.ageMax ? 1 : 0) +
    (filters.nat !== "ALL" ? 1 : 0) +
    (filters.pos !== "ALL" ? 1 : 0) +
    (filters.clubId !== "ALL" ? 1 : 0) +
    (filters.league !== "ALL" ? 1 : 0) +
    (filters.clause !== "all" ? 1 : 0);

  const history = useMemo(() => {
    const log = save.transferLog ?? [];
    return log.filter((t) => {
      if (histScope === "mine") return Boolean(t.user);
      if (histScope === "loan") return t.kind === "loan";
      if (histScope === "sale") return t.kind === "sale" || t.kind === "clause";
      if (histScope === "free") return t.kind === "free" || t.kind === "release";
      return true;
    });
  }, [save.transferLog, histScope]);
  const histPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE));
  const histSafe = Math.min(histPage, histPages);
  const histRows = history.slice((histSafe - 1) * HISTORY_PAGE, histSafe * HISTORY_PAGE);

  // Los agentes libres no están en save.players: hay que buscarlos también en la lista de libres.
  const current = picked ? (findMarketPlayer(save, picked)?.player ?? null) : null;
  // Escaparate y ofertas: solo jugadores propios. Los cedidos no se pueden vender ni ofrecer.
  const mine = save.players.filter((p) => isOwnedAtClub(p, clubId));
  const mineIds = new Set(mine.map((p) => p.id));
  const listed = mine.filter((p) => p.listed || p.listedForLoan);
  const offers = save.offers.filter((o) => o.toClubId === clubId && mineIds.has(o.playerId));
  const contracts = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === clubId && !p.loanFrom)
        .sort((a, b) => a.contract - b.contract || b.ovr - a.ovr),
    [save.players, clubId],
  );
  const expiringCount = contracts.filter((p) => isExpiring(p)).length;
  const freeCount = save.freeAgents.length;
  // Un solo bloque por jugador: ofertas ordenadas de mayor a menor precio.
  const offerGroups = useMemo(() => {
    const byPlayer = new Map<string, typeof offers>();
    for (const o of offers) {
      const list = byPlayer.get(o.playerId) ?? [];
      list.push(o);
      byPlayer.set(o.playerId, list);
    }
    return [...byPlayer.entries()]
      .map(([playerId, list]) => ({
        playerId,
        offers: [...list].sort((a, b) => b.fee - a.fee),
      }))
      .sort((a, b) => (b.offers[0]?.fee ?? 0) - (a.offers[0]?.fee ?? 0));
  }, [offers]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-3xl font-semibold">Mercado</h2>
        <p className="text-sm text-fg-muted">Caja {formatMoney(budget)} · tope 40 jugadores</p>
      </header>
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["buy", "Fichajes"],
            ["offers", "Ofertas"],
            ["loans", "Cesiones"],
            ["listed", "En venta"],
            ["contracts", "Contratos"],
            ["history", "Historial"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={tab === id ? "club" : "ghost"} onClick={() => setTab(id)}>
            {label}
            {id === "contracts" && expiringCount > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-comp-uel px-1.5 text-[11px] leading-5 text-black">
                {expiringCount}
              </span>
            ) : null}
            {id === "offers" && offers.length > 0 ? (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-foreground">
                {offers.length}
              </span>
            ) : null}
          </Button>
        ))}
      </div>

      {tab === "offers" ? (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          {offerGroups.length === 0 ? (
            <li className="px-3 py-4 text-sm text-fg-muted">
              Nadie llama. Pon jugadores en venta o a cesión y espera.
            </li>
          ) : (
            offerGroups.map((g) => {
              const p = save.players.find((x) => x.id === g.playerId);
              if (!p) return null;
              const top = g.offers[0]!;
              return (
                <li key={g.playerId} className="border-b border-border/60 px-3 py-3 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-fg-muted">
                        {POS_LABEL[p.pos]} · GRL {p.ovr} · POT {p.pot}
                        {g.offers.length > 1 ? ` · ${g.offers.length} ofertas` : ""}
                      </p>
                    </div>
                    <p className="font-display text-2xl tabular-nums">{formatMoney(top.fee)}</p>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {g.offers.map((o) => {
                      const from = clubById(o.fromClubId);
                      return (
                        <li
                          key={o.id}
                          className="flex flex-col gap-2 rounded-lg bg-elevated px-3 py-2 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <ClubCrest club={from} size={24} />
                            <div className="min-w-0">
                              <p className="truncate text-sm">
                                {from.name} · {formatMoney(o.fee)}
                              </p>
                              <p className="text-[11px] text-fg-muted">
                                {o.kind === "loan" ? `cesión ${o.loanSeasons} t.` : "compra"}
                                {o.unsolicited ? " · no estaba en venta" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="club"
                              onClick={() => {
                                const err = acceptIncoming(o.id);
                                setMsg(err ?? "Trato cerrado.");
                              }}
                            >
                              Aceptar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => rejectIncoming(o.id)}>
                              Rechazar
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {tab === "contracts" ? (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          {contracts.map((p) => {
            const soon = isExpiring(p);
            return (
              <li key={p.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
                <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-fg-muted">
                    {POS_LABEL[p.pos]} · {p.age} años · {formatWage(p.wage)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn("text-xs tabular-nums", soon ? "font-medium text-comp-uel" : "text-fg-muted")}>
                    {contractEndLabel(save.season, p)}
                  </p>
                  <p className="text-[11px] text-fg-muted">
                    {soon ? "Último año" : `${p.contract} años`}
                  </p>
                </div>
                <Button size="sm" variant={soon ? "club" : "ghost"} onClick={() => setDeal({ playerId: p.id, kind: "renew" })}>
                  Renovar
                </Button>
              </li>
            );
          })}
          <li className="px-3 py-3 text-[11px] text-fg-muted">
            Si no renovás a quien está en su último año, deja el club libre al terminar la temporada.
          </li>
        </ul>
      ) : null}

      {tab === "listed" ? (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          {listed.length === 0 ? (
            <li className="px-3 py-4 text-sm text-fg-muted">
              Nadie en el escaparate. En plantilla puedes poner a la venta o ceder.
            </li>
          ) : (
            listed.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
                <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(p.ovr))}>{p.ovr}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-fg-muted">
                    {p.listed ? "En venta" : "A cesión"} · {formatMoney(p.value)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => (p.listed ? toggleListed(p.id) : toggleLoanListed(p.id))}
                >
                  Quitar
                </Button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === "history" ? (
        <>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "Todo"],
                ["mine", "Mi club"],
                ["sale", "Ventas"],
                ["loan", "Cesiones"],
                ["free", "Libres"],
              ] as const
            ).map(([id, label]) => (
              <Button key={id} size="sm" variant={histScope === id ? "club" : "ghost"} onClick={() => setHistScope(id)}>
                {label}
              </Button>
            ))}
          </div>
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            {histRows.length === 0 ? (
              <li className="px-3 py-4 text-sm text-fg-muted">
                Todavía no hubo movimientos. Avanza semanas: el mercado se mueve.
              </li>
            ) : (
              histRows.map((t) => <HistoryRow key={t.id} t={t} />)
            )}
          </ul>
          <p className="text-center text-[11px] text-fg-muted">
            {history.length} movimientos · página {histSafe} de {histPages}
          </p>
          <Pager page={histSafe} pages={histPages} onPage={setHistPage} />
        </>
      ) : null}

      {tab === "buy" || tab === "loans" ? (
        <>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar jugador o club"
              className="h-11 min-w-0 flex-1 rounded-xl bg-surface px-3 text-sm shadow-[var(--shadow-border)] outline-none placeholder:text-fg-subtle focus:shadow-[var(--shadow-border-hover)]"
            />
            <Button size="sm" variant={showFilters || activeFilters > 0 ? "club" : "ghost"} onClick={() => setShowFilters((v) => !v)}>
              Filtros{activeFilters > 0 ? ` (${activeFilters})` : ""}
            </Button>
          </div>
          {tab === "buy" ? (
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant={scope === "all" ? "club" : "ghost"} onClick={() => setScope("all")}>
                Todos
              </Button>
              <Button size="sm" variant={scope === "free" ? "club" : "ghost"} onClick={() => setScope("free")}>
                Agentes libres ({freeCount})
              </Button>
              <Button size="sm" variant={scope === "listed" ? "club" : "ghost"} onClick={() => setScope("listed")}>
                En venta
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1">
            {GROUPS.map((g) => (
              <Button key={g} size="sm" variant={group === g ? "club" : "ghost"} onClick={() => setGroup(g)}>
                {g === "ALL" ? "Todos" : GROUP_LABEL[g]}
              </Button>
            ))}
          </div>

          {showFilters ? (
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)] sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Posición
                <select className={selectCls} value={filters.pos} onChange={(e) => setF("pos", e.target.value as Pos | "ALL")}>
                  <option value="ALL">Todas</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {POS_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                País
                <select className={selectCls} value={filters.nat} onChange={(e) => setF("nat", e.target.value)}>
                  <option value="ALL">Todos</option>
                  {natOptions.map((n) => (
                    <option key={n} value={n}>
                      {NAT_LABEL[n] ?? n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Liga
                <select
                  className={selectCls}
                  value={filters.league}
                  onChange={(e) => setFilters((f) => ({ ...f, league: e.target.value, clubId: "ALL" }))}
                >
                  <option value="ALL">Todas</option>
                  {leagueOptions.map((l) => (
                    <option key={l} value={l}>
                      {LEAGUE_LABEL[l] ?? l}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Club
                <select className={selectCls} value={filters.clubId} onChange={(e) => setF("clubId", e.target.value)}>
                  <option value="ALL">Todos</option>
                  {clubOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Cláusula
                <select className={selectCls} value={filters.clause} onChange={(e) => setF("clause", e.target.value as ClauseFilter)}>
                  <option value="all">Cualquiera</option>
                  <option value="with">Con cláusula</option>
                  <option value="none">Sin cláusula</option>
                  <option value="payable">Puedo pagarla</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Ordenar por
                <span className="flex gap-1">
                  <select className={cn(selectCls, "flex-1")} value={filters.sort} onChange={(e) => setF("sort", e.target.value as SortKey)}>
                    <option value="ovr">Overall</option>
                    <option value="age">Edad</option>
                    <option value="value">Valor</option>
                    <option value="wage">Salario</option>
                  </select>
                  <button
                    type="button"
                    className={cn(selectCls, "w-10 shrink-0 text-center")}
                    onClick={() => setF("dir", filters.dir === "desc" ? "asc" : "desc")}
                    aria-label="Invertir orden"
                  >
                    {filters.dir === "desc" ? "↓" : "↑"}
                  </button>
                </span>
              </label>
              <div className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Overall
                <span className="flex items-center gap-1">
                  <input className={numCls} inputMode="numeric" placeholder="mín" value={filters.ovrMin} onChange={(e) => setF("ovrMin", e.target.value)} />
                  <span>–</span>
                  <input className={numCls} inputMode="numeric" placeholder="máx" value={filters.ovrMax} onChange={(e) => setF("ovrMax", e.target.value)} />
                </span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-fg-muted">
                Edad
                <span className="flex items-center gap-1">
                  <input className={numCls} inputMode="numeric" placeholder="mín" value={filters.ageMin} onChange={(e) => setF("ageMin", e.target.value)} />
                  <span>–</span>
                  <input className={numCls} inputMode="numeric" placeholder="máx" value={filters.ageMax} onChange={(e) => setF("ageMax", e.target.value)} />
                </span>
              </div>
              <div className="flex items-end">
                <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
                  Limpiar filtros
                </Button>
              </div>
            </div>
          ) : null}

          <p className="text-[11px] text-fg-muted">
            {rows.length} jugador{rows.length === 1 ? "" : "es"} · página {safePage} de {pages}
          </p>
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            {pool.length === 0 ? (
              <li className="px-3 py-4 text-sm text-fg-muted">Ningún jugador cumple esos filtros.</li>
            ) : (
              pool.map((p) => (
                <MarketRow key={p.id} player={p} active={picked === p.id} onPick={() => setPicked(p.id)} />
              ))
            )}
          </ul>
          <Pager page={safePage} pages={pages} onPage={setPage} />
        </>
      ) : null}

      {current && (tab === "buy" || tab === "loans") ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-4"
          onClick={() => setPicked(null)}
        >
          <div
            className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto p-5 pb-3">
            <p className="font-display text-3xl font-semibold leading-none">{current.name}</p>
            <p className="mt-2 text-sm text-fg-muted">
              {POS_LABEL[current.pos]} · {current.age} años · POT {current.pot} ·{" "}
              {current.clubId === FREE_AGENT ? "Agente libre" : clubById(current.clubId).name}
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              {formatWage(current.wage)}
              {current.clubId !== FREE_AGENT && clauseOf(current) !== null
                ? ` · cláusula ${formatMoney(clauseOf(current) ?? 0)}`
                : ""}
              {current.clubId !== FREE_AGENT && clauseOf(current) === null ? " · sin cláusula" : ""}
            </p>
            <p className={cn("mt-3 font-display text-5xl tabular-nums", ovrClass(current.ovr))}>
              {current.ovr}
            </p>
            {tab === "loans" ? (
              <div className="mt-3 flex gap-1">
                <Button size="sm" variant={loanYears === 1 ? "club" : "ghost"} onClick={() => setLoanYears(1)}>
                  1 temporada
                </Button>
                <Button size="sm" variant={loanYears === 2 ? "club" : "ghost"} onClick={() => setLoanYears(2)}>
                  2 temporadas
                </Button>
              </div>
            ) : null}
            </div>
            <div className="flex flex-col gap-2 border-t border-border bg-elevated p-4">
              {tab === "buy" ? (
                <Button
                  variant="club"
                  onClick={() => {
                    setDeal({ playerId: current.id, kind: "sign" });
                  }}
                >
                  {current.clubId === FREE_AGENT
                    ? "Negociar contrato (libre)"
                    : `Negociar · traspaso ${formatMoney(askPrice(current))}`}
                </Button>
              ) : (
                <Button
                  variant="club"
                  onClick={() => {
                    const err = takeOnLoan(current.id, loanYears);
                    setMsg(err ?? `${current.name} llega a cesión.`);
                    if (!err) setPicked(null);
                  }}
                >
                  Ceder por {formatMoney(loanFee(current, loanYears))}
                </Button>
              )}
              <Button variant="ghost" onClick={() => setPicked(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deal ? (
        <Negotiation
          key={`${deal.kind}:${deal.playerId}`}
          playerId={deal.playerId}
          kind={deal.kind}
          onClose={() => setDeal(null)}
          onDone={(m) => {
            setMsg(m);
            setPicked(null);
          }}
        />
      ) : null}

      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
    </div>
  );
}

function MarketRow({
  player,
  active,
  onPick,
}: {
  player: Player;
  active: boolean;
  onPick: () => void;
}) {
  const free = player.clubId === FREE_AGENT;
  const club = free ? null : clubById(player.clubId);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          "flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-fg/4",
          active && "bg-fg/6",
        )}
      >
        <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(player.ovr))}>
          {player.ovr}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{player.name}</span>
          <span className="text-[11px] text-fg-muted">
            {POS_LABEL[player.pos]} · {player.age} años · POT {player.pot}
            {player.nat ? ` · ${NAT_LABEL[player.nat] ?? player.nat}` : ""}
            {player.listed ? " · en venta" : ""}
          </span>
        </span>
        {club ? (
          <ClubCrest club={club} size={22} />
        ) : (
          <span className="rounded-full bg-comp-uecl/20 px-2 py-0.5 text-[10px] font-medium uppercase text-comp-uecl">
            Libre
          </span>
        )}
        <span className="w-16 text-right text-xs tabular-nums text-fg-muted">
          {free ? "Sin coste" : formatMoney(player.value)}
        </span>
      </button>
    </li>
  );
}

const KIND_LABEL: Record<TransferRecord["kind"], string> = {
  sale: "Venta",
  loan: "Cesión",
  free: "Libre",
  clause: "Cláusula",
  release: "Rescindido",
};

function Side({ id }: { id: string }) {
  if (id === FREE_AGENT) {
    return (
      <span className="rounded-full bg-comp-uecl/20 px-2 py-0.5 text-[10px] font-medium uppercase text-comp-uecl">
        Libre
      </span>
    );
  }
  const club = clubById(id);
  return (
    <span className="flex min-w-0 flex-col items-center gap-0.5">
      <ClubCrest club={club} size={26} />
      <span className="max-w-14 truncate text-[10px] text-fg-muted">{club.short}</span>
    </span>
  );
}

function HistoryRow({ t }: { t: TransferRecord }) {
  const money =
    t.kind === "free" || t.kind === "release"
      ? "Sin coste"
      : formatMoney(t.fee);
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-0",
        t.user && "bg-fg/4",
      )}
    >
      <span className="flex w-24 shrink-0 items-center justify-between gap-1">
        <Side id={t.fromId} />
        <ArrowRight className="size-4 shrink-0 text-fg-muted" aria-label="hacia" />
        <Side id={t.toId} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          <span className={cn("mr-1.5 font-display tabular-nums", ovrClass(t.ovr))}>{t.ovr}</span>
          {t.name}
        </span>
        <span className="text-[11px] text-fg-muted">
          {POS_LABEL[t.pos]} · {seasonLabel(t.season)} · sem. {t.week}
        </span>
      </span>
      <span className="text-right">
        <span
          className={cn(
            "block text-[10px] font-medium uppercase tracking-wide",
            t.kind === "loan" ? "text-comp-uel" : t.kind === "sale" || t.kind === "clause" ? "text-primary" : "text-fg-muted",
          )}
        >
          {KIND_LABEL[t.kind]}
        </span>
        <span className="text-xs tabular-nums text-fg-muted">{money}</span>
      </span>
    </li>
  );
}
