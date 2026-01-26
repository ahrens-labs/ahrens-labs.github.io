# Cloudflare Workers Migration Guide for TrifangX Chess Engine

## Overview
Your Flask app needs to be converted to Cloudflare Workers. Key changes:
- Flask routes → Workers fetch handlers
- Global state → Durable Objects or request-based state
- Multiprocessing → Async/await (Workers don't support multiprocessing)
- Threading → Async operations

## Option 1: Cloudflare Workers with Python (Recommended)

### Step 1: Install Wrangler CLI
```bash
npm install -g wrangler
# or
pip install wrangler
```

### Step 2: Create Project Structure
```
chess-engine-worker/
├── wrangler.toml
├── src/
│   ├── index.py          # Main worker entry point
│   ├── chess_engine.py   # Your chess logic (cleaned up)
│   └── state.py          # State management
└── requirements.txt       # Python dependencies
```

### Step 3: Create wrangler.toml
```toml
name = "chess-engine"
main = "src/index.py"
compatibility_date = "2024-01-01"
compatibility_flags = ["python_workers"]

[env.production]
routes = [
  { pattern = "chess-engine.yourdomain.workers.dev", zone_name = "yourdomain.com" }
]

# Optional: Use Durable Objects for persistent state
# [[durable_objects.bindings]]
# name = "CHESS_STATE"
# class_name = "ChessState"
```

### Step 4: Convert Flask Routes to Workers

Create `src/index.py`:

```python
from js import Response, Request
import json
import sys
import os

# Import your chess engine functions
# You'll need to refactor these to not use global state
from chess_engine import (
    initialize_board,
    best_move_function,
    best_move_black,
    players_turn,
    players_turn_white,
    clean_move,
    convert_to_long_algebraic,
    convert_long_move,
    SCORING_MODIFIERS
)

# In-memory state (will be reset between requests unless using Durable Objects)
# For production, use Durable Objects or KV storage
engine_state = {
    'running': False,
    'board': None,
    'white_king_row': 0,
    'white_king_col': 4,
    'black_king_row': 7,
    'black_king_col': 4,
    'modifiers': SCORING_MODIFIERS.copy()
}

def reset_engine_state():
    """Reset engine state"""
    global engine_state
    engine_state['board'] = initialize_board()
    engine_state['white_king_row'] = 0
    engine_state['white_king_col'] = 4
    engine_state['black_king_row'] = 7
    engine_state['black_king_col'] = 4
    # Add other state resets as needed

async def handle_start():
    """Handle /start endpoint"""
    engine_state['running'] = True
    reset_engine_state()
    return Response.new(
        json.dumps({"message": "Engine started and state reset"}),
        headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    )

async def handle_stop():
    """Handle /stop endpoint"""
    engine_state['running'] = False
    reset_engine_state()
    return Response.new(
        json.dumps({"message": "Engine stopped and reset"}),
        headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    )

async def handle_move(request):
    """Handle /move endpoint"""
    if not engine_state['running']:
        return Response.new(
            json.dumps({'error': 'Engine is not running'}),
            status=400,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    
    try:
        body_text = await request.text()
        data = json.loads(body_text) if body_text else {}
        
        move_notation = data.get('move')
        color = data.get('color', 'white')
        
        board = engine_state['board']
        return_move = None
        
        if color == 'white':
            if move_notation:
                if move_notation in {'0-0', 'O-O'}:
                    players_turn_white(board, '0-0')
                elif move_notation in {'0-0-0', 'O-O-O'}:
                    players_turn_white(board, '0-0-0')
                else:
                    next_move = move_notation.strip()
                    players_turn_white(board, next_move)
            return_move = best_move_black(board, 'false', 'false')
            if return_move and len(clean_move(return_move)) == 5:
                return_move = convert_long_move(return_move)
        else:  # color is black
            if move_notation:
                if move_notation in {'0-0', 'O-O'}:
                    players_turn(board, '0-0')
                elif move_notation in {'0-0-0', 'O-O-O'}:
                    players_turn(board, '0-0-0')
                else:
                    next_move = move_notation.strip()
                    players_turn(board, next_move)
            return_move = best_move_function(board, 'false', 'false')
            if return_move and len(clean_move(return_move)) == 5 and return_move[0] != '0':
                return_move = convert_long_move(return_move)
        
        if return_move == '0-0':
            return Response.new(
                json.dumps({'move': 'O-O'}),
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        elif return_move == '0-0-0':
            return Response.new(
                json.dumps({'move': 'O-O-O'}),
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        if not return_move:
            return Response.new(
                json.dumps({'error': 'Engine failed to generate move'}),
                status=500,
                headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
            )
        
        return Response.new(
            json.dumps({'move': return_move}),
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
        
    except Exception as e:
        return Response.new(
            json.dumps({'error': f'Exception: {str(e)}'}),
            status=500,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

async def handle_modifiers(request):
    """Handle /modifiers endpoint"""
    headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    
    if request.method == "GET":
        return Response.new(
            json.dumps(engine_state['modifiers']),
            headers=headers
        )
    
    # POST
    try:
        body_text = await request.text()
        data = json.loads(body_text) if body_text else {}
        
        if not data:
            return Response.new(
                json.dumps({'error': 'No data provided'}),
                status=400,
                headers=headers
            )
        
        # Update modifiers
        for key, value in data.items():
            if key in engine_state['modifiers']:
                try:
                    engine_state['modifiers'][key] = float(value)
                except (ValueError, TypeError):
                    return Response.new(
                        json.dumps({'error': f'Invalid value for {key}: {value}'}),
                        status=400,
                        headers=headers
                    )
            else:
                return Response.new(
                    json.dumps({'error': f'Unknown modifier: {key}'}),
                    status=400,
                    headers=headers
                )
        
        return Response.new(
            json.dumps({'message': 'Modifiers updated', 'modifiers': engine_state['modifiers']}),
            headers=headers
        )
    except Exception as e:
        return Response.new(
            json.dumps({'error': str(e)}),
            status=500,
            headers=headers
        )

async def on_fetch(request, env):
    """Main fetch handler"""
    url = str(request.url)
    path = url.split('/')[-1].split('?')[0]  # Get endpoint, remove query params
    
    # Handle CORS preflight
    if request.method == "OPTIONS":
        return Response.new(None, headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        })
    
    # Route requests
    if path == "start":
        return await handle_start()
    elif path == "stop":
        return await handle_stop()
    elif path == "move":
        return await handle_move(request)
    elif path == "modifiers":
        return await handle_modifiers(request)
    else:
        return Response.new(
            json.dumps({"error": "Not found"}),
            status=404,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )

# Export the fetch handler
def fetch(request, env):
    return on_fetch(request, env)
```

### Step 5: Refactor Chess Engine Code

You'll need to modify your chess engine functions to:
1. **Remove global variables** - Pass state as parameters
2. **Remove multiprocessing** - Use async/await instead
3. **Remove threading** - Use async operations

Example refactoring:

```python
# OLD (uses globals):
def best_move_function(board, ...):
    global white_king_row, white_king_col
    # uses global state

# NEW (passes state):
def best_move_function(board, white_king_row, white_king_col, ...):
    # uses passed state
```

### Step 6: Deploy

```bash
wrangler login
wrangler deploy
```

### Step 7: Update HTML File

Update `chess_engine.html` line 3527:

```javascript
return fetch(`https://chess-engine.yourusername.workers.dev/${endpoint}`, {
```

## Option 2: Use Durable Objects for Persistent State

For state that persists across requests, use Durable Objects:

```python
# durable_object.py
class ChessState:
    def __init__(self, state, env):
        self.state = state
        self.env = env
        self.engine_running = False
        self.board = None
        # ... other state
    
    async def fetch(self, request):
        # Handle state operations
        pass
```

## Important Considerations

1. **Execution Time Limits**: 
   - Free tier: 50ms CPU time per request
   - Paid tier: 30 seconds CPU time
   - Your chess engine may need optimization

2. **Memory Limits**: 128MB on free tier

3. **No Multiprocessing**: You'll need to refactor to use async/await

4. **State Management**: Global state won't persist. Use:
   - Durable Objects (for persistent state)
   - KV storage (for simple key-value)
   - Pass state in requests (stateless)

5. **Python Libraries**: Not all Python packages work. Test compatibility.

## Alternative: Keep PythonAnywhere or Use Other Hosting

If Cloudflare Workers limitations are too restrictive, consider:
- **Railway.app** - Easy Python deployment, free tier
- **Render.com** - Free tier, supports Flask
- **Fly.io** - Good for Python apps
- **Heroku** - Classic option (paid now)

Would you like me to:
1. Create a complete refactored version of your engine?
2. Set up the Workers project structure?
3. Help optimize the code for Workers constraints?
