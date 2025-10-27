const translations = {
    'en': {
        pageTitle: 'Text to Speech - TTS Reader',
        headerTitle: '🎤 Text to Speech',
        headerSubtitle: 'Convert your text into natural-sounding speech',
        textInputLabel: 'Enter text to convert:',
        textInputPlaceholder: 'Enter or paste the text you want to convert to speech here...',
        playBtn: 'Play',
        resumeBtn: 'Resume',
        pauseBtn: 'Pause',
        stopBtn: 'Stop',
        rateLabel: 'Rate:',
        volumeLabel: 'Volume:',
        voiceLabel: 'Voice:',
        voiceDefault: 'System Default',
        languageLabel: 'Language:',
        footerText: "This app uses the browser's built-in text-to-speech technology",
        status_welcome: 'Welcome! Please input some text to get started.',
        status_empty_text: 'Please enter some text to convert.',
        status_resumed: 'Resuming playback.',
        status_playing: 'Playback started.',
        status_finished: 'Playback finished.',
        status_error: 'An error occurred during playback: {error}',
        status_paused: 'Playback paused.',
        status_stopped: 'Playback stopped.',
        status_unsupported: 'Your browser does not support speech synthesis. Please use a newer browser.'
    },
    'zh-TW': {
        pageTitle: '文字轉語音 - TTS Reader',
        headerTitle: '🎤 文字轉語音',
        headerSubtitle: '將您的文字轉換為自然語音',
        textInputLabel: '輸入要轉換的文字：',
        textInputPlaceholder: '請在此輸入或貼上您要轉換為語音的文字...',
        playBtn: '播放',
        resumeBtn: '繼續',
        pauseBtn: '暫停',
        stopBtn: '停止',
        rateLabel: '語速：',
        volumeLabel: '音量：',
        voiceLabel: '語音：',
        voiceDefault: '系統預設',
        languageLabel: '語言：',
        footerText: '本應用程式使用瀏覽器內建的文字轉語音技術',
        status_welcome: '歡迎使用！請輸入文字以開始轉換。',
        status_empty_text: '請先輸入要轉換的文字。',
        status_resumed: '繼續播放。',
        status_playing: '開始播放。',
        status_finished: '播放完成。',
        status_error: '播放時發生錯誤: {error}',
        status_paused: '已暫停。',
        status_stopped: '已停止。',
        status_unsupported: '您的瀏覽器不支援語音合成功能，請使用較新版本的瀏覽器。'
    }
};

// 文字轉語音應用程式
class TextToSpeechApp {
    constructor() {
        if (!('speechSynthesis' in window)) {
            this.handleUnsupportedBrowser();
            return;
        }
    
        this.synthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pausedTime = 0;
        this.totalDuration = 0;
        this.progressInterval = null;
        this.accumulatedPauseTime = 0;
        this.lastPauseTime = 0;
        this.currentLang = 'zh-TW'; // Default language
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadVoices();
        this.setupKeyboardShortcuts();

        // Initialize language and voices
        const savedLang = localStorage.getItem('tts-app-lang') || 'zh-TW';
        this.setLanguage(savedLang);

        this.showStatus('status_welcome', 'info');
    }

    initializeElements() {
        // 主要元素
        this.textInput = document.getElementById('textInput');
        this.playBtn = document.getElementById('playBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        
        // 設定元素
        this.rateSlider = document.getElementById('rateSlider');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.voiceSelect = document.getElementById('voiceSelect');
        this.langSelect = document.getElementById('langSelect');
        
        // 進度元素
        this.progressBar = document.getElementById('progressBar');
        this.currentTimeEl = document.getElementById('currentTime');
        this.totalTimeEl = document.getElementById('totalTime');
        
        // 狀態訊息
        this.statusMessage = document.getElementById('statusMessage');
    }

    attachEventListeners() {
        // 播放控制
        this.playBtn.addEventListener('click', () => this.play());
        this.pauseBtn.addEventListener('click', () => this.pause());
        this.stopBtn.addEventListener('click', () => this.stop());
        
        
        // 設定變更
        this.rateSlider.addEventListener('input', () => this.updateRate());
        this.volumeSlider.addEventListener('input', () => this.updateVolume());
        this.voiceSelect.addEventListener('change', () => this.updateVoice());
        this.langSelect.addEventListener('change', () => this.setLanguage(this.langSelect.value));

        // 語音合成事件
        this.synthesis.addEventListener('voiceschanged', () => this.loadVoices());
    }

    setLanguage(lang) {
        if (!translations[lang]) return;

        this.currentLang = lang;
        document.documentElement.lang = lang;
        localStorage.setItem('tts-app-lang', lang);
        this.langSelect.value = lang;

        const langPack = translations[lang];
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.dataset.langKey;
            if (langPack[key]) {
                if (el.placeholder !== undefined) {
                    el.placeholder = langPack[key];
                } else {
                    el.textContent = langPack[key];
                }
            }
        });

