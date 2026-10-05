import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STANCE_LABEL, type DecisionStance } from "@/lib/game/event-decisions";
import { formatMoney } from "@/lib/game/format";
import { useGame } from "@/lib/game/store";

export function GamePopups() {
  const popup = useGame((s) => s.popups[0] ?? null);
  const dismissPopup = useGame((s) => s.dismissPopup);
  const acceptIncoming = useGame((s) => s.acceptIncoming);
  const rejectIncoming = useGame((s) => s.rejectIncoming);
  const resolveEventChoice = useGame((s) => s.resolveEventChoice);
  if (!popup) return null;

  const tone =
    popup.tone === "good"
      ? "var(--color-good)"
      : popup.tone === "bad"
        ? "var(--color-bad)"
        : "var(--color-border-strong)";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-bg/70 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-elevated p-5 shadow-[var(--shadow-border)]">
        <div className="mb-3 flex items-center gap-2" style={{ color: tone }}>
          {popup.kind === "trophy" ? <Trophy className="size-5" /> : null}
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]">
            {popup.kind === "trophy"
              ? "Trofeo"
              : popup.kind === "event"
                ? "Suceso"
                : popup.kind === "offer"
                  ? "Oferta"
                  : "Club"}
          </p>
        </div>
        <h3 className="font-display text-3xl font-semibold leading-none">{popup.title}</h3>
        {popup.decision ? (
          <p className="mt-2 text-xs text-fg-muted">
            Tu decisión: <span className="font-medium text-fg">{popup.decision}</span>
          </p>
        ) : null}
        <p className="mt-3 text-sm text-fg-muted">{popup.body}</p>
        {popup.effects?.length ? (
          <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-surface px-3 py-2.5 text-sm">
            {popup.effects.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden className="text-fg-muted">
                  •
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {popup.prize ? (
          <p className="mt-3 font-display text-2xl tabular-nums">
            {popup.prize > 0 ? "+" : ""}
            {formatMoney(popup.prize)}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {popup.choices?.length ? (
            popup.choices.map((c) => {
              const stance = c.stance ? STANCE_LABEL[c.stance as DecisionStance] : undefined;
              return (
                <Button
                  key={c.id}
                  // Ninguna opción se destaca: el orden no sugiere cuál es la "correcta".
                  variant="outline"
                  disabled={c.disabled}
                  className="h-auto min-h-11 py-2.5 whitespace-normal"
                  onClick={() => {
                    resolveEventChoice(popup.id, c.id);
                  }}
                >
                  <span className="flex w-full flex-col items-center gap-0.5 text-center leading-tight">
                    {stance || c.cost ? (
                      <span className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-fg-muted">
                        {stance ? <span>{stance}</span> : null}
                        {c.cost ? <span className="tabular-nums">· Cuesta {formatMoney(c.cost)}</span> : null}
                      </span>
                    ) : null}
                    <span>{c.label}</span>
                    {c.disabled && c.reason ? (
                      <span className="text-[11px] font-normal text-bad">{c.reason}</span>
                    ) : c.hint ? (
                      <span className="text-[11px] font-normal opacity-70">{c.hint}</span>
                    ) : null}
                  </span>
                </Button>
              );
            })
          ) : popup.kind === "offer" && popup.offerId ? (
            <>
              <Button
                variant="club"
                onClick={() => {
                  acceptIncoming(popup.offerId!);
                }}
              >
                Aceptar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  rejectIncoming(popup.offerId!);
                }}
              >
                Rechazar
              </Button>
            </>
          ) : (
            <Button variant="club" onClick={() => dismissPopup()}>
              Seguir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
