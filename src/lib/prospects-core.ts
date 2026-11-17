export type Estado = "Nuevo" | "Cotizado" | "En Seguimiento" | "Cerrado";
export const ESTADOS: Estado[] = ["Nuevo", "Cotizado", "En Seguimiento", "Cerrado"];
export const ORIGENES = ["WhatsApp", "Instagram", "Facebook", "Referido", "Otro"];
export const CANALES = ["WhatsApp", "Llamada", "Instagram", "Correo", "En persona"];
export const DIAS_PENDIENTE = 3;

export interface Interaccion { id: string; fecha: string; canal: string; nota: string }
export interface Prospecto {
  id: string; nombre: string; contacto: string; origen: string; estado: Estado;
  monto: number; ultimoContacto: string; interacciones: Interaccion[];
}

const DAY = 86400000;
export function diasDesde(iso: string, now = Date.now()) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}
export function formatCOP(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");
}
export function ordenarPorAtraso(list: Prospecto[], now = Date.now()) {
  return [...list].sort((a, b) => diasDesde(b.ultimoContacto, now) - diasDesde(a.ultimoContacto, now));
}
export function activos(list: Prospecto[]) { return list.filter((p) => p.estado !== "Cerrado"); }
export function pendientes(list: Prospecto[], now = Date.now()) {
  return activos(list).filter((p) => diasDesde(p.ultimoContacto, now) >= DIAS_PENDIENTE);
}

export function semilla(now = Date.now()): Prospecto[] {
  const d = (n: number) => new Date(now - n * DAY).toISOString();
  const mk = (id: string, nombre: string, contacto: string, origen: string, estado: Estado, monto: number, dias: number, nota: string, canal = origen): Prospecto => ({
    id, nombre, contacto, origen, estado, monto, ultimoContacto: d(dias),
    interacciones: [{ id: id + "-1", fecha: d(dias), canal, nota }],
  });
  return [
    mk("p1", "Camila Restrepo", "+57 310 456 7890", "WhatsApp", "Cotizado", 450000, 6, "Le envié la cotización de los arreglos para el evento. Quedó de confirmar."),
    mk("p2", "Andrés Mejía", "+57 315 222 1408", "Instagram", "En Seguimiento", 1250000, 4, "Preguntó por descuento si compra dos unidades."),
    mk("p3", "Laura Gómez", "laura.gomez@gmail.com", "Instagram", "Nuevo", 180000, 1, "Escribió por DM preguntando precios.", "Instagram"),
    mk("p4", "Santiago Ospina", "+57 300 987 6543", "Referido", "Cotizado", 2400000, 9, "Referido por Camila. Necesita pedido para su tienda.", "Llamada"),
    mk("p5", "Valentina Rojas", "+57 312 765 4321", "WhatsApp", "En Seguimiento", 720000, 2, "Dijo que paga la otra quincena."),
    mk("p6", "Julián Castaño", "julian.castano@hotmail.com", "Facebook", "Cerrado", 950000, 12, "Pagó y se entregó el pedido. ¡Cliente feliz!", "WhatsApp"),
  ];
}
