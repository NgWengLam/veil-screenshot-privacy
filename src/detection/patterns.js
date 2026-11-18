/** Heuristic matching, not a guarantee that all private information is detected. */

// Labeled values: "<label>: value". `colon` labels need ":" or "#" after them.
// `numbered` labels also match "<label> No. value" / "<label> Number value" without a colon.
const LABELS = [
  { kind: 'Labeled address', colon: 'home address|billing address|shipping address|address' },
  { kind: 'Labeled name', colon: 'full name|customer name|patient name|name' },
  { kind: 'ID number', colon: 'ic|nric|mykad|identity card', numbered: 'ic|nric|mykad|identity card|id|identification' },
  { kind: 'Passport number', colon: 'passport', numbered: 'passport' },
  { kind: 'Bank account', colon: 'bank account|iban', numbered: 'bank account|account|acc|acct|a/c' },
  { kind: 'Password or key', colon: 'password|passcode|passwd|pwd|pin|otp|tac|secret|secret key|private key|api key|access key|token|access token|recovery code|backup code' },
];
const labelPattern = ({ colon, numbered }) => {
  const parts = [`(?:${colon})\\s*[:#]`];
  if (numbered) parts.push(`(?:${numbered})\\s*(?:no|number|num)\\b\\.?\\s*[:#]?`);
  return `(?<![\\w/])(?:${parts.join('|')})`;
};
const LABEL_EXPRESSIONS = LABELS.map(label => ({ kind: label.kind, expression: new RegExp(`${labelPattern(label)}\\s*(\\S.*)`, 'gi') }));
const LABEL_ONLY = LABELS.map(label => ({ kind: label.kind,
  expression: new RegExp(`^(?:${[label.colon, label.numbered].filter(Boolean).join('|')})(?:\\s*(?:no|number|num)\\b\\.?)?\\s*[:#]?$`, 'i') }));

/** Kind for a line that is only a label (its value is on the next line), or null. */
export function labelOnlyKind(text) {
  const trimmed = text.trim();
  return LABEL_ONLY.find(label => label.expression.test(trimmed))?.kind ?? null;
}

const luhn = digits => {
  let sum = 0;
  [...digits].reverse().forEach((digit, i) => {
    let n = Number(digit); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n;
  });
  return sum % 10 === 0;
};
const validIban = value => {
  const compact = value.replace(/\s/g, '').toUpperCase();
  if (compact.length < 15 || compact.length > 34) return false;
  const numeric = (compact.slice(4) + compact.slice(0, 4)).replace(/[A-Z]/g, letter => String(letter.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97;
  return remainder === 1;
};
// Malaysian IC: YYMMDD + place-of-birth code + 4 digits.
const validIcDate = value => {
  const digits = value.replace(/\D/g, '');
  const month = Number(digits.slice(2, 4)), day = Number(digits.slice(4, 6));
  return month >= 1 && month <= 12 && day >= 1 && day <= 31 && digits.slice(6, 8) !== '00';
};

const SECRET_KEYS = [
  /\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)[-_][A-Za-z0-9_-]{16,}/g, // Stripe, OpenAI, Anthropic style
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, /\bgithub_pat_[A-Za-z0-9_]{30,}/g, // GitHub
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key
  /\bAIza[0-9A-Za-z_-]{35}\b/g, // Google API key
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g, // Slack
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, // JWT
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/g,
];

const PRIORITY = ['Email', 'Password or key', 'ID number', 'Passport number', 'Bank account', 'IP address',
  'Payment card', 'Phone number', 'Labeled address', 'Labeled name'];

export function findSensitiveSpans(text) {
  const spans = [];
  const add = (expression, kind, validate = () => true) => {
    for (const match of text.matchAll(expression)) {
      if (validate(match[0])) spans.push({ start: match.index, end: match.index + match[0].length, kind });
    }
  };
  add(/[A-Z0-9._%+-]+\s*@\s*[A-Z0-9-]+(?:\s*\.\s*[A-Z0-9-]+)+/gi, 'Email');
  for (const expression of SECRET_KEYS) add(expression, 'Password or key');
  add(/\b\d{6}\s*-\s*\d{2}\s*-\s*\d{4}\b/g, 'ID number');
  add(/(?<![\d-])\d{12}(?![\d-])/g, 'ID number', validIcDate);
  add(/\b[AHK]\d{8}\b/g, 'Passport number'); // Malaysian passport format
  add(/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, 'Bank account', validIban);
  add(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, 'IP address', value => value.split('.').every(part => Number(part) <= 255));
  add(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g, 'Payment card', value => {
    const digits = value.replace(/\D/g, '');
    return !/^(\d)\1+$/.test(digits) && luhn(digits);
  });
  add(/(?<![\w.])(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d[\d .-]{6,20}\d(?![\w.])/g, 'Phone number', value => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15 &&
      !/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(value) &&
      !/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(value) &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value);
  });
  for (const { kind, expression } of LABEL_EXPRESSIONS) {
    for (const match of text.matchAll(expression)) {
      const value = match[1];
      spans.push({ start: match.index + match[0].length - value.length, end: match.index + match[0].length, kind });
    }
  }
  // Prefer specific matches (email, keys, IDs) over broad phone and label candidates at the same location.
  const selected = [];
  for (const span of spans.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))) {
    if (!selected.some(existing => span.start < existing.end && span.end > existing.start)) selected.push(span);
  }
  return selected.sort((a, b) => a.start - b.start);
}
