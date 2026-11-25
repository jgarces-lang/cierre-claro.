import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, MessageCircle, Mail, Pencil, Archive, Sparkles, Copy, Loader2, Send } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Shell, Card, EstadoBadge, inputCls, btnPrimary } from "@/components/app-ui";
import { useProspectos, cambiarEstado, registrarInteraccion, editarProspecto, archivarProspecto } from "@/lib/prospects";
import { CANALES, ESTADOS, ORIGENES, formatCOP, diasDesde, type Estado, type Prospecto } from "@/lib/prospects-core";
import { tokenActual } from "@/lib/auth";
import { sugerirMensaje } from "@/lib/ia";

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
const soloDigitos = (s: string) => s.replace(/\D/g, "");

function Detalle() {
  const { id } = Route.useParams();
  const lista = useProspectos();
  if (!lista) return <Shell><div /></Shell>;
  const p = lista.find((x) => x.id === id);
  if (!p) return (
    <Shell><div className="p-8 text-center"><p className="text-lg font-bold">No encontramos este prospecto</p><Link to="/" className="mt-4 inline-block font-semibold text-accent">Volver al inicio</Link></div></Shell>
  );
  return <Ficha p={p} />;
}

function Ficha({ p }: { p: Prospecto }) {
  const [editando, setEditando] = useState(false);
  const esCorreo = p.contacto.includes("@");
  const link = esCorreo ? `mailto:${p.contacto}` : `https://wa.me/${soloDigitos(p.contacto)}`;

  return (
    <Shell>
      <header className="bg-hero rounded-b-3xl px-5 pb-6 pt-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Volver" className="flex size-12 items-center justify-center rounded-full bg-primary-foreground/10"><ArrowLeft className="size-5" /></Link>
          {!editando && (
            <button onClick={() => setEditando(true)} className="flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-4 py-2 text-sm font-semibold">
              <Pencil className="size-4" /> Editar
            </button>
          )}
        </div>
        <h1 className="mt-4 text-2xl font-extrabold">{p.nombre}</h1>
        <p className="mt-1 text-3xl font-extrabold text-accent">{formatCOP(p.monto)}</p>
        <p className="text-xs opacity-80">Monto estimado · último contacto hace {diasDesde(p.ultimoContacto)} días</p>
      </header>
      <div className="space-y-4 px-5 pt-5">
        {editando ? (
          <EditarDatos p={p} onListo={() => setEditando(false)} />
        ) : (
          <Card className="space-y-3">
            <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-3 font-semibold text-primary">
              {esCorreo ? <Mail className="size-5 text-accent" /> : <MessageCircle className="size-5 text-accent" />}{p.contacto}
            </a>
            <p className="text-sm text-muted-foreground">Origen: <span className="font-semibold text-foreground">{p.origen}</span></p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">Estado actual: <EstadoBadge estado={p.estado} /></div>
          </Card>
        )}
        <MensajeIA p={p} />
        <CambiarEstado p={p} />
        <RegistrarInteraccion p={p} />
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
        <Archivar p={p} />
      </div>
    </Shell>
  );
}

// ---------- UPDATE simple: editar los datos del prospecto ----------
const esquemaEdicion = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre").max(80),
  contacto: z.string().trim().min(5, "Escribe un WhatsApp o correo").max(100),
  origen: z.string().min(1),
  monto: z.number({ invalid_type_error: "Escribe un monto" }).min(0, "Monto inválido").max(1_000_000_000),
});

function EditarDatos({ p, onListo }: { p: Prospecto; onListo: () => void }) {
  const [f, setF] = useState({ nombre: p.nombre, contacto: p.contacto, origen: p.origen, monto: String(p.monto) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const r = esquemaEdicion.safeParse({ ...f, monto: f.monto === "" ? NaN : Number(soloDigitos(f.monto)) });
    if (!r.success) { setErr(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setGuardando(true);
    const res = await editarProspecto(p.id, r.data);
    setGuardando(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success("Prospecto actualizado");
    onListo();
  }

  return (
    <Card>
      <h2 className="font-bold">Editar datos</h2>
      <form onSubmit={guardar} className="mt-3 space-y-3">
        <Campo label="Nombre" error={err["nombre"]}><input className={inputCls} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></Campo>
        <Campo label="WhatsApp o correo" error={err["contacto"]}><input className={inputCls} value={f.contacto} onChange={(e) => setF({ ...f, contacto: e.target.value })} /></Campo>
        <Campo label="Origen del lead">
          <select className={inputCls} value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })}>{ORIGENES.map((o) => <option key={o}>{o}</option>)}</select>
        </Campo>
        <Campo label="Monto estimado (COP)" error={err["monto"]}>
          <input className={inputCls} inputMode="numeric" value={f.monto === "" ? "" : "$" + Number(soloDigitos(f.monto) || 0).toLocaleString("es-CO").replace(/,/g, ".")}
            onChange={(e) => setF({ ...f, monto: soloDigitos(e.target.value) })} />
        </Campo>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onListo} className="h-12 rounded-xl border border-input bg-card text-sm font-semibold">Cancelar</button>
          <button className="h-12 rounded-xl bg-cta text-sm font-bold text-cta-foreground disabled:opacity-50" disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </Card>
  );
}

function Campo({ label, error, children }: { label: string; error?: string | undefined; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>}
    </label>
  );
}

