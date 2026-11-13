/**
 * Decodifica el payload de un JWT sin verificar su firma.
 *
 * Se usa solo para leer los datos del usuario que ya devolvió la API. La
 * verificación de la firma siempre ocurre en el backend.
 *
 * `atob` devuelve una cadena de bytes interpretada como Latin-1, por lo que
 * decodificar directamente rompe los acentos ("López" se vería "LÃ³pez"). Para
 * evitarlo se reinterpretan los bytes como UTF-8.
 */
export const decodificarPayloadJwt = (token) => {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw new Error('El token no tiene el formato esperado');
  }

  const payloadBase64Url = token.split('.')[1];
  if (!payloadBase64Url) {
    throw new Error('El token no tiene el formato esperado');
  }

  const base64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
  const conRelleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  const binario = atob(conRelleno);
  const bytes = Uint8Array.from(binario, (caracter) => caracter.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
};
