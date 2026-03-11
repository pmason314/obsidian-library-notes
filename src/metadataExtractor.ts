import { App, TFile } from "obsidian";
import { BookMetadata, ExtractionResult, MediaNoteSettings, ZoteroCache } from "types";
import { ZoteroClient } from "zotero/zoteroClient";
import { ZoteroItem } from "zotero/zoteroTypes";
import { openZoteroPickerModal } from "ui/ZoteroPickerModal";
import { filenameToSearchQuery, withFallbackMetadata } from "utils/fallbacks";

function sanitizeZoteroTag(tag: string): string | null {
	const sanitized = tag
		.trim()
		.toLowerCase()
		.replace(/[\s_]+/g, "-")
		.replace(/[^a-z-]/g, "");
	if (!sanitized || /^-|-$/.test(sanitized)) return null;
	return sanitized;
}

function mapZoteroItem(item: ZoteroItem): Partial<BookMetadata> {
	const data = item.data;

	const firstAuthor = data.creators?.find((c) => c.creatorType === "author");
	let author: string | null = null;
	if (firstAuthor) {
		if (firstAuthor.firstName && firstAuthor.lastName) {
			author = `${firstAuthor.firstName} ${firstAuthor.lastName}`;
		} else {
			author = firstAuthor.lastName ?? firstAuthor.name ?? null;
		}
	}

	return {
		title: data.title ?? null,
		author,
		year: data.date ?? null,
		publisher: data.publisher ?? null,
		edition: data.edition ?? null,
		language: data.language ?? null,
		isbn: data.ISBN ?? null,
		dateAdded: data.dateAdded ? data.dateAdded.slice(0, 10) : null,
		tags: data.tags
			?.map((t) => sanitizeZoteroTag(t.tag))
			.filter((t): t is string => t !== null) ?? [],
	};
}

export async function extractMetadataFromFile(
	file: TFile,
	_binary: ArrayBuffer,
	app: App,
	settings: MediaNoteSettings,
	zoteroCache: ZoteroCache,
	isBatch: boolean,
): Promise<ExtractionResult> {
	const warnings: string[] = [];

	// Cache hit
	const cached = zoteroCache[file.path];
	if (cached) {
		return { metadata: withFallbackMetadata(cached.metadata, file.path), warnings };
	}

	// Fall back to filename if Zotero is not configured
	if (!settings.zoteroUserId) {
		return { metadata: withFallbackMetadata({}, file.path), warnings };
	}

	const apiKey = app.secretStorage.getSecret(settings.zoteroApiKeyName) ?? "";
	const client = new ZoteroClient(settings.zoteroUserId, apiKey);
	const searchTitle = filenameToSearchQuery(file.path);

	let items: ZoteroItem[] = [];
	try {
		items = await client.searchByTitle(searchTitle);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.warn(`[Zotero] Lookup error for "${file.path}": ${msg}`);
		warnings.push(`Zotero lookup failed: ${msg}`);
		return { metadata: withFallbackMetadata({}, file.path), warnings };
	}

	if (items.length === 0) {
		console.warn(`[Zotero] No matches found for "${searchTitle}" — falling back to filename`);
		warnings.push(`No Zotero match found for "${searchTitle}". Using filename.`);
		return { metadata: withFallbackMetadata({}, file.path), warnings };
	}

	const normalize = (s: string) =>
		s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

	const normalizedQuery = normalize(searchTitle);

	// Prefer an exact title match when multiple results are returned,
	const exactMatch = items.find(
		(item) => normalize(item.data.title ?? "") === normalizedQuery
	);

	let chosen: ZoteroItem;
	if (items.length === 1) {
		chosen = items[0]!;
	} else if (exactMatch) {
		chosen = exactMatch;
	} else if (isBatch) {
		chosen = items[0]!;
	} else {
		const picked = await openZoteroPickerModal(app, items);
		if (!picked) {
			return { metadata: withFallbackMetadata({}, file.path), warnings };
		}
		chosen = picked;
	}

	const partial = mapZoteroItem(chosen);
	zoteroCache[file.path] = { itemKey: chosen.key, fetchedAt: Date.now(), metadata: partial };

	return { metadata: withFallbackMetadata(partial, file.path), warnings };
}
