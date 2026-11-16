import { describe, expect, it } from 'vitest';
import { DM_QUESTIONS, parseDm } from './dmBooking';

// Monday 16 November 2026.
const today = new Date(2026, 10, 16);
const read = (text: string) => parseDm(text, today);

describe('reading a guest message', () => {
  it('reads a Dutch request with day, time, party, name and a wish', () => {
    const f = read(`Hoi! Wij zijn met z'n zessen en willen graag zaterdag 21 november om 10 uur een tour door oud Tbilisi.
We houden erg van geschiedenis. Eén van ons is vegetarisch.
Groetjes, Anna de Vries`);
    expect(f).toMatchObject({ date: '2026-11-21', time: '10:00', adults: 6, leadName: 'Anna de Vries' });
    expect(f.notes).toContain('geschiedenis');
    expect(f.notes).toContain('vegetarisch');
    expect(f.children).toBeUndefined();
  });

  it('reads an English request with am/pm, children and a handle', () => {
    const f = read('Hi, my name is Sarah Jones (@sarah.travels). Do you have a private tour tomorrow at 3pm for 2 adults and 1 child? One of us uses a wheelchair.');
    expect(f).toMatchObject({ date: '2026-11-17', time: '15:00', adults: 2, children: 1, leadName: 'Sarah Jones', contact: '@sarah.travels', privateGroup: true });
    expect(f.notes).toContain('wheelchair');
  });

  it('reads the answer to the fixed questions completely', () => {
    const f = read(`${DM_QUESTIONS.split('\n')[0]}
Datum: 3 december
Starttijd: 14.30
Aantal volwassenen: 4
Aantal kinderen: 2
Naam: jan pietersen
Wensen (bijv. dieet of slecht ter been): opa loopt met een rollator`);
    expect(f).toEqual({ date: '2026-12-03', time: '14:30', adults: 4, children: 2, leadName: 'jan pietersen', notes: 'opa loopt met een rollator' });
  });

  it('finds nothing in the unanswered questions', () => {
    expect(read(DM_QUESTIONS)).toEqual({});
  });

  it('reads days: relative, weekday, next week, numbers and the next year', () => {
    expect(read('kan het morgen?').date).toBe('2026-11-17');
    expect(read('overmorgen graag').date).toBe('2026-11-18');
    expect(read("'s morgens het liefst, vandaag nog").date).toBe('2026-11-16');
    expect(read('aanstaande vrijdag').date).toBe('2026-11-20');
    expect(read('maandag dan').date).toBe('2026-11-23'); // today is Monday: the next one
    expect(read('next week Saturday').date).toBe('2026-11-28');
    expect(read('op 21-11').date).toBe('2026-11-21');
    expect(read('on 05/12/2026').date).toBe('2026-12-05');
    expect(read('January 4th please').date).toBe('2027-01-04');
    expect(read('30 februari').date).toBeUndefined();
  });

  it('does not take a count or a length for a day or a time', () => {
    const f = read('We zijn met 4-6 personen en willen een tour van 2 uur, rond 20 november.');
    expect(f.date).toBe('2026-11-20');
    expect(f.time).toBeUndefined();
    expect(read('Is er om een tour te boeken nog plek?').time).toBeUndefined();
  });

  it('reads times: colon, u, half, bare hours and day parts', () => {
    expect(read('om 10:30').time).toBe('10:30');
    expect(read('10u30 graag').time).toBe('10:30');
    expect(read('om half 3').time).toBe('14:30');
    expect(read('at 4').time).toBe('16:00');
    expect(read("om 8 uur 's avonds").time).toBe('20:00');
    expect(read('at 9 am').time).toBe('09:00');
    expect(read('Goedemiddag! Kan het om 11 uur?').time).toBe('11:00');
    expect(read('Good evening, 10 o\'clock would be great').time).toBe('10:00');
  });

  it('reads the party in several wordings', () => {
    expect(read('6 personen, waarvan 2 kinderen')).toMatchObject({ adults: 4, children: 2 });
    expect(read('4 personen en 2 kinderen')).toMatchObject({ adults: 4, children: 2 });
    expect(read('a group of eight')).toMatchObject({ adults: 8 });
    expect(read('ik en mijn vrouw')).toMatchObject({ adults: 2 });
    expect(read('een man of zes')).toMatchObject({ adults: 6 });
    expect(read("met z'n 5en")).toMatchObject({ adults: 5 });
  });

  it('reads contact details but not a date as a phone number', () => {
    expect(read('bel me op +31 6 12345678').contact).toBe('+31 6 12345678');
    expect(read('mail naar anna@voorbeeld.nl').contact).toBe('anna@voorbeeld.nl');
    expect(read('op 06-11-2026 graag').contact).toBeUndefined();
  });

  it('does not take a nationality for a name', () => {
    expect(read('Ik ben Nederlands en zoek een gids').leadName).toBeUndefined();
    expect(read('Hoi, met Kees hier. Kan het zondag?').leadName).toBe('Kees');
  });

  it('picks the product by its name or its length', () => {
    const products = [
      { id: 'a', name: 'Klassiek Tbilisi in 2 uur', durationMin: 120 },
      { id: 'b', name: 'Sovjet-Tbilisi', durationMin: 180 },
    ];
    expect(parseDm('Wij willen de sovjet tour', today, products).productId).toBe('b');
    expect(parseDm('een tour van 2 uur graag', today, products).productId).toBe('a');
    expect(parseDm('een tour graag', today, products).productId).toBeUndefined();
  });
});
