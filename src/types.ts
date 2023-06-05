import type { ISearchPaginate, Query, QueryHistory } from '@ewb/mongoose-query';
import mongoose from 'mongoose';
import type { IQueryExpressOptions } from './QueryExpress.js';

export interface QueryExpressType<R extends Request, T extends object> {
  query: Query<R, T>;
  queryHistory?: QueryHistory<any>;
  queryOptions: IQueryExpressOptions;

  queryPostBody?: {
    [key: string]: string | mongoose.Types.ObjectId;
  };
  queryExportJson?: any[];
  querySearchJson?: ISearchPaginate<any>;
}
