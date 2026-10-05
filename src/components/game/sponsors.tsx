import { useState } from "react";
import { Check, Clock, Handshake, Lock, RefreshCw, Search, Star, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { TIER_INFO, nextTierToUnlock, openTiers, tierLabel } from "@/lib/game/brands";
import { clubById } from "@/lib/game/clubs";
import { formatMoney } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";
import {
  MAX_ACTIVE_SPONSORS,
  activeSponsors,
  benefitText,
  breakFee,
  commercialReport,
  effectivePrestige,
  fansOf,
  formatFans,
  replaceDaysLeft,
  sponsorIncome,
  sponsorSearchStatus,
  sponsorSeasonPay,
  waitText,
} from "@/lib/game/sponsors";
import type { SponsorBenefit, SponsorOffer, SponsorTier } from "@/lib/game/types";

const TIER_STYLE: Record<SponsorTier, string> = {
  local: "bg-elevated text-fg-muted",
  regional: "bg-emerald-500/15 text-emerald-400",
  nacional: "bg-sky-500/15 text-sky-400",
  internacional: "bg-violet-500/15 text-violet-400",
  elite: "bg-amber-400/20 text-amber-300",
};

function TierBadge({ tier }: { tier?: SponsorTier }) {
  if (!tier) return null;
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        TIER_STYLE[tier],
      )}
    >
      {tierLabel(tier)}
    </span>
  );
}

function seasonsText(n: number) {
  return `${n} ${n === 1 ? "temporada" : "temporadas"}`;
}

