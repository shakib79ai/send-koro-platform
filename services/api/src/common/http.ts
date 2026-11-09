import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { CartError } from '../core/cart';
import { TransitionError } from '../core/order-status';

export function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException({ code: 'invalid_request', issues: r.error.issues });
  return r.data;
}

/** Domain errors that map to a 4xx. Anything else is a 500. */
export class AppError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, public readonly code: string, message: string) { super(message); }
}
export const notFound = (what: string) => new AppError(404, 'not_found', `${what} not found`);
export const forbidden = (msg = 'Not allowed') => new AppError(403, 'forbidden', msg);
export const conflict = (code: string, msg: string) => new AppError(409, code, msg);
export const badRequest = (code: string, msg: string) => new AppError(400, code, msg);

export function toHttp(e: unknown): unknown {
  if (e instanceof AppError) {
    const body = { code: e.code, message: e.message };
    return e.status === 404 ? new NotFoundException(body) : e.status === 403 ? new ForbiddenException(body) : e.status === 409 ? new ConflictException(body) : new BadRequestException(body);
  }
  if (e instanceof CartError) return new BadRequestException({ code: e.code, message: e.message });
  if (e instanceof TransitionError) return new ConflictException({ code: 'invalid_transition', message: e.message });
  return e;
}

export async function run<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { throw toHttp(e); }
}

export const uuid = z.string().uuid();
export const centsSchema = z.number().int().nonnegative();
export const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +19175550123');
