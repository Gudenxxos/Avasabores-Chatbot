// ============================================================
// SESIONES: estado del flujo y carrito temporal por teléfono
// ============================================================

const ENCABEZADOS_SESIONES_ = [
  "id_sesion",
  "telefono",
  "origen",
  "estado",
  "ultimo_mensaje",
  "actualizado",
  "id_cliente",
  "carrito_json",
  "direccion",
  "sector",
  "metodo_pago_id",
  "ultimo_pedido",
  "categoria_actual_id",
  "producto_pendiente_id",
  "pagina",
  "comprobante_pago_id",
  "comprobante_pago_file_id",
  "comprobante_pago_url",
  "cantidad_producto_pendiente",
  "sabores_pendientes_json",
  "menu_enviado",
  "sabores_menu_enviado",
  "adicionales_pendientes_json",
  "adicionales_menu_enviado",
  "toppings_pendientes_json",
];

function obtenerSesion(telefono) {
  if (!telefono) return null;

  const hoja = obtenerHojaSesiones();
  asegurarEncabezadosSesiones_(hoja);
  const fila = buscarFilaPorTelefono(hoja, telefono);
  if (!fila) return null;

  const v = hoja
    .getRange(fila, 1, 1, ENCABEZADOS_SESIONES_.length)
    .getValues()[0];
  return {
    id_sesion: v[0],
    telefono: String(v[1]),
    origen: v[2] || "",
    estado: v[3] || "INICIO",
    ultimo_mensaje: v[4] || "",
    actualizado: v[5] || "",
    id_cliente: v[6] || "",
    carrito_json: v[7] || "[]",
    direccion: v[8] || "",
    sector: v[9] || "",
    metodo_pago_id: v[10] || "",
    ultimo_pedido: v[11] || "",
    categoria_actual_id: v[12] || "",
    producto_pendiente_id: v[13] || "",
    pagina: Number(v[14]) || 0,
    comprobante_pago_id: v[15] || "",
    comprobante_pago_file_id: v[16] || "",
    comprobante_pago_url: v[17] || "",
    cantidad_producto_pendiente: Number(v[18]) || 0,
    sabores_pendientes_json: v[19] || "[]",
    menu_enviado: v[20] === true || String(v[20]).toUpperCase() === "TRUE",
    sabores_menu_enviado:
      v[21] === true || String(v[21]).toUpperCase() === "TRUE",
    adicionales_pendientes_json: v[22] || "{}",
    adicionales_menu_enviado:
      v[23] === true || String(v[23]).toUpperCase() === "TRUE",
    toppings_pendientes_json: v[24] || "{}",
  };
}

/**
 * Crea o actualiza una sesión sin borrar los campos que no se envían.
 * Ejemplo: guardarSesion(telefono, { estado: 'CARRITO' }).
 */
function guardarSesion(telefono, datosSesion) {
  datosSesion = datosSesion || {};
  if (!telefono) throw new Error("El teléfono es obligatorio.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const hoja = obtenerHojaSesiones();
    asegurarEncabezadosSesiones_(hoja);
    const filaExistente = buscarFilaPorTelefono(hoja, telefono);
    const idSesion = filaExistente
      ? hoja.getRange(filaExistente, 1).getValue()
      : generarIdSesion(hoja);

    const anterior = filaExistente
      ? leerDatosSesionFila_(hoja, filaExistente)
      : {};

    function campo(nombre, valorPorDefecto) {
      if (Object.prototype.hasOwnProperty.call(datosSesion, nombre)) {
        return datosSesion[nombre];
      }
      if (Object.prototype.hasOwnProperty.call(anterior, nombre)) {
        return anterior[nombre];
      }
      return valorPorDefecto;
    }

    const valores = [
      idSesion,
      String(telefono),
      campo("origen", ""),
      campo("estado", "INICIO") || "INICIO",
      campo("ultimo_mensaje", ""),
      new Date(),
      campo("id_cliente", ""),
      campo("carrito_json", "[]") || "[]",
      campo("direccion", ""),
      campo("sector", ""),
      campo("metodo_pago_id", ""),
      campo("ultimo_pedido", ""),
      campo("categoria_actual_id", ""),
      campo("producto_pendiente_id", ""),
      Number(campo("pagina", 0)) || 0,
      campo("comprobante_pago_id", ""),
      campo("comprobante_pago_file_id", ""),
      campo("comprobante_pago_url", ""),
      Number(campo("cantidad_producto_pendiente", 0)) || 0,
      campo("sabores_pendientes_json", "[]") || "[]",
      campo("menu_enviado", false) === true ||
        String(campo("menu_enviado", false)).toUpperCase() === "TRUE",
      campo("sabores_menu_enviado", false) === true ||
        String(campo("sabores_menu_enviado", false)).toUpperCase() === "TRUE",
      campo("adicionales_pendientes_json", "{}") || "{}",
      campo("adicionales_menu_enviado", false) === true ||
        String(campo("adicionales_menu_enviado", false)).toUpperCase() ===
          "TRUE",
      campo("toppings_pendientes_json", "{}") || "{}",
    ];

    if (filaExistente) {
      hoja.getRange(filaExistente, 1, 1, valores.length).setValues([valores]);
    } else {
      hoja.appendRow(valores);
    }

    return {
      id_sesion: idSesion,
      telefono: String(telefono),
      accion: filaExistente ? "actualizada" : "creada",
    };
  } finally {
    lock.releaseLock();
  }
}

