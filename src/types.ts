export type OutputMode = "subfolder" | "global";

export interface MediaNoteSettings {
	watchedFolders: string[];
	outputMode: OutputMode;
	outputFolderName: string;
	autoCreateOnAdd: boolean;
	overwriteExisting: boolean;
}

export interface BookMetadata {
	title: string | null;
	author: string | null;
	year: string | null;
	publisher: string | null;
	language: string | null;
	sourceFile: string;
}

export interface ExtractionResult {
	metadata: BookMetadata;
	warnings: string[];
}

export interface NoteWriteResult {
	notePath: string;
	updated: boolean;
	skipped: boolean;
	warnings: string[];
}
