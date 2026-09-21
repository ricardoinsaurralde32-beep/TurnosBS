// TODO: esto se reemplaza por Supabase (tabla `staff` + Auth, y tabla `bookings`) cuando conectemos real.
// Por ahora simula usuarios y turnos para poder probar el panel sin base de datos.

export const staffAccounts = [
  {
    id: 1,
    professionalId: 1,
    email: 'richard@barberstudio.com',
    password: 'richard123', // TODO: esto NUNCA va así en producción; Supabase Auth maneja el hash
    role: 'owner'
  },
  {
    id: 2,
    professionalId: 2,
    email: 'omar@barberstudio.com',
    password: 'omar123',
    role: 'staff'
  }
];

function atDaysHour(daysOffset, hh, mm) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hh, mm, 0, 0);
  return d;
}

// Turnos de prueba: semana reciente (para estadísticas) + hoy + próximos días
export const mockBookings = [
  // Semana pasada
  { id: 'p1', professionalId: 1, date: atDaysHour(-6, 9, 0),  services: ['corte'],          clientName: 'Ana Ruiz',      clientPhone: '3777000001', status: 'done' },
  { id: 'p2', professionalId: 1, date: atDaysHour(-6, 17, 0), services: ['corte', 'barba'],  clientName: 'Pedro Lima',    clientPhone: '3777000002', status: 'done' },
  { id: 'p3', professionalId: 2, date: atDaysHour(-5, 9, 40), services: ['color'],           clientName: 'Lucía Paz',     clientPhone: '3777000003', status: 'done' },
  { id: 'p4', professionalId: 1, date: atDaysHour(-5, 17, 40),services: ['corte'],           clientName: 'Diego Suárez',  clientPhone: '3777000004', status: 'noshow' },
  { id: 'p5', professionalId: 2, date: atDaysHour(-4, 10, 20),services: ['corte', 'degrade'],clientName: 'Martín Ibáñez', clientPhone: '3777000005', status: 'done' },
  { id: 'p6', professionalId: 1, date: atDaysHour(-3, 9, 0),  services: ['barba'],           clientName: 'Franco Núñez',  clientPhone: '3777000006', status: 'done' },
  { id: 'p7', professionalId: 1, date: atDaysHour(-2, 18, 0), services: ['corte', 'cejas'],  clientName: 'Bruno Acosta',  clientPhone: '3777000007', status: 'done' },
  { id: 'p8', professionalId: 2, date: atDaysHour(-1, 9, 0),  services: ['degrade'],         clientName: 'Iván Torres',   clientPhone: '3777000008', status: 'noshow' },

  // Hoy
  { id: 'b1', professionalId: 1, date: atDaysHour(0, 9, 0),   services: ['corte', 'barba'],  clientName: 'Juan Pérez',    clientPhone: '3777111111', status: 'pending' },
  { id: 'b2', professionalId: 1, date: atDaysHour(0, 9, 40),  services: ['corte'],           clientName: 'Marcos Gómez',  clientPhone: '3777222222', status: 'pending' },
  { id: 'b3', professionalId: 2, date: atDaysHour(0, 17, 0),  services: ['color'],           clientName: 'Sofía Ríos',    clientPhone: '3777333333', status: 'pending' },

  // Próximos días
  { id: 'b4', professionalId: 1, date: atDaysHour(1, 9, 0),   services: ['corte', 'cejas'],  clientName: 'Lucas Díaz',    clientPhone: '3777444444', status: 'pending' },
  { id: 'b5', professionalId: 2, date: atDaysHour(2, 17, 40), services: ['corte', 'color'],  clientName: 'Nahuel Ortiz',  clientPhone: '3777555555', status: 'pending' }
];