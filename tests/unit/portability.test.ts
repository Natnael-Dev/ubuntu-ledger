// Multi-Country Configuration & Portability Architecture Suite
// Authoritative sources: docs/specs/02-architecture.md §8 (Portability Architecture),
//                        docs/specs/11-tasks.md T-33

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getCountryConfig,
  getWardConfig,
  getWardCurrency,
  listCountries,
  listWards,
} from '@/domain/jurisdiction-config';
import { MESSAGES, assertNoBannedWords } from '@/domain/content';
import { getProjectReceipt } from '@/lib/project-receipt';
import { GET as getWardReceipts } from '@/app/api/wards/[wardCode]/receipts/route';
import { DEMO_IDS } from '@/fixtures/demo-scenario';

describe('T-33 Portability Architecture & Country Configuration', () => {
  describe('1. Anti-Hardcoding Architectural Invariant (docs/specs/02-architecture.md §8)', () => {
    it('verifies src/domain and src/app-services contain ZERO country branches (=== "KE" or === "ET")', () => {
      const targetDirs = [
        path.resolve(process.cwd(), 'src/domain'),
        path.resolve(process.cwd(), 'src/app-services'),
      ];

      const forbiddenPatterns = [
        /=== ['"]KE['"]/,
        /=== ['"]ET['"]/,
        /country\s*===\s*['"]KE['"]/,
        /country\s*===\s*['"]ET['"]/,
      ];

      for (const dir of targetDirs) {
        const files = fs.readdirSync(dir, { recursive: true }) as string[];
        for (const file of files) {
          if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
          const fullPath = path.join(dir, file);
          const content = fs.readFileSync(fullPath, 'utf8');

          for (const pattern of forbiddenPatterns) {
            const match = content.match(pattern);
            expect(
              match,
              `Portability violation in ${file}: contains forbidden country branch '${pattern}'`
            ).toBeNull();
          }
        }
      }
    });

    it('verifies application routes do not contain hardcoded "ET-AA-W09" equality checks', () => {
      const routesDir = path.resolve(process.cwd(), 'src/app');
      const files = fs.readdirSync(routesDir, { recursive: true }) as string[];

      for (const file of files) {
        if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
        const fullPath = path.join(routesDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');

        // Disallow hardcoding ward branching
        expect(
          content,
          `Found hardcoded ward code comparison in ${file}`
        ).not.toContain("=== 'ET-AA-W09'");
      }
    });
  });

  describe('2. Declarative Country & Ward Configuration', () => {
    it('loads Ethiopia (ET) configuration correctly', () => {
      const et = getCountryConfig('ET');
      expect(et).not.toBeNull();
      expect(et?.currency).toBe('ETB');
      expect(et?.dialCode).toBe('251');
      expect(et?.locales).toContain('am');
      expect(et?.locales).toContain('om');
      expect(et?.locales).toContain('en');
      expect(et?.adminTiers.length).toBeGreaterThanOrEqual(4);
    });

    it('loads Kenya (KE) configuration correctly', () => {
      const ke = getCountryConfig('KE');
      expect(ke).not.toBeNull();
      expect(ke?.currency).toBe('KES');
      expect(ke?.dialCode).toBe('254');
      expect(ke?.defaultLocale).toBe('sw');
      expect(ke?.locales).toContain('sw');
      expect(ke?.locales).toContain('en');
      expect(ke?.adminTiers.map((t) => t.name)).toContain('County');
      expect(ke?.adminTiers.map((t) => t.name)).toContain('Ward');
    });

    it('resolves ward currencies declaratively', () => {
      expect(getWardCurrency('ET-AA-W09')).toBe('ETB');
      expect(getWardCurrency('KE-NRB-ROY')).toBe('KES');
    });

    it('lists registered countries and wards', () => {
      expect(listCountries().map((c) => c.countryCode)).toEqual(['ET', 'KE']);
      expect(listWards().map((w) => w.wardCode)).toEqual(['ET-AA-W09', 'KE-NRB-ROY']);
    });

    it('ensures /config/ JSON files on disk match the domain configuration exactly', () => {
      const etJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config/countries/et.json'), 'utf8'));
      const keJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config/countries/ke.json'), 'utf8'));
      const etWardJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config/wards/et-aa-w09.json'), 'utf8'));
      const keWardJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'config/wards/ke-nrb-roy.json'), 'utf8'));

      expect(getCountryConfig('ET')).toEqual(etJson);
      expect(getCountryConfig('KE')).toEqual(keJson);
      expect(getWardConfig('ET-AA-W09')).toEqual(etWardJson);
      expect(getWardConfig('KE-NRB-ROY')).toEqual(keWardJson);
    });
  });

  describe('3. Kenyan Project Receipts & Multi-Country Ingress', () => {
    it('resolves Project 7011 in Roysambu Ward with KES currency and Kenyan citation', () => {
      const receipt = getProjectReceipt('7011');
      expect(receipt).not.toBeNull();
      expect(receipt?.projectCode).toBe('7011');
      expect(receipt?.currency).toBe('KES');
      expect(receipt?.amountMinor).toBe(85000000);
      expect(receipt?.confidence).toBe('OFFICIAL_CITED');
      expect(receipt?.source?.issuer).toContain('Nairobi');
      expect(receipt?.wardId).toBe(DEMO_IDS.WARD_ROY);
    });

    it('returns 200 for GET /api/wards/KE-NRB-ROY/receipts with Roysambu ward metadata and KES receipts', async () => {
      const req = new Request('http://localhost/api/wards/KE-NRB-ROY/receipts');
      const res = await getWardReceipts(req, {
        params: Promise.resolve({ wardCode: 'KE-NRB-ROY' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ward.code).toBe('KE-NRB-ROY');
      expect(json.ward.name).toBe('Roysambu Ward');
      expect(json.receipts.length).toBeGreaterThanOrEqual(2);
      expect(json.receipts.every((r: { currency: string }) => r.currency === 'KES')).toBe(true);
    });
  });

  describe('4. Swahili (sw) Localization Catalog Compliance', () => {
    it('contains all canonical message keys matching English catalog', () => {
      const enKeys = Object.keys(MESSAGES.en);
      const swKeys = Object.keys(MESSAGES.sw);

      for (const key of enKeys) {
        expect(swKeys, `Missing Swahili key: ${key}`).toContain(key);
      }
    });

    it('every Swahili message complies with the 182-character USSD limit', () => {
      for (const [key, text] of Object.entries(MESSAGES.sw)) {
        expect(
          text.length,
          `Swahili template '${key}' exceeds 182 characters (${text.length})`
        ).toBeLessThanOrEqual(182);
      }
    });

    it('passes content integrity assertions with zero banned words', () => {
      for (const [key, text] of Object.entries(MESSAGES.sw)) {
        expect(() => assertNoBannedWords(text), `Banned word detected in Swahili '${key}'`).not.toThrow();
      }
    });
  });
});
