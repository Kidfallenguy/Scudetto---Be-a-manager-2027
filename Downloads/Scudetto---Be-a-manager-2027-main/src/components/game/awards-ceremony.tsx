import { useEffect, useMemo, useState } from "react";
import { ClubCrest } from "@/components/game/crest";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { buildCeremony, ordinal, type CeremonyAward, type CeremonyEntry } from "@/lib/game/award-ceremony";
import { clubById } from "@/lib/game/clubs";
import { seasonLabel } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";

// ---------------------------------------------------------------------------
// Ceremonia de premios (fin de temporada).
// Por cada premio: presentación → nominados → revelación progresiva del último puesto al 1.º
// (10.º → 9.º → ... → 2.º → 1.º GANADOR) → siguiente premio.
// Es solo una vista: no guarda ni modifica nada del historial de premios.
// ---------------------------------------------------------------------------

type Step =
  | { award: number; kind: "intro" }
  | { award: number; kind: "nominees" }
  | { award: number; kind: "reveal"; k: number };

function buildSteps(ceremony: CeremonyAward[]): Step[] {
  const steps: Step[] = [];
  ceremony.forEach((a, i) => {
    steps.push({ award: i, kind: "intro" }, { award: i, kind: "nominees" });
    for (let k = 0; k < a.ranking.length; k++) steps.push({ award: i, kind: "reveal", k });
  });
  return steps;
}

