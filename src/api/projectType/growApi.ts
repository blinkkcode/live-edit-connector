import {
  ApiBaseComponent,
  GetStorage,
  addApiRoute,
  apiErrorHandler,
} from '../api';
import {
  EditorFileConfig,
  GrowPartialData,
} from '@blinkk/editor/dist/src/editor/api';
import {FrontMatter} from '../../utility/frontMatter';
import {createImportSchema} from '../../utility/yamlSchemas';
import express from 'express';
import path from 'path';
import yaml from 'js-yaml';

export class GrowApi implements ApiBaseComponent {
  protected _apiRouter?: express.Router;
  getStorage: GetStorage;

  constructor(getStorage: GetStorage) {
    this.getStorage = getStorage;
  }

  get apiRouter() {
    if (!this._apiRouter) {
      const router = express.Router({
        mergeParams: true,
      });
      router.use(express.json());

      addApiRoute(router, '/partials.get', this.getPartials.bind(this));

      // Error handler needs to be last.
      router.use(apiErrorHandler);

      this._apiRouter = router;
    }

    return this._apiRouter;
  }

  async getPartials(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expressRequest: express.Request,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expressResponse: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request: GetPartialsRequest
  ): Promise<Record<string, GrowPartialData>> {
    const storage = await this.getStorage(expressRequest, expressResponse);
    const importSchema = createImportSchema(storage);
    const partials: Record<string, GrowPartialData> = {};
    const viewFiles = await storage.readDir('/views/partials/');

    const partialInfos: Array<PendingPartialInfo> = [];
    for (const viewFile of viewFiles) {
      partialInfos.push({
        partial: path.basename(viewFile.path).split('.')[0],
        promise: storage.readFile(viewFile.path),
      });
    }

    // Read the editor config from each view file, if available.
    for (const partialInfo of partialInfos) {
      const rawViewFile = await partialInfo.promise;
      const splitParts = FrontMatter.split(rawViewFile);
      if (splitParts.frontMatter) {
        const fields = yaml.load(splitParts.frontMatter as string, {
          schema: importSchema,
        }) as Record<string, any>;

        if (fields.editor) {
          partials[partialInfo.partial] = {
            partial: partialInfo.partial,
            editor: fields.editor as EditorFileConfig,
          };
        } else {
          partials[partialInfo.partial] = {
            partial: partialInfo.partial,
          };
        }
      } else {
        partials[partialInfo.partial] = {
          partial: partialInfo.partial,
        };
      }
    }

    return partials;
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GetPartialsRequest {}

interface PendingPartialInfo {
  partial: string;
  promise: Promise<any>;
}