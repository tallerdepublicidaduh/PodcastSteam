## PodcastSteam 0.2.0 · Tu biblioteca, lista para jugar

Nueva interfaz inspirada en Steam: tonos azul oscuro, acentos cian y controles más visibles.

- Biblioteca con tarjetas de podcasts, portadas y número de episodios.
- Reproductor fijo con botones más grandes y estado de reproducción visible.
- Foco de alto contraste y navegación con cruceta según la posición de los controles.
- Ajustes de volumen, posición y velocidad con izquierda/derecha del mando; A selecciona, B vuelve, X reproduce/pausa y LB/RB saltan.
- Barra inferior con las acciones de mando e indicador de conexión. El mando se atiende solo cuando la app tiene el foco.
- Biblioteca, favoritos y puntos de escucha de la versión anterior conservan el mismo formato de guardado.

![Vista de ejemplo de PodcastSteam](https://raw.githubusercontent.com/tallerdepublicidaduh/PodcastSteam/v0.2.0/docs/interface.png)

La captura muestra contenido de ejemplo; la biblioteca de la aplicación se llena con tus propios enlaces RSS.

## Descargas

- **Mac:** `PodcastSteam-0.2.0-mac-universal.dmg`, para Intel y Apple Silicon. Abre el DMG, arrastra la app a Aplicaciones y sustituye la anterior con la aplicación cerrada. El proceso de publicación verifica ambas arquitecturas, la firma ad hoc y la prueba de reproducción sobre la app universal empaquetada antes de adjuntar el DMG.
- **Linux/SteamOS:** `PodcastSteam-0.2.0.AppImage`, para x86_64. Dale permiso de ejecución y añádela a Steam como producto ajeno a Steam. Requiere entorno gráfico y la configuración de sandbox de Electron correspondiente a tu distribución.

Cada paquete aparece cuando termina su compilación y verificación. `SHA256SUMS` y `SHA256SUMS-macOS` contienen las sumas de integridad. No se incluye instalador de Windows en esta release.

## Pruebas y límites de esta versión de prueba

La prueba de escritorio comprueba reproducción con audio real local, avance con ventana oculta, reanudación, favoritos, volumen y velocidad; también navegación espacial, conservación del foco, ajuste de controles con mando simulado y distribución a 1280×800 y 780×600. El mando físico, Steam Input y la reproducción durante una partida real siguen pendientes de validación en hardware.

El DMG usa firma ad hoc y no tiene certificado Developer ID ni notarización de Apple. Si macOS lo bloquea después del primer intento, autoriza esta aplicación concreta en Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente. No desactives Gatekeeper globalmente.

En Linux, cerrar la ventana termina la aplicación: minimízala o cambia al juego para conservar el audio. En macOS/Windows, cerrar la ventana la oculta en la bandeja; usa Salir para terminar el proceso. Los podcasts exclusivos de servicios de pago no están incluidos.
