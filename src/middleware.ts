import { NextResponse, type NextRequest } from 'next/server';

/**
 * Hides the staff panel. Anyone without a staff session cookie is bounced to
 * the home page, so /admin/* never reveals its existence to customers.
 * (Cryptographic validation of the cookie happens server-side in the API
 * routes via roleFromRequest; here we only gate on presence — edge-safe.)
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.has('staff_session')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
