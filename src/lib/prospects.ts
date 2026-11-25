import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { alCambiarSesion } from "./auth";
import type { Estado, Interaccion, Prospecto } from "./prospects-core";

// Capa de datos de CierreClaro: las 3 pantallas leen y escriben SOLO a través de este archivo.
// Todas las consultas van a Supabase con la sesión del usuario: RLS garantiza que cada
// usuario solo vea y modifique SUS prospectos.

let cache: Prospecto[] | null = null;
let cargando = false;
const subs = new Set<() => void>();

function publicar(next: Prospecto[] | null) {
  cache = next;
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

// Al entrar o salir de una cuenta se borra lo que había en memoria (nadie ve datos de otro).
if (typeof window !== "undefined") {
  alCambiarSesion((s) => { publicar(null); if (s) refrescar(); });
}

// Fila de la base (snake_case) → formato de la app.
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

/** READ: trae los prospectos ACTIVOS del usuario con su historial. Los archivados no se muestran. */
export async function refrescar() {
  cargando = true;
  const { data, error } = await supabase
    .from("prospectos")
    .select("id, nombre, contacto, origen, estado, monto, ultimo_contacto, interacciones(id, canal, nota, created_at)")
    .eq("activo", true);
  cargando = false;
  if (error) {
    console.error("Error leyendo prospectos:", error.message);
    publicar([]);
    return;
  }
  publicar((data as FilaProspecto[]).map(aProspecto));
}

/** Devuelve null mientras carga; después, la lista de prospectos activos. */
export function useProspectos(): Prospecto[] | null {
  useEffect(() => { if (!cache && !cargando) refrescar(); }, []);
  return useSyncExternalStore(subscribe, () => cache, () => null);
}

type Resultado = { error: string | null };
const ok: Resultado = { error: null };
const falla = (mensaje: string): Resultado => ({ error: mensaje });

/** CREATE: guarda un prospecto nuevo y, si hay nota inicial, su primera interacción. */
export async function crearProspecto(d: { nombre: string; contacto: string; origen: string; estado: Estado; monto: number; nota: string }): Promise<Resultado & { id?: string }> {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("prospectos").insert({
    id, nombre: d.nombre, contacto: d.contacto, origen: d.origen, estado: d.estado, monto: d.monto,
  });
  if (error) return falla("No se pudo guardar el prospecto. Intenta de nuevo.");
  if (d.nota) {
    const canal = ["WhatsApp", "Instagram"].includes(d.origen) ? d.origen : "WhatsApp";
    const r = await supabase.from("interacciones").insert({ prospecto_id: id, canal, nota: d.nota });
    if (r.error) console.error("La nota inicial no se guardó:", r.error.message);
  }
  await refrescar();
  return { error: null, id };
}

/** UPDATE simple: corrige los datos básicos del prospecto. */
export async function editarProspecto(id: string, d: { nombre: string; contacto: string; origen: string; monto: number }): Promise<Resultado> {
  const { error } = await supabase.from("prospectos").update(d).eq("id", id);
  if (error) return falla("No se pudieron guardar los cambios. Intenta de nuevo.");
  await refrescar();
  return ok;
}

/** UPDATE con regla: para cerrar una venta el monto debe ser mayor a $0. */
export async function cambiarEstado(id: string, estado: Estado): Promise<Resultado> {
  const p = cache?.find((x) => x.id === id);
  if (estado === "Cerrado" && (!p || p.monto <= 0)) {
    return falla("Para cerrar la venta, primero edita el prospecto y escribe el monto vendido.");
  }
  const { error } = await supabase.from("prospectos").update({ estado }).eq("id", id);
  if (error) return falla("No se pudo cambiar el estado. Intenta de nuevo.");
  await refrescar();
  return ok;
}

/**
 * UPDATE con lógica de negocio (la operación central del happy path).
 * Llama a la función registrar_interaccion de la base, que en UNA transacción:
 * valida las reglas → guarda la interacción → actualiza el último contacto
 * → y si el prospecto estaba en "Nuevo" lo pasa a "En Seguimiento".
 */
export async function registrarInteraccion(id: string, canal: string, nota: string): Promise<Resultado> {
  if (!nota.trim()) return falla("Escribe qué hablaron con el cliente.");
  if (nota.length > 500) return falla("La nota no puede pasar de 500 caracteres.");
  const { error } = await supabase.rpc("registrar_interaccion", { p_prospecto_id: id, p_canal: canal, p_nota: nota.trim() });
  if (error) return falla(error.message || "No se pudo registrar la interacción.");
  await refrescar();
  return ok;
}

/** DELETE lógico: el prospecto se archiva (activo = false). La fila y su historia NO se borran. */
export async function archivarProspecto(id: string): Promise<Resultado> {
  const { error } = await supabase.from("prospectos").update({ activo: false }).eq("id", id);
  if (error) return falla("No se pudo archivar el prospecto. Intenta de nuevo.");
  await refrescar();
  return ok;
}
