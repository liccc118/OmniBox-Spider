/**
 * ============================================================================
 * 在线之家 (ZXZJ)
 * https://www.zxzjhd.com
 * ============================================================================
 */
const axios = require("axios");
const cheerio = require("cheerio");
const OmniBox = require("omnibox_sdk");

// ========== 全局配置 ==========
const host = 'https://www.zxzjys.com'; 

// 基础 Headers (用于列表页等普通请求)
const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': host + '/',
    'Origin': host,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
};

const axiosInstance = axios.create({
    timeout: 15000,
    headers: baseHeaders,
    validateStatus: status => true 
});

const fixUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return url.startsWith('/') ? `${host}${url}` : `${host}/${url}`;
};

// ========== 解密算法 ==========
const DecryptTools = {
    decrypt: function(encryptedData) {
        try {
            // 1. 翻转字符串
            const reversed = encryptedData.split('').reverse().join('');
            // 2. Hex 转 String
            let hexDecoded = '';
            for (let i = 0; i < reversed.length; i += 2) {
                hexDecoded += String.fromCharCode(parseInt(reversed.substr(i, 2), 16));
            }
            // 3. 移除中间混淆字符 (7位)
            const len = hexDecoded.length;
            const splitLen = Math.floor((len - 7) / 2);
            return hexDecoded.substring(0, splitLen) + hexDecoded.substring(splitLen + 7);
        } catch (e) {
            return null;
        }
    }
};

