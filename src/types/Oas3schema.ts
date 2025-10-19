export default interface Oas3schema {
  type: string
  properties?: object
  items?: Oas3schema
  required?: string[]
}

