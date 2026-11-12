import { describe, expect, it } from 'vitest';
import { providersForStrategy } from '../src/dispatch/dispatch-strategy';

describe('providersForStrategy', () => {
  const defaultOrder = ['own_driver', 'uber_direct', 'doordash_drive'] as const;

  it('uses the configured server order when the admin has not selected an override', () => {
    expect(providersForStrategy(null, defaultOrder)).toEqual(defaultOrder);
  });

  it('supports own drivers only and Uber Direct only', () => {
    expect(providersForStrategy('own_driver_only', defaultOrder)).toEqual(['own_driver']);
    expect(providersForStrategy('uber_direct_only', defaultOrder)).toEqual(['uber_direct']);
  });

  it('uses the second provider only after the first provider in the sequence', () => {
    expect(providersForStrategy('own_driver_then_uber', defaultOrder)).toEqual(['own_driver', 'uber_direct']);
  });
});
