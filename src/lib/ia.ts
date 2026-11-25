import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

// =====================================================================
// Funciones de IA de CierreClaro. Corren SOLO en el servidor (Vercel):
// la llave GEMINI_API_KEY nunca llega al navegador.
// Flujo de cada función: 1) consultar la base  2) armar el prompt  3) llamar a Gemini.
// =====================================================================

// ---- El prompt de PRODUCTO (cómo le habla la IA al usuario de CierreClaro) ----
const INSTRUCCION_PRODUCTO = `Eres el asistente comercial de CierreClaro, la app que usan emprendedores y vendedores en Colombia para hacerle seguimiento a sus clientes por WhatsApp e Instagram.
TONO: escribes como un vendedor colombiano cercano y respetuoso: de tú, natural, frases cortas, sin presionar, sin sonar a robot y con máximo un emoji.
QUÉ HACES: ayudas al vendedor a no dejar enfriar a sus clientes: redactas mensajes de seguimiento y le dices a quién escribirle primero.
CON QUÉ DATOS: usas ÚNICAMENTE los datos que te paso. Si un dato no está, no lo inventas: nunca inventes precios, descuentos, productos, fechas, nombres ni promesas.
LÍMITES: solo hablas del seguimiento comercial de estos clientes. No mencionas que eres una IA ni el nombre de la app. No das consejos legales, financieros ni de otros temas.`;

const DIA = 86_400_000;
const diasDesde = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DIA));
const pesos = (n: number) => "$" + Math.round(Number(n)).toLocaleString("es-CO").replace(/,/g, ".");

type Respuesta = { texto: string | null; error: string | null; prospectos?: { id: string; nombre: string; dias: number }[] };

/** Cliente de Supabase que consulta COMO el usuario que pidió (RLS aplica: solo ve lo suyo). */
async function clienteDelUsuario(token: string) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null; // sin sesión válida no se gasta la API
  return sb;
}

/** Paso 3: la llamada a la API de Gemini (con modelos de respaldo si uno no está disponible). */
async function llamarGemini(tarea: string): Promise<{ texto: string | null; error: string | null }> {
  const llave = process.env["GEMINI_API_KEY"];
  if (!llave) return { texto: null, error: "La IA no está configurada todavía (falta la llave en el servidor)." };
  const modelos = [process.env["GEMINI_MODEL"], "gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"].filter(Boolean) as string[];
  for (const modelo of modelos) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": llave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: INSTRUCCION_PRODUCTO }] },
          contents: [{ role: "user", parts: [{ text: tarea }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      });
      if (r.status === 404) continue; // ese modelo no existe en esta cuenta: probamos el siguiente
      if (r.status === 429) return { texto: null, error: "Se alcanzó el límite gratuito de la IA. Intenta en un minuto." };
      if (!r.ok) return { texto: null, error: "La IA no respondió. Intenta de nuevo." };
      const j = await r.json();
      const texto: string = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
      if (!texto) return { texto: null, error: "La IA no generó respuesta. Intenta de nuevo." };
      return { texto, error: null };
    } catch {
      return { texto: null, error: "No hubo conexión con la IA. Revisa tu internet e intenta de nuevo." };
    }
  }
  return { texto: null, error: "No hay un modelo de IA disponible para esta llave." };
}

