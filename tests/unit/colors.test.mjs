import test from 'node:test';
import assert from 'node:assert/strict';
import { RedactionDocument } from '../../src/core/document.js';
test('Only fully opaque six-digit colors; recolor is undoable', () => {
 const doc = new RedactionDocument(100,100);
 for (const color of ['transparent','#1234','#11223300','rgba(0,0,0,.2)','red']) assert.throws(() => doc.add({x:0,y:0,width:10,height:10},color));
 doc.add({x:0,y:0,width:10,height:10},'#abcdef');
 const id=doc.regions[0].id; doc.recolor(id,'#123456'); assert.equal(doc.regions[0].color,'#123456');
 doc.undo(); assert.equal(doc.regions[0].color,'#abcdef');
 doc.redo(); assert.equal(doc.regions[0].color,'#123456');
 assert.throws(() => doc.recolor(id,'transparent'));
});
