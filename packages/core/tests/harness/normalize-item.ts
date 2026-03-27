export function normalizeItem(item: Record<string, unknown>): Record<string, unknown> {
	const normalized = JSON.parse(JSON.stringify(item));

	// Remove fields always ignored by Zotero's sanitizeItem
	delete normalized.accessDate;

	// Normalize attachments
	if (Array.isArray(normalized.attachments)) {
		for (const att of normalized.attachments as Record<string, unknown>[]) {
			if (att.document) {
				delete att.document;
				att.mimeType = 'text/html';
			}
			delete att.url;
			delete att.complete;
		}
	}

	// Normalize tags: convert string tags to objects, sort alphabetically
	if (Array.isArray(normalized.tags)) {
		normalized.tags = (normalized.tags as any[])
			.map((t: any) => typeof t === 'string' ? { tag: t } : t)
			.sort((a: any, b: any) => {
				const tagA = (a.tag ?? '').toLowerCase();
				const tagB = (b.tag ?? '').toLowerCase();
				return tagA < tagB ? -1 : tagA > tagB ? 1 : 0;
			});
	}

	// Remove empty arrays and empty strings to avoid false mismatches
	for (const [key, value] of Object.entries(normalized)) {
		if (Array.isArray(value) && value.length === 0) {
			delete normalized[key];
		}
	}

	return normalized;
}
