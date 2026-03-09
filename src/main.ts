import { Notice, Plugin, TFile } from "obsidian";
import { processActiveFile, processOneFile } from "commands/processActive";
import { processAllWatchedFiles } from "commands/processAll";
import { DEFAULT_SETTINGS, MediaNoteSettingTab } from "settings";
import { MediaNoteSettings } from "types";
import { isInWatchedFolders, isSupportedMediaFile } from "utils/paths";

export default class MediaNotePlugin extends Plugin {
	settings: MediaNoteSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new MediaNoteSettingTab(this.app, this));

		this.addCommand({
			id: "generate-all-media-notes",
			name: "Generate notes for all media files",
			callback: async () => {
				await processAllWatchedFiles(this.app, this.settings);
			},
		});

		this.addCommand({
			id: "generate-note-for-current-file",
			name: "Generate note for current file",
			callback: async () => {
				await processActiveFile(this.app, this.settings);
			},
		});

		this.registerEvent(this.app.vault.on("create", async (file) => {
			if (!(file instanceof TFile)) {
				return;
			}

			if (!this.settings.autoCreateOnAdd) {
				return;
			}

			if (!isSupportedMediaFile(file) || !isInWatchedFolders(file.path, this.settings.watchedFolders)) {
				return;
			}

			const ok = await processOneFile(file, this.app, this.settings);
			if (!ok) {
				new Notice(`Auto-create failed for ${file.path}`);
			}
		}));
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData() as Partial<MediaNoteSettings> | null;
		this.settings = {
			...DEFAULT_SETTINGS,
			...loaded,
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
