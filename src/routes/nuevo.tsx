import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Shell, inputCls, btnPrimary } from "@/components/app-ui";
import { crearProspecto } from "@/lib/prospects";
import { ESTADOS, ORIGENES, type Estado } from "@/lib/prospects-core";

export const Route = createFileRoute("/nuevo")({
  head: () => ({
    meta: [
      { title: "Nuevo prospecto — CierreClaro" },
      { name: "description", content: "Registra un nuevo prospecto con su contacto, origen y monto estimado." },
      { property: "og:title", content: "Nuevo prospecto — CierreClaro" },
      { property: "og:description", content: "Registra un nuevo prospecto en segundos." },
    ],
  }),
  component: Nuevo,
});

const schema = z.object({
  nombre: z.string().trim().min(2, "Escribe el nombre").max(80),
  contacto: z.string().trim().min(5, "Escribe un WhatsApp o correo").max(100),
  origen: z.string().min(1),
  estado: z.enum(ESTADOS as [Estado, ...Estado[]]),
  monto: z.number({ invalid_type_error: "Escribe un monto" }).min(0, "Monto inválido").max(1_000_000_000),
  nota: z.string().trim().max(500),
});

function Field({ label, error, children }: { label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-destructive">{error}</span>}
    </label>
  );
}

function Nuevo() {
  const nav = useNavigate();
  const [f, setF] = useState({ nombre: "", contacto: "", origen: "WhatsApp", estado: "Nuevo" as Estado, monto: "", nota: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = schema.safeParse({ ...f, monto: f.monto === "" ? NaN : Number(f.monto.replace(/\D/g, "")) });
    if (!r.success) {
      setErr(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    const id = crearProspecto(r.data);
    nav({ to: "/prospecto/$id", params: { id } });
  }

  return (
    <Shell>
      <header className="flex items-center gap-3 px-5 pt-6">
        <Link to="/" aria-label="Volver" className="flex size-12 items-center justify-center rounded-full bg-card shadow-card"><ArrowLeft className="size-5" /></Link>
        <h1 className="text-xl font-extrabold">Nuevo prospecto</h1>
      </header>
      <form onSubmit={submit} className="space-y-5 px-5 pt-6">
        <Field label="Nombre" error={err["nombre"]}><input className={inputCls} value={f.nombre} onChange={set("nombre")} placeholder="Ej: Camila Restrepo" /></Field>
        <Field label="WhatsApp o correo" error={err["contacto"]}><input className={inputCls} value={f.contacto} onChange={set("contacto")} placeholder="+57 310 000 0000" /></Field>
        <Field label="Origen del lead">
          <select className={inputCls} value={f.origen} onChange={set("origen")}>{ORIGENES.map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
        <Field label="Estado inicial">
          <div className="grid grid-cols-2 gap-2">
            {ESTADOS.map((s) => (
              <button type="button" key={s} onClick={() => setF({ ...f, estado: s })}
                className={"h-12 rounded-xl border text-sm font-semibold transition " + (f.estado === s ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card")}>{s}</button>
            ))}
          </div>
        </Field>
        <Field label="Monto estimado (COP)" error={err["monto"]}>
          <input className={inputCls} inputMode="numeric" value={f.monto ? "$" + Number(f.monto.replace(/\D/g, "") || 0).toLocaleString("es-CO").replace(/,/g, ".") : ""}
            onChange={(e) => setF({ ...f, monto: e.target.value.replace(/\D/g, "") })} placeholder="$450.000" />
        </Field>
        <Field label="Nota inicial de seguimiento">
          <textarea className={inputCls + " h-28 py-3"} value={f.nota} onChange={set("nota")} placeholder="¿Qué le interesa? ¿Cuándo volver a escribirle?" />
        </Field>
        <button className={btnPrimary}>Guardar prospecto</button>
      </form>
    </Shell>
  );
}
