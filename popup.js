document.addEventListener('DOMContentLoaded', function() {
  // ========== 数据监控功能 ==========
  const videoCountEl = document.getElementById('videoCount');
  const totalPlaysEl = document.getElementById('totalPlays');
  const totalOrdersEl = document.getElementById('totalOrders');
  const totalAmountEl = document.getElementById('totalAmount');
  const videoListEl = document.getElementById('videoList');
  const lastUpdateEl = document.getElementById('lastUpdate');
  const keepAliveToggle = document.getElementById('keepAliveToggle');
  const refreshBtn = document.getElementById('refreshBtn');
  const refreshBtn2 = document.getElementById('refreshBtn2');
  const exportBtn = document.getElementById('exportBtn');
  const exportBtn2 = document.getElementById('exportBtn2');
  const clearBtn = document.getElementById('clearBtn');
  const syncBtn = document.getElementById('syncBtn');
  const syncBtn2 = document.getElementById('syncBtn2');

  loadVideoData();
  loadKeepAliveStatus();

  function loadVideoData() {
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      renderVideoList(history);
    });
  }

  function loadKeepAliveStatus() {
    chrome.runtime.sendMessage({ action: 'getKeepAliveStatus' }, (response) => {
      if (response) {
        keepAliveToggle.checked = response.enabled;
      }
    });
  }

  function renderVideoList(history) {
    const feedIds = Object.keys(history);
    
    if (feedIds.length === 0) {
      videoListEl.innerHTML = `
        <div class="empty-state">
          <div class="icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <p>暂无视频数据</p>
          <p style="font-size: 11px; margin-top: 4px;">请访问拼多多视频页面</p>
        </div>
      `;
      videoCountEl.textContent = '0';
      totalPlaysEl.textContent = '0';
      totalOrdersEl.textContent = '0';
      totalAmountEl.textContent = '¥0';
      return;
    }

    let totalPlays = 0;
    let totalOrders = 0;
    let totalAmount = 0;
    let videoCount = 0;
    let html = '';
    let lastTime = '';

    const videoArray = [];
    
    feedIds.forEach((feedId) => {
      const video = history[feedId];
      if (!video.records || video.records.length === 0) return;
      
      videoCount++;
      const lastRecord = video.records[video.records.length - 1];
      const playCount = lastRecord.playCount || 0;
      const orderCount = lastRecord.orderCount || 0;
      const orderAmount = lastRecord.orderAmount || 0;
      
      totalPlays += playCount;
      totalOrders += orderCount;
      totalAmount += orderAmount;
      
      if (lastRecord.time > lastTime) {
        lastTime = lastRecord.time;
      }
      
      videoArray.push({
        feedId: feedId,
        desc: video.desc,
        playCount: playCount,
        orderCount: orderCount,
        orderAmount: orderAmount
      });
    });

    videoArray.forEach((video) => {
      html += `
        <div class="video-item">
          <div class="video-title">${video.desc || '未知视频'}</div>
          <div class="video-stats">
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              ${formatNumber(video.playCount)}
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="9" cy="21" r="1"/>
                <circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              ${video.orderCount}
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              ¥${video.orderAmount.toFixed(2)}
            </span>
          </div>
        </div>
      `;
    });

    videoListEl.innerHTML = html || `<div class="empty-state">
      <div class="icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      </div>
      <p>暂无视频数据</p>
      <p class="sub">请访问拼多多视频页面</p>
    </div>`;
    videoCountEl.textContent = videoCount;
    totalPlaysEl.textContent = formatNumber(totalPlays);
    totalOrdersEl.textContent = totalOrders;
    totalAmountEl.textContent = '¥' + totalAmount.toFixed(2);
    
    if (lastTime) {
      const date = new Date(lastTime);
      const monitoredPagesEl = document.getElementById('monitoredPages');
      const totalVideosEl = document.getElementById('totalVideos');
      if (monitoredPagesEl) {
        const feedIds = Object.keys(history || {});
        monitoredPagesEl.textContent = feedIds.length;
        totalVideosEl.textContent = feedIds.reduce((sum, id) => sum + (history[id]?.length || 0), 0);
      }
    }
  }

  function formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    return num.toLocaleString();
  }

  function formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  keepAliveToggle.addEventListener('change', function() {
    chrome.runtime.sendMessage({
      action: 'toggleKeepAlive',
      enabled: this.checked
    });
  });

  // 绑定按钮（header + body 两套按钮共用同一逻辑）
  function bindButtons(btn1, btn2, handler) {
    if (btn1) btn1.addEventListener('click', handler);
    if (btn2) btn2.addEventListener('click', handler);
  }

  bindButtons(refreshBtn, refreshBtn2, function() {
    const originalHTML = this.innerHTML;
    this.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
        <path d="M23 4v6h-6"/>
        <path d="M1 20v-6h6"/>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
      </svg>
      刷新中...
    `;
    this.disabled = true;
    
    chrome.tabs.query({ url: '*://live.pinduoduo.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id, {}, () => {
          setTimeout(() => {
            loadVideoData();
            this.innerHTML = originalHTML;
            this.disabled = false;
          }, 3000);
        });
      } else {
        chrome.tabs.create({ url: 'https://live.pinduoduo.com/n-creator/video/mall-goods-video' });
        this.innerHTML = originalHTML;
        this.disabled = false;
      }
    });
  });

  bindButtons(syncBtn, syncBtn2, function() {
    const originalHTML = this.innerHTML;
    this.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;">
        <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/>
      </svg>
      同步中...
    `;
    this.disabled = true;
    
    chrome.runtime.sendMessage({ action: 'syncNow' }, (response) => {
      if (response && response.success) {
        this.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          同步成功
        `;
        this.style.background = 'linear-gradient(135deg, #34d399 0%, #10b981 100%)';
        loadVideoData();
        setTimeout(() => {
          syncBtn.innerHTML = originalHTML;
          syncBtn.style.background = '';
          syncBtn.disabled = false;
        }, 1000);
      } else {
        this.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          同步失败
        `;
        this.style.background = 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)';
        syncBtn.disabled = false;
      }
    });
  });

  bindButtons(exportBtn, exportBtn2, function() {
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      const feedIds = Object.keys(history);
      
      if (feedIds.length === 0) {
        alert('暂无数据可导出，请先访问拼多多视频页面收集数据');
        return;
      }
      
      let totalPlays = 0;
      let totalOrders = 0;
      let totalAmount = 0;
      const csvRows = [];
      csvRows.push(['视频ID', '视频描述', '播放量', '订单数', '成交金额'].join(','));
      
      feedIds.forEach((feedId) => {
        const video = history[feedId];
        if (!video.records || video.records.length === 0) return;
        
        const lastRecord = video.records[video.records.length - 1];
        const playCount = lastRecord.playCount || 0;
        const orderCount = lastRecord.orderCount || 0;
        const orderAmount = lastRecord.orderAmount || 0;
        
        totalPlays += playCount;
        totalOrders += orderCount;
        totalAmount += orderAmount;
        
        const desc = (video.desc || '未知视频').replace(/"/g, '""').replace(/,/g, '，');
        csvRows.push([feedId, `"${desc}"`, playCount, orderCount, orderAmount.toFixed(2)].join(','));
      });
      
      csvRows.push(['', '', '', '', ''].join(','));
      csvRows.push(['合计', `"${feedIds.length}个视频"`, totalPlays, totalOrders, totalAmount.toFixed(2)].join(','));
      
      const csvContent = '\uFEFF' + csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pdd-video-data-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      const originalText = this.innerHTML;
      this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> 导出成功';
      this.style.background = 'var(--success)';
      this.style.color = 'white';
      setTimeout(() => {
        this.innerHTML = originalText;
        this.style.background = '';
        this.style.color = '';
      }, 2000);
    });
  });

  bindButtons(clearBtn, null, function() {
    if (confirm('确定要清空所有数据吗？')) {
      chrome.storage.local.set({ videoHistory: {} }, () => {
        loadVideoData();
      });
    }
  });

  // ==================== 在线更新功能 ====================
  
  const updateBanner = document.getElementById('updateBanner');
  const updateTitle = document.getElementById('updateTitle');
  const updateVersionInfo = document.getElementById('updateVersionInfo');
  const updateNotes = document.getElementById('updateNotes');
  const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
  const dismissUpdateBtn = document.getElementById('dismissUpdateBtn');
  const recheckUpdateBtn = document.getElementById('recheckUpdateBtn');
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');
  const checkUpdateBtnHeader = document.getElementById('checkUpdateBtnHeader');

  // 检查更新状态并显示
  function checkUpdateStatus() {
    chrome.runtime.sendMessage({ action: 'getUpdateStatus' }, (result) => {
      if (!result) return;
      
      if (result.updateAvailable && result.updateInfo) {
        showUpdateBanner(result.updateInfo);
      } else if (result.lastUpdateCheck) {
        // 已检查过，无更新
        showNoUpdateInfo(result.lastUpdateCheck);
      }
    });
  }

  // 显示更新横幅
  function showUpdateBanner(info) {
    updateBanner.className = 'update-banner show';
    updateTitle.textContent = '发现新版本';
    updateVersionInfo.textContent = `当前版本: ${chrome.runtime.getManifest().version} → 最新版本: ${info.version}`;

    if (info.releaseNotes) {
      updateNotes.textContent = info.releaseNotes.substring(0, 300) +
        '\n\n📌 下载后请解压zip文件，在 chrome://extensions 中点击"加载已解压的扩展程序"选择解压后的文件夹即可完成更新。';
      updateNotes.style.display = 'block';
    } else {
      updateNotes.textContent = '📌 下载后请解压zip文件，在 chrome://extensions 中点击"加载已解压的扩展程序"选择解压后的文件夹即可完成更新。';
      updateNotes.style.display = 'block';
    }

    // 始终显示下载按钮
    downloadUpdateBtn.style.display = 'inline-flex';
    recheckUpdateBtn.style.display = 'inline-flex';

    // 点击下载：直接下载源码zip包
    downloadUpdateBtn.onclick = () => {
      const downloadUrl = info.zipballUrl || info.downloadUrl || info.html_url ||
        'https://github.com/yangweiyang/pdd-video-monitor-extension/releases/latest';

      // 按钮状态：下载中
      downloadUpdateBtn.disabled = true;
      downloadUpdateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        下载中...
      `;

      // 直接下载 zip 文件
      chrome.downloads.download({
        url: downloadUrl,
        filename: `pdd-video-monitor-v${info.version}.zip`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          // 下载失败，回退到打开页面
          chrome.tabs.create({ url: info.html_url || downloadUrl });
        }
        setTimeout(() => {
          downloadUpdateBtn.disabled = false;
          downloadUpdateBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            下载更新
          `;
        }, 2000);
      });
    };
  }

  // 显示已是最新
  function showNoUpdateInfo(lastCheck) {
    // 不显示横幅，但可以在控制台看到
    console.log('[PDD监控] 已是最新版本，上次检查:', lastCheck);
  }

  // 显示检查中
  function showChecking() {
    updateBanner.className = 'update-banner show';
    updateTitle.textContent = '正在检查更新...';
    updateVersionInfo.textContent = '';
    updateNotes.style.display = 'none';
    downloadUpdateBtn.style.display = 'none';
  }

  // 显示错误
  function showError(error) {
    updateBanner.className = 'update-banner show error';
    updateTitle.textContent = '检查更新失败';
    updateVersionInfo.textContent = error || '无法连接到服务器';
    updateNotes.style.display = 'none';
  }

  // 显示已是最新
  function showUpToDate(current, latest) {
    updateBanner.className = 'update-banner show success';
    updateTitle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 已是最新版本';
    updateVersionInfo.textContent = `当前版本: ${current}`;
    updateNotes.style.display = 'none';
    downloadUpdateBtn.style.display = 'none';
    recheckUpdateBtn.style.display = 'inline-flex';
  }

  // 手动检查更新（底部按钮 + header按钮）
  bindButtons(checkUpdateBtn, checkUpdateBtnHeader, async function() {
    showChecking();

    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'checkUpdate' }, resolve);
    });

    if (result.success) {
      if (result.hasUpdate) {
        showUpdateBanner(result.info);
      } else {
        showUpToDate(result.currentVersion, result.latestVersion);
        setTimeout(() => { updateBanner.classList.remove('show'); }, 3000);
      }
    } else {
      showError(result.error);
    }
  });

  // 横幅内的重新检查
  recheckUpdateBtn.addEventListener('click', async function() {
    showChecking();
    
    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'checkUpdate' }, resolve);
    });
    
    if (result.success) {
      if (result.hasUpdate) {
        showUpdateBanner(result.info);
      } else {
        showUpToDate(result.currentVersion, result.latestVersion);
        setTimeout(() => { updateBanner.classList.remove('show'); }, 3000);
      }
    } else {
      showError(result.error);
    }
  });

  // 关闭横幅
  dismissUpdateBtn.addEventListener('click', function() {
    updateBanner.classList.remove('show');
  });

  // 启动时自动检查
  setTimeout(checkUpdateStatus, 1000);

});
