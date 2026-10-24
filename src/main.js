import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { START_POSITION, LOCKER_POSITION, movementDelta, stepPosition, nearTerminal, nearLocker, spatialHint, groundSurface } from './navigation.js';
import { CaneAudio } from './cane-audio.js';
import { GroundWaves } from './ground-waves.js';
import { requestMicrophoneAccess } from './device-access.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const viewport = $('viewport');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#14231f');
scene.fog = new THREE.Fog('#14231f', 18, 38);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 80);
camera.position.set(2.8, 10, 15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;
viewport.appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.7, 0);
controls.enableDamping = true;
controls.minDistance = 2;
controls.maxDistance = 23;
controls.maxPolarAngle = Math.PI / 2 - .04;
const ambient = new THREE.HemisphereLight('#e7f1da', '#465441', 2.3);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#ffedcc', 3.1);
sun.position.set(2, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .1, far: 25 });
sun.shadow.bias = -.0006;
sun.shadow.normalBias = .03;
scene.add(sun);
const fill = new THREE.DirectionalLight('#b3dbbf', 1.2);
fill.position.set(-6, 5, -2);
scene.add(fill);

let model, hinge, parcel, loaded = false, stage = 0, code = '', audio = false;
let cameraTween = null, mode = 'overview', doorAngle = 0;
let lastGuidance = 0, completed = false, started = false;
let yaw = 0, pitch = -.38, dragging = null, blindVision = true, tactileMode = false;
const player = new THREE.Vector3(START_POSITION.x, 1.65, START_POSITION.z);
const obstacles = [];
const groundTiles = [], environmentMeshes = [], screenMaterials = [], reliefMaterials = [];
const keys = new Set();
const caneAudio = new CaneAudio({ onStateChange: () => refreshAudioControls() });
let pendingBegin = false, setupEpoch = 0, audioAttempt = 0, microphonePermission = 'unknown';
let lastTap = 0, lastSurface = '', lastCaneContact = 0;
const contactRay = new THREE.Raycaster();
const caneTipLocal = new THREE.Vector3(-.10, -1.64, -1.10);
const caneTip = new THREE.Vector3();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const groundWaves = new GroundWaves(scene, reducedMotion);
const terminalCanvas = document.createElement('canvas');
terminalCanvas.width = 768; terminalCanvas.height = 640;
const terminalTexture = new THREE.CanvasTexture(terminalCanvas);
terminalTexture.colorSpace = THREE.SRGBColorSpace;
const terminalDisplay = new THREE.Mesh(
  new THREE.PlaneGeometry(.43, .36),
  new THREE.MeshBasicMaterial({ map: terminalTexture, toneMapped: false })
);
terminalDisplay.name = 'LiveTerminalDisplay';
terminalDisplay.position.set(0, 1.64, .319);
scene.add(terminalDisplay);

function drawTerminal() {
  const context = terminalCanvas.getContext('2d');
  context.fillStyle = '#071b14'; context.fillRect(0, 0, 768, 640);
  context.textAlign = 'center';
  context.fillStyle = '#bbd4ad'; context.font = '38px sans-serif';
  context.fillText('CÓDIGO DE RETIRO', 384, 135);
  context.fillStyle = '#f4ffdf'; context.font = 'bold 145px monospace';
  context.fillText(code.padEnd(4, '—').split('').join(' '), 384, 340);
  context.fillStyle = '#bbd4ad'; context.font = '30px sans-serif';
  context.fillText(stage >= 2 ? 'VERIFICADO · CASILLERO 17' : 'INGRESA 4 DÍGITOS Y PULSA OK', 384, 510);
  terminalTexture.needsUpdate = true;
}
drawTerminal();
const guide = [
  'Comienza el recorrido. Camina con W A S D o las flechas y arrastra la escena para mirar. Sigue la guía amarilla hasta el tótem.',
  'Estás frente al tótem. Ingresa tu código de cuatro dígitos y presiona OK, abajo a la derecha. Puedes probar con 2026.',
  'Código correcto. Tu pedido está en el casillero 17, en el módulo izquierdo. Camina con W A S D por la guía amarilla; te indicaré la dirección y la distancia.',
  'Has llegado al casillero 17. La puerta está abierta. Presiona Retirar paquete o la tecla E para completar tu retiro.'
];

