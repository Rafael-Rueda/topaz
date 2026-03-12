import type {
    CreateSourceInput,
    ISourceRepository,
    SourceProps,
    UpdateSourceInput,
} from "../interfaces/source-repository.interface.js";

export interface ManageSourceDeps {
    sourceRepository: ISourceRepository;
}

export class ManageSourceUseCase {
    constructor(private readonly deps: ManageSourceDeps) {}

    async create(input: CreateSourceInput): Promise<SourceProps> {
        return this.deps.sourceRepository.create(input);
    }

    async findById(id: string): Promise<SourceProps | null> {
        return this.deps.sourceRepository.findById(id);
    }

    async findByName(name: string): Promise<SourceProps | null> {
        return this.deps.sourceRepository.findByName(name);
    }

    async findAll(): Promise<SourceProps[]> {
        return this.deps.sourceRepository.findAll();
    }

    async findActive(): Promise<SourceProps[]> {
        return this.deps.sourceRepository.findActive();
    }

    async update(id: string, input: UpdateSourceInput): Promise<SourceProps> {
        return this.deps.sourceRepository.update(id, input);
    }

    async upsert(input: CreateSourceInput): Promise<SourceProps> {
        return this.deps.sourceRepository.upsert(input);
    }

    async deactivate(id: string): Promise<void> {
        return this.deps.sourceRepository.deactivate(id);
    }

    async activate(id: string): Promise<void> {
        await this.deps.sourceRepository.update(id, { active: true });
    }

    async delete(id: string): Promise<void> {
        return this.deps.sourceRepository.delete(id);
    }
}
