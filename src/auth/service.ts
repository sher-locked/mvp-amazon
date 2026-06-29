export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Company-email OTP login. Phase 0: thin contract + no-op stub so routes can be
 * wired. Real impl: generate/send OTP, verify, issue session.
 */
export interface AuthService {
  requestOtp(email: string): Promise<void>;
  verifyOtp(email: string, code: string): Promise<AuthUser>;
}

export class StubAuthService implements AuthService {
  async requestOtp(_email: string): Promise<void> {
    // no-op
  }

  async verifyOtp(email: string, _code: string): Promise<AuthUser> {
    return { id: 'stub-user', email };
  }
}