function BenefitList({ benefits }: { benefits: SponsorBenefit[] }) {
  if (!benefits.length) return <p className="text-xs text-fg-subtle">Sin beneficios extra</p>;
  return (
    <ul className="flex flex-col gap-1">
      {benefits.map((b) => (
        <li key={b.kind} className="flex items-start gap-2 text-xs text-fg-muted">
          <Check className="mt-0.5 size-3 shrink-0 text-good" />
          <span>{benefitText(b)}</span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elevated px-3 py-2">
      <p className="flex items-center gap-1 text-[11px] text-fg-muted">
        {icon}
        {label}
      </p>
      <p className="font-display text-lg tabular-nums leading-tight">{value}</p>
    </div>
  );
}

export function SponsorsView() {
  const save = useGame((s) => s);
  const setScreen = useGame((s) => s.setScreen);
  const searchSponsors = useGame((s) => s.searchSponsors);
  const acceptSponsorOffer = useGame((s) => s.acceptSponsorOffer);
  const [picked, setPicked] = useState<string | null>(null);
  const [replaceId, setReplaceId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const club = clubById(save.clubId);
  const active = activeSponsors(save, save.clubId);
  const free = MAX_ACTIVE_SPONSORS - active.length;
  const status = sponsorSearchStatus(save);
  const report = commercialReport(save, save.clubId);
  const offers = save.sponsorOffers;
  const pickedOffer = offers.find((o) => o.id === picked) ?? null;
  const prestigeNow = effectivePrestige(save, save.clubId);
  const tiersOpen = openTiers(report.score);
  const nextTier = nextTierToUnlock(report.score);
  const replaceTarget = active.find((s) => s.id === replaceId) ?? null;

  const best = {
    payment: Math.max(0, ...offers.map((o) => o.payment)),
    prestige: Math.max(0, ...offers.map((o) => o.prestige)),
    duration: Math.max(0, ...offers.map((o) => o.duration)),
  };

  function search() {
    setMsg(searchSponsors());
    setPicked(null);
    setReplaceId(null);
  }

  function accept() {
    if (!pickedOffer) return;
    const err = acceptSponsorOffer(pickedOffer.id, free === 0 ? (replaceId ?? undefined) : undefined);
    setMsg(err ?? `Firmaste con ${pickedOffer.name}.`);
    if (!err) {
      setPicked(null);
      setReplaceId(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted">Club</p>
          <h2 className="font-display text-3xl font-semibold">Patrocinadores</h2>
        </div>
        <Button variant="ghost" onClick={() => setScreen("office")}>
          Despacho
        </Button>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Handshake className="size-3" />}
          label="Contratos activos"
          value={`${active.length}/${MAX_ACTIVE_SPONSORS}`}
        />
        <Stat
          icon={<span className="text-[11px]">€</span>}
          label="Ingreso por temporada"
          value={formatMoney(sponsorIncome(save, save.clubId))}
        />
        <Stat
          icon={<Users className="size-3" />}
          label="Seguidores"
          value={formatFans(fansOf(save, save.clubId))}
        />
        <Stat
          icon={<Star className="size-3" />}
          label="Prestigio del club"
          value={prestigeNow > club.prestige ? `${prestigeNow} (+${prestigeNow - club.prestige})` : `${prestigeNow}`}
        />
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <TrendingUp className="size-4" />
              Atractivo comercial
            </h3>
            <p className="mt-1 max-w-prose text-xs text-fg-muted">
              Define qué marcas se interesan por tu club y cuánto pagan. Parte del prestigio y sube con los fans, la
              tabla, los títulos, las copas y los buenos resultados.
            </p>
          </div>
          <p className="font-display text-4xl tabular-nums leading-none">{report.score}</p>
        </div>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <li className="rounded-xl bg-elevated px-3 py-2">
            <p className="text-[11px] text-fg-muted">Prestigio</p>
            <p className="text-sm tabular-nums">{report.prestige}</p>
            <p className="text-[10px] text-fg-subtle">punto de partida</p>
          </li>
          {report.factors.map((f) => (
            <li key={f.key} className="rounded-xl bg-elevated px-3 py-2">
              <p className="flex items-center justify-between gap-2 text-[11px] text-fg-muted">
                <span>{f.label}</span>
                <span
                  className={cn(
                    "tabular-nums",
                    f.points > 0.04 && "text-good",
                    f.points < -0.04 && "text-bad",
                  )}
                >
                  {f.points > 0 ? "+" : f.points < 0 ? "−" : ""}
                  {Math.abs(f.points).toFixed(1).replace(".", ",")}
                </span>
              </p>
              <p className="text-[10px] text-fg-subtle">{f.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-fg-muted">
          Te buscan marcas de nivel {tiersOpen.map((t) => TIER_INFO[t].label).join(", ")}.
          {tiersOpen.includes("elite")
            ? " Las marcas Élite aparecen de vez en cuando, y siempre de a una."
            : nextTier
              ? ` Para atraer marcas ${tierLabel(nextTier.tier)} te faltan ${nextTier.missing} ${nextTier.missing === 1 ? "punto" : "puntos"} de atractivo.`
              : ""}
        </p>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="mb-3 text-sm font-medium">Contratos vigentes</h3>
        <ul className="grid gap-3 md:grid-cols-3">
          {active.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-xl bg-elevated p-3">
              <div className="flex flex-col gap-1">
                <TierBadge tier={s.tier} />
                <p className="font-display text-lg font-semibold leading-tight">{s.name}</p>
                <p className="text-xs text-fg-muted">
                  {formatMoney(sponsorSeasonPay(s))} por temporada · prestigio {s.prestige}
                </p>
              </div>
              <BenefitList benefits={s.benefits} />
              <div className="mt-auto flex flex-col gap-0.5 text-xs text-fg-muted">
                <p className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Quedan {seasonsText(s.seasonsLeft)}
                </p>
                {replaceDaysLeft(save, s) > 0 ? (
                  <p className="flex items-center gap-1 text-fg-subtle">
                    <Lock className="size-3" />
                    Se puede reemplazar en {waitText(replaceDaysLeft(save, s))}
                  </p>
                ) : (
                  <p className="flex items-center gap-1 text-fg-subtle">
                    <RefreshCw className="size-3" />
                    Se puede reemplazar
                  </p>
                )}
              </div>
            </li>
          ))}
          {Array.from({ length: free }).map((_, i) => (
            <li
              key={`free-${i}`}
              className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border-strong text-xs text-fg-subtle"
            >
              Lugar libre
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium">Ofertas</h3>
            <p className="text-xs text-fg-muted">
              {offers.length
                ? "Compará y elegí. Las que no firmes se pierden al cambiar de temporada."
                : "Buscá patrocinadores interesados en tu club. Después de buscar o firmar hay que esperar unos 4 meses para volver a buscar."}
            </p>
          </div>
          <Button variant="club" onClick={search} disabled={!status.ok}>
            <Search />
            Buscar patrocinadores
          </Button>
        </div>
        {!status.ok ? <p className="text-xs text-fg-muted">{status.reason}</p> : null}
        {free === 0 ? (
          <p className="text-xs text-fg-muted">
            Tenés {MAX_ACTIVE_SPONSORS} patrocinadores activos: para firmar uno nuevo hay que reemplazar un contrato
            de más de 4 meses (rescindir cuesta la mitad de un pago anual) o esperar a que venza alguno.
          </p>
        ) : null}
        {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}

        {offers.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {offers.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                selected={o.id === picked}
                badges={[
                  o.payment === best.payment ? "Mayor pago" : null,
                  o.prestige === best.prestige ? "Mayor prestigio" : null,
                  o.duration === best.duration && best.duration > 1 ? "Más largo" : null,
                ].filter((x): x is string => x !== null)}
                onPick={() => {
                  setPicked(o.id === picked ? null : o.id);
                  setReplaceId(null);
                }}
              />
            ))}
          </ul>
        ) : null}

        {pickedOffer ? (
          <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 flex flex-col gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)] md:bottom-4">
            <p className="text-sm">
              <span className="font-medium">{pickedOffer.name}</span>
              <span className="text-fg-muted">
                {" "}
                · cobrás {formatMoney(sponsorSeasonPay(pickedOffer))} ahora y por {seasonsText(pickedOffer.duration)}
              </span>
            </p>
            {free === 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-fg-muted">Elegí qué contrato reemplaza:</p>
                <ul className="grid gap-1.5 sm:grid-cols-3">
                  {active.map((s) => {
                    const wait = replaceDaysLeft(save, s);
                    const locked = wait > 0;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          disabled={locked}
                          aria-pressed={s.id === replaceId}
                          onClick={() => setReplaceId(s.id === replaceId ? null : s.id)}
                          className={cn(
                            "flex w-full flex-col rounded-xl bg-elevated px-3 py-2 text-left text-xs transition-shadow disabled:opacity-50",
                            s.id === replaceId && "ring-2 ring-club",
                          )}
                        >
                          <span className="font-medium">{s.name}</span>
                          <span className="text-fg-muted">
                            {locked ? `Disponible en ${waitText(wait)}` : `Rescisión: ${formatMoney(breakFee(s))}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
            <Button variant="club" onClick={accept} disabled={free === 0 && !replaceTarget}>
              {free === 0 && replaceTarget ? `Reemplazar a ${replaceTarget.name}` : "Aceptar oferta"}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function OfferCard({
  offer,
  selected,
  badges,
  onPick,
}: {
  offer: SponsorOffer;
  selected: boolean;
  badges: string[];
  onPick: () => void;
}) {
  const perSeason = sponsorSeasonPay(offer);
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={selected}
        className={cn(
          "flex h-full w-full flex-col gap-3 rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-border)] transition-shadow",
          selected && "ring-2 ring-club",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1">
              <TierBadge tier={offer.tier} />
              {offer.renewal ? (
                <span className="inline-flex w-fit rounded-full bg-club/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                  Renovación
                </span>
              ) : null}
            </div>
            <p className="font-display text-xl font-semibold leading-tight">{offer.name}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {badges.map((b) => (
              <span key={b} className="rounded-full bg-elevated px-2 py-0.5 text-[10px] text-fg-muted">
                {b}
              </span>
            ))}
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-elevated px-2 py-1.5">
            <dt className="text-[11px] text-fg-muted">Dinero</dt>
            <dd className="font-display text-base tabular-nums">{formatMoney(perSeason)}</dd>
            <dd className="text-[10px] text-fg-subtle">por temporada</dd>
          </div>
          <div className="rounded-lg bg-elevated px-2 py-1.5">
            <dt className="text-[11px] text-fg-muted">Prestigio</dt>
            <dd className="font-display text-base tabular-nums">{offer.prestige}</dd>
            <dd className="text-[10px] text-fg-subtle">de 100</dd>
          </div>
          <div className="rounded-lg bg-elevated px-2 py-1.5">
            <dt className="text-[11px] text-fg-muted">Duración</dt>
            <dd className="font-display text-base tabular-nums">{offer.duration}</dd>
            <dd className="text-[10px] text-fg-subtle">{offer.duration === 1 ? "temporada" : "temporadas"}</dd>
          </div>
        </dl>
        <div>
          <p className="mb-1 text-[11px] uppercase tracking-wide text-fg-muted">Beneficios</p>
          <BenefitList benefits={offer.benefits} />
        </div>
        <p className="mt-auto text-xs text-fg-muted">
          Total fijo del contrato: {formatMoney(perSeason * offer.duration)}
        </p>
      </button>
    </li>
  );
}
