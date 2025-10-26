// 文字轉語音應用程式
class TextToSpeechApp {
    constructor() {
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
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadVoices();
        this.setupKeyboardShortcuts();
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
        
        // 語音合成事件
        this.synthesis.addEventListener('voiceschanged', () => this.loadVoices());
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
        this.voiceSelect.innerHTML = '<option value="">系統預設</option>';
        
        // 過濾中文語音
        const chineseVoices = voices.filter(voice => 
            voice.lang.startsWith('zh') || 
            voice.lang.startsWith('cmn') ||
            voice.name.includes('Chinese') ||
            voice.name.includes('中文')
        );
        
        chineseVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            this.voiceSelect.appendChild(option);
        });
        
        // 如果沒有找到中文語音，顯示所有可用語音
        if (chineseVoices.length === 0) {
            voices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.lang})`;
                this.voiceSelect.appendChild(option);
            });
        }
    }

    play() {
        const text = this.textInput.value.trim();
        if (!text) {
            this.showStatus('請先輸入要轉換的文字', 'error');
            return;
        }

        // 如果已暫停，繼續播放
        if (this.isPaused) {
            this.synthesis.resume();
            this.isPaused = false;
            this.lastPauseTime = 0;
            this.updateButtonStates();
            this.startProgressTracking();
            this.showStatus('繼續播放', 'info');
            return;
        }

        // 停止當前播放
        this.synthesis.cancel();
        
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
            this.showStatus('開始播放', 'success');
        };

        this.currentUtterance.onend = () => {
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
            this.stopProgressTracking();
            this.progressBar.style.width = '100%';
            this.showStatus('播放完成', 'info');
        };

        this.currentUtterance.onerror = (event) => {
            this.isPlaying = false;
            this.isPaused = false;
            this.updateButtonStates();
            this.stopProgressTracking();
            this.showStatus(`播放錯誤: ${event.error}`, 'error');
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
            this.showStatus('已暫停', 'info');
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
        if (this.isPaused) {
            this.playBtn.innerHTML = '<span class="btn-icon">▶️</span> 繼續';
        } else {
            this.playBtn.innerHTML = '<span class="btn-icon">▶️</span> 播放';
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
        if (this.currentUtterance && this.isPlaying) {
            const selectedVoice = this.voiceSelect.value;
            if (selectedVoice) {
                const voices = this.synthesis.getVoices();
                const voice = voices.find(v => v.name === selectedVoice);
                if (voice) {
                    this.currentUtterance.voice = voice;
                }
            }
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
        this.totalTimeEl.textContent = '00:00';
    }

    showStatus(message, type) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `status-message ${type}`;
        this.statusMessage.style.display = 'block';
        
        // 3秒後自動隱藏
        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 3000);
    }
}

// 當頁面載入完成時初始化應用程式
document.addEventListener('DOMContentLoaded', () => {
    new TextToSpeechApp();
    
    // 顯示歡迎訊息
    setTimeout(() => {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = '歡迎使用文字轉語音！請輸入文字後點擊播放。';
        statusEl.className = 'status-message info';
        statusEl.style.display = 'block';
        
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 3000);
    }, 1000);
});

// 處理瀏覽器相容性
if (!('speechSynthesis' in window)) {
    document.addEventListener('DOMContentLoaded', () => {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = '您的瀏覽器不支援語音合成功能，請使用較新版本的瀏覽器。';
        statusEl.className = 'status-message error';
        statusEl.style.display = 'block';
        
        // 禁用所有控制按鈕
        document.getElementById('playBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = true;
        document.getElementById('stopBtn').disabled = true;
    });
}
