export type OutputMode = "subfolder" | "global";

export interface MediaNoteSettings {
	watchedFolders: string[];
	outputMode: OutputMode;
	outputFolderName: string;
	autoCreateOnAdd: boolean;
	zoteroUserId: string;
	zoteroApiKeyName: string; // SecretStorage entry for API key
}

export interface BookMetadata {
	title: string | null;
	author: string | null;
	year: string | null;
	publisher: string | null;
	edition: string | null;
	language: string | null;
	isbn: string | null;
	dateAdded: string | null;
	tags: string[];
	sourceFile: string;
}

export interface ZoteroCacheEntry {
	itemKey: string;
	fetchedAt: number; // Unix ms
	metadata: Partial<BookMetadata>;
}

export type ZoteroCache = Record<string, ZoteroCacheEntry>;

export interface PluginData {
	settings: MediaNoteSettings;
	zoteroCache: ZoteroCache;
}

export interface ExtractionResult {
	metadata: BookMetadata;
	warnings: string[];
}

export interface NoteWriteResult {
	notePath: string;
	updated: boolean;
	warnings: string[];
}
