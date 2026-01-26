# Why Alpha-Beta Pruning Isn't Showing Much Speedup

## The Problem

You've implemented alpha-beta pruning, but the engine isn't noticeably faster. This is actually **expected behavior** given your current implementation. Here's why:

## 1. **Shallow Search Depth**

Your engine uses a **2-ply search**:
- `best_move_player` → `best_move2`
- This is only **one move** for each player

**Alpha-beta pruning benefits increase with depth**:
- Depth 2: ~10-20% nodes pruned
- Depth 4: ~50-70% nodes pruned  
- Depth 6: ~80-90% nodes pruned

At depth 2, there simply aren't enough branches for pruning to make a big difference.

**Example**:
- Without pruning: Evaluates ~1,225 positions (35²)
- With pruning: Evaluates ~980-1,100 positions (10-20% reduction)
- **Speedup: ~1.1-1.25x** (barely noticeable)

## 2. **Random Move Ordering**

Your code uses `random.shuffle(directions)`, which means moves are evaluated in **random order**.

**Alpha-beta pruning requires good move ordering**:
- **Best moves first** = early pruning = big speedup
- **Worst moves first** = late pruning = small speedup
- **Random order** = unpredictable pruning = minimal average speedup

**Ideal ordering** (for maximum pruning):
1. Captures (especially high-value captures)
2. Checks and threats
3. Piece development moves
4. Quiet positional moves

## 3. **Score Function Overhead**

The `score()` function is likely **expensive** (evaluates entire board). The overhead of:
- Checking `if current_score >= beta`
- Updating alpha/beta values
- Restoring board state

...is very small compared to the cost of `score()`. So pruning saves some `score()` calls, but the overhead of the pruning logic itself reduces the benefit.

## 4. **Branching Factor**

Chess has a high branching factor (~35 moves per position). At depth 2:
- Total nodes: ~35² = 1,225
- Even with perfect pruning: ~√1,225 = 35 nodes (best case)
- In practice: ~200-600 nodes with good ordering
- With random ordering: ~800-1,100 nodes

The pruning isn't aggressive enough to dramatically reduce computation.

## Why This Happens

### Mathematical Explanation

Alpha-beta pruning's theoretical speedup is:
- **Best case**: O(b^(d/2)) instead of O(b^d)
  - Where b = branching factor, d = depth
- **At depth 2**: Best case is O(35) vs O(1,225)
- **In practice with random ordering**: O(800-1,100) vs O(1,225)

This is only a **1.1-1.5x speedup**, which might not be noticeable depending on other bottlenecks.

## What Would Actually Speed It Up?

### 1. **Deeper Search** (Biggest Impact)

Increase search depth from 2 to 4 or 6 ply:
- Depth 4 with pruning: ~50-70% nodes pruned
- Depth 6 with pruning: ~80-90% nodes pruned
- **Would see 5-10x speedup** at deeper depths

### 2. **Better Move Ordering** (Medium Impact)

Order moves by value:
- Captures first (sorted by value gained)
- Checks/threats second
- Development moves third
- Quiet moves last

This can improve pruning effectiveness by **2-3x** even at depth 2.

### 3. **Transposition Tables** (Medium Impact)

Cache previously evaluated positions:
- Avoid re-evaluating the same position
- Works synergistically with pruning
- Can provide **2-3x speedup**

### 4. **Optimize Score Function** (Variable Impact)

Make `score()` faster:
- Cache common patterns
- Use bitboards for faster piece counting
- Simplify evaluation for speed
- **Speedup depends on current implementation**

## Your Current Situation

Given your 2-ply search with random move ordering:
- **Expected speedup: 1.1-1.25x** (10-25% faster)
- This is barely noticeable in real-world usage
- The pruning is working correctly, but depth is too shallow

## Recommendations

### Short Term (Quick Wins)

1. **Add basic move ordering**:
   ```python
   # Instead of random.shuffle(directions)
   # Sort moves by: captures first, then quiet moves
   moves.sort(key=lambda m: (0 if is_capture(m) else 1, -capture_value(m)))
   ```

2. **Optimize score function** if it's slow

### Long Term (Big Improvements)

1. **Increase search depth** to 4-6 ply
   - This is where pruning really shines
   - Would see 5-10x speedup with pruning
   
2. **Implement transposition tables**
   - Cache positions you've seen
   - Massive speedup for repeated positions

3. **Iterative deepening**
   - Search depth 1, then 2, then 3, etc.
   - Use previous results to order moves
   - Helps pruning at deeper depths

## Conclusion

Alpha-beta pruning **is working correctly**, but it's not showing much speedup because:
- ✅ Search depth is too shallow (2-ply)
- ✅ Move ordering is random (not optimal)
- ✅ These factors limit pruning effectiveness

**Pruning becomes much more valuable** as you increase search depth. At depth 4+, you'd see dramatic speedups (5-10x).

The implementation is correct - the engine just needs deeper searches to really benefit from pruning!
