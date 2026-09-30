# Ventas Corporativas · Flota La Macarena

Archivos listos para copiar en el proyecto existente de Google Apps Script:

1. Copiar `index.html` a un archivo HTML llamado **index** (en minúscula).
2. Copiar `codigo.gs` al archivo de código existente, reemplazando su contenido. No duplicar las funciones.
3. Guardar y actualizar la implementación web existente con una nueva versión. Mantener el acceso corporativo y verificar con una cuenta autorizada.

Se mantienen todos los destinos originales, el naranja #EF4123 y el azul #002D62. La portada añade búsqueda, tarjetas con relieve y acceso por categorías. El menú se adapta al celular. La ventana de consumos admite teclado, Escape y cierre al tocar el fondo.

La categoría EPS abre los recursos EPS existentes; el original no incluía destinos específicos de consumo EPS. Estatales muestra un aviso porque no había enlaces configurados. No se inventaron clientes ni enlaces.

Los comunicados usan la misma hoja `comunicado`: columna A para título, B para contenido, primera fila como encabezado. Se conserva formato básico y enlaces HTTP/HTTPS; se excluyen scripts, imágenes y formato arbitrario de la hoja. Se actualizan cada minuto mientras la página está visible; ante un error se conserva el último contenido y se permite reintentar. Al abrir el HTML localmente se muestra un aviso en lugar de simular comunicados.

El código original incluía funciones de reembolsos que esta portada no llama. Se conservaron y se añadieron validaciones. Las lecturas del dashboard y las escrituras de reembolsos requieren correo identificable y un usuario ACTIVO en Configuración. La escritura verifica usuario_gestiona y valor positivo. Esto requiere comprobar la configuración real de ejecución e identidad en Apps Script; si el correo no está disponible, falla con un mensaje en lugar de autorizar una sesión anónima.

Pendiente en el entorno real: confirmar permisos de los enlaces de Drive, lectura de comunicados y funciones de reembolsos con las cuentas correspondientes. La verificación local no confirma esos permisos ni publica la aplicación.

Los originales están en la carpeta de respaldo creada junto a los archivos actualizados.
