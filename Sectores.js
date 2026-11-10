// ==========================================
// SECTORES
// ==========================================

/**
 * Obtiene todos los sectores registrados.
 */
function obtenerSectores() {
  return getDatosHoja('Sector');
}

/**
 * Busca un sector por su ID.
 */
function obtenerSectorPorId(idSector) {
  return obtenerSectores().find(function(sector) {
    return String(sector.id) === String(idSector);
  }) || null;
}

/**
 * Busca un sector por su nombre, ignorando mayúsculas
 * y tildes.
 */
function obtenerSectorPorNombre(nombre) {
  const nombreNormalizado = normalizarTextoChatbot_(nombre);

  return obtenerSectores().find(function(sector) {
    return normalizarTextoChatbot_(sector.nombre) === nombreNormalizado;
  }) || obtenerSectorPorNombre("Otros");
}

/**
 * Obtiene el costo de envío de un sector.
 */
function obtenerCostoEnvioSector(idSector) {
  const sector = obtenerSectorPorId(idSector);

  if (!sector) {
    throw new Error('El sector seleccionado no existe.');
  }

  const costo = Number(sector.costo_envio);

  if (!Number.isFinite(costo) || costo < 0) {
    throw new Error('El costo de envío del sector no es válido.');
  }

  return costo;
}
