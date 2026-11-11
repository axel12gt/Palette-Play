---
name: Color Sudoku product constraints
description: The product goal and accessibility constraint for Color Sudoku.
---

Color Sudoku is a tactile, non-numeric Sudoku for children and others who prefer visual pattern matching. The user wants 4×4 boards with 2×2 blocks, 6×6 with 2×3 blocks, and standard 9×9 with 3×3 blocks, using the matching number of colors.

**Why:** The user described visual, non-numeric play as the core product and accessibility requirement.

**How to apply:** Keep puzzle values represented as colors rather than visible digits, and preserve the standard Sudoku rule structure.

Do not treat account creation as permission to enable live ads, charge purchases, or publish the game. The user has since reported creating Google Play developer and AdMob accounts and supplied banner and interstitial IDs for integration.

**Why:** The user previously deferred monetization while accounts were missing, then requested ad integration after creating them. Account readiness does not establish a working or approved native integration.

**How to apply:** Keep planned pricing ($0.25 per hint, $5 one-time to remove all ads) unavailable until store products and verified purchase flows are ready. Use test ads during integration. Never treat a placeholder or test flow as a real purchase or live ad.
