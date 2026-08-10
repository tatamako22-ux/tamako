(function () {
  const VERSION = "2026-08-09";
  const PENDIENTE = "[DATOS DEL RESPONSABLE PENDIENTES DE COMPLETAR]";
  let checkboxPendiente = null;

  const documentos = {
    datos: {
      titulo: "Política de Tratamiento de Datos Personales",
      contenido: `
        <p class="legal-warning"><strong>Documento provisional:</strong> antes de producción deben completarse la razón social, identificación, domicilio y canales del responsable.</p>
        <h3>1. Responsable y alcance</h3>
        <p>El responsable de los datos suministrados para crear y administrar una cuenta en TAMAKU será ${PENDIENTE}. En las reservas, la tienda elegida decide las finalidades relacionadas con la prestación del servicio y actúa como responsable; TAMAKU facilita la plataforma tecnológica y trata la información necesaria para operar el servicio.</p>
        <h3>2. Datos tratados</h3>
        <p>Podremos tratar datos de identificación y contacto, información de la cuenta, tienda, profesionales, servicios, reservas, facturación, soporte, seguridad y registros técnicos de uso. No se solicitarán datos sensibles salvo que sean estrictamente necesarios y exista autorización explícita o una habilitación legal.</p>
        <h3>3. Finalidades necesarias</h3>
        <ul><li>Crear, autenticar y administrar cuentas.</li><li>Gestionar reservas, recordatorios, cambios y cancelaciones.</li><li>Permitir que la tienda preste el servicio solicitado y contacte al cliente sobre su cita.</li><li>Procesar operaciones administrativas, contables y de facturación.</li><li>Atender soporte, consultas, reclamos y solicitudes.</li><li>Prevenir fraude, abuso e incidentes de seguridad.</li><li>Cumplir obligaciones legales y contractuales.</li></ul>
        <h3>4. Comunicaciones comerciales</h3>
        <p>El envío de promociones por correo, llamada o WhatsApp requiere una autorización separada y voluntaria. Negarse o retirar esa autorización no impedirá reservar ni usar las funciones esenciales.</p>
        <h3>5. Circulación y encargados</h3>
        <p>Los datos podrán ser tratados por proveedores tecnológicos necesarios para alojamiento, autenticación, correo, soporte y seguridad, bajo condiciones de confidencialidad y protección. No se venderán datos personales.</p>
        <h3>6. Derechos del titular</h3>
        <p>El titular puede conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; ser informado sobre su uso; presentar quejas ante la Superintendencia de Industria y Comercio una vez agotado el trámite correspondiente; y solicitar revocatoria o supresión cuando proceda.</p>
        <h3>7. Consultas y reclamos</h3>
        <p>El canal de privacidad es ${PENDIENTE}. La solicitud deberá identificar al titular, describir los hechos y aportar los documentos pertinentes. Se atenderá dentro de los términos previstos en la Ley 1581 de 2012.</p>
        <h3>8. Seguridad, conservación y vigencia</h3>
        <p>Se aplicarán medidas razonables de seguridad y se conservarán los datos durante la relación contractual y el tiempo necesario para las finalidades informadas u obligaciones legales. Esta versión rige desde el 9 de agosto de 2026. Los cambios sustanciales serán informados por un medio adecuado.</p>`
    },
    terminos: {
      titulo: "Términos y Condiciones de Uso",
      contenido: `
        <p class="legal-warning"><strong>Documento provisional:</strong> debe completarse la identificación legal de TAMAKU antes de producción.</p>
        <h3>1. Aceptación y servicio</h3><p>Al crear una cuenta, el usuario acepta estos términos. TAMAKU proporciona herramientas para administrar tiendas, clientes, agenda, reservas, facturación y funciones relacionadas. Cada tienda es responsable de los servicios que ofrece, sus precios, disponibilidad, calidad y cumplimiento legal.</p>
        <h3>2. Cuenta y seguridad</h3><p>El usuario debe suministrar información veraz, mantener sus credenciales seguras y avisar sobre usos no autorizados. No podrá usar la plataforma para actividades ilegales, fraudulentas o que afecten a terceros.</p>
        <h3>3. Planes y pagos</h3><p>Los planes, periodos de prueba, precios, fechas de pago y condiciones de suspensión serán los informados al contratar. La falta de pago podrá limitar o suspender el acceso, respetando los avisos y plazos aplicables.</p>
        <h3>4. Información de clientes</h3><p>La tienda declara que cuenta con una base legal para registrar y usar datos de sus clientes, debe atender sus derechos y utilizar la información solamente para finalidades autorizadas. TAMAKU actúa como proveedor tecnológico respecto de esa información.</p>
        <h3>5. Disponibilidad y responsabilidad</h3><p>Se procurará la continuidad y seguridad del servicio, sin garantizar ausencia absoluta de interrupciones. Ninguna disposición limita derechos irrenunciables del consumidor ni responsabilidades que legalmente no puedan excluirse.</p>
        <h3>6. Terminación y cambios</h3><p>El usuario podrá dejar de usar el servicio y solicitar el cierre de su cuenta, sujeto a obligaciones legales de conservación. Los cambios sustanciales serán informados antes de su aplicación. Versión vigente desde el 9 de agosto de 2026.</p>
        <h3>7. Contacto y ley aplicable</h3><p>Responsable y canal contractual: ${PENDIENTE}. Estos términos se interpretan conforme a las leyes de la República de Colombia.</p>`
    }
  };

  function asegurarModal() {
    let modal = document.getElementById("tamaku-legal-modal");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "tamaku-legal-modal";
    modal.className = "tamaku-legal-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.innerHTML = `<div class="tamaku-legal-card"><header><div><small>LEGAL · COLOMBIA</small><h2 id="tamaku-legal-title"></h2></div><button type="button" data-legal-close aria-label="Cerrar">&times;</button></header><div id="tamaku-legal-body" class="tamaku-legal-body"></div><footer><span>Versión ${VERSION}</span><button type="button" data-legal-accept>Entendido</button></footer></div>`;
    document.body.appendChild(modal);
    modal.querySelector("[data-legal-close]").addEventListener("click", cerrar);
    modal.querySelector("[data-legal-accept]").addEventListener("click", aceptar);
    modal.addEventListener("click", (evento) => { if (evento.target === modal) cerrar(); });
    return modal;
  }

  function abrir(tipo = "datos", checkboxId = null) {
    const documento = documentos[tipo] || documentos.datos;
    const modal = asegurarModal();
    checkboxPendiente = checkboxId;
    modal.querySelector("#tamaku-legal-title").textContent = documento.titulo;
    modal.querySelector("#tamaku-legal-body").innerHTML = documento.contenido;
    modal.querySelector("[data-legal-accept]").textContent = checkboxId
      ? (tipo === "terminos" ? "Aceptar términos" : "Aceptar política")
      : "Entendido";
    modal.classList.add("is-visible");
    document.body.classList.add("legal-modal-open");
  }

  function cerrar() {
    document.getElementById("tamaku-legal-modal")?.classList.remove("is-visible");
    document.body.classList.remove("legal-modal-open");
  }

  function aceptar() {
    if (checkboxPendiente) {
      const checkbox = document.getElementById(checkboxPendiente);
      if (checkbox) checkbox.checked = true;
    }
    checkboxPendiente = null;
    cerrar();
  }

  window.TamakuLegal = { VERSION, abrir, cerrar, documentos };
  window.abrirDocumentoLegal = abrir;
})();
