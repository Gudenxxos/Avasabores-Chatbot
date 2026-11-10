/**
 * Chatbot.gs
 * Árbol de estados del flujo de compra de Avasabores.
 * Las funciones devuelven una instrucción de respuesta; la entrega a WhatsApp
 * se realiza mediante enviarRespuestaChatbot() y las funciones de WhatsApp.gs.
 */

function procesarMensaje(telefono, mensaje, tipoMensaje, mediaId) {
  const esPrimerMensaje = Boolean(telefono && !obtenerSesion(telefono));
  const respuesta = procesarMensajeInterno_(
    telefono,
    mensaje,
    tipoMensaje,
    mediaId,
  );

  if (!esPrimerMensaje) return respuesta;

  return respuestaSecuencia_([
    respuestaTexto_(construirMensajeBienvenida_()),
    respuesta,
  ]);
}

function construirMensajeBienvenida_() {
  return [
    "🌴 ¡Hola! ¡Qué alegría tenerte por aquí! 💛",
    "¡Bienvenido(a) a *Avasabores*! 🍦",
    "Hoy queremos compartir contigo un pedacito de nuestra tierra: los sabores, la tradición y la magia del Pacífico colombiano. 🌊✨",
    "Preparamos cada producto con mucho cariño, inspirados en la riqueza de nuestras frutas exóticas y en esos sabores que nos conectan con nuestras raíces. 💚",
    "🍧 *¡Aquí cada sabor cuenta una historia!*",
    "Estamos felices de acompañarte y ayudarte a encontrar ese antojito perfecto para alegrar tu día. 😋",
    "👇 *¿Qué se te antoja hoy?*",
    "¡Explora nuestro menú y déjate conquistar por el sabor del Pacífico!",
    "*Avasabores*\n_Sabores del Pacífico._ 💛",
  ].join("\n\n");
}

function procesarMensajeInterno_(telefono, mensaje, tipoMensaje, mediaId) {
  if (!telefono) throw new Error("El teléfono es obligatorio.");

  const tipo = String(tipoMensaje || "text").toLowerCase();
  const texto = String(
    mensaje === undefined || mensaje === null ? "" : mensaje,
  ).trim();

  let sesion = obtenerSesion(telefono);

  if (!sesion) {
    guardarSesion(telefono, {
      origen: obtenerOrigen(texto),
      estado: "INICIO",
      ultimo_mensaje: texto,
      carrito_json: "[]",
    });
    sesion = obtenerSesion(telefono);
  }

  // Si el cliente vuelve a entrar por un QR o link, se actualiza el origen.
  const origenDetectado = extraerOrigenDeMensaje_(texto);
  const datosActualizar = { ultimo_mensaje: texto };
  if (origenDetectado && (!sesion.origen || sesion.origen === "whatsapp"))
    datosActualizar.origen = origenDetectado;

  guardarSesion(telefono, datosActualizar);
  sesion = obtenerSesion(telefono) || sesion;

  // IMPORTANTE: si se espera un comprobante, no procesar
  // una imagen como si fuera una selección de texto.
  if (String(sesion.estado).toUpperCase() === "COMPROBANTE_PAGO") {
    return procesarComprobantePago_(telefono, tipo, mediaId, sesion);
  }

  const normalizado = normalizarTextoChatbot_(texto);

  if (normalizado === "nuevo pedido") {
    return iniciarNuevoPedido_(telefono);
  }

  if (["menu", "menu principal", "volver al menu"].indexOf(normalizado) >= 0) {
    return mostrarMenuCategorias_(
      telefono,
      "Volvamos al menú. Tu carrito actual se conserva.",
    );
  }

  // Conservar aquí el bloque FINALIZADO existente.
  // Conservar también el resto de validaciones existentes.

  switch (String(sesion.estado || "INICIO").toUpperCase()) {
    case "INICIO":
    case "MENU_PRINCIPAL":
      return mostrarMenuCategorias_(
        telefono,
        "¡Hola! Bienvenido a Avasabores 🍦\n\n¿Qué tipo de producto deseas?",
      );

    case "CATEGORIA":
      return procesarCategoria(telefono, texto, sesion);

    case "PRODUCTO":
      return procesarProducto(telefono, texto, sesion);

    case "CANTIDAD":
      return procesarCantidad(telefono, texto, sesion);

    case "SABOR":
      return procesarSabor_(telefono, texto, sesion);

    case "TOPPING":
      return procesarTopping_(telefono, texto, sesion);

    case "TOPPING_SABOR":
      return procesarSaborTopping_(telefono, texto, sesion);

    case "ADICIONAL":
      return procesarAdicional_(telefono, texto, sesion);

    case "CARRITO":
      return procesarCarrito(telefono, texto, sesion);

    case "ELIMINAR_PRODUCTO":
      return procesarEliminarProducto_(telefono, texto, sesion);

    case "DIRECCION":
      return procesarDireccion(telefono, texto, sesion);

    case "SECTOR":
      return procesarSector(telefono, texto, sesion);

    case "METODO_PAGO":
      return procesarMetodoPago_(telefono, texto, sesion);

    case "CLIENTE_CONFIRMAR":
      return procesarClienteConfirmar_(telefono, texto, sesion);

    case "CLIENTE_NOMBRE":
      return procesarClienteNombre_(telefono, texto, sesion);

    case "CONFIRMACION":
      return procesarConfirmacion(telefono, texto, sesion);

    case "FINALIZADO":
      return iniciarNuevoPedido_(telefono);

    default:
      guardarSesion(telefono, { estado: "CATEGORIA" });
      return mostrarMenuCategorias_(
        telefono,
        "Retomemos tu pedido. Selecciona una categoría.",
      );
  }
}

/**
 * Extrae el origen del mensaje preestablecido de los QR y links:
 * "Hola! 😁 Vi su tienda en [red social / evento] y quisiera hacer un pedido."
 * Devuelve '' si el mensaje no sigue ese formato.
 */
function extraerOrigenDeMensaje_(texto) {
  const coincidencia = String(texto || "").match(
    /vi\s+su\s+tienda\s+en\s+(.+?)\s+y\s+quisiera\s+hacer\s+un\s+pedido/i,
  );
  if (!coincidencia) return "";

  const origen = coincidencia[1].replace(/\s+/g, " ").trim().substring(0, 50);

  if (!origen) return "";

  // Solo pone en mayúscula la primera letra: "instagram" -> "Instagram".
  return origen.charAt(0).toUpperCase() + origen.slice(1);
}

/** Origen para una sesión nueva: el detectado en el mensaje, o 'whatsapp' por defecto. */
function obtenerOrigen(texto) {
  return extraerOrigenDeMensaje_(texto) || "whatsapp";
}

function procesarCategoria(telefono, mensaje, sesion) {
  guardarSesion(telefono, {
    estado: "PRODUCTO",
    categoria_actual_id: "",
    producto_pendiente_id: "",
    pagina: 0,
  });

  return procesarProducto(telefono, mensaje, obtenerSesion(telefono) || sesion);
}

function procesarProducto(telefono, mensaje, sesion) {
  const comando = normalizarTextoChatbot_(mensaje);

  if (
    comando === "ver mas productos" ||
    comando === "ver mas sabores" ||
    comando === "ver_mas_productos"
  ) {
    guardarSesion(telefono, {
      pagina: (Number(sesion.pagina) || 0) + 1,
    });
    return mostrarProductosCategoria_(telefono, obtenerSesion(telefono));
  }

  if (comando === "pagina_anterior") {
    guardarSesion(telefono, {
      pagina: Math.max(0, (Number(sesion.pagina) || 0) - 1),
    });
    return mostrarProductosCategoria_(telefono, obtenerSesion(telefono));
  }

  if (comando === "pagina_siguiente") {
    guardarSesion(telefono, {
      pagina: (Number(sesion.pagina) || 0) + 1,
    });
    return mostrarProductosCategoria_(telefono, obtenerSesion(telefono));
  }

  const productos = obtenerProductosActivos();

  const idSeleccionado =
    String(mensaje).indexOf("producto_") === 0
      ? String(mensaje).substring("producto_".length)
      : "";

  let producto = null;
  if (idSeleccionado) {
    producto =
      productos.find(function (p) {
        return String(obtenerIdProductoCarrito_(p)) === idSeleccionado;
      }) || null;
  }

  if (!producto) {
    const mensajeNormalizado = normalizarTextoChatbot_(mensaje);
    producto =
      productos.find(function (p) {
        return (
          normalizarTextoChatbot_(obtenerNombreProductoCarrito_(p)) ===
            mensajeNormalizado ||
          String(obtenerIdProductoCarrito_(p)) === String(mensaje).trim()
        );
      }) || null;
  }

  if (!producto) {
    return respuestaTexto_(
      "No encontré ese producto." +
        "\nSelecciona una opción de la lista o escribe *menú* para volver al catálogo.",
    );
  }

  guardarSesion(telefono, {
    estado: "CANTIDAD",
    producto_pendiente_id: String(obtenerIdProductoCarrito_(producto)),
  });

  return respuestaTexto_(
    "Elegiste \n\n*" +
      obtenerNombreProductoCarrito_(producto) +
      "*." +
      "\n\n¿Cuántas unidades deseas? Escribe una cantidad entera, por ejemplo: *2*.\n\nDespués de esto podrás elegir los sabores/toppings si el producto lo permite.",
  );
}

function procesarCantidad(telefono, mensaje, sesion) {
  const cantidadTexto = String(mensaje).trim();
  if (!/^\d+$/.test(cantidadTexto)) {
    return respuestaTexto_(
      "Escribe la cantidad con números enteros. Por ejemplo: *2*.",
    );
  }

  const cantidad = Number(cantidadTexto);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
    return respuestaTexto_(
      "La cantidad debe estar entre 1 y 100 unidades. Inténtalo de nuevo.",
    );
  }

  const idPendiente = String(sesion.producto_pendiente_id || "");
  const producto = obtenerProductosActivos().find(function (p) {
    return String(obtenerIdProductoCarrito_(p)) === idPendiente;
  });

  if (!producto) {
    guardarSesion(telefono, { estado: "CATEGORIA", producto_pendiente_id: "" });
    return mostrarMenuCategorias_(
      telefono,
      "No pude recuperar el producto. Selecciona la categoría otra vez.",
    );
  }

  const carrito = new Carrito(telefono);

  if (productoTieneSaboresConfigurados_(producto)) {
    const cantidadSabores = obtenerCantidadSaboresProducto_(producto);
    if (cantidadSabores > 0) {
      guardarSesion(telefono, {
        estado: "SABOR",
        cantidad_producto_pendiente: cantidad,
        sabores_pendientes_json: JSON.stringify({
          unidad_actual: 1,
          sabores_actuales: [],
          sabor_ids_actuales: [],
          combinaciones: [],
        }),
        pagina: 0,
        sabores_menu_enviado: false,
      });
      return mostrarSabores_(telefono, producto, 0);
    }
  }

  if (productoTieneToppings_(producto)) {
    return iniciarToppings_(telefono, producto, cantidad, [], []);
  }

  if (productoPermiteAdicionales_(producto)) {
    guardarSesion(telefono, {
      estado: "ADICIONAL",
      cantidad_producto_pendiente: cantidad,
      adicionales_pendientes_json: JSON.stringify({
        unidad_actual: 1,
        combinaciones: [],
        combinacion_actual: { nombres: [], ids: [] },
        adicionales_actuales: [],
      }),
      adicionales_menu_enviado: false,
      pagina: 0,
    });
    return mostrarPreguntaAdicionales_(telefono, producto);
  }

  carrito.agregarProducto(producto, cantidad, [], [], []);

  guardarSesion(telefono, {
    estado: "CARRITO",
    producto_pendiente_id: "",
    categoria_actual_id: "",
    pagina: 0,
  });

  return mostrarCarrito_(telefono, "✅ Agregué el producto a tu carrito.");
}

