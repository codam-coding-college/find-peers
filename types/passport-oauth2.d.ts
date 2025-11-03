// Type stub for passport-oauth2
declare module 'passport-oauth2' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export interface StrategyOptions {
    authorizationURL: string;
    tokenURL: string;
    clientID: string;
    clientSecret: string;
    callbackURL?: string;
    scope?: string | string[];
    scopeSeparator?: string;
    customHeaders?: any;
    userAgent?: string;
    state?: boolean;
    skipUserProfile?: boolean;
    pkce?: boolean;
    store?: any;
  }

  export interface Profile {
    provider: string;
    id: string;
    username?: string;
    displayName?: string;
    emails?: Array<{ value: string; type?: string }>;
    photos?: Array<{ value: string }>;
    _raw: string;
    _json: any;
  }

  export type VerifyFunction = (
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (error: any, user?: any, info?: any) => void
  ) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction);
    authenticate(req: any, options?: any): void;
  }
}
