import type Oas3schema from "./Oas3schema";

export default class Service {
  [key: string]: any // metadata

  constructor(
    public name: string,
    public url: URL,
    public summary?: string,
    public description?: string,
    public access?: string,
    public identifier?: string,
    public type?: {
      format?: string,
      schema?: {href: string} | Oas3schema
    }
  ) {}
}

