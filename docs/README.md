# Documentación técnica

Qué hay en cada documento y cuándo conviene abrirlo.

## Para entender el sistema

| Documento                          | Qué responde                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| [ARQUITECTURA.md](ARQUITECTURA.md) | Cómo está organizado el repositorio, el modelo de datos (DER) y la máquina de estados de una reserva.                    |
| [adr/](adr/README.md)              | Por qué se decidió cada cosa importante: una decisión por archivo, con su contexto y sus consecuencias.                  |
| [DISENO.md](DISENO.md)             | Principios visuales, sistema de tokens, la grilla horaria, la agenda y el modo oscuro.                                   |
| [CALIDAD.md](CALIDAD.md)           | Qué se prueba y por qué: la pirámide de pruebas, los límites de complejidad y los errores que estas pruebas encontraron. |
| [RENDIMIENTO.md](RENDIMIENTO.md)   | Mediciones sobre 200.000 registros con `EXPLAIN (ANALYZE, BUFFERS)` y el efecto de cada índice.                          |
| [SEGURIDAD.md](SEGURIDAD.md)       | El análisis de seguridad completo: hallazgos, mitigaciones y riesgos aceptados con su justificación.                     |

## Para operarlo

| Documento              | Qué responde                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------ |
| [DEPLOY.md](DEPLOY.md) | Cómo se despliega, qué variables hacen falta y cómo se hacen y restauran las copias. |

## Material de referencia

| Carpeta                                      | Contenido                                                                                       |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [img/](img/)                                 | Capturas de la aplicación. Se regeneran con `npm run capturas --prefix e2e`.                    |
| [seguridad/evidencia/](seguridad/evidencia/) | Salidas crudas de las herramientas de auditoría, tal como las devolvieron.                      |
| [CIERRE_TECNICO.md](CIERRE_TECNICO.md)       | Informe de cierre de las fases de seguridad y calidad, con las mediciones del día que se cerró. |

Las cifras concretas de pruebas y cobertura viven en **CALIDAD.md** y no se
repiten en los demás documentos, para que no queden dos números distintos
diciendo lo mismo.
