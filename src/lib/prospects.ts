import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import type { Estado, Interaccion, Prospecto } from "./prospects-core";

// Antes los prospectos se guardaban en el navegador (localStorage).
// Ahora se leen y se guardan en la base de datos de Supabase.
// Las pantallas no cambian: siguen usando las mismas 4 funciones de este archivo.

let cache: Prospecto[] | null = null;
let cargando = false;
const subs = new Set<() => void>();

function publicar(next: Prospecto[]) {
  cache = next;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

// Convierte una fila de la base (snake_case) al formato que usa la app.
type FilaInteraccion = { id: string; canal: string; nota: string; created_at: string };
type FilaProspecto = {
  id: string; nombre: string; contacto: string; origen: string; estado: Estado;
  monto: number; ultimo_contacto: string; interacciones: FilaInteraccion[] | null;
};
function aProspecto(f: FilaProspecto): Prospecto {
  const interacciones: Interaccion[] = (f.interacciones ?? [])
    .map((i) => ({ id: i.id, fecha: i.created_at, canal: i.canal, nota: i.nota }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return {
    id: f.id, nombre: f.nombre, contacto: f.contacto, origen: f.origen, estado: f.estado,
    monto: Number(f.monto), ultimoContacto: f.ultimo_contacto, interacciones,
  };
}

/** Pide a Supabase todos los prospectos con sus interacciones. */
export async function refrescar() {
  cargando = true;
  const { data, error } = await supabase.from("prospectos").select("*, interacciones(*)");
  cargando = false;
  if (error) {
    console.error("Error leyendo prospectos de Supabase:", error.message);
    publicar([]);
    return;
  }
  publicar((data as FilaProspecto[]).map(aProspecto));
}

/** Devuelve null mientras carga; después, la lista de prospectos. */
export function useProspectos(): Prospecto[] | null {
  useEffect(() => { if (!cache && !cargando) refrescar(); }, []);
  return useSyncExternalStore(subscribe, () => cache, () => null);
}

function avisarError(accion: string, error: { message: string } | null) {
  if (error) { console.error(`Error al ${accion}:`, error.message); refrescar(); }
}

export function crearProspecto(data: { nombre: string; contacto: string; origen: string; estado: Estado; monto: number; nota: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const interacciones: Interaccion[] = data.nota ? [{ id: crypto.randomUUID(), fecha: now, canal: data.origen, nota: data.nota }] : [];
  // 1) Se muestra de inmediato en pantalla...
  publicar([{ id, nombre: data.nombre, contacto: data.contacto, origen: data.origen, estado: data.estado, monto: data.monto, ultimoContacto: now, interacciones }, ...(cache ?? [])]);
  // 2) ...y se guarda en la base.
  (async () => {
    const { error } = await supabase.from("prospectos").insert({
      id, nombre: data.nombre, contacto: data.contacto, origen: data.origen, estado: data.estado, monto: data.monto, ultimo_contacto: now,
    });
    if (error) return avisarError("crear el prospecto", error);
    const i = interacciones[0];
    if (i) {
      const r = await supabase.from("interacciones").insert({ id: i.id, prospecto_id: id, canal: i.canal, nota: i.nota });
      avisarError("guardar la nota inicial", r.error);
    }
  })();
  return id;
}

export function cambiarEstado(id: string, estado: Estado) {
  publicar((cache ?? []).map((p) => (p.id === id ? { ...p, estado } : p)));
  supabase.from("prospectos").update({ estado }).eq("id", id)
    .then(({ error }) => avisarError("cambiar el estado", error));
}

export function agregarInteraccion(id: string, canal: string, nota: string) {
  const i: Interaccion = { id: crypto.randomUUID(), fecha: new Date().toISOString(), canal, nota };
  publicar((cache ?? []).map((p) => (p.id === id ? { ...p, ultimoContacto: i.fecha, interacciones: [i, ...p.interacciones] } : p)));
  (async () => {
    const r1 = await supabase.from("interacciones").insert({ id: i.id, prospecto_id: id, canal, nota });
    if (r1.error) return avisarError("guardar la interacción", r1.error);
    const r2 = await supabase.from("prospectos").update({ ultimo_contacto: i.fecha }).eq("id", id);
    avisarError("actualizar el último contacto", r2.error);
  })();
}
