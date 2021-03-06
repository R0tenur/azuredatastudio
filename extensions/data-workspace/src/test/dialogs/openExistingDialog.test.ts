/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as TypeMoq from 'typemoq';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as os from 'os';
import * as constants from '../../common/constants';
import * as utils from '../../common/utils';
import { WorkspaceService } from '../../services/workspaceService';
import { OpenExistingDialog } from '../../dialogs/openExistingDialog';
import { createProjectFile, generateUniqueProjectFilePath, generateUniqueWorkspaceFilePath, testProjectType } from '../testUtils';

suite('Open Existing Dialog', function (): void {
	const mockExtensionContext = TypeMoq.Mock.ofType<vscode.ExtensionContext>();

	this.afterEach(() => {
		sinon.restore();
	});

	test('Should validate project file exists', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog.targetTypeRadioCardGroup?.updateProperty( 'selectedCardId', constants.Project);
		dialog.filePathTextBox!.value = 'nonExistentProjectFile';
		dialog.workspaceInputBox!.value = 'test.code-workspace';

		const validateResult = await dialog.validate();

		const msg = constants.FileNotExistError('project', 'nonExistentProjectFile');
		should.equal(dialog.dialogObject.message.text, msg);
		should.equal(validateResult, false, 'Validation should fail because project file does not exist, but passed');

		// create a project file
		dialog.filePathTextBox!.value = await createProjectFile('testproj');
		should.equal(await dialog.validate(), true, `Validation should pass because project file exists, but failed with: ${dialog.dialogObject.message.text}`);
	});

	test('Should validate workspace file exists', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog.targetTypeRadioCardGroup?.updateProperty( 'selectedCardId', constants.Workspace);
		dialog.filePathTextBox!.value = 'nonExistentWorkspaceFile';
		const fileExistStub = sinon.stub(utils, 'fileExist').resolves(false);

		const validateResult = await dialog.validate();
		const msg = constants.FileNotExistError('workspace', 'nonExistentWorkspaceFile');
		should.equal(dialog.dialogObject.message.text, msg);
		should.equal(validateResult, false, 'Validation should fail because workspace file does not exist, but passed');

		// validation should pass if workspace file exists
		dialog.filePathTextBox!.value = generateUniqueWorkspaceFilePath();
		fileExistStub.resolves(true);
		should.equal(await dialog.validate(), true, `Validation should pass because workspace file exists, but failed with: ${dialog.dialogObject.message.text}`);
	});

	test('Should validate workspace git clone location', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog.targetTypeRadioCardGroup?.updateProperty( 'selectedCardId', constants.Workspace);
		dialog.localRadioButton!.checked = false;
		dialog.remoteGitRepoRadioButton!.checked = true;
		dialog.localClonePathTextBox!.value = 'invalidLocation';
		const folderExistStub = sinon.stub(utils, 'directoryExist').resolves(false);

		const validateResult = await dialog.validate();
		const msg = constants.CloneParentDirectoryNotExistError(dialog.localClonePathTextBox!.value);
		should.equal(dialog.dialogObject.message.text, msg);
		should.equal(validateResult, false, 'Validation should fail because clone directory does not exist, but passed');

		// validation should pass if directory exists
		dialog.localClonePathTextBox!.value = os.tmpdir();
		folderExistStub.resolves(true);
		should.equal(await dialog.validate(), true, `Validation should pass because clone directory exists, but failed with: ${dialog.dialogObject.message.text}`);
	});

	test('Should validate workspace in onComplete when opening project', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.validateWorkspace()).returns(() => Promise.resolve(true));
		workspaceServiceMock.setup(x => x.addProjectsToWorkspace(TypeMoq.It.isAny())).returns(() => Promise.resolve());

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();

		dialog.filePathTextBox!.value = generateUniqueProjectFilePath('testproj');
		should.doesNotThrow(async () => await dialog.onComplete());

		workspaceServiceMock.setup(x => x.validateWorkspace()).throws(new Error('test error'));
		const spy = sinon.spy(vscode.window, 'showErrorMessage');
		should.doesNotThrow(async () => await dialog.onComplete(), 'Error should be caught');
		should(spy.calledOnce).be.true();
	});

	test('workspace browse', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();
		should.equal(dialog.filePathTextBox!.value, '');
		await dialog.workspaceBrowse();
		should.equal(dialog.filePathTextBox!.value, '', 'Workspace file should not be set when no file is selected');

		sinon.restore();
		const workspaceFile = vscode.Uri.file(generateUniqueWorkspaceFilePath());
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([workspaceFile]));
		await dialog.workspaceBrowse();
		should.equal(dialog.filePathTextBox!.value, workspaceFile.fsPath, 'Workspace file should get set');
		should.equal(dialog.filePathTextBox?.value, workspaceFile.fsPath);
	});

	test('project browse', async function (): Promise<void> {
		const workspaceServiceMock = TypeMoq.Mock.ofType<WorkspaceService>();
		workspaceServiceMock.setup(x => x.getAllProjectTypes()).returns(() => Promise.resolve([testProjectType]));
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([]));

		const dialog = new OpenExistingDialog(workspaceServiceMock.object, mockExtensionContext.object);
		await dialog.open();
		should.equal(dialog.filePathTextBox!.value, '');
		await dialog.projectBrowse();
		should.equal(dialog.filePathTextBox!.value, '', 'Project file should not be set when no file is selected');

		sinon.restore();
		const projectFile = vscode.Uri.file(generateUniqueProjectFilePath('testproj'));
		sinon.stub(vscode.window, 'showOpenDialog').returns(Promise.resolve([projectFile]));
		await dialog.projectBrowse();
		should.equal(dialog.filePathTextBox!.value, projectFile.fsPath, 'Project file should be set');
		should.equal(dialog.filePathTextBox?.value, projectFile.fsPath);
	});
});

