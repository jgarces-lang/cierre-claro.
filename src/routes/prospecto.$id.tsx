import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Mail } from "lucide-react";
import { Shell, Card, EstadoBadge, inputCls, btnPrimary } from "@/components/app-ui";
import { useProspectos, cambiarEstado, agregarInteraccion } from "@/lib/prospects";
import { CANALES, ESTADOS, formatCOP } from "@/lib/prospects-core";

export const Route = createFileRoute("/prospecto/$id")({
  head: () => ({
    meta: [
      { title: "Detalle del prospecto — CierreClaro" },
      { name: "description", content: "Historial de interacciones, estado y monto estimado del prospecto." },
      { property: "og:title", content: "Detalle del prospecto — CierreClaro" },
      { property: "og:description", content: "Historial y estado comercial del prospecto." },
    ],
  }),
  component: Detalle,
});

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

function Detalle() {
  const { id } = Route.useParams();
  const lista = useProspectos();
  const [canal, setCanal] = useState("WhatsApp");
  const [nota, setNota] = useState("");
  if (!lista) return <Shell><div /></Shell>;
  const p = lista.find((x) => x.id === id);
  if (!p) return (
    <Shell><div className="p-8 text-center"><p className="text-lg font-bold">No encontramos este prospecto</p><Link to="/" className="mt-4 inline-block font-semibold text-accent">Volver al inicio</Link></div></Shell>
  );
  const esCorreo = p.contacto.includes("@");
  const link = esCorreo ? `mailto:${p.contacto}` : `https://wa.me/${p.contacto.replace(/\D/g, "")}`;

  return (
    <Shell>
      <header className="bg-hero rounded-b-3xl px-5 pb-6 pt-6 text-primary-foreground">
        <Link to="/" aria-label="Volver" className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/10"><ArrowLeft className="size-5" /></Link>
        <h1 className="mt-4 text-2xl font-extrabold">{p.nombre}</h1>
        <p className="mt-1 text-3xl font-extrabold text-accent">{formatCOP(p.monto)}</p>
        <p className="text-xs opacity-80">Monto estimado</p>
      </header>
      <div className="space-y-4 px-5 pt-5">
        <Card className="space-y-3">
          <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-3 font-semibold text-primary">
            {esCorreo ? <Mail className="size-5 text-accent" /> : <MessageCircle className="size-5 text-accent" />}{p.contacto}
          </a>
          <p className="text-sm text-muted-foreground">Origen: <span className="font-semibold text-foreground">{p.origen}</span></p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">Estado actual: <EstadoBadge estado={p.estado} /></div>
        </Card>
        <Card>
          <h2 className="font-bold">Cambiar estado</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {ESTADOS.map((s) => (
              <button key={s} onClick={() => cambiarEstado(p.id, s)}
                className={"h-12 rounded-xl border text-sm font-semibold transition " + (p.estado === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{s}</button>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="font-bold">Registrar interacción</h2>
          <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!nota.trim()) return; agregarInteraccion(p.id, canal, nota.trim().slice(0, 500)); setNota(""); }}>
            <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal">{CANALES.map((c) => <option key={c}>{c}</option>)}</select>
            <textarea className={inputCls + " h-24 py-3"} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué hablaron?" aria-label="Nota" />
            <button className={btnPrimary} disabled={!nota.trim()}>Guardar interacción</button>
          </form>
        </Card>
        <section>
          <h2 className="px-1 font-bold">Historial</h2>
          <ol className="mt-3 space-y-3 border-l-2 border-accent-soft pl-4">
            {p.interacciones.map((i) => (
              <li key={i.id} className="relative">
                <span className="absolute -left-[23px] top-2 size-3 rounded-full bg-accent" />
                <Card className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground">{fecha(i.fecha)} · {i.canal}</p>
                  <p className="mt-1 text-sm">{i.nota}</p>
                </Card>
              </li>
            ))}
            {p.interacciones.length === 0 && <p className="text-sm text-muted-foreground">Aún no hay interacciones.</p>}
          </ol>
        </section>
      </div>
    </Shell>
  );
}
