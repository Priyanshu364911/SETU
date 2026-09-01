import { EventEmitter } from 'events';
import { CanonicalEvent } from '../types';

type EventHandler = (event: CanonicalEvent) => void | Promise<void>;

/**
 * In-process event/metadata bus for Model 3 federation.
 * Redis-compatible interface: if REDIS_URL is set and ioredis is available,
 * events are also published there. Always works in-memory for local demos.
 */
export class EventBus {
  private emitter = new EventEmitter();
  private recent: CanonicalEvent[] = [];
  private readonly maxRecent = 500;
  private redisClient: { publish: (ch: string, msg: string) => Promise<unknown> } | null = null;

  constructor() {
    this.emitter.setMaxListeners(50);
    void this.tryInitRedis();
  }

  private async tryInitRedis() {
    const url = process.env.REDIS_URL;
    if (!url) return;
    try {
      // Optional dependency — dynamic import keeps demo runnable without Redis
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Redis = require('ioredis');
      this.redisClient = new Redis(url);
      console.log('[EventBus] Redis pub/sub connected');
    } catch {
      console.log('[EventBus] Redis unavailable — using in-memory bus only');
    }
  }

  async publish(channel: string, event: CanonicalEvent): Promise<void> {
    this.recent.push(event);
    if (this.recent.length > this.maxRecent) {
      this.recent.shift();
    }
    this.emitter.emit(channel, event);
    this.emitter.emit('*', event);

    if (this.redisClient) {
      try {
        await this.redisClient.publish(channel, JSON.stringify(event));
      } catch (err) {
        console.warn('[EventBus] Redis publish failed', err);
      }
    }
  }

  subscribe(channel: string, handler: EventHandler): () => void {
    const wrapped = (event: CanonicalEvent) => {
      Promise.resolve(handler(event)).catch((err) =>
        console.error('[EventBus] handler error', err)
      );
    };
    this.emitter.on(channel, wrapped);
    return () => this.emitter.off(channel, wrapped);
  }

  subscribeAll(handler: EventHandler): () => void {
    return this.subscribe('*', handler);
  }

  getRecent(limit = 50): CanonicalEvent[] {
    return this.recent.slice(-limit).reverse();
  }
}

export const eventBus = new EventBus();
export default eventBus;
