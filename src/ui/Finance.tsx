// Money overview (#/geld/YYYY): revenue, commission, costs, general costs and profit per month, per channel and per
// product, who still has to pay, and CSVs for the accountant (without names, contact details or notes).
import { useState } from 'preact/hooks';
import { CHANNELS, isoDate } from '../domain/agenda';
import { bookingsCsv, createExpense, EXPENSE_CATEGORIES, expensesCsv, gelToEur, moneyOverview, openPayments, type MonthRow } from '../domain/pricing';
import type { Expense, ExpenseCategory } from '../domain/types';
import { deleteRecord, saveRecord, useAppState } from '../state/store';
import { ConfirmDelete } from './Agenda';
import { GelFields } from './DepartureBits';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const gelFormat = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 });
const num = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
const pct = (r: MonthRow) => (r.capacity ? `${Math.round((r.guests / r.capacity) * 100)}%` : '—');
const monthName = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleDateString('nl-NL', { month: 'long' });
const shortDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
};

function download(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExpenseForm({ year, onDone }: { year: number; onDone?: () => void }) {
  const today = isoDate(new Date());
  const [e, setE] = useState<Expense>(() => createExpense(today.startsWith(`${year}-`) ? today : `${year}-01-01`));
  const patch = (p: Partial<Expense>) => setE((x) => ({ ...x, ...p }));
  async function save(ev: Event) {
    ev.preventDefault();
    if (!e.amount) return;
    await saveRecord('expenses', { ...e, description: e.description.trim() });
    setE(createExpense(e.date));
    onDone?.();
  }
  return (
    <form class="expense-form" onSubmit={save}>
      <label class="narrow">Datum<input type="date" value={e.date} onChange={(x) => x.currentTarget.value && patch({ date: x.currentTarget.value })} /></label>
      <label class="narrow">Soort
        <select value={e.category} onChange={(x) => patch({ category: x.currentTarget.value as ExpenseCategory })}>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <label class="grow">Omschrijving<input value={e.description} onInput={(x) => patch({ description: x.currentTarget.value })} /></label>
      {!e.gel && <label class="narrow">Bedrag (€)<input inputMode="decimal" value={String(e.amount).replace('.', ',')} onChange={(x) => patch({ amount: num(x.currentTarget.value) })} /></label>}
      <GelFields gel={e.gel} label="In lari" onChange={(gel) => patch(gel ? { gel, amount: gelToEur(gel) } : { gel: undefined })} />
      <button class="btn btn--primary" type="submit" disabled={!e.amount}>Toevoegen</button>
    </form>
  );
}

export function Finance({ year: param }: { year?: string }) {
  const { products, departures, bookings, expenses } = useAppState();
  const year = param && /^\d{4}$/.test(param) ? Number(param) : new Date().getFullYear();
  const o = moneyOverview(year, products, departures, bookings, expenses);
  const active = o.months.filter((m) => m.departures > 0 || m.expenses > 0);
  const open = openPayments(products, departures, bookings);
  const yearCosts = expenses.filter((e) => !e.deleted && e.date.startsWith(`${year}-`)).sort((a, b) => b.date.localeCompare(a.date));

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
          <button class="btn btn--ghost" onClick={() => download(`boekingen-${year}.csv`, bookingsCsv(year, products, departures, bookings))} disabled={!o.total.departures}>CSV boekingen</button>
          <button class="btn btn--ghost" onClick={() => download(`kosten-${year}.csv`, expensesCsv(year, expenses))} disabled={!yearCosts.length}>CSV kosten</button>
        </span>
      </div>

      <div class="tiles tiles--5" aria-label="Totaal">
        <div class="tile"><span class="tile__label">Omzet</span><span class="tile__value">{eur.format(o.total.gross)}</span></div>
        <div class="tile"><span class="tile__label">Commissie</span><span class="tile__value">{eur.format(o.total.commission)}</span></div>
        <div class="tile"><span class="tile__label">Kosten tours</span><span class="tile__value">{eur.format(o.total.costs)}</span></div>
        <div class="tile"><span class="tile__label">Algemene kosten</span><span class="tile__value">{eur.format(o.total.expenses)}</span></div>
        <div class={`tile tile--net ${o.total.profit < 0 ? 'is-negative' : ''}`}><span class="tile__label">Winst</span><span class="tile__value">{eur.format(o.total.profit)}</span></div>
      </div>
      <p class="meta">
        {o.total.departures} vertrekken · {o.total.guests} gasten · bezetting {pct(o.total)}.
        {(o.gelIn > 0 || o.gelOut > 0) && ` In lari: ₾ ${gelFormat.format(o.gelIn)} ontvangen, ₾ ${gelFormat.format(o.gelOut)} uitgegeven.`}
        {' '}Geannuleerde vertrekken tellen niet mee.
      </p>

      {open.length > 0 && (
        <>
          <h2>Nog te betalen <span class="meta">{eur.format(open.reduce((n, p) => n + p.amount, 0))}</span></h2>
          <div class="table-wrap">
            <table class="money-table">
              <thead><tr><th>Wie</th><th>Tour</th><th>Datum</th><th>Bedrag</th></tr></thead>
              <tbody>
                {open.map((p) => (
                  <tr key={p.booking.id}>
                    <th scope="row"><a href={`#/vertrek/${p.departure.id}`}>{p.booking.anonymizedAt ? 'Gegevens gewist' : p.booking.leadName || 'Geen naam'}</a></th>
                    <td>{p.productName}</td><td>{shortDay(p.departure.date)}</td><td>{eur.format(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {active.length > 0 && (
        <>
          <h2>Per maand</h2>
          <div class="table-wrap">
            <table class="money-table">
              <thead><tr><th>Maand</th><th>Vertrekken</th><th>Gasten</th><th>Bezetting</th><th>Omzet</th><th>Commissie</th><th>Kosten tours</th><th>Algemeen</th><th>Winst</th></tr></thead>
              <tbody>
                {active.map((m) => (
                  <tr key={m.month}>
                    <th scope="row"><a href={`#/agenda/${m.month}`}>{monthName(m.month)}</a></th>
                    <td>{m.departures}</td><td>{m.guests}</td><td>{pct(m)}</td>
                    <td>{eur.format(m.gross)}</td><td>{eur.format(m.commission)}</td><td>{eur.format(m.costs)}</td><td>{eur.format(m.expenses)}</td>
                    <td class={m.profit < 0 ? 'is-negative' : ''}>{eur.format(m.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {o.total.departures > 0 && (
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
      )}

      <h2>Algemene kosten</h2>
      <p class="hint">Kosten die niet bij één tour horen, zoals verzekering, telefoon of reclame.</p>
      <ExpenseForm year={year} />
      {yearCosts.length > 0 && (
        <ul class="todo-list">
          {yearCosts.map((e) => (
            <li key={e.id}>
              <span>{shortDay(e.date)} · {EXPENSE_CATEGORIES[e.category]}{e.description ? ` · ${e.description}` : ''}</span>
              <span>
                {eur.format(e.amount)}{e.gel ? ` (₾ ${gelFormat.format(e.gel.amount)})` : ''}{' '}
                <ConfirmDelete small label="Verwijderen" question="Deze kosten verwijderen?" onConfirm={() => void deleteRecord('expenses', e)} />
              </span>
            </li>
          ))}
        </ul>
      )}
      <p class="hint">Kosten tours komen uit het huidige prijsprofiel van elk touraanbod; omzet en commissie uit de boekingen zelf. De CSV's bevatten geen namen, contactgegevens of notities. Vraag een boekhouder naar de belastingregels.</p>
    </main>
  );
}
