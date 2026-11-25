import type Oas3schema from './types/Oas3schema.js'
import Service from './types/Service.js'

export type Action = 'get' | 'add' | 'replace' | 'delete' | 'update'
const methodToActionMap: {[method: string]: Action} = {
    'GET': 'get',
    'POST': 'add',
    'PUT': 'replace',
    'PATCH': 'update',
    'DELETE': 'delete'
}

// TODO: check response codes and handle errors.

async function getServiceList(url: string | URL): Promise<ServiceReference[]> {
    if(typeof url === 'string') {
        url = new URL(url)
    }
    
    const response = await fetch(url)
    if(!response.ok) {
        console.error(`Error fetching service list from ${url}: ${response.status} `, await response.json())
        return []
    }
    const data = await response.json()
    if(!data.services || !Array.isArray(data.services)) {
        console.log(`No services array found in response from ${url}.`)
        return []
    }
    return data.services.map((s: any) => new ServiceReference(new URL(s.href, url), s.name))
}

async function getActions(url: URL): Promise<Action[]> {
    const response = await fetch(url, {method: 'OPTIONS'})
    if(!response.ok) {
        console.error(`Error fetching actions from ${url}: ${response.status} `, await response.json())
        return []
    }
    const options = response.headers.get('allow')
    if(options) {
        return options.split(',')
            .map(o => methodToActionMap[o.trim().toUpperCase()])
            .filter(a => a !== undefined) as Action[]
    } else {
        console.error(`No Allow header in OPTIONS response from ${url}.`)
        return []
    }
}

export class RootNode {
    url: URL
    constructor(url: string | URL) {
        this.url = typeof url === 'string' ? new URL(url) : url
    }

    async getServiceList(): Promise<ServiceReference[]> {
        return await getServiceList(this.url)
    }
}

export class ServiceReference {
    constructor(
        public url: URL,
        public name: string
    ) {}

    async getServiceNode(): Promise<ServiceNode> {
        const serviceUrl = new URL(this.url)
        serviceUrl.searchParams.set('meta', '')

        const response = await fetch(serviceUrl)
        if(!response.ok) {
            throw new Error(`Error fetching service metadata from ${serviceUrl}: ${response.status} ${JSON.stringify(await response.json())}`)
        }
        const data = await response.json() as Service
        data.url = this.url

        return new ServiceNode(data as Service)
    }
}

export class ServiceNode {
    oasDoc: any // OpenAPI document for resolving $ref references.

    constructor(public service: Service) {}

    /**
     * Get a list of objects or the single object if the
     * service's access is unique.
     */
    async getObjects(): Promise<ObjectReference[]> {
        const response = await fetch(this.service.url)
        if(!response.ok) {
            const json = await response.json()
            throw new Error(`Error fetching objects from ${this.service.url}: ${response.status} ${json?.message ?? JSON.stringify(json)}`)
        }
        const data = await response.json()
        
        if(this.service.access === 'unique') {
            // Get the single object:
            return [new ObjectReference(this.service.url, this.service, data)]
        } else {
            // On error return a single reference with an error set:
            if(!Array.isArray(data)) {
                console.error(`Service did not return an array when access type is ${this.service.access}. Returned: `, data);
                return [new ObjectReference(undefined, this.service, undefined, /*error=*/data)]
            }

            // Create object references for each lsited object:
            return data.map((o: any, i: number) => {
                if(this.service.access === 'id') {
                    const id = this.service.identifier ? o[this.service.identifier] : o.id
                    const objectUrl = new URL(`${this.service.url.href}/${id}`, this.service.url)
                    return new ObjectReference(objectUrl, this.service, o)
                } else { // default is by index
                    const objectUrl = new URL(`${this.service.url.href}/${i}`, this.service.url)
                    return new ObjectReference(objectUrl, this.service, o)
                }
            })
        }
    }

    /**
     * Get a list of subservices.
     * Only valid for services with unique access.
     * @returns 
     */
    async getServiceList(): Promise<ServiceReference[]> {
        if(this.service.access !== 'unique') {
            throw new Error('Only services with unique access can have subservices. Did you forget to fetch the objects first?')
        }
        const metaUrl = new URL(this.service.url)
        metaUrl.searchParams.set('meta', '')
        return (await getServiceList(metaUrl))
    }

    async getActions(): Promise<Action[]> {
        return await getActions(this.service.url)
    }

    /**
     * Retrieves the schema from the server and resolves the href if the schema is not yet loaded.
     * @returns 
     */
    async resolveSchema(): Promise<Oas3schema | undefined> {
console.log(`Service: `, this.service)
        const schema = this.service.type?.schema as {href: string}
    
        if(schema?.href) {
            let url
            if(!(schema.href.startsWith('http://') || schema.href.startsWith('https://'))) {
                url = new URL(schema.href, this.service.url)
            } else {
                url = new URL(schema.href)
            }
            const response = await fetch(url)
            this.oasDoc = await response.json() // Open API document.

            // Get the path after # from the href 
            // and replace the reference with the schema:
            const hashIndex = url.hash.indexOf('#/')
            if(hashIndex >= 0) {
                const path = url.hash.substring(hashIndex + 2).split('/')
                let subdoc: any = this.oasDoc
                for(const p of path) {
                    subdoc = subdoc[p]
                }
                // Object.values(subdoc).forEach((value) => this.resolveRefs(value))
                this.service.type!.schema = subdoc
                return subdoc
            } else {
                console.error(`Could not find path '${url.hash}' at '${url.toString()}'`)
            }
        } else {
            return this.service.type?.schema as Oas3schema | undefined
        }
    }

