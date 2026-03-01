/**
 * ============================================================================
 * 123TV资源 - OmniBox 爬虫脚本 (T3→T4转换版)
 * ============================================================================
 */
const axios = require("axios");
const https = require("https");
const OmniBox = require("omnibox_sdk");

// ========== 全局配置 ==========
const host = 'https://a123tv.com';
const def_headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': '*/*'
};

const axiosInstance = axios.create({
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    timeout: 15000
});

/**
 * 日志工具函数
 */
const logInfo = (message, data = null) => {
    const output = data ? `${message}: ${JSON.stringify(data)}` : message;
    OmniBox.log("info", `[123TV-DEBUG] ${output}`);
};

const logError = (message, error) => {
    OmniBox.log("error", `[123TV-DEBUG] ${message}: ${error.message || error}`);
};

/**
 * 图像地址修复
 */
const fixPicUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return url.startsWith('//') ? `https:${url}` : `https://${url}`;
};

/**
 * 核心:解析 CMS 字符串为结构化播放源 [1]
 * T3格式转T4格式的关键函数
 */
const parsePlaySources = (fromStr, urlStr) => {
    logInfo("开始解析播放源字符串", { from: fromStr, url: urlStr });
    const playSources = [];
    if (!fromStr || !urlStr) return playSources;

    const froms = fromStr.split('$$$');
    const urls = urlStr.split('$$$');

    for (let i = 0; i < froms.length; i++) {
        const sourceName = froms[i] || `线路${i + 1}`;
        const sourceItems = urls[i] ? urls[i].split('#') : [];

        const episodes = sourceItems.map(item => {
            const parts = item.split('$');
            return {
                name: parts[0] || '正片',
                playId: parts[1] || parts[0]
            };
        }).filter(e => e.playId);

        if (episodes.length > 0) {
            playSources.push({
                name: sourceName,
                episodes: episodes
            });
        }
    }
    logInfo("播放源解析结果", playSources);
    return playSources;
};

/**
 * 首页接口 [2]
 */
async function home(params) {
    logInfo("进入首页");
    return {
        class: [
            { 'type_id': '10', 'type_name': '电影' },
            { 'type_id': '11', 'type_name': '连续剧' },
            { 'type_id': '12', 'type_name': '综艺' },
            { 'type_id': '13', 'type_name': '动漫' },
            // { 'type_id': '15', 'type_name': '福利' }
        ],
        filters: {
            '10': [{"key": "class", "name": "类型", "value": [
                {"n": "全部", "v": ""}, {"n": "动作片", "v": "1001"}, {"n": "喜剧片", "v": "1002"},
                {"n": "爱情片", "v": "1003"}, {"n": "科幻片", "v": "1004"}, {"n": "恐怖片", "v": "1005"},
                {"n": "剧情片", "v": "1006"}, {"n": "战争片", "v": "1007"}, {"n": "纪录片", "v": "1008"},
                {"n": "动漫电影", "v": "1010"}, {"n": "奇幻片", "v": "1011"}, {"n": "动画片", "v": "1013"},
                {"n": "犯罪片", "v": "1014"}, {"n": "悬疑片", "v": "1016"}, {"n": "邵氏电影", "v": "1019"},
                {"n": "歌舞片", "v": "1022"}, {"n": "家庭片", "v": "1024"}, {"n": "古装片", "v": "1025"},
                {"n": "历史片", "v": "1026"}, {"n": "4K电影", "v": "1027"}
            ]}],
            '11': [{"key": "class", "name": "地区", "value": [
                {"n": "全部", "v": ""}, {"n": "国产剧", "v": "1101"}, {"n": "香港剧", "v": "1102"},
                {"n": "台湾剧", "v": "1105"}, {"n": "韩国剧", "v": "1103"}, {"n": "欧美剧", "v": "1104"},
                {"n": "日本剧", "v": "1106"}, {"n": "泰国剧", "v": "1108"}, {"n": "港台剧", "v": "1110"},
                {"n": "日韩剧", "v": "1111"}, {"n": "海外剧", "v": "1107"}
            ]}],
            '12': [{"key": "class", "name": "类型", "value": [
                {"n": "全部", "v": ""}, {"n": "内地综艺", "v": "1201"}, {"n": "港台综艺", "v": "1202"},
                {"n": "日韩综艺", "v": "1203"}, {"n": "欧美综艺", "v": "1204"}, {"n": "国外综艺", "v": "1205"}
            ]}],
            '13': [{"key": "class", "name": "类型", "value": [
                {"n": "全部", "v": ""}, {"n": "国产动漫", "v": "1301"}, {"n": "日韩动漫", "v": "1302"},
                {"n": "欧美动漫", "v": "1303"}, {"n": "海外动漫", "v": "1305"}, {"n": "里番", "v": "1307"}
            ]}],
            '15': [{"key": "class", "name": "分类", "value": [
                {"n": "全部", "v": ""}, {"n": "韩国情色片", "v": "1551"}, {"n": "日本情色片", "v": "1552"},
                {"n": "大陆情色片", "v": "1555"}, {"n": "香港情色片", "v": "1553"}, {"n": "台湾情色片", "v": "1554"},
                {"n": "美国情色片", "v": "1556"}, {"n": "欧洲情色片", "v": "1557"}, {"n": "印度情色片", "v": "1558"},
                {"n": "东南亚情色片", "v": "1559"}, {"n": "其它情色片", "v": "1550"}
            ]}]
        },
        list: []
    };
}

