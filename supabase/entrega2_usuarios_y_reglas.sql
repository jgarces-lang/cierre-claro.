-- =========================================================
-- CierreClaro · Entrega 2: usuarios, reglas de negocio y archivado
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run
-- ANTES: crear el usuario demo en Authentication → Users → Add user
--        (demo@cierreclaro.app, con "Auto Confirm User").
-- =========================================================

-- 1) Cada fila pertenece a un usuario. auth.uid() = el usuario que tiene la sesión abierta.
alter table public.prospectos
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  add column if not exists activo  boolean not null default true;   -- "eliminar" = archivar (no se borra la historia)

alter table public.interacciones
  add column if not exists user_id uuid references auth.users (id) on delete cascade default auth.uid();

-- 2) Los datos que ya existen pasan a ser del usuario demo.
update public.prospectos    set user_id = (select id from auth.users where email = 'demo@cierreclaro.app') where user_id is null;
update public.interacciones set user_id = (select id from auth.users where email = 'demo@cierreclaro.app') where user_id is null;

-- 3) Se cierran las puertas públicas: sin sesión no se ve ni se toca nada.
drop policy if exists "Lectura publica de prospectos"       on public.prospectos;
drop policy if exists "Insercion publica de prospectos"     on public.prospectos;
drop policy if exists "Actualizacion publica de prospectos" on public.prospectos;
drop policy if exists "Lectura publica de interacciones"    on public.interacciones;
drop policy if exists "Insercion publica de interacciones"  on public.interacciones;
revoke all on public.prospectos, public.interacciones from anon;

-- 4) Políticas por usuario: cada quien ve y modifica SOLO sus filas.
create policy "Cada usuario lee sus prospectos"       on public.prospectos for select to authenticated using (user_id = auth.uid());
create policy "Cada usuario crea sus prospectos"      on public.prospectos for insert to authenticated with check (user_id = auth.uid());
create policy "Cada usuario actualiza sus prospectos" on public.prospectos for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Cada usuario lee sus interacciones"  on public.interacciones for select to authenticated using (user_id = auth.uid());
create policy "Cada usuario crea sus interacciones" on public.interacciones for insert to authenticated
  with check (user_id = auth.uid()
              and exists (select 1 from public.prospectos p where p.id = prospecto_id and p.user_id = auth.uid()));

grant select, insert, update on public.prospectos    to authenticated;
grant select, insert         on public.interacciones to authenticated;

-- 5) REGLA DE NEGOCIO principal: registrar una interacción.
--    Todo pasa en UNA transacción: si un paso falla, no queda nada a medias.
create or replace function public.registrar_interaccion(p_prospecto_id uuid, p_canal text, p_nota text)
returns void
language plpgsql
security invoker            -- corre con los permisos del usuario: RLS sigue aplicando
set search_path = public
as $$
declare
  v_estado text;
  v_activo boolean;
begin
  -- Regla 1: la nota es obligatoria y corta.
  if p_nota is null or length(trim(p_nota)) = 0 then
    raise exception 'Escribe qué hablaron con el cliente.';
  end if;
  if length(p_nota) > 500 then
    raise exception 'La nota no puede pasar de 500 caracteres.';
  end if;
  -- Regla 2: el canal debe ser uno de los de la app.
  if p_canal not in ('WhatsApp', 'Llamada', 'Instagram', 'Correo', 'En persona') then
    raise exception 'Canal no válido.';
  end if;

  select estado, activo into v_estado, v_activo
  from prospectos where id = p_prospecto_id;
  -- Regla 3: el prospecto debe existir y ser del usuario (RLS lo filtra).
  if not found then
    raise exception 'No encontramos este prospecto.';
  end if;
  -- Regla 4: un prospecto archivado no recibe interacciones.
  if not v_activo then
    raise exception 'Este prospecto está archivado. Restáuralo para registrar interacciones.';
  end if;

  -- Paso 1: guardar la interacción (Create).
  insert into interacciones (prospecto_id, canal, nota) values (p_prospecto_id, p_canal, trim(p_nota));

  -- Paso 2: recalcular el seguimiento (Update).
  --   · último contacto = ahora → el prospecto deja de estar atrasado.
  --   · Regla 5: si estaba en "Nuevo", el primer contacto lo pasa a "En Seguimiento".
  update prospectos
     set ultimo_contacto = now(),
         estado = case when estado = 'Nuevo' then 'En Seguimiento' else estado end
   where id = p_prospecto_id;
end;
$$;

grant execute on function public.registrar_interaccion(uuid, text, text) to authenticated;
revoke execute on function public.registrar_interaccion(uuid, text, text) from anon, public;

-- 6) Más datos de ejemplo para el usuario demo (para que "¿A quién le escribo hoy?" tenga de dónde escoger).
with demo as (select id from auth.users where email = 'demo@cierreclaro.app'),
nuevos as (
  insert into public.prospectos (user_id, nombre, contacto, origen, estado, monto, ultimo_contacto)
  select demo.id, v.nombre, v.contacto, v.origen, v.estado, v.monto, now() - (v.dias || ' days')::interval
  from demo, (values
    ('Valentina Rojas',  '+57 312 765 4321',         'WhatsApp',  'En Seguimiento', 720000,  5, 'WhatsApp',  'Dijo que paga la otra quincena. Quedé de escribirle el viernes.'),
    ('Julián Castaño',   'julian.castano@hotmail.com','Facebook',  'Cerrado',        950000,  12, 'WhatsApp', 'Pagó y se entregó el pedido. Cliente feliz, puede referir.'),
    ('Mariana López',    '+57 301 222 3344',         'Instagram', 'Cotizado',       1600000, 7, 'Instagram', 'Le mandé la cotización del kit de regalo para la empresa. Va a consultarlo con el jefe.'),
    ('Felipe Arango',    '+57 318 555 0101',         'Referido',  'Nuevo',          300000,  3, 'Llamada',   'Lo refirió Santiago. Preguntó por precios al por mayor.')
  ) as v(nombre, contacto, origen, estado, monto, dias, canal, nota)
  returning id, nombre, ultimo_contacto
)
insert into public.interacciones (user_id, prospecto_id, canal, nota, created_at)
select (select id from demo), n.id,
       case n.nombre when 'Mariana López' then 'Instagram' when 'Felipe Arango' then 'Llamada' else 'WhatsApp' end,
       case n.nombre
         when 'Valentina Rojas' then 'Dijo que paga la otra quincena. Quedé de escribirle el viernes.'
         when 'Julián Castaño'  then 'Pagó y se entregó el pedido. Cliente feliz, puede referir.'
         when 'Mariana López'   then 'Le mandé la cotización del kit de regalo para la empresa. Va a consultarlo con el jefe.'
         else 'Lo refirió Santiago. Preguntó por precios al por mayor.'
       end,
       n.ultimo_contacto
from nuevos n;
