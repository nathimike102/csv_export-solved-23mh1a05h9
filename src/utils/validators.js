const VALID_COLUMNS = ['id', 'name', 'email', 'signup_date', 'country_code', 'subscription_tier', 'lifetime_value'];

function validateColumns(columnsParam) {
  if (!columnsParam) {
    return VALID_COLUMNS;
  }

  const requested = columnsParam.split(',').map(c => c.trim());
  const invalid = requested.filter(col => !VALID_COLUMNS.includes(col));

  if (invalid.length > 0) {
    throw new Error(`Invalid column(s): ${invalid.join(', ')}`);
  }

  return requested;
}

function validateDelimiter(delim) {
  if (!delim) return ',';
  if (delim.length !== 1) {
    throw new Error('Delimiter must be a single character');
  }
  return delim;
}

function validateQuoteChar(quoteChar) {
  if (!quoteChar) return '"';
  if (quoteChar.length !== 1) {
    throw new Error('Quote char must be a single character');
  }
  return quoteChar;
}

function validateFilters(filters) {
  const validated = {};

  if (filters.country_code) {
    if (!/^[A-Z]{2}$/.test(filters.country_code)) {
      throw new Error('Invalid country code format');
    }
    validated.country_code = filters.country_code;
  }

  if (filters.subscription_tier) {
    const validTiers = ['free', 'basic', 'premium', 'enterprise'];
    if (!validTiers.includes(filters.subscription_tier)) {
      throw new Error(`Invalid subscription tier. Must be one of: ${validTiers.join(', ')}`);
    }
    validated.subscription_tier = filters.subscription_tier;
  }

  if (filters.min_ltv !== undefined) {
    const ltv = parseFloat(filters.min_ltv);
    if (isNaN(ltv) || ltv < 0) {
      throw new Error('min_ltv must be a valid non-negative number');
    }
    validated.min_ltv = ltv;
  }

  return validated;
}

module.exports = {
  validateColumns,
  validateDelimiter,
  validateQuoteChar,
  validateFilters,
  VALID_COLUMNS
};
