// Cloudflare Workers entry point for Chess Engine Accounts

import {
  getDailyChallengeIdsForUtcDate,
  utcDateString,
  DAILY_CHALLENGE_DIGEST_BLURBS,
  DAILY_CHALLENGE_CARD_INFO,
} from './daily-challenge-picker.js';
import { DISPOSABLE_EMAIL_DOMAINS } from './disposable-email-domains.js';
import {
  SPORTS_DIGEST_TEAM_CATALOG,
  SPORTS_DIGEST_LEAGUES,
  SPORTS_DIGEST_PRESETS,
  SPORTS_DIGEST_MAX_TEAMS,
  SPORTS_DIGEST_MAX_CUSTOM_TIMES,
  normalizeSportsDigestPrefs,
  resolveScheduleTimes,
  validateSportsDigestSave,
} from './sports-digest-teams.js';
import { SPORTS_DIGEST_TIME_ZONE } from './sports-digest-timezone.js';
import {
  applySendKey,
  fetchSportsDigestEmailContent,
  getSportsDigestCronTick,
  resolveSubscriberSinceMs,
  subscriberSendKey,
} from './sports-digest-send.js';
import { handleTetherRequest } from './tether.js';
export { TetherProject } from './tether.js';

/** Stored on `emailPreferences.digestTimeZone` for compatibility; digest send time uses UTC (see `getDigestSendUtcHM`). */
const DEFAULT_DIGEST_TIMEZONE = 'Etc/UTC';

const HEADER_NAV_DEFAULT_IDS = ['home', 'labs', 'account'];
const HEADER_NAV_ALLOWED_IDS = new Set([
  'home',
  'labs',
  'account',
  'chessEngine',
  'chessShop',
  'chessLeaderboard',
  'chessSeasonTrack',
  'achievements',
  'trifangx',
  'codingLab',
  'roboticsLab',
  'musicLab',
  'languageLab',
  'writingLab',
  'dungeonGame',
  'classify',
  'tether',
  'sportsDigest',
  'spud',
  'lotr',
  'kyrachyng',
  'contact',
]);

