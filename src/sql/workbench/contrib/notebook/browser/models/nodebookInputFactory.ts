/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorInputFactory, IEditorInputFactoryRegistry, Extensions as EditorInputExtensions, IEditorInput } from 'vs/workbench/common/editor';
import { Registry } from 'vs/platform/registry/common/platform';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FILE_EDITOR_INPUT_ID } from 'vs/workbench/contrib/files/common/files';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { UntitledNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/untitledNotebookInput';
import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { UntitledTextEditorInput } from 'vs/workbench/services/untitled/common/untitledTextEditorInput';
import { ILanguageAssociation } from 'sql/workbench/services/languageAssociation/common/languageAssociation';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { NotebookLanguage } from 'sql/workbench/common/constants';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { DiffNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/diffNotebookInput';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const editorInputFactoryRegistry = Registry.as<IEditorInputFactoryRegistry>(EditorInputExtensions.EditorInputFactories);

export class NotebookEditorInputAssociation implements ILanguageAssociation {
	static readonly languages = [NotebookLanguage.Notebook, NotebookLanguage.Ipynb];

	constructor(@IInstantiationService private readonly instantiationService: IInstantiationService, @IConfigurationService private readonly configurationService: IConfigurationService) { }

	convertInput(activeEditor: IEditorInput): NotebookInput | DiffNotebookInput {
		if (activeEditor instanceof FileEditorInput) {
			return this.instantiationService.createInstance(FileNotebookInput, activeEditor.getName(), activeEditor.resource, activeEditor);
		} else if (activeEditor instanceof UntitledTextEditorInput) {
			return this.instantiationService.createInstance(UntitledNotebookInput, activeEditor.getName(), activeEditor.resource, activeEditor);
		} else if (activeEditor instanceof DiffEditorInput) {
			// Only show rendered notebook in diff editor if setting is true (otherwise, defaults back to text diff)
			// Note: intentionally not listening to config changes here, given that inputs won't be converted dynamically if the setting is changed
			if (this.configurationService.getValue('notebook.showRenderedNotebookInDiffEditor') === true) {
				return this.instantiationService.createInstance(DiffNotebookInput, activeEditor.getName(), activeEditor);
			}
		}
		return undefined;
	}

	createBase(activeEditor: NotebookInput): IEditorInput {
		return activeEditor.textInput;
	}
}

export class FileNoteBookEditorInputFactory implements IEditorInputFactory {
	serialize(editorInput: FileNotebookInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(FILE_EDITOR_INPUT_ID);
		if (factory) {
			return factory.serialize(editorInput.textInput); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): FileNotebookInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(FILE_EDITOR_INPUT_ID);
		const fileEditorInput = factory.deserialize(instantiationService, serializedEditorInput) as FileEditorInput;
		return instantiationService.createInstance(FileNotebookInput, fileEditorInput.getName(), fileEditorInput.resource, fileEditorInput);
	}

	canSerialize(): boolean { // we can always serialize notebooks
		return true;
	}
}

export class UntitledNoteBookEditorInputFactory implements IEditorInputFactory {
	serialize(editorInput: UntitledNotebookInput): string {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledTextEditorInput.ID);
		if (factory) {
			return factory.serialize(editorInput.textInput); // serialize based on the underlying input
		}
		return undefined;
	}

	deserialize(instantiationService: IInstantiationService, serializedEditorInput: string): UntitledNotebookInput | undefined {
		const factory = editorInputFactoryRegistry.getEditorInputFactory(UntitledTextEditorInput.ID);
		const untitledEditorInput = factory.deserialize(instantiationService, serializedEditorInput) as UntitledTextEditorInput;
		return instantiationService.createInstance(UntitledNotebookInput, untitledEditorInput.getName(), untitledEditorInput.resource, untitledEditorInput);
	}

	canSerialize(): boolean { // we can always serialize notebooks
		return true;
	}
}
