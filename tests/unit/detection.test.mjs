import test from 'node:test';
import assert from 'node:assert/strict';
import { findSensitiveSpans } from '../../src/detection/patterns.js';
import { suggestFromBlocks } from '../../src/detection/suggestions.js';
import { RedactionDocument } from '../../src/core/document.js';

test('recognizes emails, Malaysian phones, structured IDs, cards and IPs', () => {
  const cases = [
    ['Email alex.lee@example.com', 'Email'], ['alex.lee @ example.com', 'Email'],
    ['Call +60 12-345 6789', 'Phone number'], ['Phone (03) 1234 5678', 'Phone number'],
    ['IC: 990101-14-1234', 'ID number'], ['Card: 4111 1111 1111 1111', 'Payment card'],
    ['Server 192.168.1.100', 'IP address'], ['Full name: Alex Lee', 'Labeled name'],
    ['Billing address: 12 Example Street', 'Labeled address'],
  ];
  for (const [text, expected] of cases) assert.ok(findSensitiveSpans(text).some(span => span.kind === expected), text);
});
test('recognizes IC, passport, bank account, password and secret key details', () => {
  const cases = [
    ['IC 990101141234', 'ID number'], ['NRIC No. 880512-10-5678', 'ID number'], ['ID Number: X1234567', 'ID number'],
    ['Passport No: A12345678', 'Passport number'], ['Passport: 123456789', 'Passport number'], ['Travel doc A12345678', 'Passport number'],
    ['Account No. 1234567890', 'Bank account'], ['A/C No: 5140-1234-5678', 'Bank account'],
    ['Bank account: 7612345678', 'Bank account'], ['IBAN GB82 WEST 1234 5698 7654 32', 'Bank account'],
    ['Password: hunter2!', 'Password or key'], ['PIN: 4821', 'Password or key'], ['OTP: 552190', 'Password or key'],
    ['API key: abc123def456', 'Password or key'], ['key sk-proj-abcdefghijklmnopqrstuvwx', 'Password or key'],
    ['ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'Password or key'], ['AKIAABCDEFGHIJKLMNOP', 'Password or key'],
  ];
  for (const [text, expected] of cases) {
    const found = findSensitiveSpans(text);
    assert.ok(found.some(span => span.kind === expected), `${text} -> ${JSON.stringify(found)}`);
  }
  const [password] = findSensitiveSpans('Password: hunter2!');
  assert.equal('Password: hunter2!'.slice(password.start, password.end), 'hunter2!');
});
test('new labels avoid ordinary words', () => {
  for (const text of ['Pin this tab', 'Open your account settings', 'Order ID 123', 'Token economy']) {
    assert.deepEqual(findSensitiveSpans(text), [], text);
  }
  assert.ok(!findSensitiveSpans('IC 991399141234').some(span => span.kind === 'ID number'));
  assert.ok(!findSensitiveSpans('GB82 WEST 1234 5698 7654 33').some(span => span.kind === 'Bank account'));
});
test('label on its own line marks the next line with the matching kind', () => {
  const word = (text, x0, y0) => ({ text, bbox: { x0, x1: x0 + 60, y0, y1: y0 + 10 } });
  const blocks = [{ paragraphs: [{ lines: [{ words: [word('Password', 0, 0)] }, { words: [word('hunter2!', 0, 14)] }] }] }];
  assert.deepEqual(suggestFromBlocks(blocks, 400, 200).map(item => item.kind), ['Password or key']);
});
test('avoids treating dates, invalid IPs and ordinary names as reliable detections', () => {
  assert.deepEqual(findSensitiveSpans('Today 2026-10-15'), []);
  assert.deepEqual(findSensitiveSpans('Date 15-10-2026'), []);
  assert.deepEqual(findSensitiveSpans('Alex Lee'), []);
  assert.ok(!findSensitiveSpans('999.999.999.999').some(span => span.kind === 'IP address'));
  assert.ok(!findSensitiveSpans('4111 1111 1111 1112').some(span => span.kind === 'Payment card'));
});
test('labeled values exclude their label in the detected text span', () => {
  const text = 'Full name: Alex Lee';
  const [span] = findSensitiveSpans(text);
  assert.equal(text.slice(span.start, span.end), 'Alex Lee');
});
test('OCR word spans map to outward-rounded native pixels without returning private text', () => {
  const blocks = [{ paragraphs: [{ lines: [{ words: [
    { text: 'Email:', bbox: { x0: 0, x1: 30, y0: 10, y1: 20 } },
    { text: 'alex@example.com', bbox: { x0: 35, x1: 130, y0: 10, y1: 20 } },
  ] }] }] }];
  const found = suggestFromBlocks(blocks, 400, 200, 0.5);
  assert.deepEqual(found, [{ x: 62, y: 12, width: 206, height: 36, kind: 'Email' }]);
  assert.ok(!JSON.stringify(found).includes('alex'));
  assert.deepEqual(suggestFromBlocks(null, 100, 100), []);
  assert.throws(() => suggestFromBlocks(blocks, 100, 100, 0));
});
test('suggestion batch is one undo step and overflow fails atomically', () => {
  const doc = new RedactionDocument(100, 100);
  const rect = { x: 0, y: 0, width: 20, height: 10 };
  doc.addMany([rect, { ...rect, y: 20 }], '#111827');
  assert.equal(doc.regions.length, 2); doc.undo(); assert.equal(doc.regions.length, 0);
  doc.redo(); assert.equal(doc.regions.length, 2);
  assert.throws(() => doc.addMany(Array(250).fill(rect), '#111827'));
  assert.equal(doc.regions.length, 2);
});
