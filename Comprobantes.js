
/**
 * Descarga una imagen recibida por WhatsApp y la guarda en Drive.
 *
 * Requiere en obtenerConfiguracion():
 * - GRAPH_API_VERSION
 * - META_ACCESS_TOKEN
 * - PHONE_NUMBER_ID
 * - DRIVE_FOLDER_COMPROBANTES_ID
 */
function guardarComprobanteEnDrive(mediaId, telefono) {
  const config = obtenerConfiguracion();

  if (!mediaId) {
    throw new Error('No se recibió el ID multimedia del comprobante.');
  }

  const token = config.WHATSAPP_TOKEN;
  const version = config.GRAPH_API_VERSION;
  const phoneNumberId = config.PHONE_NUMBER_ID;
  const folderId = config.DRIVE_FOLDER_COMPROBANTES_ID;

  if (!token || !version || !phoneNumberId || !folderId) {
    throw new Error(
      'Falta configurar el token, la versión de Graph API, ' +
      'el ID del número de WhatsApp o la carpeta de Drive.'
    );
  }

  // 1. Consultar a Meta para obtener la URL temporal.
  const urlMetadata =
    'https://graph.facebook.com/' +
    version + '/' + encodeURIComponent(mediaId) +
    '?phone_number_id=' + encodeURIComponent(phoneNumberId);

  const respuestaMetadata = UrlFetchApp.fetch(urlMetadata, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const codigoMetadata = respuestaMetadata.getResponseCode();
  const cuerpoMetadata = respuestaMetadata.getContentText();

  if (codigoMetadata < 200 || codigoMetadata >= 300) {
    throw new Error(
      'Meta no pudo recuperar el comprobante. HTTP ' +
      codigoMetadata + ': ' + cuerpoMetadata
    );
  }

  const metadata = JSON.parse(cuerpoMetadata);

  if (!metadata.url) {
    throw new Error('Meta no devolvió una URL de descarga.');
  }

  // Aceptar únicamente imágenes JPEG o PNG.
  const mimeType = String(metadata.mime_type || '').toLowerCase();

  const extensiones = {
    'image/jpeg': 'jpg',
    'image/png': 'png'
  };

  if (!extensiones[mimeType]) {
    throw new Error(
      'El comprobante debe ser una imagen JPEG o PNG. Tipo recibido: ' +
      mimeType
    );
  }

  // Límite de imágenes de WhatsApp: 5 MB.
  if (metadata.file_size && Number(metadata.file_size) > 5 * 1024 * 1024) {
    throw new Error('La imagen supera el límite permitido de 5 MB.');
  }

  // 2. Descargar el archivo binario desde la URL temporal.
  // La URL también requiere el token de acceso.
  const respuestaImagen = UrlFetchApp.fetch(metadata.url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  const codigoImagen = respuestaImagen.getResponseCode();

  if (codigoImagen < 200 || codigoImagen >= 300) {
    throw new Error(
      'No se pudo descargar la imagen desde Meta. HTTP ' + codigoImagen
    );
  }

  const blob = respuestaImagen.getBlob();
  const bytes = blob.getBytes();

  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new Error('La imagen está vacía o supera el límite de 5 MB.');
  }

  // Verificar el tipo devuelto en la descarga.
  const mimeDescargado = String(
    respuestaImagen.getHeaders()['Content-Type'] || ''
  ).split(';')[0].toLowerCase();

  if (mimeDescargado && mimeDescargado !== mimeType) {
    throw new Error(
      'El tipo de archivo descargado no coincide con los metadatos de Meta.'
    );
  }

  // 3. Guardar en la carpeta privada de Drive.
  const carpeta = DriveApp.getFolderById(folderId);

  const marcaTiempo = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd_HHmmss'
  );

  const extension = extensiones[mimeType];

  const nombreArchivo =
    'Comprobante_' +
    String(telefono).replace(/\D/g, '') + '_' +
    marcaTiempo + '_' +
    String(mediaId) + '.' + extension;

  blob.setContentType(mimeType);
  blob.setName(nombreArchivo);

  const archivo = carpeta.createFile(blob);

  // No hacer público el archivo: conserva los permisos de Drive.
  return {
    fileId: archivo.getId(),
    url: archivo.getUrl(),
    nombre: archivo.getName(),
    mimeType: mimeType
  };
}
