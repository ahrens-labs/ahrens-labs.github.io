import { Hono } from 'hono'
import type { Env } from './types'
import { getSessionIdFromCookie, getUserFromSession, deleteSession, clearSessionCookie, createSession, setSessionCookie, createLocalUser, authenticateLocalUser, ensureUserForAhrensEmail, userHasAhrensBinding } from './auth'
import { checkRateLimit, clearRateLimit, formatLockoutMessage } from './ratelimit'
import { getGoogleAuthUrl, handleGoogleCallback } from './oauth'
import { landingPage, signinPage, signupPage, dashboardPage, peoplePage, interactionsPage, newContactPage, contactDetailPage, editContactPage, editInteractionPage, newInteractionPage, newDatePage, editDatePage, remindersPage, newReminderPage, editReminderPage, privacyPolicyPage, termsOfServicePage } from './templates'
import { decryptContact, generateId, encryptContact } from './crypto'
import { AHRENS_LINK_HOME, ahrensLoginRedirect, isAhrensHost, linkprmRedirectTarget, publicPath, sessionCookiePath } from './host'
import { serveLinkHtml } from './html'

const app = new Hono<{ Bindings: Env }>()

async function redirectAhrensLogin(c: any, clearLinkSession = false) {
  const cookiePath = sessionCookiePath(c.req.raw)
  if (clearLinkSession) {
    const sessionId = getSessionIdFromCookie(c.req.raw)
    if (sessionId) {
      await deleteSession(c.env, sessionId)
    }
    const response = c.redirect(ahrensLoginRedirect(c.req.raw))
    return clearSessionCookie(response, cookiePath)
  }
  return c.redirect(ahrensLoginRedirect(c.req.raw))
}

// Middleware to check authentication
async function requireAuth(c: any, next: any) {
  const sessionId = getSessionIdFromCookie(c.req.raw)
  const user = await getUserFromSession(c.env, sessionId)
  
  if (!user) {
    if (isAhrensHost(c.req.raw)) {
      return redirectAhrensLogin(c)
    }
    return c.redirect(publicPath(c.req.raw, '/auth/signin'))
  }

  // On ahrenslabs.com Link only accepts sessions tied to an Ahrens Labs account.
  if (isAhrensHost(c.req.raw)) {
    const bound = user.ahrens_user_id || (await userHasAhrensBinding(c.env, user.id))
    if (!bound) {
      return redirectAhrensLogin(c, true)
    }
  }
  
  c.set('user', user)
  c.set('sessionId', sessionId)
  await next()
}

// Home page - show landing page or redirect to dashboard
app.get('/', async (c) => {
  const sessionId = getSessionIdFromCookie(c.req.raw)
  const user = await getUserFromSession(c.env, sessionId)
  
  if (user) {
    return c.redirect(publicPath(c.req.raw, '/dashboard'))
  }

  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }

  return serveLinkHtml(c, landingPage())
})

// Auth routes
app.get('/auth/signin', (c) => {
  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }
  const error = c.req.query('error')
  return serveLinkHtml(c, signinPage(error))
})

app.post('/auth/signin', async (c) => {
  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }
  const formData = await c.req.formData()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  
  if (!email || !password) {
    return serveLinkHtml(c, signinPage('Email and password are required'))
  }
  
  // Check rate limit
  const rateLimitCheck = await checkRateLimit(c.env, email.toLowerCase(), 'login')
  if (!rateLimitCheck.allowed) {
    const message = formatLockoutMessage(rateLimitCheck.lockedUntil!)
    return serveLinkHtml(c, signinPage(message))
  }
  
  const result = await authenticateLocalUser(c.env, email, password)
  
  if (!result.success) {
    return serveLinkHtml(c, signinPage(result.error))
  }
  
  // Clear rate limit on successful login
  await clearRateLimit(c.env, email.toLowerCase(), 'login')
  
  // Create new session (session regeneration for security)
  const sessionId = await createSession(c.env, result.userId!)
  const response = c.redirect(publicPath(c.req.raw, '/dashboard'))
  return setSessionCookie(response, sessionId, true, sessionCookiePath(c.req.raw))
})

app.get('/auth/signup', (c) => {
  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }
  const error = c.req.query('error')
  return serveLinkHtml(c, signupPage(error))
})

app.post('/auth/signup', async (c) => {
  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }
  const formData = await c.req.formData()
  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  
  if (!name || !email || !password || !confirmPassword) {
    return serveLinkHtml(c, signupPage('All fields are required'))
  }
  
  if (password !== confirmPassword) {
    return serveLinkHtml(c, signupPage('Passwords do not match'))
  }
  
  if (password.length < 8) {
    return serveLinkHtml(c, signupPage('Password must be at least 8 characters'))
  }
  
  // Check rate limit
  const rateLimitCheck = await checkRateLimit(c.env, email.toLowerCase(), 'signup')
  if (!rateLimitCheck.allowed) {
    const message = formatLockoutMessage(rateLimitCheck.lockedUntil!)
    return serveLinkHtml(c, signupPage(message))
  }
  
  const result = await createLocalUser(c.env, email, password, name)
  
  if (!result.success) {
    return serveLinkHtml(c, signupPage(result.error))
  }
  
  // Clear rate limit on successful signup
  await clearRateLimit(c.env, email.toLowerCase(), 'signup')
  
  // Create new session for the user
  const sessionId = await createSession(c.env, result.userId!)
  const response = c.redirect(publicPath(c.req.raw, '/dashboard'))
  return setSessionCookie(response, sessionId, true, sessionCookiePath(c.req.raw))
})

app.get('/auth/google', (c) => {
  if (isAhrensHost(c.req.raw)) {
    return redirectAhrensLogin(c)
  }
  const url = new URL(c.req.url)
  const callbackUrl = `${url.protocol}//${url.host}${publicPath(c.req.raw, '/auth/callback')}`
  const authUrl = getGoogleAuthUrl(c.env, callbackUrl)
  return c.redirect(authUrl)
})

app.get('/auth/callback', async (c) => {
  const code = c.req.query('code')
  if (!code) {
    return c.text('Missing authorization code', 400)
  }
  
  const url = new URL(c.req.url)
  const callbackUrl = `${url.protocol}//${url.host}${publicPath(c.req.raw, '/auth/callback')}`
  return handleGoogleCallback(c.env, code, callbackUrl, sessionCookiePath(c.req.raw), publicPath(c.req.raw, '/dashboard'))
})

app.get('/auth/signout', async (c) => {
  const sessionId = getSessionIdFromCookie(c.req.raw)
  if (sessionId) {
    await deleteSession(c.env, sessionId)
  }

  const cookiePath = sessionCookiePath(c.req.raw)
  const dest = isAhrensHost(c.req.raw) ? AHRENS_LINK_HOME : publicPath(c.req.raw, '/auth/signin')
  const response = c.redirect(dest)
  return clearSessionCookie(response, cookiePath)
})

// Ahrens Labs single sign-on bridge (token from chess-accounts /api/link/bridge)
app.get('/auth/ahrens-bridge', async (c) => {
  const token = c.req.query('token')
  if (!token) {
    return c.text('Missing bridge token', 400)
  }

  if (!c.env.CHESS_ACCOUNTS) {
    return c.text('Link auth bridge is not configured', 503)
  }

  const consumeRes = await c.env.CHESS_ACCOUNTS.fetch(
    new Request(
      `https://internal/internal/link/consume-bridge?token=${encodeURIComponent(token)}`,
      { method: 'GET' }
    )
  )

  if (!consumeRes.ok) {
    return serveLinkHtml(c, 
      `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;margin:auto">
        <h1>Link sign-in expired</h1>
        <p>Go back to <a href="/link/dashboard">Link dashboard</a> and try again.</p>
      </body></html>`,
      410
    )
  }

  const bridge = await consumeRes.json() as { email?: string; name?: string; username?: string; ahrensUserId?: string }
  if (!bridge.email) {
    return c.text('Invalid bridge payload', 500)
  }

  const result = await ensureUserForAhrensEmail(
    c.env,
    bridge.email,
    bridge.name || bridge.username || bridge.email,
    bridge.ahrensUserId,
    bridge.username
  )
  if (!result.success || !result.userId) {
    return c.text(result.error || 'Could not open Link account', 500)
  }

  const existingSessionId = getSessionIdFromCookie(c.req.raw)
  if (existingSessionId) {
    await deleteSession(c.env, existingSessionId)
  }

  const sessionId = await createSession(c.env, result.userId, bridge.ahrensUserId)
  const response = c.redirect(publicPath(c.req.raw, '/dashboard'))
  return setSessionCookie(response, sessionId, true, sessionCookiePath(c.req.raw))
})

// Who is logged into Link (for Ahrens session sync on ahrenslabs.com)
app.get('/api/auth/identity', requireAuth, async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    'SELECT email, name, ahrens_user_id FROM users WHERE id = ?'
  ).bind(user.id).first() as { email: string; name: string | null; ahrens_user_id: string | null } | null

  const storedName = (row?.name || user.name || '').trim()
  const username = storedName && !storedName.includes('@') ? storedName : ''

  return c.json({
    email: row?.email || user.email,
    username,
    ahrensUserId: row?.ahrens_user_id || user.ahrens_user_id || null,
  })
})

// Force Link display name to match Ahrens Labs username (overrides legacy Link names).
app.post('/api/auth/sync-display-name', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => ({})) as { username?: string }
  const username = String(body.username || '').trim()

  if (!username || username.includes('@')) {
    return c.json({ error: 'Valid Ahrens username required' }, 400)
  }

  await c.env.DB.prepare(
    'UPDATE users SET name = ?, updated_at = ? WHERE id = ?'
  ).bind(username, Date.now(), user.id).run()

  return c.json({ username })
})

// Dashboard
app.get('/dashboard', requireAuth, async (c) => {
  const user = c.get('user')
  
  // Check if user has Google account connected
  const googleAccount = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'google').first()
  
  return serveLinkHtml(c, dashboardPage(user, !!googleAccount))
})

// Privacy Policy page
app.get('/privacy', requireAuth, async (c) => {
  const user = c.get('user')
  return serveLinkHtml(c, privacyPolicyPage(user))
})

