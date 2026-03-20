const config = require('../config/Config.json');
const fs = require('fs/promises');
const {EventEmitter} = require('events');
const {interval, sendAndClear, blue} = require('./printer.js');

const eventer = new EventEmitter();

eventer.on('stopBot', async code => {
    try {
        clearInterval(interval);
        await sendAndClear();
    } catch (e) {
        console.error(e);
    }
    process.exit(code || 0);
});

async function prepare() {
    try {
        await Promise.all([
            fs.rm('pages', {recursive: true}),
            fs.rm('screenshots', {recursive: true})
        ]);
        
    } catch (error) {
        blue(error);
    }
    await Promise.all([
        fs.mkdir('pages', {recursive: true}),
        fs.mkdir('screenshots', {recursive: true})
    ]);
}

async function getText(page, selector) {
    await checkVisibility(page, selector, config.delays.selector);
    const element = await page.$(selector);
    return page.evaluate(element => element.textContent, element);
}

async function click(page, selector, options = {}) {
    const { timeout = config.delays.selector, force = false } = options;

    await page.waitForSelector(selector, { visible: true, timeout });

    // Najpierw próbujemy normalnie
    try {
        await page.click(selector, { delay: 50 });
        return;
    } catch (e) {
        yellow(`Normalny click(${selector}) nie zadziałał → próbuję force`);
    }

    // Force click przez evaluate
    await page.evaluate(sel => {
        const el = document.querySelector(sel);
        if (el) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            // ewentualnie: el.click();
        }
    }, selector);

    // Można jeszcze dodać hover przed kliknięciem (czasami pomaga)
    // await page.hover(selector);
}
/*
async function click(page, selector) {
    await checkVisibility(page, selector, config.delays.selector);
    return Promise.all([
        page.click(selector),
        page.waitForNavigation({waitUntil: 'networkidle0'})
    ]);
}
*/
async function clickWait(page, selector, wait_min = config.delays.click_min, wait_max = config.delays.click_max) {
    await checkVisibility(page, selector, config.delays.selector);
    await page.click(selector);
    return delay(getRandomInt(wait_min, wait_max));
}

async function type(page, selector, text, delay) {
    return page.type(selector, text, {delay: delay ?? getRandomInt(config.delays.type_min, config.delays.type_max)});
}

async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

async function savePage(page, i) {
    if (!page) return;
    return Promise.all([
        page.screenshot({path: `screenshots/answer-${i}.png`}),
        fs.writeFile(`pages/answer-${i}.html`, await page.evaluate(() => document.documentElement.innerHTML), 'utf-8')
    ]);
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

async function checkVisibility(page, selector, delay = 1000) {
    return page.waitForSelector(selector, {visible: true, timeout: delay});
}

async function isVisible(page, selector, delay) {
    return checkVisibility(page, selector, delay)
        .then(() => true)
        .catch(() => false);
}

function canLogin() {
    return config.login && config.password;
}

function useFeature() {
    return config.feature?.user && config.feature?.password;
}

module.exports = {
    prepare: prepare,
    getText: getText,
    click: click,
    clickWait: clickWait,
    type: type,
    delay: delay,
    getRandomInt: getRandomInt,
    isVisible: isVisible,
    canLogin: canLogin,
    useFeature: useFeature,
    savePage: savePage,
    eventer
};
