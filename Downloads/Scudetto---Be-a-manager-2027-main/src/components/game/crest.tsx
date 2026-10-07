import { cn } from "@/lib/cn";
import type { Club } from "@/lib/game/types";

export function ClubCrest({
  club,
  size = 40,
  className,
}: {
  club: Club;
  size?: number;
  className?: string;
}) {
  const darkOnLight = luminance(club.color) > 0.62;
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full shadow-[var(--shadow-border)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${club.color} 0 52%, ${club.color2} 52% 100%)`,
        }}
      />
      <span
        className="absolute inset-0 flex items-center justify-center font-display font-semibold tracking-wide"
        style={{
          color: darkOnLight ? "#141414" : "#f4efe6",
          fontSize: size * 0.28,
        }}
      >
        {club.short.slice(0, 3)}
      </span>
    </div>
  );
}

function luminance(hex: string) {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
