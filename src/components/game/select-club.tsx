import { useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CLUBS, LEAGUE_INFO, startingBudget, type PlayableLeague } from "@/lib/game/clubs";
import { formatMoney } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";

function uniqueClubs(league: PlayableLeague) {
  const seen = new Set<string>();
  return CLUBS.filter((c) => {
    if (c.league !== league || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}

const BY_LEAGUE = {
  serieA: uniqueClubs("serieA"),
  premier: uniqueClubs("premier"),
  laliga: uniqueClubs("laliga"),
  bundesliga: uniqueClubs("bundesliga"),
  ligue1: uniqueClubs("ligue1"),
  argentina: uniqueClubs("argentina"),
};

function featuredOf(league: PlayableLeague) {
  const list = BY_LEAGUE[league];
  return list.find((c) => c.featured) ?? list[0]!;
}

export function SelectClub() {
  const newGame = useGame((s) => s.newGame);
  const openSlots = useGame((s) => s.openSlots);
  const slot = useGame((s) => s.slot);
  const [league, setLeague] = useState<PlayableLeague>("laliga");
  const [picked, setPicked] = useState(featuredOf("laliga").id);

  const list = BY_LEAGUE[league];
  const featured = featuredOf(league);
  const rest = list.filter((c) => c.id !== featured.id);
  const club = list.find((c) => c.id === picked) ?? featured;
  const info = LEAGUE_INFO[league];

  const selectLeague = (next: PlayableLeague) => {
    setLeague(next);
    setPicked(featuredOf(next).id);
  };

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-8 md:py-12">
        <header className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-fg-muted">
            Slot {slot + 1} · Modo mánager
          </p>
          <h1 className="font-display text-6xl font-semibold leading-none tracking-tight md:text-8xl">
            Scudetto
          </h1>
          <p className="max-w-xl text-fg-muted">
            Elige un club de La Liga, Serie A, Premier League, Bundesliga, Ligue 1 o la Liga Profesional Argentina. Arma el once y pelea la liga, la copa y el continente.
          </p>
        </header>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface p-1 shadow-[var(--shadow-border)] sm:grid-cols-3 md:grid-cols-6">
          {(["laliga", "serieA", "premier", "bundesliga", "ligue1", "argentina"] as const).map((id) => (
            <Button
              key={id}
              variant={league === id ? "club" : "ghost"}
              className="min-h-11 px-2 text-xs sm:text-sm"
              onClick={() => selectLeague(id)}
            >
              {LEAGUE_INFO[id].title}
            </Button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPicked(featured.id)}
          className={cn(
            "relative overflow-hidden rounded-2xl p-5 text-left shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)] md:p-8",
            picked === featured.id ? "shadow-[var(--shadow-border-hover)]" : "",
          )}
          style={{
            background: `linear-gradient(105deg, color-mix(in oklab, ${featured.color} 28%, #12141a) 0%, #12141a 55%)`,
          }}
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted">
            Club recomendado
          </p>
          <div className="mt-4 flex items-center gap-4">
            <ClubCrest club={featured} size={72} />
            <div>
              <h2 className="font-display text-4xl font-semibold leading-none md:text-6xl">
                {featured.name}
              </h2>
              <p className="mt-2 flex items-center gap-1.5 text-sm text-fg-muted">
                <MapPin className="size-3.5" />
                {featured.stadium} · {featured.city}
              </p>
            </div>
          </div>
        </button>

        <section className="pb-28">
          <h3 className="mb-3 text-sm font-medium text-fg-muted">{info.rest}</h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {rest.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPicked(c.id)}
                className={cn(
                  "flex min-h-20 flex-col items-center gap-2 rounded-xl p-3 shadow-[var(--shadow-border)] transition-[box-shadow,background-color] duration-[var(--motion-quick)]",
                  picked === c.id ? "bg-elevated shadow-[var(--shadow-border-hover)]" : "bg-surface",
                )}
              >
                <ClubCrest club={c} size={40} />
                <span className="text-center text-xs font-medium leading-tight">{c.short}</span>
              </button>
            ))}
          </div>
        </section>

        <footer className="sticky bottom-4 flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ClubCrest club={club} size={44} />
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-semibold leading-none">{club.name}</p>
              <p className="mt-1 text-sm text-fg-muted">
                Presupuesto inicial {formatMoney(startingBudget(club.prestige))} · {club.stadium}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => openSlots()}>
              Volver
            </Button>
            <Button
              variant="club"
              size="lg"
              className="flex-1 md:flex-none"
              onClick={() => newGame(club.id)}
              style={{ "--club": club.color } as React.CSSProperties}
            >
              Tomar el cargo
              <ArrowRight />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}