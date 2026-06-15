(function() {
  'use strict';

  // 全局错误处理 - 彻底抑制拼多多页面自身的ACE编辑器错误和React Hydration错误
  const suppressedErrors = [
    'Invalid node to range',
    'ace_fastIncorp',
    'processSectionDirtyRange',
    'incorporateUserChanges',
    'nodesToRange',
    'getDirtyRange',
    'magicdomid',
    'validateNode',
    'error trigger on phase',
    'set browser range',  // 新增
    'setSelectionRange',
    'createRange',
    'getBoundingClientRect',
    'reach page error limit',  // 拼多多页面自身的错误限制
    'page error limit',  // 页面错误限制
    'hooks error',  // Hook 错误
    'HookListener',  // Hook 监听器错误
    'acePostKeyEvent',  // ACE 编辑器按键事件错误
    '在当前页面中找不到节点',  // 节点查找错误
    '找不到节点',  // 节点查找错误
    'Minified React error',  // React 压缩错误
    'Hydration failed',  // React Hydration 失败
    'error #418',  // React Hydration 错误代码
    'error #423',  // React Hydration 错误代码
    'does not match what was rendered',  // SSR内容不匹配
    'There was an error while hydrating'  // Hydration 过程中出错
  ];
  
  function shouldSuppressError(args) {
    try {
      const errorStr = String(args);
      return suppressedErrors.some(keyword => errorStr.includes(keyword));
    } catch (e) {
      return false;
    }
  }
  
  // 保存原始方法
  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  const originalConsoleLog = console.log.bind(console);
  
  // 创建过滤函数
  function filteredError(...args) {
    if (shouldSuppressError(args)) {
      return;
    }
    return originalConsoleError(...args);
  }
  
  function filteredWarn(...args) {
    if (shouldSuppressError(args)) {
      return;
    }
    return originalConsoleWarn(...args);
  }
  
  function filteredLog(...args) {
    if (shouldSuppressError(args)) {
      return;
    }
    return originalConsoleLog(...args);
  }
  
  // 简单应用拦截器，不使用 Object.defineProperty 或 Proxy（避免闪屏）
  // 只在初始化时设置一次，不强制锁定
  console.error = filteredError;
  console.warn = filteredWarn;
  console.log = filteredLog;
  
  // 拦截 window.onerror
  window.onerror = function(message, source, lineno, colno, error) {
    if (shouldSuppressError([message, source])) {
      return true;
    }
    return false;
  };
  
  // 拦截 window.error 事件 - 使用捕获阶段
  window.addEventListener('error', function(e) {
    if (shouldSuppressError([e.message, e.filename])) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);
  
  // 拦截未处理的 Promise rejection
  window.addEventListener('unhandledrejection', function(e) {
    if (shouldSuppressError([e.reason])) {
      e.stopImmediatePropagation();
      e.preventDefault();
      return false;
    }
  }, true);
  
  // 只在初始化时应用一次拦截器，不再定期重新应用（避免闪屏）
  // 注意：如果页面覆盖了 console 方法，我们接受这个结果，不再强制锁定
  
  const API_PATTERNS = [
    '/api/backbone/goods/consumer/video/list',
    '/api/video',
    '/video/list',
    'videoList',
    'video/list',
    '/api/backbone/video/publish',
    '/get_endpoint',
    '/upload_init',
    '/large_file/v1/video',
    'backbone-video-sign',
    'replay-manage',
    '/replay/page',
    'carllive/replay'
  ];
  
  const GOODS_API_PATTERNS = [
    'carllive/replay/page/goods',
    '/api/backbone/goods',
    '/goods/list',
    'goods_info_list',
    '/mall-goods-video',
    'mall/goods',
    '/goods/consumer',
    'goodsList',
    'product/list',
    'replay-manage',
    '/replay/page'
  ];
  
  const interceptedData = [];
  const videoUrls = {};
  const MAX_INTERCEPTED_DATA = 100;
  const MAX_VIDEO_URLS = 500; // 限制拦截数据数量
  
  // 限制数组大小的函数
  function limitArraySize(arr, maxSize) {
    if (arr.length > maxSize) {
      arr.splice(0, arr.length - maxSize);
    }
  }
  
  function limitObjectSize(obj, maxSize) {
    const keys = Object.keys(obj);
    if (keys.length > maxSize) {
      const deleteCount = keys.length - maxSize;
      for (let i = 0; i < deleteCount; i++) {
        delete obj[keys[i]];
      }
    }
  }
  
  function extractAccountId(data) {
    if (!data) return null;
    const idFields = ['mallId', 'mall_id', 'userId', 'user_id', 'sellerId', 'seller_id', 'merchantId', 'merchant_id', 'shopId', 'shop_id'];
    if (data.result) {
      for (const field of idFields) {
        if (data.result[field] && /^\d{5,}$/.test(String(data.result[field]))) {
          return data.result[field];
        }
      }
    }
    if (data.data) {
      for (const field of idFields) {
        if (data.data[field] && /^\d{5,}$/.test(String(data.data[field]))) {
          return data.data[field];
        }
      }
    }
    for (const field of idFields) {
      if (data[field] && /^\d{5,}$/.test(String(data[field]))) {
        return data[field];
      }
    }
    return null;
  }
  
  function extractGoodsIds(data, url) {
    const goodsIds = [];
    if (!data) return goodsIds;
    
    let goodsList = null;
    
    // 遍历所有可能的嵌套路径
    const paths = [
      ['result', 'influenceGoodsItemList'],
      ['result', 'goods_info_list'],
      ['result', 'list'],
      ['result', 'goodsList'],
      ['result', 'goods_list'],
      ['result', 'items'],
      ['data', 'influenceGoodsItemList'],
      ['data', 'goods_info_list'],
      ['data', 'list'],
      ['data', 'goodsList'],
      ['data', 'goods_list'],
      ['data', 'items'],
      ['data'],
      ['result']
    ];
    
    for (const path of paths) {
      let current = data;
      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key];
        } else {
          current = null;
          break;
        }
      }
      if (Array.isArray(current) && current.length > 0) {
        goodsList = current;
        break;
      }
    }
    
    if (!goodsList && Array.isArray(data)) {
      goodsList = data;
    }
    
    if (Array.isArray(goodsList)) {
      goodsList.forEach(item => {
        if (!item || typeof item !== 'object') return;
        
        const id = item.goods_id || item.goodsId || item.productId || 
                   item.product_id || item.id || item.gid || item.goodsIdStr;
        if (id) {
          // 清理图片URL，去除反引号和空格
          let rawImageUrl = item.goodsImage || item.image || item.imageUrl || item.thumbUrl || item.cover || item.pic_url || '';
          let cleanImageUrl = rawImageUrl.replace(/[`\s]/g, '').trim();
          
          // 过滤条件：必须有商品照片（系统视频商品没有照片）
          if (!cleanImageUrl || cleanImageUrl === '') {
            return;
          }
          
          goodsIds.push({
            goodsId: String(id),
            goodsName: item.goods_name || item.title || item.name || item.goodsName || '',
            goodsImage: cleanImageUrl,
            price: item.price || '',
            totalGMV: item.totalGMV || item.total_gmv || '',
            orderCount: item.orderCount || item.order_count || 0,
            videoCount: item.videoCount || item.video_count || 0,
            pv: item.pv || 0,
            uv: item.uv || 0,
            clickCount: item.click_count || 0,
            // 保留时间字段用于排序
            createTime: item.createTime || item.createdAt || item.goodsCreateTime || null,
            publishTime: item.publishTime || item.publishedAt || null,
            updateTime: item.updateTime || item.updatedAt || null,
            startPt: item.startPt || null,
            endPt: item.endPt || null
          });
        }
      });
    }
    
    return goodsIds;
  }
  
  function extractGoodsVideos(data, url) {
    const goodsVideos = [];
    if (!data) return goodsVideos;
    
    // 递归搜索视频数据
    function searchVideos(obj, path = '') {
      if (!obj || typeof obj !== 'object') return;
      
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
          if (isVideoObject(item)) {
            const videoInfo = extractVideoInfo(item);
            if (videoInfo) goodsVideos.push(videoInfo);
          } else {
            searchVideos(item, `${path}[${index}]`);
          }
        });
        return;
      }
      
      if (isVideoObject(obj)) {
        const videoInfo = extractVideoInfo(obj);
        if (videoInfo) goodsVideos.push(videoInfo);
        return;
      }
      
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value && typeof value === 'object') {
          if (key.toLowerCase().includes('video')) {
            searchVideos(value, `${path}.${key}`);
          }
        }
      }
    }
    
    function isVideoObject(obj) {
      if (!obj || typeof obj !== 'object') return false;
      // 检查是否有视频URL字段（拼多多使用playUrl）
      const hasVideoUrl = obj.videoUrl || obj.url || obj.playUrl || obj.mp4Url || 
                         obj.video_url || obj.play_url || obj.mp4_url || obj.src || obj.video_url_high || obj.playUrl;
      // 检查是否有视频ID字段（拼多多使用feedId）
      const hasVideoId = obj.videoId || obj.video_id || obj.id || obj.vid || obj.feedId || obj.feed_id;
      // 检查是否有封面图（拼多多视频通常有coverUrl）
      const hasCover = obj.coverUrl || obj.cover || obj.cover_url || obj.thumbnail;
      
      // 拼多多视频对象：有playUrl + feedId 或 有playUrl + coverUrl
      return hasVideoUrl && (hasVideoId || hasCover);
    }
    
    // 清理URL（去除反引号和空格）
    function cleanUrl(url) {
      if (!url) return '';
      return url.replace(/`/g, '').replace(/\s/g, '').replace(/\n/g, '').replace(/\r/g, '').trim();
    }
    
    function extractVideoInfo(item) {
      // 拼多多使用 playUrl 作为视频地址
      const rawVideoUrl = item.playUrl || item.videoUrl || item.url || item.playUrl || item.mp4Url || 
                      item.video_url || item.play_url || item.mp4_url || item.src || item.video_url_high || '';
      const videoUrl = cleanUrl(rawVideoUrl);
      if (!videoUrl) return null;
      
      // 从API响应中获取商品ID（如果item中没有）
      const apiGoodsId = data?.result?.goodsId || data?.result?.goods_id || '';
      
      return {
        videoId: item.feedId || item.videoId || item.video_id || item.id || item.vid || '',
        videoUrl: videoUrl,
        coverUrl: cleanUrl(item.coverUrl || item.cover_url || item.cover || item.thumbnail || item.pic || item.imageUrl || ''),
        duration: item.duration || item.length || item.videoDuration || 0,
        width: item.width || item.videoWidth || 0,
        height: item.height || item.videoHeight || 0,
        title: item.desc || item.title || item.videoTitle || item.name || item.videoDesc || '',
        goodsId: item.goodsId || item.goods_id || item.productId || apiGoodsId || '',
        playCount: item.playCount || item.play_count || item.pv || 0,
        likeCount: item.likes || item.likeCount || item.like_count || 0,
        publishTime: item.publishTime || item.publish_time || item.createdAt || null,
        sourceUrl: url,
        capturedAt: new Date().toISOString()
      };
    }
    
    // 从常见视频字段路径提取
    const videoPaths = [
      data?.result?.influenceVideoItemList,
      data?.result?.videoList,
      data?.result?.video_list,
      data?.result?.videoInfoList,
      data?.result?.mallVideoList,
      data?.result?.videos,
      data?.data?.videos,
      data?.data?.videoList,
      data?.data?.video_list,
      data?.videos,
      data?.videoList
    ];
    
    for (const videos of videoPaths) {
      if (videos && Array.isArray(videos)) {
        videos.forEach(item => {
          if (isVideoObject(item)) {
            const videoInfo = extractVideoInfo(item);
            if (videoInfo) goodsVideos.push(videoInfo);
          }
        });
      }
    }
    
    // 如果没找到，递归搜索
    if (goodsVideos.length === 0) {
      searchVideos(data);
    }
    
    return goodsVideos;
  }
  
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
    const options = args[1] || {};
    const method = options.method || 'GET';
    const body = options.body;
    
    if (url.includes('.mp4') || url.includes('.m3u8')) {
      extractVideoIdFromUrl(url);
    }
    
    const isTargetApi = API_PATTERNS.some(p => url.includes(p)) || url.includes('video');
    const isGoodsApi = GOODS_API_PATTERNS.some(p => url.includes(p));
    
    try {
      const response = await originalFetch.apply(this, args);
      
      // 异步处理响应数据，不阻塞原请求
      setTimeout(async () => {
        try {
          const clonedResponse = response.clone();
          const text = await clonedResponse.text();
          
          if (text && text.length > 2 && (text[0] === '{' || text[0] === '[')) {
            try {
              const data = JSON.parse(text);
              
              const hasVideoData = checkVideoData(data);
              
              if (isGoodsApi) {
                const goodsIds = extractGoodsIds(data, url);
                if (goodsIds.length > 0) {
                  window.postMessage({
                    type: 'PDD_GOODS_IDS_CAPTURED',
                    goodsIds: goodsIds,
                    url: url
                  }, '*');
                  
                  const goodsVideos = extractGoodsVideos(data, url);
                  if (goodsVideos.length > 0) {
                    const videosByGoods = {};
                    goodsVideos.forEach(video => {
                      const gid = video.goodsId || 'unknown';
                      if (!videosByGoods[gid]) videosByGoods[gid] = [];
                      videosByGoods[gid].push(video);
                    });
                    
                    Object.entries(videosByGoods).forEach(([gid, videos]) => {
                      window.postMessage({
                        type: 'PDD_GOODS_VIDEOS_CAPTURED',
                        goodsId: gid,
                        videos: videos,
                        url: url,
                        source: 'goods_api'
                      }, '*');
                    });
                  }
                }
              }
              
              if (hasVideoData || isTargetApi) {
                const record = {
                  type: 'fetch',
                  time: Date.now(),
                  url: url,
                  method: method,
                  body: body,
                  response: data,
                  hasVideo: hasVideoData
                };
                
                interceptedData.push(record);
                limitArraySize(interceptedData, MAX_INTERCEPTED_DATA);
                
                window.postMessage({
                  type: 'PDD_API_INTERCEPTED',
                  data: record
                }, '*');
                
                if (url.includes('/api/backbone/goods/consumer/video/list')) {
                  const goodsVideos = extractGoodsVideos(data, url);
                  if (goodsVideos.length > 0) {
                    const videosByGoods = {};
                    goodsVideos.forEach(video => {
                      const gid = video.goodsId || data?.result?.goodsId || 'unknown';
                      if (!videosByGoods[gid]) videosByGoods[gid] = [];
                      videosByGoods[gid].push(video);
                    });
                    
                    Object.entries(videosByGoods).forEach(([gid, videos]) => {
                      window.postMessage({
                        type: 'PDD_GOODS_VIDEOS_CAPTURED',
                        goodsId: gid,
                        videos: videos,
                        url: url,
                        source: 'fetch_goods_video_api'
                      }, '*');
                    });
                  }
                }
              }
            } catch (parseErr) {
              // 忽略解析错误
            }
          }
        } catch (readErr) {
          // 忽略读取错误
        }
      }, 0);
      
      return response;
    } catch (err) {
      throw err;
    }
  };
  
  function extractVideoIdFromUrl(url) {
    const patterns = [
      /tower-video-side-b\/([a-f0-9]+)/i,
      /video[\/\-]([a-zA-Z0-9]+)/i,
      /([a-f0-9]{32,})/i
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        const videoId = match[1];
        if (!videoUrls[videoId]) {
          videoUrls[videoId] = url;
          limitObjectSize(videoUrls, MAX_VIDEO_URLS);
          
          window.postMessage({
            type: 'PDD_VIDEO_URL_CAPTURED',
            videoId: videoId,
            videoUrl: url
          }, '*');
        }
        break;
      }
    }
  }
  
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._pddUrl = url;
    this._pddMethod = method;
    
    if (typeof url === 'string' && (url.includes('.mp4') || url.includes('.m3u8'))) {
      extractVideoIdFromUrl(url);
    }
    
    return originalOpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(body, ...rest) {
    const url = this._pddUrl || '';
    const method = this._pddMethod || 'GET';
    const isTargetApi = API_PATTERNS.some(p => url.includes(p)) || url.includes('video');
    const isGoodsApi = GOODS_API_PATTERNS.some(p => url.includes(p));
    
    this.addEventListener('load', function() {
      try {
        const text = this.responseText;
        
        if (text && text.length > 2 && (text[0] === '{' || text[0] === '[')) {
          try {
            const data = JSON.parse(text);
            
            const hasVideoData = checkVideoData(data);
            
            const accountId = extractAccountId(data);
            if (accountId) {
              window.postMessage({
                type: 'PDD_ACCOUNT_ID_FOUND',
                accountId: accountId
              }, '*');
            }
            
            if (isGoodsApi) {
              const goodsIds = extractGoodsIds(data, url);
              if (goodsIds.length > 0) {
                window.postMessage({
                  type: 'PDD_GOODS_IDS_CAPTURED',
                  goodsIds: goodsIds,
                  url: url
                }, '*');
              }
            }
            
            if (hasVideoData || isTargetApi) {
              const record = {
                type: 'xhr',
                time: Date.now(),
                url: url,
                method: method,
                body: body,
                response: data,
                hasVideo: hasVideoData
              };
              
              interceptedData.push(record);
              
              window.postMessage({
                type: 'PDD_API_INTERCEPTED',
                data: record
              }, '*');
              
              if (url.includes('/api/backbone/goods/consumer/video/list')) {
                const goodsVideos = extractGoodsVideos(data, url);
                if (goodsVideos.length > 0) {
                  const videosByGoods = {};
                  goodsVideos.forEach(video => {
                    const gid = video.goodsId || data?.result?.goodsId || 'unknown';
                    if (!videosByGoods[gid]) videosByGoods[gid] = [];
                    videosByGoods[gid].push(video);
                  });
                  
                  Object.entries(videosByGoods).forEach(([gid, videos]) => {
                    window.postMessage({
                      type: 'PDD_GOODS_VIDEOS_CAPTURED',
                      goodsId: gid,
                      videos: videos,
                      url: url,
                      source: 'xhr_goods_video_api'
                    }, '*');
                  });
                }
              }
            }
          } catch (parseErr) {
          }
        }
      } catch (e) {
      }
    });
    
    return originalSend.apply(this, [body, ...rest]);
  };
  
  function checkVideoData(data) {
    if (!data) return false;
    
    if (data.result && typeof data.result === 'object') {
      const r = data.result;
      if (r.influenceVideoItemList?.length > 0) return true;
      if (r.goods_info_list?.length > 0) return true;
      if (r.videoList?.length > 0) return true;
      if (r.videoInfoList?.length > 0) return true;
      if (r.mallVideoList?.length > 0) return true;
      if (r.list?.length > 0) {
        const first = r.list[0];
        if (first && (first.playCount !== undefined || first.pv !== undefined || first.feedId || first.videoId)) return true;
      }
    }
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      const first = data.data[0];
      if (first && (first.playCount !== undefined || first.feedId || first.videoId)) return true;
    }
    
    return false;
  }
  
  function observeVideoElements() {
    // 使用防抖，避免频繁触发
    let debounceTimer = null;
    const processedVideos = new Set(); // 跟踪已处理的视频
    let lastCheckTime = 0;
    const CHECK_INTERVAL = 5000; // 5秒检查一次
    
    // 使用定时器代替 MutationObserver，避免闪屏
    const checkInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastCheckTime < CHECK_INTERVAL) return;
      lastCheckTime = now;
      
      document.querySelectorAll('video').forEach(function(video) {
        const src = video.src || video.currentSrc;
        // 只处理新的视频URL
        if (src && (src.includes('.mp4') || src.includes('.m3u8')) && !processedVideos.has(src)) {
          processedVideos.add(src);
          extractVideoIdFromUrl(src);
          
          if (processedVideos.size > 100) {
            const firstKey = processedVideos.values().next().value;
            processedVideos.delete(firstKey);
          }
        }
      });
    }, CHECK_INTERVAL);
    
    // 初始检查
    document.querySelectorAll('video').forEach(function(video) {
      const src = video.src || video.currentSrc;
      if (src && (src.includes('.mp4') || src.includes('.m3u8')) && !processedVideos.has(src)) {
        processedVideos.add(src);
        extractVideoIdFromUrl(src);
      }
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeVideoElements);
  } else {
    observeVideoElements();
  }
  
  window.__getPddInterceptedData = function() {
    return interceptedData;
  };
  
  window.__getPddVideoUrls = function() {
    return videoUrls;
  };
  
  // 内容声明填充功能（在 MAIN world 中执行，可以直接访问页面 DOM）
  window.__pddFillDeclaration = async function(declaration) {
    declaration = declaration || '内容无需标注';
    console.log('[PDD注入] 开始填充内容声明:', declaration);
    
    try {
      // 1. 找到内容声明选择器（只在编辑面板中查找）
      const allSelects = document.querySelectorAll('[class*="ST_selectValueSingle"]');
      let targetSelect = null;
      
      for (const select of allSelects) {
        // 排除视频列表项中的选择器
        if (select.closest('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]')) continue;
        
        const rect = select.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          let parent = select.parentElement;
          for (let i = 0; i < 8 && parent; i++) {
            const pt = parent.textContent || '';
            if (pt.includes('内容声明') && !pt.includes('不设置内容声明')) {
              targetSelect = select;
              break;
            }
            parent = parent.parentElement;
          }
          if (targetSelect) break;
        }
      }
      
      if (!targetSelect) {
        console.log('[PDD注入] 未找到内容声明选择器');
        return false;
      }
      
      // 2. 点击选择器
      targetSelect.scrollIntoView({ behavior: 'instant', block: 'center' });
      await new Promise(r => setTimeout(r, 300));
      targetSelect.click();
      console.log('[PDD注入] 已点击选择器');
      
      // 3. 使用 MutationObserver 等待选项出现
      const optionAppeared = await new Promise((resolve) => {
        const checkExisting = () => {
          // 优先通过 ContentDeclaration_title 类名查找选项
          const titleOptions = document.querySelectorAll('[class*="ContentDeclaration_title"]');
          for (const el of titleOptions) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || '').trim();
            if (t.includes(declaration)) {
              return el;
            }
          }
          // 备用：遍历查找包含目标文本的元素
          const allEls = document.querySelectorAll('*');
          for (const el of allEls) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || '').trim();
            if (t.includes(declaration) && t.length < 50) {
              return el;
            }
          }
          return null;
        };
        
        const existing = checkExisting();
        if (existing) {
          resolve(existing);
          return;
        }
        
        const observer = new MutationObserver(() => {
          const el = checkExisting();
          if (el) {
            observer.disconnect();
            clearTimeout(timeout);
            resolve(el);
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        const timeout = setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 10000);
      });
      
      if (optionAppeared) {
        optionAppeared.click();
        console.log('[PDD注入] 已点击选项:', declaration);
        await new Promise(r => setTimeout(r, 300));
        document.body.click();
        return true;
      }
      
      // 4. 备用方案：通过 ContentDeclaration_title 查找
      const titleOptions = document.querySelectorAll('[class*="ContentDeclaration_title"]');
      for (const el of titleOptions) {
        if (!el.offsetParent) continue;
        const t = (el.textContent || '').trim();
        if (t.includes(declaration)) {
          el.click();
          console.log('[PDD注入] 备用方案点击:', t);
          await new Promise(r => setTimeout(r, 300));
          document.body.click();
          return true;
        }
      }
      
      console.log('[PDD注入] 未找到选项:', declaration);
      document.body.click();
      return false;
    } catch (e) {
      console.log('[PDD注入] 填充出错:', e);
      return false;
    }
  };
  
  // 批量填充所有内容声明
  window.__pddFillAllDeclaration = async function(declaration) {
    declaration = declaration || '内容无需标注';
    console.log('[PDD注入] 批量填充内容声明:', declaration);
    
    try {
      const allSelects = document.querySelectorAll('[class*="ST_selectValueSingle"]');
      const validSelects = [];
      
      for (const select of allSelects) {
        const rect = select.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          let parent = select.parentElement;
          for (let i = 0; i < 6 && parent; i++) {
            if ((parent.textContent || '').includes('内容声明')) {
              validSelects.push(select);
              break;
            }
            parent = parent.parentElement;
          }
        }
      }
      
      console.log('[PDD注入] 找到', validSelects.length, '个内容声明选择器');
      
      let success = 0;
      let fail = 0;
      
      for (const select of validSelects) {
        select.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 300));
        select.click();
        await new Promise(r => setTimeout(r, 1500));
        
        // 查找选项
        const titleOptions = document.querySelectorAll('[class*="ContentDeclaration_title"]');
        let found = false;
        for (const el of titleOptions) {
          if (!el.offsetParent) continue;
          const t = (el.textContent || '').trim();
          if (t.includes(declaration)) {
            el.click();
            await new Promise(r => setTimeout(r, 300));
            document.body.click();
            await new Promise(r => setTimeout(r, 500));
            success++;
            found = true;
            break;
          }
        }
        if (!found) fail++;
      }
      
      console.log('[PDD注入] 完成: 成功', success, ', 失败', fail);
      return { success, fail, total: validSelects.length };
    } catch (e) {
      console.log('[PDD注入] 批量填充出错:', e);
      return { success: 0, fail: 0, total: 0 };
    }
  };
  
  // 监听来自 content script 的消息
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    const message = event.data;
    if (!message.type || !message.type.startsWith('PDD_FILL_')) return;
    
    if (message.type === 'PDD_FILL_DECLARATION') {
      window.__pddFillDeclaration(message.declaration).then(result => {
        window.postMessage({ type: 'PDD_FILL_DECLARATION_RESULT', result: result }, '*');
      });
    }
    
    if (message.type === 'PDD_FILL_ALL_DECLARATION') {
      window.__pddFillAllDeclaration(message.declaration).then(result => {
        window.postMessage({ type: 'PDD_FILL_ALL_DECLARATION_RESULT', result: result }, '*');
      });
    }
  });
  
  console.log('[PDD注入] 内容声明填充函数已注册');
})();
