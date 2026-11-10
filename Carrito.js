/**
 * Carrito.gs
 *
 * Carrito temporal por teléfono. El carrito se persiste como JSON en la
 * columna carrito_json de la hoja Sesiones. NO crea pedidos ni detalles.
 * Las tablas Pedidos y ProductoXPedido solo se modifican al confirmar.
 */
class Carrito {
  constructor(telefono) {
    if (!telefono)
      throw new Error("El teléfono es obligatorio para el carrito.");

    this.telefono = String(telefono);
    const sesion = obtenerSesion(this.telefono) || {};
    this.items = this._agruparItems(this._leerItems(sesion.carrito_json));
  }

  _leerItems(carritoJson) {
    if (!carritoJson) return [];
    try {
      const items = JSON.parse(String(carritoJson));
      return Array.isArray(items) ? items : [];
    } catch (error) {
      console.warn("El carrito guardado no es JSON válido. Se iniciará vacío.");
      return [];
    }
  }

  _agruparItems(items) {
    const agrupados = [];
    items.forEach(function (item) {
      const clave =
        String(item.idProducto) +
        "|" +
        construirClaveSaboresCarrito_(item.sabores, item.saborIds) +
        "|" +
        construirClaveAdicionalesCarrito_(item.adicionalIds) +
        "|" +
        construirClaveAdicionalesCarrito_(item.toppingIds);
      const existente = agrupados.find(function (itemAgrupado) {
        return itemAgrupado._claveAgrupacion === clave;
      });

      if (existente) {
        existente.cantidad =
          Number(existente.cantidad || 0) + Number(item.cantidad || 0);
      } else {
        const copia = Object.assign({}, item);
        copia._claveAgrupacion = clave;
        agrupados.push(copia);
      }
    });

    return agrupados.map(function (item) {
      delete item._claveAgrupacion;
      return item;
    });
  }

  obtenerItems() {
    // Devuelve una copia para evitar que otros módulos alteren el estado interno.
    return this.items.map(function (item) {
      return Object.assign({}, item);
    });
  }

  estaVacio() {
    return this.items.length === 0;
  }

  agregarProducto(
    producto,
    cantidad,
    sabores,
    saborIds,
    adicionales,
    toppings,
  ) {
    if (!producto) throw new Error("El producto no existe.");

    const idProducto = obtenerIdProductoCarrito_(producto);
    const cantidadNumerica = Number(cantidad);

    if (idProducto === "" || idProducto === null || idProducto === undefined) {
      throw new Error("El producto no tiene un ID válido.");
    }
    if (!Number.isInteger(cantidadNumerica) || cantidadNumerica <= 0) {
      throw new Error("La cantidad debe ser un entero mayor que cero.");
    }

    const precio = obtenerPrecioProductoCarrito_(producto);
    const nombre = obtenerNombreProductoCarrito_(producto);
    const emoticon = String(producto.emoticon || "").trim();
    const nombreEnLista = String(producto.nombre_en_lista || nombre).trim();
    const saboresSeleccionados = Array.isArray(sabores)
      ? sabores
          .map(function (sabor) {
            return String(sabor).trim();
          })
          .filter(Boolean)
      : [];
    const idsSaboresSeleccionados = Array.isArray(saborIds)
      ? saborIds
          .map(function (saborId) {
            return String(saborId).trim();
          })
          .filter(Boolean)
      : [];
    const adicionalesSeleccionados = Array.isArray(adicionales)
      ? adicionales
          .map(function (adicional) {
            return {
              id: String(adicional.id || "").trim(),
              nombre: String(adicional.nombre || "").trim(),
              precio: Number(adicional.precio) || 0,
            };
          })
          .filter(function (adicional) {
            return adicional.id && adicional.nombre;
          })
      : [];
    const idsAdicionales = adicionalesSeleccionados.map(function (adicional) {
      return adicional.id;
    });
    const toppingsSeleccionados = Array.isArray(toppings)
      ? toppings
          .map(function (topping) {
            return {
              id: String(topping.id || "").trim(),
              nombre: String(topping.nombre || "").trim(),
              saborId: String(topping.saborId || "").trim(),
              saborNombre: String(topping.saborNombre || "").trim(),
            };
          })
          .filter(function (topping) {
            return topping.id && topping.nombre;
          })
      : [];
    const idsToppings = toppingsSeleccionados.map(function (topping) {
      return topping.id + (topping.saborId ? ":" + topping.saborId : "");
    });
    const claveSaboresSeleccionados = construirClaveSaboresCarrito_(
      saboresSeleccionados,
      idsSaboresSeleccionados,
    );
    const existente = this.items.find(function (item) {
      return (
        String(item.idProducto) === String(idProducto) &&
        construirClaveSaboresCarrito_(item.sabores, item.saborIds) ===
          claveSaboresSeleccionados &&
        construirClaveAdicionalesCarrito_(item.adicionalIds) ===
          construirClaveAdicionalesCarrito_(idsAdicionales) &&
        construirClaveAdicionalesCarrito_(item.toppingIds) ===
          construirClaveAdicionalesCarrito_(idsToppings)
      );
    });

    if (existente) {
      existente.cantidad = Number(existente.cantidad || 0) + cantidadNumerica;
    } else {
      this.items.push({
        idProducto: String(idProducto),
        nombreProducto: nombre,
        nombreEnLista: nombreEnLista,
        emoticon: emoticon,
        cantidad: cantidadNumerica,
        precio: precio,
        sabores: saboresSeleccionados,
        saborIds: idsSaboresSeleccionados,
        adicionales: adicionalesSeleccionados,
        adicionalIds: idsAdicionales,
        toppings: toppingsSeleccionados,
        toppingIds: idsToppings,
      });
    }

    this.guardar();
    return this.obtenerItems();
  }

