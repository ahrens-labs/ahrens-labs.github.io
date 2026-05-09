// Cloudflare Workers entry point for Chess Engine Accounts

import {
  utcDateString,
  getDailyChallengeIdsForUtcDate,
  DAILY_CHALLENGE_DIGEST_BLURBS,
  DAILY_CHALLENGE_CARD_INFO,
} from './daily-challenge-picker.js';
import { DISPOSABLE_EMAIL_DOMAINS } from './disposable-email-domains.js';

/** Default when user has not picked a timezone (US Central). */
const DEFAULT_DIGEST_TIMEZONE = 'America/Chicago';

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
      } else if (path === '/api/change-username' && request.method === 'POST') {
        return handleChangeUsername(request, env, corsHeaders);
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
      } else if (path === '/api/chess/sync' && request.method === 'POST') {
        return handleChessSync(request, env, corsHeaders);
      } else if (path === '/api/chess/load' && request.method === 'GET') {
        return handleChessLoad(request, env, corsHeaders);
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

  async scheduled(event, env) {
    return handleScheduledCron(event, env);
  },
};

// Signup handler
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

  if (!isLikelyRealEmail(normalizedEmail)) {
    return new Response(JSON.stringify({ error: 'Please use a real email address' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const signupDomain = normalizedEmail.slice(normalizedEmail.indexOf('@') + 1);
  const domainOk = await verifySignupEmailDomain(signupDomain);
  if (!domainOk) {
    return new Response(
      JSON.stringify({
        error:
          'That email domain is not set up to receive mail (no working mail servers / MX records). Use a real inbox (Gmail, iCloud, Outlook, your school/work, etc.).',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get user account DO
  const userId = generateUserId(normalizedEmail);
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

  const prefs = row.emailPreferences && typeof row.emailPreferences === 'object' ? row.emailPreferences : {};
  let tz =
    typeof prefs.digestTimeZone === 'string' && prefs.digestTimeZone.trim()
      ? prefs.digestTimeZone.trim()
      : DEFAULT_DIGEST_TIMEZONE;
  if (!isValidIanaTimeZone(tz)) tz = DEFAULT_DIGEST_TIMEZONE;

  const now = new Date();
  const utcDateStr = utcDateString(now);
  const ids = getDailyChallengeIdsForUtcDate(utcDateStr);

  try {
    await sendDailyDigestEmail(
      env,
      { email, username },
      utcDateStr,
      ids,
      tz,
      { instant: true }
    );
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
      utcDate: utcDateStr,
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

  if (env.DAILY_DIGEST_KV) {
    try {
      await env.DAILY_DIGEST_KV.delete(`sub:${userResult.userId}`);
    } catch (e) {
      console.error('delete digest KV key failed', e?.message || e);
    }
  }

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

  if (usernameForRelease) {
    const usernameRegistryId = env.USERNAME_REGISTRY.idFromName('global');
    const usernameRegistry = env.USERNAME_REGISTRY.get(usernameRegistryId);
    const releaseUsernameReq = new Request('http://do/release', {
      method: 'POST',
      body: JSON.stringify({ username: usernameForRelease, userId: userResult.userId }),
    });
    await usernameRegistry.fetch(releaseUsernameReq);
  }

  const destroyReq = new Request('http://do/destroy', { method: 'POST' });
  await session.fetch(destroyReq);

  return new Response(JSON.stringify({ success: true }), {
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
  const tzRaw = body.digestTimeZone != null ? String(body.digestTimeZone).trim() : '';
  const hasTz = tzRaw !== '';

  if (!hasEmails && !hasTz) {
    return new Response(
      JSON.stringify({ error: 'Send dailyChallengeEmails and/or digestTimeZone (IANA, e.g. America/Chicago)' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (hasTz && !isValidIanaTimeZone(tzRaw)) {
    return new Response(JSON.stringify({ error: 'Invalid digestTimeZone — use an IANA name like America/Chicago' }), {
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

  const setPayload = {};
  if (hasEmails) setPayload.dailyChallengeEmails = body.dailyChallengeEmails;
  if (hasTz) setPayload.digestTimeZone = tzRaw;

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
  const digestTz = prefs.digestTimeZone || DEFAULT_DIGEST_TIMEZONE;

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
            digestTimeZone: digestTz,
            lastDigestLocalYmd:
              prev && typeof prev === 'object' && typeof prev.lastDigestLocalYmd === 'string'
                ? prev.lastDigestLocalYmd
                : undefined,
          })
        );
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

  return new Response(
    JSON.stringify({
      success: true,
      emailPreferences: prefs,
      ...(warning ? { warning } : {}),
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
  }).formatToParts(date);
  const h = parts.find((p) => p.type === 'hour');
  return h ? parseInt(h.value, 10) : 0;
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
  };
}

/** Resolve a stub from a DurableObjectNamespace.list() entry (prefers name when present). */
function userAccountStubFromListEntry(env, obj) {
  if (!obj || typeof obj !== 'object') return null;
  const name = obj.name != null ? String(obj.name).trim() : '';
  if (name && typeof env.USER_ACCOUNT.getByName === 'function') {
    try {
      return env.USER_ACCOUNT.getByName(name);
    } catch {
      /* fall through to id */
    }
  }
  if (obj.id != null) {
    try {
      return env.USER_ACCOUNT.get(obj.id);
    } catch {
      return null;
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
      const objects = Array.isArray(listResult.objects) ? listResult.objects : [];
      const stubs = [];
      for (const obj of objects) {
        const st = userAccountStubFromListEntry(env, obj);
        if (st) stubs.push(st);
      }
      return { stubs, nextListCursor: listResult.cursor || null, listError: null };
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
      stubs.push(env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(uid)));
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

  // Send preview first so a sample reaches the admin even if listing many accounts is slow or hits limits.
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

/** Cursor for admin account directory: union of DO list, username registry, and digest KV `sub:` keys. */
function parseAdminAccountListCursor(raw) {
  const fresh = () => ({
    v: 2,
    do: { done: false, cursor: null },
    reg: { done: false, cursor: null },
    kv: { done: false, cursor: null },
  });
  if (!raw || !String(raw).trim()) return fresh();
  const s = String(raw).trim();
  try {
    const j = JSON.parse(s);
    if (j && j.v === 2 && j.do && j.reg && j.kv) return j;
  } catch {
    /* legacy: opaque DO list cursor from older deploys */
  }
  return {
    v: 2,
    do: { done: false, cursor: s },
    reg: { done: false, cursor: null },
    kv: { done: false, cursor: null },
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

  function pushStub(st) {
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
    stubs.push(st);
  }

  try {
    while (stubs.length < pageSize) {
      const need = pageSize - stubs.length;

      if (!state.do.done && typeof env.USER_ACCOUNT.list === 'function') {
        const listResult = await env.USER_ACCOUNT.list({
          limit: need,
          ...(state.do.cursor ? { cursor: state.do.cursor } : {}),
        });
        const objects = Array.isArray(listResult.objects) ? listResult.objects : [];
        for (const obj of objects) {
          if (stubs.length >= pageSize) break;
          pushStub(userAccountStubFromListEntry(env, obj));
        }
        state.do.cursor = listResult.cursor || null;
        if (!listResult.cursor) state.do.done = true;
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
          pushStub(env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(String(uid))));
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
          pushStub(env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(uid)));
        }
        if (listKv.list_complete) {
          state.kv.done = true;
          state.kv.cursor = null;
        } else {
          state.kv.cursor = listKv.cursor || null;
        }
        continue;
      }

      state.kv.done = true;
      break;
    }

    const allDone = state.do.done && state.reg.done && state.kv.done;
    const nextListCursor = allDone ? null : JSON.stringify(state);
    return { stubs, nextListCursor, listError: null };
  } catch (e) {
    return { stubs: [], nextListCursor: null, listError: e };
  }
}

/**
 * Admin: page through all user accounts (same enumeration as broadcast) and return directory fields only.
 * Response rows omit passwords, tokens, and game payloads — only userId, username, email, emailVerified.
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

  const accounts = [];
  let skippedMissingData = 0;

  for (const stub of stubs) {
    if (!stub) {
      skippedMissingData++;
      continue;
    }
    let row;
    try {
      const dataRes = await stub.fetch(new Request('http://do/getData', { method: 'GET' }));
      row = await dataRes.json();
    } catch {
      skippedMissingData++;
      continue;
    }
    if (!row || typeof row !== 'object') {
      skippedMissingData++;
      continue;
    }

    const emailRaw = row.email != null ? String(row.email) : '';
    const emailNorm = emailRaw ? normalizeEmail(emailRaw) : '';
    let ev = null;
    if (row.emailVerified === true) ev = true;
    else if (row.emailVerified === false) ev = false;

    accounts.push({
      userId: row.userId != null ? String(row.userId) : '',
      username: row.username != null ? String(row.username) : '',
      email: emailNorm,
      emailVerified: ev,
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      accounts,
      nextListCursor: nextCursor || null,
      hasMore: Boolean(nextCursor),
      pageStubCount: stubs.length,
      skippedMissingData,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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

  const userIdRaw = body.userId != null ? String(body.userId).trim() : '';
  const emailRaw = body.email != null ? String(body.email).trim() : '';
  let userId = userIdRaw;
  if (!userId && emailRaw) {
    userId = generateUserId(normalizeEmail(emailRaw));
  }
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Provide userId or email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userAccount = env.USER_ACCOUNT.get(env.USER_ACCOUNT.idFromName(userId));
  let result;
  try {
    const doRes = await userAccount.fetch(
      new Request('http://do/adminForceVerifyEmail', { method: 'POST', body: '{}' })
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

function buildVerificationUrl(env, email, token) {
  const base = (env.VERIFICATION_LINK_BASE || 'https://ahrens-labs.github.io').replace(/\/$/, '');
  const path = env.VERIFICATION_LANDING_PATH || '/account.html';
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const q = new URLSearchParams({ verify: token, email });
  return `${base}${pathWithLeadingSlash}?${q.toString()}`;
}

async function sendVerificationEmail(env, email, username, token) {
  const verificationUrl = buildVerificationUrl(env, email, token);
  const safeName = String(username).replace(/[<>]/g, '');
  const subject = 'Confirm your Ahrens Labs account';
  const html = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Welcome to Ahrens Labs!</h2>
            <p>Hi ${safeName},</p>
            <p>Thanks for creating an account. <strong>Confirm your email address</strong> using the button below — you can sign in only after you confirm.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}"
                 style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Confirm email address
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #7f8c8d; word-break: break-all;">${verificationUrl}</p>
            <p style="margin-top: 30px; color: #7f8c8d; font-size: 0.9em;">
              If you did not create this account, you can ignore this email.
            </p>
          </body>
        </html>
      `;
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

function sitePublicBase(env) {
  return (env.VERIFICATION_LINK_BASE || 'https://ahrens-labs.github.io').replace(/\/$/, '');
}

/** Links in product/marketing emails (welcome, challenge emails). Defaults to ahrenslabs.com. */
function siteMarketingBase(env) {
  return String(env.PUBLIC_SITE_BASE || 'https://ahrenslabs.com').replace(/\/$/, '');
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

async function persistAndSendChessMilestones(env, storage, userData, prevSnap, nextSnap) {
  const email = normalizeEmail(userData.email || '');
  if (!email || !isLikelyRealEmail(email)) return;
  if (userData.emailVerified === false) return;

  if (!userData.milestonesEmailNotified || typeof userData.milestonesEmailNotified !== 'object') {
    userData.milestonesEmailNotified = {};
  }
  const notified = userData.milestonesEmailNotified;
  const safeName = String(userData.username || 'there').replace(/[<>]/g, '');
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
      await tryOne(
        key,
        `Chess milestone: ${t} career wins`,
        `<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Nice work, ${safeName}!</h2>
          <p>You reached <strong>${t} wins</strong> in the Ahrens Labs chess engine.</p>
          <p>Total record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D — ${nextSnap.points.toLocaleString()} points.</p>
          <p><a href="${chessUrl}" style="color: #3498db;">Open the chess engine</a></p>
        </body></html>`,
        [
          `Hi ${safeName},`,
          '',
          `You reached ${t} career wins in the Ahrens Labs chess engine.`,
          `Record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D, ${nextSnap.points} points.`,
          `Play: ${chessUrl}`,
        ].join('\n')
      );
    }
  }

  for (const t of CHESS_MILESTONE_GAME_THRESHOLDS) {
    if (prevSnap.games < t && nextSnap.games >= t) {
      const key = `chess_games_${t}`;
      await tryOne(
        key,
        `Chess milestone: ${t} games played`,
        `<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Milestone: ${t} games</h2>
          <p>Hi ${safeName}, you have played <strong>${t} games</strong> against the engine.</p>
          <p>Record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D — ${nextSnap.points.toLocaleString()} points.</p>
          <p><a href="${chessUrl}" style="color: #3498db;">Keep playing</a></p>
        </body></html>`,
        [
          `Hi ${safeName},`,
          '',
          `You reached ${t} games played against the chess engine.`,
          `Record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D, ${nextSnap.points} points.`,
          chessUrl,
        ].join('\n')
      );
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
        await tryOne(
          key,
          `Chess milestone: ${t.toLocaleString()} points`,
          `<html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">${t.toLocaleString()} points</h2>
          <p>Hi ${safeName}, you crossed <strong>${t.toLocaleString()} career points</strong> in the chess engine.</p>
          <p>Record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D.</p>
          <p><a href="${chessUrl}" style="color: #3498db;">Open the chess engine</a></p>
        </body></html>`,
          [
            `Hi ${safeName},`,
            '',
            `You reached ${t} career points in the chess engine.`,
            `Record: ${nextSnap.wins}W / ${nextSnap.losses}L / ${nextSnap.draws}D.`,
            chessUrl,
          ].join('\n')
        );
      }
    }
  }
  if (pointMilestoneNotifiedDirty) {
    await storage.put('userData', userData);
  }
}

/**
 * @param {object} [sendOptions] Optional overrides for admin preview (same From as broadcast so Cloudflare allowlists match).
 * @param {string} [sendOptions.fromAddr]
 * @param {string} [sendOptions.fromName]
 */
async function sendWelcomeGuideEmail(env, email, username, sendOptions = {}) {
  const safeName = String(username).replace(/[<>]/g, '');
  const base = siteMarketingBase(env);
  const subject = 'Welcome to Ahrens Labs — your hub for TrifangX, labs & more';
  const preheader =
    'Dice dungeons, chess with daily quests, a cloud-synced planner, language lessons, and more — one free account, every device.';
  const chessUrl = `${base}/chess_engine.html`;
  const dashUrl = `${base}/account-dashboard.html`;
  const labsUrl = `${base}/labs.html`;
  const classifyUrl = `${base}/classify.html`;
  const dungeonUrl = `${base}/dungeon_game.html`;
  const kyrachyngUrl = `${base}/kyrachyng-lessons.html`;
  const homeUrl = `${base}/`;
  const emailInnerMax = '720px';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#e8eef4;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e8eef4;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:${emailInnerMax};width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.12);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1d4ed8 100%);padding:28px 32px;text-align:center;">
              <p style="margin:0 0 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#f8fafc;letter-spacing:0.02em;">Ahrens Labs</p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:14px;color:#c7d2fe;line-height:1.5;">Games, tools & learning — one sign-in everywhere</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#0f172a;">Hi ${safeName},</p>
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
                    <p style="margin:0;font-size:14px;line-height:1.55;color:#475569;">Our flagship chess experience: spar with a strong engine, unlock <strong>hundreds of achievements</strong>, spend points in a <strong>cosmetic shop</strong> (boards, pieces, themes, effects), and chase <strong>three rotating daily challenges</strong> every UTC day — the same puzzles for everyone worldwide. From your account dashboard you can turn on the <strong>daily TrifangX challenge roundup</strong> (email at midnight in your chosen time zone) or fire off <strong>today’s three challenge IDs</strong> on demand. Optional live-engine play and blindfold modes when you want to go deeper.</p>
                    <p style="margin:10px 0 0 0;font-size:14px;"><a href="${chessUrl}" style="color:#2563eb;font-weight:600;">Open the chess lobby</a></p>
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
              <p style="margin:28px 0 10px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">More detail — what an account actually does</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">TrifangX (chess engine)</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Progress &amp; cloud save</strong> — wins, losses, draws, and rating-style summaries stay on your profile. Deep <strong>lifetime stats</strong> track captures, openings, streaks, and long-horizon goals so you can see how your style evolves over hundreds of games.</li>
                      <li style="margin:0 0 8px 0;"><strong>Achievements &amp; points</strong> — a large catalog of goals spanning tactics, speed, material, blindfold milestones, time controls, and quirky feats. Points feed your sidebar <strong>Total Points</strong> and unlock rarer achievements—giving both casual and grind-minded players something to chase.</li>
                      <li style="margin:0 0 8px 0;"><strong>Shop &amp; cosmetics</strong> — spend earned points on boards, piece sets, highlight and arrow colors, page themes, move/checkmate flair, and extra time controls. Everything you buy is stored server-side so it follows you across machines.</li>
                      <li style="margin:0 0 8px 0;"><strong>Daily challenges &amp; roundup email</strong> — every <strong>UTC calendar day</strong> the world shares the same three rotating achievements (listed in-game). Opt in to the <strong>daily TrifangX challenge roundup</strong> so those IDs land in your inbox at the start of each calendar day in your dashboard time zone, or tap <strong>email today’s challenges now</strong> when you don’t want to wait. They’re designed to nudge your playstyle and stack extra rewards on top of the main catalog.</li>
                      <li style="margin:0 0 8px 0;"><strong>Board tools</strong> — legal-move hints, custom arrows and square highlights, premove queues, and optional blindfold/mental-board modes for serious training—or just a change of pace.</li>
                      <li style="margin:0 0 8px 0;"><strong>Game history &amp; replay</strong> — keep recent games in the cloud (within fair-use limits), reopen them on the board, and step through move-by-move when you want to learn from a win or loss.</li>
                      <li style="margin:0;"><strong>Modes &amp; match types</strong> — casual unrated engine sparring, clocked games with increments, and optional live-engine sessions from the lobby when available.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 10px 0;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Deep dive — dungeon, planner, language &amp; labs</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Dungeon game</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Exploration loop</strong> — move through a dungeon where rooms can surprise you with fights, loot, merchants, or hazards; dice rolls keep outcomes readable but tense.</li>
                      <li style="margin:0 0 8px 0;"><strong>Combat depth</strong> — choose attack lanes, defensive responses, and items; retreat is a real option when health is low. Inventory and equipment matter for how fights feel.</li>
                      <li style="margin:0 0 8px 0;"><strong>Meta progression</strong> — achievements and stats reward repeated play; multiple <strong>save slots</strong> let you experiment with different routes without wiping a main run.</li>
                      <li style="margin:0;"><strong>Cloud saves</strong> — slot data lives on your Ahrens Labs profile, so switching computers or browsers doesn’t erase hours of progress.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Classify planner</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Semester clarity</strong> — model courses, weekly blocks, and recurring commitments so you see conflicts before they happen.</li>
                      <li style="margin:0 0 8px 0;"><strong>Designed for students</strong> — tuned for the way real terms behave: intense midterms, project crunches, and shifting office hours—not just a generic calendar grid.</li>
                      <li style="margin:0 0 8px 0;"><strong>Cloud backup</strong> — signed-in users sync planner data to the server; recover your layout after a reinstall or device change.</li>
                      <li style="margin:0;"><strong>Pair with chess &amp; games</strong> — keep academics organized in Classify, then reward study breaks in TrifangX or the dungeon without juggling separate accounts.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Kyrachyng lessons</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Structured path</strong> — lessons build on each other; completion gates keep the course coherent instead of a random grab bag of pages.</li>
                      <li style="margin:0 0 8px 0;"><strong>Reading &amp; writing</strong> — practice both recognition and production so the language sticks—not just passive reading.</li>
                      <li style="margin:0 0 8px 0;"><strong>Account progress</strong> — your “lit trail” of finished lessons is stored per user; resume on any device without losing your place.</li>
                      <li style="margin:0;"><strong>For curious learners</strong> — ideal if you like conlangs, puzzles, or short daily study rituals alongside heavier games.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Labs hub</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Discovery surface</strong> — browse cards for each public experiment with clear entry points instead of hunting through the whole site.</li>
                      <li style="margin:0 0 8px 0;"><strong>Mix of depths</strong> — some labs are five-minute toys; others are tools you can return to for weeks.</li>
                      <li style="margin:0 0 8px 0;"><strong>Cross-domain</strong> — expect language, audio, code, robotics-adjacent demos, creative writing helpers, and occasional humor projects.</li>
                      <li style="margin:0;"><strong>Account-aware where it helps</strong> — when a lab needs persistence, it can use the same login you already created—no new signup friction.</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="padding:16px 18px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
                    <p style="margin:0 0 10px 0;font-size:15px;font-weight:700;color:#0f172a;">Account dashboard &amp; security</p>
                    <ul style="margin:0;padding:0 0 0 18px;font-size:14px;line-height:1.65;color:#475569;">
                      <li style="margin:0 0 8px 0;"><strong>Profile &amp; credentials</strong> — change <strong>password</strong> or <strong>username</strong> (username changes require your password), and see at a glance who you’re signed in as.</li>
                      <li style="margin:0 0 8px 0;"><strong>Email controls</strong> — choose your <strong>time zone for the daily email</strong>, turn on the <strong>daily TrifangX challenge roundup</strong>, <strong>resend this welcome guide</strong>, or send <strong>today’s three challenges now</strong> without waiting for midnight.</li>
                      <li style="margin:0 0 8px 0;"><strong>TrifangX shortcuts</strong> — launch the in-browser <strong>shop, settings, or achievements</strong> overlay from the dashboard; when you close a modal, your <strong>achievement point total</strong> refreshes from the cloud.</li>
                      <li style="margin:0;"><strong>Data removal</strong> — start <strong>account deletion</strong> when you want chess, dungeon, Classify, Kyrachyng, and other cloud data wiped; you’ll receive a confirmation email when the process finishes.</li>
                    </ul>
                    <p style="margin:12px 0 0 0;font-size:14px;line-height:1.55;color:#475569;">Everything above uses the <strong>same email and password</strong> you just created — no extra accounts per product.</p>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;padding:16px;background:#eff6ff;border-radius:12px;font-size:14px;line-height:1.6;color:#1e3a8a;border-left:4px solid #2563eb;"><strong>Email from us:</strong> you’ll get a separate message to <strong>confirm your address</strong>. We’ll also mail you for account security (e.g. password resets). Optional: <strong>daily TrifangX challenge roundup</strong> and occasional chess milestone notes — turn those on anytime in <a href="${dashUrl}" style="color:#1d4ed8;font-weight:600;">your account dashboard</a>.</p>
              <p style="margin:24px 0 0 0;font-size:15px;line-height:1.65;color:#334155;">Questions, ideas, or bug reports? <strong>All feedback can and should</strong> be sent to <a href="mailto:caleb@ahrenslabs.com" style="color:#2563eb;font-weight:600;">caleb@ahrenslabs.com</a>.</p>
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
    preheader,
    '',
    '--- TrifangX (chess) ---',
    `Play: ${chessUrl}`,
    'Flagship chess vs a strong engine with full cloud save: wins/losses/draws, deep lifetime stats (captures, openings, streaks), hundreds of achievements, and a points shop for boards, piece sets, highlights, arrows, themes, checkmate effects, and time controls.',
    'Three UTC daily challenges (same trio for every player worldwide). Optional daily TrifangX challenge roundup email (midnight in your dashboard time zone) plus one-tap “email today’s challenges now” without waiting for the digest. Board tools include legal-move hints, arrows, premoves, blindfold/mental board, optional live-engine play from the lobby, and cloud game history with replay when enabled.',
    '',
    '--- Dungeon ---',
    `Play: ${dungeonUrl}`,
    'Dice-driven dungeon crawl: rooms can be combat, loot, shops, or hazards. Tactical fights use attack lanes, defense, items, and retreat rolls; gear and inventory matter. Achievements and multiple cloud save slots let you juggle runs without losing progress when you switch devices.',
    '',
    '--- Classify (planner) ---',
    `Open: ${classifyUrl}`,
    'Advanced class planner for real semesters: courses, weekly blocks, deadlines, and term rhythm in one workspace. Cloud sync when signed in so you do not rebuild your schedule after a reinstall or new laptop.',
    '',
    '--- Kyrachyng ---',
    `Lessons: ${kyrachyngUrl}`,
    'Constructed-language course with a gated lesson path: reading, writing, grammar, and vocabulary build on each other; mark lessons complete to unlock the next. Progress is stored on your account for mobile or desktop study sessions.',
    '',
    '--- Labs ---',
    `Browse: ${labsUrl}`,
    'Project gallery for experiments: language toys, music tools, coding sandboxes, writing helpers, STEM demos, and prototypes—quick toys and deeper tools; some use your account for saves, others are instant in the browser.',
    '',
    '--- Account dashboard ---',
    `Open: ${dashUrl}`,
    'Change password or username, set time zone and toggles for the daily TrifangX challenge roundup, resend this welcome guide, trigger on-demand “today’s challenges” emails, open TrifangX shop/settings/achievements in-page (points refresh when modals close), and start account deletion with email confirmation.',
    '',
    'You will receive a separate email to confirm your address. Optional daily TrifangX challenge roundup and chess milestone mail can be adjusted in dashboard settings.',
    '',
    'All feedback can and should be sent to caleb@ahrenslabs.com.',
    '',
    'If you did not sign up, ignore this message.',
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
  const base = sitePublicBase(env);
  const subject = 'Your Ahrens Labs account was deleted';
  const html = `
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50;">Account removed</h2>
        <p>Hi ${safeName},</p>
        <p>This confirms that your <strong>Ahrens Labs</strong> account and its cloud data have been permanently deleted as you requested.</p>
        <p>If you did not ask for this, contact support through the site and consider securing your email inbox.</p>
        <p style="margin-top: 24px;"><a href="${base}/" style="color: #3498db;">ahrens-labs.github.io</a></p>
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
      ? `<div style="font-size:14.4px;color:#f39c12;font-weight:700;margin-top:8px;font-family:Inter,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;">${c.points} points</div>`
      : '';
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:2px solid #e9ecef;border-radius:12px;background:#ffffff;overflow:hidden;">
<tr><td style="padding:18px 22px;font-family:Inter,Segoe UI,Roboto,Helvetica Neue,Apple Color Emoji,Segoe UI Emoji,sans-serif;">
<div style="font-size:17.6px;font-weight:700;color:#2c3e50;line-height:1.25;margin:0 0 8px 0;">${name}</div>
<div style="font-size:14.4px;color:#7f8c8d;line-height:1.45;margin:0;">${desc}</div>
${pointsHtml}
<div style="font-size:13.6px;color:#3498db;font-weight:600;margin-top:10px;font-family:Inter,Segoe UI,Roboto,sans-serif;">Track progress in TrifangX (same as All Achievements)</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;"><tr><td style="height:6px;background:#e9ecef;border-radius:3px;line-height:6px;font-size:0;">&nbsp;</td></tr></table>
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
<td style="padding:10px 32px 6px 32px;text-align:center;border-bottom:3px solid #f39c12;font-family:Inter,Segoe UI,Roboto,Helvetica Neue,Apple Color Emoji,Segoe UI Emoji,sans-serif;">
<h2 style="margin:0 0 5px 0;font-size:20.8px;font-weight:800;color:#e67e22;line-height:1.2;">🏆 Daily Challenges</h2>
<div style="color:#d35400;font-style:italic;font-size:13.6px;line-height:1.4;padding-bottom:14px;">These reset and change every day at midnight!</div>
</td>
</tr>
<tr>
<td style="padding:14px 28px 10px 28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${cardRows}</table>
</td>
</tr>`;
}

async function sendDailyDigestEmail(
  env,
  { email, username },
  utcDateStr,
  challengeIds,
  digestTimeZoneLabel,
  options = {}
) {
  if (!email || typeof email !== 'string') return;
  const instant = options.instant === true;
  const safeName = String(username || 'there').replace(/[<>]/g, '');
  const base = siteMarketingBase(env);
  const emailInnerMax = '720px';
  const chessUrl = `${base}/chess_engine.html`;
  const dashUrl = `${base}/account-dashboard.html`;
  const tzNote = digestTimeZoneLabel
    ? `Your daily TrifangX challenge email is scheduled around midnight at the start of your calendar day (${digestTimeZoneLabel}).`
    : '';
  const instantBanner = instant
    ? `<tr><td style="padding:0 40px 18px 40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><p style="margin:0;padding:14px 18px;background:#fef3c7;border-radius:10px;border-left:4px solid #d97706;font-size:14px;line-height:1.5;color:#92400e;"><strong>On-demand send</strong> — you asked for today’s list from your account dashboard.</p></td></tr>`
    : '';
  const preheader = `Three TrifangX daily challenges for UTC ${utcDateStr} — same for every player.`;

  const dailySectionInner = digestDailyChallengesSectionHtml(challengeIds);

  const subject = instant
    ? `Your TrifangX daily challenges — ${utcDateStr} (UTC day)`
    : `TrifangX daily challenges — ${utcDateStr} (UTC day)`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#0f172a;">
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0f172a;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:${emailInnerMax};width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 40%,#b45309 100%);padding:28px 36px;text-align:left;">
              <p style="margin:0 0 4px 0;font-family:Georgia,serif;font-size:20px;font-weight:700;color:#fef3c7;">Daily challenges</p>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#fde68a;opacity:0.95;line-height:1.45;">UTC calendar day <strong style="color:#fff;">${utcDateStr}</strong> · same three IDs for everyone</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 36px 10px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
              <p style="margin:0 0 8px 0;font-size:17px;font-weight:700;color:#0f172a;">Hi ${safeName},</p>
              <p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">Here are today’s rotating TrifangX achievements. Complete them in the chess engine to earn progress toward your dailies.</p>
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
              <a href="${chessUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#ea580c,#c2410c);color:#ffffff !important;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">Open TrifangX</a>
              <p style="margin:16px 0 0 0;font-size:13px;line-height:1.55;color:#64748b;">Challenge IDs always use the <strong>UTC date</strong> above so they match the in-game list. Manage challenge emails in <a href="${dashUrl}" style="color:#2563eb;font-weight:600;">account settings</a>.</p>
              ${tzNote ? `<p style="margin:12px 0 0 0;font-size:12px;color:#94a3b8;">${tzNote}</p>` : ''}
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
    instant ? '(Sent on request from your account dashboard.)' : '(Scheduled daily TrifangX challenge email.)',
    '',
    `TrifangX daily challenges for UTC date ${utcDateStr} (same for every player):`,
    formatDailyDigestLines(challengeIds),
    '',
    `Play: ${chessUrl}`,
    `Dashboard: ${dashUrl}`,
    '',
    tzNote,
    '',
    instant ? '' : 'You turned on the daily challenge email in account settings.',
  ]
    .filter(Boolean)
    .join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
}

async function handleScheduledCron(event, env) {
  if (!env.DAILY_DIGEST_KV) {
    console.log('scheduled: DAILY_DIGEST_KV not bound, skipping digest');
    return;
  }
  const now = new Date();
  const utcDateStr = utcDateString(now);
  const ids = getDailyChallengeIdsForUtcDate(utcDateStr);
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
            const profileStub = env.USER_ACCOUNT.idFromName(userIdFromKey);
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
          } catch {
            skipped++;
            continue;
          }
        }

        let tz = typeof raw.digestTimeZone === 'string' && raw.digestTimeZone.trim() ? raw.digestTimeZone.trim() : DEFAULT_DIGEST_TIMEZONE;
        if (!isValidIanaTimeZone(tz)) tz = DEFAULT_DIGEST_TIMEZONE;

        const localYmd = ymdInTimeZone(now, tz);
        const hour = hourInTimeZone(now, tz);
        if (hour !== 0) {
          skipped++;
          continue;
        }
        if (raw.lastDigestLocalYmd === localYmd) {
          skipped++;
          continue;
        }

        await sendDailyDigestEmail(env, raw, utcDateStr, ids, tz);
        const next = { ...raw, digestTimeZone: tz, lastDigestLocalYmd: localYmd };
        await env.DAILY_DIGEST_KV.put(name, JSON.stringify(next));
        sent++;
      } catch (e) {
        failed++;
        console.error('Digest send failed', name, e?.message || e);
      }
    }
    cursor = list.list_complete ? undefined : list.cursor;
  } while (cursor);
  console.log('Daily digest cron', { utcDateStr, sent, failed, skipped, cron: event.cron });
}

function generatePasswordResetToken() {
  return `pwreset_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
}

function buildPasswordResetUrl(env, email, token) {
  const base = (env.VERIFICATION_LINK_BASE || 'https://ahrens-labs.github.io').replace(/\/$/, '');
  const path = env.PASSWORD_RESET_LANDING_PATH || '/reset-password.html';
  const pathWithLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  const q = new URLSearchParams({ reset: token, email });
  return `${base}${pathWithLeadingSlash}?${q.toString()}`;
}

async function sendPasswordResetEmail(env, email, username, token) {
  const resetUrl = buildPasswordResetUrl(env, email, token);
  const safeName = String(username).replace(/[<>]/g, '');
  const subject = 'Reset your Ahrens Labs password';
  const html = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Password reset</h2>
            <p>Hi ${safeName},</p>
            <p>We received a request to reset the password for your Ahrens Labs account. Click the button below to choose a new password. This link expires in one hour.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset password
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #7f8c8d; word-break: break-all;">${resetUrl}</p>
            <p style="margin-top: 30px; color: #7f8c8d; font-size: 0.9em;">
              If you did not request this, you can ignore this email; your password will stay the same.
            </p>
          </body>
        </html>
      `;
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
      html: '<p>If you see this, outbound email from chess-accounts works.</p>',
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
        const result = await this.adminForceVerifyEmail();
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
      }
    };

    await this.storage.put('userData', userData);
    return { success: true };
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
    return {
      userId: this.state.id.toString(),
      ...safeData,
      emailPreferences,
    };
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
  async adminForceVerifyEmail() {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return { success: false, error: 'User not found' };
    }
    if (userData.emailVerified === true) {
      return { success: true, alreadyVerified: true };
    }
    userData.emailVerified = true;
    userData.verificationToken = null;
    userData.verificationTokenExpiry = null;
    await this.storage.put('userData', userData);
    return { success: true, alreadyVerified: false };
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
    if (body && body.digestTimeZone != null && typeof body.digestTimeZone === 'string') {
      const tz = body.digestTimeZone.trim();
      if (!isValidIanaTimeZone(tz)) {
        return { success: false, error: 'Invalid digestTimeZone' };
      }
      userData.emailPreferences.digestTimeZone = tz;
    }
    await this.storage.put('userData', userData);
    return { success: true, emailPreferences: userData.emailPreferences };
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
    await this.storage.delete('userData');
    return { success: true };
  }

  async updateChessData(chessData) {
    const userData = await this.storage.get('userData');
    if (!userData) return;
    
    // Update chess game data
    if (!userData.games) userData.games = {};
    if (!userData.games.chess) userData.games.chess = {};

    const replaceHistory =
      chessData.replaceGameHistory === true || chessData.replaceGameHistory === 'true';
    const restIncoming = { ...chessData };
    delete restIncoming.replaceGameHistory;

    const prevChess = userData.games.chess;
    const prevSnap = chessStatsSnapshot(prevChess || {});
    let mergedHistory;
    if (replaceHistory && Array.isArray(restIncoming.gameHistory)) {
      mergedHistory = trimChessGameHistoryMerged(restIncoming.gameHistory);
    } else if (Array.isArray(restIncoming.gameHistory)) {
      mergedHistory = mergeChessGameHistoryForSync(prevChess.gameHistory, restIncoming.gameHistory);
    } else {
      mergedHistory = mergeChessGameHistoryForSync(prevChess.gameHistory, []);
    }

    userData.games.chess = {
      ...prevChess,
      ...restIncoming,
      gameHistory: mergedHistory,
      lastUpdated: Date.now()
    };
    
    await this.storage.put('userData', userData);

    const nextSnap = chessStatsSnapshot(userData.games.chess);
    await persistAndSendChessMilestones(this.env, this.storage, userData, prevSnap, nextSnap);
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
      };
    }
    
    return userData.games.chess;
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
