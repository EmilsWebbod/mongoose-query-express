import { QueryError, QueryModel } from '@ewb/mongoose-query';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { QueryExpress } from './QueryExpress.js';

export class QueryExpressSub<
  R extends Request,
  T extends mongoose.Document<mongoose.Types.ObjectId>,
  K extends keyof T
> {
  constructor(
    private handler: QueryModel<T>,
    private express: QueryExpress<R, T>,
    private param: keyof R,
    private subKey: K
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
      req[this.param] = (await this.handler.subCreate(
        this.subKey,
        this.express.query(req),
        req.body
      ))! as any;
      this.validateReq(req);
      this.express.postHistory(req, true).then();
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        this.express.query(req),
        this.getSubDoc(req),
        this.subKey,
        'onPost'
      );
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async search(req: R, res: Response, next: NextFunction) {
    try {
      this.express.query(req).removeQuery('as');
      // @ts-ignore
      const results = (await this.handler.subSearch(
        this.subKey,
        this.express.query(req),
        this.express.getRootQuery(req)
      ))!;
      res.setHeader('Link', this.express.pageLinkHeader(req, results));
      res.setHeader('X-Total-Count', results.count);
      if (req.query.as === 'array' || this.express.query(req).page > 0) {
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
      req[this.param] = (await this.handler.subFindOne(
        this.subKey,
        this.express.query(req),
        this.getQuery(req)
      ))! as any;
      this.validateReq(req);
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        this.express.query(req),
        this.getSubDoc(req),
        this.subKey,
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
      req[this.param] = (await this.handler.subFindOneAndUpdate(
        this.subKey,
        this.express.query(req),
        this.getQuery(req),
        req.body
      ))! as any;
      this.validateReq(req);
      this.express.postHistory(req, true).then();
      this.express.removeRootRequest(req, this.express.options.slugKey);
      await this.handler.subPopulate(
        this.express.query(req),
        this.getSubDoc(req),
        this.subKey,
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
      req[this.param] = (await this.handler.subDelete(
        this.subKey,
        this.express.query(req),
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
      res.json(this.validateReq(req));
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  private getQuery(req: R) {
    const param = this.express.getParam(req, this.param);
    return { _id: new mongoose.Types.ObjectId(param) } as mongoose.FilterQuery<
      T[K]
    >;
  }

  private validateReq(req: R) {
    if (!req[this.param]) {
      throw new QueryError(httpStatus.NOT_FOUND, 'Document not found', {
        detail: `Param ${String(this.param)} not found`,
      });
    }
    return req[this.param];
  }

  private getSubDoc(req: R) {
    return req[this.param] as unknown as T[K];
  }
}
