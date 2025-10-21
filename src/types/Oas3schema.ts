export default interface Oas3schema {
  type: string
  properties?: object
  items?: {href: string} | Oas3schema
  required?: string[]
}

