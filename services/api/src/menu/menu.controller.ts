import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { centsSchema, parse, run } from '../common/http';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { MenuService } from './menu.service';
import { RestaurantsService } from '../restaurants/restaurants.service';

const Category = z.object({ name: z.string().min(1).max(60), sortOrder: z.number().int().optional() });
const Group = z.object({
  name: z.string().min(1).max(60), minSelect: z.number().int().min(0).max(20), maxSelect: z.number().int().min(1).max(20),
  options: z.array(z.object({ name: z.string().min(1).max(60), priceCents: centsSchema, available: z.boolean().optional() })).min(1).max(40),
}).refine((g) => g.minSelect <= g.maxSelect && g.maxSelect <= g.options.length, 'min ≤ max ≤ number of options');
const Item = z.object({
  categoryId: z.string().uuid().nullable().optional(), name: z.string().min(1).max(80), description: z.string().max(500).optional(),
  priceCents: centsSchema, imageUrl: z.string().url().optional(), allergens: z.array(z.string()).optional(), dietary: z.array(z.string()).optional(),
  taxable: z.boolean().optional(), available: z.boolean().optional(), sortOrder: z.number().int().optional(), groups: z.array(Group).max(10).optional(),
});
const Availability = z.object({ available: z.boolean(), soldOutMinutes: z.number().int().min(1).max(10080).nullable().optional() });

@Roles('restaurant_staff', 'admin')
@Controller('restaurants')
export class MenuController {
  constructor(@Inject(TOKENS.menu) private readonly menu: MenuService, @Inject(TOKENS.restaurants) private readonly restaurants: RestaurantsService) {}

  @Get(':id/menu') async get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(async () => { await this.restaurants.requireMember(u, id); return this.menu.menu(id); }); }
  @Post(':id/menu/categories') addCategory(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.menu.addCategory(u, id, parse(Category, b))); }
  @Patch('menu/categories/:categoryId') updateCategory(@CurrentUser() u: AuthUser, @Param('categoryId') id: string, @Body() b: unknown) { return run(() => this.menu.updateCategory(u, id, parse(Category.partial(), b))); }
  @Post(':id/menu/items') addItem(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.menu.addItem(u, id, parse(Item, b))); }
  @Patch('menu/items/:itemId') updateItem(@CurrentUser() u: AuthUser, @Param('itemId') id: string, @Body() b: unknown) { return run(() => this.menu.updateItem(u, id, parse(Item.partial(), b))); }
  @Patch('menu/items/:itemId/availability') availability(@CurrentUser() u: AuthUser, @Param('itemId') id: string, @Body() b: unknown) { return run(() => this.menu.setAvailability(u, id, parse(Availability, b))); }
  @Delete('menu/items/:itemId') remove(@CurrentUser() u: AuthUser, @Param('itemId') id: string) { return run(() => this.menu.removeItem(u, id)); }
}
