- CierreClaro — seguimiento de prospectos (mobile-first)

## Pantallas

1. **Inicio (/)**: resumen (prospectos activos = no Cerrados, seguimiento pendiente = activos con 3+ días sin contacto), buscador por nombre, lista ordenada por días desde último contacto (mayor a menor) con estado y monto ($450.000), botón grande fijo "+ Nuevo prospecto".
2. **Detalle (/prospecto/$id)**: nombre, WhatsApp/correo, origen, estado (Nuevo, Cotizado, En Seguimiento, Cerrado) con selector para cambiarlo, monto en COP, historial (nota, fecha, canal) y formulario para registrar interacción (actualiza último contacto).
3. **Nuevo prospecto (/nuevo)**: nombre, WhatsApp o correo, origen (WhatsApp, Instagram, Facebook, Referido, Otro), estado inicial, monto, nota inicial. Validación con zod.

## Datos

- Guardado en el navegador (localStorage), sin login ni backend, como pide el brief.
- Datos de ejemplo: Camila Restrepo, Andrés Mejía, Laura Gómez y 3-4 más, montos entre $180.000 y $2.400.000, fechas de contacto variadas.

## Estilo

- Azul marino (primario) y verde esmeralda (acento) en tokens oklch; fuente Plus Jakarta Sans; tarjetas espaciadas, botones de 48px+, solo modo claro, textos en español colombiano.

## Técnico 

- Store pequeño en `src/lib/prospects.ts` (useSyncExternalStore + localStorage, lectura tras hidratación).
- Utilidades: formato COP con Intl es-CO, días desde último contacto; test vitest para orden, conteo pendiente y formato.
- head() propio por ruta.

Excluido: login, pagos, reservas, indicadores, reportes, API WhatsApp, IA, modo oscuro.