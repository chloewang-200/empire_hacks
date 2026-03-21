import type { ReactNode } from "react";

function RailLogo({
  label,
  accentClass,
}: {
  label: string;
  accentClass: string;
}): ReactNode {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg border border-border text-xs font-semibold ${accentClass}`}>
      {label}
    </div>
  );
}

export function CardRailLogo() {
  return RailLogo({ label: "Card", accentClass: "bg-blue-50 text-blue-700" });
}

export function CarlosRailLogo() {
  return RailLogo({ label: "Ops", accentClass: "bg-amber-50 text-amber-700" });
}

export function BankRailLogo() {
  return RailLogo({ label: "ACH", accentClass: "bg-emerald-50 text-emerald-700" });
}

export function CryptoRailLogo() {
  return RailLogo({ label: "Coin", accentClass: "bg-slate-100 text-slate-700" });
}

export function Pay402RailLogo() {
  return RailLogo({ label: "402", accentClass: "bg-indigo-50 text-indigo-700" });
}
