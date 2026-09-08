import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { DOMParser, parseHTMLDocument } from "../../node/src/dom-utils";
import {
	createZoteroHostAdapters,
	NetworkAccessDenied,
} from "../src/host/zotero-host";

const dependencies = { DOMParser, parseHTMLDocument };

function createHost(options: Parameters<typeof createZoteroHostAdapters>[0] = { entries: [], dependencies }) {
	return createZoteroHostAdapters({ entries: [], dependencies, ...options });
}

describe("Zotero runtime host", () => {
	afterEach(() => {
		(globalThis.fetch as any)?.mockRestore?.();
	});

	test("denies direct and processDocuments requests before fetch", async () => {
		const fetchSpy = spyOn(globalThis, "fetch").mockImplementation(async () => {
			throw new Error("fetch must not be called");
		});
		const host = createHost({ entries: [], dependencies, network: "deny", baseUrl: "https://example.test" });

		await expect(host.http.request("GET", "/metadata")).rejects.toBeInstanceOf(NetworkAccessDenied);
		await expect(host.http.processDocuments("/document", async () => null)).rejects.toBeInstanceOf(NetworkAccessDenied);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	test("resolves relative URLs and preserves final URL, status, and XML responses", async () => {
		const calls: string[] = [];
		spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			calls.push(String(input));
			if (String(input).endsWith("missing")) return new Response("missing", { status: 404 });
			return {
				status: 200,
				url: "https://final.test/result.xml",
				headers: new Headers({ "content-type": "application/xml" }),
				text: async () => "<result><title>Example</title></result>",
			} as Response;
		});
		const host = createHost({ entries: [], dependencies, baseUrl: "https://origin.test/path/" });

		const result = await host.http.request("GET", "relative.xml", { responseType: "xml" });
		expect(calls).toEqual(["https://origin.test/path/relative.xml"]);
		expect(result.status).toBe(200);
		expect(result.responseURL).toBe("https://final.test/result.xml");
		expect((result.response as Document).documentElement.nodeName).toBe("result");
		await expect(host.http.request("GET", "missing")).rejects.toThrow("status 404");
	});

	test("aborts timed-out fetches and cleans up the request signal", async () => {
		let requestSignal: AbortSignal | undefined;
		spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
			requestSignal = init?.signal as AbortSignal;
			return await new Promise<Response>((_resolve, reject) => {
				requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), { once: true });
			});
		});
		const host = createHost({ entries: [], dependencies, timeout: 5 });

		await expect(host.http.request("GET", "https://slow.test/request")).rejects.toThrow("timed out after 5ms");
		expect(requestSignal?.aborted).toBe(true);
	});

	test("keeps concurrent hosts and their network policies isolated", async () => {
		const calls: string[] = [];
		spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			calls.push(String(input));
			await Promise.resolve();
			return new Response("ok", { status: 200 });
		});
		const first = createHost({ entries: [], dependencies, baseUrl: "https://first.test/" });
		const second = createHost({ entries: [], dependencies, baseUrl: "https://second.test/" });
		const denied = createHost({ entries: [], dependencies, network: "deny", baseUrl: "https://denied.test/" });

		const [firstResult, secondResult, deniedResult] = await Promise.all([
			first.http.request("GET", "article"),
			second.http.request("GET", "article"),
			denied.http.request("GET", "article").catch((error) => error),
		]);

		expect(firstResult.responseText).toBe("ok");
		expect(secondResult.responseText).toBe("ok");
		expect(deniedResult).toBeInstanceOf(NetworkAccessDenied);
		expect(calls.sort()).toEqual(["https://first.test/article", "https://second.test/article"]);
	});
});
