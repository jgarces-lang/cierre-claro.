import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, ChevronRight } from "lucide-react";
import { Shell, Card, EstadoBadge, inputCls, btnPrimary } from "@/components/app-ui";
import { useProspectos } from "@/lib/prospects";
import { activos, diasDesde, formatCOP, ordenarPorAtraso, pendientes, DIAS_PENDIENTE } from "@/lib/prospects-core";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CierreClaro — Tus prospectos al día" },
      { name: "description", content: "Mira qué clientes necesitan seguimiento hoy y no pierdas más ventas por WhatsApp o Instagram." },
      { property: "og:title", content: "CierreClaro — Tus prospectos al día" },
      { property: "og:description", content: "Mira qué clientes necesitan seguimiento hoy y no pierdas más ventas." },
    ],
  }),
  component: Inicio,
});

function diasTexto(d: number) { return d === 0 ? "Hoy" : d === 1 ? "Hace 1 día" : `Hace ${d} días`; }

function Inicio() {
  const lista = useProspectos();
  const [q, setQ] = useState("");
  const filtrados = useMemo(() => {
    if (!lista) return [];
    const t = q.trim().toLowerCase();
    return ordenarPorAtraso(lista).filter((p) => p.nombre.toLowerCase().includes(t));
  }, [lista, q]);

  return (
    <Shell>
      <header className="bg-hero rounded-b-3xl px-5 pb-6 pt-8 text-primary-foreground">
        <p className="text-sm font-medium opacity-80">CierreClaro</p>
        <h1 className="mt-1 text-2xl font-extrabold">¿A quién le escribes hoy?</h1>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-primary-foreground/10 p-4">
            <p className="text-3xl font-extrabold">{lista ? activos(lista).length : "–"}</p>
            <p className="text-xs opacity-80">Prospectos activos</p>
          </div>
          <div className="rounded-2xl bg-accent p-4 text-accent-foreground">
            <p className="text-3xl font-extrabold">{lista ? pendientes(lista).length : "–"}</p>
            <p className="text-xs opacity-90">Seguimiento pendiente</p>
          </div>
        </div>
      </header>
      <div className="px-5">
        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar por nombre" className={inputCls + " pl-12"} />
        </label>
        <ul className="mt-5 space-y-3">
          {filtrados.map((p) => {
            const d = diasDesde(p.ultimoContacto);
            const atrasado = p.estado !== "Cerrado" && d >= DIAS_PENDIENTE;
            return (
              <li key={p.id}>
                <Link to="/prospecto/$id" params={{ id: p.id }} className="block">
                  <Card className="flex items-center gap-3 p-4 transition active:scale-[0.99]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold">{p.nombre}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <EstadoBadge estado={p.estado} />
                        <span className="text-sm font-semibold text-primary">{formatCOP(p.monto)}</span>
                      </div>
                      <p className={"mt-2 text-xs font-medium " + (atrasado ? "text-warning" : "text-muted-foreground")}>
                        {atrasado ? "⚠ " : ""}Último contacto: {diasTexto(d)}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Card>
                </Link>
              </li>
            );
          })}
          {lista && filtrados.length === 0 && <p className="py-10 text-center text-muted-foreground">No encontramos prospectos con ese nombre.</p>}
        </ul>
        <div className="mt-6 mb-10">
          <Link to="/nuevo" className={btnPrimary + " whitespace-nowrap px-6"}><Plus className="size-5 shrink-0" /> Nuevo prospecto</Link>
        </div>
      </div>
    </Shell>
  );
}
