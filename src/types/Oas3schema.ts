export default interface Oas3schema {
  type: string
  properties?: {[key: string]: Oas3schema}
  items?: {href: string} | Oas3schema
  required?: string[]
  anyOf: Oas3schema[]
}

