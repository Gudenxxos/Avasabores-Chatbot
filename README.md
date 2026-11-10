# Avasabores Chatbot

Chatbot de WhatsApp para Avasabores. Automatiza la navegación del menú, la
personalización de productos, la creación de pedidos y el registro de clientes
usando **WhatsApp Cloud API**, **Google Apps Script**, **Google Sheets** y
**Google Drive**.

## Características

- Recibe y valida eventos mediante un webhook de WhatsApp.
- Responde con mensajes de texto, botones, listas interactivas e imágenes.
- Permite seleccionar categorías, productos, cantidades, sabores, toppings y
  adicionales.
- Mantiene un carrito y el estado de cada conversación por número de teléfono.
- Solicita dirección, sector, costo de envío y método de pago.
- Recibe comprobantes en formato JPEG o PNG y los guarda en una carpeta privada
  de Google Drive.
- Registra clientes, pedidos, detalles, sabores, toppings y eventos en Google
  Sheets.
- Deduplica mensajes reenviados por Meta y evita procesar simultáneamente
  mensajes del mismo teléfono.
- Envía avisos y recordatorios a los destinatarios configurados en la hoja
  `Reenvio`.

## Arquitectura

El proyecto no utiliza Node.js ni un servidor tradicional: todos los archivos
`.js` se ejecutan dentro del runtime V8 de Google Apps Script.

```text
WhatsApp Cloud API
        │
        ▼
Webhook.js (doGet / doPost)
        │
        ▼
Cola.js ──► Chatbot.js ──► WhatsApp.js
        │          │
        │          ├── Sesiones.js / Carrito.js
        │          ├── Productos.js / Categorias.js / Sabores.js
        │          └── Clientes.js / Pedidos.js
        │
        ├── Sheets.js ──► Google Sheets
        ├── Comprobantes.js ──► Google Drive
        └── Logs.js / Reenvio.js
```

### Módulos principales

| Archivo | Responsabilidad |
| --- | --- |
| `Webhook.js` | Verificación del webhook, recepción y normalización de mensajes. |
| `Chatbot.js` | Flujo conversacional y máquina de estados del pedido. |
| `WhatsApp.js` | Comunicación con WhatsApp Cloud API. |
| `Cola.js` | Deduplicación y bloqueo por teléfono. |
| `Sesiones.js` | Persistencia de estado y carrito temporal. |
| `Carrito.js` | Agrupación, modificación y cálculo del carrito. |
| `Pedidos.js` | Creación del pedido y sus relaciones con productos, sabores y toppings. |
| `Productos.js`, `Categorias.js`, `Sabores.js` | Consulta del catálogo en Sheets. |
| `Clientes.js` | Alta, consulta y actualización de clientes. |
| `Comprobantes.js` | Descarga y almacenamiento seguro de comprobantes en Drive. |
| `Logs.js` | Registro de eventos y errores. |
| `Reenvio.js` | Reenvío de pedidos y recordatorios internos. |

## Requisitos

- Una cuenta de Google con acceso a Google Apps Script, Google Sheets y Google
  Drive.
- Una aplicación de Meta con un producto **WhatsApp** configurado.
- Un número de teléfono de WhatsApp Business y su `PHONE_NUMBER_ID`.
- Un token de acceso de Meta con permisos para enviar mensajes y consultar
  archivos multimedia.
