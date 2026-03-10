import { Notice, Plugin, TFile } from "obsidian";
import { processActiveFile, processOneFile } from "commands/processActive";
import { processAllWatchedFiles } from "commands/processAll";
import { DEFAULT_SETTINGS, MediaNoteSettingTab } from "settings";
import { MediaNoteSettings, PluginData, ZoteroCache } from "types";
import { isInWatchedFolders, isSupportedMediaFile } from "utils/paths";

export default class MediaNotePlugin extends Plugin {
	settings: MediaNoteSettings;
	zoteroCache: ZoteroCache = {};

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new MediaNoteSettingTab(this.app, this));

		this.addCommand({
			id: "generate-all-library-companion-notes",
			name: "Generate companion notes for all library files",
			callback: async () => {
				await processAllWatchedFiles(this.app, this.settings, this.zoteroCache, () => this.saveSettings());
			},
		});

		this.addCommand({
			id: "generate-companion-note-for-current-file",
			name: "Generate companion note for current file",
			callback: async () => {
				await processActiveFile(this.app, this.settings, this.zoteroCache, () => this.saveSettings());
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

			const ok = await processOneFile(file, this.app, this.settings, this.zoteroCache, true, () => this.saveSettings());
			if (!ok) {
				new Notice(`Auto-create failed for ${file.path}`);
			}
		}));
	}

	async loadSettings(): Promise<void> {
		const loaded = await this.loadData() as Partial<PluginData> | null;
		const rawSettings = (loaded?.settings ?? loaded) as Record<string, unknown> | null;

		// Migrate legacy API key from data.json → vault-scoped localStorage (one-time)
		const legacyKey = rawSettings?.zoteroApiKey;
		if (typeof legacyKey === "string" && legacyKey) {
			this.app.saveLocalStorage("zoteroApiKey", legacyKey);
		}

		this.settings = { ...DEFAULT_SETTINGS, ...(rawSettings as Partial<MediaNoteSettings>) };
		this.zoteroCache = loaded?.zoteroCache ?? {};
	}

	async saveSettings(): Promise<void> {
		const data: PluginData = { settings: this.settings, zoteroCache: this.zoteroCache };
		await this.saveData(data);
	}
}
