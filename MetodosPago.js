// ==========================================
// METODOS DE PAGO
// ==========================================

function obtenerMetodosDePago() {
  const metodos_de_pago = getDatosHoja('Metodo_de_Pago');
  return metodos_de_pago;
}

function obtenerMetodoDePagoPorId(idMetodo) {
  const metodos_de_pago = getDatosHoja('Metodo_de_Pago');
  return metodos_de_pago.find(p => String(p.id) === String(idMetodo)) || null;
}

function obtenerMetodoDePagoPorNombre(nombre) {
  const nombreNormalizado = normalizarTextoChatbot_(nombre);

  return obtenerMetodosDePago().find(function(metodo_pago) {
    return normalizarTextoChatbot_(metodo_pago.nombre) === nombreNormalizado;
  }) || null;
}
