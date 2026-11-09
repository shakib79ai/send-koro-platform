import { Body, Controller, Get, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../tokens';
import { InternalApiGuard } from '../internal-api.guard';
import { ReportsService } from './reports.service';
import { SettlementService } from './settlement.service';

const Range = z.object({ from: z.coerce.date(), to: z.coerce.date() });
const parse = <S extends z.ZodTypeAny>(s: S, v: unknown): z.output<S> => s.parse(v);

/** Admin console reads (via services/api, never browsers). */
@UseGuards(InternalApiGuard)
@Controller('admin')
export class ReportsController {
  constructor(@Inject(TOKENS.reports) private readonly reports: ReportsService, @Inject(TOKENS.settlement) private readonly settlement: SettlementService) {}

  @Get('overview') overview(@Query() q: unknown) { const r = parse(Range, q); return this.reports.overview(r.from, r.to); }
  @Get('restaurants/:id/money') money(@Param('id') id: string, @Query() q: unknown) { const r = parse(Range, q); return this.reports.restaurantMoney(id, r.from, r.to); }
  @Get('restaurants/:id/payouts') rPayouts(@Param('id') id: string) { return this.reports.accountPayouts('restaurant', id); }
  @Get('drivers/:id/payouts') dPayouts(@Param('id') id: string) { return this.reports.accountPayouts('driver', id); }
  @Get('driver-settlements') drivers(@Query() q: unknown) { return this.reports.driverSettlements(parse(z.object({ driverId: z.string().uuid().optional(), status: z.string().optional(), limit: z.coerce.number().int().max(500).optional() }), q)); }
  @Get('supplier-obligations') suppliers(@Query() q: unknown) { return this.reports.supplierObligations(parse(z.object({ provider: z.string().optional(), status: z.string().optional(), limit: z.coerce.number().int().max(500).optional() }), q)); }
  @Get('billing') billing() { return this.reports.billing(); }
  /** Retry owed driver transfers and NYC top-ups now (the job also runs on its own). */
  @Post('driver-settlements/retry') retry() { return this.settlement.retryOwed(); }
  /** Record a provider invoice line against an obligation. */
  @Post('supplier-obligations/:orderId/reconcile') reconcile(@Param('orderId') orderId: string, @Body() b: unknown) {
    const x = parse(z.object({ billedCents: z.number().int().nonnegative(), tipCents: z.number().int().nonnegative(), invoiceRef: z.string().min(1) }), b);
    return this.settlement.reconcileSupplierLine(orderId, x);
  }
}
