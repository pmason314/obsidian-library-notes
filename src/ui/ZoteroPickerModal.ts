import { App, Modal } from "obsidian";
import { ZoteroItem } from "zotero/zoteroTypes";

function formatItemLabel(item: ZoteroItem): string {
	const data = item.data;
	const parts: string[] = [];

	if (data.title) parts.push(data.title);

	const firstAuthor = data.creators?.find((c) => c.creatorType === "author");
	if (firstAuthor) {
		const name = firstAuthor.lastName
			? `${firstAuthor.lastName}${firstAuthor.firstName ? `, ${firstAuthor.firstName}` : ""}`
			: (firstAuthor.name ?? "");
		if (name) parts.push(name);
	}

	if (data.date) parts.push(data.date.slice(0, 4));

	return parts.join(" — ");
}

export function openZoteroPickerModal(app: App, items: ZoteroItem[]): Promise<ZoteroItem | null> {
	return new Promise((resolve) => {
		const modal = new ZoteroPickerModal(app, items, resolve);
		modal.open();
	});
}

class ZoteroPickerModal extends Modal {
	private items: ZoteroItem[];
	private resolve: (result: ZoteroItem | null) => void;
	private resolved = false;

	constructor(app: App, items: ZoteroItem[], resolve: (result: ZoteroItem | null) => void) {
		super(app);
		this.items = items;
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Multiple Zotero matches found" });
		contentEl.createEl("p", {
			text: "Select the Zotero item to use as the source for this note's metadata, or skip to use the filename only.",
			cls: "setting-item-description",
		});

		const list = contentEl.createDiv({ cls: "zotero-picker-list" });

		for (const item of this.items) {
			const row = list.createDiv({ cls: "zotero-picker-row" });
			const btn = row.createEl("button", { text: formatItemLabel(item), cls: "zotero-picker-btn" });
			btn.addEventListener("click", () => {
				this.pick(item);
			});
		}

		const skipRow = contentEl.createDiv({ cls: "zotero-picker-skip" });
		const skipBtn = skipRow.createEl("button", { text: "Skip — use filename only" });
		skipBtn.addEventListener("click", () => {
			this.pick(null);
		});
	}

	onClose(): void {
		if (!this.resolved) {
			this.resolve(null);
			this.resolved = true;
		}
		this.contentEl.empty();
	}

	private pick(item: ZoteroItem | null): void {
		if (!this.resolved) {
			this.resolved = true;
			this.resolve(item);
		}
		this.close();
	}
}
