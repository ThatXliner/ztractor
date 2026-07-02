import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { extractMetadata } from "../src/index";
import { DOMParser, parseHTMLDocument } from "../../node/src/dom-utils";

const wikipediaHtml = `<!doctype html>
<html lang="en">
	<head>
		<title>Zotero - Wikipedia</title>
	</head>
	<body class="action-view">
		<h1 id="firstHeading">Zotero</h1>
		<ul>
			<li id="t-permalink"><a href="/w/index.php?title=Zotero&oldid=12345">Permanent link</a></li>
		</ul>
	</body>
</html>`;

describe("upstream Zotero runtime executor", () => {
	afterEach(() => {
		(globalThis.fetch as any)?.mockRestore?.();
	});

	test("runs a real bundled Zotero web translator end-to-end", async () => {
		spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestUrl = String(url);
			if (requestUrl.includes("/w/api.php")) {
				return new Response(JSON.stringify({
					query: {
						pages: {
							"12345": {
								touched: "2026-01-02T03:04:05Z",
								displaytitle: "Zotero",
								extract: "Zotero is free and open-source reference management software.",
							},
						},
					},
				}), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			throw new Error(`Unexpected fetch: ${requestUrl}`);
		});

		const result = await extractMetadata({
			url: "https://en.wikipedia.org/wiki/Zotero",
			html: wikipediaHtml,
			dependencies: {
				DOMParser,
				parseHTMLDocument,
			},
		});

		expect(result.success).toBe(true);
		expect(result.translator).toBe("Wikipedia");
		expect(result.items).toHaveLength(1);
		expect(result.items?.[0]).toMatchObject({
			itemType: "encyclopediaArticle",
			title: "Zotero",
			encyclopediaTitle: "Wikipedia",
			rights: "Creative Commons Attribution-ShareAlike License",
			url: "https://en.wikipedia.org/w/index.php?title=Zotero&oldid=12345",
			abstractNote: "Zotero is free and open-source reference management software.",
		});
	});
});
