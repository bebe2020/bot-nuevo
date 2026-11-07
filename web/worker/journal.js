// La sesión del sitio y la copia del dispositivo tienen estados independientes.
export class SiteAPIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function siteAPI(path, options = {}, fetcher = fetch) {
  const response = await fetcher(path, { ...options, credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    let message = response.status === 401 ? 'La sesión del sitio venció' : 'HTTP ' + response.status;
    if (response.status !== 401) {
      try { message = (await response.json()).error || message; } catch {}
    }
    throw new SiteAPIError(response.status, message);
  }
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new SiteAPIError(401, 'Es necesario restablecer la sesión del sitio');
  }
  return response.json();
}

export function deviceJournal(storage) {
  const key = 'terminal54-journal-v1';
  const read = () => {
    const value = JSON.parse(storage.getItem(key) || '{"observations":[],"plans":[]}');
    if (!Array.isArray(value.observations) || !Array.isArray(value.plans)) throw Error('DIARIO_LOCAL_INVALIDO');
    return value;
  };
  const write = value => storage.setItem(key, JSON.stringify(value));
  return {
    read,
    observe(snapshot) {
      const price = Number(snapshot.ticker?.lastPr);
      if (!(price > 0) || !Number.isFinite(snapshot.sourceAsOf)) return;
      const value = read();
      const id = [snapshot.market, snapshot.symbol, Math.floor(snapshot.received / 60000)].join(':');
      const record = { id, symbol: snapshot.symbol, market: snapshot.market, price,
        received: snapshot.received, asof: snapshot.sourceAsOf, storage: 'ESTE_DISPOSITIVO' };
      value.observations = [record, ...value.observations.filter(x => x.id !== id)].slice(0, 1000);
      write(value);
      return true;
    },
    stagePlan(input, id = crypto.randomUUID(), now = Date.now()) {
      const value = read();
      const plan = { ...input, clientId: id, plannedAt: now, created: now,
        state: 'PLAN_MANUAL_SIN_FILL', sync: 'PENDIENTE', storage: 'ESTE_DISPOSITIVO' };
      value.plans.unshift(plan);
      write(value);
      return plan;
    },
    synced(id, record) {
      const value = read(), plan = value.plans.find(x => x.clientId === id);
      if (plan) { plan.sync = 'GUARDADO_EN_NUBE'; plan.serverId = record.id; write(value); }
    }
  };
}

export function mergeObservations(local, remote) {
  const records = new Map();
  for (const item of [...local, ...remote]) {
    const key = [item.market || 'PERP', item.symbol, Math.floor(Number(item.received) / 60000)].join(':');
    records.set(key, item);
  }
  return [...records.values()].sort((a, b) => Number(b.received) - Number(a.received)).slice(0, 1000);
}
