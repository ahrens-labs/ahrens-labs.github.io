# TrifangX Engine Personality Settings

This document shows the exact modifier values for each personality type available in the chess engine.

## Modifier Descriptions

- **Material**: How much the engine values piece material (pawns, knights, bishops, rooks, queens)
- **King Safety**: How much the engine prioritizes king protection
- **Centralization**: How much the engine values controlling the center squares
- **Attack**: How much the engine prioritizes offensive threats and tactics
- **Piece Activity**: How much the engine values active, well-placed pieces
- **Defense**: How much the engine prioritizes defensive positioning
- **Pawn Structure**: How much the engine values good pawn formations

---

## ⚖️ Balanced
The default, well-rounded style with equal priorities.

| Modifier          | Value |
|-------------------|-------|
| Material          | 1.0   |
| King Safety       | 1.0   |
| Centralization    | 1.0   |
| Attack            | 1.0   |
| Piece Activity    | 1.0   |
| Defense           | 1.0   |
| Pawn Structure    | 1.0   |

**Playing Style**: Equal consideration of all factors, solid and reliable play.

---

## ⚔️ Aggressive
Highly offensive style that sacrifices safety for attacks.

| Modifier          | Value |
|-------------------|-------|
| Material          | 0.7   |
| King Safety       | 0.5   |
| Centralization    | 1.5   |
| Attack            | 2.5   |
| Piece Activity    | 1.8   |
| Defense           | 0.4   |
| Pawn Structure    | 0.6   |

**Playing Style**: Extremely aggressive, willing to sacrifice material and king safety for attacking chances. Loves active pieces and central control.

---

## 🛡️ Defensive
Highly conservative style that prioritizes safety.

| Modifier          | Value |
|-------------------|-------|
| Material          | 1.2   |
| King Safety       | 2.2   |
| Centralization    | 0.7   |
| Attack            | 0.5   |
| Piece Activity    | 0.6   |
| Defense           | 2.0   |
| Pawn Structure    | 1.8   |

**Playing Style**: Very cautious, prioritizes king safety and solid pawn structure. Prefers to maintain material and defend well.

---

## 🎯 Positional
Strategic style focusing on long-term advantages.

| Modifier          | Value |
|-------------------|-------|
| Material          | 0.8   |
| King Safety       | 1.4   |
| Centralization    | 2.0   |
| Attack            | 0.7   |
| Piece Activity    | 1.5   |
| Defense           | 1.6   |
| Pawn Structure    | 1.9   |

**Playing Style**: Focuses on controlling the center, maintaining good pawn structure, and achieving long-term positional advantages. Values piece coordination.

---

## 💎 Material-Focused
Prioritizes gaining and maintaining material advantage.

| Modifier          | Value |
|-------------------|-------|
| Material          | 2.5   |
| King Safety       | 0.7   |
| Centralization    | 0.6   |
| Attack            | 0.9   |
| Piece Activity    | 0.5   |
| Defense           | 0.7   |
| Pawn Structure    | 0.4   |

**Playing Style**: Extremely focused on winning material. Will avoid speculative sacrifices and trades unless they gain material.

---

## ⚡ Tactical
Dynamic style emphasizing tactics and active play.

| Modifier          | Value |
|-------------------|-------|
| Material          | 0.9   |
| King Safety       | 0.6   |
| Centralization    | 1.6   |
| Attack            | 2.2   |
| Piece Activity    | 2.0   |
| Defense           | 0.7   |
| Pawn Structure    | 0.8   |

**Playing Style**: Seeks tactical opportunities with highly active pieces. Aggressive but slightly more balanced than pure Aggressive style.

---

## 🎛️ Custom
User-defined personality with adjustable sliders (range: 0.0 - 3.0).

| Modifier          | Default Value |
|-------------------|---------------|
| Material          | 1.0           |
| King Safety       | 1.0           |
| Centralization    | 1.0           |
| Attack            | 1.0           |
| Piece Activity    | 1.0           |
| Defense           | 1.0           |
| Pawn Structure    | 1.0           |

**Playing Style**: Fully customizable. Adjust each modifier between 0.0 and 3.0 to create your own unique engine personality.

---

## Notes

- Values above 1.0 mean the engine prioritizes that aspect more heavily
- Values below 1.0 mean the engine de-emphasizes that aspect
- The engine applies these modifiers asymmetrically - it uses the selected personality for its own evaluation, but evaluates the opponent's position with balanced (1.0) modifiers
- Custom personality settings are saved in browser localStorage and persist across sessions
