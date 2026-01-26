import random
import sys
import time
import threading
from collections import defaultdict
import re
from flask import Flask, request, jsonify
from flask_cors import CORS
from multiprocessing import Pool
import copy
import os
from concurrent.futures import ThreadPoolExecutor
import concurrent.futures
import requests

    # CPU count logged at startup (removed print for performance)

# -----------------------------------------------------------------------------
# Performance switches (server-friendly defaults)
# -----------------------------------------------------------------------------
# Creating a `multiprocessing.Pool` inside each `/move` request is extremely slow
# on hosted platforms (process spawn + pickling), often *slower* than sequential.
# If you move to a dedicated VM with real multi-core CPU, you can flip this on.
ENABLE_MULTIPROCESSING = False

# Noisy debug prints can dominate runtime on web servers due to log I/O.
DEBUG_LOGS = False

# Pre-compile regex for performance
MOVE_CLEAN_REGEX = re.compile(r'[^a-h1-8Ox-]')

# Pre-compute sets for membership checks (much faster than creating sets repeatedly)
WHITE_PIECES = {'P', 'N', 'B', 'R', 'Q'}
BLACK_PIECES = {'p', 'n', 'b', 'r', 'q'}
ALL_PIECES = WHITE_PIECES | BLACK_PIECES
# Frozensets for hot-path piece checks (avoid repeated set creation in loops)
ROOK_QUEEN_B = frozenset({'r', 'q'})
ROOK_QUEEN_W = frozenset({'R', 'Q'})
BISHOP_QUEEN_B = frozenset({'b', 'q'})
BISHOP_QUEEN_W = frozenset({'B', 'Q'})
RQ_OR_EMPTY = frozenset({'0', 'r', 'q', 'R', 'Q'})
BQ_OR_EMPTY = frozenset({'0', 'b', 'q', 'B', 'Q'})
BLACK_BN = frozenset({'b', 'n'})
BLACK_NR = frozenset({'n', 'r'})
WHITE_BN = frozenset({'B', 'N'})
WHITE_NR = frozenset({'N', 'R'})

# Pre-compute board indices (avoid creating lists repeatedly)
BOARD_ROWS = tuple(range(8))
BOARD_COLS = tuple(range(8))

def pos_to_indices(pos):
    col = ord(pos[0].lower()) - ord('a')
    row = 8 - int(pos[1])
    return row, col

def indices_to_pos(row, col):
    return chr(ord('a') + col) + str(8 - row)

def indices_to_pos_col(col):
    return chr(ord('a') + col)

def print_board(board):
    print("  a b c d e f g h")
    print(" +-----------------+")
    for r in range(8):
        row_str = str(8 - r) + "| "
        for c in range(8):
            row_str += board[r][c] + " "
        print(row_str + "|")
    print(" +-----------------+")
    print()  # Print a space after the board

#def print_moves(turn, number_of_moves, game_moves):
 #   output = ""
  #  for i, move in enumerate(game_moves):
   #     if i % 2 == 0:  # White's move
    #        output += f" {number_of_moves + 1}. {move}"
     #   else:  # Black's move
      #      output += f" {move}"
    #return output

def print_piece_move(board, best_piece, best_row, best_col, target_row, target_col, piece, color):
    disambiguation = get_move_disambiguation(board, best_piece, best_row, best_col, target_row, target_col)

    if color == 'b':
        if best_piece == 'p' and target_row == 0:
            if piece in WHITE_PIECES:
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
            else:
                move_played = indices_to_pos(target_row, target_col) + '=Q'
        else:
            if disambiguation:
                if piece in WHITE_PIECES:
                    move_played = best_piece.upper() + disambiguation + 'x' + indices_to_pos(target_row, target_col)
                else:
                    move_played = best_piece.upper() + disambiguation + indices_to_pos(target_row, target_col)
            else:
                if best_piece != 'p':
                    if piece in WHITE_PIECES:
                        move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                else:
                    if piece in WHITE_PIECES:
                        move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = indices_to_pos(target_row, target_col)
    elif color == 'w':
        if best_piece == 'P' and target_row == 7:
            if piece in BLACK_PIECES:
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
            else:
                move_played = indices_to_pos(target_row, target_col) + '=Q'
        else:
            if disambiguation:
                if piece in BLACK_PIECES:
                    move_played = best_piece.upper() + disambiguation + 'x' + indices_to_pos(target_row, target_col)
                else:
                    move_played = best_piece.upper() + disambiguation + indices_to_pos(target_row, target_col)
            else:
                if best_piece != 'P':
                    if piece in BLACK_PIECES:
                        move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                else:
                    if piece in BLACK_PIECES:
                        move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = indices_to_pos(target_row, target_col)

    # Check if this move puts opponent in check
    opponent_color = 'w' if color == 'b' else 'b'
    opp_king_row, opp_king_col = find_king(board, opponent_color)
    if opp_king_row != -1 and is_king_in_check(board, opp_king_row, opp_king_col, opponent_color):
        move_played += '+'

    return move_played

def clean_move(move):
    return MOVE_CLEAN_REGEX.sub('', move).replace('O-O-O', '0-0-0').replace('O-O', '0-0')


# Helper function to update global king positions when they move
def update_king_position(piece, from_row, from_col, to_row, to_col):
    global white_king_row, white_king_col, black_king_row, black_king_col
    if piece == 'K':
        white_king_row = to_row
        white_king_col = to_col
    elif piece == 'k':
        black_king_row = to_row
        black_king_col = to_col


def find_king(board, color):
    # Hybrid approach: Try global variables first, but verify against board
    # This ensures correctness during analysis while staying fast for main game
    global white_king_row, white_king_col, black_king_row, black_king_col

    if color == 'w':
        # Check if global position matches board (for main game speed)
        if (0 <= white_king_row < 8 and 0 <= white_king_col < 8 and
            board[white_king_row][white_king_col] == 'K'):
            return white_king_row, white_king_col
        # Fallback: scan board (for analysis/temporary positions)
        for r in range(8):
            row_data = board[r]
            for c in range(8):
                if row_data[c] == 'K':
                    return r, c
    else:
        # Check if global position matches board (for main game speed)
        if (0 <= black_king_row < 8 and 0 <= black_king_col < 8 and
            board[black_king_row][black_king_col] == 'k'):
            return black_king_row, black_king_col
        # Fallback: scan board (for analysis/temporary positions)
        for r in range(8):
            row_data = board[r]
            for c in range(8):
                if row_data[c] == 'k':
                    return r, c

    return -1, -1  # Should not happen in a valid game


# Fast board copying - much faster than deepcopy for 8x8 lists
def fast_copy_board(board):
    return [r[:] for r in board]

def initialize_board():
    # On a web server, you cannot use input().
    # This will now always return the standard starting chess board.
    # If you want to load custom boards, you'll need a separate Flask endpoint for it.
    board = [
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
    ]
    return board

# --- Global Variables ---
draws = 0
fifty_move_rule = 0
wins = 0
castled = False
castled_white = False
dragon = True
middlegame = False
opening = False
endgame = False
bots = False
fake_castled_black = False
edge_up_black_king = False
edge_down_black_king = False
edge_left_black_king = False
edge_right_black_king = False
edge_up_white_king = False
edge_down_white_king = False
edge_left_white_king = False
edge_right_white_king = False
number_of_moves = 0
white_move_count = 0  # Track white's move number
black_move_count = 0  # Track black's move number
king_move = 0
king_move_white = 0
game_moves = []
scores = {}
position_history = defaultdict(int)
engine_running = True

# King position tracking - eliminates expensive find_king() board scans
white_king_row = 0
white_king_col = 4
black_king_row = 7
black_king_col = 4

board = initialize_board()

# --- Flask App Initialization (ONLY ONCE) ---
app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": "https://ahrenslabs.com",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type"],
    "supports_credentials": False
}})
# --- Flask Routes ---
@app.route('/start', methods=['POST'])
def start_engine():
    global engine_running
    engine_running = True
    # Re-initialize board and state when starting, if desired, to ensure a fresh game
    reset_engine_state()
    return jsonify({"message": "Engine started and state reset"})

@app.route('/stop', methods=['POST'])
def stop_engine():
    global engine_running
    engine_running = False
    reset_engine_state() # Ensure state is reset when stopping
    return jsonify({"message": "Engine stopped and reset"})

def reset_engine_state():
    global draws, fifty_move_rule, wins, castled, castled_white
    global dragon, middlegame, opening, endgame, bots
    global fake_castled_black, edge_up_black_king, edge_down_black_king
    global edge_left_black_king, edge_right_black_king
    global edge_up_white_king, edge_down_white_king
    global edge_left_white_king, edge_right_white_king
    global number_of_moves, king_move, king_move_white
    global position_history, stop_event, timer_thread
    global game_moves, scores, board # Make sure board is also reset
    global white_king_row, white_king_col, black_king_row, black_king_col

    draws = 0
    fifty_move_rule = 0
    wins = 0
    castled = False
    castled_white = False
    dragon = True
    middlegame = False
    opening = False
    endgame = False
    bots = False
    fake_castled_black = False
    edge_up_black_king = False
    edge_down_black_king = False
    edge_left_black_king = False
    edge_right_black_king = False
    edge_up_white_king = False
    edge_down_white_king = False
    edge_left_white_king = False
    edge_right_white_king = False
    number_of_moves = 0
    white_move_count = 0
    black_move_count = 0
    king_move = 0
    king_move_white = 0
    position_history = defaultdict(int)
    stop_event = threading.Event()
    timer_thread = None
    game_moves = []
    scores = {}
    # Reset caches (new game state)
    global SCORING_VERSION
    SCORING_VERSION += 1
    # Reset king positions to starting squares
    white_king_row = 0
    white_king_col = 4
    black_king_row = 7
    black_king_col = 4
    board = initialize_board() # Reset board to initial state

@app.route('/move', methods=['POST'])
def get_move():
    if not engine_running:
        return jsonify({'error': 'Engine is not running'}), 400
    data = request.get_json()
    move_notation = data.get('move')
    color = data.get('color', 'white')
        # Move received (removed print for performance)

    if move_notation:
        notation_move = move_notation.strip()
        if len(clean_move(move_notation)) == 4 and move_notation != '0-0-0':
            move_notation = convert_to_long_algebraic(move_notation, board, color[0])
            # Move notation (removed print for performance)
    return_move = None

    try:
        if color == 'white':
            # Player just played as white, so engine plays as black
            if move_notation:
                if move_notation in {'0-0', 'O-O'}:
                    players_turn_white(board, '0-0', '0-0')
                elif move_notation in {'0-0-0', 'O-O-O'}:
                    players_turn_white(board, '0-0-0', '0-0-0')
                else:
                    next_move = move_notation.strip()
                    players_turn_white(board, next_move, notation_move)
            # Engine plays as black (moves black pieces - lowercase)
            return_move = best_move_black(board, 'false', 'false')
            if return_move and len(clean_move(return_move)) == 5 and return_move not in {'0-0-0', '0-0'}:
                return_move = convert_long_move(return_move)
        else: # color is black
            # Player just played as black, so engine plays as white
            if move_notation:
                if move_notation in {'0-0', 'O-O'}:
                    players_turn(board, '0-0', '0-0')
                elif move_notation in {'0-0-0', 'O-O-O'}:
                    players_turn(board, '0-0-0', '0-0-0')
                else:
                    next_move = move_notation.strip()
                    players_turn(board, next_move, notation_move)
            # Engine plays as white (moves white pieces - uppercase)
            return_move = best_move_function(board, 'false', 'false')
            if return_move and len(clean_move(return_move)) == 5 and return_move not in {'0-0-0', '0-0'} :
                return_move = convert_long_move(return_move)

        if return_move == '0-0':
            return jsonify({'move': 'O-O'})
        elif return_move == '0-0-0':
            return jsonify({'move': 'O-O-O'})

        if not return_move:
            return jsonify({'error': 'Engine failed to generate move'}), 500

        return jsonify({'move': return_move})

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"ERROR in /move: {e}")
        print(f"Traceback: {error_trace}")
        return jsonify({'error': f'Exception: {str(e)}'}), 500

@app.route('/modifiers', methods=['POST', 'GET'])
def update_modifiers():
    """Update or retrieve scoring modifiers to adjust engine personality"""
    if request.method == 'GET':
        # Return current modifiers
        return jsonify(SCORING_MODIFIERS)

    # POST - update modifiers
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    # Update any provided modifiers
    for key, value in data.items():
        if key in SCORING_MODIFIERS:
            try:
                SCORING_MODIFIERS[key] = float(value)
            except (ValueError, TypeError):
                return jsonify({'error': f'Invalid value for {key}: {value}'}), 400
        else:
            return jsonify({'error': f'Unknown modifier: {key}'}), 400

    # Modifiers affect evaluation; bump version and clear caches
    global SCORING_VERSION
    SCORING_VERSION += 1
    _clear_engine_caches()

    return jsonify({'message': 'Modifiers updated', 'modifiers': SCORING_MODIFIERS})

def evaluate_chunks(chunk):
    # Optimized: removed excessive printing for performance
    results = []
    for task in chunk:
        key, scoring, scoring_time = evaluate_white_task(task)
        if scoring:
            results.append((key, scoring))
    return results


def evaluate_white_task(args):
    board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history = args
    scoring, scoring_time = evaluate_white(board, row, col, new_row, new_col, good_moves, {}, piece, black_king_row, black_king_col, captured_piece, position_history)
    if piece == '0-0-0':
        key = '0-0-0'
    elif piece == '0-0':
        key = '0-0'
    else:
        key = (row, col, new_row, new_col, piece)
    # Removed excessive printing for performance
    if scoring:
        return key, scoring, scoring_time
    else:
        return None, None, None

def evaluate_white(board, from_row, from_col, to_row, to_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history):
    checkmate = False
    checkmate2 = False
    bad_checkmate = False
    stalemate = False
    scoring_time = 0
    if piece == '0-0':
        board[7][7] = '0'
        board[7][5] = 'r'
        board[7][6] = 'k'
        board[7][4] = '0'
        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
        scoring_time += score_time
        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
            checkmate = True
        if best_row == best_col == target_row == target_col == best_piece == captured == '2':
            bad_checkmate = True
            return -1000, scoring_time
        if not checkmate and not bad_checkmate:
            if best_piece != 'P':
              if board[target_row][target_col] in BLACK_PIECES and DEBUG_LOGS:
                print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
              elif DEBUG_LOGS:
                print(best_piece.upper() + indices_to_pos(target_row, target_col))
            else:
                if board[target_row][target_col] in BLACK_PIECES and DEBUG_LOGS:
                  print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                elif DEBUG_LOGS:
                  print(indices_to_pos(target_row, target_col))
            board[best_row][best_col] = '0'
            board[target_row][target_col] = best_piece
            best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time = best_move2(board)
            scoring_time += score_time
            if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                checkmate2 = True
            if not checkmate2:
                if best_piece2 != 'p':
                    if board[target_row2][target_col2] in WHITE_PIECES and DEBUG_LOGS:
                      print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                    elif DEBUG_LOGS:
                      print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                else:
                    if board[target_row2][target_col2] in WHITE_PIECES and DEBUG_LOGS:
                      print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                    elif DEBUG_LOGS:
                      print(indices_to_pos(target_row2, target_col2))
                board[best_row2][best_col2] = '0'
                board[target_row2][target_col2] = best_piece2
                current_score = score(board, 'w')
                scoring_time += 0
                board[best_row2][best_col2] = best_piece2
                board[target_row2][target_col2] = captured2
                board[best_row][best_col] = best_piece
                board[target_row][target_col] = captured
                scores['0-0'] = current_score
                board[7][6] = '0'
                board[7][4] = 'k'
                board[7][7] = 'r'
                board[7][5] = '0'
                checkmate = False
                checkmate2 = False
                black_king_row, black_king_col = find_king(board, 'b')
        elif checkmate:
            return 10000, scoring_time
            # sys.exit() # Removed sys.exit()
    elif piece == '0-0-0':
        board[7][0] = '0'
        board[7][3] = 'r'
        board[7][2] = 'k'
        board[7][4] = '0'
        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
        scoring_time += score_time
        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
            checkmate = True
        if best_row == best_col == target_row == target_col == best_piece == captured == '2':
            bad_checkmate = True
            return -1000, scoring_time
        if not checkmate and not bad_checkmate:
            if best_piece != 'P':
              if board[target_row][target_col] in BLACK_PIECES and DEBUG_LOGS:
                print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
              elif DEBUG_LOGS:
                print(best_piece.upper() + indices_to_pos(target_row, target_col))
            else:
                if board[target_row][target_col] in BLACK_PIECES and DEBUG_LOGS:
                  print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                elif DEBUG_LOGS:
                  print(indices_to_pos(target_row, target_col))
            board[best_row][best_col] = '0'
            board[target_row][target_col] = best_piece
            best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time = best_move2(board)
            scoring_time += score_time
            if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                checkmate2 = True
            if not checkmate2:
                if best_piece2 != 'p':
                    if board[target_row2][target_col2] in WHITE_PIECES and DEBUG_LOGS:
                      print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                    elif DEBUG_LOGS:
                      print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                else:
                    if board[target_row2][target_col2] in WHITE_PIECES and DEBUG_LOGS:
                      print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                    elif DEBUG_LOGS:
                      print(indices_to_pos(target_row2, target_col2))
                board[best_row2][best_col2] = '0'
                board[target_row2][target_col2] = best_piece2
                current_score = score(board, 'w')
                board[best_row2][best_col2] = best_piece2
                board[target_row2][target_col2] = captured2
                board[best_row][best_col] = best_piece
                board[target_row][target_col] = captured
                scores['0-0-0'] = current_score
                board[7][4] = 'k'
                board[7][2] = '0'
                board[7][0] = 'r'
                board[7][3] = '0'
                checkmate = False
                checkmate2 = False
                black_king_row, black_king_col = find_king(board, 'b')
        elif checkmate:
            return 10000, scoring_time
            # sys.exit() # Removed sys.exit()

    else:
        board[from_row][from_col] = '0'
        board[to_row][to_col] = piece
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            current_score = -1.25
            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
        else:
            if piece == 'k':
                black_king_row, black_king_col = find_king(board, 'b')
            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):

                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                scoring_time += score_time
                if draw:
                    current_score = -1.25
                    scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                else:
                    if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                        white_king_row, white_king_col = find_king(board, 'w')
                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            checkmate = True
                        else:
                            stalemate = True
                            current_score = -1.25
                            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                    elif best_row == best_col == target_row == target_col == best_piece == captured == '2':
                        bad_checkmate = True
                        return -1000, scoring_time
                    if not checkmate and not bad_checkmate and not stalemate:
                        board[best_row][best_col] = '0'
                        board[target_row][target_col] = best_piece
                        if target_row == 7 and best_piece == 'P':
                            board[target_row][target_col] = 'Q'
                        best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time = best_move2(board)
                        scoring_time += score_time
                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                            checkmate2 = True
                        if not checkmate2:
                            board[best_row2][best_col2] = '0'
                            board[target_row2][target_col2] = best_piece2
                            if target_row2 == 0 and best_piece2 == 'p':
                                board[target_row2][target_col2] = 'q'
                            current_score = score(board, 'w')
                            scoring_time += 0
                            for move in good_moves:
                                if (from_row, from_col, from_row, from_col, piece, '0') == move:
                                    current_score += 0.5
                            board[best_row2][best_col2] = best_piece2
                            board[target_row2][target_col2] = captured2
                            board[best_row][best_col] = best_piece
                            board[target_row][target_col] = captured
                            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                    elif checkmate:
                        return 10000, scoring_time
                        # sys.exit() # Removed sys.exit()
                    elif bad_checkmate:
                        current_score = -1000
                        scores[(from_row, from_col, to_row, to_col, piece)] = current_score
            else:
                return None, None
        board[from_row][from_col] = piece
        board[to_row][to_col] = captured_piece
        position_history[pos_hash] -= 1
        if piece == 'k':
            black_king_row, black_king_col = find_king(board, 'b')
    return current_score, scoring_time

# Cache piece values globally to avoid recreating dict every function call
PIECE_VALUES = {
    'p': 4, 'P': -4, 'n': 12, 'N': -12,
    'b': 12, 'B': -12, 'r': 20, 'R': -20,
    'q': 36, 'Q': -36, 'k': 1000, 'K': -1000
}

# Scoring modifiers - adjust these to change engine personality
SCORING_MODIFIERS = {
    "material": 1.0,
    "king_safety_b": 1.0,
    "king_safety_w": 1.0,
    "centralization_b": 1.0,
    "centralization_w": 1.0,
    "attack_b": 1.0,
    "attack_w": 1.0,
    "piece_activity_b": 1.0,
    "piece_activity_w": 1.0,
    "defense_b": 1.0,
    "defense_w": 1.0,
    "pawn_structure_b": 1.0,
    "pawn_structure_w": 1.0
}

# Position cache for memoization - avoid re-evaluating same positions
from functools import lru_cache

def board_to_hash(board):
    """Convert board to hashable tuple for caching"""
    return tuple(tuple(row) for row in board)

# -----------------------------------------------------------------------------
# Engine caches
# -----------------------------------------------------------------------------
# `score()` is called extremely frequently (directly and via best-move helpers).
# Caching it gives a large speedup for repeated positions during search/analysis.
#
# We include `castled` flags and a scoring version so cache entries remain valid
# when game state or SCORING_MODIFIERS change.
SCORING_VERSION = 0

@lru_cache(maxsize=200_000)
def _score_cached(board_hash, turn, castled, castled_white, scoring_version):
    # IMPORTANT: many helper functions (eg `is_checkmate`) simulate moves by
    # mutating `board`. Our cache key uses an immutable tuple-of-tuples, but we
    # must evaluate on a mutable 8x8 list-of-lists.
    board = [list(r) for r in board_hash]
    return _score_uncached(board, turn, castled, castled_white)

def _clear_engine_caches():
    _score_cached.cache_clear()
    _is_king_in_check_cached.cache_clear()

# Cache for repeated "is king in check?" calls.
# This is safe because it depends only on board + king square + side.
@lru_cache(maxsize=300_000)
def _is_king_in_check_cached(board_hash, king_row, king_col, player):
    board = [list(r) for r in board_hash]
    return _is_king_in_check_uncached(board, king_row, king_col, player)

def evaluate_chunks_black(chunk):
    # Optimized: removed excessive printing for performance
    results = []
    for task in chunk:
        key, scoring, scoring_time = evaluate_black_task(task)
        if scoring:
            results.append((key, scoring))
    return results


def evaluate_black_task(args):
    board, row, col, new_row, new_col, good_moves, piece, white_king_row, white_king_col, captured_piece, position_history = args
    scoring, scoring_time = evaluate_black(board, row, col, new_row, new_col, good_moves, {}, piece, white_king_row, white_king_col, captured_piece, position_history)
    if piece == '0-0-0':
        key = '0-0-0'
    elif piece == '0-0':
        key = '0-0'
    else:
        key = (row, col, new_row, new_col, piece)
    # Removed excessive printing for performance
    if scoring:
        return key, scoring, scoring_time
    else:
        return None, None, None

def evaluate_black(board, from_row, from_col, to_row, to_col, good_moves, scores, piece, white_king_row, white_king_col, captured_piece, position_history):
    checkmate = False
    checkmate2 = False
    bad_checkmate = False
    stalemate = False
    scoring_time = 0
    if piece == '0-0':
        # Removed print for performance in parallel processing
        board[0][7] = '0'
        board[0][5] = 'R'
        board[0][6] = 'K'
        board[0][4] = '0'
        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
            checkmate = True
        if best_row == best_col == target_row == target_col == best_piece == captured == '2':
            bad_checkmate = True
            return 1000, scoring_time
        if not checkmate and not bad_checkmate:
            # Removed print statements for parallel performance
            board[best_row][best_col] = '0'
            board[target_row][target_col] = best_piece
            if target_row == 0 and best_piece == 'p':
                board[target_row][target_col] = 'q'
            best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
            if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                checkmate2 = True
            if not checkmate2:
                # Removed print statements for parallel performance
                board[best_row2][best_col2] = '0'
                board[target_row2][target_col2] = best_piece2
                if target_row2 == 7 and best_piece2 == 'P':
                    board[target_row2][target_col2] = 'Q'
                current_score = score(board, 'b')
                # Removed print for parallel performance
                board[best_row2][best_col2] = best_piece2
                board[target_row2][target_col2] = captured2
                board[best_row][best_col] = best_piece
                board[target_row][target_col] = captured
                scores['0-0'] = current_score
                board[0][6] = '0'
                board[0][4] = 'K'
                board[0][7] = 'R'
                board[0][5] = '0'
                checkmate = False
                checkmate2 = False
                white_king_row, white_king_col = find_king(board, 'w')
        elif checkmate:
            return -10000, scoring_time
            # sys.exit() # Removed sys.exit()
    elif piece == '0-0-0':
        # Removed print for performance in parallel processing
        board[0][0] = '0'
        board[0][3] = 'R'
        board[0][2] = 'K'
        board[0][4] = '0'
        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
            checkmate = True
        if best_row == best_col == target_row == target_col == best_piece == captured == '2':
            bad_checkmate = True
            return 1000, scoring_time
        if not checkmate and not bad_checkmate:
            # Removed print statements for parallel performance
            board[best_row][best_col] = '0'
            board[target_row][target_col] = best_piece
            if target_row == 0 and best_piece == 'p':
                board[target_row][target_col] = 'q'
            best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
            if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                checkmate2 = True
            if not checkmate2:
                # Removed print statements for parallel performance
                board[best_row2][best_col2] = '0'
                board[target_row2][target_col2] = best_piece2
                if target_row2 == 7 and best_piece2 == 'P':
                    board[target_row2][target_col2] = 'Q'
                current_score = score(board, 'b')
                # Removed print for parallel performance
                board[best_row2][best_col2] = best_piece2
                board[target_row2][target_col2] = captured2
                board[best_row][best_col] = best_piece
                board[target_row][target_col] = captured
                scores['0-0-0'] = current_score
                board[0][4] = 'K'
                board[0][2] = '0'
                board[0][0] = 'R'
                board[0][3] = '0'
                checkmate = False
                checkmate2 = False
                white_king_row, white_king_col = find_king(board, 'w')
        elif checkmate:
            return -10000, scoring_time
            # sys.exit() # Removed sys.exit()

    else:
        board[from_row][from_col] = '0'
        board[to_row][to_col] = piece
        # Removed print_piece_move for performance in parallel processing
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            current_score = 1.25
            # Removed print for performance
            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
        else:
            if piece == 'K':
                white_king_row, white_king_col = find_king(board, 'w')
            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):

                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                if draw:
                    current_score = 1.25
                    # Removed print for performance
                    scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                else:
                    if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                        black_king_row, black_king_col = find_king(board, 'b')
                        if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            checkmate = True
                        else:
                            stalemate = True
                            current_score = 1.25
                            # Removed print for performance
                            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                    elif best_row == best_col == target_row == target_col == best_piece == captured == '2':
                        bad_checkmate = True
                        return 1000, scoring_time
                    if not checkmate and not bad_checkmate and not stalemate:
                        board[best_row][best_col] = '0'
                        board[target_row][target_col] = best_piece
                        if target_row == 0 and best_piece == 'p':
                            board[target_row][target_col] = 'q'
                        # Removed print_piece_move for performance
                        best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                            checkmate2 = True
                        if not checkmate2:
                            board[best_row2][best_col2] = '0'
                            board[target_row2][target_col2] = best_piece2
                            if target_row2 == 7 and best_piece2 == 'P':
                                board[target_row2][target_col2] = 'Q'
                            # Removed print_piece_move for performance
                            current_score = score(board, 'b')
                            for move in good_moves:
                                if (from_row, from_col, from_row, from_col, piece, '0') == move:
                                    current_score -= 0.5
                            # Removed print for performance
                            board[best_row2][best_col2] = best_piece2
                            board[target_row2][target_col2] = captured2
                            board[best_row][best_col] = best_piece
                            board[target_row][target_col] = captured
                            scores[(from_row, from_col, to_row, to_col, piece)] = current_score
                    elif checkmate:
                        return -10000, scoring_time
                        # sys.exit() # Removed sys.exit()
                    elif bad_checkmate:
                        current_score = 1000
                        scores[(from_row, from_col, to_row, to_col, piece)] = current_score
            else:
                return None, None
        board[from_row][from_col] = piece
        board[to_row][to_col] = captured_piece
        position_history[pos_hash] -= 1
        if piece == 'K':
            white_king_row, white_king_col = find_king(board, 'w')
    return current_score, scoring_time

def evaluate_for_modifiers(board, SCORING_MODIFIERS):
    pass  # Empty function - removed print for performance

# NOTE: `_score_uncached` is the original (expensive) implementation. A cached
# wrapper `score()` is defined right after it.

