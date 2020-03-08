const puppeteer = require('puppeteer');

const BASE_URL = 'https://www.musicasdonordeste.net/search?max-results=20';
const SEARCH_URL = (searchTerm) => `https://www.musicasdonordeste.net/search?q=${searchTerm}`;

let browser = null;
let page = null;

const scrap = {
  initialize: async (searchTerm) => {
    browser = await puppeteer.launch({
      // ignoreHTTPSErrors: true, // pra erro de certificados
      // headless: false,
      devtools: false,
      defaultViewport: { width: 1500, height: 960 },
    });
    page = await browser.newPage();

    await page.setRequestInterception(true);

    page.on('request', (request) => {
      if (request.resourceType() !== 'document') {
        request.abort();
      } else {
        request.continue();
      }
    });

    if (typeof searchTerm === 'string') {
      await page.goto(SEARCH_URL(searchTerm));
    } else {
      await page.goto(BASE_URL);
    }
  },

  getCDsURL: async (url) => {
    if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
    return page.evaluate(() => {
      const cds = document.querySelectorAll('div[class="post-outer-container"]');
      const urls = [];
      cds.forEach((cd) => {
        urls.push(cd.querySelector('.post-title > a').getAttribute('href'));
      });

      return urls;
    });
  },

  getNextPage: () => page.evaluate(() => {
    const nextPage = document.querySelector('.blog-pager-older-link');
    return nextPage ? nextPage.getAttribute('href') : false;
  }),

  getDetailsCD: async (url) => {
    if (url) await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.stop());

    return page.evaluate((pageUrl) => {
      const title = document.querySelector('.post-title').innerText.replace('+SCANS', '').trim();
      const imgUrl = document.querySelector('.post-body-container .separator > a').getAttribute('href');
      const spans = document.querySelectorAll('.post-body-container span');
      let description = null;
      let tracks = '';
      const dLinks = {};

      let isFaixas = false;
      spans.forEach((span) => {
        const text = span.innerText;
        if (text !== '\n') {
          if (!description) description = text;
          if (text === 'Baixar:') isFaixas = false;
          if (isFaixas) tracks += `${text}\n`;
          if (text === 'Faixas:') isFaixas = true;

          if (Object.keys(dLinks).length === 0) {
            const links = span.querySelectorAll('a');
            if (links) {
              links.forEach((link) => {
                dLinks[link.innerText] = link.getAttribute('href');
              });
            }
          }
        }
      });


      return {
        title, cover: imgUrl, description, tracks: tracks.trim(), dLinks, pageUrl,
      };
    }, url);
  },

  end: async () => {
    await browser.close();
  },

};

module.exports = scrap;
