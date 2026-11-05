# Drawn sprite animation sheets

Generated with the built-in image_gen tool, one sheet per character. Every sheet contains 4 columns × 6 rows, 24 drawn poses. Artwork changes arms, legs, eyelids and mouths; runtime playback changes sheet cells. No baked visual effects.

Rows, top to bottom: idle, attack, hurt, guard, recover/heal, KO. Cast reuses the attack row. KO holds its fourth frame. Original PNGs are retained; runtime lossless WebP copies preserve alpha. All active sheets have 256-square cells. Character 16 uses corrected v2 files (see cast-16-correction.md). Head avatars still use the approved static portraits.

Files: cast-01-sheet-v1.png through cast-16-sheet-v1.png; matching .webp runtime copies. See manifest.json for frame coordinates and source sizes. Character names and order are defined in js/chars.js.

Preview: /motion-preview.html. It provides action controls, slow playback, left/right facing and links to the full sheets.

## Generation prompts

### Character 1

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY TOP ROW FIRST character of atlas: stocky spiky-black-haired boxer, olive sleeveless top, red boxing gloves, charcoal trousers, black white sneakers. KEEP two boxing gloves in all poses. Do not include other atlas people.

### Character 2

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY TOP ROW SECOND character of atlas: black wavy center-parted hair, fine ROUND glasses, cheerful face, black suit white shirt black tie, black shoes. Ready stance has one thumbs-up. Attack with right mitten hand palm or punch, retain suit and glasses. No other atlas people.
Background MUST be completely empty alpha=0 in every inter-cell gap and around each pose, no smoky or dark tinted backdrop.

### Character 3

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY TOP ROW THIRD character of atlas: messy black center-parted hair, thin ROUND glasses, purple iris eyes, serious face, black crewneck white collar triangle, charcoal pants white black sneakers. Attack animation: pull hands toward chest then thrust BOTH open mitten palms right like a caster, no visible magic. No other atlas people.

### Character 4

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY TOP ROW FOURTH character of atlas: full cheeks, navy ski helmet, large PURPLE goggles on forehead, navy gray block-pattern ski suit, navy gloves, snow boots. Attack arm thrust, keep helmet/goggles in every frame. No other atlas people.

### Character 5

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY TOP ROW FIFTH character of atlas: dense fluffy black hair, round glasses, white T shirt, black SHORTS, bare calves, white sneakers. Energetic runner, attack a quick forward arm jab with stepping legs. No other atlas people.

### Character 6

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY BOTTOM ROW FIRST character of atlas: smooth black bowl fringe, gray drawstring hoodie, charcoal trousers, red white sneakers, no glasses. Attack by thrusting open palm right, NO flame. No other atlas people.

### Character 7

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY BOTTOM ROW SECOND character of atlas: black side-swept bowl hair, narrowed eyes, navy varsity jacket IVORY sleeves and striped cuffs, navy trousers, white navy shoes. Attack pointing arm thrust right. No other atlas people.

### Character 8

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Select ONLY BOTTOM ROW THIRD character of atlas: black baseball cap with gray purple crown, big round glasses, black tracksuit WHITE stripes along sleeves and legs, microphone. Keep microphone held in ONE hand while other hand gestures right during attack. Preserve microphone during guard/KO, no soundwave VFX. No other atlas people.

### Character 9

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use the single referenced masked character exactly: black smooth ear-length center-parted curtain hair, black medical face mask over lower face, crescent smiling eyes, black zip hoodie, charcoal pants, black white sneakers. Attack with pointing finger thrust right. Keep mask on in every frame, expressive eyes, no purple effects.

### Character 10

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use the single referenced stocky short-cropped-black-haired character exactly: thin RECTANGULAR spectacles, green irises, round cheeks, black short sleeve tee tiny white ring chest emblem, black SHORTS, bare calves, black watch, black white sneakers. Keep clear cup of green drink in ONE hand in every frame; attack with free arm, no green vapor or floating effects.

### Character 11

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use the single referenced brown-black straight bowl-fringed character: black wireless earbud, no glasses, black zip fleece hoodie, dark trousers, black white sneakers. Keep wooden grilled chicken skewer with THREE food pieces in one hand, attack with free hand; no flames. Preserve skewer in all poses.

