export async function traced(trace, tool, detail, fn) {
  const start = performance.now();
  const record = (extra) =>
    trace.push({tool, ...detail, ms: Math.round(performance.now() - start), ...extra});
  try {
    const value = await fn();
    record();
    return value;
  } catch (error) {
    record({failed: true});
    throw error;
  }
}

export function endpointName(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() || 'endpoint';
  } catch {
    return 'endpoint';
  }
}