// Terms of Service page
app.get('/terms', requireAuth, async (c) => {
  const user = c.get('user')
  return serveLinkHtml(c, termsOfServicePage(user))
})

// People page
app.get('/people', requireAuth, async (c) => {
  const user = c.get('user')
  const search = c.req.query('search')
  const tagFilter = c.req.query('tag')
  const sortBy = c.req.query('sort') || 'name' // 'name' or 'date'
  
  // Get contacts
  const contactsResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all()
  
  // Decrypt contact data
  let contacts = await Promise.all(
    (contactsResult.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        ...decrypted,
        tags: contact.tags ? JSON.parse(contact.tags) : [],
        created_at: contact.created_at
      }
    })
  )
  
  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase()
    contacts = contacts.filter((contact: any) => 
      contact.name?.toLowerCase().includes(searchLower) ||
      contact.email?.toLowerCase().includes(searchLower) ||
      contact.company?.toLowerCase().includes(searchLower)
    )
  }
  
  // Apply tag filter
  if (tagFilter) {
    contacts = contacts.filter((contact: any) => 
      contact.tags && contact.tags.includes(tagFilter)
    )
  }
  
  // Sort based on user preference
  if (sortBy === 'date') {
    // Sort by date added (most recent first)
    contacts.sort((a: any, b: any) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })
  } else {
    // Sort alphabetically by name
    contacts.sort((a: any, b: any) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }
  
  // Get all unique tags for filter dropdown
  const allTags = new Set<string>()
  contactsResult.results?.forEach((contact: any) => {
    if (contact.tags) {
      const tags = JSON.parse(contact.tags)
      tags.forEach((tag: string) => allTags.add(tag))
    }
  })
  
  // Check if user has Google account connected
  const googleAccount = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'google').first()
  
  return serveLinkHtml(c, peoplePage(user, contacts, Array.from(allTags).sort(), search || '', tagFilter || '', sortBy, !!googleAccount))
})

// Interactions page
app.get('/interactions', requireAuth, async (c) => {
  const user = c.get('user')
  const search = c.req.query('search')
  const typeFilter = c.req.query('type')
  const view = c.req.query('view') || 'calendar'
  const yearParam = c.req.query('year')
  const monthParam = c.req.query('month')
  
  // Parse year and month for calendar view
  const currentDate = new Date()
  const year = yearParam ? parseInt(yearParam) : currentDate.getFullYear()
  const month = monthParam ? parseInt(monthParam) : currentDate.getMonth()
  
  // Get recent interactions with contact info
  let recentInteractions = []
  try {
    let query = `SELECT i.*, c.id as contact_id, c.name as contact_name
       FROM interactions i
       INNER JOIN contacts c ON i.contact_id = c.id
       WHERE c.user_id = ?`
    
    const params = [user.id]
    
    // If calendar view, filter by month
    if (view === 'calendar') {
      const startOfMonth = new Date(year, month, 1).getTime()
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime()
      query += ` AND i.date >= ? AND i.date <= ?`
      params.push(startOfMonth, endOfMonth)
    }
    
    query += ` ORDER BY i.date DESC`
    
    // Only limit for list view
    if (view === 'list') {
      query += ` LIMIT 50`
    }
    
    const recentInteractionsResult = await c.env.DB.prepare(query).bind(...params).all()
    
    for (const interaction of (recentInteractionsResult.results || [])) {
      // Decrypt contact name
      const contactResult = await c.env.DB.prepare(
        'SELECT * FROM contacts WHERE id = ?'
      ).bind(interaction.contact_id).first()
      
      if (contactResult) {
        const decryptedContact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
        recentInteractions.push({
          ...interaction,
          contact_name: decryptedContact.name
        })
      }
    }
    
    // Apply search filter (only for list view)
    if (search && view === 'list') {
      const searchLower = search.toLowerCase()
      recentInteractions = recentInteractions.filter((interaction: any) => 
        interaction.contact_name?.toLowerCase().includes(searchLower) ||
        interaction.notes?.toLowerCase().includes(searchLower)
      )
    }
    
    // Apply type filter (only for list view)
    if (typeFilter && view === 'list') {
      recentInteractions = recentInteractions.filter((interaction: any) => 
        interaction.type === typeFilter
      )
    }
  } catch (error) {
    console.error('Error fetching interactions:', error)
    recentInteractions = []
  }
  
  // Check if user has Google account connected
  const googleAccount = await c.env.DB.prepare(
    'SELECT id FROM accounts WHERE user_id = ? AND provider = ?'
  ).bind(user.id, 'google').first()
  
  return serveLinkHtml(c, interactionsPage(user, recentInteractions, search || '', typeFilter || '', !!googleAccount, view, year, month))
})

// Reminders page
app.get('/reminders', requireAuth, async (c) => {
  const user = c.get('user')
  const view = c.req.query('view') || 'calendar'
  const year = c.req.query('year') ? parseInt(c.req.query('year')!) : undefined
  const month = c.req.query('month') ? parseInt(c.req.query('month')!) : undefined
  const showDismissed = c.req.query('showDismissed') === 'true'
  
  // Clean up any reminders with null IDs (from before the fix)
  await c.env.DB.prepare(
    `DELETE FROM reminders 
     WHERE id IS NULL 
     AND contact_id IN (SELECT id FROM contacts WHERE user_id = ?)`
  ).bind(user.id).run()
  
  // Get all reminders with contact names (filtered by dismissed status)
  const remindersResult = await c.env.DB.prepare(
    `SELECT r.*, c.name as contact_name
     FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE c.user_id = ? AND r.id IS NOT NULL ${!showDismissed ? 'AND r.dismissed = 0' : ''}
     ORDER BY r.date ASC`
  ).bind(user.id).all()
  
  console.log('Reminders query returned:', remindersResult.results?.length || 0, 'results')
  console.log('Show dismissed:', showDismissed)
  
  // Also check total count including dismissed
  const totalCount = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE c.user_id = ?`
  ).bind(user.id).first()
  
  console.log('Total reminders in DB for user:', totalCount)
  
  const reminders = await Promise.all(
    (remindersResult.results || []).map(async (r: any) => {
      const contact = await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ?').bind(r.contact_id).first()
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        ...r,
        contact_name: decrypted.name
      }
    })
  )
  
  return serveLinkHtml(c, remindersPage(user, reminders, view, year, month, showDismissed))
})

// New reminder page
app.get('/reminders/new', requireAuth, async (c) => {
  const user = c.get('user')
  
  // Get all contacts for dropdown
  const contactsResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all()
  
  const contacts = await Promise.all(
    (contactsResult.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        id: contact.id,
        name: decrypted.name
      }
    })
  )
  
  return serveLinkHtml(c, newReminderPage(user, contacts))
})

// Edit reminder page
app.get('/reminders/:id/edit', requireAuth, async (c) => {
  const user = c.get('user')
  const reminderId = c.req.param('id')
  
  // Get reminder with ownership verification
  const reminder = await c.env.DB.prepare(
    `SELECT r.* FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE r.id = ? AND c.user_id = ?`
  ).bind(reminderId, user.id).first()
  
  if (!reminder) {
    return c.text('Not found', 404)
  }
  
  // Get all contacts for dropdown
  const contactsResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(user.id).all()
  
  const contacts = await Promise.all(
    (contactsResult.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        id: contact.id,
        name: decrypted.name
      }
    })
  )
  
  return serveLinkHtml(c, editReminderPage(user, reminder, contacts))
})

// New contact form
app.get('/contacts/new', requireAuth, async (c) => {
  return serveLinkHtml(c, newContactPage())

})

// API: Get contacts
app.get('/api/contacts', requireAuth, async (c) => {
  const user = c.get('user')
  const search = c.req.query('search')
  
  let query = 'SELECT * FROM contacts WHERE user_id = ?'
  const params = [user.id]
  
  if (search) {
    query += ' AND (name LIKE ? OR company LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  
  query += ' ORDER BY created_at DESC'
  
  const result = await c.env.DB.prepare(query).bind(...params).all()
  
  // Decrypt contacts
  const contacts = await Promise.all(
    (result.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        ...decrypted,
        tags: contact.tags ? JSON.parse(contact.tags) : []
      }
    })
  )
  
  return c.json(contacts)
})

// API: Create contact
app.post('/api/contacts', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  const contactId = generateId()
  const encrypted = await encryptContact({
    name: body.name,
    email: body.email || null,
    phone: body.phone || null
  }, c.env.ENCRYPTION_KEY)
  
  await c.env.DB.prepare(
    `INSERT INTO contacts 
     (id, user_id, name, email, phone, title, company, birthday, relationship_status, 
      tags, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    contactId,
    user.id,
    encrypted.name,
    encrypted.email,
    encrypted.phone,
    body.title || null,
    body.company || null,
    body.birthday || null,
    body.relationshipStatus || 'MONTHLY',
    body.tags ? JSON.stringify(body.tags) : null,
    body.notes || null,
    Date.now(),
    Date.now()
  ).run()
  
  return c.json({ id: contactId }, 201)
})

