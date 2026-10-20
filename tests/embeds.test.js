import { test } from 'node:test';
import assert from 'node:assert/strict';
import {publicEmbed,embedPlan} from '../lib/embeds.js';

test('official players support video, social posts, tracks, and live channels',()=>{
  assert.equal(publicEmbed('https://youtu.be/jfKfPfyJRdk'),'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk');
  assert.equal(publicEmbed('https://www.youtube.com/shorts/jfKfPfyJRdk'),'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk');
  assert.equal(publicEmbed('https://www.tiktok.com/@example/video/1234567890123456789'),'https://www.tiktok.com/player/v1/1234567890123456789');
  assert.equal(publicEmbed('https://www.instagram.com/p/Example123/'),'https://www.instagram.com/p/Example123/embed/');
  assert.equal(publicEmbed('https://open.spotify.com/track/Example123'),'https://open.spotify.com/embed/track/Example123');
  assert.equal(publicEmbed('https://www.twitch.tv/example','natr.example'),'https://player.twitch.tv/?channel=example&parent=natr.example&autoplay=false');
});
test('player URLs never accept executable schemes or lookalike domains',()=>{
  for(const value of ['javascript:alert(1)','https://youtube.com.evil.example/watch?v=jfKfPfyJRdk','https://example.com','http://youtube.com/watch?v=jfKfPfyJRdk']) assert.equal(publicEmbed(value),null);
  assert.equal(embedPlan({title:'YouTube',kind:'app',url:'https://www.youtube.com/'}).blocked,true);
  assert.equal(embedPlan({title:'Game',kind:'game',url:'http://example.com/'}).blocked,true);
});