def _score_uncached(board, turn, castled, castled_white):

    # Early checkmate return
    w_kr = w_kc = b_kr = b_kc = -1
    for _r in range(8):
        row_data = board[_r]
        for _c in range(8):
            p = row_data[_c]
            if p == 'K':
                w_kr, w_kc = _r, _c
            elif p == 'k':
                b_kr, b_kc = _r, _c
    if turn == 'b' and is_king_in_check(board, b_kr, b_kc, 'b') and is_checkmate(board, 'b'):
        return -1000
    if turn == 'w' and is_king_in_check(board, w_kr, w_kc, 'w') and is_checkmate(board, 'w'):
        return 1000

    # Local variables for stats (faster than dict lookups)
    score = material_score = non_pawn_pieces = pieces = 0
    white_pieces = black_pieces = white_pawns = black_pawns = 0
    white_bishops = black_bishops = white_knights = black_knights = 0
    white_rooks = black_rooks = white_queens = black_queens = 0
    white_light_squared_bishop = white_dark_squared_bishop = False
    black_light_squared_bishop = black_dark_squared_bishop = False
    fake_castled = fake_castled_white = False
    edge_up_white_king = edge_down_white_king = edge_left_white_king = edge_right_white_king = False
    edge_up_black_king = edge_down_black_king = edge_left_black_king = edge_right_black_king = False
    developement = opening = middlegame = endgame = False
    pawn_take_queen = rook_open_file = rook_open_file_black = False
    rook_7th_rank = rook_7th_rank_black = rook_placed_row = rook_placed_col = False
    rook_placed_row_white = rook_placed_col_white = False

    # Store piece positions for second pass
    piece_positions = []

    # Single pass: count pieces, calculate material, gather positions
    # Cache board[row] to avoid repeated indexing in inner loop
    for row in range(8):
        row_data = board[row]
        for col in range(8):
            piece = row_data[col]
            if piece == '0': continue
            pieces += 1
            material_score += PIECE_VALUES[piece] if piece in PIECE_VALUES else 0
            piece_positions.append((row, col, piece))

            # Count pieces based on type
            if piece == 'p':
                black_pawns += 1
                black_pieces += 1
            elif piece == 'P':
                white_pawns += 1
                white_pieces += 1
            elif piece == 'b':
                black_bishops += 1
                non_pawn_pieces += 1
                black_pieces += 1
                if (row + col) & 1 == 0:
                    black_light_squared_bishop = True
                else:
                    black_dark_squared_bishop = True
            elif piece == 'B':
                white_bishops += 1
                non_pawn_pieces += 1
                white_pieces += 1
                if (row + col) & 1 == 0:
                    white_light_squared_bishop = True
                else:
                    white_dark_squared_bishop = True
            elif piece == 'n':
                black_knights += 1
                non_pawn_pieces += 1
                black_pieces += 1
            elif piece == 'N':
                white_knights += 1
                non_pawn_pieces += 1
                white_pieces += 1
            elif piece == 'r':
                black_rooks += 1
                non_pawn_pieces += 1
                black_pieces += 1
            elif piece == 'R':
                white_rooks += 1
                non_pawn_pieces += 1
                white_pieces += 1
            elif piece == 'q':
                black_queens += 1
                non_pawn_pieces += 1
                black_pieces += 1
            elif piece == 'Q':
                white_queens += 1
                non_pawn_pieces += 1
                white_pieces += 1
            elif piece == 'k':
                black_pieces += 1
                edge_up_black_king = row == 0
                edge_down_black_king = row == 7
                edge_left_black_king = col == 0
                edge_right_black_king = col == 7
                if row == 7:
                    if col == 6 and board[7][5] == 'r': fake_castled = True
                    elif col == 2 and board[7][3] == 'r': fake_castled = True
                if castled or fake_castled: score += 1
            elif piece == 'K':
                white_pieces += 1
                edge_up_white_king = row == 0
                edge_down_white_king = row == 7
                edge_left_white_king = col == 0
                edge_right_white_king = col == 7
                if row == 0:
                    if col == 6 and board[0][5] == 'r': fake_castled_white = True
                    elif col == 2 and board[0][3] == 'r': fake_castled_white = True
                if castled_white or fake_castled_white: score -= 1

    # Game phase detection (only check once at end)
    # Count developed pieces (knights and bishops moved from starting squares)
    developed_count = 0
    development_squares = [(0, 1), (0, 2), (0, 5), (0, 6), (7, 1), (7, 2), (7, 5), (7, 6)]
    for row, col in development_squares:
        if board[row][col] == '0':
            developed_count += 1

    # Consider development complete if 6+ out of 8 pieces are developed (less strict)
    if developed_count >= 6:
        developement = True

    # Check if queens are still on board
    queens_on_board = (white_queens > 0) and (black_queens > 0)
    any_queen_on_board = (white_queens > 0) or (black_queens > 0)

    # Check castling status
    has_castled = castled or fake_castled or castled_white or fake_castled_white

    # More accurate game phase detection using multiple factors
    # Endgame conditions (highest priority):
    # 1. Very low material (< 12 pieces) - clear endgame
    # 2. Queens traded AND low material (< 18 pieces) - likely endgame
    # 3. Very few non-pawn pieces (< 5) - endgame structure
    if pieces < 12:
        endgame = True
        opening_weight = 0.0
        middlegame_weight = 0.0
        endgame_weight = 1.0
    elif not queens_on_board and pieces < 18:
        # Queens traded and material reduced - likely endgame
        endgame = True
        opening_weight = 0.0
        middlegame_weight = 0.0
        endgame_weight = 1.0
    elif non_pawn_pieces < 5:
        # Very few pieces left - endgame structure
        endgame = True
        opening_weight = 0.0
        middlegame_weight = 0.0
        endgame_weight = 1.0
    # Middlegame conditions:
    # 1. Pieces developed AND (castling occurred OR queens still on board)
    # 2. Castling occurred AND reasonable material (> 20 pieces)
    # 3. Most pieces developed (> 5) AND queens on board AND good material
    elif (developement and (has_castled or queens_on_board)) or \
         (has_castled and pieces > 20) or \
         (developed_count >= 5 and queens_on_board and pieces > 22):
        middlegame = True
        opening_weight = 0.3  # Keep some opening principles
        middlegame_weight = 1.0
        endgame_weight = 0.0
    # Opening: everything else (early game, pieces not developed, etc.)
    else:
        opening = True
        opening_weight = 1.0
        middlegame_weight = 0.0
        endgame_weight = 0.0

    # Rebuild stats dict for piece scoring functions
    stats = {
        "non_pawn_pieces": non_pawn_pieces, "white_pieces": white_pieces, "black_pieces": black_pieces,
        "white_pawns": white_pawns, "black_pawns": black_pawns, "white_bishops": white_bishops,
        "black_bishops": black_bishops, "white_knights": white_knights, "black_knights": black_knights,
        "white_rooks": white_rooks, "black_rooks": black_rooks, "white_queens": white_queens,
        "black_queens": black_queens, "white_light_squared_bishop": white_light_squared_bishop,
        "white_dark_squared_bishop": white_dark_squared_bishop, "black_light_squared_bishop": black_light_squared_bishop,
        "black_dark_squared_bishop": black_dark_squared_bishop, "fake_castled": fake_castled,
        "fake_castled_white": fake_castled_white, "edge_up_white_king": edge_up_white_king,
        "edge_down_white_king": edge_down_white_king, "edge_left_white_king": edge_left_white_king,
        "edge_right_white_king": edge_right_white_king, "edge_up_black_king": edge_up_black_king,
        "edge_down_black_king": edge_down_black_king, "edge_left_black_king": edge_left_black_king,
        "edge_right_black_king": edge_right_black_king, "white_king_row": w_kr, "white_king_col": w_kc,
        "black_king_row": b_kr, "black_king_col": b_kc, "developement": developement,
        "opening": opening, "middlegame": middlegame, "endgame": endgame,
        "opening_weight": opening_weight, "middlegame_weight": middlegame_weight, "endgame_weight": endgame_weight,
        "pawn_take_queen": pawn_take_queen, "rook_open_file": rook_open_file,
        "rook_open_file_black": rook_open_file_black, "rook_7th_rank": rook_7th_rank,
        "rook_7th_rank_black": rook_7th_rank_black, "rook_placed_row": rook_placed_row,
        "rook_placed_col": rook_placed_col, "rook_placed_row_white": rook_placed_row_white,
        "rook_placed_col_white": rook_placed_col_white
    }

    score += material_score * SCORING_MODIFIERS["material"]
    if not endgame:
        score += score_holes(board, stats, w_kr, w_kc, b_kr, b_kc)
    if material_score >= 8:
        score -= (non_pawn_pieces / 4)
    elif material_score <= -8:
        score += (non_pawn_pieces / 4)

    # Second pass: detailed piece evaluation using stored positions
    for row, col, piece in piece_positions:
        add_score = 0

        if piece == 'p':
            add_score = score_pawn(board, row, col, 'b', stats)
        elif piece == 'P':
            add_score = score_pawn(board, row, col, 'w', stats)
        elif piece == 'n':
            add_score = score_knight(board, row, col, 'b', stats)
        elif piece == 'N':
            add_score = score_knight(board, row, col, 'w', stats)
        elif piece == 'b':
            add_score = score_bishop(board, row, col, 'b', stats)
        elif piece == 'B':
            add_score = score_bishop(board, row, col, 'w', stats)
        elif piece == 'r':
            add_score, stats = score_rook(board, row, col, 'b', stats)
        elif piece == 'R':
            add_score, stats = score_rook(board, row, col, 'w', stats)
        elif piece == 'q':
            add_score = score_queen(board, row, col, 'b', stats)
        elif piece == 'Q':
            add_score = score_queen(board, row, col, 'w', stats)
        elif piece == 'k':
            add_score = score_king(board, row, col, 'b', stats)
        elif piece == 'K':
            add_score = score_king(board, row, col, 'w', stats)

        score += add_score

        VALUES_white = {
            'n': -12, 'b': -12, 'r': -20, 'q': -36, 'p': -4,
        }

        VALUES_black = {
            'N': 12, 'B': 12, 'R': 20, 'Q': 36, 'P': 4
        }

        if (piece in VALUES_white and turn == 'w') or (piece in VALUES_black and turn == 'b'):
              protected_color = 'w' if piece.isupper() else 'b'
              threatened_color = 'b' if piece.isupper() else 'w'
              threatened_by_enemy = is_protected(board, row, col, threatened_color)
              if threatened_by_enemy:
                  not_protected_by_ally = is_protected(board, row, col, protected_color)
                  if not not_protected_by_ally:
                      if piece.isupper():
                          score += VALUES_black[piece] * SCORING_MODIFIERS["material"]
                      else:
                          score += VALUES_white[piece] * SCORING_MODIFIERS["material"]

        if turn == 'b':
            if piece in {'N', 'B', 'R', 'Q'}:
                directions = [(1, 1), (1, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if piece == 'Q' and board[new_row][new_col] == 'p':
                            if is_protected(board, row, col, 'w'):
                                score += 34 * SCORING_MODIFIERS["material"]
                        elif piece == 'R' and board[new_row][new_col] == 'p':
                            if is_protected(board, row, col, 'w'):
                                score += 18 * SCORING_MODIFIERS["material"]
                        elif piece in {'N', 'B'} and board[new_row][new_col] == 'p':
                            if is_protected(board, row, col, 'w'):
                                score += 10 * SCORING_MODIFIERS["material"]
            if piece in {'R', 'Q'}:
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if piece == 'Q' and board[new_row][new_col] == 'n':
                            if is_protected(board, row, col, 'w'):
                                score += 30 * SCORING_MODIFIERS["material"]
                        elif piece == 'R' and board[new_row][new_col] == 'n':
                            if is_protected(board, row, col, 'w'):
                                score += 13 * SCORING_MODIFIERS["material"]
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if piece == 'Q' and board[new_row][new_col] == 'b':
                                if is_protected(board, row, col, 'w'):
                                    score += 30 * SCORING_MODIFIERS["material"]
                            elif piece == 'R' and board[new_row][new_col] == 'b':
                                if is_protected(board, row, col, 'w'):
                                    score += 13 * SCORING_MODIFIERS["material"]
                            if board[new_row][new_col] != '0':
                                break
                        else:
                            break
            if piece == 'Q':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] == 'r':
                                if is_protected(board, row, col, 'w'):
                                    score += 18 * SCORING_MODIFIERS["material"]
                            if board[new_row][new_col] != '0':
                                break
                        else:
                            break

        elif turn == 'w':
            if piece in {'n', 'b', 'r', 'q'}:
                directions = [(-1, 1), (-1, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if piece == 'q' and board[new_row][new_col] == 'P' and stats["pawn_take_queen"] == False and is_protected(board, row, col, 'b'):
                            score -= 34 * SCORING_MODIFIERS["material"]
                            stats["pawn_take_queen"] = True
                        elif piece == 'r' and board[new_row][new_col] == 'P':
                            if is_protected(board, row, col, 'b'):
                                score -= 18 * SCORING_MODIFIERS["material"]
                        elif piece in {'n', 'b'} and board[new_row][new_col] == 'P':
                            if is_protected(board, row, col, 'b'):
                                score -= 10 * SCORING_MODIFIERS["material"]
            if piece in {'r', 'q'}:
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if piece == 'q' and board[new_row][new_col] == 'N':
                            if is_protected(board, row, col, 'b'):
                                score -= 30 * SCORING_MODIFIERS["material"]
                        elif piece == 'r' and board[new_row][new_col] == 'N':
                            if is_protected(board, row, col, 'b'):
                                score -= 13 * SCORING_MODIFIERS["material"]
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                for direction in directions:
                  for i in range(1, 8):
                      new_row = row + i * direction[0]
                      new_col = col + i * direction[1]
                      if 0 <= new_row < 8 and 0 <= new_col < 8:
                          if piece == 'q' and board[new_row][new_col] == 'B':
                              if is_protected(board, row, col, 'b'):
                                  score -= 30 * SCORING_MODIFIERS["material"]
                          elif piece == 'r' and board[new_row][new_col] == 'B':
                              if is_protected(board, row, col, 'b'):
                                  score -= 13 * SCORING_MODIFIERS["material"]
                          if board[new_row][new_col] != '0':
                              break
                      else:
                          break
            if piece == 'q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] == 'R':
                                    if is_protected(board, row, col, 'b'):
                                        score -= 18 * SCORING_MODIFIERS["material"]
                                if board[new_row][new_col] != '0':
                                    break
                            else:
                                break
    return round(score/4, 2)

def score(board, turn):
    """Cached score wrapper.

    This keeps the public `score(board, turn)` API unchanged while avoiding
    repeated evaluation of identical positions.
    """
    # These globals are part of the evaluation (castling heuristics).
    global castled, castled_white, SCORING_VERSION
    return _score_cached(board_to_hash(board), turn, castled, castled_white, SCORING_VERSION)

def is_light_square(row, col):
    return (row + col) % 2 == 0

def pos_to_indices(pos):
    col = ord(pos[0]) - ord('a')
    row = 8 - int(pos[1])
    return row, col

def pos_to_indices_col(pos):
    col = ord(pos[0]) - ord('a')
    return col

def indices_to_pos(row, col):
    col_pos = chr(col + ord('a'))
    row_pos = str(8 - row)
    return col_pos + row_pos

def indices_to_pos_col(col):
    col_pos = chr(col + ord('a'))
    return col_pos

def indices_to_pos_row(row):
    row_pos = str(8 - row)
    return row_pos

def find_king(board, king_color):
    king_symbol = 'K' if king_color == 'w' else 'k'
    for row in range(8):
        row_data = board[row]
        for col in range(8):
            if row_data[col] == king_symbol:
                return row, col
    print_board(board)
    return None

def check_defenders_lower(board, row, col):
    defenders = 0
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    for direction in directions:
        for i in range(1, 8):
            new_row = row + i * direction[0]
            new_col = col + i * direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] in ROOK_QUEEN_B:
                    if not is_pinned_to_king(board, new_row, new_col, 'b'):
                      defenders += 1
                if board[new_row][new_col] not in RQ_OR_EMPTY:
                    break
            else:
                break

    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    for direction in directions:
        for i in range(1, 8):
            new_row = row + i * direction[0]
            new_col = col + i * direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] in BISHOP_QUEEN_B:
                    if not is_pinned_to_king(board, new_row, new_col, 'b'):
                      defenders += 1
                if board[new_row][new_col] not in BQ_OR_EMPTY:
                    break
            else:
                break

    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
    for direction in directions:
        new_row = row + direction[0]
        new_col = col + direction[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'n':
                if not is_pinned_to_king(board, new_row, new_col, 'b'):
                  defenders += 1

    pawn_attacks = [(1, 1), (1, -1)]
    for attack in pawn_attacks:
        new_row = row + attack[0]
        new_col = col + attack[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'p':
                defenders += 1
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
    for direction in directions:
        new_row = row + direction[0]
        new_col = col + direction[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'k':
                defenders += 1

    return defenders

def check_defenders_upper(board, row, col):
    defenders = 0
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    for direction in directions:
        for i in range(1, 8):
            new_row = row + i * direction[0]
            new_col = col + i * direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] in ROOK_QUEEN_W:
                    if not is_pinned_to_king(board, new_row, new_col, 'w'):
                      defenders += 1
                if board[new_row][new_col] not in RQ_OR_EMPTY:
                    break
            else:
                break

    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    for direction in directions:
        for i in range(1, 8):
            new_row = row + i * direction[0]
            new_col = col + i * direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] in BISHOP_QUEEN_W:
                    if not is_pinned_to_king(board, new_row, new_col, 'w'):
                      defenders += 1
                if board[new_row][new_col] not in BQ_OR_EMPTY:
                    break
            else:
                break

    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
    for direction in directions:
        new_row = row + direction[0]
        new_col = col + direction[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'N':
                if not is_pinned_to_king(board, new_row, new_col, 'w'):
                    defenders += 1

    pawn_attacks = [(-1, 1), (-1, -1)]
    for attack in pawn_attacks:
        new_row = row + attack[0]
        new_col = col + attack[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'P':
                defenders += 1
    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
    for direction in directions:
        new_row = row + direction[0]
        new_col = col + direction[1]
        if 0 <= new_row < 8 and 0 <= new_col < 8:
            if board[new_row][new_col] == 'K':
                defenders += 1
    return defenders

def open_file(board, col, turn):
    if turn == 'w':
        for row in range(8):
            if board[row][col] == 'P':
                return False
    elif turn == 'b':
        for row in range(8):
            if board[row][col] == 'p':
                return False
    return True

def convert_long_move(move):
    if move[2] == move[4]:
        return (move[:2] + move[3:])
    elif move[1] == move[3]:
        return (move[:1] + move[2:])
    else:
        return (move[:2] + move[3:])

def score_holes(board, stats, white_king_row=None, white_king_col=None, black_king_row=None, black_king_col=None):
    score = 0
    # Use provided king positions if available, otherwise find them
    if white_king_row is None or white_king_col is None:
        white_king_row, white_king_col = find_king(board, 'w')
    if black_king_row is None or black_king_col is None:
        black_king_row, black_king_col = find_king(board, 'b')

    # Pre-compute modifier products to avoid repeated multiplications
    psb_db = SCORING_MODIFIERS["pawn_structure_b"] * SCORING_MODIFIERS["defense_b"]
    psw_dw = SCORING_MODIFIERS["pawn_structure_w"] * SCORING_MODIFIERS["defense_w"]

    for col in range(8):
        if not is_protected_pawn(board, 5, col, 'p') and board[5][col] in {'0', 'P', 'N', 'B'}:
            if black_king_col not in {3, 4} and col in {black_king_col, black_king_col+1, black_king_col-1}:
                score -= 0.75 * psb_db
            else:
                score -= 0.3 * psb_db
            if is_protected_pawn(board, 5, col, 'P'):
                score -= 0.5 * psb_db
                if board[5][col] == 'P':
                    score -= 0.6 * psb_db
                if board[5][col] == 'N':
                    if col in {2, 3, 4, 5}:
                        score -= 0.8 * psb_db
                    elif col in {1, 6}:
                        score -= 0.4 * psb_db
                if board[5][col] == 'B':
                    if col in {2, 3, 4, 5}:
                        score -= 0.4 * psb_db
                    else:
                        score -= 0.2 * psb_db
            else:
                if board[5][col] == 'N':
                    if col in {2, 3, 4, 5}:
                        score -= 0.5 * psb_db
                    elif col in {1, 6}:
                        score -= 0.25 * psb_db
                if board[5][col] == 'B':
                    if col in {2, 3, 4, 5}:
                        score -= 0.25 * psb_db
                    else:
                        score -= 0.13
        if not is_protected_pawn(board, 4, col, 'p') and board[4][col] == '0':
            if col != 7 and board[6][col+1] != 'p':
                if col != 0  and board[6][col-1] != 'p':
                    if black_king_col not in {3, 4} and col in {black_king_col, black_king_col+1, black_king_col-1}:
                        score -= 0.75 * psb_db
                    else:
                        score -= 0.3 * psb_db
                    if is_protected_pawn(board, 4, col, 'P'):
                        score -= 0.5 * psb_db
                        if board[4][col] == 'P':
                            score -= 0.6 * psb_db
                        if board[4][col] == 'N':
                            if col in {2, 3, 4, 5}:
                                score -= 0.8 * psb_db
                            elif col in {1, 6}:
                                score -= 0.4 * psb_db
                        elif board[4][col] == 'B':
                            if col in {2, 3, 4, 5}:
                                score -= 0.4 * psb_db
                            else:
                                score -= 0.2 * psb_db
                    else:
                        if board[4][col] == 'N':
                            if col in {2, 3, 4, 5}:
                                score -= 0.5 * psb_db
                            elif col in {1, 6}:
                                score -= 0.25 * psb_db
                        elif board[4][col] == 'B':
                            if col in {2, 3, 4, 5}:
                                score -= 0.25 * psb_db
                            else:
                                score -= 0.13 * psb_db
        if not is_protected_pawn(board, 2, col, 'P') and board[2][col] == '0':
            if white_king_col not in {3, 4} and col in {white_king_col, white_king_col+1, white_king_col-1}:
                score += 0.75 * psw_dw
            else:
                score += 0.3 * psw_dw
            if is_protected_pawn(board, 2, col, 'p'):
                if board[2][col] == 'p':
                    score += 0.6 * psw_dw
                score += 0.5
                if board[2][col] == 'n':
                    if col in {2, 3, 4, 5}:
                        score += 0.8 * psw_dw
                    elif col in {1, 6}:
                        score += 0.4 * psw_dw
                elif board[2][col] == 'b':
                    if col in {2, 3, 4, 5}:
                        score += 0.4 * psw_dw
                    else:
                        score += 0.2 * psw_dw
            else:
                if board[2][col] == 'n':
                    if col in {2, 3, 4, 5}:
                        score += 0.5 * psw_dw
                    elif col in {1, 6}:
                        score += 0.25 * psw_dw
                elif board[2][col] == 'b':
                    if col in {2, 3, 4, 5}:
                        score += 0.25 * psw_dw
                    else:
                        score += 0.13 * psw_dw
        if not is_protected_pawn(board, 3, col, 'P') and board[3][col] == '0':
            if col != 7 and board[1][col+1] != 'P':
                if col != 0 and board[1][col-1] != 'P':
                    if white_king_col not in {3, 4} and col in {white_king_col, white_king_col+1, white_king_col-1}:
                        score += 0.75 * psw_dw
                    else:
                        score += 0.3 * psw_dw
                    if is_protected_pawn(board, 3, col, 'p'):
                        score += 0.5 * psw_dw
                        if board[3][col] == 'p':
                            score += 0.6 * psw_dw
                        if board[3][col] == 'n':
                            if col in {2, 3, 4, 5}:
                                score += 0.8 * psw_dw
                            elif col in {1, 6}:
                                score += 0.4 * psw_dw
                        elif board[3][col] == 'b':
                            if col in {2, 3, 4, 5}:
                                score += 0.4 * psw_dw
                            else:
                                score += 0.2 * psw_dw
                    else:
                        if board[3][col] == 'n':
                            if col in {2, 3, 4, 5}:
                                score += 0.5 * psw_dw
                            elif col in {1, 6}:
                                score += 0.25 * psw_dw
                        elif board[3][col] == 'b':
                            if col in {2, 3, 4, 5}:
                                score += 0.25 * psw_dw
                            else:
                                score += 0.13 * psw_dw

    return score

def score_pawn_structure(board, stats):
    black_space = 0
    white_space = 0
    pawn_board = board
    for row in range(8):
        for col in range(8):
            if col in {0, 1, 6, 7} or pawn_board[row][col] not in {'p', 'P', '0'}:
                pawn_board[row][col] = '0'
    if stats["white_pawns"] == stats["black_pawns"]:
        for row in range(8):
            for col in range(8):
                if board[row][col] == 'p':
                    black_space += 7 - row
                if board[row][col] == 'P':
                    white_space += row
    pawn_structure_score += black_space/5
    pawnstructure_score -= white_space/5
    pawn_structure_1 = [
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['0', '0', 'p', '0', '0', 'p', '0', '0'],
        ['0', '0', '0', '0', 'p', '0', '0', '0'],
        ['0', '0', '0', 'p', 'P', '0', '0', '0'],
        ['0', '0', '0', 'P', '0', 'P', '0', '0'],
        ['0', '0', '0', '0', '0', '0', '0', '0'],
        ['0', '0', 'P', '0', '0', '0', '0', '0'],
        ['0', '0', '0', '0', '0', '0', '0', '0']
    ]
    if pawn_board == pawn_structure_1:
        pawn_structure_score -= 0.5
    return pawn_structure_score

def convert_to_long_algebraic(move, board, color):
    print('converting')
    piece_letter = move[0]
    disambig_file = move[1]
    target_square = move[2:]

    target_row, target_col = pos_to_indices(target_square)

    direction = -1 if color == 'w' else 1
    candidate_piece = piece_letter.lower() if color == 'w' else piece_letter.upper()
    print('CP:', candidate_piece, 'C:', color)
    if disambig_file in {'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'}:
        for row in range(8):
            col = ord(disambig_file) - ord('a')
            if board[row][col] == candidate_piece:
                from_square = indices_to_pos(row, col)
                return piece_letter + from_square + target_square
    else:
        for col in range(8):
            print('number')
            row = 7 - (int(disambig_file) - 1)
            if board[row][col] == candidate_piece:
                from_square = indices_to_pos(row, col)
                return piece_letter + from_square + target_square

    return None

def print_piece_move(board, best_piece, best_row, best_col, target_row, target_col, piece, color):
    disambiguation = get_move_disambiguation(board, best_piece, best_row, best_col, target_row, target_col)

    if color == 'b':
        if best_piece == 'p' and target_row == 0:
            if piece in WHITE_PIECES:
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
            else:
                move_played = indices_to_pos(target_row, target_col) + '=Q'
        else:
            if disambiguation:
                if piece in WHITE_PIECES:
                    move_played = best_piece.upper() + disambiguation + 'x' + indices_to_pos(target_row, target_col)
                else:
                    move_played = best_piece.upper() + disambiguation + indices_to_pos(target_row, target_col)
            else:
                if best_piece != 'p':
                    if piece in WHITE_PIECES:
                        move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                else:
                    if piece in WHITE_PIECES:
                        move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = indices_to_pos(target_row, target_col)
    elif color == 'w':
        if best_piece == 'P' and target_row == 7:
            if piece in BLACK_PIECES:
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
            else:
                move_played = indices_to_pos(target_row, target_col) + '=Q'
        else:
            if disambiguation:
                if piece in BLACK_PIECES:
                    move_played = best_piece.upper() + disambiguation + 'x' + indices_to_pos(target_row, target_col)
                else:
                    move_played = best_piece.upper() + disambiguation + indices_to_pos(target_row, target_col)
            else:
                if best_piece != 'P':
                    if piece in BLACK_PIECES:
                        move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                else:
                    if piece in BLACK_PIECES:
                        move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                    else:
                        move_played = indices_to_pos(target_row, target_col)

    # Check if this move puts opponent in check
    opponent_color = 'w' if color == 'b' else 'b'
    opp_king_row, opp_king_col = find_king(board, opponent_color)
    if opp_king_row != -1 and is_king_in_check(board, opp_king_row, opp_king_col, opponent_color):
        move_played += '+'

    return move_played

def score_king(board, row, col, color, stats):
    score = 0
    if color == 'b':
        if stats["endgame"]:
            if stats["black_pieces"] == 1:
                distance = abs(row - 3.5) + abs(col - 3.5)
                score += 7-distance
            if row in {7, 0} or col in {7, 0}:
                score -= 0.5 * SCORING_MODIFIERS["piece_activity_b"]
            if stats["black_bishops"] + stats["black_knights"] + stats["black_rooks"] + stats["black_queens"] == 0:
                distance = abs(row - 3.5) + abs(col - 3.5)
                score += (7-distance)/2 * SCORING_MODIFIERS["piece_activity_b"]
                score += row/10 * SCORING_MODIFIERS["piece_activity_b"]
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                new_row = row + direction[0]
                new_col = col + direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == 'P':
                        if not is_protected(board, new_row, new_col, 'b'):
                            score += 1 * SCORING_MODIFIERS["attack_b"]
#            if stats["edge_up_white_king"]:
#                if board[row+2][col] == 'K':
#                    score -= 1.5
#                score -= (7-row)/15
#            if stats["edge_down_white_king"]:
#                if board[row-2][col] == 'K':
#                    score -= 1.5
#                score -= row/15
#            if stats["edge_right_white_king"]:
#                if board[row][col-2] == 'K':
#                    score -= 1.5
#                score -= col/15
#            if stats["edge_left_white_king"]:
#                if board[row][col+2] == 'K':
#                    score -= 1.5
#                score -= (7-col)/15
        if board[7][4] != 'k' and not stats["fake_castled"] and not castled:
            score -= 1 * SCORING_MODIFIERS["king_safety_b"]
    else:
        if stats["endgame"]:
            if stats["white_pieces"] == 1:
                distance = abs(row - 3.5) + abs(col - 3.5)
                score -= 7-distance
            if row in {7, 0} or col in {7, 0}:
                score += 0.5 * SCORING_MODIFIERS["piece_activity_w"]
            if stats["white_bishops"] + stats["white_knights"] + stats["white_rooks"] + stats["white_queens"] == 0:
                distance = abs(row - 3.5) + abs(col - 3.5)
                score -= (7-distance)/2 * SCORING_MODIFIERS["piece_activity_w"]
                score -= row/10 * SCORING_MODIFIERS["piece_activity_w"]
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                new_row = row + direction[0]
                new_col = col + direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == 'p':
                        if not is_protected(board, new_row, new_col, 'w'):
                            score -= 1 * SCORING_MODIFIERS["attack_w"]
#            if stats["edge_up_black_king"]:
#                if board[row+2][col] == 'k':
#                    score -= 1.5
#                score -= (7-row)/15
#            if stats["edge_down_black_king"]:
#                if board[row-2][col] == 'k':
#                    score -= 1.5
#                score -= row/15
#            if stats["edge_right_black_king"]:
#                if board[row][col-2] == 'k':
#                    score -= 1.5
#                score -= col/15
#            if stats["edge_left_black_king"]:
#                if board[row][col+2] == 'k':
#                    score -= 1.5
#                score -= (7-col)/15
        if board[0][4] != 'K' and not stats["fake_castled_white"] and not castled_white:
            score += 1 * SCORING_MODIFIERS["king_safety_b"]
    return score

def score_queen(board, row, col, color, stats):
    score = 0
    if color == 'b':
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score += 0.4 * SCORING_MODIFIERS["centralization_b"]
        if board[0][6] == 'K':
            if col in [5, 6, 7]:
                score += 0.7 * SCORING_MODIFIERS["attack_b"]
        if not stats["endgame"]:
            if open_file(board, col, 'b'):
              score += 0.3 * SCORING_MODIFIERS["piece_activity_b"]
            if open_file(board, col, 'w'):
              score += 0.3 * SCORING_MODIFIERS["piece_activity_b"]
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            queen_squares = 0
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                        queen_squares += 1
                        if board[new_row][new_col] in WHITE_PIECES:
                            break
                    else:
                        break
            score += queen_squares/27 * SCORING_MODIFIERS["piece_activity_b"]
        else:
            if stats["black_pieces"] == 2 and stats["white_pieces"] == 1:
                if is_king_in_check(board, stats["white_king_row"], stats["white_king_col"], 'w'):
                    score -= 10
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'K':
                            score += 1.3
        # Opening bonuses with smooth transition to middlegame
        if (row, col) in [(6, 4), (6, 2), (6, 3), (7, 3)]:
            score += 0.6 * stats["opening_weight"] * SCORING_MODIFIERS["defense_b"]
        if (row, col) == (7, 3):
            score += 1.0 * stats["opening_weight"] * SCORING_MODIFIERS["defense_b"]
    else:
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score -= 0.4 * SCORING_MODIFIERS["centralization_w"]
        if board[7][6] == 'k':
            if col in [5, 6, 7]:
                score += 0.7 * SCORING_MODIFIERS["attack_w"]
        if not stats["endgame"]:
            if open_file(board, col, 'w'):
              score -= 0.3 * SCORING_MODIFIERS["piece_activity_w"]
            if open_file(board, col, 'b'):
              score -= 0.3 * SCORING_MODIFIERS["piece_activity_w"]
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            bad_queen_squares = 0
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                        bad_queen_squares += 1
                        if board[new_row][new_col] in BLACK_PIECES:
                            break
                    else:
                        break
            score -= bad_queen_squares/27 * SCORING_MODIFIERS["piece_activity_w"]
        else:
            if stats["white_pieces"] == 2 and stats["black_pieces"] == 1:
                if is_king_in_check(board, stats["black_king_row"], stats["black_king_col"], 'b'):
                    score += 10
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'k':
                            score -= 1.3
                directions = [(1, 3), (1, -3), (-1, 3), (-1, -3), (3, 1), (3, -1), (-3, 1), (-3, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if (new_row, new_col) in {(7, 7), (7, 0), (0, 0), (0, 7)}:
                            if board[new_row][new_col] == 'k':
                                score -= 1
                                corner_queen_score = corner_queen_mate(board, new_row, new_col, 'w')
                                score += corner_queen_score
                            elif (row, col) == (7, 0):
                                if board[6][0] == 'k' or board[7][1] == 'k':
                                    score -= 1
                                    corner_queen_score = corner_queen_mate(board, new_row, new_col, 'w')
                                    score += corner_queen_score
                            elif (row, col) == (7, 7):
                                if board[6][7] == 'k' or board[7][6] == 'k':
                                    score -= 1
                                    corner_queen_score = corner_queen_mate(board, new_row, new_col, 'w')
                                    score += corner_queen_score
                            elif (row, col) == (0, 0):
                                if board[0][1] == 'k' or board[1][0] == 'k':
                                    score -= 1
                                    corner_queen_score = corner_queen_mate(board, new_row, new_col, 'w')
                                    score += corner_queen_score
                            elif (row, col) == (0, 7):
                                if board[0][6] == 'k' or board[1][7] == 'k':
                                    score -= 1
                                    corner_queen_score = corner_queen_mate(board, new_row, new_col, 'w')
                                    score += corner_queen_score


        # Opening penalties with smooth transition
        if (row, col) in [(1, 4), (1, 2), (1, 3), (0, 3)]:
            score -= 0.6 * stats["opening_weight"] * SCORING_MODIFIERS["defense_w"]
        if (row, col) == [(0, 3)]:
            score -= 1.0 * stats["opening_weight"] * SCORING_MODIFIERS["defense_w"]
    return score

def score_rook(board, row, col, color, stats):
    score = 0
    if color == 'b':
        # Penalty for moving rooks early in the game (not on starting square unless castled)
        if ((row, col) != (7, 7) and board[7][6] != 'k') or ((row, col) != (7, 0) and board[7][2] != 'k'):
            score -= 0.7 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_b"]

        if board[0][6] == 'K':
            if col in [5, 6, 7] and row == 5:
                score += 0.6 * SCORING_MODIFIERS["attack_b"]
        if open_file(board, col, 'b'):
            score += 0.5 * SCORING_MODIFIERS["piece_activity_b"]
            if open_file(board, col, 'w'):
              score += 0.5 * SCORING_MODIFIERS["piece_activity_b"]
              if stats["rook_open_file"]:
                  score += 0.6 * SCORING_MODIFIERS["piece_activity_b"]
              stats["rook_open_file"] = True
        if not stats["endgame"]:
            if row == 1:
                score += 0.5 * SCORING_MODIFIERS["attack_b"]
                if stats["rook_7th_rank"]:
                    score += 0.8 * SCORING_MODIFIERS["attack_b"]
                stats["rook_7th_rank"] = True
            if not is_pinned_to_king(board, row, col, 'b'):
                rook_squares = 0
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            rook_squares += 1
                            if board[new_row][new_col] in WHITE_PIECES:
                                break
                        else:
                            break
                score += rook_squares/14 * SCORING_MODIFIERS["piece_activity_b"]
        if stats["endgame"]:
            if stats["white_pieces"] == 1:
                if stats["black_rooks"] == 2:
                    if (row + 1 == stats["white_king_row"] or row -1 == stats["white_king_row"]) and not stats["rook_placed_row"] and not stats["rook_placed_col"]:
                      score += 3
                      stats["rook_placed_row"] = True
                    if (col + 1 == stats["white_king_col"] or col - 1 == stats["white_king_col"]) and not stats["rook_placed_row"] and not stats["rook_placed_col"]:
                        score += 3
                        stats["rook_placed_col"] = True
                    elif stats["rook_placed_row"]:
                        if row == stats["white_king_row"]:
                            score += 3
                    elif stats["rook_placed_col"]:
                        if col == stats["white_king_col"]:
                            score += 3
    else:
        # Penalty for moving rooks early in the game (not on starting rank)
        if ((row, col) != (0, 7) and board[0][6] != 'K') or ((row, col) != (0, 0) and board[0][2] != 'K'):
            score += 0.7 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_w"]

        if board[7][6] == 'k':
            if col in [5, 6, 7] and row == 2:
                score -= 0.6 * SCORING_MODIFIERS["attack_w"]
        if open_file(board, col, 'w'):
            score -= 0.5 * SCORING_MODIFIERS["piece_activity_w"]
            if open_file(board, col, 'b'):
              score -= 0.5 * SCORING_MODIFIERS["piece_activity_w"]
              if stats["rook_open_file_black"]:
                  score -= 0.6 * SCORING_MODIFIERS["piece_activity_w"]
              stats["rook_open_file_black"] = True
        if not stats["endgame"]:
            if row == 6:
                score -= 0.5 * SCORING_MODIFIERS["attack_w"]
                if stats["rook_7th_rank_black"]:
                    score -= 0.8 * SCORING_MODIFIERS["attack_w"]
                stats["rook_7th_rank_black"] = True
            if not is_pinned_to_king(board, row, col, 'w'):
                bad_rook_squares = 0
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            bad_rook_squares += 1
                            if board[new_row][new_col] in BLACK_PIECES:
                                break
                        else:
                            break
                score -= bad_rook_squares/14 * SCORING_MODIFIERS["piece_activity_w"]
        else:
            if stats["black_pieces"] == 1:
                if stats["white_rooks"] == 2:
                    if (row + 1 == stats["black_king_row"] or row -1 == stats["black_king_row"]) and not stats["rook_placed_row_white"] and not stats["rook_placed_col_white"]:
                      score -= 3
                      stats["rook_placed_row_white"] = True
                    if (col + 1 == stats["black_king_col"] or col - 1 == stats["black_king_col"]) and not stats["rook_placed_row_white"] and not stats["rook_placed_col_white"]:
                        score -= 3
                        stats["rook_placed_col_white"] = True
                    elif stats["rook_placed_row_white"]:
                        if row == stats["black_king_row"]:
                            score -= 3
                    elif stats["rook_placed_col_white"]:
                        if col == stats["black_king_col"]:
                            score -= 3
    return score, stats

def score_knight(board, row, col, color, stats):
    score = 0
    if color == 'b':
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score += 0.6 * SCORING_MODIFIERS["centralization_b"]
        elif (col) == 0 or (col) == 7:
            score -= 0.2 * SCORING_MODIFIERS["piece_activity_b"]
        if (row) == 0 or (row) == 7:
            score -= 0.2 * SCORING_MODIFIERS["piece_activity_b"]
        elif row in [5, 4, 3, 2]:
            score += 0.2 * SCORING_MODIFIERS["centralization_b"]
            if row in [3, 2]:
                score += 0.3 * SCORING_MODIFIERS["attack_b"]
        directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
        for direction in directions:
            new_row = row + direction[0]
            new_col = col + direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                threatened_piece = board[new_row][new_col]
                if threatened_piece in {'P', 'N', 'B', 'R'}:
                    score += 0.3 * SCORING_MODIFIERS["attack_b"]
                if threatened_piece in {'Q', 'K'}:
                    score += 0.5 * SCORING_MODIFIERS["attack_b"]
        if not stats["endgame"]:
            if is_protected_pawn(board, row, col, 'p'):
                score += 0.4 * SCORING_MODIFIERS["defense_b"]
            if (row, col) == (5, 5) and board[4][4] == 'p':
                score += 0.5 * SCORING_MODIFIERS["centralization_b"]
            if not is_pinned_to_king(board, row, col, 'b'):
                knight_squares = 0
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                        knight_squares += 1
                score += knight_squares/8 * SCORING_MODIFIERS["piece_activity_b"]
        # Opening penalties with smooth transition
        if (row, col) == (7, 1) or (row, col) == (7, 6):
            score -= 0.3 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_b"]
        if (row, col) == (5, 5) and board[4][5] == 'p':
            score += 0.5 * stats["opening_weight"] * SCORING_MODIFIERS["centralization_b"]
    else:
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score -= 0.6 * SCORING_MODIFIERS["centralization_w"]
        elif (col) == 0 or (col) == 7:
            score += 0.2 * SCORING_MODIFIERS["piece_activity_w"]
        if (row) == 0 or (row) == 7:
            score += 0.2 * SCORING_MODIFIERS["piece_activity_w"]
        elif row in [5, 4, 3, 2]:
            score -= 0.2 * SCORING_MODIFIERS["centralization_w"]
            if row in [4, 5]:
                score -= 0.3 * SCORING_MODIFIERS["attack_w"]
        directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
        for direction in directions:
            new_row = row + direction[0]
            new_col = col + direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                threatened_piece = board[new_row][new_col]
                if threatened_piece in {'p', 'n', 'b', 'r'}:
                    score -= 0.3 * SCORING_MODIFIERS["attack_w"]
                if threatened_piece in {'q', 'k'}:
                    score -= 0.5 * SCORING_MODIFIERS["attack_w"]
        if not stats["endgame"]:
            if (row, col) == (2, 2) and board[3][4] == 'P':
                score -= 0.5 * SCORING_MODIFIERS["centralization_w"]
            if is_protected_pawn(board, row, col, 'P'):
                score -= 0.4 * SCORING_MODIFIERS["defense_w"]
            if not is_pinned_to_king(board, row, col, 'w'):
                bad_knight_squares = 0
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                        bad_knight_squares += 1
                score -= bad_knight_squares/8 * SCORING_MODIFIERS["piece_activity_w"]
        # Opening bonuses with smooth transition
        if (row, col) == (0, 1) or (row, col) == (0, 6):
            score += 0.3 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_w"]
        if (row, col) == (2, 5) and board[3][5] == 'P':
            score -= 0.5 * stats["opening_weight"] * SCORING_MODIFIERS["centralization_w"]
    return score

def score_bishop(board, row, col, color, stats):
    score = 0
    if color == 'b':
        if stats["black_bishops"] == 2:
            score += 0.5 * SCORING_MODIFIERS["piece_activity_b"]
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score += 0.3 * SCORING_MODIFIERS["centralization_b"]
        if not stats["endgame"]:
            if is_protected_pawn(board, row, col, 'p'):
                score += 0.4 * SCORING_MODIFIERS["defense_b"]
            if (row, col) == (3, 6):
                if board[2][5] == 'N' and board[0][3] == 'Q':
                    score += 0.7 * SCORING_MODIFIERS["piece_activity_b"]
                    if board[1][4] == 'B':
                      score -= 0.3 * SCORING_MODIFIERS["piece_activity_b"]
            if not is_pinned_to_king(board, row, col, 'b'):
                bishop_squares = 0
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            bishop_squares += 1
                            if board[new_row][new_col] in WHITE_PIECES:
                                break
                        else:
                            break
                score += bishop_squares/13 * SCORING_MODIFIERS["piece_activity_b"]
        # Opening penalties with smooth transition
        if (row, col) == (7, 2) or (row, col) == (7, 5):
            score -= 1.3 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_b"]
    else:
        if stats["white_bishops"] == 2:
            score -= 0.5 * SCORING_MODIFIERS["piece_activity_w"]
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score -= 0.3 * SCORING_MODIFIERS["centralization_w"]
        if not stats["endgame"]:
            if is_protected_pawn(board, row, col, 'P'):
                score -= 0.4 * SCORING_MODIFIERS["defense_w"]
            if (row, col) == (4, 6):
                if board[5][5] == 'n' and board[7][3] == 'q':
                    score -= 0.7 * SCORING_MODIFIERS["piece_activity_w"]
                    if board[6][4] == 'b':
                      score += 0.3 * SCORING_MODIFIERS["piece_activity_w"]
            if not is_pinned_to_king(board, row, col, 'w'):
                bad_bishop_squares = 0
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8 and board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            bad_bishop_squares += 1
                            if board[new_row][new_col] in BLACK_PIECES:
                                break
                        else:
                            break
                score -= bad_bishop_squares/13 * SCORING_MODIFIERS["piece_activity_w"]
        # Opening bonuses with smooth transition
        if (row, col) == (0, 2) or (row, col) == (0, 5):
            score += 1.3 * stats["opening_weight"] * SCORING_MODIFIERS["piece_activity_w"]
    return score

def score_pawn(board, row, col, color, stats):
    score = 0
    passed_left = False
    passed_right = False
    passed_straight = False
    backwards_left = False
    backwards_right = False

    opening = stats.get("opening", False)
    endgame = stats.get("endgame", False)
    black_king_row = stats.get("black_king_row", 7)
    black_king_col = stats.get("black_king_col", 4)
    white_king_row = stats.get("white_king_row", 0)
    white_king_col = stats.get("white_king_col", 4)

    light_square = is_light_square(row, col)

    if color == 'b':
        if stats["black_light_squared_bishop"] and not light_square:
            score += 0.4 * SCORING_MODIFIERS["piece_activity_b"] * SCORING_MODIFIERS["pawn_structure_b"]
        if stats["black_dark_squared_bishop"] and light_square:
            score += 0.4 * SCORING_MODIFIERS["piece_activity_b"] * SCORING_MODIFIERS["pawn_structure_b"]
        if stats["white_light_squared_bishop"] and not light_square:
            score += 0.4 * SCORING_MODIFIERS["piece_activity_b"] * SCORING_MODIFIERS["pawn_structure_b"]
        if stats["white_dark_squared_bishop"] and light_square:
            score += 0.4 * SCORING_MODIFIERS["piece_activity_b"] * SCORING_MODIFIERS["pawn_structure_b"]

        # Passed pawn detection (left/right/center)
        if col > 0:
            for i in range(1, 8):
                r = row - i
                if r < 0: break
                if board[r][col - 1] == 'P':
                    break
                if r == 0:
                    passed_left = True
        else:
            passed_left = True

        if col < 7 and passed_left:
            for i in range(1, 8):
                r = row - i
                if r < 0: break
                if board[r][col + 1] == 'P':
                    break
                if r == 0:
                    passed_right = True
        else:
            passed_right = True

        if passed_left and passed_right:
            for i in range(1, 8):
                r = row - i
                if r < 0: break
                if board[r][col] == 'P':
                    break
                if r == 0:
                    passed_straight = True

        if passed_left and passed_right and passed_straight:
            score += 0.7 * SCORING_MODIFIERS["attack_b"]
            score += (7 - row) / 12 * SCORING_MODIFIERS["attack_b"]

        # Backward pawn detection
        if col > 0:
            for i in range(7):
                r = row + i
                if r > 7: break
                if board[r][col - 1] == 'p':
                    break
                if r == 7:
                    backwards_left = True
        else:
            backwards_left = True

        if col < 7 and backwards_left:
            for i in range(7):
                r = row + i
                if r > 7: break
                if board[r][col + 1] == 'p':
                    break
                if r == 7:
                    backwards_right = True
        else:
            backwards_right = True

        if backwards_left and backwards_right:
            score -= 0.3 * SCORING_MODIFIERS["pawn_structure_b"]
            if row > 0 and board[row - 1][col] == 'P':
                score -= 0.6 * SCORING_MODIFIERS["pawn_structure_b"]
            if passed_straight:
                score -= 0.9 * SCORING_MODIFIERS["pawn_structure_b"]

        # Doubled pawn penalty
        for i in range(1, 8):
            r = row - i
            if r < 0: break
            if board[r][col] == 'p':
                score -= 0.6 * SCORING_MODIFIERS["pawn_structure_b"]
                break

        if (row, col) == (4, 3) and board[4][4] == 'p':
            score += 1 * SCORING_MODIFIERS["pawn_structure_b"] * SCORING_MODIFIERS["centralization_b"]
        if (row, col) in [(5, 2), (4, 2), (5, 5), (4, 5), (5, 3), (5, 4)]:
            score += 0.6 * SCORING_MODIFIERS["pawn_structure_b"]
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score += 0.6 * SCORING_MODIFIERS["centralization_b"]
            if opening:
                score += 0.6 * SCORING_MODIFIERS["centralization_b"]
        if (row, col) == (4, 4):
            score += 0.3 * SCORING_MODIFIERS["pawn_structure_b"] * SCORING_MODIFIERS["centralization_b"]

        # King shielding and central control
        if not endgame:
            if col < 7:
                if row + 1 <= 7 and board[row+1][col+1] == 'p':
                    score += 0.2 * SCORING_MODIFIERS["pawn_structure_b"]
                if row - 1 >= 0 and board[row-1][col+1] == 'p':
                    score += 0.2 * SCORING_MODIFIERS["pawn_structure_b"]
            if col > 0:
                if row + 1 <= 7 and board[row+1][col-1] == 'p':
                    score += 0.2 * SCORING_MODIFIERS["pawn_structure_b"]
                if row - 1 >= 0 and board[row-1][col-1] == 'p':
                    score += 0.2 * SCORING_MODIFIERS["pawn_structure_b"]

            if black_king_row == 7 and black_king_col not in {3, 4}:
                if (row, col) in {(black_king_row - 1, black_king_col),
                                  (black_king_row - 1, black_king_col + 1),
                                  (black_king_row - 1, black_king_col - 1)}:
                    score += 0.6 * SCORING_MODIFIERS["defense_b"]

            score += ((7 - row) / (20 if col in {2, 3, 4, 5} else 30)) * SCORING_MODIFIERS["attack_b"]

            if board[7][5] in {'k'} or board[7][6] in {'k'} or board[7][7] in {'k'}:
                if col in {5, 6, 7}:
                    score -= ((7 - row) / 15) * SCORING_MODIFIERS["attack_b"]

            if col + 1 <= 7 and row > 0:
                if board[row - 1][col + 1] in {'N', 'B', 'R', 'Q', 'K'}:
                    score += 0.5 * SCORING_MODIFIERS["attack_b"]
            if col - 1 >= 0 and row > 0:
                if board[row - 1][col - 1] in {'N', 'B', 'R', 'Q', 'K'}:
                    score += 0.5 * SCORING_MODIFIERS["attack_b"]

        else:
            score += (7 - row) ** 2 / 20 * SCORING_MODIFIERS["attack_b"]

    else:
        if stats["white_light_squared_bishop"] and not light_square:
            score -= 0.4 * SCORING_MODIFIERS["piece_activity_w"] * SCORING_MODIFIERS["pawn_structure_w"]
        if stats["white_dark_squared_bishop"] and light_square:
            score -= 0.4 * SCORING_MODIFIERS["piece_activity_w"] * SCORING_MODIFIERS["pawn_structure_w"]
        if stats["black_light_squared_bishop"] and not light_square:
            score -= 0.4 * SCORING_MODIFIERS["piece_activity_w"] * SCORING_MODIFIERS["pawn_structure_w"]
        if stats["black_dark_squared_bishop"] and light_square:
            score -= 0.4 * SCORING_MODIFIERS["piece_activity_w"] * SCORING_MODIFIERS["pawn_structure_w"]

        if col > 0:
            for i in range(1, 8):
                r = row + i
                if r > 7: break
                if board[r][col - 1] == 'p':
                    break
                if r == 7:
                    passed_left = True
        else:
            passed_left = True

        if col < 7 and passed_left:
            for i in range(1, 8):
                r = row + i
                if r > 7: break
                if board[r][col + 1] == 'p':
                    break
                if r == 7:
                    passed_right = True
        else:
            passed_right = True

        if passed_left and passed_right:
            for i in range(1, 8):
                r = row + i
                if r > 7: break
                if board[r][col] == 'p':
                    break
                if r == 7:
                    passed_straight = True

        if passed_left and passed_right and passed_straight:
            score -= 0.7 * SCORING_MODIFIERS["attack_w"]
            score -= row / 12 * SCORING_MODIFIERS["attack_w"]

        if col > 0:
            for i in range(7):
                r = row - i
                if r < 0: break
                if board[r][col - 1] == 'P':
                    break
                if r == 0:
                    backwards_left = True
        else:
            backwards_left = True

        if col < 7 and backwards_left:
            for i in range(7):
                r = row - i
                if r < 0: break
                if board[r][col + 1] == 'P':
                    break
                if r == 0:
                    backwards_right = True
        else:
            backwards_right = True

        if backwards_left and backwards_right:
            score += 0.3 * SCORING_MODIFIERS["pawn_structure_w"]
            if row + 1 <= 7 and board[row + 1][col] == 'p':
                score += 0.6 * SCORING_MODIFIERS["pawn_structure_w"]
            if passed_straight:
                score += 0.9 * SCORING_MODIFIERS["pawn_structure_w"]

        # Doubled pawn penalty
        for i in range(1, 8):
            r = row + i
            if r > 7: break
            if board[r][col] == 'P':
                score += 0.6 * SCORING_MODIFIERS["pawn_structure_w"]
                break

        if (row, col) == (3, 3) and board[3][4] == 'P':
            score -= 1 * SCORING_MODIFIERS["pawn_structure_w"] * SCORING_MODIFIERS["centralization_w"]
        if (row, col) in [(4, 3), (4, 4), (3, 3), (3, 4)]:
            score -= 0.8 * SCORING_MODIFIERS["centralization_w"]
            if opening:
                score -= 0.8 * SCORING_MODIFIERS["centralization_w"]
        if (row, col) in [(2, 2), (3, 2), (2, 5), (3, 5), (2, 3), (2, 4)]:
            score -= 0.6 * SCORING_MODIFIERS["pawn_structure_w"]

        if not endgame:
            if col < 7:
                if board[row + 1][col + 1] == 'P':
                    score -= 0.2 * SCORING_MODIFIERS["pawn_structure_w"]
                if board[row - 1][col + 1] == 'P':
                    score -= 0.2 * SCORING_MODIFIERS["pawn_structure_w"]
            if col > 0:
                if board[row + 1][col - 1] == 'P':
                    score -= 0.2 * SCORING_MODIFIERS["pawn_structure_w"]
                if board[row - 1][col - 1] == 'P':
                    score -= 0.2 * SCORING_MODIFIERS["pawn_structure_w"]

            if white_king_row == 0 and white_king_col not in {3, 4}:
                if (row, col) in {(white_king_row + 1, white_king_col),
                                  (white_king_row + 1, white_king_col + 1),
                                  (white_king_row + 1, white_king_col - 1)}:
                    score -= 0.6 * SCORING_MODIFIERS["defense_w"]

            score -= row / (20 if col in {2, 3, 4, 5} else 30) * SCORING_MODIFIERS["attack_w"]

            if board[0][5] in {'K'} or board[0][6] in {'K'} or board[0][7] in {'K'}:
                if col in {5, 6, 7}:
                    score -= row / 15 * SCORING_MODIFIERS["attack_w"]

            if col + 1 <= 7 and row < 7:
                if board[row + 1][col + 1] in {'n', 'b', 'r', 'q', 'k'}:
                    score -= 0.5 * SCORING_MODIFIERS["attack_w"]
            if col - 1 >= 0 and row < 7:
                if board[row + 1][col - 1] in {'n', 'b', 'r', 'q', 'k'}:
                    score -= 0.5 * SCORING_MODIFIERS["attack_w"]
        else:
            score -= row ** 2 / 20 * SCORING_MODIFIERS["attack_w"]

    return score


def print_moves(last_move, number_of_moves, game_moves):
    opening_moves = ""
    move_number = 0
    if last_move == 'b':
        for number in range(len(game_moves) // 2):
            if move_number < len(game_moves):
                opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
                move_number += 1
                if move_number < len(game_moves):
                    opening_moves += game_moves[move_number] + ' '
                    move_number += 1
            else:
                break
    else:
        for number in range(len(game_moves) // 2 + 1):
            if number == len(game_moves) // 2:
                opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
                break
            if move_number < len(game_moves):
                opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
                move_number += 1
                if move_number < len(game_moves):
                    opening_moves += game_moves[move_number] + ' '
                    move_number += 1
            else:
                break
    print(opening_moves.strip())
    return opening_moves.strip()



def is_checkmate(board, player):
    """Optimized: Check king moves first (fastest), then other pieces. No random shuffle."""
    white_king_row, white_king_col = find_king(board, 'w')
    black_king_row, black_king_col = find_king(board, 'b')
    rows = BOARD_ROWS
    cols = BOARD_COLS

    # OPTIMIZATION: Check king moves first (fastest to check, often provides escape)
    if player == 'b':
        king_row, king_col = black_king_row, black_king_col
        king_piece = 'k'
        opponent_pieces = WHITE_PIECES
    else:
        king_row, king_col = white_king_row, white_king_col
        king_piece = 'K'
        opponent_pieces = BLACK_PIECES

    # Try king moves first (8 directions)
    king_dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
    for dr, dc in king_dirs:
        r, c = king_row + dr, king_col + dc
        if 0 <= r < 8 and 0 <= c < 8:
            if board[r][c] == '0' or board[r][c] in opponent_pieces:
                captured = board[r][c]
                board[king_row][king_col] = '0'
                board[r][c] = king_piece
                if player == 'b':
                    if not is_king_in_check(board, r, c, 'b'):
                        board[king_row][king_col] = king_piece
                        board[r][c] = captured
                        return False
                else:
                    if not is_king_in_check(board, r, c, 'w'):
                        board[king_row][king_col] = king_piece
                        board[r][c] = captured
                        return False
                board[king_row][king_col] = king_piece
                board[r][c] = captured

    # Now check other pieces
    for row in rows:
        row_data = board[row]
        for col in cols:
            piece = row_data[col]
            if player == 'b':
                if piece == 'p':
                    # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2)
                    directions = [3, 4, 1, 2]  # Captures first, then advances
                    for direction in directions:
                        if direction == 1 and row == 6 and board[row-2][col] == '0' and board[row-1][col] == '0':
                            board[row][col] = '0'
                            board[row-2][col] = 'p'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                board[row][col] = 'p'
                                board[row-2][col] = '0'
                                return False
                            board[row][col] = 'p'
                            board[row-2][col] = '0'

                        elif direction == 2 and row < 7 and board[row-1][col] == '0':
                            board[row][col] = '0'
                            board[row-1][col] = 'p'
                            if row-1 == 0:
                                board[row-1][col] = 'q'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                board[row][col] = 'p'
                                board[row-1][col] = '0'
                                return False
                            board[row][col] = 'p'
                            board[row-1][col] = '0'

                        elif direction == 3 and row < 7 and col > 0 and board[row-1][col-1] in WHITE_PIECES:
                            captured_piece = board[row-1][col-1]
                            board[row][col] = '0'
                            board[row-1][col-1] = 'p'
                            if row-1 == 0:
                                board[row-1][col-1] = 'q'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                board[row][col] = 'p'
                                board[row-1][col-1] = captured_piece
                                return False
                            board[row][col] = 'p'
                            board[row-1][col-1] = captured_piece

                        elif direction == 4 and row > 0 and col < 7 and board[row-1][col+1] in WHITE_PIECES:
                            captured_piece = board[row-1][col+1]
                            board[row][col] = '0'
                            board[row-1][col+1] = 'p'
                            if row-1 == 0:
                                board[row-1][col+1] = 'q'
                                promotion = True
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                board[row][col] = 'p'
                                board[row-1][col+1] = captured_piece
                                return False
                            board[row][col] = 'p'
                            board[row-1][col+1] = captured_piece

                elif piece == 'n':
                    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'n'
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    board[row][col] = 'n'
                                    board[new_row][new_col] = captured_piece
                                    return False
                                board[row][col] = 'n'
                                board[new_row][new_col] = captured_piece

                elif piece == 'b':
                    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'b'
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        board[row][col] = 'b'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'b'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'r':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'r'
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        board[row][col] = 'r'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'r'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'q'
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        board[row][col] = 'q'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'q'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'k':
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'k'
                                black_king_row, black_king_col = find_king(board, 'b')
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    board[row][col] = 'k'
                                    board[new_row][new_col] = captured_piece
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    return False
                                board[row][col] = 'k'
                                board[new_row][new_col] = captured_piece
                                black_king_row, black_king_col = find_king(board, 'b')
            else:
                if piece == 'P':
                    # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2)
                    directions = [3, 4, 1, 2]  # Captures first, then advances
                    for direction in directions:
                        if direction == 1 and row == 1 and board[row+2][col] == '0' and board[row+1][col] == '0':
                            board[row][col] = '0'
                            board[row+2][col] = 'P'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                board[row][col] = 'P'
                                board[row+2][col] = '0'
                                return False
                            board[row][col] = 'P'
                            board[row+2][col] = '0'

                        elif direction == 2 and row < 7 and board[row+1][col] == '0':
                            board[row][col] = '0'
                            board[row+1][col] = 'P'
                            if row+1 == 7:
                                board[row+1][col] = 'Q'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                board[row][col] = 'P'
                                board[row+1][col] = '0'
                                return False
                            board[row][col] = 'P'
                            board[row+1][col] = '0'

                        elif direction == 3 and row < 7 and col > 0 and board[row+1][col-1] in BLACK_PIECES:
                            captured_piece = board[row+1][col-1]
                            board[row][col] = '0'
                            board[row+1][col-1] = 'P'
                            if row+1 == 7:
                                board[row+1][col-1] = 'Q'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                board[row][col] = 'P'
                                board[row+1][col-1] = captured_piece
                                return False
                            board[row][col] = 'P'
                            board[row+1][col-1] = captured_piece

                        elif direction == 4 and row < 7 and col < 7 and board[row+1][col+1] in BLACK_PIECES:
                            captured_piece = board[row+1][col+1]
                            board[row][col] = '0'
                            board[row+1][col+1] = 'P'
                            if row+1 == 7:
                                board[row+1][col+1] = 'Q'
                                promotion = True
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                board[row][col] = 'P'
                                board[row+1][col+1] = captured_piece
                                return False
                            board[row][col] = 'P'
                            board[row+1][col+1] = captured_piece

                elif piece == 'N':
                    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'N'
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    board[row][col] = 'N'
                                    board[new_row][new_col] = captured_piece
                                    return False
                                board[row][col] = 'N'
                                board[new_row][new_col] = captured_piece

                elif piece == 'B':
                    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'B'
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        board[row][col] = 'B'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'B'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'R':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'R'
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        board[row][col] = 'R'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'R'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'Q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'Q'
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        board[row][col] = 'Q'
                                        board[new_row][new_col] = captured_piece
                                        return False
                                    board[row][col] = 'Q'
                                    board[new_row][new_col] = captured_piece
                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'K':
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'K'
                                white_king_row, white_king_col = find_king(board, 'w')
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    board[row][col] = 'K'
                                    board[new_row][new_col] = captured_piece
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    return False
                                board[row][col] = 'K'
                                board[new_row][new_col] = captured_piece
                                white_king_row, white_king_col = find_king(board, 'w')

    return True


def is_king_in_check(board, king_row, king_col, player):
    """Optimized: Check only pieces that can attack the king, not all 64 squares."""
    opponent_pieces = BLACK_PIECES if player == 'w' else WHITE_PIECES

    # Check pawn attacks first (fastest, most common)
    if player == 'b':  # Black king, check white pawns
        if king_row > 0:
            if king_col > 0 and board[king_row-1][king_col-1] == 'P':
                return True
            if king_col < 7 and board[king_row-1][king_col+1] == 'P':
                return True
    else:  # White king, check black pawns
        if king_row < 7:
            if king_col > 0 and board[king_row+1][king_col-1] == 'p':
                return True
            if king_col < 7 and board[king_row+1][king_col+1] == 'p':
                return True

    # Check knight attacks (8 possible squares)
    knight_moves = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
    knight_piece = 'N' if player == 'b' else 'n'
    for dr, dc in knight_moves:
        r, c = king_row + dr, king_col + dc
        if 0 <= r < 8 and 0 <= c < 8 and board[r][c] == knight_piece:
            return True

    # Check king attacks (8 adjacent squares)
    king_piece = 'K' if player == 'b' else 'k'
    for dr in (-1, 0, 1):
        for dc in (-1, 0, 1):
            if dr == 0 and dc == 0:
                continue
            r, c = king_row + dr, king_col + dc
            if 0 <= r < 8 and 0 <= c < 8 and board[r][c] == king_piece:
                return True

    # Check sliding pieces (rooks, bishops, queens) along rays to king
    # Diagonals (bishops/queens)
    diag_dirs = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
    bishop_piece = 'B' if player == 'b' else 'b'
    queen_piece = 'Q' if player == 'b' else 'q'
    for dr, dc in diag_dirs:
        for i in range(1, 8):
            r, c = king_row + i * dr, king_col + i * dc
            if not (0 <= r < 8 and 0 <= c < 8):
                break
            piece = board[r][c]
            if piece == '0':
                continue
            if piece == bishop_piece or piece == queen_piece:
                return True
            break  # Blocked by another piece

    # Orthogonal (rooks/queens)
    ortho_dirs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
    rook_piece = 'R' if player == 'b' else 'r'
    for dr, dc in ortho_dirs:
        for i in range(1, 8):
            r, c = king_row + i * dr, king_col + i * dc
            if not (0 <= r < 8 and 0 <= c < 8):
                break
            piece = board[r][c]
            if piece == '0':
                continue
            if piece == rook_piece or piece == queen_piece:
                return True
            break  # Blocked by another piece

    return False

# --- Cached wrapper (must come immediately after definition) ---
# Store the optimized function as uncached version for the cache wrapper
_is_king_in_check_uncached = is_king_in_check
def is_king_in_check(board, king_row, king_col, player):
    """Cached wrapper for optimized is_king_in_check."""
    return _is_king_in_check_cached(board_to_hash(board), king_row, king_col, player)

def is_pinned_to_king(board, row, col, player):
    threat = False
    king = False
    piece = board[row][col]
    opponent = 'b' if player == 'w' else 'w'
    if player == 'b':
        if piece in BLACK_BN:
            directions = [(1, 0), (-1, 0)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in ROOK_QUEEN_W:
                            threat = True
                        if board[new_row][new_col] == 'k':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

            threat = False
            king = False
            directions = [(0, 1), (0, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in ROOK_QUEEN_W:
                            threat = True
                        if board[new_row][new_col] == 'k':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        if piece in BLACK_NR:
            threat = False
            king = False
            directions = [(1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in BISHOP_QUEEN_W:
                            threat = True
                        if board[new_row][new_col] == 'k':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

            threat = False
            king = False
            directions = [(-1, 1), (1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in BISHOP_QUEEN_W:
                            threat = True
                        if board[new_row][new_col] == 'k':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

    elif player == 'w':
        if piece in WHITE_BN:
            threat = False
            king = False
            directions = [(0, 1), (0, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in ROOK_QUEEN_B:
                            threat = True
                        if board[new_row][new_col] == 'K':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

            threat = False
            king = False
            directions = [(1, 0), (-1, 0)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in ROOK_QUEEN_B:
                            threat = True
                        if board[new_row][new_col] == 'K':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        if piece in WHITE_NR:
            threat = False
            king = False
            directions = [(1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in BISHOP_QUEEN_B:
                            threat = True
                        if board[new_row][new_col] == 'K':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

            threat = False
            king = False
            directions = [(-1, 1), (1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = row + i * direction[0]
                    new_col = col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in BISHOP_QUEEN_B:
                            threat = True
                        if board[new_row][new_col] == 'K':
                            king = True
                        if threat and king:
                          return True
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break

    return False

def is_protected(board, row, col, player):
    opponent = 'b' if player == 'w' else 'w'
    if player == 'b':
        defenders = check_defenders_lower(board, row, col)
        attackers = check_defenders_upper(board, row, col)
        if defenders >= attackers:
            return True
        else:
            return False

    elif player == 'w':
        defenders = check_defenders_upper(board, row, col)
        attackers = check_defenders_lower(board, row, col)
        if defenders >= attackers:
            return True
        else:
            return False


def is_draw(board):
    pieces = 0
    black_pieces = 0
    white_pieces = 0
    black_knights = 0
    white_knights = 0
    black_bishops = 0
    white_bishops = 0
    for row in range(8):
        for col in range(8):
            if board[row][col] != '0':
                pieces += 1
            if board[row][col] in {'p', 'n', 'b', 'r', 'q', 'k'}:
                black_pieces += 1
            elif board[row][col] in {'P', 'N', 'B', 'R', 'Q', 'K'}:
                white_pieces += 1
            elif board[row][col] == 'b':
                black_bishops += 1
            elif board[row][col] == 'B':
                white_bishops += 1
            elif board[row][col] == 'n':
                black_knights += 1
            elif board[row][col] == 'N':
                white_knights += 1
    if pieces == 2:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 3 and white_knights == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 3 and black_knights == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 4 and black_knights == 1 and white_knights == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 4 and black_bishops == 1 and white_bishops == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 4 and black_bishops == 1 and white_knights == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 4 and black_knights == 1 and white_bishops == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 3 and black_bishops == 1:
        print('Draw by insuffiecient material')
        sys.exit()
    if pieces == 3 and white_bishops == 1:
        print('Draw by insuffiecient material')
        sys.exit()

def is_protected_piece(board, row, col, piece):
    """Legacy function - checks if piece type exists on path to square"""
    if piece in {'r', 'q', 'R', 'Q'}:
        directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        for direction in directions:
            for i in range(1, 8):
                new_row = row + i * direction[0]
                new_col = col + i * direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == piece:
                        return True
                    if board[new_row][new_col] != '0':
                        break
                else:
                    break
    if piece in {'b', 'q', 'B', 'Q'}:
        directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
        for direction in directions:
            for i in range(1, 8):
                new_row = row + i * direction[0]
                new_col = col + i * direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == piece:
                        return True
                    if board[new_row][new_col] != '0':
                        break
                else:
                    break
    elif piece in {'n', 'N'}:
        directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
        for direction in directions:
            new_row = row + direction[0]
            new_col = col + direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] == piece:
                    return True
    return False
def get_move_disambiguation(board, best_piece, best_row, best_col, target_row, target_col):
    """
    Find all pieces of same type that can legally move to target square FROM CURRENT POSITION.
    Returns minimal disambiguation: '', 'file', 'rank', or 'both'
    Prefers file over rank when possible.
    """
    ambiguous_pieces = []

    # Find all pieces of same type (excluding the target square where piece just moved)
    for row in range(8):
        for col in range(8):
            # Skip the target square (piece that just moved is there)
            if row == target_row and col == target_col:
                continue

            if board[row][col] == best_piece:
                # Check if this piece can actually move to target from its current position
                can_move = False

                if best_piece in {'r', 'q', 'R', 'Q'}:
                    # Rook/queen horizontal/vertical moves
                    if row == target_row or col == target_col:
                        # Check if path is clear (treating original position as still occupied)
                        path_clear = True
                        if row == target_row:
                            # Moving along same row
                            step = 1 if target_col > col else -1
                            for c in range(col + step, target_col, step):
                                # Treat original position as occupied
                                if board[row][c] != '0' or (row == best_row and c == best_col):
                                    path_clear = False
                                    break
                        else:
                            # Moving along same column
                            step = 1 if target_row > row else -1
                            for r in range(row + step, target_row, step):
                                # Treat original position as occupied
                                if board[r][col] != '0' or (r == best_row and col == best_col):
                                    path_clear = False
                                    break
                        if path_clear:
                            can_move = True

                if best_piece in {'b', 'q', 'B', 'Q'}:
                    # Bishop/queen diagonal moves
                    row_diff = abs(row - target_row)
                    col_diff = abs(col - target_col)
                    if row_diff == col_diff and row_diff > 0:
                        # Check if path is clear (treating original position as still occupied)
                        path_clear = True
                        row_step = 1 if target_row > row else -1
                        col_step = 1 if target_col > col else -1
                        r, c = row + row_step, col + col_step
                        while r != target_row:
                            # Treat original position as occupied
                            if board[r][c] != '0' or (r == best_row and c == best_col):
                                path_clear = False
                                break
                            r += row_step
                            c += col_step
                        if path_clear:
                            can_move = True

                if best_piece in {'n', 'N'}:
                    # Knight moves
                    row_diff = abs(row - target_row)
                    col_diff = abs(col - target_col)
                    if (row_diff == 2 and col_diff == 1) or (row_diff == 1 and col_diff == 2):
                        can_move = True

                if can_move:
                    ambiguous_pieces.append((row, col))

    if not ambiguous_pieces:
        return ''

    # Check if file disambiguation is sufficient
    file_unique = True
    for row, col in ambiguous_pieces:
        if col == best_col:
            file_unique = False
            break

    if file_unique:
        return indices_to_pos_col(best_col)

    # Check if rank disambiguation is sufficient
    rank_unique = True
    for row, col in ambiguous_pieces:
        if row == best_row:
            rank_unique = False
            break

    if rank_unique:
        return str(8 - best_row)

    # Need both file and rank
    return indices_to_pos(best_row, best_col)

def is_protected_pawn(board, row, col, piece):
    if piece == 'p':
        directions = [(1, 1), (1, -1)]
        for direction in directions:
            new_row = row + direction[0]
            new_col = col + direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] == piece:
                    return True
    elif piece == 'P':
        directions = [(-1, 1), (-1, -1)]
        for direction in directions:
            new_row = row + direction[0]
            new_col = col + direction[1]
            if 0 <= new_row < 8 and 0 <= new_col < 8:
                if board[new_row][new_col] == piece:
                    return True
    return False

def open_file(board, col, turn):
    if turn == 'w':
        for row in range(8):
            if board[row][col] == 'P':
                return False
    elif turn == 'b':
        for row in range(8):
            if board[row][col] == 'p':
                return False
    return True

def corner_queen_mate(board, target_row, target_col, winner):
    print('yolo')
    score = 0
    if winner == 'w':
        for row in range(8):
            for col in range(8):
                if board[row][col] == 'K':
                    distance = abs(row - target_row) + abs(col - target_col)
                    score -= (7 - distance)*10
    elif winner == 'b':
        for row in range(8):
            for col in range(8):
                if board[row][col] == 'k':
                    distance = abs(row - target_row) + abs(col - target_col)
                    score += (7 - distance)*10
    return score
def parse_move(move):
    move = move.lower()
    pattern = r'^([kqrnb])?([a-h])([1-8])'
    match = re.match(pattern, move)
    if match:
        piece = match.group(1) if match.group(1) else 'P'  # If no piece letter, it's a pawn
        col = match.group(2)
        row = int(match.group(3))
        return piece.upper(), col, row
    else:
        return None, None, None

def extract_long_algebraic(move):
    if len(move) != 5:
        raise ValueError("Move must be exactly 5 characters long (e.g., 'Nb8c6')")

    piece = move[0]          # 'N'
    from_square = move[1:3]  # 'b8'
    to_square = move[3:5]    # 'c6'

    from_col = from_square[0]
    from_row = from_square[1]
    to_col = to_square[0]
    to_row = to_square[1]

    return piece, from_row, from_col, to_row, to_col

def normalize_pgn(pgn_str):
    return ' '.join(pgn_str.strip().split())

def clean_move(move):
    move = re.sub(r'[x+#]', '', move)
    move = re.sub(r'=.', '', move)
    return move

def is_pawn_capture(move):
    return bool(re.match(r'^[a-h]x[a-h][1-8](=?[QRNB])?[\+#]?$', move))


def convert_move(board, to_row, to_col, piece, color):
    if color == 'b':
        if piece == 'n':
            directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
            for direction in directions:
                new_row = to_row + direction[0]
                new_col = to_col + direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == 'n':
                        return new_row, new_col
        elif piece == 'b':
            directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'b':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'r':
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'r':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'q':
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'q':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'p':
            if to_row == 4:
                if board[to_row+1][to_col] == 'p':
                    return to_row+1, to_col
                else:
                    return to_row+2, to_col
            else:
                return to_row+1, to_col
        elif piece == 'k':
              directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
              for direction in directions:
                  new_row = to_row + direction[0]
                  new_col = to_col + direction[1]
                  if 0 <= new_row < 8 and 0 <= new_col < 8:
                      if board[new_row][new_col] == 'k':
                          return new_row, new_col
    elif color == 'w':
        if piece == 'n':
            directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
            for direction in directions:
                new_row = to_row + direction[0]
                new_col = to_col + direction[1]
                if 0 <= new_row < 8 and 0 <= new_col < 8:
                    if board[new_row][new_col] == 'N':
                        print(new_row, new_col)
                        return new_row, new_col
        elif piece == 'b':
            directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'B':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'r':
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'R':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'q':
            directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
            for direction in directions:
                for i in range(1, 8):
                    new_row = to_row + i * direction[0]
                    new_col = to_col + i * direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] == 'Q':
                            return new_row, new_col
                        if board[new_row][new_col] != '0':
                            break
                    else:
                        break
        elif piece == 'p':
            if to_row == 3:
                if board[to_row-1][to_col] == 'P':
                    return to_row-1, to_col
                else:
                    return to_row-2, to_col
            else:
                return to_row-1, to_col
        elif piece == 'k':
              directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
              for direction in directions:
                  new_row = to_row + direction[0]
                  new_col = to_col + direction[1]
                  if 0 <= new_row < 8 and 0 <= new_col < 8:
                      if board[new_row][new_col] == 'K':
                          return new_row, new_col
    # Default return if piece not found
    return None, None

def extract_moves(pgn_str):
    pattern = r'\b(?:0-0-0|0-0|[a-hRNBQK][a-h1-8x=+#]*)\b'
    return re.findall(pattern, pgn_str)


def players_turn(board, next_move, notation_move):
    global number_of_moves, white_king_row, white_king_col, white_move_count
    blind = 'flase'
    original_move_notation = next_move  # Save original for en passant detection
    if next_move == '0-0':
      en_passant = 'false'
      board[0][4] = '0'
      board[0][6] = 'K'
      board[0][7] = '0'
      board[0][5] = 'R'
      white_king_row, white_king_col = 0, 6  # Update king position
      if blind != 'y':
          print_board(board)
          print()

    elif next_move == '0-0-0':
      en_passant = 'false'
      board[0][4] = '0'
      board[0][2] = 'K'
      board[0][0] = '0'
      board[0][3] = 'R'
      white_king_row, white_king_col = 0, 2  # Update king position'
      if blind != 'y':
          print_board(board)
          print()

    elif next_move in {'en', 'en_passant', 'passant'}:
      en_passant = 'false'
      from_square = input("From what square: ").strip().lower()
      to_square = input("To what square: ").strip().lower()
      from_row, from_col = pos_to_indices(from_square)
      to_row, to_col = pos_to_indices(to_square)
      board[from_row][from_col] = '0'
      board[from_row][to_col] = '0'
      board[to_row][to_col] = 'P'
      black_king_row, black_king_col = find_king(board, 'b')
      if is_king_in_check(board, black_king_row, black_king_col, 'b'):
          move_played = indices_to_pos_col(from_col) + 'x' + indices_to_pos(to_row, to_col) + '+'
      else:
          move_played = indices_to_pos_col(from_col) + 'x' + indices_to_pos(to_row, to_col)
      if blind != 'y':
          print_board(board)
          print()

    else:
        if len(clean_move(next_move)) == 5:
            next_move = clean_move(next_move)
            piece, from_row, from_col, to_row, to_col = extract_long_algebraic(next_move)
            pos = str(from_col) + str(from_row)
            row, col = pos_to_indices(pos)
            pos = str(to_col) + str(to_row)
            target_row, target_col = pos_to_indices(pos)
            best_move = [row, col, target_row, target_col]
        elif is_pawn_capture(next_move):
            if len(next_move) >= 4:
                col, row = next_move[2], next_move[3]
                from_col = pos_to_indices_col(next_move[0])
                pos = str(col) + str(row)
                print(pos)
                to_row, to_col = pos_to_indices(pos)
                best_move = [to_row-1, from_col, to_row, to_col]
            else:
                raise ValueError(f"Invalid pawn capture move format: {next_move}")
        else:
            next_move = clean_move(next_move)
            piece, to_col, to_row = parse_move(next_move)
            if piece is None or to_col is None or to_row is None:
                raise ValueError(f"Could not parse move: {next_move}")
            pos = str(to_col) + str(to_row)
            row, col = pos_to_indices(pos)
            from_row, from_col = convert_move(board, row, col, piece.lower(), 'w')
            if from_row is None or from_col is None:
                raise ValueError(f"Could not find piece for move: {next_move}")
            best_move = [from_row, from_col, row, col]
        if len(best_move) < 4:
            raise ValueError(f"Invalid best_move format: {best_move}")
        from_row, from_col, to_row, to_col = best_move[0], best_move[1], best_move[2], best_move[3]
        s = board[to_row][to_col]
        if board[from_row][from_col] != '0' and s != 'P' and s != 'R' and s != 'N' and s != 'B' and s != 'K' and s != 'Q':
            piece = board[from_row][from_col]
            captured = board[to_row][to_col]
            black_king_row, black_king_col = find_king(board, 'b')

            # Handle en passant from opponent (white pawn capturing en passant)
            # En passant: white pawn on rank 5 (row 3) captures black pawn that just moved 2 squares
            # The captured pawn is on rank 5 (row 3), adjacent file, and we move to rank 6 (row 2)
            if piece == 'P' and captured == '0':
                 if to_col != from_col:
                     board[to_row][to_col] = 'P'
                     board[from_row][to_col] = '0'
                     board[from_row][from_col] = '0'

            if piece == 'P' and to_row == 7:
                board[from_row][from_col] = '0'
                # Check for underpromotion (=R, =B, =N instead of =Q)
                promotion_piece = 'Q'  # Default to queen
                if '=R' in next_move or '=r' in next_move:
                    promotion_piece = 'R'
                elif '=B' in next_move or '=b' in next_move:
                    promotion_piece = 'B'
                elif '=N' in next_move or '=n' in next_move:
                    promotion_piece = 'N'
                board[to_row][to_col] = promotion_piece
            else:
                board[from_row][from_col] = '0'
                board[to_row][to_col] = piece
                # Update king position if king moved
                if piece == 'K':
                    white_king_row, white_king_col = to_row, to_col
            next_move = print_piece_move(board, piece, from_row, from_col, to_row, to_col, captured, 'w')
            if piece == 'P' and from_row == 1 and to_row == 3:
                en_passant = from_col
            else:
                en_passant = 'false'
            if blind != 'y':
                print_board(board)
                print()
            if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                if is_checkmate(board, 'b'):
                    print('CHECKMATE! You win!')
                    sys.exit()


    is_draw(board)
    number_of_moves += 1
    game_moves.append(notation_move)
    output = print_moves('b', number_of_moves, game_moves)
    print(output)

def players_turn_white(board, next_move, notation_move):
    global number_of_moves, black_king_row, black_king_col, black_move_count
    original_move_notation = next_move  # Save original for en passant detection
    if next_move == '0-0':
      en_passant = 'false'
      board[7][4] = '0'
      board[7][6] = 'k'
      board[7][7] = '0'
      board[7][5] = 'r'
      black_king_row, black_king_col = 7, 6  # Update king position
      print_board(board)
      print()
    elif next_move == '0-0-0':
      en_passant = 'false'
      board[7][4] = '0'
      board[7][2] = 'k'
      board[7][0] = '0'
      board[7][3] = 'r'
      black_king_row, black_king_col = 7, 2  # Update king position
      print_board(board)
      print()
    elif next_move in {'en', 'en_passant', 'passant'}:
      en_passant = 'false'
      from_square = input("From what square: ").strip().lower()
      to_square = input("To what square: ").strip().lower()
      from_row, from_col = pos_to_indices(from_square)
      to_row, to_col = pos_to_indices(to_square)
      board[from_row][from_col] = '0'
      board[from_row][to_col] = '0'
      board[to_row][to_col] = 'p'
      white_king_row, white_king_col = find_king(board, 'w')
      if is_king_in_check(board, white_king_row, white_king_col, 'w'):
          move_played = indices_to_pos_col(from_col) + 'x' + indices_to_pos(to_row, to_col) + '+'
      else:
          move_played = indices_to_pos_col(from_col) + 'x' + indices_to_pos(to_row, to_col)
      print_board(board)
      print()

    else:
        if len(clean_move(next_move)) == 5:
            next_move = clean_move(next_move)
            piece, from_row, from_col, to_row, to_col = extract_long_algebraic(next_move)
            pos = str(from_col) + str(from_row)
            row, col = pos_to_indices(pos)
            pos = str(to_col) + str(to_row)
            target_row, target_col = pos_to_indices(pos)
            best_move = [row, col, target_row, target_col]
        elif is_pawn_capture(next_move):
            if len(next_move) >= 4:
                col, row = next_move[2], next_move[3]
                from_col = pos_to_indices_col(next_move[0])
                pos = str(col) + str(row)
                to_row, to_col = pos_to_indices(pos)
                best_move = [to_row+1, from_col, to_row, to_col]
            else:
                raise ValueError(f"Invalid pawn capture move format: {next_move}")
        else:
            next_move = clean_move(next_move)
            piece, to_col, to_row = parse_move(next_move)
            if piece is None or to_col is None or to_row is None:
                raise ValueError(f"Could not parse move: {next_move}")
            pos = str(to_col) + str(to_row)
            row, col = pos_to_indices(pos)
            from_row, from_col = convert_move(board, row, col, piece.lower(), 'b')
            if from_row is None or from_col is None:
                raise ValueError(f"Could not find piece for move: {next_move}")
            best_move = [from_row, from_col, row, col]
        if len(best_move) < 4:
            raise ValueError(f"Invalid best_move format: {best_move}")
        from_row, from_col, to_row, to_col = best_move[0], best_move[1], best_move[2], best_move[3]
        s = board[to_row][to_col]
        if board[from_row][from_col] not in {'0', 'P', 'N', 'B', 'R', 'Q'} and s not in BLACK_PIECES:
            piece = board[from_row][from_col]
            captured = board[to_row][to_col]
            white_king_row, white_king_col = find_king(board, 'w')

            # Handle en passant from opponent (black pawn capturing en passant)
            # En passant: black pawn on rank 4 (row 4) captures white pawn that just moved 2 squares
            # The captured pawn is on rank 4 (row 4), adjacent file, and we move to rank 3 (row 5)
            if piece == 'p' and captured == '0':
                 if to_col != from_col:
                     board[to_row][to_col] = 'p'
                     board[from_row][to_col] = '0'
                     board[from_row][from_col] = '0'

            if piece == 'p' and to_row == 0:
                board[from_row][from_col] = '0'
                # Check for underpromotion (=r, =b, =n instead of =q)
                promotion_piece = 'q'  # Default to queen
                if '=R' in next_move or '=r' in next_move:
                    promotion_piece = 'r'
                elif '=B' in next_move or '=b' in next_move:
                    promotion_piece = 'b'
                elif '=N' in next_move or '=n' in next_move:
                    promotion_piece = 'n'
                board[to_row][to_col] = promotion_piece
            else:
                board[from_row][from_col] = '0'
                board[to_row][to_col] = piece
                # Update king position if king moved
                if piece == 'k':
                    black_king_row, black_king_col = to_row, to_col
            if piece == 'p' and from_row == 6 and to_row == 4:
                en_passant = from_col
            else:
                en_passant = 'false'
            print_board(board)
            print()
            if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                if is_checkmate(board, 'w'):
                    print('CHECKMATE! You win!')
                    sys.exit()

    is_draw(board)
    number_of_moves += 1
    game_moves.append(notation_move)
    output = print_moves('w', number_of_moves, game_moves)
    print(output)

def print_board(board):
    for row in board:
        print(' '.join(str(cell) for cell in row))
    print()  # Print a space after the board


def pick_random_square(board):
    while True:
        row = random.randint(0, 7)
        col = random.randint(0, 7)
        s = board[row][col]
        if s == 'p' or s == 'r' or s == 'n' or s == 'b' or s == 'k' or s == 'q':
            return row, col

def best_move_function_test(board, bots, en_passant):
    global blind
    global king_move
    global number_of_moves
    global draws
    global wins
    global fifty_move_rule
    blind = 'false'
    black_king_row, black_king_col = find_king(board, 'b')
    checkmate = False
    checkmate2 = False
    bad_checkmate = False
    stalemate = False
    promotion = False
    good_left = False
    good_right = False
    previous_score = -6000
    best_moves = []
    rows = BOARD_ROWS
    cols = BOARD_COLS
    if board[0][0].lower() == 'r':
      start = True
    else:
      start = False
    opening_moves = ""
    move_number = 0
    if DEBUG_LOGS:
        print('GM:', game_moves)
    for number in range(len(game_moves) // 2):
        if move_number < len(game_moves):
            opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
            move_number += 1
            if move_number < len(game_moves):
                opening_moves += game_moves[move_number] + ' '
                move_number += 1
        else:
            break
    if DEBUG_LOGS:
        print('OM:', opening_moves)

    good_moves = [(6, 4, 4, 4, 'p', '0'), (6, 3, 4, 3, 'p', '0'), (7, 6, 5, 5, 'n', '0'), (7, 6, 5, 5, 'n', '0'), (5, 3, 1, 7, 'b', 'P'), (7, 5, 4, 2, 'b', '0'), (5, 5, 4, 3, 'n', 'P'), (4, 4, 3, 3, 'p', 'P')]
    openings = ['1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 dxc3 5. Nxc3 Bb4 6. Bc4 Nf6 7. e5 Ne4 8. Qd5',
                '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 dxc3 5. Nxc3 Bb4 6. Bc4 d6 7. Qb3 Bxc3+ 8. bxc3 Qe7 9. 0-0 Nf6 10. e5 Nxe5 11. Nxe5 dxe5 12. Ba3 c5 13. Bb5+ Bd7 14. Bxd7+ Qxd7 15. Bxc5 Ne4 16. Be3 0-0 17. Rf1d1',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. 0-0 Nxe4 5. Re1 Nd6 6. Bf1 f6 7. d4 Nf7 8. dxe5 fxe5 9. Nc3',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. 0-0 Qf6 6. d4 exd4 7. Bg5 Qd6 8. Nxd4 Be7 9. Be3 Nf6 10. f3',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. 0-0 Nxe4 5. Re1 Nd6 6. Nxe5 Nxe5 7. Rxe5+ Be7 8. Bf1 0-0 9. d4 Bf6 10. Re1 Nf5 11. d5 d6 12. Nc3 h6 13. Ne4 Be5 14. c3 Bd7 15. a4 a5 16. Bd2 c6 17. dxc6 Bxc6 18. Bb5 Bxb5 19. axb5 Re8 20. Ng3 Nxg3 21. hxg3 Bf6 22. Qa4 Qd7 23. Rxe8+ Rxe8 24. Be3 Re5 25. Qxa5 Rxb5 26. Qa8+ Kh7 27. Qa4 Qf5 28. g4 Qe5 29. Ra2 Rd5 30. Qc2+ g6 31. Ra4 Qe6 32. Qb3 Bg5 33. Bxg5 b5 34. Ra7 hxg5 35. Kf1 Qe4 36. Rxf7+ Kh6 37. Re7 Qd3+ 38. Re2 b4 39. f3 Qd1+ 40. Qxd1 Rxd1+ 41. Re1 Rxe1+ 42. Kxe1 b3 43. Ke2 Kg7 44. Ke3 Kf6 45. Kd4 Ke6 46. Kc4 d5+ 47. Kxb3 Ke5 48. Kc2 d4 49. c4 Kd6 50. b4 Ke5 51. Kd3 Kf6  52. Kxd4 Kf7 53. b5 Ke6 54. Kc5 Ke7 55. b6 Ke6 56. b7',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Rc8 12. Kb1 Nc4 13. Bxc4 Rxc4 14. g4 Qa5 15. g5 Nh5 16. Nd5',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Qa5 12. Kb1 Rf8c8 13. g4 b5 14. h4 b4 15. Nc3e2 Nc4 16. Bxc4 Rxc4 17. Bh6 Bxh6 18. Qxh6 Qe5 19. h5 g5 20. Nf5 Bxf5 21. Qxg5+ Bg6 22. Qxe5 dxe5 23. hxg6 fxg6 24. g5 Nh5 25. Rd7',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Qa5 12. Kb1 Rf8c8 13. g4 b5 14. h4 b4 15. Nc3e2 Nc4 16. Bxc4 Rxc4 17. Bh6 Bxh6 18. Qxh6 Qe5 19. h5 g5 20. Nf5 Bxf5 21. Qxg5+ Bg6 22. Qxe5 dxe5 23. hxg6 hxg6 24. Nc1',
                '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
                '1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 6. dxe6 Nc6 7. exf7+ Kxf7 8. Ne2 Bb4+ 9. Nb1c3 Re8 10. Kf2',
                '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4 dxe5 6. fxe5 Nc6 7. Be3 Bf5 8. Nc3',
                '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 0-0 6. h3 a5 7. Bg5 h6 8. Be3 e5 9. d5 Na6 10. Qc1 Nc5 11. Bxc5 dxc5 12. Qe3 b6 13. a4 ',
                '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. Ne5',
                '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nf6d7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 Bxd4 10. Bxd4 Nxd4 11. Qxd4 Qb6 12. Nb5',
                '1. e4 f5 2. exf5 d5 3. Qh5+ g6 4. fxg6 Kd7 5. Qxd5+',
                '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3',
                '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4.f4',
    ]
    if opening_moves != 'none':
        for opening in openings:
            normalized_opening = normalize_pgn(opening)
            normalized_input = normalize_pgn(opening_moves)
            if normalized_input in normalized_opening:
                to_play_list = extract_moves(opening)
                played_list = extract_moves(opening_moves)
                next_index = len(played_list)
                if next_index < len(to_play_list):
                    next_move = to_play_list[next_index]
                    if next_move in {'0-0', 'O-O'}:
                        best_moves = [('0-0')]
                        previous_score = score(board, 'w')
                    elif next_move in {'0-0-0', 'O-O-O'}:
                        best_moves = [('0-0-0')]
                        previous_score = score(board, 'w')
                    elif len(clean_move(next_move)) == 5:
                        piece, from_row, from_col, to_row, to_col = extract_long_algebraic(next_move)
                        pos = str(from_col) + str(from_row)
                        row, col = pos_to_indices(pos)
                        pos = str(to_col) + str(to_row)
                        target_row, target_col = pos_to_indices(pos)
                        best_moves = [(row, col, target_row, target_col, piece.lower())]
                        previous_score = score(board, 'w')
                    elif is_pawn_capture(next_move):
                        col, row = next_move[2], next_move[3]
                        from_col = pos_to_indices_col(next_move[0])
                        pos = str(col) + str(row)
                        to_row, to_col = pos_to_indices(pos)
                        best_moves = [(to_row+1, from_col, to_row, to_col, 'p')]
                        previous_score = score(board, 'w')
                    else:
                        next_move = clean_move(next_move)
                        piece, to_col, to_row = parse_move(next_move)
                        pos = str(to_col) + str(to_row)
                        row, col = pos_to_indices(pos)
                        from_row, from_col = convert_move(board, row, col, piece.lower(), 'b')
                        best_moves = [(from_row, from_col, row, col, piece.lower())]
                        previous_score = score(board, 'w')
    elif start:
        best_options = [(6, 4, 4, 4, 'p')]
        best_moves = [random.choice(best_options)]
        previous_score = score(board, 'b')

    if not best_moves:
        for row in rows:
            for col in cols:
                piece = board[row][col]
                if piece == 'p':
                    directions = [1, 2, 3, 4]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction == 1 and row == 6 and board[row-2][col] == '0' and board[row-1][col] == '0':
                            good_right = False
                            good_left = False
                            if col > 0:
                                if board[row-2][col-1] != 'P':
                                    good_left = True
                            else:
                                good_left = True
                            if col < 7:
                                if board[row-2][col+1] != 'P':
                                    good_right = True
                            else:
                                good_right = True
                            if good_right and good_left:
                                print(indices_to_pos(row-2, col))
                                board[row][col] = '0'
                                board[row-2][col] = 'p'
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                    if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                        white_king_row, white_king_col = find_king(board, 'w')
                                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            checkmate = True
                                        else:
                                            stalemate = True
                                    elif best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                        bad_checkmate = True
                                    if not checkmate and not bad_checkmate and not stalemate:
                                        if best_piece != 'P':
                                          if board[target_row][target_col] in BLACK_PIECES:
                                            print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                          else:
                                            print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                        else:
                                            if board[target_row][target_col] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                            else:
                                              print(indices_to_pos(target_row, target_col))
                                        board[best_row][best_col] = '0'
                                        board[target_row][target_col] = best_piece
                                        if target_row == 7 and best_piece == 'P':
                                            board[target_row][target_col] = 'Q'
                                        best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                            checkmate2 = True
                                        if not checkmate2:
                                            if best_piece2 != 'p':
                                                if board[target_row2][target_col2] in WHITE_PIECES:
                                                  print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                else:
                                                  print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                            else:
                                                if board[target_row2][target_col2] in WHITE_PIECES:
                                                  print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                else:
                                                  print(indices_to_pos(target_row2, target_col2))
                                            board[best_row2][best_col2] = '0'
                                            board[target_row2][target_col2] = best_piece2
                                            if target_row2 == 0 and best_piece2 == 'p':
                                                board[target_row2][target_col2] = 'q'
                                            current_score = score(board, 'w')
                                            for move in good_moves:
                                                if (row, col, row-2, col, 'p', '0') == move:
                                                    current_score += 0.5
                                            print(current_score)
                                            print()
                                            board[best_row2][best_col2] = best_piece2
                                            board[target_row2][target_col2] = captured2
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, row-2, col, 'p')]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, row-2, col, 'p'))
                                    elif checkmate:
                                        print_board(board)
                                        print('CHECKMATE! you lose')
                                        output = print_moves('b', number_of_moves, game_moves)
                                        print(output.rstrip(' '), end='')
                                        next_move = print_piece_move(board, piece, row, col, row-2, col, '0', 'b')
                                        print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                        return next_move
                                        sys.exit()
                                    elif bad_checkmate:
                                        current_score = -1000
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-2, col, 'p')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-2, col, 'p'))
                                board[row][col] = 'p'
                                board[row-2][col] = '0'
                                checkmate = False
                                checkmate2 = False
                                bad_checkmate = False
                                stalemate = False

                        elif direction == 2 and row > 0 and board[row-1][col] == '0':
                            print(indices_to_pos(row-1, col))
                            board[row][col] = '0'
                            board[row-1][col] = 'p'
                            if row-1 == 0:
                                board[row-1][col] = 'q'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                  bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col, 'p', '0') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col, 'p')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col, 'p'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col, '0', 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col, 'p'))
                            board[row][col] = 'p'
                            board[row-1][col] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 3 and row > 0 and col > 0 and board[row-1][col-1] in WHITE_PIECES:
                            captured_piece = board[row-1][col-1]
                            board[row][col] = '0'
                            board[row-1][col-1] = 'p'
                            if row-1 == 0:
                                board[row-1][col-1] = 'q'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col-1, 'p', captured_piece) == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col-1, 'p')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col-1, 'p'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col-1, captured_piece, 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col-1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col-1, 'p'))
                            board[row][col] = 'p'
                            board[row-1][col-1] = captured_piece
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 3 and row == 3 and col > 0 and board[row][col-1] == 'P' and en_passant == col-1:
                            board[row][col-1] = '0'
                            board[row][col] = '0'
                            board[row-1][col-1] = 'p'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col-1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col-1, 'en_passant_minus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col-1, 'en_passant_minus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col-1, 'P', 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col-1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col-1, 'p'))
                            board[row][col] = 'p'
                            board[row][col-1] = 'P'
                            board[row-1][col-1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 4 and row > 0 and col < 7 and board[row-1][col+1] in WHITE_PIECES:
                            captured_piece = board[row-1][col+1]
                            board[row][col] = '0'
                            board[row-1][col+1] = 'p'
                            if row-1 == 0:
                                board[row-1][col+1] = 'q'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col+1, 'p', captured_piece) == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col+1, 'p')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col+1, 'p'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col+1, captured_piece, 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col+1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col+1, 'p'))
                            board[row][col] = 'p'
                            board[row-1][col+1] = captured_piece
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 4 and row == 3 and col < 7 and board[row][col+1] == 'P' and en_passant == col+1:
                            board[row][col+1] = '0'
                            board[row][col] = '0'
                            board[row-1][col+1] = 'p'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col+1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col+1, 'en_passant_plus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col+1, 'en_passant_plus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col+1, 'P', 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col+1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col+1, 'p'))
                            board[row][col] = 'p'
                            board[row][col+1] = 'P'
                            board[row-1][col+1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False


                elif piece == 'n':
                    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                if board[new_row][new_col] in WHITE_PIECES:
                                  print('N' + 'x' + indices_to_pos(new_row, new_col))
                                else:
                                  print('N' + indices_to_pos(new_row, new_col))
                                board[row][col] = '0'
                                board[new_row][new_col] = 'n'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'n')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'n'))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                        if draw:
                                            current_score = -1.25
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                white_king_row, white_king_col = find_king(board, 'w')
                                                if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                    checkmate = True
                                                else:
                                                    stalemate = True
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                bad_checkmate = True
                                            if not checkmate and not bad_checkmate and not stalemate:
                                                if best_piece != 'P':
                                                  if board[target_row][target_col] in BLACK_PIECES:
                                                    print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                  else:
                                                    print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                else:
                                                  if board[target_row][target_col] in BLACK_PIECES:
                                                    print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                  else:
                                                    print(indices_to_pos(target_row, target_col))
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 7 and best_piece == 'P':
                                                    board[target_row][target_col] = 'Q'
                                                best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                if draw2:
                                                    current_score = -1.25
                                                    if current_score > previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, piece)]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, piece))
                                                else:
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'p':
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        if target_row2 == 0 and best_piece2 == 'p':
                                                            board[target_row2][target_col2] = 'q'
                                                        current_score = score(board, 'w')
                                                        for move in good_moves:
                                                            if (row, col, new_row, new_col, 'n', captured_piece) == move:
                                                                current_score += 0.5
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, 'n')]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, 'n'))
                                            elif checkmate:
                                                print_board(board)
                                                print('CHECKMATE! you lose')
                                                output = print_moves('b', number_of_moves, game_moves)
                                                print(output.rstrip(' '), end='')
                                                next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'b')
                                                print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                return next_move
                                                sys.exit()
                                            elif bad_checkmate:
                                                current_score = -1000
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'n')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'n'))
                                board[row][col] = 'n'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                checkmate2 = False
                                bad_checkmate = False
                                stalemate = False
                                position_history[pos_hash] -= 1


                elif piece == 'b':
                    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in WHITE_PIECES:
                                      print('B' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('B' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'b'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'b')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'b'))
                                    else:
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                            if draw:
                                                current_score = -1.25
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, row-2, col, 'p')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, row-2, col, 'p'))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    white_king_row, white_king_col = find_king(board, 'w')
                                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 7 and best_piece == 'P':
                                                        board[target_row][target_col] = 'Q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if draw2:
                                                        current_score = -1.25
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'p':
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 0 and best_piece2 == 'p':
                                                                board[target_row2][target_col2] = 'q'
                                                            current_score = score(board, 'w')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'b', captured_piece) == move:
                                                                    current_score += 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score > previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'b')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'b'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('b', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'b')
                                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = -1000
                                                    if current_score > previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'b')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'b'))
                                    board[row][col] = 'b'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'r':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in WHITE_PIECES:
                                      print('R' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('R' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'r'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'r')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'r'))
                                    else:
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                            if draw:
                                                current_score = -1.25
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, row-2, col, 'p')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, row-2, col, 'p'))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    white_king_row, white_king_col = find_king(board, 'w')
                                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 7 and best_piece == 'P':
                                                        board[target_row][target_col] = 'Q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if draw2:
                                                        current_score = -1.25
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'p':
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 0 and best_piece2 == 'p':
                                                                board[target_row2][target_col2] = 'q'
                                                            current_score = score(board, 'w')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'r', captured_piece) == move:
                                                                    current_score += 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score > previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'r')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'r'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('b', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'b')
                                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = -1000
                                                    if current_score > previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'r')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'r'))
                                    board[row][col] = 'r'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in WHITE_PIECES:
                                      print('Q' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('Q' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'q'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'q')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'q'))
                                    else:
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                            if draw:
                                                current_score = -1.25
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, row-2, col, 'p')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, row-2, col, 'p'))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    white_king_row, white_king_col = find_king(board, 'w')
                                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 7 and best_piece == 'P':
                                                        board[target_row][target_col] = 'Q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if draw2:
                                                        current_score = -1.25
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'p':
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in WHITE_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 0 and best_piece2 == 'p':
                                                                board[target_row2][target_col2] = 'q'
                                                            current_score = score(board, 'w')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'q', captured_piece) == move:
                                                                    current_score += 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score > previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'q')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'q'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('b', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'b')
                                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = -1000
                                                    if current_score > previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'q')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'q'))
                                    board[row][col] = 'q'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'k':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1), '0-0', '0-0-0']
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction not in {'0-0', '0-0-0'}:
                            new_row = row + direction[0]
                            new_col = col + direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in WHITE_PIECES:
                                      print('K' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('K' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'k'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'k')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'k'))
                                    else:
                                        black_king_row, black_king_col = find_king(board, 'b')
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                            if draw:
                                                current_score = -1.25
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, row-2, col, 'p')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, row-2, col, 'p'))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    white_king_row, white_king_col = find_king(board, 'w')
                                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 7 and best_piece == 'P':
                                                        board[target_row][target_col] = 'Q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if draw2:
                                                        current_score = -1.25
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'p':
                                                                if board[target_row2][target_col2] in WHITE_PIECES:
                                                                  print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                                else:
                                                                  print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                                if board[target_row2][target_col2] in WHITE_PIECES:
                                                                  print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                                else:
                                                                  print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 0 and best_piece2 == 'p':
                                                                board[target_row2][target_col2] = 'q'
                                                            current_score = score(board, 'w')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'k', captured_piece) == move:
                                                                    current_score += 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score > previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'k')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'k'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('b', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'b')
                                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = -1000
                                                    if current_score > previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'k')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'k'))
                                    board[row][col] = 'k'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    position_history[pos_hash] -= 1
                        else:
                            if direction == '0-0':
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    if board[7][4] == 'k' and board[7][7] == 'r' and king_move == 0 and board[7][5] == '0' and board[7][6] == '0':
                                        board[7][5] = 'k'
                                        board[7][4] = '0'
                                        black_king_row, black_king_col = find_king(board, 'b')
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            board[7][6] = 'k'
                                            board[7][5] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
                                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                print('0-0')
                                                board[7][7] = '0'
                                                board[7][5] = 'r'
                                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    checkmate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'p':
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        current_score = score(board, 'w')
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [('0-0')]
                                                        elif current_score == previous_score:
                                                            best_moves.append(('0-0'))
                                                        board[7][6] = '0'
                                                        board[7][4] = 'k'
                                                        board[7][6] = '0'
                                                        board[7][7] = 'r'
                                                        board[7][5] = '0'
                                                        checkmate = False
                                                        checkmate2 = False
                                                        black_king_row, black_king_col = find_king(board, 'b')
                                                elif checkmate:
                                                        print_board(board)
                                                        print('CHECKMATE! you lose')
                                                        output = print_moves('b', number_of_moves, game_moves)
                                                        print(output.rstrip(' '), end='')
                                                        next_move = '0-0'
                                                        print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                        return next_move
                                                        sys.exit()
                                            else:
                                                board[7][4] = 'k'
                                                board[7][6] = '0'
                                                black_king_row, black_king_col = find_king(board, 'b')
                                        else:
                                            board[7][4] = 'k'
                                            board[7][5] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')

                            elif direction == '0-0-0':
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    if board[7][4] == 'k' and board[7][0] == 'r' and king_move == 0 and board[7][1] == '0' and board[7][2] == '0' and board[7][3] == '0':
                                        board[7][3] = 'k'
                                        board[7][4] = '0'
                                        black_king_row, black_king_col = find_king(board, 'b')
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            board[7][2] = 'k'
                                            board[7][3] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
                                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                print('0-0-0')
                                                board[7][0] = '0'
                                                board[7][3] = 'r'
                                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    checkmate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate:
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'p':
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        current_score = score(board, 'w')
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score > previous_score:
                                                            previous_score = current_score
                                                            best_moves = [('0-0-0')]
                                                        elif current_score == previous_score:
                                                            best_moves.append(('0-0-0'))
                                                        board[7][4] = 'k'
                                                        board[7][2] = '0'
                                                        board[7][0] = 'r'
                                                        board[7][3] = '0'

                                                        checkmate = False
                                                        checkmate2 = False
                                                        black_king_row, black_king_col = find_king(board, 'b')
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('b', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = '0-0-0'
                                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                            else:
                                                board[7][4] = 'k'
                                                board[7][2] = '0'
                                                black_king_row, black_king_col = find_king(board, 'b')
                                        else:
                                            board[7][4] = 'k'
                                            board[7][3] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')

    if best_moves:
        best_move = random.choice(best_moves)
        if best_move != '0-0' and best_move != '0-0-0':
            best_row, best_col, target_row, target_col, best_piece = best_move
            if best_piece == 'en_passant_minus':
                board[target_row][target_col] = 'p'
                board[best_row][best_col] = '0'
                board[best_row][best_col-1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            elif best_piece == 'en_passant_plus':
                board[target_row][target_col] = 'p'
                board[best_row][best_col] = '0'
                board[best_row][best_col+1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            else:
                captured_piece = board[target_row][target_col]
                piece = board[target_row][target_col]
                board[best_row][best_col] = '0'
                board[target_row][target_col] = best_piece
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                if best_piece == 'k':
                    king_move = 1
                white_king_row, white_king_col = find_king(board, 'w')
                if best_piece == 'p' and target_row == 0:
                    board[target_row][target_col] = 'q'
                    if blind != 'y':
                        print_board(board)
                        print()
                        print(str(black_move_count+1) + '. ', end='')
                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                        if piece in WHITE_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                    else:
                        if piece in WHITE_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                    en_passant = 'false'
                else:
                    if is_protected_piece(board, target_row, target_col, best_piece):
                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            if piece in WHITE_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                        else:
                            if piece in WHITE_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col)
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col)
                              print(move_played)
                        en_passant = 'false'
                    else:
                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            if best_piece != 'p':
                                  if piece in WHITE_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                            else:
                                  if piece in WHITE_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                        else:
                            if best_piece != 'p':
                                  if piece in WHITE_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                                    print(move_played)
                            else:
                                  if piece in WHITE_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col)
                                    print(move_played)
                        if best_piece == 'p' and best_row == 6 and target_row == 4:
                            en_passant = best_col
                        else:
                            en_passant = 'false'
        if best_move == '0-0':
            en_passant = 'false'
            castled = True
            move_played = '0-0'
            king_move = 1
            board[7][4] = '0'
            board[7][7] = '0'
            board[7][6] = 'k'
            board[7][5] = 'r'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves+1) + '. ', end='')
            print('0-0')
        elif best_move == '0-0-0':
            en_passant = 'false'
            castled = True
            king_move = 1
            move_played = '0-0-0'
            board[7][4] = '0'
            board[7][0] = '0'
            board[7][2] = 'k'
            board[7][3] = 'r'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves+1) + '. ', end='')
            print('0-0-0')
        if blind != 'y':
            print(previous_score)
            print()
        game_moves.append(move_played)
        number_of_moves += 1
        output = print_moves('w', number_of_moves, game_moves)
        if blind != 'y':
            print(output)
        is_draw(board)
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            print('Draw by Repetition')
            sys.exit()
        fifty_move_rule += 1
        if best_move not in {'0-0-0', '0-0'}:
            if best_piece in {'p', 'en_passant_minus', 'en_passant_plus'} or 'x' in move_played:
                fifty_move_rule = 0
        if fifty_move_rule >= 50:
            print('Draw by 50-Move Rule')
            sys.exit()
        print('MP:', move_played)
        return move_played


