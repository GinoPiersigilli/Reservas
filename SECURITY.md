# Política de Seguridad y Divulgación Responsable

La seguridad de este sistema y la protección de los datos de los usuarios son una prioridad absoluta. Agradecemos la colaboración de la comunidad de seguridad y de los desarrolladores en la identificación y reporte responsable de vulnerabilidades.

---

## Versiones con Soporte de Seguridad

Únicamente la rama principal (`main`) y los despliegues productivos activos reciben actualizaciones y parches de seguridad:

| Versión / Rama                          | Recibe Parches de Seguridad       |
| --------------------------------------- | --------------------------------- |
| `main` (Producción)                     | Sí                                |
| Versiones anteriores / ramas de trabajo | No (favor de actualizar a `main`) |

---

## Cómo Reportar una Vulnerabilidad

**Por favor, no reportes vulnerabilidades de seguridad a través de _Issues_ públicos de GitHub ni foros abiertos.**

Para reportar un fallo de seguridad de forma privada y coordinada, utilizá uno de los siguientes canales:

1. **GitHub Private Vulnerability Reporting (Canal Preferido):**
   - Dirigite a la pestaña **Security** del repositorio en GitHub.
   - Hacé clic en **Advisories** y luego en el botón **Report a vulnerability**.
   - Este mecanismo crea un canal de comunicación encriptado y privado directamente con los mantenedores del proyecto.

2. **Correo Electrónico de Contacto:**
   - En caso de no contar con cuenta de GitHub, enviá un correo electrónico al mantenedor responsable del repositorio indicando en el asunto: `[SEGURIDAD] Reporte de Vulnerabilidad en Sistema de Reservas`.
   - ginobpiersigilli@gmail.com

---

## Información a Incluir en el Reporte

Para acelerar la evaluación y resolución del problema, por favor incluí:

- **Tipo y clasificación de vulnerabilidad** (por ejemplo: IDOR, Bypass de Autenticación, Inyección SQL, XSS, etc.).
- **Componente afectado** (rutas de backend, componentes de frontend, contenedores o configuración de infraestructura).
- **Pasos detallados para reproducir** el hallazgo de manera controlada.
- **Prueba de concepto (PoC)** en texto o script mínimo sin payloads destructivos ni denegaciones de servicio masivas.
- **Evaluación del impacto potencial** en la confidencialidad, integridad o disponibilidad del sistema.

---

## Tiempos de Respuesta y Compromiso

- **Acuse de recibo:** Nos comprometemos a responder inicialmente a los reportes dentro de las **48 horas hábiles**.
- **Evaluación y triage:** Dentro de los siguientes **5 días hábiles** confirmaremos la validez y severidad del hallazgo.
- **Corrección y despliegue:** Desarrollaremos y testearemos el parche en una rama privada, manteniendo informado al investigador.
- **Divulgación coordinada:** Acordaremos la publicación del _Advisory_ y el crédito correspondiente una vez que el parche esté desplegado en producción.

---

## Alcance (In Scope / Out of Scope)

### Dentro del Alcance

- Autenticación y autorización (tokens JWT, sesiones de Clerk, control de roles).
- Control de acceso horizontal y vertical (IDOR en gestión de reservas).
- Inyecciones y validación de entradas en la API REST.
- Endurecimiento de cabeceras HTTP y políticas CSP en Nginx.
- Exposición indebida de credenciales o datos de usuarios.

### Fuera del Alcance

- Ataques de denegación de servicio distribuido (DDoS) a nivel de red o infraestructura del proveedor de nube.
- Ingeniería social, phishing o acceso físico a dispositivos de los operadores.
- Vulnerabilidades teóricas sin prueba de concepto alcanzable en el entorno del proyecto.
