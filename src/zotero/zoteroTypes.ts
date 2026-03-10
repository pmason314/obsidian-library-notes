export interface ZoteroCreator {
	creatorType: string; // author/editor/etc.
	firstName?: string;
	lastName?: string;
	name?: string; // single-field name for organizations, etc.
}

export interface ZoteroTag {
	tag: string;
	type?: number;
}

/** Subset of Zotero item data fields used by this plugin. */
export interface ZoteroItemData {
	key: string;
	itemType: string;
	title?: string;
	creators?: ZoteroCreator[];
	date?: string;
	publisher?: string;
	edition?: string;
	language?: string;
	ISBN?: string;
	dateAdded?: string;
	tags?: ZoteroTag[];
	parentItem?: string; // Used for attachments/notes
}

export interface ZoteroItem {
	key: string;
	data: ZoteroItemData;
}