function leerDatosSesionFila_(hoja, fila) {
  const v = hoja
    .getRange(fila, 1, 1, ENCABEZADOS_SESIONES_.length)
    .getValues()[0];
  return {
    origen: v[2] || "",
    estado: v[3] || "INICIO",
    ultimo_mensaje: v[4] || "",
    id_cliente: v[6] || "",
    carrito_json: v[7] || "[]",
    direccion: v[8] || "",
    sector: v[9] || "",
    metodo_pago_id: v[10] || "",
    ultimo_pedido: v[11] || "",
    categoria_actual_id: v[12] || "",
    producto_pendiente_id: v[13] || "",
    pagina: Number(v[14]) || 0,
    comprobante_pago_id: v[15] || "",
    comprobante_pago_file_id: v[16] || "",
    comprobante_pago_url: v[17] || "",
    cantidad_producto_pendiente: Number(v[18]) || 0,
    sabores_pendientes_json: v[19] || "[]",
    menu_enviado: v[20] === true || String(v[20]).toUpperCase() === "TRUE",
    sabores_menu_enviado:
      v[21] === true || String(v[21]).toUpperCase() === "TRUE",
    adicionales_pendientes_json: v[22] || "{}",
    adicionales_menu_enviado:
      v[23] === true || String(v[23]).toUpperCase() === "TRUE",
    toppings_pendientes_json: v[24] || "{}",
  };
}

function obtenerHojaSesiones() {
  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const hoja = ss.getSheetByName("Sesiones");
  if (!hoja) throw new Error('No existe la hoja "Sesiones".');
  return hoja;
}

function asegurarEncabezadosSesiones_(hoja) {
  const actuales = hoja
    .getRange(1, 1, 1, ENCABEZADOS_SESIONES_.length)
    .getDisplayValues()[0];
  const coinciden = ENCABEZADOS_SESIONES_.every(function (encabezado, i) {
    return String(actuales[i] || "").trim() === encabezado;
  });
  if (!coinciden) {
    // Solo actualiza los encabezados; no borra los registros existentes.
    hoja
      .getRange(1, 1, 1, ENCABEZADOS_SESIONES_.length)
      .setValues([ENCABEZADOS_SESIONES_]);
  }
}

function buscarFilaPorTelefono(hoja, telefono) {
  const ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return null;

  const celda = hoja
    .getRange(2, 2, ultimaFila - 1, 1)
    .createTextFinder(String(telefono))
    .matchEntireCell(true)
    .findNext();
  return celda ? celda.getRow() : null;
}

function generarIdSesion(hojaSesiones) {
  const ultimaFila = hojaSesiones.getLastRow();
  if (ultimaFila < 2) return "1";

  const ids = hojaSesiones.getRange(2, 1, ultimaFila - 1, 1).getDisplayValues();
  let mayor = 0;
  ids.forEach(function (fila) {
    const coincidencia = String(fila[0] || "").match(/(\d+)\s*$/);
    if (coincidencia) mayor = Math.max(mayor, Number(coincidencia[1]));
  });
  return String(mayor + 1);
}

// Pruebas manuales; ejecutar solo con teléfonos de prueba.
function probarCrearSesion() {
  const resultado = guardarSesion("573001234587", {
    origen: "whatsapp",
    estado: "CATEGORIA",
    ultimo_mensaje: "Prueba de sesión",
    direccion: "Calle 123, Ciudad",
    sector: "Sector A",
  });
  Logger.log(JSON.stringify(resultado, null, 2));
}

function probarObtenerSesion() {
  Logger.log(JSON.stringify(obtenerSesion("573001234587"), null, 2));
}