def best_move_function(board, bots, en_passant):
    global scores
    global blind
    global king_move
    global number_of_moves
    global black_move_count
    global draws
    global wins
    global fifty_move_rule
    blind = 'false'
    black_king_row, black_king_col = find_king(board, 'b')
    checkmate = False
    checkmate2 = False
    bad_checkmate = False
    stalemate = False
    promotion = False
    good_left = False
    good_right = False
    tasks = []
    result_scores = {}
    result_lock = threading.Lock()
    previous_score = -6000
    rows = BOARD_ROWS
    cols = BOARD_COLS
    if board[0][0].lower() == 'r':
      start = True
    else:
      start = False
    opening_moves = ""
    move_number = 0
    if DEBUG_LOGS:
        print('GM:', game_moves)
    for number in range(len(game_moves) // 2):
        if move_number < len(game_moves):
            opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
            move_number += 1
            if move_number < len(game_moves):
                opening_moves += game_moves[move_number] + ' '
                move_number += 1
        else:
            break
    if DEBUG_LOGS:
        print('OM:', opening_moves)

    good_moves = [(6, 4, 4, 4, 'p', '0'), (6, 3, 4, 3, 'p', '0'), (7, 6, 5, 5, 'n', '0'), (7, 6, 5, 5, 'n', '0'), (5, 3, 1, 7, 'b', 'P'), (7, 5, 4, 2, 'b', '0'), (5, 5, 4, 3, 'n', 'P'), (4, 4, 3, 3, 'p', 'P')]
    openings = ['1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 dxc3 5. Nxc3 Bb4 6. Bc4 Nf6 7. e5 Ne4 8. Qd5',
                '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 dxc3 5. Nxc3 Bb4 6. Bc4 d6 7. Qb3 Bxc3+ 8. bxc3 Qe7 9. 0-0 Nf6 10. e5 Nxe5 11. Nxe5 dxe5 12. Ba3 c5 13. Bb5+ Bd7 14. Bxd7+ Qxd7 15. Bxc5 Ne4 16. Be3 0-0 17. Rfd1',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. 0-0 Nxe4 5. Re1 Nd6 6. Bf1 f6 7. d4 Nf7 8. dxe5 fxe5 9. Nc3',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. 0-0 Qf6 6. d4 exd4 7. Bg5 Qd6 8. Nxd4 Be7 9. Be3 Nf6 10. f3',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. 0-0 Nxe4 5. Re1 Nd6 6. Nxe5 Nxe5 7. Rxe5+ Be7 8. Bf1 0-0 9. d4 Bf6 10. Re1 Nf5 11. d5 d6 12. Nc3 h6 13. Ne4 Be5 14. c3 Bd7 15. a4 a5 16. Bd2 c6 17. dxc6 Bxc6 18. Bb5 Bxb5 19. axb5 Re8 20. Ng3 Nxg3 21. hxg3 Bf6 22. Qa4 Qd7 23. Rxe8+ Rxe8 24. Be3 Re5 25. Qxa5 Rxb5 26. Qa8+ Kh7 27. Qa4 Qf5 28. g4 Qe5 29. Ra2 Rd5 30. Qc2+ g6 31. Ra4 Qe6 32. Qb3 Bg5 33. Bxg5 b5 34. Ra7 hxg5 35. Kf1 Qe4 36. Rxf7+ Kh6 37. Re7 Qd3+ 38. Re2 b4 39. f3 Qd1+ 40. Qxd1 Rxd1+ 41. Re1 Rxe1+ 42. Kxe1 b3 43. Ke2 Kg7 44. Ke3 Kf6 45. Kd4 Ke6 46. Kc4 d5+ 47. Kxb3 Ke5 48. Kc2 d4 49. c4 Kd6 50. b4 Ke5 51. Kd3 Kf6  52. Kxd4 Kf7 53. b5 Ke6 54. Kc5 Ke7 55. b6 Ke6 56. b7',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Rc8 12. Kb1 Nc4 13. Bxc4 Rxc4 14. g4 Qa5 15. g5 Nh5 16. Nd5',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Qa5 12. Kb1 Rfc8 13. g4 b5 14. h4 b4 15. Nce2 Nc4 16. Bxc4 Rxc4 17. Bh6 Bxh6 18. Qxh6 Qe5 19. h5 g5 20. Nf5 Bxf5 21. Qxg5+ Bg6 22. Qxe5 dxe5 23. hxg6 fxg6 24. g5 Nh5 25. Rd7',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Qa5 12. Kb1 Rfc8 13. g4 b5 14. h4 b4 15. Nce2 Nc4 16. Bxc4 Rxc4 17. Bh6 Bxh6 18. Qxh6 Qe5 19. h5 g5 20. Nf5 Bxf5 21. Qxg5+ Bg6 22. Qxe5 dxe5 23. hxg6 hxg6 24. Nc1',
                '1. e4 c5 2. Nf3 Nc6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
                '1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 6. dxe6 Nc6 7. exf7+ Kxf7 8. Ne2 Bb4+ 9. Nbc3 Re8 10. Kf2',
                '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4 dxe5 6. fxe5 Nc6 7. Be3 Bf5 8. Nc3',
                '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 0-0 6. h3 a5 7. Bg5 h6 8. Be3 e5 9. d5 Na6 10. Qc1 Nc5 11. Bxc5 dxc5 12. Qe3 b6 13. a4 ',
                '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. Ne5',
                '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 Bxd4 10. Bxd4 Nxd4 11. Qxd4 Qb6 12. Nb5',
                '1. e4 f5 2. exf5 d5 3. Qh5+ g6 4. fxg6 Kd7 5. Qxd5+',
                '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6 7. Nf3',
                '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4.f4',
                '1. e4 f6 2. d4 g5 3. Qh5'
    ]
    if opening_moves != 'none':
        for opening in openings:
            normalized_opening = normalize_pgn(opening)
            normalized_input = normalize_pgn(opening_moves)
            if normalized_input in normalized_opening:
                to_play_list = extract_moves(opening)
                played_list = extract_moves(opening_moves)
                next_index = len(played_list)
                if next_index < len(to_play_list):
                    next_move = to_play_list[next_index]
                    if next_move in {'0-0', 'O-O'}:
                        previous_score = score(board, 'w')
                        result_scores[('0-0')] = previous_score
                    elif next_move in {'0-0-0', 'O-O-O'}:
                        previous_score = score(board, 'w')
                        result_scores[('0-0-0')] = previous_score
                    elif len(clean_move(next_move)) == 5:
                        piece, from_row, from_col, to_row, to_col = extract_long_algebraic(next_move)
                        pos = str(from_col) + str(from_row)
                        row, col = pos_to_indices(pos)
                        pos = str(to_col) + str(to_row)
                        target_row, target_col = pos_to_indices(pos)
                        previous_score = score(board, 'w')
                        result_scores[(row, col, target_row, target_col, piece.lower())] = previous_score
                    elif is_pawn_capture(next_move):
                        col, row = next_move[2], next_move[3]
                        from_col = pos_to_indices_col(next_move[0])
                        pos = str(col) + str(row)
                        to_row, to_col = pos_to_indices(pos)
                        previous_score = score(board, 'w')
                        result_scores[(to_row+1, from_col, to_row, to_col, 'p')] = previous_score
                    else:
                        next_move = clean_move(next_move)
                        piece, to_col, to_row = parse_move(next_move)
                        pos = str(to_col) + str(to_row)
                        row, col = pos_to_indices(pos)
                        from_row, from_col = convert_move(board, row, col, piece.lower(), 'b')
                        previous_score = score(board, 'w')
                        result_scores[(from_row, from_col, row, col, piece.lower())] = previous_score
    elif start:
        best_options = [(6, 4, 4, 4, 'p')]
        previous_score = score(board, 'b')
        result_scores[random.choice(best_options)] = previous_score

    if not result_scores:
        for row in rows:
            for col in cols:
                piece = board[row][col]
                if piece == 'p':
                    directions = [1, 2, 3, 4]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction == 1 and row == 6 and board[row-2][col] == '0' and board[row-1][col] == '0':
                            good_right = False
                            good_left = False
                            if col > 0:
                                if board[row-2][col-1] != 'P':
                                    good_left = True
                            else:
                                good_left = True
                            if col < 7:
                                if board[row-2][col+1] != 'P':
                                    good_right = True
                            else:
                                good_right = True
                            if good_right and good_left:
                                new_col = col
                                new_row = row-2
                                captured_piece = '0'
                                new_board = [r[:] for r in board]
                                key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                tasks.append(key_args)
                                #scores = evaluate_white(board, row, col, row-2, col, good_moves, scores, piece, black_king_row, black_king_col, '0', position_history)

                        elif direction == 2 and row > 0 and board[row-1][col] == '0':
                            new_col = col
                            new_row = row-1
                            captured_piece = '0'
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                            tasks.append(key_args)
                            #scores = evaluate_white(board, row, col, row-1, col, good_moves, scores, piece, black_king_row, black_king_col, '0', position_history)

                        elif direction == 3 and row > 0 and col > 0 and board[row-1][col-1] in WHITE_PIECES:
                            captured_piece = board[row-1][col-1]
                            new_col = col-1
                            new_row = row-1
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                            tasks.append(key_args)
                            #scores = evaluate_white(board, row, col, row-1, col-1, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)

                        elif direction == 3 and row == 3 and col > 0 and board[row][col-1] == 'P' and en_passant == col-1:
                            board[row][col-1] = '0'
                            board[row][col] = '0'
                            board[row-1][col-1] = 'p'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time2 = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col-1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col-1, 'en_passant_minus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col-1, 'en_passant_minus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col-1, 'P', 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col-1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col-1, 'p'))
                            board[row][col] = 'p'
                            board[row][col-1] = 'P'
                            board[row-1][col-1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 4 and row > 0 and col < 7 and board[row-1][col+1] in WHITE_PIECES:
                            captured_piece = board[row-1][col+1]
                            new_col = col+1
                            new_row = row-1
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                            tasks.append(key_args)
                            #scores = evaluate_white(board, row, col, row-1, col+1, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)

                        elif direction == 4 and row == 3 and col < 7 and board[row][col+1] == 'P' and en_passant == col+1:
                            board[row][col+1] = '0'
                            board[row][col] = '0'
                            board[row-1][col+1] = 'p'
                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time = best_move_player(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 7 and best_piece == 'P':
                                        board[target_row][target_col] = 'Q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2, score_time = best_move2(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'p':
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 0 and best_piece2 == 'p':
                                            board[target_row2][target_col2] = 'q'
                                        current_score = score(board, 'w')
                                        for move in good_moves:
                                            if (row, col, row-1, col+1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row-1, col+1, 'en_passant_plus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row-1, col+1, 'en_passant_plus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('b', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row-1, col+1, 'P', 'b')
                                    print(' ' + str(number_of_moves+1) + '. ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = -1000
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row-1, col+1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row-1, col+1, 'p'))
                            board[row][col] = 'p'
                            board[row][col+1] = 'P'
                            board[row-1][col+1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False


                elif piece == 'n':
                    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                new_board = [r[:] for r in board]
                                key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                tasks.append(key_args)
                                #scores = evaluate_white(board, row, col, new_row, new_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)


                elif piece == 'b':
                    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                    tasks.append(key_args)
                                    #scores = evaluate_white(board, row, col, new_row, new_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'r':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                    tasks.append(key_args)
                                    #scores = evaluate_white(board, row, col, new_row, new_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                    tasks.append(key_args)
                                    #scores = evaluate_white(board, row, col, new_row, new_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)

                                else:
                                    break
                                if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                    break
                            else:
                                break

                elif piece == 'k':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1), '0-0', '0-0-0']
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction not in {'0-0', '0-0-0'}:
                            new_row = row + direction[0]
                            new_col = col + direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                    captured_piece = board[new_row][new_col]
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, piece, black_king_row, black_king_col, captured_piece, position_history)
                                    tasks.append(key_args)
                                    #scores = evaluate_white(board, row, col, new_row, new_col, good_moves, scores, piece, black_king_row, black_king_col, captured_piece, position_history)
                        else:
                            if direction == '0-0':
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    if board[7][4] == 'k' and board[7][7] == 'r' and king_move == 0 and board[7][5] == '0' and board[7][6] == '0':
                                        board[7][5] = 'k'
                                        board[7][4] = '0'
                                        black_king_row, black_king_col = find_king(board, 'b')
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            board[7][6] = 'k'
                                            board[7][5] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
                                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                new_board = [r[:] for r in board]
                                                key_args = (new_board, None, None, None, None, good_moves, '0-0', black_king_row, black_king_col, None, position_history)
                                                tasks.append(key_args)
                                                board[7][6] = '0'
                                                board[7][4] = 'k'
                                                #scores = evaluate_white(board, 1, 1, 1, 1, good_moves, scores, '0-0', black_king_row, black_king_col, 1, position_history)
                                            else:
                                                board[7][4] = 'k'
                                                board[7][6] = '0'
                                                black_king_row, black_king_col = find_king(board, 'b')
                                        else:
                                            board[7][4] = 'k'
                                            board[7][5] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
                            elif direction == '0-0-0':
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    if board[7][4] == 'k' and board[7][0] == 'r' and king_move == 0 and board[7][1] == '0' and board[7][2] == '0' and board[7][3] == '0':
                                        board[7][3] = 'k'
                                        board[7][4] = '0'
                                        black_king_row, black_king_col = find_king(board, 'b')
                                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            board[7][2] = 'k'
                                            board[7][3] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
                                            if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                new_board = [r[:] for r in board]
                                                key_args = (new_board, None, None, None, None, good_moves, '0-0-0', black_king_row, black_king_col, None, position_history)
                                                tasks.append(key_args)
                                                board[7][2] = '0'
                                                board[7][4] = 'k'
                                                #scores = evaluate_white(board, 1, 1, 1, 1, good_moves, scores, '0-0-0', black_king_row, black_king_col, 1, position_history)
                                            else:
                                                board[7][4] = 'k'
                                                board[7][2] = '0'
                                                black_king_row, black_king_col = find_king(board, 'b')
                                        else:
                                            board[7][4] = 'k'
                                            board[7][3] = '0'
                                            black_king_row, black_king_col = find_king(board, 'b')
        # Multiprocessing inside a web request is usually a net loss on shared hosting
        # (process spawn + pickling). Default to sequential.
        if not ENABLE_MULTIPROCESSING:
            results = [evaluate_chunks(tasks)]
        else:
            # Optimize multiprocessing - only use if tasks are numerous enough to justify overhead
            cpu_count = os.cpu_count() or 4

            # For small task lists, process sequentially (multiprocessing overhead not worth it)
            if len(tasks) < max(2, cpu_count // 2):
                results = [evaluate_chunks(tasks)]
            else:
                # Efficient chunking: divide tasks evenly across processes
                chunk_size = max(1, len(tasks) // cpu_count)
                chunks = [tasks[i*chunk_size:(i+1)*chunk_size] for i in range(cpu_count)]
                # Handle remainder
                if len(tasks) % cpu_count:
                    chunks[-1].extend(tasks[cpu_count*chunk_size:])

                # Use context manager for automatic cleanup
                with Pool(processes=cpu_count) as pool:
                    results = pool.map(evaluate_chunks, chunks)

        result_scores = {}
        # Optimized: process results more efficiently
        for chunk_result in results:
            if chunk_result:
                for key, scoring in chunk_result:
                    if key:
                        result_scores[key] = scoring
    if result_scores:
        best_move = max(result_scores, key=result_scores.get)
        previous_score = max(result_scores.values())
        if best_move != '0-0' and best_move != '0-0-0':
            best_row, best_col, target_row, target_col, best_piece = best_move
            if best_piece == 'en_passant_minus':
                board[target_row][target_col] = 'p'
                board[best_row][best_col] = '0'
                board[best_row][best_col-1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            elif best_piece == 'en_passant_plus':
                board[target_row][target_col] = 'p'
                board[best_row][best_col] = '0'
                board[best_row][best_col+1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            else:
                captured_piece = board[target_row][target_col]
                piece = board[target_row][target_col]
                board[best_row][best_col] = '0'
                board[target_row][target_col] = best_piece
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(black_move_count+1) + '. ', end='')
                if best_piece == 'k':
                    king_move = 1
                white_king_row, white_king_col = find_king(board, 'w')
                if best_piece == 'p' and target_row == 0:
                    board[target_row][target_col] = 'q'
                    if blind != 'y':
                        print_board(board)
                        print()
                        print(str(black_move_count+1) + '. ', end='')
                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                        if piece in WHITE_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                    else:
                        if piece in WHITE_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                    en_passant = 'false'
                else:
                    if is_protected_piece(board, target_row, target_col, best_piece):
                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            if piece in WHITE_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                        else:
                            if piece in WHITE_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col)
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col)
                              print(move_played)
                        en_passant = 'false'
                    else:
                        if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            if best_piece != 'p':
                                  if piece in WHITE_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                            else:
                                  if piece in WHITE_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                        else:
                            if best_piece != 'p':
                                  if piece in WHITE_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                                    print(move_played)
                            else:
                                  if piece in WHITE_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col)
                                    print(move_played)
                        if best_piece == 'p' and best_row == 6 and target_row == 4:
                            en_passant = best_col
                        else:
                            en_passant = 'false'
        if best_move == '0-0':
            en_passant = 'false'
            castled = True
            move_played = '0-0'
            king_move = 1
            board[7][4] = '0'
            board[7][7] = '0'
            board[7][6] = 'k'
            board[7][5] = 'r'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves+1) + '. ', end='')
            print('0-0')
        elif best_move == '0-0-0':
            en_passant = 'false'
            castled = True
            king_move = 1
            move_played = '0-0-0'
            board[7][4] = '0'
            board[7][0] = '0'
            board[7][2] = 'k'
            board[7][3] = 'r'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves+1) + '. ', end='')
            print('0-0-0')
        if blind != 'y':
            print(previous_score)
            print()
        game_moves.append(move_played)
        number_of_moves += 1
        output = print_moves('w', number_of_moves, game_moves)
        if blind != 'y':
            print(output)
        is_draw(board)
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            print('Draw by Repetition')
            sys.exit()
        fifty_move_rule += 1
        if best_move not in {'0-0-0', '0-0'}:
            if best_piece in {'p', 'en_passant_minus', 'en_passant_plus'} or 'x' in move_played:
                fifty_move_rule = 0
        if fifty_move_rule >= 50:
            print('Draw by 50-Move Rule')
            sys.exit()
        print('MP:', move_played)
        return move_played


