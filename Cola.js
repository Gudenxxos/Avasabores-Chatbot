// ============================================================
// BLOQUEO POR TELÉFONO: si ya se está procesando un mensaje, se ignora el nuevo
// ============================================================

const DEDUP_TTL_SEGUNDOS_ = 21600;     // 6 h: recordar IDs de mensajes ya vistos
const BANDERA_TTL_SEGUNDOS_ = 120;     // si una ejecución muere, la bandera caduca sola

/**
 * @param {string} telefono
 * @param {Object} contenido  Resultado de extraerContenidoMensaje: {tipo, texto, mediaId}
 * @param {string} messageId  ID del mensaje de WhatsApp (wamid...), para deduplicar.
 */
function manejarMensajeEntrante(telefono, contenido, messageId) {
  const tel = String(telefono || '');
  if (!tel) return;

  const cache = CacheService.getScriptCache();
  const claveBandera = 'proc_' + tel;
  let tomeElTurno = false;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // 1. Deduplicar: Meta reintenta webhooks.
    if (messageId) {
      const claveMsg = 'msg_' + messageId;
      if (cache.get(claveMsg)) return;
      cache.put(claveMsg, '1', DEDUP_TTL_SEGUNDOS_);
    }

    // 2. Si ya hay un mensaje en proceso para este teléfono, se ignora este.
    if (cache.get(claveBandera)) {
      registrarEventoWebhook(
        obtenerConfiguracion(),
        'MENSAJE IGNORADO (en proceso)',
        JSON.stringify({ telefono: tel, tipo: contenido.tipo, texto: contenido.texto })
      );
      return;
    }

    // 3. Tomar el turno.
    cache.put(claveBandera, String(Date.now()), BANDERA_TTL_SEGUNDOS_);
    tomeElTurno = true;
  } finally {
    lock.releaseLock();
  }

  if (!tomeElTurno) return;

  try {
    procesarContenidoMensaje_(tel, contenido);
  } catch (error) {
    registrarErrorWebhook(obtenerConfiguracion(), error);
    try {
      sendText(tel, 'Tuvimos un inconveniente procesando tu mensaje 😔. Por favor, inténtalo de nuevo.');
    } catch (e2) {
      registrarErrorWebhook(obtenerConfiguracion(), e2);
    }
  } finally {
    // Siempre liberar la bandera, incluso si hubo error.
    cache.remove(claveBandera);
  }
}