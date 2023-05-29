import './declarations';
import { Query, IMongooseQueryOptions } from '@ewb/mongoose-query';
import { Request, NextFunction, Response } from 'express';

export * from './QueryExpress.js';

function queryExpress(req: Request, _res: Response, next: NextFunction) {
  try {
    req.mongooseQuery = new Query<Request>(req.query as IMongooseQueryOptions);
    next();
  } catch (e) {
    next(e);
  }
}

export default queryExpress;
export { queryExpress };