def best_move_player(board):
    white_king_row, white_king_col = find_king(board, 'w')
    checkmate = False
    promotion = False
    score_time = 0
    previous_score = 6000
    best_moves = []
    rows = BOARD_ROWS
    cols = BOARD_COLS

    for row in rows:
        row_data = board[row]
        for col in cols:
            piece = row_data[col]
            if piece == 'P':
                # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2) for better move ordering
                directions = [3, 4, 1, 2]
                for direction in directions:
                    if direction == 1 and row == 1 and board[row+2][col] == '0' and board[row+1][col] == '0':
                        board[row][col] = '0'
                        board[row+2][col] = 'P'
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                            score_time += score_time2
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 0 and best_piece == 'p':
                                    board[target_row][target_col] = 'q'
                                current_score = score(board, 'w')
                                score_time += 0
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row+2, col, 'P')]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row+2, col, 'P'))
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                            else:
                                board[row][col] = 'P'
                                board[row+2][col] = '0'
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False, score_time
                        board[row][col] = 'P'
                        board[row+2][col] = '0'
                        checkmate = False

                    elif direction == 2 and row < 7 and board[row+1][col] == '0':
                        board[row][col] = '0'
                        board[row+1][col] = 'P'
                        if row+1 == 7:
                            board[row+1][col] = 'Q'
                            promotion = True
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                            score_time += score_time2
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 0 and best_piece == 'p':
                                    board[target_row][target_col] = 'q'
                                current_score = score(board, 'w')
                                score_time += 0
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row+1, col, 'P')]
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row+1, col, 'P'))
                            else:
                                board[row][col] = 'P'
                                board[row+1][col] = '0'
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False, score_time
                        board[row][col] = 'P'
                        board[row+1][col] = '0'
                        checkmate = False

                    elif direction == 3 and row < 7 and col > 0 and board[row+1][col-1] in BLACK_PIECES:
                        captured_piece = board[row+1][col-1]
                        board[row][col] = '0'
                        board[row+1][col-1] = 'P'
                        if row+1 == 7:
                            board[row+1][col-1] = 'Q'
                            promotion = True
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                            score_time += score_time2
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 0 and best_piece == 'p':
                                    board[target_row][target_col] = 'q'
                                current_score = score(board, 'w')
                                score_time += 0
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row+1, col-1, 'P')]
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row+1, col-1, 'P'))
                            else:
                                board[row][col] = 'P'
                                board[row+1][col-1] = captured_piece
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False, score_time
                        board[row][col] = 'P'
                        board[row+1][col-1] = captured_piece
                        checkmate = False

                    elif direction == 4 and row > 0 and col < 7 and board[row+1][col+1] in BLACK_PIECES:
                        captured_piece = board[row+1][col+1]
                        board[row][col] = '0'
                        board[row+1][col+1] = 'P'
                        if row+1 == 7:
                            board[row+1][col+1] = 'Q'
                            promotion = True
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                            score_time += score_time2
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 0 and best_piece == 'p':
                                    board[target_row][target_col] = 'q'
                                current_score = score(board, 'w')
                                score_time += 0
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row+1, col+1, 'P')]
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row+1, col+1, 'P'))
                            else:
                                board[row][col] = 'P'
                                board[row+1][col+1] = captured_piece
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False, score_time
                        board[row][col] = 'P'
                        board[row+1][col+1] = captured_piece
                        checkmate = False

            elif piece == 'N':
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'N'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = 1.25
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                                    score_time += score_time2
                                    if draw:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, piece)]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, piece))
                                    else:
                                        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                            checkmate = True
                                            # debug removed
                                        if not checkmate:
                                            board[best_row][best_col] = '0'
                                            board[target_row][target_col] = best_piece
                                            if target_row == 0 and best_piece == 'p':
                                                board[target_row][target_col] = 'q'
                                            current_score = score(board, 'w')
                                            score_time += 0
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, 'N')]
                                                if best_piece != 'p':
                                                  if board[target_row][target_col] in WHITE_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in WHITE_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, 'N'))
                                        else:
                                            board[row][col] = 'N'
                                            board[new_row][new_col] = captured_piece
                                            checkmate = False
                                            return '2', '2', '2', '2', '2', '2', False, score_time
                            board[row][col] = 'N'
                            board[new_row][new_col] = captured_piece
                            checkmate = False
                            position_history[pos_hash] -= 1

            elif piece == 'B':
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'B'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                                        score_time += score_time2
                                        if draw:
                                            current_score = 1.25
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 0 and best_piece == 'p':
                                                    board[target_row][target_col] = 'q'
                                                current_score = score(board, 'w')
                                                score_time += 0
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'B')]
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'B'))
                                            else:
                                                board[row][col] = 'B'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False, score_time
                                board[row][col] = 'B'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1

                            else:
                                break
                            if board[new_row][new_col] == 'p' or board[new_row][new_col] == 'n' or board[new_row][new_col] == 'b' or board[new_row][new_col] == 'r' or board[new_row][new_col] == 'q':
                                break
                        else:
                            break

            elif piece == 'R':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'R'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                                        score_time += score_time2
                                        if draw:
                                            current_score = 1.25
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                if best_piece != 'p':
                                                  if board[target_row][target_col] in WHITE_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in WHITE_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 0 and best_piece == 'p':
                                                    board[target_row][target_col] = 'q'
                                                current_score = score(board, 'w')
                                                score_time += 0
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'R')]
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'R'))
                                            else:
                                                board[row][col] = 'R'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False, score_time
                                board[row][col] = 'R'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] == 'p' or board[new_row][new_col] == 'n' or board[new_row][new_col] == 'b' or board[new_row][new_col] == 'r' or board[new_row][new_col] == 'q':
                                break
                        else:
                            break

            elif piece == 'Q':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'Q'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                                        score_time += score_time2
                                        if draw:
                                            current_score = 1.25
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 0 and best_piece == 'p':
                                                    board[target_row][target_col] = 'q'
                                                current_score = score(board, 'w')
                                                score_time += 0
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'Q')]
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'Q'))
                                            else:
                                                board[row][col] = 'Q'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False, score_time
                                board[row][col] = 'Q'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] == 'p' or board[new_row][new_col] == 'n' or board[new_row][new_col] == 'b' or board[new_row][new_col] == 'r' or board[new_row][new_col] == 'q':
                                break
                        else:
                            break

            elif piece == 'K':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'K'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = 1.25
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                white_king_row, white_king_col = find_king(board, 'w')
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw, score_time2 = best_move2(board)
                                    score_time += score_time2
                                    if draw:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, piece)]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, piece))
                                    else:
                                        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                            checkmate = True
                                        if not checkmate:
                                            board[best_row][best_col] = '0'
                                            board[target_row][target_col] = best_piece
                                            if target_row == 0 and best_piece == 'p':
                                                board[target_row][target_col] = 'q'
                                            current_score = score(board, 'w')
                                            score_time += 0
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, 'K')]
                                                if best_piece != 'p':
                                                  if board[target_row][target_col] in WHITE_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in WHITE_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, 'K'))
                                        else:
                                            board[row][col] = 'K'
                                            board[new_row][new_col] = captured_piece
                                            checkmate = False
                                            white_king_row, white_king_col = find_king(board, 'w')
                                            return '2', '2', '2', '2', '2', '2', False, score_time
                            board[row][col] = 'K'
                            board[new_row][new_col] = captured_piece
                            checkmate = False
                            white_king_row, white_king_col = find_king(board, 'w')
                            position_history[pos_hash] -= 1

    if best_moves:
        best_move = random.choice(best_moves)
        best_row, best_col, target_row, target_col, best_piece = best_move
        captured_piece = board[target_row][target_col]
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            draw = True
        else:
            draw = False
        position_history[pos_hash] -= 1
        return best_row, best_col, target_row, target_col, best_piece, captured_piece, draw, score_time
    else:
        return '1', '1', '1', '1', '1', '1', False, score_time

