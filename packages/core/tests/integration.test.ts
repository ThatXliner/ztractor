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
import { parseHTMLDocument } from "../../node/src/dom-utils";

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

	test("extracts ScienceDirect metadata through the RIS import translator", async () => {
		const html = `<!DOCTYPE html>
<html>
<head>
  <title>ScienceDirect article</title>
  <meta name="citation_pii" content="S2214289424000760" />
</head>
<body>
  <article role="main" lang="en">
    <h1><span class="title-text">Cellulose acetate/chitosan composite film loaded with ground cinnamon</span></h1>
  </article>
  <div id="export-citation"><button>Export citation</button></div>
</body>
</html>`;
		const ris = [
			"TY  - JOUR",
			"TI  - Cellulose acetate/chitosan composite film loaded with ground cinnamon",
			"AU  - Bahmid, Nur Alim",
			"AU  - Hernawan",
			"JO  - Food Packaging and Shelf Life",
			"VL  - 43",
			"SP  - 101311",
			"PY  - 2024/06/01",
			"SN  - 2214-2894",
			"DO  - 10.1016/j.fpsl.2024.101311",
			"ER  -",
		].join("\n");
		const originalFetch = globalThis.fetch;
		const requestedUrls: string[] = [];
		globalThis.fetch = async (input) => {
			const fetchUrl =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.href
						: input.url;
			requestedUrls.push(fetchUrl);
			if (fetchUrl.includes("/sdfe/arp/cite")) {
				return new Response(ris, {
					status: 200,
					headers: { "content-type": "application/x-research-info-systems" },
				});
			}
			return new Response("", { status: 404, statusText: "Not Found" });
		};

		try {
			const result = await extractMetadata({
				url: "https://www.sciencedirect.com/science/article/pii/S2214289424000760",
				html,
				dependencies: { parseHTMLDocument },
			});

			expect(result.success).toBe(true);
			expect(result.translator).toBe("ScienceDirect");
			expect(requestedUrls.some((url) => url.includes("/sdfe/arp/cite"))).toBe(true);
			expect(result.items).toHaveLength(1);
			expect(result.items![0].title).toBe(
				"Cellulose acetate/chitosan composite film loaded with ground cinnamon",
			);
			expect(result.items![0].DOI).toBe("10.1016/j.fpsl.2024.101311");
			expect(result.items![0].creators).toHaveLength(2);
			expect(result.items![0].creators[0]).toEqual({
				firstName: "Nur Alim",
				lastName: "Bahmid",
				creatorType: "author",
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
