export type AiProviderCircuitState = 'closed' | 'open' | 'half_open';

export type AiProviderCircuitSnapshot = {
  state: AiProviderCircuitState;
  consecutiveFailures: number;
  retryAfterMs: number;
};

type CircuitEntry = {
  consecutiveFailures: number;
  openedAt: number | null;
  probeInFlight: boolean;
  revision: number;
};

export class AiProviderCircuitBreaker {
  private readonly circuits = new Map<string, CircuitEntry>();

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = Date.now
  ) {
    if (!Number.isInteger(failureThreshold) || failureThreshold < 1 || cooldownMs < 1) {
      throw new Error('AI_PROVIDER_CIRCUIT_CONFIG_INVALID');
    }
  }

  async execute<T>(
    key: string,
    action: () => Promise<T>,
    shouldCountFailure: (error: unknown) => boolean = () => true
  ): Promise<T> {
    if (!/^[a-z][a-z0-9:_-]{0,79}$/.test(key)) {
      throw new Error('AI_PROVIDER_CIRCUIT_KEY_INVALID');
    }
    const circuit = this.getOrCreate(key);
    const startedAtRevision = circuit.revision;
    const openedAt = circuit.openedAt;
    const isHalfOpenProbe = openedAt !== null && this.now() - openedAt >= this.cooldownMs;

    if (openedAt !== null) {
      if (!isHalfOpenProbe || circuit.probeInFlight) {
        throw new Error('AI_PROVIDER_CIRCUIT_OPEN');
      }
      circuit.probeInFlight = true;
    }

    try {
      const result = await action();
      if (circuit.revision === startedAtRevision) {
        circuit.consecutiveFailures = 0;
        if (isHalfOpenProbe) {
          circuit.openedAt = null;
          circuit.revision += 1;
        }
      }
      return result;
    } catch (error) {
      if (shouldCountFailure(error) && circuit.revision === startedAtRevision) {
        circuit.consecutiveFailures += 1;
        if (isHalfOpenProbe || circuit.consecutiveFailures >= this.failureThreshold) {
          circuit.openedAt = this.now();
          circuit.revision += 1;
        }
      }
      throw error;
    } finally {
      if (isHalfOpenProbe) circuit.probeInFlight = false;
    }
  }

  getSnapshots(): Record<string, AiProviderCircuitSnapshot> {
    const now = this.now();
    return Object.fromEntries([...this.circuits.entries()].map(([key, circuit]) => {
      const elapsed = circuit.openedAt === null ? 0 : Math.max(0, now - circuit.openedAt);
      const state: AiProviderCircuitState = circuit.openedAt === null
        ? 'closed'
        : elapsed >= this.cooldownMs
          ? 'half_open'
          : 'open';
      return [key, {
        state,
        consecutiveFailures: circuit.consecutiveFailures,
        retryAfterMs: circuit.openedAt === null ? 0 : Math.max(0, this.cooldownMs - elapsed)
      }];
    }));
  }

  clear(): void {
    this.circuits.clear();
  }

  private getOrCreate(key: string): CircuitEntry {
    const existing = this.circuits.get(key);
    if (existing) return existing;
    const created: CircuitEntry = {
      consecutiveFailures: 0,
      openedAt: null,
      probeInFlight: false,
      revision: 0
    };
    this.circuits.set(key, created);
    return created;
  }
}

export const aiProviderCircuitBreaker = new AiProviderCircuitBreaker();
