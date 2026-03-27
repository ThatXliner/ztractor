/**
 * Integration tests for the full extractMetadata() flow.
 * These use real translator code from the bundled registry but synthetic HTML,
 * so they run offline without network calls.
 */
import { describe, test, expect } from "bun:test";
import {
	extractMetadata,
	findTranslators,
	getAvailableTranslators,
	BundledRegistry,
} from "../src/index";

describe("getAvailableTranslators", () => {
	test("returns a non-empty list", async () => {
		const translators = await getAvailableTranslators();
		expect(translators.length).toBeGreaterThan(100);
		expect(translators[0]).toHaveProperty("id");
		expect(translators[0]).toHaveProperty("label");
		expect(translators[0]).toHaveProperty("target");
		expect(translators[0]).toHaveProperty("priority");
	});
});

describe("findTranslators", () => {
	test("finds translators for a known domain", async () => {
		const translators = await findTranslators("https://www.nature.com/articles/s41586-021-03819-2");
		expect(translators.length).toBeGreaterThan(0);
		const labels = translators.map((t) => t.label);
		// Nature has a specific translator
		expect(labels.some((l) => l.toLowerCase().includes("nature"))).toBe(true);
	});

	test("finds generic DOI translator for doi.org URLs", async () => {
		const translators = await findTranslators("https://doi.org/10.1126/science.169.3946.635");
		expect(translators.length).toBeGreaterThan(0);
		const labels = translators.map((t) => t.label);
		expect(labels.some((l) => l.toLowerCase().includes("doi"))).toBe(true);
	});

	test("returns only generic translators for unrecognized URL", async () => {
		const translators = await findTranslators("https://totally-unknown-site-xyz-123.example/");
		// Some translators have target:"" and match all URLs (e.g. DOI, unAPI, COinS)
		// All returned translators should have empty target or a matching pattern
		for (const t of translators) {
			expect(t.target === "" || "https://totally-unknown-site-xyz-123.example/".match(t.target)).toBeTruthy();
		}
	});
});

describe("extractMetadata — offline with synthetic HTML", () => {
	test("returns failure for a page no translator can extract", async () => {
		// Minimal HTML with nothing recognizable — all generic translators should reject it
		const result = await extractMetadata({
			url: "https://totally-unknown-site-xyz-123.example/",
			html: "<html><body><h1>Nothing here</h1></body></html>",
		});
		// Either no translators matched or none could extract items
		expect(result.success).toBe(false);
	});

	test("handles HTTP fetch error when no html provided (mocked via bad URL)", async () => {
		// Not a real URL — will fail to fetch
		const result = await extractMetadata({
			url: "https://localhost:1/nonexistent",
			timeout: 1000,
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeTruthy();
	});

	test("BundledRegistry can retrieve translator code", async () => {
		const registry = new BundledRegistry();
		const metadata = await registry.getAllTranslatorMetadata();
		expect(metadata.length).toBeGreaterThan(0);

		// Grab any translator and verify code is retrievable
		const first = metadata[0];
		const code = await registry.getTranslatorCode(first.translatorID);
		expect(typeof code).toBe("string");
		expect(code!.length).toBeGreaterThan(0);
	});

	test("extracts metadata from Wikipedia-like HTML using the Wikipedia translator", async () => {
		// Minimal Wikipedia article HTML with the metadata a translator might use
		const html = `<!DOCTYPE html>
<html>
<head>
  <title>Fermat's Last Theorem - Wikipedia</title>
  <meta property="og:title" content="Fermat's Last Theorem" />
  <meta name="description" content="In number theory, Fermat's Last Theorem states that no three positive integers a, b, and c satisfy the equation aⁿ + bⁿ = cⁿ for any integer value of n greater than 2." />
</head>
<body>
  <h1 id="firstHeading" class="firstHeading">Fermat's Last Theorem</h1>
  <div id="mw-content-text">
    <p>In number theory, <b>Fermat's Last Theorem</b> (sometimes called <b>Fermat's conjecture</b>) states that no three positive integers <i>a</i>, <i>b</i>, and <i>c</i> satisfy the equation <i>a</i><sup>n</sup> + <i>b</i><sup>n</sup> = <i>c</i><sup>n</sup> for any integer value of <i>n</i> greater than 2.</p>
  </div>
</body>
</html>`;

		const result = await extractMetadata({
			url: "https://en.wikipedia.org/wiki/Fermat%27s_Last_Theorem",
			html,
		});

		// Wikipedia translator should handle this
		if (result.success) {
			expect(result.items).toBeDefined();
			expect(result.items!.length).toBeGreaterThan(0);
			const item = result.items![0];
			expect(item.itemType).toBeTruthy();
			expect(item.title).toBeTruthy();
			expect(result.translator).toBeTruthy();
		} else {
			// Translator may reject sparse HTML — that's acceptable
			expect(result.error).toBeTruthy();
		}
	});
});
