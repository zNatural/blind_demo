# NODO — Retiro sin barreras

Demo 3D local de un centro de retiro accesible. Three.js carga modelos creados en Blender mediante Blender MCP, con casilleros en torno a un tótem central, teclado 0–9, retroceso, OK y suelo podotáctil.

## Ejecutar

```sh
npm install
npm run dev
```

Abre la dirección local que muestra Vite. `npm run build` genera `dist/`; `npm run preview` sirve esa compilación.

## Probar el retiro

1. Activa el audio si deseas instrucciones habladas.
2. Presiona **Comenzar recorrido** y camina con **WASD** o las flechas hasta el tótem. Arrastra para mirar; la cámara gira sobre tu posición.
3. Ingresa **2026** con el teclado de la interfaz, el teclado físico o los botones 3D y confirma con **OK**.
4. Camina por la guía hasta el **casillero 17**, en el módulo izquierdo. La puerta se abre cuando llegas.
5. Presiona **Retirar paquete**, pulsa **E** o haz clic en el paquete.

El desplazamiento es manual. Las interacciones solo se habilitan cerca del tótem o del casillero; **Enter** confirma el código cuando la escena tiene el foco. La vista general conserva tu posición al volver a primera persona.

**Pantalla completa** amplía la escena y mantiene el teclado y el retiro disponibles dentro de ella. **Esc** o el botón de salida restaura la vista. Si el navegador integrado restringe la pantalla completa nativa, se utiliza una vista ampliada dentro de la ventana.

## Bastón y visión

En primera persona el entorno se representa con siluetas oscuras. Al acercarte al tótem se destacan los números y referencias en relieve; la pantalla permanece negra. El botón de visión permite alternar con la vista de presentación iluminada.

El bastón apunta al suelo y comprueba el contacto contra la geometría de la escena. Al caminar golpea periódicamente; **Espacio** permite explorar estando quieto. Con el audio activado, el suelo liso produce un golpe grave, la guía direccional dos golpes agudos y las baldosas de advertencia tres golpes. Los obstáculos producen un golpe seco. Los sonidos se sintetizan localmente con Web Audio y no requieren micrófono.

Las preguntas escritas funcionan siempre; el micrófono requiere reconocimiento de voz compatible y permiso del navegador. La síntesis de voz utiliza las voces españolas instaladas. La representación con siluetas es una convención de la demo, no una representación universal de la ceguera.

## Validación

`npm test` comprueba navegación, colisiones, zonas de interacción, orientación y clasificación del suelo. Ejecuta también `npm run build` y prueba el recorrido manual y la pantalla completa en el navegador.

## Modelos

- `public/models/centro-accesible.blend`: escena editable de Blender.
- `public/models/centro-accesible.glb`: modelo que utiliza Three.js.
- `scripts/create_models.py`: script reproducible para Blender; ajusta `ROOT` antes de ejecutarlo en otra ubicación. Crea una escena nueva y exporta ambos archivos.
- `public/models/baston-mano.glb` y `.blend`: bastón blanco y mano para primera persona, generados con `scripts/create_cane.py`.

La posición se calcula en la escena virtual; no hay sensores físicos ni conexión a pedidos reales. Los puntos táctiles ilustran el concepto y no codifican braille normalizado. La accesibilidad del prototipo requiere validación con usuarios antes de una implementación física.

## GitHub Pages

El flujo `.github/workflows/deploy-pages.yml` instala dependencias, ejecuta las pruebas, compila y publica `dist/` al recibir cambios en `main` o `master`. En **Settings → Pages → Source**, selecciona **GitHub Actions**.

La ruta base se obtiene automáticamente de la configuración de Pages. Tanto los modelos GLB como el enlace de inicio utilizan esa ruta. Para comprobar una compilación bajo una subruta en PowerShell:

```powershell
$env:VITE_BASE_PATH = '/blind_demo/'
npm run build
npm run preview
```

Después de la comprobación, `Remove-Item Env:VITE_BASE_PATH` restaura la configuración local habitual.
