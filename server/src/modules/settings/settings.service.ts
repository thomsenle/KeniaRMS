import { db } from '../../db/index.js';

export interface AppSettingsDTO {
  pricing_location: string;
  pricing_radius_km: number;
  pricing_target_margin: number;
  has_gemini_key: boolean;
  gemini_key_masked?: string;
  ai_provider: string;
}

export class SettingsService {
  static getSetting(key: string, defaultValue: string = ''): string {
    try {
      const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
      return row ? row.value : defaultValue;
    } catch (err) {
      return defaultValue;
    }
  }

  static setSetting(key: string, value: string): void {
    db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value);
  }

  static getAppSettings(): AppSettingsDTO {
    const location = this.getSetting('pricing_location', 'Diani Beach');
    const radius = Number(this.getSetting('pricing_radius_km', '15')) || 15;
    const margin = Number(this.getSetting('pricing_target_margin', '70')) || 70;
    const rawKey = this.getSetting('ai_gemini_api_key', '') || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    const provider = this.getSetting('ai_provider', 'gemini');

    let maskedKey = '';
    if (rawKey && rawKey.length > 8) {
      maskedKey = `${rawKey.substring(0, 4)}••••••••${rawKey.substring(rawKey.length - 4)}`;
    } else if (rawKey) {
      maskedKey = '••••••••';
    }

    return {
      pricing_location: location,
      pricing_radius_km: radius,
      pricing_target_margin: margin,
      has_gemini_key: !!rawKey,
      gemini_key_masked: maskedKey,
      ai_provider: provider
    };
  }

  static updateAppSettings(data: Partial<{
    pricing_location: string;
    pricing_radius_km: number;
    pricing_target_margin: number;
    ai_gemini_api_key: string;
    ai_provider: string;
  }>): AppSettingsDTO {
    if (data.pricing_location !== undefined) {
      this.setSetting('pricing_location', data.pricing_location.trim());
    }
    if (data.pricing_radius_km !== undefined) {
      this.setSetting('pricing_radius_km', String(Number(data.pricing_radius_km) || 15));
    }
    if (data.pricing_target_margin !== undefined) {
      this.setSetting('pricing_target_margin', String(Number(data.pricing_target_margin) || 70));
    }
    if (data.ai_gemini_api_key !== undefined) {
      // If user provided a new key (or explicitly cleared it)
      this.setSetting('ai_gemini_api_key', data.ai_gemini_api_key.trim());
    }
    if (data.ai_provider !== undefined) {
      this.setSetting('ai_provider', data.ai_provider.trim());
    }

    return this.getAppSettings();
  }
}
