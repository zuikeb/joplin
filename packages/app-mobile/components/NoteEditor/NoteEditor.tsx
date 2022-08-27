import Setting from '@joplin/lib/models/Setting';
import shim from '@joplin/lib/shim';
import { themeStyle } from '@joplin/lib/theme';
import EditLinkDialog from './EditLinkDialog';
import { defaultSearchState, SearchPanel } from './SearchPanel';

const React = require('react');
const { forwardRef, useImperativeHandle } = require('react');
const { useEffect, useMemo, useState, useCallback, useRef } = require('react');
const { WebView } = require('react-native-webview');
const { View } = require('react-native');
const { editorFont } = require('../global-style');

import SelectionFormatting from './SelectionFormatting';
import {
	EditorSettings,
	EditorControl,

	ChangeEvent, UndoRedoDepthChangeEvent, Selection, SelectionChangeEvent,
	ListType,
	SearchState,
} from './types';
import { _ } from '@joplin/lib/locale';

type ChangeEventHandler = (event: ChangeEvent)=> void;
type UndoRedoDepthChangeHandler = (event: UndoRedoDepthChangeEvent)=> void;
type SelectionChangeEventHandler = (event: SelectionChangeEvent)=> void;

interface Props {
	themeId: number;
	initialText: string;
	initialSelection?: Selection;
	style: any;

	onChange: ChangeEventHandler;
	onSelectionChange: SelectionChangeEventHandler;
	onUndoRedoDepthChange: UndoRedoDepthChangeHandler;
}

function fontFamilyFromSettings() {
	const font = editorFont(Setting.value('style.editor.fontFamily'));
	return font ? `${font}, sans-serif` : 'sans-serif';
}

function useCss(themeId: number): string {
	return useMemo(() => {
		const theme = themeStyle(themeId);
		return `
			:root {
				background-color: ${theme.backgroundColor};
			}

			body {
				margin: 0;
				height: 100vh;
				width: 100vh;
				width: 100vw;
				min-width: 100vw;
				box-sizing: border-box;

				padding-left: 1px;
				padding-right: 1px;
				padding-bottom: 1px;
				padding-top: 10px;

				font-size: 13pt;
			}
		`;
	}, [themeId]);
}

function useHtml(css: string): string {
	const [html, setHtml] = useState('');

	useMemo(() => {
		setHtml(`
			<!DOCTYPE html>
			<html>
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
					<title>${_('Note editor')}</title>
					<style>
						.cm-editor {
							height: 100%;
						}

						${css}
					</style>
				</head>
				<body>
					<div class="CodeMirror" style="height:100%;" autocapitalize="on"></div>
				</body>
			</html>
		`);
	}, [css]);

	return html;
}

function editorTheme(themeId: number) {
	return {
		...themeStyle(themeId),
		fontSize: 0.85, // em
		fontFamily: fontFamilyFromSettings(),
	};
}

