/// <reference types="express" />
import { ISearchPaginate, Query, QueryHistory } from '@ewb/mongoose-query';
import type mongoose from 'mongoose';
import { IQueryExpressOptions } from './QueryExpress.js';

declare global {
  namespace Express {
    interface Request {
      id: string;
      ewb: {
        query: Query<any>;
        queryHistory?: QueryHistory<any>;
        queryOptions: IQueryExpressOptions;

        queryPostBody?: {
          [key: string]: string | mongoose.Types.ObjectId;
        };
        queryExportJson?: any[];
        querySearchJson?: ISearchPaginate<any>;
      };
    }
  }
}