def best_move2(board):
    black_king_row, black_king_col = find_king(board, 'b')
    promotion = False
    previous_score = -6000
    best_moves = []
    score_time = 0
    rows = BOARD_ROWS
    cols = BOARD_COLS

    for row in rows:
        row_data = board[row]
        for col in cols:
            piece = row_data[col]
            if piece == 'p':
                # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2) for better move ordering
                directions = [3, 4, 1, 2]
                for direction in directions:
                    if direction == 1 and row == 6 and board[row-2][col] == '0' and board[row-1][col] == '0':
                        board[row][col] = '0'
                        board[row-2][col] = 'p'
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            current_score = score(board, 'w')
                            score_time += 0
                            if current_score > previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row-2, col, 'p')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row-2, col, 'p'))
                        board[row][col] = 'p'
                        board[row-2][col] = '0'

                    elif direction == 2 and row < 7 and board[row-1][col] == '0':
                        board[row][col] = '0'
                        board[row-1][col] = 'p'
                        if row-1 == 0:
                            board[row-1][col] = 'q'
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            current_score = score(board, 'w')
                            score_time += 0
                            if current_score > previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row-1, col, 'p')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row-1, col, 'p'))
                        board[row][col] = 'p'
                        board[row-1][col] = '0'

                    elif direction == 3 and row < 7 and col > 0 and board[row-1][col-1] in WHITE_PIECES:
                        captured_piece = board[row-1][col-1]
                        board[row][col] = '0'
                        board[row-1][col-1] = 'p'
                        if row-1 == 0:
                            board[row-1][col-1] = 'q'
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            current_score = score(board, 'w')
                            score_time += 0
                            if current_score > previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row-1, col-1, 'p')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row-1, col-1, 'p'))
                        board[row][col] = 'p'
                        board[row-1][col-1] = captured_piece

                    elif direction == 4 and row > 0 and col < 7 and board[row-1][col+1] in WHITE_PIECES:
                        captured_piece = board[row-1][col+1]
                        board[row][col] = '0'
                        board[row-1][col+1] = 'p'
                        if row-1 == 0:
                            board[row-1][col+1] = 'q'
                            promotion = True
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            current_score = score(board, 'w')
                            score_time += 0
                            if current_score > previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row-1, col+1, 'p')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row-1, col+1, 'p'))
                        board[row][col] = 'p'
                        board[row-1][col+1] = captured_piece

            elif piece == 'n':
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'n'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = -1.25
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    current_score = score(board, 'w')
                                    score_time += 0
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'n')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'n'))
                            board[row][col] = 'n'
                            board[new_row][new_col] = captured_piece
                            position_history[pos_hash] -= 1


            elif piece == 'b':
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'b'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        current_score = score(board, 'w')
                                        score_time += 0
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'b')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'b'))
                                board[row][col] = 'b'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                break
                        else:
                            break

            elif piece == 'r':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'r'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        current_score = score(board, 'w')
                                        score_time += 0
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'r')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'r'))
                                board[row][col] = 'r'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                break
                        else:
                            break

            elif piece == 'q':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'q'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        current_score = score(board, 'w')
                                        score_time += 0
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'q')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'q'))
                                board[row][col] = 'q'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] == 'P' or board[new_row][new_col] == 'N' or board[new_row][new_col] == 'B' or board[new_row][new_col] == 'R' or board[new_row][new_col] == 'Q':
                                break
                        else:
                            break

            elif piece == 'k':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'k'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = -1.25
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                black_king_row, black_king_col = find_king(board, 'b')
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    current_score = score(board, 'w')
                                    score_time += 0
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'k')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'k'))
                            board[row][col] = 'k'
                            board[new_row][new_col] = captured_piece
                            black_king_row, black_king_col = find_king(board, 'b')
                            position_history[pos_hash] -= 1

    if best_moves:
        best_move = random.choice(best_moves)
        best_row2, best_col2, target_row2, target_col2, best_piece2 = best_move
        captured_piece2 = board[target_row2][target_col2]
        board[best_row2][best_col2] = '0'
        board[target_row2][target_col2] = best_piece2
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            draw = True
        else:
            draw = False
        position_history[pos_hash] -= 1
        return best_row2, best_col2, target_row2, target_col2, best_piece2, captured_piece2, draw, score_time
    else:
        return '1', '1', '1', '1', '1', '1', False, score_time

