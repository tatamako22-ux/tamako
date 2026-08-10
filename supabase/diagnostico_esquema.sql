-- TAMAKU: diagnóstico de estructura de Supabase
-- SOLO LECTURA: no crea, modifica ni elimina nada.
-- Ejecuta todo en Supabase > SQL Editor y descarga/copia la única fila JSON resultante.
-- No incluye registros de clientes, correos, contraseñas, tokens ni claves.

select jsonb_pretty(jsonb_build_object(
  'generado_en', now(),
  'version_postgresql', version(),

  'tablas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', t.table_name,
      'rls_activo', c.relrowsecurity,
      'rls_forzado', c.relforcerowsecurity
    ) order by t.table_name)
    from information_schema.tables t
    join pg_namespace n on n.nspname=t.table_schema
    join pg_class c on c.relnamespace=n.oid and c.relname=t.table_name
    where t.table_schema='public' and t.table_type='BASE TABLE'
  ), '[]'::jsonb),

  'columnas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', table_name,
      'posicion', ordinal_position,
      'columna', column_name,
      'tipo', data_type,
      'tipo_udt', udt_name,
      'nullable', is_nullable,
      'default', column_default,
      'max_caracteres', character_maximum_length,
      'precision', numeric_precision,
      'escala', numeric_scale
    ) order by table_name,ordinal_position)
    from information_schema.columns
    where table_schema='public'
  ), '[]'::jsonb),

  'restricciones', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', rel.relname,
      'nombre', con.conname,
      'tipo', case con.contype
        when 'p' then 'PRIMARY KEY' when 'f' then 'FOREIGN KEY'
        when 'u' then 'UNIQUE' when 'c' then 'CHECK'
        when 'x' then 'EXCLUSION' else con.contype::text end,
      'definicion', pg_get_constraintdef(con.oid, true)
    ) order by rel.relname,con.conname)
    from pg_constraint con
    join pg_class rel on rel.oid=con.conrelid
    join pg_namespace n on n.oid=rel.relnamespace
    where n.nspname='public'
  ), '[]'::jsonb),

  'indices', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', tablename,
      'nombre', indexname,
      'definicion', indexdef
    ) order by tablename,indexname)
    from pg_indexes where schemaname='public'
  ), '[]'::jsonb),

  'politicas_rls', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', tablename,
      'nombre', policyname,
      'permisiva', permissive,
      'roles', roles,
      'operacion', cmd,
      'using', qual,
      'with_check', with_check
    ) order by tablename,policyname)
    from pg_policies where schemaname='public'
  ), '[]'::jsonb),

  'funciones', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', p.proname,
      'argumentos', pg_get_function_identity_arguments(p.oid),
      'retorno', pg_get_function_result(p.oid),
      'lenguaje', l.lanname,
      'security_definer', p.prosecdef,
      'definicion', pg_get_functiondef(p.oid)
    ) order by p.proname,pg_get_function_identity_arguments(p.oid))
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang
    where n.nspname='public' and p.prokind='f'
  ), '[]'::jsonb),

  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tabla', event_object_table,
      'nombre', trigger_name,
      'momento', action_timing,
      'evento', event_manipulation,
      'orientacion', action_orientation,
      'accion', action_statement
    ) order by event_object_table,trigger_name,event_manipulation)
    from information_schema.triggers
    where trigger_schema='public'
  ), '[]'::jsonb),

  'vistas', coalesce((
    select jsonb_agg(jsonb_build_object(
      'nombre', viewname,
      'definicion', definition
    ) order by viewname)
    from pg_views where schemaname='public'
  ), '[]'::jsonb),

  'tipos_enum', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tipo', typ.typname,
      'valor', enum.enumlabel,
      'orden', enum.enumsortorder
    ) order by typ.typname,enum.enumsortorder)
    from pg_type typ
    join pg_enum enum on enum.enumtypid=typ.oid
    join pg_namespace n on n.oid=typ.typnamespace
    where n.nspname='public'
  ), '[]'::jsonb),

  'storage_buckets', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'nombre', name,
      'publico', public,
      'limite_archivo', file_size_limit,
      'mime_permitidos', allowed_mime_types
    ) order by name)
    from storage.buckets
  ), '[]'::jsonb)
)) as esquema_tamaku;
