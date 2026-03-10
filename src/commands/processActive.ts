import { App, Notice, TFile } from "obsidian";
import { createOrUpdateCompanionNote } from "noteWriter";
import { MediaNoteSettings, NoteWriteResult, ZoteroCache } from "types";
import { isInWatchedFolders, isSupportedMediaFile } from "utils/paths";

export async function processActiveFile(
	app: App,
	settings: MediaNoteSettings,
	zoteroCache: ZoteroCache,
	saveCache: () => Promise<void>,
): Promise<void> {
	const activeFile = app.workspace.getActiveFile();
	if (!activeFile) {
		new Notice("No active file selected.");
		return;
	}

	if (!isSupportedMediaFile(activeFile)) {
		new Notice("Active file is not a supported library file (PDF or EPUB).");
		return;
	}

	if (!isInWatchedFolders(activeFile.path, settings.watchedFolders)) {
		new Notice("Active file is outside watched folders.");
		return;
	}

	await processOneFile(activeFile, app, settings, zoteroCache, false, saveCache, true);
}

export async function processOneFile(
	file: TFile,
	app: App,
	settings: MediaNoteSettings,
	zoteroCache: ZoteroCache,
	isBatch: boolean,
	saveCache: () => Promise<void>,
	showSuccessNotice = false,
): Promise<NoteWriteResult | null> {
	try {
		const result = await createOrUpdateCompanionNote(file, app, settings, zoteroCache, isBatch);
		await saveCache();
		if (showSuccessNotice) {
			const action = result.updated ? "Updated note" : "Created note";
			new Notice(`${action}: ${result.notePath}`);
		}
		const firstWarning = result.warnings[0];
		if (firstWarning) {
			new Notice(firstWarning);
		}
		return result;
	} catch (error) {
		new Notice(`Failed to process ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
		return null;
	}
}
