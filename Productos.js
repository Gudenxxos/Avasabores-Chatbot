// ==========================================
// 1. PRODUCTOS
// ==========================================

function obtenerProductos() {
  const productos = getDatosHoja("Producto");
  return productos;
}

function obtenerProductosActivos() {
  const productos = getDatosHoja("Producto");
  return productos.filter(
    (p) =>
      (p.activo === true || String(p.activo).toUpperCase() === "TRUE") &&
      !esProductoAdicional_(p),
  );
}

function esProductoAdicional_(producto) {
  return /^adicional\s+\d+$/i.test(
    String((producto && producto.nombre) || "").trim(),
  );
}

function obtenerProductosPorCategoria(categoria) {
  const productos = getDatosHoja("Producto");
  return productos.filter(
    (p) =>
      (p.activo === true || String(p.activo).toUpperCase() === "TRUE") &&
      !esProductoAdicional_(p),
  );
}

function obtenerProductoPorId(idProducto) {
  const productos = getDatosHoja("Producto");
  return productos.find((p) => String(p.id) === String(idProducto)) || null;
}

function productoTieneSaboresHelado_(producto) {
  const valor = producto && producto.con_sabor_de_helado;
  if (
    valor === true ||
    ["si", "true", "yes"].indexOf(normalizarTextoChatbot_(valor)) >= 0
  ) {
    return true;
  }
  return (
    valor === true ||
    ["si", "sí", "true", "yes"].indexOf(String(valor).trim().toLowerCase()) >= 0
  );
}

function productoTieneSaboresJugo_(producto) {
  return (
    productoTieneFlagSabor_(producto, "con_sabor_jugo") ||
    productoTieneFlagSabor_(producto, "Con_sabor_jugo")
  );
}

function productoTieneSaboresHeladoSinAzucar_(producto) {
  return productoTieneFlagSabor_(producto, "con_sabor_helado_sin_azucar");
}

function productoTieneSaboresConfigurados_(producto) {
  return (
    productoTieneSaboresHelado_(producto) ||
    productoTieneSaboresJugo_(producto) ||
    productoTieneSaboresHeladoSinAzucar_(producto)
  );
}

function productoEsHelado_(producto) {
  return (
    productoTieneSaboresHelado_(producto) ||
    productoTieneSaboresHeladoSinAzucar_(producto)
  );
}

function productoTieneFlagSabor_(producto, encabezado) {
  const valor = producto && producto[encabezado];
  return (
    valor === true ||
    ["si", "true", "yes", "1"].indexOf(normalizarTextoChatbot_(valor)) >= 0
  );
}

function obtenerCantidadSaboresProducto_(producto) {
  const cantidad = Number(producto && producto.cuantos_sabores_de_helado);
  if (Number.isInteger(cantidad) && cantidad > 0) return cantidad;

  // Los tipos nuevos de sabor implican al menos una elección, incluso si la
  // hoja no especifica cuantos_sabores_de_helado.
  return productoTieneSaboresJugo_(producto) ||
    productoTieneSaboresHeladoSinAzucar_(producto)
    ? 1
    : 0;
}

function productoTieneToppings_(producto) {
  const valor = producto && producto.con_topping;
  if (
    valor === true ||
    ["si", "true", "yes"].indexOf(normalizarTextoChatbot_(valor)) >= 0
  ) {
    return true;
  }
  return (
    valor === true ||
    ["si", "sí", "true", "yes"].indexOf(String(valor).trim().toLowerCase()) >= 0
  );
}

function obtenerCantidadToppingsProducto_(producto) {
  const cantidad = Number(producto && producto.cuantos_toppings);
  return Number.isInteger(cantidad) && cantidad > 0 ? cantidad : 0;
}

function obtenerToppingsActivos_() {
  return getDatosHoja("Topping").filter(function (topping) {
    return (
      topping.activo === true || String(topping.activo).toUpperCase() === "TRUE"
    );
  });
}

function obtenerToppingsDisponiblesProducto_(producto) {
  const toppings = obtenerToppingsActivos_();
  if (!productoEsHelado_(producto)) return toppings;

  return toppings.filter(function (topping) {
    return !toppingEsSaborHelado_(topping);
  });
}

function toppingEsSaborHelado_(topping) {
  return (
    normalizarTextoChatbot_(
      (topping && (topping.detalle || topping.nombre)) || "",
    ) === "sabor de helado"
  );
}

function obtenerNumeroListaAdicionales_(producto) {
  const nombre = String((producto && producto.nombre) || "").trim();
  const coincidencia = nombre.match(/^adicional\s+(\d+)$/i);
  return coincidencia ? coincidencia[1] : "";
}

function productoPermiteAdicionales_(producto) {
  return true;
}

function obtenerAdicionalesDisponibles_(productos, productoBase) {
  const numeroLista = obtenerNumeroListaAdicionales_(productoBase);

  return getDatosHoja("Adicional")
    .filter(function (adicional) {
      const activo =
        adicional.activo === true ||
        String(adicional.activo).toUpperCase() === "TRUE";
      const codigo = String(adicional.codigo).trim();
      return activo && (!numeroLista || codigo === numeroLista);
    })
    .map(function (adicional) {
      return {
        id: String(adicional.codigo).trim(),
        nombre: String(adicional.detalle || "").trim(),
        precio: adicional.precio,
        precio_de_venta: adicional.precio,
      };
    })
    .filter(function (adicional) {
      return adicional.nombre !== "";
    });
}

function obtenerProductoAdicionalPorCodigo_(codigoAdicional) {
  const codigo = Number(String(codigoAdicional || "").trim());
  if (!Number.isInteger(codigo) || codigo <= 0) return null;

  return (
    obtenerProductos().find(function (producto) {
      const coincidencia = String(producto.nombre || "")
        .trim()
        .match(/^adicional\s+(\d+)$/i);
      return coincidencia && Number(coincidencia[1]) === codigo;
    }) || null
  );
}
