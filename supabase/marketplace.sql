-- TAMAKU Marketplace B2B - ejecutar una vez en Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.marketplace_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activo boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_productos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references public.marketplace_categorias(id) on delete set null,
  nombre text not null,
  descripcion text,
  imagen_url text,
  sku text unique,
  precio numeric(12,2) not null check (precio >= 0),
  stock integer not null default 0 check (stock >= 0),
  activo boolean not null default true,
  destacado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity unique,
  id_tienda uuid not null references public.tiendas(id),
  user_id uuid not null references auth.users(id),
  estado text not null default 'RECIBIDO' check (estado in ('RECIBIDO','CONFIRMADO','PREPARANDO','ENVIADO','ENTREGADO','CANCELADO')),
  metodo_pago text not null check (metodo_pago in ('CONTRAENTREGA','TRANSFERENCIA')),
  estado_pago text not null default 'PENDIENTE' check (estado_pago in ('PENDIENTE','VERIFICANDO','PAGADO','RECHAZADO')),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  domicilio numeric(12,2) not null default 0 check (domicilio >= 0),
  total numeric(12,2) not null check (total >= 0),
  nombre_recibe text not null,
  telefono text not null,
  direccion text not null,
  ciudad text not null,
  notas text,
  comprobante_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.marketplace_pedidos(id) on delete cascade,
  producto_id uuid not null references public.marketplace_productos(id),
  nombre_producto text not null,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  total numeric(12,2) not null check (total >= 0)
);

create index if not exists marketplace_productos_categoria_idx on public.marketplace_productos(categoria_id);
create index if not exists marketplace_pedidos_tienda_idx on public.marketplace_pedidos(id_tienda, created_at desc);
create index if not exists marketplace_items_pedido_idx on public.marketplace_pedido_items(pedido_id);

create or replace function public.es_marketplace_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.marketplace_admins where user_id = auth.uid()) $$;

create or replace function public.usuario_pertenece_tienda(p_tienda uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.perfiles
    where user_id = auth.uid() and tienda_id = p_tienda and activo = true
  );
$$;

alter table public.marketplace_admins enable row level security;
alter table public.marketplace_categorias enable row level security;
alter table public.marketplace_productos enable row level security;
alter table public.marketplace_pedidos enable row level security;
alter table public.marketplace_pedido_items enable row level security;

drop policy if exists "admin marketplace propio" on public.marketplace_admins;
create policy "admin marketplace propio" on public.marketplace_admins for select using (user_id = auth.uid());
drop policy if exists "categorias visibles autenticados" on public.marketplace_categorias;
create policy "categorias visibles autenticados" on public.marketplace_categorias for select to authenticated using (activo or public.es_marketplace_admin());
drop policy if exists "admin gestiona categorias" on public.marketplace_categorias;
create policy "admin gestiona categorias" on public.marketplace_categorias for all to authenticated using (public.es_marketplace_admin()) with check (public.es_marketplace_admin());
drop policy if exists "productos visibles autenticados" on public.marketplace_productos;
create policy "productos visibles autenticados" on public.marketplace_productos for select to authenticated using (activo or public.es_marketplace_admin());
drop policy if exists "admin gestiona productos" on public.marketplace_productos;
create policy "admin gestiona productos" on public.marketplace_productos for all to authenticated using (public.es_marketplace_admin()) with check (public.es_marketplace_admin());
drop policy if exists "tienda ve pedidos propios" on public.marketplace_pedidos;
create policy "tienda ve pedidos propios" on public.marketplace_pedidos for select to authenticated using (public.es_marketplace_admin() or public.usuario_pertenece_tienda(id_tienda));
drop policy if exists "admin actualiza pedidos" on public.marketplace_pedidos;
create policy "admin actualiza pedidos" on public.marketplace_pedidos for update to authenticated using (public.es_marketplace_admin()) with check (public.es_marketplace_admin());
drop policy if exists "tienda ve items propios" on public.marketplace_pedido_items;
create policy "tienda ve items propios" on public.marketplace_pedido_items for select to authenticated using (
  exists(select 1 from public.marketplace_pedidos p where p.id = pedido_id and (public.es_marketplace_admin() or public.usuario_pertenece_tienda(p.id_tienda)))
);