function speak(message, force = false) {
  $('instruction').textContent = message;
  if ((!audio && !force) || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'es-CL';
  utterance.rate = .94;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('es'));
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
}

function updateStage(next) {
  stage = next;
  document.querySelectorAll('.steps li').forEach((el, i) => {
    el.classList.toggle('active', i === stage);
    el.classList.toggle('done', i < stage || completed);
  });
  $('terminal-state').textContent = stage === 0 ? 'EN ESPERA' : stage === 1 ? 'INGRESA CÓDIGO' : 'VERIFICADO';
  $('scene-tag').innerHTML = '<i></i> ' + ['Una ruta que puedes sentir', 'Un teclado que puedes reconocer', 'Tu casillero está más cerca', 'Autonomía en cada paso'][stage];
  updateInteraction();
  drawTerminal();
  speak(guide[stage]);
}

function updateInteraction() {
  const atTerminal = started && mode === 'first' && nearTerminal(player);
  const atLocker = started && mode === 'first' && nearLocker(player);
  $('keypad').querySelectorAll('button').forEach((button) => { button.disabled = stage !== 1 || !atTerminal; });
  $('copy-code').disabled = stage !== 1 || !atTerminal;
  $('collect').disabled = stage !== 3 || !atLocker || completed;
  $('fullscreen-interaction').hidden = !((stage === 1 && atTerminal) || (stage === 3 && atLocker));
  $('fullscreen-interaction').classList.toggle('collect-only', stage === 3);
  const nextTactile = blindVision && atTerminal;
  if (nextTactile !== tactileMode) {
    tactileMode = nextTactile;
    document.querySelector('.experience').classList.toggle('tactile', tactileMode);
    reliefMaterials.forEach((material) => { material.emissiveIntensity = tactileMode ? .16 : .025; });
    applyVision();
  }
}

function applyVision() {
  const dark = blindVision && mode === 'first';
  const bright = document.body.classList.contains('bright');
  document.querySelector('.experience').classList.toggle('blind-vision', dark);
  ambient.intensity = dark ? (tactileMode ? .06 : .15) : bright ? 4 : 2.3;
  sun.intensity = dark ? (tactileMode ? .12 : .45) : 3.1;
  fill.intensity = dark ? .08 : 1.2;
  renderer.toneMappingExposure = dark ? .65 : bright ? 1.9 : 1.45;
  scene.background.set(dark ? '#020403' : '#14231f');
  scene.fog.color.copy(scene.background);
  // Dense first-person fog completely obscures distant geometry, including lights
  // and raised labels. Keep the overview clear for presenting the room layout.
  scene.fog.near = mode === 'first' ? .25 : 18;
  scene.fog.far = mode === 'first' ? 2.4 : 38;
  screenMaterials.forEach(({ material, original, text }) => {
    material.copy(original);
    if (dark) {
      material.color.set('#020303');
      material.emissive.set('#000000');
      if (text) { material.transparent = true; material.opacity = 0; }
    }
  });
  $('vision').setAttribute('aria-pressed', String(blindVision));
  $('vision').textContent = blindVision ? '◐ Visión en siluetas' : '◉ Vista de presentación';
}

// Merge static geometry by material: the original Blender hierarchy is retained for
// keypad hit testing, door animation, and package collection only.
function optimize(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map(), remove = [];
  root.traverse((object) => {
    if (!object.isMesh || Array.isArray(object.material)) return;
    let ancestor = object, interactive = false;
    while (ancestor) {
      if (/^(DoorPivot_17|Package|Key_)/.test(ancestor.name)) interactive = true;
      ancestor = ancestor.parent;
    }
    object.castShadow = true;
    object.receiveShadow = true;
    if (interactive) return;
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
    if (geometry.index) {
      const flat = geometry.toNonIndexed();
      geometry.dispose();
      const bucket = buckets.get(object.material) || [];
      bucket.push(flat); buckets.set(object.material, bucket);
    } else {
      const bucket = buckets.get(object.material) || [];
      bucket.push(geometry); buckets.set(object.material, bucket);
    }
    remove.push(object);
  });
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    scene.add(mesh);
    environmentMeshes.push(mesh);
    geometries.forEach((g) => g.dispose());
  }
  remove.forEach((o) => o.removeFromParent());
}