export function AwardsCeremony() {
  const save = useGame((s) => s);
  const setScreen = useGame((s) => s.setScreen);
  const ceremony = useMemo(() => buildCeremony(save), [save]);
  const steps = useMemo(() => buildSteps(ceremony), [ceremony]);
  const [index, setIndex] = useState(0);
  const club = clubById(save.clubId);

  const finish = () => setScreen("season-end");

  // Sin premios para entregar no hay ceremonia: directo al resumen de la temporada.
  useEffect(() => {
    if (!ceremony.length) setScreen("season-end");
  }, [ceremony.length, setScreen]);

  const step = steps[Math.min(index, steps.length - 1)];
  if (!step) return null;
  const award = ceremony[step.award]!;
  const isLastAward = step.award === ceremony.length - 1;
  const n = award.ranking.length;

  const goNextAward = () => {
    if (isLastAward) return finish();
    const next = steps.findIndex((s) => s.award === step.award + 1);
    setIndex(next >= 0 ? next : index);
  };
  const advance = () => {
    if (index >= steps.length - 1) return finish();
    setIndex(index + 1);
  };

  const isWinnerStep = step.kind === "reveal" && step.k === n - 1;
  let primaryLabel = "Siguiente";
  if (step.kind === "intro") primaryLabel = "Ver nominados";
  else if (step.kind === "nominees") primaryLabel = n === 1 ? "Revelar al ganador" : `Revelar ${ordinal(n)} puesto`;
  else if (isWinnerStep) primaryLabel = isLastAward ? "Terminar ceremonia" : "Siguiente premio";
  else if (step.k === n - 2) primaryLabel = "Revelar al ganador";
  else primaryLabel = `Revelar ${ordinal(n - step.k - 1)} puesto`;

  const onPrimary = isWinnerStep ? goNextAward : advance;

  return (
    <div className="flex min-h-dvh flex-col items-center bg-bg px-4 py-8">
      <div className="w-full max-w-lg">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-fg-muted">
              Gala de premios · {seasonLabel(save.season, club.league)}
            </p>
            <p className="mt-1 text-[11px] text-fg-subtle">
              Premio {step.award + 1} de {ceremony.length}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={finish}>
            Saltar ceremonia
          </Button>
        </header>

        <div className="mb-5 flex gap-1.5" aria-hidden>
          {ceremony.map((a, i) => (
            <span
              key={a.kind}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < step.award ? "bg-warn" : i === step.award ? "bg-warn/60" : "bg-elevated",
              )}
            />
          ))}
        </div>

        <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]" aria-live="polite">
          {step.kind === "intro" ? <Intro award={award} /> : null}
          {step.kind === "nominees" ? <Nominees award={award} /> : null}
          {step.kind === "reveal" ? <Reveal award={award} k={step.k} /> : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button variant="club" size="lg" onClick={onPrimary}>
            {primaryLabel}
          </Button>
          {!isWinnerStep ? (
            <Button variant="ghost" onClick={goNextAward}>
              {isLastAward ? "Saltar al resumen" : "Saltar este premio"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Vistas de cada paso ─────────────────────────────────────────────────────

function Trophy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10h24v14a12 12 0 0 1-24 0V10Z" />
      <path d="M20 14h-8v4a9 9 0 0 0 9 9M44 14h8v4a9 9 0 0 1-9 9" />
      <path d="M32 36v10M22 54h20M26 46h12v8H26z" />
    </svg>
  );
}

function Intro({ award }: { award: CeremonyAward }) {
  return (
    <div key={`${award.kind}-intro`} className="ceremony-in flex flex-col items-center py-6 text-center">
      <Trophy className="size-16 text-warn" />
      <p className="mt-5 text-xs uppercase tracking-[0.2em] text-fg-muted">A continuación</p>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-none">{award.name}</h1>
      <p className="mt-3 max-w-xs text-sm text-fg-muted">{award.description}</p>
      <p className="mt-4 text-[11px] uppercase tracking-wide text-fg-subtle">
        {award.ranking.length} nominados
      </p>
    </div>
  );
}

function Nominees({ award }: { award: CeremonyAward }) {
  return (
    <div key={`${award.kind}-nominees`} className="ceremony-in">
      <p className="text-xs uppercase tracking-[0.2em] text-fg-muted">{award.name}</p>
      <h2 className="mt-1 font-display text-3xl font-semibold leading-none">Los nominados</h2>
      <ul className="mt-4 space-y-2">
        {award.nominees.map((e) => (
          <li key={e.nominee.id} className="flex items-center gap-3 rounded-xl bg-elevated px-3 py-2.5">
            <ClubCrest club={clubById(e.profile.clubId)} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.profile.name}</p>
              <p className="truncate text-[11px] text-fg-muted">{subtitle(e)}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-fg-subtle">En orden alfabético. El ranking se revela de abajo hacia arriba.</p>
    </div>
  );
}

function subtitle(e: CeremonyEntry): string {
  const f = (label: string) => e.profile.facts.find((x) => x.label === label)?.value;
  if (e.profile.kind === "manager") return e.profile.clubName;
  return [e.profile.clubName, f("Posición"), f("Edad")].filter(Boolean).join(" · ");
}

function Reveal({ award, k }: { award: CeremonyAward; k: number }) {
  const n = award.ranking.length;
  // k = 0 revela el último puesto; k = n - 1 revela al ganador.
  const entry = award.ranking[n - 1 - k]!;
  const winner = k === n - 1;
  return (
    <div>
      <RankingBoard award={award} revealed={k + 1} />
      <ProfileCard key={`${award.kind}-${entry.rank}`} award={award} entry={entry} winner={winner} />
    </div>
  );
}

/** Tabla con todos los puestos: se van llenando de abajo hacia arriba a medida que se revelan. */
function RankingBoard({ award, revealed }: { award: CeremonyAward; revealed: number }) {
  const n = award.ranking.length;
  return (
    <ol className="mb-4 space-y-1">
      {award.ranking.map((e) => {
        const shown = e.rank > n - revealed;
        const current = e.rank === n - revealed + 1;
        return (
          <li
            key={e.nominee.id}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
              shown ? "bg-elevated" : "bg-elevated/40",
              current && "ring-1 ring-warn/60",
            )}
          >
            <span className={cn("w-8 font-display tabular-nums", e.rank === 1 && shown ? "text-warn" : "text-fg-muted")}>
              {ordinal(e.rank)}
            </span>
            {shown ? (
              <>
                <ClubCrest club={clubById(e.profile.clubId)} size={20} />
                <span className="min-w-0 flex-1 truncate">{e.profile.name}</span>
                <span className="truncate text-[11px] text-fg-muted">{e.profile.clubName}</span>
              </>
            ) : (
              <span className="flex-1 text-fg-subtle">· · ·</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function ProfileCard({ award, entry, winner }: { award: CeremonyAward; entry: CeremonyEntry; winner: boolean }) {
  const p = entry.profile;
  const club = clubById(p.clubId);
  return (
    <article
      className={cn(
        "ceremony-in rounded-xl bg-elevated p-4",
        winner && "ceremony-winner",
      )}
      style={{ borderLeft: `3px solid ${club.color}` }}
    >
      <p className={cn("text-[11px] font-medium uppercase tracking-[0.18em]", winner ? "text-warn" : "text-fg-muted")}>
        {winner ? `${ordinal(1)} · Ganador del ${award.name}` : `${ordinal(entry.rank)} puesto`}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <ClubCrest club={club} size={winner ? 56 : 44} />
        <div className="min-w-0">
          <h3 className={cn("truncate font-display font-semibold leading-none", winner ? "text-4xl" : "text-3xl")}>{p.name}</h3>
          <p className="mt-1.5 truncate text-sm text-fg-muted">{p.clubName}</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed">{p.text}</p>
      {p.achievements.length ? (
        <ul className="mt-3 space-y-1">
          {p.achievements.map((a) => (
            <li key={a} className="flex gap-2 text-[13px] text-fg-muted">
              <span className="text-warn" aria-hidden>
                ★
              </span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
        {p.facts.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[10px] uppercase tracking-wide text-fg-subtle">{f.label}</dt>
            <dd className="truncate text-sm tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
