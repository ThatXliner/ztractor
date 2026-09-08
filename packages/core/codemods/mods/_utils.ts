export function replaceOnce(source: string, search: string, replacement: string, modId: string): string {
	const firstIndex = source.indexOf(search);
	if (firstIndex === -1) {
		throw new Error(`${modId}: expected anchor was not found`);
	}

	const secondIndex = source.indexOf(search, firstIndex + search.length);
	if (secondIndex !== -1) {
		throw new Error(`${modId}: expected anchor matched more than once`);
	}

	return source.slice(0, firstIndex) + replacement + source.slice(firstIndex + search.length);
}

export function normalizeIndent(snippet: string): string {
	const lines = snippet.replace(/^\n/, "").replace(/\n\t*$/, "").split("\n");
	const indent = lines
		.filter((line) => line.trim())
		.reduce<number | null>((min, line) => {
			const length = line.match(/^\t*/)?.[0].length ?? 0;
			return min === null ? length : Math.min(min, length);
		}, null);

	if (!indent) return lines.join("\n");
	return lines.map((line) => line.slice(indent)).join("\n");
}
