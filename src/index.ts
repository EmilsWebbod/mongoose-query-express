import './declarations.js';
import { Query, IMongooseQueryOptions } from '@ewb/mongoose-query';
import { NextFunction, Request, Response } from 'express';
export * from '@ewb/mongoose-query';
export * from './QueryExpress.js';

import { QueryExpress } from './QueryExpress.js';

export function initQueryExpress() {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.ewb = {
      ...req.ewb,
      query: new Query(req.query as IMongooseQueryOptions),
      queryOptions: {},
    };
    next();
  };
}

export default QueryExpress;
