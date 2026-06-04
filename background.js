const KEEP_ALIVE_INTERVAL = 2;
const PAGE_REFRESH_INTERVAL = 30;
const FETCH_DATA_INTERVAL = 10;
const SYNC_INTERVAL = 1;
const CHECK_UPDATE_INTERVAL = 60; // 每小时检查一次更新
const NATIVE_HOST_NAME = 'com.pdd.video.assistant';
const DEFAULT_ACCOUNT_ID = '默认账号';

// 更新配置 - 修改这里的 GitHub 仓库地址即可
const UPDATE_CONFIG = {
  // GitHub Releases API 地址（替换为你的仓库）
  repo: 'your-username/pdd-video-monitor-extension',
  // 或者使用自定义更新服务器
  updateUrl: null, // 如果有自定义服务器，填写URL，否则使用GitHub
  currentVersion: chrome.runtime.getManifest().version
};

let videoData = [];
let lastFetchTime = null;
let videoHistory = {};
let pendingSaveData = null;
let saveDataTimeout = null;
let isSavingData = false;
let currentAccountId = null;
let lastSyncTime = null;
let lastSyncHash = null;
let syncDebounceTimeout = null;
const SYNC_DEBOUNCE_DELAY = 500;
let isInitialized = false;

function logToFile(message) {
  const timestamp = new Date().toISOString();
  console.log('[PDD监控-BG]', message);
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[PDD监控] 扩展已安装');
  initStorage();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[PDD监控] 浏览器启动');
  initStorage();
});

async function initStorage() {
  try {
    const result = await chrome.storage.local.get(['videoData', 'keepAliveEnabled', 'videoHistory', 'currentAccountId']);
    
    if (result.videoData) {
      videoData = result.videoData;
      console.log('[PDD监控] 已加载历史数据:', videoData.length, '条');
    }
    
    if (result.videoHistory) {
      videoHistory = result.videoHistory;
      console.log('[PDD监控] 已加载视频历史:', Object.keys(videoHistory).length, '个视频');
    }
    
    if (result.currentAccountId) {
      currentAccountId = result.currentAccountId;
    }
    
    isInitialized = true;
    
    await loadRemoteDataOnStartup();
    
    if (result.keepAliveEnabled !== false) {
      startKeepAlive();
    }
  } catch (e) {
    console.error('[PDD监控] 初始化失败:', e);
  }
}

async function loadRemoteDataOnStartup() {
  try {
    console.log('[PDD监控] 启动时加载远程数据...');
    const accountId = currentAccountId || DEFAULT_ACCOUNT_ID;
    await loadDataFromNativeHost(accountId);
  } catch (e) {
    console.log('[PDD监控] 启动时加载远程数据失败:', e.message);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    performKeepAlive();
  } else if (alarm.name === 'pageRefresh') {
    performPageRefresh();
  } else if (alarm.name === 'fetchData') {
    fetchVideoData();
  } else if (alarm.name === 'syncData') {
    forceSyncToNativeHost();
  }
});

function startKeepAlive() {
  chrome.alarms.create('keepAlive', { periodInMinutes: KEEP_ALIVE_INTERVAL });
  chrome.alarms.create('pageRefresh', { periodInMinutes: PAGE_REFRESH_INTERVAL });
  chrome.alarms.create('fetchData', { periodInMinutes: FETCH_DATA_INTERVAL });
  chrome.alarms.create('syncData', { periodInMinutes: SYNC_INTERVAL });
  chrome.storage.local.set({ keepAliveEnabled: true });
  console.log('[PDD监控] 保活定时器已启动，同步间隔:', SYNC_INTERVAL, '分钟');
}

function stopKeepAlive() {
  chrome.alarms.clear('keepAlive');
  chrome.alarms.clear('pageRefresh');
  chrome.alarms.clear('fetchData');
  chrome.alarms.clear('syncData');
  chrome.storage.local.set({ keepAliveEnabled: false });
  console.log('[PDD监控] 保活定时器已停止');
}

function sendNativeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function forceSyncToNativeHost() {
  const accountId = currentAccountId || DEFAULT_ACCOUNT_ID;
  
  try {
    const result = await chrome.storage.local.get(['videoHistory']);
    const latestVideoHistory = result.videoHistory || videoHistory || {};
    
    if (Object.keys(latestVideoHistory).length === 0) {
      console.log('[PDD监控] 没有数据需要同步');
      return;
    }
    
    console.log('[PDD监控] 强制同步数据到本地存储，账号:', accountId, '视频数:', Object.keys(latestVideoHistory).length);
    
    const response = await sendNativeMessage({
      action: 'syncVideoHistory',
      accountId: accountId,
      videoHistory: latestVideoHistory
    });
    
    if (response && response.success) {
      lastSyncHash = JSON.stringify(latestVideoHistory);
      lastSyncTime = new Date();
      console.log('[PDD监控] 数据已同步到本地存储，返回视频数:', Object.keys(response.videoHistory || {}).length);
    } else {
      console.log('[PDD监控] 同步失败:', response);
    }
  } catch (e) {
    console.log('[PDD监控] 同步数据失败:', e.message);
  }
}

async function syncDataToNativeHost() {
  return forceSyncToNativeHost();
}

function scheduleNativeSync() {
  if (syncDebounceTimeout) {
    clearTimeout(syncDebounceTimeout);
  }
  
  syncDebounceTimeout = setTimeout(() => {
    forceSyncToNativeHost();
  }, SYNC_DEBOUNCE_DELAY);
}

async function loadDataFromNativeHost(accountId) {
  const actualAccountId = accountId || DEFAULT_ACCOUNT_ID;
  
  try {
    console.log('[PDD监控] 加载账号数据，账号:', actualAccountId);
    
    const response = await sendNativeMessage({
      action: 'readAccountData'
    });
    
    if (response && response.success && response.data) {
      const allAccountData = response.data;
      
      const accountData = allAccountData[actualAccountId];
      
      if (accountData && accountData.videoHistory) {
        const result = await chrome.storage.local.get(['videoHistory']);
        const localVideoHistory = result.videoHistory || {};
        const remoteVideoHistory = accountData.videoHistory;
        
        console.log('[PDD监控] 本地视频数:', Object.keys(localVideoHistory).length);
        console.log('[PDD监控] 远程视频数:', Object.keys(remoteVideoHistory).length);
        
        let hasNewData = false;
        const mergedHistory = {};
        
        const allFeedIds = new Set([
          ...Object.keys(localVideoHistory),
          ...Object.keys(remoteVideoHistory)
        ]);
        
        for (const feedId of allFeedIds) {
          const localVideo = localVideoHistory[feedId];
          const remoteVideo = remoteVideoHistory[feedId];
          
          if (!localVideo && remoteVideo) {
            mergedHistory[feedId] = { ...remoteVideo };
            hasNewData = true;
            console.log('[PDD监控] 从远程加载新视频:', feedId);
          } else if (localVideo && !remoteVideo) {
            mergedHistory[feedId] = { ...localVideo };
          } else if (localVideo && remoteVideo) {
            mergedHistory[feedId] = { ...localVideo };
            
            const remoteRecords = remoteVideo.records || [];
            const localRecords = localVideo.records || [];
            
            const recordMap = new Map();
            
            localRecords.forEach(r => {
              const key = r.date || r.time;
              if (key) recordMap.set(key, { ...r });
            });
            
            remoteRecords.forEach(r => {
              const key = r.date || r.time;
              if (key) {
                if (!recordMap.has(key)) {
                  recordMap.set(key, { ...r });
                  hasNewData = true;
                } else {
                  const existing = recordMap.get(key);
                  let updated = false;
                  
                  // 播放量：只有远程 > 本地时才更新
                  if ((r.playCount || 0) > (existing.playCount || 0)) {
                    existing.playCount = r.playCount;
                    updated = true;
                  }
                  
                  // 订单数：只有远程 > 本地时才更新
                  if ((r.orderCount || 0) > (existing.orderCount || 0)) {
                    existing.orderCount = r.orderCount;
                    updated = true;
                  }
                  
                  // 金额：只有远程 >= 本地时才更新（如果远程金额 < 本地金额，则不同步）
                  const remoteAmount = r.orderAmount || 0;
                  const localAmount = existing.orderAmount || 0;
                  if (remoteAmount >= localAmount && remoteAmount !== localAmount) {
                    existing.orderAmount = r.orderAmount;
                    updated = true;
                    console.log(`[PDD监控] 💰 远程同步 ${feedId} ${key}: ${localAmount} → ${remoteAmount}`);
                  } else if (remoteAmount < localAmount) {
                    console.log(`[PDD监控] ⚠️ 远程金额<本地，不同步 ${feedId} ${key}: 远程=${remoteAmount} 本地=${localAmount}`);
                  }
                  
                  // 点赞数：只有远程 > 本地时才更新
                  if ((r.likes || 0) > (existing.likes || 0)) {
                    existing.likes = r.likes;
                    updated = true;
                  }
                  
                  if (updated) hasNewData = true;
                }
              }
            });
            
            mergedHistory[feedId].records = Array.from(recordMap.values())
              .sort((a, b) => new Date(a.date || a.time) - new Date(b.date || b.time));
            
            if (remoteVideo.firstSeen && (!localVideo.firstSeen || remoteVideo.firstSeen < localVideo.firstSeen)) {
              mergedHistory[feedId].firstSeen = remoteVideo.firstSeen;
              hasNewData = true;
            }
            
            if (remoteVideo.desc && !mergedHistory[feedId].desc) {
              mergedHistory[feedId].desc = remoteVideo.desc;
            }
            if (remoteVideo.coverUrl && !mergedHistory[feedId].coverUrl) {
              mergedHistory[feedId].coverUrl = remoteVideo.coverUrl;
            }
          }
        }
        
        if (Object.keys(mergedHistory).length > 0) {
          videoHistory = mergedHistory;
          await chrome.storage.local.set({ videoHistory });
          
          lastSyncHash = JSON.stringify(mergedHistory);
          lastSyncTime = new Date();
          
          console.log('[PDD监控] 已合并数据，视频数:', Object.keys(videoHistory).length, '有新数据:', hasNewData);
          return { success: true, hasData: true, count: Object.keys(videoHistory).length, hasNewData };
        }
      } else {
        console.log('[PDD监控] 远程没有该账号的数据:', actualAccountId);
      }
      
      return { success: true, hasData: false };
    }
    
    console.log('[PDD监控] 读取远程数据失败');
    return { success: true, hasData: false };
  } catch (e) {
    console.log('[PDD监控] 加载本地数据失败:', e.message);
    return { success: false, error: e.message };
  }
}

