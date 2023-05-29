import { Query, QueryError, QueryHandler } from '@ewb/mongoose-query';
import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import mongoose from 'mongoose';
import { QueryExpressSub } from './QueryExpressSub.js';
import { pageLinkHeader } from './utils';

export interface IQueryExpressOptions {
  skipHandlerAction?:
    | 'post'
    | 'patch'
    | 'archive'
    | 'findOne'
    | 'search'
    | 'delete'
    | 'export';
}

export interface IQueryExpressHandlerOptions<T extends object> {
  slugKey?: keyof T & string;
  archiveKey?: keyof T;
  history?: {
    active: boolean;
    ignoreFields?: (keyof T)[];
  };
}

interface BulkProps {
  runNext?: boolean;
}

export class QueryExpress<R extends Request, T extends mongoose.Document> {
  constructor(
    private param: keyof R,
    private handler: QueryHandler<T>,
    readonly options: IQueryExpressHandlerOptions<T> = {}
  ) {
    this.post = this.post.bind(this);
    this.findOne = this.findOne.bind(this);
    this.search = this.search.bind(this);
    this.searchNext = this.searchNext.bind(this);
    this._search = this._search.bind(this);
    this.export = this.export.bind(this);
    this.patch = this.patch.bind(this);
    this.archive = this.archive.bind(this);
    this.delete = this.delete.bind(this);
    this.json = this.json.bind(this);
    this.bulkPatch = this.bulkPatch.bind(this);
    this.bulkDelete = this.bulkDelete.bind(this);
    this.bulkArchive = this.bulkArchive.bind(this);
    this.subRoute = this.subRoute.bind(this);
    this.addToQuery = this.addToQuery.bind(this);
    this.addToPost = this.addToPost.bind(this);
    this.getDoc = this.getDoc.bind(this);
  }

  public async post(req: R, res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'post') {
        return next();
      }
      this.validateBody(req);
      this.init(req);
      if (req.mongoosePostBody) {
        // tslint:disable-next-line:forin
        for (const key in req.mongoosePostBody) {
          req.body[key] = req.mongoosePostBody[key];
        }
      }
      req[this.param] = (await this.handler.create(req.body)) as any;
      await this.handler.populate(req.mongooseQuery, this.getDoc(req));
      res.status(201);
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async findOne(req: R, _res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'findOne') {
        return next();
      }
      this.init(req);
      this.addRootRequest(req);
      req[this.param] = (await this.handler.findOne(
        req.mongooseQuery as Query<T>,
        this.getFindOpts(req)
      )) as any;
      this.preHistory(req);
      this.removeRootRequest(req, this.options.slugKey);
      this.validateReq(req);
      await this.handler.populate(
        req.mongooseQuery,
        this.getDoc(req),
        'onFindOne'
      );
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async search(req: R, res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'search') {
        return next();
      }
      const data = await this._search(req, res);

      if (req.query.as === 'array' || req.mongooseQuery.page > 0) {
        return res.json(data.data);
      }
      return res.json(data);
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async searchNext(req: R, res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'search') {
        return next();
      }
      req.mongooseSearchJson = await this._search(req, res);
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  private async _search(req: R, res: Response) {
    this.init(req);
    req.mongooseQuery.removeQuery('as');
    // @ts-ignore
    const data = await this.handler.search(req.mongooseQuery);
    res.setHeader('Link', pageLinkHeader(req, data));
    res.setHeader('X-Total-Count', data.count);
    return data;
  }

  public async export(req: R, res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'export') {
        return next();
      }
      this.init(req);
      req.mongooseQuery.export = true;
      const paginate = await this.handler.search(req.mongooseQuery);
      res.setHeader('Link', pageLinkHeader(req, paginate));
      res.setHeader('X-Total-Count', paginate.count);

