declare module 'leaflet-kmz' {
  import * as L from 'leaflet';

  export interface KMZLayerOptions extends L.LayerOptions {
    interactive?: boolean;
    ballon?: boolean;
    bindPopup?: boolean;
    bindTooltip?: boolean;
    preferCanvas?: boolean;
    opacity?: number;
  }

  export interface KMZLoadEvent {
    layer: L.Layer;
    name: string;
  }

  export interface KMZErrorEvent {
    message?: string;
    error?: Error;
  }

  export interface KMZLayer {
    load(url: string): void;
    add(url: string): void;
    parse(data: ArrayBuffer | string, props?: Record<string, unknown>): void;
    on(event: 'load', handler: (e: KMZLoadEvent) => void): void;
    on(event: 'error', handler: (e: KMZErrorEvent) => void): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    off(event: string, handler?: (...args: unknown[]) => void): void;
    addTo(map: L.Map): this;
    remove(): this;
    options: KMZLayerOptions;
  }

  declare global {
    namespace L {
      function kmzLayer(url: string, options?: KMZLayerOptions): KMZLayer;
      function kmzLayer(options?: KMZLayerOptions): KMZLayer;
    }
  }
}
