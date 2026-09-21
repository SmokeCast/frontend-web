export function readConfig(env) {
  const mode = env.VITE_DEMO_MODE ?? 'false';
  if (!['true', 'false'].includes(mode)) {
    throw new Error('VITE_DEMO_MODE debe ser true o false.');
  }
  const demo = mode === 'true';
  const bases = {};
  for (let service = 1; service <= 5; service++) {
    const key = `VITE_MS${service}_URL`;
    const value = env[key]?.trim() || '';
    if (demo && !value) { bases[service] = ''; continue; }
    let url;
    try { url = new URL(value); } catch {
      throw new Error(`${key}: completa una URL base válida en .env (por ejemplo http://127.0.0.1:${8080 + service}).`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname !== '/') {
      throw new Error(`${key}: usa una URL http/https sin /api, rutas, parámetros ni credenciales.`);
    }
    bases[service] = url.origin;
  }
  return { demo, bases };
}
