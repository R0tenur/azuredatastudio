/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FileEditorInput } from 'vs/workbench/contrib/files/common/editors/fileEditorInput';
import { SideBySideEditorInput } from 'vs/workbench/common/editor';
import { DiffEditorInput } from 'vs/workbench/common/editor/diffEditorInput';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { FileNotebookInput } from 'sql/workbench/contrib/notebook/browser/models/fileNotebookInput';
import { INotebookService } from 'sql/workbench/services/notebook/browser/notebookService';
import { Deferred } from 'sql/base/common/promise';
import { ILogService } from 'vs/platform/log/common/log';

export class DiffNotebookInput extends SideBySideEditorInput {
	public static ID: string = 'workbench.editorinputs.DiffNotebookInput';
	private _notebookService: INotebookService;
	private _logService: ILogService;

	constructor(
		title: string,
		diffInput: DiffEditorInput,
		@IInstantiationService instantiationService: IInstantiationService,
		@INotebookService notebookService: INotebookService,
		@ILogService logService: ILogService
	) {
		let originalInput = instantiationService.createInstance(FileNotebookInput, diffInput.primary.getName(), diffInput.primary.resource, diffInput.originalInput as FileEditorInput);
		let modifiedInput = instantiationService.createInstance(FileNotebookInput, diffInput.secondary.getName(), diffInput.secondary.resource, diffInput.modifiedInput as FileEditorInput);
		super(title, diffInput.getTitle(), modifiedInput, originalInput);
		this._notebookService = notebookService;
		this._logService = logService;
		this.setupScrollListeners(originalInput, modifiedInput);
	}

	public getTypeId(): string {
		return DiffNotebookInput.ID;
	}

	/**
	 * Setup scroll listeners so that both the original and modified editors scroll together
	 * @param originalInput original notebook input
	 * @param modifiedInput modified notebook input
	 */
	private setupScrollListeners(originalInput: FileNotebookInput, modifiedInput: FileNotebookInput): void {
		Promise.all([originalInput.containerResolved, modifiedInput.containerResolved]).then(() => {

			// Setting container height to 100% ensures that scrollbars will be added when in diff mode
			originalInput.container.parentElement.style.height = '100%';
			modifiedInput.container.parentElement.style.height = '100%';

			// Keep track of when original and modified notebooks are shown
			const originalNotebookEditorShown: Deferred<void> = new Deferred<void>();
			const modifiedNotebookEditorShown: Deferred<void> = new Deferred<void>();

			// Possible for notebooks to have been shown already, so check this case
			if (this._notebookService.findNotebookEditor(originalInput.notebookUri)) {
				originalNotebookEditorShown.resolve();
			} else if (this._notebookService.findNotebookEditor(modifiedInput.notebookUri)) {
				modifiedNotebookEditorShown.resolve();
			}

			// If not already shown, listen for add events
			this._register(this._notebookService.onNotebookEditorAdd((e) => {
				if (e.id === originalInput.notebookUri.toString()) {
					originalNotebookEditorShown.resolve();
				} else if (e.id === modifiedInput.notebookUri.toString()) {
					modifiedNotebookEditorShown.resolve();
				}
			}));

			// Once both are shown, look for scrollable DIV. Add scroll listeners here
			Promise.all([originalNotebookEditorShown.promise, modifiedNotebookEditorShown.promise]).then(() => {
				const originalScrollableNode = originalInput.container?.querySelector('.scrollable');
				const modifiedScrollableNode = modifiedInput.container?.querySelector('.scrollable');

				if (originalScrollableNode && modifiedScrollableNode) {
					let originalScrollNodeTarget: number | undefined;
					let modifiedNodeScrollTarget: number | undefined;
					originalScrollableNode.addEventListener('scroll', () => {
						// If we're currently in the process of scrolling this editor to sync it up with
						// the other editor then ignore events until we reach our target scrollTop so
						// that we don't cause a loop by telling the other editor to scroll back to
						// the position of this editor
						if (originalScrollNodeTarget !== undefined) {
							if (originalScrollNodeTarget === originalScrollableNode.scrollTop) {
								// We've reach out scroll target - clear this so we can start processing scroll
								// events on this node again
								originalScrollNodeTarget = undefined;
							}
							return;
						}
						modifiedNodeScrollTarget = originalScrollableNode.scrollTop;
						modifiedScrollableNode.scroll({ top: originalScrollableNode.scrollTop });
					});
					modifiedScrollableNode.addEventListener('scroll', () => {
						// If we're currently in the process of scrolling this editor to sync it up with
						// the other editor then ignore events until we reach our target scrollTop so
						// that we don't cause a loop by telling the other editor to scroll back to
						// the position of this editor
						if (modifiedNodeScrollTarget !== undefined) {
							if (modifiedNodeScrollTarget === modifiedScrollableNode.scrollTop) {
								// We've reach out scroll target - clear this so we can start processing scroll
								// events on this node again
								modifiedNodeScrollTarget = undefined;
							}
							return;
						}
						originalScrollNodeTarget = modifiedScrollableNode.scrollTop;
						originalScrollableNode.scroll({ top: modifiedScrollableNode.scrollTop });
					});

				}
			}).catch(error => {
				this._logService.error(`Issue encountered waiting for original and modified notebook editors to be shown in notebook diff input: ${error}`);
			});
		}).catch(error => {
			this._logService.error(`Issue encountered waiting for original and modified notebook containers to exist in notebook diff input: ${error}`);
		});
	}
}