    /**
     * Resolves any $ref references in the given schema object. 
     * This is not recursive since schema definitions may include loops.
     * @param schema 
     * @returns 
     */
    resolveRefs(schema: any) {
        if(typeof schema !== 'object' || schema === null) {
            return
        }

        // Replace reference children with lazily-loaded schemas:
        if(schema['$ref'] && typeof schema['$ref'] === 'string') {
            const refPath = schema['$ref']
            if(refPath.startsWith('#/')) {
                // Get schema from path:
                const pathParts = refPath.substring(2).split('/')
                if(!this.oasDoc) {
                    this.resolveSchema() // Load the OpenAPI document if not already loaded.
                }
                let subdoc: any = this.oasDoc
                for(const p of pathParts) {
                    subdoc = subdoc[p]
                }

                // Replace reference with schema:
                Object.assign(schema, subdoc)
                schema['$ref'] = undefined

                // Replace any child references with a lazy getter:
                // Object.entries(schema.properties).forEach(([key, value]) => {
                //     if((<any>value)['$ref']) {
                //         Object.defineProperty(schema.properties, key, {
                //             get: () => {
                //                 this.resolveRefs(value)
                //                 Object.defineProperty(schema.properties, key, <any>value)
                //                 return value
                //             }
                //         })
                //     }
                // })
            }
        }
    }
}

export class ObjectReference {
    constructor(
        public url?: URL,
        public service?: Service,
        public props?: any,
        public error?: any
    ) {}

    async getObjectNode(): Promise<ObjectNode> {
        if(this.error || !this.url || !this.service) {
            throw new Error(`Cannot get object node: ${this.error}`)
        }
        
        // Get the metadata if available:
        let metadata: any
        const metaUrl = new URL(this.url!)
        metaUrl.searchParams.set('meta', '')
        let response = await fetch(metaUrl)
        metadata = await response.json()
        if(!response.ok) {
            console.error(`Could not fetch metadata for object from ${metaUrl}: ${response.status} `, metadata)
        }

        // Get the full object:
        response = await fetch(this.url)
        if(!response.ok) {
            const json = await response.json()
            throw new Error(`Error fetching object from ${this.url}: ${response.status} ${json?.message ?? JSON.stringify(json)}`)
        }
        const data = await response.json()
        return new ObjectNode(this.url, this.service, data, metadata)
    }
}

export class ObjectNode {
    constructor(
        public url: URL, // FIXME: URL is not needed when creating - move to optional parameter and handle null URL in other methods
        public service: Service,
        public object: any, 
        public metadata: any // FIXME: should be optional
    ) {}

    /**
     * Get a list of subservices.
     * May be empty.
     */
    async getServiceList(): Promise<ServiceReference[]> {        
        const metaUrl = new URL(this.url)
        metaUrl.searchParams.set('meta', '')
        return await getServiceList(metaUrl)
    }

    async getActions(): Promise<Action[]> {
        return await getActions(this.url)
    }

    async deleteObject(): Promise<void> {
        const response = await fetch(this.url, {method: 'DELETE'})
        if(!response.ok) {
            throw new Error(`Error deleting object at ${this.url}: ${response.status} ${JSON.stringify(await response.json())}`)
        }
    }
    
    async update(): Promise<void> {
        const response = await fetch(this.url, {
            method: 'PATCH',
            headers: {
                'Content-Type': typeof this.object === 'object' ? 'application/json' : 'text/plain'
            },
            body: typeof this.object === 'object' ? JSON.stringify(this.object) : this.object
        })
        if(!response.ok) {
            throw new Error(`Error updating object at ${this.url}: ${response.status} ${JSON.stringify(await response.json())}`)
        }
    }

    async replace(): Promise<void> {
        const response = await fetch(this.url, {
            method: 'PUT',
            headers: {
                'Content-Type': typeof this.object === 'object' ? 'application/json' : 'text/plain'
            },
            body: typeof this.object === 'object' ? JSON.stringify(this.object) : this.object
        })
        if(!response.ok) {
            throw new Error(`Error replacing object at ${this.url}: ${response.status} ${JSON.stringify(await response.json())}`)
        }
    }

    async create(): Promise<void> {
console.log(`Creating object at ${this.service.url} with data: `, this.object)
        const response = await fetch(this.service.url, {
            method: 'POST',
            headers: {
                'Content-Type': typeof this.object === 'object' ? 'application/json' : 'text/plain'
            },
            body: typeof this.object === 'object' ? JSON.stringify(this.object) : this.object
        })
        if(!response.ok) {
            const message = await response.json()
            throw new Error(`Error creating object at ${this.service.url}: ${response.status} ${JSON.stringify(message)}`)
        }
    }

    async reload(): Promise<void> {
        const response = await fetch(this.url)
        if(!response.ok) {
            const json = await response.json()
            throw new Error(`Error fetching object from ${this.url}: ${response.status} ${json?.message ?? JSON.stringify(json)}`)
        }
        this.object = await response.json()
    }
}
