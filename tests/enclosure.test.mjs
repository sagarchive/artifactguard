import test from 'node:test';
import assert from 'node:assert/strict';
import {estimateEnclosureConcentration} from '../src/engine/enclosure.mjs';
test('CCI simplified enclosure equation', () => {
  const r = estimateEnclosureConcentration({
    emissionRateUgM2H: 2,
    areaM2: 1.5,
    volumeM3: 0.5,
    leakagePerHour: 0.25,
  });
  assert.equal(r.ok, true);
  assert.equal(r.concentrationUgM3, 24);
});
test('invalid physical inputs rejected', () =>
  assert.equal(
    estimateEnclosureConcentration({
      emissionRateUgM2H: 2,
      areaM2: 1,
      volumeM3: -1,
      leakagePerHour: 1,
    }).ok,
    false,
  ));
