/* TrifangX client — shared by chess_engine.html (lobby) and trifangx_live.html (in-game). */
if (typeof window !== 'undefined' && typeof window.TRIFANGX_PAGE_MODE !== 'string') {
  window.TRIFANGX_PAGE_MODE = 'lobby';
}

    let game, board;
    let playerColor = "white";
    let timerStart = 0;
    let timerInterval = null;
    let whiteTime, blackTime, increment;
    let timeLimited = false;
    let gameOver = false;
    let blindfoldMode = false;
    let showHistoryInBlindfold = false;
    let moveHistory = [];
    /** Elapsed thinking time per half-move (same order as game.history()), formatted like the move timer. */
    let moveClockTimes = [];
    let currentMoveIndex = -1;
    /** Last move line while at live position (includes clock); restored when leaving history scrub. */
    let lastLiveMoveDisplayText = 'None';
    let capturedPieces = { white: [], black: [] };
    let lastMoveSquares = { from: null, to: null };
    /** Saved live state when viewing a past game on the board (arrow keys). */
    let replayModeBackup = null;
    let isHistoryReplayMode = false;
    /** Full SAN list for the saved game for the whole replay session (notation never shrinks when scrubbing). */
    let historyReplayFullSan = null;
    /** True once the user has actually stepped forward to the final move; prevents Right from mis-recovering on initial load. */
    let reachedReplayEnd = false;
    let gameStartTime = null;
    let currentPieceStyle = 'classic';
    let premoves = []; // Store array of premoves as [{from: 'e2', to: 'e4'}, ...]
    /** Shared by live board handlers (buildLiveChessboardOptions) and finalize document listener. */
    let premoveJustSet = false;

    // Shop system - unlock tracking
    const defaultUnlocked = {
      boards: ['classic'],
      pieces: ['classic'],
      highlightColors: ['red'],
      arrowColors: ['red'],
      legalMoveDots: ['blue-circle'],
      themes: ['light'],
      moveEffects: ['default'],
      checkmateEffects: [],
      timeControls: ['none']
    };

    function getUnlockedItems() {
      const stored = localStorage.getItem('unlockedItems');
      const parsed = stored ? JSON.parse(stored) : {};
      // Handle backward compatibility - migrate old 'colors' to both highlightColors and arrowColors
      if (parsed.colors && !parsed.highlightColors && !parsed.arrowColors) {
        parsed.highlightColors = parsed.colors;
        parsed.arrowColors = parsed.colors;
        delete parsed.colors;
        saveUnlockedItems(parsed);
      }
      return {
        boards: parsed.boards || defaultUnlocked.boards,
        pieces: parsed.pieces || defaultUnlocked.pieces,
        highlightColors: parsed.highlightColors || defaultUnlocked.highlightColors,
        arrowColors: parsed.arrowColors || defaultUnlocked.arrowColors,
        legalMoveDots: parsed.legalMoveDots || defaultUnlocked.legalMoveDots,
        themes: parsed.themes || defaultUnlocked.themes,
        moveEffects: parsed.moveEffects || defaultUnlocked.moveEffects,
        checkmateEffects: parsed.checkmateEffects || defaultUnlocked.checkmateEffects,
        timeControls: parsed.timeControls || defaultUnlocked.timeControls
      };
    }
    
    function saveUnlockedItems(items) {
      localStorage.setItem('unlockedItems', JSON.stringify(items));
    }
    
    function unlockItem(category, itemId) {
      const unlocked = getUnlockedItems();
      if (!unlocked[category].includes(itemId)) {
        unlocked[category].push(itemId);
        saveUnlockedItems(unlocked);
        return true;
      }
      return false;
    }
    
    function isUnlocked(category, itemId) {
      const unlocked = getUnlockedItems();
      return (unlocked[category] || []).includes(itemId);
    }

    function getCheckmateAddonsEnabled() {
      try {
        const v = localStorage.getItem('checkmateAddonsEnabled');
        return v ? JSON.parse(v) : [];
      } catch (_) { return []; }
    }
    function setCheckmateAddonsEnabled(ids) {
      localStorage.setItem('checkmateAddonsEnabled', JSON.stringify(ids));
    }
    function toggleCheckmateAddon(id) {
      if (!isUnlocked('checkmateEffects', id)) return;
      const enabled = getCheckmateAddonsEnabled();
      const idx = enabled.indexOf(id);
      if (idx >= 0) enabled.splice(idx, 1);
      else enabled.push(id);
      setCheckmateAddonsEnabled(enabled);
    }
    
    // Points spent in shop (persisted); spendable = total - spent
    function getSpentPoints() {
      const v = localStorage.getItem('shopPointsSpent');
      return v ? parseInt(v, 10) : 0;
    }
    
    function addSpentPoints(amount) {
      const n = getSpentPoints() + amount;
      localStorage.setItem('shopPointsSpent', String(n));
    }
    
    function getSpendablePoints() {
      return Math.max(0, getTotalPoints() - getSpentPoints());
    }
    
    // Shop items with pricing (expensive – points are spent on purchase)
    const shopItems = {
      boards: [
        { id: 'classic', name: 'Classic', price: 0, preview: '⚪⚫', coolness: 1 },
        { id: 'blue', name: 'Blue', price: 250, preview: '🔵', coolness: 2 },
        { id: 'green', name: 'Green', price: 250, preview: '🟢', coolness: 2 },
        { id: 'gray', name: 'Gray', price: 250, preview: '⚪', coolness: 2 },
        { id: 'purple', name: 'Purple', price: 375, preview: '🟣', coolness: 3 },
        { id: 'wood', name: 'Wood', price: 600, preview: '🪵', coolness: 4 },
        { id: 'coral', name: 'Coral', price: 600, preview: '🪸', coolness: 4 },
        { id: 'marble', name: 'Marble', price: 900, preview: '⚪', coolness: 5 },
        { id: 'dark', name: 'Dark', price: 400, preview: '⚫', coolness: 3 },
        { id: 'neon', name: 'Neon', price: 1400, preview: '💡', coolness: 6 },
        { id: 'emerald', name: 'Emerald', price: 1000, preview: '💚', coolness: 5 },
        { id: 'gold', name: 'Gold', price: 2000, preview: '🟡', coolness: 7 },
        { id: 'ocean', name: 'Ocean', price: 1400, preview: '🌊', coolness: 6 },
        { id: 'sunset', name: 'Sunset', price: 1750, preview: '🌅', coolness: 7 },
        { id: 'midnight', name: 'Midnight', price: 1400, preview: '🌙', coolness: 6 },
        { id: 'forest', name: 'Forest', price: 1100, preview: '🌲', coolness: 5 },
        { id: 'royal', name: 'Royal', price: 2750, preview: '👑', coolness: 8 },
        { id: 'ice', name: 'Ice', price: 1750, preview: '❄️', coolness: 7 },
        { id: 'cherry', name: 'Cherry', price: 1400, preview: '🍒', coolness: 6 },
        { id: '3d', name: '3D', price: 3250, preview: '🎲', coolness: 9 },
        { id: 'glass', name: 'Glass', price: 3000, preview: '💎', coolness: 9 },
        { id: 'carbon', name: 'Carbon', price: 2250, preview: '⚫', coolness: 8 },
        { id: 'velvet', name: 'Velvet', price: 2750, preview: '🟣', coolness: 8 },
        { id: 'stone', name: 'Stone', price: 2000, preview: '🪨', coolness: 7 },
        { id: 'cyber', name: 'Cyber', price: 4000, preview: '&#9881;', coolness: 10 },
        { id: 'luxury', name: 'Luxury', price: 5000, preview: '💎', coolness: 10 }
      ],
      pieces: [
        { id: 'classic', name: 'Classic', price: 0, preview: '♟️', coolness: 1 },
        { id: 'alpha', name: 'Alpha', price: 600, preview: '♟️', coolness: 3 },
        { id: 'cburnett', name: 'CBurnett', price: 900, preview: '♟️', coolness: 4 },
        { id: 'merida', name: 'Merida', price: 1250, preview: '♟️', coolness: 5 },
        { id: 'pirouetti', name: 'Pirouetti', price: 1600, preview: '♟️', coolness: 6 },
        { id: 'spatial', name: 'Spatial', price: 2000, preview: '♟️', coolness: 7 },
        { id: 'california', name: 'California', price: 2250, preview: '♟️', coolness: 7 },
        { id: 'cardinal', name: 'Cardinal', price: 2600, preview: '♟️', coolness: 8 },
        { id: 'chessnut', name: 'Chessnut', price: 2900, preview: '♟️', coolness: 8 },
        { id: 'chess7', name: 'Chess7', price: 3250, preview: '♟️', coolness: 9 },
        { id: 'reillycraig', name: 'Reilly Craig', price: 3600, preview: '♟️', coolness: 9 },
        { id: 'riohacha', name: 'Riohacha', price: 4000, preview: '♟️', coolness: 9 },
        { id: 'shapes', name: 'Shapes', price: 4750, preview: '♟️', coolness: 10 },
        { id: 'staunty', name: 'Staunty', price: 5500, preview: '♟️', coolness: 10 },
        { id: 'tatiana', name: 'Tatiana', price: 7500, preview: '♟️', coolness: 10 }
      ],
      highlightColors: [
        { id: 'red', name: 'Red Highlights', price: 0, preview: '🔴', coolness: 1, description: 'Classic red' },
        { id: 'blue', name: 'Blue Highlights', price: 1000, preview: '🔵', coolness: 4, description: 'Cool blue' },
        { id: 'green', name: 'Green Highlights', price: 1000, preview: '🟢', coolness: 4, description: 'Fresh green' },
        { id: 'purple', name: 'Purple Highlights', price: 1400, preview: '🟣', coolness: 5, description: 'Royal purple' },
        { id: 'gold', name: 'Gold Highlights', price: 2000, preview: '🟡', coolness: 7, description: 'Luxurious gold' },
        { id: 'orange', name: 'Orange Highlights', price: 1200, preview: '🟠', coolness: 4, description: 'Vibrant orange' },
        { id: 'pink', name: 'Pink Highlights', price: 1400, preview: '🩷', coolness: 5, description: 'Pretty pink' },
        { id: 'cyan', name: 'Cyan Highlights', price: 1700, preview: '🔷', coolness: 6, description: 'Electric cyan' },
        { id: 'rainbow', name: 'Rainbow Highlights', price: 3250, preview: '🌈', coolness: 10, description: 'Colorful rainbow' }
      ],
      arrowColors: [
        { id: 'red', name: 'Red Arrows', price: 0, preview: '🔴', coolness: 1, description: 'Classic red' },
        { id: 'blue', name: 'Blue Arrows', price: 1000, preview: '🔵', coolness: 4, description: 'Cool blue' },
        { id: 'green', name: 'Green Arrows', price: 1000, preview: '🟢', coolness: 4, description: 'Fresh green' },
        { id: 'purple', name: 'Purple Arrows', price: 1400, preview: '🟣', coolness: 5, description: 'Royal purple' },
        { id: 'gold', name: 'Gold Arrows', price: 2000, preview: '🟡', coolness: 7, description: 'Luxurious gold' },
        { id: 'orange', name: 'Orange Arrows', price: 1200, preview: '🟠', coolness: 4, description: 'Vibrant orange' },
        { id: 'pink', name: 'Pink Arrows', price: 1400, preview: '🩷', coolness: 5, description: 'Pretty pink' },
        { id: 'cyan', name: 'Cyan Arrows', price: 1700, preview: '🔷', coolness: 6, description: 'Electric cyan' },
        { id: 'rainbow', name: 'Rainbow Arrows', price: 3250, preview: '🌈', coolness: 10, description: 'Colorful rainbow' }
      ],
      legalMoveDots: [
        { id: 'blue-circle', name: 'Gray Circle', price: 0, preview: '⚪', coolness: 1, description: 'Classic gray dot', color: 'rgba(128, 128, 128, 0.6)', shape: 'circle' },
        { id: 'red-circle', name: 'Red Circle', price: 750, preview: '🔴', coolness: 3, description: 'Red dot', color: '#e74c3c', shape: 'circle' },
        { id: 'green-circle', name: 'Green Circle', price: 750, preview: '🟢', coolness: 3, description: 'Green dot', color: '#2ecc71', shape: 'circle' },
        { id: 'purple-circle', name: 'Purple Circle', price: 1000, preview: '🟣', coolness: 4, description: 'Purple dot', color: '#9b59b6', shape: 'circle' },
        { id: 'gold-circle', name: 'Gold Circle', price: 1500, preview: '🟡', coolness: 6, description: 'Gold dot', color: '#f1c40f', shape: 'circle' },
        { id: 'blue-square', name: 'Blue Square', price: 900, preview: '⬛', coolness: 4, description: 'Blue square', color: '#3498db', shape: 'square' },
        { id: 'red-square', name: 'Red Square', price: 1000, preview: '⬛', coolness: 4, description: 'Red square', color: '#e74c3c', shape: 'square' },
        { id: 'green-square', name: 'Green Square', price: 1000, preview: '⬛', coolness: 4, description: 'Green square', color: '#2ecc71', shape: 'square' },
        { id: 'blue-diamond', name: 'Blue Diamond', price: 1100, preview: '💠', coolness: 5, description: 'Blue diamond', color: '#3498db', shape: 'diamond' },
        { id: 'red-diamond', name: 'Red Diamond', price: 1250, preview: '💠', coolness: 5, description: 'Red diamond', color: '#e74c3c', shape: 'diamond' },
        { id: 'gold-star', name: 'Gold Star', price: 1750, preview: '⭐', coolness: 7, description: 'Gold star', color: '#f1c40f', shape: 'star' },
        { id: 'rainbow-circle', name: 'Rainbow Circle', price: 2500, preview: '🌈', coolness: 9, description: 'Rainbow dot', color: 'rainbow', shape: 'circle' }
      ],
      themes: [
        { id: 'light', name: 'Light', price: 0, preview: '☀️', coolness: 1, description: 'Default light page' },
        { id: 'dark', name: 'Dark', price: 1250, preview: '🌑', coolness: 5, description: 'Dark page theme' },
        { id: 'midnight', name: 'Midnight', price: 1750, preview: '🌙', coolness: 7, description: 'Deep blue-black' },
        { id: 'ocean', name: 'Ocean', price: 1750, preview: '🌊', coolness: 7, description: 'Blue-teal page' },
        { id: 'forest', name: 'Forest', price: 2000, preview: '🌲', coolness: 8, description: 'Nature vibes with particles' },
        { id: 'sunset', name: 'Sunset', price: 2000, preview: '🌅', coolness: 8, description: 'Warm gradient animation' },
        { id: 'cyber', name: 'Cyber', price: 2500, preview: '💻', coolness: 9, description: 'Neon grid & glitch effects' },
        { id: 'space', name: 'Space', price: 2500, preview: '🚀', coolness: 9, description: 'Animated stars & nebula' },
        { id: 'aurora', name: 'Aurora', price: 3000, preview: '🌌', coolness: 10, description: 'Northern lights effect' },
        { id: 'matrix', name: 'Matrix', price: 2750, preview: '🔢', coolness: 9, description: 'Falling code rain' },
        { id: 'retro', name: 'Retro', price: 2250, preview: '📺', coolness: 8, description: '80s scanlines & glow' },
        { id: 'galaxy', name: 'Galaxy', price: 3000, preview: '🌠', coolness: 10, description: 'Spiral galaxy animation' },
        { id: 'fire', name: 'Fire', price: 2500, preview: '🔥', coolness: 9, description: 'Animated flames' }
      ],
      checkmateEffects: [
        { id: 'confetti', name: 'Confetti', price: 750, preview: '🎊', coolness: 5, description: 'Confetti add-on' },
        { id: 'fireworks', name: 'Fireworks', price: 1250, preview: '🎆', coolness: 8, description: 'Firework add-on' },
        { id: 'pulse', name: 'Pulse', price: 400, preview: '💓', coolness: 3, description: 'Pulse add-on' },
        { id: 'sparkles', name: 'Starfall', price: 900, preview: '✨', coolness: 6, description: 'Twinkling stars across the screen' },
        { id: 'balloons', name: 'Balloons', price: 1100, preview: '🎈', coolness: 7, description: 'Balloons float up on a win' },
        { id: 'spotlight', name: 'Spotlight', price: 1350, preview: '🔦', coolness: 7, description: 'Sweeping stage lights' },
        { id: 'hearts', name: 'Hearts', price: 800, preview: '❤️', coolness: 5, description: 'Floating hearts' },
        { id: 'meteors', name: 'Meteors', price: 1600, preview: '☄️', coolness: 8, description: 'Shooting streaks' },
        { id: 'ribbons', name: 'Streamers', price: 1000, preview: '🎀', coolness: 6, description: 'Colorful streamers' },
        { id: 'shockwave', name: 'Shockwave', price: 1250, preview: '💫', coolness: 7, description: 'Expanding rings from the board' }
      ],
      timeControls: [
        { id: 'none', name: 'None', price: 0, preview: '⏸️', coolness: 1, description: 'No time limit' },
        { id: '60', name: '1 min', price: 1500, preview: '1️⃣', coolness: 5, description: '1 minute' },
        { id: '180|2', name: '3 | 2', price: 2000, preview: '3️⃣', coolness: 6, description: '3 min + 2s' },
        { id: '300|0', name: '5 min', price: 2500, preview: '5️⃣', coolness: 7, description: '5 minutes' },
        { id: '600|0', name: '10 min', price: 3000, preview: '🔟', coolness: 8, description: '10 minutes' },
        { id: '900|5', name: '15 | 5', price: 3500, preview: '1️⃣5️⃣', coolness: 9, description: '15 min + 5s' },
        { id: '3600|0', name: '60 min', price: 4000, preview: '⏱️', coolness: 10, description: '60 minutes' }
      ]
    };
    
    let currentShopTab = 'boards';
    let currentHighlightColor = 'red';
    let currentArrowColor = 'red';
    let currentPageTheme = 'light';
    let currentMoveEffect = 'default';

    // Board preview colors for shop (white/black square styles)
    const boardPreviewColors = {
      classic: { w: 'linear-gradient(135deg,#f0d9b5,#e8d0a8)', b: 'linear-gradient(135deg,#b58863,#a67c52)' },
      blue: { w: 'linear-gradient(135deg,#dee3e6,#d0d8dd)', b: 'linear-gradient(135deg,#8ca2ad,#7a95a3)' },
      green: { w: 'linear-gradient(135deg,#ffffdd,#f5f5c8)', b: 'linear-gradient(135deg,#86a666,#75955a)' },
      gray: { w: 'linear-gradient(135deg,#e8e8e8,#dcdcdc)', b: 'linear-gradient(135deg,#999,#888)' },
      purple: { w: 'linear-gradient(135deg,#e8d4f2,#dfc5ed)', b: 'linear-gradient(135deg,#9b6db5,#8a5da0)' },
      wood: { w: 'linear-gradient(135deg,#f4dec4,#ead4b0)', b: 'linear-gradient(135deg,#8b5a2b,#7a4a1f)' },
      coral: { w: 'linear-gradient(135deg,#ffebcd,#ffe0b3)', b: 'linear-gradient(135deg,#cd853f,#b87333)' },
      marble: { w: 'linear-gradient(135deg,#f5f5f0,#ecece5)', b: 'linear-gradient(135deg,#8b8680,#7d7872)' },
      dark: { w: 'linear-gradient(135deg,#4a5568,#3d4758)', b: 'linear-gradient(135deg,#2d3748,#1a202c)' },
      neon: { w: 'linear-gradient(135deg,#e0f7fa,#b2ebf2)', b: 'linear-gradient(135deg,#00acc1,#00838f)' },
      emerald: { w: 'linear-gradient(135deg,#d5f5e3,#abebc6)', b: 'linear-gradient(135deg,#1e8449,#186a3b)' },
      gold: { w: 'linear-gradient(135deg,#fef9e7,#fcf3cf)', b: 'linear-gradient(135deg,#d4ac0d,#b7950b)' },
      ocean: { w: 'linear-gradient(135deg,#d6eaf8,#aed6f1)', b: 'linear-gradient(135deg,#1a5276,#154360)' },
      sunset: { w: 'linear-gradient(135deg,#fdebd0,#f5cba7)', b: 'linear-gradient(135deg,#e74c3c,#c0392b)' },
      midnight: { w: 'linear-gradient(135deg,#2c3e50,#1a252f)', b: 'linear-gradient(135deg,#0d1b2a,#0a1628)' },
      forest: { w: 'linear-gradient(135deg,#e8f5e9,#c8e6c9)', b: 'linear-gradient(135deg,#2e7d32,#1b5e20)' },
      royal: { w: 'linear-gradient(135deg,#f3e5f5,#e1bee7)', b: 'linear-gradient(135deg,#6a1b9a,#4a148c)' },
      ice: { w: 'linear-gradient(135deg,#e0f7fa,#b2ebf2)', b: 'linear-gradient(135deg,#0097a7,#006064)' },
      cherry: { w: 'linear-gradient(135deg,#ffebee,#ffcdd2)', b: 'linear-gradient(135deg,#c62828,#b71c1c)' },
      '3d': { w: 'linear-gradient(145deg,#fff 0%,#e8e8e8 100%)', b: 'linear-gradient(145deg,#444,#2a2a2a)' },
      glass: { w: 'linear-gradient(135deg,rgba(255,255,255,0.9),rgba(240,240,255,0.8))', b: 'linear-gradient(135deg,rgba(100,100,120,0.6),rgba(60,60,80,0.7))' },
      carbon: { w: 'linear-gradient(135deg,#4a4a4a,#3a3a3a)', b: 'linear-gradient(135deg,#1a1a1a,#0d0d0d)' },
      velvet: { w: 'linear-gradient(135deg,#ede7f6,#d1c4e9)', b: 'linear-gradient(135deg,#512da8,#311b92)' },
      stone: { w: 'linear-gradient(135deg,#bdbdbd,#9e9e9e)', b: 'linear-gradient(135deg,#616161,#424242)' },
      cyber: { w: 'linear-gradient(135deg,#00ff88,#00cc6a)', b: 'linear-gradient(135deg,#0d0d0d,#1a1a2e)' },
      luxury: { w: 'linear-gradient(135deg,#fff8e1,#ffecb3)', b: 'linear-gradient(135deg,#ff8f00,#e65100)' }
    };
    
    // Initialize arrow colors
    window.currentArrowColor = 'rgba(250, 180, 0, 0.7)';
    window.currentArrowFillColor = 'rgba(250, 180, 0, 1)';
    let premoveHighlightInterval = null; // Store interval ID for premove highlighting
    let selectedSquare = null; // Track clicked piece for click-to-move
    let pendingPromotionMove = null; // Track pending promotion move {from, to}
    // Engine personality removed for performance
    let currentTimeControl = 'none'; // Track current time control for achievements
    let soundEnabled = true; // Sound effects toggle
    let playerStats = { wins: 0, losses: 0, draws: 0 }; // Player statistics
    let achievements = []; // Achievements unlocked
    
    // Right-click highlighting and arrows
    let rightClickHighlightedSquares = new Set(); // Track squares highlighted with right-click
    let arrows = []; // Track arrows as [{from: 'e2', to: 'e4'}, ...]
    let rightClickHighlightInterval = null; // Interval to continuously reapply right-click highlights
    let isRightClickDragging = false; // Track if user is right-click dragging
    let rightClickStartSquare = null; // Track starting square for right-click drag
    let gameStats = { // In-game statistics for achievements (temporary, only committed when game ends)
      // Captures delivered by your moving piece (by type); not the type of enemy piece taken
      capturesByQueen: 0,
      capturesByRook: 0,
      capturesByBishop: 0,
      capturesByKnight: 0,
      capturesByPawn: 0,
      totalCaptures: 0,
      checksGiven: 0,
      castlingMoves: 0,
      promotions: 0,
      enPassants: 0,
      longestGame: 0,
      shortestWin: Infinity,
      // Enemy piece types taken off the board (victim); not which of your pieces captured them
      capturedQueens: 0,
      capturedRooks: 0,
      capturedBishops: 0,
      capturedKnights: 0,
      capturedPawns: 0,
      // Your pieces lost (victim type) when the opponent captures; per-game only (not merged to lifetime)
      lostQueens: 0,
      lostRooks: 0,
      lostBishops: 0,
      lostKnights: 0,
      lostPawns: 0,
      // Random achievement tracking
      movesToE4: 0,
      movesToD4: 0,
      movesToE5: 0,
      movesToD5: 0,
      knightToF3: 0,
      knightToC3: 0,
      knightToF6: 0,
      knightToC6: 0,
      movesOnMove1: 0,
      movesOnMove5: 0,
      movesOnMove10: 0,
      movesOnMove20: 0,
      movesOnMove50: 0,
      pawnToE4: 0,
      pawnToD4: 0,
      queenToD4: 0,
      queenToE4: 0,
      bishopToF4: 0,
      rookToE1: 0,
      kingToE1: 0,
      castledOnMove10: 0,
      castledOnMove20: 0,
      promotedToQueen: 0,
      promotedToRook: 0,
      promotedToBishop: 0,
      promotedToKnight: 0,
      checkOnMove5: 0,
      captureOnMove10: 0,
      // Additional tracking for varied requirements
      movesToE4Multiple: 0,
      movesToD4Multiple: 0,
      knightToF3Multiple: 0,
      knightToC3Multiple: 0,
      queenToD4Multiple: 0,
      promotedToQueenMultiple: 0,
      // Random piece-to-square tracking
      rookToA1: 0, rookToH1: 0, rookToA8: 0, rookToH8: 0,
      bishopToC1: 0, bishopToF1: 0, bishopToC8: 0, bishopToF8: 0,
      knightToG1: 0, knightToB1: 0, knightToG8: 0, knightToB8: 0,
      queenToA1: 0, queenToH1: 0, queenToA8: 0, queenToH8: 0,
      kingToG1: 0, kingToC1: 0, kingToG8: 0, kingToC8: 0,
      pawnToA2: 0, pawnToH2: 0, pawnToA7: 0, pawnToH7: 0,
      // Daily stats for this game
      dailyStats: {
        movesMadeToday: 0,
        capturesToday: 0,
        checksGivenToday: 0,
        uniqueSquaresVisitedToday: []
      }
    };
    
    function resetGameStats() {
      gameStats = {
        capturesByQueen: 0,
        capturesByRook: 0,
        capturesByBishop: 0,
        capturesByKnight: 0,
        capturesByPawn: 0,
        totalCaptures: 0,
        checksGiven: 0,
        castlingMoves: 0,
        promotions: 0,
        enPassants: 0,
        longestGame: 0,
        shortestWin: Infinity,
        capturedQueens: 0,
        capturedRooks: 0,
        capturedBishops: 0,
        capturedKnights: 0,
        capturedPawns: 0,
        lostQueens: 0,
        lostRooks: 0,
        lostBishops: 0,
        lostKnights: 0,
        lostPawns: 0,
        movesToE4: 0,
        movesToD4: 0,
        movesToE5: 0,
        movesToD5: 0,
        knightToF3: 0,
        knightToC3: 0,
        knightToF6: 0,
        knightToC6: 0,
        movesOnMove1: 0,
        movesOnMove5: 0,
        movesOnMove10: 0,
        movesOnMove20: 0,
        movesOnMove50: 0,
        pawnToE4: 0,
        pawnToD4: 0,
        queenToD4: 0,
        queenToE4: 0,
        bishopToF4: 0,
        rookToE1: 0,
        kingToE1: 0,
        castledOnMove10: 0,
        castledOnMove20: 0,
        promotedToQueen: 0,
        promotedToRook: 0,
        promotedToBishop: 0,
        promotedToKnight: 0,
        checkOnMove5: 0,
        captureOnMove10: 0,
        movesToE4Multiple: 0,
        movesToD4Multiple: 0,
        knightToF3Multiple: 0,
        knightToC3Multiple: 0,
        queenToD4Multiple: 0,
        promotedToQueenMultiple: 0,
        rookToA1: 0, rookToH1: 0, rookToA8: 0, rookToH8: 0,
        bishopToC1: 0, bishopToF1: 0, bishopToC8: 0, bishopToF8: 0,
        knightToG1: 0, knightToB1: 0, knightToG8: 0, knightToB8: 0,
        queenToA1: 0, queenToH1: 0, queenToA8: 0, queenToH8: 0,
        kingToG1: 0, kingToC1: 0, kingToG8: 0, kingToC8: 0,
        pawnToA2: 0, pawnToH2: 0, pawnToA7: 0, pawnToH7: 0,
        dailyStats: {
          movesMadeToday: 0,
          capturesToday: 0,
          checksGivenToday: 0,
          uniqueSquaresVisitedToday: [],
          bishopMovesInBlindfoldToday: 0,
          currentStreakNoPiecesLost: 0, // Current streak of moves without losing pieces in this game
          hasEnPassant: false, // Track if this game had en passant
          hasUnderpromotion: false, // Track if this game had underpromotion
          promotionTypes: [], // Track types of promotions in this game (q, r, b, n)
          castlingTypes: [], // Track types of castling in this game (k for kingside, q for queenside)
          maxChecksInGame: 0, // Track max checks given in this game
          capturedPieceTypes: [], // Track types of pieces captured in this game
          // New unique daily challenge tracking
          knightMovesInPureBlindfoldToday: 0, // Knight moves in blindfold without history
          promotionsInGame: 0, // Count promotions in current game
          queenVisitedCorners: [], // Track which corners queen visited (a1, h1, a8, h8)
          rooksOnSeventhRank: 0, // Track rooks on 7th/2nd rank
          bishopsKept: 2, // Track if both bishops kept (starts at 2, decrements when lost)
          knightForks: 0, // Count knight forks in this game
          pawnsAdvancedToSixth: [], // Track which pawns reached 6th/3rd rank
          kingMoves: 0, // Count king moves in this game
          pieceTypesMoved: [], // Track which piece types moved (p, n, b, r, q, k)
          eFileSquaresVisited: [], // Track squares on e-file visited
          piecesSacrificed: [], // Track pieces sacrificed (not pawns)
          centerSquaresOccupied: [], // Track center squares occupied (d4, d5, e4, e5)
          pawnIslands: 0, // Count isolated pawn islands
          rookBatteryCreated: false, // Track if rook battery created
          pinsCreated: 0, // Count pins created
          skewersCreated: 0, // Count skewers created
          discoveredAttacks: 0, // Count discovered attacks
          consecutiveChecks: 0, // Track consecutive checks
          maxConsecutiveChecks: 0, // Max consecutive checks in this game
          zwischenzugMade: false, // Track if zwischenzug made
          pawnMovesToday: 0, // Player pawn moves (committed to lifetime daily at game end)
          underpromotionMovesToday: 0,
          playerCapturesByType: { p: 0, n: 0, b: 0, r: 0, q: 0 }
        }
      };
    }
    
    function trackWinStats(moveCount, checkmatePiece = null) {
      gameStats._isWinGameEnd = true;
      // Track wins by time control
      if (currentTimeControl && lifetimeStats.winsByTimeControl) {
        if (!lifetimeStats.winsByTimeControl[currentTimeControl]) {
          lifetimeStats.winsByTimeControl[currentTimeControl] = 0;
        }
        lifetimeStats.winsByTimeControl[currentTimeControl]++;
        
        // Track wins by time control today (for daily challenges)
        if (lifetimeStats.dailyStats) {
          if (!lifetimeStats.dailyStats.winsByTimeControlToday) {
            lifetimeStats.dailyStats.winsByTimeControlToday = {};
          }
          if (!lifetimeStats.dailyStats.winsByTimeControlToday[currentTimeControl]) {
            lifetimeStats.dailyStats.winsByTimeControlToday[currentTimeControl] = 0;
          }
          lifetimeStats.dailyStats.winsByTimeControlToday[currentTimeControl]++;
        }
      }
      
      // Personality tracking removed
      
      // Track wins by color
      if (playerColor === 'white') {
        lifetimeStats.winsAsWhite = (lifetimeStats.winsAsWhite || 0) + 1;
        if (lifetimeStats.dailyStats) {
          lifetimeStats.dailyStats.winsAsWhiteToday = (lifetimeStats.dailyStats.winsAsWhiteToday || 0) + 1;
        }
      } else {
        lifetimeStats.winsAsBlack = (lifetimeStats.winsAsBlack || 0) + 1;
        if (lifetimeStats.dailyStats) {
          lifetimeStats.dailyStats.winsAsBlackToday = (lifetimeStats.dailyStats.winsAsBlackToday || 0) + 1;
        }
      }
      if (lifetimeStats.dailyStats) {
        if (moveCount <= 25) {
          lifetimeStats.dailyStats.quickWinsToday = (lifetimeStats.dailyStats.quickWinsToday || 0) + 1;
        }
        if (moveCount <= 30) {
          lifetimeStats.dailyStats.fastWins30Today = (lifetimeStats.dailyStats.fastWins30Today || 0) + 1;
        }
      }
      
      // Track creative achievements
      if (moveCount <= 10) {
        lifetimeStats.winsInUnder10Moves = (lifetimeStats.winsInUnder10Moves || 0) + 1;
      }
      if (moveCount <= 20) {
        lifetimeStats.winsInUnder20Moves = (lifetimeStats.winsInUnder20Moves || 0) + 1;
      }
      if (moveCount <= 15) {
        lifetimeStats.winsInUnder15Moves = (lifetimeStats.winsInUnder15Moves || 0) + 1;
      }
      if (moveCount >= 100) {
        lifetimeStats.winsInOver100Moves = (lifetimeStats.winsInOver100Moves || 0) + 1;
      }
      
      // Track checkmate piece
      if (checkmatePiece) {
        const pieceType = checkmatePiece.toLowerCase();
        if (pieceType === 'n') lifetimeStats.checkmateWithKnight = (lifetimeStats.checkmateWithKnight || 0) + 1;
        else if (pieceType === 'b') lifetimeStats.checkmateWithBishop = (lifetimeStats.checkmateWithBishop || 0) + 1;
        else if (pieceType === 'r') lifetimeStats.checkmateWithRook = (lifetimeStats.checkmateWithRook || 0) + 1;
        else if (pieceType === 'q') lifetimeStats.checkmateWithQueen = (lifetimeStats.checkmateWithQueen || 0) + 1;
        else if (pieceType === 'p') lifetimeStats.checkmateWithPawn = (lifetimeStats.checkmateWithPawn || 0) + 1;
        
        // Track unique checkmate pieces today (for daily challenge)
        if (lifetimeStats.dailyStats) {
          if (!lifetimeStats.dailyStats.uniqueCheckmatePiecesToday) {
            lifetimeStats.dailyStats.uniqueCheckmatePiecesToday = [];
          }
          if (!lifetimeStats.dailyStats.uniqueCheckmatePiecesToday.includes(pieceType)) {
            lifetimeStats.dailyStats.uniqueCheckmatePiecesToday.push(pieceType);
          }
        }
      }
      
      // Track perfect games (no pieces lost)
      const totalLost = (gameStats.lostQueens || 0) + (gameStats.lostRooks || 0) +
                       (gameStats.lostBishops || 0) + (gameStats.lostKnights || 0) +
                       (gameStats.lostPawns || 0);
      if (totalLost === 0) {
        lifetimeStats.perfectGames = (lifetimeStats.perfectGames || 0) + 1;
        // Track perfect wins for daily challenge
        if (lifetimeStats.dailyStats) {
          lifetimeStats.dailyStats.perfectWinsToday = (lifetimeStats.dailyStats.perfectWinsToday || 0) + 1;
        }
      }
      
      // Track queen sacrifice wins (if we lost a queen but still won)
      if (gameStats.lostQueens > 0 && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.queenSacrificeWinsToday = (lifetimeStats.dailyStats.queenSacrificeWinsToday || 0) + 1;
      }
      
      // Track comeback wins (win after being down 5+ material points)
      // This is checked by comparing material at different points - simplified: if we won and had captured fewer pieces earlier
      // For now, we'll track this in commitGameStatsToLifetime by checking material difference
      
      // Track max checks in single game
      if (gameStats.dailyStats && gameStats.dailyStats.maxChecksInGame) {
        const currentMax = lifetimeStats.dailyStats.maxChecksInSingleGameToday || 0;
        if (gameStats.dailyStats.maxChecksInGame > currentMax) {
          lifetimeStats.dailyStats.maxChecksInSingleGameToday = gameStats.dailyStats.maxChecksInGame;
        }
      }
      
      // Track time pressure wins (won with less than 10 seconds remaining)
      if (timeLimited && lifetimeStats.dailyStats) {
        try {
          const playerTimeRemaining = playerColor === 'white' ? whiteTime : blackTime;
          // whiteTime/blackTime are stored in milliseconds
          if (playerTimeRemaining > 0 && playerTimeRemaining < 10 * 1000) {
            lifetimeStats.dailyStats.timePressureWinsToday = (lifetimeStats.dailyStats.timePressureWinsToday || 0) + 1;
            lifetimeStats.timePressureWins = (lifetimeStats.timePressureWins || 0) + 1;
          }
        } catch (e) {
          console.error('Error tracking time pressure win:', e);
        }
      }
      
      // Track castling types across all games today (for double castle challenge)
      if (gameStats.dailyStats && gameStats.dailyStats.castlingTypes && lifetimeStats.dailyStats) {
        if (!lifetimeStats.dailyStats.castlingTypesToday) {
          lifetimeStats.dailyStats.castlingTypesToday = [];
        }
        gameStats.dailyStats.castlingTypes.forEach(type => {
          if (!lifetimeStats.dailyStats.castlingTypesToday.includes(type)) {
            lifetimeStats.dailyStats.castlingTypesToday.push(type);
          }
        });
      }
      
      // Track variety promotion games
      if (gameStats.dailyStats && gameStats.dailyStats.promotionTypes && gameStats.dailyStats.promotionTypes.length >= 2) {
        lifetimeStats.dailyStats.varietyPromotionGamesToday = (lifetimeStats.dailyStats.varietyPromotionGamesToday || 0) + 1;
      }
      
      // Track piece hunter games (captured 5 different piece types)
      if (gameStats.dailyStats && gameStats.dailyStats.capturedPieceTypes && gameStats.dailyStats.capturedPieceTypes.length >= 5) {
        lifetimeStats.dailyStats.pieceHunterGamesToday = (lifetimeStats.dailyStats.pieceHunterGamesToday || 0) + 1;
      }
      
      // Track material advantage at win (for daily challenge)
      try {
        const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
        let whiteMaterial = 0;
        let blackMaterial = 0;
        const board = game.board();
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            const piece = board[i][j];
            if (piece) {
              const value = pieceValues[piece.type];
              if (piece.color === 'w') {
                whiteMaterial += value;
              } else {
                blackMaterial += value;
              }
            }
          }
        }
        const materialDiff = playerColor === 'white' ? (whiteMaterial - blackMaterial) : (blackMaterial - whiteMaterial);
        if (materialDiff >= 3 && lifetimeStats.dailyStats) {
          lifetimeStats.dailyStats.winsWithMaterialAdvantageToday = (lifetimeStats.dailyStats.winsWithMaterialAdvantageToday || 0) + 1;
        }
      } catch (e) {
        console.error('Error calculating material advantage:', e);
      }
      
      // Track opening played today (for daily challenge)
      try {
        if (typeof detectOpening === 'function') {
          const opening = detectOpening();
          if (opening && lifetimeStats.dailyStats) {
            if (!lifetimeStats.dailyStats.uniqueOpeningsPlayedToday) {
              lifetimeStats.dailyStats.uniqueOpeningsPlayedToday = [];
            }
            if (!lifetimeStats.dailyStats.uniqueOpeningsPlayedToday.includes(opening)) {
              lifetimeStats.dailyStats.uniqueOpeningsPlayedToday.push(opening);
            }
          }
        }
      } catch (e) {
        console.error('Error tracking opening:', e);
      }
      
      // Comeback wins (lifetime): opponent took 5+ more points of material from you than you took from them (exchange)
      const materialWeLost = (gameStats.lostQueens || 0) * 9 + (gameStats.lostRooks || 0) * 5 +
        (gameStats.lostBishops || 0) * 3 + (gameStats.lostKnights || 0) * 3 + (gameStats.lostPawns || 0);
      const materialWeCaptured = (gameStats.capturedQueens || 0) * 9 + (gameStats.capturedRooks || 0) * 5 +
        (gameStats.capturedBishops || 0) * 3 + (gameStats.capturedKnights || 0) * 3 + (gameStats.capturedPawns || 0);
      if (materialWeLost - materialWeCaptured >= 5) {
        lifetimeStats.comebackWins = (lifetimeStats.comebackWins || 0) + 1;
      }

      // Track win streak
      lifetimeStats.currentWinStreak = (lifetimeStats.currentWinStreak || 0) + 1;
      if (lifetimeStats.currentWinStreak > (lifetimeStats.longestWinStreak || 0)) {
        lifetimeStats.longestWinStreak = lifetimeStats.currentWinStreak;
      }
      
      // Track blindfold wins
      if (blindfoldMode) {
        lifetimeStats.blindfoldWins = (lifetimeStats.blindfoldWins || 0) + 1;
        // Track wins without move history (harder achievement)
        if (!showHistoryInBlindfold) {
          lifetimeStats.blindfoldWinsNoHistory = (lifetimeStats.blindfoldWinsNoHistory || 0) + 1;
          // Track pure blindfold wins for daily challenge
          if (lifetimeStats.dailyStats) {
            lifetimeStats.dailyStats.pureBlindfoldWinsToday = (lifetimeStats.dailyStats.pureBlindfoldWinsToday || 0) + 1;
          }
        }
      }
      
      // Track new unique daily challenges
      if (gameStats && gameStats.dailyStats && lifetimeStats.dailyStats) {
        // Triple promotion games
        if (gameStats.dailyStats.promotionsInGame >= 3) {
          lifetimeStats.dailyStats.triplePromotionGamesToday = (lifetimeStats.dailyStats.triplePromotionGamesToday || 0) + 1;
        }
        
        // Queen tour (visited all 4 corners)
        if (gameStats.dailyStats.queenVisitedCorners && gameStats.dailyStats.queenVisitedCorners.length >= 4) {
          lifetimeStats.dailyStats.queenTourGamesToday = (lifetimeStats.dailyStats.queenTourGamesToday || 0) + 1;
        }
        
        // Rook ladder (both rooks on 7th/2nd rank)
        if (gameStats.dailyStats.rooksOnSeventhRank >= 2) {
          lifetimeStats.dailyStats.rookLadderGamesToday = (lifetimeStats.dailyStats.rookLadderGamesToday || 0) + 1;
        }
        
        // Bishop pair (kept both bishops)
        if (gameStats.dailyStats.bishopsKept >= 2) {
          lifetimeStats.dailyStats.bishopPairWinsToday = (lifetimeStats.dailyStats.bishopPairWinsToday || 0) + 1;
        }
        
        // Knight fork (3+ forks)
        if (gameStats.dailyStats.knightForks >= 3) {
          lifetimeStats.dailyStats.knightForkGamesToday = (lifetimeStats.dailyStats.knightForkGamesToday || 0) + 1;
        }
        
        // Pawn storm (5+ pawns to 6th/3rd rank)
        if (gameStats.dailyStats.pawnsAdvancedToSixth && gameStats.dailyStats.pawnsAdvancedToSixth.length >= 5) {
          lifetimeStats.dailyStats.pawnStormGamesToday = (lifetimeStats.dailyStats.pawnStormGamesToday || 0) + 1;
        }
        
        // King walk (10+ king moves)
        if (gameStats.dailyStats.kingMoves >= 10) {
          lifetimeStats.dailyStats.kingWalkGamesToday = (lifetimeStats.dailyStats.kingWalkGamesToday || 0) + 1;
        }
        
        // Piece cycle (moved all 6 piece types)
        if (gameStats.dailyStats.pieceTypesMoved && gameStats.dailyStats.pieceTypesMoved.length >= 6) {
          lifetimeStats.dailyStats.pieceCycleGamesToday = (lifetimeStats.dailyStats.pieceCycleGamesToday || 0) + 1;
        }
        
        // Square master (visited all 8 e-file squares)
        if (gameStats.dailyStats.eFileSquaresVisited && gameStats.dailyStats.eFileSquaresVisited.length >= 8) {
          lifetimeStats.dailyStats.squareMasterGamesToday = (lifetimeStats.dailyStats.squareMasterGamesToday || 0) + 1;
        }
        
        // Sacrifice chain (3+ different pieces sacrificed)
        if (gameStats.dailyStats.piecesSacrificed && gameStats.dailyStats.piecesSacrificed.length >= 3) {
          lifetimeStats.dailyStats.sacrificeChainGamesToday = (lifetimeStats.dailyStats.sacrificeChainGamesToday || 0) + 1;
        }
        
        // Center control (occupied all 4 center squares)
        if (gameStats.dailyStats.centerSquaresOccupied && gameStats.dailyStats.centerSquaresOccupied.length >= 4) {
          lifetimeStats.dailyStats.centerControlGamesToday = (lifetimeStats.dailyStats.centerControlGamesToday || 0) + 1;
        }
        
        // Pawn island (3+ isolated islands)
        if (gameStats.dailyStats.pawnIslands >= 3) {
          lifetimeStats.dailyStats.pawnIslandGamesToday = (lifetimeStats.dailyStats.pawnIslandGamesToday || 0) + 1;
        }
        
        // Rook battery
        if (gameStats.dailyStats.rookBatteryCreated) {
          lifetimeStats.dailyStats.rookBatteryGamesToday = (lifetimeStats.dailyStats.rookBatteryGamesToday || 0) + 1;
        }
        
        // Pin master (4+ pins)
        if (gameStats.dailyStats.pinsCreated >= 4) {
          lifetimeStats.dailyStats.pinMasterGamesToday = (lifetimeStats.dailyStats.pinMasterGamesToday || 0) + 1;
        }
        
        // Skewer king (2+ skewers)
        if (gameStats.dailyStats.skewersCreated >= 2) {
          lifetimeStats.dailyStats.skewerKingGamesToday = (lifetimeStats.dailyStats.skewerKingGamesToday || 0) + 1;
        }
        
        // Discovered attack (3+ discovered attacks)
        if (gameStats.dailyStats.discoveredAttacks >= 3) {
          lifetimeStats.dailyStats.discoveredAttackGamesToday = (lifetimeStats.dailyStats.discoveredAttackGamesToday || 0) + 1;
        }
        
        // Windmill (5+ consecutive checks)
        if (gameStats.dailyStats.maxConsecutiveChecks >= 5) {
          lifetimeStats.dailyStats.windmillGamesToday = (lifetimeStats.dailyStats.windmillGamesToday || 0) + 1;
        }
        
        // Zwischenzug
        if (gameStats.dailyStats.zwischenzugMade) {
          lifetimeStats.dailyStats.zwischenzugGamesToday = (lifetimeStats.dailyStats.zwischenzugGamesToday || 0) + 1;
          lifetimeStats.creativeZwischenzugWins = (lifetimeStats.creativeZwischenzugWins || 0) + 1;
        }
        if (gameStats.dailyStats.promotionsInGame >= 3) {
          lifetimeStats.creativeTriplePromotionWins = (lifetimeStats.creativeTriplePromotionWins || 0) + 1;
        }
        if (gameStats.dailyStats.queenVisitedCorners && gameStats.dailyStats.queenVisitedCorners.length >= 4) {
          lifetimeStats.creativeQueenGrandTourWins = (lifetimeStats.creativeQueenGrandTourWins || 0) + 1;
        }
        if (gameStats.dailyStats.rooksOnSeventhRank >= 2) {
          lifetimeStats.creativeRookLadderWins = (lifetimeStats.creativeRookLadderWins || 0) + 1;
        }
        if (gameStats.dailyStats.kingMoves >= 10) {
          lifetimeStats.creativeKingMarathonWins = (lifetimeStats.creativeKingMarathonWins || 0) + 1;
        }
        if (gameStats.dailyStats.maxConsecutiveChecks >= 5) {
          lifetimeStats.creativeWindmillWins = (lifetimeStats.creativeWindmillWins || 0) + 1;
        }
        if (gameStats.dailyStats.piecesSacrificed && gameStats.dailyStats.piecesSacrificed.length >= 3) {
          lifetimeStats.creativeSacrificeSymphonyWins = (lifetimeStats.creativeSacrificeSymphonyWins || 0) + 1;
        }
        if (gameStats.dailyStats.pinsCreated >= 4) {
          lifetimeStats.creativePinGalleryWins = (lifetimeStats.creativePinGalleryWins || 0) + 1;
        }
        if (gameStats.dailyStats.knightForks >= 3) {
          lifetimeStats.creativeForkFeastWins = (lifetimeStats.creativeForkFeastWins || 0) + 1;
        }
        if (gameStats.dailyStats.centerSquaresOccupied && gameStats.dailyStats.centerSquaresOccupied.length >= 4) {
          lifetimeStats.creativeCenterDominationWins = (lifetimeStats.creativeCenterDominationWins || 0) + 1;
        }
        if (gameStats.dailyStats.pawnsAdvancedToSixth && gameStats.dailyStats.pawnsAdvancedToSixth.length >= 5) {
          lifetimeStats.creativePawnStormWins = (lifetimeStats.creativePawnStormWins || 0) + 1;
        }
        if (gameStats.dailyStats.pieceTypesMoved && gameStats.dailyStats.pieceTypesMoved.length >= 6) {
          lifetimeStats.creativeFullOrchestraWins = (lifetimeStats.creativeFullOrchestraWins || 0) + 1;
        }
        if (gameStats.dailyStats.eFileSquaresVisited && gameStats.dailyStats.eFileSquaresVisited.length >= 8) {
          lifetimeStats.creativeEFileOdysseyWins = (lifetimeStats.creativeEFileOdysseyWins || 0) + 1;
        }
        if (gameStats.dailyStats.discoveredAttacks >= 3) {
          lifetimeStats.creativeDiscoveryWins = (lifetimeStats.creativeDiscoveryWins || 0) + 1;
        }
        if (gameStats.dailyStats.skewersCreated >= 2) {
          lifetimeStats.creativeSkewerSalonWins = (lifetimeStats.creativeSkewerSalonWins || 0) + 1;
        }
        if (gameStats.dailyStats.rookBatteryCreated) {
          lifetimeStats.creativeRookBatteryWins = (lifetimeStats.creativeRookBatteryWins || 0) + 1;
        }
      }
      if (gameStats.lostQueens > 0) {
        lifetimeStats.creativeQueenDownWins = (lifetimeStats.creativeQueenDownWins || 0) + 1;
      }
      
      // Personality tracking removed
      
      // Track longest streak without losing pieces in one game today
      if (gameStats.dailyStats && gameStats.dailyStats.currentStreakNoPiecesLost) {
        const currentStreak = gameStats.dailyStats.currentStreakNoPiecesLost || 0;
        const longestStreak = lifetimeStats.dailyStats.longestStreakNoPiecesLostToday || 0;
        if (currentStreak > longestStreak) {
          lifetimeStats.dailyStats.longestStreakNoPiecesLostToday = currentStreak;
        }
      }
      
      // Track total games
      lifetimeStats.totalGamesPlayed = (lifetimeStats.totalGamesPlayed || 0) + 1;
      
      saveLifetimeStats();
    }
    
    function trackLossStats() {
      // Reset win streak on loss
      lifetimeStats.currentWinStreak = 0;
      saveLifetimeStats();
    }
    
    function commitGameStatsToLifetime() {
      // Commit all gameStats to lifetimeStats
      resetDailyStatsIfNeeded();
      Object.keys(gameStats).forEach(key => {
        if (key === 'dailyStats') {
          // Handle daily stats separately
          lifetimeStats.dailyStats.movesMadeToday += gameStats.dailyStats.movesMadeToday || 0;
          lifetimeStats.dailyStats.capturesToday += gameStats.dailyStats.capturesToday || 0;
          lifetimeStats.dailyStats.checksGivenToday += gameStats.dailyStats.checksGivenToday || 0;
          lifetimeStats.dailyStats.promotionsToday += gameStats.dailyStats.promotionsToday || 0;
          lifetimeStats.dailyStats.castlingToday += gameStats.dailyStats.castlingToday || 0;
          lifetimeStats.dailyStats.bishopMovesInBlindfoldToday += gameStats.dailyStats.bishopMovesInBlindfoldToday || 0;
          lifetimeStats.dailyStats.knightMovesInPureBlindfoldToday += gameStats.dailyStats.knightMovesInPureBlindfoldToday || 0;
          lifetimeStats.dailyStats.kingMovesToday = (lifetimeStats.dailyStats.kingMovesToday || 0) + (gameStats.dailyStats.kingMoves || 0);
          lifetimeStats.dailyStats.pawnMovesToday = (lifetimeStats.dailyStats.pawnMovesToday || 0) + (gameStats.dailyStats.pawnMovesToday || 0);
          lifetimeStats.dailyStats.underpromotionMovesToday = (lifetimeStats.dailyStats.underpromotionMovesToday || 0) + (gameStats.dailyStats.underpromotionMovesToday || 0);
          if (!lifetimeStats.dailyStats.playerCapturesByTypeToday) {
            lifetimeStats.dailyStats.playerCapturesByTypeToday = { p: 0, n: 0, b: 0, r: 0, q: 0 };
          }
          const pct = gameStats.dailyStats.playerCapturesByType || { p: 0, n: 0, b: 0, r: 0, q: 0 };
          ['p', 'n', 'b', 'r', 'q'].forEach(k => {
            lifetimeStats.dailyStats.playerCapturesByTypeToday[k] =
              (lifetimeStats.dailyStats.playerCapturesByTypeToday[k] || 0) + (pct[k] || 0);
          });
          if (gameStats.dailyStats.uniqueSquaresVisitedToday) {
            gameStats.dailyStats.uniqueSquaresVisitedToday.forEach(square => {
              if (!lifetimeStats.dailyStats.uniqueSquaresVisitedToday.includes(square)) {
                lifetimeStats.dailyStats.uniqueSquaresVisitedToday.push(square);
              }
            });
          }
        } else if (typeof gameStats[key] === 'number') {
          if (key === 'lostQueens' || key === 'lostRooks' || key === 'lostBishops' || key === 'lostKnights' || key === 'lostPawns') {
            return;
          }
          lifetimeStats[key] = (lifetimeStats[key] || 0) + gameStats[key];
          // Note: promotionsToday and castlingToday are already tracked per-move in gameStats.dailyStats
          // They will be added separately below, so we don't double-count here
        }
      });
      
      // Track games where we castled/promoted (once per game, not per move)
      if (gameStats.castlingMoves > 0 && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.gamesCastledToday = (lifetimeStats.dailyStats.gamesCastledToday || 0) + 1;
      }
      if (gameStats.promotions > 0 && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.gamesPromotedToday = (lifetimeStats.dailyStats.gamesPromotedToday || 0) + 1;
      }
      
      // Track games with en passant
      if (gameStats.dailyStats && gameStats.dailyStats.hasEnPassant && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.gamesWithEnPassantToday = (lifetimeStats.dailyStats.gamesWithEnPassantToday || 0) + 1;
      }
      
      // Track underpromotions
      if (gameStats.dailyStats && gameStats.dailyStats.hasUnderpromotion && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.underpromotionsToday = (lifetimeStats.dailyStats.underpromotionsToday || 0) + 1;
      }
      
      // Daily comeback tally: only wins; net exchange down 5+ (same rule as lifetime comebackWins in trackWinStats)
      const materialWeLostDaily = (gameStats.lostQueens || 0) * 9 + (gameStats.lostRooks || 0) * 5 +
        (gameStats.lostBishops || 0) * 3 + (gameStats.lostKnights || 0) * 3 + (gameStats.lostPawns || 0);
      const materialWeCapturedDaily = (gameStats.capturedQueens || 0) * 9 + (gameStats.capturedRooks || 0) * 5 +
        (gameStats.capturedBishops || 0) * 3 + (gameStats.capturedKnights || 0) * 3 + (gameStats.capturedPawns || 0);
      if (gameStats._isWinGameEnd && materialWeLostDaily - materialWeCapturedDaily >= 5 && lifetimeStats.dailyStats) {
        lifetimeStats.dailyStats.comebackWinsToday = (lifetimeStats.dailyStats.comebackWinsToday || 0) + 1;
      }
      
      saveLifetimeStats();
      // Reset gameStats after committing
      resetGameStats();
    }
    let lifetimeStats = { // Lifetime statistics
      // Captures delivered by your moving piece (by type); not the type of enemy piece taken
      capturesByQueen: 0,
      capturesByRook: 0,
      capturesByBishop: 0,
      capturesByKnight: 0,
      capturesByPawn: 0,
      totalCaptures: 0,
      checksGiven: 0,
      castlingMoves: 0,
      promotions: 0,
      enPassants: 0,
      longestGame: 0,
      shortestWin: Infinity,
      // Enemy piece types taken off the board (victim); not which of your pieces captured them
      capturedQueens: 0,
      capturedRooks: 0,
      capturedBishops: 0,
      capturedKnights: 0,
      capturedPawns: 0,
      // Random achievement tracking
      movesToE4: 0,
      movesToD4: 0,
      movesToE5: 0,
      movesToD5: 0,
      knightToF3: 0,
      knightToC3: 0,
      knightToF6: 0,
      knightToC6: 0,
      movesOnMove1: 0,
      movesOnMove5: 0,
      movesOnMove10: 0,
      movesOnMove20: 0,
      movesOnMove50: 0,
      pawnToE4: 0,
      pawnToD4: 0,
      queenToD4: 0,
      queenToE4: 0,
      bishopToF4: 0,
      rookToE1: 0,
      kingToE1: 0,
      consecutiveSamePiece: 0,
      castledOnMove10: 0,
      castledOnMove20: 0,
      promotedToQueen: 0,
      promotedToRook: 0,
      promotedToBishop: 0,
      promotedToKnight: 0,
      checkOnMove5: 0,
      captureOnMove10: 0,
      // Additional tracking for varied requirements
      movesToE4Multiple: 0,
      movesToD4Multiple: 0,
      knightToF3Multiple: 0,
      knightToC3Multiple: 0,
      queenToD4Multiple: 0,
      promotedToQueenMultiple: 0,
      // Random piece-to-square tracking
      rookToA1: 0, rookToH1: 0, rookToA8: 0, rookToH8: 0,
      bishopToC1: 0, bishopToF1: 0, bishopToC8: 0, bishopToF8: 0,
      knightToG1: 0, knightToB1: 0, knightToG8: 0, knightToB8: 0,
      queenToA1: 0, queenToH1: 0, queenToA8: 0, queenToH8: 0,
      kingToG1: 0, kingToC1: 0, kingToG8: 0, kingToC8: 0,
      pawnToA2: 0, pawnToH2: 0, pawnToA7: 0, pawnToH7: 0,
      // Daily achievement tracking
      dailyStats: {
        lastResetDate: null,
        gamesPlayedToday: 0,
        gamesWonToday: 0,
        movesMadeToday: 0,
        capturesToday: 0,
        checksGivenToday: 0,
        uniqueSquaresVisitedToday: [],
        longestGameToday: 0,
        fastestWinToday: Infinity,
        promotionsToday: 0,
        castlingToday: 0,
        todayDailyIds: [],
        // New daily challenge tracking
        bishopMovesInBlindfoldToday: 0,
        // Personality tracking removed
        longestStreakNoPiecesLostToday: 0 // Longest streak of moves without losing pieces in one game today
      },
      // Wins by time control
      winsByTimeControl: {
        none: 0,
        '60': 0,
        '180|2': 0,
        '300|0': 0,
        '600|0': 0,
        '900|5': 0,
        '3600|0': 0
      },
      // Wins by engine personality
      winsByPersonality: {
        balanced: 0,
        aggressive: 0,
        defensive: 0,
        positional: 0,
        material: 0,
        tactical: 0,
        custom: 0
      },
      // Creative achievement tracking
      winsInUnder10Moves: 0,
      winsInUnder20Moves: 0,
      winsInOver100Moves: 0,
      perfectGames: 0, // Games won without losing any pieces
      comebackWins: 0, // Games won after being down material
      timePressureWins: 0,
      winsInUnder15Moves: 0,
      creativeZwischenzugWins: 0,
      creativeTriplePromotionWins: 0,
      creativeQueenGrandTourWins: 0,
      creativeRookLadderWins: 0,
      creativeKingMarathonWins: 0,
      creativeWindmillWins: 0,
      creativeSacrificeSymphonyWins: 0,
      creativePinGalleryWins: 0,
      creativeForkFeastWins: 0,
      creativeCenterDominationWins: 0,
      creativePawnStormWins: 0,
      creativeFullOrchestraWins: 0,
      creativeEFileOdysseyWins: 0,
      creativeDiscoveryWins: 0,
      creativeSkewerSalonWins: 0,
      creativeRookBatteryWins: 0,
      creativeQueenDownWins: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      // Blindfold achievement tracking
      blindfoldWins: 0, // Total wins in blindfold mode (with or without history)
      blindfoldWinsNoHistory: 0 // Wins in blindfold mode without move history
    };

    // Engine personality presets removed for performance

    // Piece style themes
    const pieceThemes = {
      classic: 'lib/img/chesspieces/wikipedia/{piece}.png',
      alpha: 'https://lichess1.org/assets/piece/alpha/{piece}.svg',
      cburnett: 'https://lichess1.org/assets/piece/cburnett/{piece}.svg',
      merida: 'https://lichess1.org/assets/piece/merida/{piece}.svg',
      pirouetti: 'https://lichess1.org/assets/piece/pirouetti/{piece}.svg',
      spatial: 'https://lichess1.org/assets/piece/spatial/{piece}.svg',
      california: 'https://lichess1.org/assets/piece/california/{piece}.svg',
      cardinal: 'https://lichess1.org/assets/piece/cardinal/{piece}.svg',
      chessnut: 'https://lichess1.org/assets/piece/chessnut/{piece}.svg',
      chess7: 'https://lichess1.org/assets/piece/chess7/{piece}.svg',
      reillycraig: 'https://lichess1.org/assets/piece/reillycraig/{piece}.svg',
      riohacha: 'https://lichess1.org/assets/piece/riohacha/{piece}.svg',
      shapes: 'https://lichess1.org/assets/piece/shapes/{piece}.svg',
      staunty: 'https://lichess1.org/assets/piece/staunty/{piece}.svg',
      tatiana: 'https://lichess1.org/assets/piece/tatiana/{piece}.svg'
    };

    /** Same URLs as the board / captured pieces (e.g. wQ, bN). */
    function getPieceImageUrl(pieceCode) {
      const tpl = pieceThemes[currentPieceStyle] || pieceThemes.classic;
      return tpl.replace('{piece}', pieceCode);
    }

    // Opening Book Database
    const openingBook = {
      "e4": "King's Pawn Opening",
      "e4 e5": "Open Game",
      "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez (Spanish Opening)",
      "e4 e5 Nf3 Nc6 Bb5 a6": "Ruy Lopez: Morphy Defense",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O": "Ruy Lopez: Closed Variation",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7": "Ruy Lopez: Closed, Chigorin Defense",
      "e4 e5 Nf3 Nc6 Bb5 Nf6": "Ruy Lopez: Berlin Defense",
      "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
      "e4 e5 Nf3 Nc6 Bc4 Bc5": "Italian Game: Giuoco Piano",
      "e4 e5 Nf3 Nc6 Bc4 Bc5 c3": "Italian Game: Giuoco Pianissimo",
      "e4 e5 Nf3 Nc6 Bc4 Bc5 b4": "Italian Game: Evans Gambit",
      "e4 e5 Nf3 Nc6 Bc4 Nf6": "Italian Game: Two Knights Defense",
      "e4 e5 Nf3 Nf6": "Petrov's Defense (Russian Game)",
      "e4 c5": "Sicilian Defense",
      "e4 c5 Nf3 d6": "Sicilian Defense: Open Variation",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6": "Sicilian Defense: Najdorf Variation",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6": "Sicilian Defense: Dragon Variation",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6": "Sicilian Defense: Scheveningen Variation",
      "e4 c5 Nf3 Nc6": "Sicilian Defense: Closed Variation",
      "e4 c5 Nf3 e6": "Sicilian Defense: French Variation",
      "e4 c5 c3": "Sicilian Defense: Alapin Variation",
      "e4 e6": "French Defense",
      "e4 e6 d4 d5": "French Defense: Main Line",
      "e4 e6 d4 d5 Nc3": "French Defense: Classical Variation",
      "e4 e6 d4 d5 Nd2": "French Defense: Tarrasch Variation",
      "e4 e6 d4 d5 exd5": "French Defense: Exchange Variation",
      "e4 c6": "Caro-Kann Defense",
      "e4 c6 d4 d5": "Caro-Kann Defense: Main Line",
      "e4 c6 d4 d5 Nc3": "Caro-Kann Defense: Classical Variation",
      "e4 c6 d4 d5 exd5": "Caro-Kann Defense: Exchange Variation",
      "e4 d5": "Scandinavian Defense (Center Counter)",
      "e4 d5 exd5 Qxd5": "Scandinavian Defense: Main Line",
      "e4 d5 exd5 Nf6": "Scandinavian Defense: Modern Variation",
      "d4": "Queen's Pawn Opening",
      "d4 d5": "Closed Game",
      "d4 d5 c4": "Queen's Gambit",
      "d4 d5 c4 e6": "Queen's Gambit Declined",
      "d4 d5 c4 e6 Nc3 Nf6": "Queen's Gambit Declined: Orthodox Variation",
      "d4 d5 c4 e6 Nc3 Nf6 Bg5": "Queen's Gambit Declined: Classical Variation",
      "d4 d5 c4 c6": "Slav Defense",
      "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4": "Slav Defense: Accepted Variation",
      "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6": "Semi-Slav Defense",
      "d4 d5 c4 dxc4": "Queen's Gambit Accepted",
      "d4 Nf6 c4 g6": "King's Indian Defense",
      "d4 Nf6 c4 g6 Nc3 Bg7": "King's Indian Defense: Main Line",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4": "King's Indian Defense: Classical Variation",
      "d4 Nf6 c4 e6": "Indian Defense",
      "d4 Nf6 c4 e6 Nc3 Bb4": "Nimzo-Indian Defense",
      "d4 Nf6 c4 e6 Nc3 Bb4 Qc2": "Nimzo-Indian Defense: Classical Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 e3": "Nimzo-Indian Defense: Rubinstein Variation",
      "d4 Nf6 c4 e6 Nf3 b6": "Queen's Indian Defense",
      "d4 Nf6 Nf3 g6": "King's Indian Attack",
      "d4 Nf6 Nf3 e6": "Indian Game",
      "d4 Nf6 c4 c5 d5": "Benoni Defense: Modern Benoni",
      "d4 Nf6 c4 c5 d5 e6": "Benoni Defense: Modern Variation",
      "Nf3": "Réti Opening",
      "Nf3 d5 c4": "Réti Opening: Anglo-Slav Variation",
      "Nf3 Nf6 c4 g6": "Réti Opening: King's Indian Attack",
      "c4": "English Opening",
      "c4 e5": "English Opening: Reversed Sicilian",
      "c4 Nf6": "English Opening: Anglo-Indian Defense",
      "c4 c5": "English Opening: Symmetrical Variation",
      "e4 e5 Nf3 Nc6 d4": "Scotch Game",
      "e4 e5 Nf3 Nc6 d4 exd4 Nxd4": "Scotch Game: Main Line",
      "e4 e5 Nf3 Nc6 Nc3": "Four Knights Game",
      "e4 e5 Nf3 Nc6 Nc3 Nf6": "Four Knights Game: Spanish Variation",
      "e4 e5 f4": "King's Gambit",
      "e4 e5 f4 exf4": "King's Gambit Accepted",
      "e4 e5 f4 Bc5": "King's Gambit Declined: Classical Defense",
      "d4 Nf6 Bg5": "Trompowsky Attack",
      "d4 Nf6 Bg5 Ne4": "Trompowsky Attack: Main Line",
      "d4 d5 Nf3": "London System",
      "d4 d5 Nf3 Nf6 Bf4": "London System: Main Line",
      "e4 g6": "Modern Defense",
      "e4 g6 d4 Bg7": "Modern Defense: Gurgenidze System",
      "e4 g6 d4 Bg7 Nc3 d6": "Modern Defense: Pseudo-Austrian Attack",
      "e4 Nc6": "Nimzowitsch Defense",
      "e4 Nc6 d4 e5": "Nimzowitsch Defense: Scandinavian Variation",
      "d4 f5": "Dutch Defense",
      "d4 f5 g3": "Dutch Defense: Leningrad Variation",
      "d4 f5 Nf3 Nf6 g3 g6 Bg2 Bg7": "Dutch Defense: Leningrad System",
      "d4 f5 c4 Nf6": "Dutch Defense: Classical Variation",
      "d4 f5 e4": "Dutch Defense: Staunton Gambit",
      "f4": "Bird's Opening",
      "f4 d5": "Bird's Opening: From's Gambit",
      "f4 e5": "Bird's Opening: From Gambit",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6": "Ruy Lopez: Open Defense",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4": "Ruy Lopez: Open Variation",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6": "Ruy Lopez: Closed, Zaitsev Variation",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O": "Ruy Lopez: Closed, Breyer Variation",
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Nxe4 d4": "Ruy Lopez: Open, Howell Attack",
      "e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3": "Italian Game: Evans Gambit Accepted",
      "e4 e5 Nf3 Nc6 Bc4 Nf6 d4": "Italian Game: Two Knights Defense, Max Lange Attack",
      "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5": "Italian Game: Two Knights Defense, Fried Liver Attack",
      "e4 e5 Nf3 Nf6 Nxe5": "Petrov's Defense: Steinitz Attack",
      "e4 e5 Nf3 Nf6 Nxe5 d6": "Petrov's Defense: Classical Variation",
      "e4 e5 Nf3 Nf6 d4": "Petrov's Defense: Three Knights Game",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3": "Sicilian Defense: Najdorf, English Attack",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be2": "Sicilian Defense: Najdorf, Classical Variation",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7": "Sicilian Defense: Dragon, Yugoslav Attack",
      "e4 c5 Nf3 e6 d4 cxd4 Nxd4 a6": "Sicilian Defense: Kan Variation",
      "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6": "Sicilian Defense: Taimanov Variation",
      "e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7": "Sicilian Defense: Taimanov, English Attack",
      "e4 c5 Nf3 e6 c3": "Sicilian Defense: Smith-Morra Gambit",
      "e4 c5 Nf3 e6 c3 d5": "Sicilian Defense: Smith-Morra Gambit Declined",
      "e4 c5 c3 Nf6": "Sicilian Defense: Alapin, Barmen Variation",
      "e4 c5 c3 d5": "Sicilian Defense: Alapin, Normal Variation",
      "e4 e6 d4 d5 Nc3 Bb4": "French Defense: Winawer Variation",
      "e4 e6 d4 d5 Nc3 Bb4 e5": "French Defense: Winawer, Advance Variation",
      "e4 e6 d4 d5 Nc3 Bb4 e5 c5": "French Defense: Winawer, Poisoned Pawn",
      "e4 e6 d4 d5 Nc3 Nf6": "French Defense: Alekhine-Chatard Attack",
      "e4 e6 d4 d5 Nd2 c5": "French Defense: Tarrasch, Guimard Variation",
      "e4 e6 d4 d5 Nd2 Nf6": "French Defense: Tarrasch, Leningrad Variation",
      "e4 e6 d4 d5 exd5 exd5": "French Defense: Exchange, Classical Variation",
      "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5": "Caro-Kann Defense: Classical Variation",
      "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7": "Caro-Kann Defense: Karpov Variation",
      "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6": "Caro-Kann Defense: Classical, Main Line",
      "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Nd7 Nf3 Ngf6": "Caro-Kann Defense: Karpov, Main Line",
      "e4 d5 exd5 Nf6 c4 e6": "Scandinavian Defense: Modern, Main Line",
      "e4 d5 exd5 Qxd5 Nc3 Qa5": "Scandinavian Defense: Main Line, Gubinsky-Melts Defense",
      "e4 d5 exd5 Qxd5 Nc3 Qd6": "Scandinavian Defense: Main Line, Modern Variation",
      "d4 d5 c4 e6 Nf3": "Queen's Gambit Declined: Orthodox",
      "d4 d5 c4 e6 Nf3 Nf6": "Queen's Gambit Declined: Orthodox, Main Line",
      "d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7": "Queen's Gambit Declined: Orthodox, Classical",
      "d4 d5 c4 e6 Nf3 Nf6 Nc3 Be7 Bg5": "Queen's Gambit Declined: Orthodox, Tartakower Variation",
      "d4 d5 c4 e6 Nf3 Nf6 cxd5": "Queen's Gambit Declined: Exchange Variation",
      "d4 d5 c4 c6 Nf3 Nf6 e3": "Slav Defense: Quiet Variation",
      "d4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4": "Slav Defense: Alekhine Variation",
      "d4 d5 c4 c6 Nf3 Nf6 e3 Bf5": "Slav Defense: Modern Variation",
      "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 Bg5": "Semi-Slav Defense: Botvinnik Variation",
      "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3": "Semi-Slav Defense: Meran Variation",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6": "King's Indian Defense: Classical, Main Line",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5": "King's Indian Defense: Classical, Petrosian System",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f3": "King's Indian Defense: Sämisch Variation",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 f4": "King's Indian Defense: Four Pawns Attack",
      "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nge2": "King's Indian Defense: Averbakh Variation",
      "d4 Nf6 c4 g6 Nf3 Bg7": "King's Indian Defense: Fianchetto Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 a3": "Nimzo-Indian Defense: Samisch Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 Nf3": "Nimzo-Indian Defense: Classical, Ragozin Defense",
      "d4 Nf6 c4 e6 Nc3 Bb4 Nf3 c5": "Nimzo-Indian Defense: Classical, Hübner Variation",
      "d4 Nf6 c4 e6 Nf3 b6 g3": "Queen's Indian Defense: Fianchetto Variation",
      "d4 Nf6 c4 e6 Nf3 b6 a3": "Queen's Indian Defense: Petrosian Variation",
      "d4 Nf6 c4 e6 Nf3 b6 Nc3": "Queen's Indian Defense: Classical Variation",
      "d4 Nf6 c4 c5 d5 b5": "Benoni Defense: Modern, Benko Gambit",
      "d4 Nf6 c4 c5 d5 b5 cxb5 a6": "Benoni Defense: Modern, Benko Gambit Accepted",
      "d4 Nf6 c4 c5 d5 e5": "Benoni Defense: Czech Benoni",
      "Nf3 d5 d4": "Réti Opening: Slav System",
      "Nf3 d5 c4 d4": "Réti Opening: Slav, Alapin Variation",
      "Nf3 Nf6 c4 c5": "Réti Opening: Symmetrical Variation",
      "Nf3 Nf6 c4 e6": "Réti Opening: English Defense",
      "c4 e5 Nc3": "English Opening: Reversed Dragon",
      "c4 e5 Nc3 Nf6": "English Opening: Reversed Dragon, Yugoslav Attack",
      "c4 Nf6 Nc3 e5": "English Opening: Symmetrical, Botvinnik System",
      "c4 c5 Nf3": "English Opening: Symmetrical, Hedgehog System",
      "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6": "Scotch Game: Schmidt Variation",
      "e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5": "Scotch Game: Classical Variation",
      "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5": "Four Knights Game: Spanish Variation",
      "e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Nd4": "Four Knights Game: Spanish, Rubinstein Variation",
      "e4 e5 Nf3 Nc6 Nc3 Nf6 d4": "Four Knights Game: Scotch Variation",
      "e4 e5 Nc3": "Vienna Game",
      "e4 e5 Nc3 Nf6": "Vienna Game: Falkbeer Variation",
      "e4 e5 Nc3 Nf6 f4": "Vienna Game: Gambit",
      "e4 e5 Nc3 Bc5": "Vienna Game: Frankenstein-Dracula Variation",
      "e4 e5 Bc4": "Bishop's Opening",
      "e4 e5 Bc4 Nf6": "Bishop's Opening: Berlin Defense",
      "e4 e5 Bc4 Nc6": "Bishop's Opening: Classical Defense",
      "e4 e5 Nf3 Nc6 Bc4 Bc5 d3": "Italian Game: Giuoco Pianissimo, Main Line",
      "e4 e5 Nf3 Nc6 Bc4 Bc5 O-O": "Italian Game: Giuoco Pianissimo, Modern Variation",
      "e4 e5 f4 exf4 Nf3": "King's Gambit: Accepted, Modern Defense",
      "e4 e5 f4 exf4 Nf3 g5": "King's Gambit: Accepted, Classical Defense",
      "e4 e5 f4 exf4 Nf3 g5 h4": "King's Gambit: Accepted, Allgaier Gambit",
      "e4 e5 f4 exf4 Nc3": "King's Gambit: Accepted, Quade Gambit",
      "e4 e5 f4 Bc5": "King's Gambit: Declined, Classical Defense",
      "e4 e5 f4 d5": "King's Gambit: Declined, Falkbeer Countergambit",
      "d4 d5 Nf3 Nf6 Bf4": "London System: Main Line",
      "d4 d5 Nf3 Nf6 Bf4 c5": "London System: Normal Variation",
      "d4 d5 Nf3 Nf6 Bf4 Bf5": "London System: Symmetrical Variation",
      "d4 Nf6 Bg5 c5": "Trompowsky Attack: Classical Defense",
      "d4 Nf6 Bg5 Ne4 Bf4": "Trompowsky Attack: Raptor Variation",
      "d4 Nf6 Bg5 e6": "Trompowsky Attack: French Variation",
      "d4 Nf6 Nf3 e6 c4": "Indian Defense: Nimzowitsch Variation",
      "d4 Nf6 Nf3 e6 c4 Bb4+": "Indian Defense: Bogo-Indian Defense",
      "d4 Nf6 Nf3 e6 c4 Bb4+ Bd2": "Bogo-Indian Defense: Modern Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 Qb3": "Nimzo-Indian Defense: Spielmann Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 e3 O-O": "Nimzo-Indian Defense: Capablanca Variation",
      "d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+": "Nimzo-Indian Defense: Samisch, Main Line",
      "d4 Nf6 c4 e6 Nc3 Bb4 a3 Bxc3+ bxc3": "Nimzo-Indian Defense: Samisch, Orthodox",
      "e4 e5 Nf3 Nc6 d3": "King's Pawn Opening: Réti System",
      "e4 e5 Nf3 Nc6 Be2": "King's Pawn Opening: Modern Variation",
      "e4 e5 Nf3 Nc6 g3": "King's Pawn Opening: Konstantinopolsky Variation",
      "e4 e5 Nf3 Nc6 c3": "King's Pawn Opening: Ponziani Opening",
      "e4 e5 Nf3 Nc6 c3 d5": "Ponziani Opening: Steinitz Variation",
      "d4 d5 c4 c5": "Queen's Gambit: Slav, Marshall Gambit",
      "d4 d5 c4 e5": "Queen's Gambit: Albin Countergambit",
      "d4 d5 c4 e5 dxe5 d4": "Queen's Gambit: Albin Countergambit Accepted",
      "d4 d5 Nf3": "Queen's Pawn Opening: Zukertort Opening",
      "d4 Nf6": "Indian Game: Wade-Tartakower Defense",
      "Nf3 d5": "Zukertort Opening: Dutch Variation",
      "Nf3 d5 c4": "Réti Opening: Anglo-Slav, Main Line",
      "Nf3 d5 g3": "Réti Opening: Fianchetto Variation",
      "b4": "Sokolsky Opening (Orangutan)",
      "b4 e5": "Sokolsky Opening: Outflank Variation",
      "b4 c6": "Sokolsky Opening: Outflank Defense",
      "g4": "Grob Opening",
      "g4 d5": "Grob Opening: Spike Attack",
      "Nc3": "Dunst Opening",
      "Nc3 d5": "Dunst Opening: Normal Defense",
      "Nc3 e5": "Dunst Opening: Sicilian Variation",
      "e3": "Van't Kruijs Opening",
      "e3 d5": "Van't Kruijs Opening: Normal Defense",
      "d3": "Mieses Opening",
      "d3 d5": "Mieses Opening: Reversed Philidor",
      "a4": "Ware Opening",
      "a4 e5": "Ware Opening: Crab Variation",
      "h4": "Kadas Opening",
      "h4 e5": "Kadas Opening: Normal Defense",
      "Na3": "Durkin Opening",
      "f3": "Barnes Opening",
      "f3 e5": "Barnes Opening: Gedult Attack",
      "Nh3": "Amar Opening",
      "b3": "Larsen Opening",
      "b3 e5": "Larsen Opening: Classical Variation",
      "g3": "Benko Opening",
      "g3 d5": "Benko Opening: Reversed Alekhine",
      "c3": "Saragossa Opening",
      "c3 e5": "Saragossa Opening: Normal Variation",
      "b3": "Larsen's Opening (Queen's Fianchetto)"
    };

    // --- Engine occupancy helpers ---
    const ENGINE_BASE = 'https://hedgehoglover23.pythonanywhere.com';
    /** Set in this tab after /start; used with pagehide skip rules so unrelated tabs do not POST /stop. */
    const ENGINE_LOCK_SESSION_KEY = 'trifangx_engine_lock_holder';
    /** Server-issued UUID for this tab's TrifangX session (multi-game API). */
    const ENGINE_GAME_ID_KEY = 'trifangx_engine_game_id';
    /** Persisted mid-game state so reload can resume without /stop (used on `trifangx_live.html` or ?txlive=1). */
    const TRIFANGX_LIVE_SNAPSHOT_KEY = 'trifangx_live_snapshot';
    /** URL flag for an in-progress engine game (legacy; primary flow uses `trifangx_live.html`). */
    const TRIFANGX_LIVE_URL_PARAM = 'txlive';
    /** Set only immediately before `location.replace(trifangx_live.html)` so lobby pagehide does not /stop mid-handoff. */
    const TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY = 'trifangx_live_handoff_pending';

    function getEngineGameId() {
      try {
        return sessionStorage.getItem(ENGINE_GAME_ID_KEY) || '';
      } catch (e) {
        return '';
      }
    }

    function setEngineGameId(id) {
      try {
        if (id) sessionStorage.setItem(ENGINE_GAME_ID_KEY, String(id));
      } catch (e) {}
    }

    function clearEngineGameId() {
      try {
        sessionStorage.removeItem(ENGINE_GAME_ID_KEY);
      } catch (e) {}
    }

    function markEngineLockHeldByThisTab() {
      try {
        sessionStorage.setItem(ENGINE_LOCK_SESSION_KEY, '1');
      } catch (e) {}
    }

    function clearEngineLockHolderSession() {
      try {
        sessionStorage.removeItem(ENGINE_LOCK_SESSION_KEY);
      } catch (e) {}
    }

    function clearEngineTabSession() {
      clearEngineLockHolderSession();
      clearEngineGameId();
    }

    let _heartbeatInterval = null;

    let _statusPollInterval = null;
    /** Last successful /status occupied value — kept on fetch errors so the waiting-room “board lock” does not flicker off between polls. */
    let _lastStatusOccupied = false;
    /** Last successful active_games / max_games from /status (for display when a poll fails). */
    let _lastActiveGames = null;
    let _lastMaxGames = null;
    let _pregameStatusPollInterval = null;

    function updateEngineCapacityDisplay(active, max) {
      const valEl = document.getElementById('engine-capacity-value');
      const row = document.getElementById('engine-capacity-row');
      if (!valEl) return;
      const a = active == null ? NaN : Number(active);
      const m = max == null ? NaN : Number(max);
      if (!Number.isFinite(a) || !Number.isFinite(m) || m < 1) {
        valEl.textContent = '…';
        if (row) row.title = 'Waiting for server status…';
        return;
      }
      valEl.textContent = a + ' / ' + m;
      if (row) {
        row.title = a >= m ? 'All slots in use — Start Game is disabled until a slot frees up.' : '';
      }
    }

    function applyEngineOccupancyWaitingRoomUi(busy) {
      const btn = document.getElementById('start-game-btn');
      const banner = document.getElementById('engine-busy-banner');
      if (btn) btn.disabled = busy;
      if (banner) banner.style.display = busy ? 'block' : 'none';
      // While busy, auto-poll every 15 s so the banner disappears without a manual refresh.
      if (busy && !_statusPollInterval) {
        _statusPollInterval = setInterval(() => {
          checkEngineStatus().then(stillBusy => {
            if (!stillBusy) {
              clearInterval(_statusPollInterval);
              _statusPollInterval = null;
            }
          });
        }, 15000);
      } else if (!busy && _statusPollInterval) {
        clearInterval(_statusPollInterval);
        _statusPollInterval = null;
      }
    }

    function stopPregameStatusPolling() {
      if (_pregameStatusPollInterval) {
        clearInterval(_pregameStatusPollInterval);
        _pregameStatusPollInterval = null;
      }
    }

    /** While logged in and the side-chooser is visible, poll /status so the lock stays accurate even on your turn / long thinks. */
    function ensurePregameStatusPolling() {
      if (_pregameStatusPollInterval) return;
      _pregameStatusPollInterval = setInterval(() => {
        if (typeof isChessPregamePhase === 'function' && isChessPregamePhase()) {
          checkEngineStatus();
        } else {
          stopPregameStatusPolling();
        }
      }, 8000);
    }

    function checkEngineStatus() {
      return fetch(`${ENGINE_BASE}/status`)
        .then(r => r.json())
        .then(data => {
          const occ = data && data.occupied;
          const busy = occ === true || occ === 'true' || occ === 1;
          _lastStatusOccupied = busy;
          const ag = data && data.active_games;
          const mg = data && data.max_games;
          const aN = ag == null ? NaN : Number(ag);
          const mN = mg == null ? NaN : Number(mg);
          if (Number.isFinite(aN) && Number.isFinite(mN) && mN >= 1) {
            _lastActiveGames = aN;
            _lastMaxGames = mN;
            updateEngineCapacityDisplay(aN, mN);
          } else if (_lastActiveGames != null && _lastMaxGames != null) {
            updateEngineCapacityDisplay(_lastActiveGames, _lastMaxGames);
          }
          applyEngineOccupancyWaitingRoomUi(busy);
          if (typeof ensurePregameStatusPolling === 'function' && typeof isChessPregamePhase === 'function' && isChessPregamePhase()) {
            ensurePregameStatusPolling();
          }
          return busy;
        })
        .catch(() => {
          if (_lastActiveGames != null && _lastMaxGames != null) {
            updateEngineCapacityDisplay(_lastActiveGames, _lastMaxGames);
          } else {
            updateEngineCapacityDisplay(null, null);
          }
          applyEngineOccupancyWaitingRoomUi(_lastStatusOccupied);
          return _lastStatusOccupied;
        });
    }

    function startHeartbeat() {
      stopHeartbeat();
      _heartbeatInterval = setInterval(() => {
        const gid = getEngineGameId();
        if (!gid) return;
        fetch(`${ENGINE_BASE}/heartbeat`, { method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_id: gid }) })
          .catch(() => {}); // silent — just keeps the lock alive
      }, 30000);
    }

    function stopHeartbeat() {
      if (_heartbeatInterval) {
        clearInterval(_heartbeatInterval);
        _heartbeatInterval = null;
      }
    }

    /**
     * Reload / close tab / navigate away: only THIS tab may release the lock (it called /start).
     * Other users reloading the site must not POST /stop — that was freeing the engine for everyone.
     */
    function releaseEngineOccupancyOnPageExit() {
      try {
        stopHeartbeat();
        stopPregameStatusPolling();
        if (_statusPollInterval) {
          clearInterval(_statusPollInterval);
          _statusPollInterval = null;
        }
      } catch (e) {}
      let isLockHolder = false;
      try {
        isLockHolder = sessionStorage.getItem(ENGINE_LOCK_SESSION_KEY) === '1';
      } catch (e) {
        isLockHolder = false;
      }
      if (!isLockHolder) {
        return;
      }
      const gid = getEngineGameId();
      const url = ENGINE_BASE + '/stop';
      const body = JSON.stringify(gid ? { game_id: gid } : {});
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body,
          keepalive: true
        }).catch(function () {});
      } catch (e2) {}
      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
        }
      } catch (e3) {}
      clearEngineTabSession();
      clearTrifangxLiveUrlAndSnapshot();
    }

    function isTrifangxLiveDedicatedPage() {
      try {
        if (typeof window !== 'undefined' && window.TRIFANGX_PAGE_MODE === 'live') {
          return true;
        }
      } catch (e0) {}
      try {
        const p = (window.location.pathname || '').toLowerCase();
        return /(^|\/)trifangx_live\.html$/.test(p) || p.endsWith('/trifangx_live');
      } catch (e) {
        return false;
      }
    }

    function trifangxAccountReturnFilename() {
      return isTrifangxLiveDedicatedPage() ? 'trifangx_live.html' : 'chess_engine.html';
    }

    /** True while a live engine session should persist snapshots (?txlive=1 on lobby, or dedicated live page). */
    function trifangxLivePlayActiveInUrl() {
      if (isTrifangxLiveDedicatedPage()) return true;
      try {
        return new URL(window.location.href).searchParams.get(TRIFANGX_LIVE_URL_PARAM) === '1';
      } catch (e) {
        return false;
      }
    }

    function setTrifangxLivePlayUrl() {
      if (isTrifangxLiveDedicatedPage()) {
        return;
      }
      try {
        const u = new URL(window.location.href);
        u.searchParams.set(TRIFANGX_LIVE_URL_PARAM, '1');
        window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
      } catch (e2) {}
    }

    function clearTrifangxLiveUrlAndSnapshot() {
      try {
        sessionStorage.removeItem(TRIFANGX_LIVE_SNAPSHOT_KEY);
      } catch (e) {}
      try {
        sessionStorage.removeItem(TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY);
      } catch (e1) {}
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.get(TRIFANGX_LIVE_URL_PARAM) === '1') {
          u.searchParams.delete(TRIFANGX_LIVE_URL_PARAM);
          window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
        }
      } catch (e2) {}
    }

    function pagehideNavigationIsReload() {
      try {
        const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        if (nav && nav.type === 'reload') return true;
      } catch (e) {}
      try {
        const p = performance.navigation;
        if (p && p.type === 1) return true;
      } catch (e2) {}
      return false;
    }

    function persistTrifangxLiveSnapshot() {
      try {
        if (!game || gameOver) return;
        const gid = getEngineGameId();
        if (!gid) return;
        if (!trifangxLivePlayActiveInUrl()) return;
        const tcEl = document.getElementById('time-control');
        const snap = {
          v: 1,
          game_id: gid,
          moves: game.history(),
          playerColor: playerColor,
          timeLimited: !!timeLimited,
          increment: increment != null ? increment : 0,
          whiteTime: whiteTime != null ? whiteTime : 0,
          blackTime: blackTime != null ? blackTime : 0,
          blindfoldMode: !!blindfoldMode,
          showHistoryInBlindfold: !!showHistoryInBlindfold,
          moveClockTimes: moveClockTimes.slice(),
          moveHistory: moveHistory.slice(),
          lastMoveSquares: {
            from: lastMoveSquares && lastMoveSquares.from != null ? lastMoveSquares.from : null,
            to: lastMoveSquares && lastMoveSquares.to != null ? lastMoveSquares.to : null,
          },
          capturedPieces: {
            white: (capturedPieces && capturedPieces.white) ? capturedPieces.white.slice() : [],
            black: (capturedPieces && capturedPieces.black) ? capturedPieces.black.slice() : [],
          },
          currentMoveIndex: typeof currentMoveIndex === 'number' ? currentMoveIndex : -1,
          lastLiveMoveDisplayText: typeof lastLiveMoveDisplayText !== 'undefined' ? lastLiveMoveDisplayText : 'None',
          currentTimeControl: typeof currentTimeControl !== 'undefined' ? currentTimeControl : null,
          timeControlOption: tcEl && tcEl.value ? tcEl.value : null,
          premoves: Array.isArray(premoves) ? premoves.slice() : [],
          moveTimerElapsedMs:
            timerInterval != null &&
            typeof performance !== 'undefined' &&
            typeof timerStart === 'number' &&
            timerStart > 0
              ? Math.max(0, performance.now() - timerStart)
              : 0,
        };
        sessionStorage.setItem(TRIFANGX_LIVE_SNAPSHOT_KEY, JSON.stringify(snap));
      } catch (e) {}
    }

    function touchLiveGameSnapshot() {
      persistTrifangxLiveSnapshot();
    }

    /**
     * "Chess Engine" nav from trifangx_live.html: release the engine (live pagehide never does).
     */
    function leaveLiveForChessLobby(ev) {
      if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
      try {
        releaseEngineOccupancyOnPageExit();
      } catch (e) {}
      window.location.href = new URL('chess_engine.html', window.location.href).href;
    }

    window.addEventListener('pagehide', function (ev) {
      if (ev.persisted) return;
      let skipRelease = false;
      try {
        let isLockHolder = false;
        try {
          isLockHolder = sessionStorage.getItem(ENGINE_LOCK_SESSION_KEY) === '1';
        } catch (e) {}
        const gid = getEngineGameId();

        if (isLockHolder && gid && trifangxLivePlayActiveInUrl()) {
          persistTrifangxLiveSnapshot();
        }

        // Dedicated live URL is only the in-game board — reload is the same view; never /stop from pagehide.
        if (isTrifangxLiveDedicatedPage() && isLockHolder && gid) {
          skipRelease = true;
        } else if (
          !isTrifangxLiveDedicatedPage() &&
          pagehideNavigationIsReload() &&
          trifangxLivePlayActiveInUrl() &&
          isLockHolder &&
          gid
        ) {
          skipRelease = true;
        } else if (
          sessionStorage.getItem(TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY) === '1' &&
          isLockHolder &&
          gid
        ) {
          skipRelease = true;
        }
      } catch (e2) {}
      if (!skipRelease) {
        releaseEngineOccupancyOnPageExit();
      }
    });

    /** Tell the Python engine to stop as soon as the game ends (don't wait for rematch modal). */
    async function releaseEngineOnGameEnd() {
      stopHeartbeat();
      const gid = getEngineGameId();
      try {
        await sendEngineCommand('stop', gid ? { game_id: gid } : {});
      } catch (e) {
        /* still refresh occupancy so UI can recover */
      }
      clearEngineTabSession();
      clearTrifangxLiveUrlAndSnapshot();
      await checkEngineStatus();
    }

    /** Log result on the Python server (prints USERNAME beat/lost to TrifangX + SAN moves). */
    function notifyGameFinishedToEngine(outcome) {
      try {
        const username =
          (typeof localStorage !== 'undefined' && localStorage.getItem('ahrenslabs_username')) ||
          'Player';
        const notation =
          typeof game !== 'undefined' && game && typeof game.history === 'function'
            ? game.history().join(' ')
            : '';
        fetch(`${ENGINE_BASE}/game_finished`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username, outcome: outcome, notation: notation })
        }).catch(function () {});
      } catch (e) {}
    }

    // --- sendEngineCommand function ---
    function sendEngineCommand(endpoint, extraBody) {
      const payload = Object.assign({}, extraBody || {});
      return fetch(`${ENGINE_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          if (!response.ok) {
            const httpErr = new Error(response.statusText || 'HTTP error');
            httpErr.statusCode = response.status;
            return response
              .json()
              .then(function (body) {
                const msg =
                  body &&
                  (body.error || body.message || (typeof body === 'string' ? body : null));
                const e = new Error(
                  typeof msg === 'string' && msg ? msg : `Server error for /${endpoint}: ${response.status}`
                );
                e.statusCode = response.status;
                throw e;
              })
              .catch(function (inner) {
                if (inner && inner.statusCode) throw inner;
                throw httpErr;
              });
          }
          return response.json();
        })
        .then(function (data) {
          console.log(`Command /${endpoint} successful:`, data.message || data.status || data);
          return data;
        })
        .catch(function (error) {
          console.error(`Error sending command /${endpoint}:`, error);
          throw error;
        });
    }

    // Personality modifier functions removed for performance

    function toggleHistoryOption() {
      const blindfoldChecked = document.getElementById("blindfold-mode").checked;
      const historyRow = document.getElementById("show-history-row");
      if (blindfoldChecked) {
        historyRow.style.display = "inline-block";
      } else {
        historyRow.style.display = "none";
        document.getElementById("show-history").checked = false;
      }
    }

    function changeBoardStyle() {
      const style = document.getElementById("board-style").value;
      
      // Check if unlocked
      if (!isUnlocked('boards', style)) {
        showNotification('This board style is locked. Visit the shop to unlock it.', 'info');
        // Reset to last unlocked style
        const unlocked = getUnlockedItems();
        if (unlocked.boards.length > 0) {
          document.getElementById("board-style").value = unlocked.boards[0];
          style = unlocked.boards[0];
        } else {
          document.getElementById("board-style").value = 'classic';
          style = 'classic';
        }
      }
      
      const boardElement = document.getElementById("board");
      
      // Remove all theme classes
      boardElement.className = boardElement.className.replace(/board-theme-\w+/g, '').trim();
      
      // Add new theme class
      boardElement.classList.add(`board-theme-${style}`);
      
      // Save preference to localStorage
      localStorage.setItem('chessboardStyle', style);
      
      // Auto-sync to account
      if (typeof autoSync === 'function') autoSync();
    }

    // Engine personality functions removed for performance

    function changePieceStyle() {
      let style = document.getElementById("piece-style").value;
      
      // Check if unlocked
      if (!isUnlocked('pieces', style)) {
        showNotification('This piece style is locked. Visit the shop to unlock it.', 'info');
        // Reset to last unlocked style
        const unlocked = getUnlockedItems();
        if (unlocked.pieces.length > 0) {
          document.getElementById("piece-style").value = unlocked.pieces[0];
          style = unlocked.pieces[0];
        } else {
          document.getElementById("piece-style").value = 'classic';
          style = 'classic';
        }
      }
      
      currentPieceStyle = style;
      
      // Save preference to localStorage
      localStorage.setItem('chessPieceStyle', style);
      
      // Auto-sync to account
      if (typeof autoSync === 'function') autoSync();
      
      // If board exists, update the piece theme
      if (board) {
        const currentPosition = board.position();
        board.destroy();
        
        // Check if game is active or preview mode
        const isGameStarted = document.getElementById("choose-side").style.display === "none";
        
        if (isGameStarted && game && !gameOver) {
          // Game is active - recreate with full handlers
          recreateBoard();
        } else {
          // Preview mode - recreate preview board
          board = Chessboard('board', {
            draggable: false,
            position: currentPosition,
            orientation: 'white',
            pieceTheme: pieceThemes[currentPieceStyle]
          });
        }
        board.position(currentPosition);
      }
    }

    function recreateBoard() {
      if (board) {
        board.destroy();
        // Reset right-click handler flag so handlers can be reattached
        const boardEl = document.getElementById('board');
        if (boardEl) {
          boardEl._rightClickHandlersInitialized = false;
        }
      }
      // Must use the same Chessboard config as startGame / resume (not onDrop: handleMove).
      // A minimal config breaks drag/click-to-move, promotion, and premove sync with chess.js.
      board = Chessboard('board', buildLiveChessboardOptions(game ? game.fen() : 'start'));

      ensureArrowOverlay();
      applyMoveEffect(currentMoveEffect);

      setTimeout(() => {
        const bel = document.getElementById('board');
        if (bel) {
          bel._rightClickHandlersInitialized = false;
        }
        ensureArrowOverlay();
        initRightClickHandlers();
      }, 100);
    }
    
    // Shop Functions
    function getCheatPoints() {
      return parseInt(localStorage.getItem('cheatPoints') || '0', 10);
    }
    function addCheatPoints(amount) {
      const n = getCheatPoints() + amount;
      localStorage.setItem('cheatPoints', String(n));
    }
    function getTotalPoints() {
      const allAchievements = getAllAchievementsList();
      const fromAchievements = allAchievements.reduce((sum, ach) => {
        if (achievements.includes(ach.id) && ach.points) {
          return sum + ach.points;
        }
        return sum;
      }, 0);
      return fromAchievements + getCheatPoints();
    }
    
    function showShop() {
      if (!requireChessPregameForNonStatsModal()) return;
      const modal = document.getElementById('shop-modal');
      if (!modal) return;
      
      modal.classList.add('show');
      updateShopPoints();
      renderShopItems();
    }
    
    function closeShop() {
      const modal = document.getElementById('shop-modal');
      if (modal) {
        modal.classList.remove('show');
      }
    }

    // In-UI notification (no alert)
    function showNotification(message, type) {
      type = type || 'info';
      const container = document.getElementById('notification-toast');
      if (!container) return;
      const el = document.createElement('div');
      el.className = 'toast-item ' + type;
      el.textContent = message;
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px)';
        setTimeout(() => el.remove(), 300);
      }, 4000);
    }

    function isChessPregamePhase() {
      const lp = document.getElementById('login-page');
      if (lp && lp.style.display !== 'none') return false;
      const cs = document.getElementById('choose-side');
      return !!(cs && cs.style.display === 'block');
    }

    function updateChessPregameToolsVisibility() {
      const bar = document.getElementById('chess-pregame-tools');
      if (bar) {
        // Show the same top bar during saved-game replay so Shop / Settings / History stay available.
        bar.style.display = (isChessPregamePhase() || isHistoryReplayMode) ? 'flex' : 'none';
      }
      const ingameBar = document.getElementById('chess-ingame-tools');
      if (ingameBar) {
        const lp = document.getElementById('login-page');
        if (lp && lp.style.display !== 'none') {
          ingameBar.style.display = 'none';
        } else {
          const cs = document.getElementById('choose-side');
          const gc = document.getElementById('game-container');
          const sideHidden = cs && cs.style.display === 'none';
          const gameVisible = gc && gc.style.display !== 'none';
          // Hide ingame strip while replay uses the full pregame top bar (avoids duplicate buttons).
          ingameBar.style.display = (sideHidden && gameVisible && !isHistoryReplayMode) ? 'flex' : 'none';
        }
      }
    }

    function requireChessPregameForNonStatsModal() {
      if (isHistoryReplayMode) return true;
      if (!isChessPregamePhase()) {
        showNotification('Use the menu above before you start a game.', 'error');
        return false;
      }
      return true;
    }

    // Shop purchase confirmation (pending purchase state)
    let pendingPurchase = null;

    function showShopConfirm(category, itemId, price, name) {
      const modal = document.getElementById('shop-confirm-modal');
      const msg = document.getElementById('shop-confirm-message');
      if (!modal || !msg) return;
      pendingPurchase = { category, itemId, price, name };
      msg.textContent = `Buy "${name}" for ${price} points?`;
      modal.classList.add('show');
    }

    function closeShopConfirm() {
      const modal = document.getElementById('shop-confirm-modal');
      if (modal) modal.classList.remove('show');
      pendingPurchase = null;
    }

    (function initShopConfirmBackdrop() {
      const m = document.getElementById('shop-confirm-modal');
      if (m) m.addEventListener('click', function(e) { if (e.target === m) closeShopConfirm(); });
    })();

    function confirmShopPurchase() {
      if (!pendingPurchase) {
        closeShopConfirm();
        return;
      }
      const { category, itemId, price, name } = pendingPurchase;
      closeShopConfirm();
      pendingPurchase = null;
      purchaseItem(category, itemId, price, name);
    }
    
    function updateShopPoints() {
      const pointsEl = document.getElementById('shop-points-display');
      if (pointsEl) {
        pointsEl.textContent = getSpendablePoints();
      }
    }
    
    const shopTabOrder = ['boards', 'pieces', 'highlightColors', 'arrowColors', 'legalMoveDots', 'themes', 'checkmateEffects', 'timeControls'];
    function switchShopTab(tab) {
      currentShopTab = tab;
      const tabs = document.querySelectorAll('.shop-tab');
      const idx = shopTabOrder.indexOf(tab);
      tabs.forEach((t, i) => {
        t.classList.remove('active');
        if (i === idx) t.classList.add('active');
      });
      renderShopItems();
    }

    function renderShopPreview(category, item) {
      const wrap = document.createElement('div');
      wrap.className = 'shop-item-preview-inner';
      const colorMap = {
        red: { h: 'rgba(200,0,0,0.5)', a: 'rgba(250,180,0,0.9)' },
        blue: { h: 'rgba(52,152,219,0.5)', a: 'rgba(52,152,219,0.9)' },
        green: { h: 'rgba(46,204,113,0.5)', a: 'rgba(46,204,113,0.9)' },
        purple: { h: 'rgba(155,89,182,0.5)', a: 'rgba(155,89,182,0.9)' },
        gold: { h: 'rgba(241,196,15,0.5)', a: 'rgba(241,196,15,0.9)' },
        orange: { h: 'rgba(243,156,18,0.5)', a: 'rgba(243,156,18,0.9)' },
        pink: { h: 'rgba(236,112,99,0.5)', a: 'rgba(236,112,99,0.9)' },
        cyan: { h: 'rgba(52,152,219,0.5)', a: 'rgba(52,152,219,0.9)' },
        rainbow: { h: 'linear-gradient(90deg,red,orange,yellow,green,blue,violet)', a: 'rgba(250,180,0,0.9)' }
      };
      const themePreviews = {
        light: {
          base: 'linear-gradient(135deg,#f0f4f8 0%,#e8f2f7 50%,#f0f4f8 100%)',
          before: 'background:radial-gradient(circle at 20% 80%,rgba(52,152,219,0.06) 0%,transparent 45%),radial-gradient(circle at 80% 20%,rgba(46,204,113,0.05) 0%,transparent 45%);animation:light-float-preview 8s ease-in-out infinite;'
        },
        dark: {
          base: 'linear-gradient(145deg,#0f0f0f 0%,#1c1c1e 25%,#252528 50%,#1c1c1e 75%,#0f0f0f 100%)',
          before: 'background:radial-gradient(ellipse 80% 50% at 50% 0%,rgba(138,43,226,0.08) 0%,transparent 50%),radial-gradient(ellipse 60% 40% at 100% 100%,rgba(0,150,199,0.06) 0%,transparent 50%);animation:dark-drift-preview 12s ease-in-out infinite;'
        },
        midnight: {
          base: 'linear-gradient(160deg,#050810 0%,#0e1628 20%,#151f3a 40%,#0e1628 70%,#050810 100%)',
          before: 'background:radial-gradient(ellipse 100% 60% at 50% 0%,rgba(59,130,246,0.12) 0%,transparent 55%),radial-gradient(circle at 10% 90%,rgba(99,102,241,0.08) 0%,transparent 40%);animation:midnight-pulse-preview 10s ease-in-out infinite;',
          after: 'background:radial-gradient(1px 1px at 15% 20%,rgba(59,130,246,0.8) 0%,transparent 50%),radial-gradient(1px 1px at 45% 60%,rgba(99,102,241,0.6) 0%,transparent 50%),radial-gradient(2px 2px at 75% 30%,rgba(59,130,246,0.7) 0%,transparent 50%);animation:midnight-stars-preview 6s linear infinite;'
        },
        ocean: {
          base: 'linear-gradient(160deg,#021c2e 0%,#0a3452 25%,#0d4a6e 50%,#0a3452 75%,#021c2e 100%)',
          before: 'background:radial-gradient(ellipse 90% 50% at 30% 10%,rgba(6,182,212,0.15) 0%,transparent 50%),radial-gradient(ellipse 70% 50% at 80% 90%,rgba(20,184,166,0.1) 0%,transparent 50%);animation:ocean-glow-preview 4s ease-in-out infinite;',
          after: 'background:radial-gradient(ellipse 40px 8px at 0% 100%,rgba(6,182,212,0.4) 0%,rgba(6,182,212,0.2) 30%,transparent 60%),radial-gradient(ellipse 35px 7px at 25% 100%,rgba(20,184,166,0.35) 0%,rgba(20,184,166,0.15) 35%,transparent 65%),radial-gradient(ellipse 45px 9px at 50% 100%,rgba(6,182,212,0.4) 0%,rgba(6,182,212,0.2) 30%,transparent 60%);background-size:100% 100%;animation:ocean-waves-preview 3s ease-in-out infinite;bottom:0;height:40%;'
        },
        forest: {
          base: 'linear-gradient(135deg,#1a3d2e 0%,#2d5a3d 25%,#3d7a4d 50%,#2d5a3d 75%,#1a3d2e 100%)',
          before: 'background:radial-gradient(circle at 20% 30%,rgba(76,175,80,0.15) 0%,transparent 40%),radial-gradient(circle at 80% 70%,rgba(139,195,74,0.12) 0%,transparent 40%);animation:forest-drift-preview 10s ease-in-out infinite;',
          after: 'background:radial-gradient(ellipse 6px 9px at 10% 0%,rgba(76,175,80,0.6) 0%,rgba(76,175,80,0.3) 40%,transparent 70%),radial-gradient(ellipse 5px 8px at 30% 5%,rgba(139,195,74,0.5) 0%,rgba(139,195,74,0.25) 45%,transparent 75%),radial-gradient(ellipse 7px 10px at 50% 2%,rgba(76,175,80,0.55) 0%,rgba(76,175,80,0.28) 42%,transparent 72%);animation:forest-leaves-preview 4s linear infinite;'
        },
        sunset: {
          base: 'linear-gradient(135deg,#ff6b35 0%,#f7931e 20%,#ffcc02 40%,#f7931e 60%,#ff6b35 80%,#c44536 100%)',
          before: 'background:radial-gradient(ellipse 100% 50% at 50% 0%,rgba(255,193,7,0.2) 0%,transparent 60%),radial-gradient(circle at 20% 80%,rgba(255,87,34,0.15) 0%,transparent 50%);animation:sunset-glow-preview 4s ease-in-out infinite;',
          after: 'background:repeating-conic-gradient(from 0deg at 50% 0%,transparent 0deg,transparent 2deg,rgba(255,193,7,0.08) 2deg,rgba(255,193,7,0.12) 3deg,transparent 6deg);animation:sunset-rays-preview 8s linear infinite;filter:blur(0.5px);'
        },
        cyber: {
          base: 'linear-gradient(135deg,#0a0a0f 0%,#1a1a2a 50%,#0a0a0f 100%)',
          before: 'background:linear-gradient(rgba(0,255,255,0.1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,255,0.1) 1px,transparent 1px);background-size:10px 10px;animation:cyber-grid-preview 3s linear infinite;',
          after: 'background:linear-gradient(0deg,transparent 0%,rgba(0,255,255,0.1) 50%,transparent 100%),linear-gradient(90deg,transparent 0%,rgba(255,0,255,0.08) 50%,transparent 100%);background-size:200% 200%;animation:cyber-scan-preview 2s linear infinite;'
        },
        space: {
          base: 'radial-gradient(ellipse at center,#1a1a2e 0%,#0a0a1a 50%,#000011 100%)',
          before: 'background:radial-gradient(ellipse 100% 60% at 30% 20%,rgba(138,43,226,0.3) 0%,transparent 50%),radial-gradient(ellipse 80% 50% at 70% 80%,rgba(30,144,255,0.25) 0%,transparent 50%);animation:space-nebula-preview 12s ease-in-out infinite;',
          after: 'background:radial-gradient(1px 1px at 20% 30%,rgba(255,255,255,0.9) 0%,transparent 60%),radial-gradient(1px 1px at 60% 70%,rgba(255,255,255,0.8) 0%,transparent 65%),radial-gradient(2px 2px at 50% 50%,rgba(255,255,255,1) 0%,transparent 55%);animation:space-twinkle-preview 2s ease-in-out infinite;'
        },
        aurora: {
          base: 'linear-gradient(135deg,#0a1929 0%,#1a2f4a 25%,#2d4a6b 50%,#1a2f4a 75%,#0a1929 100%)',
          before: 'background:linear-gradient(180deg,transparent 0%,rgba(0,255,127,0.2) 20%,rgba(0,191,255,0.25) 40%,rgba(138,43,226,0.2) 60%,transparent 80%);filter:blur(8px);animation:aurora-wave-preview 4s ease-in-out infinite;',
          after: 'background:repeating-linear-gradient(0deg,transparent 0%,transparent 5%,rgba(0,255,127,0.15) 5%,rgba(0,191,255,0.2) 10%,rgba(138,43,226,0.15) 15%,transparent 20%);background-size:50px 100%;animation:aurora-sweep-preview 6s ease-in-out infinite;filter:blur(1px);'
        },
        matrix: {
          base: 'linear-gradient(135deg,#000000 0%,#001100 50%,#000000 100%)',
          before: 'background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,0,0.03) 2px,rgba(0,255,0,0.03) 4px),repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,255,0,0.03) 2px,rgba(0,255,0,0.03) 4px);',
          after: 'background:repeating-linear-gradient(0deg,transparent 0px,transparent 4px,rgba(0,255,0,0.4) 4px,rgba(0,255,0,0.4) 5px,transparent 5px);background-size:100% 10px;animation:matrix-rain-preview 2s linear infinite;'
        },
        retro: {
          base: 'linear-gradient(135deg,#1a0033 0%,#330066 25%,#6600cc 50%,#330066 75%,#1a0033 100%)',
          before: 'background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,0,255,0.1) 2px,rgba(255,0,255,0.1) 4px);animation:retro-scan-preview 0.2s linear infinite;',
          after: 'background:repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,0,255,0.05) 20px,rgba(255,0,255,0.05) 22px);animation:retro-sweep-preview 4s linear infinite;'
        },
        galaxy: {
          base: 'radial-gradient(ellipse at center,#2d1a4d 0%,#1a0033 50%,#000011 100%)',
          before: 'background:radial-gradient(ellipse 100% 50% at 50% 50%,rgba(138,43,226,0.4) 0%,transparent 60%),radial-gradient(ellipse 80% 40% at 50% 50%,rgba(75,0,130,0.3) 0%,transparent 70%),conic-gradient(from 0deg at 50% 50%,transparent 0%,rgba(138,43,226,0.2) 30%,transparent 60%,rgba(75,0,130,0.2) 90%,transparent 100%);animation:galaxy-rotate-preview 10s linear infinite;',
          after: 'background:repeating-conic-gradient(from 0deg at 50% 50%,transparent 0deg,transparent 15deg,rgba(138,43,226,0.15) 15deg,rgba(138,43,226,0.25) 18deg,transparent 25deg);animation:galaxy-spiral-preview 8s linear infinite;filter:blur(1px);'
        },
        fire: {
          base: 'linear-gradient(180deg,#000000 0%,#1a0000 20%,#4d0000 40%,#800000 60%,#4d0000 80%,#1a0000 100%)',
          before: 'background:radial-gradient(ellipse 100% 60% at 50% 100%,rgba(255,69,0,0.4) 0%,rgba(255,140,0,0.3) 30%,transparent 70%),radial-gradient(ellipse 80% 50% at 30% 100%,rgba(255,140,0,0.3) 0%,transparent 50%),radial-gradient(ellipse 80% 50% at 70% 100%,rgba(255,69,0,0.3) 0%,transparent 50%);bottom:0;height:60%;animation:fire-wave-preview 1s ease-in-out infinite;',
          after: 'background:radial-gradient(ellipse 20px 30px at 5% 100%,rgba(255,69,0,0.6) 0%,rgba(255,140,0,0.4) 25%,transparent 70%),radial-gradient(ellipse 18px 28px at 25% 100%,rgba(255,140,0,0.5) 0%,rgba(255,69,0,0.35) 30%,transparent 75%),radial-gradient(ellipse 22px 32px at 50% 100%,rgba(255,69,0,0.65) 0%,rgba(255,140,0,0.45) 22%,transparent 68%);background-size:100% 100%;bottom:0;height:50%;animation:fire-flicker-preview 2s ease-in-out infinite;'
        }
      };
      if (category === 'boards' && boardPreviewColors[item.id]) {
        const g = document.createElement('div');
        g.className = 'shop-preview-board';
        g.setAttribute('aria-label', 'Board preview');
        const c = boardPreviewColors[item.id];
        for (let r = 0; r < 4; r++) {
          for (let col = 0; col < 4; col++) {
            const cell = document.createElement('div');
            cell.className = 'shop-preview-cell';
            cell.style.background = (r + col) % 2 === 0 ? c.w : c.b;
            g.appendChild(cell);
          }
        }
        wrap.appendChild(g);
      } else if (category === 'pieces' && typeof pieceThemes !== 'undefined' && pieceThemes[item.id]) {
        const tpl = pieceThemes[item.id];
        const pieces = ['wK', 'bK', 'wQ', 'wp'];
        pieces.forEach(p => {
          const img = document.createElement('img');
          img.src = tpl.replace('{piece}', p);
          img.alt = p;
          img.className = 'shop-preview-piece';
          wrap.appendChild(img);
        });
      } else if ((category === 'highlightColors' || category === 'arrowColors') && colorMap[item.id]) {
        const swatch = document.createElement('div');
        swatch.className = 'shop-preview-swatch';
        swatch.style.background = colorMap[item.id].h;
        wrap.appendChild(swatch);
        if (category === 'arrowColors') {
          const arr = document.createElement('div');
          arr.className = 'shop-preview-arrow';
          arr.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="' + (colorMap[item.id].a || colorMap[item.id].h) + '" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';
          wrap.appendChild(arr);
        }
      } else if (category === 'legalMoveDots' && item.color && item.shape) {
        const dot = document.createElement('div');
        dot.className = 'shop-preview-legal-dot';
        dot.style.width = '24px';
        dot.style.height = '24px';
        dot.style.margin = '0 auto';
        if (item.color === 'rainbow') {
          dot.style.background = 'linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)';
          dot.style.backgroundSize = '200% 200%';
          dot.style.animation = 'rainbow-shift 3s ease infinite';
        } else {
          dot.style.background = item.color;
        }
        if (item.shape === 'circle') {
          dot.style.borderRadius = '50%';
        } else if (item.shape === 'square') {
          dot.style.borderRadius = '0';
        } else if (item.shape === 'diamond') {
          dot.style.borderRadius = '0';
          dot.style.transform = 'rotate(45deg)';
        } else if (item.shape === 'star') {
          dot.style.clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
        }
        wrap.appendChild(dot);
      } else if (category === 'themes' && themePreviews[item.id]) {
        const th = document.createElement('div');
        th.className = 'shop-preview-theme';
        th.setAttribute('data-theme', item.id);
        const preview = themePreviews[item.id];
        // Handle both old string format and new object format
        if (typeof preview === 'string') {
          th.style.background = preview;
        } else {
          // Set base background
          th.style.background = preview.base;
          th.style.position = 'relative';
          th.style.overflow = 'hidden';
          // Add animated layers for realistic previews
          if (preview.before) {
            const before = document.createElement('div');
            before.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' + preview.before;
            th.appendChild(before);
          }
          if (preview.after) {
            const after = document.createElement('div');
            after.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' + preview.after;
            th.appendChild(after);
          }
        }
        wrap.appendChild(th);
      } else {
        const emoji = document.createElement('span');
        emoji.className = 'shop-preview-emoji';
        emoji.textContent = item.preview || '?';
        wrap.appendChild(emoji);
        if (['checkmateEffects', 'timeControls'].includes(category)) {
          const hint = document.createElement('span');
          hint.className = 'shop-preview-hint';
          hint.textContent = 'Preview in game';
          wrap.appendChild(hint);
        }
      }
      return wrap;
    }
    
    function renderShopItems() {
      const container = document.getElementById('shop-items-container');
      if (!container) return;
      
      container.innerHTML = '';
      const items = shopItems[currentShopTab];
      if (!items) return;
      const unlocked = getUnlockedItems();
      const currentBoardStyle = localStorage.getItem('chessboardStyle') || 'classic';
      const savedPieceStyle = localStorage.getItem('chessPieceStyle') || 'classic';
      const currentTheme = localStorage.getItem('pageTheme') || 'light';
      const currentMove = localStorage.getItem('moveEffect') || 'default';
      const checkmateEnabled = getCheckmateAddonsEnabled();
      const currentTime = (document.getElementById('time-control') && document.getElementById('time-control').value) || 'none';
      const spendable = getSpendablePoints();
      
      items.forEach(item => {
        const isUnlocked = (unlocked[currentShopTab] || []).includes(item.id);
        const currentLegalDot = localStorage.getItem('legalMoveDotStyle') || 'blue-circle';
        const isEquipped = (currentShopTab === 'boards' && item.id === currentBoardStyle) ||
                          (currentShopTab === 'pieces' && item.id === savedPieceStyle) ||
                          (currentShopTab === 'highlightColors' && item.id === currentHighlightColor) ||
                          (currentShopTab === 'arrowColors' && item.id === currentArrowColor) ||
                          (currentShopTab === 'legalMoveDots' && item.id === currentLegalDot) ||
                          (currentShopTab === 'themes' && item.id === currentTheme) ||
                          (currentShopTab === 'checkmateEffects' ? checkmateEnabled.includes(item.id) : false) ||
                          (currentShopTab === 'timeControls' && item.id === currentTime);
        const canAfford = item.price <= spendable;
        const isCheckmateAddon = currentShopTab === 'checkmateEffects';
        
        const itemDiv = document.createElement('div');
        itemDiv.className = `shop-item ${isUnlocked ? 'unlocked' : 'locked'}`;
        
        if (isUnlocked) {
          const badge = document.createElement('div');
          badge.className = 'shop-item-badge';
          badge.textContent = '✓';
          itemDiv.appendChild(badge);
        }
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'shop-item-name';
        nameDiv.textContent = item.name;
        itemDiv.appendChild(nameDiv);
        
        const previewDiv = document.createElement('div');
        previewDiv.className = 'shop-item-preview';
        const previewContent = renderShopPreview(currentShopTab, item);
        previewDiv.appendChild(previewContent);
        itemDiv.appendChild(previewDiv);
        
        if (item.description) {
          const descDiv = document.createElement('div');
          descDiv.style.cssText = 'font-size: 0.85em; color: #7f8c8d; margin: 5px 0;';
          descDiv.textContent = item.description;
          itemDiv.appendChild(descDiv);
        }
        
        const priceDiv = document.createElement('div');
        priceDiv.className = 'shop-item-price';
        if (isUnlocked) {
          priceDiv.textContent = 'Unlocked';
          priceDiv.style.color = '#2ecc71';
        } else {
          priceDiv.textContent = `${item.price} points`;
          if (!canAfford) {
            priceDiv.style.color = '#e74c3c';
          }
        }
        itemDiv.appendChild(priceDiv);
        
        const button = document.createElement('button');
        button.className = 'shop-item-button';
        if (isUnlocked) {
          if (isCheckmateAddon) {
            button.textContent = isEquipped ? 'Enabled ✓' : 'Enable';
            button.classList.add(isEquipped ? 'equipped' : 'equip');
            button.onclick = () => { toggleCheckmateAddon(item.id); renderShopItems(); if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns(); };
          } else if (isEquipped) {
            button.textContent = 'Equipped';
            button.classList.add('equipped');
            button.disabled = true;
          } else {
            button.textContent = 'Equip';
            button.classList.add('equip');
            button.onclick = () => equipItem(currentShopTab, item.id);
          }
        } else {
          button.textContent = 'Unlock';
          button.classList.add('unlock');
          button.disabled = false;
          button.onclick = () => {
            const afford = getSpendablePoints() >= item.price;
            if (afford) showShopConfirm(currentShopTab, item.id, item.price, item.name);
            else showNotification(`Not enough points. You need ${item.price} but have ${getSpendablePoints()} available.`, 'error');
          };
        }
        itemDiv.appendChild(button);
        
        container.appendChild(itemDiv);
      });
    }
    
    function purchaseItem(category, itemId, price, name) {
      const spendable = getSpendablePoints();
      if (spendable < price) {
        showNotification(`Not enough points. You need ${price} but have ${spendable} available.`, 'error');
        return;
      }
      const displayName = name || (shopItems[category] && shopItems[category].find(i => i.id === itemId)?.name) || itemId;
      if (unlockItem(category, itemId)) {
        addSpentPoints(price);
        updateShopPoints();
        renderShopItems();
        updateStyleDropdowns();
        if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns();
        showNotification(`Unlocked ${displayName}! (-${price} points)`, 'success');
        
        // Auto-sync to account
        if (typeof autoSync === 'function') autoSync();
      }
    }
    
    function equipItem(category, itemId) {
      if (category === 'boards') {
        document.getElementById('board-style').value = itemId;
        changeBoardStyle();
      } else if (category === 'pieces') {
        document.getElementById('piece-style').value = itemId;
        changePieceStyle();
      } else if (category === 'highlightColors') {
        currentHighlightColor = itemId;
        applyHighlightColor(itemId);
        localStorage.setItem('highlightColor', itemId);
      } else if (category === 'arrowColors') {
        currentArrowColor = itemId;
        applyArrowColor(itemId);
        localStorage.setItem('arrowColor', itemId);
      } else if (category === 'legalMoveDots') {
        applyLegalMoveDotStyle(itemId);
        localStorage.setItem('legalMoveDotStyle', itemId);
      } else if (category === 'themes') {
        currentPageTheme = itemId;
        applyPageTheme(itemId);
        localStorage.setItem('pageTheme', itemId);
      } else if (category === 'moveEffects') {
        currentMoveEffect = itemId;
        applyMoveEffect(itemId);
        localStorage.setItem('moveEffect', itemId);
      } else if (category === 'checkmateEffects') {
        toggleCheckmateAddon(itemId);
      } else if (category === 'timeControls') {
        const sel = document.getElementById('time-control');
        if (sel) {
          sel.value = itemId;
          localStorage.setItem('timeControl', itemId);
        }
      }
      renderShopItems();
      
      // Auto-sync to account
      if (typeof autoSync === 'function') autoSync();
    }
    
    // Color map for highlights and arrows
    const colorMap = {
      red: { highlightLight: 'rgba(200, 0, 0, 0.50)', highlightDark: 'rgba(200, 0, 0, 0.55)', arrow: 'rgba(250, 180, 0, 0.7)', arrowFill: 'rgba(250, 180, 0, 1)', h: 'rgba(200,0,0,0.5)', a: 'rgba(250,180,0,0.9)' },
      blue: { highlightLight: 'rgba(52, 152, 219, 0.50)', highlightDark: 'rgba(52, 152, 219, 0.55)', arrow: 'rgba(52, 152, 219, 0.7)', arrowFill: 'rgba(52, 152, 219, 1)', h: 'rgba(52,152,219,0.5)', a: 'rgba(52,152,219,0.9)' },
      green: { highlightLight: 'rgba(46, 204, 113, 0.50)', highlightDark: 'rgba(46, 204, 113, 0.55)', arrow: 'rgba(46, 204, 113, 0.7)', arrowFill: 'rgba(46, 204, 113, 1)', h: 'rgba(46,204,113,0.5)', a: 'rgba(46,204,113,0.9)' },
      purple: { highlightLight: 'rgba(155, 89, 182, 0.50)', highlightDark: 'rgba(155, 89, 182, 0.55)', arrow: 'rgba(155, 89, 182, 0.7)', arrowFill: 'rgba(155, 89, 182, 1)', h: 'rgba(155,89,182,0.5)', a: 'rgba(155,89,182,0.9)' },
      gold: { highlightLight: 'rgba(241, 196, 15, 0.50)', highlightDark: 'rgba(241, 196, 15, 0.55)', arrow: 'rgba(241, 196, 15, 0.7)', arrowFill: 'rgba(241, 196, 15, 1)', h: 'rgba(241,196,15,0.5)', a: 'rgba(241,196,15,0.9)' },
      orange: { highlightLight: 'rgba(243, 156, 18, 0.50)', highlightDark: 'rgba(243, 156, 18, 0.55)', arrow: 'rgba(243, 156, 18, 0.7)', arrowFill: 'rgba(243, 156, 18, 1)', h: 'rgba(243,156,18,0.5)', a: 'rgba(243,156,18,0.9)' },
      pink: { highlightLight: 'rgba(236, 112, 99, 0.50)', highlightDark: 'rgba(236, 112, 99, 0.55)', arrow: 'rgba(236, 112, 99, 0.7)', arrowFill: 'rgba(236, 112, 99, 1)', h: 'rgba(236,112,99,0.5)', a: 'rgba(236,112,99,0.9)' },
      cyan: { highlightLight: 'rgba(52, 152, 219, 0.50)', highlightDark: 'rgba(52, 152, 219, 0.55)', arrow: 'rgba(52, 152, 219, 0.7)', arrowFill: 'rgba(52, 152, 219, 1)', h: 'rgba(52,152,219,0.5)', a: 'rgba(52,152,219,0.9)' },
      rainbow: { isRainbow: true, h: 'linear-gradient(90deg,red,orange,yellow,green,blue,violet)', a: 'rgba(250,180,0,0.9)' }
    };
    
    function applyHighlightColor(colorId) {
      // Update highlight colors only (not arrows)
      let styleTag = document.getElementById('dynamic-color-styles');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-color-styles';
        document.head.appendChild(styleTag);
      }
      
      // Get existing content and preserve arrow color settings
      let existingContent = styleTag.textContent || '';
      
      if (colorId === 'rainbow') {
        // Remove old highlight rules
        existingContent = existingContent.replace(/#board .*?highlight.*?\{[^}]*\}/g, '');
        existingContent = existingContent.replace(/@keyframes rainbow-shift[^}]*\}/g, '');
        styleTag.textContent = existingContent + `
          @keyframes rainbow-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          #board .premove-highlight.white-1e1d7,
          #board .premove-source.white-1e1d7,
          #board .right-click-highlight.white-1e1d7,
          #board .premove-highlight.black-3c85d,
          #board .premove-source.black-3c85d,
          #board .right-click-highlight.black-3c85d {
            background: linear-gradient(135deg, rgba(255,0,0,0.6), rgba(255,127,0,0.6), rgba(255,255,0,0.6), rgba(0,255,0,0.6), rgba(0,0,255,0.6), rgba(75,0,130,0.6), rgba(148,0,211,0.6)) !important;
            background-size: 200% 200% !important;
            animation: rainbow-shift 3s ease infinite !important;
          }
        `;
      } else {
        const colors = colorMap[colorId] || colorMap.red;
        // Remove old highlight rules
        existingContent = existingContent.replace(/#board .*?highlight.*?\{[^}]*\}/g, '');
        existingContent = existingContent.replace(/@keyframes rainbow-shift[^}]*\}/g, '');
        styleTag.textContent = existingContent + `
          #board .premove-highlight.white-1e1d7,
          #board .premove-source.white-1e1d7,
          #board .right-click-highlight.white-1e1d7 {
            background-color: ${colors.highlightLight} !important;
          }
          #board .premove-highlight.black-3c85d,
          #board .premove-source.black-3c85d,
          #board .right-click-highlight.black-3c85d {
            background-color: ${colors.highlightDark} !important;
          }
        `;
      }
    }
    
    function applyArrowColor(colorId) {
      // Update arrow colors only
      if (colorId === 'rainbow') {
        window.currentArrowColor = 'url(#rainbow-gradient)';
        window.currentArrowFillColor = 'url(#rainbow-gradient)';
        window.rainbowMode = true;
        if (typeof drawArrows === 'function') {
          drawArrows();
        }
      } else {
        const colors = colorMap[colorId] || colorMap.red;
        window.currentArrowColor = colors.arrow;
        window.currentArrowFillColor = colors.arrowFill;
        window.rainbowMode = false;
        if (window.rainbowArrowAnim) {
          clearInterval(window.rainbowArrowAnim);
          window.rainbowArrowAnim = null;
        }
        if (typeof drawArrows === 'function') {
          drawArrows();
        }
      }
    }
    
    function applyLegalMoveDotStyle(dotId) {
      const dotItem = shopItems.legalMoveDots.find(d => d.id === dotId);
      if (!dotItem) return;
      
      let styleTag = document.getElementById('dynamic-legal-dot-styles');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-legal-dot-styles';
        document.head.appendChild(styleTag);
      }
      
      const color = dotItem.color;
      const shape = dotItem.shape;
      
      let dotStyle = '';
      if (color === 'rainbow') {
        dotStyle = 'background: linear-gradient(135deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); background-size: 200% 200%; animation: rainbow-shift 3s ease infinite;';
      } else {
        dotStyle = `background: radial-gradient(circle, ${color}, transparent);`;
      }
      
      let shapeStyle = '';
      if (shape === 'circle') {
        shapeStyle = 'border-radius: 50%;';
      } else if (shape === 'square') {
        shapeStyle = 'border-radius: 0;';
      } else if (shape === 'diamond') {
        shapeStyle = 'border-radius: 0; transform: translate(-50%, -50%) rotate(45deg);';
      } else if (shape === 'star') {
        shapeStyle = 'clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);';
      }
      
      styleTag.textContent = `
        .highlight-legal::after {
          ${dotStyle}
          ${shapeStyle}
        }
      `;
    }

    function applyPageTheme(themeId) {
      // Only apply theme if user is logged in
      if (!isLoggedIn || !currentSessionId) {
        return;
      }
      
      currentPageTheme = themeId;
      document.documentElement.classList.remove('page-theme-light', 'page-theme-dark', 'page-theme-midnight', 'page-theme-ocean', 'page-theme-forest', 'page-theme-sunset', 'page-theme-cyber', 'page-theme-space', 'page-theme-aurora', 'page-theme-matrix', 'page-theme-retro', 'page-theme-galaxy', 'page-theme-fire');
      document.documentElement.classList.add('page-theme-' + themeId);
    }

    function applyMoveEffect(effectId) {
      currentMoveEffect = effectId;
      const boardEl = document.getElementById('board');
      if (!boardEl) return;
      boardEl.classList.remove('move-effect-default', 'move-effect-slide', 'move-effect-bounce', 'move-effect-pop', 'move-effect-glow');
      boardEl.classList.add('move-effect-' + effectId);
    }
    
    function updateStyleDropdowns() {
      const unlocked = getUnlockedItems();
      
      // Update board style dropdown
      const boardSelect = document.getElementById('board-style');
      if (boardSelect) {
        const currentValue = boardSelect.value;
        boardSelect.innerHTML = '';
        shopItems.boards.forEach(board => {
          if (unlocked.boards.includes(board.id)) {
            const option = document.createElement('option');
            option.value = board.id;
            option.textContent = board.name;
            boardSelect.appendChild(option);
          }
        });
        // Restore selection if still unlocked
        if (unlocked.boards.includes(currentValue)) {
          boardSelect.value = currentValue;
        } else if (unlocked.boards.length > 0) {
          boardSelect.value = unlocked.boards[0];
          changeBoardStyle();
        }
      }
      
      // Update piece style dropdown
      const pieceSelect = document.getElementById('piece-style');
      if (pieceSelect) {
        const currentValue = pieceSelect.value || 'classic';
        pieceSelect.innerHTML = '';
        shopItems.pieces.forEach(piece => {
          if (unlocked.pieces.includes(piece.id)) {
            const option = document.createElement('option');
            option.value = piece.id;
            option.textContent = piece.name;
            pieceSelect.appendChild(option);
          }
        });
        // Ensure at least Classic is available
        if (pieceSelect.options.length === 0) {
          const option = document.createElement('option');
          option.value = 'classic';
          option.textContent = 'Classic';
          pieceSelect.appendChild(option);
          unlockItem('pieces', 'classic');
        }
        // Restore selection if still unlocked
        if (unlocked.pieces.includes(currentValue)) {
          pieceSelect.value = currentValue;
        } else if (unlocked.pieces.length > 0) {
          pieceSelect.value = unlocked.pieces[0];
          changePieceStyle();
        } else {
          pieceSelect.value = 'classic';
          changePieceStyle();
        }
      }

      // Update time control dropdown (only unlocked)
      const timeSelect = document.getElementById('time-control');
      if (timeSelect && shopItems.timeControls) {
        const currentValue = timeSelect.value || 'none';
        timeSelect.innerHTML = '';
        shopItems.timeControls.forEach(tc => {
          if ((unlocked.timeControls || []).includes(tc.id)) {
            const opt = document.createElement('option');
            opt.value = tc.id;
            opt.textContent = tc.name;
            timeSelect.appendChild(opt);
          }
        });
        if (timeSelect.options.length === 0) {
          const opt = document.createElement('option');
          opt.value = 'none';
          opt.textContent = 'None';
          timeSelect.appendChild(opt);
          unlockItem('timeControls', 'none');
        }
        if ((unlocked.timeControls || []).includes(currentValue)) {
          timeSelect.value = currentValue;
        } else {
          timeSelect.value = (unlocked.timeControls && unlocked.timeControls[0]) || 'none';
        }
      }
    }

    function showSettings() {
      const modal = document.getElementById('settings-modal');
      if (!modal) return;
      updateSettingsDropdowns();
      modal.classList.add('show');
    }

    function closeSettings() {
      const modal = document.getElementById('settings-modal');
      if (modal) modal.classList.remove('show');
    }

    function updateSettingsDropdowns() {
      const unlocked = getUnlockedItems();
      const boardSel = document.getElementById('settings-board-style');
      const pieceSel = document.getElementById('settings-piece-style');
      const currentBoard = localStorage.getItem('chessboardStyle') || 'classic';
      const currentPiece = localStorage.getItem('chessPieceStyle') || 'classic';
      const currentHighlight = localStorage.getItem('highlightColor') || 'red';
      const currentArrow = localStorage.getItem('arrowColor') || 'red';
      const currentLegalDot = localStorage.getItem('legalMoveDotStyle') || 'blue-circle';

      if (boardSel) {
        boardSel.innerHTML = '';
        shopItems.boards.forEach(b => {
          if (unlocked.boards.includes(b.id)) {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            boardSel.appendChild(opt);
          }
        });
        boardSel.value = unlocked.boards.includes(currentBoard) ? currentBoard : (unlocked.boards[0] || 'classic');
      }

      if (pieceSel) {
        pieceSel.innerHTML = '';
        shopItems.pieces.forEach(p => {
          if (unlocked.pieces.includes(p.id)) {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            pieceSel.appendChild(opt);
          }
        });
        pieceSel.value = unlocked.pieces.includes(currentPiece) ? currentPiece : (unlocked.pieces[0] || 'classic');
      }

      const highlightSel = document.getElementById('settings-highlight-color');
      const arrowSel = document.getElementById('settings-arrow-color');
      const legalDotSel = document.getElementById('settings-legal-dot-style');
      
      if (highlightSel) {
        highlightSel.innerHTML = '';
        shopItems.highlightColors.forEach(c => {
          if (unlocked.highlightColors.includes(c.id)) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            highlightSel.appendChild(opt);
          }
        });
        highlightSel.value = unlocked.highlightColors.includes(currentHighlight) ? currentHighlight : (unlocked.highlightColors[0] || 'red');
      }
      
      if (arrowSel) {
        arrowSel.innerHTML = '';
        shopItems.arrowColors.forEach(c => {
          if (unlocked.arrowColors.includes(c.id)) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            arrowSel.appendChild(opt);
          }
        });
        arrowSel.value = unlocked.arrowColors.includes(currentArrow) ? currentArrow : (unlocked.arrowColors[0] || 'red');
      }
      
      if (legalDotSel) {
        legalDotSel.innerHTML = '';
        shopItems.legalMoveDots.forEach(d => {
          if (unlocked.legalMoveDots.includes(d.id)) {
            const opt = document.createElement('option');
            opt.value = d.id;
            opt.textContent = d.name;
            legalDotSel.appendChild(opt);
          }
        });
        legalDotSel.value = unlocked.legalMoveDots.includes(currentLegalDot) ? currentLegalDot : (unlocked.legalMoveDots[0] || 'blue-circle');
      }
      
      const themeSel = document.getElementById('settings-page-theme');
      const checkmateAddonsEl = document.getElementById('settings-checkmate-addons');
      const timeSel = document.getElementById('settings-time-control');
      const currentTheme = localStorage.getItem('pageTheme') || 'light';
      const checkmateEnabled = getCheckmateAddonsEnabled();
      const currentTime = (document.getElementById('time-control') && document.getElementById('time-control').value) || 'none';

      if (themeSel && shopItems.themes) {
        themeSel.innerHTML = '';
        shopItems.themes.forEach(t => {
          if ((unlocked.themes || []).includes(t.id)) {
            const o = document.createElement('option');
            o.value = t.id;
            o.textContent = t.name;
            themeSel.appendChild(o);
          }
        });
        themeSel.value = (unlocked.themes || []).includes(currentTheme) ? currentTheme : ((unlocked.themes && unlocked.themes[0]) || 'light');
      }
      if (checkmateAddonsEl && shopItems.checkmateEffects) {
        checkmateAddonsEl.innerHTML = '';
        shopItems.checkmateEffects.forEach(c => {
          if (!(unlocked.checkmateEffects || []).includes(c.id)) return;
          const label = document.createElement('label');
          label.className = 'settings-checkmate-addon';
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = checkmateEnabled.includes(c.id);
          cb.dataset.addon = c.id;
          cb.addEventListener('change', () => {
            toggleCheckmateAddon(c.id);
            updateSettingsDropdowns();
          });
          label.appendChild(cb);
          label.appendChild(document.createTextNode(' ' + c.name));
          checkmateAddonsEl.appendChild(label);
        });
        if (checkmateAddonsEl.children.length === 0) {
          const span = document.createElement('span');
          span.className = 'settings-checkmate-none';
          span.textContent = 'None unlocked. Buy add-ons in the Shop.';
          checkmateAddonsEl.appendChild(span);
        }
      }
      if (timeSel && shopItems.timeControls) {
        timeSel.innerHTML = '';
        shopItems.timeControls.forEach(t => {
          if ((unlocked.timeControls || []).includes(t.id)) {
            const o = document.createElement('option');
            o.value = t.id;
            o.textContent = t.name;
            timeSel.appendChild(o);
          }
        });
        timeSel.value = (unlocked.timeControls || []).includes(currentTime) ? currentTime : ((unlocked.timeControls && unlocked.timeControls[0]) || 'none');
      }
    }

    function applySettingsBoard() {
      const sel = document.getElementById('settings-board-style');
      if (!sel) return;
      const v = sel.value;
      const boardEl = document.getElementById('board-style');
      if (boardEl) {
        boardEl.value = v;
        changeBoardStyle();
      } else {
        const boardElement = document.getElementById('board');
        if (boardElement) {
          boardElement.className = boardElement.className.replace(/board-theme-\w+/g, '').trim();
          boardElement.classList.add('board-theme-' + v);
        }
        localStorage.setItem('chessboardStyle', v);
      }
    }

    function applySettingsPiece() {
      const sel = document.getElementById('settings-piece-style');
      if (!sel) return;
      const v = sel.value;
      const pieceEl = document.getElementById('piece-style');
      if (pieceEl) {
        pieceEl.value = v;
        changePieceStyle();
      } else {
        currentPieceStyle = v;
        localStorage.setItem('chessPieceStyle', v);
        if (board) {
          const pos = board.position();
          board.destroy();
          const isGame = document.getElementById('choose-side') && document.getElementById('choose-side').style.display === 'none';
          if (isGame && game && !gameOver) recreateBoard();
          else {
            board = Chessboard('board', { draggable: false, position: pos, orientation: 'white', pieceTheme: pieceThemes[v] });
            board.position(pos);
          }
        }
      }
    }

    function applySettingsHighlightColor() {
      const sel = document.getElementById('settings-highlight-color');
      if (!sel) return;
      const v = sel.value;
      currentHighlightColor = v;
      applyHighlightColor(v);
      localStorage.setItem('highlightColor', v);
    }
    
    function applySettingsArrowColor() {
      const sel = document.getElementById('settings-arrow-color');
      if (!sel) return;
      const v = sel.value;
      currentArrowColor = v;
      applyArrowColor(v);
      localStorage.setItem('arrowColor', v);
    }
    
    function applySettingsLegalDotStyle() {
      const sel = document.getElementById('settings-legal-dot-style');
      if (!sel) return;
      const v = sel.value;
      applyLegalMoveDotStyle(v);
      localStorage.setItem('legalMoveDotStyle', v);
    }

    function applySettingsTheme() {
      const sel = document.getElementById('settings-page-theme');
      if (!sel) return;
      const v = sel.value;
      currentPageTheme = v;
      applyPageTheme(v);
      localStorage.setItem('pageTheme', v);
    }

    function applySettingsMoveEffect() {
      const sel = document.getElementById('settings-move-effect');
      if (!sel) return;
      const v = sel.value;
      currentMoveEffect = v;
      applyMoveEffect(v);
      localStorage.setItem('moveEffect', v);
    }

    function applySettingsCheckmateEffect() {
      /* Checkmate add-ons handled via checkboxes in settings-checkmate-addons */
    }

    function applySettingsTimeControl() {
      const sel = document.getElementById('settings-time-control');
      const mainSel = document.getElementById('time-control');
      if (!sel || !mainSel) return;
      const v = sel.value;
      mainSel.value = v;
      localStorage.setItem('timeControl', v);
    }

 $(document).ready(async function() {
        console.log("The page has finished loading!");
        
        // Check for URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        
        // Check for email verification token in URL
        const verifyToken = urlParams.get('verify');
        if (verifyToken) {
          // Extract email from URL
          const email = urlParams.get('email');
          if (email) {
            verifyEmail(verifyToken, email);
          }
          // Clean up URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        
        // Load data from cloud (script.js already checked auth and will redirect if needed)
        console.log("Loading chess data from cloud...");
        const loaded = await loadChessDataFromCloud();
        if (!loaded) {
          console.log("Failed to load data, redirect should happen...");
          return; // loadChessDataFromCloud will handle redirect
        }
        
        console.log("Chess data loaded successfully:", cloudChessData);
        
        // Make sure game UI is visible (lobby only: live page hides #choose-side / title via shell CSS)
        const gameTitle = document.getElementById('game-title');
        const chooseSide = document.getElementById('choose-side');
        const gameContainer = document.getElementById('game-container');
        const isLiveShell = typeof window !== 'undefined' && window.TRIFANGX_PAGE_MODE === 'live';

        if (gameTitle) gameTitle.style.display = isLiveShell ? 'none' : 'block';
        if (chooseSide) chooseSide.style.display = isLiveShell ? 'none' : 'block';
        if (gameContainer) gameContainer.style.display = 'block';
        updateChessPregameToolsVisibility();

        // Load saved board style
        const savedStyle = localStorage.getItem('chessboardStyle') || 'classic';
        // Ensure saved style is unlocked, otherwise use classic
        const unlocked = getUnlockedItems();
        if (!unlocked.boards.includes(savedStyle)) {
          localStorage.setItem('chessboardStyle', 'classic');
          document.getElementById('board-style').value = 'classic';
        } else {
        document.getElementById('board-style').value = savedStyle;
        }
        changeBoardStyle();

        // Load saved piece style
        const savedPieceStyle = localStorage.getItem('chessPieceStyle') || 'classic';
        // Ensure saved style is unlocked, otherwise use classic
        if (!unlocked.pieces.includes(savedPieceStyle)) {
          localStorage.setItem('chessPieceStyle', 'classic');
          currentPieceStyle = 'classic';
          document.getElementById('piece-style').value = 'classic';
        } else {
        currentPieceStyle = savedPieceStyle;
        document.getElementById('piece-style').value = savedPieceStyle;
        }
        
        // Load saved colors and apply theme
        currentHighlightColor = localStorage.getItem('highlightColor') || 'red';
        currentArrowColor = localStorage.getItem('arrowColor') || 'red';
        const currentLegalDot = localStorage.getItem('legalMoveDotStyle') || 'blue-circle';
        if (!(unlocked.highlightColors || []).includes(currentHighlightColor) && currentHighlightColor !== 'red') {
          currentHighlightColor = 'red';
          localStorage.setItem('highlightColor', 'red');
        }
        if (!(unlocked.arrowColors || []).includes(currentArrowColor) && currentArrowColor !== 'red') {
          currentArrowColor = 'red';
          localStorage.setItem('arrowColor', 'red');
        }
        if (!(unlocked.legalMoveDots || []).includes(currentLegalDot) && currentLegalDot !== 'blue-circle') {
          localStorage.setItem('legalMoveDotStyle', 'blue-circle');
        }
        applyHighlightColor(currentHighlightColor);
        applyArrowColor(currentArrowColor);
        applyLegalMoveDotStyle(currentLegalDot);

        // Load saved page theme, move effect (but don't apply theme until logged in)
        currentPageTheme = localStorage.getItem('pageTheme') || 'light';
        currentMoveEffect = localStorage.getItem('moveEffect') || 'default';
        if (!(unlocked.themes || []).includes(currentPageTheme)) currentPageTheme = 'light';
        if (!(unlocked.moveEffects || []).includes(currentMoveEffect)) currentMoveEffect = 'default';
        // Only apply theme if logged in
        if (isLoggedIn && currentSessionId) {
          applyPageTheme(currentPageTheme);
        }
        applyMoveEffect(currentMoveEffect);
        
        // Initialize unlocked items if needed
        if (unlocked.boards.length === 0) {
          unlockItem('boards', 'classic');
        }
        if (unlocked.pieces.length === 0) {
          unlockItem('pieces', 'classic');
        }
        if (!(unlocked.highlightColors || []).includes('red')) {
          unlockItem('highlightColors', 'red');
        }
        if (!(unlocked.arrowColors || []).includes('red')) {
          unlockItem('arrowColors', 'red');
        }
        if (!(unlocked.legalMoveDots || []).includes('blue-circle')) {
          unlockItem('legalMoveDots', 'blue-circle');
        }
        if (!(unlocked.themes || []).length) unlockItem('themes', 'light');
        if (!(unlocked.moveEffects || []).length) unlockItem('moveEffects', 'default');
        if (!(unlocked.timeControls || []).length) unlockItem('timeControls', 'none');
        
        // Update dropdowns to only show unlocked items
        updateStyleDropdowns();

        // Restore saved time control if unlocked
        const savedTime = localStorage.getItem('timeControl') || 'none';
        const tcSelect = document.getElementById('time-control');
        if (tcSelect && (unlocked.timeControls || []).includes(savedTime)) {
          tcSelect.value = savedTime;
        }
        if (tcSelect) {
          tcSelect.addEventListener('change', function() {
            const v = this.value;
            if (typeof isUnlocked === 'function' && isUnlocked('timeControls', v)) {
              localStorage.setItem('timeControl', v);
            }
          });
        }

        // Reset All Achievements button (in Settings modal)
        const resetBtn = document.getElementById('reset-achievements-btn');
        if (resetBtn && typeof resetAllAchievements === 'function') {
          resetBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            resetAllAchievements();
          });
        }

        // Cheat code: press "p" to add 10,000 points (for testing)
        document.addEventListener('keydown', function(e) {
          if (e.key !== 'p' && e.key !== 'P') return;
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
          addCheatPoints(10000);
          if (typeof updateShopPoints === 'function') updateShopPoints();
          if (typeof showNotification === 'function') showNotification('+10,000 points (cheat)', 'success');
        });

        // Engine personality loading removed

        // On page load just check status — don't send stop/start which would boot
        // an active player.  The actual start is deferred until the user clicks "Start Game".
        checkEngineStatus();

        const replayIdxRaw = urlParams.get('replayIndex');
        if (replayIdxRaw !== null && replayIdxRaw !== '') {
          const idx = parseInt(replayIdxRaw, 10);
          if (!isNaN(idx) && idx >= 0) {
            playGameHistoryRecordAt(idx);
            const u = new URL(window.location.href);
            u.searchParams.delete('replayIndex');
            window.history.replaceState({}, document.title, u.pathname + u.search + u.hash);
          }
        }

        let liveResumed = false;
        if (isTrifangxLiveDedicatedPage()) {
          try {
            sessionStorage.removeItem(TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY);
          } catch (eNav) {}
        }
        if (
          !isHistoryReplayMode &&
          (urlParams.get(TRIFANGX_LIVE_URL_PARAM) === '1' || isTrifangxLiveDedicatedPage())
        ) {
          liveResumed = await tryResumeLiveTrifangxFromSnapshot();
        }

        if (isTrifangxLiveDedicatedPage() && !liveResumed) {
          const no = document.createElement('div');
          no.id = 'trifangx-live-empty';
          no.setAttribute('role', 'status');
          no.style.cssText =
            'max-width:32rem;margin:2rem auto;padding:1.5rem 1.75rem;background:#1a1a24;color:#eee;border-radius:12px;font-family:system-ui,sans-serif;line-height:1.55;box-sizing:border-box;';
          no.innerHTML =
            '<h2 style="margin:0 0 0.75rem;font-size:1.25rem;font-weight:600;">No active live game</h2>' +
            '<p style="margin:0 0 1rem;opacity:0.92;">Start a game from the main lobby. This address is only for an in-progress engine game (reload is safe here).</p>' +
            '<p style="margin:0"><a href="chess_engine.html" style="color:#6cf;">Return to TrifangX lobby</a></p>';
          const btc = document.getElementById('board-timers-container');
          if (btc && btc.parentNode) {
            btc.parentNode.insertBefore(no, btc);
          } else {
            document.body.insertBefore(no, document.body.firstChild);
          }
        } else if (!liveResumed && !isHistoryReplayMode) {
          // Initialize game object for preview board
          game = new Chess();
          gameOver = false;
          playerColor = "white"; // Default for preview

          // Create preview board with dragging enabled
          board = Chessboard('board', {
            draggable: false,
            position: 'start',
            orientation: 'white',
            snapSpeed: 50,
            snapbackSpeed: 50,
            appearSpeed: 0,
            moveSpeed: 100,
            trashSpeed: 50,
            pieceTheme: pieceThemes[currentPieceStyle]
          });
          applyMoveEffect(currentMoveEffect);

          // Reset right-click handler flag
          const boardEl = document.getElementById('board');
          if (boardEl) {
            boardEl._rightClickHandlersInitialized = false;
          }

          // Ensure arrow overlay exists
          ensureArrowOverlay();

          // Initialize right-click handlers after board is created
          setTimeout(() => {
            const bel = document.getElementById('board');
            if (bel) {
              bel._rightClickHandlersInitialized = false; // Reset flag
            }
            ensureArrowOverlay(); // Ensure again after a delay
            initRightClickHandlers();
          }, 100);

          console.log('Preview board created with config:', {
            draggable: false
          });
        }

        if (!(isTrifangxLiveDedicatedPage() && !liveResumed)) {
          document.getElementById('board-timers-container').style.display = 'flex';
        }

        // Load sound settings
        const savedSound = localStorage.getItem('soundEnabled');
        if (savedSound !== null) {
          document.getElementById('sound-effects').checked = savedSound === 'true';
          soundEnabled = savedSound === 'true';
        }

        // Add event listener for sound toggle
        document.getElementById('sound-effects').addEventListener('change', function() {
          soundEnabled = this.checked;
          localStorage.setItem('soundEnabled', soundEnabled);
        });

        // Load statistics and achievements
        loadPlayerStats();
        loadAchievements();
        loadLifetimeStats();
        updatePlayerStatsDisplay();
        updateAchievementsDisplay();
        updateTotalPoints();
    });

        $(document).keydown(function(e) {
            if (board && moveHistory.length > 0 && (!blindfoldMode || isHistoryReplayMode)) {
                if (e.key === 'ArrowLeft' || e.keyCode === 37) {
                    e.preventDefault();
                    navigateToPreviousMove();
                } else if (e.key === 'ArrowRight' || e.keyCode === 39) {
                    e.preventDefault();
                    navigateToNextMove();
                } else if (e.key === 'ArrowUp' || e.keyCode === 38) {
                    e.preventDefault();
                    navigateToStart();
                } else if (e.key === 'ArrowDown' || e.keyCode === 40) {
                    e.preventDefault();
                    navigateToCurrent();
                }
            }
        });
    function formatTime(ms) {
      const t = Math.max(0, Math.floor(ms));
      const totalHundredths = Math.floor(t / 10);
      const minutes = String(Math.floor(totalHundredths / 6000)).padStart(2, "0");
      const seconds = String(Math.floor((totalHundredths % 6000) / 100)).padStart(2, "0");
      const hundredths = String(totalHundredths % 100).padStart(2, "0");
      return `${minutes}:${seconds}.${hundredths}`;
    }
    
    function updateClockStyles() {
        const turn = game.turn();
        const playerIsWhite = playerColor === 'white';
        
        // Determine which slot is the player's and which is the engine's
        const playerSlot = playerIsWhite ? document.getElementById("time-slot-white") : document.getElementById("time-slot-black");
        const engineSlot = playerIsWhite ? document.getElementById("time-slot-black") : document.getElementById("time-slot-white");
        
        // Remove active class from both
        playerSlot.classList.remove('time-active');
        engineSlot.classList.remove('time-active');

        // Add active class only to the player's clock when it's their turn
        if ((playerIsWhite && turn === 'w') || (!playerIsWhite && turn === 'b')) {
            playerSlot.classList.add('time-active');
        }
    }


    // MODIFIED: Timer always counts up, but only deducts time if it's the player's turn.
    // Optional resumeElapsedMs (from live snapshot) continues the move clock across reload.
    function startTimer(resumeElapsedMs) {
      clearInterval(timerInterval);
      const resume =
        typeof resumeElapsedMs === 'number' &&
        Number.isFinite(resumeElapsedMs) &&
        resumeElapsedMs > 0
          ? resumeElapsedMs
          : 0;
      timerStart = performance.now() - resume;
      const timerElNow = document.getElementById("timer");
      if (timerElNow) {
        timerElNow.textContent = formatTime(resume);
      }

      const turn = game.turn();
      const isPlayerTurn = (playerColor === "white" && turn === "w") || (playerColor === "black" && turn === "b");
      
      // Update clock styling (active state)
      updateClockStyles();

      // MODIFICATION START: Set player's time to its value and engine's time to "Unlimited"
      if (timeLimited) {
          // Determine element IDs and time references
          const playerTotalId = playerColor === 'white' ? "white-total" : "black-total";
          const engineTotalId = playerColor === 'white' ? "black-total" : "white-total";
          const playerTimeRef = playerColor === 'white' ? whiteTime : blackTime;
          
          // Set player's time display
          document.getElementById(playerTotalId).textContent = formatTime(playerTimeRef);
          
          // Set engine's time display to "Unlimited"
          document.getElementById(engineTotalId).textContent = "Unlimited";
      }
      // MODIFICATION END
      
      timerInterval = setInterval(() => {
          if (gameOver) {
              clearInterval(timerInterval);
              return;
          }

        const elapsed = performance.now() - timerStart;

        // 1. Always update the move timer display (Counts up)
        // Use requestAnimationFrame to ensure timer updates aren't blocked by DOM operations
        const timerEl = document.getElementById("timer");
        if (timerEl) {
          timerEl.textContent = formatTime(elapsed);
        }

        // 2. ONLY manage total time deduction/check if it's time limited AND the player's turn
        if (timeLimited && isPlayerTurn) {
            const totalTimeElementId = playerColor === 'white' ? "white-total" : "black-total";
            const playerTimeRef = playerColor === 'white' ? whiteTime : blackTime;
            
            const newTime = playerTimeRef - elapsed;

            // Update the player's total remaining time (countdown)
            const totalTimeEl = document.getElementById(totalTimeElementId);
            if (totalTimeEl) {
              totalTimeEl.textContent = formatTime(newTime);
            }
            
            if (newTime <= 0) {
                clearInterval(timerInterval);
                // Replaced alert() with UI message
                const moveContainer = document.getElementById("move-timer-container");
                if (moveContainer) {
                moveContainer.innerHTML = 'TIME OUT! <span style="color:red;">You lose!</span>';
                }
                gameOver = true;
                recordGameToCloudHistory(playerColor === 'white' ? '0-1' : '1-0');
                
      // Update statistics
      playerStats.losses++;
      savePlayerStats();
      updatePlayerStatsDisplay();
      resetDailyStatsIfNeeded();
      lifetimeStats.dailyStats.gamesPlayedToday++;
      const moveCount = game.history().length;
      if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
        lifetimeStats.dailyStats.longestGameToday = moveCount;
      }
      trackLossStats();
      commitGameStatsToLifetime();
      checkAndUnlockAchievements();
                notifyGameFinishedToEngine('loss');
                releaseEngineOnGameEnd();
                // Show rematch modal
                setTimeout(() => showRematchModal("⏰ Time Out", "You ran out of time! Play again?"), 1500);
            }
        }
      }, 10);
    }

    // UNMODIFIED Logic, only checking if the color that just moved was the player's color
    function stopTimerAndUpdateTotal(color) {
      clearInterval(timerInterval);
      // Snap to centiseconds (10 ms) so recorded move times match the UI clock granularity.
      const elapsed = Math.round((performance.now() - timerStart) / 10) * 10;
      if (timeLimited) {
        if (
          (color === "w" && playerColor === "white") ||
          (color === "b" && playerColor === "black")
          ) {
          if (color === "w") {
            whiteTime = Math.max(0, whiteTime - elapsed);
            whiteTime += increment * 1000;
            document.getElementById("white-total").textContent = formatTime(whiteTime);
          } else {
            blackTime = Math.max(0, blackTime - elapsed);
            blackTime += increment * 1000;
            document.getElementById("black-total").textContent = formatTime(blackTime);
          }
        }
      }
      const timerElStop = document.getElementById("timer");
      if (timerElStop) {
        timerElStop.textContent = formatTime(elapsed);
      }
      return elapsed;
    }

    /** Moves (SAN list) that have been played on the position currently shown on the board. */
    function getViewedHistorySlice() {
      if (!game) return [];
      const full = game.history();
      if (currentMoveIndex === -1) return full;
      if (currentMoveIndex === -2) return [];
      const end = Math.min(currentMoveIndex + 1, full.length);
      return full.slice(0, end);
    }

    /** chess.js instance matching the board view (replay uses move list; live uses `game`). */
    function getSidebarChess() {
      if (!game) return new Chess();
      if (currentMoveIndex === -1) return game;
      if (currentMoveIndex === -2) return new Chess();
      const full = game.history();
      const c = new Chess();
      const n = Math.min(currentMoveIndex + 1, full.length);
      for (let i = 0; i < n; i++) {
        if (!c.move(full[i])) break;
      }
      return c;
    }

    /** Captured-piece lists for the viewed ply (same encoding as `capturedPieces` during live play). */
    function getCapturedPiecesForView() {
      if (currentMoveIndex === -1) {
        return capturedPieces;
      }
      const n = currentMoveIndex === -2 ? 0 : currentMoveIndex + 1;
      const white = [];
      const black = [];
      const c = new Chess();
      const hist = game.history();
      for (let i = 0; i < n && i < hist.length; i++) {
        const mv = c.move(hist[i]);
        if (mv && mv.captured) {
          if (mv.color === 'w') {
            white.push('b' + mv.captured.toUpperCase());
          } else {
            black.push('w' + mv.captured.toUpperCase());
          }
        }
      }
      return { white, black };
    }

    function updateLastMoveDisplayForView() {
      const el = document.getElementById('last-move');
      if (!el || !game) return;
      if (currentMoveIndex === -1) {
        el.textContent = lastLiveMoveDisplayText;
        return;
      }
      if (currentMoveIndex === -2) {
        el.textContent = 'None';
        return;
      }
      const h = game.history();
      if (currentMoveIndex >= 0 && currentMoveIndex < h.length) {
        const san = h[currentMoveIndex];
        const t = moveClockTimes[currentMoveIndex];
        el.textContent = t != null && t !== '' ? `${san} (${t})` : san;
      } else {
        el.textContent = 'None';
      }
    }

    function refreshSidebarForViewedPosition() {
      if (!game) return;
      updateTurnDisplay();
      updateOpeningDisplay();
      updateGameStats();
      updateLastMoveDisplayForView();
    }

    function getFenForMoveIndex(index) {
      if (!game) return 'start';
      if (index === -2) return 'start';
      if (index === -1) return game.fen();
      return moveHistory[index] || game.fen();
    }

    function findKingSquareOnChessJs(chess) {
      if (!chess) return null;
      const turn = chess.turn();
      const b = chess.board();
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = b[i][j];
          if (piece && piece.type === 'k' && piece.color === turn) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            return files[j] + (8 - i);
          }
        }
      }
      return null;
    }

    function syncHistoryReplayHighlights() {
      if (!board || !game || !isHistoryReplayMode) return;
      $("#board .square-55d63").removeClass("highlight-last-move highlight-check");
      const vc = getSidebarChess();
      const histVerbose = game.history({ verbose: true });
      let idx = currentMoveIndex;
      if (idx === -2) {
        if (vc.in_check()) {
          const ks = findKingSquareOnChessJs(vc);
          if (ks) $("#board .square-" + ks).addClass("highlight-check");
        }
        return;
      }
      if (idx === -1) {
        idx = histVerbose.length - 1;
      }
      if (idx >= 0 && idx < histVerbose.length) {
        const lm = histVerbose[idx];
        highlightLastMove(lm.from, lm.to);
      }
      if (vc.in_check()) {
        const ks = findKingSquareOnChessJs(vc);
        if (ks) $("#board .square-" + ks).addClass("highlight-check");
      }
    }

    function ensureReplaySidebarPanelsVisible() {
      const show = ['move-timer-container', 'last-move-container', 'notation-container', 'game-stats-panel', 'player-stats-panel', 'achievements-panel'];
      show.forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'block';
      });
      const notEl = document.getElementById('notation-container');
      if (notEl) {
        notEl.classList.remove('blindfold-hidden');
        // Beat .blindfold-hidden { display: none !important } from blindfold games
        notEl.style.setProperty('display', 'block', 'important');
      }
      const flip = document.getElementById('flip-board-btn');
      if (flip) flip.style.display = 'block';
      const ex = document.getElementById('export-pgn-btn');
      if (ex) ex.style.display = 'block';
      const rs = document.getElementById('resign-btn');
      if (rs) rs.style.display = 'none';
    }

    function applyViewedPosition(index) {
      currentMoveIndex = index;
      if (board) {
        board.position(getFenForMoveIndex(index));
      }
      // Notation must render before refreshSidebarForViewedPosition: updateNotationDisplay()
      // clears the container first; if refresh throws, the list would stay empty.
      if (isHistoryReplayMode) {
        updateNotationDisplay();
        updateMoveHighlight();
        syncHistoryReplayHighlights();
      } else {
        updateMoveHighlight();
      }
      refreshSidebarForViewedPosition();
    }

    function navigateToPreviousMove() {
      if (!moveHistory.length) return;
      if (currentMoveIndex === -1) {
        if (moveHistory.length === 1) {
          applyViewedPosition(-2);
          return;
        }
        currentMoveIndex = moveHistory.length - 2;
        if (currentMoveIndex < 0) currentMoveIndex = 0;
        displayPositionAtIndex(currentMoveIndex);
      } else if (currentMoveIndex === 0) {
        applyViewedPosition(-2);
      } else if (currentMoveIndex > 0) {
        currentMoveIndex--;
        displayPositionAtIndex(currentMoveIndex);
      }
    }

    function navigateToNextMove() {
      if (!moveHistory.length) return;
      if (currentMoveIndex === -2) {
        currentMoveIndex = 0;
        displayPositionAtIndex(currentMoveIndex);
      } else if (currentMoveIndex === -1) {
        // If we're in replay mode and haven't actually stepped to the end yet,
        // the -1 state is a stuck-on-load artefact — recover by jumping to move 0.
        if (isHistoryReplayMode && !reachedReplayEnd) {
          currentMoveIndex = 0;
          displayPositionAtIndex(currentMoveIndex);
        }
        return;
      } else if (currentMoveIndex < moveHistory.length - 1) {
        currentMoveIndex++;
        displayPositionAtIndex(currentMoveIndex);
      } else if (currentMoveIndex === moveHistory.length - 1) {
        if (isHistoryReplayMode) reachedReplayEnd = true;
        applyViewedPosition(-1);
      }
    }

    function navigateToStart() {
      reachedReplayEnd = false;
      applyViewedPosition(-2);
    }

    function navigateToCurrent() {
      applyViewedPosition(-1);
    }

    function displayPositionAtIndex(index) {
      if (index >= 0 && index < moveHistory.length) {
        applyViewedPosition(index);
      }
    }

    function updateMoveHighlight() {
      $('#notation-container .notation-san').removeClass('highlighted');
      if (currentMoveIndex >= 0 && currentMoveIndex < moveHistory.length) {
        $(`#notation-container .notation-san[data-move-index="${currentMoveIndex}"]`).addClass('highlighted');
      }
    }

    function notationTimeText(moveIndex) {
      if (moveIndex < 0) return '—';
      const t = moveClockTimes[moveIndex];
      return t != null && t !== '' ? t : '—';
    }

    function updateNotationDisplay() {
      if (!game) return;
      let history;
      if (isHistoryReplayMode && historyReplayFullSan && historyReplayFullSan.length) {
        history = historyReplayFullSan.slice();
      } else {
        history = game.history();
      }
      const container = document.getElementById("notation-container");
      if (!container) return;
      container.innerHTML = '';
      const minHeight = 60;
      const maxHeight = 600;
      const rowStep = 44;
      const fullMoveRows = Math.max(1, Math.ceil(history.length / 2));
      let dynHeight = minHeight + Math.min(fullMoveRows * rowStep, maxHeight - minHeight);
      dynHeight = Math.max(minHeight, Math.min(dynHeight, maxHeight));
      container.style.minHeight = minHeight + 'px';
      container.style.height = dynHeight + 'px';
      container.style.maxHeight = maxHeight + 'px';

      for (let i = 0; i < history.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const row = document.createElement('div');
        row.className = 'notation-row';

        const numEl = document.createElement('span');
        numEl.className = 'notation-num';
        numEl.textContent = moveNum + '.';
        row.appendChild(numEl);

        const whiteMove = history[i];
        const whiteHi = currentMoveIndex === i || (currentMoveIndex === -1 && i === history.length - 1);
        const wSan = document.createElement('span');
        wSan.className = 'notation-san';
        if (whiteHi) wSan.classList.add('highlighted');
        wSan.textContent = whiteMove || '';
        wSan.setAttribute('data-move-index', String(i));
        wSan.setAttribute('title', 'White move');
        wSan.onclick = function() { jumpToMove(i); };
        row.appendChild(wSan);

        const blackMove = history[i + 1];
        const blackHi = blackMove && (currentMoveIndex === i + 1 || (currentMoveIndex === -1 && i + 1 === history.length - 1));
        const bSan = document.createElement('span');
        bSan.className = 'notation-san';
        if (blackMove) {
          if (blackHi) bSan.classList.add('highlighted');
          bSan.textContent = blackMove;
          bSan.setAttribute('data-move-index', String(i + 1));
          bSan.setAttribute('title', 'Black move');
          bSan.onclick = function() { jumpToMove(i + 1); };
        } else {
          bSan.classList.add('notation-san--empty');
          bSan.textContent = '';
        }
        row.appendChild(bSan);

        const spacer = document.createElement('span');
        spacer.className = 'notation-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        row.appendChild(spacer);

        const wTime = document.createElement('span');
        wTime.className = 'notation-time notation-time--white';
        wTime.textContent = whiteMove ? notationTimeText(i) : '—';
        if (!whiteMove) wTime.classList.add('notation-time--muted');
        wTime.setAttribute('title', 'Time on White move');
        row.appendChild(wTime);

        const bTime = document.createElement('span');
        bTime.className = 'notation-time notation-time--black';
        bTime.textContent = blackMove ? notationTimeText(i + 1) : '—';
        if (!blackMove) bTime.classList.add('notation-time--muted');
        bTime.setAttribute('title', 'Time on Black move');
        row.appendChild(bTime);

        container.appendChild(row);
      }
    }

    function jumpToMove(index) {
      if (index >= 0 && index < moveHistory.length && (!blindfoldMode || isHistoryReplayMode)) {
        applyViewedPosition(index);
      }
    }

    function updateLastMove(move, timeStr, color, move_number) {
      const txt = move ? `${move} (${timeStr})` : "None";
      document.getElementById("last-move").textContent = txt;
      lastLiveMoveDisplayText = txt;

      if (move) {
        moveHistory.push(game.fen());
        moveClockTimes.push(timeStr != null && timeStr !== '' ? timeStr : '00:00.00');
        currentMoveIndex = -1;
        updateNotationDisplay();
      }
}

    function updateTurnDisplay() {
      if (!game) return;
      const vc = getSidebarChess();
      document.getElementById("turn-color").textContent = vc.turn() === "w" ? "White" : "Black";
    }

    function highlightLegalMoves(square) {
      const moves = game.moves({ square, verbose: true });
      for (const move of moves) {
        $(`#board .square-${move.to}`).addClass("highlight-legal");
      }
    }

    function removeHighlights() {
      // Don't remove highlights if a piece is selected for click-to-move
      if (!selectedSquare) {
        $("#board .square-55d63").removeClass("highlight-legal");
      }
      // Don't remove premove highlights here - they're managed separately
    }

    // Right-click highlighting and arrow functions
    function getSquareFromElement(element) {
      // Traverse up the DOM to find the square element
      let el = element;
      let maxDepth = 10; // Prevent infinite loops
      let depth = 0;
      
      while (el && el.id !== 'board' && depth < maxDepth) {
        depth++;
        
        // Check if this element is a square div
        if (el.classList && el.classList.contains('square-55d63')) {
          // Method 1: Try to get square name from data attribute
          if (el.dataset && el.dataset.square) {
            return el.dataset.square;
          }
          
          // Method 2: Try to get from jQuery data
          const $el = $(el);
          const jqData = $el.data('square');
          if (jqData) {
            return jqData;
          }
          
          // Method 3: Extract from class names (e.g., "square-e2")
          const classes = el.className.split(/\s+/);
          for (const cls of classes) {
            if (cls.startsWith('square-') && cls !== 'square-55d63') {
              const squareName = cls.replace('square-', '');
              // Validate it's a valid square name (a-h, 1-8)
              if (squareName.length === 2 && 
                  squareName[0] >= 'a' && squareName[0] <= 'h' &&
                  squareName[1] >= '1' && squareName[1] <= '8') {
                return squareName;
              }
            }
          }
          
          // Method 4: Try to get from ID attribute
          if (el.id && el.id.startsWith('square-')) {
            const squareName = el.id.replace('square-', '');
            if (squareName.length === 2 && 
                squareName[0] >= 'a' && squareName[0] <= 'h' &&
                squareName[1] >= '1' && squareName[1] <= '8') {
              return squareName;
            }
          }
        }
        el = el.parentElement;
      }
      return null;
    }

    function toggleSquareHighlight(square) {
      if (!square) return;
      
      const squareEl = $(`#board .square-${square}`);
      if (squareEl.length === 0) return;
      
      if (rightClickHighlightedSquares.has(square)) {
        // Remove highlight
        squareEl.removeClass('right-click-highlight');
        rightClickHighlightedSquares.delete(square);
        
        // Clear interval if no more highlights
        if (rightClickHighlightedSquares.size === 0 && rightClickHighlightInterval) {
          clearInterval(rightClickHighlightInterval);
          rightClickHighlightInterval = null;
        }
      } else {
        // Add highlight - use same approach as premove to ensure colors match
        squareEl.addClass('right-click-highlight');
        rightClickHighlightedSquares.add(square);
        
        // Set up interval to continuously reapply highlights (like premove does)
        // Use longer interval to reduce interference with timer
        if (!rightClickHighlightInterval) {
          rightClickHighlightInterval = setInterval(() => {
            if (rightClickHighlightedSquares.size === 0) {
              clearInterval(rightClickHighlightInterval);
              rightClickHighlightInterval = null;
              return;
            }
            // Reapply all highlights - use requestAnimationFrame to avoid blocking timer
            requestAnimationFrame(() => {
              rightClickHighlightedSquares.forEach(sq => {
                const el = $(`#board .square-${sq}`);
                if (el.length > 0) {
                  el.addClass('right-click-highlight');
                }
              });
            });
          }, 200);
        }
      }
    }

    // Check if a move is a knight move
    function isKnightMove(from, to) {
      const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);
      const fromRank = parseInt(from[1]) - 1;
      const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
      const toRank = parseInt(to[1]) - 1;
      
      const fileDiff = Math.abs(toFile - fromFile);
      const rankDiff = Math.abs(toRank - fromRank);
      
      return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
    }

    function ensureArrowOverlay() {
      const boardEl = document.getElementById('board');
      if (!boardEl) return false;
      
      let overlayEl = document.getElementById('arrow-overlay');
      if (!overlayEl) {
        overlayEl = document.createElement('div');
        overlayEl.id = 'arrow-overlay';
        boardEl.appendChild(overlayEl);
      }
      
      let svg = document.getElementById('arrow-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'arrow-svg';
        overlayEl.appendChild(svg);
      }
      
      return true;
    }

    function drawArrows() {
      // Ensure overlay exists before trying to use it
      if (!ensureArrowOverlay()) {
        return;
      }
      
      const svg = document.getElementById('arrow-svg');
      if (!svg) {
        return;
      }
      
      const overlayEl = document.getElementById('arrow-overlay');
      if (!overlayEl) {
        return;
      }
      
      // Clear existing arrows but keep defs
      const defs = svg.querySelector('defs');
      svg.innerHTML = '';
      if (defs) {
        svg.appendChild(defs);
      }
      
      const boardEl = document.getElementById('board');
      if (!boardEl) {
        return;
      }
      
      const boardRect = boardEl.getBoundingClientRect();
      
      // Set SVG viewBox and dimensions to match board
      svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
      svg.setAttribute('width', boardRect.width);
      svg.setAttribute('height', boardRect.height);
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.pointerEvents = 'none';
      
      const squareSize = boardRect.width / 8;
      
      // Create arrowhead marker if it doesn't exist
      let defsEl = svg.querySelector('defs');
      if (!defsEl) {
        defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.appendChild(defsEl);
      }
      
      // Create rainbow gradient if rainbow mode is enabled
      if (window.rainbowMode) {
        // Clear old rainbow gradients
        const oldGrads = defsEl.querySelectorAll('[id^="rainbow-gradient-"]');
        oldGrads.forEach(g => g.remove());
        // Start animation if not already running
        if (!window.rainbowArrowAnim && arrows.length > 0) {
          let offset = 0;
          window.rainbowArrowAnim = setInterval(() => {
            offset = (offset + 1) % 100;
            const grads = defsEl.querySelectorAll('[id^="rainbow-gradient-"]');
            grads.forEach(grad => {
              const stops = grad.querySelectorAll('stop');
              stops.forEach((stop, i) => {
                const baseOffset = (i * 100 / (stops.length - 1));
                const newOffset = (baseOffset + offset) % 100;
                stop.setAttribute('offset', newOffset + '%');
              });
            });
          }, 100);
        }
      } else {
        // Clear rainbow animation if disabled
        if (window.rainbowArrowAnim) {
          clearInterval(window.rainbowArrowAnim);
          window.rainbowArrowAnim = null;
        }
      }
      
      let marker = svg.querySelector('#arrowhead');
      if (!marker) {
        marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '3');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('refX', '3');
        marker.setAttribute('refY', '4');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('viewBox', '0 0 8 8');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        // Arrowhead that extends seamlessly from line: base width matches line stroke-width (8)
        // Base at x=0 spans from y=0 to y=8 (8 units wide, matching stroke-width)
        // Point at x=6, y=4 (forward direction)
        polygon.setAttribute('points', '0 0, 0 8, 6 4');
        polygon.setAttribute('fill', window.currentArrowFillColor || 'rgba(250, 180, 0, 1)');
        polygon.setAttribute('stroke', 'none');
        marker.appendChild(polygon);
        defsEl.appendChild(marker);
      } else {
        // Update existing marker color
        const polygon = marker.querySelector('polygon');
        if (polygon) {
          polygon.setAttribute('fill', window.currentArrowFillColor || 'rgba(250, 180, 0, 1)');
        }
      }
      
      if (arrows.length === 0) {
        return;
      }
      
      arrows.forEach((arrow, index) => {
        const fromSquare = $(`#board .square-${arrow.from}`);
        const toSquare = $(`#board .square-${arrow.to}`);
        
        if (fromSquare.length === 0 || toSquare.length === 0) {
          return;
        }
        
        const fromRect = fromSquare[0].getBoundingClientRect();
        const toRect = toSquare[0].getBoundingClientRect();
        
        // Calculate center points relative to board (overlay is positioned at 0,0 relative to board)
        const fromX = (fromRect.left - boardRect.left) + fromRect.width / 2;
        const fromY = (fromRect.top - boardRect.top) + fromRect.height / 2;
        const toX = (toRect.left - boardRect.left) + toRect.width / 2;
        const toY = (toRect.top - boardRect.top) + toRect.height / 2;
        
        console.log(`  Coordinates: from (${fromX}, ${fromY}) to (${toX}, ${toY})`);
        
        // Check if it's a knight move
        if (isKnightMove(arrow.from, arrow.to)) {
          // Draw L-shaped arrow for knight moves
          const fromFile = arrow.from.charCodeAt(0) - 'a'.charCodeAt(0);
          const fromRank = parseInt(arrow.from[1]) - 1;
          const toFile = arrow.to.charCodeAt(0) - 'a'.charCodeAt(0);
          const toRank = parseInt(arrow.to[1]) - 1;
          
          const fileDiff = toFile - fromFile;
          const rankDiff = toRank - fromRank;
          
          // Determine which direction to go first (file or rank)
          // Go horizontally first if |fileDiff| > |rankDiff|, otherwise vertically first
          let midX, midY;
          if (Math.abs(fileDiff) > Math.abs(rankDiff)) {
            // Go horizontally first
            midX = toX;
            midY = fromY;
          } else {
            // Go vertically first
            midX = fromX;
            midY = toY;
          }
          
          // Adjust start/end points to be at square edges
          const dx1 = midX - fromX;
          const dy1 = midY - fromY;
          const angle1 = Math.atan2(dy1, dx1);
          const adjustedFromX = fromX + Math.cos(angle1) * (squareSize / 2 - 5);
          const adjustedFromY = fromY + Math.sin(angle1) * (squareSize / 2 - 5);
          
          const dx2 = toX - midX;
          const dy2 = toY - midY;
          const angle2 = Math.atan2(dy2, dx2);
          // Line ends where arrowhead tip will be - extend line further into square
          const adjustedToX = toX - Math.cos(angle2) * (squareSize / 2 - 15);
          const adjustedToY = toY - Math.sin(angle2) * (squareSize / 2 - 15);
          
          // Create L-shaped path
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const pathData = `M ${adjustedFromX} ${adjustedFromY} L ${midX} ${midY} L ${adjustedToX} ${adjustedToY}`;
          path.setAttribute('d', pathData);
          
          // Create rainbow gradient for this arrow if in rainbow mode
          let arrowColor = window.currentArrowColor || 'rgba(250, 180, 0, 0.7)';
          if (window.rainbowMode) {
            const gradId = `rainbow-gradient-${index}`;
            let grad = defsEl.querySelector(`#${gradId}`);
            if (!grad) {
              grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
              grad.setAttribute('id', gradId);
              grad.setAttribute('gradientUnits', 'userSpaceOnUse');
              const stops = [
                { offset: '0%', color: '#ff0000' },
                { offset: '16.66%', color: '#ff7f00' },
                { offset: '33.33%', color: '#ffff00' },
                { offset: '50%', color: '#00ff00' },
                { offset: '66.66%', color: '#0000ff' },
                { offset: '83.33%', color: '#4b0082' },
                { offset: '100%', color: '#9400d3' }
              ];
              stops.forEach(s => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttribute('offset', s.offset);
                stop.setAttribute('stop-color', s.color);
                grad.appendChild(stop);
              });
              defsEl.appendChild(grad);
            }
            // Set gradient along the arrow direction (use the main segment)
            const segDx = adjustedToX - adjustedFromX;
            const segDy = adjustedToY - adjustedFromY;
            const segLen = Math.sqrt(segDx * segDx + segDy * segDy);
            grad.setAttribute('x1', adjustedFromX.toString());
            grad.setAttribute('y1', adjustedFromY.toString());
            grad.setAttribute('x2', (adjustedFromX + segDx).toString());
            grad.setAttribute('y2', (adjustedFromY + segDy).toString());
            arrowColor = `url(#${gradId})`;
            // Update arrowhead fill too
            const markerPoly = marker.querySelector('polygon');
            if (markerPoly) markerPoly.setAttribute('fill', arrowColor);
          }
          
          path.setAttribute('stroke', arrowColor);
          path.setAttribute('stroke-width', '10');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', 'url(#arrowhead)');
          svg.appendChild(path);
        } else {
          // Draw straight arrow for non-knight moves
          const dx = toX - fromX;
          const dy = toY - fromY;
          const angle = Math.atan2(dy, dx);
          
          // Adjust start/end points to be at square edges
          const adjustedFromX = fromX + Math.cos(angle) * (squareSize / 2 - 5);
          const adjustedFromY = fromY + Math.sin(angle) * (squareSize / 2 - 5);
          const adjustedToX = toX - Math.cos(angle) * (squareSize / 2 - 15);
          const adjustedToY = toY - Math.sin(angle) * (squareSize / 2 - 15);
          
          // Create path for arrow line
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          const pathData = `M ${adjustedFromX} ${adjustedFromY} L ${adjustedToX} ${adjustedToY}`;
          path.setAttribute('d', pathData);
          
          // Create rainbow gradient for this arrow if in rainbow mode
          let arrowColor = window.currentArrowColor || 'rgba(250, 180, 0, 0.7)';
          if (window.rainbowMode) {
            const gradId = `rainbow-gradient-${index}`;
            let grad = defsEl.querySelector(`#${gradId}`);
            if (!grad) {
              grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
              grad.setAttribute('id', gradId);
              grad.setAttribute('gradientUnits', 'userSpaceOnUse');
              const stops = [
                { offset: '0%', color: '#ff0000' },
                { offset: '16.66%', color: '#ff7f00' },
                { offset: '33.33%', color: '#ffff00' },
                { offset: '50%', color: '#00ff00' },
                { offset: '66.66%', color: '#0000ff' },
                { offset: '83.33%', color: '#4b0082' },
                { offset: '100%', color: '#9400d3' }
              ];
              stops.forEach(s => {
                const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
                stop.setAttribute('offset', s.offset);
                stop.setAttribute('stop-color', s.color);
                grad.appendChild(stop);
              });
              defsEl.appendChild(grad);
            }
            // Set gradient along the arrow direction
            grad.setAttribute('x1', adjustedFromX.toString());
            grad.setAttribute('y1', adjustedFromY.toString());
            grad.setAttribute('x2', adjustedToX.toString());
            grad.setAttribute('y2', adjustedToY.toString());
            arrowColor = `url(#${gradId})`;
            // Update arrowhead fill too
            const markerPoly = marker.querySelector('polygon');
            if (markerPoly) markerPoly.setAttribute('fill', arrowColor);
          }
          
          path.setAttribute('stroke', arrowColor);
          path.setAttribute('stroke-width', '10');
          path.setAttribute('fill', 'none');
          path.setAttribute('marker-end', 'url(#arrowhead)');
          svg.appendChild(path);
        }
      });
    }

    function clearRightClickHighlights() {
      rightClickHighlightedSquares.forEach(square => {
        $(`#board .square-${square}`).removeClass('right-click-highlight');
      });
      rightClickHighlightedSquares.clear();
      
      // Clear interval
      if (rightClickHighlightInterval) {
        clearInterval(rightClickHighlightInterval);
        rightClickHighlightInterval = null;
      }
    }

    function clearArrows() {
      arrows = [];
      drawArrows();
    }

    function tearDownRightClickHandlers() {
      const h = window.__trifangxRCH;
      if (!h) return;
      if (h.arrowRedrawTimeout) {
        clearTimeout(h.arrowRedrawTimeout);
        h.arrowRedrawTimeout = null;
      }
      if (h.arrowObserver) {
        try {
          h.arrowObserver.disconnect();
        } catch (e) {}
        h.arrowObserver = null;
      }
      if (h.preventContextMenu) {
        document.removeEventListener('contextmenu', h.preventContextMenu, true);
        h.preventContextMenu = null;
      }
      if (h.handleRightClickUp) {
        document.removeEventListener('mouseup', h.handleRightClickUp, true);
        h.handleRightClickUp = null;
      }
      if (h.clearLeftClickDoc) {
        document.removeEventListener('click', h.clearLeftClickDoc, true);
        h.clearLeftClickDoc = null;
      }
      if (h.boardMousedownHandler && h.boardEl) {
        try {
          h.boardEl.removeEventListener('mousedown', h.boardMousedownHandler, true);
        } catch (e2) {}
      }
      h.boardMousedownHandler = null;
      h.boardEl = null;
    }

    function initRightClickHandlers() {
      tearDownRightClickHandlers();
      if (!window.__trifangxRCH) window.__trifangxRCH = {};
      const h = window.__trifangxRCH;
      h.arrowRedrawTimeout = null;

      const boardEl = document.getElementById('board');
      if (!boardEl) return;
      h.boardEl = boardEl;

      h.preventContextMenu = function (e) {
        const target = e.target;
        if (boardEl.contains(target) || target.closest('#board')) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };
      document.addEventListener('contextmenu', h.preventContextMenu, true);

      h.boardMousedownHandler = function (e) {
        if (e.button === 2) {
          const isGameStarted = document.getElementById('choose-side').style.display === 'none';
          if (!isGameStarted) {
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          const square = getSquareFromElement(e.target);
          if (square) {
            isRightClickDragging = true;
            rightClickStartSquare = square;
          }
        }
      };
      boardEl.addEventListener('mousedown', h.boardMousedownHandler, true);

      h.handleRightClickUp = function (e) {
        if (e.button === 2) {
          e.preventDefault();
          e.stopPropagation();

          if (isRightClickDragging && rightClickStartSquare) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            let square = null;
            for (const el of elements) {
              square = getSquareFromElement(el);
              if (square) break;
            }

            if (square && square !== rightClickStartSquare) {
              const arrowKey = `${rightClickStartSquare}-${square}`;
              const existingIndex = arrows.findIndex((a) => `${a.from}-${a.to}` === arrowKey);

              if (existingIndex >= 0) {
                arrows.splice(existingIndex, 1);
              } else {
                arrows.push({ from: rightClickStartSquare, to: square });
              }
              setTimeout(() => {
                drawArrows();
              }, 10);
            } else if (square === rightClickStartSquare) {
              const isGameStarted = document.getElementById('choose-side').style.display === 'none';
              if (isGameStarted) {
                toggleSquareHighlight(square);
              }
            }
          }

          isRightClickDragging = false;
          rightClickStartSquare = null;

          setTimeout(() => {
            drawArrows();
          }, 10);
        }
      };
      document.addEventListener('mouseup', h.handleRightClickUp, true);

      h.arrowObserver = new MutationObserver(function () {
        if (h.arrowRedrawTimeout) {
          clearTimeout(h.arrowRedrawTimeout);
        }
        h.arrowRedrawTimeout = setTimeout(() => {
          drawArrows();
          h.arrowRedrawTimeout = null;
        }, 150);
      });
      h.arrowObserver.observe(boardEl, { childList: true, subtree: true });

      h.clearLeftClickDoc = function (e) {
        if (e.button !== 0) return;
        const target = e.target;
        if (
          target.closest('#choose-side') ||
          target.closest('button') ||
          target.closest('select') ||
          target.closest('input')
        ) {
          return;
        }
        clearRightClickHighlights();
        clearArrows();
      };
      document.addEventListener('click', h.clearLeftClickDoc, true);

      boardEl._rightClickHandlersInitialized = true;
    }

    function disconnectTrifangxImgDragObserver() {
      if (window.__trifangxImgDragObserver) {
        try {
          window.__trifangxImgDragObserver.disconnect();
        } catch (e) {}
        window.__trifangxImgDragObserver = null;
      }
    }

    function isPremoveLegal(from, to, piece) {
      // Validate if a premove would be theoretically legal for this piece type
      // on an empty board (or for pawns, with diagonal capture squares occupied)
      
      const fromFile = from.charCodeAt(0) - 'a'.charCodeAt(0);
      const fromRank = parseInt(from[1]) - 1;
      const toFile = to.charCodeAt(0) - 'a'.charCodeAt(0);
      const toRank = parseInt(to[1]) - 1;
      
      const fileDiff = Math.abs(toFile - fromFile);
      const rankDiff = Math.abs(toRank - fromRank);
      const fileDir = toFile - fromFile;
      const rankDir = toRank - fromRank;
      
      const pieceType = piece.type;
      const pieceColor = piece.color;
      
      switch(pieceType) {
        case 'p': // Pawn
          const direction = pieceColor === 'w' ? 1 : -1;
          const startRank = pieceColor === 'w' ? 1 : 6;
          
          // Forward one square
          if (fileDir === 0 && rankDir === direction) return true;
          
          // Forward two squares from starting position
          if (fileDir === 0 && rankDir === 2 * direction && fromRank === startRank) return true;
          
          // Diagonal capture (always allow for premoves since we assume piece could be there)
          if (fileDiff === 1 && rankDir === direction) return true;
          
          return false;
          
        case 'n': // Knight
          return (fileDiff === 2 && rankDiff === 1) || (fileDiff === 1 && rankDiff === 2);
          
        case 'b': // Bishop
          return fileDiff === rankDiff && fileDiff > 0;
          
        case 'r': // Rook
          return (fileDiff === 0 && rankDiff > 0) || (rankDiff === 0 && fileDiff > 0);
          
        case 'q': // Queen
          return (fileDiff === rankDiff && fileDiff > 0) || // Diagonal
                 (fileDiff === 0 && rankDiff > 0) ||        // Vertical
                 (rankDiff === 0 && fileDiff > 0);          // Horizontal
          
        case 'k': // King
          return fileDiff <= 1 && rankDiff <= 1 && (fileDiff > 0 || rankDiff > 0);
          
        default:
          return false;
      }
    }

    function clearPremove() {
      // Clear highlighting interval
      if (premoveHighlightInterval) {
        clearInterval(premoveHighlightInterval);
        premoveHighlightInterval = null;
      }
      
      if (premoves.length > 0 && board) {
        // Restore board position when clearing premoves since we actually moved pieces
        board.position(game.fen());
      }
      premoves = [];
      selectedSquare = null;
      // Clear premove highlights
      $("#board .square-55d63").removeClass("premove-highlight premove-source");
    }
    
    // Helper function to update board visual with all premoves applied
    function updatePremoveVisual() {
      if (!board || !game) return;
      
      // Clear any existing interval
      if (premoveHighlightInterval) {
        clearInterval(premoveHighlightInterval);
        premoveHighlightInterval = null;
      }
      
      if (premoves.length === 0) {
        // Reset board to actual game position
        board.position(game.fen());
        // Clear all premove highlights
        $("#board .square-55d63").removeClass("premove-highlight premove-source");
        return;
      }
      
      // Always start from the actual game position
      // First, reset board to actual game position to get clean state
      board.position(game.fen());
      
      // Use requestAnimationFrame to ensure board has updated, then apply premoves
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const pos = board.position();
          if (!pos || Object.keys(pos).length === 0) {
            // If position is empty, try to get it directly from game.fen() by setting it again
            board.position(game.fen());
            setTimeout(() => updatePremoveVisual(), 50);
            return;
          }
          
          // Create a deep copy of the position object
          const newPos = {};
          for (const square in pos) {
            newPos[square] = pos[square];
          }
          
          // Track all squares involved in premoves for highlighting
          const highlightSquares = [];
          
          // Manually apply all premoves to show them visually
          // For each premove in sequence, move the piece from source to destination
          for (const pm of premoves) {
            const piece = newPos[pm.from];
            if (piece) {
              // Remove piece from source
              delete newPos[pm.from];
              // Place piece on destination (overwriting anything there, as premoves can capture)
              newPos[pm.to] = piece;
              // Track squares for highlighting (both source and destination)
              highlightSquares.push({ from: pm.from, to: pm.to });
            }
          }
          
          // Update board to show all premoves
          board.position(newPos);
          
          // Function to apply highlights - will be called repeatedly
          const applyHighlights = () => {
            // Clear all highlights first
            $("#board .square-55d63").removeClass("premove-highlight premove-source");
            
            // Apply highlights to all premove squares
            for (const sq of highlightSquares) {
              const fromSquare = $(`#board .square-${sq.from}`);
              const toSquare = $(`#board .square-${sq.to}`);
              
              if (fromSquare.length > 0) {
                fromSquare.addClass("premove-source");
              }
              if (toSquare.length > 0) {
                toSquare.addClass("premove-highlight");
              }
            }
          };
          
          // Apply highlights immediately, then set up interval to keep them applied
            applyHighlights();
            
            // Set up interval to continuously reapply highlights (they may be cleared by board updates)
          // Use longer interval to reduce interference with timer
            premoveHighlightInterval = setInterval(() => {
              if (premoves.length === 0) {
                clearInterval(premoveHighlightInterval);
                premoveHighlightInterval = null;
                board.position(game.fen());
                $("#board .square-55d63").removeClass("premove-highlight premove-source");
                return;
              }
            // Use requestAnimationFrame to avoid blocking timer updates
            requestAnimationFrame(() => {
              applyHighlights();
            });
          }, 200);
          
          // Also apply highlights after next frame to ensure they stick
          requestAnimationFrame(() => {
            applyHighlights();
          });
        });
      });
    }

    function handleSquareClick(square) {
      console.log('=== handleSquareClick START ===', square);
      const turn = game.turn();
      const isPlayerTurn = (playerColor === "white" && turn === "w") || (playerColor === "black" && turn === "b");
      const piece = game.get(square);  // Use game.get() to get piece from game state
      console.log('Turn:', turn, 'isPlayerTurn:', isPlayerTurn, 'piece:', piece, 'selectedSquare:', selectedSquare);
      
      // If there's a selected piece
      if (selectedSquare) {
        // If clicking the same square, deselect
        if (selectedSquare === square) {
          selectedSquare = null;
          removeHighlights();
          return;
        }
        
        // Check if this is a legal move or premove
        if (!isPlayerTurn) {
          // Make premove via click - allow any destination including recapturing own pieces
          // (might be currently illegal but could become legal after opponent moves)
          const premoveFrom = selectedSquare;
          const premoveTo = square;
          
          // Verify there's a piece at the source that belongs to the player
          const sourcePiece = game.get(premoveFrom);
          if (!sourcePiece || sourcePiece.color !== (playerColor === 'white' ? 'w' : 'b')) {
            selectedSquare = null;
            removeHighlights();
            return;
          }
          
          // Validate premove is theoretically legal for this piece type
          if (!isPremoveLegal(premoveFrom, premoveTo, sourcePiece)) {
            console.log('Premove not valid for piece type:', sourcePiece.type, premoveFrom, '->', premoveTo);
            selectedSquare = null;
            removeHighlights();
            return;
          }
          
          selectedSquare = null;
          removeHighlights();
          
          // Add new premove to the array (chain of premoves)
          const newPremove = { from: premoveFrom, to: premoveTo };
          premoves.push(newPremove);
          premoveJustSet = true;
          console.log('Premove added via click:', newPremove, 'Total premoves:', premoves.length);
          
          // Update visual to show all premoves in the chain
          updatePremoveVisual();
          return;
        } else {
          // Try to make a normal move
          const moveFrom = selectedSquare;
          const moveTo = square;
          console.log('Attempting move from', moveFrom, 'to', moveTo);
          const testMove = game.move({ from: moveFrom, to: moveTo, promotion: 'q' });
          console.log('Test move result:', testMove);
          
          if (testMove) {
            // Legal move - undo the test move, then execute properly
            game.undo();
            clearPremove();
            selectedSquare = null;
            removeHighlights();
            console.log('Calling handleMove');
            
            // Check if this is a promotion move
            if (isPromotionMove(moveFrom, moveTo)) {
              showPromotionModal(moveFrom, moveTo);
            } else {
            handleMove(moveFrom, moveTo);
            }
            return;
          } else if (piece) {
            const pieceColorFull = piece.color === 'w' ? 'white' : 'black';
            if (pieceColorFull === playerColor) {
              // Illegal move but clicked on own piece - change selection
              console.log('Switching selection to', square);
              // Clear old highlights before selecting new piece
              $("#board .square-55d63").removeClass("highlight-legal");
              selectedSquare = square;
              highlightLegalMoves(square);
              return;
            }
          }
          
          // Invalid move, deselect
          console.log('Invalid move, deselecting');
          selectedSquare = null;
          removeHighlights();
          return;
        }
      }
      
      // No piece selected - select clicked piece if valid
      if (piece) {
        const pieceColorFull = piece.color === 'w' ? 'white' : 'black';
        if (pieceColorFull === playerColor) {
          // Allow selecting own pieces even during opponent's turn (for premoves)
          console.log('Setting selectedSquare to:', square);
          // Clear old highlights before selecting new piece
          $("#board .square-55d63").removeClass("highlight-legal");
          selectedSquare = square;
          highlightLegalMoves(square);
          console.log('After setting, selectedSquare is:', selectedSquare);
        }
      } else {
        // Clicked on empty square with no piece selected
        // Cancel all premoves if it's the opponent's turn (when premoves can be set)
        if (!isPlayerTurn && premoves.length > 0) {
          console.log('Empty square clicked during opponent turn, canceling all premoves');
          clearPremove();
        }
      }
    }

    function detectOpening() {
      if (!game) return null;
      const slice = getViewedHistorySlice();
      let movesStr = slice.join(" ");
      
      // Check for exact matches, starting with longest sequences
      const sortedOpenings = Object.keys(openingBook).sort((a, b) => b.length - a.length);
      
      for (let opening of sortedOpenings) {
        if (movesStr.startsWith(opening)) {
          return openingBook[opening];
        }
      }
      
      return null;
    }

    function updateOpeningDisplay() {
      const openingNameEl = document.getElementById("opening-name");
      const openingWrap = document.getElementById("opening-display");
      if (!openingNameEl || !openingWrap || !game) return;

      const slice = getViewedHistorySlice();
      const opening = detectOpening();

      if (opening) {
        openingNameEl.textContent = opening;
        openingWrap.style.display = "block";
      } else if (slice.length > 10) {
        openingNameEl.textContent = "General Position";
        openingWrap.style.display = "block";
      } else if (slice.length === 0) {
        openingNameEl.textContent = "Starting position";
        openingWrap.style.display = "block";
      } else {
        openingNameEl.textContent = "—";
        openingWrap.style.display = "block";
      }
    }

    function highlightLastMove(from, to) {
      // Remove previous highlights
      $("#board .square-55d63").removeClass("highlight-last-move");
      
      // Add new highlights
      if (from && to) {
        $("#board .square-" + from).addClass("highlight-last-move");
        $("#board .square-" + to).addClass("highlight-last-move");
      }
    }

    function highlightCheck() {
      // Remove previous check highlights
      $("#board .square-55d63").removeClass("highlight-check");
      
      if (game.in_check()) {
        const turn = game.turn();
        const kingSquare = findKingSquare(turn);
        if (kingSquare) {
          $("#board .square-" + kingSquare).addClass("highlight-check");
        }
      }
    }

    function findKingSquare(color) {
      const board = game.board();
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = board[i][j];
          if (piece && piece.type === 'k' && piece.color === color) {
            const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
            return files[j] + (8 - i);
          }
        }
      }
      return null;
    }

    function updateGameStats() {
      const vc = getSidebarChess();
      const moveCount = getViewedHistorySlice().length;

      // Update captured pieces display (for the viewed ply)
      updateCapturedPieces();

      // Calculate and update material balance from viewed position
      updateMaterialBalance(vc);

      // Update game phase - more accurate detection
      const phaseEl = document.getElementById("game-phase");
      if (!phaseEl) return;
      
      // Count pieces and check game state for more accurate phase detection
      const boardState = vc.board();
      let pieceCount = 0;
      let queenCount = 0;
      let rookCount = 0;
      
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = boardState[i][j];
          if (piece) {
            pieceCount++;
            if (piece.type === 'q') queenCount++;
            else if (piece.type === 'r') rookCount++;
          }
        }
      }
      
      // More accurate phase detection
      // Opening: first 15-20 moves, most pieces still on board, queens present
      // Middlegame: pieces developed, material exchanges happening, queens usually still present
      // Endgame: few pieces left, queens often traded, or very low material
      if (pieceCount <= 12 || (queenCount === 0 && pieceCount <= 18)) {
        // Endgame: very few pieces or queens traded with low material
        phaseEl.textContent = "Endgame";
        phaseEl.style.color = "#e74c3c";
      } else if (moveCount >= 20 && pieceCount > 20 && queenCount > 0) {
        // Middlegame: enough moves played, good material, queens present
        phaseEl.textContent = "Middlegame";
        phaseEl.style.color = "#2ecc71";
      } else if (moveCount >= 15 && (pieceCount <= 20 || rookCount >= 2)) {
        // Transition to middlegame: pieces developed or material exchanges
        phaseEl.textContent = "Middlegame";
        phaseEl.style.color = "#2ecc71";
      } else {
        // Opening: early game, most pieces on board
        phaseEl.textContent = "Opening";
        phaseEl.style.color = "#3498db";
      }
      
      // Update pieces count display
      const piecesCountEl = document.getElementById("pieces-count");
      if (piecesCountEl) piecesCountEl.textContent = pieceCount;
      
      // Update check status
      const checkEl = document.getElementById("check-status");
      if (checkEl) {
        if (vc.in_check()) {
          const turn = vc.turn();
          checkEl.textContent = turn === 'w' ? "White in Check" : "Black in Check";
          checkEl.style.color = "#e74c3c";
          checkEl.style.fontWeight = "700";
        } else {
          checkEl.textContent = "None";
          checkEl.style.color = "#7f8c8d";
          checkEl.style.fontWeight = "500";
        }
      }
      
      // Update castling rights
      const fen = vc.fen();
      const castlingRights = fen.split(' ')[2];
      const castlingEl = document.getElementById("castling-rights");
      if (!castlingEl) return;
      if (castlingRights === '-') {
        castlingEl.textContent = "None";
        castlingEl.style.color = "#7f8c8d";
      } else {
        const whiteCanCastle = castlingRights.includes('K') || castlingRights.includes('Q');
        const blackCanCastle = castlingRights.includes('k') || castlingRights.includes('q');
        if (whiteCanCastle && blackCanCastle) {
          castlingEl.textContent = "Both";
          castlingEl.style.color = "#2ecc71";
        } else if (whiteCanCastle) {
          castlingEl.textContent = "White Only";
          castlingEl.style.color = "#3498db";
        } else if (blackCanCastle) {
          castlingEl.textContent = "Black Only";
          castlingEl.style.color = "#34495e";
        } else {
          castlingEl.textContent = "None";
          castlingEl.style.color = "#7f8c8d";
        }
      }
    }

    function updateCapturedPieces() {
      const whiteCapDiv = document.getElementById("white-captures-display");
      const blackCapDiv = document.getElementById("black-captures-display");
      if (!whiteCapDiv || !blackCapDiv) return;
      const caps = getCapturedPiecesForView();
      
      // Get the current piece theme path
      const pieceTheme = pieceThemes[currentPieceStyle] || pieceThemes['classic'];
      const isLocal = pieceTheme.includes('lib/img/chesspieces/');
      
      whiteCapDiv.innerHTML = caps.white.length > 0 ? 
        caps.white.map(p => {
          if (isLocal) {
            const piecePath = pieceTheme.replace('{piece}', p);
            return `<div class="captured-piece" style="background-image: url('${piecePath}')"></div>`;
          } else {
            // For remote SVGs, use the theme URL
            const piecePath = pieceTheme.replace('{piece}', p);
            return `<div class="captured-piece" style="background-image: url('${piecePath}')"></div>`;
          }
        }).join('') :
        '';
      
      blackCapDiv.innerHTML = caps.black.length > 0 ? 
        caps.black.map(p => {
          if (isLocal) {
            const piecePath = pieceTheme.replace('{piece}', p);
            return `<div class="captured-piece" style="background-image: url('${piecePath}')"></div>`;
          } else {
            // For remote SVGs, use the theme URL
            const piecePath = pieceTheme.replace('{piece}', p);
            return `<div class="captured-piece" style="background-image: url('${piecePath}')"></div>`;
          }
        }).join('') :
        '';
    }

    function updateMaterialBalance(viewChess) {
      const vc = viewChess || game || new Chess();
      const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      
      let whiteMaterial = 0;
      let blackMaterial = 0;
      
      const board = vc.board();
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const piece = board[i][j];
          if (piece) {
            const value = pieceValues[piece.type];
            if (piece.color === 'w') {
              whiteMaterial += value;
            } else {
              blackMaterial += value;
            }
          }
        }
      }
      
      const difference = whiteMaterial - blackMaterial;
      const balanceEl = document.getElementById("material-balance");
      if (!balanceEl) return;
      
      balanceEl.classList.remove('positive', 'negative', 'equal');
      
      if (difference > 0) {
        balanceEl.textContent = `White +${difference}`;
        balanceEl.classList.add('positive');
      } else if (difference < 0) {
        balanceEl.textContent = `Black +${Math.abs(difference)}`;
        balanceEl.classList.add('negative');
      } else {
        balanceEl.textContent = 'Equal';
        balanceEl.classList.add('equal');
      }
    }

    function trackCapturedPiece(move) {
      if (!move) {
        console.warn('trackCapturedPiece called with null/undefined move');
        return;
      }
      const isPlayerMove = (move.color === 'w' && playerColor === 'white') || (move.color === 'b' && playerColor === 'black');
      const isOpponentMove = !isPlayerMove;
      
      if (move.captured) {
        const capturedPieceCode = move.color === 'w' ? 'b' + move.captured.toUpperCase() : 'w' + move.captured.toUpperCase();
        if (move.color === 'w') {
          capturedPieces.white.push(capturedPieceCode);
        } else {
          capturedPieces.black.push(capturedPieceCode);
        }
        
        // Track captures for achievements (only player's captures)
        if (isPlayerMove) {
          gameStats.totalCaptures++;
          
          const victimType = move.captured.toLowerCase();
          if (victimType === 'q') {
            gameStats.capturedQueens++;
          } else if (victimType === 'r') {
            gameStats.capturedRooks++;
          } else if (victimType === 'b') {
            gameStats.capturedBishops++;
          } else if (victimType === 'n') {
            gameStats.capturedKnights++;
          } else if (victimType === 'p') {
            gameStats.capturedPawns++;
          }
          const moverType = move.piece ? String(move.piece).toLowerCase() : '';
          if (moverType === 'q') {
            gameStats.capturesByQueen++;
          } else if (moverType === 'r') {
            gameStats.capturesByRook++;
          } else if (moverType === 'b') {
            gameStats.capturesByBishop++;
          } else if (moverType === 'n') {
            gameStats.capturesByKnight++;
          } else if (moverType === 'p') {
            gameStats.capturesByPawn++;
          }
          // Track captured piece types for daily challenge
          if (gameStats.dailyStats && !gameStats.dailyStats.capturedPieceTypes.includes(victimType)) {
            gameStats.dailyStats.capturedPieceTypes.push(victimType);
          }
          if (gameStats.dailyStats) {
            if (!gameStats.dailyStats.playerCapturesByType) {
              gameStats.dailyStats.playerCapturesByType = { p: 0, n: 0, b: 0, r: 0, q: 0 };
            }
            if (victimType === 'p' || victimType === 'n' || victimType === 'b' || victimType === 'r' || victimType === 'q') {
              gameStats.dailyStats.playerCapturesByType[victimType]++;
            }
          }
        }
        
        if (isOpponentMove && move.captured) {
          const lostType = move.captured.toLowerCase();
          if (lostType === 'q') {
            gameStats.lostQueens++;
          } else if (lostType === 'r') {
            gameStats.lostRooks++;
          } else if (lostType === 'b') {
            gameStats.lostBishops++;
          } else if (lostType === 'n') {
            gameStats.lostKnights++;
          } else if (lostType === 'p') {
            gameStats.lostPawns++;
          }
        }
        
        // If opponent captured one of our pieces, reset the "no pieces lost" streak
        if (isOpponentMove && gameStats.dailyStats) {
          gameStats.dailyStats.currentStreakNoPiecesLost = 0;
        }
      } else {
        // No capture happened - if it's a player move, increment the streak
        if (isPlayerMove && gameStats.dailyStats) {
          if (gameStats.dailyStats.currentStreakNoPiecesLost === undefined) {
            gameStats.dailyStats.currentStreakNoPiecesLost = 0;
          }
          gameStats.dailyStats.currentStreakNoPiecesLost++;
        }
      }
      
      // Track other move types
      if (isPlayerMove) {
        if (move.flags && move.flags.includes('k')) {
          gameStats.castlingMoves++;
        }
        if (move.promotion) {
          gameStats.promotions++;
        }
        if (move.flags && move.flags.includes('e')) {
          gameStats.enPassants++;
          // Track games with en passant for daily challenge
          if (gameStats.dailyStats && !gameStats.dailyStats.hasEnPassant) {
            gameStats.dailyStats.hasEnPassant = true;
          }
        }
        if (move.san && move.san.includes('+')) {
          gameStats.checksGiven++;
          // Track max checks in this game for daily challenge
          if (gameStats.dailyStats) {
            gameStats.dailyStats.maxChecksInGame = Math.max(gameStats.dailyStats.maxChecksInGame || 0, gameStats.checksGiven);
            // Track consecutive checks for windmill challenge
            gameStats.dailyStats.consecutiveChecks = (gameStats.dailyStats.consecutiveChecks || 0) + 1;
            gameStats.dailyStats.maxConsecutiveChecks = Math.max(gameStats.dailyStats.maxConsecutiveChecks || 0, gameStats.dailyStats.consecutiveChecks);
          }
        } else {
          // Reset consecutive checks if no check
          if (gameStats && gameStats.dailyStats) {
            gameStats.dailyStats.consecutiveChecks = 0;
          }
        }
      }
    }

    function trackRandomAchievements(move, source, target) {
      const isPlayerMove = (move.color === 'w' && playerColor === 'white') || (move.color === 'b' && playerColor === 'black');
      if (!isPlayerMove) return;
      
      const gameMoveNumber = game.history().length;
      // Calculate player's move number (1st move, 2nd move, etc. for the player)
      const playerMoveNumber = playerColor === 'white' 
        ? Math.floor((gameMoveNumber + 1) / 2)  // White plays on odd moves: 1,3,5... -> 1,2,3...
        : Math.floor(gameMoveNumber / 2);        // Black plays on even moves: 2,4,6... -> 1,2,3...
      
      const pieceType = move.piece.toLowerCase();
      
      if (pieceType === 'p' && gameStats.dailyStats) {
        gameStats.dailyStats.pawnMovesToday = (gameStats.dailyStats.pawnMovesToday || 0) + 1;
      }
      
      // Track moves to specific squares (in gameStats, not lifetimeStats)
      if (target === 'e4') {
        gameStats.movesToE4++;
        gameStats.movesToE4Multiple++;
        if (pieceType === 'p') gameStats.pawnToE4++;
      }
      if (target === 'd4') {
        gameStats.movesToD4++;
        gameStats.movesToD4Multiple++;
        if (pieceType === 'p') gameStats.pawnToD4++;
      }
      if (target === 'e5') gameStats.movesToE5++;
      if (target === 'd5') gameStats.movesToD5++;
      
      // Track knight moves to specific squares
      if (pieceType === 'n') {
        if (target === 'f3') {
          gameStats.knightToF3++;
          gameStats.knightToF3Multiple++;
        }
        if (target === 'c3') {
          gameStats.knightToC3++;
          gameStats.knightToC3Multiple++;
        }
        if (target === 'f6') gameStats.knightToF6++;
        if (target === 'c6') gameStats.knightToC6++;
        
        // Simplified knight fork detection: if knight captures and attacks another piece
        // This is a simplified check - full fork detection would require position analysis
        if (move.captured && gameStats && gameStats.dailyStats) {
          // Increment fork count (simplified - assumes any knight capture might be a fork)
          gameStats.dailyStats.knightForks = (gameStats.dailyStats.knightForks || 0) + 1;
        }
      }
      
      // Track moves on specific player move numbers (e.g., "on your 5th move")
      if (playerMoveNumber === 1) gameStats.movesOnMove1++;
      if (playerMoveNumber === 5) gameStats.movesOnMove5++;
      if (playerMoveNumber === 10) gameStats.movesOnMove10++;
      if (playerMoveNumber === 20) gameStats.movesOnMove20++;
      if (playerMoveNumber === 50) gameStats.movesOnMove50++;
      
      // Track specific piece moves to specific squares
      if (pieceType === 'q') {
        if (target === 'd4') {
          gameStats.queenToD4++;
          gameStats.queenToD4Multiple++;
        }
        if (target === 'e4') gameStats.queenToE4++;
      }
      if (pieceType === 'b' && target === 'f4') gameStats.bishopToF4++;
      if (pieceType === 'b' && target === 'c1') gameStats.bishopToC1++;
      if (pieceType === 'b' && target === 'f1') gameStats.bishopToF1++;
      if (pieceType === 'b' && target === 'c8') gameStats.bishopToC8++;
      if (pieceType === 'b' && target === 'f8') gameStats.bishopToF8++;
      
      // Track bishop moves in blindfold mode (for daily challenge)
      // Check blindfold mode explicitly - it should be set when game starts
      const isBlindfoldActive = typeof blindfoldMode !== 'undefined' && blindfoldMode === true;
      const isPureBlindfold = isBlindfoldActive && typeof showHistoryInBlindfold !== 'undefined' && showHistoryInBlindfold === false;
      
      if (pieceType === 'b' && isBlindfoldActive && gameStats && gameStats.dailyStats) {
        if (!gameStats.dailyStats.bishopMovesInBlindfoldToday) {
          gameStats.dailyStats.bishopMovesInBlindfoldToday = 0;
        }
        gameStats.dailyStats.bishopMovesInBlindfoldToday++;
        console.log('Blindfold bishop move tracked:', gameStats.dailyStats.bishopMovesInBlindfoldToday);
      }
      
      // Track knight moves in pure blindfold (no history) for daily challenge
      if (pieceType === 'n' && isPureBlindfold && gameStats && gameStats.dailyStats) {
        if (!gameStats.dailyStats.knightMovesInPureBlindfoldToday) {
          gameStats.dailyStats.knightMovesInPureBlindfoldToday = 0;
        }
        gameStats.dailyStats.knightMovesInPureBlindfoldToday++;
      }
      
      // Track king moves for daily challenge
      if (pieceType === 'k' && gameStats && gameStats.dailyStats) {
        gameStats.dailyStats.kingMoves = (gameStats.dailyStats.kingMoves || 0) + 1;
      }
      
      // Track piece types moved for daily challenge
      if (gameStats && gameStats.dailyStats && !gameStats.dailyStats.pieceTypesMoved.includes(pieceType)) {
        gameStats.dailyStats.pieceTypesMoved.push(pieceType);
      }
      
      // Track e-file squares visited for daily challenge
      if (target && target[0] === 'e' && gameStats && gameStats.dailyStats) {
        if (!gameStats.dailyStats.eFileSquaresVisited.includes(target)) {
          gameStats.dailyStats.eFileSquaresVisited.push(target);
        }
      }
      
      // Track queen visiting corner squares for daily challenge
      if (pieceType === 'q' && gameStats && gameStats.dailyStats) {
        const corners = ['a1', 'h1', 'a8', 'h8'];
        if (corners.includes(target) && !gameStats.dailyStats.queenVisitedCorners.includes(target)) {
          gameStats.dailyStats.queenVisitedCorners.push(target);
        }
      }
      
      // Track rooks on 7th/2nd rank for daily challenge
      if (pieceType === 'r' && gameStats && gameStats.dailyStats) {
        const rank = parseInt(target[1]);
        const targetRank = playerColor === 'white' ? 7 : 2;
        if (rank === targetRank && !gameStats.dailyStats.rooksOnSeventhRank) {
          gameStats.dailyStats.rooksOnSeventhRank = 0;
        }
        // Check if rook is on target rank
        const board = game.board();
        let rooksOnRank = 0;
        for (let i = 0; i < 8; i++) {
          const square = String.fromCharCode(97 + i) + targetRank;
          const piece = game.get(square);
          if (piece && piece.type === 'r' && piece.color === (playerColor === 'white' ? 'w' : 'b')) {
            rooksOnRank++;
          }
        }
        if (rooksOnRank >= 2) {
          gameStats.dailyStats.rooksOnSeventhRank = 2;
        }
      }
      
      // Track pawns advanced to 6th/3rd rank for daily challenge
      if (pieceType === 'p' && gameStats && gameStats.dailyStats) {
        const rank = parseInt(target[1]);
        const targetRank = playerColor === 'white' ? 6 : 3;
        if (rank === targetRank && !gameStats.dailyStats.pawnsAdvancedToSixth.includes(target)) {
          gameStats.dailyStats.pawnsAdvancedToSixth.push(target);
        }
      }
      
      // Track center squares occupied for daily challenge
      const centerSquares = ['d4', 'd5', 'e4', 'e5'];
      if (centerSquares.includes(target) && gameStats && gameStats.dailyStats) {
        if (!gameStats.dailyStats.centerSquaresOccupied.includes(target)) {
          gameStats.dailyStats.centerSquaresOccupied.push(target);
        }
      }
      
      // Track streak of moves without losing pieces
      // Initialize streak counter if needed
      if (gameStats.dailyStats && gameStats.dailyStats.currentStreakNoPiecesLost === undefined) {
        gameStats.dailyStats.currentStreakNoPiecesLost = 0;
      }
      if (pieceType === 'r' && target === 'e1') gameStats.rookToE1++;
      if (pieceType === 'r' && target === 'a1') gameStats.rookToA1++;
      if (pieceType === 'r' && target === 'h1') gameStats.rookToH1++;
      if (pieceType === 'r' && target === 'a8') gameStats.rookToA8++;
      if (pieceType === 'r' && target === 'h8') gameStats.rookToH8++;
      if (pieceType === 'k' && target === 'e1') gameStats.kingToE1++;
      if (pieceType === 'k' && target === 'g1') gameStats.kingToG1++;
      if (pieceType === 'k' && target === 'c1') gameStats.kingToC1++;
      if (pieceType === 'k' && target === 'g8') gameStats.kingToG8++;
      if (pieceType === 'k' && target === 'c8') gameStats.kingToC8++;
      if (pieceType === 'n' && target === 'g1') gameStats.knightToG1++;
      if (pieceType === 'n' && target === 'b1') gameStats.knightToB1++;
      if (pieceType === 'n' && target === 'g8') gameStats.knightToG8++;
      if (pieceType === 'n' && target === 'b8') gameStats.knightToB8++;
      if (pieceType === 'q' && target === 'a1') gameStats.queenToA1++;
      if (pieceType === 'q' && target === 'h1') gameStats.queenToH1++;
      if (pieceType === 'q' && target === 'a8') gameStats.queenToA8++;
      if (pieceType === 'q' && target === 'h8') gameStats.queenToH8++;
      if (pieceType === 'p' && target === 'a2') gameStats.pawnToA2++;
      if (pieceType === 'p' && target === 'h2') gameStats.pawnToH2++;
      if (pieceType === 'p' && target === 'a7') gameStats.pawnToA7++;
      if (pieceType === 'p' && target === 'h7') gameStats.pawnToH7++;
      
      // Track daily stats (temporary for this game)
      gameStats.dailyStats.movesMadeToday++;
      if (move.captured) gameStats.dailyStats.capturesToday++;
      if (move.san && move.san.includes('+')) gameStats.dailyStats.checksGivenToday++;
      if (!gameStats.dailyStats.uniqueSquaresVisitedToday.includes(target)) {
        gameStats.dailyStats.uniqueSquaresVisitedToday.push(target);
      }
      
      // Track promotions
      if (move.promotion) {
        // Track promotion count for daily challenge
        if (gameStats && gameStats.dailyStats) {
          gameStats.dailyStats.promotionsInGame = (gameStats.dailyStats.promotionsInGame || 0) + 1;
          gameStats.dailyStats.promotionsToday = (gameStats.dailyStats.promotionsToday || 0) + 1;
          if (move.promotion !== 'q') {
            gameStats.dailyStats.underpromotionMovesToday = (gameStats.dailyStats.underpromotionMovesToday || 0) + 1;
          }
        }
        
        if (move.promotion === 'q') {
          gameStats.promotedToQueen++;
          gameStats.promotedToQueenMultiple++;
          if (gameStats.dailyStats && !gameStats.dailyStats.promotionTypes.includes('q')) {
            gameStats.dailyStats.promotionTypes.push('q');
          }
        }
        if (move.promotion === 'r') {
          gameStats.promotedToRook++;
          lifetimeStats.underpromotions = (lifetimeStats.underpromotions || 0) + 1;
          // Track underpromotion for daily challenge
          if (gameStats.dailyStats) {
            gameStats.dailyStats.hasUnderpromotion = true;
            if (!gameStats.dailyStats.promotionTypes.includes('r')) {
              gameStats.dailyStats.promotionTypes.push('r');
            }
          }
        }
        if (move.promotion === 'b') {
          gameStats.promotedToBishop++;
          lifetimeStats.underpromotions = (lifetimeStats.underpromotions || 0) + 1;
          if (gameStats.dailyStats) {
            gameStats.dailyStats.hasUnderpromotion = true;
            if (!gameStats.dailyStats.promotionTypes.includes('b')) {
              gameStats.dailyStats.promotionTypes.push('b');
            }
          }
        }
        if (move.promotion === 'n') {
          gameStats.promotedToKnight++;
          lifetimeStats.underpromotions = (lifetimeStats.underpromotions || 0) + 1;
          if (gameStats.dailyStats) {
            gameStats.dailyStats.hasUnderpromotion = true;
            if (!gameStats.dailyStats.promotionTypes.includes('n')) {
              gameStats.dailyStats.promotionTypes.push('n');
            }
          }
        }
        if (move.promotion === 'q' && gameStats.dailyStats) {
          if (!gameStats.dailyStats.promotionTypes.includes('q')) {
            gameStats.dailyStats.promotionTypes.push('q');
          }
        }
      }
      
      // Track castling on specific player move numbers
      if (move.flags && move.flags.includes('k')) {
        if (playerMoveNumber === 10) gameStats.castledOnMove10++;
        if (playerMoveNumber === 20) gameStats.castledOnMove20++;
        gameStats.dailyStats.castlingToday++; // Track daily castling
        // Track castling type for daily challenge
        if (gameStats.dailyStats) {
          const castlingType = move.san.includes('O-O-O') ? 'q' : 'k'; // queenside or kingside
          if (!gameStats.dailyStats.castlingTypes.includes(castlingType)) {
            gameStats.dailyStats.castlingTypes.push(castlingType);
          }
        }
      }
      
      // Track checks on specific player move numbers (skip move 1 as it's impossible)
      if (move.san && move.san.includes('+')) {
        if (playerMoveNumber === 5) gameStats.checkOnMove5++;
      }
      
      // Track captures on specific player move numbers (skip move 1 as it's impossible for white)
      if (move.captured) {
        if (playerMoveNumber === 10) gameStats.captureOnMove10++;
      }
    }

    function celebrateDraw(drawReason) {
      const addons = typeof getCheckmateAddonsEnabled === 'function' ? getCheckmateAddonsEnabled() : [];

      // Base: subtle flash + "Draw!" text (always)
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle,rgba(243,156,18,0.25) 0%,transparent 70%);pointer-events:none;z-index:9997;animation:screenFlash 0.6s ease-out;';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
      const txt = document.createElement('div');
      txt.className = 'draw-text';
      txt.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3em;font-weight:900;color:#f39c12;z-index:9998;font-family:Inter,sans-serif;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px;';
      txt.innerHTML = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15" x2="16" y2="15"/></svg><span>Draw!</span>';
      document.body.appendChild(txt);
      setTimeout(() => { txt.style.transition = 'opacity 0.4s'; txt.style.opacity = '0'; setTimeout(() => txt.remove(), 400); }, 1800);

      // Add-on: confetti
      if (addons.includes('confetti')) {
        const overlay = document.createElement('div');
      overlay.className = 'draw-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9996;';
        document.body.appendChild(overlay);
      const colors = ['#F39C12', '#E67E22', '#D35400', '#F1C40F', '#F7DC6F', '#F8C471', '#F4D03F', '#F9E79F'];
      const shapes = ['circle', 'rect', 'star'];
        for (let i = 0; i < 200; i++) {
          setTimeout(() => {
            const c = document.createElement('div');
            c.className = 'confetti ' + shapes[Math.floor(Math.random() * shapes.length)];
            c.style.left = Math.random() * 100 + '%';
            c.style.top = '-20px';
            c.style.background = colors[Math.floor(Math.random() * colors.length)];
            const s = Math.random() * 15 + 5;
            c.style.width = s + 'px';
            c.style.height = s + 'px';
            c.style.opacity = Math.random() * 0.5 + 0.5;
            c.style.setProperty('--drift', (Math.random() - 0.5) * 150 + 'px');
            c.style.animation = `confetti-fall ${(Math.random() * 2 + 2)}s linear forwards`;
            c.style.animationDelay = (Math.random() * 0.2) + 's';
            overlay.appendChild(c);
            setTimeout(() => c.remove(), 4000);
        }, i * 10);
      }
        setTimeout(() => overlay.remove(), 5000);
      }

      // Add-on: pulse
      if (addons.includes('pulse')) {
        const boardEl = document.getElementById('board');
        if (boardEl) {
          boardEl.style.animation = 'drawPulse 1.5s ease-in-out 3';
          boardEl.style.boxShadow = '0 0 80px rgba(243,156,18,0.6), 0 0 120px rgba(230,126,34,0.4)';
          setTimeout(() => { boardEl.style.animation = ''; boardEl.style.boxShadow = ''; }, 5000);
        }
      }

      // Same purchasable celebration add-ons as checkmate (warm palette where it fits)
      if (addons.includes('sparkles')) {
        for (let i = 0; i < 70; i++) {
          setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            sparkle.style.left = (Math.random() * window.innerWidth) + 'px';
            sparkle.style.top = (Math.random() * window.innerHeight * 0.55) + 'px';
            sparkle.style.width = (12 + Math.random() * 18) + 'px';
            sparkle.style.height = sparkle.style.width;
            sparkle.style.animation = 'sparkle ' + (0.5 + Math.random() * 0.8) + 's ease-out forwards';
            document.body.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 1500);
          }, i * 22);
        }
      }
      if (addons.includes('balloons')) {
        const colors = ['#f39c12', '#e67e22', '#f1c40f', '#d35400', '#f7dc6f', '#e59866'];
        for (let i = 0; i < 24; i++) {
          setTimeout(() => {
            const b = document.createElement('div');
            const w = 26 + Math.random() * 20;
            b.style.cssText = 'position:fixed;left:' + (Math.random() * 92 + 4) + 'vw;bottom:-50px;width:' + w + 'px;height:' + (w * 1.25) + 'px;border-radius:50% 50% 50% 50%/55% 55% 45% 45%;background:' + colors[i % colors.length] + ';opacity:0.93;z-index:9996;pointer-events:none;box-shadow:inset -5px -10px rgba(0,0,0,0.18);animation:balloon-rise ' + (4 + Math.random() * 3.5) + 's linear forwards';
            document.body.appendChild(b);
            setTimeout(() => b.remove(), 9000);
          }, i * 110);
        }
      }
      if (addons.includes('spotlight')) {
        const o = document.createElement('div');
        o.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9994;background:conic-gradient(from 200deg at 50% 0%, transparent 0deg, rgba(255,200,120,0.16) 38deg, transparent 72deg, rgba(255,180,80,0.12) 105deg, transparent 150deg);animation:spotlight-spin 3.8s ease-in-out forwards';
        document.body.appendChild(o);
        setTimeout(() => o.remove(), 4200);
      }
      if (addons.includes('hearts')) {
        const hearts = ['\u2764\uFE0F', '\uD83D\uDC9B', '\uD83D\uDC9A', '\uD83D\uDC99', '\uD83D\uDC9C', '\uD83E\uDE75'];
        for (let i = 0; i < 40; i++) {
          setTimeout(() => {
            const h = document.createElement('div');
            const drift = ((Math.random() - 0.5) * 120) + 'px';
            h.style.cssText = '--heart-drift:' + drift + ';position:fixed;left:' + (Math.random() * 96 + 2) + 'vw;bottom:-36px;font-size:' + (16 + Math.random() * 22) + 'px;z-index:9996;pointer-events:none;line-height:1;animation:heart-rise ' + (2.8 + Math.random() * 2.2) + 's ease-out forwards';
            h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
            document.body.appendChild(h);
            setTimeout(() => h.remove(), 6000);
          }, i * 38);
        }
      }
      if (addons.includes('meteors')) {
        for (let i = 0; i < 18; i++) {
          setTimeout(() => {
            const fromLeft = Math.random() > 0.5;
            const m = document.createElement('div');
            const mx = (fromLeft ? 300 + Math.random() * 260 : -300 - Math.random() * 260) + 'px';
            const my = (360 + Math.random() * 200) + 'px';
            const mr = (fromLeft ? 26 + Math.random() * 14 : -26 - Math.random() * 14) + 'deg';
            m.style.cssText = '--mx:' + mx + ';--my:' + my + ';--mr:' + mr + ';position:fixed;' + (fromLeft ? 'left:5%' : 'right:5%') + ';top:' + (8 + Math.random() * 35) + '%;width:130px;height:4px;background:linear-gradient(90deg,transparent,rgba(255,220,140,0.98),rgba(243,156,18,0.95),transparent);border-radius:2px;z-index:9996;pointer-events:none;box-shadow:0 0 14px rgba(243,156,18,0.85);animation:meteor-dash ' + (0.45 + Math.random() * 0.35) + 's ease-in forwards';
            document.body.appendChild(m);
            setTimeout(() => m.remove(), 900);
          }, i * 140);
        }
      }
      if (addons.includes('ribbons')) {
        const colors = ['#f39c12', '#e67e22', '#f1c40f', '#d68910', '#ca6f1e', '#b9770e'];
        for (let i = 0; i < 55; i++) {
          setTimeout(() => {
            const r = document.createElement('div');
            const rot = (Math.random() * 50 - 25) + 'deg';
            r.style.cssText = '--ribbon-drift:' + ((Math.random() - 0.5) * 200) + 'px;--rib-rot:' + rot + ';position:fixed;left:' + (Math.random() * 100) + '%;top:-24px;width:' + (7 + Math.random() * 14) + 'px;height:' + (36 + Math.random() * 55) + 'px;background:' + colors[i % colors.length] + ';border-radius:3px;opacity:0.88;z-index:9996;pointer-events:none;animation:ribbon-fall ' + (1.8 + Math.random() * 1.4) + 's linear forwards';
            document.body.appendChild(r);
            setTimeout(() => r.remove(), 4000);
          }, i * 32);
        }
      }
      if (addons.includes('shockwave')) {
        const board = document.getElementById('board');
        const br = board ? board.getBoundingClientRect() : null;
        const cx = br ? br.left + br.width / 2 : window.innerWidth / 2;
        const cy = br ? br.top + br.height / 2 : window.innerHeight / 2;
        for (let ring = 0; ring < 6; ring++) {
          setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'ripple';
            el.style.left = cx + 'px';
            el.style.top = cy + 'px';
            el.style.width = '24px';
            el.style.height = '24px';
            el.style.marginLeft = '-12px';
            el.style.marginTop = '-12px';
            el.style.border = '3px solid rgba(243, 156, 18, 0.85)';
            el.style.animation = 'ripple 1.35s ease-out forwards';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1400);
          }, ring * 180);
        }
      }
    }

    function celebrateCheckmate(playerWon) {
      const addons = typeof getCheckmateAddonsEnabled === 'function' ? getCheckmateAddonsEnabled() : [];
      const isVictory = !!playerWon;

      // Base: subtle flash + "Victory!" / "Defeat!" text (always)
      const flash = document.createElement('div');
      flash.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle,' + (isVictory ? 'rgba(46,204,113,0.25)' : 'rgba(231,76,60,0.25)') + ' 0%,transparent 70%);pointer-events:none;z-index:9997;animation:screenFlash 0.6s ease-out;';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 600);
      const txt = document.createElement('div');
      txt.className = isVictory ? 'victory-text' : 'defeat-text';
      txt.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3em;font-weight:900;z-index:9998;font-family:Inter,sans-serif;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:8px;';
      txt.style.color = isVictory ? '#2ecc71' : '#e74c3c';
      txt.innerHTML = (isVictory ? '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg><span>Victory!</span>' : '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>Defeat!</span>');
      document.body.appendChild(txt);
      setTimeout(() => { txt.style.transition = 'opacity 0.4s'; txt.style.opacity = '0'; setTimeout(() => txt.remove(), 400); }, 1800);

      if (isVictory) {
        // Add-on: confetti
        if (addons.includes('confetti')) {
        const overlay = document.createElement('div');
        overlay.className = 'checkmate-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9996;';
        document.body.appendChild(overlay);
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#2ECC71', '#3498DB', '#FF1493', '#00CED1', '#FFD700', '#FF4500'];
        const shapes = ['circle', 'rect', 'star'];
        for (let i = 0; i < 400; i++) {
          setTimeout(() => {
              const c = document.createElement('div');
              c.className = 'confetti ' + shapes[Math.floor(Math.random() * shapes.length)];
              c.style.left = Math.random() * 100 + '%';
              c.style.top = '-20px';
              c.style.background = colors[Math.floor(Math.random() * colors.length)];
              const s = Math.random() * 20 + 6;
              c.style.width = s + 'px';
              c.style.height = s + 'px';
              c.style.opacity = Math.random() * 0.6 + 0.4;
              c.style.setProperty('--drift', (Math.random() - 0.5) * 200 + 'px');
              c.style.animation = `confetti-fall ${(Math.random() * 2 + 2.5)}s linear forwards`;
              c.style.animationDelay = (Math.random() * 0.3) + 's';
              overlay.appendChild(c);
              setTimeout(() => c.remove(), 5000);
          }, i * 8);
          }
          setTimeout(() => overlay.remove(), 6000);
        }

        // Add-on: fireworks
        if (addons.includes('fireworks')) {
        const board = document.getElementById('board');
          const boardRect = board ? board.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
        const centerX = boardRect.left + boardRect.width / 2;
        const centerY = boardRect.top + boardRect.height / 2;
          const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#2ECC71', '#3498DB', '#FF1493', '#00CED1', '#FFD700', '#FF4500'];
        for (let burst = 0; burst < 8; burst++) {
          setTimeout(() => {
            const numParticles = 30;
            for (let i = 0; i < numParticles; i++) {
              const angle = (Math.PI * 2 * i) / numParticles;
              const distance = 100 + Math.random() * 150;
                const p = document.createElement('div');
                p.className = 'particle';
              const tx = Math.cos(angle) * distance;
              const ty = Math.sin(angle) * distance;
                p.style.setProperty('--tx', tx + 'px');
                p.style.setProperty('--ty', ty + 'px');
                p.style.left = centerX + 'px';
                p.style.top = centerY + 'px';
                p.style.background = colors[Math.floor(Math.random() * colors.length)];
                p.style.animation = `particleTrail ${0.8 + Math.random() * 0.4}s ease-out forwards`;
                document.body.appendChild(p);
                setTimeout(() => p.remove(), 1200);
            }
          }, burst * 300);
        }
        for (let i = 0; i < 60; i++) {
          setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle';
            const angle = (Math.PI * 2 * i) / 60;
            const distance = 250 + Math.random() * 200;
            sparkle.style.left = (centerX + Math.cos(angle) * distance) + 'px';
            sparkle.style.top = (centerY + Math.sin(angle) * distance) + 'px';
            sparkle.style.width = (15 + Math.random() * 20) + 'px';
            sparkle.style.height = sparkle.style.width;
            sparkle.style.animation = `sparkle ${0.6 + Math.random() * 0.6}s ease-out`;
            document.body.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 1500);
          }, i * 30);
        }
        }

        // Add-on: pulse
        if (addons.includes('pulse')) {
          const boardEl = document.getElementById('board');
          if (boardEl) {
            boardEl.style.animation = 'victoryPulse 0.8s ease-in-out 6';
            boardEl.style.transition = 'all 0.3s ease';
            setTimeout(() => { boardEl.style.animation = ''; boardEl.style.filter = ''; boardEl.style.boxShadow = ''; }, 5000);
          }
        }

        // Add-on: starfall (sparkles)
        if (addons.includes('sparkles')) {
          for (let i = 0; i < 90; i++) {
            setTimeout(() => {
              const sparkle = document.createElement('div');
              sparkle.className = 'sparkle';
              sparkle.style.left = (Math.random() * window.innerWidth) + 'px';
              sparkle.style.top = (Math.random() * window.innerHeight * 0.55) + 'px';
              sparkle.style.width = (12 + Math.random() * 18) + 'px';
              sparkle.style.height = sparkle.style.width;
              sparkle.style.animation = 'sparkle ' + (0.5 + Math.random() * 0.8) + 's ease-out forwards';
              document.body.appendChild(sparkle);
              setTimeout(() => sparkle.remove(), 1500);
            }, i * 22);
          }
        }

        // Add-on: balloons
        if (addons.includes('balloons')) {
          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];
          for (let i = 0; i < 28; i++) {
            setTimeout(() => {
              const b = document.createElement('div');
              const w = 26 + Math.random() * 20;
              b.style.cssText = 'position:fixed;left:' + (Math.random() * 92 + 4) + 'vw;bottom:-50px;width:' + w + 'px;height:' + (w * 1.25) + 'px;border-radius:50% 50% 50% 50%/55% 55% 45% 45%;background:' + colors[i % colors.length] + ';opacity:0.93;z-index:9996;pointer-events:none;box-shadow:inset -5px -10px rgba(0,0,0,0.18);animation:balloon-rise ' + (4 + Math.random() * 3.5) + 's linear forwards';
              document.body.appendChild(b);
              setTimeout(() => b.remove(), 9000);
            }, i * 110);
          }
        }

        // Add-on: spotlight
        if (addons.includes('spotlight')) {
          const o = document.createElement('div');
          o.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9994;background:conic-gradient(from 160deg at 50% 0%, transparent 0deg, rgba(255,240,180,0.14) 42deg, transparent 78deg, rgba(130,200,255,0.12) 118deg, transparent 160deg);animation:spotlight-spin 3.8s ease-in-out forwards';
          document.body.appendChild(o);
          setTimeout(() => o.remove(), 4200);
        }

        // Add-on: hearts
        if (addons.includes('hearts')) {
          const hearts = ['\u2764\uFE0F', '\uD83D\uDC9B', '\uD83D\uDC9A', '\uD83D\uDC99', '\uD83D\uDC9C', '\uD83E\uDE75'];
          for (let i = 0; i < 45; i++) {
            setTimeout(() => {
              const h = document.createElement('div');
              const drift = ((Math.random() - 0.5) * 120) + 'px';
              h.style.cssText = '--heart-drift:' + drift + ';position:fixed;left:' + (Math.random() * 96 + 2) + 'vw;bottom:-36px;font-size:' + (16 + Math.random() * 22) + 'px;z-index:9996;pointer-events:none;line-height:1;animation:heart-rise ' + (2.8 + Math.random() * 2.2) + 's ease-out forwards';
              h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
              document.body.appendChild(h);
              setTimeout(() => h.remove(), 6000);
            }, i * 38);
          }
        }

        // Add-on: meteors
        if (addons.includes('meteors')) {
          for (let i = 0; i < 22; i++) {
            setTimeout(() => {
              const fromLeft = Math.random() > 0.5;
              const m = document.createElement('div');
              const mx = (fromLeft ? 320 + Math.random() * 280 : -320 - Math.random() * 280) + 'px';
              const my = (380 + Math.random() * 200) + 'px';
              const mr = (fromLeft ? 28 + Math.random() * 12 : -28 - Math.random() * 12) + 'deg';
              m.style.cssText = '--mx:' + mx + ';--my:' + my + ';--mr:' + mr + ';position:fixed;' + (fromLeft ? 'left:5%' : 'right:5%') + ';top:' + (8 + Math.random() * 35) + '%;width:140px;height:4px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.95),rgba(147,197,253,0.9),transparent);border-radius:2px;z-index:9996;pointer-events:none;box-shadow:0 0 12px rgba(147,197,253,0.8);animation:meteor-dash ' + (0.45 + Math.random() * 0.35) + 's ease-in forwards';
              document.body.appendChild(m);
              setTimeout(() => m.remove(), 900);
            }, i * 140);
          }
        }

        // Add-on: ribbons (streamers)
        if (addons.includes('ribbons')) {
          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#e91e63', '#9b59b6'];
          for (let i = 0; i < 65; i++) {
            setTimeout(() => {
              const r = document.createElement('div');
              const rot = (Math.random() * 50 - 25) + 'deg';
              r.style.cssText = '--ribbon-drift:' + ((Math.random() - 0.5) * 200) + 'px;--rib-rot:' + rot + ';position:fixed;left:' + (Math.random() * 100) + '%;top:-24px;width:' + (7 + Math.random() * 14) + 'px;height:' + (36 + Math.random() * 55) + 'px;background:' + colors[i % colors.length] + ';border-radius:3px;opacity:0.88;z-index:9996;pointer-events:none;animation:ribbon-fall ' + (1.8 + Math.random() * 1.4) + 's linear forwards';
              document.body.appendChild(r);
              setTimeout(() => r.remove(), 4000);
            }, i * 32);
          }
        }

        // Add-on: shockwave rings
        if (addons.includes('shockwave')) {
          const board = document.getElementById('board');
          const br = board ? board.getBoundingClientRect() : null;
          const cx = br ? br.left + br.width / 2 : window.innerWidth / 2;
          const cy = br ? br.top + br.height / 2 : window.innerHeight / 2;
          for (let ring = 0; ring < 6; ring++) {
            setTimeout(() => {
              const el = document.createElement('div');
              el.className = 'ripple';
              el.style.left = cx + 'px';
              el.style.top = cy + 'px';
              el.style.width = '24px';
              el.style.height = '24px';
              el.style.marginLeft = '-12px';
              el.style.marginTop = '-12px';
              el.style.border = '3px solid rgba(46, 204, 113, 0.75)';
              el.style.animation = 'ripple 1.35s ease-out forwards';
              document.body.appendChild(el);
              setTimeout(() => el.remove(), 1400);
            }, ring * 180);
          }
        }
      } else {
        // Defeat: base shake always, add-ons optional
        const boardEl = document.getElementById('board');
        if (boardEl) {
          boardEl.style.animation = 'defeatShake 2s ease-in-out';
          boardEl.style.boxShadow = '0 0 100px 30px rgba(220, 53, 69, 1), inset 0 0 60px rgba(220, 53, 69, 0.5), 0 0 150px rgba(139, 0, 0, 0.8)';
          boardEl.style.filter = 'brightness(0.6) saturate(1.8) contrast(1.2)';
          boardEl.style.border = '4px solid rgba(220, 53, 69, 0.8)';
        setTimeout(() => {
            boardEl.style.animation = '';
            boardEl.style.boxShadow = '';
            boardEl.style.filter = '';
            boardEl.style.border = '';
        }, 2000);
        }

        // Add-on: confetti (red particles for defeat)
        if (addons.includes('confetti')) {
          const boardRect = boardEl ? boardEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 };
          for (let i = 0; i < 50; i++) {
            setTimeout(() => {
              const p = document.createElement('div');
              p.style.cssText = 'position:fixed;width:6px;height:6px;background:rgba(220,53,69,0.9);border-radius:50%;left:' + (boardRect.left + Math.random() * boardRect.width) + 'px;top:' + boardRect.top + 'px;z-index:10000;pointer-events:none;';
              p.style.animation = `confetti-fall ${1 + Math.random()}s linear forwards`;
              p.style.setProperty('--drift', (Math.random() - 0.5) * 50 + 'px');
              document.body.appendChild(p);
              setTimeout(() => p.remove(), 2000);
            }, i * 30);
          }
        }

        // Add-on: pulse
        if (addons.includes('pulse')) {
        const gameContainer = document.getElementById('game-container');
        if (gameContainer) {
          gameContainer.style.animation = 'defeatPulse 2s ease-out';
          gameContainer.style.filter = 'brightness(0.8)';
          setTimeout(() => {
            gameContainer.style.animation = '';
            gameContainer.style.filter = '';
          }, 2000);
        }
        }
      }
    }

    function inferResultFromGame() {
      if (!game) return '*';
      if (game.in_checkmate()) {
        return game.turn() === 'w' ? '0-1' : '1-0';
      }
      if (game.in_draw() || game.in_stalemate() || game.in_threefold_repetition()) {
        return '1/2-1/2';
      }
      return '*';
    }

    /** Ahrenslabs account name for PGN [White]/[Black] tags (safe inside double quotes). */
    function getChessPgnPlayerName() {
      try {
        const u = localStorage.getItem('ahrenslabs_username');
        if (u && String(u).trim()) return sanitizePgnTagPlayerName(String(u).trim());
      } catch (e) {}
      return 'Player';
    }

    function sanitizePgnTagPlayerName(s) {
      const t = s.replace(/[\r\n\f\v\[\]"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      return t || 'Player';
    }

    function slugForPgnFilename(name) {
      const raw = String(name || 'player').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_|_$/g, '');
      return raw.slice(0, 40) || 'player';
    }

    function buildPgnStringForRecord(result) {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '.');
      const r = result || '*';
      const human = getChessPgnPlayerName();
      let pgn = '[Event "Chess vs TrifangX"]\n';
      pgn += '[Site "Ahrens Labs"]\n';
      pgn += `[Date "${dateStr}"]\n`;
      pgn += '[Round "1"]\n';
      pgn += `[White "${playerColor === 'white' ? human : 'TrifangX'}"]\n`;
      pgn += `[Black "${playerColor === 'black' ? human : 'TrifangX'}"]\n`;
      pgn += `[Result "${r}"]\n\n`;
      const history = game.history();
      let moveText = '';
      for (let i = 0; i < history.length; i++) {
        if (i % 2 === 0) {
          moveText += `${Math.floor(i / 2) + 1}. `;
        }
        moveText += history[i] + ' ';
        if (i % 2 === 1) {
          moveText += '\n';
        }
      }
      pgn += moveText.trim() + (history.length ? ` ${r}` : r);
      return pgn;
    }

    function downloadPgnString(pgn, filenameBase) {
      const blob = new Blob([pgn], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameBase + '.pgn';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }

    function recordGameToCloudHistory(result) {
      if (!cloudChessData || !game || game.history().length === 0) return;
      if (result !== '1-0' && result !== '0-1' && result !== '1/2-1/2') return;
      const pgn = buildPgnStringForRecord(result);
      const rec = {
        id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
        savedAt: new Date().toISOString(),
        result: result,
        playerColor: playerColor,
        timeControl: typeof currentTimeControl !== 'undefined' ? currentTimeControl : 'none',
        pgn: pgn,
        historySan: game.history().slice(),
        moveClockTimes: Array.isArray(moveClockTimes) ? moveClockTimes.slice() : []
      };
      if (!cloudChessData.gameHistory) cloudChessData.gameHistory = [];
      cloudChessData.gameHistory.unshift(rec);
      trimGameHistoryToCap();
      saveChessDataToCloud(true);
    }

    /** Favorited games are never dropped by the rolling cap; non-favorites keep the 50 newest. */
    function trimGameHistoryToCap() {
      if (!cloudChessData || !Array.isArray(cloudChessData.gameHistory)) return;
      const items = cloudChessData.gameHistory;
      let nonFavKept = 0;
      const out = [];
      for (let i = 0; i < items.length; i++) {
        const r = items[i];
        if (!r) continue;
        if (gameHistoryRecordIsFavorite(r)) {
          out.push(r);
        } else if (nonFavKept < 50) {
          out.push(r);
          nonFavKept++;
        }
      }
      cloudChessData.gameHistory = out;
    }

    function gameHistoryRecordIsFavorite(rec) {
      return !!(rec && rec.favorite === true);
    }

    function exportPGN() {
      const result = inferResultFromGame();
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');
      const pgn = buildPgnStringForRecord(result);
      const slug = slugForPgnFilename(getChessPgnPlayerName());
      downloadPgnString(pgn, 'chess_game_' + slug + '_' + dateStr);
    }

    function rebuildCapturedPiecesFromSanList(sanList) {
      capturedPieces = { white: [], black: [] };
      const c = new Chess();
      for (let i = 0; i < sanList.length; i++) {
        const mv = c.move(sanList[i]);
        if (mv && mv.captured) {
          const capturedPieceCode = mv.color === 'w' ? 'b' + mv.captured.toUpperCase() : 'w' + mv.captured.toUpperCase();
          if (mv.color === 'w') {
            capturedPieces.white.push(capturedPieceCode);
          } else {
            capturedPieces.black.push(capturedPieceCode);
          }
        }
      }
    }

    function snapshotLiveGameStateForReplay() {
      return {
        historySan: game ? game.history().slice() : [],
        moveHistory: moveHistory.slice(),
        moveClockTimes: moveClockTimes.slice(),
        currentMoveIndex: currentMoveIndex,
        playerColor: playerColor,
        gameOver: gameOver,
        blindfoldMode: blindfoldMode,
        capturedPieces: { white: capturedPieces.white.slice(), black: capturedPieces.black.slice() },
        lastMoveSquares: { from: lastMoveSquares.from, to: lastMoveSquares.to },
        lastLiveMoveDisplayText: lastLiveMoveDisplayText
      };
    }

    function restoreLiveGameStateFromReplayBackup(b) {
      if (!b || !game) return;
      game.reset();
      for (let i = 0; i < b.historySan.length; i++) {
        if (!game.move(b.historySan[i])) break;
      }
      moveHistory = [];
      const tmp = new Chess();
      for (let j = 0; j < b.historySan.length; j++) {
        tmp.move(b.historySan[j]);
        moveHistory.push(tmp.fen());
      }
      moveClockTimes = b.moveClockTimes.slice();
      while (moveClockTimes.length < moveHistory.length) {
        moveClockTimes.push('00:00.00');
      }
      currentMoveIndex = b.currentMoveIndex;
      playerColor = b.playerColor;
      gameOver = b.gameOver;
      blindfoldMode = b.blindfoldMode;
      capturedPieces = { white: b.capturedPieces.white.slice(), black: b.capturedPieces.black.slice() };
      lastMoveSquares = { from: b.lastMoveSquares.from, to: b.lastMoveSquares.to };
      lastLiveMoveDisplayText = b.lastLiveMoveDisplayText;
      if (board) {
        board.position(game.fen());
        board.orientation(playerColor);
      }
      syncBlindfoldGameShellUi();
      updateNotationDisplay();
      refreshSidebarForViewedPosition();
    }

    function playGameHistoryRecordAt(index) {
      const items = (cloudChessData && cloudChessData.gameHistory) ? cloudChessData.gameHistory : [];
      const rec = items[index];
      if (!rec || !Array.isArray(rec.historySan) || rec.historySan.length === 0) {
        showNotification('Could not load that game', 'error');
        return;
      }
      if (!gameOver && game && game.history().length > 0) {
        if (!window.confirm('Leave your current game?')) {
          return;
        }
      }
      replayModeBackup = snapshotLiveGameStateForReplay();
      isHistoryReplayMode = true;
      reachedReplayEnd = false;
      premoves = [];
      selectedSquare = null;

      game.reset();
      historyReplayFullSan = null;
      for (let i = 0; i < rec.historySan.length; i++) {
        const m = game.move(rec.historySan[i]);
        if (!m) {
          showNotification('Saved game could not be replayed.', 'error');
          exitHistoryReplay();
          return;
        }
      }
      historyReplayFullSan = rec.historySan.slice();
      moveHistory = [];
      const tmp = new Chess();
      for (let k = 0; k < rec.historySan.length; k++) {
        tmp.move(rec.historySan[k]);
        moveHistory.push(tmp.fen());
      }
      const mct = Array.isArray(rec.moveClockTimes) ? rec.moveClockTimes : [];
      moveClockTimes = [];
      for (let m = 0; m < rec.historySan.length; m++) {
        moveClockTimes.push(mct[m] != null && mct[m] !== '' ? mct[m] : '—');
      }
      playerColor = rec.playerColor === 'black' ? 'black' : 'white';
      gameOver = true;
      resetGameStats();
      rebuildCapturedPiecesFromSanList(rec.historySan);
      const vhist = game.history({ verbose: true });
      if (vhist.length) {
        const lm = vhist[vhist.length - 1];
        lastMoveSquares = { from: lm.from, to: lm.to };
      } else {
        lastMoveSquares = { from: null, to: null };
      }
      const h = game.history();
      if (h.length) {
        const li = h.length - 1;
        const t = moveClockTimes[li] || '—';
        lastLiveMoveDisplayText = h[li] + ' (' + t + ')';
      } else {
        lastLiveMoveDisplayText = 'None';
      }

      ensureReplaySidebarPanelsVisible();
      document.getElementById('choose-side').style.display = 'none';
      document.getElementById('game-container').style.display = 'block';
      document.getElementById('game-title').style.display = 'block';
      syncBlindfoldGameShellUi();

      if (board) {
        board.orientation(playerColor);
        board.draggable(false);
      }
      // Jump to start (currentMoveIndex -2) now. If we left -1 until a deferred navigateToStart, → would
      // no-op because navigateToNextMove returns on -1, and the first ply could never be shown.
      navigateToStart();
      currentMoveIndex = -2; // Belt-and-suspenders: ensure start state regardless of any side-effects above.
      const ban = document.getElementById('history-replay-banner');
      if (ban) {
        ban.style.display = 'flex';
      }
      updateChessPregameToolsVisibility();
    }

    function exitHistoryReplay() {
      if (!isHistoryReplayMode) {
        historyReplayFullSan = null;
        const ban = document.getElementById('history-replay-banner');
        if (ban) ban.style.display = 'none';
        return;
      }
      isHistoryReplayMode = false;
      historyReplayFullSan = null;
      reachedReplayEnd = false;
      const b = replayModeBackup;
      replayModeBackup = null;
      const ban = document.getElementById('history-replay-banner');
      if (ban) ban.style.display = 'none';
      if (b) {
        restoreLiveGameStateFromReplayBackup(b);
      }
      if (board) {
        board.draggable(!gameOver);
      }
      updateChessPregameToolsVisibility();
    }
    
    function resignGame() {
      if (gameOver) return;
      
      // Position the modal directly above the resign button (popping out of it)
      const modal = document.getElementById('confirm-modal');
      const resignBtn = document.getElementById('resign-btn');
      
      // Show the modal first
      modal.classList.add('show');
      
      // Use requestAnimationFrame to ensure modal is rendered before getting dimensions
      requestAnimationFrame(() => {
        const modalRect = modal.getBoundingClientRect();
        const btnRect = resignBtn.getBoundingClientRect();
        
        // Position centered horizontally above the button with a small gap
        // Make it appear to "pop out" from the button
        const gap = 8; // 8px gap between button and modal
        modal.style.left = (btnRect.left + btnRect.width / 2 - modalRect.width / 2) + 'px';
        modal.style.top = (btnRect.top - modalRect.height - gap) + 'px';
        modal.style.position = 'fixed'; // Use fixed positioning relative to viewport
      });
    }

    function closeConfirmModal() {
      document.getElementById('confirm-modal').classList.remove('show');
    }

    function confirmResign() {
      closeConfirmModal();
      
      const winner = playerColor === 'white' ? 'black' : 'white';
      const moveContainer = document.getElementById("move-timer-container");
      moveContainer.innerHTML = `RESIGNATION! <span style="color:red;">You Lose!</span>`;
      gameOver = true;
      recordGameToCloudHistory(playerColor === 'white' ? '0-1' : '1-0');
      
      // Play losing celebration
      playSound('checkmate');
      celebrateCheckmate(false);
      
      // Update statistics
      playerStats.losses++;
      savePlayerStats();
      updatePlayerStatsDisplay();
      resetDailyStatsIfNeeded();
      lifetimeStats.dailyStats.gamesPlayedToday++;
      const moveCount = game.history().length;
      if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
        lifetimeStats.dailyStats.longestGameToday = moveCount;
      }
      trackLossStats();
      commitGameStatsToLifetime();
      checkAndUnlockAchievements();
      notifyGameFinishedToEngine('loss');
      releaseEngineOnGameEnd();
      // Show rematch modal
      setTimeout(() => showRematchModal("You Resigned", "Would you like to play again?"), 2000);
    }

    function getRematchIcon(type) {
      const icons = {
        victory: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
        defeat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        draw: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="15" x2="16" y2="15"/></svg>',
        resign: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
        timeout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        default: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      };
      return icons[type] || icons.default;
    }

    function showRematchModal(title, message) {
      // Engine is already released via releaseEngineOnGameEnd() when the game ended.
      const modal = document.getElementById('rematch-modal');
      const iconEl = document.getElementById('rematch-icon');
      const titleEl = document.getElementById('rematch-title');
      const messageEl = document.getElementById('rematch-message');
      
      if (!modal || !titleEl || !messageEl) {
        console.error('Rematch modal elements not found');
        return;
      }
      
      let type = 'default';
      const t = (title || '').toLowerCase();
      if (t.includes('victory') || t.includes('won') || t.includes('🎉')) type = 'victory';
      else if (t.includes('defeat') || t.includes('checkmate') || t.includes('💔')) type = 'defeat';
      else if (t.includes('draw') || t.includes('🤝')) type = 'draw';
      else if (t.includes('resign')) type = 'resign';
      else if (t.includes('time') || t.includes('⏰')) type = 'timeout';
      else if (t.includes('connection') || t.includes('error') || t.includes('⚠')) type = 'error';

      const plainTitle = title.replace(/[\u{1F300}-\u{1F9FF}]|[\u2600-\u26FF]|[\u2700-\u27BF]/gu, '').trim() || title;
      if (iconEl) {
        iconEl.innerHTML = getRematchIcon(type);
        iconEl.style.color = type === 'victory' ? '#2ecc71' : type === 'defeat' ? '#e74c3c' : type === 'draw' ? '#f39c12' : '#3498db';
      }
      titleEl.textContent = plainTitle;
      messageEl.textContent = message;
      
      modal.style.left = '';
      modal.style.top = '';
      modal.style.position = 'fixed';
      modal.classList.add('show');
    }

    function closeRematchModal() {
      document.getElementById('rematch-modal').classList.remove('show');
    }

    function startRematch() {
      closeRematchModal();
      if (isHistoryReplayMode) {
        isHistoryReplayMode = false;
        replayModeBackup = null;
        const banR = document.getElementById('history-replay-banner');
        if (banR) banR.style.display = 'none';
      }
      
      // Reset game state
      gameOver = false;
      
      // Reset game
      if (game) {
        game.reset();
      }
      moveHistory = [];
      moveClockTimes = [];
      currentMoveIndex = -1;
      capturedPieces = { white: [], black: [] };
      lastMoveSquares = { from: null, to: null };
      premoves = [];
      selectedSquare = null;
      resetGameStats();
      
      // Reset UI
      document.getElementById("move-timer-container").innerHTML = 'Time for this move: <span id="timer">00:00.00</span>';
      updateLastMove(null, "00:00.00", 0, 0);
      updateTurnDisplay();
      updateGameStats();
      updateOpeningDisplay();
      document.getElementById("opening-display").style.display = "none";
      
      // Reset board
      if (board) {
        board.position('start');
      }
      
      // Clear highlights
      $("#board .square-55d63").removeClass("highlight-last-move highlight-check premove-highlight premove-source");
      
      // Reset timers
      const timeOption = document.getElementById("time-control").value;
      if (timeOption !== "none") {
        const [base, inc] = timeOption.split("|").map(Number);
        whiteTime = base ? base * 1000 : 0;
        blackTime = base ? base * 1000 : 0;
        increment = inc || 0;
        timeLimited = true;
        document.getElementById("white-total").textContent = formatTime(whiteTime);
        document.getElementById("black-total").textContent = formatTime(blackTime);
        document.getElementById("timers-container").style.display = "flex";
      } else {
        timeLimited = false;
        document.getElementById("timers-container").style.display = "none";
      }
      
      // Clear notation
      document.getElementById("notation-container").innerHTML = '';
      
      // Start new game
      startTimer();
      
      // Restart engine (rematch — same player, no need to re-check occupancy)
        sendEngineCommand("start").then((data) => {
        if (data && data.game_id) {
          setEngineGameId(data.game_id);
        }
        markEngineLockHeldByThisTab();
        startHeartbeat();
        setTrifangxLivePlayUrl();
        touchLiveGameSnapshot();
        if (playerColor === "black") {
          engineMove();
        }
      }).catch(err => console.error("Error restarting engine:", err));
    }

    // === NEW FEATURE FUNCTIONS ===

    function flipBoard() {
      if (!board || !game) return;
      const currentOrientation = board.orientation();
      const newOrientation = currentOrientation === 'white' ? 'black' : 'white';
      board.orientation(newOrientation);
      playSound('move');
      
      // Redraw arrows after board flip
      setTimeout(() => {
        drawArrows();
      }, 100);
    }

    function playSound(type) {
      if (!soundEnabled) return;
      
      // Create audio context for sound generation
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch(type) {
        case 'move':
          oscillator.frequency.value = 400;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
          break;
        case 'capture':
          oscillator.frequency.value = 600;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.15);
          break;
        case 'check':
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
          break;
        case 'checkmate':
          // Victory sound
          [400, 500, 600, 700].forEach((freq, i) => {
            setTimeout(() => {
              const osc = audioContext.createOscillator();
              const gain = audioContext.createGain();
              osc.connect(gain);
              gain.connect(audioContext.destination);
              osc.frequency.value = freq;
              osc.type = 'sine';
              gain.gain.setValueAtTime(0.2, audioContext.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
              osc.start(audioContext.currentTime);
              osc.stop(audioContext.currentTime + 0.3);
            }, i * 100);
          });
          break;
      }
    }

    function loadPlayerStats() {
      const saved = localStorage.getItem('playerStats');
      if (saved) {
        playerStats = JSON.parse(saved);
      }
    }

    function savePlayerStats() {
      localStorage.setItem('playerStats', JSON.stringify(playerStats));
    }

    function updatePlayerStatsDisplay() {
      const total = playerStats.wins + playerStats.losses + playerStats.draws;
      document.getElementById("total-games").textContent = total;
      document.getElementById("total-wins").textContent = playerStats.wins;
      document.getElementById("total-losses").textContent = playerStats.losses;
      document.getElementById("total-draws").textContent = playerStats.draws;
      // Draws count as half a win and half a loss for win rate
      const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
      const winRate = total > 0 ? Math.round((effectiveWins / total) * 100) : 0;
      document.getElementById("win-rate").textContent = winRate + '%';
      document.getElementById("win-rate").style.color = winRate >= 50 ? '#2ecc71' : winRate >= 30 ? '#f39c12' : '#e74c3c';
    }

    function checkAchievements() {
      // Calculate total points for point-gated achievements (from list definitions only).
      const allAchievements = getAllAchievementsList();
      let totalPoints = allAchievements.reduce((sum, ach) => {
        if (achievements.includes(ach.id) && ach.points) {
          return sum + ach.points;
        }
        return sum;
      }, 0);
      
      const newAchievements = [];
      
      // Check ALL achievements dynamically using their progress functions.
      // Daily achievements should ONLY be awardable if they're selected for today.
      resetDailyStatsIfNeeded();
      const todayDailyIds = getTodayDailyAchievements();
      
      allAchievements.forEach(ach => {
        // Skip if already unlocked
        if (achievements.includes(ach.id)) return;
        
        // Only award daily achievements that are active for TODAY
        if (ach.isDaily && !todayDailyIds.includes(ach.id)) {
          return;
        }
        
        // Check point requirements for locked achievements
        if (ach.requiredPoints && totalPoints < ach.requiredPoints) {
          return; // Not enough points yet
        }
        
        // Check if achievement has a progress function
        if (!ach.progress) return;
        
        try {
          const progress = ach.progress();
          // Check if achievement has additional requirements (like minimum games played)
          // needsTotal should be true or undefined (not false) to meet requirements
          const meetsRequirements = progress.needsTotal !== false;
          // needsNoLosses should be true or undefined (not false) to meet requirements
          const meetsNoLosses = progress.needsNoLosses !== false;
          
          // Only unlock if progress reaches target AND all requirements are met
          if (progress.current >= progress.target && progress.target > 0 && meetsRequirements && meetsNoLosses) {
            newAchievements.push({ 
              id: ach.id, 
              name: ach.name, 
              desc: ach.desc, 
              points: ach.points || 0 
            });
            achievements.push(ach.id);
            if (ach.points) totalPoints += ach.points;
          }
        } catch (e) {
          console.error('Error checking achievement', ach.id, e);
        }
      });
      
      return newAchievements; // Return new achievements instead of showing immediately
    }
    
    function checkAndUnlockAchievements() {
      // Run until no new unlocks: outer loop handles dependencies list order cannot express;
      // inner loop also grows totalPoints as achievements unlock so gates can cascade in one pass.
      const aggregatedNew = [];
      let iteration = 0;
      const maxIterations = 100;
      while (iteration++ < maxIterations) {
        const batch = checkAchievements();
        if (!batch.length) break;
        aggregatedNew.push(...batch);
        saveAchievements();
        updateAchievementsDisplay();
        updateTotalPoints();
      }
      if (iteration >= maxIterations) {
        console.warn('checkAndUnlockAchievements: max iterations reached; report if achievements look wrong.');
      }
      if (aggregatedNew.length > 0) {
        showAchievementNotificationsSequentially(aggregatedNew);
      }
    }

    function loadAchievements() {
  try {
      const saved = localStorage.getItem('achievements');
    const parsed = saved ? JSON.parse(saved) : [];
    
    // Safety check: if parsed data isn't an array, reset to empty array
    achievements = Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse achievements:", e);
    achievements = []; // Fallback on error
  }
}
    function saveAchievements() {
      localStorage.setItem('achievements', JSON.stringify(achievements));
      
      // Auto-sync to account
      if (typeof autoSync === 'function') autoSync();
    }

    /** Player's captures by opponent piece type today (committed + current game). */
    function getDailyPlayerCapturesByTypeMerged() {
      resetDailyStatsIfNeeded();
      const keys = ['p', 'n', 'b', 'r', 'q'];
      const lt = (lifetimeStats && lifetimeStats.dailyStats && lifetimeStats.dailyStats.playerCapturesByTypeToday) || {};
      const g = (typeof gameStats !== 'undefined' && gameStats && gameStats.dailyStats && gameStats.dailyStats.playerCapturesByType) || {};
      const out = {};
      keys.forEach(k => { out[k] = (lt[k] || 0) + (g[k] || 0); });
      return out;
    }

    function getAllAchievementsList() {
      return [
        // Points tuned by difficulty: trivial < easy < grind < rare < extreme; win-rate feats pay more than raw counts.
        { id: 'first_game', name: '🎮 First Game', desc: 'Played your first game', category: 'General', points: 12, groupKey: 'games_played', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 1 };
        }},
        { id: 'fifty_games', name: '📊 Fifty Games', desc: 'Played 50 games', category: 'General', points: 85, groupKey: 'games_played', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 50 };
        }},
        { id: 'century', name: '💯 Century Club', desc: 'Played 100 games', category: 'General', points: 180, groupKey: 'games_played', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 100 };
        }},
        { id: 'two_fifty', name: '📈 Two Fifty', desc: 'Played 250 games', category: 'General', points: 480, groupKey: 'games_played', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 250 };
        }},
        { id: 'five_hundred', name: '🎲 Five Hundred', desc: 'Played 500 games', category: 'General', points: 950, groupKey: 'games_played', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 500 };
        }},
        { id: 'first_win', name: '🏆 First Victory', desc: 'Won your first game', category: 'General', points: 30, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 1 };
        }},
        { id: 'three_wins', name: '🔥 Three Wins', desc: 'Won 3 games', category: 'General', points: 30, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 3 };
        }},
        { id: 'five_wins', name: '⚡ Five Wins', desc: 'Won 5 games', category: 'General', points: 55, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 5 };
        }},
        { id: 'ten_wins', name: '⭐ Decade of Wins', desc: 'Won 10 games', category: 'General', points: 90, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 10 };
        }},
        { id: 'fifteen_wins', name: '🌟 Fifteen Wins', desc: 'Won 15 games', category: 'General', points: 115, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 15 };
        }},
        { id: 'quarter_century', name: '🎯 Quarter Century', desc: 'Won 25 games', category: 'General', points: 175, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 25 };
        }},
        { id: 'fifty_wins', name: '👑 Master Player', desc: 'Won 50 games', category: 'General', points: 240, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 50 };
        }},
        { id: 'centurion', name: '💯 Centurion', desc: 'Won 100 games', category: 'General', points: 600, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 100 };
        }},
        { id: 'double_centurion', name: '💯💯 Double Centurion', desc: 'Won 200 games', category: 'General', points: 1200, requiredPoints: 8000, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 200 };
        }},
        { id: 'half_millennium', name: '🏆 Half Millennium', desc: 'Won 500 games', category: 'General', points: 3200, requiredPoints: 25000, groupKey: 'wins', progress: () => {
          return { current: playerStats.wins, target: 500 };
        }},
        { id: 'good_player', name: '👍 Good Player', desc: '60%+ win rate (10+ games)', category: 'General', points: 110, groupKey: 'win_rate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 10) return { current: 0, target: 60, needsTotal: false };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: Math.round(winRate), target: 60, needsTotal: true };
        }},
        { id: 'excellent', name: '🌟 Excellent Player', desc: '70%+ win rate (10+ games)', category: 'General', points: 240, groupKey: 'win_rate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 10) return { current: 0, target: 70, needsTotal: false };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: Math.round(winRate), target: 70, needsTotal: true };
        }},
        { id: 'grandmaster', name: '🎖️ Grandmaster', desc: '80%+ win rate (20+ games)', category: 'General', points: 400, groupKey: 'win_rate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 20) return { current: 0, target: 80, needsTotal: false };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: Math.round(winRate), target: 80, needsTotal: true };
        }},
        { id: 'near_perfect', name: '✨ Near Perfect', desc: '90%+ win rate (20+ games)', category: 'General', points: 900, requiredPoints: 12000, groupKey: 'win_rate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 20) return { current: 0, target: 90, needsTotal: false };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: Math.round(winRate), target: 90, needsTotal: true };
        }},
        { id: 'peacemaker', name: '🤝 Peacemaker', desc: 'Drew 10 games', category: 'General', points: 110, groupKey: 'draws', progress: () => {
          return { current: playerStats.draws, target: 10 };
        }},
        { id: 'diplomat', name: '🤝 Diplomat', desc: 'Drew 25 games', category: 'General', points: 240, groupKey: 'draws', progress: () => {
          return { current: playerStats.draws, target: 25 };
        }},
        
        // Material hunters — how many enemy pieces of that type you took (victim type). Not which of your pieces made the capture.
        { id: 'queen_hunter_5', name: '👸 Queen Hunter', desc: 'Took 5 enemy queens', category: 'In-Game', points: 450, requiredPoints: 1800, groupKey: 'captured_queens', progress: () => {
          return { current: (lifetimeStats.capturedQueens || 0), target: 5 };
        }},
        { id: 'queen_hunter_10', name: '👸 Queen Slayer', desc: 'Took 10 enemy queens', category: 'In-Game', points: 1100, requiredPoints: 10000, groupKey: 'captured_queens', progress: () => {
          return { current: (lifetimeStats.capturedQueens || 0), target: 10 };
        }},
        { id: 'queen_hunter_25', name: '👸 Queen Reaper', desc: 'Took 25 enemy queens', category: 'In-Game', points: 3200, requiredPoints: 35000, groupKey: 'captured_queens', progress: () => {
          return { current: (lifetimeStats.capturedQueens || 0), target: 25 };
        }},
        { id: 'queen_hunter_50', name: '👸 Queen Annihilator', desc: 'Took 50 enemy queens', category: 'In-Game', points: 7500, requiredPoints: 80000, groupKey: 'captured_queens', progress: () => {
          return { current: (lifetimeStats.capturedQueens || 0), target: 50 };
        }},
        { id: 'rook_hunter_10', name: '🏰 Rook Hunter', desc: 'Took 10 enemy rooks', category: 'In-Game', points: 200, groupKey: 'captured_rooks', progress: () => {
          return { current: (lifetimeStats.capturedRooks || 0), target: 10 };
        }},
        { id: 'rook_hunter_25', name: '🏰 Rook Slayer', desc: 'Took 25 enemy rooks', category: 'In-Game', points: 480, requiredPoints: 4000, groupKey: 'captured_rooks', progress: () => {
          return { current: (lifetimeStats.capturedRooks || 0), target: 25 };
        }},
        { id: 'rook_hunter_50', name: '🏰 Rook Marauder', desc: 'Took 50 enemy rooks', category: 'In-Game', points: 950, requiredPoints: 12000, groupKey: 'captured_rooks', progress: () => {
          return { current: (lifetimeStats.capturedRooks || 0), target: 50 };
        }},
        { id: 'rook_hunter_75', name: '🏰 Rook Warlord', desc: 'Took 75 enemy rooks', category: 'In-Game', points: 1500, requiredPoints: 25000, groupKey: 'captured_rooks', progress: () => {
          return { current: (lifetimeStats.capturedRooks || 0), target: 75 };
        }},
        { id: 'rook_hunter_100', name: '🏰 Rook Immortal', desc: 'Took 100 enemy rooks', category: 'In-Game', points: 2200, requiredPoints: 40000, groupKey: 'captured_rooks', progress: () => {
          return { current: (lifetimeStats.capturedRooks || 0), target: 100 };
        }},
        { id: 'bishop_hunter_10', name: '♗ Bishop Hunter', desc: 'Took 10 enemy bishops', category: 'In-Game', points: 200, groupKey: 'captured_bishops', progress: () => {
          return { current: (lifetimeStats.capturedBishops || 0), target: 10 };
        }},
        { id: 'bishop_hunter_25', name: '♗ Bishop Slayer', desc: 'Took 25 enemy bishops', category: 'In-Game', points: 480, requiredPoints: 4000, groupKey: 'captured_bishops', progress: () => {
          return { current: (lifetimeStats.capturedBishops || 0), target: 25 };
        }},
        { id: 'bishop_hunter_50', name: '♗ Bishop Marauder', desc: 'Took 50 enemy bishops', category: 'In-Game', points: 950, requiredPoints: 12000, groupKey: 'captured_bishops', progress: () => {
          return { current: (lifetimeStats.capturedBishops || 0), target: 50 };
        }},
        { id: 'bishop_hunter_75', name: '♗ Bishop Warlord', desc: 'Took 75 enemy bishops', category: 'In-Game', points: 1500, requiredPoints: 25000, groupKey: 'captured_bishops', progress: () => {
          return { current: (lifetimeStats.capturedBishops || 0), target: 75 };
        }},
        { id: 'bishop_hunter_100', name: '♗ Bishop Immortal', desc: 'Took 100 enemy bishops', category: 'In-Game', points: 2200, requiredPoints: 40000, groupKey: 'captured_bishops', progress: () => {
          return { current: (lifetimeStats.capturedBishops || 0), target: 100 };
        }},
        { id: 'knight_hunter_10', name: '🐴 Knight Hunter', desc: 'Took 10 enemy knights', category: 'In-Game', points: 200, groupKey: 'captured_knights', progress: () => {
          return { current: (lifetimeStats.capturedKnights || 0), target: 10 };
        }},
        { id: 'knight_hunter_25', name: '🐴 Knight Slayer', desc: 'Took 25 enemy knights', category: 'In-Game', points: 480, requiredPoints: 4000, groupKey: 'captured_knights', progress: () => {
          return { current: (lifetimeStats.capturedKnights || 0), target: 25 };
        }},
        { id: 'knight_hunter_50', name: '🐴 Knight Marauder', desc: 'Took 50 enemy knights', category: 'In-Game', points: 950, requiredPoints: 12000, groupKey: 'captured_knights', progress: () => {
          return { current: (lifetimeStats.capturedKnights || 0), target: 50 };
        }},
        { id: 'knight_hunter_75', name: '🐴 Knight Warlord', desc: 'Took 75 enemy knights', category: 'In-Game', points: 1500, requiredPoints: 25000, groupKey: 'captured_knights', progress: () => {
          return { current: (lifetimeStats.capturedKnights || 0), target: 75 };
        }},
        { id: 'knight_hunter_100', name: '🐴 Knight Immortal', desc: 'Took 100 enemy knights', category: 'In-Game', points: 2200, requiredPoints: 40000, groupKey: 'captured_knights', progress: () => {
          return { current: (lifetimeStats.capturedKnights || 0), target: 100 };
        }},
        { id: 'pawn_hunter_50', name: '♟️ Pawn Hunter', desc: 'Took 50 enemy pawns', category: 'In-Game', points: 180, groupKey: 'captured_pawns', progress: () => {
          return { current: (lifetimeStats.capturedPawns || 0), target: 50 };
        }},
        { id: 'pawn_hunter_100', name: '♟️ Pawn Slayer', desc: 'Took 100 enemy pawns', category: 'In-Game', points: 420, groupKey: 'captured_pawns', progress: () => {
          return { current: (lifetimeStats.capturedPawns || 0), target: 100 };
        }},
        { id: 'pawn_hunter_200', name: '♟️ Pawn Reaper', desc: 'Took 200 enemy pawns', category: 'In-Game', points: 900, requiredPoints: 8000, groupKey: 'captured_pawns', progress: () => {
          return { current: (lifetimeStats.capturedPawns || 0), target: 200 };
        }},
        { id: 'pawn_hunter_350', name: '♟️ Pawn Avalanche', desc: 'Took 350 enemy pawns', category: 'In-Game', points: 1600, requiredPoints: 20000, groupKey: 'captured_pawns', progress: () => {
          return { current: (lifetimeStats.capturedPawns || 0), target: 350 };
        }},
        { id: 'pawn_hunter_500', name: '♟️ Pawn Apocalypse', desc: 'Took 500 enemy pawns', category: 'In-Game', points: 2600, requiredPoints: 45000, groupKey: 'captured_pawns', progress: () => {
          return { current: (lifetimeStats.capturedPawns || 0), target: 500 };
        }},
        
        // Striking power — captures made by your moving piece (your queen, rook, etc.); counts any victim type.
        { id: 'queen_capturer', name: '👸 Queen Capturer', desc: 'Made 10 captures with your queen (moving piece)', category: 'In-Game', points: 120, groupKey: 'captures_with_queen', progress: () => {
          return { current: (lifetimeStats.capturesByQueen || 0), target: 10 };
        }},
        { id: 'queen_master', name: '👸 Queen Master', desc: 'Made 25 captures with your queen (moving piece)', category: 'In-Game', points: 350, groupKey: 'captures_with_queen', progress: () => {
          return { current: (lifetimeStats.capturesByQueen || 0), target: 25 };
        }},
        { id: 'queen_legend', name: '👑 Queen Legend', desc: 'Made 50 captures with your queen (moving piece)', category: 'In-Game', points: 800, requiredPoints: 6000, groupKey: 'captures_with_queen', progress: () => {
          return { current: (lifetimeStats.capturesByQueen || 0), target: 50 };
        }},
        { id: 'queen_tactician', name: '👑 Queen Tactician', desc: 'Made 75 captures with your queen (moving piece)', category: 'In-Game', points: 1400, requiredPoints: 18000, groupKey: 'captures_with_queen', progress: () => {
          return { current: (lifetimeStats.capturesByQueen || 0), target: 75 };
        }},
        { id: 'queen_executioner', name: '👑 Queen Executioner', desc: 'Made 100 captures with your queen (moving piece)', category: 'In-Game', points: 2200, requiredPoints: 35000, groupKey: 'captures_with_queen', progress: () => {
          return { current: (lifetimeStats.capturesByQueen || 0), target: 100 };
        }},
        { id: 'rook_capturer', name: '🏰 Rook Capturer', desc: 'Made 10 captures with your rook (moving piece)', category: 'In-Game', points: 110, groupKey: 'captures_with_rook', progress: () => {
          return { current: (lifetimeStats.capturesByRook || 0), target: 10 };
        }},
        { id: 'rook_master', name: '🏰 Rook Master', desc: 'Made 25 captures with your rook (moving piece)', category: 'In-Game', points: 300, groupKey: 'captures_with_rook', progress: () => {
          return { current: (lifetimeStats.capturesByRook || 0), target: 25 };
        }},
        { id: 'rook_legend', name: '🏰 Rook Legend', desc: 'Made 50 captures with your rook (moving piece)', category: 'In-Game', points: 650, requiredPoints: 6000, groupKey: 'captures_with_rook', progress: () => {
          return { current: (lifetimeStats.capturesByRook || 0), target: 50 };
        }},
        { id: 'rook_tactician', name: '🏰 Rook Tactician', desc: 'Made 75 captures with your rook (moving piece)', category: 'In-Game', points: 1100, requiredPoints: 18000, groupKey: 'captures_with_rook', progress: () => {
          return { current: (lifetimeStats.capturesByRook || 0), target: 75 };
        }},
        { id: 'rook_executioner', name: '🏰 Rook Executioner', desc: 'Made 100 captures with your rook (moving piece)', category: 'In-Game', points: 1700, requiredPoints: 35000, groupKey: 'captures_with_rook', progress: () => {
          return { current: (lifetimeStats.capturesByRook || 0), target: 100 };
        }},
        { id: 'bishop_capturer', name: '♗ Bishop Capturer', desc: 'Made 10 captures with your bishop (moving piece)', category: 'In-Game', points: 115, groupKey: 'captures_with_bishop', progress: () => {
          return { current: (lifetimeStats.capturesByBishop || 0), target: 10 };
        }},
        { id: 'bishop_master', name: '♗ Bishop Master', desc: 'Made 25 captures with your bishop (moving piece)', category: 'In-Game', points: 300, groupKey: 'captures_with_bishop', progress: () => {
          return { current: (lifetimeStats.capturesByBishop || 0), target: 25 };
        }},
        { id: 'bishop_legend', name: '♗ Bishop Legend', desc: 'Made 50 captures with your bishop (moving piece)', category: 'In-Game', points: 650, requiredPoints: 6000, groupKey: 'captures_with_bishop', progress: () => {
          return { current: (lifetimeStats.capturesByBishop || 0), target: 50 };
        }},
        { id: 'bishop_tactician', name: '♗ Bishop Tactician', desc: 'Made 75 captures with your bishop (moving piece)', category: 'In-Game', points: 1100, requiredPoints: 18000, groupKey: 'captures_with_bishop', progress: () => {
          return { current: (lifetimeStats.capturesByBishop || 0), target: 75 };
        }},
        { id: 'bishop_executioner', name: '♗ Bishop Executioner', desc: 'Made 100 captures with your bishop (moving piece)', category: 'In-Game', points: 1700, requiredPoints: 35000, groupKey: 'captures_with_bishop', progress: () => {
          return { current: (lifetimeStats.capturesByBishop || 0), target: 100 };
        }},
        { id: 'knight_capturer', name: '🐴 Knight Capturer', desc: 'Made 10 captures with your knight (moving piece)', category: 'In-Game', points: 125, groupKey: 'captures_with_knight', progress: () => {
          return { current: (lifetimeStats.capturesByKnight || 0), target: 10 };
        }},
        { id: 'knight_master', name: '🐴 Knight Master', desc: 'Made 25 captures with your knight (moving piece)', category: 'In-Game', points: 300, groupKey: 'captures_with_knight', progress: () => {
          return { current: (lifetimeStats.capturesByKnight || 0), target: 25 };
        }},
        { id: 'knight_legend', name: '🐴 Knight Legend', desc: 'Made 50 captures with your knight (moving piece)', category: 'In-Game', points: 650, requiredPoints: 6000, groupKey: 'captures_with_knight', progress: () => {
          return { current: (lifetimeStats.capturesByKnight || 0), target: 50 };
        }},
        { id: 'knight_tactician', name: '🐴 Knight Tactician', desc: 'Made 75 captures with your knight (moving piece)', category: 'In-Game', points: 1100, requiredPoints: 18000, groupKey: 'captures_with_knight', progress: () => {
          return { current: (lifetimeStats.capturesByKnight || 0), target: 75 };
        }},
        { id: 'knight_executioner', name: '🐴 Knight Executioner', desc: 'Made 100 captures with your knight (moving piece)', category: 'In-Game', points: 1700, requiredPoints: 35000, groupKey: 'captures_with_knight', progress: () => {
          return { current: (lifetimeStats.capturesByKnight || 0), target: 100 };
        }},
        { id: 'pawn_capturer', name: '♟️ Pawn Capturer', desc: 'Made 10 captures with your pawn (moving piece)', category: 'In-Game', points: 140, groupKey: 'captures_with_pawn', progress: () => {
          return { current: (lifetimeStats.capturesByPawn || 0), target: 10 };
        }},
        { id: 'pawn_master', name: '♟️ Pawn Master', desc: 'Made 25 captures with your pawn (moving piece)', category: 'In-Game', points: 380, groupKey: 'captures_with_pawn', progress: () => {
          return { current: (lifetimeStats.capturesByPawn || 0), target: 25 };
        }},
        { id: 'pawn_legend', name: '♟️ Pawn Legend', desc: 'Made 50 captures with your pawn (moving piece)', category: 'In-Game', points: 800, requiredPoints: 6000, groupKey: 'captures_with_pawn', progress: () => {
          return { current: (lifetimeStats.capturesByPawn || 0), target: 50 };
        }},
        { id: 'pawn_tactician', name: '♟️ Pawn Tactician', desc: 'Made 75 captures with your pawn (moving piece)', category: 'In-Game', points: 1300, requiredPoints: 18000, groupKey: 'captures_with_pawn', progress: () => {
          return { current: (lifetimeStats.capturesByPawn || 0), target: 75 };
        }},
        { id: 'pawn_executioner', name: '♟️ Pawn Executioner', desc: 'Made 100 captures with your pawn (moving piece)', category: 'In-Game', points: 1900, requiredPoints: 35000, groupKey: 'captures_with_pawn', progress: () => {
          return { current: (lifetimeStats.capturesByPawn || 0), target: 100 };
        }},
        { id: 'capture_master', name: '⚔️ Capture Master', desc: 'Made 50 captures total (any of your pieces)', category: 'In-Game', points: 220, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 50 };
        }},
        { id: 'capture_legend', name: '🗡️ Capture Legend', desc: 'Made 100 captures total (any of your pieces)', category: 'In-Game', points: 450, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 100 };
        }},
        { id: 'capture_king', name: '👑 Capture King', desc: 'Made 200 captures total (any of your pieces)', category: 'In-Game', points: 900, requiredPoints: 9000, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 200 };
        }},
        { id: 'capture_god', name: '⚡ Capture God', desc: 'Made 500 captures total (any of your pieces)', category: 'In-Game', points: 2200, requiredPoints: 32000, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 500 };
        }},
        { id: 'capture_titan', name: '🌠 Capture Titan', desc: 'Made 1000 captures total (any of your pieces)', category: 'In-Game', points: 4800, requiredPoints: 70000, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 1000 };
        }},
        { id: 'capture_mythic', name: '✴️ Capture Mythic', desc: 'Made 2000 captures total (any of your pieces)', category: 'In-Game', points: 10000, requiredPoints: 150000, groupKey: 'total_captures', progress: () => {
          return { current: (lifetimeStats.totalCaptures || 0), target: 2000 };
        }},
        { id: 'castler', name: '🏰 Castler', desc: 'Castled 5 times', category: 'In-Game', points: 90, groupKey: 'castling', progress: () => {
          return { current: (lifetimeStats.castlingMoves || 0), target: 5 };
        }},
        { id: 'castling_master', name: '🏰 Castling Master', desc: 'Castled 10 times', category: 'In-Game', points: 180, groupKey: 'castling', progress: () => {
          return { current: (lifetimeStats.castlingMoves || 0), target: 10 };
        }},
        { id: 'castling_legend', name: '🏰 Castling Legend', desc: 'Castled 25 times', category: 'In-Game', points: 450, requiredPoints: 2800, groupKey: 'castling', progress: () => {
          return { current: (lifetimeStats.castlingMoves || 0), target: 25 };
        }},
        { id: 'castling_sovereign', name: '🏰 Castling Sovereign', desc: 'Castled 50 times', category: 'In-Game', points: 900, requiredPoints: 12000, groupKey: 'castling', progress: () => {
          return { current: (lifetimeStats.castlingMoves || 0), target: 50 };
        }},
        { id: 'castling_immortal', name: '🏰 Castling Immortal', desc: 'Castled 100 times', category: 'In-Game', points: 1800, requiredPoints: 40000, groupKey: 'castling', progress: () => {
          return { current: (lifetimeStats.castlingMoves || 0), target: 100 };
        }},
        { id: 'promoter', name: '⬆️ Promoter', desc: 'Promoted 5 pawns', category: 'In-Game', points: 140, groupKey: 'promotions', progress: () => {
          return { current: (lifetimeStats.promotions || 0), target: 5 };
        }},
        { id: 'promotion_master', name: '⬆️ Promotion Master', desc: 'Promoted 10 pawns', category: 'In-Game', points: 280, groupKey: 'promotions', progress: () => {
          return { current: (lifetimeStats.promotions || 0), target: 10 };
        }},
        { id: 'promotion_legend', name: '⬆️ Promotion Legend', desc: 'Promoted 25 pawns', category: 'In-Game', points: 550, requiredPoints: 2800, groupKey: 'promotions', progress: () => {
          return { current: (lifetimeStats.promotions || 0), target: 25 };
        }},
        { id: 'promotion_sovereign', name: '⬆️ Promotion Sovereign', desc: 'Promoted 50 pawns', category: 'In-Game', points: 1100, requiredPoints: 12000, groupKey: 'promotions', progress: () => {
          return { current: (lifetimeStats.promotions || 0), target: 50 };
        }},
        { id: 'promotion_immortal', name: '⬆️ Promotion Immortal', desc: 'Promoted 100 pawns', category: 'In-Game', points: 2200, requiredPoints: 40000, groupKey: 'promotions', progress: () => {
          return { current: (lifetimeStats.promotions || 0), target: 100 };
        }},
        { id: 'en_passant', name: '🎯 En Passant', desc: 'Performed an en passant capture', category: 'In-Game', points: 140, groupKey: 'en_passants', progress: () => {
          return { current: (lifetimeStats.enPassants || 0), target: 1 };
        }},
        { id: 'en_passant_master', name: '🎯 En Passant Master', desc: 'Performed 3 en passants', category: 'In-Game', points: 380, requiredPoints: 1400, groupKey: 'en_passants', progress: () => {
          return { current: (lifetimeStats.enPassants || 0), target: 3 };
        }},
        { id: 'en_passant_legend', name: '🎯 En Passant Legend', desc: 'Performed 10 en passants', category: 'In-Game', points: 950, requiredPoints: 22000, groupKey: 'en_passants', progress: () => {
          return { current: (lifetimeStats.enPassants || 0), target: 10 };
        }},
        { id: 'en_passant_mythic', name: '🎯 En Passant Mythic', desc: 'Performed 25 en passants', category: 'In-Game', points: 2400, requiredPoints: 60000, groupKey: 'en_passants', progress: () => {
          return { current: (lifetimeStats.enPassants || 0), target: 25 };
        }},
        { id: 'check_giver', name: '✓ Check Giver', desc: 'Gave 50 checks', category: 'In-Game', points: 180, groupKey: 'checks', progress: () => {
          return { current: (lifetimeStats.checksGiven || 0), target: 50 };
        }},
        { id: 'check_master', name: '✓ Check Master', desc: 'Gave 100 checks', category: 'In-Game', points: 380, groupKey: 'checks', progress: () => {
          return { current: (lifetimeStats.checksGiven || 0), target: 100 };
        }},
        { id: 'check_legend', name: '✓ Check Legend', desc: 'Gave 250 checks', category: 'In-Game', points: 750, requiredPoints: 14000, groupKey: 'checks', progress: () => {
          return { current: (lifetimeStats.checksGiven || 0), target: 250 };
        }},
        { id: 'check_forge', name: '✓ Check Forge', desc: 'Gave 500 checks', category: 'In-Game', points: 1500, requiredPoints: 45000, groupKey: 'checks', progress: () => {
          return { current: (lifetimeStats.checksGiven || 0), target: 500 };
        }},
        { id: 'check_apocalypse', name: '✓ Check Apocalypse', desc: 'Gave 1000 checks', category: 'In-Game', points: 2800, requiredPoints: 90000, groupKey: 'checks', progress: () => {
          return { current: (lifetimeStats.checksGiven || 0), target: 1000 };
        }},
        
        // Random/Fun Achievements - Grouped with varied requirements
        { id: 'move_to_e4', name: '🎯 E4 Enthusiast', desc: 'Moved to e4', category: 'Random', points: 25, groupKey: 'moves_to_e4', progress: () => {
          return { current: (lifetimeStats.movesToE4 || 0), target: 1 };
        }},
        { id: 'move_to_e4_5', name: '🎯 E4 Lover', desc: 'Moved to e4 five times', category: 'Random', points: 75, groupKey: 'moves_to_e4', progress: () => {
          return { current: (lifetimeStats.movesToE4Multiple || 0), target: 5 };
        }},
        { id: 'move_to_e4_10', name: '🎯 E4 Master', desc: 'Moved to e4 ten times', category: 'Random', points: 150, groupKey: 'moves_to_e4', progress: () => {
          return { current: (lifetimeStats.movesToE4Multiple || 0), target: 10 };
        }},
        { id: 'move_to_d4', name: '🎯 D4 Devotee', desc: 'Moved to d4', category: 'Random', points: 25, groupKey: 'moves_to_d4', progress: () => {
          return { current: ((lifetimeStats.movesToD4 || 0) + ((gameStats && gameStats.movesToD4) || 0)), target: 1 };
        }},
        { id: 'move_to_d4_5', name: '🎯 D4 Lover', desc: 'Moved to d4 five times', category: 'Random', points: 75, groupKey: 'moves_to_d4', progress: () => {
          return { current: ((lifetimeStats.movesToD4Multiple || 0) + ((gameStats && gameStats.movesToD4Multiple) || 0)), target: 5 };
        }},
        { id: 'move_to_d4_10', name: '🎯 D4 Master', desc: 'Moved to d4 ten times', category: 'Random', points: 150, groupKey: 'moves_to_d4', progress: () => {
          return { current: ((lifetimeStats.movesToD4Multiple || 0) + ((gameStats && gameStats.movesToD4Multiple) || 0)), target: 10 };
        }},
        { id: 'move_to_d4_25', name: '🎯 D4 Expert', desc: 'Moved to d4 twenty-five times', category: 'Random', points: 300, groupKey: 'moves_to_d4', progress: () => {
          return { current: ((lifetimeStats.movesToD4Multiple || 0) + ((gameStats && gameStats.movesToD4Multiple) || 0)), target: 25 };
        }},
        { id: 'move_to_d4_50', name: '🎯 D4 Legend', desc: 'Moved to d4 fifty times', category: 'Random', points: 500, groupKey: 'moves_to_d4', progress: () => {
          return { current: ((lifetimeStats.movesToD4Multiple || 0) + ((gameStats && gameStats.movesToD4Multiple) || 0)), target: 50 };
        }},
        { id: 'pawn_to_e4', name: '♟️ E4 Pawn', desc: 'Moved a pawn to e4', category: 'Random', points: 30, groupKey: 'pawn_to_e4', progress: () => {
          return { current: ((lifetimeStats.pawnToE4 || 0) + ((gameStats && gameStats.pawnToE4) || 0)), target: 1 };
        }},
        { id: 'pawn_to_e4_3', name: '♟️ E4 Pawn Master', desc: 'Moved a pawn to e4 three times', category: 'Random', points: 100, groupKey: 'pawn_to_e4', progress: () => {
          return { current: ((lifetimeStats.pawnToE4 || 0) + ((gameStats && gameStats.pawnToE4) || 0)), target: 3 };
        }},
        { id: 'pawn_to_e4_10', name: '♟️ E4 Pawn Expert', desc: 'Moved a pawn to e4 ten times', category: 'Random', points: 250, groupKey: 'pawn_to_e4', progress: () => {
          return { current: ((lifetimeStats.pawnToE4 || 0) + ((gameStats && gameStats.pawnToE4) || 0)), target: 10 };
        }},
        { id: 'pawn_to_e4_25', name: '♟️ E4 Pawn Legend', desc: 'Moved a pawn to e4 twenty-five times', category: 'Random', points: 500, groupKey: 'pawn_to_e4', progress: () => {
          return { current: ((lifetimeStats.pawnToE4 || 0) + ((gameStats && gameStats.pawnToE4) || 0)), target: 25 };
        }},
        { id: 'pawn_to_d4', name: '♟️ D4 Pawn', desc: 'Moved a pawn to d4', category: 'Random', points: 30, groupKey: 'pawn_to_d4', progress: () => {
          return { current: ((lifetimeStats.pawnToD4 || 0) + ((gameStats && gameStats.pawnToD4) || 0)), target: 1 };
        }},
        { id: 'pawn_to_d4_3', name: '♟️ D4 Pawn Master', desc: 'Moved a pawn to d4 three times', category: 'Random', points: 100, groupKey: 'pawn_to_d4', progress: () => {
          return { current: ((lifetimeStats.pawnToD4 || 0) + ((gameStats && gameStats.pawnToD4) || 0)), target: 3 };
        }},
        { id: 'pawn_to_d4_10', name: '♟️ D4 Pawn Expert', desc: 'Moved a pawn to d4 ten times', category: 'Random', points: 250, groupKey: 'pawn_to_d4', progress: () => {
          return { current: ((lifetimeStats.pawnToD4 || 0) + ((gameStats && gameStats.pawnToD4) || 0)), target: 10 };
        }},
        { id: 'pawn_to_d4_25', name: '♟️ D4 Pawn Legend', desc: 'Moved a pawn to d4 twenty-five times', category: 'Random', points: 500, groupKey: 'pawn_to_d4', progress: () => {
          return { current: ((lifetimeStats.pawnToD4 || 0) + ((gameStats && gameStats.pawnToD4) || 0)), target: 25 };
        }},
        { id: 'knight_to_f3', name: '🐴 F3 Knight', desc: 'Moved a knight to f3', category: 'Random', points: 20, groupKey: 'knight_to_f3', progress: () => {
          return { current: (lifetimeStats.knightToF3 || 0), target: 1 };
        }},
        { id: 'knight_to_f3_5', name: '🐴 F3 Knight Master', desc: 'Moved a knight to f3 five times', category: 'Random', points: 75, groupKey: 'knight_to_f3', progress: () => {
          return { current: (lifetimeStats.knightToF3Multiple || 0), target: 5 };
        }},
        { id: 'knight_to_c3', name: '🐴 C3 Knight', desc: 'Moved a knight to c3', category: 'Random', points: 20, groupKey: 'knight_to_c3', progress: () => {
          return { current: (lifetimeStats.knightToC3 || 0), target: 1 };
        }},
        { id: 'knight_to_c3_5', name: '🐴 C3 Knight Master', desc: 'Moved a knight to c3 five times', category: 'Random', points: 75, groupKey: 'knight_to_c3', progress: () => {
          return { current: (lifetimeStats.knightToC3Multiple || 0), target: 5 };
        }},
        { id: 'queen_to_d4', name: '👸 Queen to D4', desc: 'Moved queen to d4', category: 'Random', points: 50, groupKey: 'queen_to_d4', progress: () => {
          return { current: (lifetimeStats.queenToD4 || 0), target: 1 };
        }},
        { id: 'queen_to_d4_3', name: '👸 Queen to D4 Master', desc: 'Moved queen to d4 three times', category: 'Random', points: 150, groupKey: 'queen_to_d4', progress: () => {
          return { current: (lifetimeStats.queenToD4Multiple || 0), target: 3 };
        }},
        { id: 'queen_to_e4', name: '👸 Queen to E4', desc: 'Moved queen to e4', category: 'Random', points: 50, groupKey: 'queen_to_e4', progress: () => {
          return { current: (lifetimeStats.queenToE4 || 0), target: 1 };
        }},
        { id: 'queen_to_e4_3', name: '👸 Queen to E4 Master', desc: 'Moved queen to e4 three times', category: 'Random', points: 150, groupKey: 'queen_to_e4', progress: () => {
          return { current: (lifetimeStats.queenToE4 || 0), target: 3 };
        }},
        { id: 'bishop_to_f4', name: '♗ Bishop to F4', desc: 'Moved bishop to f4', category: 'Random', points: 30, groupKey: 'bishop_to_f4', progress: () => {
          return { current: (lifetimeStats.bishopToF4 || 0), target: 1 };
        }},
        { id: 'bishop_to_f4_3', name: '♗ Bishop to F4 Master', desc: 'Moved bishop to f4 three times', category: 'Random', points: 100, groupKey: 'bishop_to_f4', progress: () => {
          return { current: (lifetimeStats.bishopToF4 || 0), target: 3 };
        }},
        { id: 'rook_to_e1', name: '🏰 Rook to E1', desc: 'Moved rook to e1', category: 'Random', points: 30, groupKey: 'rook_to_e1', progress: () => {
          return { current: (lifetimeStats.rookToE1 || 0), target: 1 };
        }},
        { id: 'rook_to_e1_3', name: '🏰 Rook to E1 Master', desc: 'Moved rook to e1 three times', category: 'Random', points: 100, groupKey: 'rook_to_e1', progress: () => {
          return { current: (lifetimeStats.rookToE1 || 0), target: 3 };
        }},
        { id: 'king_to_e1', name: '👑 King to E1', desc: 'Moved king to e1', category: 'Random', points: 40, groupKey: 'king_to_e1', progress: () => {
          return { current: (lifetimeStats.kingToE1 || 0), target: 1 };
        }},
        { id: 'king_to_e1_3', name: '👑 King to E1 Master', desc: 'Moved king to e1 three times', category: 'Random', points: 120, groupKey: 'king_to_e1', progress: () => {
          return { current: (lifetimeStats.kingToE1 || 0), target: 3 };
        }},
        { id: 'move_on_1', name: '1️⃣ First Move', desc: 'Made a move on move 1', category: 'Random', points: 15, groupKey: 'moves_on_1', progress: () => {
          return { current: (lifetimeStats.movesOnMove1 || 0), target: 1 };
        }},
        { id: 'move_on_5', name: '5️⃣ Fifth Move', desc: 'Made a move on move 5', category: 'Random', points: 20, groupKey: 'moves_on_5', progress: () => {
          return { current: (lifetimeStats.movesOnMove5 || 0), target: 1 };
        }},
        { id: 'move_on_10', name: '🔟 Tenth Move', desc: 'Made a move on move 10', category: 'Random', points: 25, groupKey: 'moves_on_10', progress: () => {
          return { current: (lifetimeStats.movesOnMove10 || 0), target: 1 };
        }},
        { id: 'move_on_20', name: '2️⃣0️⃣ Twentieth Move', desc: 'Made a move on move 20', category: 'Random', points: 30, groupKey: 'moves_on_20', progress: () => {
          return { current: (lifetimeStats.movesOnMove20 || 0), target: 1 };
        }},
        { id: 'move_on_50', name: '5️⃣0️⃣ Fiftieth Move', desc: 'Made a move on move 50', category: 'Random', points: 50, groupKey: 'moves_on_50', progress: () => {
          return { current: (lifetimeStats.movesOnMove50 || 0), target: 1 };
        }},
        { id: 'castle_on_10', name: '🏰 Castle on 10', desc: 'Castled on your 10th move', category: 'Random', points: 75, groupKey: 'castle_on_10', progress: () => {
          return { current: (lifetimeStats.castledOnMove10 || 0), target: 1 };
        }},
        { id: 'castle_on_20', name: '🏰 Castle on 20', desc: 'Castled on your 20th move', category: 'Random', points: 75, groupKey: 'castle_on_20', progress: () => {
          return { current: (lifetimeStats.castledOnMove20 || 0), target: 1 };
        }},
        { id: 'promote_to_queen', name: '👸 Queen Promotion', desc: 'Promoted to queen', category: 'Random', points: 50, groupKey: 'promote_to_queen', progress: () => {
          return { current: (lifetimeStats.promotedToQueen || 0), target: 1 };
        }},
        { id: 'promote_to_queen_3', name: '👸 Queen Promoter', desc: 'Promoted to queen three times', category: 'Random', points: 150, groupKey: 'promote_to_queen', progress: () => {
          return { current: (lifetimeStats.promotedToQueenMultiple || 0), target: 3 };
        }},
        { id: 'promote_to_rook', name: '🏰 Rook Promotion', desc: 'Promoted to rook', category: 'Random', points: 100, groupKey: 'promote_to_rook', progress: () => {
          return { current: (lifetimeStats.promotedToRook || 0), target: 1 };
        }},
        { id: 'promote_to_bishop', name: '♗ Bishop Promotion', desc: 'Promoted to bishop', category: 'Random', points: 100, groupKey: 'promote_to_bishop', progress: () => {
          return { current: (lifetimeStats.promotedToBishop || 0), target: 1 };
        }},
        { id: 'promote_to_knight', name: '🐴 Knight Promotion', desc: 'Promoted to knight', category: 'Random', points: 100, groupKey: 'promote_to_knight', progress: () => {
          return { current: (lifetimeStats.promotedToKnight || 0), target: 1 };
        }},
        { id: 'check_on_5', name: '✓ Check on 5', desc: 'Gave check on your 5th move', category: 'Random', points: 75, groupKey: 'check_on_5', progress: () => {
          return { current: ((lifetimeStats.checkOnMove5 || 0) + ((gameStats && gameStats.checkOnMove5) || 0)), target: 1 };
        }},
        { id: 'capture_on_10', name: '⚔️ Capture on 10', desc: 'Made a capture on your 10th move', category: 'Random', points: 50, groupKey: 'capture_on_10', progress: () => {
          return { current: ((lifetimeStats.captureOnMove10 || 0) + ((gameStats && gameStats.captureOnMove10) || 0)), target: 1 };
        }},
        
        // More random piece-to-square achievements
        { id: 'rook_to_a1', name: '🏰 Rook to A1', desc: 'Moved rook to a1', category: 'Random', points: 30, groupKey: 'rook_to_corners', progress: () => {
          return { current: (lifetimeStats.rookToA1 || 0), target: 1 };
        }},
        { id: 'rook_to_h1', name: '🏰 Rook to H1', desc: 'Moved rook to h1', category: 'Random', points: 30, groupKey: 'rook_to_corners', progress: () => {
          return { current: (lifetimeStats.rookToH1 || 0), target: 1 };
        }},
        { id: 'bishop_to_c1', name: '♗ Bishop to C1', desc: 'Moved bishop to c1', category: 'Random', points: 25, groupKey: 'bishop_to_start', progress: () => {
          return { current: (lifetimeStats.bishopToC1 || 0), target: 1 };
        }},
        { id: 'bishop_to_f1', name: '♗ Bishop to F1', desc: 'Moved bishop to f1', category: 'Random', points: 25, groupKey: 'bishop_to_start', progress: () => {
          return { current: (lifetimeStats.bishopToF1 || 0), target: 1 };
        }},
        { id: 'knight_to_g1', name: '🐴 Knight to G1', desc: 'Moved knight to g1', category: 'Random', points: 20, groupKey: 'knight_to_start', progress: () => {
          return { current: (lifetimeStats.knightToG1 || 0), target: 1 };
        }},
        { id: 'knight_to_b1', name: '🐴 Knight to B1', desc: 'Moved knight to b1', category: 'Random', points: 20, groupKey: 'knight_to_start', progress: () => {
          return { current: (lifetimeStats.knightToB1 || 0), target: 1 };
        }},
        { id: 'queen_to_a1', name: '👸 Queen to A1', desc: 'Moved queen to a1', category: 'Random', points: 40, groupKey: 'queen_to_corners', progress: () => {
          return { current: (lifetimeStats.queenToA1 || 0), target: 1 };
        }},
        { id: 'queen_to_h1', name: '👸 Queen to H1', desc: 'Moved queen to h1', category: 'Random', points: 40, groupKey: 'queen_to_corners', progress: () => {
          return { current: (lifetimeStats.queenToH1 || 0), target: 1 };
        }},
        { id: 'king_to_g1', name: '👑 King to G1', desc: 'Moved king to g1', category: 'Random', points: 35, groupKey: 'king_to_castle', progress: () => {
          return { current: (lifetimeStats.kingToG1 || 0), target: 1 };
        }},
        { id: 'king_to_c1', name: '👑 King to C1', desc: 'Moved king to c1', category: 'Random', points: 35, groupKey: 'king_to_castle', progress: () => {
          return { current: (lifetimeStats.kingToC1 || 0), target: 1 };
        }},
        { id: 'pawn_to_a2', name: '♟️ Pawn to A2', desc: 'Moved a pawn to a2', category: 'Random', points: 20, groupKey: 'pawn_to_edge', progress: () => {
          return { current: (lifetimeStats.pawnToA2 || 0), target: 1 };
        }},
        { id: 'pawn_to_h2', name: '♟️ Pawn to H2', desc: 'Moved a pawn to h2', category: 'Random', points: 20, groupKey: 'pawn_to_edge', progress: () => {
          return { current: (lifetimeStats.pawnToH2 || 0), target: 1 };
        }},
        
        // Daily Achievements - ORIGINAL CHALLENGES
        { id: 'daily_explorer', name: '🗺️ Daily Explorer', desc: 'Visit 20 unique squares in one day', category: 'Daily', points: 100, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 20 };
          resetDailyStatsIfNeeded();
          const lifetimeCount = lifetimeStats.dailyStats.uniqueSquaresVisitedToday ? 
            (Array.isArray(lifetimeStats.dailyStats.uniqueSquaresVisitedToday) ? lifetimeStats.dailyStats.uniqueSquaresVisitedToday.length : 0) : 0;
          const gameCount = gameStats && gameStats.dailyStats && gameStats.dailyStats.uniqueSquaresVisitedToday ? gameStats.dailyStats.uniqueSquaresVisitedToday.length : 0;
          // Combine unique squares from both (avoid duplicates)
          const combined = new Set([...(lifetimeStats.dailyStats.uniqueSquaresVisitedToday || []), ...((gameStats && gameStats.dailyStats && gameStats.dailyStats.uniqueSquaresVisitedToday) || [])]);
          return { current: combined.size, target: 20 };
        }},
        { id: 'daily_warrior', name: '⚔️ Daily Warrior', desc: 'Make 5 captures in one day (any of your pieces)', category: 'Daily', points: 150, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 5 };
          resetDailyStatsIfNeeded();
          return { current: ((lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0)), target: 5 };
        }},
        { id: 'daily_lightning', name: '⚡ Daily Lightning', desc: 'Win 2 games in 25 moves or fewer today', category: 'Daily', points: 350, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(2, lifetimeStats.dailyStats.quickWinsToday || 0), target: 2 };
        }},
        { id: 'daily_capturer', name: '🎯 Daily Capturer', desc: 'Make 10 captures in one day (any of your pieces)', category: 'Daily', points: 180, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 10 };
          resetDailyStatsIfNeeded();
          return { current: ((lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0)), target: 10 };
        }},
        { id: 'daily_checker', name: '✓ Daily Checker', desc: 'Give 8 checks in one day', category: 'Daily', points: 120, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 8 };
          resetDailyStatsIfNeeded();
          return { current: ((lifetimeStats.dailyStats.checksGivenToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.checksGivenToday) || 0)), target: 8 };
        }},
        { id: 'daily_longgame', name: '⏱️ Daily Marathon', desc: 'Make 150 total moves today (all games)', category: 'Daily', points: 150, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 150 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.movesMadeToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.movesMadeToday) || 0);
          return { current: Math.min(150, cur), target: 150 };
        }},
        { id: 'daily_promoter', name: '👑 Daily Promoter', desc: 'Promote 3 pawns in one day', category: 'Daily', points: 250, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          return { current: ((lifetimeStats.dailyStats.promotionsToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.promotionsToday) || 0)), target: 3 };
        }},
        { id: 'daily_castler', name: '🏰 Daily Castler', desc: 'Castle 2 times in one day', category: 'Daily', points: 110, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: ((lifetimeStats.dailyStats.castlingToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.castlingToday) || 0)), target: 2 };
        }},
        { id: 'daily_comeback', name: '💪 Daily Comeback', desc: 'Win 3 games in one day', category: 'Daily', points: 300, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          return { current: (lifetimeStats.dailyStats.gamesWonToday || 0), target: 3 };
        }},
        { id: 'daily_white_duo', name: '⚪ White Hot', desc: 'Win 2 games as White today', category: 'Daily', points: 220, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(2, lifetimeStats.dailyStats.winsAsWhiteToday || 0), target: 2 };
        }},
        { id: 'daily_black_duo', name: '⚫ Black Hot', desc: 'Win 2 games as Black today', category: 'Daily', points: 220, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(2, lifetimeStats.dailyStats.winsAsBlackToday || 0), target: 2 };
        }},
        
        // Daily Achievements - UNIQUE AND CREATIVE CHALLENGES
        { id: 'daily_blindfold_bishop', name: '👁️♗ Blindfold Bishop Master', desc: 'Make 5 bishop moves in blindfold games today', category: 'Daily', points: 250, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 5 };
          resetDailyStatsIfNeeded();
          const lifetimeCount = lifetimeStats.dailyStats.bishopMovesInBlindfoldToday || 0;
          const gameCount = (gameStats && gameStats.dailyStats && gameStats.dailyStats.bishopMovesInBlindfoldToday) || 0;
          return { current: lifetimeCount + gameCount, target: 5 };
        }},
        { id: 'daily_blindfold_knight', name: '👁️🐴 Blindfold Knight Rider', desc: 'Make 7 knight moves in blindfold games without move history today', category: 'Daily', points: 400, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 7 };
          resetDailyStatsIfNeeded();
          const lifetimeCount = lifetimeStats.dailyStats.knightMovesInPureBlindfoldToday || 0;
          const gameCount = (gameStats && gameStats.dailyStats && gameStats.dailyStats.knightMovesInPureBlindfoldToday) || 0;
          return { current: lifetimeCount + gameCount, target: 7 };
        }},
        { id: 'daily_pawn_promotion_chain', name: '♟️ Promotion Chain', desc: 'Promote 5 pawns today (all games)', category: 'Daily', points: 550, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 5 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.promotionsToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.promotionsToday) || 0);
          return { current: Math.min(5, cur), target: 5 };
        }},
        { id: 'daily_queen_tour', name: '👸 Busy Queen', desc: 'Play 5 games today', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 5 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(5, lifetimeStats.dailyStats.gamesPlayedToday || 0), target: 5 };
        }},
        { id: 'daily_rook_ladder', name: '🏰 Rook Ladder', desc: 'Win 2 games today', category: 'Daily', points: 380, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(2, lifetimeStats.dailyStats.gamesWonToday || 0), target: 2 };
        }},
        { id: 'daily_bishop_pair', name: '♗♗ Bishop Pair Power', desc: 'Castle 4 times today (all games)', category: 'Daily', points: 400, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 4 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.castlingToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.castlingToday) || 0);
          return { current: Math.min(4, cur), target: 4 };
        }},
        { id: 'daily_pawn_storm', name: '♟️ Pawn Storm', desc: 'Make 20 pawn moves today (all games)', category: 'Daily', points: 400, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 20 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.pawnMovesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.pawnMovesToday) || 0);
          return { current: Math.min(20, cur), target: 20 };
        }},
        { id: 'daily_king_walk', name: '👑 King Walk', desc: 'Move your king 15 times today (all games)', category: 'Daily', points: 320, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 15 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.kingMovesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.kingMoves) || 0);
          return { current: Math.min(15, cur), target: 15 };
        }},
        { id: 'daily_piece_cycle', name: '🔄 Both Colors', desc: 'Win at least one game as White and one as Black today', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const w = (lifetimeStats.dailyStats.winsAsWhiteToday || 0) >= 1 ? 1 : 0;
          const b = (lifetimeStats.dailyStats.winsAsBlackToday || 0) >= 1 ? 1 : 0;
          return { current: w + b, target: 2 };
        }},
        { id: 'daily_square_master', name: '🎯 Square Master', desc: 'Visit 35 unique squares today (all games)', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 35 };
          resetDailyStatsIfNeeded();
          const combined = new Set([...(lifetimeStats.dailyStats.uniqueSquaresVisitedToday || []), ...((gameStats && gameStats.dailyStats && gameStats.dailyStats.uniqueSquaresVisitedToday) || [])]);
          return { current: Math.min(35, combined.size), target: 35 };
        }},
        { id: 'daily_blindfold_win_no_history', name: '👁️❌ Pure Blindfold Victory', desc: 'Win a blindfold game without move history today', category: 'Daily', points: 600, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const pureBlindfoldWinsToday = (lifetimeStats.dailyStats.pureBlindfoldWinsToday || 0);
          return { current: pureBlindfoldWinsToday, target: 1 };
        }},
        { id: 'daily_piece_sacrifice_chain', name: '💎 Win Streak', desc: 'Win 3 games today', category: 'Daily', points: 550, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(3, lifetimeStats.dailyStats.gamesWonToday || 0), target: 3 };
        }},
        { id: 'daily_center_control', name: '🎯 Center Control', desc: 'Make 15 captures today, all games (any of your pieces)', category: 'Daily', points: 480, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 15 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0);
          return { current: Math.min(15, cur), target: 15 };
        }},
        { id: 'daily_pawn_island', name: '🏝️ Check Rain', desc: 'Give 18 checks today (all games)', category: 'Daily', points: 380, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 18 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.checksGivenToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.checksGivenToday) || 0);
          return { current: Math.min(18, cur), target: 18 };
        }},
        { id: 'daily_rook_battery', name: '🏰 Four Corners', desc: 'Play 4 games today', category: 'Daily', points: 350, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 4 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(4, lifetimeStats.dailyStats.gamesPlayedToday || 0), target: 4 };
        }},
        { id: 'daily_personality_master', name: '🎭 Triple Duty', desc: 'Play 3 games today', category: 'Daily', points: 350, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(3, lifetimeStats.dailyStats.gamesPlayedToday || 0), target: 3 };
        }},
        { id: 'daily_survivor', name: '🛡️ Daily Survivor', desc: 'Make 25 captures today, all games (any of your pieces)', category: 'Daily', points: 225, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 25 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0);
          return { current: Math.min(25, cur), target: 25 };
        }},
        { id: 'daily_blitz_king', name: '⚡⚡ Blitz King', desc: 'Win 2 games with 1-minute time control today', category: 'Daily', points: 300, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const winsByTime = lifetimeStats.dailyStats.winsByTimeControlToday || {};
          // Time control '60' is for 1 minute
          const wins1Min = winsByTime['60'] || 0;
          return { current: wins1Min, target: 2 };
        }},
        { id: 'daily_time_master', name: '⏱️ Time Master', desc: 'Win games with 3 different time controls today', category: 'Daily', points: 280, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const timeControlsWon = lifetimeStats.dailyStats.winsByTimeControlToday || {};
          const uniqueTimeControls = Object.keys(timeControlsWon).filter(tc => timeControlsWon[tc] > 0);
          return { current: uniqueTimeControls.length, target: 3 };
        }},
        { id: 'daily_king_safety', name: "👑 King's Guard", desc: 'Castle in 3 different games today', category: 'Daily', points: 200, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const gamesWithCastling = (lifetimeStats.dailyStats.gamesCastledToday || 0);
          return { current: gamesWithCastling, target: 3 };
        }},
        { id: 'daily_promotion_royalty', name: '👸 Promotion Royalty', desc: 'Promote a pawn in 2 different games today', category: 'Daily', points: 240, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const gamesWithPromotion = (lifetimeStats.dailyStats.gamesPromotedToday || 0);
          return { current: gamesWithPromotion, target: 2 };
        }},
        { id: 'daily_material_advantage', name: '⚖️ Material Master', desc: 'Win 2 games where you had a material advantage of 3+ points', category: 'Daily', points: 275, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const winsWithAdvantage = (lifetimeStats.dailyStats.winsWithMaterialAdvantageToday || 0);
          return { current: winsWithAdvantage, target: 2 };
        }},
        { id: 'daily_openings_expert', name: '📚 Opening Expert', desc: 'Play 3 different detected openings today', category: 'Daily', points: 220, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const uniqueOpenings = lifetimeStats.dailyStats.uniqueOpeningsPlayedToday || [];
          return { current: uniqueOpenings.length, target: 3 };
        }},
        { id: 'daily_checkmate_artist', name: '🎨 Checkmate Artist', desc: 'Checkmate with 3 different pieces today (queen, rook, knight, bishop, or pawn)', category: 'Daily', points: 400, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const uniqueCheckmatePieces = lifetimeStats.dailyStats.uniqueCheckmatePiecesToday || [];
          return { current: uniqueCheckmatePieces.length, target: 3 };
        }},
        { id: 'daily_en_passant_master', name: '🎯 En Passant Master', desc: 'Perform en passant in 2 different games today', category: 'Daily', points: 400, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const gamesWithEnPassant = (lifetimeStats.dailyStats.gamesWithEnPassantToday || 0);
          return { current: gamesWithEnPassant, target: 2 };
        }},
        { id: 'daily_underpromotion', name: '♟️ Underpromotion Specialist', desc: 'Underpromote 2 times today (rook, bishop, or knight)', category: 'Daily', points: 450, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const u = (lifetimeStats.dailyStats.underpromotionMovesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.underpromotionMovesToday) || 0);
          return { current: Math.min(2, u), target: 2 };
        }},
        { id: 'daily_queen_sacrifice', name: '👑 Queen Sacrifice', desc: 'Win a game after sacrificing your queen today', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const queenSacrificeWins = (lifetimeStats.dailyStats.queenSacrificeWinsToday || 0);
          return { current: queenSacrificeWins, target: 1 };
        }},
        { id: 'daily_time_pressure', name: '⏰ Time Pressure Hero', desc: 'Win a game with less than 10 seconds remaining on your clock', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const timePressureWins = (lifetimeStats.dailyStats.timePressureWinsToday || 0);
          return { current: timePressureWins, target: 1 };
        }},
        { id: 'daily_opening_trap', name: '🪤 Opening Trap Master', desc: 'Win 2 games in 30 moves or fewer today', category: 'Daily', points: 380, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          return { current: Math.min(2, lifetimeStats.dailyStats.fastWins30Today || 0), target: 2 };
        }},
        { id: 'daily_endgame_grinder', name: '🔨 Endgame Grinder', desc: 'Play 2+ games and 120+ total moves today', category: 'Daily', points: 380, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const moves = (lifetimeStats.dailyStats.movesMadeToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.movesMadeToday) || 0);
          const games = lifetimeStats.dailyStats.gamesPlayedToday || 0;
          return { current: (games >= 2 && moves >= 120) ? 1 : 0, target: 1 };
        }},
        { id: 'daily_perfect_defense', name: '🛡️ Perfect Defense', desc: 'Win a game without losing any pieces today', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const perfectWins = (lifetimeStats.dailyStats.perfectWinsToday || 0);
          return { current: perfectWins, target: 1 };
        }},
        { id: 'daily_check_storm', name: '⚡ Check Storm', desc: 'Give 22 checks today (all games)', category: 'Daily', points: 280, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 22 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.checksGivenToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.checksGivenToday) || 0);
          return { current: Math.min(22, cur), target: 22 };
        }},
        { id: 'daily_double_castle', name: '🏰 Double Castle', desc: 'Castle kingside and queenside at least once each today (across all games)', category: 'Daily', points: 300, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const castlingTypesToday = lifetimeStats.dailyStats.castlingTypesToday || [];
          // Check if we have both kingside ('k') and queenside ('q') castling across all games today
          const hasKingside = castlingTypesToday.includes('k');
          const hasQueenside = castlingTypesToday.includes('q');
          return { current: (hasKingside && hasQueenside) ? 1 : 0, target: 1 };
        }},
        { id: 'daily_promotion_variety', name: '👸 Promotion Variety', desc: 'Promote 4 pawns today (all games)', category: 'Daily', points: 420, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 4 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.promotionsToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.promotionsToday) || 0);
          return { current: Math.min(4, cur), target: 4 };
        }},
        { id: 'daily_comeback_king', name: '💪 Comeback King', desc: 'Win a game after being down by 5+ material points today', category: 'Daily', points: 500, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const comebackWins = (lifetimeStats.dailyStats.comebackWinsToday || 0);
          return { current: comebackWins, target: 1 };
        }},
        { id: 'daily_piece_hunter', name: '🎯 Piece Hunter', desc: 'Make 18 captures today, all games (any of your pieces)', category: 'Daily', points: 450, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 18 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0);
          return { current: Math.min(18, cur), target: 18 };
        }},
        { id: 'daily_elite_capturer', name: '⚔️ Elite Capturer', desc: 'Make 20 captures today, all games (any of your pieces)', category: 'Daily', points: 360, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 20 };
          resetDailyStatsIfNeeded();
          const cur = (lifetimeStats.dailyStats.capturesToday || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.capturesToday) || 0);
          return { current: Math.min(20, cur), target: 20 };
        }},
        { id: 'daily_pawn_sweeper', name: '🧹 Pawn Sweeper', desc: 'Take 8 enemy pawns today (victim type)', category: 'Daily', points: 380, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 8 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          return { current: Math.min(8, c.p), target: 8 };
        }},
        { id: 'daily_knight_roundup', name: '🐴 Knight Roundup', desc: 'Take 4 enemy knights today (victim type)', category: 'Daily', points: 460, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 4 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          return { current: Math.min(4, c.n), target: 4 };
        }},
        { id: 'daily_bishop_ambush', name: '♗ Bishop Ambush', desc: 'Take 3 enemy bishops today (victim type)', category: 'Daily', points: 430, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          return { current: Math.min(3, c.b), target: 3 };
        }},
        { id: 'daily_rook_raider_adv', name: '🏰 Rook Raider', desc: 'Take 3 enemy rooks today (victim type)', category: 'Daily', points: 480, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 3 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          return { current: Math.min(3, c.r), target: 3 };
        }},
        { id: 'daily_queen_snatcher', name: '👑 Queen Snatcher', desc: 'Take 2 enemy queens today (victim type)', category: 'Daily', points: 520, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 2 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          return { current: Math.min(2, c.q), target: 2 };
        }},
        { id: 'daily_full_deck_hunter', name: '🃏 Full Deck', desc: 'Take at least one enemy pawn, knight, bishop, rook, and queen today', category: 'Daily', points: 580, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 1 };
          resetDailyStatsIfNeeded();
          const c = getDailyPlayerCapturesByTypeMerged();
          const ok = c.p >= 1 && c.n >= 1 && c.b >= 1 && c.r >= 1 && c.q >= 1;
          return { current: ok ? 1 : 0, target: 1 };
        }},
        { id: 'daily_checkmate_maestro', name: '🎨 Checkmate Maestro', desc: 'Deliver checkmate with 4 different piece types today (queen, rook, knight, bishop, or pawn)', category: 'Daily', points: 520, isDaily: true, progress: () => {
          if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: 4 };
          resetDailyStatsIfNeeded();
          const u = lifetimeStats.dailyStats.uniqueCheckmatePiecesToday || [];
          return { current: Math.min(4, u.length), target: 4 };
        }},
        
        // ========================================================================
        // ADD NEW DAILY CHALLENGES HERE
        // ========================================================================
        // Template for creating a new daily challenge:
        // { id: 'daily_your_challenge_id', name: '🎯 Your Challenge Name', desc: 'Your challenge description', category: 'Daily', points: 150, isDaily: true, progress: () => {
        //   if (!lifetimeStats || !lifetimeStats.dailyStats) return { current: 0, target: YOUR_TARGET };
        //   resetDailyStatsIfNeeded();
        //   // Track your stat from lifetimeStats.dailyStats.YOUR_STAT or gameStats.dailyStats.YOUR_STAT
        //   return { current: ((lifetimeStats.dailyStats.YOUR_STAT || 0) + ((gameStats && gameStats.dailyStats && gameStats.dailyStats.YOUR_STAT) || 0)), target: YOUR_TARGET };
        // }},
        //
        // After adding a new daily challenge:
        // 1. Add its ID to getAllDailyChallengeIds() fallback list (optional; IDs are also derived from definitions)
        // 2. Prefer cumulative "today" stats so progress is easy to read (not hidden single-game feats)
        // 3. Track stats in lifetimeStats.dailyStats / gameStats.dailyStats and reset them in resetDailyStatsIfNeeded()
        // ========================================================================
        
        // Time Control Achievements
        { id: 'win_no_time', name: '⏰ Untimed Victory', desc: 'Win 5 games with no time control', category: 'Creative', points: 100, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl.none) || 0, target: 5 };
        }},
        { id: 'win_1min', name: '⚡ Lightning Victory', desc: 'Win 3 games with 1 minute time control', category: 'Creative', points: 150, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['60']) || 0, target: 3 };
        }},
        { id: 'win_3min', name: '🚀 Rapid Victory', desc: 'Win 5 games with 3|2 time control', category: 'Creative', points: 120, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['180|2']) || 0, target: 5 };
        }},
        { id: 'win_5min', name: '⏱️ Five Minute Master', desc: 'Win 10 games with 5 minute time control', category: 'Creative', points: 200, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['300|0']) || 0, target: 10 };
        }},
        { id: 'win_10min', name: '🎯 Ten Minute Expert', desc: 'Win 10 games with 10 minute time control', category: 'Creative', points: 180, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['600|0']) || 0, target: 10 };
        }},
        { id: 'win_15min', name: '🏆 Classic Player', desc: 'Win 8 games with 15|5 time control', category: 'Creative', points: 160, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['900|5']) || 0, target: 8 };
        }},
        { id: 'win_60min', name: '♟️ Long Game Champion', desc: 'Win 5 games with 60 minute time control', category: 'Creative', points: 300, groupKey: 'time_control_wins', progress: () => {
          return { current: (lifetimeStats.winsByTimeControl && lifetimeStats.winsByTimeControl['3600|0']) || 0, target: 5 };
        }},
        
        // Personality Achievements
        { id: 'beat_balanced', name: '⚖️ Balance Breaker', desc: 'Win 5 games against Balanced personality', category: 'Creative', points: 100, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.balanced) || 0, target: 5 };
        }},
        { id: 'beat_aggressive', name: '🛡️ Defense Master', desc: 'Win 3 games against Aggressive personality', category: 'Creative', points: 150, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.aggressive) || 0, target: 3 };
        }},
        { id: 'beat_defensive', name: '⚔️ Offensive Expert', desc: 'Win 3 games against Defensive personality', category: 'Creative', points: 150, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.defensive) || 0, target: 3 };
        }},
        { id: 'beat_positional', name: '🎯 Tactical Genius', desc: 'Win 3 games against Positional personality', category: 'Creative', points: 180, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.positional) || 0, target: 3 };
        }},
        { id: 'beat_material', name: '💎 Material Overcome', desc: 'Win 3 games against Material-Focused personality', category: 'Creative', points: 160, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.material) || 0, target: 3 };
        }},
        { id: 'beat_tactical', name: '🧠 Strategy Master', desc: 'Win 3 games against Tactical personality', category: 'Creative', points: 200, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.tactical) || 0, target: 3 };
        }},
        { id: 'beat_custom', name: '🎛️ Custom Conqueror', desc: 'Win 5 games against Custom personality', category: 'Creative', points: 120, groupKey: 'personality_wins', progress: () => {
          return { current: (lifetimeStats.winsByPersonality && lifetimeStats.winsByPersonality.custom) || 0, target: 5 };
        }},
        { id: 'beat_all_personalities', name: '👑 Personality Slayer', desc: 'Win at least 1 game against all 7 personalities', category: 'Creative', points: 500, requiredPoints: 5000, groupKey: 'personality_wins', progress: () => {
          if (!lifetimeStats.winsByPersonality) return { current: 0, target: 7 };
          const personalities = ['balanced', 'aggressive', 'defensive', 'positional', 'material', 'tactical', 'custom'];
          // Personality tracking removed
          const beaten = 0;
          return { current: beaten, target: 7 };
        }},
        
        // Creative Speed Achievements
        { id: 'speed_demon', name: '⚡ Speed Demon', desc: 'Win 5 games in under 10 moves', category: 'Creative', points: 300, groupKey: 'speed_wins', progress: () => {
          return { current: (lifetimeStats.winsInUnder10Moves || 0), target: 5 };
        }},
        { id: 'blitz_master', name: '🚀 Blitz Master', desc: 'Win 10 games in under 20 moves', category: 'Creative', points: 400, groupKey: 'speed_wins', progress: () => {
          return { current: (lifetimeStats.winsInUnder20Moves || 0), target: 10 };
        }},
        { id: 'goldilocks_speedrun', name: '🐻 Just Right', desc: 'Win 5 games in 11–15 moves (not too fast, not too slow)', category: 'Creative', points: 280, groupKey: 'speed_wins', progress: () => {
          const u10 = lifetimeStats.winsInUnder10Moves || 0;
          const u15 = lifetimeStats.winsInUnder15Moves || 0;
          return { current: Math.max(0, u15 - u10), target: 5 };
        }},
        { id: 'marathon_winner', name: '🏃 Marathon Winner', desc: 'Win 3 games with 100+ moves', category: 'Creative', points: 350, groupKey: 'marathon_wins', progress: () => {
          return { current: (lifetimeStats.winsInOver100Moves || 0), target: 3 };
        }},
        
        // Flair & theater (tactical / narrative wins — counters set in trackWinStats)
        { id: 'flair_zwischen_1', name: '🎭 Between the Lines', desc: 'Win a game where you played a zwischenzug', category: 'Creative', points: 220, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeZwischenzugWins || 0), target: 1 };
        }},
        { id: 'flair_zwischen_5', name: '🎭 In-Between Artist', desc: 'Win 5 games with a zwischenzug', category: 'Creative', points: 650, requiredPoints: 2000, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeZwischenzugWins || 0), target: 5 };
        }},
        { id: 'flair_triple_promo_1', name: '👑 Triple Crowner', desc: 'Win a game with 3+ promotions', category: 'Creative', points: 350, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeTriplePromotionWins || 0), target: 1 };
        }},
        { id: 'flair_triple_promo_5', name: '🏭 Promotion Factory', desc: 'Win 5 games with 3+ promotions each', category: 'Creative', points: 900, requiredPoints: 4000, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeTriplePromotionWins || 0), target: 5 };
        }},
        { id: 'flair_queen_tour_1', name: '🌍 Queen World Tour', desc: 'Win with your queen visiting all four corners', category: 'Creative', points: 380, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeQueenGrandTourWins || 0), target: 1 };
        }},
        { id: 'flair_rook_highway_1', name: '🛣️ Rook Highway', desc: 'Win with both rooks on the 7th (or 2nd) rank', category: 'Creative', points: 320, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeRookLadderWins || 0), target: 1 };
        }},
        { id: 'flair_king_hike_1', name: '🥾 Wandering Monarch', desc: 'Win with 10+ king moves in one game', category: 'Creative', points: 280, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeKingMarathonWins || 0), target: 1 };
        }},
        { id: 'flair_windmill_1', name: '🌀 Check After Check', desc: 'Win after a streak of 5+ consecutive checks', category: 'Creative', points: 450, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeWindmillWins || 0), target: 1 };
        }},
        { id: 'flair_sacrifice_1', name: '🎨 Sacrifice for Glory', desc: 'Win after “sacrificing” 3+ piece types (tracked in-game)', category: 'Creative', points: 400, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeSacrificeSymphonyWins || 0), target: 1 };
        }},
        { id: 'flair_pins_1', name: '📌 Pin Collection', desc: 'Win with 4+ pins created', category: 'Creative', points: 360, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativePinGalleryWins || 0), target: 1 };
        }},
        { id: 'flair_forks_1', name: '🍴 Triple-Tine Feast', desc: 'Win with 3+ knight forks', category: 'Creative', points: 340, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeForkFeastWins || 0), target: 1 };
        }},
        { id: 'flair_center_1', name: '🎯 Center of Attention', desc: 'Win after occupying all four center squares', category: 'Creative', points: 300, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeCenterDominationWins || 0), target: 1 };
        }},
        { id: 'flair_pawn_storm_1', name: '🌊 Pawn Tide', desc: 'Win with 5+ pawns on the 6th (or 3rd) rank', category: 'Creative', points: 310, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativePawnStormWins || 0), target: 1 };
        }},
        { id: 'flair_orchestra_1', name: '🎻 Full Orchestra', desc: 'Win after moving every piece type in one game', category: 'Creative', points: 290, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeFullOrchestraWins || 0), target: 1 };
        }},
        { id: 'flair_e_file_1', name: '📜 E-File Odyssey', desc: 'Win after visiting every square on the e-file', category: 'Creative', points: 330, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeEFileOdysseyWins || 0), target: 1 };
        }},
        { id: 'flair_discovery_1', name: '💡 Curtain Call', desc: 'Win with 3+ discovered attacks', category: 'Creative', points: 370, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeDiscoveryWins || 0), target: 1 };
        }},
        { id: 'flair_skewer_1', name: '🥓 Skewer Salon', desc: 'Win with 2+ skewers', category: 'Creative', points: 350, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeSkewerSalonWins || 0), target: 1 };
        }},
        { id: 'flair_battery_1', name: '🔋 Doubled Rooks', desc: 'Win after setting up a rook battery', category: 'Creative', points: 300, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeRookBatteryWins || 0), target: 1 };
        }},
        { id: 'flair_phoenix_1', name: '🔥 Phoenix Gambit', desc: 'Win a game after losing your queen', category: 'Creative', points: 380, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeQueenDownWins || 0), target: 1 };
        }},
        { id: 'flair_phoenix_10', name: '🔥🔥 From the Ashes', desc: 'Win 10 games after losing your queen', category: 'Creative', points: 1200, requiredPoints: 4000, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.creativeQueenDownWins || 0), target: 10 };
        }},
        { id: 'flair_comeback_1', name: '📉 Basement to Boardroom', desc: 'Win after being down 5+ points in net captures', category: 'Creative', points: 360, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.comebackWins || 0), target: 1 };
        }},
        { id: 'flair_comeback_10', name: '📈 Epic Comeback Saga', desc: 'Win 10 comeback games (down 5+ in net captures)', category: 'Creative', points: 1500, requiredPoints: 5000, groupKey: 'flair_tactics', progress: () => {
          return { current: (lifetimeStats.comebackWins || 0), target: 10 };
        }},
        
        // Win Streak Achievements
        { id: 'streak_5', name: '🔥 Hot Streak', desc: 'Win 5 games in a row', category: 'Creative', points: 200, groupKey: 'win_streaks', progress: () => {
          return { current: (lifetimeStats.currentWinStreak || 0), target: 5 };
        }},
        { id: 'streak_10', name: '🔥🔥 On Fire', desc: 'Win 10 games in a row', category: 'Creative', points: 400, groupKey: 'win_streaks', progress: () => {
          return { current: (lifetimeStats.currentWinStreak || 0), target: 10 };
        }},
        { id: 'streak_20', name: '🔥🔥🔥 Unstoppable', desc: 'Win 20 games in a row', category: 'Creative', points: 800, requiredPoints: 10000, groupKey: 'win_streaks', progress: () => {
          return { current: (lifetimeStats.currentWinStreak || 0), target: 20 };
        }},
        { id: 'longest_streak_10', name: '⭐ Best Streak', desc: 'Achieve a longest win streak of 10+', category: 'Creative', points: 300, groupKey: 'win_streaks', progress: () => {
          return { current: (lifetimeStats.longestWinStreak || 0), target: 10 };
        }},
        { id: 'longest_streak_25', name: '🌟 Legendary Streak', desc: 'Achieve a longest win streak of 25+', category: 'Creative', points: 1000, requiredPoints: 15000, groupKey: 'win_streaks', progress: () => {
          return { current: (lifetimeStats.longestWinStreak || 0), target: 25 };
        }},
        
        // Additional Creative Achievements
        { id: 'white_wins_5', name: '⚪ White — First Steps', desc: 'Win 5 games as White', category: 'Creative', points: 40, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 5 };
        }},
        { id: 'white_wins_15', name: '⚪ White — Rising', desc: 'Win 15 games as White', category: 'Creative', points: 90, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 15 };
        }},
        { id: 'win_as_white', name: '⚪ White Specialist', desc: 'Win 20 games as White', category: 'Creative', points: 150, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 20 };
        }},
        { id: 'white_wins_35', name: '⚪ White — Strong', desc: 'Win 35 games as White', category: 'Creative', points: 220, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 35 };
        }},
        { id: 'white_wins_50', name: '⚪ White — Expert', desc: 'Win 50 games as White', category: 'Creative', points: 350, requiredPoints: 2000, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 50 };
        }},
        { id: 'white_wins_100', name: '⚪ White — Centurion', desc: 'Win 100 games as White', category: 'Creative', points: 800, requiredPoints: 8000, groupKey: 'white_wins', progress: () => {
          return { current: (lifetimeStats.winsAsWhite || 0), target: 100 };
        }},
        { id: 'black_wins_5', name: '⚫ Black — First Steps', desc: 'Win 5 games as Black', category: 'Creative', points: 40, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 5 };
        }},
        { id: 'black_wins_15', name: '⚫ Black — Rising', desc: 'Win 15 games as Black', category: 'Creative', points: 90, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 15 };
        }},
        { id: 'win_as_black', name: '⚫ Black Specialist', desc: 'Win 20 games as Black', category: 'Creative', points: 150, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 20 };
        }},
        { id: 'black_wins_35', name: '⚫ Black — Strong', desc: 'Win 35 games as Black', category: 'Creative', points: 220, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 35 };
        }},
        { id: 'black_wins_50', name: '⚫ Black — Expert', desc: 'Win 50 games as Black', category: 'Creative', points: 350, requiredPoints: 2000, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 50 };
        }},
        { id: 'black_wins_100', name: '⚫ Black — Centurion', desc: 'Win 100 games as Black', category: 'Creative', points: 800, requiredPoints: 8000, groupKey: 'black_wins', progress: () => {
          return { current: (lifetimeStats.winsAsBlack || 0), target: 100 };
        }},
        { id: 'time_pressure', name: '⏳ Time Pressure', desc: 'Win 5 games with less than 10 seconds remaining', category: 'Creative', points: 400, groupKey: 'time_pressure', progress: () => {
          return { current: (lifetimeStats.timePressureWins || 0), target: 5 };
        }},
        { id: 'perfect_opening', name: '📖 Theory Master', desc: 'Win 10 games where opening was detected', category: 'Creative', points: 250, groupKey: 'opening_wins', progress: () => {
          // This would require tracking games with detected openings - placeholder
          return { current: 0, target: 10 };
        }},
        
        // Milestone Win Achievements (High Engagement Drivers)
        { id: 'hundred_wins', name: '💯 Century of Wins', desc: 'Win 100 games', category: 'General', points: 500, groupKey: 'milestone_wins', progress: () => {
          return { current: playerStats.wins || 0, target: 100 };
        }},
        { id: 'five_hundred_wins', name: '🏆 Five Hundred Wins', desc: 'Win 500 games', category: 'General', points: 2000, requiredPoints: 5000, groupKey: 'milestone_wins', progress: () => {
          return { current: playerStats.wins || 0, target: 500 };
        }},
        { id: 'thousand_wins', name: '👑 Thousand Wins', desc: 'Win 1000 games', category: 'General', points: 5000, requiredPoints: 15000, groupKey: 'milestone_wins', progress: () => {
          return { current: playerStats.wins || 0, target: 1000 };
        }},
        
        // Consistency Achievements (Daily Engagement)
        { id: 'daily_player_3', name: '📅 Three Day Streak', desc: 'Play 3 days in a row', category: 'Creative', points: 150, groupKey: 'consistency', progress: () => {
          return { current: (lifetimeStats.daysPlayedInARow || 0), target: 3 };
        }},
        { id: 'daily_player_7', name: '📅 Week Warrior', desc: 'Play 7 days in a row', category: 'Creative', points: 300, groupKey: 'consistency', progress: () => {
          return { current: (lifetimeStats.daysPlayedInARow || 0), target: 7 };
        }},
        { id: 'daily_player_14', name: '📅 Two Week Champion', desc: 'Play 14 days in a row', category: 'Creative', points: 600, groupKey: 'consistency', progress: () => {
          return { current: (lifetimeStats.daysPlayedInARow || 0), target: 14 };
        }},
        { id: 'daily_player_30', name: '📅 Monthly Master', desc: 'Play 30 days in a row', category: 'Creative', points: 1500, requiredPoints: 10000, groupKey: 'consistency', progress: () => {
          return { current: (lifetimeStats.daysPlayedInARow || 0), target: 30 };
        }},
        
        // Perfect Game Achievements
        { id: 'perfect_game_1', name: '✨ Perfect Game', desc: 'Win a game without losing any pieces', category: 'Creative', points: 400, groupKey: 'perfect_games', progress: () => {
          return { current: (lifetimeStats.perfectGames || 0), target: 1 };
        }},
        { id: 'perfect_game_5', name: '✨✨ Perfect Master', desc: 'Win 5 games without losing pieces', category: 'Creative', points: 1000, requiredPoints: 8000, groupKey: 'perfect_games', progress: () => {
          return { current: (lifetimeStats.perfectGames || 0), target: 5 };
        }},
        
        // Special Checkmate Achievements (points increase with difficulty - pawn is hardest, queen is easiest)
        { id: 'checkmate_pawn', name: '♟️ Pawn Checkmate', desc: 'Checkmate with a pawn', category: 'Creative', points: 1200, requiredPoints: 3500, groupKey: 'special_checkmates', progress: () => {
          return { current: (lifetimeStats.checkmateWithPawn || 0), target: 1 };
        }},
        { id: 'checkmate_knight', name: '🐴 Knight Checkmate', desc: 'Checkmate with a knight', category: 'Creative', points: 900, groupKey: 'special_checkmates', progress: () => {
          return { current: (lifetimeStats.checkmateWithKnight || 0), target: 1 };
        }},
        { id: 'checkmate_bishop', name: '♗ Bishop Checkmate', desc: 'Checkmate with a bishop', category: 'Creative', points: 850, groupKey: 'special_checkmates', progress: () => {
          return { current: (lifetimeStats.checkmateWithBishop || 0), target: 1 };
        }},
        { id: 'checkmate_rook', name: '🏰 Rook Checkmate', desc: 'Checkmate with a rook', category: 'Creative', points: 550, groupKey: 'special_checkmates', progress: () => {
          return { current: (lifetimeStats.checkmateWithRook || 0), target: 1 };
        }},
        { id: 'checkmate_queen', name: '👸 Queen Checkmate', desc: 'Checkmate with a queen', category: 'Creative', points: 280, groupKey: 'special_checkmates', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 1 };
        }},
        
        // Multiple Checkmate Achievements - Knight (hard, high points)
        { id: 'checkmate_knight_5', name: '🐴🐴 Knight Specialist', desc: 'Checkmate with a knight 5 times', category: 'Creative', points: 2000, requiredPoints: 2000, groupKey: 'multiple_checkmates_knight', progress: () => {
          return { current: (lifetimeStats.checkmateWithKnight || 0), target: 5 };
        }},
        { id: 'checkmate_knight_10', name: '🐴🐴🐴 Knight Master', desc: 'Checkmate with a knight 10 times', category: 'Creative', points: 4000, requiredPoints: 5000, groupKey: 'multiple_checkmates_knight', progress: () => {
          return { current: (lifetimeStats.checkmateWithKnight || 0), target: 10 };
        }},
        { id: 'checkmate_knight_25', name: '🐴🐴🐴🐴 Knight Legend', desc: 'Checkmate with a knight 25 times', category: 'Creative', points: 8000, requiredPoints: 15000, groupKey: 'multiple_checkmates_knight', progress: () => {
          return { current: (lifetimeStats.checkmateWithKnight || 0), target: 25 };
        }},
        { id: 'checkmate_knight_50', name: '🐴🐴🐴🐴🐴 Knight Grandmaster', desc: 'Checkmate with a knight 50 times', category: 'Creative', points: 15000, requiredPoints: 30000, groupKey: 'multiple_checkmates_knight', progress: () => {
          return { current: (lifetimeStats.checkmateWithKnight || 0), target: 50 };
        }},
        
        // Multiple Checkmate Achievements - Bishop (hard, high points)
        { id: 'checkmate_bishop_5', name: '♗♗ Bishop Specialist', desc: 'Checkmate with a bishop 5 times', category: 'Creative', points: 1800, requiredPoints: 2000, groupKey: 'multiple_checkmates_bishop', progress: () => {
          return { current: (lifetimeStats.checkmateWithBishop || 0), target: 5 };
        }},
        { id: 'checkmate_bishop_10', name: '♗♗♗ Bishop Master', desc: 'Checkmate with a bishop 10 times', category: 'Creative', points: 3500, requiredPoints: 5000, groupKey: 'multiple_checkmates_bishop', progress: () => {
          return { current: (lifetimeStats.checkmateWithBishop || 0), target: 10 };
        }},
        { id: 'checkmate_bishop_25', name: '♗♗♗♗ Bishop Legend', desc: 'Checkmate with a bishop 25 times', category: 'Creative', points: 7000, requiredPoints: 15000, groupKey: 'multiple_checkmates_bishop', progress: () => {
          return { current: (lifetimeStats.checkmateWithBishop || 0), target: 25 };
        }},
        { id: 'checkmate_bishop_50', name: '♗♗♗♗♗ Bishop Grandmaster', desc: 'Checkmate with a bishop 50 times', category: 'Creative', points: 14000, requiredPoints: 30000, groupKey: 'multiple_checkmates_bishop', progress: () => {
          return { current: (lifetimeStats.checkmateWithBishop || 0), target: 50 };
        }},
        
        // Multiple Checkmate Achievements - Rook (medium difficulty, medium points)
        { id: 'checkmate_rook_5', name: '🏰🏰 Rook Specialist', desc: 'Checkmate with a rook 5 times', category: 'Creative', points: 1200, requiredPoints: 1500, groupKey: 'multiple_checkmates_rook', progress: () => {
          return { current: (lifetimeStats.checkmateWithRook || 0), target: 5 };
        }},
        { id: 'checkmate_rook_10', name: '🏰🏰🏰 Rook Master', desc: 'Checkmate with a rook 10 times', category: 'Creative', points: 2200, requiredPoints: 4000, groupKey: 'multiple_checkmates_rook', progress: () => {
          return { current: (lifetimeStats.checkmateWithRook || 0), target: 10 };
        }},
        { id: 'checkmate_rook_25', name: '🏰🏰🏰🏰 Rook Legend', desc: 'Checkmate with a rook 25 times', category: 'Creative', points: 4500, requiredPoints: 12000, groupKey: 'multiple_checkmates_rook', progress: () => {
          return { current: (lifetimeStats.checkmateWithRook || 0), target: 25 };
        }},
        { id: 'checkmate_rook_50', name: '🏰🏰🏰🏰🏰 Rook Grandmaster', desc: 'Checkmate with a rook 50 times', category: 'Creative', points: 8500, requiredPoints: 25000, groupKey: 'multiple_checkmates_rook', progress: () => {
          return { current: (lifetimeStats.checkmateWithRook || 0), target: 50 };
        }},
        
        // Multiple Checkmate Achievements - Queen (easiest, lower points)
        { id: 'checkmate_queen_5', name: '👸👸 Queen Specialist', desc: 'Checkmate with a queen 5 times', category: 'Creative', points: 500, requiredPoints: 1000, groupKey: 'multiple_checkmates_queen', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 5 };
        }},
        { id: 'checkmate_queen_10', name: '👸👸👸 Queen Master', desc: 'Checkmate with a queen 10 times', category: 'Creative', points: 800, requiredPoints: 3000, groupKey: 'multiple_checkmates_queen', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 10 };
        }},
        { id: 'checkmate_queen_25', name: '👸👸👸👸 Queen Legend', desc: 'Checkmate with a queen 25 times', category: 'Creative', points: 1500, requiredPoints: 10000, groupKey: 'multiple_checkmates_queen', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 25 };
        }},
        { id: 'checkmate_queen_50', name: '👸👸👸👸👸 Queen Grandmaster', desc: 'Checkmate with a queen 50 times', category: 'Creative', points: 2800, requiredPoints: 20000, groupKey: 'multiple_checkmates_queen', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 50 };
        }},
        { id: 'checkmate_queen_100', name: '👸👸👸👸👸👸 Queen Supreme', desc: 'Checkmate with a queen 100 times', category: 'Creative', points: 5000, requiredPoints: 40000, groupKey: 'multiple_checkmates_queen', progress: () => {
          return { current: (lifetimeStats.checkmateWithQueen || 0), target: 100 };
        }},
        
        // Multiple Checkmate Achievements - Pawn (Hardest, highest points!)
        { id: 'checkmate_pawn_3', name: '♟️♟️♟️ Pawn Master', desc: 'Checkmate with a pawn 3 times', category: 'Creative', points: 4000, requiredPoints: 5000, groupKey: 'multiple_checkmates_pawn', progress: () => {
          return { current: (lifetimeStats.checkmateWithPawn || 0), target: 3 };
        }},
        { id: 'checkmate_pawn_5', name: '♟️♟️♟️♟️ Pawn Legend', desc: 'Checkmate with a pawn 5 times', category: 'Creative', points: 8000, requiredPoints: 15000, groupKey: 'multiple_checkmates_pawn', progress: () => {
          return { current: (lifetimeStats.checkmateWithPawn || 0), target: 5 };
        }},
        { id: 'checkmate_pawn_10', name: '♟️♟️♟️♟️♟️ Pawn Grandmaster', desc: 'Checkmate with a pawn 10 times', category: 'Creative', points: 18000, requiredPoints: 30000, groupKey: 'multiple_checkmates_pawn', progress: () => {
          return { current: (lifetimeStats.checkmateWithPawn || 0), target: 10 };
        }},
        
        // Variety Achievements (Encourage Trying Different Settings)
        { id: 'play_all_time_controls', name: '⏰ Time Control Explorer', desc: 'Play games with all 7 time controls', category: 'Creative', points: 400, groupKey: 'variety', progress: () => {
          if (!lifetimeStats.winsByTimeControl) return { current: 0, target: 7 };
          const timeControls = ['none', '60', '180|2', '300|0', '600|0', '900|5', '3600|0'];
          const played = timeControls.filter(tc => (lifetimeStats.winsByTimeControl[tc] || 0) > 0).length;
          return { current: played, target: 7 };
        }},
        { id: 'play_all_personalities', name: '🎭 Personality Explorer', desc: 'Play games against all 7 personalities', category: 'Creative', points: 500, groupKey: 'variety', progress: () => {
          if (!lifetimeStats.winsByPersonality) return { current: 0, target: 7 };
          const personalities = ['balanced', 'aggressive', 'defensive', 'positional', 'material', 'tactical', 'custom'];
          // Personality tracking removed
          const played = 0;
          return { current: played, target: 7 };
        }},
        { id: 'win_both_colors', name: '⚪⚫ Color Master', desc: 'Win 10 games as White and 10 as Black', category: 'Creative', points: 300, groupKey: 'variety', progress: () => {
          const whiteWins = (lifetimeStats.winsAsWhite || 0);
          const blackWins = (lifetimeStats.winsAsBlack || 0);
          const minWins = Math.min(whiteWins, blackWins);
          return { current: minWins, target: 10 };
        }},
        
        // Collection Achievements (Unlock All in Category)
        { id: 'collect_all_general', name: '📚 General Collector', desc: 'Unlock all General achievements', category: 'Creative', points: 1000, requiredPoints: 5000, groupKey: 'collections', progress: () => {
          const allAchievements = getAllAchievementsList();
          const generalAchs = allAchievements.filter(a => a.category === 'General' && !a.isDaily);
          const unlocked = generalAchs.filter(a => achievements.includes(a.id)).length;
          return { current: unlocked, target: generalAchs.length };
        }},
        { id: 'collect_all_ingame', name: '⚔️ In-Game Collector', desc: 'Unlock all In-Game achievements', category: 'Creative', points: 1000, requiredPoints: 5000, groupKey: 'collections', progress: () => {
          const allAchievements = getAllAchievementsList();
          const ingameAchs = allAchievements.filter(a => a.category === 'In-Game' && !a.isDaily);
          const unlocked = ingameAchs.filter(a => achievements.includes(a.id)).length;
          return { current: unlocked, target: ingameAchs.length };
        }},
        { id: 'collect_all_random', name: '🎲 Random Collector', desc: 'Unlock all Random achievements', category: 'Creative', points: 1000, requiredPoints: 5000, groupKey: 'collections', progress: () => {
          const allAchievements = getAllAchievementsList();
          const randomAchs = allAchievements.filter(a => a.category === 'Random' && !a.isDaily);
          const unlocked = randomAchs.filter(a => achievements.includes(a.id)).length;
          return { current: unlocked, target: randomAchs.length };
        }},
        { id: 'collect_all_creative', name: '🎨 Creative Collector', desc: 'Unlock all Creative achievements', category: 'Creative', points: 2000, requiredPoints: 20000, groupKey: 'collections', progress: () => {
          const allAchievements = getAllAchievementsList();
          const creativeAchs = allAchievements.filter(a => a.category === 'Creative' && !a.isDaily);
          const unlocked = creativeAchs.filter(a => achievements.includes(a.id)).length;
          return { current: unlocked, target: creativeAchs.length };
        }},
        { id: 'collect_all', name: '🌟 Master Collector', desc: 'Unlock ALL achievements (except daily)', category: 'Creative', points: 10000, requiredPoints: 50000, groupKey: 'collections', progress: () => {
          const allAchievements = getAllAchievementsList();
          const nonDailyAchs = allAchievements.filter(a => !a.isDaily);
          const unlocked = nonDailyAchs.filter(a => achievements.includes(a.id)).length;
          return { current: unlocked, target: nonDailyAchs.length };
        }},
        
        // Progress Achievements (Win Rate Milestones)
        { id: 'winrate_50_20', name: '📈 Above Average', desc: 'Achieve 50%+ win rate (20+ games)', category: 'Creative', points: 200, groupKey: 'winrate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 20) return { current: 0, target: 1 };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: winRate >= 50 ? 1 : 0, target: 1 };
        }},
        { id: 'winrate_60_30', name: '📈 Strong Player', desc: 'Achieve 60%+ win rate (30+ games)', category: 'Creative', points: 400, groupKey: 'winrate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 30) return { current: 0, target: 1 };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: winRate >= 60 ? 1 : 0, target: 1 };
        }},
        { id: 'winrate_70_50', name: '📈 Excellent Player', desc: 'Achieve 70%+ win rate (50+ games)', category: 'Creative', points: 800, requiredPoints: 5000, groupKey: 'winrate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 50) return { current: 0, target: 1 };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: winRate >= 70 ? 1 : 0, target: 1 };
        }},
        { id: 'winrate_80_100', name: '📈 Master Level', desc: 'Achieve 80%+ win rate (100+ games)', category: 'Creative', points: 2000, requiredPoints: 15000, groupKey: 'winrate', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          if (total < 100) return { current: 0, target: 1 };
          const effectiveWins = (playerStats.wins || 0) + 0.5 * (playerStats.draws || 0);
          const winRate = total > 0 ? (effectiveWins / total) * 100 : 0;
          return { current: winRate >= 80 ? 1 : 0, target: 1 };
        }},
        
        // Underpromotion Achievement
        { id: 'underpromote', name: '🎭 Underpromoter', desc: 'Promote to rook, bishop, or knight', category: 'Creative', points: 200, groupKey: 'underpromotions', progress: () => {
          return { current: (lifetimeStats.underpromotions || 0), target: 1 };
        }},
        { id: 'underpromote_5', name: '🎭 Master Underpromoter', desc: 'Underpromote 5 times', category: 'Creative', points: 600, requiredPoints: 3000, groupKey: 'underpromotions', progress: () => {
          return { current: (lifetimeStats.underpromotions || 0), target: 5 };
        }},
        
        // Blindfold Achievements
        { id: 'blindfold_win_1', name: '👁️ First Blindfold Win', desc: 'Beat the engine in blindfold mode once', category: 'Creative', points: 300, groupKey: 'blindfold', progress: () => {
          return { current: (lifetimeStats.blindfoldWins || 0), target: 1 };
        }},
        { id: 'blindfold_win_5', name: '👁️ Blindfold Player', desc: 'Beat the engine in blindfold mode 5 times', category: 'Creative', points: 800, requiredPoints: 2000, groupKey: 'blindfold', progress: () => {
          return { current: (lifetimeStats.blindfoldWins || 0), target: 5 };
        }},
        { id: 'blindfold_win_10', name: '👁️ Blindfold Expert', desc: 'Beat the engine in blindfold mode 10 times', category: 'Creative', points: 1500, requiredPoints: 5000, groupKey: 'blindfold', progress: () => {
          return { current: (lifetimeStats.blindfoldWins || 0), target: 10 };
        }},
        { id: 'blindfold_win_25', name: '👁️ Blindfold Master', desc: 'Beat the engine in blindfold mode 25 times', category: 'Creative', points: 3000, requiredPoints: 15000, groupKey: 'blindfold', progress: () => {
          return { current: (lifetimeStats.blindfoldWins || 0), target: 25 };
        }},
        { id: 'blindfold_win_50', name: '👁️ Blindfold Legend', desc: 'Beat the engine in blindfold mode 50 times', category: 'Creative', points: 6000, requiredPoints: 30000, groupKey: 'blindfold', progress: () => {
          return { current: (lifetimeStats.blindfoldWins || 0), target: 50 };
        }},
        { id: 'blindfold_no_history_1', name: '🎯 Pure Blindfold Win', desc: 'Beat the engine in blindfold mode without move history once', category: 'Creative', points: 500, requiredPoints: 1000, groupKey: 'blindfold_no_history', progress: () => {
          return { current: (lifetimeStats.blindfoldWinsNoHistory || 0), target: 1 };
        }},
        { id: 'blindfold_no_history_5', name: '🎯 Pure Blindfold Expert', desc: 'Beat the engine in blindfold mode without move history 5 times', category: 'Creative', points: 1500, requiredPoints: 5000, groupKey: 'blindfold_no_history', progress: () => {
          return { current: (lifetimeStats.blindfoldWinsNoHistory || 0), target: 5 };
        }},
        { id: 'blindfold_no_history_10', name: '🎯 Pure Blindfold Master', desc: 'Beat the engine in blindfold mode without move history 10 times', category: 'Creative', points: 3000, requiredPoints: 15000, groupKey: 'blindfold_no_history', progress: () => {
          return { current: (lifetimeStats.blindfoldWinsNoHistory || 0), target: 10 };
        }},
        { id: 'blindfold_no_history_25', name: '🎯 Pure Blindfold Legend', desc: 'Beat the engine in blindfold mode without move history 25 times', category: 'Creative', points: 6000, requiredPoints: 30000, groupKey: 'blindfold_no_history', progress: () => {
          return { current: (lifetimeStats.blindfoldWinsNoHistory || 0), target: 25 };
        }},
        
        // Total Games Milestones
        { id: 'five_hundred_games', name: '🎮 Five Hundred Games', desc: 'Play 500 total games', category: 'General', points: 600, groupKey: 'total_games', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 500 };
        }},
        { id: 'thousand_games', name: '🎮 Thousand Games', desc: 'Play 1000 total games', category: 'General', points: 1500, requiredPoints: 10000, groupKey: 'total_games', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 1000 };
        }},
        { id: 'five_thousand_games', name: '🎮 Five Thousand Games', desc: 'Play 5000 total games', category: 'General', points: 5000, requiredPoints: 30000, groupKey: 'total_games', progress: () => {
          const total = playerStats.wins + playerStats.losses + playerStats.draws;
          return { current: total, target: 5000 };
        }}
      ];
    }

    function updateTotalPoints() {
      const allAchievements = getAllAchievementsList();
      let totalPoints = 0;
      achievements.forEach(achId => {
        const ach = allAchievements.find(a => a.id === achId);
        if (ach && ach.points) {
          totalPoints += ach.points;
        }
      });
      const pointsEl = document.getElementById('total-achievement-points');
      if (pointsEl) {
        pointsEl.textContent = totalPoints.toLocaleString();
      }
    }

    function updateAchievementsDisplay() {
      const container = document.getElementById("achievements-list");
      container.innerHTML = '';
      
      const allAchievements = getAllAchievementsList();
      const unlocked = allAchievements.filter(ach => achievements.includes(ach.id));
      
      // Show only unlocked achievements in the small panel
      unlocked.slice(0, 6).forEach(ach => {
        const div = document.createElement('div');
        div.className = 'stats-row';
        const pointsText = ach.points ? ` <span style="color: #f39c12; font-weight: 700;">(${ach.points} pts)</span>` : '';
        div.innerHTML = `
          <span class="stats-label">${ach.name}:</span>
          <span class="stats-value" style="font-size: 0.85em;">${ach.desc}${pointsText}</span>
        `;
        container.appendChild(div);
      });
      
      if (unlocked.length === 0) {
        const div = document.createElement('div');
        div.className = 'stats-row';
        div.style.opacity = '0.6';
        div.innerHTML = '<span class="stats-value" style="font-size: 0.9em; font-style: italic;">No achievements unlocked yet</span>';
        container.appendChild(div);
      }
    }

    function showAllAchievements(allowDuringGameRefresh) {
      try {
        const modal = document.getElementById('all-achievements-modal');
        if (!modal) {
          console.error('Achievements modal not found');
          return;
        }
        const container = document.getElementById('all-achievements-list');
        if (!container) {
          console.error('Achievements list container not found');
          return;
        }
        container.innerHTML = '';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.boxSizing = 'border-box';
        
        const allAchievements = getAllAchievementsList();
        
        // Get today's daily achievements (random selection)
        resetDailyStatsIfNeeded();
        const todayDailyIds = getTodayDailyAchievements();
        const dailyAchievements = allAchievements.filter(ach => todayDailyIds.includes(ach.id));
        const otherAchievements = allAchievements.filter(ach => !todayDailyIds.includes(ach.id));
        
        // Create a master 3-column grid that contains daily achievements at top, then regular achievements
        const masterGrid = document.createElement('div');
        masterGrid.style.display = 'grid';
        masterGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        masterGrid.style.width = '100%';
        masterGrid.style.gap = '20px';
        masterGrid.style.marginBottom = '0';
        masterGrid.style.overflowY = 'auto';
        masterGrid.style.paddingRight = '10px';
        masterGrid.style.boxSizing = 'border-box';
        
        // Daily title and achievements section - only if we have daily achievements
        if (dailyAchievements.length > 0) {
          // Daily title section - spans all 3 columns
          const dailyTitleCard = document.createElement('div');
          dailyTitleCard.style.gridColumn = 'span 3';
          dailyTitleCard.style.textAlign = 'center';
          dailyTitleCard.style.marginBottom = '15px';
          dailyTitleCard.style.paddingBottom = '15px';
          dailyTitleCard.style.borderBottom = '3px solid #f39c12';
          
          const dailyTitle = document.createElement('h2');
          dailyTitle.innerHTML = '<span class="trophy-emoji">🏆</span> Daily Challenges';
          dailyTitle.style.cssText = 'font-family: "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "Android Emoji", sans-serif; font-size: 1.3em; font-weight: 800; color: #e67e22; margin: 0 0 5px 0;';
          dailyTitleCard.appendChild(dailyTitle);
          
          const dailySubtitle = document.createElement('div');
          dailySubtitle.textContent = 'These reset and change every day at midnight!';
          dailySubtitle.style.cssText = 'color: #d35400; font-style: italic; font-size: 0.85em;';
          dailyTitleCard.appendChild(dailySubtitle);
          
          masterGrid.appendChild(dailyTitleCard);
        
          // Add exactly 3 daily achievements as the first row (one per column)
        dailyAchievements.slice(0, 3).forEach(ach => {
          const isUnlocked = achievements.includes(ach.id);
          let progress, progressPercent;
          try {
            progress = ach.progress();
            progressPercent = progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;
          } catch (e) {
            console.error('Error calculating progress for', ach.id, e);
            progress = { current: 0, target: 1 };
            progressPercent = 0;
          }
          
          // Use EXACT same card styling as regular achievements
          const card = document.createElement('div');
          card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
          
          const allAchievementsForDaily = getAllAchievementsList();
          const totalPoints = allAchievementsForDaily.reduce((sum, a) => {
            if (achievements.includes(a.id) && a.points) {
              return sum + a.points;
            }
            return sum;
          }, 0);
          const requiredPoints = ach.requiredPoints || 0;
          const hasEnoughPoints = totalPoints >= requiredPoints;
          
          // Check if achievement is locked due to game count requirements
          const meetsRequirements = progress.needsTotal !== false;
          const meetsNoLosses = progress.needsNoLosses !== false;
          let lockedMessage = '';
          if (!meetsRequirements) {
            const desc = ach.desc || '';
            const gameMatch = desc.match(/(\d+)\+.*games?/i);
            if (gameMatch) {
              lockedMessage = `🔒 Locked - Need ${gameMatch[1]}+ games`;
            } else {
              lockedMessage = '🔒 Locked - Requirements not met';
            }
          } else if (!meetsNoLosses) {
            lockedMessage = '🔒 Locked - Must win without losing pieces';
          }
          
          const pointsText = ach.points ? `<div style="font-size: 0.9em; color: #f39c12; font-weight: 700; margin-top: 5px;">${ach.points} points</div>` : '';
          
          // Wrap trophy emoji in span with yellow color
          const achievementName = ach.name.replace(/🏆/g, '<span class="trophy-emoji">🏆</span>');
          
          const progressDisplay = 
            lockedMessage ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">${lockedMessage}</div>` :
            requiredPoints > 0 && !hasEnoughPoints ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">🔒 Locked - Need ${requiredPoints} points (You have ${totalPoints})</div>` :
            isUnlocked ? `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target} <span style="color: #2ecc71;">✓</span></div>
              <div class="achievement-progress-bar">
                <div class="achievement-progress-fill" style="width: 100%; background: #2ecc71;"></div>
              </div>` :
            `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target}</div>
              <div class="achievement-progress-bar">
                <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
              </div>`;
          
          card.innerHTML = `
            <div class="achievement-name">${achievementName} ${isUnlocked ? '<span style="color: #2ecc71; font-size: 0.9em;">✓</span>' : ''}</div>
            <div class="achievement-desc">${ach.desc}</div>
            ${pointsText}
            ${progressDisplay}
          `;
          
            masterGrid.appendChild(card);
          });
        
          // Add divider line - spans all 3 columns
          const divider = document.createElement('div');
          divider.style.gridColumn = 'span 3';
          divider.style.height = '3px';
          divider.style.background = '#e9ecef';
          divider.style.marginTop = '20px';
          divider.style.marginBottom = '20px';
          masterGrid.appendChild(divider);
        }
      
      // First group other achievements by category - these continue in the same 3-column grid
      const byCategory = {};
      otherAchievements.forEach(ach => {
        // Skip Daily category achievements - they're already shown above
        if (ach.category === 'Daily') return;
        if (!byCategory[ach.category]) {
          byCategory[ach.category] = [];
        }
        byCategory[ach.category].push(ach);
      });
      
      // Render by category - each category title spans 3 columns, achievements continue in grid
      Object.keys(byCategory).forEach(category => {
        // Category title spans all 3 columns
        const categoryTitleCard = document.createElement('div');
        categoryTitleCard.style.gridColumn = 'span 3';
        categoryTitleCard.style.marginTop = '20px';
        categoryTitleCard.style.marginBottom = '15px';
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category;
        categoryTitle.style.cssText = 'font-family: "Inter", sans-serif; font-size: 1.3em; font-weight: 700; color: #2c3e50; padding-bottom: 8px; border-bottom: 2px solid #3498db;';
        categoryTitleCard.appendChild(categoryTitle);
        
        masterGrid.appendChild(categoryTitleCard);
        
        // Group achievements within category by groupKey
        const grouped = {};
        const ungrouped = [];
        
        byCategory[category].forEach(ach => {
          if (ach.groupKey) {
            if (!grouped[ach.groupKey]) {
              grouped[ach.groupKey] = [];
            }
            grouped[ach.groupKey].push(ach);
          } else {
            ungrouped.push(ach);
          }
        });
        
        // Sort grouped achievements by target value
        Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => {
            try {
              const aTarget = a.progress().target;
              const bTarget = b.progress().target;
              return aTarget - bTarget;
            } catch (e) {
              console.error('Error sorting achievements:', e);
              return 0;
            }
          });
        });
        
        // Render grouped achievements - add them to the master grid
        Object.keys(grouped).forEach(groupKey => {
          const group = grouped[groupKey];
          const groupDiv = document.createElement('div');
          groupDiv.className = 'achievement-group';
          // Don't set width - let grid handle it
          // gridColumn span 1 is the default, so no need to set it
          
          // Find the next achievement to work on
          let nextAchievement = null;
          let nextIndex = -1;
          for (let i = 0; i < group.length; i++) {
            const ach = group[i];
            const isUnlocked = achievements.includes(ach.id);
            if (!isUnlocked) {
              nextAchievement = ach;
              nextIndex = i;
              break;
            }
          }
          
          // If all are unlocked, show the last one
          if (!nextAchievement && group.length > 0) {
            nextAchievement = group[group.length - 1];
            nextIndex = group.length - 1;
          }
          
          // Create the visible card (next achievement)
          if (nextAchievement) {
            const isUnlocked = achievements.includes(nextAchievement.id);
            let progress, progressPercent;
            try {
              progress = nextAchievement.progress();
              progressPercent = progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;
            } catch (e) {
              console.error('Error calculating progress for', nextAchievement.id, e);
              progress = { current: 0, target: 1 };
              progressPercent = 0;
            }
            const showProgress = !isUnlocked && progressPercent < 100;
            // needsTotal should be true or undefined (not false) to meet requirements
            const meetsRequirements = progress.needsTotal !== false;
            // needsNoLosses should be true or undefined (not false) to meet requirements  
            const meetsNoLosses = progress.needsNoLosses !== false;
            
            // Check if achievement requires points to unlock
            const allAchievements = getAllAchievementsList();
            const totalPoints = allAchievements.reduce((sum, ach) => {
              if (achievements.includes(ach.id) && ach.points) {
                return sum + ach.points;
              }
              return sum;
            }, 0);
            const requiredPoints = nextAchievement.requiredPoints || 0;
            const hasEnoughPoints = totalPoints >= requiredPoints;
            
            const card = document.createElement('div');
            card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
            card.style.position = 'relative';
            
            const pointsText = nextAchievement.points ? `<div style="font-size: 0.9em; color: #f39c12; font-weight: 700; margin-top: 5px;">${nextAchievement.points} points</div>` : '';
            
            // Add expand button if there are more achievements in the group
            const expandButton = group.length > 1 ? `
              <button class="expand-group-btn" onclick="toggleAchievementGroup('${groupKey}')" style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(52, 152, 219, 0.1);
                border: 2px solid #3498db;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                cursor: pointer;
                font-size: 1.2em;
                color: #3498db;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
                font-weight: 700;
              " onmouseover="this.style.background='rgba(52, 152, 219, 0.2)'" onmouseout="this.style.background='rgba(52, 152, 219, 0.1)'">
                <span id="expand-icon-${groupKey}">▼</span>
              </button>
            ` : '';
            
            // Check if achievement is locked due to game count requirements
            let lockedMessage = '';
            if (!meetsRequirements) {
              const desc = nextAchievement.desc || '';
              const gameMatch = desc.match(/(\d+)\+.*games?/i);
              if (gameMatch) {
                lockedMessage = `🔒 Locked - Need ${gameMatch[1]}+ games`;
              } else {
                lockedMessage = '🔒 Locked - Requirements not met';
              }
            } else if (!meetsNoLosses) {
              lockedMessage = '🔒 Locked - Must win without losing pieces';
            }
            
            const progressDisplay = 
              lockedMessage ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">${lockedMessage}</div>` :
              requiredPoints > 0 && !hasEnoughPoints ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">🔒 Locked - Need ${requiredPoints} points (You have ${totalPoints})</div>` :
              isUnlocked ? `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target} <span style="color: #2ecc71;">✓</span></div>
                <div class="achievement-progress-bar">
                  <div class="achievement-progress-fill" style="width: 100%; background: #2ecc71;"></div>
                </div>` :
              `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target}</div>
                <div class="achievement-progress-bar">
                  <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
                </div>`;
            
            // Wrap trophy emoji in span with yellow color
            const nextAchievementName = nextAchievement.name.replace(/🏆/g, '<span class="trophy-emoji">🏆</span>');
            
            card.innerHTML = `
              ${expandButton}
              <div class="achievement-name">${nextAchievementName} ${isUnlocked ? '<span style="color: #2ecc71; font-size: 0.9em;">✓</span>' : ''}</div>
              <div class="achievement-desc">${nextAchievement.desc}</div>
              ${pointsText}
              ${progressDisplay}
            `;
            
            groupDiv.appendChild(card);
            
            // Create hidden container for all achievements in group
            const allGroupAchievements = document.createElement('div');
            allGroupAchievements.id = `group-${groupKey}`;
            allGroupAchievements.className = 'achievement-group-all';
            allGroupAchievements.style.display = 'none';
            allGroupAchievements.style.marginTop = '10px';
            allGroupAchievements.style.paddingTop = '10px';
            allGroupAchievements.style.borderTop = '2px solid #e9ecef';
            
            group.forEach((ach, idx) => {
              if (idx === nextIndex) return; // Skip the one already shown
              
              const isUnlocked = achievements.includes(ach.id);
              let progress, progressPercent;
              try {
                progress = ach.progress();
                progressPercent = progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;
              } catch (e) {
                console.error('Error calculating progress for', ach.id, e);
                progress = { current: 0, target: 1 };
                progressPercent = 0;
              }
              const showProgress = !isUnlocked && progressPercent < 100;
              // needsTotal should be true or undefined (not false) to meet requirements
              const meetsRequirements = progress.needsTotal !== false;
              // needsNoLosses should be true or undefined (not false) to meet requirements
              const meetsNoLosses = progress.needsNoLosses !== false;
              
              const subCard = document.createElement('div');
              subCard.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
              subCard.style.marginBottom = '10px';
              
              const pointsText = ach.points ? `<div style="font-size: 0.9em; color: #f39c12; font-weight: 700; margin-top: 5px;">${ach.points} points</div>` : '';
              const allAchievements = getAllAchievementsList();
              const totalPoints = allAchievements.reduce((sum, a) => {
                if (achievements.includes(a.id) && a.points) {
                  return sum + a.points;
                }
                return sum;
              }, 0);
              const requiredPoints = ach.requiredPoints || 0;
              const hasEnoughPoints = totalPoints >= requiredPoints;
              
              // Check if achievement is locked due to game count requirements
              let lockedMessage = '';
              if (!meetsRequirements) {
                // Extract game requirement from description or check specific achievements
                const desc = ach.desc || '';
                const gameMatch = desc.match(/(\d+)\+.*games?/i);
                if (gameMatch) {
                  lockedMessage = `🔒 Locked - Need ${gameMatch[1]}+ games`;
                } else {
                  lockedMessage = '🔒 Locked - Requirements not met';
                }
              } else if (!meetsNoLosses) {
                lockedMessage = '🔒 Locked - Must win without losing pieces';
              }
              
              const progressDisplay = 
                lockedMessage ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">${lockedMessage}</div>` :
                requiredPoints > 0 && !hasEnoughPoints ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">🔒 Locked - Need ${requiredPoints} points (You have ${totalPoints})</div>` :
                isUnlocked ? `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target} <span style="color: #2ecc71;">✓</span></div>
                  <div class="achievement-progress-bar">
                    <div class="achievement-progress-fill" style="width: 100%; background: #2ecc71;"></div>
                  </div>` :
                `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target}</div>
                  <div class="achievement-progress-bar">
                    <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
                  </div>`;
              subCard.innerHTML = `
                <div class="achievement-name">${ach.name} ${isUnlocked ? '<span style="color: #2ecc71; font-size: 0.9em;">✓</span>' : ''}</div>
                <div class="achievement-desc">${ach.desc}</div>
                ${pointsText}
                ${progressDisplay}
              `;
              
              allGroupAchievements.appendChild(subCard);
            });
            
            groupDiv.appendChild(allGroupAchievements);
            masterGrid.appendChild(groupDiv); // Add directly to master grid
          }
        });
        
        // Render ungrouped achievements - add directly to master grid
        ungrouped.forEach(ach => {
          const isUnlocked = achievements.includes(ach.id);
          let progress, progressPercent;
          try {
            progress = ach.progress();
            progressPercent = progress.target > 0 ? Math.min(100, (progress.current / progress.target) * 100) : 0;
          } catch (e) {
            console.error('Error calculating progress for', ach.id, e);
            progress = { current: 0, target: 1 };
            progressPercent = 0;
          }
          
          const card = document.createElement('div');
          card.className = `achievement-card ${isUnlocked ? 'unlocked' : ''}`;
          
          const pointsText = ach.points ? `<div style="font-size: 0.9em; color: #f39c12; font-weight: 700; margin-top: 5px;">${ach.points} points</div>` : '';
          const allAchievementsList = getAllAchievementsList();
          const totalPoints = allAchievementsList.reduce((sum, a) => {
            if (achievements.includes(a.id) && a.points) {
              return sum + a.points;
            }
            return sum;
          }, 0);
          const requiredPoints = ach.requiredPoints || 0;
          const hasEnoughPoints = totalPoints >= requiredPoints;
          
          // Check if achievement is locked due to game count requirements
          const meetsRequirements = progress.needsTotal !== false;
          const meetsNoLosses = progress.needsNoLosses !== false;
          let lockedMessage = '';
          if (!meetsRequirements) {
            const desc = ach.desc || '';
            const gameMatch = desc.match(/(\d+)\+.*games?/i);
            if (gameMatch) {
              lockedMessage = `🔒 Locked - Need ${gameMatch[1]}+ games`;
            } else {
              lockedMessage = '🔒 Locked - Requirements not met';
            }
          } else if (!meetsNoLosses) {
            lockedMessage = '🔒 Locked - Must win without losing pieces';
          }
          
          const progressDisplay = 
            lockedMessage ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">${lockedMessage}</div>` :
            requiredPoints > 0 && !hasEnoughPoints ? `<div class="achievement-progress" style="margin-top: 8px; color: #e74c3c;">🔒 Locked - Need ${requiredPoints} points (You have ${totalPoints})</div>` :
            isUnlocked ? `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target} <span style="color: #2ecc71;">✓</span></div>
              <div class="achievement-progress-bar">
                <div class="achievement-progress-fill" style="width: 100%; background: #2ecc71;"></div>
              </div>` :
            `<div class="achievement-progress" style="margin-top: 8px;">${progress.current} / ${progress.target}</div>
              <div class="achievement-progress-bar">
                <div class="achievement-progress-fill" style="width: ${progressPercent}%"></div>
              </div>`;
          
          // Wrap trophy emoji in span with yellow color
          const achievementName = ach.name.replace(/🏆/g, '<span class="trophy-emoji">🏆</span>');
          
          card.innerHTML = `
            <div class="achievement-name">${achievementName} ${isUnlocked ? '<span style="color: #2ecc71; font-size: 0.9em;">✓</span>' : ''}</div>
            <div class="achievement-desc">${ach.desc}</div>
            ${pointsText}
            ${progressDisplay}
          `;
          
          masterGrid.appendChild(card);
        });
      });
      
      // Append the master grid to container
      container.appendChild(masterGrid);
      
      modal.classList.add('show');
      } catch (e) {
        console.error('Error in showAllAchievements:', e);
        if (typeof showNotification === 'function') showNotification('Error loading achievements. Check the console for details.', 'error');
      }
    }

    function toggleAchievementGroup(groupKey) {
      const groupDiv = document.getElementById(`group-${groupKey}`);
      const icon = document.getElementById(`expand-icon-${groupKey}`);
      
      if (groupDiv.style.display === 'none') {
        groupDiv.style.display = 'block';
        icon.textContent = '▲';
      } else {
        groupDiv.style.display = 'none';
        icon.textContent = '▼';
      }
    }

    function closeAllAchievements() {
      document.getElementById('all-achievements-modal').classList.remove('show');
    }
    
    // Reset confirmation state
    let resetConfirmStage = 0; // 0 = not started, 1 = first warning, 2 = second warning, 3 = code input
    
    // Make reset function globally accessible
    function resetAllAchievements() {
      console.log('resetAllAchievements called');
      resetConfirmStage = 1;
      showResetConfirmModal(1);
    }
    
    function showResetConfirmModal(stage) {
      const modal = document.getElementById('reset-confirm-modal');
      const titleEl = document.getElementById('reset-confirm-title');
      const messageEl = document.getElementById('reset-confirm-message');
      const listContainer = document.getElementById('reset-confirm-list-container');
      const inputEl = document.getElementById('reset-confirm-input');
      const yesBtn = document.getElementById('reset-confirm-yes-btn');
      const noBtn = document.getElementById('reset-confirm-no-btn');
      
      if (!modal || !titleEl || !messageEl) {
        console.error('Reset modal elements not found');
        return;
      }
      
      resetConfirmStage = stage;
      
      if (stage === 1) {
        // First warning
        titleEl.textContent = '⚠️ Warning';
        messageEl.textContent = 'This will reset ALL achievements and points to zero, and clear your saved game history!\n\nThis action cannot be undone.';
        messageEl.style.color = '#555';
        listContainer.innerHTML = '';
        inputEl.style.display = 'none';
        yesBtn.textContent = 'Continue';
        yesBtn.onclick = () => showResetConfirmModal(2);
        noBtn.onclick = closeResetConfirmModal;
      } else if (stage === 2) {
        // Second warning with list
        titleEl.textContent = '⚠️ Are you ABSOLUTELY SURE?';
        messageEl.textContent = 'This will delete:';
        messageEl.style.color = '#555';
        listContainer.innerHTML = '<ul><li>All unlocked achievements</li><li>All achievement points</li><li>All game statistics</li><li>All saved game history (last 50 games)</li></ul>';
        inputEl.style.display = 'none';
        yesBtn.textContent = 'Continue';
        yesBtn.onclick = () => showResetConfirmModal(3);
        noBtn.onclick = closeResetConfirmModal;
      } else if (stage === 3) {
        // Code input
        titleEl.textContent = '⚠️ Final Confirmation';
        messageEl.textContent = 'Type "RESET" (all caps) to confirm:';
        messageEl.style.color = '#555';
        listContainer.innerHTML = '';
        inputEl.style.display = 'block';
        inputEl.value = '';
        setTimeout(() => inputEl.focus(), 100);
        yesBtn.textContent = 'Confirm Reset';
        yesBtn.onclick = performReset;
        noBtn.onclick = closeResetConfirmModal;
        
        // Allow Enter key to confirm
        const handleKeyPress = function(e) {
          if (e.key === 'Enter') {
            performReset();
          }
        };
        inputEl.onkeypress = handleKeyPress;
      }
      
      modal.classList.add('show');
    }
    
    function closeResetConfirmModal() {
      const modal = document.getElementById('reset-confirm-modal');
      const inputEl = document.getElementById('reset-confirm-input');
      const messageEl = document.getElementById('reset-confirm-message');
      const yesBtn = document.getElementById('reset-confirm-yes-btn');
      const titleEl = document.getElementById('reset-confirm-title');
      const dialog = modal ? modal.querySelector('.reset-confirm-dialog') : null;
      
      if (modal) {
        modal.classList.remove('show');
        resetConfirmStage = 0;
      }
      if (inputEl) {
        inputEl.value = '';
        inputEl.style.display = 'none';
        inputEl.onkeypress = null;
      }
      if (messageEl) {
        messageEl.style.color = '#555';
      }
      if (yesBtn) {
        yesBtn.style.display = 'block';
      }
      if (titleEl) {
        titleEl.style.color = '#e74c3c';
      }
      if (dialog) {
        dialog.style.borderColor = '#e74c3c';
      }
    }
    
    function performReset() {
      const inputEl = document.getElementById('reset-confirm-input');
      const resetCode = inputEl ? inputEl.value.trim().toUpperCase() : '';
      
      if (resetCode !== 'RESET') {
        const messageEl = document.getElementById('reset-confirm-message');
        if (messageEl) {
          messageEl.textContent = '❌ Invalid code. Type "RESET" (all caps) to confirm:';
          messageEl.style.color = '#e74c3c';
        }
        if (inputEl) {
          inputEl.value = '';
          inputEl.focus();
        }
        return;
      }
      
      closeResetConfirmModal();
      
      // Reset all achievements and stats (keep favorited games in history)
      if (cloudChessData) {
        cloudChessData.gameHistory = (cloudChessData.gameHistory || []).filter(function (r) {
          return r && r.favorite === true;
        });
      }
      achievements = [];
      playerStats = { wins: 0, losses: 0, draws: 0 };
      lifetimeStats = {
        capturesByQueen: 0,
        capturesByRook: 0,
        capturesByBishop: 0,
        capturesByKnight: 0,
        capturesByPawn: 0,
        totalCaptures: 0,
        checksGiven: 0,
        castlingMoves: 0,
        promotions: 0,
        enPassants: 0,
        longestGame: 0,
        shortestWin: Infinity,
        capturedQueens: 0,
        capturedRooks: 0,
        capturedBishops: 0,
        capturedKnights: 0,
        capturedPawns: 0,
        movesToE4: 0,
        movesToD4: 0,
        movesToE5: 0,
        movesToD5: 0,
        knightToF3: 0,
        knightToC3: 0,
        knightToF6: 0,
        knightToC6: 0,
        movesOnMove1: 0,
        movesOnMove5: 0,
        movesOnMove10: 0,
        movesOnMove20: 0,
        movesOnMove50: 0,
        pawnToE4: 0,
        pawnToD4: 0,
        queenToD4: 0,
        queenToE4: 0,
        bishopToF4: 0,
        rookToE1: 0,
        kingToE1: 0,
        consecutiveSamePiece: 0,
        castledOnMove10: 0,
        castledOnMove20: 0,
        promotedToQueen: 0,
        promotedToRook: 0,
        promotedToBishop: 0,
        promotedToKnight: 0,
        checkOnMove5: 0,
        captureOnMove10: 0,
        movesToE4Multiple: 0,
        movesToD4Multiple: 0,
        knightToF3Multiple: 0,
        knightToC3Multiple: 0,
        queenToD4Multiple: 0,
        promotedToQueenMultiple: 0,
        rookToA1: 0, rookToH1: 0, rookToA8: 0, rookToH8: 0,
        bishopToC1: 0, bishopToF1: 0, bishopToC8: 0, bishopToF8: 0,
        knightToG1: 0, knightToB1: 0, knightToG8: 0, knightToB8: 0,
        queenToA1: 0, queenToH1: 0, queenToA8: 0, queenToH8: 0,
        kingToG1: 0, kingToC1: 0, kingToG8: 0, kingToC8: 0,
        pawnToA2: 0, pawnToH2: 0, pawnToA7: 0, pawnToH7: 0,
        dailyStats: createFreshDailyStats(new Date().toDateString()),
        winsByTimeControl: {
          none: 0,
          '60': 0,
          '180|2': 0,
          '300|0': 0,
          '600|0': 0,
          '900|5': 0,
          '3600|0': 0
        },
        winsByPersonality: {
          balanced: 0,
          aggressive: 0,
          defensive: 0,
          positional: 0,
          material: 0,
          tactical: 0,
          custom: 0
        },
        winsInUnder10Moves: 0,
        winsInUnder15Moves: 0,
        winsInUnder20Moves: 0,
        winsInOver100Moves: 0,
        perfectGames: 0,
        comebackWins: 0,
        timePressureWins: 0,
        creativeZwischenzugWins: 0,
        creativeTriplePromotionWins: 0,
        creativeQueenGrandTourWins: 0,
        creativeRookLadderWins: 0,
        creativeKingMarathonWins: 0,
        creativeWindmillWins: 0,
        creativeSacrificeSymphonyWins: 0,
        creativePinGalleryWins: 0,
        creativeForkFeastWins: 0,
        creativeCenterDominationWins: 0,
        creativePawnStormWins: 0,
        creativeFullOrchestraWins: 0,
        creativeEFileOdysseyWins: 0,
        creativeDiscoveryWins: 0,
        creativeSkewerSalonWins: 0,
        creativeRookBatteryWins: 0,
        creativeQueenDownWins: 0,
        longestWinStreak: 0,
        currentWinStreak: 0,
        // Engagement tracking
        daysPlayedInARow: 0,
        lastPlayDate: null,
        totalGamesPlayed: 0,
        gamesWithoutLosingPieces: 0,
        winsWithOnlyPawns: 0,
        checkmateWithKnight: 0,
        checkmateWithBishop: 0,
        checkmateWithRook: 0,
        checkmateWithQueen: 0,
        checkmateWithPawn: 0,
        underpromotions: 0,
        gamesAsWhite: 0,
        gamesAsBlack: 0,
        winsAsWhite: 0,
        winsAsBlack: 0,
        blindfoldWins: 0,
        blindfoldWinsNoHistory: 0
      };
      
      // Reset shop: clear spent points, reset unlocks to defaults
      localStorage.setItem('shopPointsSpent', '0');
      localStorage.setItem('cheatPoints', '0');
      setCheckmateAddonsEnabled([]);
      saveUnlockedItems({
        boards: ['classic'],
        pieces: ['classic'],
        highlightColors: ['red'],
        arrowColors: ['red'],
        legalMoveDots: ['gray-circle'],
        themes: ['light'],
        checkmateEffects: [],
        timeControls: ['none']
      });
      
      // Persisted points (cloud + legacy); must match empty achievements
      localStorage.setItem('totalPoints', '0');
      
      // Reset all visual settings to defaults (keys must match readers: chessboardStyle, timeControl, moveEffect)
      localStorage.setItem('chessboardStyle', 'classic');
      localStorage.setItem('chessPieceStyle', 'classic');
      localStorage.setItem('highlightColor', 'red');
      localStorage.setItem('arrowColor', 'red');
      localStorage.setItem('legalMoveDotStyle', 'gray-circle');
      localStorage.setItem('pageTheme', 'light');
      localStorage.setItem('moveEffect', 'default');
      localStorage.setItem('timeControl', 'none');
      localStorage.setItem('selectedTimeControl', 'none');
      
      // Repopulate dropdowns from reset unlocks, then sync selects (changeBoardStyle reads #board-style value)
      if (typeof updateStyleDropdowns === 'function') updateStyleDropdowns();
      if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns();
      const boardSel = document.getElementById('board-style');
      if (boardSel) boardSel.value = 'classic';
      const pieceSel = document.getElementById('piece-style');
      if (pieceSel) pieceSel.value = 'classic';
      const settingsTime = document.getElementById('settings-time-control');
      if (settingsTime) settingsTime.value = 'none';
      const mainTime = document.getElementById('time-control');
      if (mainTime) mainTime.value = 'none';
      const moveEffSel = document.getElementById('settings-move-effect');
      if (moveEffSel) moveEffSel.value = 'default';
      
      changeBoardStyle();
      changePieceStyle();
      applyHighlightColor('red');
      applyArrowColor('red');
      applyLegalMoveDotStyle('gray-circle');
      applyPageTheme('light');
      applyMoveEffect('default');
      if (typeof applySettingsTimeControl === 'function') applySettingsTimeControl();
      
      // Save everything
      saveAchievements();
      savePlayerStats();
      saveLifetimeStats();
      
      // Update displays
      updateAchievementsDisplay();
      updatePlayerStatsDisplay();
      updateTotalPoints();
      
      // Refresh the achievements modal if it's open
      if (document.getElementById('all-achievements-modal').classList.contains('show')) {
        showAllAchievements(true);
      }
      if (typeof updateStyleDropdowns === 'function') updateStyleDropdowns();
      if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns();
      if (typeof updateShopPoints === 'function') updateShopPoints();
      if (typeof renderShopItems === 'function') renderShopItems();
      
      // Persist reset to cloud immediately (avoid losing reset if tab closes during debounce)
      if (typeof saveChessDataToCloud === 'function') {
        saveChessDataToCloud(true).catch(function (e) {
          console.error('Immediate cloud save after reset failed:', e);
        });
      }
      
      // Sync reset to account if logged in
      if (typeof autoSync === 'function') autoSync();
      
      // Show success message in modal style
      setTimeout(() => {
        const modal = document.getElementById('reset-confirm-modal');
        const titleEl = document.getElementById('reset-confirm-title');
        const messageEl = document.getElementById('reset-confirm-message');
        const listContainer = document.getElementById('reset-confirm-list-container');
        const inputEl = document.getElementById('reset-confirm-input');
        const yesBtn = document.getElementById('reset-confirm-yes-btn');
        const noBtn = document.getElementById('reset-confirm-no-btn');
        
        if (modal && titleEl && messageEl) {
          const dialog = modal.querySelector('.reset-confirm-dialog');
          titleEl.textContent = '✅ Success!';
          titleEl.style.color = '#2ecc71';
          messageEl.textContent = 'All achievements, statistics, and game history have been reset successfully!';
          messageEl.style.color = '#555';
          listContainer.innerHTML = '';
          inputEl.style.display = 'none';
          yesBtn.style.display = 'none';
          noBtn.textContent = 'Close';
          noBtn.onclick = closeResetConfirmModal;
          if (dialog) {
            dialog.style.borderColor = '#2ecc71';
          }
          modal.classList.add('show');
          
          // Auto-close after 2 seconds
          setTimeout(() => {
            closeResetConfirmModal();
          }, 2000);
        }
      }, 100);
    }
    
    // Make it globally accessible
    window.resetAllAchievements = resetAllAchievements;

    // ========================================================================
    // DAILY CHALLENGES CONFIGURATION
    // ========================================================================
    // Three challenges per calendar day are chosen deterministically (same for all players that day).
    // This function lists IDs for fallback validation; IDs are also derived from achievements with isDaily: true.
    // ========================================================================
    function getAllDailyChallengeIds() {
      // Keep a hardcoded fallback list, but ALSO derive IDs from the
      // achievement definitions so new daily challenges can't be forgotten here.
      const fallbackIds = [
        // ORIGINAL DAILY CHALLENGES
        'daily_explorer',              // Visit 20 unique squares
        'daily_checker',               // Give 8 checks
        'daily_warrior',               // Make 5 captures
        'daily_lightning',              // 2 quick wins (≤25 moves) today
        'daily_capturer',              // Make 10 captures
        'daily_longgame',              // 150 moves today
        'daily_promoter',              // Promote 3 pawns
        'daily_castler',               // Castle 2 times
        'daily_comeback',              // Win 3 games
        'daily_blindfold_bishop',      // Make 5 bishop moves in blindfold games
        'daily_personality_master',    // Play 3 games today
        'daily_survivor',              // 25 captures today
        'daily_blitz_king',            // Win 2 games with 1-minute time control
        'daily_time_master',           // Win games with 3 different time controls
        'daily_king_safety',           // Castle in 3 different games
        'daily_promotion_royalty',     // Promote a pawn in 2 different games
        'daily_material_advantage',    // Win 2 games with 3+ material advantage
        'daily_openings_expert',       // Play 3 different detected openings
        'daily_checkmate_artist',      // Checkmate with 3 different pieces
        'daily_en_passant_master',     // Perform en passant in 2 different games
        'daily_underpromotion',        // 2 underpromotions today
        'daily_queen_sacrifice',       // Win after sacrificing queen
        'daily_time_pressure',         // Win with less than 10 seconds remaining
        'daily_opening_trap',          // 2 wins in ≤30 moves today
        'daily_endgame_grinder',       // 2+ games and 120+ moves today
        'daily_perfect_defense',       // Win without losing any pieces
        'daily_check_storm',           // 22 checks today
        'daily_double_castle',         // Kingside + queenside castle today
        'daily_promotion_variety',     // 4 promotions today
        'daily_comeback_king',         // Win after being down 5+ material points
        'daily_piece_hunter',          // 18 captures today
        'daily_white_duo',             // 2 wins as White today
        'daily_black_duo',             // 2 wins as Black today
        // UNIQUE AND CREATIVE DAILY CHALLENGES
        'daily_blindfold_knight',      // Make 7 knight moves in pure blindfold (no history)
        'daily_pawn_promotion_chain',  // 5 promotions today
        'daily_queen_tour',           // Play 5 games today
        'daily_rook_ladder',           // Win 2 games today
        'daily_bishop_pair',           // Castle 4 times today
        'daily_pawn_storm',            // 20 pawn moves today
        'daily_king_walk',             // 15 king moves today
        'daily_piece_cycle',          // Win as White and Black today
        'daily_square_master',         // 35 unique squares today
        'daily_blindfold_win_no_history', // Win blindfold without move history
        'daily_piece_sacrifice_chain', // Win 3 games today
        'daily_center_control',        // 15 captures today
        'daily_pawn_island',           // 18 checks today
        'daily_rook_battery',          // Play 4 games today
        'daily_elite_capturer',
        'daily_pawn_sweeper',
        'daily_knight_roundup',
        'daily_bishop_ambush',
        'daily_rook_raider_adv',
        'daily_queen_snatcher',
        'daily_full_deck_hunter',
        'daily_checkmate_maestro',
        // ADD NEW DAILY CHALLENGE IDs HERE:
        // 'daily_your_new_challenge',
      ];

      try {
        const all = (typeof getAllAchievementsList === 'function') ? getAllAchievementsList() : [];
        const derivedIds = (Array.isArray(all) ? all : [])
          .filter(a => a && a.isDaily === true && typeof a.id === 'string' && a.id.length > 0)
          .map(a => a.id);

        return Array.from(new Set([...fallbackIds, ...derivedIds]));
      } catch (e) {
        return fallbackIds;
      }
    }
    
    // ========================================================================
    // DAILY CHALLENGES — same three for every player on a calendar day
    // ========================================================================
    // Picks use a deterministic shuffle (seeded PRNG) from the local date
    // string YYYY-MM-DD plus a fixed salt, so everyone sees the same dailies.

    const DAILY_CHALLENGE_PICK_SALT = 'ahrenslabs-chess-daily-v2';

    function hashStringToSeed(str) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    function mulberry32(a) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /** Fisher–Yates shuffle with seeded RNG; pool sorted for stable order across code versions. */
    function getDeterministicDailyChallengeIds(dateString, validList, maxPick) {
      const pool = [...(validList || [])]
        .filter(id => typeof id === 'string' && id.length > 0)
        .sort();
      if (pool.length === 0) return [];
      const seed = hashStringToSeed(DAILY_CHALLENGE_PICK_SALT + '|' + dateString);
      const rand = mulberry32(seed);
      const shuffled = pool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const t = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = t;
      }
      const need = Math.min(maxPick || 3, shuffled.length);
      const selected = shuffled.slice(0, need);
      const validSet = new Set(pool);
      const fallback = ['daily_explorer', 'daily_warrior', 'daily_checker'];
      let fi = 0;
      while (selected.length < 3 && fi < fallback.length) {
        const id = fallback[fi++];
        if (validSet.has(id) && !selected.includes(id)) selected.push(id);
      }
      return selected.slice(0, 3);
    }

    function getTodayDailyAchievements() {
      try {
        if (!lifetimeStats) return [];
        resetDailyStatsIfNeeded();
        const ds = lifetimeStats.dailyStats;
        if (!ds) return [];

        const today = new Date();
        const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        const validList = getAllDailyChallengeIds();
        const validSet = new Set(validList);

        if (validList.length === 0) {
          return [];
        }

        const selected = getDeterministicDailyChallengeIds(dateString, validList, 3);
        const sameLen = Array.isArray(ds.todayDailyIds) && ds.todayDailyIds.length === selected.length;
        const sameIds = sameLen && ds.todayDailyIds.every((id, i) => id === selected[i]);
        if (ds.dailyPickDate === dateString && sameIds && selected.every(id => validSet.has(id))) {
          return ds.todayDailyIds;
        }

        ds.todayDailyIds = selected;
        ds.dailyPickDate = dateString;
        saveLifetimeStats();
        return ds.todayDailyIds;
      } catch (e) {
        console.error('Error in getTodayDailyAchievements:', e);
        return ['daily_explorer', 'daily_warrior', 'daily_checker'];
      }
    }

    /** Full daily counters + metadata; shared by full reset and midnight rollover. */
    function createFreshDailyStats(lastResetDate) {
      return {
        lastResetDate,
        todayDailyIds: null,
        dailyPickDate: null,
        gamesPlayedToday: 0,
        gamesWonToday: 0,
        winsAsWhiteToday: 0,
        winsAsBlackToday: 0,
        quickWinsToday: 0,
        fastWins30Today: 0,
        kingMovesToday: 0,
        pawnMovesToday: 0,
        movesMadeToday: 0,
        capturesToday: 0,
        checksGivenToday: 0,
        uniqueSquaresVisitedToday: [],
        longestGameToday: 0,
        fastestWinToday: Infinity,
        promotionsToday: 0,
        castlingToday: 0,
        checksToday: 0,
        bishopMovesInBlindfoldToday: 0,
        longestStreakNoPiecesLostToday: 0,
        winsByTimeControlToday: {},
        gamesCastledToday: 0,
        gamesPromotedToday: 0,
        winsWithMaterialAdvantageToday: 0,
        uniqueOpeningsPlayedToday: [],
        uniqueCheckmatePiecesToday: [],
        gamesWithEnPassantToday: 0,
        underpromotionsToday: 0,
        underpromotionMovesToday: 0,
        queenSacrificeWinsToday: 0,
        timePressureWinsToday: 0,
        perfectWinsToday: 0,
        maxChecksInSingleGameToday: 0,
        castlingTypesToday: [],
        varietyPromotionGamesToday: 0,
        comebackWinsToday: 0,
        pieceHunterGamesToday: 0,
        knightMovesInPureBlindfoldToday: 0,
        triplePromotionGamesToday: 0,
        queenTourGamesToday: 0,
        rookLadderGamesToday: 0,
        bishopPairWinsToday: 0,
        knightForkGamesToday: 0,
        pawnStormGamesToday: 0,
        kingWalkGamesToday: 0,
        pieceCycleGamesToday: 0,
        squareMasterGamesToday: 0,
        pureBlindfoldWinsToday: 0,
        sacrificeChainGamesToday: 0,
        centerControlGamesToday: 0,
        pawnIslandGamesToday: 0,
        rookBatteryGamesToday: 0,
        pinMasterGamesToday: 0,
        skewerKingGamesToday: 0,
        discoveredAttackGamesToday: 0,
        windmillGamesToday: 0,
        zwischenzugGamesToday: 0,
        playerCapturesByTypeToday: { p: 0, n: 0, b: 0, r: 0, q: 0 }
      };
    }

    function resetDailyStatsIfNeeded() {
      const today = new Date().toDateString();
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      
      if (!lifetimeStats.dailyStats || lifetimeStats.dailyStats.lastResetDate !== today) {
        // Track days played in a row
        if (lifetimeStats.lastPlayDate) {
          const lastPlayDate = new Date(lifetimeStats.lastPlayDate);
          lastPlayDate.setHours(0, 0, 0, 0);
          const daysDiff = Math.floor((todayDate - lastPlayDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 1) {
            // Consecutive day
            lifetimeStats.daysPlayedInARow = (lifetimeStats.daysPlayedInARow || 0) + 1;
          } else if (daysDiff > 1) {
            // Streak broken
            lifetimeStats.daysPlayedInARow = 1;
          } else if (daysDiff === 0) {
            // Same day, don't change streak
          } else {
            // First time playing
            lifetimeStats.daysPlayedInARow = 1;
          }
        } else {
          // First time playing
          lifetimeStats.daysPlayedInARow = 1;
        }
        lifetimeStats.lastPlayDate = todayDate.toISOString();
        
        // Clear ALL daily achievements when date changes
        const allDailyIds = getAllDailyChallengeIds();
        allDailyIds.forEach(id => {
          const index = achievements.indexOf(id);
          if (index > -1) {
            achievements.splice(index, 1);
          }
        });
        saveAchievements();
        
        lifetimeStats.dailyStats = createFreshDailyStats(today);
        saveLifetimeStats();
      } else {
        // Same day - update last play date but don't reset streak
        lifetimeStats.lastPlayDate = todayDate.toISOString();
        if (lifetimeStats.dailyStats && !lifetimeStats.dailyStats.playerCapturesByTypeToday) {
          lifetimeStats.dailyStats.playerCapturesByTypeToday = { p: 0, n: 0, b: 0, r: 0, q: 0 };
        }
        saveLifetimeStats();
      }
    }
    
    function loadLifetimeStats() {
      const saved = localStorage.getItem('lifetimeStats');
      if (saved) {
        const loaded = JSON.parse(saved);
        // Merge with default stats to ensure all properties exist
        lifetimeStats = {
          ...lifetimeStats,
          ...loaded
        };
      }
      // Check if daily stats need reset
      resetDailyStatsIfNeeded();
    }

    function saveLifetimeStats() {
      localStorage.setItem('lifetimeStats', JSON.stringify(lifetimeStats));
    }

    function showAchievementNotification(newAchievements) {
      // Legacy function - redirects to sequential version
      showAchievementNotificationsSequentially(newAchievements);
    }
    
    function showAchievementNotificationsSequentially(newAchievements) {
      // Show achievements one at a time after game completion
      newAchievements.forEach((ach, index) => {
        setTimeout(() => {
          const notification = document.createElement('div');
          notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(46, 204, 113, 0.4);
            z-index: 10004;
            font-family: "Inter", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", "Android Emoji", sans-serif;
            font-weight: 600;
            animation: slideInRight 0.5s ease-out;
            max-width: 300px;
          `;
          const pointsText = ach.points ? `<div style="font-size: 0.85em; opacity: 0.9; margin-top: 5px;">+${ach.points} points</div>` : '';
          notification.innerHTML = `
            <div style="font-size: 1.5em; margin-bottom: 8px;">${ach.name}</div>
            <div style="font-size: 0.9em; opacity: 0.95;">${ach.desc}</div>
            ${pointsText}
          `;
          document.body.appendChild(notification);
          
          setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.5s ease-in forwards';
            setTimeout(() => notification.remove(), 500);
          }, 3500); // Show each notification for 3.5 seconds
        }, index * 4000); // 4 second delay between each notification
      });
    }

    /** Board hidden + mental-board shell when playing blindfold; normal layout during history replay. */
    function syncBlindfoldGameShellUi() {
      const gc = document.getElementById('game-container');
      const boardEl = document.getElementById('board');
      const timersEl = document.getElementById('timers-container');
      const flip = document.getElementById('flip-board-btn');
      if (!gc || !boardEl || !timersEl) return;
      const inReplay = typeof isHistoryReplayMode !== 'undefined' && isHistoryReplayMode;
      const effectiveBlindfold = blindfoldMode && !inReplay;
      if (effectiveBlindfold) {
        gc.classList.add('blindfold-game-active');
        boardEl.classList.add('blindfold-hidden');
        timersEl.classList.remove('blindfold-hidden');
        if (flip) flip.style.display = 'none';
      } else {
        gc.classList.remove('blindfold-game-active');
        boardEl.classList.remove('blindfold-hidden');
        timersEl.classList.remove('blindfold-hidden');
      }
    }

    function setupTimerDisplayOrder() {
      // Get the parent container
      const container = document.getElementById('timers-container');
      
      // Get the individual time slots
      const whiteSlot = document.getElementById('time-slot-white');
      const blackSlot = document.getElementById('time-slot-black');

      // Determine player and engine colors
      const playerIsWhite = playerColor === 'white';
      const playerSlot = playerIsWhite ? whiteSlot : blackSlot;
      const engineSlot = playerIsWhite ? blackSlot : whiteSlot;

      // Remove existing children
      container.innerHTML = '';

      // Engine time always on top, Player time always on bottom
      container.appendChild(engineSlot);
      container.appendChild(playerSlot);
    }

    function buildLiveChessboardOptions(initialPosition) {
      return {
        draggable: true,
        position: initialPosition || "start",
        orientation: playerColor,
        snapSpeed: 50,
        snapbackSpeed: 50,
        appearSpeed: 0,
        moveSpeed: 100,
        trashSpeed: 50,
        dragThrottleRate: 0,
        sparePieces: false,
        dropOffBoard: 'snapback',
        onDragStart: (source, piece, position, orientation) => {
          console.log('onDragStart called for:', source, 'selectedSquare before:', selectedSquare);
          
          // Store the drag start square and time for click detection
          window.dragStartSquare = source;
          window.dragStartTime = Date.now();
          
          // Clear any previous highlights when starting to drag a new piece
          $("#board .square-55d63").removeClass("highlight-legal");
          
          // Don't allow dragging if game is over
          if (game.game_over() || gameOver) {
            return false;
          }
          
          const turn = game.turn();
          const isPlayerTurn = (playerColor === "white" && turn === "w") || (playerColor === "black" && turn === "b");
          
          // Allow dragging opponent's pieces for premove, or own pieces on player's turn
          if (!isPlayerTurn) {
            // This is a premove - allow dragging player's pieces only
            if ((playerColor === "white" && piece.search(/^w/) === -1) || 
                (playerColor === "black" && piece.search(/^b/) === -1)) {
              return false; // Can't premove opponent's pieces
            }
            return true; // Allow premove
          }
          
          // Don't allow dragging opponent's pieces on player's turn
          if ((turn === 'w' && piece.search(/^b/) !== -1) || (turn === 'b' && piece.search(/^w/) !== -1)) {
            return false;
          }
          
          // Highlight legal moves when starting to drag
          highlightLegalMoves(source);
        },
        onDragMove: (newLocation, oldLocation, source, piece, position, orientation) => {
          // Remove previous legal-target class
          $("#board .square-55d63").removeClass("legal-target");
          
          // Only add yellow border if hovering over a legal move square
          const moves = game.moves({ square: source, verbose: true });
          const isLegal = moves.some(move => move.to === newLocation);
          
          if (isLegal) {
            $(`#board .square-${newLocation}`).addClass("legal-target");
          }
        },
        onMouseoutSquare: (square, piece) => {
          // Only remove legal-target class (yellow hover border during drag)
          $("#board .square-55d63").removeClass("legal-target");
          // Don't remove legal move dots - they stay until piece is deselected or moved
        },
        onDrop: (source, target) => {
          console.log('onDrop called:', source, '->', target);
          
          // Detect click-to-move: if dropped on same square, it's a click
          if (source === target) {
            console.log('Click detected (drop on same square):', source);
            handleSquareClick(source);
            return 'snapback'; // Return piece to original position
          }
          
          const turn = game.turn();
          const isPlayerTurn = (playerColor === "white" && turn === "w") || (playerColor === "black" && turn === "b");
          
          // Handle premove (during opponent's turn)
          if (!isPlayerTurn) {
            // Verify there's a piece at the source that belongs to the player
            const sourcePiece = game.get(source);
            if (!sourcePiece || sourcePiece.color !== (playerColor === 'white' ? 'w' : 'b')) {
              return 'snapback';
            }
            
            // Validate premove is theoretically legal for this piece type
            if (!isPremoveLegal(source, target, sourcePiece)) {
              console.log('Premove not valid for piece type:', sourcePiece.type, source, '->', target);
              return 'snapback';
            }
            
            // Add new premove to the array (chain of premoves)
            const newPremove = { from: source, to: target };
            premoves.push(newPremove);
            premoveJustSet = true;
            console.log('Premove added via drag:', newPremove, 'Total premoves:', premoves.length);
            
            // Update visual to show all premoves in the chain immediately
            // Use setTimeout to ensure board has finished updating after drop
            setTimeout(() => {
            updatePremoveVisual();
            }, 10);
            
            // Don't snapback - keep the piece moved
            return;
          }
          
          // Clear premove if player makes a manual move
          clearPremove();
          
          // Validate move synchronously first
          if (gameOver) {
            return 'snapback';
          }
          
          // Check if move is legal
          const move = game.move({ from: source, to: target, promotion: 'q' });
          if (!move) {
            return 'snapback';
          }
          
          // Move is legal - undo it and let handleMove process it properly
          game.undo();
          
          // Check if this is a promotion move
          if (isPromotionMove(source, target)) {
            showPromotionModal(source, target);
          } else {
          handleMove(source, target);
          }
        },
        onSnapEnd: () => {
          // Clean up after drag/drop (clicks are handled in onDrop)
          $("#board .square-55d63").removeClass("legal-target");
          
          // Don't remove legal move dots here - they should stay until a new piece is clicked
          // Only remove highlights if a move was actually made (handled in handleMove)
        },
        onClick: (square) => {
          const turn = game.turn();
          const isPlayerTurn = (playerColor === "white" && turn === "w") || (playerColor === "black" && turn === "b");
          const position = board.position();
          const piece = position[square];
          
          // If there's a selected piece
          if (selectedSquare) {
            // If clicking the same square, deselect
            if (selectedSquare === square) {
              selectedSquare = null;
              removeHighlights();
              return;
            }
            
            // Check if this is a legal move or premove
            if (!isPlayerTurn) {
              // Handle premove click
              if (!piece || (playerColor === "white" && piece.search(/^w/) !== -1) || 
                  (playerColor === "black" && piece.search(/^b/) !== -1)) {
                // Clicking empty square or own piece - try to premove
                const premoveFrom = selectedSquare;
                const premoveTo = square;
                
                // Clear highlights and selection
                selectedSquare = null;
                removeHighlights();
                
                // If clicking own piece, select it instead
                if (piece) {
                  selectedSquare = square;
                  highlightLegalMoves(square);
                } else {
                  // Add new premove to the array (chain of premoves)
                  const newPremove = { from: premoveFrom, to: premoveTo };
                  premoves.push(newPremove);
                  premoveJustSet = true;
                  console.log('Premove added via onClick:', newPremove, 'Total premoves:', premoves.length);
                  
                  // Update visual to show all premoves in the chain
                  updatePremoveVisual();
                }
                return;
              }
            } else {
              // Try to make a normal move - check if it's a promotion first
              const testMove = game.move({ from: selectedSquare, to: square, promotion: 'q' });
              
              if (testMove) {
                // Legal move
                clearPremove();
                const moveFrom = selectedSquare;
                const moveTo = square;
                selectedSquare = null;
                removeHighlights();
                game.undo();
                
                // Check if this is a promotion move
                if (isPromotionMove(moveFrom, moveTo)) {
                  showPromotionModal(moveFrom, moveTo);
                } else {
                  handleMove(moveFrom, moveTo);
                }
                return;
              } else if (piece) {
                // Illegal move but clicked on own piece - change selection
                const pieceColor = piece.search(/^w/) !== -1 ? 'w' : 'b';
                if ((turn === 'w' && pieceColor === 'w') || (turn === 'b' && pieceColor === 'b')) {
                  selectedSquare = square;
                  removeHighlights();
                  highlightLegalMoves(square);
                  return;
                }
              }
              
              // Invalid move, deselect
              selectedSquare = null;
              removeHighlights();
              return;
            }
          }
          
          // No piece selected - select clicked piece if valid
          if (piece) {
            if (!isPlayerTurn) {
              // During opponent's turn, allow selecting own pieces for premove
              if ((playerColor === "white" && piece.search(/^w/) !== -1) || 
                  (playerColor === "black" && piece.search(/^b/) !== -1)) {
                selectedSquare = square;
                highlightLegalMoves(square);
              }
            } else {
              // During player's turn, select own pieces
              const pieceColor = piece.search(/^w/) !== -1 ? 'w' : 'b';
              if ((turn === 'w' && pieceColor === 'w') || (turn === 'b' && pieceColor === 'b')) {
                selectedSquare = square;
                highlightLegalMoves(square);
              }
            }
          } else {
            // Clicked on empty square with no piece selected
            // Cancel all premoves if it's the opponent's turn (when premoves can be set)
            if (!isPlayerTurn && premoves.length > 0) {
              console.log('Empty square clicked during opponent turn, canceling all premoves');
              clearPremove();
            }
          }
        },
        pieceTheme: pieceThemes[currentPieceStyle],
      };
    }

    async function finalizeLiveChessboardMountAsync(resumeMoveTimerMs) {
      tearDownRightClickHandlers();
      disconnectTrifangxImgDragObserver();
      $(document).off('.trifangxLivePcancel');
      $('#board').off('.trifangxLiveCt');
      $('#board').off('dragstart.trifangxLiveDlg', 'img');

      premoveJustSet = false;
      ensureArrowOverlay();
      applyMoveEffect(currentMoveEffect);

      setTimeout(() => {
        ensureArrowOverlay();
        initRightClickHandlers();
      }, 100);

      setTimeout(() => {
        let mouseDownSquare = null;

        $('#board').off('.trifangxLiveCt').on('mousedown.trifangxLiveCt', function(e) {
          // Only handle left click
          if (e.button !== 0) return;
          
          let $square = $(e.target);
          
          // If clicked on a piece image, get the parent square
          if ($square.hasClass('piece-417db') || $square.prop('tagName') === 'IMG') {
            $square = $square.parent();
          }
          
          // Make sure we have a square element
          if (!$square.hasClass('square-55d63')) {
            $square = $square.closest('.square-55d63');
          }
          
          if ($square.length === 0) return;
          
          const square = $square.data('square');
          if (square) {
            mouseDownSquare = square;
          }
        }).on('mouseup.trifangxLiveCt', function(e) {
          // Only handle left click
          if (e.button !== 0) return;
          
          if (!mouseDownSquare) return;
          
          let $square = $(e.target);
          
          // If released on a piece image, get the parent square
          if ($square.hasClass('piece-417db') || $square.prop('tagName') === 'IMG') {
            $square = $square.parent();
          }
          
          // Make sure we have a square element
          if (!$square.hasClass('square-55d63')) {
            $square = $square.closest('.square-55d63');
          }
          
          if ($square.length === 0) {
            mouseDownSquare = null;
            return;
          }
          
          const square = $square.data('square');
          
          // Only treat as click if mousedown and mouseup on same square
          if (square && square === mouseDownSquare) {
            console.log('Click detected on square:', square);
            handleSquareClick(square);
          }
          
          mouseDownSquare = null;
        });
      }, 100);

      premoveJustSet = false;
      $(document)
        .off('.trifangxLivePcancel')
        .on('mousedown.trifangxLivePcancel touchstart.trifangxLivePcancel', function (e) {
          const $target = $(e.target);
          const isOnBoard = $target.closest('#board').length > 0;
          const isOnPiece =
            $target.hasClass('piece-417db') ||
            $target.hasClass('square-55d63') ||
            $target.closest('.square-55d63').length > 0;

          if (!isOnBoard && !isOnPiece) {
            if (premoves.length > 0 && !premoveJustSet) {
              console.log('Click detected outside board/pieces, canceling all premoves');
              clearPremove();
            }
            if (rightClickHighlightedSquares.size > 0) {
              clearRightClickHighlights();
            }
          }
          premoveJustSet = false;
        });

      setTimeout(() => {
        disconnectTrifangxImgDragObserver();
        $('#board img').off('dragstart.trifangxLiveImgDirect');
        $('#board img').on('dragstart.trifangxLiveImgDirect', function (e) {
          e.preventDefault();
          return false;
        });
        $('#board img').attr('draggable', 'false');

        const observer = new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
              if (node.tagName === 'IMG') {
                $(node).attr('draggable', 'false');
                $(node)
                  .off('dragstart.trifangxLiveMo')
                  .on('dragstart.trifangxLiveMo', function (e) {
                    e.preventDefault();
                    return false;
                  });
              }
              if (node.querySelectorAll) {
                $(node).find('img').attr('draggable', 'false');
                $(node)
                  .find('img')
                  .off('dragstart.trifangxLiveMo')
                  .on('dragstart.trifangxLiveMo', function (e) {
                    e.preventDefault();
                    return false;
                  });
              }
            });
          });
        });

        const bel = document.getElementById('board');
        if (bel) {
          observer.observe(bel, { childList: true, subtree: true });
          window.__trifangxImgDragObserver = observer;
        }
      }, 200);

      $('#board').on('dragstart.trifangxLiveDlg', 'img', function (e) {
        e.preventDefault();
        return false;
      });

      document.getElementById("move-timer-container").style.display = "block";
      document.getElementById("last-move-container").style.display = "block";
      document.getElementById("notation-container").style.display = "block";
      document.getElementById("notation-container").textContent = "";
      document.getElementById("game-stats-panel").style.display = "block";
      document.getElementById("export-pgn-btn").style.display = "block";
      document.getElementById("resign-btn").style.display = "block";
      document.getElementById("flip-board-btn").style.display = "block";
      document.getElementById("player-stats-panel").style.display = "block";
      document.getElementById("achievements-panel").style.display = "block";
      document.getElementById("opening-display").style.display = "none";
      
      // Load sound settings
      soundEnabled = document.getElementById("sound-effects").checked;
      
      // Load and display statistics
      loadPlayerStats();
      loadAchievements();
      loadLifetimeStats();
      updatePlayerStatsDisplay();
      updateAchievementsDisplay();
      updateTotalPoints();
      
      // Initialize stats
      updateGameStats();
      updateOpeningDisplay();

      // Handle blindfold mode (typed moves; clocks stay available when timed)
      if (blindfoldMode) {
        document.getElementById("move-input-container").style.display = "block";
        if (showHistoryInBlindfold) {
          document.getElementById("notation-container").classList.remove("blindfold-hidden");
        } else {
          document.getElementById("notation-container").classList.add("blindfold-hidden");
        }
      } else {
        document.getElementById("notation-container").classList.remove("blindfold-hidden");
        document.getElementById("move-input-container").style.display = "none";
      }
      syncBlindfoldGameShellUi();

      if (typeof updateNotationDisplay === 'function') {
        updateNotationDisplay();
      }

      const resumeMs =
        typeof resumeMoveTimerMs === 'number' &&
        Number.isFinite(resumeMoveTimerMs) &&
        resumeMoveTimerMs > 0
          ? resumeMoveTimerMs
          : undefined;
      startTimer(resumeMs);

      const engineToMove =
        (playerColor === 'white' && game.turn() === 'b') ||
        (playerColor === 'black' && game.turn() === 'w');
      if (engineToMove) {
        await engineMove();
      }

      touchLiveGameSnapshot();
    }

    async function clearFailedLiveResume() {
      stopHeartbeat();
      const gid = getEngineGameId();
      try {
        if (gid) await sendEngineCommand('stop', { game_id: gid });
      } catch (e) {}
      clearEngineTabSession();
      clearTrifangxLiveUrlAndSnapshot();
      await checkEngineStatus();
    }

    /**
     * After reload on `trifangx_live.html` (or legacy ?txlive=1), restore from snapshot and reconnect heartbeat.
     * Returns false if not resuming (caller should build the preview board or empty-state on the live page).
     */
    async function tryResumeLiveTrifangxFromSnapshot() {
      try {
        if (!isLoggedIn || !currentSessionId) {
          clearTrifangxLiveUrlAndSnapshot();
          return false;
        }
        let snap = null;
        try {
          const raw = sessionStorage.getItem(TRIFANGX_LIVE_SNAPSHOT_KEY);
          snap = raw ? JSON.parse(raw) : null;
        } catch (e) {
          snap = null;
        }
        if (!snap || snap.v !== 1 || !snap.game_id || !Array.isArray(snap.moves)) {
          clearEngineTabSession();
          clearTrifangxLiveUrlAndSnapshot();
          return false;
        }

        setEngineGameId(snap.game_id);
        try {
          const hr = await fetch(`${ENGINE_BASE}/heartbeat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: snap.game_id }),
          });
          if (!hr.ok) {
            await clearFailedLiveResume();
            return false;
          }
        } catch (e2) {
          await clearFailedLiveResume();
          return false;
        }

        markEngineLockHeldByThisTab();
        startHeartbeat();
        stopPregameStatusPolling();

        const pgTools = document.getElementById('chess-pregame-tools');
        if (pgTools) pgTools.style.display = 'none';

        playerColor = snap.playerColor === 'black' ? 'black' : 'white';
        timeLimited = !!snap.timeLimited;
        increment = snap.increment != null ? Number(snap.increment) : 0;
        whiteTime = snap.whiteTime != null ? snap.whiteTime : 0;
        blackTime = snap.blackTime != null ? snap.blackTime : 0;
        blindfoldMode = !!snap.blindfoldMode;
        showHistoryInBlindfold = !!snap.showHistoryInBlindfold;
        const bfCb = document.getElementById('blindfold-mode');
        if (bfCb) bfCb.checked = blindfoldMode;
        const shCb = document.getElementById('show-history');
        if (shCb) shCb.checked = showHistoryInBlindfold;
        if (snap.timeControlOption) {
          const tcSel = document.getElementById('time-control');
          if (tcSel) tcSel.value = snap.timeControlOption;
        }
        if (typeof snap.currentTimeControl !== 'undefined' && snap.currentTimeControl !== null) {
          currentTimeControl = snap.currentTimeControl;
        }

        moveClockTimes = Array.isArray(snap.moveClockTimes) ? snap.moveClockTimes.slice() : [];
        moveHistory = Array.isArray(snap.moveHistory) ? snap.moveHistory.slice() : [];
        lastMoveSquares =
          snap.lastMoveSquares && typeof snap.lastMoveSquares === 'object'
            ? {
                from: snap.lastMoveSquares.from != null ? snap.lastMoveSquares.from : null,
                to: snap.lastMoveSquares.to != null ? snap.lastMoveSquares.to : null,
              }
            : { from: null, to: null };
        capturedPieces =
          snap.capturedPieces && snap.capturedPieces.white
            ? {
                white: (snap.capturedPieces.white || []).slice(),
                black: (snap.capturedPieces.black || []).slice(),
              }
            : { white: [], black: [] };
        // Always follow the live tip after reload; a saved scrub index would desync board vs game.
        currentMoveIndex = -1;
        lastLiveMoveDisplayText =
          typeof snap.lastLiveMoveDisplayText === 'string' ? snap.lastLiveMoveDisplayText : 'None';
        premoves = Array.isArray(snap.premoves) ? snap.premoves.slice() : [];
        gameOver = false;
        selectedSquare = null;
        gameStartTime = new Date();

        game = new Chess();
        game.reset();
        for (const san of snap.moves) {
          const ok = game.move(san, { sloppy: true });
          if (!ok) {
            console.warn('Live resume: could not replay move', san);
            await clearFailedLiveResume();
            return false;
          }
        }

        if (moveHistory.length !== game.history().length) {
          const c = new Chess();
          moveHistory = [];
          for (const san of game.history()) {
            const mv = c.move(san, { sloppy: true });
            if (!mv) break;
            moveHistory.push(c.fen());
          }
        }

        const choosePanel = document.getElementById('choose-side');
        if (choosePanel) {
          choosePanel.style.display = 'none';
          choosePanel.style.opacity = '1';
          choosePanel.style.transform = '';
        }
        updateChessPregameToolsVisibility();

        const timersContainer = document.getElementById('timers-container');
        if (timersContainer) {
          timersContainer.style.display = timeLimited ? 'flex' : 'none';
        }
        if (timeLimited) {
          const wt = document.getElementById('white-total');
          const bt = document.getElementById('black-total');
          if (wt) wt.textContent = formatTime(whiteTime);
          if (bt) bt.textContent = formatTime(blackTime);
          if (typeof setupTimerDisplayOrder === 'function') setupTimerDisplayOrder();
        }

        document.getElementById('move-timer-container').innerHTML =
          'Time for this move: <span id="timer">00:00.00</span>';
        const lm = document.getElementById('last-move');
        if (lm) lm.textContent = lastLiveMoveDisplayText;

        if (board) {
          disconnectTrifangxImgDragObserver();
          tearDownRightClickHandlers();
          board.destroy();
          const bel = document.getElementById('board');
          if (bel) bel._rightClickHandlersInitialized = false;
        }

        document.getElementById('board-timers-container').style.display = 'flex';

        ensureArrowOverlay();
        board = Chessboard('board', buildLiveChessboardOptions(game.fen()));
        if (lastMoveSquares && lastMoveSquares.from && lastMoveSquares.to) {
          highlightLastMove(lastMoveSquares.from, lastMoveSquares.to);
        }
        highlightCheck();

        const resumeMoveTimerMs =
          typeof snap.moveTimerElapsedMs === 'number' &&
          Number.isFinite(snap.moveTimerElapsedMs)
            ? Math.max(0, snap.moveTimerElapsedMs)
            : 0;
        await finalizeLiveChessboardMountAsync(resumeMoveTimerMs);
        return true;
      } catch (err) {
        console.error('tryResumeLiveTrifangxFromSnapshot:', err);
        await clearFailedLiveResume();
        return false;
      }
    }

    async function startGame() {
      if (typeof window !== 'undefined' && window.TRIFANGX_PAGE_MODE === 'live') {
        showNotification('Start new games from the chess lobby (chess_engine.html).', 'error');
        return;
      }
      stopPregameStatusPolling();

      // Check if user is logged in
      if (!isLoggedIn || !currentSessionId) {
        showNotification('Please login to play', 'error');
        showLoginPage();
        return;
      }

      // Acquire a game slot via /start only — no extra /status round-trip. The server enforces
      // MAX_CONCURRENT_GAMES; 503 here shows the same waiting-room UX as /status would.

      // Acquire a game slot before leaving pregame. /status can disagree with /start (e.g. race or
      // timing). 503 = max concurrent games; 409 is reserved for legacy conflicts. Show the waiting-room
      // banner while #choose-side is still visible when start fails for capacity.
      let startData;
      try {
        startData = await sendEngineCommand('start');
      } catch (startErr) {
        const code = startErr && startErr.statusCode;
        if (code === 503) {
          _lastStatusOccupied = true;
          applyEngineOccupancyWaitingRoomUi(true);
          showNotification(
            'The engine is at maximum concurrent games. Try again in a moment.',
            'error'
          );
        } else if (code === 409) {
          _lastStatusOccupied = true;
          applyEngineOccupancyWaitingRoomUi(true);
          showNotification(
            'A game is already in progress (including while the engine is thinking). Please wait for it to finish.',
            'error'
          );
        } else {
          showNotification('Could not reach the game server. Please try again.', 'error');
        }
        return;
      }
      if (startData && startData.game_id) {
        setEngineGameId(startData.game_id);
      }
      markEngineLockHeldByThisTab();
      startHeartbeat();
      setTrifangxLivePlayUrl();

      const pgTools = document.getElementById('chess-pregame-tools');
      if (pgTools) pgTools.style.display = 'none';
      closeShop();
      closeSettings();
      const achModalEl = document.getElementById('all-achievements-modal');
      if (achModalEl) achModalEl.classList.remove('show');

      if (isHistoryReplayMode) {
        isHistoryReplayMode = false;
        replayModeBackup = null;
        const banHr = document.getElementById('history-replay-banner');
        if (banHr) banHr.style.display = 'none';
      }
      
      gameOver = false;
      
      // Clear right-click highlights and arrows when starting new game
      try {
        if (typeof clearRightClickHighlights === 'function') {
          clearRightClickHighlights();
        }
        if (typeof clearArrows === 'function') {
          clearArrows();
        }
      } catch (e) {
        console.log('Error clearing highlights/arrows:', e);
      }

      const side = document.getElementById("color-select").value;
      const timeOption = document.getElementById("time-control").value;
      blindfoldMode = document.getElementById("blindfold-mode").checked;
      showHistoryInBlindfold = document.getElementById("show-history").checked;
      playerColor = side === "random" ? (Math.random() < 0.5 ? "white" : "black") : side;
      
      // Track current game settings for achievements
      currentTimeControl = timeOption;
      
      // Track games as white/black
      if (playerColor === 'white') {
        lifetimeStats.gamesAsWhite = (lifetimeStats.gamesAsWhite || 0) + 1;
      } else {
        lifetimeStats.gamesAsBlack = (lifetimeStats.gamesAsBlack || 0) + 1;
      }
      saveLifetimeStats();
      
      const [base, inc] =
        timeOption === "none" ? [null, null] : timeOption.split("|").map(Number);

      timeLimited = timeOption !== "none";
      increment = inc || 0;
      whiteTime = base ? base * 1000 : 0;
      blackTime = base ? base * 1000 : 0;

      // Show or hide timers based on time control
      const timersContainer = document.getElementById("timers-container");
      if (timeLimited) {
        timersContainer.style.display = "flex";
      } else {
        timersContainer.style.display = "none";
      }

      // Reset game (don't create new, just reset existing)
      if (!game) {
        game = new Chess();
      } else {
        game.reset();
      }
      moveHistory = [];
      moveClockTimes = [];
      currentMoveIndex = -1;
      capturedPieces = { white: [], black: [] };
      lastMoveSquares = { from: null, to: null };
      gameStartTime = new Date();
      resetGameStats();
      premoves = []; // Clear any premoves
      selectedSquare = null; // Clear any selection
      
      // Hide the options panel with fade effect
      const choosePanel = document.getElementById("choose-side");
      choosePanel.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      choosePanel.style.opacity = "0";
      choosePanel.style.transform = "scale(0.95)";
      setTimeout(() => {
        choosePanel.style.display = "none";
        if (typeof updateChessPregameToolsVisibility === 'function') {
          updateChessPregameToolsVisibility();
        }
      }, 300);
      
      document.getElementById("move-timer-container").innerHTML = 'Time for this move: <span id="timer">00:00.00</span>';

      updateLastMove(null, "00:00.00", 0, 0);
      updateTurnDisplay();

      // Destroy preview board and create game board
      if (board) {
        disconnectTrifangxImgDragObserver();
        tearDownRightClickHandlers();
        board.destroy();
        const boardEl = document.getElementById('board');
        if (boardEl) {
          boardEl._rightClickHandlersInitialized = false;
        }
      }
      
      // Ensure arrow overlay exists (it may have been removed by board.destroy())
      ensureArrowOverlay();

      board = Chessboard("board", buildLiveChessboardOptions());

      await finalizeLiveChessboardMountAsync();

      if (!isTrifangxLiveDedicatedPage()) {
        try {
          persistTrifangxLiveSnapshot();
        } catch (eSnap) {}
        try {
          sessionStorage.setItem(TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY, '1');
        } catch (eHand) {}
        try {
          window.location.replace(new URL('trifangx_live.html', window.location.href).href);
        } catch (eNav) {
          try {
            sessionStorage.removeItem(TRIFANGX_LIVE_PAGEHIDE_HANDOFF_KEY);
          } catch (eClr) {}
        }
        return;
      }
    }

    // Check for insufficient material (draw condition)
    function isInsufficientMaterial() {
      const board = game.board();
      const pieces = [];
      
      // Count all pieces on the board
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          if (board[i][j]) {
            pieces.push(board[i][j]);
          }
        }
      }
      
      // Only kings = insufficient material
      if (pieces.length === 2) {
        return true;
      }
      
      // King + one minor piece (bishop or knight) = insufficient material
      if (pieces.length === 3) {
        const minors = pieces.filter(p => p.type === 'b' || p.type === 'n');
        if (minors.length === 1) {
          return true;
        }
      }
      
      // King + bishop vs King + bishop (same color bishops) = insufficient material
      if (pieces.length === 4) {
        const bishops = pieces.filter(p => p.type === 'b');
        if (bishops.length === 2) {
          // Check if bishops are on same color squares
          const bishopSquares = [];
          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              if (board[i][j] && board[i][j].type === 'b') {
                const square = String.fromCharCode(97 + j) + (8 - i);
                const isLight = (square.charCodeAt(0) - 97 + parseInt(square[1])) % 2 === 0;
                bishopSquares.push(isLight);
              }
            }
          }
          if (bishopSquares.length === 2 && bishopSquares[0] === bishopSquares[1]) {
            return true;
          }
        }
      }
      
      return false;
    }
    
    // Check for draw conditions and handle them
    function checkDrawConditions() {
      if (gameOver) return false;
      
      let drawReason = null;
      
      // Check for threefold repetition
      if (game.in_threefold_repetition()) {
        drawReason = "Draw by Threefold Repetition";
      }
      // Check for insufficient material
      else if (isInsufficientMaterial()) {
        drawReason = "Draw by Insufficient Material";
      }
      // Check for stalemate
      else if (game.in_stalemate()) {
        drawReason = "Draw by Stalemate";
      }
      // Check for 50-move rule (chess.js handles this as in_draw)
      else if (game.in_draw() && !game.in_checkmate() && !game.in_stalemate() && !game.in_threefold_repetition()) {
        drawReason = "Draw by 50-Move Rule";
      }
      
      if (drawReason) {
        const moveContainer = document.getElementById("move-timer-container");
        moveContainer.innerHTML = `<span style="color:#f39c12;">${drawReason}</span>`;
        playSound('move');
        gameOver = true;
        recordGameToCloudHistory('1/2-1/2');
        clearPremove();
        
        // Celebrate draw with animation
        celebrateDraw(drawReason);
        
        // Update statistics
        playerStats.draws++;
        savePlayerStats();
        updatePlayerStatsDisplay();
        resetDailyStatsIfNeeded();
        lifetimeStats.dailyStats.gamesPlayedToday++;
        const moveCount = game.history().length;
        if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
          lifetimeStats.dailyStats.longestGameToday = moveCount;
        }
        commitGameStatsToLifetime();
        checkAndUnlockAchievements();
        notifyGameFinishedToEngine('draw');
        releaseEngineOnGameEnd();
        // Show rematch modal
        setTimeout(() => showRematchModal("🤝 Draw", `${drawReason}. Play again?`), 2000);
        return true;
      }
      
      return false;
    }

    // Check if a move would be a promotion
    function isPromotionMove(from, to) {
      const piece = game.get(from);
      if (!piece || piece.type !== 'p') {
        return false;
      }
      // White pawn on 7th rank (rank 7) moving to 8th rank (rank 8)
      // Black pawn on 2nd rank (rank 2) moving to 1st rank (rank 1)
      const fromRank = parseInt(from[1]);
      const toRank = parseInt(to[1]);
      return (piece.color === 'w' && fromRank === 7 && toRank === 8) ||
             (piece.color === 'b' && fromRank === 2 && toRank === 1);
    }

    let promotionEscapeHandler = null;

    // Show promotion selection modal
    function showPromotionModal(from, to) {
      pendingPromotionMove = { from, to };
      const piece = game.get(from);
      const isWhite = piece && piece.color === 'w';
      const prefix = isWhite ? 'w' : 'b';

      const setPieceBg = (elementId, letter) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const url = getPieceImageUrl(prefix + letter);
        el.style.backgroundImage = `url('${url}')`;
      };
      setPieceBg('promote-queen', 'Q');
      setPieceBg('promote-rook', 'R');
      setPieceBg('promote-bishop', 'B');
      setPieceBg('promote-knight', 'N');

      const sub = document.getElementById('promotion-subtitle');
      if (sub) {
        sub.textContent = isWhite
          ? 'Promoting a white pawn — choose your new piece.'
          : 'Promoting a black pawn — choose your new piece.';
      }

      const modal = document.getElementById('promotion-modal');
      modal.classList.add('show');

      if (promotionEscapeHandler) {
        document.removeEventListener('keydown', promotionEscapeHandler);
      }
      promotionEscapeHandler = (e) => {
        if (e.key === 'Escape') hidePromotionModal();
      };
      document.addEventListener('keydown', promotionEscapeHandler);

      requestAnimationFrame(() => {
        const first = document.querySelector('#promotion-pieces .promotion-choice');
        if (first) first.focus();
      });
    }

    // Hide promotion selection modal
    function hidePromotionModal() {
      document.getElementById('promotion-modal').classList.remove('show');
      pendingPromotionMove = null;
      if (promotionEscapeHandler) {
        document.removeEventListener('keydown', promotionEscapeHandler);
        promotionEscapeHandler = null;
      }
    }

    // Execute promotion move with selected piece
    function executePromotionMove(promotionPiece) {
      if (!pendingPromotionMove) {
        return;
      }
      
      const { from, to } = pendingPromotionMove;
      hidePromotionModal();
      handleMove(from, to, promotionPiece);
    }

    // Initialize promotion modal event handlers (use event delegation for reliability)
    function initPromotionHandlers() {
      const promotionModal = document.getElementById('promotion-modal');
      const promotionContainer = document.getElementById('promotion-container');
      
      if (promotionModal && promotionContainer) {
        // Handle promotion piece selection (button or child span)
        promotionContainer.addEventListener('click', function(e) {
          const choice = e.target.closest('.promotion-choice');
          if (!choice || !promotionContainer.contains(choice)) return;
          const promotionType = choice.getAttribute('data-piece');
          if (promotionType) executePromotionMove(promotionType);
        });
        
        // Close modal when clicking outside the container (on the backdrop)
        promotionModal.addEventListener('click', function(e) {
          if (e.target === promotionModal) {
            hidePromotionModal();
          }
        });
      }
    }
    
    // Initialize on page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPromotionHandlers);
    } else {
      initPromotionHandlers();
    }

    async function handleMove(source, target, promotion = 'q') {
      // Check if user is logged in
      if (!isLoggedIn || !currentSessionId) {
        showNotification('Please login to play', 'error');
        showLoginPage();
        return;
      }
      console.log('handleMove called:', source, 'to', target, 'promotion:', promotion);
      
      removeHighlights();
      const move = game.move({ from: source, to: target, promotion: promotion });
      if (!move) {
        console.log('Move was invalid in handleMove (should not happen)');
        return;
      }

      // Play sound effects
      if (move.captured) {
        playSound('capture');
      } else {
        playSound('move');
      }
      clearRightClickHighlights();
      trackCapturedPiece(move);
      trackRandomAchievements(move, source, target);
      // Don't check achievements during moves - only after game completion
      lastMoveSquares = { from: source, to: target };
      
      const prevTurn = game.turn() === "w" ? "b" : "w";
      const moveTimeMs = stopTimerAndUpdateTotal(prevTurn);
      updateLastMove(move.san, formatTime(moveTimeMs), game.turn() === "w" ? "black" : "white", game.history().length/2 + 0.5);
      board.position(game.fen());
      highlightLastMove(source, target);
      highlightCheck();
      updateTurnDisplay();
      updateOpeningDisplay();
      updateGameStats();
      touchLiveGameSnapshot();

      // Check for draw conditions
      if (checkDrawConditions()) {
        return; // Draw handling is done in checkDrawConditions
      }

      if (game.in_checkmate()) {
        // Replaced alert() with UI message
        const moveContainer = document.getElementById("move-timer-container");
        moveContainer.innerHTML = 'CHECKMATE! <span style="color:#2ECC71;">You Win!</span>'; // Green text for win
        playSound('checkmate');
        celebrateCheckmate(true);
        gameOver = true;
        recordGameToCloudHistory(game.turn() === 'w' ? '0-1' : '1-0');
        
        // Update statistics and achievements
        playerStats.wins++;
        savePlayerStats();
        updatePlayerStatsDisplay();
        resetDailyStatsIfNeeded();
        lifetimeStats.dailyStats.gamesPlayedToday++;
        lifetimeStats.dailyStats.gamesWonToday++;
        const moveCount = game.history().length;
        if (moveCount < lifetimeStats.dailyStats.fastestWinToday) {
          lifetimeStats.dailyStats.fastestWinToday = moveCount;
        }
        if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
          lifetimeStats.dailyStats.longestGameToday = moveCount;
        }
        // Get checkmate piece from last move (the move that caused checkmate)
        let checkmatePiece = null;
        try {
          const history = game.history({ verbose: true });
          if (history.length > 0) {
            const lastMove = history[history.length - 1];
            // The piece that delivered checkmate is the piece that moved
            checkmatePiece = lastMove ? lastMove.piece : null;
          }
        } catch (e) {
          console.error('Error getting checkmate piece:', e);
        }
        
        trackWinStats(moveCount, checkmatePiece);
        commitGameStatsToLifetime();
        checkAndUnlockAchievements();
        notifyGameFinishedToEngine('win');
        releaseEngineOnGameEnd();
        // Show rematch modal
        setTimeout(() => showRematchModal("🎉 Victory!", "Congratulations! You won! Play again?"), 2000);
        return;
      }

      startTimer(); // Start move timer for engine
      await engineMove();
    }
    function normalizeSanForCompare(moveStr) {
      if (!moveStr) return "";
      return String(moveStr)
        .trim()
        .replace(/e\.p\./gi, "")
        .replace(/[+#]/g, "")
        .replace(/0-0-0/g, "O-O-O")
        .replace(/0-0/g, "O-O");
    }

    function tryApplyEngineMove(moveStr) {
      if (!moveStr) return null;

      // 1) Try strict SAN/UCI parse first.
      let applied = game.move(moveStr);
      if (applied) return applied;

      // 2) Try sloppy parse (used elsewhere for typed moves).
      applied = game.move(moveStr, { sloppy: true });
      if (applied) return applied;

      // 3) Match against legal SAN list after normalizing check/mate markers.
      const normalized = normalizeSanForCompare(moveStr);
      const legalMoves = game.moves({ verbose: true });
      const sanMatch = legalMoves.find(m => normalizeSanForCompare(m.san) === normalized);
      if (sanMatch) {
        applied = game.move({ from: sanMatch.from, to: sanMatch.to, promotion: sanMatch.promotion || 'q' });
        if (applied) return applied;
      }

      // 4) Support engine long-style moves like "Rc8f8", "Ra1c1", "a7a8Q", etc.
      // Accept optional separators/capture markers and mixed-case piece letters.
      const compact = String(moveStr).trim().replace(/[+#]/g, "");
      const longMatch = compact.match(/^([KQRBNkqrbn])?([a-h][1-8])(?:[-x:]?)([a-h][1-8])([QRBNqrbn])?$/);
      if (longMatch) {
        const pieceLetter = longMatch[1] ? longMatch[1].toUpperCase() : null;
        const from = longMatch[2];
        const to = longMatch[3];
        const promo = longMatch[4] ? longMatch[4].toLowerCase() : undefined;
        const candidate = game.move({ from, to, promotion: promo || 'q' });
        if (candidate && (!pieceLetter || candidate.piece.toUpperCase() === pieceLetter)) {
          return candidate;
        }
      }

      return null;
    }

    async function engineMove() {
      console.log('=== engineMove START ===');
      console.log('Game over status:', gameOver);
      console.log('Current position:', game.fen());
      try {
        const lastMove = game.history().slice(-1)[0];
        console.log('Last move:', lastMove, 'Game turn:', game.turn());
        console.log('Sending request to engine...');
        const gid = getEngineGameId();
        const MOVE_POLL_MS = 40;
        const MOVE_MAX_WAIT_MS = 180000;
        const response = await fetch(`${ENGINE_BASE}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game_id: gid,
            move: lastMove,
            color: game.turn() === "w" ? "black" : "white",
          }),
        });

        if (!response.ok) {
          const msg =
            response.status === 503
              ? "Engine busy (too many concurrent searches); try again shortly."
              : `HTTP error! status: ${response.status}`;
          throw new Error(msg);
        }

        const startData = await response.json();
        let data;
        if (response.status === 202 && startData.job_id) {
          const deadline = Date.now() + MOVE_MAX_WAIT_MS;
          while (Date.now() < deadline) {
            const pr = await fetch(`${ENGINE_BASE}/move_result/${startData.job_id}`, { method: "GET" });
            const d = await pr.json().catch(() => ({}));
            if (d.status === "done" && d.move) {
              data = { move: d.move };
              break;
            }
            if (d.status === "error" || (pr.status >= 400 && d.error)) {
              throw new Error(d.error || `Engine error (HTTP ${pr.status})`);
            }
            if (d.status === "gone" || (pr.status === 404 && d.status === "gone")) {
              throw new Error(d.error || "Move job expired or unknown.");
            }
            await new Promise((r) => setTimeout(r, MOVE_POLL_MS));
          }
          if (!data) {
            throw new Error("Engine move timed out while waiting for result.");
          }
        } else {
          data = startData;
        }
        console.log('Engine response:', data);
        if (!data.move) {
          console.log('ERROR: No move returned from engine');
          // Replaced alert() with UI message
          const moveContainer = document.getElementById("move-timer-container");
          moveContainer.innerHTML = 'ENGINE ERROR: <span style="color:red;">No move returned.</span>';
          return;
        }

        console.log('Engine move:', data.move);
        // Stop timer *before* making the move on the game object
        const moveTimeMs = stopTimerAndUpdateTotal(game.turn()); 
        const move = tryApplyEngineMove(data.move);
        
        if (!move) {
          console.error('ERROR: Invalid move returned from engine:', data.move);
          const moveContainer = document.getElementById("move-timer-container");
          moveContainer.innerHTML = 'ENGINE ERROR: <span style="color:red;">Invalid move returned.</span>';
          return;
        }
        
        console.log('Move applied to game. New position:', game.fen());
        console.log('Is checkmate?', game.in_checkmate());
        console.log('Is check?', game.in_check());
        console.log('Is game over?', game.game_over());
        
        trackCapturedPiece(move);
        lastMoveSquares = { from: move.from, to: move.to };
        
        updateLastMove(data.move, formatTime(moveTimeMs), game.turn() === "w" ? "black" : "white", game.history().length/2 + 0.5);
        
        board.position(game.fen());
        
        highlightLastMove(move.from, move.to);
        highlightCheck();
        updateTurnDisplay();
        updateOpeningDisplay();
        updateGameStats();
        touchLiveGameSnapshot();

        // Re-apply premove highlights if there are any (shouldn't be, but just in case)
        if (premoves.length > 0) {
          updatePremoveVisual();
        }

        // Play sound for engine move
        if (move.captured) {
          playSound('capture');
        } else {
          playSound('move');
        }
        if (game.in_check()) {
          playSound('check');
        }

        // Check for draw conditions
        if (checkDrawConditions()) {
          return; // Draw handling is done in checkDrawConditions
        }

        if (game.in_checkmate()) {
          console.log('CHECKMATE DETECTED - Player Lost');
          // Replaced alert() with UI message
          const moveContainer = document.getElementById("move-timer-container");
          moveContainer.innerHTML = 'CHECKMATE! <span style="color:red;">You Lose!</span>';
          playSound('checkmate');
          console.log('About to call celebrateCheckmate(false)');
          try {
            celebrateCheckmate(false);
            console.log('celebrateCheckmate call completed');
          } catch (err) {
            console.error('Error in celebrateCheckmate:', err);
          }
          gameOver = true;
          recordGameToCloudHistory(game.turn() === 'w' ? '0-1' : '1-0');
          clearPremove();
          
          // Update statistics and achievements
          playerStats.losses++;
          savePlayerStats();
          updatePlayerStatsDisplay();
          resetDailyStatsIfNeeded();
          lifetimeStats.dailyStats.gamesPlayedToday++;
          const moveCount = game.history().length;
          if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
            lifetimeStats.dailyStats.longestGameToday = moveCount;
          }
          commitGameStatsToLifetime();
          checkAndUnlockAchievements();
          notifyGameFinishedToEngine('loss');
          releaseEngineOnGameEnd();
          // Show rematch modal
          setTimeout(() => showRematchModal("💔 Defeat", "You were checkmated! Play again?"), 2000);
          return;
        }
        
        // Check if there are premoves and execute the first one if legal
        console.log('Checking for premoves...', premoves);
        if (premoves.length > 0) {
          const firstPremove = premoves[0];
          console.log('Attempting to execute first premove:', firstPremove);
          
          const premoveAttempt = game.move({ from: firstPremove.from, to: firstPremove.to, promotion: 'q' });
          console.log('Premove attempt result:', premoveAttempt);
          
          if (premoveAttempt) {
            // Premove is legal - it's been executed, remove it from the array
            console.log('Premove was legal and executed!');
            premoves.shift(); // Remove the executed premove
            
            const from = premoveAttempt.from;
            const to = premoveAttempt.to;
            
            trackCapturedPiece(premoveAttempt);
            lastMoveSquares = { from, to };
            
            const prevTurn = game.turn() === "w" ? "b" : "w";
            stopTimerAndUpdateTotal(prevTurn);
            // Premove is pre-decided; listed time is always zero.
            updateLastMove(premoveAttempt.san, formatTime(0), game.turn() === "w" ? "black" : "white", game.history().length/2 + 0.5);
            board.position(game.fen());
            
            // Remove red highlights for this executed premove
            $("#board .square-55d63").removeClass("premove-highlight premove-source");
            
            // Update visual to show remaining premoves if any
            if (premoves.length > 0) {
              updatePremoveVisual();
            }
            
            // Highlight with normal last-move highlight (not red premove highlight)
            highlightLastMove(from, to);
            highlightCheck();
            updateTurnDisplay();
            updateOpeningDisplay();
            updateGameStats();
            touchLiveGameSnapshot();

            // Check for draw conditions after premove
            if (checkDrawConditions()) {
              return; // Draw handling is done in checkDrawConditions
            }

            if (game.in_checkmate()) {
              const moveContainer = document.getElementById("move-timer-container");
              moveContainer.innerHTML = 'CHECKMATE! <span style="color:#2ECC71;">You Win!</span>';
              playSound('checkmate');
              celebrateCheckmate(true);
              gameOver = true;
              recordGameToCloudHistory(game.turn() === 'w' ? '0-1' : '1-0');
              clearPremove();

              // Update statistics and achievements
              playerStats.wins++;
              savePlayerStats();
              updatePlayerStatsDisplay();
              resetDailyStatsIfNeeded();
              lifetimeStats.dailyStats.gamesPlayedToday++;
              const moveCount = game.history().length;
              if (moveCount < lifetimeStats.dailyStats.fastestWinToday) {
                lifetimeStats.dailyStats.fastestWinToday = moveCount;
              }
              if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
                lifetimeStats.dailyStats.longestGameToday = moveCount;
              }
              // Get checkmate piece from the premove that was just executed
              let checkmatePiece = premoveAttempt ? premoveAttempt.piece : null;
              trackWinStats(moveCount, checkmatePiece);
              commitGameStatsToLifetime();
              checkAndUnlockAchievements();
              notifyGameFinishedToEngine('win');
              releaseEngineOnGameEnd();
              // Show rematch modal
              setTimeout(() => showRematchModal("🎉 Victory!", "Congratulations! You won! Play again?"), 2000);
              return;
            }
            
            // After executing premove, get engine response
            // The next premove in the chain will be executed after the engine moves
            console.log('Premove executed, now getting engine response...', premoves.length, 'premoves remaining');
            startTimer();
            await engineMove();
            return;
          } else {
            // First premove is no longer legal - clear all premoves and restore board position
            console.log('First premove was not legal, clearing all premoves');
            clearPremove();
          }
        }

        touchLiveGameSnapshot();
        startTimer(); // Start move timer for player
      } catch (err) {
        // Replaced alert() with UI message
        const moveContainer = document.getElementById("move-timer-container");
        moveContainer.innerHTML = `CONNECTION ERROR: <span style="color:red;">${err.message || 'Could not reach engine.'}</span>`;
        console.error('Engine connection error:', err);
        gameOver = true;
        notifyGameFinishedToEngine('error');
        releaseEngineOnGameEnd();
        // Show rematch modal for connection errors
        setTimeout(() => showRematchModal("⚠️ Connection Error", "Lost connection to engine. Try again?"), 2000);
      }
    }
    function submitMove() {
      if (gameOver) return;
      
      const moveInput = document.getElementById("move-input");
      const moveStr = moveInput.value.trim();
      
      if (!moveStr) {
        moveInput.style.borderColor = "red";
        setTimeout(() => { moveInput.style.borderColor = "#3498db"; }, 500);
        return;
      }
      
      removeHighlights();
      const move = game.move(moveStr, { sloppy: true });
      
      if (!move) {
        moveInput.style.borderColor = "red";
        setTimeout(() => { moveInput.style.borderColor = "#3498db"; }, 500);
        return;
      }
      
      moveInput.value = "";
      moveInput.style.borderColor = "#3498db";
      
      trackCapturedPiece(move);
      // Track per-game daily challenge stats for typed moves too
      // (e.g., Piece Cycle depends on pieceTypesMoved)
      trackRandomAchievements(move, move.from, move.to);
      lastMoveSquares = { from: move.from, to: move.to };
      
      const prevTurn = game.turn() === "w" ? "b" : "w";
      const moveTimeMs = stopTimerAndUpdateTotal(prevTurn);
      updateLastMove(move.san, formatTime(moveTimeMs), game.turn() === "w" ? "black" : "white", game.history().length/2 + 0.5);
      
      if (!blindfoldMode) {
        board.position(game.fen());
        highlightLastMove(move.from, move.to);
        highlightCheck();
      }
      
      updateTurnDisplay();
      updateOpeningDisplay();
      updateGameStats();
      touchLiveGameSnapshot();

      if (game.in_checkmate()) {
        const moveContainer = document.getElementById("move-timer-container");
        moveContainer.innerHTML = 'CHECKMATE! <span style="color:#2ECC71;">You Win!</span>';
        playSound('checkmate');
        celebrateCheckmate(true);
        gameOver = true;
        recordGameToCloudHistory(game.turn() === 'w' ? '0-1' : '1-0');

        // Update statistics and achievements
        playerStats.wins++;
        savePlayerStats();
        updatePlayerStatsDisplay();
        resetDailyStatsIfNeeded();
        lifetimeStats.dailyStats.gamesPlayedToday++;
        lifetimeStats.dailyStats.gamesWonToday++;
        const moveCount = game.history().length;
        if (moveCount < lifetimeStats.dailyStats.fastestWinToday) {
          lifetimeStats.dailyStats.fastestWinToday = moveCount;
        }
        if (moveCount > lifetimeStats.dailyStats.longestGameToday) {
          lifetimeStats.dailyStats.longestGameToday = moveCount;
        }
        // Get checkmate piece from last move (the move that caused checkmate)
        let checkmatePiece = null;
        try {
          const history = game.history({ verbose: true });
          if (history.length > 0) {
            const lastMove = history[history.length - 1];
            // The piece that delivered checkmate is the piece that moved
            checkmatePiece = lastMove ? lastMove.piece : null;
          }
        } catch (e) {
          console.error('Error getting checkmate piece:', e);
        }
        trackWinStats(moveCount, checkmatePiece);
        commitGameStatsToLifetime();
        checkAndUnlockAchievements();
        notifyGameFinishedToEngine('win');
        releaseEngineOnGameEnd();
        // Show rematch modal
        setTimeout(() => showRematchModal("🎉 Victory!", "Congratulations! You won! Play again?"), 2000);
        return;
      }

      startTimer();
      engineMove();
    }

    // ================================
    // CLOUD STORAGE SYSTEM
    // ================================
    const API_BASE_URL = 'https://chess-accounts.matthewahrens.workers.dev';

    // Cloud data object - replaces ALL localStorage
    let cloudChessData = null;

    // Account state  
    let currentSessionId = null;
    let currentUserId = null;
    let isLoggedIn = false;
    let saveTimeout = null;
    let dataLoaded = false;
    
    // Load chess data from cloud
    async function loadChessDataFromCloud() {
      currentSessionId = localStorage.getItem('ahrenslabs_sessionId');
      if (!currentSessionId) {
        console.log('No session ID found, redirecting to login...');
        setTimeout(() => {
          window.location.href = 'account.html?return=' + encodeURIComponent(trifangxAccountReturnFilename());
        }, 100);
        return false;
      }
      
      try {
        console.log('Fetching chess data from cloud with session:', currentSessionId.substring(0, 10) + '...');
        const response = await fetch(`${API_BASE_URL}/api/chess/load`, {
          headers: {
            'Authorization': `Bearer ${currentSessionId}`
          }
        });
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          console.error('Failed to load chess data, status:', response.status);
          const errorText = await response.text();
          console.error('Error response:', errorText);
          setTimeout(() => {
            window.location.href = 'account.html?return=' + encodeURIComponent(trifangxAccountReturnFilename());
          }, 100);
          return false;
        }
        
        const data = await response.json();
        console.log('Raw data from cloud:', data);
        
        // Ensure data has all required fields with defaults
        cloudChessData = {
          achievements: data.achievements || {},
          points: data.points || 0,
          shopUnlocks: data.shopUnlocks || {
            boards: ['classic'],
            pieces: ['classic'],
            highlightColors: ['red'],
            arrowColors: ['red'],
            legalMoveDots: ['blue-circle'],
            themes: ['light'],
            checkmateEffects: [],
            timeControls: ['none']
          },
          settings: data.settings || {
            boardStyle: 'classic',
            pieceStyle: 'classic',
            highlightColor: 'red',
            arrowColor: 'red',
            legalMoveDotStyle: 'blue-circle',
            pageTheme: 'light',
            checkmateAddons: [],
            timeControl: 'none'
          },
          stats: data.stats || {
            playerStats: { wins: 0, losses: 0, draws: 0 },
            lifetimeStats: {}
          },
          pointsSpent: data.pointsSpent || 0,
          cheatPoints: data.cheatPoints || 0,
          gameHistory: Array.isArray(data.gameHistory) ? data.gameHistory : []
        };
        const gameHistoryLenBeforeTrim = (cloudChessData.gameHistory || []).length;
        trimGameHistoryToCap();

        isLoggedIn = true;
        dataLoaded = true;
        currentUserId = localStorage.getItem('ahrenslabs_userId');

        if ((cloudChessData.gameHistory || []).length !== gameHistoryLenBeforeTrim) {
          saveChessDataToCloud(true);
        }
        
        // Update username display
        const username = localStorage.getItem('ahrenslabs_username') || 'Player';
        const usernameSpan = document.getElementById('header-username');
        if (usernameSpan) {
          usernameSpan.textContent = username;
          usernameSpan.style.display = 'block';
        }
        
        console.log('Chess data loaded and initialized:', cloudChessData);
        return true;
      } catch (error) {
        console.error('Failed to load chess data:', error);
        window.location.href = 'account.html?return=' + encodeURIComponent(trifangxAccountReturnFilename());
        return false;
      }
    }
    
    // Override localStorage for chess game data - redirect to cloud
    const originalLocalStorage = window.localStorage;
    const cloudStorage = {
      getItem: function(key) {
        // Allow unified auth keys to use real localStorage
        if (key.startsWith('ahrenslabs_')) {
          return originalLocalStorage.getItem(key);
        }
        
        if (!dataLoaded || !cloudChessData) {
          console.warn('Cloud data not loaded yet, returning null for:', key);
          return null;
        }
        
        // Map localStorage keys to cloud data
        const keyMap = {
          'achievements': () => JSON.stringify(cloudChessData.achievements || {}),
          'totalPoints': () => (cloudChessData.points || 0).toString(),
          'unlockedItems': () => JSON.stringify(cloudChessData.shopUnlocks || {}),
          'chessBoardStyle': () => cloudChessData.settings?.boardStyle || 'classic',
          'chessboardStyle': () => cloudChessData.settings?.boardStyle || 'classic',
          'chessPieceStyle': () => cloudChessData.settings?.pieceStyle || 'classic',
          'highlightColor': () => cloudChessData.settings?.highlightColor || 'red',
          'arrowColor': () => cloudChessData.settings?.arrowColor || 'red',
          'legalMoveDotStyle': () => cloudChessData.settings?.legalMoveDotStyle || 'blue-circle',
          'pageTheme': () => cloudChessData.settings?.pageTheme || 'light',
          'moveEffect': () => cloudChessData.settings?.moveEffect || 'default',
          'timeControl': () => cloudChessData.settings?.timeControl || 'none',
          'playerStats': () => JSON.stringify(cloudChessData.stats?.playerStats || {wins:0,losses:0,draws:0}),
          'lifetimeStats': () => JSON.stringify(cloudChessData.stats?.lifetimeStats || {}),
          'checkmateAddonsEnabled': () => JSON.stringify(cloudChessData.settings?.checkmateAddons || []),
          'selectedTimeControl': () => cloudChessData.settings?.timeControl || 'none',
          'shopPointsSpent': () => (cloudChessData.pointsSpent || 0).toString(),
          'cheatPoints': () => (cloudChessData.cheatPoints || 0).toString(),
          'gamesPlayed': () => (cloudChessData.stats?.playerStats?.wins || 0) + (cloudChessData.stats?.playerStats?.losses || 0) + (cloudChessData.stats?.playerStats?.draws || 0),
          'gamesWon': () => cloudChessData.stats?.playerStats?.wins || 0,
          'gamesLost': () => cloudChessData.stats?.playerStats?.losses || 0,
          'gamesDrawn': () => cloudChessData.stats?.playerStats?.draws || 0
        };
        
        if (keyMap[key]) {
          const result = keyMap[key]();
          return result !== undefined ? result : null;
        }
        
        return null;
      },
      
      setItem: function(key, value) {
        // Allow unified auth keys to use real localStorage
        if (key.startsWith('ahrenslabs_') || key === 'pendingVerificationEmail') {
          originalLocalStorage.setItem(key, value);
          return;
        }
        
        if (!dataLoaded || !cloudChessData) return;
        
        // Map localStorage keys to cloud data
        const keyMap = {
          'achievements': (v) => { cloudChessData.achievements = JSON.parse(v); },
          'totalPoints': (v) => { cloudChessData.points = parseInt(v) || 0; },
          'unlockedItems': (v) => { cloudChessData.shopUnlocks = JSON.parse(v); },
          'chessBoardStyle': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.boardStyle = v; },
          'chessboardStyle': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.boardStyle = v; },
          'chessPieceStyle': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.pieceStyle = v; },
          'highlightColor': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.highlightColor = v; },
          'arrowColor': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.arrowColor = v; },
          'legalMoveDotStyle': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.legalMoveDotStyle = v; },
          'pageTheme': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.pageTheme = v; },
          'moveEffect': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.moveEffect = v; },
          'timeControl': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.timeControl = v; },
          'playerStats': (v) => { if (!cloudChessData.stats) cloudChessData.stats = {}; cloudChessData.stats.playerStats = JSON.parse(v); },
          'lifetimeStats': (v) => { if (!cloudChessData.stats) cloudChessData.stats = {}; cloudChessData.stats.lifetimeStats = JSON.parse(v); },
          'checkmateAddonsEnabled': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.checkmateAddons = JSON.parse(v); },
          'selectedTimeControl': (v) => { if (!cloudChessData.settings) cloudChessData.settings = {}; cloudChessData.settings.timeControl = v; },
          'shopPointsSpent': (v) => { cloudChessData.pointsSpent = parseInt(v) || 0; },
          'cheatPoints': (v) => { cloudChessData.cheatPoints = parseInt(v) || 0; },
          'gamesPlayed': (v) => { /* handled in playerStats */ },
          'gamesWon': (v) => { /* handled in playerStats */ },
          'gamesLost': (v) => { /* handled in playerStats */ },
          'gamesDrawn': (v) => { /* handled in playerStats */ }
        };
        
        if (keyMap[key]) {
          keyMap[key](value);
          saveChessDataToCloud(false);
        }
      },
      
      removeItem: function(key) {
        if (key.startsWith('ahrenslabs_')) {
          originalLocalStorage.removeItem(key);
        }
        // For cloud items, just ignore removes or set to null
      }
    };
    
    // Override localStorage for this page
    Object.defineProperty(window, 'localStorage', {
      get: function() {
        return cloudStorage;
      }
    });

    // Save chess data to cloud (debounced; use immediate after full reset)
    async function saveChessDataToCloud(immediate) {
      if (!isLoggedIn || !currentSessionId) return;
      
      clearTimeout(saveTimeout);
      const doSave = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/chess/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${currentSessionId}`
            },
            body: JSON.stringify(cloudChessData)
          });
          
          if (response.ok) {
            console.log('Chess data saved to cloud');
          } else {
            console.error('Failed to save chess data');
          }
        } catch (error) {
          console.error('Save to cloud error:', error);
        }
      };
      
      if (immediate) {
        await doSave();
      } else {
        saveTimeout = setTimeout(doSave, 2000); // Debounce 2 seconds
      }
    }

    // Initialize account system
    function initAccountSystem() {
      // Check for existing session
      const savedSession = localStorage.getItem('chessSessionId');
      if (savedSession) {
        currentSessionId = savedSession;
        checkSession();
      } else {
        // No session - show login page
        showLoginPage();
      }
      
      // Add account UI to page
      addAccountUI();
      updateHeaderAuthButtons();
    }
    
    // Show login page
    function showLoginPage(tab = 'login') {
      stopPregameStatusPolling();
      document.getElementById('login-page').style.display = 'flex';
      const gt = document.getElementById('game-title');
      if (gt) gt.style.display = 'none';
      const cs = document.getElementById('choose-side');
      if (cs) cs.style.display = 'none';
      document.getElementById('game-container').style.display = 'none';
      updateChessPregameToolsVisibility();
      switchLoginPageTab(tab);
    }
    
    // Hide login page and show game
    function hideLoginPage() {
      document.getElementById('login-page').style.display = 'none';
      const isLiveShell = typeof window !== 'undefined' && window.TRIFANGX_PAGE_MODE === 'live';
      const gtitle = document.getElementById('game-title');
      if (gtitle) gtitle.style.display = isLiveShell ? 'none' : 'block';
      const cside = document.getElementById('choose-side');
      if (cside) cside.style.display = isLiveShell ? 'none' : 'block';
      document.getElementById('game-container').style.display = 'block';
      updateChessPregameToolsVisibility();
      checkEngineStatus().then(() => {
        if (typeof isChessPregamePhase === 'function' && isChessPregamePhase()) ensurePregameStatusPolling();
      }).catch(() => {});
    }
    
    // Switch login page tab
    function switchLoginPageTab(tab) {
      const loginTab = document.getElementById('login-page-tab-login');
      const signupTab = document.getElementById('login-page-tab-signup');
      const loginForm = document.getElementById('login-page-login-form');
      const signupForm = document.getElementById('login-page-signup-form');
      
      if (loginTab && signupTab) {
        loginTab.classList.toggle('active', tab === 'login');
        signupTab.classList.toggle('active', tab === 'signup');
        if (loginTab.classList.contains('active')) {
          loginTab.style.color = '#3498db';
          loginTab.style.borderBottomColor = '#3498db';
        } else {
          loginTab.style.color = '#666';
          loginTab.style.borderBottomColor = 'transparent';
        }
        if (signupTab.classList.contains('active')) {
          signupTab.style.color = '#3498db';
          signupTab.style.borderBottomColor = '#3498db';
        } else {
          signupTab.style.color = '#666';
          signupTab.style.borderBottomColor = 'transparent';
        }
      }
      
      if (loginForm && signupForm) {
        loginForm.style.display = tab === 'login' ? 'block' : 'none';
        signupForm.style.display = tab === 'signup' ? 'block' : 'none';
      }
    }
    
    // Handle login from login page
    async function handleLoginPageLogin() {
      const usernameEl = document.getElementById('login-page-username');
      const passwordEl = document.getElementById('login-page-password');
      const username = usernameEl ? usernameEl.value.trim() : '';
      const password = passwordEl ? passwordEl.value : '';
      if (!username || !password) {
        showNotification('Please enter username and password', 'error');
        return;
      }
      const success = await login(password, username);
      if (success) {
        hideLoginPage();
        updateHeaderAuthButtons();
      }
    }
    
    // Handle signup from login page
    async function handleLoginPageSignup() {
      const username = document.getElementById('login-page-signup-username').value;
      const email = document.getElementById('login-page-signup-email').value;
      const password = document.getElementById('login-page-signup-password').value;
      if (!username || !email || !password) {
        showNotification('Please fill in all fields', 'error');
        return;
      }
      const success = await signup(email, password, username);
      if (success) {
        hideLoginPage();
        updateHeaderAuthButtons();
      }
    }
    
    // Update header auth buttons
    function updateHeaderAuthButtons() {
      const loginBtn = document.getElementById('header-login-btn');
      const signupBtn = document.getElementById('header-signup-btn');
      const usernameSpan = document.getElementById('header-username');
      
      if (isLoggedIn) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'none';
        if (usernameSpan) {
          const username = localStorage.getItem('accountUsername') || 'User';
          usernameSpan.textContent = username;
          usernameSpan.style.display = 'inline-block';
        }
      } else {
        if (loginBtn) loginBtn.style.display = 'block';
        if (signupBtn) signupBtn.style.display = 'block';
        if (usernameSpan) usernameSpan.style.display = 'none';
      }
      updateChessPregameToolsVisibility();
    }

    // Check if session is valid
    async function checkSession() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: {
            'Authorization': `Bearer ${currentSessionId}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          isLoggedIn = true;
          currentUserId = userData.userId || null;
          updateAccountUI(true, userData.username || userData.email);
          // Sync user data to localStorage
          syncUserDataToLocal(userData);
          // Hide login page, show game
          hideLoginPage();
          updateHeaderAuthButtons();
          // Apply theme after login
          const savedTheme = localStorage.getItem('pageTheme') || 'light';
          applyPageTheme(savedTheme);
        } else {
          // Session invalid
          logout();
          showLoginPage();
        }
      } catch (error) {
        console.error('Session check failed:', error);
        logout();
        showLoginPage();
      }
    }

    // Signup
    async function signup(email, password, username) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password, username })
        });
        
        const data = await response.json();
        
        if (data.success) {
          currentSessionId = data.sessionId;
          currentUserId = data.userId;
          isLoggedIn = true;
          localStorage.setItem('chessSessionId', currentSessionId);
          localStorage.setItem('accountUsername', username);
          updateAccountUI(true, username);
          
          // Show verification message if provided
          if (data.message) {
            showNotification(data.message, 'success', 5000);
          } else {
            showNotification('Account created successfully!', 'success');
          }
          
          // Sync current localStorage data to account
          await syncLocalDataToAccount();
          updateHeaderAuthButtons();
          // Apply theme after signup
          const savedTheme = localStorage.getItem('pageTheme') || 'light';
          applyPageTheme(savedTheme);
          return true;
        } else {
          showNotification(data.error || 'Signup failed', 'error');
          return false;
        }
      } catch (error) {
        console.error('Signup error:', error);
        showNotification('Signup failed. Please try again.', 'error');
        return false;
      }
    }

    // Login
    async function login(password, username) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            password,
            username: username != null && String(username).trim() !== '' ? String(username).trim() : ''
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          currentSessionId = data.sessionId;
          currentUserId = data.userId;
          isLoggedIn = true;
          localStorage.setItem('chessSessionId', currentSessionId);
          // Save username from login response
          if (data.username) {
            localStorage.setItem('accountUsername', data.username);
            updateAccountUI(true, data.username);
          }
          // Load user data from account
          await loadUserDataFromAccount();
          showNotification('Logged in successfully!', 'success');
          updateHeaderAuthButtons();
          // Apply theme after login
          const savedTheme = localStorage.getItem('pageTheme') || 'light';
          applyPageTheme(savedTheme);
          return true;
        } else {
          showNotification(data.error || 'Login failed', 'error');
          return false;
        }
      } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed. Please try again.', 'error');
        return false;
      }
    }

    // Logout
    async function logout() {
      if (currentSessionId) {
        try {
          await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentSessionId}`
            }
          });
        } catch (error) {
          console.error('Logout error:', error);
        }
      }
      
      currentSessionId = null;
      currentUserId = null;
      isLoggedIn = false;
      localStorage.removeItem('chessSessionId');
      localStorage.removeItem('accountUsername');
      updateAccountUI(false, null);
      updateHeaderAuthButtons();
      // Remove all theme classes on logout
      document.documentElement.classList.remove('page-theme-light', 'page-theme-dark', 'page-theme-midnight', 'page-theme-ocean', 'page-theme-forest', 'page-theme-sunset', 'page-theme-cyber', 'page-theme-space', 'page-theme-aurora', 'page-theme-matrix', 'page-theme-retro', 'page-theme-galaxy', 'page-theme-fire');
      showNotification('Logged out', 'success');
      showLoginPage();
    }

    // Sync local data to account
    async function syncLocalDataToAccount() {
      if (!isLoggedIn) return;
      
      try {
        // Collect all user data from localStorage
        const userData = {
          achievements: JSON.parse(localStorage.getItem('achievements') || '{}'),
          points: parseInt(localStorage.getItem('totalPoints') || '0'),
          shopUnlocks: getUnlockedItems(),
          settings: {
            boardStyle: localStorage.getItem('chessboardStyle') || 'classic',
            pieceStyle: localStorage.getItem('chessPieceStyle') || 'classic',
            highlightColor: localStorage.getItem('highlightColor') || 'red',
            arrowColor: localStorage.getItem('arrowColor') || 'red',
            legalMoveDotStyle: localStorage.getItem('legalMoveDotStyle') || 'blue-circle',
            pageTheme: localStorage.getItem('pageTheme') || 'light',
            moveEffect: localStorage.getItem('moveEffect') || 'default'
          },
          stats: {
            gamesPlayed: parseInt(localStorage.getItem('gamesPlayed') || '0'),
            gamesWon: parseInt(localStorage.getItem('gamesWon') || '0'),
            gamesLost: parseInt(localStorage.getItem('gamesLost') || '0'),
            gamesDrawn: parseInt(localStorage.getItem('gamesDrawn') || '0')
          }
        };
        
        const response = await fetch(`${API_BASE_URL}/api/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSessionId}`
          },
          body: JSON.stringify(userData)
        });
        
        if (response.ok) {
          console.log('Data synced to account');
          // Notification removed - silent sync
        }
      } catch (error) {
        console.error('Sync error:', error);
        // Only show error notification if sync fails
        showNotification('Failed to sync data', 'error');
      }
    }

    // Load user data from account
    async function loadUserDataFromAccount() {
      if (!isLoggedIn) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/user`, {
          headers: {
            'Authorization': `Bearer ${currentSessionId}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          syncUserDataToLocal(userData);
          showNotification('Data loaded from account', 'success');
        }
      } catch (error) {
        console.error('Load error:', error);
        showNotification('Failed to load data', 'error');
      }
    }

    // Sync user data from account to localStorage
    function syncUserDataToLocal(userData) {
      // Save username
      if (userData.username) {
        localStorage.setItem('accountUsername', userData.username);
        updateAccountUI(true, userData.username);
      }
      if (userData.achievements) {
        localStorage.setItem('achievements', JSON.stringify(userData.achievements));
      }
      if (userData.points !== undefined) {
        localStorage.setItem('totalPoints', userData.points.toString());
      }
      if (userData.shopUnlocks) {
        localStorage.setItem('unlockedItems', JSON.stringify(userData.shopUnlocks));
      }
      if (userData.settings) {
        Object.keys(userData.settings).forEach(key => {
          const settingKey = key === 'boardStyle' ? 'chessboardStyle' :
                            key === 'pieceStyle' ? 'chessPieceStyle' :
                            key === 'highlightColor' ? 'highlightColor' :
                            key === 'arrowColor' ? 'arrowColor' :
                            key === 'legalMoveDotStyle' ? 'legalMoveDotStyle' :
                            key === 'pageTheme' ? 'pageTheme' :
                            key === 'moveEffect' ? 'moveEffect' : key;
          localStorage.setItem(settingKey, userData.settings[key]);
        });
      }
      if (userData.stats) {
        Object.keys(userData.stats).forEach(key => {
          localStorage.setItem(key, userData.stats[key].toString());
        });
      }
      
      // Apply loaded settings
      if (userData.settings) {
        // Apply board style
        if (userData.settings.boardStyle) {
          const boardStyleSelect = document.getElementById('board-style');
          if (boardStyleSelect) {
            boardStyleSelect.value = userData.settings.boardStyle;
            changeBoardStyle();
          }
        }
        
        // Apply piece style
        if (userData.settings.pieceStyle) {
          const pieceStyleSelect = document.getElementById('piece-style');
          if (pieceStyleSelect) {
            pieceStyleSelect.value = userData.settings.pieceStyle;
            changePieceStyle();
          }
        }
        
        // Apply highlight color
        if (userData.settings.highlightColor) {
          applyHighlightColor(userData.settings.highlightColor);
        }
        
        // Apply arrow color
        if (userData.settings.arrowColor) {
          applyArrowColor(userData.settings.arrowColor);
        }
        
        // Apply legal move dot style
        if (userData.settings.legalMoveDotStyle) {
          applyLegalMoveDotStyle(userData.settings.legalMoveDotStyle);
        }
        
        // Apply page theme
        if (userData.settings.pageTheme) {
          applyPageTheme(userData.settings.pageTheme);
        }
      }
      
      // Refresh UI
      if (typeof updateShopPoints === 'function') updateShopPoints();
      if (typeof updateStyleDropdowns === 'function') updateStyleDropdowns();
      if (typeof updateSettingsDropdowns === 'function') updateSettingsDropdowns();
      if (typeof renderShopItems === 'function') renderShopItems();
    }

    // REMOVED: Old account UI functions - now using unified system

    // Account modal removed - authentication now handled via full-page login

    // REMOVED: Old account functions - now using cloud storage wrapper that auto-saves

    // Verify email
    async function verifyEmail(token, email) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/verify?token=${token}&email=${email}`, {
          method: 'GET'
        });
        
        const data = await response.json();
        
        if (data.success) {
          showNotification('Email verified successfully! 🎉', 'success', 5000);
          localStorage.removeItem('pendingVerificationEmail');
        } else {
          showNotification(data.error || 'Email verification failed', 'error');
        }
      } catch (error) {
        console.error('Verification error:', error);
        showNotification('Email verification failed. Please try again.', 'error');
      }
    }
