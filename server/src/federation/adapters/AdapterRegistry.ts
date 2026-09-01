import { VmsAdapter, AdapterType } from '../types';
import { VmsAAdapter } from './VmsAAdapter';
import { VmsBAdapter } from './VmsBAdapter';
import { GovFeedAdapter } from './GovFeedAdapter';

export class AdapterRegistry {
  private adapters = new Map<string, VmsAdapter>();

  register(adapter: VmsAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): VmsAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): VmsAdapter[] {
    return Array.from(this.adapters.values());
  }

  remove(id: string) {
    this.adapters.delete(id);
  }

  create(
    type: AdapterType,
    systemId: string,
    baseUrl: string,
    config?: Record<string, unknown>
  ): VmsAdapter {
    switch (type) {
      case 'vms_a_rest':
        return new VmsAAdapter(systemId, baseUrl);
      case 'vms_b_events':
        return new VmsBAdapter(systemId, baseUrl);
      case 'gov_feed':
      case 'onvif_rtsp':
        return new GovFeedAdapter(
          systemId,
          baseUrl,
          (config?.feeds as any[]) || [],
          (config?.token as string) || process.env.SENTINEL_API_TOKEN || ''
        );
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }
  }
}

export const adapterRegistry = new AdapterRegistry();
export default adapterRegistry;
