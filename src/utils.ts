import { ISearchPaginate, getPageLinkHeader } from '@ewb/mongoose-query';
import { Request } from 'express';

export function pageLinkHeader(req: Request, data: ISearchPaginate<any>) {
  const rootUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  return getPageLinkHeader(rootUrl, req.mongooseQuery, data);
}