  eliminarProducto(idProducto) {
    this.items = this.items.filter(function (item) {
      return String(item.idProducto) !== String(idProducto);
    });
    this.guardar();
    return this.obtenerItems();
  }

  eliminarItem(indice) {
    const indiceNumerico = Number(indice);
    if (!Number.isInteger(indiceNumerico) || indiceNumerico < 0) {
      return this.obtenerItems();
    }

    this.items.splice(indiceNumerico, 1);
    this.guardar();
    return this.obtenerItems();
  }

  vaciar() {
    this.items = [];
    this.guardar();
  }

  guardar() {
    guardarSesion(this.telefono, {
      carrito_json: JSON.stringify(this.items),
    });
  }

  tienePrecios() {
    return (
      this.items.length > 0 &&
      this.items.every(function (item) {
        return (
          item.precio !== null &&
          item.precio !== undefined &&
          item.precio !== "" &&
          Number.isFinite(Number(item.precio))
        );
      })
    );
  }

  calcularSubtotal() {
    if (!this.tienePrecios()) return null;
    return this.items.reduce(function (total, item) {
      return (
        total + obtenerPrecioUnitarioCarrito_(item) * Number(item.cantidad)
      );
    }, 0);
  }

  construirResumen() {
    if (this.estaVacio()) return "Tu carrito está vacío.";

    const lineas = this.items.map(function (item) {
      const cantidad = Number(item.cantidad) || 0;
      const nombre = item.nombreProducto || "Producto " + item.idProducto;
      const producto = item.emoticon
        ? null
        : obtenerProductoPorId(item.idProducto);
      const emoticon = item.emoticon || (producto && producto.emoticon) || "";
      const encabezado = (emoticon ? emoticon + " " : "") + nombre;
      let linea =
        "• " +
        encabezado +
        "\nCantidad: " +
        cantidad +
        " (" +
        formatearPesosCarrito_(Number(item.precio) * cantidad) +
        ")";

      if (Array.isArray(item.sabores) && item.sabores.length) {
        linea += "\nSabores: " + item.sabores.join(", ");
      }

      if (Array.isArray(item.adicionales) && item.adicionales.length) {
        linea +=
          "\nAdicionales: " +
          item.adicionales
            .map(function (adicional) {
              return (
                adicional.nombre +
                " (" +
                formatearPesosCarrito_(adicional.precio) +
                ")"
              );
            })
            .join(", ");
      }

      if (Array.isArray(item.toppings) && item.toppings.length) {
        linea +=
          "\nToppings: " +
          item.toppings
            .map(function (topping) {
              return (
                topping.nombre +
                (topping.saborNombre ? " (" + topping.saborNombre + ")" : "")
              );
            })
            .join(", ");
      }

      if (
        item.precio !== null &&
        item.precio !== undefined &&
        item.precio !== ""
      ) {
        linea +=
          "\nSubtotal: " +
          formatearPesosCarrito_(
            obtenerPrecioUnitarioCarrito_(item) * cantidad,
          );
      }
      return linea;
    });

    let resumen = lineas.join("\n\n");
    const subtotal = this.calcularSubtotal();
    if (subtotal !== null)
      resumen += "\n\nSubtotal: " + formatearPesosCarrito_(subtotal);
    return resumen;
  }
}

