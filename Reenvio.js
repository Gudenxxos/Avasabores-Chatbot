// ============================================================

const RECORDATORIOS_REENVIO_PROP_ = "RECORDATORIOS_REENVIO_PENDIENTES";
const RECORDATORIO_REENVIO_MS_ = 23 * 60 * 60 * 1000;
const RECORDATORIO_REENVIO_TRIGGER_ = "procesarRecordatoriosReenvio_";
const MENSAJE_RECORDATORIO_REENVIO_ =
  "Urgente, envíame un mensaje en menos de una hora para poder enviarte los pedidos";
// REENVÍO: avisa a los números de la hoja "Reenvio" cuando llega un pedido
// ============================================================

/** Lee la hoja Reenvio (id, teléfono, nombre). Quita vacíos y repetidos. */
function obtenerReenvios() {
  const vistos = {};

  return getDatosHoja("Reenvio")
    .map(function (r) {
      return {
        id: r.id,
        telefono: String(r["teléfono"] || r["telefono"] || "").replace(
          /\D/g,
          "",
        ),
        nombre: String(r.nombre || "").trim(),
      };
    })
    .filter(function (r) {
      if (!r.telefono || vistos[r.telefono]) return false;
      vistos[r.telefono] = true;
      return true;
    });
}

/** Busca un destinatario de Reenvio por su número de teléfono. */
function obtenerReenvioPorTelefono_(telefono) {
  const telefonoNormalizado = String(telefono || "").replace(/\D/g, "");
  if (!telefonoNormalizado) return null;

  return (
    obtenerReenvios().find(function (destinatario) {
      return destinatario.telefono === telefonoNormalizado;
    }) || null
  );
}

/** Responde a los teléfonos internos cuando envían un mensaje al bot. */
function responderReinicioContador24h_(telefono) {
  const destinatario = obtenerReenvioPorTelefono_(telefono);
  if (!destinatario) return false;

  programarRecordatorioReenvio_(destinatario.telefono);

  const nombre = destinatario.nombre || "equipo";
  sendText(
    destinatario.telefono,
    "Hola, " + nombre + ", contador de 24h reiniciado",
  );
  return true;
}

/** Registra o reemplaza el vencimiento del recordatorio para este teléfono. */
function programarRecordatorioReenvio_(telefono) {
  const tel = String(telefono || "").replace(/\D/g, "");
  if (!tel) return;

  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const pendientes = JSON.parse(
      propiedades.getProperty(RECORDATORIOS_REENVIO_PROP_) || "{}",
    );
    pendientes[tel] = Date.now() + RECORDATORIO_REENVIO_MS_;
    propiedades.setProperty(
      RECORDATORIOS_REENVIO_PROP_,
      JSON.stringify(pendientes),
    );

    // Un disparador recurrente permite guardar vencimientos y reprogramarlos
    // aunque la ejecución del webhook termine antes de la fecha de envío.
    asegurarTriggerRecordatoriosReenvio_();
  } finally {
    bloqueo.releaseLock();
  }
}

/** Ejecutar manualmente una vez desde Apps Script para crear y autorizar el trigger. */
function instalarTriggerRecordatoriosReenvio() {
  asegurarTriggerRecordatoriosReenvio_();
}

function asegurarTriggerRecordatoriosReenvio_() {
  const existeTrigger = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === RECORDATORIO_REENVIO_TRIGGER_;
  });
  if (!existeTrigger) {
    ScriptApp.newTrigger(RECORDATORIO_REENVIO_TRIGGER_)
      .timeBased()
      .everyMinutes(1)
      .create();
  }
}

/** Envía los recordatorios vencidos. El trigger se ejecuta cada minuto. */
function procesarRecordatoriosReenvio_() {
  const ahora = Date.now();
  const bloqueo = LockService.getScriptLock();
  let vencidos = [];

  bloqueo.waitLock(30000);
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const pendientes = JSON.parse(
      propiedades.getProperty(RECORDATORIOS_REENVIO_PROP_) || "{}",
    );

    Object.keys(pendientes).forEach(function (telefono) {
      if (Number(pendientes[telefono]) <= ahora) {
        vencidos.push(telefono);
        delete pendientes[telefono];
      }
    });

    propiedades.setProperty(
      RECORDATORIOS_REENVIO_PROP_,
      JSON.stringify(pendientes),
    );
  } finally {
    bloqueo.releaseLock();
  }

  vencidos.forEach(function (telefono) {
    try {
      sendText(telefono, MENSAJE_RECORDATORIO_REENVIO_);
    } catch (error) {
      registrarErrorGeneral(
        error,
        "Reenvio",
        "procesarRecordatoriosReenvio_() " + telefono,
      );
      // Conserva el recordatorio para reintentar en el siguiente ciclo.
      programarReintentoRecordatorioReenvio_(telefono);
    }
  });
}

