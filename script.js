class VideoColorTracker {
    constructor() {
        this.videoInput = document.getElementById('videoInput');
        this.dropZone = document.getElementById('dropZone');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.videoWrapper = document.getElementById('videoWrapper');
        this.marker = document.getElementById('marker');
        this.colorPreview = document.getElementById('colorPreview');
        this.colorCode = document.getElementById('colorCode');
        this.pointCoords = document.getElementById('pointCoords');
        this.currentTimeLabel = document.getElementById('currentTime');
        this.startRecordBtn = document.getElementById('startRecordBtn');
        this.stopRecordBtn = document.getElementById('stopRecordBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.fastForwardBtn = document.getElementById('fastForwardBtn');
        this.skipToEndBtn = document.getElementById('skipToEndBtn');
        this.speedSelect = document.getElementById('speedSelect');
        this.toggleViewBtn = document.getElementById('toggleViewBtn');
        this.toggleHueBtn = document.getElementById('toggleHueBtn');
        this.hueRing = document.getElementById('hueRing');
        this.hueBar = document.getElementById('hueBar');
        this.huePointer = document.getElementById('huePointer');
        this.satFill = document.getElementById('satFill');
        this.lightFill = document.getElementById('lightFill');
        this.satValue = document.getElementById('satValue');
        this.lightValue = document.getElementById('lightValue');
        this.timelineList = document.getElementById('timelineList');
        this.recordCount = document.getElementById('recordCount');
        this.hiddenCanvas = document.getElementById('hiddenCanvas');

        this.ctx = this.hiddenCanvas.getContext('2d');
        this.videoURL = null;
        this.selectedPoint = null;
        this.recording = false;
        this.timeline = [];
        this.recordInterval = null;
        this.viewMode = 'list';

        this.attachEvents();
    }

    attachEvents() {
        this.videoInput.addEventListener('change', (e) => this.loadVideoFile(e));
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        this.videoWrapper.addEventListener('click', (e) => this.handleVideoClick(e));
        this.videoPlayer.addEventListener('loadedmetadata', () => this.resizeCanvas());
        this.videoPlayer.addEventListener('timeupdate', () => this.updatePlaybackTime());
        this.videoPlayer.addEventListener('pause', () => this.onPlaybackChanged());
        this.videoPlayer.addEventListener('play', () => this.onPlaybackChanged());
        this.videoPlayer.addEventListener('seeked', () => this.onSeeked());
        this.videoPlayer.addEventListener('ratechange', () => this.onRateChanged());
        this.startRecordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.exportBtn.addEventListener('click', () => this.exportTimeline());
        this.fastForwardBtn && this.fastForwardBtn.addEventListener('click', () => this.handleFastForward());
        this.skipToEndBtn && this.skipToEndBtn.addEventListener('click', () => this.handleSkipToEndAndRecord());
        this.speedSelect && this.speedSelect.addEventListener('change', (e) => this.handleSpeedChange(e));
        this.toggleViewBtn.addEventListener('click', () => this.toggleTimelineView());
        this.toggleHueBtn && this.toggleHueBtn.addEventListener('click', () => this.toggleHueView());
        this.timelineList.addEventListener('click', (e) => this.handleTimelineClick(e));
    }

    loadVideoFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            this.showAlert('請上傳影片檔案。', 'error');
            return;
        }

        if (this.videoURL) {
            URL.revokeObjectURL(this.videoURL);
        }

        this.videoURL = URL.createObjectURL(file);
        this.videoPlayer.src = this.videoURL;
        this.videoPlayer.load();
        this.resetState();
        this.showAlert('影片已載入，請點選畫面挑選顏色點。', 'success');
    }

    handleDragOver(event) {
        event.preventDefault();
        this.dropZone.style.background = 'rgba(59, 130, 246, 0.16)';
    }

    handleDrop(event) {
        event.preventDefault();
        this.dropZone.style.background = '';
        const file = event.dataTransfer.files?.[0];
        if (!file) return;
        this.videoInput.files = event.dataTransfer.files;
        this.loadVideoFile({ target: { files: [file] } });
    }

    resizeCanvas() {
        if (!this.videoPlayer.videoWidth || !this.videoPlayer.videoHeight) return;
        this.hiddenCanvas.width = this.videoPlayer.videoWidth;
        this.hiddenCanvas.height = this.videoPlayer.videoHeight;
    }

    handleVideoClick(event) {
        if (!this.videoPlayer.videoWidth || !this.videoPlayer.videoHeight) {
            this.showAlert('請先上傳影片並載入。', 'warning');
            return;
        }

        const rect = this.videoPlayer.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const scaleX = this.videoPlayer.videoWidth / rect.width;
        const scaleY = this.videoPlayer.videoHeight / rect.height;
        const x = Math.min(Math.max(Math.round(offsetX * scaleX), 0), this.videoPlayer.videoWidth - 1);
        const y = Math.min(Math.max(Math.round(offsetY * scaleY), 0), this.videoPlayer.videoHeight - 1);

        this.selectedPoint = { x, y, displayX: offsetX, displayY: offsetY };
        this.placeMarker(offsetX, offsetY);
        this.updateCurrentColor();
        this.startRecordBtn.disabled = false;
        this.skipToEndBtn.disabled = false;
        this.exportBtn.disabled = this.timeline.length === 0;
    }

    placeMarker(offsetX, offsetY) {
        this.marker.style.left = `${offsetX}px`;
        this.marker.style.top = `${offsetY}px`;
        this.marker.style.opacity = '1';
    }

    updateCurrentColor() {
        if (!this.selectedPoint) return;
        this.drawVideoFrame();
        const pixel = this.ctx.getImageData(this.selectedPoint.x, this.selectedPoint.y, 1, 1).data;
        const hex = this.rgbToHex(pixel[0], pixel[1], pixel[2]);
        this.colorPreview.style.background = hex;
        this.colorCode.textContent = hex;
        this.pointCoords.textContent = `(${this.selectedPoint.x}, ${this.selectedPoint.y})`;
        this.currentTimeLabel.textContent = this.formatTime(this.videoPlayer.currentTime);
        const hsl = this.rgbToHsl(pixel[0], pixel[1], pixel[2]);
        this.updateHSLDisplay(hsl.h, hsl.s, hsl.l);
    }

    drawVideoFrame() {
        try {
            this.ctx.drawImage(this.videoPlayer, 0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);
        } catch (error) {
            console.warn('無法讀取當前影格，請確保影片已載入並允許同源存取。', error);
        }
    }

    updatePlaybackTime() {
        if (!this.selectedPoint) return;
        this.currentTimeLabel.textContent = this.formatTime(this.videoPlayer.currentTime);
    }

    onRateChanged() {
        if (!this.selectedPoint) return;
        this.updatePlaybackTime();
    }

    onSeeked() {
        if (!this.selectedPoint) return;
        if (this.skipToEndActive) {
            this.recordSkipSample();
            return;
        }
        this.updateCurrentColor();
    }

    handleFastForward() {
        if (!this.videoPlayer.duration) return;
        this.videoPlayer.currentTime = Math.min(this.videoPlayer.currentTime + 5, this.videoPlayer.duration);
    }

    handleSkipToEndAndRecord() {
        if (!this.selectedPoint) {
            this.showAlert('請先選擇影片中的一個位置。', 'warning');
            return;
        }
        if (!this.videoPlayer.duration) return;
        if (this.skipToEndActive) return;

        this.skipToEndActive = true;
        this.skipToEndBtn.disabled = true;
        this.fastForwardBtn.disabled = true;
        this.startRecordBtn.disabled = true;
        this.stopRecordBtn.disabled = true;
        this.showAlert('正在快速跳轉至影片結束並記錄過程。', 'info');

        this.skipStep = 0.5;
        this.skipTargetTime = this.videoPlayer.duration;
        this.recordSkipSample();
    }

    recordSkipSample() {
        if (!this.selectedPoint || !this.skipToEndActive) return;

        const currentTime = Math.min(this.videoPlayer.currentTime, this.videoPlayer.duration);
        this.drawVideoFrame();
        const pixel = this.ctx.getImageData(this.selectedPoint.x, this.selectedPoint.y, 1, 1).data;
        const hex = this.rgbToHex(pixel[0], pixel[1], pixel[2]);
        const sample = {
            time: currentTime,
            hex,
            rgb: `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`,
            brightness: Math.round((pixel[0] + pixel[1] + pixel[2]) / 3)
        };

        const lastSample = this.timeline[this.timeline.length - 1];
        if (!lastSample || lastSample.hex !== sample.hex || Math.abs(lastSample.time - sample.time) >= 0.25) {
            this.timeline.push(sample);
            this.renderTimeline();
        }

        this.currentTimeLabel.textContent = this.formatTime(currentTime);

        if (currentTime >= this.skipTargetTime || currentTime >= this.videoPlayer.duration) {
            this.finishSkipToEnd();
            return;
        }

        const nextTime = Math.min(currentTime + this.skipStep, this.skipTargetTime);
        this.videoPlayer.currentTime = nextTime;
    }

    finishSkipToEnd() {
        this.skipToEndActive = false;
        this.skipStep = 0;
        this.skipTargetTime = 0;
        this.skipToEndBtn.disabled = false;
        this.fastForwardBtn.disabled = false;
        this.startRecordBtn.disabled = !this.selectedPoint;
        this.stopRecordBtn.disabled = true;
        this.exportBtn.disabled = this.timeline.length === 0;
        this.showAlert('已完成快進至結束並記錄過程。', 'success');
    }

    handleSpeedChange(event) {
        const rate = parseFloat(event.target.value);
        if (Number.isFinite(rate) && rate > 0) {
            this.videoPlayer.playbackRate = rate;
            this.showAlert(`播放速度已設為 ${rate}x。`, 'success');
        }
    }

    onPlaybackChanged() {
        if (this.recording && this.videoPlayer.paused) {
            this.stopRecording();
        }
    }

    startRecording() {
        if (!this.selectedPoint) {
            this.showAlert('請先選擇影片中的一個位置。', 'warning');
            return;
        }

        if (this.recording) return;

        this.recording = true;
        this.timeline = [];
        this.renderTimeline();
        this.startRecordBtn.disabled = true;
        this.stopRecordBtn.disabled = false;
        this.exportBtn.disabled = true;
        this.recordInterval = setInterval(() => this.recordSample(), 250);
        if (this.videoPlayer.paused) {
            this.videoPlayer.play();
        }
        this.showAlert('開始記錄顏色變化。', 'success');
    }

    stopRecording() {
        if (!this.recording) return;
        this.recording = false;
        clearInterval(this.recordInterval);
        this.recordInterval = null;
        this.startRecordBtn.disabled = false;
        this.stopRecordBtn.disabled = true;
        this.exportBtn.disabled = this.timeline.length === 0;
        this.showAlert('已停止記錄。', 'info');
    }

    recordSample() {
        if (!this.selectedPoint || this.videoPlayer.paused || this.videoPlayer.ended) return;
        this.drawVideoFrame();
        const pixel = this.ctx.getImageData(this.selectedPoint.x, this.selectedPoint.y, 1, 1).data;
        const time = this.videoPlayer.currentTime;
        const wave = Math.round((pixel[0] + pixel[1] + pixel[2]) / 3);
        const sample = {
            time,
            hex: this.rgbToHex(pixel[0], pixel[1], pixel[2]),
            rgb: `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`,
            brightness: wave
        };

        const hsl = this.rgbToHsl(pixel[0], pixel[1], pixel[2]);
        // keep last HSL displayed while recording
        this.updateHSLDisplay(hsl.h, hsl.s, hsl.l);

        const lastSample = this.timeline[this.timeline.length - 1];
        if (!lastSample || lastSample.hex !== sample.hex || Math.abs(lastSample.time - sample.time) >= 0.25) {
            this.timeline.push(sample);
            this.renderTimeline();
        }

        this.currentTimeLabel.textContent = this.formatTime(time);
    }

    renderTimeline() {
        this.recordCount.textContent = `${this.timeline.length} 條記錄`;
        if (this.timeline.length === 0) {
            this.timelineList.innerHTML = '<div class="empty-state timeline-empty">尚未開始記錄</div>';
            return;
        }

        if (this.viewMode === 'bar') {
            this.timelineList.innerHTML = `
                <div class="timeline-bar-wrapper">
                    <div class="timeline-bar" aria-label="顏色長條顯示">
                        ${this.timeline.map((item, index) => `
                            <span class="timeline-segment" data-index="${index}" style="background: ${item.hex};" title="時間：${this.formatTime(item.time)} / ${item.hex}" role="button" tabindex="0"></span>
                        `).join('')}
                    </div>
                    <div class="timeline-bar-note">點擊色塊可切換到列表並查看詳細資訊</div>
                </div>
            `;
            return;
        }

        this.timelineList.innerHTML = this.timeline
            .map((item, index) => `
                <div class="timeline-item" data-index="${index}">
                    <div class="timeline-swatch" style="background: ${item.hex};"></div>
                    <div class="timeline-meta">
                        <span>時間：${this.formatTime(item.time)}</span>
                        <span>HEX：${item.hex}</span>
                    </div>
                    <div class="timeline-meta">
                        <span>${item.rgb}</span>
                    </div>
                </div>
            `)
            .join('');
    }

    handleTimelineClick(event) {
        const segment = event.target.closest('[data-index]');
        if (!segment) return;

        const index = parseInt(segment.dataset.index, 10);
        if (isNaN(index)) return;

        if (this.viewMode === 'bar') {
            this.viewMode = 'list';
            this.toggleViewBtn.textContent = '長條顯示';
            this.renderTimeline();
            this.scrollToTimelineItem(index);
        } else {
            this.scrollToTimelineItem(index);
        }
    }

    scrollToTimelineItem(index) {
        if (index < 0 || index >= this.timeline.length) return;
        const item = this.timelineList.querySelector(`[data-index="${index}"]`);
        if (!item) return;

        item.classList.add('highlighted');
        item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        setTimeout(() => item.classList.remove('highlighted'), 2000);
    }

    toggleTimelineView() {
        this.viewMode = this.viewMode === 'list' ? 'bar' : 'list';
        this.toggleViewBtn.textContent = this.viewMode === 'list' ? '長條顯示' : '列表顯示';
        this.renderTimeline();
    }

    exportTimeline() {
        if (this.timeline.length === 0) {
            this.showAlert('沒有可匯出的記錄。', 'warning');
            return;
        }

        const csvRows = ['時間,HEX,RGB'];
        this.timeline.forEach(({ time, hex, rgb }) => {
            csvRows.push(`${this.formatTime(time)},${hex},${rgb}`);
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'color_timeline.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    toggleHueView() {
        if (!this.hueRing || !this.hueBar || !this.toggleHueBtn) return;
        const isRing = !this.hueBar.hidden;
        // if currently bar visible, switch to ring
        this.hueBar.hidden = isRing;
        this.hueRing.style.display = isRing ? 'block' : '';
        this.toggleHueBtn.textContent = isRing ? '圓環' : '長條';
        // flip logic: if was ring (hueBar.hidden true), show bar
        if (isRing) {
            this.hueBar.hidden = false;
        } else {
            this.hueBar.hidden = true;
        }
        // simpler: toggle based on hidden state
        if (this.hueBar.hidden) {
            this.hueRing.style.display = 'block';
            this.toggleHueBtn.textContent = '圓環';
        } else {
            this.hueRing.style.display = 'none';
            this.toggleHueBtn.textContent = '長條';
        }
    }

    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0; // achromatic
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
    }

    updateHSLDisplay(h, s, l) {
        // update hue pointer rotation
        if (this.huePointer) {
            this.huePointer.style.transform = `rotate(${h}deg)`;
        }

        // ensure hueBar exists
        if (this.hueBar) {
            // nothing dynamic required; it's a static rainbow
        }

        // update saturation fill: use background based on hue to show variation
        if (this.satFill) {
            this.satFill.style.width = `${s}%`;
            // set gradient to reflect hue influence
            this.satFill.style.background = `linear-gradient(90deg, rgba(255,255,255,0), hsl(${h} 100% ${l}%))`;
        }

        // update lightness fill
        if (this.lightFill) {
            this.lightFill.style.width = `${l}%`;
            this.lightFill.style.background = `linear-gradient(90deg, hsl(${h} ${s}% 0%), hsl(${h} ${s}% 50%), hsl(${h} ${s}% 100%))`;
        }

        if (this.satValue) this.satValue.textContent = `${s}%`;
        if (this.lightValue) this.lightValue.textContent = `${l}%`;
    }

    resetState() {
        this.selectedPoint = null;
        this.recording = false;
        this.timeline = [];
        this.startRecordBtn.disabled = true;
        this.stopRecordBtn.disabled = true;
        this.skipToEndBtn.disabled = true;
        this.exportBtn.disabled = true;
        this.marker.style.opacity = '0';
        this.colorPreview.style.background = '#f3f4f6';
        this.colorCode.textContent = '#------';
        this.pointCoords.textContent = '尚未選取';
        this.currentTimeLabel.textContent = '00:00';
        this.renderTimeline();
    }

    rgbToHex(r, g, b) {
        const toHex = (value) => value.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    showAlert(message, type = 'info') {
        const alertDiv = document.createElement('div');
        alertDiv.textContent = message;
        alertDiv.style.cssText = `
            position: fixed;
            top: 1.25rem;
            right: 1.25rem;
            padding: 0.95rem 1.25rem;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.92);
            color: white;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.22);
            z-index: 9999;
            opacity: 0;
            transform: translateY(-10px);
            transition: opacity 0.25s ease, transform 0.25s ease;
        `;

        document.body.appendChild(alertDiv);
        requestAnimationFrame(() => {
            alertDiv.style.opacity = '1';
            alertDiv.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transform = 'translateY(-10px)';
            alertDiv.addEventListener('transitionend', () => alertDiv.remove(), { once: true });
        }, 2600);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new VideoColorTracker();
});
