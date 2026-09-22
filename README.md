# RutaDomicilios 🚴

Aplicación web **mobile-first** para organizar y optimizar domicilios.

Pega los enlaces de ubicación que te envían los clientes por WhatsApp, asigna tus pedidos sobre un mapa y obtén una ruta eficiente para visitarlos todos, con Navegación integrada con Google Maps.

Todo se ejecuta en el navegador: **sin backend, sin cuentas, sin subir datos a ningún servidor**. Los pedidos se guardan localmente en `localStorage`.

## Tecnologías

- HTML5, CSS3 y JavaScript moderno (módulos ES)
- [Leaflet](https://leafletjs.com/) (cargado localmente en `lib/`)
- OpenStreetMap (tiles gratuitos)
- [OSRM](https://project-osrm.org/) para el cálculo de rutas, distancias y tiempos
- Geolocation API para tu ubicación
- URL de Google Maps para la navegación

## Cómo ejecutar localmente

Los módulos ES requieren servirse por HTTP (no funcionan abriendo `index.html` con `file://`).

```bash
python3 -m http.server 8080
# o
npx serve
```

Abre `http://localhost:8080` en el navegador.

> Nota: la Geolocation API solo funciona en contextos seguros (HTTPS). GitHub Pages lo proporciona automáticamente. Localmente puedes servir con HTTPS o usar actualizaciones en un despliegue.

## Estructura

```
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js          # Controlador principal y navegación
│   ├── gps.js          # Geolocation API
│   ├── pedidos.js      # Administración de pedidos
│   ├── ubicaciones.js  # Parser de ubicaciones pegadas
│   ├── router.js       # Comunicación con OSRM (Tabla y Ruta)
│   ├── optimizer.js    # Cálculo del orden de visita
│   ├── map.js          # Mapa Leaflet (marcadores, popups y ruta)
│   ├── historial.js    # Historial de entregas
│   └── storage.js      # localStorage
├── lib/leaflet/        # Leaflet vendorizado localmente
└── README.md
```

## Estado del proyecto

- **Fase 1 — Estructura e interfaz** ✅ lista
- **Fase 2 — CRUD de pedidos + persistencia** ✅ lista
- **Fase 3 — GPS (Geolocation API)** ✅ lista
- **Fase 4 — Parser de ubicaciones** ✅ lista
- **Fase 5 — Mapa (Leaflet): marcadores numerados y popups** ✅ lista
- **Fase 6 — Matriz de tiempos/distancias (OSRM Table + fallback)** ✅ lista
- **Fase 6b — Optimizador del orden de visita (vecino más cercano)** ✅ lista
- **Fase 7 — Ruta optimizada en el mapa (OSRM Route + fallback) y flujo de entregas con historial** ✅ lista: dibuja la polilínea de la ruta sobre el mapa (con el origen en tu GPS), muestra distancia/tiempo/pedidos, recalcula solo, habilita **Navegación con Google Maps**, permite marcar pedidos como entregados, devolverlos a pendientes o enviarlos al historial (con borrado individual y limpieza total).
- **Fases 8-11** (pendientes): cambios de estado adicionales, exportación, sonidos o notificaciones y pulido final.

## Despliegue en GitHub Pages

Sitio 100% estático con rutas relativas. Basta con publicar el repositorio en GitHub Pages apuntando a la rama principal o a la carpeta raíz.

## Privacidad

- Sin cuentas ni usuarios.
- Los pedidos permanecen solo en tu navegador.
- No se envían datos a ningún servidor propio.