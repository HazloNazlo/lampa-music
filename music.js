(function() {
  'use strict';

  // Флаг для предотвращения двойной инициализации
  if (window.musicPluginLoaded) return;
  window.musicPluginLoaded = true;

  // Ждем загрузки Lampa
  let initTimer = setInterval(function() {
    if (typeof Lampa !== 'undefined' && typeof Lampa.Menu !== 'undefined') {
      clearInterval(initTimer);
      initMusicPlugin();
    }
  }, 200);

  function initMusicPlugin() {
    // Регистрируем плагин
    Lampa.Plugins.register({
      name: 'music-player',
      description: 'Музыкальный плеер с торрентами',
      version: '1.0.0'
    });

    // Добавляем в левое меню
    Lampa.Menu.add('music', {
      title: 'Музыка 🎵',
      icon: '🎵'
    });

    // Подписываемся на клик по меню
    Lampa.Listener.follow('menu', function(event) {
      if (event.target && event.target.dataset.name === 'music') {
        showMusicInterface();
      }
    });

    // Проверяем, есть ли токен Discogs, если нет - спрашиваем
    checkDiscogsToken();
  }

  /**
   * Проверяем и запрашиваем токен Discogs
   */
  function checkDiscogsToken() {
    let token = Lampa.Storage.get('discogs_token', '');
    
    if (!token) {
      // Показываем диалог с просьбой ввести токен
      setTimeout(function() {
        let message = document.createElement('div');
        message.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#222;border:2px solid #fff;padding:20px;border-radius:8px;z-index:9999;min-width:300px;';
        
        let html = '<h3 style="color:#fff;margin-top:0;">Требуется токен Discogs</h3>';
        html += '<p style="color:#ccc;font-size:12px;">Получить токен: https://www.discogs.com/settings/developers</p>';
        html += '<input type="text" id="discogs-token-input" placeholder="Введите токен" style="width:100%;padding:8px;box-sizing:border-box;margin:10px 0;">';
        html += '<button id="save-token-btn" style="width:100%;padding:8px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;">Сохранить</button>';
        html += '<button id="skip-token-btn" style="width:100%;padding:8px;margin-top:5px;background:#666;color:#fff;border:none;border-radius:4px;cursor:pointer;">Пропустить</button>';
        
        message.innerHTML = html;
        document.body.appendChild(message);
        
        document.getElementById('save-token-btn').onclick = function() {
          let tokenInput = document.getElementById('discogs-token-input').value;
          if (tokenInput.trim()) {
            Lampa.Storage.set('discogs_token', tokenInput.trim());
            message.remove();
          }
        };
        
        document.getElementById('skip-token-btn').onclick = function() {
          message.remove();
        };
      }, 500);
    }
  }

  /**
   * Главный интерфейс музыки
   */
  function showMusicInterface() {
    let container = document.createElement('div');
    container.id = 'music-plugin-container';
    container.style.cssText = 'padding:20px;max-width:1200px;margin:0 auto;';

    let html = '';
    html += '<div style="margin-bottom:20px;">';
    html += '<h1 style="color:#fff;margin:0 0 15px 0;">Поиск Музыки 🎵</h1>';
    html += '<div style="display:flex;gap:10px;margin-bottom:20px;">';
    html += '<input type="text" id="music-search-input" placeholder="Введите исполнителя или трек (напр: The Beatles Hey Jude)" style="flex:1;padding:10px;border:1px solid #666;background:#1a1a1a;color:#fff;border-radius:4px;font-size:14px;">';
    html += '<button id="music-search-btn" style="padding:10px 20px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px;">Поиск</button>';
    html += '</div>';
    html += '<div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;">';
    html += '<label style="display:flex;align-items:center;gap:5px;color:#ccc;font-size:12px;"><input type="checkbox" id="filter-seeders" checked>Фильтр по сидерам</label>';
    html += '<label style="display:flex;align-items:center;gap:5px;color:#ccc;font-size:12px;"><input type="checkbox" id="sort-seeders">Сортировать по сидерам</label>';
    html += '<button id="settings-btn" style="margin-left:auto;padding:5px 10px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">⚙️ Настройки</button>';
    html += '</div>';
    html += '</div>';
    html += '<div id="music-loading" style="color:#999;display:none;text-align:center;padding:20px;">Загрузка... ⏳</div>';
    html += '<div id="music-results" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:15px;"></div>';

    container.innerHTML = html;

    // Очищаем основной контент
    let mainContent = document.querySelector('.page-content') || document.querySelector('main') || document.body;
    mainContent.innerHTML = '';
    mainContent.appendChild(container);

    // Обработчики событий
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

    document.getElementById('settings-btn').onclick = function() {
      showSettings();
    };

    // По умолчанию показываем подсказку
    let resultsHtml = '<div style="grid-column:1/-1;color:#999;padding:40px;text-align:center;">';
    resultsHtml += '<p style="font-size:16px;">👇 Введите название трека или исполнителя выше</p>';
    resultsHtml += '<p style="font-size:12px;margin-top:10px;">Примеры: "Pink Floyd Comfortably Numb" или "Daft Punk - Get Lucky"</p>';
    resultsHtml += '</div>';
    
    document.getElementById('music-results').innerHTML = resultsHtml;
  }

  /**
   * Поиск музыки через парсер Lampa
   */
  function searchMusic(query) {
    let loading = document.getElementById('music-loading');
    let results = document.getElementById('music-results');

    loading.style.display = 'block';
    results.innerHTML = '';

    // Получаем настройки парсера из Lampa
    let parserUrl = Lampa.Storage.get('parser_url', 'http://localhost:9117');
    let parserKey = Lampa.Storage.get('parser_key', '');

    if (!parserUrl || parserUrl === 'http://localhost:9117') {
      loading.style.display = 'none';
      let errorHtml = '<div style="grid-column:1/-1;color:#f88;padding:20px;background:#1a0000;border-radius:4px;">';
      errorHtml += '<strong>❌ Парсер не настроен!</strong><br>';
      errorHtml += '<p style="font-size:12px;margin:5px 0;">В Lampa откройте: Настройки → Парсер → Выберите парсер и введите URL</p>';
      errorHtml += '<p style="font-size:12px;margin:5px 0;">Обычно: http://localhost:9117</p>';
      errorHtml += '</div>';
      results.innerHTML = errorHtml;
      return;
    }

    // Формируем запрос к парсеру
    let searchQuery = query + ' mp3 music album';
    let searchUrl = parserUrl + '/api/v2.0/indexers/all/results?apikey=' + parserKey + '&Query=' + encodeURIComponent(searchQuery);

    fetch(searchUrl)
      .then(response => {
        if (!response.ok) throw new Error('Ошибка парсера: ' + response.status);
        return response.json();
      })
      .then(data => {
        loading.style.display = 'none';

        if (!data.Results || data.Results.length === 0) {
          let noResultsHtml = '<div style="grid-column:1/-1;color:#999;padding:20px;text-align:center;">Ничего не найдено по запросу: "' + query + '"</div>';
          results.innerHTML = noResultsHtml;
          return;
        }

        // Фильтруем и сортируем результаты
        let musicTorrents = data.Results.filter(t => {
          let title = t.Title.toLowerCase();
          return title.includes('mp3') || title.includes('music') ||
            title.includes('album') || title.includes('flac') ||
            title.includes('wav');
        });

        let filterSeeders = document.getElementById('filter-seeders').checked;
        let sortBySeeders = document.getElementById('sort-seeders').checked;

        if (filterSeeders) {
          musicTorrents = musicTorrents.filter(t => (t.Seeders || 0) >= 2);
        }

        if (sortBySeeders) {
          musicTorrents.sort((a, b) => (b.Seeders || 0) - (a.Seeders || 0));
        }

        if (musicTorrents.length === 0) {
          let noMusicHtml = '<div style="grid-column:1/-1;color:#999;padding:20px;text-align:center;">Музыкальные торренты не найдены</div>';
          results.innerHTML = noMusicHtml;
          return;
        }

        // Показываем результаты
        musicTorrents.slice(0, 50).forEach((torrent, index) => {
          getDiscogsArt(query, function(cover) {
            displayTorrentResult(torrent, cover, query);
          });
        });

        let loadingHtml = '<div style="grid-column:1/-1;color:#999;text-align:center;padding:20px;">Загрузка обложек...</div>';
        results.innerHTML = loadingHtml;
      })
      .catch(error => {
        loading.style.display = 'none';
        let errorHtml = '<div style="grid-column:1/-1;color:#f88;padding:20px;background:#1a0000;border-radius:4px;">';
        errorHtml += '<strong>❌ Ошибка подключения к парсеру</strong><br>';
        errorHtml += '<p style="font-size:12px;margin:5px 0;">Убедитесь, что парсер (Jackett) запущен на адресе: ' + parserUrl + '</p>';
        errorHtml += '<p style="font-size:12px;margin:5px 0;">Ошибка: ' + error.message + '</p>';
        errorHtml += '</div>';
        results.innerHTML = errorHtml;
        console.error('Parser error:', error);
      });
  }

  /**
   * Получение обложки из Discogs
   */
  function getDiscogsArt(query, callback) {
    let token = Lampa.Storage.get('discogs_token', '');

    if (!token) {
      callback('https://via.placeholder.com/180x180?text=No+Cover');
      return;
    }

    let searchUrl = 'https://api.discogs.com/database/search?q=' + encodeURIComponent(query) + '&type=release&token=' + token;

    fetch(searchUrl)
      .then(response => response.json())
      .then(data => {
        if (data.results && data.results[0] && data.results[0].thumb) {
          callback(data.results[0].thumb);
        } else {
          callback('https://via.placeholder.com/180x180?text=No+Cover');
        }
      })
      .catch(error => {
        console.warn('Discogs error:', error);
        callback('https://via.placeholder.com/180x180?text=No+Cover');
      });
  }

  /**
   * Отображение результата торрента
   */
  function displayTorrentResult(torrent, cover, originalQuery) {
    let resultsContainer = document.getElementById('music-results');

    // Проверяем, не пустой ли контейнер с сообщением
    let loadingDiv = resultsContainer.querySelector('[style*="Загрузка обложек"]');
    if (loadingDiv) {
      loadingDiv.remove();
    }

    let resultElement = document.createElement('div');
    resultElement.style.cssText = 'background:#1a1a1a;border-radius:8px;overflow:hidden;cursor:pointer;transition:transform 0.2s,box-shadow 0.2s;';
    
    resultElement.onmouseover = function() {
      this.style.transform = 'translateY(-5px)';
      this.style.boxShadow = '0 8px 16px rgba(0,102,204,0.3)';
    };
    
    resultElement.onmouseout = function() {
      this.style.transform = 'translateY(0)';
      this.style.boxShadow = 'none';
    };

    let html = '<div style="width:100%;height:180px;background:#0a0a0a;overflow:hidden;">';
    html += '<img src="' + cover + '" alt="cover" style="width:100%;height:100%;object-fit:cover;background:#333;">';
    html += '</div>';
    html += '<div style="padding:10px;">';
    html += '<div style="color:#fff;font-size:12px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:5px;">' + torrent.Title.substring(0, 30) + '...</div>';
    html += '<div style="color:#999;font-size:10px;margin-bottom:8px;">👥 ' + (torrent.Seeders || 0) + ' | 📁 ' + formatSize(torrent.Size) + '</div>';
    html += '<div style="display:flex;gap:5px;">';
    html += '<button class="play-torrent-btn" style="flex:1;padding:6px;background:#0066cc;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;font-weight:bold;">▶️ Играть</button>';
    html += '<button class="info-torrent-btn" style="flex:0;padding:6px 8px;background:#444;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">ℹ️</button>';
    html += '</div>';
    html += '</div>';

    resultElement.innerHTML = html;

    resultElement.querySelector('.play-torrent-btn').onclick = function() {
      playTorrent(torrent);
    };

    resultElement.querySelector('.info-torrent-btn').onclick = function() {
      showTorrentInfo(torrent);
    };

    resultsContainer.appendChild(resultElement);
  }

  /**
   * Воспроизведение торрента
   */
  function playTorrent(torrent) {
    let loading = document.getElementById('music-loading');
    loading.style.display = 'block';
    loading.innerHTML = 'Отправляю в TorrServer...';

    let torrserverUrl = Lampa.Storage.get('torrserver_url', 'http://127.0.0.1:8090');

    if (!torrent.MagnetUri) {
      alert('❌ Магнет-ссылка не найдена для этого торрента');
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
        if (data.hash) {
          let streamUrl = torrserverUrl + '/play?link=' + data.hash + '&index=0';
          loading.innerHTML = 'Открываю плеер... ▶️';

          setTimeout(function() {
            // Пытаемся открыть через встроенный плеер
            if (typeof Lampa.Player !== 'undefined') {
              Lampa.Player.play(streamUrl);
            } else {
              // Если встроенного плеера нет, открываем в новом окне
              window.open(streamUrl, '_blank');
            }
            loading.style.display = 'none';
          }, 1000);
        } else {
          alert('❌ Ошибка TorrServer: ' + JSON.stringify(data));
          loading.style.display = 'none';
        }
      })
      .catch(error => {
        alert('❌ Ошибка подключения к TorrServer:\n' + error.message + '\n\nУбедитесь, что TorrServer запущен на ' + torrserverUrl);
        loading.style.display = 'none';
        console.error('TorrServer error:', error);
      });
  }

  /**
   * Показать информацию о торренте
   */
  function showTorrentInfo(torrent) {
    let info = 'Название: ' + torrent.Title + '\n\nСидеры: ' + (torrent.Seeders || 0) + '\nПиры: ' + (torrent.Peers || 0) + '\nРазмер: ' + formatSize(torrent.Size) + '\n\nДобавлен: ' + new Date(torrent.PublishDate).toLocaleDateString('ru-RU');
    alert(info);
  }

  /**
   * Показать настройки плагина
   */
  function showSettings() {
    let container = document.getElementById('music-plugin-container');
    let discogsToken = Lampa.Storage.get('discogs_token', '');
    let torrserverUrl = Lampa.Storage.get('torrserver_url', 'http://127.0.0.1:8090');

    let settingsHtml = '<div style="max-width:600px;background:#1a1a1a;border:1px solid #444;border-radius:8px;padding:20px;">';
    settingsHtml += '<h2 style="color:#fff;margin-top:0;">⚙️ Настройки плагина</h2>';
    settingsHtml += '<div style="margin-bottom:20px;">';
    settingsHtml += '<label style="display:block;color:#ccc;margin-bottom:5px;font-weight:bold;">Токен Discogs:</label>';
    settingsHtml += '<input type="password" id="discogs-token-setting" value="' + discogsToken + '" placeholder="Получить на https://www.discogs.com/settings/developers" style="width:100%;padding:8px;box-sizing:border-box;background:#0a0a0a;border:1px solid #444;color:#fff;border-radius:4px;">';
    settingsHtml += '<p style="color:#999;font-size:11px;margin:5px 0;"><a href="https://www.discogs.com/settings/developers" style="color:#0066cc;text-decoration:none;" target="_blank">🔗 Получить токен →</a></p>';
    settingsHtml += '</div>';
    settingsHtml += '<div style="margin-bottom:20px;">';
    settingsHtml += '<label style="display:block;color:#ccc;margin-bottom:5px;font-weight:bold;">URL TorrServer:</label>';
    settingsHtml += '<input type="text" id="torrserver-url-setting" value="' + torrserverUrl + '" placeholder="http://127.0.0.1:8090" style="width:100%;padding:8px;box-sizing:border-box;background:#0a0a0a;border:1px solid #444;color:#fff;border-radius:4px;">';
    settingsHtml += '<p style="color:#999;font-size:11px;margin:5px 0;">Адрес вашего TorrServer сервера</p>';
    settingsHtml += '</div>';
    settingsHtml += '<div style="display:flex;gap:10px;">';
    settingsHtml += '<button id="save-settings-btn" style="flex:1;padding:10px;background:#0066cc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">✓ Сохранить</button>';
    settingsHtml += '<button id="back-settings-btn" style="flex:1;padding:10px;background:#444;color:#fff;border:none;border-radius:4px;cursor:pointer;">← Назад</button>';
    settingsHtml += '</div>';
    settingsHtml += '</div>';

    container.innerHTML = settingsHtml;

    document.getElementById('save-settings-btn').onclick = function() {
      let token = document.getElementById('discogs-token-setting').value.trim();
      let url = document.getElementById('torrserver-url-setting').value.trim();

      if (token) Lampa.Storage.set('discogs_token', token);
      if (url) Lampa.Storage.set('torrserver_url', url);

      alert('✓ Настройки сохранены!');
      showMusicInterface();
    };

    document.getElementById('back-settings-btn').onclick = function() {
      showMusicInterface();
    };
  }

  /**
   * Форматирование размера файла
   */
  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
})();
