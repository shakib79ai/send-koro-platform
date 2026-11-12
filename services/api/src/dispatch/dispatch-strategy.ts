export type DispatchProvider = 'own_driver' | 'uber_direct' | 'doordash_drive';

export const ADMIN_DISPATCH_STRATEGIES = [
  'own_driver_only',
  'uber_direct_only',
  'own_driver_then_uber',
] as const;
export type AdminDispatchStrategy = (typeof ADMIN_DISPATCH_STRATEGIES)[number];

export function providersForStrategy(
  strategy: AdminDispatchStrategy | null | undefined,
  defaultOrder: readonly DispatchProvider[],
): DispatchProvider[] {
  if (strategy === 'own_driver_only') return ['own_driver'];
  if (strategy === 'uber_direct_only') return ['uber_direct'];
  if (strategy === 'own_driver_then_uber') return ['own_driver', 'uber_direct'];
  return [...defaultOrder];
}
