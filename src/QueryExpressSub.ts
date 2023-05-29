import { QueryError, QueryHandler } from '@ewb/mongoose-query';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { QueryExpress } from './QueryExpress.js';
import { pageLinkHeader } from './utils';

export class QueryExpressSub<
  R extends Request,
  T extends mongoose.Document,
  K extends keyof T
> {
  constructor(
    private handler: QueryHandler<T>,
    private express: QueryExpress<R, T>,
    private reqKey: keyof R,
    private param: K
  ) {
    this.post = this.post.bind(this);
    this.search = this.search.bind(this);
    this.findOne = this.findOne.bind(this);
    this.patch = this.patch.bind(this);
    this.delete = this.delete.bind(this);
    this.json = this.json.bind(this);
  }

  public async post(req: R, _res: Response, next: NextFunction) {
    try {
      this.express.addRootRequest(req);
      req[this.reqKey] = (await this.handler.subCreate(
        this.param,
        req.mongooseQuery,
        req.body
      ))! as any;
      this.validateReq(req);
      this.express.postHistory(req, true).then();
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        req.mongooseQuery,
        this.getSubDoc(req),
        this.param,
        'onPost'
      );
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async search(req: R, res: Response, next: NextFunction) {
    try {
      req.mongooseQuery.removeQuery('as');
      // @ts-ignore
      const results = (await this.handler.subSearch(
        this.param,
        req.mongooseQuery,
        this.express.getRootQuery(req)
      ))!;
      res.setHeader('Link', pageLinkHeader(req, results));
      res.setHeader('X-Total-Count', results.count);
      if (req.query.as === 'array' || req.mongooseQuery.page > 0) {
        return res.json(results.data);
      }
      // await this.handler.subPopulate(req, results.data, this.param, 'onSearch');
      res.json(results);
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async findOne(req: R, _res: Response, next: NextFunction) {
    try {
      this.express.addRootRequest(req);
      req[this.reqKey] = (await this.handler.subFindOne(
        this.param,
        req.mongooseQuery,
        this.getQuery(req)
      ))! as any;
      this.validateReq(req);
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        req.mongooseQuery,
        this.getSubDoc(req),
        this.param,
        'onFindOne'
      );
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async patch(req: R, _res: Response, next: NextFunction) {
    try {
      this.express.addRootRequest(req);
      req[this.reqKey] = (await this.handler.subFindOneAndUpdate(
        this.param,
        req.mongooseQuery,
        this.getQuery(req),
        req.body
      ))! as any;
      this.validateReq(req);
      this.express.postHistory(req, true).then();
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        req.mongooseQuery,
        this.getSubDoc(req),
        this.param,
        'onPatch'
      );
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async delete(req: R, _res: Response, next: NextFunction) {
    try {
      this.express.addRootRequest(req);
      req[this.reqKey] = (await this.handler.subDelete(
        this.param,
        req.mongooseQuery,
        this.getQuery(req)
      ))! as any;
      this.express.postHistory(req, true).then();
      this.validateReq(req);
      this.express.removeRootRequest(req, this.express.options.slugKey);
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async json(req: R, res: Response, next: NextFunction) {
    try {
      this.validateReq(req);
      res.json(req[this.reqKey]);
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  private getQuery(req: R) {
    const param = this.express.getParam(req, this.reqKey);
    return { _id: new mongoose.Types.ObjectId(param) } as mongoose.FilterQuery<
      T[K]
    >;
  }

  private validateReq(req: R) {
    if (!req[this.reqKey]) {
      throw new QueryError(httpStatus.NOT_FOUND, String(this.param), {
        detail: 'Param not found',
      });
    }
  }

  private getSubDoc(req: R) {
    return req[this.reqKey] as unknown as T[K];
  }
}
