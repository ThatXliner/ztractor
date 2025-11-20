/**
 * XRegExp Polyfill
 * Provides a lightweight XRegExp-compatible interface using native RegExp with Unicode support
 * This is NOT a full XRegExp implementation, but covers common translator use cases
 */

interface XRegExpConstructor {
  (pattern: string | RegExp, flags?: string): RegExp;
  exec(str: string, regex: RegExp, pos?: number, sticky?: boolean): RegExpExecArray | null;
  test(str: string, regex: RegExp, pos?: number): boolean;
  match(str: string, regex: RegExp, scope?: string): RegExpExecArray[] | null;
  replace(str: string, search: RegExp, replacement: string | ((match: any) => string)): string;
  split(str: string, separator: RegExp, limit?: number): string[];
  matchChain(str: string, chain: Array<{ regex: RegExp; backref?: number }>): any[];
  union(patterns: Array<string | RegExp>, flags?: string): RegExp;
  escape(str: string): string;
  build(pattern: string, subs?: any[], flags?: string): RegExp;
}

/**
 * XRegExp constructor - wraps native RegExp with Unicode flag when needed
 */
function XRegExp(pattern: string | RegExp, flags?: string): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  // Add 'u' flag for Unicode support if not present
  if (flags && !flags.includes('u')) {
    flags += 'u';
  } else if (!flags) {
    flags = 'u';
  }

  try {
    return new RegExp(pattern, flags);
  } catch (e) {
    // If Unicode flag causes issues, try without it
    const fallbackFlags = flags.replace('u', '');
    return new RegExp(pattern, fallbackFlags);
  }
}

/**
 * Execute regex at a specific position
 */
XRegExp.exec = function(str: string, regex: RegExp, pos: number = 0, sticky: boolean = false): RegExpExecArray | null {
  if (pos > 0) {
    str = str.slice(pos);
  }

  const result = regex.exec(str);
  if (result && pos > 0) {
    result.index += pos;
  }

  return result;
};

/**
 * Test regex at a specific position
 */
XRegExp.test = function(str: string, regex: RegExp, pos: number = 0): boolean {
  if (pos > 0) {
    str = str.slice(pos);
  }
  return regex.test(str);
};

/**
 * Match all occurrences
 */
XRegExp.match = function(str: string, regex: RegExp, scope: string = 'all'): RegExpExecArray[] | null {
  const matches: RegExpExecArray[] = [];

  if (scope === 'one') {
    const match = regex.exec(str);
    return match ? [match] : null;
  }

  // Ensure global flag for 'all' scope
  const globalRegex = regex.global ? regex : new RegExp(regex.source, regex.flags + 'g');

  let match;
  while ((match = globalRegex.exec(str)) !== null) {
    matches.push(match);
    // Prevent infinite loop on zero-width matches
    if (match.index === globalRegex.lastIndex) {
      globalRegex.lastIndex++;
    }
  }

  return matches.length > 0 ? matches : null;
};

/**
 * Replace with XRegExp semantics
 */
XRegExp.replace = function(
  str: string,
  search: RegExp,
  replacement: string | ((match: any) => string)
): string {
  if (typeof replacement === 'function') {
    return str.replace(search, replacement as any);
  }
  return str.replace(search, replacement);
};

/**
 * Split string with regex
 */
XRegExp.split = function(str: string, separator: RegExp, limit?: number): string[] {
  return str.split(separator, limit);
};

/**
 * Match chain - match successive patterns
 */
XRegExp.matchChain = function(str: string, chain: Array<{ regex: RegExp; backref?: number }>): any[] {
  let matches: any[] = [str];

  for (const item of chain) {
    const nextMatches: any[] = [];

    for (const match of matches) {
      const text = typeof match === 'string' ? match : match[item.backref || 0];
      const results = XRegExp.match(text, item.regex);

      if (results) {
        nextMatches.push(...results);
      }
    }

    matches = nextMatches;
  }

  return matches;
};

/**
 * Union of patterns
 */
XRegExp.union = function(patterns: Array<string | RegExp>, flags?: string): RegExp {
  const sources = patterns.map((p) => {
    if (p instanceof RegExp) {
      return p.source;
    }
    return p;
  });

  const pattern = sources.join('|');
  return XRegExp(pattern, flags);
};

/**
 * Escape special regex characters
 */
XRegExp.escape = function(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Build regex with substitutions
 */
XRegExp.build = function(pattern: string, subs?: any[], flags?: string): RegExp {
  if (subs && Array.isArray(subs)) {
    // Simple substitution - replace {{name}} with patterns
    for (let i = 0; i < subs.length; i++) {
      const sub = subs[i];
      if (typeof sub === 'object' && sub.pattern) {
        pattern = pattern.replace(`{{${i}}}`, sub.pattern);
      } else if (sub instanceof RegExp) {
        pattern = pattern.replace(`{{${i}}}`, sub.source);
      } else {
        pattern = pattern.replace(`{{${i}}}`, String(sub));
      }
    }
  }

  return XRegExp(pattern, flags);
};

// Export as XRegExp constructor with static methods
export const XRegExpPolyfill = XRegExp as any as XRegExpConstructor;

// Default export
export default XRegExpPolyfill;
