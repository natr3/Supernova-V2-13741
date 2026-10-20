import { test, expect } from '@playwright/test';

test('shared games survive reload, search works, and private saves require sign-in', async ({page}) => {
  const entries = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/library', async route => {
    const req = route.request();
    if (req.method() === 'GET') return route.fulfill({ json:{ entries, favorites:[],profile:null } });
    if (req.method() === 'POST') {
      const data = req.postDataJSON();
      const entry = { ...data, id:1, canDelete:false };
      entries.push(entry);
      return route.fulfill({ status:201,json:entry });
    }
    return route.fulfill({ status:401,json:{error:'Sign in required.'} });
  });
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/TUESDAY|MONDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY/})).toBeVisible();
  await page.getByRole('button',{name:'Add game',exact:true}).click();
  await page.getByLabel('Game or website link').fill('https://example.com/arcade');
  await page.getByLabel('Name (optional)').fill('Orbit test');
  await page.getByRole('button',{name:'Add game',exact:true}).last().click();
  await expect(page.getByRole('dialog',{name:''})).not.toBeVisible();
  await page.getByRole('link',{name:'Games',exact:true}).click();
  await page.getByRole('searchbox',{name:'Search games…'}).fill('Orbit');
  await expect(page.getByRole('heading',{name:'Orbit test'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading',{name:'Orbit test'})).toBeVisible();
  await page.getByRole('button',{name:'Add game',exact:true}).click();
  await page.getByLabel('Game or website link').fill('https://example.com/private');
  await page.getByLabel(/My private library/).check();
  await page.getByRole('button',{name:'Add game',exact:true}).last().click();
  await expect(page.getByRole('alert')).toContainText('Sign in');
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Favorite 2048',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  expect(errors).toEqual([]);
});

test('social apps, screenshot titles, soundboard, preferences, and mobile layout',async ({page}) => {
  await page.route('**/api/library', route => route.fulfill({json:{entries:[],favorites:[],profile:null}}));
  await page.goto('/apps.html');
  await expect(page.getByRole('heading',{name:'TikTok',exact:true})).toBeVisible();
  await expect(page.locator('button.play-button').first()).toHaveAttribute('data-play','app:tiktok');
  await page.getByRole('searchbox',{name:'Search apps…'}).fill('Instagram');
  await expect(page.locator('#catalog-grid .card')).toHaveCount(1);
  await page.getByRole('link',{name:'Media',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Adventure Time',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Gumball (Season 4)',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Manga',exact:true}).click();
  await expect(page.getByRole('heading',{name:'MANGA Plus'})).toBeVisible();
  await page.getByRole('link',{name:'Settings',exact:true}).click();
  await page.getByLabel('Background',{exact:true}).selectOption('waves');
  await expect(page.locator('body')).toHaveAttribute('data-background','waves');
  await page.getByLabel('Moving backgrounds',{exact:true}).uncheck();
  await expect(page.locator('body')).toHaveAttribute('data-motion','off');
  await page.goto('/#soundboard');
  await expect(page.locator('#real-soundboard')).toHaveAttribute('src','https://soundbuttonsworld.com/trends?page=1');
  await page.getByRole('button',{name:'Synth lab & speech',exact:true}).click();
  await expect(page.getByRole('button',{name:'Play Vine-style boom',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Play Coin pickup',exact:true}).click();
  await page.getByRole('button',{name:'Stop all sounds',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#games');
  await expect(page.getByRole('heading',{name:'Games',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({path:'/tmp/natr-mobile.png',fullPage:true});
  await page.setViewportSize({width:1366,height:900});
  await page.goto('/#home');
  await page.screenshot({path:'/tmp/natr-desktop.png',fullPage:true});
});

test('player supports close and restore; notes explain account requirement',async ({page}) => {
  await page.route('**/api/library', route => route.fulfill({json:{entries:[],favorites:[],profile:null}}));
  await page.goto('/#games');
  await page.locator('.card').filter({has:page.getByRole('heading',{name:'2048',exact:true})}).getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.getByRole('dialog',{name:'In-app player'})).toBeVisible();
  await page.getByRole('button',{name:'Minimize app'}).click();
  await page.getByRole('button',{name:'Return to app'}).click();
  await expect(page.getByRole('dialog',{name:'In-app player'})).toBeVisible();
  await page.getByRole('button',{name:'Close app',exact:true}).click();
  await expect(page.locator('#player-screen iframe')).toHaveCount(0);
  await page.getByRole('link',{name:'Notes',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save notes'})).toBeDisabled();
  await expect(page.getByText('Sign in to save your notes privately and sync them across devices.')).toBeVisible();
});

test('calculator, timer, drawing, and navigation terminal work', async ({page}) => {
  await page.route('**/api/library', route => route.fulfill({json:{entries:[],favorites:[],profile:null}}));
  await page.goto('/#calculator');
  await page.getByRole('button',{name:'7',exact:true}).click();
  await page.getByRole('button',{name:'+',exact:true}).click();
  await page.getByRole('button',{name:'3',exact:true}).click();
  await page.getByRole('button',{name:'=',exact:true}).click();
  await expect(page.locator('#calc-output')).toHaveText('10');
  await page.getByRole('link',{name:'Tools',exact:true}).click();
  await page.getByRole('link',{name:/Focus timer/}).click();
  await page.getByLabel('Minutes',{exact:true}).fill('2');
  await expect(page.locator('#timer-display')).toHaveText('02:00');
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(page.getByLabel('Minutes',{exact:true})).toHaveValue('2');
  await page.getByRole('link',{name:'Tools',exact:true}).click();
  await page.getByRole('link',{name:/Pixel canvas/}).click();
  await expect(page.locator('#paint-canvas')).toBeVisible();
  const box = await page.locator('#paint-canvas').boundingBox();
  await page.mouse.move(box.x+30,box.y+30); await page.mouse.down(); await page.mouse.move(box.x+80,box.y+80); await page.mouse.up();
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Download PNG',exact:true}).click();
  expect((await download).suggestedFilename()).toBe('natr-drawing.png');
  await page.getByRole('link',{name:'Command line',exact:true}).click();
  await page.getByRole('textbox',{name:'Command',exact:true}).fill('background waves');
  await page.getByRole('button',{name:'Run command'}).click();
  await expect(page.locator('body')).toHaveAttribute('data-background','waves');
  await expect(page.locator('#terminal-output')).toContainText('Background: waves');
});
