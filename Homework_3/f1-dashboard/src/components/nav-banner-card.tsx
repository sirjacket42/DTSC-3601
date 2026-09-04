import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function NavBannerCard({
  href,
  icon: Icon,
  eyebrow,
  title,
  description,
  variant = "primary",
  className,
}: {
  href: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  variant?: "primary" | "violet";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative overflow-hidden rounded-2xl p-6 flex flex-col justify-between gap-6 min-h-[140px] text-white transition-transform hover:scale-[1.01]",
        className
      )}
      style={{
        background:
          variant === "violet"
            ? "linear-gradient(120deg, #6d28d9, #a855f7)"
            : "linear-gradient(120deg, color-mix(in oklch, var(--primary) 85%, black 15%), color-mix(in oklch, var(--primary) 55%, black 45%))",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
          <Icon className="size-3.5" />
          {eyebrow}
        </div>
        <ArrowRight className="size-4 text-white/70 transition-transform group-hover:translate-x-1" />
      </div>
      <div>
        <h3 className="text-xl font-bold leading-snug">{title}</h3>
        <p className="text-sm text-white/75 mt-1">{description}</p>
      </div>
    </Link>
  );
}
