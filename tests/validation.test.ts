import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, validateUrl, validateSettings } from '../lib/validation.js';

test('accepts and normalizes a public game URL', () => {
  assert.equal(validateUrl(' https://example.com/game?mode=easy '), 'https://example.com/game?mode=easy');
});
test('rejects executable protocols, embedded credentials, and local addresses', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,game', 'ftp://example.com', 'https://a:b@example.com', 'http://localhost:3000', 'http://192.168.1.1/game', 'http://10.0.0.1/', 'http://127.0.0.1/', 'not a url']) assert.throws(() => validateUrl(url));
});
test('shared entries work without an account and derive a name from the host', () => {
  const entry = validateEntry({ url:'https://www.example.com/game',visibility:'public' });
  assert.equal(entry.title, 'example.com'); assert.equal(entry.ownerId,null); assert.equal(entry.visibility,'public');
});
test('private entries require authentication and ignore caller-supplied ownership', () => {
  assert.throws(() => validateEntry({ url:'https://example.com',visibility:'private' }));
  const entry = validateEntry({ url:'https://example.com',visibility:'private',ownerId:'someone-else' }, 'verified-user');
  assert.equal(entry.ownerId,'verified-user'); assert.equal(entry.visibility,'private');
});
test('validates title limits and settings ranges', () => {
  assert.throws(() => validateEntry({ url:'https://example.com',title:'a'.repeat(81) }));
  assert.throws(() => validateSettings({background:'anything',motion:true,volume:1}));
  assert.throws(() => validateSettings({background:'stars',motion:true,volume:2}));
  assert.throws(() => validateSettings({background:'stars',motion:true,volume:NaN}));
  assert.deepEqual(validateSettings({background:'waves',motion:false,volume:.4}),{background:'waves',motion:false,volume:.4});
});

test('privacy and full-resolution background preferences are validated',()=>{
  const base={background:'custom',motion:true,volume:.8};
  const key='01234567-0123-0123-0123-0123456789ab.png';
  const valid=validateSettings({...base,backgroundImage:{key,width:3840,height:2160},cloakTitle:'Class notes',cloakIcon:'notes',cloakEnabled:true,panicKey:'U',startupCover:true});
  assert.equal(valid.panicKey,'u');
  assert.equal(valid.backgroundImage?.width,3840);
  assert.throws(()=>validateSettings({...base,backgroundImage:{key:'../../private.png',width:10,height:10}}));
  assert.throws(()=>validateSettings({...base,backgroundImage:{key,width:100000,height:100000}}));
  assert.throws(()=>validateSettings({...base,cloakTitle:''}));
  assert.throws(()=>validateSettings({...base,panicKey:'Escape'}));
  assert.throws(()=>validateSettings({...base,cloakEnabled:'true'}));
});
