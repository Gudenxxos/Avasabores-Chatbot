function obtenerPedidoPorID(idPedido) {
  const pedidos = getDatosHoja("Pedidos");
  return pedidos.find((p) => String(p.id_pedido) === String(idPedido)) || null;
}

/**
 * Función crearPedido crea un pedido dados los datos de este
 *  */
function crearPedido(datosPedido = {}) {
  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const hojaPedidos = ss.getSheetByName("Pedidos");

  const idPedido = generarIdPedido(hojaPedidos);

  // Generar fecha y hora
  const ahora = new Date();

  const fecha = `${String(ahora.getDate()).padStart(2, "0")}/${String(ahora.getMonth() + 1).padStart(2, "0")}/${ahora.getFullYear()}`;

  const hora = `${ahora.getHours()}:${String(ahora.getMinutes()).padStart(2, "0")}:${String(ahora.getSeconds()).padStart(2, "0")}`;

  const fechaHora = `${fecha} ${hora}`;

  return agregarPedidoATabla(hojaPedidos, idPedido, fechaHora, datosPedido);
}

/**
 * Genera un ID secuencial para los pedidos.
 * Ejemplo: PED001, PED002, PED003...
 */
function generarIdPedido(hojaPedidos) {
  const ultimaFila = hojaPedidos.getLastRow();

  // Si solo existe la fila de encabezados, comienza en 1
  if (ultimaFila < 2) {
    return "1";
  }

  // Obtener el ID del último pedido registrado en la columna A
  const ultimoId = hojaPedidos.getRange(ultimaFila, 1).getDisplayValue();

  const siguienteNumero = Number(ultimoId) + 1;

  // Completar con ceros a la izquierda hasta 3 dígitos
  return siguienteNumero;
}

/**
 * Función agregarPedidoATabla agrega un pedido a la
 * tabla de Google Sheets
 */
function agregarPedidoATabla(hojaPedidos, idPedido, fechaHora, datosPedido) {
  hojaPedidos.appendRow([
    idPedido,
    fechaHora,
    datosPedido.idCliente || "",
    datosPedido.destino || "",
    datosPedido.sector || "",
    datosPedido.envio || 0,
    datosPedido.metodoPago || "",
    datosPedido.comprobantePagoId || "",
    datosPedido.comprobantePagoUrl || "",
  ]);

  return idPedido;
}

/**
 * Agrega un producto a un pedido
 *  */
function agregarProductoXPedido(idPedido, items) {
  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const hojaProductoXPedido = ss.getSheetByName("ProductoXPedido");
  const hojaProductoXPedidoXSabor = ss.getSheetByName("ProductoXPedidoXSabor");
  const hojaProductoXPedidoXTopping = ss.getSheetByName(
    "ProductoXPedidoXTopping",
  );

  if (!hojaProductoXPedido) {
    throw new Error('No existe la hoja "ProductoXPedido".');
  }

  if (!hojaProductoXPedidoXSabor) {
    throw new Error('No existe la hoja "ProductoXPedidoXSabor".');
  }
  if (!hojaProductoXPedidoXTopping) {
    throw new Error('No existe la hoja "ProductoXPedidoXTopping".');
  }

  (Array.isArray(items) ? items : []).forEach((item) => {
    const idDetalle = generarIdProductoXPedido(hojaProductoXPedido);
    const cantidad = Number(item.cantidad) || 0;

    agregarProductoXPedidoATabla(
      hojaProductoXPedido,
      idDetalle,
      idPedido,
      item,
      cantidad,
    );
    agregarSaboresProductoXPedido_(
      hojaProductoXPedidoXSabor,
      idDetalle,
      item.saborIds,
    );
    agregarToppingsProductoXPedido_(
      hojaProductoXPedidoXTopping,
      idDetalle,
      item.toppings,
    );
  });
}

function generarIdProductoXPedido(hojaProductoXPedido) {
  const ultimaFila = hojaProductoXPedido.getLastRow();

  // Si solo existe la fila de encabezados, comienza en 1
  if (ultimaFila < 2) {
    return "1";
  }

  // Obtener el ID del último pedido registrado en la columna A
  const ultimoId = hojaProductoXPedido
    .getRange(ultimaFila, 1)
    .getDisplayValue();

  const siguienteNumero = Number(ultimoId) + 1;

  // Completar con ceros a la izquierda hasta 3 dígitos
  return siguienteNumero;
}

function agregarProductoXPedidoATabla(
  sheet,
  idDetalle,
  idPedido,
  item,
  cantidad,
) {
  const subtotal = Number(item.subtotal);
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error(
      "El subtotal del producto " + item.idProducto + " no es válido.",
    );
  }

  sheet.appendRow([
    idDetalle,
    idPedido,
    item.idProducto,
    cantidad,
    subtotal,
  ]);
}

function agregarSaboresProductoXPedido_(sheet, idProductoXPedido, saborIds) {
  const ids = Array.isArray(saborIds) ? saborIds : [];

  ids.forEach(function (idSabor) {
    if (
      idSabor === null ||
      idSabor === undefined ||
      String(idSabor).trim() === ""
    ) {
      return;
    }

    sheet.appendRow([
      generarIdProductoXPedidoXSabor_(sheet),
      idProductoXPedido,
      String(idSabor).trim(),
    ]);
  });
}

function generarIdProductoXPedidoXSabor_(sheet) {
  const ultimaFila = sheet.getLastRow();
  if (ultimaFila < 2) return "1";

  const ultimoId = sheet.getRange(ultimaFila, 1).getDisplayValue();
  return Number(ultimoId) + 1;
}

function agregarToppingsProductoXPedido_(sheet, idProductoXPedido, toppings) {
  const seleccionados = Array.isArray(toppings) ? toppings : [];

  seleccionados.forEach(function (topping) {
    if (!topping || topping.id === null || topping.id === undefined) return;

    const idTopping = String(topping.id).trim();
    if (!idTopping) return;

    const idSaborHelado = String(topping.saborId || "").trim();
    sheet.appendRow([
      generarIdProductoXPedidoXTopping_(sheet),
      idProductoXPedido,
      idTopping,
      idSaborHelado,
    ]);
  });
}

function generarIdProductoXPedidoXTopping_(sheet) {
  const ultimaFila = sheet.getLastRow();
  if (ultimaFila < 2) return "1";

  const ultimoId = sheet.getRange(ultimaFila, 1).getDisplayValue();
  return Number(ultimoId) + 1;
}

function buscarPedido(hojaPedidos, ultimaFila, idPedido) {
  return hojaPedidos
    .getRange(2, 1, ultimaFila - 1, 1)
    .createTextFinder(String(idPedido))
    .matchEntireCell(true)
    .findNext();
}

function probarCrearPedido() {
  const resultado = crearPedido({
    idCliente: 1,
    destino: "Calle 123 #45-67",
    sector: "Chapinero",
    envio: 5000,
    estado: "Pendiente",
    metodoPago: 2, // ID del método de pago
    comprobantePagoId: "abc123",
    comprobantePagoUrl: "https://drive.google.com/file/d/abc123/view",
  });

  Logger.log(JSON.stringify(resultado));
}

function probarAgregarProductoXPedido() {
  const resultado = agregarProductoXPedido("1", [
    { idProducto: 8, cantidad: 1, subtotal: 0 },
  ]);

  Logger.log(JSON.stringify(resultado));
}

function probarFunciones() {
  probarCrearPedido();
  probarAgregarDetallePedido();
}
