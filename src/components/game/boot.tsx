import { Button } from "@/components/ui/button";
import { isKnownClub } from "@/lib/game/clubs";
import { useGame } from "@/lib/game/store";

export function Boot() {
  const clubId = useGame((s) => s.clubId);
  const setScreen = useGame((s) => s.setScreen);
  const openSlots = useGame((s) => s.openSlots);
  const hasCareer = isKnownClub(clubId);

  return (
    <div className="flex min-h-dvh flex-col justify-end bg-bg px-5 pb-24 pt-16">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-fg-muted">
            Italia · Inglaterra · España · Alemania · Francia
          </p>
          <h1 className="mt-3 font-display text-7xl font-semibold leading-[0.85] tracking-tight md:text-8xl">
            Scudetto
          </h1>
          <p className="mt-5 max-w-sm text-fg-muted">
            Career de La Liga, Serie A, Premier, Bundesliga y Ligue 1. Plantilla, táctica, mercado, cantera y las copas.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {hasCareer ? (
            <Button variant="club" size="lg" onClick={() => setScreen("office")}>
              Continuar carrera
            </Button>
          ) : null}
          <Button
            variant={hasCareer ? "outline" : "club"}
            size="lg"
            onClick={() => openSlots()}
          >
            {hasCareer ? "Partidas / nuevo club" : "Elegir club"}
          </Button>
        </div>
      </div>
    </div>
  );
}
