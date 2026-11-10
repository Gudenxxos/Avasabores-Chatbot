function crearCliente(datosCliente) {
  // Validar los datos de entrada
  if (!datosCliente || typeof datosCliente !== "object") {
    throw new Error("Debes proporcionar un objeto con los datos del cliente.");
  }

  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const hojaClientes = ss.getSheetByName("Clientes");

  if (!hojaClientes) {
    throw new Error('No existe una hoja llamada "Clientes".');
  }

  const fecha_registro = new Date().toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Evita que dos altas simultáneas calculen el mismo siguiente ID.
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);

  try {
    const nuevoId = String(obtenerSiguienteIdCliente_(hojaClientes));
    return agregarClienteATabla(
      hojaClientes,
      nuevoId,
      datosCliente,
      fecha_registro,
    );
  } finally {
    bloqueo.releaseLock();
  }
}

function obtenerSiguienteIdCliente_(hojaClientes) {
  const ultimaFila = hojaClientes.getLastRow();
  if (ultimaFila < 2) return 1;

  const ids = hojaClientes.getRange(2, 1, ultimaFila - 1, 1).getValues();
  let mayorIdSecuencial = 0;

  ids.forEach(function (fila) {
    const valor = String(
      fila[0] === null || fila[0] === undefined ? "" : fila[0],
    ).trim();
    // Los IDs antiguos basados en timestamp se ignoran al iniciar la secuencia.
    if (/^\d+$/.test(valor)) {
      const id = Number(valor);
      if (Number.isSafeInteger(id) && id < 10000000000) {
        mayorIdSecuencial = Math.max(mayorIdSecuencial, id);
      }
    }
  });

  return mayorIdSecuencial + 1;
}

function agregarClienteATabla(
  hojaClientes,
  nuevoId,
  datosCliente,
  fecha_registro,
) {
  // Validar nuevamente los datos
  if (!datosCliente || typeof datosCliente !== "object") {
    throw new Error("El parámetro datosCliente no fue recibido correctamente.");
  }

  hojaClientes.appendRow([
    nuevoId,
    datosCliente.nombre || "",
    datosCliente.fecha_registro || fecha_registro,
    datosCliente.activo !== undefined ? datosCliente.activo : true,
  ]);

  return {
    id: nuevoId,
    ...datosCliente,
    fecha_registro: datosCliente.fecha_registro || fecha_registro,
  };
}

function obtenerClientePorId(idCliente) {
  if (
    idCliente === undefined ||
    idCliente === null ||
    String(idCliente).trim() === ""
  ) {
    return null;
  }
  return (
    getDatosHoja("Clientes").find(function (c) {
      return String(c.id) === String(idCliente);
    }) || null
  );
}

/**
 * Actualiza el nombre de un cliente existente.
 * Devuelve el cliente actualizado, o null si no se encontró el ID.
 */
function actualizarNombreCliente(idCliente, nuevoNombre) {
  const nombre = String(
    nuevoNombre === undefined || nuevoNombre === null ? "" : nuevoNombre,
  ).trim();

  if (
    idCliente === undefined ||
    idCliente === null ||
    String(idCliente).trim() === ""
  ) {
    throw new Error("El ID del cliente es obligatorio.");
  }
  if (!nombre) {
    throw new Error("El nombre del cliente es obligatorio.");
  }

  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const hojaClientes = ss.getSheetByName("Clientes");

  if (!hojaClientes) {
    throw new Error('No existe una hoja llamada "Clientes".');
  }

  const ultimaFila = hojaClientes.getLastRow();
  if (ultimaFila < 2) return null;

  // Buscar el ID solo en la columna A, sin incluir el encabezado.
  const celda = hojaClientes
    .getRange(2, 1, ultimaFila - 1, 1)
    .createTextFinder(String(idCliente))
    .matchEntireCell(true)
    .findNext();

  if (!celda) return null;

  // El nombre está en la columna B (2).
  hojaClientes.getRange(celda.getRow(), 2).setValue(nombre);

  return { id: String(idCliente), nombre: nombre };
}

// Prueba: reemplaza el ID por uno que exista en tu hoja Clientes.
function probarActualizarNombreCliente() {
  const resultado = actualizarNombreCliente(
    "1761234567890",
    "Guden Silva Prueba",
  );
  Logger.log(JSON.stringify(resultado));
}

// Prueba
function probarCrearCliente() {
  const resultado = crearCliente({
    nombre: "Guden Silva",
    activo: true,
  });

  Logger.log(JSON.stringify(resultado));
}