def best_move_black(board, bots, en_passant):
    global blind
    global draws
    global wins
    global king_move_white
    global number_of_moves
    global white_move_count
    global fifty_move_rule
    global position_history
    global game_moves
    blind = 'false'
    white_king_row, white_king_col = find_king(board, 'w')
    checkmate = False
    checkmate2 = False
    bad_checkmate = False
    stalemate = False
    promotion = False
    good_left = False
    good_right = False
    previous_score = 6000
    best_moves = []
    rows = BOARD_ROWS
    cols = BOARD_COLS
    good_moves = [(0, 1, 2, 2, 'N', '0')]
    opening_moves = ""
    move_number = 0
    repeat = (len(game_moves) // 2) + 1
    for number in range(repeat):
        if move_number < len(game_moves):
            opening_moves += str(number + 1) + '. ' + game_moves[move_number] + ' '
            move_number += 1
            if move_number < len(game_moves):
                opening_moves += game_moves[move_number] + ' '
                move_number += 1
        else:
            break
    openings = ['1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. c3 dxc3 5. Nxc3 Bb4 6. Bc4 d6 7. Qb3 Bxc3+ 8. bxc3 Qe7 9. 0-0 Nf6 10. e5 Nxe5 11. Nxe5 dxe5 12. Ba3 c5 13. Bb5+ Bd7 14. Bxd7+ Qxd7 15. Bxc5 Ne4 16. Be3 0-0 17. Rfd1 Qc6',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. 0-0 Qf6 6. d4 exd4 7. Bg5 Qd6 8. Nxd4 Be7 9. Be3 Nf6 10. f3 c5 11. Nb3 b6',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. 0-0 Nxe4 5. Re1 Nd6 6. Nxe5 Nxe5 7. Rxe5+ Be7 8. Bf1 0-0 9. d4 Bf6',
                '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 0-0 8. Qd2 Nc6 9. Bc4 Bd7 10. 0-0-0 Ne5 11. Bb3 Qa5 12. Kb1 Rfc8 13. g4 b5 14. h4 b4 15. Nce2 Nc4 16. Bxc4 Rxc4 17. Bh6 Bxh6 18. Qxh6 Qe5 19. h5 g5 20. Nf5 Bxf5 21. Qxg5+ Bg6 22. Qxe5 dxe5 23. hxg6 hxg6',
                '1. e4 c5 2. d4 cxd4 3. c3 dxc3 4. Nxc3 e6 5. Bc4 Nc6',
                '1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 6. dxe6 Nc6 7. exf7+ Kxf7 8. Be3 Bb4+ 9. Kf2 Re8 10. Nc3 Rxe3 11. Kxe3 Nxd4 12. Kf2 Bc5 13. Na4 Bc2 14. Nxc5 Bxd1',
                '1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 6. dxe6 Nc6 7. exf7+ Kxf7 8. Ne2 Bb4+',
                '1. e4 d5 2. exd5 Nf6 3. d4 Bg4 4. f3 Bf5 5. c4 e6 6. dxe6 Nc6 7. exf7+ Kxf7 8. Be3 Bb4+ 9. Kf2 Re8 10. Nc3 Rxe3 11. Kxe3 Nxd4 12. Qxd4 Qe7+ 13. Kf4 Nh5+ 14. Kxf5 Qe6+ 15. Kg5 Be7+ 16. Kxh5',
                '1. e4 d5 2. exd5 Nf6 3. c4 e6 4. dxe6 Bxe6 5. d4 Bb4+ 6. Bd2 Qe7',
                '1. e4 d5 2. exd5 Nf6 3. c4 e6 4. dxe6 Bxe6 5. d4 Bb4+ 6. Nc3 Ne4',
                '1. e4 d5 2. exd5 Nf6 3. Nc3 Nxd5 4. Bc4 c6 5. Qf3 e6',
                '1. e4 d5 2. exd5 Nf6 3. Bb5+ Nbd7 4. c4 a6 5. Ba4 b5',
                '1. e4 Nf6 2. e5 Nd5 3. d4 d6 4. c4 Nb6 5. f4 dxe5 6. fxe5 Nc6 7. Be3 Bf5 8. Nc3 e6 9. Nf3 Bb4 10. Be2 0-0',
                '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Be2 0-0 6. h3 a5 7. Bg5 h6 8. Be3 e5 9. d5 Na6 10. Qc1 Nc5 11. Bxc5 dxc5 12. Qe3 b6 13. a4 Ne8',
                '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. Nc3 b5 6. Bb3 Be7 7. a4 b4 8. Nd5 0-0 9. Nxf6+ Bxf6',
                '1. e4 e6 2. d4 d5 3. Nc3 Nf6 4. e5 Nfd7 5. f4 c5 6. Nf3 Nc6 7. Be3 cxd4 8. Nxd4 Bc5 9. Qd2 Bxd4 10. Bxd4 Nxd4 11. Qxd4 Qb6 12. Qd2 Qxb2 13. Rb1 Qa3 14. Nb5 Qxa2 15. Nd6+ Ke7 16. Rc1',
                '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5 5. Ng3 Bg6 6. h4 h6',
                '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Nxe4 8. Bxb4 Nxb4 9. Bxf7+ Kxf7 10. Qb3+ d5 11. Ne5+ Ke6 12. Qxb4 Qf8 13. Qxf8 Rxf8 14. f3 Nd6',
                '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4.f4 Bg7',
                '1. e4 d6 2. d4 Nf6 3. Nc3 g6 4.Nf3 Bg7 5. Bc4 0-0',
                '1. h4 Nc6 2. Rh3 d5 3. Rg3 Nf6 4. a4 Ne4 5. Rga3 e5 6. R3a2 Qxh4',
                '1. e3 f6 2. d4 g5',
                '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 5. Nf3 Nf6',
                '1. h3 a6 2. h4 a5 3. h5 b6 4. h6 Bb7 5. hxg7 Ra7',
                '1. g4 a6 2. g5 f5'
                ]
    # Build tasks for multiprocessing if no opening book move
    tasks = []
    result_scores = {}

    normalized_opening = normalize_pgn(opening_moves)
    if normalized_opening == '1. e4':
        best_options = [(1, 4, 3, 4, 'P'), (1, 2, 3, 2, 'P'), (1, 3, 3, 3, 'P'), (1, 4, 2, 4, 'P'), (1, 2, 2, 2, 'P')]
        best_option = random.choice(best_options)
        previous_score = score(board, 'b')
        result_scores[best_option] = previous_score
    elif opening_moves != 'none':
        # OPTIMIZATION: Fixed order - no shuffle needed for opening book
        for opening in openings:
            normalized_opening = normalize_pgn(opening)
            normalized_input = normalize_pgn(opening_moves)
            # Use prefix matching instead of substring matching to ensure correct position
            if normalized_opening.startswith(normalized_input):
                to_play_list = extract_moves(opening)
                played_list = extract_moves(opening_moves)
                next_index = len(played_list)
                if next_index < len(to_play_list):
                    next_move = to_play_list[next_index]
                    if next_move in {'0-0', 'O-O'}:
                        # Validate castling is legal before adding to result_scores
                        if board[0][4] == 'K' and board[0][7] == 'R' and king_move_white == 0:
                            if board[0][5] == '0' and board[0][6] == '0':
                                white_king_row, white_king_col = find_king(board, 'w')
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    previous_score = score(board, 'b')
                                    result_scores[('0-0')] = previous_score
                                    break  # Use first valid opening match
                    elif next_move in {'0-0-0', 'O-O-O'}:
                        # Validate castling is legal before adding to result_scores
                        if board[0][4] == 'K' and board[0][0] == 'R' and king_move_white == 0:
                            if board[0][1] == '0' and board[0][2] == '0' and board[0][3] == '0':
                                white_king_row, white_king_col = find_king(board, 'w')
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    previous_score = score(board, 'b')
                                    result_scores[('0-0-0')] = previous_score
                                    break  # Use first valid opening match
                    elif len(clean_move(next_move)) == 5:
                        try:
                            piece, from_row, from_col, to_row, to_col = extract_long_algebraic(next_move)
                            pos = str(from_col) + str(from_row)
                            row, col = pos_to_indices(pos)
                            pos = str(to_col) + str(to_row)
                            target_row, target_col = pos_to_indices(pos)
                            # Validate the move is legal: piece exists at source, destination is valid
                            if 0 <= row < 8 and 0 <= col < 8 and 0 <= target_row < 8 and 0 <= target_col < 8:
                                if board[row][col] == piece.upper():
                                    previous_score = score(board, 'b')
                                    result_scores[(row, col, target_row, target_col, piece)] = previous_score
                                    break  # Use first valid opening match
                        except (ValueError, IndexError):
                            pass  # Invalid move format, skip
                    elif is_pawn_capture(next_move) and len(next_move) >= 4:
                        try:
                            col, row = next_move[2], next_move[3]
                            from_col = pos_to_indices_col(next_move[0])
                            pos = str(col) + str(row)
                            to_row, to_col = pos_to_indices(pos)
                            # Validate the move is legal: pawn exists at source
                            if 0 <= to_row < 8 and 0 <= to_col < 8 and 0 <= from_col < 8:
                                if to_row > 0 and board[to_row-1][from_col] == 'P':
                                    previous_score = score(board, 'b')
                                    result_scores[(to_row-1, from_col, to_row, to_col, 'P')] = previous_score
                                    break  # Use first valid opening match
                        except (ValueError, IndexError):
                            pass  # Invalid move format, skip
                    else:
                        try:
                            next_move_clean = clean_move(next_move)
                            piece, to_col, to_row = parse_move(next_move_clean)
                            if piece and to_col and to_row:
                                pos = str(to_col) + str(to_row)
                                row, col = pos_to_indices(pos)
                                from_row, from_col = convert_move(board, row, col, piece.lower(), 'w')
                                # Validate the move is legal: piece exists at source
                                if from_row is not None and from_col is not None:
                                    if 0 <= from_row < 8 and 0 <= from_col < 8:
                                        if board[from_row][from_col] == piece.upper():
                                            previous_score = score(board, 'b')
                                            result_scores[(from_row, from_col, row, col, piece)] = previous_score
                                            break  # Use first valid opening match
                        except (ValueError, IndexError, TypeError):
                            pass  # Invalid move format, skip

    if not result_scores:
        # Quickly collect all legal move tasks for parallel evaluation
        for row in range(8):
            for col in range(8):
                piece = board[row][col]

                # White Pawns
                if piece == 'P':
                    # Two-square advance
                    if row == 1 and board[row+2][col] == '0' and board[row+1][col] == '0':
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, row+2, col, good_moves, 'P', white_king_row, white_king_col, '0', position_history)
                            tasks.append(key_args)
                    # One-square advance
                    if row < 7 and board[row+1][col] == '0':
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, row+1, col, good_moves, 'P', white_king_row, white_king_col, '0', position_history)
                            tasks.append(key_args)
                    # Captures
                    if row < 7 and col > 0 and board[row+1][col-1] in BLACK_PIECES:
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            captured_piece = board[row+1][col-1]
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, row+1, col-1, good_moves, 'P', white_king_row, white_king_col, captured_piece, position_history)
                            tasks.append(key_args)
                    if row < 7 and col < 7 and board[row+1][col+1] in BLACK_PIECES:
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            captured_piece = board[row+1][col+1]
                            new_board = [r[:] for r in board]
                            key_args = (new_board, row, col, row+1, col+1, good_moves, 'P', white_king_row, white_king_col, captured_piece, position_history)
                            tasks.append(key_args)

                # White Knights
                elif piece == 'N':
                    knight_moves = [
                        (row+2, col+1), (row+2, col-1), (row-2, col+1), (row-2, col-1),
                        (row+1, col+2), (row+1, col-2), (row-1, col+2), (row-1, col-2)
                    ]
                    for new_row, new_col in knight_moves:
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            target = board[new_row][new_col]
                            if target == '0' or target in BLACK_PIECES:
                                new_board = [r[:] for r in board]
                                key_args = (new_board, row, col, new_row, new_col, good_moves, 'N', white_king_row, white_king_col, target, position_history)
                                tasks.append(key_args)

                # White Bishops
                elif piece == 'B':
                    for dr, dc in [(1,1), (1,-1), (-1,1), (-1,-1)]:
                        for dist in range(1, 8):
                            new_row, new_col = row + dr*dist, col + dc*dist
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                target = board[new_row][new_col]
                                if target == '0':
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'B', white_king_row, white_king_col, '0', position_history)
                                    tasks.append(key_args)
                                elif target in BLACK_PIECES:
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'B', white_king_row, white_king_col, target, position_history)
                                    tasks.append(key_args)
                                    break
                                else:
                                    break
                            else:
                                break

                # White Rooks
                elif piece == 'R':
                    for dr, dc in [(1,0), (-1,0), (0,1), (0,-1)]:
                        for dist in range(1, 8):
                            new_row, new_col = row + dr*dist, col + dc*dist
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                target = board[new_row][new_col]
                                if target == '0':
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'R', white_king_row, white_king_col, '0', position_history)
                                    tasks.append(key_args)
                                elif target in BLACK_PIECES:
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'R', white_king_row, white_king_col, target, position_history)
                                    tasks.append(key_args)
                                    break
                                else:
                                    break
                            else:
                                break

                # White Queen
                elif piece == 'Q':
                    for dr, dc in [(1,0), (-1,0), (0,1), (0,-1), (1,1), (1,-1), (-1,1), (-1,-1)]:
                        for dist in range(1, 8):
                            new_row, new_col = row + dr*dist, col + dc*dist
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                target = board[new_row][new_col]
                                if target == '0':
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'Q', white_king_row, white_king_col, '0', position_history)
                                    tasks.append(key_args)
                                elif target in BLACK_PIECES:
                                    new_board = [r[:] for r in board]
                                    key_args = (new_board, row, col, new_row, new_col, good_moves, 'Q', white_king_row, white_king_col, target, position_history)
                                    tasks.append(key_args)
                                    break
                                else:
                                    break
                            else:
                                break

                # White King
                elif piece == 'K':
                    king_moves = [
                        (row+1, col), (row-1, col), (row, col+1), (row, col-1),
                        (row+1, col+1), (row+1, col-1), (row-1, col+1), (row-1, col-1)
                    ]
                    for new_row, new_col in king_moves:
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            target = board[new_row][new_col]
                            if target == '0' or target in BLACK_PIECES:
                                new_board = [r[:] for r in board]
                                key_args = (new_board, row, col, new_row, new_col, good_moves, 'K', white_king_row, white_king_col, target, position_history)
                                tasks.append(key_args)

        # Add castling moves if applicable
        # Kingside castling for white
        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
            if board[0][4] == 'K' and board[0][7] == 'R' and king_move_white == 0 and board[0][5] == '0' and board[0][6] == '0':
                new_board = [r[:] for r in board]
                key_args = (new_board, None, None, None, None, good_moves, '0-0', white_king_row, white_king_col, None, position_history)
                tasks.append(key_args)
            # Queenside castling for white
            if board[0][4] == 'K' and board[0][0] == 'R' and king_move_white == 0 and board[0][1] == '0' and board[0][2] == '0' and board[0][3] == '0':
                new_board = [r[:] for r in board]
                key_args = (new_board, None, None, None, None, good_moves, '0-0-0', white_king_row, white_king_col, None, position_history)
                tasks.append(key_args)

        # Multiprocessing inside a web request is usually a net loss on shared hosting
        # (process spawn + pickling). Default to sequential.
        if not ENABLE_MULTIPROCESSING:
            results = [evaluate_chunks_black(tasks)]
        else:
            # Optimize multiprocessing - only use if tasks are numerous enough to justify overhead
            cpu_count = os.cpu_count() or 4

            # For small task lists, process sequentially (multiprocessing overhead not worth it)
            if len(tasks) < max(2, cpu_count // 2):
                results = [evaluate_chunks_black(tasks)]
            else:
                # Efficient chunking: divide tasks evenly across processes
                chunk_size = max(1, len(tasks) // cpu_count)
                chunks = [tasks[i*chunk_size:(i+1)*chunk_size] for i in range(cpu_count)]
                # Handle remainder
                if len(tasks) % cpu_count:
                    chunks[-1].extend(tasks[cpu_count*chunk_size:])

                # Use context manager for automatic cleanup
                with Pool(processes=cpu_count) as pool:
                    results = pool.map(evaluate_chunks_black, chunks)

        result_scores = {}
        # Optimized: process results more efficiently
        for chunk_result in results:
            if chunk_result:
                for key, scoring in chunk_result:
                    if key:
                        result_scores[key] = scoring
    if result_scores:
        best_move = min(result_scores, key=result_scores.get)
        previous_score = min(result_scores.values())
        if best_move != '0-0' and best_move != '0-0-0':
            best_row, best_col, target_row, target_col, best_piece = best_move
    if not result_scores:
        for row in rows:
            for col in cols:
                piece = board[row][col]
                if piece == 'P':
                    directions = [1, 2, 3, 4]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction == 1 and row == 1 and board[row+2][col] == '0' and board[row+1][col] == '0':
                            good_right = False
                            good_left = False
                            if col > 0:
                                if board[row+2][col-1] != 'p':
                                    good_left = True
                            else:
                                good_left = True
                            if col < 7:
                                if board[row+2][col+1] != 'p':
                                    good_right = True
                            else:
                                good_right = True
                            if good_right and good_left:
                                print(indices_to_pos(row+2, col))
                                board[row][col] = '0'
                                board[row+2][col] = 'P'
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                    if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                        black_king_row, black_king_col = find_king(board, 'w')
                                        if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                            checkmate = True
                                        else:
                                            stalemate = True
                                    elif best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                        bad_checkmate = True
                                    if not checkmate and not bad_checkmate and not stalemate:
                                        if best_piece != 'p':
                                          if board[target_row][target_col] in WHITE_PIECES:
                                            print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                          else:
                                            print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                        else:
                                            if board[target_row][target_col] in WHITE_PIECES:
                                              print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                            else:
                                              print(indices_to_pos(target_row, target_col))
                                        board[best_row][best_col] = '0'
                                        board[target_row][target_col] = best_piece
                                        if target_row == 0 and best_piece == 'p':
                                            board[target_row][target_col] = 'q'
                                        best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                            checkmate2 = True
                                        if not checkmate2:
                                            if best_piece2 != 'P':
                                                if board[target_row2][target_col2] in BLACK_PIECES:
                                                  print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                else:
                                                  print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                            else:
                                                if board[target_row2][target_col2] in BLACK_PIECES:
                                                  print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                else:
                                                  print(indices_to_pos(target_row2, target_col2))
                                            board[best_row2][best_col2] = '0'
                                            board[target_row2][target_col2] = best_piece2
                                            if target_row2 == 7 and best_piece2 == 'P':
                                                board[target_row2][target_col2] = 'Q'
                                            current_score = score(board, 'b')
                                            for move in good_moves:
                                                if (row, col, row+2, col, 'P', '0') == move:
                                                    current_score -= 0.5
                                            print(current_score)
                                            print()
                                            board[best_row2][best_col2] = best_piece2
                                            board[target_row2][target_col2] = captured2
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, row+2, col, 'P')]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, row+2, col, 'P'))
                                    elif checkmate:
                                        print_board(board)
                                        print('CHECKMATE! you lose')
                                        output = print_moves('w', number_of_moves, game_moves)
                                        print(output.rstrip(' '), end='')
                                        next_move = print_piece_move(board, piece, row, col, row+2, col, '0', 'w')
                                        print(' ' + next_move + '#')
                                        return next_move
                                        sys.exit()
                                    elif bad_checkmate:
                                        current_score = 1000
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+2, col, 'P')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+2, col, 'P'))
                                board[row][col] = 'P'
                                board[row+2][col] = '0'
                                checkmate = False
                                checkmate2 = False
                                bad_checkmate = False
                                stalemate = False

                        elif direction == 2 and row < 7 and board[row+1][col] == '0':
                            print(indices_to_pos(row+1, col))
                            board[row][col] = '0'
                            board[row+1][col] = 'P'
                            if row+1 == 7:
                                board[row+1][col] = 'Q'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                  bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 0 and best_piece == 'p':
                                        board[target_row][target_col] = 'q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'P':
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 7 and best_piece2 == 'P':
                                            board[target_row2][target_col2] = 'Q'
                                        current_score = score(board, 'b')
                                        for move in good_moves:
                                            if (row, col, row+1, col, 'P', '0') == move:
                                                current_score -= 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+1, col, 'P')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+1, col, 'P'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('w', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row+1, col, '0', 'w')
                                    print(' ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = 1000
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row+1, col, 'P')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row+1, col, 'P'))
                            board[row][col] = 'P'
                            board[row+1][col] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 3 and row < 7 and col > 0 and board[row+1][col-1] in BLACK_PIECES:
                            captured_piece = board[row+1][col-1]
                            board[row][col] = '0'
                            board[row+1][col-1] = 'P'
                            if row+1 == 7:
                                board[row+1][col-1] = 'Q'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 0 and best_piece == 'p':
                                        board[target_row][target_col] = 'q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'P':
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 7 and best_piece2 == 'P':
                                            board[target_row2][target_col2] = 'Q'
                                        current_score = score(board, 'b')
                                        for move in good_moves:
                                            if (row, col, row+1, col-1, 'P', captured_piece) == move:
                                                current_score -= 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+1, col-1, 'P')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+1, col-1, 'P'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('w', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row+1, col-1, captured_piece, 'w')
                                    print(' ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = 1000
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row+1, col-1, 'P')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row+1, col-1, 'P'))
                            board[row][col] = 'P'
                            board[row+1][col-1] = captured_piece
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 3 and row == 4 and col > 0 and board[row][col-1] == 'p' and en_passant == col-1:
                            print('en_passant')
                            board[row][col-1] = '0'
                            board[row][col] = '0'
                            board[row+1][col-1] = 'P'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 0 and best_piece == 'p':
                                        board[target_row][target_col] = 'q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'P':
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 7 and best_piece2 == 'P':
                                            board[target_row2][target_col2] = 'Q'
                                        current_score = score(board, 'b')
                                        for move in good_moves:
                                            if (row, col, row+1, col-1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+1, col-1, 'en_passant_minus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+1, col-1, 'en_passant_minus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('w', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row+1, col-1, 'p', 'w')
                                    print(' ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = 1000
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row+1, col-1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row+1, col-1, 'p'))
                            board[row][col] = 'P'
                            board[row][col-1] = 'p'
                            board[row+1][col-1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 4 and row < 7 and col < 7 and board[row+1][col+1] in BLACK_PIECES:
                            captured_piece = board[row+1][col+1]
                            board[row][col] = '0'
                            board[row+1][col+1] = 'P'
                            if row+1 == 7:
                                board[row+1][col+1] = 'Q'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 0 and best_piece == 'p':
                                        board[target_row][target_col] = 'q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'P':
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 7 and best_piece2 == 'P':
                                            board[target_row2][target_col2] = 'Q'
                                        current_score = score(board, 'b')
                                        for move in good_moves:
                                            if (row, col, row+1, col+1, 'P', captured_piece) == move:
                                                current_score -= 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+1, col+1, 'P')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+1, col+1, 'P'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('w', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row+1, col+1, captured_piece, 'w')
                                    print(' ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = 1000
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row+1, col+1, 'P')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row+1, col+1, 'P'))
                            board[row][col] = 'P'
                            board[row+1][col+1] = captured_piece
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False

                        elif direction == 4 and row == 4 and col < 7 and board[row][col+1] == 'p' and en_passant == col+1:
                            print('en_passant')
                            board[row][col+1] = '0'
                            board[row][col] = '0'
                            board[row+1][col+1] = 'P'
                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                    black_king_row, black_king_col = find_king(board, 'b')
                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        checkmate = True
                                    else:
                                        stalemate = True
                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                    bad_checkmate = True
                                if not checkmate and not bad_checkmate and not stalemate:
                                    if best_piece != 'p':
                                      if board[target_row][target_col] in WHITE_PIECES:
                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                      else:
                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                    else:
                                        if board[target_row][target_col] in WHITE_PIECES:
                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                        else:
                                          print(indices_to_pos(target_row, target_col))
                                    board[best_row][best_col] = '0'
                                    board[target_row][target_col] = best_piece
                                    if target_row == 0 and best_piece == 'p':
                                        board[target_row][target_col] = 'q'
                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                        checkmate2 = True
                                    if not checkmate2:
                                        if best_piece2 != 'P':
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                        else:
                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                            else:
                                              print(indices_to_pos(target_row2, target_col2))
                                        board[best_row2][best_col2] = '0'
                                        board[target_row2][target_col2] = best_piece2
                                        if target_row2 == 7 and best_piece2 == 'P':
                                            board[target_row2][target_col2] = 'Q'
                                        current_score = score(board, 'b')
                                        for move in good_moves:
                                            if (row, col, row+1, col+1, 'p', 'P') == move:
                                                current_score += 0.5
                                        print(current_score)
                                        print()
                                        board[best_row2][best_col2] = best_piece2
                                        board[target_row2][target_col2] = captured2
                                        board[best_row][best_col] = best_piece
                                        board[target_row][target_col] = captured
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, row+1, col+1, 'en_passant_plus')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, row+1, col+1, 'en_passant_plus'))
                                elif checkmate:
                                    print_board(board)
                                    print('CHECKMATE! you lose')
                                    output = print_moves('w', number_of_moves, game_moves)
                                    print(output.rstrip(' '), end='')
                                    next_move = print_piece_move(board, piece, row, col, row+1, col+1, 'p', 'w')
                                    print(' ' + next_move + '#')
                                    return next_move
                                    sys.exit()
                                elif bad_checkmate:
                                    current_score = 1000
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, row+1, col+1, 'p')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, row+1, col+1, 'p'))
                            board[row][col] = 'P'
                            board[row][col+1] = 'p'
                            board[row+1][col+1] = '0'
                            checkmate = False
                            checkmate2 = False
                            bad_checkmate = False
                            stalemate = False


                elif piece == 'N':
                    directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        new_row = row + direction[0]
                        new_col = col + direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                if board[new_row][new_col] in BLACK_PIECES:
                                  print('N' + 'x' + indices_to_pos(new_row, new_col))
                                else:
                                  print('N' + indices_to_pos(new_row, new_col))
                                board[row][col] = '0'
                                board[new_row][new_col] = 'N'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'N')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'N'))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                        if draw:
                                            current_score = 1.25
                                            if current_score < previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                black_king_row, black_king_col = find_king(board, 'b')
                                                if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                    checkmate = True
                                                else:
                                                    stalemate = True
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                bad_checkmate = True
                                            if not checkmate and not bad_checkmate and not stalemate:
                                                if best_piece != 'p':
                                                  if board[target_row][target_col] in WHITE_PIECES:
                                                    print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                  else:
                                                    print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                else:
                                                  if board[target_row][target_col] in WHITE_PIECES:
                                                    print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                  else:
                                                    print(indices_to_pos(target_row, target_col))
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 0 and best_piece == 'p':
                                                    board[target_row][target_col] = 'q'
                                                best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                if draw2:
                                                    current_score = 1.25
                                                    if current_score < previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, piece)]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, piece))
                                                else:
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'P':
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        if target_row2 == 7 and best_piece2 == 'P':
                                                            board[target_row2][target_col2] = 'Q'
                                                        current_score = score(board, 'b')
                                                        for move in good_moves:
                                                            if (row, col, new_row, new_col, 'N', captured_piece) == move:
                                                                current_score -= 0.5
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, 'N')]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, 'N'))
                                            elif checkmate:
                                                print_board(board)
                                                print('CHECKMATE! you lose')
                                                output = print_moves('w', number_of_moves, game_moves)
                                                print(output.rstrip(' '), end='')
                                                next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'w')
                                                print(' ' + next_move + '#')
                                                return next_move
                                                sys.exit()
                                            elif bad_checkmate:
                                                current_score = 1000
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'N')]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'N'))
                                board[row][col] = 'N'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                checkmate2 = False
                                bad_checkmate = False
                                stalemate = False
                                position_history[pos_hash] -= 1

                elif piece == 'B':
                    directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in BLACK_PIECES:
                                      print('B' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('B' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'B'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'B')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'B'))
                                    else:
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                            if draw:
                                                current_score = 1.25
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, piece)]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, piece))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    black_king_row, black_king_col = find_king(board, 'b')
                                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 0 and best_piece == 'p':
                                                        board[target_row][target_col] = 'q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if draw2:
                                                        current_score = 1.25
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'P':
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 7 and best_piece2 == 'P':
                                                                board[target_row2][target_col2] = 'Q'
                                                            current_score = score(board, 'b')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'B', captured_piece) == move:
                                                                    current_score -= 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score < previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'B')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'B'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('w', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'w')
                                                    print(' ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = 1000
                                                    if current_score < previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'B')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'B'))
                                    board[row][col] = 'B'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'R':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in BLACK_PIECES:
                                      print('R' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('R' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'R'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'R')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'R'))
                                    else:
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                            if draw:
                                                current_score = 1.25
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, piece)]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, piece))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    black_king_row, black_king_col = find_king(board, 'b')
                                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 0 and best_piece == 'p':
                                                        board[target_row][target_col] = 'q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if draw2:
                                                        current_score = 1.25
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'P':
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 7 and best_piece2 == 'P':
                                                                board[target_row2][target_col2] = 'Q'
                                                            current_score = score(board, 'b')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'R', captured_piece) == move:
                                                                    current_score -= 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score < previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'R')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'R'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('w', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'w')
                                                    print(' ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = 1000
                                                    if current_score < previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'R')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'R'))
                                    board[row][col] = 'R'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'Q':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        for i in range(1, 8):
                            new_row = row + i * direction[0]
                            new_col = col + i * direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in BLACK_PIECES:
                                      print('Q' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('Q' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'Q'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'Q')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'Q'))
                                    else:
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                            if draw:
                                                current_score = 1.25
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, piece)]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, piece))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    black_king_row, black_king_col = find_king(board, 'b')
                                                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 0 and best_piece == 'p':
                                                        board[target_row][target_col] = 'q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if draw2:
                                                        current_score = 1.25
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'P':
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              if board[target_row2][target_col2] in BLACK_PIECES:
                                                                print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                              else:
                                                                print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 7 and best_piece2 == 'P':
                                                                board[target_row2][target_col2] = 'Q'
                                                            current_score = score(board, 'b')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'Q', captured_piece) == move:
                                                                    current_score -= 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score < previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'Q')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'Q'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('w', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'w')
                                                    print(' ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = 1000
                                                    if current_score < previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'Q')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'Q'))
                                    board[row][col] = 'Q'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    position_history[pos_hash] -= 1

                                else:
                                    break
                                if board[new_row][new_col] in BLACK_PIECES:
                                    break
                            else:
                                break

                elif piece == 'K':
                    directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1), '0-0', '0-0-0']
                    # OPTIMIZATION: Fixed order - no shuffle needed
                    for direction in directions:
                        if direction not in {'0-0', '0-0-0'}:
                            new_row = row + direction[0]
                            new_col = col + direction[1]
                            if 0 <= new_row < 8 and 0 <= new_col < 8:
                                if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                    captured_piece = board[new_row][new_col]
                                    if board[new_row][new_col] in BLACK_PIECES:
                                      print('K' + 'x' + indices_to_pos(new_row, new_col))
                                    else:
                                      print('K' + indices_to_pos(new_row, new_col))
                                    board[row][col] = '0'
                                    board[new_row][new_col] = 'K'
                                    # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                    pos_hash = tuple(tuple(row) for row in board)
                                    position_history[pos_hash] += 1
                                    if position_history[pos_hash] >= 3:
                                        current_score = 1.25
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'K')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'K'))
                                    else:
                                        white_king_row, white_king_col = find_king(board, 'w')
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                            if draw:
                                                current_score = 1.25
                                                if current_score < previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, piece)]
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, piece))
                                            else:
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    black_king_row, black_king_col = find_king(board, 'b')
                                                    if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                        checkmate = True
                                                    else:
                                                        stalemate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate and not stalemate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    if target_row == 0 and best_piece == 'p':
                                                        board[target_row][target_col] = 'q'
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if draw2:
                                                        current_score = 1.25
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [(row, col, new_row, new_col, piece)]
                                                        elif current_score == previous_score:
                                                            best_moves.append((row, col, new_row, new_col, piece))
                                                    else:
                                                        if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                            checkmate2 = True
                                                        if not checkmate2:
                                                            if best_piece2 != 'P':
                                                                if board[target_row2][target_col2] in BLACK_PIECES:
                                                                  print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                                else:
                                                                  print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                                if board[target_row2][target_col2] in BLACK_PIECES:
                                                                  print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                                else:
                                                                  print(indices_to_pos(target_row2, target_col2))
                                                            board[best_row2][best_col2] = '0'
                                                            board[target_row2][target_col2] = best_piece2
                                                            if target_row2 == 7 and best_piece2 == 'P':
                                                                board[target_row2][target_col2] = 'Q'
                                                            current_score = score(board, 'b')
                                                            for move in good_moves:
                                                                if (row, col, new_row, new_col, 'K', captured_piece) == move:
                                                                    current_score -= 0.5
                                                            print(current_score)
                                                            print()
                                                            board[best_row2][best_col2] = best_piece2
                                                            board[target_row2][target_col2] = captured2
                                                            board[best_row][best_col] = best_piece
                                                            board[target_row][target_col] = captured
                                                            if current_score < previous_score:
                                                                previous_score = current_score
                                                                best_moves = [(row, col, new_row, new_col, 'K')]
                                                            elif current_score == previous_score:
                                                                best_moves.append((row, col, new_row, new_col, 'K'))
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('w', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    next_move = print_piece_move(board, piece, row, col, new_row, new_col, captured_piece, 'w')
                                                    print(' ' + next_move + '#')
                                                    return next_move
                                                    sys.exit()
                                                elif bad_checkmate:
                                                    current_score = 1000
                                                    if current_score < previous_score:
                                                        previous_score = current_score
                                                        best_moves = [(row, col, new_row, new_col, 'K')]
                                                    elif current_score == previous_score:
                                                        best_moves.append((row, col, new_row, new_col, 'K'))
                                    board[row][col] = 'K'
                                    board[new_row][new_col] = captured_piece
                                    checkmate = False
                                    checkmate2 = False
                                    bad_checkmate = False
                                    stalemate = False
                                    white_king_row, white_king_col = find_king(board, 'w')
                                    position_history[pos_hash] -= 1
                        else:
                            if direction == '0-0':
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    if board[0][4] == 'K' and board[0][7] == 'R' and king_move_white == 0 and board[0][5] == '0' and board[0][6] == '0':
                                        board[0][5] = 'K'
                                        board[0][4] = '0'
                                        white_king_row, white_king_col = find_king(board, 'w')
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            board[0][6] = 'K'
                                            board[0][5] = '0'
                                            white_king_row, white_king_col = find_king(board, 'w')
                                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                print('0-0')
                                                board[0][7] = '0'
                                                board[0][5] = 'R'
                                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    checkmate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'P':
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        current_score = score(board, 'b')
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [('0-0')]
                                                        elif current_score == previous_score:
                                                            best_moves.append(('0-0'))
                                                        board[0][6] = '0'
                                                        board[0][4] = 'K'
                                                        board[0][6] = '0'
                                                        board[0][7] = 'R'
                                                        board[0][5] = '0'
                                                        checkmate = False
                                                        checkmate2 = False
                                                        black_king_row, black_king_col = find_king(board, 'b')
                                                elif checkmate:
                                                        print_board(board)
                                                        print('CHECKMATE! you lose')
                                                        output = print_moves('w', number_of_moves, game_moves)
                                                        print(output.rstrip(' '), end='')
                                                        print(' 0-0' + '#')
                                                        return next_move
                                                        sys.exit()
                                            else:
                                                board[0][4] = 'K'
                                                board[0][6] = '0'
                                                white_king_row, white_king_col = find_king(board, 'w')
                                        else:
                                            board[0][4] = 'K'
                                            board[0][5] = '0'
                                            white_king_row, white_king_col = find_king(board, 'w')

                            elif direction == '0-0-0':
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    if board[0][4] == 'K' and board[0][0] == 'R' and king_move_white == 0 and board[0][1] == '0' and board[0][2] == '0' and board[0][3] == '0':
                                        board[0][3] = 'K'
                                        board[0][4] = '0'
                                        white_king_row, white_king_col = find_king(board, 'w')
                                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                            board[0][2] = 'K'
                                            board[0][3] = '0'
                                            white_king_row, white_king_col = find_king(board, 'w')
                                            if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                                print('0-0-0')
                                                board[0][0] = '0'
                                                board[0][3] = 'R'
                                                best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move_player_black(board)
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                    checkmate = True
                                                if best_row == best_col == target_row == target_col == best_piece == captured == '2':
                                                    bad_checkmate = True
                                                if not checkmate and not bad_checkmate:
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in WHITE_PIECES:
                                                        print(best_piece.upper() + 'x' + indices_to_pos(target_row, target_col))
                                                      else:
                                                        print(best_piece.upper() + indices_to_pos(target_row, target_col))
                                                    else:
                                                        if board[target_row][target_col] in WHITE_PIECES:
                                                          print(indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col))
                                                        else:
                                                          print(indices_to_pos(target_row, target_col))
                                                    board[best_row][best_col] = '0'
                                                    board[target_row][target_col] = best_piece
                                                    best_row2, best_col2, target_row2, target_col2, best_piece2, captured2, draw2 = best_move2_black(board)
                                                    if best_row2 == best_col2 == target_row2 == target_col2 == best_piece2 == captured2 == '1':
                                                        checkmate2 = True
                                                    if not checkmate2:
                                                        if best_piece2 != 'P':
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(best_piece2.upper() + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(best_piece2.upper() + indices_to_pos(target_row2, target_col2))
                                                        else:
                                                            if board[target_row2][target_col2] in BLACK_PIECES:
                                                              print(indices_to_pos_col(best_col2) + 'x' + indices_to_pos(target_row2, target_col2))
                                                            else:
                                                              print(indices_to_pos(target_row2, target_col2))
                                                        board[best_row2][best_col2] = '0'
                                                        board[target_row2][target_col2] = best_piece2
                                                        current_score = score(board, 'b')
                                                        print(current_score)
                                                        print()
                                                        board[best_row2][best_col2] = best_piece2
                                                        board[target_row2][target_col2] = captured2
                                                        board[best_row][best_col] = best_piece
                                                        board[target_row][target_col] = captured
                                                        if current_score < previous_score:
                                                            previous_score = current_score
                                                            best_moves = [('0-0-0')]
                                                        elif current_score == previous_score:
                                                            best_moves.append(('0-0-0'))
                                                        board[0][4] = 'K'
                                                        board[0][2] = '0'
                                                        board[0][0] = 'R'
                                                        board[0][3] = '0'

                                                        checkmate = False
                                                        checkmate2 = False
                                                        white_king_row, white_king_col = find_king(board, 'b')
                                                elif checkmate:
                                                    print_board(board)
                                                    print('CHECKMATE! you lose')
                                                    output = print_moves('w', number_of_moves, game_moves)
                                                    print(output.rstrip(' '), end='')
                                                    print(' 0-0-0' + '#')
                                                    return next_move
                                                    sys.exit()
                                            else:
                                                board[0][4] = 'K'
                                                board[0][2] = '0'
                                                white_king_row, white_king_col = find_king(board, 'w')
                                        else:
                                            board[0][4] = 'K'
                                            board[0][3] = '0'
                                            white_king_row, white_king_col = find_king(board, 'w')

    move_played = None  # Initialize move_played
    best_move = None  # Initialize best_move
    if result_scores:
        best_move = min(result_scores, key=result_scores.get)
        previous_score = min(result_scores.values())
        if best_move != '0-0' and best_move != '0-0-0':
            best_row, best_col, target_row, target_col, best_piece = best_move
            if best_piece == 'en_passant_minus':
                en_passant = 'false'
                board[target_row][target_col] = 'P'
                board[best_row][best_col] = '0'
                board[best_row][best_col-1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(white_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            elif best_piece == 'en_passant_plus':
                en_passant = 'false'
                board[target_row][target_col] = 'P'
                board[best_row][best_col] = '0'
                board[best_row][best_col+1] = '0'
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(white_move_count+1) + '. ', end='')
                move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                print(move_played)
            else:
                captured_piece = board[target_row][target_col]
                piece = board[target_row][target_col]
                board[best_row][best_col] = '0'
                board[target_row][target_col] = best_piece
                if blind != 'y':
                    print_board(board)
                    print()
                    print(str(white_move_count+1) + '. ', end='')
                if best_piece == 'K':
                    king_move_white = 1
                black_king_row, black_king_col = find_king(board, 'b')
                if best_piece == 'P' and target_row == 7:
                    board[target_row][target_col] = 'Q'
                    if blind != 'y':
                        print_board(board)
                        print()
                        print(str(white_move_count+1) + '. ', end='')
                    if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                        if piece in BLACK_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q' + '+'
                            print(move_played)
                    else:
                        if piece in BLACK_PIECES:
                            move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                        else:
                            move_played = indices_to_pos(target_row, target_col) + '=Q'
                            print(move_played)
                    en_passant = 'false'
                else:
                    if is_protected_piece(board, target_row, target_col, best_piece):
                        if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            if piece in BLACK_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col) + '+'
                              print(move_played)
                        else:
                            if piece in BLACK_PIECES:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + 'x' + indices_to_pos(target_row, target_col)
                              print(move_played)
                            else:
                              move_played = best_piece.upper() + indices_to_pos(best_row, best_col) + indices_to_pos(target_row, target_col)
                              print(move_played)
                        en_passant = 'false'
                    else:
                        if is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            if best_piece != 'P':
                                  if piece in BLACK_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                            else:
                                  if piece in BLACK_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col) + '+'
                                    print(move_played)
                        else:
                            if best_piece != 'P':
                                  if piece in BLACK_PIECES:
                                    move_played = best_piece.upper() + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = best_piece.upper() + indices_to_pos(target_row, target_col)
                                    print(move_played)
                            else:
                                  if piece in BLACK_PIECES:
                                    move_played = indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col)
                                    print(move_played)
                                  else:
                                    move_played = indices_to_pos(target_row, target_col)
                                    print(move_played)
                        if best_piece == 'P' and best_row == 1 and target_row == 3:
                            en_passant = best_col
                        else:
                            en_passant = 'false'
        if best_move == '0-0':
            en_passant = 'false'
            castled_white = True
            move_played = '0-0'
            king_move_white = 1
            board[0][4] = '0'
            board[0][7] = '0'
            board[0][6] = 'K'
            board[0][5] = 'R'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves) + '...', end='')
            print('0-0')
        elif best_move == '0-0-0':
            en_passant = 'false'
            castled_white = True
            king_move_white = 1
            move_played = '0-0-0'
            board[0][4] = '0'
            board[0][0] = '0'
            board[0][2] = 'K'
            board[0][3] = 'R'
            if blind != 'y':
                print_board(board)
                print()
                print(str(number_of_moves) + '...', end='')
            print('0-0-0')
        if blind != 'y':
            print(previous_score)
            print()
        game_moves.append(move_played)
        number_of_moves += 1
        white_move_count += 1  # Increment white's move count
        output = print_moves('b', number_of_moves, game_moves)
        if blind != 'y':
            print(output)
        is_draw(board)
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            print('Draw by Repetition')
            sys.exit()
        if best_move and best_move not in {'0-0-0', '0-0'}:
            if best_piece in {'P', 'en_passant_minus', 'en_passant_plus'} or (move_played and 'x' in move_played):
                fifty_move_rule = 0
        if move_played is None:
            # This should never happen, but provides a fallback
            print("ERROR: move_played was None in best_move_black")
            return None
        return move_played

