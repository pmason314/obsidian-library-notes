import { BookMetadata } from "types";

function sanitizeMetadataValue(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}

	const trimmed = value.replace(/\s+/g, " ").trim();
	return trimmed.length > 0 ? trimmed : null;
}

function extractYear(value: string | null | undefined): string | null {
	const sanitized = sanitizeMetadataValue(value);
	if (!sanitized) {
		return null;
	}

	const match = sanitized.match(/(?:^|\D)(\d{4})(?:\D|$)/);
	return match?.[1] ?? null;
}

export function filenameToTitle(filePath: string): string {
	const withoutFolders = filePath.split("/").pop() ?? filePath;
	const withoutExtension = withoutFolders.replace(/\.[^.]+$/, "");
	const spaced = withoutExtension.replace(/[-_]+/g, " ");
	const collapsed = spaced.replace(/\s+/g, " ").trim();
	return collapsed.length > 0 ? collapsed : "Untitled";
}

/**
 * Derive a search query from a filename by stripping noise that won't appear
 * in Zotero titles: years in parentheses, edition markers, and bracketed content.
 */
export function filenameToSearchQuery(filePath: string): string {
	const base = filenameToTitle(filePath);
	return base
		.replace(/\(\d{4}\)/g, "")               // (2018)
		.replace(/\[\d{4}\]/g, "")               // [2018]
		.replace(/\b\d{4}\b/g, "")               // bare 4-digit year
		.replace(/\b\d+(st|nd|rd|th)\s+ed(ition)?\b/gi, "")  // 2nd edition
		.replace(/\bedition\b/gi, "")
		.replace(/\s+/g, " ")
		.trim();
}

export function withFallbackMetadata(metadata: Partial<BookMetadata>, sourceFile: string): BookMetadata {
	const fallbackTitle = filenameToTitle(sourceFile);

	return {
		title: sanitizeMetadataValue(metadata.title) ?? fallbackTitle,
		author: sanitizeMetadataValue(metadata.author),
		year: extractYear(metadata.year),
		publisher: sanitizeMetadataValue(metadata.publisher),
		edition: sanitizeMetadataValue(metadata.edition),
		language: sanitizeMetadataValue(metadata.language),
		isbn: sanitizeMetadataValue(metadata.isbn),
		dateAdded: sanitizeMetadataValue(metadata.dateAdded),
		tags: metadata.tags ?? [],
		sourceFile,
	};
}
