// Money overview (#/geld/YYYY): revenue, commission, costs and net per month, per channel and per product,
// plus a CSV of the year's bookings for the accountant (without names, contact details or notes).
import { CHANNELS } from '../domain/agenda';
import { bookingsCsv, moneyOverview, type MonthRow } from '../domain/pricing';
import { useAppState } from '../state/store';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const pct = (r: MonthRow) => (r.capacity ? `${Math.round((r.guests / r.capacity) * 100)}%` : '—');
const monthName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleDateString('nl-NL', { month: 'long' });

export function Finance({ year: param }: { year?: string }) {
  const { products, departures, bookings } = useAppState();
  const year = param && /^\d{4}$/.test(param) ? Number(param) : new Date().getFullYear();
  const o = moneyOverview(year, products, departures, bookings);
  const active = o.months.filter((m) => m.departures > 0);

  function download() {
    const blob = new Blob([bookingsCsv(year, products, departures, bookings)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boekingen-${year}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <main class="page page--wide finance">
      <a href="#/agenda" class="back">← Agenda</a>
      <div class="agenda__head">
        <h1 class="agenda__title">Financiën {year}</h1>
        <nav class="seg" aria-label="Jaar kiezen">
          <a href={`#/geld/${year - 1}`} aria-label="Vorig jaar">‹</a>
          <a href={`#/geld/${new Date().getFullYear()}`} aria-current={year === new Date().getFullYear() ? 'date' : undefined}>Dit jaar</a>
          <a href={`#/geld/${year + 1}`} aria-label="Volgend jaar">›</a>
        </nav>
        <span class="agenda__links">
          <button class="btn btn--ghost" onClick={download} disabled={!o.total.departures}>CSV voor de boekhouding</button>
        </span>
      </div>

      <div class="tiles tiles--4" aria-label="Totaal">
        <div class="tile"><span class="tile__label">Omzet</span><span class="tile__value">{eur.format(o.total.gross)}</span></div>
        <div class="tile"><span class="tile__label">Commissie</span><span class="tile__value">{eur.format(o.total.commission)}</span></div>
        <div class="tile"><span class="tile__label">Kosten</span><span class="tile__value">{eur.format(o.total.costs)}</span></div>
        <div class={`tile tile--net ${o.total.net < 0 ? 'is-negative' : ''}`}><span class="tile__label">Netto</span><span class="tile__value">{eur.format(o.total.net)}</span></div>
      </div>
      <p class="meta">{o.total.departures} vertrekken · {o.total.guests} gasten · bezetting {pct(o.total)}. Geannuleerde vertrekken en boekingen tellen niet mee.</p>

      {active.length ? (
        <>
          <h2>Per maand</h2>
          <div class="table-wrap">
            <table class="money-table">
              <thead><tr><th>Maand</th><th>Vertrekken</th><th>Gasten</th><th>Bezetting</th><th>Omzet</th><th>Commissie</th><th>Kosten</th><th>Netto</th></tr></thead>
              <tbody>
                {active.map((m) => (
                  <tr key={m.month}>
                    <th scope="row"><a href={`#/agenda/${m.month}`}>{monthName(m.month)}</a></th>
                    <td>{m.departures}</td><td>{m.guests}</td><td>{pct(m)}</td>
                    <td>{eur.format(m.gross)}</td><td>{eur.format(m.commission)}</td><td>{eur.format(m.costs)}</td>
                    <td class={m.net < 0 ? 'is-negative' : ''}>{eur.format(m.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div class="finance__split">
            <section>
              <h2>Per kanaal</h2>
              <div class="table-wrap">
                <table class="money-table">
                  <thead><tr><th>Kanaal</th><th>Boekingen</th><th>Gasten</th><th>Omzet</th><th>Commissie</th></tr></thead>
                  <tbody>
                    {o.byChannel.map((c) => (
                      <tr key={c.channel}><th scope="row">{CHANNELS[c.channel]}</th><td>{c.bookings}</td><td>{c.guests}</td><td>{eur.format(c.gross)}</td><td>{eur.format(c.commission)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2>Per touraanbod</h2>
              <div class="table-wrap">
                <table class="money-table">
                  <thead><tr><th>Touraanbod</th><th>Vertrekken</th><th>Gasten</th><th>Netto</th></tr></thead>
                  <tbody>
                    {o.byProduct.map((p) => (
                      <tr key={p.productId}><th scope="row">{p.name}</th><td>{p.departures}</td><td>{p.guests}</td><td class={p.net < 0 ? 'is-negative' : ''}>{eur.format(p.net)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      ) : <p class="hint">Geen vertrekken in {year}.</p>}
      <p class="hint">Kosten komen uit het huidige prijsprofiel van elk touraanbod; omzet en commissie uit de boekingen zelf. De CSV bevat geen namen, contactgegevens of notities. Belastingregels: vraag een boekhouder.</p>
    </main>
  );
}
