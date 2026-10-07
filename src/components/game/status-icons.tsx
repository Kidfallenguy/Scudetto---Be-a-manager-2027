import { HeartPulse, Thermometer, UserX } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Player } from "@/lib/game/types";

/** Por qué un jugador no está disponible. "illness" y "absence" vienen de sucesos inesperados. */
export type OutStatus = "injury" | "suspension" | "illness" | "absence";

type OutPlayer = Pick<Player, "injured" | "suspended" | "absence">;

/** Tarjeta roja dibujada (rectángulo rojo): distinta de la cruz de lesión. */
export function RedCard({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block h-4 w-3 rotate-6 rounded-[2px] bg-red-600 shadow-sm", className)}
    />
  );
}

export function StatusGlyph({ status, large }: { status: OutStatus; large?: boolean }) {
  if (status === "suspension") return <RedCard className={large ? "h-8 w-6" : "h-4 w-3"} />;
  if (status === "illness") return <Thermometer className={cn("text-bad", large ? "size-9" : "size-5")} />;
  if (status === "absence") return <UserX className={cn("text-fg-muted", large ? "size-9" : "size-5")} />;
  return <HeartPulse className={cn("text-bad", large ? "size-9" : "size-5")} />;
}

export function outGames(p: OutPlayer, status: OutStatus) {
  if (status === "injury") return p.injured;
  if (status === "suspension") return p.suspended;
  return p.absence?.games ?? 0;
}

/** Estado de la ausencia por suceso, si la hay (enfermedad u otro motivo). */
export function absenceStatus(p: Pick<Player, "absence">): "illness" | "absence" | null {
  if (!p.absence || p.absence.games <= 0) return null;
  return p.absence.kind === "illness" ? "illness" : "absence";
}

/** Etiqueta corta: "Lesión · 2 j" / "Roja · 1 j" / "Enfermo · 2 j" / "Ausente · 3 j". */
export function statusTag(status: OutStatus, games?: number) {
  const base =
    status === "injury" ? "Lesión" : status === "suspension" ? "Roja" : status === "illness" ? "Enfermo" : "Ausente";
  return games && games > 0 ? `${base} · ${games} j` : base;
}

export function statusWord(status: OutStatus) {
  return status === "injury"
    ? "Lesionado"
    : status === "suspension"
      ? "Expulsado"
      : status === "illness"
        ? "Enfermo"
        : "No disponible";
}

/** Motivo concreto de la baja ("Gripe", "Motivos personales"...). Vacío para lesión y sanción, que ya se explican solas. */
export function outReason(p: Pick<Player, "absence">, status: OutStatus) {
  return status === "illness" || status === "absence" ? (p.absence?.reason ?? "") : "";
}

/** Texto para listas: " · lesionado (2 j)", " · enfermo: Gripe (2 j)", " · no disponible: Motivos personales (3 j)". */
export function outText(p: OutPlayer, status: OutStatus | null) {
  if (!status) return "";
  const word = statusWord(status).toLowerCase();
  const reason = outReason(p, status);
  return ` · ${word}${reason ? `: ${reason}` : ""} (${outGames(p, status)} j)`;
}
