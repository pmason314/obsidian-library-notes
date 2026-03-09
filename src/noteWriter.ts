import { App, TFile } from "obsidian";
import { extractMetadataFromFile } from "metadataExtractor";
import { MediaNoteSettings, NoteWriteResult, BookMetadata } from "types";
import { normalizeVaultPath } from "utils/paths";

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
	if (metadata.language) lines.push(`language: ${quoteYaml(metadata.language)}`);
	lines.push(`file: ${quoteYaml(`[[${metadata.sourceFile}]]`)}`);
	lines.push("tags: []");
	lines.push("---", "");

	return `${lines.join("\n")}\n`;
}

export function generateNotePath(metadata: BookMetadata, settings: MediaNoteSettings): string {
	const title = metadata.title ?? "Untitled";
	const noteName = `${sanitizeFilename(title)}.md`;
	const folderName = normalizeVaultPath(settings.outputFolderName) || "Sources";

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

async function resolveWritePath(app: App, preferredPath: string, overwriteExisting: boolean): Promise<{ path: string; existing: TFile | null }> {
	const preferredFile = app.vault.getAbstractFileByPath(preferredPath);
	if (!preferredFile) {
		return { path: preferredPath, existing: null };
	}

	if (preferredFile instanceof TFile && overwriteExisting) {
		return { path: preferredPath, existing: preferredFile };
	}

	const { folder, stem, extension } = splitNotePath(preferredPath);
	let suffix = 2;
	while (true) {
		const candidateName = `${stem}-${suffix}${extension}`;
		const candidatePath = folder ? `${folder}/${candidateName}` : candidateName;
		const existingCandidate = app.vault.getAbstractFileByPath(candidatePath);
		if (!existingCandidate) {
			return { path: candidatePath, existing: null };
		}
		suffix += 1;
	}
}

export async function createOrUpdateCompanionNote(file: TFile, app: App, settings: MediaNoteSettings): Promise<NoteWriteResult> {
	const binary = await app.vault.readBinary(file);
	const extraction = await extractMetadataFromFile(file, binary);

	const preferredNotePath = generateNotePath(extraction.metadata, settings);
	const outputFolder = normalizeVaultPath(preferredNotePath.slice(0, preferredNotePath.lastIndexOf("/")));
	await ensureFolderExists(app, outputFolder);

	const content = generateFrontmatter(extraction.metadata);

	// Idempotency check: if the preferred note already exists and was written for this
	// same source file, skip rather than creating a -2 duplicate.
	if (!settings.overwriteExisting) {
		const existingFile = app.vault.getAbstractFileByPath(preferredNotePath);
		if (existingFile instanceof TFile) {
			const existingContent = await app.vault.read(existingFile);
			if (existingContent.includes(`[[${file.path}]]`)) {
				return { notePath: preferredNotePath, updated: false, skipped: true, warnings: extraction.warnings };
			}
		}
	}

	const writeTarget = await resolveWritePath(app, preferredNotePath, settings.overwriteExisting);

	if (writeTarget.existing) {
		await app.vault.modify(writeTarget.existing, content);
		return { notePath: writeTarget.path, updated: true, skipped: false, warnings: extraction.warnings };
	}

	await app.vault.create(writeTarget.path, content);
	return { notePath: writeTarget.path, updated: false, skipped: false, warnings: extraction.warnings };
}
