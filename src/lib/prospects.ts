import { useSyncExternalStore } from "react";
import { semilla, type Estado, type Interaccion, type Prospecto } from "./prospects-core";

const KEY = "cierreclaro.prospectos.v1";
let cache: Prospecto[] | null = null;
const subs = new Set<() => void>();

function load(): Prospecto[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : semilla();
  } catch { cache = semilla(); }
  if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(cache));
  return cache!;
}
function save(next: Prospecto[]) {
  cache = next;
  localStorage.setItem(KEY, JSON.stringify(next));
  subs.forEach((f) => f());
}
const EMPTY: Prospecto[] = [];
const subscribe = (f: () => void) => { subs.add(f); return () => subs.delete(f); };

/** Returns null during SSR / before hydration. */
export function useProspectos(): Prospecto[] | null {
  const v = useSyncExternalStore(subscribe, load, () => EMPTY);
  return v === EMPTY ? null : v;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function crearProspecto(data: { nombre: string; contacto: string; origen: string; estado: Estado; monto: number; nota: string }) {
  const now = new Date().toISOString();
  const p: Prospecto = {
    id: uid(), nombre: data.nombre, contacto: data.contacto, origen: data.origen, estado: data.estado,
    monto: data.monto, ultimoContacto: now,
    interacciones: data.nota ? [{ id: uid(), fecha: now, canal: data.origen, nota: data.nota }] : [],
  };
  save([p, ...load()]);
  return p.id;
}
export function cambiarEstado(id: string, estado: Estado) {
  save(load().map((p) => (p.id === id ? { ...p, estado } : p)));
}
export function agregarInteraccion(id: string, canal: string, nota: string) {
  const i: Interaccion = { id: uid(), fecha: new Date().toISOString(), canal, nota };
  save(load().map((p) => (p.id === id ? { ...p, ultimoContacto: i.fecha, interacciones: [i, ...p.interacciones] } : p)));
}