async function performKeepAlive() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://live.pinduoduo.com/*' });
    
    if (tabs.length > 0) {
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'heartbeat' });
        } catch (e) {
        }
      }
    }
  } catch (error) {
  }
}

async function performPageRefresh() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://live.pinduoduo.com/*' });
    
    if (tabs.length > 0) {
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'simulateActivity' });
        } catch (e) {
        }
      }
    }
  } catch (error) {
  }
}

async function fetchVideoData() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://live.pinduoduo.com/*' });
    
    if (tabs.length > 0) {
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'fetchData' });
        } catch (e) {
        }
      }
    }
  } catch (error) {
  }
}

function scheduleDataSave() {
  if (saveDataTimeout) {
    clearTimeout(saveDataTimeout);
  }
  
  saveDataTimeout = setTimeout(() => {
    if (!isSavingData && pendingSaveData) {
      saveDataToStorage();
    }
  }, 500);
}

async function saveDataToStorage() {
  if (isSavingData || !pendingSaveData) return;
  
  isSavingData = true;
  const dataToSave = pendingSaveData;
  pendingSaveData = null;
  
  try {
    await chrome.storage.local.set(dataToSave);
    console.log('[PDD监控] 数据已保存到存储，视频数:', Object.keys(dataToSave.videoHistory || {}).length);
    
    setTimeout(() => {
      forceSyncToNativeHost();
    }, 100);
    
  } catch (error) {
    console.error('[PDD监控] 保存数据失败:', error);
  } finally {
    isSavingData = false;
    
    if (pendingSaveData) {
      scheduleDataSave();
    }
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'videoData') {
    const timestamp = new Date();
    const data = {
      timestamp: timestamp.toISOString(),
      videos: message.data || []
    };
    
    videoData.push(data);
    
    if (videoData.length > 100) {
      videoData = videoData.slice(-100);
    }
    
    message.data?.forEach(video => {
      const feedId = video.feedId || video.goodsId;
      if (feedId) {
        if (!videoHistory[feedId]) {
          videoHistory[feedId] = {
            firstSeen: timestamp.toISOString(),
            records: []
          };
        }
        videoHistory[feedId].lastSeen = timestamp.toISOString();
        videoHistory[feedId].lastPlayCount = video.playCount || video.pv || 0;
        videoHistory[feedId].desc = video.desc || videoHistory[feedId].desc;
        videoHistory[feedId].coverUrl = video.coverUrl || videoHistory[feedId].coverUrl;
        
        // 检查今天是否已有记录
        const today = timestamp.toISOString().split('T')[0];
        const existingRecord = videoHistory[feedId].records.find(r => r.date === today);
        
        if (existingRecord) {
          // 今天已有记录，智能合并（关键：检查金额）
          const newAmount = video.orderAmount || 0;
          const existingAmount = existingRecord.orderAmount || 0;
          
          // 播放量：取最大值
          if ((video.playCount || video.pv || 0) > (existingRecord.playCount || 0)) {
            existingRecord.playCount = video.playCount || video.pv || 0;
          }
          
          // 订单数：取最大值
          if ((video.orderCount || 0) > (existingRecord.orderCount || 0)) {
            existingRecord.orderCount = video.orderCount || 0;
          }
          
          // 金额：只有新金额 >= 历史金额时才更新
          if (newAmount >= existingAmount) {
            existingRecord.orderAmount = newAmount;
            console.log(`[PDD监控] 💰 ${feedId} 金额更新: ${existingAmount} → ${newAmount}`);
          } else {
            console.log(`[PDD监控] ⚠️ ${feedId} 金额下降不同步: 新=${newAmount} 历=${existingAmount}`);
          }
          
          // 点赞数：取最大值
          if ((video.likes || 0) > (existingRecord.likes || 0)) {
            existingRecord.likes = video.likes || 0;
          }
          
          existingRecord.time = timestamp.toISOString();
        } else {
          // 今天没有记录，添加新记录
          videoHistory[feedId].records.push({
            time: timestamp.toISOString(),
            date: today,
            playCount: video.playCount || video.pv || 0,
            orderCount: video.orderCount || 0,
            orderAmount: video.orderAmount || 0,
            likes: video.likes || 0
          });
        }
        
        if (videoHistory[feedId].records.length > 60) {
          videoHistory[feedId].records = videoHistory[feedId].records.slice(-60);
        }
      }
    });
    
    pendingSaveData = { videoData, videoHistory };
    scheduleDataSave();
    
    lastFetchTime = timestamp;
    sendResponse({ success: true, count: message.data?.length || 0 });
    return true;
  }
  
  if (message.action === 'getVideoData') {
    chrome.storage.local.get(['videoData'], (result) => {
      const data = result.videoData || videoData;
      sendResponse({ 
        data: data, 
        lastFetchTime: lastFetchTime?.toISOString() 
      });
    });
    return true;
  }
  
  if (message.action === 'getVideoHistory') {
    chrome.storage.local.get(['videoHistory'], (result) => {
      sendResponse({ history: result.videoHistory || videoHistory });
    });
    return true;
  }
  
  if (message.action === 'toggleKeepAlive') {
    if (message.enabled) {
      startKeepAlive();
    } else {
      stopKeepAlive();
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getKeepAliveStatus') {
    chrome.storage.local.get(['keepAliveEnabled'], (result) => {
      sendResponse({ enabled: result.keepAliveEnabled !== false });
    });
    return true;
  }
  
  if (message.action === 'clearData') {
    videoData = [];
    videoHistory = {};
    pendingSaveData = { videoData: [], videoHistory: {} };
    scheduleDataSave();
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'setAccountId') {
    const newAccountId = message.accountId;
    if (newAccountId && newAccountId !== currentAccountId) {
      currentAccountId = newAccountId;
      chrome.storage.local.set({ currentAccountId });
      console.log('[PDD监控] 设置账号ID:', currentAccountId);
      
      loadDataFromNativeHost(currentAccountId).then((result) => {
        console.log('[PDD监控] 账号数据加载结果:', result);
        forceSyncToNativeHost();
      }).catch((e) => {
        console.log('[PDD监控] 加载账号数据失败:', e.message);
      });
    }
    sendResponse({ success: true, accountId: currentAccountId });
    return true;
  }
  
  if (message.action === 'getAccountId') {
    sendResponse({ accountId: currentAccountId });
    return true;
  }
  
  if (message.action === 'syncNow') {
    forceSyncToNativeHost().then(() => {
      sendResponse({ success: true, lastSyncTime: lastSyncTime?.toISOString() });
    }).catch((e) => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }
  
  if (message.action === 'loadFromNative') {
    const accountId = currentAccountId || DEFAULT_ACCOUNT_ID;
    loadDataFromNativeHost(accountId).then((result) => {
      sendResponse(result);
    }).catch((e) => {
      sendResponse({ success: false, error: e.message });
    });
    return true;
  }
  
  if (message.action === 'exportData') {
    chrome.storage.local.get(['videoData', 'videoHistory'], (result) => {
      const exportData = {
        exportTime: new Date().toISOString(),
        videoData: result.videoData || videoData,
        videoHistory: result.videoHistory || videoHistory
      };
      sendResponse(exportData);
    });
    return true;
  }
  
  if (message.action === 'readLocalFile') {
    const hostName = 'com.pdd.video.assistant';
    
    try {
      chrome.runtime.sendNativeMessage(hostName, {
        action: 'readFile',
        filePath: message.filePath
      }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
  
  if (message.action === 'listLocalFiles') {
    const hostName = 'com.pdd.video.assistant';
    
    try {
      chrome.runtime.sendNativeMessage(hostName, {
        action: 'listFiles',
        dirPath: message.dirPath
      }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
  
  if (message.action === 'testNativeMessaging') {
    const hostName = 'com.pdd.video.assistant';
    
    try {
      chrome.runtime.sendNativeMessage(hostName, { action: 'ping' }, (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
    return true;
  }
  
  // 更新检查相关消息
  if (message.action === 'checkUpdate') {
    checkForUpdate().then(result => sendResponse(result));
    return true;
  }
  
  if (message.action === 'getUpdateStatus') {
    chrome.storage.local.get(['updateAvailable', 'updateInfo', 'lastUpdateCheck'], (result) => {
      sendResponse({
        updateAvailable: result.updateAvailable || false,
        updateInfo: result.updateInfo || null,
        lastUpdateCheck: result.lastUpdateCheck || null
      });
    });
    return true;
  }
  
  return false;
});

// ==================== 在线更新功能 ====================

// 检查更新
async function checkForUpdate() {
  console.log('[PDD监控] 开始检查更新...');
  
  try {
    let updateInfo = null;
    
    if (UPDATE_CONFIG.updateUrl) {
      // 使用自定义服务器
      const response = await fetch(UPDATE_CONFIG.updateUrl + '?v=' + UPDATE_CONFIG.currentVersion + '&t=' + Date.now());
      if (!response.ok) throw new Error('HTTP ' + response.status);
      updateInfo = await response.json();
    } else {
      // 使用 GitHub Releases API
      const url = `https://api.github.com/repos/${UPDATE_CONFIG.repo}/releases/latest`;
      const response = await fetch(url, { 
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      if (!response.ok) throw new Error('GitHub API HTTP ' + response.status);
      const data = await response.json();
      
      // 解析版本号
      const latestVersion = data.tag_name ? data.tag_name.replace(/^v/, '') : data.name;
      const downloadUrl = data.zipball_url || data.browser_download_url || 
                          (data.assets && data.assets[0] ? data.assets[0].browser_download_url : null);
      
      updateInfo = {
        version: latestVersion,
        downloadUrl: downloadUrl,
        releaseNotes: data.body || '',
        releaseDate: data.published_at || '',
        html_url: data.html_url || ''
      };
    }
    
    // 比较版本
    const currentVersion = UPDATE_CONFIG.currentVersion;
    const latestVersion = updateInfo.version;
    
    console.log('[PDD监控] 当前版本:', currentVersion, ', 最新版本:', latestVersion);
    
    // 简单版本比较
    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    
    // 存储更新信息
    chrome.storage.local.set({
      lastUpdateCheck: new Date().toISOString(),
      updateAvailable: isNewer,
      updateInfo: updateInfo
    });
    
    return {
      success: true,
      hasUpdate: isNewer,
      currentVersion: currentVersion,
      latestVersion: latestVersion,
      info: updateInfo
    };
    
  } catch (e) {
    console.error('[PDD监控] 检查更新失败:', e.message);
    return { success: false, error: e.message };
  }
}

// 版本比较函数
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  const len = Math.max(parts1.length, parts2.length);
  
  for (let i = 0; i < len; i++) {
    const n1 = parts1[i] || 0;
    const n2 = parts2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

// 定时检查更新
setInterval(() => {
  checkForUpdate();
}, CHECK_UPDATE_INTERVAL * 60 * 1000);

// 启动时也检查一次
setTimeout(checkForUpdate, 30 * 1000);
