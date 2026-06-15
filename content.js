﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿(function() {
  'use strict';
  
  // ========== 立即暴露调试接口（放在最前面，确保始终可用） ==========
  console.log('[PDD监控] ====== 内容脚本开始加载 ======');
  
  window.pddMonitorDebug = {
    resetBallPosition: function() {
      localStorage.removeItem('pdd-ball-position');
      const ball = document.getElementById('pdd-monitor-ball');
      if (ball) { ball.classList.remove('active'); console.log('[PDD监控] 导航栏按钮状态已重置'); }
      else { console.log('[PDD监控] 导航栏按钮不存在'); }
    },
    showBall: function() {
      const ball = document.getElementById('pdd-monitor-ball');
      if (ball) {
        ball.style.display = 'flex';
        ball.style.opacity = '1';
        ball.style.visibility = 'visible';
        ball.style.zIndex = '2147483647';
        console.log('[PDD监控] 按钮已强制显示');
      } else {
        console.log('[PDD监控] 按钮尚未创建（addPanel可能未执行）');
      }
    },
    checkBallStatus: function() {
      const ball = document.getElementById('pdd-monitor-ball');
      if (!ball) { console.log('[PDD监控] 按钮不存在于DOM中，addPanel可能未被调用'); return; }
      const rect = ball.getBoundingClientRect();
      const style = window.getComputedStyle(ball);
      console.log('[PDD监控] 按钮状态:', {
        exists: true,
        parentTag: ball.parentElement ? ball.parentElement.tagName : 'none',
        position: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) },
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        zIndex: style.zIndex
      });
    }
  };
  
  // 手动触发添加面板的接口
  window.pddMonitorDebug.forceAddPanel = function() {
    if (typeof addPanel !== 'undefined') {
      addPanel();
      console.log('[PDD监控] 已手动调用 addPanel()');
    } else {
      console.log('[PDD监控] addPanel 函数尚未定义');
    }
  };
  
  console.log('[PDD监控] ✓ 调试接口已暴露: window.pddMonitorDebug');
  
  // ========== 全局错误处理 ==========
  window.addEventListener('error', function(e) {
    if (e.error && e.error.message && e.error.message.includes('PDD监控')) {
      e.preventDefault();
      return false;
    }
  }, true);
  
  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && e.reason.message.includes('PDD监控')) {
      e.preventDefault();
      return false;
    }
  }, true);
  
  // requestIdleCallback polyfill
  window.requestIdleCallback = window.requestIdleCallback || function(cb) {
    const start = Date.now();
    return setTimeout(() => {
      cb({
        didTimeout: false,
        timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
      });
    }, 1);
  };
  
  // 性能优化配置
  const PERF_CONFIG = {
    enableDebugLog: false
  };

  // 禁用所有 console.log 输出（避免页面卡顿）
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  console.log = function() {
    if (PERF_CONFIG.enableDebugLog) {
      originalConsoleLog.apply(console, arguments);
    }
  };
  
  console.warn = function() {
    if (PERF_CONFIG.enableDebugLog) {
      originalConsoleWarn.apply(console, arguments);
    }
  };
  
  console.error = function() {
    if (PERF_CONFIG.enableDebugLog) {
      originalConsoleError.apply(console, arguments);
    }
  };

  // 检测当前页面类型 - 提前判断
  const currentUrl = window.location.href;
  const isUploadPageUrl = currentUrl.includes('/video/publish') || 
                       currentUrl.includes('/creator/video/publish') || 
                       currentUrl.includes('/n-creator/video/publish') ||
                       currentUrl.includes('/n-creator/video/home') ||
                       currentUrl.includes('/n-creator/video/mall-goods-video') ||
                       currentUrl.includes('/n-creator/video/replay-manage') ||
                       currentUrl.includes('/duo-video') ||
                       currentUrl.includes('/video/duo');
  const isDataPageUrl = currentUrl.includes('/video/list') || 
                     currentUrl.includes('/video/data') || 
                     currentUrl.includes('/creator/video/list') || 
                     currentUrl.includes('/n-creator/video/list') ||
                     currentUrl.includes('/n-creator/video/mall-goods-video') ||
                     currentUrl.includes('/n-creator/video/home') ||
                     currentUrl.includes('/n-creator/video/replay-manage') ||
                     currentUrl.includes('/duo-video') ||
                     currentUrl.includes('/video/duo');
  
  // 是否为拼多多相关页面
  const isPddPage = currentUrl.includes('pinduoduo.com') || currentUrl.includes('yangkeduo.com');
  
  // 拦截网络请求捕获商品ID - 只在拼多多页面且是目标页面时启用
  const capturedGoodsIds = new Set();
  
  // 只在拼多多页面启用网络拦截
  if (isPddPage && (isUploadPageUrl || isDataPageUrl)) {
    // 拦截 fetch 请求
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      
      try {
        const url = args[0]?.url || args[0] || '';
        
        // 检查是否是商品列表相关的API
        if (url.includes('goods') || url.includes('product') || url.includes('mall')) {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json().catch(() => null);
          
          if (data) {
            const lists = [
              data?.data?.list,
              data?.data?.goodsList,
              data?.data?.items,
              data?.result?.list,
              data?.result?.goodsList,
              data?.list,
              data?.goodsList
            ];
            
            for (const list of lists) {
              if (Array.isArray(list)) {
                list.forEach(item => {
                  const id = item.goodsId || item.goods_id || item.productId || 
                            item.product_id || item.id || item.gid;
                  if (id && /^\d+$/.test(String(id))) {
                    capturedGoodsIds.add(String(id));
                  }
                });
              }
            }
            
            // 保存到 sessionStorage
            if (capturedGoodsIds.size > 0) {
              sessionStorage.setItem('__pdd_goods_cache', JSON.stringify(Array.from(capturedGoodsIds)));
            }
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
      
      return response;
    };
    
    // 拦截 XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;
    const XHR = function() {
      const xhr = new originalXHR();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;
      
      xhr.open = function(method, url, ...rest) {
        xhr._url = url;
        return originalOpen.apply(xhr, [method, url, ...rest]);
      };
      
      xhr.send = function(...args) {
        xhr.addEventListener('load', function() {
          try {
            const url = xhr._url || '';
            if (url.includes('goods') || url.includes('product') || url.includes('mall')) {
              const data = JSON.parse(xhr.responseText);
              
              const lists = [
                data?.data?.list,
                data?.data?.goodsList,
                data?.data?.items,
                data?.result?.list,
                data?.result?.goodsList,
                data?.list,
                data?.goodsList
              ];
              
              for (const list of lists) {
                if (Array.isArray(list)) {
                  list.forEach(item => {
                    const id = item.goodsId || item.goods_id || item.productId || 
                              item.product_id || item.id || item.gid;
                    if (id && /^\d+$/.test(String(id))) {
                      capturedGoodsIds.add(String(id));
                    }
                  });
                }
              }
              
              if (capturedGoodsIds.size > 0) {
                sessionStorage.setItem('__pdd_goods_cache', JSON.stringify(Array.from(capturedGoodsIds)));
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        });
        
        return originalSend.apply(xhr, args);
      };
      
      return xhr;
    };
    window.XMLHttpRequest = XHR;
  }
  
  // 优化的日志函数
  function log(...args) {
    if (PERF_CONFIG.enableDebugLog) {
      console.log('[PDD监控]', ...args);
    }
  }
  
  function logWarn(...args) {
    console.warn('[PDD监控]', ...args);
  }
  
  function logError(...args) {
    console.error('[PDD监控]', ...args);
  }
  
  // 检测是否在视频上传列表页面（通过页面元素判断）
  let lastCheckResult = null;
  let lastCheckTime = 0;
  
  function isVideoUploadListPage() {
    // 如果body不存在，直接返回false（不缓存）
    if (!document.body) {
      return false;
    }
    
    // 缓存结果，500ms内不重复检测
    const now = Date.now();
    if (now - lastCheckTime < 500 && lastCheckResult !== null) {
      return lastCheckResult;
    }
    
    // 检测页面上的关键元素
    const bodyText = document.body.innerText || '';
    const hasPublishVideoTitle = bodyText.includes('发布视频') || 
                                  bodyText.includes('上传视频') ||
                                  bodyText.includes('视频上传') ||
                                  bodyText.includes('多多视频') ||
                                  bodyText.includes('回放管理') ||
                                  bodyText.includes('商品回放');
    const hasVideoListContainer = document.querySelector('.publish-video_wrap__kUMuC, [class*="publish-video"], [class*="video-list"], [class*="duo-video"], [class*="replay-manage"], [class*="replayManage"]') !== null;
    const hasUploadButton = document.querySelector('.video-list_addVideo__Z5Cwo, [class*="addVideo"], [class*="add-video"], [class*="upload-btn"]') !== null;
    const hasAddGoodsSection = document.querySelector('.video-list_addGoods__NjBfL, [class*="addGoods"], [class*="选择推广商品"]') !== null;
    
    const result = hasPublishVideoTitle || hasVideoListContainer || hasUploadButton || hasAddGoodsSection;
    
    // 缓存结果
    lastCheckResult = result;
    lastCheckTime = now;
    
    return result;
  }
  
  // 检测是否在视频选择页面
  function isVideoSelectPage() {
    // 延迟检测：等待body完全加载
    if (!document.body) return false;
    const bodyText = document.body.innerText || '';
    return bodyText.includes('选择视频') ||
           document.querySelector('[class*="select-video"], [class*="video-select"]') !== null;
  }

  // ★★★ 延迟检测：避免在React渲染过程中读取DOM ★★★
  // 不在脚本开始时立即检测，改为在addPanel调用时检测
  let isTargetPage = false;  // 初始值设为false，等待延迟检测

  // URL检测（不涉及DOM，可以立即执行）- 使用已有的currentUrl变量
  const isUrlMatched = currentUrl.includes('/video/') ||
                       currentUrl.includes('/creator/video/') ||
                       currentUrl.includes('/n-creator/video/') ||
                       currentUrl.includes('/mms/video/') ||
                       currentUrl.includes('/duo-video');

  console.log('[PDD监控] URL检测结果:', isUrlMatched, 'URL:', currentUrl);
  
  let allVideos = [];
  let historyData = {};
  let panelAdded = false;
  let autoUploadConfig = null; // 提前声明，供SPA监听使用
  let isAutoUploading = false; // 提前声明，供SPA监听使用
  let autoUploadIndex = 0; // 提前声明，供SPA监听使用
  let isBatchFilling = false; // 批量填充模式，减少日志输出
  let isWaitingForUpload = false; // 防止重复调用 waitForAllVideosUploadAndFill
  let currentAccountId = null; // 当前账号ID
  let capturedGoodsList = []; // 从API拦截捕获的商品列表
  
  // 商品列表事件委托容器（只绑定一次）
  let goodsListEventBound = false;
  
  // 全局商品列表渲染函数（供事件监听器调用）
  function updateGoodsListUI() {
    const goodsListEl = document.getElementById('pdd-goods-list');
    if (!goodsListEl || capturedGoodsList.length === 0) return;

    // 检查是否需要更新
    const currentItems = goodsListEl.querySelectorAll('.pdd-goods-item');
    if (currentItems.length === capturedGoodsList.length && currentItems.length > 0) return;

    const fragment = document.createDocumentFragment();

    capturedGoodsList.forEach((item, index) => {
      const id = item.goodsId || item.goods_id || item.productId || item.id;
      const name = item.goodsName || item.goods_name || item.productName || item.name || `商品 ${id}`;
      const image = item.goodsImage || item.imageUrl || item.image || item.cover || item.thumbUrl || item.pic_url || '';

      const div = document.createElement('div');
      div.className = 'pdd-goods-item';
      div.dataset.goodsId = id;
      div.dataset.index = index;
      div.style.cssText = 'display:flex;align-items:center;padding:10px 12px;background:#fff;border-bottom:1px solid #f5f5f5;cursor:pointer;transition:all 0.15s ease;';
      div.innerHTML = `
        <div style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:#f8f8f8;flex-shrink:0;border:1px solid #eee;">
          ${image ? `<img src="${image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#ddd;font-size:22px;">📦</div>'}
        </div>
        <div style="flex:1;margin-left:12px;overflow:hidden;min-width:0;">
          <div style="font-size:13px;color:#1a1a1a;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4;font-weight:500;">${name}</div>
          <div style="margin-top:5px;display:inline-block;padding:2px 8px;background:#fff0f0;border-radius:6px;font-size:11px;font-weight:700;color:#dc2626;font-family:monospace;letter-spacing:0.3px;border:1px solid #fecaca;">${id}</div>
        </div>
        <button class="pdd-publish-btn" data-index="${index}" style="margin-left:10px;padding:7px 16px;background:linear-gradient(135deg,#e02e24,#c7261d);color:white;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;flex-shrink:0;white-space:nowrap;transition:all 0.15s;box-shadow:0 2px 6px rgba(224,46,36,0.25);">选择</button>
      `;
      fragment.appendChild(div);
    });

    goodsListEl.innerHTML = '';
    goodsListEl.appendChild(fragment);

    // 更新计数
    const countEl = document.getElementById('pdd-goods-count');
    if (countEl) {
      countEl.textContent = `(${capturedGoodsList.length}个)`;
    }

    // 搜索功能
    const searchInput = document.getElementById('pdd-goods-search');
    if (searchInput && !searchInput._searchBound) {
      searchInput._searchBound = true;
      let searchTimer = null;
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          const keyword = this.value.toLowerCase().trim();
          const allItems = goodsListEl.querySelectorAll('.pdd-goods-item');
          let visibleCount = 0;
          allItems.forEach(item => {
            const name = item.querySelector('[style*="font-size:13px"]')?.textContent?.toLowerCase() || '';
            const idText = item.dataset.goodsId?.toLowerCase() || '';
            const match = !keyword || name.includes(keyword) || idText.includes(keyword);
            item.style.display = match ? 'flex' : 'none';
            if (match) visibleCount++;
          });
          // 更新计数显示过滤后数量
          if (keyword && countEl) {
            countEl.textContent = `(${visibleCount}/${capturedGoodsList.length}个)`;
          } else if (countEl) {
            countEl.textContent = `(${capturedGoodsList.length}个)`;
          }
        }, 150);
      });
    }

    // 事件委托（只绑定一次）
    if (!goodsListEventBound) {
      goodsListEventBound = true;

      goodsListEl.addEventListener('click', function(e) {
        // 点击选择按钮
        const btn = e.target.closest('.pdd-publish-btn');
        if (btn) {
          e.stopPropagation();
          e.preventDefault();
          const index = parseInt(btn.dataset.index);
          const goods = capturedGoodsList[index];
          if (goods && window.__selectGoodsForPublish) {
            window.__selectGoodsForPublish(goods);
          }
          return;
        }
        // 点击整行也选择
        const item = e.target.closest('.pdd-goods-item');
        if (item && !e.target.closest('.pdd-publish-btn')) {
          const goodsId = item.dataset.goodsId;
          const goodsItem = capturedGoodsList.find(g => (g.goodsId || g.goods_id || g.productId || g.id) == goodsId);
          if (goodsItem && window.__selectGoodsForPublish) {
            window.__selectGoodsForPublish(goodsItem);
          }
        }
      });

      // hover 效果
      goodsListEl.addEventListener('mouseover', function(e) {
        const item = e.target.closest('.pdd-goods-item');
        if (item) {
          item.style.background='#fef2f2';
          item.style.borderColor='#fecaca';
        }
        const btn = e.target.closest('.pdd-publish-btn');
        if (btn) {
          btn.style.transform='translateY(-1px)';
          btn.style.boxShadow='0 4px 12px rgba(224,46,36,0.35)';
        }
      });

      goodsListEl.addEventListener('mouseout', function(e) {
        const item = e.target.closest('.pdd-goods-item');
        if (item) {
          item.style.background='#fff';
          item.style.borderColor='transparent';
        }
        const btn = e.target.closest('.pdd-publish-btn');
        if (btn) {
          btn.style.transform='';
          btn.style.boxShadow='0 2px 6px rgba(224,46,36,0.25)';
        }
      });
    }
  }
  
  // 资源清理跟踪
  const activeResources = {
    observers: [],
    intervals: [],
    timeouts: [],
    eventListeners: [],
    maxVideosCache: 200, // 限制视频缓存数量（减小防止内存泄漏）
    maxHistoryCache: 100   // 限制历史记录数量（减小防止内存泄漏）
  };
  
  // 安全清理函数
  // 从文件名中提取数字格式（如 3-1, 12-34, x-xx 等格式）
  function extractNumberSuffix(fileName) {
    try {
      if (!fileName || typeof fileName !== 'string') return '';
      const safeFileName = fileName.length > 500 ? fileName.slice(-500) : fileName;
      const baseName = safeFileName.replace(/\.[^/.]+$/, '');
      
      // 过滤掉看起来像时长的格式（如 6-8 表示6分8秒）
      // 时长格式特征：单个数字-单个数字，且数字都在0-9范围内
      const durationPattern = /^\d-[0-9]$/;
      
      // 优先匹配末尾的数字-数字格式（如 video-3-1 中的 3-1）
      let match = baseName.match(/(\d+-\d+)$/);
      if (match && !durationPattern.test(match[1])) {
        console.log('[PDD监控] extractNumberSuffix: 从文件名', fileName, '提取到编号:', match[1]);
        return match[1];
      }
      
      // 其次匹配文件名中的数字-数字格式（如 3-1-video 中的 3-1）
      match = baseName.match(/(\d+-\d+)/);
      if (match && !durationPattern.test(match[1])) {
        console.log('[PDD监控] extractNumberSuffix: 从文件名', fileName, '提取到编号:', match[1]);
        return match[1];
      }
      
      // 最后尝试匹配独立的数字（如 video-001 中的 001）
      match = baseName.match(/(\d{2,})$/);
      if (match) {
        console.log('[PDD监控] extractNumberSuffix: 从文件名', fileName, '提取到编号:', match[1]);
        return match[1];
      }
      
      console.log('[PDD监控] extractNumberSuffix: 文件名', fileName, '未匹配到有效编号');
      return '';
    } catch (e) {
      console.error('[PDD监控] extractNumberSuffix 错误:', e);
      return '';
    }
  }
  
  // 限制数组大小防止内存泄漏
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
  
  // 检查店铺名称是否有效（过滤掉干扰文本）
  function isValidShopName(shopName) {
    if (!shopName || shopName.length === 0 || shopName.length > 50) {
      return false;
    }
    // 过滤掉包含干扰关键词的文本
    const invalidKeywords = [
      '提现页面',
      '还是出现',
      '视频剪辑',
      '品牌、款式',
      '一致性',
      '请保证',
      '商品的一致性'
    ];
    for (const keyword of invalidKeywords) {
      if (shopName.includes(keyword)) {
        console.log('[PDD监控] 店铺名称包含无效关键词，已过滤:', shopName);
        return false;
      }
    }
    return true;
  }
  
  // 获取当前店铺名称（作为唯一标识）- 带缓存
  let cachedAccountId = null;
  let accountIdCacheTime = 0;
  const ACCOUNT_ID_CACHE_DURATION = 30000; // 缓存 30 秒
  
  function getCurrentAccountId() {
    // 使用缓存，避免频繁 DOM 查询
    const now = Date.now();
    if (cachedAccountId && (now - accountIdCacheTime < ACCOUNT_ID_CACHE_DURATION)) {
      return cachedAccountId;
    }
    
    try {
      // 方法1: 从页面头部用户区域获取店铺名称
      const shopNameSelectors = [
        '.header_name__V7eDT',
        '.header_userInfo__QkoVe .header_name__V7eDT',
        '[class*="header_name"]',
        '.shop-name',
        '.store-name',
        '.merchant-name',
        '[data-shop-name]',
        '[data-mall-name]'
      ];
      for (const selector of shopNameSelectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            const shopName = element.textContent?.trim();
            if (isValidShopName(shopName)) {
              // 更新缓存
              cachedAccountId = shopName;
              accountIdCacheTime = now;
              // 保存到localStorage作为备用
              localStorage.setItem('pdd_last_shop_name', shopName);
              return shopName;
            }
          }
        } catch (e) {
          // 静默失败
        }
      }
      
      // 方法2: 从页面标题获取店铺名称
      const pageTitle = document.title;
      if (pageTitle) {
        // 提取"XXX - 拼多多"或"XXX店铺"格式的名称
        const titleMatch = pageTitle.match(/^([^-\s]+)/);
        if (titleMatch && titleMatch[1] && titleMatch[1].length > 2) {
          const shopName = titleMatch[1].trim();
          if (isValidShopName(shopName)) {
            cachedAccountId = shopName;
            accountIdCacheTime = now;
            localStorage.setItem('pdd_last_shop_name', shopName);
            return shopName;
          }
        }
      }
      
      // 方法3: 从localStorage获取店铺名称
      const localStorageKeys = ['pdd_shop_name', 'pddShopName', 'shop_name', 'shopName', 
                                'mall_name', 'mallName', 'store_name', 'storeName'];
      for (const key of localStorageKeys) {
        const storedValue = localStorage.getItem(key);
        if (storedValue && storedValue !== 'null' && storedValue !== 'undefined') {
          if (isValidShopName(storedValue)) {
            cachedAccountId = storedValue;
            accountIdCacheTime = now;
            localStorage.setItem('pdd_last_shop_name', storedValue);
            return storedValue;
          }
        }
      }
      
      // 方法4: 从用户下拉菜单中获取店铺名称
      const userInfoSelectors = [
        '.header_userInfo__QkoVe',
        '.header_userInfoWrap__GWLLV',
        '[class*="header_userInfo"]'
      ];
      for (const selector of userInfoSelectors) {
        try {
          const userInfoEl = document.querySelector(selector);
          if (userInfoEl) {
            // 查找店铺名称（通常是第一个文本节点）
            const nameEl = userInfoEl.querySelector('.header_name__V7eDT, [class*="name"]');
            if (nameEl) {
              const shopName = nameEl.textContent?.trim();
              if (isValidShopName(shopName)) {
                cachedAccountId = shopName;
                accountIdCacheTime = now;
                localStorage.setItem('pdd_last_shop_name', shopName);
                return shopName;
              }
            }
          }
        } catch (e) {
          // 静默失败
        }
      }
      
      // 方法5: 从已保存的storage中获取上次店铺名称作为备用
      const lastShopName = localStorage.getItem('pdd_last_shop_name');
      if (lastShopName && lastShopName !== 'null' && lastShopName !== 'undefined') {
        if (isValidShopName(lastShopName)) {
          cachedAccountId = lastShopName;
          accountIdCacheTime = now;
          return lastShopName;
        }
      }
      
      return null;
    } catch (e) {
      return null;
    }
  }
  
  // 设置账号ID并同步数据
  async function setAccountIdAndSync() {
    let accountId = getCurrentAccountId();
    
    if (accountId && accountId !== currentAccountId) {
      currentAccountId = accountId;
      console.log('[PDD监控] 检测到店铺名称:', currentAccountId);
      
      // 保存店铺名称到localStorage，供下次使用
      localStorage.setItem('pdd_last_shop_name', currentAccountId);
      
      // 更新账号显示
      const accountInfoEl = document.getElementById('pdd-account-info');
      const currentAccountEl = document.getElementById('pdd-current-account');
      if (currentAccountEl) {
        currentAccountEl.textContent = currentAccountId;
      }
      if (accountInfoEl) {
        accountInfoEl.style.display = 'block';
      }
      
      // 通知background设置账号ID并加载数据
      chrome.runtime.sendMessage({
        action: 'setAccountId',
        accountId: currentAccountId
      }, (response) => {
        if (response && response.success) {
          console.log('[PDD监控] 店铺名称已同步');
          // 重新加载历史数据（可能包含跨浏览器数据）
          loadHistoryAndShow();
        }
      });
    }
  }
  
  // 从API响应中提取账号ID
  function extractAccountIdFromResponse(data) {
    if (!data) return null;
    
    const idFields = ['mallId', 'mall_id', 'userId', 'user_id', 'sellerId', 'seller_id',
                      'merchantId', 'merchant_id', 'shopId', 'shop_id', 'duoId', 'duo_id'];
    
    // 检查 result 层级
    if (data.result) {
      for (const field of idFields) {
        if (data.result[field] && data.result[field] !== 'null' && data.result[field] !== 'undefined') {
          return String(data.result[field]);
        }
      }
    }
    
    // 检查 data 层级
    if (data.data) {
      for (const field of idFields) {
        if (data.data[field] && data.data[field] !== 'null' && data.data[field] !== 'undefined') {
          return String(data.data[field]);
        }
      }
    }
    
    // 检查顶层
    for (const field of idFields) {
      if (data[field] && data[field] !== 'null' && data[field] !== 'undefined') {
        return String(data[field]);
      }
    }
    
    return null;
  }
  
  // 手动同步数据到本地存储
  // 监听SPA页面内容变化（使用轻量级轮询代替MutationObserver）
  let spaCheckInterval = null;
  let lastSpaCheckTime = 0;
  const SPA_CHECK_INTERVAL = 15000;
  let lastUrl = window.location.href;
  
  // 不再使用MutationObserver，改用轻量级轮询
  // const contentObserver = null; // 已禁用
  
  function checkSpaPageChange() {
    lastSpaCheckTime = Date.now();
    
    // 检测URL是否变化
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('[PDD监控] URL变化:', lastUrl, '->', currentUrl);
      lastUrl = currentUrl;
      
      // URL变化时重置缓存，确保重新检测页面
      lastCheckResult = null;
      lastCheckTime = 0;
      
      // 检测新页面是否为目标页面（数据页面或上传页面）
      const isDataPageNew = currentUrl.includes('/video/list') || 
                            currentUrl.includes('/video/data') || 
                            currentUrl.includes('/creator/video/list') || 
                            currentUrl.includes('/n-creator/video/list') ||
                            currentUrl.includes('/n-creator/video/mall-goods-video') ||
                            currentUrl.includes('/n-creator/video/home') ||
                            currentUrl.includes('/n-creator/video/replay-manage') ||
                            currentUrl.includes('/duo-video') ||
                            currentUrl.includes('/video/duo');
      const isUploadPageNew = currentUrl.includes('/video/publish') || 
                              currentUrl.includes('/creator/video/publish') || 
                              currentUrl.includes('/n-creator/video/publish') ||
                              currentUrl.includes('/n-creator/video/home') ||
                              currentUrl.includes('/n-creator/video/mall-goods-video') ||
                              currentUrl.includes('/n-creator/video/replay-manage') ||
                              currentUrl.includes('/duo-video') ||
                              currentUrl.includes('/video/duo');
      
      // 如果跳转到发布页面，检查是否有保存的商品信息需要恢复
      if (isUploadPageNew) {
        console.log('[PDD监控] SPA跳转到发布页面，检查是否需要恢复商品选择');
        // 延迟调用以确保页面元素加载
        setTimeout(() => {
          checkPublishPage();
        }, 500);
      }
      
      // 如果新页面不是目标页面，才移除面板
      if (panelAdded && !isDataPageNew && !isUploadPageNew) {
        console.log('[PDD监控] 切换到非目标页面，移除面板');
        panelAdded = false;
        // 清理所有定时器防止内存泄漏
        activeResources.intervals.forEach(id => {
          try { clearInterval(id); } catch(e) {}
        });
        activeResources.intervals = [];
        activeResources.timeouts.forEach(id => {
          try { clearTimeout(id); } catch(e) {}
        });
        activeResources.timeouts = [];
        // 移除旧面板
        const oldPanel = document.getElementById('pdd-video-monitor');
        const oldBall = document.getElementById('pdd-monitor-ball');
        if (oldPanel) oldPanel.remove();
        if (oldBall) oldBall.remove();
      }
    }
    
    // 如果面板已添加，不再重复检测
    if (panelAdded) {
      return;
    }
    
    // 检测页面内容是否变化到视频上传列表页面
    const isUpload = isVideoUploadListPage();
    if (isUpload) {
      console.log('[PDD监控] ★★★ SPA内容变化：检测到视频上传列表页面！');
      isTargetPage = true;
      addPanel();
    }
    
    // 检测是否从首页进入了视频上传页面，如果有待上传配置则开始上传
    if (isUpload && autoUploadConfig && autoUploadConfig.videos && autoUploadConfig.videos.length > 0 && isAutoUploading) {
      console.log('[PDD监控] 检测到视频上传页面且有待上传配置，开始上传...');
      // 创建上传进度面板
      if (!document.getElementById('pdd-auto-upload-panel')) {
        createAutoUploadPanel();
        // 开始上传第一个视频
        uploadNextVideo();
      }
    }
  }
  
  // 页面卸载时清理所有资源
  window.addEventListener('beforeunload', () => {
    console.log('[PDD监控] 页面卸载，清理资源...');
    // 断开所有observer
    activeResources.observers.forEach(obs => {
      try { obs.disconnect(); } catch(e) {}
    });
    // 清理所有interval
    activeResources.intervals.forEach(id => {
      try { clearInterval(id); } catch(e) {}
    });
    // 清理所有timeout
    activeResources.timeouts.forEach(id => {
      try { clearTimeout(id); } catch(e) {}
    });
  });
  
  // 页面加载后启动内容监听（使用轻量级轮询）
  let initCheckTimer = null;
  
  function performInitialCheck() {
    // 如果面板已添加，清理所有初始化定时器
    if (panelAdded) {
      if (initCheckTimer) {
        clearTimeout(initCheckTimer);
        initCheckTimer = null;
      }
      if (spaCheckInterval) {
        clearInterval(spaCheckInterval);
        const idx = activeResources.intervals.indexOf(spaCheckInterval);
        if (idx > -1) activeResources.intervals.splice(idx, 1);
        spaCheckInterval = null;
      }
      return;
    }
    
    if (!document.body) {
      initCheckTimer = setTimeout(performInitialCheck, 500);
      return;
    }
    
    // 检测是否是目标页面
    const isUpload = isVideoUploadListPage();
    console.log('[PDD监控] 初始化检测 - isVideoUploadListPage:', isUpload, 'panelAdded:', panelAdded);
    
    if (isUpload && !panelAdded) {
      console.log('[PDD监控] ★★★ 初始化检测：检测到视频上传列表页面！');
      isTargetPage = true;
      addPanel();
      return; // 添加面板后退出，不再启动轮询
    }
    
    // 如果不是目标页面，启动SPA轮询监听页面变化
    if (!spaCheckInterval) {
      spaCheckInterval = setInterval(() => {
        if (panelAdded) {
          clearInterval(spaCheckInterval);
          const idx = activeResources.intervals.indexOf(spaCheckInterval);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          spaCheckInterval = null;
          console.log('[PDD监控] 面板已添加，停止SPA轮询');
          return;
        }
        checkSpaPageChange();
      }, SPA_CHECK_INTERVAL);
      activeResources.intervals.push(spaCheckInterval);
      console.log('[PDD监控] 已启动SPA内容变化轮询');
    }
  }
  
  // 延迟启动初始化检测
  setTimeout(performInitialCheck, 1000);
  
  // 页面加载完成后，从服务器加载历史数据（可选）
  setTimeout(() => {
    loadHistoryFromServer().catch(err => {
      console.log('[PDD监控] 服务器连接失败，使用本地数据');
    }).finally(() => {
      updatePanel();
    });
  }, 1000);
  
  // 检查是否有待上传的配置
  setTimeout(async () => {
    // 检查两种配置格式
    const savedConfig1 = localStorage.getItem('pdd_batch_publish_config');
    const savedConfig2 = localStorage.getItem('__pdd_publish_config');
    
    if (savedConfig1) {
      try {
        const config = JSON.parse(savedConfig1);
        if (config && config.enabled && config.videos && config.videos.length > 0) {
          console.log('[PDD监控] 检测到待上传配置（格式1），准备自动上传');
          // 清除配置，避免重复触发
          config.enabled = false;
          localStorage.setItem('pdd_batch_publish_config', JSON.stringify(config));
          // 触发自动上传
          startAutoUpload(config);
        }
      } catch (e) {
        console.error('[PDD监控] 解析配置失败:', e);
      }
    } else if (savedConfig2) {
      // 格式2：使用 IndexedDB 存储文件
      try {
        const config = JSON.parse(savedConfig2);
        if (config && config.enabled && config.videoFiles && config.videoFiles.length > 0) {
          console.log('[PDD监控] 检测到待上传配置（格式2，IndexedDB），准备自动上传');
          // 从 IndexedDB 读取文件
          const videos = await loadVideosFromDB(config.videoFiles.length, config.pidList);
          if (videos.length > 0) {
            config.videos = videos;
            // 清除配置，避免重复触发
            config.enabled = false;
            localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
            // 触发自动上传
            startAutoUpload(config);
          } else {
            console.error('[PDD监控] 从 IndexedDB 读取视频失败');
          }
        }
      } catch (e) {
        console.error('[PDD监控] 解析配置失败:', e);
      }
    }
  }, 3000);
  
  let currentPage = 0;
  let totalPages = 0;
  let totalCount = 0;
  let isAutoPaging = false;
  let autoPagingInterval = null;
  let isSyncing = false;
  let syncingVideoIds = new Set();
  let syncProgress = { current: 0, total: 0, created: 0, updated: 0, skipped: 0, failed: 0 };
  let syncQueue = []; // 同步队列
  let capturedVideoUrls = {};
  let filterSettings = { search: '', dateStart: '', dateEnd: '', sortBy: '' };
  let syncHistory = [];
  let currentFilteredVideos = [];
  const API_BASE_URL = 'http://localhost:3000/api';
  const DEFAULT_EDITOR_ID = 61;
  
  let config = {
    apiUrl: API_BASE_URL,
    editorId: DEFAULT_EDITOR_ID,
    minPlays: 200,
    minOrders: 1,
    syncInterval: 50,
    panelWidth: 480,
    panelHeight: 85
  };
  
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;
    
    if (event.data && event.data.type === 'PDD_API_INTERCEPTED') {
      const record = event.data.data;
      
      if (record.hasVideo) {
        processVideoData(record.response);
      }
    }
    
    if (event.data && event.data.type === 'PDD_VIDEO_URL_CAPTURED') {
      const videoId = event.data.videoId;
      const videoUrl = event.data.videoUrl;
      capturedVideoUrls[videoId] = videoUrl;
      limitObjectSize(capturedVideoUrls, 500);
      console.log('[PDD监控] 捕获视频URL:', videoId, '->', videoUrl);
      
      updateVideoUrl(videoId, videoUrl);
    }
    
    if (event.data && event.data.type === 'PDD_GOODS_IDS_CAPTURED') {
      const goodsIds = event.data.goodsIds;
      
      if (goodsIds && goodsIds.length > 0) {
        // 合并新旧数据，避免翻页后数据丢失
        const existingMap = new Map(capturedGoodsList.map(g => [g.goodsId || g.goods_id || g.id, g]));
        let newCount = 0;
        goodsIds.forEach(g => {
          const id = g.goodsId || g.goods_id || g.id;
          if (!existingMap.has(id)) {
            newCount++;
          }
          existingMap.set(id, g);
        });
        capturedGoodsList = Array.from(existingMap.values());
        
        if (!isBatchFilling && newCount > 0) {
          console.log('[PDD监控] 商品列表更新: 总数', capturedGoodsList.length, '新增', newCount);
        }
        
        sessionStorage.setItem('__pdd_goods_list_cache', JSON.stringify(capturedGoodsList));
        
        // 使用全局函数更新UI
        updateGoodsListUI();
        
        // 更新状态显示
        const statusEl = document.getElementById('pdd-goods-status');
        if (statusEl && newCount > 0) {
          statusEl.innerHTML = `<span style="color:#4caf50;">● 已更新 +${newCount}</span>`;
          setTimeout(() => {
            if (statusEl) {
              statusEl.innerHTML = '<span style="color:#4caf50;">● 自动更新</span>';
            }
          }, 3000);
        }
      }
    }
    
    // 监听从inject.js传来的账号ID（已禁用，统一使用店铺名称）
    // 注意：账号ID现在统一由getCurrentAccountId()从页面元素获取店铺名称
    // 避免不同浏览器使用数字ID和店铺名称导致数据无法共享
    if (event.data && event.data.type === 'PDD_ACCOUNT_ID_FOUND') {
      // 优先使用从页面获取的店铺名称（使用缓存版本）
      const shopName = getCurrentAccountId();
      if (shopName && shopName !== currentAccountId) {
        currentAccountId = shopName;
        localStorage.setItem('pdd_last_account_id', currentAccountId);
        
        // 更新账号显示
        const accountInfoEl = document.getElementById('pdd-account-info');
        const currentAccountEl = document.getElementById('pdd-current-account');
        if (currentAccountEl) {
          currentAccountEl.textContent = currentAccountId;
        }
        if (accountInfoEl) {
          accountInfoEl.style.display = 'block';
        }
        
        // 通知background设置账号ID
        chrome.runtime.sendMessage({
          action: 'setAccountId',
          accountId: currentAccountId
        });
      }
    }
    
    // 监听商品ID捕获事件
    if (event.data && event.data.type === 'PDD_GOODS_IDS_CAPTURED') {
      const goodsIds = event.data.goodsIds || [];
      const url = event.data.url || '';
      
      if (goodsIds.length > 0) {
        // 存储商品ID到全局变量
        window.__pddCapturedGoodsIds = window.__pddCapturedGoodsIds || [];
        
        // 合并新捕获的商品ID，去重
        const existingIds = new Set(window.__pddCapturedGoodsIds.map(g => g.goodsId));
        goodsIds.forEach(g => {
          if (!existingIds.has(g.goodsId)) {
            window.__pddCapturedGoodsIds.push(g);
            existingIds.add(g.goodsId);
          }
        });
        
        // 保存到 sessionStorage
        try {
          sessionStorage.setItem('__pdd_goods_cache', JSON.stringify(window.__pddCapturedGoodsIds));
        } catch (e) {}
        
        // 保存到 chrome.storage.local
        try {
          chrome.storage.local.get(['pdd_goods_cache'], (result) => {
            const existing = result.pdd_goods_cache || [];
            const mergedMap = new Map();
            
            existing.forEach(g => mergedMap.set(g.goodsId, g));
            goodsIds.forEach(g => mergedMap.set(g.goodsId, g));
            
            const merged = Array.from(mergedMap.values());
            chrome.storage.local.set({ pdd_goods_cache: merged });
          });
        } catch (e) {}
        
        // 仅在非批量填充模式下输出日志
        if (!isBatchFilling && window.__pddCapturedGoodsIds.length % 20 === 0) {
          console.log('[PDD监控] 已捕获商品ID:', window.__pddCapturedGoodsIds.length, '个');
        }
      }
    }
  });
  
  function updateVideoUrl(videoId, videoUrl) {
    const video = allVideos.find(v => {
      const id = v.feedId || '';
      return id.includes(videoId) || videoId.includes(id.substring(0, 16));
    });
    
    if (video && !video.videoUrl) {
      video.videoUrl = videoUrl;
      console.log('[PDD监控] 更新视频URL:', video.feedId, '->', videoUrl);
    }
  }
  
  function processVideoData(data) {
    try {
      // 尝试从API响应中提取账号ID
      if (!currentAccountId) {
        const extractedId = extractAccountIdFromResponse(data);
        if (extractedId) {
          console.log('[PDD监控] 从API响应中提取到账号ID:', extractedId);
          currentAccountId = extractedId;
          localStorage.setItem('pdd_last_account_id', extractedId);
          
          // 更新账号显示
          const accountInfoEl = document.getElementById('pdd-account-info');
          const currentAccountEl = document.getElementById('pdd-current-account');
          if (currentAccountEl) {
            currentAccountEl.textContent = currentAccountId;
          }
          if (accountInfoEl) {
            accountInfoEl.style.display = 'block';
          }
          
          // 通知background设置账号ID
          chrome.runtime.sendMessage({
            action: 'setAccountId',
            accountId: currentAccountId
          });
        }
      }
      
      const videos = extractVideos(data);
      
      if (videos.length > 0) {
        currentPage++;
        
        if (data.result) {
          totalCount = data.result.total || data.result.totalCount || totalCount;
          totalPages = data.result.totalPage || data.result.pageCount || totalPages;
        }
        
        const videoMap = new Map(allVideos.map(v => [v.feedId, v]));
        videos.forEach(video => {
          if (videoMap.has(video.feedId)) {
            Object.assign(videoMap.get(video.feedId), video);
          } else {
            allVideos.push(video);
            videoMap.set(video.feedId, video);
          }
        });
        
        // 限制数组大小防止内存泄漏
        limitArraySize(allVideos, activeResources.maxVideosCache);
        
        // 调试：打印第一个视频的完整数据，查看有哪些字段
        if (videos.length > 0) {
          console.log('[PDD监控] 第一个视频完整数据:', JSON.stringify(data.result.influenceVideoItemList?.[0] || data.result.list?.[0], null, 2));
        }
        
        saveVideoData(videos, () => {
          updatePanel();
        });
        
        console.log('[PDD监控] 第', currentPage, '页，新增', videos.length, '个视频，总计', allVideos.length, '个');
        
        // 统计审核状态
        const auditStats = { failed: 0, passed: 0, pending: 0, unknown: 0 };
        videos.forEach(v => {
          if (v.auditStatus === 'failed') auditStats.failed++;
          else if (v.auditStatus === 'passed') auditStats.passed++;
          else if (v.auditStatus === 'pending') auditStats.pending++;
          else auditStats.unknown++;
        });
        console.log('[PDD监控] 审核状态统计:', auditStats);
        
        if (isAutoPaging) {
          setTimeout(() => checkAndContinuePaging(), 500);
        }
      }
    } catch (e) {
      console.error('[PDD监控] 处理视频数据异常:', e);
    }
  }
  
  function parseGMV(value) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      value = value.trim();
      if (value.includes('万')) {
        return parseFloat(value.replace('万', '')) * 10000;
      }
      if (value.includes('亿')) {
        return parseFloat(value.replace('亿', '')) * 100000000;
      }
      return parseFloat(value) || 0;
    }
    return 0;
  }

  function extractVideos(data) {
    const videos = [];
    
    if (data.result) {
      if (data.result.influenceVideoItemList) {
        data.result.influenceVideoItemList.forEach((item) => {
          const fullDesc = item.desc || '无描述';
          
          videos.push({
            feedId: item.feedId || '',
            desc: fullDesc.substring(0, 6),
            fullDesc: fullDesc,
            coverUrl: item.coverUrl || '',
            videoUrl: item.videoUrl || item.url || item.playUrl || item.mp4Url || '',
            playCount: parseInt(item.playCountNum || item.playCount) || 0,
            orderCount: parseInt(item.orderCountNum || item.orderCount) || 0,
            orderAmount: parseGMV(item.totalGMV || item.gmv || item.orderAmountNum || item.orderAmount),
            shareCount: parseInt(item.shareCount) || 0,
            commentCount: parseInt(item.commentCount) || 0,
            date: formatVideoDate(item.createTime || item.publishTime || item.date || item.videoCreateTime || item.publishedAt || item.createdAt),
            auditStatus: extractAuditStatus(item)
          });
        });
      }

      if (data.result.list) {
        data.result.list.forEach((item) => {
          const fullDesc = item.desc || item.title || '无描述';
          
          videos.push({
            feedId: item.feedId || item.videoId || '',
            desc: fullDesc.substring(0, 6),
            fullDesc: fullDesc,
            coverUrl: item.coverUrl || '',
            videoUrl: item.videoUrl || item.url || item.playUrl || item.mp4Url || '',
            playCount: parseInt(item.playCount || item.playCountNum || item.pv) || 0,
            orderCount: parseInt(item.orderCount || item.orderNum) || 0,
            orderAmount: parseGMV(item.totalGMV || item.gmv || item.orderAmount),
            date: formatVideoDate(item.createTime || item.publishTime || item.date || item.videoCreateTime || item.publishedAt || item.createdAt),
            auditStatus: extractAuditStatus(item)
          });
        });
      }
    }
    
    return videos;
  }
  
  function extractAuditStatus(item) {
    // 从 API 数据中提取审核状态
    
    // 方法1: 直接检查 auditStatus 字段
    if (item.auditStatus) {
      const status = String(item.auditStatus).toLowerCase();
      if (status.includes('fail') || status.includes('reject') || status.includes('failed')) {
        return 'failed';
      }
      if (status.includes('pass') || status.includes('success') || status.includes('approved')) {
        return 'passed';
      }
      if (status.includes('pending') || status.includes('auditing')) {
        return 'pending';
      }
    }
    
    // 方法2: 根据 hasReject 字段判断
    if (item.hasReject === true) {
      return 'failed';
    }
    
    // 方法3: 根据 feedStatus 判断
    // feedStatus: 0 = 新建/待审核, 1 = 正常/通过, 2 = 审核中, 3 = 拒绝/失败
    if (item.feedStatus !== undefined && item.feedStatus !== null) {
      const feedStatus = parseInt(item.feedStatus);
      if (feedStatus === 1) {
        return 'passed';
      } else if (feedStatus === 2 || feedStatus === 0) {
        return 'pending';
      } else if (feedStatus === 3) {
        return 'failed';
      }
    }
    
    // 方法4: 检查 refuseReason 字段
    if (item.refuseReason && item.refuseReason.trim()) {
      return 'failed';
    }
    
    // 默认返回 passed（如果视频正常显示，通常是通过审核的）
    return 'passed';
  }
  
  function formatVideoDate(timestamp) {
    if (!timestamp) return null;
    
    if (typeof timestamp === 'number') {
      let date;
      if (timestamp > 1000000000000) {
        date = new Date(timestamp);
      } else {
        date = new Date(timestamp * 1000);
      }
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    
    if (typeof timestamp === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(timestamp)) {
        return timestamp.split('T')[0].split(' ')[0];
      }
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    }
    
    return null;
  }
  
  function saveVideoData(videos, callback) {
    if (!chrome.runtime || !chrome.runtime.id) {
      console.log('[PDD监控] 扩展上下文已失效，跳过保存');
      if (callback) callback();
      return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    
    try {
      chrome.storage.local.get(['videoHistory'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[PDD监控] 读取存储失败:', chrome.runtime.lastError);
          if (callback) callback();
          return;
        }
        
        const history = result.videoHistory || {};
        let hasNewData = false;
        let newVideoCount = 0;
        let updatedRecordCount = 0;
      
      videos.forEach(video => {
        if (!video.feedId) return;
        
        const isNewVideo = !history[video.feedId];
        
        if (isNewVideo) {
          history[video.feedId] = {
            desc: video.desc,
            coverUrl: video.coverUrl,
            auditStatus: video.auditStatus,
            records: [{
              date: today,
              time: now,
              playCount: video.playCount || 0,
              orderCount: video.orderCount || 0,
              orderAmount: video.orderAmount || 0
            }]
          };
          newVideoCount++;
          hasNewData = true;
          console.log(`[PDD监控] 🆕 新视频 ${video.feedId} 初始数据: 播放=${video.playCount}, 订单=${video.orderCount}, 金额=${video.orderAmount}`);
          return;
        }
        
        history[video.feedId].auditStatus = video.auditStatus;
        
        const lastRecord = history[video.feedId].records[history[video.feedId].records.length - 1];
        const lastDate = lastRecord ? lastRecord.date : null;
        const lastPlayCount = lastRecord ? lastRecord.playCount : 0;
        const lastOrderCount = lastRecord ? lastRecord.orderCount : 0;
        const lastOrderAmount = lastRecord ? lastRecord.orderAmount : 0;
        
        const playCountIncreased = video.playCount > lastPlayCount;
        const orderCountIncreased = video.orderCount >= lastOrderCount;
        const orderAmountIncreased = video.orderAmount >= lastOrderAmount;
        
        // 详细日志：显示抓取到的数据和历史数据
        if (lastRecord) {
          console.log(`[PDD监控] 💰 ${video.feedId} 金额对比: 抓取=${video.orderAmount} 历史=${lastOrderAmount} ${orderAmountIncreased ? '✅增加' : '⚠️下降'}`);
        }
        
        if (playCountIncreased) {
          // 订单数：只有新数据 >= 历史数据时才更新
          const newOrderCount = orderCountIncreased ? video.orderCount : lastOrderCount;
          // 金额：只有新数据 >= 历史数据时才更新（如果新金额 < 历史金额，保持历史金额）
          const newOrderAmount = orderAmountIncreased ? video.orderAmount : lastOrderAmount;
          
          console.log(`[PDD监控] 📊 ${video.feedId} 保存金额: ${newOrderAmount} (抓取=${video.orderAmount}, 历史=${lastOrderAmount})`);
          
          history[video.feedId].records.push({
            date: today,
            time: now,
            playCount: video.playCount,
            orderCount: newOrderCount,
            orderAmount: newOrderAmount
          });
          
          history[video.feedId].records = history[video.feedId].records.slice(-60);
          updatedRecordCount++;
          hasNewData = true;
          
          const playGrowth = video.playCount - lastPlayCount;
          console.log(`[PDD监控] 视频 ${video.feedId} 播放量变化: ${lastPlayCount} → ${video.playCount} (增量: +${playGrowth})`);
          
          if (!orderCountIncreased) {
            console.log(`[PDD监控] 订单数未增加(新${video.orderCount} < 历${lastOrderCount})，保持历史数据: ${lastOrderCount}`);
          }
          if (!orderAmountIncreased) {
            console.log(`[PDD监控] ⚠️ 金额未增加(新${video.orderAmount} < 历${lastOrderAmount})，保持历史数据: ${lastOrderAmount}`);
          }
        }
        
        if (!playCountIncreased && lastRecord) {
          const orderCountChanged = video.orderCount !== lastOrderCount;
          const orderAmountChanged = video.orderAmount !== lastOrderAmount;
          
          // 只有当订单数和金额都增加时才更新
          if ((orderCountChanged || orderAmountChanged) && orderCountIncreased && orderAmountIncreased) {
            lastRecord.orderCount = video.orderCount;
            lastRecord.orderAmount = video.orderAmount;
            lastRecord.time = now;
            updatedRecordCount++;
            hasNewData = true;
            console.log(`[PDD监控] 订单数据变化(订单:${lastOrderCount}→${video.orderCount}, 金额:${lastOrderAmount}→${video.orderAmount})`);
          } else if (orderAmountChanged && !orderAmountIncreased) {
            console.log(`[PDD监控] ⚠️ 金额下降不同步(新${video.orderAmount} < 历${lastOrderAmount})`);
          }
        }
        
        history[video.feedId].desc = video.desc;
        history[video.feedId].coverUrl = video.coverUrl;
      });
      
      // 限制历史数据大小防止内存泄漏
      limitObjectSize(history, activeResources.maxHistoryCache);
      
      historyData = history;
        chrome.storage.local.set({ videoHistory: history }, () => {
          if (chrome.runtime.lastError) {
            console.error('[PDD监控] 保存存储失败:', chrome.runtime.lastError);
          }
          
          if (hasNewData && currentAccountId) {
            scheduleNativeSync();
          }
          
          sendToServer(videos);
          
          if (callback) callback();
        });
      });
    } catch (e) {
      console.error('[PDD监控] 保存数据异常:', e);
      if (callback) callback();
    }
  }
  
  let nativeSyncTimeout = null;
  let pendingSyncData = null;
  const NATIVE_SYNC_DELAY = 3000;
  
  function scheduleNativeSync() {
    if (nativeSyncTimeout) {
      clearTimeout(nativeSyncTimeout);
    }
    
    nativeSyncTimeout = setTimeout(() => {
      performNativeSync();
    }, NATIVE_SYNC_DELAY);
  }
  
  function performNativeSync() {
    if (!currentAccountId) return;
    
    chrome.runtime.sendMessage({ action: 'syncNow' }, (response) => {
      if (response && response.success) {
        console.log('[PDD监控] 已自动同步到本地存储');
        const lastSyncEl = document.getElementById('pdd-last-sync');
        if (lastSyncEl) {
          lastSyncEl.textContent = new Date().toLocaleTimeString();
        }
      }
      nativeSyncTimeout = null;
    });
  }
  
  async function sendToServer(videos) {
    return;
  }
  
  // 从服务器加载历史数据
  async function loadHistoryFromServer() {
    try {
      // 添加超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE_URL}/history`, {
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      // 如果请求失败或服务器未响应，直接返回（静默失败）
      if (!response || !response.ok) {
        return null;
      }

      const serverHistory = await response.json();
      console.log('[PDD监控] 从服务器加载历史数据:', serverHistory.length, '条记录');
      
      if (serverHistory && serverHistory.length > 0) {
        // 转换服务器数据格式为扩展使用的格式
        const convertedHistory = {};
        
        serverHistory.forEach(record => {
          if (record.videos) {
            record.videos.forEach(video => {
              const feedId = video.goods_id || video.feedId;
              if (!feedId) return;
              
              if (!convertedHistory[feedId]) {
                convertedHistory[feedId] = {
                  desc: video.goods_name || video.desc || '',
                  coverUrl: video.cover_url || video.coverUrl || '',
                  auditStatus: video.auditStatus || null,
                  records: []
                };
              }
              
              // 添加记录
              convertedHistory[feedId].records.push({
                date: record.timestamp ? record.timestamp.split('T')[0] : new Date().toISOString().split('T')[0],
                time: record.timestamp || new Date().toISOString(),
                playCount: video.pv || video.playCount || 0,
                orderCount: video.orderCount || 0,
                orderAmount: video.orderAmount || 0
              });
              
              // 更新审核状态（使用最新的）
              if (video.auditStatus) {
                convertedHistory[feedId].auditStatus = video.auditStatus;
              }
            });
          }
        });
        
        // 合并到本地历史数据
        // 关键：检查金额，如果服务器数据的金额比本地低，则不同步金额
        for (const feedId in convertedHistory) {
          const serverVideo = convertedHistory[feedId];
          const localVideo = historyData[feedId];
          
          if (!localVideo) {
            // 本地没有这个视频，直接使用服务器数据
            historyData[feedId] = serverVideo;
            console.log(`[PDD监控] 从服务器加载新视频: ${feedId}`);
          } else {
            // 本地已有这个视频，需要智能合并
            const serverRecords = serverVideo.records || [];
            const localRecords = localVideo.records || [];
            
            // 创建记录映射，按日期合并
            const recordMap = new Map();
            
            // 先添加本地记录
            localRecords.forEach(r => {
              const key = r.date || r.time;
              if (key) recordMap.set(key, { ...r });
            });
            
            // 再合并服务器记录（关键：检查金额）
            serverRecords.forEach(r => {
              const key = r.date || r.time;
              if (key) {
                if (!recordMap.has(key)) {
                  // 本地没有这条记录，直接添加
                  recordMap.set(key, { ...r });
                } else {
                  // 本地已有这条记录，需要比较金额
                  const existing = recordMap.get(key);
                  
                  // 播放量：取最大值
                  if ((r.playCount || 0) > (existing.playCount || 0)) {
                    existing.playCount = r.playCount;
                  }
                  
                  // 订单数：取最大值
                  if ((r.orderCount || 0) > (existing.orderCount || 0)) {
                    existing.orderCount = r.orderCount;
                  }
                  
                  // 金额：只有服务器金额 >= 本地金额时才更新
                  const serverAmount = r.orderAmount || 0;
                  const localAmount = existing.orderAmount || 0;
                  if (serverAmount >= localAmount) {
                    existing.orderAmount = r.orderAmount;
                    console.log(`[PDD监控] 💰 服务器同步 ${feedId} ${key}: ${localAmount} → ${serverAmount}`);
                  } else {
                    console.log(`[PDD监控] ⚠️ 服务器金额<本地，不同步 ${feedId} ${key}: 服务器=${serverAmount} 本地=${localAmount}`);
                  }
                  
                  // 点赞数：取最大值
                  if ((r.likes || 0) > (existing.likes || 0)) {
                    existing.likes = r.likes;
                  }
                }
              }
            });
            
            // 更新记录
            historyData[feedId].records = Array.from(recordMap.values())
              .sort((a, b) => new Date(a.date || a.time) - new Date(b.date || b.time));
            
            // 更新其他字段
            if (serverVideo.desc && !historyData[feedId].desc) {
              historyData[feedId].desc = serverVideo.desc;
            }
            if (serverVideo.coverUrl && !historyData[feedId].coverUrl) {
              historyData[feedId].coverUrl = serverVideo.coverUrl;
            }
          }
        }
        
        // 保存到 Chrome Storage
        chrome.storage.local.set({ videoHistory: historyData }, () => {
          console.log('[PDD监控] 服务器历史数据已智能合并到本地（金额已保护）');
        });
        
        return convertedHistory;
      }
    } catch (error) {
      // 静默处理所有错误，不影响页面正常运行
      console.log('[PDD监控] 服务器连接失败，使用本地数据');
    }
    
    return null;
  }
  
  function getVideoGrowth(feedId) {
    const history = historyData[feedId];
    if (!history) {
      return null;
    }
    
    // 兼容旧数据：支持 records 和 history 两种字段名
    let records = history.records || history.history || [];
    if (records.length < 2) {
      return null;
    }
    
    const currentRecord = records[records.length - 1];
    const prevRecord = records[records.length - 2];
    
    const playGrowth = (currentRecord.playCount || 0) - (prevRecord.playCount || 0);
    const orderGrowth = (currentRecord.orderCount || 0) - (prevRecord.orderCount || 0);
    const amountGrowth = (currentRecord.orderAmount || 0) - (prevRecord.orderAmount || 0);
    
    return {
      playGrowth: playGrowth,
      orderGrowth: orderGrowth,
      amountGrowth: amountGrowth,
      prevPlayCount: prevRecord.playCount || 0,
      prevOrderCount: prevRecord.orderCount || 0,
      prevOrderAmount: prevRecord.orderAmount || 0,
      prevDate: prevRecord.date || '',
      currentDate: currentRecord.date || ''
    };
  }
  
  function startAutoPaging() {
    if (isAutoPaging) return;
    
    isAutoPaging = true;
    updatePanel();
    
    console.log('[PDD监控] 开始自动翻页...');
    
    let pageCount = 0;
    let lastVideoCount = 0;
    let noChangeCount = 0;
    const MAX_NO_CHANGE = 3; // 连续3次没有变化就停止
    
    autoPagingInterval = setInterval(() => {
      // 检查视频数量是否变化
      const currentVideoCount = allVideos.length;
      if (currentVideoCount === lastVideoCount) {
        noChangeCount++;
        if (noChangeCount >= MAX_NO_CHANGE) {
          console.log('[PDD监控] 视频数量连续3次无变化，停止自动翻页');
          stopAutoPaging();
          return;
        }
      } else {
        noChangeCount = 0;
        lastVideoCount = currentVideoCount;
      }
      
      const nextBtn = findNextButton();
      
      if (nextBtn) {
        const isDisabled = nextBtn.disabled || 
                          nextBtn.classList.contains('disabled') ||
                          nextBtn.classList.contains('ant-pagination-disabled') ||
                          nextBtn.getAttribute('aria-disabled') === 'true';
        
        if (!isDisabled) {
          nextBtn.click();
          pageCount++;
          
          if (pageCount > 50) { // 减少到50页
            console.log('[PDD监控] 超过50页，停止自动翻页');
            stopAutoPaging();
          }
        } else {
          console.log('[PDD监控] 按钮已禁用，到达最后一页');
          stopAutoPaging();
        }
      } else {
        console.log('[PDD监控] 未找到下一页按钮');
        stopAutoPaging();
      }
    }, 3000); // 增加到3秒间隔
    activeResources.intervals.push(autoPagingInterval);
  }
  
  function stopAutoPaging() {
    isAutoPaging = false;
    if (autoPagingInterval) {
      clearInterval(autoPagingInterval);
      autoPagingInterval = null;
    }
    updatePanel();
    console.log('[PDD监控] 自动翻页已停止，共捕获', allVideos.length, '个视频');
  }
  
  function findNextButton() {
    // 首先尝试找到视频列表区域
    const videoContainerSelectors = [
      '[class*="video"][class*="list"]',
      '[class*="video"][class*="container"]',
      '[class*="influence"]',
      '[class*="consumer"][class*="video"]',
      '.video-flow-card',
      '.mall-video-list',
      '[class*="backbone"]',
      '[class*="goods"][class*="consumer"]'
    ];
    
    let videoContainer = null;
    for (const selector of videoContainerSelectors) {
      videoContainer = document.querySelector(selector);
      if (videoContainer) {
        console.log('[PDD监控] 找到视频容器:', selector);
        break;
      }
    }
    
    // 查找所有分页组件
    const allPaginations = document.querySelectorAll('.ant-pagination, .pagination, [class*="pagination"], [class*="page"]');
    console.log('[PDD监控] 找到', allPaginations.length, '个分页组件');
    
    // 遍历所有分页组件
    for (let i = 0; i < allPaginations.length; i++) {
      const pagination = allPaginations[i];
      console.log('[PDD监控] 检查第', i + 1, '个分页组件');
      
      // 方法1: 找下一页按钮
      let nextBtn = pagination.querySelector('.ant-pagination-next:not(.ant-pagination-disabled) button') ||
                   pagination.querySelector('.ant-pagination-next:not(.ant-pagination-disabled)') ||
                   pagination.querySelector('[class*="next"]:not([class*="disabled"])');
      
      if (nextBtn) {
        console.log('[PDD监控] 在第', i + 1, '个分页组件中找到下一页按钮');
        return nextBtn;
      }
      
      // 方法2: 找数字页码，点击当前页的下一页
      const currentPageBtn = pagination.querySelector('.ant-pagination-item-active, [class*="active"], [class*="current"]');
      if (currentPageBtn) {
        // 获取当前页码
        const currentText = currentPageBtn.textContent || currentPageBtn.innerText || '';
        const currentPageNum = parseInt(currentText.trim());
        
        if (!isNaN(currentPageNum)) {
          // 查找下一个数字的页码按钮
          const allPageBtns = pagination.querySelectorAll('button, a, li[class*="item"], [class*="page-item"]');
          for (const btn of allPageBtns) {
            const btnText = (btn.textContent || btn.innerText || '').trim();
            const btnPageNum = parseInt(btnText);
            
            if (btnPageNum === currentPageNum + 1) {
              console.log('[PDD监控] 在第', i + 1, '个分页组件中找到第', btnPageNum, '页按钮');
              return btn;
            }
          }
        }
      }
      
      // 方法3: 直接查找包含"下一页"文本的按钮
      const buttons = pagination.querySelectorAll('button, a');
      for (const btn of buttons) {
        const text = (btn.textContent || btn.innerText || '').trim();
        const ariaLabel = btn.getAttribute('aria-label') || '';
        
        if (text.includes('下一页') || ariaLabel.includes('下一页') || 
            text === '>' || text === '›' || text === '»') {
          const isDisabled = btn.disabled || 
                            btn.classList.contains('disabled') ||
                            btn.classList.contains('ant-pagination-disabled') ||
                            btn.getAttribute('aria-disabled') === 'true';
          
          if (!isDisabled) {
            console.log('[PDD监控] 在第', i + 1, '个分页组件中找到下一页按钮(通过文本)');
            return btn;
          }
        }
      }
    }
    
    console.log('[PDD监控] 未找到下一页按钮');
    return null;
  }
  
  function checkAndContinuePaging() {
    if (!isAutoPaging) return;
    
    const nextBtn = findNextButton();
    if (!nextBtn) {
      console.log('[PDD监控] 检查: 未找到下一页按钮');
      stopAutoPaging();
      return;
    }
    
    const isDisabled = nextBtn.disabled || 
                      nextBtn.classList.contains('disabled') ||
                      nextBtn.classList.contains('ant-pagination-disabled');
    
    if (isDisabled) {
      console.log('[PDD监控] 检查: 按钮已禁用');
      stopAutoPaging();
    }
  }
  
  function addPanel() {
    console.log('[PDD监控] addPanel 被调用，panelAdded:', panelAdded);
    if (panelAdded) {
      console.log('[PDD监控] 面板已添加，跳过');
      return;
    }

    // ★★★ 白名单模式：只在多多视频相关页面显示小羊助手 ★★★
    const currentUrl = window.location.href;
    const allowedPages = [
      '/n-creator/video/',     // 创作者视频页面（发布、列表、数据等）
      '/video/',               // 视频相关页面
      '/mms/video/',           // MMS视频页面
      '/creator/video/'        // 创作者视频页面（旧路径）
    ];
    const isAllowedPage = allowedPages.some(pattern => currentUrl.includes(pattern));

    if (!isAllowedPage) {
      console.log('[PDD监控] 当前非多多视频页面，不显示小羊助手:', currentUrl);
      return;  // 不创建悬浮球和面板
    }

    console.log('[PDD监控] 当前为多多视频页面，显示小羊助手:', currentUrl);

    panelAdded = true;
    console.log('[PDD监控] 开始创建悬浮球...');
    
    // 检测并设置账号ID
    setTimeout(() => {
      setAccountIdAndSync().catch(e => console.log('[PDD监控] 设置账号ID失败:', e));
    }, 1000);
    
    // 定期检测账号ID（处理账号切换）
    const accountIdCheckInterval = setInterval(() => {
      setAccountIdAndSync().catch(e => console.log('[PDD监控] 定期检测账号ID失败:', e));
    }, 30000);
    activeResources.intervals.push(accountIdCheckInterval);
    
    // 默认显示数据监控页面，添加上传页面切换功能
    let currentView = 'data'; // 'data' 或 'upload'
    
    // 创建导航栏按钮 - 小羊助手
    const ball = document.createElement('div');
    ball.id = 'pdd-monitor-ball';
    ball.innerHTML = `
      <div class="ball-icon">
        <svg viewBox="0 0 64 64" width="20" height="20" fill="none">
          <defs>
            <linearGradient id="sheepWool" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#ffffff"/>
              <stop offset="100%" stop-color="#f0f0f0"/>
            </linearGradient>
            <linearGradient id="sheepFace" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#fff5e6"/>
              <stop offset="100%" stop-color="#ffe8d4"/>
            </linearGradient>
          </defs>
          <ellipse cx="32" cy="38" rx="20" ry="16" fill="url(#sheepWool)"/>
          <circle cx="16" cy="32" r="9" fill="url(#sheepWool)"/>
          <circle cx="48" cy="32" r="9" fill="url(#sheepWool)"/>
          <circle cx="23" cy="23" r="10" fill="url(#sheepWool)"/>
          <circle cx="41" cy="23" r="10" fill="url(#sheepWool)"/>
          <circle cx="32" cy="18" r="11" fill="url(#sheepWool)"/>
          <ellipse cx="15" cy="25" rx="4" ry="7" fill="url(#sheepFace)" transform="rotate(-18 15 25)"/>
          <ellipse cx="49" cy="25" rx="4" ry="7" fill="url(#sheepFace)" transform="rotate(18 49 25)"/>
          <ellipse cx="32" cy="34" rx="13" ry="11" fill="url(#sheepFace)"/>
          <circle cx="27" cy="31" r="3" fill="#c7261d"/><circle cx="37" cy="31" r="3" fill="#c7261d"/>
          <circle cx="28" cy="30" r="1.1" fill="#fff"/><circle cx="38" cy="30" r="1.1" fill="#fff"/>
          <path d="M29 38 Q32 41 35 38" stroke="#c7261d" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <span class="ball-text">小羊助手</span>
      <div class="ball-badge" id="ball-count">0</div>
    `;
    
    // 创建展开的面板
    const panel = document.createElement('div');
    panel.id = 'pdd-video-monitor';
    
    // 面板 HTML - 包含数据监控和上传功能，通过显示/隐藏切换
    panel.innerHTML = `
      <div id="pdd-panel-header">
        <span class="title" id="pdd-panel-title">
          <svg width="24" height="24" viewBox="0 0 64 64" fill="none" style="vertical-align: middle; margin-right: 8px;">
            <!-- 小羊图标 - 简化版 -->
            <defs>
              <linearGradient id="panelSheepWool" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="100%" stop-color="#ffe8f0"/>
              </linearGradient>
              <linearGradient id="panelSheepFace" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#fff5e6"/>
                <stop offset="100%" stop-color="#ffe4c9"/>
              </linearGradient>
            </defs>
            <ellipse cx="32" cy="38" rx="20" ry="16" fill="url(#panelSheepWool)"/>
            <circle cx="16" cy="32" r="9" fill="url(#panelSheepWool)"/>
            <circle cx="48" cy="32" r="9" fill="url(#panelSheepWool)"/>
            <circle cx="23" cy="23" r="10" fill="url(#panelSheepWool)"/>
            <circle cx="41" cy="23" r="10" fill="url(#panelSheepWool)"/>
            <circle cx="32" cy="18" r="11" fill="url(#panelSheepWool)"/>
            <ellipse cx="15" cy="25" rx="4" ry="7" fill="url(#panelSheepFace)" transform="rotate(-18 15 25)"/>
            <ellipse cx="49" cy="25" rx="4" ry="7" fill="url(#panelSheepFace)" transform="rotate(18 49 25)"/>
            <ellipse cx="32" cy="34" rx="13" ry="11" fill="url(#panelSheepFace)"/>
            <circle cx="27" cy="31" r="3" fill="#333"/><circle cx="37" cy="31" r="3" fill="#333"/>
            <circle cx="28" cy="30" r="1.1" fill="#fff"/><circle cx="38" cy="30" r="1.1" fill="#fff"/>
            <path d="M29 38 Q32 41 35 38" stroke="#ff8888" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          </svg>
          视频数据监控
        </span>
        <div class="header-btns">
          <button id="pdd-nav-data-page" class="nav-btn active" title="视频数据监控">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="38" rx="18" ry="14" fill="#ffffff"/>
              <circle cx="16" cy="33" r="8" fill="#ffffff"/><circle cx="48" cy="33" r="8" fill="#ffffff"/>
              <circle cx="24" cy="25" r="9" fill="#ffffff"/><circle cx="40" cy="25" r="9" fill="#ffffff"/>
              <circle cx="32" cy="20" r="10" fill="#ffffff"/>
              <ellipse cx="32" cy="34" rx="11" ry="9" fill="#ffe4c9"/>
              <circle cx="28" cy="31.5" r="2.5" fill="#333"/><circle cx="36" cy="31.5" r="2.5" fill="#333"/>
            </svg>
          </button>
          <button id="pdd-nav-auto-upload" class="nav-btn" title="视频自动上传">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="38" rx="18" ry="14" fill="#ffffff"/>
              <circle cx="16" cy="33" r="8" fill="#ffffff"/><circle cx="48" cy="33" r="8" fill="#ffffff"/>
              <circle cx="24" cy="25" r="9" fill="#ffffff"/><circle cx="40" cy="25" r="9" fill="#ffffff"/>
              <circle cx="32" cy="20" r="10" fill="#ffffff"/>
              <path d="M28 12 L32 6 L36 12" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <line x1="32" y1="10" x2="32" y2="22" stroke="#fff" stroke-width="3" stroke-linecap="round"/>
              <rect x="24" y="26" width="16" height="14" rx="4" fill="#ff6b35"/>
            </svg>
          </button>
          <div style="width:1px;height:20px;background:rgba(255,255,255,0.3);margin:0 4px;border-radius:1px;"></div>
          <button id="pdd-settings" class="settings-btn" title="设置">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="settingsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#4facfe;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#00f2fe;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="24" fill="url(#settingsGrad)"/>
              <circle cx="32" cy="32" r="10" fill="#ffffff"/>
              <circle cx="32" cy="12" r="4" fill="#ffffff"/>
              <circle cx="32" cy="52" r="4" fill="#ffffff"/>
              <circle cx="12" cy="32" r="4" fill="#ffffff"/>
              <circle cx="52" cy="32" r="4" fill="#ffffff"/>
              <circle cx="18" cy="18" r="3" fill="#ffffff"/>
              <circle cx="46" cy="18" r="3" fill="#ffffff"/>
              <circle cx="18" cy="46" r="3" fill="#ffffff"/>
              <circle cx="46" cy="46" r="3" fill="#ffffff"/>
            </svg>
          </button>
          <button id="pdd-sync" class="sync-btn" title="同步到网站">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="syncGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#43e97b;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#38f9d7;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="24" fill="url(#syncGrad)"/>
              <path d="M18 30A14 14 0 0 1 46 30" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
              <path d="M46 24L44 30L38 28" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <path d="M22 42A14 14 0 0 1 18 30" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
              <path d="M18 40L24 42L22 48" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <circle cx="32" cy="32" r="4" fill="#ffffff"/>
            </svg>
          </button>
          <button id="pdd-sync-native" class="sync-native-btn" title="同步到本地存储（跨浏览器）">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="nativeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#fa709a;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#fee140;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect x="10" y="14" width="44" height="36" rx="6" fill="url(#nativeGrad)"/>
              <rect x="16" y="20" width="32" height="24" rx="4" fill="#ffffff"/>
              <rect x="22" y="26" width="12" height="8" rx="2" fill="#fa709a"/>
              <rect x="22" y="38" width="20" height="3" rx="1.5" fill="#fa709a" opacity="0.6"/>
              <rect x="22" y="28" width="16" height="2" rx="1" fill="#2b2d42" opacity="0.3"/>
              <rect x="22" y="32" width="12" height="2" rx="1" fill="#2b2d42" opacity="0.3"/>
              <circle cx="52" cy="12" r="6" fill="#ffffff"/>
              <rect x="49" y="9" width="6" height="6" rx="1" fill="#fa709a" transform="rotate(45 52 12)"/>
            </svg>
          </button>
          <button id="pdd-reset" class="reset-btn" title="重置数据">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="resetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#ffecd2;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#fcb69f;stop-opacity:1" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="32" r="24" fill="url(#resetGrad)"/>
              <path d="M20 26A12 12 0 1 1 44 32" stroke="#ffffff" stroke-width="5" stroke-linecap="round" fill="none"/>
              <path d="M44 20L40 28L48 28" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              <circle cx="32" cy="32" r="6" fill="#ffffff"/>
              <rect x="28" y="28" width="8" height="8" rx="2" fill="#fcb69f"/>
            </svg>
          </button>
          <button id="pdd-minimize" class="toggle-btn" title="收起">
            <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
              <defs>
                <linearGradient id="toggleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#a8edea;stop-opacity:1" />
                  <stop offset="100%" style="stop-color:#fed6e3;stop-opacity:1" />
                </linearGradient>
              </defs>
              <rect x="8" y="20" width="48" height="24" rx="12" fill="url(#toggleGrad)"/>
              <circle cx="22" cy="32" r="8" fill="#ffffff"/>
              <rect x="36" y="28" width="16" height="8" rx="4" fill="#ffffff" opacity="0.8"/>
              <rect x="18" y="29" width="8" height="6" rx="3" fill="#fed6e3"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div id="pdd-account-info" style="display:none;padding:6px 12px;background:#e8f5e9;font-size:11px;color:#2e7d32;border-bottom:1px solid #c8e6c9;">
        <span>账号: <strong id="pdd-current-account"></strong></span>
        <span style="margin-left:10px;">上次同步: <span id="pdd-last-sync">-</span></span>
      </div>
      
      <!-- 页面类型指示器 -->
      <div id="pdd-page-indicator" style="padding:10px 16px;background:linear-gradient(90deg, #07c160 0%, #32cd68 50%, #ffd700 100%);color:white;font-size:12px;text-align:center;font-weight:700;border-bottom:none;">
        <span id="pdd-page-type">视频数据监控页面</span>
      </div>
      
      <!-- 面板主体，支持滚动 -->
      <div id="pdd-panel-body">
        <div id="pdd-panel-body-content">
          <!-- 数据监控视图 -->
          <div id="pdd-data-view">
            <div id="pdd-sync-status" style="display:none;"></div>
            <div id="pdd-summary">
              <div class="summary-item">
                <span class="label">已捕获</span>
                <span class="value" id="total-videos">0</span>
              </div>
              <div class="summary-item">
                <span class="label">总播放</span>
                <span class="value" id="total-plays">0</span>
              </div>
              <div class="summary-item">
                <span class="label">总订单</span>
                <span class="value" id="total-orders">0</span>
              </div>
              <div class="summary-item highlight">
                <span class="label">总金额</span>
                <span class="value growth" id="total-amount">¥0</span>
              </div>
            </div>
            <div id="pdd-filter-bar">
              <input type="text" id="pdd-filter-search" placeholder="🔎 搜索视频..." style="flex:1;min-width:80px;" />
              <input type="text" id="pdd-filter-date-range" placeholder="📅 选择日期范围" readonly style="width:180px;cursor:pointer;" />
              <button id="pdd-select-filtered" class="select-filtered-btn">全选</button>
            </div>
            <div id="pdd-page-info" style="text-align:center;font-size:11px;color:#666;padding:8px;background:#f0f0f0;border-radius:4px;margin-bottom:10px;">
              <div>已监控 <span id="page-count">0</span> 页 | 共 <span id="total-count">?</span> 个视频</div>
              <div id="auto-status" style="margin-top:4px;color:#999;"></div>
            </div>
            <!-- 获取数据按钮 -->
            <div style="text-align:center;margin-bottom:10px;">
              <button id="pdd-fetch-data-btn" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;display:inline-flex;align-items:center;gap:6px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                ⚡ 获取所有视频数据
              </button>
              <button id="pdd-auto-paging-btn" style="background:linear-gradient(135deg, #f093fb 0%, #f5576c 100%);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;display:inline-flex;align-items:center;gap:6px;margin-left:8px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                🔄 自动翻页
              </button>
            </div>
            <div id="pdd-fetch-status" style="text-align:center;font-size:12px;color:#666;margin-bottom:10px;"></div>
            <div id="pdd-comparison" style="display:none;margin-bottom:10px;padding:10px;background:linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);border-radius:8px;">
              <div style="font-size:12px;font-weight:600;color:#2e7d32;margin-bottom:8px;">📊 数据对比</div>
              <div id="pdd-comparison-content" style="font-size:11px;color:#333;"></div>
            </div>
            <div id="pdd-video-list"></div>
          </div>
          
          <!-- 上传视图 - 重新设计 -->
          <div id="pdd-upload-view" style="display:none;padding:0;">
            <input type="file" id="pdd-folder-input" webkitdirectory multiple style="display:none;" />

            <!-- ===== 步骤1: 选择商品 ===== -->
            <div id="pdd-goods-section" style="padding:14px 16px 10px;">
              <!-- 区域标题栏 -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:24px;height:24px;background:linear-gradient(135deg,#e02e24,#c7261d);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:800;">1</span>
                  <span style="font-size:15px;font-weight:700;color:#1a1a1a;">选择商品</span>
                  <span id="pdd-goods-count" style="font-size:11px;color:#999;background:#f5f5f5;padding:2px 8px;border-radius:10px;font-weight:600;">(0个)</span>
                </div>
                <span id="pdd-goods-status" style="font-size:10px;color:#07c160;font-weight:600;display:flex;align-items:center;gap:4px;">
                  <span style="width:6px;height:6px;background:#07c160;border-radius:50%;animation:pulse 2s infinite;"></span>自动更新
                </span>
              </div>

              <!-- 搜索框 -->
              <div style="margin-bottom:10px;position:relative;">
                <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:#bbb;pointer-events:none;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                <input type="text" id="pdd-goods-search" placeholder="搜索商品名称或ID..." style="width:100%;padding:9px 12px 9px 36px;border:1.5px solid #eee;border-radius:10px;font-size:13px;box-sizing:border-box;background:#fafafa;color:#333;transition:all 0.2s;outline:none;" onfocus="this.style.borderColor='#e02e24';this.style.background='#fff';" onblur="this.style.borderColor='#eee';this.style.background='#fafafa';" />
              </div>

              <!-- 商品列表 -->
              <div id="pdd-goods-list" style="max-height:300px;overflow-y:auto;border-radius:12px;background:#fff;border:1px solid #f0f0f0;">
                <div style="text-align:center;padding:32px 16px;color:#aaa;">
                  <div style="font-size:32px;margin-bottom:8px;">📦</div>
                  <div style="font-size:13px;font-weight:600;">正在获取商品列表...</div>
                  <div style="font-size:11px;margin-top:4px;color:#ccc;">浏览商品页面即可自动更新</div>
                </div>
              </div>
            </div>

            <!-- ===== 步骤2: 上传配置（选择商品后显示） ===== -->
            <div id="pdd-publish-config" style="display:none;border-top:1px solid #f0f0f0;">
              <!-- 已选商品卡片 -->
              <div id="pdd-selected-card" style="margin:12px 16px 0;padding:12px 14px;background:linear-gradient(135deg,#fef2f2,#fee2e2);border-radius:12px;border:1.5px solid #fecaca;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <span style="font-size:13px;color:#dc2626;font-weight:700;">已选商品</span>
                  <button id="pdd-change-goods-btn" style="margin-left:auto;padding:3px 10px;background:rgba(220,38,38,0.1);color:#dc2626;border:1px solid rgba(220,38,38,0.25);border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;transition:all 0.15s;">换一个</button>
                </div>
                <div id="pdd-selected-goods-info" style="font-size:13px;font-weight:600;color:#991b1b;line-height:1.4;"></div>
                <div id="pdd-selected-goods-id-display" style="margin-top:6px;padding:6px 10px;background:rgba(255,255,255,0.75);border-radius:8px;font-size:14px;font-weight:800;color:#dc2626;font-family:monospace;letter-spacing:0.5px;">
                  ID: <span id="display-goods-id">--</span>
                </div>
              </div>

              <!-- 核心配置区：商品ID + 视频描述 -->
              <div style="padding:12px 16px 0;">
                <div style="display:grid;gap:10px;">
                  <!-- 商品ID -->
                  <div>
                    <label style="font-size:11px;font-weight:600;color:#dc2626;display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                      💖 商品ID <span style="color:#bbb;font-weight:400;">(可修改)</span>
                    </label>
                    <input type="text" id="pdd-custom-goods-id" placeholder="输入商品ID，留空使用已选商品的ID" style="width:100%;padding:10px 12px;border:1.5px solid #fecaca;border-radius:10px;font-size:14px;box-sizing:border-box;background:#fef2f2;color:#991b1b;font-weight:600;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#e02e24';" onblur="this.style.borderColor='#fecaca';" />
                  </div>

                  <!-- 视频描述 -->
                  <div>
                    <label style="font-size:11px;font-weight:600;color:#7c3aed;display:flex;align-items:center;gap:4px;margin-bottom:4px;">
                      📝 视频描述 <span style="color:#bbb;font-weight:400;">(可选)</span>
                    </label>
                    <textarea id="pdd-video-description" placeholder="留空则不自动填充，将自动填充到视频描述输入框" style="width:100%;padding:10px 12px;border:1.5px solid #e9d5ff;border-radius:10px;font-size:13px;box-sizing:border-box;background:#faf5ff;color:#5b21b6;resize:vertical;min-height:52px;font-family:inherit;line-height:1.45;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#7c3aed';" onblur="this.style.borderColor='#e9d5ff';" rows="2"></textarea>
                  </div>
                </div>

                <!-- 可选配置折叠区 -->
                <details style="margin-top:10px;" open>
                  <summary style="font-size:12px;font-weight:600;color:#888;cursor:pointer;list-style:none;display:flex;align-items:center;gap:5px;padding:6px 0;user-select:none;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform 0.2s;"><polyline points="6 9 12 15 18 9"/></svg>
                    更多选项
                    <span style="font-size:10px;color:#bbb;font-weight:400;margin-left:4px;">内容声明 / 文件名后缀</span>
                  </summary>
                  <div style="padding:8px 0 4px;display:grid;gap:10px;">
                    <!-- 内容声明 -->
                    <div>
                      <label style="font-size:11px;font-weight:600;color:#059669;display:flex;align-items:center;gap:4px;margin-bottom:4px;">📋 内容声明</label>
                      <select id="pdd-content-declaration" style="width:100%;padding:9px 12px;border:1.5px solid #a7f3d0;border-radius:10px;font-size:13px;box-sizing:border-box;background:#ecfdf5;color:#047857;font-weight:600;cursor:pointer;outline:none;appearance:none;background-image:url('data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 fill=%22none%22 stroke=%22%23049358%22 stroke-width=%222%22%3E%3Cpolyline points=%222,4 6,8 10,4%22/%3E%3C/svg%3E');background-repeat:no-repeat;background-position:right 10px center;">
                        <option value="内容无需标注">无需标注（默认）</option>
                        <option value="">不设置</option>
                        <option value="含AI生成内容">含AI生成内容</option>
                        <option value="含虚构演绎内容">含虚构演绎内容</option>
                        <option value="内容含营销信息">含营销信息</option>
                        <option value="内容为转载">内容为转载</option>
                      </select>
                    </div>
                    <!-- 文件名编号 -->
                    <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#555;cursor:pointer;padding:4px 0;">
                      <input type="checkbox" id="pdd-append-filename-suffix" style="width:16px;height:16px;cursor:pointer;accent-color:#e02e24;" />
                      <span>在描述末尾添加视频文件名中的数字编号</span>
                    </label>
                  </div>
                </details>
              </div>

              <!-- ===== 步骤3: 选择文件 + 开始上传 ===== -->
              <div style="padding:12px 16px 14px;">
                <!-- 操作按钮组 -->
                <div id="pdd-file-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
                  <button id="pdd-select-folder" style="padding:11px 0;background:linear-gradient(135deg,#f43f5e,#e11d48);color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;transition:all 0.2s;box-shadow:0 3px 10px rgba(244,63,94,0.25);display:flex;align-items:center;justify-content:center;gap:5px;">
                    📂 选择文件夹(多选)
                  </button>
                  <button id="pdd-select-videos" style="padding:11px 0;background:linear-gradient(135deg,#ec4899,#db2777);color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:700;transition:all 0.2s;box-shadow:0 3px 10px rgba(236,72,153,0.25);display:flex;align-items:center;justify-content:center;gap:5px;">
                    🎥 选择视频
                  </button>
                </div>

                <!-- 已缓存视频区域 -->
                <div id="pdd-cached-videos-area" style="display:none;margin-bottom:10px;padding:10px 12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;border:1.5px solid #86efac;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="font-size:14px;">📦</span>
                      <span style="font-size:12px;font-weight:700;color:#166534;">已缓存视频</span>
                      <span id="pdd-cached-count-badge" style="background:#22c55e;color:white;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600;">0个</span>
                    </div>
                    <button id="pdd-clear-cache" style="padding:3px 8px;background:#ef4444;color:white;border:none;border-radius:5px;cursor:pointer;font-size:10px;font-weight:600;">清空</button>
                  </div>
                  <div id="pdd-cached-video-list" style="max-height:80px;overflow-y:auto;font-size:11px;color:#166534;line-height:1.55;"></div>
                  <div style="margin-top:6px;padding-top:6px;border-top:1px solid #86efac;">
                    <button id="pdd-use-cache-upload" style="width:100%;padding:8px;background:linear-gradient(135deg,#22c55e,#16a34a);color:white;border:none;border-radius:7px;cursor:pointer;font-size:12px;font-weight:700;transition:all 0.2s;box-shadow:0 2px 8px rgba(34,197,94,0.25);">
                      🚀 使用缓存视频上传
                    </button>
                  </div>
                </div>

                <!-- 已选择的文件区域 -->
                <div id="pdd-selected-folders" style="display:none;margin-bottom:10px;padding:10px;background:#eff6ff;border-radius:10px;border:1.5px solid #bfdbfe;">
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                    <span style="font-size:11px;font-weight:700;color:#1d4ed8;">📂 已选择的文件</span>
                    <button id="pdd-clear-files" style="padding:3px 8px;background:#ef4444;color:white;border:none;border-radius:5px;cursor:pointer;font-size:10px;font-weight:600;">清空</button>
                  </div>
                  <div id="pdd-folder-list" style="max-height:100px;overflow-y:auto;font-size:11px;color:#334155;"></div>
                  <div id="pdd-total-count" style="margin-top:6px;padding-top:6px;border-top:1px solid #bfdbfe;font-size:11px;font-weight:700;color:#1d4ed8;"></div>
                  <button id="pdd-add-more-folders" style="width:100%;margin-top:6px;padding:7px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:white;border:none;border-radius:7px;cursor:pointer;font-size:11px;font-weight:600;transition:all 0.2s;">
                    ➕ 添加更多(多选)
                  </button>
                </div>

                <!-- 开始上传按钮 - 始终显示但默认禁用态 -->
                <button id="pdd-start-upload" style="width:100%;padding:14px;background:linear-gradient(135deg,#ccc,#bbb);color:#999;border:none;border-radius:12px;cursor:not-allowed;font-size:15px;font-weight:800;transition:all 0.3s;letter-spacing:0.5px;display:block;">
                  请先选择商品和视频
                </button>
              </div>
            </div>

            <div id="pdd-publish-status" style="font-size:11px;color:#666;padding:8px 16px;background:#fafafa;display:none;"></div>
          </div>
          
          <!-- 设置视图 - 内嵌显示 -->
          <div id="pdd-settings-view" style="display:none;padding:16px;">
            <!-- 设置卡片 -->
            <div style="background:linear-gradient(135deg, #fff 0%, #fef9f9 100%);border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(224,46,36,0.08);border:1px solid #fecaca;">
              <div style="font-size:16px;font-weight:700;color:#1a1a1a;margin-bottom:18px;display:flex;align-items:center;gap:10px;">
                <span style="font-size:22px;">⚙️</span> 系统设置
              </div>
              
              <div style="display:grid;gap:16px;">
                <!-- API 地址 -->
                <div class="setting-row">
                  <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                    <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                    API 地址
                  </label>
                  <input type="text" id="setting-api-url" placeholder="http://localhost:3000/api" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                </div>
                
                <!-- 第一行：剪辑师ID + 同步间隔 -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      默认剪辑师 ID
                    </label>
                    <input type="number" id="setting-editor-id" placeholder="24" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      同步间隔 (毫秒)
                    </label>
                    <input type="number" id="setting-sync-interval" placeholder="50" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                </div>
                
                <!-- 第二行：播放量筛选 + 订单筛选 -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      最低播放量筛选
                    </label>
                    <input type="number" id="setting-min-plays" placeholder="200" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      最低订单数筛选
                    </label>
                    <input type="number" id="setting-min-orders" placeholder="1" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                </div>
                
                <!-- 第三行：面板宽度 + 面板高度 -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      面板宽度 (像素)
                    </label>
                    <input type="number" id="setting-panel-width" placeholder="480" min="320" max="800" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                  <div class="setting-row">
                    <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                      <span style="width:8px;height:8px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);border-radius:50%;"></span>
                      面板高度 (vh)
                    </label>
                    <input type="number" id="setting-panel-height" placeholder="85" min="50" max="100" step="5" style="width:100%;padding:12px 14px;border:2px solid #fecaca;border-radius:12px;font-size:13px;box-sizing:border-box;background:#fff;transition:all 0.3s;outline:none;" />
                  </div>
                </div>
              </div>
              
              <!-- 操作按钮 -->
              <div style="display:flex;gap:12px;margin-top:20px;padding-top:20px;border-top:1px solid #fecaca;">
                <button id="pdd-settings-cancel" style="flex:1;padding:12px 20px;background:#f5f5f5;color:#666;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.3s;box-shadow:0 2px 6px rgba(0,0,0,0.06);">取消</button>
                <button id="pdd-settings-save" style="flex:1;padding:12px 20px;background:linear-gradient(135deg, #e02e24 0%, #f04e44 100%);color:white;border:none;border-radius:12px;cursor:pointer;font-size:14px;font-weight:600;transition:all 0.3s;box-shadow:0 4px 12px rgba(224,46,36,0.3);">💾 保存设置</button>
              </div>
            </div>
            
            <!-- 使用说明 -->
            <div style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);border-radius:16px;padding:18px;border:1px solid #fecaca;">
              <div style="font-size:14px;font-weight:700;color:#dc2626;margin-bottom:10px;display:flex;align-items:center;gap:8px;">
                <span style="font-size:18px;">📋</span> 使用说明
              </div>
              <div style="font-size:12px;color:#991b1b;line-height:1.8;">
                <div style="margin-bottom:6px;display:flex;align-items:flex-start;gap:6px;">
                  <span style="color:#ef4444;font-weight:700;">•</span>
                  <span>在数据监控页面可查看所有捕获的视频数据</span>
                </div>
                <div style="margin-bottom:6px;display:flex;align-items:flex-start;gap:6px;">
                  <span style="color:#ef4444;font-weight:700;">•</span>
                  <span>点击同步按钮可将数据上传到服务器</span>
                </div>
                <div style="margin-bottom:6px;display:flex;align-items:flex-start;gap:6px;">
                  <span style="color:#ef4444;font-weight:700;">•</span>
                  <span>在自动上传页面可选择商品并批量上传视频</span>
                </div>
                <div style="display:flex;align-items:flex-start;gap:6px;">
                  <span style="color:#ef4444;font-weight:700;">•</span>
                  <span>设置修改后点击保存即可生效</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="pdd-resize-handle" id="pdd-resize-handle" title="拖动调整大小"></div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      :root {
        --pdd-primary: #ff4d6d;
        --pdd-primary-light: #ff758f;
        --pdd-primary-dark: #c9184a;
        --pdd-success: #20c997;
        --pdd-warning: #ffd43b;
        --pdd-danger: #ff6b6b;
        --pdd-bg: #fff5f7;
        --pdd-surface: #ffffff;
        --pdd-text: #2b2d42;
        --pdd-text-muted: #8d99ae;
        --pdd-border: #f8c8dc;
        --pdd-radius-sm: 14px;
        --pdd-radius-md: 18px;
        --pdd-radius-lg: 24px;
        --pdd-shadow-sm: 0 4px 12px rgba(255, 77, 109, 0.12);
        --pdd-shadow: 0 6px 20px rgba(255, 77, 109, 0.18);
        --pdd-primary: #e02e24;
        --pdd-primary-light: #ff4d42;
        --pdd-primary-dark: #c7261d;
        --pdd-green: #07c160;
        --pdd-green-dark: #06ad56;
        --pdd-orange: #ff6b35;
        --pdd-surface: #ffffff;
        --pdd-bg: #f5f5f5;
        --pdd-border: #eee;
        --pdd-border-light: #f0f0f0;
        --pdd-text: #222;
        --pdd-text-secondary: #666;
        --pdd-text-muted: #999;
        --pdd-shadow-sm: 0 2px 8px rgba(0,0,0,0.06);
        --pdd-shadow-md: 0 4px 16px rgba(224,46,36,0.08);
        --pdd-shadow-lg: 0 12px 40px rgba(224,46,36,0.12);
        --pdd-gradient-1: linear-gradient(135deg, #e02e24 0%, #c7261d 100%);
        --pdd-gradient-2: linear-gradient(135deg, #ff4d42 0%, #e02e24 100%);
        --pdd-gradient-3: linear-gradient(135deg, #ffd43b 0%, #ffa94d 100%);
        --pdd-gradient-4: linear-gradient(135deg, #07c160 0%, #32cd68 100%);
      }
      
      #pdd-monitor-ball {
        position: relative !important;
        width: 100% !important;
        height: auto !important;
        min-height: unset !important;
        max-height: unset !important;
        padding: 0 !important;
        background: #e02e24 !important;
        color: #ffffff !important;
        cursor: pointer !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        transition: all 0.2s ease !important;
        box-sizing: border-box !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif !important;
        border: none !important;
        outline: none !important;
        margin: 0 !important;
        text-decoration: none !important;
        line-height: 1.4 !important;
        border-radius: 4px !important;
        overflow: hidden !important;
      }
      .ball-icon {
        width: 20px !important;
        height: 20px !important;
        min-width: 20px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
        margin-left: 12px !important;
      }
      .ball-icon svg {
        display: block !important;
      }
      .ball-text {
        font-size: 14px !important;
        font-weight: 500 !important;
        white-space: nowrap !important;
        line-height: 1.5 !important;
        padding: 12px 12px 12px 0 !important;
      }
      .ball-badge {
        position: absolute !important;
        top: 50% !important;
        right: 10px !important;
        transform: translateY(-50%) !important;
        background: #fff !important;
        color: #e02e24 !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        min-width: 16px !important;
        text-align: center !important;
        display: none !important;
        line-height: 1.2 !important;
        border: 2px solid #e02e24 !important;
      }
      .ball-badge.show {
        display: block !important;
      }
      #pdd-monitor-ball:hover {
        background: #c7261d !important;
        color: #fff !important;
      }
      #pdd-monitor-ball.active {
        background: #c7261d !important;
        color: #fff !important;
        font-weight: 600 !important;
      }
      @keyframes badgePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.08); }
      }
      .ball-badge.show {
        display: block;
      }
      #pdd-video-monitor {
        position: fixed;
        top: 0;
        right: 0;
        width: 400px;
        height: 100vh;
        min-height: 100vh;
        max-height: 100vh;
        background: var(--pdd-bg);
        box-shadow: -8px 0 40px rgba(224, 46, 36, 0.1);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Roboto, sans-serif;
        display: flex;
        flex-direction: column;
        border-left: 3px solid rgba(224, 46, 36, 0.15);
        transform: translateX(100%);
        transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        overflow: hidden;
        box-sizing: border-box;
      }
      #pdd-video-monitor.show {
        transform: translateX(0);
        pointer-events: auto;
      }
      #pdd-video-monitor.visible {
        transform: translateX(0);
      }
      /* 页面内容偏移样式 - 拼多多商家后台适配 */
      /* 由 JavaScript 动态调整，CSS 仅处理特殊情况 */
      #pdd-panel-header {
        background: linear-gradient(135deg, #e02e24 0%, #c7261d 100%);
        color: white;
        padding: 14px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: default;
        border-bottom: none;
        font-weight: 700;
        position: relative;
        flex-shrink: 0;
        box-shadow: 0 4px 16px rgba(224, 46, 36, 0.25);
      }
      #pdd-panel-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 5px;
        background: linear-gradient(90deg, #ff4d6d 0%, #ff8fa3 30%, #ffb3c1 50%, #ffd43b 70%, #20c997 100%);
      }
      #pdd-panel-header .title {
        font-size: 16px;
        font-weight: 700;
        letter-spacing: 0.5px;
        color: white;
        text-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .header-btns {
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .reset-btn, .toggle-btn, .sync-btn, .settings-btn, .publish-btn, .switch-btn, .sync-native-btn, .nav-btn {
        background: rgba(255, 255, 255, 0.18);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.28);
        color: white;
        width: 34px;
        height: 34px;
        border-radius: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .reset-btn:hover, .toggle-btn:hover, .sync-btn:hover, .settings-btn:hover, .publish-btn:hover, .switch-btn:hover, .sync-native-btn:hover {
        color: white;
        background: rgba(255, 255, 255, 0.28);
        border-color: rgba(255, 255, 255, 0.45);
        transform: translateY(-2px) scale(1.08);
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
      }
      /* 导航按钮 - 年轻化风格 */
      .nav-btn {
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
        color: rgba(255, 255, 255, 0.75);
      }
      .nav-btn svg {
        width: 18px;
        height: 18px;
        transition: all 0.25s ease;
      }
      .nav-btn:hover {
        color: white;
        background: rgba(255, 255, 255, 0.22);
        border-color: rgba(255, 255, 255, 0.35);
        transform: translateY(-2px);
        box-shadow: 0 4px 14px rgba(255, 255, 255, 0.12);
      }
      .nav-btn:hover svg {
        transform: scale(1.12);
      }
      .nav-btn.active {
        color: #e02e24;
        background: linear-gradient(135deg, #ffffff 0%, #fff5f5 100%);
        border-color: white;
        box-shadow: 0 4px 16px rgba(224, 46, 36, 0.25), inset 0 0 0 1px rgba(224, 46, 36, 0.15);
        transform: translateY(-2px) scale(1.05);
      }
      .nav-btn.active svg {
        /* 不需要滤镜，图标本身就是彩色的 */
      }
      .sync-btn.syncing {
        background: rgba(255, 255, 255, 0.32);
        border-color: rgba(255, 255, 255, 0.55);
        color: white;
        animation: syncSpin 1s linear infinite;
      }
      @keyframes syncSpin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      #pdd-sync-status {
        background: linear-gradient(135deg, #fff0f3 0%, #ffc2d1 100%);
        border: 2px solid #ff8fa3;
        border-radius: var(--pdd-radius-sm);
        padding: 14px;
        margin-bottom: 14px;
        font-size: 12px;
        color: #c9184a;
        box-shadow: 0 4px 12px rgba(255, 77, 109, 0.15);
      }
      #pdd-sync-status.syncing {
        background: linear-gradient(135deg, #fff3bf 0%, #ffe066 100%);
        border-color: #ffd43b;
        color: #e67700;
        box-shadow: 0 4px 12px rgba(255, 212, 59, 0.2);
      }
      #pdd-sync-status.success {
        background: linear-gradient(135deg, #c3fae8 0%, #63e6be 100%);
        border-color: #20c997;
        color: #087f5b;
        box-shadow: 0 4px 12px rgba(32, 201, 151, 0.2);
      }
      #pdd-sync-status.error {
        background: linear-gradient(135deg, #fff0f3 0%, #ff8fa3 100%);
        border-color: #ff4d6d;
        color: #a4133c;
        box-shadow: 0 4px 12px rgba(255, 77, 109, 0.2);
      }
      .sync-progress-bar {
        height: 6px;
        background: #f1f3f5;
        border-radius: 3px;
        margin: 10px 0;
        overflow: hidden;
      }
      .sync-progress-fill {
        height: 100%;
        background: var(--pdd-gradient-1);
        border-radius: 3px;
        transition: width 0.4s ease;
      }
      .sync-progress-text {
        font-size: 11px;
        color: #868e96;
        margin-top: 4px;
        text-align: center;
        font-weight: 500;
      }
      #pdd-sync-preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      #pdd-sync-preview-modal.show {
        opacity: 1;
        pointer-events: auto;
      }
      .sync-preview-content {
        background: var(--pdd-surface);
        border-radius: var(--pdd-radius-lg);
        width: 420px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: var(--pdd-shadow-md);
        border: 1px solid var(--pdd-border);
      }
      .sync-preview-header {
        background: var(--pdd-surface);
        color: var(--pdd-text);
        padding: 16px 20px;
        border-radius: var(--pdd-radius-lg) var(--pdd-radius-lg) 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--pdd-border);
        font-weight: 600;
      }
      .sync-preview-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .sync-preview-body {
        padding: 20px;
      }
      .sync-preview-stats {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .sync-preview-stat {
        background: var(--pdd-bg);
        padding: 12px;
        border-radius: var(--pdd-radius-sm);
        text-align: center;
        border: 1px solid var(--pdd-border);
      }
      .sync-preview-stat .value {
        font-size: 20px;
        font-weight: 700;
        color: var(--pdd-primary);
      }
      .sync-preview-stat .label {
        font-size: 11px;
        color: var(--pdd-text-muted);
        margin-top: 4px;
      }
      .sync-preview-list {
        max-height: 200px;
        overflow-y: auto;
        border: 1px solid var(--pdd-border);
        border-radius: var(--pdd-radius-sm);
        margin-bottom: 16px;
        background: var(--pdd-surface);
      }
      .sync-preview-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 12px;
        border-bottom: 1px solid var(--pdd-border);
        font-size: 11px;
      }
      .sync-preview-item:last-child {
        border-bottom: none;
      }
      .sync-preview-item .video-id {
        color: var(--pdd-text-muted);
        font-family: monospace;
      }
      .sync-preview-item .status-new {
        color: var(--pdd-success);
        font-weight: 600;
      }
      .sync-preview-item .status-update {
        color: var(--pdd-primary);
        font-weight: 600;
      }
      .sync-preview-item .status-skip {
        color: var(--pdd-text-muted);
        font-weight: 600;
      }
      .sync-preview-footer {
        display: flex;
        gap: 10px;
      }
      .sync-preview-footer button {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: var(--pdd-radius-sm);
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      .btn-confirm-sync {
        background: var(--pdd-success);
        color: white;
      }
      .btn-confirm-sync:hover {
        background: #059669;
      }
      .btn-cancel-sync {
        background: var(--pdd-bg);
        color: var(--pdd-text);
        border: 1px solid var(--pdd-border);
      }
      .btn-cancel-sync:hover {
        background: var(--pdd-border);
      }
      #pdd-filter-bar {
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
        margin-bottom: 10px;
        padding: 8px;
        background: var(--pdd-bg);
        border-radius: var(--pdd-radius-sm);
        border: 1px solid var(--pdd-border);
        align-items: center;
      }
      #pdd-filter-bar input,
      #pdd-filter-bar select {
        padding: 6px 10px;
        border: 1px solid var(--pdd-border);
        border-radius: var(--pdd-radius-sm);
        font-size: 11px;
        outline: none;
        transition: all 0.2s;
        background: var(--pdd-surface);
        height: 32px;
        box-sizing: border-box;
      }
      #pdd-filter-bar input:focus,
      #pdd-filter-bar select:focus {
        border-color: #e02e24;
        box-shadow: 0 0 0 2px rgba(224, 46, 36, 0.1);
      }
      #pdd-filter-bar input {
        flex: 1;
        min-width: 80px;
      }
      #pdd-filter-bar select {
        cursor: pointer;
      }
      /* 日期范围选择器样式 */
      #pdd-filter-date-range {
        background: var(--pdd-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='16' y1='2' x2='16' y2='6'%3E%3C/line%3E%3Cline x1='8' y1='2' x2='8' y2='6'%3E%3C/line%3E%3Cline x1='3' y1='10' x2='21' y2='10'%3E%3C/line%3E%3C/svg%3E") no-repeat right 8px center;
        background-size: 14px;
        padding-right: 28px;
      }
      #pdd-filter-date-range:hover {
        border-color: var(--pdd-primary-light);
      }
      /* 日期选择器弹出层 */
      .date-range-picker {
        position: absolute;
        background: white;
        border: 1px solid var(--pdd-border);
        border-radius: var(--pdd-radius-md);
        box-shadow: var(--pdd-shadow-md);
        padding: 12px;
        z-index: 10000;
        display: none;
      }
      .date-range-picker.show {
        display: block;
      }
      .date-range-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }
      .date-range-picker-title {
        font-size: 13px;
        font-weight: 600;
        color: #333;
      }
      .date-range-picker-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #999;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .date-range-picker-close:hover {
        color: #333;
      }
      .date-range-picker-inputs {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
      }
      .date-range-picker-inputs input {
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 12px;
        width: 110px;
      }
      .date-range-picker-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 10px;
      }
      .date-range-preset {
        padding: 4px 10px;
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .date-range-preset:hover {
        background: #e3f2fd;
        border-color: #2196f3;
        color: #1976d2;
      }
      .date-range-picker-footer {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding-top: 10px;
        border-top: 1px solid #eee;
      }
      .date-range-picker-btn {
        padding: 6px 14px;
        border: none;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .date-range-picker-btn.cancel {
        background: #f5f5f5;
        color: #666;
      }
      .date-range-picker-btn.cancel:hover {
        background: #e0e0e0;
      }
      .date-range-picker-btn.confirm {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }
      .date-range-picker-btn.confirm:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
      }
      .date-range-picker-btn.clear {
        background: #f5f5f5;
        color: #666;
        border: 1px solid #ddd;
      }
      .date-range-picker-btn.clear:hover {
        background: #e0e0e0;
      }
      /* 日历样式 */
      .calendar-container {
        display: flex;
        gap: 16px;
        padding: 10px 0;
      }
      .calendar-month {
        flex: 1;
        min-width: 240px;
      }
      .calendar-month-title {
        text-align: center;
        font-size: 14px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #eee;
      }
      .calendar-weekdays {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-bottom: 4px;
      }
      .calendar-weekdays span {
        text-align: center;
        font-size: 11px;
        color: #999;
        padding: 4px;
      }
      .calendar-days {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .calendar-day {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        cursor: pointer;
        border-radius: 4px;
        transition: all 0.2s;
        color: #333;
      }
      .calendar-day:hover {
        background: #e3f2fd;
      }
      .calendar-day.empty {
        cursor: default;
      }
      .calendar-day.start {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        font-weight: 600;
      }
      .calendar-day.end {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
        font-weight: 600;
      }
      .calendar-day.in-range {
        background: #d1fae5;
        color: #059669;
      }
      .calendar-day.start:hover,
      .calendar-day.end:hover {
        background: linear-gradient(135deg, #059669 0%, #047857 100%);
      }
      @media (max-width: 600px) {
        .calendar-container {
          flex-direction: column;
        }
        .calendar-month {
          min-width: auto;
        }
      }
      .select-filtered-btn {
        background: linear-gradient(135deg, #07c160 0%, #06ad56 100%);
        color: white;
        border: none;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 700;
        transition: all 0.2s;
        white-space: nowrap;
        height: 32px;
        box-shadow: 0 2px 8px rgba(7, 193, 96, 0.25);
      }
      .select-filtered-btn:hover {
        background: linear-gradient(135deg, #06ad56 0%, #059850 100%);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(7, 193, 96, 0.35);
      }
      .sort-btn {
        background: var(--pdd-surface);
        border: 1px solid var(--pdd-border);
        color: var(--pdd-text-muted);
        padding: 8px 12px;
        border-radius: var(--pdd-radius-sm);
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        min-width: 36px;
      }
      .sort-btn:hover {
        background: var(--pdd-bg);
        border-color: var(--pdd-primary-light);
        color: var(--pdd-primary);
      }
      .sort-btn.active {
        background: var(--pdd-primary);
        color: white;
        border-color: var(--pdd-primary);
      }
      .sort-btn.active.desc {
        opacity: 0.8;
      }
      .sort-btn.active.asc::after {
        content: '↑';
        margin-left: 4px;
        font-size: 10px;
      }
      .sort-btn.active.desc::after {
        content: '↓';
        margin-left: 4px;
        font-size: 10px;
      }
      #pdd-quick-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        padding: 12px;
        background: var(--pdd-bg);
        border-radius: var(--pdd-radius-sm);
        border: 1px solid var(--pdd-border);
      }
      .quick-action-btn {
        flex: 1;
        background: var(--pdd-surface);
        border: 1px solid var(--pdd-border);
        color: var(--pdd-text);
        padding: 10px 14px;
        border-radius: var(--pdd-radius-sm);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .quick-action-btn:hover {
        background: var(--pdd-primary);
        color: white;
        border-color: var(--pdd-primary);
      }
      #pdd-panel-body {
        padding: 0;
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      #pdd-panel-body-content {
        padding: 16px;
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }
      #pdd-panel-body-content::-webkit-scrollbar {
        width: 6px;
      }
      #pdd-panel-body-content::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }
      #pdd-panel-body-content::-webkit-scrollbar-thumb {
        background: var(--pdd-border);
        border-radius: 3px;
      }
      #pdd-panel-body-content::-webkit-scrollbar-thumb:hover {
        background: var(--pdd-text-muted);
      }
      #pdd-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 20px;
        padding: 0;
        background: transparent;
        border-radius: 0;
        border: none;
      }
      .summary-item {
        text-align: center;
        padding: 16px 8px;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(254, 242, 242, 0.9) 100%);
        border-radius: 16px;
        border: none;
        transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 4px 12px rgba(224, 46, 36, 0.08);
        position: relative;
        overflow: hidden;
      }
      .summary-item::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(135deg, #e02e24 0%, #f04e44 100%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .summary-item:hover {
        transform: translateY(-4px) scale(1.02);
        box-shadow: 0 12px 24px rgba(224, 46, 36, 0.15);
      }
      .summary-item:hover::before {
        opacity: 1;
      }
      .summary-item.highlight {
        background: linear-gradient(135deg, rgba(224, 46, 36, 0.08) 0%, rgba(244, 63, 94, 0.08) 100%);
        box-shadow: 0 4px 16px rgba(224, 46, 36, 0.12);
      }
      .summary-item.highlight::before {
        opacity: 1;
      }
      .summary-item .label {
        display: block;
        font-size: 11px;
        color: var(--pdd-text-muted);
        margin-bottom: 8px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .summary-item .value {
        display: block;
        font-size: 18px;
        font-weight: 800;
        color: var(--pdd-text);
        transition: all 0.3s ease;
      }
      .summary-item:hover .value {
        transform: scale(1.1);
      }
      .summary-item .value.growth {
        background: linear-gradient(135deg, #ff6b35 0%, #e85a25 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      #pdd-page-info {
        text-align: center;
        font-size: 12px;
        color: var(--pdd-text-muted);
        padding: 14px;
        background: linear-gradient(135deg, rgba(254, 242, 242, 0.8) 0%, rgba(255, 255, 255, 0.8) 100%);
        border-radius: 14px;
        margin-bottom: 16px;
        border: none;
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.02);
      }
      #pdd-video-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .video-card {
        background: rgba(255, 255, 255, 0.95);
        border-radius: 16px;
        padding: 14px;
        display: flex;
        gap: 14px;
        margin-bottom: 0;
        border: 1px solid rgba(0, 0, 0, 0.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        position: relative;
      }
      .video-card::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 4px;
        background: #e02e24;
        opacity: 0;
        border-radius: 4px 0 0 4px;
      }
      .video-card:hover {
        background: rgba(255, 255, 255, 1);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      }
      .video-card:hover::before {
        opacity: 1;
      }
      .video-card.selected {
        background: rgba(224, 46, 36, 0.08);
        box-shadow: 0 4px 12px rgba(224, 46, 36, 0.1);
      }
      .video-card.selected::before {
        opacity: 1;
      }
      .video-cover {
        width: 60px;
        height: 60px;
        border-radius: var(--pdd-radius-sm);
        object-fit: cover;
        flex-shrink: 0;
        border: 1px solid var(--pdd-border);
      }
      .video-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 6px;
      }
      .video-desc {
        font-size: 13px;
        color: var(--pdd-text);
        margin-bottom: 6px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        line-height: 1.4;
        font-weight: 500;
      }
      .video-stats {
        display: flex;
        gap: 8px;
        font-size: 11px;
        color: var(--pdd-text-muted);
        flex-wrap: wrap;
        align-items: center;
      }
      .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--pdd-bg);
        padding: 4px 10px;
        border-radius: 20px;
        transition: all 0.2s ease;
        font-size: 11px;
        border: 1px solid var(--pdd-border);
      }
      .stat-item:hover {
        background: rgba(99, 102, 241, 0.08);
        border-color: var(--pdd-primary-light);
      }
      .stat-item .num {
        font-weight: 700;
        color: var(--pdd-text);
      }
      .stat-item.amount .num {
        color: var(--pdd-primary);
      }
      .growth-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        background: rgba(16, 185, 129, 0.1);
        color: var(--pdd-success);
        border-radius: 20px;
        font-size: 10px;
        font-weight: 600;
        margin-left: 4px;
      }
      .growth-badge.zero {
        background: var(--pdd-bg);
        color: var(--pdd-text-muted);
      }
      .growth-badge.negative {
        background: rgba(239, 68, 68, 0.1);
        color: var(--pdd-danger);
      }
      .growth-badge.amount {
        background: rgba(99, 102, 241, 0.1);
        color: var(--pdd-primary);
      }
      .no-data {
        text-align: center;
        padding: 40px 20px;
        color: var(--pdd-text-muted);
        background: var(--pdd-bg);
        border-radius: var(--pdd-radius-md);
        border: 2px dashed var(--pdd-border);
      }
      .video-checkbox {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #ee5a5a;
        flex-shrink: 0;
      }
      .settings-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      .settings-btn:hover {
        background: linear-gradient(135deg, #5a6fd6 0%, #6a4192 100%);
      }
      #pdd-settings-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      #pdd-settings-modal.show {
        opacity: 1;
        pointer-events: auto;
      }
      .settings-content {
        background: white;
        border-radius: 16px;
        width: 320px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      }
      .settings-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 16px 16px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .settings-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .settings-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 16px;
      }
      .settings-body {
        padding: 20px;
      }
      .settings-group {
        margin-bottom: 16px;
      }
      .settings-group label {
        display: block;
        font-size: 12px;
        color: #666;
        margin-bottom: 6px;
        font-weight: 500;
      }
      .settings-group input,
      .settings-group select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
        transition: border-color 0.2s;
      }
      .settings-group input:focus,
      .settings-group select:focus {
        border-color: #667eea;
      }
      .settings-footer {
        padding: 16px 20px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 10px;
      }
      .settings-footer button {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
      }
      .btn-save {
        background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
        color: white;
      }
      .btn-cancel {
        background: #f0f0f0;
        color: #666;
      }
      #pdd-preview-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10002;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
      }
      #pdd-preview-modal.show {
        opacity: 1;
        pointer-events: auto;
      }
      .preview-content {
        background: #000;
        border-radius: 12px;
        max-width: 90vw;
        max-height: 90vh;
        position: relative;
      }
      .preview-content video {
        max-width: 100%;
        max-height: 80vh;
        border-radius: 12px;
      }
      .preview-close {
        position: absolute;
        top: -40px;
        right: 0;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
      }
      .preview-info {
        color: white;
        text-align: center;
        padding: 10px;
        font-size: 12px;
      }
      .select-all-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
        border-radius: 10px;
        margin-bottom: 10px;
        border: 1px solid rgba(0,0,0,0.05);
      }
      .select-all-bar label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 12px;
        color: #666;
      }
      .selected-count {
        font-size: 11px;
        color: #ee5a5a;
        font-weight: 600;
      }
      .sort-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        color: white;
        padding: 4px 10px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 11px;
        font-weight: 500;
        transition: all 0.2s ease;
      }
      .sort-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
      }
      .sort-inline-btn {
        background: white;
        border: 1px solid #ddd;
        color: #666;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
        margin-left: 4px;
      }
      .sort-inline-btn:hover {
        background: #fff0f0;
        border-color: #ee5a5a;
        color: #ee5a5a;
      }
      .sort-inline-btn.active {
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
        border-color: #ee5a5a;
        color: white;
      }
      .video-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 6px;
        flex-wrap: wrap;
        gap: 4px;
      }
      .video-id {
        font-size: 9px;
        color: #bbb;
        word-break: break-all;
        font-family: monospace;
        flex: 1;
      }
      .video-date {
        font-size: 9px;
        color: #888;
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 4px;
        white-space: nowrap;
      }
      .video-expand-btn {
        font-size: 9px;
        color: #ee5a5a;
        background: #fff5f5;
        border: 1px solid rgba(238, 90, 90, 0.2);
        padding: 2px 8px;
        border-radius: 4px;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
      }
      .video-expand-btn:hover {
        background: #ee5a5a;
        color: white;
      }
      .no-growth {
        font-size: 10px;
        color: #aaa;
        margin-left: 4px;
        font-style: italic;
      }
      .audit-badge {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        margin-left: 8px;
        vertical-align: middle;
      }
      .audit-badge.failed {
        background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%);
        color: #c62828;
        border: 1px solid #ef9a9a;
      }
      .audit-badge.passed {
        background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
        color: #2e7d32;
        border: 1px solid #a5d6a7;
      }
      .audit-badge.pending {
        background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
        color: #ef6c00;
        border: 1px solid #ffcc80;
      }
      .video-card.audit-failed {
        border-color: rgba(239, 83, 80, 0.3);
        background: linear-gradient(135deg, #fff 0%, #ffebee 100%);
      }
      .video-card.audit-failed .video-desc {
        color: #c62828;
      }
      /* 手动发布弹窗样式 */
      #pdd-manual-publish-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.6);
        z-index: 10003;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s;
        backdrop-filter: blur(4px);
      }
      #pdd-manual-publish-modal.show {
        opacity: 1;
        pointer-events: auto;
      }
      .manual-publish-content {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 480px;
        max-height: 85vh;
        overflow: hidden;
        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        animation: modalSlideIn 0.3s ease;
      }
      @keyframes modalSlideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .manual-publish-header {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .manual-publish-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }
      .manual-publish-close {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        transition: background 0.2s;
      }
      .manual-publish-close:hover {
        background: rgba(255,255,255,0.3);
      }
      .manual-publish-body {
        padding: 20px;
        overflow-y: auto;
        max-height: calc(85vh - 140px);
      }
      .manual-publish-section {
        margin-bottom: 16px;
      }
      .manual-publish-section label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;
      }
      .manual-publish-section .goods-info {
        background: #f0f4ff;
        padding: 12px;
        border-radius: 8px;
        border-left: 4px solid #6366f1;
      }
      .manual-publish-section .goods-info .name {
        font-size: 14px;
        color: #333;
        font-weight: 500;
        margin-bottom: 4px;
      }
      .manual-publish-section .goods-info .id {
        font-size: 12px;
        color: #6366f1;
        font-family: monospace;
        font-weight: 600;
      }
      .manual-publish-input {
        width: 100%;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }
      .manual-publish-input:focus {
        outline: none;
        border-color: #6366f1;
      }
      .manual-publish-input::placeholder {
        color: #999;
      }
      .manual-publish-textarea {
        width: 100%;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
        resize: vertical;
        min-height: 80px;
        font-family: inherit;
        transition: border-color 0.2s;
      }
      .manual-publish-textarea:focus {
        outline: none;
        border-color: #6366f1;
      }
      .manual-publish-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-size: 13px;
        color: #555;
      }
      .manual-publish-checkbox input {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #6366f1;
      }
      .manual-publish-file-area {
        border: 2px dashed #d0d0d0;
        border-radius: 10px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        background: #fafafa;
      }
      .manual-publish-file-area:hover {
        border-color: #6366f1;
        background: #f0f4ff;
      }
      .manual-publish-file-area.has-file {
        border-color: #10b981;
        background: #ecfdf5;
      }
      .manual-publish-file-area .icon {
        font-size: 36px;
        margin-bottom: 8px;
      }
      .manual-publish-file-area .text {
        font-size: 14px;
        color: #333;
        font-weight: 500;
      }
      .manual-publish-file-area .hint {
        font-size: 12px;
        color: #888;
        margin-top: 4px;
      }
      .manual-publish-file-area .file-name {
        font-size: 13px;
        color: #10b981;
        font-weight: 600;
        word-break: break-all;
      }
      .manual-publish-footer {
        padding: 16px 20px;
        border-top: 1px solid #eee;
        display: flex;
        gap: 12px;
      }
      .manual-publish-footer button {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .manual-publish-footer .btn-cancel {
        background: #f0f0f0;
        color: #666;
      }
      .manual-publish-footer .btn-cancel:hover {
        background: #e0e0e0;
      }
      .manual-publish-footer .btn-publish {
        background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
        color: white;
      }
      .manual-publish-footer .btn-publish:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99,102,241,0.4);
      }
      .manual-publish-footer .btn-publish:disabled {
        background: #ccc;
        cursor: not-allowed;
        transform: none;
        box-shadow: none;
      }
    `;
    
    document.head.appendChild(style);
    
    // 确保 body 存在再添加元素
    if (!document.body) {
      console.log('[PDD监控] 错误: document.body 不存在，无法添加导航栏按钮');
      return;
    }
    
    // 查找发布视频按钮并插入导航栏按钮
    function insertNavButton() {
      console.log('[PDD监控] 开始查找导航栏...');
      
      let navItem = null;
      
      // 遍历所有元素，找到包含"发布视频"文本的最小容器（即导航项本身）
      const allElements = document.querySelectorAll('a, li, div, span');
      for (const el of allElements) {
        // 跳过太深的元素和我们的按钮
        if (el.id === 'pdd-monitor-ball') continue;
        const text = (el.textContent || '').trim();
        // 精确匹配：元素的纯文本正好是"发布视频"或以"发布视频"开头且不太长
        if ((text === '发布视频' || text === '发布视频 ' || text.match(/^发布视频\s*$/)) && el.children.length < 5) {
          navItem = el;
          console.log('[PDD监控] 找到发布视频导航项:', el.tagName, el.className?.substring(0, 80), 'innerHTML长度:', el.innerHTML.length);
          break;
        }
      }
      
      let inserted = false;
      
      if (navItem && navItem.parentElement) {
        console.log('[PDD监控] 发布视频父元素:', navItem.parentElement.tagName, navItem.parentElement.className?.substring(0, 80));
        
        // 在发布视频导航项后面插入我们的按钮
        if (navItem.nextElementSibling) {
          navItem.parentElement.insertBefore(ball, navItem.nextElementSibling);
        } else {
          navItem.parentElement.appendChild(ball);
        }
        inserted = true;
        console.log('[PDD监控] ✅ 导航栏按钮已插入到发布视频下方（红色高亮样式）');
      }
      
      if (!inserted) {
        console.log('[PDD监控] ⚠️ 未找到发布视频导航项，使用浮动回退模式');
        document.body.appendChild(ball);
        ball.style.position = 'fixed';
        ball.style.bottom = '80px';
        ball.style.right = '20px';
        ball.style.zIndex = '2147483647';
        ball.style.width = 'auto';
        ball.style.background = 'linear-gradient(135deg, #e02e24, #c7261d)';
        ball.style.borderRadius = '50%';
        ball.style.boxShadow = '0 4px 20px rgba(224,46,36,0.4)';
        ball.style.display = 'flex';
        ball.style.alignItems = 'center';
        ball.style.justifyContent = 'center';
        ball.style.color = 'white';
        ball.style.padding = '15px';
        ball.style.cursor = 'pointer';
      }
    }
    
    insertNavButton();
    document.body.appendChild(panel);
    
    // 调试日志：确认元素已添加
    const addedBall = document.getElementById('pdd-monitor-ball');
    const addedPanel = document.getElementById('pdd-video-monitor');
    console.log('[PDD监控] 导航栏按钮添加状态:', addedBall ? '成功' : '失败', '面板添加状态:', addedPanel ? '成功' : '失败');
    if (addedBall) {
      const rect = addedBall.getBoundingClientRect();
      console.log('[PDD监控] 导航栏按钮位置:', { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    }
    
    const settingsModal = document.createElement('div');
    settingsModal.id = 'pdd-settings-modal';
    settingsModal.innerHTML = `
      <div class="settings-content">
        <div class="settings-header">
          <h3>⚙️ 设置</h3>
          <button class="settings-close" id="pdd-settings-close">×</button>
        </div>
        <div class="settings-body">
          <div class="settings-group">
            <label>API 地址</label>
            <input type="text" id="setting-api-url" placeholder="http://localhost:3000/api" />
          </div>
          <div class="settings-group">
            <label>默认剪辑师 ID</label>
            <input type="number" id="setting-editor-id" placeholder="24" />
          </div>
          <div class="settings-group">
            <label>最低播放量筛选</label>
            <input type="number" id="setting-min-plays" placeholder="200" />
          </div>
          <div class="settings-group">
            <label>最低订单数筛选</label>
            <input type="number" id="setting-min-orders" placeholder="1" />
          </div>
          <div class="settings-group">
            <label>同步间隔 (毫秒)</label>
            <input type="number" id="setting-sync-interval" placeholder="50" />
          </div>
          <div class="settings-group">
            <label>面板宽度 (像素)</label>
            <input type="number" id="setting-panel-width" placeholder="480" min="320" max="800" />
          </div>
          <div class="settings-group">
            <label>面板高度 (vh)</label>
            <input type="number" id="setting-panel-height" placeholder="85" min="50" max="100" step="5" />
          </div>
        </div>
        <div class="settings-footer">
          <button class="btn-cancel" id="pdd-settings-cancel">取消</button>
          <button class="btn-save" id="pdd-settings-save">保存</button>
        </div>
      </div>
    `;
    document.body.appendChild(settingsModal);
    
    const previewModal = document.createElement('div');
    previewModal.id = 'pdd-preview-modal';
    previewModal.innerHTML = `
      <div class="preview-content">
        <button class="preview-close" id="pdd-preview-close">×</button>
        <video id="pdd-preview-video" controls autoplay></video>
        <div class="preview-info" id="pdd-preview-info"></div>
      </div>
    `;
    document.body.appendChild(previewModal);
    
    // 手动发布弹窗
    const manualPublishModal = document.createElement('div');
    manualPublishModal.id = 'pdd-manual-publish-modal';
    manualPublishModal.innerHTML = `
      <div class="manual-publish-content">
        <div class="manual-publish-header">
          <h3>✏️ 手动发布视频</h3>
          <button class="manual-publish-close" id="pdd-manual-publish-close">×</button>
        </div>
        <div class="manual-publish-body">
          <!-- 商品信息 -->
          <div class="manual-publish-section">
            <label>📦 商品信息</label>
            <div class="goods-info">
              <div class="name" id="manual-goods-name">--</div>
              <div class="id" id="manual-goods-id">ID: --</div>
            </div>
          </div>
          
          <!-- 商品ID输入 -->
          <div class="manual-publish-section">
            <label>📝 商品ID（可修改）</label>
            <input type="text" id="manual-goods-id-input" class="manual-publish-input" placeholder="输入商品ID">
          </div>
          
          <!-- 视频描述 -->
          <div class="manual-publish-section">
            <label>📝 视频描述（可选）</label>
            <textarea id="manual-video-desc" class="manual-publish-textarea" placeholder="输入视频描述，将应用到所有视频"></textarea>
          </div>
          
          <!-- 添加文件名编号选项 -->
          <div class="manual-publish-section">
            <label class="manual-publish-checkbox">
              <input type="checkbox" id="manual-append-filename">
              <span>在描述末尾添加视频文件名中的数字编号</span>
            </label>
          </div>
          
          <!-- 选择视频文件 -->
          <div class="manual-publish-section">
            <label>🎬 选择视频</label>
            <div class="manual-publish-file-area" id="manual-file-area">
              <div class="icon">📁</div>
              <div class="text">点击选择视频文件</div>
              <div class="hint">支持 MP4 格式</div>
            </div>
            <input type="file" id="manual-video-input" accept="video/*" style="display:none;">
          </div>
        </div>
        <div class="manual-publish-footer">
          <button class="btn-cancel" id="pdd-manual-publish-cancel">取消</button>
          <button class="btn-publish" id="pdd-manual-publish-confirm" disabled>🚀 开始发布</button>
        </div>
      </div>
    `;
    document.body.appendChild(manualPublishModal);
    
    const syncPreviewModal = document.createElement('div');
    syncPreviewModal.id = 'pdd-sync-preview-modal';
    syncPreviewModal.innerHTML = `
      <div class="sync-preview-content">
        <div class="sync-preview-header">
          <h3>📤 同步预览</h3>
          <button class="settings-close" id="pdd-sync-preview-close">×</button>
        </div>
        <div class="sync-preview-body">
          <div class="sync-preview-stats">
            <div class="sync-preview-stat">
              <div class="value" id="sync-preview-total">0</div>
              <div class="label">待同步</div>
            </div>
            <div class="sync-preview-stat">
              <div class="value" id="sync-preview-new">0</div>
              <div class="label">新建</div>
            </div>
            <div class="sync-preview-stat">
              <div class="value" id="sync-preview-update">0</div>
              <div class="label">更新</div>
            </div>
            <div class="sync-preview-stat">
              <div class="value" id="sync-preview-skip">0</div>
              <div class="label">跳过</div>
            </div>
          </div>
          
          <!-- 品牌字段设置 -->
          <div style="background:#fff3e0;padding:12px;border-radius:8px;margin-bottom:12px;border:1px solid #ffcc80;">
            <div style="font-size:12px;font-weight:600;color:#e65100;margin-bottom:8px;">🏷️ 品牌字段设置</div>
            <input type="text" id="sync-brand-input" placeholder="输入品牌名称（可选）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:12px;box-sizing:border-box;margin-bottom:8px;" />
            <div style="font-size:12px;font-weight:600;color:#1976d2;margin-bottom:8px;">📦 产品名称设置</div>
            <input type="text" id="sync-product-input" placeholder="输入产品名称（可选，不填则使用视频描述）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:12px;box-sizing:border-box;margin-bottom:8px;" />
            <div style="font-size:12px;font-weight:600;color:#7b1fa2;margin-bottom:8px;">🎬 剪辑师设置</div>
            <input type="number" id="sync-editor-id-input" placeholder="输入剪辑师ID（可选，不填则使用默认值）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:12px;box-sizing:border-box;" />
            <div style="font-size:10px;color:#888;margin-top:6px;">* 品牌和产品名称均为可选，不填则自动使用视频描述</div>
          </div>
          
          <div style="font-size:12px;color:#666;margin-bottom:8px;">视频列表：</div>
          <div class="sync-preview-list" id="sync-preview-list"></div>
          <div class="sync-preview-footer">
            <button class="btn-cancel-sync" id="btn-cancel-sync">取消</button>
            <button class="btn-confirm-sync" id="btn-confirm-sync">开始同步</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(syncPreviewModal);
    
    loadConfig();
    loadSyncHistory();
    bindFilterEvents();
    
    // 面板是否已初始化
    let panelInitialized = false;
    
    // 调整拼多多页面布局函数
    function adjustPageLayout(isOpen) {
      const sidebarWidth = 400;
      const html = document.documentElement;
      const body = document.body;
      
      if (isOpen) {
        // 设置 html 宽度，这是最可靠的方法
        if (!html.dataset.pddAdjusted) {
          html.dataset.pddAdjusted = 'true';
          html.dataset.pddOrigOverflow = html.style.overflow || '';
        }
        html.style.width = `calc(100vw - ${sidebarWidth}px)`;
        html.style.overflowX = 'hidden';
        
        // 调整 body
        if (!body.dataset.pddAdjusted) {
          body.dataset.pddAdjusted = 'true';
          body.dataset.pddOrigOverflow = body.style.overflow || '';
        }
        body.style.overflowX = 'hidden';
        
        console.log('[PDD监控] 页面宽度已压缩，侧边栏打开');
      } else {
        // 恢复 html
        if (html.dataset.pddAdjusted) {
          html.style.width = '';
          html.style.overflowX = html.dataset.pddOrigOverflow || '';
          delete html.dataset.pddAdjusted;
          delete html.dataset.pddOrigOverflow;
        }
        
        // 恢复 body
        if (body.dataset.pddAdjusted) {
          body.style.overflowX = body.dataset.pddOrigOverflow || '';
          delete body.dataset.pddAdjusted;
          delete body.dataset.pddOrigOverflow;
        }
        
        console.log('[PDD监控] 页面宽度已恢复');
      }
    }
    
    // 导航栏按钮点击事件 - 展开/收起面板
    ball.addEventListener('click', (e) => {
      const isVisible = panel.classList.contains('show');
      
      if (!isVisible) {
        panel.classList.add('show');
        ball.classList.add('active');
        document.body.classList.add('pdd-sidebar-open');
        
        // 使用 JavaScript 强制调整拼多多页面布局
        adjustPageLayout(true);
        
        // 面板首次打开时初始化
        if (!panelInitialized) {
          panelInitialized = true;
          // 延迟触发商品列表加载
          requestIdleCallback(() => {
            if (window.__loadGoodsListOnce) {
              window.__loadGoodsListOnce();
            }
          }, { timeout: 500 });
        }
        
        // 延迟更新面板内容
        requestIdleCallback(() => {
          updatePanel();
        }, { timeout: 100 });
      } else {
        panel.classList.remove('show');
        ball.classList.remove('active');
        document.body.classList.remove('pdd-sidebar-open');
        
        // 恢复拼多多页面布局
        adjustPageLayout(false);
      }
    });
    
    // 导航栏按钮无需拖拽功能
    
    // 面板事件绑定
    document.getElementById('pdd-minimize').onclick = () => {
      panel.classList.remove('show');
      ball.classList.remove('active');
      document.body.classList.remove('pdd-sidebar-open');
      adjustPageLayout(false);
    };
    
    // 设置按钮点击 - 显示内嵌设置页面
    document.getElementById('pdd-settings').onclick = () => {
      showSettingsView();
    };
    
    // 设置页面按钮事件
    document.getElementById('pdd-settings-cancel').onclick = hideSettingsView;
    document.getElementById('pdd-settings-save').onclick = () => {
      saveConfig();
      hideSettingsView();
    };
    
    // 数据页面特有的按钮
    const resetBtn = document.getElementById('pdd-reset');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (currentView === 'upload') {
          // 在上传视图，清空输入框数据
          const productIdInput = document.getElementById('pdd-product-id');
          const appendFilenameSuffixInput = document.getElementById('pdd-append-filename-suffix');

          if (productIdInput) productIdInput.value = '';
          if (appendFilenameSuffixInput) appendFilenameSuffixInput.checked = false;

          // 同时清除localStorage中保存的数据
          localStorage.removeItem('__pdd_input_product_id');
          localStorage.removeItem('__pdd_append_filename_suffix');

          console.log('[PDD监控] 已清空上传表单数据');
        } else {
          // 在数据监控视图，重置视频列表数据
          stopAutoPaging();
          allVideos = [];
          currentPage = 0;
          updatePanel();
          console.log('[PDD监控] 已重置当前会话数据');
        }
      };
    }
    
    const syncBtn = document.getElementById('pdd-sync');
    if (syncBtn) {
      syncBtn.onclick = function() {
        if (isSyncing) {
          // 同步进行中，将请求加入队列
          const selectedVideos = getSelectedVideos();
          if (selectedVideos.length === 0) {
            updateSyncStatus('error', '❌ 请先勾选要同步的视频');
            return;
          }
          
          // 添加到队列
          syncQueue.push({
            videos: selectedVideos,
            timestamp: Date.now()
          });
          
          console.log('[PDD监控] 同步进行中，新请求已加入队列，当前队列长度:', syncQueue.length);
          updateSyncStatus('info', `⏳ 同步进行中，新请求已加入队列（队列中: ${syncQueue.length} 个）`);
          return;
        }
        showSyncPreview();
      };
    }
    
    // 同步到本地存储按钮
    const syncNativeBtn = document.getElementById('pdd-sync-native');
    if (syncNativeBtn) {
      syncNativeBtn.onclick = async function() {
        if (!currentAccountId) {
          // 尝试再次获取店铺名称
          let retryId = getCurrentAccountId();
          
          if (retryId) {
            currentAccountId = retryId;
            localStorage.setItem('pdd_last_shop_name', retryId);
            console.log('[PDD监控] 重试获取到店铺名称:', currentAccountId);
          } else {
            // 提供手动输入店铺名称的选项
            const manualId = prompt('未检测到店铺名称，无法同步。\n\n请手动输入店铺名称：\n\n提示：店铺名称通常显示在页面右上角。');
            if (manualId && manualId.trim()) {
              currentAccountId = manualId.trim();
              localStorage.setItem('pdd_last_shop_name', currentAccountId);
              console.log('[PDD监控] 手动设置店铺名称:', currentAccountId);
              
              // 更新账号显示
              const accountInfoEl = document.getElementById('pdd-account-info');
              const currentAccountEl = document.getElementById('pdd-current-account');
              if (currentAccountEl) {
                currentAccountEl.textContent = currentAccountId;
              }
              if (accountInfoEl) {
                accountInfoEl.style.display = 'block';
              }
              
              // 通知background设置账号ID
              chrome.runtime.sendMessage({
                action: 'setAccountId',
                accountId: currentAccountId
              });
            } else {
              return;
            }
          }
        }
        
        syncNativeBtn.textContent = '⏳';
        syncNativeBtn.disabled = true;
        
        chrome.runtime.sendMessage({ action: 'syncNow' }, (response) => {
          syncNativeBtn.textContent = '💾';
          syncNativeBtn.disabled = false;
          
          if (response && response.success) {
            const lastSyncEl = document.getElementById('pdd-last-sync');
            if (lastSyncEl) {
              lastSyncEl.textContent = new Date().toLocaleTimeString();
            }
            console.log('[PDD监控] 数据已同步到本地存储');
            alert('数据已同步到本地存储！\n换浏览器时会自动加载历史数据。');
          } else {
            alert('同步失败: ' + (response?.error || '未知错误'));
          }
        });
      };
    }
    
    // 更新账号信息显示
    function updateAccountInfoDisplay() {
      const accountInfoEl = document.getElementById('pdd-account-info');
      const currentAccountEl = document.getElementById('pdd-current-account');
      
      if (currentAccountId && accountInfoEl && currentAccountEl) {
        currentAccountEl.textContent = currentAccountId;
        accountInfoEl.style.display = 'block';
      }
    }
    
    // 注意：不再在这里恢复保存的视图状态
    // 视图状态完全由 autoSwitchViewByPage() 根据当前页面URL决定
    // 避免在数据页面错误显示上传面板
    const savedView = localStorage.getItem('__pdd_panel_view');
    console.log('[PDD监控] 保存的视图状态:', savedView, '(将在autoSwitchViewByPage中根据页面类型应用)');

    // 根据页面类型自动切换视图
    function autoSwitchViewByPage() {
      const currentUrl = window.location.href;
      const dataView = document.getElementById('pdd-data-view');
      const uploadView = document.getElementById('pdd-upload-view');
      const settingsView = document.getElementById('pdd-settings-view');
      const panelTitle = document.getElementById('pdd-panel-title');
      const pageTypeIndicator = document.getElementById('pdd-page-type');
      const navDataPageBtn = document.getElementById('pdd-nav-data-page');
      const navAutoUploadBtn = document.getElementById('pdd-nav-auto-upload');

      // 判断当前页面类型
      const isUploadPage = currentUrl.includes('/video/publish') ||
                           currentUrl.includes('/creator/video/publish') ||
                           currentUrl.includes('/n-creator/video/publish') ||
                           currentUrl.includes('/n-creator/video/home') ||
                           currentUrl.includes('/mms/video/publish');

      const isDataPage = currentUrl.includes('/video/list') ||
                         currentUrl.includes('/video/data') ||
                         currentUrl.includes('/creator/video/list') ||
                         currentUrl.includes('/n-creator/video/list') ||
                         currentUrl.includes('/n-creator/video/mall-goods-video') ||
                         currentUrl.includes('/n-creator/video/data') ||
                         currentUrl.includes('/mall-goods-video');

      console.log('[PDD监控] 页面URL:', currentUrl);
      console.log('[PDD监控] 页面类型检测: isUploadPage=', isUploadPage, ', isDataPage=', isDataPage);

      // 强制：根据页面类型显示对应视图（这是唯一决定视图的地方）
      if (isUploadPage) {
        // 在上传页面，显示上传视图
        currentView = 'upload';
        if (dataView) dataView.style.display = 'none';
        if (uploadView) uploadView.style.display = 'block';
        if (settingsView) settingsView.style.display = 'none';
        if (panelTitle) panelTitle.textContent = '📹 视频批量上传';
        if (pageTypeIndicator) pageTypeIndicator.textContent = '📹 视频自动上传页面';
        // 更新导航按钮状态
        if (navAutoUploadBtn) navAutoUploadBtn.classList.add('active');
        if (navDataPageBtn) navDataPageBtn.classList.remove('active');
        console.log('[PDD监控] ★★ 自动切换到上传视图 ★★');
      } else if (isDataPage) {
        // 在数据页面，显示数据视图（强制隐藏上传视图）
        currentView = 'data';
        if (dataView) dataView.style.display = 'block';
        if (uploadView) uploadView.style.display = 'none';  // 关键：强制隐藏！
        if (settingsView) settingsView.style.display = 'none';
        if (panelTitle) panelTitle.textContent = '📊 视频数据监控';
        if (pageTypeIndicator) pageTypeIndicator.textContent = '📊 视频数据监控页面';
        // 更新导航按钮状态
        if (navDataPageBtn) navDataPageBtn.classList.add('active');
        if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
        console.log('[PDD监控] ★★ 自动切换到数据视图（已强制隐藏上传面板）★★');
      } else {
        // 其他页面：默认显示数据视图，隐藏上传视图
        currentView = 'data';
        if (dataView) dataView.style.display = 'block';
        if (uploadView) uploadView.style.display = 'none';  // 关键：默认也隐藏！
        if (settingsView) settingsView.style.display = 'none';
        if (panelTitle) panelTitle.textContent = '📊 视频数据监控';
        if (pageTypeIndicator) pageTypeIndicator.textContent = '📊 视频数据监控页面';
        if (navDataPageBtn) navDataPageBtn.classList.add('active');
        if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
        console.log('[PDD监控] ★★ 默认显示数据视图（未知页面类型，已隐藏上传面板）★★');
      }

      // 保存当前视图状态
      localStorage.setItem('__pdd_panel_view', currentView);
    }

    // 页面加载时自动切换视图（这是初始化视图的唯一入口）
    autoSwitchViewByPage();

    // ★★★ 关键修复：监听URL变化，自动重新切换视图 ★★★
    // 解决问题：从上传页面发布视频后跳转到数据页面，视图状态没有更新
    let lastUrl = window.location.href;

    // 监听popstate事件（浏览器前进/后退）
    window.addEventListener('popstate', function() {
      console.log('[PDD监控] 检测到popstate事件，重新检查页面类型');
      setTimeout(() => {
        autoSwitchViewByPage();
      }, 500);  // 延迟500ms等待DOM更新
    });

    // 监听hashchange事件（hash路由变化）
    window.addEventListener('hashchange', function() {
      console.log('[PDD监控] 检测到hashchange事件，重新检查页面类型');
      setTimeout(() => {
        autoSwitchViewByPage();
      }, 500);
    });

    // 定时轮询检测URL变化（SPA应用可能不触发上述事件）
    setInterval(function() {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[PDD监控] 检测到URL变化:', lastUrl, '→', currentUrl);
        lastUrl = currentUrl;
        autoSwitchViewByPage();
      }
    }, 2000);  // 每2秒检查一次

    console.log('[PDD监控] ✓ URL变化监听器已启动（popstate + hashchange + 轮询）');
    
    // 视频数据监控页面按钮 - 切换到数据视图（不刷新页面）
    const navDataPageBtn = document.getElementById('pdd-nav-data-page');
    if (navDataPageBtn) {
      navDataPageBtn.onclick = function() {
        console.log('[PDD监控] 切换到视频数据监控页面视图');
        const dataView = document.getElementById('pdd-data-view');
        const uploadView = document.getElementById('pdd-upload-view');
        const settingsView = document.getElementById('pdd-settings-view');
        const panelTitle = document.getElementById('pdd-panel-title');
        const pageTypeIndicator = document.getElementById('pdd-page-type');
        
        currentView = 'data';
        if (dataView) dataView.style.display = 'block';
        if (uploadView) uploadView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';
        if (panelTitle) panelTitle.textContent = '📊 视频数据监控';
        if (pageTypeIndicator) pageTypeIndicator.textContent = '📊 视频数据监控页面';
        
        // 更新按钮 active 状态
        navDataPageBtn.classList.add('active');
        if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
        
        localStorage.setItem('__pdd_panel_view', 'data');
      };
    }
    
    // 视频自动上传页面按钮 - 切换到上传视图（不刷新页面）
    const navAutoUploadBtn = document.getElementById('pdd-nav-auto-upload');
    if (navAutoUploadBtn) {
      navAutoUploadBtn.onclick = function() {
        console.log('[PDD监控] 切换到视频自动上传页面视图');
        const dataView = document.getElementById('pdd-data-view');
        const uploadView = document.getElementById('pdd-upload-view');
        const settingsView = document.getElementById('pdd-settings-view');
        const panelTitle = document.getElementById('pdd-panel-title');
        const pageTypeIndicator = document.getElementById('pdd-page-type');
        
        currentView = 'upload';
        if (dataView) dataView.style.display = 'none';
        if (uploadView) uploadView.style.display = 'block';
        if (settingsView) settingsView.style.display = 'none';
        if (panelTitle) panelTitle.textContent = '📹 视频自动上传';
        if (pageTypeIndicator) pageTypeIndicator.textContent = '📹 视频自动上传页面';
        
        // 更新按钮 active 状态
        navAutoUploadBtn.classList.add('active');
        if (navDataPageBtn) navDataPageBtn.classList.remove('active');
        
        localStorage.setItem('__pdd_panel_view', 'upload');
      };
    }
    
    // 初始化按钮状态
    if (currentView === 'data' && navDataPageBtn) {
      navDataPageBtn.classList.add('active');
      if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
    } else if (currentView === 'upload' && navAutoUploadBtn) {
      navAutoUploadBtn.classList.add('active');
      if (navDataPageBtn) navDataPageBtn.classList.remove('active');
    }

    // ★★★ 获取数据按钮事件绑定 ★★★
    const fetchDataBtn = document.getElementById('pdd-fetch-data-btn');
    const autoPagingBtn = document.getElementById('pdd-auto-paging-btn');
    const fetchStatusEl = document.getElementById('pdd-fetch-status');

    // 根据当前页面URL确定API端点
    function getVideoApiEndpoint() {
      const url = window.location.href;

      if (url.includes('/n-creator/video/mall-goods-video')) {
        // 商品回放视频页面 - 使用商品视频列表API
        return {
          endpoint: '/api/backbone/goods/consumer/video/list',
          params: { pageNum: 1, pageSize: 20 },
          dataPath: 'influenceVideoItemList',
          pageKey: 'pageNum'
        };
      } else if (url.includes('/n-creator/video/list') || url.includes('/n-creator/video/home')) {
        // 视频列表页面
        return {
          endpoint: '/api/backbone/goods/consumer/video/list',
          params: { pageNum: 1, pageSize: 20 },
          dataPath: 'influenceVideoItemList',
          pageKey: 'pageNum'
        };
      } else if (url.includes('/n-creator/video/replay-manage')) {
        // 回放管理页面
        return {
          endpoint: '/api/backbone/goods/consumer/video/list',
          params: { pageNum: 1, pageSize: 20 },
          dataPath: 'influenceVideoItemList',
          pageKey: 'pageNum'
        };
      }

      // 默认
      return {
        endpoint: '/api/backbone/goods/consumer/video/list',
        params: { pageNum: 1, pageSize: 20 },
        dataPath: 'influenceVideoItemList',
        pageKey: 'pageNum'
      };
    }

    // 获取单页数据
    async function fetchVideoPage(pageNum = 1) {
      const apiConfig = getVideoApiEndpoint();
      const params = { ...apiConfig.params, [apiConfig.pageKey]: pageNum };

      console.log('[PDD监控] 请求API:', apiConfig.endpoint, '参数:', params);

      const response = await fetch(apiConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[PDD监控] API响应:', data);

      return data;
    }

    // 获取所有页面的数据
    async function fetchAllVideos() {
      let allVideosCount = 0;
      let currentPage = 1;
      let hasMore = true;

      while (hasMore && currentPage <= 50) { // 最多获取50页
        try {
          const data = await fetchVideoPage(currentPage);
          const videoList = data.result?.[getVideoApiEndpoint().dataPath] || [];

          if (videoList.length === 0) {
            hasMore = false;
            break;
          }

          // 处理当前页的数据
          processVideoData(data);
          allVideosCount += videoList.length;

          fetchStatusEl.innerHTML = `<span style="color:#1565c0;">📥 已获取 ${allVideosCount} 个视频（第${currentPage}页）...</span>`;

          // 检查是否还有下一页
          const totalCount = data.result?.total || data.result?.totalCount || 0;
          const totalPage = Math.ceil(totalCount / getVideoApiEndpoint().params.pageSize);
          hasMore = currentPage < totalPage;
          currentPage++;

          // 延迟500ms避免请求过快
          await new Promise(r => setTimeout(r, 500));
        } catch (error) {
          console.error('[PDD监控] 获取第', currentPage, '页失败:', error);
          hasMore = false;
        }
      }

      updatePanel();
      return allVideosCount;
    }

    if (fetchDataBtn) {
      fetchDataBtn.onclick = async function() {
        console.log('[PDD监控] 点击获取所有数据按钮');
        fetchDataBtn.textContent = '⏳ 正在获取...';
        fetchDataBtn.disabled = true;
        fetchStatusEl.textContent = '正在请求视频列表API...';

        try {
          const count = await fetchAllVideos();
          fetchStatusEl.innerHTML = `<span style="color:#4caf50;">✅ 成功获取 ${count} 个视频数据</span>`;
        } catch (error) {
          console.error('[PDD监控] 获取数据失败:', error);
          fetchStatusEl.innerHTML = `<span style="color:#f44336;">❌ 请求失败: ${error.message}</span>`;
        }

        setTimeout(() => {
          fetchDataBtn.textContent = '⚡ 获取所有视频数据';
          fetchDataBtn.disabled = false;
        }, 2000);
      };
    }

    if (autoPagingBtn) {
      autoPagingBtn.onclick = function() {
        console.log('[PDD监控] 点击自动翻页按钮');
        startAutoPaging();
        autoPagingBtn.textContent = '⏹️ 停止翻页';
        autoPagingBtn.onclick = function() {
          stopAutoPaging();
          autoPagingBtn.textContent = '🔄 自动翻页获取';
          autoPagingBtn.onclick = arguments.callee; // 恢复原来的onclick
        };
      };
    }
    
    // 批量发布功能
    let isPublishing = false;
    let publishInterval = null;
    let pendingUploadConfig = null; // 待上传的配置
    let isWaitingForFolderSelect = false; // 是否等待文件夹选择
    
    // 检查是否在发布页面
    function checkUploadPage() {
      const url = window.location.href;
      const isPublishUrl = url.includes('/n-creator/video/home') || 
                           url.includes('/n-creator/video/publish') ||
                           url.includes('/mms/video/publish') ||
                           url.includes('/n-creator/video/replay-manage');
      
      if (isPublishUrl) {
        console.log('[PDD监控] URL检测: 在发布页面');
        return true;
      }
      
      const isOtherVideoPage = url.includes('/n-creator/video/list') &&
                               !url.includes('/n-creator/video/mall-goods-video');
      if (isOtherVideoPage) {
        console.log('[PDD监控] URL检测: 在其他视频页面（非发布页面）');
        return false;
      }
      
      const hasVideoList = document.querySelector('.video-list_itemWrap__7xLB4, [class*="video-list"]');
      const hasUploadButton = document.querySelector('.no-video_noVideoWrap__opXQS button') || 
                              document.querySelector('[class*="upload"] button');
      
      const hasPublishContainer = document.querySelector('[class*="publish-video"], [class*="video-publish"], [class*="replay-manage"]');
      
      const result = (hasVideoList || hasUploadButton || hasPublishContainer);
      console.log('[PDD监控] 发布页面检测:', { isPublishUrl, hasVideoList: !!hasVideoList, hasUploadButton: !!hasUploadButton, hasPublishContainer: !!hasPublishContainer, result });
      return result;
    }
    
    // 选择文件夹按钮
    // 保存输入框数据到 localStorage
    function saveInputData() {
      const productIdEl = document.getElementById('pdd-product-id');
      const appendFilenameSuffixEl = document.getElementById('pdd-append-filename-suffix');

      if (!productIdEl) {
        console.log('[PDD监控] 保存输入框数据: 元素不存在，跳过');
        return;
      }

      const productId = productIdEl.value || '';
      const appendFilenameSuffix = appendFilenameSuffixEl?.checked || false;
      localStorage.setItem('__pdd_input_product_id', productId);
      localStorage.setItem('__pdd_append_filename_suffix', appendFilenameSuffix ? '1' : '0');
      console.log('[PDD监控] 保存输入框数据');
    }

    // 从 localStorage 恢复输入框数据
    function restoreInputData() {
      const savedAppendFilenameSuffix = localStorage.getItem('__pdd_append_filename_suffix');

      const appendCheckbox = document.getElementById('pdd-append-filename-suffix');
      if (appendCheckbox && savedAppendFilenameSuffix !== null) {
        appendCheckbox.checked = savedAppendFilenameSuffix === '1';
      }
      console.log('[PDD监控] 恢复输入框数据');
    }

    // 绑定输入框自动保存
    const appendFilenameSuffixInput = document.getElementById('pdd-append-filename-suffix');

    if (appendFilenameSuffixInput) {
      appendFilenameSuffixInput.addEventListener('change', saveInputData);
    }

    // 页面加载时恢复输入框数据
    restoreInputData();
    
    // 商品列表数据存储
    let goodsListData = [];
    let selectedGoods = null;
    
    // 获取商品列表
    async function fetchGoodsList() {
      const goodsListEl = document.getElementById('pdd-goods-list');
      const statusEl = document.getElementById('pdd-publish-status');
      
      goodsListEl.innerHTML = `
        <div style="text-align:center;padding:20px;color:#666;">
          <div style="font-size:24px;margin-bottom:8px;">⏳</div>
          <div>正在获取商品列表...</div>
        </div>
      `;
      
      try {
        let goodsData = [];
        
        // 1. 优先使用已拦截的商品数据
        if (capturedGoodsList && capturedGoodsList.length > 0) {
          console.log('[PDD监控] 使用已拦截的商品数据:', capturedGoodsList.length, '个');
          goodsData = capturedGoodsList;
        }
        
        // 2. 尝试从缓存获取
        if (goodsData.length === 0) {
          const cached = sessionStorage.getItem('__pdd_goods_list_cache');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                console.log('[PDD监控] 使用缓存的商品数据:', parsed.length, '个');
                goodsData = parsed;
              }
            } catch (e) {}
          }
        }
        
        // 3. 尝试从inject.js拦截数据获取
        if (goodsData.length === 0 && window.__getPddInterceptedData) {
          const intercepted = window.__getPddInterceptedData();
          for (const record of intercepted) {
            if (record.response) {
              const extracted = extractGoodsFromResponse(record.response);
              if (extracted.length > 0) {
                console.log('[PDD监控] 从拦截数据提取商品:', extracted.length, '个');
                goodsData = extracted;
                break;
              }
            }
          }
        }
        
        // 4. 尝试从页面DOM获取
        if (goodsData.length === 0) {
          goodsData = extractGoodsFromPage();
        }
        
        if (goodsData.length > 0) {
          // 合并到 capturedGoodsList
          const existingMap = new Map(capturedGoodsList.map(g => [g.goodsId || g.goods_id || g.id, g]));
          goodsData.forEach(g => {
            const id = g.goodsId || g.goods_id || g.id;
            existingMap.set(id, g);
          });
          capturedGoodsList = Array.from(existingMap.values());
          
          goodsListData = capturedGoodsList;
          updateGoodsListUI();
          
          // 保存到缓存
          sessionStorage.setItem('__pdd_goods_list_cache', JSON.stringify(capturedGoodsList));
        } else {
          goodsListEl.innerHTML = `
            <div style="text-align:center;padding:20px;color:#666;">
              <div style="margin-bottom:8px;display:inline-flex;align-items:center;justify-content:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <circle cx="8.5" cy="8.5" r="1.5"></circle>
                  <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
              </div>
              <div>暂无商品数据</div>
              <div style="font-size:11px;margin-top:4px;color:#999;">请浏览商品页面，数据将自动获取</div>
            </div>
          `;
        }
      } catch (e) {
        console.error('[PDD监控] 获取商品列表失败:', e);
        goodsListEl.innerHTML = `
          <div style="text-align:center;padding:20px;color:#f44336;">
            <div style="font-size:24px;margin-bottom:8px;">❌</div>
            <div>获取失败: ${e.message}</div>
          </div>
        `;
      }
    }
    
    // 从API响应中提取商品列表
    function extractGoodsFromResponse(data) {
      const goods = [];
      if (!data) return goods;
      
      let list = null;
      if (data.result) {
        list = data.result.goods_info_list || data.result.list || data.result.goodsList;
      }
      if (data.data) {
        list = list || data.data.list || data.data.goodsList || data.data.goods_info_list;
      }
      
      if (Array.isArray(list)) {
        list.forEach(item => {
          const id = item.goods_id || item.goodsId || item.productId || item.id || item.gid;
          if (id) {
            goods.push({
              goodsId: String(id),
              goodsName: item.goods_name || item.title || item.name || item.goodsName || `商品 ${id}`,
              goodsImage: item.goodsImage || item.image || item.imageUrl || item.thumbUrl || item.cover || item.pic_url || ''
            });
          }
        });
      }
      
      return goods;
    }
    
    // 从页面DOM提取商品信息
    function extractGoodsFromPage() {
      const goods = [];
      const seen = new Set();
      
      // 尝试从各种可能的元素中提取
      const selectors = [
        '[class*="goods-item"]',
        '[class*="goodsItem"]',
        '[class*="product-item"]',
        '[class*="productItem"]',
        '[data-goods-id]',
        '[data-product-id]'
      ];
      
      for (const selector of selectors) {
        const items = document.querySelectorAll(selector);
        for (const item of items) {
          const goodsId = item.getAttribute('data-goods-id') || 
                         item.getAttribute('data-product-id') ||
                         item.getAttribute('data-id');
          
          if (goodsId && !seen.has(goodsId)) {
            seen.add(goodsId);
            
            // 尝试获取商品名称和图片
            const nameEl = item.querySelector('[class*="name"], [class*="title"], h3, h4, .goods-name, .product-name');
            const imgEl = item.querySelector('img');
            
            goods.push({
              goodsId: goodsId,
              goodsName: nameEl?.textContent?.trim() || `商品 ${goodsId}`,
              imageUrl: imgEl?.src || ''
            });
          }
        }
      }
      
      return goods;
    }
    
    // 渲染商品列表
    let renderGoodsListEventBound = false;
    
    function renderGoodsList(goods) {
      const goodsListEl = document.getElementById('pdd-goods-list');
      
      if (goods.length === 0) {
        goodsListEl.innerHTML = `
          <div style="text-align:center;padding:20px;color:#666;">
            <div style="margin-bottom:8px;display:inline-flex;align-items:center;justify-content:center;">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.5;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>
            <div>暂无商品</div>
          </div>
        `;
        return;
      }
      
      // 使用 DocumentFragment 批量构建 DOM
      const fragment = document.createDocumentFragment();
      
      goods.forEach((item, index) => {
        const id = item.goodsId || item.goods_id || item.productId || item.id;
        const name = item.goodsName || item.goods_name || item.productName || item.name || `商品 ${id}`;
        const image = item.goodsImage || item.imageUrl || item.image || item.cover || item.thumbUrl || item.pic_url || '';
        
        const div = document.createElement('div');
        div.className = 'pdd-goods-item';
        div.dataset.goodsId = id;
        div.dataset.index = index;
        div.style.cssText = 'display:flex;align-items:center;padding:10px;border-bottom:1px solid #eee;cursor:pointer;transition:background 0.2s;';
        div.innerHTML = `
          <div style="width:50px;height:50px;border-radius:4px;overflow:hidden;background:#f0f0f0;flex-shrink:0;">
            ${image ? `<img src="${image}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#999;">📦</div>'}
          </div>
          <div style="flex:1;margin-left:10px;overflow:hidden;">
            <div style="font-size:12px;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
            <div style="font-size:10px;color:#999;margin-top:2px;">ID: ${id}</div>
          </div>
          <button class="pdd-publish-btn" data-index="${index}" style="padding:6px 12px;background:linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;flex-shrink:0;">
            发布
          </button>
        `;
        fragment.appendChild(div);
      });
      
      goodsListEl.innerHTML = '';
      goodsListEl.appendChild(fragment);
      
      // 只绑定一次事件委托
      if (!renderGoodsListEventBound) {
        renderGoodsListEventBound = true;
        
        // 点击事件委托
        goodsListEl.addEventListener('click', function(e) {
          const btn = e.target.closest('.pdd-publish-btn');
          if (btn) {
            e.stopPropagation();
            e.preventDefault();
            const index = parseInt(btn.dataset.index);
            const goodsItem = goods[index];
            if (goodsItem) {
              selectGoodsForPublish(goodsItem);
            }
            return;
          }
          
          const item = e.target.closest('.pdd-goods-item');
          if (item && !e.target.closest('.pdd-publish-btn')) {
            const goodsId = item.dataset.goodsId;
            const goodsItem = goods.find(g => (g.goodsId || g.goods_id || g.productId || g.id) == goodsId);
            if (goodsItem) {
              selectGoodsForPublish(goodsItem);
            }
          }
        });
        
        // hover 事件委托
        goodsListEl.addEventListener('mouseover', function(e) {
          const item = e.target.closest('.pdd-goods-item');
          if (item) item.style.background = '#f5f5f5';
        });
        
        goodsListEl.addEventListener('mouseout', function(e) {
          const item = e.target.closest('.pdd-goods-item');
          if (item) item.style.background = 'white';
        });
      }
    }
    
    // 选择商品准备发布
    async function selectGoodsForPublish(goods) {
      console.log('[PDD监控] selectGoodsForPublish 被调用:', goods ? goods.goodsName || goods.goods_id : 'null');
      
      selectedGoods = goods;
      
      const id = goods.goodsId || goods.goods_id || goods.productId || goods.id;
      const name = goods.goodsName || goods.goods_name || goods.productName || goods.name || `商品 ${id}`;
      
      // 检查 URL 是否是视频发布页面或商品回放管理页面
      const url = window.location.href;
      const isVideoPublishUrl = url.includes('/n-creator/video/home') || 
                                url.includes('/n-creator/video/publish') ||
                                url.includes('/mms/video/publish') ||
                                url.includes('/n-creator/video/replay-manage');
      
      console.log('[PDD监控] 是否在视频发布页面:', isVideoPublishUrl, 'URL:', url);
      
      // 如果不在视频发布页面，保存信息并导航
      if (!isVideoPublishUrl) {
        // 保存选择的商品信息到 localStorage，页面跳转后恢复
        const goodsInfo = {
          id: id,
          name: name,
          goods: goods,
          timestamp: Date.now()
        };
        localStorage.setItem('__pdd_selected_goods', JSON.stringify(goodsInfo));
        console.log('[PDD监控] 已保存选择的商品信息到 localStorage');
        
        // 尝试导航到视频发布页面
        console.log('[PDD监控] 尝试导航到视频发布页面...');
        const navigated = await navigateToVideoUploadPage();
        
        if (!navigated) {
          console.log('[PDD监控] 自动导航失败，停留在当前页面');
          // 显示提示
          const statusEl = document.getElementById('pdd-publish-status');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.innerHTML = '<div style="color:#e65100;">⚠️ 请手动点击左侧菜单"多多视频" → "发布视频"进入发布页面</div>';
          }
        } else {
          console.log('[PDD监控] 导航成功，页面即将跳转...');
          // 页面跳转后，后续代码不会执行，直接返回
          return;
        }
      }
      
      // 确保面板已打开
      const panel = document.getElementById('pdd-video-monitor');
      console.log('[PDD监控] 面板状态:', panel ? (panel.classList.contains('show') ? '已打开' : '未打开') : '未找到');
      if (panel && !panel.classList.contains('show')) {
        // 打开面板
        panel.classList.add('show');
        document.body.classList.add('pdd-sidebar-open');
        adjustPageLayout(true);
        console.log('[PDD监控] 已直接打开面板');
      }
      
      // 切换到上传视图
      const dataView = document.getElementById('pdd-data-view');
      const uploadView = document.getElementById('pdd-upload-view');
      const panelTitle = document.getElementById('pdd-panel-title');
      const pageTypeIndicator = document.getElementById('pdd-page-type');
      const navDataPageBtn = document.getElementById('pdd-nav-data-page');
      const navAutoUploadBtn = document.getElementById('pdd-nav-auto-upload');
      
      console.log('[PDD监控] 视图元素:', { dataView: !!dataView, uploadView: !!uploadView });
      
      // 先切换视图
      if (dataView) dataView.style.display = 'none';
      if (uploadView) {
        uploadView.style.display = 'block';
        console.log('[PDD监控] 已显示上传视图');
      }
      
      // 更新标题和按钮状态
      if (panelTitle) panelTitle.textContent = '📹 视频自动上传';
      if (pageTypeIndicator) pageTypeIndicator.textContent = '📹 视频自动上传页面';
      if (navAutoUploadBtn) navAutoUploadBtn.classList.add('active');
      if (navDataPageBtn) navDataPageBtn.classList.remove('active');
      localStorage.setItem('__pdd_panel_view', 'upload');
      
      // 显示发布配置区域
      const configSection = document.getElementById('pdd-publish-config');
      const selectedInfo = document.getElementById('pdd-selected-goods-info');
      const customGoodsIdInput = document.getElementById('pdd-custom-goods-id');

      console.log('[PDD监控] 配置区域:', { configSection: !!configSection, selectedInfo: !!selectedInfo });
      
      if (configSection) {
        configSection.style.display = 'block';
        console.log('[PDD监控] 已显示配置区域');
      }
      
      // 更新商品信息显示
      if (selectedInfo) {
        selectedInfo.innerHTML = `<span style="font-size:14px;">📦</span> ${name}`;
      }

      // 更新商品ID显示区域
      const goodsIdDisplay = document.getElementById('display-goods-id');
      if (goodsIdDisplay) {
        goodsIdDisplay.textContent = id;
      }

      // 填充自定义商品ID输入框（默认使用当前商品ID）
      if (customGoodsIdInput) {
        customGoodsIdInput.value = id;
      }

      // 绑定"换一个"按钮
      const changeBtn = document.getElementById('pdd-change-goods-btn');
      if (changeBtn && !changeBtn._bound) {
        changeBtn._bound = true;
        changeBtn.addEventListener('click', function() {
          selectedGoods = null;
          const cfgSection = document.getElementById('pdd-publish-config');
          if (cfgSection) cfgSection.style.display = 'none';
          const goodsSection = document.getElementById('pdd-goods-section');
          if (goodsSection) goodsSection.scrollIntoView({ behavior: 'smooth' });
          updateUploadButtonState();
        });
      }

      // 更新上传按钮状态
      updateUploadButtonState();

      // 滚动到配置区域
      const cfgScroll = document.getElementById('pdd-publish-config');
      if (cfgScroll) {
        setTimeout(() => {
          cfgScroll.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }

      console.log('[PDD监控] 已选择商品完成:', goods);
    }
    
    // 上传按钮状态管理：根据选择状态动态切换文案和样式
    function updateUploadButtonState() {
      const btn = document.getElementById('pdd-start-upload');
      const countEl = document.getElementById('pdd-upload-count');
      if (!btn) return;

      const hasGoods = !!selectedGoods;
      const hasFiles = accumulatedFiles && accumulatedFiles.length > 0;
      const hasCached = cachedVideoFiles && cachedVideoFiles.length > 0;
      // 标记按钮是否就绪（onclick 内部会检查此标记）
      btn._uploadReady = hasGoods && (hasFiles || hasCached);

      if (!hasGoods) {
        // 未选商品
        btn.style.background = 'linear-gradient(135deg, #ccc, #bbb)';
        btn.style.color = '#999';
        btn.style.cursor = 'not-allowed';
        btn.style.boxShadow = 'none';
        btn.innerHTML = '请先选择商品';
      } else if (!hasFiles && !hasCached) {
        // 已选商品但未选文件
        btn.style.background = 'linear-gradient(135deg, #fbbf24, #f59e0b)';
        btn.style.color = '#78350f';
        btn.style.cursor = 'not-allowed';
        btn.style.boxShadow = 'none';
        btn.innerHTML = '请选择视频文件（下方按钮）';
      } else {
        // 可以上传
        const fileCount = hasFiles ? accumulatedFiles.length : cachedVideoFiles.length;
        btn.style.background = 'linear-gradient(135deg, #f43f5e, #e11d48)';
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.style.boxShadow = '0 4px 16px rgba(244, 63, 94, 0.35)';
        btn.innerHTML = `🚀 开始上传 (${fileCount}个视频)`;
      }

      if (countEl) countEl.textContent = hasFiles ? accumulatedFiles.length : (cachedVideoFiles.length || 0);
    }
    
    // 暴露到全局供 updateGoodsListUI 调用
    window.__selectGoodsForPublish = selectGoodsForPublish;

    // 更新商品数量和状态显示
    function updateGoodsCount() {
      const countEl = document.getElementById('pdd-goods-count');
      const statusEl = document.getElementById('pdd-goods-status');
      if (countEl) {
        countEl.textContent = `(${capturedGoodsList.length}个商品)`;
      }
      if (statusEl && capturedGoodsList.length > 0) {
        statusEl.innerHTML = '<span style="color:#4caf50;">● 已更新</span>';
      }
    }
    
    // 页面加载时自动获取商品列表
    let goodsListLoaded = false;
    function loadGoodsListOnce() {
      if (goodsListLoaded) return;
      goodsListLoaded = true;
      
      // 先尝试从缓存加载
      const cached = sessionStorage.getItem('__pdd_goods_list_cache');
      if (cached) {
        try {
          const cachedGoods = JSON.parse(cached);
          if (Array.isArray(cachedGoods) && cachedGoods.length > 0) {
            // 同步到 capturedGoodsList，确保数据一致性
            capturedGoodsList = cachedGoods;
            goodsListData = cachedGoods;
            updateGoodsListUI();
            updateGoodsCount();
            return;
          }
        } catch (e) {}
      }
      fetchGoodsList();
    }
    
    // 暴露到全局供面板打开时调用
    window.__loadGoodsListOnce = loadGoodsListOnce;
    
    // 延迟加载商品列表（面板打开时才加载）
    setTimeout(loadGoodsListOnce, 2000);
    
    // 监听商品数据变化，自动更新列表
    const originalRenderGoodsList = renderGoodsList;
    renderGoodsList = function(goods) {
      originalRenderGoodsList(goods);
      updateGoodsCount();
    };
    
    // 多文件夹累积存储
    let accumulatedFiles = [];
    let folderPaths = [];

    // 视频缓存（用于换商品ID后重复上传）
    let cachedVideoFiles = [];

    // ========== 多选文件夹：公共函数 ==========

    const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

    // 扫描单个目录（File System Access API），返回视频文件数组
    async function scanDirectoryForVideos(dirHandle) {
      const videoFiles = [];

      async function scanDir(handle, basePath = '') {
        for await (const entry of handle.values()) {
          if (entry.kind === 'file') {
            const ext = entry.name.toLowerCase().split('.').pop();
            if (VIDEO_EXTS.includes(ext)) {
              const file = await entry.getFile();
              const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
              videoFiles.push({
                name: entry.name,
                file: file,
                size: file.size,
                folderPath: dirHandle.name + (basePath ? `/${basePath}` : ''),
                relativePath: relativePath
              });
            }
          } else if (entry.kind === 'directory') {
            const subPath = basePath ? `${basePath}/${entry.name}` : entry.name;
            await scanDir(entry, subPath);
          }
        }
      }

      await scanDir(dirHandle);
      return videoFiles;
    }

    // 将一批视频文件去重后加入累积列表，返回 { added, total, skipped }
    function addVideoFilesToAccumulator(newVideoFiles, sourceFolderName) {
      let addedCount = 0;
      let skippedCount = 0;

      newVideoFiles.forEach(newFile => {
        const exists = accumulatedFiles.some(existing =>
          existing.name === newFile.name && existing.size === newFile.size
        );
        if (!exists) {
          accumulatedFiles.push(newFile);
          addedCount++;
        } else {
          skippedCount++;
        }
      });

      // 记录来源文件夹路径
      if (sourceFolderName && !folderPaths.includes(sourceFolderName)) {
        folderPaths.push(sourceFolderName);
      }

      // 同步到 pendingUploadConfig
      if (pendingUploadConfig) {
        pendingUploadConfig.files = accumulatedFiles;
      }

      return { added: addedCount, total: accumulatedFiles.length, skipped: skippedCount };
    }

    // ★ 核心：多选文件夹循环
    // 调用 showDirectoryPicker 循环，用户每次选一个文件夹后自动弹出下一个对话框
    // 直到用户按 Cancel 或达到可选的最大数量
    //
    // 参数:
    //   options.statusEl         - 状态显示元素
    //   options.onStart()        - 开始选择时回调（首次）
    //   options.onEachFolder(result) - 每选择一个文件夹回调  result: { name, added, total }
    //   options.onComplete(summary) - 全部完成（用户Cancel）回调  summary: { folders, totalFiles }
    //   options.maxFolders       - 最大文件夹数限制（默认无限制）
    //   options.initialPrompt    - 首次提示文字
    //   options.continuePrompt   - 继续选择提示文字
    //
    async function selectMultipleFolders(options = {}) {
      const {
        statusEl,
        onStart,
        onEachFolder,
        onComplete,
        maxFolders = 0,       // 0 = 无限制
        initialPrompt = '📂 请选择视频文件夹（可多选）...',
        continuePrompt = '✅ 已选{N}个文件夹，继续选择下一个或【取消】结束...',
        isAddMoreMode = false  // 是否为"添加更多"模式
      } = options;

      let selectedFolderCount = 0;
      let totalAddedFiles = 0;

      // 首次开始回调
      if (onStart) onStart();

      // 只支持 File System Access API 的多选循环
      if (!('showDirectoryPicker' in window)) {
        // 回退模式：只能单选
        statusEl.innerHTML = `<div style="color:#1565c0;">📂 请选择视频文件夹...</div>`;
        isWaitingForFolderSelect = true;
        document.getElementById('pdd-folder-input').click();
        return { folders: 0, totalFiles: 0 };
      }

      while (true) {
        // 检查是否超过最大文件夹数限制
        if (maxFolders > 0 && selectedFolderCount >= maxFolders) {
          statusEl.innerHTML = `<div style="color:#e65100;">⚠️ 已达最大文件夹数限制 (${maxFolders}个)</div>`;
          break;
        }

        // 更新提示文字
        const promptText = selectedFolderCount > 0
          ? continuePrompt.replace('{N}', selectedFolderCount)
          : initialPrompt;
        statusEl.innerHTML = `<div style="color:#1565c0;">${promptText}</div>`;

        // 弹出文件夹选择对话框
        let dirHandle;
        try {
          dirHandle = await window.showDirectoryPicker();
        } catch (e) {
          if (e.name === 'AbortError') {
            // 用户按了 Cancel → 结束多选
            console.log('[PDD监控] 多选文件夹: 用户取消选择');
            break;
          }
          console.error('[PDD监控] showDirectoryPicker 异常:', e);
          statusEl.innerHTML = `<div style="color:#f44336;">❌ 选择文件夹出错: ${e.message}</div>`;
          break;
        }

        selectedFolderCount++;
        const folderName = dirHandle.name;
        console.log(`[PDD监控] 多选文件夹 [${selectedFolderCount}]:`, folderName);

        // 扫描文件夹中的视频文件
        try {
          const videoFiles = await scanDirectoryForVideos(dirHandle);

          if (videoFiles.length === 0) {
            statusEl.innerHTML = `<div style="color:#e65100;">
              ⚠️ 文件夹 "${folderName}" 中没有视频文件<br>
              <span style="font-size:11px;color:#999;">已选 ${selectedFolderCount - 1} 个文件夹，继续选择或取消</span>
            </div>`;

            // 空文件夹也记录（但不算有效文件夹用于计数？还是算？算吧，用户确实选了）
            if (onEachFolder) {
              onEachFolder({ name: folderName, added: 0, total: accumulatedFiles.length, isEmpty: true });
            }

            // 空文件夹也记录路径
            if (!folderPaths.includes(folderName)) {
              folderPaths.push(folderName);
            }

            // 不 continue，让用户有机会取消或继续
            await new Promise(r => setTimeout(r, 600));
            continue;
          }

          // 去重并累积
          const result = addVideoFilesToAccumulator(videoFiles, folderName);
          totalAddedFiles += result.added;

          console.log(`[PDD监控] 多选文件夹 "${folderName}": +${result.added} 视频(跳过${result.skipped}), 累计 ${result.total}`);

          // 更新显示
          updateFolderDisplay();

          // 单个文件夹回调
          if (onEachFolder) {
            onEachFolder({ name: folderName, added: result.added, total: result.total, skipped: result.skipped });
          }

          // 更新状态提示
          statusEl.innerHTML = `<div style="color:#2e7d32;">
            ✅ "${folderName}" +${result.added} 个视频 ${result.skipped > 0 ? `(${result.skipped}重复跳过)` : ''},
            累计 ${result.total} 个 · 已选 ${selectedFolderCount} 个文件夹
          </div>
          <div style="margin-top:4px;color:#1565c0;font-size:11px;">🔄 将自动弹出下一个文件夹选择...</div>`;

          // 短暂延迟后再弹下一个，让用户看到当前状态
          await new Promise(r => setTimeout(r, 800));

        } catch (scanErr) {
          console.error('[PDD监控] 扫描文件夹异常:', scanErr);
          statusEl.innerHTML = `<div style="color:#f44336;">❌ 扫描 "${folderName}" 失败: ${scanErr.message}<br><span style="font-size:11px;">将尝试选择下一个...</span></div>`;
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // 全部完成
      const summary = { folders: selectedFolderCount, totalFiles: accumulatedFiles.length, totalAdded: totalAddedFiles };

      if (summary.folders > 0) {
        statusEl.innerHTML = `<div style="color:#2e7d32;">
          ✅ 多选完成！共选择了 <b>${summary.folders}</b> 个文件夹，
          <b>${summary.totalFiles}</b> 个视频文件
          ${totalAddedFiles !== summary.totalFiles ? `(${summary.totalFiles - totalAddedFiles}个来自之前选择)` : ''}
        </div>
        <div style="margin-top:4px;color:#1565c0;font-size:11px;">💡 可点击下方按钮继续添加更多文件夹</div>`;
      } else {
        statusEl.innerHTML = `<div style="color:#666;">已取消选择</div>`;
      }

      if (onComplete) onComplete(summary);

      return summary;
    }
    
    function updateCachedVideosDisplay() {
      const container = document.getElementById('pdd-cached-videos-area');
      const listEl = document.getElementById('pdd-cached-video-list');
      const countBadge = document.getElementById('pdd-cached-count-badge');
      
      if (cachedVideoFiles.length > 0) {
        container.style.display = 'block';
        countBadge.textContent = cachedVideoFiles.length + '个';
        
        // 显示视频列表（最多显示10个）
        const displayFiles = cachedVideoFiles.slice(0, 10);
        let listHtml = displayFiles.map((f, i) => `${i + 1}. ${f.name}`).join('<br>');
        if (cachedVideoFiles.length > 10) {
          listHtml += `<br>... 还有 ${cachedVideoFiles.length - 10} 个视频`;
        }
        listEl.innerHTML = listHtml;
      } else {
        container.style.display = 'none';
      }

      // 更新上传按钮状态
      updateUploadButtonState();
    }

    function updateFolderDisplay() {
      const container = document.getElementById('pdd-selected-folders');
      const listEl = document.getElementById('pdd-folder-list');
      const countEl = document.getElementById('pdd-total-count');

      if (accumulatedFiles.length === 0) {
        container.style.display = 'none';
        updateUploadButtonState();
        return;
      }

      container.style.display = 'block';
      updateUploadButtonState();

      // 按来源文件夹分组
      const folderGroups = {};
      accumulatedFiles.forEach(f => {
        const folder = f.folderPath || '未知文件夹';
        if (!folderGroups[folder]) {
          folderGroups[folder] = [];
        }
        folderGroups[folder].push(f);
      });

      const folderCount = Object.keys(folderGroups).length;

      let html = '';
      Object.keys(folderGroups).forEach((folder) => {
        const files = folderGroups[folder];
        const folderName = folder.split(/[/\\]/).pop() || folder;
        const totalSizeMB = (files.reduce((s, f) => s + (f.size || 0), 0) / 1024 / 1024).toFixed(1);

        html += `<div style="margin-bottom:6px;padding:8px;background:#fff;border-radius:6px;border:1px solid #e8edf3;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-weight:600;color:#1976d2;font-size:12px;">📁 ${folderName}
              <span style="color:#888;font-weight:400;margin-left:4px;">(${files.length}个视频 · ${totalSizeMB}MB)</span>
            </div>
            <button data-remove-folder="${encodeURIComponent(folder)}"
              style="padding:1px 7px;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:4px;cursor:pointer;font-size:10px;font-weight:600;line-height:1.4;"
              onmouseover="this.style.background='#fee2e2'"
              onmouseout="this.style.background='#fef2f2'"
              title="移除此文件夹的所有视频">✕</button>
          </div>
          <div style="max-height:${folderCount > 1 ? '50' : '60'}px;overflow-y:auto;padding-left:6px;font-size:11px;">
            ${files.slice(0, folderCount > 1 ? 4 : 5).map(f => `<div style="color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${f.name} · ${(f.size/1024/1024).toFixed(1)}MB">• ${f.name}</div>`).join('')}
            ${files.length > (folderCount > 1 ? 4 : 5) ? `<div style="color:#999;">... 还有 ${files.length - (folderCount > 1 ? 4 : 5)} 个文件</div>` : ''}
          </div>
        </div>`;
      });

      listEl.innerHTML = html;

      // 绑定单个文件夹的删除事件
      listEl.querySelectorAll('[data-remove-folder]').forEach(btn => {
        btn.onclick = function() {
          const targetPath = decodeURIComponent(this.getAttribute('data-remove-folder'));
          // 移除该文件夹下的所有文件
          const before = accumulatedFiles.length;
          accumulatedFiles = accumulatedFiles.filter(f => f.folderPath !== targetPath);
          const removed = before - accumulatedFiles.length;

          // 从 folderPaths 中也移除
          folderPaths = folderPaths.filter(fp => fp !== targetPath);

          console.log('[PDD监控] 移除文件夹 "' + targetPath.split('/').pop() + targetPath.split('\\').pop() || targetPath + '": -' + removed + ' 视频, 剩余 ' + accumulatedFiles.length);

          // 同步 pendingUploadConfig
          if (pendingUploadConfig) {
            pendingUploadConfig.files = accumulatedFiles;
          }

          updateFolderDisplay();

          // 状态提示
          const statusEl = document.getElementById('pdd-publish-status');
          if (statusEl && accumulatedFiles.length > 0) {
            statusEl.innerHTML = '<div style="color:#e65100;">已移除 "' + (targetPath.split(/[/\\]/).pop() || targetPath) + '" 的 ' + removed + ' 个视频，剩余 ' + accumulatedFiles.length + ' 个</div>';
          }
        };
      });

      // 底部汇总信息
      const totalSizeMB = (accumulatedFiles.reduce((s, f) => s + (f.size || 0), 0) / 1024 / 1024).toFixed(1);
      countEl.innerHTML = '<span>共 <b>' + accumulatedFiles.length + '</b> 个视频 (' + totalSizeMB + 'MB) · 来自 <b>' + folderCount + '</b> 个文件夹</span>'
        + (folderCount > 1 ? '<br><span style="font-size:10px;color:#999;">💡 点击 ✕ 可单独移除某个文件夹</span>' : '');
    }
    
    document.getElementById('pdd-clear-files').onclick = function() {
      accumulatedFiles = [];
      folderPaths = [];
      updateFolderDisplay();
      document.getElementById('pdd-publish-status').style.display = 'none';
    };

    // 添加更多文件夹按钮（多选模式，追加到已有列表）
    document.getElementById('pdd-add-more-folders').onclick = async function() {
      console.log('[PDD监控] 点击添加更多文件夹按钮（多选模式）');

      const statusEl = document.getElementById('pdd-publish-status');
      statusEl.style.display = 'block';

      // ★ 多选文件夹循环（追加模式，不清空已有文件）
      await selectMultipleFolders({
        statusEl: statusEl,
        isAddMoreMode: true,
        initialPrompt: '📂 请选择要添加的文件夹（可连续选择多个）...',
        continuePrompt: '✅ 本次已选 <b>{N}</b> 个文件夹，继续添加或按【取消】结束...',

        onEachFolder: (result) => {
          if (result.isEmpty) {
            console.log(`[PDD监控] [追加] 文件夹 "${result.name}" 为空`);
          } else {
            console.log(`[PDD监控] [追加] ✅ "${result.name}": +${result.added} 视频`);
          }
        },

        onComplete: (summary) => {
          console.log(`[PDD监控] [追加] 完成: +${summary.folders}个文件夹, 总计${summary.totalFiles}个视频`);
        }
      });
    };
    
    document.getElementById('pdd-select-videos').onclick = async function() {
      console.log('[PDD监控] 点击选择视频按钮');
      
      const statusEl = document.getElementById('pdd-publish-status');
      
      if (!selectedGoods) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#e65100;">⚠️ 请先从商品列表中选择一个商品</div>`;
        return;
      }

      if (!checkUploadPage()) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#1565c0;">🔄 正在自动跳转到视频发布页面...</div>`;

        // 自动跳转到发布页面
        const navigated = await navigateToVideoUploadPage();
        if (!navigated) {
          statusEl.innerHTML = `<div style="color:#f44336; padding: 10px;">
            ❌ 自动跳转失败，请手动导航<br>
            <span style="font-size: 12px; color: #666;">点击左侧菜单"多多视频" → "发布视频"进入发布页面</span>
          </div>`;
          return;
        }

        // 等待页面加载
        statusEl.innerHTML = `<div style="color:#1565c0;">✅ 已跳转到发布页面，正在准备选择文件...</div>`;
        await new Promise(r => setTimeout(r, 1500));
      }

      const customGoodsId = document.getElementById('pdd-custom-goods-id')?.value.trim();
      const goodsId = customGoodsId || selectedGoods.goodsId || selectedGoods.goods_id || selectedGoods.productId || selectedGoods.id;
      const appendFilenameSuffix = document.getElementById('pdd-append-filename-suffix')?.checked || false;
      const description = document.getElementById('pdd-video-description')?.value.trim() || null;
      const contentDeclaration = document.getElementById('pdd-content-declaration')?.value || null;

      console.log('[PDD监控] ★ 上传配置读取: 商品ID=' + goodsId + ', 描述=' + (description || '(空)') + ', 内容声明=' + (contentDeclaration || '(空)'));

      pendingUploadConfig = {
        pidList: [String(goodsId)],
        appendFilenameSuffix: appendFilenameSuffix,
        description: description,
        contentDeclaration: contentDeclaration,
        files: accumulatedFiles,
        currentIndex: 0,
        source: 'videos',
        isAccumulated: true
      };
      
      statusEl.style.display = 'block';
      statusEl.innerHTML = `<div style="color:#1565c0;">🎬 请选择视频文件...</div>`;
      
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'video/*,.mp4,.webm,.mov,.avi,.mkv';
      
      input.onchange = async function(e) {
        const files = Array.from(e.target.files);
        const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
        const videoFiles = files.filter(f => {
          const ext = f.name.toLowerCase().split('.').pop();
          return videoExts.includes(ext);
        });
        
        if (videoFiles.length === 0) {
          statusEl.innerHTML = `<div style="color:#e65100;">⚠️ 没有选择有效的视频文件</div>`;
          return;
        }
        
        let addedCount = 0;
        videoFiles.forEach(f => {
          const exists = accumulatedFiles.some(existing => 
            existing.name === f.name && existing.size === f.size
          );
          if (!exists) {
            accumulatedFiles.push({
              name: f.name,
              file: f,
              size: f.size,
              folderPath: '直接选择'
            });
            addedCount++;
          }
        });
        
        if (pendingUploadConfig) {
          pendingUploadConfig.files = accumulatedFiles;
        }
        
        updateFolderDisplay();
        
        statusEl.innerHTML = `<div style="color:#2e7d32;">✅ 已添加 ${addedCount} 个视频，累计 ${accumulatedFiles.length} 个</div>
          <div style="margin-top:4px;color:#1565c0;">可继续选择视频，或点击下方开始上传</div>`;
      };
      
      input.click();
    };
    
    document.getElementById('pdd-start-upload').onclick = async function() {
      const btn = this;
      // 状态检查：未选商品或未选文件时拦截
      if (!btn._uploadReady) {
        if (!selectedGoods) {
          alert('请先选择一个商品');
        } else {
          alert('请先选择视频文件');
        }
        return;
      }

      console.log('[PDD监控] ★★★ 点击开始上传按钮 ★★★');
      console.log('[PDD监控] accumulatedFiles数量:', accumulatedFiles.length);
      
      if (accumulatedFiles.length === 0) {
        console.log('[PDD监控] 没有文件，返回');
        return;
      }
      
      // 保存到缓存（用于换商品ID后重复上传）
      cachedVideoFiles = [...accumulatedFiles];
      updateCachedVideosDisplay();
      console.log('[PDD监控] 已缓存', cachedVideoFiles.length, '个视频');
      
      const statusEl = document.getElementById('pdd-publish-status');
      if (!statusEl) {
        console.error('[PDD监控] 找不到状态元素 pdd-publish-status');
        return;
      }
      
      // 检查是否在发布页面
      const isUploadPage = checkUploadPage();
      console.log('[PDD监控] 是否在发布页面:', isUploadPage);
      
      if (!isUploadPage) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = '<div style="color:#1565c0;">🔄 正在导航到视频发布页面...</div>';
        
        // 尝试自动导航到视频发布页面
        const navigated = await navigateToVideoUploadPage();
        console.log('[PDD监控] 导航结果:', navigated);
        if (!navigated) {
          statusEl.innerHTML = `<div style="color:#f44336; padding: 10px;">
            ❌ 当前不在视频发布页面<br>
            <span style="font-size: 12px; color: #666;">请先点击左侧菜单"多多视频" → "发布视频"进入发布页面</span><br><br>
            <button id="pdd-goto-publish-btn-2" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; margin-top: 5px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
              🚀 一键跳转到发布视频页面
            </button>
          </div>`;
          const gotoBtn2 = document.getElementById('pdd-goto-publish-btn-2');
          if (gotoBtn2) {
            gotoBtn2.onclick = async function() {
              gotoBtn2.textContent = '⏳ 正在跳转...';
              gotoBtn2.disabled = true;
              const navigated = await navigateToVideoUploadPage();
              if (!navigated) {
                gotoBtn2.textContent = '❌ 跳转失败，请手动导航';
                setTimeout(() => { gotoBtn2.textContent = '🚀 一键跳转到发布视频页面'; gotoBtn2.disabled = false; }, 2000);
              }
            };
          }
          return;
        }
        
        // 等待页面加载
        await new Promise(r => setTimeout(r, 2000));
      }
      
      console.log('[PDD监控] 准备配置上传参数...');
      
      if (!pendingUploadConfig) {
        const productIds = document.getElementById('pdd-custom-goods-id')?.value.trim() || '';
        const appendFilenameSuffix = document.getElementById('pdd-append-filename-suffix')?.checked || false;
        const description = document.getElementById('pdd-video-description')?.value.trim() || null;
        const contentDeclaration = document.getElementById('pdd-content-declaration')?.value || null;
        const pidList = productIds.split(',').map(p => p.trim()).filter(p => p);
        
        console.log('[PDD监控] 商品ID列表:', pidList);
        console.log('[PDD监控] 添加文件名后缀:', appendFilenameSuffix);
        console.log('[PDD监控] 视频描述:', description);
        console.log('[PDD监控] 内容声明:', contentDeclaration);
        
        pendingUploadConfig = {
          pidList: pidList,
          appendFilenameSuffix: appendFilenameSuffix,
          description: description,
          contentDeclaration: contentDeclaration,
          files: accumulatedFiles,
          currentIndex: 0,
          source: 'folder',
          isAccumulated: true
        };
      } else {
        pendingUploadConfig.files = accumulatedFiles;
        console.log('[PDD监控] 更新已有配置的文件列表');
      }
      
      console.log('[PDD监控] 开始上传，共', accumulatedFiles.length, '个文件');
      console.log('[PDD监控] pendingUploadConfig:', JSON.stringify({
        pidList: pendingUploadConfig.pidList,
        filesCount: pendingUploadConfig.files.length
      }));

      // ★ 关键：在上传开始前，一次性填充页面全局内容声明（不是每个视频单独填充）
      if (pendingUploadConfig.contentDeclaration) {
        console.log('[PDD监控] ★ 上传前预填全局内容声明:', pendingUploadConfig.contentDeclaration);
        try {
          const declResult = await fillContentDeclaration(pendingUploadConfig.contentDeclaration);
          console.log('[PDD监控] 全局内容声明预填结果:', declResult ? '✅成功' : '⚠️失败(将在每个视频后重试)');
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.warn('[PDD监控] 全局内容声明预填异常:', e.message);
        }
      }

      try {
        await startBatchUpload();
        console.log('[PDD监控] startBatchUpload 执行完成');
      } catch (e) {
        console.error('[PDD监控] startBatchUpload 执行出错:', e);
        statusEl.innerHTML = `<div style="color:#f44336;">❌ 上传出错: ${e.message}</div>`;
      }
    };
    
    // 使用缓存视频上传
    document.getElementById('pdd-use-cache-upload').onclick = async function() {
      console.log('[PDD监控] ★★★ 使用缓存视频上传 ★★★');
      console.log('[PDD监控] 缓存视频数量:', cachedVideoFiles.length);
      
      if (cachedVideoFiles.length === 0) {
        alert('没有缓存的视频，请先选择视频');
        return;
      }
      
      const statusEl = document.getElementById('pdd-publish-status');
      if (!statusEl) {
        console.error('[PDD监控] 找不到状态元素 pdd-publish-status');
        return;
      }
      
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<div style="color:#1565c0;">📦 使用缓存视频上传中...</div>';

      // 检查是否在发布页面
      const isUploadPage = checkUploadPage();
      console.log('[PDD监控] 是否在发布页面:', isUploadPage);

      if (!isUploadPage) {
        statusEl.innerHTML = '<div style="color:#1565c0;">🔄 正在导航到视频发布页面...</div>';

        const navigated = await navigateToVideoUploadPage();
        if (!navigated) {
          statusEl.innerHTML = `<div style="color:#f44336; padding: 10px;">
            ❌ 当前不在视频发布页面<br>
            <span style="font-size: 12px; color: #666;">请先点击左侧菜单"多多视频" → "发布视频"进入发布页面</span><br><br>
            <button id="pdd-goto-publish-btn-3" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: bold; margin-top: 5px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
              🚀 一键跳转到发布视频页面
            </button>
          </div>`;
          const gotoBtn3 = document.getElementById('pdd-goto-publish-btn-3');
          if (gotoBtn3) {
            gotoBtn3.onclick = async function() {
              gotoBtn3.textContent = '⏳ 正在跳转...';
              gotoBtn3.disabled = true;
              const navigated = await navigateToVideoUploadPage();
              if (!navigated) {
                gotoBtn3.textContent = '❌ 跳转失败，请手动导航';
                setTimeout(() => { gotoBtn3.textContent = '🚀 一键跳转到发布视频页面'; gotoBtn3.disabled = false; }, 2000);
              }
            };
          }
          return;
        }

        await new Promise(r => setTimeout(r, 2000));
      }
      
      // 获取当前商品ID
      const productIds = document.getElementById('pdd-custom-goods-id')?.value.trim() || '';
      const appendFilenameSuffix = document.getElementById('pdd-append-filename-suffix')?.checked || false;
      const description = document.getElementById('pdd-video-description')?.value.trim() || null;
      const contentDeclaration = document.getElementById('pdd-content-declaration')?.value || null;
      const pidList = productIds.split(',').map(p => p.trim()).filter(p => p);
      
      if (pidList.length === 0) {
        statusEl.innerHTML = '<div style="color:#f44336;">❌ 请先输入商品ID</div>';
        return;
      }
      
      console.log('[PDD监控] 使用缓存视频上传，商品ID:', pidList);
      
      // 使用缓存视频设置上传配置
      pendingUploadConfig = {
        pidList: pidList,
        appendFilenameSuffix: appendFilenameSuffix,
        description: description,
        contentDeclaration: contentDeclaration,
        files: cachedVideoFiles,
        currentIndex: 0,
        source: 'folder',
        isAccumulated: true
      };
      
      console.log('[PDD监控] 开始上传缓存视频，共', cachedVideoFiles.length, '个文件');

      // ★ 缓存上传前也预填全局内容声明
      if (contentDeclaration) {
        console.log('[PDD监控] ★ 缓存上传前预填全局内容声明:', contentDeclaration);
        try {
          await fillContentDeclaration(contentDeclaration);
          await new Promise(r => setTimeout(r, 500));
        } catch (e) {
          console.warn('[PDD监控] 缓存上传全局内容声明预填异常:', e.message);
        }
      }

      try {
        await startBatchUpload();
        console.log('[PDD监控] 缓存视频上传完成');
      } catch (e) {
        console.error('[PDD监控] 缓存视频上传出错:', e);
        statusEl.innerHTML = `<div style="color:#f44336;">❌ 上传出错: ${e.message}</div>`;
      }
    };
    
    // 清空缓存
    document.getElementById('pdd-clear-cache').onclick = function() {
      if (cachedVideoFiles.length === 0) {
        return;
      }
      if (confirm(`确定要清空缓存的 ${cachedVideoFiles.length} 个视频吗？`)) {
        cachedVideoFiles = [];
        updateCachedVideosDisplay();
        console.log('[PDD监控] 已清空视频缓存');
      }
    };
    
    // 导航到视频发布页面
    async function navigateToVideoUploadPage() {
      console.log('[PDD监控] 尝试导航到视频发布页面...');
      
      // 尝试查找"发布视频"菜单项
      const sidebar = document.querySelector('[class*="sidebar"], [class*="menu"], [class*="nav"], nav, aside');
      const searchScope = sidebar || document.body;
      const menuItems = searchScope.querySelectorAll('a, button, [role="button"], div[class*="item"], span[class*="item"]');
      
      // 首先尝试精确匹配"发布视频"
      for (const item of menuItems) {
        const text = (item.textContent || '').trim();
        if (text === '发布视频') {
          console.log('[PDD监控] 找到"发布视频"菜单项，准备点击');
          item.click();
          // 启动 URL 变化监听，等待页面跳转后恢复商品选择
          startUrlChangeWatcher();
          return true;
        }
      }
      
      // 如果没找到，尝试查找包含"发布视频"的较短文本
      for (const item of menuItems) {
        const text = (item.textContent || '').trim();
        if (text.includes('发布视频') && text.length <= 10) {
          console.log('[PDD监控] 找到包含"发布视频"的菜单项，准备点击');
          item.click();
          startUrlChangeWatcher();
          return true;
        }
      }
      
      // 尝试查找"多多视频"菜单，点击后展开子菜单
      for (const item of menuItems) {
        const text = (item.textContent || '').trim();
        if (text === '多多视频' || (text.includes('多多视频') && text.length <= 8)) {
          console.log('[PDD监控] 找到"多多视频"菜单项，准备点击展开子菜单');
          item.click();
          
          // 等待子菜单展开
          await new Promise(r => setTimeout(r, 500));
          
          // 再次查找"发布视频"
          const subItems = searchScope.querySelectorAll('a, button, [role="button"], div[class*="item"], span[class*="item"]');
          for (const subItem of subItems) {
            const subText = (subItem.textContent || '').trim();
            if (subText === '发布视频' || (subText.includes('发布视频') && subText.length <= 10)) {
              console.log('[PDD监控] 找到子菜单"发布视频"，准备点击');
              subItem.click();
              startUrlChangeWatcher();
              return true;
            }
          }
          
          // 如果没找到子菜单，可能已经展开了，再等一下
          await new Promise(r => setTimeout(r, 300));
          const retryItems = searchScope.querySelectorAll('a, button, [role="button"], div[class*="item"], span[class*="item"]');
          for (const retryItem of retryItems) {
            const retryText = (retryItem.textContent || '').trim();
            if (retryText === '发布视频') {
              console.log('[PDD监控] 重试找到"发布视频"，准备点击');
              retryItem.click();
              startUrlChangeWatcher();
              return true;
            }
          }
        }
      }
      
      console.log('[PDD监控] 未找到"发布视频"菜单项');
      return false;
    }
    
    // 启动 URL 变化监听器，等待页面跳转后恢复商品选择
    function startUrlChangeWatcher() {
      const startUrl = window.location.href;
      console.log('[PDD监控] 启动 URL 变化监听，当前 URL:', startUrl);
      
      let checkCount = 0;
      const maxChecks = 20; // 最多检查 20 次（10 秒）
      
      const checkInterval = setInterval(() => {
        checkCount++;
        const currentUrl = window.location.href;
        
        if (currentUrl !== startUrl) {
          console.log('[PDD监控] 检测到 URL 变化:', startUrl, '->', currentUrl);
          clearInterval(checkInterval);
          
          // URL 变化后，等待页面元素加载，然后恢复商品选择
          setTimeout(() => {
            checkPublishPage();
          }, 500);
        } else if (checkCount >= maxChecks) {
          console.log('[PDD监控] URL 变化监听超时');
          clearInterval(checkInterval);
        }
      }, 500);
    }
    
    document.getElementById('pdd-select-folder').onclick = async function() {
      console.log('[PDD监控] 点击选择文件夹按钮（多选模式）');

      const statusEl = document.getElementById('pdd-publish-status');

      // 检查是否选择了商品
      if (!selectedGoods) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#e65100;">⚠️ 请先从商品列表中选择一个商品</div>`;
        return;
      }

      // 检查是否在发布页面
      if (!checkUploadPage()) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = `<div style="color:#1565c0;">🔄 正在自动跳转到视频发布页面...</div>`;

        const navigated = await navigateToVideoUploadPage();
        if (!navigated) {
          statusEl.innerHTML = `<div style="color:#f44336; padding: 10px;">
            ❌ 自动跳转失败，请手动导航<br>
            <span style="font-size: 12px; color: #666;">点击左侧菜单"多多视频" → "发布视频"进入发布页面</span>
          </div>`;
          return;
        }

        statusEl.innerHTML = `<div style="color:#1565c0;">✅ 已跳转到发布页面，正在准备选择文件夹...</div>`;
        await new Promise(r => setTimeout(r, 1500));
      }

      // 读取配置
      const customGoodsId = document.getElementById('pdd-custom-goods-id')?.value.trim();
      const goodsId = customGoodsId || selectedGoods.goodsId || selectedGoods.goods_id || selectedGoods.productId || selectedGoods.id;
      const appendFilenameSuffix = document.getElementById('pdd-append-filename-suffix')?.checked || false;
      const description = document.getElementById('pdd-video-description')?.value.trim() || null;
      const contentDeclaration = document.getElementById('pdd-content-declaration')?.value || null;

      console.log('[PDD监控] ★ 上传配置读取: 商品ID=' + goodsId + ', 描述=' + (description || '(空)') + ', 内容声明=' + (contentDeclaration || '(空)'));

      pendingUploadConfig = {
        pidList: [String(goodsId)],
        appendFilenameSuffix: appendFilenameSuffix,
        description: description,
        contentDeclaration: contentDeclaration,
        files: accumulatedFiles,
        currentIndex: 0,
        source: 'folder',
        isAccumulated: true
      };

      statusEl.style.display = 'block';

      // ★ 多选文件夹循环（首次选择会清空之前的文件）
      const previousCount = accumulatedFiles.length;
      if (previousCount > 0) {
        // 首次点击"选择文件夹"，清空之前的累积文件重新开始
        accumulatedFiles = [];
        folderPaths = [];
        if (pendingUploadConfig) pendingUploadConfig.files = accumulatedFiles;
        updateFolderDisplay();
      }

      await selectMultipleFolders({
        statusEl: statusEl,
        initialPrompt: '📂 请选择视频文件夹（可连续选择多个，选完按【取消】结束）...',
        continuePrompt: '✅ 已选 <b>{N}</b> 个文件夹，继续选择下一个或按【取消】结束多选...',

        onStart: () => {
          console.log('[PDD监控] 多选文件夹开始');
        },

        onEachFolder: (result) => {
          if (result.isEmpty) {
            console.log(`[PDD监控] 文件夹 "${result.name}" 为空`);
          } else {
            console.log(`[PDD监控] ✅ 文件夹 "${result.name}": +${result.added} 视频`);
          }
        },

        onComplete: (summary) => {
          console.log(`[PDD监控] ★ 多选文件夹完成: ${summary.folders}个文件夹, ${summary.totalFiles}个视频`);
        }
      });
    };
    
    document.getElementById('pdd-folder-input').addEventListener('change', function(e) {
      console.log('[PDD监控] 文件夹选择change事件触发, isWaitingForFolderSelect:', isWaitingForFolderSelect);
      
      if (!isWaitingForFolderSelect) {
        console.log('[PDD监控] 跳过文件夹选择处理（未等待文件夹选择）');
        return;
      }
      isWaitingForFolderSelect = false;
      
      const files = Array.from(e.target.files);
      const videoFiles = files.filter(f => {
        const ext = f.name.toLowerCase().split('.').pop();
        return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext);
      });
      
      const statusEl = document.getElementById('pdd-publish-status');
      
      if (videoFiles.length === 0) {
        statusEl.innerHTML = `<div style="color:#e65100;">⚠️ 文件夹中没有找到视频文件</div>`;
        return;
      }
      
      // 获取文件夹路径
      const folderPath = videoFiles[0].webkitRelativePath ? videoFiles[0].webkitRelativePath.split('/')[0] : '未知文件夹';
      
      // 累积添加文件
      const newFiles = videoFiles.map(f => ({
        name: f.name,
        file: f,
        size: f.size,
        folderPath: folderPath
      }));
      
      // 去重：根据文件名和大小判断
      newFiles.forEach(newFile => {
        const exists = accumulatedFiles.some(existing => 
          existing.name === newFile.name && existing.size === newFile.size
        );
        if (!exists) {
          accumulatedFiles.push(newFile);
        }
      });
      
      if (!folderPaths.includes(folderPath)) {
        folderPaths.push(folderPath);
      }
      
      console.log('[PDD监控] 从文件夹选择了', videoFiles.length, '个视频文件，累计', accumulatedFiles.length, '个');
      
      // 更新 pendingUploadConfig.files，确保 startBatchUpload 能获取到文件
      if (pendingUploadConfig) {
        pendingUploadConfig.files = accumulatedFiles;
        console.log('[PDD监控] 已更新 pendingUploadConfig.files，数量:', pendingUploadConfig.files.length);
      }
      
      updateFolderDisplay();
      
      statusEl.innerHTML = `<div style="color:#2e7d32;">✅ 已添加 ${videoFiles.length} 个视频，累计 ${accumulatedFiles.length} 个</div>
        <div style="margin-top:4px;color:#1565c0;">可继续选择文件夹添加更多视频，或点击下方开始上传</div>`;
      
      e.target.value = '';
    });
    
    async function startBatchUpload() {
      console.log('[PDD监控] ★★★ startBatchUpload 开始执行 ★★★');
      
      if (!pendingUploadConfig || pendingUploadConfig.files.length === 0) {
        console.log('[PDD监控] pendingUploadConfig 无效或文件为空');
        return;
      }
      
      console.log('[PDD监控] pendingUploadConfig.files.length:', pendingUploadConfig.files.length);
      console.log('[PDD监控] pendingUploadConfig.pidList:', pendingUploadConfig.pidList);
      console.log('[PDD监控] ★ pendingUploadConfig完整内容:', JSON.stringify({
        pidList: pendingUploadConfig.pidList,
        filesCount: pendingUploadConfig.files.length,
        description: pendingUploadConfig.description,
        contentDeclaration: pendingUploadConfig.contentDeclaration,
        appendFilenameSuffix: pendingUploadConfig.appendFilenameSuffix
      }));

      // 预生成所有视频的封面图（异步，不阻塞上传）— 带超时控制
      (async () => {
        try {
          const progressEl = document.getElementById('upload-progress');
          const PREGEN_TIMEOUT = 8000;  // 每个视频截帧超时8秒
          for (let i = 0; i < pendingUploadConfig.files.length; i++) {
            const vf = pendingUploadConfig.files[i];
            if (vf.file && !vf.coverFile) {
              try {
                // 带超时的截帧
                vf.coverFile = await Promise.race([
                  captureVideoCoverFromFile(vf.file, PREGEN_TIMEOUT),
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('预生成超时')), PREGEN_TIMEOUT + 1000)
                  )
                ]);
                console.log(`[PDD监控] ✅ 预生成封面 ${i + 1}/${pendingUploadConfig.files.length}: ${vf.file.name}`);
                if (progressEl) progressEl.textContent = `预生成封面 ${i + 1}/${totalFiles}...`;
              } catch (e) {
                console.warn(`[PDD监控] ⚠️ 封面预生成失败 [${i + 1}/${pendingUploadConfig.files.length}] ${vf.file.name}:`, e.message);
                // 单个失败不阻断后续
              }
            }
          }
          console.log('[PDD监控] 封面预生成全部完成');
          if (progressEl) progressEl.textContent = `预生成封面完成 (${pendingUploadConfig.files.length})`;
        } catch (e) {
          console.error('[PDD监控] 封面预批量生成出错:', e.message);
        }
      })();

      const statusEl = document.getElementById('pdd-publish-status');
      const totalFiles = pendingUploadConfig.files.length;
      
      statusEl.innerHTML = `
        <div style="background:#e8f5e9;padding:10px;border-radius:6px;">
          <div style="font-weight:600;color:#2e7d32;margin-bottom:6px;">📤 批量上传中...</div>
          <div id="upload-progress" style="font-size:11px;color:#333;">准备上传 ${totalFiles} 个视频</div>
          <div style="height:4px;background:#e0e0e0;border-radius:2px;margin-top:8px;overflow:hidden;">
            <div id="upload-progress-bar" style="height:100%;background:#4caf50;border-radius:2px;width:0%;transition:width 0.3s;"></div>
          </div>
        </div>
      `;
      
      const progressEl = document.getElementById('upload-progress');
      const progressBar = document.getElementById('upload-progress-bar');
      
      console.log('[PDD监控] 准备查找页面文件 input...');
      
      // 关键：先点击上传按钮来激活上传区域（即使 file input 存在也需要激活）
      console.log('[PDD监控] 先点击上传按钮激活上传区域...');
      const uploadBtn = findPageUploadButton();
      
      // 添加事件监听器来阻止文件选择对话框
      let fileInputClickHandler = null;
      const allFileInputs = document.querySelectorAll('input[type="file"]');
      for (const input of allFileInputs) {
        if (input.id && input.id.startsWith('pdd-')) continue;
        if (input.closest('#pdd-video-monitor')) continue;
        
        fileInputClickHandler = function(e) {
          if (window.__pddAutoUploading) {
            console.log('[PDD监控] 阻止文件选择对话框打开');
            e.preventDefault();
            e.stopPropagation();
          }
        };
        input.addEventListener('click', fileInputClickHandler, true);
        console.log('[PDD监控] 已添加 file input click 拦截器');
        break;
      }
      
      if (uploadBtn) {
        console.log('[PDD监控] 找到上传按钮，准备点击...');
        window.__pddAutoUploading = true;
        uploadBtn.click();
        await new Promise(r => setTimeout(r, 800));
        window.__pddAutoUploading = false;
        console.log('[PDD监控] 已点击上传按钮，等待上传区域激活...');
        
        // 移除事件监听器
        if (fileInputClickHandler) {
          for (const input of allFileInputs) {
            if (input.id && input.id.startsWith('pdd-')) continue;
            if (input.closest('#pdd-video-monitor')) continue;
            input.removeEventListener('click', fileInputClickHandler, true);
            break;
          }
        }
      } else {
        console.log('[PDD监控] 未找到上传按钮，继续尝试查找 file input...');
        // 移除事件监听器
        if (fileInputClickHandler) {
          for (const input of allFileInputs) {
            if (input.id && input.id.startsWith('pdd-')) continue;
            if (input.closest('#pdd-video-monitor')) continue;
            input.removeEventListener('click', fileInputClickHandler, true);
            break;
          }
        }
      }
      
      // 等待页面 file input 加载
      let pageFileInput = null;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (!pageFileInput && attempts < maxAttempts) {
        attempts++;
        
        // 直接查找文件 input
        const allInputs = document.querySelectorAll('input[type="file"]');
        console.log('[PDD监控] 页面上 file input 数量:', allInputs.length, '尝试:', attempts);
        
        for (const input of allInputs) {
          console.log('[PDD监控] 检查 input:', input.id, input.className, 'accept:', input.accept);
          // 跳过插件自己的 input
          if (input.id && input.id.startsWith('pdd-')) {
            console.log('[PDD监控] 跳过插件 input');
            continue;
          }
          // 跳过插件面板内的 input
          if (input.closest('#pdd-video-monitor')) {
            console.log('[PDD监控] 跳过插件面板内的 input');
            continue;
          }
          // 找到第一个非插件的 file input
          pageFileInput = input;
          console.log('[PDD监控] 找到页面 file input');
          break;
        }
        
        if (!pageFileInput) {
          console.log('[PDD监控] 未找到页面 file input，等待 500ms 后重试');
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      // 如果还没找到，再次尝试点击上传按钮
      if (!pageFileInput) {
        console.log('[PDD监控] 再次尝试点击上传按钮...');
        const retryUploadBtn = findPageUploadButton();
        if (retryUploadBtn) {
          window.__pddAutoUploading = true;
          retryUploadBtn.click();
          await new Promise(r => setTimeout(r, 500));
          window.__pddAutoUploading = false;
          
          // 再次查找 file input
          const allInputs = document.querySelectorAll('input[type="file"]');
          for (const input of allInputs) {
            if (input.id && input.id.startsWith('pdd-')) continue;
            if (input.closest('#pdd-video-monitor')) continue;
            pageFileInput = input;
            console.log('[PDD监控] 点击上传按钮后找到 file input');
            break;
          }
        }
      }
      
      // 如果还没找到，提示用户
      if (!pageFileInput) {
        console.error('[PDD监控] 找不到页面上的文件上传框');
        if (progressEl) progressEl.textContent = '❌ 找不到页面上的文件上传框，请确保已进入视频上传页面';
        return;
      }
      
      console.log('[PDD监控] ★★★ 找到页面文件 input, multiple:', pageFileInput.multiple);
      
      // 分批上传的阈值 - 超过此数量时分批上传
      const BATCH_THRESHOLD = 30;
      const BATCH_SIZE = 25; // 每批上传的文件数量
      
      // 检查是否支持多文件上传
      if (pageFileInput.multiple) {
        // 判断是否需要分批上传
        const needBatchUpload = totalFiles > BATCH_THRESHOLD;
        
        if (needBatchUpload) {
          console.log('[PDD监控] 文件数量较多(', totalFiles, ')，启用分批上传模式');
          if (progressEl) progressEl.textContent = `文件较多，将分批上传 ${totalFiles} 个视频...`;
          
          // 分批上传
          const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
          let uploadedCount = 0;
          
          for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
            const startIdx = batchIndex * BATCH_SIZE;
            const endIdx = Math.min(startIdx + BATCH_SIZE, totalFiles);
            const batchFiles = pendingUploadConfig.files.slice(startIdx, endIdx);
            
            console.log(`[PDD监控] 上传第 ${batchIndex + 1}/${totalBatches} 批，文件 ${startIdx + 1}-${endIdx}`);
            if (progressEl) progressEl.textContent = `上传第 ${batchIndex + 1}/${totalBatches} 批 (${startIdx + 1}-${endIdx}/${totalFiles})...`;
            
            try {
              // 创建 DataTransfer
              const dataTransfer = new DataTransfer();
              for (const videoFile of batchFiles) {
                if (videoFile.file && videoFile.file instanceof File) {
                  dataTransfer.items.add(videoFile.file);
                }
              }
              
              // 使用 React 兼容的方式设置 files
              const nativeFilesSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'files'
              )?.set;
              
              if (nativeFilesSetter) {
                nativeFilesSetter.call(pageFileInput, dataTransfer.files);
              } else {
                pageFileInput.files = dataTransfer.files;
              }
              
              // 触发事件
              pageFileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
              pageFileInput.dispatchEvent(new Event('input', { bubbles: true }));
              
              console.log(`[PDD监控] 第 ${batchIndex + 1} 批已提交，文件数: ${dataTransfer.files.length}`);
              
              // 等待页面处理这一批文件
              await new Promise(r => setTimeout(r, 2000));
              
              uploadedCount += batchFiles.length;
              
              // 如果不是最后一批，等待更长时间让页面处理
              if (batchIndex < totalBatches - 1) {
                console.log('[PDD监控] 等待页面处理，准备下一批...');
                await new Promise(r => setTimeout(r, 3000));
              }
              
            } catch (batchErr) {
              console.error(`[PDD监控] 第 ${batchIndex + 1} 批上传失败:`, batchErr);
            }
          }
          
          console.log('[PDD监控] 分批上传完成，共上传', uploadedCount, '个文件');
          if (progressEl) progressEl.textContent = `已提交 ${uploadedCount} 个视频，等待上传完成...`;
          
        } else {
          // 一次性上传所有文件
          console.log('[PDD监控] 开始一次性上传，共', pendingUploadConfig.files.length, '个文件');
          
          if (progressEl) progressEl.textContent = `正在上传 ${totalFiles} 个视频，请稍候...`;
          
          try {
            // 使用 requestIdleCallback 或 setTimeout 分批处理 DataTransfer 创建，避免阻塞主线程
            const allFiles = pendingUploadConfig.files;
            console.log('[PDD监控] 准备创建 DataTransfer，文件数量:', allFiles.length);
            
            const dataTransfer = new DataTransfer();
            console.log('[PDD监控] DataTransfer 创建成功');
            
            // 分批添加文件到 DataTransfer，但一次性触发上传
            const CHUNK_SIZE = 20; // 内部处理块大小，不影响最终上传
            let addedCount = 0;
            for (let i = 0; i < allFiles.length; i += CHUNK_SIZE) {
              const chunk = allFiles.slice(i, Math.min(i + CHUNK_SIZE, allFiles.length));
              for (const videoFile of chunk) {
                try {
                  if (videoFile.file && videoFile.file instanceof File) {
                    dataTransfer.items.add(videoFile.file);
                    addedCount++;
                  } else {
                    console.warn('[PDD监控] 跳过无效文件:', videoFile.name);
                  }
                } catch (addErr) {
                  console.error('[PDD监控] 添加文件失败:', videoFile.name, addErr);
                }
              }
              // 每处理一块，让出主线程
              if (i + CHUNK_SIZE < allFiles.length) {
                await new Promise(r => setTimeout(r, 0));
              }
            }
            
            console.log('[PDD监控] 成功添加文件数量:', addedCount, 'DataTransfer 文件数量:', dataTransfer.files.length);
            
            // 使用 React 兼容的方式设置 files 属性
            function setNativeFilesLocal(input, files) {
              try {
                const nativeFilesSetter = Object.getOwnPropertyDescriptor(
                  window.HTMLInputElement.prototype, 'files'
                )?.set;
                
                if (nativeFilesSetter) {
                  nativeFilesSetter.call(input, files);
                  console.log('[PDD监控] 使用原生 setter 设置 files');
                } else {
                  input.files = files;
                  console.log('[PDD监控] 使用直接赋值设置 files');
                }
                
                // 触发事件
                input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
              } catch (e) {
                console.log('[PDD监控] setNativeFiles 失败，使用直接赋值:', e.message);
                input.files = files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }
            
            setNativeFilesLocal(pageFileInput, dataTransfer.files);
            
            console.log('[PDD监控] 已设置所有文件到 input, 数量:', pageFileInput.files.length);
            console.log('[PDD监控] 已触发所有事件');
          } catch (e) {
            console.error('[PDD监控] 设置文件失败:', e);
            if (progressEl) progressEl.textContent = '❌ 文件设置失败: ' + e.message;
            return;
          }
          
          // 等待一段时间让页面处理文件选择
          if (progressEl) progressEl.textContent = `已提交 ${totalFiles} 个视频，等待页面响应...`;
          await new Promise(r => setTimeout(r, 3000));
        }
        
        console.log('[PDD监控] 文件上传已触发，等待处理完成...');
        if (progressBar) progressBar.style.width = '50%';
        if (progressEl) progressEl.textContent = `已提交 ${totalFiles} 个视频，等待上传完成...`;
        
        // 等待视频列表出现，然后填充数据
        await waitForAllVideosUploadAndFill(pendingUploadConfig.pidList, totalFiles, pendingUploadConfig.files, pendingUploadConfig.appendFilenameSuffix, pendingUploadConfig.description, pendingUploadConfig.contentDeclaration);
        
        if (progressBar) progressBar.style.width = '100%';
        if (progressEl) progressEl.textContent = `✅ 已完成 ${totalFiles} 个视频的上传`;
      } else {
        // 单文件上传模式：逐个上传
        for (let i = 0; i < pendingUploadConfig.files.length; i++) {
          const videoFile = pendingUploadConfig.files[i];
          const goodsIdIndex = i % pendingUploadConfig.pidList.length;
          const goodsId = pendingUploadConfig.pidList[goodsIdIndex];
          
          if (progressEl) progressEl.textContent = `正在上传 ${i + 1}/${totalFiles}: ${videoFile.name}`;
          if (progressBar) progressBar.style.width = `${(i / totalFiles) * 100}%`;
          
          try {
            // 每次上传前重新查找 file input（因为页面可能刷新了）
            let currentFileInput = null;
            const allInputs = document.querySelectorAll('input[type="file"]');
            for (const input of allInputs) {
              if (input.id && input.id.startsWith('pdd-')) continue;
              if (input.closest('#pdd-video-monitor')) continue;
              currentFileInput = input;
              break;
            }
            
            if (!currentFileInput) {
              // 如果找不到 file input，尝试点击上传按钮
              console.log('[PDD监控] 未找到 file input，尝试点击上传按钮');
              const uploadBtn = document.querySelector('.no-video_noVideoWrap__opXQS button, [class*="upload"] button, button[class*="upload"]');
              if (uploadBtn && uploadBtn.offsetParent !== null) {
                uploadBtn.click();
                await new Promise(r => setTimeout(r, 500));
                // 再次查找 file input
                const retryInputs = document.querySelectorAll('input[type="file"]');
                for (const input of retryInputs) {
                  if (input.id && input.id.startsWith('pdd-')) continue;
                  if (input.closest('#pdd-video-monitor')) continue;
                  currentFileInput = input;
                  break;
                }
              }
            }
            
            if (!currentFileInput) {
              console.error('[PDD监控] 找不到 file input，跳过文件:', videoFile.name);
              continue;
            }
            
            // 设置文件到 input - 使用 React 兼容的方式
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(videoFile.file);
            
            // 使用原生 setter 设置 files
            try {
              const nativeFilesSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'files'
              )?.set;
              if (nativeFilesSetter) {
                nativeFilesSetter.call(currentFileInput, dataTransfer.files);
              } else {
                currentFileInput.files = dataTransfer.files;
              }
            } catch (e) {
              currentFileInput.files = dataTransfer.files;
            }
            
            // 触发事件
            currentFileInput.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            currentFileInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            console.log('[PDD监控] 视频已设置:', videoFile.name);
            
            // 等待上传完成
            const fileName = pendingUploadConfig.appendFilenameSuffix ? videoFile.name : null;
            const description = pendingUploadConfig.description;
            const contentDeclaration = pendingUploadConfig.contentDeclaration;
            await waitForUploadComplete(goodsId, fileName, description, contentDeclaration);
            
          } catch (err) {
            console.error('[PDD监控] 视频上传失败:', videoFile.name, err);
          }
          
          // 等待一段时间再上传下一个
          if (i < pendingUploadConfig.files.length - 1) {
            await new Promise(r => setTimeout(r, 3000));
          }
        }
        
        if (progressBar) progressBar.style.width = '100%';
        if (progressEl) progressEl.textContent = `✅ 已完成 ${totalFiles} 个视频的上传`;
      }
      
      // 重置配置但保留商品信息，方便再次上传
      pendingUploadConfig = {
        pidList: pendingUploadConfig.pidList,
        appendFilenameSuffix: pendingUploadConfig.appendFilenameSuffix,
        description: pendingUploadConfig.description,
        contentDeclaration: pendingUploadConfig.contentDeclaration,
        files: [],
        currentIndex: 0,
        source: 'folder',
        isAccumulated: true
      };
      
      // 清空累积的文件列表
      accumulatedFiles = [];
      folderPaths = [];
      updateFolderDisplay();
      
      // 清空 folder input 的 value，确保下次可以正常选择
      const folderInput = document.getElementById('pdd-folder-input');
      if (folderInput) folderInput.value = '';
    }
    
    // 等待上传完成
    async function waitForUploadComplete(goodsId, fileName = null, description = null, contentDeclaration = null) {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 60;
        let checkInterval = null;
        let lastVideoCount = 0;
        let stableCount = 0;
        
        const cleanup = () => {
          if (checkInterval) {
            clearInterval(checkInterval);
            const idx = activeResources.intervals.indexOf(checkInterval);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            checkInterval = null;
          }
        };
        
        checkInterval = setInterval(() => {
          attempts++;
          
          const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
          
          if (videoItems.length > 0) {
            if (videoItems.length === lastVideoCount) {
              stableCount++;
            } else {
              stableCount = 0;
              lastVideoCount = videoItems.length;
            }
            
            const lastVideo = videoItems[videoItems.length - 1];
            const addGoodsBtn = lastVideo.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"], [class*="addGoods"]');

            const progressBar = lastVideo.querySelector('[class*="progress"], [class*="Progress"]');
            const uploadingIndicator = lastVideo.querySelector('[class*="uploading"], [class*="Uploading"], [class*="loading"], [class*="Loading"]');

            // ★ 修复：按钮存在即表示上传完成（不再要求可视）
            if (addGoodsBtn) {
              cleanup();
              
              fillVideoInfo(lastVideo, goodsId, fileName, description, contentDeclaration);
              resolve();
              return;
            }
            
            // 如果还在上传中，继续等待
            if (progressBar || uploadingIndicator) {
              console.log('[PDD监控] 视频正在上传中，继续等待... 尝试:', attempts, '/', maxAttempts);
              return;
            }
            
            // 如果视频数量稳定但没有"添加商品"按钮，可能是上传失败或页面问题
            if (stableCount >= 3) {
              console.log('[PDD监控] 视频数量稳定但未检测到上传完成，尝试填写信息');
              cleanup();
              fillVideoInfo(lastVideo, goodsId, fileName, description, contentDeclaration);
              resolve();
              return;
            }
          }
          
          if (attempts >= maxAttempts) {
            cleanup();
            console.warn('[PDD监控] 等待上传完成超时');
            resolve();
          }
        }, 3000);
        
        activeResources.intervals.push(checkInterval);
      });
    }
    
    // 优化的文件名匹配函数
    function findBestFileMatch(displayedName, files) {
      if (!displayedName || !files || files.length === 0) return null;
      
      // 清理文件名（去除扩展名、空格等）
      const cleanName = (name) => name.replace(/\.[^/.]+$/, '').trim().toLowerCase();
      const displayedBase = cleanName(displayedName);
      
      console.log('[PDD监控] findBestFileMatch: 页面显示文件名:', displayedBase, '候选文件数:', files.length);
      
      // 1. 完全匹配（忽略扩展名）
      let match = files.find(f => cleanName(f.name) === displayedBase);
      if (match) {
        console.log('[PDD监控] 完全匹配成功:', match.name);
        return match;
      }
      
      // 2. 末尾精确匹配（针对数字编号格式，如 video-3-1 匹配显示的 3-1）
      match = files.find(f => {
        const fileBase = cleanName(f.name);
        return fileBase.endsWith('-' + displayedBase) || fileBase.endsWith('_' + displayedBase);
      });
      if (match) {
        console.log('[PDD监控] 末尾精确匹配成功:', match.name);
        return match;
      }
      
      // 3. 提取数字编号进行精确匹配
      const displayedNumMatch = displayedBase.match(/(\d+-\d+|\d{2,})$/);
      if (displayedNumMatch) {
        const displayedNum = displayedNumMatch[1];
        match = files.find(f => {
          const fileBase = cleanName(f.name);
          const fileNumMatch = fileBase.match(/(\d+-\d+|\d{2,})$/);
          return fileNumMatch && fileNumMatch[1] === displayedNum;
        });
        if (match) {
          console.log('[PDD监控] 数字编号精确匹配成功:', match.name, '编号:', displayedNum);
          return match;
        }
      }
      
      // 4. 前缀匹配（显示的文件名是完整文件名的前缀）
      match = files.find(f => {
        const fileBase = cleanName(f.name);
        return fileBase.startsWith(displayedBase) && fileBase.length - displayedBase.length <= 10;
      });
      if (match) {
        console.log('[PDD监控] 前缀匹配成功:', match.name);
        return match;
      }
      
      // 5. 使用编辑距离进行模糊匹配（仅当长度相近时）
      let bestMatch = null;
      let bestScore = Infinity;
      for (const file of files) {
        const fileBase = cleanName(file.name);
        // 只对长度相近的文件名进行模糊匹配
        if (Math.abs(fileBase.length - displayedBase.length) > 5) continue;
        const score = levenshteinDistance(displayedBase, fileBase);
        if (score < bestScore && score <= 3) {
          bestScore = score;
          bestMatch = file;
        }
      }
      if (bestMatch) {
        console.log('[PDD监控] 模糊匹配成功:', bestMatch.name, '分数:', bestScore);
      }
      return bestMatch;
    }
    
    // 计算编辑距离（Levenshtein Distance）
    function levenshteinDistance(a, b) {
      const matrix = [];
      for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
          if (b.charAt(i - 1) === a.charAt(j - 1)) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      return matrix[b.length][a.length];
    }
    
    // 条件等待函数
    // 检查视频是否上传完成
    // ★ 修复：不再要求按钮在可视区内（离屏视频也是已上传完成的）
    function isVideoUploadComplete(videoItem) {
      // 检查是否有上传进度条（还在上传中）
      const progressBar = videoItem.querySelector('[class*="progress"], [class*="Progress"]');
      if (progressBar) {
        const width = progressBar.style.width || progressBar.getAttribute('data-width');
        if (width && parseInt(width) < 100) return false;
      }

      // 检查是否有上传中的标志
      const uploadingIndicator = videoItem.querySelector('[class*="uploading"], [class*="Uploading"], [class*="loading"], [class*="Loading"]');
      if (uploadingIndicator && uploadingIndicator.offsetParent !== null) return false;

      // 检查是否存在"添加商品"按钮（只要存在于DOM中即表示上传完成，不论是否在视口内）
      const addGoodsBtn = videoItem.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"], [class*="addGoods"]');
      if (addGoodsBtn) {
        // 额外检查：确保按钮文本包含"添加"类文字（不是"更换/修改"）
        const btnText = (addGoodsBtn.textContent || '').trim();
        if (btnText.includes('添加商品') || btnText.includes('添加') || btnText === '' || btnText.includes('关联')) {
          return true;
        }
      }

      return false;
    }
    
    // 检查视频是否已填充商品ID（用于验证填充成功）
    // ★ 修复：不再因为按钮离屏就误判为"已填充"，必须检测到实际商品数据才返回true
    function isVideoAlreadyFilled(videoItem) {
      // ★★★ 修复：更严格的判断逻辑，避免宽泛选择器误判 ★★★
      // 之前的bug：[class*="goods-info"]等选择器太宽泛，可能匹配到推荐商品区域→误判为已填充→跳过整个填充

      // 策略1: 检查是否有"更换商品"/"修改商品"按钮（这是最可靠的特征）
      const changeGoodsBtn = videoItem.querySelector(
        '[class*="ChangeGoods"], [class*="changeGoods"], [class*="change-goods"], ' +
        '[class*="EditGoods"], [class*="editGoods"], [class*="edit-goods"], ' +
        '[class*="ModifyGoods"], [class*="modifyGoods"]'
      );
      if (changeGoodsBtn) {
        console.log('[PDD监控] isVideoAlreadyFilled: 找到更换/修改商品按钮 → 已填充');
        return true;
      }

      // 策略2: 检查按钮文字是否明确表示已关联商品
      const addGoodsBtn = videoItem.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"], [class*="addGoods"]');
      if (addGoodsBtn) {
        const btnText = (addGoodsBtn.textContent || '').trim();
        if (btnText.includes('更换') || btnText.includes('修改') || btnText.includes('编辑')) {
          console.log('[PDD监控] isVideoAlreadyFilled: 按钮文字"' + btnText + '" → 已填充');
          return true;
        }
        if (btnText.includes('添加')) {
          console.log('[PDD监控] isVideoAlreadyFilled: 按钮文字"' + btnText + '" → 未填充');
          return false;
        }
      }

      // 策略3: 检查是否有实际的商品卡片（需要排除推荐区域）
      // ★ 关键改进：只查找视频项直接子级的商品信息，避免匹配到推荐商品
      const goodsCard = videoItem.querySelector(
        ':scope > [class*="goods-card"] > *, ' +          // 直接子级
        ':scope > [class*="GoodsCard"] > *, ' +
        '[class*="BoundGoods"], [class*="boundGoods"], ' +  // 已绑定商品
        '[class*="LinkedGoods"], [class*="linkedGoods"]'    // 已关联商品
      );
      if (goodsCard) {
        console.log('[PDD监控] isVideoAlreadyFilled: 找到已绑定商品卡片 → 已填充');
        return true;
      }

      // 策略4: 检查商品ID显示（只查找明确的商品ID展示元素）
      const goodsIdDisplay = videoItem.querySelector('[class*="GoodsId"], [class*="goods-id-display"], [class*="goodsIdDisplay"]');
      if (goodsIdDisplay) {
        const idText = goodsIdDisplay.textContent.trim();
        // 必须包含数字（商品ID是数字），避免空白或占位文本误判
        if (idText && /\d{4,}/.test(idText)) {
          console.log('[PDD监控] isVideoAlreadyFilled: 找到商品ID显示"' + idText + '" → 已填充');
          return true;
        }
      }

      // 无明确已填充特征 → 默认返回false（未填充），让调用方继续尝试
      console.log('[PDD监控] isVideoAlreadyFilled: 无已填充特征 → 未填充');
      return false;
    }
    
    // 检查视频描述是否已填充（只检查编辑面板中的）
    function isDescriptionAlreadyFilled() {
      // 暂时禁用检查，每次都尝试填充
      return false;
    }
    
    // 检查内容声明是否已填充（只检查编辑面板中的）
    function isContentDeclarationAlreadyFilled() {
      // 暂时禁用检查，每次都尝试填充
      return false;
    }
    
    async function waitForAllVideosUploadAndFill(pidList, totalFiles, files = [], appendFilenameSuffix = false, description = null, contentDeclaration = null) {
      console.log(`[PDD监控] ★★★ waitForAllVideosUploadAndFill 被调用 ★★★`);
      console.log(`[PDD监控] 参数: pidList=${pidList.length}个, totalFiles=${totalFiles}, description="${description || '(空)'}", contentDeclaration="${contentDeclaration || '(空)'}"`);

      if (isWaitingForUpload) {
        return;
      }
      isWaitingForUpload = true;
      
      let successfullyFilledItems = new Set();
      let processedElements = new WeakSet();
      let failedItemsCount = new Map();
      let attempts = 0;
      const maxAttempts = 300;
      const maxItemFailures = 3;
      
      const CHECK_INTERVAL = 2000;
      const MAX_WAIT_TIME = 15 * 60 * 1000;
      const startTime = Date.now();
      
      let pendingFillQueue = [];
      let nextGoodsIdIndex = 0;
      
      while (successfullyFilledItems.size < totalFiles && attempts < maxAttempts) {
        attempts++;
        
        if (Date.now() - startTime > MAX_WAIT_TIME) {
          console.warn('[PDD监控] 等待视频上传超时（15分钟），停止检测');
          break;
        }
        
        const videoItems = document.querySelectorAll([
          '.video-list_itemWrap__7xLB4',
          '[class*="video-list_item"]'
        ].join(', '));

        // ★ 详细日志：定期报告轮询状态
        if (attempts % 10 === 1 || videoItems.length > 0 || pendingFillQueue.length > 0) {
          console.log(`[PDD监控] 轮询 #${attempts}: ${videoItems}个视频项, 成功${successfullyFilledItems.size}/${totalFiles}, 队列${pendingFillQueue.length}, 已处理${processedElements.size}`);
        }
        
        for (let i = 0; i < videoItems.length; i++) {
          const item = videoItems[i];
          
          if (processedElements.has(item)) continue;
          if (!isVideoUploadComplete(item)) continue;
          if (isVideoAlreadyFilled(item)) {
            processedElements.add(item);
            const dataFeedId = item.getAttribute('data-feed-id') || 
                               item.querySelector('[data-feed-id]')?.getAttribute('data-feed-id');
            const itemId = dataFeedId ? `feed_${dataFeedId}` : `idx_${i}`;
            if (!successfullyFilledItems.has(itemId)) {
              successfullyFilledItems.add(itemId);
            }
            continue;
          }
          
          const dataFeedId = item.getAttribute('data-feed-id') || 
                             item.querySelector('[data-feed-id]')?.getAttribute('data-feed-id');
          const itemId = dataFeedId ? `feed_${dataFeedId}` : `idx_${i}`;
          
          if (successfullyFilledItems.has(itemId)) continue;
          if (pendingFillQueue.some(p => p.itemId === itemId)) continue;
          
          const currentFailures = failedItemsCount.get(itemId) || 0;
          if (currentFailures >= maxItemFailures) {
            processedElements.add(item);
            continue;
          }
          
          const goodsId = pidList[nextGoodsIdIndex % pidList.length];
          const fileIndex = nextGoodsIdIndex;
          nextGoodsIdIndex++;
          
          let fileName = null;
          if (appendFilenameSuffix && files && files.length > 0) {
            // 使用正确的索引：第N个视频对应files数组中第N个文件（从0开始）
            const fileIdx = fileIndex % files.length;
            if (files[fileIdx] && files[fileIdx].name) {
              fileName = files[fileIdx].name;
              console.log('[PDD监控] 视频', fileIndex + 1, '使用文件名:', fileName);
            }
          }
          
          pendingFillQueue.push({ item, goodsId, fileName, itemId, description, contentDeclaration });
        }
        
        if (pendingFillQueue.length > 0) {
          isBatchFilling = true;

          while (pendingFillQueue.length > 0) {
            const { item, goodsId, fileName, itemId, description: itemDesc, contentDeclaration: itemContentDecl } = pendingFillQueue.shift();

            // ★ 滚动当前视频项到视口内（确保DOM操作有效）
            try { item.scrollIntoView({ behavior: 'instant', block: 'center' }); } catch(e) {}
            await new Promise(r => setTimeout(r, 200));

            console.log('[PDD监控] ⚡ 开始处理视频 #' + (successfullyFilledItems.size + processedElements.size + pendingFillQueue.length + 1) +
              '/' + totalFiles + ' goodsId=' + goodsId + (fileName ? ' file=' + fileName.substring(0,20) : ''));

            try {
              console.log('[PDD监控] ▶ fillVideoInfo 开始...');
              const fillResult = await fillVideoInfo(item, goodsId, fileName, itemDesc, itemContentDecl);
              console.log('[PDD监控] ◀ fillVideoInfo 返回:', fillResult, '等待DOM更新后验证...');

              // ★ 改进验证策略：增加等待时间+多次重试验证
              let verified = false;
              for (let verifyAttempt = 0; verifyAttempt < 3; verifyAttempt++) {
                const verifyWait = [1000, 1500, 2000][verifyAttempt] || 1500;
                await new Promise(r => setTimeout(r, verifyWait));
                verified = isVideoAlreadyFilled(item);
                console.log('[PDD监控]   验证尝试', verifyAttempt + 1, '/3:', verified ? '✅通过' : '❌未通过', '等待:', verifyWait + 'ms');
                if (verified) break;
              }

              if (verified) {
                successfullyFilledItems.add(itemId);
                processedElements.add(item);
                console.log('[PDD监控] ✅ 视频 #' + itemId + ' 填充成功! 累计成功:', successfullyFilledItems.size + '/' + totalFiles);
              } else {
                throw new Error('商品ID填充验证失败(3次重试均未通过)');
              }
            } catch (e) {
              const currentFailures = failedItemsCount.get(itemId) || 0;
              failedItemsCount.set(itemId, currentFailures + 1);
              
              if (currentFailures + 1 < maxItemFailures) {
                pendingFillQueue.push({ item, goodsId, fileName, itemId, description: itemDesc, contentDeclaration: itemContentDecl });
              } else {
                processedElements.add(item);
              }
            }
            
            await new Promise(r => setTimeout(r, 500));
          }
          
          isBatchFilling = false;
        }
        
        await new Promise(r => setTimeout(r, CHECK_INTERVAL));
      }
      
      isWaitingForUpload = false;
      
      if (typeof watchPublishButton === 'function') {
        try {
          watchPublishButton();
        } catch (e) {}
      }
      
      showFillCompleteNotification(successfullyFilledItems.size, totalFiles);
    }
    
    // 显示填充完成提醒
    function showFillCompleteNotification(filledCount, totalCount) {
      const notification = document.createElement('div');
      notification.id = 'pdd-fill-complete-notification';
      notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
        color: white;
        padding: 30px 50px;
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 999999;
        text-align: center;
        animation: pddNotificationPop 0.5s ease-out;
      `;
      
      const isComplete = filledCount >= totalCount;
      notification.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 15px;">${isComplete ? '✅' : '⚠️'}</div>
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
          ${isComplete ? '数据填充完成！' : '数据填充部分完成'}
        </div>
        <div style="font-size: 16px; opacity: 0.9;">
          成功填充 ${filledCount}/${totalCount} 个视频
        </div>
      `;
      
      // 添加动画样式
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pddNotificationPop {
          0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(notification);
      
      // 3秒后自动关闭
      setTimeout(() => {
        notification.style.animation = 'pddNotificationPop 0.3s ease-in reverse';
        setTimeout(() => {
          notification.remove();
          style.remove();
        }, 300);
      }, 3000);
    }
    
    // 查找页面上的上传按钮
    function findPageUploadButton() {
      // 尝试多种选择器
      const selectors = [
        '.no-video_noVideoWrap__opXQS button',
        '[class*="upload"] button',
        '[class*="no-video"] button',
        'button[class*="upload"]',
        '.upload-btn',
        '#upload-btn'
      ];
      
      for (const selector of selectors) {
        try {
          const btn = document.querySelector(selector);
          if (btn) return btn;
        } catch (e) {}
      }
      
      // 遍历所有按钮查找上传相关按钮
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        const text = btn.textContent || '';
        if (text.includes('上传') || text.includes('添加') || text.includes('选择')) {
          return btn;
        }
      }
      
      return null;
    }
    
    // 上传单个文件到页面
    // 等待上传完成并填写商品信息
    async function waitForUploadAndFill(goodsId, fileName = null, description = null, contentDeclaration = null) {
      return new Promise(async (resolve) => {
        let attempts = 0;
        const maxAttempts = 120;
        let lastVideoCount = 0;
        let stableCount = 0;
        let isProcessing = false;
        
        const checkInterval = setInterval(async () => {
          if (isProcessing) return;
          isProcessing = true;
          
          try {
            attempts++;
            
            const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]');
            
            if (videoItems.length > 0 && videoItems.length === lastVideoCount) {
              stableCount++;
            } else {
              stableCount = 0;
              lastVideoCount = videoItems.length;
            }
            
            if ((stableCount >= 3 && videoItems.length > 0) || attempts >= maxAttempts) {
              clearInterval(checkInterval);
              const idx = activeResources.intervals.indexOf(checkInterval);
              if (idx > -1) activeResources.intervals.splice(idx, 1);
              
              if (videoItems.length > 0) {
                const lastVideo = videoItems[videoItems.length - 1];
                
                await new Promise(r => setTimeout(r, 500));
                
                try {
                  await fillVideoInfo(lastVideo, goodsId, fileName, description, contentDeclaration);
                } catch (e) {
                  console.error('[PDD监控] 视频信息填充失败:', e);
                }
              }
              
              resolve();
              return;
            }
          } finally {
            isProcessing = false;
          }
        }, 1000);
        
        activeResources.intervals.push(checkInterval);
      });
    }
    
    // 填充视频描述到 sabo-editor（contenteditable div）
    // 使用 Map 按视频项跟踪已填充的描述，避免全局去重导致漏填
    const filledDescMap = new Map(); // key: 视频项标识 -> { desc, time }

    async function fillVideoDescription(description, videoItem = null) {
      console.log('[PDD监控] fillVideoDescription 被调用, description:', description ? description.substring(0, 30) + '...' : 'null');

      if (!description) {
        console.log('[PDD监控] 没有描述内容，跳过填充');
        return false;
      }

      // 按视频项级别防重复填充（而非全局），避免批量上传时相同描述被跳过
      const itemKey = videoItem ? (videoItem.dataset.feedId || videoItem.querySelector('[data-feed-id]')?.getAttribute('data-feed-id') || String(videoItem)) : '__global__';
      const now = Date.now();
      const prevFill = filledDescMap.get(itemKey);
      if (prevFill && prevFill.desc === description && (now - prevFill.time) < 3000) {
        console.log('[PDD监控] 该视频描述3秒内已填充过，跳过');
        return true;
      }

      // 保存描述到全局变量
      window.__pdd_saved_description = description;

      try {
        console.log('[PDD监控] 开始填充视频描述:', description.substring(0, 50) + '...');

        // 如果提供了 videoItem，先尝试在视频项内部查找描述输入框
        let descEditor = null;
        
        if (videoItem) {
          // 在视频项内部查找描述输入框
          const internalSelectors = [
            '[id^="sabo-editor"]',
            '.sabo-root',
            '[class*="sabo-editor"]',
            '[contenteditable="true"]'
          ];
          
          for (const selector of internalSelectors) {
            const el = videoItem.querySelector(selector);
            if (el) {  // ★ 修复：移除offsetParent限制
              descEditor = el;
              console.log('[PDD监控] 在视频项内部找到描述输入框:', selector, 'id:', el.id);
              break;
            }
          }
        }

        // 如果视频项内部没有找到，查找全局描述输入框（优化：只查一次）
        if (!descEditor) {
          const editors = document.querySelectorAll('[id^="sabo-editor"], [contenteditable="true"]');
          for (const el of editors) {
            if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel, #pdd-auto-fill-panel')) continue;
            if (el.closest('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]')) continue;
            // ★ 修复：移除offsetParent限制
            descEditor = el;
            break;
          }
        }

        if (!descEditor) {
          console.log('[PDD监控] 未找到描述输入框');
          return false;
        }

        // 检查编辑器中是否已经有相同内容
        const currentContent = (descEditor.textContent || '').trim();
        if (currentContent === description.trim()) {
          console.log('[PDD监控] 编辑器内容已与描述相同，跳过填充');
          filledDescMap.set(itemKey, { desc: description, time: Date.now() });
          return true;
        }

        // 记录填充前的内容
        const beforeContent = descEditor.textContent || '';
        console.log('[PDD监控] 填充前内容:', beforeContent.substring(0, 50));

        // 聚焦到编辑器
        descEditor.focus();
        await new Promise(r => setTimeout(r, 200));

        // 全选现有内容
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(descEditor);
        selection.removeAllRanges();
        selection.addRange(range);
        await new Promise(r => setTimeout(r, 100));

        // 方式1：使用 execCommand insertText 插入文本
        let success = false;
        try {
          success = document.execCommand('insertText', false, description);
          console.log('[PDD监控] 方式1 insertText 执行结果:', success);
        } catch (e) {
          console.log('[PDD监控] 方式1 insertText 失败:', e.message);
        }

        // 方式2：如果方式1失败，使用剪贴板 API + 模拟 Ctrl+V 粘贴
        if (!success) {
          console.log('[PDD监控] 方式1失败，尝试方式2：剪贴板 API + Ctrl+V...');
          try {
            // 将描述写入剪贴板
            await navigator.clipboard.writeText(description);
            console.log('[PDD监控] 已将描述写入剪贴板');
            await new Promise(r => setTimeout(r, 100));

            // 重新全选
            const selection2 = window.getSelection();
            const range2 = document.createRange();
            range2.selectNodeContents(descEditor);
            selection2.removeAllRanges();
            selection2.addRange(range2);
            await new Promise(r => setTimeout(r, 50));

            // 模拟 Ctrl+V 粘贴
            descEditor.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'v',
              code: 'KeyV',
              keyCode: 86,
              which: 86,
              ctrlKey: true,
              metaKey: false,
              bubbles: true
            }));
            await new Promise(r => setTimeout(r, 50));
            descEditor.dispatchEvent(new KeyboardEvent('keyup', {
              key: 'v',
              code: 'KeyV',
              keyCode: 86,
              which: 86,
              ctrlKey: true,
              metaKey: false,
              bubbles: true
            }));
            console.log('[PDD监控] 方式2 已触发 Ctrl+V 粘贴');
            success = true;
          } catch (e) {
            console.log('[PDD监控] 方式2 失败:', e.message);
          }
        }

        await new Promise(r => setTimeout(r, 200));

        // 触发各种事件以确保框架能够检测到变化
        descEditor.dispatchEvent(new Event('input', { bubbles: true }));
        descEditor.dispatchEvent(new Event('change', { bubbles: true }));
        descEditor.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

        // 失去焦点以触发保存
        descEditor.blur();
        await new Promise(r => setTimeout(r, 200));
        
        // 再次聚焦并失去焦点以确保内容已保存
        descEditor.focus();
        await new Promise(r => setTimeout(r, 100));
        descEditor.blur();
        await new Promise(r => setTimeout(r, 100));

        // 关闭话题标签自动补全弹窗
        closeTopicPopup();

        console.log('[PDD监控] 视频描述填充完成，当前内容:', descEditor.textContent?.substring(0, 50));
        
        // 更新填充记录（按视频项级别）
        filledDescMap.set(itemKey, { desc: description, time: Date.now() });
        
        return true;
      } catch (e) {
        console.error('[PDD监控] 填充视频描述失败:', e);
        return false;
      }
    }
    
    // 关闭话题标签自动补全弹窗（轻量版，不遍历DOM）
    function closeTopicPopup() {
      try {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true }));
      } catch(e) {}
    }

    // 填充内容声明
    // ★ 全局标志：内容声明只需填充一次（PDD页面级别设置，非每视频独立）
    let __contentDeclarationGlobalFilled = false;   // 是否已成功全局填充
    let __contentDeclarationGlobalValue = null;      // 已填充的值
    let filledDeclCount = 0;                          // 兼容旧日志

    async function fillContentDeclaration(declaration, videoItem = null) {
      console.log(`[PDD监控] ★★★ fillContentDeclaration 被调用 ★★★`);
      console.log(`[PDD监控] 参数: declaration="${declaration || '(空)'}" videoItem=${videoItem ? '有' : '无'}`);
      console.log(`[PDD监控] 全局状态: __contentDeclarationGlobalFilled=${__contentDeclarationGlobalFilled}, 已填值="${__contentDeclarationGlobalValue || '(空)'}"`);

      // 空值或"不设置"才跳过，"内容无需标注"是有效选项需要填充
      if (!declaration || declaration === '不设置') {
        console.log('[PDD监控] ⚠️ 内容声明为空或"不设置"，跳过填充');
        return true;
      }

      // ★ 快速路径：如果已经全局填充过相同值，跳过（避免60个视频反复操作）
      if (__contentDeclarationGlobalFilled && __contentDeclarationGlobalValue === declaration) {
        console.log('[PDD监控] ✅ 内容声明已全局填充过("' + declaration + '")，本次跳过（第' + (filledDeclCount + 1) + '个视频）');
        filledDeclCount++;
        return true;
      }

      console.log(`[PDD监控] ✓ 内容声明值有效: "${declaration}"，开始查找选择器...`);

      try {
        // 减少等待时间：已有全局跳过机制，不需要太长的初始延迟
        await new Promise(r => setTimeout(r, 300));

        // ========== 1. 查找内容声明下拉触发器（多种策略） ==========
        let targetSelect = null;

        // 策略A: 已知类名（优先在 videoItem 内部查找）
        const knownSelectors = [
          '[class*="ST_selectValueSingle"]',
          '[class*="selectValue"]',
          '[class*="select-value"]',
          '[class*="SelectValue"]',
          '[class*="content-declaration"]',
          '[class*="ContentDeclaration"]',
          '[class*="declaration-select"]',
          '[class*="declarationSelect"]',
        ];

        // 如果有 videoItem，先在其内部查找
        if (videoItem) {
          for (const sel of knownSelectors) {
            const els = videoItem.querySelectorAll(sel);
            for (const el of els) {
              // ★ 修复：移除offsetParent限制，离屏/隐藏元素也可能需要操作
              let p = el.parentElement;
              for (let i = 0; i < 8 && p; i++) {
                if ((p.textContent || '').includes('内容声明')) { targetSelect = el; break; }
                p = p.parentElement;
              }
              if (targetSelect) break;
            }
            if (targetSelect) break;
          }
        }

        // 如果 videoItem 内没找到，再全局查找
        if (!targetSelect) {
          for (const sel of knownSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
              if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
              // ★ 修复：移除offsetParent限制
              // 确认是"内容声明"区域
              let p = el.parentElement;
              for (let i = 0; i < 8 && p; i++) {
                if ((p.textContent || '').includes('内容声明')) { targetSelect = el; break; }
                p = p.parentElement;
              }
              if (targetSelect) break;
            }
            if (targetSelect) break;
          }
        }

        // 策略B: 文本匹配 - 查找包含"请选择"/"内容声明"的可点击元素（优先在 videoItem 内）
        if (!targetSelect) {
          const searchScope = videoItem || document;
          const allClickable = searchScope.querySelectorAll('[class*="select"], [class*="Select"], [class*="dropdown"], [class*="picker"], [role="listbox"], [role="combobox"], [data-type="select"]');
          for (const el of allClickable) {
            if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
            // ★ 修复：移除offsetParent限制
            const text = (el.textContent || '').trim();
            // 匹配常见的默认文本
            if (text === '' || text === '请选择' || text.includes('内容') || text.includes('声明') ||
                text.includes('无需') || text.includes('AI生成') || text.includes('虚构') ||
                text.includes('营销') || text.includes('转载')) {
              let p = el.parentElement;
              for (let i = 0; i < 6 && p; i++) {
                if ((p.textContent || '').includes('内容声明')) { targetSelect = el; break; }
                p = p.parentElement;
              }
              if (targetSelect) break;
            }
          }
        }

        // 策略C: 在视频项内部查找 cursor:pointer / role=button
        if (!targetSelect && videoItem) {
          const innerEls = videoItem.querySelectorAll('[class*="select"], [class*="Select"], [class*="dropdown"], [class*="picker"], span, div');
          for (const el of innerEls) {
            // ★ 修复：移除offsetParent限制
            const text = (el.textContent || '').trim();
            if (text && (text.includes('内容声明') || text === '请选择' || text === '' ||
                text.includes('无需标注') || text.includes('AI生成'))) {
              // 检查是否可点击（有click事件或特定样式）
              const style = window.getComputedStyle(el);
              if (style.cursor === 'pointer' || el.getAttribute('role') === 'button' ||
                  el.tagName === 'SELECT' || el.onclick || el.classList.toString().includes('select')) {
                targetSelect = el;
                break;
              }
            }
          }
        }

        if (!targetSelect) {
          // 输出调试信息：页面上有哪些可能的元素
          const debugEls = document.querySelectorAll('[class*="select"], [class*="Select"], [class*="declaration"]');
          console.warn(`[PDD监控] fillContentDeclaration: 未找到内容声明选择器 (共找到${debugEls.length}个候选元素)`);
          debugEls.forEach((el, i) => {
            if (el.offsetParent !== null && !el.closest('#pdd-video-monitor')) {
              console.warn(`  候选[${i}]: tag=${el.tagName} class=${el.className.substring(0, 60)} text="${(el.textContent||'').trim().substring(0, 30)}"`);
            }
          });
          return false;
        }

        console.log(`[PDD监控] fillContentDeclaration: 找到选择器 tag=${targetSelect.tagName} class=${targetSelect.className.substring(0, 50)} text="${(targetSelect.textContent||'').trim().substring(0, 30)}"`);

        // ========== 2. 检查当前值是否已匹配（仅日志，不跳过） ==========
        const currentValue = (targetSelect.textContent || '').trim();
        const isMatched = currentValue && currentValue !== '请选择' && currentValue !== '' &&
          (currentValue.includes(declaration) || declaration.includes(currentValue));

        if (isMatched) {
          console.log(`[PDD监控] fillContentDeclaration: 当前值"${currentValue}"已匹配目标"${declaration}"，但仍执行点击确保设置`);
          // 不return，继续执行点击操作确保设置生效
        } else {
          console.log(`[PDD监控] fillContentDeclaration: 当前值="${currentValue}" → 目标="${declaration}"，开始操作`);
        }

        // ========== 3. 用真实鼠标事件打开下拉菜单 ==========
        targetSelect.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 300));

        const rect = targetSelect.getBoundingClientRect();

        // 先聚焦
        targetSelect.focus();
        await new Promise(r => setTimeout(r, 100));

        // 触发 mousedown + mouseup + click 完整序列（模拟真实用户操作）
        const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
        targetSelect.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        await new Promise(r => setTimeout(r, 50));
        targetSelect.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        await new Promise(r => setTimeout(r, 50));
        targetSelect.dispatchEvent(new MouseEvent('click', mouseOpts));
        await new Promise(r => setTimeout(r, 500)); // 等待下拉菜单动画

        // 如果 .click() 不生效，尝试 pointer 事件
        const pointerOpts = { bubbles: true, cancelable: true, view: window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, pointerId: 1, pointerType: 'mouse' };
        targetSelect.dispatchEvent(new PointerEvent('pointerdown', pointerOpts));
        await new Promise(r => setTimeout(r, 50));
        targetSelect.dispatchEvent(new PointerEvent('pointerup', pointerOpts));
        await new Promise(r => setTimeout(r, 400));

        // ========== 4. 查找并点击目标选项（多策略） ==========
        let option = null;

        // 4a. 直接查找可见选项元素
        const optionSelectors = [
          '[class*="ContentDeclaration_title"]',
          '[class*="content-declaration"]',
          '[class*="option-item"]',
          '[class*="option_item"]',
          '[class*="select-option"]',
          '[class*="select_option"]',
          '[class*="dropdown-item"]',
          '[class*="dropdown_item"]',
          '[class*="list-item"]',
          '[class*="list_item"]',
          '[class*="menu-item"]',
          '[class*="menuItem"]',
          '[role="option"]',
          '[role="listitem"]',
          '[data-value]',
          'li[class*="option"]',
          'li[class*="item"]',
          'div[class*="item"]',
        ];

        const findOption = () => {
          // 先用精确选择器
          for (const sel of optionSelectors) {
            try {
              const opts = document.querySelectorAll(sel);
              for (const o of opts) {
                // ★ 修复：移除offsetParent限制（下拉选项可能在动画中出现）
                if (o.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
                const txt = (o.textContent || '').trim();
                if (txt.includes(declaration)) {
                  console.log(`[PDD监控] 找到选项(${sel}): "${txt.substring(0, 40)}"`);
                  return o;
                }
              }
            } catch(e) {}
          }

          // 4b. 全局搜索包含目标文字的可见元素（在下拉菜单区域内）
          const allVisible = document.querySelectorAll('div, span, li, p, label');
          for (const el of allVisible) {
            // ★ 修复：移除offsetParent限制（下拉选项可能在动画中出现）
            if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
            // 排除太大的容器
            const er = el.getBoundingClientRect();
            if (er.width > 600 || er.height > 200) continue;
            const txt = (el.textContent || '').trim();
            // 精确或近似匹配
            if (txt === declaration || txt.includes(declaration) || declaration.includes(txt)) {
              // 确保不是选择器本身
              if (el === targetSelect) continue;
              // 确保文字长度合理（选项通常较短）
              if (txt.length > 0 && txt.length < 30) {
                // 检查是否在弹出的菜单/浮层中
                const parent = el.closest('[class*="popup"], [class*="Popover"], [class*="popover"], [class*="dropdown"], [class*="Dropdown"], [class*="menu"], [class*="Menu"], [class*="overlay"], [class*="Overlay"], [class*="modal"], [role="listbox"], [role="dialog"]');
                if (parent || er.top > rect.bottom) { // 在选择器下方出现
                  console.log(`[PDD监控] 找到选项(全局搜索): tag=${el.tagName} text="${txt}"`);
                  return el;
                }
              }
            }
          }
          return null;
        };

        // 立即检查一次
        option = findOption();

        if (!option) {
          // 等待+轮询（MutationObserver + setInterval 双保险）
          option = await new Promise(resolve => {
            let resolved = false;
            const done = (result) => {
              if (resolved) return;
              resolved = true;
              resolve(result);
            };

            // MutationObserver
            const obs = new MutationObserver(() => {
              const found = findOption();
              if (found) { obs.disconnect(); clearInterval(poll); clearTimeout(t); done(found); }
            });
            obs.observe(document.body, { childList: true, subtree: true, attributes: true });

            // 轮询兜底
            let pollCount = 0;
            const poll = setInterval(() => {
              pollCount++;
              const found = findOption();
              if (found) { obs.disconnect(); clearInterval(poll); clearTimeout(t); done(found); }
              else if (pollCount >= 25) clearInterval(poll); // 12.5秒
            }, 500);

            // 超时
            const t = setTimeout(() => {
              obs.disconnect(); clearInterval(poll);
              done(null);
            }, 12000);
          });
        }

        if (option) {
          // 点击选项
          option.scrollIntoView({ behavior: 'instant', block: 'center' });
          await new Promise(r => setTimeout(r, 150));

          const oRect = option.getBoundingClientRect();
          const oMouseOpts = { bubbles: true, cancelable: true, view: window, clientX: oRect.left + oRect.width / 2, clientY: oRect.top + oRect.height / 2 };
          option.dispatchEvent(new MouseEvent('mousedown', oMouseOpts));
          await new Promise(r => setTimeout(r, 50));
          option.dispatchEvent(new MouseEvent('mouseup', oMouseOpts));
          await new Promise(r => setTimeout(r, 50));
          option.click();
          await new Promise(r => setTimeout(r, 200));

          filledDeclCount++;
          // ★ 标记全局已填充（内容声明是页面级设置，一次成功=全部生效）
          __contentDeclarationGlobalFilled = true;
          __contentDeclarationGlobalValue = declaration;
          console.log(`[PDD监控] fillContentDeclaration: ✅ 成功填充 (#${filledDeclCount}) "${declaration}" [全局标记已设置]`);
          return true;
        }

        console.warn(`[PDD监控] fillContentDeclaration: ⚠️ 未找到选项 "${declaration}"，超时退出`);
        // 尝试关闭可能打开的下拉菜单
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
        return false;
      } catch (e) {
        console.error('[PDD监控] fillContentDeclaration 异常:', e.message, e.stack);
        return false;
      }
    }

    // ~~ 旧版 fillVideoInfo 已移至文件后面统一版本（第12482行），避免重复声明覆盖问题 ~~
    // 以下 waitForEditorPanel 等辅助函数保留供新版本调用

    // 等待编辑面板出现
    async function waitForEditorPanel(timeout = 3000) {
      return new Promise((resolve) => {
        // 检查是否已存在
        const check = () => {
          const editors = document.querySelectorAll('[id^="sabo-editor"], [contenteditable="true"], [class*="editor"]');
          for (const ed of editors) {
            // 排除扩展面板和视频列表项
            if (ed.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
            if (ed.closest('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]')) continue;
            // ★ 修复：移除offsetParent限制 - 编辑面板可能在离屏滚动区域中
            return true;
          }
          // 也检查商品ID输入框
          const inputs = document.querySelectorAll('input[type="text"]');
          for (const inp of inputs) {
            if (inp.closest('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]')) continue;
            // ★ 修复：移除offsetParent限制
            if ((inp.placeholder || '').includes('商品')) {
              return true;
            }
          }
          return false;
        };
        
        if (check()) {
          resolve(true);
          return;
        }
        
        const observer = new MutationObserver(() => {
          if (check()) {
            observer.disconnect();
            clearTimeout(timer);
            resolve(true);
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        const timer = setTimeout(() => {
          observer.disconnect();
          resolve(false);
        }, timeout);
      });
    }
    
    // 填充商品ID - 优化版本
    async function fillGoodsId(videoItem, goodsId) {
      return new Promise(async (resolve) => {
        let attempts = 0;
        const maxAttempts = 3;
        
        async function attemptFill() {
          attempts++;
          console.log(`[PDD监控] fillGoodsId 尝试 ${attempts}/${maxAttempts}, goodsId:`, goodsId);
          
          try {
            function setNativeValue(element, value) {
              try {
                const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
                const prototype = Object.getPrototypeOf(element);
                const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
                
                if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
                  prototypeValueSetter.call(element, value);
                } else if (valueSetter) {
                  valueSetter.call(element, value);
                } else {
                  element.value = value;
                }
              } catch (e) {
                element.value = value;
              }
            }
            
            function isInFloatingPanel(element) {
              return element.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel, #pdd-auto-fill-panel') !== null;
            }
            
            let addGoodsBtn = null;
            const selectors = [
              '[class*="AddGoodsTrigger"]',
              '[class*="addGoods"]',
              '[class*="add-goods"]',
              'button[class*="goods"]'
            ];
            
            for (const selector of selectors) {
              addGoodsBtn = videoItem.querySelector(selector);
              if (addGoodsBtn) {
                break;
              }
            }
            
            if (!addGoodsBtn) {
              const allBtns = videoItem.querySelectorAll('button, [role="button"], [class*="btn"]');
              for (const btn of allBtns) {
                const text = btn.textContent || '';
                if ((text.includes('添加商品') || (text.includes('添加') && text.includes('商品'))) && 
                    !text.includes('流量卡') && !text.includes('奖励') && 
                    !text.includes('审核通过')) {
                  addGoodsBtn = btn;
                  break;
                }
              }
            }
            
            if (!addGoodsBtn) {
              const allBtns = document.querySelectorAll('button, [role="button"], [class*="btn"]');
              for (const btn of allBtns) {
                if (isInFloatingPanel(btn)) continue;
                
                const text = btn.textContent || '';
                if ((text.includes('添加商品') || (text.includes('添加') && text.includes('商品'))) && 
                    !text.includes('流量卡') && !text.includes('奖励') && 
                    !text.includes('审核通过')) {
                  const rect = btn.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    addGoodsBtn = btn;
                    break;
                  }
                }
              }
            }
            
            if (!addGoodsBtn) {
              console.log('[PDD监控] 未找到添加商品按钮');
              if (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 500));
                return attemptFill();
              }
              resolve(false);
              return;
            }
            
            console.log('[PDD监控] 找到添加商品按钮，准备点击，商品ID:', goodsId);
            
            if (!isBatchFilling) {
              addGoodsBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
              await new Promise(r => setTimeout(r, 150));
            }
            
            addGoodsBtn.click();
            await new Promise(r => setTimeout(r, 400));
            
            let goodsIdTab = null;
            const tabSelectors = ['[class*="tab"]', '[role="tab"]', 'button', 'div[class*="item"]'];
            
            for (const selector of tabSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                if (isInFloatingPanel(el)) continue;
                
                const text = el.textContent || '';
                if (text === '商品ID' || (text.includes('商品ID') && !text.includes('店铺商品'))) {
                  goodsIdTab = el;
                  break;
                }
              }
              if (goodsIdTab) break;
            }
            
            if (goodsIdTab) {
              goodsIdTab.click();
              await new Promise(r => setTimeout(r, 150));
            }
            
            const modal = document.querySelector('.MDL_inner_5-180-0, [class*="modal"], [class*="Modal"], [role="dialog"]');
            if (!modal) {
              console.log('[PDD监控] 未找到模态框');
              if (attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 500));
                return attemptFill();
              }
              resolve(false);
              return;
            }
            
            let goodsIdInput = null;
            const inputSelectors = [
              '.IPT_input_5-180-0',
              'input[placeholder*="商品id"]',
              'input[placeholder*="商品ID"]',
              'input[placeholder*="12345678"]',
              'input[placeholder*="商品"]',
              'input[placeholder*="ID"]',
              'input[name*="goodsId"]',
              'input[name*="goods_id"]',
              'input[type="text"]'
            ];
            
            for (const selector of inputSelectors) {
              const input = modal.querySelector(selector);
              if (input && !input.disabled) {  // ★ 修复：移除offsetParent限制
                goodsIdInput = input;
                break;
              }
            }
            
            if (!goodsIdInput) {
              console.log('[PDD监控] 未找到商品ID输入框');
              if (attempts < maxAttempts) {
                document.body.click();
                await new Promise(r => setTimeout(r, 300));
                return attemptFill();
              }
              resolve(false);
              return;
            }
            
            if (!isBatchFilling) {
              goodsIdInput.scrollIntoView({ behavior: 'instant', block: 'center' });
              await new Promise(r => setTimeout(r, 100));
            }
            
            goodsIdInput.focus();
            setNativeValue(goodsIdInput, goodsId);
            goodsIdInput.dispatchEvent(new Event('input', { bubbles: true }));
            goodsIdInput.dispatchEvent(new Event('change', { bubbles: true }));
            
            await new Promise(r => setTimeout(r, 300));
            
            goodsIdInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            goodsIdInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
            
            await new Promise(r => setTimeout(r, 800));
            
            const nextBtnSelectors = [
              'button[data-testid="beast-core-modal-ok-button"]',
              '.MDL_okBtn_5-180-0',
              'button[class*="ok"]',
              'button[class*="primary"]'
            ];
            
            let nextBtn = null;
            for (const selector of nextBtnSelectors) {
              const btn = modal.querySelector(selector);
              if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
                nextBtn = btn;
                break;
              }
            }
            
            if (!nextBtn) {
              const allButtons = modal.querySelectorAll('button');
              for (const btn of allButtons) {
                if (!btn.disabled) {  // ★ 修复：移除offsetParent限制
                  const text = btn.textContent.trim();
                  if (text.includes('下一步') || text.includes('确认') || text.includes('确定')) {
                    nextBtn = btn;
                    break;
                  }
                }
              }
            }
            
            if (nextBtn) {
              nextBtn.click();
              await new Promise(r => setTimeout(r, 800));
              
              const modalStillOpen = document.querySelector('.MDL_inner_5-180-0, [class*="modal"]:not([class*="mask"]), [class*="Modal"]');
              if (modalStillOpen) {  // ★ 修复：移除offsetParent限制（弹窗存在即可）
                await new Promise(r => setTimeout(r, 400));
                nextBtn.click();
                await new Promise(r => setTimeout(r, 600));
              }
            }
            
            await new Promise(r => setTimeout(r, 300));
            
            if (isVideoAlreadyFilled(videoItem)) {
              console.log('[PDD监控] ✅ 商品ID填充成功:', goodsId);
              resolve(true);
            } else {
              console.log('[PDD监控] ❌ 商品ID填充验证失败');
              if (attempts < maxAttempts) {
                console.log('[PDD监控] 准备重试...');
                return attemptFill();
              }
              resolve(false);
            }
            
          } catch (e) {
            console.error('[PDD监控] fillGoodsId 失败:', e);
            if (attempts < maxAttempts) {
              await new Promise(r => setTimeout(r, 1000));
              return attemptFill();
            }
            resolve(false);
          }
        }
        
        attemptFill();
      });
    }
    
    // 点击确认按钮
    function clickConfirmButton(resolve) {
      // 检查元素是否在悬浮球面板内
      function isInFloatingPanel(element) {
        return element.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel, #pdd-auto-fill-panel') !== null;
      }
      
      let confirmBtn = null;
      const confirmSelectors = [
        'button[data-testid="beast-core-modal-ok-button"]',
        '.ant-btn-primary',
        'button[class*="primary"]',
        'button[class*="confirm"]',
        'button[class*="submit"]',
        'button[class*="ok"]',
        'button[class*="next"]'
      ];
      
      for (const selector of confirmSelectors) {
        try {
          const btns = document.querySelectorAll(selector);
          for (const btn of btns) {
            // 排除悬浮球面板内的按钮
            if (isInFloatingPanel(btn)) {
              continue;
            }
            
            const text = btn.textContent || '';
            if (text.includes('确定') || text.includes('确认') || text.includes('提交') || text.includes('保存') || text.includes('下一步') || text.includes('完成')) {
              // 检查按钮是否可见
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                confirmBtn = btn;
                console.log('[PDD监控] 找到确认按钮(已排除悬浮球面板):', text);
                break;
              }
            }
          }
          if (confirmBtn) break;
        } catch (e) {}
      }
      
      // 如果没找到文本匹配的，尝试直接点击第一个可见的确认按钮
      if (!confirmBtn) {
        for (const selector of confirmSelectors) {
          try {
            const btns = document.querySelectorAll(selector);
            for (const btn of btns) {
              // 排除悬浮球面板内的按钮
              if (isInFloatingPanel(btn)) {
                continue;
              }
              
              const rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                confirmBtn = btn;
                console.log('[PDD监控] 找到确认按钮(通过selector,已排除悬浮球面板):', selector);
                break;
              }
            }
            if (confirmBtn) break;
          } catch (e) {}
        }
      }
      
      if (confirmBtn) {
        console.log('[PDD监控] 点击确认按钮');
        confirmBtn.click();
        
        // 等待弹窗关闭
        setTimeout(() => {
          console.log('[PDD监控] 商品ID填充完成，弹窗已关闭');
          resolve();
        }, 500);
      } else {
        console.log('[PDD监控] 未找到确认按钮，尝试关闭弹窗');
        closeModal();
        resolve();
      }
    }
    
    // 关闭弹窗
    function closeModal() {
      // 检查元素是否在悬浮球面板内
      function isInFloatingPanel(element) {
        return element.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel, #pdd-auto-fill-panel') !== null;
      }
      
      // 尝试点击取消按钮或关闭按钮
      const cancelSelectors = [
        '.ant-modal-close',
        '[class*="close"]'
      ];
      
      for (const selector of cancelSelectors) {
        try {
          const btns = document.querySelectorAll(selector);
          for (const btn of btns) {
            // 排除悬浮球面板内的按钮
            if (isInFloatingPanel(btn)) {
              continue;
            }
            console.log('[PDD监控] 点击关闭按钮(已排除悬浮球面板):', selector);
            btn.click();
            return;
          }
        } catch (e) {}
      }
      
      // 尝试查找文本为"取消"或"关闭"的按钮
      const allBtns = document.querySelectorAll('button');
      for (const btn of allBtns) {
        // 排除悬浮球面板内的按钮
        if (isInFloatingPanel(btn)) {
          continue;
        }
        
        const text = btn.textContent || '';
        if (text.includes('取消') || text.includes('关闭')) {
          console.log('[PDD监控] 找到取消/关闭按钮(已排除悬浮球面板):', text);
          btn.click();
          return;
        }
      }
      
      // 尝试按 ESC 键关闭弹窗
      console.log('[PDD监控] 尝试按 ESC 键关闭弹窗');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
    }
    
    // 旧的上传逻辑 - 跳转到发布页面（已废弃，保留代码兼容性）
    const stopPublishBtn = document.getElementById('pdd-stop-publish');
    if (stopPublishBtn) {
      stopPublishBtn.onclick = function() {
        isPublishing = false;
        if (publishInterval) {
          clearInterval(publishInterval);
          publishInterval = null;
        }
        document.getElementById('pdd-publish-status').textContent = '已停止发布';
      };
    }
    
    // 存储扫描到的视频文件
    let scannedVideoFiles = [];
    
    async function startBatchPublish(videoFiles, pidList, autoFill, randomDesc, appendFilenameSuffix = false) {
      const statusEl = document.getElementById('pdd-publish-status');
      
      // 保存发布配置到 localStorage
      const config = {
        enabled: true,
        pidList: pidList,
        autoFill: autoFill,
        randomDesc: randomDesc,
        appendFilenameSuffix: appendFilenameSuffix,
        currentIndex: 0,
        startTime: Date.now(),
        videoFiles: [] // 存储视频文件信息
      };
      
      // 存储视频文件到 IndexedDB（因为 localStorage 不能存储文件）
      if (videoFiles && videoFiles.length > 0) {
        try {
          const db = await openVideoDB();
          const filePromises = Array.from(videoFiles).map((file, index) => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const transaction = db.transaction(['videos'], 'readwrite');
                const store = transaction.objectStore('videos');
                store.put({
                  id: `video_${index}`,
                  name: file.name,
                  type: file.type,
                  size: file.size,
                  data: reader.result
                });
                resolve({ name: file.name, type: file.type, size: file.size });
              };
              reader.onerror = reject;
              reader.readAsArrayBuffer(file);
            });
          });
          
          config.videoFiles = await Promise.all(filePromises);
          console.log('[PDD监控] 视频文件已保存到 IndexedDB:', config.videoFiles.length);
        } catch (e) {
          console.error('[PDD监控] 保存视频文件失败:', e);
        }
      }
      
      localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
      
      statusEl.textContent = `发布配置已保存！产品ID: ${pidList.join(', ')}, 视频: ${config.videoFiles.length}个`;
      
      // 打开发布页面（首页，然后自动点击上传按钮）
      const publishUrl = 'https://live.pinduoduo.com/n-creator/video/home';
      console.log('[PDD监控] 打开发布页面:', publishUrl);
      // 使用当前页面跳转，而不是打开新页面
      window.location.href = publishUrl;
      
      alert('批量发布已启动！\n\n已保存配置：\n- 产品ID: ' + pidList.join(', ') + '\n- 视频数量: ' + config.videoFiles.length + '\n\n即将打开发布页面，');
    }
    
    // 打开 IndexedDB 存储视频
    function openVideoDB() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open('PDDVideoDB', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains('videos')) {
            db.createObjectStore('videos', { keyPath: 'id' });
          }
        };
      });
    }
    
    // 从 IndexedDB 读取视频文件
    async function getVideoFromDB(index) {
      const db = await openVideoDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['videos'], 'readonly');
        const store = transaction.objectStore('videos');
        const request = store.get(`video_${index}`);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    
    // 从 IndexedDB 加载所有视频文件
    async function loadVideosFromDB(count, pidList) {
      const videos = [];
      try {
        const db = await openVideoDB();
        for (let i = 0; i < count; i++) {
          const video = await new Promise((resolve, reject) => {
            const transaction = db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            const request = store.get(`video_${i}`);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          if (video) {
            // 将 ArrayBuffer 转换为 File 对象
            const blob = new Blob([video.data], { type: video.type });
            const file = new File([blob], video.name, { type: video.type });
            // 循环使用商品ID
            const goodsId = pidList && pidList.length > 0 ? pidList[i % pidList.length] : '';
            videos.push({
              fileName: video.name,
              file: file,
              goodsId: goodsId
            });
          }
        }
      } catch (e) {
        console.error('[PDD监控] 从 IndexedDB 加载视频失败:', e);
      }
      return videos;
    }
    
    // 自动上传视频（批量上传所有视频）
    async function autoUploadVideos(config) {
      const statusEl = document.getElementById('pdd-upload-progress');
      const progressEl = document.getElementById('pdd-upload-progress-bar');
      
      console.log('[PDD监控] 开始批量上传视频，共', config.videos.length, '个');
      statusEl.textContent = `准备批量上传 ${config.videos.length} 个视频...`;
      
      try {
        // 1. 准备所有视频的 File 对象
        const videoFiles = [];
        for (let i = 0; i < config.videos.length; i++) {
          const video = config.videos[i];
          
          if (video.file) {
            // 直接使用 File 对象
            videoFiles.push({
              file: video.file,
              fileName: video.fileName,
              goodsId: video.goodsId,
              appendFilenameSuffix: config.appendFilenameSuffix,
              index: i
            });
          } else if (video.filePath) {
            // 通过 Native Messaging 读取视频文件
            statusEl.textContent = `正在读取第 ${i + 1}/${config.videos.length} 个视频...`;
            const videoData = await readVideoFileNative(video.filePath);
            
            if (videoData.success && videoData.data) {
              // 将 base64 转换为 File 对象
              const binaryString = atob(videoData.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              const blob = new Blob([bytes], { type: videoData.fileType || 'video/mp4' });
              const file = new File([blob], videoData.fileName, { type: videoData.fileType || 'video/mp4' });
              
              videoFiles.push({
                file: file,
                fileName: video.fileName,
                goodsId: video.goodsId,
                appendFilenameSuffix: config.appendFilenameSuffix,
                index: i
              });
            } else {
              console.error('[PDD监控] 读取视频文件失败:', videoData.error);
              // 如果扩展上下文失效，停止处理并提示刷新
              if (videoData.contextInvalidated) {
                statusEl.textContent = '扩展已更新或重新加载，请刷新页面后重试';
                statusEl.style.color = '#ff4d4f';
                isPublishing = false;
                return;
              }
            }
          }
        }
        
        if (videoFiles.length === 0) {
          statusEl.textContent = '❌ 没有可上传的视频文件';
          isPublishing = false;
          return;
        }
        
        console.log('[PDD监控] 成功准备', videoFiles.length, '个视频文件');
        statusEl.textContent = `正在上传 ${videoFiles.length} 个视频...`;
        
        // 2. 一次性上传所有视频
        console.log('[PDD监控] 调用 uploadMultipleVideosToPage...');
        try {
          await uploadMultipleVideosToPage(videoFiles, statusEl, progressEl);
          console.log('[PDD监控] uploadMultipleVideosToPage 完成');
        } catch (uploadErr) {
          console.error('[PDD监控] uploadMultipleVideosToPage 失败:', uploadErr);
          statusEl.textContent = '❌ 上传失败: ' + uploadErr.message;
        }
        
      } catch (err) {
        console.error('[PDD监控] 批量上传失败:', err);
        statusEl.textContent = '❌ 批量上传失败: ' + err.message;
      }
      
      isPublishing = false;
    }
    
    // 一次性上传多个视频到页面
    async function uploadMultipleVideosToPage(videoFiles, statusEl, progressEl) {
      return new Promise(async (resolve, reject) => {
        try {
          // 1. 查找上传按钮
          console.log('[PDD监控] 批量上传: 查找上传按钮...');
          let uploadBtn = await findUploadButtonWithScroll();
          
          if (!uploadBtn) {
            // 重试几次
            for (let i = 0; i < 3 && !uploadBtn; i++) {
              await new Promise(r => setTimeout(r, 1000));
              uploadBtn = await findUploadButtonWithScroll();
            }
          }
          
          if (!uploadBtn) {
            reject(new Error('未找到上传按钮'));
            return;
          }
          
          console.log('[PDD监控] 批量上传: 找到上传按钮');
          
          // 2. 查找文件 input（多等待一段时间，确保页面加载完成）
          let fileInput = findFileInput();
          let retryCount = 0;
          const maxRetries = 5;
          
          // 等待文件 input 出现，不主动点击上传按钮
          while (!fileInput && retryCount < maxRetries) {
            retryCount++;
            console.log(`[PDD监控] 批量上传: 等待文件 input 出现... (${retryCount}/${maxRetries})`);
            await new Promise(r => setTimeout(r, 1000));
            fileInput = findFileInput();
          }
          
          if (!fileInput) {
            // 最后尝试：点击上传按钮，但立即阻止默认行为
            console.log('[PDD监控] 批量上传: 最后尝试点击上传按钮...');
            
            // 先设置一个标志，表示我们正在自动上传
            window.__pddAutoUploading = true;
            
            uploadBtn.click();
            await new Promise(r => setTimeout(r, 500));
            fileInput = findFileInput();
            
            // 清除标志
            window.__pddAutoUploading = false;
          }
          
          if (!fileInput) {
            reject(new Error('未找到文件输入框'));
            return;
          }
          
          console.log('[PDD监控] 批量上传: 找到文件输入框，准备设置', videoFiles.length, '个文件');
          
          // 3. 使用 DataTransfer 设置多个文件 - React 兼容方式
          const dataTransfer = new DataTransfer();
          for (const video of videoFiles) {
            dataTransfer.items.add(video.file);
          }
          setNativeFiles(fileInput, dataTransfer.files);
          
          console.log('[PDD监控] 批量上传: 已设置', videoFiles.length, '个视频文件');
          statusEl.textContent = `📤 已选择 ${videoFiles.length} 个视频，正在上传...`;
          
          // 5. 监听所有视频上传完成
          console.log('[PDD监控] 批量上传: 准备调用 waitForAllVideosUploadComplete');
          try {
            waitForAllVideosUploadComplete(videoFiles, statusEl, progressEl, resolve);
            console.log('[PDD监控] 批量上传: waitForAllVideosUploadComplete 调用完成');
          } catch (err) {
            console.error('[PDD监控] 批量上传: waitForAllVideosUploadComplete 调用失败:', err);
            reject(err);
          }
          
        } catch (err) {
          console.error('[PDD监控] 批量上传: uploadMultipleVideosToPage 出错:', err);
          reject(err);
        }
      });
    }
    
    // 等待所有视频上传完成并填写商品ID
    async function waitForAllVideosUploadComplete(videoFiles, statusEl, progressEl, resolve) {
      console.log('[PDD监控] 批量上传: waitForAllVideosUploadComplete 启动，视频数:', videoFiles.length);
      
      const totalVideos = videoFiles.length;
      const processedVideos = new Set();
      const matchedVideoFiles = new Set(); // 已匹配的视频文件索引
      const pendingVideos = []; // 待处理的视频队列
      let checkCount = 0;
      const maxChecks = 300; // 最多等待5分钟
      let isProcessing = false; // 是否正在处理模态框
      
      // 处理单个视频的函数
      async function processSingleVideo(videoItem, videoData, index) {
        console.log('[PDD监控] 批量上传: 开始处理视频', index, '商品ID:', videoData.goodsId);
        statusEl.textContent = `📝 正在处理视频 ${index + 1}/${totalVideos}...`;
        
        return new Promise((resolveProcess) => {
          // 处理商品ID的函数
          function proceedWithGoodsId() {
            // 点击"添加商品"按钮
            const addGoodsBtn = videoItem.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');
            
            if (!addGoodsBtn) {
              console.log('[PDD监控] 批量上传: 视频', index, '未找到添加商品按钮');
              resolveProcess(false);
              return;
            }
            
            console.log('[PDD监控] 批量上传: 点击视频', index, '的添加商品按钮');
            addGoodsBtn.click();
            
            // 等待弹窗出现并填写商品ID
            console.log('[PDD监控] 批量上传: 等待弹窗出现...');
            setTimeout(() => {
              console.log('[PDD监控] 批量上传: 开始调用 fillGoodsIdInModalForBatch');
              fillGoodsIdInModalForBatch(videoData.goodsId, () => {
                console.log('[PDD监控] 批量上传: 视频', index, '商品ID填写完成');
                resolveProcess(true);
              });
            }, 1500); // 增加等待时间到1.5秒
          }
          
          // 直接处理商品ID
          proceedWithGoodsId();
        });
      }
      
      // 处理队列的函数
      async function processQueue() {
        if (isProcessing || pendingVideos.length === 0) return;
        
        isProcessing = true;
        const { videoItem, videoData, index } = pendingVideos.shift();
        
        try {
          await processSingleVideo(videoItem, videoData, index);
          processedVideos.add(index);
        } catch (err) {
          console.error('[PDD监控] 批量上传: 处理视频', index, '出错:', err);
        }
        
        isProcessing = false;
        
        // 继续处理队列
        if (pendingVideos.length > 0) {
          setTimeout(processQueue, 1000);
        }
      }
      
      console.log('[PDD监控] 批量上传: 开始检查循环');
      
      const checkInterval = setInterval(() => {
        checkCount++;
        
        // 查找所有视频项 - 使用更多选择器
        let videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
        
        // 如果没找到，尝试其他选择器
        if (videoItems.length === 0) {
          videoItems = document.querySelectorAll('[class*="video-list"] [class*="item"], [class*="VideoList"] [class*="item"]');
        }
        
        // 再尝试更通用的选择器
        if (videoItems.length === 0) {
          videoItems = document.querySelectorAll('.RC-VideoList > div, [class*="video"] [class*="list"] > div');
        }
        
        // 尝试直接查找包含"添加商品"按钮的元素
        if (videoItems.length === 0) {
          const addGoodsButtons = document.querySelectorAll('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');
          if (addGoodsButtons.length > 0) {
            console.log('[PDD监控] 批量上传: 通过添加商品按钮找到', addGoodsButtons.length, '个视频');
            // 获取这些按钮的父元素作为视频项
            videoItems = Array.from(addGoodsButtons).map(btn => btn.closest('[class*="item"], [class*="video"], div') || btn.parentElement);
          }
        }
        
        // 总是打印前10次检查，之后每5秒打印一次
        if (checkCount <= 10 || videoItems.length > 0 || checkCount % 5 === 0) {
          console.log('[PDD监控] 批量上传: 检查视频项，当前有', videoItems.length, '个，已处理', processedVideos.size, '个，队列中', pendingVideos.length, '个，检查次数', checkCount);
          
          // 调试：如果前5次都没找到视频项，打印页面结构
          if (checkCount <= 5 && videoItems.length === 0) {
            const videoListContainer = document.querySelector('.video-list_listWrap__8Z7cX, [class*="video-list"], [class*="VideoList"]');
            if (videoListContainer) {
              console.log('[PDD监控] 批量上传: 视频列表容器HTML:', videoListContainer.innerHTML.substring(0, 800));
            } else {
              console.log('[PDD监控] 批量上传: 未找到视频列表容器');
            }
          }
        }
        
        // 更新进度
        const progress = Math.min((videoItems.length / totalVideos) * 100, 100);
        progressEl.style.width = `${progress}%`;
        statusEl.textContent = `📤 正在上传... (${videoItems.length}/${totalVideos})`;
        
        // 遍历所有视频项，查找可以填写商品ID的
        videoItems.forEach((videoItem, index) => {
          // 如果这个视频已经处理过或在队列中，跳过
          if (processedVideos.has(index)) return;
          if (pendingVideos.some(v => v.index === index)) return;
          
          // 检查是否有"添加商品"按钮
          const addGoodsBtn = videoItem.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');
          
          // 调试：打印前几个视频项的按钮查找情况
          if (index < 3) {
            console.log('[PDD监控] 批量上传: 视频项', index, '查找添加商品按钮:', addGoodsBtn ? '找到' : '未找到');
            if (!addGoodsBtn) {
              // 打印视频项的HTML以便调试
              console.log('[PDD监控] 批量上传: 视频项', index, 'HTML:', videoItem.innerHTML.substring(0, 200));
            }
          }

          // ★ 修复：按钮存在即可（不再要求可视）
          if (addGoodsBtn) {
            let displayedFileName = null;
            const fileNameSelectors = [
              '.video-list_fileName___Diex p',
              '.video-list_fileName___Diex',
              '[class*="video-list_fileName"] p',
              '[class*="video-list_fileName"]',
              '[class*="fileName"]:not([class*="duration"]):not([class*="time"])'
            ];
            
            for (const selector of fileNameSelectors) {
              const fileNameEl = videoItem.querySelector(selector);
              if (fileNameEl) {
                const text = fileNameEl.textContent?.trim();
                if (text && text.length > 2 && !text.match(/^\d-[0-9]$/)) {
                  displayedFileName = text;
                  console.log('[PDD监控] 批量上传: 从页面获取文件名:', text);
                  break;
                }
              }
            }
            
            let matchedVideoData = null;
            let matchedIndex = -1;
            
            if (displayedFileName) {
              // 获取未匹配的视频文件列表
              const availableFiles = videoFiles.map((vf, idx) => ({ ...vf, originalIndex: idx }))
                .filter(vf => !matchedVideoFiles.has(vf.originalIndex));
              
              // 使用 findBestFileMatch 进行精确匹配
              matchedVideoData = findBestFileMatch(displayedFileName, availableFiles);
              
              if (matchedVideoData) {
                matchedIndex = matchedVideoData.originalIndex;
              } else {
                // 备用：使用包含匹配
                const displayedBase = displayedFileName.replace(/\.[^/.]+$/, '').toLowerCase().trim();
                for (const vf of availableFiles) {
                  const vfBaseName = vf.fileName ? vf.fileName.replace(/\.[^/.]+$/, '').toLowerCase().trim() : '';
                  if (vfBaseName === displayedBase || 
                      vfBaseName.includes(displayedBase) || 
                      displayedBase.includes(vfBaseName)) {
                    matchedVideoData = vf;
                    matchedIndex = vf.originalIndex;
                    break;
                  }
                }
              }
            }
            
            // 如果没匹配到，使用第一个未匹配的
            if (!matchedVideoData) {
              for (let vfIndex = 0; vfIndex < videoFiles.length; vfIndex++) {
                if (!matchedVideoFiles.has(vfIndex)) {
                  matchedVideoData = videoFiles[vfIndex];
                  matchedIndex = vfIndex;
                  break;
                }
              }
            }
            
            const videoData = matchedVideoData;
            if (videoData && videoData.goodsId && matchedIndex >= 0) {
              matchedVideoFiles.add(matchedIndex); // 标记为已匹配
              
              // 加入队列
              pendingVideos.push({ videoItem, videoData, index });
              
              // 启动队列处理
              processQueue();
            }
          }
        });
        
        // 检查是否全部完成
        if (processedVideos.size >= totalVideos) {
          clearInterval(checkInterval);
          const idx = activeResources.intervals.indexOf(checkInterval);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          
          progressEl.style.width = '100%';
          statusEl.innerHTML = `<span style="color:#27ae60;font-weight:600;">✅ 全部完成！已上传 ${processedVideos.size} 个视频</span>`;
          
          resolve();
          return;
        }
        
        // 超时检查
        if (checkCount >= maxChecks) {
          clearInterval(checkInterval);
          const idx = activeResources.intervals.indexOf(checkInterval);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          
          progressEl.style.width = '100%';
          statusEl.innerHTML = `<span style="color:#e65100;font-weight:600;">⚠️ 部分完成！已上传 ${processedVideos.size}/${totalVideos} 个视频</span>`;
          
          resolve();
        }
      }, 1000);
      
      activeResources.intervals.push(checkInterval);
    }
    
    // 批量上传专用的填写商品ID函数
    function fillGoodsIdInModalForBatch(goodsId, callback) {
      console.log('[PDD监控] 批量: fillGoodsIdInModalForBatch 启动，商品ID:', goodsId);
      
      // 首先尝试关闭可能的干扰弹窗
      if (typeof closeInterferenceModal === 'function') {
        closeInterferenceModal();
      }
      
      let checkCount = 0;
      const maxChecks = 50; // 最多检查5秒
      
      // 处理模态框的函数
      const processModal = function(modal, goodsId, callback) {
        console.log('[PDD监控] 批量: 处理模态框，商品ID:', goodsId);
        
        // 检查是否是干扰弹窗
        const modalText = modal.textContent || '';
        if (modalText.includes('礼物收益') || modalText.includes('拼多多商家版APP') || modalText.includes('我知道了')) {
          console.log('[PDD监控] 批量: 检测到干扰弹窗，先关闭');
          if (typeof closeInterferenceModal === 'function') {
            closeInterferenceModal();
          }
          // 等待弹窗关闭后继续
          setTimeout(() => {
            // 重新检查模态框
            const newModal = document.querySelector('.MDL_inner_5-180-0, [class*="modal"], [class*="Modal"]');
            if (newModal && !newModal.textContent.includes('礼物收益')) {
              processModal(newModal, goodsId, callback);
            } else {
              callback();
            }
          }, 500);
          return;
        }
        
        // 调试：打印模态框内所有元素
        console.log('[PDD监控] 批量: 模态框HTML:', modal.innerHTML.substring(0, 500));
        
        // 1. 先点击"商品ID"Tab - 使用多种方式查找
        let goodsIdTab = null;
        
        // 方式1: 通过选择器查找
        const tabSelectors = [
          '.TAB_lineLabel_5-180-0',
          '[class*="lineLabel"]',
          '[class*="tab"]',
          '[class*="Tab"]',
          '[role="tab"]'
        ];
        
        for (const selector of tabSelectors) {
          const tabs = modal.querySelectorAll(selector);
          console.log('[PDD监控] 批量: 选择器', selector, '找到', tabs.length, '个元素');
          for (const tab of tabs) {
            const text = tab.textContent?.trim() || '';
            console.log('[PDD监控] 批量: 检查元素文本:', text, 'class:', tab.className);
            if (text === '商品ID' || text.includes('商品ID')) {
              goodsIdTab = tab;
              console.log('[PDD监控] 批量: 找到"商品ID"Tab:', selector);
              break;
            }
          }
          if (goodsIdTab) break;
        }
        
        // 方式2: 如果上面没找到，遍历所有子元素
        if (!goodsIdTab) {
          console.log('[PDD监控] 批量: 使用遍历方式查找Tab');
          const allElements = modal.querySelectorAll('*');
          for (const el of allElements) {
            const text = el.textContent?.trim();
            if (text === '商品ID') {
              console.log('[PDD监控] 批量: 遍历找到"商品ID":', el.tagName, el.className);
              goodsIdTab = el;
              break;
            }
          }
        }
        
        if (goodsIdTab) {
          console.log('[PDD监控] 批量: 点击"商品ID"Tab, 元素:', goodsIdTab);
          
          // 尝试多种点击方式
          try {
            // 方式1: 直接点击
            goodsIdTab.click();
            console.log('[PDD监控] 批量: 直接点击完成');
          } catch (e) {
            console.log('[PDD监控] 批量: 直接点击失败:', e);
            try {
              // 方式2: 触发mousedown和mouseup
              goodsIdTab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              goodsIdTab.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              goodsIdTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              console.log('[PDD监控] 批量: 鼠标事件触发完成');
            } catch (e2) {
              console.log('[PDD监控] 批量: 鼠标事件也失败:', e2);
            }
          }
          
          // 尝试点击父元素（有时候Tab的点击区域在父元素上）
          const parent = goodsIdTab.parentElement;
          if (parent && parent !== modal) {
            setTimeout(() => {
              console.log('[PDD监控] 批量: 尝试点击父元素');
              parent.click();
            }, 100);
          }
        } else {
          console.log('[PDD监控] 批量: 警告: 未找到"商品ID"Tab，尝试直接查找输入框');
          
          // 备用方案：不切换Tab，直接查找输入框
          const inputSelectors = [
            '.IPT_input_5-180-0',
            'input[placeholder*="商品id"]',
            'input[placeholder*="商品ID"]',
            'input[placeholder*="12345678"]',
            'input[type="text"]'
          ];
          
          for (const selector of inputSelectors) {
            const inputDirect = modal.querySelector(selector);
            if (inputDirect && !inputDirect.disabled) {  // ★ 修复：移除offsetParent限制
              console.log('[PDD监控] 批量: 未切换Tab但找到输入框，直接填写:', goodsId);
              setNativeValue(inputDirect, goodsId);
              inputDirect.dispatchEvent(new Event('input', { bubbles: true }));
              inputDirect.dispatchEvent(new Event('change', { bubbles: true }));
              
              setTimeout(() => {
                inputDirect.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                inputDirect.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                
                setTimeout(() => {
                  clickNextButtonInModalForBatch(modal, callback);
                }, 2500);
              }, 1000);
              return;
            }
          }
          
          console.log('[PDD监控] 批量: 也未找到输入框，直接回调');
          callback();
          return;
        }
        
        // 2. 等待Tab切换后填写商品ID（增加等待时间到3秒）
        setTimeout(() => {
          // 首先检查当前是否在商品ID Tab（通过查找输入框）
          const inputSelectors = [
            '.IPT_input_5-180-0',
            'input[placeholder*="商品id"]',
            'input[placeholder*="商品ID"]',
            'input[placeholder*="12345678"]',
            'input[type="text"]'
          ];
          
          let inputFound = false;
          let input = null;
          
          for (const selector of inputSelectors) {
            input = modal.querySelector(selector);
            if (input && !input.disabled) {  // ★ 修复：移除offsetParent限制
              inputFound = true;
              break;
            }
          }
          
          if (inputFound && input) {
            input.scrollIntoView({ behavior: 'instant', block: 'center' });
            
            setTimeout(() => {
              input.focus();
              setNativeValue(input, goodsId);
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
              
              setTimeout(() => {
                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                
                setTimeout(() => {
                  clickNextButtonInModalForBatch(modal, callback);
                }, 3000); // 增加搜索等待时间到3秒
              }, 1500); // 增加输入后等待时间
            }, 300);
          } else {
            // 备用方案：尝试直接查找并点击"商品ID"文本
            const allElements = modal.querySelectorAll('*');
            for (const el of allElements) {
              if (el.textContent?.trim() === '商品ID') {
                el.click();
                
                // 等待后再次查找输入框（增加等待时间）
                setTimeout(() => {
                  for (const selector of inputSelectors) {
                    const inputRetry = modal.querySelector(selector);
                    if (inputRetry && !inputRetry.disabled) {  // ★ 修复：移除offsetParent限制
                      inputRetry.scrollIntoView({ behavior: 'instant', block: 'center' });
                      
                      setTimeout(() => {
                        inputRetry.focus();
                        setNativeValue(inputRetry, goodsId);
                        inputRetry.dispatchEvent(new Event('input', { bubbles: true }));
                        inputRetry.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        setTimeout(() => {
                          inputRetry.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                          inputRetry.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                          
                          setTimeout(() => {
                            clickNextButtonInModalForBatch(modal, callback);
                          }, 3000); // 增加搜索等待时间到3秒
                        }, 1500);
                      }, 300);
                      return;
                    }
                  }
                  callback();
                }, 2000); // 增加Tab切换等待时间
                return;
              }
            }
            
            // 如果备用方案也失败，直接回调
            callback();
          }
        }, 3000); // 增加等待时间到3秒
      }; // end of processModal function
      
      const checkModal = setInterval(() => {
        checkCount++;
        
        if (checkCount % 10 === 0 && typeof closeInterferenceModal === 'function') {
          closeInterferenceModal();
        }
        
        const modal = document.querySelector('.MDL_inner_5-180-0, [class*="modal"], [class*="Modal"]');
        
        if (modal) {
          const modalText = modal.textContent || '';
          if (modalText.includes('礼物收益') || modalText.includes('拼多多商家版APP')) {
            clearInterval(checkModal);
            const idx = activeResources.intervals.indexOf(checkModal);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            if (typeof closeInterferenceModal === 'function') {
              closeInterferenceModal();
            }
            callback();
            return;
          }
          
          clearInterval(checkModal);
          const idx = activeResources.intervals.indexOf(checkModal);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          
          if (modal.offsetParent === null) {
            setTimeout(() => {
              processModal(modal, goodsId, callback);
            }, 1000);
          } else {
            processModal(modal, goodsId, callback);
          }
        }
      }, 300);
      
      activeResources.intervals.push(checkModal);
      
      setTimeout(() => {
        clearInterval(checkModal);
        const idx = activeResources.intervals.indexOf(checkModal);
        if (idx > -1) activeResources.intervals.splice(idx, 1);
        callback();
      }, 15000);
    }
    
    // 批量上传专用的点击下一步按钮
    function clickNextButtonInModalForBatch(modal, callback, retryCount = 0) {
      const maxRetries = 3; // 最多重试3次
      
      const nextBtnSelectors = [
        'button[data-testid="beast-core-modal-ok-button"]',
        '.MDL_okBtn_5-180-0',
        'button[class*="ok"]',
        'button[class*="primary"]'
      ];
      
      let nextBtn = null;
      for (const selector of nextBtnSelectors) {
        const btn = modal.querySelector(selector);
        if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
          nextBtn = btn;
          break;
        }
      }

      if (!nextBtn) {
        const allButtons = modal.querySelectorAll('button');
        for (const btn of allButtons) {
          if (!btn.disabled) {  // ★ 修复：移除offsetParent限制
            const text = btn.textContent.trim();
            if (text.includes('下一步') || text.includes('确认') || text.includes('确定')) {
              nextBtn = btn;
              break;
            }
          }
        }
      }

      if (nextBtn) {
        nextBtn.click();

        // 等待模态框关闭（增加等待时间到3秒）
        setTimeout(() => {
          // 检查模态框是否真的关闭了
          const modalStillOpen = document.querySelector('.MDL_inner_5-180-0, [class*="modal"]:not([class*="mask"]), [class*="Modal"]');
          if (modalStillOpen) {  // ★ 修复：移除offsetParent限制
            if (retryCount < maxRetries) {
              // 尝试再次点击
              setTimeout(() => {
                nextBtn.click();
                setTimeout(callback, 1500);
              }, 1000);
            } else {
              callback();
            }
          } else {
            callback();
          }
        }, 3000); // 增加等待时间到3秒
      } else if (retryCount < maxRetries) {
        // 未找到按钮，等待后重试
        setTimeout(() => {
          clickNextButtonInModalForBatch(modal, callback, retryCount + 1);
        }, 1000);
      } else {
        callback();
      }
    }
    
    // 通过 Native Messaging 读取视频文件
    function readVideoFileNative(filePath) {
      console.log('[PDD监控] 尝试读取本地文件:', filePath);
      
      return new Promise((resolve) => {
        // 检查扩展上下文是否有效
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
          console.error('[PDD监控] 扩展上下文已失效');
          resolve({ success: false, error: '扩展上下文已失效，请刷新页面后重试', contextInvalidated: true });
          return;
        }
        
        // 设置超时，防止消息发送后没有响应
        let timeoutId;
        let isResolved = false;
        
        const safeResolve = (result) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        };
        
        timeoutId = setTimeout(() => {
          console.error('[PDD监控] readLocalFile 请求超时');
          safeResolve({ success: false, error: '读取文件超时，请检查扩展是否正常运行' });
        }, 30000); // 30秒超时
        
        chrome.runtime.sendMessage({
          action: 'readLocalFile',
          filePath: filePath
        }, (response) => {
          if (isResolved) return; // 已经超时了
          
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.error('[PDD监控] Native Messaging 错误:', errorMsg);
            const isContextInvalidated = errorMsg && errorMsg.includes('Extension context invalidated');
            safeResolve({ 
              success: false, 
              error: isContextInvalidated ? '扩展上下文已失效，请刷新页面后重试' : errorMsg,
              contextInvalidated: isContextInvalidated
            });
          } else {
            console.log('[PDD监控] Native Messaging 响应:', response?.success, response?.error || 'ok');
            safeResolve(response || { success: false, error: '无响应' });
          }
        });
      });
    }
    
    // 上传视频到页面（从悬浮球面板调用）
    async function uploadVideoToPageFromPanel(videoData, goodsId, statusEl) {
      console.log('[PDD监控] uploadVideoToPageFromPanel 开始执行');
      
      return new Promise(async (resolve, reject) => {
        try {
          // 1. 查找上传按钮（带多次重试和滚动查找）
          console.log('[PDD监控] 正在查找上传按钮...');
          let uploadBtn = null;
          let retryCount = 0;
          const maxRetries = 5;
          
          while (!uploadBtn && retryCount < maxRetries) {
            // 第一次尝试直接查找，之后尝试滚动查找
            if (retryCount === 0) {
              uploadBtn = findUploadButton();
            } else {
              console.log('[PDD监控] 尝试滚动查找...');
              uploadBtn = await findUploadButtonWithScroll();
            }
            
            if (!uploadBtn) {
              retryCount++;
              console.log(`[PDD监控] 第 ${retryCount} 次未找到上传按钮，等待...`);
              statusEl.textContent = `正在查找上传按钮...(${retryCount}/${maxRetries})`;
              await new Promise(r => setTimeout(r, 1500));
            }
          }
          
          console.log('[PDD监控] 上传按钮:', uploadBtn);
          
          if (!uploadBtn) {
            console.error('[PDD监控] 未找到上传按钮');
            statusEl.textContent = '❌ 未找到上传按钮，请检查页面';
            reject(new Error('未找到上传按钮'));
            return;
          }
          
          // 2. 查找文件 input（带重试，不主动点击上传按钮）
          console.log('[PDD监控] 正在查找文件输入框...');
          let fileInput = findFileInput();
          console.log('[PDD监控] 初始文件输入框:', fileInput);
          
          // 等待文件 input 出现
          let inputRetryCount = 0;
          const inputMaxRetries = 5;
          while (!fileInput && inputRetryCount < inputMaxRetries) {
            inputRetryCount++;
            console.log(`[PDD监控] 等待文件输入框... (${inputRetryCount}/${inputMaxRetries})`);
            await new Promise(r => setTimeout(r, 1000));
            fileInput = findFileInput();
          }
          
          // 如果还没找到，最后尝试点击上传按钮
          if (!fileInput) {
            console.log('[PDD监控] 最后尝试点击上传按钮...');
            window.__pddAutoUploading = true;
            uploadBtn.click();
            await new Promise(r => setTimeout(r, 500));
            fileInput = findFileInput();
            window.__pddAutoUploading = false;
            console.log('[PDD监控] 点击后文件输入框:', fileInput);
          }
          
          if (!fileInput) {
            console.error('[PDD监控] 未找到文件输入框');
            statusEl.textContent = '❌ 未找到文件输入框';
            reject(new Error('未找到文件输入框'));
            return;
          }
          
          console.log('[PDD监控] 开始执行上传...');
          statusEl.textContent = '正在上传视频...';
          doUploadFromPanel(fileInput, videoData, goodsId, statusEl, resolve);
          
        } catch (err) {
          console.error('[PDD监控] uploadVideoToPageFromPanel 出错:', err);
          statusEl.textContent = '❌ 上传出错: ' + err.message;
          reject(err);
        }
      });
    }
    
    // 全局已处理视频记录（避免重复处理）
    window.__pddProcessedVideos = window.__pddProcessedVideos || new Set();
    
    function waitForVideoUploadCompleteFromPanel(goodsId, statusEl, resolve) {
      let attempts = 0;
      const maxAttempts = 120; // 增加最大尝试次数
      let lastVideoCount = 0;
      let stableCount = 0;
      let isProcessing = false;
      let totalProcessedCount = 0; // 本次处理的视频数量
      
      const checkInterval = setInterval(async () => {
        if (isProcessing) return;
        isProcessing = true;
        
        try {
          attempts++;
          
          const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
          
          if (videoItems.length > 0) {
            if (videoItems.length === lastVideoCount) {
              stableCount++;
            } else {
              stableCount = 0;
              lastVideoCount = videoItems.length;
            }
            
            // 查找未处理的视频（有添加商品按钮的）
            let targetVideo = null;
            let targetIndex = -1;
            let targetVideoId = null;
            
            for (let i = videoItems.length - 1; i >= 0; i--) {
              const video = videoItems[i];
              const videoId = video.getAttribute('data-key') || video.dataset.id || `video_${i}`;
              
              // 跳过已处理的视频
              if (window.__pddProcessedVideos.has(videoId)) continue;
              
              const addGoodsBtn = video.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');
              const progressBar = video.querySelector('[class*="progress"], [class*="Progress"]');
              const uploadingIndicator = video.querySelector('[class*="uploading"], [class*="Uploading"], [class*="loading"], [class*="Loading"]');
              
              // 检查视频是否正在上传
              if (progressBar || uploadingIndicator) {
                continue;
              }
              
              // 检查是否有添加商品按钮（说明视频已处理完成）
              // ★ 修复：不再要求按钮在可视区内
              if (addGoodsBtn) {
                // 额外检查：确保视频有封面图
                const coverImg = video.querySelector('img[src*="blob:"], img[src*="http"], img[class*="cover"], img[class*="thumbnail"]');
                if (coverImg && coverImg.complete && coverImg.naturalWidth > 10) {
                  targetVideo = video;
                  targetIndex = i;
                  targetVideoId = videoId;
                  break;
                }
              }
            }
            
            if (targetVideo && targetIndex >= 0) {
              // 标记为已处理（在处理之前就标记，避免重复处理）
              window.__pddProcessedVideos.add(targetVideoId);
              totalProcessedCount++;
              
              // 额外等待确保视频完全处理完成
              await new Promise(r => setTimeout(r, 2000));
              
              statusEl.textContent = `📝 填写商品信息中... (第${totalProcessedCount}个)`;
              
              try {
                const success = await fillGoodsIdForVideo(targetVideo, goodsId, description, contentDeclaration);
                if (success) {
                  statusEl.textContent = `✅ 商品信息已填写 (第${totalProcessedCount}个)`;
                  console.log(`[PDD监控] 第${totalProcessedCount}个视频商品ID填充成功`);
                } else {
                  statusEl.textContent = `⚠️ 商品信息填写失败，将在下次重试 (第${totalProcessedCount}个)`;
                  // 移除标记，允许下次重试
                  window.__pddProcessedVideos.delete(targetVideoId);
                  console.log(`[PDD监控] 第${totalProcessedCount}个视频商品ID填充失败，已移除标记`);
                }
              } catch (e) {
                statusEl.textContent = `⚠️ 填写商品信息失败 (第${totalProcessedCount}个)`;
                console.error('[PDD监控] 填充商品ID出错:', e);
                // 移除标记，允许重试
                window.__pddProcessedVideos.delete(targetVideoId);
              }
              
              // 继续等待下一个视频，不要立即 resolve
              // 等待一段时间后继续检查
              await new Promise(r => setTimeout(r, 1000));
              // 不要 return，继续循环检查
              return;
            }
            
            // 检查是否所有视频都已处理
            let allProcessed = true;
            for (let i = 0; i < videoItems.length; i++) {
              const video = videoItems[i];
              const videoId = video.getAttribute('data-key') || video.dataset.id || `video_${i}`;
              if (!window.__pddProcessedVideos.has(videoId)) {
                const addGoodsBtn = video.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');
                // ★ 修复：按钮存在即表示未完成（不再要求可视）
                if (addGoodsBtn) {
                  allProcessed = false;
                  break;
                }
              }
            }
            
            if (allProcessed && totalProcessedCount > 0) {
              clearInterval(checkInterval);
              const idx = activeResources.intervals.indexOf(checkInterval);
              if (idx > -1) activeResources.intervals.splice(idx, 1);
              statusEl.textContent = `✅ 所有视频处理完成 (共${totalProcessedCount}个)`;
              resolve();
              return;
            }
            
            // 如果所有视频都在上传中，继续等待
            if (attempts % 10 === 0) {
              statusEl.textContent = `📤 视频上传中... (已处理${totalProcessedCount}个)`;
            }
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            const idx = activeResources.intervals.indexOf(checkInterval);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            statusEl.textContent = `⚠️ 等待上传超时 (已处理${totalProcessedCount}个)`;
            resolve();
          }
        } finally {
          isProcessing = false;
        }
      }, 1500);
      
      activeResources.intervals.push(checkInterval);
    }
    
    // 执行上传（从悬浮球面板调用）
    function doUploadFromPanel(fileInput, videoData, goodsId, statusEl, resolve) {
      try {
        let file;
        
        // 如果已经有 File 对象，直接使用
        if (videoData.file) {
          file = videoData.file;
          console.log('[PDD监控] 使用已有的 File 对象:', file.name);
        } else if (videoData.data) {
          // 将 base64 转换为 File 对象
          console.log('[PDD监控] 将 base64 转换为 File 对象');
          const binaryString = atob(videoData.data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: videoData.fileType || 'video/mp4' });
          file = new File([blob], videoData.fileName, { type: videoData.fileType || 'video/mp4' });
        } else {
          throw new Error('没有可用的视频数据');
        }
        
        // 使用 DataTransfer 设置文件 - React 兼容方式
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        setNativeFiles(fileInput, dataTransfer.files);
        
        console.log('[PDD监控] 视频已设置到 input:', videoData.fileName);
        statusEl.textContent = '📤 视频上传中，等待完成...';
        
        // 等待视频上传完成
        waitForVideoUploadCompleteFromPanel(goodsId, statusEl, resolve);
      } catch (err) {
        console.error('[PDD监控] 上传出错:', err);
        statusEl.textContent = '❌ 上传出错: ' + err.message;
        resolve();
      }
    }
    
    // 等待视频上传完成（从悬浮球面板调用）- 第二个版本（兼容旧调用）
    function waitForVideoUploadCompleteFromPanelV2(goodsId, statusEl, resolve) {
      // 调用新版本
      waitForVideoUploadCompleteFromPanel(goodsId, statusEl, resolve);
    }
    
    // 监听视频上传并自动填写商品ID - 优化版本
    // 上传单个视频文件
    async function uploadVideoFile(videoData, goodsId, randomDesc) {
      return new Promise(async (resolve, reject) => {
        try {
          // 1. 创建 File 对象
          const blob = new Blob([videoData.data], { type: videoData.type });
          const file = new File([blob], videoData.name, { type: videoData.type });
          
          // 2. 查找上传区域（用于模拟拖拽）
          const uploadArea = document.querySelector('.no-video_noVideoWrap__opXQS, [class*="no-video"]');
          
          // 3. 查找文件 input
          let fileInput = findFileInput();
          
          if (uploadArea) {
            // 方式1：模拟拖拽上传
            console.log('[PDD监控] 尝试模拟拖拽上传');
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            // 触发拖拽事件
            uploadArea.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
            uploadArea.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
            uploadArea.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
            
            console.log('[PDD监控] 拖拽事件已触发');
            
            // 等待一下看看是否开始上传
            await new Promise(r => setTimeout(r, 1000));
          }
          
          // 方式2：直接设置 input
          if (fileInput) {
            console.log('[PDD监控] 尝试直接设置 input');
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            setNativeFiles(fileInput, dataTransfer.files);
            
            console.log('[PDD监控] 文件已设置到 input:', videoData.name);
          }
          
          // 4. 等待上传完成并填写商品ID
          await waitForVideoUploadAndFillGoodsId(goodsId, randomDesc);
          
          resolve();
          
        } catch (err) {
          reject(err);
        }
      });
    }
    
    // 查找上传按钮
    function findUploadButton() {
      // 先尝试 class 选择器
      const classSelectors = [
        '.no-video_noVideoWrap__opXQS button',
        '.no-video_uploadImg__aYTLk',
        '[class*="no-video"] button',
        '.BTN_primary_5-180-0',
        'button[class*="primary"]'
      ];
      
      for (const selector of classSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {  // ★ 修复：移除offsetParent限制
          return btn;
        }
      }

      // 再通过文本内容查找
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        if (  // ★ 修复：移除offsetParent限制
            (btn.textContent.includes('添加视频') || btn.textContent.includes('上传视频'))) {
          return btn;
        }
      }
      
      return null;
    }
    
    // 查找文件 input
    function findFileInput() {
      // 先查找可见的 file input
      const selectors = [
        'input[type="file"]',
        'input[accept*="video"]',
        'input[accept*=".mp4"]'
      ];
      
      for (const selector of selectors) {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          // 不检查是否可见，因为可能是隐藏的
          if (input) {
            console.log('[PDD监控] 找到文件 input:', selector, input);
            return input;
          }
        }
      }
      
      // 如果找不到，尝试在 iframe 中查找
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const input = iframeDoc.querySelector('input[type="file"]');
          if (input) {
            console.log('[PDD监控] 在 iframe 中找到文件 input');
            return input;
          }
        } catch (e) {
          // 跨域 iframe 无法访问
        }
      }
      
      return null;
    }
    
    // 等待视频上传完成并填写商品ID
    async function waitForVideoUploadAndFillGoodsId(goodsId, randomDesc) {
      return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 60;
        
        const checkInterval = setInterval(() => {
          attempts++;
          
          const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
          
          if (videoItems.length > 0) {
            const lastVideo = videoItems[videoItems.length - 1];
            const addGoodsBtn = lastVideo.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');

            // ★ 修复：按钮存在即可（不再要求可视）
            if (addGoodsBtn) {
              clearInterval(checkInterval);
              const idx = activeResources.intervals.indexOf(checkInterval);
              if (idx > -1) activeResources.intervals.splice(idx, 1);
              
              fillGoodsIdForVideo(lastVideo, goodsId, randomDesc);
              
              resolve();
              return;
            }
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            const idx = activeResources.intervals.indexOf(checkInterval);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            resolve();
          }
        }, 1000);
        
        activeResources.intervals.push(checkInterval);
      });
    }
    
    // 点击弹窗中的下一步按钮
    function clickNextButtonInModal(modal) {
      // 先查找所有按钮，找到包含"下一步"或"确认"文字的
      const allButtons = modal.querySelectorAll('button');
      for (const btn of allButtons) {
        if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
          const text = btn.textContent || '';
          if (text.includes('下一步') || text.includes('确认')) {
            console.log('[PDD监控] 点击下一步按钮:', text);
            btn.click();
            return true;
          }
        }
      }

      // 备用方案：通过选择器查找
      const nextBtnSelectors = [
        'button[data-testid="beast-core-modal-ok-button"]',
        '.MDL_okBtn_5-180-0'
      ];

      for (const selector of nextBtnSelectors) {
        try {
          const btn = modal.querySelector(selector);
          if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
            console.log('[PDD监控] 点击下一步按钮(selector)');
            btn.click();
            return true;
          }
        } catch (e) {
          // 忽略无效选择器错误
        }
      }
      return false;
    }
    
    // 自动填写产品ID功能
    function autoFillProductId(productId) {
      if (!productId) return false;
      
      console.log('[PDD监控] 尝试自动填写产品ID:', productId);
      
      // 设置输入框值的通用方法（支持React/Vue等框架）
      function setNativeValue(element, value) {
        try {
          const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
          const prototype = Object.getPrototypeOf(element);
          const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
          
          if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
            prototypeValueSetter.call(element, value);
          } else if (valueSetter) {
            valueSetter.call(element, value);
          } else {
            // 如果无法获取 setter，直接设置 value
            element.value = value;
          }
        } catch (e) {
          // 出错时直接设置 value
          console.log('[PDD监控] setNativeValue 出错，使用直接设置:', e.message);
          element.value = value;
        }
      }
      
      // 查找产品ID输入框 - 更精确的选择器
      const selectors = [
        'input[placeholder*="商品"]',
        'input[placeholder*="产品"]',
        'input[placeholder*="ID"]',
        'input[placeholder*="链接"]',
        'input[class*="goods"]',
        'input[class*="product"]',
        '[class*="goodsId"] input',
        '[class*="productId"] input',
        '[class*="GoodsId"] input',
        '[class*="ProductId"] input',
        '[class*="search"] input[type="text"]',
        '[class*="Search"] input[type="text"]',
        '[class*="input"] input[type="text"]',
        '[class*="Input"] input[type="text"]'
      ];
      
      for (const selector of selectors) {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          // 排除悬浮球面板内的输入框
          if (input.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel, #pdd-auto-fill-panel')) {
            continue;
          }
          
          if (!input.disabled && !input.readOnly) {  // ★ 修复：移除offsetParent限制
            const rect = input.getBoundingClientRect();
            if (rect.width > 50) {
              input.scrollIntoView({ behavior: 'instant', block: 'center' });
              
              setTimeout(() => {
                input.focus();
                input.value = '';
                setNativeValue(input, productId);
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new InputEvent('input', {
                  bubbles: true,
                  cancelable: true,
                  data: productId,
                  inputType: 'insertText'
                }));
                input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
                input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
                
                console.log('[PDD监控] 已填写产品ID到(已排除悬浮球面板):', selector, '实际值:', input.value);
              }, 200);
              return true;
            }
          }
        }
      }
      
      console.log('[PDD监控] 未找到产品ID输入框');
      return false;
    }
    
    // 检测发布页面并自动填写
    let publishObserver = null;
    
    function checkPublishPage() {
      // 检查是否有保存的商品信息需要恢复
      const savedGoodsStr = localStorage.getItem('__pdd_selected_goods');
      if (savedGoodsStr) {
        try {
          const savedGoods = JSON.parse(savedGoodsStr);
          // 检查是否在5分钟内（避免恢复过期的数据）
          if (Date.now() - savedGoods.timestamp < 5 * 60 * 1000) {
            console.log('[PDD监控] 检测到保存的商品信息，准备恢复:', savedGoods);
            // 注意：不要立即清除，等恢复成功后再清除
            
            // 等待页面元素加载完成后再恢复商品选择
            let retryCount = 0;
            const maxRetries = 15; // 最多重试15次（4.5秒）
            
            const waitForPageLoad = () => {
              retryCount++;
              const hasVideoList = document.querySelector('.video-list_itemWrap__7xLB4, [class*="video-list"]');
              const hasUploadButton = document.querySelector('.no-video_noVideoWrap__opXQS button') || 
                                      document.querySelector('[class*="upload"] button');
              const hasPublishContainer = document.querySelector('[class*="publish-video"], [class*="video-publish"], [class*="replay-manage"]');
              const hasPanel = document.getElementById('pdd-video-monitor');
              
              console.log(`[PDD监控] 等待页面元素加载... 尝试 ${retryCount}/${maxRetries}`);
              
              // 只要面板存在就尝试恢复（面板存在说明页面已初始化）
              if (hasPanel || hasVideoList || hasUploadButton || hasPublishContainer) {
                console.log('[PDD监控] 页面元素已加载，恢复商品选择');
                
                // 检查 __selectGoodsForPublish 是否存在
                if (typeof window.__selectGoodsForPublish === 'function') {
                  // 恢复成功，清除保存的信息
                  localStorage.removeItem('__pdd_selected_goods');
                  window.__selectGoodsForPublish(savedGoods.goods);
                } else {
                  console.log('[PDD监控] __selectGoodsForPublish 未定义，稍后重试');
                  if (retryCount < maxRetries) {
                    setTimeout(waitForPageLoad, 300);
                  } else {
                    console.log('[PDD监控] 等待 __selectGoodsForPublish 超时');
                  }
                }
              } else if (retryCount < maxRetries) {
                // 页面元素还没加载，继续等待
                setTimeout(waitForPageLoad, 300);
              } else {
                console.log('[PDD监控] 等待页面元素超时，放弃恢复');
              }
            };
            
            // 延迟 300ms 后开始检查页面元素
            setTimeout(waitForPageLoad, 300);
          } else {
            console.log('[PDD监控] 保存的商品信息已过期，清除');
            localStorage.removeItem('__pdd_selected_goods');
          }
        } catch (e) {
          console.error('[PDD监控] 恢复商品信息失败:', e);
          localStorage.removeItem('__pdd_selected_goods');
        }
      }
      
      const configStr = localStorage.getItem('__pdd_publish_config');
      if (!configStr) return;
      
      try {
        const config = JSON.parse(configStr);
        if (!config.enabled) return;
        
        // 检查是否在发布页面
        if (window.location.href.includes('n-creator/video/home') || 
            window.location.href.includes('creator/video')) {
          console.log('[PDD监控] 检测到发布页面，准备自动填写');
          
          // 创建发布辅助面板
          createPublishHelper(config);
          
          // 清理之前的监听器
          if (publishObserver) {
            publishObserver.disconnect();
          }
          if (publishInterval) {
            clearInterval(publishInterval);
          }
          
          // 只监听视频上传完成事件，不主动填写
          // 用户需要手动上传视频，脚本检测到视频上传完成后才填写商品ID
          startVideoUploadDetection(config);
        }
      } catch (e) {
        console.error('[PDD监控] 读取发布配置失败:', e);
      }
    }
    
    // 监听视频上传完成
    function startVideoUploadDetection(config) {
      const processedVideos = new Set();
      let filledCount = config.currentIndex || 0;
      
      console.log('[PDD监控] 开始监听视频上传，商品ID数量:', config.pidList.length);
      
      // 使用轻量级定时器代替 MutationObserver（减少性能开销）
      // publishObserver = new MutationObserver(() => {
      //   checkForNewVideos();
      // });
      
      // 不再使用 MutationObserver，改用定时器检查
      // const videoListContainer = document.querySelector('.video-list_itemWrap__7xLB4, [class*="video-list"]') || document.body;
      // if (videoListContainer) {
      //   publishObserver.observe(videoListContainer, { childList: true, subtree: true });
      //   activeResources.observers.push(publishObserver);
      // }
      
      // 定时检查（每5秒，降低频率）
      publishInterval = setInterval(() => {
        checkForNewVideos();
      }, 5000);
      activeResources.intervals.push(publishInterval);
      
      function checkForNewVideos() {
        // 查找所有视频项（已上传完成的视频）
        const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
        
        videoItems.forEach((item) => {
          // 生成唯一标识
          const fileNameEl = item.querySelector('.video-list_fileName___Diex p, [class*="fileName"]');
          const itemId = fileNameEl ? fileNameEl.textContent : item.innerHTML.substring(0, 100);
          
          if (processedVideos.has(itemId)) return;
          
          // 检查是否需要填写商品ID（查找"添加商品"按钮）
          // ★ 修复：不再要求按钮在可视区内，DOM存在即表示上传完成
          const addGoodsBtn = item.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');

          if (addGoodsBtn && filledCount < config.pidList.length) {
            // 确认按钮文字是"添加商品"类（不是已填充后的"更换/修改"）
            const btnText = (addGoodsBtn.textContent || '').trim();
            if (btnText.includes('更换') || btnText.includes('修改') || btnText.includes('编辑')) return; // 已填充过

            const goodsId = config.pidList[filledCount];
            console.log('[PDD监控] 检测到新视频上传完成，自动填写商品ID:', goodsId, '视频:', itemId);
            
            // 标记为已处理
            processedVideos.add(itemId);
            
            // 延迟填写，确保页面稳定
            setTimeout(async () => {
              // 填充描述（如果有配置）
              const desc = config.description || null;
              // ★ 填充内容声明（如果有配置）
              const decl = config.contentDeclaration || null;
              await fillGoodsIdForVideo(item, goodsId, desc, decl);
              filledCount++;
              
              // 更新配置
              config.currentIndex = filledCount;
              localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
              
              // 更新辅助面板状态
              const statusEl = document.getElementById('pdd-publish-status');
              if (statusEl) {
                statusEl.innerHTML = `
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="color:#27ae60;">✅ 已填写 ${filledCount}/${config.pidList.length} 个商品ID</span>
                    <span style="color:#666;">|</span>
                    <span style="color:#1565c0;">当前: ${goodsId}</span>
                  </div>
                `;
              }
              
              // 检查是否全部完成
              if (filledCount >= config.pidList.length) {
                if (publishObserver) publishObserver.disconnect();
                if (publishInterval) clearInterval(publishInterval);
                
                console.log('[PDD监控] 自动填写完成，共填写', filledCount, '个商品ID');
                
                // 更新状态
                if (statusEl) {
                  statusEl.innerHTML = `
                    <div style="background:#e8f5e9;padding:10px;border-radius:4px;">
                      <div style="color:#27ae60;font-weight:600;">✅ 全部完成！</div>
                      <div style="color:#333;font-size:11px;margin-top:4px;">
                        已填写 ${filledCount} 个商品ID<br>
                        请检查后点击"发布"按钮
                      </div>
                    </div>
                  `;
                }
              }
            }, 500);
          }
        });
      }
      
      // 10分钟后停止监听
      setTimeout(() => {
        if (publishObserver) publishObserver.disconnect();
        if (publishInterval) clearInterval(publishInterval);
        console.log('[PDD监控] 监听超时，停止监听');
      }, 10 * 60 * 1000);
    }
    
    // 为指定视频填写商品ID（返回Promise版本）
    async function fillGoodsIdForVideo(videoItem, goodsId, description = null, contentDeclaration = null) {
      console.log('[PDD监控] fillGoodsIdForVideo 开始，商品ID:', goodsId, '描述:', description ? description.substring(0, 30) + '...' : 'null', '内容声明:', contentDeclaration || 'null');
      
      // 添加重试机制
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const success = await fillGoodsIdForVideoOnce(videoItem, goodsId, description, contentDeclaration);
          if (success) {
            console.log('[PDD监控] 商品ID填充成功');
            return true;
          }
          retryCount++;
          console.log(`[PDD监控] 商品ID填充失败，重试 ${retryCount}/${maxRetries}`);
          await new Promise(r => setTimeout(r, 1500));
        } catch (e) {
          retryCount++;
          console.error(`[PDD监控] 商品ID填充出错，重试 ${retryCount}/${maxRetries}:`, e);
          await new Promise(r => setTimeout(r, 1500));
        }
      }
      
      console.log('[PDD监控] 商品ID填充失败，已达到最大重试次数');
      return false;
    }
    
    // 单次填充商品ID
    async function fillGoodsIdForVideoOnce(videoItem, goodsId, description = null, contentDeclaration = null) {
      return new Promise(async (resolve) => {
        // 滚动到视频项可见
        const rect = videoItem.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          videoItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 500));
        }
        
        // 点击视频项的非封面区域，避免打开视频预览
        let clickTarget = null;
        const nonCoverSelectors = [
          '.video-list_infoWrap__kVj5S',
          '[class*="infoWrap"]',
          '[class*="info-wrap"]',
          '[class*="videoInfo"]',
          '[class*="video-info"]',
          '[class*="meta"]',
          '[class*="details"]'
        ];
        
        for (const selector of nonCoverSelectors) {
          const el = videoItem.querySelector(selector);
          if (el) {  // ★ 修复：移除offsetParent限制，离屏元素也可以点击
            clickTarget = el;
            console.log('[PDD监控] 找到视频信息区域:', selector);
            break;
          }
        }
        
        if (!clickTarget) {
          clickTarget = videoItem;
          console.log('[PDD监控] 使用视频项本身作为点击目标');
        }
        
        // 点击视频项以选中它（不点击封面）
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: rect.left + 10,
          clientY: rect.top + rect.height / 2
        });
        clickTarget.dispatchEvent(clickEvent);
        
        // 等待描述输入框更新 - 增加等待时间
        await new Promise(r => setTimeout(r, 1500));
        
        // 先填充视频描述（如果有）- 在填充商品ID之前
        if (description) {
          console.log('[PDD监控] 开始填充视频描述...');
          await fillVideoDescription(description, videoItem);
          await new Promise(r => setTimeout(r, 600));
        }

        // 填充内容声明（如果有）- 在填充商品ID之前
        if (contentDeclaration) {
          console.log('[PDD监控] 开始填充内容声明:', contentDeclaration);
          await fillContentDeclaration(contentDeclaration, videoItem);
          await new Promise(r => setTimeout(r, 400));
        }

        // 使用多种选择器策略查找添加商品按钮
        let addGoodsBtn = null;
        
        // 方法1: 使用通用类名选择器（推荐）
        const addGoodsBtnSelectors = [
          '[class*="AddGoodsTrigger"]',
          '[class*="addGoodsTrigger"]',
          '[class*="add-goods-trigger"]',
          '[class*="addGoods"]',
          '[class*="add-goods"]',
          'button[class*="goods"]'
        ];
        
        for (const selector of addGoodsBtnSelectors) {
          const btn = videoItem.querySelector(selector);
          if (btn) {  // ★ 修复：移除offsetParent限制，离屏视频也需要填充
            addGoodsBtn = btn;
            console.log('[PDD监控] 找到添加商品按钮(方法1)，选择器:', selector);
            break;
          }
        }
        
        // 方法2: 遍历所有按钮查找文本匹配
        if (!addGoodsBtn) {
          const allBtns = videoItem.querySelectorAll('button, [role="button"], [class*="btn"], [class*="button"]');
          for (const btn of allBtns) {
            const text = (btn.textContent || '').trim();
            if ((text.includes('添加商品') || (text.includes('添加') && text.includes('商品'))) && 
                !text.includes('流量卡') && !text.includes('奖励') && 
                !text.includes('审核通过')) {
              // ★ 修复：移除offsetParent限制
              addGoodsBtn = btn;
              console.log('[PDD监控] 找到添加商品按钮(方法2-文本匹配):', text.substring(0, 20) + '...');
              break;
            }
          }
        }
        
        // 方法3: 查找带有特定图标或样式的按钮
        if (!addGoodsBtn) {
          const iconBtns = videoItem.querySelectorAll('[class*="plus"], [class*="add"], [class*="goods"]');
          for (const btn of iconBtns) {
            if (btn.tagName === 'BUTTON' || btn.getAttribute('role') === 'button') {  // ★ 修复：移除offsetParent限制
              addGoodsBtn = btn;
              console.log('[PDD监控] 找到添加商品按钮(方法3-图标匹配)');
              break;
            }
          }
        }
        
        if (addGoodsBtn) {
          const btnRect = addGoodsBtn.getBoundingClientRect();
          const isInViewport = btnRect.top >= 0 && btnRect.bottom <= window.innerHeight;
          if (!isInViewport) {
            addGoodsBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
            await new Promise(r => setTimeout(r, 300));  // 等待滚动完成
          }

          // ★★★ 关键修复：同步等待弹窗填充完成（原版setTimeout异步导致resolve时填充未完成） ★★★
          console.log('[PDD监控] 点击添加商品按钮');
          addGoodsBtn.click();

          try {
            // 等待弹窗出现
            await new Promise(r => setTimeout(r, 800));

            const fillSuccess = await fillGoodsIdInModal(goodsId);
            console.log('[PDD监控] fillGoodsIdForVideoOnce 弹窗填充结果:', fillSuccess);

            // 验证商品ID是否填充成功
            if (fillSuccess) {
              await new Promise(r => setTimeout(r, 800));
              const verified = await verifyGoodsIdFilled(videoItem, goodsId);
              resolve(verified);
            } else {
              resolve(false);
            }
          } catch(e) {
            console.error('[PDD监控] fillGoodsIdForVideoOnce 异常:', e.message);
            resolve(false);
          }
        } else {
          console.log('[PDD监控] 未找到添加商品按钮');
          resolve(false);
        }
      });
    }
    
    // 验证商品ID是否填充成功
    async function verifyGoodsIdFilled(videoItem, goodsId) {
      console.log('[PDD监控] 验证商品ID是否填充成功');
      
      // 等待一下让页面更新
      await new Promise(r => setTimeout(r, 500));
      
      // 查找商品相关元素
      const goodsSelectors = [
        '[class*="goods"]',
        '[class*="Goods"]',
        '[class*="product"]',
        '[class*="Product"]'
      ];
      
      for (const selector of goodsSelectors) {
        const elements = videoItem.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent || '';
          if (text.includes(goodsId) || text.includes('选择推广商品')) {
            console.log('[PDD监控] 验证成功：找到商品ID或商品信息');
            return true;
          }
        }
      }
      
      // 检查添加商品按钮是否还在（如果不在说明已添加）
      const addGoodsBtn = videoItem.querySelector('[class*="AddGoodsTrigger"], [class*="addGoods"]');
      // ★ 修复：不再用offsetParent判断，改用按钮文字判断
      if (!addGoodsBtn) {
        console.log('[PDD监控] 验证成功：添加商品按钮已消失');
        return true;
      }
      
      // 检查按钮文本是否变化
      const btnText = (addGoodsBtn.textContent || '').trim();
      if (!btnText.includes('添加') && btnText.length > 0) {
        console.log('[PDD监控] 验证成功：按钮文本已变化:', btnText);
        return true;
      }
      
      console.log('[PDD监控] 验证失败：商品ID可能未填充');
      return false;
    }
    
    // 检测并关闭干扰弹窗（如礼物收益弹窗）
    function closeInterferenceModal() {
      console.log('[PDD监控] 检测是否有干扰弹窗');
      
      // 查找可能的弹窗容器 - 使用通用选择器
      const modalSelectors = [
        '[class*="MDL_"]',
        '[class*="modal"]',
        '[class*="Modal"]',
        '[class*="dialog"]',
        '[class*="Dialog"]',
        '[class*="popup"]',
        '[class*="Popup"]',
        '[role="dialog"]',
        '.ant-modal-content',
        '.ant-modal'
      ];
      
      for (const selector of modalSelectors) {
        const modals = document.querySelectorAll(selector);
        for (const modal of modals) {
          if (modal && modal.offsetParent !== null) {
            const modalText = modal.textContent || '';
            // 检测礼物收益弹窗特征
            if (modalText.includes('礼物收益') || 
                modalText.includes('拼多多商家版APP') || 
                modalText.includes('多多直播') ||
                modalText.includes('我知道了')) {
              console.log('[PDD监控] 检测到干扰弹窗（礼物收益），尝试关闭');
              
              // 尝试点击"我知道了"按钮
              const knowBtn = modal.querySelector('button, [class*="btn"], [class*="button"]');
              if (knowBtn) {
                const btnText = knowBtn.textContent || '';
                if (btnText.includes('我知道了') || btnText.includes('确定') || btnText.includes('关闭')) {
                  console.log('[PDD监控] 点击关闭按钮:', btnText);
                  knowBtn.click();
                  return true;
                }
              }
              
              // 尝试查找所有按钮
              const allBtns = modal.querySelectorAll('button, [role="button"], [class*="btn"]');
              for (const btn of allBtns) {
                const text = btn.textContent || '';
                if (text.includes('我知道了') || text.includes('确定') || text.includes('关闭')) {
                  console.log('[PDD监控] 找到关闭按钮:', text);
                  btn.click();
                  return true;
                }
              }
              
              // 尝试按ESC键关闭
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
              return true;
            }
          }
        }
      }
      return false;
    }
  
  // 在弹窗中填写商品ID（返回Promise版本）
    async function fillGoodsIdInModal(goodsId) {
      return new Promise((resolve) => {
        closeInterferenceModal();
        
        let attempts = 0;
        const maxAttempts = 25;
        let isResolved = false;
        
        const safeResolve = (success = true) => {
          if (!isResolved) {
            isResolved = true;
            resolve(success);
          }
        };
        
        const checkModal = setInterval(() => {
          attempts++;
          
          if (attempts % 5 === 0) {
            closeInterferenceModal();
          }
          
          const modalSelectors = [
            '[class*="MDL_"]',
            '[class*="modal"]',
            '[class*="Modal"]',
            '[class*="dialog"]',
            '[class*="Dialog"]',
            '[role="dialog"]',
            '.ant-modal-content',
            '.ant-modal'
          ];
          
          let modal = null;
          for (const selector of modalSelectors) {
            const found = document.querySelector(selector);
            if (found) {  // ★ 修复：移除offsetParent限制（弹窗可能在动画中offsetParent为null）
              modal = found;
              break;
            }
          }

          if (modal) {  // ★ 修复：移除offsetParent限制
            const modalText = modal.textContent || '';
            if (modalText.includes('礼物收益') || modalText.includes('拼多多商家版APP')) {
              closeInterferenceModal();
              return;
            }
            
            clearInterval(checkModal);
            const idx = activeResources.intervals.indexOf(checkModal);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            
            switchToGoodsIdTab(modal);
            
            setTimeout(() => {
              const inputSelectors = [
                '[class*="IPT_input"]',
                '[class*="input"]',
                'input[placeholder*="商品id"]',
                'input[placeholder*="商品ID"]',
                'input[type="text"]:not([readonly])',
                'input:not([type="hidden"]):not([readonly])'
              ];
              
              let inputFound = false;
              for (const selector of inputSelectors) {
                const inputs = modal.querySelectorAll(selector);
                
                for (const input of inputs) {
                  if (input && !input.disabled) {  // ★ 修复：移除offsetParent限制（弹窗内输入框可能需要滚动）
                    input.scrollIntoView({ behavior: 'instant', block: 'center' });
                    
                    setTimeout(() => {
                      input.focus();
                      setNativeValue(input, goodsId);
                      inputFound = true;
                      
                      setTimeout(() => {
                        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                        
                        setTimeout(() => {
                          const clicked = clickNextButtonInModal(modal);
                          setTimeout(() => safeResolve(clicked), 500);
                        }, 1000);
                      }, 300);
                    }, 100);
                    
                    break;
                  }
                }
                if (inputFound) break;
              }
              
              if (!inputFound) {
                safeResolve(false);
              }
            }, 300);
          }
          
          if (attempts >= maxAttempts) {
            clearInterval(checkModal);
            const idx = activeResources.intervals.indexOf(checkModal);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            
            const allInputs = document.querySelectorAll('input[type="text"]:not([readonly])');
            for (const input of allInputs) {
              if (!input.disabled) {  // ★ 修复：移除offsetParent限制（备用方案也需要工作）
                const placeholder = input.placeholder || '';
                if (placeholder.includes('商品') || placeholder.includes('ID')) {
                  setNativeValue(input, goodsId);
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  break;
                }
              }
            }
            safeResolve(false);
          }
        }, 400);
        
        activeResources.intervals.push(checkModal);
      });
    }
    
    // 切换到"商品ID"标签页
    function switchToGoodsIdTab(modal) {
      console.log('[PDD监控] 尝试切换到商品ID标签页');
      
      // 尝试多种标签选择器 - 使用通用选择器
      const tabSelectors = [
        // 通过文本内容查找标签
        { selector: '[class*="tab"], [role="tab"]', text: '商品ID' },
        { selector: '[class*="tab"], [role="tab"]', text: 'ID' },
        // 通过类名查找 - 使用通用选择器
        '[class*="TBS_tab"]',
        '[class*="Tabs_tab"]',
        '[class*="tab-item"]',
        '[class*="tabItem"]'
      ];
      
      for (const tabSelector of tabSelectors) {
        if (typeof tabSelector === 'object') {
          // 通过文本查找
          const tabs = modal.querySelectorAll(tabSelector.selector);
          for (const tab of tabs) {
            const text = (tab.textContent || '').trim();
            if (text.includes(tabSelector.text)) {
              console.log('[PDD监控] 找到商品ID标签，点击:', text);
              tab.click();
              return true;
            }
          }
        } else {
          // 直接通过选择器查找
          const tabs = modal.querySelectorAll(tabSelector);
          for (const tab of tabs) {
            const text = (tab.textContent || '').trim();
            if (text.includes('商品ID') || text.includes('ID')) {
              console.log('[PDD监控] 找到商品ID标签，点击:', text);
              tab.click();
              return true;
            }
          }
        }
      }
      
      console.log('[PDD监控] 未找到商品ID标签页，可能已经在正确页面');
      return false;
    }
    
    // 点击弹窗中的下一步按钮
    function clickNextButtonInModal(modal) {
      console.log('[PDD监控] clickNextButtonInModal 开始');
      
      const nextBtnSelectors = [
        'button[data-testid="beast-core-modal-ok-button"]',
        '.MDL_okBtn_5-180-0',
        'button[class*="ok"]',
        'button[class*="primary"]',
        'button[class*="confirm"]',
        'button[class*="submit"]',
        'button[class*="next"]',
        'button.ant-btn-primary',
        '.ant-modal-confirm-btns button.ant-btn-primary',
        'button[type="submit"]'
      ];
      
      for (const selector of nextBtnSelectors) {
        const btns = modal.querySelectorAll(selector);
        console.log('[PDD监控] 选择器:', selector, '找到', btns.length, '个按钮');
        
        for (const btn of btns) {
          if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
            console.log('[PDD监控] 找到可点击按钮:', btn.textContent || btn.className);
            console.log('[PDD监控] 点击下一步按钮');
            btn.click();
            return true;
          }
        }
      }

      // 如果没找到，尝试查找所有按钮
      console.log('[PDD监控] 未找到特定按钮，查找所有按钮');
      const allBtns = modal.querySelectorAll('button');
      for (const btn of allBtns) {
        if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
          const text = (btn.textContent || '').trim();
          if (text.includes('确定') || text.includes('确认') || text.includes('下一步') || text.includes('提交')) {
            console.log('[PDD监控] 找到按钮（通过文本）:', text);
            btn.click();
            return true;
          }
        }
      }
      
      console.log('[PDD监控] 未找到可点击的下一步按钮');
      return false;
    }
    
    // 创建发布辅助面板
    function createPublishHelper(config) {
      // 检查是否已存在
      if (document.getElementById('pdd-publish-helper')) return;
      
      const helper = document.createElement('div');
      helper.id = 'pdd-publish-helper';
      helper.innerHTML = `
        <div style="position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#ff9800 0%,#ff5722 100%);color:white;padding:15px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-size:12px;max-width:320px;">
          <div style="font-weight:600;margin-bottom:10px;font-size:14px;">📹 批量发布辅助</div>
          <div style="background:rgba(255,255,255,0.15);padding:8px;border-radius:4px;margin-bottom:10px;">
            <div style="margin-bottom:6px;">当前产品ID: <span id="pdd-current-pid" style="font-weight:600;font-size:13px;">${config.pidList[config.currentIndex] || '无'}</span></div>
            <div style="margin-bottom:6px;">进度: <span id="pdd-publish-progress">${config.currentIndex + 1}</span> / ${config.pidList.length}</div>
            <div>视频: <span id="pdd-video-count">${config.videoFiles ? config.videoFiles.length : 0}</span> 个已保存</div>
          </div>
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;margin-bottom:4px;">操作步骤:</div>
            <ol style="margin:0;padding-left:16px;font-size:10px;line-height:1.6;">
              <li>输入产品ID和视频描述</li>
              <li>点击"开始上传"按钮</li>
              <li>选择视频文件夹</li>
              <li>系统自动上传视频</li>
            </ol>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;">
            <button id="pdd-upload-btn" style="flex:1;padding:8px;background:rgba(255,255,255,0.25);border:none;border-radius:4px;color:white;cursor:pointer;font-weight:600;">📤 上传视频</button>
            <button id="pdd-next-product" style="flex:1;padding:8px;background:rgba(255,255,255,0.25);border:none;border-radius:4px;color:white;cursor:pointer;">下一个</button>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;">
            <button id="pdd-copy-pid" style="flex:1;padding:6px;background:rgba(255,255,255,0.15);border:none;border-radius:4px;color:white;cursor:pointer;font-size:11px;">📋 复制ID</button>
            <button id="pdd-stop-helper" style="flex:1;padding:6px;background:rgba(255,255,255,0.15);border:none;border-radius:4px;color:white;cursor:pointer;font-size:11px;">停止</button>
          </div>
        </div>
      `;
      document.body.appendChild(helper);
      
      // 上传视频按钮 - 跳转到视频发布页面
      document.getElementById('pdd-upload-btn').onclick = () => {
        const videoPublishUrl = 'https://live.pinduoduo.com/n-creator/video/home';
        console.log('[PDD监控] 跳转到视频发布页面:', videoPublishUrl);
        window.location.href = videoPublishUrl;
      };
      
      // 下一个按钮
      document.getElementById('pdd-next-product').onclick = () => {
        if (config.currentIndex < config.pidList.length - 1) {
          config.currentIndex++;
          localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
          document.getElementById('pdd-current-pid').textContent = config.pidList[config.currentIndex];
          document.getElementById('pdd-publish-progress').textContent = config.currentIndex + 1;
          autoFillProductId(config.pidList[config.currentIndex]);
        } else {
          alert('✅ 已完成所有产品ID的发布！\n\n共发布 ' + config.pidList.length + ' 个视频');
          config.enabled = false;
          localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
          helper.remove();
        }
      };
      
      // 复制产品ID按钮
      document.getElementById('pdd-copy-pid').onclick = () => {
        const pid = config.pidList[config.currentIndex];
        if (pid) {
          navigator.clipboard.writeText(pid).then(() => {
            alert('产品ID已复制: ' + pid);
          }).catch(() => {
            // 备用复制方法
            const input = document.createElement('input');
            input.value = pid;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            alert('产品ID已复制: ' + pid);
          });
        }
      };
      
      // 停止按钮
      document.getElementById('pdd-stop-helper').onclick = () => {
        config.enabled = false;
        localStorage.setItem('__pdd_publish_config', JSON.stringify(config));
        helper.remove();
        alert('批量发布辅助已停止');
      };
      
      // 监听文件选择，自动填写产品ID
      const fileInputs = document.querySelectorAll('input[type="file"]');
      fileInputs.forEach(input => {
        input.addEventListener('change', () => {
          console.log('[PDD监控] 检测到文件选择，自动填写产品ID');
          setTimeout(() => {
            autoFillProductId(config.pidList[config.currentIndex]);
          }, 500);
        });
      });
    }
    
    // 页面加载后检查发布页面
    setTimeout(checkPublishPage, 1000);
    
    document.getElementById('pdd-sync-preview-close').onclick = closeSyncPreview;
    document.getElementById('btn-cancel-sync').onclick = closeSyncPreview;
    document.getElementById('btn-confirm-sync').onclick = function() {
      const videosToSync = [...pendingSyncVideos];
      closeSyncPreview();
      executeSync(videosToSync);
    };
    
    document.getElementById('pdd-preview-close').onclick = closePreview;
    document.getElementById('pdd-preview-modal').onclick = function(e) {
      if (e.target === this) {
        closePreview();
      }
    };
    
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeSettings();
        closePreview();
      }
    });
    
    // 添加面板拖动功能
    function makeDraggable(element) {
      const header = document.getElementById('pdd-panel-header');
      let isDragging = false;
      let startX, startY, startLeft, startTop;

      header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        element.style.right = 'auto';
        element.style.left = startLeft + 'px';
        element.style.top = startTop + 'px';
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        element.style.left = (startLeft + dx) + 'px';
        element.style.top = (startTop + dy) + 'px';
      });

      document.addEventListener('mouseup', () => {
        isDragging = false;
      });
    }

    // 添加面板调整大小功能
    function makeResizable(element) {
      const resizeHandle = document.getElementById('pdd-resize-handle');
      if (!resizeHandle) return;

      let isResizing = false;
      let startX, startY, startWidth, startHeight;

      // 读取保存的大小
      const savedSize = localStorage.getItem('pdd-panel-size');
      if (savedSize) {
        try {
          const size = JSON.parse(savedSize);
          if (size.width) element.style.width = size.width + 'px';
          if (size.height) element.style.height = size.height + 'px';
        } catch (e) {
          console.log('[PDD监控] 读取面板大小失败:', e);
        }
      }

      resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        startWidth = rect.width;
        startHeight = rect.height;
        e.preventDefault();
        e.stopPropagation();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newWidth = startWidth + dx;
        let newHeight = startHeight + dy;

        // 应用最小和最大限制
        const minWidth = 360;
        const minHeight = 300;
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.9;

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        element.style.width = newWidth + 'px';
        element.style.height = newHeight + 'px';
      });

      document.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          // 保存大小到 localStorage
          const rect = element.getBoundingClientRect();
          localStorage.setItem('pdd-panel-size', JSON.stringify({
            width: rect.width,
            height: rect.height
          }));
        }
      });
    }

    // 对面板启用拖动和调整大小（已禁用，使用固定侧边栏）
    // makeDraggable(panel);
    // makeResizable(panel);
    
    loadHistoryAndShow();
  }
  
  function loadHistoryAndShow() {
    chrome.storage.local.get(['videoHistory'], (result) => {
      historyData = result.videoHistory || {};
      console.log('[PDD监控] 已加载本地历史数据, 视频数:', Object.keys(historyData).length);
      
      // 尝试获取账号ID（如果还没有）
      if (!currentAccountId) {
        currentAccountId = getCurrentAccountId();
        if (currentAccountId) {
          console.log('[PDD监控] 加载数据时获取到店铺名称:', currentAccountId);
          // 通知background设置账号ID
          chrome.runtime.sendMessage({
            action: 'setAccountId',
            accountId: currentAccountId
          });
        }
      }
      
      // 尝试从本地存储加载跨浏览器数据
      if (currentAccountId) {
        chrome.runtime.sendMessage({ action: 'loadFromNative' }, (response) => {
          if (response && response.success && response.hasData) {
            console.log('[PDD监控] 已从本地存储加载跨浏览器数据, 视频数:', response.count);
            // 重新从 storage 读取合并后的数据
            chrome.storage.local.get(['videoHistory'], (newResult) => {
              historyData = newResult.videoHistory || {};
              updatePanel();
            });
          } else {
            updatePanel();
          }
        });
      } else {
        console.log('[PDD监控] 警告: 无法获取店铺名称，无法加载跨浏览器数据');
        updatePanel();
      }
    });
  }
  
  function loadConfig() {
    chrome.storage.local.get(['pddConfig'], (result) => {
      if (result.pddConfig) {
        config = { ...config, ...result.pddConfig };
      }
      applyConfig();
      // 确保面板尺寸在配置加载后立即应用
      setTimeout(() => applyPanelSize(), 100);
    });
  }
  
  function applyConfig() {
    const apiUrlInput = document.getElementById('setting-api-url');
    const editorIdInput = document.getElementById('setting-editor-id');
    const minPlaysInput = document.getElementById('setting-min-plays');
    const minOrdersInput = document.getElementById('setting-min-orders');
    const syncIntervalInput = document.getElementById('setting-sync-interval');
    const panelWidthInput = document.getElementById('setting-panel-width');
    const panelHeightInput = document.getElementById('setting-panel-height');
    
    if (apiUrlInput) apiUrlInput.value = config.apiUrl;
    if (editorIdInput) editorIdInput.value = config.editorId;
    if (minPlaysInput) minPlaysInput.value = config.minPlays;
    if (minOrdersInput) minOrdersInput.value = config.minOrders;
    if (syncIntervalInput) syncIntervalInput.value = config.syncInterval || 50;
    if (panelWidthInput) panelWidthInput.value = config.panelWidth || 480;
    if (panelHeightInput) panelHeightInput.value = config.panelHeight || 85;
    
    // 应用面板尺寸
    applyPanelSize();
  }
  
  function applyPanelSize() {
    const panel = document.getElementById('pdd-video-monitor');
    if (panel) {
      const width = config.panelWidth || 480;
      const height = config.panelHeight || 85;
      panel.style.width = width + 'px';
      panel.style.height = height + 'vh';
      panel.style.maxHeight = height + 'vh';
    }
  }
  
  // 显示设置视图（内嵌）
  function showSettingsView() {
    applyConfig();
    const dataView = document.getElementById('pdd-data-view');
    const uploadView = document.getElementById('pdd-upload-view');
    const settingsView = document.getElementById('pdd-settings-view');
    const panelTitle = document.getElementById('pdd-panel-title');
    const pageTypeIndicator = document.getElementById('pdd-page-type');
    const navDataPageBtn = document.getElementById('pdd-nav-data-page');
    const navAutoUploadBtn = document.getElementById('pdd-nav-auto-upload');
    
    if (dataView) dataView.style.display = 'none';
    if (uploadView) uploadView.style.display = 'none';
    if (settingsView) settingsView.style.display = 'block';
    if (panelTitle) panelTitle.textContent = '⚙️ 系统设置';
    if (pageTypeIndicator) pageTypeIndicator.textContent = '⚙️ 设置页面';
    
    // 移除导航按钮的激活状态
    if (navDataPageBtn) navDataPageBtn.classList.remove('active');
    if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
    
    console.log('[PDD监控] 显示设置页面');
  }
  
  // 隐藏设置视图，返回数据监控视图
  function hideSettingsView() {
    const dataView = document.getElementById('pdd-data-view');
    const uploadView = document.getElementById('pdd-upload-view');
    const settingsView = document.getElementById('pdd-settings-view');
    const panelTitle = document.getElementById('pdd-panel-title');
    const pageTypeIndicator = document.getElementById('pdd-page-type');
    const navDataPageBtn = document.getElementById('pdd-nav-data-page');
    const navAutoUploadBtn = document.getElementById('pdd-nav-auto-upload');

    if (settingsView) settingsView.style.display = 'none';

    // currentView 可能在不同作用域，安全读取
    const view = (typeof currentView !== 'undefined') ? currentView : 'data';

    // 根据当前视图状态决定显示哪个页面
    if (view === 'upload') {
      if (uploadView) uploadView.style.display = 'block';
      if (panelTitle) panelTitle.textContent = '📹 视频批量上传';
      if (pageTypeIndicator) pageTypeIndicator.textContent = '📹 视频发布页面';
      if (navAutoUploadBtn) navAutoUploadBtn.classList.add('active');
      if (navDataPageBtn) navDataPageBtn.classList.remove('active');
    } else {
      if (dataView) dataView.style.display = 'block';
      if (panelTitle) panelTitle.textContent = '📊 视频数据监控';
      if (pageTypeIndicator) pageTypeIndicator.textContent = '📊 视频数据监控页面';
      if (navDataPageBtn) navDataPageBtn.classList.add('active');
      if (navAutoUploadBtn) navAutoUploadBtn.classList.remove('active');
    }
    
    console.log('[PDD监控] 隐藏设置页面');
  }
  
  function openSettings() {
    showSettingsView();
  }
  
  function closeSettings() {
    hideSettingsView();
  }
  
  function saveConfig() {
    config.apiUrl = document.getElementById('setting-api-url').value || 'http://localhost:3000/api';
    config.editorId = parseInt(document.getElementById('setting-editor-id').value) || 24;
    config.minPlays = parseInt(document.getElementById('setting-min-plays').value) || 200;
    config.minOrders = parseInt(document.getElementById('setting-min-orders').value) || 1;
    config.syncInterval = parseInt(document.getElementById('setting-sync-interval').value) || 50;
    config.panelWidth = parseInt(document.getElementById('setting-panel-width').value) || 480;
    config.panelHeight = parseInt(document.getElementById('setting-panel-height').value) || 85;
    
    // 应用面板尺寸
    applyPanelSize();
    
    chrome.storage.local.set({ pddConfig: config }, () => {
      console.log('[PDD监控] 配置已保存:', config);
      showNotification('设置已保存', 'success');
    });
  }
  
  function showNotification(message, type = 'info') {
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.svg',
        title: '拼多多视频监控',
        message: message
      });
    }
  }
  
  let pendingSyncVideos = [];
  
  async function showSyncPreview() {
    const selectedVideos = getSelectedVideos();
    
    if (selectedVideos.length === 0) {
      updateSyncStatus('error', '❌ 请先勾选要同步的视频');
      return;
    }

    // 先检查服务器是否可连接
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const healthCheck = await fetch(`${config.apiUrl || API_BASE_URL}/history`, {
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (!healthCheck) {
        // 服务器不可用，静默处理
        return;
      }
    } catch (e) {
      // 服务器连接失败，静默处理
      return;
    }

    const filteredVideos = selectedVideos.filter(video =>
      (video.playCount > config.minPlays || video.orderCount > config.minOrders) && !syncingVideoIds.has(video.feedId)
    );
    
    if (filteredVideos.length === 0) {
      updateSyncStatus('error', `❌ 没有符合条件的视频（播放量>${config.minPlays}或订单>${config.minOrders}）`);
      return;
    }
    
    document.getElementById('sync-preview-total').textContent = '...';
    document.getElementById('sync-preview-new').textContent = '...';
    document.getElementById('sync-preview-update').textContent = '...';
    document.getElementById('sync-preview-skip').textContent = '...';
    document.getElementById('sync-preview-list').innerHTML = '<div style="padding:20px;text-align:center;color:#666;">正在检查视频状态...</div>';
    document.getElementById('pdd-sync-preview-modal').classList.add('show');
    
    let newCount = 0;
    let updateCount = 0;
    let skipCount = selectedVideos.length - filteredVideos.length;
    let skipSameViews = 0;
    
    const videosToSync = [];
    let listHtml = '';
    
    for (const video of filteredVideos) {
      const videoIdStr = video.feedId;
      let status = 'new';
      
      try {
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const checkResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/by-videoid/${videoIdStr}`, {
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        
        if (checkResponse && checkResponse.ok) {
          const checkData = await checkResponse.json();
          
          if (checkData.found && checkData.video) {
            const existingVideo = checkData.video;
            
            // 检查审核状态
            if (existingVideo.auditStatus === 'failed' || existingVideo.status === 'rejected') {
              skipSameViews++;
              listHtml += `
                <div class="sync-preview-item" style="opacity:0.6;">
                  <span class="video-id">${escapeHtml(video.feedId)}</span>
                  <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
                  <span class="status-skip">跳过(审核失败)</span>
                </div>
              `;
              console.log('[PDD监控] 跳过审核失败的视频:', video.feedId);
              continue;
            }
            
            if (existingVideo.views === video.playCount) {
              skipSameViews++;
              listHtml += `
                <div class="sync-preview-item" style="opacity:0.6;">
                  <span class="video-id">${escapeHtml(video.feedId)}</span>
                  <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
                  <span class="status-skip">跳过(一致)</span>
                </div>
              `;
              continue;
            }
            
            status = 'update';
            video._exists = true;
            video._existingData = existingVideo;
          }
        }
      } catch (e) {
        console.log('[PDD监控] 检查视频状态失败（服务器未响应）:', video.feedId);
        // 服务器未响应时，默认为新视频
      }
      
      if (status === 'new') newCount++;
      else updateCount++;
      
      videosToSync.push(video);
      
      listHtml += `
        <div class="sync-preview-item">
          <span class="video-id">${escapeHtml(video.feedId)}</span>
          <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
          <span class="status-${status}">${status === 'new' ? '新建' : '更新'}</span>
        </div>
      `;
    }
    
    pendingSyncVideos = videosToSync;
    
    document.getElementById('sync-preview-total').textContent = videosToSync.length;
    document.getElementById('sync-preview-new').textContent = newCount;
    document.getElementById('sync-preview-update').textContent = updateCount;
    document.getElementById('sync-preview-skip').textContent = skipCount + skipSameViews;
    document.getElementById('sync-preview-list').innerHTML = listHtml;
  }
  
  function closeSyncPreview() {
    document.getElementById('pdd-sync-preview-modal').classList.remove('show');
    pendingSyncVideos = [];
  }
  
  function executeSync(videosToSync) {
    if (!videosToSync || videosToSync.length === 0) return;
    
    // 获取品牌字段
    const brandInput = document.getElementById('sync-brand-input');
    const brandValue = brandInput ? brandInput.value.trim() : '';
    
    // 获取产品名称字段
    const productInput = document.getElementById('sync-product-input');
    const productValue = productInput ? productInput.value.trim() : '';
    
    // 获取剪辑师ID
    const editorIdInput = document.getElementById('sync-editor-id-input');
    const editorIdValue = editorIdInput ? parseInt(editorIdInput.value) || null : null;
    
    const skippedCount = syncProgress.skipped || 0;
    
    isSyncing = true;
    syncProgress = { 
      current: 0, 
      total: videosToSync.length, 
      created: 0, 
      updated: 0, 
      skipped: skippedCount, 
      failed: 0, 
      createdIds: [], 
      updatedIds: [], 
      failedIds: [] 
    };
    
    videosToSync.forEach(video => syncingVideoIds.add(video.feedId));
    
    const syncBtn = document.getElementById('pdd-sync');
    syncBtn.classList.add('syncing');
    
    updateSyncStatus('syncing', `🔄 开始同步 ${videosToSync.length} 个视频...`);
    updateSyncProgress();
    
    console.log('[PDD监控] 开始同步播放量到网站，共', videosToSync.length, '个视频，品牌:', brandValue);
    
    (async () => {
      try {
        for (let i = 0; i < videosToSync.length; i++) {
          const video = videosToSync[i];
          syncProgress.current = i + 1;
          
          updateSyncProgress();
          
          try {
            await syncSingleVideo(video, brandValue, productValue, editorIdValue);
          } catch (error) {
            console.error('[PDD监控] 同步视频失败:', video.feedId, error);
            syncProgress.failed++;
            syncProgress.failedIds.push(video.feedId);
          }
          
          if (i < videosToSync.length - 1) {
            await new Promise(resolve => setTimeout(resolve, config.syncInterval || 50));
          }
        }
      } finally {
        videosToSync.forEach(video => syncingVideoIds.delete(video.feedId));
      }
      
      isSyncing = false;
      syncBtn.classList.remove('syncing');
      
      let resultMsg = `✅ 同步完成！\n创建: ${syncProgress.created}\n更新: ${syncProgress.updated}\n跳过: ${syncProgress.skipped}\n失败: ${syncProgress.failed}`;
      if (syncProgress.createdIds.length > 0) {
        resultMsg += `\n创建ID: ${syncProgress.createdIds.join(', ')}`;
      }
      if (syncProgress.updatedIds.length > 0) {
        resultMsg += `\n更新ID: ${syncProgress.updatedIds.join(', ')}`;
      }
      if (syncProgress.failedIds.length > 0) {
        resultMsg += `\n失败ID: ${syncProgress.failedIds.join(', ')}`;
      }
      
      saveSyncHistory(syncProgress);
      showSyncNotification(syncProgress);
      updateSyncStatus(syncProgress.failed > 0 ? 'error' : 'success', resultMsg);
      console.log('[PDD监控]', resultMsg);
      
      pendingSyncVideos = [];
      
      // 检查队列中是否有待处理的请求
      if (syncQueue.length > 0) {
        const nextRequest = syncQueue.shift();
        console.log('[PDD监控] 处理队列中的下一个同步请求，剩余队列长度:', syncQueue.length);
        updateSyncStatus('info', `⏳ 准备处理队列中的下一个请求（剩余: ${syncQueue.length} 个）...`);
        
        // 延迟1秒后处理下一个请求
        setTimeout(() => {
          // 将队列中的视频设置为选中状态并显示预览
          pendingSyncVideos = nextRequest.videos;
          showSyncPreviewWithVideos(nextRequest.videos);
        }, 1000);
      }
    })();
  }
  
  // 使用指定视频显示同步预览
  async function showSyncPreviewWithVideos(selectedVideos) {
    if (selectedVideos.length === 0) {
      updateSyncStatus('error', '❌ 没有要同步的视频');
      return;
    }

    // 先检查服务器是否可连接
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const healthCheck = await fetch(`${config.apiUrl || API_BASE_URL}/history`, {
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (!healthCheck) {
        // 服务器不可用，静默处理
        return;
      }
    } catch (e) {
      // 服务器连接失败，静默处理
      return;
    }

    const filteredVideos = selectedVideos.filter(video =>
      (video.playCount > config.minPlays || video.orderCount > config.minOrders) && !syncingVideoIds.has(video.feedId)
    );
    
    if (filteredVideos.length === 0) {
      updateSyncStatus('error', `❌ 没有符合条件的视频`);
      return;
    }
    
    document.getElementById('sync-preview-total').textContent = '...';
    document.getElementById('sync-preview-new').textContent = '...';
    document.getElementById('sync-preview-update').textContent = '...';
    document.getElementById('sync-preview-skip').textContent = '...';
    document.getElementById('sync-preview-list').innerHTML = '<div style="padding:20px;text-align:center;color:#666;">正在检查视频状态...</div>';
    document.getElementById('pdd-sync-preview-modal').classList.add('show');
    
    let newCount = 0;
    let updateCount = 0;
    let skipCount = selectedVideos.length - filteredVideos.length;
    let skipSameViews = 0;
    
    const videosToSync = [];
    let listHtml = '';
    
    for (const video of filteredVideos) {
      const videoIdStr = video.feedId;
      let status = 'new';
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const checkResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/by-videoid/${videoIdStr}`, {
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        
        if (checkResponse && checkResponse.ok) {
          const checkData = await checkResponse.json();
          
          if (checkData.found && checkData.video) {
            const existingVideo = checkData.video;
            
            if (existingVideo.auditStatus === 'failed' || existingVideo.status === 'rejected') {
              skipSameViews++;
              listHtml += `
                <div class="sync-preview-item" style="opacity:0.6;">
                  <span class="video-id">${escapeHtml(video.feedId)}</span>
                  <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
                  <span class="status-skip">跳过(审核失败)</span>
                </div>
              `;
              continue;
            }
            
            if (existingVideo.views === video.playCount) {
              skipSameViews++;
              listHtml += `
                <div class="sync-preview-item" style="opacity:0.6;">
                  <span class="video-id">${escapeHtml(video.feedId)}</span>
                  <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
                  <span class="status-skip">跳过(一致)</span>
                </div>
              `;
              continue;
            }
            
            status = 'update';
            video._exists = true;
            video._existingData = existingVideo;
          }
        }
      } catch (e) {
        console.log('[PDD监控] 检查视频状态失败:', video.feedId);
      }
      
      if (status === 'new') newCount++;
      else updateCount++;
      
      videosToSync.push(video);
      
      listHtml += `
        <div class="sync-preview-item">
          <span class="video-id">${escapeHtml(video.feedId)}</span>
          <span>▶️${formatNumber(video.playCount)} 🛒${video.orderCount}</span>
          <span class="status-${status}">${status === 'new' ? '新建' : '更新'}</span>
        </div>
      `;
    }
    
    pendingSyncVideos = videosToSync;
    
    document.getElementById('sync-preview-total').textContent = videosToSync.length;
    document.getElementById('sync-preview-new').textContent = newCount;
    document.getElementById('sync-preview-update').textContent = updateCount;
    document.getElementById('sync-preview-skip').textContent = skipCount + skipSameViews;
    document.getElementById('sync-preview-list').innerHTML = listHtml;
  }
  
  function updateSyncProgress() {
    const statusEl = document.getElementById('pdd-sync-status');
    if (!statusEl) return;
    
    const progress = syncProgress.current / syncProgress.total * 100;
    const queueInfo = syncQueue.length > 0 ? ` | 队列中: ${syncQueue.length} 个请求` : '';
    
    statusEl.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;">🔄 同步进度: ${syncProgress.current}/${syncProgress.total}${queueInfo}</div>
      <div class="sync-progress-bar">
        <div class="sync-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="sync-progress-text">
        已创建: ${syncProgress.created} | 已更新: ${syncProgress.updated} | 失败: ${syncProgress.failed}
      </div>
    `;
    statusEl.style.display = 'block';
    statusEl.className = 'syncing';
  }
  
  function openPreview(video) {
    const modal = document.getElementById('pdd-preview-modal');
    const videoEl = document.getElementById('pdd-preview-video');
    const infoEl = document.getElementById('pdd-preview-info');
    
    if (video.videoUrl) {
      videoEl.src = video.videoUrl;
      videoEl.play();
    } else if (video.coverUrl) {
      videoEl.poster = video.coverUrl;
    }
    
    infoEl.innerHTML = `
      <div>${escapeHtml(video.desc) || '无描述'}</div>
      <div style="margin-top:8px;">
        ▶️ ${formatNumber(video.playCount)} | 
        🛒 ${video.orderCount} | 
        💰 ¥${formatNumber(video.orderAmount)}
      </div>
    `;
    
    modal.classList.add('show');
  }
  
  // 显示视频详情
  window.showVideoDetail = function(feedId) {
    const video = allVideos.find(v => v.feedId === feedId);
    if (!video) return;
    
    const modal = document.getElementById('pdd-preview-modal');
    const videoEl = document.getElementById('pdd-preview-video');
    const infoEl = document.getElementById('pdd-preview-info');
    
    if (video.videoUrl) {
      videoEl.src = video.videoUrl;
      videoEl.play();
    } else if (video.coverUrl) {
      videoEl.poster = video.coverUrl;
    }
    
    infoEl.innerHTML = `
      <div style="font-size:14px;font-weight:600;margin-bottom:12px;">${escapeHtml(video.desc) || '无描述'}</div>
      <div style="background:#f8f9fa;padding:12px;border-radius:8px;margin-bottom:12px;">
        <div style="font-size:12px;color:#666;margin-bottom:8px;">📊 详细数据</div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;font-size:12px;">
          <div>▶️ 播放量：<strong>${formatNumber(video.playCount)}</strong></div>
          <div>🛒 订单数：<strong>${video.orderCount}</strong></div>
          <div>💰 金额：<strong style="color:#ff9800;">¥${formatNumber(video.orderAmount)}</strong></div>
          <div>👍 点赞：<strong>${video.likes || 0}</strong></div>
        </div>
      </div>
      <div style="font-size:11px;color:#888;">
        <div>ID: ${escapeHtml(video.feedId)}</div>
        ${video.date ? `<div>日期：${escapeHtml(video.date)}</div>` : ''}
        ${video.coverUrl ? `<div style="margin-top:8px;"><img src="${escapeHtml(video.coverUrl)}" style="width:100px;height:100px;object-fit:cover;border-radius:6px;"></div>` : ''}
      </div>
    `;
    
    modal.classList.add('show');
  }
  
  function closePreview() {
    const modal = document.getElementById('pdd-preview-modal');
    const videoEl = document.getElementById('pdd-preview-video');
    
    videoEl.pause();
    videoEl.src = '';
    modal.classList.remove('show');
  }
  
  function updateDataComparison() {
    const comparisonEl = document.getElementById('pdd-comparison');
    const contentEl = document.getElementById('pdd-comparison-content');
    
    if (!comparisonEl || !contentEl) return;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    const todayVideos = allVideos.filter(v => v.date === today);
    const yesterdayVideos = allVideos.filter(v => v.date === yesterday);
    
    if (todayVideos.length === 0 && yesterdayVideos.length === 0) {
      comparisonEl.style.display = 'none';
      return;
    }
    
    const todayStats = {
      count: todayVideos.length,
      plays: todayVideos.reduce((sum, v) => sum + v.playCount, 0),
      orders: todayVideos.reduce((sum, v) => sum + v.orderCount, 0),
      amount: todayVideos.reduce((sum, v) => sum + v.orderAmount, 0)
    };
    
    const yesterdayStats = {
      count: yesterdayVideos.length,
      plays: yesterdayVideos.reduce((sum, v) => sum + v.playCount, 0),
      orders: yesterdayVideos.reduce((sum, v) => sum + v.orderCount, 0),
      amount: yesterdayVideos.reduce((sum, v) => sum + v.orderAmount, 0)
    };
    
    const playDiff = todayStats.plays - yesterdayStats.plays;
    const orderDiff = todayStats.orders - yesterdayStats.orders;
    const amountDiff = todayStats.amount - yesterdayStats.amount;
    
    contentEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div>
          <div style="color:#666;margin-bottom:4px;">今天 (${todayStats.count}个视频)</div>
          <div>▶️ ${formatNumber(todayStats.plays)}</div>
          <div>🛒 ${todayStats.orders}</div>
          <div>💰 ¥${formatNumber(todayStats.amount)}</div>
        </div>
        <div>
          <div style="color:#666;margin-bottom:4px;">昨天 (${yesterdayStats.count}个视频)</div>
          <div>▶️ ${formatNumber(yesterdayStats.plays)}</div>
          <div>🛒 ${yesterdayStats.orders}</div>
          <div>💰 ¥${formatNumber(yesterdayStats.amount)}</div>
        </div>
      </div>
      <div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(0,0,0,0.1);">
        <span style="color:#666;">对比昨天：</span>
        <span style="color:${playDiff >= 0 ? '#27ae60' : '#e74c3c'};">▶️ ${playDiff >= 0 ? '+' : ''}${formatNumber(playDiff)}</span>
        <span style="margin-left:8px;color:${orderDiff >= 0 ? '#27ae60' : '#e74c3c'};">🛒 ${orderDiff >= 0 ? '+' : ''}${orderDiff}</span>
        <span style="margin-left:8px;color:${amountDiff >= 0 ? '#27ae60' : '#e74c3c'};">💰 ${amountDiff >= 0 ? '+' : ''}¥${formatNumber(amountDiff)}</span>
      </div>
    `;
    
    comparisonEl.style.display = 'block';
  }
  
  // 视频列表事件委托标记
  let videoListEventBound = false;
  
  // 限制面板显示的视频数量
  const MAX_PANEL_VIDEOS = 100;
  
  // 防抖更新面板，减少 DOM 操作频率
  let updatePanelTimer = null;
  let lastUpdateTime = 0;
  const UPDATE_PANEL_THROTTLE = 500; // 最小更新间隔 500ms
  
  function updatePanel() {
    if (!panelAdded) return;
    
    // 节流：如果距离上次更新不到 500ms，延迟更新
    const now = Date.now();
    if (now - lastUpdateTime < UPDATE_PANEL_THROTTLE) {
      if (updatePanelTimer) clearTimeout(updatePanelTimer);
      updatePanelTimer = setTimeout(() => {
        doUpdatePanel();
      }, UPDATE_PANEL_THROTTLE - (now - lastUpdateTime));
      return;
    }
    
    doUpdatePanel();
  }
  
  function doUpdatePanel() {
    lastUpdateTime = Date.now();
    if (updatePanelTimer) {
      clearTimeout(updatePanelTimer);
      updatePanelTimer = null;
    }
    
    if (!panelAdded) return;
    
    // 检查面板是否可见，不可见时只更新悬浮球计数
    const panelEl = document.getElementById('pdd-video-monitor');
    const isPanelVisible = panelEl && panelEl.classList.contains('show');
    
    const ballCountEl = document.getElementById('ball-count');
    if (ballCountEl) {
      ballCountEl.textContent = allVideos.length;
      if (allVideos.length > 0) {
        ballCountEl.classList.add('show');
      }
    }
    
    // 面板不可见时，不更新DOM
    if (!isPanelVisible) return;
    
    const listEl = document.getElementById('pdd-video-list');
    const totalVideosEl = document.getElementById('total-videos');
    const totalPlaysEl = document.getElementById('total-plays');
    const totalOrdersEl = document.getElementById('total-orders');
    const totalAmountEl = document.getElementById('total-amount');
    const pageCountEl = document.getElementById('page-count');
    const totalCountEl = document.getElementById('total-count');
    const autoStatusEl = document.getElementById('auto-status');
    
    if (allVideos.length === 0) {
      if (listEl) {
        listEl.innerHTML = '<div class="no-data">暂无视频数据<br><small>点击 ⚡ 自动获取所有数据</small></div>';
      }
      if (totalVideosEl) totalVideosEl.textContent = '0';
      if (totalPlaysEl) totalPlaysEl.textContent = '0';
      if (totalOrdersEl) totalOrdersEl.textContent = '0';
      if (totalAmountEl) totalAmountEl.textContent = '¥0';
      if (pageCountEl) pageCountEl.textContent = '0';
      return;
    }
    
    let filteredVideos = filterVideos(allVideos);
    
    const displayCount = filteredVideos.length;
    const willBeLimited = displayCount > MAX_PANEL_VIDEOS;
    if (willBeLimited) {
      filteredVideos = filteredVideos.slice(0, MAX_PANEL_VIDEOS);
    }
    
    let totalPlays = 0;
    let totalOrders = 0;
    let totalAmount = 0;
    let totalPlayGrowth = 0;
    let totalOrderGrowth = 0;
    let totalAmountGrowth = 0;
    let hasGrowthData = false;
    
    let sortedVideos = [...filteredVideos];
    if (filterSettings.sortBy) {
      const [field, direction] = filterSettings.sortBy.split('-');
      sortedVideos.sort((a, b) => {
        let valueA = 0, valueB = 0;
        
        switch (field) {
          case 'amount':
            valueA = a.orderAmount || 0;
            valueB = b.orderAmount || 0;
            break;
          case 'orders':
            valueA = a.orderCount || 0;
            valueB = b.orderCount || 0;
            break;
          case 'plays':
            valueA = a.playCount || 0;
            valueB = b.playCount || 0;
            break;
        }
        
        return direction === 'desc' ? valueB - valueA : valueA - valueB;
      });
    }
    
    currentFilteredVideos = sortedVideos;
    
    // 使用 DocumentFragment 批量构建 DOM
    const fragment = document.createDocumentFragment();
    
    // 创建全选栏
    const selectAllBar = document.createElement('div');
    selectAllBar.className = 'select-all-bar';
    selectAllBar.innerHTML = `
      <label>
        <input type="checkbox" id="select-all-videos" class="video-checkbox">
        <span>全选</span>
      </label>
      <button class="sort-inline-btn ${filterSettings.sortBy === 'plays-desc' ? 'active' : ''}" data-sort="plays" title="按播放量排序">▶️${filterSettings.sortBy === 'plays-desc' ? '↓' : filterSettings.sortBy === 'plays-asc' ? '↑' : ''}</button>
      <button class="sort-inline-btn ${filterSettings.sortBy === 'orders-desc' ? 'active' : ''}" data-sort="orders" title="按订单排序">🛒${filterSettings.sortBy === 'orders-desc' ? '↓' : filterSettings.sortBy === 'orders-asc' ? '↑' : ''}</button>
      <button class="sort-inline-btn ${filterSettings.sortBy === 'amount-desc' ? 'active' : ''}" data-sort="amount" title="按金额排序">💰${filterSettings.sortBy === 'amount-desc' ? '↓' : filterSettings.sortBy === 'amount-asc' ? '↑' : ''}</button>
      <span class="selected-count" id="selected-count">已选 0 个</span>
    `;
    fragment.appendChild(selectAllBar);
    
    // 构建视频卡片
    sortedVideos.forEach((video, idx) => {
      totalPlays += video.playCount;
      totalOrders += video.orderCount;
      totalAmount += video.orderAmount;
      
      const growth = getVideoGrowth(video.feedId);
      
      let playGrowthBadge = '';
      let orderGrowthBadge = '';
      let amountGrowthBadge = '';
      
      if (growth) {
        hasGrowthData = true;
        totalPlayGrowth += growth.playGrowth;
        totalOrderGrowth += growth.orderGrowth;
        totalAmountGrowth += growth.amountGrowth;
        
        if (growth.playGrowth !== 0) {
          const badgeClass = growth.playGrowth > 0 ? '' : 'negative';
          playGrowthBadge = `<span class="growth-badge ${badgeClass}">${growth.playGrowth > 0 ? '+' : ''}${formatNumber(growth.playGrowth)}</span>`;
        } else {
          playGrowthBadge = `<span class="growth-badge zero">+0</span>`;
        }
        
        if (growth.orderGrowth !== 0) {
          const badgeClass = growth.orderGrowth > 0 ? '' : 'negative';
          orderGrowthBadge = `<span class="growth-badge ${badgeClass}">${growth.orderGrowth > 0 ? '+' : ''}${growth.orderGrowth}</span>`;
        }
        
        if (growth.amountGrowth !== 0) {
          amountGrowthBadge = `<span class="growth-badge amount">${growth.amountGrowth > 0 ? '+' : ''}¥${formatNumber(growth.amountGrowth)}</span>`;
        }
      } else {
        playGrowthBadge = '<span class="no-growth">(首次记录)</span>';
      }
      
      let auditBadge = '';
      if (video.auditStatus === 'failed') {
        auditBadge = '<span class="audit-badge failed">❌ 审核失败</span>';
      } else if (video.auditStatus === 'passed') {
        auditBadge = '<span class="audit-badge passed">✅ 审核通过</span>';
      } else if (video.auditStatus === 'pending') {
        auditBadge = '<span class="audit-badge pending">⏳ 审核中</span>';
      }
      
      const card = document.createElement('div');
      card.className = `video-card ${video.auditStatus === 'failed' ? 'audit-failed' : ''}`;
      card.dataset.feedId = video.feedId;
      card.dataset.videoIndex = idx;
      card.innerHTML = `
        <input type="checkbox" class="video-checkbox video-item-checkbox" data-feed-id="${escapeHtml(video.feedId)}">
        <img class="video-cover" src="${escapeHtml(video.coverUrl)}" alt="" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 60 60%22><rect fill=%22%23eee%22 width=%2260%22 height=%2260%22/><text x=%2230%22 y=%2235%22 text-anchor=%22middle%22 fill=%22%23999%22 font-size=%2212%22>无封面</text></svg>'">
        <div class="video-info">
          <div class="video-desc">${escapeHtml(video.desc) || '无描述'} ${auditBadge}</div>
          <div class="video-stats">
            <span class="stat-item">▶️ <span class="num">${formatNumber(video.playCount)}</span>${playGrowthBadge}</span>
            <span class="stat-item">🛒 <span class="num">${video.orderCount}</span>${orderGrowthBadge}</span>
            <span class="stat-item amount">💰 <span class="num">¥${formatNumber(video.orderAmount)}</span>${amountGrowthBadge}</span>
          </div>
          <div class="video-meta">
            <span class="video-id">ID: ${escapeHtml(video.feedId)}</span>
            <div style="display:flex;gap:4px;align-items:center;">
              ${video.date ? `<span class="video-date">📅 ${escapeHtml(video.date)}</span>` : ''}
              <button class="video-expand-btn" data-feed-id="${escapeHtml(video.feedId)}">📄 详情</button>
            </div>
          </div>
        </div>
      `;
      fragment.appendChild(card);
    });
    
    if (willBeLimited) {
      const limitTip = document.createElement('div');
      limitTip.style.cssText = 'text-align:center;padding:10px;color:#666;font-size:12px;';
      limitTip.textContent = `已显示前 ${MAX_PANEL_VIDEOS} 个视频，共 ${displayCount} 个`;
      fragment.appendChild(limitTip);
    }
    
    if (listEl) {
      listEl.innerHTML = '';
      listEl.appendChild(fragment);
    }
    
    if (totalVideosEl) totalVideosEl.textContent = allVideos.length;
    if (totalPlaysEl) totalPlaysEl.textContent = formatNumber(totalPlays);
    if (totalOrdersEl) totalOrdersEl.textContent = totalOrders;
    if (totalAmountEl) totalAmountEl.textContent = '¥' + formatNumber(totalAmount);
    
    if (pageCountEl) pageCountEl.textContent = currentPage;
    if (totalCountEl) totalCountEl.textContent = totalCount || '?';
    
    if (autoStatusEl) {
      if (isAutoPaging) {
        autoStatusEl.innerHTML = '<span style="color:#27ae60;">⚡ 自动翻页中...</span>';
      } else if (currentPage > 0) {
        if (hasGrowthData) {
          autoStatusEl.innerHTML = `<span style="color:#27ae60;">✓ 今日增长: 播放+${formatNumber(totalPlayGrowth)} 订单+${totalOrderGrowth} 金额+¥${formatNumber(totalAmountGrowth)}</span>`;
        } else {
          autoStatusEl.innerHTML = '<span style="color:#999;">首次记录，明天可查看增长数据</span>';
        }
      }
    }
    
    // 只绑定一次事件委托
    if (!videoListEventBound) {
      videoListEventBound = true;
      bindVideoListEvents();
    }
    
    bindFilterEvents();
    updateDataComparison();
  }
  
  // 绑定视频列表事件委托（只执行一次）
  function bindVideoListEvents() {
    const listEl = document.getElementById('pdd-video-list');
    if (!listEl) return;
    
    // 点击事件委托
    listEl.addEventListener('click', function(e) {
      // 处理全选复选框
      const selectAllCheckbox = e.target.closest('#select-all-videos');
      if (selectAllCheckbox) {
        const itemCheckboxes = listEl.querySelectorAll('.video-item-checkbox');
        itemCheckboxes.forEach(cb => {
          cb.checked = selectAllCheckbox.checked;
          updateCardSelection(cb);
        });
        updateSelectedCount();
        return;
      }
      
      // 处理排序按钮
      const sortBtn = e.target.closest('.sort-inline-btn');
      if (sortBtn) {
        const sortField = sortBtn.dataset.sort;
        const currentSort = filterSettings.sortBy || '';
        if (currentSort.startsWith(sortField)) {
          const dir = currentSort.split('-')[1];
          filterSettings.sortBy = dir === 'desc' ? `${sortField}-asc` : `${sortField}-desc`;
        } else {
          filterSettings.sortBy = `${sortField}-desc`;
        }
        updatePanel();
        return;
      }
      
      // 处理视频项复选框
      const itemCheckbox = e.target.closest('.video-item-checkbox');
      if (itemCheckbox) {
        updateCardSelection(itemCheckbox);
        updateSelectedCount();
        updateSelectAllState();
        return;
      }
      
      // 处理详情按钮
      const detailBtn = e.target.closest('.video-expand-btn');
      if (detailBtn) {
        e.stopPropagation();
        const feedId = detailBtn.dataset.feedId;
        showVideoDetail(feedId);
        return;
      }
    });
    
    // 双击预览
    listEl.addEventListener('dblclick', function(e) {
      if (e.target.classList.contains('video-checkbox')) return;
      const card = e.target.closest('.video-card');
      if (card) {
        const feedId = card.dataset.feedId;
        const video = currentFilteredVideos.find(v => v.feedId === feedId);
        if (video) {
          openPreview(video);
        }
      }
    });
  }
  
  function filterVideos(videos) {
    let filtered = videos.filter(video => {
      if (filterSettings.search) {
        const searchLower = filterSettings.search.toLowerCase();
        const descMatch = video.desc && video.desc.toLowerCase().includes(searchLower);
        const idMatch = video.feedId && video.feedId.toString().includes(searchLower);
        if (!descMatch && !idMatch) {
          return false;
        }
      }
      
      // 日期范围筛选
      if (filterSettings.dateStart || filterSettings.dateEnd) {
        const videoDate = video.date;
        if (!videoDate) return false;
        
        // 直接比较字符串格式的日期 (YYYY-MM-DD)
        const videoDateStr = videoDate.split('T')[0].split(' ')[0];
        
        if (filterSettings.dateStart && videoDateStr < filterSettings.dateStart) {
          return false;
        }
        
        if (filterSettings.dateEnd && videoDateStr > filterSettings.dateEnd) {
          return false;
        }
      }
      
      return true;
    });
    
    // 排序
    if (filterSettings.sortBy) {
      const [field, direction] = filterSettings.sortBy.split('-');
      filtered.sort((a, b) => {
        let valueA = 0, valueB = 0;
        
        switch (field) {
          case 'amount':
            valueA = a.orderAmount || 0;
            valueB = b.orderAmount || 0;
            break;
          case 'orders':
            valueA = a.orderCount || 0;
            valueB = b.orderCount || 0;
            break;
          case 'plays':
            valueA = a.playCount || 0;
            valueB = b.playCount || 0;
            break;
        }
        
        return direction === 'desc' ? valueB - valueA : valueA - valueB;
      });
    }
    
    return filtered;
  }
  
  // 筛选事件绑定标记
  let filterEventsBound = false;
  
  function bindFilterEvents() {
    if (filterEventsBound) return;
    filterEventsBound = true;
    
    const filterBar = document.getElementById('pdd-filter-bar');
    if (!filterBar) return;
    
    const searchInput = document.getElementById('pdd-filter-search');
    const dateRangeInput = document.getElementById('pdd-filter-date-range');
    const selectFilteredBtn = document.getElementById('pdd-select-filtered');
    
    // 使用防抖优化搜索
    let searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          filterSettings.search = this.value;
          updatePanel();
        }, 150);
      });
      searchInput.value = filterSettings.search;
    }
    
    // 日期范围选择器
    if (dateRangeInput) {
      // 初始化显示
      updateDateRangeDisplay();
      
      // 点击打开日期选择器
      dateRangeInput.addEventListener('click', function(e) {
        e.stopPropagation();
        showDateRangePicker(this);
      });
    }
    
    // 全选筛选结果按钮
    if (selectFilteredBtn) {
      selectFilteredBtn.addEventListener('click', function() {
        const listEl = document.getElementById('pdd-video-list');
        if (!listEl) return;
        const filteredCheckboxes = listEl.querySelectorAll('.video-item-checkbox');
        filteredCheckboxes.forEach(cb => {
          cb.checked = true;
          updateCardSelection(cb);
        });
        updateSelectedCount();
      });
    }
    
    // 绑定全选栏中的排序按钮事件
    const selectAllBar = document.querySelector('.select-all-bar');
    if (selectAllBar) {
      selectAllBar.onclick = function(e) {
        const sortBtn = e.target.closest('.sort-inline-btn');
        if (sortBtn) {
          const sortField = sortBtn.dataset.sort;
          const currentSort = filterSettings.sortBy || '';
          
          if (currentSort.startsWith(sortField)) {
            const currentDir = currentSort.split('-')[1];
            if (currentDir === 'desc') {
              filterSettings.sortBy = sortField + '-asc';
            } else {
              filterSettings.sortBy = '';
            }
          } else {
            filterSettings.sortBy = sortField + '-desc';
          }
          
          updatePanel();
        }
      };
    }
  }
  
  // 更新日期范围显示
  function updateDateRangeDisplay() {
    const dateRangeInput = document.getElementById('pdd-filter-date-range');
    if (!dateRangeInput) return;
    
    if (filterSettings.dateStart && filterSettings.dateEnd) {
      dateRangeInput.value = `${filterSettings.dateStart} 至 ${filterSettings.dateEnd}`;
    } else if (filterSettings.dateStart) {
      dateRangeInput.value = `${filterSettings.dateStart} 起`;
    } else if (filterSettings.dateEnd) {
      dateRangeInput.value = `至 ${filterSettings.dateEnd}`;
    } else {
      dateRangeInput.value = '';
    }
  }
  
  // 显示日期范围选择器 - 使用原生日期选择器分两次选择
  function showDateRangePicker(inputEl) {
    // 如果已经有选择器打开，先关闭
    const existingPicker = document.getElementById('pdd-date-range-picker');
    if (existingPicker) {
      existingPicker.remove();
    }
    
    // 创建临时状态
    let tempStart = filterSettings.dateStart || '';
    let tempEnd = filterSettings.dateEnd || '';
    let selectingStart = !tempStart; // 如果没有开始日期，先选开始
    
    // 创建选择器容器
    const picker = document.createElement('div');
    picker.id = 'pdd-date-range-picker';
    picker.className = 'date-range-picker show';
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const monthAgoStr = monthAgo.toISOString().split('T')[0];
    
    // 月份偏移量（用于导航）
    let monthOffset = 0;
    
    // 生成日历HTML
    function generateCalendarHTML() {
      const now = new Date();
      const baseYear = now.getFullYear();
      const baseMonth = now.getMonth();
      
      // 计算要显示的两个月份
      let firstMonth = baseMonth + monthOffset;
      let firstYear = baseYear;
      
      // 处理跨年
      while (firstMonth < 0) {
        firstMonth += 12;
        firstYear--;
      }
      while (firstMonth > 11) {
        firstMonth -= 12;
        firstYear++;
      }
      
      let secondMonth = firstMonth + 1;
      let secondYear = firstYear;
      if (secondMonth > 11) {
        secondMonth = 0;
        secondYear++;
      }
      
      // 生成两个月的日历
      let calendarHTML = `
        <div class="calendar-navigation" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;margin-bottom:8px;border-bottom:1px solid #eee;">
          <button class="calendar-nav-btn prev" style="padding:4px 12px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:12px;">← 上月</button>
          <span class="calendar-nav-info" style="font-size:12px;color:#666;">${firstYear}年${firstMonth + 1}月 - ${secondYear}年${secondMonth + 1}月</span>
          <button class="calendar-nav-btn next" style="padding:4px 12px;background:#f5f5f5;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-size:12px;">下月 →</button>
        </div>
        <div class="calendar-container">
      `;
      
      // 第一个月
      calendarHTML += generateMonthCalendar(firstYear, firstMonth, tempStart, tempEnd);
      // 第二个月
      calendarHTML += generateMonthCalendar(secondYear, secondMonth, tempStart, tempEnd);
      
      calendarHTML += '</div>';
      return calendarHTML;
    }
    
    // 生成单月日历
    function generateMonthCalendar(year, month, startDate, endDate) {
      // 处理月份跨年
      if (month < 0) {
        month = 11;
        year--;
      } else if (month > 11) {
        month = 0;
        year++;
      }
      
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      
      let html = `<div class="calendar-month"><div class="calendar-month-title">${year}年${monthNames[month]}</div>`;
      html += '<div class="calendar-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>';
      html += '<div class="calendar-days">';
      
      // 空白填充
      for (let i = 0; i < firstDay; i++) {
        html += '<span class="calendar-day empty"></span>';
      }
      
      // 日期
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        let classes = 'calendar-day';
        
        if (dateStr === startDate) classes += ' start';
        if (dateStr === endDate) classes += ' end';
        if (startDate && endDate && dateStr > startDate && dateStr < endDate) classes += ' in-range';
        
        html += `<span class="${classes}" data-date="${dateStr}">${day}</span>`;
      }
      
      html += '</div></div>';
      return html;
    }
    
    // 更新选择器内容
    function updatePickerContent() {
      const startText = tempStart || '未选择';
      const endText = tempEnd || '未选择';
      
      picker.innerHTML = `
        <div class="date-range-picker-header">
          <span class="date-range-picker-title">选择日期范围</span>
          <button class="date-range-picker-close">&times;</button>
        </div>
        <div class="date-range-picker-presets">
          <span class="date-range-preset" data-start="${todayStr}" data-end="${todayStr}">今天</span>
          <span class="date-range-preset" data-start="${weekAgoStr}" data-end="${todayStr}">近7天</span>
          <span class="date-range-preset" data-start="${monthAgoStr}" data-end="${todayStr}">近30天</span>
          <span class="date-range-preset" data-start="" data-end="">全部</span>
        </div>
        <div class="date-range-selection-status" style="padding:8px;background:#f5f5f5;border-radius:4px;margin-bottom:10px;text-align:center;">
          <div style="font-size:13px;font-weight:600;color:#333;">
            <span style="color:${tempStart ? '#10b981' : '#999'}">${startText}</span>
            <span style="margin:0 8px;color:#999;">→</span>
            <span style="color:${tempEnd ? '#10b981' : '#999'}">${endText}</span>
          </div>
          <div style="font-size:11px;color:#666;margin-top:4px;">${!tempStart ? '点击选择开始日期' : !tempEnd ? '点击选择结束日期' : '点击日期可重新选择'}</div>
        </div>
        ${generateCalendarHTML()}
        <div class="date-range-picker-footer">
          <button class="date-range-picker-btn clear">清除筛选</button>
          <button class="date-range-picker-btn cancel">取消</button>
          <button class="date-range-picker-btn confirm">确定</button>
        </div>
      `;
      
      // 重新绑定事件
      bindPickerEvents();
    }
    
    // 关闭选择器的通用函数
    const closePicker = () => {
      picker.remove();
    };
    
    function bindPickerEvents() {
      const closeBtn = picker.querySelector('.date-range-picker-close');
      const cancelBtn = picker.querySelector('.date-range-picker-btn.cancel');
      const confirmBtn = picker.querySelector('.date-range-picker-btn.confirm');
      const presets = picker.querySelectorAll('.date-range-preset');
      const dayElements = picker.querySelectorAll('.calendar-day:not(.empty)');
      
      // 关闭按钮
      closeBtn.onclick = closePicker;
      cancelBtn.onclick = closePicker;
      
      // 月份导航按钮
      const prevBtn = picker.querySelector('.calendar-nav-btn.prev');
      const nextBtn = picker.querySelector('.calendar-nav-btn.next');
      if (prevBtn) {
        prevBtn.onclick = function(e) {
          e.stopPropagation();
          monthOffset -= 2;
          updatePickerContent();
        };
      }
      if (nextBtn) {
        nextBtn.onclick = function(e) {
          e.stopPropagation();
          monthOffset += 2;
          updatePickerContent();
        };
      }
      
      // 快捷选项
      presets.forEach(preset => {
        preset.onclick = function() {
          const start = this.dataset.start;
          const end = this.dataset.end;
          
          // 处理"全部"选项（空字符串表示清除筛选）
          if (start === '' && end === '') {
            filterSettings.dateStart = '';
            filterSettings.dateEnd = '';
            tempStart = '';
            tempEnd = '';
          } else {
            filterSettings.dateStart = start;
            filterSettings.dateEnd = end;
            tempStart = start;
            tempEnd = end;
          }
          
          updateDateRangeDisplay();
          updatePanel();
          closePicker();
        };
      });
      
      // 日历日期点击
      dayElements.forEach(dayEl => {
        dayEl.onclick = function(e) {
          e.stopPropagation();
          e.preventDefault();
          const clickedDate = this.dataset.date;
          console.log('[PDD监控] 点击日期:', clickedDate, '当前状态:', { tempStart, tempEnd });
          
          if (!tempStart || (tempStart && tempEnd)) {
            // 新的开始
            tempStart = clickedDate;
            tempEnd = '';
            console.log('[PDD监控] 设置开始日期:', tempStart);
          } else if (tempStart && !tempEnd) {
            // 选择结束
            if (clickedDate < tempStart) {
              // 如果点击的日期早于开始，交换
              tempEnd = tempStart;
              tempStart = clickedDate;
            } else {
              tempEnd = clickedDate;
            }
            console.log('[PDD监控] 设置结束日期:', tempEnd, '开始日期:', tempStart);
          }
          
          updatePickerContent();
        };
      });
      
      // 清除筛选按钮
      const clearBtn = picker.querySelector('.date-range-picker-btn.clear');
      if (clearBtn) {
        clearBtn.onclick = function() {
          tempStart = '';
          tempEnd = '';
          filterSettings.dateStart = '';
          filterSettings.dateEnd = '';
          updateDateRangeDisplay();
          updatePanel();
          closePicker();
        };
      }
      
      // 确认按钮 - 应用当前选择的日期范围（允许空值表示清除筛选）
      if (confirmBtn) {
        confirmBtn.onclick = function() {
          filterSettings.dateStart = tempStart;
          filterSettings.dateEnd = tempEnd;
          updateDateRangeDisplay();
          updatePanel();
          closePicker();
        };
      }
      
      // 取消按钮 - 只是关闭选择器，不修改筛选条件
      if (cancelBtn) {
        cancelBtn.onclick = closePicker;
      }
    }
    
    // 定位
    const rect = inputEl.getBoundingClientRect();
    picker.style.position = 'fixed';
    picker.style.top = (rect.bottom + 5) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
    picker.style.maxHeight = '400px';
    picker.style.overflowY = 'auto';
    
    document.body.appendChild(picker);
    updatePickerContent();
    
    // 点击外部关闭 - 使用 mousedown 避免与日期点击冲突
    setTimeout(() => {
      document.addEventListener('mousedown', function closeOnClick(e) {
        // 检查点击是否在 picker 内部或者是 inputEl
        if (picker.contains(e.target) || e.target === inputEl) {
          return;
        }
        // 检查点击的是否是日历日期（通过检查是否有 calendar-day 类）
        if (e.target.closest('.calendar-day')) {
          return;
        }
        picker.remove();
        document.removeEventListener('mousedown', closeOnClick);
      });
    }, 100);
  }
  
  function updateSortButtonStates() {
    const sortButtons = document.querySelectorAll('.sort-btn');
    const currentSort = filterSettings.sortBy || '';
    
    sortButtons.forEach(btn => {
      const sortField = btn.dataset.sort;
      btn.classList.remove('active', 'asc', 'desc');
      
      if (currentSort.startsWith(sortField)) {
        const dir = currentSort.split('-')[1];
        btn.classList.add('active', dir);
      }
    });
  }
  
  function updateCardSelection(checkbox) {
    const card = checkbox.closest('.video-card');
    if (card) {
      if (checkbox.checked) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    }
  }
  
  function updateSelectedCount() {
    const checkedCount = document.querySelectorAll('.video-item-checkbox:checked').length;
    const selectedCountEl = document.getElementById('selected-count');
    if (selectedCountEl) {
      selectedCountEl.textContent = `已选 ${checkedCount} 个`;
    }
  }
  
  function updateSelectAllState() {
    const selectAllCheckbox = document.getElementById('select-all-videos');
    const itemCheckboxes = document.querySelectorAll('.video-item-checkbox');
    const checkedCount = document.querySelectorAll('.video-item-checkbox:checked').length;
    
    if (selectAllCheckbox) {
      if (checkedCount === 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
      } else if (checkedCount === itemCheckboxes.length) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
      } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
      }
    }
  }
  
  function getSelectedVideos() {
    const checkedCheckboxes = document.querySelectorAll('.video-item-checkbox:checked');
    const selectedFeedIds = Array.from(checkedCheckboxes).map(cb => cb.dataset.feedId);
    return allVideos.filter(video => selectedFeedIds.includes(video.feedId));
  }
  
  function formatNumber(num) {
    if (typeof num !== 'number') num = parseFloat(num) || 0;
    if (num >= 10000) {
      return (num / 10000).toFixed(2) + '万';
    }
    return num.toLocaleString();
  }
  
  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  function saveSyncHistory(progress) {
    const historyRecord = {
      time: new Date().toISOString(),
      timestamp: Date.now(),
      created: progress.created,
      updated: progress.updated,
      skipped: progress.skipped,
      failed: progress.failed,
      createdIds: progress.createdIds,
      updatedIds: progress.updatedIds,
      failedIds: progress.failedIds
    };
    
    syncHistory.unshift(historyRecord);
    if (syncHistory.length > 50) {
      syncHistory = syncHistory.slice(0, 50);
    }
    
    chrome.storage.local.set({ syncHistory: syncHistory }, () => {
      console.log('[PDD监控] 同步历史已保存');
    });
  }
  
  function loadSyncHistory() {
    chrome.storage.local.get(['syncHistory'], (result) => {
      if (result.syncHistory) {
        syncHistory = result.syncHistory;
      }
    });
  }
  
  function showSyncNotification(progress) {
    if (chrome.notifications) {
      const title = progress.failed > 0 ? '同步完成（有失败）' : '同步完成';
      const message = `创建: ${progress.created}, 更新: ${progress.updated}, 跳过: ${progress.skipped}, 失败: ${progress.failed}`;
      
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.svg',
        title: title,
        message: message,
        priority: 2
      });
    }
  }
  
  async function syncSingleVideo(video, brandValue, productValue, editorIdValue) {
    const videoIdStr = video.feedId;
    if (!videoIdStr) {
      console.warn('[PDD监控] 视频缺少feedId，跳过');
      syncProgress.skipped++;
      return;
    }
    
    try {
      let existingVideo = null;
      
      if (video._exists && video._existingData) {
        existingVideo = video._existingData;
        console.log('[PDD监控] 使用缓存的视频数据:', videoIdStr);
      } else {
        // 添加超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const checkResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/by-videoid/${videoIdStr}`, {
          signal: controller.signal
        }).catch(() => null);
        
        clearTimeout(timeoutId);
        
        if (checkResponse && checkResponse.ok) {
          const checkData = await checkResponse.json();
          if (checkData.found && checkData.video) {
            existingVideo = checkData.video;
          }
        }
      }
      
      // 不再尝试下载视频文件，直接使用URL
      // const coverBlob = await fetchImageAsBlob(video.coverUrl);
      // const videoBlob = await fetchVideoAsBlob(video.videoUrl);
      
      if (existingVideo) {
        // 检查审核状态 - 审核失败的视频不更新
        if (existingVideo.auditStatus === 'failed' || existingVideo.status === 'rejected') {
          syncProgress.skipped++;
          console.log('[PDD监控] 视频审核失败，跳过更新:', videoIdStr);
          return;
        }
        
        // 智能对比同步逻辑
        const serverViews = existingVideo.views || 0;
        const serverOrders = existingVideo.orders || 0;
        const serverRevenue = existingVideo.revenue || 0;
        const websiteViews = video.playCount || 0;
        const websiteOrders = video.orderCount || 0;
        const websiteRevenue = video.orderAmount || 0;
        
        // 播放量不一致
        const viewsDifferent = websiteViews !== serverViews;
        // 服务器金额低于网站金额
        const serverRevenueLower = serverRevenue < websiteRevenue;
        // 服务器订单低于网站订单
        const serverOrdersLower = serverOrders < websiteOrders;
        
        // 确定最终同步的值
        let finalViews = websiteViews;  // 播放量总是使用网站的（最新的）
        let finalOrders = websiteOrders;
        let finalRevenue = websiteRevenue;
        
        // 如果播放量不一致，且服务器金额/订单低于网站
        if (viewsDifferent) {
          if (serverRevenueLower) {
            // 服务器金额低于网站金额，使用网站金额
            finalRevenue = websiteRevenue;
            console.log(`[PDD监控] 💰 播放量不一致且服务器金额(${serverRevenue})<网站金额(${websiteRevenue})，使用网站金额: ${finalRevenue}`);
          } else {
            // 服务器金额高于或等于网站金额，保留服务器金额
            finalRevenue = serverRevenue;
            console.log(`[PDD监控] 💰 播放量不一致但服务器金额(${serverRevenue})>=网站金额(${websiteRevenue})，保留服务器金额: ${finalRevenue}`);
          }
          
          if (serverOrdersLower) {
            // 服务器订单低于网站订单，使用网站订单
            finalOrders = websiteOrders;
            console.log(`[PDD监控] 📦 服务器订单(${serverOrders})<网站订单(${websiteOrders})，使用网站订单: ${finalOrders}`);
          } else {
            // 服务器订单高于或等于网站订单，保留服务器订单
            finalOrders = serverOrders;
            console.log(`[PDD监控] 📦 服务器订单(${serverOrders})>=网站订单(${websiteOrders})，保留服务器订单: ${finalOrders}`);
          }
        }
        
        // 如果所有数据都一致，跳过更新
        if (!viewsDifferent && websiteOrders === serverOrders && websiteRevenue === serverRevenue) {
          syncProgress.skipped++;
          console.log('[PDD监控] 数据一致，跳过更新:', videoIdStr);
          return;
        }
        
        console.log(`[PDD监控] 🔄 同步 ${videoIdStr}: 播放量${serverViews}→${finalViews}, 订单${serverOrders}→${finalOrders}, 金额${serverRevenue}→${finalRevenue}`);
        
        const formData = new FormData();
        formData.append('brand', existingVideo.brand || '');
        formData.append('product', existingVideo.product || '');
        formData.append('views', finalViews);
        formData.append('orders', finalOrders);
        formData.append('revenue', finalRevenue);
        
        if (existingVideo.editorId) {
          formData.append('editorId', existingVideo.editorId);
        }
        if (existingVideo.title) {
          formData.append('title', existingVideo.title);
        }
        if (video.date) {
          formData.append('date', video.date);
        } else if (existingVideo.date) {
          formData.append('date', existingVideo.date);
        }
        if (existingVideo.playIncrement !== undefined && existingVideo.playIncrement !== null) {
          formData.append('playIncrement', existingVideo.playIncrement);
        }
        
        // 保持原有的视频URL和封面URL，不更新
        if (existingVideo.videoUrl) {
          formData.append('videoUrl', existingVideo.videoUrl);
        }
        if (existingVideo.coverUrl) {
          formData.append('coverUrl', existingVideo.coverUrl);
        }
        
        const updateResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/${existingVideo.id}`, {
          method: 'PUT',
          body: formData
        });
        
        if (updateResponse.ok) {
          syncProgress.updated++;
          syncProgress.updatedIds.push(videoIdStr);
          console.log('[PDD监控] 更新视频成功:', videoIdStr);
        } else {
          const errorText = await updateResponse.text();
          console.error('[PDD监控] 更新视频失败:', videoIdStr, errorText);
          syncProgress.failed++;
          syncProgress.failedIds.push(videoIdStr);
        }
      } else {
        const formData = new FormData();
        formData.append('brand', brandValue || '拼多多视频');
        formData.append('product', productValue || (video.desc ? video.desc.substring(0, 6) : '未知产品'));
        formData.append('videoIdNum', videoIdStr);
        formData.append('views', video.playCount || 0);
        formData.append('orders', video.orderCount || 0);
        formData.append('revenue', video.orderAmount || 0);
        formData.append('editorId', editorIdValue || config.editorId || DEFAULT_EDITOR_ID);
        
        if (video.desc) {
          formData.append('title', video.desc.substring(0, 6));
        }
        
        if (video.date) {
          formData.append('date', video.date);
        }
        
        if (video.videoUrl) {
          formData.append('videoUrl', video.videoUrl);
        }
        if (video.coverUrl) {
          formData.append('coverUrl', video.coverUrl);
        }
        
        const createResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos`, {
          method: 'POST',
          body: formData
        });
        
        if (createResponse.ok) {
          syncProgress.created++;
          syncProgress.createdIds.push(videoIdStr);
          console.log('[PDD监控] 创建视频成功:', videoIdStr);
        } else {
          const errorText = await createResponse.text();
          console.log('[PDD监控] 创建视频失败，尝试重新查询并更新:', videoIdStr, errorText || '(无错误信息)');
          
          let retryExistingVideo = null;
          
          const retryCheckResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/by-videoid/${videoIdStr}`);
          if (retryCheckResponse && retryCheckResponse.ok) {
            const retryCheckData = await retryCheckResponse.json();
            if (retryCheckData.found && retryCheckData.video) {
              retryExistingVideo = retryCheckData.video;
            }
          }
          
          if (!retryExistingVideo) {
            console.log('[PDD监控] by-videoid 查询失败，尝试从视频列表中查找:', videoIdStr);
            try {
              const listResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos`);
              if (listResponse && listResponse.ok) {
                const listData = await listResponse.json();
                if (listData.videos && Array.isArray(listData.videos)) {
                  retryExistingVideo = listData.videos.find(v => 
                    String(v.videoIdNum) === String(videoIdStr) || 
                    String(v.videoId) === String(videoIdStr) ||
                    String(v.id) === String(videoIdStr)
                  );
                  if (retryExistingVideo) {
                    console.log('[PDD监控] 从视频列表中找到视频:', videoIdStr, retryExistingVideo.id);
                  }
                }
              }
            } catch (listError) {
              console.error('[PDD监控] 获取视频列表失败:', listError);
            }
          }
          
          if (retryExistingVideo) {
            // 智能对比同步逻辑（重试）
            const retryServerViews = retryExistingVideo.views || 0;
            const retryServerOrders = retryExistingVideo.orders || 0;
            const retryServerRevenue = retryExistingVideo.revenue || 0;
            const retryWebsiteViews = video.playCount || 0;
            const retryWebsiteOrders = video.orderCount || 0;
            const retryWebsiteRevenue = video.orderAmount || 0;
            
            const retryViewsDifferent = retryWebsiteViews !== retryServerViews;
            const retryServerRevenueLower = retryServerRevenue < retryWebsiteRevenue;
            const retryServerOrdersLower = retryServerOrders < retryWebsiteOrders;
            
            let retryFinalViews = retryWebsiteViews;
            let retryFinalOrders = retryWebsiteOrders;
            let retryFinalRevenue = retryWebsiteRevenue;
            
            if (retryViewsDifferent) {
              if (retryServerRevenueLower) {
                retryFinalRevenue = retryWebsiteRevenue;
              } else {
                retryFinalRevenue = retryServerRevenue;
              }
              if (retryServerOrdersLower) {
                retryFinalOrders = retryWebsiteOrders;
              } else {
                retryFinalOrders = retryServerOrders;
              }
            }
            
            // 如果所有数据都一致，跳过更新
            if (!retryViewsDifferent && retryWebsiteOrders === retryServerOrders && retryWebsiteRevenue === retryServerRevenue) {
              syncProgress.skipped++;
              console.log('[PDD监控] 重试查询后数据一致，跳过更新:', videoIdStr);
              return;
            }
            
            console.log(`[PDD监控] 🔄 重试同步 ${videoIdStr}: 播放量${retryServerViews}→${retryFinalViews}, 订单${retryServerOrders}→${retryFinalOrders}, 金额${retryServerRevenue}→${retryFinalRevenue}`);
            
            const retryFormData = new FormData();
            retryFormData.append('brand', retryExistingVideo.brand || brandValue || '拼多多视频');
            retryFormData.append('product', retryExistingVideo.product || productValue || '未知产品');
            retryFormData.append('views', retryFinalViews);
            retryFormData.append('orders', retryFinalOrders);
            retryFormData.append('revenue', retryFinalRevenue);
            
            if (retryExistingVideo.editorId) {
              retryFormData.append('editorId', retryExistingVideo.editorId);
            }
            if (retryExistingVideo.title) {
              retryFormData.append('title', retryExistingVideo.title);
            }
            if (video.date) {
              retryFormData.append('date', video.date);
            } else if (retryExistingVideo.date) {
              retryFormData.append('date', retryExistingVideo.date);
            }
            
            if (video.videoUrl) {
              retryFormData.append('videoUrl', video.videoUrl);
            }
            if (video.coverUrl) {
              retryFormData.append('coverUrl', video.coverUrl);
            }
            
            const retryUpdateResponse = await fetch(`${config.apiUrl || API_BASE_URL}/videos/${retryExistingVideo.id}`, {
              method: 'PUT',
              body: retryFormData
            });
            
            if (retryUpdateResponse.ok) {
              syncProgress.updated++;
              syncProgress.updatedIds.push(videoIdStr);
              console.log('[PDD监控] 重试更新视频成功:', videoIdStr);
            } else {
              const retryErrorText = await retryUpdateResponse.text();
              console.error('[PDD监控] 重试更新视频失败:', videoIdStr, retryErrorText);
              syncProgress.failed++;
              syncProgress.failedIds.push(videoIdStr);
            }
          } else {
            console.error('[PDD监控] 无法找到已存在的视频，跳过:', videoIdStr);
            syncProgress.failed++;
            syncProgress.failedIds.push(videoIdStr);
          }
        }
      }
    } catch (error) {
      console.error('[PDD监控] 同步视频异常:', videoIdStr, error);
      syncProgress.failed++;
    }
  }
  
  async function fetchImageAsBlob(url) {
    if (!url) return null;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('[PDD监控] 获取封面图片失败:', url, error);
      return null;
    }
  }
  
  async function fetchVideoAsBlob(url) {
    if (!url) return null;
    
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const blob = await response.blob();
      return blob;
    } catch (error) {
      console.error('[PDD监控] 获取视频文件失败:', url, error);
      return null;
    }
  }
  
  function updateSyncStatus(type, message) {
    const statusEl = document.getElementById('pdd-sync-status');
    if (!statusEl) return;
    
    statusEl.style.display = 'block';
    
    // 根据类型设置不同的样式
    let bgColor = '#e3f2fd'; // info 默认蓝色
    let textColor = '#1565c0';
    
    if (type === 'success') {
      bgColor = '#e8f5e9';
      textColor = '#2e7d32';
    } else if (type === 'error') {
      bgColor = '#ffebee';
      textColor = '#c62828';
    } else if (type === 'syncing') {
      bgColor = '#fff3e0';
      textColor = '#e65100';
    }
    
    statusEl.style.background = bgColor;
    statusEl.style.color = textColor;
    statusEl.style.padding = '10px';
    statusEl.style.borderRadius = '6px';
    statusEl.style.marginBottom = '10px';
    statusEl.innerHTML = `<div>${message}</div>`;
  }
  
  // ========== 批量自动发布功能 ==========
  let batchPublishConfig = null;
  let batchPublishQueue = [];
  let currentPublishIndex = 0;
  let isBatchPublishing = false;
  let batchPublishObserver = null;
  
  // 监听来自 popup 的消息
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // 静默处理心跳和活动模拟消息，减少日志输出
    if (msg.action === 'heartbeat') {
      sendResponse({ success: true });
      return;
    }
    if (msg.action === 'simulateActivity') {
      sendResponse({ success: true });
      return;
    }
    
    // 其他消息记录日志
    console.log('[PDD监控] 收到消息:', msg.action, msg);
    if (msg.action === 'startBatchPublish') {
      startBatchPublish(msg.config);
      sendResponse({ success: true });
    }
    if (msg.action === 'stopBatchPublish') {
      stopBatchPublish();
      sendResponse({ success: true });
    }
    if (msg.action === 'startAutoFill') {
      console.log('[PDD监控] 开始自动填写，配置:', msg.config);
      startAutoFill(msg.config);
      sendResponse({ success: true });
    }
    if (msg.action === 'startAutoUpload') {
      console.log('[PDD监控] 开始自动上传，配置:', msg.config);
      startAutoUpload(msg.config);
      sendResponse({ success: true });
    }
    if (msg.action === 'stopAutoFill') {
      stopAutoFill();
      sendResponse({ success: true });
    }
    return true;
  });
  
  // 开始批量发布
  function startBatchPublish(config) {
    if (!config || !config.videos || config.videos.length === 0) {
      console.log('[PDD监控] 批量发布配置为空');
      return;
    }
    
    batchPublishConfig = config;
    batchPublishQueue = [...config.videos];
    currentPublishIndex = 0;
    isBatchPublishing = true;
    
    console.log('[PDD监控] 开始批量发布，共', batchPublishQueue.length, '个视频');
    
    // 创建批量发布控制面板
    createBatchPublishPanel();
    
    // 开始处理第一个视频
    processNextVideo();
  }
  
  // 停止批量发布
  function stopBatchPublish() {
    isBatchPublishing = false;
    if (batchPublishObserver) {
      batchPublishObserver.disconnect();
      batchPublishObserver = null;
    }
    console.log('[PDD监控] 批量发布已停止');
    updateBatchPublishStatus('已停止', currentPublishIndex, batchPublishQueue.length);
  }
  
  // 创建批量发布控制面板
  function createBatchPublishPanel() {
    // 移除旧面板
    const oldPanel = document.getElementById('pdd-batch-publish-panel');
    if (oldPanel) oldPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'pdd-batch-publish-panel';
    panel.innerHTML = `
      <div style="position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#ff6b6b 0%,#ee5a5a 100%);color:white;padding:15px;border-radius:12px;box-shadow:0 4px 20px rgba(238,90,90,0.4);font-size:12px;width:280px;">
        <div style="font-weight:700;margin-bottom:12px;font-size:14px;display:flex;align-items:center;gap:6px;">
          🚀 批量发布助手
          <span id="batch-publish-progress" style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px;">0/${batchPublishQueue.length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.15);padding:10px;border-radius:8px;margin-bottom:10px;">
          <div style="margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.8);">当前视频</div>
          <div id="batch-current-video" style="font-weight:600;word-break:break-all;font-size:12px;">准备中...</div>
          <div id="batch-current-goods" style="margin-top:4px;font-size:11px;opacity:0.9;">商品ID: -</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;margin-bottom:4px;color:rgba(255,255,255,0.8);">状态</div>
          <div id="batch-publish-status" style="font-weight:500;">等待视频上传...</div>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin-bottom:12px;overflow:hidden;">
          <div id="batch-progress-bar" style="height:100%;background:white;border-radius:2px;width:0%;transition:width 0.3s;"></div>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="batch-btn-next" style="flex:1;padding:8px;background:rgba(255,255,255,0.25);border:none;border-radius:6px;color:white;cursor:pointer;font-weight:600;font-size:12px;">⏭️ 跳过</button>
          <button id="batch-btn-stop" style="flex:1;padding:8px;background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">⏹️ 停止</button>
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.2);font-size:10px;opacity:0.8;line-height:1.5;">
          <div>💡 使用说明：</div>
          <div>1. 手动点击"上传视频"选择文件</div>
          <div>2. 系统自动填写商品ID和描述</div>
          <div>3. 点击"一键发布"完成发布</div>
          <div>4. 重复步骤1-3直到完成</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    
    // 绑定按钮事件
    document.getElementById('batch-btn-next').onclick = () => {
      currentPublishIndex++;
      if (currentPublishIndex < batchPublishQueue.length) {
        processNextVideo();
      } else {
        completeBatchPublish();
      }
    };
    
    document.getElementById('batch-btn-stop').onclick = stopBatchPublish;
  }
  
  // 处理下一个视频
  function processNextVideo() {
    if (!isBatchPublishing || currentPublishIndex >= batchPublishQueue.length) {
      completeBatchPublish();
      return;
    }
    
    const video = batchPublishQueue[currentPublishIndex];
    console.log('[PDD监控] 处理视频:', video.fileName, '商品ID:', video.goodsId);
    
    // 更新面板显示
    document.getElementById('batch-current-video').textContent = video.fileName;
    document.getElementById('batch-current-goods').textContent = `商品ID: ${video.goodsId}`;
    document.getElementById('batch-publish-progress').textContent = `${currentPublishIndex + 1}/${batchPublishQueue.length}`;
    updateBatchPublishStatus('等待视频上传...', currentPublishIndex + 1, batchPublishQueue.length);
    
    // 更新进度条
    const progress = ((currentPublishIndex) / batchPublishQueue.length) * 100;
    document.getElementById('batch-progress-bar').style.width = `${progress}%`;
    
    // 开始监听页面变化，自动填写商品信息
    startAutoFillWatcher(video);
    
    // 通知 popup 更新进度
    chrome.runtime.sendMessage({
      action: 'publishProgress',
      current: currentPublishIndex + 1,
      total: batchPublishQueue.length,
      status: '等待视频上传',
      detail: `${currentPublishIndex + 1} / ${batchPublishQueue.length} - ${video.fileName}`
    });
  }
  
  // 开始自动填写监听器
  function startAutoFillWatcher(video) {
    let fillAttempts = 0;
    const maxAttempts = 50; // 最多尝试50次（约150秒）
    
    // 使用定时器检查（每3秒）- 完全移除 MutationObserver 避免性能问题
    const batchCheckInterval = setInterval(async () => {
      if (!isBatchPublishing) {
        clearInterval(batchCheckInterval);
        return;
      }
      
      const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
      if (videoItems.length > 0) {
        const success = await fillVideoInfo(video);
        if (success) {
          clearInterval(batchCheckInterval);
          updateBatchPublishStatus('已填写商品信息，请发布', currentPublishIndex + 1, batchPublishQueue.length);
          watchPublishButton();
        }
      }
      
      fillAttempts++;
      if (fillAttempts > maxAttempts) {
        clearInterval(batchCheckInterval);
        console.log('[PDD监控] 等待视频上传超时');
        updateBatchPublishStatus('等待超时，请手动上传视频', currentPublishIndex + 1, batchPublishQueue.length);
      }
    }, 3000);
    activeResources.intervals.push(batchCheckInterval);
    
    // 也尝试立即填写（如果视频已经存在）
    setTimeout(async () => {
      const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
      if (videoItems.length > 0) {
        const success = await fillVideoInfo(video);
        if (success) {
          clearInterval(batchCheckInterval);
          updateBatchPublishStatus('已填写商品信息，请发布', currentPublishIndex + 1, batchPublishQueue.length);
          watchPublishButton();
        }
      }
    }, 1000);
  }
  
  // 填写视频信息（统一版）— 兼容两种调用方式 + 封面自动识别 + 完整填充流程
  //
  // 调用方式:
  //   ① 旧版(批量上传): fillVideoInfo(videoItemDOM, goodsId, fileName, description, contentDeclaration)
  //   ② 新版(批量发布): fillVideoInfo({ file, goodsId, description, ... })
  //
  async function fillVideoInfo(videoOrItem, goodsId, fileName, description, contentDeclaration) {

    // ========== 参数归一化 ==========
    let videoFile = null;
    let actualGoodsId = null;
    let actualDesc = null;
    let actualContentDecl = null;
    let videoItemDom = null;

    if (videoOrItem && typeof videoOrItem === 'object' && videoOrItem.nodeType === 1) {
      // ---- 旧版：DOM 元素 ----
      videoItemDom = videoOrItem;
      actualGoodsId = goodsId;
      actualDesc = description || batchPublishConfig?.description || null;
      actualContentDecl = contentDeclaration;
      console.log('[PDD监控] ★ fillVideoInfo [DOM模式] goodsId=', actualGoodsId, ' desc=', (actualDesc||'').substring(0,30), ' decl=', actualContentDecl);

      // 从 pendingUploadConfig 中查找对应的视频文件（供封面截取用）
      if (pendingUploadConfig?.files?.length > 0) {
        const existingItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"], [class*="video-item"]');
        const idx = Math.max(0, existingItems.length - 1);

        if (idx < pendingUploadConfig.files.length) {
          videoFile = pendingUploadConfig.files[idx]?.file || null;
        }
        // 文件名精确匹配作为备选
        if (!videoFile && fileName) {
          for (const vf of pendingUploadConfig.files) {
            if (vf.file?.name === fileName) { videoFile = vf.file; break; }
          }
        }
        if (videoFile) console.log('[PDD监控]   匹配到视频文件:', videoFile.name);
      }

    } else if (videoOrItem && typeof videoOrItem === 'object') {
      // ---- 新版：对象 ----
      videoFile = videoOrItem.file || null;
      actualGoodsId = videoOrItem.goodsId || goodsId || null;
      actualDesc = videoOrItem.description || batchPublishConfig?.description || null;
      actualContentDecl = videoOrItem.contentDeclaration || contentDeclaration || null;
      videoItemDom = videoOrItem.domElement || null;
      console.log('[PDD监控] ★ fillVideoInfo [对象模式] file=', videoFile ? videoFile.name : '无');
    } else {
      console.warn('[PDD监控] fillVideoInfo: 参数无法识别');
      return false;
    }

    // ========== Step 0: 先滚动到视口内（修复：必须在防重复检查之前！）==========
    if (videoItemDom) {
      const rect = videoItemDom.getBoundingClientRect();
      // 如果元素不在视口中，先滚动过去（确保后续的offsetParent/isVideoAlreadyFilled判断正确）
      if (rect.top < 0 || rect.bottom > window.innerHeight || rect.width === 0) {
        videoItemDom.scrollIntoView({ behavior: 'instant', block: 'center' });
        await new Promise(r => setTimeout(r, 300)); // 等待浏览器完成滚动和布局更新
      }
    }

    // ========== 防重复检查（现在元素已在视口内，判断准确） ==========
    if (videoItemDom && isVideoAlreadyFilled(videoItemDom)) {
      console.log('[PDD监控] 商品ID已填充，跳过整个流程');
      return true;
    }

    try {
      // ========== Step 1: 自动选择视频封面（非阻塞，失败不中断）==========
      console.log('[PDD监控] ┌─ Step 1/5: 封面识别');
      try {
        if (videoFile) {
          console.log('[PDD监控] │  截取视频帧:', videoFile.name);
          await autoSelectVideoCover(videoFile);
        } else {
          // 无文件对象时，尝试从预生成封面中获取
          console.log('[PDD监控] │  无视频文件，尝试预生成封面...');
          await autoSelectVideoCover(null);
        }
      } catch (coverErr) {
        console.warn('[PDD监控] │  封面异常（非致命）:', coverErr.message);
      }
      console.log('[PDD监控] ├─ Step 2/5: 选中视频项');

      // ========== Step 2: 滚动 + 选中视频项 ==========
      if (videoItemDom) {
        const rect = videoItemDom.getBoundingClientRect();
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          videoItemDom.scrollIntoView({ behavior: 'instant', block: 'center' });
          await new Promise(r => setTimeout(r, 200));
        }
        // 点击视频项的非封面区域（避免触发封面选择弹窗）
        let clickTarget = null;
        for (const sel of ['.video-list_infoWrap__kVj5S', '[class*="infoWrap"]', '[class*="videoInfo"]', '[class*="meta"]']) {
          const el = videoItemDom.querySelector(sel);
          if (el) { clickTarget = el; break; }  // ★ 修复：移除offsetParent限制
        }
        if (!clickTarget) clickTarget = videoItemDom;
        clickTarget.dispatchEvent(new MouseEvent('click', {
          bubbles: true, cancelable: true, view: window,
          clientX: rect.left + 10, clientY: rect.top + rect.height / 2
        }));
      }

      // ========== Step 3: 等待编辑面板出现 ==========
      console.log('[PDD监控] ├─ Step 3/5: 等待编辑面板');
      await waitForEditorPanel(3000);

      // ========== Step 4: 填充描述 ==========
      console.log('[PDD监控] ├─ Step 4/5: 填充描述/声明');
      if (actualDesc) {
        let finalDesc = actualDesc;
        if (fileName) {
          const suffix = extractNumberSuffix(fileName);
          if (suffix) finalDesc = actualDesc + ' ' + suffix;
        }
        console.log('[PDD监控] │  描述:', finalDesc.substring(0, 40));
        await fillVideoDescription(finalDesc, videoItemDom);
        await new Promise(r => setTimeout(r, 500));
      } else if (fileName) {
        const suffix = extractNumberSuffix(fileName);
        if (suffix) {
          await fillVideoDescription(suffix, videoItemDom);
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // 填充内容声明（全局设置：首次成功后自动跳过后续视频）
      if (actualContentDecl) {
        await new Promise(r => setTimeout(r, 500));   // 等编辑面板完全渲染
        console.log('[PDD监控] │  内容声明:', actualContentDecl);
        let declOk = await fillContentDeclaration(actualContentDecl, videoItemDom);
        if (!declOk) {
          // 首次失败给一次重试机会
          console.log('[PDD监控] │  内容声明首次失败，1.5s后重试...');
          await new Promise(r => setTimeout(r, 1500));
          declOk = await fillContentDeclaration(actualContentDecl, videoItemDom);
        }
        if (declOk) {
          console.log('[PDD监控] │  ✅ 内容声明OK');
        } else {
          console.warn('[PDD监控] │  ⚠️ 内容声明未成功（非致命，后续视频会继续尝试）');
        }
        await new Promise(r => setTimeout(r, 200));
      } else {
        console.log('[PDD监控] │  内容声明: 无(跳过)');
      }

      // 关闭可能出现的弹窗
      closeTopicPopup();

      // ========== Step 5: 填充商品ID ==========
      console.log('[PDD监控] └─ Step 5/5: 商品ID =', actualGoodsId);

      // ★ 方式A: 优先在当前视频项内查找"添加商品"按钮（修复：不再用全局搜索）
      let addGoodsBtn = null;

      if (videoItemDom) {
        // 先在当前视频项的DOM范围内查找
        const localSelectors = [
          '.AddGoodsTrigger_addGoodsTrigger__nbdhF',
          '[class*="AddGoodsTrigger"]',
          '[class*="addGoods"]',
          'div[class*="AddGoods"]'
        ];
        for (const sel of localSelectors) {
          const btn = videoItemDom.querySelector(sel);
          if (btn) {
            addGoodsBtn = btn;
            console.log('[PDD监控]   在videoItemDom内找到添加商品按钮:', sel);
            break;
          }
        }
      }

      // 当前项内没找到时，回退到全局搜索
      if (!addGoodsBtn) {
        addGoodsBtn = findAddGoodsButton();
        if (addGoodsBtn) {
          console.log('[PDD监控]   ⚠️ 回退到全局查找添加商品按钮');
        }
      }

      if (addGoodsBtn) {
        console.log('[PDD监控]   点击添加商品按钮，等待弹窗...');
        addGoodsBtn.click();

        // ★★★ 关键修复：同步等待弹窗填充完成（不再使用异步setTimeout） ★★★
        // 之前的bug：setTimeout(async ()=>{...}, 500) 异步执行fillGoodsIdInModal，
        // 但fillVideoInfo立即return true → 外层验证时弹窗还没填完 → 验证失败 → 3次重试后永久跳过
        try {
          // 等待弹窗出现（拼多多弹窗通常需要600-1200ms渲染）
          await new Promise(r => setTimeout(r, 800));

          console.log('[PDD监控]   开始填充商品ID弹窗, goodsId=', actualGoodsId);
          const fillResult = await fillGoodsIdInModal(actualGoodsId);
          console.log('[PDD监控]   商品ID弹窗填充结果:', fillResult ? '✅成功' : '⚠️失败');

          // 等待弹窗关闭/DOM更新
          await new Promise(r => setTimeout(r, 500));

          // 弹窗内补充描述（如果之前没填成功）
          if (actualDesc) {
            try {
              const descFilled = await fillVideoDescription(actualDesc, videoItemDom);
              console.log('[PDD监控]   弹窗后描述补充:', descFilled ? 'OK' : '跳过');
            } catch(descErr) {
              console.warn('[PDD监控]   弹窗后描述异常:', descErr.message);
            }
          }
        } catch(e) {
          console.error('[PDD监控]   弹窗填写异常:', e.message);
          // ★ 不抛出异常 - 弹窗填充失败不应阻断整个流程（可能是弹窗未弹出/已关闭等）
          // 外层会通过isVideoAlreadyFilled验证来判断最终结果
        }

        return true;
      }

      // 方式B: 直接填充（无按钮时）
      if (videoItemDom && !isVideoAlreadyFilled(videoItemDom)) {
        const filled = await fillGoodsId(videoItemDom, actualGoodsId);
        if (!filled) throw new Error('商品ID填充失败');
      }

      console.log('[PDD监控] ✅ fillVideoInfo 全部完成!');
      return true;

    } catch (e) {
      console.error('[PDD监控] ❌ fillVideoInfo 异常:', e.message);
      throw e;
    }
  }
  
  // 查找"添加商品"按钮
  function findAddGoodsButton() {
    // 先通过 class 查找
    const classSelectors = [
      '.AddGoodsTrigger_addGoodsTrigger__nbdhF',
      '[class*="AddGoodsTrigger"]',
      'div[class*="addGoods"]',
      '[class*="addGoods"] svg'
    ];
    
    for (const selector of classSelectors) {
      try {
        const btn = document.querySelector(selector);
        if (btn) {  // ★ 修复：移除offsetParent限制
          // 如果找到的是svg，返回其父元素
          if (btn.tagName === 'svg') {
            return btn.closest('div[class*="AddGoods"]') || btn.parentElement;
          }
          return btn;
        }
      } catch (e) {
        // 忽略无效选择器错误
      }
    }
    
    // 备用方案：查找所有按钮，找到包含"添加商品"文字的
    const allButtons = document.querySelectorAll('button, div[role="button"]');
    for (const btn of allButtons) {
      // ★ 修复：移除offsetParent限制
      const text = btn.textContent || '';
      if (text.includes('添加商品') || text.includes('添加')) {
        return btn;
      }
    }
    
    return null;
  }
  
  // 从视频中截取一帧作为封面（从 File 对象生成）— 优化版：超时+多时间点重试
  async function captureVideoCoverFromFile(videoFile, timeoutMs = 10000) {
    const CAPTURE_TIMEOUT = timeoutMs;
    const SEEK_POINTS = [1, 2, 0.5, 3]; // 多个seek时间点依次尝试

    return new Promise((resolve, reject) => {
      let isResolved = false;
      const cleanup = (url, video) => {
        try { URL.revokeObjectURL(url); } catch(e) {}
        try { video.remove(); } catch(e) {}
      };

      let url = null;
      let currentSeekIndex = 0;
      let video = null;   // 先声明，后面再赋值

    // 超时定时器
      const timer = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        cleanup(url, video);
        reject(new Error('视频截帧超时(' + CAPTURE_TIMEOUT + 'ms)：视频文件可能过大或格式不支持'));
      }, CAPTURE_TIMEOUT);

      try {
        video = document.createElement('video');
        video.preload = 'auto';       // 改为auto，更快加载
        video.muted = true;
        video.playsInline = true;
        // 注意：不设置crossOrigin——blob URL不需要CORS，设了反而可能出错
        url = URL.createObjectURL(videoFile);

        const doCapture = () => {
          if (isResolved) return;
          try {
            // 检查视频尺寸是否有效（避免黑屏/空白帧）
            if (video.videoWidth < 10 || video.videoHeight < 10) {
              // 尺寸无效，尝试下一个seek点
              tryNextSeek();
              return;
            }

            const canvas = document.createElement('canvas');
            // 限制最大尺寸，避免内存问题
            const maxW = 1920, maxH = 1080;
            let w = video.videoWidth || 1280;
            let h = video.videoHeight || 720;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, w, h);

            canvas.toBlob((blob) => {
              if (isResolved) return;
              clearTimeout(timer);
              isResolved = true;
              cleanup(url, video);
              if (blob && blob.size > 0) {   // 检查blob不为空
                const coverFile = new File([blob], 'cover_' + videoFile.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                resolve(coverFile);
              } else {
                reject(new Error('canvas.toBlob 返回空或size=0'));
              }
            }, 'image/jpeg', 0.92);
          } catch (e) {
            if (isResolved) return;
            tryNextSeek();
          }
        };

        const tryNextSeek = () => {
          if (isResolved) return;
          currentSeekIndex++;
          if (currentSeekIndex >= SEEK_POINTS.length) {
            // 所有seek点都失败了
            isResolved = true;
            clearTimeout(timer);
            cleanup(url, video);
            reject(new Error('所有截帧尝试均失败（视频可能损坏或不支持）'));
            return;
          }
          const seekTime = Math.min(SEEK_POINTS[currentSeekIndex], video.duration - 0.1);
          if (seekTime > 0) {
            video.currentTime = seekTime;
          } else {
            // 视频duration不可用，直接用当前帧尝试
            doCapture();
          }
        };

        // 使用loadedmetadata（比loadeddata更早触发）
        video.onloadedmetadata = () => {
          if (isResolved) return;
          // 立即seek到第一个时间点
          const seekTime = Math.min(SEEK_POINTS[0], (video.duration || 10) - 0.1);
          video.currentTime = Math.max(0.5, seekTime);
        };

        // 兼容：有些浏览器不触发loadedmetadata但会触发loadeddata
        video.onloadeddata = () => {
          if (isResolved) return;
          // 如果还没开始seek，手动触发
          if (!video.currentTime || video.currentTime < 0.1) {
            const seekTime = Math.min(SEEK_POINTS[0], (video.duration || 10) - 0.1);
            video.currentTime = Math.max(0.5, seekTime);
          }
        };

        video.onseeked = () => {
          if (isResolved) return;
          doCapture();
        };

        // canplay也可以作为备选事件
        video.oncanplay = () => {
          if (isResolved) return;
          // 如果seeked迟迟没触发，在canplay时也尝试截取
          setTimeout(() => {
            if (!isResolved) doCapture();
          }, 500);
        };

        video.onerror = (err) => {
          if (isResolved) return;
          isResolved = true;
          clearTimeout(timer);
          cleanup(url, video);
          reject(new Error('视频加载失败: ' + (video.error?.message || JSON.stringify(video.error) || '未知错误')));
        };

        video.src = url;
      } catch (e) {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timer);
        try { if (url) URL.revokeObjectURL(url); } catch(ex) {}
        reject(e);
      }
    });
  }

  // 在页面上为已上传的视频设置封面图 — 重写版：多种方案+重试+交互式封面按钮
  async function setVideoCoverOnPage(coverFile, retryCount = 0) {
    const MAX_RETRIES = 3;
    if (!coverFile) return false;

    try {
      // 等待页面稳定（视频刚上传完时页面DOM可能还在变化）
      await new Promise(r => setTimeout(r, 800));

      console.log(`[PDD监控] 设置封面(第${retryCount + 1}次尝试)...`);

      // ========== 方案A：点击"编辑封面"按钮 → 触发文件选择 → 设置文件 ==========
      // 拼多多的封面上传需要先点击"编辑封面"/"已编辑封面"按钮
      const coverBtnResult = await trySetCoverViaEditButton(coverFile);
      if (coverBtnResult) {
        console.log('[PDD监控] 封面已通过"编辑封面"按钮设置 ✓');
        return true;
      }

      // ========== 方案B：直接查找页面上可见的文件输入框 ==========
      const inputResult = await trySetCoverViaFileInput(coverFile);
      if (inputResult) {
        console.log('[PDD监控] 封面已通过文件输入框设置 ✓');
        return true;
      }

      // ========== 方案C：通过img元素设置base64 ==========
      const imgResult = await trySetCoverViaImgElement(coverFile);
      if (imgResult) {
        console.log('[PDD监控] 封面已通过img元素(base64)设置 ✓');
        return true;
      }

      // ========== 方案D：拖拽方式模拟 ==========
      const dragResult = await trySetCoverViaDragDrop(coverFile);
      if (dragResult) {
        console.log('[PDD监控] 封面已通过拖拽模拟设置 ✓');
        return true;
      }

      // 所有方案都失败，考虑重试
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`[PDD监控] 封面设置未成功，${2}秒后重试(${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(r => setTimeout(r, 2000));
        return setVideoCoverOnPage(coverFile, retryCount + 1);
      }

      console.warn('[PDD监控] 所有封面设置方案均失败（非致命，可手动点击"编辑封面"选择）');
      return false;

    } catch (e) {
      console.error('[PDD监控] 设置封面异常:', e.message);
      // 异常也重试一次
      if (retryCount < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, 2000));
        return setVideoCoverOnPage(coverFile, retryCount + 1);
      }
      return false;
    }
  }

  // 方案A：通过"编辑封面"按钮设置
  async function trySetCoverViaEditButton(coverFile) {
    // 查找"编辑封面"、"已编辑封面"、"选择封面"等按钮
    const editCoverSelectors = [
      'span', 'button', 'div', 'a', 'label',
      '[class*="edit"]', '[class*="Edit"]',
      '[class*="cover"]', '[class*="Cover"]',
      '[class*="upload"]', '[class*="Upload"]'
    ];

    let editBtn = null;

    // 先通过文本内容精确查找
    const allElements = document.querySelectorAll('span, button, div, a, label');
    for (const el of allElements) {
      // ★ 修复：移除offsetParent限制（封面按钮可能在离屏区域）
      if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;

      const text = (el.textContent || '').trim();
      // 匹配"编辑封面"、"已编辑封面"、"选择封面"等
      if ((text.includes('编辑封面') || text === '已编辑封面' || text.includes('选择封面'))
          && el.children.length < 5   // 避误匹配到大容器
          && text.length < 20) {       // 按钮文字不会太长
        editBtn = el;
        console.log('[PDD监控] 找到封面编辑按钮:', text, el.tagName, el.className?.substring(0, 50));
        break;
      }
    }

    if (!editBtn) {
      // 备用：通过class名称模糊匹配
      for (const sel of editCoverSelectors) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          // ★ 修复：移除offsetParent限制
          if (el.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;
          const cls = el.className || '';
          const text = (el.textContent || '').trim();
          // class包含 cover/edit/upload 且不是大容器
          if ((cls.match(/cover|Cover|edit|upload/i) || text.match(/封面|编辑/))
              && el.offsetWidth < 300 && el.offsetHeight < 100) {
            editBtn = el;
            break;
          }
        }
        if (editBtn) break;
      }
    }

    if (!editBtn) return false;

    // 点击编辑封面按钮
    editBtn.click();
    console.log('[PDD监控] 已点击封面编辑按钮');

    // 等待文件输入框或弹窗出现（可能弹出新窗口、打开系统对话框、或创建隐藏input）
    await new Promise(r => setTimeout(r, 800));

    // 尝试查找新出现的文件输入框（可能是动态创建的）
    const dynamicInputSelectors = [
      'input[type="file"]',
      'input[accept*="image"]',
      'input[accept*="jpg"]',
      'input[accept*="png"]'
    ];

    for (const sel of dynamicInputSelectors) {
      // 反向查找（后添加的元素在后面），优先找动态创建的
      const inputs = Array.from(document.querySelectorAll(sel)).reverse();
      for (const inp of inputs) {
        if (inp.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;

        // 设置文件到这个input
        try {
          const dt = new DataTransfer();
          dt.items.add(coverFile);
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
          if (nativeSetter) {
            nativeSetter.call(inp, dt.files);
          } else {
            inp.files = dt.files;
          }
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('[PDD监控] 已通过动态input设置封面文件');
          return true;
        } catch(e) {
          // 继续尝试下一个input
        }
      }
    }

    // 如果没找到input，可能点击后打开了系统原生对话框
    // 这种情况下我们无法程序化设置文件，但至少已经帮用户点了正确的按钮
    console.log('[PDD监控] 点击了编辑封面按钮但未找到可设置的文件输入框（可能打开了原生对话框）');

    // 尝试用 clipboardData 的方式——某些React组件支持粘贴
    return false;
  }

  // 方案B：直接查找文件输入框
  async function trySetCoverViaFileInput(coverFile) {
    const coverInputSelectors = [
      'input[type="file"][accept*="image"]',
      'input[type="file"][accept*="jpg"]',
      'input[type="file"][accept*="png"]',
      '[class*="cover"] input[type="file"]',
      '[class*="Cover"] input[type="file"]',
      '[class*="poster"] input[type="file"]',
      '[class*="thumb"] input[type="file"]',
      '[class*="upload"] input[type="file"]'
    ];

    for (const sel of coverInputSelectors) {
      const inputs = document.querySelectorAll(sel);
      for (const inp of inputs) {
        // 排除扩展自身的input
        // ★ 修复：移除offsetParent限制（file input通常隐藏，但需要操作）
        if (inp.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;

        try {
          const dt = new DataTransfer();
          dt.items.add(coverFile);
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'files')?.set;
          if (nativeSetter) {
            nativeSetter.call(inp, dt.files);
          } else {
            inp.files = dt.files;
          }
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          console.log('[PDD监控] 找到并设置封面input:', sel);
          return true;
        } catch(e) {
          continue;
        }
      }
    }
    return false;
  }

  // 方案C：通过img元素设置base64
  async function trySetCoverViaImgElement(coverFile) {
    const coverImgSelectors = [
      // 更广泛的选择器
      '[class*="cover"] img', '[class*="Cover"] img',
      '[class*="thumbnail"] img', '[class*="Thumbnail"] img',
      '[class*="poster"] img', '[class*="Poster"] img',
      '[class*="preview"] img', '[class*="Preview"] img',
      '.video-item img', '.video-list img',
      // 默认占位图（通常是灰色背景的默认图）
      'img[src*="default"]', 'img[src*="placeholder"]', 'img[src*="cover"]',
      '[class*="video"] [class*="cover"] img',
      '[class*="video"] [class*="img"] img'
    ];

    for (const sel of coverImgSelectors) {
      try {
        const imgs = document.querySelectorAll(sel);
        for (const img of imgs) {
          // ★ 修复：移除offsetParent限制（封面图可能在离屏区域）
          if (img.closest('#pdd-video-monitor, #pdd-batch-publish-panel, #pdd-auto-upload-panel')) continue;

          // 使用 FileReader 转为 base64 data URL（永不过期）
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('FileReader读取失败'));
            reader.readAsDataURL(coverFile);
          });

          img.src = dataUrl;

          // 触发事件通知框架
          setTimeout(() => {
            img.dispatchEvent(new Event('load', { bubbles: true }));
            // 向父容器传播change事件
            let parent = img.parentElement;
            for (let i = 0; i < 5 && parent; i++) {
              parent.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { type: 'cover-change' } }));
              parent = parent.parentElement;
            }
          }, 100);

          console.log('[PDD监控] 封面已设置到img元素(base64):', sel);
          return true;
        }
      } catch(e) {
        continue;
      }
    }
    return false;
  }

  // 方案D：模拟拖拽上传
  async function trySetCoverViaDragDrop(coverFile) {
    // 查找可能的拖拽目标区域（封面区域）
    const dropTargets = document.querySelectorAll(
      '[class*="cover"], [class*="Cover"], [class*="upload-area"], [class*="drop-zone"], [class*="drag"]'
    );

    for (const target of dropTargets) {
      // ★ 修复：移除offsetParent限制（拖拽区域可能在离屏位置）
      if (target.closest('#pdd-video-monitor, #pdd-batch-publish-panel')) continue;
      // 太大的容器跳过
      if (target.offsetWidth > 500 || target.offsetHeight > 400) continue;

      try {
        const dt = new DataTransfer();
        dt.items.add(coverFile);

        const dragStartEvent = new DragEvent('dragstart', { dataTransfer: dt, bubbles: true });
        const dragOverEvent = new DragEvent('dragover', { dataTransfer: dt, bubbles: true });
        const dropEvent = new DropEvent('drop', { dataTransfer: dt, bubbles: true });

        target.dispatchEvent(dragOverEvent);
        target.dispatchEvent(dropEvent);
        console.log('[PDD监控] 尝试拖拽方式设置封面');
        return true;
      } catch(e) {
        continue;
      }
    }
    return false;
  }
  
  // 查找并点击封面选择区域
  async function selectVideoCover(coverBlob) {
    try {
      // 查找封面选择区域
      const coverSelectors = [
        '[class*="cover"] img',
        '[class*="Cover"] img',
        '[class*="thumbnail"] img',
        '[class*="Thumbnail"] img',
        '.video-item img',
        '[class*="video"] img[class*="preview"]'
      ];
      
      for (const selector of coverSelectors) {
        const coverImg = document.querySelector(selector);
        if (coverImg) {  // ★ 修复：移除offsetParent限制
          console.log('[PDD监控] 找到封面区域:', selector);

          // 点击封面区域，触发封面选择
          coverImg.click();
          await new Promise(r => setTimeout(r, 500));

          // 查找"选择封面"或"编辑封面"按钮
          const allButtons = document.querySelectorAll('button, div[role="button"]');
          for (const btn of allButtons) {
            // ★ 修复：移除offsetParent限制
            const text = btn.textContent || '';
            if (text.includes('选择封面') || text.includes('编辑封面')) {
              btn.click();
              await new Promise(r => setTimeout(r, 500));
              break;
            }
          }

          // 查找"从视频中选择"选项
          for (const btn of allButtons) {
            // ★ 修复：移除offsetParent限制
            const text = btn.textContent || '';
            if (text.includes('从视频中选择') || text.includes('视频帧')) {
              btn.click();
              await new Promise(r => setTimeout(r, 500));
              break;
            }
          }

          console.log('[PDD监控] 封面选择完成');
          return true;
        }
      }
      
      console.log('[PDD监控] 未找到封面选择区域');
      return false;
    } catch (e) {
      console.error('[PDD监控] 封面选择失败:', e);
      return false;
    }
  }
  
  // 自动选择视频封面（从视频文件中截取帧并设置到页面）— 增强版
  async function autoSelectVideoCover(currentVideoFile) {
    const startTime = Date.now();
    try {
      console.log('[PDD监控] ===== 开始自动生成视频封面 =====');
      console.log('[PDD监控] [1/4] 检查视频源...');

      let videoFile = currentVideoFile;
      let preGeneratedCover = null;

      // 检查是否有预生成的封面（上传前预生成的）
      if (!videoFile && pendingUploadConfig?.files?.length > 0) {
        for (const vf of pendingUploadConfig.files) {
          if (vf.coverFile) {
            preGeneratedCover = vf.coverFile;
            videoFile = vf.file || null;
            console.log('[PDD监控] 找到预生成封面:', vf.coverFile.name);
            break;
          }
        }
        if (!preGeneratedCover && !videoFile) {
          videoFile = pendingUploadConfig.files[0]?.file || null;
        }
      }

      // 优先使用预生成的封面文件
      let coverFile = preGeneratedCover;
      if (!coverFile && videoFile) {
        console.log('[PDD监控] [2/4] 实时截取视频帧:', videoFile.name,
                    '大小:', (videoFile.size / 1024 / 1024).toFixed(1), 'MB');
        try {
          // 截帧超时8秒
          coverFile = await captureVideoCoverFromFile(videoFile, 8000);
          console.log('[PDD监控] 视频帧截取成功, 耗时:', ((Date.now() - startTime) / 1000).toFixed(1), 's');
        } catch (e) {
          console.warn('[PDD监控] ⚠️ 截取视频帧失败:', e.message);
        }
      }

      if (!coverFile) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('[PDD监控] ⚠️ 无可用封面，跳过（非致命）耗时:', elapsed, 's');
        showCoverStatusTip('封面生成失败，可手动点击"编辑封面"选择');
        return false;
      }

      // 验证封面文件有效性
      if (coverFile.size < 1000) {
        console.warn('[PDD监控] ⚠️ 封面文件异常小(', coverFile.size, 'bytes)，可能无效');
      }

      console.log('[PDD监控] [3/4] 封面图就绪:', coverFile.name,
                  '大小:', (coverFile.size / 1024).toFixed(1), 'KB');

      // 设置到页面
      console.log('[PDD监控] [4/4] 正在设置封面到页面...');
      const result = await setVideoCoverOnPage(coverFile);

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      if (result) {
        console.log('[PDD监控] ✅ 封面设置成功! 总耗时:', totalElapsed, 's');
        showCoverStatusTip('封面已自动设置 ✓', 'success');
      } else {
        console.log('[PDD监控] ⚠️ 封面设置未成功（非致命，不影响发布）耗时:', totalElapsed, 's');
        showCoverStatusTip('封面未自动设置，可手动点击"编辑封面"', 'warning');
      }
      return result;

    } catch (e) {
      console.error('[PDD监控] ❌ 自动封面异常（非致命）:', e.message);
      showCoverStatusTip('封面设置异常: ' + e.message, 'error');
      return false;
    }
  }

  // 显示封面状态提示（在面板或控制台）
  function showCoverStatusTip(message, type = 'info') {
    try {
      // 尝试在批量发布状态区域显示提示
      const statusEl = document.getElementById('batch-publish-status');
      if (statusEl) {
        const colors = { success: '#2e7d32', warning: '#e65100', error: '#c62828', info: '#1565c0' };
        const prefix = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
        const tipEl = document.createElement('div');
        tipEl.style.cssText = `font-size:11px;color:${colors[type]||colors.info};margin-top:4px;padding:2px 0;`;
        tipEl.textContent = `${prefix[type]||''} ${message}`;
        statusEl.appendChild(tipEl);

        // 10秒后移除提示
        setTimeout(() => { try { tipEl.remove(); } catch(e){} }, 10000);
      }
    } catch(e) {
      // 不影响主流程
    }
  }
  
  // 注意：fillGoodsIdInModal 和 clickNextButton 的异步Promise版本定义在前面（第6043行和第6215行）
  
  // 查找真正的发布按钮
  function findRealPublishButton() {
    // 先尝试备用方案：查找所有按钮，找到包含"发布"文字的
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      if (btn.offsetParent !== null && 
          btn.textContent.includes('发布') &&
          !btn.closest('#pdd-video-monitor') &&
          !btn.closest('#pdd-batch-publish-panel') &&
          !btn.closest('#pdd-auto-upload-panel')) {
        console.log('[PDD监控] 找到发布按钮:', btn.textContent);
        return btn;
      }
    }
    
    // 备用方案：通过 class 查找
    const classSelectors = [
      'button[class*="publish"]',
      'button[class*="submit"]',
      'button[class*="primary"]',
      '.btn-publish',
      '[class*="publish-btn"]'
    ];
    
    for (const selector of classSelectors) {
      try {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
          if (btn.offsetParent !== null && 
              btn.textContent.includes('发布')) {
            console.log('[PDD监控] 找到发布按钮(class):', selector, btn.textContent);
            return btn;
          }
        }
      } catch (e) {
        // 忽略无效选择器错误
      }
    }
    
    console.warn('[PDD监控] 未找到发布按钮');
    return null;
  }
  
  // 监听发布按钮点击
  let isPublishingNow = false; // 防止重复触发
  let isWatchPublishButtonBound = false; // 防止重复绑定事件监听器
  let lastPublishClickTime = 0; // 上次发布点击时间
  
  // 命名的事件处理函数
  function handlePublishButtonClick(e) {
    const target = e.target;
    const publishBtn = target.closest('button');
    
    // 检查是否点击了发布按钮
    if (!publishBtn) return;
    
    const btnText = publishBtn.textContent || '';
    if (!btnText.includes('发布')) return;
    
    // 防抖：500ms内只允许一次点击
    const now = Date.now();
    if (now - lastPublishClickTime < 500) {
      console.log('[PDD监控] 发布按钮点击过于频繁，忽略');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    lastPublishClickTime = now;
    
    // 如果已经在发布中，跳过
    if (isPublishingNow) {
      console.log('[PDD监控] 已在发布中，跳过');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    console.log('[PDD监控] 检测到发布按钮点击，放行');
    
    // 设置发布中标志
    isPublishingNow = true;
    
    // 5秒后重置状态
    setTimeout(() => {
      isPublishingNow = false;
      
      currentPublishIndex++;
      if (currentPublishIndex < batchPublishQueue.length && isBatchPublishing) {
        processNextVideo();
      } else if (isBatchPublishing) {
        completeBatchPublish();
      }
    }, 5000);
    
    // 不阻止默认行为，让发布操作正常执行
  }
  
  function watchPublishButton() {
    console.log('[PDD监控] watchPublishButton 函数被调用');
    
    // 检查是否已经绑定过事件监听器
    if (isWatchPublishButtonBound) {
      console.log('[PDD监控] 发布按钮监听器已绑定，跳过重复绑定');
      return;
    }
    
    // 标记为已绑定
    isWatchPublishButtonBound = true;
    
    // 使用事件委托，在捕获阶段处理
    document.addEventListener('click', handlePublishButtonClick, true);
    
    console.log('[PDD监控] 发布按钮监听器绑定成功');
  }
  
  // 更新批量发布状态
  function updateBatchPublishStatus(status, current, total) {
    const statusEl = document.getElementById('batch-publish-status');
    if (statusEl) {
      statusEl.textContent = status;
    }
    
    const progressBar = document.getElementById('batch-progress-bar');
    if (progressBar) {
      const progress = (current / total) * 100;
      progressBar.style.width = `${progress}%`;
    }
  }
  
  // 完成批量发布
  function completeBatchPublish() {
    isBatchPublishing = false;
    if (batchPublishObserver) {
      batchPublishObserver.disconnect();
      batchPublishObserver = null;
    }
    
    console.log('[PDD监控] 批量发布完成！');
    
    // 更新面板
    updateBatchPublishStatus('✅ 全部完成！', batchPublishQueue.length, batchPublishQueue.length);
    document.getElementById('batch-current-video').textContent = '所有视频已处理';
    document.getElementById('batch-current-goods').textContent = '';
    
    // 通知 popup
    chrome.runtime.sendMessage({
      action: 'publishProgress',
      current: batchPublishQueue.length,
      total: batchPublishQueue.length,
      status: '发布完成',
      detail: '所有视频已发布'
    });
    
    // 3秒后移除面板
    setTimeout(() => {
      const panel = document.getElementById('pdd-batch-publish-panel');
      if (panel) panel.remove();
    }, 5000);
  }
  
  // 设置原生值（支持React/Vue）
  function setNativeValue(element, value) {
    if (!element) {
      console.log('[PDD监控] setNativeValue: 元素为空');
      return;
    }
    
    const valueDescriptor = Object.getOwnPropertyDescriptor(element, 'value');
    const prototype = Object.getPrototypeOf(element);
    const prototypeValueDescriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, 'value') : null;
    
    const valueSetter = valueDescriptor?.set;
    const prototypeValueSetter = prototypeValueDescriptor?.set;
    
    // 先设置值
    element.value = value;
    
    // 尝试使用原生 setter 触发 React/Vue 的响应式更新
    try {
      if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter.call(element, value);
      } else if (valueSetter) {
        valueSetter.call(element, value);
      }
    } catch (e) {
      console.log('[PDD监控] setNativeValue setter 调用失败:', e.message);
    }
    
    // 触发各种事件确保 React/Vue 能检测到变化
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }
  
  // 设置原生文件（支持React/Vue）
  function setNativeFiles(input, files) {
    if (!input) {
      console.log('[PDD监控] setNativeFiles: 元素为空');
      return false;
    }
    
    try {
      const nativeFilesSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype, 'files'
      )?.set;
      
      if (nativeFilesSetter) {
        nativeFilesSetter.call(input, files);
        console.log('[PDD监控] 使用原生 setter 设置 files, 数量:', files.length);
      } else {
        input.files = files;
        console.log('[PDD监控] 使用直接赋值设置 files, 数量:', files.length);
      }
      
      // 触发事件
      input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      return true;
    } catch (e) {
      console.log('[PDD监控] setNativeFiles 失败:', e.message);
      try {
        input.files = files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      } catch (e2) {
        console.log('[PDD监控] 备用设置也失败:', e2.message);
        return false;
      }
    }
  }
  
  // ========== 新版自动填写商品ID功能 ==========
  let autoFillConfig = null;
  let isAutoFilling = false;
  let autoFillObserver = null;
  let filledVideoCount = 0;
  
  // ========== 自动上传功能 ==========
  // 变量已在文件顶部声明
  
  // 开始自动上传
  async function startAutoUpload(config) {
    if (!config || !config.videos || config.videos.length === 0) {
      console.log('[PDD监控] 自动上传配置为空');
      return;
    }
    
    // 保存配置
    autoUploadConfig = config;
    isAutoUploading = true;
    autoUploadIndex = 0;
    
    // 重置已填充视频项的跟踪集合
    window.__pddFilledVideoIndexes = new Set();
    
    console.log('[PDD监控] 开始自动上传，共', config.videos.length, '个视频');
    
    // 创建上传进度面板
    createAutoUploadPanel();
    
    // 开始上传第一个视频
    await uploadNextVideo();
  }
  
  // 显示上传提示
  function showUploadTip(config) {
    // 移除旧提示
    const oldTip = document.getElementById('pdd-upload-tip');
    if (oldTip) oldTip.remove();
    
    // 保存配置，供后续自动填写使用
    autoUploadConfig = config;
    
    const tip = document.createElement('div');
    tip.id = 'pdd-upload-tip';
    tip.innerHTML = `
      <div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99999;background:linear-gradient(135deg,#2196f3 0%,#1976d2 100%);color:white;padding:25px;border-radius:16px;box-shadow:0 8px 32px rgba(33,150,243,0.4);font-size:14px;width:350px;text-align:center;">
        <div style="font-size:48px;margin-bottom:15px;">📹</div>
        <div style="font-weight:700;margin-bottom:15px;font-size:18px;">自动上传准备中</div>
        <div style="background:rgba(255,255,255,0.2);padding:15px;border-radius:10px;margin-bottom:15px;text-align:left;">
          <div style="margin-bottom:8px;"><strong>待上传视频:</strong> ${config.videos.length} 个</div>
          <div><strong>商品ID:</strong> ${config.pidList.join(', ')}</div>
        </div>
        <div style="font-size:12px;opacity:0.9;">
          扩展正在自动上传视频，请稍候...<br>
          如果长时间没有反应，请手动点击页面上的上传按钮。
        </div>
      </div>
    `;
    document.body.appendChild(tip);
    
    // 5秒后自动关闭
    setTimeout(() => {
      if (tip.parentNode) {
        tip.remove();
      }
    }, 5000);
  }
  
  // 自动填写商品信息 - 优化版本，减少延迟
  async function autoFillGoodsInfo(config) {
    console.log('[PDD监控] 开始自动填写商品信息:', config);
    
    // 显示填写进度
    let progressPanel = document.getElementById('pdd-fill-progress');
    if (!progressPanel) {
      progressPanel = document.createElement('div');
      progressPanel.id = 'pdd-fill-progress';
      progressPanel.innerHTML = `
        <div style="position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#4caf50 0%,#388e3c 100%);color:white;padding:15px;border-radius:12px;box-shadow:0 4px 20px rgba(76,175,80,0.4);font-size:12px;width:280px;">
          <div style="font-weight:700;margin-bottom:10px;font-size:14px;">✅ 自动填写商品信息</div>
          <div style="background:rgba(255,255,255,0.2);padding:10px;border-radius:8px;">
            <div><strong>商品ID:</strong> ${config.pidList.join(', ')}</div>
          </div>
          <div id="pdd-fill-status" style="margin-top:10px;font-size:11px;">正在填写...</div>
        </div>
      `;
      document.body.appendChild(progressPanel);
    }
    
    const statusEl = document.getElementById('pdd-fill-status');
    
    try {
      // 1. 点击"选择推广商品"按钮 - 智能等待
      const addGoodsSelectors = [
        '[class*="addGoods"]',
        '[class*="add-goods"]',
        '[class*="选择推广商品"]',
        'button[class*="goods"]'
      ];
      
      const addGoodsBtn = await waitForElement(addGoodsSelectors.join(','), 3000);
      if (addGoodsBtn) {
        console.log('[PDD监控] 找到添加商品按钮:', addGoodsBtn);
        addGoodsBtn.click();
        statusEl.textContent = '正在选择商品...';
        
        // 2. 等待商品选择弹窗出现，然后输入商品ID
        await fillGoodsIdOptimized(config.pidList[0], statusEl);
      }
        
    } catch (e) {
      console.error('[PDD监控] 自动填写失败:', e);
      statusEl.textContent = '❌ 填写失败: ' + e.message;
    }
    
    // 5秒后关闭（从10秒减少）
    setTimeout(() => {
      if (progressPanel && progressPanel.parentNode) {
        progressPanel.remove();
      }
      autoUploadConfig = null;
    }, 5000);
  }
  
  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
      const element = document.querySelector(selector);
      if (element) {  // ★ 修复：移除offsetParent限制（元素存在即可）
        resolve(element);
        return;
      }
      
      const startTime = Date.now();
      let timeoutId = null;
      
      const check = () => {
        const el = document.querySelector(selector);
        if (el) {  // ★ 修复：移除offsetParent限制
          if (timeoutId) clearTimeout(timeoutId);
          resolve(el);
          return;
        }
        
        if (Date.now() - startTime >= timeout) {
          resolve(document.querySelector(selector));
          return;
        }
        
        timeoutId = setTimeout(check, 200);
      };
      
      timeoutId = setTimeout(check, 200);
    });
  }
  
  // 优化的填写商品ID函数
  async function fillGoodsIdOptimized(goodsId, statusEl) {
    console.log('[PDD监控] 开始填写商品ID:', goodsId);
    
    const inputSelectors = [
      'input[placeholder*="商品ID"]',
      'input[placeholder*="商品"]',
      'input[class*="goods"]',
      'input[class*="search"]',
      'input[type="text"]'
    ];
    
    // 智能等待输入框出现
    const input = await waitForElement(inputSelectors.join(','), 3000);
    
    if (input) {  // ★ 修复：移除offsetParent限制
      console.log('[PDD监控] 找到商品ID输入框:', input);
      input.focus();
      input.value = goodsId;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      statusEl.textContent = '✅ 已填写商品ID: ' + goodsId;
      
      // 智能等待搜索按钮
      const searchBtn = await waitForElement('button[class*="search"], [class*="搜索"], button[type="submit"]', 2000);
      if (searchBtn) {
        searchBtn.click();
        statusEl.textContent = '正在搜索商品...';
        
        // 智能等待商品列表
        await selectFirstGoodsOptimized(statusEl);
      }
    } else {
      statusEl.textContent = '❌ 未找到商品ID输入框';
    }
  }
  
  // 优化的选择第一个商品
  async function selectFirstGoodsOptimized(statusEl) {
    console.log('[PDD监控] 开始选择商品');
    
    const goodsSelectors = [
      '[class*="goods-item"]',
      '[class*="goodsItem"]',
      '[class*="product-item"]',
      '[class*="productItem"]',
      'li[class*="item"]'
    ];
    
    // 智能等待商品项出现
    const item = await waitForElement(goodsSelectors.join(','), 3000);
    if (item) {  // ★ 修复：移除offsetParent限制
      console.log('[PDD监控] 找到商品项:', item);
      item.click();
      statusEl.textContent = '✅ 已选择商品';
    } else {
      statusEl.textContent = '❌ 未找到商品项';
    }
  }
  
  // 填写商品ID
  function fillGoodsId(goodsId, statusEl) {
    console.log('[PDD监控] 开始填写商品ID:', goodsId);
    
    // 查找商品ID输入框
    const inputSelectors = [
      'input[placeholder*="商品ID"]',
      'input[placeholder*="商品"]',
      'input[class*="goods"]',
      'input[class*="search"]',
      'input[type="text"]'
    ];
    
    for (const selector of inputSelectors) {
      const inputs = document.querySelectorAll(selector);
      for (const input of inputs) {
        // ★ 修复：移除offsetParent限制
        console.log('[PDD监控] 找到商品ID输入框:', input);
        input.focus();
        input.value = goodsId;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        statusEl.textContent = '✅ 已填写商品ID: ' + goodsId;

        // 点击搜索按钮
        setTimeout(() => {
          const searchBtn = document.querySelector('button[class*="search"], [class*="搜索"], button[type="submit"]');
          if (searchBtn) {
            searchBtn.click();
            statusEl.textContent = '正在搜索商品...';

            // 等待搜索结果，然后选择第一个商品
            setTimeout(() => {
              selectFirstGoods(statusEl);
            }, 1500);
          }
        }, 500);

        return;
      }
    }
    
    statusEl.textContent = '❌ 未找到商品ID输入框';
  }
  
  // 选择第一个商品
  function selectFirstGoods(statusEl) {
    console.log('[PDD监控] 开始选择商品');
    
    // 查找商品列表项
    const goodsSelectors = [
      '[class*="goods-item"]',
      '[class*="goodsItem"]',
      '[class*="product-item"]',
      '[class*="productItem"]',
      'li[class*="item"]'
    ];
    
    for (const selector of goodsSelectors) {
      const items = document.querySelectorAll(selector);
      for (const item of items) {
        // ★ 修复：移除offsetParent限制
        console.log('[PDD监控] 找到商品项:', item);
        item.click();
        statusEl.textContent = '✅ 已选择商品';
        return;
      }
    }
    
    statusEl.textContent = '❌ 未找到商品项';
  }
  
  // 点击上传按钮
  async function clickUploadButton() {
    console.log('[PDD监控] 开始查找上传按钮...');
    
    // 尝试多种选择器找到上传按钮
    const uploadButtonSelectors = [
      '[class*="upload"]',
      '[class*="publish"]',
      'button[class*="add"]',
      '[class*="create"]',
      '[class*="video-btn"]',
      '[class*="uploadBtn"]',
      '[class*="UploadBtn"]',
      '[class*="btn-upload"]',
      '[class*="btnUpload"]',
      'button',
      'a[class*="btn"]',
      '[role="button"]'
    ];
    
    for (const selector of uploadButtonSelectors) {
      try {
        const buttons = document.querySelectorAll(selector);
        console.log('[PDD监控] 选择器', selector, '找到', buttons.length, '个元素');
        for (const btn of buttons) {
          const text = (btn.innerText || btn.textContent || '').trim();
          const className = btn.className || '';
          // 检查文本或类名是否包含上传相关关键词
          if (text.includes('上传') || text.includes('发布') || text.includes('视频') || 
              text.includes('添加') || text.includes('Upload') || text.includes('Publish') ||
              className.includes('upload') || className.includes('publish') || className.includes('add')) {
            console.log('[PDD监控] 找到上传按钮:', btn, '文本:', text, '类名:', className);
            btn.click();
            console.log('[PDD监控] 已点击上传按钮');
            // 等待页面跳转
            await new Promise(resolve => setTimeout(resolve, 2000));
            return true;
          }
        }
      } catch (e) {
        // 忽略选择器错误
      }
    }
    
    console.log('[PDD监控] 未找到上传按钮，请手动点击');
    return false;
  }
  
  // 创建上传进度面板
  function createAutoUploadPanel() {
    const oldPanel = document.getElementById('pdd-auto-upload-panel');
    if (oldPanel) oldPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'pdd-auto-upload-panel';
    panel.innerHTML = `
      <div style="position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#2196f3 0%,#1976d2 100%);color:white;padding:15px;border-radius:12px;box-shadow:0 4px 20px rgba(33,150,243,0.4);font-size:12px;width:280px;">
        <div style="font-weight:700;margin-bottom:12px;font-size:14px;display:flex;align-items:center;gap:6px;">
          📤 自动上传助手
          <span id="auto-upload-progress" style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px;">0/${autoUploadConfig.videos.length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.15);padding:10px;border-radius:8px;margin-bottom:10px;">
          <div style="margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.8);">当前视频</div>
          <div id="auto-upload-current" style="font-weight:600;word-break:break-all;font-size:12px;">准备上传...</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;margin-bottom:4px;color:rgba(255,255,255,0.8);">状态</div>
          <div id="auto-upload-status" style="font-weight:500;">正在准备...</div>
        </div>
        <div style="height:4px;background:rgba(255,255,255,0.2);border-radius:2px;margin-bottom:12px;overflow:hidden;">
          <div id="auto-upload-progress-bar" style="height:100%;background:white;border-radius:2px;width:0%;transition:width 0.3s;"></div>
        </div>
        <button id="auto-upload-stop" style="width:100%;padding:8px;background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">⏹️ 停止上传</button>
      </div>
    `;
    document.body.appendChild(panel);
    
    document.getElementById('auto-upload-stop').onclick = () => {
      isAutoUploading = false;
      document.getElementById('auto-upload-status').textContent = '已停止';
      // 通知 popup 上传已停止
      chrome.storage.local.set({ uploadComplete: true });
    };
  }
  
  // 上传下一个视频
  async function uploadNextVideo() {
    console.log('[PDD监控] uploadNextVideo 被调用，isAutoUploading:', isAutoUploading, 'autoUploadIndex:', autoUploadIndex, 'videos.length:', autoUploadConfig?.videos?.length);
    
    if (!isAutoUploading || autoUploadIndex >= autoUploadConfig.videos.length) {
      console.log('[PDD监控] 上传完成或已停止');
      completeAutoUpload();
      return;
    }
    
    const video = autoUploadConfig.videos[autoUploadIndex];
    console.log('[PDD监控] 准备上传视频:', video.fileName, '商品ID:', video.goodsId, 'filePath:', video.filePath);
    
    // 更新面板
    const currentEl = document.getElementById('auto-upload-current');
    const progressEl = document.getElementById('auto-upload-progress');
    const statusEl = document.getElementById('auto-upload-status');
    const progressBarEl = document.getElementById('auto-upload-progress-bar');
    
    if (currentEl) currentEl.textContent = video.fileName;
    if (progressEl) progressEl.textContent = `${autoUploadIndex + 1}/${autoUploadConfig.videos.length}`;
    if (statusEl) statusEl.textContent = '正在读取视频文件...';
    if (progressBarEl) progressBarEl.style.width = `${(autoUploadIndex / autoUploadConfig.videos.length) * 100}%`;
    
    try {
      // 检查是否有 filePath
      if (!video.filePath) {
        console.error('[PDD监控] 视频配置缺少 filePath');
        if (statusEl) {
          statusEl.textContent = '配置错误: 缺少文件路径，请重新配置';
          statusEl.style.color = '#ff4d4f';
        }
        autoUploadIndex++;
        setTimeout(uploadNextVideo, 2000);
        return;
      }
      
      // 通过 Native Messaging 读取视频文件
      console.log('[PDD监控] 调用 readVideoFileNative，filePath:', video.filePath);
      const videoData = await readVideoFileNative(video.filePath);
      console.log('[PDD监控] readVideoFileNative 返回:', videoData);
      
      if (!videoData.success) {
        console.error('[PDD监控] 读取视频文件失败:', videoData.error);
        if (statusEl) statusEl.textContent = '读取文件失败: ' + videoData.error;
        
        // 如果扩展上下文失效，停止上传并提示刷新
        if (videoData.contextInvalidated) {
          isAutoUploading = false;
          if (statusEl) {
            statusEl.textContent = '扩展已更新或重新加载，请刷新页面后重试';
            statusEl.style.color = '#ff4d4f';
          }
          const progressBarEl = document.getElementById('auto-upload-progress-bar');
          if (progressBarEl) progressBarEl.style.backgroundColor = '#ff4d4f';
          return;
        }
        
        autoUploadIndex++;
        setTimeout(uploadNextVideo, 2000);
        return;
      }
      
      if (statusEl) statusEl.textContent = '正在上传视频...';
      
      // 上传视频到页面
      console.log('[PDD监控] 调用 uploadVideoToPage');
      const fileName = autoUploadConfig?.appendFilenameSuffix ? video.fileName : null;
      // ★ 修复：传递description和contentDeclaration参数
      const desc = video.description || autoUploadConfig?.description || null;
      const decl = video.contentDeclaration || autoUploadConfig?.contentDeclaration || null;
      await uploadVideoToPage(videoData, video.goodsId, fileName, desc, decl);
      
      autoUploadIndex++;
      setTimeout(uploadNextVideo, 3000);
      
    } catch (err) {
      console.error('[PDD监控] 上传失败:', err);
      const errorMsg = err.message || String(err);
      const isContextInvalidated = errorMsg.includes('Extension context invalidated');
      
      if (statusEl) {
        statusEl.textContent = isContextInvalidated ? '扩展已更新或重新加载，请刷新页面后重试' : '上传失败: ' + errorMsg;
        if (isContextInvalidated) statusEl.style.color = '#ff4d4f';
      }
      
      // 如果扩展上下文失效，停止上传
      if (isContextInvalidated) {
        isAutoUploading = false;
        const progressBarEl = document.getElementById('auto-upload-progress-bar');
        if (progressBarEl) progressBarEl.style.backgroundColor = '#ff4d4f';
        return;
      }
      
      autoUploadIndex++;
      setTimeout(uploadNextVideo, 2000);
    }
  }
  
  // 将 File 对象转换为 base64
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  
  // 通过 Native Messaging 读取视频文件
  function readVideoFileNative(filePath) {
    console.log('[PDD监控] readVideoFileNative 被调用，filePath:', filePath);
    return new Promise((resolve) => {
      // 检查扩展上下文是否有效
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        console.error('[PDD监控] 扩展上下文已失效');
        resolve({ success: false, error: '扩展上下文已失效，请刷新页面后重试', contextInvalidated: true });
        return;
      }
      
      // 设置超时，防止消息发送后没有响应
      let timeoutId;
      let isResolved = false;
      
      const safeResolve = (result) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          resolve(result);
        }
      };
      
      timeoutId = setTimeout(() => {
        console.error('[PDD监控] readLocalFile 请求超时');
        safeResolve({ success: false, error: '读取文件超时，请检查扩展是否正常运行' });
      }, 30000); // 30秒超时
      
      console.log('[PDD监控] 发送 readLocalFile 消息');
      try {
        chrome.runtime.sendMessage({
          action: 'readLocalFile',
          filePath: filePath
        }, (response) => {
          if (isResolved) return; // 已经超时了
          
          if (chrome.runtime.lastError) {
            const errorMsg = chrome.runtime.lastError.message;
            console.log('[PDD监控] readLocalFile 错误:', errorMsg);
            const isContextInvalidated = errorMsg && errorMsg.includes('Extension context invalidated');
            safeResolve({ 
              success: false, 
              error: isContextInvalidated ? '扩展上下文已失效，请刷新页面后重试' : errorMsg,
              contextInvalidated: isContextInvalidated
            });
          } else {
            console.log('[PDD监控] readLocalFile 响应:', response);
            safeResolve(response || { success: false, error: '无响应' });
          }
        });
      } catch (err) {
        console.error('[PDD监控] 发送消息失败:', err);
        const isContextInvalidated = err.message && err.message.includes('Extension context invalidated');
        safeResolve({ 
          success: false, 
          error: isContextInvalidated ? '扩展上下文已失效，请刷新页面后重试' : '发送消息失败: ' + err.message,
          contextInvalidated: isContextInvalidated
        });
      }
    });
  }
  
  // 上传视频到页面
  async function uploadVideoToPage(videoData, goodsId, fileName = null, description = null, contentDeclaration = null) {
    return new Promise(async (resolve, reject) => {
      try {
        // 将 base64 转换为 File 对象
        const binaryString = atob(videoData.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: videoData.fileType || 'video/mp4' });
        const file = new File([blob], videoData.fileName, { type: videoData.fileType || 'video/mp4' });
        
        console.log('[PDD监控] 准备上传视频:', videoData.fileName, 'fileName:', fileName);
        
        // 方式1：尝试模拟拖拽上传
        const uploadArea = document.querySelector('.no-video_noVideoWrap__opXQS, [class*="no-video"], [class*="upload-area"], [class*="drop-zone"]');
        
        if (uploadArea) {
          console.log('[PDD监控] 找到上传区域，尝试模拟拖拽上传');
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          
          // 触发拖拽事件
          uploadArea.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer }));
          uploadArea.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer }));
          uploadArea.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
          
          console.log('[PDD监控] 拖拽事件已触发');
          
          // 等待视频上传完成
          waitForVideoUploadComplete(goodsId, resolve, fileName, description, contentDeclaration);
          return;
        }

        // 方式2：查找文件 input 并直接设置
        let fileInput = findFileInput();
        
        if (fileInput) {
          console.log('[PDD监控] 找到文件 input，直接设置文件');
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          setNativeFiles(fileInput, dataTransfer.files);
          
          console.log('[PDD监控] 文件已设置到 input:', videoData.fileName);
          
          // 等待视频上传完成
          waitForVideoUploadComplete(goodsId, resolve, fileName, description, contentDeclaration);
          return;
        }

        // 方式3：等待文件 input 出现
        let inputRetryCount = 0;
        const inputMaxRetries = 5;
        
        while (!fileInput && inputRetryCount < inputMaxRetries) {
          inputRetryCount++;
          console.log(`[PDD监控] 等待文件 input... (${inputRetryCount}/${inputMaxRetries})`);
          await new Promise(r => setTimeout(r, 1000));
          fileInput = findFileInput();
        }
        
        if (fileInput) {
          console.log('[PDD监控] 找到文件 input，直接设置文件');
          
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          setNativeFiles(fileInput, dataTransfer.files);
          
          console.log('[PDD监控] 文件已设置到 input:', videoData.fileName);
          
          // 等待视频上传完成
          waitForVideoUploadComplete(goodsId, resolve, fileName, description, contentDeclaration);
          return;
        }

        // 方式4：最后尝试点击上传按钮
        const uploadBtn = findUploadButton();
        
        if (uploadBtn) {
          console.log('[PDD监控] 最后尝试点击上传按钮');
          window.__pddAutoUploading = true;
          uploadBtn.click();
          await new Promise(r => setTimeout(r, 500));
          window.__pddAutoUploading = false;
          
          fileInput = findFileInput();
          if (fileInput) {
            console.log('[PDD监控] 点击后找到文件 input');
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            setNativeFiles(fileInput, dataTransfer.files);
            
            console.log('[PDD监控] 文件已设置到 input:', videoData.fileName);
            
            waitForVideoUploadComplete(goodsId, resolve, fileName, description, contentDeclaration);
          } else {
            reject(new Error('点击后仍未找到文件输入框'));
          }
        } else {
          reject(new Error('未找到上传入口'));
        }
      } catch (err) {
        reject(err);
      }
    });
  }
  
  // 等待视频上传完成
  async function waitForVideoUploadComplete(goodsId, resolve, fileName = null, description = null, contentDeclaration = null) {
    let attempts = 0;
    const maxAttempts = 180; // 增加到3分钟
    let isProcessing = false;
    
    if (!window.__pddFilledVideoIndexes) {
      window.__pddFilledVideoIndexes = new Set();
    }
    
    let lastVideoCount = 0;
    let stableCount = 0;
    
    const checkInterval = setInterval(async () => {
      if (isProcessing) return;
      isProcessing = true;
      
      try {
        attempts++;
        
        const videoItems = document.querySelectorAll('[class*="video-list_item"], [class*="videoList_item"], [class*="video-item-wrap"], [class*="videoItemWrap"]');
        
        // 检查视频数量是否稳定
        if (videoItems.length > 0 && videoItems.length === lastVideoCount) {
          stableCount++;
        } else if (videoItems.length !== lastVideoCount) {
          stableCount = 0;
          lastVideoCount = videoItems.length;
        }
        
        if (attempts % 15 === 0) {
          console.log('[PDD监控] 检查视频项，找到:', videoItems.length, '个，已填充:', window.__pddFilledVideoIndexes.size, '稳定次数:', stableCount);
        }
        
        if (videoItems.length > 0 && stableCount >= 5) { // 连续5次检测到相同数量才认为稳定
          let targetVideo = null;
          let targetIndex = -1;
          
          for (let i = 0; i < videoItems.length; i++) {
            if (!window.__pddFilledVideoIndexes.has(i)) {
              const item = videoItems[i];
              // ★ 修复：不再要求按钮在可视区内
              const addGoodsBtn = item.querySelector('[class*="AddGoods"], [class*="addGoods"], [class*="add-goods"]');
              if (addGoodsBtn) {
                targetVideo = item;
                targetIndex = i;
                
                // 额外检查：确保视频有预览图或封面（不是灰色占位图）
                const coverImg = item.querySelector('img[class*="cover"], img[class*="thumbnail"]');
                const hasValidCover = coverImg && coverImg.src && !coverImg.src.includes('data:image') && 
                                     coverImg.naturalWidth > 10; // 确保图片已加载
                
                if (!hasValidCover && attempts < maxAttempts - 30) {
                  // 如果没有有效封面，继续等待
                  if (attempts % 15 === 0) {
                    console.log('[PDD监控] 视频上传完成但封面未生成，继续等待...');
                  }
                  targetVideo = null;
                  targetIndex = -1;
                  break;
                }
                
                break;
              }
            }
          }
          
          if (targetVideo && targetIndex >= 0) {
            clearInterval(checkInterval);
            const idx = activeResources.intervals.indexOf(checkInterval);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            
            window.__pddFilledVideoIndexes.add(targetIndex);
            
            // 额外等待一下确保视频完全处理完成
            await new Promise(r => setTimeout(r, 2500));
            
            const statusEl = document.getElementById('auto-upload-status');
            if (statusEl) statusEl.textContent = '填写商品信息中...';
            
            try {
              const success = await fillGoodsIdForVideo(targetVideo, goodsId, description, contentDeclaration);
              if (success) {
                if (statusEl) statusEl.textContent = '商品信息填写完成';
              } else {
                // 填充失败，移除标记允许重试
                window.__pddFilledVideoIndexes.delete(targetIndex);
                if (statusEl) statusEl.textContent = '商品信息填写失败，将在下次重试';
                console.log('[PDD监控] 商品ID填充失败，已移除标记，允许重试');
              }
            } catch (e) {
              console.error('[PDD监控] 商品信息填写失败:', e);
              if (statusEl) statusEl.textContent = '商品信息填写失败: ' + e.message;
              // 移除标记允许重试
              window.__pddFilledVideoIndexes.delete(targetIndex);
            }
            
            resolve();
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          const idx = activeResources.intervals.indexOf(checkInterval);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          
          // 即使超时也尝试处理最后一个视频
          const videoItems = document.querySelectorAll('[class*="video-list_item"], [class*="videoList_item"], [class*="video-item-wrap"], [class*="videoItemWrap"]');
          if (videoItems.length > 0) {
            const lastVideo = videoItems[videoItems.length - 1];
            const addGoodsBtn = lastVideo.querySelector('[class*="AddGoods"], [class*="addGoods"]');
            // ★ 修复：按钮存在即可（不再要求可视）
            if (addGoodsBtn) {
              try {
                await fillGoodsIdForVideo(lastVideo, goodsId, description, contentDeclaration);
              } catch (e) {
                console.error('[PDD监控] 超时后填写失败:', e);
              }
            }
          }
          
          resolve();
        }
      } finally {
        isProcessing = false;
      }
    }, 1500); // 增加检查间隔到1.5秒
    
    activeResources.intervals.push(checkInterval);
  }
  
  // 完成自动上传
  function completeAutoUpload() {
    isAutoUploading = false;
    console.log('[PDD监控] 自动上传完成！');

    // 清除填充跟踪
    window.__pddFilledVideoIndexes = new Set();

    // 通知 popup 上传完成
    chrome.storage.local.set({ uploadComplete: true });

    // ★★★ 关键：上传完成后强制重新检查页面类型 ★★★
    // 解决问题：上传完成后页面可能已跳转到数据监控页，但视图还是upload
    console.log('[PDD监控] 上传完成，强制重新检查页面类型...');
    if (typeof autoSwitchViewByPage === 'function') {
      setTimeout(() => {
        autoSwitchViewByPage();
      }, 1000);  // 延迟1秒确保页面跳转完成
    }
    
    const statusEl = document.getElementById('auto-upload-status');
    const progressBarEl = document.getElementById('auto-upload-progress-bar');
    
    if (statusEl) {
      statusEl.textContent = '✅ 全部完成！';
      statusEl.style.color = '#52c41a';
      statusEl.style.fontSize = '16px';
    }
    
    if (progressBarEl) {
      progressBarEl.style.width = '100%';
      progressBarEl.style.backgroundColor = '#52c41a';
    }
    
    // 显示完成通知
    showCompletionNotification();
    
    // 5秒后移除面板
    setTimeout(() => {
      const panel = document.getElementById('pdd-auto-upload-panel');
      if (panel) panel.remove();
    }, 5000);
  }
  
  // 显示完成通知
  function showCompletionNotification() {
    // 创建通知弹窗
    const notification = document.createElement('div');
    notification.id = 'pdd-upload-complete-notification';
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
      color: white;
      padding: 30px 50px;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      z-index: 999999;
      text-align: center;
      animation: pddNotificationPop 0.5s ease-out;
    `;
    
    notification.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 15px;">✅</div>
      <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">上传完成！</div>
      <div style="font-size: 14px; opacity: 0.9;">所有视频已成功上传并填充商品信息</div>
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pddNotificationPop {
        0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // 3秒后自动关闭
    setTimeout(() => {
      notification.style.animation = 'pddNotificationPop 0.3s ease-in reverse';
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 3000);
  }
  
  // 开始自动填写
  function startAutoFill(config) {
    // 兼容 pidList 和 goodsIds 两种属性名
    const goodsIds = config.goodsIds || config.pidList || [];
    
    if (!config || goodsIds.length === 0) {
      console.log('[PDD监控] 自动填写配置为空');
      return;
    }
    
    autoFillConfig = config;
    autoFillConfig.goodsIds = goodsIds; // 统一使用 goodsIds
    isAutoFilling = true;
    filledVideoCount = 0;
    
    console.log('[PDD监控] 开始自动填写商品ID，共', goodsIds.length, '个');
    // console.log('[PDD监控] 商品ID列表:', goodsIds);
    
    // 创建控制面板
    createAutoFillPanel();
    
    // 开始监听页面上的视频
    startVideoWatcher();
  }
  
  // 停止自动填写
  function stopAutoFill() {
    isAutoFilling = false;
    // 清理 MutationObserver
    if (autoFillObserver) {
      autoFillObserver.disconnect();
      autoFillObserver = null;
    }
    // 清理 setInterval
    if (window._pddVideoWatcherInterval) {
      clearInterval(window._pddVideoWatcherInterval);
      window._pddVideoWatcherInterval = null;
    }
    console.log('[PDD监控] 自动填写已停止');
  }
  
  // 创建自动填写控制面板
  function createAutoFillPanel() {
    const oldPanel = document.getElementById('pdd-auto-fill-panel');
    if (oldPanel) oldPanel.remove();
    
    const panel = document.createElement('div');
    panel.id = 'pdd-auto-fill-panel';
    panel.innerHTML = `
      <div style="position:fixed;top:10px;right:10px;z-index:99999;background:linear-gradient(135deg,#4caf50 0%,#45a049 100%);color:white;padding:15px;border-radius:12px;box-shadow:0 4px 20px rgba(76,175,80,0.4);font-size:12px;width:260px;">
        <div style="font-weight:700;margin-bottom:12px;font-size:14px;display:flex;align-items:center;gap:6px;">
          🤖 自动填写助手
          <span id="auto-fill-progress" style="background:rgba(255,255,255,0.25);padding:2px 8px;border-radius:10px;font-size:11px;">0/${autoFillConfig.goodsIds.length}</span>
        </div>
        <div style="background:rgba(255,255,255,0.15);padding:10px;border-radius:8px;margin-bottom:10px;">
          <div style="margin-bottom:6px;font-size:11px;color:rgba(255,255,255,0.8);">当前商品ID</div>
          <div id="auto-fill-current" style="font-weight:600;font-size:13px;word-break:break-all;">${autoFillConfig.goodsIds[0]}</div>
        </div>
        <div style="margin-bottom:10px;">
          <div style="font-size:11px;margin-bottom:4px;color:rgba(255,255,255,0.8);">状态</div>
          <div id="auto-fill-status" style="font-weight:500;">等待视频上传...</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button id="auto-fill-next" style="flex:1;padding:8px;background:rgba(255,255,255,0.25);border:none;border-radius:6px;color:white;cursor:pointer;font-weight:600;font-size:12px;">⏭️ 跳过</button>
          <button id="auto-fill-stop" style="flex:1;padding:8px;background:rgba(255,255,255,0.15);border:none;border-radius:6px;color:white;cursor:pointer;font-size:12px;">⏹️ 停止</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    
    // 绑定按钮事件
    document.getElementById('auto-fill-next').onclick = () => {
      filledVideoCount++;
      if (filledVideoCount < autoFillConfig.goodsIds.length) {
        updateAutoFillPanel();
        notifyProgress();
      } else {
        completeAutoFill();
      }
    };
    
    document.getElementById('auto-fill-stop').onclick = stopAutoFill;
  }
  
  // 更新面板显示
  function updateAutoFillPanel() {
    const progressEl = document.getElementById('auto-fill-progress');
    const currentEl = document.getElementById('auto-fill-current');
    const statusEl = document.getElementById('auto-fill-status');
    
    if (progressEl) {
      progressEl.textContent = `${filledVideoCount + 1}/${autoFillConfig.goodsIds.length}`;
    }
    if (currentEl && filledVideoCount < autoFillConfig.goodsIds.length) {
      currentEl.textContent = autoFillConfig.goodsIds[filledVideoCount];
    }
    if (statusEl) {
      statusEl.textContent = '等待视频上传...';
    }
  }
  
  // 开始监听视频 - 优化版本（移除MutationObserver，使用setInterval避免闪屏）
  function startVideoWatcher() {
    // 清理旧的定时器
    if (window._pddVideoWatcherInterval) {
      clearInterval(window._pddVideoWatcherInterval);
    }
    
    // 用于跟踪已处理的视频元素
    const processedVideos = new Set();
    let isProcessing = false;
    
    // 检查函数
    function checkVideos() {
      if (!isAutoFilling || filledVideoCount >= autoFillConfig.goodsIds.length || isProcessing) {
        return;
      }
      
      isProcessing = true;
      
      try {
        // 查找所有视频项 - 只查询具体类名
        const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4');
        
        for (const item of videoItems) {
          // 检查是否已经处理过
          const itemId = item.getAttribute('data-key') || item.dataset.id;
          if (!itemId || processedVideos.has(itemId)) {
            continue;
          }
          
          // 检查是否已填写商品ID（通过查找"添加商品"按钮是否还在）
          const addGoodsBtn = item.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF');

          // ★ 修复：按钮存在即表示未填写（不再要求可视）
          if (addGoodsBtn) {
            // 未填写商品ID，进行填写
            const goodsId = autoFillConfig.goodsIds[filledVideoCount];
            if (goodsId) {
              console.log('[PDD监控] 为视频填写商品ID:', goodsId);
              // ★ 传递内容声明和描述配置
              const desc = autoFillConfig.description || null;
              const decl = autoFillConfig.contentDeclaration || null;
              fillGoodsIdForVideo(item, goodsId, desc, decl);
              processedVideos.add(itemId);
              
              // 更新状态
              const statusEl = document.getElementById('auto-fill-status');
              if (statusEl) {
                statusEl.textContent = '已填写商品ID，等待发布...';
              }
              break; // 一次只处理一个
            }
          }
        }
      } finally {
        isProcessing = false;
      }
    }
    
    window._pddVideoWatcherInterval = setInterval(() => {
      checkVideos();
    }, 5000);
    activeResources.intervals.push(window._pddVideoWatcherInterval);
    
    // 延迟检查一次，给页面加载时间
    setTimeout(() => {
      const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4');
      if (videoItems.length > 0) {
        console.log('[PDD监控] 页面上已有', videoItems.length, '个视频');
        checkVideos();
      }
    }, 1500);
  }
  
  // 注意：fillGoodsIdForVideo 和 fillGoodsIdInModal 的异步Promise版本定义在前面（第5939行和第6069行）
  
  // 点击弹窗中的下一步按钮
  function clickNextButtonInModal(modal) {
    console.log('[PDD监控] clickNextButtonInModal 开始，当前模态框:', modal);
    
    // 先尝试选择器
    const nextBtnSelectors = [
      'button[data-testid="beast-core-modal-ok-button"]',
      '.MDL_okBtn_5-180-0',
      'button[class*="ok"]',
      'button[class*="primary"]'
    ];
    
    let nextBtn = null;
    for (const selector of nextBtnSelectors) {
      const btn = modal.querySelector(selector);
      console.log('[PDD监控] 选择器:', selector, '找到:', btn ? '是' : '否', 'disabled:', btn?.disabled, '可见:', btn?.offsetParent !== null);
      if (btn && !btn.disabled) {  // ★ 修复：移除offsetParent限制
        nextBtn = btn;
        console.log('[PDD监控] 找到可点击按钮:', selector, btn.textContent?.trim());
        break;
      }
    }

    // 如果选择器没找到，尝试通过文本查找
    if (!nextBtn) {
      const allButtons = modal.querySelectorAll('button');
      console.log('[PDD监控] 模态框中按钮总数:', allButtons.length);
      for (const btn of allButtons) {
        if (!btn.disabled) {  // ★ 修复：移除offsetParent限制
          const text = btn.textContent.trim();
          console.log('[PDD监控] 检查按钮:', text);
          if (text.includes('下一步') || text.includes('确认') || text.includes('确定')) {
            nextBtn = btn;
            console.log('[PDD监控] 通过文本找到按钮:', text);
            break;
          }
        }
      }
    }
    
    if (nextBtn) {
      console.log('[PDD监控] 点击下一步按钮');
      nextBtn.click();
      
      // 等待检查模态框是否关闭
      setTimeout(() => {
        const modalStillOpen = document.querySelector('.MDL_inner_5-180-0, [class*="modal"]:not([class*="mask"]), [class*="Modal"]');
        if (modalStillOpen) {  // ★ 修复：移除offsetParent限制
          console.log('[PDD监控] 警告: 模态框仍然打开，可能需要重新尝试');
          // 检查当前是否在商品ID Tab
          const goodsIdInput = modalStillOpen.querySelector('input[placeholder*="商品ID"], input[placeholder*="商品id"]');
          if (!goodsIdInput) {
            console.log('[PDD监控] 未找到商品ID输入框，可能Tab未切换成功');
          }
        } else {
          console.log('[PDD监控] 模态框已关闭，操作成功');
          // 增加计数并通知
          filledVideoCount++;
          notifyProgress();
          
          // 更新面板
          if (filledVideoCount < autoFillConfig.goodsIds.length) {
            updateAutoFillPanel();
          } else {
            completeAutoFill();
          }
        }
      }, 1000);
      
      return true;
    }
    
    console.log('[PDD监控] 未找到下一步按钮');
    return false;
  }
  
  // 通知进度
  function notifyProgress() {
    if (!autoFillConfig) return;
    
    const current = Math.min(filledVideoCount, autoFillConfig.goodsIds.length);
    const total = autoFillConfig.goodsIds.length;
    const currentGoodsId = autoFillConfig.goodsIds[Math.min(filledVideoCount, total - 1)] || '';
    
    chrome.runtime.sendMessage({
      action: 'autoFillProgress',
      current: current,
      total: total,
      goodsId: currentGoodsId,
      status: current >= total ? '完成' : '填写中...'
    });
  }
  
  // 完成自动填写
  function completeAutoFill() {
    isAutoFilling = false;
    if (autoFillObserver) {
      autoFillObserver.disconnect();
      autoFillObserver = null;
    }
    
    console.log('[PDD监控] 自动填写完成！');
    
    // 更新面板
    const statusEl = document.getElementById('auto-fill-status');
    if (statusEl) {
      statusEl.textContent = '✅ 全部完成！';
    }
    
    // 通知 popup
    notifyProgress();
    
    // 3秒后移除面板
    setTimeout(() => {
      const panel = document.getElementById('pdd-auto-fill-panel');
      if (panel) panel.remove();
    }, 3000);
  }
  
  // ========== 视频自动上传功能 ==========
  let isUploading = false;
  let uploadQueue = [];
  let currentUploadIndex = 0;
  
  // 处理上传请求
  async function handleUploadRequest(video, index, total) {
    console.log('[PDD监控] 收到上传请求:', video.fileName, '商品ID:', video.goodsId);
    
    try {
      // 1. 查找文件 input（先等待，不主动点击）
      let fileInput = findFileInput();
      let retryCount = 0;
      const maxRetries = 5;
      
      while (!fileInput && retryCount < maxRetries) {
        retryCount++;
        console.log(`[PDD监控] 等待文件 input... (${retryCount}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 1000));
        fileInput = findFileInput();
      }
      
      // 2. 如果还没找到，最后尝试点击上传按钮
      if (!fileInput) {
        const uploadBtn = findUploadButton();
        if (!uploadBtn) {
          console.error('[PDD监控] 未找到上传按钮');
          notifyUploadError('未找到上传按钮');
          return;
        }
        
        console.log('[PDD监控] 最后尝试点击上传按钮');
        window.__pddAutoUploading = true;
        uploadBtn.click();
        await new Promise(r => setTimeout(r, 500));
        window.__pddAutoUploading = false;
        
        fileInput = findFileInput();
      }
      
      if (!fileInput) {
        console.error('[PDD监控] 未找到文件输入框');
        notifyUploadError('未找到文件输入框');
        return;
      }
      
      // 4. 创建 File 对象并设置
      const file = createFileFromData(video.fileData, video.fileName, video.fileType);
      
      // 5. 使用 DataTransfer 设置文件 - React 兼容方式
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      setNativeFiles(fileInput, dataTransfer.files);
      
      console.log('[PDD监控] 文件已设置到 input:', video.fileName);
      notifyUploadProgress(video.fileName, '文件已选择，等待上传...');
      
      // 7. 等待上传完成并填写商品ID
      await waitForVideoUploadAndFillGoodsId(video.goodsId);
      
    } catch (err) {
      console.error('[PDD监控] 上传处理失败:', err);
      notifyUploadError(err.message);
    }
  }
  
  // 查找上传按钮
  function findUploadButton() {
    console.log('[PDD监控] findUploadButton 开始查找');
    
    // 调试：打印页面上的所有按钮
    const allBtnsDebug = document.querySelectorAll('button, div[role="button"], [class*="btn"], [class*="button"]');
    console.log('[PDD监控] 页面上按钮总数:', allBtnsDebug.length);
    
    // 收集所有按钮的文本信息用于调试
    const visibleButtons = [];
    allBtnsDebug.forEach((btn, idx) => {
      const text = (btn.textContent || btn.innerText || '').trim();
      const className = btn.className || '';
      if (text || className.includes('add') || className.includes('Add') || className.includes('upload') || className.includes('Upload')) {
        visibleButtons.push({ idx, text: text.slice(0, 50), className: className.slice(0, 100) });
      }
    });
    console.log('[PDD监控] 可见按钮列表:', visibleButtons.slice(0, 20)); // 只打印前20个
    
    // 首先尝试查找"添加视频"或"继续添加"按钮（当已有视频时）
    const addMoreSelectors = [
      '.video-list_addVideo__Z5Cwo',
      '[class*="addVideo"]',
      '[class*="AddVideo"]',
      '[class*="add-video"]',
      '[class*="continue-add"]',
      '[class*="addMore"]',
      '.video-list [class*="add"]',
      '[class*="video-list"] [class*="add"]',
      '.RC-VideoList [class*="add"]',
      '[class*="VideoList"] [class*="add"]'
    ];
    
    for (const selector of addMoreSelectors) {
      try {
        const btns = document.querySelectorAll(selector);
        console.log('[PDD监控] 尝试选择器:', selector, '找到:', btns.length);
        for (const btn of btns) {
          if (btn) {  // ★ 修复：移除offsetParent限制
            console.log('[PDD监控] findUploadButton 找到添加更多视频按钮:', selector, btn);
            return btn;
          }
        }
      } catch (e) {
        // 忽略无效选择器
      }
    }
    
    // 然后尝试查找初始上传按钮（当没有视频时）
    const initialSelectors = [
      '.no-video_noVideoWrap__opXQS button',
      '.no-video_uploadImg__aYTLk',
      '[class*="no-video"] button',
      '[class*="empty"] button'
    ];
    
    for (const selector of initialSelectors) {
      try {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
          if (btn) {  // ★ 修复：移除offsetParent限制
            console.log('[PDD监控] findUploadButton 找到初始上传按钮:', selector, btn);
            return btn;
          }
        }
      } catch (e) {
        // 忽略无效选择器
      }
    }
    
    // 通过文本查找 - 更宽松的匹配
    const allButtons = document.querySelectorAll('button, div[role="button"], [class*="btn"], a[role="button"]');
    console.log('[PDD监控] 通过文本查找，检查按钮数:', allButtons.length);

    for (const btn of allButtons) {
      // ★ 修复：移除offsetParent限制
      const text = (btn.textContent || btn.innerText || '').trim();
      // 优先查找"添加"相关按钮
      if (text.includes('添加视频') || text.includes('继续添加') || text.includes('添加更多') || text.includes('添加')) {
        console.log('[PDD监控] findUploadButton 通过文本找到(添加):', text, btn);
        return btn;
      }
    }

    // 最后尝试"上传"相关按钮
    for (const btn of allButtons) {
      // ★ 修复：移除offsetParent限制
      const text = (btn.textContent || btn.innerText || '').trim();
      if (text.includes('上传视频') || text.includes('上传')) {
        console.log('[PDD监控] findUploadButton 通过文本找到(上传):', text, btn);
        return btn;
      }
    }

    // 最后的尝试：查找任何包含"视频"或"video"的按钮
    for (const btn of allButtons) {
      // ★ 修复：移除offsetParent限制
      const text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
      const className = (btn.className || '').toLowerCase();
      if (text.includes('视频') || text.includes('video') || className.includes('video')) {
        console.log('[PDD监控] findUploadButton 通过视频关键词找到:', text || className, btn);
        return btn;
      }
    }
    
    console.log('[PDD监控] findUploadButton 未找到');
    return null;
  }
  
  // 滚动查找上传按钮（用于视频列表较长时）
  async function findUploadButtonWithScroll() {
    console.log('[PDD监控] findUploadButtonWithScroll 开始');
    
    // 首先尝试直接查找
    let btn = findUploadButton();
    if (btn) return btn;
    
    // 获取视频列表容器
    const videoListContainers = [
      '.video-list_listWrap__8Z7cX',
      '[class*="video-list"]',
      '.RC-VideoList',
      '[class*="VideoList"]'
    ];
    
    let container = null;
    for (const selector of videoListContainers) {
      container = document.querySelector(selector);
      if (container) break;
    }
    
    if (container) {
      console.log('[PDD监控] 找到视频列表容器，尝试滚动');
      
      // 保存当前滚动位置
      const originalScrollTop = container.scrollTop;
      
      // 滚动到底部查找添加按钮
      container.scrollTop = container.scrollHeight;
      await new Promise(r => setTimeout(r, 500));
      
      btn = findUploadButton();
      if (btn) {
        console.log('[PDD监控] 滚动后找到上传按钮');
        return btn;
      }
      
      // 恢复滚动位置
      container.scrollTop = originalScrollTop;
    }
    
    // 尝试滚动页面主体
    console.log('[PDD监控] 尝试滚动页面主体');
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise(r => setTimeout(r, 500));
    
    btn = findUploadButton();
    if (btn) {
      console.log('[PDD监控] 页面滚动后找到上传按钮');
      return btn;
    }
    
    return null;
  }
  
  // 查找文件 input
  function findFileInput() {
    console.log('[PDD监控] findFileInput 开始查找');
    
    const selectors = [
      'input[type="file"][accept*="video"]',
      'input[type="file"]',
      '[class*="upload"] input[type="file"]',
      '[class*="video"] input[type="file"]'
    ];
    
    for (const selector of selectors) {
      try {
        const inputs = document.querySelectorAll(selector);
        for (const input of inputs) {
          // input[type="file"] 可能是隐藏的，所以不检查 offsetParent
          console.log('[PDD监控] findFileInput 找到:', selector, input);
          return input;
        }
      } catch (e) {
        // 忽略无效选择器
      }
    }
    
    console.log('[PDD监控] findFileInput 未找到');
    return null;
  }
  
  // 从数据创建 File 对象
  function createFileFromData(fileData, fileName, fileType) {
    // 将数组转换回 Uint8Array
    const uint8Array = new Uint8Array(fileData);
    const blob = new Blob([uint8Array], { type: fileType });
    return new File([blob], fileName, { type: fileType });
  }
  
  // 等待视频上传完成并填写商品ID
  async function waitForVideoUploadAndFillGoodsId(goodsId) {
    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 60;
      
      const checkInterval = setInterval(() => {
        attempts++;
        
        const videoItems = document.querySelectorAll('.video-list_itemWrap__7xLB4, [class*="video-list_item"]');
        
        if (videoItems.length > 0) {
          const lastVideo = videoItems[videoItems.length - 1];
          
          const addGoodsBtn = lastVideo.querySelector('.AddGoodsTrigger_addGoodsTrigger__nbdhF, [class*="AddGoods"]');

          // ★ 修复：按钮存在即可（不再要求可视）
          if (addGoodsBtn) {
            clearInterval(checkInterval);
            const idx = activeResources.intervals.indexOf(checkInterval);
            if (idx > -1) activeResources.intervals.splice(idx, 1);
            
            fillGoodsIdForVideo(lastVideo, goodsId, description, contentDeclaration);
            
            notifyUploadComplete();
            resolve();
            return;
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          const idx = activeResources.intervals.indexOf(checkInterval);
          if (idx > -1) activeResources.intervals.splice(idx, 1);
          notifyUploadError('等待上传超时');
          resolve();
        }
      }, 1000);
      
      activeResources.intervals.push(checkInterval);
    });
  }
  
  // 通知上传进度
  function notifyUploadProgress(fileName, status) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'uploadProgress',
          fileName: fileName,
          status: status
        });
      }
    } catch (err) {
      console.log('[PDD监控] 通知上传进度失败:', err.message);
    }
  }
  
  // 通知上传完成
  function notifyUploadComplete() {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'uploadComplete'
        });
      }
    } catch (err) {
      console.log('[PDD监控] 通知上传完成失败:', err.message);
    }
  }
  
  // 通知上传错误
  function notifyUploadError(error) {
    try {
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'uploadError',
          error: error
        });
      }
    } catch (err) {
      console.log('[PDD监控] 通知上传错误失败:', err.message);
    }
  }
  // 根据页面类型决定是否添加面板
  console.log('[PDD监控] 页面检测结果:', { isUrlMatched, currentUrl });
  
  // 延迟添加面板的函数，确保React完成渲染
  function delayedAddPanel() {
    console.log('[PDD监控] 准备延迟添加面板，当前panelAdded:', panelAdded);
    if (panelAdded) {
      console.log('[PDD监控] 面板已添加，跳过');
      return;
    }

    // 再延迟1000ms，确保React完成渲染（增加到1秒）
    setTimeout(() => {
      console.log('[PDD监控] 延迟1000ms后，开始添加面板');
      addPanel();
    }, 1000);
  }

  // ★★★ 使用URL检测结果决定是否添加面板 ★★★
  if (isUrlMatched) {
    console.log('[PDD监控] URL匹配多多视频页面，准备添加面板');
    if (document.readyState === 'loading') {
      console.log('[PDD监控] 页面还在加载中，等待 DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[PDD监控] DOMContentLoaded 触发，延迟添加面板');
        delayedAddPanel();
      });
    } else {
      console.log('[PDD监控] 页面已加载，延迟添加面板');
      delayedAddPanel();
    }
  } else {
    // URL不匹配，不添加面板（白名单模式）
    console.log('[PDD监控] URL不匹配多多视频页面，不添加面板');
  }
  
  console.log('[PDD监控] ====== 内容脚本加载完成 ======');
  
  // 初始化：从存储中恢复已捕获的商品ID
  try {
    const cachedGoods = sessionStorage.getItem('__pdd_goods_cache');
    if (cachedGoods) {
      window.__pddCapturedGoodsIds = JSON.parse(cachedGoods);
      console.log('[PDD监控] 从sessionStorage恢复商品ID:', window.__pddCapturedGoodsIds.length, '个');
    }
  } catch (e) {}
  
  try {
    chrome.storage.local.get(['pdd_goods_cache'], (result) => {
      if (result.pdd_goods_cache && result.pdd_goods_cache.length > 0) {
        if (!window.__pddCapturedGoodsIds) {
          window.__pddCapturedGoodsIds = result.pdd_goods_cache;
        } else {
          const mergedMap = new Map();
          window.__pddCapturedGoodsIds.forEach(g => mergedMap.set(g.goodsId, g));
          result.pdd_goods_cache.forEach(g => mergedMap.set(g.goodsId, g));
          window.__pddCapturedGoodsIds = Array.from(mergedMap.values());
        }
        console.log('[PDD监控] 从chrome.storage恢复商品ID:', window.__pddCapturedGoodsIds.length, '个');
      }
    });
  } catch (e) {}
  
  // 暴露获取商品ID的全局函数
  window.__getPddGoodsIds = function() {
    return window.__pddCapturedGoodsIds || [];
  };
  
  // 暴露清除商品ID的全局函数
  window.__clearPddGoodsIds = function() {
    window.__pddCapturedGoodsIds = [];
    sessionStorage.removeItem('__pdd_goods_cache');
    try {
      chrome.storage.local.remove(['pdd_goods_cache']);
    } catch (e) {}
    console.log('[PDD监控] 商品ID已清除');
  };
  
  // 暴露查看金额同步日志的函数
  window.__pddCheckAmountLog = function() {
    console.log('========================================');
    console.log('[PDD监控] 金额同步日志');
    console.log('========================================');
    console.log('[PDD监控] 提示: 请查看控制台中所有包含"金额"的日志');
    console.log('[PDD监控] 关键字: "金额更新", "金额不同步", "金额下降", "orderAmount"');
    console.log('[PDD监控] 如果看到"金额下降不同步"说明保护机制生效');
    console.log('[PDD监控] 如果看到金额被更新但数值下降，说明有bug');
  };
  
  // 暴露查看当前所有视频金额的函数
  window.__pddCheckAllAmounts = function() {
    console.log('========================================');
    console.log('[PDD监控] 当前所有视频金额');
    console.log('========================================');
    
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      const videoIds = Object.keys(history);
      
      console.log(`[PDD监控] 共有 ${videoIds.length} 个视频`);
      
      videoIds.forEach((feedId, index) => {
        const video = history[feedId];
        const records = video.records || [];
        const lastRecord = records[records.length - 1];
        
        if (lastRecord) {
          console.log(`[PDD监控] 视频 #${index + 1} ${feedId}:`, {
            播放量: lastRecord.playCount || 0,
            订单数: lastRecord.orderCount || 0,
            金额: lastRecord.orderAmount || 0,
            日期: lastRecord.date || lastRecord.time,
            记录数: records.length
          });
        }
      });
    });
  };
  
  // 暴露查看特定视频详细历史的函数
  window.__pddCheckVideoHistory = function(videoId) {
    console.log('========================================');
    console.log(`[PDD监控] 视频 ${videoId} 详细历史`);
    console.log('========================================');
    
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      const video = history[videoId];
      
      if (!video) {
        console.error(`[PDD监控] ❌ 未找到视频 ${videoId}`);
        return;
      }
      
      console.log(`[PDD监控] 视频描述: ${video.desc || '无'}`);
      console.log(`[PDD监控] 记录数量: ${video.records ? video.records.length : 0}`);
      
      if (video.records && video.records.length > 0) {
        console.log('\n[PDD监控] 历史记录:');
        video.records.forEach((record, index) => {
          console.log(`[PDD监控] 记录 #${index + 1} ${record.date || record.time}:`, {
            播放量: record.playCount || 0,
            订单数: record.orderCount || 0,
            金额: record.orderAmount || 0
          });
        });
        
        // 找出最高金额
        const maxAmount = Math.max(...video.records.map(r => r.orderAmount || 0));
        const currentAmount = video.records[video.records.length - 1].orderAmount || 0;
        
        console.log(`\n[PDD监控] 💰 最高金额: ${maxAmount}`);
        console.log(`[PDD监控] 💰 当前金额: ${currentAmount}`);
        
        if (currentAmount < maxAmount) {
          console.warn(`[PDD监控] ⚠️ 当前金额 < 最高金额，可能被错误覆盖！`);
        }
      }
    });
  };
  
  // 暴露修复视频金额的函数
  window.__pddFixVideoAmount = function(videoId, correctAmount) {
    console.log('========================================');
    console.log(`[PDD监控] 修复视频 ${videoId} 的金额`);
    console.log('========================================');
    
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      const video = history[videoId];
      
      if (!video) {
        console.error(`[PDD监控] ❌ 未找到视频 ${videoId}`);
        return;
      }
      
      if (!video.records || video.records.length === 0) {
        console.error(`[PDD监控] ❌ 视频没有历史记录`);
        return;
      }
      
      const lastRecord = video.records[video.records.length - 1];
      const oldAmount = lastRecord.orderAmount || 0;
      
      console.log(`[PDD监控] 当前金额: ${oldAmount}`);
      console.log(`[PDD监控] 修复金额: ${correctAmount}`);
      
      lastRecord.orderAmount = correctAmount;
      
      chrome.storage.local.set({ videoHistory: history }, () => {
        console.log(`[PDD监控] ✅ 金额已修复: ${oldAmount} → ${correctAmount}`);
        
        // 验证修复结果
        chrome.storage.local.get(['videoHistory'], (result2) => {
          const video2 = result2.videoHistory[videoId];
          const lastRecord2 = video2.records[video2.records.length - 1];
          console.log(`[PDD监控] ✅ 验证: 当前金额 = ${lastRecord2.orderAmount}`);
        });
      });
    });
  };
  
  console.log('[PDD监控] ✓✓✓ 内容脚本加载完成');
  console.log('[PDD监控] 调试接口已暴露: window.pddMonitorDebug');
  console.log('[PDD监控] 商品ID接口: window.__getPddGoodsIds(), window.__clearPddGoodsIds()');
  console.log('[PDD监控] 检查金额日志: window.__pddCheckAmountLog()');
  console.log('[PDD监控] 查看所有金额: window.__pddCheckAllAmounts()');
  console.log('[PDD监控] 查看视频历史: window.__pddCheckVideoHistory("视频ID")');
  console.log('[PDD监控] 修复视频金额: window.__pddFixVideoAmount("视频ID", 正确金额)');
})();
