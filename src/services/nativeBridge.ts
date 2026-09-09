import { App as CapApp } from '@capacitor/app';

type BackButtonHandler = () => void;
type BackgroundTimeoutHandler = () => void;

class NativeBridgeService {
  private backButtonHandlers: Set<BackButtonHandler> = new Set();
  private backgroundTimeout: any = null;
  private onDisconnectTimeout: BackgroundTimeoutHandler | null = null;
  private isCapacitorAvailable = false;

  constructor() {
    this.initNativeListeners();
  }

  private async initNativeListeners() {
    try {
      // Check if running in Capacitor native environment
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()) {
        this.isCapacitorAvailable = true;

        await CapApp.addListener('backButton', () => {
          if (this.backButtonHandlers.size > 0) {
            this.backButtonHandlers.forEach((handler) => handler());
          }
        });

        await CapApp.addListener('appStateChange', (state) => {
          this.handleAppStateChange(state.isActive);
        });
      }
    } catch {
      // Web fallback
    }

    // Web visibility change fallback
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.handleAppStateChange(document.visibilityState === 'visible');
      });
    }
  }

  private handleAppStateChange(isActive: boolean) {
    if (!isActive) {
      // App went to background: Start 15-second grace window
      this.backgroundTimeout = setTimeout(() => {
        if (this.onDisconnectTimeout) {
          this.onDisconnectTimeout();
        }
      }, 15000); // 15-second grace window
    } else {
      // Returned to foreground within grace window: cancel disconnection
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
        this.backgroundTimeout = null;
      }
    }
  }

  public registerBackButton(handler: BackButtonHandler) {
    this.backButtonHandlers.add(handler);
    return () => this.backButtonHandlers.delete(handler);
  }

  public setBackgroundGraceTimeout(handler: BackgroundTimeoutHandler) {
    this.onDisconnectTimeout = handler;
  }

  public isNative(): boolean {
    return this.isCapacitorAvailable;
  }
}

export const nativeBridge = new NativeBridgeService();