new GLTFLoader().load(`${import.meta.env.BASE_URL}models/centro-accesible.glb?v=catadores-de-uva`, (gltf) => {
  model = gltf.scene;
  // Blender cameras and lights are authoring aids; browser lighting is controlled here.
  const aids = [];
  model.traverse((o) => { if (o.isLight || o.isCamera) aids.push(o); });
  aids.forEach((o) => o.removeFromParent());
  scene.add(model);
  hinge = model.getObjectByName('DoorPivot_17');
  parcel = model.getObjectByName('Package');
  model.updateMatrixWorld(true);
  model.traverse((object) => {
    if (!object.isMesh) return;
    if (object.name.startsWith('Baldosa')) {
      const bounds = new THREE.Box3().setFromObject(object);
      groundTiles.push({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, warning: /^Baldosa[ _]advertencia/.test(object.name) });
    }
    if (/^Pantalla/.test(object.name)) {
      const original = object.material.clone();
      object.material = object.material.clone();
      screenMaterials.push({ material: object.material, original, text: object.name !== 'Pantalla' });
    }
    if (/^(Label_|RaisedNumber_|Referencia[ _]tactil)/.test(object.name)) {
      object.material = object.material.clone();
      object.material.emissive.set('#b7beb7');
      object.material.emissiveIntensity = .025;
      reliefMaterials.push(object.material);
    }
  });
  for (const name of ['Totem', 'Bank_0', 'Bank_1', 'Bank_2']) {
    const bounds = new THREE.Box3().setFromObject(model.getObjectByName(name));
    obstacles.push({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z });
  }
  // Benches and structural pillars stay solid while exploring the room.
  for (const side of [-1, 1]) {
    obstacles.push({ minX: side * 4.5 - .95, maxX: side * 4.5 + .95, minZ: 2.4, maxZ: 3.15 });
    for (const z of [-3.7, 3.5]) obstacles.push({ minX: side * 5.5 - .31, maxX: side * 5.5 + .31, minZ: z - .31, maxZ: z + .31 });
  }
  optimize(model);
  loaded = true;
  $('load-state').textContent = '● Modelos Blender / GLB';
  $('loading').remove();
  updateInteraction();
  applyVision();
  if (pendingBegin) { pendingBegin = false; begin(); }
}, undefined, (error) => {
  console.error(error);
  $('loading').innerHTML = '<p>No se pudo cargar la escena 3D.</p><small>Recarga la página para volver a intentarlo.</small>';
  $('load-state').textContent = 'Error de carga';
});

// Blender-authored first-person hand and cane, attached to the camera.
const cane = new THREE.Group();
cane.visible = false;
scene.add(cane);
scene.add(camera);
new GLTFLoader().load(`${import.meta.env.BASE_URL}models/baston-mano.glb`, ({ scene: asset }) => {
  cane.add(asset);
}, undefined, (error) => console.warn('No se pudo cargar el bastón:', error));

function setMode(value) {
  keys.clear();
  groundWaves.clear();
  dragging = null;
  cameraTween = null;
  mode = value;
  document.querySelector('.experience').classList.toggle('first', value === 'first');
  $('overview').classList.toggle('selected', value === 'overview');
  $('first-person').classList.toggle('selected', value === 'first');
  controls.enabled = value === 'overview';
  controls.enablePan = value === 'overview';
  controls.minDistance = 2;
  controls.maxPolarAngle = Math.PI / 2 - .04;
  cane.visible = value === 'first';
  camera.fov = value === 'first' ? 75 : 42;
  camera.updateProjectionMatrix();
  $('view-help').textContent = value === 'first' ? 'Enter · Confirmar código    E · Retirar paquete' : '↔ Arrastra para explorar · Scroll para acercar';
  if (value === 'first') {
    camera.position.copy(player);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    viewport.focus({ preventScroll: true });
  }
  updateInteraction();
  applyVision();
}

function moveCamera(position, target, seconds = 1.4, onComplete = null) {
  cameraTween = {
    start: performance.now(), duration: reducedMotion ? 1 : seconds * 1000,
    from: camera.position.clone(), to: new THREE.Vector3(...position),
    targetFrom: controls.target.clone(), targetTo: new THREE.Vector3(...target), onComplete
  };
}