function sanitizeHeaderNavItems(raw) {
  if (!Array.isArray(raw)) return HEADER_NAV_DEFAULT_IDS.slice();
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (typeof id === 'string' && HEADER_NAV_ALLOWED_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out.length ? out : HEADER_NAV_DEFAULT_IDS.slice();
}

/** Only this logged-in account may POST /api/admin/broadcast-email */
const ADMIN_BROADCAST_ACCOUNT_EMAIL = 'calebahrens2011@gmail.com';
/** From header for those messages (must be verified in Resend / Cloudflare Email Sending). */
const ADMIN_BROADCAST_FROM_EMAIL = 'caleb@ahrenslabs.com';
const ADMIN_BROADCAST_FROM_NAME = 'Ahrens Labs';

export default {
  async fetch(request, env, executionCtx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Test-Secret',
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Route requests
      if (path === '/api/signup' && request.method === 'POST') {
        return handleSignup(request, env, corsHeaders);
      } else if (path === '/api/login' && request.method === 'POST') {
        return handleLogin(request, env, corsHeaders);
      } else if (path === '/api/logout' && request.method === 'POST') {
        return handleLogout(request, env, corsHeaders);
      } else if (path === '/api/sync' && request.method === 'POST') {
        return handleSync(request, env, corsHeaders);
      } else if (path === '/api/user' && request.method === 'GET') {
        return handleGetUser(request, env, corsHeaders);
      } else if (path === '/api/email-preferences' && request.method === 'POST') {
        return handleEmailPreferences(request, env, corsHeaders);
      } else if (path === '/api/header-nav-preferences' && request.method === 'POST') {
        return handleHeaderNavPreferences(request, env, corsHeaders);
      } else if (path === '/api/sports-digest-catalog' && request.method === 'GET') {
        return handleSportsDigestCatalog(corsHeaders);
      } else if (path === '/api/sports-digest-preferences' && request.method === 'POST') {
        return handleSportsDigestPreferences(request, env, corsHeaders);
      } else if (path === '/api/sports-digest-status' && request.method === 'GET') {
        return handleSportsDigestStatus(request, env, corsHeaders);
      } else if (path === '/api/sports-digest-send-now' && request.method === 'POST') {
        return handleSportsDigestSendNow(request, env, corsHeaders);
      } else if (path === '/api/resend-welcome-email' && request.method === 'POST') {
        return handleResendWelcomeEmail(request, env, corsHeaders);
      } else if (path === '/api/send-daily-challenges-now' && request.method === 'POST') {
        return handleSendDailyChallengesNow(request, env, corsHeaders);
      } else if (path === '/api/admin/broadcast-email' && request.method === 'POST') {
        return handleAdminBroadcastEmail(request, env, corsHeaders);
      } else if (path === '/api/admin/resend-welcome-bulk' && request.method === 'POST') {
        return handleAdminResendWelcomeBulk(request, env, corsHeaders);
      } else if (path === '/api/admin/list-accounts' && request.method === 'POST') {
        return handleAdminListAccounts(request, env, corsHeaders);
      } else if (path === '/api/admin/verify-user-email' && request.method === 'POST') {
        return handleAdminVerifyUserEmail(request, env, corsHeaders);
      } else if (path === '/api/admin/check-signup-email' && request.method === 'POST') {
        return handleAdminCheckSignupEmail(request, env, corsHeaders);
      } else if (path === '/api/admin/delete-user' && request.method === 'POST') {
        return handleAdminDeleteUser(request, env, corsHeaders, executionCtx);
      } else if (path === '/api/admin/send-welcome-to-user' && request.method === 'POST') {
        return handleAdminSendWelcomeToUser(request, env, corsHeaders);
      } else if (path === '/api/admin/send-custom-email-to-user' && request.method === 'POST') {
        return handleAdminSendCustomEmailToUser(request, env, corsHeaders);
      } else if (path === '/api/admin/send-all-test-emails' && request.method === 'POST') {
        return handleAdminSendAllTestEmails(request, env, corsHeaders);
      } else if (path === '/api/admin/send-test-email' && request.method === 'POST') {
        return handleAdminSendTestEmail(request, env, corsHeaders);
      } else if (path === '/api/change-username' && request.method === 'POST') {
        return handleChangeUsername(request, env, corsHeaders);
      } else if (path === '/api/leaderboard-row-color' && request.method === 'POST') {
        return handleLeaderboardRowColor(request, env, corsHeaders);
      } else if (path === '/api/chess/lb-flair' && request.method === 'POST') {
        return handleChessLbFlair(request, env, corsHeaders);
      } else if (path === '/api/change-password' && request.method === 'POST') {
        return handleChangePassword(request, env, corsHeaders);
      } else if (path === '/api/delete-account' && request.method === 'POST') {
        return handleDeleteAccount(request, env, corsHeaders, executionCtx);
      } else if (path === '/api/verify' && request.method === 'GET') {
        return handleVerifyEmail(request, env, corsHeaders, executionCtx);
      } else if (path === '/api/forgot-password' && request.method === 'POST') {
        return handleForgotPassword(request, env, corsHeaders);
      } else if (path === '/api/reset-password' && request.method === 'POST') {
        return handleResetPassword(request, env, corsHeaders);
      } else if ((path === '/send-test' || path === '/api/send-test') && request.method === 'POST') {
        return handleSendTest(request, env, corsHeaders);
      } else if (path === '/api/test/delete-accounts-by-email' && request.method === 'POST') {
        return handleTestDeleteAccountsByEmail(request, env, corsHeaders, executionCtx);
      } else if (path === '/api/test/search-accounts' && request.method === 'POST') {
        return handleTestSearchAccounts(request, env, corsHeaders);
      } else if (path === '/api/chess/sync' && request.method === 'POST') {
        return handleChessSync(request, env, corsHeaders);
      } else if (path === '/api/chess/season-claim' && request.method === 'POST') {
        return handleChessSeasonClaim(request, env, corsHeaders);
      } else if (path === '/api/chess/season-reset' && request.method === 'POST') {
        return handleChessSeasonReset(request, env, corsHeaders);
      } else if (path === '/api/chess/load' && request.method === 'GET') {
        return handleChessLoad(request, env, corsHeaders);
      } else if (path === '/api/chess/leaderboard' && request.method === 'GET') {
        return handleChessLeaderboardGet(request, env, corsHeaders);
      } else if (path === '/api/dungeon/slots' && request.method === 'GET') {
        return handleDungeonSlots(request, env, corsHeaders);
      } else if (path === '/api/dungeon/save' && request.method === 'POST') {
        return handleDungeonSave(request, env, corsHeaders);
      } else if (path === '/api/dungeon/load' && request.method === 'POST') {
        return handleDungeonLoad(request, env, corsHeaders);
      } else if (path === '/api/dungeon/delete' && request.method === 'POST') {
        return handleDungeonDelete(request, env, corsHeaders);
      } else if (path === '/api/classify/sync' && request.method === 'POST') {
        return handleClassifySync(request, env, corsHeaders);
      } else if (path === '/api/classify/load' && request.method === 'GET') {
        return handleClassifyLoad(request, env, corsHeaders);
      } else if (path === '/api/kyrachyng/progress/sync' && request.method === 'POST') {
        return handleKyrachyngProgressSync(request, env, corsHeaders);
      } else if (path === '/api/kyrachyng/progress/load' && request.method === 'GET') {
        return handleKyrachyngProgressLoad(request, env, corsHeaders);
      } else if (path.startsWith('/api/tether/')) {
        const tetherRes = await handleTetherRequest(request, env, corsHeaders, path);
        if (tetherRes) return tetherRes;
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (path === '/api/debug' && request.method === 'GET') {
        const testEmail = url.searchParams.get('email') || 'debug@test.com';
        const userId = generateUserId(testEmail);
        const userAccountId = env.USER_ACCOUNT.idFromName(userId);
        const userAccount = env.USER_ACCOUNT.get(userAccountId);
        
        const debugReq = new Request('http://do/debug', { method: 'GET' });
        const debugRes = await userAccount.fetch(debugReq);
        const debugData = await debugRes.json();
        const sender = String(env.SENDER_EMAIL || env.VERIFICATION_FROM_EMAIL || '').trim();
        
        return new Response(JSON.stringify({
          email: testEmail,
          userId,
          emailService: {
            bindingPresent: Boolean(getCloudflareEmailBinding(env)),
            transactionalBinding: Boolean(env.EMAIL_TRANSACTIONAL),
            legacyEmailBinding: Boolean(env.EMAIL),
            resendConfigured: Boolean(env.RESEND_API_KEY),
            transactionalEmailVia: String(env.TRANSACTIONAL_EMAIL_VIA || '').trim() || 'cloudflare_then_resend',
            senderEnvConfigured: Boolean(sender),
            senderEmail: sender || null,
          },
          emailHelp: {
            signupShowsWhy: 'On failed signup mail, JSON includes emailSendError { code, message, hint }.',
            checkLogs: 'Workers → chess-accounts → Logs (grep EmailService send failed).',
            codesDoc: 'https://developers.cloudflare.com/email-service/api/send-emails/workers-api/#error-codes',
          },
          ...debugData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } else {
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await handleScheduledCron(controller, env);
        await handleSportsDigestScheduledCron(controller, env);
      })().catch((err) => {
        console.error('scheduled cron failed', err?.stack || err?.message || err);
      })
    );
  },
};

// Signup handler
/** Same email gates as POST /api/signup (format, disposable list, MX) plus account slot check. */
async function evaluateSignupEmailForCreate(env, emailRaw) {
  const normalizedEmail = normalizeEmail(emailRaw);
  const steps = [];

  if (!normalizedEmail) {
    steps.push({ id: 'email', ok: false, message: 'Missing required fields' });
    return {
      ok: false,
      normalizedEmail: '',
      userId: '',
      accountExists: false,
      steps,
      signupError: 'Missing required fields',
    };
  }

  steps.push({ id: 'email', ok: true, normalizedEmail });

  if (!isLikelyRealEmail(normalizedEmail)) {
    const domain = normalizedEmail.slice(normalizedEmail.indexOf('@') + 1);
    steps.push({
      id: 'real_email',
      ok: false,
      message: 'Please use a real email address',
      disposableDomain: DISPOSABLE_EMAIL_DOMAINS.has(domain),
    });
    return {
      ok: false,
      normalizedEmail,
      userId: generateUserId(normalizedEmail),
      accountExists: false,
      steps,
      signupError: 'Please use a real email address',
    };
  }

  steps.push({ id: 'real_email', ok: true });

  const signupDomain = normalizedEmail.slice(normalizedEmail.indexOf('@') + 1);
  const domainOk = await verifySignupEmailDomain(signupDomain);
  if (!domainOk) {
    const mxMessage =
      'That email domain is not set up to receive mail (no working mail servers / MX records). Use a real inbox (Gmail, iCloud, Outlook, your school/work, etc.).';
    steps.push({ id: 'mx', ok: false, message: mxMessage, domain: signupDomain });
    return {
      ok: false,
      normalizedEmail,
      userId: generateUserId(normalizedEmail),
      accountExists: false,
      steps,
      signupError: mxMessage,
    };
  }

  steps.push({ id: 'mx', ok: true, domain: signupDomain });

  const userId = generateUserId(normalizedEmail);
  const userAccount = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId));
  let accountExists = false;
  let accountUsername = '';
  let accountEmailVerified = null;
  let legacyEmailNotOnFile = false;
  try {
    const dataRes = await userAccount.fetch(new Request('http://do/getData', { method: 'GET' }));
    const row = await dataRes.json();
    if (userAccountProfileExists(row)) {
      accountExists = true;
      accountUsername = row.username != null ? String(row.username) : '';
      const storedEmail = row.email != null ? normalizeEmail(String(row.email)) : '';
      legacyEmailNotOnFile = !storedEmail;
      if (row.emailVerified === true) accountEmailVerified = true;
      else if (row.emailVerified === false) accountEmailVerified = false;
      else if (legacyEmailNotOnFile) accountEmailVerified = null;
    }
  } catch {
    accountExists = false;
  }

  if (accountExists) {
    steps.push({
      id: 'account_slot',
      ok: false,
      message: legacyEmailNotOnFile
        ? 'User already exists (legacy account — email not saved on profile yet)'
        : 'User already exists',
      userId,
      username: accountUsername,
      emailVerified: accountEmailVerified,
      legacyEmailNotOnFile,
    });
    return {
      ok: false,
      normalizedEmail,
      userId,
      accountExists: true,
      accountUsername,
      accountEmailVerified,
      legacyEmailNotOnFile,
      steps,
      signupError: 'User already exists',
    };
  }

  steps.push({ id: 'account_slot', ok: true, userId, message: 'No account for this email yet' });

  return {
    ok: true,
    normalizedEmail,
    userId,
    accountExists: false,
    steps,
    signupError: null,
  };
}

async function handleSignup(request, env, corsHeaders) {
  const { email, password, username } = await request.json();
  const normalizedEmail = normalizeEmail(email);
  const normalizedUsername = normalizeUsernameForIndex(username);

  if (!normalizedEmail || !password || !username || !normalizedUsername) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const emailEval = await evaluateSignupEmailForCreate(env, normalizedEmail);
  if (!emailEval.ok) {
    return new Response(JSON.stringify({ error: emailEval.signupError || 'Invalid email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = emailEval.userId;
  console.log('Signup - email:', normalizedEmail, 'userId:', userId);

  // Reserve username globally (case-insensitive) before creating the user.
  const usernameRegistryId = env.USERNAME_REGISTRY.idFromName('global');
  const usernameRegistry = env.USERNAME_REGISTRY.get(usernameRegistryId);
  const reserveUsernameReq = new Request('http://do/reserve', {
    method: 'POST',
    body: JSON.stringify({ username: normalizedUsername, userId }),
  });
  const reserveUsernameRes = await usernameRegistry.fetch(reserveUsernameReq);
  let reserveUsernameData = null;
  try {
    reserveUsernameData = await reserveUsernameRes.json();
  } catch {
    reserveUsernameData = null;
  }
  if (!reserveUsernameRes.ok || !reserveUsernameData?.success) {
    return new Response(JSON.stringify({ error: reserveUsernameData?.error || 'Username is already taken' }), {
      status: reserveUsernameRes.status === 409 ? 409 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  // Create user via DO fetch
  let result = null;
  try {
    const createReq = new Request('http://do/create', {
      method: 'POST',
      body: JSON.stringify({ email: normalizedEmail, password, username })
    });
    const createRes = await userAccount.fetch(createReq);
    result = await createRes.json();
  } catch (error) {
    const releaseUsernameReq = new Request('http://do/release', {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsername, userId }),
    });
    await usernameRegistry.fetch(releaseUsernameReq);
    throw error;
  }

  if (!result?.success) {
    const releaseUsernameReq = new Request('http://do/release', {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsername, userId }),
    });
    await usernameRegistry.fetch(releaseUsernameReq);
    return new Response(JSON.stringify({ error: result?.error || 'Signup failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Generate verification token
  const verificationToken = generateVerificationToken();
  
  // Store verification token in user account
  const setTokenReq = new Request('http://do/setVerificationToken', {
    method: 'POST',
    body: JSON.stringify({ token: verificationToken })
  });
  await userAccount.fetch(setTokenReq);

  let verificationEmailSent = false;
  let emailSendError = null;
  try {
    await sendVerificationEmail(env, normalizedEmail, username, verificationToken);
    verificationEmailSent = true;
  } catch (error) {
    emailSendError = summarizeEmailSendError(error);
    console.error(
      'Failed to send verification email:',
      emailSendError.code,
      emailSendError.message,
      emailSendError.hint || ''
    );
  }

  if (!verificationEmailSent) {
    const delReq = new Request('http://do/deleteAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    await userAccount.fetch(delReq);
    const releaseUsernameReq = new Request('http://do/release', {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsername, userId }),
    });
    await usernameRegistry.fetch(releaseUsernameReq);
    const clientMsg =
      emailSendError?.hint ||
      emailSendError?.message ||
      'We could not send a confirmation email to that address. Check for typos or try another inbox.';
    return new Response(JSON.stringify({ error: clientMsg, emailSendError }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      needsEmailVerification: true,
      userId,
      username,
      email: normalizedEmail,
      message:
        'Check your email and open the confirmation link to finish setting up your account. You can sign in only after you confirm.',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Change password handler
async function handleChangePassword(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (String(newPassword).length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);

  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const changeReq = new Request('http://do/changePassword', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const changeRes = await userAccount.fetch(changeReq);
  const result = await changeRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Change password failed' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleResendWelcomeEmail(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getDataReq);
  const row = await dataRes.json();

  if (!row || typeof row !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = normalizeEmail(row.email || '');
  const username = row.username || 'there';
  if (!email || !isLikelyRealEmail(email)) {
    return new Response(JSON.stringify({ error: 'No valid email on file' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await sendWelcomeGuideEmail(env, email, username);
  } catch (err) {
    const w = summarizeEmailSendError(err);
    console.error('Resend welcome email failed:', w.code, w.message, w.hint || '');
    const clientMsg = w.hint || w.message || 'Could not send email.';
    return new Response(JSON.stringify({ success: false, error: clientMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Check your inbox for your info email.' }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleSendDailyChallengesNow(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;

  if (env.DAILY_DIGEST_KV) {
    const cooldownKey = `instant-digest:${userId}`;
    const hit = await env.DAILY_DIGEST_KV.get(cooldownKey);
    if (hit) {
      return new Response(
        JSON.stringify({
          error: 'Please wait a couple of minutes before requesting another send.',
        }),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getDataReq);
  const row = await dataRes.json();

  if (!row || typeof row !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = normalizeEmail(row.email || '');
  const username = row.username || 'there';
  if (!email || !isLikelyRealEmail(email)) {
    return new Response(JSON.stringify({ error: 'No valid email on file' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (row.emailVerified === false) {
    return new Response(
      JSON.stringify({
        error:
          'Confirm your email address first (link in your signup email). Then you can request challenge emails here.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const now = new Date();
  const digestDateStr = utcDateString(now);
  const ids = getDailyChallengeIdsForUtcDate(digestDateStr);

  try {
    await sendDailyDigestEmail(env, { email, username }, ids, { instant: true });
    if (env.DAILY_DIGEST_KV) {
      await env.DAILY_DIGEST_KV.put(`instant-digest:${userId}`, '1', { expirationTtl: 120 });
    }
  } catch (err) {
    const w = summarizeEmailSendError(err);
    console.error('Send daily challenges now failed:', w.code, w.message, w.hint || '');
    return new Response(
      JSON.stringify({
        success: false,
        error: w.hint || w.message || 'Email could not be sent. Try again later.',
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Check your inbox for today’s TrifangX daily challenges.',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleChangeUsername(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { newUsername, password } = body;
  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({ error: 'Password is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (newUsername == null || String(newUsername).trim() === '') {
    return new Response(JSON.stringify({ error: 'New username is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const changeReq = new Request('http://do/changeUsername', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newUsername: String(newUsername).trim(), password }),
  });
  const changeRes = await userAccount.fetch(changeReq);
  const result = await changeRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Could not change username' }), {
      status: changeRes.status === 409 ? 409 : 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (env.DAILY_DIGEST_KV) {
    try {
      const key = `sub:${userId}`;
      const prev = await env.DAILY_DIGEST_KV.get(key, 'json');
      if (prev && typeof prev === 'object' && typeof prev.email === 'string') {
        await env.DAILY_DIGEST_KV.put(
          key,
          JSON.stringify({
            ...prev,
            username: result.username || String(newUsername).trim(),
          })
        );
      }
    } catch (e) {
      console.error('digest KV username refresh failed:', e?.message || e);
    }
  }

  return new Response(JSON.stringify({ success: true, username: result.username }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleLeaderboardRowColor(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const doReq = new Request('http://do/setLeaderboardRowColor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const doRes = await userAccount.fetch(doReq);
  const result = await doRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Could not save color' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      leaderboardRowColor: result.leaderboardRowColor ?? null,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/** Set equipped leaderboard flair (prefix/suffix/title/frame) from unlocked season rewards only. */
async function handleChessLbFlair(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  if (!userResult.userId) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const doReq = new Request('http://do/setChessLbFlair', {
    method: 'POST',
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  const doRes = await userAccount.fetch(doReq);
  const result = await doRes.json();
  const ok = Boolean(result?.success);
  return new Response(JSON.stringify(result), {
    status: ok ? 200 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Delete account (requires session + current password; destroys session)
async function handleDeleteAccount(request, env, corsHeaders, executionCtx) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { password } = body;
  if (!password || typeof password !== 'string') {
    return new Response(JSON.stringify({ error: 'Password is required to delete your account' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);

  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const userDataReq = new Request('http://do/getData', { method: 'GET' });
  const userDataRes = await userAccount.fetch(userDataReq);
  const userData = await userDataRes.json();
  const usernameForRelease = normalizeUsernameForIndex(userData?.username);
  const emailForDeletionNotice = normalizeEmail(userData?.email || '');
  const displayNameForDeletionNotice = userData?.username || 'there';

  const delReq = new Request('http://do/deleteAccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const delRes = await userAccount.fetch(delReq);
  const result = await delRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Could not delete account' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await purgeAccountSideEffects(env, userResult.userId, usernameForRelease);

  const notifyDeleted = () =>
    sendAccountDeletedEmail(env, emailForDeletionNotice, displayNameForDeletionNotice).catch((err) => {
      const w = summarizeEmailSendError(err);
      console.error('Account deleted email failed:', w.code, w.message, w.hint || '');
    });
  if (emailForDeletionNotice && executionCtx && typeof executionCtx.waitUntil === 'function') {
    executionCtx.waitUntil(notifyDeleted());
  } else if (emailForDeletionNotice) {
    await notifyDeleted();
  }

  const destroyReq = new Request('http://do/destroy', { method: 'POST' });
  await session.fetch(destroyReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function purgeAccountSideEffects(env, userId, usernameForRelease) {
  if (env.DAILY_DIGEST_KV) {
    try {
      await env.DAILY_DIGEST_KV.delete(`sub:${userId}`);
    } catch (e) {
      console.error('delete digest KV key failed', e?.message || e);
    }
  }

  if (env.SPORTS_DIGEST_KV) {
    try {
      await env.SPORTS_DIGEST_KV.delete(`sub:${userId}`);
    } catch (e) {
      console.error('delete sports digest KV key failed', e?.message || e);
    }
  }

  if (env.CHESS_LEADERBOARD_KV) {
    try {
      await removeChessLeaderboardUser(env.CHESS_LEADERBOARD_KV, userId);
    } catch (e) {
      console.error('delete chess leaderboard KV failed', e?.message || e);
    }
  }

  if (usernameForRelease) {
    const usernameRegistryId = env.USERNAME_REGISTRY.idFromName('global');
    const usernameRegistry = env.USERNAME_REGISTRY.get(usernameRegistryId);
    const releaseUsernameReq = new Request('http://do/release', {
      method: 'POST',
      body: JSON.stringify({ username: usernameForRelease, userId }),
    });
    await usernameRegistry.fetch(releaseUsernameReq);
  }
}

function testSecretOk(env, request) {
  const provided = request.headers.get('X-Test-Secret') || '';
  for (const key of [env.ACCOUNT_DELETE_SECRET, env.TEST_SECRET]) {
    if (typeof key === 'string' && key && timingSafeEqualStrings(provided, key)) return true;
  }
  return false;
}

async function forceDeleteUserRecord(env, resolved, executionCtx, { sendEmail = false } = {}) {
  const stub = userAccountStubFromUserId(env, resolved.userId);
  if (!stub) {
    return { success: false, error: 'Account not found' };
  }
  const userAccount = stub;
  const userDataReq = new Request('http://do/getData', { method: 'GET' });
  const userDataRes = await userAccount.fetch(userDataReq);
  const userData = await userDataRes.json();
  const usernameForRelease = normalizeUsernameForIndex(userData?.username);
  const emailForDeletionNotice = normalizeEmail(userData?.email || resolved.email || '');
  const displayNameForDeletionNotice = userData?.username || resolved.username || 'there';

  const delRes = await userAccount.fetch(
    new Request('http://do/adminForceDeleteAccount', { method: 'POST', body: '{}' })
  );
  const result = await delRes.json();
  if (!result.success) {
    return { success: false, error: result.error || 'Could not delete account' };
  }

  await purgeAccountSideEffects(env, resolved.userId, usernameForRelease);

  if (sendEmail && emailForDeletionNotice) {
    const notifyDeleted = () =>
      sendAccountDeletedEmail(env, emailForDeletionNotice, displayNameForDeletionNotice).catch((err) => {
        const w = summarizeEmailSendError(err);
        console.error('Account deleted email failed:', w.code, w.message, w.hint || '');
      });
    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      executionCtx.waitUntil(notifyDeleted());
    } else {
      await notifyDeleted();
    }
  }

  return {
    success: true,
    userId: resolved.userId,
    email: emailForDeletionNotice,
    username: displayNameForDeletionNotice,
  };
}

async function findAccountsMatchingUsernames(env, wantedUsernames) {
  const targets = new Set(wantedUsernames.map((u) => normalizeUsernameForIndex(u)).filter(Boolean));
  if (!targets.size) return [];

  const { stubs } = await enumerateAllUserAccountStubsForLeaderboard(env);
  const matches = [];
  const seenUserIds = new Set();
  const batch = 10;

  for (let i = 0; i < stubs.length; i += batch) {
    const slice = stubs.slice(i, i + batch);
    const rows = await Promise.all(
      slice.map(async (stubOrEntry) => {
        const stub = unwrapUserAccountStub(stubOrEntry);
        try {
          const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
          const row = await dataRes.json();
          const stubUserId = userAccountStubIdString(stubOrEntry);
          return { row, stubUserId };
        } catch {
          return { row: null, stubUserId: userAccountStubIdString(stubOrEntry) };
        }
      })
    );

    for (const { row, stubUserId } of rows) {
      if (!row || typeof row !== 'object') continue;
      const userId = row.userId != null ? String(row.userId).trim() : stubUserId;
      if (!userId || seenUserIds.has(userId)) continue;

      const un = normalizeUsernameForIndex(row.username);
      const emailNorm = normalizeEmail(row.email || '');
      const emailLocal = emailNorm.includes('@') ? emailNorm.split('@')[0] : emailNorm;
      const emailLocalNorm = normalizeUsernameForIndex(emailLocal);

      let matchedUsername = '';
      if (un && targets.has(un)) matchedUsername = String(row.username || un);
      else if (emailLocalNorm && targets.has(emailLocalNorm)) matchedUsername = String(row.username || emailLocal);

      if (!matchedUsername) continue;

      seenUserIds.add(userId);
      matches.push({
        ok: true,
        userId,
        email: emailNorm,
        username: row.username != null ? String(row.username) : matchedUsername,
        matchedUsername,
      });
    }
  }

  return matches;
}

/** TEST_SECRET: delete one or more accounts by email without password. Body: { "emails": ["a@b.com"], "sendEmail": false } */
async function handleTestDeleteAccountsByEmail(request, env, corsHeaders, executionCtx) {
  if (!testSecretOk(env, request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const emails = Array.isArray(body.emails)
    ? body.emails
        .filter((e) => typeof e === 'string')
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
    : [];
  const usernames = Array.isArray(body.usernames)
    ? body.usernames.filter((u) => typeof u === 'string').map((u) => String(u).trim()).filter(Boolean)
    : [];
  const userIds = Array.isArray(body.userIds)
    ? body.userIds.filter((u) => typeof u === 'string').map((u) => String(u).trim()).filter(Boolean)
    : [];
  if (!emails.length && !usernames.length && !userIds.length) {
    return new Response(
      JSON.stringify({
        error: 'Send { "emails": ["you@example.com"] }, { "usernames": ["name"] }, and/or { "userIds": ["..."] }',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const sendEmail = body.sendEmail === true;
  const results = [];
  const unresolvedUsernames = [];

  for (const userId of userIds) {
    const resolved = await resolveAdminUserTarget(env, { userId });
    if (!resolved.ok) {
      results.push({ userId, success: false, error: resolved.error });
      continue;
    }
    const del = await forceDeleteUserRecord(env, resolved, executionCtx, { sendEmail });
    results.push({ userId, ...del });
  }

  for (const email of emails) {
    const resolved = await resolveAdminUserTarget(env, { email });
    if (!resolved.ok) {
      results.push({ email, success: false, error: resolved.error });
      continue;
    }
    const del = await forceDeleteUserRecord(env, resolved, executionCtx, { sendEmail });
    results.push({ email, ...del });
  }

  for (const username of usernames) {
    const resolved = await resolveAdminUserTarget(env, { username });
    if (!resolved.ok) {
      unresolvedUsernames.push(username);
      continue;
    }
    const del = await forceDeleteUserRecord(env, resolved, executionCtx, { sendEmail });
    results.push({ username, ...del });
  }

  if (unresolvedUsernames.length) {
    const scanMatches = await findAccountsMatchingUsernames(env, unresolvedUsernames);
    const matchedKeys = new Set(scanMatches.map((m) => normalizeUsernameForIndex(m.matchedUsername)));
    for (const username of unresolvedUsernames) {
      const key = normalizeUsernameForIndex(username);
      const hit = scanMatches.find(
        (m) =>
          normalizeUsernameForIndex(m.matchedUsername) === key ||
          normalizeUsernameForIndex(m.username) === key
      );
      if (!hit) {
        results.push({ username, success: false, error: 'Account not found' });
        continue;
      }
      const del = await forceDeleteUserRecord(env, hit, executionCtx, { sendEmail });
      results.push({ username, ...del });
      matchedKeys.delete(key);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** TEST_SECRET: search accounts by substring in username or email. Body: { "query": "matthew" } */
async function handleTestSearchAccounts(request, env, corsHeaders) {
  if (!testSecretOk(env, request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const query = body.query != null ? String(body.query).trim().toLowerCase() : '';
  if (!query) {
    return new Response(JSON.stringify({ error: 'Send { "query": "matthew" }' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { stubs } = await enumerateAllUserAccountStubsForLeaderboard(env);
  const matches = [];
  const batch = 10;

  for (let i = 0; i < stubs.length; i += batch) {
    const slice = stubs.slice(i, i + batch);
    const rows = await Promise.all(
      slice.map(async (stubOrEntry) => {
        const stub = unwrapUserAccountStub(stubOrEntry);
        try {
          const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
          const row = await dataRes.json();
          return { row, stubUserId: userAccountStubIdString(stubOrEntry) };
        } catch {
          return { row: null, stubUserId: userAccountStubIdString(stubOrEntry) };
        }
      })
    );

    for (const { row, stubUserId } of rows) {
      if (!row || typeof row !== 'object') continue;
      const userId = row.userId != null ? String(row.userId).trim() : stubUserId;
      const username = row.username != null ? String(row.username) : '';
      const email = normalizeEmail(row.email || '');
      const hay = `${username} ${email} ${userId}`.toLowerCase();
      if (!hay.includes(query)) continue;
      matches.push({ userId, username, email });
    }
  }

  return new Response(JSON.stringify({ success: true, query, count: matches.length, matches }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Backfill USERNAME_REGISTRY for accounts created before registry existed (idempotent reserve). */
async function ensureUsernameRegistryEntry(env, userId, usernameDisplay) {
  if (!userId || usernameDisplay == null) return;
  const key = normalizeUsernameForIndex(String(usernameDisplay));
  if (!key) return;
  try {
    const usernameRegistryId = env.USERNAME_REGISTRY.idFromName('global');
    const usernameRegistry = env.USERNAME_REGISTRY.get(usernameRegistryId);
    const reserveReq = new Request('http://do/reserve', {
      method: 'POST',
      body: JSON.stringify({ username: key, userId }),
    });
    await usernameRegistry.fetch(reserveReq);
  } catch (e) {
    console.error('ensureUsernameRegistryEntry', e);
  }
}

// Login handler — username (registry) or email (same userId as signup); then password check.
async function handleLogin(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const { password, username: loginIdentifier } = body;
  const raw = typeof loginIdentifier === 'string' ? loginIdentifier.trim() : '';

  if (!raw || password == null || typeof password !== 'string' || password === '') {
    return new Response(JSON.stringify({ error: 'Missing username or password' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let userId = null;
  let normalizedUsernameKey = '';

  const emailNorm = normalizeEmail(raw);
  const useEmailLogin = looksLikeEmailForLogin(raw);

  if (useEmailLogin) {
    userId = generateUserId(emailNorm);
  } else {
    normalizedUsernameKey = normalizeUsernameForIndex(raw);
    if (!normalizedUsernameKey) {
      return new Response(JSON.stringify({ error: 'Missing username or password' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const usernameRegistryId = env.USERNAME_REGISTRY.idFromName('global');
    const usernameRegistry = env.USERNAME_REGISTRY.get(usernameRegistryId);
    const resolveReq = new Request('http://do/resolve', {
      method: 'POST',
      body: JSON.stringify({ username: normalizedUsernameKey }),
    });
    const resolveRes = await usernameRegistry.fetch(resolveReq);
    let resolveData = null;
    try {
      resolveData = await resolveRes.json();
    } catch {
      resolveData = null;
    }
    userId = resolveData?.userId;
    if (!resolveRes.ok || !userId) {
      return new Response(
        JSON.stringify({
          error:
            'No account found for this username. Older accounts may not be in the username directory yet — sign in with your email address once; after that, username sign-in will work.',
          code: 'USERNAME_NOT_IN_REGISTRY',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const getDataPreAuth = new Request('http://do/getData', { method: 'GET' });
  const preDataRes = await userAccount.fetch(getDataPreAuth);
  const preUserData = await preDataRes.json();
  if (preUserData == null || typeof preUserData !== 'object') {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (useEmailLogin) {
    const storedEmail = normalizeEmail(preUserData.email);
    if (!storedEmail || storedEmail !== emailNorm) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } else {
    // Registry already mapped this username to userId. Only enforce match when a username
    // is stored (legacy accounts may have omitted it; password still proves identity).
    const storedName = preUserData.username;
    if (storedName != null && String(storedName).trim() !== '') {
      if (normalizedUsernameKey !== normalizeLoginUsername(storedName)) {
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
  }

  const authReq = new Request('http://do/authenticate', {
    method: 'POST',
    body: JSON.stringify({ password })
  });
  
  const authRes = await userAccount.fetch(authReq);
  const result = await authRes.json();
  
  if (!result.success) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (preUserData.emailVerified === false) {
    return new Response(
      JSON.stringify({
        error:
          'Confirm your email first — open the link we sent when you signed up. Then you can sign in here.',
        code: 'EMAIL_NOT_VERIFIED',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (preUserData.username && String(preUserData.username).trim() !== '') {
    await ensureUsernameRegistryEntry(env, userId, preUserData.username);
  }

  // Create session
  const sessionId = generateSessionId();
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const sessionReq = new Request('http://do/create', {
    method: 'POST',
    body: JSON.stringify({ userId })
  });
  await session.fetch(sessionReq);

  return new Response(JSON.stringify({ 
    success: true, 
    sessionId,
    userId,
    username: preUserData?.username || normalizedUsernameKey || 'Player',
    email: preUserData?.email || null
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Logout handler
async function handleLogout(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const destroyReq = new Request('http://do/destroy', {
    method: 'POST'
  });
  await session.fetch(destroyReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Sync handler
async function handleSync(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', {
    method: 'GET'
  });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const userData = await request.json();
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const updateReq = new Request('http://do/updateData', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
  await userAccount.fetch(updateReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Chess sync handler - saves all chess data to cloud
async function handleChessSync(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const chessData = await request.json();
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const updateReq = new Request('http://do/updateChessData', {
    method: 'POST',
    body: JSON.stringify(chessData)
  });
  await userAccount.fetch(updateReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Claim one season-track step (same rewards as in-game); validates achievements server-side. */
async function handleChessSeasonClaim(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);

  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const claimReq = new Request('http://do/claimSeasonStep', {
    method: 'POST',
    body: JSON.stringify(body && typeof body === 'object' ? body : {}),
  });
  const claimRes = await userAccount.fetch(claimReq);
  const result = await claimRes.json();
  const ok = Boolean(result?.success);
  return new Response(JSON.stringify(result), {
    status: ok ? 200 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Reset current UTC month season track (progress + this month’s track rewards only). */
async function handleChessSeasonReset(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  if (!userResult.userId) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const resetReq = new Request('http://do/resetSeasonTrack', { method: 'POST', body: '{}' });
  const resetRes = await userAccount.fetch(resetReq);
  const result = await resetRes.json();
  const ok = Boolean(result?.success);
  return new Response(JSON.stringify(result), {
    status: ok ? 200 : 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Chess load handler - loads all chess data from cloud
async function handleChessLoad(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const getDataReq = new Request('http://do/getChessData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getDataReq);
  const chessData = await dataRes.json();

  return new Response(JSON.stringify(chessData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Dungeon slots handler - get all save slots
async function handleDungeonSlots(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const getSlotsReq = new Request('http://do/getDungeonSlots', { method: 'GET' });
  const slotsRes = await userAccount.fetch(getSlotsReq);
  const slotsData = await slotsRes.json();

  return new Response(JSON.stringify(slotsData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Dungeon save handler - save to specific slot
async function handleDungeonSave(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const { slot, data, name } = await request.json();
  
  if (!slot || !['slot1', 'slot2', 'slot3'].includes(slot)) {
    return new Response(JSON.stringify({ error: 'Invalid slot' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const saveReq = new Request('http://do/saveDungeonSlot', {
    method: 'POST',
    body: JSON.stringify({ slot, data, name })
  });
  await userAccount.fetch(saveReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Dungeon load handler - load from specific slot
async function handleDungeonLoad(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const { slot } = await request.json();
  
  if (!slot || !['slot1', 'slot2', 'slot3'].includes(slot)) {
    return new Response(JSON.stringify({ error: 'Invalid slot' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const loadReq = new Request('http://do/loadDungeonSlot', {
    method: 'POST',
    body: JSON.stringify({ slot })
  });
  const loadRes = await userAccount.fetch(loadReq);
  const slotData = await loadRes.json();

  return new Response(JSON.stringify(slotData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Dungeon delete handler - delete specific slot
async function handleDungeonDelete(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userId = userResult.userId;
  const { slot } = await request.json();
  
  if (!slot || !['slot1', 'slot2', 'slot3'].includes(slot)) {
    return new Response(JSON.stringify({ error: 'Invalid slot' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const deleteReq = new Request('http://do/deleteDungeonSlot', {
    method: 'POST',
    body: JSON.stringify({ slot })
  });
  await userAccount.fetch(deleteReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleClassifySync(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const classifyData = await request.json();
  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const updateReq = new Request('http://do/updateClassifyData', {
    method: 'POST',
    body: JSON.stringify(classifyData)
  });
  await userAccount.fetch(updateReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleClassifyLoad(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getReq = new Request('http://do/getClassifyData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getReq);
  const classifyData = await dataRes.json();

  return new Response(JSON.stringify(classifyData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleKyrachyngProgressSync(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const payload = await request.json();
  const completed = Array.isArray(payload?.completed)
    ? payload.completed.filter(x => typeof x === 'string')
    : [];

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const updateReq = new Request('http://do/updateKyrachyngProgress', {
    method: 'POST',
    body: JSON.stringify({ completed })
  });
  await userAccount.fetch(updateReq);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleKyrachyngProgressLoad(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getReq = new Request('http://do/getKyrachyngProgress', { method: 'GET' });
  const dataRes = await userAccount.fetch(getReq);
  const progressData = await dataRes.json();

  return new Response(JSON.stringify(progressData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleEmailPreferences(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const hasEmails = typeof body.dailyChallengeEmails === 'boolean';

  if (!hasEmails) {
    return new Response(JSON.stringify({ error: 'Send dailyChallengeEmails (boolean)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const getExistingReq = new Request('http://do/getData', { method: 'GET' });
  const existingRes = await userAccount.fetch(getExistingReq);
  const existingProfile = await existingRes.json();
  if (!existingProfile || typeof existingProfile !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (hasEmails && body.dailyChallengeEmails === true && existingProfile.emailVerified === false) {
    return new Response(
      JSON.stringify({
        error:
          'Confirm your email address before turning on daily challenge emails. Use the link in the message we sent when you signed up (or sign up again if it failed).',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (hasEmails && body.dailyChallengeEmails === true) {
    const emCheck = normalizeEmail(existingProfile.email || '');
    if (!emCheck || !isLikelyRealEmail(emCheck)) {
      return new Response(
        JSON.stringify({
          error:
            'Your account needs a deliverable email address before daily challenge emails can be turned on. Update your email in account settings if needed.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const wasDigestOn =
    existingProfile.emailPreferences && existingProfile.emailPreferences.dailyChallengeEmails === true;

  const setPayload = { dailyChallengeEmails: body.dailyChallengeEmails };

  const setReq = new Request('http://do/setEmailPreferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(setPayload),
  });
  const setRes = await userAccount.fetch(setReq);
  const setResult = await setRes.json();

  if (!setResult.success) {
    return new Response(JSON.stringify({ error: setResult.error || 'Could not save preferences' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes2 = await userAccount.fetch(getDataReq);
  const fresh = await dataRes2.json();

  if (!fresh || typeof fresh !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prefs = fresh.emailPreferences || {};
  const email = normalizeEmail(fresh.email || '');
  const username = fresh.username || 'there';

  let digestWelcomeSent = false;
  let digestWelcomeError = null;

  if (env.DAILY_DIGEST_KV) {
    const key = `sub:${userId}`;
    try {
      if (prefs.dailyChallengeEmails) {
        let prev = null;
        try {
          prev = await env.DAILY_DIGEST_KV.get(key, 'json');
        } catch {
          prev = null;
        }
        await env.DAILY_DIGEST_KV.put(
          key,
          JSON.stringify({
            email,
            username,
            lastDigestLocalYmd:
              prev && typeof prev === 'object' && typeof prev.lastDigestLocalYmd === 'string'
                ? prev.lastDigestLocalYmd
                : undefined,
          })
        );

        // First-time opt-in: send today's list immediately so users are not waiting for the next daily send.
        // Set lastDigestLocalYmd to today's digest calendar date (UTC) so the scheduled job does not duplicate the same day.
        const digestOptIn =
          hasEmails &&
          body.dailyChallengeEmails === true &&
          !wasDigestOn &&
          prefs.dailyChallengeEmails === true &&
          hasConfirmedEmailForProductMail(fresh) &&
          email &&
          isLikelyRealEmail(email);
        if (digestOptIn) {
          const now = new Date();
          const digestYmd = utcDateString(now);
          const ids = getDailyChallengeIdsForUtcDate(digestYmd);
          try {
            await sendDailyDigestEmail(env, { email, username }, ids, { instant: true });
            digestWelcomeSent = true;
            await env.DAILY_DIGEST_KV.put(
              key,
              JSON.stringify({
                email,
                username,
                lastDigestLocalYmd: digestYmd,
              })
            );
          } catch (e) {
            const w = summarizeEmailSendError(e);
            digestWelcomeError = w.hint || w.message || String(e?.message || e);
            console.error('digest opt-in welcome send failed:', digestWelcomeError);
          }
        }
      } else {
        await env.DAILY_DIGEST_KV.delete(key);
      }
    } catch (e) {
      console.error('email-preferences KV update failed:', e?.message || e);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not update challenge-email subscription storage. Try again later.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } else if (prefs.dailyChallengeEmails) {
    console.warn('email-preferences: DAILY_DIGEST_KV is not bound; daily challenge emails will not be delivered');
  }

  let warning;
  if (!env.DAILY_DIGEST_KV && prefs.dailyChallengeEmails) {
    warning =
      'Challenge-email list storage is not configured on this Worker; opt-in saved but scheduled sends require DAILY_DIGEST_KV.';
  }
  if (digestWelcomeError) {
    const tail =
      ' You can use “Email daily challenges now” on the dashboard, or wait for the next automatic daily send.';
    warning = (warning ? `${warning} ` : '') + `Today's welcome digest could not be sent: ${digestWelcomeError}.${tail}`;
  }

  return new Response(
    JSON.stringify({
      success: true,
      emailPreferences: prefs,
      ...(warning ? { warning } : {}),
      ...(digestWelcomeSent ? { digestWelcomeSent: true } : {}),
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleHeaderNavPreferences(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!body || !Array.isArray(body.items)) {
    return new Response(JSON.stringify({ error: 'Send items (array of nav id strings)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();

  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = userResult.userId;
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const doReq = new Request('http://do/setHeaderNavItems', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: body.items }),
  });
  const doRes = await userAccount.fetch(doReq);
  const result = await doRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Could not save header links' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      headerNavItems: result.headerNavItems,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

function handleSportsDigestCatalog(corsHeaders) {
  return new Response(
    JSON.stringify({
      teams: SPORTS_DIGEST_TEAM_CATALOG,
      leagues: SPORTS_DIGEST_LEAGUES,
      presets: SPORTS_DIGEST_PRESETS.filter((p) => p.id !== 'custom'),
      schedulePresets: SPORTS_DIGEST_PRESETS,
      maxTeams: SPORTS_DIGEST_MAX_TEAMS,
      maxCustomTimes: SPORTS_DIGEST_MAX_CUSTOM_TIMES,
      timeZone: 'America/Chicago',
      timeStepMinutes: 15,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function resolveAuthedUserAccount(request, env) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) return { error: 'Not authenticated', status: 401 };

  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const getUserReq = new Request('http://do/getUserId', { method: 'GET' });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  if (!userResult.userId) return { error: 'Invalid session', status: 401 };

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getDataReq);
  const profile = await dataRes.json();
  if (!profile || typeof profile !== 'object') {
    return { error: 'Account not found', status: 404 };
  }

  return { userId: userResult.userId, userAccount, profile };
}

async function syncSportsDigestKv(env, userId, profile, prefs) {
  if (!env.SPORTS_DIGEST_KV || !userId) {
    return { ok: false, reason: 'kv_not_configured' };
  }
  const key = `sub:${userId}`;
  const normalized = normalizeSportsDigestPrefs(prefs);
  if (!normalized.enabled) {
    await env.SPORTS_DIGEST_KV.delete(key);
    return { ok: true, action: 'deleted' };
  }
  if (!hasConfirmedEmailForProductMail(profile)) {
    return { ok: false, reason: 'email_not_verified' };
  }
  const email = normalizeEmail(profile.email || '');
  if (!email || !isLikelyRealEmail(email)) {
    return { ok: false, reason: 'invalid_email' };
  }
  if (!normalized.teams.length) {
    return { ok: false, reason: 'no_teams' };
  }
  const username = profile.username || 'there';
  let prev = null;
  try {
    prev = await env.SPORTS_DIGEST_KV.get(key, 'json');
  } catch {
    prev = null;
  }
  const record = {
    email,
    username,
    teams: normalized.teams,
    frequency: normalized.frequency,
    customTimes: normalized.frequency === 'custom' ? normalized.customTimes : [],
    customDays: normalized.customDays,
    scheduleTimeZone: SPORTS_DIGEST_TIME_ZONE,
    lastSentKeys:
      prev && typeof prev === 'object' && Array.isArray(prev.lastSentKeys)
        ? prev.lastSentKeys.slice(-40)
        : [],
  };
  await env.SPORTS_DIGEST_KV.put(key, JSON.stringify(record));
  try {
    const check = await env.SPORTS_DIGEST_KV.get(key, 'json');
    if (!check || check.email !== email || !Array.isArray(check.teams) || !check.teams.length) {
      return { ok: false, reason: 'kv_write_verify_failed' };
    }
  } catch {
    return { ok: false, reason: 'kv_write_verify_failed' };
  }
  console.log('sports-digest KV synced', key, record.frequency, record.customTimes);
  return { ok: true, action: 'put', key };
}

async function ensureSportsDigestKvSubscriber(env, userId, profile) {
  if (!env.SPORTS_DIGEST_KV || !userId || !profile || typeof profile !== 'object') return;
  const prefs = normalizeSportsDigestPrefs(profile.emailPreferences?.sportsDigest);
  if (!prefs.enabled) return;
  const sync = await syncSportsDigestKv(env, userId, profile, prefs);
  if (!sync.ok) {
    console.warn('sports-digest KV repair skipped:', userId, sync.reason);
  }
}

async function handleSportsDigestStatus(request, env, corsHeaders) {
  const auth = await resolveAuthedUserAccount(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const prefs = normalizeSportsDigestPrefs(auth.profile.emailPreferences?.sportsDigest);
  let kvRecord = null;
  let kvSynced = false;
  let syncReason = null;

  if (env.SPORTS_DIGEST_KV && auth.userId) {
    try {
      kvRecord = await env.SPORTS_DIGEST_KV.get(`sub:${auth.userId}`, 'json');
      kvSynced = !!(
        kvRecord &&
        typeof kvRecord === 'object' &&
        kvRecord.email &&
        Array.isArray(kvRecord.teams) &&
        kvRecord.teams.length
      );
    } catch {
      kvRecord = null;
    }
  }

  if (prefs.enabled && !kvSynced) {
    const sync = await syncSportsDigestKv(env, auth.userId, auth.profile, prefs);
    syncReason = sync.reason || sync.action || null;
    if (sync.ok) {
      try {
        kvRecord = await env.SPORTS_DIGEST_KV.get(`sub:${auth.userId}`, 'json');
        kvSynced = !!(
          kvRecord &&
          typeof kvRecord === 'object' &&
          kvRecord.email &&
          Array.isArray(kvRecord.teams) &&
          kvRecord.teams.length
        );
      } catch {
        kvSynced = false;
      }
    }
  }

  const schedule = resolveScheduleTimes(prefs);
  return new Response(
    JSON.stringify({
      prefs,
      kvSynced,
      syncReason,
      schedule,
      timeZone: SPORTS_DIGEST_TIME_ZONE,
      kvRecord: kvRecord
        ? {
            frequency: kvRecord.frequency,
            customTimes: kvRecord.customTimes,
            customDays: kvRecord.customDays,
            teamCount: kvRecord.teams.length,
          }
        : null,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSportsDigestSendNow(request, env, corsHeaders) {
  const auth = await resolveAuthedUserAccount(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (auth.profile.emailVerified === false) {
    return new Response(JSON.stringify({ error: 'Confirm your email before sending a preview.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const prefs = normalizeSportsDigestPrefs(auth.profile.emailPreferences?.sportsDigest);
  const requestedTeams = Array.isArray(body.teams)
    ? [...new Set(body.teams.filter((t) => typeof t === 'string'))]
    : [];
  const teams = (requestedTeams.length ? requestedTeams : prefs.teams).slice(0, SPORTS_DIGEST_MAX_TEAMS);
  if (!teams.length) {
    return new Response(JSON.stringify({ error: 'Choose at least one team, then try again.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const email = normalizeEmail(auth.profile.email || '');
  if (!email || !isLikelyRealEmail(email)) {
    return new Response(JSON.stringify({ error: 'Your account needs a valid email address.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let content;
  let kvRecord = null;
  if (env.SPORTS_DIGEST_KV && auth.userId) {
    try {
      kvRecord = await env.SPORTS_DIGEST_KV.get(`sub:${auth.userId}`, 'json');
    } catch {
      kvRecord = null;
    }
  }
  const sinceMs = resolveSubscriberSinceMs(kvRecord);
  try {
    content = await fetchSportsDigestEmailContent(env, {
      teams,
      username: auth.profile.username,
      sinceMs,
    });
  } catch (e) {
    const msg = e?.message || String(e);
    return new Response(
      JSON.stringify({ success: false, step: 'build', error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    await dispatchTransactionalEmail(env, {
      to: email,
      subject: `[Preview] ${content.subject}`,
      html: content.html,
      text: content.text,
      fromAddr: 'caleb@ahrenslabs.com',
      fromName: 'Sports Digest',
    });
  } catch (e) {
    const summary = summarizeEmailSendError(e);
    return new Response(
      JSON.stringify({
        success: false,
        step: 'send',
        error: summary.message,
        code: summary.code,
        hint: summary.hint,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let kvSynced = false;
  if (prefs.enabled) {
    const syncPrefs = { ...prefs, teams: requestedTeams.length ? requestedTeams : prefs.teams };
    const sync = await syncSportsDigestKv(env, auth.userId, auth.profile, syncPrefs);
    kvSynced = sync.ok === true;
  }
  return new Response(
    JSON.stringify({ success: true, to: email, kvSynced, teamCount: teams.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleSportsDigestPreferences(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const validated = validateSportsDigestSave(body);
  if (!validated.ok) {
    return new Response(JSON.stringify({ error: validated.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await resolveAuthedUserAccount(request, env);
  if (auth.error) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (validated.prefs.enabled && auth.profile.emailVerified === false) {
    return new Response(
      JSON.stringify({
        error:
          'Confirm your email address before turning on Sports Digest. Use the link in the message we sent when you signed up.',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (validated.prefs.enabled) {
    const emCheck = normalizeEmail(auth.profile.email || '');
    if (!emCheck || !isLikelyRealEmail(emCheck)) {
      return new Response(
        JSON.stringify({
          error:
            'Your account needs a deliverable email address before Sports Digest can be turned on.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const setReq = new Request('http://do/setSportsDigestPreferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validated.prefs),
  });
  const setRes = await auth.userAccount.fetch(setReq);
  const setResult = await setRes.json();
  if (!setResult.success) {
    return new Response(JSON.stringify({ error: setResult.error || 'Could not save preferences' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes2 = await auth.userAccount.fetch(getDataReq);
  const fresh = await dataRes2.json();
  const prefs = normalizeSportsDigestPrefs(fresh?.emailPreferences?.sportsDigest);

  let warning;
  let kvSync = { ok: false, reason: 'not_attempted' };
  try {
    kvSync = await syncSportsDigestKv(env, auth.userId, fresh, prefs);
    if (validated.prefs.enabled && !kvSync.ok) {
      console.warn('sports-digest KV sync failed:', auth.userId, kvSync.reason);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Preferences saved to your account, but scheduled email registration failed (' +
            (kvSync.reason || 'unknown') +
            '). Try reloading and saving again.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (e) {
    console.error('sports-digest KV update failed:', e?.message || e);
    if (validated.prefs.enabled) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not update Sports Digest subscription storage. Try again later.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  if (!env.SPORTS_DIGEST_KV && validated.prefs.enabled) {
    warning =
      'Sports Digest list storage is not configured on this Worker; preferences saved but scheduled sends require SPORTS_DIGEST_KV.';
  }

  return new Response(
    JSON.stringify({
      success: true,
      sportsDigest: prefs,
      emailPreferences: {
        ...(fresh.emailPreferences || {}),
        sportsDigest: prefs,
      },
      ...(warning ? { warning } : {}),
      kvSynced: kvSync.ok === true,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Get user data handler
async function handleGetUser(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  
  const getUserReq = new Request('http://do/getUserId', {
    method: 'GET'
  });
  const userRes = await session.fetch(getUserReq);
  const userResult = await userRes.json();
  
  if (!userResult.userId) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccountId = env.USER_ACCOUNT.idFromName(userResult.userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);
  
  const getDataReq = new Request('http://do/getData', {
    method: 'GET'
  });
  
  const dataRes = await userAccount.fetch(getDataReq);
  const userData = await dataRes.json();

  if (userData == null || typeof userData !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await ensureDigestKvSubscriber(env, userResult.userId, userData);
  } catch (e) {
    console.warn('ensureDigestKvSubscriber on getUser failed:', e?.message || e);
  }
  try {
    await ensureSportsDigestKvSubscriber(env, userResult.userId, userData);
  } catch (e) {
    console.warn('ensureSportsDigestKvSubscriber on getUser failed:', e?.message || e);
  }

  return new Response(JSON.stringify(userData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Helper functions
function parseBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const m = authHeader.match(/^Bearer\s+(\S+)/i);
  return m ? m[1] : null;
}

function normalizeLoginUsername(s) {
  if (s == null || typeof s !== 'string') return '';
  return s.trim().toLowerCase();
}

function normalizeUsernameForIndex(username) {
  return normalizeLoginUsername(username);
}

function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

function isValidIanaTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timeZone.trim() });
    return true;
  } catch {
    return false;
  }
}

function hourInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour');
  let n = h ? parseInt(h.value, 10) : 0;
  if (!Number.isFinite(n)) n = 0;
  if (n === 24) n = 0;
  return n;
}

function minuteInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    minute: '2-digit',
  }).formatToParts(date);
  const p = parts.find((x) => x.type === 'minute');
  let n = p ? parseInt(p.value, 10) : 0;
  if (!Number.isFinite(n)) n = 0;
  return Math.min(59, Math.max(0, n));
}

/** Daily digest send time in UTC — `DIGEST_SEND_UTC_HOUR` / `DIGEST_SEND_UTC_MINUTE` in wrangler [vars]. Defaults 7, 0. */
function getDigestSendUtcHM(env) {
  const hRaw = env.DIGEST_SEND_UTC_HOUR;
  const mRaw = env.DIGEST_SEND_UTC_MINUTE;
  const hs = hRaw != null && String(hRaw).trim() !== '' ? String(hRaw).trim() : '7';
  const ms = mRaw != null && String(mRaw).trim() !== '' ? String(mRaw).trim() : '0';
  let h = parseInt(hs, 10);
  let m = parseInt(ms, 10);
  if (!Number.isFinite(h) || h < 0 || h > 23) h = 7;
  if (!Number.isFinite(m) || m < 0 || m > 59) m = 0;
  return { hour: h, minute: m };
}

function ymdInTimeZone(date, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** For /api/login only: accept any plausible email so legacy accounts work (signup still uses isLikelyRealEmail). */
function looksLikeEmailForLogin(raw) {
  if (raw == null || typeof raw !== 'string') return false;
  const t = raw.trim();
  if (!t.includes('@')) return false;
  const n = normalizeEmail(t);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(n);
}

function hasReasonableEmailShape(normalized) {
  const at = normalized.indexOf('@');
  if (at < 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain.includes('.')) return false;
  if (local.length > 64 || domain.length > 253) return false;
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (domain.startsWith('.') || domain.endsWith('.') || domain.includes('..')) return false;
  if (
    domain.endsWith('.local') ||
    domain.endsWith('.test') ||
    domain.endsWith('.invalid') ||
    domain.endsWith('.localhost')
  ) {
    return false;
  }
  for (const label of domain.split('.')) {
    if (!label || label.length > 63) return false;
    if (label.startsWith('-') || label.endsWith('-')) return false;
  }
  return true;
}

function isLikelyRealEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(normalized)) return false;
  if (!hasReasonableEmailShape(normalized)) return false;
  const domain = normalized.split('@')[1] || '';
  return !DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/**
 * Reject domains with no deliverable MX (NXDOMAIN, null MX, or no MX at all).
 * Does not fall back to A/AAAA — many parked domains have a website record but no mail.
 * Uses Cloudflare DNS-over-HTTPS; fails open on resolver errors so outages do not block signups.
 */
async function verifySignupEmailDomain(domain) {
  const d = String(domain || '').trim().toLowerCase();
  if (!d || !d.includes('.')) return false;

  const headers = { Accept: 'application/dns-json' };

  try {
    const mxRes = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(d)}&type=MX`, {
      headers,
    });
    if (!mxRes.ok) return true;
    const mxJson = await mxRes.json();
    if (mxJson.Status === 3) return false;
    if (mxJson.Status !== 0) return true;

    const mxRecords = (mxJson.Answer || []).filter((a) => a.type === 15);
    if (mxRecords.length === 0) return false;

    const hasDeliverableMx = mxRecords.some((a) => {
      const raw = String(a.data || '').trim();
      if (raw === '0 .' || raw === '0.') return false;
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2 && parts[0] === '0' && parts[1] === '.') return false;
      return true;
    });
    return hasDeliverableMx;
  } catch (e) {
    console.warn('verifySignupEmailDomain', d, e?.message || e);
    return true;
  }
}

/** Product / marketing email: only skip accounts that explicitly have not confirmed (new signups). Legacy rows may omit the flag. */
function hasConfirmedEmailForProductMail(row) {
  return row && row.emailVerified !== false;
}

/** Keep DAILY_DIGEST_KV `sub:{userId}` in sync when prefs are on (repairs missing keys). */
async function ensureDigestKvSubscriber(env, userId, profile) {
  if (!env.DAILY_DIGEST_KV || !userId || !profile || typeof profile !== 'object') return;
  const prefs = profile.emailPreferences || {};
  if (!prefs.dailyChallengeEmails) return;
  if (!hasConfirmedEmailForProductMail(profile)) return;
  const email = normalizeEmail(profile.email || '');
  if (!email || !isLikelyRealEmail(email)) return;
  const username = profile.username || 'there';
  const key = `sub:${userId}`;
  let prev = null;
  try {
    prev = await env.DAILY_DIGEST_KV.get(key, 'json');
  } catch {
    prev = null;
  }
  if (
    prev &&
    typeof prev === 'object' &&
    prev.email === email &&
    (prev.username || 'there') === username
  ) {
    return;
  }
  await env.DAILY_DIGEST_KV.put(
    key,
    JSON.stringify({
      email,
      username,
      lastDigestLocalYmd:
        prev && typeof prev === 'object' && typeof prev.lastDigestLocalYmd === 'string'
          ? prev.lastDigestLocalYmd
          : undefined,
    })
  );
}

function generateUserId(email) {
  // Simple hash function for user ID
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `user_${Math.abs(hash)}`;
}

function generateSessionId() {
  // Generate a random session ID
  return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateVerificationToken() {
  // Generate a random verification token
  return `verify_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
}

/** Cloudflare Email Service sometimes returns slightly different result shapes. */
function extractCloudflareEmailMessageId(result) {
  if (result == null) return '';
  if (typeof result === 'string') return result.trim();
  if (typeof result !== 'object') return '';
  const candidates = [result.messageId, result.MessageId, result.id];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

/** Safe to return to the client: helps explain E_SENDER_NOT_VERIFIED etc. */
function summarizeEmailSendError(err) {
  const code = typeof err?.code === 'string' ? err.code : null;
  const rawMsg = typeof err?.message === 'string' ? err.message : String(err || 'Unknown error');
  const hints = {
    E_SENDER_NOT_VERIFIED:
      'Cloudflare rejected the From address — complete Email Sending setup for your domain and use a verified sender (match SENDER_EMAIL in wrangler).',
    E_SENDER_DOMAIN_NOT_AVAILABLE:
      'Domain is not onboarded to Cloudflare Email Sending for this zone.',
    E_RECIPIENT_NOT_ALLOWED:
      'Cloudflare is still restricting this recipient (dashboard or account allowlist). Fix the Send Email binding in the dashboard, or bypass Cloudflare: wrangler secret put RESEND_API_KEY then set TRANSACTIONAL_EMAIL_VIA = "resend" in [vars] (or Worker vars) and redeploy.',
    E_RECIPIENT_SUPPRESSED:
      'That recipient is suppressed (bounce/spam) at the email provider.',
    E_RATE_LIMIT_EXCEEDED: 'Email rate limit exceeded; retry later.',
    E_DAILY_LIMIT_EXCEEDED: 'Daily send quota exceeded on your Cloudflare plan.',
    E_DELIVERY_FAILED: 'Handoff to recipient mail servers failed (not an app bug).',
    E_VALIDATION_ERROR: 'Invalid to/from/subject payload.',
    E_FIELD_MISSING: 'Missing to, from, or subject.',
    E_NO_MESSAGE_ID:
      'Email send returned no message id — check Workers runtime / upgrade wrangler; or set RESEND_API_KEY as fallback.',
  };
  const hint = (code && hints[code]) || null;
  return { code, message: rawMsg, hint };
}

// Resend fallback when Cloudflare EmailService send fails or EMAIL binding is absent.
async function sendViaResend(env, { fromAddr, fromName, to, subject, html, text }) {
  const key = env.RESEND_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('RESEND_API_KEY is not set');
  }
  const displayName = (fromName != null && String(fromName).trim()) || 'Ahrens Labs';
  const from = `${displayName} <${fromAddr}>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.name)) || raw || res.statusText;
    console.error('Resend send failed', res.status, msg);
    throw new Error(typeof msg === 'string' ? msg : `Resend HTTP ${res.status}`);
  }
  const resendId = data && typeof data.id === 'string' ? data.id.trim() : '';
  if (!resendId) {
    console.error('Resend response missing id', raw);
    throw new Error('Resend accepted the request but returned no message id');
  }
  console.log('Resend send ok', { id: resendId, subject, to });
  return { provider: 'resend', messageId: resendId };
}

/** Prefer EMAIL_TRANSACTIONAL so an old "EMAIL" binding with dashboard allowlist does not block arbitrary recipients. */
function getCloudflareEmailBinding(env) {
  return env.EMAIL_TRANSACTIONAL || env.EMAIL;
}

async function dispatchTransactionalEmail(env, { to, subject, html, text, fromAddr: fromOverride, fromName: fromNameOverride }) {
  const envFrom = String(env.SENDER_EMAIL || env.VERIFICATION_FROM_EMAIL || '').trim();
  const fromAddr = String(fromOverride || envFrom).trim();
  const fromName =
    fromNameOverride != null && String(fromNameOverride).trim()
      ? String(fromNameOverride).trim()
      : String(env.TRANSACTIONAL_FROM_NAME || 'Ahrens Labs').trim() || 'Ahrens Labs';
  if (!fromAddr) {
    throw new Error('Set SENDER_EMAIL to a verified sender (Resend or Cloudflare Email Service domain).');
  }
  if (
    !fromOverride &&
    (fromAddr.includes('YOUR_DOMAIN') ||
      fromAddr === 'digest@example.com' ||
      fromAddr === 'noreply@example.com')
  ) {
    throw new Error(
      'Set SENDER_EMAIL in wrangler.toml (or dashboard) to a verified address on your Cloudflare Email Sending domain.'
    );
  }

  const via = String(env.TRANSACTIONAL_EMAIL_VIA || '').trim().toLowerCase();
  if (via === 'resend') {
    if (!env.RESEND_API_KEY || typeof env.RESEND_API_KEY !== 'string') {
      throw new Error(
        'TRANSACTIONAL_EMAIL_VIA=resend requires wrangler secret put RESEND_API_KEY (and SENDER_EMAIL verified in Resend).'
      );
    }
    return await sendViaResend(env, { fromAddr, fromName, to, subject, html, text });
  }

  const cfMail = getCloudflareEmailBinding(env);
  if (cfMail) {
    try {
      // Same shape as sports-digest: structured `from` + send() on [[send_email]] binding (see wrangler.toml).
      const result = await cfMail.send({
        from: { email: fromAddr, name: fromName },
        to,
        subject,
        html,
        text,
      });
      const messageId = extractCloudflareEmailMessageId(result);
      if (!messageId) {
        const synthetic = new Error('Email Service returned no messageId after send');
        synthetic.code = 'E_NO_MESSAGE_ID';
        throw synthetic;
      }
      console.log('EmailService send ok', { messageId, subject, to });
      return { provider: 'cloudflare', messageId };
    } catch (err) {
      console.error('EmailService send failed', {
        code: err?.code,
        message: err?.message,
        subject,
        to,
      });
      if (env.RESEND_API_KEY && typeof env.RESEND_API_KEY === 'string') {
        console.log('Falling back to Resend after EmailService error', err?.code || '');
        return await sendViaResend(env, { fromAddr, fromName, to, subject, html, text });
      }
      if (err?.code === 'E_RECIPIENT_NOT_ALLOWED') {
        const hint = new Error(
          'Cloudflare blocked this recipient (E_RECIPIENT_NOT_ALLOWED). Set wrangler secret RESEND_API_KEY and redeploy, ' +
            'or add TRANSACTIONAL_EMAIL_VIA = "resend" in [vars] to send only via Resend.'
        );
        hint.code = err.code;
        throw hint;
      }
      throw err;
    }
  }

  if (env.RESEND_API_KEY) {
    return await sendViaResend(env, { fromAddr, fromName, to, subject, html, text });
  }

  throw new Error(
    'No email transport: run `wrangler secret put RESEND_API_KEY` (https://resend.com — works on Workers Free), ' +
      'or upgrade to Workers Paid and add [[send_email]] for Cloudflare Email Service.'
  );
}

function applyBroadcastTemplate(str, { username, email }) {
  if (str == null) return '';
  const u = username != null ? String(username) : '';
  const e = email != null ? String(email) : '';
  return String(str)
    .replace(/\{\{username\}\}/g, u || 'there')
    .replace(/\{\{email\}\}/g, e);
}

function plainTextToBroadcastHtml(text) {
  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.55;padding:20px;color:#1e293b;">${esc(
    text
  ).replace(/\r\n/g, '\n').split('\n').join('<br/>')}</body></html>`;
}

async function assertAdminBroadcastSession(env, sessionId) {
  if (!sessionId) {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const userRes = await session.fetch(new Request('http://do/getUserId', { method: 'GET' }));
  const userResult = await userRes.json();
  const userId = userResult.userId;
  if (!userId) {
    return { ok: false, status: 401, error: 'Invalid session' };
  }
  const userAccount = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId));
  const dataRes = await userAccount.fetch(new Request('http://do/getData', { method: 'GET' }));
  const row = await dataRes.json();
  const em = row && row.email ? normalizeEmail(row.email) : '';
  if (em !== normalizeEmail(ADMIN_BROADCAST_ACCOUNT_EMAIL)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return {
    ok: true,
    adminEmail: em,
    adminUsername: row && row.username ? String(row.username) : 'there',
    adminUserId: userId,
  };
}

/** Normalize DurableObjectNamespace.list() shapes across runtime versions. */
function parseDoNamespaceListPage(listResult) {
  if (!listResult || typeof listResult !== 'object') {
    return { objects: [], cursor: null };
  }
  let objects = listResult.objects;
  if (!Array.isArray(objects) && Array.isArray(listResult.instances)) {
    objects = listResult.instances;
  }
  if (!Array.isArray(objects)) {
    objects = [];
  }
  const cursor =
    listResult.cursor ??
    listResult.nextCursor ??
    listResult.nextContinuationToken ??
    (typeof listResult.continuationToken === 'string' ? listResult.continuationToken : null);
  return { objects, cursor: cursor != null && String(cursor).trim() ? String(cursor).trim() : null };
}

/** Resolve a stub from a DurableObjectNamespace.list() entry (prefers name when present). */
function userAccountStubFromListEntry(env, obj) {
  if (!obj || typeof obj !== 'object') return null;
  const name = obj.name != null ? String(obj.name).trim() : '';
  if (name) {
    if (/^user_\d+$/i.test(name) || name.startsWith('sess_')) {
      try {
        return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(name));
      } catch {
        /* fall through */
      }
    }
    if (typeof env.USER_ACCOUNT.getByName === 'function') {
      try {
        return env.USER_ACCOUNT.getByName(name);
      } catch {
        /* fall through to id */
      }
    }
  }
  if (obj.id != null) {
    try {
      return env.USER_ACCOUNT.get(obj.id);
    } catch {
      try {
        const sid = typeof obj.id === 'string' ? obj.id.trim() : String(obj.id).trim();
        if (sid && typeof env.USER_ACCOUNT.idFromString === 'function') {
          const idObj = env.USER_ACCOUNT.idFromString(sid);
          return env.USER_ACCOUNT.get(idObj);
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Enumerate UserAccount stubs for admin broadcast. Prefers DurableObjectNamespace.list() when the
 * runtime exposes it; otherwise pages through UsernameRegistry (`username:*` → userId), which
 * covers all accounts that have a reserved username (including after backfill on login).
 */
async function listUserAccountStubsForBroadcast(env, pageSize, listCursor) {
  if (typeof env.USER_ACCOUNT.list === 'function') {
    try {
      const listResult = await env.USER_ACCOUNT.list({
        limit: pageSize,
        ...(listCursor ? { cursor: listCursor } : {}),
      });
      const { objects, cursor } = parseDoNamespaceListPage(listResult);
      const stubs = [];
      for (const obj of objects) {
        const st = userAccountStubFromListEntry(env, obj);
        if (st) stubs.push(st);
      }
      return { stubs, nextListCursor: cursor, listError: null };
    } catch (e) {
      return { stubs: [], nextListCursor: null, listError: e };
    }
  }

  const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
  try {
    const res = await registry.fetch(
      new Request('http://do/listUserIdsPage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: pageSize,
          ...(listCursor ? { startAfter: listCursor } : {}),
        }),
      })
    );
    const txt = await res.text();
    if (!res.ok) {
      return {
        stubs: [],
        nextListCursor: null,
        listError: new Error(`Username registry list failed (${res.status}): ${txt.slice(0, 280)}`),
      };
    }
    let data = {};
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch (parseErr) {
      return {
        stubs: [],
        nextListCursor: null,
        listError: new Error(`Username registry returned invalid JSON: ${txt.slice(0, 200)}`),
      };
    }
    if (data.error && typeof data.error === 'string') {
      return {
        stubs: [],
        nextListCursor: null,
        listError: new Error(data.error),
      };
    }
    const userIds = Array.isArray(data.userIds) ? data.userIds : [];
    const stubs = [];
    for (const uid of userIds) {
      if (!uid) continue;
      stubs.push(userAccountStubFromUserId(env, uid));
    }
    return { stubs, nextListCursor: data.nextListCursor || null, listError: null };
  } catch (e) {
    return { stubs: [], nextListCursor: null, listError: e };
  }
}

async function handleAdminBroadcastEmail(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subjectTpl = body.subject != null ? String(body.subject).trim() : '';
  const textTpl = body.text != null ? String(body.text).trim() : '';
  const htmlTpl = body.html != null ? String(body.html) : '';

  if (!subjectTpl || !textTpl) {
    return new Response(JSON.stringify({ error: 'subject and text are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const dryRun = body.dryRun === true;
  const sendPreviewCopy = body.sendPreviewCopy === true;
  const listCursor = typeof body.listCursor === 'string' && body.listCursor.trim() ? body.listCursor.trim() : undefined;
  const pageSize = Math.min(60, Math.max(1, parseInt(String(body.pageSize || '35'), 10) || 35));

  let previewEmailSent = false;
  let previewEmailError = null;

  const { stubs, nextListCursor: nextCursor, listError } = await listUserAccountStubsForBroadcast(
    env,
    pageSize,
    listCursor
  );
  if (listError) {
    console.error('broadcast account list failed', listError?.message || listError);
    return new Response(
      JSON.stringify({ error: 'Could not list user accounts: ' + (listError?.message || String(listError)) }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const hasMore = Boolean(nextCursor);

  // Preview is sent only to the authenticated admin (gate.adminEmail), never to recipients in the list.
  if (dryRun && sendPreviewCopy && !listCursor) {
    const prevSubject = applyBroadcastTemplate(subjectTpl, {
      username: gate.adminUsername,
      email: gate.adminEmail,
    });
    const prevTextBody = applyBroadcastTemplate(textTpl, {
      username: gate.adminUsername,
      email: gate.adminEmail,
    });
    const prevHtmlRaw = htmlTpl.trim()
      ? applyBroadcastTemplate(htmlTpl, {
          username: gate.adminUsername,
          email: gate.adminEmail,
        })
      : '';
    const prevHtml = prevHtmlRaw.trim() ? prevHtmlRaw : plainTextToBroadcastHtml(prevTextBody);
    const previewBannerText =
      'This is a preview for the administrator only. {{username}} and {{email}} were filled with YOUR account so you can proofread. Each real recipient gets their own values.\n\n---\n\n';
    const previewText = previewBannerText + prevTextBody;
    const previewHtml =
      `<div style="background:#fef3c7;border-left:4px solid #d97706;padding:12px 14px;margin:0 0 18px 0;font-size:14px;line-height:1.5;color:#92400e;font-family:system-ui,sans-serif;">` +
      `<strong>Broadcast preview</strong> — only you were sent this copy. Placeholders use <strong>your</strong> username and email; each user would see their own.</div>` +
      prevHtml;
    try {
      await dispatchTransactionalEmail(env, {
        to: gate.adminEmail,
        subject: `[Broadcast preview] ${prevSubject}`,
        html: previewHtml,
        text: previewText,
        fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
        fromName: ADMIN_BROADCAST_FROM_NAME,
      });
      previewEmailSent = true;
    } catch (err) {
      const w = summarizeEmailSendError(err);
      previewEmailError = w.hint || w.message || String(err?.message || err);
    }
  }

  const summary = {
    success: true,
    dryRun,
    from: ADMIN_BROADCAST_FROM_EMAIL,
    processedObjects: 0,
    sent: 0,
    skipped: 0,
    failed: [],
    dryRunEmails: [],
    nextListCursor: nextCursor,
    hasMore,
    previewEmailSent,
    previewEmailError,
  };

  for (const stub of stubs) {
    summary.processedObjects++;
    if (!stub) {
      summary.skipped++;
      continue;
    }
    let row;
    try {
      const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
      row = await dataRes.json();
    } catch (e) {
      summary.skipped++;
      continue;
    }
    if (!row || !row.email) {
      summary.skipped++;
      continue;
    }
    const to = normalizeEmail(row.email);
    if (!isLikelyRealEmail(to)) {
      summary.skipped++;
      continue;
    }
    if (!hasConfirmedEmailForProductMail(row)) {
      summary.skipped++;
      continue;
    }

    const username = row.username || 'there';
    const subject = applyBroadcastTemplate(subjectTpl, { username, email: to });
    const text = applyBroadcastTemplate(textTpl, { username, email: to });
    const htmlRaw = htmlTpl.trim() ? applyBroadcastTemplate(htmlTpl, { username, email: to }) : '';
    const html = htmlRaw.trim() ? htmlRaw : plainTextToBroadcastHtml(text);

    if (dryRun) {
      summary.dryRunEmails.push(to);
      continue;
    }

    try {
      await dispatchTransactionalEmail(env, {
        to,
        subject,
        html,
        text,
        fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
        fromName: ADMIN_BROADCAST_FROM_NAME,
      });
      summary.sent++;
    } catch (err) {
      const w = summarizeEmailSendError(err);
      summary.failed.push({ email: to, error: w.hint || w.message });
    }
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Every account with a deliverable-looking email on file (no verified-email requirement). Each send is one separate email to one recipient (no BCC / bulk To). */
async function handleAdminResendWelcomeBulk(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const dryRun = body.dryRun === true;
  const sendPreviewCopy = body.sendPreviewCopy === true;
  const listCursor =
    typeof body.listCursor === 'string' && body.listCursor.trim() ? body.listCursor.trim() : undefined;
  const pageSize = Math.min(60, Math.max(1, parseInt(String(body.pageSize || '35'), 10) || 35));

  let previewWelcomeSent = false;
  let previewWelcomeError = null;

  // Full welcome sample is emailed only to the authenticated admin (gate.adminEmail), not to listed accounts.
  if (dryRun && sendPreviewCopy && !listCursor) {
    try {
      await sendWelcomeGuideEmail(env, gate.adminEmail, gate.adminUsername, {
        fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
        fromName: ADMIN_BROADCAST_FROM_NAME,
      });
      previewWelcomeSent = true;
    } catch (err) {
      const w = summarizeEmailSendError(err);
      previewWelcomeError = w.hint || w.message || String(err?.message || err);
      console.error('admin welcome preview send failed', previewWelcomeError);
    }
  }

  const { stubs, nextListCursor: nextCursor, listError } = await listUserAccountStubsForBroadcast(
    env,
    pageSize,
    listCursor
  );
  if (listError) {
    console.error('admin resend-welcome list failed', listError?.message || listError);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Could not list user accounts: ' + (listError?.message || String(listError)),
        previewWelcomeSent,
        previewWelcomeError,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const hasMore = Boolean(nextCursor);

  const summary = {
    success: true,
    dryRun,
    action: 'resend-welcome',
    processedObjects: 0,
    sent: 0,
    skipped: 0,
    failed: [],
    dryRunEmails: [],
    nextListCursor: nextCursor,
    hasMore,
    previewWelcomeSent,
    previewWelcomeError,
  };

  for (const stub of stubs) {
    summary.processedObjects++;
    if (!stub) {
      summary.skipped++;
      continue;
    }
    let row;
    try {
      const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
      row = await dataRes.json();
    } catch (e) {
      summary.skipped++;
      continue;
    }
    if (!row || !row.email) {
      summary.skipped++;
      continue;
    }
    const to = normalizeEmail(row.email);
    if (!isLikelyRealEmail(to)) {
      summary.skipped++;
      continue;
    }

    const username = row.username || 'there';

    if (dryRun) {
      summary.dryRunEmails.push(to);
      continue;
    }

    try {
      // One Cloudflare / Resend API call per account — single recipient per message.
      await sendWelcomeGuideEmail(env, to, username);
      summary.sent++;
    } catch (err) {
      const w = summarizeEmailSendError(err);
      summary.failed.push({ email: to, error: w.hint || w.message });
    }
  }

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** True when a UserAccount DO has a real saved profile (not an empty stub). */
function userAccountProfileExists(row) {
  if (!row || typeof row !== 'object') return false;
  if (row.email != null && normalizeEmail(String(row.email))) return true;
  if (row.username != null && String(row.username).trim()) return true;
  if (row.passwordHash) return true;
  if (row.createdAt != null && Number(row.createdAt) > 0) return true;
  const games = row.games;
  if (games && typeof games === 'object') {
    const chess = games.chess;
    if (chess && typeof chess === 'object') {
      if (Number(chess.points) > 0) return true;
      const ach = chess.achievements;
      if (ach && typeof ach === 'object' && Object.keys(ach).length > 0) return true;
      const hist = chess.gameHistory;
      if (Array.isArray(hist) && hist.length > 0) return true;
    }
    const dungeon = games.dungeon;
    if (dungeon && typeof dungeon === 'object') {
      const slots = dungeon.saveSlots;
      if (slots && typeof slots === 'object' && Object.values(slots).some(Boolean)) return true;
    }
  }
  return false;
}

/** Resolve a UserAccount stub from a stored user id (named slot or legacy hex DO id). */
function userAccountStubFromUserId(env, userIdRaw) {
  const uid = userIdRaw != null ? String(userIdRaw).trim() : '';
  if (!uid || !env.USER_ACCOUNT) return null;
  if (/^user_\d+$/i.test(uid) || uid.startsWith('sess_')) {
    return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(uid));
  }
  if (typeof env.USER_ACCOUNT.idFromString === 'function' && /^[0-9a-f]{64}$/i.test(uid)) {
    try {
      return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromString(uid));
    } catch {
      /* fall through */
    }
  }
  try {
    return env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(uid));
  } catch {
    return null;
  }
}

function adminAccountRowFromProfile(row, opts) {
  if (!userAccountProfileExists(row)) return null;
  const lookupEmail =
    opts && opts.lookupEmail != null ? normalizeEmail(String(opts.lookupEmail)) : '';
  const slotHint =
    opts && opts.slotUserId != null ? String(opts.slotUserId).trim() : '';
  const emailRaw = row.email != null ? String(row.email) : '';
  let emailNorm = emailRaw ? normalizeEmail(emailRaw) : '';
  let legacyEmailInferred = false;
  if (!emailNorm && lookupEmail) {
    emailNorm = lookupEmail;
    legacyEmailInferred = true;
  }
  let ev = null;
  if (row.emailVerified === true) ev = true;
  else if (row.emailVerified === false) ev = false;
  else if (legacyEmailInferred) ev = null;
  const slotFromEmail = emailNorm ? generateUserId(emailNorm) : '';
  const slotFromHint = /^user_\d+$/i.test(slotHint) ? slotHint : '';
  const doUserId = row.userId != null ? String(row.userId).trim() : '';
  return {
    userId: slotFromEmail || slotFromHint || doUserId,
    doUserId,
    username: row.username != null ? String(row.username) : '',
    email: emailNorm,
    emailVerified: ev,
    legacyEmailInferred: legacyEmailInferred || undefined,
  };
}

async function fetchAdminAccountByEmailSlot(env, normalizedEmail) {
  const emailNorm = normalizeEmail(normalizedEmail);
  if (!emailNorm) return null;
  const stub = userAccountStubFromUserId(env, generateUserId(emailNorm));
  if (!stub) return null;
  try {
    const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
    const row = await dataRes.json();
    return adminAccountRowFromProfile(row, { lookupEmail: emailNorm });
  } catch {
    return null;
  }
}

function normalizeAdminStubEntries(stubsOrEntries) {
  if (!Array.isArray(stubsOrEntries)) return [];
  return stubsOrEntries.map((item) => {
    if (item && typeof item === 'object' && item.stub) {
      return {
        stub: item.stub,
        slotUserId: item.slotUserId != null ? String(item.slotUserId).trim() : '',
      };
    }
    return { stub: item, slotUserId: '' };
  });
}

async function resolveAdminAccountRowsFromStubs(stubsOrEntries) {
  const entries = normalizeAdminStubEntries(stubsOrEntries);
  const accounts = [];
  let skippedMissingData = 0;
  const batch = 10;
  for (let i = 0; i < entries.length; i += batch) {
    const slice = entries.slice(i, i + batch);
    const rows = await Promise.all(
      slice.map(async ({ stub }) => {
        if (!stub) return null;
        try {
          const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
          return await dataRes.json();
        } catch {
          return null;
        }
      })
    );
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      const slotUserId = slice[j]?.slotUserId || '';
      const entry = adminAccountRowFromProfile(row, { slotUserId });
      if (!entry) {
        skippedMissingData++;
        continue;
      }
      accounts.push(entry);
    }
  }
  return { accounts, skippedMissingData };
}

function mergeAdminAccountRows(existing, incoming) {
  const byKey = new Map();
  function indexAccount(a) {
    if (!a || typeof a !== 'object') return;
    const keys = [
      (a.userId || '').trim().toLowerCase(),
      (a.email || '').trim().toLowerCase(),
      (a.doUserId || '').trim().toLowerCase(),
      (a.username || '').trim().toLowerCase(),
    ].filter(Boolean);
    let hit = null;
    for (const k of keys) {
      if (byKey.has(k)) {
        hit = byKey.get(k);
        break;
      }
    }
    if (hit) {
      Object.assign(hit, a);
      for (const k of keys) byKey.set(k, hit);
    } else {
      const primary = keys[0] || `row_${byKey.size}`;
      byKey.set(primary, a);
      for (const k of keys) byKey.set(k, a);
    }
  }
  for (const a of existing || []) indexAccount(a);
  for (const a of incoming || []) indexAccount(a);
  return Array.from(new Set(byKey.values()));
}

/** Walk the full username registry (not capped by a single admin list page). */
async function listAllRegistryUserIds(env) {
  if (!env.USERNAME_REGISTRY) return [];
  const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
  const userIds = [];
  const seen = new Set();
  let startAfter;
  for (let pages = 0; pages < 500; pages++) {
    let res;
    try {
      res = await registry.fetch(
        new Request('http://do/listUserIdsPage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            limit: 100,
            ...(startAfter ? { startAfter } : {}),
          }),
        })
      );
    } catch {
      break;
    }
    const txt = await res.text();
    if (!res.ok) break;
    let data = {};
    try {
      data = txt ? JSON.parse(txt) : {};
    } catch {
      break;
    }
    if (data.error && typeof data.error === 'string') break;
    const batch = Array.isArray(data.userIds) ? data.userIds : [];
    for (const uid of batch) {
      const id = uid != null ? String(uid).trim() : '';
      if (!id || seen.has(id)) continue;
      seen.add(id);
      userIds.push(id);
    }
    if (!data.nextListCursor) break;
    startAfter = data.nextListCursor;
  }
  return userIds;
}

async function resolveAdminAccountRowFromUserId(env, userIdRaw, opts = {}) {
  const uid = userIdRaw != null ? String(userIdRaw).trim() : '';
  if (!uid) return null;
  const stub = userAccountStubFromUserId(env, uid);
  if (!stub) return null;
  try {
    const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
    const row = await dataRes.json();
    return adminAccountRowFromProfile(row, {
      slotUserId: uid,
      lookupEmail: opts.lookupEmail,
    });
  } catch {
    return null;
  }
}

/** Merge registry + explicit email-slot lookups into a directory result. */
async function supplementAdminAccountRows(env, accounts, ensureEmails = []) {
  let rows = Array.isArray(accounts) ? accounts.slice() : [];
  const registryIds = await listAllRegistryUserIds(env);
  const batch = 10;
  for (let i = 0; i < registryIds.length; i += batch) {
    const slice = registryIds.slice(i, i + batch);
    const fetched = await Promise.all(slice.map((uid) => resolveAdminAccountRowFromUserId(env, uid)));
    for (const r of fetched) {
      if (r) rows = mergeAdminAccountRows(rows, [r]);
    }
  }
  const emailNorms = [
    ...new Set((ensureEmails || []).map((e) => normalizeEmail(e)).filter(Boolean)),
  ];
  for (const emailNorm of emailNorms) {
    const slotRow = await fetchAdminAccountByEmailSlot(env, emailNorm);
    if (slotRow) rows = mergeAdminAccountRows(rows, [slotRow]);
  }
  return rows;
}

/** Cursor for admin account directory: union of DO list, username registry, and digest KV `sub:` keys. */
function parseAdminAccountListCursor(raw) {
  const fresh = () => ({
    v: 3,
    do: { done: false, cursor: null },
    reg: { done: false, cursor: null },
    kv: { done: false, cursor: null },
    sports: { done: false, cursor: null },
  });
  if (!raw || !String(raw).trim()) return fresh();
  const s = String(raw).trim();
  try {
    const j = JSON.parse(s);
    if (j && j.v === 3 && j.do && j.reg && j.kv) {
      if (!j.sports) j.sports = { done: false, cursor: null };
      return j;
    }
    if (j && j.v === 2 && j.do && j.reg && j.kv) {
      j.v = 3;
      j.sports = { done: false, cursor: null };
      return j;
    }
  } catch {
    /* legacy: opaque DO list cursor from older deploys */
  }
  return {
    v: 3,
    do: { done: false, cursor: s },
    reg: { done: false, cursor: null },
    kv: { done: false, cursor: null },
    sports: { done: false, cursor: null },
  };
}

/**
 * Admin-only: enumerate UserAccount stubs from (1) DurableObjectNamespace.list, then (2) username
 * registry, then (3) DAILY_DIGEST_KV `sub:*` subscriber keys — so accounts missing from one source
 * still appear. Dedupes stubs within each response by Durable Object id string.
 */
async function listUserAccountStubsAdminUnified(env, pageSize, listCursorInput) {
  const state = parseAdminAccountListCursor(listCursorInput);
  if (typeof env.USER_ACCOUNT.list !== 'function') {
    state.do.done = true;
  }

  const stubs = [];
  const seenStubIds = new Set();

  function pushStub(st, slotUserId) {
    if (!st) return;
    let idStr = '';
    try {
      idStr = st.id != null && typeof st.id.toString === 'function' ? st.id.toString() : '';
    } catch {
      idStr = '';
    }
    if (idStr) {
      if (seenStubIds.has(idStr)) return;
      seenStubIds.add(idStr);
    }
    const hint = slotUserId != null ? String(slotUserId).trim() : '';
    stubs.push({ stub: st, slotUserId: hint });
  }

  try {
    while (stubs.length < pageSize) {
      const need = pageSize - stubs.length;

      if (!state.do.done && typeof env.USER_ACCOUNT.list === 'function') {
        const prevDoCursor = state.do.cursor;
        const listResult = await env.USER_ACCOUNT.list({
          limit: need,
          ...(state.do.cursor ? { cursor: state.do.cursor } : {}),
        });
        const { objects, cursor } = parseDoNamespaceListPage(listResult);
        for (const obj of objects) {
          if (stubs.length >= pageSize) break;
          const listName = obj && obj.name != null ? String(obj.name).trim() : '';
          pushStub(userAccountStubFromListEntry(env, obj), listName);
        }
        state.do.cursor = cursor;
        if (!cursor) state.do.done = true;
        else if (!objects.length && cursor === prevDoCursor) state.do.done = true;
        continue;
      }

      if (!state.reg.done) {
        if (!env.USERNAME_REGISTRY) {
          state.reg.done = true;
          continue;
        }
        const registry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
        const res = await registry.fetch(
          new Request('http://do/listUserIdsPage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              limit: Math.min(100, need),
              ...(state.reg.cursor ? { startAfter: state.reg.cursor } : {}),
            }),
          })
        );
        const txt = await res.text();
        if (!res.ok) {
          state.reg.done = true;
          continue;
        }
        let data = {};
        try {
          data = txt ? JSON.parse(txt) : {};
        } catch {
          state.reg.done = true;
          continue;
        }
        if (data.error && typeof data.error === 'string') {
          state.reg.done = true;
          continue;
        }
        const userIds = Array.isArray(data.userIds) ? data.userIds : [];
        for (const uid of userIds) {
          if (stubs.length >= pageSize) break;
          if (!uid) continue;
          pushStub(userAccountStubFromUserId(env, uid), uid);
        }
        state.reg.cursor = data.nextListCursor || null;
        if (!data.nextListCursor) state.reg.done = true;
        continue;
      }

      if (!state.kv.done && env.DAILY_DIGEST_KV) {
        const listKv = await env.DAILY_DIGEST_KV.list({
          prefix: 'sub:',
          limit: Math.min(1000, need),
          ...(state.kv.cursor ? { cursor: state.kv.cursor } : {}),
        });
        for (const { name } of listKv.keys) {
          if (stubs.length >= pageSize) break;
          const uid = name.startsWith('sub:') ? name.slice(4) : '';
          if (!uid) continue;
          pushStub(userAccountStubFromUserId(env, uid), uid);
        }
        if (listKv.list_complete) {
          state.kv.done = true;
          state.kv.cursor = null;
        } else {
          state.kv.cursor = listKv.cursor || null;
        }
        continue;
      }

      if (!state.sports.done && env.SPORTS_DIGEST_KV) {
        const listKv = await env.SPORTS_DIGEST_KV.list({
          prefix: 'sub:',
          limit: Math.min(1000, need),
          ...(state.sports.cursor ? { cursor: state.sports.cursor } : {}),
        });
        for (const { name } of listKv.keys) {
          if (stubs.length >= pageSize) break;
          const uid = name.startsWith('sub:') ? name.slice(4) : '';
          if (!uid) continue;
          pushStub(userAccountStubFromUserId(env, uid), uid);
        }
        if (listKv.list_complete) {
          state.sports.done = true;
          state.sports.cursor = null;
        } else {
          state.sports.cursor = listKv.cursor || null;
        }
        continue;
      }

      state.kv.done = true;
      state.sports.done = true;
      break;
    }

    const allDone = state.do.done && state.reg.done && state.kv.done && state.sports.done;
    const nextListCursor = allDone ? null : JSON.stringify(state);
    return { stubs, nextListCursor, listError: null };
  } catch (e) {
    return { stubs: [], nextListCursor: null, listError: e };
  }
}

/**
 * Admin: page through all user accounts (same enumeration as broadcast) and return directory fields only.
 * Response rows omit passwords, tokens, and game payloads — only userId, username, email, emailVerified.
 * Set loadAll:true (default on first load) to walk every account stub before returning.
 */
async function handleAdminListAccounts(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const listCursor =
    typeof body.listCursor === 'string' && body.listCursor.trim() ? body.listCursor.trim() : undefined;
  const loadAll = body.loadAll === true || (!listCursor && body.loadAll !== false);
  const ensureEmails = Array.isArray(body.ensureEmails)
    ? body.ensureEmails
        .filter((e) => typeof e === 'string')
        .map((e) => normalizeEmail(e))
        .filter(Boolean)
    : [];

  if (loadAll) {
    let stubs = [];
    let enumStoppedEarly = false;
    try {
      const enumerated = await enumerateAllUserAccountStubsForLeaderboard(env);
      stubs = enumerated.stubs;
      enumStoppedEarly = !!enumerated.stoppedEarly;
    } catch (listError) {
      console.error('admin list-accounts loadAll failed', listError?.message || listError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Could not list user accounts: ' + (listError?.message || String(listError)),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    for (const emailNorm of ensureEmails) {
      stubs.push({
        stub: userAccountStubFromUserId(env, generateUserId(emailNorm)),
        slotUserId: generateUserId(emailNorm),
      });
    }

    const { accounts, skippedMissingData } = await resolveAdminAccountRowsFromStubs(stubs);
    const merged = await supplementAdminAccountRows(env, accounts, ensureEmails);

    return new Response(
      JSON.stringify({
        success: true,
        accounts: merged,
        nextListCursor: null,
        hasMore: false,
        loadAll: true,
        totalDiscovered: stubs.length,
        enumStoppedEarly,
        pageStubCount: stubs.length,
        skippedMissingData,
        registrySupplement: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const pageSize = Math.min(60, Math.max(1, parseInt(String(body.pageSize || '35'), 10) || 35));

  const { stubs, nextListCursor: nextCursor, listError } = await listUserAccountStubsAdminUnified(
    env,
    pageSize,
    listCursor
  );
  if (listError) {
    console.error('admin list-accounts failed', listError?.message || listError);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Could not list user accounts: ' + (listError?.message || String(listError)),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const { accounts, skippedMissingData } = await resolveAdminAccountRowsFromStubs(stubs);
  const merged =
    ensureEmails.length > 0
      ? await supplementAdminAccountRows(env, accounts, ensureEmails)
      : accounts;

  return new Response(
    JSON.stringify({
      success: true,
      accounts: merged,
      nextListCursor: nextCursor || null,
      hasMore: Boolean(nextCursor),
      pageStubCount: stubs.length,
      skippedMissingData,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Stored inbox for an existing profile: trust signup-time data; do not block on disposable-domain list
 * or isLikelyRealEmail (stricter than login), so legacy and unusual TLDs still work for admin tools.
 */
function isEmailOnFileForAdminProfile(email) {
  const n = normalizeEmail(String(email || ''));
  if (!n) return false;
  if (!looksLikeEmailForLogin(n)) return false;
  return hasReasonableEmailShape(n);
}

/**
 * Resolve profile for admin per-user actions. Tries userId from the dashboard, then email→generateUserId,
 * and requires row.email to match the supplied email when both are sent (avoids wrong stub).
 */
async function resolveAdminUserTarget(env, body) {
  const userIdRaw = body.userId != null ? String(body.userId).trim() : '';
  const emailRaw = body.email != null ? String(body.email).trim() : '';
  const usernameRaw = body.username != null ? String(body.username).trim() : '';
  const emailNormWant = emailRaw ? normalizeEmail(emailRaw) : '';

  const tryIds = [];
  if (userIdRaw) tryIds.push(userIdRaw);
  if (emailNormWant) {
    const fromEmail = generateUserId(emailNormWant);
    if (!tryIds.includes(fromEmail)) tryIds.push(fromEmail);
  }
  if (usernameRaw && env.USERNAME_REGISTRY) {
    const normalizedUsernameKey = normalizeUsernameForIndex(usernameRaw);
    if (normalizedUsernameKey) {
      try {
        const usernameRegistry = env.USERNAME_REGISTRY.get(env.USERNAME_REGISTRY.idFromName('global'));
        const resolveRes = await usernameRegistry.fetch(
          new Request('http://do/resolve', {
            method: 'POST',
            body: JSON.stringify({ username: normalizedUsernameKey }),
          })
        );
        const resolveData = await resolveRes.json();
        if (resolveRes.ok && resolveData?.userId && !tryIds.includes(resolveData.userId)) {
          tryIds.push(String(resolveData.userId));
        }
      } catch {
        /* try other ids */
      }
    }
  }

  if (!tryIds.length) {
    return { ok: false, error: 'Provide userId, email, or username' };
  }

  let row = null;
  let matchedUserId = '';

  for (const uid of tryIds) {
    try {
      const stub = userAccountStubFromUserId(env, uid);
      if (!stub) continue;
      const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
      const candidate = await dataRes.json();
      if (!candidate || typeof candidate !== 'object') continue;
      const rowEmail = candidate.email != null ? normalizeEmail(String(candidate.email)) : '';
      if (emailNormWant && rowEmail && rowEmail !== emailNormWant) continue;
      row = candidate;
      matchedUserId = uid;
      break;
    } catch {
      /* try next id */
    }
  }

  if (!row || typeof row !== 'object') {
    return { ok: false, error: 'Account not found' };
  }

  const storedEmail = row.email != null ? normalizeEmail(String(row.email)) : '';
  const effectiveEmail = storedEmail || emailNormWant || '';
  if (!effectiveEmail) {
    return { ok: false, error: 'No email on file — pass the signup email so admin tools can target this legacy account' };
  }
  if (storedEmail && !isEmailOnFileForAdminProfile(storedEmail)) {
    return { ok: false, error: 'No valid email on file' };
  }

  const slotUserId =
    /^user_\d+$/i.test(matchedUserId) ? matchedUserId : emailNormWant ? generateUserId(emailNormWant) : matchedUserId;

  return {
    ok: true,
    userId: slotUserId,
    doUserId: row.userId != null ? String(row.userId).trim() : '',
    email: effectiveEmail,
    username: row.username != null ? String(row.username) : 'there',
    legacyEmailNotOnFile: !storedEmail && !!emailNormWant,
  };
}

/**
 * Admin: mark an account’s email as verified without a token (clears pending verification fields).
 * Body: `{ "userId": "..." }` and/or `{ "email": "..." }` — if email is given, resolves userId via signup hash.
 */
async function handleAdminVerifyUserEmail(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resolved = await resolveAdminUserTarget(env, body);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ success: false, error: resolved.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const stub = userAccountStubFromUserId(env, resolved.userId);
  if (!stub) {
    return new Response(JSON.stringify({ success: false, error: 'Account not found' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  let result;
  try {
    const doRes = await stub.fetch(
      new Request('http://do/adminForceVerifyEmail', {
        method: 'POST',
        body: JSON.stringify({ email: resolved.email }),
      })
    );
    result = await doRes.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: e?.message || 'Could not reach account storage' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!result || !result.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: (result && result.error) || 'Verification update failed',
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true, alreadyVerified: !!result.alreadyVerified }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Admin: run the same email checks as signup (real inbox, MX, no existing account).
 * Body: `{ "email": "someone@example.com" }`
 */
async function handleAdminCheckSignupEmail(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const emailRaw = body.email != null ? String(body.email).trim() : '';
  if (!emailRaw) {
    return new Response(JSON.stringify({ success: false, error: 'email is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const evalResult = await evaluateSignupEmailForCreate(env, emailRaw);
  const canSignup = !!evalResult.ok;

  return new Response(
    JSON.stringify({
      success: true,
      email: evalResult.normalizedEmail || normalizeEmail(emailRaw),
      userId: evalResult.userId || '',
      canSignup,
      accountExists: !!evalResult.accountExists,
      accountUsername: evalResult.accountUsername || '',
      accountEmailVerified: evalResult.accountEmailVerified ?? null,
      legacyEmailNotOnFile: !!evalResult.legacyEmailNotOnFile,
      signupError: evalResult.signupError || null,
      steps: evalResult.steps || [],
      summary: canSignup
        ? 'Signup would accept this email (username and password still required).'
        : evalResult.signupError || 'Signup would reject this email.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/** Admin: permanently delete an account (no password). Body: `{ "userId": "..." }` and/or `{ "email": "..." }`. */
async function handleAdminDeleteUser(request, env, corsHeaders, executionCtx) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resolved = await resolveAdminUserTarget(env, body);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ success: false, error: resolved.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sendEmail = body.sendEmail === true;
  const del = await forceDeleteUserRecord(env, resolved, executionCtx, { sendEmail });
  if (!del.success) {
    return new Response(JSON.stringify({ success: false, error: del.error || 'Could not delete account' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, userId: del.userId, email: del.email, username: del.username }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Admin: send the standard welcome guide to one address; From caleb@ahrenslabs.com (broadcast sender). */
async function handleAdminSendWelcomeToUser(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resolved = await resolveAdminUserTarget(env, body);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ success: false, error: resolved.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    await sendWelcomeGuideEmail(env, resolved.email, resolved.username, {
      fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
      fromName: ADMIN_BROADCAST_FROM_NAME,
    });
  } catch (err) {
    const w = summarizeEmailSendError(err);
    return new Response(
      JSON.stringify({ success: false, error: w.hint || w.message || String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Admin: one-off message to one user; From caleb@ahrenslabs.com. Supports {{username}} and {{email}}. */
async function handleAdminSendCustomEmailToUser(request, env, corsHeaders) {
  let body = {};
  try {
    const raw = await request.text();
    if (raw && String(raw).trim()) body = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const resolved = await resolveAdminUserTarget(env, body);
  if (!resolved.ok) {
    return new Response(JSON.stringify({ success: false, error: resolved.error }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subjectTpl = body.subject != null ? String(body.subject).trim() : '';
  const textTpl = body.text != null ? String(body.text).trim() : '';
  const htmlTpl = body.html != null ? String(body.html) : '';

  if (!subjectTpl || !textTpl) {
    return new Response(JSON.stringify({ error: 'subject and text are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const subject = applyBroadcastTemplate(subjectTpl, {
    username: resolved.username,
    email: resolved.email,
  });
  const text = applyBroadcastTemplate(textTpl, {
    username: resolved.username,
    email: resolved.email,
  });
  const htmlRaw = htmlTpl.trim()
    ? applyBroadcastTemplate(htmlTpl, { username: resolved.username, email: resolved.email })
    : '';
  const html = htmlRaw.trim() ? htmlRaw : plainTextToBroadcastHtml(text);

  try {
    await dispatchTransactionalEmail(env, {
      to: resolved.email,
      subject,
      html,
      text,
      fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
      fromName: ADMIN_BROADCAST_FROM_NAME,
    });
  } catch (err) {
    const w = summarizeEmailSendError(err);
    return new Response(
      JSON.stringify({ success: false, error: w.hint || w.message || String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Admin QA: known transactional / product email sample ids (single send or full pack).
 * Verification and password-reset samples use non-working tokens.
 */
const ADMIN_TEST_EMAIL_IDS = [
  'welcome_guide',
  'verification',
  'password_reset',
  'account_deleted',
  'daily_digest',
  'milestone_wins',
  'milestone_games',
  'milestone_points',
  'season_track_finale',
  'broadcast_from_sample',
  'transactional_plain',
];

async function executeAdminTestEmailById(env, gate, id) {
  const to = gate.adminEmail;
  const un = gate.adminUsername || 'Player';

  switch (id) {
    case 'welcome_guide':
      await sendWelcomeGuideEmail(env, to, un, {
        fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
        fromName: ADMIN_BROADCAST_FROM_NAME,
      });
      return;
    case 'verification':
      await sendVerificationEmail(env, to, un, 'admin_preview_token_do_not_verify');
      return;
    case 'password_reset':
      await sendPasswordResetEmail(env, to, un, 'admin_preview_reset_do_not_use');
      return;
    case 'account_deleted':
      await sendAccountDeletedEmail(env, to, un);
      return;
    case 'daily_digest': {
      const digestDateStr = utcDateString(new Date());
      const digestIds = getDailyChallengeIdsForUtcDate(digestDateStr);
      await sendDailyDigestEmail(env, { email: to, username: un }, digestIds, { instant: true });
      return;
    }
    case 'milestone_wins':
    case 'milestone_games':
    case 'milestone_points': {
      const base = siteMarketingBase(env);
      const chessUrl = `${base}/chess_engine.html`;
      let chessBlock = {};
      if (gate.adminUserId && env.USER_ACCOUNT) {
        try {
          const userAccount = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(gate.adminUserId));
          const chessRes = await userAccount.fetch(new Request('http://do/getChessData', { method: 'GET' }));
          const raw = await chessRes.json();
          if (raw && typeof raw === 'object') chessBlock = raw;
        } catch {
          chessBlock = {};
        }
      }
      const snap = normalizeChessMilestoneEmailStats(chessStatsSnapshot(chessBlock));
      const spec =
        id === 'milestone_wins'
          ? { kind: 'wins', threshold: Math.max(1, snap.wins) }
          : id === 'milestone_games'
            ? { kind: 'games', threshold: Math.max(1, snap.games) }
            : { kind: 'points', threshold: Math.max(1, snap.points) };
      const p = buildChessMilestoneEmail({
        username: un,
        kind: spec.kind,
        threshold: spec.threshold,
        stats: snap,
        chessUrl,
      });
      await dispatchTransactionalEmail(env, { to, subject: `[Test] ${p.subject}`, html: p.html, text: p.text });
      return;
    }
    case 'season_track_finale': {
      const base = siteMarketingBase(env);
      const sid = utcChessSeasonIdNow();
      const p = buildSeasonTrackFinaleEmail({
        username: un,
        seasonId: sid,
        seasonBonusPoints: 4275,
        chessUrl: `${base}/chess_engine.html`,
        trackUrl: `${base}/chess-season-track.html`,
      });
      await dispatchTransactionalEmail(env, { to, subject: `[Test] ${p.subject}`, html: p.html, text: p.text });
      return;
    }
    case 'broadcast_from_sample': {
      const fromEsc = escapeHtmlEmail(ADMIN_BROADCAST_FROM_EMAIL);
      const nameEsc = escapeHtmlEmail(ADMIN_BROADCAST_FROM_NAME);
      await dispatchTransactionalEmail(env, {
        to,
        subject: '[Test] Broadcast From sample (admin)',
        html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#312e81 0%,#0f172a 100%);">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.35);">
<tr><td style="padding:22px 26px;background:linear-gradient(120deg,#818cf8,#c084fc);font-family:system-ui,sans-serif;">
<p style="margin:0;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#eef2ff;">Admin · broadcast sender</p>
<p style="margin:8px 0 0 0;font-size:20px;font-weight:900;color:#fff;line-height:1.2;">From line preview</p>
</td></tr>
<tr><td style="padding:24px 26px;font-family:system-ui,sans-serif;line-height:1.6;color:#334155;font-size:15px;">
<p style="margin:0 0 12px 0;">This uses the same <strong style="color:#0f172a;">From</strong> as admin broadcasts:</p>
<p style="margin:0 0 16px 0;padding:12px 14px;background:#f1f5f9;border-radius:10px;border-left:4px solid #6366f1;font-size:13px;word-break:break-all;"><code style="color:#4338ca;">${fromEsc}</code><br><span style="color:#64748b;">Display name:</span> <strong style="color:#0f172a;">${nameEsc}</strong></p>
<p style="margin:0 0 10px 0;">Real broadcasts merge <code style="background:#fef3c7;padding:2px 6px;border-radius:4px;color:#92400e;">{{username}}</code> and <code style="background:#fef3c7;padding:2px 6px;border-radius:4px;color:#92400e;">{{email}}</code> per recipient.</p>
<p style="margin:16px 0 0 0;font-size:13px;color:#94a3b8;font-style:italic;">Admin test pack — safe to delete.</p>
</td></tr></table></td></tr></table></body></html>`,
        text: `Broadcast From sample (same as bulk tools). From ${ADMIN_BROADCAST_FROM_EMAIL}. Admin test pack.`,
        fromAddr: ADMIN_BROADCAST_FROM_EMAIL,
        fromName: ADMIN_BROADCAST_FROM_NAME,
      });
      return;
    }
    case 'transactional_plain':
      await dispatchTransactionalEmail(env, {
        to,
        subject: '[Test] Default transactional sender',
        html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:linear-gradient(160deg,#134e4a 0%,#0f172a 100%);">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:16px;box-shadow:0 18px 44px rgba(0,0,0,.3);">
<tr><td style="padding:22px 24px;background:linear-gradient(135deg,#14b8a6,#0d9488);font-family:system-ui,sans-serif;">
<p style="margin:0;font-size:18px;font-weight:900;color:#fff;">Transactional path</p>
<p style="margin:6px 0 0 0;font-size:13px;color:#ccfbf1;">Default sender — no broadcast override</p>
</td></tr>
<tr><td style="padding:22px 24px;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
<p style="margin:0;">Uses the worker’s default transactional sender (same path as verification, reset, and digests). No <strong>From</strong> override.</p>
<p style="margin:14px 0 0 0;font-size:13px;color:#94a3b8;">Admin test pack.</p>
</td></tr></table></td></tr></table></body></html>`,
        text: 'Default transactional sender (no From override). Admin test pack.',
      });
      return;
    default:
      throw new Error(`Unknown test email type: ${id}`);
  }
}

async function handleAdminSendTestEmail(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw = body.type != null ? String(body.type).trim() : '';
  const id = raw.toLowerCase().replace(/-/g, '_');

  if (!id || !ADMIN_TEST_EMAIL_IDS.includes(id)) {
    return new Response(
      JSON.stringify({
        error: 'Missing or invalid type',
        validTypes: ADMIN_TEST_EMAIL_IDS,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    await executeAdminTestEmailById(env, gate, id);
    return new Response(JSON.stringify({ success: true, id, to: gate.adminEmail }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const w = summarizeEmailSendError(err);
    return new Response(
      JSON.stringify({
        success: false,
        id,
        error: w.hint || w.message || String(err?.message || err),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Admin only: send one sample of each built-in transactional / product email type to the
 * authenticated broadcast admin’s address (for QA). Verification and password-reset links use
 * placeholder tokens and must not be used.
 */
async function handleAdminSendAllTestEmails(request, env, corsHeaders) {
  const sessionId = parseBearerToken(request.headers.get('Authorization'));
  const gate = await assertAdminBroadcastSession(env, sessionId);
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: gate.error }), {
      status: gate.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results = [];
  for (const id of ADMIN_TEST_EMAIL_IDS) {
    try {
      await executeAdminTestEmailById(env, gate, id);
      results.push({ id, ok: true });
    } catch (err) {
      const w = summarizeEmailSendError(err);
      results.push({
        id,
        ok: false,
        error: w.hint || w.message || String(err?.message || err),
      });
    }
  }

  const okN = results.filter((r) => r.ok).length;
  return new Response(
    JSON.stringify({
      success: okN === results.length,
      to: gate.adminEmail,
      sent: okN,
      total: results.length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function verificationEmailOrigin(env) {
  return String(env.VERIFICATION_LINK_BASE || env.PUBLIC_SITE_BASE || 'https://ahrenslabs.com').replace(/\/$/, '');
}

function buildVerificationUrl(env, email, token) {
  const base = verificationEmailOrigin(env);
  const path = env.VERIFICATION_LANDING_PATH || '/account.html';
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const q = new URLSearchParams({ verify: token, email });
  return `${base}${pathWithLeadingSlash}?${q.toString()}`;
}

async function sendVerificationEmail(env, email, username, token) {
  const verificationUrl = buildVerificationUrl(env, email, token);
  const safeName = String(username).replace(/[<>]/g, '');
  const safeNameHtml = escapeHtmlEmail(safeName);
  const subject = 'You are one tap away — confirm your Ahrens Labs account';
  const urlEsc = escapeHtmlEmail(verificationUrl);
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#042f2e 0%,#0f172a 50%,#1e3a8a 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(120deg,#0d9488 0%,#2563eb 55%,#7c3aed 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ecfeff;opacity:.95;">Ahrens Labs</p>
            <p style="margin:10px 0 0 0;font-size:26px;font-weight:900;line-height:1.2;color:#ffffff;">Confirm your email</p>
            <p style="margin:10px 0 0 0;font-size:15px;line-height:1.55;color:#cffafe;">Unlock TrifangX saves, cloud sync, and every lab tied to one login.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
            <p style="margin:0 0 14px 0;font-size:18px;font-weight:700;">Hi ${safeNameHtml},</p>
            <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#334155;">Thanks for signing up. <strong style="color:#0f172a;">One quick confirm</strong> proves this inbox is yours — then you can sign in everywhere.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${verificationUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#14b8a6,#2563eb);color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:800;font-size:16px;box-shadow:0 12px 28px rgba(37,99,235,.35);">Confirm email address</a>
            </div>
            <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Or paste this link:</p>
            <p style="margin:0;padding:12px 14px;background:#f1f5f9;border-radius:10px;word-break:break-all;font-size:12px;color:#475569;line-height:1.5;">${urlEsc}</p>
            <p style="margin:22px 0 0 0;font-size:12px;line-height:1.55;color:#94a3b8;">If you did not create this account, you can ignore this message.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${safeName},`,
    '',
    'Thanks for creating an Ahrens Labs account.',
    'Open this link to confirm your email (required before you can sign in):',
    verificationUrl,
    '',
    'If you did not create this account, you can ignore this email.',
  ].join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
}

const CHESS_MILESTONE_WIN_THRESHOLDS = [1, 5, 10, 25, 50, 100, 250, 500];
const CHESS_MILESTONE_GAME_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000];
const CHESS_MILESTONE_POINT_THRESHOLDS = [1000, 5000, 10000, 20000, 50000, 100000];

/**
 * Coerce stats for milestone emails to match TrifangX `chessStatsSnapshot` / the
 * player stats under the board: games played = wins + losses + draws (no separate
 * games counter), points from `chess.points`.
 */
function normalizeChessMilestoneEmailStats(raw) {
  const wins = Math.max(0, Math.floor(Number(raw?.wins) || 0));
  const losses = Math.max(0, Math.floor(Number(raw?.losses) || 0));
  const draws = Math.max(0, Math.floor(Number(raw?.draws) || 0));
  const points = Math.max(0, Math.floor(Number(raw?.points) || 0));
  const games = wins + losses + draws;
  return { wins, losses, draws, games, points };
}

function buildChessMilestoneEmail({ username, kind, threshold, stats, chessUrl }) {
  const ns = normalizeChessMilestoneEmailStats(stats || {});
  const safeName = escapeHtmlEmail(username || 'there');
  const thresholdLabel = Number(threshold).toLocaleString();
  const winsLabel = Number(ns.wins).toLocaleString();
  const lossesLabel = Number(ns.losses).toLocaleString();
  const drawsLabel = Number(ns.draws).toLocaleString();
  const gamesLabel = Number(ns.games).toLocaleString();
  const pointsLabel = Number(ns.points).toLocaleString();
  const totalGames = ns.games;
  const effectiveWins = (ns.wins || 0) + 0.5 * (ns.draws || 0);
  const winRate = totalGames > 0 ? Math.round((effectiveWins / totalGames) * 100) : 0;
  const safeChessUrl = escapeHtmlEmail(chessUrl);

  const variants = {
    wins: {
      subject: `TrifangX milestone: ${thresholdLabel} career wins`,
      eyebrow: 'Win milestone unlocked',
      icon: '🏆',
      hero: `${thresholdLabel} Wins`,
      title: `Nice work, ${safeName}.`,
      lead: `You just reached <strong>${thresholdLabel} career wins</strong> against TrifangX.`,
      accent: '#22c55e',
      accentDark: '#15803d',
      glow: '#bbf7d0',
      textLine: `You reached ${thresholdLabel} career wins against TrifangX.`,
    },
    games: {
      subject: `TrifangX milestone: ${thresholdLabel} games played`,
      eyebrow: 'Games milestone unlocked',
      icon: '♟️',
      hero: `${thresholdLabel} Games`,
      title: `That is a lot of chess, ${safeName}.`,
      lead: `You have now played <strong>${thresholdLabel} games</strong> against TrifangX.`,
      accent: '#38bdf8',
      accentDark: '#0369a1',
      glow: '#bae6fd',
      textLine: `You reached ${thresholdLabel} games played against TrifangX.`,
    },
    points: {
      subject: `TrifangX milestone: ${thresholdLabel} points`,
      eyebrow: 'Points milestone unlocked',
      icon: '⚡',
      hero: `${thresholdLabel} Points`,
      title: `Your score keeps climbing, ${safeName}.`,
      lead: `You crossed <strong>${thresholdLabel} career points</strong> in TrifangX.`,
      accent: '#f59e0b',
      accentDark: '#b45309',
      glow: '#fde68a',
      textLine: `You reached ${thresholdLabel} career points in TrifangX.`,
    },
  };
  const v = variants[kind] || variants.points;
  const preheader = `${v.textLine} ${gamesLabel} games · ${pointsLabel} pts · ${winsLabel}W/${lossesLabel}L/${drawsLabel}D.`;
  const statCell = (label, value, color, rim) => `<td width="20%" style="padding:5px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(180deg,#ffffff 0%,#f1f5f9 100%);border:1px solid #e2e8f0;border-radius:14px;border-left:4px solid ${rim};box-shadow:0 8px 22px rgba(15,23,42,.1);">
      <tr><td style="padding:12px 5px;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <div style="font-size:20px;font-weight:900;line-height:1;color:${color};">${value}</div>
        <div style="margin-top:5px;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#64748b;">${label}</div>
      </td></tr>
    </table>
  </td>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#020617 0%,#1e1b4b 40%,#0f172a 100%);">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtmlEmail(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:transparent;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;width:100%;background:#f8fafc;border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06) inset;">
          <tr>
            <td style="background-image:linear-gradient(125deg,#020617 0%,#312e81 32%,#1d4ed8 58%,${v.accentDark} 100%);padding:36px 34px 32px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;">
              <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);color:${v.glow};font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">${escapeHtmlEmail(v.eyebrow)}</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="font-size:44px;font-weight:900;line-height:1.05;margin:0;color:#ffffff;text-shadow:0 2px 22px rgba(0,0,0,.35),0 0 40px ${v.glow};">${escapeHtmlEmail(v.hero)}</div>
                    <div style="font-size:16px;line-height:1.55;color:#e0e7ff;margin-top:12px;font-weight:500;">Your TrifangX career just hit a new high — here is where the run stands by the numbers.</div>
                  </td>
                  <td width="88" align="right" style="vertical-align:middle;">
                    <div style="width:76px;height:76px;border-radius:22px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.25);text-align:center;line-height:74px;font-size:40px;box-shadow:0 8px 28px rgba(0,0,0,.25);">${v.icon}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 34px 10px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#172033;">
              <h1 style="margin:0 0 12px 0;font-size:27px;line-height:1.2;color:#0f172a;">${v.title}</h1>
              <p style="margin:0;font-size:17px;line-height:1.65;color:#475569;">${v.lead}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 22px 6px 22px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  ${statCell('Wins', winsLabel, '#16a34a', '#22c55e')}
                  ${statCell('Losses', lossesLabel, '#ef4444', '#fb7185')}
                  ${statCell('Draws', drawsLabel, '#7c3aed', '#c084fc')}
                  ${statCell('Games', gamesLabel, '#0284c7', '#22d3ee')}
                  ${statCell('Points', pointsLabel, '#d97706', '#fbbf24')}
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 34px 6px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(135deg,#ffffff 0%,#f8fafc 100%);border:1px solid #e2e8f0;border-radius:16px;box-shadow:0 4px 16px rgba(15,23,42,.06);">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:13px;font-weight:800;color:#334155;margin-bottom:10px;">Win rate: <strong style="color:${v.accentDark};">${winRate}%</strong> <span style="font-weight:600;color:#64748b;">(${gamesLabel} games)</span></div>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden;"><div style="width:${Math.min(100, Math.max(0, winRate))}%;height:12px;background:linear-gradient(90deg,${v.accentDark},${v.accent});border-radius:999px;line-height:12px;font-size:0;">&nbsp;</div></td></tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:28px 34px 38px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
              <a href="${safeChessUrl}" style="display:inline-block;background:linear-gradient(135deg,${v.accent} 0%,${v.accentDark} 100%);color:#ffffff !important;text-decoration:none;border-radius:999px;padding:16px 30px;font-weight:900;font-size:16px;box-shadow:0 10px 28px rgba(15,23,42,.25);">Play another game →</a>
              <p style="margin:18px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">Chase the next milestone, rack up achievements, and climb the <strong style="color:#0f766e;">leaderboards</strong>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${username || 'there'},`,
    '',
    v.textLine,
    `Record: ${winsLabel}W / ${lossesLabel}L / ${drawsLabel}D — ${gamesLabel} games, ${pointsLabel} pts.`,
    `Win rate: ${winRate}%.`,
    '',
    `Play another game: ${chessUrl}`,
  ].join('\n');

  return { subject: v.subject, html, text };
}

function formatSeasonIdForEmail(seasonId) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(seasonId || '').trim());
  if (!m) return String(seasonId || '').trim() || 'this month';
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(m[2], 10) - 1;
  const mo = names[idx] || m[2];
  return `${mo} ${m[1]}`;
}

function buildSeasonTrackFinaleEmail({ username, seasonId, seasonBonusPoints, chessUrl, trackUrl }) {
  const safeName = escapeHtmlEmail(username || 'there');
  const seasonLabel = escapeHtmlEmail(formatSeasonIdForEmail(seasonId));
  const bonusLabel = Number(Math.max(0, Math.floor(Number(seasonBonusPoints) || 0))).toLocaleString();
  const safeChessUrl = escapeHtmlEmail(chessUrl);
  const safeTrackUrl = escapeHtmlEmail(trackUrl);
  const subject = `TrifangX season cleared — ${formatSeasonIdForEmail(seasonId)}`;
  const preheader = `You ran the table this month — rare cosmetics, leaderboard sparkle, and ${bonusLabel} bonus points to flex with.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#042f2e 0%,#1e1b4b 45%,#0f172a 100%);">
  <div style="display:none;max-height:0;overflow:hidden;">${escapeHtmlEmail(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:transparent;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;width:100%;background:#f8fafc;border-radius:22px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06) inset;">
          <tr>
            <td style="background-image:linear-gradient(125deg,#0f766e 0%,#4f46e5 48%,#6d28d9 100%);padding:36px 34px 32px 34px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#ffffff;">
              <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);color:#fef9c3;font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;">Season track complete</div>
              <p style="margin:18px 0 0 0;font-size:34px;font-weight:900;line-height:1.1;color:#fff;text-shadow:0 2px 22px rgba(0,0,0,.35);">Congratulations, ${safeName}!</p>
              <p style="margin:14px 0 0 0;font-size:16px;line-height:1.55;color:#e0e7ff;font-weight:500;">You cleared <strong style="color:#fef08a;">all 10 challenges</strong> on the <strong style="color:#fff;">${seasonLabel}</strong> ladder — that puts you in rare company.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 30px 10px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.65;color:#334155;">
              <p style="margin:0 0 14px 0;">You unlocked the big finale bundle: showy <strong>boards and piece sets</strong>, a moody <strong>theme</strong>, and extras that make your moves feel louder. You also picked up <strong>titles and frames</strong> so your name can shine the way you want it to on the <strong style="color:#0f766e;">public leaderboard</strong>.</p>
              <p style="margin:0 0 14px 0;">On top of the bragging rights, you banked <strong style="color:#0f766e;">${escapeHtmlEmail(bonusLabel)}</strong> <strong>bonus points this season</strong> — stack that on your achievement score and watch the ranks react.</p>
              <p style="margin:0 0 18px 0;">Jump in, equip what you like, and give the ladder something to remember you by.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 30px 36px 30px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
              <a href="${safeChessUrl}" style="display:inline-block;margin:6px;background:linear-gradient(135deg,#14b8a6,#0d9488);color:#ffffff !important;text-decoration:none;border-radius:999px;padding:14px 26px;font-weight:900;font-size:15px;box-shadow:0 10px 28px rgba(15,118,110,.35);">Open TrifangX →</a>
              <a href="${safeTrackUrl}" style="display:inline-block;margin:6px;background:linear-gradient(135deg,#6366f1,#4f46e5);color:#ffffff !important;text-decoration:none;border-radius:999px;padding:14px 26px;font-weight:900;font-size:15px;box-shadow:0 10px 28px rgba(79,70,229,.35);">Season track page →</a>
              <p style="margin:20px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">Next month brings a brand-new climb — same heat, fresh rewards. Hope we see you at the top again.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${username || 'there'},`,
    '',
    `You cleared every rung of the ${formatSeasonIdForEmail(seasonId)} season ladder — all 10 TrifangX monthly challenges. That is a rare finish.`,
    '',
    'You unlocked the finale bundle: exclusive boards, pieces, themes, and flair so you can stand out on the public leaderboard. You also piled on bonus points for the season — ',
    `${bonusLabel} extra — on top of what you earned from achievements, so your career score gets a serious bump.`,
    '',
    `Open TrifangX and equip what you like: ${chessUrl}`,
    `See the track and what is next: ${trackUrl}`,
    '',
    'A new ladder opens next month if you want another shot at the spotlight.',
  ].join('\n');

  return { subject, html, text };
}

/** Public site URL for links in transactional email (same as marketing/welcome). */
function sitePublicBase(env) {
  return siteMarketingBase(env);
}

/** Links in product/marketing emails (welcome, challenge emails). Defaults to ahrenslabs.com. */
function siteMarketingBase(env) {
  return String(env.PUBLIC_SITE_BASE || 'https://ahrenslabs.com').replace(/\/$/, '');
}

/**
 * Deep-merge chess `stats` so a partial incoming payload (e.g. only lifetimeStats)
 * cannot replace the whole `stats` object and drop `playerStats` (or vice versa).
 */
function mergeChessStatsForSync(prevStats, incomingStats, fullReplace) {
  const base = prevStats && typeof prevStats === 'object' && !Array.isArray(prevStats) ? prevStats : {};
  const inc = incomingStats && typeof incomingStats === 'object' && !Array.isArray(incomingStats) ? incomingStats : {};
  const incPs = inc.playerStats && typeof inc.playerStats === 'object' ? inc.playerStats : {};
  const incLt = inc.lifetimeStats && typeof inc.lifetimeStats === 'object' ? inc.lifetimeStats : {};
  if (fullReplace) {
    return {
      playerStats: {
        wins: Math.max(0, Math.floor(Number(incPs.wins) || 0)),
        losses: Math.max(0, Math.floor(Number(incPs.losses) || 0)),
        draws: Math.max(0, Math.floor(Number(incPs.draws) || 0)),
      },
      lifetimeStats: { ...incLt },
    };
  }
  const prevPs = base.playerStats && typeof base.playerStats === 'object' ? base.playerStats : {};
  const prevLt = base.lifetimeStats && typeof base.lifetimeStats === 'object' ? base.lifetimeStats : {};
  const mergedPs = { ...prevPs, ...incPs };
  return {
    ...base,
    ...inc,
    playerStats: {
      wins: Math.max(0, Math.floor(Number(mergedPs.wins) || 0)),
      losses: Math.max(0, Math.floor(Number(mergedPs.losses) || 0)),
      draws: Math.max(0, Math.floor(Number(mergedPs.draws) || 0)),
    },
    lifetimeStats: mergeLifetimeStatsMonotonic(prevLt, incLt, fullReplace),
  };
}

/** Numeric career counters must never decrease on sync unless `fullReplace` (explicit reset). */
function mergeLifetimeStatsMonotonic(prevLt, incLt, fullReplace) {
  if (fullReplace) {
    return incLt && typeof incLt === 'object' ? { ...incLt } : {};
  }
  const prev = prevLt && typeof prevLt === 'object' ? prevLt : {};
  const inc = incLt && typeof incLt === 'object' ? incLt : {};
  const merged = { ...prev };
  const keys = new Set([...Object.keys(prev), ...Object.keys(inc)]);
  for (const key of keys) {
    const p = prev[key];
    const v = inc[key];
    if (v === undefined) continue;
    if (typeof v === 'number' && typeof p === 'number') {
      merged[key] = Math.max(p, v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      const pObj = p && typeof p === 'object' && !Array.isArray(p) ? p : {};
      if (key === 'dailyStats') {
        const pDate = pObj.lastResetDate != null ? String(pObj.lastResetDate) : '';
        const vDate = v.lastResetDate != null ? String(v.lastResetDate) : '';
        merged[key] = vDate >= pDate ? { ...pObj, ...v } : { ...v, ...pObj };
      } else if (key === 'winsByTimeControl' || key === 'winsByPersonality') {
        const out = { ...pObj };
        for (const sk of new Set([...Object.keys(pObj), ...Object.keys(v)])) {
          out[sk] = Math.max(Number(pObj[sk]) || 0, Number(v[sk]) || 0);
        }
        merged[key] = out;
      } else {
        merged[key] = mergeLifetimeStatsMonotonic(pObj, v, false);
      }
    } else if (v !== null) {
      merged[key] = v;
    }
  }
  return merged;
}

function mergeSeasonEarnBaselineMonotonic(prevB, incB) {
  const prev = prevB && typeof prevB === 'object' ? prevB : {};
  const inc = incB && typeof incB === 'object' ? incB : {};
  const out = { ...prev };
  for (const key of new Set([...Object.keys(prev), ...Object.keys(inc)])) {
    out[key] = Math.max(Number(prev[key]) || 0, Number(inc[key]) || 0);
  }
  return out;
}

/** Heuristic: how much career activity is stored in lifetime stats (+ record W/L). */
function chessLifetimeCareerScore(lt, playerStats) {
  const stats = lt && typeof lt === 'object' ? lt : {};
  const ps = playerStats && typeof playerStats === 'object' ? playerStats : {};
  let score = 0;
  score += Math.max(0, Number(stats.totalCaptures) || 0);
  score += Math.max(0, Number(stats.checksGiven) || 0);
  score += Math.max(0, Number(stats.promotions) || 0) * 2;
  score += Math.max(0, Number(stats.castlingMoves) || 0) * 2;
  score += Math.max(0, Number(stats.totalGamesPlayed) || 0) * 5;
  score +=
    (Math.max(0, Number(ps.wins) || 0) + Math.max(0, Number(ps.losses) || 0) + Math.max(0, Number(ps.draws) || 0)) *
    10;
  return score;
}

function snapshotChessCareerStatsBackup(chess) {
  if (!chess || typeof chess !== 'object') return null;
  const lt = chess.stats?.lifetimeStats;
  const st = chess.seasonTrack;
  return {
    savedAt: Date.now(),
    stats: {
      playerStats: { ...(chess.stats?.playerStats || {}) },
      lifetimeStats: lt && typeof lt === 'object' ? JSON.parse(JSON.stringify(lt)) : {},
    },
    seasonTrack: st && typeof st === 'object' ? JSON.parse(JSON.stringify(st)) : null,
    seasonBonusPoints: Math.max(0, Math.floor(Number(chess.seasonBonusPoints) || 0)),
  };
}

/** Rebuild minimal W/L/draw totals from synced game history when lifetime stats were wiped. */
function rebuildPlayerStatsFloorFromGameHistory(gameHistory, existingPs) {
  const ps = {
    wins: Math.max(0, Math.floor(Number(existingPs?.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(existingPs?.losses) || 0)),
    draws: Math.max(0, Math.floor(Number(existingPs?.draws) || 0)),
  };
  const hist = Array.isArray(gameHistory) ? gameHistory : [];
  let hw = 0;
  let hl = 0;
  let hd = 0;
  for (const rec of hist) {
    if (!rec || typeof rec !== 'object') continue;
    const color = String(rec.playerColor || '').toLowerCase();
    const result = String(rec.result || '');
    if (result === '1/2-1/2') {
      hd++;
      continue;
    }
    if (result === '1-0') {
      if (color === 'white') hw++;
      else if (color === 'black') hl++;
      continue;
    }
    if (result === '0-1') {
      if (color === 'white') hl++;
      else if (color === 'black') hw++;
    }
  }
  return {
    wins: Math.max(ps.wins, hw),
    losses: Math.max(ps.losses, hl),
    draws: Math.max(ps.draws, hd),
  };
}

function pickBestChessCareerBackup(chess) {
  const candidates = [];
  if (chess.careerStatsBackup && typeof chess.careerStatsBackup === 'object') {
    candidates.push(chess.careerStatsBackup);
  }
  if (Array.isArray(chess.careerStatsBackups)) {
    for (const b of chess.careerStatsBackups) {
      if (b && typeof b === 'object') candidates.push(b);
    }
  }
  let best = null;
  let bestScore = -1;
  for (const b of candidates) {
    const s = chessLifetimeCareerScore(b.stats?.lifetimeStats, b.stats?.playerStats);
    if (s > bestScore) {
      bestScore = s;
      best = b;
    }
  }
  return best;
}

function appendChessCareerBackup(chess, snap) {
  if (!snap || !chess || typeof chess !== 'object') return;
  chess.careerStatsBackup = snap;
  const list = Array.isArray(chess.careerStatsBackups) ? chess.careerStatsBackups.slice() : [];
  list.push(snap);
  while (list.length > 8) list.shift();
  chess.careerStatsBackups = list;
}

function applyChessCareerBackupToChess(chess, backup) {
  if (!backup || !chess) return;
  chess.stats = chess.stats && typeof chess.stats === 'object' ? chess.stats : {};
  chess.stats.playerStats = { ...(backup.stats?.playerStats || chess.stats.playerStats || {}) };
  chess.stats.lifetimeStats = mergeLifetimeStatsMonotonic(
    chess.stats.lifetimeStats,
    backup.stats?.lifetimeStats || {},
    false
  );
  if (backup.seasonTrack && typeof backup.seasonTrack === 'object') {
    chess.seasonTrack = JSON.parse(JSON.stringify(backup.seasonTrack));
  }
  if (Object.prototype.hasOwnProperty.call(backup, 'seasonBonusPoints')) {
    chess.seasonBonusPoints = Math.max(
      Math.max(0, Math.floor(Number(chess.seasonBonusPoints) || 0)),
      Math.max(0, Math.floor(Number(backup.seasonBonusPoints) || 0))
    );
  }
}

function repairChessCareerStatsInPlace(chess) {
  if (!chess || typeof chess !== 'object') return { repaired: false, source: null };
  chess.stats = chess.stats && typeof chess.stats === 'object' ? chess.stats : {};
  const prevLt = chess.stats.lifetimeStats;
  const prevScore = chessLifetimeCareerScore(prevLt, chess.stats.playerStats);
  const backup = pickBestChessCareerBackup(chess);
  const backupScore = backup
    ? chessLifetimeCareerScore(backup.stats?.lifetimeStats, backup.stats?.playerStats)
    : 0;

  if (backup && backupScore > prevScore + 15 && backupScore >= 40) {
    applyChessCareerBackupToChess(chess, backup);
    return { repaired: true, source: 'backup' };
  }

  const hist = Array.isArray(chess.gameHistory) ? chess.gameHistory : [];
  const achKeys = chess.achievements && typeof chess.achievements === 'object' ? Object.keys(chess.achievements) : [];
  const achCount = achKeys.filter((k) => {
    const v = chess.achievements[k];
    return v === true || v === 1 || (v && typeof v === 'object');
  }).length;
  const looksWiped = prevScore < 150 && (hist.length >= 2 || achCount >= 4);

  if (looksWiped && hist.length >= 2) {
    const floorPs = rebuildPlayerStatsFloorFromGameHistory(hist, chess.stats.playerStats);
    const games = floorPs.wins + floorPs.losses + floorPs.draws;
    if (games >= 2) {
      chess.stats.playerStats = floorPs;
      const lt = prevLt && typeof prevLt === 'object' ? { ...prevLt } : {};
      lt.totalGamesPlayed = Math.max(Number(lt.totalGamesPlayed) || 0, games, hist.length);
      chess.stats.lifetimeStats = lt;
      return { repaired: true, source: 'gameHistory-floor', needsClientReplay: true };
    }
  }

  return { repaired: false, source: null, needsClientReplay: looksWiped && hist.length >= 2 };
}

const CHESS_SEASON_MAX_NODES = 10;
const CHESS_LB_FLAIR_FRAMES = new Set(['silver_lane', 'amber_pulse', 'violet_arc']);

/** Must match `SEASON_TRACK_MECHANICAL` in js/chess_seasons.js (claim validation). */
const SEASON_CLAIM_NODES = [
  { challengeAchievementId: 'first_game', bonusPoints: 40, rewards: [{ kind: 'lb_prefix', prefix: '🌲' }] },
  {
    challengeAchievementId: 'knight_to_f3',
    bonusPoints: 57,
    rewards: [{ kind: 'shop', category: 'boards', id: 'season_awakening' }],
  },
  {
    challengeAchievementId: 'bishop_to_f4',
    bonusPoints: 82,
    rewards: [{ kind: 'shop', category: 'highlightColors', id: 'season_glacier_glow' }],
  },
  {
    challengeAchievementId: 'en_passant',
    bonusPoints: 118,
    rewards: [
      { kind: 'shop', category: 'pieces', id: 'season_trail' },
      { kind: 'lb_row_finish', presets: ['emerald_glade', 'glacier_ribbon'] },
    ],
  },
  {
    challengeAchievementId: 'queen_capturer',
    bonusPoints: 169,
    rewards: [{ kind: 'lb_frame', frame: 'silver_lane' }],
  },
  {
    challengeAchievementId: 'capture_master',
    bonusPoints: 242,
    rewards: [{ kind: 'lb_title', title: 'Emerald grove hunter' }],
  },
  {
    challengeAchievementId: 'castler',
    bonusPoints: 347,
    rewards: [
      { kind: 'lb_frame', frame: 'amber_pulse' },
      { kind: 'lb_row_finish', presets: ['violet_canopy', 'moonlit_band'] },
    ],
  },
  {
    challengeAchievementId: 'promoter',
    bonusPoints: 496,
    rewards: [{ kind: 'shop', category: 'boards', id: 'season_rift' }],
  },
  {
    challengeAchievementId: 'checkmate_rook',
    bonusPoints: 709,
    rewards: [{ kind: 'lb_title', title: 'Canopy spire sniper' }],
  },
  {
    challengeAchievementId: 'checkmate_queen',
    bonusPoints: 1015,
    rewards: [
      { kind: 'lb_frame', frame: 'violet_arc' },
      { kind: 'lb_title', title: 'Emerald ascendant' },
      { kind: 'lb_title', title: 'Emerald crown' },
      { kind: 'lb_title', title: 'Canopy finisher' },
      { kind: 'lb_suffix', suffix: '✦' },
      { kind: 'shop', category: 'boards', id: 'season_canopy_crown' },
      { kind: 'shop', category: 'pieces', id: 'season_canopy_pieces' },
      { kind: 'shop', category: 'highlightColors', id: 'season_gilded_leaf' },
      { kind: 'shop', category: 'arrowColors', id: 'season_grove_arrow' },
      { kind: 'shop', category: 'themes', id: 'season_moonlit_canopy' },
      { kind: 'shop', category: 'checkmateEffects', id: 'season_finale_flare' },
      { kind: 'shop', category: 'legalMoveDots', id: 'season_emerald_star' },
      { kind: 'lb_row_finish', presets: ['finale_aurora'] },
    ],
  },
];

/** Must match `SEASON_STEP_BUYOUT_POINTS` in js/chess_seasons.js */
const SEASON_STEP_BUYOUT_POINTS = Object.freeze([
  500, 1000, 3000, 5000, 8000, 12000, 15000, 18000, 20000, 30000,
]);

/** Same pool as TrifangX shop: achievement points + cheat minus pointsSpent (not career/leaderboard total). */
function getChessShopSpendable(chess) {
  const fromAch = Math.max(0, Math.floor(Number(chess?.points) || 0));
  const cheat = Math.max(0, Math.floor(Number(chess?.cheatPoints) || 0));
  const spent = Math.max(0, Math.floor(Number(chess?.pointsSpent) || 0));
  return Math.max(0, fromAch + cheat - spent);
}

function seasonTrackNodesCompletedFromChess(chess) {
  const st = chess?.seasonTrack && typeof chess.seasonTrack === 'object' ? chess.seasonTrack : {};
  return Math.min(CHESS_SEASON_MAX_NODES, Math.max(0, Math.floor(Number(st.nodesCompleted) || 0)));
}

function seasonTrackIdFromChess(chess) {
  const st = chess?.seasonTrack && typeof chess.seasonTrack === 'object' ? chess.seasonTrack : {};
  const sid = String(st.seasonId || '').trim();
  return /^\d{4}-\d{2}$/.test(sid) ? sid : '';
}

/** One congratulations email per UTC season id, when `nodesCompleted` crosses to 10 (same rules as milestone mail). */
async function maybeSendSeasonTrackFinaleEmail(env, storage, userData, prevChess, nextChess) {
  const prevN = seasonTrackNodesCompletedFromChess(prevChess || {});
  const nextN = seasonTrackNodesCompletedFromChess(nextChess || {});
  if (!(prevN < CHESS_SEASON_MAX_NODES && nextN >= CHESS_SEASON_MAX_NODES)) return;

  const seasonId = seasonTrackIdFromChess(nextChess) || seasonTrackIdFromChess(prevChess);
  if (!seasonId) return;

  const email = normalizeEmail(userData.email || '');
  if (!email || !isLikelyRealEmail(email)) return;
  if (userData.emailVerified === false) return;

  if (!userData.milestonesEmailNotified || typeof userData.milestonesEmailNotified !== 'object') {
    userData.milestonesEmailNotified = {};
  }
  const key = `trifangx_season_finale_${seasonId}`;
  if (userData.milestonesEmailNotified[key]) return;

  const username = userData.username || 'Player';
  const bonus = Math.max(0, Math.floor(Number(nextChess?.seasonBonusPoints) || 0));
  const base = siteMarketingBase(env);
  const parts = buildSeasonTrackFinaleEmail({
    username,
    seasonId,
    seasonBonusPoints: bonus,
    chessUrl: `${base}/chess_engine.html`,
    trackUrl: `${base}/chess-season-track.html`,
  });

  try {
    await dispatchTransactionalEmail(env, { to: email, subject: parts.subject, html: parts.html, text: parts.text });
    userData.milestonesEmailNotified[key] = Date.now();
    await storage.put('userData', userData);
  } catch (err) {
    const w = summarizeEmailSendError(err);
    console.error('Season track finale email failed', seasonId, w.code, w.message);
  }
}

function utcChessSeasonIdNow() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Snapshot career counters after a season claim so the next step only earns post-claim progress. */
function snapshotSeasonEarnBaselineFromChess(chess) {
  const ps = chess?.stats?.playerStats || {};
  const ltRaw = chess?.stats?.lifetimeStats;
  const lt = ltRaw && typeof ltRaw === 'object' ? ltRaw : {};
  const w = Math.max(0, Number(ps.wins) || 0);
  const l = Math.max(0, Number(ps.losses) || 0);
  const dr = Math.max(0, Number(ps.draws) || 0);
  return {
    games: w + l + dr,
    wins: w,
    castlingMoves: Math.max(0, Number(lt.castlingMoves) || 0),
    promotions: Math.max(0, Number(lt.promotions) || 0),
    capturedRooks: Math.max(0, Number(lt.capturedRooks) || 0),
    checkmateWithQueen: Math.max(0, Number(lt.checkmateWithQueen) || 0),
    knightToF3: Math.max(0, Number(lt.knightToF3) || 0),
    bishopToF4: Math.max(0, Number(lt.bishopToF4) || 0),
    enPassants: Math.max(0, Number(lt.enPassants) || 0),
    capturesByQueen: Math.max(0, Number(lt.capturesByQueen) || 0),
    totalCaptures: Math.max(0, Number(lt.totalCaptures) || 0),
    checkmateWithRook: Math.max(0, Number(lt.checkmateWithRook) || 0),
  };
}

/** Same targets as `js/chess_seasons.js` SEASON_STEP_EARN_RULES — season claims use deltas vs `earnBaseline`, not legacy achievement flags. */
const SEASON_STEP_EARN_RULES = Object.freeze({
  first_game: { type: 'games', target: 1 },
  knight_to_f3: { type: 'lifetime', key: 'knightToF3', target: 1 },
  bishop_to_f4: { type: 'lifetime', key: 'bishopToF4', target: 1 },
  en_passant: { type: 'lifetime', key: 'enPassants', target: 1 },
  queen_capturer: { type: 'lifetime', key: 'capturesByQueen', target: 10 },
  capture_master: { type: 'lifetime', key: 'totalCaptures', target: 50 },
  castler: { type: 'lifetime', key: 'castlingMoves', target: 5 },
  promoter: { type: 'lifetime', key: 'promotions', target: 5 },
  checkmate_rook: { type: 'lifetime', key: 'checkmateWithRook', target: 1 },
  checkmate_queen: { type: 'lifetime', key: 'checkmateWithQueen', target: 1 },
});

function readEarnBaselineField(baseline, key) {
  if (!baseline || typeof baseline !== 'object') return 0;
  return Math.max(0, Number(baseline[key]) || 0);
}

function seasonChallengeMetSinceBaseline(chess, baseline, achId) {
  const id = String(achId || '');
  const rule = SEASON_STEP_EARN_RULES[id];
  if (!rule) return false;
  const ps = chess?.stats?.playerStats || {};
  const w = Math.max(0, Number(ps.wins) || 0);
  const l = Math.max(0, Number(ps.losses) || 0);
  const dr = Math.max(0, Number(ps.draws) || 0);
  const games = w + l + dr;
  const ltRaw = chess?.stats?.lifetimeStats;
  const lt = ltRaw && typeof ltRaw === 'object' ? ltRaw : {};
  const g = (k) => Math.max(0, Number(lt[k]) || 0);
  if (rule.type === 'games') {
    return games - readEarnBaselineField(baseline, 'games') >= rule.target;
  }
  if (rule.type === 'lifetime') {
    return g(rule.key) - readEarnBaselineField(baseline, rule.key) >= rule.target;
  }
  return false;
}

function chessAchievementUnlocked(rawAchievements, achId) {
  const key = String(achId || '');
  if (!key || !rawAchievements || typeof rawAchievements !== 'object' || Array.isArray(rawAchievements)) {
    return false;
  }
  const v = rawAchievements[key];
  if (v === true || v === 1) return true;
  if (v && typeof v === 'object' && !Array.isArray(v)) return true;
  return false;
}

function uniqStrings(a) {
  return [...new Set((Array.isArray(a) ? a : []).map((x) => String(x)))];
}

/** Per-category union so a stale client sync cannot drop server-side season shop unlocks. */
const SHOP_UNLOCK_MERGE_KEYS = [
  'boards',
  'pieces',
  'highlightColors',
  'arrowColors',
  'legalMoveDots',
  'themes',
  'timeControls',
  'checkmateEffects',
  'leaderboardRowColors',
];

function mergeShopUnlocksForSync(prevShop, incShop) {
  const p = prevShop && typeof prevShop === 'object' ? prevShop : {};
  const i = incShop && typeof incShop === 'object' ? incShop : {};
  const out = { ...p };
  for (const cat of SHOP_UNLOCK_MERGE_KEYS) {
    out[cat] = uniqStrings([...(Array.isArray(p[cat]) ? p[cat] : []), ...(Array.isArray(i[cat]) ? i[cat] : [])]);
  }
  return out;
}

function applySeasonClaimRewardsToChess(chess, node) {
  const shop =
    chess.shopUnlocks && typeof chess.shopUnlocks === 'object' ? { ...chess.shopUnlocks } : {};
  const categories = [
    'boards',
    'pieces',
    'highlightColors',
    'arrowColors',
    'legalMoveDots',
    'themes',
    'timeControls',
    'leaderboardRowColors',
  ];
  for (const cat of categories) {
    if (!Array.isArray(shop[cat])) shop[cat] = shop[cat] ? [...shop[cat]] : [];
  }
  if (!Array.isArray(shop.checkmateEffects)) shop.checkmateEffects = shop.checkmateEffects ? [...shop.checkmateEffects] : [];

  const st =
    chess.seasonTrack && typeof chess.seasonTrack === 'object' ? { ...chess.seasonTrack } : {};
  const prevOwned = st.lbFlairUnlocked && typeof st.lbFlairUnlocked === 'object' ? st.lbFlairUnlocked : {};
  const owned = {
    frames: [...(prevOwned.frames || [])],
    titles: [...(prevOwned.titles || [])],
    prefixes: [...(prevOwned.prefixes || [])],
    suffixes: [...(prevOwned.suffixes || [])],
  };
  let lbFlair = { ...(st.lbFlair && typeof st.lbFlair === 'object' ? st.lbFlair : {}) };

  const rewards = Array.isArray(node.rewards) ? node.rewards : [];
  let lbTitleEquippedThisNode = false;
  for (const r of rewards) {
    if (!r || typeof r !== 'object') continue;
    if (r.kind === 'shop' && r.category && r.id) {
      const cat = String(r.category);
      if (!shop[cat]) shop[cat] = [];
      const id = String(r.id);
      if (!shop[cat].includes(id)) shop[cat].push(id);
    } else if (r.kind === 'lb_frame' && r.frame && CHESS_LB_FLAIR_FRAMES.has(String(r.frame))) {
      const f = String(r.frame);
      if (!owned.frames.includes(f)) owned.frames.push(f);
      lbFlair = { ...lbFlair, frame: f };
    } else if (r.kind === 'lb_title' && r.title) {
      const t = String(r.title).trim().slice(0, 24);
      if (t) {
        if (!owned.titles.includes(t)) owned.titles.push(t);
        if (!lbTitleEquippedThisNode) {
          lbFlair = { ...lbFlair, title: t };
          lbTitleEquippedThisNode = true;
        }
      }
    } else if (r.kind === 'lb_prefix' && r.prefix != null) {
      const p = [...String(r.prefix)].slice(0, 3).join('');
      if (p && !owned.prefixes.includes(p)) owned.prefixes.push(p);
      lbFlair = { ...lbFlair, prefix: p };
    } else if (r.kind === 'lb_suffix' && r.suffix != null) {
      const s = [...String(r.suffix)].slice(0, 3).join('');
      if (s && !owned.suffixes.includes(s)) owned.suffixes.push(s);
      lbFlair = { ...lbFlair, suffix: s };
    }
  }

  st.lbFlairUnlocked = {
    frames: uniqStrings(owned.frames),
    titles: uniqStrings(owned.titles),
    prefixes: uniqStrings(owned.prefixes),
    suffixes: uniqStrings(owned.suffixes),
  };
  st.lbFlair = sanitizeChessLbFlair(lbFlair);
  chess.shopUnlocks = ensureChessShopUnlockBasics(shop);
  chess.seasonTrack = st;
}

function sanitizeChessLbFlair(raw) {
  const out = { frame: null, title: null, prefix: '', suffix: '' };
  if (!raw || typeof raw !== 'object') return out;
  const frame = raw.frame != null ? String(raw.frame) : '';
  if (frame && CHESS_LB_FLAIR_FRAMES.has(frame)) out.frame = frame;
  const title = raw.title != null ? String(raw.title).trim() : '';
  if (title.length > 0 && title.length <= 24) {
    out.title = title.replace(/[\u0000-\u001f\u007f]/g, '');
  }
  const prefix = raw.prefix != null ? String(raw.prefix) : '';
  out.prefix = [...prefix].slice(0, 3).join('');
  const suffix = raw.suffix != null ? String(raw.suffix) : '';
  out.suffix = [...suffix].slice(0, 3).join('');
  return out;
}

function mergeChessSeasonFieldsForSync(prevChess, incomingSeasonTrack, incomingBonus) {
  const prevBp = Math.max(0, Math.floor(Number(prevChess?.seasonBonusPoints) || 0));
  const incBp = Math.max(0, Math.floor(Number(incomingBonus) || 0));
  const seasonBonusPoints = Math.max(prevBp, incBp);

  const prevT =
    prevChess && prevChess.seasonTrack && typeof prevChess.seasonTrack === 'object'
      ? prevChess.seasonTrack
      : {};
  const incT = incomingSeasonTrack && typeof incomingSeasonTrack === 'object' ? incomingSeasonTrack : null;
  if (!incT) {
    return {
      seasonBonusPoints,
      seasonTrack: { ...prevT },
    };
  }

  const pSid = String(prevT.seasonId || '');
  const iSid = String(incT.seasonId || '').trim();

  let nodesCompleted = Math.max(0, Math.floor(Number(prevT.nodesCompleted) || 0));
  const incN = Math.max(0, Math.floor(Number(incT.nodesCompleted) || 0));
  if (iSid && pSid && iSid === pSid) {
    nodesCompleted = Math.max(nodesCompleted, incN);
  } else if (iSid) {
    nodesCompleted = Math.min(CHESS_SEASON_MAX_NODES, incN);
  }
  nodesCompleted = Math.min(CHESS_SEASON_MAX_NODES, nodesCompleted);

  const mergedFlair = sanitizeChessLbFlair({ ...(prevT.lbFlair && typeof prevT.lbFlair === 'object' ? prevT.lbFlair : {}), ...(incT.lbFlair && typeof incT.lbFlair === 'object' ? incT.lbFlair : {}) });

  const prevOwnedF =
    prevT.lbFlairUnlocked && typeof prevT.lbFlairUnlocked === 'object' ? prevT.lbFlairUnlocked : {};
  const incOwnedF =
    incT.lbFlairUnlocked && typeof incT.lbFlairUnlocked === 'object' ? incT.lbFlairUnlocked : {};
  const uniq = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x)))];
  const mergedOwned = {
    frames: uniq([...(prevOwnedF.frames || []), ...(incOwnedF.frames || [])]),
    titles: uniq([...(prevOwnedF.titles || []), ...(incOwnedF.titles || [])]),
    prefixes: uniq([...(prevOwnedF.prefixes || []), ...(incOwnedF.prefixes || [])]),
    suffixes: uniq([...(prevOwnedF.suffixes || []), ...(incOwnedF.suffixes || [])]),
  };

  const seasonTrack = {
    ...prevT,
    ...incT,
    seasonId: iSid || pSid || prevT.seasonId,
    nodesCompleted,
    earnBaseline: mergeSeasonEarnBaselineMonotonic(prevT.earnBaseline, incT.earnBaseline),
    lbFlair: mergedFlair,
    lbFlairUnlocked: mergedOwned,
  };

  return { seasonBonusPoints, seasonTrack };
}

/** Shop reward keys `category\\0id` granted by season steps `[0, endExclusive)`. */
function seasonTrackRewardShopKeysThroughStep(endExclusive) {
  const keys = new Set();
  const end = Math.min(CHESS_SEASON_MAX_NODES, Math.max(0, Math.floor(Number(endExclusive) || 0)));
  for (let i = 0; i < end; i++) {
    const node = SEASON_CLAIM_NODES[i];
    if (!node || !Array.isArray(node.rewards)) continue;
    for (const r of node.rewards) {
      if (r && r.kind === 'shop' && r.category && r.id) {
        keys.add(String(r.category) + '\0' + String(r.id));
      }
    }
  }
  return keys;
}

/** Leaderboard flair tokens granted by those same steps (for removal on reset). */
function collectSeasonLbTokensThroughStep(endExclusive) {
  const frames = new Set();
  const titles = new Set();
  const prefixes = new Set();
  const suffixes = new Set();
  const end = Math.min(CHESS_SEASON_MAX_NODES, Math.max(0, Math.floor(Number(endExclusive) || 0)));
  for (let i = 0; i < end; i++) {
    const node = SEASON_CLAIM_NODES[i];
    if (!node || !Array.isArray(node.rewards)) continue;
    for (const r of node.rewards) {
      if (!r || typeof r !== 'object') continue;
      if (r.kind === 'lb_frame' && r.frame && CHESS_LB_FLAIR_FRAMES.has(String(r.frame))) {
        frames.add(String(r.frame));
      } else if (r.kind === 'lb_title' && r.title) {
        const t = String(r.title)
          .trim()
          .slice(0, 24)
          .replace(/[\u0000-\u001f\u007f]/g, '');
        if (t) titles.add(t);
      } else if (r.kind === 'lb_prefix' && r.prefix != null) {
        const p = [...String(r.prefix)].slice(0, 3).join('');
        if (p) prefixes.add(p);
      } else if (r.kind === 'lb_suffix' && r.suffix != null) {
        const s = [...String(r.suffix)].slice(0, 3).join('');
        if (s) suffixes.add(s);
      }
    }
  }
  return { frames, titles, prefixes, suffixes };
}

function ensureChessShopUnlockBasics(shop) {
  const o = shop && typeof shop === 'object' ? { ...shop } : {};
  const defaults = {
    boards: ['classic'],
    pieces: ['classic'],
    highlightColors: ['red'],
    arrowColors: ['red'],
    legalMoveDots: ['gray-circle'],
    themes: ['light'],
    timeControls: ['none'],
    leaderboardRowColors: [],
  };
  for (const [k, fallback] of Object.entries(defaults)) {
    const cur = Array.isArray(o[k]) ? o[k] : [];
    const merged = uniqStrings([...fallback, ...cur]);
    o[k] = merged.length ? merged : [...fallback];
  }
  if (!Array.isArray(o.checkmateEffects)) o.checkmateEffects = [];
  return o;
}

function removeSeasonShopRewardsFromChessShop(rawShop, keySet) {
  const shop = rawShop && typeof rawShop === 'object' ? { ...rawShop } : {};
  const cats = [
    'boards',
    'pieces',
    'highlightColors',
    'arrowColors',
    'legalMoveDots',
    'themes',
    'timeControls',
    'leaderboardRowColors',
  ];
  for (const cat of cats) {
    const arr = Array.isArray(shop[cat]) ? [...shop[cat]] : [];
    shop[cat] = arr.filter((id) => !keySet.has(cat + '\0' + String(id)));
  }
  const cm = Array.isArray(shop.checkmateEffects) ? [...shop.checkmateEffects] : [];
  shop.checkmateEffects = cm.filter((id) => !keySet.has('checkmateEffects\0' + String(id)));
  return ensureChessShopUnlockBasics(shop);
}

function shrinkLbFlairEquipsToOwned(rawFlair, owned) {
  const san = sanitizeChessLbFlair(rawFlair);
  const of = owned && typeof owned === 'object' ? owned : {};
  const frames = new Set(of.frames || []);
  const titles = new Set(of.titles || []);
  const prefixes = new Set(of.prefixes || []);
  const suffixes = new Set(of.suffixes || []);
  let frame = san.frame;
  if (frame && !frames.has(String(frame))) frame = null;
  let title = san.title;
  if (title && !titles.has(String(title))) title = null;
  let prefix = san.prefix;
  if (prefix && !prefixes.has(String(prefix))) prefix = '';
  let suffix = san.suffix;
  if (suffix && !suffixes.has(String(suffix))) suffix = '';
  return sanitizeChessLbFlair({ frame, title, prefix, suffix });
}

/** If equipped cosmetics are no longer unlocked, fall back to safe defaults. */
function sanitizeChessVisualSettingsAfterUnshop(chess) {
  const shop = chess.shopUnlocks && typeof chess.shopUnlocks === 'object' ? chess.shopUnlocks : {};
  if (!chess.settings || typeof chess.settings !== 'object') chess.settings = {};
  const s = chess.settings;
  const has = (cat, id) => (Array.isArray(shop[cat]) ? shop[cat] : []).includes(id);
  if (s.boardStyle && !has('boards', s.boardStyle)) s.boardStyle = 'classic';
  if (s.pieceStyle && !has('pieces', s.pieceStyle)) s.pieceStyle = 'classic';
  if (s.highlightColor && !has('highlightColors', s.highlightColor)) s.highlightColor = 'red';
  if (s.arrowColor && !has('arrowColors', s.arrowColor)) s.arrowColor = 'red';
  if (s.legalMoveDotStyle && !has('legalMoveDots', s.legalMoveDotStyle)) {
    s.legalMoveDotStyle = (shop.legalMoveDots && shop.legalMoveDots[0]) || 'gray-circle';
  }
  if (s.pageTheme && !has('themes', s.pageTheme)) s.pageTheme = 'light';
  const addons = s.checkmateAddons;
  if (Array.isArray(addons)) {
    s.checkmateAddons = addons.filter((x) => has('checkmateEffects', String(x)));
  }
}

function chessStatsSnapshot(chessBlock) {
  const ps = chessBlock?.stats?.playerStats || {};
  const w = Math.max(0, Number(ps.wins) || 0);
  const l = Math.max(0, Number(ps.losses) || 0);
  const dr = Math.max(0, Number(ps.draws) || 0);
  const games = w + l + dr;
  const points = Math.max(0, Number(chessBlock?.points) || 0);
  return { wins: w, losses: l, draws: dr, games, points };
}

/** "Last 7 days" leaderboard: include `gameHistory` entries with `savedAt` within this many ms of request time. */
const LEADERBOARD_RECENT_GAMES_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Ignore client clocks up to this far ahead of the worker when scoring recent achievement unlocks. */
const LEADERBOARD_ACHIEVEMENT_MAX_FUTURE_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

/** Career counters from a chess block only (no game-history aggregation). */
function chessCareerTotalsFromChessBlock(chess) {
  if (!chess || typeof chess !== 'object') {
    return {
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      captures: 0,
      checksGiven: 0,
      promotions: 0,
      castlingMoves: 0,
    };
  }
  const points = Math.max(0, Math.floor(Number(chess.points) || 0));
  const ps = chess.stats?.playerStats || {};
  const wins = Math.max(0, Number(ps.wins) || 0);
  const losses = Math.max(0, Number(ps.losses) || 0);
  const draws = Math.max(0, Number(ps.draws) || 0);
  const ltRaw = chess.stats?.lifetimeStats;
  const lt = ltRaw && typeof ltRaw === 'object' ? ltRaw : {};
  const captures = Math.max(0, Number(lt.totalCaptures) || 0);
  const checksGiven = Math.max(0, Number(lt.checksGiven) || 0);
  const promotions = Math.max(0, Number(lt.promotions) || 0);
  const castlingMoves = Math.max(0, Number(lt.castlingMoves) || 0);
  return { points, wins, losses, draws, captures, checksGiven, promotions, castlingMoves };
}

function gameHistoryRecordTimestampMs(rec) {
  if (!rec || rec.savedAt == null) return NaN;
  const t = Date.parse(String(rec.savedAt));
  return Number.isFinite(t) ? t : NaN;
}

function normalizeSanMoveForLeaderboardStats(raw) {
  return String(raw || '')
    .trim()
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O');
}

/** Normalize PGN-style results for leaderboard aggregation (spacing / unicode dashes). */
function normalizeLeaderboardGameResultKey(raw) {
  return String(raw || '')
    .trim()
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\s+/g, '');
}

/**
 * Dedupe rolling game history the same way as `mergeChessGameHistoryForSync` so the
 * last-7-days window cannot double-count the same finished game.
 */
function leaderboardHistoryRecordDedupeKey(r) {
  if (!r || typeof r !== 'object') return null;
  if (typeof r.id === 'string' && r.id.trim()) return r.id.trim();
  const sa = r.savedAt != null ? String(r.savedAt) : '';
  const h0 =
    Array.isArray(r.historySan) && r.historySan.length ? String(r.historySan[0]) : '';
  if (sa) {
    return `legacy:${sa}:${h0}:${normalizeLeaderboardGameResultKey(r.result)}:${String(r.playerColor || '')}`;
  }
  return null;
}

/**
 * Sum achievement points unlocked in the recent window using `chess.achievements[id]`
 * shaped as `{ at: epochMs, pts: number }`. Legacy `true` / missing times are skipped for points.
 */
function sumRecentAchievementPointsFromChess(chessBlock, windowMs, serverNow = Date.now()) {
  const cutoff = serverNow - windowMs;
  const raw = chessBlock?.achievements;
  let sum = 0;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 0;
  for (const id of Object.keys(raw)) {
    const v = raw[id];
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    let at = Number(v.at);
    if (!Number.isFinite(at) && v.at != null) at = Date.parse(String(v.at));
    const pts = Number(v.pts);
    if (!Number.isFinite(at) || !Number.isFinite(pts)) continue;
    if (at < cutoff || at > serverNow + LEADERBOARD_ACHIEVEMENT_MAX_FUTURE_SKEW_MS) continue;
    sum += Math.max(0, Math.floor(pts));
  }
  return sum;
}

/**
 * Recent-window stats from synced `gameHistory` (games in window) plus achievement points
 * from `chess.achievements` unlock timestamps in the same window.
 */
function aggregateLeaderboardStatsFromRecentGames(chessBlock, windowMs, serverNow = Date.now()) {
  const cutoff = serverNow - windowMs;
  const futureCutoff = serverNow + LEADERBOARD_ACHIEVEMENT_MAX_FUTURE_SKEW_MS;
  const hist = Array.isArray(chessBlock?.gameHistory) ? chessBlock.gameHistory : [];
  let weekPoints = sumRecentAchievementPointsFromChess(chessBlock, windowMs, serverNow);
  let weekWins = 0;
  let weekLosses = 0;
  let weekDraws = 0;
  let weekCaptures = 0;
  let weekChecksGiven = 0;
  let weekPromotions = 0;
  let weekCastlingMoves = 0;

  const byKey = new Map();
  for (let hi = 0; hi < hist.length; hi++) {
    const rec = hist[hi];
    if (!rec || typeof rec !== 'object') continue;
    const ts = gameHistoryRecordTimestampMs(rec);
    if (!Number.isFinite(ts) || ts < cutoff || ts > futureCutoff) continue;
    const k = leaderboardHistoryRecordDedupeKey(rec);
    if (k) byKey.set(k, rec);
    else byKey.set(`noid:${hi}:${ts}`, rec);
  }

  for (const rec of byKey.values()) {
    const rk = normalizeLeaderboardGameResultKey(rec.result);
    const pcRaw = rec.playerColor != null ? String(rec.playerColor) : 'white';
    const pc = pcRaw.trim().toLowerCase();
    const isWhite = pc !== 'black' && pc !== 'b';
    if (rk === '1/2-1/2') weekDraws++;
    else if (rk === '1-0') {
      if (isWhite) weekWins++;
      else weekLosses++;
    } else if (rk === '0-1') {
      if (isWhite) weekLosses++;
      else weekWins++;
    } else continue;

    const sanList = Array.isArray(rec.historySan) ? rec.historySan : [];
    for (let i = 0; i < sanList.length; i++) {
      const isPlayerMove = isWhite ? i % 2 === 0 : i % 2 === 1;
      if (!isPlayerMove) continue;
      const raw = String(sanList[i] || '').trim();
      if (!raw) continue;
      const san = normalizeSanMoveForLeaderboardStats(raw);
      if (san.includes('x')) weekCaptures++;
      if (san.includes('=')) weekPromotions++;
      if (san === 'O-O' || san === 'O-O-O') weekCastlingMoves++;
      if (/\+$/.test(san) || /#$/.test(san)) weekChecksGiven++;
    }
  }

  const career = chessCareerTotalsFromChessBlock(chessBlock);
  weekWins = Math.min(weekWins, career.wins);
  weekLosses = Math.min(weekLosses, career.losses);
  weekDraws = Math.min(weekDraws, career.draws);

  const weekGames = weekWins + weekLosses + weekDraws;
  const weekDecisive = weekWins + weekLosses;
  const weekWinPct = weekDecisive > 0 ? (100 * weekWins) / weekDecisive : 0;

  return {
    weekPoints,
    weekWins,
    weekLosses,
    weekDraws,
    weekGames,
    weekWinPct,
    weekCaptures,
    weekChecksGiven,
    weekPromotions,
    weekCastlingMoves,
  };
}

/** Single KV document: `{ e: { [userId]: { u, p, t } }, updatedAt }` */
const CHESS_LEADERBOARD_KV_MAP_KEY = 'chess_career_points_lb_v1';

function sanitizeLeaderboardUsernameDisplay(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (!s) s = 'Player';
  s = s.replace(/[\u0000-\u001f\u007f]/g, '');
  if (s.length > 48) s = s.slice(0, 48);
  return s;
}

/** Strict `#rrggbb` (or `#rgb`) for leaderboard row backgrounds only (no `url()` / expressions). */
function sanitizeLeaderboardRowColorHex(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  let m = /^#([0-9a-fA-F]{6})$/.exec(s);
  if (m) return `#${m[1].toLowerCase()}`;
  m = /^#([0-9a-fA-F]{3})$/.exec(s);
  if (!m) return null;
  const a = m[1];
  return `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`.toLowerCase();
}

/** Keep in sync with `js/chess_lb_row.js` (basic swatches + preset ids / minNodes). */
const LB_ROW_BASIC_HEXES = new Set([
  '#ffffff',
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#dbeafe',
  '#fef3c7',
  '#dcfce7',
  '#94a3b8',
]);

/** Season leaderboard row finishes: `lbrow:<id>` stored on account; min monthly nodes (current UTC season). */
const LB_ROW_PRESET_MIN_NODES = Object.freeze({
  emerald_glade: 4,
  glacier_ribbon: 4,
  violet_canopy: 7,
  moonlit_band: 7,
  finale_aurora: 10,
});

/** Purchasable solid row tints (keep in sync with `js/chess_lb_row.js`). */
const LB_ROW_SHOP_CUSTOM_HEX_ID = 'lb_row_shop_custom_hex';
const LB_ROW_SHOP_SOLIDS = Object.freeze([
  { id: 'lb_row_shop_rose', hex: '#fb7185' },
  { id: 'lb_row_shop_coral_fire', hex: '#f97316' },
  { id: 'lb_row_shop_goldenrod', hex: '#ca8a04' },
  { id: 'lb_row_shop_forest_deep', hex: '#166534' },
  { id: 'lb_row_shop_teal_river', hex: '#0d9488' },
  { id: 'lb_row_shop_sapphire', hex: '#1d4ed8' },
  { id: 'lb_row_shop_amethyst', hex: '#7c3aed' },
  { id: 'lb_row_shop_magenta_pop', hex: '#c026d3' },
]);

const LB_ROW_SHOP_ID_TO_HEX = Object.freeze(
  Object.fromEntries(LB_ROW_SHOP_SOLIDS.map((r) => [r.id, r.hex]))
);

function leaderboardRowShopIdsFromChess(chess) {
  const shop = chess?.shopUnlocks && typeof chess.shopUnlocks === 'object' ? chess.shopUnlocks : {};
  const arr = shop.leaderboardRowColors;
  if (!Array.isArray(arr)) return [];
  return uniqStrings(arr.map((x) => String(x)));
}

function leaderboardRowHexAllowedForUser(hex, chess) {
  if (!hex) return false;
  if (LB_ROW_BASIC_HEXES.has(hex)) return true;
  const ids = leaderboardRowShopIdsFromChess(chess);
  if (ids.includes(LB_ROW_SHOP_CUSTOM_HEX_ID)) return true;
  for (let i = 0; i < ids.length; i++) {
    const mapped = LB_ROW_SHOP_ID_TO_HEX[ids[i]];
    if (mapped === hex) return true;
  }
  return false;
}

function leaderboardRowSeasonNodesAligned(chess) {
  const st = chess?.seasonTrack && typeof chess.seasonTrack === 'object' ? chess.seasonTrack : {};
  const sid = String(st.seasonId || '').trim();
  if (!/^\d{4}-\d{2}$/.test(sid) || sid !== utcChessSeasonIdNow()) return 0;
  return seasonTrackNodesCompletedFromChess(chess);
}

function parseLeaderboardRowStoredToken(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (low.startsWith('lbrow:')) {
    const id = low.slice(6);
    if (!/^[a-z0-9_]+$/.test(id)) return null;
    if (!Object.prototype.hasOwnProperty.call(LB_ROW_PRESET_MIN_NODES, id)) return null;
    return { kind: 'preset', id };
  }
  const hex = sanitizeLeaderboardRowColorHex(s);
  if (!hex) return null;
  return { kind: 'hex', hex };
}

/** Returns normalized stored value (`#rrggbb` or `lbrow:<id>`) or null if not allowed / invalid. */
function sanitizeLeaderboardRowAppearance(raw, chess) {
  const p = parseLeaderboardRowStoredToken(raw);
  if (!p) return null;
  const n = leaderboardRowSeasonNodesAligned(chess);
  if (p.kind === 'hex') {
    if (!leaderboardRowHexAllowedForUser(p.hex, chess)) return null;
    return p.hex;
  }
  const need = LB_ROW_PRESET_MIN_NODES[p.id];
  if (n < need) return null;
  return `lbrow:${p.id}`;
}

async function readChessLeaderboardMap(kv) {
  if (!kv) return {};
  try {
    const raw = await kv.get(CHESS_LEADERBOARD_KV_MAP_KEY, 'json');
    if (!raw || typeof raw !== 'object') return {};
    const inner = raw.e;
    if (inner && typeof inner === 'object') return { ...inner };
    return {};
  } catch {
    return {};
  }
}

async function writeChessLeaderboardMap(kv, mapObj) {
  if (!kv) return;
  await kv.put(
    CHESS_LEADERBOARD_KV_MAP_KEY,
    JSON.stringify({ e: mapObj, updatedAt: Date.now() })
  );
}

async function upsertChessLeaderboardEntry(kv, userId, username, points) {
  if (!kv || !userId) return;
  const p = Math.max(0, Math.floor(Number(points) || 0));
  const u = sanitizeLeaderboardUsernameDisplay(username);
  const map = await readChessLeaderboardMap(kv);
  map[userId] = { u, p, t: Date.now() };
  await writeChessLeaderboardMap(kv, map);
}

async function removeChessLeaderboardUser(kv, userId) {
  if (!kv || !userId) return;
  const map = await readChessLeaderboardMap(kv);
  if (!map[userId]) return;
  delete map[userId];
  await writeChessLeaderboardMap(kv, map);
}

/** @typedef {{ username: string, points: number, wins: number, losses: number, draws: number, games: number, winPct: number, captures: number, checksGiven: number, promotions: number, castlingMoves: number }} LeaderboardStatsRow */

function extractChessLeaderboardStatsFromProfile(row) {
  if (!row || typeof row !== 'object') return null;
  const chess = row.games?.chess;
  const careerPts = Math.max(0, Math.floor(Number(chess?.points) || 0));
  const seasonBonus = Math.max(0, Math.floor(Number(chess?.seasonBonusPoints) || 0));
  const points = careerPts + seasonBonus;
  const ps = chess?.stats?.playerStats || {};
  const wins = Math.max(0, Number(ps.wins) || 0);
  const losses = Math.max(0, Number(ps.losses) || 0);
  const draws = Math.max(0, Number(ps.draws) || 0);
  const games = wins + losses + draws;
  const ltRaw = chess?.stats?.lifetimeStats;
  const lt = ltRaw && typeof ltRaw === 'object' ? ltRaw : {};
  const captures = Math.max(0, Number(lt.totalCaptures) || 0);
  const checksGiven = Math.max(0, Number(lt.checksGiven) || 0);
  const promotions = Math.max(0, Number(lt.promotions) || 0);
  const castlingMoves = Math.max(0, Number(lt.castlingMoves) || 0);
  const decisive = wins + losses;
  const winPct = decisive > 0 ? (100 * wins) / decisive : 0;
  const username = sanitizeLeaderboardUsernameDisplay(row.username);
  const rowColor = sanitizeLeaderboardRowAppearance(row.leaderboardRowColor, chess);
  const lbFlair = sanitizeChessLbFlair(chess?.seasonTrack?.lbFlair);

  const recent = aggregateLeaderboardStatsFromRecentGames(
    chess,
    LEADERBOARD_RECENT_GAMES_WINDOW_MS,
    Date.now()
  );
  const {
    weekPoints,
    weekWins,
    weekLosses,
    weekDraws,
    weekGames,
    weekWinPct,
    weekCaptures,
    weekChecksGiven,
    weekPromotions,
    weekCastlingMoves,
  } = recent;

  return {
    username,
    rowColor,
    points,
    wins,
    losses,
    draws,
    games,
    winPct,
    captures,
    checksGiven,
    promotions,
    castlingMoves,
    weekPoints,
    weekWins,
    weekLosses,
    weekDraws,
    weekGames,
    weekWinPct,
    weekCaptures,
    weekChecksGiven,
    weekPromotions,
    weekCastlingMoves,
    lbFlair,
  };
}

function leaderboardSortGetter(sortKey, mode = 'career') {
  const wk = mode === 'week';
  const getters = {
    points: (r) => (wk ? r.weekPoints : r.points),
    wins: (r) => (wk ? r.weekWins : r.wins),
    losses: (r) => (wk ? r.weekLosses : r.losses),
    draws: (r) => (wk ? r.weekDraws : r.draws),
    games: (r) => (wk ? r.weekGames : r.games),
    winPct: (r) => (wk ? r.weekWinPct : r.winPct),
    captures: (r) => (wk ? r.weekCaptures : r.captures),
    checks: (r) => (wk ? r.weekChecksGiven : r.checksGiven),
    promotions: (r) => (wk ? r.weekPromotions : r.promotions),
    castles: (r) => (wk ? r.weekCastlingMoves : r.castlingMoves),
  };
  return getters[sortKey] || getters.points;
}

function normalizeLeaderboardSortKey(raw) {
  const s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  if (s === 'winpct' || s === 'win_pct') return 'winPct';
  const allowed = new Set([
    'points',
    'wins',
    'losses',
    'draws',
    'games',
    'captures',
    'checks',
    'promotions',
    'castles',
  ]);
  if (!allowed.has(s)) return 'points';
  return s;
}

function sortLeaderboardStatsRows(rows, sortKey, mode = 'career') {
  const key = normalizeLeaderboardSortKey(sortKey);
  const get = leaderboardSortGetter(key, mode);
  rows.sort((a, b) => {
    const va = Number(get(a));
    const vb = Number(get(b));
    const na = Number.isFinite(va) ? va : 0;
    const nb = Number.isFinite(vb) ? vb : 0;
    if (nb !== na) return nb > na ? 1 : -1;
    return a.username.localeCompare(b.username);
  });
}

function leaderboardPublicRow(r, index1, mode = 'career') {
  const wk = mode === 'week';
  return {
    rank: index1,
    username: r.username,
    rowColor: r.rowColor || null,
    lbFlair: r.lbFlair && typeof r.lbFlair === 'object' ? r.lbFlair : { frame: null, title: null, prefix: '', suffix: '' },
    points: wk ? r.weekPoints : r.points,
    wins: wk ? r.weekWins : r.wins,
    losses: wk ? r.weekLosses : r.losses,
    draws: wk ? r.weekDraws : r.draws,
    games: wk ? r.weekGames : r.games,
    winPct: Math.round((wk ? r.weekWinPct : r.winPct) * 100) / 100,
    captures: wk ? r.weekCaptures : r.captures,
    checksGiven: wk ? r.weekChecksGiven : r.checksGiven,
    promotions: wk ? r.weekPromotions : r.promotions,
    castlingMoves: wk ? r.weekCastlingMoves : r.castlingMoves,
  };
}

function buildChessLeaderboardPublicPayload(map, limit, sortKey) {
  const sk = normalizeLeaderboardSortKey(sortKey);
  const allRows = Object.entries(map || {}).map(([, v]) => ({
    username: sanitizeLeaderboardUsernameDisplay(typeof v?.u === 'string' ? v.u : ''),
    points: Math.max(0, Math.floor(Number(v?.p) || 0)),
    wins: 0,
    losses: 0,
    draws: 0,
    games: 0,
    winPct: 0,
    captures: 0,
    checksGiven: 0,
    promotions: 0,
    castlingMoves: 0,
  }));
  sortLeaderboardStatsRows(allRows, sk, 'career');
  const top = allRows.slice(0, limit);
  return {
    totalRanked: allRows.length,
    showing: top.length,
    rows: top.map((r, i) => leaderboardPublicRow(r, i + 1, 'career')),
    sort: sk,
    window: 'career',
  };
}

/** Subrequest safety: profile fetches per leaderboard request (each account = one DO fetch). */
const LEADERBOARD_MAX_PROFILE_FETCHES = 500;
/** Pages of `listUserAccountStubsAdminUnified` when walking every account stub. */
const LEADERBOARD_ENUM_MAX_PAGES = 250;

function userAccountStubIdString(stubOrEntry) {
  const stub =
    stubOrEntry && typeof stubOrEntry === 'object' && stubOrEntry.stub ? stubOrEntry.stub : stubOrEntry;
  try {
    if (stub && stub.id != null && typeof stub.id.toString === 'function') return String(stub.id.toString());
  } catch {
    /* ignore */
  }
  return '';
}

function unwrapUserAccountStub(stubOrEntry) {
  if (stubOrEntry && typeof stubOrEntry === 'object' && stubOrEntry.stub) return stubOrEntry.stub;
  return stubOrEntry;
}

async function enumerateAllUserAccountStubsForLeaderboard(env) {
  const stubs = [];
  const seen = new Set();
  let cursor;
  let pages = 0;
  let stoppedEarly = false;
  while (pages < LEADERBOARD_ENUM_MAX_PAGES) {
    pages++;
    const { stubs: pageStubs, nextListCursor, listError } = await listUserAccountStubsAdminUnified(env, 80, cursor);
    if (listError) throw listError;
    for (const entry of pageStubs) {
      const idStr = userAccountStubIdString(entry);
      if (!idStr || seen.has(idStr)) continue;
      seen.add(idStr);
      stubs.push(entry);
    }
    if (!nextListCursor) break;
    cursor = nextListCursor;
  }
  if (pages >= LEADERBOARD_ENUM_MAX_PAGES && cursor) stoppedEarly = true;
  return { stubs, stoppedEarly };
}

async function fetchChessLeaderboardRowFromStub(stubOrEntry) {
  const stub = unwrapUserAccountStub(stubOrEntry);
  try {
    const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
    const row = await dataRes.json();
    return extractChessLeaderboardStatsFromProfile(row);
  } catch {
    return null;
  }
}

/**
 * Public leaderboard: one row per account (live chess career points from each UserAccount DO).
 * Same stub discovery as admin account directory. Caps profile fetches to stay within Worker limits.
 */
async function buildChessLeaderboardFromAllAccounts(env, limit, sortKey, mode = 'career') {
  const modeNorm = mode === 'week' ? 'week' : 'career';
  const { stubs: allStubs, stoppedEarly: enumStopped } = await enumerateAllUserAccountStubsForLeaderboard(env);
  const totalAccountsDiscovered = allStubs.length;
  let stubs = allStubs;
  let profileFetchCapHit = false;
  if (stubs.length > LEADERBOARD_MAX_PROFILE_FETCHES) {
    stubs = [...stubs]
      .sort((a, b) => userAccountStubIdString(a).localeCompare(userAccountStubIdString(b)))
      .slice(0, LEADERBOARD_MAX_PROFILE_FETCHES);
    profileFetchCapHit = true;
  }
  let rows = [];
  const batch = 10;
  for (let i = 0; i < stubs.length; i += batch) {
    const slice = stubs.slice(i, i + batch);
    const chunk = await Promise.all(slice.map((s) => fetchChessLeaderboardRowFromStub(s)));
    for (const r of chunk) {
      if (r) rows.push(r);
    }
  }
  sortLeaderboardStatsRows(rows, sortKey, modeNorm);
  const top = rows.slice(0, limit);
  const out = {
    totalRanked: rows.length,
    showing: top.length,
    rows: top.map((r, i) => leaderboardPublicRow(r, i + 1, modeNorm)),
    sort: normalizeLeaderboardSortKey(sortKey),
    source: 'accounts',
    window: modeNorm === 'week' ? 'week' : 'career',
  };
  if (enumStopped) out.partialEnumeration = true;
  if (profileFetchCapHit) {
    out.profileFetchCap = LEADERBOARD_MAX_PROFILE_FETCHES;
    out.totalAccountsDiscovered = totalAccountsDiscovered;
  }
  return out;
}

async function handleChessLeaderboardGet(request, env, corsHeaders) {
  const url = new URL(request.url);
  const rawLimit = parseInt(url.searchParams.get('limit') || '20000', 10);
  const limit = Math.min(50000, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20000));
  const sortKey = normalizeLeaderboardSortKey(url.searchParams.get('sort'));
  const windowRaw = String(url.searchParams.get('window') || 'career')
    .trim()
    .toLowerCase();
  const isWeek =
    windowRaw === 'week' ||
    windowRaw === 'weekly' ||
    windowRaw === '7d' ||
    windowRaw === 'rolling';

  const jsonHeaders = {
    ...corsHeaders,
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=30',
  };

  if (env.USER_ACCOUNT) {
    try {
      const body = await buildChessLeaderboardFromAllAccounts(env, limit, sortKey, isWeek ? 'week' : 'career');
      return new Response(JSON.stringify({ ...body, configured: true }), {
        headers: jsonHeaders,
      });
    } catch (e) {
      console.error('leaderboard account scan failed', e?.message || e);
    }
  }

  if (!env.CHESS_LEADERBOARD_KV) {
    return new Response(
      JSON.stringify({
        totalRanked: 0,
        showing: 0,
        rows: [],
        sort: sortKey,
        configured: false,
        window: isWeek ? 'week' : 'career',
      }),
      {
        headers: jsonHeaders,
      }
    );
  }
  if (isWeek) {
    return new Response(
      JSON.stringify({
        configured: true,
        source: 'kv',
        window: 'week',
        weeklyUnavailable: true,
        totalRanked: 0,
        showing: 0,
        rows: [],
        sort: sortKey,
        message:
          'Recent gains need live account data (this host is in points-only backup mode). Use the full deployment with account access, or sync chess after upgrading so baselines can be stored.',
      }),
      {
        headers: jsonHeaders,
      }
    );
  }
  const map = await readChessLeaderboardMap(env.CHESS_LEADERBOARD_KV);
  const body = buildChessLeaderboardPublicPayload(map, limit, sortKey);
  return new Response(JSON.stringify({ ...body, configured: true, source: 'kv', kvOnlyStats: true }), {
    headers: jsonHeaders,
  });
}

async function persistAndSendChessMilestones(env, storage, userData, prevSnap, nextSnap) {
  const email = normalizeEmail(userData.email || '');
  if (!email || !isLikelyRealEmail(email)) return;
  if (userData.emailVerified === false) return;

  if (!userData.milestonesEmailNotified || typeof userData.milestonesEmailNotified !== 'object') {
    userData.milestonesEmailNotified = {};
  }
  const notified = userData.milestonesEmailNotified;
  const base = siteMarketingBase(env);
  const chessUrl = `${base}/chess_engine.html`;

  const tryOne = async (key, subject, html, text) => {
    if (notified[key]) return;
    try {
      await dispatchTransactionalEmail(env, { to: email, subject, html, text });
      notified[key] = Date.now();
      await storage.put('userData', userData);
    } catch (err) {
      const w = summarizeEmailSendError(err);
      console.error('Chess milestone email failed', key, w.code, w.message);
    }
  };

  for (const t of CHESS_MILESTONE_WIN_THRESHOLDS) {
    if (prevSnap.wins < t && nextSnap.wins >= t) {
      const key = `chess_wins_${t}`;
      const emailParts = buildChessMilestoneEmail({
        username: userData.username,
        kind: 'wins',
        threshold: t,
        stats: nextSnap,
        chessUrl,
      });
      await tryOne(key, emailParts.subject, emailParts.html, emailParts.text);
    }
  }

  for (const t of CHESS_MILESTONE_GAME_THRESHOLDS) {
    if (prevSnap.games < t && nextSnap.games >= t) {
      const key = `chess_games_${t}`;
      const emailParts = buildChessMilestoneEmail({
        username: userData.username,
        kind: 'games',
        threshold: t,
        stats: nextSnap,
        chessUrl,
      });
      await tryOne(key, emailParts.subject, emailParts.html, emailParts.text);
    }
  }

  /** Avoid many point-milestone emails when stored points were 0 but achievements already reflected a high total (one-time sync repair). */
  const suppressPointMilestoneBurst =
    prevSnap.points === 0 && nextSnap.points >= 1000;
  let pointMilestoneNotifiedDirty = false;
  for (const t of CHESS_MILESTONE_POINT_THRESHOLDS) {
    if (prevSnap.points < t && nextSnap.points >= t) {
      const key = `chess_points_${t}`;
      if (notified[key]) continue;
      if (suppressPointMilestoneBurst) {
        notified[key] = Date.now();
        pointMilestoneNotifiedDirty = true;
      } else {
        const emailParts = buildChessMilestoneEmail({
          username: userData.username,
          kind: 'points',
          threshold: t,
          stats: nextSnap,
          chessUrl,
        });
        await tryOne(key, emailParts.subject, emailParts.html, emailParts.text);
      }
    }
  }
  if (pointMilestoneNotifiedDirty) {
    await storage.put('userData', userData);
  }
}

/**
 * @param {object} [sendOptions] Optional From overrides (e.g. admin welcome preview uses broadcast sender).
 * @param {string} [sendOptions.fromAddr]
 * @param {string} [sendOptions.fromName]
 */
async function sendWelcomeGuideEmail(env, email, username, sendOptions = {}) {
  const safeName = String(username).replace(/[<>]/g, '');
  const safeNameHtml = escapeHtmlEmail(safeName);
  const base = siteMarketingBase(env);
  const subject = 'Welcome to Ahrens Labs — your hub for TrifangX, labs & more';
  const preheader =
    'Dice dungeons, chess with daily quests, sports headlines for your teams, a cloud-synced planner, language lessons, and more — one free account, every device.';
  const chessUrl = `${base}/chess_engine.html`;
  const dashUrl = `${base}/account-dashboard.html`;
  const labsUrl = `${base}/labs.html`;
  const classifyUrl = `${base}/classify.html`;
  const dungeonUrl = `${base}/dungeon_game.html`;
  const kyrachyngUrl = `${base}/kyrachyng-lessons.html`;
  const sportsDigestUrl = `${base}/sports-digest.html`;
  const codingLabUrl = `${base}/coding-lab.html`;
  const homeUrl = `${base}/`;
  const emailInnerMax = '720px';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#0c4a6e 0%,#1e1b4b 40%,#312e81 100%);">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:transparent;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:${emailInnerMax};width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 20px 55px rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.12);">
          <tr>
            <td style="background:linear-gradient(125deg,#0ea5e9 0%,#6366f1 40%,#a855f7 85%);padding:30px 32px;text-align:center;">
              <p style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:0.02em;text-shadow:0 2px 12px rgba(0,0,0,0.2);">Ahrens Labs</p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#e0e7ff;line-height:1.5;">Games, tools & learning — one sign-in everywhere</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#0f172a;">Hi ${safeNameHtml},</p>
              <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#334155;">Thanks for joining <strong style="color:#0f172a;">Ahrens Labs</strong>. Your free account stores progress in the cloud so you can pick up where you left off on any device.</p>
              <p style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#334155;">Below is a quick tour of what you can play, build, and learn — all tied to the same login. Jump in anywhere; your saves and settings follow you.</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" style="padding:0 0 8px 0;">
                    <a href="${chessUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">Play TrifangX (chess engine)</a>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:4px 0 0 0;">
                    <a href="${dashUrl}" style="color:#2563eb;font-size:14px;font-weight:600;text-decoration:none;">Account dashboard →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 12px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">What your account unlocks</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#0f172a;">TrifangX chess</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#475569;">Our flagship chess experience: spar with a strong engine, unlock <strong>hundreds of achievements</strong>, spend points in a <strong>cosmetic shop</strong> (boards, pieces, themes, effects), and complete <strong>three daily challenges</strong> that refresh each day on your device. From your <a href="${dashUrl}" style="color:#2563eb;font-weight:600;">account dashboard</a> you can opt into a <strong>daily roundup email</strong> or request today’s list anytime.</p>
                    <p style="margin:10px 0 0 0;font-size:14px;"><a href="${chessUrl}" style="color:#2563eb;font-weight:600;">Open the chess lobby</a></p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 6px 0;font-size:15px;font-weight:700;color:#0f172a;">Sports Digest</p>
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#475569;">Optional email updates for the teams you follow across <strong>MLB, NFL, NBA, NHL, Premier League, Big Ten, and SEC</strong>. Pick up to 25 teams, choose how often you hear from us (daily, weekly, or custom times in <strong>Central Time</strong>), and get schedules plus headlines in one message. Turn it on from <a href="${sportsDigestUrl}" style="color:#2563eb;font-weight:600;">Sports Digest</a> (linked from the <a href="${codingLabUrl}" style="color:#2563eb;font-weight:600;">Coding Lab</a>) once your email is confirmed.</p>
                    <p style="margin:10px 0 0 0;font-size:14px;"><a href="${sportsDigestUrl}" style="color:#2563eb;font-weight:600;">Set up Sports Digest →</a></p>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:0 0 14px 0;">
                    <div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;box-sizing:border-box;background:#fafafa;">
                      <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a;">Dungeon</p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">A <strong>dice-driven dungeon crawl</strong> in the browser: each step can surface combat, treasure, shops, or story beats. Fights use directional attacks, defensive stances, consumables, and risk/reward retreat rolls—so every encounter feels tactical, not automatic. Collect gear, chase achievements, and use <strong>multiple cloud save slots</strong> so a great run survives a new device or browser tab.</p>
                      <p style="margin:12px 0 0 0;font-size:14px;"><a href="${dungeonUrl}" style="color:#2563eb;font-weight:600;">Open dungeon game →</a></p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px 0;">
                    <div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;box-sizing:border-box;background:#fafafa;">
                      <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a;">Classify</p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">An <strong>advanced class planner</strong> for real academic terms: map courses, weekly blocks, deadlines, and rhythm in one calm workspace instead of scattered notes. Dark/light styling, structured layouts, and export-minded workflows help you see the whole semester at a glance. With your Ahrens Labs login, your planner <strong>syncs to the cloud</strong>—reopen it on laptop or phone without retyping your schedule.</p>
                      <p style="margin:12px 0 0 0;font-size:14px;"><a href="${classifyUrl}" style="color:#2563eb;font-weight:600;">Open Classify →</a></p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 14px 0;">
                    <div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;box-sizing:border-box;background:#fafafa;">
                      <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a;">Kyrachyng</p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">A <strong>constructed language you can actually learn</strong>: lessons introduce the writing system, sounds, grammar, and vocabulary in a deliberate sequence—more like a mini language course than a wiki. Mark a lesson complete to <strong>light the path and unlock the next stop</strong>; your place is saved on your account so short study sessions still add up. Great if you love linguistics, worldbuilding, or learning something off the beaten path.</p>
                      <p style="margin:12px 0 0 0;font-size:14px;"><a href="${kyrachyngUrl}" style="color:#2563eb;font-weight:600;">Start Kyrachyng lessons →</a></p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 0 0 0;">
                    <div style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;box-sizing:border-box;background:#fafafa;">
                      <p style="margin:0 0 8px 0;font-size:15px;font-weight:700;color:#0f172a;">Labs hub</p>
                      <p style="margin:0;font-size:14px;line-height:1.6;color:#475569;">Our <strong>project gallery</strong> for experiments that don’t fit a single box: language games, music and ear-training toys, coding playgrounds, writing tools, STEM demos, and odd prototypes. Some labs plug into your account for saves; others are one-click “try it now” experiences. Use it as a discovery page when you want something fresh after chess or the dungeon.</p>
                      <p style="margin:12px 0 0 0;font-size:14px;"><a href="${labsUrl}" style="color:#2563eb;font-weight:600;">Browse labs →</a></p>
                    </div>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 10px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">More detail — TrifangX</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Chess engine &amp; account tie-in</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Progress &amp; cloud save</strong> — wins, losses, draws, and summaries stay on your profile. <strong>Lifetime stats</strong> track captures, openings, streaks, and long-term goals across many games.</li>
                      <li style="margin:0 0 8px 0;"><strong>Achievements &amp; points</strong> — a large catalog spanning tactics, speed, material, blindfold milestones, time controls, and unusual feats. Points feed <strong>Total Points</strong> and unlock rarer goals.</li>
                      <li style="margin:0 0 8px 0;"><strong>Shop &amp; cosmetics</strong> — spend earned points on boards, piece sets, highlights, arrows, themes, move and checkmate flair, and time controls. Purchases stay on your profile across devices.</li>
                      <li style="margin:0 0 8px 0;"><strong>Daily challenges &amp; roundup</strong> — three rotating achievements refresh each day in TrifangX. In your <a href="${dashUrl}" style="color:#2563eb;font-weight:600;">dashboard</a>, turn on the <strong>daily challenge roundup email</strong> (sent once per day) or use <strong>email today’s challenges now</strong> anytime.</li>
                      <li style="margin:0 0 8px 0;"><strong>Sports Digest</strong> — separate optional mail for your favorite teams’ schedules and headlines; configure teams and send times on the <a href="${sportsDigestUrl}" style="color:#2563eb;font-weight:600;">Sports Digest</a> page.</li>
                      <li style="margin:0 0 8px 0;"><strong>Board tools</strong> — legal-move hints, arrows and highlights, premoves, and blindfold or mental-board modes for training or variety.</li>
                      <li style="margin:0 0 8px 0;"><strong>Game history &amp; replay</strong> — reopen recent games from the cloud on the board and step through move-by-move.</li>
                      <li style="margin:0;"><strong>Modes</strong> — casual engine sparring, clocked games with increments, and optional live-engine play from the lobby when you enable it.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 10px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">More about each experience</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Dungeon</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Exploration</strong> — rooms can bring combat, loot, merchants, or hazards; dice keep outcomes tense but readable.</li>
                      <li style="margin:0 0 8px 0;"><strong>Combat</strong> — attack lanes, defense, items, and retreat when health is low; gear matters.</li>
                      <li style="margin:0 0 8px 0;"><strong>Progression</strong> — achievements and stats reward repeat play; <strong>multiple save slots</strong> for different runs.</li>
                      <li style="margin:0;"><strong>Cloud saves</strong> — slot data stays on your profile when you switch device or browser.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Classify planner</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Semester view</strong> — courses, weekly blocks, and recurring commitments in one place.</li>
                      <li style="margin:0 0 8px 0;"><strong>Built for real terms</strong> — midterms, projects, and shifting schedules—not only a generic grid.</li>
                      <li style="margin:0 0 8px 0;"><strong>Cloud backup</strong> — signed-in users sync to the server and recover after a reinstall.</li>
                      <li style="margin:0;"><strong>Same account</strong> — academics in Classify, breaks in TrifangX or the dungeon without extra logins.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Kyrachyng</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Structured path</strong> — lessons build on each other with clear unlocks.</li>
                      <li style="margin:0 0 8px 0;"><strong>Reading &amp; writing</strong> — practice recognition and production, not only passive reading.</li>
                      <li style="margin:0 0 8px 0;"><strong>Saved progress</strong> — resume on any device.</li>
                      <li style="margin:0;"><strong>For curious learners</strong> — conlangs, puzzles, or short daily study alongside games.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Sports Digest</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Your teams</strong> — MLB, NFL, NBA, NHL, Premier League, Big Ten, and SEC; search or browse by league.</li>
                      <li style="margin:0 0 8px 0;"><strong>Your schedule</strong> — daily, weekly, or custom delivery on 15-minute marks in Central Time.</li>
                      <li style="margin:0 0 8px 0;"><strong>What you get</strong> — upcoming games and headlines for the teams you picked, in one email.</li>
                      <li style="margin:0;"><strong>Opt-in only</strong> — off by default; enable anytime after email confirmation at <a href="${sportsDigestUrl}" style="color:#2563eb;font-weight:600;">Sports Digest</a>.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Labs hub</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Browse by card</strong> — clear entry points for each public experiment.</li>
                      <li style="margin:0 0 8px 0;"><strong>Quick or deep</strong> — five-minute toys and tools you can revisit for weeks.</li>
                      <li style="margin:0 0 8px 0;"><strong>Varied topics</strong> — language, audio, code, STEM demos, writing, humor.</li>
                      <li style="margin:0;"><strong>Account when useful</strong> — persistence uses the same login where a lab needs it.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Account dashboard</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Profile &amp; sign-in</strong> — change <strong>password</strong> or <strong>username</strong> (username changes need your current password).</li>
                      <li style="margin:0 0 8px 0;"><strong>Email</strong> — toggle the <strong>daily challenge roundup</strong>, set up <strong><a href="${sportsDigestUrl}" style="color:#2563eb;font-weight:600;">Sports Digest</a></strong> for your teams, <strong>resend this welcome guide</strong>, or <strong>email today’s challenges now</strong>.</li>
                      <li style="margin:0 0 8px 0;"><strong>TrifangX shortcuts</strong> — open <strong>shop, settings, or achievements</strong> straight from the dashboard.</li>
                      <li style="margin:0;"><strong>Delete account</strong> — start removal when you want cloud data wiped; you get a confirmation email when it finishes.</li>
                    </ul>
                    <p style="margin:12px 0 0 0;font-size:14px;line-height:1.55;color:#475569;">One <strong>email and password</strong> for every product above.</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;padding:16px;background:#eff6ff;border-radius:12px;font-size:14px;line-height:1.6;color:#1e3a8a;border-left:4px solid #2563eb;"><strong>Email from us:</strong> we’ll message you to <strong>confirm your address</strong> and for account security (for example password reset). Optional TrifangX roundup, <strong>Sports Digest</strong>, and milestone mail — change anytime in <a href="${dashUrl}" style="color:#1d4ed8;font-weight:600;">your dashboard</a> or on the <a href="${sportsDigestUrl}" style="color:#1d4ed8;font-weight:600;">Sports Digest</a> page.</p>
              <p style="margin:24px 0 0 0;font-size:15px;line-height:1.65;color:#334155;">Questions, ideas, or bug reports? Email <a href="mailto:caleb@ahrenslabs.com" style="color:#2563eb;font-weight:600;">caleb@ahrenslabs.com</a>.</p>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.55;color:#94a3b8;">All links point to <a href="${homeUrl}" style="color:#64748b;">ahrenslabs.com</a>. If you didn’t create this account, you can ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;background:#f1f5f9;border-top:1px solid #e2e8f0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#64748b;line-height:1.5;">
              © Ahrens Labs · <a href="${homeUrl}" style="color:#64748b;">ahrenslabs.com</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${safeName},`,
    '',
    'Thanks for joining Ahrens Labs. Your free account stores progress in the cloud so you can pick up where you left off on any device.',
    '',
    preheader,
    '',
    'Play TrifangX (chess):',
    chessUrl,
    '',
    'Account dashboard:',
    dashUrl,
    '',
    '--- What your account unlocks ---',
    '',
    'TrifangX chess —',
    'Spar with a strong engine, unlock hundreds of achievements, spend points in a cosmetic shop (boards, pieces, themes, effects), and complete three daily challenges that refresh each day on your device. From your account dashboard you can opt into a daily roundup email or request today’s list anytime.',
    '',
    'Sports Digest —',
    'Optional email for the teams you follow across MLB, NFL, NBA, NHL, Premier League, Big Ten, and SEC. Pick teams, choose daily/weekly/custom send times (Central Time), and get schedules plus headlines. Turn it on after email confirmation:',
    sportsDigestUrl,
    '',
    'Dungeon —',
    `A dice-driven dungeon crawl in the browser: combat, treasure, shops, and story beats. Tactical fights with directional attacks, defense, consumables, and retreat. Multiple cloud save slots so a run survives a new device or browser.`,
    dungeonUrl,
    '',
    'Classify —',
    `An advanced class planner for real academic terms: courses, weekly blocks, deadlines, and rhythm in one workspace. With your Ahrens Labs login, your planner syncs to the cloud.`,
    classifyUrl,
    '',
    'Kyrachyng —',
    `A constructed language you can learn step by step: writing, sounds, grammar, and vocabulary in sequence. Progress is saved on your account.`,
    kyrachyngUrl,
    '',
    'Labs hub —',
    `Experiments and toys: language games, music tools, coding playgrounds, writing helpers, STEM demos, and prototypes. Some use your account for saves; others are one-click to try.`,
    labsUrl,
    '',
    '--- More detail — TrifangX ---',
    '',
    'Chess engine & account:',
    '• Progress & cloud save — wins, losses, draws, and summaries on your profile. Lifetime stats for captures, openings, streaks, and long-term goals.',
    '• Achievements & points — large catalog (tactics, speed, material, blindfold, time controls, unusual feats). Points feed Total Points and rarer goals.',
    '• Shop & cosmetics — boards, piece sets, highlights, arrows, themes, move and checkmate flair, time controls. Purchases stay on your profile across devices.',
    `• Daily challenges & roundup — three rotating achievements each day. Dashboard: daily roundup email (once per day) or email today’s challenges now.`,
    `• Sports Digest — optional team schedules and headlines; pick teams and send times at ${sportsDigestUrl}`,
    '• Board tools — legal-move hints, arrows and highlights, premoves, blindfold or mental-board modes.',
    '• Game history & replay — reopen recent games from the cloud and step through move-by-move.',
    '• Modes — casual engine sparring, clocked games with increments, optional live-engine play from the lobby when enabled.',
    '',
    '--- More about each experience ---',
    '',
    'Dungeon:',
    '• Exploration — combat, loot, merchants, hazards; dice-driven outcomes.',
    '• Combat — attack lanes, defense, items, retreat when health is low.',
    '• Progression — achievements and stats; multiple save slots.',
    '• Cloud saves — slot data on your profile across devices.',
    '',
    'Classify planner:',
    '• Semester view — courses, weekly blocks, recurring commitments.',
    '• Built for real terms — midterms, projects, shifting schedules.',
    '• Cloud backup — sync when signed in; recover after reinstall.',
    '• Same account — planner plus games without extra logins.',
    '',
    'Kyrachyng:',
    '• Structured path — lessons unlock in order.',
    '• Reading & writing — practice production, not only passive reading.',
    '• Saved progress — resume on any device.',
    '• For curious learners — conlangs, puzzles, short daily study.',
    '',
    'Sports Digest:',
    '• Your teams — MLB, NFL, NBA, NHL, Premier League, Big Ten, SEC.',
    '• Your schedule — daily, weekly, or custom times in Central Time.',
    '• What you get — upcoming games and headlines for picked teams.',
    `• Opt-in only — enable after confirmation at ${sportsDigestUrl}`,
    '',
    'Labs hub:',
    '• Browse by card — clear entry for each experiment.',
    '• Quick or deep — short tries or tools to revisit.',
    '• Varied topics — language, audio, code, STEM, writing, humor.',
    '• Account when useful — same login where a lab needs persistence.',
    '',
    'Account dashboard:',
    `• Profile & sign-in — change password or username (username needs current password).`,
    '• Email — daily challenge roundup, Sports Digest for your teams, resend this welcome guide, email today’s challenges now.',
    '• TrifangX shortcuts — open shop, settings, or achievements from the dashboard.',
    '• Delete account — start removal when you want cloud data wiped; confirmation email when it finishes.',
    'One email and password for every product above.',
    '',
    'Email from us: we will message you to confirm your address and for account security (for example password reset). Optional TrifangX roundup, Sports Digest, and milestone mail — change anytime in your dashboard or Sports Digest page:',
    dashUrl,
    sportsDigestUrl,
    '',
    'Questions, ideas, or bug reports? caleb@ahrenslabs.com',
    '',
    `All links: ${homeUrl}`,
    'If you did not create this account, you can ignore this message.',
  ].join('\n');

  const dispatchOpts = { to: email, subject, html, text };
  if (sendOptions.fromAddr) dispatchOpts.fromAddr = sendOptions.fromAddr;
  if (sendOptions.fromName != null && String(sendOptions.fromName).trim())
    dispatchOpts.fromName = String(sendOptions.fromName).trim();
  await dispatchTransactionalEmail(env, dispatchOpts);
}

async function sendAccountDeletedEmail(env, email, username) {
  if (!email) return;
  const safeName = String(username).replace(/[<>]/g, '');
  const safeNameHtml = escapeHtmlEmail(safeName);
  const base = sitePublicBase(env);
  let siteHostname = 'ahrenslabs.com';
  try {
    siteHostname = new URL(`${base}/`).hostname.replace(/^www\./, '') || siteHostname;
  } catch {
    /* keep default */
  }
  const siteHostHtml = escapeHtmlEmail(siteHostname);
  const subject = 'Your Ahrens Labs account was deleted';
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#0c4a6e 0%,#0f172a 50%,#14532d 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35);">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(120deg,#0ea5e9 0%,#22c55e 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ecfeff;opacity:.95;">Ahrens Labs</p>
            <p style="margin:10px 0 0 0;font-size:26px;font-weight:900;line-height:1.2;color:#ffffff;">Account removed</p>
            <p style="margin:10px 0 0 0;font-size:15px;line-height:1.55;color:#ecfdf5;">This message confirms the deletion you started — cloud saves and profile data tied to this login are gone.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
            <p style="margin:0 0 14px 0;font-size:18px;font-weight:700;">Hi ${safeNameHtml},</p>
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#334155;">Your <strong style="color:#0f172a;">Ahrens Labs</strong> account and associated cloud data have been <strong style="color:#b91c1c;">permanently deleted</strong> as requested.</p>
            <p style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#334155;">If you did not initiate this, secure your inbox and reach out through the site — we take unexpected removals seriously.</p>
            <div style="text-align:center;margin:8px 0 0 0;">
              <a href="${base}/" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#0ea5e9,#16a34a);color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:800;font-size:15px;box-shadow:0 10px 24px rgba(14,165,233,.35);">Visit ${siteHostHtml}</a>
            </div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${safeName},`,
    '',
    'Your Ahrens Labs account and associated cloud data have been permanently deleted.',
    'If you did not request this, secure your inbox and reach out via the website.',
    base + '/',
  ].join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
}

function escapeHtmlEmail(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDailyDigestLines(challengeIds) {
  const lines = [];
  for (const id of challengeIds) {
    const c = DAILY_CHALLENGE_CARD_INFO[id];
    if (c) {
      lines.push(`• ${c.name} (${c.points} pts) — ${c.desc}`);
    } else {
      const hint = DAILY_CHALLENGE_DIGEST_BLURBS[id];
      lines.push(
        hint ? `• ${hint} — open TrifangX for today’s full challenge list.` : `• Daily challenge — open TrifangX for details.`
      );
    }
  }
  return lines.join('\n');
}

/** Achievement-modal-style card — full width row (no internal challenge ids shown). */
function digestChallengeCardHtml(challengeId) {
  const c = DAILY_CHALLENGE_CARD_INFO[challengeId];
  const name = escapeHtmlEmail(c ? c.name : 'Daily challenge');
  const desc = escapeHtmlEmail(
    c ? c.desc : DAILY_CHALLENGE_DIGEST_BLURBS[challengeId] || 'Open TrifangX in the All Achievements list for full details.'
  );
  const pointsHtml =
    c && typeof c.points === 'number'
      ? `<div style="display:inline-block;margin-top:10px;padding:6px 12px;border-radius:999px;background:linear-gradient(90deg,#fef3c7,#fde68a);font-size:13px;font-weight:800;color:#b45309;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">${c.points} pts</div>`
      : '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-radius:14px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
<tr><td style="width:5px;background:linear-gradient(180deg,#f97316,#ea580c,#fbbf24);line-height:0;font-size:0;">&nbsp;</td>
<td style="padding:18px 20px 18px 18px;background:#ffffff;border:1px solid #e2e8f0;border-left:none;border-radius:0 14px 14px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica Neue,Arial,sans-serif;">
<div style="font-size:17px;font-weight:800;color:#0f172a;line-height:1.25;margin:0 0 8px 0;">${name}</div>
<div style="font-size:14px;color:#64748b;line-height:1.5;margin:0;">${desc}</div>
${pointsHtml}
<div style="font-size:13px;color:#2563eb;font-weight:700;margin-top:12px;">Track in TrifangX → All Achievements</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:10px;"><tr><td style="height:5px;background:linear-gradient(90deg,#fed7aa,#fdba74,#fcd34d);border-radius:4px;line-height:5px;font-size:0;">&nbsp;</td></tr></table>
</td></tr></table>`;
}

function digestDailyChallengesSectionHtml(challengeIds) {
  const raw = Array.isArray(challengeIds) ? challengeIds.filter((x) => typeof x === 'string' && x) : [];
  const ids = raw.slice(0, 3);
  const cardRows = ids
    .map(
      (id) =>
        `<tr><td style="padding:0 0 16px 0;">${digestChallengeCardHtml(id)}</td></tr>`
    )
    .join('');
  return `<tr>
<td style="padding:14px 32px 12px 32px;text-align:center;background:linear-gradient(180deg,#fff7ed 0%,#ffffff 100%);border-bottom:2px solid #fb923c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<h2 style="margin:0 0 6px 0;font-size:22px;font-weight:900;background:linear-gradient(90deg,#c2410c,#ea580c,#d97706);-webkit-background-clip:text;background-clip:text;color:#c2410c;line-height:1.2;">⚡ Daily challenges</h2>
<div style="color:#9a3412;font-size:14px;line-height:1.45;font-weight:600;">Three fresh goals — every calendar day</div>
</td>
</tr>
<tr>
<td style="padding:14px 28px 10px 28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${cardRows}</table>
</td>
</tr>`;
}

/** @returns {Promise<boolean>} true if an email was sent */
async function sendDailyDigestEmail(env, { email, username }, challengeIds, options = {}) {
  if (!email || typeof email !== 'string') return false;
  const instant = options.instant === true;
  const safeName = String(username || 'there').replace(/[<>]/g, '');
  const safeNameHtml = escapeHtmlEmail(safeName);
  const base = siteMarketingBase(env);
  const emailInnerMax = '720px';
  const chessUrl = `${base}/chess_engine.html`;
  const dashUrl = `${base}/account-dashboard.html`;
  const instantBanner = instant
    ? `<tr><td style="padding:0 36px 18px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><p style="margin:0;padding:16px 18px;background:linear-gradient(90deg,#fef9c3,#ffedd5);border-radius:12px;border-left:5px solid #ea580c;font-size:14px;line-height:1.55;color:#9a3412;box-shadow:0 4px 14px rgba(234,88,12,0.15);"><strong style="color:#c2410c;">On-demand</strong> — you requested today’s list from your account dashboard.</p></td></tr>`
    : '';
  const preheader = `Today’s three TrifangX daily challenges — play in the chess engine.`;

  const dailySectionInner = digestDailyChallengesSectionHtml(challengeIds);

  const subject = instant ? `Your TrifangX daily challenges` : `TrifangX daily challenges`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(165deg,#431407 0%,#0f172a 55%,#1e3a8a 100%);">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:transparent;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:${emailInnerMax};width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 24px 56px rgba(0,0,0,0.38);border:1px solid rgba(255,255,255,0.08);">
          <tr>
            <td style="background:linear-gradient(120deg,#ea580c 0%,#c2410c 35%,#1e293b 90%);padding:28px 36px;text-align:left;">
              <p style="margin:0 0 4px 0;font-family:Georgia,serif;font-size:21px;font-weight:800;color:#fffbeb;text-shadow:0 2px 12px rgba(0,0,0,0.25);">Today’s TrifangX dailies</p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#ffedd5;line-height:1.5;">Three rotating achievements — <strong style="color:#ffffff;">new set every day</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 10px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <p style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:#0f172a;">Hi ${safeNameHtml},</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">Here are today’s three TrifangX daily challenges. You can <strong style="color:#0f172a;">complete them in any order</strong> — each counts as soon as you finish it.</p>
            </td>
          </tr>
          ${instantBanner}
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${dailySectionInner}</table>
            </td>
          </tr>
          <tr>
            <td style="padding:10px 36px 32px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" align="center">
              <a href="${chessUrl}" style="display:inline-block;padding:15px 34px;background:linear-gradient(135deg,#f97316,#ea580c,#dc2626);color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:800;font-size:15px;box-shadow:0 12px 28px rgba(234,88,12,0.35);">Open TrifangX</a>
              <p style="margin:16px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">Manage the daily roundup in <a href="${dashUrl}" style="color:#2563eb;font-weight:600;">account settings</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 36px 24px 36px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <a href="${base}/" style="color:#64748b;text-decoration:none;">ahrenslabs.com</a> · TrifangX
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Hi ${safeName},`,
    '',
    instant ? '(Sent on request from your account dashboard.)' : '(Daily TrifangX challenge roundup.)',
    '',
    `Today’s three challenges (complete in any order):`,
    formatDailyDigestLines(challengeIds),
    '',
    `Play: ${chessUrl}`,
    `Dashboard: ${dashUrl}`,
    '',
    instant ? '' : 'You turned on the daily challenge email in account settings.',
  ]
    .filter(Boolean)
    .join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
  return true;
}

async function handleScheduledCron(event, env) {
  if (!env.DAILY_DIGEST_KV) {
    console.log('scheduled: DAILY_DIGEST_KV not bound, skipping digest');
    return;
  }
  const cronExpr = event && typeof event.cron === 'string' ? event.cron : '';
  const scheduledMs =
    event && typeof event.scheduledTime === 'number' && Number.isFinite(event.scheduledTime)
      ? event.scheduledTime
      : Date.now();
  const scheduledAt = new Date(scheduledMs);
  const target = getDigestSendUtcHM(env);
  const utcHour = scheduledAt.getUTCHours();
  const utcMinute = scheduledAt.getUTCMinutes();
  /** Allow the scheduled instant plus up to 19 minutes (Cloudflare may run slightly late). */
  const gateOk =
    utcHour === target.hour && utcMinute >= target.minute && utcMinute <= target.minute + 19;
  if (!gateOk) {
    console.log('Daily digest cron skip — not digest send window (UTC)', {
      utcHour,
      utcMinute,
      target,
      cron: cronExpr,
      scheduledMs,
    });
    return;
  }

  const digestYmd = utcDateString(scheduledAt);
  let cursor;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  do {
    const list = await env.DAILY_DIGEST_KV.list({ prefix: 'sub:', cursor });
    for (const { name } of list.keys) {
      try {
        const raw = await env.DAILY_DIGEST_KV.get(name, 'json');
        if (!raw || typeof raw.email !== 'string') continue;

        const userIdFromKey = name.startsWith('sub:') ? name.slice(4) : '';
        if (userIdFromKey) {
          try {
            const profileDoId = env.USER_ACCOUNT.idFromName(userIdFromKey);
            const profileStub = env.USER_ACCOUNT.get(profileDoId);
            const profRes = await profileStub.fetch(new Request('http://do/getData', { method: 'GET' }));
            const profile = await profRes.json();
            if (!hasConfirmedEmailForProductMail(profile)) {
              skipped++;
              continue;
            }
            const liveEmail = normalizeEmail(profile.email || raw.email || '');
            if (!liveEmail || !isLikelyRealEmail(liveEmail)) {
              skipped++;
              continue;
            }
            raw.email = liveEmail;
            if (profile.username) raw.username = profile.username;
          } catch (profileErr) {
            skipped++;
            console.error('Digest cron profile load failed', userIdFromKey, profileErr?.message || profileErr);
            continue;
          }
        } else {
          const legacyTo = normalizeEmail(raw.email || '');
          if (!legacyTo || !isLikelyRealEmail(legacyTo)) {
            skipped++;
            continue;
          }
          raw.email = legacyTo;
        }

        if (raw.lastDigestLocalYmd === digestYmd) {
          skipped++;
          continue;
        }

        const ids = getDailyChallengeIdsForUtcDate(digestYmd);
        const didSend = await sendDailyDigestEmail(env, raw, ids, {});
        if (!didSend) {
          skipped++;
          continue;
        }
        const next = { email: raw.email, username: raw.username, lastDigestLocalYmd: digestYmd };
        await env.DAILY_DIGEST_KV.put(name, JSON.stringify(next));
        sent++;
      } catch (e) {
        failed++;
        console.error('Digest send failed', name, e?.message || e);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  console.log('Daily digest cron', {
    sent,
    failed,
    skipped,
    cron: cronExpr,
    digestDate: digestYmd,
    digestUtcHM: `${target.hour}:${String(target.minute).padStart(2, '0')}`,
  });
}

/** Sports Digest — same delivery path as daily challenge mail (EMAIL_TRANSACTIONAL + dispatchTransactionalEmail). */
async function handleSportsDigestScheduledCron(event, env) {
  if (!env.SPORTS_DIGEST_KV) {
    console.log('sports-digest cron: SPORTS_DIGEST_KV not bound');
    return;
  }
  const tick = getSportsDigestCronTick(event);
  if (!tick) return;

  const cronExpr = event && typeof event.cron === 'string' ? event.cron : '';
  let cursor;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  do {
    const list = await env.SPORTS_DIGEST_KV.list({ prefix: 'sub:', cursor });
    for (const { name } of list.keys) {
      try {
        const raw = await env.SPORTS_DIGEST_KV.get(name, 'json');
        if (!raw || typeof raw !== 'object' || !Array.isArray(raw.teams) || !raw.teams.length) {
          skipped++;
          continue;
        }

        const userIdFromKey = name.startsWith('sub:') ? name.slice(4) : '';
        if (userIdFromKey && env.USER_ACCOUNT) {
          try {
            const profileDoId = env.USER_ACCOUNT.idFromName(userIdFromKey);
            const profileStub = env.USER_ACCOUNT.get(profileDoId);
            const profRes = await profileStub.fetch(new Request('http://do/getData', { method: 'GET' }));
            const profile = await profRes.json();
            if (!hasConfirmedEmailForProductMail(profile)) {
              skipped++;
              continue;
            }
            const liveEmail = normalizeEmail(profile.email || raw.email || '');
            if (!liveEmail || !isLikelyRealEmail(liveEmail)) {
              skipped++;
              continue;
            }
            raw.email = liveEmail;
            if (profile.username) raw.username = profile.username;
          } catch (profileErr) {
            skipped++;
            console.error('Sports digest profile load failed', userIdFromKey, profileErr?.message || profileErr);
            continue;
          }
        } else {
          const legacyTo = normalizeEmail(raw.email || '');
          if (!legacyTo || !isLikelyRealEmail(legacyTo)) {
            skipped++;
            continue;
          }
          raw.email = legacyTo;
        }

        const sendKey = subscriberSendKey(raw, tick.ymd, tick.hm, tick.weekday);
        if (!sendKey) {
          skipped++;
          continue;
        }

        const sinceMs = resolveSubscriberSinceMs(raw, tick.scheduledMs);
        const content = await fetchSportsDigestEmailContent(env, {
          teams: raw.teams,
          username: raw.username,
          sinceMs,
        });
        await dispatchTransactionalEmail(env, {
          to: raw.email,
          subject: content.subject,
          html: content.html,
          text: content.text,
          fromAddr: 'caleb@ahrenslabs.com',
          fromName: 'Sports Digest',
        });
        const updated = applySendKey(raw, sendKey);
        await env.SPORTS_DIGEST_KV.put(name, JSON.stringify({ ...updated, email: raw.email, username: raw.username }));
        sent++;
        console.log('Sports digest sent', { to: raw.email, sendKey, teams: raw.teams.length });
      } catch (e) {
        failed++;
        console.error('Sports digest send failed', name, e?.message || e);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);

  console.log('Sports digest cron', {
    sent,
    failed,
    skipped,
    cron: cronExpr,
    central: `${tick.ymd} ${tick.hm}`,
    utcHm: tick.utcHm,
  });
}

function generatePasswordResetToken() {
  return `pwreset_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
}

function buildPasswordResetUrl(env, email, token) {
  const base = verificationEmailOrigin(env);
  const path = env.PASSWORD_RESET_LANDING_PATH || '/reset-password.html';
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const q = new URLSearchParams({ reset: token, email });
  return `${base}${pathWithLeadingSlash}?${q.toString()}`;
}

async function sendPasswordResetEmail(env, email, username, token) {
  const resetUrl = buildPasswordResetUrl(env, email, token);
  const safeName = String(username).replace(/[<>]/g, '');
  const safeNameHtml = escapeHtmlEmail(safeName);
  const urlEsc = escapeHtmlEmail(resetUrl);
  const subject = 'Secure link — reset your Ahrens Labs password';
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:linear-gradient(160deg,#1e1b4b 0%,#0f172a 45%,#9d174d 100%);">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td align="center" style="padding:32px 14px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.4);">
        <tr>
          <td style="padding:28px 32px;background:linear-gradient(115deg,#6366f1 0%,#a855f7 45%,#ec4899 100%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <p style="margin:0;font-size:13px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#eef2ff;opacity:.95;">Account security</p>
            <p style="margin:10px 0 0 0;font-size:26px;font-weight:900;line-height:1.2;color:#ffffff;">Password reset</p>
            <p style="margin:10px 0 0 0;font-size:15px;line-height:1.55;color:#fce7f3;">Someone (hopefully you) asked for a fresh password. This link is single-use and expires in one hour.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
            <p style="margin:0 0 14px 0;font-size:18px;font-weight:700;">Hi ${safeNameHtml},</p>
            <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#334155;">Tap the button to pick a <strong style="color:#0f172a;">new password</strong>. If the button does not work, use the plain link below — same one-hour window.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}" style="display:inline-block;padding:16px 36px;background:linear-gradient(135deg,#6366f1,#db2777);color:#ffffff !important;text-decoration:none;border-radius:999px;font-weight:800;font-size:16px;box-shadow:0 12px 28px rgba(99,102,241,.4);">Reset password</a>
            </div>
            <p style="margin:0 0 8px 0;font-size:13px;color:#64748b;">Plain link:</p>
            <p style="margin:0;padding:12px 14px;background:#f8fafc;border-radius:10px;word-break:break-all;font-size:12px;color:#475569;line-height:1.5;">${urlEsc}</p>
            <p style="margin:22px 0 0 0;font-size:12px;line-height:1.55;color:#94a3b8;">If you did not request this, ignore this message — your password stays unchanged.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  const text = [
    `Hi ${safeName},`,
    '',
    'We received a request to reset your Ahrens Labs password.',
    `Open this link to choose a new password (expires in one hour): ${resetUrl}`,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
}

const FORGOT_PASSWORD_OK_MESSAGE = 'Email sent!';

async function handleForgotPassword(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const normalizedEmail = normalizeEmail(body.email);
  const genericResponse = () =>
    new Response(
      JSON.stringify({ success: true, message: FORGOT_PASSWORD_OK_MESSAGE }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  if (!normalizedEmail || !isLikelyRealEmail(normalizedEmail)) {
    return genericResponse();
  }

  const userId = generateUserId(normalizedEmail);
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const getDataRes = await userAccount.fetch(getDataReq);
  const userData = await getDataRes.json();

  if (!userData || typeof userData !== 'object') {
    console.log(
      'Forgot password: no user in legacy email slot (wrong email, or account not on this Worker)',
      { userId }
    );
    return genericResponse();
  }

  const storedEmail = normalizeEmail(userData.email || '');
  if (storedEmail !== normalizedEmail) {
    console.log('Forgot password: stored email does not match request', {
      userId,
      requestEmail: normalizedEmail,
    });
    return genericResponse();
  }

  const token = generatePasswordResetToken();
  const setReq = new Request('http://do/setPasswordResetToken', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  await userAccount.fetch(setReq);

  const username = userData.username || 'there';
  let emailSendError = null;
  try {
    await sendPasswordResetEmail(env, normalizedEmail, username, token);
  } catch (e) {
    emailSendError = summarizeEmailSendError(e);
    console.error(
      'Forgot password email failed:',
      emailSendError.code,
      emailSendError.message,
      emailSendError.hint || ''
    );
    const clearReq = new Request('http://do/clearPasswordResetToken', { method: 'POST' });
    await userAccount.fetch(clearReq);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: FORGOT_PASSWORD_OK_MESSAGE,
      emailSendError,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleResetPassword(request, env, corsHeaders) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { email, token, newPassword } = body;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !token || typeof token !== 'string' || newPassword == null || typeof newPassword !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing email, token, or new password' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (String(newPassword).length < 6) {
    return new Response(JSON.stringify({ error: 'Password must be at least 6 characters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = generateUserId(normalizedEmail);
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const resetReq = new Request('http://do/resetPasswordWithToken', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
  const resetRes = await userAccount.fetch(resetReq);
  const result = await resetRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Could not reset password' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Password updated. You can log in with your new password.',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function timingSafeEqualStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

/** Same idea as sports-digest send-test: isolate Worker email from signup logic. */
async function handleSendTest(request, env, corsHeaders) {
  const expected = env.TEST_SECRET;
  if (!expected || typeof expected !== 'string') {
    return new Response(
      JSON.stringify({
        error: 'Set TEST_SECRET: wrangler secret put TEST_SECRET (then redeploy if needed).',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  const provided = request.headers.get('X-Test-Secret') || '';
  if (!timingSafeEqualStrings(provided, expected)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const to = normalizeEmail(body.to);
  if (!to) {
    return new Response(
      JSON.stringify({ error: 'Body must be JSON: { "to": "you@example.com" }' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    await dispatchTransactionalEmail(env, {
      to,
      subject: 'chess-accounts email test',
      html: `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:linear-gradient(165deg,#0f766e 0%,#0f172a 100%);"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px;"><table style="max-width:420px;background:#fff;border-radius:14px;padding:24px 26px;box-shadow:0 16px 40px rgba(0,0,0,.25);font-family:system-ui,sans-serif;"><tr><td><p style="margin:0 0 8px 0;font-size:18px;font-weight:800;color:#0f172a;">Outbound OK</p><p style="margin:0;font-size:15px;line-height:1.55;color:#475569;">If you see this, email from the chess-accounts worker is working.</p></td></tr></table></td></tr></table></body></html>`,
      text: 'If you see this, outbound email from chess-accounts works.',
    });
    return new Response(JSON.stringify({ success: true, to }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || String(err),
        code: err?.code || undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// Handle email verification — completes signup: marks verified, opens a session, sends welcome on first verify.
async function handleVerifyEmail(request, env, corsHeaders, executionCtx) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') || url.searchParams.get('verify');
  const emailRaw = url.searchParams.get('email');
  const email = normalizeEmail(emailRaw);

  if (!token || !email) {
    return new Response(JSON.stringify({ error: 'Missing verification token or email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = generateUserId(email);
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  const verifyReq = new Request('http://do/verifyEmail', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

  const verifyRes = await userAccount.fetch(verifyReq);
  const result = await verifyRes.json();

  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Invalid or expired verification token' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const getDataReq = new Request('http://do/getData', { method: 'GET' });
  const dataRes = await userAccount.fetch(getDataReq);
  const userRow = await dataRes.json();
  if (!userRow || typeof userRow !== 'object') {
    return new Response(JSON.stringify({ error: 'Account not found after verification' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = generateSessionId();
  const sessionObjId = env.SESSION.idFromName(sessionId);
  const session = env.SESSION.get(sessionObjId);
  const sessionReq = new Request('http://do/create', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
  await session.fetch(sessionReq);

  if (!result.alreadyVerified) {
    const uname = userRow.username || 'there';
    const welcome = () =>
      sendWelcomeGuideEmail(env, email, uname).catch((err) => {
        const w = summarizeEmailSendError(err);
        console.error('Welcome guide email failed:', w.code, w.message, w.hint || '');
      });
    if (executionCtx && typeof executionCtx.waitUntil === 'function') {
      executionCtx.waitUntil(welcome());
    } else {
      await welcome();
    }
  }

  try {
    await ensureSportsDigestKvSubscriber(env, userId, userRow);
  } catch (e) {
    console.warn('ensureSportsDigestKvSubscriber after verify failed:', e?.message || e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: result.alreadyVerified ? 'Email was already confirmed. You are signed in.' : 'Email verified successfully!',
      sessionId,
      userId,
      username: userRow.username || 'Player',
      email,
      alreadyVerified: !!result.alreadyVerified,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

// Password storage: PBKDF2-HMAC-SHA256 with unique random salt per user (not encryption;
// one-way hashing so stored values cannot be recovered). Legacy accounts used bare SHA-256;
// they are upgraded to PBKDF2 on next successful login.
// Cloudflare Workers cap PBKDF2 iterations at 100000 ("above 100000" rejected). Use 99999
// so we stay clearly under any edge-case enforcement; still verify stored 100000 hashes.
const PBKDF2_ITERATIONS = 99999;

function uint8ToHex(u8) {
  return Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToUint8(hex) {
  if (!hex || hex.length % 2 !== 0) return new Uint8Array(0);
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function timingSafeEqualHex(a, b) {
  const aa = String(a).toLowerCase();
  const bb = String(b).toLowerCase();
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

async function pbkdf2Sha256(password, salt, iterations) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return new Uint8Array(bits);
}

async function hashPasswordSecure(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Sha256(plain, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${uint8ToHex(salt)}$${uint8ToHex(hash)}`;
}

async function legacySha256Password(plain) {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', encoder.encode(plain));
  return uint8ToHex(new Uint8Array(buf));
}

async function verifyStoredPassword(plain, stored) {
  if (plain == null || stored == null || typeof stored !== 'string') return false;
  if (stored.startsWith('pbkdf2$')) {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iter = parseInt(parts[1], 10);
    if (!Number.isFinite(iter) || iter < 10000 || iter > 100000) return false;
    const saltHex = parts[2];
    const expectedHex = parts[3];
    if (!/^[0-9a-fA-F]+$/.test(saltHex) || saltHex.length % 2 !== 0) return false;
    if (!/^[0-9a-fA-F]{64}$/.test(expectedHex)) return false;
    const salt = hexToUint8(saltHex);
    if (salt.length === 0) return false;
    const hash = await pbkdf2Sha256(plain, salt, iter);
    return timingSafeEqualHex(uint8ToHex(hash), expectedHex);
  }
  if (/^[0-9a-fA-F]{64}$/.test(stored)) {
    const legacy = await legacySha256Password(plain);
    return timingSafeEqualHex(legacy, stored);
  }
  return false;
}

/** Matches client `gameHistoryRecordIsFavorite` in js/trifangx_chess_app.js */
function chessGameHistoryRecordIsFavorite(rec) {
  return !!(rec && rec.favorite === true);
}

/** Matches client `trimGameHistoryToCap`: keep all favorites plus up to 50 non-favorites (in list order). */
function trimChessGameHistoryMerged(items) {
  if (!Array.isArray(items)) return [];
  let nonFavKept = 0;
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const r = items[i];
    if (!r) continue;
    if (chessGameHistoryRecordIsFavorite(r)) {
      out.push(r);
    } else if (nonFavKept < 50) {
      out.push(r);
      nonFavKept++;
    }
  }
  return out;
}

/**
 * Union server + client game history by record id so concurrent tabs (multiple live games)
 * cannot overwrite each other's completed games on sync.
 */
function mergeChessGameHistoryForSync(prev, incoming) {
  const prevArr = Array.isArray(prev) ? prev : [];
  const incArr = Array.isArray(incoming) ? incoming : [];
  const byKey = new Map();

  function keyFor(r) {
    if (!r || typeof r !== 'object') return null;
    if (typeof r.id === 'string' && r.id.trim()) return r.id.trim();
    const sa = r.savedAt != null ? String(r.savedAt) : '';
    const h0 =
      Array.isArray(r.historySan) && r.historySan.length ? String(r.historySan[0]) : '';
    if (sa) return `legacy:${sa}:${h0}`;
    return null;
  }

  for (const r of prevArr) {
    const k = keyFor(r);
    if (k) byKey.set(k, r);
  }
  for (const r of incArr) {
    const k = keyFor(r);
    if (k) byKey.set(k, r);
  }

  const arr = Array.from(byKey.values());
  arr.sort((a, b) => {
    const ta = Date.parse(a.savedAt) || 0;
    const tb = Date.parse(b.savedAt) || 0;
    return tb - ta;
  });
  return trimChessGameHistoryMerged(arr);
}

// Durable Object: UserAccount
export class UserAccount {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      if (path === '/create' && request.method === 'POST') {
        const { email, password, username } = await request.json();
        const result = await this.create(email, password, username);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/authenticate' && request.method === 'POST') {
        const { password } = await request.json();
        const result = await this.authenticate(password);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/getData' && request.method === 'GET') {
        const data = await this.getData();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/updateData' && request.method === 'POST') {
        const userData = await request.json();
        await this.updateData(userData);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/setVerificationToken' && request.method === 'POST') {
        const { token } = await request.json();
        await this.setVerificationToken(token);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/verifyEmail' && request.method === 'POST') {
        const { token } = await request.json();
        const result = await this.verifyEmail(token);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/adminForceVerifyEmail' && request.method === 'POST') {
        let body = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }
        const result = await this.adminForceVerifyEmail(body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/adminForceDeleteAccount' && request.method === 'POST') {
        const result = await this.adminForceDeleteAccount();
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/setPasswordResetToken' && request.method === 'POST') {
        const { token } = await request.json();
        await this.setPasswordResetToken(token);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/clearPasswordResetToken' && request.method === 'POST') {
        await this.clearPasswordResetToken();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/resetPasswordWithToken' && request.method === 'POST') {
        const { token, newPassword } = await request.json();
        const result = await this.resetPasswordWithToken(token, newPassword);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/changePassword' && request.method === 'POST') {
        const { currentPassword, newPassword } = await request.json();
        const result = await this.changePassword(currentPassword, newPassword);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/setEmailPreferences' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.setEmailPreferences(body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/setHeaderNavItems' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.setHeaderNavItems(body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/setSportsDigestPreferences' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.setSportsDigestPreferences(body);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/setLeaderboardRowColor' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.setLeaderboardRowColor(body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/changeUsername' && request.method === 'POST') {
        const { newUsername, password } = await request.json();
        const result = await this.changeUsername(newUsername, password);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : result.status || 400,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/deleteAccount' && request.method === 'POST') {
        const { password } = await request.json();
        const result = await this.deleteAccount(password);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/updateChessData' && request.method === 'POST') {
        const chessData = await request.json();
        await this.updateChessData(chessData);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/claimSeasonStep' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.claimSeasonStep(body && typeof body === 'object' ? body : {});
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/resetSeasonTrack' && request.method === 'POST') {
        const result = await this.resetSeasonTrack();
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/setChessLbFlair' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.setChessLbFlair(body && typeof body === 'object' ? body : {});
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 400,
          headers: { 'Content-Type': 'application/json' },
        });
      } else if (path === '/getChessData' && request.method === 'GET') {
        const chessData = await this.getChessData();
        return new Response(JSON.stringify(chessData), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/getDungeonSlots' && request.method === 'GET') {
        const slotsData = await this.getDungeonSlots();
        return new Response(JSON.stringify(slotsData), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/saveDungeonSlot' && request.method === 'POST') {
        const { slot, data, name } = await request.json();
        await this.saveDungeonSlot(slot, data, name);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/loadDungeonSlot' && request.method === 'POST') {
        const { slot } = await request.json();
        const slotData = await this.loadDungeonSlot(slot);
        return new Response(JSON.stringify(slotData), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/deleteDungeonSlot' && request.method === 'POST') {
        const { slot } = await request.json();
        await this.deleteDungeonSlot(slot);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/updateClassifyData' && request.method === 'POST') {
        const classifyData = await request.json();
        await this.updateClassifyData(classifyData);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/getClassifyData' && request.method === 'GET') {
        const classifyData = await this.getClassifyData();
        return new Response(JSON.stringify(classifyData), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/updateKyrachyngProgress' && request.method === 'POST') {
        const { completed } = await request.json();
        await this.updateKyrachyngProgress(completed);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/getKyrachyngProgress' && request.method === 'GET') {
        const progress = await this.getKyrachyngProgress();
        return new Response(JSON.stringify(progress), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/getTetherProjectIds' && request.method === 'GET') {
        const projectIds = await this.getTetherProjectIds();
        return new Response(JSON.stringify({ projectIds }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/addTetherProjectId' && request.method === 'POST') {
        const { projectId } = await request.json();
        await this.addTetherProjectId(projectId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/removeTetherProjectId' && request.method === 'POST') {
        const { projectId } = await request.json();
        await this.removeTetherProjectId(projectId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (path === '/debug' && request.method === 'GET') {
        const allKeys = await this.storage.list();
        const userData = await this.storage.get('userData');
        let userDataSafe = userData;
        if (userData && typeof userData === 'object') {
          userDataSafe = { ...userData };
          if ('passwordHash' in userDataSafe) {
            userDataSafe.passwordHash = userDataSafe.passwordHash ? '[redacted]' : null;
          }
        }
        return new Response(JSON.stringify({
          storageKeys: Array.from(allKeys.keys()),
          userDataValue: userDataSafe,
          userDataType: typeof userData,
          hasUserData: userData !== null,
          hasUserDataUndefined: userData !== undefined,
          checkExistsResult: await this.checkExists()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('UserAccount DO', { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  async checkExists() {
    const data = await this.storage.get('userData');
    console.log('checkExists - data:', data ? 'EXISTS' : 'NULL', 'DO ID:', this.state.id.toString());
    return data !== null && data !== undefined;
  }

  async create(email, password, username) {
    // Check if already exists
    const exists = await this.checkExists();
    console.log('Create user - exists:', exists, 'email:', email);
    if (exists) {
      return { success: false, error: 'User already exists' };
    }

    const passwordHash = await hashPasswordSecure(password);

    const userData = {
      email,
      username,
      passwordHash,
      createdAt: Date.now(),
      emailVerified: false,
      verificationToken: null,
      emailPreferences: { dailyChallengeEmails: false, digestTimeZone: DEFAULT_DIGEST_TIMEZONE },
      games: {
        chess: {
          achievements: {},
          points: 0,
          shopUnlocks: {
            boards: ['classic'],
            pieces: ['classic'],
            highlightColors: ['red'],
            arrowColors: ['red'],
            legalMoveDots: ['gray-circle'],
            themes: ['light'],
            checkmateEffects: [],
            timeControls: ['none']
          },
          settings: {
            boardStyle: 'classic',
            pieceStyle: 'classic',
            highlightColor: 'red',
            arrowColor: 'red',
            legalMoveDotStyle: 'gray-circle',
            pageTheme: 'light'
          },
          stats: {
            playerStats: { wins: 0, losses: 0, draws: 0 },
            lifetimeStats: {}
          }
        },
        dungeon: {
          saveSlots: {
            slot1: null,
            slot2: null,
            slot3: null
          },
          lastPlayedSlot: null
        },
        classify: {
          tasks: [],
          blockedTimes: [],
          scheduleRules: null,
          vacations: [],
          repeatSkips: {},
          subjectColors: {},
          calendarViewMode: 'month',
          darkMode: null,
          lastUpdated: null
        },
        kyrachyng: {
          lessonsCompleted: []
        }
      },
      tether: {
        projectIds: []
      }
    };

    await this.storage.put('userData', userData);
    return { success: true };
  }

  async getTetherProjectIds() {
    const userData = await this.storage.get('userData');
    if (!userData) return [];
    if (!userData.tether || !Array.isArray(userData.tether.projectIds)) {
      return [];
    }
    return userData.tether.projectIds.filter((id) => typeof id === 'string' && id.trim());
  }

  async addTetherProjectId(projectId) {
    const pid = projectId != null ? String(projectId).trim() : '';
    if (!pid) return;
    const userData = await this.storage.get('userData');
    if (!userData) return;
    if (!userData.tether || typeof userData.tether !== 'object') {
      userData.tether = { projectIds: [] };
    }
    if (!Array.isArray(userData.tether.projectIds)) {
      userData.tether.projectIds = [];
    }
    if (!userData.tether.projectIds.includes(pid)) {
      userData.tether.projectIds.push(pid);
      await this.storage.put('userData', userData);
    }
  }

  async removeTetherProjectId(projectId) {
    const pid = projectId != null ? String(projectId).trim() : '';
    if (!pid) return;
    const userData = await this.storage.get('userData');
    if (!userData || !userData.tether || !Array.isArray(userData.tether.projectIds)) return;
    userData.tether.projectIds = userData.tether.projectIds.filter((id) => id !== pid);
    await this.storage.put('userData', userData);
  }

  async authenticate(password) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false };
    }

    const stored = userData.passwordHash;
    const ok = await verifyStoredPassword(password, stored);
    if (!ok) {
      return { success: false };
    }

    let shouldRehash =
      typeof stored === 'string' && !stored.startsWith('pbkdf2$');
    if (typeof stored === 'string' && stored.startsWith('pbkdf2$')) {
      const parts = stored.split('$');
      if (parts.length !== 4) {
        shouldRehash = true;
      } else {
        const iter = parseInt(parts[1], 10);
        if (!Number.isFinite(iter) || iter !== PBKDF2_ITERATIONS) {
          shouldRehash = true;
        }
      }
    }
    if (shouldRehash) {
      userData.passwordHash = await hashPasswordSecure(password);
      await this.storage.put('userData', userData);
    }
    return { success: true };
  }

  async getData() {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return null;
    }

    const {
      passwordHash,
      verificationToken,
      verificationTokenExpiry,
      passwordResetToken,
      passwordResetTokenExpiry,
      milestonesEmailNotified,
      ...safeData
    } = userData;
    const epRaw = safeData.emailPreferences;
    const emailPreferences =
      epRaw && typeof epRaw === 'object'
        ? {
            dailyChallengeEmails: false,
            digestTimeZone: DEFAULT_DIGEST_TIMEZONE,
            ...epRaw,
          }
        : { dailyChallengeEmails: false, digestTimeZone: DEFAULT_DIGEST_TIMEZONE };
    if (!emailPreferences.digestTimeZone || !isValidIanaTimeZone(String(emailPreferences.digestTimeZone))) {
      emailPreferences.digestTimeZone = DEFAULT_DIGEST_TIMEZONE;
    }
    emailPreferences.sportsDigest = normalizeSportsDigestPrefs(emailPreferences.sportsDigest);
    const out = {
      userId: this.state.id.toString(),
      ...safeData,
      emailPreferences,
    };
    if (Array.isArray(userData.headerNavItems) && userData.headerNavItems.length > 0) {
      out.headerNavItems = sanitizeHeaderNavItems(userData.headerNavItems);
    }
    const chessForLb = out.games?.chess;
    if (userData.leaderboardRowColor == null || userData.leaderboardRowColor === '') {
      out.leaderboardRowColor = null;
    } else {
      out.leaderboardRowColor = sanitizeLeaderboardRowAppearance(userData.leaderboardRowColor, chessForLb) ?? null;
    }
    return out;
  }

  async updateData(newData) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return;
    }

    // Update specific fields
    if (newData.achievements) userData.achievements = newData.achievements;
    if (newData.points !== undefined) userData.points = newData.points;
    if (newData.shopUnlocks) userData.shopUnlocks = newData.shopUnlocks;
    if (newData.settings) userData.settings = newData.settings;
    if (newData.stats) userData.stats = newData.stats;

    await this.storage.put('userData', userData);
  }

  async setVerificationToken(token) {
    const userData = await this.storage.get('userData');
    if (userData) {
      userData.verificationToken = token;
      userData.verificationTokenExpiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      await this.storage.put('userData', userData);
    }
  }

  async verifyEmail(token) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }

    if (userData.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    if (userData.verificationToken !== token) {
      return { success: false, error: 'Invalid verification token' };
    }

    if (Date.now() > userData.verificationTokenExpiry) {
      return { success: false, error: 'Verification token expired' };
    }

    // Mark email as verified
    userData.emailVerified = true;
    userData.verificationToken = null;
    userData.verificationTokenExpiry = null;
    await this.storage.put('userData', userData);

    return { success: true, alreadyVerified: false };
  }

  /** Called only from the Worker after admin auth — same end state as successful token verification. */
  async adminForceVerifyEmail(body = {}) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    const backfillEmail =
      body && body.email != null ? normalizeEmail(String(body.email)) : '';
    if (backfillEmail && !normalizeEmail(userData.email || '')) {
      userData.email = backfillEmail;
    }
    if (userData.emailVerified === true) {
      let emailBackfilled = false;
      if (backfillEmail && !normalizeEmail(userData.email || '')) {
        userData.email = backfillEmail;
        await this.storage.put('userData', userData);
        emailBackfilled = true;
      }
      return { success: true, alreadyVerified: true, emailBackfilled };
    }
    userData.emailVerified = true;
    userData.verificationToken = null;
    userData.verificationTokenExpiry = null;
    await this.storage.put('userData', userData);
    return { success: true, alreadyVerified: false, emailBackfilled: !!backfillEmail };
  }

  async setPasswordResetToken(token) {
    const userData = await this.storage.get('userData');
    if (userData) {
      userData.passwordResetToken = token;
      userData.passwordResetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour
      await this.storage.put('userData', userData);
    }
  }

  async clearPasswordResetToken() {
    const userData = await this.storage.get('userData');
    if (userData) {
      userData.passwordResetToken = null;
      userData.passwordResetTokenExpiry = null;
      await this.storage.put('userData', userData);
    }
  }

  async resetPasswordWithToken(token, newPassword) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'Invalid or expired reset link' };
    }
    if (!newPassword || String(newPassword).length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }
    if (!userData.passwordResetToken || userData.passwordResetToken !== token) {
      return { success: false, error: 'Invalid or expired reset link' };
    }
    if (Date.now() > userData.passwordResetTokenExpiry) {
      return { success: false, error: 'Reset link has expired. Request a new one.' };
    }

    userData.passwordHash = await hashPasswordSecure(newPassword);
    userData.passwordResetToken = null;
    userData.passwordResetTokenExpiry = null;
    userData.passwordUpdatedAt = Date.now();
    await this.storage.put('userData', userData);
    return { success: true };
  }

  async setEmailPreferences(body) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    if (!userData.emailPreferences || typeof userData.emailPreferences !== 'object') {
      userData.emailPreferences = { dailyChallengeEmails: false, digestTimeZone: DEFAULT_DIGEST_TIMEZONE };
    } else if (
      !userData.emailPreferences.digestTimeZone ||
      !isValidIanaTimeZone(String(userData.emailPreferences.digestTimeZone))
    ) {
      userData.emailPreferences.digestTimeZone = DEFAULT_DIGEST_TIMEZONE;
    }
    if (body && typeof body.dailyChallengeEmails === 'boolean') {
      userData.emailPreferences.dailyChallengeEmails = body.dailyChallengeEmails;
    }
    userData.emailPreferences.digestTimeZone = DEFAULT_DIGEST_TIMEZONE;
    await this.storage.put('userData', userData);
    return { success: true, emailPreferences: userData.emailPreferences };
  }

  async setSportsDigestPreferences(body) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    if (!userData.emailPreferences || typeof userData.emailPreferences !== 'object') {
      userData.emailPreferences = { dailyChallengeEmails: false, digestTimeZone: DEFAULT_DIGEST_TIMEZONE };
    }
    userData.emailPreferences.sportsDigest = normalizeSportsDigestPrefs(body);
    await this.storage.put('userData', userData);
    return {
      success: true,
      sportsDigest: userData.emailPreferences.sportsDigest,
      emailPreferences: userData.emailPreferences,
    };
  }

  async setLeaderboardRowColor(body) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    const raw = body && Object.prototype.hasOwnProperty.call(body, 'color') ? body.color : undefined;
    if (raw === null || raw === '') {
      delete userData.leaderboardRowColor;
      await this.storage.put('userData', userData);
      return { success: true, leaderboardRowColor: null };
    }
    const chess = userData.games?.chess;
    const normalized = sanitizeLeaderboardRowAppearance(raw, chess);
    if (!normalized) {
      const parsed = parseLeaderboardRowStoredToken(raw);
      if (!parsed) {
        return {
          success: false,
          error:
            'Invalid row style. Choose a standard tint, a season gradient you have unlocked, a shop row color you own, or clear.',
        };
      }
      return {
        success: false,
        error:
          'That row style is locked. Buy row tints in the TrifangX shop, claim season gradients, or pick a standard tint.',
      };
    }
    userData.leaderboardRowColor = normalized;
    await this.storage.put('userData', userData);
    return { success: true, leaderboardRowColor: normalized };
  }

  async setHeaderNavItems(body) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    if (!body || !Array.isArray(body.items)) {
      return { success: false, error: 'Send items (array of nav id strings)' };
    }
    const sanitized = sanitizeHeaderNavItems(body.items);
    userData.headerNavItems = sanitized;
    await this.storage.put('userData', userData);
    return { success: true, headerNavItems: sanitized };
  }

  async changeUsername(newUsernameDisplay, password) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'Account not found', status: 404 };
    }
    const ok = await verifyStoredPassword(password || '', userData.passwordHash);
    if (!ok) {
      return { success: false, error: 'Password is incorrect' };
    }

    const trimmed = String(newUsernameDisplay || '').trim();
    if (trimmed.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }
    if (trimmed.length > 40) {
      return { success: false, error: 'Username is too long' };
    }

    const newKey = normalizeUsernameForIndex(trimmed);
    const oldKey = normalizeUsernameForIndex(userData.username || '');
    if (!newKey) {
      return { success: false, error: 'Invalid username' };
    }

    const registryUserId = generateUserId(normalizeEmail(userData.email || ''));

    if (newKey !== oldKey) {
      const usernameRegistryId = this.env.USERNAME_REGISTRY.idFromName('global');
      const usernameRegistry = this.env.USERNAME_REGISTRY.get(usernameRegistryId);
      const reserveReq = new Request('http://do/reserve', {
        method: 'POST',
        body: JSON.stringify({ username: newKey, userId: registryUserId }),
      });
      const reserveRes = await usernameRegistry.fetch(reserveReq);
      let reserveData = null;
      try {
        reserveData = await reserveRes.json();
      } catch {
        reserveData = null;
      }
      if (!reserveRes.ok || !reserveData?.success) {
        return {
          success: false,
          error: reserveData?.error || 'Username is already taken',
          status: reserveRes.status === 409 ? 409 : 400,
        };
      }

      userData.username = trimmed;
      await this.storage.put('userData', userData);

      if (oldKey) {
        const releaseReq = new Request('http://do/release', {
          method: 'POST',
          body: JSON.stringify({ username: oldKey, userId: registryUserId }),
        });
        await usernameRegistry.fetch(releaseReq);
      }
    } else {
      userData.username = trimmed;
      await this.storage.put('userData', userData);
    }

    await this.syncChessCareerPointsLeaderboardEntry();
    return { success: true, username: userData.username };
  }

  async changePassword(currentPassword, newPassword) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    if (!newPassword || String(newPassword).length < 6) {
      return { success: false, error: 'Password must be at least 6 characters' };
    }

    const ok = await verifyStoredPassword(currentPassword || '', userData.passwordHash);
    if (!ok) {
      return { success: false, error: 'Current password is incorrect' };
    }

    userData.passwordHash = await hashPasswordSecure(newPassword);
    userData.passwordUpdatedAt = Date.now();
    userData.passwordResetToken = null;
    userData.passwordResetTokenExpiry = null;
    await this.storage.put('userData', userData);
    return { success: true };
  }

  async deleteAccount(password) {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'Account not found' };
    }
    const ok = await verifyStoredPassword(password, userData.passwordHash);
    if (!ok) {
      return { success: false, error: 'Password is incorrect' };
    }
    return this.adminForceDeleteAccount();
  }

  async adminForceDeleteAccount() {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'Account not found' };
    }
    const userId = this.state.id.toString();
    if (this.env.CHESS_LEADERBOARD_KV) {
      try {
        await removeChessLeaderboardUser(this.env.CHESS_LEADERBOARD_KV, userId);
      } catch (e) {
        console.error('leaderboard remove on delete failed', e?.message || e);
      }
    }
    await this.storage.delete('userData');
    return { success: true };
  }

  /**
   * Apply server-validated season step claim (see SEASON_CLAIM_NODES, js/chess_seasons.js).
   * Idempotent: if step was already claimed, returns success + alreadyClaimed.
   */
  async claimSeasonStep(body) {
    const stepIndex = Math.max(0, Math.floor(Number(body?.stepIndex)));
    if (!Number.isFinite(stepIndex) || stepIndex < 0 || stepIndex >= SEASON_CLAIM_NODES.length) {
      return { success: false, error: 'Invalid step' };
    }
    const buyWithPoints = !!(body && body.buyWithPoints);
    const userData = await this.storage.get('userData');
    if (!userData?.games?.chess) {
      return { success: false, error: 'No chess data' };
    }

    const node = SEASON_CLAIM_NODES[stepIndex];
    const chess = userData.games.chess;

    let st =
      chess.seasonTrack && typeof chess.seasonTrack === 'object' ? { ...chess.seasonTrack } : {};
    if (!/^\d{4}-\d{2}$/.test(String(st.seasonId || '').trim())) {
      st.seasonId = utcChessSeasonIdNow();
      st.nodesCompleted = 0;
    }
    chess.seasonTrack = st;
    const seasonIdForTrack = String(st.seasonId || '').trim();
    const done = Math.min(
      CHESS_SEASON_MAX_NODES,
      Math.max(0, Math.floor(Number(st.nodesCompleted) || 0))
    );

    if (done > stepIndex) {
      const outChess = await this.getChessData();
      return { success: true, alreadyClaimed: true, chess: outChess };
    }
    if (done !== stepIndex) {
      return { success: false, error: 'Claim earlier steps first' };
    }

    const earnBaseline = st.earnBaseline && typeof st.earnBaseline === 'object' ? st.earnBaseline : {};

    if (buyWithPoints) {
      const cost = SEASON_STEP_BUYOUT_POINTS[stepIndex];
      if (!Number.isFinite(cost) || cost <= 0) {
        return { success: false, error: 'Buyout unavailable for this step' };
      }
      const spendable = getChessShopSpendable(chess);
      if (spendable < cost) {
        return {
          success: false,
          error: `Not enough shop points (need ${cost.toLocaleString('en-US')}; you have ${spendable.toLocaleString('en-US')} to spend)`,
        };
      }
    } else if (!seasonChallengeMetSinceBaseline(chess, earnBaseline, node.challengeAchievementId)) {
      return {
        success: false,
        error: 'Finish this challenge in TrifangX after your last claim (or use a step buyout).',
      };
    }

    const prevSnap = chessStatsSnapshot(chess);

    const prevFinaleSnapshot = {
      seasonTrack: { seasonId: seasonIdForTrack, nodesCompleted: done },
      seasonBonusPoints: Math.max(0, Math.floor(Number(chess.seasonBonusPoints) || 0)),
    };

    if (buyWithPoints) {
      const cost = SEASON_STEP_BUYOUT_POINTS[stepIndex];
      const spent = Math.max(0, Math.floor(Number(chess.pointsSpent) || 0));
      chess.pointsSpent = spent + cost;
    }

    applySeasonClaimRewardsToChess(chess, node);
    if (!chess.seasonTrack || typeof chess.seasonTrack !== 'object') chess.seasonTrack = {};
    chess.seasonTrack.nodesCompleted = Math.min(CHESS_SEASON_MAX_NODES, done + 1);
    chess.seasonTrack.seasonId = seasonIdForTrack;
    chess.seasonTrack.earnBaseline = snapshotSeasonEarnBaselineFromChess(chess);
    chess.seasonBonusPoints =
      Math.max(0, Math.floor(Number(chess.seasonBonusPoints) || 0)) +
      Math.max(0, Math.floor(Number(node.bonusPoints) || 0));
    chess.lastUpdated = Date.now();

    await this.storage.put('userData', userData);

    const nextSnap = chessStatsSnapshot(userData.games.chess);
    await persistAndSendChessMilestones(this.env, this.storage, userData, prevSnap, nextSnap);
    await maybeSendSeasonTrackFinaleEmail(this.env, this.storage, userData, prevFinaleSnapshot, userData.games.chess);
    await this.syncChessCareerPointsLeaderboardEntry();

    const outChess = await this.getChessData();
    return { success: true, chess: outChess };
  }

  /**
   * Reset the current UTC month’s season ladder: nodes, baseline, this month’s track-only shop unlocks,
   * leaderboard flair unlocked via the track, and the matching slice of `seasonBonusPoints`.
   * Does not remove global TrifangX achievements or refund step buyouts (not stored per step).
   */
  async resetSeasonTrack() {
    const userData = await this.storage.get('userData');
    if (!userData?.games?.chess) {
      return { success: false, error: 'No chess data' };
    }
    const chess = userData.games.chess;
    const utcSid = utcChessSeasonIdNow();
    let st = chess.seasonTrack && typeof chess.seasonTrack === 'object' ? { ...chess.seasonTrack } : {};
    const stSid = String(st.seasonId || '').trim();
    if (!/^\d{4}-\d{2}$/.test(stSid)) {
      return { success: false, error: 'No synced season on file. Open TrifangX while signed in, then try again.' };
    }
    if (stSid !== utcSid) {
      return {
        success: false,
        error:
          'Reset only applies to the active month on your save. Open TrifangX once while signed in if your track looks out of date.',
      };
    }
    const n = Math.min(CHESS_SEASON_MAX_NODES, Math.max(0, Math.floor(Number(st.nodesCompleted) || 0)));
    if (n <= 0) {
      return { success: false, error: `No claimed steps to reset for ${utcSid}.` };
    }

    let bonusSubtract = 0;
    for (let i = 0; i < n; i++) {
      bonusSubtract += Math.max(0, Math.floor(Number(SEASON_CLAIM_NODES[i]?.bonusPoints) || 0));
    }

    const shopKeys = seasonTrackRewardShopKeysThroughStep(n);
    chess.shopUnlocks = removeSeasonShopRewardsFromChessShop(chess.shopUnlocks, shopKeys);

    const tokenSets = collectSeasonLbTokensThroughStep(n);
    const prevOwned = st.lbFlairUnlocked && typeof st.lbFlairUnlocked === 'object' ? st.lbFlairUnlocked : {};
    const newOwned = {
      frames: uniqStrings((prevOwned.frames || []).filter((f) => !tokenSets.frames.has(String(f)))),
      titles: uniqStrings((prevOwned.titles || []).filter((t) => !tokenSets.titles.has(String(t)))),
      prefixes: uniqStrings((prevOwned.prefixes || []).filter((p) => !tokenSets.prefixes.has(String(p)))),
      suffixes: uniqStrings((prevOwned.suffixes || []).filter((s) => !tokenSets.suffixes.has(String(s)))),
    };
    st.lbFlairUnlocked = newOwned;
    st.lbFlair = shrinkLbFlairEquipsToOwned(st.lbFlair, newOwned);
    st.nodesCompleted = 0;
    st.seasonId = utcSid;
    st.earnBaseline = snapshotSeasonEarnBaselineFromChess(chess);
    chess.seasonTrack = st;

    const prevSb = Math.max(0, Math.floor(Number(chess.seasonBonusPoints) || 0));
    chess.seasonBonusPoints = Math.max(0, prevSb - bonusSubtract);
    chess.lastUpdated = Date.now();

    sanitizeChessVisualSettingsAfterUnshop(chess);

    if (!userData.milestonesEmailNotified || typeof userData.milestonesEmailNotified !== 'object') {
      userData.milestonesEmailNotified = {};
    } else {
      userData.milestonesEmailNotified = { ...userData.milestonesEmailNotified };
    }
    delete userData.milestonesEmailNotified['trifangx_season_finale_' + utcSid];

    await this.storage.put('userData', userData);
    await this.syncChessCareerPointsLeaderboardEntry();

    const outChess = await this.getChessData();
    return {
      success: true,
      chess: outChess,
      resetSteps: n,
      bonusPointsRemoved: bonusSubtract,
    };
  }

  /** Equip leaderboard flair; each field must be cleared or chosen from `seasonTrack.lbFlairUnlocked`. */
  async setChessLbFlair(body) {
    const userData = await this.storage.get('userData');
    if (!userData?.games?.chess) {
      return { success: false, error: 'No chess data' };
    }
    const chess = userData.games.chess;
    if (!chess.seasonTrack || typeof chess.seasonTrack !== 'object') {
      chess.seasonTrack = {};
    }
    const st = chess.seasonTrack;
    const prevOwned = st.lbFlairUnlocked && typeof st.lbFlairUnlocked === 'object' ? st.lbFlairUnlocked : {};
    const owned = {
      frames: uniqStrings(prevOwned.frames || []),
      titles: uniqStrings(prevOwned.titles || []),
      prefixes: uniqStrings(prevOwned.prefixes || []),
      suffixes: uniqStrings(prevOwned.suffixes || []),
    };
    const prevEq = sanitizeChessLbFlair(st.lbFlair);
    const incoming = body && typeof body === 'object' ? body : {};

    const next = {
      frame: Object.prototype.hasOwnProperty.call(incoming, 'frame') ? incoming.frame : prevEq.frame,
      title: Object.prototype.hasOwnProperty.call(incoming, 'title') ? incoming.title : prevEq.title,
      prefix: Object.prototype.hasOwnProperty.call(incoming, 'prefix') ? incoming.prefix : prevEq.prefix,
      suffix: Object.prototype.hasOwnProperty.call(incoming, 'suffix') ? incoming.suffix : prevEq.suffix,
    };

    let nextFrame = next.frame;
    if (nextFrame === null || nextFrame === undefined || nextFrame === '') {
      nextFrame = null;
    } else {
      const f = String(nextFrame);
      if (!CHESS_LB_FLAIR_FRAMES.has(f) || !owned.frames.includes(f)) {
        return { success: false, error: 'Frame not unlocked' };
      }
      nextFrame = f;
    }

    let nextTitle = next.title;
    if (nextTitle === null || nextTitle === undefined || (typeof nextTitle === 'string' && !nextTitle.trim())) {
      nextTitle = null;
    } else {
      const t = String(nextTitle)
        .trim()
        .slice(0, 24)
        .replace(/[\u0000-\u001f\u007f]/g, '');
      if (!t) nextTitle = null;
      else if (!owned.titles.includes(t)) {
        return { success: false, error: 'Title not unlocked' };
      } else {
        nextTitle = t;
      }
    }

    const pRaw = next.prefix != null ? String(next.prefix) : '';
    const nextPrefix = [...pRaw].slice(0, 3).join('');
    if (nextPrefix && !owned.prefixes.includes(nextPrefix)) {
      return { success: false, error: 'Prefix not unlocked' };
    }

    const sRaw = next.suffix != null ? String(next.suffix) : '';
    const nextSuffix = [...sRaw].slice(0, 3).join('');
    if (nextSuffix && !owned.suffixes.includes(nextSuffix)) {
      return { success: false, error: 'Suffix not unlocked' };
    }

    st.lbFlair = sanitizeChessLbFlair({
      frame: nextFrame,
      title: nextTitle,
      prefix: nextPrefix,
      suffix: nextSuffix,
    });
    chess.seasonTrack = st;
    chess.lastUpdated = Date.now();
    await this.storage.put('userData', userData);
    await this.syncChessCareerPointsLeaderboardEntry();
    const outChess = await this.getChessData();
    return { success: true, lbFlair: st.lbFlair, chess: outChess };
  }

  async updateChessData(chessData) {
    const userData = await this.storage.get('userData');
    if (!userData) return;
    
    // Update chess game data
    if (!userData.games) userData.games = {};
    if (!userData.games.chess) userData.games.chess = {};

    const replaceHistory =
      chessData.replaceGameHistory === true || chessData.replaceGameHistory === 'true';
    const fullCareerResetSync =
      chessData.fullCareerResetSync === true || chessData.fullCareerResetSync === 'true';
    const restIncoming = { ...chessData };
    delete restIncoming.replaceGameHistory;
    delete restIncoming.fullCareerResetSync;

    const prevChess = userData.games.chess;
    const prevCareerScore = chessLifetimeCareerScore(
      prevChess?.stats?.lifetimeStats,
      prevChess?.stats?.playerStats
    );
    const prevSnap = chessStatsSnapshot(prevChess || {});
    const {
      stats: incomingStats,
      gameHistory: incomingHistoryIgnored,
      seasonTrack: incomingSeasonTrack,
      seasonBonusPoints: incomingSeasonBonus,
      ...restNoStats
    } = restIncoming;

    const hasIncomingSeasonTrack = Object.prototype.hasOwnProperty.call(restIncoming, 'seasonTrack');
    const hasIncomingSeasonBonus = Object.prototype.hasOwnProperty.call(restIncoming, 'seasonBonusPoints');

    let mergedHistory;
    if (replaceHistory && Array.isArray(restIncoming.gameHistory)) {
      mergedHistory = trimChessGameHistoryMerged(restIncoming.gameHistory);
    } else if (Array.isArray(restIncoming.gameHistory)) {
      mergedHistory = mergeChessGameHistoryForSync(prevChess.gameHistory, restIncoming.gameHistory);
    } else {
      mergedHistory = mergeChessGameHistoryForSync(prevChess.gameHistory, []);
    }

    if (fullCareerResetSync && prevCareerScore > 40) {
      appendChessCareerBackup(userData.games.chess, snapshotChessCareerStatsBackup(prevChess));
    }

    const mergedStats = mergeChessStatsForSync(prevChess.stats, incomingStats, fullCareerResetSync);
    const mergedSeason = fullCareerResetSync
      ? {
          seasonBonusPoints: 0,
          seasonTrack: {
            seasonId: utcChessSeasonIdNow(),
            nodesCompleted: 0,
            lbFlair: { frame: null, title: null, prefix: '', suffix: '' },
            lbFlairUnlocked: { frames: [], titles: [], prefixes: [], suffixes: [] },
            earnBaseline: {
              games: 0,
              wins: 0,
              castlingMoves: 0,
              promotions: 0,
              capturedRooks: 0,
              checkmateWithQueen: 0,
              knightToF3: 0,
              bishopToF4: 0,
              enPassants: 0,
              capturesByQueen: 0,
              totalCaptures: 0,
              checkmateWithRook: 0,
            },
          },
        }
      : mergeChessSeasonFieldsForSync(
          prevChess,
          hasIncomingSeasonTrack ? incomingSeasonTrack : undefined,
          hasIncomingSeasonBonus ? incomingSeasonBonus : undefined
        );

    const mergedChess = {
      ...prevChess,
      ...restNoStats,
      stats: mergedStats,
      gameHistory: mergedHistory,
      seasonTrack: mergedSeason.seasonTrack,
      seasonBonusPoints: mergedSeason.seasonBonusPoints,
      lastUpdated: Date.now(),
    };
    if (Object.prototype.hasOwnProperty.call(restIncoming, 'shopUnlocks')) {
      mergedChess.shopUnlocks = fullCareerResetSync
        ? mergeShopUnlocksForSync({}, restIncoming.shopUnlocks)
        : mergeShopUnlocksForSync(prevChess.shopUnlocks, restIncoming.shopUnlocks);
    }
    mergedChess.shopUnlocks = ensureChessShopUnlockBasics(mergedChess.shopUnlocks || {});
    delete mergedChess.lbWeekUtc;
    delete mergedChess.lbWeekBaseline;
    delete mergedChess.lbRollBaselineMs;
    delete mergedChess.lbRollBaselineStats;

    const nextCareerScore = chessLifetimeCareerScore(
      mergedChess.stats?.lifetimeStats,
      mergedChess.stats?.playerStats
    );
    if (!fullCareerResetSync && prevCareerScore > 80 && nextCareerScore < prevCareerScore * 0.5) {
      appendChessCareerBackup(mergedChess, snapshotChessCareerStatsBackup(prevChess));
    }

    userData.games.chess = mergedChess;

    const repairResult = repairChessCareerStatsInPlace(userData.games.chess);
    if (repairResult.repaired) {
      console.log('Repaired chess career stats from', repairResult.source);
    }

    await this.storage.put('userData', userData);

    const nextSnap = chessStatsSnapshot(userData.games.chess);
    await persistAndSendChessMilestones(this.env, this.storage, userData, prevSnap, nextSnap);
    await maybeSendSeasonTrackFinaleEmail(this.env, this.storage, userData, prevChess, mergedChess);
    await this.syncChessCareerPointsLeaderboardEntry();
  }

  /** Pushes career achievement points + username to public leaderboard KV (if bound). */
  async syncChessCareerPointsLeaderboardEntry() {
    const kv = this.env.CHESS_LEADERBOARD_KV;
    if (!kv) return;
    const userData = await this.storage.get('userData');
    if (!userData) return;
    const userId = this.state.id.toString();
    const points = Math.max(0, Math.floor(Number(userData.games?.chess?.points) || 0));
    const sb = Math.max(0, Math.floor(Number(userData.games?.chess?.seasonBonusPoints) || 0));
    await upsertChessLeaderboardEntry(kv, userId, userData.username, points + sb);
  }

  async getChessData() {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.chess) {
      // Return default chess data
      return {
        achievements: {},
        points: 0,
        shopUnlocks: {
          boards: ['classic'],
          pieces: ['classic'],
          highlightColors: ['red'],
          arrowColors: ['red'],
          legalMoveDots: ['gray-circle'],
          themes: ['light'],
          checkmateEffects: [],
          timeControls: ['none'],
          leaderboardRowColors: [],
        },
        settings: {
          boardStyle: 'classic',
          pieceStyle: 'classic',
          highlightColor: 'red',
          arrowColor: 'red',
          legalMoveDotStyle: 'gray-circle',
          pageTheme: 'light'
        },
        stats: {
          playerStats: { wins: 0, losses: 0, draws: 0 },
          lifetimeStats: {}
        }
      };
    }
    
    const c = userData.games.chess;
    const repairResult = repairChessCareerStatsInPlace(c);
    if (repairResult.repaired) {
      userData.games.chess = c;
      await this.storage.put('userData', userData);
      console.log('Auto-repaired chess career stats on load from', repairResult.source);
    }
    return {
      ...c,
      shopUnlocks: ensureChessShopUnlockBasics(c.shopUnlocks || {}),
    };
  }

  async getDungeonSlots() {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.dungeon) {
      return {
        slot1: null,
        slot2: null,
        slot3: null,
        lastPlayedSlot: null
      };
    }
    
    return userData.games.dungeon.saveSlots;
  }

  async saveDungeonSlot(slot, data, name) {
    const userData = await this.storage.get('userData');
    if (!userData) return;
    
    if (!userData.games) userData.games = {};
    if (!userData.games.dungeon) {
      userData.games.dungeon = {
        saveSlots: { slot1: null, slot2: null, slot3: null },
        lastPlayedSlot: null
      };
    }
    
    userData.games.dungeon.saveSlots[slot] = {
      name: name || `Save ${slot.replace('slot', '')}`,
      data: data,
      savedAt: Date.now()
    };
    userData.games.dungeon.lastPlayedSlot = slot;
    
    await this.storage.put('userData', userData);
  }

  async loadDungeonSlot(slot) {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.dungeon) {
      return null;
    }
    
    return userData.games.dungeon.saveSlots[slot];
  }

  async deleteDungeonSlot(slot) {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.dungeon) return;
    
    userData.games.dungeon.saveSlots[slot] = null;
    await this.storage.put('userData', userData);
  }

  async updateClassifyData(classifyData) {
    const userData = await this.storage.get('userData');
    if (!userData) return;

    if (!userData.games) userData.games = {};
    if (!userData.games.classify) {
      userData.games.classify = {
        tasks: [],
        blockedTimes: [],
        scheduleRules: null,
        vacations: [],
        repeatSkips: {},
        subjectColors: {},
        calendarViewMode: 'month',
        darkMode: null
      };
    }

    userData.games.classify = {
      ...userData.games.classify,
      ...classifyData,
      lastUpdated: Date.now()
    };
    await this.storage.put('userData', userData);
  }

  async getClassifyData() {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.classify) {
      return {
        tasks: [],
        blockedTimes: [],
        scheduleRules: null,
        vacations: [],
        repeatSkips: {},
        subjectColors: {},
        calendarViewMode: 'month',
        darkMode: null
      };
    }
    return userData.games.classify;
  }

  async updateKyrachyngProgress(completed) {
    const userData = await this.storage.get('userData');
    if (!userData) return;

    if (!userData.games) userData.games = {};
    if (!userData.games.kyrachyng) {
      userData.games.kyrachyng = { lessonsCompleted: [] };
    }

    userData.games.kyrachyng.lessonsCompleted = Array.isArray(completed)
      ? completed.filter(x => typeof x === 'string')
      : [];
    userData.games.kyrachyng.lastUpdated = Date.now();
    await this.storage.put('userData', userData);
  }

  async getKyrachyngProgress() {
    const userData = await this.storage.get('userData');
    if (!userData || !userData.games || !userData.games.kyrachyng) {
      return { lessonsCompleted: [] };
    }
    return {
      lessonsCompleted: Array.isArray(userData.games.kyrachyng.lessonsCompleted)
        ? userData.games.kyrachyng.lessonsCompleted
        : []
    };
  }

}

// Durable Object: Session
export class Session {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (path === '/create' && request.method === 'POST') {
      const { userId } = await request.json();
      await this.create(userId);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path === '/getUserId' && request.method === 'GET') {
      const userId = await this.getUserId();
      return new Response(JSON.stringify({ userId }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path === '/destroy' && request.method === 'POST') {
      await this.destroy();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Session DO', { status: 200 });
  }

  async create(userId) {
    await this.storage.put('userId', userId);
    await this.storage.put('createdAt', Date.now());
    // Sessions expire after 30 days
    await this.storage.put('expiresAt', Date.now() + (30 * 24 * 60 * 60 * 1000));
  }

  async getUserId() {
    const expiresAt = await this.storage.get('expiresAt');
    if (!expiresAt || Date.now() > expiresAt) {
      await this.storage.deleteAll();
      return null;
    }
    
    // Extend session on every use (rolling 30-day expiration)
    await this.storage.put('expiresAt', Date.now() + (30 * 24 * 60 * 60 * 1000));
    
    return await this.storage.get('userId');
  }

  async destroy() {
    await this.storage.deleteAll();
  }
}

// Durable Object: UsernameRegistry
export class UsernameRegistry {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/reserve' && request.method === 'POST') {
      const { username, userId } = await request.json();
      const result = await this.reserve(username, userId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.status || 400),
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path === '/resolve' && request.method === 'POST') {
      const { username } = await request.json();
      const result = await this.resolve(username);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.status || 404),
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path === '/release' && request.method === 'POST') {
      const { username, userId } = await request.json();
      const result = await this.release(username, userId);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : (result.status || 400),
        headers: { 'Content-Type': 'application/json' }
      });
    } else if (path === '/listUserIdsPage' && request.method === 'POST') {
      try {
        let body = {};
        try {
          const raw = await request.text();
          if (raw && String(raw).trim()) body = JSON.parse(raw);
        } catch {
          body = {};
        }
        const limit = Math.min(100, Math.max(1, parseInt(String(body.limit || 35), 10) || 35));
        const startAfter =
          typeof body.startAfter === 'string' && body.startAfter.trim() ? body.startAfter.trim() : undefined;
        const listOpts = { prefix: 'username:', limit };
        if (startAfter) listOpts.startAfter = startAfter;
        const map = await this.storage.list(listOpts);
        const userIds = [];
        let lastKey = null;
        let count = 0;
        for (const [key, val] of map) {
          count++;
          lastKey = key;
          if (val && typeof val === 'object' && val.userId) userIds.push(String(val.userId));
        }
        const nextListCursor = count === limit && lastKey != null ? lastKey : null;
        return new Response(JSON.stringify({ userIds, nextListCursor }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e?.message || String(e), userIds: [], nextListCursor: null }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response('UsernameRegistry DO', { status: 200 });
  }

  async reserve(username, userId) {
    const key = normalizeUsernameForIndex(username);
    if (!key || !userId) {
      return { success: false, error: 'Missing username or userId', status: 400 };
    }

    const storageKey = `username:${key}`;
    const existing = await this.storage.get(storageKey);
    if (existing && existing.userId && existing.userId !== userId) {
      return { success: false, error: 'Username is already taken', status: 409 };
    }

    await this.storage.put(storageKey, { userId, username: key, updatedAt: Date.now() });
    return { success: true };
  }

  async resolve(username) {
    const key = normalizeUsernameForIndex(username);
    if (!key) {
      return { success: false, error: 'Missing username', status: 400 };
    }

    const storageKey = `username:${key}`;
    const existing = await this.storage.get(storageKey);
    if (!existing || !existing.userId) {
      return { success: false, error: 'Username not found', status: 404 };
    }
    return { success: true, userId: existing.userId };
  }

  async release(username, userId) {
    const key = normalizeUsernameForIndex(username);
    if (!key) {
      return { success: false, error: 'Missing username', status: 400 };
    }

    const storageKey = `username:${key}`;
    const existing = await this.storage.get(storageKey);
    if (!existing) {
      return { success: true };
    }
    if (userId && existing.userId && existing.userId !== userId) {
      return { success: false, error: 'Username is owned by a different account', status: 409 };
    }

    await this.storage.delete(storageKey);
    return { success: true };
  }
}
