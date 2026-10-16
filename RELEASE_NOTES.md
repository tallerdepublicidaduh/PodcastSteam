## PodcastSteam 0.3.0 · Diseño de consola

Interfaz adaptada a la referencia visual del usuario: fondo carbón, portada grande a la izquierda, búsqueda superior, tarjetas ilustradas de categorías, bordes azules luminosos y reproductor horizontal con progreso.

- Las portadas, títulos y autores reales provienen de tus podcasts RSS. Se incluyen ilustraciones de categorías y una portada de reserva.
- Categorías Ciencia, Historia, Comedia, True Crime y Tecnología, obtenidas de las etiquetas RSS/iTunes en inglés o español. Los podcasts sin etiquetas permanecen en Todos. Actualiza tus podcasts antiguos para leer sus categorías.
- Búsqueda de podcasts y episodios de tu biblioteca, favoritos y episodios empezados.
- Cola guardada entre sesiones y reproducción automática del siguiente episodio al finalizar el actual.
- Mando: A selecciona, B vuelve, X añade/quita de cola, Y busca, LB/RB cambian de categoría y View abre los controles del reproductor. La cruceta navega y ajusta el control enfocado.
- Volumen, velocidad y saltos −15/+30 segundos disponibles en el icono de ajustes del reproductor.

![Vista de ejemplo de la nueva interfaz](https://raw.githubusercontent.com/tallerdepublicidaduh/PodcastSteam/v0.3.0/docs/interface.png)

La captura contiene podcasts ficticios y audio de prueba para mostrar el diseño. No se añaden podcasts de ejemplo al instalar la aplicación; incorpora tus propios RSS. La búsqueda y los filtros consultan tu biblioteca, no un directorio externo.

## Descargas

- **Mac:** `PodcastSteam-0.3.0-mac-universal.dmg`, para Intel y Apple Silicon. Cierra la versión anterior desde Salir antes de sustituirla en Aplicaciones. Se conserva el perfil de biblioteca, favoritos y puntos de escucha. El proceso de publicación verifica ambas arquitecturas, la firma ad hoc y el funcionamiento de la aplicación empaquetada.
- **Linux/SteamOS:** `PodcastSteam-0.3.0.AppImage`, para x86_64. Concede permiso de ejecución y añádela a Steam como producto ajeno a Steam.

Cada descarga aparece al terminar su compilación y validación. `SHA256SUMS` y `SHA256SUMS-macOS` permiten comprobar la integridad. El instalador de Windows no está adjunto a esta release.

## Validación y límites

Pruebas de RSS y categorías, reproducción con audio local real, volumen, velocidad, reanudación con ventana oculta, mando simulado, filtros y cola persistente con avance automático. La interfaz se comprueba a 1280×800 y 780×600. La prueba en un juego real, Steam Input y los mandos físicos en Steam Deck siguen pendientes.

El DMG tiene firma ad hoc y carece de certificado Developer ID y notarización. Si macOS lo bloquea tras intentar abrirlo, autoriza esta aplicación concreta en Ajustes del Sistema → Privacidad y seguridad → Abrir igualmente; no desactives Gatekeeper globalmente.

En Linux, cerrar la ventana termina el proceso: minimiza o cambia al juego para conservar la reproducción. En macOS/Windows, cerrar la ventana la oculta en la bandeja; utiliza Salir para terminar. Se requiere acceso a los servidores del podcast. No se incluye contenido exclusivo de servicios de pago.
