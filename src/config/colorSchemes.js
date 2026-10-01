// Esquemas de color que un negocio puede elegir para su página pública (Landing)
// y para su propia pantalla de alta (wizard "Creá tu negocio").
// Cada uno pisa las variables --neon/--neon-soft/--neon-dim/--neon-hover que ya usan
// Landing.css y Footer.css, así que alcanza con aplicar estas variables en el wrapper
// de la página: el resto del diseño (fondo oscuro, tipografía, layout) no cambia.
export const COLOR_SCHEMES = [
  {
    id: 'mono',
    label: 'Blanco y negro',
    hint: 'Elegante y neutro, el default para negocios nuevos',
    swatch: '#f4f4f4',
    vars: {
      '--neon': '#f4f4f4',
      '--neon-rgb': '244, 244, 244',
      '--neon-soft': 'rgba(244, 244, 244, 0.3)',
      '--neon-dim': 'rgba(244, 244, 244, 0.1)',
      '--neon-hover': '#ffffff'
    },
    /* "Blanco y negro" literalmente se invierte en modo claro: el acento pasa de
       blanco a negro (si no, queda blanco sobre blanco — invisible). Por eso el
       texto que va arriba del acento (--neon-ink) también pasa a blanco acá. */
    lightVars: {
      '--neon': '#1b1c1e',
      '--neon-rgb': '27, 28, 30',
      '--neon-soft': 'rgba(27, 28, 30, 0.28)',
      '--neon-dim': 'rgba(27, 28, 30, 0.1)',
      '--neon-hover': '#000000',
      '--neon-ink': '#ffffff'
    }
  },
  {
    id: 'neon',
    label: 'Verde neón',
    hint: 'Original de TurnosBS',
    swatch: '#b8f14c',
    vars: {
      '--neon': '#b8f14c',
      '--neon-rgb': '184, 241, 76',
      '--neon-soft': 'rgba(184, 241, 76, 0.35)',
      '--neon-dim': 'rgba(184, 241, 76, 0.12)',
      '--neon-hover': '#c8ff5e'
    },
    /* Se probaron varias vueltas con el fondo oscurecido (gris cálido, crema, etc.)
       y el verde lima seguía sin leerse bien como texto plano — es un color muy
       claro, casi tan claro como el blanco, así que ningún fondo "claro" le iba a
       dar contraste real. Richard decidió el enfoque contrario: el fondo vuelve a
       ser blanco (el mismo que los demás temas), y en cambio el VERDE se oscurece
       solo acá, solo en modo claro (en oscuro sigue siendo el lima de siempre). */
    lightVars: {
      '--neon': '#6a9c15',
      '--neon-rgb': '106, 156, 21',
      '--neon-soft': 'rgba(106, 156, 21, 0.3)',
      '--neon-dim': 'rgba(106, 156, 21, 0.12)',
      '--neon-hover': '#588012',
      '--neon-ink': '#ffffff'
    }
  },
  {
    id: 'azul',
    label: 'Azul eléctrico',
    hint: 'Fresco y moderno',
    swatch: '#4cc9f0',
    vars: {
      '--neon': '#4cc9f0',
      '--neon-rgb': '76, 201, 240',
      '--neon-soft': 'rgba(76, 201, 240, 0.35)',
      '--neon-dim': 'rgba(76, 201, 240, 0.12)',
      '--neon-hover': '#7ad9f6'
    },
    /* Contra el fondo blanco de modo claro el celeste original se lava; se oscurece
       un poco solo ahí para que se siga leyendo bien (en oscuro no cambia nada). */
    lightVars: {
      '--neon': '#0f86b3',
      '--neon-rgb': '15, 134, 179',
      '--neon-soft': 'rgba(15, 134, 179, 0.3)',
      '--neon-dim': 'rgba(15, 134, 179, 0.12)',
      '--neon-hover': '#0c6c92',
      '--neon-ink': '#ffffff'
    }
  },
  {
    id: 'violeta',
    label: 'Violeta',
    hint: 'Distinguido, ideal para estética o spa',
    swatch: '#a78bfa',
    vars: {
      '--neon': '#a78bfa',
      '--neon-rgb': '167, 139, 250',
      '--neon-soft': 'rgba(167, 139, 250, 0.35)',
      '--neon-dim': 'rgba(167, 139, 250, 0.12)',
      '--neon-hover': '#bda5fb'
    },
    lightVars: {
      '--neon': '#7c4fe0',
      '--neon-rgb': '124, 79, 224',
      '--neon-soft': 'rgba(124, 79, 224, 0.3)',
      '--neon-dim': 'rgba(124, 79, 224, 0.12)',
      '--neon-hover': '#6a3fcc'
    }
  },
  {
    id: 'dorado',
    label: 'Dorado',
    hint: 'Premium, para un servicio top de gama',
    swatch: '#f2c14c',
    vars: {
      '--neon': '#f2c14c',
      '--neon-rgb': '242, 193, 76',
      '--neon-soft': 'rgba(242, 193, 76, 0.35)',
      '--neon-dim': 'rgba(242, 193, 76, 0.12)',
      '--neon-hover': '#f6d275'
    },
    /* Igual que el azul: el dorado claro casi desaparece sobre blanco, se oscurece
       un poco solo para modo claro. */
    lightVars: {
      '--neon': '#b3820f',
      '--neon-rgb': '179, 130, 15',
      '--neon-soft': 'rgba(179, 130, 15, 0.3)',
      '--neon-dim': 'rgba(179, 130, 15, 0.12)',
      '--neon-hover': '#8f6800'
    }
  },
  {
    id: 'coral',
    label: 'Coral',
    hint: 'Cálido y cercano',
    swatch: '#ff8a65',
    vars: {
      '--neon': '#ff8a65',
      '--neon-rgb': '255, 138, 101',
      '--neon-soft': 'rgba(255, 138, 101, 0.35)',
      '--neon-dim': 'rgba(255, 138, 101, 0.12)',
      '--neon-hover': '#ffa587'
    }
  },
  {
    id: 'rosado',
    label: 'Rosado',
    hint: 'Vibrante, ideal para salones de belleza y uñas',
    swatch: '#ff80d7',
    vars: {
      '--neon': '#ff80d7',
      '--neon-rgb': '255, 128, 215',
      '--neon-soft': 'rgba(255, 128, 215, 0.35)',
      '--neon-dim': 'rgba(255, 128, 215, 0.12)',
      '--neon-hover': '#ff9ade'
    },
    /* Igual que azul/dorado: el rosado clarito se lava contra el fondo blanco de
       modo claro, se oscurece un poco solo ahí (en oscuro queda igual que siempre). */
    lightVars: {
      '--neon': '#c2298f',
      '--neon-rgb': '194, 41, 143',
      '--neon-soft': 'rgba(194, 41, 143, 0.3)',
      '--neon-dim': 'rgba(194, 41, 143, 0.12)',
      '--neon-hover': '#9e1f73',
      '--neon-ink': '#ffffff'
    }
  }
];