function programarReintentoRecordatorioReenvio_(telefono) {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const pendientes = JSON.parse(
      propiedades.getProperty(RECORDATORIOS_REENVIO_PROP_) || "{}",
    );
    // No reemplazar un nuevo vencimiento creado por un mensaje reciente.
    if (!pendientes[telefono]) {
      pendientes[telefono] = Date.now() + 60 * 1000;
      propiedades.setProperty(
        RECORDATORIOS_REENVIO_PROP_,
        JSON.stringify(pendientes),
      );
    }
  } finally {
    bloqueo.releaseLock();
  }
}

/** Construye el texto del aviso para un destinatario. */
function construirMensajeReenvio_(
  nombreDestinatario,
  carrito,
  sesion,
  metodoPago,
  telefonoCliente,
) {
  const cliente = obtenerClientePorId(sesion.id_cliente);
  const nombreCliente = cliente ? String(cliente.nombre || "").trim() : "";
  const telefonoClienteTexto = String(telefonoCliente || "").trim();
  const totales = calcularTotalesPedido_(carrito, sesion.sector);

  let texto =
    "🧾 Hola" +
    (nombreDestinatario ? ", " + nombreDestinatario : "") +
    ", te informo que llegó un nuevo pedido\n\n";

  if (nombreCliente || telefonoClienteTexto) {
    texto += "👤 *Cliente:* " + (nombreCliente || "Sin registrar");
    if (telefonoClienteTexto) {
      texto += "\n📞 *Teléfono:* " + telefonoClienteTexto;
    }
    texto += "\n\n";
  }

  texto += carrito.construirResumen();

  texto += "\n\n📍 *Dirección:* " + (sesion.direccion || "Sin indicar");
  texto += "\n*Sector:* " + (sesion.sector || "Sin indicar");

  texto += "\n\n--------------------";
  texto +=
    "\n*Subtotal productos:* " +
    formatearPesosCarrito_(totales.subtotalProductos);
  texto += "\n*Costo de envío:* " + formatearPesosCarrito_(totales.costoEnvio);
  texto += "\n*TOTAL A PAGAR:* " + formatearPesosCarrito_(totales.total);

  texto +=
    "\n\n💳 *Método de pago:* " +
    (metodoPago ? metodoPago.nombre : "Sin seleccionar");

  return texto;
}

/**
 * Envía el resumen del pedido a todos los números de Reenvio.
 * Si el pago no es en efectivo, adjunta la imagen del comprobante.
 * Nunca lanza error: un fallo aquí no debe afectar la confirmación del cliente.
 */
function notificarPedidoReenvios_(
  carrito,
  sesion,
  metodoPago,
  telefonoCliente,
) {
  try {
    const destinatarios = obtenerReenvios();
    if (destinatarios.length === 0) return;

    // Subir el comprobante una sola vez y reutilizar el media ID.
    let mediaIdComprobante = "";
    if (!esMetodoEfectivo_(metodoPago) && sesion.comprobante_pago_file_id) {
      try {
        const blob = DriveApp.getFileById(
          sesion.comprobante_pago_file_id,
        ).getBlob();
        mediaIdComprobante = subirMediaWhatsApp(blob);
      } catch (errorImagen) {
        registrarErrorGeneral(
          errorImagen,
          "Reenvio",
          "notificarPedidoReenvios_() subir comprobante",
        );
      }
    }

    destinatarios.forEach(function (dest) {
      try {
        const texto = construirMensajeReenvio_(
          dest.nombre,
          carrito,
          sesion,
          metodoPago,
          telefonoCliente,
        );
        if (mediaIdComprobante) {
          // El cuerpo del aviso va como caption para que el comprobante y
          // el resumen del pedido lleguen en un solo mensaje.
          sendImage(dest.telefono, mediaIdComprobante, texto);
        } else {
          sendText(dest.telefono, texto);
        }
      } catch (errorEnvio) {
        // Si falla un destinatario, se sigue con los demás.
        registrarErrorGeneral(
          errorEnvio,
          "Reenvio",
          "notificarPedidoReenvios_() " + dest.telefono,
        );
      }
    });
  } catch (error) {
    registrarErrorGeneral(error, "Reenvio", "notificarPedidoReenvios_()");
  }
}

// Prueba: envía mensajes reales a los números de la hoja Reenvio.
function probarNotificarReenvios() {
  console.log(JSON.stringify(obtenerReenvios()));
}
