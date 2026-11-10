/**
 * Webhook.gs
 * Puntos de entrada de Meta, normalización de mensajes y registro de logs.
 * La lógica de estados está en Chatbot.gs y el envío está en WhatsApp.gs.
 */

function doGet(e) {
  const config = obtenerConfiguracion();
  return verificarConexionWebhook(e, config.VERIFY_TOKEN);
}

function doPost(e) {
  const config = obtenerConfiguracion();

  try {
    const rawData = obtenerContenidoPost(e);
    registrarEventoWebhook(config, "POST RECIBIDO", rawData);

    const data = JSON.parse(rawData);
    procesarEventoWebhook(data);

    return crearRespuestaJSON({ status: "success" });
  } catch (error) {
    registrarErrorWebhook(config, error);
    console.error("Error en doPost: " + error.message);
    return crearRespuestaJSON({ status: "error", message: error.message });
  }
}

function procesarEventoWebhook(data) {
  if (!esEventoWhatsApp(data)) {
    console.log("Evento ignorado: no es de WhatsApp.");
    return;
  }

  obtenerMensajesEntrantes(data).forEach(function (mensaje) {
    procesarMensajeEntrante(mensaje);
  });
}

function esEventoWhatsApp(data) {
  return Boolean(data && data.object === "whatsapp_business_account");
}

function obtenerMensajesEntrantes(data) {
  const entry = data && data.entry && data.entry[0];
  if (!entry || !entry.changes) return [];

  const change = entry.changes.find(function (item) {
    return item.value && item.value.messages;
  });

  return change ? change.value.messages || [] : [];
}

/** Recibe el mensaje de Meta y lo entrega a la cola (deduplicado y en orden). */
function procesarMensajeEntrante(mensaje) {
  const telefono = mensaje.from;

  if (!telefono) {
    console.warn("Mensaje ignorado: no tiene remitente.");
    return;
  }

  const contenido = extraerContenidoMensaje(mensaje);

  // mensaje.id es el "wamid..." que identifica el mensaje y sirve para deduplicar.
  manejarMensajeEntrante(telefono, contenido, mensaje.id);
}

/** Lógica original de procesamiento: se ejecuta de a un mensaje por teléfono. */
function procesarContenidoMensaje_(telefono, contenido) {
  if (responderReinicioContador24h_(telefono)) {
    registrarEnLog(
      telefono,
      contenido.tipo,
      contenido.texto,
      JSON.stringify({ respuesta: "Contador de 24h reiniciado" }),
    );
    return;
  }

  const respuesta = procesarMensaje(
    telefono,
    contenido.texto,
    String(contenido.tipo || "text").toLowerCase(),
    contenido.mediaId || "",
  );

  try {
    enviarRespuestaChatbot(telefono, respuesta);
  } catch (errorEnvio) {
    registrarErrorWebhook(obtenerConfiguracion(), errorEnvio);
    throw errorEnvio;
  }

  registrarEnLog(
    telefono,
    contenido.tipo,
    contenido.texto,
    JSON.stringify({
      respuesta: respuesta,
      mediaId: contenido.mediaId || "",
    }),
  );
}

/** Normaliza el contenido de los mensajes entrantes. */
function extraerContenidoMensaje(mensaje) {
  const tipoOriginal = String(mensaje.type || "").toUpperCase();

  switch (tipoOriginal) {
    case "TEXT":
      return {
        tipo: "TEXT",
        texto: mensaje.text && mensaje.text.body ? mensaje.text.body : "",
        mediaId: "",
      };

    case "BUTTON":
      return {
        tipo: "BUTTON",
        texto: mensaje.button && mensaje.button.text ? mensaje.button.text : "",
        mediaId: "",
      };

    case "INTERACTIVE":
      return extraerRespuestaInteractiva(mensaje);

    case "IMAGE":
      return {
        tipo: "IMAGE",
        texto: "[Imagen recibida]",
        mediaId:
          mensaje.image && mensaje.image.id ? String(mensaje.image.id) : "",
      };

    case "AUDIO":
    case "LOCATION":
    case "VIDEO":
    case "DOCUMENT":
    case "STICKER":
      return {
        tipo: tipoOriginal,
        texto: "[" + tipoOriginal + " recibido]",
        mediaId: "",
      };

    default:
      return {
        tipo: "UNKNOWN",
        texto: "[Mensaje no compatible]",
        mediaId: "",
      };
  }
}

/** Devuelve el ID estable de la opción; el título solo queda como respaldo. */
function extraerRespuestaInteractiva(mensaje) {
  const interactive = mensaje.interactive || {};

  if (interactive.type === "button_reply") {
    const respuesta = interactive.button_reply || {};
    return { tipo: "BUTTON", texto: respuesta.id || respuesta.title || "" };
  }

  if (interactive.type === "list_reply") {
    const respuesta = interactive.list_reply || {};
    return { tipo: "LIST", texto: respuesta.id || respuesta.title || "" };
  }

  return { tipo: "UNKNOWN", texto: "[Respuesta interactiva no compatible]" };
}

function registrarEnLog(phone, tipo, mensaje, respuesta) {
  const config = obtenerConfiguracion();
  registrarEventoWebhook(
    config,
    "INTERACCION",
    JSON.stringify({
      telefono: phone,
      tipo: tipo,
      mensaje: mensaje,
      respuesta: respuesta,
    }),
  );
}

function registrarEventoWebhook(config, evento, detalle) {
  try {
    const sheet = obtenerHojaLogs(config);
    sheet.appendRow([new Date(), evento, detalle]);
  } catch (error) {
    console.error("No se pudo registrar el evento: " + error.message);
  }
}

function registrarErrorWebhook(config, error) {
  registrarEventoWebhook(
    config,
    "ERROR",
    error.stack || error.message || String(error),
  );
}

function obtenerHojaLogs(config) {
  const spreadsheet = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName("Logs");
  if (!sheet) throw new Error('No existe la hoja de cálculo llamada "Logs".');
  return sheet;
}

function verificarConexionWebhook(e, verifyToken) {
  const parametros = e && e.parameter ? e.parameter : {};
  const mode = parametros["hub.mode"];
  const token = parametros["hub.verify_token"];
  const challenge = parametros["hub.challenge"];

  if (mode && token) {
    if (
      mode === "subscribe" &&
      token === verifyToken &&
      challenge !== undefined
    ) {
      return ContentService.createTextOutput(String(challenge)).setMimeType(
        ContentService.MimeType.TEXT,
      );
    }
    return ContentService.createTextOutput("Error: Token inválido").setMimeType(
      ContentService.MimeType.TEXT,
    );
  }

  return ContentService.createTextOutput(
    "Webhook de WhatsApp activo y funcionando correctamente",
  ).setMimeType(ContentService.MimeType.TEXT);
}

function obtenerContenidoPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error("La solicitud no contiene datos POST.");
  }
  return e.postData.contents;
}

function crearRespuestaJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

// Pruebas manuales. probarEnvioWhatsApp envía un mensaje real.
function probarEnvioWhatsApp() {
  const miNumero = "573196587242";
  const resultado = sendText(
    miNumero,
    "¡Hola! Este es un mensaje de prueba enviado desde GAS.",
  );
  console.log(JSON.stringify(resultado));
}

function probarExtraccionMensaje() {
  const mensaje = {
    from: "573001234587",
    type: "text",
    text: { body: "Hola, quiero ver los productos" },
  };
  console.log(JSON.stringify(extraerContenidoMensaje(mensaje)));
}