// API: Import contacts from CSV
app.post('/api/contacts/import-csv', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  const { csv, skipHeader } = body
  
  if (!csv) {
    return c.json({ error: 'CSV data required' }, 400)
  }
  
  // Parse CSV properly handling multi-line fields
  const rows = parseCSV(csv)
  
  if (rows.length === 0) {
    return c.json({ error: 'Empty CSV file' }, 400)
  }
  
  // Parse header to detect column positions
  let columnMap: any = {}
  let startIndex = 0
  
  if (skipHeader && rows.length > 0) {
    const headers = rows[0].map((h: string) => h.trim().toLowerCase())
    columnMap = detectColumns(headers)
    startIndex = 1
  }
  
  let imported = 0
  let skipped = 0
  
  // Prepare contacts to insert in batches
  const contactsToInsert: any[] = []
  
  // Get existing contacts to check for duplicates
  const existingContactsResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE user_id = ?'
  ).bind(user.id).all()
  
  const existingEmails = new Set<string>()
  const existingNames = new Set<string>()
  
  for (const encContact of existingContactsResult.results || []) {
    const contact = await decryptContact(encContact, c.env.ENCRYPTION_KEY)
    if (contact.email) {
      existingEmails.add(contact.email.toLowerCase())
    }
    if (contact.name) {
      existingNames.add(contact.name.toLowerCase().trim())
    }
  }
  
  let duplicates = 0
  
  // Process each row
  for (let i = startIndex; i < rows.length; i++) {
    try {
      const row = rows[i]
      
      if (row.length === 0) {
        skipped++
        continue
      }
      
      // Extract data based on detected columns or positional
      let name = ''
      let email = null
      let phone = null
      let company = null
      let title = null
      let tags: string[] | null = null
      let notes = null
      
      if (Object.keys(columnMap).length > 0) {
        // Use detected column mapping
        if (columnMap.firstName >= 0 || columnMap.lastName >= 0) {
          const firstName = row[columnMap.firstName]?.trim() || ''
          const lastName = row[columnMap.lastName]?.trim() || ''
          name = `${firstName} ${lastName}`.trim()
        } else if (columnMap.name >= 0) {
          name = row[columnMap.name]?.trim() || ''
        }
        
        email = row[columnMap.email]?.trim() || null
        phone = row[columnMap.phone]?.trim() || null
        company = row[columnMap.company]?.trim() || null
        title = row[columnMap.title]?.trim() || null
        notes = row[columnMap.notes]?.trim() || null
        
        if (columnMap.tags >= 0) {
          const tagsStr = row[columnMap.tags]?.trim()
          if (tagsStr) {
            tags = tagsStr.split(/[;,]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0)
          }
        }
      } else {
        // Fallback to positional (Name, Email, Phone, Company, Tags)
        name = row[0]?.trim() || ''
        email = row[1]?.trim() || null
        phone = row[2]?.trim() || null
        company = row[3]?.trim() || null
        const tagsStr = row[4]?.trim()
        if (tagsStr) {
          tags = tagsStr.split(/[;,]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0)
        }
      }
      
      // Validate name - must have actual content (not just whitespace, special chars, or numbers)
      name = name.trim()
      if (!name || name.length === 0 || !name.match(/[a-zA-Z]/)) {
        skipped++
        continue
      }
      
      // Check for duplicates - skip if email or name already exists
      const isDuplicate = (email && existingEmails.has(email.toLowerCase())) || 
                         existingNames.has(name.toLowerCase().trim())
      
      if (isDuplicate) {
        duplicates++
        continue
      }
      
      // Clean up empty strings to null
      if (email === '') email = null
      if (phone === '') phone = null
      if (company === '') company = null
      if (title === '') title = null
      if (notes === '') notes = null
      
      // Add to existing sets to catch duplicates within the CSV itself
      if (email) existingEmails.add(email.toLowerCase())
      existingNames.add(name.toLowerCase().trim())
      
      contactsToInsert.push({
        name,
        email,
        phone,
        company,
        title,
        tags,
        notes
      })
    } catch (error) {
      console.error('Error parsing row:', error)
      skipped++
    }
  }
  
  // Insert contacts in batches of 50 to avoid timeout
  const BATCH_SIZE = 50
  for (let i = 0; i < contactsToInsert.length; i += BATCH_SIZE) {
    const batch = contactsToInsert.slice(i, i + BATCH_SIZE)
    const statements = []
    
    for (const contact of batch) {
      // Encrypt PII fields
      const encrypted = await encryptContact({
        name: contact.name,
        email: contact.email,
        phone: contact.phone
      }, c.env.ENCRYPTION_KEY)
      
      const contactId = generateId()
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO contacts 
           (id, user_id, name, email, phone, title, company, birthday, relationship_status, 
            tags, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          contactId,
          user.id,
          encrypted.name,
          encrypted.email,
          encrypted.phone,
          contact.title,
          contact.company,
          null,
          'MONTHLY',
          contact.tags ? JSON.stringify(contact.tags) : null,
          contact.notes,
          Date.now(),
          Date.now()
        ), duplicates
      )
    }
    
    try {
      await c.env.DB.batch(statements)
      imported += batch.length
    } catch (error) {
      console.error('Error inserting batch:', error)
      skipped += batch.length
    }
  }
  
  return c.json({ imported, skipped })
})

// Detect columns from CSV header
function detectColumns(headers: string[]): any {
  const map: any = {
    name: -1,
    firstName: -1,
    lastName: -1,
    email: -1,
    phone: -1,
    company: -1,
    title: -1,
    tags: -1,
    notes: -1
  }
  
  headers.forEach((header: string, index: number) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    // Name variations
    if (h.match(/^(fullname|displayname|name)$/)) map.name = index
    if (h.match(/^(firstname|givenname|forename)$/)) map.firstName = index
    if (h.match(/^(lastname|surname|familyname)$/)) map.lastName = index
    
    // Email variations (prefer first email field)
    if (map.email === -1 && h.match(/email|e?mail/)) map.email = index
    
    // Phone variations (prefer mobile/primary)
    if (h.match(/^(mobilep|cellp|primaryp)/)) map.phone = index
    else if (map.phone === -1 && h.match(/phone|mobile|cell/)) map.phone = index
    
    // Company/Organization
    if (h.match(/company|organization|organisation/)) map.company = index
    
    // Title/Job Title
    if (h.match(/^(jobtitle|title|position)$/)) map.title = index
    
    // Tags/Categories/Groups
    if (h.match(/category|categories|tag|tags|group/)) map.tags = index
    
    // Notes
    if (h.match(/^(note|notes|comment|comments)$/)) map.notes = index
  })
  
  return map
}

// Helper function to parse CSV line (handles quoted fields)
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  // Add last field
  result.push(current.trim())
  
  return result
}

// Parse entire CSV handling multi-line quoted fields
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = []
  const lines = csvText.split('\n')
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else {
        currentField += char
      }
    }
    
    if (!inQuotes) {
      // End of row
      currentRow.push(currentField.trim())
      if (currentRow.length > 0 && currentRow.some(f => f.length > 0)) {
        rows.push(currentRow)
      }
      currentRow = []
      currentField = ''
    } else {
      // Multi-line field, add newline
      currentField += '\n'
    }
  }
  
  return rows
}

// API: Dismiss reminder
// Create reminder
app.post('/api/reminders', requireAuth, async (c) => {
  const user = c.get('user')
  
  // Handle both JSON and form data
  let contact_id, type, date, title, description
  const contentType = c.req.header('content-type') || ''
  
  if (contentType.includes('application/json')) {
    const body = await c.req.json()
    contact_id = body.contact_id
    type = body.type
    date = body.date
    title = body.title
    description = body.description
    console.log('Creating reminder from JSON:', { contact_id, type, date, title, description })
  } else {
    const formBody = await c.req.parseBody()
    contact_id = formBody.contact_id
    type = formBody.type
    date = formBody.date
    title = formBody.title
    description = formBody.description
    console.log('Creating reminder from form:', { contact_id, type, date, title, description })
  }
  
  // Verify contact ownership
  const contact = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contact_id, user.id).first()
  
  if (!contact) {
    console.error('Contact not found:', contact_id, 'for user:', user.id)
    return c.json({ error: 'Contact not found' }, 404)
  }
  
  console.log('Contact verified:', contact.id)
  
  // Convert date to Unix timestamp
  let dateTimestamp: number
  if (typeof date === 'number') {
    dateTimestamp = date
    console.log('Using numeric timestamp:', dateTimestamp)
  } else if (typeof date === 'string') {
    // Handle ISO date string (YYYY-MM-DD)
    const dateObj = new Date(date + 'T00:00:00Z')
    dateTimestamp = dateObj.getTime()
    console.log('Converted date string to timestamp:', date, '->', dateTimestamp)
  } else {
    console.error('Invalid date type:', typeof date, date)
    return c.json({ error: 'Invalid date format' }, 400)
  }
  
  // Insert reminder
  const reminderId = crypto.randomUUID()
  console.log('Inserting reminder with ID:', reminderId)
  
  const insertResult = await c.env.DB.prepare(
    `INSERT INTO reminders (id, contact_id, type, date, title, description, dismissed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, unixepoch())`
  ).bind(reminderId, contact_id, type, dateTimestamp, title || '', description || '').run()
  
  console.log('Insert result:', JSON.stringify(insertResult))
  
  // Check if insert was successful
  if (!insertResult.success) {
    console.error('Failed to insert reminder:', insertResult)
    return c.json({ error: 'Failed to create reminder', details: insertResult }, 500)
  }
  
  // Verify the reminder was actually inserted
  const verifyResult = await c.env.DB.prepare(
    'SELECT * FROM reminders WHERE id = ?'
  ).bind(reminderId).first()
  
  console.log('Verification query result:', verifyResult ? 'Found' : 'Not found')
  
  if (!verifyResult) {
    console.error('Reminder was not found after insert!')
    return c.json({ error: 'Reminder creation verification failed' }, 500)
  }
  
  // Return JSON for API calls, redirect for form submissions
  if (contentType.includes('application/json')) {
    return c.json({ success: true, id: reminderId, reminder: verifyResult })
  }
  
  return c.redirect('/reminders')
})

// Delete reminder (must come before :id route)
app.post('/api/reminders/:id/delete', requireAuth, async (c) => {
  const user = c.get('user')
  const reminderId = c.req.param('id')
  
  // Verify ownership through contact
  const reminder = await c.env.DB.prepare(
    `SELECT r.* FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE r.id = ? AND c.user_id = ?`
  ).bind(reminderId, user.id).first()
  
  if (!reminder) {
    return c.text('Not found', 404)
  }
  
  await c.env.DB.prepare(
    'DELETE FROM reminders WHERE id = ?'
  ).bind(reminderId).run()
  
  return c.redirect('/reminders')
})

// Dismiss reminder (must come before :id route)
app.post('/api/reminders/:id/dismiss', requireAuth, async (c) => {
  const user = c.get('user')
  const reminderId = c.req.param('id')
  
  // Verify ownership through contact
  const reminder = await c.env.DB.prepare(
    `SELECT r.* FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE r.id = ? AND c.user_id = ?`
  ).bind(reminderId, user.id).first()
  
  if (!reminder) {
    return c.text('Not found', 404)
  }
  
  await c.env.DB.prepare(
    'UPDATE reminders SET dismissed = 1 WHERE id = ?'
  ).bind(reminderId).run()
  
  // Preserve the view from the referer URL
  const referer = c.req.header('Referer') || '/reminders'
  const url = new URL(referer)
  const view = url.searchParams.get('view')
  return c.redirect(view ? `/reminders?view=${view}` : '/reminders')
})

