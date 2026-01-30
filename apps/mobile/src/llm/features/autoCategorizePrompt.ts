/**
 * System prompt for auto-categorization feature
 */

export const AUTO_CATEGORIZE_PROMPT = `Categorize the item into the best matching aisle and section from the provided list.

Return JSON: {"aisleName":"exact name","sectionName":"exact name or null","confidence":0-1,"reasoning":"brief"}

Rules:
- Use EXACT names from the list
- Choose most common location if ambiguous
- Set sectionName to null if no good match`;