### Character 12

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use single referenced smiling messy spiky black-haired character: navy short sleeve T-shirt tiny white geometric emblem, black track pants, white black sneakers, no glasses. Attack wind-up with arms spread then thrust forward RIGHT, active footwork, no wind effects.

### Character 13

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use single referenced cap-and-blue-sunglasses character: navy cap, BLUE mirrored aviator shades hiding eyes, navy windbreaker over gray shirt, light gray crossbody sling bag black strap, beige pants, white sneakers, black watch. Crouching ready pose, attack rises into palm thrust right then recovers crouch. Keep cap, shades and bag in every frame.

### Character 14

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use single referenced undercut character: black short hair shaved sides, serious eyes, no glasses, NAVY short sleeve button shirt printed YELLOW bananas and pale BLUE small motifs, charcoal pants, white black sneakers. Attack a forward punch RIGHT with torso twist. Keep SHIRT PRINTS (not VFX) and undercut consistent.

### Character 15

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use single referenced round full-cheek character: fluffy CURLY black mop hair, RECTANGULAR glasses, brown open zip hoodie gray T-shirt, dark pants white black shoes, playful tongue-out face. Idle folded arms; attack unfolds arms into shove right. No shield, no floating bread. Keep glasses and jacket.

### Character 16

Use case: stylized-concept.
Asset: a production 2D SPRITE ANIMATION SHEET, exactly FOUR columns and SIX rows = 24 separately drawn full-body poses of ONE character. Portrait 2:3 canvas, ideally 1536 x 2304, every cell a perfect equal square. Transparent alpha background.
Style: EXACT same Powerpuff Girls cartoon style, identity, proportions and outfit as the chosen reference character. Enormous oval head, huge graphic eyes, tiny torso and stubby limbs, thick black outline, flat cel colors.
CRITICAL: These must be TRUE ANIMATION drawings: change limb joint poses, hands, feet, mouth and eyelids across frames. Do NOT repeat the same still or merely rotate/scale/translate the entire figure. Preserve consistent head size, outfit details and facial identity across all 24 cells. Only ONE selected character repeated, no other people.
GRID: Each of 24 identical square cells has its OWN local coordinate system; every upright frame grounded on a baseline at 88% cell height, character head top around 12% cell height, same center/registration across frames. Leave 10% transparent margin INSIDE EACH cell. Entire hands, feet and lying body must remain inside its cell. Never overlap adjacent cells. No drawn grid lines, labels or numbers.
ANIMATION ROWS from top to bottom, frames left to right:
Row 1 IDLE LOOP: neutral ready stance; slight knees bend with shoulders lower; blink with eyes closed while shifting mitten hands; return toward neutral with eyes open. Real knee/arm changes.
Row 2 ATTACK: anticipation (arms pulled back, bent knees); wind-up (torso twists, front arm chambers); STRIKE (front arm fully extended toward RIGHT, back foot pivots, intense face); recover (arm retracts, regain stance). All parts stay within cell.
Row 3 HURT: contact face winces eyes squeeze; recoil with arms flung slightly upward and bent knees; crouch with hands near torso; recovering to ready. NOT merely rotating a rigid cutout.
Row 4 GUARD: arms lift; BOTH arms cover upper torso/face; braced crouch behind raised fists, narrowed eyes; arms lower toward ready.
Row 5 RECOVER: tired lowered arms with half closed eyes; eyes closed, hands near chest taking breath; straighten knees with relieved smile and open arms; calm ready pose.
Row 6 KO: weak knees, eyes squeezed; kneeling with lowered arms; falling sideways, legs folding and arms out; lying completely on side with closed eyes, entire prone body inside cell. Keep head same size in prone frame, bend limbs naturally.
No baked VFX whatsoever: NO flame, NO magic, NO rings, NO glow, NO speed trails, NO stars, NO floating gears, NO particles, NO lettering, NO shadows. Physical clothing/accessories/held props stay. Clean true transparency.
SUBJECT: Use single referenced thinking character: short dense tousled black fringe, silver RECTANGULAR glasses low on nose, white short sleeve T shirt with tiny black abstract scribble, dark pants white black sneakers. Idle one mitten scratching hair. Attack hand comes off head, chambers then thrusts right. Keep glasses; no gears or yellow ticks.

