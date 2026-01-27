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

  // Get user account DO
  const userId = generateUserId(email);
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
    email
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
    userId 
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
    return data !== null;
  }

  async create(email, password, username) {
    // Check if already exists
    const exists = await this.checkExists();
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
      achievements: {},
      points: 0,
      shopUnlocks: {
        boards: ['classic'],
        pieces: ['classic'],
        highlightColors: ['red'],
        arrowColors: ['red'],
        legalMoveDots: ['blue-circle'],
        themes: ['light'],
        moveEffects: ['default'],
        checkmateEffects: [],
        timeControls: ['none']
      },
      settings: {
        boardStyle: 'classic',
        pieceStyle: 'classic',
        highlightColor: 'red',
        arrowColor: 'red',
        legalMoveDotStyle: 'blue-circle',
        pageTheme: 'light',
        moveEffect: 'default'
      },
      stats: {
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0
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
    return await this.storage.get('userId');
  }

  async destroy() {
    await this.storage.deleteAll();
  }
}
