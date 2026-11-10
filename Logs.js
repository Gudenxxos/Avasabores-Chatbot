
/**
 * Registra un evento general en la hoja Logs.
 *
 * Columnas:
 * Fecha | Evento | Detalle
 */
function registrarEvento(evento, detalle) {
  try {
    const config = obtenerConfiguracion();
    const sheet = obtenerHojaLogs(config);

    const detalleTexto =
      typeof detalle === 'string'
        ? detalle
        : JSON.stringify(detalle);

    sheet.appendRow([
      new Date(),
      evento,
      detalleTexto || ''
    ]);

  } catch (error) {
    // Evita que un fallo del propio logger genere un ciclo de errores.
    console.error(
      '[ERROR LOGGER] No se pudo registrar el evento "' +
      evento + '": ' + error.message
    );
  }
}


/**
 * Registra un error general de cualquier módulo.
 *
 * Uso:
 * registrarErrorGeneral(error, 'Chatbot.gs', 'procesarMensaje');
 */
function registrarErrorGeneral(error, modulo, funcion, contexto) {
  try {

    const detalle = {
      modulo: modulo || 'No especificado',
      funcion: funcion || 'No especificada',
      mensajeError: error && error.message
        ? error.message
        : String(error),
      stack: error && error.stack
        ? error.stack
        : '',
      contexto: contexto || {},
      fechaISO: new Date().toISOString()
    };

    registrarEvento(
      'ERROR_GENERAL',
      detalle
    );

  } catch (errorLogger) {
    // Si falla la configuración o el registro, dejar constancia
    // en los registros de ejecución de Apps Script.
    console.error(
      '[ERROR LOGGER] No fue posible registrar el error original. ' +
      'Error del logger: ' + errorLogger.message
    );
  }
}


/**
 * Registra errores relacionados específicamente con Google Drive.
 */
function registrarErrorDrive(error, funcion, contexto) {
  registrarErrorGeneral(
    error,
    'Drive',
    funcion || 'OperacionDrive',
    contexto || {}
  );
}
