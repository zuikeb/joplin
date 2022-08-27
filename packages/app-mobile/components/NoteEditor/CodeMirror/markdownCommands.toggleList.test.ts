/**
 * @jest-environment jsdom
 */

import { EditorSelection, EditorState } from '@codemirror/state';
import {
	increaseIndent, toggleList,
} from './markdownCommands';
import { ListType } from '../types';
import createEditor from './createEditor';

describe('markdownCommands.toggleList', () => {
	it('should remove the same type of list', () => {
		const initialDocText = '- testing\n- this is a test';

		const editor = createEditor(
			initialDocText,
			EditorSelection.cursor(5)
		);

		toggleList(ListType.UnorderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'testing\nthis is a test'
		);
	});

	it('should insert a numbered list with correct numbering', () => {
		const initialDocText = 'Testing...\nThis is a test\nof list toggling...';
		const editor = createEditor(
			initialDocText,
			EditorSelection.cursor('Testing...\nThis is a'.length)
		);

		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'Testing...\n1. This is a test\nof list toggling...'
		);

		editor.setState(EditorState.create({
			doc: initialDocText,
			selection: EditorSelection.range(4, initialDocText.length),
		}));

		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'1. Testing...\n2. This is a test\n3. of list toggling...'
		);
	});

	const numberedListText = '- 1\n- 2\n- 3\n- 4\n- 5\n- 6\n- 7';

	it('should correctly replace an unordered list with a numbered list', () => {
		const editor = createEditor(
			numberedListText,
			EditorSelection.cursor(numberedListText.length)
		);

		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'1. 1\n2. 2\n3. 3\n4. 4\n5. 5\n6. 6\n7. 7'
		);
	});


	it('should correctly replace an unordered list with a checklist', () => {
		const editor = createEditor(
			numberedListText,
			EditorSelection.cursor(numberedListText.length)
		);

		toggleList(ListType.CheckList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'- [ ] 1\n- [ ] 2\n- [ ] 3\n- [ ] 4\n- [ ] 5\n- [ ] 6\n- [ ] 7'
		);
	});

	it('should properly toggle a sublist of a bulleted list', () => {
		const preSubListText = '# List test\n * This\n * is\n';
		const initialDocText = `${preSubListText}\t* a\n\t* test\n * of list toggling`;

		const editor = createEditor(
			initialDocText,
			EditorSelection.cursor(preSubListText.length + '\t* a'.length)
		);

		// Indentation should be preserved when changing list types
		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'# List test\n * This\n * is\n\t1. a\n\t2. test\n * of list toggling'
		);

		// The changed region should be selected
		expect(editor.state.selection.main.from).toBe(preSubListText.length);
		expect(editor.state.selection.main.to).toBe(
			`${preSubListText}\t1. a\n\t2. test`.length
		);

		// Indentation should not be preserved when removing lists
		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.selection.main.from).toBe(preSubListText.length);
		expect(editor.state.doc.toString()).toBe(
			'# List test\n * This\n * is\na\ntest\n * of list toggling'
		);


		// Put the cursor in the middle of the list
		editor.dispatch({ selection: EditorSelection.cursor(preSubListText.length) });

		// Sublists should be changed
		toggleList(ListType.CheckList)(editor);
		const expectedChecklistPart =
			'# List test\n - [ ] This\n - [ ] is\n - [ ] a\n - [ ] test\n - [ ] of list toggling';
		expect(editor.state.doc.toString()).toBe(
			expectedChecklistPart
		);

		editor.dispatch({ selection: EditorSelection.cursor(editor.state.doc.length) });
		editor.dispatch(editor.state.replaceSelection('\n\n\n'));

		// toggleList should also create a new list if the cursor is on an empty line.
		toggleList(ListType.OrderedList)(editor);
		editor.dispatch(editor.state.replaceSelection('Test.\n2. Test2\n3. Test3'));

		expect(editor.state.doc.toString()).toBe(
			`${expectedChecklistPart}\n\n\n1. Test.\n2. Test2\n3. Test3`
		);

		toggleList(ListType.CheckList)(editor);
		expect(editor.state.doc.toString()).toBe(
			`${expectedChecklistPart}\n\n\n- [ ] Test.\n- [ ] Test2\n- [ ] Test3`
		);

		// The entire checklist should have been selected (and thus will now be indented)
		increaseIndent(editor);
		expect(editor.state.doc.toString()).toBe(
			`${expectedChecklistPart}\n\n\n\t- [ ] Test.\n\t- [ ] Test2\n\t- [ ] Test3`
		);
	});

	it('should toggle a numbered list without changing its sublists', () => {
		const initialDocText = '1. Foo\n2. Bar\n3. Baz\n\t- Test\n\t- of\n\t- sublists\n4. Foo';

		const editor = createEditor(
			initialDocText,
			EditorSelection.cursor(0)
		);

		toggleList(ListType.CheckList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'- [ ] Foo\n- [ ] Bar\n- [ ] Baz\n\t- Test\n\t- of\n\t- sublists\n- [ ] Foo'
		);
	});

	it('should toggle a sublist without changing the parent list', () => {
		const initialDocText = '1. This\n2. is\n3. ';

		const editor = createEditor(
			initialDocText,
			EditorSelection.cursor(initialDocText.length)
		);

		increaseIndent(editor);
		expect(editor.state.selection.main.empty).toBe(true);

		toggleList(ListType.CheckList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'1. This\n2. is\n\t- [ ] '
		);

		editor.dispatch(editor.state.replaceSelection('a test.'));
		expect(editor.state.doc.toString()).toBe(
			'1. This\n2. is\n\t- [ ] a test.'
		);
	});

	it('should toggle lists properly within block quotes', () => {
		const preSubListText = '> # List test\n> * This\n> * is\n';
		const initialDocText = `${preSubListText}> \t* a\n> \t* test\n> * of list toggling`;
		const editor = createEditor(
			initialDocText, EditorSelection.cursor(preSubListText.length + 3)
		);

		toggleList(ListType.OrderedList)(editor);
		expect(editor.state.doc.toString()).toBe(
			'> # List test\n> * This\n> * is\n> \t1. a\n> \t2. test\n> * of list toggling'
		);
		expect(editor.state.selection.main.from).toBe(preSubListText.length);
	});
});