function mostrarSabores_(telefono, producto, numeroSeleccion) {
  const sabores = obtenerSaboresDisponiblesProducto_(producto);
  if (!sabores.length) {
    return respuestaTexto_(
      "No hay sabores disponibles para este producto. Intenta más tarde.",
    );
  }

  const cantidadSabores = obtenerCantidadSaboresProducto_(producto);
  const sesion = obtenerSesion(telefono) || {};
  const estadoSabores = obtenerEstadoSaboresPendientes_(sesion);
  const cantidadUnidades = Number(sesion.cantidad_producto_pendiente) || 1;
  const pagina = Math.max(0, Number(sesion.pagina) || 0);
  const totalPaginas = Math.max(1, Math.ceil(sabores.length / 8));
  const inicio = pagina * 8;
  if (inicio >= sabores.length) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarSabores_(telefono, producto, numeroSeleccion);
  }

  const filas = sabores.slice(inicio, inicio + 8).map(function (sabor) {
    const nombre = String(sabor.nombre || "Sabor " + sabor.id);
    const nombreEnLista = String(sabor.nombre_en_lista || nombre).trim();
    const descripcionEnLista = String(
      sabor["descripción_en_lista"] ||
        sabor.descripcion_en_lista ||
        "Elegir este sabor",
    ).trim();

    return {
      id: "sabor_" + String(sabor.id),
      title: nombreEnLista.substring(0, 24),
      description: descripcionEnLista.substring(0, 72),
    };
  });

  agregarNavegacionLista_(filas, pagina, totalPaginas);

  const menu = {
    header: "Escoge el sabor",
    body:
      construirContenidoLista_(filas, pagina, totalPaginas) +
      "\n\nProducto " +
      estadoSabores.unidad_actual +
      " de " +
      cantidadUnidades +
      "\nSelecciona el sabor " +
      (numeroSeleccion + 1) +
      " de " +
      cantidadSabores +
      ".\n\n",
    footer: "Elige una opción.",
    button: "👇ESCOGER SABOR👇",
    sections: [{ title: "Sabores disponibles", rows: filas }],
  };

  if (sesion.sabores_menu_enviado === true) {
    return respuestaLista_(menu);
  }

  guardarSesion(telefono, { sabores_menu_enviado: true });
  return respuestaSaboresCompleta_(sabores, menu, cantidadSabores);
}

function procesarSabor_(telefono, mensaje, sesion) {
  const idPendiente = String(sesion.producto_pendiente_id || "");
  const producto = obtenerProductosActivos().find(function (p) {
    return String(obtenerIdProductoCarrito_(p)) === idPendiente;
  });
  if (!producto) {
    guardarSesion(telefono, {
      estado: "PRODUCTO",
      producto_pendiente_id: "",
      sabores_pendientes_json: "[]",
    });
    return mostrarMenuCategorias_(
      telefono,
      "No pude recuperar el producto. Selecciona otro.",
    );
  }

  const seleccion = String(mensaje || "").trim();
  if (seleccion === "pagina_anterior") {
    guardarSesion(telefono, {
      pagina: Math.max(0, (Number(sesion.pagina) || 0) - 1),
    });
    return mostrarSabores_(
      telefono,
      producto,
      obtenerSaboresPendientes_(sesion).length,
    );
  }
  if (seleccion === "pagina_siguiente") {
    guardarSesion(telefono, { pagina: (Number(sesion.pagina) || 0) + 1 });
    return mostrarSabores_(
      telefono,
      producto,
      obtenerSaboresPendientes_(sesion).length,
    );
  }
  const sabores = obtenerSaboresDisponiblesProducto_(producto);
  const idSeleccionado =
    seleccion.indexOf("sabor_") === 0
      ? seleccion.substring("sabor_".length)
      : "";
  const sabor = sabores.find(function (item) {
    return (
      (idSeleccionado && String(item.id) === idSeleccionado) ||
      normalizarTextoChatbot_(item.nombre) ===
        normalizarTextoChatbot_(seleccion) ||
      String(item.id) === seleccion
    );
  });

  if (!sabor)
    return mostrarSabores_(
      telefono,
      producto,
      obtenerSaboresPendientes_(sesion).length,
    );

  const estadoSabores = obtenerEstadoSaboresPendientes_(sesion);
  estadoSabores.sabores_actuales.push(
    String(sabor.nombre || "Sabor " + sabor.id),
  );
  estadoSabores.sabor_ids_actuales.push(String(sabor.id));
  const cantidadSabores = obtenerCantidadSaboresProducto_(producto);

  if (estadoSabores.sabores_actuales.length < cantidadSabores) {
    guardarSesion(telefono, {
      pagina: 0,
      sabores_pendientes_json: JSON.stringify(estadoSabores),
    });
    return mostrarSabores_(
      telefono,
      producto,
      estadoSabores.sabores_actuales.length,
    );
  }

  const cantidad = Number(sesion.cantidad_producto_pendiente || 1);
  const combinacion = {
    nombres: estadoSabores.sabores_actuales,
    ids: estadoSabores.sabor_ids_actuales,
  };

  if (productoTieneToppings_(producto)) {
    return iniciarToppings_(
      telefono,
      producto,
      cantidad,
      estadoSabores.combinaciones,
      combinacion,
    );
  }

  if (productoPermiteAdicionales_(producto)) {
    guardarSesion(telefono, {
      estado: "ADICIONAL",
      adicionales_pendientes_json: JSON.stringify({
        unidad_actual: estadoSabores.unidad_actual,
        cantidad_unidades: cantidad,
        combinaciones: estadoSabores.combinaciones,
        combinacion_actual: combinacion,
        adicionales_actuales: [],
      }),
      adicionales_menu_enviado: false,
      pagina: 0,
    });
    return mostrarPreguntaAdicionales_(telefono, producto);
  }

  estadoSabores.combinaciones.push(combinacion);
  if (estadoSabores.unidad_actual < cantidad) {
    estadoSabores.unidad_actual += 1;
    estadoSabores.sabores_actuales = [];
    estadoSabores.sabor_ids_actuales = [];
    guardarSesion(telefono, {
      pagina: 0,
      sabores_pendientes_json: JSON.stringify(estadoSabores),
    });
    return mostrarSabores_(telefono, producto, 0);
  }
  return guardarCombinacionesProducto_(
    telefono,
    producto,
    estadoSabores.combinaciones,
    cantidad,
  );
}

function iniciarToppings_(
  telefono,
  producto,
  cantidad,
  combinaciones,
  combinacionActual,
) {
  guardarSesion(telefono, {
    estado: "TOPPING",
    cantidad_producto_pendiente: cantidad,
    toppings_pendientes_json: JSON.stringify({
      unidad_actual: combinaciones.length + 1,
      combinaciones: combinaciones || [],
      combinacion_actual: combinacionActual || { nombres: [], ids: [] },
      toppings_actuales: [],
      menu_enviado: false,
    }),
    pagina: 0,
  });
  return mostrarToppings_(telefono, producto, 0);
}

function mostrarToppings_(telefono, producto, numeroSeleccion) {
  const toppings = obtenerToppingsDisponiblesProducto_(producto);
  const sesion = obtenerSesion(telefono) || {};
  const estado = obtenerEstadoToppingsPendientes_(sesion);
  const cantidadToppings = obtenerCantidadToppingsProducto_(producto);
  const cantidadUnidades = Number(sesion.cantidad_producto_pendiente) || 1;

  if (!toppings.length || cantidadToppings <= 0) {
    return finalizarToppings_(telefono, producto, estado);
  }

  const pagina = Math.max(0, Number(sesion.pagina) || 0);
  const tamanoPagina = 7;
  const totalPaginas = Math.max(1, Math.ceil(toppings.length / tamanoPagina));
  const inicio = pagina * tamanoPagina;
  if (inicio >= toppings.length) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarToppings_(telefono, producto, numeroSeleccion);
  }

  const filas = toppings
    .slice(inicio, inicio + tamanoPagina)
    .map(function (topping, indice) {
      return {
        id: "topping_" + String(topping.id) + "_" + String(inicio + indice),
        title: String(topping.detalle || "Topping " + topping.id).substring(
          0,
          24,
        ),
        description: "Elegir este topping",
      };
    });
  filas.push({
    id: "sin_topping",
    title: "Sin Topping",
    description: "Continuar sin toppings",
  });
  agregarNavegacionLista_(filas, pagina, totalPaginas);

  const menu = {
    header: "Escoge el topping",
    body:
      "Producto " +
      estado.unidad_actual +
      " de " +
      cantidadUnidades +
      "\nSelecciona el topping " +
      (numeroSeleccion + 1) +
      " de " +
      cantidadToppings +
      ".\n\n" +
      construirContenidoLista_(filas, pagina, totalPaginas),
    footer: "Elige una opción.",
    button: "👇ESCOGER TOPPING👇",
    sections: [{ title: "Toppings disponibles", rows: filas }],
  };

  if (estado.menu_enviado === true) return respuestaLista_(menu);

  estado.menu_enviado = true;
  guardarSesion(telefono, {
    toppings_pendientes_json: JSON.stringify(estado),
  });
  return respuestaToppingsCompleta_(toppings, menu);
}

