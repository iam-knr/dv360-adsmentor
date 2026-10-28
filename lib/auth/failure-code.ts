import 'server-only';
import { signInMessage, type SignInFailure } from './signin';

/** `locked.12` / `not_started.1796000000000` style codes: a failure kind and an optional number. */
export function encodeFailure(f: SignInFailure): string {
  switch (f.code) {
    case 'locked':
      return `locked.${f.minutes}`;
    case 'not_started':
    case 'ended':
      return `${f.code}.${f.at.getTime()}.${encodeURIComponent(f.timeZone ?? '')}`;
    default:
      return f.code;
  }
}

export function messageForCode(code: string | null | undefined): string {
  const [kind, value, tz] = (code ?? '').split('.');
  const timeZone = tz ? decodeURIComponent(tz) : undefined;
  switch (kind) {
    case 'locked':
      return signInMessage({ ok: false, code: 'locked', minutes: Number(value) || 1 });
    case 'disabled':
      return signInMessage({ ok: false, code: 'disabled' });
    case 'not_started':
    case 'ended':
      return signInMessage({ ok: false, code: kind, at: new Date(Number(value)), timeZone });
    default:
      return signInMessage({ ok: false, code: 'invalid' });
  }
}
