const { writeFileSync } = require('fs');
const cliProgress = require('cli-progress');
const scrap = require('./scrap');

const timerName = 'Tempo decorrido';
const search = process.argv[2];

async function formatTitle(details) {
  const toRemove = '#MOMENTOMPB | ';
  const res = details;
  let { title } = res;

  if (title.includes(toRemove)) title = title.replace(toRemove, '');
  const yearRgx = /[([]\d{4}[)\]]/;
  const found = title.match(yearRgx) || '';
  const [year] = found;
  if (year) {
    title = title.replace(year, '').trim();
    res.year = year.replace(/[()[\]]/g, '');
  }

  const split = title.indexOf('-');
  if (split) {
    res.artist = title.substring(0, split).trim();
    res.title = title.substring(split + 1, title.length).trim();
  }

  return res;
}

async function getUrls() {
  const urls = [];
  let nextPage = null;

  do {
    const newUrls = await scrap.getCDsURL();
    urls.push(...newUrls);

    nextPage = await scrap.getNextPage();
    if (nextPage) await scrap.getCDsURL(nextPage);
  } while (nextPage);
  return urls;
}

async function getDetails(urls) {
  const allDetails = [];
  const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  bar.start(100, 0);
  bar.update(0);

  for (const [i, url] of urls.entries()) {
    try {
      let aux = await scrap.getDetailsCD(url);
      aux = await formatTitle(aux);
      allDetails.push(aux);
    } catch (error) {
      allDetails.push({ url, error });
    }

    bar.update((i + 1) * (100 / urls.length).toFixed(2));
  }

  bar.stop();
  return allDetails;
}

async function printToFile(cds) {
  let toPrint = '';

  for (const cd of cds) {
    let aux = '';
    if (cd.title) aux += `Título: ${cd.title}\n`;
    if (cd.artist) aux += `Artista: ${cd.artist}\n`;
    if (cd.year) aux += `Ano: ${cd.year}\n`;
    if (cd.description && cd.description.charAt(cd.description.length) !== ':') aux += `Descrição: ${cd.description}\n`;
    if (cd.tracks) aux += `Faixas:\n${cd.tracks}\n`;
    if (cd.cover) aux += `Capa: ${cd.cover}\n`;
    if (cd.pageUrl) aux += `Página: ${cd.cover}\n`;
    if (cd.dLinks && Object.keys(cd.dLinks) && Object.keys(cd.dLinks).length > 0) {
      aux += 'Download:\n';
      Object.keys(cd.dLinks).forEach((key) => {
        aux += `  ${key}: ${cd.dLinks[key]}\n`;
      });
    }

    toPrint += `${aux}\n\n`;
  }

  const fileName = `musicasdonordeste - ${search || 'tudo'}.txt`;
  const res = writeFileSync(fileName, toPrint);
  if (!res) {
    console.log(`Processo encerrado, arquivo '${fileName}' criado!`);
    console.timeEnd(timerName);
  }
}

(async () => {
  console.time(timerName);
  await scrap.initialize(search);
  const urls = await getUrls();
  if (urls && urls.length > 0) {
    console.log(`Encontrei ${urls.length} álbum(s) para a sua pesquisa.`);
    console.log('Salvando detalhes...');
    const allDetails = await getDetails(urls);
    await scrap.end();
    await printToFile(allDetails);
  }
})();
