document.addEventListener('DOMContentLoaded', function() {
  // ========== DOM 元素 ==========
  const videoCountEl = document.getElementById('videoCount');
  const totalPlaysEl = document.getElementById('totalPlays');
  const totalOrdersEl = document.getElementById('totalOrders');
  const totalAmountEl = document.getElementById('totalAmount');
  const videoListEl = document.getElementById('videoList');
  const listCountEl = document.getElementById('listCount');
  const searchInput = document.getElementById('searchInput');
  const sortBtn = document.getElementById('sortBtn');
  const batchBar = document.getElementById('batchBar');
  const batchInfo = document.getElementById('batchInfo');
  const keepAliveToggle = document.getElementById('keepAliveToggle');
  const refreshBtn = document.getElementById('refreshBtn');
  const syncBtn = document.getElementById('syncBtn');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const batchExportBtn = document.getElementById('batchExportBtn');
  const batchClearBtn = document.getElementById('batchClearBtn');

  // 更新相关
  const updateBanner = document.getElementById('updateBanner');
  const updateTitle = document.getElementById('updateTitle');
  const updateVersionInfo = document.getElementById('updateVersionInfo');
  const updateNotes = document.getElementById('updateNotes');
  const downloadUpdateBtn = document.getElementById('downloadUpdateBtn');
  const dismissUpdateBtn = document.getElementById('dismissUpdateBtn');
  const recheckUpdateBtn = document.getElementById('recheckUpdateBtn');
  const checkUpdateBtn = document.getElementById('checkUpdateBtn');

  // ========== 状态管理 ==========
  let allVideos = [];          // 所有视频数据
  let selectedIds = new Set(); // 已选中的视频ID
  let currentSort = 'default'; // 当前排序: default | plays | orders | amount
  let sortAsc = false;         // 排序方向

  // ========== 初始化 ==========
  loadVideoData();
  loadKeepAliveStatus();

  // ========== 数据加载 ==========
  function loadVideoData() {
    chrome.storage.local.get(['videoHistory'], (result) => {
      const history = result.videoHistory || {};
      parseVideoData(history);
      renderList();
    });
  }

  function loadKeepAliveStatus() {
    chrome.runtime.sendMessage({ action: 'getKeepAliveStatus' }, (response) => {
      if (response) {
        keepAliveToggle.checked = response.enabled;
      }
    });
  }

  // 解析原始数据为结构化数组
  function parseVideoData(history) {
    allVideos = [];
    const feedIds = Object.keys(history);

    feedIds.forEach((feedId) => {
      const video = history[feedId];
      if (!video.records || video.records.length === 0) return;

      const lastRecord = video.records[video.records.length - 1];
      allVideos.push({
        feedId: feedId,
        desc: video.desc || '未知视频',
        playCount: lastRecord.playCount || 0,
        orderCount: lastRecord.orderCount || 0,
        orderAmount: lastRecord.orderAmount || 0,
        time: lastRecord.time || ''
      });
    });
  }

  // 更新统计概览
  function updateStats(videos) {
    let totalPlays = 0, totalOrders = 0, totalAmount = 0;
    videos.forEach((v) => {
      totalPlays += v.playCount;
      totalOrders += v.orderCount;
      totalAmount += v.orderAmount;
    });

    videoCountEl.textContent = videos.length;
    totalPlaysEl.textContent = formatNumber(totalPlays);
    totalOrdersEl.textContent = totalOrders;
    totalAmountEl.textContent = '¥' + totalAmount.toFixed(2);
  }

  // ========== 渲染列表 ==========
  function renderList() {
    const keyword = searchInput.value.trim().toLowerCase();
    let filtered = allVideos;

    // 搜索过滤
    if (keyword) {
      filtered = allVideos.filter((v) =>
        v.desc.toLowerCase().includes(keyword)
      );
    }

    // 排序
    if (currentSort !== 'default') {
      filtered = [...filtered].sort((a, b) => {
        const valA = a[currentSort];
        const valB = b[currentSort];
        return sortAsc ? valA - valB : valB - valA;
      });
    }

    updateStats(filtered);
    listCountEl.textContent = `${filtered.length} 个视频`;

    if (filtered.length === 0) {
      if (allVideos.length === 0) {
        videoListEl.innerHTML = `
          <div class="empty-state">
            <div class="icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <p>暂无视频数据</p>
            <p class="sub">请访问拼多多视频页面</p>
          </div>`;
      } else {
        videoListEl.innerHTML = `
          <div class="no-results">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <p>未找到匹配的视频</p>
          </div>`;
      }
      return;
    }

    let html = '';
    filtered.forEach((video) => {
      const checked = selectedIds.has(video.feedId) ? 'checked' : '';
      const selectedClass = selectedIds.has(video.feedId) ? 'selected' : '';
      html += `
        <div class="video-item ${selectedClass}" data-feedid="${video.feedId}">
          <label class="video-check">
            <input type="checkbox" ${checked} data-feedid="${video.feedId}">
            <span class="check-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </label>
          <div class="video-info">
            <div class="video-title">${escapeHtml(video.desc)}</div>
            <div class="video-stats">
              <span class="video-stat plays">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ${formatNumber(video.playCount)}
              </span>
              <span class="video-stat orders">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                ${video.orderCount}
              </span>
              <span class="video-stat amount">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                ¥${video.orderAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>`;
    });

    videoListEl.innerHTML = html;

    // 绑定勾选事件
    videoListEl.querySelectorAll('.video-check input').forEach((cb) => {
      cb.addEventListener('change', function(e) {
        e.stopPropagation();
        const id = this.dataset.feedid;
        if (this.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        updateBatchBar();
        // 更新选中样式
        const item = this.closest('.video-item');
        item.classList.toggle('selected', this.checked);
      });
    });

    // 点击整行也切换勾选（不触发checkbox的change时手动处理）
    videoListEl.querySelectorAll('.video-item').forEach((item) => {
      item.addEventListener('click', function(e) {
        if (e.target.closest('.video-check')) return; // 已经由checkbox处理
        const id = this.dataset.feedid;
        const cb = this.querySelector('.video-check input');
        cb.checked = !cb.checked;
        if (cb.checked) {
          selectedIds.add(id);
        } else {
          selectedIds.delete(id);
        }
        this.classList.toggle('selected', cb.checked);
        updateBatchBar();
      });
    });
  }

  // 更新批量操作栏显示状态
  function updateBatchBar() {
    const count = selectedIds.size;
    if (count > 0) {
      batchBar.classList.add('show');
      batchInfo.textContent = `已选 ${count} 个`;
    } else {
      batchBar.classList.remove('show');
    }
  }

  // ========== 搜索功能 ==========
  let searchTimer = null;
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { renderList(); }, 200);
  });

  // ========== 排序功能 ==========
  const sortModes = ['default', 'plays', 'orders', 'amount'];
  const sortLabels = { default: '排序', plays: '播放量', orders: '订单数', amount: '金额' };
  let sortIndex = 0;

  sortBtn.addEventListener('click', function() {
    sortIndex = (sortIndex + 1) % sortModes.length;
    const nextMode = sortModes[sortIndex];

    if (nextMode === currentSort) {
      sortAsc = !sortAsc; // 同一模式切换升降序
    } else {
      currentSort = nextMode;
      sortAsc = false; // 新模式默认降序
    }

    // 更新按钮状态
    if (currentSort !== 'default') {
      sortBtn.classList.add('active');
      sortBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">${sortAsc ? '<path d="M3 8l4-4 4 4"/>' : '<path d="M16 16l4-4-4-4"/>'}<path d="M3 12h18M6 8v10M18 16V6"/></svg> ${sortLabels[currentSort]}${sortAsc ? '↑' : '↓'}`;
    } else {
      sortBtn.classList.remove('active');
      sortBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 6h18M6 12h12M9 18h6"/></svg> 排序`;
    }

    renderList();
  });

  // ========== 按钮操作 ==========

  // 刷新
  refreshBtn.addEventListener('click', function() {
    setButtonLoading(this, '刷新中...');
    chrome.tabs.query({ url: '*://live.pinduoduo.com/*' }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.reload(tabs[0].id, {}, () => {
          setTimeout(() => {
            loadVideoData();
            resetButton(this, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>', '刷新');
          }, 3000);
        });
      } else {
        chrome.tabs.create({ url: 'https://live.pinduoduo.com/n-creator/video/mall-goods-video' });
        resetButton(this, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>', '刷新');
      }
    });
  });

  // 同步
  syncBtn.addEventListener('click', function() {
    setButtonLoading(this, '同步中...');
    chrome.runtime.sendMessage({ action: 'syncNow' }, (response) => {
      if (response && response.success) {
        setButtonSuccess(this, '同步成功', '#34d399');
        loadVideoData();
        setTimeout(() => {
          resetButton(this, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9 9m9-9a9 9 0 0 0-9-9m9-9H3m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9"/></svg>', '同步');
        }, 1200);
      } else {
        setButtonSuccess(this, '同步失败', '#f87171');
        setTimeout(() => {
          resetButton(this, '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-9 9m9-9a9 9 0 0 0-9-9m9-9H3m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9"/></svg>', '同步');
        }, 1200);
      }
    });
  });

  // 导出全部
  exportBtn.addEventListener('click', function() {
    exportData(allVideos);
  });

  // 导出选中
  batchExportBtn.addEventListener('click', function() {
    const selected = allVideos.filter((v) => selectedIds.has(v.feedId));
    if (selected.length === 0) return;
    exportData(selected);
  });

  // 清空
  clearBtn.addEventListener('click', function() {
    if (confirm('确定要清空所有监控数据吗？此操作不可恢复。')) {
      chrome.storage.local.set({ videoHistory: {} }, () => {
        allVideos = [];
        selectedIds.clear();
        updateBatchBar();
        renderList();
      });
    }
  });

  // 取消选择
  batchClearBtn.addEventListener('click', function() {
    selectedIds.clear();
    updateBatchBar();
    renderList();
  });

  // 保活开关
  keepAliveToggle.addEventListener('change', function() {
    chrome.runtime.sendMessage({
      action: 'toggleKeepAlive',
      enabled: this.checked
    });
  });

  // ========== 导出功能 ==========
  function exportData(videos) {
    if (videos.length === 0) {
      alert('暂无数据可导出');
      return;
    }

    let totalPlays = 0, totalOrders = 0, totalAmount = 0;
    const rows = [['视频ID', '视频描述', '播放量', '订单数', '成交金额']];

    videos.forEach((v) => {
      totalPlays += v.playCount;
      totalOrders += v.orderCount;
      totalAmount += v.orderAmount;
      const desc = v.desc.replace(/"/g, '""').replace(/,/g, '，');
      rows.push([v.feedId, `"${desc}"`, v.playCount, v.orderCount, v.orderAmount.toFixed(2)].join(','));
    });

    rows.push([]);
    rows.push(['合计', `"${videos.length}个视频"`, totalPlays, totalOrders, totalAmount.toFixed(2)].join(','));

    const csvContent = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pdd-video-data-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    // 按钮反馈
    const btn = event.currentTarget;
    const origLabel = btn.querySelector('.label');
    if (origLabel) origLabel.textContent = '已导出';
    setTimeout(() => { if (origLabel) origLabel.textContent = btn.id === 'batchExportBtn' ? '导出选中' : '导出全部'; }, 1500);
  }

  // ========== 工具函数 ==========
  function formatNumber(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + '万';
    return num.toLocaleString();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function setButtonLoading(btn, text) {
    const label = btn.querySelector('.label');
    const icon = btn.querySelector('.icon-circle');
    if (label) label.textContent = text;
    if (icon) icon.style.animation = 'spin 1s linear infinite';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';
  }

  function setButtonSuccess(btn, text, color) {
    const label = btn.querySelector('.label');
    const icon = btn.querySelector('.icon-circle');
    if (label) label.textContent = text;
    if (icon) {
      icon.style.animation = '';
      icon.style.background = color + '22';
    }
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
  }

  function resetButton(btn, iconSvg, labelText) {
    const label = btn.querySelector('.label');
    const icon = btn.querySelector('.icon-circle');
    if (label) label.textContent = labelText;
    if (icon) {
      icon.style.animation = '';
      icon.innerHTML = iconSvg;
      // 恢复原始背景色
      icon.style.background = '';
    }
    btn.style.opacity = '1';
    btn.style.pointerEvents = '';
  }

  // ========== 在线更新功能 ==========
  function checkUpdateStatus() {
    chrome.runtime.sendMessage({ action: 'getUpdateStatus' }, (result) => {
      if (!result) return;
      if (result.updateAvailable && result.updateInfo) {
        showUpdateBanner(result.updateInfo);
      } else if (result.lastUpdateCheck) {
        console.log('[PDD监控] 已是最新版本，上次检查:', result.lastUpdateCheck);
      }
    });
  }

  function showUpdateBanner(info) {
    updateBanner.className = 'update-banner show';
    updateTitle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 发现新版本';
    updateVersionInfo.textContent = `当前版本: ${chrome.runtime.getManifest().version} → 最新版本: ${info.version}`;

    if (info.releaseNotes) {
      updateNotes.textContent = info.releaseNotes.substring(0, 300) +
        '\n\n下载后请解压zip文件，在 chrome://extensions 中点击"加载已解压的扩展程序"选择解压后的文件夹即可完成更新。';
    } else {
      updateNotes.textContent = '下载后请解压zip文件，在 chrome://extensions 中点击"加载已解压的扩展程序"选择解压后的文件夹即可完成更新。';
    }
    updateNotes.style.display = 'block';

    downloadUpdateBtn.style.display = 'inline-flex';
    recheckUpdateBtn.style.display = 'inline-flex';

    downloadUpdateBtn.onclick = () => {
      const downloadUrl = info.zipballUrl || info.downloadUrl || info.html_url ||
        'https://github.com/yangweiyang/pdd-video-monitor-extension/releases/latest';

      downloadUpdateBtn.disabled = true;
      downloadUpdateBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 下载中...';

      chrome.downloads.download({
        url: downloadUrl,
        filename: `pdd-video-monitor-v${info.version}.zip`,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          chrome.tabs.create({ url: info.html_url || downloadUrl });
        }
        setTimeout(() => {
          downloadUpdateBtn.disabled = false;
          downloadUpdateBtn.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> 下载更新';
        }, 2000);
      });
    };
  }

  function showChecking() {
    updateBanner.className = 'update-banner show';
    updateTitle.innerHTML = '正在检查更新...';
    updateVersionInfo.textContent = '';
    updateNotes.style.display = 'none';
    downloadUpdateBtn.style.display = 'none';
  }

  function showError(error) {
    updateBanner.className = 'update-banner show error';
    updateTitle.textContent = '检查更新失败';
    updateVersionInfo.textContent = error || '无法连接到服务器';
    updateNotes.style.display = 'none';
  }

  function showUpToDate(current) {
    updateBanner.className = 'update-banner show success';
    updateTitle.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 已是最新版本';
    updateVersionInfo.textContent = `当前版本: ${current}`;
    updateNotes.style.display = 'none';
    downloadUpdateBtn.style.display = 'none';
    recheckUpdateBtn.style.display = 'inline-flex';
    setTimeout(() => { updateBanner.classList.remove('show'); }, 3000);
  }

  // 手动检查更新
  checkUpdateBtn.addEventListener('click', async function() {
    await doCheckUpdate();
  });

  async function doCheckUpdate() {
    showChecking();
    const result = await new Promise(resolve => {
      chrome.runtime.sendMessage({ action: 'checkUpdate' }, resolve);
    });

    if (result.success) {
      if (result.hasUpdate) {
        showUpdateBanner(result.info);
      } else {
        showUpToDate(result.currentVersion);
      }
    } else {
      showError(result.error);
    }
  }

  recheckUpdateBtn.addEventListener('click', async function() {
    await doCheckUpdate();
  });

  dismissUpdateBtn.addEventListener('click', function() {
    updateBanner.classList.remove('show');
  });

  // 启动时自动检查
  setTimeout(checkUpdateStatus, 1000);

});
