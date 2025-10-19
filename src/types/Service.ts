export default class Service {
  constructor(
    public name: string,
    public root: string|URL,
    public href: string,
    public summary?: string,
    public description?: string,
    public access?: string,
    public identifier?: string,
    public type?: object
  ) {}
}

