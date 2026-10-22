import { useState } from 'preact/hooks';
import { exportJson, importJson, setSyncConfig, syncNow, useAppState } from '../state/store';
import { DatasetError } from '../storage/backup';
import { OfflineMapControl } from './OfflineMapControl';

export function Settings() {
  const s = useAppState();
  const [form, setForm] = useState({
    owner: s.syncConfig?.owner ?? '',
    repo: s.syncConfig?.repo ?? 'tbilisi-tour-data',
    path: s.syncConfig?.path ?? 'data/tours.json',
    token: '',
  });
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);

  async function saveSync(e: Event) {
    e.preventDefault();
    const token = form.token.trim() || s.syncConfig?.token || '';
    if (!form.owner.trim() || !form.repo.trim() || !token) return setMsg({ text: 'Vul gebruikersnaam, repository en token in.', warn: true });
    await setSyncConfig({ owner: form.owner.trim(), repo: form.repo.trim(), path: form.path.trim() || 'data/tours.json', token });
    setForm({ ...form, token: '' });
    setMsg(null);
  }

  function download() {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tbilisi-tours-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      setMsg({ text: await importJson(await file.text()) });
    } catch (err) {
      setMsg({ text: err instanceof DatasetError ? err.message : 'Importeren mislukt.', warn: true });
    } finally {
      input.value = '';
    }
  }

  return (
    <main class="page settings">
      <h1>Instellingen</h1>

      <section class="card">
        <h2>Synchronisatie tussen laptop en telefoon</h2>
        <p class="hint">Je gegevens staan altijd op dit apparaat. Met synchronisatie gaat een kopie naar een privé GitHub-repository; elke synchronisatie is daar een versie (back-up met geschiedenis). Stel dit op elk apparaat één keer in.</p>
        <p class={`status status--${s.syncStatus}`}>
          {s.syncConfig ? `Status: ${s.syncMessage || s.syncStatus}` : 'Synchronisatie staat uit.'}
          {s.lastSyncAt && ` Laatst: ${new Date(s.lastSyncAt).toLocaleString('nl-NL')}.`}
        </p>
        <form onSubmit={saveSync} class="sync-form">
          <label>GitHub-gebruikersnaam<input value={form.owner} autocomplete="username" onInput={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, owner: v })); }} /></label>
          <label>Privé repository<input value={form.repo} onInput={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, repo: v })); }} /></label>
          <label>Bestandspad<input value={form.path} onInput={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, path: v })); }} /></label>
          <label>Token (fine-grained, alleen deze repo, Contents: lezen en schrijven)
            <input type="password" autocomplete="off" value={form.token} placeholder={s.syncConfig ? 'Opgeslagen — laat leeg om te behouden' : 'github_pat_…'} onInput={(e) => { const v = e.currentTarget.value; setForm((f) => ({ ...f, token: v })); }} />
          </label>
          <div class="row">
            <button class="btn btn--primary" type="submit">Opslaan en synchroniseren</button>
            {s.syncConfig && <button class="btn" type="button" onClick={() => syncNow()} disabled={!s.online}>Nu synchroniseren</button>}
            {s.syncConfig && <button class="btn btn--danger" type="button" onClick={() => setSyncConfig(null)}>Synchronisatie uitzetten</button>}
          </div>
        </form>
        <p class="hint">Het token wordt alleen in de browseropslag van dit apparaat bewaard, nooit in de app-code of in Git. Uitzetten verwijdert het token van dit apparaat; je tours blijven staan.</p>
      </section>

      <section class="card">
        <h2>Back-up</h2>
        <p class="hint">Download een volledig bestand met alle tours en bezienswaardigheden. Importeren voegt toe en vervangt alleen oudere versies; er wordt niets verwijderd.</p>
        <div class="row">
          <button class="btn" onClick={download}>Back-up downloaden</button>
          <label class="btn file-btn">Back-up importeren<input type="file" accept="application/json,.json" onChange={upload} /></label>
        </div>
        {msg && <p class={`hint ${msg.warn ? 'hint--warn' : ''}`}>{msg.text}</p>}
      </section>

      <section class="card">
        <h2>Opslag en offline</h2>
        <p class="hint">
          {s.persisted === true && 'De browser heeft beloofd je gegevens niet automatisch op te ruimen.'}
          {s.persisted === false && 'De browser kan gegevens opruimen bij weinig ruimte. Installeer de app of zet synchronisatie aan als vangnet.'}
          {s.persisted === null && 'Onbekend of de browser je gegevens vasthoudt.'}
        </p>
        <OfflineMapControl />
        <ul class="caps">
          <li><strong>Werkt offline:</strong> tours, vertelpunten, aankomstnotities, stopposities, opgeslagen looproutes en aanwijzingen, GPS-positie en afstand, achtergrondinformatie, en de kaart van Tbilisi als die hierboven is opgeslagen.</li>
          <li><strong>Vereist internet:</strong> kaart buiten Tbilisi, nieuwe looproute berekenen, synchroniseren.</li>
        </ul>
      </section>

      <section class="card">
        <h2>Bronnen en licenties</h2>
        <p class="hint">Kaart © OpenStreetMap-bijdragers (ODbL); offline kaart via Protomaps (OSM-gegevens, ODbL). Looproutes via FOSSGIS OSRM (routing.openstreetmap.de). Achtergrond: Wikipedia (CC BY-SA 4.0) en Wikidata (CC0). Lettertypen Literata en Public Sans (SIL OFL).</p>
      </section>
    </main>
  );
}
