import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container';

const requestOtpBody = z.object({ email: z.string().email() });
const verifyOtpBody = z.object({ email: z.string().email(), code: z.string().min(1) });

/** Stubbed OTP routes — wired now, real logic in a later phase. */
export function registerAuthRoutes(app: FastifyInstance, c: Container): void {
  app.post('/auth/otp', async (req, reply) => {
    const { email } = requestOtpBody.parse(req.body);
    await c.auth.requestOtp(email);
    return reply.code(202).send({ sent: true });
  });

  app.post('/auth/verify', async (req, reply) => {
    const { email, code } = verifyOtpBody.parse(req.body);
    const user = await c.auth.verifyOtp(email, code);
    return reply.send({ user });
  });
}