        this.updateButtonStates();
        this.loadVoices(); // Reload voices as their names might be localized
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // 避免在輸入框中觸發快捷鍵
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    if (this.isPlaying && !this.isPaused) {
                        this.pause();
                    } else {
                        this.play();
                    }
                    break;
                case 'Escape':
                    this.stop();
                    break;
            }
        });
    }

    loadVoices() {
        
        const voices = this.synthesis.getVoices();
        // In some browsers, getVoices is async, if it's empty, the 'voiceschanged' event will fire.
        if (voices.length === 0) {
            return;
        }

        const currentVoiceName = this.voiceSelect.value;
        const langPack = translations[this.currentLang];
        
        this.voiceSelect.innerHTML = `<option value="" data-lang-key="voiceDefault">${langPack.voiceDefault}</option>`;
        
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            this.voiceSelect.appendChild(option);
        });
        
        // Restore selection if possible
        if (voices.some(v => v.name === currentVoiceName)) {
            this.voiceSelect.value = currentVoiceName;
        }
    }

    play() {
        const text = this.textInput.value.trim();
        if (!text) {
            this.showStatus('status_empty_text', 'error');
            return;
        }

        // 如果已暫停，繼續播放
        if (this.isPaused) {
            this.synthesis.resume();
            this.isPaused = false;
            this.lastPauseTime = 0;
            this.updateButtonStates();
            this.startProgressTracking();
            this.showStatus('status_resumed', 'info');
            return;
        }

        // 停止當前播放 (如果有的話)
        if (this.synthesis.speaking) {
            this.synthesis.cancel();
        }
        
        // 重置暫停時間累計
        this.accumulatedPauseTime = 0;
        this.lastPauseTime = 0;
        
        // 創建新的語音合成
        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // 設定語音參數
        this.currentUtterance.rate = parseFloat(this.rateSlider.value);
        this.currentUtterance.volume = parseFloat(this.volumeSlider.value);
        this.currentUtterance.pitch = 1;
        
        // 估算總時長（基於文字長度和語速）
        this.estimateTotalDuration(text);
        
        // 設定語音
        const selectedVoice = this.voiceSelect.value;
        if (selectedVoice) {
            const voices = this.synthesis.getVoices();
            const voice = voices.find(v => v.name === selectedVoice);
            if (voice) {
                this.currentUtterance.voice = voice;
            }
        }

        // 設定事件監聽器
        this.currentUtterance.onstart = () => {
            this.isPlaying = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.updateButtonStates();
            this.startProgressTracking();
            this.showStatus('status_playing', 'success');
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
            this.stopProgressTracking();
            this.progressBar.style.width = '100%';
            this.showStatus('status_finished', 'info');
        };

        this.currentUtterance.onerror = (event) => {
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
            this.stopProgressTracking();
            this.showStatus('status_error', 'error', { error: event.error });
        };

        // 開始播放
        this.synthesis.speak(this.currentUtterance);
    }

    pause() {
        if (this.isPlaying && !this.isPaused) {
            this.synthesis.pause();
            this.isPaused = true;
            this.lastPauseTime = Date.now();
            this.updateButtonStates();
            this.stopProgressTracking();
            this.showStatus('status_paused', 'info');
        }
    }

    stop() {
        this.synthesis.cancel();
        this.isPlaying = false;
        this.isPaused = false;
        this.accumulatedPauseTime = 0;
        this.lastPauseTime = 0;
        this.updateButtonStates();
        this.stopProgressTracking();
        this.resetProgress();
        this.showStatus('已停止', 'info');
    }

    updateButtonStates() {
        this.playBtn.disabled = this.isPlaying && !this.isPaused;
        this.pauseBtn.disabled = !this.isPlaying || this.isPaused;
        this.stopBtn.disabled = !this.isPlaying && !this.isPaused;
        
        // 更新按鈕文字和圖示
        const playBtnTextEl = this.playBtn.querySelector('[data-lang-key="playBtn"]');
        if (playBtnTextEl) {
            const langPack = translations[this.currentLang];
            playBtnTextEl.textContent = this.isPaused ? langPack.resumeBtn : langPack.playBtn;
        }
    }

    updateRate() {
        const rate = this.rateSlider.value;
        document.getElementById('rateValue').textContent = `${rate}x`;
        
        if (this.currentUtterance) {
            this.currentUtterance.rate = parseFloat(rate);
        }
        
        // 如果正在播放，重新計算總時長
        if (this.isPlaying && this.textInput.value.trim()) {
            this.estimateTotalDuration(this.textInput.value.trim());
        }
    }

    updateVolume() {
        const volume = this.volumeSlider.value;
        const percentage = Math.round(volume * 100);
        document.getElementById('volumeValue').textContent = `${percentage}%`;
        
        if (this.currentUtterance) {
            this.currentUtterance.volume = parseFloat(volume);
        }
    }

    updateVoice() {
        // Stop and restart with the new voice for immediate effect
        if (this.isPlaying) {
            this.play();
        }
    }

    startProgressTracking() {
        this.progressInterval = setInterval(() => {
            if (this.isPlaying && !this.isPaused) {
                const now = Date.now();
                const elapsed = now - this.startTime - this.accumulatedPauseTime;
                const progress = Math.min(elapsed / this.totalDuration, 1);
                this.progressBar.style.width = `${progress * 100}%`;
                
                // 更新時間顯示
                this.updateTimeDisplay(elapsed);
            } else if (this.isPaused && this.lastPauseTime > 0) {
                // 累計暫停時間
                const pauseDuration = Date.now() - this.lastPauseTime;
                this.accumulatedPauseTime += pauseDuration;
                this.lastPauseTime = Date.now();
            }
        }, 100);
    }

    stopProgressTracking() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }

    estimateTotalDuration(text) {
        // 基於文字長度和語速估算總時長
        // 假設平均每分鐘可以讀 200 個中文字符
        const baseWordsPerMinute = 200;
        const rate = parseFloat(this.rateSlider.value);
        const estimatedMinutes = text.length / (baseWordsPerMinute * rate);
        this.totalDuration = estimatedMinutes * 60 * 1000; // 轉換為毫秒
        
        // 更新總時間顯示
        this.updateTotalTimeDisplay();
    }

    updateTimeDisplay(elapsed) {
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        this.currentTimeEl.textContent = 
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    updateTotalTimeDisplay() {
        const totalSeconds = Math.floor(this.totalDuration / 1000);
        const totalMinutes = Math.floor(totalSeconds / 60);
        const remainingSeconds = totalSeconds % 60;
        
        this.totalTimeEl.textContent = 
            `${totalMinutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    resetProgress() {
        this.progressBar.style.width = '0%';
        this.currentTimeEl.textContent = '00:00';
        //this.totalTimeEl.textContent = '00:00';
        // Don't reset total time until a new play starts
    }

    showStatus(key, type, params = {}) {
        const langPack = translations[this.currentLang];
        let message = langPack[key] || key;
        if (params.error) {
            message = message.replace('{error}', params.error);
        }
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
        
        // 3秒後自動隱藏
        setTimeout(() => {
            if (this.statusMessage.textContent === message) {
                this.statusMessage.style.display = 'none';
            }
        }, 3000);
    }

    handleUnsupportedBrowser() {
        const statusEl = document.getElementById('statusMessage');
        // Try to guess browser language for a better message
        const lang = navigator.language || navigator.userLanguage;
        let message = translations.en.status_unsupported;
        if (lang.startsWith('zh')) {
            message = translations['zh-TW'].status_unsupported;
        }
        statusEl.textContent = message;
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        
        // 禁用所有控制項
        document.querySelectorAll('.btn, input, select, textarea').forEach(el => el.disabled = true);
    }

}

// 當頁面載入完成時初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new TextToSpeechApp();
    
    // 顯示歡迎訊息
    setTimeout(() => {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = 'Welcome, please input some text to speech';
        statusEl.className = 'status-message info';
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }, 1000);
});
