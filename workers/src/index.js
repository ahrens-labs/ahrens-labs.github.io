// Cloudflare Workers entry point for Chess Engine Accounts

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      } else if (path === '/api/verify' && request.method === 'GET') {
        return handleVerifyEmail(request, env, corsHeaders);
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
      } else if (path === '/api/debug' && request.method === 'GET') {
        const testEmail = url.searchParams.get('email') || 'debug@test.com';
        const userId = generateUserId(testEmail);
        const userAccountId = env.USER_ACCOUNT.idFromName(userId);
        const userAccount = env.USER_ACCOUNT.get(userAccountId);
        
        const debugReq = new Request('http://do/debug', { method: 'GET' });
        const debugRes = await userAccount.fetch(debugReq);
        const debugData = await debugRes.json();
        
        return new Response(JSON.stringify({
          email: testEmail,
          userId,
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

  if (!email || !password || !username) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Invalid email format' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get user account DO
  const userId = generateUserId(email);
  console.log('Signup - email:', email, 'userId:', userId);
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

  // Create user via DO fetch
  const createReq = new Request('http://do/create', {
    method: 'POST',
    body: JSON.stringify({ email, password, username })
  });
  
  const createRes = await userAccount.fetch(createReq);
  const result = await createRes.json();
  
  if (!result.success) {
    return new Response(JSON.stringify({ error: result.error || 'Signup failed' }), {
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

  // Send verification email
  try {
    await sendVerificationEmail(email, username, verificationToken);
  } catch (error) {
    console.error('Failed to send verification email:', error);
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

  return new Response(JSON.stringify({ 
    success: true, 
    sessionId,
    userId,
    username,
    email,
    message: 'Account created successfully!'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Login handler
async function handleLogin(request, env, corsHeaders) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Missing email or password' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const userId = generateUserId(email);
  const userAccountId = env.USER_ACCOUNT.idFromName(userId);
  const userAccount = env.USER_ACCOUNT.get(userAccountId);

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

  // Get user data to return username
  const getDataReq = new Request('http://do/getData', {
    method: 'GET'
  });
  const dataRes = await userAccount.fetch(getDataReq);
  const userData = await dataRes.json();

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
    username: userData?.username || email,
    email: userData?.email || email
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Logout handler
async function handleLogout(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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

// Get user data handler
async function handleGetUser(request, env, corsHeaders) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sessionId = authHeader.replace('Bearer ', '');
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

  return new Response(JSON.stringify(userData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Helper functions
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

// Send verification email using MailChannels
async function sendVerificationEmail(email, username, token) {
  const verificationUrl = `https://ahrens-labs.github.io/chess_engine.html?verify=${token}&email=${encodeURIComponent(email)}`;
  
  const emailData = {
    personalizations: [{
      to: [{ email: email, name: username }]
    }],
    from: {
      email: "noreply@chess.ahrens-labs.workers.dev",
      name: "Ahrens Labs Chess"
    },
    subject: "Verify your Chess Engine account",
    content: [{
      type: "text/html",
      value: `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Welcome to Ahrens Labs Chess Engine!</h2>
            <p>Hi ${username},</p>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: #3498db; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Verify Email Address
              </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #7f8c8d; word-break: break-all;">${verificationUrl}</p>
            <p style="margin-top: 30px; color: #7f8c8d; font-size: 0.9em;">
              If you didn't create this account, you can safely ignore this email.
            </p>
          </body>
        </html>
      `
    }]
  };

  const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  });

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`);
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
      } else if (path === '/debug' && request.method === 'GET') {
        const allKeys = await this.storage.list();
        const userData = await this.storage.get('userData');
        return new Response(JSON.stringify({
          storageKeys: Array.from(allKeys.keys()),
          userDataValue: userData,
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

    // Simple password hash (in production, use proper hashing)
    const passwordHash = await this.hashPassword(password);

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

    const passwordHash = await this.hashPassword(password);
    if (passwordHash === userData.passwordHash) {
      return { success: true };
    }
    return { success: false };
  }

  async getData() {
    const userData = await this.storage.get('userData');
    if (!userData) {
      return null;
    }

    // Return user data without password hash
    const { passwordHash, ...safeData } = userData;
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

  async updateChessData(chessData) {
    const userData = await this.storage.get('userData');
    if (!userData) return;
    
    // Update chess game data
    if (!userData.games) userData.games = {};
    if (!userData.games.chess) userData.games.chess = {};
    
    userData.games.chess = {
      ...userData.games.chess,
      ...chessData,
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

  async hashPassword(password) {
    // Simple hash for demo - use proper hashing in production
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
