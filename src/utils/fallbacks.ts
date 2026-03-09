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

function filenameToTitle(filePath: string): string {
	const withoutFolders = filePath.split("/").pop() ?? filePath;
	const withoutExtension = withoutFolders.replace(/\.[^.]+$/, "");
	const spaced = withoutExtension.replace(/[-_]+/g, " ");
	const collapsed = spaced.replace(/\s+/g, " ").trim();
	return collapsed.length > 0 ? collapsed : "Untitled";
}

export function withFallbackMetadata(metadata: Partial<BookMetadata>, sourceFile: string): BookMetadata {
	const fallbackTitle = filenameToTitle(sourceFile);

	return {
		title: sanitizeMetadataValue(metadata.title) ?? fallbackTitle,
		author: sanitizeMetadataValue(metadata.author),
		year: extractYear(metadata.year),
		publisher: sanitizeMetadataValue(metadata.publisher),
		language: sanitizeMetadataValue(metadata.language),
		sourceFile,
	};
}