- Una hoja de cálculo con las pestañas descritas en la siguiente sección.
- Opcionalmente, [Google clasp](https://github.com/google/clasp) para trabajar
  desde el repositorio local.

## Configuración de Google Sheets

El valor `SPREADSHEET_ID` debe apuntar a una hoja de cálculo accesible por el
usuario que despliega el script. La primera fila de cada pestaña debe contener
los nombres de las columnas usados por el código.

Pestañas requeridas:

- `Clientes`: `id`, `nombre`, `fecha_registro`, `activo`.
- `Pedidos`: identificador, fecha/hora, cliente, destino, sector, envío, método
  de pago y datos del comprobante.
- `ProductoXPedido`: detalle de productos del pedido.
- `ProductoXPedidoXSabor`: sabores elegidos por detalle.
- `ProductoXPedidoXTopping`: toppings elegidos por detalle.
- `Sesiones`: se inicializa o corrige automáticamente con los encabezados
  definidos en `Sesiones.js`.
- `Logs`: `Fecha`, `Evento`, `Detalle`.
- `Categoria`: categorías y su estado de activación.
- `Producto`: catálogo, precio, disponibilidad y configuración de sabores y
  toppings.
- `Sabor`: sabores, disponibilidad y tipos de producto compatibles.
- `Topping`: toppings activos.
- `Adicional`: adicionales, código, detalle, precio y disponibilidad.
- `Sector`: sectores y `costo_envio`.
- `Metodo_de_Pago`: métodos de pago.
- `Reenvio`: destinatarios internos con `id`, `teléfono`/`telefono` y `nombre`.

Los nombres deben coincidir exactamente, incluyendo mayúsculas, guiones bajos y
acentos cuando correspondan.

## Variables de configuración

No se deben guardar tokens ni identificadores en el código fuente. Configura
estas propiedades en **Apps Script → Configuración del proyecto → Propiedades
del script**:

| Propiedad | Descripción |
| --- | --- |
| `WHATSAPP_TOKEN` | Token de acceso de WhatsApp Cloud API. |
| `PHONE_NUMBER_ID` | ID del número de teléfono de WhatsApp Business. |
| `VERIFY_TOKEN` | Token secreto usado por Meta para verificar el webhook. |
| `SPREADSHEET_ID` | ID de la hoja de cálculo operativa. |
| `GRAPH_API_VERSION` | Versión de Graph API usada por Meta, por ejemplo `vXX.X`. |
| `DRIVE_FOLDER_COMPROBANTES_ID` | ID de la carpeta privada donde se guardan comprobantes. |

## Instalación y despliegue

### Opción A: editor de Apps Script

1. Crea un proyecto de Google Apps Script vinculado a la hoja de cálculo o
   independiente.
2. Copia los archivos `.js` del repositorio al proyecto.
3. Configura las propiedades del script indicadas arriba.
4. Verifica que el proyecto use el runtime **V8** y la zona horaria
   `America/Bogota`.
5. Ejecuta una función de prueba desde Apps Script y concede los permisos
   solicitados para Sheets, Drive y solicitudes externas.
6. Despliega el proyecto como **Aplicación web**:
   - Ejecutar como: **usuario que implementa la aplicación**.
   - Quién tiene acceso: **cualquiera, incluso anónimo**.
7. Copia la URL del despliegue y configúrala como **Callback URL** en la
   configuración del webhook de WhatsApp.
8. Usa el mismo valor de `VERIFY_TOKEN` en Meta y en las propiedades del script.
9. Suscribe el webhook al campo `messages`.

### Opción B: clasp

El repositorio incluye `.clasp.json` con el `scriptId` del proyecto. Con
`clasp` autenticado:

```bash
npm install -g @google/clasp
clasp login
clasp push
clasp deploy
```

Después de publicar una nueva versión, actualiza el despliegue web que esté
registrado en Meta. El archivo `.clasp.json` no contiene los secretos del
proyecto; las propiedades deben configurarse directamente en Apps Script.

## Flujo de compra

1. El cliente envía un mensaje a WhatsApp.
2. `Webhook.js` valida el evento y normaliza texto, botones, listas e imágenes.
3. `Cola.js` descarta duplicados y serializa el procesamiento por teléfono.
4. `Chatbot.js` crea o recupera la sesión y avanza por estados:
   `INICIO`, `CATEGORIA`, `PRODUCTO`, `CANTIDAD`, `SABOR`, `TOPPING`,
   `TOPPING_SABOR`, `ADICIONAL`, `CARRITO`, `DIRECCION`, `SECTOR`,
   `METODO_PAGO`, `CLIENTE_CONFIRMAR`, `CLIENTE_NOMBRE`, `CONFIRMACION` y
   `FINALIZADO`.
5. El carrito se guarda como JSON en `Sesiones` hasta confirmar el pedido.
6. Al confirmar, se crean el cliente, el pedido y sus detalles en Sheets.
7. Si se requiere comprobante, solo se aceptan imágenes JPEG o PNG de hasta
   5 MB; el archivo se guarda en la carpeta privada de Drive.
8. `WhatsApp.js` envía la respuesta al cliente y `Logs.js` registra la
   interacción.

El cliente puede escribir `menú` para volver a las categorías o `nuevo pedido`
para iniciar una compra nueva. El carrito actual se conserva al volver al menú.

## Recordatorios de reenvío

La función `instalarTriggerRecordatoriosReenvio` debe ejecutarse manualmente una
vez desde Apps Script para autorizar y crear el disparador temporal. El
disparador revisa cada minuto los recordatorios pendientes y los envía cuando
corresponde.

## Pruebas y diagnóstico

El código incluye funciones manuales con prefijo `probar`, entre ellas:

- `probarExtraccionMensaje`
- `probarCrearSesion` y `probarObtenerSesion`
- `probarCrearCliente`
- `probarCrearPedido`
- `probarAgregarProductoXPedido`
- `probarEnvioWhatsApp`

Ejecuta primero las pruebas que no envían mensajes reales. Las funciones de
envío y creación de datos deben ejecutarse únicamente con números, hojas y
carpetas de prueba.

Los eventos se registran en la pestaña `Logs`. Los errores de ejecución y de
comunicación con Meta también aparecen en los registros de ejecución de Apps
Script.

## Seguridad

- Mantén los tokens y los IDs en las propiedades del script, nunca en Git.
- No hagas pública la carpeta de comprobantes de Drive.
- Usa un `VERIFY_TOKEN` suficientemente aleatorio.
- Revisa los permisos concedidos al proyecto y al usuario que realiza el
  despliegue.
- No incluyas comprobantes, datos de clientes ni hojas de producción en el
  repositorio.

## Estructura del repositorio

```text
.
├── .clasp.json
├── appsscript.json
├── README.md
├── Webhook.js
├── Chatbot.js
├── WhatsApp.js
├── Cola.js
├── Sesiones.js
├── Carrito.js
├── Pedidos.js
├── Clientes.js
├── Productos.js
├── Categorias.js
├── Sabores.js
├── Sectores.js
├── MetodosPago.js
├── Comprobantes.js
├── Reenvio.js
├── Logs.js
├── Sheets.js
└── Utils.js
```

## Licencia

Este repositorio pertenece al proyecto Avasabores. No se ha definido una
licencia de distribución pública en el repositorio.