export const DEFAULT_COLOR_SCHEME = 'mono';
export const CUSTOM_SCHEME_ID = 'custom';
export const DEFAULT_CUSTOM_COLORS = { primary: '#b8f14c' };

/* ---- Helpers de color, solo para el modo personalizado ---- */
function hexToRgb(hex) {
  const clean = (hex || '').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num) || full.length !== 6) return { r: 184, g: 241, b: 76 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function withAlpha(hex, a) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
function rgbTriplet(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/* Luminancia relativa (fórmula WCAG) para decidir si un color es "claro" u
 * "oscuro" a simple vista, y con eso elegir el color de texto (--neon-ink)
 * que va arriba de un fondo de ese color — por ejemplo el texto de un botón
 * verde-lima pintado con --neon. Sin esto, un color personalizado oscuro
 * (como negro) siempre quedaba con texto negro encima: invisible. */
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const chan = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}
/** Elige negro o blanco como texto/ícono para que se lea bien sobre `hex`. */
function contrastInk(hex) {
  return relativeLuminance(hex) > 0.5 ? '#0a0a0a' : '#ffffff';
}

/** Arma un esquema "en vivo" a partir del color que eligió el negocio.
 *  (Antes eran 2 colores — el segundo no se usaba en ningún lado visible y Richard
 *  pidió sacarlo. Queda solo el principal, más simple.)
 *  --neon-ink se calcula automáticamente según qué tan claro/oscuro es el color
 *  elegido, para que el texto arriba (en botones, chips, etc.) siempre se lea,
 *  incluso si el negocio elige un color bien oscuro como negro. */
export function buildCustomScheme(customColors) {
  const primary = customColors?.primary || DEFAULT_CUSTOM_COLORS.primary;
  return {
    id: CUSTOM_SCHEME_ID,
    label: 'Personalizado',
    hint: 'Tu propio color',
    swatch: primary,
    vars: {
      '--neon': primary,
      '--neon-rgb': rgbTriplet(primary),
      '--neon-soft': withAlpha(primary, 0.35),
      '--neon-dim': withAlpha(primary, 0.12),
      '--neon-hover': lighten(primary, 0.14),
      '--neon-ink': contrastInk(primary)
    }
  };
}

export function getColorScheme(id, customColors) {
  if (id === CUSTOM_SCHEME_ID) return buildCustomScheme(customColors);
  return COLOR_SCHEMES.find((c) => c.id === id) || COLOR_SCHEMES.find((c) => c.id === DEFAULT_COLOR_SCHEME);
}

/** Variables de acento (--neon...) base de un esquema (sin resolver el modo). */
function getAccentVars(schemeId, customColors) {
  return getColorScheme(schemeId, customColors).vars;
}

/* ============================================================
   Modo claro / oscuro (eje independiente del color de acento).
   El acento (--neon...) no cambia; lo que cambia es la base:
   fondo, paneles, texto y el tinte "overlay" que usan bordes y
   fondos de hover sutiles. Igual que Telegram: el mismo azul o
   verde de acento funciona tanto en modo oscuro como en modo claro
   porque la base de abajo se invierte entera, no color por color.
   ============================================================ */
export const DEFAULT_THEME_MODE = 'dark';

/* Base de modo claro: blanco casi puro, neutro, para que funcione bien con
 * cualquier acento. El tono piedra/hueso cálido que pidió Richard es solo para
 * el tema "Verde neón" (ver su lightVars más arriba) — acá queda el default. */
const LIGHT_MODE_VARS = {
  '--black': '#f2f2f0',
  '--panel': '#ffffff',
  '--panel-2': '#ececea',
  '--white': '#17181a',
  '--gray': '#65635d',
  '--gray-dark': '#b8b6b0',
  '--gray-darker': '#dedcd7',
  '--border': '#e2e0da',
  '--danger': '#e0463c',
  /* En claro el "resaltado sutil" se invierte: negro translúcido en vez de blanco */
  '--overlay-rgb': '0, 0, 0'
};

/** Devuelve las variables a pisar para el modo de fondo elegido.
 *  'dark' no pisa nada (usa los valores base de :root, que ya son oscuros). */
export function getThemeModeVars(mode) {
  return mode === 'light' ? LIGHT_MODE_VARS : {};
}

/** Combina el esquema de color (acento) con el modo de fondo (claro/oscuro)
 *  en un solo objeto de variables CSS listo para un style={...} inline.
 *  Orden de aplicación (cada capa pisa a la anterior):
 *   1. acento base del esquema (--neon...)
 *   2. base genérica de modo claro/oscuro (fondo, paneles, texto)
 *   3. ajustes propios del esquema para modo claro (scheme.lightVars) — puede
 *      pisar tanto el acento (ej: oscurecer un celeste clarito) como la base
 *      genérica (ej: el tono piedra/hueso que pidió Richard solo para "neon"),
 *      así un tema puede personalizar cualquiera de los dos sin afectar al resto. */
export function getThemeVars(schemeId, customColors, mode) {
  const scheme = getColorScheme(schemeId, customColors);
  const schemeOverrides = mode === 'light' && scheme.lightVars ? scheme.lightVars : {};
  return {
    ...getAccentVars(schemeId, customColors),
    ...getThemeModeVars(mode),
    ...schemeOverrides
  };
}
