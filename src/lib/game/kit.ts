import type { NumberColor } from "./types";

export const NUMBER_COLOR_OPTIONS: Array<{ id: NumberColor; label: string; hex: string }> = [
  { id: "auto", label: "Auto", hex: "" },
  { id: "white", label: "Blanco", hex: "#f4efe6" },
  { id: "black", label: "Negro", hex: "#111111" },
  { id: "gold", label: "Oro", hex: "#d4af37" },
];

function hexRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "");
  if (h.length < 6) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function kitLuminance(hex: string): number {
  const rgb = hexRgb(hex);
  if (!rgb) return 0;
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
}

function isWhiteOrYellow(hex: string): boolean {
  const rgb = hexRgb(hex);
  if (!rgb) return false;
  const lum = kitLuminance(hex);
  if (lum >= 0.62) return true;
  return rgb.r > 180 && rgb.g > 155 && rgb.b < 130;
}

/** Shirt number ink. White/yellow kits auto-switch to black so the digit stays readable. */
export function resolveNumberColor(kitHex: string, override: NumberColor = "auto"): string {
  if (override === "white") return "#f4efe6";
  if (override === "black") return "#111111";
  if (override === "gold") return "#d4af37";
  return isWhiteOrYellow(kitHex) ? "#111111" : "#f4efe6";
}

export function contrastOnKit(kitHex: string): string {
  return kitLuminance(kitHex) > 0.62 ? "#141414" : "#fff6f2";
}