function procesarTopping_(telefono, mensaje, sesion) {
  const producto = obtenerProductosActivos().find(function (item) {
    return (
      String(obtenerIdProductoCarrito_(item)) ===
      String(sesion.producto_pendiente_id || "")
    );
  });
  if (!producto)
    return mostrarMenuCategorias_(telefono, "No pude recuperar el producto.");

  const seleccion = String(mensaje || "").trim();
  if (seleccion === "pagina_anterior" || seleccion === "pagina_siguiente") {
    guardarSesion(telefono, {
      pagina: Math.max(
        0,
        Number(sesion.pagina || 0) +
          (seleccion === "pagina_siguiente" ? 1 : -1),
      ),
    });
    return mostrarToppings_(
      telefono,
      producto,
      obtenerEstadoToppingsPendientes_(sesion).toppings_actuales.length,
    );
  }

  if (
    normalizarTextoChatbot_(seleccion).replace(/\s+/g, "_") === "sin_topping"
  ) {
    const estado = obtenerEstadoToppingsPendientes_(sesion);
    estado.toppings_actuales = [];
    estado.topping_sabor_pendiente = null;
    guardarSesion(telefono, {
      estado: "TOPPING",
      toppings_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return finalizarToppings_(telefono, producto, estado);
  }

  const id =
    seleccion.indexOf("topping_") === 0
      ? seleccion.substring(8).split("_")[0]
      : "";
  const topping = obtenerToppingsDisponiblesProducto_(producto).find(
    function (item) {
      return (
        String(item.id) === id ||
        normalizarTextoChatbot_(item.detalle) ===
          normalizarTextoChatbot_(seleccion)
      );
    },
  );
  if (!topping) return mostrarToppings_(telefono, producto, 0);

  const estado = obtenerEstadoToppingsPendientes_(sesion);
  const toppingSeleccionado = {
    id: String(topping.id),
    nombre: String(topping.detalle || "Topping " + topping.id),
  };
  if (toppingEsSaborHelado_(topping)) {
    estado.topping_sabor_pendiente = toppingSeleccionado;
    guardarSesion(telefono, {
      estado: "TOPPING_SABOR",
      toppings_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarSaboresTopping_(telefono, producto, 0);
  }

  estado.toppings_actuales.push(toppingSeleccionado);
  const cantidadToppings = obtenerCantidadToppingsProducto_(producto);
  if (estado.toppings_actuales.length < cantidadToppings) {
    guardarSesion(telefono, {
      toppings_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarToppings_(
      telefono,
      producto,
      estado.toppings_actuales.length,
    );
  }

  return finalizarToppings_(telefono, producto, estado);
}

function mostrarSaboresTopping_(telefono, producto, numeroSeleccion) {
  const sabores = obtenerSaboresHeladoDisponibles_();
  const sesion = obtenerSesion(telefono) || {};
  const pagina = Math.max(0, Number(sesion.pagina) || 0);
  const totalPaginas = Math.max(1, Math.ceil(sabores.length / 8));
  const inicio = pagina * 8;

  if (!sabores.length) {
    return respuestaTexto_("No hay sabores de helado disponibles.");
  }
  if (inicio >= sabores.length) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarSaboresTopping_(telefono, producto, numeroSeleccion);
  }

  const filas = sabores.slice(inicio, inicio + 8).map(function (sabor, indice) {
    const nombre = String(sabor.nombre || "Sabor " + sabor.id);
    return {
      id: "topping_sabor_" + String(sabor.id) + "_" + String(inicio + indice),
      title: String(sabor.nombre_en_lista || nombre).substring(0, 24),
      description: String(
        sabor["descripción_en_lista"] ||
          sabor.descripcion_en_lista ||
          "Elegir este sabor",
      ).substring(0, 72),
    };
  });
  agregarNavegacionLista_(filas, pagina, totalPaginas);

  return respuestaLista_({
    header: "Sabor del topping",
    body: "Selecciona el sabor de helado para el topping.",
    footer: "Elige una opción.",
    button: "👇ESCOGER SABOR👇",
    sections: [{ title: "Sabores disponibles", rows: filas }],
  });
}

function procesarSaborTopping_(telefono, mensaje, sesion) {
  const producto = obtenerProductosActivos().find(function (item) {
    return (
      String(obtenerIdProductoCarrito_(item)) ===
      String(sesion.producto_pendiente_id || "")
    );
  });
  if (!producto)
    return mostrarMenuCategorias_(telefono, "No pude recuperar el producto.");

  if (productoEsHelado_(producto)) {
    const estado = obtenerEstadoToppingsPendientes_(sesion);
    estado.topping_sabor_pendiente = null;
    guardarSesion(telefono, {
      estado: "TOPPING",
      toppings_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarToppings_(
      telefono,
      producto,
      estado.toppings_actuales.length,
    );
  }

  const seleccion = String(mensaje || "").trim();
  if (seleccion === "pagina_anterior" || seleccion === "pagina_siguiente") {
    guardarSesion(telefono, {
      pagina: Math.max(
        0,
        Number(sesion.pagina || 0) +
          (seleccion === "pagina_siguiente" ? 1 : -1),
      ),
    });
    return mostrarSaboresTopping_(telefono, producto, 0);
  }

  const id =
    seleccion.indexOf("topping_sabor_") === 0
      ? seleccion.substring(14).split("_")[0]
      : "";
  const sabor = obtenerSaboresHeladoDisponibles_().find(function (item) {
    return (
      String(item.id) === id ||
      normalizarTextoChatbot_(item.nombre) ===
        normalizarTextoChatbot_(seleccion)
    );
  });
  if (!sabor) return mostrarSaboresTopping_(telefono, producto, 0);

  const estado = obtenerEstadoToppingsPendientes_(sesion);
  const topping = estado.topping_sabor_pendiente;
  if (!topping) {
    guardarSesion(telefono, { estado: "TOPPING", pagina: 0 });
    return mostrarToppings_(
      telefono,
      producto,
      estado.toppings_actuales.length,
    );
  }
  topping.saborId = String(sabor.id);
  topping.saborNombre = String(sabor.nombre || "Sabor " + sabor.id);
  estado.toppings_actuales.push(topping);
  delete estado.topping_sabor_pendiente;

  const cantidadToppings = obtenerCantidadToppingsProducto_(producto);
  if (estado.toppings_actuales.length < cantidadToppings) {
    guardarSesion(telefono, {
      estado: "TOPPING",
      toppings_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarToppings_(
      telefono,
      producto,
      estado.toppings_actuales.length,
    );
  }
  guardarSesion(telefono, {
    estado: "TOPPING",
    toppings_pendientes_json: JSON.stringify(estado),
  });
  return finalizarToppings_(telefono, producto, estado);
}

function finalizarToppings_(telefono, producto, estado) {
  const sesion = obtenerSesion(telefono) || {};
  estado.combinaciones.push({
    nombres: estado.combinacion_actual.nombres || [],
    ids: estado.combinacion_actual.ids || [],
    toppings: estado.toppings_actuales || [],
  });
  const cantidad = Number(sesion.cantidad_producto_pendiente) || 1;

  if (estado.unidad_actual < cantidad) {
    const siguienteUnidad = estado.unidad_actual + 1;
    if (productoTieneSaboresConfigurados_(producto)) {
      guardarSesion(telefono, {
        estado: "SABOR",
        sabores_pendientes_json: JSON.stringify({
          unidad_actual: siguienteUnidad,
          sabores_actuales: [],
          sabor_ids_actuales: [],
          combinaciones: estado.combinaciones,
        }),
        toppings_pendientes_json: "{}",
        pagina: 0,
      });
      return mostrarSabores_(telefono, producto, 0);
    }
    return iniciarToppings_(
      telefono,
      producto,
      cantidad,
      estado.combinaciones,
      { nombres: [], ids: [] },
    );
  }

  if (productoPermiteAdicionales_(producto)) {
    guardarSesion(telefono, {
      estado: "ADICIONAL",
      adicionales_pendientes_json: JSON.stringify({
        unidad_actual: 1,
        cantidad_unidades: cantidad,
        combinaciones: [],
        combinaciones_base: estado.combinaciones,
        combinacion_actual: estado.combinaciones[0] || { nombres: [], ids: [] },
        adicionales_actuales: [],
      }),
      adicionales_menu_enviado: false,
      pagina: 0,
    });
    return mostrarPreguntaAdicionales_(telefono, producto);
  }
  return guardarCombinacionesProducto_(
    telefono,
    producto,
    estado.combinaciones,
    cantidad,
  );
}

function obtenerEstadoToppingsPendientes_(sesion) {
  try {
    const estado = JSON.parse(
      String((sesion && sesion.toppings_pendientes_json) || "{}"),
    );
    return {
      unidad_actual: Number(estado.unidad_actual) || 1,
      combinaciones: Array.isArray(estado.combinaciones)
        ? estado.combinaciones
        : [],
      combinacion_actual: estado.combinacion_actual || { nombres: [], ids: [] },
      topping_sabor_pendiente: estado.topping_sabor_pendiente || null,
      menu_enviado: estado.menu_enviado === true,
      toppings_actuales: Array.isArray(estado.toppings_actuales)
        ? estado.toppings_actuales
        : [],
    };
  } catch (error) {
    return {
      unidad_actual: 1,
      combinaciones: [],
      combinacion_actual: { nombres: [], ids: [] },
      topping_sabor_pendiente: null,
      menu_enviado: false,
      toppings_actuales: [],
    };
  }
}

function mostrarPreguntaAdicionales_(telefono, producto) {
  const disponibles = obtenerAdicionalesDisponibles_(
    obtenerProductosActivos(),
    producto,
  );
  if (!disponibles.length) {
    return finalizarUnidadAdicionales_(
      telefono,
      producto,
      obtenerEstadoAdicionalesPendientes_(obtenerSesion(telefono)),
    );
  }

  const sesion = obtenerSesion(telefono) || {};
  const estado = obtenerEstadoAdicionalesPendientes_(sesion);
  const menu = {
    header: "Adicionales",
    body:
      "Producto " +
      estado.unidad_actual +
      " de " +
      (Number(sesion.cantidad_producto_pendiente) || 1) +
      "\n¿Deseas agregar adicionales?",
    footer: "Puedes agregar uno o varios.",
    buttons: [
      { id: "agregar_adicional", title: "Agregar adicional" },
      { id: "sin_adicionales", title: "No agregar" },
    ],
  };

  guardarSesion(telefono, { adicionales_menu_enviado: true });
  return respuestaPreguntaAdicionalesCompleta_(disponibles, menu);
}

function mostrarListaAdicionales_(telefono, producto) {
  const sesion = obtenerSesion(telefono) || {};
  const estado = obtenerEstadoAdicionalesPendientes_(sesion);
  const disponibles = obtenerAdicionalesDisponibles_(
    obtenerProductosActivos(),
    producto,
  );
  const pagina = Math.max(0, Number(sesion.pagina) || 0);
  const totalPaginas = Math.max(1, Math.ceil(disponibles.length / 6));
  const inicio = pagina * 6;
  if (inicio >= disponibles.length) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarListaAdicionales_(telefono, producto);
  }

  const filas = disponibles
    .slice(inicio, inicio + 6)
    .map(function (adicional, indice) {
      return {
        id: "adicional_" + String(adicional.id) + "_" + String(inicio + indice),
        title: String(adicional.nombre).substring(0, 24),
        description: formatearPesosCarrito_(
          obtenerPrecioProductoCarrito_(adicional),
        ).substring(0, 72),
      };
    });
  filas.push({
    id: "terminar_adicionales",
    title: "🛑 Terminar adicionales",
    description: "Continuar",
  });
  if (estado.adicionales_actuales.length) {
    filas.push({
      id: "quitar_adicional",
      title: "🗑️ Quitar adicional",
      description: "Retirar uno seleccionado",
    });
  }
  agregarNavegacionLista_(filas, pagina, totalPaginas);

  const menu = {
    header: "Adicionales",
    body:
      "Selecciona adicionales para el producto " +
      estado.unidad_actual +
      ".\n\n" +
      (estado.adicionales_actuales.length
        ? "Seleccionados: " +
          estado.adicionales_actuales
            .map(function (item) {
              return item.nombre;
            })
            .join(", ") +
          "\n\n"
        : "") +
      construirContenidoLista_(filas, pagina, totalPaginas),
    footer: "Selecciona terminar cuando acabes.",
    button: "Ver adicionales",
    sections: [{ title: "Adicionales disponibles", rows: filas }],
  };

  if (sesion.adicionales_menu_enviado === true) {
    return respuestaLista_(menu);
  }

  guardarSesion(telefono, { adicionales_menu_enviado: true });
  return respuestaAdicionalesCompleta_(disponibles, menu);
}

function procesarAdicional_(telefono, mensaje, sesion) {
  const producto = obtenerProductosActivos().find(function (item) {
    return (
      String(obtenerIdProductoCarrito_(item)) ===
      String(sesion.producto_pendiente_id || "")
    );
  });
  if (!producto)
    return mostrarMenuCategorias_(telefono, "No pude recuperar el producto.");

  const comando = normalizarTextoChatbot_(mensaje);
  if (comando === "agregar_adicional" || comando === "agregar")
    return mostrarListaAdicionales_(telefono, producto);
  if (
    comando === "sin_adicionales" ||
    comando === "no" ||
    comando === "ninguno"
  ) {
    return finalizarUnidadAdicionales_(
      telefono,
      producto,
      obtenerEstadoAdicionalesPendientes_(sesion),
    );
  }
  if (comando === "terminar_adicionales" || comando === "terminar")
    return finalizarUnidadAdicionales_(
      telefono,
      producto,
      obtenerEstadoAdicionalesPendientes_(sesion),
    );
  if (comando === "quitar_adicional") {
    return mostrarListaQuitarAdicionales_(telefono, producto);
  }
  if (comando === "volver_adicionales") {
    return mostrarListaAdicionales_(telefono, producto);
  }
  if (comando === "pagina_anterior" || comando === "pagina_siguiente") {
    guardarSesion(telefono, {
      pagina: Math.max(
        0,
        Number(sesion.pagina || 0) + (comando === "pagina_siguiente" ? 1 : -1),
      ),
    });
    return mostrarListaAdicionales_(telefono, producto);
  }

  const indiceQuitar = comando.match(/^quitar_adicional_(\d+)$/);
  if (indiceQuitar) {
    const estado = obtenerEstadoAdicionalesPendientes_(sesion);
    estado.adicionales_actuales.splice(Number(indiceQuitar[1]), 1);
    guardarSesion(telefono, {
      adicionales_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarListaAdicionales_(telefono, producto);
  }

  const id =
    comando.indexOf("adicional_") === 0
      ? comando.substring(10).split("_")[0]
      : "";
  const adicional = obtenerAdicionalesDisponibles_(
    obtenerProductosActivos(),
    producto,
  ).find(function (item) {
    return (
      String(item.id) === id || normalizarTextoChatbot_(item.nombre) === comando
    );
  });
  if (!adicional) return mostrarListaAdicionales_(telefono, producto);

  const estado = obtenerEstadoAdicionalesPendientes_(sesion);
  estado.adicionales_actuales.push({
    id: String(adicional.id),
    nombre: String(adicional.nombre),
    precio: obtenerPrecioProductoCarrito_(adicional),
  });
  guardarSesion(telefono, {
    adicionales_pendientes_json: JSON.stringify(estado),
    pagina: 0,
  });
  return mostrarListaAdicionales_(telefono, producto);
}

function mostrarListaQuitarAdicionales_(telefono, producto) {
  const sesion = obtenerSesion(telefono) || {};
  const estado = obtenerEstadoAdicionalesPendientes_(sesion);
  const filas = estado.adicionales_actuales.map(function (adicional, indice) {
    return {
      id: "quitar_adicional_" + indice,
      title: String(adicional.nombre).substring(0, 24),
      description: "Retirar este adicional",
    };
  });
  filas.push({
    id: "volver_adicionales",
    title: "Volver",
    description: "Conservar adicionales",
  });

  return respuestaLista_({
    header: "Quitar adicional",
    body: "Selecciona el adicional que deseas retirar.",
    footer: "Los demás se conservarán.",
    button: "Quitar adicional",
    sections: [{ title: "Seleccionados", rows: filas }],
  });
}

function finalizarUnidadAdicionales_(telefono, producto, estado) {
  estado.combinaciones.push({
    nombres: estado.combinacion_actual.nombres || [],
    ids: estado.combinacion_actual.ids || [],
    adicionales: estado.adicionales_actuales || [],
    toppings: estado.combinacion_actual.toppings || [],
  });
  const cantidad =
    Number((obtenerSesion(telefono) || {}).cantidad_producto_pendiente) || 1;
  if (estado.unidad_actual < cantidad) {
    estado.unidad_actual += 1;
    estado.combinacion_actual = estado.combinaciones_base.length
      ? estado.combinaciones_base[estado.unidad_actual - 1] || {
          nombres: [],
          ids: [],
        }
      : { nombres: [], ids: [] };
    estado.adicionales_actuales = [];
    guardarSesion(telefono, {
      adicionales_pendientes_json: JSON.stringify(estado),
      pagina: 0,
    });
    return mostrarPreguntaAdicionales_(telefono, producto);
  }
  return guardarCombinacionesProducto_(
    telefono,
    producto,
    estado.combinaciones,
    cantidad,
  );
}

function guardarCombinacionesProducto_(
  telefono,
  producto,
  combinaciones,
  cantidad,
) {
  const carrito = new Carrito(telefono);
  combinaciones.forEach(function (combinacion) {
    carrito.agregarProducto(
      producto,
      1,
      combinacion.nombres,
      combinacion.ids,
      combinacion.adicionales || [],
      combinacion.toppings || [],
    );
  });
  guardarSesion(telefono, {
    estado: "CARRITO",
    producto_pendiente_id: "",
    cantidad_producto_pendiente: 0,
    sabores_pendientes_json: "[]",
    toppings_pendientes_json: "{}",
    adicionales_pendientes_json: "{}",
    categoria_actual_id: "",
    pagina: 0,
  });
  return mostrarCarrito_(
    telefono,
    "✅ Agregué el producto con sus opciones al carrito.",
  );
}

function obtenerEstadoAdicionalesPendientes_(sesion) {
  try {
    const estado = JSON.parse(
      String((sesion && sesion.adicionales_pendientes_json) || "{}"),
    );
    return {
      unidad_actual: Number(estado.unidad_actual) || 1,
      combinaciones: Array.isArray(estado.combinaciones)
        ? estado.combinaciones
        : [],
      combinaciones_base: Array.isArray(estado.combinaciones_base)
        ? estado.combinaciones_base
        : [],
      combinacion_actual: estado.combinacion_actual || { nombres: [], ids: [] },
      adicionales_actuales: Array.isArray(estado.adicionales_actuales)
        ? estado.adicionales_actuales
        : [],
    };
  } catch (error) {
    return {
      unidad_actual: 1,
      combinaciones: [],
      combinaciones_base: [],
      combinacion_actual: { nombres: [], ids: [] },
      adicionales_actuales: [],
    };
  }
}

function obtenerSaboresPendientes_(sesion) {
  return obtenerEstadoSaboresPendientes_(sesion).sabores_actuales;
}

function obtenerEstadoSaboresPendientes_(sesion) {
  try {
    const estado = JSON.parse(String(sesion.sabores_pendientes_json || "{}"));
    if (Array.isArray(estado)) {
      return {
        unidad_actual: 1,
        sabores_actuales: estado,
        sabor_ids_actuales: [],
        combinaciones: [],
      };
    }
    return {
      unidad_actual: Number(estado.unidad_actual) || 1,
      sabores_actuales: Array.isArray(estado.sabores_actuales)
        ? estado.sabores_actuales
        : [],
      sabor_ids_actuales: Array.isArray(estado.sabor_ids_actuales)
        ? estado.sabor_ids_actuales
        : [],
      combinaciones: Array.isArray(estado.combinaciones)
        ? estado.combinaciones
        : [],
    };
  } catch (error) {
    return {
      unidad_actual: 1,
      sabores_actuales: [],
      sabor_ids_actuales: [],
      combinaciones: [],
    };
  }
}

function procesarCarrito(telefono, mensaje, sesion) {
  const comando = normalizarTextoChatbot_(mensaje);
  const carrito = new Carrito(telefono);

  if (carrito.estaVacio()) {
    guardarSesion(telefono, { estado: "CATEGORIA" });
    return mostrarMenuCategorias_(
      telefono,
      "Tu carrito está vacío. Selecciona una categoría para comenzar.",
    );
  }

  if (
    comando === "agregar_producto" ||
    comando === "agregar producto" ||
    comando === "agregar"
  ) {
    guardarSesion(telefono, {
      estado: "CATEGORIA",
      categoria_actual_id: "",
      producto_pendiente_id: "",
      pagina: 0,
    });
    return mostrarMenuCategorias_(
      telefono,
      "¿Qué otro producto deseas agregar?",
    );
  }

  if (
    comando === "quitar_producto" ||
    comando === "quitar producto" ||
    comando === "quitar" ||
    comando === "eliminar"
  ) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarListaEliminarProducto_(telefono);
  }

  if (
    comando === "finalizar_pedido" ||
    comando === "finalizar pedido" ||
    comando === "finalizar" ||
    comando === "continuar"
  ) {
    guardarSesion(telefono, { estado: "DIRECCION" });
    return respuestaTexto_(
      "📍 *Dirección de entrega*\n\nEscribe la dirección completa donde deseas recibir tu pedido.",
    );
  }

  if (comando === "ver carrito" || comando === "carrito") {
    return mostrarCarrito_(
      telefono,
      "Este es el contenido actual de tu carrito.",
    );
  }

  return mostrarCarrito_(
    telefono,
    "Elige si deseas agregar otro producto, quitar un producto o finalizar tu pedido.",
  );
}

function procesarDireccion(telefono, mensaje, sesion) {
  const direccion = String(mensaje || "").trim();
  if (direccion.length < 5 || direccion.indexOf("[") === 0) {
    return respuestaTexto_(
      "Escribe una dirección más completa para la entrega.",
    );
  }

  guardarSesion(telefono, { direccion: direccion, estado: "SECTOR" });
  return respuestaTexto_(
    "Gracias. Ahora escribe tu *sector o barrio* (por ejemplo, Centro, El Morro o Viento Libre).",
  );
}

function procesarSector(telefono, mensaje, sesion) {
  const seleccion = String(mensaje || "").trim();
  const sector = obtenerSectorPorNombre(seleccion);

  if (!sector) {
    return mostrarSectores_(telefono);
  }

  const carrito = new Carrito(telefono);

  if (carrito.estaVacio()) {
    guardarSesion(telefono, { estado: "CATEGORIA" });

    return mostrarMenuCategorias_(
      telefono,
      "Tu carrito está vacío; selecciona productos antes de confirmar.",
    );
  }

  guardarSesion(telefono, {
    sector: String(sector.nombre),
    estado: "METODO_PAGO",
    metodo_pago_id: "",
    comprobante_pago_id: "",
    pagina: 0,
  });

  return mostrarMetodosDePago_(telefono);
}

/**
 * Muestra la lista de métodos de pago registrados.
 */
function mostrarMetodosDePago_(telefono) {
  const metodos = obtenerMetodosDePago();

  if (!metodos || metodos.length === 0) {
    return respuestaTexto_(
      "Por el momento no hay métodos de pago disponibles. " +
        "Por favor, inténtalo más tarde.",
    );
  }

  const pagina = Math.max(
    0,
    Number((obtenerSesion(telefono) || {}).pagina) || 0,
  );
  const totalPaginas = Math.max(1, Math.ceil(metodos.length / 8));
  if (pagina >= totalPaginas) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarMetodosDePago_(telefono);
  }
  const filas = metodos
    .slice(pagina * 8, pagina * 8 + 8)
    .map(function (metodo) {
      return {
        id: "metodo_pago_" + String(metodo.id),
        title: String(metodo.nombre).substring(0, 24),
        description: ("Pagar con " + String(metodo.nombre)).substring(0, 72),
      };
    });

  agregarNavegacionLista_(filas, pagina, totalPaginas);
  guardarSesion(telefono, { estado: "METODO_PAGO" });

  return respuestaLista_({
    header: "Método de pago",
    body:
      "¿Cómo deseas pagar tu pedido?\n\n" +
      construirContenidoLista_(filas, pagina, totalPaginas),
    footer: "Selecciona una opción.",
    button: "Ver métodos",
    sections: [
      {
        title: "Métodos disponibles",
        rows: filas,
      },
    ],
  });
}

/**
 * Procesa el método de pago elegido en la lista.
 */
function procesarMetodoPago_(telefono, mensaje, sesion) {
  const seleccion = String(mensaje || "").trim();

  if (seleccion === "pagina_anterior" || seleccion === "pagina_siguiente") {
    const pagina =
      Math.max(0, Number(sesion.pagina) || 0) +
      (seleccion === "pagina_siguiente" ? 1 : -1);
    guardarSesion(telefono, { pagina: Math.max(0, pagina) });
    return mostrarMetodosDePago_(telefono);
  }

  // La lista devuelve, por ejemplo, metodo_pago_2.
  const coincidencia = seleccion.match(/^metodo_pago_(.+)$/);

  if (!coincidencia) {
    return mostrarMetodosDePago_(telefono);
  }

  const metodo = obtenerMetodoDePagoPorId(coincidencia[1]);

  if (!metodo) {
    return respuestaTexto_(
      "No reconocí ese método de pago. Selecciónalo nuevamente.",
    );
  }

  const nombreMetodo = String(metodo.nombre || "").trim();

  guardarSesion(telefono, {
    metodo_pago_id: String(metodo.id),
  });

  // Efectivo: no necesita comprobante.
  if (normalizarTextoChatbot_(nombreMetodo) === "efectivo") {
    guardarSesion(telefono, { comprobante_pago_id: "" });

    return iniciarPasoCliente_(telefono);
  }

  // Los demás métodos requieren una imagen.
  guardarSesion(telefono, {
    estado: "COMPROBANTE_PAGO",
    comprobante_pago_id: "",
  });

  return respuestaTexto_(
    "💳 *Método de pago: " +
      nombreMetodo +
      "*\n\n" +
      "Para continuar con tu pedido, envíanos una *imagen del comprobante de pago*.\n\n" +
      "Puedes adjuntar la captura de pantalla o la foto del comprobante directamente en este chat." +
      (String(metodo.informacion || "").trim()
        ? "\n\nInformación: \n" + String(metodo.informacion).trim()
        : ""),
  );
}

/**
 * Solo permite continuar si WhatsApp entregó un mensaje de imagen
 * con su identificador multimedia.
 */

function procesarComprobantePago_(telefono, tipoMensaje, mediaId, sesion) {
  if (String(tipoMensaje).toLowerCase() !== "image" || !mediaId) {
    const metodoSesion = obtenerMetodoPagoSesion_(sesion);
    return respuestaTexto_(
      "Para continuar con el método de pago *" +
        (metodoSesion ? metodoSesion.nombre : "") +
        "*, necesito que adjuntes una imagen del comprobante.",
    );
  }

  try {
    // Solo avanzar si el archivo se guardó correctamente.
    const comprobante = guardarComprobanteEnDrive(mediaId, telefono);

    guardarSesion(telefono, {
      comprobante_pago_id: String(mediaId),
      comprobante_pago_file_id: comprobante.fileId,
      comprobante_pago_url: comprobante.url,
    });

    return iniciarPasoCliente_(telefono);
  } catch (error) {
    registrarErrorGeneral(error, "Chatbot", "procesarComprobantePago_()");

    // Mantener el estado para permitir reintentar.
    guardarSesion(telefono, {
      estado: "COMPROBANTE_PAGO",
    });

    return respuestaTexto_(
      "No pude guardar tu comprobante en este momento. " +
        "Por favor, vuelve a enviar la imagen para intentarlo de nuevo.",
    );
  }
}

/**
 * Paso del cliente: si la sesión ya tiene un cliente con nombre, pregunta si el
 * pedido va a su nombre; si no, pide el nombre.
 */
function iniciarPasoCliente_(telefono) {
  const sesion = obtenerSesion(telefono);
  const cliente = obtenerClientePorId(sesion && sesion.id_cliente);
  const nombre = cliente ? String(cliente.nombre || "").trim() : "";

  if (nombre) {
    guardarSesion(telefono, { estado: "CLIENTE_CONFIRMAR" });

    return respuestaBotones_({
      header: "Nombre del pedido",
      body:
        "👋 ¡Qué gusto verte de nuevo!\n\n" +
        "Este número está asociado con *" +
        nombre +
        "*.\n\n" +
        "¿Deseas poner el pedido a este nombre?",
      footer: "Elige una opción.",
      buttons: [
        { id: "cliente_si", title: "Sí, a ese nombre" },
        { id: "cliente_no", title: "Otro nombre" },
      ],
    });
  }

  return pedirNombreCliente_(telefono, false);
}

function pedirNombreCliente_(telefono, esCambio) {
  guardarSesion(telefono, { estado: "CLIENTE_NOMBRE" });

  return respuestaTexto_(
    esCambio
      ? "😊 ¡Claro! ¿A nombre de quién ponemos el pedido?\n\nEscribe el nombre y apellido."
      : "😊 ¡Casi listo! Para dejar tu pedido bien identificado, ¿a nombre de quién lo ponemos?\n\nEscribe tu nombre.",
  );
}

function procesarClienteConfirmar_(telefono, mensaje, sesion) {
  const comando = normalizarTextoChatbot_(mensaje);

  if (["cliente_si", "si", "sii", "claro", "ok"].indexOf(comando) >= 0) {
    return mostrarConfirmacionPedido_(telefono);
  }

  if (["cliente_no", "no", "otro", "otro nombre"].indexOf(comando) >= 0) {
    return pedirNombreCliente_(telefono, true);
  }

  // Respuesta no reconocida: volver a mostrar los botones.
  return iniciarPasoCliente_(telefono);
}

function procesarClienteNombre_(telefono, mensaje, sesion) {
  const nombre = limpiarNombreCliente_(mensaje);

  if (!nombre) {
    return respuestaTexto_(
      "No logré entender el nombre 🙈\nEscríbelo usando letras, por ejemplo: *María Pérez*.",
    );
  }

  const sesionActual = obtenerSesion(telefono) || sesion;
  const clienteActual = obtenerClientePorId(
    sesionActual && sesionActual.id_cliente,
  );

  if (clienteActual) {
    // El número ya tiene cliente: se actualiza su nombre.
    actualizarNombreCliente(clienteActual.id, nombre);
  } else {
    // El número no tiene cliente: se crea y se asocia a la sesión.
    const cliente = crearCliente({ nombre: nombre, activo: true });
    guardarSesion(telefono, { id_cliente: String(cliente.id) });
  }

  return mostrarConfirmacionPedido_(telefono);
}

/** Valida el nombre y lo deja con formato "Nombre Apellido". Devuelve '' si no es válido. */
function limpiarNombreCliente_(texto) {
  const nombre = String(texto || "")
    .replace(/\s+/g, " ")
    .trim();

  if (nombre.length < 2 || nombre.length > 60) return "";
  if (nombre.indexOf("[") === 0) return "";
  if (!/[a-záéíóúüñ]/i.test(nombre)) return "";

  return nombre
    .toLowerCase()
    .split(" ")
    .map(function (palabra) {
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    })
    .join(" ");
}

/**
 * Construye el resumen y presenta los botones de confirmación.
 */
function mostrarConfirmacionPedido_(telefono) {
  const sesion = obtenerSesion(telefono);
  const carrito = new Carrito(telefono);

  if (!sesion || carrito.estaVacio()) {
    return respuestaTexto_(
      "No pude recuperar tu pedido. Escribe *menú* para retomarlo.",
    );
  }

  const textoResumen = construirResumenConfirmacion_(carrito, sesion);
  const metodoSesion = obtenerMetodoPagoSesion_(sesion);

  const resumenConPago =
    textoResumen +
    "\n\n💳 *Método de pago:* " +
    (metodoSesion ? metodoSesion.nombre : "Sin seleccionar") +
    (esMetodoEfectivo_(metodoSesion)
      ? "\nPago en efectivo al recibir el pedido."
      : "\n✅ Comprobante recibido.");

  guardarSesion(telefono, { estado: "CONFIRMACION" });

  return respuestaBotones_({
    header: "Confirma tu pedido",
    body:
      resumenConPago.length > 1000
        ? resumenConPago.substring(0, 990) + "…"
        : resumenConPago,
    footer: "El pedido se guardará solo si lo confirmas.",
    buttons: [
      { id: "confirmar_pedido", title: "Confirmar pedido" },
      { id: "cancelar_pedido", title: "Cancelar" },
    ],
  });
}

/**
 * Calcula los importes del pedido.
 *
 * subtotalProductos: suma del precio del producto y sus adicionales por cantidad.
 * costoEnvio: tarifa del sector seleccionado.
 * total: subtotal de productos + costo de envío.
 */
function calcularTotalesPedido_(carrito, sector) {
  const idSector = obtenerSectorPorNombre(sector).id;
  const items = carrito.obtenerItems();
  const productos = obtenerProductosActivos();

  let subtotalProductos = 0;

  items.forEach(function (item) {
    const producto = productos.find(function (p) {
      return String(obtenerIdProductoCarrito_(p)) === String(item.idProducto);
    });

    if (!producto) {
      throw new Error("No se encontró el producto " + item.idProducto);
    }

    const precioBase = Number(obtenerPrecioProductoCarrito_(producto));
    const precioUnitario = Number(obtenerPrecioUnitarioCarrito_(item));
    const cantidad = Number(item.cantidad);

    if (
      !Number.isFinite(precioBase) ||
      precioBase < 0 ||
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0 ||
      !Number.isInteger(cantidad) ||
      cantidad < 1
    ) {
      throw new Error("El precio o la cantidad de un producto no son válidos.");
    }

    subtotalProductos += precioUnitario * cantidad;
  });

  const costoEnvio = obtenerCostoEnvioSector(idSector);

  return {
    subtotalProductos: subtotalProductos,
    costoEnvio: costoEnvio,
    total: subtotalProductos + costoEnvio,
  };
}

function procesarConfirmacion(telefono, mensaje, sesion) {
  const comando = normalizarTextoChatbot_(mensaje);
  const confirma =
    [
      "confirmar_pedido",
      "confirmar pedido",
      "confirmar",
      "si",
      "sí",
      "acepto",
      "de acuerdo",
    ].indexOf(comando) >= 0;
  const cancela =
    ["cancelar_pedido", "cancelar pedido", "cancelar", "no", "volver"].indexOf(
      comando,
    ) >= 0;

  if (
    confirma &&
    !esMetodoEfectivo_(obtenerMetodoPagoSesion_(sesion)) &&
    !sesion.comprobante_pago_id
  ) {
    guardarSesion(telefono, { estado: "COMPROBANTE_PAGO" });

    return respuestaTexto_(
      "Antes de confirmar tu pedido, debes enviarnos la imagen del comprobante de pago.",
    );
  }

  if (confirma) {
    const resultado = registrarPedidoConfirmado_(telefono, sesion);
    return respuestaTexto_(
      "🎉 ¡Gracias por comprar en Avasabores!\n\n" +
        "Tu pedido con ID *" +
        resultado.idPedido +
        "* quedó registrado.\n" +
        "Dirección: " +
        (sesion.direccion || "") +
        "\n" +
        "Sector: " +
        (sesion.sector || "") +
        "\n\n" +
        "Para iniciar otra compra, escribe *nuevo pedido*.",
    );
  }

  if (cancela) {
    guardarSesion(telefono, {
      estado: "CARRITO",
      direccion: "",
      sector: "",
    });
    return mostrarCarrito_(
      telefono,
      "No registré ningún pedido. Tu carrito se conserva para que puedas continuar después.",
    );
  }

  return respuestaBotones_({
    header: "Confirmación pendiente",
    body: construirResumenConfirmacion_(
      new Carrito(telefono),
      obtenerSesion(telefono) || sesion,
    ),
    footer: "Una vez confirmado, tu pedido será procesado.",
    buttons: [
      { id: "confirmar_pedido", title: "Confirmar pedido" },
      { id: "cancelar_pedido", title: "Cancelar" },
    ],
  });
}

/** Crea Pedidos y ProductoXPedido solamente después de la confirmación explícita. */
function registrarPedidoConfirmado_(telefono, sesion) {
  // La sesión se consulta antes de crear las filas para no repetir un pedido
  // que ya quedó finalizado en una ejecución anterior.
  const sesionActual = obtenerSesion(telefono) || sesion;
  if (
    String(sesionActual.estado).toUpperCase() === "FINALIZADO" &&
    sesionActual.ultimo_pedido
  ) {
    return { idPedido: String(sesionActual.ultimo_pedido), repetido: true };
  }

  const carrito = new Carrito(telefono);
  if (carrito.estaVacio())
    throw new Error("No se puede confirmar un carrito vacío.");

  // Resolver el ID del método de pago a partir del nombre guardado en la sesión.
  const metodoPago = obtenerMetodoPagoSesion_(sesionActual);
  if (!metodoPago) {
    throw new Error(
      "No se encontró el método de pago con ID: " + sesionActual.metodo_pago_id,
    );
  }

  // Resolver el costo de envío del sector, igual que en el resumen del pedido.
  const sector = obtenerSectorPorNombre(sesionActual.sector);
  if (!sector) {
    throw new Error("No se encontró el sector: " + sesionActual.sector);
  }
  const costoEnvio = Number(obtenerCostoEnvioSector(sector.id)) || 0;

  const idPedido = crearPedido({
    idCliente: sesionActual.id_cliente || "",
    destino: sesionActual.direccion || "",
    sector: sesionActual.sector || "",
    envio: costoEnvio,
    metodoPago: metodoPago.id,
    comprobantePagoId: sesionActual.comprobante_pago_file_id || "",
    comprobantePagoUrl: sesionActual.comprobante_pago_url || "",
  });

  const itemsPedido = [];
  carrito.obtenerItems().forEach(function (item) {
    const cantidad = Number(item.cantidad);
    const precioProducto = Number(item.precio);

    itemsPedido.push({
      idProducto: item.idProducto,
      cantidad: cantidad,
      subtotal: precioProducto * cantidad,
      saborIds: Array.isArray(item.saborIds) ? item.saborIds : [],
      toppings: Array.isArray(item.toppings) ? item.toppings : [],
    });

    (Array.isArray(item.adicionales) ? item.adicionales : []).forEach(
      function (adicional) {
        const productoAdicional = obtenerProductoAdicionalPorCodigo_(
          adicional.id,
        );
        if (!productoAdicional) {
          throw new Error(
            "No se encontró el producto para el adicional " + adicional.id,
          );
        }

        const idProductoAdicional = obtenerIdProductoCarrito_(
          productoAdicional,
        );
        const precioAdicional = Number(
          obtenerPrecioProductoCarrito_(productoAdicional),
        );

        itemsPedido.push({
          idProducto: idProductoAdicional,
          cantidad: cantidad,
          subtotal: precioAdicional * cantidad,
          saborIds: [],
          toppings: [],
        });
      },
    );
  });
  agregarProductoXPedido(idPedido, itemsPedido);

  // Vaciar el carrito y marcar la sesión como finalizada solo después de guardar los detalles.
  guardarSesion(telefono, {
    estado: "FINALIZADO",
    ultimo_pedido: String(idPedido),
    carrito_json: "[]",
    categoria_actual_id: "",
    producto_pendiente_id: "",
    pagina: 0,
  });

  // Avisar a los números de la hoja Reenvio (no interrumpe si falla).
  notificarPedidoReenvios_(carrito, sesionActual, metodoPago, telefono);

  return { idPedido: String(idPedido), repetido: false };
}

function iniciarNuevoPedido_(telefono) {
  guardarSesion(telefono, {
    estado: "PRODUCTO",
    carrito_json: "[]",
    pagina: 0,
    menu_enviado: false,
    comprobante_pago_id: "",
    comprobante_pago_file_id: "",
    comprobante_pago_url: "",
  });
  return mostrarMenuCategorias_(
    telefono,
    "¡Bienvenido de vuelta! 😁 Bienvenido a Avasabores 🍦\n\n¿Qué tipo de producto deseas?",
  );
}

function mostrarMenuCategorias_(telefono, textoIntroductorio) {
  const sesion = obtenerSesion(telefono) || {};
  if (sesion.menu_enviado === true) {
    return mostrarProductosCategoria_(
      telefono,
      sesion,
      textoIntroductorio || "Selecciona un producto de la página actual.",
    );
  }

  guardarSesion(telefono, {
    estado: "PRODUCTO",
    categoria_actual_id: "",
    producto_pendiente_id: "",
    pagina: 0,
  });

  return mostrarProductosCategoria_(
    telefono,
    obtenerSesion(telefono),
    textoIntroductorio,
  );
}

function mostrarProductosCategoria_(telefono, sesion, textoIntroductorio) {
  const productos = obtenerProductosActivos();

  if (!productos.length) {
    guardarSesion(telefono, { estado: "PRODUCTO", pagina: 0 });
    return respuestaTexto_("Por ahora no hay productos activos disponibles.");
  }

  const pagina = Math.max(0, Number(sesion.pagina) || 0);
  const inicio = pagina * 8;
  if (inicio >= productos.length) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarProductosCategoria_(telefono, obtenerSesion(telefono));
  }

  const quedan = productos.length - inicio;
  const totalPaginas = Math.max(1, Math.ceil(productos.length / 8));
  const productosPagina = productos.slice(inicio, inicio + 8);

  const rows = productosPagina.map(function (producto) {
    const id = obtenerIdProductoCarrito_(producto);
    const nombre = obtenerNombreProductoCarrito_(producto);
    const nombreEnLista =
      producto.nombre_en_lista !== undefined &&
      producto.nombre_en_lista !== null &&
      String(producto.nombre_en_lista).trim() !== ""
        ? String(producto.nombre_en_lista).trim()
        : nombre;
    const precio = obtenerPrecioProductoCarrito_(producto);
    const descripcion =
      nombre + (precio !== null ? " · " + formatearPesosCarrito_(precio) : "");
    return {
      id: "producto_" + String(id),
      title: nombreEnLista.substring(0, 24),
      description: descripcion.substring(0, 72),
    };
  });

  agregarNavegacionLista_(rows, pagina, totalPaginas);

  const menu = {
    header: "Avasabores",
    body:
      String(textoIntroductorio || "Selecciona el producto que deseas.") +
      "\n\n" +
      construirContenidoProductos_(productosPagina, pagina, totalPaginas),
    button: "👇ESCOGER PRODUCTO👇",
    footer: "Elige una opción de la lista.",
    sections: [{ title: "Productos disponibles", rows: rows }],
  };

  if (sesion.menu_enviado === true) {
    return respuestaLista_(menu);
  }

  guardarSesion(telefono, { menu_enviado: true });
  return respuestaProductosCompleta_(productos, menu);
}

function mostrarCarrito_(telefono, mensajeExtra) {
  const carrito = new Carrito(telefono);
  if (carrito.estaVacio()) {
    return mostrarMenuCategorias_(
      telefono,
      "Tu carrito está vacío. Selecciona una categoría para agregar productos.",
    );
  }

  let body =
    (mensajeExtra ? mensajeExtra + "\n\n" : "") +
    "🛒 *Tu carrito*\n\n" +
    carrito.construirResumen() +
    "\n\n¿Qué deseas hacer?";
  if (body.length > 1000) body = body.substring(0, 990) + "…";

  return respuestaBotones_({
    header: "Carrito de compras",
    body: body,
    footer: "Aún no se ha creado el pedido.",
    buttons: [
      { id: "agregar_producto", title: "Agregar producto" },
      { id: "quitar_producto", title: "Quitar producto" },
      { id: "finalizar_pedido", title: "Finalizar" },
    ],
  });
}

/** Muestra la lista de productos del carrito para elegir cuál quitar. */
function mostrarListaEliminarProducto_(telefono, mensajeExtra) {
  const carrito = new Carrito(telefono);

  if (carrito.estaVacio()) {
    guardarSesion(telefono, { estado: "CATEGORIA" });
    return mostrarMenuCategorias_(
      telefono,
      "Tu carrito está vacío. Selecciona una categoría para comenzar.",
    );
  }

  const pagina = Math.max(
    0,
    Number((obtenerSesion(telefono) || {}).pagina) || 0,
  );
  const totalPaginas = Math.max(
    1,
    Math.ceil(carrito.obtenerItems().length / 7),
  );
  if (pagina >= totalPaginas) {
    guardarSesion(telefono, { pagina: 0 });
    return mostrarListaEliminarProducto_(telefono, mensajeExtra);
  }
  guardarSesion(telefono, { estado: "ELIMINAR_PRODUCTO", pagina: pagina });

  // WhatsApp admite máximo 10 filas: 9 productos + "Volver al carrito".
  const filas = carrito
    .obtenerItems()
    .slice(pagina * 7, pagina * 7 + 7)
    .map(function (item, indicePagina) {
      const indice = pagina * 7 + indicePagina;
      const nombre = item.nombreProducto || "Producto " + item.idProducto;
      const producto = obtenerProductoPorId(item.idProducto) || {};
      const nombreEnLista = String(
        producto.nombre_en_lista || item.nombreEnLista || nombre,
      ).trim();
      const sabores =
        Array.isArray(item.sabores) && item.sabores.length
          ? " · (" + item.sabores.join(", ") + ")"
          : "";
      const adicionales =
        Array.isArray(item.adicionales) && item.adicionales.length
          ? " · +" +
            item.adicionales
              .map(function (adicional) {
                return adicional.nombre;
              })
              .join(", ")
          : "";
      const toppings =
        Array.isArray(item.toppings) && item.toppings.length
          ? " · ^" +
            item.toppings
              .map(function (topping) {
                return (
                  topping.nombre +
                  (topping.saborNombre ? " (" + topping.saborNombre + ")" : "")
                );
              })
              .join(", ")
          : "";
      const subtotal =
        item.precio !== null && item.precio !== undefined && item.precio !== ""
          ? " · " +
            formatearPesosCarrito_(
              obtenerPrecioUnitarioCarrito_(item) * Number(item.cantidad || 0),
            )
          : "";
      return {
        id: "eliminar_item_" + String(indice),
        title: nombreEnLista.substring(0, 24),
        description: (
          "x" +
          item.cantidad +
          sabores +
          adicionales +
          toppings +
          subtotal
        ).substring(0, 72),
      };
    });

  filas.push({
    id: "volver_carrito",
    title: "↩️ Volver al carrito",
    description: "No quitar nada",
  });
  agregarNavegacionLista_(filas, pagina, totalPaginas);

  const itemsPagina = carrito.obtenerItems().slice(pagina * 7, pagina * 7 + 7);

  return respuestaLista_({
    header: "Quitar producto",
    body:
      (mensajeExtra ? mensajeExtra + "\n\n" : "") +
      "¿Cuál producto deseas quitar de tu carrito?\n\n" +
      construirContenidoCarritoEliminar_(itemsPagina, pagina, totalPaginas),
    footer: "Se quitará completo del carrito.",
    button: "🗑️QUITAR PRODUCTO",
    sections: [{ title: "Tu carrito", rows: filas }],
  });
}

function construirContenidoCarritoEliminar_(items, pagina, totalPaginas) {
  const contenido = items
    .map(function (item) {
      const nombre = item.nombreProducto || "Producto " + item.idProducto;
      const producto = obtenerProductoPorId(item.idProducto) || {};
      const emoticon = String(item.emoticon || producto.emoticon || "").trim();
      const sabores =
        Array.isArray(item.sabores) && item.sabores.length
          ? " · (" + item.sabores.join(", ") + ")"
          : "";
      const adicionales =
        Array.isArray(item.adicionales) && item.adicionales.length
          ? " · +" +
            item.adicionales
              .map(function (adicional) {
                return adicional.nombre;
              })
              .join(", ")
          : "";
      const toppings =
        Array.isArray(item.toppings) && item.toppings.length
          ? " · ^" +
            item.toppings
              .map(function (topping) {
                return (
                  topping.nombre +
                  (topping.saborNombre ? " (" + topping.saborNombre + ")" : "")
                );
              })
              .join(", ")
          : "";
      const subtotal =
        item.precio !== null && item.precio !== undefined && item.precio !== ""
          ? " · " +
            formatearPesosCarrito_(
              obtenerPrecioUnitarioCarrito_(item) * Number(item.cantidad || 0),
            )
          : "";
      return (
        "• " +
        (emoticon ? emoticon + " " : "") +
        nombre +
        " · x" +
        Number(item.cantidad || 0) +
        sabores +
        adicionales +
        toppings +
        subtotal
      );
    })
    .join("\n\n");

  return (
    contenido +
    "\n\n(Página " +
    (pagina + 1) +
    "/" +
    totalPaginas +
    ")\n\n" +
    "↩️ Para volver al carrito, selecciona: *Volver al carrito*"
  );
}

/** Procesa el producto elegido para eliminar del carrito. */
function procesarEliminarProducto_(telefono, mensaje, sesion) {
  const seleccion = String(mensaje || "").trim();
  const comando = normalizarTextoChatbot_(seleccion);

  if (comando === "pagina_anterior" || comando === "pagina_siguiente") {
    const pagina =
      Math.max(0, Number(sesion.pagina) || 0) +
      (comando === "pagina_siguiente" ? 1 : -1);
    guardarSesion(telefono, { pagina: Math.max(0, pagina) });
    return mostrarListaEliminarProducto_(telefono);
  }

  // Volver sin quitar nada.
  if (
    ["volver_carrito", "volver", "cancelar", "volver al carrito"].indexOf(
      comando,
    ) >= 0
  ) {
    guardarSesion(telefono, { estado: "CARRITO" });
    return mostrarCarrito_(telefono, "Listo, no quité ningún producto.");
  }

  const coincidencia = seleccion.match(/^eliminar_item_(\d+)$/);
  if (!coincidencia) {
    return mostrarListaEliminarProducto_(telefono);
  }

  const indiceItem = Number(coincidencia[1]);
  const carrito = new Carrito(telefono);
  const item = carrito.obtenerItems()[indiceItem];

  if (!item) {
    return mostrarListaEliminarProducto_(
      telefono,
      "No encontré ese producto en tu carrito.",
    );
  }

  carrito.eliminarItem(indiceItem);

  const nombre = item.nombreProducto || "Producto " + item.idProducto;

  if (carrito.estaVacio()) {
    guardarSesion(telefono, { estado: "CATEGORIA" });
    return mostrarMenuCategorias_(
      telefono,
      "🗑️ Quité *" +
        nombre +
        "* y tu carrito quedó vacío.\n\n¿Qué producto deseas agregar?",
    );
  }

  guardarSesion(telefono, { estado: "CARRITO" });
  return mostrarCarrito_(telefono, "🗑️ Quité *" + nombre + "* de tu carrito.");
}

function construirResumenConfirmacion_(carrito, sesion) {
  const sector = sesion.sector;
  const sectorId = obtenerSectorPorNombre(sector);
  const cliente = obtenerClientePorId(sesion.id_cliente);
  const nombreCliente = cliente ? String(cliente.nombre || "").trim() : "";

  let texto = "🧾 *Resumen de tu pedido*\n\n";

  if (nombreCliente) {
    texto += "👤 *Cliente:* " + nombreCliente + "\n\n";
  }

  texto += carrito.construirResumen();

  texto += "\n\n📍 *Dirección:* " + (sesion.direccion || "Sin indicar");

  texto += "\n*Sector:* " + (sesion.sector || "Sin indicar");

  // Calcular los importes cuando ya se haya seleccionado el sector.
  if (sectorId) {
    const totales = calcularTotalesPedido_(carrito, sector);

    texto += "\n\n--------------------";
    texto +=
      "\n*Subtotal productos:* " +
      formatearPesosCarrito_(totales.subtotalProductos);

    texto +=
      "\n*Costo de envío:* " + formatearPesosCarrito_(totales.costoEnvio);

    texto += "\n*TOTAL A PAGAR:* " + formatearPesosCarrito_(totales.total);
  }

  texto += "\n\n¿Confirmas que los datos son correctos?";

  if (texto.length > 1000) {
    texto = texto.substring(0, 990) + "…";
  }

  return texto;
}

function obtenerCategoriaDesdeTexto_(texto) {
  const valor = normalizarTextoChatbot_(texto);
  const categorias = obtenerCategoriasActivas();

  // Buscar por ID de respuesta de WhatsApp: cat_3
  const coincidenciaId = categorias.find(
    (categoria) => "cat_" + String(categoria.id) === valor,
  );

  if (coincidenciaId) {
    return String(coincidenciaId.id);
  }

  const coincidenciaNombre = categorias.find(
    (categoria) => normalizarTextoChatbot_(categoria.nombre) === valor,
  );

  return coincidenciaNombre ? String(coincidenciaNombre.id) : null;
}

function normalizarTextoChatbot_(texto) {
  return String(texto === undefined || texto === null ? "" : texto)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function agregarNavegacionLista_(filas, pagina, totalPaginas) {
  if (pagina > 0) {
    filas.push({
      id: "pagina_anterior",
      title: "Página anterior ◀️",
      description: "Volver a la página " + pagina,
    });
  }
  if (pagina < totalPaginas - 1) {
    filas.push({
      id: "pagina_siguiente",
      title: "Página siguiente ▶️",
      description: "Ir a la página " + (pagina + 2),
    });
  }
}

function construirContenidoLista_(filas, pagina, totalPaginas) {
  const contenido = filas
    .filter(function (fila) {
      return fila.id !== "pagina_anterior" && fila.id !== "pagina_siguiente";
    })
    .map(function (fila) {
      return (
        "• " +
        String(fila.title || "") +
        (fila.description ? " — " + String(fila.description) : "") +
        "\n"
      );
    })
    .join("\n");

  return (
    contenido.substring(0, 850) +
    "\n\n(Página " +
    (pagina + 1) +
    "/" +
    totalPaginas +
    ")"
  );
}

function construirContenidoProductos_(productos, pagina, totalPaginas) {
  const contenido = productos
    .map(function (producto) {
      const emoticon = String(producto.emoticon || "").trim();
      const nombre = obtenerNombreProductoCarrito_(producto);
      const precio = obtenerPrecioProductoCarrito_(producto);
      return (
        "• " +
        (emoticon ? emoticon + " " : "") +
        nombre +
        (precio !== null ? " — " + formatearPesosCarrito_(precio) : "") +
        ""
      );
    })
    .join("\n\n");

  return (
    contenido.substring(0, 850) +
    "\n\n(Página " +
    (pagina + 1) +
    "/" +
    totalPaginas +
    ")"
  );
}

function respuestaProductosCompleta_(productos, menu) {
  const paginas = construirPaginasProductos_(productos);
  const mensajes = [];
  const paginasPorMensaje = 3;
  const maximoBody = 1024;
  const encabezadoMenu =
    "📋 *MENÚ DE PRODUCTOS*\nNavega por las páginas para seleccionar productos.\n\n";
  let bloque = [];
  let longitudBloque = 0;

  paginas.forEach(function (pagina) {
    const separador = bloque.length ? "\n\n" : "";
    const longitudCandidata = longitudBloque + separador.length + pagina.length;

    const limiteBloque =
      mensajes.length === 0 ? maximoBody - encabezadoMenu.length : maximoBody;

    if (
      bloque.length >= paginasPorMensaje ||
      (bloque.length && longitudCandidata > limiteBloque)
    ) {
      mensajes.push(respuestaTexto_(bloque.join("\n\n")));
      bloque = [];
      longitudBloque = 0;
    }

    bloque.push(pagina);
    longitudBloque += (bloque.length > 1 ? 2 : 0) + pagina.length;
  });

  if (bloque.length) {
    mensajes.push(respuestaTexto_(bloque.join("\n\n")));
  }

  if (mensajes.length) {
    mensajes[0].texto = encabezadoMenu + mensajes[0].texto;

    const separadorNavegacion =
      "\n\n==========\nNavegación de productos:\nNavega por las páginas para seleccionar productos.";
    const ultimo = mensajes[mensajes.length - 1];
    ultimo.texto =
      ultimo.texto.substring(0, maximoBody - separadorNavegacion.length) +
      separadorNavegacion;
  }

  mensajes.push(respuestaLista_(menu));
  return { tipo: "secuencia", mensajes: mensajes };
}

function construirPaginasProductos_(productos) {
  const tamanoPagina = 8;
  const totalPaginas = Math.max(1, Math.ceil(productos.length / tamanoPagina));
  const paginas = [];

  for (let pagina = 0; pagina < totalPaginas; pagina++) {
    const productosPagina = productos.slice(
      pagina * tamanoPagina,
      pagina * tamanoPagina + tamanoPagina,
    );
    const contenido = productosPagina
      .map(function (producto) {
        const emoticon = String(producto.emoticon || "").trim();
        const nombre = obtenerNombreProductoCarrito_(producto);
        const precio = obtenerPrecioProductoCarrito_(producto);
        const linea =
          "• " +
          (emoticon ? emoticon + " " : "") +
          nombre +
          (precio !== null ? " ⋅ " + formatearPesosCarrito_(precio) : "");
        return linea.substring(0, 110);
      })
      .join("\n\n");

    paginas.push(
      "........ Página " +
        (pagina + 1) +
        "/" +
        totalPaginas +
        " ........\n" +
        contenido,
    );
  }

  return paginas;
}

function respuestaSaboresCompleta_(sabores, menu, cantidadSabores) {
  const paginas = construirPaginasSabores_(sabores);
  const mensajes = [];
  const paginasPorMensaje = 3;
  const maximoBody = 1024;
  const encabezadoMenu =
    "🍨 *MENÚ DE SABORES*\nEscoge el sabor que quieras entre nuestros sabores disponibles:\n\n";
  let bloque = [];
  let longitudBloque = 0;

  paginas.forEach(function (pagina) {
    const separador = bloque.length ? "\n\n" : "";
    const longitudCandidata = longitudBloque + separador.length + pagina.length;
    const limiteBloque =
      mensajes.length === 0 ? maximoBody - encabezadoMenu.length : maximoBody;

    if (
      bloque.length >= paginasPorMensaje ||
      (bloque.length && longitudCandidata > limiteBloque)
    ) {
      mensajes.push(respuestaTexto_(bloque.join("\n\n")));
      bloque = [];
      longitudBloque = 0;
    }

    bloque.push(pagina);
    longitudBloque += (bloque.length > 1 ? 2 : 0) + pagina.length;
  });

  if (bloque.length) {
    mensajes.push(respuestaTexto_(bloque.join("\n\n")));
  }

  if (mensajes.length) {
    mensajes[0].texto = encabezadoMenu + mensajes[0].texto;
    const separadorNavegacion = "\n\n==========\nNavegación de sabores:";
    const ultimo = mensajes[mensajes.length - 1];
    ultimo.texto =
      ultimo.texto.substring(0, maximoBody - separadorNavegacion.length) +
      separadorNavegacion;
  }

  mensajes.push(respuestaLista_(menu));
  return { tipo: "secuencia", mensajes: mensajes };
}

function construirPaginasSabores_(sabores) {
  const tamanoPagina = 8;
  const totalPaginas = Math.max(1, Math.ceil(sabores.length / tamanoPagina));
  const paginas = [];

  for (let pagina = 0; pagina < totalPaginas; pagina++) {
    const saboresPagina = sabores.slice(
      pagina * tamanoPagina,
      pagina * tamanoPagina + tamanoPagina,
    );
    const contenido = saboresPagina
      .map(function (sabor) {
        const nombre = String(
          sabor.nombre_en_lista || "Sabor " + sabor.id,
        ).trim();
        const descripcion = String(
          sabor["descripción_en_lista"] || sabor.descripcion_en_lista || "",
        ).trim();
        const linea = "• " + nombre + (descripcion ? " — " + descripcion : "");
        return linea.substring(0, 110);
      })
      .join("\n\n");

    paginas.push(
      "........ Página " +
        (pagina + 1) +
        "/" +
        totalPaginas +
        " ........\n" +
        contenido,
    );
  }

  return paginas;
}

function respuestaToppingsCompleta_(toppings, menu) {
  const paginas = construirPaginasToppings_(toppings);
  const mensajes = [];
  const maximoBody = 1024;
  const encabezadoMenu =
    "*MENU DE TOPPINGS*\nEstos son los toppings disponibles:\n\n";
  let bloque = [];
  let longitudBloque = 0;

  paginas.forEach(function (pagina) {
    const separador = bloque.length ? "\n\n" : "";
    const longitudCandidata = longitudBloque + separador.length + pagina.length;
    const limiteBloque =
      mensajes.length === 0 ? maximoBody - encabezadoMenu.length : maximoBody;

    if (bloque.length && longitudCandidata > limiteBloque) {
      mensajes.push(respuestaTexto_(bloque.join("\n\n")));
      bloque = [];
      longitudBloque = 0;
    }

    bloque.push(pagina);
    longitudBloque += (bloque.length > 1 ? 2 : 0) + pagina.length;
  });

  if (bloque.length) {
    mensajes.push(respuestaTexto_(bloque.join("\n\n")));
  }

  if (mensajes.length) {
    mensajes[0].texto = encabezadoMenu + mensajes[0].texto;
    const separadorNavegacion = "\n\n==========\nAhora escoge el topping:";
    const ultimo = mensajes[mensajes.length - 1];
    ultimo.texto =
      ultimo.texto.substring(0, maximoBody - separadorNavegacion.length) +
      separadorNavegacion;
  }

  mensajes.push(respuestaLista_(menu));
  return respuestaSecuencia_(mensajes);
}

function construirPaginasToppings_(toppings) {
  const tamanoPagina = 7;
  const totalPaginas = Math.max(1, Math.ceil(toppings.length / tamanoPagina));
  const paginas = [];

  for (let pagina = 0; pagina < totalPaginas; pagina++) {
    const toppingsPagina = toppings.slice(
      pagina * tamanoPagina,
      pagina * tamanoPagina + tamanoPagina,
    );
    const contenido = toppingsPagina
      .map(function (topping) {
        return (
          "- " + String(topping.detalle || "Topping " + topping.id).trim()
        ).substring(0, 110);
      })
      .join("\n\n");

    paginas.push(
      "........ Pagina " +
        (pagina + 1) +
        "/" +
        totalPaginas +
        " ........\n" +
        contenido,
    );
  }

  if (paginas.length) {
    paginas[paginas.length - 1] += "\n\n- Sin Topping";
  }
  return paginas;
}

function respuestaPreguntaAdicionalesCompleta_(adicionales, menu) {
  const paginas = construirPaginasAdicionales_(adicionales);
  const mensajes = [];
  const paginasPorMensaje = 3;
  const maximoBody = 1024;
  const encabezadoMenu = "*MENU COMPLETO DE ADICIONALES*\n\n";
  let bloque = [];
  let longitudBloque = 0;

  paginas.forEach(function (pagina) {
    const separador = bloque.length ? "\n\n" : "";
    const longitudCandidata = longitudBloque + separador.length + pagina.length;
    const limiteBloque =
      mensajes.length === 0 ? maximoBody - encabezadoMenu.length : maximoBody;

    if (
      bloque.length >= paginasPorMensaje ||
      (bloque.length && longitudCandidata > limiteBloque)
    ) {
      mensajes.push(respuestaTexto_(bloque.join("\n\n")));
      bloque = [];
      longitudBloque = 0;
    }

    bloque.push(pagina);
    longitudBloque += (bloque.length > 1 ? 2 : 0) + pagina.length;
  });

  if (bloque.length) {
    mensajes.push(respuestaTexto_(bloque.join("\n\n")));
  }

  if (mensajes.length) {
    mensajes[0].texto = encabezadoMenu + mensajes[0].texto;
  }

  mensajes.push(respuestaBotones_(menu));
  return respuestaSecuencia_(mensajes);
}

function respuestaAdicionalesCompleta_(adicionales, menu) {
  const paginas = construirPaginasAdicionales_(adicionales);
  const mensajes = [];
  const paginasPorMensaje = 3;
  const maximoBody = 1024;
  const encabezadoMenu = "➕ *MENÚ DE ADICIONALES*\n\n";
  let bloque = [];
  let longitudBloque = 0;

  paginas.forEach(function (pagina) {
    const separador = bloque.length ? "\n\n" : "";
    const longitudCandidata = longitudBloque + separador.length + pagina.length;
    const limiteBloque =
      mensajes.length === 0 ? maximoBody - encabezadoMenu.length : maximoBody;

    if (
      bloque.length >= paginasPorMensaje ||
      (bloque.length && longitudCandidata > limiteBloque)
    ) {
      mensajes.push(respuestaTexto_(bloque.join("\n\n")));
      bloque = [];
      longitudBloque = 0;
    }

    bloque.push(pagina);
    longitudBloque += (bloque.length > 1 ? 2 : 0) + pagina.length;
  });

  if (bloque.length) {
    mensajes.push(respuestaTexto_(bloque.join("\n\n")));
  }

  if (mensajes.length) {
    mensajes[0].texto = encabezadoMenu + mensajes[0].texto;
    const separadorNavegacion = "\n\n==========\nNavegación de adicionales:";
    const ultimo = mensajes[mensajes.length - 1];
    ultimo.texto =
      ultimo.texto.substring(0, maximoBody - separadorNavegacion.length) +
      separadorNavegacion;
  }

  mensajes.push(respuestaLista_(menu));
  return respuestaSecuencia_(mensajes);
}

function construirPaginasAdicionales_(adicionales) {
  const tamanoPagina = 6;
  const totalPaginas = Math.max(
    1,
    Math.ceil(adicionales.length / tamanoPagina),
  );
  const paginas = [];

  for (let pagina = 0; pagina < totalPaginas; pagina++) {
    const adicionalesPagina = adicionales.slice(
      pagina * tamanoPagina,
      pagina * tamanoPagina + tamanoPagina,
    );
    const contenido = adicionalesPagina
      .map(function (adicional) {
        const nombre = String(adicional.nombre || "").trim();
        const precio = obtenerPrecioProductoCarrito_(adicional);
        return (
          "• " +
          nombre +
          " — " +
          formatearPesosCarrito_(precio)
        ).substring(0, 110);
      })
      .join("\n\n");

    paginas.push(
      "........ Página " +
        (pagina + 1) +
        "/" +
        totalPaginas +
        " ........\n" +
        contenido,
    );
  }

  return paginas;
}

function obtenerMetodoPagoSesion_(sesion) {
  if (!sesion || !sesion.metodo_pago_id) return null;
  return obtenerMetodoDePagoPorId(sesion.metodo_pago_id);
}

function esMetodoEfectivo_(metodo) {
  return !!metodo && normalizarTextoChatbot_(metodo.nombre) === "efectivo";
}

function respuestaTexto_(texto) {
  return { tipo: "texto", texto: String(texto || "") };
}

function respuestaBotones_(menu) {
  return { tipo: "botones", menu: menu };
}

function respuestaLista_(menu) {
  return { tipo: "lista", menu: menu };
}

function respuestaSecuencia_(mensajes) {
  return { tipo: "secuencia", mensajes: mensajes };
}

/** Envía por WhatsApp la respuesta estructurada que devuelve el árbol de estados. */
function enviarRespuestaChatbot(telefono, respuesta) {
  if (!respuesta) return null;

  switch (respuesta.tipo) {
    case "texto":
      return sendText(telefono, respuesta.texto);
    case "botones":
      return sendButtonMenu(telefono, respuesta.menu);
    case "lista":
      return sendListMenu(telefono, respuesta.menu);
    case "secuencia":
      return respuesta.mensajes.map(function (mensaje) {
        return enviarRespuestaChatbot(telefono, mensaje);
      });
    default:
      throw new Error(
        "Tipo de respuesta del chatbot no reconocido: " + respuesta.tipo,
      );
  }
}

/** ==========================================================================================================================
 *                                                      PRUEBAS
 * ===========================================================================================================================
 *  */

/** Simulación local: no envía mensajes de WhatsApp. */
function simularMensaje() {
  const telefono = "573196587242";
  const respuesta = procesarMensaje(telefono, "Hola");
  Logger.log(JSON.stringify(respuesta, null, 2));
}
