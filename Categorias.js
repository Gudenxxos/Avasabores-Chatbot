// ==========================================
// CATEGORIAS
// ==========================================

function obtenerCategorias() {
  const productos = getDatosHoja('Categoria');
  return productos;
}

function obtenerCategoriasActivas() {
  const categorias = getDatosHoja('Categoria');

  return categorias.filter(categoria =>
    categoria.activo === true ||
    String(categoria.activo).toUpperCase() === 'TRUE' ||
    categoria.estado === 'Activo'
  );
}
function obtenerCategoriaPorId(idCategoria) {
  const productos = getDatosHoja('Categoria');
  return productos.find(p => String(p.id) === String(idCategoria)) || null;
}

