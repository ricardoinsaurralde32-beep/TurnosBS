import { COLOR_SCHEMES, CUSTOM_SCHEME_ID, DEFAULT_CUSTOM_COLORS, buildCustomScheme } from '../config/colorSchemes';
import './ColorSchemePicker.css';

/**
 * Grilla de esquemas de color para elegir el acento de la página pública del negocio.
 * Además de las paletas fijas, incluye una opción "Personalizado" para elegir 2 colores
 * propios (principal + secundario) y una vista previa para ver cómo quedan.
 *
 * Props:
 *  - value: id del esquema elegido ('mono', 'neon', ..., o 'custom')
 *  - customColors: { primary } — solo se usa si value === 'custom'
 *  - onChange(id)
 *  - onCustomColorsChange({ primary })
 *  - themeMode: 'dark' | 'light' — fondo del sitio, eje independiente del acento
 *  - onThemeModeChange(mode) — si no se pasa, no se muestra el selector de fondo
 */
export default function ColorSchemePicker({ value, customColors, onChange, onCustomColorsChange, themeMode, onThemeModeChange }) {
  const isCustom = value === CUSTOM_SCHEME_ID;
  // La vista previa siempre refleja el modo real (arriba), no uno propio — antes
  // tenía sus propios botones "Fondo oscuro/claro" sueltos, iguales en el nombre
  // a los de arriba pero sin conectar a nada, y eso generaba confusión (parecía
  // que el modo claro/oscuro "no cambiaba" al tocarlos).
  const previewBg = themeMode === 'light' ? 'light' : 'dark';
  const colors = customColors || DEFAULT_CUSTOM_COLORS;
  const previewVars = isCustom ? buildCustomScheme(colors).vars : null;

  const setPrimary = (v) => onCustomColorsChange?.({ ...colors, primary: v });

  return (
    <div>
      {onThemeModeChange && (
        <div className="csp-mode-row">
          <span className="csp-mode-label">Fondo del sitio</span>
          <div className="csp-mode-toggle">
            <button
              type="button"
              className={themeMode !== 'light' ? 'active' : ''}
              onClick={() => onThemeModeChange('dark')}
            >
              Oscuro
            </button>
            <button
              type="button"
              className={themeMode === 'light' ? 'active' : ''}
              onClick={() => onThemeModeChange('light')}
            >
              Claro
            </button>
          </div>
        </div>
      )}
      <div className="csp-grid">
        {COLOR_SCHEMES.map((scheme) => (
          <button
            key={scheme.id}
            type="button"
            className={`csp-option ${value === scheme.id ? 'active' : ''}`}
            onClick={() => onChange(scheme.id)}
          >
            <span className="csp-swatch" style={{ backgroundColor: scheme.swatch }} />
            <span className="csp-texts">
              <span className="csp-label">{scheme.label}</span>
              <span className="csp-hint">{scheme.hint}</span>
            </span>
            {value === scheme.id && <span className="csp-check">✓</span>}
          </button>
        ))}

        <button
          type="button"
          className={`csp-option csp-custom-option ${isCustom ? 'active' : ''}`}
          onClick={() => onChange(CUSTOM_SCHEME_ID)}
        >
          <span className="csp-swatch" style={{ backgroundColor: colors.primary }} />
          <span className="csp-texts">
            <span className="csp-label">Personalizado</span>
            <span className="csp-hint">Elegí tu propio color</span>
          </span>
          {isCustom && <span className="csp-check">✓</span>}
        </button>
      </div>

      {isCustom && (
        <div className="csp-custom-panel">
          <div className="csp-custom-fields">
            <label className="csp-color-field">
              <span>Tu color</span>
              <span className="csp-color-input">
                <input type="color" value={colors.primary} onChange={(e) => setPrimary(e.target.value)} />
                <span>{colors.primary}</span>
              </span>
            </label>
          </div>

          <div className="csp-preview-head">
            <span>Vista previa ({themeMode === 'light' ? 'fondo claro' : 'fondo oscuro'})</span>
          </div>

          <div className={`csp-preview csp-preview-${previewBg}`} style={previewVars}>
            <span className="csp-preview-title">Así se ven tus colores</span>
            <span className="csp-preview-accent-text">Texto y links destacados</span>
            <button type="button" className="csp-preview-btn">Reservar turno</button>
          </div>
        </div>
      )}
    </div>
  );
}
