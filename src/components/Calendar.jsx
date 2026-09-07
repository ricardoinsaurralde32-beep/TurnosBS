import { IconChevronLeft, IconChevronRight } from './Icons';
import './Calendar.css';

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

export default function Calendar({
  month,
  onPrevMonth,
  onNextMonth,
  canPrev = true,
  canNext = true,
  selectedDate,
  onSelectDate,
  getDayState
}) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);

  const today = new Date();
  const isToday = (d) =>
    d === today.getDate() && monthIndex === today.getMonth() && year === today.getFullYear();

  const isSelected = (d) =>
    selectedDate &&
    d === selectedDate.getDate() &&
    monthIndex === selectedDate.getMonth() &&
    year === selectedDate.getFullYear();

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          className="calendar-nav"
          onClick={onPrevMonth}
          disabled={!canPrev}
          aria-label="Mes anterior"
        >
          <IconChevronLeft />
        </button>

        <span className="calendar-month">{MONTHS[monthIndex]} {year}</span>

        <button
          className="calendar-nav"
          onClick={onNextMonth}
          disabled={!canNext}
          aria-label="Mes siguiente"
        >
          <IconChevronRight />
        </button>
      </div>

      <div className="calendar-weekdays">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>

      <div className="calendar-grid">
        {cells.map((day, i) => {
          if (day === null) return <span key={`empty-${i}`} className="calendar-cell empty" />;

          const date = new Date(year, monthIndex, day);
          const state = getDayState(date);
          const disabled = state !== 'available';

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onSelectDate(date)}
              className={[
                'calendar-cell',
                `is-${state}`,
                isSelected(day) ? 'is-selected' : '',
                isToday(day) ? 'is-today' : ''
              ].join(' ').trim()}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span><i className="dot dot-free" /> Disponible</span>
        <span><i className="dot dot-full" /> Sin turnos</span>
      </div>
    </div>
  );
}