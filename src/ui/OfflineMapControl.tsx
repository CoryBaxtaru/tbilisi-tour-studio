// Store or remove the offline Tbilisi map on this device.
import { useState } from 'preact/hooks';
import { formatDistance } from '../domain/geo';
import { MAP_DATA_DATE, MAP_SIZE_BYTES, removeStoredMap, storeMap, useMapStored } from '../map/offlineMap';
import { useAppState } from '../state/store';

const sizeMb = (MAP_SIZE_BYTES / 1_000_000).toFixed(1).replace('.', ',');

export function OfflineMapControl({ compact }: { compact?: boolean }) {
  const { online } = useAppState();
  const stored = useMapStored();
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function download() {
    setError('');
    setProgress(0);
    try {
      await storeMap(setProgress);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Opslaan mislukt.');
    } finally {
      setProgress(null);
    }
  }

  if (stored === null) return null;
  if (compact && stored) return null; // guide mode only nags when the map is missing

  return (
    <div class={`offline-map ${compact ? 'offline-map--compact' : ''}`}>
      {stored ? (
        <p class="offline-map__status offline-map__status--ok">
          Offline kaart van Tbilisi staat op dit apparaat ({sizeMb} MB, kaartgegevens {MAP_DATA_DATE}). Straten en gebouwen werken ook zonder internet.
        </p>
      ) : (
        <p class="offline-map__status">
          {compact ? 'Kaart nog niet offline opgeslagen: zonder signaal zie je geen straten.' : `Sla de kaart van Tbilisi op (${sizeMb} MB) zodat straten en gebouwen ook zonder internet zichtbaar zijn.`}
        </p>
      )}
      {progress !== null && (
        <div class="offline-map__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      <div class="row row--tight">
        {!stored && (
          <button class="btn btn--primary" onClick={download} disabled={progress !== null || !online}>
            {progress !== null ? `Opslaan… ${Math.round(progress * 100)}%` : `Kaart offline opslaan (${sizeMb} MB)`}
          </button>
        )}
        {stored && !compact && <button class="btn btn--ghost" onClick={() => removeStoredMap()}>Verwijderen van dit apparaat</button>}
        {!stored && !online && <span class="hint hint--warn">Opslaan vereist internet.</span>}
      </div>
      {error && <p class="hint hint--warn">{error}</p>}
      {!compact && <p class="hint">Dekt het centrum en alle catalogusplekken (± {formatDistance(9200)} × {formatDistance(12200)}). Daarbuiten zie je alleen online een kaart.</p>}
    </div>
  );
}
