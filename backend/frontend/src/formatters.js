/**
 * Kubernetes Resource Quantity Formatter
 * 
 * Provides utility functions for parsing and formatting Kubernetes quantities,
 * especially converting memory quantities (Ki, Mi, Gi, Ti, Pi, Ei, bytes) into
 * clean, human-readable GiB representations.
 */

/**
 * Parse a Kubernetes resource quantity string or number into bytes.
 *
 * Supports:
 * - Binary SI units: Ki, Mi, Gi, Ti, Pi, Ei (1024-based)
 * - Decimal SI units: m, k, K, M, G, T, P, E (1000-based)
 * - Raw byte integers and floats (e.g. 138803650331)
 * - Exponential notation (e.g. 1e6)
 *
 * @param {string|number|null|undefined} quantity - The raw quantity value
 * @returns {number|null} The quantity in bytes, or null if invalid/unparseable
 */
export function parseQuantityToBytes(quantity) {
  if (quantity === null || quantity === undefined) {
    return null;
  }

  if (typeof quantity === 'number') {
    return Number.isFinite(quantity) && quantity >= 0 ? quantity : null;
  }

  const str = String(quantity).trim();
  if (!str) {
    return null;
  }

  // Matches optional sign, integer/decimal with optional scientific exponent, and unit suffix
  const match = str.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) {
    return null;
  }

  const num = parseFloat(match[1]);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return null;
  }

  const rawUnit = match[2];
  if (!rawUnit) {
    // Plain number without suffix is treated as bytes
    return num >= 0 ? num : null;
  }

  // 1024-based binary units (standard Kubernetes memory quantities)
  const binaryMultipliers = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
  };

  // 1000-based decimal units
  const decimalMultipliers = {
    m: 1e-3,
    k: 1e3,
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
  };

  if (binaryMultipliers[rawUnit] !== undefined) {
    return num * binaryMultipliers[rawUnit];
  }
  if (decimalMultipliers[rawUnit] !== undefined) {
    return num * decimalMultipliers[rawUnit];
  }

  // Case-insensitive fallback or units ending with 'b'/'B' (e.g. 'kib', 'Mib', 'GiB', 'GB')
  const cleanUnit = (rawUnit.endsWith('B') || rawUnit.endsWith('b')) && rawUnit.length > 1 ? rawUnit.slice(0, -1) : rawUnit;
  const upperClean = cleanUnit.toUpperCase();

  const caseInsensitiveBinary = {
    KI: 1024,
    MI: 1024 ** 2,
    GI: 1024 ** 3,
    TI: 1024 ** 4,
    PI: 1024 ** 5,
    EI: 1024 ** 6,
  };

  if (caseInsensitiveBinary[upperClean] !== undefined) {
    return num * caseInsensitiveBinary[upperClean];
  }

  const caseInsensitiveDecimal = {
    K: 1e3,
    M: 1e6,
    G: 1e9,
    T: 1e12,
    P: 1e15,
    E: 1e18,
  };

  if (caseInsensitiveDecimal[upperClean] !== undefined) {
    return num * caseInsensitiveDecimal[upperClean];
  }

  if (upperClean === 'B' || upperClean === 'BYTES') {
    return num;
  }

  return null;
}

/**
 * Format a Kubernetes memory quantity into a user-friendly GiB string.
 *
 * Uses binary units (1024-based) as required by Kubernetes memory specifications.
 * Rounds to at most 2 decimal places and strips unnecessary trailing zeros.
 *
 * Examples:
 * - 8127828Ki  -> "7.75 GiB"
 * - 32861500Ki -> "31.34 GiB"
 * - 32861504Ki -> "31.34 GiB"
 * - 32864708Ki -> "31.34 GiB"
 * - 16384Mi    -> "16 GiB"
 * - 32768Mi    -> "32 GiB"
 * - 2048Mi     -> "2 GiB"
 * - 1Gi        -> "1 GiB"
 * - 1Ti        -> "1024 GiB"
 * - 0          -> "0 GiB"
 *
 * Edge cases handled:
 * - null, undefined, empty string, invalid quantity -> "—"
 *
 * @param {string|number|null|undefined} quantity - Raw memory quantity
 * @returns {string} Formatted GiB string
 */
export function formatMemoryQuantity(quantity) {
  if (quantity === null || quantity === undefined) {
    return '—';
  }

  if (typeof quantity === 'string' && quantity.trim() === '') {
    return '—';
  }

  const bytes = parseQuantityToBytes(quantity);
  if (bytes === null || Number.isNaN(bytes)) {
    return '—';
  }

  if (bytes === 0) {
    return '0 GiB';
  }

  const gib = bytes / (1024 ** 3);

  // For positive quantities smaller than 0.01 GiB (e.g. 1024Ki = 1MiB = ~0.001 GiB)
  if (gib > 0 && gib < 0.01) {
    const formatted3 = parseFloat(gib.toFixed(3));
    if (formatted3 > 0) {
      return `${formatted3} GiB`;
    }
    return '< 0.01 GiB';
  }

  // Format to 2 decimal places and remove trailing zeros (e.g. 8.00 -> 8)
  const rounded = parseFloat(gib.toFixed(2));
  return `${rounded} GiB`;
}
