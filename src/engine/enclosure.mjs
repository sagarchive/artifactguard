export function estimateEnclosureConcentration({
  emissionRateUgM2H,
  areaM2,
  volumeM3,
  leakagePerHour,
}) {
  const values = [emissionRateUgM2H, areaM2, volumeM3, leakagePerHour];
  if (values.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) {
    return {ok: false, reason: 'All four physical inputs must be finite values greater than zero.'};
  }
  const [E, A, V, N] = values;
  const concentrationUgM3 = (E * A) / (V * N);
  if (!Number.isFinite(concentrationUgM3)) {
    return {ok: false, reason: 'Inputs are outside the range this calculator can evaluate.'};
  }
  return {
    ok: true,
    concentrationUgM3,
    equation: 'C = E × A / (V × N)',
    inputs: {emissionRateUgM2H: E, areaM2: A, volumeM3: V, leakagePerHour: N},
    interpretation:
      'Estimated concentration under the simplified CCI relation. ArtifactGuard does not convert this number into a safety verdict without a source-backed threshold.',
  };
}
