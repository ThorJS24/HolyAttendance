// ESPRO login mechanism (main process). Uses Electron's `net` stack so it goes
// through the system proxy and OS certificate store — important on the managed
// campus/corporate network this runs on.
//
// ⚠️ HONESTY NOTE — READ BEFORE TRUSTING THIS:
// The request SHAPE here is real, but the portal-specific details (login URL
// path, form field names, whether anti-forgery/__VIEWSTATE tokens are needed,
// and how a success vs. a wrong-password response actually looks) are GUESSES.
// They have NOT been verified against the real espro.christuniversity.in:444
// login page, and this has NOT been exercised against the live portal in this
// environment (no credentials were provided, by design). Everything marked
// `UNCONFIRMED` must be checked against a real login page before this works.
import { net } from 'electron'
import {
  applySetCookies,
  serializeCookies,
  formEncode,
  headerToArray,
  EsproLoginError,
  type CookieJar,
} from './http-util'

export interface EsproSession {
  /** In-memory only for the duration of a sync — never persisted to disk. */
  cookies: CookieJar
  /** Base URL this session is authenticated against. */
  baseUrl: string
}

export const ESPRO_BASE = 'https://espro.christuniversity.in:444'

// ⚠️ UNCONFIRMED PORTAL MARKUP — best-guess values, not verified against the
// real login form. Confirm all of these from an actual ESPRO login page.
const LOGIN_PAGE_PATH = '/' // GUESS: where the login form is served
const LOGIN_POST_PATH = '/' // GUESS: the form's action target
const FIELD_USERNAME = 'txtUserName' // GUESS: username/roll-number input name
const FIELD_PASSWORD = 'txtPassword' // GUESS: password input name
// GUESS: ASP.NET WebForms portals often require __VIEWSTATE / __EVENTVALIDATION
// (and sometimes an anti-forgery token) to be echoed from the GET of the login
// page back into the POST. We do NOT yet know whether ESPRO does. If it does,
// scrape them from the login page body below and add them to the POST fields.

interface RawResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

function httpRequest(opts: {
  method: 'GET' | 'POST'
  url: string
  headers?: Record<string, string>
  body?: string
}): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    // redirect: 'manual' so we can capture Set-Cookie on the login redirect
    // ourselves rather than have `net` swallow it while following.
    const req = net.request({ method: opts.method, url: opts.url, redirect: 'manual' })
    for (const [k, v] of Object.entries(opts.headers ?? {})) req.setHeader(k, v)
    req.on('response', (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(Buffer.from(c)))
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | string[] | undefined>,
          body: Buffer.concat(chunks).toString('utf8'),
        }),
      )
      res.on('error', (e: Error) => reject(new EsproLoginError('unreachable', e.message)))
    })
    req.on('error', (e) => reject(new EsproLoginError('unreachable', e.message)))
    if (opts.body) req.write(opts.body)
    req.end()
  })
}

/**
 * Logs into ESPRO with the given (already-decrypted, in-memory) credentials and
 * returns a session cookie jar. Throws EsproLoginError on failure.
 *
 * NOT verified against the live portal — see the honesty note at the top.
 */
export async function esproLogin(creds: { username: string; password: string }): Promise<EsproSession> {
  const jar: CookieJar = new Map()

  // 1. GET the login page to seed session cookies (and, if needed, tokens).
  const page = await httpRequest({ method: 'GET', url: ESPRO_BASE + LOGIN_PAGE_PATH })
  applySetCookies(jar, headerToArray(page.headers['set-cookie']))
  // TODO(espro-markup): if the form carries __VIEWSTATE / anti-forgery hidden
  // inputs, parse them from `page.body` here and merge into `fields` below.

  // 2. POST credentials.
  const fields: Record<string, string> = {
    [FIELD_USERNAME]: creds.username,
    [FIELD_PASSWORD]: creds.password,
  }
  const body = formEncode(fields)
  const post = await httpRequest({
    method: 'POST',
    url: ESPRO_BASE + LOGIN_POST_PATH,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(Buffer.byteLength(body)),
      Cookie: serializeCookies(jar),
    },
    body,
  })
  applySetCookies(jar, headerToArray(post.headers['set-cookie']))

  // 3. Interpret the outcome.
  // ⚠️ UNCONFIRMED: reliably telling "logged in" from "wrong password" needs
  // ESPRO's real response markup. Conservative heuristic until then: a redirect
  // away from the login form with a session cookie = tentatively logged in;
  // a body that reads like a rejection = bad credentials; anything else we
  // refuse to call a success.
  if (post.status >= 500) {
    throw new EsproLoginError('unreachable', `ESPRO returned ${post.status}.`)
  }
  const redirected = post.status >= 300 && post.status < 400
  if (redirected && jar.size > 0) {
    return { cookies: jar, baseUrl: ESPRO_BASE }
  }
  if (/invalid|incorrect|failed|try again|wrong/i.test(post.body)) {
    throw new EsproLoginError('bad-credentials', 'ESPRO rejected the username or password.')
  }
  throw new EsproLoginError(
    'unexpected',
    "Couldn't confirm the ESPRO login — the portal's response wasn't recognized. The login form details still need to be confirmed against the real page.",
  )
}
