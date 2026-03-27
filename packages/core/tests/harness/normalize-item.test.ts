import { describe, test, expect } from 'bun:test';
import { normalizeItem } from './normalize-item';
import { compareItems } from './compare-items';

describe('normalizeItem', () => {
	test('removes accessDate', () => {
		const item = { itemType: 'webpage', title: 'T', accessDate: '2024-01-01' };
		const result = normalizeItem(item);
		expect(result.accessDate).toBeUndefined();
		expect(result.title).toBe('T');
	});

	test('normalizes attachment with document field', () => {
		const item = {
			itemType: 'webpage',
			attachments: [{ title: 'Snap', document: {}, url: 'https://x.com' }],
		};
		const result = normalizeItem(item);
		const att = (result.attachments as any[])[0];
		expect(att.mimeType).toBe('text/html');
		expect(att.document).toBeUndefined();
		expect(att.url).toBeUndefined();
	});

	test('sorts tags alphabetically', () => {
		const item = {
			itemType: 'webpage',
			tags: [{ tag: 'zebra' }, { tag: 'alpha' }, { tag: 'mango' }],
		};
		const result = normalizeItem(item);
		const tags = result.tags as any[];
		expect(tags[0].tag).toBe('alpha');
		expect(tags[1].tag).toBe('mango');
		expect(tags[2].tag).toBe('zebra');
	});

	test('converts string tags to objects and sorts', () => {
		const item = { itemType: 'webpage', tags: ['foo', 'bar'] };
		const result = normalizeItem(item);
		const tags = result.tags as any[];
		expect(tags[0]).toEqual({ tag: 'bar' });
		expect(tags[1]).toEqual({ tag: 'foo' });
	});

	test('removes empty arrays', () => {
		const item = { itemType: 'webpage', tags: [], notes: [] };
		const result = normalizeItem(item);
		expect(result.tags).toBeUndefined();
		expect(result.notes).toBeUndefined();
	});
});

describe('compareItems', () => {
	test('passes on matching items', () => {
		const item = { itemType: 'webpage', title: 'Same' };
		const result = compareItems([item], [item]);
		expect(result.status).toBe('pass');
	});

	test('fails on field mismatch', () => {
		const expected = [{ itemType: 'webpage', title: 'A' }];
		const actual = [{ itemType: 'webpage', title: 'B' }];
		const result = compareItems(expected, actual);
		expect(result.status).toBe('fail');
		expect(result.details).toBeDefined();
		expect(result.details!.some(d => d.field.includes('title'))).toBe(true);
	});

	test('allows extra fields in actual', () => {
		const expected = [{ itemType: 'webpage', title: 'T' }];
		const actual = [{ itemType: 'webpage', title: 'T', extra: 'stuff' }];
		const result = compareItems(expected, actual);
		expect(result.status).toBe('pass');
	});

	test('fails on item count mismatch', () => {
		const expected = [{ itemType: 'webpage', title: 'T' }];
		const actual = [{ itemType: 'webpage', title: 'T' }, { itemType: 'webpage', title: 'U' }];
		const result = compareItems(expected, actual);
		expect(result.status).toBe('fail');
		expect(result.reason).toContain('Expected 1');
	});
});
