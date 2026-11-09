import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { parse, run } from '../common/http';
import { Public } from '../auth/auth.guard';
import { CatalogService } from './catalog.service';

const Nearby = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180), q: z.string().max(60).optional(), limit: z.coerce.number().int().min(1).max(100).optional() });

@Public()
@Controller('catalog')
export class CatalogController {
  constructor(@Inject(TOKENS.catalog) private readonly catalog: CatalogService) {}

  @Get('restaurants') nearby(@Query() q: unknown) { const x = parse(Nearby, q); return run(() => this.catalog.nearby({ lat: x.lat, lng: x.lng }, { q: x.q, limit: x.limit })); }
  @Get('locations/:locationId') restaurant(@Param('locationId') id: string) { return run(() => this.catalog.restaurant(id)); }
}