/**
 * 分类接口 [2]
 */
async function category(params) {
    const { categoryId, page, filters } = params;
    const pg = parseInt(page) || 1;
    
    // 处理筛选参数
    let tid = categoryId;
    if (filters && filters.class) {
        tid = filters.class;
    }
    
    const url = pg === 1 
        ? `${host}/t/${tid}.html` 
        : `${host}/t/${tid}/p${pg}.html`;
    
    logInfo(`请求分类: ${tid}, 页码: ${pg}, URL: ${url}`);
    
    try {
        const res = await axiosInstance.get(url, { headers: def_headers });
        const html = res.data;
        
        // 解析视频列表
        const regex = /<a class="w4-item" href="([^"]+)".*?<img.*?data-src="([^"]+)".*?<div class="s">.*?<span>([^<]+)<\/span>.*?<div class="t"[^>]*title="([^"]+)">.*?<div class="i">([^<]+)<\/div>/gs;
        const videos = [];
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            videos.push({
                vod_id: match[1],
                vod_name: match[4].trim(),
                vod_pic: fixPicUrl(match[2]),
                vod_remarks: match[3].trim()
            });
        }
        
        // 解析总页数
        const pageRegex = /\/p(\d+)\.html"[^>]*>(\d+)<\/a>/g;
        let maxPage = pg;
        let pageMatch;
        while ((pageMatch = pageRegex.exec(html)) !== null) {
            maxPage = Math.max(maxPage, parseInt(pageMatch[2]));
        }
        
        logInfo(`分类结果: ${videos.length}条, 总页数: ${maxPage}`);
        
        return {
            list: videos,
            page: pg,
            pagecount: maxPage
        };
    } catch (e) {
        logError("分类请求失败", e);
        return { list: [], page: pg, pagecount: 0 };
    }
}

/**
 * 搜索接口 [2]
 */
async function search(params) {
    const wd = params.keyword || params.wd || "";
    const pg = parseInt(params.page) || 1;
    
    const encodedKw = encodeURIComponent(wd);
    const url = pg === 1 
        ? `${host}/s/${encodedKw}.html` 
        : `${host}/s/${encodedKw}/p${pg}.html`;
    
    logInfo(`搜索关键词: ${wd}, 页码: ${pg}, URL: ${url}`);
    
    try {
        const res = await axiosInstance.get(url, { headers: def_headers });
        const html = res.data;
        
        // 解析搜索结果
        const regex = /<a class="w4-item" href="([^"]+)".*?<img.*?data-src="([^"]+)".*?<div class="t"[^>]*>([^<]+)<\/div>.*?<div class="i">([^<]+)<\/div>/gs;
        const videos = [];
        let match;
        
        while ((match = regex.exec(html)) !== null) {
            videos.push({
                vod_id: match[1],
                vod_name: match[3].trim(),
                vod_pic: fixPicUrl(match[2]),
                vod_remarks: match[4].trim()
            });
        }
        
        logInfo(`搜索结果: ${videos.length}条`);
        
        return {
            list: videos,
            page: pg,
            pagecount: 10
        };
    } catch (e) {
        logError("搜索失败", e);
        return { list: [], page: pg, pagecount: 0 };
    }
}

