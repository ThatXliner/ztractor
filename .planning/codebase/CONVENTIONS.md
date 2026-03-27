# Coding Conventions

**Analysis Date:** 2026-03-26

## Naming Patterns

**Files:**
- camelCase for function/module files: `translator-loader.ts`, `translator-system-modern.ts`
- kebab-case for hyphenated names: `translator-system-modern.ts`, `utilities-translate-bundle.ts`
- Types file: `types.ts`
- Registry file: `registry.ts`

**Functions:**
- camelCase: `extractMetadata()`, `findTranslators()`, `parseHTMLDocument()`, `createZoteroUtilities()`
- Verb-first naming pattern for main operations: `extractMetadata()`, `parseTranslatorMetadata()`, `loadTranslator()`, `matchesTarget()`
- Helper functions use clear intent: `createMockDocument()`, `createZoteroUtilities()`, `createSandbox()`

**Variables:**
- camelCase: `translatorID`, `itemType`, `htmlContent`, `matchingMetadata`
- Const-first pattern for immutable data: `const defaultRegistry = new BundledRegistry()`
- Private properties prefix underscore: `_TRANSLATORS_REGISTRY`, `_setComplete()`, `_debug()`
- Destructuring for function parameters: `const { url, html, headers, timeout = 30000, dependencies, registry } = opts`

**Types:**
- PascalCase for classes and interfaces: `ZoteroItem`, `TranslatorExecutor`, `SandboxManager`
- CapitalCase for union types: `ItemType`, `CreatorType`
- Interface names prefixed with `I` is NOT used; prefer bare names: `Creator`, `Tag`, `Note`, `Attachment`
- Type imports explicitly marked: `import type { ItemType, Translator } from './types'`

## Code Style

**Formatting:**
- No formatter configured (biome was deleted from root, `.prettierrc` not present)
- Tab indentation appears to be standard (seen in package.json)
- Line length follows natural code breaks, not strict limit
- Comments use `//` for single-line, `/** */` for JSDoc blocks

**Linting:**
- No eslint config in root or core package
- Biome was used but removed (noted in git status as deleted)
- Strict TypeScript enabled: `"strict": true` in `tsconfig.json`
- Additional strict rules enabled:
  - `noFallthroughCasesInSwitch: true`
  - `noUncheckedIndexedAccess: true`
  - `noImplicitOverride: true`
- Disabled strict rules:
  - `noUnusedLocals: false` (intentionally off)
  - `noUnusedParameters: false` (intentionally off)
  - `noPropertyAccessFromIndexSignature: false` (intentionally off)

## Import Organization

**Order:**
1. Type imports: `import type { ItemType, Translator } from "./types"`
2. Value imports: `import { SandboxManager } from "./translator-system-modern"`
3. Relative path imports: `import { Zotero } from "./utilities-translate-bundle"`

**Path Aliases:**
- `ztractor` alias points to `./src/index.ts` in packages/core tsconfig
- Workspace: dependencies use `workspace:*` in packages/node for local linking

**Module System:**
- ES modules throughout: `"type": "module"` in package.json
- Preserve module syntax: `"module": "Preserve"` in tsconfig
- Bundler module resolution: `"moduleResolution": "bundler"`

## Error Handling

**Patterns:**
- Try-catch blocks used for regressive errors: In `parseTranslatorMetadata()` and `matchesTarget()`
- Console.error for logging: `console.error("Error parsing translator metadata:", e)`
- Return `null` for failed parsing: `return null` when metadata parse fails
- Silent catches with fallback: `} catch (_e) { return false; }` in `matchesTarget()`
- Result objects for errors: `{ success: false, error: "message" }` in `extractMetadata()`
- Promise rejection handling: `.catch()` not used; errors bubble up or return failure objects
- Error context passed: `catch (e) { console.error(\`Error in detectWeb for ${translator.metadata.label}:\`, e) }`

**Patterns for translators:**
- Errors in translator execution return empty array: `expect(items).toEqual([])` on error
- Translator errors don't crash extraction: `catch (e) { /* Try next translator */ continue; }`

## Logging

**Framework:** console (native)

