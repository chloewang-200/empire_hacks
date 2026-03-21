import Image from "next/image";
import { Bitcoin, Code2, Landmark } from "lucide-react";

/** Fixed slot so every rail logo lines up vertically in the list */
const slot = "flex h-12 w-[5.5rem] shrink-0 items-center justify-center";

/** Card rail: Visa + Mastercard + Stripe — matches “pay with card” brand row styling */
export function CardRailLogo() {
  return (
    <div className={slot}>
      <div className="flex h-10 w-full max-w-[4.75rem] items-center justify-center gap-1 rounded-xl bg-white p-1 shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-950 dark:ring-zinc-700">
        <div className="flex h-7 w-8 items-center justify-center rounded bg-[#1A1F71] text-[7px] font-bold tracking-wide text-white">
          VISA
        </div>
        <div className="relative h-7 w-8 shrink-0">
          <div className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-[#EB001B]" />
          <div className="absolute left-2 top-0.5 h-6 w-6 rounded-full bg-[#F79E1B]" />
        </div>
        <div className="flex h-7 min-w-[1.75rem] items-center justify-center rounded bg-[#635BFF] px-0.5 text-[6px] font-bold lowercase leading-none text-white">
          stripe
        </div>
      </div>
    </div>
  );
}

export function CarlosRailLogo() {
  return (
    <div className={slot}>
      <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 shadow-sm ring-2 ring-amber-200/90 ring-offset-2 ring-offset-background dark:from-amber-950/80 dark:to-orange-950/50 dark:ring-amber-800/50">
        <Image
          src="/images/carlos-avatar.png"
          alt=""
          width={48}
          height={48}
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

export function BankRailLogo() {
  return (
    <div className={slot}>
      <div className="flex h-10 w-[4.75rem] items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-md ring-1 ring-emerald-500/30">
        <Landmark className="h-5 w-5" strokeWidth={2} />
      </div>
    </div>
  );
}

export function CryptoRailLogo() {
  return (
    <div className={slot}>
      <div className="flex h-10 w-[4.75rem] items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-md ring-1 ring-orange-400/40">
        <Bitcoin className="h-5 w-5" strokeWidth={2} />
      </div>
    </div>
  );
}

export function Pay402RailLogo() {
  return (
    <div className={slot}>
      <div className="flex h-10 w-[4.75rem] items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-800 text-white shadow-md ring-1 ring-violet-400/30">
        <Code2 className="h-5 w-5" strokeWidth={2} />
      </div>
    </div>
  );
}
