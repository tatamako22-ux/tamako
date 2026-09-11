// Serializa lecturas y conserva la ultima solicitud, incluso si llega durante una carga.
// Las respuestas antiguas nunca se aplican a una pantalla que ya cambio de contexto.
export function createLatestLoader(load, apply, onError = console.error) {
  let version = 0;
  let pending = null;
  let running = null;
  let disposed = false;
  async function drain() {
    while (pending && !disposed) {
      const job = pending;
      pending = null;
      try {
        const data = await load(job.input);
        if (!disposed && job.version === version) apply(data, job.input);
      } catch (error) {
        if (!disposed && job.version === version) onError(error);
      }
    }
  }
  return {
    request(input) {
      if (disposed) return Promise.resolve();
      pending = { input, version: ++version };
      if (!running) running = drain().finally(() => { running = null; });
      return running;
    },
    dispose() { disposed = true; pending = null; ++version; },
  };
}