def best_move_player_black(board):
    black_king_row, black_king_col = find_king(board, 'b')
    checkmate = False
    promotion = False
    previous_score = -6000
    best_moves = []
    rows = BOARD_ROWS
    cols = BOARD_COLS

    for row in rows:
        row_data = board[row]
        for col in cols:
            piece = row_data[col]
            if piece == 'p':
                # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2) for better move ordering
                directions = [3, 4, 1, 2]
                for direction in directions:
                    if direction == 1 and row == 7 and board[row-2][col] == '0' and board[row-1][col] == '0':
                        board[row][col] = '0'
                        board[row-2][col] = 'p'
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 7 and best_piece == 'P':
                                    board[target_row][target_col] = 'Q'
                                current_score = score(board, 'b')
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row-2, col, 'p')]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row-2, col, 'p'))
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                            else:
                                board[row][col] = 'p'
                                board[row-2][col] = '0'
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False
                        board[row][col] = 'p'
                        board[row-2][col] = '0'
                        checkmate = False

                    elif direction == 2 and row > 0 and board[row-1][col] == '0':
                        board[row][col] = '0'
                        board[row-1][col] = 'p'
                        if row-1 == 0:
                            board[row-1][col] = 'q'
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 7 and best_piece == 'P':
                                    board[target_row][target_col] = 'Q'
                                current_score = score(board, 'b')
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row-1, col, 'p')]
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row-1, col, 'p'))
                            else:
                                board[row][col] = 'p'
                                board[row-1][col] = '0'
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False
                        board[row][col] = 'p'
                        board[row-1][col] = '0'
                        checkmate = False

                    elif direction == 3 and row > 0 and col > 0 and board[row-1][col-1] in WHITE_PIECES:
                        captured_piece = board[row-1][col-1]
                        board[row][col] = '0'
                        board[row-1][col-1] = 'p'
                        if row-1 == 0:
                            board[row-1][col-1] = 'q'
                            promotion = True
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 7 and best_piece == 'P':
                                    board[target_row][target_col] = 'Q'
                                current_score = score(board, 'b')
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row-1, col-1, 'p')]
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row-1, col-1, 'p'))
                            else:
                                board[row][col] = 'p'
                                board[row-1][col-1] = captured_piece
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False
                        board[row][col] = 'p'
                        board[row-1][col-1] = captured_piece
                        checkmate = False

                    elif direction == 4 and row > 0 and col < 7 and board[row-1][col+1] in WHITE_PIECES:
                        captured_piece = board[row-1][col+1]
                        board[row][col] = '0'
                        board[row-1][col+1] = 'p'
                        if row-1 == 0:
                            board[row-1][col+1] = 'q'
                            promotion = True
                        if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                            best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                checkmate = True
                                # debug removed
                            if not checkmate:
                                board[best_row][best_col] = '0'
                                board[target_row][target_col] = best_piece
                                if target_row == 7 and best_piece == 'P':
                                    board[target_row][target_col] = 'Q'
                                current_score = score(board, 'b')
                                board[best_row][best_col] = best_piece
                                board[target_row][target_col] = captured
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, row-1, col+1, 'p')]
                                    if best_piece != 'P':
                                      if board[target_row][target_col] in BLACK_PIECES:
                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                      else:
                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                    else:
                                        if board[target_row][target_col] in BLACK_PIECES:
                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                        else:
                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                elif current_score == previous_score:
                                    best_moves.append((row, col, row-1, col+1, 'p'))
                            else:
                                board[row][col] = 'p'
                                board[row-1][col+1] = captured_piece
                                checkmate = False
                                return '2', '2', '2', '2', '2', '2', False
                        board[row][col] = 'p'
                        board[row-1][col+1] = captured_piece
                        checkmate = False

            elif piece == 'n':
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'n'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = -1.25
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                                    if draw:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, piece)]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, piece))
                                    else:
                                        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                            checkmate = True
                                            # debug removed
                                        if not checkmate:
                                            board[best_row][best_col] = '0'
                                            board[target_row][target_col] = best_piece
                                            if target_row == 7 and best_piece == 'P':
                                                board[target_row][target_col] = 'Q'
                                            current_score = score(board, 'b')
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, 'n')]
                                                if best_piece != 'P':
                                                  if board[target_row][target_col] in BLACK_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in BLACK_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, 'n'))
                                        else:
                                            board[row][col] = 'n'
                                            board[new_row][new_col] = captured_piece
                                            checkmate = False
                                            return '2', '2', '2', '2', '2', '2', False
                            board[row][col] = 'n'
                            board[new_row][new_col] = captured_piece
                            checkmate = False
                            position_history[pos_hash] -= 1

            elif piece == 'b':
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'b'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                                        if draw:
                                            current_score = -1.25
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 7 and best_piece == 'P':
                                                    board[target_row][target_col] = 'Q'
                                                current_score = score(board, 'b')
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'b')]
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'b'))
                                            else:
                                                board[row][col] = 'b'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False
                                board[row][col] = 'b'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in WHITE_PIECES:
                                break
                        else:
                            break

            elif piece == 'r':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'r'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                                        if draw:
                                            current_score = -1.25
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                if best_piece != 'P':
                                                  if board[target_row][target_col] in BLACK_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in BLACK_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 7 and best_piece == 'P':
                                                    board[target_row][target_col] = 'Q'
                                                current_score = score(board, 'b')
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'r')]
                                                    if best_piece != 'p':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'r'))
                                            else:
                                                board[row][col] = 'r'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False
                                board[row][col] = 'r'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in WHITE_PIECES:
                                break
                        else:
                            break

            elif piece == 'q':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'q'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = -1.25
                                    if current_score > previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                        best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                                        if draw:
                                            current_score = -1.25
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, piece)]
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, piece))
                                        else:
                                            if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                                checkmate = True
                                                # debug removed
                                            if not checkmate:
                                                board[best_row][best_col] = '0'
                                                board[target_row][target_col] = best_piece
                                                if target_row == 7 and best_piece == 'P':
                                                    board[target_row][target_col] = 'Q'
                                                current_score = score(board, 'b')
                                                board[best_row][best_col] = best_piece
                                                board[target_row][target_col] = captured
                                                if current_score > previous_score:
                                                    previous_score = current_score
                                                    best_moves = [(row, col, new_row, new_col, 'q')]
                                                    if best_piece != 'P':
                                                      if board[target_row][target_col] in BLACK_PIECES:
                                                        analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                      else:
                                                        analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                        if board[target_row][target_col] in BLACK_PIECES:
                                                          analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                        else:
                                                          analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                                elif current_score == previous_score:
                                                    best_moves.append((row, col, new_row, new_col, 'q'))
                                            else:
                                                board[row][col] = 'q'
                                                board[new_row][new_col] = captured_piece
                                                checkmate = False
                                                return '2', '2', '2', '2', '2', '2', False
                                board[row][col] = 'q'
                                board[new_row][new_col] = captured_piece
                                checkmate = False
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in WHITE_PIECES:
                                break
                        else:
                            break

            elif piece == 'k':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'P', 'N', 'B', 'R', 'Q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'k'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = -1.25
                                if current_score > previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                black_king_row, black_king_col = find_king(board, 'b')
                                if not is_king_in_check(board, black_king_row, black_king_col, 'b'):
                                    best_row, best_col, target_row, target_col, best_piece, captured, draw = best_move2_black(board)
                                    if draw:
                                        current_score = -1.25
                                        if current_score > previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, piece)]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, piece))
                                    else:
                                        if best_row == best_col == target_row == target_col == best_piece == captured == '1':
                                            checkmate = True
                                        if not checkmate:
                                            board[best_row][best_col] = '0'
                                            board[target_row][target_col] = best_piece
                                            if target_row == 7 and best_piece == 'P':
                                                board[target_row][target_col] = 'Q'
                                            current_score = score(board, 'b')
                                            board[best_row][best_col] = best_piece
                                            board[target_row][target_col] = captured
                                            if current_score > previous_score:
                                                previous_score = current_score
                                                best_moves = [(row, col, new_row, new_col, 'k')]
                                                if best_piece != 'P':
                                                  if board[target_row][target_col] in BLACK_PIECES:
                                                    analized = ('(' + best_piece.upper() + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                  else:
                                                    analized = ('(' + best_piece.upper() + indices_to_pos(target_row, target_col) + ')')
                                                else:
                                                    if board[target_row][target_col] in BLACK_PIECES:
                                                      analized = ('(' + indices_to_pos_col(best_col) + 'x' + indices_to_pos(target_row, target_col) + ')')
                                                    else:
                                                      analized = ('(' + indices_to_pos(target_row, target_col) + ')')
                                            elif current_score == previous_score:
                                                best_moves.append((row, col, new_row, new_col, 'k'))
                                        else:
                                            board[row][col] = 'k'
                                            board[new_row][new_col] = captured_piece
                                            checkmate = False
                                            black_king_row, black_king_col = find_king(board, 'b')
                                            return '2', '2', '2', '2', '2', '2', False
                            board[row][col] = 'k'
                            board[new_row][new_col] = captured_piece
                            checkmate = False
                            black_king_row, black_king_col = find_king(board, 'b')
                            position_history[pos_hash] -= 1

    if best_moves:
        best_move = random.choice(best_moves)
        best_row, best_col, target_row, target_col, best_piece = best_move
        captured_piece = board[target_row][target_col]
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            draw = True
        else:
            draw = False
        position_history[pos_hash] -= 1
        return best_row, best_col, target_row, target_col, best_piece, captured_piece, draw
    else:
        return '1', '1', '1', '1', '1', '1', False

def best_move2_black(board):
    white_king_row, white_king_col = find_king(board, 'w')
    promotion = False
    previous_score = 6000
    best_moves = []
    rows = BOARD_ROWS
    cols = BOARD_COLS

    for row in rows:
        row_data = board[row]
        for col in cols:
            piece = row_data[col]
            if piece == 'P':
                # OPTIMIZATION: Fixed order - captures first (3,4), then advances (1,2) for better move ordering
                directions = [3, 4, 1, 2]
                for direction in directions:
                    if direction == 1 and row == 1 and board[row+2][col] == '0' and board[row+1][col] == '0':
                        board[row][col] = '0'
                        board[row+2][col] = 'P'
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            current_score = score(board, 'b')
                            if current_score < previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row+2, col, 'P')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row+2, col, 'P'))
                        board[row][col] = 'P'
                        board[row+2][col] = '0'

                    elif direction == 2 and row < 7 and board[row+1][col] == '0':
                        board[row][col] = '0'
                        board[row+1][col] = 'P'
                        if row+1 == 7:
                            board[row+1][col] = 'Q'
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            current_score = score(board, 'b')
                            if current_score < previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row+1, col, 'P')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row+1, col, 'P'))
                        board[row][col] = 'P'
                        board[row+1][col] = '0'

                    elif direction == 3 and row < 7 and col > 0 and board[row+1][col-1] in BLACK_PIECES:
                        captured_piece = board[row+1][col-1]
                        board[row][col] = '0'
                        board[row+1][col-1] = 'P'
                        if row+1 == 7:
                            board[row+1][col-1] = 'Q'
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            current_score = score(board, 'b')
                            if current_score < previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row+1, col-1, 'P')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row+1, col-1, 'P'))
                        board[row][col] = 'P'
                        board[row+1][col-1] = captured_piece

                    elif direction == 4 and row < 7 and col < 7 and board[row+1][col+1] in BLACK_PIECES:
                        captured_piece = board[row+1][col+1]
                        board[row][col] = '0'
                        board[row+1][col+1] = 'P'
                        if row+1 == 7:
                            board[row+1][col+1] = 'Q'
                            promotion = True
                        if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                            current_score = score(board, 'b')
                            if current_score < previous_score:
                                previous_score = current_score
                                best_moves = [(row, col, row+1, col+1, 'P')]
                            elif current_score == previous_score:
                                best_moves.append((row, col, row+1, col+1, 'P'))
                        board[row][col] = 'P'
                        board[row+1][col+1] = captured_piece

            elif piece == 'N':
                directions = [(1, 2), (1, -2), (-1, 2), (-1, -2), (2, 1), (2, -1), (-2, 1), (-2, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'N'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = 1.25
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    current_score = score(board, 'b')
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'N')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'N'))
                            board[row][col] = 'N'
                            board[new_row][new_col] = captured_piece
                            position_history[pos_hash] -= 1

            elif piece == 'B':
                directions = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'B'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        current_score = score(board, 'b')
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'B')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'B'))
                                board[row][col] = 'B'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in BLACK_PIECES:
                                break
                        else:
                            break

            elif piece == 'R':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'R'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        current_score = score(board, 'b')
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'R')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'R'))
                                board[row][col] = 'R'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in BLACK_PIECES:
                                break
                        else:
                            break

            elif piece == 'Q':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    for i in range(1, 8):
                        new_row = row + i * direction[0]
                        new_col = col + i * direction[1]
                        if 0 <= new_row < 8 and 0 <= new_col < 8:
                            if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                                captured_piece = board[new_row][new_col]
                                board[row][col] = '0'
                                board[new_row][new_col] = 'Q'
                                # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                                pos_hash = tuple(tuple(row) for row in board)
                                position_history[pos_hash] += 1
                                if position_history[pos_hash] >= 3:
                                    current_score = 1.25
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, piece)]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, piece))
                                else:
                                    if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                        current_score = score(board, 'b')
                                        if current_score < previous_score:
                                            previous_score = current_score
                                            best_moves = [(row, col, new_row, new_col, 'Q')]
                                        elif current_score == previous_score:
                                            best_moves.append((row, col, new_row, new_col, 'Q'))
                                board[row][col] = 'Q'
                                board[new_row][new_col] = captured_piece
                                position_history[pos_hash] -= 1
                            else:
                                break
                            if board[new_row][new_col] in BLACK_PIECES:
                                break
                        else:
                            break

            elif piece == 'K':
                directions = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
                # OPTIMIZATION: Fixed order - no shuffle needed
                for direction in directions:
                    new_row = row + direction[0]
                    new_col = col + direction[1]
                    if 0 <= new_row < 8 and 0 <= new_col < 8:
                        if board[new_row][new_col] in {'0', 'p', 'n', 'b', 'r', 'q'}:
                            captured_piece = board[new_row][new_col]
                            board[row][col] = '0'
                            board[new_row][new_col] = 'K'
                            # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
                            pos_hash = tuple(tuple(row) for row in board)
                            position_history[pos_hash] += 1
                            if position_history[pos_hash] >= 3:
                                current_score = 1.25
                                if current_score < previous_score:
                                    previous_score = current_score
                                    best_moves = [(row, col, new_row, new_col, piece)]
                                elif current_score == previous_score:
                                    best_moves.append((row, col, new_row, new_col, piece))
                            else:
                                white_king_row, white_king_col = find_king(board, 'w')
                                if not is_king_in_check(board, white_king_row, white_king_col, 'w'):
                                    current_score = score(board, 'b')
                                    if current_score < previous_score:
                                        previous_score = current_score
                                        best_moves = [(row, col, new_row, new_col, 'K')]
                                    elif current_score == previous_score:
                                        best_moves.append((row, col, new_row, new_col, 'K'))
                            board[row][col] = 'K'
                            board[new_row][new_col] = captured_piece
                            white_king_row, white_king_col = find_king(board, 'w')
                            position_history[pos_hash] -= 1

    if best_moves:
        best_move = random.choice(best_moves)
        best_row2, best_col2, target_row2, target_col2, best_piece2 = best_move
        captured_piece2 = board[target_row2][target_col2]
        # OPTIMIZATION: Use tuple for faster hashing instead of string concatenation
        pos_hash = tuple(tuple(row) for row in board)
        position_history[pos_hash] += 1
        if position_history[pos_hash] >= 3:
            draw = True
        else:
            draw = False
        position_history[pos_hash] -= 1
        return best_row2, best_col2, target_row2, target_col2, best_piece2, captured_piece2, draw
    else:
        return '1', '1', '1', '1', '1', '1', False