/**
 * 详情接口 [1][2]
 * 关键：将T3的vod_play_from/vod_play_url转换为T4的vod_play_sources
 */
async function detail(params) {
    const videoId = params.videoId;
    const url = videoId.startsWith('http') ? videoId : `${host}${videoId}`;
    
    logInfo(`请求详情: ${videoId}, URL: ${url}`);
    
    try {
        const res = await axiosInstance.get(url, { headers: def_headers });
        const html = res.data;
        
        const vod = {
            vod_id: videoId,
            vod_name: '',
            vod_pic: '',
            vod_type: '',
            vod_year: '',
            vod_area: '',
            vod_remarks: '',
            vod_actor: '',
            vod_director: '',
            vod_content: ''
        };
        
        // 解析标题
        const titleMatch = html.match(/<li class="on"><h1>([^<]+)<\/h1><\/li>/);
        if (titleMatch) vod.vod_name = titleMatch[1];
        
        // 解析封面
        const picMatch = html.match(/data-poster="([^"]+)"/);
        if (picMatch) vod.vod_pic = fixPicUrl(picMatch[1]);
        
        // 解析描述和演员信息
        const descMatch = html.match(/name="description" content="(.*?)"/);
        if (descMatch) {
            const content = descMatch[1];
            vod.vod_content = content;
            
            const actorMatch = content.match(/演员:(.*?)(。|$)/);
            if (actorMatch) vod.vod_actor = actorMatch[1];
            
            const areaMatch = content.match(/地区:(.*?)(。|$)/);
            if (areaMatch) vod.vod_area = areaMatch[1];
            
            const directorMatch = content.match(/导演:(.*?)(。|$)/);
            if (directorMatch) vod.vod_director = directorMatch[1];
        }
        
        // 解析播放源数据 [2]
        const scriptMatch = html.match(/var pp=({.*?});/s);
        if (scriptMatch) {
            try {
                const ppData = JSON.parse(scriptMatch[1]);
                const vno = ppData.no;
                const playFromArr = [];
                const playUrlArr = [];
                
                for (const line of ppData.la || []) {
                    const [lineId, lineName, episodeCount] = line;
                    const episodes = [];
                    
                    for (let i = 0; i < episodeCount; i++) {
                        episodes.push(`第${i + 1}集$/v/${vno}/${lineId}z${i}.html`);
                    }
                    
                    if (episodes.length > 0) {
                        playFromArr.push(lineName);
                        playUrlArr.push(episodes.join('#'));
                    }
                }
                
                // T3格式数据
                const vodPlayFrom = playFromArr.join('$$$');
                const vodPlayUrl = playUrlArr.join('$$$');
                
                // 转换为T4格式 [1]
                vod.vod_play_sources = parsePlaySources(vodPlayFrom, vodPlayUrl);
                
                logInfo("播放源解析完成", { 
                    fromCount: playFromArr.length, 
                    sources: vod.vod_play_sources.length 
                });
            } catch (e) {
                logError("解析播放源数据失败", e);
            }
        }
        
        return { list: [vod] };
    } catch (e) {
        logError("详情获取失败", e);
        return { list: [] };
    }
}

/**
 * 播放接口 [2]
 */
async function play(params) {
    const playId = params.playId;
    const url = `${host}${playId}`;
    
    logInfo(`准备播放: ${playId}, URL: ${url}`);
    
    try {
        const res = await axiosInstance.get(url, { headers: def_headers });
        const html = res.data;
        
        // 解析真实播放地址
        const match = html.match(/data-src="([^"]+)"/);
        if (match) {
            const playUrl = match[1];
            logInfo(`解析到播放地址: ${playUrl}`);
            
            return {
                urls: [{ name: "默认", url: playUrl }],
                parse: 0,
                header: def_headers
            };
        }
    } catch (e) {
        logError("解析播放地址失败", e);
    }
    
    return {
        urls: [{ name: "默认", url: "" }],
        parse: 0,
        header: def_headers
    };
}

module.exports = { home, category, search, detail, play };

const runner = require("spider_runner");
runner.run(module.exports);
