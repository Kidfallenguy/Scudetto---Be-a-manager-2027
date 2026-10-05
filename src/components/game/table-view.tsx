import { useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { clubById, domesticCompetition, leagueInfo } from "@/lib/game/clubs";
import {
  COMP_THEME,
  QUAL_COLOR,
  QUAL_LABEL,
  compLabel,
  compPanelStyle,
  continentalCompsFor,
  stageLabel,
  qualBandForPlace,
  type QualBand,
} from "@/lib/game/competitions";
import { useGame } from "@/lib/game/store";
import type { Competition, Fixture, LeagueKind, PlayableLeagueId } from "@/lib/game/types";
import { sortTable } from "@/lib/game/world";

export function TableView() {
  const clubId = useGame((s) => s.clubId);
  const standings = useGame((s) => s.standings);
  const uclStandings = useGame((s) => s.uclStandings);
  const fixtures = useGame((s) => s.fixtures);
  const uclGroups = useGame((s) => s.uclGroups);
  const libStandings = useGame((s) => s.libStandings);
  const libGroups = useGame((s) => s.libGroups);
  const club = clubById(clubId);
  const leagueTab = domesticCompetition(club.league);
  const [tab, setTab] = useState<Competition>(leagueTab);

  const info = leagueInfo(club.league);
  // Solo las competiciones del país/región del club: UEFA (Champions, Europa, Conference) para ligas europeas.
  // Clubes argentinos: Libertadores y Sudamericana (CONMEBOL).
  const continentalTabs = continentalCompsFor(club.league);
  const europeanTabs = continentalTabs.filter((c) => c === "ucl" || c === "uel" || c === "uecl");
  const tabs: Competition[] = [
    leagueTab,
    "coppa",
    ...continentalTabs,
    "supercoppa",
    ...(club.league === "argentina" ? (["trofeo"] as Competition[]) : []),
    "mundial",
  ];

  const isPlayable = ["serieA", "premier", "laliga", "bundesliga", "ligue1", "argentina"].includes(club.league);
  const bandOf = isPlayable
    ? (place: number, n: number): QualBand => qualBandForPlace(club.league as PlayableLeagueId, place, n)
    : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-3xl p-3 transition-colors" style={compPanelStyle(tab)}>
      <header>
        <h2 className="font-display text-3xl font-semibold" style={{ color: COMP_THEME[tab].accent }}>
          Tablas y copas
        </h2>
        <p className="text-sm text-fg-muted">
          {info.title}, {info.cup} y copas {europeanTabs.length ? "europeas" : "sudamericanas"}
        </p>
      </header>
      <div className="flex flex-wrap gap-1">
        {tabs.map((c) => (
          <Button key={c} size="sm" variant={tab === c ? "club" : "ghost"} onClick={() => setTab(c)}>
            {compLabel(c, club.league)}
          </Button>
        ))}
      </div>

      {tab === leagueTab ? <LeagueTable rows={sortTable(standings)} clubId={clubId} bandOf={bandOf} /> : null}
      {tab === "ucl" ? (
        <div className="flex flex-col gap-4">
          {uclGroups.map((group, i) => (
            <div key={group.join("-")}>
              <h3 className="mb-2 text-sm font-medium text-fg-muted">Grupo {String.fromCharCode(65 + i)}</h3>
              <LeagueTable
                rows={sortTable(uclStandings.filter((r) => group.includes(r.clubId)))}
                clubId={clubId}
                compact
              />
            </div>
          ))}
          <KnockoutList
            fixtures={fixtures.filter((f) => f.competition === "ucl" && f.round >= 7)}
            clubId={clubId}
            comp="ucl"
            league={club.league}
          />
        </div>
      ) : null}
      {tab === "libertadores" ? (
        <div className="flex flex-col gap-4">
          {libGroups.map((group, i) => (
            <div key={group.join("-")}>
              <h3 className="mb-2 text-sm font-medium text-fg-muted">Grupo {String.fromCharCode(65 + i)}</h3>
              <LeagueTable
                rows={sortTable(libStandings.filter((r) => group.includes(r.clubId)))}
                clubId={clubId}
                compact
              />
            </div>
          ))}
          <KnockoutList
            fixtures={fixtures.filter((f) => f.competition === "libertadores" && f.round >= 7)}
            clubId={clubId}
            comp="libertadores"
            league={club.league}
          />
        </div>
      ) : null}
      {tab === "sudamericana" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "sudamericana")}
          clubId={clubId}
          comp="sudamericana"
          league={club.league}
        />
      ) : null}
      {tab === "coppa" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "coppa")}
          clubId={clubId}
          comp="coppa"
          league={club.league}
        />
      ) : null}
      {tab === "uel" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "uel")}
          clubId={clubId}
          comp="uel"
          league={club.league}
        />
      ) : null}
      {tab === "uecl" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "uecl")}
          clubId={clubId}
          comp="uecl"
          league={club.league}
        />
      ) : null}
      {tab === "trofeo" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "trofeo")}
          clubId={clubId}
          comp="trofeo"
          league={club.league}
        />
      ) : null}
      {tab === "supercoppa" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "supercoppa")}
          clubId={clubId}
          comp="supercoppa"
          league={club.league}
        />
      ) : null}
      {tab === "mundial" ? (
        <KnockoutList
          fixtures={fixtures.filter((f) => f.competition === "mundial")}
          clubId={clubId}
          comp="mundial"
          league={club.league}
        />
      ) : null}
    </div>
  );
}

