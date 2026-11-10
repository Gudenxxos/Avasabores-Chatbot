function obtenerConfiguracion() {
  const scriptProperties = PropertiesService.getScriptProperties();

  const config = {
    WHATSAPP_TOKEN: scriptProperties.getProperty('WHATSAPP_TOKEN'),
    PHONE_NUMBER_ID: scriptProperties.getProperty('PHONE_NUMBER_ID'),
    VERIFY_TOKEN: scriptProperties.getProperty('VERIFY_TOKEN'),
    SPREADSHEET_ID: scriptProperties.getProperty('SPREADSHEET_ID'),
    GRAPH_API_VERSION: scriptProperties.getProperty('GRAPH_API_VERSION'),
    DRIVE_FOLDER_COMPROBANTES_ID: scriptProperties.getProperty('DRIVE_FOLDER_COMPROBANTES_ID')
  };

  return config;
}
