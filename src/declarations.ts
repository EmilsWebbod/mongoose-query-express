/// <reference types="express" />
import { ISearchPaginate, Query, QueryHistory } from '@ewb/mongoose-query';
import type mongoose from 'mongoose';
import { IQueryExpressOptions } from './QueryExpress.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      mongooseQuery: Query<any>;
      mongooseHistory?: QueryHistory<any>;

      mongooseHandlerOptions?: IQueryExpressOptions;
      mongoosePostBody: {
        [key: string]: string | mongoose.Types.ObjectId;
      };
      mongooseExportJson?: any[];
      mongooseSearchJson?: ISearchPaginate<any>;
    }
  }
}
