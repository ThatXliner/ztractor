function createLocationLike(url: string) {
	const parsedUrl = new URL(url);
	return {
		href: url,
		protocol: parsedUrl.protocol,
		host: parsedUrl.host,
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		pathname: parsedUrl.pathname,
		search: parsedUrl.search,
		hash: parsedUrl.hash,
		origin: parsedUrl.origin,
		toString: () => url,
	};
}

function canProxyOverride(doc: Document, prop: "URL" | "documentURI" | "location"): boolean {
	const descriptor = Object.getOwnPropertyDescriptor(doc, prop);
	if (!descriptor || descriptor.configurable) return true;
	if ("value" in descriptor) return Boolean(descriptor.writable);
	return descriptor.get !== undefined;
}

/**
 * Gives parsed documents the source URL expected by Zotero translators.
 * Browser Documents have native accessors and methods which reject a Proxy as
 * their receiver or a Node argument, so accessors run against the raw document
 * and document arguments are unwrapped before a native method is called.
 */
export function withDocumentLocation(doc: Document, url: string): Document {
	const location = createLocationLike(url);
	try {
		Object.defineProperty(doc, "URL", { value: url, configurable: true });
	} catch (_e) {}
	try {
		Object.defineProperty(doc, "documentURI", { value: url, configurable: true });
	} catch (_e) {}
	try {
		Object.defineProperty(doc, "location", { value: location, configurable: true });
		return doc;
	} catch (_e) {
		const canOverrideURL = canProxyOverride(doc, "URL");
		const canOverrideDocumentURI = canProxyOverride(doc, "documentURI");
		const canOverrideLocation = canProxyOverride(doc, "location");
		let proxy: Document;
		proxy = new Proxy(doc, {
			get(target, prop) {
				if (prop === "URL" && canOverrideURL) return url;
				if (prop === "documentURI" && canOverrideDocumentURI) return url;
				if (prop === "location" && canOverrideLocation) return location;
				const value = Reflect.get(target, prop, target);
				if (typeof value !== "function") return value;
				return (...args: unknown[]) => value.apply(target, args.map((arg) => arg === proxy ? target : arg));
			},
		});
		return proxy;
	}
}