function NoteEditor(props: Props, ref: any) {
	const [source, setSource] = useState(undefined);
	const webviewRef = useRef(null);

	const setInitialSelectionJS = props.initialSelection ? `
		cm.select(${props.initialSelection.start}, ${props.initialSelection.end});
	` : '';

	const editorSettings: EditorSettings = {
		themeId: props.themeId,
		themeData: editorTheme(props.themeId),
		katexEnabled: Setting.value('markdown.plugin.katex') as boolean,
	};

	const injectedJavaScript = `
		function postMessage(name, data) {
			window.ReactNativeWebView.postMessage(JSON.stringify({
				data,
				name,
			}));
		}

		function logMessage(...msg) {
			postMessage('onLog', { value: msg });
		}

		// Globalize logMessage, postMessage
		window.logMessage = logMessage;
		window.postMessage = postMessage;

		window.onerror = (message, source, lineno) => {
			window.ReactNativeWebView.postMessage(
				"error: " + message + " in file://" + source + ", line " + lineno
			);
		};

		if (!window.cm) {
			// This variable is not used within this script
			// but is called using "injectJavaScript" from
			// the wrapper component.
			window.cm = null;

			try {
				${shim.injectedJs('codeMirrorBundle')};

				const parentElement = document.getElementsByClassName('CodeMirror')[0];
				const initialText = ${JSON.stringify(props.initialText)};
				const settings = ${JSON.stringify(editorSettings)};

				cm = codeMirrorBundle.initCodeMirror(parentElement, initialText, settings);
				${setInitialSelectionJS}

				window.onresize = () => {
					cm.scrollSelectionIntoView();
				};
			} catch (e) {
				window.ReactNativeWebView.postMessage("error:" + e.message + ": " + JSON.stringify(e))
			}
		}
		true;
	`;

	const css = useCss(props.themeId);
	const html = useHtml(css);
	const [selectionState, setSelectionState] = useState(new SelectionFormatting());
	const [searchState, setSearchState] = useState(defaultSearchState);
	const [linkDialogVisible, setLinkDialogVisible] = useState(false);

	// / Runs [js] in the context of the CodeMirror frame.
	const injectJS = (js: string) => {
		webviewRef.current.injectJavaScript(`
			try {
				${js}
			}
			catch(e) {
				logMessage('Error in injected JS:' + e, e);
				throw e;
			};

			true;`);
	};


	const editorControl: EditorControl = {
		undo() {
			injectJS('cm.undo();');
		},
		redo() {
			injectJS('cm.redo();');
		},
		select(anchor: number, head: number) {
			injectJS(
				`cm.select(${JSON.stringify(anchor)}, ${JSON.stringify(head)});`
			);
		},
		insertText(text: string) {
			injectJS(`cm.insertText(${JSON.stringify(text)});`);
		},

		toggleBolded() {
			injectJS('cm.toggleBolded();');
		},
		toggleItalicized() {
			injectJS('cm.toggleItalicized();');
		},
		toggleList(listType: ListType) {
			injectJS(`cm.toggleList(${JSON.stringify(listType)});`);
		},
		toggleCode() {
			injectJS('cm.toggleCode();');
		},
		toggleMath() {
			injectJS('cm.toggleMath();');
		},
		toggleHeaderLevel(level: number) {
			injectJS(`cm.toggleHeaderLevel(${level});`);
		},
		increaseIndent() {
			injectJS('cm.increaseIndent();');
		},
		decreaseIndent() {
			injectJS('cm.decreaseIndent();');
		},
		updateLink(label: string, url: string) {
			injectJS(`cm.updateLink(
				${JSON.stringify(label)},
				${JSON.stringify(url)}
			);`);
		},
		scrollSelectionIntoView() {
			injectJS('cm.scrollSelectionIntoView();');
		},
		showLinkDialog() {
			setLinkDialogVisible(true);
		},
		hideLinkDialog() {
			setLinkDialogVisible(false);
		},
		hideKeyboard() {
			injectJS('document.activeElement?.blur();');
		},
		setSpellcheckEnabled(enabled: boolean) {
			injectJS(`cm.setSpellcheckEnabled(${enabled ? 'true' : 'false'});`);
		},
		searchControl: {
			findNext() {
				injectJS('cm.searchControl.findNext();');
			},
			findPrevious() {
				injectJS('cm.searchControl.findPrevious();');
			},
			replaceCurrent() {
				injectJS('cm.searchControl.replaceCurrent();');
			},
			replaceAll() {
				injectJS('cm.searchControl.replaceAll();');
			},
			setSearchState(state: SearchState) {
				injectJS(`cm.searchControl.setSearchState(${JSON.stringify(state)})`);
				setSearchState(state);
			},
			showSearch() {
				const newSearchState: SearchState = Object.assign({}, searchState);
				newSearchState.dialogVisible = true;

				setSearchState(newSearchState);
			},
			hideSearch() {
				const newSearchState: SearchState = Object.assign({}, searchState);
				newSearchState.dialogVisible = false;

				setSearchState(newSearchState);
			},
		},
	};

	useImperativeHandle(ref, () => {
		return editorControl;
	});

	useEffect(() => {
		let cancelled = false;
		async function createHtmlFile() {
			const tempFile = `${Setting.value('resourceDir')}/NoteEditor.html`;
			await shim.fsDriver().writeFile(tempFile, html, 'utf8');
			if (cancelled) return;

			setSource({
				uri: `file://${tempFile}?r=${Math.round(Math.random() * 100000000)}`,
				baseUrl: `file://${Setting.value('resourceDir')}/`,
			});
		}

		void createHtmlFile();

		return () => {
			cancelled = true;
		};
	}, [html]);

	const onMessage = useCallback((event: any) => {
		const data = event.nativeEvent.data;

		if (data.indexOf('error:') === 0) {
			console.error('CodeMirror:', data);
			return;
		}

		const msg = JSON.parse(data);

		const handlers: Record<string, Function> = {
			onLog: (event: any) => {
				console.info('CodeMirror:', ...event.value);
			},

			onChange: (event: ChangeEvent) => {
				props.onChange(event);
			},

			onUndoRedoDepthChange: (event: UndoRedoDepthChangeEvent) => {
				console.info('onUndoRedoDepthChange', event);
				props.onUndoRedoDepthChange(event);
			},

			onSelectionChange: (event: SelectionChangeEvent) => {
				props.onSelectionChange(event);
			},

			onSelectionFormattingChange(data: string) {
				// We want a SelectionFormatting object, so are
				// instantiating it from JSON.
				const formatting = SelectionFormatting.fromJSON(data);
				setSelectionState(formatting);
			},

			onRequestLinkEdit() {
				editorControl.showLinkDialog();
			},

			onRequestShowSearch(data: SearchState) {
				setSearchState(data);
				editorControl.searchControl.showSearch();
			},

			onRequestHideSearch() {
				editorControl.searchControl.hideSearch();
			},
		};

		if (handlers[msg.name]) {
			handlers[msg.name](msg.data);
		} else {
			console.info('Unsupported CodeMirror message:', msg);
		}
		// eslint-disable-next-line @seiyab/react-hooks/exhaustive-deps -- Old code before rule was applied
	}, [props.onChange]);

	// eslint-disable-next-line @seiyab/react-hooks/exhaustive-deps -- Old code before rule was applied
	const onError = useCallback(() => {
		console.error('NoteEditor: webview error');
	});


	// - `setSupportMultipleWindows` must be `true` for security reasons:
	//   https://github.com/react-native-webview/react-native-webview/releases/tag/v11.0.0
	// - `scrollEnabled` prevents iOS from scrolling the document (has no effect on Android)
	//    when the editor is focused.
	return (
		<View style={{
			...props.style,
			flexDirection: 'column',
		}}>
			<EditLinkDialog
				visible={linkDialogVisible}
				themeId={props.themeId}
				editorControl={editorControl}
				selectionState={selectionState}
			/>
			<View style={{
				flexGrow: 1,
				flexShrink: 0,
				minHeight: '40%',
			}}>
				<WebView
					style={{
						backgroundColor: editorSettings.themeData.backgroundColor,
					}}
					ref={webviewRef}
					scrollEnabled={false}
					useWebKit={true}
					source={source}
					setSupportMultipleWindows={true}
					hideKeyboardAccessoryView={true}
					allowingReadAccessToURL={`file://${Setting.value('resourceDir')}`}
					originWhitelist={['file://*', './*', 'http://*', 'https://*']}
					allowFileAccess={true}
					injectedJavaScript={injectedJavaScript}
					onMessage={onMessage}
					onError={onError}
				/>
			</View>

			<SearchPanel
				editorSettings={editorSettings}
				searchControl={editorControl.searchControl}
				searchState={searchState}
			/>
		</View>
	);
}

export default forwardRef(NoteEditor);
