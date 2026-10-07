import {
  ArrowRightLeft,
  Briefcase,
  CalendarDays,
  Layers,
  LayoutGrid,
  ScrollText,
  Table2,
  Users,
} from "lucide-react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { clubById } from "@/lib/game/clubs";
import { formatMoney, seasonLabel } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";
import type { Screen } from "@/lib/game/types";

const TABS: Array<{ id: Screen; label: string; icon: typeof Briefcase }> = [
  { id: "office", label: "Despacho", icon: Briefcase },
  { id: "career", label: "Carrera", icon: ScrollText },
  { id: "squad", label: "Plantilla", icon: Users },
  { id: "tactics", label: "Táctica", icon: LayoutGrid },
  { id: "table", label: "Tablas", icon: Table2 },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
  { id: "market", label: "Mercado", icon: ArrowRightLeft },
];

export function GameShell({ children }: { children: React.ReactNode }) {
  const clubId = useGame((s) => s.clubId);
  const screen = useGame((s) => s.screen);
  const setScreen = useGame((s) => s.setScreen);
  const openSlots = useGame((s) => s.openSlots);
  const budget = useGame((s) => s.budget);
  const season = useGame((s) => s.season);
  const offerCount = useGame((s) => s.offers.filter((o) => o.toClubId === s.clubId).length);
  const club = clubById(clubId);

  return (
    <div
      className="flex min-h-dvh flex-col bg-bg text-fg"
      style={
        {
          "--club": club.color,
          "--club-fg": luminance(club.color) > 0.62 ? "#141414" : "#fff6f2",
        } as React.CSSProperties
      }
    >
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <ClubCrest club={club} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-semibold leading-tight tracking-wide">
              {club.name}
            </p>
            <p className="text-xs text-fg-muted">{seasonLabel(season)}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-lg tabular-nums leading-none">{formatMoney(budget)}</p>
            <p className="text-[11px] text-fg-muted">presupuesto</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 shrink-0"
            onClick={() => openSlots()}
            aria-label="Partidas guardadas"
          >
            <Layers className="size-4" />
          </Button>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-1 px-3 pb-2 md:flex">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              variant={screen === tab.id ? "club" : "ghost"}
              size="sm"
              onClick={() => setScreen(tab.id)}
              className="h-9"
            >
              <tab.icon />
              {tab.label}
              {tab.id === "market" && offerCount > 0 ? <OfferBadge count={offerCount} /> : null}
            </Button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <div className="grid grid-cols-7">
          {TABS.map((tab) => {
            const active = screen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScreen(tab.id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                  active ? "text-primary" : "text-fg-muted",
                )}
              >
                <span className="relative">
                  <tab.icon className="size-5" />
                  {tab.id === "market" && offerCount > 0 ? (
                    <OfferBadge count={offerCount} className="absolute -right-3 -top-2" />
                  ) : null}
                </span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function OfferBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span
      aria-label={`${count} ofertas nuevas`}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium leading-5 text-primary-foreground",
        className,
      )}
    >
      {count}
    </span>
  );
}

function luminance(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
