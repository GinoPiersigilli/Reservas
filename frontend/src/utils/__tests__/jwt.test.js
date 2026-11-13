import { describe, it, expect } from 'vitest';
import { decodificarPayloadJwt } from '../jwt.js';

const armarToken = (payload) => {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const base64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `encabezado.${base64}.firma`;
};

describe('decodificarPayloadJwt', () => {
  it('conserva los acentos y la eñe del nombre', () => {
    const payload = { id: 3, nombre: 'David López', email: 'david@utnfrc.edu.ar', rol: 'usuario' };
    expect(decodificarPayloadJwt(armarToken(payload))).toEqual(payload);
  });

  it('decodifica nombres con caracteres fuera del alfabeto latino', () => {
    const payload = { id: 4, nombre: 'Núñez Ángeles 東京', rol: 'admin' };
    expect(decodificarPayloadJwt(armarToken(payload)).nombre).toBe('Núñez Ángeles 東京');
  });

  it('rechaza un token con formato inválido', () => {
    expect(() => decodificarPayloadJwt('sin-puntos')).toThrow(/formato esperado/);
    expect(() => decodificarPayloadJwt(null)).toThrow(/formato esperado/);
  });
});
