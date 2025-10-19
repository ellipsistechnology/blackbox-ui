import Service from './types/Service.js'

// TODO: check response codes and handle errors.

async function getServiceList(url: string | URL): Promise<ServiceReference[]> {
    const response = await fetch(url)
    const data = await response.json()
    return data.services.map((s: any) => new ServiceReference(url, s.href, s.name))
}

export class RootNode {
    constructor(public url: string | URL) {}

    async getServiceList(): Promise<ServiceReference[]> {
        return await getServiceList(this.url)
    }
}

export class ServiceReference {
    constructor(
        public root: string|URL, // FIXME: Using a root url may be an issue for remote services.
        public href: string, 
        public name: string
    ) {}

    async getServiceNode(): Promise<ServiceNode> {
        const response = await fetch(new URL(this.href+'?meta', this.root))
        const data = await response.json()
        data.root = this.root
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
        if(this.service.access === 'unique') {
            return [new ObjectReference(this.service.root, this.service.href, {})]
        } else {
            const response = await fetch(new URL(this.service.href, this.service.root))
            const data = await response.json()
            return data.objects.map((o: any, i: number) => {
                if(this.service.access === 'indexed') {
                    return new ObjectReference(this.service.root, `${this.service.href}/${i}`, o)
                } else {
                    const id = this.service.identifier ? o[this.service.identifier] : o.id
                    return new ObjectReference(this.service.root, `${this.service.href}/${id}`, o)
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
        return await getServiceList(new URL(this.service.href+'?meta', this.service.root))
    }
}

export class ObjectReference {
    constructor(
        public root: string|URL, 
        public href: string, 
        public props: any
    ) {}

    async getObjectNode(): Promise<ObjectNode> {
        // Get the metadata:
        const meta = await fetch(new URL(`${this.href}?meta=true`, this.root))
        const metadata = await meta.json()

        const response = await fetch(new URL(this.href, this.root))
        const data = await response.json()
        return new ObjectNode(this.root, this.href, data, metadata)
    }
}

export class ObjectNode {
    constructor(
        public root: string|URL, 
        public href: string, 
        public object: any, 
        public metadata: any
    ) {}

    /**
     * Get a list of subservices.
     * May be empty.
     */
    async getServiceLIst(): Promise<ServiceReference[]> {
        return await getServiceList(new URL(this.href+'?meta', this.root))
    }
}

/**
 * Navigates a blackbox API.
 */
// export default class BlackboxClient {
//     constructor(private apiUrl: string) {}

//     /**
//      * 
//      * 
//      * @returns A list of services available from the blackbox API.
//      */
//     async listServices(resolveServices = true): Promise<ServiceList> {
//         const url = new URL(this.apiUrl)
//         console.log(`checking url pathname '${url.pathname}'`);
        
//         if(url.pathname !== '/') {
//             url.pathname += '?meta'
//         }
//         const response = await fetch(this.apiUrl)
//         const data = await response.json()

//         if(!resolveServices) {
//             return data as ServiceList
//         }

//         if(!Array.isArray(data.services)) {
//             // TODO: Log error.
//             throw new Error('Invalid service list received from blackbox API')
//         }

//         data.services = await Promise.all(data.services.map(async (s: any) => {
//             const serviceUrl = new URL(s.href, url)
//             serviceUrl.searchParams.append('meta', 'true')
//             const serviceResponse = await fetch(serviceUrl.toString())
//             const serviceResponseJson = await serviceResponse.json()
//             serviceResponseJson.root = url.toString()
//             return serviceResponseJson as Service
//         }))

//         console.log(data);
        

//         return data
//     }

//     async listObjects(href: string) {
//         const objectUrl = new URL(href, this.apiUrl)
//         const objects = await fetch(objectUrl.toString())
//         return objects.json()
//     }
// }
