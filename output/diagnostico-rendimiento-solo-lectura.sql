-- Diagnostico de metadatos; no ejecutado por esta auditoria.
-- No lee filas de clientes, no modifica esquema y no ejecuta pruebas de carga.
-- Ejecutar en el SQL Editor del proyecto correcto con acceso autorizado.
begin transaction read only;
set local statement_timeout = '10s';

-- Tamano y estimaciones de filas (n_live_tup NO es un conteo exacto).
select relname as tabla, n_live_tup as filas_estimadas,
       pg_size_pretty(pg_total_relation_size(relid)) as tamano_total,
       seq_scan, idx_scan, last_analyze, last_autoanalyze
from pg_stat_user_tables
where schemaname = 'public'
  and relname in ('citas', 'facturas', 'factura_detalles', 'clientes_bloqueados',
    'profesionales', 'perfiles', 'perfiles_clientes', 'tiendas',
    'movimientos_financieros', 'cajas_sesiones')
order by pg_total_relation_size(relid) desc;

-- Indices existentes: evaluar redundancias y planes antes de crear otros.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('citas', 'facturas', 'factura_detalles', 'clientes_bloqueados',
    'profesionales', 'perfiles', 'perfiles_clientes', 'tiendas',
    'movimientos_financieros', 'cajas_sesiones')
order by tablename, indexname;

-- Restricciones de citas, incluida exclusion de horarios si esta desplegada.
select conname, contype, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid = to_regclass('public.citas');

-- RLS declarado: su rendimiento debe comprobarse con el rol real de acceso.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('citas', 'facturas', 'profesionales', 'perfiles',
    'clientes_bloqueados', 'movimientos_financieros', 'cajas_sesiones');

-- Indicadores acumulados; interpretar desde stats_reset, no como latencia actual.
select numbackends, xact_commit, xact_rollback, blks_read, blks_hit,
       temp_files, temp_bytes, deadlocks, stats_reset
from pg_stat_database
where datname = current_database();

commit;
