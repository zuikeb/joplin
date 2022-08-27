import { FolderEntity, NoteEntity } from '@joplin/lib/services/database/types';
import { PluginStates } from '@joplin/lib/services/plugins/reducer';

export interface Props {
	themeId: any;
	selectedNoteIds: string[];
	notes: NoteEntity[];
	dispatch: Function;
	watchedNoteFiles: any[];
	plugins: PluginStates;
	selectedFolderId: string;
	customCss: string;
	notesParentType: string;
	noteSortOrder: string;
	resizableLayoutEventEmitter: any;
	isInsertingNotes: boolean;
	folders: FolderEntity[];
	size: any;
	searches: any[];
	selectedSearchId: string;
	highlightedWords: string[];
	provisionalNoteIds: string[];
	visible: boolean;
}
