import type {
    CreateRouteInput,
    IRouteRepository,
    RouteProps,
    UpdateRouteInput,
} from "../interfaces/route-repository.interface.js";

export interface ManageRouteDeps {
    routeRepository: IRouteRepository;
}

export class ManageRouteUseCase {
    constructor(private readonly deps: ManageRouteDeps) {}

    async create(input: CreateRouteInput): Promise<RouteProps> {
        return this.deps.routeRepository.create(input);
    }

    async findById(id: string): Promise<RouteProps | null> {
        return this.deps.routeRepository.findById(id);
    }

    async findBySource(source: string): Promise<RouteProps[]> {
        return this.deps.routeRepository.findBySource(source);
    }

    async findAll(): Promise<RouteProps[]> {
        return this.deps.routeRepository.findAll();
    }

    async update(id: string, input: UpdateRouteInput): Promise<RouteProps> {
        return this.deps.routeRepository.update(id, input);
    }

    async deactivate(id: string): Promise<void> {
        return this.deps.routeRepository.deactivate(id);
    }

    async activate(id: string): Promise<void> {
        await this.deps.routeRepository.update(id, { active: true });
    }

    async delete(id: string): Promise<void> {
        return this.deps.routeRepository.delete(id);
    }
}
