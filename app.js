// Telegram Web App API
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// Конфигурация
const WEBHOOK_URL = 'https://daniiltyasto.ru/webhook/NadiaTurlaeva_task_bot';

// Элементы DOM
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileStats = document.getElementById('fileStats');
const settings = document.getElementById('settings');
const createButton = document.getElementById('createButton');
const status = document.getElementById('status');
const historyList = document.getElementById('historyList');

// Данные
let currentFile = null;
let parsedData = null;

// История из localStorage
let history = JSON.parse(localStorage.getItem('digestHistory') || '[]');

// Инициализация
init();

function init() {
    setupEventListeners();
    renderHistory();

    // Настройка темы Telegram
    document.body.style.backgroundColor = tg.themeParams.bg_color || '#ffffff';
    document.body.style.color = tg.themeParams.text_color || '#000000';
}

function setupEventListeners() {
    // Клик по зоне загрузки
    uploadZone.addEventListener('click', () => fileInput.click());

    // Выбор файла
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // Кнопка создания
    createButton.addEventListener('click', createDigest);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Проверка типа файла
    if (!file.name.endsWith('.json')) {
        showStatus('error', '❌ Пожалуйста, выберите JSON файл');
        return;
    }

    currentFile = file;
    showStatus('loading', '📖 Читаю файл...');

    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            parsedData = JSON.parse(e.target.result);

            // Проверка структуры
            if (!parsedData.messages || !Array.isArray(parsedData.messages)) {
                throw new Error('Неверный формат файла. Должно быть поле "messages"');
            }

            // Показываем информацию о файле
            const messageCount = parsedData.messages.filter(m =>
                m.type === 'message' && m.text && m.from
            ).length;

            fileName.textContent = `📄 ${file.name}`;
            fileStats.textContent = `📊 Сообщений: ${messageCount} | 👥 Чат: ${parsedData.name || 'Без названия'}`;

            fileInfo.classList.add('visible');
            settings.style.display = 'block';
            createButton.disabled = false;

            hideStatus();

            // Вибрация при успехе
            tg.HapticFeedback.notificationOccurred('success');

        } catch (error) {
            showStatus('error', `❌ Ошибка чтения файла: ${error.message}`);
            tg.HapticFeedback.notificationOccurred('error');
        }
    };

    reader.onerror = () => {
        showStatus('error', '❌ Не удалось прочитать файл');
        tg.HapticFeedback.notificationOccurred('error');
    };

    reader.readAsText(file);
}

async function createDigest() {
    if (!parsedData) return;

    createButton.disabled = true;
    showStatus('loading', '<div class="loader"></div> Создаю дайджест...');

    tg.HapticFeedback.impactOccurred('medium');

    // Собираем настройки
    const style = document.getElementById('styleSelect').value;
    const maxLength = parseInt(document.getElementById('lengthSelect').value);
    const digestNumber = parseInt(document.getElementById('digestNumber').value);

    // Подготавливаем данные для отправки
    const payload = {
        user_id: tg.initDataUnsafe?.user?.id,
        chat_id: tg.initDataUnsafe?.user?.id,
        telegram_data: parsedData,
        settings: {
            style: style,
            max_length: maxLength,
            digest_number: digestNumber
        },
        timestamp: new Date().toISOString()
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Сохраняем в историю
        saveToHistory({
            date: new Date().toISOString(),
            digestNumber: digestNumber,
            messageCount: parsedData.messages.length,
            chatName: parsedData.name
        });

        showStatus('success', '✅ Дайджест создан! Проверьте бота.');
        tg.HapticFeedback.notificationOccurred('success');

        // Закрываем Mini App через 2 секунды
        setTimeout(() => {
            tg.close();
        }, 2000);

    } catch (error) {
        showStatus('error', `❌ Ошибка: ${error.message}`);
        tg.HapticFeedback.notificationOccurred('error');
        createButton.disabled = false;
    }
}

function showStatus(type, message) {
    status.className = `status visible ${type}`;
    status.innerHTML = message;
}

function hideStatus() {
    status.classList.remove('visible');
}

function saveToHistory(item) {
    history.unshift(item);

    // Храним только последние 10
    if (history.length > 10) {
        history = history.slice(0, 10);
    }

    localStorage.setItem('digestHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">История пуста</div>';
        return;
    }

    historyList.innerHTML = history.map(item => {
        const date = new Date(item.date);
        const dateStr = date.toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="history-item">
                <div style="font-weight: 500;">Дайджест №${item.digestNumber}</div>
                <div style="font-size: 12px; color: var(--tg-theme-hint-color); margin-top: 4px;">
                    📅 ${dateStr} • 💬 ${item.messageCount} сообщений
                </div>
                <div style="font-size: 12px; color: var(--tg-theme-hint-color);">
                    ${item.chatName}
                </div>
            </div>
        `;
    }).join('');
}

// Обработка кнопки "Назад" в Telegram
tg.BackButton.onClick(() => {
    tg.close();
});
