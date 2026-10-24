export async function requestMicrophoneAccess(mediaDevices = globalThis.navigator?.mediaDevices) {
  if (!mediaDevices?.getUserMedia) return { state: 'unavailable', message: 'Este navegador no permite activar el micrófono. Puedes usar las preguntas escritas.' };
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    // Check permission/device availability without keeping a microphone stream open.
    for (const track of stream.getTracks()) track.stop();
    return { state: 'granted', message: 'Micrófono permitido. Se escuchará solo al pulsar Preguntar por voz.' };
  } catch (error) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return { state: 'denied', message: 'Micrófono bloqueado. Puedes permitirlo en los permisos de este sitio o continuar con las preguntas escritas.' };
    }
    if (error.name === 'NotFoundError') return { state: 'unavailable', message: 'No se encontró un micrófono. Puedes continuar con las preguntas escritas.' };
    return { state: 'unavailable', message: 'No se pudo activar el micrófono. Comprueba que esté conectado y disponible.' };
  }
}
