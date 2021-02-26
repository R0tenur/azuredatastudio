/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { URI } from 'vs/base/common/uri';
import { workbenchInstantiationService, TestServiceAccessor } from 'vs/workbench/test/browser/workbenchTestServices';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TextFileContentProvider } from 'vs/workbench/contrib/files/common/files';
import { snapshotToString } from 'vs/workbench/services/textfile/common/textfiles';

suite('Files - FileOnDiskContentProvider', () => {

	let instantiationService: IInstantiationService;
	let accessor: TestServiceAccessor;

	setup(() => {
		instantiationService = workbenchInstantiationService();
		accessor = instantiationService.createInstance(TestServiceAccessor);
	});

	test('provideTextContent', async () => {
		const provider = instantiationService.createInstance(TextFileContentProvider);
		const uri = URI.parse('testFileOnDiskContentProvider://foo');

		const content = await provider.provideTextContent(uri.with({ scheme: 'conflictResolution', query: JSON.stringify({ scheme: uri.scheme }) }));

		assert.ok(content);
		assert.strictEqual(snapshotToString(content!.createSnapshot()), 'Hello Html');
		assert.strictEqual(accessor.fileService.getLastReadFileUri().scheme, uri.scheme);
		assert.strictEqual(accessor.fileService.getLastReadFileUri().path, uri.path);
	});
});
