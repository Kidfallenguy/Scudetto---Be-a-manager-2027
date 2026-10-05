import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ALL_PLAYABLE_LEAGUES, clubById, domesticCompetition, leagueInfo } from "@/lib/game/clubs";
import { COMP_THEME, QUAL_COLOR, QUAL_LABEL, compShort, qualBandForPlace, type QualBand } from "@/lib/game/competitions";
import { userStillIn } from "@/lib/game/participation";
import { useGame } from "@/lib/game/store";
import type { CalendarSlot, Competition, Fixture, PlayableLeagueId } from "@/lib/game/types";
import { sortTable } from "@/lib/game/world";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

type DayEntry = { slot: CalendarSlot; index: number };

/** Calendario global: todos los partidos de todas las ligas y copas de la temporada, más tablas de cada liga. */
export function CalendarView() {
  const calendar = useGame((s) => s.calendar);
  const fixtures = useGame((s) => s.fixtures);
  const cursor = useGame((s) => s.cursor);
  const clubId = useGame((s) => s.clubId);
  const leagueTables = useGame((s) => s.leagueTables);
  const save = useGame((s) => s);
  const [mine, setMine] = useState(true);
  const [view, setView] = useState<"year" | "tables">("year");
  const [day, setDay] = useState<string | null>(null);
  const [filter, setFilter] = useState<Competition | "all">("all");
  const [tableLeague, setTableLeague] = useState<PlayableLeagueId>(
    () => (clubById(clubId).league as PlayableLeagueId) ?? "serieA",
  );

  const fixtureMap = useMemo(() => new Map(fixtures.map((f) => [f.id, f])), [fixtures]);

  // Slots que le importan al usuario: donde juega él, o cruces por definir de una copa en la que sigue vivo.
  // Las copas en las que no está (o de las que ya fue eliminado) no aparecen para jugar.
  const slotIsMine = (slot: CalendarSlot) => {
    const hasUser = slot.fixtures.some((id) => {
      const f = fixtureMap.get(id);
      return f ? f.homeId === clubId || f.awayId === clubId : false;
    });
    if (hasUser) return true;
    return slot.fixtures.length === 0 && userStillIn(save, slot.competition);
  };

  const visibleCalendar = useMemo(
    () => (mine ? calendar.filter(slotIsMine) : calendar),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calendar, fixtureMap, mine, clubId, save.cursor, save.fixtures],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    calendar.forEach((slot, index) => {
      if (!slot.date) return;
      if (filter !== "all" && slot.competition !== filter) return;
      if (mine && !visibleCalendar.includes(slot)) return;
      const list = map.get(slot.date) ?? [];
      list.push({ slot, index });
      map.set(slot.date, list);
    });
    return map;
  }, [calendar, filter, mine, visibleCalendar]);

  const months = useMemo(() => {
    const dates = calendar.map((s) => s.date).filter(Boolean) as string[];
    if (!dates.length) return [];
    dates.sort();
    const [y0, m0] = dates[0]!.split("-").map(Number) as [number, number];
    const [y1, m1] = dates[dates.length - 1]!.split("-").map(Number) as [number, number];
    const out: Array<{ year: number; month: number }> = [];
    let y = y0;
    let m = m0;
    while (y < y1 || (y === y1 && m <= m1)) {
      out.push({ year: y, month: m });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }, [calendar]);

  const comps = useMemo(() => [...new Set(visibleCalendar.map((s) => s.competition))], [visibleCalendar]);
  const today = calendar[cursor]?.date ?? null;
  const selected = day ? (byDay.get(day) ?? []) : [];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="font-display text-3xl font-semibold">Calendario del mundo</h2>
        <p className="text-sm text-fg-muted">Todas las ligas y copas de la temporada, con resultados al día.</p>
      </header>

      <div className="flex gap-1">
        <Button size="sm" variant={view === "year" ? "club" : "ghost"} onClick={() => setView("year")}>
          Año completo
        </Button>
        <Button size="sm" variant={view === "tables" ? "club" : "ghost"} onClick={() => setView("tables")}>
          Tablas de ligas
        </Button>
      </div>

      {view === "year" ? (
        <>
          <div className="flex gap-1">
            <Button size="sm" variant={mine ? "club" : "ghost"} onClick={() => { setMine(true); setFilter("all"); }}>
              Mis competiciones
            </Button>
            <Button size="sm" variant={!mine ? "club" : "ghost"} onClick={() => { setMine(false); setFilter("all"); }}>
              Todo el mundo
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant={filter === "all" ? "club" : "ghost"} onClick={() => setFilter("all")}>
              Todas
            </Button>
            {comps.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFilter(c)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors",
                  filter === c ? "text-bg" : "bg-transparent text-fg-muted hover:bg-fg/6 hover:text-fg",
                )}
                style={filter === c ? { background: COMP_THEME[c].accent } : undefined}
              >
                <span className="size-2 rounded-full" style={{ background: COMP_THEME[c].accent }} />
                {compShort(c, clubById(clubId).league)}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {months.map(({ year, month }) => (
              <MonthGrid
                key={`${year}-${month}`}
                year={year}
                month={month}
                byDay={byDay}
                cursor={cursor}
                today={today}
                day={day}
                onPick={setDay}
              />
            ))}
          </div>

          <p className="text-sm text-fg-muted">
            Toca un día marcado para ver los partidos en una ventana emergente.
          </p>
          {day ? (
            <DayModal title={prettyDate(day)} onClose={() => setDay(null)}>
              {selected.length === 0 ? <p className="text-sm text-fg-muted">Sin partidos este día.</p> : null}
              {selected.map(({ slot, index }) => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  played={index < cursor}
                  fixtureMap={fixtureMap}
                  clubId={clubId}
                  mineOnly={mine}
                />
              ))}
            </DayModal>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {ALL_PLAYABLE_LEAGUES.map((lg) => (
              <button
                key={lg}
                type="button"
                onClick={() => setTableLeague(lg)}
                className={cn(
                  "inline-flex h-9 items-center rounded-md px-3 text-sm transition-colors",
                  tableLeague === lg ? "text-bg" : "text-fg-muted hover:bg-fg/6 hover:text-fg",
                )}
                style={
                  tableLeague === lg ? { background: COMP_THEME[domesticCompetition(lg)].accent } : undefined
                }
              >
                {leagueInfo(lg).title}
              </button>
            ))}
          </div>
          <WorldTable league={tableLeague} rows={sortTable(leagueTables[tableLeague] ?? [])} clubId={clubId} />
        </>
      )}
    </div>
  );
}

function DayModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/75 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-elevated shadow-[var(--shadow-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="font-display text-xl font-semibold">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose} aria-label="Cerrar">
            <X />
          </Button>
        </header>
        <div className="flex flex-col gap-3 overflow-y-auto p-3 sm:p-4">{children}</div>
      </div>
    </div>
  );
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return `${d} de ${MONTHS[m - 1]!.toLowerCase()} de ${y}`;
}

function MonthGrid({
  year,
  month,
  byDay,
  cursor,
  today,
  day,
  onPick,
}: {
  year: number;
  month: number;
  byDay: Map<string, DayEntry[]>;
  cursor: number;
  today: string | null;
  day: string | null;
  onPick: (d: string) => void;
}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<number | null> = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className="rounded-2xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <p className="mb-2 font-display text-lg font-semibold">
        {MONTHS[month - 1]} <span className="text-fg-muted">{year}</span>
      </p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-fg-subtle">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const entries = byDay.get(iso);
          const isToday = today === iso;
          const comps = entries ? [...new Set(entries.map((e) => e.slot.competition))] : [];
          const allDone = entries?.every((e) => e.index < cursor);
          return (
            <button
              key={iso}
              type="button"
              disabled={!entries}
              onClick={() => onPick(iso)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-md text-[11px] tabular-nums transition-colors",
                entries ? "text-fg hover:bg-fg/10" : "text-fg-subtle",
                day === iso && "bg-fg/15",
                isToday && "ring-1 ring-primary",
                allDone && "opacity-60",
              )}
            >
              {d}
              {comps.length ? (
                <span className="absolute bottom-0.5 flex gap-0.5">
                  {comps.slice(0, 3).map((c) => (
                    <span key={c} className="size-1 rounded-full" style={{ background: COMP_THEME[c].accent }} />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  played,
  fixtureMap,
  clubId,
  mineOnly,
}: {
  slot: CalendarSlot;
  played: boolean;
  fixtureMap: Map<string, Fixture>;
  clubId: string;
  mineOnly: boolean;
}) {
  const theme = COMP_THEME[slot.competition];
  let list = slot.fixtures.map((id) => fixtureMap.get(id)).filter(Boolean) as Fixture[];
  // En "Mis competiciones" la jornada de liga muestra solo tu liga, no las de otros países.
  if (mineOnly) list = list.filter((f) => f.competition === slot.competition);
  // Los partidos del usuario primero.
  list.sort((a, b) => Number(isMine(b, clubId)) - Number(isMine(a, clubId)));
  return (
    <article
      className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]"
      style={{ boxShadow: `0 0 0 1px color-mix(in oklab, ${theme.accent} 40%, transparent)` }}
    >
      <header
        className="flex items-center justify-between gap-2 px-3 py-2"
        style={{ background: `color-mix(in oklab, ${theme.accent} 22%, transparent)` }}
      >
        <p className="text-sm font-medium" style={{ color: theme.accent }}>
          {slot.title}
        </p>
        <span className="text-[11px] text-fg-muted">{played ? "Jugada" : "Pendiente"}</span>
      </header>
      {list.length === 0 ? (
        <p className="px-3 py-3 text-sm text-fg-muted">Cruces por definir.</p>
      ) : (
        <ul className="grid sm:grid-cols-2">
          {list.map((f) => {
            const home = clubById(f.homeId);
            const away = clubById(f.awayId);
            return (
              <li
                key={f.id}
                className={cn(
                  "flex items-center gap-2 border-t border-border/60 px-3 py-2 text-sm",
                  isMine(f, clubId) && "bg-primary/10",
                )}
              >
                <ClubCrest club={home} size={20} />
                <span className="w-24 truncate">{home.short}</span>
                <span className="flex-1 text-center font-display text-lg tabular-nums">
                  {f.played ? `${f.homeGoals}–${f.awayGoals}` : "vs"}
                </span>
                <span className="w-24 truncate text-right">{away.short}</span>
                <ClubCrest club={away} size={20} />
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function isMine(f: Fixture, clubId: string) {
  return f.homeId === clubId || f.awayId === clubId;
}

function WorldTable({
  league,
  rows,
  clubId,
}: {
  league: PlayableLeagueId;
  rows: ReturnType<typeof sortTable>;
  clubId: string;
}) {
  const legend = (["ucl", "uel", "uecl", "libertadores", "sudamericana", "releg"] as QualBand[]).filter((b) =>
    rows.some((_, i) => qualBandForPlace(league, i + 1, rows.length) === b),
  );
  return (
    <div className="overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-fg-muted">
          <tr className="border-b border-border">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-2 py-2 font-medium">Club</th>
            <th className="px-2 py-2 font-medium">PJ</th>
            <th className="px-2 py-2 font-medium">DG</th>
            <th className="px-3 py-2 text-right font-medium">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const c = clubById(row.clubId);
            const band = qualBandForPlace(league, i + 1, rows.length);
            const mine = row.clubId === clubId;
            return (
              <tr
                key={row.clubId}
                className="border-b border-border/60"
                style={
                  band !== "mid"
                    ? { background: `color-mix(in oklab, ${QUAL_COLOR[band]} ${mine ? 24 : 13}%, transparent)` }
                    : mine
                      ? { background: "color-mix(in oklab, var(--color-primary) 12%, transparent)" }
                      : undefined
                }
              >
                <td
                  className="px-3 py-2 font-display tabular-nums text-fg-muted"
                  style={{ boxShadow: `inset 4px 0 0 ${QUAL_COLOR[band]}` }}
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