/** Obtiene IDs de producto compatibles con los nombres de columna comunes. */
function obtenerIdProductoCarrito_(producto) {
  const posibles = ["id", "id_producto", "idProducto", "ID"];
  for (let i = 0; i < posibles.length; i++) {
    const valor = producto[posibles[i]];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return valor;
    }
  }
  return "";
}

/** Obtiene el nombre visible del producto. */
function obtenerNombreProductoCarrito_(producto) {
  const valor = producto.nombre;
  if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
    return String(valor).trim();
  }
  return "Producto " + obtenerIdProductoCarrito_(producto);
}

/** Lee el precio cuando está disponible; retorna null si no puede interpretarlo. */
function obtenerPrecioProductoCarrito_(producto) {
  const valor = producto.precio_de_venta;
  if (valor === undefined || valor === null || String(valor).trim() === "")
    return null;

  if (typeof valor === "number" && Number.isFinite(valor)) return valor;

  // Admite, por ejemplo, "$ 15.000" o "15000,50".
  let limpio = String(valor).replace(/[^0-9,.-]/g, "");
  if (limpio.indexOf(",") >= 0 && limpio.indexOf(".") >= 0) {
    limpio = limpio.replace(/\./g, "").replace(",", ".");
  } else if (limpio.indexOf(",") >= 0) {
    limpio = limpio.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    limpio = limpio.replace(/\./g, "");
  }

  const numero = Number(limpio);
  if (Number.isFinite(numero)) return numero;
}

function obtenerDescripcionProductoCarrito_(producto) {
  const valor = producto.unidad;
  if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
    return String(valor).trim();
  }
  return "";
}

function construirClaveSaboresCarrito_(sabores, saborIds) {
  const nombres = Array.isArray(sabores)
    ? sabores
        .map(function (sabor) {
          return String(sabor).trim().toLowerCase();
        })
        .filter(Boolean)
    : [];

  if (nombres.length) {
    return "nombres:" + nombres.sort().join(",");
  }

  const ids = Array.isArray(saborIds)
    ? saborIds
        .map(function (saborId) {
          return String(saborId).trim();
        })
        .filter(Boolean)
    : [];

  return "ids:" + ids.sort().join(",");
}

function construirClaveAdicionalesCarrito_(adicionalIds) {
  return (Array.isArray(adicionalIds) ? adicionalIds : [])
    .map(function (id) {
      return String(id).trim();
    })
    .filter(Boolean)
    .sort()
    .join(",");
}

function obtenerPrecioUnitarioCarrito_(item) {
  const adicionales = Array.isArray(item.adicionales) ? item.adicionales : [];
  const precioAdicionales = adicionales.reduce(function (total, adicional) {
    return total + (Number(adicional.precio) || 0);
  }, 0);
  return (Number(item.precio) || 0) + precioAdicionales;
}

function formatearPesosCarrito_(valor) {
  return "$" + Math.round(Number(valor) || 0).toLocaleString("es-CO") + " COP";
}