// ========== 列表解析逻辑 ==========
const parseVideoList = ($) => {
    const list = [];
    const items = $('.stui-vodlist__item, .stui-vodlist li, .v-item, .public-list-box');
    items.each((_, element) => {
        const $item = $(element);
        const $link = $item.find('a.stui-vodlist__thumb, a.v-thumb, a.public-list-exp');
        if ($link.length === 0) return;
        
        const title = $link.attr('title') || $item.find('.title a').text().trim();
        const href = $link.attr('href');
        let pic = $link.attr('data-original') || $link.attr('data-src') || $link.attr('src');
        
        // 处理背景图样式
        if (!pic) {
            const style = $link.attr('style') || '';
            const match = style.match(/url\((['"]?)(.*?)\1\)/);
            if (match) pic = match[2];
        }
        
        const remarks = $item.find('.pic-text, .v-remarks, .public-list-prb').text().trim();
        
        if (title && href) {
            list.push({ 
                vod_id: href, 
                vod_name: title, 
                vod_pic: fixUrl(pic), 
                vod_remarks: remarks || '' 
            });
        }
    });
    return list;
};

// ========== 核心功能函数 ==========

async function home(params) {
    return {
        class: [
            { type_id: '1', type_name: '电影' },
            { type_id: '2', type_name: '美剧' },
            { type_id: '3', type_name: '韩剧' },
            { type_id: '4', type_name: '日剧' },
            { type_id: '5', type_name: '泰剧' },
            { type_id: '6', type_name: '动漫' }
        ],
        list: []
    };
}

async function category(params) {
    const { categoryId, page } = params;
    const pg = parseInt(page) || 1;
    try {
        const url = `${host}/vodshow/${categoryId}--------${pg}---.html`;
        const res = await axiosInstance.get(url);
        const $ = cheerio.load(res.data);
        const list = parseVideoList($);
        return { list: list, page: pg, pagecount: list.length >= 20 ? pg + 1 : pg };
    } catch (e) {
        return { list: [], page: pg, pagecount: 0 };
    }
}

async function search(params) {
    const wd = params.keyword || params.wd || "";
    const pg = parseInt(params.page) || 1;
    try {
        const url = `${host}/vodsearch/${encodeURIComponent(wd)}----------${pg}---.html`;
        const res = await axiosInstance.get(url);
        const $ = cheerio.load(res.data);
        const list = parseVideoList($);
        return { list: list, page: pg, pagecount: list.length >= 20 ? pg + 1 : pg };
    } catch (e) {
        return { list: [], page: pg, pagecount: 0 };
    }
}

async function detail(params) {
    const videoId = params.videoId;
    const url = fixUrl(videoId);
    try {
        const res = await axiosInstance.get(url);
        const html = res.data;
        const $ = cheerio.load(html);
        
        // 兼容多种详情页布局
        const title = $('h1.title').text().trim() || $('.stui-content__detail .title').text().trim() || $('title').text().split('-')[0].trim();
        const pic = $('.stui-content__thumb img').attr('data-original') || $('.stui-content__thumb img').attr('src') || '';
        const desc = $('.stui-content__detail .desc').text().trim() || $('meta[name="description"]').attr('content') || '';
        
        const playSources = [];
        const $playlists = $('.stui-content__playlist, .stui-pannel__data ul, .playlist');
        
        $playlists.each((index, listElem) => {
            let sourceName = "默认线路";
            const $prevHead = $(listElem).prev('.stui-vodlist__head, .stui-pannel__head');
            if ($prevHead.length > 0) sourceName = $prevHead.find('h3').text().trim();
            
            const episodes = [];
            $(listElem).find('li a').each((_, a) => {
                const $a = $(a);
                episodes.push({ name: $a.text().trim(), playId: $a.attr('href') });
            });
            
            if (episodes.length > 0) {
                playSources.push({ name: sourceName, episodes: episodes });
            }
        });

        return {
            list: [{
                vod_id: videoId,
                vod_name: title,
                vod_pic: fixUrl(pic),
                vod_content: desc,
                vod_play_sources: playSources
            }]
        };
    } catch (e) {
        return { list: [] };
    }
}

// ========== 播放解析 (核心) ==========
async function play(params) {
    const playId = params.playId;
    const playPageUrl = fixUrl(playId);

    try {
        // 1. 请求播放页
        const res = await axiosInstance.get(playPageUrl);
        const html = res.data;

        // 2. 提取中间页 URL
        const urlMatch = html.match(/"url"\s*:\s*"(https:[^"]*?jx\.zxzjys\.com[^"]*?)"/);
        
        if (urlMatch && urlMatch[1]) {
            const targetUrl = urlMatch[1].replace(/\\/g, '');
            
            // 3. 构造严格匹配的 Headers (关键!)
            const sniffHeaders = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Referer": "https://www.zxzjys.com/", // 必须是首页
                "Sec-Fetch-Dest": "iframe",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "same-site", // 必须是 same-site
                "Upgrade-Insecure-Requests": "1"
            };

            // 4. 请求中间页获取源码
            try {
                const iframeRes = await axiosInstance.get(targetUrl, { headers: sniffHeaders });
                const iframeHtml = iframeRes.data;
                
                // 5. 提取 result_v2 并解密
                const v2Match = iframeHtml.match(/var\s+result_v2\s*=\s*(\{[\s\S]*?\});/);
                if (v2Match && v2Match[1]) {
                    const v2Json = JSON.parse(v2Match[1]);
                    const encryptedData = v2Json.data || v2Json.url;
                    
                    if (encryptedData) {
                        const decrypted = DecryptTools.decrypt(encryptedData);
                        if (decrypted && decrypted.startsWith("http")) {
                            return {
                                urls: [{ name: "极速直连", url: decrypted }],
                                parse: 0,
                                header: sniffHeaders
                            };
                        }
                    }
                }
            } catch (innerErr) {
                // 忽略内部错误，走兜底
            }

            // 6. 兜底方案：智能嗅探
            const sniffRes = await OmniBox.sniffVideo(targetUrl, sniffHeaders);
            if (sniffRes && sniffRes.url) {
                return {
                    urls: [{ name: "嗅探线路", url: sniffRes.url }],
                    parse: 0,
                    header: sniffRes.header || sniffHeaders
                };
            }
        }

    } catch (e) {
        OmniBox.log("error", `Play Error: ${e.message}`);
    }

    // 7. 最后的失败回退
    return {
        urls: [{ name: "解析失败", url: playPageUrl }],
        parse: 1,
        header: baseHeaders
    };
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);