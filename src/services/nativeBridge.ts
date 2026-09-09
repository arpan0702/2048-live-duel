import { App as CapApp } from '@capacitor/app';

type BackButtonHandler = () => void;
type BackgroundTimeoutHandler = () => void;

// 24 hours background forfeit window in milliseconds: 24 * 60 * 60 * 1000
export const BACKGROUND_FORFEIT_MS = 24 * 60 * 60 * 1000;

class NativeBridgeService {
  private backButtonHandlers: Set<BackButtonHandler> = new Set();
  private backgroundTimeout: any = null;
  private backgroundTimestamp: number | null = null;
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

    // Web visibility change listener for browser tabs
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        this.handleAppStateChange(document.visibilityState === 'visible');
      });
    }
  }

  private handleAppStateChange(isActive: boolean) {
    if (!isActive) {
      // Tab or app transitioned to background: start 24-hour grace window
      this.backgroundTimestamp = Date.now();
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
      }
      this.backgroundTimeout = setTimeout(() => {
        if (this.onDisconnectTimeout) {
          this.onDisconnectTimeout();
        }
      }, BACKGROUND_FORFEIT_MS);
    } else {
      // Returned to foreground: check if 24 hours have passed
      if (this.backgroundTimestamp && Date.now() - this.backgroundTimestamp >= BACKGROUND_FORFEIT_MS) {
        if (this.onDisconnectTimeout) {
          this.onDisconnectTimeout();
        }
      }
      // Cancel timeout since user returned within the 24-hour window
      if (this.backgroundTimeout) {
        clearTimeout(this.backgroundTimeout);
        this.backgroundTimeout = null;
      }
      this.backgroundTimestamp = null;
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
