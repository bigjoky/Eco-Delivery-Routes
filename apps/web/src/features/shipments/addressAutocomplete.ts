import { ContactSummary } from '../../core/api/types';

export type AddressSuggestion = {
  address_street?: string | null;
  address_number?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  address_notes?: string | null;
};

type SuggestionContext = {
  street?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  documentId?: string;
};

function compact(value?: string | null): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

function compactUpper(value?: string | null): string {
  return compact(value).toUpperCase();
}

function normalizePostalCode(country: string, postalCode?: string | null): string {
  const value = compactUpper(postalCode).replace(/\s+/g, '');
  if (!value) return '';
  if (country === 'PT') {
    const digits = value.replace(/[^0-9]/g, '');
    if (digits.length === 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return value;
}

function normalizeCountry(country?: string | null): string {
  const value = compactUpper(country);
  return value || 'ES';
}

function toSuggestion(row: ContactSummary): AddressSuggestion {
  const country = normalizeCountry(row.country);
  return {
    address_street: compact(row.address_street),
    address_number: compact(row.address_number),
    postal_code: normalizePostalCode(country, row.postal_code),
    city: compact(row.city),
    province: compact(row.province),
    country,
    address_notes: compact(row.address_notes),
  };
}

function scoreSuggestion(row: ContactSummary, suggestion: AddressSuggestion, context: SuggestionContext): number {
  let score = 0;
  const contextStreet = compactUpper(context.street);
  const contextPostal = normalizePostalCode(normalizeCountry(suggestion.country), context.postalCode);
  const contextCity = compactUpper(context.city);
  const contextPhone = compactUpper(context.phone).replace(/\s+/g, '');
  const contextDocument = compactUpper(context.documentId);

  const rowStreet = compactUpper(suggestion.address_street);
  const rowPostal = compactUpper(suggestion.postal_code);
  const rowCity = compactUpper(suggestion.city);
  const rowPhone = compactUpper(row.phone).replace(/\s+/g, '');
  const rowDocument = compactUpper(row.document_id);

  if (contextStreet && rowStreet === contextStreet) score += 10;
  else if (contextStreet && rowStreet.includes(contextStreet)) score += 6;
  if (contextPostal && rowPostal === contextPostal) score += 8;
  if (contextCity && rowCity === contextCity) score += 6;
  else if (contextCity && rowCity.includes(contextCity)) score += 3;
  if (contextPhone && rowPhone === contextPhone) score += 5;
  if (contextDocument && rowDocument === contextDocument) score += 5;

  return score;
}

export function buildAddressSuggestions(rows: ContactSummary[], context: SuggestionContext): AddressSuggestion[] {
  const dedupe = new Set<string>();
  const scored = rows
    .map((row) => {
      const suggestion = toSuggestion(row);
      const key = [
        suggestion.address_street ?? '',
        suggestion.address_number ?? '',
        suggestion.postal_code ?? '',
        suggestion.city ?? '',
        suggestion.province ?? '',
        suggestion.country ?? '',
      ].join('|');
      return {
        key,
        suggestion,
        score: scoreSuggestion(row, suggestion, context),
      };
    })
    .filter((item) => item.key.replace(/\|/g, '').trim().length > 0)
    .filter((item) => {
      if (dedupe.has(item.key)) return false;
      dedupe.add(item.key);
      return true;
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 5).map((item) => item.suggestion);
}