function begin() {
  if (!loaded) { speak('La escena todavía está cargando. Espera un momento.'); return; }
  const firstVisit = !started;
  started = true;
  if (audio) void caneAudio.unlock({ userGesture: true });
  $('start').textContent = completed ? 'Volver a explorar →' : 'Continuar en primera persona →';
  setMode('first');
  lastGuidance = 0;
  speak(firstVisit ? 'Bienvenido. Tú controlas el recorrido: W avanza, S retrocede, A y D te desplazan a los lados. Arrastra para mirar. El tótem está al frente, a unos cinco metros.' : guide[stage]);
}

function press(key) {
  if (!loaded) return;
  if (stage !== 1 || mode !== 'first' || !nearTerminal(player)) {
    if (stage < 2) speak('Camina hasta el frente del tótem con W A S D para usar el teclado.');
    return;
  }
  if (key === 'BACK') code = code.slice(0, -1);
  else if (key === 'OK') {
    if (code !== '2026') {
      $('keypad-status').textContent = code.length !== 4 ? 'Ingresa los cuatro dígitos antes de confirmar.' : 'Código incorrecto. Prueba con 2026.';
      speak($('keypad-status').textContent);
      return;
    }
    $('keypad-status').textContent = 'Código verificado · Casillero 17';
    updateStage(2);
    keys.clear();
    viewport.focus({ preventScroll: true });
    lastGuidance = performance.now();
    return;
  } else if (code.length < 4) code += key;
  $('code-display').textContent = code.padEnd(4, '—').split('').join(' ');
  drawTerminal();
  if (key !== 'BACK') speak('Dígito ' + key + '. ' + code.length + ' de 4.');
  else speak('Último dígito eliminado.');
  const object = model.getObjectByName('Key_' + key);
  if (object) {
    object.position.z -= .015;
    setTimeout(() => { object.position.z += .015; }, 150);
  }
}

['1','2','3','4','5','6','7','8','9','BACK','0','OK'].forEach((key) => {
  const button = document.createElement('button');
  button.dataset.key = key;
  button.textContent = key === 'BACK' ? '←' : key;
  button.setAttribute('aria-label', key === 'BACK' ? 'Borrar último dígito' : key === 'OK' ? 'Confirmar código' : 'Dígito ' + key);
  button.addEventListener('click', () => press(key));
  $('keypad').appendChild(button);
});

function collect() {
  if (stage !== 3 || completed || mode !== 'first' || !nearLocker(player)) return;
  completed = true;
  if (parcel) parcel.visible = false;
  updateStage(3);
  $('collect').textContent = 'Pedido retirado ✓';
  $('start').textContent = 'Recorrido completado ✓';
  $('scene-tag').innerHTML = '<i></i> Tu pedido. Tu autonomía.';
  speak('¡Pedido retirado! Completaste el recorrido con autonomía. Gracias por jugar Desafío futuro inclusivo, de Los catadores de Uva. Puedes reiniciar para volver a explorar.');
}

function reset() {
  cameraTween = null; completed = false; code = ''; started = false;
  keys.clear();
  player.set(START_POSITION.x, 1.65, START_POSITION.z);
  yaw = 0; pitch = -.38;
  if (parcel) parcel.visible = true;
  doorAngle = 0;
  $('code-display').textContent = '— — — —';
  drawTerminal();
  $('keypad-status').textContent = 'Código de demostración: 2026';
  $('start').innerHTML = 'Comenzar recorrido <span>→</span>';
  $('collect').innerHTML = 'Retirar paquete <span>↗</span>';
  updateStage(0); setMode('overview');
  moveCamera([2.8,10,15], [0,.7,0]);
}

function answer(question) {
  if (/bot[oó]n|presion|tecla/.test(question.toLowerCase())) {
    speak(stage < 1 ? 'Presiona Comenzar recorrido, en el panel izquierdo.' : stage === 1 ? 'Ingresa 2, 0, 2, 6. Después presiona OK, en la esquina inferior derecha del teclado. La flecha inferior izquierda borra el último dígito.' : stage === 2 ? 'Sigue las indicaciones hacia el casillero 17. No necesitas presionar ningún botón todavía.' : completed ? 'Tu pedido ya fue retirado. Puedes presionar Reiniciar experiencia.' : 'Presiona Retirar paquete o la tecla E.');
  } else if (/distancia|d[oó]nde|cu[aá]nto/.test(question.toLowerCase()) && stage >= 2) {
    const hint = spatialHint(player, yaw, LOCKER_POSITION);
    speak(completed ? 'Ya retiraste tu pedido del casillero 17.' : `Tu casillero es el 17. Está ${hint.direction}, a ${hint.distance.toFixed(1).replace('.', ',')} metros de tu posición virtual.`);
  } else speak(completed ? 'Tu retiro está completo. Puedes reiniciar la experiencia.' : guide[stage]);
}

