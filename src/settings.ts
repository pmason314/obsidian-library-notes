import { AbstractInputSuggest, App, Notice, PluginSettingTab, Setting } from "obsidian";
import MediaNotePlugin from "main";
import { MediaNoteSettings, OutputMode } from "types";
import { normalizeVaultPath } from "utils/paths";

export const DEFAULT_SETTINGS: MediaNoteSettings = {
	watchedFolders: [],
	outputMode: "subfolder",
	outputFolderName: "Notes",
	autoCreateOnAdd: true,
	zoteroUserId: "",
};

class FolderSuggest extends AbstractInputSuggest<string> {
	private onSelectCallback: (value: string) => void;

	constructor(app: App, inputEl: HTMLInputElement, onSelect: (value: string) => void) {
		super(app, inputEl);
		this.onSelectCallback = onSelect;
	}

	getSuggestions(query: string): string[] {
		const lowerQuery = query.toLowerCase();
		const folderPaths = new Set<string>();

		for (const file of this.app.vault.getFiles()) {
			let path = file.parent?.path ?? "";
			while (path && path !== "/") {
				folderPaths.add(path);
				const slash = path.lastIndexOf("/");
				path = slash > 0 ? path.slice(0, slash) : "";
			}
		}

		return Array.from(folderPaths)
			.filter((p) => p.toLowerCase().includes(lowerQuery))
			.sort()
			.slice(0, 20);
	}

	renderSuggestion(value: string, el: HTMLElement): void {
		el.createEl("div", { text: value });
	}

	selectSuggestion(value: string, _evt: MouseEvent | KeyboardEvent): void {
		this.setValue(value);
		this.onSelectCallback(value);
		this.close();
	}
}

export class MediaNoteSettingTab extends PluginSettingTab {
	plugin: MediaNotePlugin;

	constructor(app: App, plugin: MediaNotePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private async updateSettings(mutator: (settings: MediaNoteSettings) => void): Promise<void> {
		mutator(this.plugin.settings);
		this.plugin.settings.outputFolderName = normalizeVaultPath(this.plugin.settings.outputFolderName) || "Notes";
		await this.plugin.saveSettings();
	}

	private renderWatchedFolders(containerEl: HTMLElement): void {
		const section = containerEl.createDiv();

		new Setting(section)
			.setName("Watched folders")
			.setHeading()
			.setDesc("Only library files (PDFs, EPUBs, and other non-Markdown) in these folders will have companion notes created. Use the 'Generate notes for all library files' command to create or update companion notes.")
			.addButton((button) => button
				.setButtonText("Add folder")
				.onClick(async () => {
					this.plugin.settings.watchedFolders.push("");
					await this.plugin.saveSettings();
					this.display();
				}));

		this.plugin.settings.watchedFolders.forEach((folder, index) => {
			new Setting(section)
				.setName(`Watch Folder #${index + 1}`)
				.addText((text) => {
					text.setPlaceholder("Folder path").setValue(folder);
					text.inputEl.style.width = "100%";

					new FolderSuggest(this.app, text.inputEl, async (selected) => {
						this.plugin.settings.watchedFolders[index] = normalizeVaultPath(selected);
						await this.plugin.saveSettings();
					});

					text.onChange(async (value) => {
						this.plugin.settings.watchedFolders[index] = value;
						await this.plugin.saveSettings();
					});
				})
				.addExtraButton((button) => button
					.setIcon("trash")
					.setTooltip("Remove folder")
					.onClick(async () => {
						this.plugin.settings.watchedFolders.splice(index, 1);
						await this.plugin.saveSettings();
						this.display();
					}));
		});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const title = containerEl.createEl("h2", { text: "Library Note Generator settings" });
		title.style.marginBottom = "1.5em";

		this.renderWatchedFolders(containerEl);

		// Output folder
		const notesHeading = new Setting(containerEl)
			.setName("Companion Note Settings")
			.setHeading();
		notesHeading.settingEl.style.marginTop = "2em";

		new Setting(containerEl)
			.setName("Companion note mode")
			.addDropdown((dd) => {
				dd.addOption("subfolder", "Subfolder of each watched folder")
					.addOption("global", "Global folder")
					.setValue(this.plugin.settings.outputMode)
					.onChange(async (value) => {
						await this.updateSettings((settings) => {
							settings.outputMode = value as OutputMode;
						});
						this.display();
					});
			});

		const isSubfolder = this.plugin.settings.outputMode === "subfolder";
		new Setting(containerEl)
			.setName(isSubfolder ? "Subfolder name" : "Global companion note folder")
			.setDesc(isSubfolder
				? "Created inside each watched folder (e.g. Books/Notes)"
				: "Path where all auto-created companion notes are saved")
			.addText((text) => {
				text.setPlaceholder("Notes").setValue(this.plugin.settings.outputFolderName);
				text.inputEl.style.width = "100%";

				if (!isSubfolder) {
					new FolderSuggest(this.app, text.inputEl, async (selected) => {
						this.plugin.settings.outputFolderName = normalizeVaultPath(selected);
						await this.plugin.saveSettings();
					});
				}

				text.onChange(async (value) => {
					this.plugin.settings.outputFolderName = value;
					await this.plugin.saveSettings();
				});
			});

		// Zotero
		const zoteroHeading = new Setting(containerEl)
			.setName("Zotero")
			.setHeading();
		zoteroHeading.settingEl.style.marginTop = "2em";

		new Setting(containerEl)
			.setName("User ID")
			.setDesc(createFragment((frag) => {
				frag.appendText("Your numeric Zotero user ID. Find it at ");
				frag.createEl("a", { text: "zotero.org/settings/keys", href: "https://www.zotero.org/settings/keys" });
				frag.appendText(".");
			}))
			.addText((text) => text
				.setPlaceholder("123456")
				.setValue(this.plugin.settings.zoteroUserId)
				.onChange(async (value) => {
					this.plugin.settings.zoteroUserId = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("API key")
			.setDesc("Read-only API key from zotero.org/settings/keys. Stored in vault-scoped localStorage (not synced, not in data.json).")
			.addText((text) => {
				text.setPlaceholder("••••••••••••••••••••••••")
					.setValue((this.app.loadLocalStorage("zoteroApiKey") as string | null) ?? "")
					.onChange((value) => {
						this.app.saveLocalStorage("zoteroApiKey", value.trim() || null);
					});
				text.inputEl.type = "password";
			});

		new Setting(containerEl)
			.setName("Clear Zotero cache")
			.setDesc("Forces all files to be re-looked up on the next note generation run.")
			.addButton((button) => button
				.setButtonText("Clear cache")
				.onClick(async () => {
					this.plugin.zoteroCache = {};
					await this.plugin.saveSettings();
					new Notice("Zotero cache cleared.");
				}));

		// General
		const generalHeading = new Setting(containerEl)
			.setName("General")
			.setHeading();
		generalHeading.settingEl.style.marginTop = "2em";

		new Setting(containerEl)
			.setName("Auto-create on add")
			.setDesc("Automatically create a companion note when a new library file (PDF, EPUB, etc.) is added to a watched folder")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.autoCreateOnAdd)
				.onChange(async (value) => {
					await this.updateSettings((settings) => {
						settings.autoCreateOnAdd = value;
					});
				}));

	}
}
