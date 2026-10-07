# QueryOut game design

Decisions made so far. Update this file when a rule changes.

## The board

1. The board is a large dot grid. Arrows are snakes: lines of connected cells that bend around corners and end in an arrowhead.
2. At the start of a level the arrows form one symmetrical shape in the middle of the grid (mirrored left to right and top to bottom). The player peels the shape apart one arrow at a time, starting from the arrows on the outside.
3. An arrow can leave the board only if the straight line ahead of its head, all the way to the edge, is empty. When it leaves, the whole body slides out along its own path.
4. The player can zoom in and out (mouse wheel, pinch, buttons) and drag the board to move around. The first view is framed on the pattern. Zooming out shows the whole dot grid.

## Growth by level

1. The number of cells in the pattern rises every level (4 per quadrant on level 1, then roughly one extra row and column every two levels). More cells means more arrows.
2. The dot grid grows with the pattern, up to a cap of 62 by 62 cells (reached around level 39).
3. Snakes get longer as levels rise, so later boards look more tangled.
4. The outline shape changes from level to level: square, circle, cross, ring, diamond. The same level always produces the same board.
5. Every board is solvable. The generator places snakes from the center outward and only accepts a snake whose head has a clear path at that moment, so a deadlock cannot occur.

## Lives, score and hints

1. A game gives 3 lives. Lives belong to the game, not to a level. They carry over from level to level and are not refilled by restarting a level.
2. Tapping a blocked arrow costs 1 life. Tapping a free arrow is safe on the board, but in step 3 the SQL challenge that follows will cost a life when answered wrongly.
3. At zero lives the game ends. The player can retry the same level with 3 fresh lives and a zero score, or start again from level 1.
4. Each level includes 2 free hints. A hint highlights a free arrow (the one that unblocks the most others). Extra hints cost 50 points.
5. Restarting a level puts the arrows back and returns the score to where the level began, minus hint costs already paid. Free hints are not given back.

## Look

1. Two themes, light and dark. The first visit follows the system setting. The player can switch with the sun and moon button, and the choice is remembered.
2. All arrows look the same. Red is used only for a blocked tap, amber only for hints.

## SQL challenges (step 3 and later)

1. Every arrow carries the same kind of challenge. Arrow length does not change difficulty.
2. Two question styles: a skeleton query with blanks to fill in, and a task where the player completes or writes the SQL command.
3. Difficulty rises with the level, always starting from basics. The first levels teach syntax (SELECT, FROM, WHERE), then it gets harder step by step: ORDER BY and LIMIT, aggregates, GROUP BY and HAVING, joins, subqueries, window functions.
4. Early levels use a word bank for the blanks. Later levels switch to typing.
5. Validation runs the player's query with sql.js on a sample dataset and compares the result rows with the expected rows, so any correct query is accepted.

## Open decisions

1. Whether a wrong SQL answer should also shake the arrow, or only show feedback in the modal and cost a life.
2. Exact level bands for each SQL topic.
