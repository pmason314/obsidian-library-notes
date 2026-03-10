import { App, Notice } from "obsidian";
import { processOneFile } from "commands/processActive";
import { MediaNoteSettings, ZoteroCache } from "types";
import { isInWatchedFolders, isSupportedMediaFile } from "utils/paths";

export async function processAllWatchedFiles(
	app: App,
	settings: MediaNoteSettings,
	zoteroCache: ZoteroCache,
	saveCache: () => Promise<void>,
): Promise<void> {
	if (settings.watchedFolders.length === 0) {
		new Notice("No watched folders configured.");
		return;
	}

	const files = app.vault
		.getFiles()
		.filter((file) => isSupportedMediaFile(file) && isInWatchedFolders(file.path, settings.watchedFolders));

	if (files.length === 0) {
		new Notice("No library files found in watched folders.");
		return;
	}

	let created = 0;
	let updated = 0;
	let failures = 0;

	for (const file of files) {
		const result = await processOneFile(file, app, settings, zoteroCache, true, saveCache);
		if (!result) {
			failures += 1;
		} else if (result.updated) {
			updated += 1;
		} else {
			created += 1;
		}
	}

	const parts: string[] = [];
	if (created > 0) parts.push(`${created} created`);
	if (updated > 0) parts.push(`${updated} updated`);
	if (failures > 0) parts.push(`${failures} failed`);
	new Notice(`Processed ${files.length} file${files.length === 1 ? "" : "s"}: ${parts.join(", ")}.`);
}
