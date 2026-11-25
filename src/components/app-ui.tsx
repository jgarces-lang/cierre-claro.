import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useSesion } from "@/lib/auth";
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
/** Contenedor de las pantallas privadas: sin sesión, manda al login. */
export function Shell({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const navigate = useNavigate();
  useEffect(() => { if (sesion === null) navigate({ to: "/login" }); }, [sesion, navigate]);
  if (!sesion) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      </div>
    );
  }
  return <div className="mx-auto min-h-screen w-full max-w-md bg-background pb-32">{children}</div>;
}
export function Card({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return <div className={cn("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>{children}</div>;
}
export const inputCls = "h-12 w-full rounded-xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring";
export const btnPrimary = "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cta text-base font-bold text-cta-foreground shadow-card transition active:scale-[0.98] disabled:opacity-50";