def train(board):
    good_moves = []
    while True:
        piece = input('What piece: ')
        from_square = input('From what square: ').strip().lower()
        to_square = input('To what square: ').strip().lower()
        captured_piece = input('Capturing what piece: ')
        from_row, from_col = pos_to_indices(from_square)
        to_row, to_col = pos_to_indices(to_square)
        good_moves.append((from_row, from_col, to_row, to_col, piece, captured_piece))
        if input('Continue or end? ') == 'end':
            break
    print(good_moves)

def game_loop():
    answer = input('Play or Score? ')
    if answer.lower() in {'t', 'train', 'not play'}:
        good_moves = train(board)
    elif answer.lower() in {'score', 's'}:
        print_board(board)
        current_score = score(board, 'w')
        print(current_score)
    elif answer == 'k':
        game_moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']
        output = print_moves('b', 3, game_moves)
        output = output.strip(' ')
        print('[' + output + ']')
    else:
        answer2 = input('Do you want to play as white, black, or bots?')

        if answer2 in {'random', 'r'}:
            number = random.randint(1, 2)
            if number == 2:
                answer2 = 'w'
        if answer2 in {'white', 'w'}:
            print_board(board)
            for _ in range(300):
                white_king_row, white_king_col = find_king(board, 'w')
                black_king_row, black_king_col = find_king(board, 'b')
                if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                    print("White king is in check!")
                    best_move_black(board, 'False', 'false')
                elif is_king_in_check(board, black_king_row, black_king_col, 'b'):
                    print("Black king is in check!")
                    players_turn_white(board)
                else:
                    players_turn_white(board)
        elif answer2 in {'bots', 'bot', 'b'}:
            for _ in range(300):
                white_king_row, white_king_col = find_king(board, 'w')
                black_king_row, black_king_col = find_king(board, 'b')
                if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                    print("White king is in check!")
                elif is_king_in_check(board, black_king_row, black_king_col, 'b'):
                    print("Black king is in check!")
                    best_move_function(board, 'True', 'none', 'false')
                else:
                    best_move_function(board, 'True', 'none', 'false')
        else:
            for _ in range(300):
                white_king_row, white_king_col = find_king(board, 'w')
                black_king_row, black_king_col = find_king(board, 'b')
                if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                    print("White king is in check!")
                    players_turn(board)
                elif is_king_in_check(board, black_king_row, black_king_col, 'b'):
                    print("Black king is in check!")
                    best_move_function(board, 'False', 'none', 'false')
                else:
                    best_move_function(board, 'False', 'none', 'false')
def game_loop2():
    answer2 = 'w'

    if answer2 in {'random', 'r'}:
        number = random.randint(1, 2)
        if number == 2:
            answer2 = 'w'
    if answer2 in {'white', 'w'}:
        print_board(board)
        for _ in range(300):
            white_king_row, white_king_col = find_king(board, 'w')
            black_king_row, black_king_col = find_king(board, 'b')
            if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                print("White king is in check!")
                best_move_black(board, 'False', 'false')
            elif is_king_in_check(board, black_king_row, black_king_col, 'b'):
                print("Black king is in check!")
                players_turn_white(board)
            else:
                players_turn_white(board)
    else:
        for _ in range(300):
            white_king_row, white_king_col = find_king(board, 'w')
            black_king_row, black_king_col = find_king(board, 'b')
            if is_king_in_check(board, white_king_row, white_king_col, 'w'):
                print("White king is in check!")
                players_turn(board)
            elif is_king_in_check(board, black_king_row, black_king_col, 'b'):
                print("Black king is in check!")
                best_move_function(board, 'False', 'none', 'false')
            else:
                best_move_function(board, 'False', 'none', 'false')
initialize_board()