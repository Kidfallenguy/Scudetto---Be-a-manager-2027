import { useEffect } from "react";
import { Academy } from "@/components/game/academy";
import { AwardsCeremony } from "@/components/game/awards-ceremony";
import { BoardView } from "@/components/game/board";
import { Boot } from "@/components/game/boot";
import { Cabinet } from "@/components/game/cabinet";
import { CalendarView } from "@/components/game/calendar-view";
import { MatchLive, MatchPreview, MatchResultView } from "@/components/game/match-view";
import { Market } from "@/components/game/market";
import { CareerView } from "@/components/game/career";
import { Office } from "@/components/game/office";
import { GamePopups } from "@/components/game/popups";
import { SackedView } from "@/components/game/sacked";
import { SeasonEnd } from "@/components/game/season-end";
import { SelectClub } from "@/components/game/select-club";
import { GameShell } from "@/components/game/shell";
import { SlotsScreen } from "@/components/game/slots";
import { SponsorsView } from "@/components/game/sponsors";
import { Squad } from "@/components/game/squad";
import { TableView } from "@/components/game/table-view";
import { TacticsView } from "@/components/game/tactics-view";
import { TrainView } from "@/components/game/train";
import { isKnownClub } from "@/lib/game/clubs";
import { useGame } from "@/lib/game/store";

export function GameApp() {
  const hydrated = useGame((s) => s.hydrated);
  const screen = useGame((s) => s.screen);
  const clubId = useGame((s) => s.clubId);
  const sacked = useGame((s) => Boolean(s.board?.sacked));
  const valid = isKnownClub(clubId);

  useEffect(() => {
    const unsub = useGame.persist.onFinishHydration(() => {
      useGame.getState().setHydrated(true);
    });
    if (useGame.persist.hasHydrated()) useGame.getState().setHydrated(true);
    return unsub;
  }, []);

  if (!hydrated || screen === "boot") {
    return <Boot />;
  }
  if (screen === "slots") return <SlotsScreen />;
  if (screen === "select") return <SelectClub />;

  if (!valid) {
    return <SlotsScreen />;
  }

  // El partido que provocó el despido se ve completo; después aparece la pantalla de despido.
  if (screen === "match") {
    return <MatchLive />;
  }
  if (screen === "result") {
    return <MatchResultView />;
  }
  if (sacked) {
    return <SackedView />;
  }
  if (screen === "preview") {
    return <MatchPreview />;
  }
  if (screen === "awards") {
    return <AwardsCeremony />;
  }
  if (screen === "season-end") {
    return (
      <>
        <SeasonEnd />
        <GamePopups />
      </>
    );
  }

  return (
    <>
      <GameShell>
        {screen === "office" ? <Office /> : null}
        {screen === "career" ? <CareerView /> : null}
        {screen === "squad" ? <Squad /> : null}
        {screen === "tactics" ? <TacticsView /> : null}
        {screen === "table" ? <TableView /> : null}
        {screen === "calendar" ? <CalendarView /> : null}
        {screen === "market" ? <Market /> : null}
        {screen === "cabinet" ? <Cabinet /> : null}
        {screen === "academy" ? <Academy /> : null}
        {screen === "train" ? <TrainView /> : null}
        {screen === "board" ? <BoardView /> : null}
        {screen === "sponsors" ? <SponsorsView /> : null}
      </GameShell>
      <GamePopups />
    </>
  );
}
