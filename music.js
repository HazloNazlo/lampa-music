(function() {
  'use strict';

  // Защита от двойной загрузки
  if (window.musicPluginLoaded) return;
  window.musicPluginLoaded = true;

  console.log('[Music Plugin] Starting initialization...');

  // Ждем загрузки Lampa
  let initTimer = setInterval(function() {
    try {
      if (typeof Lampa !== 'undefined' && typeof Lampa.Menu !== 'undefined') {
        clearInterval(initTimer);
        console.log('[Music Plugin] Lampa found, initializing...');
        initMusicPlugin();
      }
    } catch(e) {
      console.error('[Music Plugin] Error during initialization check:', e);
    }
  }, 200);

  function initMusicPlugin() {
    try {
      // Регистрируем плагин
      Lampa.Plugins.register({
        name: 'music-player',
        description: 'Музыкальный плеер с торрентами',
        version: '1.0.1'
      });
      console.log('[Music Plugin] Plugin registered');

      // Добавляем в левое меню
      Lampa.Menu.add('music', {
        title: 'Музыка 🎵',
        icon: '🎵'
      });
      console.log('[Music Plugin] Menu item added');

      // Подписываемся на клик по меню
      Lampa.Listener.follow('menu', function(event) {
        try {
          if (event.target && event.target.dataset.name === 'music') {
            console.log('[Music Plugin] Menu clicked, showing interface');
            showMusicInterface();
          }
        } catch(e) {
          console.error('[Music Plugin] Error in menu listener:', e);
        }
      });

      // Проверяем токен
      checkDiscogsToken();
      console.log('[Music Plugin] Initialization complete!');
    } catch(e) {
      console.error('[Music Plugin] Fatal error in initMusicPlugin:', e);
      console.error(e.stack);
    }
  }

  function checkDiscogsToken() {
    try {
      let token = Lampa.Storage.get('discogs_token', '');
      console.log('[Music Plugin] Discogs token exists:', !!token);
      
      if (!token) {
        setTimeout(function() {
          try {
            let message = document.createElement('div');
            message.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;border:2px solid #fff;padding:20px;border-radius:8px;z-index:9999;min-width:300px;';
            
            let html = '<h3 style="color:#fff;margin-top:0;">Требуется токен Discogs</h3>';
            html += '<p style="color:#ccc;font-size:12px;">Получить токен: https://www.discogs.com/settings/developers</p>';
            html += '<input type="text" id="discogs-token-input" placeholder="Введите токен" style="width:100%;padding:8px;box-sizing:border-box;margin:10px 0;color:#000;">';
            html += '<button id="save-token-btn" style="width:100%;padding:8px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;">Сохранить</button>';
            html += '<button id="skip-token-btn" style="width:100%;padding:8px;margin-top:5px;background:#666;color:#fff;border:none;border-radius:4px;cursor:pointer;">Пропустить</button>';
            
            message.innerHTML = html;
            document.body.appendChild(message);
            
            document.getElementById('save-token-btn').onclick = function() {
              try {
                let tokenInput = document.getElementById('discogs-token-input').value;
                if (tokenInput.trim()) {
                  Lampa.Storage.set('discogs_token', tokenInput.trim());
                  console.log('[Music Plugin] Token saved');
                  message.remove();
                }
              } catch(e) {
                console.error('[Music Plugin] Error saving token:', e);
              }
            };
            
            document.getElementById('skip-token-btn').onclick = function() {
              message.remove();
            };
          } catch(e) {
            console.error('[Music Plugin] Error showing token dialog:', e);
          }
        }, 500);
      }
    } catch(e) {
      console.error('[Music Plugin] Error in checkDiscogsToken:', e);
    }
  }

  function showMusicInterface() {
    try {
      let container = document.createElement('div');
      container.id = 'music-plugin-container';
      container.style.cssText = 'padding:20px;max-width:1200px;margin:0 auto;';

      let html = '<div style="margin-bottom:20px;">';
      html += '<h1 style="color:#fff;margin:0 0 15px 0;">Поиск Музыки 🎵</h1>';
      html += '<div style="display:flex;gap:10px;margin-bottom:20px;">';
      html += '<input type="text" id="music-search-input" placeholder="Введите исполнителя или трек" style="flex:1;padding:10px;border:1px solid #666;background:#1a1a1a;color:#fff;border-radius:4px;font-size:14px;">';
      html += '<button id="music-search-btn" style="padding:10px 20px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Поиск</button>';
      html += '</div>';
      html += '</div>';
      html += '<div id="music-loading" style="color:#999;display:none;text-align:center;padding:20px;">Загрузка...</div>';
      html += '<div id="music-results" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px;"></div>';

      container.innerHTML = html;

      let mainContent = document.querySelector('.page-content') || document.querySelector('main') || document.body;
      mainContent.innerHTML = '';
      mainContent.appendChild(container);

      document.getElementById('music-search-btn').onclick = function() {
        let query = document.getElementById('music-search-input').value.trim();
        if (query) {
          searchMusic(query);
        }
      };

      document.getElementById('music-search-input').onkeypress = function(e) {
        if (e.key === 'Enter') {
          let query = this.value.trim();
          if (query) {
            searchMusic(query);
          }
        }
      };

      let resultsHtml = '<div style="grid-column:1/-1;color:#999;padding:40px;text-align:center;">';
      resultsHtml += '<p style="font-size:16px;">👇 Введите название трека выше</p>';
      resultsHtml += '</div>';
      
      document.getElementById('music-results').innerHTML = resultsHtml;
      console.log('[Music Plugin] Interface shown');
    } catch(e) {
      console.error('[Music Plugin] Error in showMusicInterface:', e);
      console.error(e.stack);
    }
  }

  function searchMusic(query) {
    try {
      console.log('[Music Plugin] Searching for:', query);
      
      let loading = document.getElementById('music-loading');
      let results = document.getElementById('music-results');

      loading.style.display = 'block';
      results.innerHTML = '';

      let parserUrl = Lampa.Storage.get('parser_url', 'http://localhost:9117');
      let parserKey = Lampa.Storage.get('parser_key', '');

      console.log('[Music Plugin] Parser URL:', parserUrl);
      console.log('[Music Plugin] Parser key exists:', !!parserKey);

      if (!parserUrl || parserUrl === 'http://localhost:9117') {
        loading.style.display = 'none';
        let errorHtml = '<div style="grid-column:1/-1;color:#f88;padding:20px;background:#1a0000;border-radius:4px;">';
        errorHtml += '<strong>❌ Парсер не настроен!</strong><br>';
        errorHtml += '<p style="font-size:12px;margin:5px 0;">Откройте Lampa → Настройки → Парсер</p>';
        errorHtml += '</div>';
        results.innerHTML = errorHtml;
        return;
      }

      let searchQuery = query + ' mp3 music album';
      let searchUrl = parserUrl + '/api/v2.0/indexers/all/results?apikey=' + parserKey + '&Query=' + encodeURIComponent(searchQuery);

      console.log('[Music Plugin] Fetching from:', searchUrl);

      fetch(searchUrl)
        .then(response => {
          console.log('[Music Plugin] Response status:', response.status);
          if (!response.ok) throw new Error('Ошибка парсера: ' + response.status);
          return response.json();
        })
        .then(data => {
          console.log('[Music Plugin] Got results:', data.Results ? data.Results.length : 0);
          loading.style.display = 'none';

          if (!data.Results || data.Results.length === 0) {
            let noResultsHtml = '<div style="grid-column:1/-1;color:#999;padding:20px;text-align:center;">Ничего не найдено</div>';
            results.innerHTML = noResultsHtml;
            return;
          }

          let musicTorrents = data.Results.filter(t => {
            let title = t.Title.toLowerCase();
            return title.includes('mp3') || title.includes('music') || title.includes('album') || title.includes('flac');
          });

          console.log('[Music Plugin] Filtered to music torrents:', musicTorrents.length);

          if (musicTorrents.length === 0) {
            let noMusicHtml = '<div style="grid-column:1/-1;color:#999;padding:20px;text-align:center;">Музыкальные торренты не найдены</div>';
            results.innerHTML = noMusicHtml;
            return;
          }

          musicTorrents.slice(0, 20).forEach((torrent) => {
            displaySimpleTorrent(torrent);
          });
        })
        .catch(error => {
          console.error('[Music Plugin] Search error:', error);
          loading.style.display = 'none';
          let errorHtml = '<div style="grid-column:1/-1;color:#f88;padding:20px;background:#1a0000;border-radius:4px;">';
          errorHtml += '<strong>❌ Ошибка: ' + error.message + '</strong><br>';
          errorHtml += '<p style="font-size:12px;margin:5px 0;">Парсер недоступен на ' + parserUrl + '</p>';
          errorHtml += '</div>';
          results.innerHTML = errorHtml;
        });
    } catch(e) {
      console.error('[Music Plugin] Error in searchMusic:', e);
      console.error(e.stack);
    }
  }

  function displaySimpleTorrent(torrent) {
    try {
      let resultsContainer = document.getElementById('music-results');
      let resultElement = document.createElement('div');
      resultElement.style.cssText = 'background:#1a1a1a;border-radius:8px;padding:10px;border:1px solid #333;';
      
      let html = '<div style="color:#fff;font-size:11px;margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">';
      html += torrent.Title.substring(0, 40);
      html += '</div>';
      html += '<div style="color:#999;font-size:10px;">👥 ' + (torrent.Seeders || 0) + ' | 📁 ' + formatSize(torrent.Size) + '</div>';
      html += '<button class="play-btn" style="width:100%;margin-top:8px;padding:6px;background:#0066cc;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:10px;">▶️ Воспроизвести</button>';

      resultElement.innerHTML = html;
      
      resultElement.querySelector('.play-btn').onclick = function() {
        playTorrent(torrent);
      };

      resultsContainer.appendChild(resultElement);
    } catch(e) {
      console.error('[Music Plugin] Error in displaySimpleTorrent:', e);
    }
  }

  function playTorrent(torrent) {
    try {
      console.log('[Music Plugin] Playing torrent:', torrent.Title);
      
      let loading = document.getElementById('music-loading');
      loading.style.display = 'block';
      loading.innerHTML = 'Отправляю в TorrServer...';

      let torrserverUrl = Lampa.Storage.get('torrserver_url', 'http://127.0.0.1:8090');

      console.log('[Music Plugin] TorrServer URL:', torrserverUrl);
      console.log('[Music Plugin] Magnet URI exists:', !!torrent.MagnetUri);

      if (!torrent.MagnetUri) {
        alert('❌ Магнет-ссылка не найдена');
        loading.style.display = 'none';
        return;
      }

      fetch(torrserverUrl + '/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link: torrent.MagnetUri,
          title: torrent.Title
        })
      })
        .then(response => response.json())
        .then(data => {
          console.log('[Music Plugin] TorrServer response:', data);
          if (data.hash) {
            let streamUrl = torrserverUrl + '/play?link=' + data.hash + '&index=0';
            console.log('[Music Plugin] Stream URL:', streamUrl);
            loading.innerHTML = 'Открываю плеер...';
            
            setTimeout(function() {
              window.open(streamUrl, '_blank');
              loading.style.display = 'none';
            }, 1000);
          } else {
            alert('❌ Ошибка TorrServer');
            loading.style.display = 'none';
          }
        })
        .catch(error => {
          console.error('[Music Plugin] TorrServer error:', error);
          alert('❌ Ошибка: ' + error.message);
          loading.style.display = 'none';
        });
    } catch(e) {
      console.error('[Music Plugin] Error in playTorrent:', e);
    }
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  console.log('[Music Plugin] Script loaded successfully');
})();
