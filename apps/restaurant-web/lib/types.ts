export interface Hours { id: string; locationId: string; dayOfWeek: number; opensAt: string; closesAt: string }
export interface Location {
  id: string; restaurantId: string; name: string; phone: string | null; line1: string; city: string; state: string; postalCode: string; lat: number; lng: number;
  timezone: string; deliveryRadiusMeters: number; taxRatePpm: number; prepMinutes: number; acceptingOrders: boolean; busyUntil: string | null;
  pickupEnabled: boolean; deliveryEnabled: boolean; hours: Hours[];
}
export interface Fee { id: string; kind: 'service_charge' | 'mandatory_gratuity' | 'packaging_fee' | 'large_order_fee'; label: string; rateBps: number | null; fixedCents: number | null; minFoodCents: number | null; taxable: boolean; active: boolean }
export type DeliveryRule =
  | { kind: 'customer_pays' } | { kind: 'restaurant_pays' }
  | { kind: 'split_fixed'; restaurantCents: number } | { kind: 'split_percent'; restaurantBps: number }
  | { kind: 'free_above'; minFoodCents: number; belowRestaurantCents?: number };
export interface Restaurant {
  id: string; name: string; contactEmail: string; cuisine: string | null; status: 'onboarding' | 'live' | 'paused' | 'suspended';
  taxResponsibilityAcceptedAt: string | null; deliveryRule: { rule: DeliveryRule; perOrderCapCents?: number | null; monthlyBudgetCents?: number | null } | null; deliveryRuleVersion: number | null;
  payoutsReady: boolean; createdAt: string; myRole?: 'owner' | 'manager' | 'staff';
  locations: Location[]; fees: Fee[];
  checklist: { location: boolean; hours: boolean; taxResponsibility: boolean; deliveryFeeRule: boolean; payouts: boolean };
}
export interface LiveOrder {
  id: string; code: string; status: string; fulfilment: 'delivery' | 'pickup'; locationId: string; notes: string | null;
  items: { name: string; quantity: number; options: { group: string; name: string }[]; note?: string }[];
  foodCents: number; serviceChargeCents: number; taxCents: number; tipCents: number; restaurantDeliveryCents: number; totalCents: number;
  placedAt: string | null; acceptedAt: string | null; readyAt: string | null; acceptBy: string | null; courier: { status: string } | null;
}
export interface Summary { orders: number; declined: number; inProgress: number; avgAcceptSeconds: number; foodCents: number; serviceChargeCents: number; taxCents: number; deliveryPaidCents: number; commissionCents: number; daily: { day: string; foodCents: number; orders: number }[] }
export interface ModifierOption { id: string; name: string; priceCents: number; available: boolean }
export interface ModifierGroup { id: string; name: string; minSelect: number; maxSelect: number; options: ModifierOption[] }
export interface MenuItem { id: string; categoryId: string | null; name: string; description: string | null; priceCents: number; imageUrl: string | null; allergens: string[]; dietary: string[]; taxable: boolean; available: boolean; soldOutUntil: string | null; groups: ModifierGroup[] }
export interface Menu { categories: { id: string; name: string; sortOrder: number; items: MenuItem[] }[]; uncategorized: MenuItem[] }
export interface StripeOverview {
  kind: 'restaurant' | 'driver'; stripeAccountId: string | null; displayName?: string | null;
  setup: 'not_started' | 'pending' | 'restricted' | 'active'; ready: boolean; requirementsDue: string[];
  payoutSchedule: string | null; bank: { name: string | null; last4: string } | null;
  balance: { availableCents: number; pendingCents: number } | null;
  payouts: { id: string; amountCents: number; status: string; arrivalDate: string; method: string; failureMessage: string | null }[];
  error: string | null;
}