function LeagueTable({
  rows,
  clubId,
  compact,
  bandOf,
}: {
  rows: ReturnType<typeof sortTable>;
  clubId: string;
  compact?: boolean;
  bandOf?: (place: number, nTeams: number) => QualBand;
}) {
  const legend = bandOf
    ? (["ucl", "uel", "uecl", "libertadores", "sudamericana", "releg"] as QualBand[]).filter((b) =>
        rows.some((_, i) => bandOf(i + 1, rows.length) === b),
      )
    : [];
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-fg-muted">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Club</th>
            <th className="px-2 py-2 font-medium">PJ</th>
            {!compact ? <th className="hidden px-2 py-2 font-medium sm:table-cell">G</th> : null}
            <th className="px-2 py-2 font-medium">DG</th>
            <th className="px-3 py-2 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const c = clubById(row.clubId);
            const mine = row.clubId === clubId;
            const band = bandOf ? bandOf(i + 1, rows.length) : "mid";
            const color = QUAL_COLOR[band];
            return (
              <tr
                key={row.clubId}
                className={cn("border-b border-border/60", mine && "bg-primary/12")}
                style={
                  band !== "mid"
                    ? { background: `color-mix(in oklab, ${color} ${mine ? 24 : 13}%, transparent)` }
                    : undefined
                }
              >
                <td
                  className="px-3 py-2 font-display tabular-nums text-fg-muted"
                  style={{ boxShadow: `inset 4px 0 0 ${color}` }}
                >
                  {i + 1}
                </td>
                <td className="px-2 py-2">
                  <span className="flex items-center gap-2">
                    <ClubCrest club={c} size={22} />
                    <span className={cn("truncate", mine && "font-medium")}>{c.short}</span>
                  </span>
                </td>
                <td className="px-2 tabular-nums text-fg-muted">{row.played}</td>
                {!compact ? (
                  <td className="hidden px-2 tabular-nums text-fg-muted sm:table-cell">{row.won}</td>
                ) : null}
                <td className="px-2 tabular-nums text-fg-muted">{row.gf - row.ga}</td>
                <td className="px-3 text-right font-display text-lg tabular-nums">{row.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {legend.length ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-[11px] text-fg-muted">
          {legend.map((b) => (
            <li key={b} className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: QUAL_COLOR[b] }} />
              {QUAL_LABEL[b]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function KnockoutList({
  fixtures,
  clubId,
  comp,
  league,
}: {
  fixtures: Fixture[];
  clubId: string;
  comp: Competition;
  league: LeagueKind;
}) {
  const rounds = [...new Set(fixtures.map((f) => f.round))].sort((a, b) => a - b);
  if (rounds.length === 0) {
    return <p className="text-sm text-fg-muted">Aún no hay cruces.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {rounds.map((r) => (
        <section key={r}>
          <h3 className="mb-2 text-sm font-medium text-fg-muted">{stageLabel(comp, league, r)}</h3>
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
            {fixtures
              .filter((f) => f.round === r)
              .map((f) => {
                const home = clubById(f.homeId);
                const away = clubById(f.awayId);
                const mine = f.homeId === clubId || f.awayId === clubId;
                return (
                  <li
                    key={f.id}
                    className={cn(
                      "flex items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-0",
                      mine && "bg-primary/10",
                    )}
                  >
                    <ClubCrest club={home} size={22} />
                    <span className="w-12 truncate text-sm">{home.short}</span>
                    <span className="flex-1 text-center font-display text-xl tabular-nums">
                      {f.played ? `${f.homeGoals}–${f.awayGoals}` : "vs"}
                    </span>
                    <span className="w-12 truncate text-right text-sm">{away.short}</span>
                    <ClubCrest club={away} size={22} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}