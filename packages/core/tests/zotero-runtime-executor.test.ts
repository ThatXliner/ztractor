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

const arxivHtml = `<!doctype html>
<html>
	<head>
		<title>Attention Is All You Need</title>
	</head>
	<body>
		<h1 class="title">Attention Is All You Need</h1>
	</body>
</html>`;

const arxivAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed>
	<entry>
		<id>http://arxiv.org/abs/1706.03762v1</id>
		<updated>2017-06-12T17:57:34Z</updated>
		<title>Attention Is All You Need</title>
		<summary>The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.</summary>
		<author><name>Ashish Vaswani</name></author>
		<author><name>Noam Shazeer</name></author>
		<category term="cs.CL" />
		<primary_category term="cs.CL" />
	</entry>
</feed>`;

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

	test("runs a mixed web/search Zotero translator through runtime HTTP", async () => {
		spyOn(globalThis, "fetch").mockImplementation(async (url: string | URL | Request) => {
			const requestUrl = String(url);
			if (requestUrl === "https://export.arxiv.org/api/query?id_list=1706.03762&max_results=1") {
				return new Response(arxivAtom, {
					status: 200,
					headers: { "content-type": "application/atom+xml" },
				});
			}
			throw new Error(`Unexpected fetch: ${requestUrl}`);
		});

		const result = await extractMetadata({
			url: "https://arxiv.org/abs/1706.03762",
			html: arxivHtml,
			dependencies: {
				DOMParser,
				parseHTMLDocument,
			},
		});

		expect(result.success).toBe(true);
		expect(result.translator).toBe("arXiv.org");
		expect(result.items).toHaveLength(1);
		expect(result.items?.[0]).toMatchObject({
			itemType: "preprint",
			title: "Attention Is All You Need",
			DOI: "10.48550/arXiv.1706.03762",
			url: "http://arxiv.org/abs/1706.03762",
			archiveID: "arXiv:1706.03762",
		});
		expect(result.items?.[0].creators).toHaveLength(2);
	});
});
