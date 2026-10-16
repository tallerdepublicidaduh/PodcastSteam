Primera versión de prueba de PodcastSteam: escucha podcasts RSS públicos en una aplicación independiente que puedes añadir a Steam.

- Biblioteca RSS, búsqueda, favoritos y reanudación del punto de escucha.
- Volumen independiente, velocidad de reproducción y saltos de −15/+30 segundos.
- Controles de teclado y mando estándar cuando la aplicación tiene el foco.
- Validación de audio con ventana oculta y persistencia al reiniciar mediante una prueba de Electron/Linux con audio local real.

Este paquete AppImage es para Linux x86_64 (incluido el hardware de Steam Deck), está sin firmar y es experimental. No se ha validado todavía durante una partida real, en el modo Juego de SteamOS ni en hardware macOS/Windows. Minimiza la aplicación o cambia al juego sin cerrar la ventana para conservar la reproducción en Linux. El proceso de prueba automatizado usa un sandbox desactivado; la aplicación distribuida conserva la configuración normal de Electron.

Descarga el AppImage, dale permiso de ejecución y añádelo a Steam como producto ajeno a Steam. Requiere un entorno gráfico, acceso a los servidores RSS/audio y una configuración de sandbox compatible con Electron. Si tu distribución no permite ejecutar AppImage mediante FUSE, puedes probar su modo de extracción: `APPIMAGE_EXTRACT_AND_RUN=1 ./PodcastSteam-0.1.0.AppImage`.

También se incluye `PodcastSteam-0.1.0-mac-universal.dmg` para Mac Intel y Apple Silicon. La compilación en GitHub comprueba ambas arquitecturas, verifica la firma ad hoc y ejecuta la prueba de escritorio sobre la aplicación universal empaquetada. Abre el DMG y arrastra PodcastSteam a Aplicaciones. No tiene certificado Developer ID ni notarización de Apple; si macOS la bloquea después de intentar abrirla, autoriza esta aplicación concreta desde Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente. No desactives Gatekeeper globalmente. La escucha durante un juego real sigue pendiente de prueba en tu equipo.

Consulta el README de la rama main para los controles, las instrucciones de Steam y las limitaciones. `SHA256SUMS` (Linux) y `SHA256SUMS-macOS` permiten comprobar la integridad de los archivos descargados. El instalador de Windows todavía no está adjunto a esta release.
