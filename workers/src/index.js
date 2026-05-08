// Cloudflare Workers entry point for Chess Engine Accounts

export default {
  async fetch(request, env) {
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
      } else if (path === '/api/change-password' && request.method === 'POST') {
        return handleChangePassword(request, env, corsHeaders);
      } else if (path === '/api/delete-account' && request.method === 'POST') {
        return handleDeleteAccount(request, env, corsHeaders);
      } else if (path === '/api/verify' && request.method === 'GET') {
        return handleVerifyEmail(request, env, corsHeaders);
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
    // Continue with signup even if email fails
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

  const failMsg = emailSendError?.hint
    ? `Account created, but email was not sent: ${emailSendError.hint}`
    : (emailSendError?.message
      ? `Account created, but email was not sent (${emailSendError.code || 'error'}).`
      : 'Account created, but we could not send the confirmation email. Check Worker logs (Email Service / SENDER_EMAIL) or try Forgot password after signing in.');

  return new Response(JSON.stringify({ 
    success: true, 
    sessionId,
    userId,
    username,
    email: normalizedEmail,
    verificationEmailSent,
    emailSendError,
    message: verificationEmailSent
      ? 'Account created! Check your email for a link to confirm your address.'
      : failMsg,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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

// Delete account (requires session + current password; destroys session)
async function handleDeleteAccount(request, env, corsHeaders) {
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

/** For /api/login only: accept any plausible email so legacy accounts work (signup still uses isLikelyRealEmail). */
function looksLikeEmailForLogin(raw) {
  if (raw == null || typeof raw !== 'string') return false;
  const t = raw.trim();
  if (!t.includes('@')) return false;
  const n = normalizeEmail(t);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(n);
}

function isLikelyRealEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  if (!emailRegex.test(normalized)) return false;
  const domain = normalized.split('@')[1] || '';
  const blockedDomains = new Set([
    'example.com',
    'example.org',
    'example.net',
    'test.com',
    'invalid.com',
    'mailinator.com',
    'tempmail.com',
    '10minutemail.com',
    'guerrillamail.com',
  ]);
  return !blockedDomains.has(domain);
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
async function sendViaResend(env, { fromAddr, to, subject, html, text }) {
  const key = env.RESEND_API_KEY;
  if (!key || typeof key !== 'string') {
    throw new Error('RESEND_API_KEY is not set');
  }
  const from = `Ahrens Labs <${fromAddr}>`;
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

async function dispatchTransactionalEmail(env, { to, subject, html, text }) {
  const fromAddr = String(env.SENDER_EMAIL || env.VERIFICATION_FROM_EMAIL || '').trim();
  if (!fromAddr) {
    throw new Error('Set SENDER_EMAIL to a verified sender (Resend or Cloudflare Email Service domain).');
  }
  if (
    fromAddr.includes('YOUR_DOMAIN') ||
    fromAddr === 'digest@example.com' ||
    fromAddr === 'noreply@example.com'
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
    return await sendViaResend(env, { fromAddr, to, subject, html, text });
  }

  const cfMail = getCloudflareEmailBinding(env);
  if (cfMail) {
    try {
      // Same shape as sports-digest: structured `from` + send() on [[send_email]] binding (see wrangler.toml).
      const fromName = String(env.TRANSACTIONAL_FROM_NAME || 'Ahrens Labs').trim() || 'Ahrens Labs';
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
        return await sendViaResend(env, { fromAddr, to, subject, html, text });
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
    return await sendViaResend(env, { fromAddr, to, subject, html, text });
  }

  throw new Error(
    'No email transport: run `wrangler secret put RESEND_API_KEY` (https://resend.com — works on Workers Free), ' +
      'or upgrade to Workers Paid and add [[send_email]] for Cloudflare Email Service.'
  );
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
            <p>Thanks for creating an account. Confirm your email address by clicking the button below:</p>
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
    `Confirm your email by opening this link: ${verificationUrl}`,
    '',
    'If you did not create this account, you can ignore this email.',
  ].join('\n');

  await dispatchTransactionalEmail(env, { to: email, subject, html, text });
}

function generatePasswordResetToken() {
  return `pwreset_${Date.now()}_${Math.random().toString(36).substr(2, 24)}`;
}

function buildPasswordResetUrl(env, email, token) {
  const base = (env.VERIFICATION_LINK_BASE || 'https://ahrens-labs.github.io').replace(/\/$/, '');
  const path = env.VERIFICATION_LANDING_PATH || '/account.html';
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

const FORGOT_PASSWORD_OK_MESSAGE =
  'If an account exists for that email, you will receive a reset link shortly.';

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

// Handle email verification
async function handleVerifyEmail(request, env, corsHeaders) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');

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
    body: JSON.stringify({ token })
  });

  const verifyRes = await userAccount.fetch(verifyReq);
  const result = await verifyRes.json();

  if (result.success) {
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Email verified successfully!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } else {
    return new Response(JSON.stringify({ 
      error: result.error || 'Invalid or expired verification token'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
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
      ...safeData
    } = userData;
    return {
      userId: this.state.id.toString(),
      ...safeData
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
      return { success: true, message: 'Email already verified' };
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

    return { success: true };
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
