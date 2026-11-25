import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Sesión del usuario (Supabase Auth). undefined = todavía revisando; null = sin sesión.
let actual: Session | null | undefined;
const subs = new Set<(s: Session | null) => void>();

if (typeof window !== "undefined") {
  supabase.auth.getSession().then(({ data }) => { actual = data.session; subs.forEach((f) => f(actual ?? null)); });
  supabase.auth.onAuthStateChange((_evento, sesion) => { actual = sesion; subs.forEach((f) => f(sesion)); });
}

export function useSesion(): Session | null | undefined {
  const [s, setS] = useState<Session | null | undefined>(actual);
  useEffect(() => {
    setS(actual);
    subs.add(setS);
    return () => { subs.delete(setS); };
  }, []);
  return s;
}

/** Escucha cambios de sesión (entrar o salir). */
export function alCambiarSesion(f: (s: Session | null) => void) {
  subs.add(f);
  return () => subs.delete(f);
}

export async function iniciarSesion(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (!error) return null;
  if (error.message.toLowerCase().includes("invalid")) return "Correo o contraseña incorrectos.";
  if (error.message.toLowerCase().includes("confirm")) return "Esta cuenta aún no está confirmada.";
  return "No pudimos iniciar sesión. Revisa tu conexión e intenta de nuevo.";
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

/** Token de la sesión: el servidor lo usa para consultar la base COMO este usuario. */
export async function tokenActual() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