$('start').addEventListener('click', begin);
$('reset').addEventListener('click', reset);
$('collect').addEventListener('click', collect);
$('copy-code').addEventListener('click', () => {
  if (stage !== 1 || mode !== 'first' || !nearTerminal(player)) { speak('Camina primero hasta el frente del tótem con W A S D.'); return; }
  code = ''; ['2','0','2','6'].forEach(press);
  speak('Código 2026 ingresado. Presiona OK para confirmar.');
});
$('overview').addEventListener('click', () => {
  setMode('overview');
  moveCamera([2.8,10,15],[0,.7,0]);
  if (started) speak('Vista general. Tu posición está guardada. Presiona Primera persona para continuar caminando.');
});
$('first-person').addEventListener('click', begin);
function refreshAudioControls() {
  const ready = audio && caneAudio.state === 'running';
  const label = !audio ? 'Activar audio' : ready ? 'Desactivar audio' : 'Reactivar audio';
  $('sound').setAttribute('aria-pressed', String(ready));
  $('sound').setAttribute('aria-label', label);
  $('sound').innerHTML = '♪ <span>' + (!audio ? 'Audio desactivado' : ready ? 'Audio activado' : 'Audio en pausa') + '</span>';
  $('scene-sound').setAttribute('aria-pressed', String(ready));
  $('scene-sound').textContent = '♪ ' + label;
  $('audio-health').hidden = !audio || ready;
  $('audio-health').textContent = 'El audio está bloqueado o en pausa. Pulsa Reactivar audio o Probar sonido. Revisa también el volumen y que la pestaña no esté silenciada.';
  const suffix = ready ? 'Audio activado' : audio ? 'Audio en pausa' : 'Audio desactivado';
  if (!lastSurface) $('cane-status').textContent = 'Bastón listo · ' + suffix;
  else $('cane-status').textContent = $('cane-status').textContent.replace(/ · Audio (activado|en pausa|desactivado)$/, '') + ' · ' + suffix;
}

function disableAudio() {
  audio = false;
  audioAttempt++;
  caneAudio.cancel();
  lastSurface = '';
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  refreshAudioControls();
}

async function enableAudio({ test = false, announce = true } = {}) {
  const attempt = ++audioAttempt;
  audio = true;
  const unlocking = caneAudio.unlock({ userGesture: true });
  refreshAudioControls();
  const ready = await unlocking;
  if (attempt !== audioAttempt || !audio) return false;
  lastSurface = '';
  refreshAudioControls();
  if (ready && test) await caneAudio.tap('guide');
  if (ready && announce && !test) speak($('instruction').textContent);
  return ready;
}

function toggleSound() {
  if (audio && caneAudio.state === 'running') disableAudio();
  else void enableAudio({ test: true });
}

$('sound').addEventListener('click', toggleSound);
$('scene-sound').addEventListener('click', toggleSound);
$('audio-test').addEventListener('click', () => {
  void enableAudio({ test: true }).then((ready) => {
    if (ready) $('instruction').textContent = 'Prueba de audio: debes oír dos golpes agudos. Si no los oyes, comprueba el volumen, la salida de sonido y que la pestaña no esté silenciada.';
  });
});
$('repeat').addEventListener('click', () => speak($('instruction').textContent, true));
$('contrast').addEventListener('click', () => {
  const bright = document.body.classList.toggle('bright');
  if (blindVision && mode === 'first') blindVision = false;
  applyVision();
  $('contrast').textContent = bright ? '◐ Iluminación normal' : '◐ Aumentar iluminación';
  $('contrast').setAttribute('aria-pressed', String(bright));
});
$('vision').addEventListener('click', () => { blindVision = !blindVision; updateInteraction(); applyVision(); });
document.querySelectorAll('[data-question]').forEach((button) => button.addEventListener('click', () => answer(button.dataset.question)));
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition, listening = false;
function updateMicButton() {
  $('mic').textContent = listening ? '● Escuchando… Detener' : microphonePermission === 'denied' ? '♩ Micrófono bloqueado · Configurar' : '♩ Preguntar por voz';
}
$('mic').addEventListener('click', () => {
  if (!Recognition) { speak('Este navegador no permite reconocimiento de voz. Puedes usar los botones de preguntas que están debajo.'); return; }
  if (listening) { recognition.stop(); return; }
  if (microphonePermission === 'denied') { showDeviceSetup(); return; }
  recognition = new Recognition();
  recognition.lang = 'es-CL'; recognition.interimResults = false;
  recognition.onresult = (event) => answer(event.results[0][0].transcript);
  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') microphonePermission = 'denied';
    speak(microphonePermission === 'denied' ? 'El micrófono no está habilitado. Puedes permitirlo en tu navegador o usar las preguntas escritas.' : 'No pude escuchar la pregunta. Inténtalo otra vez o usa las preguntas escritas.');
  };
  recognition.onend = () => { listening = false; updateMicButton(); };
  try {
    recognition.start(); listening = true; $('mic').textContent = '● Escuchando… Detener';
  } catch { speak('No fue posible iniciar el micrófono. Usa los botones de preguntas.'); }
});

