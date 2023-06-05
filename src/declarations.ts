/// <reference types="express" />
import type { QueryExpressType } from './types.js';

declare global {
  namespace Express {
    interface Request {
      ewb: QueryExpressType<any, any>;
    }
  }
}
