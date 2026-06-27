// HTML templates for server-side rendering

function abbreviateName(fullName: string): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function navUserLabel(user: { ahrens_username?: string | null }): string {
  const username = (user.ahrens_username || '').trim()
  if (username) return escapeHtml(username)
  return ''
}

/** Identical site-menu drawer markup as classify.html */
const APP_SITE_MENU_DRAWER = `
        <div id="th-site-menu-backdrop" class="th-site-menu-backdrop" hidden></div>
        <div id="th-site-menu" class="th-site-menu" aria-hidden="true">
            <div class="th-site-menu-head">
                <a href="https://ahrenslabs.com/index.html" class="th-site-menu-brand">
                    <img src="https://ahrenslabs.com/img/EagleLogo.png" alt="" class="header-logo">
                    <span>Ahrens Labs</span>
                </a>
                <button type="button" class="th-site-menu-close" id="th-site-menu-close" aria-label="Close menu">&times;</button>
            </div>
            <nav>
                <ul></ul>
            </nav>
            <div class="th-site-menu-footer">
                <a href="/auth/signout" class="th-site-menu-signout al-site-menu-signout" id="th-site-menu-signout">Sign Out</a>
            </div>
        </div>`

function linkAppHeader(authRight = ''): string {
  const authBlock = authRight
    ? `            <div class="th-topbar-auth" id="header-auth-buttons">
                ${authRight}
            </div>`
    : ''
  return `<header class="th-app-header">
        <div class="th-app-topbar">
            <div class="th-topbar-start">
                <button type="button" class="th-hamburger" id="th-site-menu-btn" aria-label="Open site menu" aria-expanded="false" aria-controls="th-site-menu">
                    <span></span><span></span><span></span>
                </button>
                <div class="th-topbar-brand">
                    <img src="/icon-192.png" alt="" width="32" height="32">
                    <h1 class="th-topbar-title link-topbar-title">Link</h1>
                </div>
            </div>
${authBlock}
        </div>
${APP_SITE_MENU_DRAWER}
    </header>`
}