**Patterns:**
- Debug mode via environment: `process.env?.DEBUG_TRANSLATORS` for conditional debug logs
- Error logging with context: `console.error(\`Error in detectWeb for ${translator.metadata.label}:\`, e)`
- Debug logs with prefix: `console.log('[ZU]', msg)` when `DEBUG_TRANSLATORS` enabled
- Minimal logging in core: Most logging happens in error paths only

## Comments

**When to Comment:**
- Complex algorithms: `// Build the augmented code` before code transformation
- Intent clarification: `// Lower number = higher priority` for sort operations
- Browser compatibility notes: `// read-only in some environments — ignore`
- Zotero API compatibility: Comments explaining why specific handling exists
- Type narrowing: Comments explain guard conditions

**JSDoc/TSDoc:**
- Used for public functions only
- Block format with @example for main exports: See `extractMetadata()` with full example
- Parameter docs: Rare; types are relied upon instead
- Links to related functions: `@example` blocks shown
- Property descriptions in interfaces: Minimal; types are self-documenting

**Example:**
```typescript
/**
 * Extract structured metadata from a URL using Zotero's web translators.
 *
 * @example
 * ```ts
 * const result = await extractMetadata('https://doi.org/10.1126/science.169.3946.635');
 * if (result.success) console.log(result.items[0].title);
 * ```
 */
export async function extractMetadata(
  options: string | ExtractMetadataOptions,
): Promise<ExtractMetadataResult>
```

## Function Design

**Size:** Functions stay focused: typically 20-50 lines, longer only for setup logic

**Parameters:**
- Single object parameter for multiple options: `extractMetadata(options: string | ExtractMetadataOptions)`
- Destructuring in function body for clarity: `const { url, html, headers, timeout = 30000 } = opts`
- Type-safe defaults: `timeout = 30000` in destructuring
- Operator overloading pattern: `typeof options === "string" ? { url: options } : options`

**Return Values:**
- Union types for success/failure: `Promise<ExtractMetadataResult>` with `{ success: boolean, error?: string }`
- Null for "not found": `return null` in `parseTranslatorMetadata()`
- Empty array for "no items": `return []` in failed translator execution
- Typed arrays: `Promise<ZoteroItem[]>` is explicit

## Module Design

**Exports:**
- Named exports for functions: `export async function extractMetadata()`
- Default export avoided: Files export multiple related functions
- Type exports on separate lines: `export type { ExtractMetadataOptions, ExtractMetadataResult }`
- Barrel re-exports used: `export { BundledRegistry, HTTPRegistry } from "./registry"`

**Barrel Files:**
- Main `index.ts` re-exports public API
- No nested barrel files (one level only)

**Internal vs Public:**
- Private methods use underscore: `_setComplete()`, `_TRANSLATORS_REGISTRY`
- Abstract base classes define contracts: `abstract class TranslatorRegistry`
- Concrete implementations extend: `class BundledRegistry extends TranslatorRegistry`

## Class Patterns

**Construction:**
- Public constructor with optional options: `constructor(options: TranslatorExecutorOptions = {})`
- Spread defaults in constructor: `this.options = { ...options }`
- Lazy initialization: Registry loads translators on first access

**Methods:**
- Private methods prefixed underscore: `private injectSandboxVariables()`
- Method chaining avoided
- Private utility methods kept small: `private executeInContext()`

**Properties:**
- Public readonly where no mutation: `public sandbox: SandboxGlobals`
- Private properties with underscore: `private options: TranslatorExecutorOptions`
- Type definitions in property signatures

## TypeScript Patterns

**Generics:**
- Minimal generic usage: `get<T = any>(key: string): T | undefined`
- Type parameters with defaults: `<T = any>` avoids caller burden
- No complex generic constraints

**Type Guards:**
- Early returns for null checks: `if (!docOrElem) return null`
- Conditional type narrowing: `if (typeof attrNameOrUndef === 'string') { ... }`
- Type casting only when necessary: Avoided when possible

**as any:**
- Used strategically for Zotero API compatibility: `as any` for dynamically built Zotero object
- Not used in test code (prefer assertions)
- Limited to integration boundaries

---

*Convention analysis: 2026-03-26*