function showDeviceSetup() {
  keys.clear(); dragging = null;
  recognition?.abort();
  listening = false; updateMicButton();
  $('setup-audio').checked = audio || !started;
  $('setup-microphone').checked = microphonePermission === 'granted';
  $('setup-status').textContent = 'Selecciona lo que quieras activar. También puedes explorar sin dispositivos.';
  $('device-title').textContent = started ? 'Configura tus dispositivos' : 'Prepara tu experiencia';
  $('setup-apply').disabled = false;
  $('setup-apply').innerHTML = (started ? 'Guardar y continuar' : 'Activar y comenzar') + ' <span>→</span>';
  if (!$('device-setup').open) $('device-setup').showModal();
}

function finishDeviceSetup() {
  $('device-setup').close();
  if (!started) {
    if (loaded) begin();
    else pendingBegin = true;
  } else if (mode === 'first') viewport.focus({ preventScroll: true });
}

$('setup-apply').addEventListener('click', async () => {
  const epoch = ++setupEpoch;
  const useAudio = $('setup-audio').checked;
  const useMicrophone = $('setup-microphone').checked && !$('setup-microphone').disabled;
  $('setup-apply').disabled = true;
  $('setup-status').textContent = useMicrophone ? 'Confirma el permiso de micrófono en el aviso del navegador. Puedes continuar sin dispositivos si prefieres.' : 'Activando y comprobando el audio…';
  // Start both requests inside the user gesture, before awaiting either result.
  const audioReady = useAudio ? enableAudio({ test: true, announce: false }) : (disableAudio(), Promise.resolve(false));
  const microphoneReady = useMicrophone ? requestMicrophoneAccess() : Promise.resolve(null);
  const [ready, microphone] = await Promise.all([audioReady, microphoneReady]);
  if (epoch !== setupEpoch) return;
  if (microphone) microphonePermission = microphone.state;
  updateMicButton();
  $('setup-apply').disabled = false;
  const initialVisit = !started;
  finishDeviceSetup();
  const messages = [];
  if (useAudio) messages.push(ready ? 'Audio activado. La prueba reproduce dos golpes.' : 'No se pudo activar el audio. Pulsa Reactivar audio o Probar sonido.');
  if (microphone) messages.push(microphone.message);
  if (initialVisit) messages.push(guide[0]);
  if (messages.length) speak(messages.join(' '));
});

function skipDeviceSetup() {
  setupEpoch++;
  disableAudio();
  finishDeviceSetup();
}
$('setup-skip').addEventListener('click', skipDeviceSetup);
$('device-setup').addEventListener('cancel', (event) => {
  event.preventDefault();
  if (started) { setupEpoch++; finishDeviceSetup(); }
  else skipDeviceSetup();
});
$('devices').addEventListener('click', showDeviceSetup);
if (!Recognition || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
  $('setup-microphone').disabled = true;
  $('device-compatibility').textContent = 'Las preguntas por voz no están disponibles en este navegador. Las preguntas escritas y los sonidos del bastón siguen disponibles.';
}

