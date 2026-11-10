

// ==========================================
// FUNCIÓN AUXILIAR (Acceso a Google Sheets)
// ==========================================
function getDatosHoja(nombreHoja) {
  const config = obtenerConfiguracion();
  const ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(nombreHoja);
  const datos = sheet.getDataRange().getValues();
  
  // Encabezados en la primera fila, filas de datos en las siguientes
  const headers = datos[0];
  const filas = datos.slice(1);
  
  // Convierte las filas en objetos utilizando los nombres de las columnas
  return filas.map(fila => {
    let objeto = {};
    headers.forEach((header, index) => {
      objeto[header] = fila[index];
    });
    return objeto;
  });
}