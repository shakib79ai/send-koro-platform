export interface Address { id: string; label: 'home' | 'office' | 'other'; customLabel?: string | null; line1: string; line2?: string | null; city: string; state: string; postalCode: string; lat: number; lng: number; dropoffInstructions?: string | null; isDefault: boolean }
export interface NearbyRestaurant { restaurantId: string; locationId: string; name: string; cuisine: string | null; address: string; distanceMeters: number; delivers: boolean; pickup: boolean; open: boolean; busy: boolean; prepMinutes: number; deliveryRule: { rule: { kind: string; minFoodCents?: number } } | null }
export interface ModifierOption { id: string; name: string; priceCents: number; available: boolean }
export interface ModifierGroup { id: string; name: string; minSelect: number; maxSelect: number; options: ModifierOption[] }
export interface MenuItem { id: string; name: string; description: string | null; priceCents: number; imageUrl: string | null; allergens: string[]; dietary: string[]; available: boolean; soldOutUntil: string | null; groups: ModifierGroup[] }
export interface RestaurantPage {
  restaurantId: string; locationId: string; name: string; cuisine: string | null; address: string; lat: number; lng: number; open: boolean; busy: boolean; prepMinutes: number;
  fees: { kind: string; label: string; rateBps: number | null; fixedCents: number | null; minFoodCents: number | null }[];
  taxRatePpm: number; taxNote: string; deliveryRule: NearbyRestaurant['deliveryRule'];
  menu: { categories: { id: string; name: string; items: MenuItem[] }[]; uncategorized: MenuItem[] };
}
export interface ReceiptLine { label: string; amountCents: number; kind: 'food' | 'fee' | 'tax' | 'delivery' | 'delivery_discount' | 'tip' }
export interface Receipt { lines: ReceiptLine[]; totalCents: number; taxNote: string }
export interface Order {
  id: string; code: string; status: string; statusText: string; fulfilment: 'delivery' | 'pickup'; restaurantId: string; locationId: string; restaurantName: string;
  items: { itemId: string; name: string; quantity: number; unitCents: number; lineCents: number; note?: string; options: { id: string; name: string }[] }[];
  receipt: Receipt; totalCents: number; createdAt: string; placedAt: string | null; deliveredAt: string | null;
  delivery?: { status: string; courier: { firstName: string; lat: number | null; lng: number | null } | null } | null;
}