// Update reminder
app.post('/api/reminders/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const reminderId = c.req.param('id')
  const { contact_id, type, date, title, description } = await c.req.parseBody()
  
  // Verify ownership through contact
  const reminder = await c.env.DB.prepare(
    `SELECT r.* FROM reminders r
     INNER JOIN contacts c ON r.contact_id = c.id
     WHERE r.id = ? AND c.user_id = ?`
  ).bind(reminderId, user.id).first()
  
  if (!reminder) {
    return c.text('Not found', 404)
  }
  
  // Verify new contact ownership
  const contact = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contact_id, user.id).first()
  
  if (!contact) {
    return c.text('Contact not found', 404)
  }
  
  // Update reminder
  await c.env.DB.prepare(
    `UPDATE reminders 
     SET contact_id = ?, type = ?, date = ?, title = ?, description = ?
     WHERE id = ?`
  ).bind(contact_id, type, date, title || '', description || '', reminderId).run()
  
  return c.redirect('/reminders')
})

// Serve favicon
import { FAVICON_32_BASE64, ICON_192_BASE64 } from './favicon'

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

app.get('/favicon.png', (c) => {
  const buf = base64ToArrayBuffer(FAVICON_32_BASE64)
  return c.body(buf, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=604800',
  })
})

app.get('/icon-192.png', (c) => {
  const buf = base64ToArrayBuffer(ICON_192_BASE64)
  return c.body(buf, 200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=604800',
  })
})

// Serve manifest
app.get('/manifest.json', (c) => {
  return c.json({
    name: 'Link',
    short_name: 'Link',
    description: 'Link Person Relationship Manager',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0ea5e9',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      }
    ]
  })
})

// Contact detail page
app.get('/contacts/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  
  // Get contact
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contactResult) {
    return c.text('Contact not found', 404)
  }
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  contact.tags = contactResult.tags ? JSON.parse(contactResult.tags) : []
  
  // Get interactions
  const interactionsResult = await c.env.DB.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC'
  ).bind(contactId).all()
  
  // Get dates
  const datesResult = await c.env.DB.prepare(
    'SELECT * FROM contact_dates WHERE contact_id = ? ORDER BY month, day'
  ).bind(contactId).all()
  
  return serveLinkHtml(c, contactDetailPage(contact, interactionsResult.results || [], datesResult.results || []))
})

// API: Add interaction
app.post('/api/contacts/:id/interactions', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  const body = await c.req.json()
  
  // Verify contact belongs to user
  const contact = await c.env.DB.prepare(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contact) {
    return c.json({ error: 'Contact not found' }, 404)
  }
  
  const interactionId = generateId()
  const interactionDate = body.date || Date.now()
  await c.env.DB.prepare(
    `INSERT INTO interactions (id, contact_id, type, title, notes, location, duration, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    interactionId,
    contactId,
    body.type,
    body.title || null,
    body.notes || null,
    body.location || null,
    body.duration || null,
    interactionDate,
    Date.now()
  ).run()
  
  return c.json({ id: interactionId }, 201)
})


// Edit contact page
app.get('/contacts/:id/edit', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contactResult) {
    return c.text('Contact not found', 404)
  }
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  contact.tags = contactResult.tags ? JSON.parse(contactResult.tags) : []
  
  return serveLinkHtml(c, editContactPage(contact))
})

// API: Update contact
app.put('/api/contacts/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  const body = await c.req.json()
  
  // Verify contact belongs to user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }
  
  // Encrypt contact data
  const encrypted = await encryptContact({
    name: body.name,
    email: body.email,
    phone: body.phone
  }, c.env.ENCRYPTION_KEY)
  
  await c.env.DB.prepare(
    `UPDATE contacts 
     SET name = ?, email = ?, phone = ?, company = ?, tags = ?, notes = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    encrypted.name,
    encrypted.email,
    encrypted.phone,
    body.company || null,
    body.tags && body.tags.length > 0 ? JSON.stringify(body.tags) : null,
    body.notes || null,
    Date.now(),
    contactId
  ).run()
  
  return c.json({ success: true })
})

// API: Delete contact
app.delete('/api/contacts/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  
  // Verify contact belongs to user
  const existing = await c.env.DB.prepare(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!existing) {
    return c.json({ error: 'Contact not found' }, 404)
  }
  
  // Delete contact (cascading will handle interactions)
  await c.env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(contactId).run()
  
  return c.json({ success: true })
})

// Date routes
app.get('/contacts/:id/dates/new', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  
  // Get contact
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contactResult) {
    return c.text('Contact not found', 404)
  }
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  
  return serveLinkHtml(c, newDatePage(contact))
})

