import type { IRouteRepository, RouteProps } from "../interfaces/route-repository.interface.js";

export interface ResolveRoutesDeps {
    routeRepository: IRouteRepository;
}

export class ResolveRoutesUseCase {
    constructor(private readonly deps: ResolveRoutesDeps) {}

    /**
     * Resolve all active routes for a given source and event type.
     * Supports wildcard matching on eventType.
     */
    async execute(source: string, eventType: string): Promise<RouteProps[]> {
        return this.deps.routeRepository.findBySourceAndEventType(source, eventType);
    }
}
