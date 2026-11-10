
/**
 * WhatsApp.gs
 *
 * Responsabilidad:
 * Comunicarse exclusivamente con WhatsApp Cloud API de Meta.
 *
 * No contiene:
 * - Lógica de pedidos.
 * - Consultas a Google Sheets.
 * - Gestión de estados de conversación.
 * - Cálculos de precios.
 *
 * Dependencia externa:
 * obtenerConfiguracion(), definida en el módulo de configuración.
 */


/* =========================================================
 * 1. ENVÍO DE MENSAJES DE TEXTO
 * ========================================================= */

/**
 * Envía un mensaje de texto a un número de WhatsApp.
 *
 * @param {string|number} phone Número del destinatario.
 * @param {string} texto Contenido del mensaje.
 * @return {Object} Respuesta de WhatsApp Cloud API.
 */
function sendText(phone, texto) {
  return enviarPayloadWhatsApp_(phone, {
    type: "text",
    text: {
      preview_url: false,
      body: String(texto)
    }
  });
}


/* =========================================================
 * 2. ENVÍO DE MENÚ CON BOTONES
 * ========================================================= */

/**
 * Envía un mensaje interactivo con botones de respuesta.
 *
 * @param {string|number} phone Número del destinatario.
 * @param {Object} menu Configuración visual del menú.
 * @param {string} menu.body Texto principal del mensaje.
 * @param {Array<Object>} menu.buttons Botones del menú.
 * @param {string} [menu.header] Encabezado opcional.
 * @param {string} [menu.footer] Pie de mensaje opcional.
 * @return {Object} Respuesta de WhatsApp Cloud API.
 *
 * Cada botón debe tener:
 * { id: "identificador", title: "Texto visible" }
 *
 * Máximo 3 botones por mensaje.
 */
function sendButtonMenu(phone, menu) {
  if (!menu || !Array.isArray(menu.buttons)) {
    throw new Error("El menú debe incluir un arreglo de botones.");
  }

  if (menu.buttons.length < 1 || menu.buttons.length > 3) {
    throw new Error("El menú debe tener entre 1 y 3 botones.");
  }

  const buttons = menu.buttons.map(function(button) {
    if (!button.id || !button.title) {
      throw new Error("Cada botón debe tener id y title.");
    }

    if (String(button.title).length > 20) {
      throw new Error("El título de cada botón admite máximo 20 caracteres.");
    }

    return {
      type: "reply",
      reply: {
        id: String(button.id),
        title: String(button.title)
      }
    };
  });

  const interactive = {
    type: "button",
    body: {
      text: String(menu.body || "")
    },
    action: {
      buttons: buttons
    }
  };

  if (menu.header) {
    interactive.header = {
      type: "text",
      text: String(menu.header)
    };
  }

  if (menu.footer) {
    interactive.footer = {
      text: String(menu.footer)
    };
  }

  return enviarPayloadWhatsApp_(phone, {
    type: "interactive",
    interactive: interactive
  });
}


/* =========================================================
 * 3. ENVÍO DE MENÚ CON LISTA
 * ========================================================= */

/**
 * Envía un mensaje interactivo con una lista de opciones.
 *
 * @param {string|number} phone Número del destinatario.
 * @param {Object} menu Configuración de la lista.
 * @param {string} menu.body Texto principal.
 * @param {string} menu.button Texto del botón que abre la lista.
 * @param {Array<Object>} menu.sections Secciones con opciones.
 * @param {string} [menu.header] Encabezado opcional.
 * @param {string} [menu.footer] Pie opcional.
 * @return {Object} Respuesta de WhatsApp Cloud API.
 *
 * Estructura de cada sección:
 * {
 *   title: "Categoría",
 *   rows: [
 *     {
 *       id: "opcion_1",
 *       title: "Opción",
 *       description: "Descripción opcional"
 *     }
 *   ]
 * }
 */
function sendListMenu(phone, menu) {
  if (!menu || !Array.isArray(menu.sections)) {
    throw new Error("El menú debe incluir un arreglo de secciones.");
  }

  if (!menu.sections.length) {
    throw new Error("La lista debe incluir al menos una sección.");
  }

  if (!menu.button || String(menu.button).length > 20) {
    throw new Error("El botón de la lista es obligatorio y admite máximo 20 caracteres.");
  }

  const sections = menu.sections.map(function(section) {
    if (!Array.isArray(section.rows) || !section.rows.length) {
      throw new Error("Cada sección debe incluir al menos una opción.");
    }

    const rows = section.rows.map(function(item) {
      if (!item.id || !item.title) {
        throw new Error("Cada opción debe tener id y title.");
      }

      if (String(item.title).length > 24) {
        throw new Error("El título de cada opción admite máximo 24 caracteres.");
      }

      if (
        item.description &&
        String(item.description).length > 72
      ) {
        throw new Error("La descripción admite máximo 72 caracteres.");
      }

      const row = {
        id: String(item.id),
        title: String(item.title)
      };

      if (item.description) {
        row.description = String(item.description);
      }

      return row;
    });

    const result = { rows: rows };

    if (section.title) {
      result.title = String(section.title);
    }

    return result;
  });

  const totalRows = sections.reduce(function(total, section) {
    return total + section.rows.length;
  }, 0);

  if (totalRows > 10) {
    throw new Error("Una lista interactiva admite máximo 10 opciones.");
  }

  const interactive = {
    type: "list",
    body: {
      text: String(menu.body || "")
    },
    action: {
      button: String(menu.button),
      sections: sections
    }
  };

  if (menu.header) {
    interactive.header = {
      type: "text",
      text: String(menu.header)
    };
  }

  if (menu.footer) {
    interactive.footer = {
      text: String(menu.footer)
    };
  }

  return enviarPayloadWhatsApp_(phone, {
    type: "interactive",
    interactive: interactive
  });
}


