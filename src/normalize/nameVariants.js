/**
 * Query first name variants from the database
 */

const { pool } = require('../db/pool');

/**
 * Get all variants for a first name (bidirectional lookup)
 * If "jim" is input, returns ["jim", "james", "jimmy", "jamie", ...]
 * @param {string} nameFirst - The first name to look up
 * @returns {Promise<string[]>} Array of variant names including the original
 */
async function getFirstNameVariants(nameFirst) {
  if (!nameFirst) return [];

  const name = nameFirst.toLowerCase().trim();

  try {
    // Bidirectional lookup: find variants where this name is formal OR variant
    const { rows } = await pool.query(`
      SELECT DISTINCT name
      FROM (
        -- If input is a formal name, get its variants
        SELECT name_variant as name FROM name_first_variant WHERE name_formal = $1
        UNION
        -- If input is a variant, get the formal name
        SELECT name_formal as name FROM name_first_variant WHERE name_variant = $1
        UNION
        -- Also get siblings (other variants of the same formal name)
        SELECT v2.name_variant as name
        FROM name_first_variant v1
        JOIN name_first_variant v2 ON v1.name_formal = v2.name_formal
        WHERE v1.name_variant = $1
        UNION
        -- Include the original name
        SELECT $1 as name
      ) variants
      ORDER BY name
    `, [name]);

    return rows.map(r => r.name);
  } catch (err) {
    // If DB is unavailable, just return the original name
    console.error('Error fetching name variants:', err.message);
    return [name];
  }
}

/**
 * Build an OR clause for search query
 * @param {string[]} variants - Array of name variants
 * @returns {string} Either single name or "(name1 OR name2 OR name3)"
 */
function buildOrClause(variants) {
  if (!variants || variants.length === 0) return '';
  if (variants.length === 1) return variants[0];

  // Capitalize each variant for the search query
  const capitalized = variants.map(v =>
    v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
  );

  return `(${capitalized.join(' OR ')})`;
}

module.exports = {
  getFirstNameVariants,
  buildOrClause
};
