import { useState } from "react";
import { ArrowRight, Dumbbell, Handshake, Newspaper, Sprout, Trophy } from "lucide-react";
import { BoardCard } from "@/components/game/board";
import { CareerCard } from "@/components/game/career";
import { ClubCrest } from "@/components/game/crest";
import { MatchHistoryModal } from "@/components/game/match-history";
import { Button } from "@/components/ui/button";
import { clubById } from "@/lib/game/clubs";
import { formatMoney, formatWage, seasonLabel } from "@/lib/game/format";
import { honourKinds, honourLabel } from "@/lib/game/honours";
import { COMP_THEME, compLabel, compPanelStyle } from "@/lib/game/competitions";
import { formString, nextUserStep, pendingLabel, tablePlace } from "@/lib/game/selectors";
import { useGame, weeklyWages } from "@/lib/game/store";
import { sortTable } from "@/lib/game/world";

export function Office() {
  const clubId = useGame((s) => s.clubId);
  const season = useGame((s) => s.season);
  const budget = useGame((s) => s.budget);
  const news = useGame((s) => s.news);
  const standings = useGame((s) => s.standings);
  const goToNextMatch = useGame((s) => s.goToNextMatch);
  const setScreen = useGame((s) => s.setScreen);
  const seasonOver = useGame((s) => s.seasonOver);
  const honours = useGame((s) => s.honours);
  const careerTrophies = useGame((s) => s.careerTrophies);
  const save = useGame((s) => s);
  const [historyOpen, setHistoryOpen] = useState(false);
  const club = clubById(clubId);
  const place = tablePlace(save);
  const form = formString(save);
  const next = pendingLabel(save);
  const nextComp = seasonOver ? null : (nextUserStep(save)?.slot.competition ?? null);
  const wages = weeklyWages(save);
  const nearby = sortTable(standings).slice(Math.max(0, place - 3), place + 2);
  const lastTrophy = careerTrophies[careerTrophies.length - 1];

  return (
    <div className="flex flex-col gap-5">
      <section
        className="overflow-hidden rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] md:p-6"
        style={compPanelStyle(nextComp)}
      >
        <p
          className="text-[11px] font-medium uppercase tracking-[0.18em] text-fg-muted"
          style={nextComp ? { color: COMP_THEME[nextComp].accent } : undefined}
        >
          {nextComp ? `${compLabel(nextComp, club.league)} · ` : "Próximo paso · "}
          {seasonLabel(season)}
        </p>
        <h2 className="mt-2 font-display text-3xl font-semibold leading-none md:text-4xl">
          {seasonOver ? "Temporada cerrada" : next}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">
          {club.stadium} · {club.city}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            variant="club"
            size="lg"
            onClick={() => (seasonOver ? setScreen("season-end") : goToNextMatch())}
          >
            {seasonOver ? "Ver resumen" : "Continuar"}
            <ArrowRight />
          </Button>
          <Button variant="outline" size="lg" onClick={() => setScreen("tactics")}>
            Alineación
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs text-fg-muted">Clasificación</p>
          <p className="font-display text-5xl font-semibold tabular-nums leading-none">{place}º</p>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Ver historial de partidos de la temporada"
            className="mt-3 flex w-full items-center gap-1 text-left"
          >
            {form.length === 0 ? (
              <span className="text-xs text-fg-subtle">Sin partidos</span>
            ) : (
              form.map((f, i) => (
                <span
                  key={`${f}-${i}`}
                  className="flex size-6 items-center justify-center rounded-sm text-[11px] font-semibold text-bg"
                  style={{
                    background:
                      f === "W" ? "var(--color-good)" : f === "D" ? "var(--color-warn)" : "var(--color-bad)",
                  }}
                >
                  {f === "W" ? "G" : f === "D" ? "E" : "P"}
                </span>
              ))
            )}
            <span className="ml-auto text-[11px] text-fg-muted">Historial →</span>
          </button>
        </article>
        <article className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs text-fg-muted">Caja</p>
          <p className="font-display text-4xl font-semibold tabular-nums leading-none">
            {formatMoney(budget)}
          </p>
          <p className="mt-2 text-xs text-fg-muted">Salarios {formatWage(wages)}</p>
        </article>
        <button
          type="button"
          onClick={() => setScreen("cabinet")}
          className="rounded-2xl bg-surface p-4 text-left shadow-[var(--shadow-border)]"
        >
          <p className="text-xs text-fg-muted">Vitrina</p>
          <div className="mt-2 flex items-start gap-2">
            <Trophy className="mt-0.5 size-4 text-primary" />
            <p className="text-sm">{lastTrophy ? lastTrophy.label : "Todavía vacía esta carrera"}</p>
          </div>
          <p className="mt-2 text-xs text-fg-muted">Entrar a trofeos y estadísticas →</p>
        </button>
      </div>

      <BoardCard />

      <CareerCard />

      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" size="lg" onClick={() => setScreen("academy")}>
          <Sprout className="size-4" />
          Cantera y ojeos
        </Button>
        <Button variant="outline" size="lg" onClick={() => setScreen("train")}>
          <Dumbbell className="size-4" />
          {save.trainingPlan
            ? "Entrenamiento · en curso"
            : save.trainingReport && !save.trainingReport.seen
              ? "Entrenamiento · ¡informe listo!"
              : "Entrenamiento"}
        </Button>
        <Button variant="outline" size="lg" onClick={() => setScreen("sponsors")}>
          <Handshake className="size-4" />
          Patrocinadores
        </Button>
      </div>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="size-4 text-primary" />
            Palmarés
          </h3>
          <button type="button" className="text-xs text-fg-muted" onClick={() => setScreen("cabinet")}>
            Ver vitrina
          </button>
        </div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {honourKinds().map((k) => (
            <li key={k} className="rounded-lg bg-elevated px-3 py-2">
              <p className="text-[11px] text-fg-muted">{honourLabel(k, club.league)}</p>
              <p className="font-display text-2xl tabular-nums">×{honours[k]}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Vecinos de tabla</h3>
          <button type="button" className="text-xs text-fg-muted" onClick={() => setScreen("table")}>
            Ver liga
          </button>
        </div>
        <ul className="divide-y divide-border">
          {nearby.map((row) => {
            const c = clubById(row.clubId);
            const pos = sortTable(standings).findIndex((r) => r.clubId === row.clubId) + 1;
            return (
              <li key={row.clubId} className="flex items-center gap-3 py-2">
                <span className="w-6 text-right font-display text-lg tabular-nums text-fg-muted">
                  {pos}
                </span>
                <ClubCrest club={c} size={24} />
                <span className={row.clubId === clubId ? "flex-1 font-medium" : "flex-1 text-fg-muted"}>
                  {c.name}
                </span>
                <span className="font-display text-lg tabular-nums">{row.pts}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Newspaper className="size-4 text-fg-muted" />
          Despacho
        </h3>
        <ul className="flex flex-col gap-3">
          {news.slice(0, 8).map((n) => (
            <li key={n.id} className="border-l-2 pl-3" style={{ borderColor: tone(n.tone) }}>
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-fg-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>
      {historyOpen ? <MatchHistoryModal onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  );
}

function tone(t: "good" | "bad" | "neutral") {
  if (t === "good") return "var(--color-good)";
  if (t === "bad") return "var(--color-bad)";
  return "var(--color-border-strong)";
}