/* =========================================================
 * 4. ENVÍO DE RESUMEN DE PEDIDO
 * ========================================================= */

/**
 * Envía un resumen de pedido previamente construido.
 *
 * Esta función no consulta pedidos ni calcula precios.
 * El módulo de pedidos debe preparar el texto y pasarlo aquí.
 *
 * @param {string|number} phone Número del destinatario.
 * @param {string} resumen Texto completo del resumen.
 * @return {Object} Respuesta de WhatsApp Cloud API.
 */
function sendOrderSummary(phone, resumen) {
  return sendText(phone, resumen);
}

/**
 * Sube una imagen a WhatsApp y devuelve su media ID.
 * @param {Blob} blob Imagen (JPEG o PNG).
 */
function subirMediaWhatsApp(blob) {
  const config = obtenerConfiguracion();

  const url =
    "https://graph.facebook.com/" +
    config.GRAPH_API_VERSION + "/" +
    config.PHONE_NUMBER_ID +
    "/media";

  const response = UrlFetchApp.fetch(url, {
    method: "post",
    headers: { Authorization: "Bearer " + config.WHATSAPP_TOKEN },
    // Con un Blob en el payload, Apps Script envía multipart/form-data.
    payload: {
      messaging_product: "whatsapp",
      type: blob.getContentType(),
      file: blob
    },
    muteHttpExceptions: true
  });

  const statusCode = response.getResponseCode();
  const body = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error("Error al subir imagen a WhatsApp. HTTP " + statusCode + ": " + body);
  }

  const resultado = JSON.parse(body);
  if (!resultado.id) throw new Error("WhatsApp no devolvió el ID de la imagen.");
  return resultado.id;
}

/** Envía una imagen ya subida (por su media ID). */
function sendImage(phone, mediaId, caption) {
  const image = { id: String(mediaId) };
  if (caption) image.caption = String(caption);

  return enviarPayloadWhatsApp_(phone, { type: "image", image: image });
}


/* =========================================================
 * 5. COMUNICACIÓN CENTRAL CON META
 * ========================================================= */

/**
 * Construye y envía el payload a WhatsApp Cloud API.
 *
 * Función privada del módulo (sufijo _).
 * Centraliza URL, autenticación, petición HTTP y errores.
 *
 * @param {string|number} phone Número del destinatario.
 * @param {Object} message Contenido específico del mensaje.
 * @return {Object} Respuesta de la API.
 */
function enviarPayloadWhatsApp_(phone, message) {
  if (phone === null || phone === undefined ||
      String(phone).trim() === "") {
    throw new Error("El número de WhatsApp es obligatorio.");
  }

  if (!message || !message.type) {
    throw new Error("El contenido del mensaje no es válido.");
  }

  const config = obtenerConfiguracion();

  const url =
    "https://graph.facebook.com/" +
    config.GRAPH_API_VERSION + "/" +
    config.PHONE_NUMBER_ID +
    "/messages";

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: String(phone),
    type: message.type
  };

  // Agrega el contenido correspondiente al tipo de mensaje.
  payload[message.type] = message[message.type];

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + config.WHATSAPP_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);

  const statusCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      "Error al enviar mensaje de WhatsApp. HTTP " +
      statusCode + ": " + responseBody
    );
  }

  return JSON.parse(responseBody);
}




/** 
 * ==========================================================================================
 *                                          PRUEBAS
 * ==========================================================================================
*/

function probarTexto() {
  sendText(
    "573196587242",
    "¡Hola! Bienvenido a Avasabores."
  );
}

function probarMenuBotones() {
  sendButtonMenu("573196587242", {
    header: "Avasabores",
    body: "¿Qué deseas hacer hoy?",
    footer: "Selecciona una opción",
    buttons: [
      {
        id: "hacer_pedido",
        title: "Hacer pedido"
      },
      {
        id: "ver_productos",
        title: "Ver productos"
      },
      {
        id: "hablar_asesor",
        title: "Hablar con asesor"
      }
    ]
  });
}

function probarMenuLista() {
  sendListMenu("573196587242", {
    header: "Nuestros productos",
    body: "Explora nuestras opciones de helados y pulpas.",
    button: "Ver productos",
    footer: "Sabores del Pacífico",
    sections: [
      {
        title: "Helados",
        rows: [
          {
            id: "helado_naidi",
            title: "Helado de naidí",
            description: "Sabor exótico del Pacífico"
          },
          {
            id: "helado_borojo",
            title: "Helado de borojó",
            description: "Una opción de sabor intenso"
          }
        ]
      },
      {
        title: "Otros productos",
        rows: [
          {
            id: "pulpa_coco",
            title: "Pulpa de coco",
            description: "Pulpa de fruta para preparar bebidas"
          }
        ]
      }
    ]
  });
}

function probarResumenPedido() {
  const resumen =
    "🧾 *Resumen de tu pedido*\n\n" +
    "Producto: Helado de naidí\n" +
    "Cantidad: 3 unidades\n" +
    "Total: $30.000 COP\n\n" +
    "¿Confirmas tu pedido?";

  sendOrderSummary("573196587242", resumen);
}