export function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title} - Link</title>
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/icon-192.png">
  <link rel="manifest" href="/manifest.json">
  <meta name="theme-color" content="#16a34a">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Link">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="application-name" content="Link">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://ahrenslabs.com/css/style.css">
  <link rel="stylesheet" href="https://ahrenslabs.com/css/app-site-menu.css?v=20260627l">
  <style>
    .link-topbar-title { color: #16a34a; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { 
      height: 100%;
      width: 100%;
      position: relative;
      overflow-x: hidden;
    }
    body { 
      display: block !important;
      min-height: 100vh;
      justify-content: flex-start !important;
      align-items: stretch !important;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      background: #f9fafb !important;
      color: #111827;
    }
    header.th-app-header {
      padding-top: env(safe-area-inset-top, 0px);
    }
    h1, h2, h3, h4, h5, h6 { 
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; 
      letter-spacing: -0.015em;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 1rem; padding-bottom: 20px; }
    .nav { background: white; border-bottom: 1px solid #e5e7eb; padding: 1rem; }
    .nav-content { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; }
    .nav-leading { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .nav-left { display: flex; align-items: center; gap: 10px; }
    .link-nav-brand {
      display: flex; align-items: center; gap: 8px; min-width: 0; text-decoration: none;
    }
    .link-nav-logo-img { width: 32px; height: 32px; flex-shrink: 0; border-radius: 8px; }
    .logo { 
      font-size: 1.75rem; 
      font-weight: 700; 
      color: #16a34a; 
      text-decoration: none; 
      letter-spacing: -0.025em;
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1;
    }
    .link-nav-brand .logo { color: inherit; }
    .btn { 
      padding: 0.5rem 1rem; 
      border-radius: 0.5rem; 
      border: none; 
      cursor: pointer; 
      text-decoration: none; 
      display: inline-block;
      font-size: 0.875rem;
    }
    .btn-primary { background: #16a34a; color: white; }
    .btn-primary:hover { background: #15803d; }
    .btn-secondary { background: white; color: #374151; border: 1px solid #d1d5db; }
    .btn-secondary:hover { background: #f9fafb; }
    .btn-danger { background: #ef4444; color: white; }
    .btn-danger:hover { background: #dc2626; }
    .card { background: white; border-radius: 0.5rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-label { display: block; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.875rem; }
    .form-input, .form-select, .form-textarea { 
      width: 100%; 
      padding: 0.5rem; 
      border: 1px solid #d1d5db; 
      border-radius: 0.375rem; 
      font-size: 0.875rem;
    }
    .form-textarea { resize: vertical; min-height: 80px; }
    .alert { padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .grid { display: grid; gap: 1rem; }
    .grid-2 { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 640px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .text-center { text-align: center; }
    .mt-4 { margin-top: 1rem; }
    .mb-4 { margin-bottom: 1rem; }
    .flex { display: flex; gap: 0.5rem; align-items: center; }
    .flex-between { display: flex; justify-content: space-between; align-items: center; }
    .text-sm { font-size: 0.875rem; }
    .text-gray { color: #6b7280; }
    a { color: #16a34a; text-decoration: none; }
    a:hover { text-decoration: underline; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { font-weight: 600; background: #f9fafb; }
    .modal { 
      display: none; 
      position: fixed; 
      top: 0; 
      left: 0; 
      right: 0; 
      bottom: 0; 
      background: rgba(0,0,0,0.5); 
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    .modal.active { display: flex; }
    .modal-content { 
      background: white; 
      border-radius: 0.5rem; 
      padding: 2rem; 
      max-width: 500px; 
      width: 90%; 
      max-height: 90vh; 
      overflow-y: auto;
    }
    .voice-assistant-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 0.75rem;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      z-index: 1000;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .voice-assistant-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #16a34a;
      color: white;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.2s, box-shadow 0.2s;
      flex-shrink: 0;
    }
    .voice-assistant-btn:hover {
      transform: scale(1.1);
    }
    .voice-indicator {
      position: absolute;
      top: 4.5rem;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.9);
      color: white;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      display: none;
      align-items: center;
      gap: 0.5rem;
      z-index: 1000;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-width: 300px;
      font-size: 0.875rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Bottom Navigation */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      background: white;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-around;
      padding: 0.5rem 0;
      padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
      z-index: 9999;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      transform: translate3d(0, 0, 0);
      -webkit-transform: translate3d(0, 0, 0);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      will-change: transform;
    }
    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 0.5rem 1rem;
      color: #6b7280;
      text-decoration: none;
      font-size: 0.75rem;
      transition: color 0.2s;
      min-width: 70px;
    }
    .bottom-nav-item:hover {
      text-decoration: none;
      color: #16a34a;
    }
    .bottom-nav-item.active {
      color: #16a34a;
    }
    .bottom-nav-icon {
      font-size: 1.5rem;
    }
    .content-wrapper {
      min-height: 100vh;
      padding-bottom: 100px; /* Space for bottom nav */
    }
    .footer-links {
      text-align: center;
      padding: 1rem 0 5rem 0;
      font-size: 0.75rem;
      color: #9ca3af;
    }
    .footer-links a {
      color: #9ca3af;
      text-decoration: none;
    }
    .footer-links a:hover {
      color: #16a34a;
      text-decoration: underline;
    }
    .footer-links span {
      margin: 0 0.5rem;
    }
    
    /* Calendar responsive styles */
    .calendar-container {
      width: 100%;
      max-width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }
    .calendar-grid, .calendar-header {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }
    @media (max-width: 768px) {
      body {
        overflow-x: hidden !important;
      }
      .container {
        padding: 0 !important;
        margin: 0 !important;
        max-width: 100% !important;
      }
      .calendar-container {
        padding: 0.125rem !important;
        margin: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      .calendar-container > div:first-child {
        margin-bottom: 0.25rem !important;
        padding: 0 0.25rem !important;
      }
      .calendar-container h3 {
        font-size: 0.875rem !important;
        white-space: nowrap !important;
      }
      .calendar-container .btn {
        padding: 0.375rem 0.625rem !important;
        font-size: 1rem !important;
        min-width: 36px !important;
        min-height: 36px !important;
      }
      .calendar-grid {
        gap: 0 !important;
      }
      .calendar-header {
        gap: 0 !important;
        margin-bottom: 0 !important;
      }
      .calendar-cell {
        min-height: 38px !important;
        padding: 1px !important;
        border-radius: 0 !important;
        border: 0.5px solid #e5e7eb !important;
        margin: 0 !important;
      }
      .calendar-day-number {
        font-size: 0.5rem !important;
        margin-bottom: 0 !important;
        line-height: 1 !important;
      }
      .calendar-header > div {
        font-size: 0.5rem !important;
        padding: 2px !important;
        line-height: 1 !important;
      }
      /* Hide full day names, show abbreviations */
      .calendar-header .day-full {
        display: none !important;
      }
      .calendar-header .day-abbr {
        display: inline !important;
      }
      .interactions-calendar .calendar-cell {
        aspect-ratio: auto !important;
        min-height: 72px !important;
      }
    }
    @media (max-width: 480px) {
      .calendar-container {
        padding: 0 !important;
      }
      .calendar-container > div:first-child {
        padding: 0 0.125rem !important;
      }
      .calendar-container h3 {
        font-size: 0.75rem !important;
      }
      .calendar-container .btn {
        padding: 0.25rem 0.5rem !important;
        font-size: 0.875rem !important;
        min-width: 32px !important;
        min-height: 32px !important;
      }
      .calendar-cell {
        min-height: 32px !important;
        padding: 0.5px !important;
      }
      .calendar-day-number {
        font-size: 0.45rem !important;
      }
      .calendar-header > div {
        font-size: 0.45rem !important;
        padding: 1px !important;
      }
      .interactions-calendar .calendar-cell {
        min-height: 64px !important;
      }
    }
    /* Show full day names by default */
    .calendar-header .day-abbr {
      display: none;
    }
    .calendar-header .day-full {
      display: inline;
    }
    /* Calendar cell name handling */
    .contact-name-full {
      display: inline;
    }
    .contact-name-abbr {
      display: none;
    }
    @media (max-width: 768px) {
      .contact-name-full {
        display: none;
      }
      .contact-name-abbr {
        display: inline;
      }
    }
    .th-site-menu nav ul,
    .th-site-menu nav li {
      list-style: none !important;
    }
    .th-site-menu nav a::before,
    .th-site-menu nav a::after,
    .th-site-menu nav > ul > li::after,
    .th-site-menu nav li.nav-dropdown::after {
      display: none !important;
      content: none !important;
    }
    .th-site-menu nav a,
    .th-site-menu nav a.active {
      animation: none !important;
      transform: none !important;
    }
  </style>
</head>
<body class="link-app">
  ${content}

  <script src="https://ahrenslabs.com/js/script.js"></script>
  <script src="https://ahrenslabs.com/js/link_auth.js"></script>
  <script src="https://ahrenslabs.com/js/header_nav.js?v=20260627h"></script>
  <script>
  (function () {
    if (!('serviceWorker' in navigator)) return;
    var base = location.pathname.startsWith('/link') ? '/link' : '';
    window.addEventListener('load', function () {
      navigator.serviceWorker.register(base + '/sw.js', { scope: base ? base + '/' : '/' }).catch(function () {});
    });
  })();
  </script>
  
  <div id="voiceAssistantIndicator" class="voice-indicator">
    🔴 Listening... Say your command
  </div>
  
  <script>
    ${getVoiceAssistantScript()}
  </script>
</body>
</html>`
}

function getVoiceAssistantScript(): string {
  return `
    <script>
    // Voice Assistant functionality (Global)
    let assistantMediaRecorder = null;
    let assistantAudioChunks = [];
    let isAssistantRecording = false;
    let silenceTimer = null;
    let audioContext = null;
    let analyser = null;
    
    async function toggleVoiceAssistant() {
      if (!isAssistantRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          assistantMediaRecorder = new MediaRecorder(stream);
          assistantAudioChunks = [];
          
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaStreamSource(stream);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          
          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);
          
          const checkSilence = () => {
            if (!isAssistantRecording) return;
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / bufferLength;
            
            if (average !== 0 && (average - 10) !== 0 && (Math.abs(average - 10) === (average - 10))) {
              if (silenceTimer) clearTimeout(silenceTimer);
              silenceTimer = setTimeout(() => {
                if (isAssistantRecording) stopAssistantRecording();
              }, 2000);
            }
            
            if (isAssistantRecording) requestAnimationFrame(checkSilence);
          };
          
          assistantMediaRecorder.ondataavailable = (event) => {
            assistantAudioChunks.push(event.data);
          };
          
          assistantMediaRecorder.onstop = async () => {
            const audioBlob = new Blob(assistantAudioChunks, { type: 'audio/webm' });
            await processVoiceCommand(audioBlob);
            stream.getTracks().forEach(track => track.stop());
            if (audioContext) {
              audioContext.close();
              audioContext = null;
            }
          };
          
          assistantMediaRecorder.start();
          isAssistantRecording = true;
          const assistantBtn = document.getElementById('voiceAssistantBtn');
          if (assistantBtn) {
            assistantBtn.innerHTML = '⏹️';
            assistantBtn.style.background = '#ef4444';
          }
          document.getElementById('voiceAssistantIndicator').style.display = 'flex';
          checkSilence();
        } catch (error) {
          console.error('Microphone error:', error);
          if (error.name === 'NotAllowedError') {
            alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
          } else if (error.name === 'NotFoundError') {
            alert('No microphone found. Please ensure a microphone is connected and try again.');
          } else if (error.name === 'NotSupportedError') {
            alert('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Safari.');
          } else if (window.location.protocol !== 'https:') {
            alert('Microphone access requires HTTPS. Please access this site using https://');
          } else {
            alert('Error accessing microphone: ' + error.message + '. Please check your browser permissions.');
          }
        }
      } else {
        stopAssistantRecording();
      }
    }
    
    function stopAssistantRecording() {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
      if (assistantMediaRecorder && isAssistantRecording) {
        assistantMediaRecorder.stop();
        isAssistantRecording = false;
        const assistantBtn = document.getElementById('voiceAssistantBtn');
        if (assistantBtn) {
          assistantBtn.innerHTML = '🎤';
          assistantBtn.style.background = '#16a34a';
        }
        document.getElementById('voiceAssistantIndicator').style.display = 'none';
      }
    }
    
    if ('speechSynthesis' in window) {
      speechSynthesis.addEventListener('voiceschanged', () => {});
      speechSynthesis.getVoices();
    }
    
    function speak(text) {
      if ('speechSynthesis' in window) {
        let cleanText = text
          .replace(/[*_~#]/g, '')
          .replace(/\\\\\`/g, '')
          .replace(/\\\\s+/g, ' ')
          .replace(/^(Here is|Here's|This is|Based on|According to)\\\\s+/i, '')
          .replace(/\\\\b(the following|aforementioned)\\\\b/gi, '')
          .trim();
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voices = window.speechSynthesis.getVoices();
        const voicePriority = [
          v => v.name.includes('Premium') || v.name.includes('Neural'),
          v => v.name.includes('Google US English'),
          v => v.name.includes('Google') && v.lang.startsWith('en-US'),
          v => v.name.includes('Samantha') || v.name.includes('Ava (Premium)'),
          v => v.name === 'Alex',
          v => v.name.includes('Natural') || v.name.includes('Microsoft') && v.name.includes('Online'),
          v => v.lang.startsWith('en-US') || v.lang.startsWith('en_US'),
          v => v.lang.startsWith('en')
        ];
        
        let selectedVoice = null;
        for (const priorityFn of voicePriority) {
          selectedVoice = voices.find(priorityFn);
          if (selectedVoice) break;
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
          console.log('Using voice:', selectedVoice.name);
        }
        
        utterance.rate = selectedVoice?.name.includes('Google') ? 0.95 : 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
    
    async function processVoiceCommand(audioBlob) {
      const indicator = document.getElementById('voiceAssistantIndicator');
      indicator.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><span>Processing...</span></div>';
      
      try {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const response = await fetch('/api/voice-command', {
          method: 'POST',
          body: formData
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Voice command result:', result);
          indicator.style.display = 'none';
          
          if (result.action === 'quick_add_interaction') {
            indicator.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><span>Adding...</span></div>';
            indicator.style.display = 'flex';
            
            try {
              const now = new Date();
              const daysAgo = Number.isFinite(result.daysAgo) ? result.daysAgo : 0;
              const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
              const localTimestamp = targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000);
              
              const quickAddResponse = await fetch("/api/interactions/quick-add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: result.text, newContact: result.newContact || false, date: localTimestamp })
              });
              
              if (quickAddResponse.ok) {
                const quickAddResult = await quickAddResponse.json();
                let message;
                if (result.newContact) {
                  message = 'New contact created and interaction added to ' + quickAddResult.contactName;
                } else if (quickAddResult.contactCount && (quickAddResult.contactCount !== 1)) {
                  message = 'Interaction added to ' + quickAddResult.contactCount + ' contacts: ' + quickAddResult.contactName;
                } else {
                  message = 'Interaction added to ' + quickAddResult.contactName;
                }
                indicator.innerHTML = '✅ ' + message;
                speak(message);
                setTimeout(() => window.location.reload(), 2500);
              } else {
                const errorData = await quickAddResponse.json();
                console.error('Quick add failed:', errorData);
                const errorMsg = errorData.error || 'Unknown error';
                if (errorData.availableContacts) {
                  console.log('Available contacts:', errorData.availableContacts);
                }
                if (errorData.aiResponse) {
                  console.log('AI response:', errorData.aiResponse);
                }
                indicator.innerHTML = '❌ ' + errorMsg;
                speak(errorMsg);
                setTimeout(() => indicator.style.display = 'none', 5000);
              }
            } catch (error) {
              console.error('Quick add error:', error);
              indicator.innerHTML = '❌ Error adding interaction';
              setTimeout(() => indicator.style.display = 'none', 3000);
            }
          } else if (result.action === 'search') {
            window.location.href = '/dashboard?search=' + encodeURIComponent(result.query);
          } else if (result.action === 'ai_summary') {
            if (result.contactId) {
              indicator.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><span>Generating summary...</span></div>';
              indicator.style.display = 'flex';
              
              try {
                const summaryResponse = await fetch('/api/contacts/' + result.contactId + '/ai-summary', {
                  method: 'POST'
                });
                
                if (summaryResponse.ok) {
                  const summaryData = await summaryResponse.json();
                  indicator.innerHTML = '✅ Summary for ' + result.contactName;
                  
                  if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(summaryData.summary);
                    const voices = window.speechSynthesis.getVoices();
                    const voicePriority = [
                      v => v.name.includes('Premium') || v.name.includes('Neural'),
                      v => v.name.includes('Google US English'),
                      v => v.name.includes('Google') && v.lang.startsWith('en-US'),
                      v => v.name.includes('Samantha') || v.name.includes('Ava (Premium)'),
                      v => v.name === 'Alex',
                      v => v.name.includes('Natural') || v.name.includes('Microsoft') && v.name.includes('Online'),
                      v => v.lang.startsWith('en-US') || v.lang.startsWith('en_US'),
                      v => v.lang.startsWith('en')
                    ];
                    
                    let selectedVoice = null;
                    for (const priorityFn of voicePriority) {
                      selectedVoice = voices.find(priorityFn);
                      if (selectedVoice) break;
                    }
                    
                    if (selectedVoice) {
                      utterance.voice = selectedVoice;
                      console.log('Using voice for summary:', selectedVoice.name);
                    }
                    
                    utterance.rate = selectedVoice?.name.includes('Google') ? 0.95 : 1.0;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0;
                    utterance.onend = () => {
                      setTimeout(() => {
                        window.location.href = '/contacts/' + result.contactId;
                      }, 1000);
                    };
                    window.speechSynthesis.speak(utterance);
                  } else {
                    setTimeout(() => {
                      window.location.href = '/contacts/' + result.contactId;
                    }, 3000);
                  }
                } else {
                  indicator.innerHTML = '❌ Error';
                  setTimeout(() => indicator.style.display = 'none', 3000);
                }
              } catch (error) {
                indicator.innerHTML = '❌ Error';
                setTimeout(() => indicator.style.display = 'none', 3000);
              }
            } else {
              window.location.href = '/dashboard?search=' + encodeURIComponent(result.contactName);
            }
          } else if (result.action === 'add_contact') {
            window.location.href = '/contacts/new';
          } else if (result.action === 'add_reminder') {
            if (result.contactId) {
              indicator.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;"><div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div><span>Creating reminder...</span></div>';
              indicator.style.display = 'flex';
              
              // Parse date from dateText
              let reminderDate = new Date();
              const dateText = (result.dateText || '').toLowerCase();
              
              if (dateText.includes('tomorrow')) {
                reminderDate.setDate(reminderDate.getDate() + 1);
              } else if (dateText.includes('next week')) {
                reminderDate.setDate(reminderDate.getDate() + 7);
              } else if (dateText.includes('in 3 days') || dateText.includes('3 days')) {
                reminderDate.setDate(reminderDate.getDate() + 3);
              } else if (dateText.includes('in a week') || dateText.includes('1 week')) {
                reminderDate.setDate(reminderDate.getDate() + 7);
              } else if (dateText.match(/in (\\d+) days?/)) {
                const days = parseInt(dateText.match(/in (\\d+) days?/)[1]);
                reminderDate.setDate(reminderDate.getDate() + days);
              } else if (dateText.includes('monday')) {
                // Find next Monday
                const day = reminderDate.getDay();
                const daysUntilMonday = (1 - day + 7) % 7 || 7;
                reminderDate.setDate(reminderDate.getDate() + daysUntilMonday);
              } else if (dateText.includes('tuesday')) {
                const day = reminderDate.getDay();
                const daysUntilTuesday = (2 - day + 7) % 7 || 7;
                reminderDate.setDate(reminderDate.getDate() + daysUntilTuesday);
              } else if (dateText.includes('wednesday')) {
                const day = reminderDate.getDay();
                const daysUntilWednesday = (3 - day + 7) % 7 || 7;
                reminderDate.setDate(reminderDate.getDate() + daysUntilWednesday);
              } else if (dateText.includes('thursday')) {
                const day = reminderDate.getDay();
                const daysUntilThursday = (4 - day + 7) % 7 || 7;
                reminderDate.setDate(reminderDate.getDate() + daysUntilThursday);
              } else if (dateText.includes('friday')) {
                const day = reminderDate.getDay();
                const daysUntilFriday = (5 - day + 7) % 7 || 7;
                reminderDate.setDate(reminderDate.getDate() + daysUntilFriday);
              }
              
              // Create reminder via API
              try {
                // Convert reminderDate to UTC timestamp (midnight UTC)
                const year = reminderDate.getFullYear();
                const month = reminderDate.getMonth();
                const day = reminderDate.getDate();
                const utcTimestamp = Date.UTC(year, month, day);
                
                const reminderResponse = await fetch('/api/reminders', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contact_id: result.contactId,
                    type: 'FOLLOW_UP',
                    title: result.reminderText || 'Follow up',
                    description: '',
                    date: utcTimestamp
                  })
                });
                
                if (reminderResponse.ok) {
                  const reminderData = await reminderResponse.json();
                  console.log('Reminder created:', reminderData);
                  const message = 'Reminder created for ' + result.contactName;
                  indicator.innerHTML = '✅ ' + message;
                  speak(message);
                  // Don't auto-redirect - let user check console
                  // setTimeout(() => window.location.href = '/reminders', 2500);
                } else {
                  const errorData = await reminderResponse.json();
                  console.error('Reminder creation failed:', errorData);
                  const errorMsg = errorData.error || 'Error creating reminder';
                  indicator.innerHTML = '❌ ' + errorMsg;
                  speak(errorMsg);
                  setTimeout(() => indicator.style.display = 'none', 5000);
                }
              } catch (error) {
                console.error('Reminder creation error:', error);
                indicator.innerHTML = '❌ Error creating reminder';
                speak('Error creating reminder');
                setTimeout(() => indicator.style.display = 'none', 3000);
              }
            } else {
              window.location.href = '/dashboard?search=' + encodeURIComponent(result.contactName || '');
            }
          } else {
            if (result.message) {
              indicator.innerHTML = result.message;
              setTimeout(() => indicator.style.display = 'none', 2000);
            } else {
              indicator.style.display = 'none';
            }
          }
        } else {
          const error = await response.json();
          alert('Error: ' + (error.error || 'Unknown error'));
          indicator.style.display = 'none';
        }
      } catch (error) {
        alert('Error processing voice command');
        console.error('Voice command error:', error);
        indicator.style.display = 'none';
      }
    }
    </script>
  `;
}

export function landingPage(): string {
  return layout('Link', `
    <div style="min-height: 100vh; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
    ${linkAppHeader(`<a href="/auth/signin" class="th-topbar-auth-btn th-topbar-auth-login">Login</a>
                <a href="/auth/signup" class="th-topbar-auth-btn th-topbar-auth-signup">Sign Up</a>`)}

      <div class="container" style="padding-top: 4rem; padding-bottom: 4rem;">
        <div style="text-align: center; color: white; margin-bottom: 4rem;">
          <h1 style="font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">Link</h1>
          <p style="font-size: 1.25rem; margin-bottom: 2rem; opacity: 0.95;">LinkPRM — Link Person Relationship Manager. A simple, private CRM to help you stay connected with the people who matter most.</p>
          <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
            <a href="/auth/signup" class="btn" style="background: white; color: #16a34a; font-size: 1.125rem; padding: 0.75rem 2rem;">Create Account</a>
            <a href="/auth/signin" class="btn" style="background: rgba(255,255,255,0.2); color: white; font-size: 1.125rem; padding: 0.75rem 2rem; border: 1px solid white;">Sign In</a>
          </div>
        </div>

        <div class="grid grid-2" style="margin-top: 4rem;">
          <div class="card">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #16a34a;">📇 Contact Management</h3>
            <p class="text-gray">Keep all your important contacts organized with notes, tags, and custom fields. Never forget important details about the people in your life.</p>
          </div>
          
          <div class="card">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #16a34a;">🔔 Smart Reminders</h3>
            <p class="text-gray">Get reminded about birthdays, follow-ups, and significant dates. Set custom reminders to stay in touch with the right people at the right time.</p>
          </div>
          
          <div class="card">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #16a34a;">📊 Interaction Tracking</h3>
            <p class="text-gray">Log meetings, calls, emails, and notes. Maintain a complete history of your interactions to build stronger relationships.</p>
          </div>
          
          <div class="card">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.5rem; color: #16a34a;">🔒 Privacy First</h3>
            <p class="text-gray">Your data is encrypted and secure. We take your privacy seriously and never share your personal information.</p>
          </div>
        </div>
      </div>
    </div>
  `)
}

export function signinPage(error?: string): string {
  return layout('Sign In', `
    ${linkAppHeader()}
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
      <div class="card" style="max-width: 400px; width: 100%;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <a href="/" class="logo" style="font-size: 2rem;">link</a>
          <p class="text-gray" style="margin-top: 0.5rem;">Sign in to your account</p>
        </div>
        
        ${error ? `<div class="alert alert-error">${error}</div>` : ''}
        
        <form method="POST" action="/auth/signin" style="margin-bottom: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input" required autocomplete="email">
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-input" required autocomplete="current-password">
          </div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%;">Sign In</button>
        </form>
        
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <span class="text-sm text-gray">or</span>
        </div>
        
        <a href="/auth/google" class="btn btn-secondary" style="width: 100%; text-align: center;">
          Sign in with Google
        </a>
        
        <div style="text-align: center; margin-top: 1.5rem;">
          <span class="text-sm text-gray">Don't have an account? <a href="/auth/signup">Sign up</a></span>
        </div>
      </div>
    </div>
  `)
}

export function signupPage(error?: string): string {
  return layout('Sign Up', `
    ${linkAppHeader()}
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f9fafb;">
      <div class="card" style="max-width: 400px; width: 100%;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <a href="/" class="logo" style="font-size: 2rem;">link</a>
          <p class="text-gray" style="margin-top: 0.5rem;">Create your account</p>
        </div>
        
        ${error ? `<div class="alert alert-error">${error}</div>` : ''}
        
        <form method="POST" action="/auth/signup">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" name="name" class="form-input" required autocomplete="name">
          </div>
          
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input" required autocomplete="email">
          </div>
          
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" name="password" class="form-input" required minlength="8" autocomplete="new-password">
            <p class="text-sm text-gray" style="margin-top: 0.25rem;">Must be at least 8 characters</p>
          </div>
          
          <div class="form-group">
            <label class="form-label">Confirm Password</label>
            <input type="password" name="confirmPassword" class="form-input" required minlength="8" autocomplete="new-password">
          </div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%;">Create Account</button>
        </form>
        
        <div style="text-align: center; margin: 1.5rem 0;">
          <span class="text-sm text-gray">or</span>
        </div>
        
        <a href="/auth/google" class="btn btn-secondary" style="width: 100%; text-align: center;">
          Sign up with Google
        </a>
        
        <div style="text-align: center; margin-top: 1.5rem;">
          <span class="text-sm text-gray">Already have an account? <a href="/auth/signin">Sign in</a></span>
        </div>
      </div>
    </div>
  `)
}

function getCsvImportModal(): string {
  return `
    <div id="csvImportModal" class="modal">
      <div class="modal-content">
        <h3 style="margin-bottom: 1rem;">Import Contacts from CSV</h3>
        <p class="text-sm text-gray" style="margin-bottom: 1rem;">Upload a CSV export from Outlook, Google Contacts, or any contact manager. Supports standard field names.</p>
        
        <form id="csvImportForm">
          <div class="form-group">
            <label class="form-label">CSV File</label>
            <input type="file" id="csvFileInput" accept=".csv" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="skipHeaderRow" checked>
              <span class="text-sm">Skip first row (header)</span>
            </label>
          </div>
          
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button type="button" onclick="closeImportModal()" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary" id="importCsvBtn">Import</button>
          </div>
        </form>
        
        <div id="importProgress" style="display: none; margin-top: 1rem;">
          <div style="background: #e5e7eb; border-radius: 0.5rem; height: 8px; overflow: hidden;">
            <div id="importProgressBar" style="background: #16a34a; height: 100%; width: 0%; transition: width 0.3s;"></div>
          </div>
          <p id="importStatus" class="text-sm text-gray" style="margin-top: 0.5rem;"></p>
        </div>
      </div>
    </div>
  `
}

function getCsvImportScript(): string {
  return `
    <script>
      function openImportModal() {
        document.getElementById('csvImportModal').classList.add('active');
      }
      
      function closeImportModal() {
        document.getElementById('csvImportModal').classList.remove('active');
        document.getElementById('csvImportForm').reset();
        document.getElementById('importProgress').style.display = 'none';
        document.getElementById('importProgressBar').style.width = '0%';
      }
      
      document.getElementById('csvImportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('csvFileInput');
        const file = fileInput.files[0];
        if (!file) return;
        
        const skipHeader = document.getElementById('skipHeaderRow').checked;
        
        // Read file
        const text = await file.text();
        
        // Show progress
        document.getElementById('importProgress').style.display = 'block';
        document.getElementById('importStatus').textContent = 'Parsing CSV...';
        
        // Send to server
        try {
          const response = await fetch('/api/contacts/import-csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ csv: text, skipHeader })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Import failed');
          }
          
          const result = await response.json();
          document.getElementById('importProgressBar').style.width = '100%';
          document.getElementById('importStatus').textContent = 
            'Imported ' + result.imported + ' contacts' + 
            (result.duplicates > 0 ? ' (' + result.duplicates + ' duplicates skipped)' : '') +
            (result.skipped > 0 ? ' (' + result.skipped + ' invalid rows skipped)' : '');
          
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (error) {
          document.getElementById('importStatus').textContent = 'Error: ' + error.message;
          document.getElementById('importStatus').style.color = '#ef4444';
        }
      });
      
      // Close modal when clicking outside
      document.getElementById('csvImportModal').addEventListener('click', (e) => {
        if (e.target.id === 'csvImportModal') {
          closeImportModal();
        }
      });
    </script>
  `
}

export function remindersPage(user: any, reminders: any[], view: string = 'calendar', year?: number, month?: number, showDismissed: boolean = false): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayTimestamp = today.getTime()
  
  const upcomingReminders = reminders.filter(r => !r.dismissed && r.date >= todayTimestamp)
    .sort((a, b) => a.date - b.date)
  const pastReminders = reminders.filter(r => !r.dismissed && r.date < todayTimestamp)
    .sort((a, b) => b.date - a.date)
  
  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  
  const renderReminder = (r: any) => `
    <div class="card" style="margin-bottom: 0.5rem; ${r.dismissed ? 'opacity: 0.6;' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <span style="font-size: 1.25rem;">${r.type === 'BIRTHDAY' ? '🎂' : '📌'}</span>
            <strong>${escapeHtml(r.title)}${r.dismissed ? ' (Dismissed)' : ''}</strong>
          </div>
          <div class="text-sm text-gray">
            <a href="/contacts/${r.contact_id}">${escapeHtml(r.contact_name)}</a>
            <span style="margin: 0 0.5rem;">•</span>
            ${formatDate(r.date)}
          </div>
          ${r.description ? `<p class="text-sm" style="margin-top: 0.5rem;">${escapeHtml(r.description)}</p>` : ''}
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <a href="/reminders/${r.id}/edit" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Edit</a>
          ${!r.dismissed ? `
            <form method="POST" action="/api/reminders/${r.id}/dismiss" style="display: inline;">
              <button type="submit" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Dismiss</button>
            </form>
          ` : ''}
        </div>
      </div>
    </div>
  `
  
  // Prepare calendar data if in calendar view
  let calendarHtml = '';
  if (view === 'calendar') {
    const currentDate = new Date();
    const displayYear = year ?? currentDate.getFullYear();
    const displayMonth = month ?? currentDate.getMonth();
    
    // Group reminders by date
    const remindersByDate = new Map<string, any[]>();
    reminders.forEach(r => {
      // Convert Unix timestamp to YYYY-MM-DD format
      const reminderDate = new Date(r.date);
      const dateStr = `${reminderDate.getFullYear()}-${String(reminderDate.getMonth() + 1).padStart(2, '0')}-${String(reminderDate.getDate()).padStart(2, '0')}`;
      if (!remindersByDate.has(dateStr)) {
        remindersByDate.set(dateStr, []);
      }
      remindersByDate.get(dateStr)!.push(r);
    });
    
    calendarHtml = getRemindersCalendarHtml(displayYear, displayMonth, remindersByDate);
  }
  
  return layout('Reminders', `
    <div class="content-wrapper">
      ${linkAppHeader(`<span class="text-sm text-gray link-nav-user">${navUserLabel(user)}</span>`)}
      
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; margin-top: 1rem;">
          <h2 style="margin: 0;">Reminders</h2>
          <div style="display: flex; gap: 0.5rem;">
            <a href="/reminders?view=calendar" class="btn ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">📅 Calendar</a>
            <a href="/reminders?view=list" class="btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">📋 List</a>
            <a href="/reminders/new" class="btn btn-primary">+ Add Reminder</a>
          </div>
        </div>
        
        <div style="margin-bottom: 1rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
            <input type="checkbox" id="showDismissedCheckbox" ${showDismissed ? 'checked' : ''} onchange="toggleDismissed(this.checked)" style="cursor: pointer;">
            <span class="text-sm">Show dismissed reminders</span>
          </label>
        </div>
        
        ${view === 'list' ? `
          ${pastReminders.length > 0 ? `
            <div style="margin-bottom: 2rem;">
              <h3 style="color: #ef4444; margin-bottom: 1rem;">⚠️ Overdue (${pastReminders.length})</h3>
              ${pastReminders.map(renderReminder).join('')}
            </div>
          ` : ''}
          
          ${upcomingReminders.length > 0 ? `
            <div>
              <h3 style="margin-bottom: 1rem;">Upcoming (${upcomingReminders.length})</h3>
              ${upcomingReminders.map(renderReminder).join('')}
            </div>
          ` : ''}
          
          ${reminders.length === 0 ? `
            <div class="card text-center">
              <p class="text-gray">No reminders yet. Add your first reminder!</p>
            </div>
          ` : ''}
        ` : `
          ${calendarHtml}
          
          ${reminders.length === 0 ? `
            <div class="card text-center" style="margin-top: 1rem;">
              <p class="text-gray">No reminders for this month.</p>
            </div>
          ` : ''}
        `}
      </div>
      
      ${getFooterLinks()}
    </div>
    
    ${getBottomNav('reminders')}
    
    <script>
      function toggleDismissed(checked) {
        const url = new URL(window.location.href);
        if (checked) {
          url.searchParams.set('showDismissed', 'true');
        } else {
          url.searchParams.delete('showDismissed');
        }
        window.location.href = url.toString();
      }
    </script>
  `)
}

export function newReminderPage(user: any, contacts: any[]): string {
  return layout('Add Reminder', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Add New Reminder</h2>
        <form method="POST" action="/api/reminders">
          <div class="form-group">
            <label class="form-label">Person *</label>
            <input type="text" id="contactSearch" class="form-input" placeholder="Search for a person..." autocomplete="off">
            <input type="hidden" name="contact_id" id="contactId" required>
            <div id="contactResults" style="display: none; position: absolute; z-index: 1000; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; max-height: 300px; overflow-y: auto; width: calc(100% - 2rem); box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 0.25rem;">
              ${contacts.map(c => `<div class="contact-option" data-id="${c.id}" data-name="${c.name}" style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #f3f4f6;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">${c.name}</div>`).join('')}
            </div>
          </div>
          <script>
            const searchInput = document.getElementById('contactSearch');
            const contactIdInput = document.getElementById('contactId');
            const resultsDiv = document.getElementById('contactResults');
            const contactOptions = Array.from(document.querySelectorAll('.contact-option'));
            
            searchInput.addEventListener('focus', () => {
              resultsDiv.style.display = 'block';
            });
            
            searchInput.addEventListener('input', (e) => {
              const search = e.target.value.toLowerCase();
              contactOptions.forEach(option => {
                const name = option.dataset.name.toLowerCase();
                option.style.display = name.includes(search) ? 'block' : 'none';
              });
              resultsDiv.style.display = 'block';
              contactIdInput.value = '';
            });
            
            contactOptions.forEach(option => {
              option.addEventListener('click', () => {
                searchInput.value = option.dataset.name;
                contactIdInput.value = option.dataset.id;
                resultsDiv.style.display = 'none';
              });
            });
            
            document.addEventListener('click', (e) => {
              if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
              }
            });
          </script>
          
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select name="type" class="form-select" required>
              <option value="FOLLOW_UP">Follow-up</option>
              <option value="BIRTHDAY">Birthday</option>
              <option value="ANNIVERSARY">Anniversary</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" name="title" class="form-input" placeholder="e.g., Call about project" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" name="date" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea name="description" class="form-textarea" placeholder="Optional notes about this reminder"></textarea>
          </div>
          
          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <a href="/reminders" class="btn btn-secondary">Cancel</a>
            <button type="submit" class="btn btn-primary">Create Reminder</button>
          </div>
        </form>
      </div>
    </div>
    
    ${getFooterLinks()}
  `)
}

export function editReminderPage(user: any, reminder: any, contacts: any[]): string {
  const dateStr = new Date(reminder.date).toISOString().split('T')[0]
  
  return layout('Edit Reminder', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Edit Reminder</h2>
        <form method="POST" action="/api/reminders/${reminder.id}">
          <div class="form-group">
            <label class="form-label">Person *</label>
            <input type="text" id="contactSearch" class="form-input" placeholder="Search for a person..." value="${contacts.find(c => c.id === reminder.contact_id)?.name || ''}" autocomplete="off">
            <input type="hidden" name="contact_id" id="contactId" value="${reminder.contact_id}" required>
            <div id="contactResults" style="display: none; position: absolute; z-index: 1000; background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; max-height: 300px; overflow-y: auto; width: calc(100% - 2rem); box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 0.25rem;">
              ${contacts.map(c => `<div class="contact-option" data-id="${c.id}" data-name="${c.name}" style="padding: 0.75rem; cursor: pointer; border-bottom: 1px solid #f3f4f6;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">${c.name}</div>`).join('')}
            </div>
          </div>
          <script>
            const searchInput = document.getElementById('contactSearch');
            const contactIdInput = document.getElementById('contactId');
            const resultsDiv = document.getElementById('contactResults');
            const contactOptions = Array.from(document.querySelectorAll('.contact-option'));
            
            searchInput.addEventListener('focus', () => {
              resultsDiv.style.display = 'block';
            });
            
            searchInput.addEventListener('input', (e) => {
              const search = e.target.value.toLowerCase();
              contactOptions.forEach(option => {
                const name = option.dataset.name.toLowerCase();
                option.style.display = name.includes(search) ? 'block' : 'none';
              });
              resultsDiv.style.display = 'block';
              contactIdInput.value = '';
            });
            
            contactOptions.forEach(option => {
              option.addEventListener('click', () => {
                searchInput.value = option.dataset.name;
                contactIdInput.value = option.dataset.id;
                resultsDiv.style.display = 'none';
              });
            });
            
            document.addEventListener('click', (e) => {
              if (!searchInput.contains(e.target) && !resultsDiv.contains(e.target)) {
                resultsDiv.style.display = 'none';
              }
            });
          </script>
          
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select name="type" class="form-select" required>
              <option value="FOLLOW_UP" ${reminder.type === 'FOLLOW_UP' ? 'selected' : ''}>Follow-up</option>
              <option value="BIRTHDAY" ${reminder.type === 'BIRTHDAY' ? 'selected' : ''}>Birthday</option>
              <option value="ANNIVERSARY" ${reminder.type === 'ANNIVERSARY' ? 'selected' : ''}>Anniversary</option>
              <option value="OTHER" ${reminder.type === 'OTHER' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Title *</label>
            <input type="text" name="title" class="form-input" value="${reminder.title}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" name="date" class="form-input" value="${dateStr}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea name="description" class="form-textarea">${reminder.description || ''}</textarea>
          </div>
          
          <div style="display: flex; gap: 0.5rem; justify-content: space-between;">
            <button type="button" onclick="if(confirm('Delete this reminder?')) document.getElementById('deleteForm').submit()" class="btn btn-danger">Delete</button>
            <div style="display: flex; gap: 0.5rem;">
              <a href="/reminders" class="btn btn-secondary">Cancel</a>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </div>
        </form>
        <form id="deleteForm" method="POST" action="/api/reminders/${reminder.id}/delete" style="display: none;"></form>
      </div>
    </div>
    
    ${getFooterLinks()}
  `)
}

function getImportScript(): string {
  return ``;
}

function getQuickAddModal(): string {
  return `
    <div id="quickAddModal" class="modal">
      <div class="modal-content">
        <h2 style="margin-bottom: 1rem;">Quick Add Interaction</h2>
        <p class="text-sm text-gray" style="margin-bottom: 1rem;">Describe your interaction and AI will figure out which contact it belongs to.</p>
        <form id="quickAddForm">
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <label class="form-label" style="margin-bottom: 0;">Interaction Details *</label>
              <button type="button" onclick="toggleVoiceRecording()" class="btn btn-secondary" id="voiceBtn" style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                🎤 Voice Input
              </button>
            </div>
            <textarea name="text" id="interactionText" class="form-textarea" placeholder="Example: Had coffee with Sarah today. She mentioned their new cloud migration project..." style="min-height: 120px;" required></textarea>
            <div id="recordingIndicator" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: #fee2e2; border-radius: 0.375rem; color: #991b1b; font-size: 0.875rem;">
              🔴 Recording... Click "Stop Recording" to finish
            </div>
            <div id="transcribingIndicator" style="display: none; margin-top: 0.5rem; padding: 0.5rem; background: #dbeafe; border-radius: 0.375rem; color: #1e40af; font-size: 0.875rem;">
              ⏳ Transcribing audio...
            </div>
          </div>
          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" name="newContact" id="newContactCheck" style="cursor: pointer;">
              <span class="form-label" style="margin: 0;">This is a new contact (create new contact instead of matching existing)</span>
            </label>
          </div>
          <div class="flex" style="gap: 1rem;">
            <button type="submit" class="btn btn-primary" id="quickAddBtn">Add Interaction</button>
            <button type="button" onclick="hideQuickAddForm()" class="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  `
}

function getQuickAddScript(): string {
  return `
    <script>
      function showQuickAddForm() {
        document.getElementById("quickAddModal").classList.add("active");
      }
      
      function hideQuickAddForm() {
        document.getElementById("quickAddModal").classList.remove("active");
        document.getElementById("quickAddForm").reset();
      }
      
      document.getElementById("quickAddModal").addEventListener("click", (e) => {
        if (e.target.id === "quickAddModal") {
          hideQuickAddForm();
        }
      });
      
      document.getElementById("quickAddForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = document.getElementById("quickAddBtn");
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Processing...";
        
        const formData = new FormData(e.target);
        const text = formData.get("text");
        const newContact = formData.get("newContact") === "on";
        
        try {
          // First, extract date from text
          const now = new Date();
          const dateExtractResponse = await fetch("/api/extract-date", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              text, 
              currentDate: now.toDateString() 
            })
          });
          
          let daysAgo = 0;
          if (dateExtractResponse.ok) {
            const dateData = await dateExtractResponse.json();
            daysAgo = dateData.daysAgo ? dateData.daysAgo : 0;
          }
          
          // Calculate the target date in local timezone
          const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
          const localTimestamp = targetDate.getTime() - (targetDate.getTimezoneOffset() * 60000);
          
          const response = await fetch("/api/interactions/quick-add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, newContact, date: localTimestamp })
          });
          
          if (response.ok) {
            const result = await response.json();
            let message;
            if (result.isNewContact) {
              let isMultiple = false;
              if (result.contactCount) {
                if (result.contactCount !== 1) {
                  isMultiple = true;
                }
              }
              if (isMultiple) {
                message = "Created " + result.contactCount + " new contacts: " + result.contactName + " and added interaction";
              } else {
                message = "Created new contact: " + result.contactName + " and added interaction";
              }
            } else {
              let isMultiple = false;
              if (result.contactCount) {
                if (result.contactCount !== 1) {
                  isMultiple = true;
                }
              }
              if (isMultiple) {
                message = "Interaction added to " + result.contactCount + " contacts: " + result.contactName;
              } else {
                message = "Interaction added to " + result.contactName;
              }
            }
            // Reset form before reload
            document.getElementById("quickAddForm").reset();
            hideQuickAddForm();
            alert(message);
            window.location.reload();
          } else {
            const error = await response.json();
            let errorMsg = error.error ? error.error : "Error adding interaction";
            if (error.details) {
              errorMsg = errorMsg + "\\n\\nDetails: " + error.details;
            }
            alert(errorMsg);
            btn.disabled = false;
            btn.textContent = originalText;
          }
        } catch (error) {
          alert("Error adding interaction");
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
      
      // Voice recording functionality
      let mediaRecorder = null;
      let audioChunks = [];
      let isRecording = false;
      
      async function toggleVoiceRecording() {
        if (!isRecording) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
              audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = async () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
              await transcribeAudio(audioBlob);
              stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.start();
            isRecording = true;
            document.getElementById('voiceBtn').textContent = '⏹️ Stop Recording';
            document.getElementById('voiceBtn').style.background = '#ef4444';
            document.getElementById('voiceBtn').style.color = 'white';
            document.getElementById('recordingIndicator').style.display = 'block';
          } catch (error) {
            console.error('Microphone error:', error);
            if (error.name === 'NotAllowedError') {
              alert('Microphone access denied. Please allow microphone access in your browser settings and try again.');
            } else if (error.name === 'NotFoundError') {
              alert('No microphone found. Please ensure a microphone is connected and try again.');
            } else if (error.name === 'NotSupportedError') {
              alert('Your browser does not support microphone access. Please use a modern browser like Chrome, Firefox, or Safari.');
            } else if (window.location.protocol !== 'https:') {
              alert('Microphone access requires HTTPS. Please access this site using https://');
            } else {
              alert('Error accessing microphone: ' + error.message + '. Please check your browser permissions.');
            }
          }
        } else {
          mediaRecorder.stop();
          isRecording = false;
          document.getElementById('voiceBtn').textContent = '🎤 Voice Input';
          document.getElementById('voiceBtn').style.background = '';
          document.getElementById('voiceBtn').style.color = '';
          document.getElementById('recordingIndicator').style.display = 'none';
        }
      }
      
      async function transcribeAudio(audioBlob) {
        const transcribingIndicator = document.getElementById('transcribingIndicator');
        transcribingIndicator.style.display = 'block';
        
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const data = await response.json();
            document.getElementById('interactionText').value = data.text;
          } else {
            alert('Error transcribing audio. Please try again.');
          }
        } catch (error) {
          alert('Error transcribing audio. Please try again.');
          console.error('Transcription error:', error);
        } finally {
          transcribingIndicator.style.display = 'none';
        }
      }
    </script>
  `
}

function getBottomNav(activePage: string): string {
  return `
    <div class="bottom-nav">
      <a href="/dashboard" class="bottom-nav-item ${activePage === 'home' ? 'active' : ''}">
        <div class="bottom-nav-icon">🏠</div>
        <div class="bottom-nav-label">Home</div>
      </a>
      <a href="/people" class="bottom-nav-item ${activePage === 'people' ? 'active' : ''}">
        <div class="bottom-nav-icon">👥</div>
        <div class="bottom-nav-label">People</div>
      </a>
      <a href="/interactions" class="bottom-nav-item ${activePage === 'interactions' ? 'active' : ''}">
        <div class="bottom-nav-icon">💬</div>
        <div class="bottom-nav-label">Interactions</div>
      </a>
      <a href="/reminders" class="bottom-nav-item ${activePage === 'reminders' ? 'active' : ''}">
        <div class="bottom-nav-icon">🔔</div>
        <div class="bottom-nav-label">Reminders</div>
      </a>
    </div>
  `
}

function getFooterLinks(): string {
  return `
    <div class="footer-links">
      <a href="/privacy">Privacy Policy</a>
      <span>·</span>
      <a href="/terms">Terms of Service</a>
    </div>
  `
}

export function dashboardPage(user: any, hasGoogleAccount: boolean = false): string {
  return layout('Home', `
    <div class="content-wrapper">
      ${linkAppHeader(`<span class="text-sm text-gray link-nav-user">${navUserLabel(user)}</span>`)}
      
      <div class="container">
        <div class="grid grid-2" style="gap: 1rem; max-width: 800px; margin: 0 auto; margin-top: 2rem;">
          <div class="card" style="text-align: center; padding: 1.5rem; border-radius: 1rem; transition: all 0.2s ease; cursor: pointer;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.12)'" onclick="toggleVoiceAssistant()">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">🎙️</div>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">Voice Assistant</h3>
            <p class="text-sm" style="color: #6b7280;">Use voice commands to manage contacts</p>
          </div>
          
          <a href="/interactions/new" class="card" style="text-align: center; padding: 1.5rem; border-radius: 1rem; transition: all 0.2s ease; cursor: pointer; text-decoration: none; display: block;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.12)'">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">✍️</div>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">Add Interaction</h3>
            <p class="text-sm" style="color: #6b7280;">Log a new interaction with someone</p>
          </a>
          
          <a href="/contacts/new" class="card" style="text-align: center; padding: 1.5rem; border-radius: 1rem; transition: all 0.2s ease; cursor: pointer; text-decoration: none; display: block;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.12)'">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">👥</div>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">Add Person</h3>
            <p class="text-sm" style="color: #6b7280;">Add a new contact to your network</p>
          </a>
          
          <a href="/reminders/new" class="card" style="text-align: center; padding: 1.5rem; border-radius: 1rem; transition: all 0.2s ease; cursor: pointer; text-decoration: none; display: block;" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.12)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.12)'">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">⏰</div>
            <h3 style="font-size: 1.125rem; font-weight: 600; color: #111827; margin-bottom: 0.25rem;">Add Reminder</h3>
            <p class="text-sm" style="color: #6b7280;">Set a reminder for a contact</p>
          </a>
        </div>
      </div>
      
      ${getFooterLinks()}
    </div>
    
    ${getBottomNav('home')}
    ${getQuickAddModal()}
    ${getQuickAddScript()}
    ${hasGoogleAccount ? getImportScript() : ''}
    ${getVoiceAssistantScript()}
  `)
}

export function peoplePage(user: any, contacts: any[], allTags: string[], searchQuery: string, tagFilter: string, sortBy: string, hasGoogleAccount: boolean = false): string {
  const contactsList = contacts.map(c => `
    <tr>
      <td><a href="/contacts/${c.id}">${c.name}</a></td>
      <td class="text-sm">${c.phone || '-'}</td>
      <td class="text-sm">${c.email || '-'}</td>
      <td class="text-sm">${c.tags ? c.tags.join(', ') : '-'}</td>
    </tr>
  `).join('')

  return layout('People', `
    <div class="content-wrapper">
      ${linkAppHeader(`<span class="text-sm text-gray link-nav-user">${navUserLabel(user)}</span>
            <button onclick="openImportModal()" class="btn btn-primary text-sm">Import CSV</button>`)}
      
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; margin-top: 1rem;">
          <h2 style="margin: 0;">People</h2>
          <a href="/contacts/new" class="btn btn-primary">+ Add Person</a>
        </div>
        
        <div class="card" style="margin-bottom: 1rem;">
          <form method="GET" action="/people" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: end;">
            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
              <label class="form-label">Search</label>
              <input type="text" name="search" class="form-input" placeholder="Search by name, email, or company..." value="${searchQuery}">
            </div>
            
            <div class="form-group" style="min-width: 200px; margin-bottom: 0;">
              <label class="form-label">Filter by Tag</label>
              <select name="tag" class="form-select">
                <option value="">All Tags</option>
                ${allTags.map(tag => `<option value="${tag}" ${tagFilter === tag ? 'selected' : ''}>${tag}</option>`).join('')}
              </select>
            </div>
            
            <div class="form-group" style="min-width: 150px; margin-bottom: 0;">
              <label class="form-label">Sort By</label>
              <select name="sort" class="form-select">
                <option value="name" ${sortBy === 'name' ? 'selected' : ''}>Name</option>
                <option value="date" ${sortBy === 'date' ? 'selected' : ''}>Date Added</option>
              </select>
            </div>
            
            <div style="display: flex; gap: 0.5rem;">
              <button type="submit" class="btn btn-primary">Apply</button>
              ${searchQuery || tagFilter || sortBy !== 'name' ? `<a href="/people" class="btn btn-secondary">Clear</a>` : ''}
            </div>
          </form>
        </div>
        
        ${contacts.length === 0 ? `
          <div class="card text-center">
            <p class="text-gray">No people yet. Add your first person!</p>
          </div>
        ` : `
          <div class="card">
            <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  ${contactsList}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
      
      ${getFooterLinks()}
    </div>
    
    ${getBottomNav('people')}
    ${getCsvImportModal()}
    ${getCsvImportScript()}
    ${getVoiceAssistantScript()}
  `)
}

export function newContactPage(): string {
  return layout('Add Contact', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Add New Contact</h2>
        <form id="contactForm">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" name="name" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input">
          </div>
          
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input">
          </div>
          
          <div class="form-group">
            <label class="form-label">Company</label>
            <input type="text" name="company" class="form-input">
          </div>
          
          <div class="form-group">
            <label class="form-label">Tags (comma-separated)</label>
            <input type="text" name="tags" class="form-input" placeholder="friend, colleague, client">
          </div>
          
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-textarea"></textarea>
          </div>
          
          <div class="flex" style="gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Add Contact</button>
            <a href="/dashboard" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      document.getElementById('contactForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          name: formData.get('name'),
          email: formData.get('email') || null,
          phone: formData.get('phone') || null,
          company: formData.get('company') || null,
          tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()).filter(Boolean) : [],
          notes: formData.get('notes') || null
        };
        
        try {
          const response = await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            window.location.href = '/people';
          } else {
            alert('Error adding contact');
          }
        } catch (error) {
          alert('Error adding contact');
        }
      });
    </script>
    
    ${getFooterLinks()}
  `);
}

export function contactDetailPage(contact: any, interactions: any[], dates: any[]): string {
  return layout(contact.name, `
    ${linkAppHeader()}
    <div class="container" style="margin-top: 2rem;">
      <div style="margin-bottom: 1rem;">
        <a href="/dashboard" style="color: #6b7280;">← Back to Dashboard</a>
      </div>
      
      <div class="card">
        <div class="flex-between" style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.875rem;">${contact.name}</h1>
          <div style="display: flex; gap: 0.5rem;">
            <button onclick="generateAISummary()" class="btn btn-primary" id="aiSummaryBtn">AI Summary</button>
            <a href="/contacts/${contact.id}/edit" class="btn btn-secondary">Edit Contact</a>
          </div>
        </div>
        
        <div class="grid grid-2" style="margin-bottom: 1.5rem;">
          ${contact.email ? `
            <div>
              <div class="text-sm text-gray">Email</div>
              <div><a href="mailto:${contact.email}">${contact.email}</a></div>
            </div>
          ` : ''}
          
          ${contact.phone ? `
            <div>
              <div class="text-sm text-gray">Phone</div>
              <div><a href="tel:${contact.phone}">${contact.phone}</a></div>
            </div>
          ` : ''}
          
          ${contact.company ? `
            <div>
              <div class="text-sm text-gray">Company</div>
              <div>${contact.company}</div>
            </div>
          ` : ''}
          
          ${contact.tags && contact.tags.length > 0 ? `
            <div>
              <div class="text-sm text-gray">Tags</div>
              <div>${contact.tags.join(', ')}</div>
            </div>
          ` : ''}
        </div>
        
        ${contact.notes ? `
          <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb;">
            <div class="text-sm text-gray" style="margin-bottom: 0.5rem;">Notes</div>
            <div style="white-space: pre-wrap;">${contact.notes}</div>
          </div>
        ` : ''}
      </div>
      
      <div class="card" id="aiSummaryCard" style="display: none;">
        <div class="flex-between" style="margin-bottom: 1rem;">
          <h2 style="font-size: 1.5rem;">AI Summary</h2>
          <button onclick="closeAISummary()" class="btn btn-secondary" style="font-size: 0.875rem;">Close</button>
        </div>
        <div id="aiSummaryContent" style="line-height: 1.6;"></div>
      </div>
      
      <div class="card">
        <div class="flex-between" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.5rem;">Important Dates</h2>
          <a href="/contacts/${contact.id}/dates/new" class="btn btn-primary">Add Date</a>
        </div>
        
        ${dates && dates.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${dates.map(d => {
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const dateStr = d.year ? 
                `${monthNames[d.month - 1]} ${d.day}, ${d.year}` : 
                `${monthNames[d.month - 1]} ${d.day}`;
              return `
                <div style="padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
                  <div class="flex-between">
                    <div>
                      <span style="font-weight: 500;">${d.type}</span>
                      <span class="text-sm text-gray" style="margin-left: 1rem;">${dateStr}</span>
                    </div>
                    <a href="/contacts/${contact.id}/dates/${d.id}/edit" style="font-size: 0.875rem;">Edit</a>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : '<p class="text-gray">No important dates added yet.</p>'}
      </div>
      
      <div class="card">
        <div class="flex-between" style="margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.5rem;">Interactions</h2>
          <button onclick="showAddInteractionForm()" class="btn btn-primary">Add Interaction</button>
        </div>
        
        <div id="addInteractionForm" style="display: none; margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
          <h3 style="margin-bottom: 1rem;">New Interaction</h3>
          <form id="interactionForm">
            <div class="form-group">
              <label class="form-label">Type</label>
              <select name="type" class="form-select" required>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="meeting">Meeting</option>
                <option value="message">Message</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" name="date" class="form-input" id="newInteractionDate" required>
            </div>
            
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea name="notes" class="form-textarea" required></textarea>
            </div>
            
            <div class="flex" style="gap: 1rem;">
              <button type="submit" class="btn btn-primary">Save</button>
              <button type="button" onclick="hideAddInteractionForm()" class="btn btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
        
        ${interactions.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${interactions.map(i => {
              const date = new Date(i.date);
              return `
                <div style="padding: 1rem; background: #f9fafb; border-radius: 0.5rem;">
                  <div class="flex-between" style="margin-bottom: 0.5rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                      <span style="font-weight: 500; text-transform: capitalize;">${i.type}</span>
                      <a href="/interactions/${i.id}/edit" style="font-size: 0.875rem;">Edit</a>
                    </div>
                    <span class="text-sm text-gray">${date.toLocaleDateString()}</span>
                  </div>
                  <div style="white-space: pre-wrap;">${i.notes || ''}</div>
                </div>
              `;
            }).join('')}
          </div>
        ` : '<p class="text-gray">No interactions yet.</p>'}
      </div>
    </div>
    
    <div style="display:none" id="contactId">${contact.id}</div>
    <script>
      async function generateAISummary() {
        const btn = document.getElementById('aiSummaryBtn');
        btn.disabled = true;
        btn.textContent = 'Generating...';
        
        try {
          console.log("Fetching AI summary for contact:", '${contact.id}');
          const contactId = document.getElementById("contactId").textContent;
          const url = '/api/contacts/' + contactId + '/ai-summary';
          console.log("URL:", url);
          const response = await fetch(url, {
            method: 'POST'
          });
          if (response.ok) {
            const data = await response.json();
            document.getElementById('aiSummaryContent').innerHTML = data.summary.replace(/\\n/g, '<br>');
            document.getElementById('aiSummaryCard').style.display = 'block';
          } else {
            alert('Error generating AI summary');
          }
        } catch (error) {
          alert('Error generating AI summary');
        } finally {
          btn.disabled = false;
          btn.textContent = 'AI Summary';
        }
      }
      
      function closeAISummary() {
        document.getElementById('aiSummaryCard').style.display = 'none';
      }
      
      function showAddInteractionForm() {
        document.getElementById('addInteractionForm').style.display = 'block';
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        document.getElementById('newInteractionDate').value = year + '-' + month + '-' + day;
      }
      
      function hideAddInteractionForm() {
        document.getElementById('addInteractionForm').style.display = 'none';
        document.getElementById('interactionForm').reset();
      }
      
      document.getElementById('interactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        // Parse date as UTC to avoid timezone shifts
        const dateStr = formData.get('date');
        const [year, month, day] = dateStr.split('-').map(Number);
        const data = {
          type: formData.get('type'),
          date: Date.UTC(year, month - 1, day),
          notes: formData.get('notes'),
          location: formData.get('location') || null
        };
        
        try {
          const contactId = document.getElementById("contactId").textContent;
          const response = await fetch('/api/contacts/' + contactId + '/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            window.location.reload();
          } else {
            alert('Error adding interaction');
          }
        } catch (error) {
          alert('Error adding interaction');
        }
      });
    </script>
    
    ${getFooterLinks()}
  `);
}

export function editContactPage(contact: any): string {
  return layout('Edit Contact', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div style="margin-bottom: 1rem;">
        <a href="/contacts/${contact.id}" style="color: #6b7280;">← Back to Contact</a>
      </div>
      
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Edit Contact</h2>
        <form id="contactForm">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input type="text" name="name" class="form-input" value="${contact.name || ''}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" name="email" class="form-input" value="${contact.email || ''}">
          </div>
          
          <div class="form-group">
            <label class="form-label">Phone</label>
            <input type="tel" name="phone" class="form-input" value="${contact.phone || ''}">
          </div>
          
          <div class="form-group">
            <label class="form-label">Company</label>
            <input type="text" name="company" class="form-input" value="${contact.company || ''}">
          </div>
          
          <div class="form-group">
            <label class="form-label">Tags (comma-separated)</label>
            <input type="text" name="tags" class="form-input" value="${contact.tags ? contact.tags.join(', ') : ''}" placeholder="friend, colleague, client">
          </div>
          
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-textarea">${contact.notes || ''}</textarea>
          </div>
          
          <div class="flex" style="gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a href="/contacts/${contact.id}" class="btn btn-secondary">Cancel</a>
            <button type="button" onclick="deleteContact()" class="btn btn-danger" style="margin-left: auto;">Delete Contact</button>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      document.getElementById('contactForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          name: formData.get('name'),
          email: formData.get('email') || null,
          phone: formData.get('phone') || null,
          company: formData.get('company') || null,
          tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()).filter(Boolean) : [],
          notes: formData.get('notes') || null
        };
        
        try {
          const response = await fetch('/api/contacts/${contact.id}', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            window.location.href = '/contacts/${contact.id}';
          } else {
            alert('Error updating contact');
          }
        } catch (error) {
          alert('Error updating contact');
        }
      });
      
      async function deleteContact() {
        if (!confirm('Are you sure you want to delete this contact? This cannot be undone.')) {
          return;
        }
        
        try {
          const response = await fetch('/api/contacts/${contact.id}', {
            method: 'DELETE'
          });
          
          if (response.ok) {
            window.location.href = '/people';
          } else {
            alert('Error deleting contact');
          }
        } catch (error) {
          alert('Error deleting contact');
        }
      }
    </script>
    
    ${getFooterLinks()}
  `);
}

export function editInteractionPage(contact: any, interaction: any, allContacts: any[]): string {
  return layout('Edit Interaction', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div style="margin-bottom: 1rem;">
        <a href="/contacts/${contact.id}" style="color: #6b7280;">← Back to ${contact.name}</a>
      </div>
      
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Edit Interaction</h2>
        <form id="interactionForm">
          <div class="form-group">
            <label class="form-label">Contact</label>
            <select name="contactId" class="form-select" required id="contactSelect">
              ${allContacts.map(c => `
                <option value="${c.id}" ${c.id === contact.id ? 'selected' : ''}>${c.name}</option>
              `).join('')}
            </select>
            <p class="text-sm text-gray" style="margin-top: 0.25rem;">Change this if the interaction was added to the wrong contact</p>
          </div>
          
          <div class="form-group">
            <label class="form-label">Type</label>
            <select name="type" class="form-select" required>
              <option value="call" ${interaction.type === 'call' ? 'selected' : ''}>Call</option>
              <option value="email" ${interaction.type === 'email' ? 'selected' : ''}>Email</option>
              <option value="meeting" ${interaction.type === 'meeting' ? 'selected' : ''}>Meeting</option>
              <option value="message" ${interaction.type === 'message' ? 'selected' : ''}>Message</option>
              <option value="other" ${interaction.type === 'other' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" name="date" class="form-input" id="interactionDate" required>
          </div>
          
          <script>
            // Set the date value in UTC to avoid timezone shifts
            const date = new Date(${interaction.date});
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            document.getElementById('interactionDate').value = year + '-' + month + '-' + day;
          </script>
          
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-textarea" required>${interaction.notes || ''}</textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Location (optional)</label>
            <input type="text" name="location" class="form-input" value="${interaction.location || ''}" placeholder="e.g., Coffee shop, Office, Zoom">
          </div>
          
          <div class="flex" style="gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a href="/contacts/${contact.id}" class="btn btn-secondary">Cancel</a>
            <button type="button" onclick="deleteInteraction()" class="btn btn-danger" style="margin-left: auto;">Delete Interaction</button>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      document.getElementById('interactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = {
          contactId: formData.get('contactId'),
          type: formData.get('type'),
          date: (() => {
            const dateStr = formData.get('date');
            const [year, month, day] = dateStr.split('-').map(Number);
            return Date.UTC(year, month - 1, day);
          })(),
          notes: formData.get('notes'),
          location: formData.get('location') || null
        };
        
        try {
          const response = await fetch('/api/interactions/${interaction.id}', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            const newContactId = formData.get('contactId');
            window.location.href = '/contacts/' + newContactId;
          } else {
            alert('Error updating interaction');
          }
        } catch (error) {
          alert('Error updating interaction');
        }
      });
      
      async function deleteInteraction() {
        if (!confirm('Are you sure you want to delete this interaction?')) {
          return;
        }
        
        try {
          const response = await fetch('/api/interactions/${interaction.id}', {
            method: 'DELETE'
          });
          
          if (response.ok) {
            window.location.href = '/contacts/${contact.id}';
          } else {
            alert('Error deleting interaction');
          }
        } catch (error) {
          alert('Error deleting interaction');
        }
      }
    </script>
    
    ${getFooterLinks()}
  `);
}

export function newInteractionPage(allContacts: any[], preselectedContactId?: string): string {
  return layout('Add Interaction', `
    ${linkAppHeader()}
    <div class="container" style="max-width: 600px; margin-top: 2rem;">
      <div style="margin-bottom: 1rem;">
        <a href="/interactions" style="color: #6b7280;">← Back to Interactions</a>
      </div>
      
      <div class="card">
        <h2 style="margin-bottom: 1.5rem;">Add Interaction</h2>
        <form id="interactionForm">
          <div class="form-group" style="position: relative;">
            <label class="form-label">Contact *</label>
            <input type="hidden" name="contactId" id="contactIdInput" value="${preselectedContactId || ''}" required>
            <input type="text" id="contactSearch" class="form-input" placeholder="Search for a contact..." autocomplete="off"
              value="${preselectedContactId ? escapeHtml(allContacts.find(c => c.id === preselectedContactId)?.name || '') : ''}">
            <div id="contactDropdown" style="display: none; position: absolute; left: 0; right: 0; top: 100%; z-index: 50; background: white; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 0.375rem 0.375rem; max-height: 200px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            </div>
          </div>
          
          <div id="newContactFields" style="display: none; margin-top: 0.75rem; padding: 1rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span style="font-weight: 600; font-size: 0.875rem; color: #16a34a;">New Contact</span>
              <button type="button" onclick="cancelNewContact()" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 0.875rem;">✕ Cancel</button>
            </div>
            <div class="form-group" style="margin-bottom: 0.75rem;">
              <label class="form-label">Name *</label>
              <input type="text" id="newContactName" class="form-input" placeholder="Contact name">
            </div>
            <div class="grid grid-2" style="margin-bottom: 0.75rem;">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Email</label>
                <input type="email" id="newContactEmail" class="form-input" placeholder="Email address">
              </div>
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label">Phone</label>
                <input type="tel" id="newContactPhone" class="form-input" placeholder="Phone number">
              </div>
            </div>
            <button type="button" onclick="createNewContact()" class="btn btn-primary" id="createContactBtn" style="font-size: 0.875rem;">Create Contact</button>
          </div>
          
          <div class="form-group">
            <label class="form-label">Type *</label>
            <select name="type" class="form-select" required>
              <option value="meeting" selected>Meeting</option>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="message">Message</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" name="date" class="form-input" id="interactionDate" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" class="form-textarea" placeholder="What did you talk about?" style="min-height: 120px;"></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Location</label>
            <input type="text" name="location" class="form-input" placeholder="e.g., Coffee shop, Office, Zoom">
          </div>
          
          <div class="flex" style="gap: 1rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Add Interaction</button>
            <a href="/interactions" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      // Contact search data
      const allContacts = ${JSON.stringify(allContacts.map(c => ({ id: c.id, name: c.name })))};
      const contactSearch = document.getElementById('contactSearch');
      const contactDropdown = document.getElementById('contactDropdown');
      const contactIdInput = document.getElementById('contactIdInput');
      let selectedIndex = -1;
      
      function renderDropdown(filter) {
        const query = (filter || '').toLowerCase();
        const filtered = query
          ? allContacts.filter(c => c.name.toLowerCase().includes(query))
          : allContacts;
        
        let html = '';
        // Always show "Create new contact" at the top
        html += '<div id="createNewOption" style="padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.875rem; color: #16a34a; font-weight: 500; border-bottom: 1px solid #e5e7eb;" data-action="create">+ Create new contact' + (query ? ' \"' + query.replace(/</g, '&lt;') + '\"' : '') + '</div>';
        if (filtered.length === 0) {
          html += '<div style="padding: 0.5rem 0.75rem; color: #6b7280; font-size: 0.875rem;">No contacts found</div>';
        } else {
          html += filtered.map((c, i) => 
            '<div class="contact-option" data-id="' + c.id + '" data-name="' + c.name.replace(/"/g, '&quot;') + '" style="padding: 0.5rem 0.75rem; cursor: pointer; font-size: 0.875rem;' + (i === selectedIndex ? ' background: #f0fdf4; color: #16a34a; font-weight: 500;' : '') + '">' + c.name.replace(/</g, '&lt;') + '</div>'
          ).join('');
        }
        contactDropdown.innerHTML = html;
        contactDropdown.style.display = 'block';
        selectedIndex = -1;
        
        // Attach click handlers for existing contacts
        contactDropdown.querySelectorAll('.contact-option').forEach(el => {
          el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectContact(el.dataset.id, el.dataset.name);
          });
          el.addEventListener('mouseover', () => {
            el.style.background = '#f0fdf4';
          });
          el.addEventListener('mouseout', () => {
            el.style.background = '';
          });
        });
        
        // Attach click handler for "Create new contact"
        document.getElementById('createNewOption').addEventListener('mousedown', (e) => {
          e.preventDefault();
          showNewContactForm(query);
        });
      }
      
      function showNewContactForm(prefillName) {
        contactDropdown.style.display = 'none';
        contactSearch.style.display = 'none';
        document.getElementById('newContactFields').style.display = 'block';
        const nameInput = document.getElementById('newContactName');
        nameInput.value = prefillName || '';
        nameInput.focus();
      }
      
      function cancelNewContact() {
        document.getElementById('newContactFields').style.display = 'none';
        contactSearch.style.display = '';
        contactSearch.value = '';
        contactIdInput.value = '';
        contactSearch.focus();
      }
      
      async function createNewContact() {
        const name = document.getElementById('newContactName').value.trim();
        if (!name) {
          alert('Please enter a contact name');
          document.getElementById('newContactName').focus();
          return;
        }
        
        const btn = document.getElementById('createContactBtn');
        btn.disabled = true;
        btn.textContent = 'Creating...';
        
        try {
          const response = await fetch('/api/contacts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name,
              email: document.getElementById('newContactEmail').value.trim() || null,
              phone: document.getElementById('newContactPhone').value.trim() || null
            })
          });
          
          if (response.ok) {
            const data = await response.json();
            // Add to our local list
            allContacts.push({ id: data.id, name: name });
            allContacts.sort((a, b) => a.name.localeCompare(b.name));
            // Select the new contact
            selectContact(data.id, name);
            // Hide the new contact form, show search input
            document.getElementById('newContactFields').style.display = 'none';
            contactSearch.style.display = '';
          } else {
            alert('Error creating contact');
          }
        } catch (error) {
          alert('Error creating contact');
        } finally {
          btn.disabled = false;
          btn.textContent = 'Create Contact';
        }
      }
      
      function selectContact(id, name) {
        contactIdInput.value = id;
        contactSearch.value = name;
        contactDropdown.style.display = 'none';
      }
      
      contactSearch.addEventListener('focus', () => {
        renderDropdown(contactSearch.value);
      });
      
      contactSearch.addEventListener('input', () => {
        // Clear selection if user is typing
        contactIdInput.value = '';
        renderDropdown(contactSearch.value);
      });
      
      contactSearch.addEventListener('blur', () => {
        // Small delay so click events on options can fire first
        setTimeout(() => {
          contactDropdown.style.display = 'none';
          // If no valid selection, clear the input
          if (!contactIdInput.value) {
            contactSearch.value = '';
          }
        }, 200);
      });
      
      contactSearch.addEventListener('keydown', (e) => {
        const options = contactDropdown.querySelectorAll('.contact-option');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedIndex = Math.min(selectedIndex + 1, options.length - 1);
          options.forEach((opt, i) => {
            opt.style.background = i === selectedIndex ? '#f0fdf4' : '';
            opt.style.fontWeight = i === selectedIndex ? '500' : '';
            if (i === selectedIndex) opt.scrollIntoView({ block: 'nearest' });
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedIndex = Math.max(selectedIndex - 1, 0);
          options.forEach((opt, i) => {
            opt.style.background = i === selectedIndex ? '#f0fdf4' : '';
            opt.style.fontWeight = i === selectedIndex ? '500' : '';
            if (i === selectedIndex) opt.scrollIntoView({ block: 'nearest' });
          });
        } else if (e.key === 'Enter' && selectedIndex >= 0 && options[selectedIndex]) {
          e.preventDefault();
          selectContact(options[selectedIndex].dataset.id, options[selectedIndex].dataset.name);
        } else if (e.key === 'Escape') {
          contactDropdown.style.display = 'none';
        }
      });
      
      // Default the date to today
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      document.getElementById('interactionDate').value = year + '-' + month + '-' + day;
      
      document.getElementById('interactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const contactId = document.getElementById('contactIdInput').value;
        
        if (!contactId) {
          alert('Please select a contact');
          document.getElementById('contactSearch').focus();
          return;
        }
        
        // Parse date as UTC to avoid timezone shifts
        const dateStr = formData.get('date');
        const [y, m, d] = dateStr.split('-').map(Number);
        
        const data = {
          type: formData.get('type'),
          date: Date.UTC(y, m - 1, d),
          notes: formData.get('notes') || null,
          location: formData.get('location') || null
        };
        
        try {
          const response = await fetch('/api/contacts/' + contactId + '/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            window.location.href = '/interactions';
          } else {
            alert('Error adding interaction');
          }
        } catch (error) {
          alert('Error adding interaction');
        }
      });
    </script>
    
    ${getFooterLinks()}
  `);
}

export function newDatePage(contact: any): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return layout(`Add Date - ${contact.name}`, `
    ${linkAppHeader()}
    
    <div class="container">
      <div style="margin-bottom: 1rem;">
        <a href="/contacts/${contact.id}" style="color: #6b7280;">← Back to ${contact.name}</a>
      </div>
      
      <div class="card">
        <h1 style="font-size: 1.875rem; margin-bottom: 1.5rem;">Add Important Date</h1>
        
        <form method="POST" action="/contacts/${contact.id}/dates">
          <div class="form-group">
            <label class="form-label">Type</label>
            <input type="text" name="type" class="form-input" placeholder="e.g., Birthday, Anniversary, Work Anniversary" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Month</label>
            <select name="month" class="form-select" required>
              <option value="">Select month...</option>
              ${months.map((month, index) => `<option value="${index + 1}">${month}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Day</label>
            <select name="day" class="form-select" required>
              <option value="">Select day...</option>
              ${Array.from({length: 31}, (_, i) => i + 1).map(day => `<option value="${day}">${day}</option>`).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Year (optional)</label>
            <input type="number" name="year" class="form-input" placeholder="e.g., 1990" min="1900" max="2100">
            <p class="text-sm text-gray" style="margin-top: 0.25rem;">Leave blank for recurring dates without a specific year</p>
          </div>
          
          <div style="display: flex; gap: 1rem;">
            <button type="submit" class="btn btn-primary">Add Date</button>
            <a href="/contacts/${contact.id}" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    
    ${getFooterLinks()}
  `);
}

export function editDatePage(contact: any, date: any): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return layout(`Edit Date - ${contact.name}`, `
    ${linkAppHeader()}
    
    <div class="container">
      <div style="margin-bottom: 1rem;">
        <a href="/contacts/${contact.id}" style="color: #6b7280;">← Back to ${contact.name}</a>
      </div>
      
      <div class="card">
        <div class="flex-between" style="margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.875rem;">Edit Date</h1>
          <button onclick="deleteDate()" class="btn btn-danger">Delete</button>
        </div>
        
        <form method="POST" action="/contacts/${contact.id}/dates/${date.id}">
          <div class="form-group">
            <label class="form-label">Type</label>
            <input type="text" name="type" class="form-input" value="${date.type}" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Month</label>
            <select name="month" class="form-select" required>
              ${months.map((month, index) => `
                <option value="${index + 1}" ${date.month === (index + 1) ? 'selected' : ''}>${month}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Day</label>
            <select name="day" class="form-select" required>
              ${Array.from({length: 31}, (_, i) => i + 1).map(day => `
                <option value="${day}" ${date.day === day ? 'selected' : ''}>${day}</option>
              `).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Year (optional)</label>
            <input type="number" name="year" class="form-input" value="${date.year || ''}" min="1900" max="2100">
            <p class="text-sm text-gray" style="margin-top: 0.25rem;">Leave blank for recurring dates without a specific year</p>
          </div>
          
          <div style="display: flex; gap: 1rem;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <a href="/contacts/${contact.id}" class="btn btn-secondary">Cancel</a>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      async function deleteDate() {
        if (!confirm('Are you sure you want to delete this date?')) {
          return;
        }
        
        try {
          const response = await fetch('/api/dates/${date.id}', {
            method: 'DELETE'
          });
          
          if (response.ok) {
            window.location.href = '/contacts/${contact.id}';
          } else {
            alert('Error deleting date');
          }
        } catch (error) {
          alert('Error deleting date');
        }
      }
    </script>
    
    ${getFooterLinks()}
  `);
}

function getRemindersCalendarHtml(year: number, month: number, remindersByDate: Map<string, any[]>): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysAbbr = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  let calendarHtml = `
    <div class="calendar-container" style="background: white; border-radius: 0.5rem; padding: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <button onclick="navigateReminderMonth(${prevYear}, ${prevMonth})" class="btn btn-secondary" style="padding: 0.5rem 1rem;">‹</button>
        <h3 style="font-weight: 600; font-size: 1.125rem;">${monthNames[month]} ${year}</h3>
        <button onclick="navigateReminderMonth(${nextYear}, ${nextMonth})" class="btn btn-secondary" style="padding: 0.5rem 1rem;">›</button>
      </div>
      
      <div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125rem; margin-bottom: 0.125rem;">
        ${daysOfWeek.map((day, i) => `<div style="text-align: center; font-weight: 600; font-size: 0.75rem; color: #6b7280; padding: 0.25rem;"><span class="day-full">${day}</span><span class="day-abbr">${daysAbbr[i]}</span></div>`).join('')}
      </div>
      
      <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125rem;">
  `;
  
  for (let i = 0; i < firstDay; i++) {
    calendarHtml += `<div class="calendar-cell" style="aspect-ratio: 1; min-height: 60px;"></div>`;
  }
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const reminders = remindersByDate.get(dateStr) || [];
    
    calendarHtml += `
      <div class="calendar-cell" data-date="${dateStr}" style="aspect-ratio: 1; min-height: 60px; max-height: 150px; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.25rem; background: white; display: flex; flex-direction: column; position: relative; overflow: hidden;">
        <div class="calendar-day-number" style="font-size: 0.875rem; font-weight: 500; color: #111827; margin-bottom: 0.25rem; flex-shrink: 0;">
          ${day}
        </div>
        ${reminders.length > 0 ? `
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-height: 0;">
            ${reminders.slice(0, 3).map(r => {
              const displayTextFull = r.type === 'BIRTHDAY' ? r.contact_name : r.contact_name;
              const displayTextAbbr = r.type === 'BIRTHDAY' ? abbreviateName(r.contact_name) : abbreviateName(r.contact_name);
              return `
              <a href="/reminders/${r.id}/edit" style="font-size: 0.625rem; background: #f59e0b; color: white; padding: 2px 4px; border-radius: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-decoration: none; display: block; flex-shrink: 0;" title="${escapeHtml(r.title)} - ${escapeHtml(r.contact_name)}">
                ${r.type === 'BIRTHDAY' ? '🎂' : '📌'} <span class="contact-name-full">${escapeHtml(displayTextFull)}</span><span class="contact-name-abbr">${escapeHtml(displayTextAbbr)}</span>
              </a>
            `}).join('')}
            ${reminders.length > 3 ? `<div style="font-size: 0.625rem; color: #6b7280; flex-shrink: 0;">+${reminders.length - 3} more</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  calendarHtml += `
      </div>
    </div>
    
    <script>
      function navigateReminderMonth(year, month) {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'calendar');
        url.searchParams.set('year', year);
        url.searchParams.set('month', month);
        window.location.href = url.toString();
      }
      
      // Highlight today's date using local timezone
      (function() {
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');
        const todayCell = document.querySelector('.calendar-cell[data-date="' + todayStr + '"]');
        if (todayCell) {
          todayCell.style.background = '#dcfce7';
          todayCell.style.borderColor = '#16a34a';
          const dayNumber = todayCell.querySelector('.calendar-day-number');
          if (dayNumber) {
            dayNumber.style.fontWeight = '600';
            dayNumber.style.color = '#16a34a';
          }
        }
      })();
    </script>
  `;
  
  return calendarHtml;
}

function getCalendarHtml(year: number, month: number, interactionsByDate: Map<string, any[]>): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysAbbr = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // Calculate previous and next month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  
  let calendarHtml = `
    <div class="calendar-container interactions-calendar" style="background: white; border-radius: 0.5rem; padding: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <button onclick="navigateMonth(${prevYear}, ${prevMonth})" class="btn btn-secondary" style="padding: 0.5rem 1rem;">‹</button>
        <h3 style="font-weight: 600; font-size: 1.125rem;">${monthNames[month]} ${year}</h3>
        <button onclick="navigateMonth(${nextYear}, ${nextMonth})" class="btn btn-secondary" style="padding: 0.5rem 1rem;">›</button>
      </div>
      
      <div class="calendar-header" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125rem; margin-bottom: 0.125rem;">
        ${daysOfWeek.map((day, i) => `<div style="text-align: center; font-weight: 600; font-size: 0.75rem; color: #6b7280; padding: 0.25rem;"><span class="day-full">${day}</span><span class="day-abbr">${daysAbbr[i]}</span></div>`).join('')}
      </div>
      
      <div class="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125rem;">
  `;
  
  // Add empty cells for days before the first day of month
  for (let i = 0; i < firstDay; i++) {
    calendarHtml += `<div class="calendar-cell" style="aspect-ratio: 1; min-height: 60px;"></div>`;
  }
  
  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const interactions = interactionsByDate.get(dateStr) || [];
    
    calendarHtml += `
      <div class="calendar-cell" data-date="${dateStr}" style="aspect-ratio: 1; min-height: 60px; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.25rem; background: white; display: flex; flex-direction: column; position: relative;" ondragover="event.preventDefault()" ondrop="onCalendarCellDrop(event, '${dateStr}')">
        <div class="calendar-day-number" style="font-size: 0.875rem; font-weight: 500; color: #111827; margin-bottom: 0.25rem;">
          ${day}
        </div>
        ${interactions.length > 0 ? `
          <div style="flex: 1; display: flex; flex-direction: column; gap: 2px; overflow: hidden;">
            ${interactions.slice(0, 3).map(i => {
              const escapedNotes = (i.notes || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
              const escapedLocation = (i.location || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
              const displayNameFull = i.contact_name;
              const displayNameAbbr = abbreviateName(i.contact_name);
              return `
              <div draggable="true" ondragstart="onInteractionDragStart(event, '${i.id}')" onclick="openInteractionModal('${i.id}', '${i.contact_id}', '${i.contact_name.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${i.type}', ${i.date}, '${escapedNotes}', '${escapedLocation}')" style="font-size: 0.625rem; background: #16a34a; color: white; padding: 4px 6px; border-radius: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; line-height: 1.2; min-height: 20px;" title="${i.contact_name} - ${i.type}">
                <span class="contact-name-full">${escapeHtml(displayNameFull)}</span><span class="contact-name-abbr">${escapeHtml(displayNameAbbr)}</span>
              </div>
            `}).join('')}
            ${interactions.length > 3 ? `<div style="font-size: 0.625rem; color: #6b7280;">+${interactions.length - 3} more</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  calendarHtml += `
      </div>
    </div>
  `;
  calendarHtml += `
    <script>
      function navigateMonth(year, month) {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'calendar');
        url.searchParams.set('year', year);
        url.searchParams.set('month', month);
        window.location.href = url.toString();
      }

      // Drag-and-drop for interactions
      function onInteractionDragStart(event, interactionId) {
        event.dataTransfer.setData('interactionId', interactionId);
      }

      async function onCalendarCellDrop(event, dateStr) {
        event.preventDefault();
        const interactionId = event.dataTransfer.getData('interactionId');
        if (!interactionId) return;
        // Convert dateStr (YYYY-MM-DD) to UTC timestamp
        const [year, month, day] = dateStr.split('-').map(Number);
        const utcDate = Date.UTC(year, month - 1, day);
        try {
          // Fetch the current interaction data
          const getResp = await fetch('/api/interactions/' + interactionId);
          if (!getResp.ok) {
            alert('Failed to fetch interaction details');
            return;
          }
          const interaction = await getResp.json();
          // Send PUT request with all required fields and new date
          const response = await fetch('/api/interactions/' + interactionId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: interaction.type,
              notes: interaction.notes,
              location: interaction.location,
              date: utcDate
            })
          });
          if (response.ok) {
            window.location.reload();
          } else {
            alert('Failed to update interaction date');
          }
        } catch (err) {
          alert('Failed to update interaction date');
        }
      }

      // Highlight today's date using local timezone
      (function() {
        const today = new Date();
        const todayStr = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');
        const todayCell = document.querySelector('.calendar-cell[data-date="' + todayStr + '"]');
        if (todayCell) {
          todayCell.style.background = '#dcfce7';
          todayCell.style.borderColor = '#16a34a';
          const dayNumber = todayCell.querySelector('.calendar-day-number');
          if (dayNumber) {
            dayNumber.style.fontWeight = '600';
            dayNumber.style.color = '#16a34a';
          }
        }
      })();
    </script>
  `;
  
  return calendarHtml;
}

export function interactionsPage(user: any, recentInteractions: any[], searchQuery: string = '', typeFilter: string = '', hasGoogleAccount: boolean = false, view: string = 'calendar', year?: number, month?: number): string {
  const recentInteractionsList = recentInteractions.map(i => {
    const date = new Date(i.date);
    const escapedNotes = (i.notes || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
    const escapedName = (i.contact_name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const escapedLocation = (i.location || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
    return `
      <div class="card" onclick="openInteractionModal('${i.id}', '${i.contact_id}', '${escapedName}', '${i.type}', ${i.date}, '${escapedNotes}', '${escapedLocation}')" style="padding: 0.75rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
        <div class="flex-between" style="margin-bottom: 0.25rem;">
          <div style="display: flex; gap: 0.75rem; align-items: center;">
            <span style="font-weight: 500; text-transform: capitalize; font-size: 0.875rem;">${i.type}</span>
            <a href="/contacts/${i.contact_id}" onclick="event.stopPropagation()" style="font-size: 0.875rem;">${i.contact_name}</a>
          </div>
          <span class="text-sm text-gray">${date.toLocaleDateString()}</span>
        </div>
        <div style="font-size: 0.875rem; color: #6b7280; white-space: pre-wrap;">${i.notes || ''}</div>
        ${i.location ? `<div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">📍 ${i.location}</div>` : ''}
      </div>
    `;
  }).join('')
  
  // Prepare calendar data if in calendar view
  let calendarHtml = '';
  if (view === 'calendar') {
    const currentDate = new Date();
    const displayYear = year ?? currentDate.getFullYear();
    const displayMonth = month ?? currentDate.getMonth();
    
    // Group interactions by date (using UTC to avoid timezone issues)
    const interactionsByDate = new Map<string, any[]>();
    recentInteractions.forEach(i => {
      const date = new Date(i.date);
      const dateStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
      if (!interactionsByDate.has(dateStr)) {
        interactionsByDate.set(dateStr, []);
      }
      interactionsByDate.get(dateStr)!.push(i);
    });
    
    calendarHtml = getCalendarHtml(displayYear, displayMonth, interactionsByDate);
  }

  return layout('Interactions', `
    <div class="content-wrapper">
      ${linkAppHeader(`<span class="text-sm text-gray link-nav-user">${navUserLabel(user)}</span>`)}
      
      <div class="container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; margin-top: 1rem;">
          <h2 style="margin: 0;">Interactions</h2>
          <div style="display: flex; gap: 0.5rem;">
            <a href="/interactions?view=calendar" class="btn ${view === 'calendar' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">📅 Calendar</a>
            <a href="/interactions?view=list" class="btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}" style="padding: 0.5rem 1rem; font-size: 0.875rem;">📋 List</a>
            <a href="/interactions/new" class="btn btn-primary">+ Add Interaction</a>
          </div>
        </div>
      
      ${view === 'list' ? `
        <div class="card" style="margin-bottom: 1rem;">
          <form method="GET" action="/interactions" style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: end;">
            <input type="hidden" name="view" value="list">
            <div class="form-group" style="flex: 1; min-width: 200px; margin-bottom: 0;">
              <label class="form-label">Search</label>
              <input type="text" name="search" class="form-input" placeholder="Search interactions by contact name or notes..." value="${searchQuery}">
            </div>
            
            <div class="form-group" style="min-width: 200px; margin-bottom: 0;">
              <label class="form-label">Filter by Type</label>
              <select name="type" class="form-select">
                <option value="">All Types</option>
                <option value="meeting" ${typeFilter === 'meeting' ? 'selected' : ''}>Meeting</option>
                <option value="call" ${typeFilter === 'call' ? 'selected' : ''}>Call</option>
                <option value="email" ${typeFilter === 'email' ? 'selected' : ''}>Email</option>
                <option value="note" ${typeFilter === 'note' ? 'selected' : ''}>Note</option>
              </select>
            </div>
            
            <div style="display: flex; gap: 0.5rem;">
              <button type="submit" class="btn btn-primary">Apply</button>
              ${searchQuery || typeFilter ? `<a href="/interactions?view=list" class="btn btn-secondary">Clear</a>` : ''}
            </div>
          </form>
        </div>
        
        ${recentInteractions.length === 0 ? `
          <div class="card text-center">
            <p class="text-gray">No interactions yet. Add your first interaction!</p>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${recentInteractionsList}
          </div>
        `}
      ` : `
        ${calendarHtml}
        
        ${recentInteractions.length === 0 ? `
          <div class="card text-center" style="margin-top: 1rem;">
            <p class="text-gray">No interactions for this month.</p>
          </div>
        ` : ''}
      `}
      
      ${getFooterLinks()}
    </div>
    
    <!-- Interaction Modal -->
    <div id="interactionModal" class="modal">
      <div class="modal-content">
        <h3 style="margin-bottom: 1.5rem;">Edit Interaction</h3>
        <form id="interactionForm">
          <input type="hidden" id="modalInteractionId">
          <input type="hidden" id="modalContactId">
          
          <div class="form-group">
            <label class="form-label">Contact</label>
            <div id="modalContactName" style="padding: 0.5rem; background: #f9fafb; border-radius: 0.375rem; font-weight: 500;"></div>
          </div>
          
          <div class="form-group">
            <label class="form-label">Type</label>
            <select name="type" id="modalType" class="form-select" required>
              <option value="call">Call</option>
              <option value="email">Email</option>
              <option value="meeting">Meeting</option>
              <option value="message">Message</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" name="date" id="modalDate" class="form-input" required>
          </div>
          
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea name="notes" id="modalNotes" class="form-textarea" required></textarea>
          </div>
          
          <div class="form-group">
            <label class="form-label">Location (optional)</label>
            <input type="text" name="location" id="modalLocation" class="form-input" placeholder="e.g., Coffee shop, Office, Zoom">
          </div>
          
          <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
            <button type="submit" class="btn btn-primary">Save Changes</button>
            <button type="button" onclick="closeInteractionModal()" class="btn btn-secondary">Cancel</button>
            <button type="button" onclick="deleteInteraction()" class="btn btn-danger" style="margin-left: auto;">Delete</button>
          </div>
        </form>
      </div>
    </div>
    
    <script>
      function openInteractionModal(id, contactId, contactName, type, date, notes, location) {
        document.getElementById('modalInteractionId').value = id;
        document.getElementById('modalContactId').value = contactId;
        document.getElementById('modalContactName').textContent = contactName;
        document.getElementById('modalType').value = type.toLowerCase();
        
        // Convert timestamp to date string (UTC to avoid timezone issues)
        const dateObj = new Date(date);
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        document.getElementById('modalDate').value = year + '-' + month + '-' + day;
        
        // The notes are already properly escaped, just set them
        document.getElementById('modalNotes').value = notes;
        document.getElementById('modalLocation').value = location || '';
        
        document.getElementById('interactionModal').classList.add('active');
      }
      
      function closeInteractionModal() {
        document.getElementById('interactionModal').classList.remove('active');
      }
      
      // Close modal when clicking outside
      document.getElementById('interactionModal').addEventListener('click', (e) => {
        if (e.target.id === 'interactionModal') {
          closeInteractionModal();
        }
      });
      
      // Handle form submission
      document.getElementById('interactionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = document.getElementById('modalInteractionId').value;
        // Parse date as UTC to avoid timezone shifts
        const dateStr = formData.get('date');
        const [year, month, day] = dateStr.split('-').map(Number);
        const dateTimestamp = Date.UTC(year, month - 1, day);
        const data = {
          contactId: document.getElementById('modalContactId').value,
          type: formData.get('type'),
          date: dateTimestamp,
          notes: formData.get('notes'),
          location: formData.get('location') || null
        };
        
        try {
          const response = await fetch('/api/interactions/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (response.ok) {
            window.location.reload();
          } else {
            alert('Error updating interaction');
          }
        } catch (error) {
          alert('Error updating interaction');
        }
      });
      
      async function deleteInteraction() {
        if (!confirm('Are you sure you want to delete this interaction?')) {
          return;
        }
        
        const id = document.getElementById('modalInteractionId').value;
        
        try {
          const response = await fetch('/api/interactions/' + id, {
            method: 'DELETE'
          });
          
          if (response.ok) {
            window.location.reload();
          } else {
            alert('Error deleting interaction');
          }
        } catch (error) {
          alert('Error deleting interaction');
        }
      }
    </script>
    
    ${getBottomNav('interactions')}
    ${getQuickAddModal()}
    ${getQuickAddScript()}
    ${hasGoogleAccount ? getImportScript() : ''}
    ${getVoiceAssistantScript()}
  `)
}

export function privacyPolicyPage(user: any): string {
  return layout('Privacy Policy', `
    <div class="content-wrapper">
      ${linkAppHeader(`<a href="/dashboard" class="back-button">← Back</a>`)}
      
      <div class="section">
        <div class="card">
          <h2>Privacy Policy for Link</h2>
          <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
          
          <h3>1. Introduction</h3>
          <p>Welcome to LinkPRM (Link Person Relationship Manager). This privacy policy explains how we collect, use, and protect your personal information when you use our contact management service.</p>
          
          <h3>2. Information We Collect</h3>
          <p>We collect the following information:</p>
          <ul>
            <li><strong>Account Information:</strong> Email address and name when you sign up or authenticate via Google</li>
            <li><strong>Contact Data:</strong> Information about your contacts, interactions, and reminders that you choose to store in LinkPRM</li>
            <li><strong>Usage Data:</strong> Information about how you use the service</li>
          </ul>
          
          <h3>3. How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the LinkPRM service</li>
            <li>Authenticate your account</li>
            <li>Store and organize your contact information</li>
            <li>Send you reminders about important dates</li>
            <li>Improve our service</li>
          </ul>
          
          <h3>4. Data Storage and Security</h3>
          <p>Your data is stored securely using industry-standard encryption. We use Cloudflare's infrastructure to ensure high availability and security of your information.</p>
          
          <h3>5. Data Sharing</h3>
          <p>We do not sell, trade, or otherwise transfer your personal information to third parties. We only share data with service providers necessary to operate the service (such as Cloudflare for hosting).</p>
          
          <h3>6. Google Account Integration</h3>
          <p>When you authenticate with Google, we only access your basic profile information (name and email). We do not access your Google contacts or other Google services unless you explicitly authorize additional permissions.</p>
          
          <h3>7. Your Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Delete your account and all associated data</li>
            <li>Export your data</li>
          </ul>
          
          <h3>8. Data Retention</h3>
          <p>We retain your data for as long as your account is active. If you delete your account, we will delete all your personal information within 30 days.</p>
          
          <h3>9. Cookies</h3>
          <p>We use essential cookies to maintain your session and keep you logged in. We do not use tracking or advertising cookies.</p>
          
          <h3>10. Changes to This Policy</h3>
          <p>We may update this privacy policy from time to time. We will notify you of any changes by posting the new policy on this page.</p>
          
          <h3>11. Contact Us</h3>
          <p>If you have questions about this privacy policy, please contact us through the app.</p>
        </div>
      </div>
      
      ${getFooterLinks()}
    </div>
    ${getBottomNav('dashboard')}
  `)
}

export function termsOfServicePage(user: any): string {
  return layout('Terms of Service', `
    <div class="content-wrapper">
      ${linkAppHeader(`<a href="/dashboard" class="back-button">← Back</a>`)}
      
      <div class="section">
        <div class="card">
          <h2>Terms of Service for Link</h2>
          <p><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
          
          <h3>1. Acceptance of Terms</h3>
          <p>By accessing and using LinkPRM, you accept and agree to be bound by the terms and provisions of this agreement.</p>
          
          <h3>2. Description of Service</h3>
          <p>LinkPRM (Link Person Relationship Manager) is a contact management service that helps you organize and track your personal and professional relationships. The service allows you to:</p>
          <ul>
            <li>Store contact information</li>
            <li>Track interactions with contacts</li>
            <li>Set reminders for important dates</li>
            <li>Organize contacts with tags and notes</li>
          </ul>
          
          <h3>3. User Accounts</h3>
          <p>You are responsible for:</p>
          <ul>
            <li>Maintaining the security of your account</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>
          
          <h3>4. Acceptable Use</h3>
          <p>You agree not to:</p>
          <ul>
            <li>Use the service for any illegal purpose</li>
            <li>Violate any laws in your jurisdiction</li>
            <li>Infringe on the rights of others</li>
            <li>Upload malicious code or viruses</li>
            <li>Attempt to gain unauthorized access to the service</li>
            <li>Use the service to spam or harass others</li>
          </ul>
          
          <h3>5. Your Content</h3>
          <p>You retain all rights to the content you store in LinkPRM. By using the service, you grant us the right to store and process your content solely for the purpose of providing the service to you.</p>
          
          <h3>6. Service Availability</h3>
          <p>We strive to provide reliable service, but we do not guarantee:</p>
          <ul>
            <li>Uninterrupted access to the service</li>
            <li>Error-free operation</li>
            <li>That the service will meet your specific requirements</li>
          </ul>
          
          <h3>7. Limitation of Liability</h3>
          <p>LinkPRM is provided "as is" without warranty of any kind. We are not liable for any damages arising from your use of the service, including but not limited to:</p>
          <ul>
            <li>Loss of data</li>
            <li>Loss of profits</li>
            <li>Service interruptions</li>
          </ul>
          
          <h3>8. Data Backup</h3>
          <p>While we take reasonable measures to back up data, you are responsible for maintaining your own backups of important information.</p>
          
          <h3>9. Termination</h3>
          <p>We reserve the right to terminate or suspend your account at any time for violations of these terms. You may terminate your account at any time by deleting it through the app.</p>
          
          <h3>10. Changes to Terms</h3>
          <p>We may modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.</p>
          
          <h3>11. Governing Law</h3>
          <p>These terms are governed by the laws of the jurisdiction in which the service is operated.</p>
          
          <h3>12. Contact</h3>
          <p>If you have questions about these terms, please contact us through the app.</p>
        </div>
      </div>
      
      ${getFooterLinks()}
    </div>
    ${getBottomNav('dashboard')}
  `)
}
