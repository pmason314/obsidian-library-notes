import { AbstractInputSuggest, App, PluginSettingTab, Setting } from "obsidian";
import MediaNotePlugin from "main";
import { MediaNoteSettings, OutputMode } from "types";
import { normalizeVaultPath } from "utils/paths";

export const DEFAULT_SETTINGS: MediaNoteSettings = {
	watchedFolders: [],
	outputMode: "subfolder",
	outputFolderName: "Sources",
	autoCreateOnAdd: true,
	overwriteExisting: false,
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
		this.plugin.settings.outputFolderName = normalizeVaultPath(this.plugin.settings.outputFolderName) || "Sources";
		await this.plugin.saveSettings();
	}

	private renderWatchedFolders(containerEl: HTMLElement): void {
		const section = containerEl.createDiv();

		new Setting(section)
			.setName("Watched folders")
			.setHeading()
			.setDesc("Only media files in these folders will have companion notes created. Use the 'Generate notes for all media files' command after changing this list to update existing notes.")
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

		const title = containerEl.createEl("h2", { text: "Media Note Generator settings" });
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
				? "Created inside each watched folder (e.g. Books/Book Notes)"
				: "Path where all auto-created companion notes are saved")
			.addText((text) => {
				text.setPlaceholder("Book Notes").setValue(this.plugin.settings.outputFolderName);
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

		// General
		const generalHeading = new Setting(containerEl)
			.setName("General")
			.setHeading();
		generalHeading.settingEl.style.marginTop = "2em";

		new Setting(containerEl)
			.setName("Auto-create on add")
			.setDesc("Automatically create a companion note when a new non-Markdown file (e.g. PDF or EPUB) appears")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.autoCreateOnAdd)
				.onChange(async (value) => {
					await this.updateSettings((settings) => {
						settings.autoCreateOnAdd = value;
					});
				}));

		new Setting(containerEl)
			.setName("Overwrite existing")
			.setDesc("Modify an existing companion note if it already exists.  Rerunning note generation commands will always update auto-created notes.")
			.addToggle((toggle) => toggle
				.setValue(this.plugin.settings.overwriteExisting)
				.onChange(async (value) => {
					await this.updateSettings((settings) => {
						settings.overwriteExisting = value;
					});
				}));
	}
}
