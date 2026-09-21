// TODO: esto después vendrá de Supabase (panel de administración)

export const business = {
  name: 'Barber Studio',
  tagline: '¡Un espacio donde la cultura se encuentra, se expresa y se transforma!',
  logo: '/images/logo-barber-studio.png',

  /* ---------- Ubicación ---------- */
  address: 'Juan Esteban Martínez 133',
  addressDetail: 'Entre 9 de Julio y Corrientes',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Juan+Esteban+Martinez+133,+Goya,+Corrientes',
  mapEmbedUrl: 'https://www.google.com/maps?q=Juan+Esteban+Martinez+133,+Goya,+Corrientes&output=embed',
  streetViewUrl: 'https://www.google.com/maps/@-29.1434278,-59.2590096,3a,75y,210.36h,92.53t/data=!3m7!1e1!3m5!1sTM4YNn16w38QZnM3BfJyQg!2e0!6shttps:%2F%2Fstreetviewpixels-pa.googleapis.com%2Fv1%2Fthumbnail%3Fcb_client%3Dmaps_sv.tactile%26w%3D900%26h%3D600%26pitch%3D-2.5317360099937076%26panoid%3DTM4YNn16w38QZnM3BfJyQg%26yaw%3D210.36210470667706!7i16384!8i8192',

  // TODO: fotos GENERALES del local (exterior, sala de espera, zonas comunes).
  // Compartidas por todos los profesionales. Opcional: si el negocio no tiene
  // sala de espera, dejá acá solo la de afuera, o vaciá el array entero [].
  placePhotos: [
    { src: '/images/Omar.jpeg', caption: 'Así nos vas a encontrar' },
    { src: '/images/Richard.jpeg', caption: 'Sala de espera' }
  ],

  /* ---------- Redes ---------- */
  socials: [
    { type: 'instagram', label: '@barber_studio14', url: 'https://instagram.com/barber_studio14' },
    { type: 'whatsapp',  label: '3777 29-0774',    url: 'https://wa.me/5493777290774' }
  ],

  platform: { name: 'TurnosBS', url: 'https://turnosbs.com.ar' },

  policyNotice: 'Si no asistís sin avisar, deberás abonar el 50% del servicio. El número de celular es obligatorio para confirmar tu turno.',

  features: {
    referencePhoto: true
  },

  minHoursAhead: 8,
  slotMinutes: 40,

  schedule: {
    0: [],
    1: [['09:00', '12:00'], ['17:00', '21:00']],
    2: [['09:00', '12:00'], ['17:00', '21:00']],
    3: [['09:00', '12:00'], ['17:00', '21:00']],
    4: [['09:00', '12:00'], ['17:00', '21:00']],
    5: [['09:00', '12:00'], ['16:00', '21:00']],
    6: [['09:00', '12:00'], ['16:00', '21:00']]
  },

  hoursText: [
    'Lunes a jueves · 09:00 a 12:00 y 17:00 a 21:00',
    'Viernes y sábado · 09:00 a 12:00 y 16:00 a 21:00',
    'Domingo · Cerrado'
  ],

  services: [
    { id: 'corte',   label: 'Corte general' },
    { id: 'degrade', label: 'Degradé' },
    { id: 'barba',   label: 'Barba' },
    { id: 'cejas',   label: 'Cejas' },
    { id: 'color',   label: 'Color' }
  ],

  professionals: [
    {
      id: 1,
      slug: 'richard',
      name: 'Richard',
      role: 'Dueño',
      photo: '/images/Richard.jpeg',
      description: 'Profesional en cortes generales, degradé, barba, cejas y cualquier tipo de estilo de corte',
      services: ['corte', 'degrade', 'barba', 'cejas'],
      socials: [
        { type: 'instagram', label: '@barber_studio14', url: 'https://instagram.com/barber_studio14' },
        { type: 'whatsapp',  label: 'WhatsApp', url: 'https://wa.me/5493777290774' }
      ],
      // TODO: fotos del RINCÓN de Richard. Opcional, propias de él.
      workspacePhotos: [
        { src: '/images/foto-local.jpeg', caption: 'El espacio de Richard' }
      ]
    },
    {
      id: 2,
      slug: 'omar',
      name: 'Omar',
      role: 'Barbero',
      photo: '/images/Omar.jpeg',
      description: 'Profesional en cortes generales, degradé, barba, cejas, diseños en cortes y color en cabello',
      services: ['corte', 'degrade', 'barba', 'cejas', 'color'],
      socials: [
        { type: 'instagram', label: '@omar11y11', url: 'https://instagram.com/omar11y11' },
        { type: 'whatsapp',  label: 'WhatsApp', url: 'https://wa.me/5493777276428' }
      ],
      // TODO: fotos del RINCÓN de Omar. Todavía sin cargar: mientras esté
      // vacío, no aparece nada de él en "El local" y no rompe nada.
      workspacePhotos: []
    }
  ],

  bookedSlots: {
    richard: {},
    omar: {}
  }
};