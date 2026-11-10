// ==========================================
// SABORES
// ==========================================

function obtenerSabores() {
  return getDatosHoja("Sabor");
}

function obtenerSaboresActivas() {
  const saboresDisponibles = obtenerSabores().filter(function (sabor) {
    return (
      saborTieneValorActivo_(sabor.activo) &&
      saborTieneValorActivo_(sabor.disponible)
    );
  });

  // WhatsApp exige que cada fila del menú tenga un ID único. Si la hoja tiene
  // filas duplicadas para el mismo sabor, conservar solo la primera disponible.
  const idsIncluidos = Object.create(null);
  return saboresDisponibles.filter(function (sabor) {
    const id =
      sabor.id === undefined || sabor.id === null ? "" : String(sabor.id).trim();
    if (!id || Object.prototype.hasOwnProperty.call(idsIncluidos, id)) {
      return false;
    }
    idsIncluidos[id] = true;
    return true;
  });
}

function obtenerSaboresHeladoDisponibles_() {
  return obtenerSaboresActivas().filter(function (sabor) {
    return (
      saborTieneValorActivo_(sabor.es_sabor_helado) ||
      saborTieneValorActivo_(sabor.es_sabor_helado_sin_azucar)
    );
  });
}

function obtenerSaboresDisponiblesProducto_(producto) {
  const tieneSaborHelado = productoTieneSaboresHelado_(producto);
  const tieneSaborJugo = productoTieneSaboresJugo_(producto);
  const tieneSaborHeladoSinAzucar =
    productoTieneSaboresHeladoSinAzucar_(producto);

  return obtenerSaboresActivas().filter(function (sabor) {
    return (
      (tieneSaborHelado &&
        (saborTieneValorActivo_(sabor.es_sabor_helado) ||
          saborTieneValorActivo_(sabor.es_sabor_helado_sin_azucar))) ||
      (tieneSaborJugo && saborTieneValorActivo_(sabor.es_sabor_jugo)) ||
      (tieneSaborHeladoSinAzucar &&
        saborTieneValorActivo_(sabor.es_sabor_helado_sin_azucar))
    );
  });
}

function saborTieneValorActivo_(valor) {
  return (
    valor === true ||
    ["si", "true", "yes", "1", "activo", "disponible"].indexOf(
      normalizarTextoChatbot_(valor),
    ) >= 0
  );
}

function obtenerSaborPorId(idSabor) {
  const sabores = getDatosHoja("Sabor");
  return sabores.find((sabor) => String(sabor.id) === String(idSabor)) || null;
}
