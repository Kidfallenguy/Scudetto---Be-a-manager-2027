import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { MAX_SCOUTS, SCOUT_COUNTRIES, SCOUT_TIERS, academyCapacity, scoutCost } from "@/lib/game/academy";
import { NAT_LABEL, POS_LABEL, formatMoney, ovrClass } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";
import type { Pos } from "@/lib/game/types";

const POS_OPTS: Array<Pos | "ANY"> = ["ANY", "GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LW", "RW", "ST"];

export function Academy() {
  const academy = useGame((s) => s.academy);
  const scouts = useGame((s) => s.scouts);
  const level = useGame((s) => s.academyLevel);
  const budget = useGame((s) => s.budget);
  const startScout = useGame((s) => s.startScout);
  const signYouth = useGame((s) => s.signYouth);
  const releaseYouth = useGame((s) => s.releaseYouth);
  const [countryId, setCountryId] = useState(SCOUT_COUNTRIES[0]!.id);
  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [pos, setPos] = useState<Pos | "ANY">("ANY");
  const [msg, setMsg] = useState<string | null>(null);
  const country = SCOUT_COUNTRIES.find((c) => c.id === countryId)!;
  const cost = scoutCost(country, tier);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h2 className="font-display text-3xl font-semibold">Cantera</h2>
        <p className="text-sm text-fg-muted">
          {academy.length}/{academyCapacity(level)} promesas · {scouts.length}/{MAX_SCOUTS} ojeos
        </p>
      </header>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="text-sm font-medium">Investigar país</h3>
        <p className="mt-1 text-xs text-fg-muted">
          Hasta 3 redes. Más plata, mejores chances. Las fichas salen entre €5 M y €40 M.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-fg-muted">
            País
            <select
              className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm text-fg"
              value={countryId}
              onChange={(e) => setCountryId(e.target.value)}
            >
              {SCOUT_COUNTRIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-fg-muted">
            Posición preferida
            <select
              className="mt-1 h-11 w-full rounded-xl bg-elevated px-3 text-sm text-fg"
              value={pos}
              onChange={(e) => setPos(e.target.value as Pos | "ANY")}
            >
              {POS_OPTS.map((p) => (
                <option key={p} value={p}>
                  {p === "ANY" ? "Cualquiera" : POS_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {SCOUT_TIERS.map((t) => (
            <Button
              key={t.tier}
              size="sm"
              variant={tier === t.tier ? "club" : "ghost"}
              onClick={() => setTier(t.tier)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-fg-muted">{SCOUT_TIERS.find((t) => t.tier === tier)?.blurb}</p>
        <Button
          className="mt-3"
          variant="club"
          disabled={budget < cost || scouts.length >= MAX_SCOUTS}
          onClick={() => {
            const err = startScout(countryId, tier, pos);
            setMsg(err ?? `Ojeadores rumbo a ${country.name}.`);
          }}
        >
          Enviar ojeo · {formatMoney(cost)}
        </Button>
      </section>

      {scouts.length ? (
        <ul className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          {scouts.map((m) => (
            <li key={m.id} className="flex items-center justify-between border-b border-border/60 py-2 last:border-0">
              <div>
                <p className="text-sm font-medium">{m.countryName}</p>
                <p className="text-xs text-fg-muted">
                  {m.weeksLeft} sem. · {m.preferredPos === "ANY" ? "libre" : POS_LABEL[m.preferredPos]}
                </p>
              </div>
              <span className="text-xs text-fg-muted">Red {m.tier}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-medium">Promesas</h3>
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
          {academy.length === 0 ? (
            <li className="px-3 py-4 text-sm text-fg-muted">Nadie en la cantera. Manda un ojeo.</li>
          ) : (
            academy.map((y) => (
              <li key={y.id} className="flex items-center gap-3 border-b border-border/60 px-3 py-3 last:border-0">
                <span className={cn("w-8 font-display text-lg tabular-nums", ovrClass(y.ovr))}>{y.ovr}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{y.name}</p>
                  <p className="text-[11px] text-fg-muted">
                    {POS_LABEL[y.pos]} · {NAT_LABEL[y.nat] ?? y.nat} · {y.age} años · POT {y.pot}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const err = signYouth(y.id);
                    setMsg(err ?? `${y.name} sube al primer equipo.`);
                  }}
                >
                  Firmar {formatMoney(y.fee)}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    const err = releaseYouth(y.id);
                    setMsg(err ?? `${y.name} queda libre de la cantera.`);
                  }}
                >
                  Despedir
                </Button>
                </div>
              </li>
            ))
          )}
        </ul>
      </section>
      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
    </div>
  );
}
