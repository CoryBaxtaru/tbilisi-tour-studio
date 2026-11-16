// The tour products (#/aanbod, #/aanbod/<id>): what is sold, for how much, and the text for the booking channels.
import { useEffect, useState } from 'preact/hooks';
import { CHANNELS, createProduct, isoDate } from '../domain/agenda';
import { meetingPointElsewhere, productFromTour, tourMinutes } from '../domain/quickBooking';
import { buildProductSheet } from '../domain/productSheet';
import { commissionRate, hasPrices, pricingOf, suggestedPrice } from '../domain/pricing';
import type { BookingChannel, PriceProfile, TourProduct } from '../domain/types';
import { deleteRecord, saveRecord, useAppState } from '../state/store';
import { navigate } from './router';
import { copyText } from './clipboard';
import { remember } from './QuickBooking';
import { eur, num, dec, ConfirmDelete } from './AgendaBits';

// ---- Tour products ----

export function Products() {
  const { products, departures } = useAppState();
  const list = products.filter((p) => !p.deleted).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'nl'));
  const today = isoDate(new Date());
  const add = () => navigate('/aanbod/nieuw');
  return (
    <main class="page">
      <a href="#/agenda" class="back">← Agenda</a>
      <div class="page__head">
        <h1>Touraanbod</h1>
        <button class="btn btn--primary" onClick={add}>Nieuw touraanbod</button>
      </div>
      <p class="hint">Wat gasten boeken: naam, duur, groepsgrootte en verzamelpunt. Vertrekken plan je in de agenda.</p>
      {list.length ? (
        <ul class="tour-list">
          {list.map((p) => {
            const upcoming = departures.filter((d) => d.productId === p.id && !d.deleted && d.date >= today).length;
            return (
              <li key={p.id} class="tour-row">
                <div class="tour-row__main">
                  <a class="tour-row__title" href={`#/aanbod/${p.id}`}>{p.name}</a>
                  <span class="meta">{p.durationMin} min · {p.minGuests}–{p.maxGuests} gasten · {priceSummary(pricingOf(p))} · {upcoming} komende vertrek(ken){p.active ? '' : ' · niet actief'}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : <div class="empty"><h2>Nog geen touraanbod</h2><p>Maak een touraanbod aan, bijvoorbeeld "Oude stad in het Nederlands", en plan daarna vertrekken in de agenda.</p></div>}
    </main>
  );
}

export function ProductPage({ id }: { id: string }) {
  const { products, tours, landmarks } = useAppState();
  const isNew = id === 'nieuw';
  const saved = isNew ? undefined : products.find((p) => p.id === id && !p.deleted);
  const [p, setP] = useState<TourProduct | undefined>(() => (isNew ? createProduct() : saved));
  const [msg, setMsg] = useState('');
  const dirty = !!p && (isNew || JSON.stringify(p) !== JSON.stringify(saved));
  // Closing the tab with unsaved changes asks first; moving inside the app keeps the bar below in view.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener('beforeunload', warn);
    return () => removeEventListener('beforeunload', warn);
  }, [dirty]);
  if ((!isNew && !saved) || !p) return <main class="page"><p>Touraanbod niet gevonden. <a href="#/aanbod">Terug</a></p></main>;
  const patch = (x: Partial<TourProduct>) => { setMsg(''); setP((cur) => (cur ? { ...cur, ...x } : cur)); };
  const tour = tours.find((t) => t.id === p.tourId && !t.deleted);
  const tourMin = tourMinutes(tour);
  const firstStop = tour?.stops[0] ? landmarks.find((l) => l.id === tour.stops[0].landmarkId)?.name : undefined;
  async function save(e: Event) {
    e.preventDefault();
    const minGuests = Math.min(p!.minGuests, p!.maxGuests);
    const next = { ...p!, name: p!.name.trim() || 'Naamloos touraanbod', minGuests };
    await saveRecord('products', next);
    setP(next);
    setMsg('Opgeslagen.');
    if (isNew) {
      remember('product', next.id);
      navigate(`/aanbod/${next.id}`);
    }
  }
  async function remove() {
    await deleteRecord('products', saved!);
    navigate('/aanbod');
  }
  return (
    <main class="page">
      <a href="#/aanbod" class="back">← Touraanbod</a>
      <form class="product-form" onSubmit={save}>
        <label>Naam<input class="title-input" value={p.name} onInput={(e) => patch({ name: e.currentTarget.value })} /></label>
        <div class="row">
          <label>Gebaseerd op tour
            <select value={p.tourId ?? ''} onChange={(e) => patch(productFromTour(p, tours.find((t) => t.id === e.currentTarget.value && !t.deleted), 'Nieuw touraanbod'))}>
              <option value="">—</option>
              {tours.filter((t) => !t.deleted).map((t) => <option key={t.id} value={t.id}>{t.title || 'Naamloze tour'}</option>)}
            </select>
          </label>
          <label class="narrow">Duur (min)<input type="number" min={15} step={15} value={p.durationMin} onInput={(e) => patch({ durationMin: num(e.currentTarget.value) })} /></label>
          <label class="narrow">Taal<input value="Nederlands" disabled /></label>
        </div>
        {tourMin !== null && tourMin !== p.durationMin && (
          <p class="hint hint--warn">De tour zelf duurt ongeveer {tourMin} min (lopen, vertellen en pauzes). Gasten krijgen {p.durationMin} min te horen.{' '}
            <button type="button" class="btn btn--small" onClick={() => patch({ durationMin: tourMin })}>{tourMin} min overnemen</button></p>
        )}
        <div class="row">
          <label class="narrow">Max. gasten<input type="number" min={1} value={p.maxGuests} onInput={(e) => patch({ maxGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="narrow">Min. gasten<input type="number" min={1} value={p.minGuests} onInput={(e) => patch({ minGuests: Math.max(1, num(e.currentTarget.value)) })} /></label>
          <label class="check"><input type="checkbox" checked={p.active} onChange={(e) => patch({ active: e.currentTarget.checked })} />Actief (te plannen)</label>
        </div>
        <details class="form-section" open>
          <summary>Voor gasten</summary>
          <div class="form-section__body">
        <label>Verzamelpunt<textarea rows={2} value={p.meetingPoint} placeholder="Bijv. bij de klokkentoren van het Gabriadze-theater" onInput={(e) => patch({ meetingPoint: e.currentTarget.value })} /></label>
        {meetingPointElsewhere(p.meetingPoint, firstStop) && (
          <p class="hint hint--warn">De tour begint bij {firstStop}. Ligt het verzamelpunt daar niet, plan dan de wandeling naar de eerste stop in, of maak het verzamelpunt de eerste stop van de tour.</p>
        )}
        <label>Link naar het verzamelpunt op de kaart<input inputMode="url" value={p.meetingMapUrl ?? ''} placeholder="https://..." onInput={(e) => patch({ meetingMapUrl: e.currentTarget.value })} /></label>
        <label>Inbegrepen<textarea rows={2} value={p.included} onInput={(e) => patch({ included: e.currentTarget.value })} /></label>
        <label>Wat moeten gasten meenemen?<input value={p.bring ?? ''} placeholder="Bijv. goede schoenen en water" onInput={(e) => patch({ bring: e.currentTarget.value })} /></label>
        <label>Link om een review te schrijven<input inputMode="url" value={p.reviewUrl ?? ''} placeholder="https://..." onInput={(e) => patch({ reviewUrl: e.currentTarget.value })} /></label>
          </div>
        </details>
        <details class="form-section" open>
          <summary>Prijzen en kosten</summary>
          <div class="form-section__body">
        <PriceFields pricing={pricingOf(p)} onChange={(pricing) => patch({ pricing })} />
          </div>
        </details>
        <details class="form-section">
          <summary>Tekst voor GetYourGuide of een website{buildProductSheet(p).missing.length > 0 && <span class="meta"> · nog in te vullen: {buildProductSheet(p).missing.length}</span>}</summary>
          <div class="form-section__body">
          <label>Omschrijving<textarea rows={4} value={p.description ?? ''} onInput={(e) => patch({ description: e.currentTarget.value })} /></label>
          <label>Hoogtepunten (één per regel)<textarea rows={4} value={p.highlights ?? ''} onInput={(e) => patch({ highlights: e.currentTarget.value })} /></label>
          <label>Annuleringsvoorwaarden<textarea rows={2} value={p.cancellationTerms ?? ''} onInput={(e) => patch({ cancellationTerms: e.currentTarget.value })} /></label>
          <SheetPreview product={p} />
          </div>
        </details>
        <details class="form-section">
          <summary>Plan bij slecht weer</summary>
          <div class="form-section__body">
          <label>Wat doe je dan?<textarea rows={2} value={p.badWeatherPlan ?? ''} placeholder="Bijv. korter lopen, schuilen op een plek die je kent, de tour verzetten" onInput={(e) => patch({ badWeatherPlan: e.currentTarget.value })} /></label>
          <label>Andere tour bij slecht weer
            <select value={p.badWeatherTourId ?? ''} onChange={(e) => patch({ badWeatherTourId: e.currentTarget.value || null })}>
              <option value="">—</option>
              {tours.filter((t) => !t.deleted).map((t) => <option key={t.id} value={t.id}>{t.title || 'Naamloze tour'}</option>)}
            </select>
          </label>
          </div>
        </details>
        <details class="form-section">
          <summary>Eigen notities</summary>
          <div class="form-section__body">
        <label>Notities<textarea rows={2} value={p.notes} onInput={(e) => patch({ notes: e.currentTarget.value })} /></label>
          </div>
        </details>
        <div class={`save-bar ${dirty ? 'is-dirty' : ''}`}>
          <button class="btn btn--primary" type="submit">{isNew ? 'Touraanbod opslaan' : 'Opslaan'}</button>
          {dirty ? <span class="meta">{isNew ? 'Nog niet opgeslagen.' : 'Niet opgeslagen wijzigingen.'}</span> : msg && <span class="status status--ok">{msg}</span>}
          {isNew && <a class="btn btn--ghost" href="#/aanbod">Annuleren</a>}
        </div>
      </form>
      {!isNew && <details class="danger-zone">
        <summary>Touraanbod verwijderen</summary>
        <ConfirmDelete label="Touraanbod verwijderen" question="Dit touraanbod verwijderen? Bestaande vertrekken blijven in de agenda staan."
          onConfirm={() => void remove()} />
      </details>}
    </main>
  );
}

/** The product sheet as ready text. Without written highlights the stops of the linked tour are used. */
function SheetPreview({ product }: { product: TourProduct }) {
  const { tours, landmarks } = useAppState();
  const [state, setState] = useState<'' | 'ok' | 'mislukt'>('');
  const tour = tours.find((t) => t.id === product.tourId && !t.deleted);
  const stops = (tour?.stops ?? []).flatMap((s) => landmarks.find((l) => l.id === s.landmarkId)?.name ?? []);
  const sheet = buildProductSheet(product, stops);
  return (
    <details>
      <summary>Bekijk de tekst</summary>
      <textarea class="sheet-text" rows={14} readOnly value={sheet.text} />
      {sheet.missing.length > 0 && <p class="hint hint--warn">Nog niet ingevuld: {sheet.missing.join(', ')}.</p>}
      <div class="claim__actions">
        <button type="button" class="btn" onClick={() => void copyText(sheet.text).then((ok) => setState(ok ? 'ok' : 'mislukt'))}>Kopiëren</button>
        {state === 'ok' && <span class="status status--ok">Gekopieerd.</span>}
        {state === 'mislukt' && <span class="hint hint--warn">Kopiëren lukte niet; selecteer de tekst zelf.</span>}
      </div>
    </details>
  );
}

function priceSummary(pr: PriceProfile): string {
  if (!hasPrices(pr)) return 'geen prijzen';
  return pr.kind === 'prive' ? `privé ${eur.format(pr.privateBase)}` : `${eur.format(pr.adult)} p.p.`;
}

type MoneyKey = 'adult' | 'child' | 'infant' | 'privateBase' | 'privateExtra' | 'costPerGuest' | 'fixedCost';

/** Price profile on the product page. Amounts are the guide's own; the app ships none. */
function PriceFields({ pricing: pr, onChange }: { pricing: PriceProfile; onChange: (p: PriceProfile) => void }) {
  const set = (x: Partial<PriceProfile>) => onChange({ ...pr, ...x });
  const money = (label: string, key: MoneyKey) => (
    <label class="narrow">{label}<input inputMode="decimal" value={dec(pr[key])} onChange={(e) => set({ [key]: num(e.currentTarget.value) })} /></label>
  );
  const channels = (Object.keys(CHANNELS) as BookingChannel[]).filter((c) => c !== 'direct');
  const example = { adults: 2, children: 0, infants: 0 };
  const direct = suggestedPrice(pr, 'direct', example);
  const withCommission = channels.filter((c) => commissionRate(pr, c) > 0);
  return (
    <div class="price-fields">
      <div class="seg seg--choice" role="radiogroup" aria-label="Soort prijs">
        {([['per-persoon', 'Per persoon'], ['prive', 'Privétour']] as const).map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={pr.kind === k} onClick={() => set({ kind: k })}>{l}</button>
        ))}
      </div>
      {pr.kind === 'per-persoon' ? (
        <div class="row">{money('Volwassene (€)', 'adult')}{money('Kind (€)', 'child')}{money('Baby (€)', 'infant')}</div>
      ) : (
        <div class="row">
          {money('Vaste prijs (€)', 'privateBase')}
          <label class="narrow">t/m gasten<input type="number" min={1} value={pr.privateIncluded} onInput={(e) => set({ privateIncluded: Math.max(1, num(e.currentTarget.value)) })} /></label>
          {money('Per extra gast (€)', 'privateExtra')}
        </div>
      )}
      <div class="row">{money('Kosten per gast (€)', 'costPerGuest')}{money('Kosten per vertrek (€)', 'fixedCost')}</div>
      <p class="meta">Per gast: tickets, proeverijen. Per vertrek: vaste kosten zoals vervoer.</p>
      <p class="price-form__sub">Commissie per kanaal</p>
      <div class="row">
        {channels.map((c) => (
          <label key={c} class="narrow">{CHANNELS[c]} (%)<input inputMode="decimal" value={dec(pr.commission[c] ?? 0)}
            onChange={(e) => set({ commission: { ...pr.commission, [c]: Math.min(95, num(e.currentTarget.value)) } })} /></label>
        ))}
      </div>
      <label class="check"><input type="checkbox" checked={pr.grossUp} onChange={(e) => set({ grossUp: e.currentTarget.checked })} />Prijs op commissiekanalen ophogen, zodat je netto gelijk blijft</label>
      {hasPrices(pr) && (
        <p class="meta">
          Voorbeeld 2 volwassenen: direct {eur.format(direct.total)}
          {withCommission.map((c) => { const s = suggestedPrice(pr, c, example); return ` · ${CHANNELS[c]} ${eur.format(s.total)} (netto ${eur.format(s.total - s.commission)})`; }).join('')}
        </p>
      )}
    </div>
  );
}