const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
let pointerDown;
renderer.domElement.addEventListener('pointerdown', (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
  if (mode !== 'first' || e.button !== 0) return;
  if (audio && caneAudio.state !== 'running') void caneAudio.unlock({ userGesture: true });
  viewport.focus({ preventScroll: true });
  dragging = { id: e.pointerId, x: e.clientX, y: e.clientY };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging || dragging.id !== e.pointerId || mode !== 'first') return;
  yaw -= (e.clientX - dragging.x) * .004;
  pitch = THREE.MathUtils.clamp(pitch - (e.clientY - dragging.y) * .004, -1.15, 1.15);
  dragging.x = e.clientX; dragging.y = e.clientY;
});
renderer.domElement.addEventListener('pointercancel', () => { dragging = null; pointerDown = null; });
renderer.domElement.addEventListener('lostpointercapture', () => { dragging = null; });
renderer.domElement.addEventListener('pointerup', (e) => {
  dragging = null;
  if (!model || !pointerDown || Math.hypot(e.clientX-pointerDown.x, e.clientY-pointerDown.y) > 6) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX-rect.left)/rect.width)*2-1, -((e.clientY-rect.top)/rect.height)*2+1);
  raycaster.setFromCamera(pointer,camera);
  for (const hit of raycaster.intersectObject(model,true)) {
    let object = hit.object;
    while (object && !object.name.startsWith('Key_') && object !== parcel) object = object.parent;
    if (object === parcel) { collect(); break; }
    if (object?.name.startsWith('Key_')) { press(object.name.slice(4)); break; }
  }
});

const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', (e) => {
  if ($('device-setup').open) return;
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === 'Escape' && (expandedFallback || document.fullscreenElement === experience)) {
    if (document.fullscreenElement === experience) void document.exitFullscreen().catch(() => {});
    else setFullscreenState(false);
    return;
  }
  if (mode !== 'first') return;
  if (movementKeys.has(e.code)) {
    if (audio && !e.repeat && caneAudio.state !== 'running') void caneAudio.unlock({ userGesture: true });
    e.preventDefault();
    keys.add(e.code);
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat) { if (audio) void caneAudio.unlock({ userGesture: true }); tapCane(performance.now(), true); }
    return;
  }
  if (e.repeat) return;
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); press('BACK'); }
  else if (e.key === 'Enter' && !e.target.closest('button, a')) { e.preventDefault(); press('OK'); }
  else if (e.key.toLowerCase() === 'e') collect();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); dragging = null; });
document.addEventListener('visibilitychange', () => {
  keys.clear(); dragging = null;
  if (!document.hidden && audio) {
    void caneAudio.unlock();
    if ('speechSynthesis' in window) speechSynthesis.resume();
  }
});

const experience = document.querySelector('.experience');
const keypadPanel = document.querySelector('.keypad-panel');
const collectButton = $('collect');
const keypadAnchor = document.createComment('keypad location');
const collectAnchor = document.createComment('collect button location');
keypadPanel.before(keypadAnchor); collectButton.before(collectAnchor);
let expandedFallback = false;

function setFullscreenState(active) {
  keys.clear(); dragging = null;
  experience.classList.toggle('is-fullscreen', active);
  document.body.classList.toggle('immersive', active);
  $('fullscreen').setAttribute('aria-pressed', String(active));
  $('fullscreen').setAttribute('aria-label', active ? 'Salir de pantalla completa' : 'Entrar en pantalla completa');
  $('fullscreen').innerHTML = active ? '⛶ <span>Salir · Esc</span>' : '⛶ <span>Pantalla completa</span>';
  if (active) $('fullscreen-interaction').append(keypadPanel, collectButton);
  else {
    keypadAnchor.after(keypadPanel); collectAnchor.after(collectButton);
    expandedFallback = false;
  }
  updateInteraction();
  if (mode === 'first') viewport.focus({ preventScroll: true });
}

$('fullscreen').addEventListener('click', async () => {
  if (document.fullscreenElement === experience) {
    try { await document.exitFullscreen(); } catch { speak('Usa Escape para salir de pantalla completa.'); }
    return;
  }
  if (expandedFallback) { setFullscreenState(false); return; }
  if (experience.requestFullscreen) {
    try { await experience.requestFullscreen(); return; } catch { /* Embedded browsers can restrict native fullscreen. */ }
  }
  expandedFallback = true;
  setFullscreenState(true);
});
document.addEventListener('fullscreenchange', () => setFullscreenState(document.fullscreenElement === experience));

