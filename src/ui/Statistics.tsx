// Statistics (#/cijfers/YYYY): how full tours were, which months and start times work, how early guests book.
import { isoDate } from '../domain/agenda';
import { statistics, type OccupancyRow } from '../domain/statistics';
import { useAppState } from '../state/store';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const shortDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

function OccupancyTable({ title, first, rows }: { title: string; first: string; rows: OccupancyRow[] }) {
  return (
    <section>
      <h2>{title}</h2>
      <div class="table-wrap">
        <table class="money-table">
          <thead><tr><th>{first}</th><th>Vertrekken</th><th>Gasten</th><th>Bezetting</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.key}><th scope="row">{r.label}</th><td>{r.departures}</td><td>{r.guests}</td><td>{pct(r.occupancy)}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function StatisticsPage({ year: param }: { year?: string }) {
  const { products, departures, bookings } = useAppState();
  const today = isoDate(new Date());
  const thisYear = Number(today.slice(0, 4));
  const year = param && /^\d{4}$/.test(param) ? Number(param) : thisYear;
  const s = statistics(year, products, departures, bookings, today);
  const hasTours = s.byProduct.length > 0;

  return (
    <main class="page page--wide finance">
      <a href="#/agenda" class="back">← Agenda</a>
      <div class="agenda__head">
        <h1 class="agenda__title">Cijfers {year}</h1>
        <nav class="seg" aria-label="Jaar kiezen">
          <a href={`#/cijfers/${year - 1}`} aria-label="Vorig jaar">‹</a>
          <a href={`#/cijfers/${thisYear}`} aria-current={year === thisYear ? 'date' : undefined}>Dit jaar</a>
          <a href={`#/cijfers/${year + 1}`} aria-label="Volgend jaar">›</a>
        </nav>
      </div>
      <div class="tiles tiles--4" aria-label="Samenvatting">
        <div class="tile"><span class="tile__label">Boekt meestal</span><span class="tile__value">{s.leadTime.median === null ? '—' : `${s.leadTime.median} ${s.leadTime.median === 1 ? 'dag' : 'dagen'} vooraf`}</span></div>
        <div class="tile"><span class="tile__label">No-shows</span><span class="tile__value">{s.noShows.expected ? pct(s.noShows.guests / s.noShows.expected) : '—'}</span></div>
        <div class="tile"><span class="tile__label">Gemiddelde beoordeling</span><span class="tile__value">{s.feedback.averageStars === null ? '—' : `${s.feedback.averageStars.toFixed(1).replace('.', ',')} van 5`}</span></div>
        <div class="tile"><span class="tile__label">Terugblikken</span><span class="tile__value">{s.feedback.count}</span></div>
      </div>
      {hasTours ? (
        <div class="finance__split">
          <OccupancyTable title="Per touraanbod" first="Touraanbod" rows={s.byProduct} />
          <OccupancyTable title="Per starttijd" first="Starttijd" rows={s.byStartTime} />
          <OccupancyTable title="Per maand" first="Maand" rows={s.byMonth} />
        </div>
      ) : <p class="hint">Nog geen afgelopen tours in {year}.</p>}
      {s.leadTime.counted > 0 && (
        <section>
          <h2>Hoe vroeg gasten boeken</h2>
          <div class="table-wrap">
            <table class="money-table">
              <thead><tr><th>Voor de tour</th><th>Boekingen</th></tr></thead>
              <tbody>{s.leadTime.buckets.map((b) => <tr key={b.label}><th scope="row">{b.label}</th><td>{b.bookings}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
      {s.feedback.improvements.length > 0 && (
        <section>
          <h2>Wat beter kan</h2>
          <ul class="todo-list">
            {s.feedback.improvements.map((f) => <li key={f.id}><a href={`#/vertrek/${f.departureId}`}>{f.text}</a><span class="meta">{shortDay(f.date)}</span></li>)}
          </ul>
        </section>
      )}
      <p class="hint">Bezetting telt alleen tours tot en met gisteren. Hoe vroeg gasten boeken, gaat uit van de dag waarop de boeking is ingevoerd; dat kan later zijn dan de echte boeking. Walk-ins tellen daar niet mee.</p>
    </main>
  );
}
