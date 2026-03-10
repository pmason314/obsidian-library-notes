import { TFile } from "obsidian";

const MEDIA_EXTENSIONS = new Set(["pdf", "epub", "mobi", "azw3", "doc", "docx"]);

export function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").trim();
}

export function isMediaExtension(extension: string): boolean {
	return MEDIA_EXTENSIONS.has(extension.toLowerCase());
}

export function isSupportedMediaFile(file: TFile): boolean {
	return isMediaExtension(file.extension);
}

export function isInWatchedFolders(filePath: string, watchedFolders: string[]): boolean {
	if (watchedFolders.length === 0) {
		return false;
	}

	const normalizedPath = normalizeVaultPath(filePath);
	return watchedFolders
		.map(normalizeVaultPath)
		.filter((folder) => folder.length > 0)
		.some((folder) => normalizedPath === folder || normalizedPath.startsWith(`${folder}/`));
}