create or replace function public.crear_pedido_marketplace(
  p_id_tienda uuid, p_metodo_pago text, p_nombre_recibe text, p_telefono text,
  p_direccion text, p_ciudad text, p_notas text, p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_pedido uuid;
  v_item jsonb;
  v_producto marketplace_productos%rowtype;
  v_subtotal numeric(12,2) := 0;
  v_cantidad integer;
begin
  if not public.usuario_pertenece_tienda(p_id_tienda) then raise exception 'No tienes acceso a esta tienda'; end if;
  if p_metodo_pago not in ('CONTRAENTREGA','TRANSFERENCIA') then raise exception 'Método de pago inválido'; end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then raise exception 'El carrito está vacío'; end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cantidad := greatest(1, (v_item->>'cantidad')::integer);
    select * into v_producto from marketplace_productos where id = (v_item->>'producto_id')::uuid and activo = true for update;
    if not found then raise exception 'Un producto ya no está disponible'; end if;
    if v_producto.stock < v_cantidad then raise exception 'Stock insuficiente para %', v_producto.nombre; end if;
    v_subtotal := v_subtotal + (v_producto.precio * v_cantidad);
  end loop;

  insert into marketplace_pedidos(id_tienda,user_id,metodo_pago,estado_pago,subtotal,domicilio,total,nombre_recibe,telefono,direccion,ciudad,notas)
  values(p_id_tienda,auth.uid(),p_metodo_pago,case when p_metodo_pago='TRANSFERENCIA' then 'VERIFICANDO' else 'PENDIENTE' end,v_subtotal,0,v_subtotal,trim(p_nombre_recibe),trim(p_telefono),trim(p_direccion),trim(p_ciudad),nullif(trim(p_notas),''))
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_cantidad := greatest(1, (v_item->>'cantidad')::integer);
    select * into v_producto from marketplace_productos where id = (v_item->>'producto_id')::uuid for update;
    insert into marketplace_pedido_items(pedido_id,producto_id,nombre_producto,cantidad,precio_unitario,total)
    values(v_pedido,v_producto.id,v_producto.nombre,v_cantidad,v_producto.precio,v_producto.precio*v_cantidad);
    update marketplace_productos set stock=stock-v_cantidad,updated_at=now() where id=v_producto.id;
  end loop;
  return v_pedido;
end; $$;

grant execute on function public.crear_pedido_marketplace(uuid,text,text,text,text,text,text,jsonb) to authenticated;

create or replace function public.actualizar_pedido_marketplace_admin(p_pedido uuid, p_estado text, p_estado_pago text)
returns void language plpgsql security definer set search_path = public as $$
declare v_estado_anterior text;
begin
  if not public.es_marketplace_admin() then raise exception 'Acceso administrativo requerido'; end if;
  if p_estado not in ('RECIBIDO','CONFIRMADO','PREPARANDO','ENVIADO','ENTREGADO','CANCELADO') then raise exception 'Estado inválido'; end if;
  if p_estado_pago not in ('PENDIENTE','VERIFICANDO','PAGADO','RECHAZADO') then raise exception 'Estado de pago inválido'; end if;
  select estado into v_estado_anterior from marketplace_pedidos where id=p_pedido for update;
  if not found then raise exception 'Pedido no encontrado'; end if;
  if v_estado_anterior='CANCELADO' and p_estado<>'CANCELADO' then raise exception 'Un pedido cancelado no puede reabrirse'; end if;
  if v_estado_anterior<>'CANCELADO' and p_estado='CANCELADO' then
    update marketplace_productos p set stock=p.stock+i.cantidad,updated_at=now()
    from marketplace_pedido_items i where i.pedido_id=p_pedido and i.producto_id=p.id;
  end if;
  update marketplace_pedidos set estado=p_estado,estado_pago=p_estado_pago,updated_at=now() where id=p_pedido;
end; $$;

revoke all on function public.crear_pedido_marketplace(uuid,text,text,text,text,text,text,jsonb) from public;
revoke all on function public.actualizar_pedido_marketplace_admin(uuid,text,text) from public;
grant execute on function public.crear_pedido_marketplace(uuid,text,text,text,text,text,text,jsonb) to authenticated;
grant execute on function public.actualizar_pedido_marketplace_admin(uuid,text,text) to authenticated;

-- Después de crear las tablas, asigna el primer administrador reemplazando el correo:
-- insert into public.marketplace_admins(user_id)
-- select id from auth.users where email = 'TU_CORREO_ADMINISTRADOR';

insert into public.marketplace_categorias(nombre, orden) values
  ('Cabello', 1), ('Barbería', 2), ('Uñas', 3), ('Equipos', 4), ('Desechables', 5)
on conflict (nombre) do nothing;
