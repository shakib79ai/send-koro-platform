import { Controller, Get, Query, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { parse } from '../common/http';
import { Public } from '../auth/auth.guard';
import { geocodeUs } from './geocode';

@Public()
@Controller('geocode')
export class GeocodeController {
  @Get() async search(@Query() q: unknown) {
    const { address } = parse(z.object({ address: z.string().min(5).max(200) }), q);
    try { return await geocodeUs(address); } catch { throw new ServiceUnavailableException({ code: 'geocoder_unavailable', message: 'Address lookup is unavailable. Try again in a moment.' }); }
  }
}