// ---------- UPDATE con regla: cambiar el estado ----------
function CambiarEstado({ p }: { p: Prospecto }) {
  const [cambiando, setCambiando] = useState<Estado | null>(null);
  async function cambiar(s: Estado) {
    if (s === p.estado || cambiando) return;
    setCambiando(s);
    const r = await cambiarEstado(p.id, s);
    setCambiando(null);
    if (r.error) toast.error(r.error);
    else toast.success(`Estado: ${s}`);
  }
  return (
    <Card>
      <h2 className="font-bold">Cambiar estado</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ESTADOS.map((s) => (
          <button key={s} onClick={() => cambiar(s)} disabled={cambiando !== null}
            className={"h-12 rounded-xl border text-sm font-semibold transition " + (p.estado === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>
            {cambiando === s ? "…" : s}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------- UPDATE con lógica de negocio: registrar interacción ----------
function RegistrarInteraccion({ p }: { p: Prospecto }) {
  const [canal, setCanal] = useState("WhatsApp");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    const r = await registrarInteraccion(p.id, canal, nota);
    setGuardando(false);
    if (r.error) { toast.error(r.error); return; }
    setNota("");
    toast.success(p.estado === "Nuevo" ? "Interacción registrada · pasó a En Seguimiento" : "Interacción registrada");
  }
  return (
    <Card>
      <h2 className="font-bold">Registrar interacción</h2>
      <form className="mt-3 space-y-3" onSubmit={guardar}>
        <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value)} aria-label="Canal">{CANALES.map((c) => <option key={c}>{c}</option>)}</select>
        <textarea className={inputCls + " h-24 py-3"} value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} placeholder="¿Qué hablaron?" aria-label="Nota" />
        <button className={btnPrimary} disabled={!nota.trim() || guardando}>{guardando ? "Guardando…" : "Guardar interacción"}</button>
      </form>
    </Card>
  );
}

// ---------- Función IA: mensaje de seguimiento ----------
function MensajeIA({ p }: { p: Prospecto }) {
  const [cargando, setCargando] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const esCorreo = p.contacto.includes("@");

  async function generar() {
    setCargando(true);
    setError(null);
    const token = await tokenActual();
    if (!token) { setError("Tu sesión expiró. Vuelve a entrar."); setCargando(false); return; }
    try {
      const r = await sugerirMensaje({ data: { token, prospectoId: p.id } });
      setTexto(r.texto);
      setError(r.error);
    } catch {
      setError("No pudimos hablar con la IA. Intenta de nuevo.");
    }
    setCargando(false);
  }

  async function copiar() {
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); toast.success("Mensaje copiado"); }
    catch { toast.error("No se pudo copiar. Selecciona el texto y cópialo."); }
  }

  return (
    <Card className="border-accent/40">
      <div className="flex items-center gap-2"><Sparkles className="size-5 text-accent" /><h2 className="font-bold">Mensaje de seguimiento</h2></div>
      {!texto && !cargando && (
        <>
          <p className="mt-1 text-sm text-muted-foreground">La IA lee el historial de {p.nombre.split(" ")[0]} y te redacta un mensaje listo para WhatsApp.</p>
          <button onClick={generar} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft text-sm font-bold text-primary">
            <Sparkles className="size-4" /> Sugerir mensaje
          </button>
        </>
      )}
      {cargando && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Leyendo el historial…</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {texto && !cargando && (
        <div className="mt-3 space-y-3">
          <p className="whitespace-pre-line rounded-xl bg-secondary p-3 text-sm leading-relaxed">{texto}</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={copiar} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-input bg-card text-sm font-semibold"><Copy className="size-4" /> Copiar</button>
            {esCorreo ? (
              <a href={`mailto:${p.contacto}?body=${encodeURIComponent(texto)}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-cta text-sm font-bold text-cta-foreground"><Send className="size-4" /> Enviar correo</a>
            ) : (
              <a href={`https://wa.me/${soloDigitos(p.contacto)}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer" className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-cta text-sm font-bold text-cta-foreground"><Send className="size-4" /> Abrir WhatsApp</a>
            )}
          </div>
          <button onClick={generar} className="text-xs font-semibold text-accent">Generar otro</button>
        </div>
      )}
    </Card>
  );
}

// ---------- DELETE lógico: archivar ----------
function Archivar({ p }: { p: Prospecto }) {
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState(false);
  const [archivando, setArchivando] = useState(false);
  async function archivar() {
    setArchivando(true);
    const r = await archivarProspecto(p.id);
    setArchivando(false);
    if (r.error) { toast.error(r.error); return; }
    toast.success(`${p.nombre} quedó archivado`);
    navigate({ to: "/" });
  }
  return (
    <div className="pb-4 pt-2">
      {!confirmando ? (
        <button onClick={() => setConfirmando(true)} className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-muted-foreground">
          <Archive className="size-4" /> Archivar prospecto
        </button>
      ) : (
        <Card className="border-destructive/40">
          <p className="text-sm font-semibold">¿Seguro que quieres archivar a {p.nombre}?</p>
          <p className="mt-1 text-xs text-muted-foreground">Ya no aparecerá en tu lista, pero su historial se conserva.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setConfirmando(false)} className="h-11 rounded-xl border border-input bg-card text-sm font-semibold">Cancelar</button>
            <button onClick={archivar} disabled={archivando} className="h-11 rounded-xl bg-destructive text-sm font-bold text-white disabled:opacity-50">{archivando ? "Archivando…" : "Sí, archivar"}</button>
          </div>
        </Card>
      )}
    </div>
  );
}