      req.mongooseExportJson = paginate.data;
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async patch(req: R, _res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'patch') {
        return next();
      }
      this.validateReq(req);
      this.validateBody(req);
      this.init(req);
      const query = req.mongooseQuery as Query<T>;
      req[this.param] = (await this.handler.findOneAndUpdate(
        query,
        { _id: this.getDoc(req)._id },
        { $set: req.body } as any
      )) as any;
      this.postHistory(req).then();
      await this.handler.populate(
        req.mongooseQuery,
        this.getDoc(req),
        'onPatch'
      );

      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async archive(req: R, _res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'archive') {
        return next();
      }
      this.validateReq(req);
      this.init(req);
      req[this.param] = (await this.handler.findOneAndUpdate(
        req.mongooseQuery as Query<T>,
        { _id: this.getDoc(req)._id },
        // @ts-ignore
        { [this.options.archiveKey]: true }
      )) as any;
      this.postHistory(req).then();

      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async delete(req: R, _res: Response, next: NextFunction) {
    try {
      if (req.mongooseHandlerOptions.skipHandlerAction === 'delete') {
        return next();
      }
      this.validateReq(req);
      this.init(req);
      await this.handler.deleteOne({ _id: this.getDoc(req)._id });

      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async json(req: R, res: Response, next: NextFunction) {
    try {
      this.validateReq(req);

      const ret = await this.handler.json(req[this.param] as any);

      if (typeof req.query.select === 'string') {
        const newRet: { [key: string]: any } = {};
        const selectArray = req.query.select.split(',');
        for (const key of selectArray) {
          newRet[key] = ret[key];
        }
        return res.json(newRet);
      }

      res.json(ret);
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public async bulkPatch(req: R, res: Response, next: NextFunction) {
    try {
      const ids = this.validateIdsInBody(req);
      delete req.body.ids;
      this.handler.validateBody(req.body);
      await this.handler.updateMany(
        req.mongooseQuery.root || {},
        ids,
        req.body
      );
      req.mongooseQuery.addRoot({ _id: { $in: ids } });
      req.mongooseQuery.setSkipAndLimit(0, ids.length);
      req.query.as = 'array';
      return this.search(req, res, next);
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public bulkDelete({ runNext }: BulkProps) {
    return async (req: R, res: Response, next: NextFunction) => {
      try {
        const ids = this.validateIdsInBody(req);
        const deleted = await this.handler.deleteMany(
          req.mongooseQuery.root || {},
          ids
        );
        if (runNext) {
          return next();
        }
        res.json(deleted);
      } catch (e) {
        next(QueryError.catch(e));
      }
    };
  }

  public bulkArchive({ runNext }: BulkProps) {
    return async (req: R, res: Response, next: NextFunction) => {
      try {
        const ids = this.validateIdsInBody(req);
        // @ts-ignore
        await this.handler.updateMany(req.mongooseQuery.root || {}, ids, {
          [this.options.archiveKey]: true,
        });
        if (runNext) {
          return next();
        }
        res.json(
          ids.map((_id) => ({ _id, [String(this.options.archiveKey)]: true }))
        );
      } catch (e) {
        next(QueryError.catch(e));
      }
    };
  }

  public addToNextQuery(fn: (req: R) => mongoose.FilterQuery<T> | null) {
    return (req: R, _: Response, next: NextFunction) => {
      try {
        const data = fn(req);
        if (data) {
          req.mongooseQuery.addRootNext(data);
        }
        next();
      } catch (e) {
        next(QueryError.catch(e));
      }
    };
  }

  public subRoute(req: R, _res: Response, next: NextFunction) {
    try {
      this.validateReq(req);
      this.init(req);
      if (!req.mongoosePostBody) {
        req.mongoosePostBody = {};
      }
      const doc = this.getDoc(req);
      req.mongoosePostBody[this.param as string] = doc._id;
      req.mongooseQuery.addRoot({
        [this.param]: doc._id,
      } as mongoose.FilterQuery<T>);
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public subDoc<R2 extends keyof R, P extends keyof T>(
    reqKey: R2,
    subArrayKey: P
  ) {
    return new QueryExpressSub<R, T, P>(
      this.handler,
      this,
      reqKey,
      subArrayKey
    );
  }

  public addRootRequest(req: R) {
    req.mongooseQuery.addRoot(this.getRootQuery(req));
  }

  public getRootQuery(req: R): mongoose.FilterQuery<T> {
    const param = this.getParam(req);

    if (
      param.match(/^[0-9a-fA-F]{24}$/) &&
      mongoose.Types.ObjectId.isValid(param)
    ) {
      return {
        _id: new mongoose.Types.ObjectId(param),
      } as mongoose.FilterQuery<T>;
    }
    if (this.options.slugKey) {
      return { [this.options.slugKey]: param } as mongoose.FilterQuery<T>;
    }
    throw new QueryError(httpStatus.BAD_REQUEST, `Param is not valid`, {
      detail: 'Need to be of type MongoDB ObjectID',
    });
  }

  public removeRootRequest(req: R, slugKey?: string) {
    req.mongooseQuery.deleteKeysFromRoot([
      '_id',
      ...(slugKey ? [slugKey] : []),
    ]);
  }

  public addToQuery(req: R, _res: Response, next: NextFunction) {
    try {
      req.mongooseQuery.addRoot({
        [this.param]: this.getDoc(req)._id,
      } as mongoose.FilterQuery<T>);
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public addToPost(req: R, _res: Response, next: NextFunction) {
    try {
      this.validateReq(req);
      if (!req.mongoosePostBody) {
        req.mongoosePostBody = {};
      }
      req.mongoosePostBody[this.param as string] = this.getDoc(req)._id;
      next();
    } catch (e) {
      next(QueryError.catch(e));
    }
  }

  public getParam(req: R, param = this.param) {
    if (req[param]) {
      return this.getDoc(req, param)._id.toHexString();
    }
    if (!req.params[param as string]) {
      throw new QueryError(httpStatus.BAD_REQUEST, String(param), {
        detail: 'Param is not valid',
      });
    }
    return req.params[param as string];
  }

  public preHistory(req: R) {
    if (this.options.history?.active && req.mongooseHistory) {
      if (this.options.history.ignoreFields) {
        req.mongooseHistory.setIgnoreFields(this.options.history.ignoreFields);
      }
      req.mongooseHistory.setModel(this.handler.model);
      req.mongooseHistory.setOldDoc(this.getDoc(req).toObject());
    }
  }

  public async postHistory(req: R, fetchNew?: boolean) {
    if (this.options.history?.active && req.mongooseHistory) {
      let doc = this.getDoc(req);
      if (fetchNew) {
        doc = await req.mongooseHistory.findUpdated();
      }
      req.mongooseHistory.setUpdatedDoc(doc);
      req.mongooseHistory.setDiff(doc._id).then();
    }
  }

  public init(req: R) {
    // @ts-ignore
    req.mongooseQuery.parameter = this.param;
  }

  private getDoc(req: R, param = this.param) {
    return req[param] as unknown as T;
  }

  private validateBody(req: R) {
    const invalidFields = this.handler.validateBody(req.body);
    if (invalidFields) {
      throw new QueryError(httpStatus.BAD_REQUEST, 'Invalid body', {
        detail:
          'Body contained invalid keys, remove keys located in source.body to post or patch',
        errors: invalidFields.map((x) => ({
          message: 'Invalid field',
          detail: x,
        })),
      });
    }
  }

  // todo: Not sure how to check if it should select or populate with help of req
  // Need to check if this is the last query param should be end of url?
  private getFindOpts(_req: R) {
    return {
      select: false,
      populate: false,
    };
  }

  private validateReq(req: R) {
    if (!req[this.param]) {
      throw new QueryError(httpStatus.BAD_REQUEST, String(this.param), {
        detail: 'Param is not valid',
      });
    }
  }

  private validateIdsInBody(req: R): mongoose.Types.ObjectId[] {
    if (!req.body.ids) {
      throw new QueryError(httpStatus.BAD_REQUEST, 'ids', {
        detail: 'ids is required',
      });
    }
    return req.body.ids.map((x: string) => new mongoose.Types.ObjectId(x));
  }
}
