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

	test("uses the final redirected URL to select a targeted translator", async () => {
		spyOn(globalThis, "fetch").mockResolvedValue({
			status: 200,
			statusText: "OK",
			url: "http://patft.uspto.gov/netacgi/nph-Parser?query=test",
			text: async () => "<html><head><title>Search Results:</title></head></html>",
		} as Response);

		const result = await extractMetadata({
			url: "https://source.example/start",
			dependencies: { DOMParser, parseHTMLDocument },
		});

		expect(result.success).toBe(false);
		expect(result.error).toBe("Open an individual article page; this page contains multiple items");
		expect(result.diagnostics?.[0]?.translator).toBe("Patents - USPTO");
	});

	test("settles promptly when the caller aborts a hung translator", async () => {
		spyOn(globalThis, "fetch").mockImplementation(async () => await new Promise<Response>(() => {}));
		const controller = new AbortController();
		const resultPromise = extractMetadata({
			url: "https://en.wikipedia.org/wiki/Zotero",
			html: wikipediaHtml,
			signal: controller.signal,
			dependencies: { DOMParser, parseHTMLDocument },
		});
		setTimeout(() => controller.abort(new Error("caller cancelled")), 0);

		const result = await Promise.race([
			resultPromise,
			new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error("abort did not settle")), 100)),
		]);

		expect(result.success).toBe(false);
		expect(result.error).toBe("caller cancelled");
	});

	test("extracts embedded citation metadata offline", async () => {
		spyOn(globalThis, "fetch").mockImplementation(async () => {
			throw new Error("network must not be called");
		});
		const result = await extractMetadata({
			url: "https://evidence.example/article",
			html: `<!doctype html><html><head>
				<meta name="citation_title" content="Reliable evidence">
				<meta name="citation_author" content="Doe, Jane">
				<meta name="citation_author" content="Smith, Sam">
				<meta name="citation_publication_date" content="2024-02-03">
				<meta name="citation_journal_title" content="Evidence Review">
			</head><body></body></html>`,
			network: "deny",
			dependencies: { DOMParser, parseHTMLDocument },
		});

		expect(result.success).toBe(true);
		expect(result.translator).toBe("Embedded Metadata");
		expect(result.items?.[0]).toMatchObject({
			title: "Reliable evidence",
			date: "2024-02-03",
			publicationTitle: "Evidence Review",
			creators: [
				{ firstName: "Jane", lastName: "Doe", creatorType: "author" },
				{ firstName: "Sam", lastName: "Smith", creatorType: "author" },
			],
		});
	});

	test("does not fetch supplied empty HTML or a supplied document", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => {
			throw new Error("fetch must not be called");
		});
		const document = parseHTMLDocument("<html><head></head><body></body></html>", "https://document.example/article");

		await extractMetadata({
			url: "https://empty.example/article",
			html: "",
			network: "deny",
			dependencies: { DOMParser, parseHTMLDocument },
		});
		await extractMetadata({
			url: "https://document.example/article",
			document,
			network: "deny",
			dependencies: { DOMParser, parseHTMLDocument },
		});

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("rejects network-denied extraction without supplied page data before fetch", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => {
			throw new Error("fetch must not be called");
		});

		const result = await extractMetadata({
			url: "https://deny.example/article",
			network: "deny",
			dependencies: { DOMParser, parseHTMLDocument },
		});

		expect(result).toMatchObject({
			success: false,
			error: "Network access denied for https://deny.example/article",
		});
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
