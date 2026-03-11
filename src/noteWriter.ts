import { App, TFile } from "obsidian";
import { extractMetadataFromFile } from "metadataExtractor";
import { MediaNoteSettings, NoteWriteResult, BookMetadata, ZoteroCache } from "types";
import { normalizeVaultPath } from "utils/paths";
import { filenameToTitle } from "utils/fallbacks";

// Any frontmatter key NOT in this set is treated as user-managed and is preserved.
const ZOTERO_FRONTMATTER_KEYS = new Set([
	"title", "author", "year", "publisher", "edition", "language", "isbn", "date_added", "tags", "file",
]);

function sanitizeFilename(value: string): string {
	return value.replace(/[/\\:*?"<>|]/g, "").trim() || "Untitled";
}

function quoteYaml(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
}

export function generateFrontmatter(metadata: BookMetadata): string {
	const lines: string[] = ["---"];

	if (metadata.title) lines.push(`title: ${quoteYaml(metadata.title)}`);
	if (metadata.author) lines.push(`author: ${quoteYaml(metadata.author)}`);
	if (metadata.year) lines.push(`year: ${quoteYaml(metadata.year)}`);
	if (metadata.publisher) lines.push(`publisher: ${quoteYaml(metadata.publisher)}`);
	if (metadata.edition) lines.push(`edition: ${quoteYaml(metadata.edition)}`);
	if (metadata.language) lines.push(`language: ${quoteYaml(metadata.language)}`);
	if (metadata.isbn) lines.push(`isbn: ${quoteYaml(metadata.isbn)}`);
	if (metadata.dateAdded) lines.push(`date_added: ${quoteYaml(metadata.dateAdded)}`);
	lines.push(`file: ${quoteYaml(`[[${metadata.sourceFile}]]`)}`);
	const tagList = metadata.tags.length > 0
		? `[${metadata.tags.map(quoteYaml).join(", ")}]`
		: "[]";
	lines.push(`tags: ${tagList}`);
	lines.push("---", "");

	return `${lines.join("\n")}\n`;
}

/**
 * Merges fresh Zotero frontmatter into an existing note.
 * - Zotero-managed keys (ZOTERO_FRONTMATTER_KEYS) are replaced with values from newFrontmatter.
 * - User-added frontmatter keys are preserved in place.
 */
export function mergeNoteContent(existingContent: string, newFrontmatter: string): string {
	const fmMatch = existingContent.match(/^---\n([\s\S]*?\n)---(\n|$)/);
	if (!fmMatch) {
		return newFrontmatter + existingContent;
	}

	const body = existingContent.slice(fmMatch[0].length);
	const existingFmLines = (fmMatch[1] ?? "").split("\n");

	// Collect user-defined properties
	const userLines: string[] = [];
	for (const line of existingFmLines) {
		const keyMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:/);
		if (keyMatch?.[1] && !ZOTERO_FRONTMATTER_KEYS.has(keyMatch[1])) {
			userLines.push(line);
		}
	}

	if (userLines.length === 0) {
		return newFrontmatter + body;
	}

	const closingIndex = newFrontmatter.lastIndexOf("\n---\n");
	const beforeClose = newFrontmatter.slice(0, closingIndex);
	const afterClose = newFrontmatter.slice(closingIndex); // "\n---\n"
	return beforeClose + "\n" + userLines.join("\n") + afterClose + body;
}

export function generateNotePath(metadata: BookMetadata, settings: MediaNoteSettings): string {
	const stem = metadata.sourceFile
		? sanitizeFilename(filenameToTitle(metadata.sourceFile))
		: sanitizeFilename(metadata.title ?? "Untitled");
	const noteName = `${stem}.md`;
	const folderName = normalizeVaultPath(settings.outputFolderName) || "Notes";

	if (settings.outputMode === "subfolder") {
		const matchingFolder = settings.watchedFolders
			.map(normalizeVaultPath)
			.filter(Boolean)
			.find((f) => metadata.sourceFile === f || metadata.sourceFile.startsWith(`${f}/`));
		const base = matchingFolder ?? "";
		return base ? `${base}/${folderName}/${noteName}` : `${folderName}/${noteName}`;
	}

	return `${folderName}/${noteName}`;
}

async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const normalizedFolderPath = normalizeVaultPath(folderPath);
	if (!normalizedFolderPath) {
		return;
	}

	const segments = normalizedFolderPath.split("/");
	for (let i = 1; i <= segments.length; i += 1) {
		const partialPath = segments.slice(0, i).join("/");
		if (!app.vault.getAbstractFileByPath(partialPath)) {
			await app.vault.createFolder(partialPath);
		}
	}
}

function splitNotePath(notePath: string): { folder: string; stem: string; extension: string } {
	const normalized = normalizeVaultPath(notePath);
	const slash = normalized.lastIndexOf("/");
	const folder = slash >= 0 ? normalized.slice(0, slash) : "";
	const fileName = slash >= 0 ? normalized.slice(slash + 1) : normalized;
	const dot = fileName.lastIndexOf(".");
	const stem = dot >= 0 ? fileName.slice(0, dot) : fileName;
	const extension = dot >= 0 ? fileName.slice(dot) : ".md";
	return { folder, stem, extension };
}

/**
 * Returns a free path for a new note.  Adds a numeric suffix if needed.
 */
function findFreeNotePath(app: App, preferredPath: string): string {
	if (!app.vault.getAbstractFileByPath(preferredPath)) {
		return preferredPath;
	}

	const { folder, stem, extension } = splitNotePath(preferredPath);
	let suffix = 2;
	while (true) {
		const candidateName = `${stem}-${suffix}${extension}`;
		const candidatePath = folder ? `${folder}/${candidateName}` : candidateName;
		if (!app.vault.getAbstractFileByPath(candidatePath)) {
			return candidatePath;
		}
		suffix += 1;
	}
}

export async function createOrUpdateCompanionNote(
	file: TFile,
	app: App,
	settings: MediaNoteSettings,
	zoteroCache: ZoteroCache,
	isBatch: boolean,
): Promise<NoteWriteResult> {
	const binary = await app.vault.readBinary(file);
	const extraction = await extractMetadataFromFile(file, binary, app, settings, zoteroCache, isBatch);

	const preferredNotePath = generateNotePath(extraction.metadata, settings);
	const outputFolder = normalizeVaultPath(preferredNotePath.slice(0, preferredNotePath.lastIndexOf("/")));
	await ensureFolderExists(app, outputFolder);

	const newFrontmatter = generateFrontmatter(extraction.metadata);

	const existingFile = app.vault.getAbstractFileByPath(preferredNotePath);
	if (existingFile instanceof TFile) {
		const existingContent = await app.vault.read(existingFile);
		if (existingContent.includes(`[[${file.path}]]`)) {
			// This note belongs to the same source file — merge Zotero fields, preserve user content.
			await app.vault.modify(existingFile, mergeNoteContent(existingContent, newFrontmatter));
			return { notePath: preferredNotePath, updated: true, warnings: extraction.warnings };
		}
	}

	const writePath = existingFile ? findFreeNotePath(app, preferredNotePath) : preferredNotePath;
	await app.vault.create(writePath, newFrontmatter);
	return { notePath: writePath, updated: false, warnings: extraction.warnings };
}
