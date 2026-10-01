import { Link } from 'react-router-dom';
import './PlatformHome.css';

export default function Terminos() {
  return (
    <div className="ph-page">
      <div className="ph-ambient" aria-hidden="true">
        <span className="ph-amb ph-amb-1" />
        <span className="ph-amb ph-amb-2" />
      </div>

      <div className="ph-legal">
        <Link to="/" className="ph-legal-back">← Volver al inicio</Link>

        <h1>Términos y condiciones</h1>
        <p className="ph-legal-updated">Última actualización: septiembre de 2026</p>

        <p>
          Este texto es una base general y no reemplaza el asesoramiento de un abogado.
          Antes de usarlo con clientes reales, conviene que un profesional lo revise y lo ajuste a tu situación.
        </p>

        <h2>1. Qué es TurnosBS</h2>
        <p>
          TurnosBS es una plataforma que permite a negocios de servicios (barberías, peluquerías y similares)
          gestionar turnos, recordatorios y su agenda a través de una página propia.
        </p>

        <h2>2. Tu cuenta</h2>
        <p>
          Sos responsable de mantener segura tu contraseña y de la actividad que ocurra en tu cuenta.
          Si detectás un uso no autorizado, avisanos apenas puedas.
        </p>

        <h2>3. Tu negocio y tus datos</h2>
        <p>
          Los datos que cargás sobre tu negocio (horarios, servicios, precios) y los datos de tus clientes
          (nombre, teléfono, correo) son tuyos. Los usamos únicamente para que la plataforma funcione:
          mostrar tu página, procesar reservas y enviar los correos de confirmación y recordatorio que vos configurás.
        </p>

        <h2>4. Período de prueba y suscripción</h2>
        <p>
          Los negocios nuevos cuentan con un período de prueba gratuito. Pasado ese período, seguir usando la
          plataforma requiere una suscripción activa. Si la suscripción no está al día, el acceso puede suspenderse
          hasta regularizarla.
        </p>

        <h2>5. Uso permitido</h2>
        <p>
          No está permitido usar la plataforma para fines ilegales, para enviar comunicaciones no solicitadas
          (spam) a personas que no reservaron un turno, ni para intentar acceder a datos de otros negocios.
        </p>

        <h2>6. Disponibilidad</h2>
        <p>
          Hacemos lo posible para que el servicio esté disponible de forma continua, pero puede haber
          interrupciones por mantenimiento o por causas fuera de nuestro control.
        </p>

        <h2>7. Cambios en estos términos</h2>
        <p>
          Podemos actualizar este texto. Si el cambio es importante, te avisamos por correo o dentro de la plataforma.
        </p>

        <h2>8. Contacto</h2>
        <p>
          Cualquier consulta sobre estos términos, escribinos a través de los medios de contacto de la plataforma.
        </p>
      </div>
    </div>
  );
}