function updatePlayerProgress(now, moving) {
  if (!started || mode !== 'first') return;
  if (stage === 0 && nearTerminal(player)) updateStage(1);
  if (stage === 2 && nearLocker(player)) {
    doorAngle = -Math.PI * .58;
    updateStage(3);
  }
  updateInteraction();
  const target = stage < 2 ? { x: 0, z: .3 } : LOCKER_POSITION;
  const hint = spatialHint(player, yaw, target);
  const label = stage < 2 ? 'Tótem' : 'Casillero 17';
  const message = `${label} ${hint.direction} · ${hint.distance.toFixed(1).replace('.', ',')} m`;
  if ($('position-hint').textContent !== message) $('position-hint').textContent = message;
  if (audio && moving && !completed && (stage === 0 || stage === 2) && now - lastGuidance > 9000) {
    lastGuidance = now;
    speak(`${label} ${hint.direction}, a aproximadamente ${hint.distance.toFixed(1).replace('.', ',')} metros. Sigue el suelo podotáctil.`);
  }
}

function tapCane(now, force = false) {
  if (!loaded || mode !== 'first' || (!force && now - lastTap < 580)) return;
  lastTap = now;
  // The visible tip reaches the same point tested against the scene geometry.
  cane.updateMatrixWorld(true);
  caneTip.copy(caneTipLocal).applyMatrix4(cane.matrixWorld);
  const hand = new THREE.Vector3(.20, -.36, -.45).applyMatrix4(cane.matrixWorld);
  const end = caneTip.clone(); end.y = -.03;
  contactRay.set(hand, end.clone().sub(hand).normalize());
  contactRay.far = hand.distanceTo(end) + .12;
  const hit = contactRay.intersectObjects([...environmentMeshes, model], true)[0];
  if (!hit) return;
  const surface = hit.point.y > .18 ? 'obstacle' : groundSurface(hit.point.x, hit.point.z, groundTiles);
  groundWaves.emit(hit.point, surface, now);
  if (audio) caneAudio.tap(surface);
  const labels = {
    floor: 'Suelo liso · Un golpe grave', guide: 'Guía podotáctil · Dos golpes agudos',
    warning: 'Baldosa de advertencia · Tres golpes', obstacle: 'Obstáculo al frente · Golpe seco'
  };
  if (surface !== lastSurface) {
    lastSurface = surface;
    $('cane-status').textContent = labels[surface] + (audio ? '' : ' · Audio desactivado');
  }
  lastCaneContact = now;
}

const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), .1), now = performance.now();
  if (cameraTween) {
    const p = Math.min((now-cameraTween.start)/cameraTween.duration,1);
    const ease = p*p*(3-2*p);
    camera.position.lerpVectors(cameraTween.from,cameraTween.to,ease);
    controls.target.lerpVectors(cameraTween.targetFrom,cameraTween.targetTo,ease);
    if (p===1) { const complete = cameraTween.onComplete; cameraTween=null; complete?.(); }
  } else if (mode === 'first') {
    const delta = movementDelta(keys, yaw, dt);
    const next = stepPosition(player, delta, obstacles);
    const moving = Math.hypot(next.x - player.x, next.z - player.z) > .0001;
    player.set(next.x, 1.65, next.z);
    camera.position.copy(player);
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    cane.position.copy(player);
    const tapAge = now - lastCaneContact;
    cane.position.y += !reducedMotion && tapAge < 180 ? Math.sin(tapAge / 180 * Math.PI) * .035 : 0;
    cane.rotation.set(0, yaw + (moving && !reducedMotion ? Math.sin(now * .003) * .10 : 0), 0);
    if (moving) tapCane(now);
    updatePlayerProgress(now, moving);
  }
  if (hinge) hinge.rotation.y = THREE.MathUtils.damp(hinge.rotation.y,doorAngle,5,dt);
  groundWaves.update(now, mode === 'first');
  if (mode === 'overview') controls.update();
  renderer.render(scene,camera);
}
const resize = new ResizeObserver(() => {
  const width = viewport.clientWidth, height = viewport.clientHeight;
  renderer.setSize(width,height);
  camera.aspect=width/height;camera.updateProjectionMatrix();
});
resize.observe(viewport);
updateInteraction();
animate();
showDeviceSetup();
