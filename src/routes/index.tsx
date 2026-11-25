import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, Plus, ChevronRight, LogOut, Sparkles, Loader2 } from "lucide-react";
import { Shell, Card, EstadoBadge, inputCls, btnPrimary } from "@/components/app-ui";
import { useProspectos } from "@/lib/prospects";
import { cerrarSesion, tokenActual } from "@/lib/auth";
import { aQuienEscribir } from "@/lib/ia";
import { activos, diasDesde, formatCOP, ordenarPorAtraso, pendientes, DIAS_PENDIENTE, ESTADOS, type Estado } from "@/lib/prospects-core";

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
  const [filtroEstado, setFiltroEstado] = useState<Estado | "Todos">("Todos");
  const filtrados = useMemo(() => {
    if (!lista) return [];
    const t = q.trim().toLowerCase();
    return ordenarPorAtraso(lista)
      .filter((p) => p.nombre.toLowerCase().includes(t))
      .filter((p) => filtroEstado === "Todos" || p.estado === filtroEstado);
  }, [lista, q, filtroEstado]);

  return (
    <Shell>
      <header className="bg-hero rounded-b-3xl px-5 pb-6 pt-8 text-primary-foreground">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium opacity-80">CierreClaro</p>
          <button onClick={() => cerrarSesion()} className="flex items-center gap-1 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-xs font-semibold">
            <LogOut className="size-3.5" /> Salir
          </button>
        </div>
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
        <AsistenteDelDia />
        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre" aria-label="Buscar por nombre" className={inputCls + " pl-12"} />
        </label>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["Todos", ...ESTADOS] as const).map((e) => (
            <button key={e} type="button" onClick={() => setFiltroEstado(e)}
              className={"h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition " + (filtroEstado === e ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{e}</button>
          ))}
        </div>
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
          {lista && filtrados.length === 0 && <p className="py-10 text-center text-muted-foreground">No encontramos prospectos con ese filtro.</p>}
        </ul>
        <div className="mt-6 mb-10">
          <Link to="/nuevo" className={btnPrimary + " whitespace-nowrap px-6"}><Plus className="size-5 shrink-0" /> Nuevo prospecto</Link>
        </div>
      </div>
    </Shell>
  );
}

/** Función IA con RAG: consulta solo los prospectos atrasados y le pide a Gemini a quién escribir primero. */
function AsistenteDelDia() {
  const [estado, setEstado] = useState<"inicial" | "cargando" | "listo">("inicial");
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lista, setLista] = useState<{ id: string; nombre: string; dias: number }[]>([]);

  async function preguntar() {
    setEstado("cargando");
    setError(null);
    const token = await tokenActual();
    if (!token) { setError("Tu sesión expiró. Vuelve a entrar."); setEstado("inicial"); return; }
    try {
      const r = await aQuienEscribir({ data: { token } });
      setTexto(r.texto);
      setError(r.error);
      setLista(r.prospectos ?? []);
    } catch {
      setError("No pudimos hablar con la IA. Intenta de nuevo.");
    }
    setEstado("listo");
  }

  return (
    <Card className="mt-5 border-accent/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-accent" />
        <p className="font-bold">Tu plan de seguimiento de hoy</p>
      </div>
      {estado === "inicial" && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">La IA revisa tus prospectos atrasados y te dice a quién escribirle primero.</p>
          <button onClick={preguntar} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-sm font-bold text-primary">
            <Sparkles className="size-4" /> ¿A quién le escribo hoy?
          </button>
        </>
      )}
      {estado === "cargando" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Revisando tus prospectos…</p>
      )}
      {estado === "listo" && (
        <div className="mt-3 space-y-3">
          {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          {texto && <p className="whitespace-pre-line text-sm leading-relaxed">{texto}</p>}
          {lista.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lista.slice(0, 3).map((p) => (
                <Link key={p.id} to="/prospecto/$id" params={{ id: p.id }} className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-primary">
                  {p.nombre.split(" ")[0]} · {p.dias} días →
                </Link>
              ))}
            </div>
          )}
          <button onClick={preguntar} className="text-xs font-semibold text-accent">Volver a preguntar</button>
        </div>
      )}
    </Card>
  );
}
