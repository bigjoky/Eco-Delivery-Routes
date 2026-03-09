export type DocumentType = 'DNI' | 'NIE' | 'PASSPORT' | 'CIF';
export type ShipmentServiceType =
  | 'express_1030'
  | 'express_1400'
  | 'express_1900'
  | 'economy_parcel'
  | 'business_parcel'
  | 'thermo_parcel';

export function inferDocumentType(documentId: string, fallback: DocumentType): DocumentType {
  const normalized = documentId.trim().toUpperCase();
  if (!normalized) return fallback;
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(normalized)) return 'NIE';
  if (/^[0-9]{8}[A-Z]$/.test(normalized)) return 'DNI';
  if (/^[A-HJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(normalized)) return 'CIF';
  return fallback;
}

export function isValidPhone(phone: string): boolean {
  if (!phone.trim()) return true;
  return /^[+0-9 -]{7,20}$/.test(phone.trim());
}

export function isValidEmail(email: string): boolean {
  if (!email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPostalCode(country: string, postalCode: string): boolean {
  const normalizedCountry = country.trim().toUpperCase();
  const normalizedPostalCode = postalCode.trim().toUpperCase();
  if (!normalizedPostalCode) return true;

  const byCountry: Record<string, RegExp> = {
    ES: /^[0-9]{5}$/,
    PT: /^[0-9]{4}-?[0-9]{3}$/,
    FR: /^[0-9]{5}$/,
    DE: /^[0-9]{5}$/,
    IT: /^[0-9]{5}$/,
  };
  const pattern = byCountry[normalizedCountry] ?? /^[0-9A-Z -]{4,10}$/;
  return pattern.test(normalizedPostalCode);
}

export function hasRequiredRecipientName(docType: DocumentType, legalName: string, firstName: string, lastName: string): boolean {
  if (docType === 'CIF') return legalName.trim().length > 0;
  return firstName.trim().length > 0 && lastName.trim().length > 0;
}

export function hasRequiredSenderName(docType: DocumentType, legalName: string, firstName: string, lastName: string): boolean {
  if (docType === 'CIF') return legalName.trim().length > 0;
  return firstName.trim().length > 0 && lastName.trim().length > 0;
}

export function isProvinceRequired(country: string): boolean {
  const normalizedCountry = country.trim().toUpperCase();
  return normalizedCountry === 'ES' || normalizedCountry === 'PT' || normalizedCountry === 'IT';
}

export function isServiceDateAllowed(serviceType: ShipmentServiceType, isoDate: string): boolean {
  const raw = isoDate.trim();
  if (!raw) return true;
  const parsed = Date.parse(raw.includes('T') ? raw : `${raw}T00:00:00Z`);
  if (Number.isNaN(parsed)) return false;
  const day = new Date(parsed).getUTCDay(); // 0 Sunday .. 6 Saturday

  if (serviceType === 'business_parcel') {
    return day >= 1 && day <= 5;
  }
  if (serviceType === 'thermo_parcel') {
    return day >= 1 && day <= 6;
  }
  return true;
}
