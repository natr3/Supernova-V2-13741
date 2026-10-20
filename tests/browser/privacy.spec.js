import {test,expect} from '@playwright/test';

async function stubLibrary(page,settings={}) {
  await page.route('**/api/library', route=>route.fulfill({json:{entries:[],favorites:[],profile:{notes:'',settings}}}));
}
test('cloaking survives page navigation and the cover is reversible without redirecting',async({page})=>{
  await stubLibrary(page);
  await page.goto('/#games');
  await page.getByRole('button',{name:'Tab cloaking',exact:true}).click();
  await page.getByLabel('Preset',{exact:true}).selectOption('classroom');
  await page.getByRole('button',{name:'Apply cloaking'}).click();
  await expect(page).toHaveTitle('Home – Classroom');
  await page.getByRole('link',{name:'Apps & social'}).click();
  await expect(page).toHaveTitle('Home – Classroom');
  await page.getByRole('searchbox',{name:'Search apps…'}).fill('youtube');
  await page.keyboard.press('u');
  await expect(page.locator('#privacy-cover')).not.toBeVisible();
  await page.getByRole('heading',{name:'Apps & social',exact:true}).click();
  await page.keyboard.press('u');
  await expect(page.getByRole('heading',{name:'This website is blocked.'})).toBeVisible();
  await expect(page).toHaveTitle('Website blocked');
  await page.keyboard.press('u');
  await expect(page.locator('#privacy-cover')).not.toBeVisible();
  await expect(page).toHaveTitle('Home – Classroom');
  await page.getByRole('button',{name:'Show blocked-page cover',exact:true}).click();
  await page.getByRole('button',{name:'Return to natr',exact:true}).click();
  await expect(page).toHaveURL(/#apps$/);
});

test('apps stay in natr and accept official public video players',async({page})=>{
  await stubLibrary(page);
  await page.route('https://www.youtube-nocookie.com/**',route=>route.fulfill({body:'<html><body>Video embed</body></html>',contentType:'text/html'}));
  await page.goto('/apps.html');
  const pages = page.context().pages().length;
  await page.locator('.card').filter({has:page.getByRole('heading',{name:'YouTube',exact:true})}).getByRole('button',{name:'Open app',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Stay in natr.'})).toBeVisible();
  await page.getByLabel('Try a public video, post, track, or channel link').fill('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  await page.getByRole('button',{name:'Load player',exact:true}).click();
  await expect(page.locator('#player-screen iframe')).toHaveAttribute('src','https://www.youtube-nocookie.com/embed/jfKfPfyJRdk');
  expect(page.context().pages().length).toBe(pages);
  await expect(page).toHaveURL(/apps.html$/);
  await page.getByRole('button',{name:'Show privacy cover',exact:true}).click();
  await expect(page.locator('#player-screen iframe')).toHaveCount(0);
  await page.getByRole('button',{name:'Return to natr'}).click();
  await expect(page.locator('#player-screen iframe')).toHaveCount(1);
});

test('4K background preview preserves dimensions and saving requires an account',async({page})=>{
  await stubLibrary(page);
  await page.goto('/#settings');
  const data = await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=2160;
    canvas.getContext('2d').fillRect(0,0,3840,2160);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Upload background',{exact:true}).setInputFiles({name:'wallpaper-4k.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await expect(page.locator('#background-dimensions')).toContainText('3840 × 2160 · 4K-ready');
  await expect(page.locator('body')).toHaveAttribute('data-background','custom');
  await expect(page.locator('#custom-background')).toHaveCSS('background-image',/blob:/);
  await page.getByRole('button',{name:'Save background',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Remove image',exact:true}).click();
  await expect(page.locator('body')).toHaveAttribute('data-background','stars');
  await page.setViewportSize({width:3840,height:2160});
  await page.getByLabel('Background',{exact:true}).selectOption('aurora');
  await page.screenshot({path:'/tmp/natr-settings-4k.png'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
});

test('saved startup cover and privacy shortcut preferences are restored',async({page})=>{
  await stubLibrary(page,{startupCover:true,panicEnabled:true,panicKey:'p'});
  await page.goto('/#games');
  await expect(page.getByRole('heading',{name:'This website is blocked.'})).toBeVisible();
  await expect(page.locator('#cover-shortcut')).toContainText('Press P');
  await page.keyboard.press('p');
  await expect(page.locator('#privacy-cover')).not.toBeVisible();
});

test('real soundboard stays embedded and mute unloads its audio source',async({page})=>{
  await stubLibrary(page);
  await page.route('https://soundbuttonsworld.com/**',route=>route.fulfill({body:'<html><body><button>Vine Boom</button></body></html>',contentType:'text/html'}));
  await page.goto('/#soundboard');
  await expect(page.frameLocator('#real-soundboard').getByRole('button',{name:'Vine Boom'})).toBeVisible();
  await page.frameLocator('#real-soundboard').getByRole('button',{name:'Vine Boom'}).click();
  await expect(page).toHaveURL(/#soundboard$/);
  await page.getByRole('button',{name:'Mute soundboard',exact:true}).click();
  await expect(page.locator('#real-soundboard')).toHaveAttribute('src','about:blank');
  await expect(page.getByRole('heading',{name:'Soundboard muted.'})).toBeVisible();
  await page.getByRole('button',{name:'Unmute soundboard',exact:true}).click();
  await expect(page.locator('#real-soundboard')).toHaveAttribute('src','https://soundbuttonsworld.com/trends?page=1');
});