// =====================================================================
// Función 1 · Mensaje de seguimiento para UN prospecto
// (no necesita RAG: la respuesta sale de un solo registro)
// =====================================================================
export const sugerirMensaje = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; prospectoId: string }) => d)
  .handler(async ({ data }): Promise<Respuesta> => {
    const sb = await clienteDelUsuario(data.token);
    if (!sb) return { texto: null, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

    // 1) CONSULTAR: solo lo que el mensaje necesita (Ley 1581: el teléfono NO viaja a la IA).
    const { data: p, error } = await sb
      .from("prospectos")
      .select("nombre, estado, monto, origen, ultimo_contacto, interacciones(canal, nota, created_at)")
      .eq("id", data.prospectoId)
      .eq("activo", true)
      .order("created_at", { referencedTable: "interacciones", ascending: false })
      .limit(3, { referencedTable: "interacciones" })
      .maybeSingle();
    if (error || !p) return { texto: null, error: "No encontramos este prospecto." };

    // 2) ARMAR el prompt con los datos consultados.
    const primerNombre = String(p.nombre).split(" ")[0];
    const historial = (p.interacciones ?? [])
      .map((i: { canal: string; nota: string; created_at: string }) => `- Hace ${diasDesde(i.created_at)} días por ${i.canal}: ${i.nota}`)
      .join("\n") || "- (sin interacciones registradas)";
    const objetivo = p.estado === "Cerrado"
      ? "El cliente YA compró. Escribe un mensaje de posventa: agradece, pregunta cómo le fue y, sin presionar, invítalo a recomendar a alguien."
      : "Escribe un mensaje de seguimiento que retome lo último que hablaron y termine con UNA pregunta fácil de responder que acerque la venta.";
    const tarea = `DATOS DEL CLIENTE
Nombre: ${primerNombre}
Estado comercial: ${p.estado}
Monto estimado: ${Number(p.monto) > 0 ? pesos(p.monto) : "no registrado"}
Llegó por: ${p.origen}
Días sin contacto: ${diasDesde(p.ultimo_contacto)}
Últimas interacciones (de la más reciente a la más antigua):
${historial}

TAREA: ${objetivo}
Máximo 3 frases, listo para copiar y pegar en WhatsApp. Escribe SOLO el mensaje, sin comillas ni explicaciones.`;

    // 3) LLAMAR a Gemini.
    return llamarGemini(tarea);
  });

// =====================================================================
// Función 2 · "¿A quién le escribo hoy?" — con RAG
// La pregunta decide la consulta: solo viajan los prospectos atrasados
// (máximo 10), no la tabla completa. El costo por pregunta queda plano
// aunque el vendedor tenga miles de prospectos.
// =====================================================================
export const aQuienEscribir = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => d)
  .handler(async ({ data }): Promise<Respuesta> => {
    const sb = await clienteDelUsuario(data.token);
    if (!sb) return { texto: null, error: "Tu sesión expiró. Vuelve a iniciar sesión." };

    // 1) CONSULTAR lo relevante (Retrieval): activos, sin cerrar, con 3+ días sin contacto,
    //    los más atrasados primero, máximo 10.
    const hace3dias = new Date(Date.now() - 3 * DIA).toISOString();
    const { data: filas, error } = await sb
      .from("prospectos")
      .select("id, nombre, estado, monto, ultimo_contacto, interacciones(nota, created_at)")
      .eq("activo", true)
      .neq("estado", "Cerrado")
      .lte("ultimo_contacto", hace3dias)
      .order("ultimo_contacto", { ascending: true })
      .order("created_at", { referencedTable: "interacciones", ascending: false })
      .limit(1, { referencedTable: "interacciones" })
      .limit(10);
    if (error) return { texto: null, error: "No pudimos consultar tus prospectos. Intenta de nuevo." };

    // Caso vacío: no se llama a la IA (ni se inventa nada).
    if (!filas || filas.length === 0) {
      return { texto: "¡Vas al día! Ningún prospecto activo lleva 3 días o más sin contacto.", error: null, prospectos: [] };
    }

    const prospectos = filas.map((f) => ({ id: f.id as string, nombre: f.nombre as string, dias: diasDesde(f.ultimo_contacto) }));

    // 2) ARMAR el prompt (Augmented) con solo esas filas.
    const lista = filas.map((f, i) =>
      `${i + 1}. ${f.nombre} · ${f.estado} · ${Number(f.monto) > 0 ? pesos(f.monto) : "monto no registrado"} · ${diasDesde(f.ultimo_contacto)} días sin contacto · Última nota: ${f.interacciones?.[0]?.nota ?? "sin notas"}`,
    ).join("\n");
    const tarea = `PROSPECTOS ATRASADOS DEL VENDEDOR (ya vienen ordenados por días sin contacto):
${lista}

TAREA: dile al vendedor a cuáles ${Math.min(3, filas.length)} debe escribirles PRIMERO hoy. Para cada uno, una línea con este formato: "1. Nombre — razón en una frase". Basa la razón en los días sin contacto, el estado, el monto y la última nota. Prioriza a quienes ya tienen cotización o mayor monto. Termina con una frase corta de ánimo. Máximo 90 palabras. Usa solo los nombres de la lista.`;

    // 3) GENERAR la respuesta (Generation).
    const r = await llamarGemini(tarea);
    return { ...r, prospectos };
  });
