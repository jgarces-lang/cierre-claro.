import type { ReactNode } from "react";
import type { Estado } from "@/lib/prospects-core";
import { cn } from "@/lib/utils";

const estadoClass: Record<Estado, string> = {
  Nuevo: "bg-secondary text-primary",
  Cotizado: "bg-warning-soft text-foreground",
  "En Seguimiento": "bg-accent-soft text-primary",
  Cerrado: "bg-accent text-accent-foreground",
};
export function EstadoBadge({ estado }: { estado: Estado }) {
  return <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", estadoClass[estado])}>{estado}</span>;
}
export function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-32">{children}</div>;
}
export function Card({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>{children}</div>;
}
export const inputCls = "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring";
export const btnPrimary = "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-bold text-accent-foreground shadow-card transition active:scale-[0.98] disabled:opacity-50";
