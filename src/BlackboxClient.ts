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
    
    try {
        const response = await fetch(url)
        const data = await response.json()
        if(!data.services || !Array.isArray(data.services)) {
            console.log(`No services array found in response from ${url}: `, data)
            return []
        }
        return data.services.map((s: any) => new ServiceReference(new URL(s.href, url), s.name))
    } catch (err) {
        console.error(`Error fetching service list from ${url}: `, err)
        return []
    }
}

async function getActions(url: URL): Promise<Action[]> {
    const response = await fetch(url, {method: 'OPTIONS'})
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
        const data = await response.json() as Service
        data.url = this.url

        return new ServiceNode(data as Service)
    }
}

export class ServiceNode {
    constructor(public service: Service) {}

    /**
     * Get a list of objects or the single object if the
     * service's access is unique.
     */
    async getObjects(): Promise<ObjectReference[]> {
        const props = await fetch(this.service.url)
        const data = await props.json()
        
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
                if(this.service.access === 'index') {
                    const objectUrl = new URL(`${this.service.url.href}/${i}`, this.service.url)
                    return new ObjectReference(objectUrl, this.service, o)
                } else {
                    const id = this.service.identifier ? o[this.service.identifier] : o.id
                    const objectUrl = new URL(`${this.service.url.href}/${id}`, this.service.url)
                    return new ObjectReference(objectUrl, this.service, o)
                }
            })
        }
    }

    /**
     * 
     * @returns 
     */
    async getServiceList(): Promise<ServiceReference[]> {
        if(this.service.access !== 'unique') {
            throw new Error('Only services with unique access can have subservices. Did you forget to fetch the objects first?')
        }
        const metaUrl = new URL(this.service.url)
        metaUrl.searchParams.set('meta', '')
        return await getServiceList(metaUrl)
    }

    async getActions(): Promise<Action[]> {
        return await getActions(this.service.url)
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
        try {
            const metaUrl = new URL(this.url!)
            metaUrl.searchParams.set('meta', '')
            const meta = await fetch(metaUrl)
            metadata = await meta.json()
        } catch (err) {
            console.error(`Could not fetch metadata for object at ${this.url}: `, err)
        }

        const response = await fetch(this.url)
        const data = await response.json()
        return new ObjectNode(this.url, this.service, data, metadata)
    }
}

export class ObjectNode {
    constructor(
        public url: URL,
        public service: Service,
        public object: any, 
        public metadata: any
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
        await fetch(this.url, {method: 'DELETE'})
    }
    
    async update(): Promise<void> {
        await fetch(this.url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.object)
        })
    }

    async replace(): Promise<void> {
        await fetch(this.url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.object)
        })
    }

    async create(): Promise<void> {
        await fetch(this.service.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.object)
        })
    }
}