app.post('/contacts/:id/dates', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  const formData = await c.req.formData()
  
  // Verify contact belongs to user
  const contact = await c.env.DB.prepare(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contact) {
    return c.text('Contact not found', 404)
  }
  
  const dateId = generateId()
  const type = formData.get('type') as string
  const month = parseInt(formData.get('month') as string)
  const day = parseInt(formData.get('day') as string)
  const year = formData.get('year') ? parseInt(formData.get('year') as string) : null
  
  await c.env.DB.prepare(
    `INSERT INTO contact_dates (id, contact_id, type, month, day, year, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    dateId,
    contactId,
    type,
    month,
    day,
    year,
    Date.now(),
    Date.now()
  ).run()
  
  return c.redirect(`/contacts/${contactId}`)
})

app.get('/contacts/:contactId/dates/:dateId/edit', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('contactId')
  const dateId = c.req.param('dateId')
  
  // Get contact
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contactResult) {
    return c.text('Contact not found', 404)
  }
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  
  // Get date
  const date = await c.env.DB.prepare(
    'SELECT * FROM contact_dates WHERE id = ? AND contact_id = ?'
  ).bind(dateId, contactId).first()
  
  if (!date) {
    return c.text('Date not found', 404)
  }
  
  return serveLinkHtml(c, editDatePage(contact, date))
})

app.post('/contacts/:contactId/dates/:dateId', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('contactId')
  const dateId = c.req.param('dateId')
  const formData = await c.req.formData()
  
  // Verify contact belongs to user
  const contact = await c.env.DB.prepare(
    'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contact) {
    return c.text('Contact not found', 404)
  }
  
  const type = formData.get('type') as string
  const month = parseInt(formData.get('month') as string)
  const day = parseInt(formData.get('day') as string)
  const year = formData.get('year') ? parseInt(formData.get('year') as string) : null
  
  await c.env.DB.prepare(
    `UPDATE contact_dates 
     SET type = ?, month = ?, day = ?, year = ?, updated_at = ?
     WHERE id = ? AND contact_id = ?`
  ).bind(
    type,
    month,
    day,
    year,
    Date.now(),
    dateId,
    contactId
  ).run()
  
  return c.redirect(`/contacts/${contactId}`)
})

app.delete('/api/dates/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const dateId = c.req.param('id')
  
  // Verify date belongs to user's contact
  const dateResult = await c.env.DB.prepare(
    `SELECT cd.id FROM contact_dates cd
     JOIN contacts c ON cd.contact_id = c.id
     WHERE cd.id = ? AND c.user_id = ?`
  ).bind(dateId, user.id).first()
  
  if (!dateResult) {
    return c.json({ error: 'Date not found' }, 404)
  }
  
  await c.env.DB.prepare('DELETE FROM contact_dates WHERE id = ?').bind(dateId).run()
  
  return c.json({ success: true })
})

// New interaction page
app.get('/interactions/new', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.query('contact')
  
  // Get all user's contacts for the dropdown
  const allContactsResult = await c.env.DB.prepare(
    'SELECT id, name FROM contacts WHERE user_id = ? ORDER BY name'
  ).bind(user.id).all()
  
  const allContacts = await Promise.all(
    (allContactsResult.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        id: contact.id,
        name: decrypted.name
      }
    })
  )
  
  return serveLinkHtml(c, newInteractionPage(allContacts, contactId))
})

// Edit interaction page
app.get('/interactions/:id/edit', requireAuth, async (c) => {
  const user = c.get('user')
  const interactionId = c.req.param('id')
  
  // Get interaction with contact verification
  const result = await c.env.DB.prepare(
    `SELECT i.*, c.id as contact_id, c.user_id 
     FROM interactions i
     INNER JOIN contacts c ON i.contact_id = c.id
     WHERE i.id = ?`
  ).bind(interactionId).first()
  
  if (!result || result.user_id !== user.id) {
    return c.text('Interaction not found', 404)
  }
  
  // Get contact details
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ?'
  ).bind(result.contact_id).first()
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  
  // Get all user's contacts for the dropdown
  const allContactsResult = await c.env.DB.prepare(
    'SELECT id, name FROM contacts WHERE user_id = ? ORDER BY name'
  ).bind(user.id).all()
  
  const allContacts = await Promise.all(
    (allContactsResult.results || []).map(async (contact: any) => {
      const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
      return {
        id: contact.id,
        name: decrypted.name
      }
    })
  )
  
  return serveLinkHtml(c, editInteractionPage(contact, {
    id: result.id,
    type: result.type,
    notes: result.notes,
    date: result.date
  }, allContacts))
})

// API: Update interaction
app.put('/api/interactions/:id', requireAuth, async (c) => {
  const user = c.get('user') as import('./types').User
  const interactionId = c.req.param('id')
  const body = await c.req.json()
  
  // Verify interaction belongs to user's contact
  const existing = await c.env.DB.prepare(
    `SELECT i.id FROM interactions i
     INNER JOIN contacts c ON i.contact_id = c.id
     WHERE i.id = ? AND c.user_id = ?`
  ).bind(interactionId, user.id).first()
  
  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }
  
  // If contactId is provided, verify the new contact belongs to the user
  if (body.contactId) {
    const newContact = await c.env.DB.prepare(
      'SELECT id FROM contacts WHERE id = ? AND user_id = ?'
    ).bind(body.contactId, user.id).first()
    
    if (!newContact) {
      return c.json({ error: 'Contact not found' }, 404)
    }
    
    // Update with new contact
    await c.env.DB.prepare(
      `UPDATE interactions 
       SET contact_id = ?, type = ?, notes = ?, location = ?, date = ?
       WHERE id = ?`
    ).bind(
      body.contactId,
      body.type,
      body.notes || null,
      body.location || null,
      body.date,
      interactionId
    ).run()
  } else {
    // Update without changing contact
    await c.env.DB.prepare(
      `UPDATE interactions 
       SET type = ?, notes = ?, location = ?, date = ?
       WHERE id = ?`
    ).bind(
      body.type,
      body.notes || null,
      body.location || null,
      body.date,
      interactionId
    ).run()
  }
  
  return c.json({ success: true })
})

// API: Get interaction details
app.get('/api/interactions/:id', requireAuth, async (c) => {
  const user = c.get('user') as import('./types').User
  const interactionId = c.req.param('id')
  const result = await c.env.DB.prepare(
    `SELECT i.*, c.user_id FROM interactions i
     INNER JOIN contacts c ON i.contact_id = c.id
     WHERE i.id = ?`
  ).bind(interactionId).first()

  if (!result || result.user_id !== user.id) {
    return c.json({ error: 'Interaction not found' }, 404)
  }

  return c.json({
    id: result.id,
    contact_id: result.contact_id,
    type: result.type,
    notes: result.notes,
    location: result.location,
    date: result.date
  })
})

// API: Delete interaction
app.delete('/api/interactions/:id', requireAuth, async (c) => {
  const user = c.get('user')
  const interactionId = c.req.param('id')
  
  // Verify interaction belongs to user's contact
  const existing = await c.env.DB.prepare(
    `SELECT i.id FROM interactions i
     INNER JOIN contacts c ON i.contact_id = c.id
     WHERE i.id = ? AND c.user_id = ?`
  ).bind(interactionId, user.id).first()
  
  if (!existing) {
    return c.json({ error: 'Interaction not found' }, 404)
  }
  
  await c.env.DB.prepare('DELETE FROM interactions WHERE id = ?').bind(interactionId).run()
  
  return c.json({ success: true })
})


// API: Generate AI summary for contact
app.post('/api/contacts/:id/ai-summary', requireAuth, async (c) => {
  const user = c.get('user')
  const contactId = c.req.param('id')
  
  // Get contact
  const contactResult = await c.env.DB.prepare(
    'SELECT * FROM contacts WHERE id = ? AND user_id = ?'
  ).bind(contactId, user.id).first()
  
  if (!contactResult) {
    return c.json({ error: 'Contact not found' }, 404)
  }
  
  const contact = await decryptContact(contactResult, c.env.ENCRYPTION_KEY)
  contact.tags = contactResult.tags ? JSON.parse(contactResult.tags) : []
  
  // Get interactions
  const interactionsResult = await c.env.DB.prepare(
    'SELECT * FROM interactions WHERE contact_id = ? ORDER BY date DESC'
  ).bind(contactId).all()
  
  const interactions = interactionsResult.results || []
  
  // Build prompt for AI
  const interactionsList = interactions.map(i => 
    `- ${new Date(i.date).toLocaleDateString()}: ${i.type} - ${i.notes}`
  ).join('\n')
  
  const prompt = `Summarize this contact in 2-3 natural, conversational sentences as if speaking to someone. Use simple language without formal business jargon.

Name: ${contact.name}
Email: ${contact.email || 'N/A'}
Phone: ${contact.phone || 'N/A'}
Company: ${contact.company || 'N/A'}
Tags: ${contact.tags.join(', ') || 'N/A'}
Notes: ${contact.notes || 'N/A'}

Recent Interactions:
${interactionsList || 'No interactions yet'}

Focus on: who they are, your relationship with them, and recent activity. Sound natural and conversational, not formal or robotic.`
  
  // Call Cloudflare Workers AI (free!)
  try {
    const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a voice assistant providing natural, conversational summaries. Speak clearly and concisely without formal language or markdown formatting.' },
        { role: 'user', content: prompt }
      ]
    })
    
    const summary = aiResponse.response || 'Unable to generate summary.'
    
    return c.json({ summary })
  } catch (error) {
    console.error('AI summary error:', error)
    return c.json({ error: 'Failed to generate AI summary' }, 500)
  }
})

// Transcribe audio using Cloudflare AI
app.post('/api/transcribe', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData()
    const audioFile = formData.get('audio')
    
    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: 'Audio file is required' }, 400)
    }
    
    // Convert to ArrayBuffer for AI model
    const arrayBuffer = await audioFile.arrayBuffer()
    
    // Use Cloudflare AI Whisper model for transcription
    const response = await c.env.AI.run('@cf/openai/whisper', {
      audio: Array.from(new Uint8Array(arrayBuffer))
    })
    
    return c.json({ text: response.text })
  } catch (error) {
    console.error('Transcription error:', error)
    return c.json({ error: 'Failed to transcribe audio' }, 500)
  }
})

// Voice command processing with AI intent recognition
app.post('/api/voice-command', requireAuth, async (c) => {
  const user = c.get('user')
  
  try {
    const formData = await c.req.formData()
    const audioFile = formData.get('audio')
    
    if (!audioFile || !(audioFile instanceof File)) {
      return c.json({ error: 'Audio file is required' }, 400)
    }
    
    // Step 1: Transcribe audio
    const arrayBuffer = await audioFile.arrayBuffer()
    const transcription = await c.env.AI.run('@cf/openai/whisper', {
      audio: Array.from(new Uint8Array(arrayBuffer))
    })
    
    const commandText = transcription.text.trim()
    
    if (!commandText) {
      return c.json({ error: 'No speech detected' }, 400)
    }
    
    // Step 2: Determine intent using AI
    const intentPrompt = `You are a voice assistant for a CRM app. Analyze this voice command and determine the user's intent.

Voice command: "${commandText}"

Available actions:
1. "quick_add_interaction" - User wants to log an interaction with a contact (e.g., "I just met with John", "Log a call with Sarah", "Had lunch with Matt Walters yesterday")
   - ALWAYS set "newContact": false by default (try to match existing contacts first)
   - ONLY set "newContact": true if the command explicitly mentions "new contact" or "create contact"
  - Extract "daysAgo" for interaction date based on the user's words (0 for today, 1 for yesterday, etc.)
2. "search" - User wants to search for a contact (e.g., "Find John Smith", "Show me contacts at Acme Corp")
3. "ai_summary" - User wants an AI summary of a contact. Keywords: "summary", "summarize", "tell me about" (e.g., "Summary John Smith", "Summarize Sarah", "Tell me about Mike")
4. "add_contact" - User wants to add a new contact (e.g., "Add a new contact", "Create contact for Jane Doe")
5. "add_reminder" - User wants to add a reminder for a contact (e.g., "Add reminder for John Smith", "Remind me to follow up with Sarah next week", "Set reminder to call Mike tomorrow")
   - Extract contact name and date/time information
   - Keywords: "reminder", "remind me", "set reminder", "follow up"

IMPORTANT: 
- If the command contains words like "summary", "summarize", or "tell me about" followed by a name, it's ALWAYS "ai_summary".
- If the command contains "reminder" or "remind me", it's ALWAYS "add_reminder"
- ALWAYS try to match existing contacts first by setting "newContact": false
- ONLY set "newContact": true if explicitly mentioned (e.g., "new contact", "create contact")
- For interaction commands starting with "Met", "Had", "Talked", "Spoke", "Called", "Emailed", etc., use "quick_add_interaction"

Respond with ONLY valid JSON in this format:
{
  "action": "quick_add_interaction" | "search" | "ai_summary" | "add_contact" | "add_reminder",
  "text": "original command text (for quick_add_interaction or add_reminder)",
  "query": "search query (for search)",
  "contactName": "contact name (for ai_summary, search, or add_reminder)",
  "newContact": true/false (for quick_add_interaction),
  "daysAgo": <number of days ago, 0 for today> (for quick_add_interaction),
  "dateText": "date/time mentioned (for add_reminder, e.g., 'next week', 'tomorrow', 'in 3 days')"
}

Examples:
"I just had coffee with Sarah" -> {"action": "quick_add_interaction", "text": "I just had coffee with Sarah", "newContact": false, "daysAgo": 0}
"Had lunch with Matt Walters yesterday" -> {"action": "quick_add_interaction", "text": "Had lunch with Matt Walters yesterday", "newContact": false, "daysAgo": 1}
"Called Mike" -> {"action": "quick_add_interaction", "text": "Called Mike", "newContact": false, "daysAgo": 0}
"Met with John Smith today, new contact" -> {"action": "quick_add_interaction", "text": "Met with John Smith today, new contact", "newContact": true, "daysAgo": 0}
"Create new contact for Jane Doe" -> {"action": "quick_add_interaction", "text": "Create new contact for Jane Doe", "newContact": true, "daysAgo": 0}
"Find John Smith" -> {"action": "search", "query": "John Smith"}
"Summary Sarah Johnson" -> {"action": "ai_summary", "contactName": "Sarah Johnson"}
"Summarize contact Aaron Klish" -> {"action": "ai_summary", "contactName": "Aaron Klish"}
"Tell me about Mike" -> {"action": "ai_summary", "contactName": "Mike"}
"Add new contact" -> {"action": "add_contact"}
"Add reminder for John Smith" -> {"action": "add_reminder", "contactName": "John Smith", "dateText": "", "text": "Add reminder for John Smith"}
"Remind me to follow up with Sarah next week" -> {"action": "add_reminder", "contactName": "Sarah", "dateText": "next week", "text": "follow up with Sarah"}
"Set reminder to call Mike tomorrow" -> {"action": "add_reminder", "contactName": "Mike", "dateText": "tomorrow", "text": "call Mike"}`

    const intentResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: intentPrompt }]
    })
    
    let intent
    try {
      const responseText = intentResponse.response
      console.log('Voice command:', commandText)
      console.log('AI response:', responseText)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        intent = JSON.parse(jsonMatch[0])
        console.log('Parsed intent:', JSON.stringify(intent))
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error('Failed to parse intent:', intentResponse.response)
      // Fallback: assume quick add interaction
      return c.json({
        action: 'quick_add_interaction',
        text: commandText,
        message: 'Processing as interaction note'
      })
    }
    
    // Step 3: Execute action based on intent
    console.log('Intent action:', intent.action)
    if (intent.action === 'search') {
      return c.json({
        action: 'search',
        query: intent.query || intent.contactName || commandText
      })
    } else if (intent.action === 'ai_summary') {
      // Try to find the contact with fuzzy matching
      const contactName = intent.contactName || commandText
      const contactsResult = await c.env.DB.prepare(
        'SELECT id, name FROM contacts WHERE user_id = ?'
      ).bind(user.id).all()
      
      // Helper function for fuzzy name matching
      const fuzzyMatch = (name1: string, name2: string): boolean => {
        const n1 = name1.toLowerCase().trim()
        const n2 = name2.toLowerCase().trim()
        
        // Exact match
        if (n1 === n2) return true
        
        // Contains match
        if (n1.includes(n2) || n2.includes(n1)) return true
        
        // Split into words and check if most words match
        const words1 = n1.split(/\s+/)
        const words2 = n2.split(/\s+/)
        
        // Check first name match (most important)
        if (words1[0] && words2[0] && words1[0] === words2[0]) {
          // If first names match, check if last name is similar
          if (words1.length > 1 && words2.length > 1) {
            const lastName1 = words1[words1.length - 1]
            const lastName2 = words2[words2.length - 1]
            // Check if last names start with same letters or are close
            if (lastName1.substring(0, 3) === lastName2.substring(0, 3)) {
              return true
            }
          }
          return true
        }
        
        return false
      }
      
      // Decrypt and search with fuzzy matching
      let matchedContact = null
      for (const contact of (contactsResult.results || [])) {
        const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
        if (decrypted.name && fuzzyMatch(decrypted.name, contactName)) {
          matchedContact = { id: contact.id, name: decrypted.name }
          break
        }
      }
      
      console.log('Contact name searched:', contactName, 'Matched:', matchedContact?.name || 'none')
      
      if (matchedContact) {
        return c.json({
          action: 'ai_summary',
          contactId: matchedContact.id,
          contactName: matchedContact.name
        })
      } else {
        return c.json({
          action: 'search',
          query: contactName,
          message: 'Contact not found, searching...'
        })
      }
    } else if (intent.action === 'add_contact') {
      return c.json({
        action: 'add_contact',
        message: 'Opening new contact form'
      })
    } else if (intent.action === 'add_reminder') {
      // Try to find the contact with fuzzy matching
      const contactName = intent.contactName || ''
      const contactsResult = await c.env.DB.prepare(
        'SELECT id, name FROM contacts WHERE user_id = ?'
      ).bind(user.id).all()
      
      // Helper function for fuzzy name matching
      const fuzzyMatch = (name1: string, name2: string): boolean => {
        const n1 = name1.toLowerCase().trim()
        const n2 = name2.toLowerCase().trim()
        
        // Exact match
        if (n1 === n2) return true
        
        // Contains match
        if (n1.includes(n2) || n2.includes(n1)) return true
        
        // Split into words and check if most words match
        const words1 = n1.split(/\s+/)
        const words2 = n2.split(/\s+/)
        
        // Check first name match (most important)
        if (words1[0] && words2[0] && words1[0] === words2[0]) {
          // If first names match, check if last name is similar
          if (words1.length > 1 && words2.length > 1) {
            const lastName1 = words1[words1.length - 1]
            const lastName2 = words2[words2.length - 1]
            // Check if last names start with same letters or are close
            if (lastName1.substring(0, 3) === lastName2.substring(0, 3)) {
              return true
            }
          }
          return true
        }
        
        return false
      }
      
      // Decrypt and search with fuzzy matching
      let matchedContact = null
      for (const contact of (contactsResult.results || [])) {
        const decrypted = await decryptContact(contact, c.env.ENCRYPTION_KEY)
        if (decrypted.name && fuzzyMatch(decrypted.name, contactName)) {
          matchedContact = { id: contact.id, name: decrypted.name }
          break
        }
      }
      
      if (matchedContact) {
        // Extract date from dateText if provided
        const dateText = intent.dateText || ''
        const reminderText = intent.text || commandText
        
        return c.json({
          action: 'add_reminder',
          contactId: matchedContact.id,
          contactName: matchedContact.name,
          reminderText: reminderText,
          dateText: dateText
        })
      } else {
        return c.json({
          action: 'search',
          query: contactName,
          message: 'Contact not found. Please select a contact to add reminder.'
        })
      }
    } else {
      // Default to quick_add_interaction
      return c.json({
        action: 'quick_add_interaction',
        text: intent.text || commandText,
        newContact: intent.newContact || false
      })
    }
  } catch (error) {
    console.error('Voice command error:', error)
    return c.json({ error: 'Failed to process voice command' }, 500)
  }
})

// Extract date from natural language text
app.post('/api/extract-date', requireAuth, async (c) => {
  const { text, currentDate } = await c.req.json()
  
  const dateExtractionPrompt = `Extract the date from this interaction note. Today is ${currentDate}.

Interaction text: "${text}"

Look for these date patterns and calculate days ago from ${currentDate}:

RELATIVE DATES:
- "yesterday", "last night", "last evening" = 1 day ago
- "last Tuesday", "last Monday", etc = days since last occurrence of that weekday
- "last week" = 7 days ago
- "two days ago", "3 days ago", "a week ago" = calculate exact days
- "today", "this morning", "this afternoon", "tonight" = 0 days ago

EXPLICIT DATES:
- "November 1st", "Nov 1", "11/1" = calculate days between that date and ${currentDate}
- "October 15th" = calculate days ago
- "on the 5th" = assume current month unless already passed, then calculate

NO DATE:
- If no date mentioned = 0 days ago (today)

CRITICAL: Always calculate the EXACT number of days between the mentioned date and ${currentDate}.
For explicit dates like "November 1st", count the actual days from Nov 1 to ${currentDate}.

Respond ONLY with JSON:
{
  "daysAgo": <number of days ago, 0 for today, 1 for yesterday, etc>
}

Examples:
"Had dinner yesterday with John" -> {"daysAgo":1}
"Talked last night with Sarah" -> {"daysAgo":1}
"Met on November 1st" (when today is Nov 9) -> {"daysAgo":8}
"Coffee last Tuesday" -> {"daysAgo":<calculate days since last Tuesday>}
"Called Mike" (no date) -> {"daysAgo":0}`

  try {
    const dateResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are a date extraction assistant. Respond ONLY with valid JSON. Be precise with calculations.' },
        { role: 'user', content: dateExtractionPrompt }
      ]
    })
    
    const dateText = dateResponse.response || '{}'
    let dateInfo
    try {
      const jsonMatch = dateText.match(/\{[\s\S]*?\}/)
      dateInfo = jsonMatch ? JSON.parse(jsonMatch[0]) : { daysAgo: 0 }
    } catch (e) {
      dateInfo = { daysAgo: 0 }
    }
    
    return c.json({ daysAgo: dateInfo.daysAgo || 0 })
  } catch (error) {
    console.error('Date extraction error:', error)
    return c.json({ daysAgo: 0 })
  }
})

// Quick add interaction with AI contact matching
app.post('/api/interactions/quick-add', requireAuth, async (c) => {
  const user = c.get('user')
  const { text, newContact, date } = await c.req.json()
  
  if (!text || text.trim().length === 0) {
    return c.json({ error: 'Interaction text is required' }, 400)
  }
  
  // Extract date from text if not explicitly provided
  let interactionDate = date
  if (!date) {
    interactionDate = Date.now() // Default to now if no date info provided
  }
  
  let selectedContact
  let interactionType = 'other'
  let interactionNotes = text
  let interactionLocation = null
  let isNewContact = false
  let createdContacts: any[] = []
  let createdContactNames: string[] = []
  const now = interactionDate
  
  if (newContact) {
    // User indicated this is a new contact - extract info and create (may be multiple!)
    const extractPrompt = `Extract contact information from this interaction note. There may be MULTIPLE new contacts!

"${text}"

IMPORTANT: Look for ALL person names in the text. Common patterns:
- "Met with [Name] and [Name]"
- "Talked to [Name]"
- "[Name], [Name], and I discussed..."
- "Watched game with [Name] and [Name]"

Extract for EACH person:
1. Contact name - the person's full name (REQUIRED - look carefully!)
2. Email address (if mentioned)
3. Phone number (if mentioned)
4. Company name (if mentioned)
5. Type of interaction: call, email, meeting, message, or other
6. Location where interaction took place (if mentioned)

Respond ONLY with valid JSON in this exact format (array of contacts):
{
  "contacts": [
    {
      "name": "First Last",
      "email": null,
      "phone": null,
      "company": "Company Name"
    },
    {
      "name": "Second Person",
      "email": null,
      "phone": null,
      "company": null
    }
  ],
  "interactionType": "meeting",
  "location": "Coffee shop" | null
}

Examples:
"Met with Jacob Smith today" -> {"contacts":[{"name":"Jacob Smith","email":null,"phone":null,"company":null}],"interactionType":"meeting"}
"Watched football game with Garrett Kerr and Tim Lee" -> {"contacts":[{"name":"Garrett Kerr","email":null,"phone":null,"company":null},{"name":"Tim Lee","email":null,"phone":null,"company":null}],"interactionType":"other"}`

    try {
      const extractResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a precise data extraction assistant. Extract contact information and respond ONLY with valid JSON. No explanations, just JSON.' },
          { role: 'user', content: extractPrompt }
        ]
      })
      
      const extractText = extractResponse.response || '{}'
      console.log('AI extraction response:', extractText)
      let contactInfo
      
      try {
        contactInfo = JSON.parse(extractText)
      } catch (e) {
        console.log('Failed to parse as JSON, trying to find JSON in response')
        const jsonMatch = extractText.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          contactInfo = JSON.parse(jsonMatch[0])
        } else {
          console.error('Could not find valid JSON in AI response:', extractText)
          contactInfo = { contacts: [{ name: 'Unknown Contact' }], interactionType: 'other' }
        }
      }
      
      console.log('Parsed contact info:', JSON.stringify(contactInfo))
      
      // Ensure we have an array of contacts
      const contactsToCreate = Array.isArray(contactInfo.contacts) ? contactInfo.contacts : [{ name: 'Unknown Contact' }]
      interactionType = contactInfo.interactionType || 'other'
      interactionLocation = contactInfo.location || null
      
      // Clean up the notes by removing redundant information (same as existing contact flow)
      let cleanedNotes = text
      
      // Remove any person names from the text (handles new contact names)
      const namePattern = /\b(with|to|from|met|called|emailed|messaged|texted|chatted with|talked to|spoke with|saw)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
      cleanedNotes = cleanedNotes.replace(namePattern, '$1').trim()
      
      // Remove "new contact" phrase
      cleanedNotes = cleanedNotes.replace(/\bnew\s+contact\b/gi, '').trim()
      
      // Remove created contact names
      for (const contactData of contactsToCreate) {
        if (contactData.name) {
          const nameRegex = new RegExp(`\\b${contactData.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
          cleanedNotes = cleanedNotes.replace(nameRegex, '').trim()
        }
      }
      
      // Remove common date references
      cleanedNotes = cleanedNotes.replace(/\b(yesterday|today|last\s+(week|month|night)|this\s+(morning|afternoon|evening))\b/gi, '').trim()
      
      // Remove location if extracted
      if (interactionLocation) {
        const locationRegex = new RegExp(`\\bat\\s+${interactionLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        cleanedNotes = cleanedNotes.replace(locationRegex, '').trim()
      }
      
      // Remove common prepositions and connectors left over
      cleanedNotes = cleanedNotes.replace(/^(with|to|from|at)\s+/i, '').trim()
      cleanedNotes = cleanedNotes.replace(/\s+(with|to|from|at)$/i, '').trim()
      
      // Remove trailing punctuation
      cleanedNotes = cleanedNotes.replace(/[.,;:]+$/, '').trim()
      
      // Clean up multiple spaces
      cleanedNotes = cleanedNotes.replace(/\s+/g, ' ').trim()
      
      // If we removed too much, fall back to just the interaction verb
      if (cleanedNotes.length < 3) {
        const verbMatch = text.match(/^\s*(\w+)/i)
        cleanedNotes = verbMatch ? verbMatch[1] : text
      }
      
      interactionNotes = cleanedNotes
      
      // Create all new contacts and their interactions
      for (const contactData of contactsToCreate) {
        const newContactId = crypto.randomUUID()
        const name = contactData.name || 'Unknown Contact'
        const email = contactData.email || null
        const phone = contactData.phone || null
        const company = contactData.company || null
        
        // Encrypt contact data
        const encryptedData = await encryptContact({
          name,
          email,
          phone,
          company,
          address: null,
          birthday: null,
          notes: `Auto-created from quick add interaction`
        }, c.env.ENCRYPTION_KEY)
        
        await c.env.DB.prepare(
          `INSERT INTO contacts 
           (id, user_id, name, email, phone, title, company, birthday, relationship_status, 
            tags, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          newContactId,
          (user as any).id,
          encryptedData.name,
          encryptedData.email,
          encryptedData.phone,
          null, // title
          company,
          null, // birthday
          'MONTHLY', // relationship_status
          JSON.stringify([]), // tags
          `Auto-created from quick add interaction`,
          now,
          now
        ).run()
        
        createdContacts.push({
          id: newContactId,
          name,
          email,
          phone,
          company
        })
        createdContactNames.push(name)
      }
      
      // We'll create interactions for all contacts after this catch block
      isNewContact = true
      selectedContact = null // Will create interactions for all createdContacts
      
    } catch (extractError: any) {
      console.error('Error creating new contact:', extractError)
      return c.json({ 
        error: 'Could not create new contact automatically. Please add manually.',
        details: extractError?.message || 'Unknown error'
      }, 400)
    }
  } else {
    // Try to match to existing contact
    const contactsResult = await c.env.DB.prepare(
      'SELECT * FROM contacts WHERE user_id = ?'
    ).bind((user as any).id).all()
    
    if (!contactsResult.results || contactsResult.results.length === 0) {
      return c.json({ error: 'No contacts found. Please add contacts first or check "new contact".' }, 400)
    }
    
    // Decrypt contacts
    const contacts: any[] = []
    for (const encContact of contactsResult.results) {
      const contact = await decryptContact(encContact, c.env.ENCRYPTION_KEY)
      contact.id = encContact.id
      contact.tags = encContact.tags ? JSON.parse(encContact.tags) : []
      contacts.push(contact)
    }
    
    console.log('[Contact Matching] Total contacts:', contacts.length)
    
    // FIRST: Try direct name matching (faster and doesn't use AI tokens)
    const textLower = text.toLowerCase()
    
    // Try to find the best matches with priority:
    // 1. Full name exact match (e.g., "aaron davis" matches "Aaron Davis")
    // 2. All name parts present (e.g., "talked to aaron ... davis" matches "Aaron Davis")
    // 3. First + last name both present (e.g., "aaron" and "davis" both in text)
    // 4. First name only (only if no better matches found)
    
    const fullNameMatches: any[] = []
    const allPartsMatches: any[] = []
    const firstLastMatches: any[] = []
    const firstNameMatches: any[] = []
    
    for (const contact of contacts) {
      const nameLower = contact.name.toLowerCase()
      const nameParts = nameLower.split(/\s+/)
      
      // Priority 1: Check if full name appears in text
      if (textLower.includes(nameLower)) {
        console.log(`[Direct Match] Full name match: "${nameLower}"`)
        fullNameMatches.push(contact)
        continue
      }
      
      // Priority 2: Check if all parts of the name appear in text (even if not adjacent)
      if (nameParts.length > 1 && nameParts.every((part: string) => textLower.includes(part))) {
        console.log(`[Direct Match] All parts match: "${nameParts.join(' ')}"`)
        allPartsMatches.push(contact)
        continue
      }
      
      // Priority 3: Check if first name and last name both appear
      if (nameParts.length >= 2) {
        const firstName = nameParts[0]
        const lastName = nameParts[nameParts.length - 1]
        if (textLower.includes(firstName) && textLower.includes(lastName)) {
          console.log(`[Direct Match] First+Last match: "${firstName} ${lastName}"`)
          firstLastMatches.push(contact)
          continue
        }
      }
      
      // Priority 4: Check for first name only (lowest priority)
      if (nameParts.length >= 1 && nameParts[0].length > 3) {
        const firstName = nameParts[0]
        const escapedFirstName = firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const firstNameRegex = new RegExp(`\\b${escapedFirstName}\\b`, 'i')
        if (firstNameRegex.test(text)) {
          console.log(`[Direct Match] First name only match: "${firstName}"`)
          firstNameMatches.push(contact)
        }
      }
    }
    
    // Use the highest priority matches found
    let directMatches: any[] = []
    if (fullNameMatches.length > 0) {
      directMatches = fullNameMatches
      console.log('[Contact Matching] Using full name matches:', fullNameMatches.map(c => c.name).join(', '))
    } else if (allPartsMatches.length > 0) {
      directMatches = allPartsMatches
      console.log('[Contact Matching] Using all-parts matches:', allPartsMatches.map(c => c.name).join(', '))
    } else if (firstLastMatches.length > 0) {
      directMatches = firstLastMatches
      console.log('[Contact Matching] Using first+last matches:', firstLastMatches.map(c => c.name).join(', '))
    } else if (firstNameMatches.length > 0) {
      // Only use first name matches if nothing better was found
      directMatches = firstNameMatches
      console.log('[Contact Matching] Using first name only matches:', firstNameMatches.map(c => c.name).join(', '))
    }
    
    console.log('[Contact Matching] Final direct matches:', directMatches.length, directMatches.map(c => c.name).join(', '))
    
    // If we found direct matches, use them immediately
    if (directMatches.length > 0) {
      // If multiple matches at same priority level, pick the best one
      // Prefer longer names (more specific) and exact case matches
      let bestMatch = directMatches[0]
      if (directMatches.length > 1) {
        console.log(`[Contact Matching] Multiple matches found (${directMatches.length}), selecting best match`)
        
        // Score each match
        const scoredMatches = directMatches.map(contact => {
          let score = 0
          const nameLower = contact.name.toLowerCase()
          
          // Prefer longer names (more specific)
          score += nameLower.length
          
          // Prefer exact case match
          if (text.includes(contact.name)) {
            score += 100
          }
          
          // Prefer matches where the full name appears as consecutive words
          if (textLower.includes(nameLower)) {
            score += 50
          }
          
          return { contact, score }
        })
        
        // Sort by score descending
        scoredMatches.sort((a, b) => b.score - a.score)
        bestMatch = scoredMatches[0].contact
        
        console.log(`[Contact Matching] Selected "${bestMatch.name}" as best match (score: ${scoredMatches[0].score})`)
      }
      
      // Determine interaction type and location from text
      let interactionType = 'other'
      let interactionLocation = null
      
      // Simple keyword-based type detection
      const textLowerForType = text.toLowerCase()
      if (textLowerForType.includes('call') || textLowerForType.includes('called') || textLowerForType.includes('phone')) {
        interactionType = 'call'
      } else if (textLowerForType.includes('email') || textLowerForType.includes('emailed')) {
        interactionType = 'email'
      } else if (textLowerForType.includes('meet') || textLowerForType.includes('met') || textLowerForType.includes('lunch') || textLowerForType.includes('dinner') || textLowerForType.includes('coffee')) {
        interactionType = 'meeting'
      } else if (textLowerForType.includes('message') || textLowerForType.includes('messaged') || textLowerForType.includes('text') || textLowerForType.includes('texted')) {
        interactionType = 'message'
      }
      
      // Simple location extraction - look for "at [location]"
      const atMatch = text.match(/\bat\s+([^,.\n]+)/i)
      if (atMatch && atMatch[1]) {
        interactionLocation = atMatch[1].trim()
      }
      
      // Clean up the notes by removing redundant information
      let cleanedNotes = text
      
      // Strategy: Remove anything that looks like a person's name after common interaction verbs
      // This handles cases where the transcribed name differs slightly from the contact name
      const namePattern = /\b(with|to|from|met|called|emailed|messaged|texted|chatted with|talked to|spoke with|saw)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
      cleanedNotes = cleanedNotes.replace(namePattern, '$1').trim()
      
      // Also try to remove the exact contact name if it's still there
      const nameRegex = new RegExp(`\\b${bestMatch.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      cleanedNotes = cleanedNotes.replace(nameRegex, '').trim()
      
      // Remove common date references
      cleanedNotes = cleanedNotes.replace(/\b(yesterday|today|last\s+(week|month|night)|this\s+(morning|afternoon|evening))\b/gi, '').trim()
      
      // Remove location if extracted
      if (interactionLocation) {
        const locationRegex = new RegExp(`\\bat\\s+${interactionLocation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
        cleanedNotes = cleanedNotes.replace(locationRegex, '').trim()
      }
      
      // Remove common prepositions and connectors left over
      cleanedNotes = cleanedNotes.replace(/^(with|to|from|at)\s+/i, '').trim()
      cleanedNotes = cleanedNotes.replace(/\s+(with|to|from|at)$/i, '').trim()
      
      // Clean up multiple spaces
      cleanedNotes = cleanedNotes.replace(/\s+/g, ' ').trim()
      
      // If we removed too much, fall back to just the interaction verb
      if (cleanedNotes.length < 3) {
        // Extract just the action word (first word that's a verb)
        const verbMatch = text.match(/^\s*(\w+)/i)
        cleanedNotes = verbMatch ? verbMatch[1] : text
      }
      
      selectedContact = bestMatch
      interactionNotes = cleanedNotes
      
      // Create interaction for ONLY the best match (not all matches)
      const interactionId = crypto.randomUUID()
      await c.env.DB.prepare(
        'INSERT INTO interactions (id, contact_id, type, date, notes, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(interactionId, bestMatch.id, interactionType, now, interactionNotes, interactionLocation, now).run()
      
      console.log(`[Direct Match] Created interaction for: ${bestMatch.name}`)
      
      return c.json({ 
        success: true,
        contactId: bestMatch.id,
        contactName: bestMatch.name,
        contactCount: 1,
        contactNames: [bestMatch.name],
        interactionType,
        interactionNotes,
        isNewContact: false
      })
    }
    
    // FALLBACK: If no direct matches, try AI with limited contact list (to avoid token limits)
    console.log('[Contact Matching] No direct matches, trying AI with limited contacts')
    
    // Only send top 50 contacts to AI to avoid token limit
    const limitedContacts = contacts.slice(0, 50)
    const contactsList = limitedContacts.map((c, idx) => 
      `${idx + 1}. ${c.name}${c.email ? ` (${c.email})` : ''}${c.company ? ` - ${c.company}` : ''}${c.tags.length > 0 ? ` [${c.tags.join(', ')}]` : ''}`
    ).join('\n')
    
    const prompt = `You are analyzing an interaction note to determine which contact(s) it refers to.

Interaction text: "${text}"

Available contacts:
${contactsList}

CRITICAL INSTRUCTIONS FOR NAME MATCHING:
- Look for ANY person names mentioned in the text (e.g., "Chatted with Aaron Davis" -> look for "Aaron Davis")
- Match FULL NAMES exactly (e.g., "Aaron Davis" should match contact "Aaron Davis")
- Match FIRST NAME + LAST NAME even if separated (e.g., "talked to Aaron ... Davis" -> "Aaron Davis")
- Match FIRST NAME ONLY if it's unique (e.g., "met Aaron" -> could match "Aaron Davis")
- Match LAST NAME ONLY if it's unique (e.g., "saw Davis" -> could match "Aaron Davis")
- Common interaction verbs: "met with", "talked to", "chatted with", "saw", "called", "emailed", "messaged"
- This interaction may involve MULTIPLE contacts (e.g., "Met with John and Sarah")
- ALWAYS extract the person's name from the text first, then find which contact number matches

Step-by-step process:
1. Extract ALL person names from the interaction text (look after words like "with", "to", "from")
2. For each extracted name, find which contact number(s) match
3. Determine interaction type from context (call, email, meeting, message, other)
4. Extract location if mentioned

Respond in this exact JSON format:
{
  "contactNumbers": [<number>, <number>, ...],
  "type": "<type>",
  "location": "<location>" | null
}

Examples:
"Chatted with Aaron Davis yesterday at church" + contacts list includes "2. Aaron Davis" -> {"contactNumbers": [2], "type": "other", "location": "church"}
"Had lunch with Matt Walters at Starbucks" + contacts list includes "1. Matt Walters" -> {"contactNumbers": [1], "type": "meeting", "location": "Starbucks"}
"Met with John and Sarah" + list has "1. John Smith" and "3. Sarah Jones" -> {"contactNumbers": [1, 3], "type": "meeting", "location": null}
"Called Mike yesterday" + list has "2. Mike Johnson" -> {"contactNumbers": [2], "type": "call", "location": null}
"Talked to Sarah Jones" + list has "3. Sarah Jones" -> {"contactNumbers": [3], "type": "other", "location": null}

IMPORTANT: Always try to find a match by extracting names from the text. Only use empty array [] if absolutely no name match is possible.`

    try {
      const aiResponse = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a helpful assistant that analyzes interaction notes and matches them to contacts. Always respond with valid JSON only.' },
          { role: 'user', content: prompt }
        ]
      })
      
      const responseText = aiResponse.response || '{}'
      console.log('[Contact Matching] Interaction text:', text)
      console.log('[Contact Matching] Available contacts:', contacts.length)
      console.log('[Contact Matching] AI response:', responseText)
      
      // Try to extract JSON from the response
      let parsed
      try {
        parsed = JSON.parse(responseText)
      } catch (e) {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Could not parse AI response')
        }
      }
      
      console.log('[Contact Matching] Parsed result:', JSON.stringify(parsed))
      
      const contactNumbers = Array.isArray(parsed.contactNumbers) ? parsed.contactNumbers : [parsed.contactNumber]
      const validContactNumbers = contactNumbers.filter((num: any) => {
        const n = parseInt(num)
        return n >= 1 && n <= limitedContacts.length
      })
      
      console.log('[Contact Matching] Valid contact numbers:', validContactNumbers)
      
      if (validContactNumbers.length === 0) {
        console.log('[Contact Matching] AI found no matches either')
        return c.json({ 
          error: 'Could not determine which contact this interaction is about. Try checking "new contact" if this is someone new.',
          aiResponse: responseText,
          availableContacts: contacts.slice(0, 20).map(c => c.name).join(', ')
        }, 400)
      }
      
      // Ensure we have valid contact numbers
      if (validContactNumbers.length === 0) {
        console.log('[Contact Matching] No valid contacts found after all attempts')
        return c.json({ 
          error: 'Could not determine which contact this interaction is about. Try checking "new contact" if this is someone new.',
          aiResponse: responseText,
          availableContacts: contacts.map(c => c.name).join(', ')
        }, 400)
      }
      
      // Get all matched contacts - filter out any undefined results
      const selectedContacts = validContactNumbers
        .map((num: any) => {
          const index = parseInt(num) - 1
          if (index >= 0 && index < limitedContacts.length) {
            return limitedContacts[index]
          }
          console.warn(`[Contact Matching] Invalid contact number: ${num}, index: ${index}, limitedContacts length: ${limitedContacts.length}`)
          return null
        })
        .filter((c: any) => c !== null)
      
      if (selectedContacts.length === 0) {
        console.error('[Contact Matching] No valid contacts after filtering')
        return c.json({ 
          error: 'Could not match to valid contacts.',
          availableContacts: contacts.map(c => c.name).join(', ')
        }, 400)
      }
      
      selectedContact = selectedContacts[0] // For backward compatibility
      interactionType = parsed.type || 'other'
      interactionNotes = text // Use the full transcription, not a summary
      interactionLocation = parsed.location || null
      
      // Create interaction for ALL matched contacts
      const interactionIds = []
      const contactNames = []
      
      for (const contact of selectedContacts) {
        const interactionId = crypto.randomUUID()
        await c.env.DB.prepare(
          'INSERT INTO interactions (id, contact_id, type, date, notes, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(interactionId, contact.id, interactionType, now, interactionNotes, interactionLocation, now).run()
        
        interactionIds.push(interactionId)
        contactNames.push(contact.name)
      }
      
      console.log(`Created ${interactionIds.length} interactions for contacts: ${contactNames.join(', ')}`)
      
      return c.json({ 
        success: true,
        contactId: selectedContact.id,
        contactName: contactNames.length > 1 ? contactNames.join(' and ') : contactNames[0],
        contactCount: contactNames.length,
        contactNames: contactNames,
        interactionType,
        interactionNotes,
        isNewContact
      })
      
    } catch (error) {
      console.error('Contact matching error:', error)
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      console.error('Error details:', JSON.stringify(error))
      return c.json({ 
        error: 'Failed to match contact. Try checking "new contact" if this is someone new.',
        details: error instanceof Error ? error.message : String(error)
      }, 500)
    }
  }
  
  // Create the interaction(s) for new contact(s) case
  if (isNewContact && typeof createdContacts !== 'undefined') {
    // Multiple new contacts - create interaction for each
    for (const contact of createdContacts) {
      const interactionId = crypto.randomUUID()
      
      await c.env.DB.prepare(
        'INSERT INTO interactions (id, contact_id, type, date, notes, location, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(interactionId, contact.id, interactionType, now, interactionNotes, interactionLocation, now).run()
    }
    
    return c.json({ 
      success: true,
      contactId: createdContacts[0].id,
      contactName: createdContactNames.length > 1 ? createdContactNames.join(' and ') : createdContactNames[0],
      contactCount: createdContactNames.length,
      contactNames: createdContactNames,
      interactionType,
      interactionNotes,
      isNewContact
    })
  }
  
  // Shouldn't reach here, but just in case
  return c.json({ error: 'Unknown error occurred' }, 500)
})

const root = new Hono<{ Bindings: Env }>()
root.route('/link', app)
root.route('/', app)

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const redirectTarget = linkprmRedirectTarget(request)
    if (redirectTarget) {
      return Response.redirect(redirectTarget, 301)
    }
    return root.fetch(request, env, ctx)
  },
}
