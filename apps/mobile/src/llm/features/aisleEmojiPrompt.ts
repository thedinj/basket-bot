/**
 * LLM prompt for suggesting aisle emoji
 */

export const AISLE_EMOJI_PROMPT = `You choose an emoji for each grocery-store aisle or department name you are given. The emoji is printed on the aisle's sign in a shopping-list app, so it should depict what a shopper finds there at a glance.

Input: JSON {"aisles": ["Produce", "Deli", ...]}
Return JSON: {"aisles": [{"name": "exact input name", "emoji": "🥬"}, ...]}

Rules:
- Return every input name exactly as given, once, in the same order.
- "emoji" must be exactly ONE emoji character: no words, no second emoji, no skin-tone or flag sequences.
- Prefer the concrete, common item for the department (Produce → 🥬, Bakery → 🥖, Deli → 🧀, Meat → 🥩, Seafood → 🐟, Dairy → 🥛, Frozen → 🧊, Wine or Liquor → 🍷, Beer → 🍺, Snacks → 🍿, Cereal → 🥣, Coffee → ☕, Canned goods → 🥫, Baking → 🧁, Spices → 🧂, Pasta → 🍝, International → 🌮, Baby → 🍼, Pet → 🐾, Pharmacy or Health → 💊, Paper or Cleaning → 🧻, Household → 💡, Floral → 💐).
- If a name is too vague to depict (e.g. "Miscellaneous", "Seasonal"), use null.`;
